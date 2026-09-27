import test from 'node:test';
import assert from 'node:assert/strict';
import nia from '../server/athleteConsultingV2/fixtures/nia.json' with { type: 'json' };
import sofia from '../server/athleteConsultingV2/fixtures/sofia.json' with { type: 'json' };
import { selectMove } from '../server/athleteAcademyV1/apa/contract.js';
import { APA_NARRATIVE_FIELDS, getApaNarrativeValue } from '../server/athleteConsultingV2/apaNarrative.js';
import { currentApaView, publishCurrentApa, assertCurrentApaConfirmedSource,
  inactiveCurrentApaSourceIds,
  assertActiveApaReferences, CURRENT_APA_CONTRACT } from '../server/athleteConsultingV2/currentApa.js';

const clone = value => structuredClone(value);
const firstMessageId = '11111111-1111-4111-8111-111111111111';
const firstChangeId = '22222222-2222-4222-8222-222222222222';
const secondMessageId = '33333333-3333-4333-8333-333333333333';
const secondChangeId = '44444444-4444-4444-8444-444444444444';
const thirdMessageId = '55555555-5555-4555-8555-555555555555';
const thirdChangeId = '66666666-6666-4666-8666-666666666666';
const sourceId = id => `APA:CURRENT:${id}`;

function setup(bundle = nia, { messageId = firstMessageId, changeId = firstChangeId,
  text = 'Training now happens on Tuesdays, and my passing decision still feels rushed.',
  kind = 'reality', supersedes = [] } = {}) {
  const state = { mm: bundle.person.mm, messages: [{ id: messageId, role: 'user', speaker: 'athlete',
    text, at: '2026-09-25T08:00:00.000Z' }] };
  const confirmedChange = { id: changeId, source_message_id: messageId, athlete_slug: bundle.person.slug,
    mm: bundle.person.mm, kind, supersedes, confirmed: true, confirmed_by: 'athlete',
    confirmed_at: '2026-09-25T08:01:00.000Z', reason: 'Athlete confirmed a material change in current training reality.' };
  const candidate = { confirmation: clone(bundle.apa.confirmation), report: clone(bundle.apa.report) };
  return { bundle, state, confirmedChange, candidate, expectedVersion: 0 };
}

function changeDomainAndFuture(input) {
  const source = sourceId(input.confirmedChange.id);
  const domain = input.candidate.report.domains[1];
  domain.gap = 'Tuesday practice now leaves less time to rehearse calm passing choices.';
  domain.refs.push(source);
  const future = input.candidate.report.futures[0];
  future.conditions = 'If Tuesday practice remains crowded, the athlete may need a shorter passing-choice cue.';
  future.refs.push(source);
  return input;
}

test('baseline is the original immutable report with version zero', () => {
  const before = nia.apa.artifact_sha256;
  const view = currentApaView(nia);
  assert.equal(view.version, 0);
  assert.equal(view.artifact, nia.apa);
  assert.equal(view.baseline_hash, before);
  assert.equal(view.receipt, null);
  assert.equal(nia.apa.artifact_sha256, before);
});

test('athlete-confirmed material reality publishes one source-bound five-box projection and chained receipt', () => {
  const input = changeDomainAndFuture(setup());
  const baselineHash = nia.apa.artifact_sha256;
  const result = publishCurrentApa(input);
  assert.equal(result.changed, true);
  assert.equal(result.record.contract, CURRENT_APA_CONTRACT);
  assert.equal(result.record.version, 1);
  assert.equal(result.record.binding.baseline_hash, baselineHash);
  assert.equal(result.receipt.prior_hash, baselineHash);
  assert.equal(result.receipt.source_message_id, firstMessageId);
  assert.ok(result.receipt.material_paths.includes('report.domains.training.gap'));
  assert.ok(result.receipt.material_paths.includes('report.futures.current_course.conditions'));
  const view = currentApaView(nia, result.record);
  assert.equal(view.version, 1);
  assert.equal(view.artifact.report.futures.length, 5);
  assert.equal(view.artifact.sources.at(-1).epistemic, 'ATHLETE_CONFIRMED');
  assert.equal(view.artifact.sources.at(-1).source_message_id, firstMessageId);
  assert.deepEqual({ status: view.artifact.status, move: view.artifact.move, receipt: view.artifact.receipt },
    selectMove(view.artifact.report));
  assert.equal(view.artifact.existing_plan, null);
  assert.equal(nia.apa.artifact_sha256, baselineHash);
  assert.notEqual(view.artifact.artifact_sha256, baselineHash);
});

test('uncited headline cannot change, even when another cited field changes', () => {
  const input = setup();
  input.candidate.report.headline += ' A new presentation.';
  assert.throws(() => publishCurrentApa(input), /CURRENT_APA_UNCITED_FIELD_CHANGED/u);
  changeDomainAndFuture(input);
  assert.throws(() => publishCurrentApa(input), /CURRENT_APA_UNCITED_FIELD_CHANGED/u);
});

test('a cited change cannot smuggle an uncited opening, fabricated move-fit or gate decision', () => {
  const opening = changeDomainAndFuture(setup());
  opening.candidate.report.opening = 'Coach Alex agreed to a new training commitment.';
  assert.throws(() => publishCurrentApa(opening), /CURRENT_APA_UNCITED_FIELD_CHANGED/u);
  const fit = changeDomainAndFuture(setup());
  fit.candidate.report.candidates[0].bos_fit = 'A newly invented BOS fit.';
  assert.throws(() => publishCurrentApa(fit), /CURRENT_APA_CHANGE_NOT_SOURCE_BOUND/u);
  const gate = changeDomainAndFuture(setup());
  gate.candidate.report.candidates[0].gates[0].reason = 'Coach Alex agreed to train the athlete.';
  assert.throws(() => publishCurrentApa(gate), /CURRENT_APA_CHANGE_NOT_SOURCE_BOUND/u);
});

test('a cited change cannot silently replace BOS or athlete source references', () => {
  const input = changeDomainAndFuture(setup());
  input.candidate.report.domains[1].bos_refs = [...input.candidate.report.domains[0].bos_refs];
  assert.throws(() => publishCurrentApa(input), /CURRENT_APA_UNCITED_FIELD_CHANGED/u);
  const refs = changeDomainAndFuture(setup());
  refs.candidate.report.domains[1].refs = refs.candidate.report.domains[1].refs.filter(id => id !== 'CONFIRM');
  assert.throws(() => publishCurrentApa(refs), /CURRENT_APA_SOURCE_REFERENCES_CHANGED/u);
});

test('visible domain detail and future headline/details are versioned only with new source refs', () => {
  const input = setup();
  const source = sourceId(input.confirmedChange.id);
  input.candidate.report.domains[1].detail += ' The confirmed Tuesday constraint changes the reading.';
  input.candidate.report.domains[1].bos_connection += ' The athlete can still choose a manageable cue.';
  input.candidate.report.domains[1].refs.push(source);
  input.candidate.report.futures[0].headline = 'A shorter cue within the changed week';
  input.candidate.report.futures[0].details += ' This path now depends on the confirmed practice schedule.';
  input.candidate.report.futures[0].refs.push(source);
  const result = publishCurrentApa(input);
  assert.equal(result.changed, true);
  for (const path of ['report.domains.training.detail', 'report.domains.training.bos_connection',
    'report.futures.current_course.headline', 'report.futures.current_course.details'])
    assert.ok(result.receipt.material_paths.includes(path));
});

test('unverified Coach Alex observation and unconfirmed athlete chat cannot publish APA truth', () => {
  const coach = changeDomainAndFuture(setup());
  coach.state.messages[0].speaker = 'coach';
  assert.throws(() => publishCurrentApa(coach), /CURRENT_APA_ATHLETE_CONFIRMATION_REQUIRED/u);
  const captured = changeDomainAndFuture(setup());
  captured.state.messages[0].capture = { role: 'coach', source: 'Coach Alex (synthetic)' };
  assert.throws(() => publishCurrentApa(captured), /CURRENT_APA_ATHLETE_CONFIRMATION_REQUIRED/u);
  const unconfirmed = changeDomainAndFuture(setup());
  unconfirmed.confirmedChange.confirmed = false;
  assert.throws(() => publishCurrentApa(unconfirmed), /CURRENT_APA_ATHLETE_CONFIRMATION_REQUIRED/u);
});

test('material fields must cite the newly confirmed athlete source', () => {
  const input = setup();
  input.candidate.report.domains[1].gap = 'A materially different training constraint.';
  assert.throws(() => publishCurrentApa(input), /CURRENT_APA_CHANGE_NOT_SOURCE_BOUND/u);
});

test('an invalid five-future structure, invented odds and unverified coach-view rewrite fail closed', () => {
  const wrongRoles = changeDomainAndFuture(setup());
  wrongRoles.candidate.report.futures.reverse();
  assert.throws(() => publishCurrentApa(wrongRoles), /FIVE_FUTURE_ROLES_REQUIRED/u);
  const odds = changeDomainAndFuture(setup());
  odds.candidate.report.futures[0].what += ' 70% likely.';
  assert.throws(() => publishCurrentApa(odds), /CUSTOMER_LANGUAGE_OR_ODDS_FAILURE/u);
  const coach = changeDomainAndFuture(setup());
  coach.candidate.report.coach_view.summary = 'Coach now agrees';
  assert.throws(() => publishCurrentApa(coach), /CURRENT_APA_COACH_VIEW_UNVERIFIED/u);
});

test('accepted plan is never silently copied into the suggested One Move or APA agreement', () => {
  const input = changeDomainAndFuture(setup());
  input.state.plan = { id: 'accepted-plan', title: 'An accepted but separate plan' };
  input.candidate.move = { action: 'Ignore the deterministic One Move selector.' };
  const result = publishCurrentApa(input);
  assert.equal(result.record.artifact.existing_plan, nia.apa.existing_plan);
  assert.deepEqual(result.record.artifact.move, selectMove(result.record.artifact.report).move);
  assert.notEqual(result.record.artifact.move?.action, input.candidate.move.action);
});

test('correction supersedes source, retains original baseline and chains version two', () => {
  const first = publishCurrentApa(changeDomainAndFuture(setup()));
  const next = setup(nia, { messageId: secondMessageId, changeId: secondChangeId,
    text: 'Correction: Tuesday is a rest day; Thursday is the short passing practice.',
    kind: 'correction', supersedes: [sourceId(firstChangeId)] });
  next.record = first.record;
  next.expectedVersion = 1;
  next.candidate = { confirmation: clone(first.record.artifact.confirmation),
    report: clone(first.record.artifact.report) };
  next.candidate.report.domains[1].gap = 'Thursday is the short passing practice; Tuesday is a rest day.';
  next.candidate.report.domains[1].refs = next.candidate.report.domains[1].refs.filter(id => id !== sourceId(firstChangeId));
  next.candidate.report.domains[1].refs.push(sourceId(secondChangeId));
  next.candidate.report.futures[0].conditions = 'If Thursday remains the short passing practice, a concise cue may fit.';
  next.candidate.report.futures[0].refs = next.candidate.report.futures[0].refs.filter(id => id !== sourceId(firstChangeId));
  next.candidate.report.futures[0].refs.push(sourceId(secondChangeId));
  next.candidate.narrative_updates = APA_NARRATIVE_FIELDS.map(field => ({ field,
    value: clone(getApaNarrativeValue(next.candidate, field)), refs: [sourceId(secondChangeId)] }));
  const second = publishCurrentApa(next);
  assert.equal(second.record.version, 2);
  assert.equal(second.receipt.prior_hash, first.receipt.receipt_hash);
  assert.deepEqual(second.receipt.supersedes, [sourceId(firstChangeId)]);
  assert.equal(second.record.artifact.sources.at(-1).epistemic, 'ATHLETE_CONFIRMED');
  assert.equal(second.record.artifact.sources.at(-1).supersedes[0], sourceId(firstChangeId));
  assert.equal(currentApaView(nia, second.record).artifact.baseline_artifact_sha256, nia.apa.artifact_sha256);
});

test('pure source preflight accepts an active correction before the obsolete report refs are replaced', () => {
  const first = publishCurrentApa(changeDomainAndFuture(setup()));
  const next = setup(nia, { messageId: secondMessageId, changeId: secondChangeId,
    kind: 'correction', supersedes: [sourceId(firstChangeId)] });
  next.record = first.record;
  next.expectedVersion = 1;
  const preflight = assertCurrentApaConfirmedSource(next);
  assert.equal(preflight.prior.version, 1);
  assert.equal(preflight.source.id, sourceId(secondChangeId));
  assert.deepEqual(preflight.inactiveSourceIds, [sourceId(firstChangeId)]);
  assert.throws(() => assertCurrentApaConfirmedSource({ ...next, expectedVersion: 0 }),
    /CURRENT_APA_STALE_VERSION/u);
});

test('a correction cannot leave superseded evidence active in another future or move gate', () => {
  const first = publishCurrentApa(changeDomainAndFuture(setup()));
  const next = setup(nia, { messageId: secondMessageId, changeId: secondChangeId,
    kind: 'correction', supersedes: [sourceId(firstChangeId)] });
  next.record = first.record;
  next.expectedVersion = 1;
  next.candidate = { confirmation: clone(first.record.artifact.confirmation),
    report: clone(first.record.artifact.report) };
  next.candidate.report.domains[1].gap = 'Thursday is the short practice.';
  next.candidate.report.domains[1].refs = next.candidate.report.domains[1].refs.filter(id => id !== sourceId(firstChangeId));
  next.candidate.report.domains[1].refs.push(sourceId(secondChangeId));
  assert.throws(() => publishCurrentApa(next), /CURRENT_APA_SUPERSEDED_SOURCE_STILL_ACTIVE/u);
  next.candidate.report.futures[0].refs = next.candidate.report.futures[0].refs.filter(id => id !== sourceId(firstChangeId));
  next.candidate.report.candidates[0].gates[0].refs.push(sourceId(firstChangeId));
  assert.throws(() => publishCurrentApa(next), /CURRENT_APA_SUPERSEDED_SOURCE_STILL_ACTIVE/u);
});

test('later revisions cannot resurrect an earlier superseded source', () => {
  const first = publishCurrentApa(changeDomainAndFuture(setup()));
  const correction = setup(nia, { messageId: secondMessageId, changeId: secondChangeId,
    kind: 'correction', supersedes: [sourceId(firstChangeId)],
    text: 'Correction: Tuesday is a rest day; Thursday is the short passing practice.' });
  correction.record = first.record;
  correction.expectedVersion = 1;
  correction.candidate = { confirmation: clone(first.record.artifact.confirmation),
    report: clone(first.record.artifact.report) };
  correction.candidate.report.domains[1].gap = 'Thursday is the short passing practice.';
  correction.candidate.report.domains[1].refs = correction.candidate.report.domains[1].refs.filter(id => id !== sourceId(firstChangeId));
  correction.candidate.report.domains[1].refs.push(sourceId(secondChangeId));
  correction.candidate.report.futures[0].conditions = 'Thursday offers a shorter passing cue.';
  correction.candidate.report.futures[0].refs = correction.candidate.report.futures[0].refs.filter(id => id !== sourceId(firstChangeId));
  correction.candidate.report.futures[0].refs.push(sourceId(secondChangeId));
  correction.candidate.narrative_updates = APA_NARRATIVE_FIELDS.map(field => ({ field,
    value: clone(getApaNarrativeValue(correction.candidate, field)), refs: [sourceId(secondChangeId)] }));
  const second = publishCurrentApa(correction);
  assert.deepEqual(inactiveCurrentApaSourceIds(second.record), [sourceId(firstChangeId)]);
  const later = setup(nia, { messageId: thirdMessageId, changeId: thirdChangeId,
    text: 'The Thursday cue worked in practice today.' });
  later.record = second.record;
  later.expectedVersion = 2;
  later.candidate = { confirmation: clone(second.record.artifact.confirmation),
    report: clone(second.record.artifact.report) };
  later.candidate.report.domains[1].strength = 'The athlete reported the Thursday cue worked in practice.';
  later.candidate.report.domains[1].refs.push(sourceId(thirdChangeId));
  later.candidate.report.futures[0].refs.push(sourceId(firstChangeId));
  assert.throws(() => assertActiveApaReferences(later.candidate.report,
    inactiveCurrentApaSourceIds(second.record)), /CURRENT_APA_SUPERSEDED_SOURCE_STILL_ACTIVE/u);
  assert.throws(() => publishCurrentApa(later), /CURRENT_APA_SUPERSEDED_SOURCE_STILL_ACTIVE/u);
  later.candidate.report.futures[0].refs.pop();
  const third = publishCurrentApa(later);
  assert.equal(third.record.version, 3);
  assert.deepEqual(inactiveCurrentApaSourceIds(third.record), [sourceId(firstChangeId)]);
});

test('stale version, other athlete binding and receipt/artifact tampering reject', () => {
  const first = publishCurrentApa(changeDomainAndFuture(setup()));
  const repeat = changeDomainAndFuture(setup());
  repeat.record = first.record;
  assert.throws(() => publishCurrentApa(repeat), /CURRENT_APA_STALE_VERSION/u);
  assert.throws(() => currentApaView(sofia, first.record), /CURRENT_APA_RECORD_INVALID/u);
  const tamperedReceipt = clone(first.record);
  tamperedReceipt.receipts[0].reason = 'Quietly changed';
  assert.throws(() => currentApaView(nia, tamperedReceipt), /CURRENT_APA_RECEIPT_TAMPERED/u);
  const tamperedArtifact = clone(first.record);
  tamperedArtifact.artifact.report.domains[1].gap = 'Quietly changed';
  assert.throws(() => currentApaView(nia, tamperedArtifact), /CURRENT_APA_ARTIFACT_TAMPERED/u);
});

test('Sofia can publish only her own confirmed reality, never Nia source identity', () => {
  const sofiaInput = changeDomainAndFuture(setup(sofia));
  const result = publishCurrentApa(sofiaInput);
  assert.equal(currentApaView(sofia, result.record).artifact.mm, sofia.person.mm);
  assert.throws(() => currentApaView(nia, result.record), /CURRENT_APA_RECORD_INVALID/u);
  const mismatched = changeDomainAndFuture(setup(sofia));
  mismatched.confirmedChange.mm = nia.person.mm;
  assert.throws(() => publishCurrentApa(mismatched), /CURRENT_APA_ATHLETE_CONFIRMATION_REQUIRED/u);
});

test('correction requires an existing source and a fresh change identity', () => {
  const first = publishCurrentApa(changeDomainAndFuture(setup()));
  const missing = setup(nia, { messageId: secondMessageId, changeId: secondChangeId,
    kind: 'correction', supersedes: ['APA:CURRENT:not-real'] });
  missing.record = first.record;
  missing.expectedVersion = 1;
  missing.candidate = { confirmation: clone(first.record.artifact.confirmation), report: clone(first.record.artifact.report) };
  assert.throws(() => publishCurrentApa(missing), /CURRENT_APA_CORRECTION_LINEAGE_INVALID/u);
  const duplicate = setup(nia, { messageId: secondMessageId, changeId: firstChangeId });
  duplicate.record = first.record;
  duplicate.expectedVersion = 1;
  duplicate.candidate = { confirmation: clone(first.record.artifact.confirmation), report: clone(first.record.artifact.report) };
  assert.throws(() => publishCurrentApa(duplicate), /CURRENT_APA_CHANGE_ALREADY_PUBLISHED/u);
});
