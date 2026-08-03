import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MISSION_001_EXAMPLES,
  MISSION_002_FIXTURES,
} from '../src/lib/intelligenceFabric/index.js';
import { buildBusinessEngineContract } from '../src/lib/businessEngine/index.js';
import {
  privateRuntimeBusinessEngineExecutionContractDigest,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/intelligenceExecution.js';
import {
  createExactBusinessAssessmentReader,
  createExactVaultProfileReader,
  createSubdev1CanonicalExactProfileRepository,
  createSubdev1OperatorBridge,
  InMemorySubdev1OperatorBridgeStore,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/operatorBridge/index.js';
import {
  createPrivateRuntimeApprovedProfileCohortV1,
  createCanonicalBusinessEngineLiveAttachmentAdapterV1,
  createExistingSubscriptionRuntimeLiveAttachmentAdapterV1,
  createPrivateRuntimeCohortIntelligenceExecutionV1,
  privateLiveProductExecutionBindingDigest,
  privateRuntimeApprovedProfileCohortDigest,
  privateRuntimeApprovedProfileCohortMemberDigest,
  privateRuntimeProductBindingDigest,
  projectPrivateRuntimeCohortMemberBindingsV1,
  validatePrivateRuntimeApprovedProfileCohortV1,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/index.js';
import {
  hashPrivateRuntimeScope,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/contracts.js';

const now = '2099-01-02T00:00:00.000Z';
const issuedAt = '2099-01-01T00:00:00.000Z';
const expiresAt = '2099-02-01T00:00:00.000Z';
const environmentId = 'private_beta_multi_profile_test';
const packetDigest = 'a'.repeat(64);
const profileIds = [
  'mm-20990101-aaaaaaaa',
  'mm-20990101-bbbbbbbb',
  'mm-20990101-cccccccc',
  'mm-20990101-dddddddd',
];

function scopeFor(profileId, index) {
  return {
    tenant_id: `tenant_private_beta_${index}`,
    profile_id: profileId,
    business_id: `business_private_beta_${index}`,
    subscriber_id: `subscriber_private_beta_${index}`,
  };
}

function assessmentFor(profileId, index) {
  return {
    assessment_id: `ba-20990101-${String(index).padStart(8, '0')}`,
    owner_profile_id: profileId,
    created_at: issuedAt,
    assessment: {
      profile_id: profileId,
      owner_profile_id: profileId,
      assessment_id: `ba-20990101-${String(index).padStart(8, '0')}`,
      assessment_type: 'business_assessment',
      created_at: issuedAt,
    },
    answers: {},
  };
}

function fakeRedis(initial = {}) {
  const values = new Map(Object.entries(initial));
  const lists = new Map();
  return {
    values,
    lists,
    async get(key) { return values.get(key) ?? null; },
    async mget(...keys) { return keys.map((key) => values.get(key) ?? null); },
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

function interventionCandidates(tenantId) {
  const dimensionNames = [
    'expected_leverage', 'probability_shift', 'constraint_centrality',
    'user_goal_alignment', 'behavioral_fit', 'execution_feasibility',
    'financial_feasibility', 'evidence_quality', 'outcome_support',
    'time_to_signal', 'reversibility', 'downside_risk',
    'privacy_compliance_burden', 'confidence',
  ];
  return [0.9, 0.7].map((score, index) => ({
    intervention_id: `private_candidate_${index}`,
    template_id: `private_template_${index}`,
    tenant_id: tenantId,
    target_constraint: 'private_beta_constraint',
    target_future_or_transition: 'current-to-next',
    dimensions: Object.fromEntries(dimensionNames.map((name) => [
      name,
      ['downside_risk', 'privacy_compliance_burden'].includes(name) ? 0.1 : score,
    ])),
    expected_probability_shift: score / 10,
    expected_downstream_effects: ['private_beta_signal'],
    time_to_signal: '14_DAYS',
    time_to_outcome: '90_DAYS',
  }));
}

function rootBindings() {
  const scope = scopeFor(profileIds[0], 1);
  const assessment = assessmentFor(profileIds[0], 1);
  const contractDigest = privateRuntimeBusinessEngineExecutionContractDigest(
    buildBusinessEngineContract(assessment),
  );
  const product = {
    binding_version: 'private-runtime-product-binding-attestation-v1',
    environment_id: environmentId,
    subscriber_subject_ref: 'subject_private_beta_1',
    exact_scope: scope,
    exact_scope_hash: hashPrivateRuntimeScope(scope),
    business_engine: {
      source: 'CANONICAL_BUSINESS_ENGINE',
      exact_scope: scope,
      business_engine_ref: 'business_engine_private_beta_1',
      business_engine_version: 'business_engine_v1',
      business_engine_contract_hash: contractDigest,
      write_authorized: false,
    },
    subscription_runtime: {
      existing_runtime: true,
      subscription_ref: 'subscription_private_beta_1',
      runtime_contract_version: 'subscriber_runtime_service_v1',
      exact_scope: scope,
      production_namespace: false,
      customer_data: false,
      migration: false,
    },
    coach_connect_runtime: null,
    issued_at: issuedAt,
    review_due_at: expiresAt,
  };
  product.binding_sha256 = privateRuntimeProductBindingDigest(product);
  const execution = {
    binding_version: 'private-live-product-execution-binding-v1',
    environment_id: environmentId,
    configuration_authority_packet_sha256: packetDigest,
    product_binding_attestation_sha256: product.binding_sha256,
    business_engine_execution_contract_sha256: contractDigest,
    exact_scope: scope,
    exact_scope_hash: product.exact_scope_hash,
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
    persistence_namespace_prefix: 'more:private-live:product:multi-profile-test',
    vertical_operating_policy: {
      ...structuredClone(MISSION_002_FIXTURES.vertical_operating_policy),
      tenant_id: scope.tenant_id,
    },
    intervention_candidates: interventionCandidates(scope.tenant_id),
    support_by_slot: {
      CURRENT: { business_reality: 4 },
      MOST_LIKELY_NEXT: { constraint: 3 },
      ALTERNATIVE_1: { behavior: 1 },
      ALTERNATIVE_2: { business_model: 1 },
      ALTERNATIVE_3: { market: 1 },
    },
    market_context_graph: MISSION_002_FIXTURES.market_regime,
    authority_conflict_graph: { conflicts: [] },
    evidence_consent: {
      ...structuredClone(MISSION_001_EXAMPLES.consent_activation),
      tenant_id: scope.tenant_id,
      subject_ref: {
        ...structuredClone(MISSION_001_EXAMPLES.consent_activation.subject_ref),
        id: scope.profile_id,
        tenant_id: scope.tenant_id,
      },
      effective_at: issuedAt,
      created_at: issuedAt,
      expires_at: expiresAt,
    },
    issued_at: issuedAt,
    review_due_at: expiresAt,
  };
  execution.binding_sha256 = privateLiveProductExecutionBindingDigest(execution);
  return { product, execution };
}

function cohort() {
  return createPrivateRuntimeApprovedProfileCohortV1({
    environmentId,
    cohortId: 'private_beta_initial_cohort_v1',
    cohortRevision: 'private_beta_initial_cohort_revision_v1',
    issuedAt,
    expiresAt,
    members: profileIds.map((profileId, index) => ({
      profile_id: profileId,
      subscriber_subject_ref: `subject_private_beta_${index + 1}`,
      exact_scope: scopeFor(profileId, index + 1),
      business_engine_execution_contract_sha256:
        privateRuntimeBusinessEngineExecutionContractDigest(
          buildBusinessEngineContract(assessmentFor(profileId, index + 1)),
        ),
      approval_ref: `private_beta_approval_${index + 1}`,
    })),
  });
}

function populatedClient(count = profileIds.length) {
  const initial = {};
  for (let index = 0; index < count; index += 1) {
    const profileId = profileIds[index];
    const assessment = assessmentFor(profileId, index + 1);
    initial[`vault:profile:${profileId}`] = JSON.stringify({
      profile_id: profileId,
      canonical_profile_json: { profile_id: profileId },
    });
    initial[`business_assessment_by_profile:${profileId}`] = assessment.assessment_id;
    initial[`business_assessment:${assessment.assessment_id}`] = JSON.stringify(assessment);
  }
  return fakeRedis(initial);
}

test('finite cohort validates exact membership and rejects malformed, duplicate, expired, and revoked input', () => {
  const value = cohort();
  assert.equal(validatePrivateRuntimeApprovedProfileCohortV1(value, {
    environmentId,
    expectedCount: 4,
    nowMs: Date.parse(now),
  }).valid, true);
  for (const mutate of [
    (copy) => { copy.members[1].profile_id = copy.members[0].profile_id; },
    (copy) => { copy.members[0].profile_id = 'mm-*'; },
    (copy) => { copy.expires_at = issuedAt; },
    (copy) => { copy.revoked = true; },
  ]) {
    const altered = structuredClone(value);
    mutate(altered);
    for (const member of altered.members) {
      member.member_sha256 = privateRuntimeApprovedProfileCohortMemberDigest(member);
    }
    altered.cohort_sha256 = privateRuntimeApprovedProfileCohortDigest(altered);
    assert.equal(validatePrivateRuntimeApprovedProfileCohortV1(altered, {
      environmentId,
      expectedCount: 4,
      nowMs: Date.parse(now),
    }).valid, false);
  }
  for (const count of [1, 3, 5, 16]) {
    const altered = structuredClone(value);
    while (altered.members.length < count) {
      const index = altered.members.length + 1;
      const extraProfileId = `mm-20990101-${index.toString(36).padStart(8, '0')}`;
      const extra = {
        ...structuredClone(altered.members[0]),
        profile_id: extraProfileId,
        subscriber_subject_ref: `subject_private_beta_extra_${index}`,
        exact_scope: scopeFor(extraProfileId, index + 10),
        approval_ref: `private_beta_approval_extra_${index}`,
      };
      extra.exact_scope_hash = hashPrivateRuntimeScope(extra.exact_scope);
      extra.member_sha256 = privateRuntimeApprovedProfileCohortMemberDigest(extra);
      altered.members.push(extra);
    }
    altered.members = altered.members.slice(0, count);
    altered.member_count = altered.members.length;
    altered.cohort_sha256 = privateRuntimeApprovedProfileCohortDigest(altered);
    assert.equal(validatePrivateRuntimeApprovedProfileCohortV1(altered, {
      environmentId,
      nowMs: Date.parse(now),
    }).valid, false);
  }
});

test('member projection preserves exact scope, finite cohort, no Coach authority, and valid immutable product contracts', () => {
  const roots = rootBindings();
  const value = cohort();
  for (const profileId of profileIds) {
    const projected = projectPrivateRuntimeCohortMemberBindingsV1({
      cohort: value,
      profileId,
      rootProductBindingAttestation: roots.product,
      rootProductExecutionBinding: roots.execution,
      configurationAuthorityPacketSha256: packetDigest,
      nowMs: Date.parse(now),
    });
    assert.equal(projected.valid, true, JSON.stringify(projected.errors));
    assert.equal(projected.value.product_binding_attestation.exact_scope.profile_id, profileId);
    assert.equal(projected.value.product_binding_attestation.coach_connect_runtime, null);
    assert.deepEqual(
      projected.value.product_execution_binding.approved_profile_ids,
      profileIds,
    );
  }
  assert.equal(projectPrivateRuntimeCohortMemberBindingsV1({
    cohort: value,
    profileId: 'mm-20990101-eeeeeeee',
    rootProductBindingAttestation: roots.product,
    rootProductExecutionBinding: roots.execution,
    configurationAuthorityPacketSha256: packetDigest,
    nowMs: Date.parse(now),
  }).valid, false);
});

test('canonical repository requires both exact cohort membership and a matching BA', async () => {
  const client = populatedClient();
  client.values.delete(`business_assessment_by_profile:${profileIds[3]}`);
  const value = cohort();
  const roots = rootBindings();
  const repository = createSubdev1CanonicalExactProfileRepository({
    readCanonicalProfile: createExactVaultProfileReader({ client }),
    readBusinessAssessment: createExactBusinessAssessmentReader({ client }),
    productBindingAttestation: roots.product,
    productExecutionBinding: roots.execution,
    approvedProfileCohort: value,
    environmentId,
    clock: () => Date.parse(now),
  });
  const options = {
    purpose: 'SUBSCRIPTION_PRIVATE_BETA_OPERATOR_ACCESS',
    mutation_allowed: false,
    enumeration_allowed: false,
  };
  assert.equal((await repository.resolveExactProfile(profileIds[0], options)).status, 'FOUND');
  assert.equal(
    JSON.parse(client.values.get(`vault:profile:${profileIds[3]}`)).profile_id,
    profileIds[3],
  );
  assert.equal((await repository.resolveExactProfile(profileIds[3], options)).status, 'NOT_FOUND');
  assert.equal(
    (await repository.resolveExactProfile('mm-20990101-eeeeeeee', options)).status,
    'NOT_FOUND',
  );

  for (const mutate of [
    (copy) => { copy.revoked = true; },
    (copy) => { copy.expires_at = now; },
  ]) {
    const invalidCohort = structuredClone(value);
    mutate(invalidCohort);
    invalidCohort.cohort_sha256 = privateRuntimeApprovedProfileCohortDigest(invalidCohort);
    const invalidClient = populatedClient();
    const invalidRepository = createSubdev1CanonicalExactProfileRepository({
      readCanonicalProfile: createExactVaultProfileReader({ client: invalidClient }),
      readBusinessAssessment: createExactBusinessAssessmentReader({ client: invalidClient }),
      productBindingAttestation: roots.product,
      productExecutionBinding: roots.execution,
      approvedProfileCohort: invalidCohort,
      environmentId,
      clock: () => Date.parse(now),
    });
    assert.equal(
      (await invalidRepository.resolveExactProfile(profileIds[0], options)).status,
      'NOT_FOUND',
    );
    assert.equal(
      (await invalidRepository.resolveExactProfile('mm-20990101-eeeeeeee', options)).status,
      'NOT_FOUND',
    );
  }
});

test('live attachment adapters resolve only the selected cohort member and never synthesize Coach', async () => {
  const roots = rootBindings();
  const value = cohort();
  const resolveProductBindingAttestation = async (exactScope) => {
    const projected = projectPrivateRuntimeCohortMemberBindingsV1({
      cohort: value,
      profileId: exactScope?.profile_id,
      rootProductBindingAttestation: roots.product,
      rootProductExecutionBinding: roots.execution,
      configurationAuthorityPacketSha256: packetDigest,
      nowMs: Date.parse(now),
    });
    return projected.valid ? projected.value.product_binding_attestation : null;
  };
  const business = createCanonicalBusinessEngineLiveAttachmentAdapterV1({
    productBindingAttestation: roots.product,
    resolveProductBindingAttestation,
    nowMs: Date.parse(now),
  });
  const subscription = createExistingSubscriptionRuntimeLiveAttachmentAdapterV1({
    productBindingAttestation: roots.product,
    resolveProductBindingAttestation,
    nowMs: Date.parse(now),
  });
  for (let index = 0; index < 2; index += 1) {
    const exactScope = scopeFor(profileIds[index], index + 1);
    const engine = await business.lookupCanonicalBusinessEngine(exactScope);
    const runtime = await subscription.resolveExistingSubscriptionRuntime({
      exact_scope: exactScope,
    });
    assert.equal(engine.ok, true);
    assert.equal(engine.engines[0].exact_scope.profile_id, profileIds[index]);
    assert.equal(runtime.ok, true);
    assert.equal(runtime.descriptor.exact_scope.profile_id, profileIds[index]);
    assert.equal(runtime.descriptor.existing_runtime, true);
  }
  const unknown = scopeFor('mm-20990101-eeeeeeee', 5);
  assert.equal((await business.lookupCanonicalBusinessEngine(unknown)).ok, false);
  assert.equal((await subscription.resolveExistingSubscriptionRuntime({
    exact_scope: unknown,
  })).ok, false);
});

test('profile switching closes prior scope, clears state, and invalidates stale receipts', async () => {
  const client = populatedClient();
  const roots = rootBindings();
  const repository = createSubdev1CanonicalExactProfileRepository({
    readCanonicalProfile: createExactVaultProfileReader({ client }),
    readBusinessAssessment: createExactBusinessAssessmentReader({ client }),
    productBindingAttestation: roots.product,
    productExecutionBinding: roots.execution,
    approvedProfileCohort: cohort(),
    environmentId,
    clock: () => Date.parse(now),
  });
  const env = {
    NODE_ENV: 'test',
    MORE_SUBDEV1_OPERATOR_ENABLED: 'true',
    MORE_SUBDEV1_OPERATOR_CODE: 'qualification-code-not-in-browser-source',
    MORE_SUBDEV1_OPERATOR_SIGNING_SECRET:
      'multi-profile-operator-signing-secret-at-least-thirty-two-bytes',
    MORE_SUBDEV1_OPERATOR_ALLOWED_ORIGINS: 'https://private.example.test',
    MORE_SUBDEV1_OPERATOR_ENVIRONMENT_ID: environmentId,
  };
  let token = 0;
  const bridge = createSubdev1OperatorBridge({
    env,
    store: new InMemorySubdev1OperatorBridgeStore(),
    profileRepository: repository,
    clock: () => Date.parse(now),
    randomToken: () => `multi-profile-token-${String(token += 1).padStart(48, '0')}`,
  });
  const request = {
    method: 'POST',
    headers: { origin: 'https://private.example.test' },
  };
  const browser = await bridge.establishBrowser();
  const activationCsrf = await bridge.issueCsrf({ request, browserToken: browser.browser_token });
  const activated = await bridge.activate({
    request,
    browserToken: browser.browser_token,
    csrfProof: activationCsrf.csrf_proof,
    submittedCode: env.MORE_SUBDEV1_OPERATOR_CODE,
  });
  const select = async (profileId) => {
    const csrf = await bridge.issueCsrf({ request, browserToken: browser.browser_token });
    return bridge.selectProfile({
      request,
      browserToken: browser.browser_token,
      contextToken: activated.context_token,
      csrfProof: csrf.csrf_proof,
      profileId,
    });
  };
  const first = await select(profileIds[0]);
  const second = await select(profileIds[1]);
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(second.profile_switch_receipt.prior_profile_session_closed, true);
  assert.equal(second.profile_switch_receipt.profile_scoped_state_cleared_before_resolution, true);
  assert.equal(second.profile_switch_receipt.process_local_profile_cache_used, false);
  assert.equal(
    (await bridge.consume({
      contextToken: activated.context_token,
      browserToken: browser.browser_token,
      action: 'OPEN_SUBSCRIPTION',
      profileReceipt: first.profile_receipt,
    })).allowed,
    false,
  );
  const unknown = await select('mm-20990101-eeeeeeee');
  assert.equal(unknown.allowed, false);
  const inspected = await bridge.inspect({
    contextToken: activated.context_token,
    browserToken: browser.browser_token,
  });
  assert.equal(inspected.profile_state, 'RESOLUTION_DENIED');
  assert.equal(inspected.profile_receipt, null);
});

test('cohort execution uses separate append-only namespaces and restores each selected profile', async () => {
  const client = populatedClient();
  const roots = rootBindings();
  const value = cohort();
  const resolveMemberBindings = async (profileId) =>
    projectPrivateRuntimeCohortMemberBindingsV1({
      cohort: value,
      profileId,
      rootProductBindingAttestation: roots.product,
      rootProductExecutionBinding: roots.execution,
      configurationAuthorityPacketSha256: packetDigest,
      nowMs: Date.parse(now),
    });
  const execution = createPrivateRuntimeCohortIntelligenceExecutionV1({
    client,
    namespacePrefix: roots.execution.persistence_namespace_prefix,
    resolveMemberBindings,
    clock: () => now,
  });
  const run = async (profileId, operation, idempotency) => {
    const projected = await resolveMemberBindings(profileId);
    const binding = projected.value.product_execution_binding;
    return execution.execute({
      operation,
      request: { exact_scope: binding.exact_scope, intelligence_input: null },
      requestContext: {
        exact_scope_hash: binding.exact_scope_hash,
        idempotency_ref: idempotency,
        correlation_ref: `correlation_${idempotency}`,
      },
      authority: {
        allowed: true,
        authority_fingerprint: `authority_${idempotency}`,
        subscriber_subject_ref: projected.value.member.subscriber_subject_ref,
      },
      attachmentSet: { runtime_ready: true },
    });
  };
  const first = await run(profileIds[0], 'BOOTSTRAP', 'bootstrap_a');
  const second = await run(profileIds[1], 'BOOTSTRAP', 'bootstrap_b');
  const reloadFirst = await run(profileIds[0], 'RELOAD', 'reload_a');
  const reloadSecond = await run(profileIds[1], 'RELOAD', 'reload_b');
  for (const [index, response] of [first, second, reloadFirst, reloadSecond].entries()) {
    assert.equal(
      response.ok,
      true,
      `${index}:${JSON.stringify(response.execution_failure)}`,
    );
    assert.equal(response.runtime_ready, true);
    assert.equal(response.process_local_profile_cache_used, false);
    assert.equal(response.projections.five_futures.length, 5);
    assert.ok(response.projections.one_move);
  }
  assert.notEqual(first.cohort_scope_hash, second.cohort_scope_hash);
  assert.equal(reloadFirst.cohort_scope_hash, first.cohort_scope_hash);
  assert.equal(reloadSecond.cohort_scope_hash, second.cohort_scope_hash);
  const rootsUsed = [...client.values.keys()]
    .filter((key) => key.includes(':records:projection:sequence'));
  assert.equal(rootsUsed.length, 2);
  assert.equal(new Set(rootsUsed.map((key) => key.split(':records:')[0])).size, 2);
});
