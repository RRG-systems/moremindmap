import assert from 'node:assert/strict';
import test from 'node:test';
import nia from '../server/athleteConsultingV2/fixtures/nia.json' with { type: 'json' };
import { currentApaHash, currentApaView, publishCurrentApa } from '../server/athleteConsultingV2/currentApa.js';
import { buildSessionMapChange, captureSessionStartMap,
  compareSessionMapSummaries } from '../server/athleteConsultingV2/mapChange.js';

const messageId = '11111111-1111-4111-8111-111111111111';
const changeId = '22222222-2222-4222-8222-222222222222';
const sourceId = `APA:CURRENT:${changeId}`;
const clone = value => structuredClone(value);
function stateFor() {
  return { mm: nia.person.mm, revision: 0, currentApa: null,
    sessionId: '77777777-7777-4777-8777-777777777777', apaDraft: null,
    apaNeedsReview: false, plan: null, messages: [] };
}
function summaryPublication(state) {
  const prior = currentApaView(nia, state.currentApa);
  const candidate = { confirmation: clone(prior.artifact.confirmation),
    report: clone(prior.artifact.report), narrative_updates: [] };
  candidate.report.headline = 'A submitted draft and a smaller practice cue';
  candidate.report.opening = 'The synthetic draft is submitted. Friday practice now fits around the rehearsal week.';
  candidate.report.what_we_dont_know = ['Whether the cue helps at Friday practice.', 'Whether the rehearsal schedule stays stable.'];
  for (const field of ['headline', 'opening', 'what_we_dont_know']) {
    candidate.narrative_updates.push({ field, value: clone(candidate.report[field]), refs: [sourceId] });
  }
  state.messages.push({ id: messageId, role: 'user', speaker: 'athlete',
    text: 'The synthetic draft is submitted. I have Friday practice and rehearsals earlier in the week.',
    at: '2026-09-25T08:00:00.000Z' });
  return publishCurrentApa({ bundle: nia, record: state.currentApa, state, candidate,
    expectedVersion: prior.version, confirmedChange: { id: changeId, source_message_id: messageId,
      mm: nia.person.mm, athlete_slug: 'nia', kind: 'reality', supersedes: [], confirmed: true,
      confirmed_by: 'athlete', confirmed_at: '2026-09-25T08:01:00.000Z',
      reason: 'The athlete confirmed the submitted draft and changed week.' } });
}

test('summary-only publication has exact before-after/evidence in saved and pending map review', () => {
  const state = stateFor(), start = captureSessionStartMap({ bundle: nia, state });
  const published = summaryPublication(state);
  state.currentApa = published.record; state.revision++;
  const map = buildSessionMapChange({ bundle: nia, state, startMap: start });
  for (const field of ['headline', 'opening', 'what_we_dont_know']) {
    const entry = map.apa.entries.find(item => item.path === `report.${field}`);
    assert.ok(entry);
    assert.equal(entry.before, typeof nia.apa.report[field] === 'string'
      ? nia.apa.report[field] : JSON.stringify(nia.apa.report[field]));
    assert.equal(entry.now, typeof published.record.artifact.report[field] === 'string'
      ? published.record.artifact.report[field] : JSON.stringify(published.record.artifact.report[field]));
    assert.equal(entry.narrative_evidence.before_refs, null);
    assert.deepEqual(entry.narrative_evidence.after_refs, [sourceId]);
    assert.ok(map.apa.entries.some(item => item.path === `narrative_provenance.${field}`));
  }
  assert.deepEqual(map.apa.comparison_limits, []);
  assert.equal(map.apa.status, 'PUBLISHED_CHANGE');
  assert.equal(map.plan.status, 'UNCHANGED');
  assert.ok(map.object.items.some(item => /APA heading|whole picture/u.test(item.label)));
  const pendingState = { ...state, currentApa: null, apaDraft: { id: 'draft-narrative',
    expectedVersion: 0, previewRecord: published.record } };
  const pending = buildSessionMapChange({ bundle: nia, state: pendingState, startMap: start });
  assert.equal(pending.apa.status, 'UNCHANGED');
  assert.deepEqual(pending.apa.entries, []);
  assert.equal(pending.pendingApa.status, 'PROPOSED_NOT_PUBLISHED');
  assert.deepEqual(pending.pendingApa.narrative_changes, published.receipt.narrative_changes);
});

test('an old baseline snapshot gains missing summary values only through exact immutable hash', () => {
  const state = stateFor(), start = captureSessionStartMap({ bundle: nia, state });
  delete start.apa.fields['report.headline']; delete start.apa.fields['report.opening'];
  for (const key of Object.keys(start.apa.fields))
    if (key.startsWith('narrative_provenance.')) delete start.apa.fields[key];
  const { snapshot_hash: _oldHash, ...body } = start;
  start.snapshot_hash = currentApaHash(body);
  const result = summaryPublication(state); state.currentApa = result.record; state.revision++;
  const map = buildSessionMapChange({ bundle: nia, state, startMap: start });
  assert.equal(map.apa.entries.find(item => item.path === 'report.opening').before, nia.apa.report.opening);
  assert.deepEqual(map.apa.comparison_limits, []);
});

test('two publications compare exact start-to-final narrative evidence, not intermediate receipt provenance', () => {
  const state = stateFor(), start = captureSessionStartMap({ bundle: nia, state });
  const first = summaryPublication(state); state.currentApa = first.record; state.revision++;
  const nextMessage = '33333333-3333-4333-8333-333333333333';
  const nextChange = '44444444-4444-4444-8444-444444444444';
  const nextSource = `APA:CURRENT:${nextChange}`;
  state.messages.push({ id: nextMessage, role: 'user', speaker: 'athlete',
    text: 'I reviewed the submitted-draft whole picture again and confirmed it remains accurate.',
    at: '2026-09-25T08:03:00.000Z' });
  const candidate = { confirmation: clone(first.record.artifact.confirmation),
    report: clone(first.record.artifact.report), narrative_updates: [{ field: 'opening',
      value: first.record.artifact.report.opening, refs: [sourceId, nextSource] }] };
  const second = publishCurrentApa({ bundle: nia, record: first.record, state, candidate,
    expectedVersion: 1, confirmedChange: { id: nextChange, source_message_id: nextMessage,
      mm: nia.person.mm, athlete_slug: 'nia', kind: 'reality', supersedes: [], confirmed: true,
      confirmed_by: 'athlete', confirmed_at: '2026-09-25T08:04:00.000Z',
      reason: 'The athlete reviewed and reconfirmed the current whole picture.' } });
  state.currentApa = second.record; state.revision++;
  assert.equal(second.receipt.narrative_changes[0].value_changed, false);
  assert.equal(second.receipt.narrative_changes[0].prior_provenance, 'SOURCE_BOUND');
  const map = buildSessionMapChange({ bundle: nia, state, startMap: start });
  for (const path of ['report.opening', 'narrative_provenance.opening']) {
    const evidence = map.apa.entries.find(entry => entry.path === path).narrative_evidence;
    assert.equal(evidence.before_refs, null);
    assert.equal(evidence.prior_provenance, 'BASELINE_FIELD_UNCITED');
    assert.deepEqual(evidence.after_refs, [sourceId, nextSource]);
    assert.equal(evidence.value_changed, true);
    assert.equal(evidence.reference_changed, true);
    assert.equal(evidence.source_id, nextSource);
  }
  assert.equal(map.apa.receipts.length, 2);
  assert.equal(map.apa.receipts[1].narrative_changes[0].value_changed, false);
  assert.equal(map.apa.entries.find(entry => entry.path === 'report.opening').before, nia.apa.report.opening);
});

test('old current snapshots require matching immediate prior version AND artifact hash', () => {
  const now = { version: 5, artifact_hash: 'b'.repeat(64), fields: {
    'report.headline': 'Now heading', 'report.opening': 'Now whole picture' }, candidate_ids: [] };
  const start = { version: 4, artifact_hash: 'a'.repeat(64), fields: {}, candidate_ids: [] };
  const entry = { field: 'opening', before: 'Exact start whole picture', after: 'Now whole picture',
    prior_provenance: 'BASELINE_FIELD_UNCITED' };
  const receipt = { prior_version: 4, prior_artifact_sha256: 'a'.repeat(64),
    version: 5, narrative_changes: [entry] };
  const matched = compareSessionMapSummaries(nia, start, now, [receipt]);
  assert.equal(matched.before.fields['report.opening'], 'Exact start whole picture');
  assert.ok(matched.limits.includes('report.headline'));
  for (const change of [
    { prior_artifact_sha256: 'c'.repeat(64) }, { prior_version: 3 }, { version: 6 },
    { prior_version: 5, version: 6 },
  ]) {
    const result = compareSessionMapSummaries(nia, start, now, [{ ...receipt, ...change }]);
    assert.equal(Object.hasOwn(result.before.fields, 'report.opening'), false);
    assert.equal(Object.hasOwn(result.now.fields, 'report.opening'), false);
    assert.ok(result.limits.includes('report.opening'));
  }
  const laterOnly = compareSessionMapSummaries(nia, start, now, [
    { ...receipt, version: 5, narrative_changes: [] },
    { ...receipt, prior_version: 5, version: 6, prior_artifact_sha256: 'd'.repeat(64) },
  ]);
  assert.equal(Object.hasOwn(laterOnly.before.fields, 'report.opening'), false);
  assert.ok(laterOnly.limits.includes('report.opening'));
  const mismatchedBaseline = compareSessionMapSummaries(nia, { ...start, version: 0 }, now, []);
  assert.equal(Object.hasOwn(mismatchedBaseline.before.fields, 'report.opening'), false);
});
