/* global process */

import {
  createOpaqueId,
  createOpaqueToken,
  consultingReadinessFor,
  digestToken,
  normalizeProfileId,
  stableHash,
} from '../../../src/lib/recruitingV1/contracts.js';
import { getCanonicalProfile } from '../../business-assessment/shared.js';
import { getRecruitingService } from '../recruitingV1/runtime.js';
import { getRecruitingRedis } from '../recruitingV1/redisStore.js';
import { readCurrentAuthoredSurfaces } from './authoredSurfaces.js';
import { createRecruitingGuWorld } from '../../../src/lib/recruitingGuV1/world.js';
import {
  RECRUITING_GU_EXPERIMENT_2_CONDITIONS,
  RECRUITING_GU_EXPERIMENT_2_MODEL_CONFIG,
} from '../../../src/lib/recruitingGuV1/experiment2Contract.js';
import { createRecruitingGuV1Runtime } from './runtime.js';
import { createCanonicalPurposeRankedContext } from './purposeRankedContext.js';
import { createRecruitingGuExperiment2OpenAiTransport } from './openAiTransport.js';

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

function assertRelationshipScope(relationship, membership) {
  if (!relationship || !membership || membership.status !== 'ACTIVE' || membership.setup_state !== 'COMPLETE'
      || relationship.status !== 'ACTIVE' || relationship.membership_id !== membership.membership_id
      || relationship.enterprise_id !== membership.enterprise_id || relationship.manager_subject_id !== membership.manager_subject_id
      || !normalizeProfileId(relationship.profile_id) || relationship.canonical_write_authority !== false) {
    throw new Error('RECRUITING_GU_V1_RELATIONSHIP_SCOPE_DENIED');
  }
}

function assertCandidateBinding(candidate, relationship = null) {
  if (!candidate?.invitation?.consulting_ready || !candidate.invitation.accepted_at) {
    throw new Error('RECRUITING_GU_V1_BOTH_ASSESSMENTS_NOT_READY');
  }
  const profile = normalizeProfileId(candidate.invitation.bos_profile_id);
  if (!profile || (relationship && (candidate.invitation.candidate_id !== relationship.candidate_id
      || profile !== normalizeProfileId(relationship.profile_id)
      || relationship.consent_state !== 'RECRUITING_INVITATION_ACCEPTED'))) {
    throw new Error('RECRUITING_GU_V1_CANDIDATE_BINDING_SCOPE_DENIED');
  }
  return profile;
}

function assertCompleteAuthoredSurfaces(authored, profileId, canonicalReadiness = null) {
  const profile = normalizeProfileId(profileId);
  const bos = authored?.receipts?.bos;
  const ba = authored?.receipts?.ba;
  if (!authored?.bos || !authored?.ba || bos?.complete_surface_count !== 15 || ba?.complete !== true) {
    throw new Error('RECRUITING_GU_V1_BOTH_ASSESSMENTS_NOT_READY');
  }
  if (!profile || normalizeProfileId(authored.bos.profile_id) !== profile
      || normalizeProfileId(bos.profile_id) !== profile || normalizeProfileId(ba.profile_id) !== profile) {
    throw new Error('RECRUITING_GU_V1_CANONICAL_SUBJECT_SCOPE_DENIED');
  }
  if (canonicalReadiness) {
    const receipt = canonicalReadiness.ba_realization_receipt;
    if (normalizeProfileId(canonicalReadiness.bos_profile_id) !== profile
        || canonicalReadiness.ba_assessment_id !== ba.assessment_id
        || normalizeProfileId(receipt?.profile_id) !== profile
        || receipt?.assessment_id !== ba.assessment_id
        || receipt?.realization_id !== ba.realization_id
        || receipt?.realization_sha256 !== ba.realization_sha256
        || receipt?.artifact_sha256 !== ba.artifact_sha256) {
      throw new Error('RECRUITING_GU_V1_CANONICAL_READINESS_STALE');
    }
  }
}

async function relationshipBinding({ service, redis, membership, relationship, env, authoredSurfacesReader }) {
  assertRelationshipScope(relationship, membership);
  let candidateContext = null;
  if (relationship.candidate_id) {
    candidateContext = await service.candidateContext(relationship.session_token, relationship.candidate_id);
    assertCandidateBinding(candidateContext, relationship);
  } else if (relationship.consent_state !== 'OWNER_APPROVED_MORE_ID_CONSULTATION') {
    throw new Error('RECRUITING_GU_V1_RELATIONSHIP_SCOPE_DENIED');
  }
  const authored = await authoredSurfacesReader({ redis, profileId: relationship.profile_id, env });
  assertCompleteAuthoredSurfaces(authored, relationship.profile_id, candidateContext?.canonical_readiness);
  const manager = {
    name: membership.manager_name,
    subject_id: membership.manager_subject_id,
    membership_id: membership.membership_id,
    enterprise_id: membership.enterprise_id,
    enterprise_name: membership.enterprise_name,
    entitlement_mode: membership.entitlement_mode,
    capabilities: { master_control: membership.admin_roles?.includes('RECRUITING_ADMIN') === true, sponsored_follow_up: false },
  };
  const invitee = {
    candidate_id: relationship.candidate_id || null,
    consultation_request_id: relationship.consultation_request_id || null,
    profile_id: relationship.profile_id,
    name: candidateContext?.invitation.recruit_name || relationship.owner_name,
    readiness_state: 'BA_INTELLIGENCE_READY',
    ba_readiness: 'BA_INTELLIGENCE_READY',
  };
  const world = createRecruitingGuWorld({
    relationship, candidate: invitee, manager,
    bosArtifact: authored.bos, baViewModel: authored.ba,
    canonicalReceipts: authored.receipts,
    opportunity: candidateContext?.opportunity || { items: [] },
    managerEvidence: candidateContext?.manager_evidence || [],
  });
  return { manager, invitee, authored_surfaces: authored, synthetic_only: false, resume_completed_session: true, earlier_record_recovery: true, world };
}

export function createRecruitingGuV1RealRuntime({
  env = process.env, service = getRecruitingService(env), redis = getRecruitingRedis(env), frontierTransport = null,
  authoredSurfacesReader = readCurrentAuthoredSurfaces, canonicalContextResolver = createCanonicalPurposeRankedContext,
} = {}) {
  function assertStateAuthority(state, authority) {
    const managerSession = state.manager_sessions?.[digestToken(authority.session_token)];
    if (!managerSession || managerSession.membership_id !== authority.membership_id
        || managerSession.enterprise_id !== authority.enterprise_id || managerSession.manager_subject_id !== authority.manager_subject_id
        || !(Date.parse(managerSession.expires_at) > new Date(service.now()).getTime())) {
      throw new Error('RECRUITING_MANAGER_SESSION_REQUIRED');
    }
    const membership = state.memberships?.[authority.membership_id];
    const relationship = state.consultation_relationships?.[authority.relationship_id];
    assertRelationshipScope(relationship, membership);
    if (membership.manager_subject_id !== authority.manager_subject_id || membership.enterprise_id !== authority.enterprise_id
        || normalizeProfileId(relationship.profile_id) !== normalizeProfileId(authority.profile_id)
        || (relationship.candidate_id || null) !== (authority.candidate_id || null)) {
      throw new Error('RECRUITING_GU_V1_RELATIONSHIP_SCOPE_DENIED');
    }
    if (relationship.candidate_id) {
      const invitation = Object.values(state.invitations || {}).find((item) => item.candidate_id === relationship.candidate_id);
      if (!consultingReadinessFor(invitation, membership).ready
          || normalizeProfileId(invitation?.bos_profile_id) !== normalizeProfileId(relationship.profile_id)
          || relationship.consent_state !== 'RECRUITING_INVITATION_ACCEPTED') {
        throw new Error('RECRUITING_GU_V1_CANDIDATE_BINDING_SCOPE_DENIED');
      }
    } else {
      const request = state.consultation_requests?.[relationship.consultation_request_id];
      if (relationship.consent_state !== 'OWNER_APPROVED_MORE_ID_CONSULTATION' || request?.status !== 'APPROVED'
          || request.relationship_id !== relationship.relationship_id || request.membership_id !== membership.membership_id
          || request.enterprise_id !== membership.enterprise_id || normalizeProfileId(request.profile_id) !== normalizeProfileId(relationship.profile_id)) {
        throw new Error('RECRUITING_GU_V1_RELATIONSHIP_SCOPE_DENIED');
      }
    }
    return { membership, relationship };
  }
  const experimentTransport = frontierTransport || createRecruitingGuExperiment2OpenAiTransport({
    apiKey: env.OPENAI_API_KEY,
    modelConfig: RECRUITING_GU_EXPERIMENT_2_MODEL_CONFIG,
  });
  const runtime = createRecruitingGuV1Runtime({
    store: service.store,
    frontierTransport: experimentTransport,
    modelConfig: RECRUITING_GU_EXPERIMENT_2_MODEL_CONFIG,
    experimentCondition: RECRUITING_GU_EXPERIMENT_2_CONDITIONS.DEMONSTRATIONS,
    stateAuthorityValidator: assertStateAuthority,
    publicationAuthorityValidator: ({ authority, session }) => withSessionAuthority(authority.session_token, session.session_id),
    effectAdapter: () => { throw new Error('RECRUITING_GU_V1_SPONSORED_FOLLOW_UP_UNAVAILABLE'); },
    worldResolver: async ({ authority }) => {
      const state = await service.store.read();
      const { relationship, membership } = assertStateAuthority(state, authority);
      const binding = await relationshipBinding({ service, redis, membership, relationship: { ...relationship, session_token: authority.session_token }, env, authoredSurfacesReader });
      return binding.world;
    },
    contextResolver: async ({ authority, room, purpose }) => {
      const authoredSurfaces = await authoredSurfacesReader({ redis, profileId: authority.profile_id, env });
      return canonicalContextResolver({
        redis,
        env,
        profileId: authority.profile_id,
        room,
        purpose,
        authoredSurfaces,
      });
    },
    agreementDeliveryAdapter: {
      synthetic: false,
      deliver: ({ session }) => service.deliverAgreedPlanEmails({
        sessionId: session.session_id,
        acceptanceId: session.accepted_plan_snapshot?.acceptance_id,
      }),
      retry: ({ session, recipientRole }) => service.retryAgreedPlanEmail({
        sessionId: session.session_id,
        acceptanceId: session.accepted_plan_snapshot?.acceptance_id,
        recipientRole,
      }),
    },
  });

  async function managerContext(sessionToken) {
    const inspected = await service.inspectManagerReadOnly(sessionToken);
    return { ...inspected, sessionToken };
  }

  async function ensureCandidateRelationship(sessionToken, candidateId) {
    const candidate = await service.candidateContext(sessionToken, candidateId);
    assertCandidateBinding(candidate);
    const membership = candidate.membership;
    const authored = await authoredSurfacesReader({ redis, profileId: candidate.invitation.bos_profile_id, env });
    assertCompleteAuthoredSurfaces(authored, candidate.invitation.bos_profile_id, candidate.canonical_readiness);
    const id = `gu_rel_${stableHash({ membership_id: membership.membership_id, candidate_id: candidateId, profile_id: candidate.invitation.bos_profile_id }).slice(0, 24)}`;
    const relationship = await service.store.transaction((state) => {
      state.consultation_relationships ||= {};
      const currentMembership = state.memberships?.[membership.membership_id];
      const currentInvitation = Object.values(state.invitations || {}).find((item) => item.candidate_id === candidateId);
      if (!consultingReadinessFor(currentInvitation, currentMembership).ready
          || normalizeProfileId(currentInvitation?.bos_profile_id) !== normalizeProfileId(candidate.invitation.bos_profile_id)) {
        throw new Error('RECRUITING_GU_V1_CANDIDATE_BINDING_SCOPE_DENIED');
      }
      const current = state.consultation_relationships[id];
      if (current) { assertRelationshipScope(current, currentMembership); return current; }
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
        subject_id: manager.membership.manager_subject_id,
        membership_id: manager.membership.membership_id,
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
    const binding = await relationshipBinding({ service, redis, membership, relationship: { ...relationship, session_token: sessionToken }, env, authoredSurfacesReader });
    return runtime.open({ authority: { ...sessionAuthority(membership, relationship), session_token: sessionToken }, binding });
  }

  async function openRelationship(sessionToken, relationshipId) {
    const manager = await managerContext(sessionToken);
    const state = await service.store.read();
    const relationship = state.consultation_relationships?.[relationshipId];
    if (!relationship || relationship.membership_id !== manager.membership.membership_id || relationship.status !== 'ACTIVE') throw new Error('RECRUITING_GU_V1_RELATIONSHIP_SCOPE_DENIED');
    assertStateAuthority(state, { ...sessionAuthority(manager.membership, relationship), session_token: sessionToken });
    const binding = await relationshipBinding({ service, redis, membership: manager.membership, relationship: { ...relationship, session_token: sessionToken }, env, authoredSurfacesReader });
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
      purpose: 'Open a co-present business consultation when your complete BOS and Business Twin are both ready.',
      profile_id_is_authority: false,
      consent_controls_read_access_only: true,
      expires_at: request.expires_at,
    };
  }

  async function withSessionAuthority(sessionToken, sessionId, { requireCurrentWorld = true } = {}) {
    const manager = await managerContext(sessionToken);
    const state = await service.store.read();
    const session = state.shared_business_sessions?.[sessionId];
    const relationship = session ? state.consultation_relationships?.[session.relationship_id] : null;
    if (!relationship || relationship.membership_id !== manager.membership.membership_id) throw new Error('RECRUITING_GU_V1_SESSION_SCOPE_DENIED');
    const authority = { ...sessionAuthority(manager.membership, relationship), session_token: sessionToken };
    assertStateAuthority(state, authority);
    const binding = await relationshipBinding({ service, redis, membership: manager.membership, relationship: { ...relationship, session_token: sessionToken }, env, authoredSurfacesReader });
    if (requireCurrentWorld && session.world_version !== binding.world.version) throw new Error('RECRUITING_GU_V1_GOVERNED_WORLD_STALE');
    return authority;
  }

  return Object.freeze({
    home, openCandidate, openRelationship, requestMoreId, approveMoreId, approvalPreview,
    async read(sessionToken, sessionId) { return runtime.read({ authority: await withSessionAuthority(sessionToken, sessionId), sessionId }); },
    async mutate(sessionToken, sessionId, action, payload) {
      if (action === 'START_ANOTHER_CONSULTATION') {
        const authority = await withSessionAuthority(sessionToken, sessionId, { requireCurrentWorld: false });
        const state = await service.store.read();
        const { membership, relationship } = assertStateAuthority(state, authority);
        const binding = await relationshipBinding({ service, redis, membership, relationship: { ...relationship, session_token: sessionToken }, env, authoredSurfacesReader });
        return runtime.startAnother({ authority, sessionId, binding, expectedRevision: payload.expected_revision });
      }
      const authority = await withSessionAuthority(sessionToken, sessionId);
      if (action === 'CHAT') return runtime.chat({ authority, sessionId, payload });
      if (action === 'COMPILE_GU') return runtime.compileGu({ authority, sessionId, payload });
      return { session: await runtime.mutateSimple({ authority, sessionId, action, payload }) };
    },
    modelConfig: runtime.modelConfig,
  });
}
