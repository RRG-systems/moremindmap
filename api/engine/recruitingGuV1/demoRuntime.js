import { createEmptyRecruitingState, InMemoryRecruitingStore } from '../../../src/lib/recruitingV1/store.js';
import { createRecruitingGuWorld, createSyntheticRecruitingGuWorld } from '../../../src/lib/recruitingGuV1/world.js';
import {
  RECRUITING_GU_EXPERIMENT_2_CONDITIONS,
  RECRUITING_GU_EXPERIMENT_2_MODEL_CONFIG,
} from '../../../src/lib/recruitingGuV1/experiment2Contract.js';
import { createSyntheticAuthoredSurfaces, readCurrentAuthoredSurfaces } from './authoredSurfaces.js';
import { createRecruitingGuV1Runtime, createSyntheticAgreementDeliveryAdapter } from './runtime.js';
import { createCanonicalPurposeRankedContext, createSyntheticPurposeRankedContext } from './purposeRankedContext.js';
import { createRecruitingGuExperiment2OpenAiTransport } from './openAiTransport.js';
import { createPatriciaReadOnlyRedis } from './readOnlyCanonicalRedis.js';
import { readNewBosProductionConfig } from '../newBosProductionReadinessV1/config.js';
import { readNewBaProductionConfig } from '../newBaProductionReadinessV1/config.js';

let singleton;

const SYNTHETIC_AUTHORITY = Object.freeze({
  manager_subject_id: 'manager_synthetic_darren',
  membership_id: 'membership_synthetic_moremindmap_darren',
  enterprise_id: 'enterprise_synthetic_moremindmap',
  relationship_id: 'rel-synthetic-darren-jordan-v2',
});

const MANAGER = Object.freeze({
  name: 'Darren', subject_id: SYNTHETIC_AUTHORITY.manager_subject_id, membership_id: SYNTHETIC_AUTHORITY.membership_id,
  enterprise_id: SYNTHETIC_AUTHORITY.enterprise_id, enterprise_name: 'MORE MindMap', entitlement_mode: 'unlimited',
  entitlement: { mode: 'unlimited', remaining: null }, capabilities: { master_control: true, darren_synthetic_demo: true },
});
const STANDARD_MANAGER = Object.freeze({
  name: 'Darren', subject_id: 'manager_synthetic_standard', membership_id: 'membership_synthetic_standard',
  enterprise_id: 'enterprise_synthetic_standard', enterprise_name: 'Standard Realty', entitlement_mode: '5_per_month',
  entitlement: { mode: '5_per_month', limit: 5, used: 3, remaining: 2 }, capabilities: { master_control: false, darren_synthetic_demo: false },
});

const INVITEE = Object.freeze({
  candidate_id: 'candidate-synthetic-jordan-gu-v1', profile_id: 'mm-20990101-jordan01', bos_profile_id: 'mm-20990101-jordan01',
  name: 'Jordan Lee', recruit_name: 'Jordan Lee', accepted_at: '2026-08-28T00:00:00.000Z',
  readiness_state: 'BA_INTELLIGENCE_READY', ba_readiness: 'BA_INTELLIGENCE_READY',
});

const PATRICIA_PROFILE_ID = 'mm-20260708-dsst020z';
const PATRICIA_AUTHORITY = Object.freeze({
  manager_subject_id: SYNTHETIC_AUTHORITY.manager_subject_id,
  membership_id: SYNTHETIC_AUTHORITY.membership_id,
  enterprise_id: SYNTHETIC_AUTHORITY.enterprise_id,
  relationship_id: 'rel-experiment-2-darren-patricia-read-only',
  profile_id: PATRICIA_PROFILE_ID,
  experiment_permission: 'FOUNDER_CONFIRMED_REPEATED_DEMO_USE',
});

const EXPERIMENT_SUBJECTS = Object.freeze([
  Object.freeze({ id: 'SYNTHETIC', label: 'SYNTHETIC', name: 'Jordan Lee', profile_id: INVITEE.profile_id, canonical_read: false }),
  Object.freeze({ id: 'PATRICIA', label: 'PATRICIA', name: 'Patricia', profile_id: PATRICIA_PROFILE_ID, canonical_read: true }),
]);

export function createRecruitingGuV1DemoRuntime({
  store = new InMemoryRecruitingStore(createEmptyRecruitingState()),
  openAiApiKey,
  frontierTransport,
  now,
  redis = null,
  env = globalThis.process?.env || {},
  experimentCondition = RECRUITING_GU_EXPERIMENT_2_CONDITIONS.DEMONSTRATIONS,
  agreementDeliveryAdapter: providedAgreementDeliveryAdapter = null,
} = {}) {
  const syntheticAuthoredSurfaces = createSyntheticAuthoredSurfaces();
  const syntheticWorld = createSyntheticRecruitingGuWorld();
  const bosConfig = readNewBosProductionConfig(env);
  const baConfig = readNewBaProductionConfig(env);
  const patriciaRedis = typeof redis?.get === 'function'
    ? createPatriciaReadOnlyRedis({
      redis,
      profileId: PATRICIA_PROFILE_ID,
      bosNamespace: bosConfig.namespace,
      baNamespace: baConfig.namespace,
    })
    : null;
  const experimentTransport = frontierTransport || createRecruitingGuExperiment2OpenAiTransport({
    apiKey: openAiApiKey || env.OPENAI_API_KEY,
    modelConfig: RECRUITING_GU_EXPERIMENT_2_MODEL_CONFIG,
  });
  const agreementDeliveryAdapter = providedAgreementDeliveryAdapter || createSyntheticAgreementDeliveryAdapter({ now });

  function subjectFromAuthority(authority) {
    if (authority.relationship_id === SYNTHETIC_AUTHORITY.relationship_id) return 'SYNTHETIC';
    if (authority.relationship_id === PATRICIA_AUTHORITY.relationship_id) return 'PATRICIA';
    throw new Error('RECRUITING_GU_V1_EXPERIMENT_SUBJECT_SCOPE_DENIED');
  }

  async function bindingFor(subjectId) {
    if (subjectId === 'SYNTHETIC') return Object.freeze({
      manager: MANAGER,
      invitee: INVITEE,
      synthetic_only: true,
      authored_surfaces: syntheticAuthoredSurfaces,
      world: syntheticWorld,
    });
    if (subjectId !== 'PATRICIA') throw new Error('RECRUITING_GU_V1_EXPERIMENT_SUBJECT_INVALID');
    if (!patriciaRedis) throw new Error('RECRUITING_GU_V1_PATRICIA_READ_ONLY_REDIS_REQUIRED');
    const authoredSurfaces = await readCurrentAuthoredSurfaces({ redis: patriciaRedis, profileId: PATRICIA_PROFILE_ID, env });
    const invitee = Object.freeze({
      candidate_id: null,
      profile_id: PATRICIA_PROFILE_ID,
      bos_profile_id: PATRICIA_PROFILE_ID,
      name: 'Patricia',
      recruit_name: 'Patricia',
      readiness_state: authoredSurfaces.ba ? 'BA_INTELLIGENCE_READY' : 'BOS_READY',
      ba_readiness: authoredSurfaces.ba ? 'BA_INTELLIGENCE_READY' : 'BA_NOT_STARTED',
    });
    const relationship = Object.freeze({
      relationship_id: PATRICIA_AUTHORITY.relationship_id,
      profile_id: PATRICIA_PROFILE_ID,
      owner_name: 'Patricia',
      consent_state: 'FOUNDER_CONFIRMED_EXPERIMENT_PERMISSION',
      source: 'EXPERIMENT_2_READ_ONLY_HARNESS',
      status: 'ACTIVE',
      canonical_write_authority: false,
    });
    const world = createRecruitingGuWorld({
      relationship,
      candidate: invitee,
      manager: MANAGER,
      bosArtifact: authoredSurfaces.bos,
      baViewModel: authoredSurfaces.ba,
      opportunity: { items: [] },
      managerEvidence: [],
    });
    return Object.freeze({ manager: MANAGER, invitee, synthetic_only: false, authored_surfaces: authoredSurfaces, world });
  }

  const runtime = createRecruitingGuV1Runtime({
    store,
    frontierTransport: experimentTransport,
    modelConfig: RECRUITING_GU_EXPERIMENT_2_MODEL_CONFIG,
    now,
    experimentCondition,
    agreementDeliveryAdapter,
    worldResolver: async ({ authority }) => (await bindingFor(subjectFromAuthority(authority))).world,
    contextResolver: async ({ authority, room, purpose }) => {
      const subjectId = subjectFromAuthority(authority);
      const binding = await bindingFor(subjectId);
      return subjectId === 'SYNTHETIC'
        ? createSyntheticPurposeRankedContext({ room, purpose, authoredSurfaces: binding.authored_surfaces })
        : createCanonicalPurposeRankedContext({ redis: patriciaRedis, env, profileId: PATRICIA_PROFILE_ID, room, purpose, authoredSurfaces: binding.authored_surfaces });
    },
  });

  async function authorityForSession(sessionId) {
    const snapshot = await store.read();
    const session = snapshot.shared_business_sessions?.[sessionId];
    if (!session) throw new Error('RECRUITING_GU_V1_SESSION_NOT_FOUND');
    if (session.relationship_id === SYNTHETIC_AUTHORITY.relationship_id) return SYNTHETIC_AUTHORITY;
    if (session.relationship_id === PATRICIA_AUTHORITY.relationship_id) return PATRICIA_AUTHORITY;
    throw new Error('RECRUITING_GU_V1_EXPERIMENT_SUBJECT_SCOPE_DENIED');
  }

  async function openSubject(subjectId) {
    const authority = subjectId === 'SYNTHETIC' ? SYNTHETIC_AUTHORITY : subjectId === 'PATRICIA' ? PATRICIA_AUTHORITY : null;
    if (!authority) throw new Error('RECRUITING_GU_V1_EXPERIMENT_SUBJECT_INVALID');
    return runtime.open({ authority, binding: await bindingFor(subjectId) });
  }

  return Object.freeze({
    authority: SYNTHETIC_AUTHORITY,
    modelConfig: runtime.modelConfig,
    experimentCondition,
    async home({ standard = false } = {}) {
      const snapshot = await store.read();
      const active = Object.values(snapshot.shared_business_sessions || {}).find((item) => [SYNTHETIC_AUTHORITY.relationship_id, PATRICIA_AUTHORITY.relationship_id].includes(item.relationship_id) && item.status !== 'COMPLETED') || null;
      return {
        contract: 'more_recruiting_gu_v1_demo_home_v1',
        synthetic_only: standard !== true,
        experiment_only: true,
        manager: standard ? STANDARD_MANAGER : MANAGER,
        candidates: [INVITEE],
        experiment_subjects: EXPERIMENT_SUBJECTS.map((item) => ({ id: item.id, label: item.label, name: item.name, canonical_read: item.canonical_read })),
        active_subject: active?.relationship_id === PATRICIA_AUTHORITY.relationship_id ? 'PATRICIA' : active ? 'SYNTHETIC' : null,
        active_session_id: active?.session_id || null,
        model_config: runtime.modelConfig,
        experiment_condition: experimentCondition,
      };
    },
    async open() { return openSubject('SYNTHETIC'); },
    openSubject,
    readOnlyAudit() {
      return patriciaRedis?.audit() || Object.freeze({
        mode: 'UNBOUND', get_count: 0, denied_read_count: 0, denied_write_count: 0,
        write_commands_forwarded: 0, canonical_mutation: false,
      });
    },
    agreementEmailAudit() {
      return agreementDeliveryAdapter.readDeliveries?.() || Object.freeze([]);
    },
    async openCandidate(candidateId) {
      if (candidateId !== INVITEE.candidate_id) throw new Error('RECRUITING_GU_V1_CANDIDATE_SCOPE_DENIED');
      return openSubject('SYNTHETIC');
    },
    async requestMoreId(profileId) {
      if (!/^mm-\d{8}-[a-z0-9]{8}$/u.test(String(profileId || '').trim())) throw new Error('RECRUITING_GU_V1_PROFILE_ID_INVALID');
      return {
        request: {
          status: 'SYNTHETIC_OWNER_APPROVAL_REQUIRED',
          profile_id: String(profileId).trim(),
          external_mutation: false,
        },
      };
    },
    async read(sessionId) { return runtime.read({ authority: await authorityForSession(sessionId), sessionId }); },
    async mutate(sessionId, action, payload) {
      const authority = await authorityForSession(sessionId);
      if (action === 'CHAT') return runtime.chat({ authority, sessionId, payload });
      if (action === 'COMPILE_GU') return runtime.compileGu({ authority, sessionId, payload });
      return { session: await runtime.mutateSimple({ authority, sessionId, action, payload }) };
    },
    async reset(subjectId = null) {
      if (subjectId !== 'SYNTHETIC' && subjectId !== 'PATRICIA') throw new Error('RECRUITING_GU_V1_DEMO_RESET_SUBJECT_DENIED');
      const relationshipIds = subjectId === 'SYNTHETIC'
        ? [SYNTHETIC_AUTHORITY.relationship_id]
        : [PATRICIA_AUTHORITY.relationship_id];
      await store.transaction((state) => {
        for (const [id, session] of Object.entries(state.shared_business_sessions || {})) {
          if (relationshipIds.includes(session.relationship_id)) delete state.shared_business_sessions[id];
        }
        return true;
      });
      return { reset: true, subject: subjectId, external_mutation: false, canonical_mutation: false };
    },
  });
}

export function getRecruitingGuV1DemoRuntime(options = {}) {
  if (!singleton) singleton = createRecruitingGuV1DemoRuntime(options);
  return singleton;
}
