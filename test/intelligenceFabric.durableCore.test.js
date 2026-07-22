import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DURABLE_CONTRACT_REGISTRY, DURABLE_OBJECT_TYPES, MISSION_002_CONTRACT_FIXTURES, MISSION_002_FIXTURES,
  buildDurableObject, canonicalJson, safeDurableSummary, validateAnonymizedAggregate,
  validateAuthorityConflictGraph, validateBeliefState, validateBusinessEngineState,
  validateBusinessStateSeparation, validateConversationEvent, validateCrossObjectInvariants,
  validateDurableObject, validateFutureProbabilityChange, validateFutureSet,
  validateHumanJudgmentAuthority, validateInterventionTransition, validateLearningPromotionRecord,
  validateLearningTransition, validateOutcomeValidationLedger, validateRealEstateKnowledgeGraph,
  validateUserEvidenceLedger, validateUserIntentState, validateVersionTransition,
} from '../src/lib/intelligenceFabric/index.js';

test('all 23 durable and supporting contracts validate and deep-freeze', () => {
  assert.equal(DURABLE_OBJECT_TYPES.length, 23);
  for (const name of DURABLE_OBJECT_TYPES) {
    const fixture = MISSION_002_CONTRACT_FIXTURES[name];
    assert.ok(fixture, `fixture missing for ${name}`);
    const result = validateDurableObject(fixture, name);
    assert.equal(result.valid, true, `${name}: ${JSON.stringify(result.errors)}`);
    const built = buildDurableObject(name, fixture);
    assert.equal(built.validation.valid, true);
    assert.equal(Object.isFrozen(built.value), true);
  }
});

test('registry names, authority, truth, and versions match all public contracts', () => {
  assert.deepEqual(Object.keys(DURABLE_CONTRACT_REGISTRY).sort(), [...DURABLE_OBJECT_TYPES].sort());
  for (const entry of Object.values(DURABLE_CONTRACT_REGISTRY)) assert.equal(entry.contract_version, '1.0.0');
});

test('truth classes and authorities cannot be relabeled', () => {
  assert.equal(validateUserIntentState({ ...MISSION_002_FIXTURES.complete_user_intent_state, truth_class: 'OBSERVED_TRUTH' }).valid, false);
  assert.equal(validateUserEvidenceLedger({ ...MISSION_002_FIXTURES.weekly_real_estate_evidence_ledger, authority_type: 'USER_DIRECTION' }).valid, false);
});

test('inferred user intent requires confirmation', () => {
  const inferred = { ...MISSION_002_FIXTURES.complete_user_intent_state, inferred: true, confirmation_state: 'AWAITING_USER_CONFIRMATION' };
  assert.equal(validateUserIntentState(inferred).valid, false);
  assert.equal(validateUserIntentState({ ...inferred, confirmation_state: 'USER_CONFIRMED' }).valid, true);
});

test('evidence correction history must resolve and user entry is not external verification', () => {
  assert.equal(validateUserEvidenceLedger(MISSION_002_FIXTURES.corrected_kpi).valid, true);
  const bad = { ...MISSION_002_FIXTURES.weekly_real_estate_evidence_ledger, evidence_entries: [{ ...MISSION_002_FIXTURES.weekly_real_estate_evidence_ledger.evidence_entries[0], correction_of_evidence_id: 'missing_evidence' }] };
  assert.equal(validateUserEvidenceLedger(bad).valid, false);
  const mislabeled = { ...bad, evidence_entries: [{ ...bad.evidence_entries[0], correction_of_evidence_id: null, verification_state: 'EXTERNALLY_VERIFIED' }] };
  assert.equal(validateUserEvidenceLedger(mislabeled).valid, false);
});

test('knowledge claims require resolvable sources and benchmark scope', () => {
  const graph = MISSION_002_FIXTURES.doctrine_claim;
  assert.equal(validateRealEstateKnowledgeGraph(graph).valid, true);
  assert.equal(validateRealEstateKnowledgeGraph({ ...graph, claim_nodes: [{ ...graph.claim_nodes[0], supporting_source_ids: ['missing'] }] }).valid, false);
  assert.equal(validateRealEstateKnowledgeGraph({ ...graph, claim_nodes: [{ ...graph.claim_nodes[0], claim_type: 'BENCHMARK', unit: null }] }).valid, false);
});

test('belief requires support or explicit uncertainty and change/non-change reason', () => {
  const state = MISSION_002_FIXTURES.belief_support_and_contradiction;
  assert.equal(validateBeliefState(state).valid, true);
  const belief = { ...state.beliefs[0], supporting_evidence_ids: [], explicit_uncertainty: null };
  assert.equal(validateBeliefState({ ...state, beliefs: [belief] }).valid, false);
  assert.equal(validateBeliefState(MISSION_002_FIXTURES.belief_non_change).valid, true);
  assert.equal(validateBeliefState({ ...state, beliefs: [{ ...state.beliefs[0], change_reason: null, non_change_reason: null }] }).valid, false);
});

test('future probabilities are bounded, normalized, unequal, and stable', () => {
  const futures = MISSION_002_FIXTURES.unequal_five_futures;
  assert.equal(validateFutureSet(futures).valid, true);
  assert.equal(new Set(futures.map((x) => x.probability)).size > 1, true);
  assert.equal(new Set(futures.map((x) => x.stable_future_identity)).size, 5);
  assert.equal(validateFutureSet(futures.map((x, i) => ({ ...x, probability: i === 0 ? .5 : x.probability }))).valid, false);
});

test('future probability delta must match bounded endpoints', () => {
  const change = MISSION_002_FIXTURES.future_probability_change;
  assert.equal(validateFutureProbabilityChange(change).valid, true);
  assert.equal(validateFutureProbabilityChange({ ...change, delta: .5 }).valid, false);
  assert.equal(validateDurableObject({ ...MISSION_002_CONTRACT_FIXTURES.FutureState, probability: 1.2 }, 'FutureState').valid, false);
});

test('intervention lifecycle accepts explicit transitions and rejects jumps', () => {
  assert.equal(validateInterventionTransition('PROPOSED', 'DISCUSSED').valid, true);
  assert.equal(validateInterventionTransition('PROPOSED', 'VALIDATED').valid, false);
  assert.equal(validateInterventionTransition('ACTIVE', 'BLOCKED').valid, true);
});

test('outcome without execution evidence cannot validate effectiveness', () => {
  const ledger = MISSION_002_FIXTURES.successful_personal_outcome_limited_attribution;
  assert.equal(validateOutcomeValidationLedger(ledger).valid, true);
  const invalid = { ...ledger, outcome_records: [{ ...ledger.outcome_records[0], effectiveness_status: 'VALIDATED_EFFECTIVE', execution_evidence_ids: [] }] };
  assert.equal(validateOutcomeValidationLedger(invalid).valid, false);
  assert.equal(MISSION_002_FIXTURES.non_executed_recommendation.outcome_records[0].effectiveness_status, 'NOT_EVALUABLE');
});

test('private outcomes and coach judgments retain restrictive defaults', () => {
  const outcome = MISSION_002_FIXTURES.successful_personal_outcome_limited_attribution.outcome_records[0];
  assert.equal(outcome.learning_eligibility, false);
  assert.equal(validateHumanJudgmentAuthority(MISSION_002_FIXTURES.private_coach_observation).valid, true);
  assert.equal(validateHumanJudgmentAuthority({ ...MISSION_002_FIXTURES.private_coach_observation, privacy_classification: 'INTERNAL' }).valid, false);
});

test('learning stages cannot jump and opinion cannot become canonical', () => {
  assert.equal(validateLearningTransition('ANECDOTAL', 'OBSERVED').valid, true);
  assert.equal(validateLearningTransition('ANECDOTAL', 'CANONICAL').valid, false);
  const candidate = MISSION_002_FIXTURES.learning_candidate;
  assert.equal(validateLearningPromotionRecord(candidate).valid, true);
  assert.equal(validateLearningPromotionRecord({ ...candidate, to_state: 'CANONICAL' }).valid, false);
});

test('conflict resolution requires preserved dissent', () => {
  const graph = MISSION_002_FIXTURES.resolved_conflict_with_dissent;
  assert.equal(validateAuthorityConflictGraph(graph).valid, true);
  const resolution = graph.resolutions[0];
  const conflict = graph.conflicts[0];
  const { validateConflictResolution } = DURABLE_HELPERS;
  assert.equal(validateConflictResolution(conflict, resolution).valid, true);
  assert.equal(validateConflictResolution(conflict, { ...resolution, preserved_dissent: [] }).valid, false);
});

test('anonymized aggregate rejects identity references', () => {
  assert.equal(validateAnonymizedAggregate({ privacy_classification: 'ANONYMIZED_AGGREGATE', profile_id: 'synthetic_direct_id' }).valid, false);
});

test('cross-tenant object sets fail closed', () => {
  const objects = [MISSION_002_FIXTURES.complete_user_intent_state, { ...MISSION_002_FIXTURES.belief_support_and_contradiction, tenant_id: 'tenant_synthetic_other' }];
  assert.equal(validateCrossObjectInvariants(objects).valid, false);
});

test('ExplanationTrace excludes private payload and hidden chain-of-thought', () => {
  const trace = MISSION_002_FIXTURES.explanation_trace;
  assert.equal(validateDurableObject(trace, 'ExplanationTrace').valid, true);
  assert.equal(validateDurableObject({ ...trace, transcript: 'synthetic private content' }, 'ExplanationTrace').valid, false);
  assert.equal('statement' in safeDurableSummary({ ...trace, statement: 'private' }), false);
});

test('BusinessEngineState separates current state, futures, policy, and renderer labels', () => {
  const state = MISSION_002_FIXTURES.business_engine_state;
  assert.equal(validateBusinessEngineState(state).valid, true);
  assert.equal(validateBusinessStateSeparation(state).valid, true);
  assert.equal(validateBusinessStateSeparation({ ...state, future_probability: .5 }).valid, false);
  assert.equal(state.operating_policy_id, 'policy_synthetic_re');
});

test('Conversation extraction proposal cannot become durable without confirmation event', () => {
  const proposal = MISSION_002_FIXTURES.extraction_proposal_awaiting_confirmation;
  assert.equal(validateConversationEvent(proposal).valid, true);
  assert.equal(validateConversationEvent({ ...proposal, confirmation_state: 'DURABLE_ACCEPTED' }).valid, false);
});

test('version transitions require advancement, link, and changed content', () => {
  const previous = { ...MISSION_002_FIXTURES.business_engine_state_version, state_version_id: 'state_version_synthetic_001', object_id: 'state_version_synthetic_001', version: 1, state_version: 1, previous_version_id: null };
  const next = MISSION_002_FIXTURES.business_engine_state_version;
  assert.equal(validateVersionTransition(previous, next).valid, true);
  assert.equal(validateVersionTransition(previous, { ...next, version: 3 }).valid, false);
});

test('all fixtures are deterministic JSON-safe synthetic records', () => {
  assert.ok(Object.keys(MISSION_002_FIXTURES).length >= 30);
  const once = canonicalJson(MISSION_002_FIXTURES);
  assert.equal(once, canonicalJson(JSON.parse(once)));
});

test('VerticalOperatingPolicy is structure only and owns metric/evidence cadence', () => {
  const policy = MISSION_002_FIXTURES.vertical_operating_policy;
  assert.ok(policy.required_weekly_metrics.includes('meaningful_conversations'));
  assert.equal('chat_runtime' in policy, false);
  assert.equal('persistence_adapter' in policy, false);
});

// Deliberately grouped to keep the direct imports above readable while still testing the public barrel.
const DURABLE_HELPERS = await import('../src/lib/intelligenceFabric/index.js');
