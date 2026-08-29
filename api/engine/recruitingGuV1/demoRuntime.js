import { createEmptyRecruitingState, InMemoryRecruitingStore } from '../../../src/lib/recruitingV1/store.js';
import { createSyntheticRecruitingGuWorld } from '../../../src/lib/recruitingGuV1/world.js';
import { createSyntheticAuthoredSurfaces } from './authoredSurfaces.js';
import { createRecruitingGuV1Runtime } from './runtime.js';

let singleton;

const AUTHORITY = Object.freeze({
  manager_subject_id: 'manager_synthetic_darren',
  membership_id: 'membership_synthetic_moremindmap_darren',
  enterprise_id: 'enterprise_synthetic_moremindmap',
  relationship_id: 'rel-synthetic-darren-jordan-v2',
});

const MANAGER = Object.freeze({
  name: 'Darren', subject_id: AUTHORITY.manager_subject_id, membership_id: AUTHORITY.membership_id,
  enterprise_id: AUTHORITY.enterprise_id, enterprise_name: 'MORE MindMap', entitlement_mode: 'unlimited',
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

export function createRecruitingGuV1DemoRuntime({ store = new InMemoryRecruitingStore(createEmptyRecruitingState()), apiKey, frontierTransport, now } = {}) {
  const authoredSurfaces = createSyntheticAuthoredSurfaces();
  const world = createSyntheticRecruitingGuWorld();
  const runtime = createRecruitingGuV1Runtime({
    store, apiKey, frontierTransport, now,
    worldResolver: async () => world,
  });
  const binding = Object.freeze({ manager: MANAGER, invitee: INVITEE, synthetic_only: true, authored_surfaces: authoredSurfaces });
  return Object.freeze({
    authority: AUTHORITY,
    modelConfig: runtime.modelConfig,
    async home({ standard = false } = {}) {
      const snapshot = await store.read();
      const active = Object.values(snapshot.shared_business_sessions || {}).find((item) => item.relationship_id === AUTHORITY.relationship_id && item.status !== 'COMPLETED') || null;
      return { contract: 'more_recruiting_gu_v1_demo_home_v1', synthetic_only: standard !== true, manager: standard ? STANDARD_MANAGER : MANAGER, candidates: [INVITEE], active_session_id: active?.session_id || null, model_config: runtime.modelConfig };
    },
    async open() { return runtime.open({ authority: AUTHORITY, binding }); },
    async openCandidate(candidateId) {
      if (candidateId !== INVITEE.candidate_id) throw new Error('RECRUITING_GU_V1_CANDIDATE_SCOPE_DENIED');
      return runtime.open({ authority: AUTHORITY, binding });
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
    async read(sessionId) { return runtime.read({ authority: AUTHORITY, sessionId }); },
    async mutate(sessionId, action, payload) {
      if (action === 'CHAT') return runtime.chat({ authority: AUTHORITY, sessionId, payload });
      return { session: await runtime.mutateSimple({ authority: AUTHORITY, sessionId, action, payload }) };
    },
    async reset() {
      await store.transaction((state) => {
        for (const [id, session] of Object.entries(state.shared_business_sessions || {})) {
          if (session.relationship_id === AUTHORITY.relationship_id) delete state.shared_business_sessions[id];
        }
        return true;
      });
      return { reset: true, external_mutation: false };
    },
  });
}

export function getRecruitingGuV1DemoRuntime(options = {}) {
  if (!singleton) singleton = createRecruitingGuV1DemoRuntime(options);
  return singleton;
}
