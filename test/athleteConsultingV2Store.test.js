import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { initial, draft, approve, applyOutput, hash } from '../server/athleteConsultingV2/state.js';
import { createStore, athleteConsultingV2Keys, ATHLETE_V2_PREFIX, PERSIST_LUA, MAX_STATE_BYTES } from '../server/athleteConsultingV2/store.js';

class FakeRedis {
  values = new Map();
  calls = [];
  beforePersist = null;
  async get(key) { this.calls.push(['get', key]); return this.values.get(key) ?? null; }
  async set(key, value, ...args) {
    this.calls.push(['set', key]);
    if (args.includes('NX') && this.values.has(key)) return null;
    this.values.set(key, String(value)); return 'OK';
  }
  async eval(script, count, ...args) {
    const keys = args.slice(0, count), argv = args.slice(count);
    this.calls.push(['eval', ...keys]);
    if (script === PERSIST_LUA) {
      this.beforePersist?.(keys, argv);
      if (this.values.get(keys[0]) !== argv[0]) return 0;
      const prior = this.values.get(keys[1]);
      if ((prior ?? '') !== argv[2]) return -1;
      if (argv[3] === '1' && prior) {
        const previousBackup = this.values.get(keys[2]);
        if (previousBackup && previousBackup !== prior) return -2;
        if (!previousBackup) this.values.set(keys[2], prior);
      }
      this.values.set(keys[1], argv[1]); return 1;
    }
    if (script.includes("redis.call('PEXPIRE'")) return this.values.get(keys[0]) === argv[0] ? 1 : 0;
    if (script.includes("redis.call('DEL'")) {
      if (this.values.get(keys[0]) !== argv[0]) return 0;
      this.values.delete(keys[0]); return 1;
    }
    throw new Error('UNEXPECTED_LUA');
  }
}

function reports(slug) {
  const mm = `SYNTHETIC-${slug.toUpperCase()}`;
  const bos = { synthetic: true, mm, reading: { chapters: [{ id: 'identity' }] } };
  const apa = { synthetic: true, mm, report: { opening: 'Synthetic assessment only.' } };
  return { person: { slug, mm, name: slug, synthetic: true }, bos: { ...bos, artifact_sha256: hash(bos) }, apa: { ...apa, artifact_sha256: hash(apa) } };
}
const bundles = { nia: reports('nia'), sofia: reports('sofia') };
const plan = (shared = false) => ({ title: 'One manageable step', why: 'A chosen priority', steps: [{ action: 'Ask one question', when: 'Next practice', notice: 'Whether it helped', owner: 'athlete' }, ...(shared ? [{ action: 'Give one example', when: 'Next practice', notice: 'Whether it made sense', owner: 'coach' }] : [])], review: 'After practice' });
const output = (reply = 'A useful response.') => ({ reply, plan: null, plan_change: 'none', retire_draft: false, learning: [], recap: '' });
function fixture(options = {}) {
  const redis = options.redis || new FakeRedis();
  const scopeId = options.scopeId || 'synthetic-demo-session-one';
  const store = createStore({ redis, bundles: options.bundles || bundles, coach: options.coach || (async () => output()), scopeId });
  return { redis, store, keys: (slug = 'nia') => athleteConsultingV2Keys({ scopeId, slug, bundle: (options.bundles || bundles)[slug] }) };
}
async function act(store, action, slug = 'nia') {
  return store.act(slug, { ...action, revision: (await store.read(slug)).revision, requestId: randomUUID() });
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('frozen personal/shared decisions, revision and rejected output remain atomic', () => {
  const state = initial(bundles.nia);
  draft(state, plan());
  assert.throws(() => approve(state, { id: state.draft.id, hash: state.draft.hash, actor: 'coach' }), /ATHLETE_APPROVAL_REQUIRED/u);
  approve(state, { id: state.draft.id, hash: state.draft.hash, actor: 'athlete' });
  const accepted = structuredClone(state.plan);
  draft(state, plan(true));
  const old = structuredClone(state.draft);
  approve(state, { id: old.id, hash: old.hash, actor: 'athlete' });
  assert.deepEqual(state.plan, accepted);
  draft(state, { ...plan(true), title: 'Revised together' });
  assert.deepEqual(state.draft.approvals, []);
  assert.throws(() => approve(state, { id: old.id, hash: old.hash, actor: 'coach' }), /PLAN_CHANGED_REVIEW_LATEST/u);
  const before = structuredClone(state);
  assert.throws(() => applyOutput(state, { ...output(), retire_draft: true, plan: { title: '', steps: [] } }, 'CHAT'), /INVALID_PLAN/u);
  assert.deepEqual(state, before);
  assert.throws(() => draft(state, { title: 'Incomplete', why: '', review: '', steps: [{ action: 'Ask', owner: 'athlete' }] }), /INVALID_PLAN/u);
  assert.deepEqual(state, before);
  const latest = structuredClone(state.draft);
  approve(state, { id: latest.id, hash: latest.hash, actor: 'coach' });
  assert.deepEqual(state.plan, accepted);
  approve(state, { id: latest.id, hash: latest.hash, actor: 'athlete' });
  assert.equal(state.plan.title, 'Revised together');
});

test('keys isolate sessions, selected athletes and exact report versions inside the v2 namespace', async () => {
  const redis = new FakeRedis(), first = fixture({ redis }), second = fixture({ redis, scopeId: 'synthetic-demo-session-two' });
  await act(first.store, { action: 'start' });
  assert.equal((await first.store.read('sofia')).status, 'ready');
  assert.equal((await second.store.read('nia')).status, 'ready');
  const changed = structuredClone(bundles); changed.nia.apa.artifact_sha256 = hash('a different exact report');
  const version = fixture({ redis, bundles: changed });
  assert.notEqual(version.keys().state, first.keys().state);
  assert.equal((await version.store.read('nia')).status, 'ready');
  for (const call of redis.calls) for (const key of call.slice(1)) assert.ok(key.startsWith(ATHLETE_V2_PREFIX + ':'));
  assert.ok(!first.keys().state.includes('synthetic-demo-session-one'));
  await assert.rejects(() => first.store.read('../sofia'), /UNKNOWN_ATHLETE/u);
});

test('shared lease prevents cross-worker duplicate calls and polling does not recover active work', async () => {
  const waiting = deferred(), entered = deferred(); let calls = 0;
  const first = fixture({ coach: async () => { calls++; entered.resolve(); return waiting.promise; } });
  const second = fixture({ redis: first.redis });
  const body = { action: 'start', revision: 0, requestId: 'one-start' };
  const running = first.store.act('nia', body);
  await entered.promise;
  const pending = await second.store.read('nia');
  assert.equal(pending.status, 'working');
  assert.equal(pending.pending.requestId, body.requestId);
  const saved = JSON.parse(first.redis.values.get(first.keys().state));
  assert.equal(saved.operations[body.requestId].status, 'pending');
  await assert.rejects(() => second.store.act('nia', body), /PLEASE_WAIT/u);
  waiting.resolve(output('Opening'));
  const result = await running;
  assert.equal(result.status, 'active');
  assert.deepEqual(await second.store.act('nia', body), result);
  assert.equal(calls, 1);
  await assert.rejects(() => second.store.act('nia', { ...body, action: 'close' }), /REQUEST_ID_REUSED/u);
});

test('semantic replay tolerates JSON key order and refreshed revision but rejects changed context', async () => {
  const { store } = fixture();
  const request = { action: 'start', speaker: 'athlete', view: 'home', requestId: 'semantic-start', revision: 0 };
  const state = await store.act('nia', request);
  assert.deepEqual(await store.act('nia', { revision: state.revision, requestId: request.requestId, view: 'home', speaker: 'athlete', action: 'start' }), state);
  await assert.rejects(() => store.act('nia', { ...request, speaker: 'coach' }), /REQUEST_ID_REUSED/u);
  await assert.rejects(() => store.act('nia', { action: 'close', requestId: 'stale-close', revision: 0 }), /STATE_CHANGED_RELOAD/u);
});

test('lost acknowledgement after terminal commit cannot cause a second provider call', async () => {
  let calls = 0, drop = true;
  const { store, redis } = fixture({ coach: async () => { calls++; return output(); } });
  const execute = redis.eval.bind(redis);
  redis.eval = async (script, count, ...args) => {
    const result = await execute(script, count, ...args);
    if (script === PERSIST_LUA && drop && JSON.parse(args[count + 1]).operations['lost-ack']?.status === 'completed') {
      drop = false; throw new Error('Simulated lost commit acknowledgement');
    }
    return result;
  };
  const body = { action: 'start', revision: 0, requestId: 'lost-ack' };
  await assert.rejects(() => store.act('nia', body), /lost commit acknowledgement/u);
  const recovered = await store.act('nia', body);
  assert.equal(recovered.status, 'active');
  assert.equal(recovered.messages.length, 1);
  assert.equal(calls, 1);
});

test('ambiguous pending commit fails closed without invoking or automatically retrying the provider', async () => {
  let calls = 0, drop = true;
  const { store, redis } = fixture({ coach: async () => { calls++; return output(); } });
  const execute = redis.eval.bind(redis);
  redis.eval = async (script, count, ...args) => {
    const result = await execute(script, count, ...args);
    if (script === PERSIST_LUA && drop) { drop = false; throw new Error('Simulated pending acknowledgement loss'); }
    return result;
  };
  const body = { action: 'start', revision: 0, requestId: 'pending-ack' };
  await assert.rejects(() => store.act('nia', body), /pending acknowledgement loss/u);
  const recovered = await store.act('nia', body);
  assert.equal(recovered.status, 'ready');
  assert.equal(recovered.events.at(-1).code, 'COACH_OUTCOME_UNKNOWN');
  assert.equal(calls, 0);
});

test('provider failure saves the message, plan and draft once without retry', async () => {
  let calls = 0;
  const { store } = fixture({ coach: async () => { calls++; if (calls === 1) return output('Opening'); throw new Error('SIMULATED_FAILURE'); } });
  await act(store, { action: 'start' });
  let state = await act(store, { action: 'draft', plan: plan() });
  state = await act(store, { action: 'approve', id: state.draft.id, hash: state.draft.hash, actor: 'athlete' });
  const accepted = structuredClone(state.plan);
  state = await act(store, { action: 'draft', plan: plan(true) });
  const pending = structuredClone(state.draft);
  const body = { action: 'message', text: 'I need a smaller step', view: 'plan', requestId: 'failed-message', revision: state.revision };
  state = await store.act('nia', body);
  assert.deepEqual(state.plan, accepted); assert.deepEqual(state.draft, pending);
  assert.equal(state.messages.filter((message) => message.text === body.text).length, 1);
  assert.equal(state.view, 'plan'); assert.ok(state.lastError);
  assert.equal(state.events.at(-1).code, 'SIMULATED_FAILURE');
  assert.deepEqual(await store.act('nia', body), state);
  assert.equal(calls, 2);
});

test('invalid replacement is rejected without retiring the previous draft', async () => {
  const { store } = fixture({ coach: async (_bundle, _state, task) => task === 'CHAT' ? { ...output(), retire_draft: true, plan: { title: '', steps: [] } } : output() });
  await act(store, { action: 'start' });
  const before = await act(store, { action: 'draft', plan: plan() });
  const after = await act(store, { action: 'message', text: 'Consider a revision' });
  assert.deepEqual(after.draft, before.draft);
  assert.equal(after.events.at(-1).code, 'INVALID_PLAN');
  assert.equal(after.events.filter((event) => event.type === 'draft_declined').length, 0);
  assert.equal(after.messages.filter((message) => message.role === 'assistant').length, 1);
});

test('cold-worker POST recovers an orphan as unknown and stale provider cannot publish', async () => {
  const waiting = deferred(), entered = deferred(); let calls = 0;
  const first = fixture({ coach: async () => { calls++; entered.resolve(); return waiting.promise; } });
  const body = { action: 'start', revision: 0, requestId: 'interrupted-start' };
  const running = first.store.act('nia', body);
  await entered.promise;
  first.redis.values.delete(first.keys().lock);
  const second = fixture({ redis: first.redis, coach: async () => { calls++; return output('Must not run'); } });
  const recovered = await second.store.act('nia', body);
  assert.equal(recovered.status, 'ready'); assert.equal(recovered.revision, 1);
  assert.equal(recovered.events.at(-1).code, 'COACH_OUTCOME_UNKNOWN');
  assert.equal(JSON.parse(first.redis.values.get(first.keys().state)).operations[body.requestId].status, 'unknown');
  waiting.resolve(output('Late output must not appear'));
  await assert.rejects(() => running, /ATHLETE_LIVING_CONSULT_DURABLE_LOCK_LOST/u);
  assert.deepEqual(await second.store.read('nia'), recovered);
  assert.deepEqual(await second.store.act('nia', body), recovered);
  assert.equal(calls, 1);
});

test('orphaned message retains user content and current agreements across GET recovery', async () => {
  const waiting = deferred(), entered = deferred();
  const first = fixture({ coach: async (_bundle, _state, task) => { if (task !== 'CHAT') return output(); entered.resolve(); return waiting.promise; } });
  await act(first.store, { action: 'start' });
  let state = await act(first.store, { action: 'draft', plan: plan() });
  state = await act(first.store, { action: 'approve', id: state.draft.id, hash: state.draft.hash, actor: 'athlete' });
  const savedPlan = structuredClone(state.plan);
  const running = first.store.act('nia', { action: 'message', text: 'My saved question', revision: state.revision, requestId: 'lost-message' });
  await entered.promise;
  first.redis.values.delete(first.keys().lock);
  const second = fixture({ redis: first.redis });
  state = await second.store.read('nia');
  assert.equal(state.status, 'active'); assert.deepEqual(state.plan, savedPlan);
  assert.equal(state.messages.at(-1).text, 'My saved question'); assert.ok(state.lastError);
  waiting.resolve(output()); await assert.rejects(() => running, /DURABLE_LOCK_LOST/u);
});

test('owner-fenced persist rejects ownership lost between assert and final write', async () => {
  const { store, redis, keys } = fixture();
  redis.beforePersist = (storageKeys, args) => {
    const envelope = JSON.parse(args[1]);
    if (envelope.operations.fenced?.status === 'completed') redis.values.set(storageKeys[0], 'another-owner');
  };
  await assert.rejects(() => store.act('nia', { action: 'start', revision: 0, requestId: 'fenced' }), /DURABLE_LOCK_LOST/u);
  const saved = JSON.parse(redis.values.get(keys().state));
  assert.equal(saved.state.status, 'working');
  assert.equal(saved.state.messages.length, 0);
  assert.equal(saved.operations.fenced.status, 'pending');
});

test('reset archives selected state, retains replay ledger, and leaves other athlete/session untouched', async () => {
  const first = fixture(), second = fixture({ redis: first.redis, scopeId: 'another-session' });
  const body = { action: 'start', revision: 0, requestId: 'start-before-reset' };
  await first.store.act('nia', body);
  await act(first.store, { action: 'start' }, 'sofia');
  await act(second.store, { action: 'start' });
  const otherAthlete = await first.store.read('sofia'), otherSession = await second.store.read('nia');
  const prior = first.redis.values.get(first.keys().state);
  const reset = { action: 'reset', revision: 1, requestId: 'selected-reset' };
  const state = await first.store.act('nia', reset);
  assert.equal(state.status, 'ready'); assert.equal(state.revision, 2);
  assert.equal(state.messages.length, 0); assert.equal(state.plan, null); assert.equal(state.learning.length, 0);
  assert.equal(first.redis.values.get(`${first.keys().backup}:${hash(reset.requestId)}`), prior);
  assert.deepEqual(await first.store.act('nia', reset), state);
  assert.deepEqual(await first.store.act('nia', body), state);
  await assert.rejects(() => first.store.act('nia', { ...body, action: 'close' }), /REQUEST_ID_REUSED/u);
  assert.deepEqual(await first.store.read('sofia'), otherAthlete);
  assert.deepEqual(await second.store.read('nia'), otherSession);
  assert.equal([...first.redis.values.keys()].filter((key) => key.includes(':backup:')).length, 1);
});

test('durable replay records outlive the frozen 200-entry display history and reset', async () => {
  let calls = 0;
  const { store } = fixture({ coach: async () => { calls++; return output(); } });
  const original = { action: 'start', revision: 0, requestId: 'older-than-display-window' };
  await store.act('nia', original);
  for (let index = 0; index < 202; index++) {
    await act(store, { action: 'feedback', section: 'portrait', choice: 'fits', comment: '', report_hash: bundles.nia.bos.artifact_sha256 });
  }
  const state = await act(store, { action: 'reset' });
  assert.equal(state.processed.includes(original.requestId), false);
  assert.deepEqual(await store.act('nia', original), state);
  assert.equal(calls, 1);
});

test('finish and return retain pending draft and only explicitly selected learning', async () => {
  const first = fixture({ coach: async (_bundle, _state, task) => task === 'CLOSE' ? { ...output('A truthful recap'), learning: ['Ask what happened first.', 'Keep examples short.'], recap: 'We discussed a choice.' } : output() });
  await act(first.store, { action: 'start' });
  await act(first.store, { action: 'draft', plan: plan() });
  await act(first.store, { action: 'close' });
  const ended = await act(first.store, { action: 'finish', remember: ['Ask what happened first.'] });
  assert.equal(ended.status, 'closed'); assert.equal(ended.plan, null); assert.ok(ended.draft);
  assert.deepEqual(ended.learning.map((entry) => entry.text), ['Ask what happened first.']);
  assert.deepEqual(ended.suggestedLearning, ['Keep examples short.']);
  const reopened = fixture({ redis: first.redis });
  assert.deepEqual(await reopened.store.read('nia'), ended);
  const current = await act(reopened.store, { action: 'start' });
  assert.equal(current.status, 'active'); assert.equal(current.sessions.length, 1);
  assert.equal(current.sessions[0].summary, 'A truthful recap');
  assert.ok(current.draft); assert.equal(current.plan, null);
});

test('invalid feedback, manual plans and stale revision cannot change persisted state', async () => {
  const { store, redis, keys } = fixture();
  await act(store, { action: 'start' });
  const before = redis.values.get(keys().state);
  await assert.rejects(() => act(store, { action: 'draft', plan: { title: 'No complete shape', steps: [{ action: 'Ask', owner: 'athlete' }] } }), /INVALID_PLAN/u);
  await assert.rejects(() => act(store, { action: 'feedback', section: 'portrait', choice: 'fits', comment: '', report_hash: bundles.sofia.bos.artifact_sha256 }), /INVALID_FEEDBACK/u);
  assert.equal(redis.values.get(keys().state), before);
  const valid = await act(store, { action: 'feedback', section: 'portrait', choice: 'partly', comment: 'A synthetic exception', report_hash: bundles.nia.bos.artifact_sha256 });
  assert.equal(valid.feedback.length, 1); assert.equal(valid.learning.length, 0);
});

test('corrupt or oversized envelopes fail closed before coach calls', async () => {
  let calls = 0;
  const { store, redis, keys } = fixture({ coach: async () => { calls++; return output(); } });
  await act(store, { action: 'start' });
  const envelope = JSON.parse(redis.values.get(keys().state));
  envelope.state.mm = bundles.sofia.person.mm;
  redis.values.set(keys().state, JSON.stringify(envelope));
  await assert.rejects(() => store.read('nia'), /ATHLETE_V2_STATE_CORRUPT/u);
  redis.values.set(keys().state, 'x'.repeat(MAX_STATE_BYTES + 1));
  await assert.rejects(() => store.read('nia'), /ATHLETE_V2_STATE_TOO_LARGE/u);
  assert.equal(calls, 1);
});
