import assert from 'node:assert/strict';
import test from 'node:test';
import { bundles } from '../server/athleteConsultingV2/bundles.js';
import { currentApaHash, currentApaView, publishCurrentApa } from '../server/athleteConsultingV2/currentApa.js';
import { APA_NARRATIVE_FIELDS, getApaNarrativeValue } from '../server/athleteConsultingV2/apaNarrative.js';
import { buildLegacySessionMapChange, buildSessionMapChange, captureSessionStartMap,
  SESSION_MAP_CHANGE_CONTRACT, SESSION_MAP_START_CONTRACT } from '../server/athleteConsultingV2/mapChange.js';

const clone = value => structuredClone(value);
const firstMessage = '11111111-1111-4111-8111-111111111111';
const firstChange = '22222222-2222-4222-8222-222222222222';
const secondMessage = '33333333-3333-4333-8333-333333333333';
const secondChange = '44444444-4444-4444-8444-444444444444';
const sourceId = id => `APA:CURRENT:${id}`;

function stateFor(bundle = bundles.nia) {
  return { mm: bundle.person.mm, revision: 0, currentApa: null,
    sessionId: '77777777-7777-4777-8777-777777777777',
    apaDraft: null, apaNeedsReview: false, plan: null, messages: [] };
}

function publish(bundle, state, { messageId = firstMessage, changeId = firstChange,
  at = '2026-09-25T08:00:00.000Z', text = 'My Tuesday practice is now shorter.',
  gap = 'Tuesday practice now gives me room for a passing cue.',
  kind = 'reality', supersedes = [], decorateCandidate = null } = {}) {
  state.messages.push({ id: messageId, role: 'user', speaker: 'athlete', text, at });
  const prior = currentApaView(bundle, state.currentApa);
  const candidate = { confirmation: clone(prior.artifact.confirmation),
    report: clone(prior.artifact.report) };
  const domain = candidate.report.domains.find(item => item.id === 'training');
  domain.gap = gap;
  domain.refs = domain.refs.filter(id => !supersedes.includes(id));
  domain.refs.push(sourceId(changeId));
  if (kind === 'correction') {
    // The fixture explicitly reviews baseline summaries with unknown original
    // field citations; production now refuses silently carrying them forward.
    candidate.narrative_updates = APA_NARRATIVE_FIELDS
      .map(field => ({ field, value: clone(getApaNarrativeValue(candidate, field)),
        refs: [...(prior.artifact.narrative_provenance?.fields.find(item => item.field === field)?.refs || [])
          .filter(id => !supersedes.includes(id)), sourceId(changeId)] }));
  }
  decorateCandidate?.(candidate, sourceId(changeId));
  const result = publishCurrentApa({ bundle, record: state.currentApa, state,
    confirmedChange: { id: changeId, source_message_id: messageId,
      mm: bundle.person.mm, athlete_slug: bundle.person.slug,
      kind, supersedes, confirmed: true, confirmed_by: 'athlete',
      confirmed_at: new Date(Date.parse(at) + 60000).toISOString(),
      reason: kind === 'correction' ? 'The athlete corrected the day of practice.'
        : 'The athlete confirmed her current practice schedule.' },
    candidate, expectedVersion: prior.version });
  assert.equal(result.changed, true);
  state.currentApa = result.record;
  state.revision++;
  return result;
}

function acceptedPlan() {
  return { id: '55555555-5555-4555-8555-555555555555',
    hash: 'a'.repeat(64), title: 'Try one passing cue', why: 'Nia chose a smaller step.',
    steps: [{ action: 'Try a cue', when: 'Thursday', notice: 'Whether it helped', owner: 'athlete' }],
    review: 'After Thursday practice', approvals: ['athlete'],
    accepted_at: '2026-09-25T08:02:00.000Z' };
}

test('unchanged session is explicit and its snapshot survives JSON persistence', () => {
  const state = stateFor();
  const start = JSON.parse(JSON.stringify(captureSessionStartMap({ bundle: bundles.nia, state })));
  assert.equal(start.contract, SESSION_MAP_START_CONTRACT);
  const result = buildSessionMapChange({ bundle: bundles.nia, state, startMap: start });
  assert.equal(result.contract, SESSION_MAP_CHANGE_CONTRACT);
  assert.equal(result.apa.status, 'UNCHANGED');
  assert.equal(result.plan.status, 'UNCHANGED');
  assert.equal(result.apa.entries.length, 0);
  assert.deepEqual(result.unchanged, { saved_apa: true, accepted_plan: true });
  assert.equal(result.object.kind, 'MAP_CHANGE_REVEAL');
  assert.match(result.object.statement, /No saved APA or accepted-plan change/u);
  assert.ok(result.object.items.every(item => typeof item.label === 'string'
    && typeof item.value === 'string' && typeof item.note === 'string'));
  assert.equal(bundles.nia.apa.artifact_sha256, start.apa.artifact_hash);
});

test('published APA is an exact before-to-now change with source receipt and baseline lineage', () => {
  const state = stateFor(), start = captureSessionStartMap({ bundle: bundles.nia, state });
  const published = publish(bundles.nia, state);
  const result = buildSessionMapChange({ bundle: bundles.nia, state, startMap: start });
  assert.equal(result.apa.status, 'PUBLISHED_CHANGE');
  assert.equal(result.apa.before.version, 0);
  assert.equal(result.apa.now.version, 1);
  assert.equal(result.apa.before.artifact_hash, bundles.nia.apa.artifact_sha256);
  assert.equal(result.apa.now.artifact_hash, published.record.artifact.artifact_sha256);
  const entry = result.apa.entries.find(item => item.path === 'report.domains.training.gap');
  assert.ok(entry);
  assert.equal(entry.before, bundles.nia.apa.report.domains.find(item => item.id === 'training').gap);
  assert.equal(entry.now, published.record.artifact.report.domains.find(item => item.id === 'training').gap);
  assert.equal(entry.receipts[0].receipt_hash, published.receipt.receipt_hash);
  assert.equal(entry.receipts[0].source_id, sourceId(firstChange));
  assert.equal(entry.receipts[0].reason, 'The athlete confirmed her current practice schedule.');
  assert.equal(result.plan.status, 'UNCHANGED');
  assert.equal(result.pendingApa, null);
  assert.ok(result.object.sourceIds.includes('athlete-source-apa-receipt-v1'));
});

test('a pending APA candidate is separate and never counted as a saved map change', () => {
  const state = stateFor(), start = captureSessionStartMap({ bundle: bundles.nia, state });
  const preview = publish(bundles.nia, state);
  state.currentApa = null;
  state.apaDraft = { id: '66666666-6666-4666-8666-666666666666',
    expectedVersion: 0, previewRecord: preview.record };
  const result = buildSessionMapChange({ bundle: bundles.nia, state, startMap: start });
  assert.equal(result.apa.status, 'UNCHANGED');
  assert.equal(result.apa.now.version, 0);
  assert.equal(result.apa.entries.length, 0);
  assert.equal(result.pendingApa.status, 'PROPOSED_NOT_PUBLISHED');
  assert.equal(result.pendingApa.proposed_version, 1);
  assert.equal(result.pendingApa.artifact_hash, preview.record.artifact.artifact_sha256);
  assert.ok(result.object.items.some(item => item.label === 'APA proposal'
    && item.value.includes('not published')));
  assert.ok(result.sources.some(source => source.classification === 'SYNTHETIC_PROPOSED_ONLY'));
});

test('accepted plan changes independently from an unchanged APA', () => {
  const state = stateFor(), start = captureSessionStartMap({ bundle: bundles.nia, state });
  state.plan = acceptedPlan();
  state.revision++;
  const result = buildSessionMapChange({ bundle: bundles.nia, state, startMap: start });
  assert.equal(result.apa.status, 'UNCHANGED');
  assert.equal(result.plan.status, 'ACCEPTED_CHANGE');
  assert.equal(result.plan.before, null);
  assert.equal(result.plan.now.title, state.plan.title);
  assert.equal(result.plan.reason, state.plan.why);
  assert.equal(result.plan.binding.now.id, state.plan.id);
  assert.equal(result.plan.binding.now.hash, currentApaHash(state.plan));
  assert.equal(result.sources.find(source => source.id === 'athlete-source-accepted-plan').hash,
    currentApaHash(state.plan));
  assert.match(result.object.statement, /accepted plan changed.*saved APA did not/u);
});

test('correction chains from session-start version and attributes exact newer receipt', () => {
  const state = stateFor();
  const first = publish(bundles.nia, state);
  const start = captureSessionStartMap({ bundle: bundles.nia, state });
  const corrected = publish(bundles.nia, state, { messageId: secondMessage,
    changeId: secondChange, at: '2026-09-25T08:03:00.000Z',
    text: 'Correction: Thursday, not Tuesday, is the shorter practice.',
    gap: 'Thursday, not Tuesday, is now the shorter practice.',
    kind: 'correction', supersedes: [sourceId(firstChange)] });
  const result = buildSessionMapChange({ bundle: bundles.nia, state, startMap: start });
  assert.equal(result.apa.before.version, 1);
  assert.equal(result.apa.now.version, 2);
  assert.equal(result.apa.receipts.length, 1);
  assert.equal(result.apa.receipts[0].prior_hash, first.receipt.receipt_hash);
  assert.equal(result.apa.receipts[0].receipt_hash, corrected.receipt.receipt_hash);
  const entry = result.apa.entries.find(item => item.path === 'report.domains.training.gap');
  assert.equal(entry.receipts[0].reason, 'The athlete corrected the day of practice.');
  assert.equal(entry.now, 'Thursday, not Tuesday, is now the shorter practice.');
});

test('candidate gate and BOS-fit changes use exact granular receipt paths and balanced visual sections', () => {
  const state = stateFor(), start = captureSessionStartMap({ bundle: bundles.nia, state });
  const result = publish(bundles.nia, state, { decorateCandidate(candidate, source) {
    const future = candidate.report.futures[0];
    future.headline = 'A shorter week with a clearer first cue';
    future.refs.push(source);
    const option = candidate.report.candidates[0];
    option.bos_fit += ' The athlete confirmed a shorter practice window.';
    option.refs.push(source);
    option.gates[0].reason += ' The athlete confirmed the timing.';
    option.gates[0].refs.push(source);
  } });
  const changed = buildSessionMapChange({ bundle: bundles.nia, state, startMap: start });
  assert.ok(result.receipt.material_paths.some(path => path.endsWith('.bos_fit')));
  assert.ok(result.receipt.material_paths.some(path => /\.gates\.[^.]+\.reason$/u.test(path)));
  assert.ok(changed.apa.entries.some(entry => entry.path.endsWith('.bos_fit')));
  assert.ok(changed.apa.entries.some(entry => /\.gates\.[^.]+\.reason$/u.test(entry.path)));
  const labels = changed.object.items.map(item => item.label).join(' ');
  assert.match(labels, /training/iu);
  assert.match(labels, /future/iu);
  assert.match(labels, /option/iu);
});

test('a changed One Move names both actions and the current fit instead of exposing selector IDs', () => {
  const state = stateFor(), start = captureSessionStartMap({ bundle: bundles.nia, state });
  const originalMove = bundles.nia.apa.move;
  const result = publish(bundles.nia, state, { decorateCandidate(candidate, source) {
    const original = candidate.report.candidates.find(item => item.candidate_id === originalMove.candidate_id);
    original.refs.push(source);
    original.gates[0].pass = false;
    original.gates[0].reason = 'Nia confirmed this step needs a different coach agreement first.';
    original.gates[0].refs.push(source);
  } });
  const changed = buildSessionMapChange({ bundle: bundles.nia, state, startMap: start });
  const move = changed.apa.entries.find(entry => entry.path === 'move.selection');
  assert.ok(move);
  assert.equal(move.label, 'Your One Move');
  assert.equal(move.before, originalMove.action);
  assert.equal(move.now, result.record.artifact.move.action);
  assert.equal(move.before_rationale, originalMove.why);
  assert.equal(move.now_rationale, result.record.artifact.move.why);
  assert.equal(move.selection.before.candidate_id, originalMove.candidate_id);
  assert.equal(move.selection.now.candidate_id, result.record.artifact.move.candidate_id);
  assert.ok(move.receipts.some(receipt => receipt.source_id === sourceId(firstChange)));
  const row = changed.object.items.find(item => item.label === 'Your One Move');
  assert.ok(row);
  assert.match(row.value, /Ask your coach to try a next-play reset/u);
  assert.match(row.value, /During Monday and Wednesday team practice/u);
  assert.match(row.note, /Why this fits now:/u);
  assert.doesNotMatch(row.value, /candidate_id|\bM[1-4]\b|\{"status"/u);
});

test('same-title accepted-plan timing edit has a meaningful before-to-now line and exact binding', () => {
  const state = stateFor();
  state.plan = acceptedPlan();
  const start = captureSessionStartMap({ bundle: bundles.nia, state });
  const revised = acceptedPlan();
  revised.id = '99999999-9999-4999-8999-999999999999';
  revised.accepted_at = '2026-09-25T09:00:00.000Z';
  revised.steps[0].when = 'Friday';
  state.plan = revised;
  state.revision++;
  const changed = buildSessionMapChange({ bundle: bundles.nia, state, startMap: start });
  assert.equal(changed.plan.status, 'ACCEPTED_CHANGE');
  assert.equal(changed.plan.binding.before.id, start.plan.id);
  assert.equal(changed.plan.binding.now.id, revised.id);
  assert.equal(changed.plan.binding.now.hash, currentApaHash(revised));
  assert.ok(changed.plan.entries.some(entry => entry.path === 'plan.steps.0.when'
    && entry.before === 'Thursday' && entry.now === 'Friday'));
  assert.ok(changed.object.items.some(item => item.label === 'Accepted plan'
    && item.value.includes('Thursday → Friday')));
});

test('bounded visual rows still show both sides of long APA and plan changes', () => {
  const state = stateFor();
  const oldGap = `Earlier practice detail: ${'careful timing '.repeat(24)}`;
  const newGap = `New practice detail: ${'shorter timing '.repeat(24)}`;
  publish(bundles.nia, state, { gap: oldGap });
  state.plan = acceptedPlan();
  state.plan.steps[0].when = `Earlier timing: ${'Thursday practice '.repeat(15)}`;
  const start = captureSessionStartMap({ bundle: bundles.nia, state });
  publish(bundles.nia, state, { messageId: secondMessage, changeId: secondChange,
    at: '2026-09-25T08:03:00.000Z', gap: newGap,
    text: 'The practice timing changed again.' });
  const revised = acceptedPlan();
  revised.id = '99999999-9999-4999-8999-999999999999';
  revised.accepted_at = '2026-09-25T09:00:00.000Z';
  revised.steps[0].when = `New timing: ${'Friday practice '.repeat(15)}`;
  state.plan = revised;
  state.revision++;
  const changed = buildSessionMapChange({ bundle: bundles.nia, state, startMap: start });
  const apaRow = changed.object.items.find(item => item.label.includes('training'));
  const planRow = changed.object.items.find(item => item.label === 'Accepted plan');
  assert.match(apaRow.value, /Earlier practice detail:/u);
  assert.match(apaRow.value, /→ New practice detail:/u);
  assert.match(planRow.value, /Earlier timing:/u);
  assert.match(planRow.value, /→ New timing:/u);
  assert.ok(apaRow.value.length <= 179);
  assert.ok(planRow.value.length <= 174);
  assert.equal(changed.apa.entries.find(item => item.path === 'report.domains.training.gap').now,
    newGap);
});

test('a newly accepted copy of identical plan details is labeled reaffirmed, without UUIDs in visual copy', () => {
  const state = stateFor();
  state.plan = acceptedPlan();
  const start = captureSessionStartMap({ bundle: bundles.nia, state });
  const reaffirmed = acceptedPlan();
  reaffirmed.id = '99999999-9999-4999-8999-999999999999';
  reaffirmed.accepted_at = '2026-09-25T09:00:00.000Z';
  state.plan = reaffirmed;
  state.revision++;
  const result = buildSessionMapChange({ bundle: bundles.nia, state, startMap: start });
  const planRow = result.object.items.find(item => item.label === 'Accepted plan');
  assert.match(planRow.value, /reaffirmed/u);
  assert.doesNotMatch(planRow.value, /99999999|55555555/u);
  assert.equal(result.plan.binding.before.id, start.plan.id);
  assert.equal(result.plan.binding.now.id, reaffirmed.id);
});

test('published revisions that net back to the starting map do not claim a material saved change', () => {
  const state = stateFor(), start = captureSessionStartMap({ bundle: bundles.nia, state });
  publish(bundles.nia, state);
  publish(bundles.nia, state, { messageId: secondMessage, changeId: secondChange,
    at: '2026-09-25T08:03:00.000Z',
    text: 'After checking, the practice constraint is the original one.',
    gap: bundles.nia.apa.report.domains.find(item => item.id === 'training').gap });
  const changed = buildSessionMapChange({ bundle: bundles.nia, state, startMap: start });
  assert.equal(changed.apa.status, 'PUBLISHED_LINEAGE_NO_NET_CHANGE');
  assert.equal(changed.apa.version_advanced, true);
  assert.equal(changed.apa.net_material_change, false);
  assert.equal(changed.apa.entries.length, 0);
  assert.equal(changed.unchanged.saved_apa, true);
  assert.match(changed.object.statement, /current map matches where this session began/u);
});

test('historical awaiting-review APA is not claimed as a new saved update', () => {
  const state = stateFor();
  publish(bundles.nia, state);
  const start = captureSessionStartMap({ bundle: bundles.nia, state });
  state.apaNeedsReview = true;
  state.revision++;
  const result = buildSessionMapChange({ bundle: bundles.nia, state, startMap: start });
  assert.equal(result.apa.status, 'HISTORICAL_AWAITING_ATHLETE_REVIEW');
  assert.equal(result.apa.before.needs_review, false);
  assert.equal(result.apa.now.needs_review, true);
  assert.equal(result.unchanged.saved_apa, true);
  assert.equal(result.apa.entries.length, 0);
  assert.match(result.object.statement, /historical and awaiting athlete review/u);
  assert.ok(result.sources.some(source => source.classification === 'SYNTHETIC_HISTORICAL'));
});

test('legacy session closing shows current custody without inventing its missing starting map', () => {
  const state = stateFor();
  state.apaNeedsReview = true;
  const result = buildLegacySessionMapChange({ bundle: bundles.nia, state });
  assert.equal(result.comparison, 'UNAVAILABLE_START_SNAPSHOT');
  assert.equal(result.apa.status, 'START_UNAVAILABLE');
  assert.equal(result.apa.before, null);
  assert.equal(result.plan.before, null);
  assert.deepEqual(result.unchanged, { saved_apa: null, accepted_plan: null });
  assert.match(result.object.statement, /before-and-after comparison is unavailable/u);
  assert.match(result.object.items[0].value, /historical, awaiting review/u);
  assert.equal(result.sources[0].classification, 'SYNTHETIC_HISTORICAL');
  assert.equal(result.sources.some(source => source.id === 'athlete-source-map-start'), false);
  assert.doesNotMatch(JSON.stringify(result.object), /changed this session|No saved APA or accepted-plan change/u);
});

test('tampered, cross-athlete and forked start snapshots fail closed', () => {
  const state = stateFor();
  const start = captureSessionStartMap({ bundle: bundles.nia, state });
  const tampered = clone(start);
  tampered.apa.fields['confirmation.priority'] = 'Quietly changed';
  assert.throws(() => buildSessionMapChange({ bundle: bundles.nia, state, startMap: tampered }),
    /MAP_CHANGE_START_INVALID/u);
  const forged = clone(start);
  forged.apa.artifact_hash = 'b'.repeat(64);
  const { snapshot_hash: _old, ...unsigned } = forged;
  forged.snapshot_hash = currentApaHash(unsigned);
  assert.throws(() => buildSessionMapChange({ bundle: bundles.nia, state, startMap: forged }),
    /MAP_CHANGE_LINEAGE_CHANGED/u);
  assert.throws(() => buildSessionMapChange({ bundle: bundles.sofia,
    state: stateFor(bundles.sofia), startMap: start }), /MAP_CHANGE_START_INVALID/u);
  const otherSession = stateFor();
  otherSession.sessionId = '88888888-8888-4888-8888-888888888888';
  assert.throws(() => buildSessionMapChange({ bundle: bundles.nia,
    state: otherSession, startMap: start }), /MAP_CHANGE_START_INVALID/u);
});
