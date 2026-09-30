import assert from 'node:assert/strict';
import test from 'node:test';
import { apaNoChangeEvent, prepareApaReview } from '../src/athleteConsultingV2/continuityModel.js';

const clone = value => structuredClone(value);
const originalHash = 'a'.repeat(64), proposalHash = 'b'.repeat(64);
const bundle = { person: { mm: 'MM-FICTIONAL' }, apa: { artifact_sha256: originalHash } };
const message = { id: 'own-saved-message', role: 'user', speaker: 'athlete',
  text: 'Practice asking one clear question before the drill starts. Review on October 7, 2026.' };
const before = { mm: bundle.person.mm, status: 'active', events: [], messages: [message],
  currentApa: null, apaDraft: null, apaNeedsReview: false,
  plan: { id: 'separately-agreed-plan', title: 'Unchanged plan' } };
const reason = 'Review this priority for the next seven days.';
const noChange = () => ({ ...clone(before), events: [{ type: 'current_apa_no_change', version: 0,
  content_hash: originalHash, source_message_id: message.id, request_id: 'new-request' }] });
const prepared = () => ({ ...clone(before),
  apaDraft: { id: 'new-draft', hash: 'c'.repeat(64), expectedVersion: 0,
    confirmedChange: { source_message_id: message.id, reason },
    previewRecord: { version: 1, artifact: { artifact_sha256: proposalHash } } },
  events: [{ type: 'current_apa_draft_prepared', version: 1, content_hash: proposalHash,
    source_message_id: message.id, request_id: 'new-request' }] });

async function submit(result, prior = before) {
  const calls = [], navigation = [], original = clone(prior), savedResult = clone(result);
  const returned = await prepareApaReview({ state: prior, sourceMessageId: message.id,
    reason: `  ${reason}  `, kind: 'reality', supersedes: [],
    onAction: async command => { calls.push(command); return result; },
    onPrepared: () => { navigation.push('close-and-open-preview'); } });
  assert.equal(returned, result);
  assert.equal(calls.length, 1, 'exactly one submission; no retry or synthetic extra action');
  assert.deepEqual(calls[0], { action: 'update_apa', sourceMessageId: message.id, reason,
    kind: 'reality', supersedes: [], expectedApaVersion: 0 });
  assert.deepEqual(prior, original, 'no local rewriting of original state, source or plan');
  assert.deepEqual(result, savedResult, 'no local publication or fabricated draft');
  return navigation;
}

test('first-failure shape with explicitly requested priority/date and no-change never closes or opens preview', async () => {
  const result = noChange();
  assert.deepEqual(await submit(result), []);
  assert.equal(result.currentApa, null); assert.equal(result.apaDraft, null);
  assert.equal(result.apaNeedsReview, false); assert.deepEqual(result.plan, before.plan);
  assert.equal(apaNoChangeEvent(bundle, result), result.events[0]);
});

test('only a new source-bound private draft opens review, without publishing or altering the agreed plan', async () => {
  const result = prepared();
  assert.deepEqual(await submit(result), ['close-and-open-preview']);
  assert.equal(result.currentApa, null); assert.deepEqual(result.plan, before.plan);
  assert.equal(apaNoChangeEvent(bundle, result), null);
});

test('undefined, failed, unknown or working results leave form and inputs in place without guessing', async () => {
  for (const result of [undefined, null, { ...prepared(), lastError: 'Failed' },
    { ...prepared(), status: 'unknown' }, { ...prepared(), status: 'working' },
    { ...prepared(), pending: { task: 'APA_UPDATE' } }]) assert.deepEqual(await submit(result), []);
});

test('an existing draft or old result cannot masquerade as the newly requested proposal', async () => {
  const old = prepared(), prior = { ...clone(before), apaDraft: clone(old.apaDraft), events: clone(old.events) };
  assert.deepEqual(await submit(old, prior), []);
  const result = noChange(); result.apaDraft = clone(old.apaDraft);
  assert.deepEqual(await submit(result, prior), []);
});

test('wrong athlete, source, reason, version, content hash or missing new receipt never navigates', async () => {
  const mutations = [r => { r.mm = 'OTHER-MM'; }, r => { r.apaDraft.confirmedChange.source_message_id = 'coach'; },
    r => { r.apaDraft.confirmedChange.reason = 'Other reason'; }, r => { r.apaDraft.expectedVersion = 1; },
    r => { r.apaDraft.previewRecord.version = 2; }, r => { r.events[0].content_hash = originalHash; },
    r => { r.events[0].source_message_id = 'other-source'; }, r => { delete r.events[0].request_id; },
    r => { r.events = []; }, r => { r.currentApa = { version: 1 }; }];
  for (const mutate of mutations) { const result = prepared(); mutate(result); assert.deepEqual(await submit(result), []); }
});

test('no-change feedback is durable, scoped to an own plain saved message and the exact current reading', () => {
  const result = noChange(), reloaded = JSON.parse(JSON.stringify(result));
  assert.deepEqual(apaNoChangeEvent(bundle, reloaded), result.events[0]);
  const mutations = [r => { r.mm = 'OTHER-MM'; }, r => { r.messages[0].speaker = 'coach'; },
    r => { r.messages[0].capture = {}; }, r => { r.messages = []; },
    r => { r.events[0].version = 1; }, r => { r.events[0].content_hash = proposalHash; },
    r => { r.status = 'unknown'; }, r => { r.pending = { task: 'APA_UPDATE' }; },
    r => { r.lastError = 'Failed'; }];
  for (const mutate of mutations) { const changed = clone(result); mutate(changed); assert.equal(apaNoChangeEvent(bundle, changed), null); }
});

test('newer APA terminal events supersede the earlier notice; unrelated conversation does not erase it', () => {
  for (const type of ['current_apa_draft_prepared', 'current_apa_published', 'current_apa_draft_declined',
    'current_apa_draft_invalidated', 'apa_update_failed', 'apa_update_unknown']) {
    const result = noChange(); result.events.push({ type }); assert.equal(apaNoChangeEvent(bundle, result), null);
  }
  const result = noChange(); result.events.push({ type: 'conversation_completed' });
  assert.equal(apaNoChangeEvent(bundle, result), result.events[0]);
});
