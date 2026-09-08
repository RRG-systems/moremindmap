import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  ATHLETE_LIVING_CONSULT_COACHING_DEMONSTRATIONS_V1,
  ATHLETE_LIVING_CONSULT_COACHING_MISSION_V1,
  ATHLETE_LIVING_CONSULT_CUSTOMER_EXPRESSION_V1,
  createAthleteLivingConsultStructuralQaSeamsV1,
  createAthleteLivingConsultOneShotDemoRuntimeV1,
  createPresentationSafeMikaBosProjectionV1,
} from '../api/engine/athleteLivingConsultOneShotV1/demoRuntime.js';
import {
  createAthletePostResponseCandidateExtractorV1,
  validateAthleteDurableCandidateOutputV1,
} from '../src/lib/athleteLivingConsultOneShotV1/index.js';
import { createFrontierConversationSeamV2 } from '../src/lib/subscriptionV1/freeGptV2/providerSeams.js';
import { createAthleteS2GuRuntimeV1 } from '../api/engine/athleteLivingConsultOneShotV1/athleteGuRuntime.js';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';
import { ATHLETE_APA_PARITY_V1 } from '../src/lib/athleteApaV1/parityProjection.js';

const BOS_PATH = new URL('../api/engine/athleteLivingConsultOneShotV1/fixtures/mika-bos-v1.json', import.meta.url);

function testClock() {
  let time = Date.parse('2026-09-05T22:00:00.000Z');
  return () => new Date(time += 1_000).toISOString();
}

function fakeCoach(handler = null) {
  return {
    inspect: () => ({ enabled: true, model: 'gpt-5.6-sol', reasoning_effort: 'xhigh', store: false, background: false }),
    coach: handler || (async ({ packet }) => ({
      ok: true,
      code: 'STRUCTURAL_TEST_COACH',
      customer_message: `Mika, what matters most from the ${packet.active_lens} view?`,
      receipt: { provider_called: false, structural_test_only: true },
    })),
  };
}

async function act(runtime, state, action, payload = {}, ordinal = 1) {
  return runtime.dispatch(action, {
    ...payload,
    expected_state_hash: state.state_hash,
    expected_revision: state.revision,
    idempotency_key: `${action.toLowerCase()}-${ordinal}`,
  });
}

function binding(state) {
  const proposal = state.pending_proposal;
  return {
    session_id: state.session.session_id,
    relationship_id: state.relationship.relationship_id,
    proposal_id: proposal.proposal_id,
    proposal_hash: proposal.proposal_hash,
    expected_proposal_id: proposal.proposal_id,
    expected_proposal_hash: proposal.proposal_hash,
    expected_prior_publication_version: proposal.expected_prior_publication_version,
    expected_prior_publication_hash: proposal.expected_prior_publication_hash,
  };
}

function rehashSnapshot(snapshot) {
  const next = structuredClone(snapshot);
  delete next.snapshot_hash;
  next.snapshot_hash = hashCanonicalJson(next);
  return next;
}

async function confirmBoth(runtime, state, ordinal) {
  let next = await act(runtime, state, 'CONFIRM', { ...binding(state), actor_role: 'ATHLETE', decision: 'CONFIRM', edited_items: [] }, ordinal);
  assert.equal(next.code, 'ATHLETE_SHARED_QUORUM_PENDING');
  next = await act(runtime, next, 'CONFIRM', { ...binding(next), actor_role: 'INSTRUCTOR', decision: 'CONFIRM', edited_items: [] }, ordinal + 1);
  return next;
}

test('one-shot bootstrap is pre-session, APA-authorized, BOS-zero, first-class Athlete scope, and provider-default-off', async () => {
  const runtime = await createAthleteLivingConsultOneShotDemoRuntimeV1({ env: {}, clock: testClock() });
  const state = runtime.bootstrap();
  assert.equal(state.ok, true);
  assert.equal(state.session.coaching_episode_phase, 'IDLE');
  assert.equal(state.session.session_id, null);
  assert.equal(state.surfaces.bos, null);
  assert.ok(state.surfaces.apa);
  assert.equal(state.grant.bos_shared, false);
  assert.equal(JSON.stringify(state).includes('business_id'), false);
  assert.deepEqual(Object.keys(runtime.scope), ['domain', 'subject_id', 'membership_id', 'tenant_id', 'profile_id', 'athlete_relationship_id']);
  assert.equal(runtime.inspect().demo_fixture.provider_status, 'NOT_CONFIGURED_NO_PROVIDER_CALL');
  assert.equal(runtime.inspect().personal_rsl.personal_rsl_event_count, 0);

  const started = await act(runtime, state, 'START_MY_FIRST_SESSION', {}, 1);
  const refused = await act(runtime, started, 'TURN', { actor_role: 'ATHLETE', message: 'Where should we begin?', page_context: { room: 'YOU', visible_object_ids: [] } }, 2);
  assert.equal(refused.code, 'ATHLETE_FRONTIER_NOT_CONFIGURED');
  assert.equal(runtime.inspect().personal_rsl.personal_rsl_event_count, 0);
});

test('BOS grant binds only the presentation-safe projection and revocation removes both content and existence signal', async () => {
  const clock = testClock();
  const runtime = await createAthleteLivingConsultOneShotDemoRuntimeV1({ env: {}, clock });
  let state = runtime.bootstrap();
  const initialSourceHash = state.current_map.source_state_hash;
  assert.equal(initialSourceHash, hashCanonicalJson({ apa: ATHLETE_APA_PARITY_V1.realizationIdentity }));
  state = await act(runtime, state, 'GRANT_BOS', {}, 1);
  assert.equal(state.ok, true);
  assert.equal(state.grant.bos_shared, true);
  assert.ok(state.surfaces.bos?.artifact);
  assert.equal(state.surfaces.bos.source_binding.content_hash, runtime.inspect().demo_fixture.bos_presentation_projection_hash);
  assert.equal(state.current_map.source_state_hash, initialSourceHash, 'grant does not rewrite initial APA-only map provenance');
  const serialized = JSON.stringify(state.surfaces.bos.artifact);
  for (const forbidden of ['private_calculations', 'raw_answer', 'raw_response', 'raw_transcript', 'provider_request', 'provider_response', 'stage_receipts', 'business_id']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  state = await act(runtime, state, 'REVOKE_BOS', {}, 2);
  assert.equal(state.surfaces.bos, null);
  assert.equal(state.grant.bos_shared, false);
  assert.equal(JSON.stringify(state).includes('business_id'), false);

  const malicious = JSON.parse(fs.readFileSync(BOS_PATH, 'utf8'));
  malicious.subject = { ...malicious.subject, note: 'do not serialize business_id here' };
  assert.throws(() => createPresentationSafeMikaBosProjectionV1(malicious), /ATHLETE_IDENTITY_SHORTCUT_DENIED/u);
});

test('TURN is transactional around provider failure, applies page relevance before coaching, and isolates candidate failure', async () => {
  let failCoach = true;
  const packets = [];
  const coach = fakeCoach(async ({ packet }) => {
    packets.push(packet);
    if (failCoach) return { ok: false, code: 'TEST_PROVIDER_FAILURE' };
    return { ok: true, customer_message: 'Mika, what changed when the pressure rose?', receipt: { provider_called: false, structural_test_only: true } };
  });
  const candidate = { extract: async () => { throw new Error('TEST_EXTRACTION_FAILURE'); } };
  const runtime = await createAthleteLivingConsultOneShotDemoRuntimeV1({ env: {}, clock: testClock(), coach_seam: coach, candidate_extractor: candidate });
  let state = runtime.bootstrap();
  state = await act(runtime, state, 'START_MY_FIRST_SESSION', {}, 1);
  const before = runtime.inspect();
  let result = await act(runtime, state, 'TURN', { actor_role: 'ATHLETE', message: 'I froze late.', page_context: { room: 'YOU', visible_object_ids: [] } }, 2);
  assert.equal(result.code, 'TEST_PROVIDER_FAILURE');
  assert.equal(runtime.inspect().current_state_hash, before.current_state_hash);
  assert.equal(runtime.bootstrap().conversation.length, 0);
  assert.equal(runtime.bootstrap().page_context.room, 'HOME');

  failCoach = false;
  result = await act(runtime, state, 'TURN', { actor_role: 'ATHLETE', message: 'I froze late.', page_context: { room: 'YOU', visible_object_ids: [] } }, 3);
  assert.equal(result.ok, true);
  assert.equal(result.page_context.room, 'YOU');
  assert.equal(packets.at(-1).active_lens, 'YOU');
  assert.equal(result.conversation.length, 2);
  assert.equal(result.candidate_status.code, 'ATHLETE_CANDIDATE_EXTRACTION_FAILED_CLOSED');
  assert.equal(result.pending_proposal, null);
  assert.equal(runtime.inspect().personal_rsl.personal_rsl_event_count, 0);
});

test('ordinary Athlete prose may name a forbidden legacy field without becoming a structured identity shortcut', async () => {
  const runtime = await createAthleteLivingConsultOneShotDemoRuntimeV1({
    env: {},
    clock: testClock(),
    coach_seam: fakeCoach(),
    candidate_extractor: null,
  });
  let state = runtime.bootstrap();
  state = await act(runtime, state, 'START_MY_FIRST_SESSION', {}, 1);
  state = await act(runtime, state, 'TURN', {
    actor_role: 'ATHLETE',
    message: 'Please explain why business_id must never be used as Athlete identity.',
    page_context: { room: 'YOU', visible_object_ids: [] },
  }, 2);
  assert.equal(state.code, 'ATHLETE_COACHING_TURN_COMPLETE');
  assert.equal(state.conversation[0].content.includes('business_id'), true);
  assert.equal(Object.keys(runtime.snapshot()).some((key) => key.includes('business_id')), false);
  const cold = await createAthleteLivingConsultOneShotDemoRuntimeV1({
    env: {},
    clock: testClock(),
    coach_seam: fakeCoach(),
    candidate_extractor: null,
    runtime_snapshot: runtime.snapshot(),
  });
  assert.equal(cold.bootstrap().state_hash, state.state_hash);
});

test('cold hydration rejects semantically tampered proposals and human confirmations even when outer hashes are recomputed', async () => {
  const clock = testClock();
  const runtime = await createAthleteLivingConsultOneShotDemoRuntimeV1({ env: {}, clock });
  let state = runtime.bootstrap();
  state = await act(runtime, state, 'START_MY_FIRST_SESSION', {}, 1);
  state = await act(runtime, state, 'PROPOSE_PLAN', {}, 2);

  const proposalTamper = structuredClone(runtime.snapshot());
  proposalTamper.pending_proposal.summary = 'A silently changed proposal.';
  await assert.rejects(() => createAthleteLivingConsultOneShotDemoRuntimeV1({
    env: {},
    clock: testClock(),
    runtime_snapshot: rehashSnapshot(proposalTamper),
  }), /ATHLETE_LIVING_CONSULT_RUNTIME_SNAPSHOT_INVALID/u);

  await act(runtime, state, 'CONFIRM', {
    ...binding(state),
    actor_role: 'ATHLETE',
    decision: 'CONFIRM',
    edited_items: [],
  }, 3);
  const confirmationTamper = structuredClone(runtime.snapshot());
  const confirmation = confirmationTamper.confirmations[0];
  confirmation.actor.actor_ref = 'synthetic-wrong-athlete';
  delete confirmation.confirmation_hash;
  confirmation.confirmation_hash = hashCanonicalJson(confirmation);
  await assert.rejects(() => createAthleteLivingConsultOneShotDemoRuntimeV1({
    env: {},
    clock: testClock(),
    runtime_snapshot: rehashSnapshot(confirmationTamper),
  }), /ATHLETE_LIVING_CONSULT_RUNTIME_SNAPSHOT_INVALID/u);
});

test('revision clears partial confirmation; exact two-human quorum creates map delta and stable intervention-attempt-outcome lineage', async () => {
  const runtime = await createAthleteLivingConsultOneShotDemoRuntimeV1({ env: {}, clock: testClock(), coach_seam: fakeCoach(), candidate_extractor: null });
  let state = runtime.bootstrap();
  state = await act(runtime, state, 'START_MY_FIRST_SESSION', {}, 1);
  state = await act(runtime, state, 'PROPOSE_PLAN', {}, 2);
  const original = state.pending_proposal;
  state = await act(runtime, state, 'CONFIRM', { ...binding(state), actor_role: 'ATHLETE', decision: 'CONFIRM', edited_items: [] }, 3);
  assert.equal(state.authority_pending.athlete_confirmed, true);
  const revisedItems = original.proposed_items.map((item) => item.field === 'athlete_plan.intervention'
    ? { ...item, value: 'Use one breath cue before two pressure serves.' } : item);
  state = await act(runtime, state, 'REVISE_PROPOSAL', {
    ...binding(state), actor_role: 'ATHLETE', proposal_type: 'COMMITMENT_CANDIDATE',
    summary: 'Use one breath cue before two pressure serves.', items: revisedItems,
    reason: 'Mika made the shared test smaller.',
  }, 4);
  assert.equal(state.code, 'ATHLETE_SHARED_PLAN_PROPOSAL_REVISED');
  assert.equal(state.authority_pending.athlete_confirmed, false);
  assert.notEqual(state.pending_proposal.proposal_id, original.proposal_id);
  state = await confirmBoth(runtime, state, 5);
  assert.equal(state.mutation_performed, true);
  assert.equal(state.proposal.status, 'COMMITTED');
  assert.equal(state.current_map.state.athlete_plan.intervention, 'Use one breath cue before two pressure serves.');
  assert.equal(state.scorecard.interventions.at(-1).decided, 'Use one breath cue before two pressure serves.');
  assert.equal(state.scorecard.interventions.at(-1).original_reason, 'Mika made the shared test smaller.');
  assert.equal(state.open_loops.at(-1).original_reason, 'Mika made the shared test smaller.');
  assert.equal(state.gu_plan.event, 'MAP_CHANGE');
  const deltaObject = state.gu_plan.blocks.flatMap((block) => block.objects || []).find((item) => item.id === 's2-map-delta');
  assert.ok(deltaObject.items.some((item) => item.value.includes('→')));
  assert.ok(deltaObject.items.some((item) => item.label === 'Why you chose it' && item.value === 'Mika made the shared test smaller.'));
  for (const committedItem of state.committed_delta.deltas) {
    const expectedLabel = committedItem.field.replace(/^athlete_/u, '').replaceAll('.', ' ').replaceAll('_', ' ');
    assert.ok(deltaObject.items.some((item) => item.label === expectedLabel), `missing committed map delta: ${committedItem.field}`);
  }
  assert.equal(state.joint_authority_receipt.expected_prior_publication_hash, state.committed_delta.prior_publication_hash);
  assert.equal(state.joint_authority_receipt.expected_prior_publication_version, state.committed_delta.prior_publication_version);
  const lineageId = state.intervention_lineage_id;

  state = await act(runtime, state, 'RECORD_ATTEMPT', {
    actor_role: 'ATHLETE', summary: 'Mika used the cue in two of four comparable sequences.', intervention_lineage_id: lineageId,
    execution_degree: 'PARTIAL', open_loop_state: 'ATTEMPTED',
  }, 7);
  state = await confirmBoth(runtime, state, 8);
  state = await act(runtime, state, 'RECORD_OUTCOME', {
    actor_role: 'INSTRUCTOR', summary: 'Mika reset faster in the two attempted sequences.', intervention_lineage_id: lineageId,
    outcome_classification: 'INCONCLUSIVE', open_loop_state: 'UNRESOLVED', confounders: ['small sample'],
  }, 10);
  state = await confirmBoth(runtime, state, 11);
  const events = runtime.store.readPersonalRsl({ scope: runtime.scope }).records.map((record) => record.event);
  assert.deepEqual(events.map((event) => event.event_type), ['INTERVENTION', 'ATTEMPT', 'OUTCOME', 'CONFIDENCE_CHANGE']);
  assert.deepEqual(events.map((event) => event.semantic_payload.lineage.stage), ['CUSTOMER_AGREED', 'EXECUTION_OBSERVED', 'OUTCOME_OBSERVED', 'CAUSAL_REVIEW']);
  assert.ok(events.every((event) => event.semantic_payload.lineage.intervention_lineage_id === lineageId));
  assert.equal(JSON.stringify(events).includes('business_id'), false);
  const episodes = runtime.store.readRelationshipEpisodes({ scope: runtime.scope }).records.map((record) => record.event);
  assert.ok(episodes.some((event) => event.event_type === 'MORE_SUGGESTION'));
  assert.ok(episodes.some((event) => event.event_type === 'CUSTOMER_DISCUSSION'));
  assert.ok(episodes.some((event) => event.event_type === 'JOINT_AGREEMENT'));
  assert.equal(episodes.some((event) => event.event_type === 'CUSTOMER_AGREEMENT'), false);

  state = await act(runtime, state, 'REQUEST_CLOSE', {}, 13);
  state = await act(runtime, state, 'CLOSE_SESSION', { alignment_message: 'Yes. Keep the cue small and review what actually happened.' }, 14);
  assert.equal(state.session.coaching_episode_phase, 'IDLE');
  assert.deepEqual(state.page_context, { room: 'HOME', visible_object_ids: [] });
  assert.equal(state.session_learning.mutual_alignment, 'Yes. Keep the cue small and review what actually happened.');
  assert.equal(state.session_learning.mutual_alignment_authority, 'EXPLICIT_ATHLETE_AND_INSTRUCTOR_CLOSE');
  const closeEpisodes = runtime.store.readRelationshipEpisodes({ scope: runtime.scope }).records.map((record) => record.event);
  assert.ok(closeEpisodes.some((event) => event.event_type === 'CUSTOMER_DISCUSSION'
    && event.summary === 'At mutual close, the athlete and instructor explicitly aligned: Yes. Keep the cue small and review what actually happened.'));
  assert.equal(state.session.session_id, null);
  assert.equal(state.gu_plan.event, 'SESSION_CLOSING');
  const relationshipId = state.relationship.relationship_id;
  state = await act(runtime, state, 'START_SESSION', {}, 15);
  assert.equal(state.relationship.relationship_id, relationshipId);
  assert.equal(state.gu_plan.event, 'SESSION_OPENING');
  const packet = runtime.assemblePacket({ customerMessage: 'What happened with the cue?' });
  assert.ok(packet.provider_understanding.relevant_relationship_history.some((event) => event.lineage?.intervention_lineage_id === lineageId));
  assert.ok(packet.provider_understanding.relationship_episode_history.some((event) => event.event_type === 'SESSION_LEARNING'
    && event.summary.includes('Keep the cue small')));
});

test('rejection and no-material-change close safely without Personal RSL/map mutation or false map-change GU', async () => {
  const runtime = await createAthleteLivingConsultOneShotDemoRuntimeV1({ env: {}, clock: testClock() });
  let state = runtime.bootstrap();
  state = await act(runtime, state, 'START_MY_FIRST_SESSION', {}, 1);
  state = await act(runtime, state, 'PROPOSE_PLAN', {}, 2);
  const priorHash = state.current_map.publication_hash;
  state = await act(runtime, state, 'CONFIRM', { ...binding(state), actor_role: 'ATHLETE', decision: 'REJECT', edited_items: [] }, 3);
  state = await act(runtime, state, 'CONFIRM', { ...binding(state), actor_role: 'INSTRUCTOR', decision: 'CONFIRM', edited_items: [] }, 4);
  assert.equal(state.code, 'ATHLETE_SHARED_PLAN_REJECTED_NO_MUTATION');
  assert.equal(state.proposal.status, 'REJECTED');
  assert.equal(state.proposal.committed, false);
  assert.equal(state.current_map.publication_hash, priorHash);
  assert.equal(runtime.inspect().personal_rsl.personal_rsl_event_count, 0);

  state = await act(runtime, state, 'PROPOSE_PLAN', {}, 5);
  state = await confirmBoth(runtime, state, 6);
  const committedHash = state.current_map.publication_hash;
  const eventCount = runtime.inspect().personal_rsl.personal_rsl_event_count;
  const sameItems = Object.entries(state.current_map.state.athlete_plan).map(([field, value]) => ({ field: `athlete_plan.${field}`, value: String(value) }));
  state = await act(runtime, state, 'PROPOSE_PLAN', { proposal_type: 'COMMITMENT_CANDIDATE', summary: 'Keep the exact current plan.', items: sameItems, reason: 'No change is being proposed.' }, 8);
  state = await confirmBoth(runtime, state, 9);
  assert.equal(state.code, 'ATHLETE_SHARED_PROPOSAL_NO_MATERIAL_CHANGE_CLOSED');
  assert.equal(state.mutation_performed, false);
  assert.equal(state.pending_proposal, null);
  assert.equal(state.proposal.status, 'NO_MATERIAL_CHANGE');
  assert.equal(state.proposal.committed, false);
  assert.equal(state.current_map.publication_hash, committedHash);
  assert.equal(runtime.inspect().personal_rsl.personal_rsl_event_count, eventCount);
  assert.equal(state.map_delta, null);
  assert.notEqual(state.gu_plan?.event, 'MAP_CHANGE');
});

test('Athlete post-response extractor preserves exact Sol/xhigh contract and stages only validated Athlete-native proposals', async () => {
  let captured;
  const runtime = await createAthleteLivingConsultOneShotDemoRuntimeV1({ env: {}, clock: testClock() });
  let state = runtime.bootstrap();
  await act(runtime, state, 'START_MY_FIRST_SESSION', {}, 1);
  const packet = runtime.assemblePacket({ customerMessage: 'Could we test one breath cue?' });
  const extractor = createAthletePostResponseCandidateExtractorV1({
    enabled: true,
    now: testClock(),
    transport: async (request) => {
      captured = request;
      return {
        output: { candidate: {
          candidate_source: 'MORE_SUGGESTION', proposal_type: 'COMMITMENT_CANDIDATE',
          target_contract: 'athlete_living_map_v1', operation: 'PROPOSE',
          summary: 'Test one breath cue before two pressure serves.',
          items: [{ field: 'athlete_plan.intervention', value: 'Use one breath cue before two pressure serves.' }, { field: 'athlete_plan.open_loop_state', value: 'OPEN' }],
          reason: 'The exchange contains a bounded experiment, not an agreed fact.',
          evidence_ref_ids: [], authority_ref_ids: [], confirmation_required: true,
          model_speech_is_not_truth: true,
        } },
        usage: { input_tokens: 20, output_tokens: 10 }, latency_ms: 5, attempt_count: 1,
      };
    },
  });
  const result = await extractor.extract({ packet, human_message: 'Could we test one breath cue?', coach_message: 'That may be worth testing.' });
  assert.equal(result.ok, true);
  assert.equal(result.candidate.target_contract, 'athlete_living_map_v1');
  assert.equal(captured.model, 'gpt-5.6-sol');
  assert.equal(captured.reasoning.effort, 'xhigh');
  assert.equal(captured.store, false);
  assert.equal(captured.background, false);
  assert.equal(JSON.stringify(captured).includes('business_id'), false);
});

test('post-response extraction rejects a durable correction when no stable RSL target is available', async () => {
  const structural = createAthleteLivingConsultStructuralQaSeamsV1();
  const runtime = await createAthleteLivingConsultOneShotDemoRuntimeV1({
    env: {},
    coach_seam: structural.coach,
    close_seam: structural.close,
    candidate_extractor: null,
  });
  const packet = runtime.assemblePacket({ customerMessage: 'That is not quite it.' });
  const validation = validateAthleteDurableCandidateOutputV1({
    candidate: {
      candidate_source: 'ATHLETE_AUTHORED',
      proposal_type: 'CORRECTION_CANDIDATE',
      target_contract: 'athlete_living_map_v1',
      operation: 'PROPOSE',
      summary: 'Preserve the Athlete correction.',
      items: [{ field: 'athlete_current_reality.unresolved', value: 'The Athlete corrected the prior interpretation.' }],
      reason: 'The human explicitly disagreed.',
      evidence_ref_ids: [],
      authority_ref_ids: [],
      confirmation_required: true,
      model_speech_is_not_truth: true,
    },
  }, packet);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes('ATHLETE_CORRECTION_LINEAGE_TARGET_UNAVAILABLE'));
});

test('Athlete coaching keeps the existing Sol seam while research tools remain default-off', async () => {
  let captured;
  const clock = testClock();
  const runtime = await createAthleteLivingConsultOneShotDemoRuntimeV1({ env: {}, clock });
  let state = runtime.bootstrap();
  await act(runtime, state, 'START_MY_FIRST_SESSION', {}, 1);
  const packet = runtime.assemblePacket({ customerMessage: 'What should we look at first?' });
  const seam = createFrontierConversationSeamV2({
    enabled: true,
    now: clock,
    web_search_enabled: false,
    domain_instruction: 'ATHLETE synthetic 18–20 shared relationship.',
    coaching_mission: ATHLETE_LIVING_CONSULT_COACHING_MISSION_V1,
    coaching_demonstrations: ATHLETE_LIVING_CONSULT_COACHING_DEMONSTRATIONS_V1,
    customer_expression_boundary: ATHLETE_LIVING_CONSULT_CUSTOMER_EXPRESSION_V1,
    transport: async (request) => {
      captured = request;
      return { output: { customer_message: 'Mika, where did the game feel hardest to read?' }, usage: {}, latency_ms: 4, web_search_calls: 0 };
    },
  });
  const result = await seam.coach({ packet, customer_message: 'What should we look at first?', mutation_performed: false });
  assert.equal(result.ok, true);
  assert.equal(captured.model, 'gpt-5.6-sol');
  assert.equal(captured.reasoning.effort, 'xhigh');
  assert.deepEqual(captured.tools, []);
  assert.equal(Object.hasOwn(captured, 'include'), false);
  assert.equal(captured.store, false);
  assert.equal(captured.background, false);
  assert.equal(ATHLETE_LIVING_CONSULT_COACHING_DEMONSTRATIONS_V1.length, 3);
  assert.equal(/\bbusiness\b|business coach|\boperator\b|real[- ]estate/iu.test(JSON.stringify(captured)), false);
});

test('default-off structural QA seam exercises lifecycle without pretending a frontier provider is configured', async () => {
  const clock = testClock();
  const seams = createAthleteLivingConsultStructuralQaSeamsV1({ clock });
  const runtime = await createAthleteLivingConsultOneShotDemoRuntimeV1({
    env: {},
    clock,
    coach_seam: seams.coach,
    candidate_extractor: seams.candidate,
    close_seam: seams.close,
  });
  let state = runtime.bootstrap();
  assert.equal(state.boundaries.frontier_provider_status, 'STRUCTURAL_QA_NO_FRONTIER');
  assert.equal(state.boundaries.frontier_coaching_available, false);
  assert.equal(state.boundaries.structural_qa_only, true);
  assert.equal(state.boundaries.synthetic_demo_conversation_persisted, true);
  assert.equal(state.boundaries.real_customer_transcript_persisted, false);
  assert.equal(Object.hasOwn(state.boundaries, 'raw_transcript_persisted'), false);
  state = await act(runtime, state, 'START_MY_FIRST_SESSION', {}, 1);
  state = await act(runtime, state, 'TURN', {
    actor_role: 'ATHLETE',
    message: 'I want to test the continuous conversation rail.',
    page_context: { room: 'YOU', visible_object_ids: [] },
  }, 2);
  assert.equal(state.code, 'ATHLETE_COACHING_TURN_COMPLETE');
  assert.equal(state.receipts.at(-1).provider_called, false);
  assert.equal(state.receipts.at(-1).structural_qa_only, true);
  assert.equal(JSON.stringify(state).includes('business_id'), false);
});

test('permission changes invalidate a staged proposal before either human can confirm it', async () => {
  const runtime = await createAthleteLivingConsultOneShotDemoRuntimeV1({ env: {}, clock: testClock() });
  let state = runtime.bootstrap();
  state = await act(runtime, state, 'START_MY_FIRST_SESSION', {}, 1);
  state = await act(runtime, state, 'GRANT_BOS', {}, 2);
  state = await act(runtime, state, 'PROPOSE_PLAN', {}, 3);
  const stale = { ...binding(state) };
  const proposalId = state.pending_proposal.proposal_id;
  state = await act(runtime, state, 'REVOKE_BOS', {}, 4);
  assert.equal(state.invalidated_proposal_id, proposalId);
  assert.equal(state.pending_proposal, null);
  assert.equal(state.proposal.status, 'STALE_AUTHORITY');
  const refused = await act(runtime, state, 'CONFIRM', {
    ...stale,
    actor_role: 'ATHLETE',
    decision: 'CONFIRM',
    edited_items: [],
  }, 5);
  assert.equal(refused.code, 'ATHLETE_SHARED_CONFIRMATION_BINDING_INVALID');
  assert.equal(runtime.inspect().personal_rsl.personal_rsl_event_count, 0);
});

test('actual BOS and APA renderer ids purpose-rank only already-authorized objects', async () => {
  const runtime = await createAthleteLivingConsultOneShotDemoRuntimeV1({ env: {}, clock: testClock() });
  let state = runtime.bootstrap();
  state = await act(runtime, state, 'SET_PAGE_CONTEXT', { room: 'YOUR_SPORT', visible_object_ids: ['layer0-where'] }, 1);
  let packet = runtime.assemblePacket({ customerMessage: 'What are we looking at?' });
  const apaObjects = packet.provider_understanding.authorized_shared_context;
  assert.ok(apaObjects.some((item) => item.source_binding.source_kind === 'ATHLETE_APA' && item.relevance === 'ACTIVE_VIEW'));
  assert.equal(apaObjects.some((item) => item.source_binding.source_kind === 'ATHLETE_BOS'), false);
  const apaCount = apaObjects.length;

  state = await act(runtime, state, 'GRANT_BOS', {}, 2);
  state = await act(runtime, state, 'SET_PAGE_CONTEXT', { room: 'YOU', visible_object_ids: ['this_is_you'] }, 3);
  packet = runtime.assemblePacket({ customerMessage: 'Help us think about this page.' });
  const withBos = packet.provider_understanding.authorized_shared_context;
  assert.ok(withBos.some((item) => item.object_id === 'bos:surface:this-is-you' && item.relevance === 'ACTIVE_VIEW'));
  assert.ok(withBos.length > apaCount);

  await act(runtime, state, 'REVOKE_BOS', {}, 4);
  packet = runtime.assemblePacket({ customerMessage: 'What is visible now?' });
  assert.equal(packet.provider_understanding.authorized_shared_context.some((item) => item.source_binding.source_kind === 'ATHLETE_BOS'), false);
  assert.equal(packet.provider_understanding.authorized_shared_context.length, apaCount);
});

test('session-bound MORE hypothesis and explicit human correction remain linked noncanonical episode provenance', async () => {
  let turn = 0;
  const runtime = await createAthleteLivingConsultOneShotDemoRuntimeV1({
    env: {},
    clock: testClock(),
    candidate_extractor: null,
    coach_seam: fakeCoach(async () => ({
      ok: true,
      customer_message: turn++ === 0
        ? 'Mika, one possibility is that the cue becomes unclear under pressure. What do you notice?'
        : 'Mika, that correction matters. The cue is clear; trusting the choice may be the live question.',
      receipt: { provider_called: false, structural_test_only: true },
    })),
  });
  let state = runtime.bootstrap();
  state = await act(runtime, state, 'START_MY_FIRST_SESSION', {}, 1);
  state = await act(runtime, state, 'TURN', {
    actor_role: 'ATHLETE', message: 'I hesitate late.', page_context: { room: 'YOU', visible_object_ids: [] },
  }, 2);
  await act(runtime, state, 'TURN', {
    actor_role: 'ATHLETE', message: 'That is not it. The cue is clear; I worry about letting the team down.', page_context: { room: 'YOU', visible_object_ids: [] },
  }, 3);
  const episodes = runtime.store.readRelationshipEpisodes({ scope: runtime.scope }).records.map((record) => record.event);
  const suggestions = episodes.filter((event) => event.event_type === 'MORE_SUGGESTION');
  const correction = episodes.find((event) => event.event_type === 'CUSTOMER_DISCUSSION' && event.supersedes_episode_event_id);
  const revisedHypothesis = suggestions.find((event) => event.supersedes_episode_event_id === correction?.episode_event_id);
  assert.equal(suggestions.length, 2);
  assert.equal(correction.supersedes_episode_event_id, suggestions[0].episode_event_id);
  assert.match(correction.summary, /explicitly corrected/u);
  assert.ok(revisedHypothesis);
  assert.match(revisedHypothesis.summary, /correction matters/u);
  assert.equal(runtime.inspect().personal_rsl.personal_rsl_event_count, 0);
});

test('Athlete GU frontier seam uses the shared S2 schema with zero tools and no Business-domain prompt payload', async () => {
  let captured;
  const gu = createAthleteS2GuRuntimeV1({
    maxAttempts: 1,
    transport: async (request) => {
      captured = request;
      const world = JSON.parse(request.input[1].content).governedWorld;
      return {
        output: {
          planVersion: 'more-subscription-s2-gu-plan-v1',
          event: 'FIRST_SESSION_WELCOME',
          stateBinding: world.stateBinding,
          renderDecision: { render: true, reason: 'A small welcome helps both people begin together.' },
          guidance: { eyebrow: 'WELCOME TO MORE', headline: 'Welcome to MORE', summary: 'One conversation for both of you.', nextCue: 'Start when you are ready.' },
          blocks: [{
            blockId: 's2-block-athlete-welcome', type: 'RELATIONSHIP', title: 'Think together', subtitle: 'Both voices stay part of each shared decision.',
            objectIds: ['s2-relationship-preferences'], evidenceIds: [], emphasis: 'PRIMARY', reason: 'Make the shared relationship clear.',
          }],
          interactions: [],
        },
        receipt: { provider: 'TEST_ZERO_TOOL_TRANSPORT' },
      };
    },
  });
  const runtime = await createAthleteLivingConsultOneShotDemoRuntimeV1({ env: {}, clock: testClock(), gu_generator: gu.generate });
  const state = await act(runtime, runtime.bootstrap(), 'START_MY_FIRST_SESSION', {}, 1);
  assert.equal(state.gu_plan.event, 'FIRST_SESSION_WELCOME');
  assert.deepEqual(captured.tools, []);
  assert.equal(captured.model, 'gpt-5.6-sol');
  assert.equal(captured.reasoning.effort, 'xhigh');
  assert.equal(captured.store, false);
  assert.equal(captured.background, false);
  assert.equal(/\bbusiness\b|business coach|\boperator\b|real[- ]estate/iu.test(JSON.stringify(captured)), false);
});
