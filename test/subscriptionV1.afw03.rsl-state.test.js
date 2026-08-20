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

const scope = testScope();
const appendedAt = '2026-08-10T00:02:00.000Z';

function storeWithOneEvent() {
  const store = new InMemoryPersonalRslStore();
  const created = testRslEvent(scope);
  assert.equal(created.ok, true, created.code);
  assert.equal(store.append({ scope, event: created.event, appended_at: appendedAt }).ok, true);
  return { store, event: created.event };
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
