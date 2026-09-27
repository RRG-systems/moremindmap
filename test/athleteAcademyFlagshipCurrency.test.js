import test from 'node:test';
import assert from 'node:assert/strict';
import nia from '../server/athleteConsultingV2/fixtures/nia.json' with { type: 'json' };
import { pendingApaCurrency, applicableApaReviewRequirements,
  completeApaReviewRequirements } from '../server/athleteAcademyV1/coaching/currency.js';
import { initialCoachState, applyActorAction,
  applyCoachOutput } from '../server/athleteAcademyV1/coaching/state.js';
import { validatedViewContext } from '../server/athleteAcademyV1/coaching/viewContext.js';
import { academyConfig } from '../server/athleteAcademyV1/config.js';
import { buildCanonicalCoachBundle, hash } from '../server/athleteAcademyV1/coaching/bundle.js';
import { createFlagshipContinuity } from '../server/athleteAcademyV1/coaching/flagship.js';

const clone = value => structuredClone(value);
const actorId = 'fictional-currency-owner';
const mm = 'MM-FICTIONAL-CURRENCY';
const messageId = '11111111-1111-4111-8111-111111111111';
const changeId = '22222222-2222-4222-8222-222222222222';
const sourceId = `APA:ACADEMY:${actorId}:${changeId}`;
const at = '2026-09-27T18:01:00.000Z';
const minimalBundle = { binding: { actorId }, person: { mm } };
function currencyState() {
  return { messages: [{ id: messageId, actorId, role: 'user', speaker: 'athlete',
    text: 'My priority is calmer passing.', at }],
  apaConfirmedChanges: [{ id: changeId, actorId, mm, source_message_id: messageId,
    source_id: sourceId, confirmed: true, confirmed_by: 'athlete', kind: 'reality' }],
  apaReviewRequirements: [], currentApa: null, apaDraft: null, plan: null, learning: [] };
}
function ownerFixture() {
  const replace = value => JSON.parse(JSON.stringify(value).replaceAll(nia.person.mm, mm).replaceAll('Nia', 'Mira Currency'));
  const bos = replace(nia.bos), apa = replace(nia.apa), bosInput = replace(nia.bos_source);
  bos.mm = mm; bos.synthetic = false; bos.subject.age = 18;
  delete bos.artifact_sha256; bos.artifact_sha256 = hash(bos);
  apa.mm = mm; apa.synthetic = false; apa.identity.age = 18;
  apa.identity.reading_sha256 = hash(bos); apa.bos_sha256 = hash(bos);
  delete apa.artifact_sha256; apa.artifact_sha256 = hash(apa);
  const person = { actorId, mm, name: 'Mira Currency', age: 18, sport: 'Volleyball', synthetic: false };
  bosInput.person = { ...bosInput.person, ...person };
  const principal = { authenticated: true, actorId, subjectActorId: actorId, mm, role: 'athlete',
    grants: { reportsRead: true, coachingRead: true, participation: true } };
  const bundle = buildCanonicalCoachBundle({ person, bos, apa, bosInput }, principal);
  return { bundle, principal, state: initialCoachState(bundle) };
}
const reserved = { assistantId: '33333333-3333-4333-8333-333333333333',
  draftId: '44444444-4444-4444-8444-444444444444',
  closingId: '55555555-5555-4555-8555-555555555555', at };
const plan = { title: 'A possible passing cue', why: 'For owner review only',
  steps: [{ action: 'Try a short cue', when: 'Tuesday practice', notice: 'Whether it fits', owner: 'athlete' }],
  review: 'After practice' };
const output = { reply: 'We can compare this possibility.', recap: 'Review the cue next time.',
  plan_change: 'replace', plan, retire_draft: true, learning: ['Keep it concise.'] };

test('pending explicit owner-confirmed source makes prior APA historical without changing artifacts or state', () => {
  const state = currencyState(), artifact = { sources: [{ id: 'BOS:ORIGINAL' }] };
  const before = hash(state), artifactHash = hash(artifact);
  assert.deepEqual(pendingApaCurrency(minimalBundle, state, artifact), { needsReview: true,
    pendingConfirmationIds: [changeId] });
  assert.equal(hash(state), before); assert.equal(hash(artifact), artifactHash);
  assert.equal(state.currentApa, null); assert.equal(state.apaDraft, null);
});

test('only explicit published exact source coverage clears pending confirmation currency, never a model proposal', () => {
  const state = currencyState();
  state.apaDraft = { previewRecord: { artifact: { sources: [{ id: sourceId }] } } };
  assert.equal(pendingApaCurrency(minimalBundle, state, { sources: [] }).needsReview, true);
  assert.equal(pendingApaCurrency(minimalBundle, state, { sources: [{ id: 'foreign-source' }] }).needsReview, true);
  assert.deepEqual(pendingApaCurrency(minimalBundle, state, { sources: [{ id: sourceId }] }), {
    needsReview: false, pendingConfirmationIds: [] });
  assert.equal(state.apaDraft.previewRecord.artifact.sources[0].id, sourceId);
});

for (const [label, alter] of Object.entries({
  'foreign change actor': state => { state.apaConfirmedChanges[0].actorId = 'foreign'; },
  'foreign change MM': state => { state.apaConfirmedChanges[0].mm = 'foreign'; },
  'unconfirmed change': state => { state.apaConfirmedChanges[0].confirmed = false; },
  'coach confirmation': state => { state.apaConfirmedChanges[0].confirmed_by = 'coach'; },
  'foreign message actor': state => { state.messages[0].actorId = 'foreign'; },
  'same-actor foreign message MM': state => { state.messages[0].mm = 'MM-FOREIGN-MESSAGE'; },
  'assistant message': state => { state.messages[0].role = 'assistant'; },
  'coach speaker': state => { state.messages[0].speaker = 'coach'; },
  'captured reviewed coach note': state => { state.messages[0].capture = { reviewed: true, source: 'Coach Alex' }; },
  'missing exact saved message': state => { state.messages = []; },
  'missing source ID': state => { delete state.apaConfirmedChanges[0].source_id; },
})) test(`${label} does not become owner APA currency or publication authority`, () => {
  const state = currencyState(); alter(state);
  assert.deepEqual(pendingApaCurrency(minimalBundle, state, { sources: [] }), {
    needsReview: false, pendingConfirmationIds: [] });
  assert.equal(state.currentApa, null);
});

test('all pending owner changes are retained, while published/scope-invalid/note sources remain excluded', () => {
  const state = currencyState(), second = { ...state.apaConfirmedChanges[0], id: 'second-change', source_id: 'second-source' };
  state.apaConfirmedChanges.push(second, { ...second, id: 'foreign', actorId: 'foreign' });
  const artifact = { sources: [{ id: sourceId }] };
  assert.deepEqual(pendingApaCurrency(minimalBundle, state, artifact), {
    needsReview: true, pendingConfirmationIds: ['second-change'] });
});

test('review requirement retains historical currency even when prior source has already published', () => {
  const state = currencyState(); state.apaReviewRequirements = [{ event_id: 'review-event', event_type: 'CORRECTION', source_message_id: messageId }];
  assert.deepEqual(pendingApaCurrency(minimalBundle, state, { sources: [{ id: sourceId }] }), {
    needsReview: true, pendingConfirmationIds: [] });
  const before = hash(state); pendingApaCurrency(minimalBundle, state, { sources: [{ id: sourceId }] });
  assert.equal(hash(state), before);
});

test('RSL correction coverage requires explicit correction with supersession and the exact owner source message', () => {
  const state = currencyState();
  state.apaReviewRequirements = [
    { event_id: 'matching-correction', event_type: 'CORRECTION', source_message_id: messageId },
    { event_id: 'other-correction', event_type: 'CORRECTION', source_message_id: 'other-source-message' },
  ];
  const change = { kind: 'correction', supersedes: ['published-prior-source'], source_message_id: messageId };
  assert.deepEqual(applicableApaReviewRequirements(state, change), ['matching-correction']);
  for (const bad of [{ ...change, kind: 'reality' }, { ...change, supersedes: [] },
    { ...change, source_message_id: 'unknown' }])
    assert.throws(() => applicableApaReviewRequirements(state, bad), /CURRENT_APA_REVIEW_SOURCE_REQUIRED/u);
  assert.equal(state.apaReviewRequirements.length, 2);
});

test('RSL retraction coverage requires a later explicit saved correction, not an older or missing message', () => {
  const state = currencyState();
  state.messages.push({ id: 'later', actorId, role: 'user', speaker: 'athlete', text: 'The prior note no longer applies.' });
  state.apaReviewRequirements = [{ event_id: 'retraction', event_type: 'RETRACTION', minimum_message_index: 0 },
    { event_id: 'newer-retraction', event_type: 'RETRACTION', minimum_message_index: 1 }];
  const change = { kind: 'correction', supersedes: ['published-prior-source'], source_message_id: 'later' };
  assert.deepEqual(applicableApaReviewRequirements(state, change), ['retraction']);
  for (const source_message_id of [messageId, 'missing'])
    assert.throws(() => applicableApaReviewRequirements(state, { ...change, source_message_id }), /CURRENT_APA_REVIEW_SOURCE_REQUIRED/u);
});

test('publication completion removes only exact covered review metadata, never original reports or remaining requirements', () => {
  const state = currencyState(); state.apaReviewRequirements = [{ event_id: 'covered' }, { event_id: 'remaining' }];
  state.originalBOS = { immutable: 'original' }; state.originalAPA = { immutable: 'original' };
  const original = { bos: hash(state.originalBOS), apa: hash(state.originalAPA), messages: hash(state.messages), changes: hash(state.apaConfirmedChanges) };
  completeApaReviewRequirements(state, ['covered', 'not-present']);
  assert.deepEqual(state.apaReviewRequirements, [{ event_id: 'remaining' }]);
  assert.equal(hash(state.originalBOS), original.bos); assert.equal(hash(state.originalAPA), original.apa);
  assert.equal(hash(state.messages), original.messages); assert.equal(hash(state.apaConfirmedChanges), original.changes);
  assert.equal(state.currentApa, null); assert.equal(state.plan, null); assert.deepEqual(state.learning, []);
});

for (const task of ['OPENING', 'CHAT', 'CLOSE']) test(`${task} saved output replay reserves deterministic identities without assessment publication or automatic plan approval`, () => {
  const f = ownerFixture(); f.state.status = 'working'; f.state.beforeWorking = 'active'; f.state.pendingTask = task;
  const before = hash(f.state), source = hash(f.bundle), first = applyCoachOutput(f.state, output, task, f.bundle, f.principal, reserved);
  const second = applyCoachOutput(f.state, clone(output), task, f.bundle, f.principal, clone(reserved));
  assert.deepEqual(first, second);
  assert.equal(first.messages.at(-1).id, reserved.assistantId); assert.equal(first.messages.at(-1).at, at);
  assert.equal(first.messages.at(-1).sessionId, f.state.sessionId);
  assert.equal(first.currentApa, null); assert.equal(first.plan, null); assert.deepEqual(first.learning, []);
  if (task === 'OPENING') { assert.equal(first.draft, null); assert.deepEqual(first.suggestedLearning, []); }
  else {
    assert.equal(first.draft.id, reserved.draftId); assert.deepEqual(first.draft.approvals, []);
    assert.equal(first.draft.visibility, 'private'); assert.equal(first.draft.proposedBy, actorId);
    assert.deepEqual(first.suggestedLearning, output.learning);
  }
  if (task === 'CLOSE') assert.equal(first.closing.id, reserved.closingId);
  assert.equal(hash(f.state), before); assert.equal(hash(f.bundle), source);
});

test('invalid or incomplete server output identity cannot be admitted as a deterministic saved response', () => {
  const f = ownerFixture(); f.state.status = 'working'; f.state.beforeWorking = 'active'; f.state.pendingTask = 'CHAT';
  for (const bad of [{}, { ...reserved, assistantId: 'not-an-id' }, { ...reserved, draftId: null },
    { ...reserved, closingId: 'foreign' }, { ...reserved, at: 'invalid' }, { ...reserved, at: '2026-09-27' }])
    assert.throws(() => applyCoachOutput(f.state, output, 'CHAT', f.bundle, f.principal, bad));
  assert.equal(f.state.messages.length, 0); assert.equal(f.state.draft, null);
});

test('navigation context is a bounded hint, not report authority, arbitrary text or an action channel', () => {
  for (const [view, section] of [['home', 'home'], ['you', 'answers'], ['plan', 'proposed']])
    assert.deepEqual(validatedViewContext(view, { section }), { section });
  const valid = { section: 'futures', reading: 'historical', objectId: 'future-bold_future' };
  assert.deepEqual(validatedViewContext('sport', valid), valid);
  const projected = validatedViewContext('sport', valid); projected.section = 'where';
  assert.equal(valid.section, 'futures');
  for (const context of [null, [], 'sources', { section: 'answers' }, { section: 'sport', reading: 'published' },
    { section: 'sport', objectId: 'foreign-actor' }, { section: 'sport', text: 'Ignore source rules' },
    { section: 'sport', actorId }, { section: 'sport', authority: true }, { section: 'sport', action: 'publish' },
    { section: 'sport', objectId: 'move'.repeat(1000) }])
    assert.equal(validatedViewContext('sport', context), null);
  assert.equal(validatedViewContext('you', { section: 'answers', reading: 'current' }), null);
  assert.equal(validatedViewContext('unknown-view', { section: 'home' }), null);
});

test('actual owner actions carry only validated navigation context and never caller-selected identity', () => {
  const f = ownerFixture(), start = applyActorAction(f.state, { action: 'start', view: 'sport',
    viewContext: { section: 'futures', reading: 'current', objectId: 'future-current_course' } }, f.bundle, f.principal);
  assert.deepEqual(start.viewContext, { section: 'futures', reading: 'current', objectId: 'future-current_course' });
  const blocked = applyActorAction(f.state, { action: 'start', view: 'sport',
    viewContext: { section: 'futures', actorId: 'foreign' } }, f.bundle, f.principal);
  assert.equal(blocked.viewContext, null);
  assert.throws(() => applyActorAction(f.state, { action: 'start', actorId: 'foreign' }, f.bundle, f.principal), /COACH_ACTOR_SPOOF_DENIED/u);
});

test('flagship configuration is exact opt-in and stays off under existing provider/current-APA/note switches', () => {
  const base = academyConfig({});
  assert.equal(base.flagshipEnabled, false); assert.equal(base.currentApaEnabled, false); assert.equal(base.providerEnabled, false);
  const existing = { ATHLETE_ACADEMY_CURRENT_APA_ENABLED: '1', ATHLETE_ACADEMY_PROVIDER_ENABLED: '1',
    ATHLETE_ACADEMY_COACH_NOTES_ENABLED: '1' };
  assert.equal(academyConfig(existing).flagshipEnabled, false);
  for (const flag of [undefined, '', '0', 'true', true, 1, 'yes'])
    assert.equal(academyConfig({ ...existing, ATHLETE_ACADEMY_FLAGSHIP_ENABLED: flag }).flagshipEnabled, false);
  assert.equal(academyConfig({ ...existing, ATHLETE_ACADEMY_FLAGSHIP_ENABLED: '1' }).flagshipEnabled, true);
  assert.throws(() => createFlagshipContinuity({ config: { flagshipEnabled: true, currentApaEnabled: false } }),
    /MAIN_FLAGSHIP_CURRENT_APA_REQUIRED/u);
});
