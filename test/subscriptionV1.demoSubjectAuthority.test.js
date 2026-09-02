import assert from 'node:assert/strict';
import test from 'node:test';

import {
  authenticateInternalDevRequest,
  internalDevKeys,
  issueInternalDevCapability,
} from '../api/engine/subscriptionV1/internalDevInfrastructure.js';
import {
  PATRICIA_DEMO_RELATIONSHIP_KEY,
  PATRICIA_DEMO_SUBJECT_KEY,
} from '../api/engine/subscriptionS2/demoSubjectAuthority.js';
import { loadAuthorizedSubscriptionDemoSubscriber } from '../api/engine/subscriptionS2/demoSubscriberLoader.js';
import { provePatriciaDemoStorageIsolation } from '../api/engine/subscriptionS2/patriciaDemoSubscriberLoader.js';
import { createSubscriptionDemoSubjectHandler } from '../api/internal/subscription-v1-demo-subject.js';
import { createSubscriptionV1RuntimeHandler } from '../api/internal/subscription-v1-runtime.js';

class FakeRedis {
  constructor() { this.values = new Map(); this.lists = new Map(); }
  async get(key) { return this.values.get(key) ?? null; }
  async getdel(key) { const value = this.values.get(key) ?? null; this.values.delete(key); return value; }
  async set(key, value, ...args) {
    if (args.includes('NX') && this.values.has(key)) return null;
    if (args.includes('XX') && !this.values.has(key)) return null;
    this.values.set(key, String(value));
    return 'OK';
  }
  async del(key) { return this.values.delete(key) ? 1 : 0; }
  async incr(key) { const value = Number(this.values.get(key) || 0) + 1; this.values.set(key, String(value)); return value; }
  async expire() { return 1; }
  async lpush(key, value) { const values = this.lists.get(key) || []; values.unshift(value); this.lists.set(key, values); return values.length; }
  async ltrim(key, start, end) { this.lists.set(key, (this.lists.get(key) || []).slice(start, end + 1)); return 'OK'; }
  async lrange(key, start, end) { return (this.lists.get(key) || []).slice(start, end + 1); }
  async eval(_script, keyCount, ...parts) {
    const keys = parts.slice(0, keyCount);
    const args = parts.slice(keyCount);
    if (keyCount === 1) { if (this.values.get(keys[0]) !== args[0]) return 0; this.values.delete(keys[0]); return 1; }
    if (keyCount === 3) { if (this.values.get(keys[0]) !== args[0]) return 0; const prior = this.values.get(keys[1]); if (prior) this.values.set(keys[2], prior); this.values.set(keys[1], args[1]); return 1; }
    throw new Error('Unexpected fake Redis script');
  }
}

const launcher = Object.freeze({
  contract: 'leadership_demo_launcher_capability_v1',
  launcher_scope_id: 'leadership_demo_aaaaaaaaaaaaaaaaaaaaaaaa',
  allowed_products: ['recruiting', 'subscription'],
  synthetic_only: true,
});
const enabledEnv = Object.freeze({ SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED: 'true' });
const authenticate = ({ redis, req }) => authenticateInternalDevRequest({ redis, req, env: enabledEnv });

function request({ method = 'GET', cookie = '', body = {}, csrf = '', query = {} } = {}) {
  return {
    method,
    query,
    body,
    headers: {
      host: 'moremindmap.com',
      origin: method === 'GET' ? '' : 'https://moremindmap.com',
      'x-forwarded-proto': 'https',
      'x-forwarded-for': '203.0.113.41',
      'user-agent': 'Subscription subject authority test browser',
      cookie,
      accept: 'application/json',
      ...(csrf ? { 'x-subscription-demo-subject-csrf': csrf } : {}),
    },
    socket: {},
  };
}

function cookieHeader(setCookies) {
  return setCookies.map((value) => String(value).split(';')[0]).join('; ');
}

async function invoke(handler, req) {
  let status = 200;
  let body = null;
  const headers = {};
  await handler(req, {
    status(value) { status = value; return this; },
    setHeader(name, value) { headers[String(name).toLowerCase()] = value; },
    json(value) { body = value; return value; },
    write(value) { body = `${body || ''}${value}`; },
    end(value) { if (value) body = `${body || ''}${value}`; },
    flush() {}, flushHeaders() {},
  });
  return { status, body, headers };
}

async function createDarrenSession(redis) {
  const issued = await issueInternalDevCapability({ redis, req: request(), launcher });
  const cookie = cookieHeader(issued.cookies);
  const auth = await authenticate({ redis, req: request({ cookie }) });
  assert.equal(auth.ok, true);
  return { issued, cookie, auth };
}

test('DarrenDemo capability exposes Synthetic Jordan as its only subject authority', async () => {
  const redis = new FakeRedis();
  const session = await createDarrenSession(redis);
  assert.equal(session.auth.demo_subject, 'synthetic');
  assert.equal(session.auth.capability.subject_key, 're-mid');
  assert.equal(session.auth.capability.relationship_key, session.auth.capability.synthetic_relationship_key);
  assert.equal(session.auth.capability.demo_subject_switching, false);
  assert.equal(session.auth.capability.demo_reset_enabled, true);
  assert.deepEqual(session.auth.capability.allowed_demo_subjects, ['synthetic']);

  const handler = createSubscriptionDemoSubjectHandler({ getRedis: () => redis, enabled: () => true, authenticate });
  const retired = await invoke(handler, request({ method: 'POST', cookie: session.cookie, body: { subject: 'patricia-demo' } }));
  assert.equal(retired.status, 410);
  assert.equal(retired.body.code, 'SUBSCRIPTION_DEMO_SUBJECT_SWITCH_RETIRED');

  const reloaded = await authenticate({ redis, req: request({ cookie: session.cookie }) });
  assert.equal(reloaded.ok, true);
  assert.equal(reloaded.demo_subject, 'synthetic');
  assert.equal(reloaded.capability.subject_key, 're-mid');
  assert.equal(reloaded.capability.relationship_key, session.auth.capability.synthetic_relationship_key);
  assert.equal(reloaded.capability.synthetic_relationship_key, session.auth.capability.synthetic_relationship_key);
});

test('query-only tampering cannot change authoritative subject scope', async () => {
  const redis = new FakeRedis();
  const session = await createDarrenSession(redis);
  const runtime = createSubscriptionV1RuntimeHandler({ getRedis: () => redis, authenticate, env: { OPENAI_API_KEY: 'unused-test-key' } });
  const tampered = await invoke(runtime, request({ cookie: session.cookie, query: { subject: 'patricia-demo' } }));
  assert.equal(tampered.status, 200);
  assert.equal(tampered.body.demo_subject, 'synthetic');
  assert.equal(tampered.body.identity.first_name, 'Jordan');
  assert.equal(tampered.body.view_model.identity.firstName, 'Jordan');
});

test('retired Patricia subject selection cannot become active and reload stays Synthetic Jordan', async () => {
  const redis = new FakeRedis();
  const session = await createDarrenSession(redis);
  const handler = createSubscriptionDemoSubjectHandler({ getRedis: () => redis, enabled: () => true, authenticate });
  const getAttempt = await invoke(handler, request({ cookie: session.cookie, query: { subject: 'patricia-demo' } }));
  const postAttempt = await invoke(handler, request({ method: 'POST', cookie: session.cookie, body: { subject: 'patricia-demo' } }));
  for (const result of [getAttempt, postAttempt]) {
    assert.equal(result.status, 410);
    assert.equal(result.body.code, 'SUBSCRIPTION_DEMO_SUBJECT_SWITCH_RETIRED');
  }

  const runtime = createSubscriptionV1RuntimeHandler({ getRedis: () => redis, authenticate, env: { OPENAI_API_KEY: 'unused-test-key' } });
  const first = await invoke(runtime, request({ cookie: session.cookie }));
  const reload = await invoke(runtime, request({ cookie: session.cookie, query: { subject: 'patricia-demo' } }));
  for (const result of [first, reload]) {
    assert.equal(result.status, 200);
    assert.equal(result.body.demo_subject, 'synthetic');
    assert.equal(result.body.identity.first_name, 'Jordan');
    assert.equal(result.body.view_model.identity.firstName, 'Jordan');
    assert.doesNotMatch(result.body.view_model.identity.business, /Patricia-derived/u);
    assert.equal(result.body.architecture.subject_key, 're-mid');
    assert.equal(result.body.architecture.synthetic_only, true);
    assert.equal(result.body.architecture.exact_scope_hash, internalDevKeys({
      relationship_key: session.auth.capability.synthetic_relationship_key,
      subject_key: 're-mid',
    }).scope_hash);
  }
});

test('retired subject route cannot change Synthetic Jordan through repeated selections', async () => {
  const redis = new FakeRedis();
  const session = await createDarrenSession(redis);
  const handler = createSubscriptionDemoSubjectHandler({ getRedis: () => redis, enabled: () => true, authenticate });
  for (const subject of ['patricia-demo', 'synthetic', 'patricia-demo']) {
    const attempt = await invoke(handler, request({ method: 'POST', cookie: session.cookie, body: { subject } }));
    assert.equal(attempt.status, 410);
    assert.equal(attempt.body.code, 'SUBSCRIPTION_DEMO_SUBJECT_SWITCH_RETIRED');
  }
  const restored = await authenticate({ redis, req: request({ cookie: session.cookie }) });
  assert.equal(restored.demo_subject, 'synthetic');
  assert.equal(restored.capability.subject_key, 're-mid');
  assert.equal(restored.capability.relationship_key, session.auth.capability.relationship_key);
});

test('arbitrary subjects and missing or non-Darren authority fail closed', async () => {
  const redis = new FakeRedis();
  const session = await createDarrenSession(redis);
  const handler = createSubscriptionDemoSubjectHandler({ getRedis: () => redis, enabled: () => true, authenticate });
  const unsupported = await invoke(handler, request({ method: 'POST', cookie: session.cookie, body: { subject: 'MM-arbitrary-customer' } }));
  assert.equal(unsupported.status, 410);
  assert.equal(unsupported.body.code, 'SUBSCRIPTION_DEMO_SUBJECT_SWITCH_RETIRED');
  assert.equal((await authenticate({ redis, req: request({ cookie: session.cookie }) })).demo_subject, 'synthetic');

  const missing = await invoke(handler, request());
  assert.equal(missing.status, 401);
  const direct = await issueInternalDevCapability({ redis, req: request() });
  const denied = await invoke(handler, request({ cookie: cookieHeader(direct.cookies) }));
  assert.equal(denied.status, 410);
  assert.equal(denied.body.code, 'SUBSCRIPTION_DEMO_SUBJECT_SWITCH_RETIRED');
  const directAuth = await authenticate({ redis, req: request({ cookie: cookieHeader(direct.cookies) }) });
  assert.equal(directAuth.demo_subject, 'synthetic');
  assert.equal(directAuth.capability.demo_subject_switching, false);
});

test('Patricia writable state remains isolated from canonical identities and Synthetic scope', async () => {
  const isolation = provePatriciaDemoStorageIsolation();
  assert.equal(isolation.ok, true);
  assert.equal(isolation.actual_patricia_write_path, false);
  const patriciaKeys = internalDevKeys({ relationship_key: PATRICIA_DEMO_RELATIONSHIP_KEY, subject_key: PATRICIA_DEMO_SUBJECT_KEY });
  const syntheticKeys = internalDevKeys({ relationship_key: 'rel_11111111111111111111', subject_key: 're-mid' });
  assert.notEqual(patriciaKeys.scope_hash, syntheticKeys.scope_hash);
  assert.equal(JSON.stringify(patriciaKeys).toLowerCase().includes('mm-'), false);

  const loaded = await loadAuthorizedSubscriptionDemoSubscriber({
    redis: new FakeRedis(),
    relationship_key: PATRICIA_DEMO_RELATIONSHIP_KEY,
    subject_key: PATRICIA_DEMO_SUBJECT_KEY,
    session_id: 'session_aaaaaaaaaaaaaaaaaaaaaaaa',
    session_kind: 'FIRST_EVER',
    transport: async (_request, { stage }) => ({
      output: stage === 'CONVERSATION' ? { customer_message: 'One useful next step.' } : { candidate: null },
      usage: {}, latency_ms: 1,
    }),
  });
  assert.equal(loaded.identity.demo_copy_only, true);
  assert.equal(loaded.architecture.actual_patricia_write_path, false);
  assert.equal(loaded.keys.scope_hash, patriciaKeys.scope_hash);
});
