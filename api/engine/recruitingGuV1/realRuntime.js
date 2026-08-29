/* global process */

import {
  createOpaqueId,
  createOpaqueToken,
  digestToken,
  normalizeProfileId,
  stableHash,
} from '../../../src/lib/recruitingV1/contracts.js';
import { getCanonicalProfile } from '../../business-assessment/shared.js';
import { getRecruitingService } from '../recruitingV1/runtime.js';
import { getRecruitingRedis } from '../recruitingV1/redisStore.js';
import { readCurrentAuthoredSurfaces } from './authoredSurfaces.js';
import { createRecruitingGuWorld } from '../../../src/lib/recruitingGuV1/world.js';
import { createRecruitingGuV1Runtime } from './runtime.js';

const APPROVAL_TTL_MS = 30 * 60 * 1000;

function publicRequest(item) {
  return {
    request_id: item.request_id,
    profile_id: item.profile_id,
    owner_name: item.owner_name,
    status: item.status,
    requested_at: item.requested_at,
    expires_at: item.expires_at,
    decided_at: item.decided_at || null,
    relationship_id: item.relationship_id || null,
    profile_id_is_authority: false,
  };
}

function publicRelationship(item) {
  return {
    relationship_id: item.relationship_id,
    profile_id: item.profile_id,
    owner_name: item.owner_name,
    consent_state: item.consent_state,
    status: item.status,
    authorized_at: item.authorized_at,
    source: item.source,
  };
}

function sessionAuthority(membership, relationship) {
  return Object.freeze({
    manager_subject_id: membership.manager_subject_id,
    membership_id: membership.membership_id,
    enterprise_id: membership.enterprise_id,
    relationship_id: relationship.relationship_id,
    candidate_id: relationship.candidate_id || null,
    profile_id: relationship.profile_id,
  });
}

async function relationshipBinding({ service, redis, membership, relationship, env }) {
  const authored = await readCurrentAuthoredSurfaces({ redis, profileId: relationship.profile_id, env });
  const manager = {
    name: membership.manager_name,
    subject_id: membership.manager_subject_id,
    membership_id: membership.membership_id,
    enterprise_id: membership.enterprise_id,
    enterprise_name: membership.enterprise_name,
    entitlement_mode: membership.entitlement_mode,
    capabilities: { master_control: membership.admin_roles?.includes('RECRUITING_ADMIN') === true },
  };
  let candidateContext = null;
  if (relationship.candidate_id) candidateContext = await service.candidateContext(relationship.session_token, relationship.candidate_id);
  const invitee = {
    candidate_id: relationship.candidate_id || null,
    consultation_request_id: relationship.consultation_request_id || null,
    profile_id: relationship.profile_id,
    name: relationship.owner_name,
    readiness_state: authored.ba ? 'BA_INTELLIGENCE_READY' : 'BOS_READY',
    ba_readiness: authored.ba ? 'BA_INTELLIGENCE_READY' : 'BA_NOT_STARTED',
  };
  const world = createRecruitingGuWorld({
    relationship, candidate: invitee, manager,
    bosArtifact: authored.bos, baViewModel: authored.ba,
    opportunity: candidateContext?.opportunity || { items: [] },
    managerEvidence: candidateContext?.manager_evidence || [],
  });
  return { manager, invitee, authored_surfaces: authored, synthetic_only: false, world };
}

export function createRecruitingGuV1RealRuntime({ env = process.env, service = getRecruitingService(env), redis = getRecruitingRedis(env), frontierTransport = null } = {}) {
  const runtime = createRecruitingGuV1Runtime({
    store: service.store,
    apiKey: env.OPENROUTER_API_KEY,
    frontierTransport,
    worldResolver: async ({ authority }) => {
      const state = await service.store.read();
      const relationship = state.consultation_relationships?.[authority.relationship_id];
      if (!relationship || relationship.membership_id !== authority.membership_id || relationship.enterprise_id !== authority.enterprise_id || relationship.status !== 'ACTIVE') {
        throw new Error('RECRUITING_GU_V1_RELATIONSHIP_SCOPE_DENIED');
      }
      const membership = state.memberships[authority.membership_id];
      const binding = await relationshipBinding({ service, redis, membership, relationship: { ...relationship, session_token: authority.session_token }, env });
      return binding.world;
    },
  });

  async function managerContext(sessionToken) {
    const inspected = await service.inspectManagerReadOnly(sessionToken);
    return { ...inspected, sessionToken };
  }

  async function ensureCandidateRelationship(sessionToken, candidateId) {
    const candidate = await service.candidateContext(sessionToken, candidateId);
    if (!candidate.invitation?.accepted_at || !candidate.invitation?.bos_profile_id) throw new Error('RECRUITING_GU_V1_ACCEPTED_BOS_RELATIONSHIP_REQUIRED');
    const membership = candidate.membership;
    const id = `gu_rel_${stableHash({ membership_id: membership.membership_id, candidate_id: candidateId, profile_id: candidate.invitation.bos_profile_id }).slice(0, 24)}`;
    const relationship = await service.store.transaction((state) => {
      state.consultation_relationships ||= {};
      const current = state.consultation_relationships[id];
      if (current) return current;
      const created = {
        relationship_id: id,
        membership_id: membership.membership_id,
        manager_subject_id: membership.manager_subject_id,
        enterprise_id: membership.enterprise_id,
        candidate_id: candidateId,
        profile_id: candidate.invitation.bos_profile_id,
        owner_name: candidate.invitation.recruit_name,
        consent_state: 'RECRUITING_INVITATION_ACCEPTED',
        source: 'RECRUITING_V1_ACCEPTED_INVITATION',
        status: 'ACTIVE',
        authorized_at: candidate.invitation.accepted_at,
        canonical_write_authority: false,
      };
      state.consultation_relationships[id] = created;
      return created;
    });
    return { relationship, membership };
  }

  async function home(sessionToken) {
    const [homeData, manager] = await Promise.all([service.home(sessionToken), managerContext(sessionToken)]);
    const state = await service.store.read();
    return {
      contract: 'more_recruiting_gu_v1_home_v1',
      manager: {
        name: manager.membership.manager_name,
        enterprise_name: manager.membership.enterprise_name,
        entitlement_mode: manager.membership.entitlement_mode,
        entitlement: manager.entitlement,
        capabilities: { ...manager.capabilities, darren_synthetic_demo: manager.capabilities.master_control === true },
      },
      candidates: homeData.candidates,
      consultation_requests: Object.values(state.consultation_requests || {}).filter((item) => item.membership_id === manager.membership.membership_id).map(publicRequest),
      relationships: Object.values(state.consultation_relationships || {}).filter((item) => item.membership_id === manager.membership.membership_id).map(publicRelationship),
      synthetic_only: false,
    };
  }

  async function openCandidate(sessionToken, candidateId) {
    const { relationship, membership } = await ensureCandidateRelationship(sessionToken, candidateId);
    const binding = await relationshipBinding({ service, redis, membership, relationship: { ...relationship, session_token: sessionToken }, env });
    return runtime.open({ authority: { ...sessionAuthority(membership, relationship), session_token: sessionToken }, binding });
  }

  async function openRelationship(sessionToken, relationshipId) {
    const manager = await managerContext(sessionToken);
    const state = await service.store.read();
    const relationship = state.consultation_relationships?.[relationshipId];
    if (!relationship || relationship.membership_id !== manager.membership.membership_id || relationship.status !== 'ACTIVE') throw new Error('RECRUITING_GU_V1_RELATIONSHIP_SCOPE_DENIED');
    const binding = await relationshipBinding({ service, redis, membership: manager.membership, relationship: { ...relationship, session_token: sessionToken }, env });
    return runtime.open({ authority: { ...sessionAuthority(manager.membership, relationship), session_token: sessionToken }, binding });
  }

  async function requestMoreId(sessionToken, profileId) {
    const manager = await managerContext(sessionToken);
    const normalized = normalizeProfileId(profileId);
    if (!normalized) throw new Error('RECRUITING_GU_V1_PROFILE_ID_INVALID');
    const canonical = await getCanonicalProfile(redis, normalized);
    const ownerEmail = String(canonical?.dossier?.email || '').trim().toLowerCase();
    const ownerName = String(canonical?.dossier?.person_name || canonical?.dossier?.canonical_profile_json?.person_name || 'MORE member').trim().slice(0, 140);
    if (!canonical.found || !ownerEmail) throw new Error('RECRUITING_GU_V1_OWNER_APPROVAL_DELIVERY_UNAVAILABLE');
    const approvalToken = createOpaqueToken();
    const request = await service.store.transaction((state) => {
      state.consultation_requests ||= {};
      const now = new Date();
      const existing = Object.values(state.consultation_requests).find((item) => item.membership_id === manager.membership.membership_id && item.profile_id === normalized && item.status === 'PENDING' && Date.parse(item.expires_at) > now.getTime());
      if (existing) return { request: existing, outbox_id: existing.outbox_id, created: false };
      const requestId = createOpaqueId('consultation_request');
      const expiresAt = new Date(now.getTime() + APPROVAL_TTL_MS).toISOString();
      const item = {
        request_id: requestId,
        membership_id: manager.membership.membership_id,
        manager_subject_id: manager.membership.manager_subject_id,
        manager_name: manager.membership.manager_name,
        enterprise_id: manager.membership.enterprise_id,
        enterprise_name: manager.membership.enterprise_name,
        profile_id: normalized,
        owner_name: ownerName,
        owner_email: ownerEmail,
        token_digest: digestToken(approvalToken),
        status: 'PENDING',
        requested_at: now.toISOString(),
        expires_at: expiresAt,
        decided_at: null,
        relationship_id: null,
        profile_id_is_authority: false,
      };
      const outboxId = createOpaqueId('outbox');
      state.outbox[outboxId] = {
        outbox_id: outboxId,
        idempotency_key: stableHash({ kind: 'CONSULTATION_APPROVAL', request_id: requestId }),
        kind: 'CONSULTATION_APPROVAL', recipient: ownerEmail,
        membership_id: manager.membership.membership_id, enterprise_id: manager.membership.enterprise_id,
        invitation_id: null, payload: { request_id: requestId, manager_name: manager.membership.manager_name, enterprise_name: manager.membership.enterprise_name },
        token_capsule: service.tokenWrapper.wrap(approvalToken), state: 'PENDING', attempts: 0,
        created_at: now.toISOString(), updated_at: now.toISOString(),
      };
      item.outbox_id = outboxId;
      state.consultation_requests[requestId] = item;
      return { request: item, outbox_id: outboxId, created: true };
    });
    const delivery = request.created ? await service.deliverOutbox(request.outbox_id) : null;
    if (request.created && delivery?.item?.state !== 'DELIVERED') throw new Error('RECRUITING_GU_V1_OWNER_APPROVAL_DELIVERY_FAILED');
    return { request: publicRequest(request.request), delivery: { state: request.created ? 'DELIVERED' : 'ALREADY_PENDING' } };
  }

  async function approveMoreId(token, decision) {
    if (!['APPROVE', 'DECLINE'].includes(decision)) throw new Error('RECRUITING_GU_V1_OWNER_DECISION_INVALID');
    return service.store.transaction((state) => {
      state.consultation_requests ||= {};
      state.consultation_relationships ||= {};
      const request = Object.values(state.consultation_requests).find((item) => item.token_digest === digestToken(token));
      if (!request || request.status !== 'PENDING' || Date.parse(request.expires_at) <= Date.now()) throw new Error('RECRUITING_GU_V1_OWNER_APPROVAL_INVALID');
      request.status = decision === 'APPROVE' ? 'APPROVED' : 'DECLINED';
      request.decided_at = new Date().toISOString();
      if (decision === 'APPROVE') {
        const relationshipId = createOpaqueId('gu_rel');
        const relationship = {
          relationship_id: relationshipId, consultation_request_id: request.request_id,
          membership_id: request.membership_id, manager_subject_id: request.manager_subject_id,
          enterprise_id: request.enterprise_id, candidate_id: null,
          profile_id: request.profile_id, owner_name: request.owner_name,
          consent_state: 'OWNER_APPROVED_MORE_ID_CONSULTATION', source: 'MORE_ID_OWNER_APPROVAL',
          status: 'ACTIVE', authorized_at: request.decided_at, canonical_write_authority: false,
        };
        state.consultation_relationships[relationshipId] = relationship;
        request.relationship_id = relationshipId;
      }
      return { request: publicRequest(request), approved: decision === 'APPROVE' };
    });
  }

  async function approvalPreview(token) {
    const state = await service.store.read();
    const request = Object.values(state.consultation_requests || {}).find((item) => item.token_digest === digestToken(token));
    if (!request || request.status !== 'PENDING' || Date.parse(request.expires_at) <= Date.now()) throw new Error('RECRUITING_GU_V1_OWNER_APPROVAL_INVALID');
    return {
      request_id: request.request_id,
      manager_name: request.manager_name,
      enterprise_name: request.enterprise_name,
      purpose: 'Open a co-present business consultation using your complete BOS and available Business Twin.',
      profile_id_is_authority: false,
      consent_controls_read_access_only: true,
      expires_at: request.expires_at,
    };
  }

  async function withSessionAuthority(sessionToken, sessionId) {
    const manager = await managerContext(sessionToken);
    const state = await service.store.read();
    const session = state.shared_business_sessions?.[sessionId];
    const relationship = session ? state.consultation_relationships?.[session.relationship_id] : null;
    if (!relationship || relationship.membership_id !== manager.membership.membership_id) throw new Error('RECRUITING_GU_V1_SESSION_SCOPE_DENIED');
    return { ...sessionAuthority(manager.membership, relationship), session_token: sessionToken };
  }

  return Object.freeze({
    home, openCandidate, openRelationship, requestMoreId, approveMoreId, approvalPreview,
    async read(sessionToken, sessionId) { return runtime.read({ authority: await withSessionAuthority(sessionToken, sessionId), sessionId }); },
    async mutate(sessionToken, sessionId, action, payload) {
      const authority = await withSessionAuthority(sessionToken, sessionId);
      if (action === 'CHAT') return runtime.chat({ authority, sessionId, payload });
      return { session: await runtime.mutateSimple({ authority, sessionId, action, payload }) };
    },
    modelConfig: runtime.modelConfig,
  });
}
