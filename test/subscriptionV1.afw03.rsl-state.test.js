import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EphemeralTranscriptBuffer,
  InMemoryPersonalRslStore,
  InMemoryUniversalCandidateCapture,
  assembleCoachingStatePacket,
  createSubscriptionV1PersistenceBoundary,
  createPersonalRslEvent,
  retrieveRelevantPersonalHistory,
  subscriptionV1OpaqueKeys,
} from '../src/lib/subscriptionV1/index.js';
import {
  TEST_TIME,
  testArtifacts,
  testAuthority,
  testBusinessTruth,
  testRslEvent,
  testScope,
  testWholePersonContext,
} from './subscriptionV1.testFixtures.js';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';

const scope = testScope();
const appendedAt = '2026-08-10T00:02:00.000Z';

function storeWithOneEvent() {
  const store = new InMemoryPersonalRslStore();
  const created = testRslEvent(scope);
  assert.equal(created.ok, true, created.code);
  assert.equal(store.append({ scope, event: created.event, appended_at: appendedAt }).ok, true);
  return { store, event: created.event };
}

function openPlanArtifacts(scopeOverrides = {}, mutate = () => {}, authorityClass = 'synthetic') {
  const synthetic = authorityClass === 'synthetic';
  const openPlanScope = testScope({
    ...(synthetic ? { tenant_id: 'synthetic_qa' } : {}),
    ...scopeOverrides,
  });
  const artifacts = testArtifacts(openPlanScope);
  const verticalBindingHash = 'b'.repeat(64);
  const completenessPolicy = synthetic
    ? 'SYNTHETIC_QA_RELEASE_4_LO_OPEN_PLAN'
    : 'CANONICAL_PAID_LO_OPEN_PLAN';
  const authoritySource = synthetic
    ? 'CANONICAL_SYNTHETIC_QA_PROFILE_COMPLETED_REALIZATION'
    : 'CANONICAL_OWNED_PROFILE_COMPLETED_REALIZATION';
  const baIndex = artifacts.findIndex(({ artifact_type: artifactType }) => artifactType === 'NEW_BA');
  artifacts[baIndex] = {
    ...artifacts[baIndex],
    bindings: {
      ...artifacts[baIndex].bindings,
      vertical_id: 'loan_originator',
      vertical_binding_hash: verticalBindingHash,
      completeness_policy: completenessPolicy,
    },
    domain_boundary: {
      source: authoritySource,
      raw_profile_forwarded: false,
    },
  };
  const planIndex = artifacts.findIndex(({ artifact_type: artifactType }) => artifactType === 'PLAN_135');
  const current = artifacts[planIndex];
  const payload = {
    contract_id: 'generalized-1-3-5-plan-v1',
    version: '1.0.0',
    plan_state: 'LO_OPEN_DRAFT',
    bindings: { verticalId: 'loan_originator' },
    ways: [1, 2, 3].map((position) => ({
      way_id: `way-${position}`,
      status: 'OPEN',
      title: null,
      destination_state: null,
      strategies: [],
      open_strategy_positions: 5,
    })),
    strategies: [],
    open_strategy_positions: 15,
    one_move: {
      status: 'ALONGSIDE_PLAN_NOT_A_STRATEGY',
      proposal_status: 'PROPOSED_NOT_CUSTOMER_AGREED',
    },
    customer_boundary: {
      proposed_plan_not_customer_commitment: true,
      customer_agreed: false,
      all_ways_intentionally_open: true,
      subscription_runtime_active: false,
    },
    validation: {
      selected_way_count: 0,
      strategy_count: 0,
      open_strategy_positions: 15,
    },
  };
  const sourceHash = 'c'.repeat(64);
  const openPlan = {
    ...current,
    status: 'OPEN_NOT_CUSTOMER_AGREED',
    validation_status: 'PASS_WITH_OPEN_PLAN',
    compatibility_status: 'COMPATIBLE',
    domain_boundary: {
      source: authoritySource,
      raw_profile_forwarded: false,
    },
    bindings: {
      ...current.bindings,
      vertical_id: 'loan_originator',
      vertical_binding_hash: verticalBindingHash,
      completeness_policy: completenessPolicy,
      plan_state: 'LO_OPEN_DRAFT',
      customer_plan_status: 'OPEN_NOT_CUSTOMER_AGREED',
      customer_plan_complete: false,
    },
    authority: {
      authority_id: 'canonical_real_profile_plan_135',
      authority_version: current.version,
      authority_hash: sourceHash,
    },
    content_hash: hashCanonicalJson({
      contract: 'paid-subscriber-canonical-artifact-projection-v1',
      artifact_type: 'PLAN_135',
      source_sha256: sourceHash,
      payload,
    }),
    payload,
  };
  mutate(openPlan);
  artifacts[planIndex] = openPlan;
  return { artifacts, scope: openPlanScope, plan: openPlan };
}

const syntheticOpenPlanArtifacts = (scopeOverrides = {}, mutate = () => {}) => (
  openPlanArtifacts(scopeOverrides, mutate, 'synthetic')
);

const paidOpenPlanArtifacts = (scopeOverrides = {}, mutate = () => {}) => (
  openPlanArtifacts(scopeOverrides, mutate, 'paid')
);

function assembleSyntheticOpenPlan({ artifacts, scope }) {
  const store = new InMemoryPersonalRslStore();
  const created = testRslEvent(scope);
  assert.equal(created.ok, true, created.code);
  assert.equal(store.append({ scope, event: created.event, appended_at: appendedAt }).ok, true);
  const history = retrieveRelevantPersonalHistory({
    store,
    scope,
    purpose: 'WEEKLY_COACHING',
    active_lens: 'PLAN',
    as_of_at: TEST_TIME,
  });
  return assembleCoachingStatePacket({
    scope,
    session_id: 'session_fixture_alpha',
    purpose: 'WEEKLY_COACHING',
    active_lens: 'PLAN',
    artifacts,
    personal_history: history,
    business_truth: testBusinessTruth(),
    whole_person_execution_context: testWholePersonContext(),
    assembled_at: TEST_TIME,
  });
}

test('AFW-03 Personal RSL rejects raw transcripts and coach-authored canonical truth', () => {
  const raw = testRslEvent(scope, { event_id: 'rsl_event_raw_transcript', semantic_payload: { raw_transcript: 'customer said this' } });
  assert.equal(raw.ok, false);
  assert.equal(raw.code, 'RAW_TRANSCRIPT_NOT_CANONICAL');
  const coachTruth = testRslEvent(scope, {
    event_id: 'rsl_event_coach_truth',
    source_class: 'SUBSCRIPTION_COACH_PROPOSAL',
    actor: { actor_type: 'SUBSCRIPTION_COACH', actor_ref: 'subscription_coach_v1' },
  });
  assert.equal(coachTruth.ok, false);
  assert.equal(coachTruth.code, 'COACH_PROPOSAL_CANNOT_ESTABLISH_CANONICAL_TRUTH');
  const coachQuestion = testRslEvent(scope, {
    event_id: 'rsl_event_coach_question',
    event_type: 'QUESTION',
    source_class: 'SUBSCRIPTION_COACH_PROPOSAL',
    actor: { actor_type: 'SUBSCRIPTION_COACH', actor_ref: 'subscription_coach_v1' },
    confirmation_event_id: null,
  });
  assert.equal(coachQuestion.ok, true);
});

test('AFW-03 production persistence boundary is opaque, adapter-shaped and default-off', async () => {
  const keys = subscriptionV1OpaqueKeys(scope);
  const serialized = JSON.stringify(keys);
  for (const raw of Object.values(scope)) assert.equal(serialized.includes(raw), false);
  const boundary = createSubscriptionV1PersistenceBoundary();
  assert.equal(boundary.inspect().enabled, false);
  assert.equal(boundary.inspect().raw_identity_in_keys, false);
  assert.equal((await boundary.appendPersonalRsl({})).code, 'SUBSCRIPTION_V1_DURABLE_PERSISTENCE_DEFAULT_OFF');
  assert.equal((await boundary.retrieveUniversalForCustomerRuntime()).code, 'UNIVERSAL_RSL_RUNTIME_READ_DISABLED');
});

test('AFW-03 append-only hash chain, corrections, retractions and bitemporal replay are deterministic', () => {
  const { store, event } = storeWithOneEvent();
  const correction = testRslEvent(scope, {
    event_id: 'rsl_event_correction_alpha',
    event_type: 'CORRECTION',
    effective_at: '2026-08-10T00:00:00.000Z',
    recorded_at: '2026-08-12T00:00:00.000Z',
    supersedes_event_ids: [event.event_id],
    semantic_payload: { lens: 'WHERE_YOU_ARE', statement: 'Corrected governed fact', privacy_classification: 'TENANT_PRIVATE' },
  });
  assert.equal(store.append({ scope, event: correction.event, appended_at: '2026-08-12T00:01:00.000Z' }).ok, true);
  const beforeCorrectionKnown = store.replay({ scope, effective_as_of: '2026-08-11T00:00:00.000Z', recorded_as_of: '2026-08-11T00:00:00.000Z' });
  assert.deepEqual(beforeCorrectionKnown.state.active_events.map((item) => item.event_id), [event.event_id]);
  const afterCorrectionKnown = store.replay({ scope, effective_as_of: '2026-08-13T00:00:00.000Z', recorded_as_of: '2026-08-13T00:00:00.000Z' });
  assert.deepEqual(afterCorrectionKnown.state.active_events.map((item) => item.event_id), [correction.event.event_id]);
  const retraction = testRslEvent(scope, {
    event_id: 'rsl_event_retraction_alpha',
    event_type: 'RETRACTION',
    effective_at: '2026-08-14T00:00:00.000Z',
    recorded_at: '2026-08-14T00:01:00.000Z',
    retracts_event_ids: [correction.event.event_id],
    semantic_payload: { reason: 'Customer retracted the corrected assertion', privacy_classification: 'TENANT_PRIVATE' },
  });
  assert.equal(store.append({ scope, event: retraction.event, appended_at: '2026-08-14T00:02:00.000Z' }).ok, true);
  const afterRetraction = store.replay({ scope, effective_as_of: TEST_TIME, recorded_as_of: TEST_TIME });
  assert.deepEqual(afterRetraction.state.active_events, []);
  assert.equal(store.verify({ scope }).code, 'PERSONAL_RSL_HASH_CHAIN_VALID');
  assert.equal(store.replay({ scope, effective_as_of: TEST_TIME, recorded_as_of: TEST_TIME }).replay_hash, afterRetraction.replay_hash);
});

test('AFW-03 cross-business replacement references and exact-scope reads fail closed', () => {
  const { store, event } = storeWithOneEvent();
  const otherScope = testScope({ membership_id: 'membership_test_beta', profile_id: 'MM-TEST-PROFILE-BETA', business_id: 'business_test_beta' });
  const crossReference = testRslEvent(otherScope, {
    event_id: 'rsl_event_cross_reference',
    event_type: 'CORRECTION',
    supersedes_event_ids: [event.event_id],
  });
  assert.equal(store.append({ scope: otherScope, event: crossReference.event, appended_at: appendedAt }).code, 'PERSONAL_RSL_REFERENCE_SCOPE_OR_ID_INVALID');
  assert.equal(store.read({ scope: otherScope }).records.length, 0);
});

test('AFW-03 retrieval is scope-first, purpose-bounded, deterministic and method-extensible', () => {
  const { store } = storeWithOneEvent();
  const planEvent = testRslEvent(scope, {
    event_id: 'rsl_event_plan_change',
    event_type: 'PLAN_CHANGE',
    effective_at: '2026-08-17T00:00:00.000Z',
    recorded_at: '2026-08-17T00:01:00.000Z',
    semantic_payload: { lens: 'PLAN', purpose: 'FINISH_PLAN_135', statement: 'Plan fixture', privacy_classification: 'TENANT_PRIVATE' },
  });
  store.append({ scope, event: planEvent.event, appended_at: '2026-08-17T00:02:00.000Z' });
  const input = { store, scope, purpose: 'FINISH_PLAN_135', active_lens: 'PLAN', topics: ['plan'], as_of_at: TEST_TIME };
  const first = retrieveRelevantPersonalHistory(input);
  const second = retrieveRelevantPersonalHistory(input);
  assert.equal(first.ok, true);
  assert.equal(first.result.scope_filter_applied_first, true);
  assert.equal(first.result.selected_event_ids[0], planEvent.event.event_id);
  assert.equal(first.result.result_hash, second.result.result_hash);
  assert.deepEqual(first.result.future_ranking_methods_after_scope_filter, ['SEMANTIC_RERANK_AFTER_SCOPE_FILTER', 'HYBRID_RERANK_AFTER_SCOPE_FILTER']);
  assert.deepEqual(first.universal_patterns, []);
  assert.deepEqual(first.governed_external_evidence, []);
});

test('AFW-03 state assembler selects newest compatible authorities and preserves domain boundaries', () => {
  const { store } = storeWithOneEvent();
  const history = retrieveRelevantPersonalHistory({ store, scope, purpose: 'WEEKLY_COACHING', active_lens: 'WHERE_YOU_ARE', as_of_at: TEST_TIME });
  const artifacts = testArtifacts(scope);
  const staleBos = { ...artifacts.find((item) => item.artifact_type === 'NEW_BOS'), artifact_id: 'new_bos_stale', version: '0.9.0', created_at: '2026-08-01T00:00:00.000Z' };
  const incompatibleBos = { ...artifacts.find((item) => item.artifact_type === 'NEW_BOS'), artifact_id: 'new_bos_incompatible_newer', version: '2.0.0', created_at: '2026-08-19T00:00:00.000Z', compatibility_status: 'INCOMPATIBLE' };
  const result = assembleCoachingStatePacket({
    scope,
    session_id: 'session_fixture_alpha',
    purpose: 'WEEKLY_COACHING',
    active_lens: 'WHERE_YOU_ARE',
    artifacts: [...artifacts, staleBos, incompatibleBos],
    personal_history: history,
    business_truth: testBusinessTruth(),
    whole_person_execution_context: testWholePersonContext(),
    uncertainty: ['A governed fixture uncertainty'],
    current_state: { view: 'synthetic-current-state' },
    assembled_at: TEST_TIME,
  });
  assert.equal(result.ok, true, result.code);
  assert.equal(result.packet.artifact_lineage.length, 8);
  assert.equal(result.selection_receipt.NEW_BOS.selected_artifact_id, artifacts.find((item) => item.artifact_type === 'NEW_BOS').artifact_id);
  assert.equal(result.selection_receipt.NEW_BOS.rejected_artifact_ids.includes(incompatibleBos.artifact_id), true);
  assert.equal(result.domain_boundary.personality_as_business_cause_allowed, false);
  assert.equal(result.provider_execution, 'NOT_IMPLEMENTED_STOP_BEFORE_AFW_04');
  assert.equal(result.coaching_doctrine_insertion_point.implementation_status, 'RESERVED_FOR_AFW_04');
});

test('AFW-03 accepts the exact synthetic LO open plan without inflating its customer-agreement status', () => {
  const fixture = syntheticOpenPlanArtifacts();
  const result = assembleSyntheticOpenPlan(fixture);
  assert.equal(result.ok, true, result.code);
  assert.equal(result.selection_receipt.PLAN_135.selected_artifact_id, fixture.plan.artifact_id);
  const selectedLineage = result.packet.artifact_lineage.find(({ artifact_type: artifactType }) => artifactType === 'PLAN_135');
  assert.equal(selectedLineage.content_hash, fixture.plan.content_hash);
  assert.equal(fixture.plan.status, 'OPEN_NOT_CUSTOMER_AGREED');
  assert.equal(fixture.plan.validation_status, 'PASS_WITH_OPEN_PLAN');
  assert.equal(fixture.plan.payload.customer_boundary.customer_agreed, false);
  assert.equal(fixture.plan.payload.strategies.length, 0);
});

test('AFW-03 accepts exact canonical paid LO open plans but rejects paid/synthetic authority crossover', () => {
  const paid = paidOpenPlanArtifacts();
  const accepted = assembleSyntheticOpenPlan(paid);
  assert.equal(accepted.ok, true, accepted.code);
  assert.equal(accepted.selection_receipt.PLAN_135.selected_artifact_id, paid.plan.artifact_id);
  assert.equal(paid.plan.payload.customer_boundary.customer_agreed, false);

  for (const [label, mutate] of [
    ['paid using synthetic policy', (fixture) => {
      fixture.plan.bindings.completeness_policy = 'SYNTHETIC_QA_RELEASE_4_LO_OPEN_PLAN';
      fixture.artifacts.find(({ artifact_type: type }) => type === 'NEW_BA').bindings.completeness_policy = 'SYNTHETIC_QA_RELEASE_4_LO_OPEN_PLAN';
    }],
    ['synthetic using paid policy', (fixture) => {
      fixture.plan.bindings.completeness_policy = 'CANONICAL_PAID_LO_OPEN_PLAN';
      fixture.artifacts.find(({ artifact_type: type }) => type === 'NEW_BA').bindings.completeness_policy = 'CANONICAL_PAID_LO_OPEN_PLAN';
    }],
  ]) {
    const fixture = label.startsWith('paid') ? paidOpenPlanArtifacts() : syntheticOpenPlanArtifacts();
    mutate(fixture);
    const result = assembleSyntheticOpenPlan(fixture);
    assert.equal(result.ok, false, label);
    assert.equal(result.code, 'NEWEST_COMPATIBLE_ARTIFACT_MISSING', label);
  }
});

test('AFW-03 rejects every incomplete or inflated synthetic LO open-plan boundary and never falls back to stale completion', () => {
  const mutations = [
    ['ordinary tenant', (_plan, fixture) => {
      fixture.scope.tenant_id = 'tenant_test';
      fixture.artifacts.forEach((artifact) => { artifact.scope.tenant_id = 'tenant_test'; });
    }],
    ['source authority', (plan) => { plan.domain_boundary.source = 'UNVERIFIED_SYNTHETIC_SOURCE'; }],
    ['vertical marker', (plan) => { plan.bindings.vertical_id = 'real_estate'; }],
    ['vertical hash', (plan) => { plan.bindings.vertical_binding_hash = 'd'.repeat(64); }, 'PLAN_VERTICAL_AUTHORITY_BINDING_INVALID'],
    ['completeness policy', (plan) => { plan.bindings.completeness_policy = 'COMPLETE_ONLY'; }],
    ['plan state binding', (plan) => { plan.bindings.plan_state = 'COMPLETE'; }],
    ['customer plan status', (plan) => { plan.bindings.customer_plan_status = 'COMPLETE'; }],
    ['customer complete flag', (plan) => { plan.bindings.customer_plan_complete = true; }],
    ['payload vertical', (plan) => { plan.payload.bindings.verticalId = 'real_estate'; }],
    ['way completeness', (plan) => { plan.payload.ways[0].status = 'SELECTED_COMPLETE'; }],
    ['strategy inflation', (plan) => { plan.payload.strategies.push({ strategy_id: 'not-customer-agreed' }); }],
    ['customer agreement', (plan) => { plan.payload.customer_boundary.customer_agreed = true; }],
    ['one move inflation', (plan) => { plan.payload.one_move.proposal_status = 'CUSTOMER_AGREED'; }],
    ['validation inflation', (plan) => { plan.payload.validation.selected_way_count = 1; }],
    ['authority id', (plan) => { plan.authority.authority_id = 'foreign_plan_authority'; }],
    ['authority hash', (plan) => { plan.authority.authority_hash = 'd'.repeat(64); }],
    ['content hash', (plan) => { plan.content_hash = 'd'.repeat(64); }],
    ['BA vertical authority', (_plan, fixture) => {
      fixture.artifacts.find(({ artifact_type: artifactType }) => artifactType === 'NEW_BA').bindings.vertical_id = 'real_estate';
    }, 'PLAN_VERTICAL_AUTHORITY_BINDING_INVALID'],
    ['compatibility', (plan) => { plan.compatibility_status = 'INCOMPATIBLE'; }],
    ['top-level completion inflation', (plan) => {
      plan.status = 'COMPLETE';
      plan.validation_status = 'PASS';
    }],
  ];
  for (const [label, mutate, expectedCode = 'NEWEST_COMPATIBLE_ARTIFACT_MISSING'] of mutations) {
    const fixture = syntheticOpenPlanArtifacts();
    mutate(fixture.plan, fixture);
    const staleComplete = {
      ...testArtifacts(fixture.scope).find(({ artifact_type: artifactType }) => artifactType === 'PLAN_135'),
      artifact_id: `stale_complete_${label.replaceAll(' ', '_')}`,
      created_at: '2026-08-01T00:00:00.000Z',
    };
    const result = assembleSyntheticOpenPlan({ ...fixture, artifacts: [...fixture.artifacts, staleComplete] });
    assert.equal(result.ok, false, label);
    assert.equal(result.code, expectedCode, label);
    if (expectedCode === 'NEWEST_COMPATIBLE_ARTIFACT_MISSING') {
      assert.equal(result.artifact_type, 'PLAN_135', label);
    }
  }
});

test('AFW-03 selects a newer exact synthetic LO open plan over an older completed plan', () => {
  const fixture = syntheticOpenPlanArtifacts();
  fixture.plan.created_at = '2026-08-19T00:00:00.000Z';
  const staleComplete = {
    ...testArtifacts(fixture.scope).find(({ artifact_type: artifactType }) => artifactType === 'PLAN_135'),
    artifact_id: 'plan_135_stale_complete',
    created_at: '2026-08-01T00:00:00.000Z',
  };
  const result = assembleSyntheticOpenPlan({ ...fixture, artifacts: [...fixture.artifacts, staleComplete] });
  assert.equal(result.ok, true, result.code);
  assert.equal(result.selection_receipt.PLAN_135.selected_artifact_id, fixture.plan.artifact_id);
  assert.deepEqual(result.selection_receipt.PLAN_135.rejected_artifact_ids, [staleComplete.artifact_id]);
});

test('AFW-03 lets a newer customer-agreed plan supersede an older exact LO open draft', () => {
  const fixture = syntheticOpenPlanArtifacts();
  fixture.plan.created_at = '2026-08-01T00:00:00.000Z';
  const completedPlan = {
    ...testArtifacts(fixture.scope).find(({ artifact_type: artifactType }) => artifactType === 'PLAN_135'),
    artifact_id: 'plan_135_customer_agreed_newer',
    created_at: '2026-08-19T00:00:00.000Z',
    supersedes_artifact_id: fixture.plan.artifact_id,
    domain_boundary: { ...fixture.plan.domain_boundary },
    bindings: {
      ...testArtifacts(fixture.scope).find(({ artifact_type: artifactType }) => artifactType === 'PLAN_135').bindings,
      vertical_id: 'loan_originator',
      vertical_binding_hash: fixture.plan.bindings.vertical_binding_hash,
      completeness_policy: fixture.plan.bindings.completeness_policy,
      plan_state: 'CUSTOMER_AGREED',
      customer_plan_status: 'CUSTOMER_AGREED',
      customer_plan_complete: true,
    },
    payload: {
      plan_state: 'CUSTOMER_AGREED',
      customer_boundary: { customer_agreed: true },
      one_move: { proposal_status: 'CUSTOMER_AGREED' },
    },
  };
  const result = assembleSyntheticOpenPlan({
    ...fixture,
    artifacts: [...fixture.artifacts, completedPlan],
  });
  assert.equal(result.ok, true, result.code);
  assert.equal(result.selection_receipt.PLAN_135.selected_artifact_id, completedPlan.artifact_id);
  assert.deepEqual(result.selection_receipt.PLAN_135.rejected_artifact_ids, [fixture.plan.artifact_id]);
});

test('AFW-03 denies an unproven completed-plan transition instead of falling back to its older LO draft', () => {
  const mutations = [
    ['false agreement', (plan) => { plan.payload.customer_boundary.customer_agreed = false; }],
    ['missing agreement', (plan) => { delete plan.payload.customer_boundary.customer_agreed; }],
    ['wrong predecessor', (plan) => { plan.supersedes_artifact_id = 'different_open_plan'; }],
    ['missing predecessor', (plan) => { plan.supersedes_artifact_id = null; }],
  ];
  for (const [label, mutate] of mutations) {
    const fixture = syntheticOpenPlanArtifacts();
    fixture.plan.created_at = '2026-08-01T00:00:00.000Z';
    const completedPlan = {
      ...testArtifacts(fixture.scope).find(({ artifact_type: artifactType }) => artifactType === 'PLAN_135'),
      artifact_id: `plan_135_unproven_${label.replaceAll(' ', '_')}`,
      created_at: '2026-08-19T00:00:00.000Z',
      supersedes_artifact_id: fixture.plan.artifact_id,
      domain_boundary: { ...fixture.plan.domain_boundary },
      bindings: {
        ...testArtifacts(fixture.scope).find(({ artifact_type: artifactType }) => artifactType === 'PLAN_135').bindings,
        vertical_id: 'loan_originator',
        vertical_binding_hash: fixture.plan.bindings.vertical_binding_hash,
        completeness_policy: fixture.plan.bindings.completeness_policy,
        plan_state: 'CUSTOMER_AGREED',
        customer_plan_status: 'CUSTOMER_AGREED',
        customer_plan_complete: true,
      },
      payload: {
        plan_state: 'CUSTOMER_AGREED',
        customer_boundary: { customer_agreed: true },
        one_move: { proposal_status: 'CUSTOMER_AGREED' },
      },
    };
    mutate(completedPlan);
    const result = assembleSyntheticOpenPlan({
      ...fixture,
      artifacts: [...fixture.artifacts, completedPlan],
    });
    assert.equal(result.ok, false, label);
    assert.equal(result.code, 'NEWEST_COMPATIBLE_ARTIFACT_MISSING', label);
    assert.equal(result.artifact_type, 'PLAN_135', label);
  }
});

test('AFW-03 reports a missing PLAN_135 through the governed fail-closed receipt', () => {
  const fixture = syntheticOpenPlanArtifacts();
  const result = assembleSyntheticOpenPlan({
    ...fixture,
    artifacts: fixture.artifacts.filter(({ artifact_type: artifactType }) => artifactType !== 'PLAN_135'),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'NEWEST_COMPATIBLE_ARTIFACT_MISSING');
  assert.equal(result.artifact_type, 'PLAN_135');
});

test('AFW-03 state assembler rejects cross-profile, exact-100 and causal-boundary violations', () => {
  const { store } = storeWithOneEvent();
  const history = retrieveRelevantPersonalHistory({ store, scope, purpose: 'WEEKLY_COACHING', active_lens: 'OVERVIEW', as_of_at: TEST_TIME });
  const base = {
    scope, session_id: 'session_fixture_alpha', purpose: 'WEEKLY_COACHING', active_lens: 'OVERVIEW', personal_history: history,
    business_truth: testBusinessTruth(), whole_person_execution_context: testWholePersonContext(), assembled_at: TEST_TIME,
  };
  const cross = testArtifacts(scope);
  cross[0] = { ...cross[0], scope: { ...scope, profile_id: 'MM-CROSS-PROFILE' } };
  assert.equal(assembleCoachingStatePacket({ ...base, artifacts: cross }).code, 'CROSS_SCOPE_ARTIFACT_DENIED');
  const badWeights = testArtifacts(scope);
  const futuresIndex = badWeights.findIndex((item) => item.artifact_type === 'FIVE_FUTURES_V2');
  badWeights[futuresIndex] = { ...badWeights[futuresIndex], payload: { trajectories: [27, 15, 20, 12, 25].map((relative_support_weight) => ({ relative_support_weight })) } };
  assert.equal(assembleCoachingStatePacket({ ...base, artifacts: badWeights }).code, 'FIVE_FUTURES_EXACT_100_INVALID');
  const badBoundary = testArtifacts(scope);
  const wbmIndex = badBoundary.findIndex((item) => item.artifact_type === 'WHOLE_BUSINESS_MODEL_V1');
  badBoundary[wbmIndex] = { ...badBoundary[wbmIndex], domain_boundary: { business_causes: 'PERSONALITY_CAUSES_BUSINESS', whole_person_role: 'CAUSE' } };
  assert.equal(assembleCoachingStatePacket({ ...base, artifacts: badBoundary }).code, 'WBM_DOMAIN_BOUNDARY_INVALID');
});

test('AFW-03 Universal candidate capture includes adverse outcomes while read and promotion remain off', () => {
  const capture = new InMemoryUniversalCandidateCapture();
  for (const direction of ['POSITIVE', 'NEGATIVE', 'NEUTRAL', 'UNRESOLVED', 'CONFOUNDED']) {
    const outcome = testRslEvent(scope, {
      event_id: `rsl_outcome_${direction.toLowerCase()}`,
      event_type: 'OUTCOME',
      semantic_payload: { outcome_direction: direction, observation_window: '30 days', privacy_classification: 'TENANT_PRIVATE' },
    });
    const result = capture.capture({
      scope,
      source_events: [outcome.event],
      condition: { condition_class: 'fixture' },
      intervention: { intervention_class: 'fixture' },
      execution_context: { context_class: 'fixture' },
      outcome: { observed: direction },
      outcome_direction: direction,
      validation_state: direction === 'CONFOUNDED' ? 'CONFOUNDED' : 'PENDING',
      confounders: direction === 'CONFOUNDED' ? ['fixture confounder'] : [],
      falsifiers: ['fixture falsifier'],
      created_at: TEST_TIME,
    });
    assert.equal(result.ok, true, result.code);
    assert.equal(result.candidate.state, 'PERSONAL_ONLY');
    assert.equal(result.customer_runtime_eligible, false);
  }
  assert.equal(capture.inspectPrivate({ scope }).candidates.length, 5);
  assert.equal(capture.retrieveForCustomerRuntime().code, 'UNIVERSAL_RSL_RUNTIME_READ_DISABLED');
  assert.equal(capture.promote().code, 'UNIVERSAL_RSL_PROMOTION_DISABLED');
});

test('AFW-03 ten-year structural replay remains bounded and transcript-independent', () => {
  const store = new InMemoryPersonalRslStore();
  for (let year = 2016; year <= 2026; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      if (year === 2026 && month > 8) break;
      const stamp = `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`;
      const event = createPersonalRslEvent({
        event_id: `rsl_ten_year_${year}_${String(month).padStart(2, '0')}`,
        scope,
        session_id: `session_${year}_${String(month).padStart(2, '0')}`,
        event_type: month % 3 === 0 ? 'OUTCOME' : 'STATE_CHANGE',
        effective_at: stamp,
        recorded_at: stamp,
        source_class: 'DETERMINISTIC_RUNTIME',
        actor: { actor_type: 'DETERMINISTIC_RUNTIME', actor_ref: 'ten_year_fixture_runtime' },
        establishing_authority: testAuthority('ten_year_fixture_authority'),
        semantic_payload: { lens: month % 2 ? 'WHERE_YOU_ARE' : 'EVIDENCE', year, month, privacy_classification: 'TENANT_PRIVATE' },
        evidence_refs: testBusinessTruth(),
        supersedes_event_ids: [],
        retracts_event_ids: [],
        confirmation_event_id: null,
      });
      assert.equal(event.ok, true, event.code);
      assert.equal(store.append({ scope, event: event.event, appended_at: stamp }).ok, true);
    }
  }
  const replay = store.replay({ scope, effective_as_of: TEST_TIME, recorded_as_of: TEST_TIME });
  assert.equal(replay.state.active_events.length, 128);
  const history = retrieveRelevantPersonalHistory({ store, scope, purpose: 'EVIDENCE_REVIEW', active_lens: 'EVIDENCE', topics: ['2026'], as_of_at: TEST_TIME });
  assert.equal(history.ok, true);
  assert.equal(history.result.selected_event_ids.length <= 40, true);
  assert.equal(history.result.token_estimate <= 6000, true);
  const buffer = new EphemeralTranscriptBuffer();
  buffer.push({ role: 'customer', content: 'ephemeral only' });
  const before = replay.replay_hash;
  buffer.clear();
  assert.equal(store.replay({ scope, effective_as_of: TEST_TIME, recorded_as_of: TEST_TIME }).replay_hash, before);
  assert.equal(store.planDeletion({ scope, actor_ref: scope.subject_id, requested_at: TEST_TIME }).destructive_action_performed, false);
  assert.equal(store.planExport({ scope, actor_ref: scope.subject_id, requested_at: TEST_TIME }).raw_transcript_included, false);
});
