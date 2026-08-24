/* global process */

import OpenAI from 'openai';
import { getCanonicalProfile } from '../../business-assessment/shared.js';
import { businessAssessmentByProfileKey, businessAssessmentKey } from '../../business-assessment/shared.js';
import { createEmptyRecruitingState, InMemoryRecruitingStore } from '../../../src/lib/recruitingV1/store.js';
import { RecruitingV1Service, createSyntheticNotificationTransport } from '../../../src/lib/recruitingV1/service.js';
import { assembleRecruitingContext, generateRecruitingIntelligence } from '../../../src/lib/recruitingV1/intelligence.js';
import { SYNTHETIC_RECRUITING_FIXTURE } from '../../../src/lib/recruitingV1/syntheticFixture.js';
import { createTokenWrapper } from '../../../src/lib/recruitingV1/contracts.js';
import { RedisRecruitingStore, getRecruitingRedis } from './redisStore.js';
import { LoopbackJsonRecruitingStore } from './loopbackJsonStore.js';
import { createResendRecruitingTransport } from './resendTransport.js';
import { readNewBaProductionConfig } from '../newBaProductionReadinessV1/config.js';
import { createRedisNewBaRealizationStore } from '../newBaProductionReadinessV1/launchSafeRealizationStore.js';

const SYNTHETIC_MEMBERSHIP = Object.freeze({
  membership_id: 'membership_synthetic_harborline_sophia',
  manager_subject_id: 'manager_synthetic_sophia',
  enterprise_id: 'enterprise_synthetic_harborline',
  manager_profile_id: 'mm-20990101-sophia01',
  manager_name: 'Sophia Bennett',
  manager_email: 'sophia.bennett@example.test',
  enterprise_name: 'Harborline Realty Group',
  status: 'ACTIVE',
  setup_state: 'COMPLETE',
  entitlement_mode: '5_per_month',
  synthetic_only: true,
});

const SYNTHETIC_DARREN_ADMIN = Object.freeze({
  membership_id: 'membership_synthetic_moremindmap_darren',
  manager_subject_id: 'manager_synthetic_darren',
  enterprise_id: 'enterprise_synthetic_moremindmap',
  manager_profile_id: 'mm-20990101-darren01',
  manager_name: 'Darren Synthetic',
  manager_email: 'darren.admin@example.test',
  enterprise_name: 'MORE MindMap Enterprise',
  status: 'ACTIVE',
  setup_state: 'COMPLETE',
  entitlement_mode: 'unlimited',
  admin_roles: ['RECRUITING_ADMIN'],
  recruiting_governance: { all_enterprises: true, enterprise_ids: [] },
  synthetic_only: true,
});

const SYNTHETIC_ROSTER_MEMBERSHIPS = Object.freeze([
  {
    membership_id: 'membership_synthetic_canyon_pending', manager_subject_id: 'manager_synthetic_canyon',
    enterprise_id: 'enterprise_synthetic_canyon', manager_profile_id: null, manager_name: 'Elena Torres',
    manager_email: 'elena.torres@example.test', enterprise_name: 'Canyon Ridge Realty', status: 'PENDING_SETUP',
    setup_state: 'SETUP_SENT', entitlement_mode: '5_per_month', setup_sent_at: '2026-08-20T17:00:00.000Z', synthetic_only: true,
  },
  {
    membership_id: 'membership_synthetic_summit_suspended', manager_subject_id: 'manager_synthetic_summit',
    enterprise_id: 'enterprise_synthetic_summit', manager_profile_id: 'mm-20990101-summit01', manager_name: 'Marcus Lee',
    manager_email: 'marcus.lee@example.test', enterprise_name: 'Summit House Group', status: 'SUSPENDED',
    setup_state: 'COMPLETE', entitlement_mode: '5_per_month', suspended_at: '2026-08-18T18:00:00.000Z', synthetic_only: true,
  },
  {
    membership_id: 'membership_synthetic_northstar_revoked', manager_subject_id: 'manager_synthetic_northstar',
    enterprise_id: 'enterprise_synthetic_northstar', manager_profile_id: 'mm-20990101-north001', manager_name: 'Priya Shah',
    manager_email: 'priya.shah@example.test', enterprise_name: 'Northstar Properties', status: 'REVOKED',
    setup_state: 'COMPLETE', entitlement_mode: '5_per_month', revoked_at: '2026-08-17T18:00:00.000Z', synthetic_only: true,
  },
]);

let service;

function syntheticRuntimeState() {
  const state = createEmptyRecruitingState([SYNTHETIC_DARREN_ADMIN, SYNTHETIC_MEMBERSHIP, ...SYNTHETIC_ROSTER_MEMBERSHIPS]);
  for (const candidate of SYNTHETIC_RECRUITING_FIXTURE.candidates) {
    state.invitations[candidate.invitation_id] = {
      ...candidate,
      membership_id: SYNTHETIC_MEMBERSHIP.membership_id,
      manager_subject_id: SYNTHETIC_MEMBERSHIP.manager_subject_id,
      enterprise_id: SYNTHETIC_MEMBERSHIP.enterprise_id,
      entitlement_period_start: SYNTHETIC_RECRUITING_FIXTURE.entitlement.period_start,
      entitlement_period_end: SYNTHETIC_RECRUITING_FIXTURE.entitlement.period_end,
      token_digest: null,
      token_generation: 1,
      idempotency_key: `synthetic-seed:${candidate.invitation_id}`,
      updated_at: candidate.accepted_at || candidate.issued_at,
    };
  }
  state.opportunity_by_enterprise[SYNTHETIC_MEMBERSHIP.enterprise_id] = SYNTHETIC_RECRUITING_FIXTURE.opportunity;
  state.evidence_by_candidate.candidate_synthetic_evan = SYNTHETIC_RECRUITING_FIXTURE.manager_evidence;
  state.intelligence_by_candidate.candidate_synthetic_evan = SYNTHETIC_RECRUITING_FIXTURE.intelligence;
  state.inbox_by_membership[SYNTHETIC_MEMBERSHIP.membership_id] = SYNTHETIC_RECRUITING_FIXTURE.notifications;
  return state;
}

export function syntheticReviewEnabled(env = process.env) {
  return env.RECRUITING_V1_SYNTHETIC_REVIEW === 'true';
}

export function recruitingRuntimeEnabled(env = process.env) {
  return syntheticReviewEnabled(env) || env.RECRUITING_V1_ENABLED === 'true';
}

export function getRecruitingService(env = process.env) {
  if (service) return service;
  if (syntheticReviewEnabled(env)) {
    const initialState = syntheticRuntimeState();
    const store = env.RECRUITING_V1_SYNTHETIC_JSON_PATH
      ? new LoopbackJsonRecruitingStore({
        filePath: env.RECRUITING_V1_SYNTHETIC_JSON_PATH,
        initialState,
        host: env.RECRUITING_V1_LOOPBACK_HOST || '127.0.0.1',
      })
      : new InMemoryRecruitingStore(initialState);
    service = new RecruitingV1Service({
      store,
      transport: createSyntheticNotificationTransport(),
      tokenWrapper: createTokenWrapper('recruiting-v1-synthetic-only-wrap-key'),
      profileValidator: async (profileId) => ({ found: /^mm-\d{8}-[a-z0-9]{8}$/u.test(profileId), profile_id: profileId }),
    });
  } else {
    if (!recruitingRuntimeEnabled(env)) throw new Error('RECRUITING_V1_DEFAULT_OFF');
    const redis = getRecruitingRedis(env);
    service = new RecruitingV1Service({
      store: new RedisRecruitingStore(redis, { namespace: env.RECRUITING_V1_NAMESPACE }),
      transport: createResendRecruitingTransport({
        apiKey: env.RECRUITING_RESEND_API_KEY,
        from: env.RECRUITING_EMAIL_FROM,
        baseUrl: env.RECRUITING_PUBLIC_BASE_URL,
      }),
      tokenWrapper: createTokenWrapper(env.RECRUITING_TOKEN_WRAP_KEY),
      profileValidator: async (profileId) => {
        const profile = await getCanonicalProfile(redis, profileId);
        return { found: profile.found === true, profile_id: profile.profile_id || profileId };
      },
    });
  }
  return service;
}

export function canonicalSignalView(dossier, role) {
  const canonical = dossier?.canonical_profile_json || dossier?.canonical_dossier?.canonical_profile_json || dossier;
  const ranked = canonical?.rescoring_gpt?.ranked_dimensions || canonical?.rescoring_v1?.ranked_dimensions || canonical?.ranked_dimensions || [];
  const narrative = canonical?.narrative_profile || canonical?.narrative || {};
  return {
    role,
    evidence: Object.fromEntries(ranked.slice(0, 8).map((item, index) => [`bos_${role}_${index + 1}`, {
      dimension: item.dimension || item.name || item.key,
      band: item.band || item.interpretation || null,
      narrative_hint: item.narrative_hint || item.summary || null,
    }])),
    summary: narrative.executive_summary || narrative.summary || canonical?.profile_type || 'Canonical BOS evidence available.',
    missing: ranked.length ? [] : ['Ranked behavioral evidence is incomplete.'],
  };
}

function businessSignalView(envelope) {
  if (!envelope?.artifact) return null;
  const artifact = envelope.artifact;
  const wbm = artifact.business_reality?.whole_business_model || {};
  const constraint = wbm.governing_constraint || {};
  return {
    evidence: {
      ba_constraint: constraint.statement || constraint.title || artifact.customer_view_model?.destinations?.why?.headline || 'Governed Whole-Business constraint available.',
      ba_one_move: artifact.one_move?.title || artifact.customer_view_model?.destinations?.move?.headline || null,
    },
    intelligence_ready: envelope.completeness?.status === 'PASS',
    realization_id: envelope.realization_id,
    missing: envelope.completeness?.status === 'PASS' ? [] : ['Canonical Business Twin is incomplete.'],
  };
}

async function canonicalRecruitingInputs(candidateContext) {
  const redis = getRecruitingRedis();
  const managerProfile = await getCanonicalProfile(redis, candidateContext.membership.manager_profile_id);
  const recruitProfile = await getCanonicalProfile(redis, candidateContext.invitation.bos_profile_id);
  if (!managerProfile.found || !recruitProfile.found) throw new Error('RECRUITING_CANONICAL_BOS_UNAVAILABLE');
  let ba = null;
  const assessmentId = await redis.get(businessAssessmentByProfileKey(candidateContext.invitation.bos_profile_id));
  if (assessmentId) {
    const raw = await redis.get(businessAssessmentKey(assessmentId));
    ba = raw ? JSON.parse(raw) : null;
  }
  let canonicalBa = null;
  if (ba && candidateContext.invitation.ba_readiness === 'BA_INTELLIGENCE_READY') {
    const config = readNewBaProductionConfig(process.env);
    const realizationStore = createRedisNewBaRealizationStore({
      redis,
      namespace: config.namespace,
      persistenceEnabled: config.persistenceEnabled,
    });
    canonicalBa = await realizationStore.getCurrent({ profileId: candidateContext.invitation.bos_profile_id });
    if (canonicalBa && canonicalBa.assessment_id !== ba.assessment_id) {
      throw new Error('RECRUITING_CANONICAL_BA_ASSESSMENT_MISMATCH');
    }
  }
  return {
    managerBos: canonicalSignalView(managerProfile.dossier, 'recruiter'),
    recruitBos: canonicalSignalView(recruitProfile.dossier, 'recruit'),
    recruitBa: businessSignalView(canonicalBa),
  };
}

export async function getCandidateProjection({ sessionToken, candidateId, env = process.env }) {
  const recruiting = getRecruitingService(env);
  const candidate = await recruiting.candidateContext(sessionToken, candidateId);
  if (syntheticReviewEnabled(env) && candidateId === 'candidate_synthetic_evan') {
    return {
      ...candidate,
      recruit: SYNTHETIC_RECRUITING_FIXTURE.recruit,
      opportunity: SYNTHETIC_RECRUITING_FIXTURE.opportunity,
      manager_evidence: SYNTHETIC_RECRUITING_FIXTURE.manager_evidence,
      intelligence: SYNTHETIC_RECRUITING_FIXTURE.intelligence,
      synthetic_only: true,
    };
  }
  if (!candidate.invitation.bos_profile_id) {
    return { ...candidate, recruit: null, canonical_status: 'BOS_NOT_READY' };
  }
  const canonical = await canonicalRecruitingInputs(candidate);
  return {
    ...candidate,
    recruit: {
      name: candidate.invitation.recruit_name,
      readiness: candidate.invitation.readiness_state,
      bos_summary: canonical.recruitBos.summary,
      ba_summary: canonical.recruitBa?.evidence?.ba_constraint || null,
      known: [
        'MORE MindMap Profile verified',
        canonical.recruitBa?.intelligence_ready && 'Business Assessment intelligence ready',
      ].filter(Boolean),
      unknown: [
        ...canonical.recruitBos.missing,
        ...(canonical.recruitBa?.missing || ['Business Assessment not completed.']),
      ],
    },
    canonical_status: canonical.recruitBa?.intelligence_ready ? 'BA_INTELLIGENCE_READY' : 'BOS_READY',
  };
}

function responseText(response) {
  if (response?.output_text) return response.output_text;
  return (response?.output || []).flatMap((item) => item.content || []).filter((item) => item.type === 'output_text').map((item) => item.text).join('');
}

export function createRecruitingOpenAiProvider(env = process.env) {
  if (!env.OPENAI_API_KEY) throw new Error('RECRUITING_FRONTIER_PROVIDER_BINDING_REQUIRED');
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, maxRetries: 0, timeout: 180_000 });
  return async (request) => {
    const response = await client.responses.create(request, { signal: AbortSignal.timeout(180_000) });
    if (response.status !== 'completed') throw new Error('RECRUITING_FRONTIER_PROVIDER_INCOMPLETE');
    const output = JSON.parse(responseText(response));
    return { output, receipt: { model: request.model, usage: response.usage || null } };
  };
}

export async function generateCandidateIntelligence({ sessionToken, candidateId, env = process.env }) {
  const recruiting = getRecruitingService(env);
  if (syntheticReviewEnabled(env) && candidateId === 'candidate_synthetic_evan') {
    return recruiting.saveIntelligence(sessionToken, candidateId, {
      ...SYNTHETIC_RECRUITING_FIXTURE.intelligence,
      source_context_hash: 'synthetic_review_context',
      provider_receipt: { model: 'deterministic-synthetic-review', store: false, raw_request_persisted: false, raw_response_persisted: false },
    });
  }
  const candidate = await recruiting.candidateContext(sessionToken, candidateId);
  const canonical = await canonicalRecruitingInputs(candidate);
  const context = assembleRecruitingContext({
    membership: candidate.membership,
    invitation: candidate.invitation,
    opportunity: candidate.opportunity,
    managerEvidence: candidate.manager_evidence,
    ...canonical,
  });
  const projection = await generateRecruitingIntelligence({ context, provider: createRecruitingOpenAiProvider(env) });
  return recruiting.saveIntelligence(sessionToken, candidateId, projection);
}

export function resetSyntheticRecruitingRuntimeForTest() {
  service = null;
}
