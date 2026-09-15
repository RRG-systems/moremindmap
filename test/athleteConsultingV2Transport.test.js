import assert from 'node:assert/strict';
import test from 'node:test';
import { api } from '../src/athleteConsultingV2/transport.js';

test('uncertain retry keeps the semantic operation and request ID but uses fresh proof revision', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ revision: 8 }) };
  });
  const operation = Object.freeze({ action: 'message', requestId: 'same-uncertain-operation', revision: 2, text: 'Keep my exact message.', view: 'sport', speaker: 'athlete' });
  const proof = { revision: 7, csrf: 'fixture-proof', state_hash: 'fixture-hash', actors: { conversation: 'fixture-actor' } };
  assert.deepEqual(await api('action/nia', operation, proof), { revision: 8 });
  const body = JSON.parse(calls[0].options.body);
  assert.deepEqual(body, { ...operation, revision: 7, proof_revision: 7, actor_capability: 'fixture-actor', state_hash: 'fixture-hash' });
  assert.equal(operation.revision, 2);
  assert.equal(calls[0].options.credentials, 'same-origin');
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[0].options.headers['x-athlete-consulting-csrf'], 'fixture-proof');
  assert.equal(calls[0].url, '/api/internal/athlete-living-consult-one-shot-v1?kind=action&athlete=nia');
});

test('client selects only the role-bound proof and fails closed before fetch without it', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => { calls.push(JSON.parse(options.body)); return { ok: true, json: async () => ({}) }; });
  const actors = { athlete: 'a', instructor: 'i', shared_editor: 's', conversation: 'c' };
  for (const [action, actor, expected] of [['approve','athlete','a'],['approve','coach','i'],['draft',null,'s'],['reset',null,'s'],['finish',null,'a'],['message',null,'c']]) {
    await api('action/sofia', { action, actor, requestId: action }, { actors, revision: 0, csrf: 'proof', state_hash: 'hash' });
    assert.equal(calls.at(-1).actor_capability, expected);
  }
  const count = calls.length;
  await assert.rejects(api('action/nia', { action: 'approve', actor: 'athlete' }, { actors: {} }), /Reopen through Leadership/);
  assert.equal(calls.length, count);
});
