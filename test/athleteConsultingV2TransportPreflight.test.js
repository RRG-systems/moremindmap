import assert from 'node:assert/strict';
import test from 'node:test';
import { api, apiWithStatePreflight } from '../src/athleteConsultingV2/transport.js';

const proof = (token = 'reviewed-proof-'.padEnd(40, 'x')) => ({
  slug: 'nia', mm: 'synthetic-nia', bos: 'b'.repeat(64), apa: 'a'.repeat(64),
  revision: 7, state_hash: 'c'.repeat(64), csrf: token,
  actors: { athlete: 'fixture-athlete', instructor: 'fixture-instructor',
    shared_editor: 'fixture-editor', conversation: 'fixture-conversation' },
});
const state = transport => ({ mm: 'synthetic-nia', sessionId: 'fixture-session', revision: 7,
  draft: { id: 'reviewed-plan', hash: 'd'.repeat(64), approvals: [] },
  _transport: transport || proof() });
const operation = () => ({ action: 'approve', actor: 'athlete', revision: 7,
  id: 'reviewed-plan', hash: 'd'.repeat(64), requestId: 'one-intended-approval',
  view: 'plan', speaker: 'athlete' });
const ok = value => ({ ok: true, status: 200, json: async () => value });
const failure = (status, error) => ({ ok: false, status, json: async () => ({ error }) });

test('expired outer proof is replaced by its own GET, same reviewed basis approves exactly once', async t => {
  const calls = [], now = 8.5 * 60 * 1000;
  const reviewed = state(), freshToken = 'fresh-same-view-proof-'.padEnd(40, 'y');
  const fresh = state(proof(freshToken));
  let writes = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    if (!options.method) return ok(fresh);
    const issuedAt = options.headers['x-athlete-consulting-csrf'] === freshToken ? now : 0;
    if (now - issuedAt > 300000) return failure(403, 'CSRF_DENIED');
    writes++;
    return ok({ ...fresh, plan: { id: 'reviewed-plan' } });
  });
  const intended = operation();
  await apiWithStatePreflight('action/nia', intended, reviewed);
  assert.equal(writes, 1);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, '/api/internal/athlete-living-consult-one-shot-v1?kind=state&athlete=nia');
  assert.equal(calls[0].options.credentials, 'same-origin');
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[1].options.method, 'POST');
  assert.equal(calls[1].options.headers['x-athlete-consulting-csrf'], freshToken);
  assert.deepEqual(JSON.parse(calls[1].options.body), { ...intended, proof_revision: 7,
    state_hash: 'c'.repeat(64), actor_capability: 'fixture-athlete' });
  assert.notEqual(reviewed._transport.csrf, freshToken);
  assert.equal(intended.requestId, 'one-intended-approval');
});

test('expired proof itself remains denied; client renewal does not weaken the server gate', async t => {
  let posts = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.method, 'POST'); posts++;
    return failure(403, 'CSRF_DENIED');
  });
  await assert.rejects(api('action/nia', operation(), proof()), /CSRF_DENIED/u);
  assert.equal(posts, 1);
});

for (const change of [
  fresh => { fresh.revision = 8; fresh._transport.revision = 8; },
  fresh => { fresh._transport.state_hash = 'f'.repeat(64); },
]) {
  test('changed reviewed revision or hash stops before POST and requires review', async t => {
    const calls = [], fresh = state(proof('fresh-proof-'.padEnd(40, 'y'))); change(fresh);
    t.mock.method(globalThis, 'fetch', async (_url, options) => { calls.push(options); return ok(fresh); });
    await assert.rejects(apiWithStatePreflight('action/nia', operation(), state()),
      error => error.message === 'STATE_CHANGED_RELOAD' && error.before_mutation === true);
    assert.equal(calls.length, 1); assert.equal(calls[0].method, undefined);
  });
}

for (const [name, change] of [
  ['athlete', fresh => { fresh._transport.slug = 'sofia'; }],
  ['identity', fresh => { fresh.mm = 'synthetic-sofia'; fresh._transport.mm = fresh.mm; }],
  ['BOS', fresh => { fresh._transport.bos = 'e'.repeat(64); }],
  ['APA', fresh => { fresh._transport.apa = 'e'.repeat(64); }],
  ['session', fresh => { fresh.sessionId = 'another-session'; }],
  ['same-visible-basis actor rotation', fresh => { fresh._transport.actors.athlete = 'rotated-athlete'; }],
  ['unselected-role actor rotation', fresh => { fresh._transport.actors.instructor = 'rotated-instructor'; }],
  ['extra actor authority', fresh => { fresh._transport.actors.admin = 'unexpected'; }],
  ['missing fresh one-use proof', fresh => { delete fresh._transport.csrf; }],
]) {
  test(`same visible basis but mismatched ${name} stops before mutation`, async t => {
    const fresh = state(proof('fresh-proof-'.padEnd(40, 'y'))); change(fresh);
    let reads = 0;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
      assert.equal(options.method, undefined); reads++; return ok(fresh);
    });
    await assert.rejects(apiWithStatePreflight('action/nia', operation(), state()),
      error => error.before_mutation === true && /review before choosing again/u.test(error.message));
    assert.equal(reads, 1);
  });
}

test('a selection change during preflight stops before POST', async t => {
  let selected = true, reads = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.method, undefined); reads++; selected = false;
    return ok(state(proof('fresh-proof-'.padEnd(40, 'y'))));
  });
  await assert.rejects(apiWithStatePreflight('action/nia', operation(), state(), () => selected),
    error => error.before_mutation === true);
  assert.equal(reads, 1);
});

test('invalid reviewed scope or already changed selection makes no request', async t => {
  t.mock.method(globalThis, 'fetch', async () => { assert.fail('no request authorized'); });
  const invalid = state(); invalid._transport.revision = 6;
  for (const [path, reviewed, selected] of [
    ['action/sofia', state(), () => true], ['action/nia', invalid, () => true],
    ['action/nia', state(), () => false], ['state/nia', state(), () => true],
  ]) await assert.rejects(apiWithStatePreflight(path, operation(), reviewed, selected),
    error => error.before_mutation === true);
});

for (const [name, fetchResult] of [
  ['401', () => failure(401, 'SHARED_LEADERSHIP_ENTRY_REQUIRED')],
  ['server error', () => failure(503, 'UNAVAILABLE')],
  ['network error', () => { throw Error('offline fixture'); }],
]) {
  test(`renewal ${name} stops before POST, without action retry`, async t => {
    let reads = 0;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
      assert.equal(options.method, undefined); reads++; return fetchResult();
    });
    await assert.rejects(apiWithStatePreflight('action/nia', operation(), state()),
      error => error.before_mutation === true && /review/i.test(error.message));
    assert.equal(reads, 1);
  });
}

test('captures original intent, approval target, request ID and full actor map before GET', async t => {
  const intended = operation(), reviewed = state(), fresh = structuredClone(reviewed);
  fresh._transport.csrf = 'fresh-proof-'.padEnd(40, 'y');
  let submitted;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (!options.method) {
      intended.id = 'unreviewed-plan'; intended.hash = 'e'.repeat(64);
      intended.requestId = 'changed-id'; reviewed._transport.actors.athlete = 'changed-actor';
      return ok(fresh);
    }
    submitted = JSON.parse(options.body); return ok(fresh);
  });
  await apiWithStatePreflight('action/nia', intended, reviewed);
  assert.equal(submitted.id, 'reviewed-plan');
  assert.equal(submitted.hash, 'd'.repeat(64));
  assert.equal(submitted.requestId, 'one-intended-approval');
  assert.equal(submitted.actor_capability, 'fixture-athlete');
});

test('uncertain POST network failure is submitted once and never auto-retried', async t => {
  let posts = 0, reads = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (!options.method) { reads++; return ok(state(proof('fresh-proof-'.padEnd(40, 'y')))); }
    posts++; throw Error('uncertain fixture transport');
  });
  await assert.rejects(apiWithStatePreflight('action/nia', operation(), state()),
    error => error.message === 'uncertain fixture transport' && error.before_mutation === undefined);
  assert.equal(reads, 1); assert.equal(posts, 1);
});

test('POST CSRF rejection remains authoritative and is not renewed or retried automatically', async t => {
  let posts = 0, reads = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (!options.method) { reads++; return ok(state(proof('fresh-proof-'.padEnd(40, 'y')))); }
    posts++; return failure(403, 'CSRF_DENIED');
  });
  await assert.rejects(apiWithStatePreflight('action/nia', operation(), state()),
    error => error.message === 'CSRF_DENIED' && error.before_mutation === undefined);
  assert.equal(reads, 1); assert.equal(posts, 1);
});
