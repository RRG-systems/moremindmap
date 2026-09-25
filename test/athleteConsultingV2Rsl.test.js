import assert from 'node:assert/strict';
import test from 'node:test';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';
import {
  athleteRslActiveCorrectionTargets, athleteRslRetrievalContext,
  createAthleteRslEvent, createAthleteRslScope,
  deriveAthleteRslEvents, replayAthleteRsl, validateAthleteRslSourceMessages,
} from '../server/athleteConsultingV2/rsl.js';

const at = '2026-09-25T12:00:00.000Z';
function bundle(slug = 'nia') {
  const mm = `SYNTHETIC-${slug.toUpperCase()}`;
  return { person: { synthetic: true, slug, mm },
    bos: { synthetic: true, mm, artifact_sha256: hashCanonicalJson({ slug, report: 'bos' }) },
    apa: { synthetic: true, mm, artifact_sha256: hashCanonicalJson({ slug, report: 'apa' }) } };
}
const nia = bundle(), sofia = bundle('sofia');
const scope = createAthleteRslScope({ scopeId: 'darren-demo-leadership-A', bundle: nia });
const sourceMessage = (sourceId, text) => ({ id: `message-${sourceId}`,
  role: 'user', speaker: 'athlete', text, at });
const statement = (sourceId, text, currentScope = scope) => createAthleteRslEvent({
  scope: currentScope, type: 'ATHLETE_STATEMENT', sourceId, recordedAt: at,
  text, sourceMessage: sourceMessage(sourceId, text), authority: 'EXPLICIT_ATHLETE_SELF_REPORT',
});
const correction = (sourceId, targetEventId, text, currentScope = scope) => createAthleteRslEvent({
  scope: currentScope, type: 'CORRECTION', sourceId, recordedAt: at,
  targetEventId, text, sourceMessage: sourceMessage(sourceId, text),
  authority: 'EXPLICIT_ATHLETE_CORRECTION',
});
const retraction = (sourceId, targetEventId) => createAthleteRslEvent({
  scope, type: 'RETRACTION', sourceId, recordedAt: at,
  targetEventId, authority: 'EXPLICIT_ATHLETE_RETRACTION',
});
const acceptedPlan = (id = 'plan-1', acceptedAt = at) => ({ id,
  hash: hashCanonicalJson({ id, version: 1 }), accepted_at: acceptedAt,
  approvals: ['athlete', 'coach'], title: 'A modest practice reset',
  why: 'Nia chose to try one reversible response.', review: 'At the next check-in.',
  steps: [{ action: 'Pause after a missed pass.', when: 'At practice.',
    notice: 'Whether the reset helps.', owner: 'athlete' },
  { action: 'Offer one specific cue.', when: 'If Nia asks.',
    notice: 'Whether the cue was useful.', owner: 'coach' }] });

test('scope is synthetic, identity and artifact bound without exposing Leadership scope ID', () => {
  const anotherSession = createAthleteRslScope({ scopeId: 'darren-demo-leadership-B', bundle: nia });
  const otherAthlete = createAthleteRslScope({ scopeId: 'darren-demo-leadership-A', bundle: sofia });
  assert.notEqual(scope.scope_hash, anotherSession.scope_hash);
  assert.notEqual(scope.scope_hash, otherAthlete.scope_hash);
  assert.equal(JSON.stringify(scope).includes('darren-demo-leadership-A'), false);
  assert.throws(() => createAthleteRslScope({ scopeId: 'x', bundle: {
    ...nia, person: { ...nia.person, synthetic: false },
  } }), /ATHLETE_RSL_SCOPE_DENIED/u);
  assert.throws(() => createAthleteRslScope({ scopeId: 'x', bundle: {
    ...nia, apa: { ...nia.apa, mm: 'CROSSED-MM' },
  } }), /ATHLETE_RSL_SCOPE_DENIED/u);
});

test('current-state derivation admits only athlete-approved learning and accepted plan', () => {
  const approved = { id: 'approved-1', text: 'One precise cue helps me reset.',
    approved_at: at, speaker: 'athlete' };
  const state = { mm: nia.person.mm, learning: [approved,
    { id: 'coach-observation', text: 'Coach says Nia needs a new plan.',
      approved_at: at, speaker: 'coach' },
    { id: 'unapproved', text: 'An unapproved suggestion.', speaker: 'athlete' }],
  plan: acceptedPlan(), draft: { title: 'Unapproved draft' },
  suggestedLearning: ['Model suggestion'],
  messages: [{ role: 'user', speaker: 'coach', text: 'Coach private note' },
    { role: 'user', speaker: 'athlete', text: 'Raw conversation is not approval' }],
  events: [{ type: 'learning_removed', item: { text: 'Old removed learning' } }] };
  const events = deriveAthleteRslEvents({ scope, bundle: nia, state });
  assert.deepEqual(events.map((event) => event.event_type).sort(), ['ACCEPTED_PLAN', 'APPROVED_LEARNING']);
  assert.equal(events.find((event) => event.event_type === 'APPROVED_LEARNING').payload.text,
    approved.text);
  assert.equal(JSON.stringify(events).includes('Coach private note'), false);
  assert.equal(JSON.stringify(events).includes('Coach says'), false);
  assert.equal(JSON.stringify(events).includes('Raw conversation'), false);
  assert.equal(JSON.stringify(events).includes('Unapproved draft'), false);
  assert.equal(JSON.stringify(events).includes('Old removed learning'), false);
  assert.deepEqual(replayAthleteRsl({ scope, events }).active_events.length, 2);
});

test('an accepted plan requires the protected approvals; a draft cannot be projected', () => {
  const state = { mm: nia.person.mm, learning: [], draft: acceptedPlan(), plan: null };
  assert.deepEqual(deriveAthleteRslEvents({ scope, bundle: nia, state }), []);
  state.plan = { ...acceptedPlan(), approvals: ['athlete'] };
  assert.throws(() => deriveAthleteRslEvents({ scope, bundle: nia, state }),
    /ATHLETE_RSL_PLAN_NOT_ACCEPTED/u);
  state.plan = acceptedPlan();
  const events = deriveAthleteRslEvents({ scope, bundle: nia, state });
  assert.equal(events.length, 1);
  assert.equal(events[0].epistemic_status, 'HUMAN_ACCEPTED_PLAN');
  assert.equal(events[0].payload.plan.steps.length, 2);
});

test('typed athlete correction and retraction preserve lineage without promoting fact or coach observation', () => {
  const first = statement('explicit-statement-1', 'I felt pressure after the game.');
  const fixed = correction('explicit-correction-1', first.event_id,
    'I felt pressure before the game, not afterward.');
  const removed = retraction('explicit-retraction-1', fixed.event_id);
  const before = replayAthleteRsl({ scope, events: [first, fixed] });
  assert.equal(before.active_events.length, 1);
  assert.equal(before.active_events[0].event_id, fixed.event_id);
  assert.equal(before.active_events[0].lineage_root_id, first.event_id);
  assert.equal(before.active_events[0].epistemic_status, 'ATHLETE_CORRECTED_REPORT');
  assert.equal(before.lineage[0].target_event_id, first.event_id);
  const after = replayAthleteRsl({ scope, events: [first, fixed, removed] });
  assert.equal(after.active_events.length, 0);
  assert.deepEqual(after.lineage.map((link) => link.lineage_root_id), [first.event_id, first.event_id]);
  assert.throws(() => createAthleteRslEvent({ scope, type: 'ATHLETE_STATEMENT',
    sourceId: 'coach-1', recordedAt: at, text: 'Coach observed an outcome.',
    authority: 'COACH_OBSERVATION' }), /ATHLETE_RSL_EVENT_AUTHORITY_INVALID/u);
});

test('statement and correction require exact durable athlete-message custody in selected scope', () => {
  const text = 'The pressure started before the game.';
  const amended = 'It began during warmups.';
  const first = statement('source-1', text);
  const fixed = correction('source-2', first.event_id, amended);
  const state = { mm: nia.person.mm, messages: [
    sourceMessage('source-1', text), sourceMessage('source-2', amended) ] };
  assert.equal(first.source_message_id, 'message-source-1');
  assert.equal(first.source_message_at, at);
  assert.equal(first.source_message_hash, hashCanonicalJson(state.messages[0]));
  assert.equal(validateAthleteRslSourceMessages({ scope, events: [first, fixed], state }), true);
  assert.throws(() => createAthleteRslEvent({ scope, type: 'ATHLETE_STATEMENT',
    sourceId: 'missing', recordedAt: at, text, authority: 'EXPLICIT_ATHLETE_SELF_REPORT' }),
  /ATHLETE_RSL_SOURCE_MESSAGE_INVALID/u);
  assert.throws(() => createAthleteRslEvent({ scope, type: 'ATHLETE_STATEMENT',
    sourceId: 'coach', recordedAt: at, text, sourceMessage: { ...state.messages[0], speaker: 'coach' },
    authority: 'EXPLICIT_ATHLETE_SELF_REPORT' }), /ATHLETE_RSL_SOURCE_MESSAGE_INVALID/u);
  assert.throws(() => validateAthleteRslSourceMessages({ scope, events: [first, fixed],
    state: { ...state, messages: [state.messages[0]] } }), /ATHLETE_RSL_SOURCE_MESSAGE_INVALID/u);
  assert.throws(() => validateAthleteRslSourceMessages({ scope, events: [first, fixed],
    state: { ...state, messages: [state.messages[0], { ...state.messages[1], text: 'Silently edited.' }] } }),
  /ATHLETE_RSL_SOURCE_MESSAGE_INVALID/u);
  assert.throws(() => validateAthleteRslSourceMessages({ scope, events: [first, fixed],
    state: { ...state, mm: sofia.person.mm } }), /ATHLETE_RSL_SOURCE_MESSAGE_INVALID/u);
  assert.throws(() => replayAthleteRsl({ scope, events: [{ ...first,
    source_message_hash: '0'.repeat(64) }] }), /ATHLETE_RSL_EVENT_INTEGRITY_INVALID/u);
});

test('replay rejects cross-athlete, cross-Leadership-scope, tampering, future targets, and plan correction', () => {
  const first = statement('explicit-1', 'I am considering a change.');
  const otherScope = createAthleteRslScope({ scopeId: 'darren-demo-leadership-B', bundle: nia });
  assert.throws(() => replayAthleteRsl({ scope: otherScope, events: [first] }),
    /ATHLETE_RSL_EVENT_SCOPE_DENIED/u);
  const sofiaScope = createAthleteRslScope({ scopeId: 'darren-demo-leadership-A', bundle: sofia });
  assert.throws(() => replayAthleteRsl({ scope, events: [statement('sofia-1', 'Sofia only.', sofiaScope)] }),
    /ATHLETE_RSL_EVENT_SCOPE_DENIED/u);
  assert.throws(() => replayAthleteRsl({ scope, events: [{ ...first,
    payload: { text: 'Altered without a new hash.' } }] }), /ATHLETE_RSL_EVENT_INTEGRITY_INVALID/u);
  assert.throws(() => replayAthleteRsl({ scope, events: [correction('correction-before', first.event_id, 'No.') , first] }),
    /ATHLETE_RSL_TARGET_NOT_ACTIVE/u);
  const plan = deriveAthleteRslEvents({ scope, bundle: nia,
    state: { mm: nia.person.mm, learning: [], plan: acceptedPlan() } })[0];
  assert.throws(() => replayAthleteRsl({ scope, events: [plan,
    correction('plan-correction', plan.event_id, 'Replace this plan.') ] }),
  /ATHLETE_RSL_TARGET_NOT_ACTIVE/u);
});

test('replay is idempotent for exact duplicates and conflicts on reused source identity', () => {
  const first = statement('same-source', 'A first self-report.');
  assert.equal(replayAthleteRsl({ scope, events: [first, first] }).event_count, 1);
  const second = statement('same-source', 'A conflicting self-report.');
  assert.equal(second.event_id, first.event_id);
  assert.throws(() => replayAthleteRsl({ scope, events: [first, second] }),
    /ATHLETE_RSL_EVENT_ID_CONFLICT/u);
});

test('replay refuses out-of-order recorded lineage rather than rewriting history', () => {
  const later = createAthleteRslEvent({ scope, type: 'ATHLETE_STATEMENT',
    sourceId: 'later-report', recordedAt: '2026-09-26T12:00:00.000Z',
    text: 'A later report.', sourceMessage: sourceMessage('later-report', 'A later report.'),
    authority: 'EXPLICIT_ATHLETE_SELF_REPORT' });
  const earlier = statement('earlier-report', 'An earlier report.');
  assert.throws(() => replayAthleteRsl({ scope, events: [later, earlier] }),
    /ATHLETE_RSL_EVENT_ORDER_INVALID/u);
});

test('retrieval is bounded, status-labeled, and omits complete items rather than truncating them', () => {
  const events = Array.from({ length: 8 }, (_, index) =>
    statement(`statement-${index}`, `Athlete-reported, unverified detail ${index}.`));
  const context = athleteRslRetrievalContext({ scope, events, maxItems: 3, maxChars: 1000 });
  assert.equal(context.items.length, 3);
  assert.equal(context.omitted_count, 5);
  assert.equal(context.items.every((item) => item.epistemic_status === 'ATHLETE_REPORTED_UNVERIFIED'), true);
  assert.equal(context.raw_transcript_included, false);
  assert.equal(context.coach_observation_promoted, false);
  assert.equal(context.items.every((item) => /Athlete-reported, unverified detail/u.test(item.payload.text)), true);
  assert.throws(() => athleteRslRetrievalContext({ scope, events, maxItems: 99 }),
    /ATHLETE_RSL_CONTEXT_LIMIT_INVALID/u);
  assert.throws(() => athleteRslRetrievalContext({ scope, events, queryText: 'x'.repeat(10001) }),
    /ATHLETE_RSL_CONTEXT_LIMIT_INVALID/u);
});

test('dense approved preferences cannot starve a corrected athlete fact or resurrect its superseded source', () => {
  const obsolete = statement('practice-old', 'My synthetic practice starts early on Tuesday.');
  const revised = correction('practice-new', obsolete.event_id,
    'My synthetic practice schedule now starts later on Thursday.');
  const preferences = Array.from({ length: 14 }, (_, index) => createAthleteRslEvent({
    scope, type: 'APPROVED_LEARNING', sourceId: `preference-${index}`, recordedAt: at,
    text: `Athlete-approved fictional preference ${index}: use a concise question.`,
    authority: 'ATHLETE_LEARNING_CONFIRMATION',
  }));
  const plan = acceptedPlan('dense-plan');
  const accepted = createAthleteRslEvent({ scope, type: 'ACCEPTED_PLAN',
    sourceId: plan.id, recordedAt: plan.accepted_at, plan,
    authority: 'PROTECTED_PLAN_APPROVAL' });
  const events = [obsolete, revised, ...preferences, accepted];
  const context = athleteRslRetrievalContext({ scope, events,
    queryText: 'When does my practice schedule start now?' });
  assert.equal(context.items.length, 12);
  assert.equal(context.omitted_count, 4);
  assert.equal(context.scope_hash, scope.scope_hash);
  assert.equal(context.items[0].event_id, revised.event_id);
  assert.equal(context.items[0].epistemic_status, 'ATHLETE_CORRECTED_REPORT');
  assert.equal(context.items.some((item) => item.event_id === accepted.event_id), true);
  assert.equal(context.items.some((item) => item.event_id === obsolete.event_id
    || item.payload?.text?.includes('early on Tuesday')), false);
  assert.equal(context.raw_transcript_included, false);
  assert.equal(context.coach_observation_promoted, false);

  const targets = athleteRslActiveCorrectionTargets({ scope, events });
  assert.deepEqual(targets.items, [{ event_id: revised.event_id, event_type: 'CORRECTION',
    recorded_at: at, text: revised.payload.text }]);
  assert.equal(targets.omitted_count, 0);
  assert.equal(targets.scope_hash, scope.scope_hash);
  assert.equal(targets.raw_transcript_included, false);
  assert.equal(targets.coach_observation_promoted, false);
  const otherScope = createAthleteRslScope({ scopeId: 'darren-demo-leadership-B', bundle: nia });
  assert.throws(() => athleteRslActiveCorrectionTargets({ scope: otherScope, events }),
    /ATHLETE_RSL_EVENT_SCOPE_DENIED/u);
});

test('relevance ranks the topical active correction while keeping correction targets independent', () => {
  const school = statement('school-old', 'The synthetic school day ends early.');
  const schoolCorrection = correction('school-new', school.event_id,
    'The synthetic school day now ends at four.');
  const practice = statement('practice-prior', 'Practice was on Tuesday.');
  const practiceCorrection = correction('practice-current', practice.event_id,
    'The synthetic practice schedule moved to Thursday.');
  const events = [school, schoolCorrection, practice, practiceCorrection];
  const context = athleteRslRetrievalContext({ scope, events, maxItems: 1,
    queryText: 'Tell me about my practice schedule.' });
  assert.deepEqual(context.items.map((item) => item.event_id), [practiceCorrection.event_id]);
  assert.equal(context.omitted_count, 1);
  const targets = athleteRslActiveCorrectionTargets({ scope, events, maxItems: 1 });
  assert.equal(targets.items.length, 1);
  assert.equal(targets.omitted_count, 1);
  assert.equal(targets.items[0].event_type, 'CORRECTION');
  assert.equal(targets.items.some((item) => item.event_id === school.event_id
    || item.event_id === practice.event_id), false);
  assert.throws(() => athleteRslActiveCorrectionTargets({ scope, events, maxItems: 65 }),
    /ATHLETE_RSL_TARGET_LIMIT_INVALID/u);
});

test('a topical active athlete report can outrank many unrelated preferences', () => {
  const report = statement('recovery-report', 'My synthetic recovery day is Friday.');
  const preferences = Array.from({ length: 14 }, (_, index) => createAthleteRslEvent({
    scope, type: 'APPROVED_LEARNING', sourceId: `other-preference-${index}`, recordedAt: at,
    text: `Athlete-approved fictional preference ${index}: ask one brief question.`,
    authority: 'ATHLETE_LEARNING_CONFIRMATION',
  }));
  const context = athleteRslRetrievalContext({ scope, events: [report, ...preferences],
    queryText: 'What is my recovery day?' });
  assert.equal(context.items[0].event_id, report.event_id);
  assert.equal(context.items[0].epistemic_status, 'ATHLETE_REPORTED_UNVERIFIED');
  assert.equal(context.items.some((item) => item.payload.text.includes('recovery day')), true);
});
