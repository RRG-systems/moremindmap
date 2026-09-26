import test from 'node:test';
import assert from 'node:assert/strict';
import nia from '../server/athleteConsultingV2/fixtures/nia.json' with { type: 'json' };
import sofia from '../server/athleteConsultingV2/fixtures/sofia.json' with { type: 'json' };
import { publishCurrentApa } from '../server/athleteConsultingV2/currentApa.js';
import { apaBoxContextMessage, project, requestedApaReading, resolveApaReading, shouldRefreshApa } from '../src/athleteConsultingV2/approved-apa/projection.js';

const clone = value => structuredClone(value);
const messageId = '11111111-1111-4111-8111-111111111111';
const changeId = '22222222-2222-4222-8222-222222222222';

function currentState() {
  const state = { mm: nia.person.mm, revision: 4,
    messages: [{ id: messageId, role: 'user', speaker: 'athlete',
      text: 'My Tuesday practice is now shorter and I have more time for the passing cue.',
      at: '2026-09-25T08:00:00.000Z' }],
    plan: { id: 'agreed-plan', title: 'A separate chosen plan', why: 'It fits the week.',
      steps: [{ action: 'Try one cue', when: 'Thursday', notice: 'A calmer choice', owner: 'athlete' }],
      review: 'Next week', accepted_at: '2026-09-25T08:02:00.000Z' } };
  const candidate = { confirmation: clone(nia.apa.confirmation), report: clone(nia.apa.report) };
  const source = `APA:CURRENT:${changeId}`;
  candidate.report.domains[1].gap = 'A shorter Tuesday practice now leaves room for a passing cue.';
  candidate.report.domains[1].refs.push(source);
  candidate.report.futures[0].headline = 'A shorter practice with a clear cue';
  candidate.report.futures[0].refs.push(source);
  const published = publishCurrentApa({ bundle: nia, state, confirmedChange: {
    id: changeId, source_message_id: messageId, athlete_slug: 'nia', mm: nia.person.mm,
    kind: 'reality', supersedes: [], confirmed: true, confirmed_by: 'athlete',
    confirmed_at: '2026-09-25T08:01:00.000Z', reason: 'Nia confirmed her practice schedule changed.',
  }, candidate, expectedVersion: 0 });
  state.currentApa = published.record;
  return state;
}

test('all overview cards, evidence drawer and accepted-plan card derive from one current artifact', () => {
  const state = currentState();
  const reading = resolveApaReading(nia, state);
  assert.equal(reading.version, 1);
  assert.equal(reading.artifact, state.currentApa.artifact);
  assert.equal(reading.acceptedPlan, state.plan);
  const view = project(reading.artifact, { version: reading.version, receipt: reading.receipt,
    acceptedPlan: reading.acceptedPlan });
  assert.equal(view.stateHash, reading.artifact.artifact_sha256);
  assert.equal(view.layer0.cards.find(card => card.id === 'futures').items[0].label,
    reading.artifact.report.futures[0].headline);
  assert.equal(view.layer0.cards.find(card => card.id === 'move').value,
    reading.artifact.move.action);
  assert.equal(view.layer0.cards.find(card => card.id === 'plan').value, state.plan.title);
  assert.equal(view.layer0.cards.find(card => card.id === 'plan').objectId, 'agreement');
  assert.ok(view.objects['domain-training'].drawer_payload.flatMap(section => section.items)
    .some(item => item.includes('Tuesday practice is now shorter')));
  assert.ok(view.objects.version.drawer_payload.flatMap(section => section.items)
    .some(item => item.includes('practice schedule changed')));
});

test('the preserved original remains selectable without rewriting the accepted plan', () => {
  const state = currentState();
  const original = resolveApaReading(nia, state, { showOriginal: true });
  assert.equal(original.artifact, nia.apa);
  assert.equal(original.version, 1);
  assert.equal(original.showOriginal, true);
  assert.equal(original.acceptedPlan, state.plan);
  const view = project(original.artifact, { version: original.version,
    receipt: original.receipt, acceptedPlan: original.acceptedPlan, showOriginal: true });
  assert.equal(view.stateHash, nia.apa.artifact_sha256);
  assert.equal(view.layer0.cards.find(card => card.id === 'futures').items[0].label,
    nia.apa.report.futures[0].headline);
  assert.equal(view.layer0.cards.find(card => card.id === 'plan').value, state.plan.title);
  assert.equal(nia.apa.existing_plan, null);
});

test('a prepared proposal is selectable across all boxes but is never represented as current', () => {
  const state = currentState();
  const proposed = state.currentApa;
  state.currentApa = null;
  state.apaDraft = { id: 'synthetic-draft', expectedVersion: 0,
    confirmedChange: { mm: nia.person.mm, athlete_slug: 'nia' }, previewRecord: proposed };
  const current = resolveApaReading(nia, state);
  assert.equal(current.artifact, nia.apa);
  assert.equal(current.version, 0);
  assert.equal(current.preview, proposed.artifact);
  assert.equal(current.showPreview, false);
  const preview = resolveApaReading(nia, state, { showPreview: true });
  assert.equal(preview.showPreview, true);
  assert.equal(preview.artifact, proposed.artifact);
  assert.equal(preview.version, 1);
  assert.equal(preview.acceptedPlan, state.plan);
  const view = project(preview.artifact, { version: preview.version, receipt: preview.receipt,
    acceptedPlan: preview.acceptedPlan, showPreview: true });
  assert.equal(view.stateHash, proposed.artifact.artifact_sha256);
  assert.equal(view.layer0.cards.find(card => card.id === 'futures').items[0].label,
    proposed.artifact.report.futures[0].headline);
  assert.equal(view.layer0.cards.find(card => card.id === 'plan').value, state.plan.title);
  assert.match(view.objects.version.display_payload.title, /not current/u);
  assert.ok(view.objects.version.drawer_payload.flatMap(section => section.items)
    .some(item => item.includes('has not changed')));
  const original = resolveApaReading(nia, state, { showOriginal: true });
  assert.equal(original.artifact, nia.apa);
  assert.equal(original.showPreview, false);
  assert.equal(original.showOriginal, true);
});

test('a mismatched or stale proposal fails closed at the authenticated report boundary', () => {
  const state = currentState();
  state.apaDraft = { expectedVersion: 0,
    confirmedChange: { mm: nia.person.mm, athlete_slug: 'nia' },
    previewRecord: state.currentApa };
  assert.throws(() => resolveApaReading(nia, state), /latest APA version could not be verified/u);
  state.apaDraft.expectedVersion = 1;
  state.apaDraft.previewRecord = { ...state.currentApa,
    binding: { ...state.currentApa.binding, slug: 'sofia' } };
  assert.throws(() => resolveApaReading(nia, state), /latest APA version could not be verified/u);
});

test('a corrected prior APA remains visible only as historical and awaiting review', () => {
  const state = currentState();
  state.apaNeedsReview = true;
  const reading = resolveApaReading(nia, state);
  assert.equal(reading.artifact, state.currentApa.artifact);
  assert.equal(reading.needsReview, true);
  const view = project(reading.artifact, { version: reading.version, receipt: reading.receipt,
    needsReview: reading.needsReview });
  assert.match(view.objects.version.display_payload.title, /previous APA.*review needed/iu);
  assert.equal(view.objects.version.epistemic_class, 'Historical athlete reading awaiting review');
});

test('APA context resets at overview and carries only bounded reading and drawer identifiers', () => {
  assert.deepEqual(apaBoxContextMessage('nia', 'futures'),
    { contract: 'athlete-v2-apa-box-context', slug: 'nia', box: 'futures',
      reading: 'current', objectId: null });
  assert.deepEqual(apaBoxContextMessage('sofia', 'overview', { reading: 'preview' }),
    { contract: 'athlete-v2-apa-box-context', slug: 'sofia', box: null,
      reading: 'preview', objectId: null });
  assert.deepEqual(apaBoxContextMessage('nia', 'evidence', { reading: 'historical', objectId: 'sources' }),
    { contract: 'athlete-v2-apa-box-context', slug: 'nia', box: 'evidence',
      reading: 'historical', objectId: 'sources' });
  for (const invalid of ['domain-training', 'future-current_course',
    'a private answer', null]) assert.equal(apaBoxContextMessage('nia', invalid), null);
  assert.equal(apaBoxContextMessage('nia', 'where', { objectId: 'customer-key' }), null);
  assert.equal(apaBoxContextMessage('nia', 'where', { reading: 'admin' }), null);
  assert.equal(apaBoxContextMessage('bailea', 'where'), null);
});

test('legacy null current APA reads baseline, but cross-athlete current metadata fails closed', () => {
  const state = { mm: nia.person.mm, revision: 0, currentApa: null, plan: null };
  assert.equal(resolveApaReading(nia, state).artifact, nia.apa);
  assert.equal(resolveApaReading(nia, state).version, 0);
  const current = currentState();
  assert.throws(() => resolveApaReading(sofia, current), /latest APA version could not be verified/u);
  const tampered = clone(current);
  tampered.currentApa.binding.baseline_hash = sofia.apa.artifact_sha256;
  assert.throws(() => resolveApaReading(nia, tampered), /latest APA version could not be verified/u);
});

test('refresh hints require exact parent window, origin, slug and newer saved revision', () => {
  const parent = {}, origin = 'https://moremindmap.com';
  const context = { origin, parent, slug: 'nia', currentRevision: 4 };
  const event = { origin, source: parent, data: { contract: 'athlete-v2-current-apa', slug: 'nia', revision: 5 } };
  assert.equal(shouldRefreshApa(event, context), true);
  assert.equal(shouldRefreshApa({ ...event, origin: 'https://other.example' }, context), false);
  assert.equal(shouldRefreshApa({ ...event, source: {} }, context), false);
  assert.equal(shouldRefreshApa({ ...event, data: { ...event.data, slug: 'sofia' } }, context), false);
  assert.equal(shouldRefreshApa({ ...event, data: { ...event.data, revision: 4 } }, context), false);
  assert.equal(shouldRefreshApa({ ...event, data: { ...event.data, contract: 'other' } }, context), false);
});

test('preview selection accepts only same-origin parent requests for the selected athlete', () => {
  const parent = {}, origin = 'https://moremindmap.com';
  const context = { origin, parent, slug: 'nia' };
  const event = { origin, source: parent,
    data: { contract: 'athlete-v2-select-apa-reading', slug: 'nia', reading: 'preview' } };
  assert.equal(requestedApaReading(event, context), 'preview');
  assert.equal(requestedApaReading({ ...event, origin: 'https://other.example' }, context), null);
  assert.equal(requestedApaReading({ ...event, source: {} }, context), null);
  assert.equal(requestedApaReading({ ...event, data: { ...event.data, slug: 'sofia' } }, context), null);
  assert.equal(requestedApaReading({ ...event, data: { ...event.data, reading: 'historical' } }, context), null);
});

test('evidence drawer distinguishes a confirmed correction from its superseded source', () => {
  const state = currentState();
  const firstSource = `APA:CURRENT:${changeId}`;
  const nextMessageId = '33333333-3333-4333-8333-333333333333';
  const nextChangeId = '44444444-4444-4444-8444-444444444444';
  state.messages.push({ id: nextMessageId, role: 'user', speaker: 'athlete',
    text: 'Correction: Tuesday practice stayed long; Thursday became the shorter cue session.',
    at: '2026-09-25T08:03:00.000Z' });
  const candidate = { confirmation: clone(state.currentApa.artifact.confirmation),
    report: clone(state.currentApa.artifact.report) };
  const nextSource = `APA:CURRENT:${nextChangeId}`;
  candidate.report.domains[1].gap = 'Thursday now has a short passing cue session.';
  candidate.report.domains[1].refs = candidate.report.domains[1].refs.filter(id => id !== firstSource);
  candidate.report.domains[1].refs.push(nextSource);
  candidate.report.futures[0].headline = 'Thursday offers the shorter cue';
  candidate.report.futures[0].refs = candidate.report.futures[0].refs.filter(id => id !== firstSource);
  candidate.report.futures[0].refs.push(nextSource);
  candidate.narrative_updates = ['headline', 'opening', 'connection', 'main_obstacle', 'what_we_dont_know']
    .map(field => ({ field, value: clone(candidate.report[field]), refs: [nextSource] }));
  const second = publishCurrentApa({ bundle: nia, state, record: state.currentApa,
    confirmedChange: { id: nextChangeId, source_message_id: nextMessageId,
      athlete_slug: 'nia', mm: nia.person.mm, kind: 'correction', supersedes: [firstSource],
      confirmed: true, confirmed_by: 'athlete', confirmed_at: '2026-09-25T08:04:00.000Z',
      reason: 'Nia corrected which practice is shorter.' }, candidate, expectedVersion: 1 });
  state.currentApa = second.record;
  const reading = resolveApaReading(nia, state);
  const lines = project(reading.artifact, { version: reading.version, receipt: reading.receipt })
    .objects.sources.drawer_payload[0].items;
  assert.ok(lines.some(line => line.includes('Superseded by a later athlete correction')));
  assert.ok(lines.some(line => line.includes('Correction of an earlier saved statement')));
});
