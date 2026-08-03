import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MISSION_001_EXAMPLES,
  MISSION_002_FIXTURES,
  SYNTHETIC_IDS,
} from '../src/lib/intelligenceFabric/index.js';
import {
  buildBusinessEngineContract,
} from '../src/lib/businessEngine/index.js';
import {
  createPrivateRuntimeIntelligenceExecutionV1,
  privateRuntimeBusinessEngineExecutionContractDigest,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/intelligenceExecution.js';
import {
  createPrivateRuntimeLiveCompositionV2,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveComposition.js';
import {
  createCanonicalBusinessEngineLiveAttachmentAdapterV1,
  createExistingSubscriptionRuntimeLiveAttachmentAdapterV1,
  createPrivateRuntimeLiveAttachmentCoordinatorV1,
  privateRuntimeProductBindingDigest,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/index.js';
import {
  connectPrivateRuntimeProductStoreClientV1,
  createPrivateLiveProductStoreV1,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/privateLiveProductStore.js';
import {
  privateLiveProductExecutionBindingDigest,
  validatePrivateLiveProductExecutionBindingV1,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/productExecutionBinding.js';
import {
  createSubdev1OperatorBridge,
  InMemorySubdev1OperatorBridgeStore,
  SUBDEV1_PROFILE_CONSENT_PURPOSE,
  SUBDEV1_PROFILE_RECORD_VERSION,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/operatorBridge/index.js';
import {
  hashPrivateRuntimeScope,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/contracts.js';

const scope = Object.freeze({
  tenant_id: SYNTHETIC_IDS.tenant,
  profile_id: SYNTHETIC_IDS.profile,
  business_id: SYNTHETIC_IDS.business,
  subscriber_id: 'subscriber_private_beta',
});
const now = '2026-07-29T12:00:00.000Z';
const assessment = Object.freeze({
  assessment_id: 'ba-20260729-a1b2c3d4',
  created_at: now,
  assessment: {
    profile_id: scope.profile_id,
    owner_profile_id: scope.profile_id,
    assessment_id: 'ba-20260729-a1b2c3d4',
    assessment_type: 'business_assessment',
    created_at: now,
  },
  answers: {},
});

test('cold lazy product-store clients connect before the first authoritative read', async () => {
  let connectCalls = 0;
  const client = {
    status: 'wait',
    async connect() {
      connectCalls += 1;
      this.status = 'ready';
    },
  };
  assert.equal(await connectPrivateRuntimeProductStoreClientV1(client), true);
  assert.equal(connectCalls, 1);
  assert.equal(client.status, 'ready');
  assert.equal(await connectPrivateRuntimeProductStoreClientV1(client), true);
  assert.equal(connectCalls, 1);
});

test('failed or unavailable cold product-store connections fail closed', async () => {
  assert.equal(await connectPrivateRuntimeProductStoreClientV1(null), false);
  for (const status of [
    undefined,
    'connecting',
    'connect',
    'reconnecting',
    'close',
    'end',
    'unknown',
  ]) {
    assert.equal(await connectPrivateRuntimeProductStoreClientV1({ status }), false);
  }
  assert.equal(await connectPrivateRuntimeProductStoreClientV1({ status: 'wait' }), false);
  assert.equal(await connectPrivateRuntimeProductStoreClientV1({
    status: 'wait',
    async connect() {
      throw new Error('connection unavailable');
    },
  }), false);
});

test('both deployment-grade product-store builders await cold-client readiness', () => {
  for (const path of [
    '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/compositionRoot.js',
    '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/operatorBridgeBinding.js',
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(
      source,
      /productClient = createProductStoreClient\(productStoreUrl\);[\s\S]{0,160}await connectPrivateRuntimeProductStoreClientV1\(productClient\)/,
    );
    assert.match(source, /PRODUCT_STORE_CONNECTION_REQUIRED/);
  }
});

function fakeRedis(initial = {}) {
  const values = new Map(Object.entries(initial));
  const lists = new Map();
  return {
    values,
    lists,
    async get(key) {
      return values.get(key) ?? null;
    },
    async mget(...keys) {
      return keys.map((key) => values.get(key) ?? null);
    },
    async lrange(key, start, end) {
      const entries = lists.get(key) || [];
      return entries.slice(start, end === -1 ? undefined : end + 1);
    },
    async eval(_script, numberOfKeys, ...parameters) {
      const keys = parameters.slice(0, numberOfKeys);
      const args = parameters.slice(numberOfKeys);
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
    intervention_id: `private_candidate_${index}`,
    template_id: `private_template_${index}`,
    tenant_id: scope.tenant_id,
    target_constraint: 'private_beta_constraint',
    target_future_or_transition: 'current-to-next',
    dimensions: dimensions(score),
    expected_probability_shift: score / 10,
    expected_downstream_effects: ['private_beta_signal'],
    time_to_signal: '14_DAYS',
    time_to_outcome: '90_DAYS',
  }));
}

function authorityPacket(contractDigest) {
  const productBinding = {
    binding_sha256: 'b'.repeat(64),
    exact_scope: scope,
    exact_scope_hash: 'c'.repeat(64),
    business_engine: {
      business_engine_contract_hash: 'd'.repeat(64),
    },
  };
  const binding = {
    binding_version: 'private-live-product-execution-binding-v1',
    environment_id: 'private_live_environment',
    configuration_authority_packet_sha256: 'a'.repeat(64),
    product_binding_attestation_sha256: productBinding.binding_sha256,
    business_engine_execution_contract_sha256: contractDigest,
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
    persistence_namespace_prefix: 'more:private-live:product:synthetic-test',
    vertical_operating_policy: MISSION_002_FIXTURES.vertical_operating_policy,
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
    evidence_consent: MISSION_001_EXAMPLES.consent_activation,
    issued_at: '2026-07-29T00:00:00.000Z',
    review_due_at: '2027-07-29T00:00:00.000Z',
  };
  binding.binding_sha256 = privateLiveProductExecutionBindingDigest(binding);
  return { binding, productBinding };
}

function operationInput(idempotencyRef, body = null) {
  return {
    request: {
      exact_scope: scope,
      intelligence_input: body,
    },
    requestContext: {
      exact_scope_hash: 'c'.repeat(64),
      idempotency_ref: idempotencyRef,
      correlation_ref: `correlation_${idempotencyRef}`,
    },
    authority: {
      allowed: true,
      authority_fingerprint: 'authority_fingerprint_private_beta',
      subscriber_subject_ref: 'external_subject_private_beta',
    },
    attachmentSet: {
      runtime_ready: true,
    },
  };
}

test('private-live product binding requires approved exact profile and immutable append-only doctrine', () => {
  const contractDigest =
    privateRuntimeBusinessEngineExecutionContractDigest(
      buildBusinessEngineContract(assessment),
    );
  const { binding, productBinding } = authorityPacket(contractDigest);
  const valid = validatePrivateLiveProductExecutionBindingV1(binding, {
    environmentId: binding.environment_id,
    configurationAuthorityPacketSha256:
      binding.configuration_authority_packet_sha256,
    productBindingAttestation: productBinding,
    nowMs: Date.parse('2026-07-29T12:00:00.000Z'),
  });
  assert.equal(valid.valid, true, JSON.stringify(valid.errors));
  for (const patch of [
    { approved_profile_ids: [] },
    { append_only: false },
    { destructive_updates: true },
    { public_access: true },
    { transcript_persistence: true },
    { issued_at: '2026-07-30T00:00:00.000Z' },
  ]) {
    const altered = { ...binding, ...patch };
    altered.binding_sha256 = privateLiveProductExecutionBindingDigest(altered);
    assert.equal(validatePrivateLiveProductExecutionBindingV1(altered, {
      environmentId: binding.environment_id,
      configurationAuthorityPacketSha256:
        binding.configuration_authority_packet_sha256,
      productBindingAttestation: productBinding,
      nowMs: Date.parse('2026-07-29T12:00:00.000Z'),
    }).valid, false);
  }
});

test('product execution bootstraps, appends confirmed evidence, and restores identical state after restart', async () => {
  const contract = buildBusinessEngineContract(assessment);
  const contractDigest = privateRuntimeBusinessEngineExecutionContractDigest(contract);
  const { binding, productBinding } = authorityPacket(contractDigest);
  const client = fakeRedis({
    [`vault:profile:${scope.profile_id}`]: JSON.stringify({
      profile_id: scope.profile_id,
      canonical_profile_json: { profile_id: scope.profile_id },
    }),
    [`business_assessment_by_profile:${scope.profile_id}`]: assessment.assessment_id,
    [`business_assessment:${assessment.assessment_id}`]: JSON.stringify(assessment),
  });
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
  const boot = await makeExecution().execute({
    operation: 'BOOTSTRAP',
    ...operationInput('bootstrap_private_beta'),
  });
  assert.equal(boot.ok, true, JSON.stringify(boot));
  assert.equal(boot.projections.five_futures.length, 5);
  assert.equal(boot.projections.persistence.append_only, true);
  assert.equal(boot.projections.persistence.immutable_history, true);
  assert.deepEqual(
    [...new Set(boot.projections.execution_trace.map((entry) => entry.stage_number))]
      .sort((left, right) => left - right),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 18],
  );

  const update = await makeExecution().execute({
    operation: 'SUBMIT_CONFIRMED_EVIDENCE',
    ...operationInput('update_private_beta', {
      request_id: 'request_private_beta',
      session_id: 'session_private_beta',
      turn_id: 'turn_private_beta',
      statement: 'Update my business with nine new leads.',
      intent: 'UPDATE_MY_BUSINESS',
      extracted_fields: [{
        field: 'leads',
        proposed_value: 9,
        unit: 'count/week',
      }],
      confirmation_status: 'CONFIRMED_AS_PROPOSED',
      subscriber_edits: [],
      extraction_confidence: 0.9,
      effective_at: '2026-07-29T12:01:00.000Z',
      decided_at: '2026-07-29T12:02:00.000Z',
    }),
  });
  assert.equal(update.ok, true, JSON.stringify(update));
  assert.equal(update.projections.trend, 'QUALIFYING_CURRENT_STATE_CHANGE');
  assert.ok(update.projections.evidence_sources.length >= 1);
  assert.equal(JSON.stringify(update).includes('nine new leads'), false);
  assert.deepEqual(
    [...new Set(update.projections.execution_trace.map((entry) => entry.stage_number))]
      .sort((left, right) => left - right),
    [1, 2, 3, 4, 5, 10, 11, 12, 13, 14, 15, 16, 17, 18],
  );

  const replay = await makeExecution().execute({
    operation: 'SUBMIT_CONFIRMED_EVIDENCE',
    ...operationInput('update_private_beta', {
      request_id: 'request_private_beta',
      session_id: 'session_private_beta',
      turn_id: 'turn_private_beta',
      statement: 'Update my business with nine new leads.',
      intent: 'UPDATE_MY_BUSINESS',
      extracted_fields: [{
        field: 'leads',
        proposed_value: 9,
        unit: 'count/week',
      }],
      confirmation_status: 'CONFIRMED_AS_PROPOSED',
      subscriber_edits: [],
      extraction_confidence: 0.9,
      effective_at: '2026-07-29T12:01:00.000Z',
      decided_at: '2026-07-29T12:02:00.000Z',
    }),
  });
  assert.equal(replay.ok, true);
  assert.equal(replay.idempotent_replay, true);
  const divergent = await makeExecution().execute({
    operation: 'SUBMIT_CONFIRMED_EVIDENCE',
    ...operationInput('update_private_beta', {
      request_id: 'request_private_beta',
      session_id: 'session_private_beta',
      turn_id: 'turn_private_beta',
      statement: 'Update my business with ten new leads.',
      intent: 'UPDATE_MY_BUSINESS',
      extracted_fields: [{
        field: 'leads',
        proposed_value: 10,
        unit: 'count/week',
      }],
      confirmation_status: 'CONFIRMED_AS_PROPOSED',
      subscriber_edits: [],
      extraction_confidence: 0.9,
      effective_at: '2026-07-29T12:01:00.000Z',
      decided_at: '2026-07-29T12:02:00.000Z',
    }),
  });
  assert.equal(divergent.ok, false);
  assert.equal(divergent.code, 'IDEMPOTENCY_CONFLICT');

  const reloaded = await makeExecution().execute({
    operation: 'RELOAD',
    ...operationInput('reload_private_beta'),
  });
  assert.equal(reloaded.ok, true, JSON.stringify(reloaded));
  assert.equal(
    reloaded.projections.persistence.snapshot_integrity_hash,
    update.projections.persistence.snapshot_integrity_hash,
  );
  assert.ok(reloaded.projections.execution_trace
    .some((entry) => entry.stage_number === 20 && entry.status === 'PASSED'));
});

test('cross-scope, unapproved profile, and divergent idempotency fail closed', async () => {
  const contractDigest =
    privateRuntimeBusinessEngineExecutionContractDigest(
      buildBusinessEngineContract(assessment),
    );
  const { binding, productBinding } = authorityPacket(contractDigest);
  const client = fakeRedis();
  const execution = createPrivateRuntimeIntelligenceExecutionV1({
    productStore: createPrivateLiveProductStoreV1({
      client,
      namespacePrefix: binding.persistence_namespace_prefix,
      exactScope: scope,
      clock: () => now,
    }),
    binding,
    productBindingAttestation: productBinding,
  });
  const denied = await execution.execute({
    operation: 'RELOAD',
    ...operationInput('denied_scope'),
    request: {
      exact_scope: { ...scope, profile_id: 'mm-20260115-other001' },
      intelligence_input: null,
    },
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, 'PRIVATE_RUNTIME_AUTHORITY_DENIED');
});

test('live composition preserves attachment-only behavior and executes only after authority revalidation', async () => {
  let authorityEvaluations = 0;
  let executions = 0;
  const allowedAuthority = {
    ok: true,
    allowed: true,
    authority_fingerprint: 'authority_product_execution',
    subscriber_subject_ref: 'external_subject_private_beta',
  };
  const service = Object.fromEntries([
    'describe',
    'health',
    'beginPreAuth',
    'completeAuthentication',
    'resolveAuthenticatedContext',
    'evaluatePrivateTestEligibility',
    'issueCsrfGrant',
    'issueTemporaryEntitlement',
    'inspectTemporaryEntitlement',
    'revokeTemporaryEntitlement',
    'logout',
    'inspectRecovery',
  ].map((method) => [method, async () => ({
    ok: true,
    allowed: true,
    method,
  })]));
  service.evaluatePrivateRuntimeAuthority = async () => {
    authorityEvaluations += 1;
    return allowedAuthority;
  };
  const attached = {
    ok: true,
    allowed: true,
    runtime_ready: true,
    attachment_set: { attachment_set_id: 'attachment_private_beta' },
  };
  const composition = createPrivateRuntimeLiveCompositionV2({
    canonicalSecurityService: service,
    privateRuntimeBridge: {
      async attach() {
        return attached;
      },
    },
    intelligenceExecution: {
      async execute(input) {
        executions += 1;
        assert.equal(input.authority.authority_fingerprint, allowedAuthority.authority_fingerprint);
        assert.equal(input.attachmentSet.runtime_ready, true);
        return {
          ok: true,
          allowed: true,
          status: 200,
          runtime_ready: true,
          projections: { operation: input.operation },
        };
      },
    },
    activationDecision: async () => ({ ok: true, allowed: true }),
    resolveRequestContext: async () => ({
      ok: true,
      allowed: false,
      value: {
        exact_scope_hash: 'c'.repeat(64),
        idempotency_ref: 'composition_product_execution',
      },
    }),
    resolveBridgeInput: async ({ authority }) => ({
      ok: true,
      allowed: false,
      value: {
        request: { exact_scope: scope },
        authority,
      },
    }),
  });
  const attachOnly = await composition.operations.bootstrap({
    method: 'POST',
    body: {},
  });
  assert.equal(attachOnly.runtime_ready, true);
  assert.equal(executions, 0);
  const executed = await composition.operations.bootstrap({
    method: 'POST',
    body: {
      intelligence_operation: 'BOOTSTRAP',
      intelligence_input: null,
    },
  });
  assert.equal(executed.ok, true);
  assert.equal(executed.projections.operation, 'BOOTSTRAP');
  assert.equal(executions, 1);
  assert.equal(authorityEvaluations, 4);
});

test('customer-independent SUBDEV1 context runs the Subscription lifecycle without Coach authority', async () => {
  const origin = 'http://localhost:5173';
  const accessCode = ['SUB', 'DEV', '1'].join('');
  const operatorEnv = {
    NODE_ENV: 'test',
    MORE_SUBDEV1_OPERATOR_ENABLED: 'true',
    MORE_SUBDEV1_OPERATOR_CODE: accessCode,
    MORE_SUBDEV1_OPERATOR_SIGNING_SECRET:
      'synthetic-v2-integration-secret-at-least-thirty-two-bytes',
    MORE_SUBDEV1_OPERATOR_ALLOWED_ORIGINS: origin,
    MORE_SUBDEV1_OPERATOR_ENVIRONMENT_ID: 'private_beta_synthetic',
    MORE_SUBDEV1_OPERATOR_TTL_SECONDS: '900',
  };
  const scopeB = Object.freeze({
    tenant_id: 'tenant_synthetic_beta',
    profile_id: 'mm-20990102-bbbbbbbb',
    business_id: 'business_synthetic_beta',
    subscriber_id: 'subscriber_synthetic_beta',
  });
  const records = new Map([
    [scope.profile_id, {
      record_version: SUBDEV1_PROFILE_RECORD_VERSION,
      profile_id: scope.profile_id,
      subscriber_subject_ref: 'subscriber_subject_synthetic_a',
      exact_scope: scope,
      profile_revision: 'revision_synthetic_a',
      consent_ref: 'consent_synthetic_a',
      consent_purpose: SUBDEV1_PROFILE_CONSENT_PURPOSE,
      consent_status: 'ACTIVE',
      provenance: {
        source: 'SYNTHETIC_ISOLATED_FIXTURE',
        record_ref: 'fixture_synthetic_a',
      },
    }],
    [scopeB.profile_id, {
      record_version: SUBDEV1_PROFILE_RECORD_VERSION,
      profile_id: scopeB.profile_id,
      subscriber_subject_ref: 'subscriber_subject_synthetic_b',
      exact_scope: scopeB,
      profile_revision: 'revision_synthetic_b',
      consent_ref: 'consent_synthetic_b',
      consent_purpose: SUBDEV1_PROFILE_CONSENT_PURPOSE,
      consent_status: 'ACTIVE',
      provenance: {
        source: 'SYNTHETIC_ISOLATED_FIXTURE',
        record_ref: 'fixture_synthetic_b',
      },
    }],
  ]);
  const profileRepository = {
    async resolveExactProfile(profileId) {
      const record = records.get(profileId);
      return record
        ? { status: 'FOUND', record: structuredClone(record) }
        : { status: 'NOT_FOUND', record: null };
    },
  };
  let tokenSequence = 0;
  const operatorBridge = createSubdev1OperatorBridge({
    env: operatorEnv,
    store: new InMemorySubdev1OperatorBridgeStore(),
    profileRepository,
    clock: () => Date.parse(now),
    randomToken: () =>
      `opaque-v2-token-${String(tokenSequence += 1).padStart(40, '0')}`,
  });
  const operatorRequest = (method = 'POST') => ({
    method,
    headers: { origin },
  });
  const browser = await operatorBridge.establishBrowser();
  const activationCsrf = await operatorBridge.issueCsrf({
    request: operatorRequest(),
    browserToken: browser.browser_token,
    method: 'POST',
  });
  const activated = await operatorBridge.activate({
    request: operatorRequest(),
    browserToken: browser.browser_token,
    csrfProof: activationCsrf.csrf_proof,
    submittedCode: accessCode,
  });
  assert.equal(activated.ok, true);

  async function selectProfile(profileId) {
    const csrf = await operatorBridge.issueCsrf({
      request: operatorRequest(),
      browserToken: browser.browser_token,
      method: 'POST',
    });
    return operatorBridge.selectProfile({
      request: operatorRequest(),
      browserToken: browser.browser_token,
      contextToken: activated.context_token,
      csrfProof: csrf.csrf_proof,
      profileId,
    });
  }
  const selectedA = await selectProfile(scope.profile_id);
  assert.equal(selectedA.ok, true);

  const liveBinding = {
    binding_version: 'private-runtime-product-binding-attestation-v1',
    environment_id: 'private_beta_synthetic',
    subscriber_subject_ref: 'subscriber_subject_synthetic_a',
    exact_scope: scope,
    exact_scope_hash: hashPrivateRuntimeScope(scope),
    business_engine: {
      source: 'CANONICAL_BUSINESS_ENGINE',
      exact_scope: scope,
      business_engine_ref: 'business_engine_synthetic_a',
      business_engine_version: 'business_engine_v1',
      business_engine_contract_hash: '8'.repeat(64),
      write_authorized: false,
    },
    subscription_runtime: {
      existing_runtime: true,
      subscription_ref: 'subscription_synthetic_a',
      runtime_contract_version: 'subscriber-runtime-service-v1',
      exact_scope: scope,
      production_namespace: false,
      customer_data: false,
      migration: false,
    },
    coach_connect_runtime: null,
    issued_at: '2026-07-29T10:00:00.000Z',
    review_due_at: '2026-08-29T10:00:00.000Z',
    binding_sha256: '0'.repeat(64),
  };
  liveBinding.binding_sha256 = privateRuntimeProductBindingDigest(liveBinding);
  const privateRuntimeBridge = createPrivateRuntimeLiveAttachmentCoordinatorV1({
    businessEngineAdapter: createCanonicalBusinessEngineLiveAttachmentAdapterV1({
      productBindingAttestation: liveBinding,
      nowMs: Date.parse(now),
    }),
    subscriptionRuntimeAdapter:
      createExistingSubscriptionRuntimeLiveAttachmentAdapterV1({
        productBindingAttestation: liveBinding,
        nowMs: Date.parse(now),
      }),
    coachConnectAdapter: null,
    clock: () => now,
  });

  const contract = buildBusinessEngineContract(assessment);
  const contractDigest = privateRuntimeBusinessEngineExecutionContractDigest(contract);
  const { binding, productBinding } = authorityPacket(contractDigest);
  binding.exact_scope_hash = hashPrivateRuntimeScope(scope);
  productBinding.exact_scope_hash = binding.exact_scope_hash;
  binding.binding_sha256 = privateLiveProductExecutionBindingDigest(binding);
  const client = fakeRedis({
    [`vault:profile:${scope.profile_id}`]: JSON.stringify({
      profile_id: scope.profile_id,
      canonical_profile_json: { profile_id: scope.profile_id },
    }),
    [`business_assessment_by_profile:${scope.profile_id}`]: assessment.assessment_id,
    [`business_assessment:${assessment.assessment_id}`]: JSON.stringify(assessment),
  });
  const intelligenceExecution = createPrivateRuntimeIntelligenceExecutionV1({
    productStore: createPrivateLiveProductStoreV1({
      client,
      namespacePrefix: binding.persistence_namespace_prefix,
      exactScope: scope,
      clock: () => now,
    }),
    binding,
    productBindingAttestation: productBinding,
  });
  const canonicalCalls = [];
  const canonicalSecurityService = Object.fromEntries([
    'describe',
    'health',
    'beginPreAuth',
    'completeAuthentication',
    'resolveAuthenticatedContext',
    'evaluatePrivateTestEligibility',
    'issueCsrfGrant',
    'issueTemporaryEntitlement',
    'inspectTemporaryEntitlement',
    'evaluatePrivateRuntimeAuthority',
    'revokeTemporaryEntitlement',
    'logout',
    'inspectRecovery',
  ].map((method) => [method, async () => {
    canonicalCalls.push(method);
    return { ok: false, allowed: false, code: 'AUTHENTICATION_REQUIRED' };
  }]));

  const composition = createPrivateRuntimeLiveCompositionV2({
    canonicalSecurityService,
    privateRuntimeBridge,
    intelligenceExecution,
    activationDecision: async () => ({
      ok: false,
      allowed: false,
      code: 'AUTHENTICATION_REQUIRED',
    }),
    operatorActivationDecision: async () => ({ ok: true, allowed: true }),
    operatorContextBridge: operatorBridge,
    resolveOperatorContext: async ({ req }) => ({
      ok: true,
      allowed: false,
      value: {
        operator_present: true,
        context_token: activated.context_token,
        browser_token: browser.browser_token,
        exact_scope_hash: hashPrivateRuntimeScope(scope),
        idempotency_ref: req.headers['x-idempotency-key'],
        correlation_ref: req.headers['x-correlation-id'],
      },
    }),
    resolveOperatorBridgeInput: async ({
      req,
      request_context: requestContext,
      operator_context: operatorContext,
    }) => {
      const sessionRef = operatorContext.context_id;
      const authority = {
        ok: true,
        allowed: true,
        source: operatorContext.source,
        operator_context_verified: true,
        environment_id: 'private_beta_synthetic',
        subscriber_subject_ref: operatorContext.subscriber_subject_ref,
        authenticated_session_ref: sessionRef,
        entitlement_ref: operatorContext.context_id,
        exact_scope_hash: operatorContext.exact_scope_hash,
        security_epoch: operatorContext.profile_generation,
        requested_runtime: 'SUBSCRIPTION_RUNTIME',
        requested_action: operatorContext.action,
        evaluated_at: now,
        expires_at: operatorContext.expires_at,
        deployment_grade_security_state: true,
        no_local_fallback: true,
        shared_state_evidence_class: 'DEPLOYMENT_SHAPED_OFFLINE',
        admin_authority: false,
        deployment_authority: false,
        billing_authority: false,
        coach_authority: false,
        canonical_mutation_authority: false,
        canonical_identity_authority: false,
        authority_fingerprint: operatorContext.exact_scope_hash,
      };
      return {
        ok: true,
        allowed: false,
        value: {
          request: {
            request_version: 'private-runtime-attachment-request-v1',
            environment_id: 'private_beta_synthetic',
            subscriber_subject_ref: operatorContext.subscriber_subject_ref,
            authenticated_session_ref: sessionRef,
            capability_ref: operatorContext.context_id,
            exact_scope: operatorContext.exact_scope,
            requested_attachments: [
              'BUSINESS_ENGINE',
              'SUBSCRIPTION_RUNTIME',
              ...(req.body.request_coach === true ? ['COACH_CONNECT'] : []),
            ],
            correlation_id: requestContext.correlation_ref,
            requested_at: now,
          },
          edgeAttestation: {
            operator_context_verified: true,
            named_identity_verified: false,
            mfa_verified: false,
            public_access: false,
          },
          authority,
          operatorContext,
          subjectReceipt: {
            subject_receipt_version: 'private-runtime-subject-receipt-v1',
            subscriber_subject_ref: operatorContext.subscriber_subject_ref,
            exact_scope_hash: operatorContext.exact_scope_hash,
          },
          sessionReceipt: {
            session_receipt_version: 'private-runtime-session-receipt-v1',
            subscriber_subject_ref: operatorContext.subscriber_subject_ref,
            authenticated_session_ref: sessionRef,
          },
          capability: {
            envelope_version: 'private-runtime-capability-v1',
            capability_id: operatorContext.context_id,
            environment_id: 'private_beta_synthetic',
            subscriber_subject_ref: operatorContext.subscriber_subject_ref,
            authenticated_session_ref: sessionRef,
            subject_security_version: 1,
            session_epoch: operatorContext.profile_generation,
            browser_binding_hash: '7'.repeat(64),
            exact_scope_hash: operatorContext.exact_scope_hash,
            entitlement_source: operatorContext.source,
            allowed_runtime_actions: [
              'BUSINESS_ENGINE_READ',
              'SUBSCRIPTION_INTERACTION',
            ],
            issued_at: now,
            expires_at: operatorContext.expires_at,
            status: 'ACTIVE',
            stripe_authority: false,
            billing_authority: false,
            operator_authority: true,
            deployment_authority: false,
            coach_authority: false,
            canonical_mutation_authority: false,
          },
          entitlement: {
            access_type: 'more_monthly_intelligence',
            status: 'active',
            source: operatorContext.source,
            temporary: true,
            billing_evidence: false,
            stripe_subscription_created: false,
            canonical_mutation_authority: false,
            paid_entitlement: false,
            issued_at: now,
            expires_at: operatorContext.expires_at,
          },
          requestContext: {
            ...requestContext,
            exact_scope_hash: operatorContext.exact_scope_hash,
          },
        },
      };
    },
  });

  function runtimeRequest(idempotencyRef, body) {
    return {
      method: 'POST',
      headers: {
        'x-idempotency-key': idempotencyRef,
        'x-correlation-id': `correlation_${idempotencyRef}`,
      },
      body,
    };
  }

  const attached = await composition.operations.bootstrap(
    runtimeRequest('operator_attach_a', {}),
  );
  assert.equal(attached.ok, true, JSON.stringify(attached));
  assert.equal(attached.runtime_ready, true);
  assert.equal(attached.authority_source, 'temporary_internal_beta_operator_context');
  assert.equal(attached.coach_connect_attachment, null);
  assert.equal(attached.coach_connect_attached, false);
  assert.equal(attached.coach_authority, false);
  assert.equal(attached.stripe_authority, false);
  assert.equal(canonicalCalls.length, 0);

  const deniedCoach = await composition.operations.bootstrap(
    runtimeRequest('operator_coach_denied', { request_coach: true }),
  );
  assert.equal(deniedCoach.ok, false);
  assert.equal(deniedCoach.code, 'COACH_CONNECT_STATE_MISSING');

  const boot = await composition.operations.bootstrap(
    runtimeRequest('operator_bootstrap_a', {
      intelligence_operation: 'BOOTSTRAP',
      intelligence_input: null,
    }),
  );
  assert.equal(boot.ok, true, JSON.stringify(boot));
  assert.equal(boot.projections.five_futures.length, 5);

  const update = await composition.operations.bootstrap(
    runtimeRequest('operator_update_a', {
      intelligence_operation: 'SUBMIT_CONFIRMED_EVIDENCE',
      intelligence_input: {
        request_id: 'request_operator_a',
        session_id: 'session_operator_a',
        turn_id: 'turn_operator_a',
        statement: 'Synthetic customer evidence.',
        intent: 'UPDATE_MY_BUSINESS',
        extracted_fields: [{
          field: 'leads',
          proposed_value: 7,
          unit: 'count/week',
        }],
        confirmation_status: 'CONFIRMED_AS_PROPOSED',
        subscriber_edits: [],
        extraction_confidence: 0.9,
        effective_at: '2026-07-29T12:01:00.000Z',
        decided_at: '2026-07-29T12:02:00.000Z',
      },
    }),
  );
  assert.equal(update.ok, true, JSON.stringify(update));
  assert.equal(JSON.stringify(update).includes('Synthetic customer evidence.'), false);

  const reload = await composition.operations.bootstrap(
    runtimeRequest('operator_reload_a', {
      intelligence_operation: 'RELOAD',
      intelligence_input: null,
    }),
  );
  assert.equal(reload.ok, true, JSON.stringify(reload));
  assert.equal(
    reload.projections.persistence.snapshot_integrity_hash,
    update.projections.persistence.snapshot_integrity_hash,
  );

  const selectedB = await selectProfile(scopeB.profile_id);
  assert.equal(selectedB.ok, true);
  const deniedB = await composition.operations.bootstrap(
    runtimeRequest('operator_attach_b', {}),
  );
  assert.equal(deniedB.ok, false);
  assert.equal(deniedB.code, 'SUBSCRIPTION_RUNTIME_UNAVAILABLE');

  const selectedAgainA = await selectProfile(scope.profile_id);
  assert.equal(selectedAgainA.ok, true);
  const restoredA = await composition.operations.bootstrap(
    runtimeRequest('operator_reload_a_again', {
      intelligence_operation: 'RELOAD',
      intelligence_input: null,
    }),
  );
  assert.equal(restoredA.ok, true);
  assert.equal(
    restoredA.projections.persistence.snapshot_integrity_hash,
    update.projections.persistence.snapshot_integrity_hash,
  );
  assert.equal(canonicalCalls.length, 0);
});
