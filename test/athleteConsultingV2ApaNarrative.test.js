import test from 'node:test';
import assert from 'node:assert/strict';
import nia from '../server/athleteConsultingV2/fixtures/nia.json' with { type: 'json' };
import sofia from '../server/athleteConsultingV2/fixtures/sofia.json' with { type: 'json' };
import { APA_NARRATIVE_FIELDS, verifyApaNarrativeProvenance } from '../server/athleteConsultingV2/apaNarrative.js';
import { currentApaHash, currentApaView, publishCurrentApa } from '../server/athleteConsultingV2/currentApa.js';

const clone = value => structuredClone(value);
const uuid = number => `${String(number).padStart(8, '0')}-1111-4111-8111-111111111111`;
function input(bundle = nia, record = null, number = 1, supersedes = []) {
  const prior = currentApaView(bundle, record);
  const messageId = uuid(number * 2), changeId = uuid(number * 2 + 1);
  return { bundle, record, expectedVersion: prior.version,
    state: { mm: bundle.person.mm, messages: [{ id: messageId, role: 'user', speaker: 'athlete',
      text: 'Thursday practice is short. I want one calm passing cue while keeping school and recovery protected.',
      at: '2026-09-25T08:00:00.000Z' }] },
    confirmedChange: { id: changeId, source_message_id: messageId, athlete_slug: bundle.person.slug,
      mm: bundle.person.mm, kind: supersedes.length ? 'correction' : 'reality', supersedes,
      confirmed: true, confirmed_by: 'athlete', confirmed_at: '2026-09-25T08:01:00.000Z',
      reason: 'Athlete reviewed and confirmed the changed current reality.' },
    candidate: { confirmation: clone(prior.artifact.confirmation), report: clone(prior.artifact.report),
      narrative_updates: [] } };
}
const sourceId = submitted => `APA:CURRENT:${submitted.confirmedChange.id}`;
function review(submitted, fields, values = {}, previousRefs = {}) {
  submitted.candidate.narrative_updates = fields.map(field => {
    const value = clone(Object.hasOwn(values, field) ? values[field] : submitted.candidate.report[field]);
    submitted.candidate.report[field] = clone(value);
    return { field, value, refs: [...(previousRefs[field] || []), sourceId(submitted)] };
  });
  return submitted;
}
function rehash(record) {
  const { artifact_sha256: _artifactHash, ...body } = record.artifact;
  record.artifact.artifact_sha256 = currentApaHash(body);
  record.receipts.at(-1).content_hash = record.artifact.artifact_sha256;
  let priorHash = record.binding.baseline_hash;
  for (const receipt of record.receipts) {
    receipt.prior_hash = priorHash;
    const { receipt_hash: _receiptHash, ...unsigned } = receipt;
    receipt.receipt_hash = currentApaHash(unsigned); priorHash = receipt.receipt_hash;
  }
  return record;
}

test('baseline narrative dependencies are honestly uncited, never invented from whole-report refs', () => {
  const before = clone(nia.apa);
  const provenance = verifyApaNarrativeProvenance(nia.apa);
  assert.deepEqual(provenance.fields.map(item => item.field), APA_NARRATIVE_FIELDS);
  for (const record of provenance.fields) {
    assert.equal(record.status, 'BASELINE_UNCITED_AT_FIELD_LEVEL');
    assert.deepEqual(record.refs, []);
    assert.equal(record.source_id, null); assert.equal(record.version, null);
  }
  assert.deepEqual(nia.apa, before);
});

test('a source-bound summary-only publication stores exact typed before/after, evidence and prior custody', () => {
  const submitted = review(input(), ['headline'], { headline: 'One calm cue within a shorter Thursday practice' });
  const baseline = clone(nia.apa), result = publishCurrentApa(submitted);
  assert.equal(result.changed, true);
  assert.equal(result.receipt.prior_version, 0);
  assert.equal(result.receipt.prior_artifact_sha256, nia.apa.artifact_sha256);
  assert.deepEqual(result.receipt.material_paths, ['report.headline', 'narrative_provenance.headline']);
  assert.deepEqual(result.receipt.narrative_changes[0], {
    field: 'headline', path: 'report.headline', before: nia.apa.report.headline,
    after: submitted.candidate.report.headline, before_refs: null, after_refs: [sourceId(submitted)],
    value_changed: true, reference_changed: true, prior_provenance: 'BASELINE_FIELD_UNCITED',
    before_provenance: null, source_id: sourceId(submitted),
    source_message_id: submitted.confirmedChange.source_message_id, version: 1 });
  const artifact = currentApaView(nia, result.record).artifact;
  assert.deepEqual(artifact.report.domains, nia.apa.report.domains);
  assert.deepEqual(artifact.report.coach_view, nia.apa.report.coach_view);
  assert.deepEqual(artifact.confirmation, nia.apa.confirmation);
  assert.deepEqual(artifact.sources.slice(0, nia.apa.sources.length), nia.apa.sources);
  assert.deepEqual(nia.apa, baseline);
});

test('all five typed fields and what-we-do-not-know array can publish under the same companion contract', () => {
  const submitted = review(input(sofia), APA_NARRATIVE_FIELDS, {
    headline: 'One manageable cue for the changed week', opening: 'Thursday practice is shorter now.',
    connection: 'Keep the cue small enough to protect school and recovery.',
    main_obstacle: 'The athlete still feels rushed during short practice.',
    what_we_dont_know: ['Whether this cue helps during Thursday practice.', 'How the week will feel after trying it.'] });
  const result = publishCurrentApa(submitted), artifact = currentApaView(sofia, result.record).artifact;
  assert.equal(result.receipt.narrative_changes.length, 5);
  assert.deepEqual(result.receipt.narrative_changes.at(-1).after, submitted.candidate.report.what_we_dont_know);
  assert.deepEqual(artifact.narrative_provenance.fields.map(field => field.status), Array(5).fill('SOURCE_BOUND'));
});

test('explicit unchanged-value reconfirmation publishes provenance without claiming changed text', () => {
  const submitted = review(input(), ['opening']);
  const result = publishCurrentApa(submitted), change = result.receipt.narrative_changes[0];
  assert.equal(result.changed, true);
  assert.equal(change.value_changed, false); assert.equal(change.reference_changed, true);
  assert.deepEqual(change.before, change.after);
  assert.deepEqual(result.receipt.material_paths, ['narrative_provenance.opening']);
  assert.equal(currentApaView(nia, result.record).artifact.report.opening, nia.apa.report.opening);
});

test('ordinary no-change candidate stays unpublished and creates no narrative approval', () => {
  const submitted = input(), result = publishCurrentApa(submitted);
  assert.equal(result.changed, false); assert.equal(result.record, null); assert.equal(result.receipt, null);
});

test('uncited narrative changes cannot ride along with another cited domain update', () => {
  const submitted = input();
  submitted.candidate.report.headline = 'An unsupported new claim';
  submitted.candidate.report.domains[1].gap = 'A changed short-practice constraint.';
  submitted.candidate.report.domains[1].refs.push(sourceId(submitted));
  assert.throws(() => publishCurrentApa(submitted), /CURRENT_APA_UNCITED_FIELD_CHANGED/u);
});

test('companion is strict, canonical, exactly value-bound, correctly typed and new-source-bound', async context => {
  for (const [name, change, error] of [
    ['unknown field', submitted => { submitted.candidate.narrative_updates[0].field = 'coach_view'; }, 'APA_NARRATIVE_UPDATE_INVALID'],
    ['extra metadata', submitted => { submitted.candidate.narrative_updates[0].approved = true; }, 'APA_NARRATIVE_UPDATE_INVALID'],
    ['duplicate field', submitted => { submitted.candidate.narrative_updates.push(clone(submitted.candidate.narrative_updates[0])); }, 'APA_NARRATIVE_UPDATE_INVALID'],
    ['order drift', submitted => { submitted.candidate.narrative_updates.reverse(); }, 'APA_NARRATIVE_UPDATE_INVALID'],
    ['value mismatch', submitted => { submitted.candidate.narrative_updates[0].value = 'Different complete value'; }, 'APA_NARRATIVE_VALUE_MISMATCH'],
    ['wrong field type', submitted => { submitted.candidate.narrative_updates[0].value = ['Not a string']; }, 'APA_NARRATIVE_UPDATE_INVALID'],
    ['old refs only', submitted => { submitted.candidate.narrative_updates[0].refs = ['CONFIRM']; }, 'APA_NARRATIVE_SOURCE_INVALID'],
    ['unknown ref', submitted => { submitted.candidate.narrative_updates[0].refs.push('Other athlete source'); }, 'APA_NARRATIVE_SOURCE_INVALID'],
    ['duplicate ref', submitted => { submitted.candidate.narrative_updates[0].refs.push(sourceId(submitted)); }, 'APA_NARRATIVE_SOURCE_INVALID'],
  ]) await context.test(name, () => {
    const submitted = review(input(), ['headline', 'opening']); change(submitted);
    assert.throws(() => publishCurrentApa(submitted), new RegExp(error, 'u'));
  });
});

test('known current provenance is retained exactly and active refs cannot be silently dropped', () => {
  const firstInput = review(input(), ['headline']), first = publishCurrentApa(firstInput);
  const secondInput = review(input(nia, first.record, 2), ['headline'],
    { headline: 'A calm passing cue for Thursday practice' }, { headline: [sourceId(firstInput)] });
  const second = publishCurrentApa(secondInput), change = second.receipt.narrative_changes[0];
  assert.deepEqual(change.before_provenance, first.record.artifact.narrative_provenance.fields[0]);
  assert.deepEqual(change.before_refs, [sourceId(firstInput)]);
  assert.deepEqual(change.after_refs, [sourceId(firstInput), sourceId(secondInput)]);
  assert.equal(currentApaView(nia, second.record).version, 2);
  secondInput.candidate.narrative_updates[0].refs = [sourceId(secondInput)];
  assert.throws(() => publishCurrentApa(secondInput), /APA_NARRATIVE_SOURCE_REFERENCES_CHANGED/u);
});

test('unknown legacy summary dependencies make corrections fail closed until all five are explicitly reviewed', () => {
  const firstInput = input();
  firstInput.candidate.report.domains[1].gap = 'Thursday practice is shorter this week.';
  firstInput.candidate.report.domains[1].refs.push(sourceId(firstInput));
  const first = publishCurrentApa(firstInput), correction = input(nia, first.record, 2, [sourceId(firstInput)]);
  correction.candidate.report.domains[1].gap = 'Thursday practice is normal; Tuesday is the shorter session.';
  correction.candidate.report.domains[1].refs = correction.candidate.report.domains[1].refs
    .map(id => id === sourceId(firstInput) ? sourceId(correction) : id);
  assert.throws(() => publishCurrentApa(correction), /APA_NARRATIVE_CORRECTION_REVIEW_REQUIRED/u);
  review(correction, APA_NARRATIVE_FIELDS);
  const second = publishCurrentApa(correction);
  assert.equal(currentApaView(nia, second.record).version, 2);
  assert.equal(second.receipt.narrative_changes.every(change => !change.value_changed), true);
});

test('known superseded narrative dependencies require review, cannot survive or be resurrected', () => {
  const firstInput = review(input(), APA_NARRATIVE_FIELDS), first = publishCurrentApa(firstInput);
  const correction = input(nia, first.record, 2, [sourceId(firstInput)]);
  review(correction, ['headline']);
  assert.throws(() => publishCurrentApa(correction), /APA_NARRATIVE_CORRECTION_REVIEW_REQUIRED/u);
  review(correction, APA_NARRATIVE_FIELDS);
  const second = publishCurrentApa(correction);
  assert.equal(currentApaView(nia, second.record).version, 2); // v1 historical refs were active then.
  assert.equal(second.record.artifact.narrative_provenance.fields.every(field =>
    field.refs.length === 1 && field.refs[0] === sourceId(correction)), true);
  correction.candidate.narrative_updates[0].refs.push(sourceId(firstInput));
  assert.throws(() => publishCurrentApa(correction), /APA_NARRATIVE_SOURCE_INVALID/u);
});

test('narrative publication cannot change historical dates, priority, BOS references or unverified coach view', async context => {
  for (const [name, change, error] of [
    ['date', submitted => { submitted.candidate.confirmation.review_date = '2026-10-20'; }, 'CURRENT_APA_UNCITED_FIELD_CHANGED'],
    ['priority', submitted => { submitted.candidate.confirmation.priority = 'A new automatic priority'; }, 'CURRENT_APA_UNCITED_FIELD_CHANGED'],
    ['BOS refs', submitted => { submitted.candidate.report.domains[0].bos_refs =
      clone(submitted.candidate.report.domains[1].bos_refs); }, 'CURRENT_APA_UNCITED_FIELD_CHANGED'],
    ['coach', submitted => { submitted.candidate.report.coach_view.summary = 'Coach Alex now agrees.'; }, 'CURRENT_APA_COACH_VIEW_UNVERIFIED'],
  ]) await context.test(name, () => {
    const submitted = review(input(), ['headline']); change(submitted);
    assert.throws(() => publishCurrentApa(submitted), new RegExp(error, 'u'));
  });
});

test('rehashing cannot forge exact baseline before-value or legacy provenance in a publication receipt', async context => {
  const result = publishCurrentApa(review(input(), ['headline'], { headline: 'A calm cue for Thursday practice' }));
  for (const [name, mutate] of [
    ['baseline before', record => { record.receipts[0].narrative_changes[0].before = 'Invented prior headline'; }],
    ['unknown refs', record => { record.receipts[0].narrative_changes[0].before_refs = ['CONFIRM']; }],
    ['unknown provenance', record => { record.receipts[0].narrative_changes[0].before_provenance = { field: 'headline' }; }],
    ['text-change flag', record => { record.receipts[0].narrative_changes[0].value_changed = false; }],
    ['prior version', record => { record.receipts[0].prior_version = 1; }],
    ['prior artifact', record => { record.receipts[0].prior_artifact_sha256 = 'a'.repeat(64); }],
    ['missing prior links', record => { delete record.receipts[0].prior_version; delete record.receipts[0].prior_artifact_sha256; }],
    ['hidden report change', record => { record.artifact.report.opening = 'An unrecorded narrative claim';
      record.artifact.narrative_provenance.fields[1].value_sha256 = currentApaHash(record.artifact.report.opening); }],
  ]) await context.test(name, () => {
    const changed = clone(result.record); mutate(changed); rehash(changed);
    assert.throws(() => currentApaView(nia, changed), /CURRENT_APA_RECEIPT_TAMPERED|APA_NARRATIVE_PROVENANCE_INVALID/u);
  });
});

test('readback binds known before-provenance exactly to the preceding artifact and rejects forged source/version/keys', async context => {
  const firstInput = review(input(), ['headline']), first = publishCurrentApa(firstInput);
  const nextInput = review(input(nia, first.record, 2), ['headline'], {}, { headline: [sourceId(firstInput)] });
  const second = publishCurrentApa(nextInput);
  for (const [name, mutate] of [
    ['source ID', previous => { previous.source_id = 'CONFIRM'; }],
    ['message ID', previous => { previous.source_message_id = uuid(88); }],
    ['extra keys', previous => { previous.extra = 'No arbitrary provenance'; }],
    ['version zero', previous => { previous.version = 0; }],
    ['different value hash', previous => { previous.value_sha256 = 'f'.repeat(64); }],
  ]) await context.test(name, () => {
    const changed = clone(second.record); mutate(changed.receipts[1].narrative_changes[0].before_provenance);
    rehash(changed); assert.throws(() => currentApaView(nia, changed), /APA_NARRATIVE_PROVENANCE_INVALID/u);
  });
});

test('current artifact provenance cannot be invented, silently dropped, rebound or made cross-athlete', async context => {
  const result = publishCurrentApa(review(input(), ['headline']));
  for (const [name, mutate] of [
    ['drop companion', record => { delete record.artifact.narrative_provenance; }],
    ['invent source', record => { record.artifact.narrative_provenance.fields[1] = {
      ...clone(record.artifact.narrative_provenance.fields[0]), field: 'opening',
      value_sha256: currentApaHash(record.artifact.report.opening) }; }],
    ['cross athlete', record => { record.artifact.narrative_provenance.fields[0].refs.push('SOFIA:PRIVATE'); }],
    ['rebound source', record => { record.artifact.narrative_provenance.fields[0].source_id = 'CONFIRM'; }],
    ['reordered fields', record => { record.artifact.narrative_provenance.fields.reverse(); }],
  ]) await context.test(name, () => {
    const changed = clone(result.record); mutate(changed); rehash(changed);
    assert.throws(() => currentApaView(nia, changed), /APA_NARRATIVE_PROVENANCE_INVALID/u);
  });
});

test('historical record with frozen uncited narratives reads honestly and can acquire new governed provenance', () => {
  const submitted = input();
  submitted.candidate.report.domains[1].gap = 'A shorter Thursday practice is now confirmed.';
  submitted.candidate.report.domains[1].refs.push(sourceId(submitted));
  const first = publishCurrentApa(submitted), legacy = clone(first.record);
  delete legacy.artifact.narrative_provenance;
  delete legacy.receipts[0].narrative_changes; delete legacy.receipts[0].prior_version;
  delete legacy.receipts[0].prior_artifact_sha256; rehash(legacy);
  assert.equal(currentApaView(nia, legacy).version, 1);
  const next = publishCurrentApa(review(input(nia, legacy, 2), ['opening']));
  assert.equal(currentApaView(nia, next.record).version, 2);
  assert.equal(next.receipt.narrative_changes[0].before_provenance, null);
  assert.equal(next.receipt.prior_artifact_sha256, legacy.artifact.artifact_sha256);
});

test('even empty governed companions require exact preceding version and artifact custody on cold read', async context => {
  const submitted = input();
  submitted.candidate.report.domains[1].gap = 'Thursday practice is shorter this week.';
  submitted.candidate.report.domains[1].refs.push(sourceId(submitted));
  const result = publishCurrentApa(submitted);
  assert.deepEqual(result.receipt.narrative_changes, []);
  for (const field of ['prior_version', 'prior_artifact_sha256']) await context.test(field, () => {
    const changed = clone(result.record); delete changed.receipts[0][field]; rehash(changed);
    assert.throws(() => currentApaView(nia, changed), /CURRENT_APA_RECEIPT_TAMPERED/u);
  });
});
