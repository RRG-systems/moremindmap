import { createSubscriptionLiveDemoOpenAiTransport } from './liveDemoOpenAiTransport.js';
import {
  RedisLivingRelationshipStore,
  internalDevKeys,
  readExternalEvidence,
} from './internalDevInfrastructure.js';
import { createSyntheticLivingRelationshipLab } from '../../../src/lab/subscriptionLivingBusinessRelationshipV1/createSyntheticLivingRelationshipLab.js';

const AUTHORIZED_SYNTHETIC_SUBJECTS = new Set(['re-mid', 're-early']);

export async function loadProductionIntendedSyntheticSubscriber({
  redis,
  relationship_key,
  subject_key,
  session_id,
  session_kind,
  coaching_episode_phase = 'ACTIVE',
  session_temporal_context = null,
  initial_conversation = [],
  env = globalThis.process?.env || {},
  transport = null,
  now = () => new Date().toISOString(),
}) {
  if (!AUTHORIZED_SYNTHETIC_SUBJECTS.has(subject_key)) throw new Error('SUBSCRIPTION_V1_SYNTHETIC_SUBJECT_DENIED');
  if (!/^rel_[a-f0-9]{20}$/u.test(relationship_key || '')) throw new Error('SUBSCRIPTION_V1_RELATIONSHIP_BINDING_INVALID');
  if (!/^session_[a-f0-9]{24}$/u.test(session_id || '')) throw new Error('SUBSCRIPTION_V1_SESSION_BINDING_INVALID');
  const keys = internalDevKeys({ relationship_key, subject_key });
  const store = await RedisLivingRelationshipStore.open({ redis, keys });
  const providerTransport = transport || createSubscriptionLiveDemoOpenAiTransport({
    apiKey: env.OPENAI_API_KEY,
    timeoutMs: 300_000,
    maxTransportRetries: 1,
  });
  const externalEvidence = await readExternalEvidence({ redis, key: keys.research });
  const lab = await createSyntheticLivingRelationshipLab({
    subject_key,
    relationship_key,
    session_kind,
    session_id,
    store,
    transport: providerTransport,
    clock: now,
    initial_conversation,
    coaching_episode_phase,
    session_temporal_context,
    external_evidence: externalEvidence,
    seed_weekly_fixture: false,
  });
  const current = lab.controller.current();
  if (!current.ok) throw new Error(current.code || 'SUBSCRIPTION_V1_CURRENT_STATE_UNAVAILABLE');
  const understanding = lab.controller.wholeUnderstandingPacket();
  return {
    ...lab,
    store,
    keys,
    current,
    architecture: {
      loader_id: 'subscription_v1_production_intended_subscriber_loader_v1',
      same_runtime_for_future_paid_entitlements: true,
      subject_key,
      exact_scope_hash: understanding?.scope_hash || null,
      required_artifact_types: understanding?.artifact_manifest?.map?.((item) => item.artifact_type) || [],
      free_gpt_v2: true,
      afw05_core_reused: true,
      synthetic_only: true,
      real_customer_retrieval: false,
    },
  };
}

export async function proveSyntheticSubscriberLoaderGeneralization({ redis, env = globalThis.process?.env || {} }) {
  const makeTransport = (subject) => async (_request, { stage }) => ({
    output: stage === 'CONVERSATION'
      ? { customer_message: `Synthetic ${subject} loader proof.` }
      : stage === 'CANDIDATE_EXTRACTION'
        ? { candidate: null }
        : { decision: 'NONE', proposal_hash: '0'.repeat(64), effective_items: [], unambiguous: false, reason: 'No pending proposal.' },
    usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1 },
    latency_ms: 1,
    web_search_calls: 0,
    external_evidence: [],
  });
  const jordan = await loadProductionIntendedSyntheticSubscriber({
    redis, env, relationship_key: 'rel_11111111111111111111', subject_key: 're-mid', session_id: 'session_111111111111111111111111', session_kind: 'FIRST_EVER', transport: makeTransport('Jordan'),
  });
  const elena = await loadProductionIntendedSyntheticSubscriber({
    redis, env, relationship_key: 'rel_22222222222222222222', subject_key: 're-early', session_id: 'session_222222222222222222222222', session_kind: 'FIRST_EVER', transport: makeTransport('Elena'),
  });
  return {
    ok: jordan.architecture.loader_id === elena.architecture.loader_id
      && jordan.scope.profile_id !== elena.scope.profile_id
      && jordan.scope.business_id !== elena.scope.business_id,
    loader_id: jordan.architecture.loader_id,
    jordan_profile_id: jordan.scope.profile_id,
    elena_profile_id: elena.scope.profile_id,
    cross_scope_isolated: jordan.scope.business_id !== elena.scope.business_id,
    same_runtime: true,
    provider_calls: 0,
  };
}
