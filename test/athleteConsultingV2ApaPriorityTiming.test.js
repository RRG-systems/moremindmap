import test from 'node:test';
import assert from 'node:assert/strict';
import nia from '../server/athleteConsultingV2/fixtures/nia.json' with { type: 'json' };
import sofia from '../server/athleteConsultingV2/fixtures/sofia.json' with { type: 'json' };
import { APA_NARRATIVE_FIELDS, APA_REPORT_NARRATIVE_FIELDS, APA_CONFIRMATION_NARRATIVE_FIELDS,
  APA_NARRATIVE_CONTRACT, APA_NARRATIVE_CONTRACT_V1, getApaNarrativeValue, setApaNarrativeValue,
  canonicalConfirmedDateLiterals, verifyApaNarrativeProvenance } from '../server/athleteConsultingV2/apaNarrative.js';
import { currentApaHash, currentApaView, publishCurrentApa } from '../server/athleteConsultingV2/currentApa.js';
import { createApaComposer } from '../server/athleteConsultingV2/apaComposer.js';
import { apaDeltaBinding, APA_REFERENCE_CODEC_CONTRACT } from '../server/athleteConsultingV2/apaDelta.js';

const clone = value => structuredClone(value);
const uuid = index => `${String(index).padStart(8, '0')}-1111-4111-8111-111111111111`;
const VALUES = Object.freeze({ 'confirmation.priority': 'protect school and recovery',
  'confirmation.review_date': '2026-10-03', 'confirmation.horizon_date': '2026-10-31' });
const SOURCE = 'My current priority is protect school and recovery. Review on October 3, 2026; planning horizon October 31, 2026.';
function input(bundle = nia, record = null, index = 1, text = SOURCE, supersedes = []) {
  const prior = currentApaView(bundle, record), messageId = uuid(index * 2), changeId = uuid(index * 2 + 1);
  return { bundle, record, expectedVersion: prior.version,
    state: { mm: bundle.person.mm, messages: [{ id: messageId, role: 'user', speaker: 'athlete', text,
      at: '2026-09-26T08:00:00.000Z' }] },
    confirmedChange: { id: changeId, source_message_id: messageId, athlete_slug: bundle.person.slug,
      mm: bundle.person.mm, kind: supersedes.length ? 'correction' : 'reality', supersedes,
      confirmed: true, confirmed_by: 'athlete', confirmed_at: '2026-09-26T08:01:00.000Z',
      reason: 'The athlete explicitly reviewed the proposed priority and follow-up agreement.' },
    candidate: { confirmation: clone(prior.artifact.confirmation), report: clone(prior.artifact.report), narrative_updates: [] } };
}
const sourceId = submitted => `APA:CURRENT:${submitted.confirmedChange.id}`;
function review(submitted, fields = APA_CONFIRMATION_NARRATIVE_FIELDS, values = VALUES, retain = {}) {
  submitted.candidate.narrative_updates = fields.map(field => {
    const value = Object.hasOwn(values, field) ? values[field] : getApaNarrativeValue(submitted.candidate, field);
    setApaNarrativeValue(submitted.candidate, field, value);
    return { field, value: clone(value), refs: [...(retain[field] || []), sourceId(submitted)] };
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
function asHistoricalV1(record) {
  const legacy = clone(record);
  legacy.artifact.narrative_provenance.contract = APA_NARRATIVE_CONTRACT_V1;
  legacy.artifact.narrative_provenance.fields = legacy.artifact.narrative_provenance.fields.slice(0, 5);
  for (const receipt of legacy.receipts) {
    delete receipt.narrative_contract;
    receipt.narrative_changes = receipt.narrative_changes.filter(change => APA_REPORT_NARRATIVE_FIELDS.includes(change.field));
    receipt.material_paths = receipt.material_paths.filter(path =>
      !path.startsWith('confirmation.') && !path.startsWith('narrative_provenance.confirmation.'));
  }
  return rehash(legacy);
}

test('manual publication accepts explicit English dates, normalizes ISO, and preserves original assessment/BOS/evidence', () => {
  const before = clone(nia), submitted = review(input()), result = publishCurrentApa(submitted);
  const artifact = currentApaView(nia, result.record).artifact;
  assert.equal(result.changed, true); assert.equal(result.receipt.narrative_contract, APA_NARRATIVE_CONTRACT);
  assert.deepEqual(artifact.report, nia.apa.report);
  assert.equal(artifact.confirmation.priority, VALUES['confirmation.priority']);
  assert.equal(artifact.confirmation.review_date, VALUES['confirmation.review_date']);
  assert.equal(artifact.confirmation.horizon_date, VALUES['confirmation.horizon_date']);
  assert.equal(artifact.confirmation.assessment_date, nia.apa.confirmation.assessment_date);
  assert.deepEqual(artifact.sources.slice(0, nia.apa.sources.length), nia.apa.sources);
  assert.deepEqual(artifact.sources.find(source => source.id === 'CONFIRM'), nia.apa.sources.find(source => source.id === 'CONFIRM'));
  assert.deepEqual(artifact.bos_sources, nia.apa.bos_sources); assert.deepEqual(artifact.identity, nia.apa.identity);
  assert.equal(artifact.narrative_provenance.fields.length, 8);
  for (const change of result.receipt.narrative_changes) {
    assert.equal(change.path, change.field); assert.equal(change.value_changed, true);
    assert.equal(change.before_refs, null); assert.equal(change.before_provenance, null);
    assert.deepEqual(change.after_refs, [sourceId(submitted)]);
  }
  assert.deepEqual(nia, before);
});

test('explicit ISO dates and normalized literal priority span are equally supported', () => {
  const submitted = review(input(sofia, null, 1,
    'My priority is PROTECT   school and recovery. Review 2026-10-03, horizon (2026-10-31).'));
  const result = publishCurrentApa(submitted);
  assert.equal(currentApaView(sofia, result.record).artifact.confirmation.review_date, '2026-10-03');
  assert.deepEqual(canonicalConfirmedDateLiterals('October 3, 2026; October 31 2026; 2026-10-03.'), ['2026-10-03', '2026-10-31']);
});

test('unchanged priority/date reconfirmation is provenance-only and does not roll dates from today or plan consent', () => {
  const submitted = review(input(nia, null, 1, 'I reviewed the existing agreement and keep it unchanged.'),
    APA_CONFIRMATION_NARRATIVE_FIELDS, {});
  submitted.state.plan = { accepted: true, accepted_at: '2026-09-26T08:01:00.000Z' };
  const result = publishCurrentApa(submitted);
  assert.deepEqual(result.record.artifact.confirmation, nia.apa.confirmation);
  assert.equal(result.receipt.narrative_changes.every(change => !change.value_changed), true);
  assert.equal(result.receipt.material_paths.every(path => path.startsWith('narrative_provenance.confirmation.')), true);
});

test('changed fields require typed companion and canonical same-athlete confirmed message, never caller text or unrelated chat', async context => {
  for (const [name, alter, code] of [
    ['missing companion', submitted => { submitted.candidate.narrative_updates = []; }, 'CURRENT_APA_UNCITED_FIELD_CHANGED'],
    ['wrong canonical text', submitted => { submitted.state.messages[0].text = 'Thursday practice is shorter.';
      submitted.sourceText = SOURCE; submitted.candidate.sourceText = SOURCE; }, 'APA_NARRATIVE_SOURCE_TEXT_REQUIRED'],
    ['unrelated chat', submitted => { submitted.state.messages[0].text = 'Thursday practice is shorter.';
      submitted.state.messages.push({ id: uuid(90), role: 'user', speaker: 'athlete', text: SOURCE }); }, 'APA_NARRATIVE_SOURCE_TEXT_REQUIRED'],
    ['Coach source', submitted => { submitted.state.messages[0].speaker = 'coach'; }, 'CURRENT_APA_ATHLETE_CONFIRMATION_REQUIRED'],
    ['unconfirmed source', submitted => { submitted.confirmedChange.confirmed = false; }, 'CURRENT_APA_ATHLETE_CONFIRMATION_REQUIRED'],
    ['different athlete', submitted => { submitted.confirmedChange.athlete_slug = 'sofia'; }, 'CURRENT_APA_ATHLETE_CONFIRMATION_REQUIRED'],
    ['priority substring', submitted => { submitted.state.messages[0].text =
      'I prefer unprotect school and recoveryish. Review 2026-10-03; horizon 2026-10-31.'; }, 'APA_NARRATIVE_SOURCE_TEXT_REQUIRED'],
  ]) await context.test(name, () => {
    const submitted = review(input()); alter(submitted);
    assert.throws(() => publishCurrentApa(submitted), new RegExp(code, 'u'));
  });
});

test('date grounding rejects relative, ambiguous, abbreviated, incomplete and near-match date tokens', async context => {
  for (const token of ['tomorrow', 'next Friday', '10/03/2026', 'Oct 3, 2026', 'October 3', 'October3,2026',
    '2026-10-030', 'x2026-10-03', '02026-10-03', '2026-10-03-01', '2026-10-03.5',
    '2026-10-03T12:00:00Z', '2026-10-03/04', 'October 30, 2026', 'October 3, 20260',
    'October 3, 2026-01', 'October 3, 2026.5', 'October 32, 2026']) await context.test(token, () => {
    const submitted = review(input(nia, null, 1,
      `My priority is protect school and recovery. Review ${token}; horizon 2026-10-31.`));
    assert.throws(() => publishCurrentApa(submitted), /APA_NARRATIVE_SOURCE_TEXT_REQUIRED/u);
  });
});

test('calendar validity and ordered review/horizon relationship remain strict', async context => {
  for (const [name, reviewDate, horizonDate, text] of [
    ['invalid leap day', '2026-02-29', '2026-10-31', 'Review February 29, 2026; horizon October 31, 2026.'],
    ['invalid month day', '2026-09-31', '2026-10-31', 'Review 2026-09-31; horizon 2026-10-31.'],
    ['review before assessment', '2020-01-01', '2026-10-31', 'Review January 1, 2020; horizon October 31, 2026.'],
    ['horizon before review', '2026-10-31', '2026-10-03', 'Review 2026-10-31; horizon 2026-10-03.'],
  ]) await context.test(name, () => {
    const submitted = review(input(nia, null, 1, `My priority is protect school and recovery. ${text}`),
      APA_CONFIRMATION_NARRATIVE_FIELDS, { ...VALUES, 'confirmation.review_date': reviewDate, 'confirmation.horizon_date': horizonDate });
    assert.throws(() => publishCurrentApa(submitted), /CURRENT_APA_CONFIRMATION_INVALID/u);
  });
  assert.deepEqual(canonicalConfirmedDateLiterals('February 29, 2024; February 29, 2026; 2026-09-31.'), ['2024-02-29']);
});

test('assessment date cannot be included in the closed companion or changed even with literal evidence', () => {
  const submitted = review(input());
  submitted.state.messages[0].text += ' Assessment date 2026-01-01.';
  submitted.candidate.confirmation.assessment_date = '2026-01-01';
  assert.throws(() => publishCurrentApa(submitted), /CURRENT_APA_CONFIRMATION_INVALID/u);
  assert.throws(() => setApaNarrativeValue(submitted.candidate, 'confirmation.assessment_date', '2026-01-01'), /APA_NARRATIVE_UPDATE_INVALID/u);
});

test('new8 typed helper rejects unknown/generic paths and wrong confirmation value type', async context => {
  for (const field of ['priority', 'report.priority', 'confirmation.goals.school', '__proto__']) await context.test(field, () => {
    assert.throws(() => getApaNarrativeValue(nia.apa, field), /APA_NARRATIVE_UPDATE_INVALID/u);
  });
  const submitted = review(input());
  submitted.candidate.narrative_updates[0].value = ['protect school and recovery'];
  assert.throws(() => publishCurrentApa(submitted), /APA_NARRATIVE_UPDATE_INVALID/u);
});

test('correction requires explicit review of unknown old5 plus dependent new3 and retains historical source chronology', () => {
  const firstInput = review(input()), first = publishCurrentApa(firstInput);
  const text = 'Correction: my priority is one calm passing cue. Review 2026-10-10; horizon 2026-11-01.';
  const nextValues = { 'confirmation.priority': 'one calm passing cue',
    'confirmation.review_date': '2026-10-10', 'confirmation.horizon_date': '2026-11-01' };
  const correction = review(input(nia, first.record, 2, text, [sourceId(firstInput)]),
    APA_CONFIRMATION_NARRATIVE_FIELDS, nextValues);
  assert.throws(() => publishCurrentApa(correction), /APA_NARRATIVE_CORRECTION_REVIEW_REQUIRED/u);
  review(correction, APA_NARRATIVE_FIELDS, nextValues);
  const second = publishCurrentApa(correction), artifact = currentApaView(nia, second.record).artifact;
  assert.equal(artifact.confirmation.priority, nextValues['confirmation.priority']);
  assert.equal(second.receipt.narrative_changes.length, 8);
  assert.equal(artifact.narrative_provenance.fields.every(field => field.refs[0] === sourceId(correction)), true);
  correction.candidate.narrative_updates.at(-1).refs.push(sourceId(firstInput));
  assert.throws(() => publishCurrentApa(correction), /APA_NARRATIVE_SOURCE_INVALID/u);
});

test('known priority/date refs cannot be dropped in ordinary reality updates', () => {
  const firstInput = review(input()), first = publishCurrentApa(firstInput);
  const second = review(input(nia, first.record, 2), APA_CONFIRMATION_NARRATIVE_FIELDS, VALUES);
  assert.throws(() => publishCurrentApa(second), /APA_NARRATIVE_SOURCE_REFERENCES_CHANGED/u);
});

test('old5 v1 artifact/receipts remain byte/hash-stable and appended new3 are honestly unknown', () => {
  const firstInput = review(input(nia, null, 1, 'I reviewed the whole report.'), APA_REPORT_NARRATIVE_FIELDS, {});
  const first = asHistoricalV1(publishCurrentApa(firstInput).record);
  const raw = JSON.stringify(first), oldHash = first.artifact.artifact_sha256;
  assert.equal(currentApaView(nia, first).artifact.artifact_sha256, oldHash);
  const projected = verifyApaNarrativeProvenance(first.artifact);
  assert.equal(projected.contract, APA_NARRATIVE_CONTRACT); assert.equal(projected.fields.length, 8);
  assert.equal(projected.fields.slice(5).every(field => field.status === 'BASELINE_UNCITED_AT_FIELD_LEVEL'
    && field.refs.length === 0 && field.source_id === null), true);
  assert.equal(JSON.stringify(first), raw);
  const next = publishCurrentApa(review(input(nia, first, 2)));
  assert.deepEqual(next.record.receipts[0], first.receipts[0]);
  assert.equal(next.receipt.prior_artifact_sha256, oldHash);
  assert.equal(currentApaView(nia, next.record).version, 2);
  assert.equal(JSON.stringify(first), raw);
});

test('historical old5 correction stays compatible without retroactive invented new3 review', () => {
  const firstInput = review(input(nia, null, 1, 'I reviewed the existing report.'), APA_REPORT_NARRATIVE_FIELDS, {});
  const first = asHistoricalV1(publishCurrentApa(firstInput).record);
  const correction = review(input(nia, first, 2, 'I corrected my report; keep the existing agreement.', [sourceId(firstInput)]),
    APA_NARRATIVE_FIELDS, {});
  const oldSecond = asHistoricalV1(publishCurrentApa(correction).record), before = JSON.stringify(oldSecond);
  assert.equal(currentApaView(nia, oldSecond).version, 2);
  assert.equal(verifyApaNarrativeProvenance(oldSecond.artifact).fields.slice(5).every(field => field.source_id === null), true);
  assert.equal(JSON.stringify(oldSecond), before);
  const upgraded = publishCurrentApa(review(input(nia, oldSecond, 3)));
  assert.deepEqual(upgraded.record.receipts.slice(0, 2), oldSecond.receipts);
  assert.equal(upgraded.receipt.prior_artifact_sha256, oldSecond.artifact.artifact_sha256);
  assert.equal(currentApaView(nia, upgraded.record).version, 3);
  assert.equal(JSON.stringify(oldSecond), before);
});

test('each intermediate receipt must preserve valid calendar order even when final current dates are valid', () => {
  const firstInput = review(input()), first = publishCurrentApa(firstInput);
  const retained = Object.fromEntries(APA_CONFIRMATION_NARRATIVE_FIELDS.map(field => [field, [sourceId(firstInput)]]));
  const secondInput = review(input(nia, first.record, 2), APA_CONFIRMATION_NARRATIVE_FIELDS, VALUES, retained);
  const changed = clone(publishCurrentApa(secondInput).record);
  changed.receipts[0].narrative_changes[1].after = '2020-01-01';
  changed.artifact.sources[nia.apa.sources.length].text += ' Explicit invalid prior review: 2020-01-01.';
  rehash(changed);
  assert.equal(changed.artifact.confirmation.review_date, '2026-10-03');
  assert.throws(() => currentApaView(nia, changed), /CURRENT_APA_CONFIRMATION_INVALID/u);
});

test('cold replay rejects rehashed new3 before/value/evidence/contract/order tampering', async context => {
  const submitted = review(input()), first = publishCurrentApa(submitted);
  for (const [name, alter] of [
    ['before priority', record => { record.receipts[0].narrative_changes[0].before = 'Invented prior agreement'; }],
    ['after date', record => { record.receipts[0].narrative_changes[1].after = '2026-10-04'; }],
    ['canonical evidence', record => { record.artifact.sources.at(-1).text = 'No priority or follow-up dates were stated.'; }],
    ['missing contract', record => { delete record.receipts[0].narrative_contract; }],
    ['missing changes', record => { delete record.receipts[0].narrative_changes; }],
    ['old5 downgrade', record => { record.artifact.narrative_provenance.contract = APA_NARRATIVE_CONTRACT_V1;
      record.artifact.narrative_provenance.fields = record.artifact.narrative_provenance.fields.slice(0, 5); }],
    ['current date not receipt', record => { record.artifact.confirmation.review_date = '2026-10-04';
      record.artifact.narrative_provenance.fields[6].value_sha256 = currentApaHash('2026-10-04'); }],
  ]) await context.test(name, () => {
    const changed = clone(first.record); alter(changed); rehash(changed);
    assert.throws(() => currentApaView(nia, changed), /APA_NARRATIVE_PROVENANCE_INVALID|APA_NARRATIVE_SOURCE_TEXT_REQUIRED/u);
  });
});

test('composer uses only canonical confirmed source for new3, remains private and retains complete input/policy', async () => {
  const submitted = review(input()), prior = currentApaView(nia), events = [];
  const delta = { contract: APA_REFERENCE_CODEC_CONTRACT,
    binding: clone(apaDeltaBinding({ bundle: nia, prior, confirmedChange: submitted.confirmedChange })),
    domains: [], futures: [], candidates: [], narratives: submitted.candidate.narrative_updates.map(update =>
      ({ field: update.field, value: clone(update.value), cite_confirmed_update: true })) };
  const compose = createApaComposer({ env: {}, evidenceSink: async event => events.push(event), transport: async request => {
    assert.equal(request.model, 'gpt-5.6-sol'); assert.equal(request.store, false);
    assert.deepEqual(request.reasoning, { effort: 'xhigh' });
    const packet = JSON.parse(request.input);
    assert.equal(packet.saved_athlete_confirmation.text, SOURCE);
    assert.deepEqual(packet.original_apa.confirmation, nia.apa.confirmation);
    assert.deepEqual(packet.accepted_bos, { reading: nia.bos.reading, evidence: nia.bos.evidence });
    return { model: 'gpt-5.6-sol', status: 'completed', output_text: JSON.stringify(delta), usage: null };
  } });
  const before = clone(submitted), composed = await compose(submitted);
  assert.equal(composed.publication_performed, false); assert.equal(composed.changed, true);
  assert.deepEqual(submitted, before); assert.equal(currentApaView(nia).version, 0);
  assert.deepEqual(events.map(event => event.kind), ['request', 'response', 'receipt']);
  assert.equal(publishCurrentApa({ ...submitted, candidate: composed.candidate }).record.artifact.artifact_sha256,
    composed.receipt.preview_content_hash);
});

test('composer cannot accept caller-picked evidence text and does not retry a missing canonical date span', async () => {
  const submitted = review(input(nia, null, 1, 'Thursday practice is shorter.'));
  submitted.confirmedSource = { text: SOURCE }; submitted.sourceText = SOURCE;
  const prior = currentApaView(nia), events = []; let calls = 0;
  const delta = { contract: APA_REFERENCE_CODEC_CONTRACT,
    binding: clone(apaDeltaBinding({ bundle: nia, prior, confirmedChange: submitted.confirmedChange })),
    domains: [], futures: [], candidates: [], narratives: submitted.candidate.narrative_updates.map(update =>
      ({ field: update.field, value: clone(update.value), cite_confirmed_update: true })) };
  const compose = createApaComposer({ env: {}, evidenceSink: async event => events.push(event), transport: async request => {
    calls++;
    assert.equal(JSON.parse(request.input).saved_athlete_confirmation.text, 'Thursday practice is shorter.');
    return { model: 'gpt-5.6-sol', status: 'completed', output_text: JSON.stringify(delta), usage: null };
  } });
  await assert.rejects(compose(submitted), { message: 'APA_COMPOSITION_CANDIDATE_INVALID' });
  assert.equal(calls, 1); assert.deepEqual(events.map(event => event.kind), ['request', 'response', 'failure']);
  assert.equal(events.at(-1).stage, 'reconstruction');
  assert.equal(currentApaView(nia).version, 0);
});

test('closed operation companion is bounded to eight fields, never arbitrary additional edits', () => {
  const submitted = review(input(), APA_NARRATIVE_FIELDS);
  submitted.candidate.narrative_updates.push(clone(submitted.candidate.narrative_updates.at(-1)));
  assert.throws(() => publishCurrentApa(submitted), /APA_NARRATIVE_UPDATE_INVALID/u);
});
