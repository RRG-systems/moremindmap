import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import { bundles } from '../server/athleteConsultingV2/bundles.js';
import { currentApaView, publishCurrentApa } from '../server/athleteConsultingV2/currentApa.js';
import { buildSessionMapChange, buildLegacySessionMapChange, captureSessionStartMap } from '../server/athleteConsultingV2/mapChange.js';
import { APA_NARRATIVE_FIELDS, getApaNarrativeValue, setApaNarrativeValue } from '../server/athleteConsultingV2/apaNarrative.js';

const clone = value => structuredClone(value);
const messageId = '11111111-1111-4111-8111-111111111111';
const changeId = '22222222-2222-4222-8222-222222222222';
const sourceId = `APA:CURRENT:${changeId}`;
const REVIEW = 'The athlete reviewed the complete saved update.';
function fixture(bundle = bundles.nia) {
  const state = { mm: bundle.person.mm, revision: 0, currentApa: null, plan: null, apaDraft: null,
    apaNeedsReview: false, sessionId: '77777777-7777-4777-8777-777777777777', messages: [] };
  const start = captureSessionStartMap({ bundle, state });
  function publish(change = () => {}, text = 'I reviewed my current practice and the full reading.') {
    state.messages.push({ id: messageId, role: 'user', speaker: 'athlete', text, at: '2026-09-27T18:00:00.000Z' });
    const prior = currentApaView(bundle, state.currentApa);
    const candidate = { confirmation: clone(prior.artifact.confirmation), report: clone(prior.artifact.report), narrative_updates: [] };
    change(candidate, prior.artifact);
    const result = publishCurrentApa({ bundle, record: state.currentApa, state, candidate,
      expectedVersion: prior.version, confirmedChange: { id: changeId, source_message_id: messageId,
        mm: bundle.person.mm, athlete_slug: bundle.person.slug, kind: 'reality', supersedes: [],
        confirmed: true, confirmed_by: 'athlete', confirmed_at: '2026-09-27T18:01:00.000Z', reason: REVIEW } });
    assert.equal(result.changed, true); state.currentApa = result.record; state.revision++;
    return result;
  }
  return { state, start, bundle, publish, map: () => buildSessionMapChange({ bundle, state, startMap: start }) };
}
function narrative(candidate, field, value) {
  setApaNarrativeValue(candidate, field, value);
  candidate.narrative_updates.push({ field, value: clone(value), refs: [sourceId] });
}

test('presentation priorities come from exact reviewed priority/timing, not sorted metadata or the first candidate', t => {
  const f = fixture(), priority = 'Protect school time while practising one first pass.';
  const published = f.publish(candidate => {
    narrative(candidate, 'headline', 'A calmer week with room for school');
    narrative(candidate, 'opening', 'School time now needs protection alongside a shorter practice.');
    narrative(candidate, 'confirmation.priority', priority);
    narrative(candidate, 'confirmation.review_date', '2026-10-05');
    narrative(candidate, 'confirmation.horizon_date', '2026-12-03');
    candidate.report.domains[1].gap = 'The shorter practice now leaves less room for a first-pass cue.';
    candidate.report.domains[1].refs.push(sourceId);
    candidate.report.futures[0].headline = 'A week where school has protected time';
    candidate.report.futures[0].refs.push(sourceId);
    const unselected = candidate.report.candidates.find(item => item.candidate_id !== f.bundle.apa.move.candidate_id);
    unselected.bos_fit += ' A private comparison detail was reviewed.';
    unselected.refs.push(sourceId);
    unselected.gates[0].reason += ' The same athlete review was recorded.';
    unselected.gates[0].refs.push(sourceId);
    const selected = candidate.report.candidates.find(item => item.candidate_id === f.bundle.apa.move.candidate_id);
    selected.why += ' The shorter practice makes this a bounded option.';
    selected.refs.push(sourceId);
  }, `My priority is ${priority} Review October 5, 2026 and plan through December 3, 2026. School time needs protection in my shorter practice week.`);
  const result = f.map(), items = result.object.items, details = result.object.details;
  assert.deepEqual(items.slice(0, 3).map(item => item.label), ['Your current priority', 'Your agreed review date', 'Your planning horizon']);
  assert(items.some(item => item.label === 'Your whole picture'));
  assert(items.some(item => /future/iu.test(item.label)));
  assert(items.some(item => /Your suggested One Move/u.test(item.label)));
  assert(!items.some(item => /Another assessment option|comparison evidence| · evidence/u.test(item.label)));
  assert(items.some(item => item.value === 'Review all saved changes'));
  assert(!items.some(item => /\d+ other saved details changed/u.test(item.value)));
  assert(!/\bM[1-4]\b|bos_fit|source_message_id|selection_signals|gates\./u.test(items.map(item => item.label).join(' ')));
  assert.equal(details.length, result.apa.entries.length + result.plan.entries.length);
  assert(details.some(item => /Another assessment option/u.test(item.label)));
  assert.deepEqual(result.apa.receipts[0].material_paths, published.receipt.material_paths);
  for (const item of items) assert(!item.note.includes(REVIEW), 'generic confirmation is not a field-specific cause');
  for (const detail of details) {
    assert(detail.evidence_note.startsWith('Recorded athlete review:'));
    assert(detail.sourceIds.every(id => result.sources.some(source => source.id === id)));
    if (detail.change_type === 'EVIDENCE') assert.equal(result.apa.entries.find(entry => entry.path === detail.path).narrative_evidence.value_changed, false);
  }
  const bytes = Buffer.byteLength(JSON.stringify(result));
  assert(bytes < 256 * 1024); t.diagnostic(`representative_many_field_packet_bytes=${bytes}; ceiling=262144`);
});

test('a long common prefix cannot hide the changed meaning; both complete sides remain accessible', () => {
  const f = fixture(), shared = 'A carefully reviewed school and practice description. '.repeat(12);
  // This test's prior value is an already published reading, not a fabricated
  // start snapshot. A new session begins at its exact immutable current map.
  f.publish(candidate => {
    candidate.report.domains[1].detail = `${shared}Tuesday is the available practice day. End of the same account.`;
    candidate.report.domains[1].refs.push(sourceId);
  });
  const start = captureSessionStartMap({ bundle: f.bundle, state: f.state });
  const secondId = '44444444-4444-4444-8444-444444444444', secondSource = `APA:CURRENT:${secondId}`;
  const prior = currentApaView(f.bundle, f.state.currentApa), next = { confirmation: clone(prior.artifact.confirmation), report: clone(prior.artifact.report) };
  next.report.domains[1].detail = `${shared}Friday is the available practice day. End of the same account.`;
  next.report.domains[1].refs.push(secondSource);
  const secondMessage = '33333333-3333-4333-8333-333333333333';
  f.state.messages.push({ id: secondMessage, role: 'user', speaker: 'athlete', text: 'My practice day is now Friday.', at: '2026-09-27T18:02:00.000Z' });
  const result = publishCurrentApa({ bundle: f.bundle, record: f.state.currentApa, state: f.state, candidate: next,
    expectedVersion: 1, confirmedChange: { id: secondId, source_message_id: secondMessage, mm: f.bundle.person.mm,
      athlete_slug: f.bundle.person.slug, kind: 'reality', supersedes: [], confirmed: true, confirmed_by: 'athlete',
      confirmed_at: '2026-09-27T18:03:00.000Z', reason: REVIEW } });
  f.state.currentApa = result.record; f.state.revision++;
  const map = buildSessionMapChange({ bundle: f.bundle, state: f.state, startMap: start });
  const path = 'report.domains.training.detail', row = map.object.items.find(item => /Training/u.test(item.label));
  const detail = map.object.details.find(item => item.path === path);
  assert.match(row.value, /Tuesday/u); assert.match(row.value, /Friday/u); assert.match(row.note, /Excerpt/u);
  assert.notEqual(row.value.split(' → ')[0], row.value.split(' → ')[1]);
  assert.equal(detail.before, prior.artifact.report.domains[1].detail);
  assert.equal(detail.now, next.report.domains[1].detail);
  assert(detail.before.length > 600); assert(detail.now.length > 600);
});

test('provenance-only reconfirmation is explicitly separate from changed wording', () => {
  const f = fixture();
  f.publish((candidate, original) => {
    for (const field of APA_NARRATIVE_FIELDS) narrative(candidate, field, getApaNarrativeValue(original, field));
  });
  const map = f.map();
  assert(map.apa.entries.every(entry => entry.path.startsWith('narrative_provenance.')));
  assert.match(map.object.statement, /saved wording is unchanged/u);
  assert(map.object.details.every(item => item.change_type === 'EVIDENCE'));
  assert(map.object.items.some(item => item.value === 'Same wording, reviewed evidence.'));
  assert(!map.object.items.some(item => item.value.includes('→') && /priority|review date|horizon/u.test(item.label)));
});

test('substantive future evidence support and gate changes are not mislabeled same-wording provenance', () => {
  const f = fixture();
  f.publish(candidate => {
    candidate.report.futures[0].sufficient_evidence = !candidate.report.futures[0].sufficient_evidence;
    candidate.report.futures[0].refs.push(sourceId);
    const option = candidate.report.candidates.find(item => item.candidate_id !== f.bundle.apa.move.candidate_id);
    option.gates[0].reason = 'The athlete still needs to decide whether this option fits.';
    option.gates[0].refs.push(sourceId); option.refs.push(sourceId);
  });
  const map = f.map();
  assert(map.object.details.filter(item => item.path.endsWith('.sufficient_evidence') || item.path.includes('.gates.'))
    .every(item => item.change_type === 'CONTENT'));
  assert(!map.object.details.some(item => /\{"/u.test(item.before + item.now)));
});

test('string-list detail has complete typed lines and legacy/unpublished states make no invented comparison', () => {
  const f = fixture(), values = ['The changed practice week still needs checking.', 'No independent coach agreement has been recorded.'];
  const result = f.publish(candidate => narrative(candidate, 'what_we_dont_know', values));
  const map = f.map(), detail = map.object.details.find(item => item.path === 'report.what_we_dont_know');
  assert.deepEqual(detail.now_lines, values); assert.equal(detail.now, values.join('\n'));
  assert.deepEqual(detail.before_lines, f.bundle.apa.report.what_we_dont_know);
  f.state.currentApa = null; f.state.apaDraft = { id: 'unpublished-detail-only', expectedVersion: 0, previewRecord: result.record };
  const pending = f.map(); assert.deepEqual(pending.object.details, []); assert.equal(pending.apa.status, 'UNCHANGED');
  assert.equal(pending.pendingApa.status, 'PROPOSED_NOT_PUBLISHED');
  const legacy = buildLegacySessionMapChange({ bundle: f.bundle, state: f.state });
  assert.equal(legacy.comparison, 'UNAVAILABLE_START_SNAPSHOT'); assert.deepEqual(legacy.unchanged, { saved_apa: null, accepted_plan: null });
  assert(!legacy.object.details?.length);
});
