import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MISSION_001_EXAMPLES,
  MISSION_002_FIXTURES,
} from '../src/lib/intelligenceFabric/index.js';
import {
  buildBusinessEngineContract,
  validateBusinessEngineContract,
} from '../src/lib/businessEngine/index.js';
import {
  createPrivateRuntimeIntelligenceExecutionV1,
  privateRuntimeBusinessEngineExecutionContractDigest,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/intelligenceExecution.js';
import {
  FIXED_SYNTHETIC_BUSINESS_ASSESSMENT,
  FIXED_SYNTHETIC_BUSINESS_ENGINE_CONTRACT_SHA256,
  FIXED_SYNTHETIC_PRODUCT_FIXTURE_ASSESSMENT_ID,
  FIXED_SYNTHETIC_PRODUCT_FIXTURE_DIGEST,
  FIXED_SYNTHETIC_PRODUCT_FIXTURE_KEYS,
  FIXED_SYNTHETIC_PRODUCT_FIXTURE_PROFILE_ID,
  FIXED_SYNTHETIC_VAULT_RECORD,
  createFixedSyntheticProfileAndBaFixtureV1,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/fixedSyntheticProductFixture.js';
import {
  createPrivateLiveProductStoreV1,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/privateLiveProductStore.js';
import {
  privateLiveProductExecutionBindingDigest,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/productExecutionBinding.js';
import {
  createExactVaultProfileReader,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/operatorBridge/canonicalExactProfileRepository.js';
import {
  hashPrivateRuntimeScope,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/contracts.js';
import {
  privateRuntimeProductBindingDigest,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/contracts.js';
import {
  createCanonicalBusinessEngineLiveAttachmentAdapterV1,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/businessEngineAttachmentAdapter.js';
import {
  createExistingSubscriptionRuntimeLiveAttachmentAdapterV1,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/subscriptionRuntimeAttachmentAdapter.js';

const now = '2026-07-30T00:00:00.000Z';
const scope = Object.freeze({
  tenant_id: 'tenant_synthetic_private_beta_v1',
  profile_id: FIXED_SYNTHETIC_PRODUCT_FIXTURE_PROFILE_ID,
  business_id: 'business_synthetic_private_beta_v1',
  subscriber_id: 'subscriber_synthetic_private_beta_v1',
});

function fakeRedis(initial = {}) {
  const values = new Map(Object.entries(initial));
  const lists = new Map();
  const calls = [];
  return {
    values,
    lists,
    calls,
    async get(key) {
      calls.push(['get', key]);
      return values.get(key) ?? null;
    },
    async mget(...keys) {
      calls.push(['mget', ...keys]);
      return keys.map((key) => values.get(key) ?? null);
    },
    async lrange(key, start, end) {
      calls.push(['lrange', key, start, end]);
      const entries = lists.get(key) || [];
      return entries.slice(start, end === -1 ? undefined : end + 1);
    },
    async eval(script, numberOfKeys, ...parameters) {
      const keys = parameters.slice(0, numberOfKeys);
      const args = parameters.slice(numberOfKeys);
      calls.push(['eval', ...keys]);
      if (script.includes('fixed-synthetic-profile-and-ba-fixture-v1')) {
        const existing = keys.map((key) => values.get(key));
        const present = existing.filter((value) => value !== undefined).length;
        if (present === 0) {
          keys.forEach((key, index) => values.set(key, args[index]));
          return ['CREATED', '', '3'];
        }
        if (present === 3
          && existing.every((value, index) => value === args[index])) {
          return ['ALREADY_EXISTS_VALID', '', '0'];
        }
        return ['CONFLICT', 'FIXED_SYNTHETIC_FIXTURE_CONFLICT', '0'];
      }
      const [sequenceKey, itemKey, indexKey, idempotencyKey] = keys;
      const [fingerprint, expectedSequence, serialized] = args;
      const current = Number(values.get(sequenceKey) || 0);
      const existing = values.get(idempotencyKey);
      if (existing) {
        return existing === fingerprint
          ? ['IDEMPOTENT_REPLAY', values.get(itemKey) || '', String(current)]
          : ['IDEMPOTENCY_CONFLICT', '', String(current)];
      }
      if (values.has(itemKey)) return ['IDENTITY_CONFLICT', '', String(current)];
      if (current !== Number(expectedSequence)) {
        return ['SEQUENCE_CONFLICT', '', String(current)];
      }
      values.set(itemKey, serialized);
      lists.set(indexKey, [...(lists.get(indexKey) || []), itemKey]);
      values.set(sequenceKey, String(current + 1));
      values.set(idempotencyKey, fingerprint);
      return ['APPENDED', serialized, String(current + 1)];
    },
  };
}

function candidates() {
  const dimensions = (score) => Object.fromEntries([
    'expected_leverage',
    'probability_shift',
    'constraint_centrality',
    'user_goal_alignment',
    'behavioral_fit',
    'execution_feasibility',
    'financial_feasibility',
    'evidence_quality',
    'outcome_support',
    'time_to_signal',
    'reversibility',
    'downside_risk',
    'privacy_compliance_burden',
    'confidence',
  ].map((key) => [key, ['downside_risk', 'privacy_compliance_burden'].includes(key)
    ? 0.1 : score]));
  return [0.9, 0.7, 0.6].map((score, index) => ({
    intervention_id: `fixed_fixture_candidate_${index}`,
    template_id: `fixed_fixture_template_${index}`,
    tenant_id: scope.tenant_id,
    target_constraint: 'synthetic_qualification_constraint',
    target_future_or_transition: 'current-to-next',
    dimensions: dimensions(score),
    expected_probability_shift: score / 10,
    expected_downstream_effects: ['synthetic_qualification_signal'],
    time_to_signal: '14_DAYS',
    time_to_outcome: '90_DAYS',
  }));
}

function executionAuthority() {
  const productBinding = {
    binding_sha256: 'b'.repeat(64),
    exact_scope: scope,
    exact_scope_hash: 'c'.repeat(64),
    business_engine: { business_engine_contract_hash: 'd'.repeat(64) },
  };
  const consent = structuredClone(MISSION_001_EXAMPLES.consent_activation);
  consent.tenant_id = scope.tenant_id;
  consent.subject_ref = {
    ...consent.subject_ref,
    id: scope.profile_id,
    tenant_id: scope.tenant_id,
  };
  const policy = structuredClone(MISSION_002_FIXTURES.vertical_operating_policy);
  policy.tenant_id = scope.tenant_id;
  const binding = {
    binding_version: 'private-live-product-execution-binding-v1',
    environment_id: 'private_live_environment',
    configuration_authority_packet_sha256: 'a'.repeat(64),
    product_binding_attestation_sha256: productBinding.binding_sha256,
    business_engine_execution_contract_sha256:
      FIXED_SYNTHETIC_BUSINESS_ENGINE_CONTRACT_SHA256,
    exact_scope: scope,
    exact_scope_hash: productBinding.exact_scope_hash,
    approved_profile_ids: [scope.profile_id],
    execution_enabled: true,
    source_default_off: true,
    private_beta_only: true,
    public_access: false,
    persistence_mode: 'APPEND_ONLY_IMMUTABLE_V1',
    append_only: true,
    immutable_history: true,
    destructive_updates: false,
    transcript_persistence: false,
    conversation_content_persistence: false,
    product_store_connection_ref: 'MORE_PRIVATE_RUNTIME_PRODUCT_STORE_REDIS_URL',
    persistence_namespace_prefix: 'more:private-live:product:fixed-synthetic',
    vertical_operating_policy: policy,
    intervention_candidates: candidates(),
    support_by_slot: {
      CURRENT: { business_reality: 4 },
      MOST_LIKELY_NEXT: { constraint: 3 },
      ALTERNATIVE_1: { behavior: 1 },
      ALTERNATIVE_2: { business_model: 1 },
      ALTERNATIVE_3: { market: 1 },
    },
    market_context_graph: MISSION_002_FIXTURES.market_regime,
    authority_conflict_graph: { conflicts: [] },
    evidence_consent: consent,
    issued_at: '2026-07-29T00:00:00.000Z',
    review_due_at: '2027-07-29T00:00:00.000Z',
  };
  binding.binding_sha256 = privateLiveProductExecutionBindingDigest(binding);
  return { binding, productBinding };
}

function operationInput(operation, idempotencyRef) {
  return {
    operation,
    request: {
      exact_scope: scope,
      intelligence_input: null,
    },
    requestContext: {
      exact_scope_hash: 'c'.repeat(64),
      idempotency_ref: idempotencyRef,
      correlation_ref: `correlation_${idempotencyRef}`,
    },
    authority: {
      allowed: true,
      authority_fingerprint: 'authority_fingerprint_fixed_fixture',
      subscriber_subject_ref: 'subscriber_subject_synthetic_private_beta_v1',
    },
    attachmentSet: { runtime_ready: true },
  };
}

test('fixture records are deterministic, canonical, and contain no customer-shaped content', () => {
  assert.equal(FIXED_SYNTHETIC_VAULT_RECORD.profile_id, scope.profile_id);
  assert.equal(
    FIXED_SYNTHETIC_VAULT_RECORD.canonical_profile_json.profile_id,
    scope.profile_id,
  );
  assert.equal(FIXED_SYNTHETIC_BUSINESS_ASSESSMENT.owner_profile_id, scope.profile_id);
  assert.equal(
    FIXED_SYNTHETIC_BUSINESS_ASSESSMENT.assessment_id,
    FIXED_SYNTHETIC_PRODUCT_FIXTURE_ASSESSMENT_ID,
  );
  const contract = buildBusinessEngineContract(FIXED_SYNTHETIC_BUSINESS_ASSESSMENT);
  assert.equal(validateBusinessEngineContract(contract).valid, true);
  assert.equal(
    privateRuntimeBusinessEngineExecutionContractDigest(contract),
    FIXED_SYNTHETIC_BUSINESS_ENGINE_CONTRACT_SHA256,
  );
  assert.equal(contract.identity.profile_id, scope.profile_id);
  const serialized = JSON.stringify({
    vault: FIXED_SYNTHETIC_VAULT_RECORD,
    assessment: FIXED_SYNTHETIC_BUSINESS_ASSESSMENT,
  });
  for (const forbidden of [
    'person_name',
    'email',
    'phone',
    'address',
    'company_name',
    'customer_dossier',
  ]) assert.equal(serialized.includes(forbidden), false);
  assert.equal(serialized.includes('customer_derived":false'), true);
  assert.match(FIXED_SYNTHETIC_PRODUCT_FIXTURE_DIGEST, /^[a-f0-9]{64}$/);
});

test('atomic creator creates once, replays stably, and cannot create an arbitrary profile', async () => {
  const client = fakeRedis();
  for (const rejectedInput of [
    { client, profile_id: 'mm-20990101-aaaaaaaa' },
    { client, name: 'synthetic person' },
    { client, email: 'synthetic@example.invalid' },
    { client, phone: '000-000-0000' },
    { client, address: 'synthetic address' },
    { client, dossier: { arbitrary: true } },
    { client, customer_input: { arbitrary: true } },
  ]) {
    const denied = await createFixedSyntheticProfileAndBaFixtureV1(rejectedInput);
    assert.equal(denied.ok, false);
    assert.equal(denied.code, 'FIXED_SYNTHETIC_FIXTURE_INPUT_REJECTED');
    assert.equal(client.values.size, 0);
  }
  const first = await createFixedSyntheticProfileAndBaFixtureV1({ client });
  assert.equal(first.ok, true);
  assert.equal(first.status, 'CREATED');
  assert.equal(first.keys_created, 3);
  assert.equal(first.records_created, 2);
  assert.deepEqual([...client.values.keys()].sort(), [
    FIXED_SYNTHETIC_PRODUCT_FIXTURE_KEYS.business_assessment,
    FIXED_SYNTHETIC_PRODUCT_FIXTURE_KEYS.business_assessment_by_profile,
    FIXED_SYNTHETIC_PRODUCT_FIXTURE_KEYS.vault_profile,
  ].sort());
  const second = await createFixedSyntheticProfileAndBaFixtureV1({ client });
  assert.equal(second.ok, true);
  assert.equal(second.status, 'ALREADY_EXISTS_VALID');
  assert.equal(second.idempotent, true);
  assert.equal(second.keys_created, 0);
  assert.equal(second.fixture_digest, first.fixture_digest);
  assert.equal(second.vault_record_hash, first.vault_record_hash);
  assert.equal(second.assessment_record_hash, first.assessment_record_hash);
  assert.equal(client.values.size, 3);
});

test('partial, malformed, or customer-shaped conflicts fail closed without overwrite', async () => {
  const conflicting = JSON.stringify({
    profile_id: FIXED_SYNTHETIC_PRODUCT_FIXTURE_PROFILE_ID,
    customer_derived: true,
  });
  for (const initial of [
    { [FIXED_SYNTHETIC_PRODUCT_FIXTURE_KEYS.vault_profile]: conflicting },
    {
      [FIXED_SYNTHETIC_PRODUCT_FIXTURE_KEYS.vault_profile]: '{malformed',
      [FIXED_SYNTHETIC_PRODUCT_FIXTURE_KEYS.business_assessment_by_profile]:
        FIXED_SYNTHETIC_PRODUCT_FIXTURE_ASSESSMENT_ID,
      [FIXED_SYNTHETIC_PRODUCT_FIXTURE_KEYS.business_assessment]: '{}',
    },
  ]) {
    const client = fakeRedis(initial);
    const before = new Map(client.values);
    const result = await createFixedSyntheticProfileAndBaFixtureV1({ client });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'FIXED_SYNTHETIC_FIXTURE_CONFLICT');
    assert.deepEqual(client.values, before);
  }
});

test('exact Vault and BA loaders resolve only the fixed canonical records', async () => {
  const client = fakeRedis();
  assert.equal((await createFixedSyntheticProfileAndBaFixtureV1({ client })).ok, true);
  const vaultReader = createExactVaultProfileReader({ client });
  const vault = await vaultReader(scope.profile_id);
  assert.equal(vault.status, 'FOUND');
  assert.equal(vault.record.profile_id, scope.profile_id);
  const store = createPrivateLiveProductStoreV1({
    client,
    namespacePrefix: 'more:private-live:product:fixed-synthetic',
    exactScope: scope,
    clock: () => now,
  });
  const dossier = await store.loadCanonicalDossier();
  const assessment = await store.loadBusinessAssessment();
  assert.equal(dossier.ok, true);
  assert.equal(assessment.ok, true);
  assert.equal(assessment.assessment_id, FIXED_SYNTHETIC_PRODUCT_FIXTURE_ASSESSMENT_ID);
  assert.equal(
    assessment.assessment.owner_profile_id,
    FIXED_SYNTHETIC_PRODUCT_FIXTURE_PROFILE_ID,
  );
  assert.equal(client.calls.some((call) => call[1]?.includes('*')), false);
});

test('fixed scope attaches the existing Business Engine and Subscription Runtime without Coach Connect', async () => {
  const liveBinding = {
    binding_version: 'private-runtime-product-binding-attestation-v1',
    environment_id: 'private_beta_synthetic',
    subscriber_subject_ref: scope.subscriber_id,
    exact_scope: scope,
    exact_scope_hash: hashPrivateRuntimeScope(scope),
    business_engine: {
      source: 'CANONICAL_BUSINESS_ENGINE',
      exact_scope: scope,
      business_engine_ref: 'business_engine_fixed_synthetic_fixture',
      business_engine_version: 'business_engine_v1',
      business_engine_contract_hash:
        FIXED_SYNTHETIC_BUSINESS_ENGINE_CONTRACT_SHA256,
      write_authorized: false,
    },
    subscription_runtime: {
      existing_runtime: true,
      subscription_ref: 'subscription_fixed_synthetic_fixture',
      runtime_contract_version: 'subscriber-runtime-service-v1',
      exact_scope: scope,
      production_namespace: false,
      customer_data: false,
      migration: false,
    },
    coach_connect_runtime: null,
    issued_at: '2026-07-29T00:00:00.000Z',
    review_due_at: '2027-07-29T00:00:00.000Z',
    binding_sha256: '0'.repeat(64),
  };
  liveBinding.binding_sha256 = privateRuntimeProductBindingDigest(liveBinding);
  const businessEngineAdapter =
    createCanonicalBusinessEngineLiveAttachmentAdapterV1({
      productBindingAttestation: liveBinding,
      nowMs: Date.parse(now),
    });
  const subscriptionAdapter =
    createExistingSubscriptionRuntimeLiveAttachmentAdapterV1({
      productBindingAttestation: liveBinding,
      nowMs: Date.parse(now),
    });
  const engine = await businessEngineAdapter.lookupCanonicalBusinessEngine(scope);
  const subscription = await subscriptionAdapter.resolveExistingSubscriptionRuntime({
    exact_scope: scope,
    subject_ref: scope.subscriber_id,
  });
  assert.equal(engine.ok, true, JSON.stringify(engine));
  assert.equal(engine.count, 1);
  assert.equal(subscription.ok, true, JSON.stringify(subscription));
  assert.equal(subscription.descriptor.exact_scope.profile_id, scope.profile_id);
  assert.equal(subscription.runtime.inspect_contract().existing_runtime, true);
  assert.equal(liveBinding.coach_connect_runtime, null);
});

test('fixed fixture bootstraps Business Engine, Five Futures, One Move, persistence, and reload', async () => {
  const client = fakeRedis();
  assert.equal((await createFixedSyntheticProfileAndBaFixtureV1({ client })).ok, true);
  const { binding, productBinding } = executionAuthority();
  const makeExecution = () => createPrivateRuntimeIntelligenceExecutionV1({
    productStore: createPrivateLiveProductStoreV1({
      client,
      namespacePrefix: binding.persistence_namespace_prefix,
      exactScope: scope,
      clock: () => now,
    }),
    binding,
    productBindingAttestation: productBinding,
  });
  const boot = await makeExecution().execute(
    operationInput('BOOTSTRAP', 'fixed_fixture_bootstrap'),
  );
  assert.equal(boot.ok, true, JSON.stringify(boot));
  assert.equal(boot.runtime_ready, true);
  assert.equal(boot.projections.state_version >= 1, true);
  assert.equal(boot.projections.five_futures.length, 5);
  assert.notEqual(boot.projections.one_move, null);
  assert.equal(boot.projections.persistence.append_only, true);
  assert.equal(boot.projections.persistence.immutable_history, true);
  const reload = await makeExecution().execute(
    operationInput('RELOAD', 'fixed_fixture_reload'),
  );
  assert.equal(reload.ok, true, JSON.stringify(reload));
  assert.equal(reload.runtime_ready, true);
  assert.equal(reload.projections.state_version_id, boot.projections.state_version_id);
  assert.equal(
    reload.projections.persistence.snapshot_integrity_hash,
    boot.projections.persistence.snapshot_integrity_hash,
  );
});
