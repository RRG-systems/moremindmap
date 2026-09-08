import assert from 'node:assert/strict';
import test from 'node:test';
import { createAthleteLivingConsultOneShotHandlerV1 } from '../api/internal/athlete-living-consult-one-shot-v1.js';
import {
  createAthleteLivingConsultOneShotDemoRuntimeV1,
  createAthleteLivingConsultStructuralQaSeamsV1,
} from '../api/engine/athleteLivingConsultOneShotV1/demoRuntime.js';
import { postAthleteLivingConsultOneShot } from '../src/athleteLivingConsultOneShotV1/client.js';

const ENABLED_ENV = Object.freeze({
  RECRUITING_DARREN_SYNTHETIC_DEMO_ENABLED: 'true',
  SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED: 'true',
  ATHLETE_CONSULTING_DARREN_DEMO_ENABLED: 'true',
});
const FIXED_CLOCK = () => new Date('2026-09-08T12:00:00.000Z');

class FakeRedis {
  constructor() { this.values = new Map(); this.calls = []; this.evalCalls = []; this.persistCalls = 0; this.failPersistAt = null; }
  async get(key) { this.calls.push(['get', key]); return this.values.get(key) ?? null; }
  async getdel(key) { const value = this.values.get(key) ?? null; this.values.delete(key); return value; }
  async del(key) { return this.values.delete(key) ? 1 : 0; }
  async set(key, value, ...args) {
    this.calls.push(['set', key, ...args]);
    if (args.includes('NX') && this.values.has(key)) return null;
    if (args.includes('XX') && !this.values.has(key)) return null;
    this.values.set(key, String(value));
    return 'OK';
  }
  async incr(key) { const value = Number(this.values.get(key) || 0) + 1; this.values.set(key, String(value)); return value; }
  async expire() { return 1; }
  async eval(script, keyCount, ...args) {
    const keys = args.slice(0, keyCount);
    const argv = args.slice(keyCount);
    this.evalCalls.push({ script, keys, argv });
    if (script.includes("redis.call('INCR'")) {
      const count = await this.incr(keys[0]);
      return count;
    }
    if (script.includes("redis.call('SET',KEYS[2],ARGV[2])")) {
      this.persistCalls += 1;
      if (this.persistCalls === this.failPersistAt) throw new Error('SYNTHETIC_FINAL_PERSIST_FAILURE');
      if (this.values.get(keys[0]) !== argv[0]) return 0;
      const prior = this.values.get(keys[1]);
      if (argv[2] === '1' && prior != null) this.values.set(keys[2], prior);
      this.values.set(keys[1], argv[1]);
      return 1;
    }
    if (script.includes("redis.call('PEXPIRE'")) return this.values.get(keys[0]) === argv[0] ? 1 : 0;
    if (script.includes("redis.call('DEL'")) {
      if (this.values.get(keys[0]) !== argv[0]) return 0;
      this.values.delete(keys[0]);
      return 1;
    }
    throw new Error('UNEXPECTED_LUA');
  }
}

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    chunks: [],
    headersSent: false,
    setHeader(name, value) {
      if (this.headersSent) throw new Error('HEADERS_ALREADY_SENT');
      this.headers[String(name).toLowerCase()] = value;
    },
    getHeader(name) { return this.headers[String(name).toLowerCase()]; },
    write(value) { this.headersSent = true; this.chunks.push(String(value)); },
    end(value = '') { this.headersSent = true; if (value) this.chunks.push(String(value)); this.ended = true; },
    json() { return JSON.parse(this.chunks.join('') || '{}'); },
  };
}

function request({ method = 'GET', token = null, accept = null, body = null, capability = 'a', origin = 'https://moremindmap.com' } = {}) {
  const headers = {
    host: 'moremindmap.com',
    origin,
    'x-forwarded-proto': 'https',
    'x-forwarded-for': '203.0.113.41',
    'user-agent': 'Athlete production test browser',
    'x-test-capability': capability,
  };
  if (token) headers['x-athlete-living-consult-csrf'] = token;
  if (accept) headers.accept = accept;
  if (method === 'POST') headers['content-type'] = 'application/json; charset=utf-8';
  return { method, url: '/api/internal/athlete-living-consult-one-shot-v1?fixture=mika', headers, body, socket: {} };
}

async function invoke(handler, options) {
  const response = responseRecorder();
  await handler(request(options), response);
  return response;
}

function auth({ req }) {
  const seed = String(req.headers['x-test-capability'] || 'a');
  return {
    ok: true,
    capability: {
      synthetic_only: true,
      allowed_product: 'athlete-consulting-tool',
      allowed_subjects: ['mika', 'avery'],
    },
    capability_hash: seed.repeat(64).slice(0, 64),
    capability_token: seed.repeat(43).slice(0, 43),
  };
}

function runtimeFactory({ crashGu = () => false, clock = FIXED_CLOCK, bootstrapConversationCount = null } = {}) {
  const seams = createAthleteLivingConsultStructuralQaSeamsV1({ clock: () => new Date(clock()).toISOString() });
  return async (fixtureId, { runtime_snapshot = null } = {}) => {
    const runtime = await createAthleteLivingConsultOneShotDemoRuntimeV1({
      fixture_id: fixtureId,
      clock: () => new Date(clock()).toISOString(),
      coach_seam: seams.coach,
      candidate_extractor: null,
      close_seam: seams.close,
      gu_generator: crashGu() ? async () => { throw new Error('SYNTHETIC_POST_COACHING_CRASH'); } : null,
      runtime_snapshot,
    });
    if (!Number.isInteger(bootstrapConversationCount)) return runtime;
    return Object.freeze({
      ...runtime,
      bootstrap: () => ({
        ...runtime.bootstrap(),
        conversation: Array.from({ length: bootstrapConversationCount }, (_, index) => ({
          actor_role: index % 2 ? 'MORE' : 'PARTICIPANT',
          role: index % 2 ? 'coach' : 'participant',
          content: `bounded-${index}`,
          occurred_at: new Date(clock()).toISOString(),
          room: 'HOME',
        })),
      }),
    });
  };
}

function handler(redis, extras = {}) {
  const selectedClock = extras.clock || FIXED_CLOCK;
  return createAthleteLivingConsultOneShotHandlerV1({
    env: ENABLED_ENV,
    redis,
    authenticate: auth,
    createRuntime: runtimeFactory({ ...extras, clock: selectedClock }),
    clock: selectedClock,
  });
}

test('production wrapper is composite-default-off before Redis/runtime and then enforces authority, JSON, no-store, action and idempotency', async () => {
  const redis = new FakeRedis();
  let authCalls = 0;
  let runtimeCalls = 0;
  const off = createAthleteLivingConsultOneShotHandlerV1({
    env: {},
    redis,
    authenticate: async () => { authCalls += 1; return auth({ req: request() }); },
    createRuntime: async () => { runtimeCalls += 1; throw new Error('MUST_NOT_RUN'); },
  });
  assert.equal((await invoke(off, { method: 'GET' })).statusCode, 404);
  assert.equal(authCalls, 0);
  assert.equal(runtimeCalls, 0);
  assert.equal(redis.calls.length, 0);

  const denied = createAthleteLivingConsultOneShotHandlerV1({
    env: ENABLED_ENV,
    redis,
    authenticate: async () => ({ ok: false, status: 401, code: 'CAPABILITY_REQUIRED' }),
    createRuntime: runtimeFactory(),
  });
  assert.equal((await invoke(denied, { method: 'GET' })).statusCode, 401);

  const live = handler(redis);
  const openedResponse = await invoke(live, { method: 'GET' });
  assert.equal(openedResponse.statusCode, 200);
  assert.equal(openedResponse.headers['cache-control'], 'no-store, private, max-age=0');
  assert.equal(openedResponse.headers.pragma, 'no-cache');
  const opened = openedResponse.json();
  assert.ok(opened.csrf_token.length >= 32);
  assert.ok(opened.authority_capabilities.conversation_capability.length >= 32);
  assert.equal(openedResponse.headers['access-control-allow-origin'], undefined);

  const jsonp = request({ method: 'POST', token: opened.csrf_token, body: { action: 'START_MY_FIRST_SESSION', idempotency_key: 'server-start-0001' } });
  jsonp.headers['content-type'] = 'application/jsonp';
  const jsonpResponse = responseRecorder();
  await live(jsonp, jsonpResponse);
  assert.equal(jsonpResponse.statusCode, 415);
  assert.equal((await invoke(live, { method: 'POST', token: opened.csrf_token, body: { action: 'NOT_ALLOWED', idempotency_key: 'server-invalid-001' } })).statusCode, 422);
  assert.equal((await invoke(live, { method: 'POST', token: opened.csrf_token, body: { action: 'START_MY_FIRST_SESSION' } })).statusCode, 422);
});

test('cross-origin, request-size, persisted-text, and page-context bounds fail before state or CSRF mutation', async () => {
  const crossOriginRedis = new FakeRedis();
  const crossOrigin = await invoke(handler(crossOriginRedis), {
    method: 'GET',
    origin: 'https://attacker.invalid',
  });
  assert.equal(crossOrigin.statusCode, 403);
  assert.equal(crossOrigin.headers['access-control-allow-origin'], undefined);
  assert.equal(crossOriginRedis.calls.length, 0);
  assert.equal(crossOriginRedis.evalCalls.length, 0);

  const redis = new FakeRedis();
  const live = handler(redis);
  let state = (await invoke(live, { method: 'GET' })).json();
  const stateKey = [...redis.values.keys()].find((key) => key.endsWith(':state'));
  const baseline = await redis.get(stateKey);
  const tooLarge = await invoke(live, {
    method: 'POST',
    token: state.csrf_token,
    body: {
      action: 'SET_PAGE_CONTEXT',
      room: 'HOME',
      visible_object_ids: [],
      padding: 'x'.repeat(400_001),
      idempotency_key: 'request-body-too-large-001',
    },
  });
  assert.equal(tooLarge.statusCode, 413);
  assert.equal(tooLarge.json().code, 'ATHLETE_LIVING_CONSULT_REQUEST_TOO_LARGE');
  assert.equal(await redis.get(stateKey), baseline);

  const badPage = await invoke(live, {
    method: 'POST',
    token: state.csrf_token,
    body: {
      action: 'SET_PAGE_CONTEXT',
      room: 'YOUR_SPORT',
      visible_object_ids: ['duplicate', 'duplicate'],
      idempotency_key: 'invalid-page-context-001',
    },
  });
  assert.equal(badPage.statusCode, 422);
  assert.equal(badPage.json().code, 'ATHLETE_PAGE_CONTEXT_INVALID');
  assert.equal(await redis.get(stateKey), baseline);

  state = (await invoke(live, {
    method: 'POST',
    token: state.csrf_token,
    body: {
      action: 'START_MY_FIRST_SESSION',
      idempotency_key: 'bounds-start-session-001',
    },
  })).json();
  const beforeMessageRefusal = await redis.get(stateKey);
  const escapedOversize = await invoke(live, {
    method: 'POST',
    token: state.csrf_token,
    body: {
      action: 'TURN',
      message: '\\'.repeat(24_576),
      conversation_capability: state.authority_capabilities.conversation_capability,
      idempotency_key: 'escaped-message-oversize-001',
    },
  });
  assert.equal(escapedOversize.statusCode, 422);
  assert.equal(escapedOversize.json().code, 'ATHLETE_TURN_MESSAGE_TOO_LARGE_OR_INVALID');
  assert.equal(await redis.get(stateKey), beforeMessageRefusal);

  const maxSafe = (await invoke(live, {
    method: 'POST',
    token: state.csrf_token,
    body: {
      action: 'TURN',
      message: 'x'.repeat((48 * 1024) - 2),
      conversation_capability: state.authority_capabilities.conversation_capability,
      idempotency_key: 'max-safe-message-turn-001',
    },
  })).json();
  assert.equal(maxSafe.code, 'ATHLETE_COACHING_TURN_COMPLETE');
  const cold = (await invoke(handler(redis), { method: 'GET' })).json();
  assert.equal(cold.state_hash, maxSafe.state_hash);
  assert.equal(cold.conversation.length, 2);
});

test('escaped proposal growth is bounded before reservation and leaves cold state and reset reachable', async () => {
  const redis = new FakeRedis();
  const live = handler(redis);
  let capability = 'a';
  let state = (await invoke(live, { method: 'GET', capability })).json();
  state = (await invoke(live, {
    method: 'POST',
    token: state.csrf_token,
    capability,
    body: {
      action: 'START_MY_FIRST_SESSION',
      idempotency_key: 'capacity-start-session-001',
    },
  })).json();
  const stateKey = [...redis.values.keys()].find((key) => key.endsWith(':state'));
  const escapedTooLarge = '\\'.repeat(600);
  const beforeEscapedRefusal = await redis.get(stateKey);
  const persistCountBeforeEscapedRefusal = redis.persistCalls;
  const escapedRefusal = await invoke(live, {
    method: 'POST',
    token: state.csrf_token,
    capability,
    body: {
      action: 'PROPOSE_PLAN',
      summary: escapedTooLarge,
      reason: 'A bounded aggregate-capacity probe.',
      items: [{ field: 'athlete_plan.intervention', value: 'Keep the state recoverable.' }],
      idempotency_key: 'capacity-escaped-refusal-001',
    },
  });
  assert.equal(escapedRefusal.statusCode, 422);
  assert.equal(escapedRefusal.json().code, 'ATHLETE_PROPOSAL_PAYLOAD_INVALID');
  assert.equal(redis.persistCalls, persistCountBeforeEscapedRefusal);
  assert.equal(await redis.get(stateKey), beforeEscapedRefusal);

  const visibleObjectIds = Array.from({ length: 100 }, (_, index) => {
    const prefix = `capacity-visible-${String(index).padStart(3, '0')}-`;
    return `${prefix}${'v'.repeat(198 - prefix.length)}`;
  });
  state = (await invoke(live, {
    method: 'POST',
    token: state.csrf_token,
    capability,
    body: {
      action: 'SET_PAGE_CONTEXT',
      room: 'YOUR_SPORT',
      visible_object_ids: visibleObjectIds,
      idempotency_key: 'capacity-page-context-seed-001',
    },
  })).json();
  state = (await invoke(live, {
    method: 'POST',
    token: state.csrf_token,
    capability,
    body: {
      action: 'TURN',
      message: 't'.repeat((48 * 1024) - 2),
      conversation_capability: state.authority_capabilities.conversation_capability,
      idempotency_key: 'capacity-conversation-seed-001',
    },
  })).json();
  assert.equal(state.code, 'ATHLETE_COACHING_TURN_COMPLETE');

  const escapedAtLimit = '\\'.repeat(599);
  const items = Array.from({ length: 12 }, (_, index) => {
    const prefix = `athlete_plan.capacity_probe_${String(index).padStart(2, '0')}_`;
    return { field: `${prefix}${'x'.repeat(98 - prefix.length)}`, value: escapedAtLimit };
  });
  state = (await invoke(live, {
    method: 'POST',
    token: state.csrf_token,
    capability,
    body: {
      action: 'PROPOSE_PLAN',
      proposal_type: 'COMMITMENT_CANDIDATE',
      summary: escapedAtLimit,
      reason: escapedAtLimit,
      items,
      idempotency_key: 'capacity-proposal-seed-001',
    },
  })).json();
  assert.equal(state.code, 'ATHLETE_SHARED_PLAN_PROPOSAL_STAGED');

  let refusal = null;
  let lastSuccessfulBody = null;
  let stateBeforeRefusal = null;
  let rawBeforeRefusal = null;
  let persistCountBeforeRefusal = null;
  for (let index = 0; index < 90; index += 1) {
    if (index === 60) {
      capability = 'b';
      state = (await invoke(live, { method: 'GET', capability })).json();
    }
    const proposal = state.pending_proposal;
    stateBeforeRefusal = state;
    rawBeforeRefusal = await redis.get(stateKey);
    persistCountBeforeRefusal = redis.persistCalls;
    const revisionBody = {
      action: 'REVISE_PROPOSAL',
      shared_editor_capability: state.authority_capabilities.shared_editor_capability,
      session_id: state.session.session_id,
      relationship_id: state.relationship.relationship_id,
      expected_proposal_id: proposal.proposal_id,
      expected_proposal_hash: proposal.proposal_hash,
      expected_prior_publication_version: proposal.expected_prior_publication_version,
      expected_prior_publication_hash: proposal.expected_prior_publication_hash,
      proposal_type: 'COMMITMENT_CANDIDATE',
      summary: escapedAtLimit,
      reason: escapedAtLimit,
      items,
      idempotency_key: `capacity-revision-${String(index).padStart(3, '0')}`,
    };
    const response = await invoke(live, {
      method: 'POST',
      token: state.csrf_token,
      capability,
      body: revisionBody,
    });
    if (response.statusCode === 422 && response.json().code === 'ATHLETE_SESSION_CAPACITY_REACHED') {
      refusal = response;
      break;
    }
    assert.equal(response.statusCode, 200);
    state = response.json();
    lastSuccessfulBody = revisionBody;
  }

  assert.ok(refusal, 'aggregate session capacity must refuse within 90 bounded revisions');
  assert.equal(redis.persistCalls, persistCountBeforeRefusal);
  assert.equal(await redis.get(stateKey), rawBeforeRefusal);

  const replay = (await invoke(live, {
    method: 'POST',
    token: refusal.json().csrf_token,
    capability,
    body: lastSuccessfulBody,
  })).json();
  assert.equal(replay.code, 'ATHLETE_IDEMPOTENT_REPLAY');
  assert.equal(replay.original_result_state_hash, stateBeforeRefusal.state_hash);
  assert.equal(await redis.get(stateKey), rawBeforeRefusal);

  const cold = (await invoke(handler(redis), { method: 'GET', capability: 'c' })).json();
  assert.equal(cold.state_hash, stateBeforeRefusal.state_hash);
  assert.equal(cold.revision, stateBeforeRefusal.revision);
  assert.equal(await redis.get(stateKey), rawBeforeRefusal);

  const reset = (await invoke(live, {
    method: 'POST',
    token: replay.csrf_token,
    capability,
    body: { action: 'RESET', idempotency_key: 'capacity-recovery-reset-001' },
  })).json();
  assert.equal(reset.code, 'ATHLETE_LIVING_CONSULT_SYNTHETIC_RESET');
  const afterReset = (await invoke(handler(redis), { method: 'GET', capability: 'd' })).json();
  assert.equal(afterReset.session.coaching_episode_phase, 'IDLE');
  assert.equal(afterReset.conversation.length, 0);
});

test('the 240-entry conversation ceiling refuses a 121st turn before reservation and leaves reset/state reachable', async () => {
  const redis = new FakeRedis();
  const live = handler(redis, { bootstrapConversationCount: 239 });
  const state = (await invoke(live, { method: 'GET' })).json();
  const stateKey = [...redis.values.keys()].find((key) => key.endsWith(':state'));
  const before = await redis.get(stateKey);
  const persistCount = redis.persistCalls;
  const refused = await invoke(live, {
    method: 'POST',
    token: state.csrf_token,
    body: {
      action: 'TURN',
      message: 'This turn must not execute.',
      conversation_capability: state.authority_capabilities.conversation_capability,
      idempotency_key: 'conversation-ceiling-turn-001',
    },
  });
  assert.equal(refused.statusCode, 422);
  assert.equal(refused.json().code, 'ATHLETE_CONVERSATION_LIMIT_REACHED');
  assert.equal(redis.persistCalls, persistCount);
  assert.equal(await redis.get(stateKey), before);
  const reset = (await invoke(live, {
    method: 'POST',
    token: refused.json().csrf_token,
    body: { action: 'RESET', idempotency_key: 'conversation-ceiling-reset-001' },
  })).json();
  assert.equal(reset.code, 'ATHLETE_LIVING_CONSULT_SYNTHETIC_RESET');
});

test('whole session survives a cold handler and a busy lock does not consume its CSRF token', async () => {
  const redis = new FakeRedis();
  const firstHandler = handler(redis);
  const opened = (await invoke(firstHandler, { method: 'GET' })).json();
  const stateKey = [...redis.values.keys()].find((key) => key.endsWith(':state'));
  const lockKey = stateKey.replace(/:state$/u, ':lock');
  await redis.set(lockKey, 'foreign-owner', 'PX', 30_000, 'NX');
  const body = { action: 'START_MY_FIRST_SESSION', idempotency_key: 'server-start-cold-001' };
  const collision = await invoke(firstHandler, { method: 'POST', token: opened.csrf_token, body });
  assert.equal(collision.statusCode, 409);
  assert.equal(collision.json().code, 'ATHLETE_LIVING_CONSULT_REQUEST_IN_FLIGHT');
  await redis.del(lockKey);
  const started = (await invoke(firstHandler, { method: 'POST', token: opened.csrf_token, body })).json();
  assert.equal(started.code, 'ATHLETE_FIRST_SESSION_STARTED');

  const coldHandler = handler(redis);
  const cold = (await invoke(coldHandler, { method: 'GET' })).json();
  assert.equal(cold.state_hash, started.state_hash);
  assert.equal(cold.revision, started.revision);
  assert.equal(cold.session.coaching_episode_phase, 'STARTED');
});

test('typed role cannot grant authority, consumed failures rotate CSRF, and reset is idempotent', async () => {
  const redis = new FakeRedis();
  const live = handler(redis);
  let state = (await invoke(live, { method: 'GET' })).json();
  state = (await invoke(live, {
    method: 'POST', token: state.csrf_token,
    body: { action: 'START_MY_FIRST_SESSION', idempotency_key: 'server-start-role-001' },
  })).json();
  const denied = (await invoke(live, {
    method: 'POST', token: state.csrf_token,
    body: { action: 'GRANT_BOS', actor_role: 'ATHLETE', actor_capability: 'typed-role-is-not-authority', idempotency_key: 'server-grant-role-01' },
  })).json();
  assert.equal(denied.code, 'ATHLETE_GOVERNED_ACTOR_CAPABILITY_DENIED');
  assert.notEqual(denied.csrf_token, state.csrf_token);
  const granted = (await invoke(live, {
    method: 'POST', token: denied.csrf_token,
    body: { action: 'GRANT_BOS', actor_capability: denied.authority_capabilities.athlete_actor_capability, idempotency_key: 'server-grant-role-02' },
  })).json();
  assert.equal(granted.code, 'ATHLETE_PRESENTATION_SAFE_BOS_GRANTED');

  const resetBody = { action: 'RESET', idempotency_key: 'server-reset-idempotent-001' };
  const reset = (await invoke(live, { method: 'POST', token: granted.csrf_token, body: resetBody })).json();
  const stateKey = [...redis.values.keys()].find((key) => key.endsWith(':state'));
  const firstEpoch = JSON.parse(await redis.get(stateKey)).reset_epoch;
  const crossTypeConflict = (await invoke(live, {
    method: 'POST', token: reset.csrf_token,
    body: { action: 'START_MY_FIRST_SESSION', idempotency_key: resetBody.idempotency_key },
  })).json();
  assert.equal(crossTypeConflict.code, 'ATHLETE_IDEMPOTENCY_CONFLICT');
  const restarted = (await invoke(live, {
    method: 'POST', token: crossTypeConflict.csrf_token,
    body: { action: 'START_MY_FIRST_SESSION', idempotency_key: 'server-after-reset-start-001' },
  })).json();
  const beforeReplay = JSON.parse(await redis.get(stateKey));
  const replay = (await invoke(live, { method: 'POST', token: restarted.csrf_token, body: resetBody })).json();
  assert.equal(replay.code, 'ATHLETE_IDEMPOTENT_REPLAY');
  assert.equal(JSON.parse(await redis.get(stateKey)).reset_epoch, firstEpoch);
  assert.equal(JSON.parse(await redis.get(stateKey)).runtime_state_hash, beforeReplay.runtime_state_hash);
  assert.equal(replay.revision, restarted.revision);
});

test('an earlier non-reset operation key cannot be reused by RESET after a later operation', async () => {
  const redis = new FakeRedis();
  const live = handler(redis);
  let state = (await invoke(live, { method: 'GET' })).json();
  const startKey = 'start-then-reset-conflict-001';
  state = (await invoke(live, {
    method: 'POST', token: state.csrf_token,
    body: { action: 'START_MY_FIRST_SESSION', idempotency_key: startKey },
  })).json();
  state = (await invoke(live, {
    method: 'POST', token: state.csrf_token,
    body: {
      action: 'SET_PAGE_CONTEXT',
      room: 'PLAN',
      visible_object_ids: ['layer0-plan'],
      idempotency_key: 'later-page-context-op-001',
    },
  })).json();
  const stateKey = [...redis.values.keys()].find((key) => key.endsWith(':state'));
  const before = JSON.parse(await redis.get(stateKey));
  const conflict = (await invoke(live, {
    method: 'POST', token: state.csrf_token,
    body: { action: 'RESET', idempotency_key: startKey },
  })).json();
  assert.equal(conflict.code, 'ATHLETE_IDEMPOTENCY_CONFLICT');
  const after = JSON.parse(await redis.get(stateKey));
  assert.equal(after.reset_epoch, before.reset_epoch);
  assert.equal(after.runtime_state_hash, before.runtime_state_hash);
});

test('a post-reservation refusal is durable, replayable, conflict-safe, and cold-hydratable', async () => {
  const redis = new FakeRedis();
  const live = handler(redis);
  let state = (await invoke(live, { method: 'GET' })).json();
  state = (await invoke(live, {
    method: 'POST',
    token: state.csrf_token,
    body: { action: 'START_MY_FIRST_SESSION', idempotency_key: 'refused-start-session-001' },
  })).json();
  const stateKey = [...redis.values.keys()].find((key) => key.endsWith(':state'));
  const runtimeHashBefore = JSON.parse(await redis.get(stateKey)).runtime_state_hash;
  const body = {
    action: 'CONFIRM',
    decision: 'CONFIRM',
    edited_items: [],
    actor_capability: state.authority_capabilities.athlete_actor_capability,
    idempotency_key: 'durable-refused-confirm-001',
  };
  const refused = await invoke(live, { method: 'POST', token: state.csrf_token, body });
  assert.equal(refused.statusCode, 422);
  const refusedBody = refused.json();
  assert.equal(refusedBody.code, 'ATHLETE_SHARED_CONFIRMATION_BINDING_INVALID');
  assert.ok(refusedBody.csrf_token);
  const refusedEnvelope = JSON.parse(await redis.get(stateKey));
  assert.equal(refusedEnvelope.runtime_state_hash, runtimeHashBefore);
  assert.equal(refusedEnvelope.operation_receipt.status, 'REFUSED');
  assert.equal(refusedEnvelope.idempotency_receipts.at(-1).status, 'REFUSED');

  const cold = (await invoke(handler(redis), { method: 'GET' })).json();
  assert.equal(cold.state_hash, state.state_hash);
  const replay = (await invoke(handler(redis), { method: 'POST', token: cold.csrf_token, body })).json();
  assert.equal(replay.code, 'ATHLETE_IDEMPOTENT_REPLAY');
  assert.equal(replay.original_result_code, 'ATHLETE_SHARED_CONFIRMATION_BINDING_INVALID');
  assert.equal(replay.original_result_state_hash, state.state_hash);
  assert.equal(JSON.parse(await redis.get(stateKey)).envelope_hash, refusedEnvelope.envelope_hash);

  const conflict = await invoke(handler(redis), {
    method: 'POST',
    token: replay.csrf_token,
    body: { ...body, decision: 'REJECT' },
  });
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.json().code, 'ATHLETE_IDEMPOTENCY_CONFLICT');
  assert.equal(JSON.parse(await redis.get(stateKey)).envelope_hash, refusedEnvelope.envelope_hash);
});

test('rate limiting is durable and atomically establishes its 15-minute TTL', async () => {
  const redis = new FakeRedis();
  const live = handler(redis);
  const opened = await invoke(live, { method: 'GET' });
  assert.equal(opened.statusCode, 200);
  const rateKey = [...redis.values.keys()].find((key) => key.includes(':athlete-consulting-rate:'));
  const rateEval = redis.evalCalls.find((call) => call.keys[0] === rateKey);
  assert.match(rateEval.script, /INCR/u);
  assert.match(rateEval.script, /EXPIRE/u);
  assert.deepEqual(rateEval.argv, ['900']);
  await redis.set(rateKey, '90');
  const limited = await invoke(handler(redis), { method: 'GET' });
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.json().code, 'ATHLETE_LIVING_CONSULT_RATE_LIMITED');
});

test('a corrupt durable envelope fails closed with a sanitized response and always releases its lease', async () => {
  const redis = new FakeRedis();
  const live = handler(redis);
  const opened = await invoke(live, { method: 'GET' });
  assert.equal(opened.statusCode, 200);
  const stateKey = [...redis.values.keys()].find((key) => key.endsWith(':state'));
  const lockKey = stateKey.replace(/:state$/u, ':lock');
  redis.values.set(stateKey, '{"contract_id":');
  const corrupt = await invoke(handler(redis), { method: 'GET' });
  assert.equal(corrupt.statusCode, 503);
  assert.deepEqual(corrupt.json(), { ok: false, code: 'ATHLETE_LIVING_CONSULT_UNAVAILABLE' });
  assert.equal(redis.values.has(lockKey), false);
  assert.equal(corrupt.headers['access-control-allow-origin'], undefined);
  assert.doesNotMatch(corrupt.chunks.join(''), /CORRUPT|contract_id|SyntaxError/iu);
});

test('an expired synthetic grant self-recovers to a fresh isolated baseline without manual Redis deletion', async () => {
  let now = new Date('2026-09-08T12:00:00.000Z');
  const clock = () => new Date(now);
  const redis = new FakeRedis();
  const live = handler(redis, { clock });
  let state = (await invoke(live, { method: 'GET' })).json();
  await invoke(live, {
    method: 'POST', token: state.csrf_token,
    body: { action: 'START_MY_FIRST_SESSION', idempotency_key: 'expired-recovery-start-001' },
  });
  const stateKey = [...redis.values.keys()].find((key) => key.endsWith(':state'));
  const backupKey = stateKey.replace(/:state$/u, ':backup');
  const before = JSON.parse(await redis.get(stateKey));
  now = new Date('2026-12-09T12:00:00.000Z');
  const recovered = (await invoke(handler(redis, { clock }), { method: 'GET' })).json();
  const after = JSON.parse(await redis.get(stateKey));
  assert.equal(recovered.ok, true);
  assert.equal(recovered.session.pre_session_state, true);
  assert.equal(recovered.session.session_id, null);
  assert.equal(after.reset_epoch, before.reset_epoch + 1);
  assert.ok(Date.parse(after.runtime_snapshot.current_grant.expires_at) > now.getTime());
  assert.equal(JSON.parse(await redis.get(backupKey)).envelope_hash, before.envelope_hash);
  assert.equal(after.fixture_binding.fixture_id, 'mika');
});

test('operation identity remains stable across reissued Athlete browser capabilities', async () => {
  const redis = new FakeRedis();
  const live = handler(redis);
  const openedA = (await invoke(live, { method: 'GET', capability: 'a' })).json();
  const body = { action: 'START_MY_FIRST_SESSION', idempotency_key: 'cross-capability-replay-001' };
  const first = (await invoke(live, { method: 'POST', token: openedA.csrf_token, body, capability: 'a' })).json();
  const openedB = (await invoke(live, { method: 'GET', capability: 'b' })).json();
  const replay = (await invoke(live, { method: 'POST', token: openedB.csrf_token, body, capability: 'b' })).json();
  assert.equal(replay.code, 'ATHLETE_IDEMPOTENT_REPLAY');
  assert.equal(replay.original_result_state_hash, first.state_hash);
  assert.equal(replay.revision, first.revision);
});

test('progressive post-coaching crash writes a sanitized terminal failure and the client rejects coaching-only EOF', async () => {
  const redis = new FakeRedis();
  const live = handler(redis);
  let state = (await invoke(live, { method: 'GET' })).json();
  state = (await invoke(live, {
    method: 'POST', token: state.csrf_token,
    body: { action: 'START_MY_FIRST_SESSION', idempotency_key: 'progressive-start-001' },
  })).json();
  redis.failPersistAt = redis.persistCalls + 3;
  const progressive = await invoke(live, {
    method: 'POST', token: state.csrf_token, accept: 'application/x-ndjson',
    body: {
      action: 'TURN',
      message: 'What should we understand?',
      conversation_capability: state.authority_capabilities.conversation_capability,
      idempotency_key: 'progressive-crash-001',
    },
  });
  const events = progressive.chunks.join('').trim().split('\n').map((line) => JSON.parse(line));
  assert.deepEqual(events.map((event) => event.code), ['ATHLETE_COACHING_READY', 'ATHLETE_LIVING_CONSULT_UNAVAILABLE']);
  assert.equal(events.at(-1).ok, false);
  assert.equal(progressive.headers['access-control-allow-origin'], undefined);

  const priorWindow = globalThis.window;
  const priorFetch = globalThis.fetch;
  globalThis.window = { location: { origin: 'https://moremindmap.com' } };
  globalThis.fetch = async () => new Response(`${JSON.stringify({ ok: true, code: 'ATHLETE_COACHING_READY', phase: 'COACHING_READY' })}\n`, {
    status: 200,
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8' },
  });
  try {
    await assert.rejects(() => postAthleteLivingConsultOneShot({ fixtureId: 'mika', csrfToken: 'x', body: { action: 'TURN' } }), /PROGRESSIVE_TERMINAL_REQUIRED/u);
  } finally {
    globalThis.window = priorWindow;
    globalThis.fetch = priorFetch;
  }
});
