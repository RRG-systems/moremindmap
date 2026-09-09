import assert from 'node:assert/strict';
import test from 'node:test';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';
import { createSyntheticLivingRelationshipLab } from '../src/lab/subscriptionLivingBusinessRelationshipV1/createSyntheticLivingRelationshipLab.js';
import { InMemoryLivingRelationshipStore } from '../src/lib/subscriptionV1/afw05/store.js';
import { createRelationshipEpisodeEvent, OUTCOME_CLASSIFICATIONS, validateRelationshipEpisodeEvent } from '../src/lib/subscriptionV1/lineage.js';
import { SESSION_LEARNING_FIELDS, summarizeSessionLearning } from '../src/lib/subscriptionV1/sessionLearning.js';
import { assembleRelationshipContinuityState } from '../src/lib/subscriptionV1/freeGptV2/relationshipContinuity.js';

const at = '2026-09-08T10:00:00.000Z';
const scope = {
  subject_id: 'subject_synthetic_session_recall',
  membership_id: 'membership_synthetic_session_recall',
  tenant_id: 'tenant_synthetic_session_recall',
  profile_id: 'SYNTHETIC-SESSION-RECALL',
  business_id: 'business_synthetic_session_recall',
};
const priorSession = 'session_111111111111111111111111';
const currentSession = 'session_222222222222222222222222';
const meaning = Object.fromEntries(SESSION_LEARNING_FIELDS.map((field) => [field, `Synthetic discussion only: ${field}. No commitment was authorized.`]));

function record({ eventScope = scope, session_id = priorSession, event_type = 'SESSION_LEARNING', occurred_at = '2026-09-07T10:00:00.000Z', appended_at = occurred_at, summary = 'A question about after-hours work remains unresolved; no plan was authorized.', session_learning = null } = {}) {
  const created = createRelationshipEpisodeEvent({
    scope: eventScope, session_id, event_type, occurred_at, summary, session_learning,
    source_content_hash: hashCanonicalJson({ summary, session_learning }),
  });
  assert.equal(created.ok, true, created.code);
  return { event: created.event, appended_at };
}

function continuity(records, options = {}) {
  return assembleRelationshipContinuityState({ scope, current_session_id: currentSession, relationship_episode_records: records, as_of_at: at, ...options });
}

test('legacy stored session meaning reaches a new coaching request without becoming an authorized fact', async () => {
  const store = new InMemoryLivingRelationshipStore();
  let captured;
  const options = {
    store, subject_key: 're-mid', relationship_key: 'rel_33333333333333333333', seed_weekly_fixture: false,
    clock: () => at,
    transport: async (request, { stage }) => {
      if (stage === 'CONVERSATION') captured = request;
      return { output: stage === 'CONVERSATION' ? { customer_message: 'That remained a question, with no commitment.' } : { candidate: null }, usage: {}, latency_ms: 1 };
    },
  };
  const first = await createSyntheticLivingRelationshipLab({ ...options, session_id: priorSession });
  const saved = record({ eventScope: first.scope });
  const before = store.readCurrent({ scope: first.scope }).publication.publication_hash;
  assert.equal((await store.appendRelationshipEpisodeEvents({ scope: first.scope, events: [saved.event], appended_at: saved.appended_at })).ok, true);
  const resumed = await createSyntheticLivingRelationshipLab({ ...options, session_id: currentSession, session_kind: 'WEEKLY' });
  const emptyPacket = resumed.controller.wholeUnderstandingPacket();
  assert.deepEqual(emptyPacket.provider_understanding.current_conversation, []);
  assert.equal((await resumed.controller.send({ message: 'What did we leave open?' })).ok, true);
  const provider = JSON.parse(captured.input[1].content).whole_coaching_understanding;
  const note = provider.relationship_continuity['Prior session learning'].Notes[0];
  assert.equal(note.Summary, saved.event.summary);
  assert.equal(note['Canonical customer truth'], false);
  assert.equal(note['Personal rsl event'], false);
  assert.equal(note['Recorded at'], saved.appended_at);
  assert.equal(JSON.stringify(provider).includes(saved.event.event_hash), false);
  assert.equal(store.readPersonalRsl({ scope: first.scope }).records.length, 0);
  assert.equal(store.readCurrent({ scope: first.scope }).publication.publication_hash, before);
  assert.equal(store.verifyRelationshipEpisodes({ scope: first.scope }).ok, true);
});

test('typed notes preserve every complete field with a bounded, labeled legacy summary', () => {
  const full = Object.fromEntries(SESSION_LEARNING_FIELDS.map((field, index) => [field, `${String(index).repeat(1150)} end of ${field}`.slice(0, 1200)]));
  const summary = summarizeSessionLearning(full);
  assert.ok(summary.length <= 1200);
  assert.match(summary, /what remains open:/u);
  assert.match(summary, /pick up next time:/u);
  assert.match(summary, /…/u);
  const saved = record({ summary, session_learning: full });
  assert.deepEqual(saved.event.session_learning, full);
  assert.equal(validateRelationshipEpisodeEvent(saved.event, scope), true);
  assert.equal(Object.hasOwn(record().event, 'session_learning'), false);
  for (const invalid of [{ ...full, extra: 'unexpected' }, { ...full, what_mattered: '' }, { ...full, pick_up_next_time: 'x'.repeat(1201) }]) {
    const attempted = createRelationshipEpisodeEvent({ scope, session_id: priorSession, event_type: 'SESSION_LEARNING', summary: 'Synthetic notes.', occurred_at: at, source_content_hash: hashCanonicalJson(full), session_learning: invalid });
    assert.equal(attempted.code, 'RELATIONSHIP_EPISODE_SESSION_LEARNING_INVALID');
  }
  const tampered = structuredClone(saved.event);
  tampered.session_learning.what_remains_open = 'Changed without a new immutable record.';
  assert.equal(validateRelationshipEpisodeEvent(tampered, scope), false);
});

test('session learning excludes foreign scope, current session, future knowledge, other episode kinds and tampering', () => {
  const accepted = record({ session_learning: meaning });
  const foreign = Object.keys(scope).map((field) => record({ eventScope: { ...scope, [field]: `${scope[field]}_other` } }));
  const tampered = structuredClone(accepted);
  tampered.event.summary = 'Tampered summary.';
  const state = continuity([
    accepted, ...foreign, tampered,
    record({ session_id: currentSession }),
    record({ event_type: 'CUSTOMER_DISCUSSION' }),
    record({ occurred_at: '2026-09-09T10:00:00.000Z' }),
    record({ appended_at: '2026-09-09T10:00:00.000Z' }),
  ]).prior_session_learning;
  assert.equal(state.eligible_count, 1);
  assert.equal(state.notes.length, 1);
  assert.equal(state.notes[0].event_hash, accepted.event.event_hash);
  assert.deepEqual(state.notes[0].meaning, meaning);
  assert.match(state.use, /Current customer corrections and active Personal RSL take precedence/u);
});

test('recent-note limits bound context without truncating typed meaning or silently claiming complete recall', () => {
  const full = Object.fromEntries(SESSION_LEARNING_FIELDS.map((field) => [field, 'x'.repeat(1200)]));
  const small = Array.from({ length: 8 }, (_, index) => record({ occurred_at: `2026-09-0${index + 1}T09:00:00.000Z`, summary: `Synthetic note ${index}` }));
  const boundedCount = continuity(small).prior_session_learning;
  assert.equal(boundedCount.notes.length, 4);
  assert.equal(boundedCount.omitted_count, 4);
  assert.deepEqual(boundedCount.notes.map((note) => note.summary), ['Synthetic note 4', 'Synthetic note 5', 'Synthetic note 6', 'Synthetic note 7']);
  const latest = record({ occurred_at: '2026-09-08T09:30:00.000Z', session_learning: full });
  const boundedCharacters = continuity([...small, latest]).prior_session_learning;
  assert.equal(boundedCharacters.notes.length, 1);
  assert.equal(boundedCharacters.omitted_count, 8);
  assert.deepEqual(boundedCharacters.notes[0].meaning, full);
  assert.equal(Object.values(boundedCharacters.notes[0].meaning).join('').length, boundedCharacters.maximum_meaning_characters);
});

test('a corrupted stored episode chain fails closed before the next provider can receive its meaning', async () => {
  const store = new InMemoryLivingRelationshipStore();
  const options = { store, subject_key: 're-mid', seed_weekly_fixture: false, clock: () => at };
  const first = await createSyntheticLivingRelationshipLab({ ...options, session_id: priorSession });
  const saved = record({ eventScope: first.scope });
  await store.appendRelationshipEpisodeEvents({ scope: first.scope, events: [saved.event], appended_at: saved.appended_at });
  store.state.relationship_episode_records[0].appended_at = '2026-09-01T00:00:00.000Z';
  await assert.rejects(createSyntheticLivingRelationshipLab({ ...options, session_id: currentSession }), /RELATIONSHIP_EPISODE_HASH_CHAIN_INVALID/u);
});

test('positive evidence includes only positive classes and retains every other outcome and causal review separately', () => {
  const classes = [...OUTCOME_CLASSIFICATIONS, 'UNCLASSIFIED'];
  const review = { attribution_status: 'ASSOCIATED_ONLY', confidence: 'UNASSESSED' };
  const state = continuity([], {
    longitudinal_scorecard: {
      projection_hash: 'synthetic', month_12_answers: {},
      interventions: classes.map((classification, index) => ({
        intervention_lineage_id: `intervention_${String(index).padStart(24, '0')}`,
        decided: 'Synthetic bounded experiment', open_loop_state: 'UNRESOLVED', due_at: null,
        actually_tried: [{ summary: 'Only one attempt', degree: 'PARTIAL' }],
        what_happened: [{ summary: `Observed ${classification}`, classification }],
        causal_reviews: [review], remains_uncertain: true,
      })),
    },
  });
  const positive = state.maintain_course_evidence.observed_positive_or_possible_positive_outcomes;
  const other = state.maintain_course_evidence.other_observed_outcomes;
  assert.deepEqual(positive.map((item) => item.outcome_direction), ['BENEFICIAL']);
  assert.deepEqual(other.map((item) => item.outcome_direction), classes.filter((value) => value !== 'BENEFICIAL'));
  assert.equal(state.earned_progress_evidence.length, classes.length);
  for (const observation of [...positive, ...other]) {
    assert.deepEqual(observation.causal_reviews, [review]);
    assert.equal(observation.execution_observations[0].degree, 'PARTIAL');
  }
  assert.equal(state.maintain_course_evidence.frontier_judgment_required, true);
});

test('legacy outcome wording cannot override adverse or uncertain metadata or manufacture positive evidence', () => {
  const directions = ['ADVERSE', 'STERILE', 'INCONCLUSIVE', 'CONFOUNDED', null, 'POSITIVE', 'BENEFICIAL'];
  const events = directions.map((direction) => ({
    event_type: 'OUTCOME', effective_at: at, recorded_at: at,
    semantic_payload: { outcome_direction: direction, summary: 'A synthetic outcome report.', items: [{ field: 'evidence.outcome', value: 'We completed the attempt but it did not improve capacity or work as hoped.' }] },
  }));
  const evidence = continuity([], { active_personal_rsl_events: events }).maintain_course_evidence;
  assert.deepEqual(evidence.observed_positive_or_possible_positive_outcomes.map((item) => item.outcome_direction), ['POSITIVE', 'BENEFICIAL']);
  assert.deepEqual(evidence.other_observed_outcomes.map((item) => item.outcome_direction), ['ADVERSE', 'STERILE', 'INCONCLUSIVE', 'CONFOUNDED', 'UNCLASSIFIED']);
});
