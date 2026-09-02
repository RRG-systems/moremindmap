import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  authenticateInternalDevRequest,
  internalDevKeys,
  issueInternalDevCapability,
} from '../api/engine/subscriptionV1/internalDevInfrastructure.js';
import { createSubscriptionDemoResetHandler } from '../api/internal/subscription-v1-demo-reset.js';
import { createSubscriptionV1RuntimeHandler } from '../api/internal/subscription-v1-runtime.js';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';

class FakeRedis {
  constructor() { this.values = new Map(); this.lists = new Map(); }
  async get(key) { return this.values.get(key) ?? null; }
  async getdel(key) { const value = this.values.get(key) ?? null; this.values.delete(key); return value; }
  async set(key, value, ...args) { if (args.includes('NX') && this.values.has(key)) return null; if (args.includes('XX') && !this.values.has(key)) return null; this.values.set(key, String(value)); return 'OK'; }
  async del(key) { return this.values.delete(key) ? 1 : 0; }
  async incr(key) { const value = Number(this.values.get(key) || 0) + 1; this.values.set(key, String(value)); return value; }
  async expire() { return 1; }
  async lpush(key, value) { const values = this.lists.get(key) || []; values.unshift(value); this.lists.set(key, values); return values.length; }
  async ltrim(key, start, end) { this.lists.set(key, (this.lists.get(key) || []).slice(start, end + 1)); return 1; }
  async lrange(key, start, end) { return (this.lists.get(key) || []).slice(start, end + 1); }
  async eval(_script, keyCount, ...parts) {
    const keys = parts.slice(0, keyCount); const args = parts.slice(keyCount);
    if (keyCount === 1) { if (this.values.get(keys[0]) !== args[0]) return 0; this.values.delete(keys[0]); return 1; }
    if (keyCount === 3) { if (this.values.get(keys[0]) !== args[0]) return 0; const prior = this.values.get(keys[1]); if (prior) this.values.set(keys[2], prior); this.values.set(keys[1], args[1]); return 1; }
    throw new Error('Unexpected fake Redis script');
  }
}

const launcher = Object.freeze({ contract: 'leadership_demo_launcher_capability_v1', launcher_scope_id: 'leadership_demo_aaaaaaaaaaaaaaaaaaaaaaaa', allowed_products: ['recruiting', 'subscription'], synthetic_only: true });
const enabledEnv = Object.freeze({ SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED: 'true' });
const authenticate = ({ redis, req }) => authenticateInternalDevRequest({ redis, req, env: enabledEnv });

function request({ method = 'GET', cookie = '', body = {}, csrf = '', query = {} } = {}) {
  return { method, query, body, headers: { host: 'moremindmap.com', origin: method === 'GET' ? '' : 'https://moremindmap.com', 'x-forwarded-proto': 'https', 'x-forwarded-for': '203.0.113.42', 'user-agent': 'Subscription DarrenDemo UX cleanup test', cookie, accept: 'application/json', ...(csrf ? { 'x-subscription-demo-reset-csrf': csrf } : {}) }, socket: {} };
}

function cookieHeader(setCookies) { return setCookies.map((value) => String(value).split(';')[0]).join('; '); }

async function invoke(handler, req) {
  let status = 200; let body = null; const headers = {};
  await handler(req, { status(value) { status = value; return this; }, setHeader(name, value) { headers[String(name).toLowerCase()] = value; }, json(value) { body = value; return value; }, write(value) { body = `${body || ''}${value}`; }, end(value) { if (value) body = `${body || ''}${value}`; }, flush() {}, flushHeaders() {} });
  return { status, body, headers };
}

async function createDarrenSession(redis) {
  const issued = await issueInternalDevCapability({ redis, req: request(), launcher });
  const cookie = cookieHeader(issued.cookies);
  const auth = await authenticate({ redis, req: request({ cookie }) });
  assert.equal(auth.ok, true);
  return { issued, cookie, auth };
}

test('Production DarrenDemo capability exposes exactly Synthetic Jordan plus demo-only reset', async () => {
  const redis = new FakeRedis(); const session = await createDarrenSession(redis);
  assert.equal(session.auth.demo_subject, 'synthetic');
  assert.equal(session.auth.capability.subject_key, 're-mid');
  assert.equal(session.auth.capability.demo_subject_switching, false);
  assert.equal(session.auth.capability.demo_reset_enabled, true);
  assert.deepEqual(session.auth.capability.allowed_demo_subjects, ['synthetic']);
});

test('Patricia query tampering cannot change the authoritative Synthetic Jordan runtime', async () => {
  const redis = new FakeRedis(); const session = await createDarrenSession(redis);
  const runtime = createSubscriptionV1RuntimeHandler({ getRedis: () => redis, authenticate, env: { OPENAI_API_KEY: 'unused-test-key' } });
  const result = await invoke(runtime, request({ cookie: session.cookie, query: { subject: 'patricia-demo' } }));
  assert.equal(result.status, 200);
  assert.equal(result.body.demo_subject, 'synthetic');
  assert.equal(result.body.identity.first_name, 'Jordan');
  assert.equal(result.body.demo_subject_switching, false);
  assert.equal(result.body.demo_reset_enabled, true);
});

test('Reset Demo clears only Synthetic evolution and reproduces the exact original baseline', async () => {
  const redis = new FakeRedis(); const session = await createDarrenSession(redis);
  const runtime = createSubscriptionV1RuntimeHandler({ getRedis: () => redis, authenticate, env: { OPENAI_API_KEY: 'unused-test-key' } });
  const baseline = await invoke(runtime, request({ cookie: session.cookie }));
  const baselineHash = hashCanonicalJson({ view_model: baseline.body.view_model, publication: baseline.body.publication });
  const keys = internalDevKeys({ relationship_key: session.auth.capability.relationship_key, subject_key: 're-mid' });
  for (const key of [keys.living_state, keys.living_backup, keys.allowance, keys.allowance_backup, keys.research, keys.diagnostics, keys.s2_relationship]) await redis.set(key, JSON.stringify({ evolved_demo_state: true }));
  const handler = createSubscriptionDemoResetHandler({ getRedis: () => redis, enabled: () => true, authenticate });
  const prepared = await invoke(handler, request({ cookie: session.cookie }));
  const reset = await invoke(handler, request({ method: 'POST', cookie: session.cookie, csrf: prepared.body.csrf_token, body: { action: 'RESET_DEMO' } }));
  assert.equal(reset.status, 200);
  assert.equal(reset.body.canonical_customer_mutation_performed, false);
  assert.equal(reset.body.real_personal_rsl_mutation_performed, false);
  for (const key of [keys.living_state, keys.living_backup, keys.allowance, keys.allowance_backup, keys.research, keys.diagnostics, keys.s2_relationship]) assert.equal(await redis.get(key), null);
  const restored = await invoke(runtime, request({ cookie: session.cookie }));
  assert.equal(restored.body.session.start_action, 'START_MY_FIRST_SESSION');
  assert.equal(hashCanonicalJson({ view_model: restored.body.view_model, publication: restored.body.publication }), baselineHash);
});

test('Reset Demo is single-use and denied to missing or direct jordanTEST authority', async () => {
  const redis = new FakeRedis(); const session = await createDarrenSession(redis);
  const handler = createSubscriptionDemoResetHandler({ getRedis: () => redis, enabled: () => true, authenticate });
  const prepared = await invoke(handler, request({ cookie: session.cookie }));
  assert.equal((await invoke(handler, request({ method: 'POST', cookie: session.cookie, csrf: prepared.body.csrf_token }))).status, 200);
  const keys = internalDevKeys({ relationship_key: session.auth.capability.relationship_key, subject_key: 're-mid' });
  await redis.set(keys.living_state, 'new-state');
  assert.equal((await invoke(handler, request({ method: 'POST', cookie: session.cookie, csrf: prepared.body.csrf_token }))).status, 403);
  assert.equal(await redis.get(keys.living_state), 'new-state');
  assert.equal((await invoke(handler, request())).status, 401);
  const direct = await issueInternalDevCapability({ redis, req: request() });
  assert.equal(direct.capability.demo_reset_enabled, false);
  assert.equal((await invoke(handler, request({ cookie: cookieHeader(direct.cookies) }))).status, 403);
});

test('customer-facing source has clear start copy, one welcome, Synthetic Jordan only, and demo-only reset', () => {
  const ui = fs.readFileSync(new URL('../src/subscriptionV1/SubscriptionV1InternalDevApp.jsx', import.meta.url), 'utf8');
  const renderer = fs.readFileSync(new URL('../src/subscriptionS2/SubscriptionS2GuRenderer.jsx', import.meta.url), 'utf8');
  const retiredSubjectRoute = fs.readFileSync(new URL('../api/internal/subscription-v1-demo-subject.js', import.meta.url), 'utf8');
  assert.match(ui, /Click START MY FIRST SESSION to meet your MORE coach and begin\./u);
  assert.match(ui, /Click START SESSION to pick up where you left off\./u);
  assert.doesNotMatch(ui, /Start when you are ready/iu);
  assert.equal((renderer.match(/WELCOME TO MORE/gu) || []).length, 1);
  assert.match(ui, /SYNTHETIC JORDAN/u);
  assert.match(ui, /RESET DEMO/u);
  assert.match(ui, /data-demo-only-control="true"/u);
  assert.doesNotMatch(ui, /PATRICIA|chooseDemoSubject|subscription-v1-demo-subject/iu);
  assert.match(retiredSubjectRoute, /SUBSCRIPTION_DEMO_SUBJECT_SWITCH_RETIRED/u);
  assert.doesNotMatch(retiredSubjectRoute, /switchInternalDevDemoSubject|PATRICIA_DEMO/u);
});
