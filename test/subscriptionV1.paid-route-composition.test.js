import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { createSubscriptionV1RuntimeEntry } from '../api/internal/subscription-v1-runtime.js';
import { createPaidSubscriptionV1RuntimeComposition } from '../api/engine/subscriptionV1/paidRuntimeComposition.js';

function response() {
  return {
    statusCode: 200,
    payload: null,
    headers: {},
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.payload = value; return this; },
  };
}

test('paid route remains exact-value default-off and preserves ordinary internal runtime', async () => {
  const calls = [];
  const handler = createSubscriptionV1RuntimeEntry({
    env: { PUBLIC_SUBSCRIPTION_RUNTIME_ENABLED: 'TRUE' },
    getRedis: () => ({ marker: 'redis' }),
    authenticateInternal: async () => ({ ok: false }),
    ordinary: async (_req, res) => { calls.push('ordinary'); return res.status(200).json({ ok: true }); },
    paidRuntimeFactory: async () => { calls.push('paid-factory'); throw new Error('must_not_construct'); },
  });
  const res = response();
  await handler({ method: 'GET', headers: {} }, res);
  assert.deepEqual(calls, ['ordinary']);
  assert.equal(res.statusCode, 200);
});

test('valid internal and Darren capabilities retain priority over the paid route', async () => {
  const ordinaryCalls = [];
  const ordinary = async (_req, res) => { ordinaryCalls.push('ordinary'); return res.status(200).json({ ok: true }); };
  const shared = {
    env: { PUBLIC_SUBSCRIPTION_RUNTIME_ENABLED: 'true' },
    getRedis: () => ({ marker: 'redis' }),
    ordinary,
    paidRuntimeFactory: async () => { throw new Error('paid_must_not_construct'); },
  };

  const internal = createSubscriptionV1RuntimeEntry({
    ...shared,
    authenticateInternal: async () => ({ ok: true, capability: { demo_subject_id: 'synthetic' } }),
  });
  await internal({ method: 'GET', headers: {} }, response());

  let blindCalls = 0;
  const darren = createSubscriptionV1RuntimeEntry({
    ...shared,
    authenticateInternal: async () => ({
      ok: true,
      capability: {
        contract: 'subscription_v1_internal_capability_v2',
        authority_source: 'LEADERSHIP_DEMO',
        launcher_scope_id: 'leadership_demo_paid_route_precedence',
        synthetic_only: true,
        allowed_demo_subjects: ['synthetic'],
        demo_subject_id: 'synthetic',
      },
    }),
    blindDemoHandler: async () => { blindCalls += 1; },
  });
  await darren({ method: 'GET', headers: {} }, response());

  assert.deepEqual(ordinaryCalls, ['ordinary']);
  assert.equal(blindCalls, 1);
});

test('enabled customer entrance never downgrades a failed paid boundary to synthetic', async () => {
  const calls = [];
  const handler = createSubscriptionV1RuntimeEntry({
    env: { PUBLIC_SUBSCRIPTION_RUNTIME_ENABLED: 'true' },
    getRedis: () => ({ marker: 'redis' }),
    authenticateInternal: async () => ({ ok: false, status: 401 }),
    ordinary: async () => { calls.push('ordinary'); throw new Error('must_not_fallback'); },
    paidRuntimeFactory: async () => async (_req, res) => {
      calls.push('paid');
      return res.status(403).json({ ok: false, code: 'SUBSCRIPTION_V1_PAID_MEMBERSHIP_REQUIRED' });
    },
  });
  const res = response();
  await handler({ method: 'GET', headers: {} }, res);
  assert.deepEqual(calls, ['paid']);
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.code, 'SUBSCRIPTION_V1_PAID_MEMBERSHIP_REQUIRED');
});

test('paid composition/setup failure is generic, private, and never falls through', async () => {
  let ordinaryCalls = 0;
  const handler = createSubscriptionV1RuntimeEntry({
    env: { PUBLIC_SUBSCRIPTION_RUNTIME_ENABLED: 'true' },
    getRedis: () => ({ marker: 'redis' }),
    authenticateInternal: async () => { throw new Error('no_internal_cookie'); },
    ordinary: async () => { ordinaryCalls += 1; },
    paidRuntimeFactory: async () => { throw new Error('private_configuration_detail'); },
  });
  const res = response();
  await handler({ method: 'GET', headers: {} }, res);
  assert.equal(ordinaryCalls, 0);
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.payload, { ok: false, code: 'SUBSCRIPTION_V1_PAID_RUNTIME_UNAVAILABLE' });
  assert.equal(res.headers['cache-control'], 'no-store, private, max-age=0');
});

test('tampered winner custody stops composition before state access and stays private at the route boundary', async () => {
  let stateReads = 0;
  const redis = new Proxy({}, {
    get() {
      stateReads += 1;
      throw new Error('state_must_not_be_read');
    },
  });
  const handler = createSubscriptionV1RuntimeEntry({
    env: { PUBLIC_SUBSCRIPTION_RUNTIME_ENABLED: 'true' },
    getRedis: () => redis,
    authenticateInternal: async () => ({ ok: false, status: 401 }),
    ordinary: async () => { throw new Error('must_not_fallback'); },
    paidRuntimeFactory: async ({ redis: paidRedis, env }) => createPaidSubscriptionV1RuntimeComposition({
      redis: paidRedis,
      env,
      winnerAcceptance: {},
    }),
  });
  const res = response();
  await handler({ method: 'GET', headers: {} }, res);

  assert.equal(stateReads, 0);
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.payload, { ok: false, code: 'SUBSCRIPTION_V1_PAID_RUNTIME_UNAVAILABLE' });
  const publicPayload = JSON.stringify(res.payload);
  for (const forbidden of ['winner', 'model', 'provider', 'artifact', 'authority', 'sha256', 'assignment']) {
    assert.equal(publicPayload.toLowerCase().includes(forbidden), false);
  }
});

test('paid browser mode removes every synthetic control and shared browser transcript key', () => {
  const ui = fs.readFileSync(new URL('../src/subscriptionV1/SubscriptionV1InternalDevApp.jsx', import.meta.url), 'utf8');
  assert.match(ui, /subscriber\?\.kind === 'PAID_SUBSCRIBER'/u);
  assert.match(ui, /!paidSubscriber && <nav className="s2-demo-toolbar"/u);
  assert.match(ui, /data-synthetic-only="false"/u);
  assert.match(ui, /ephemeralStorageEnabled=\{!paidSubscriber\}/u);
  assert.match(ui, /demoSubject=\{paidSubscriber \? null : DEMO_SUBJECT\}/u);
  assert.ok(ui.includes('!ephemeralStorageEnabled ? [] : readEphemeralMessages'));
  assert.ok(ui.includes('(demoSubject ? { subject: demoSubject } : {})'));
  assert.match(ui, /SUBSCRIPTION_V1_PAID_\|ENTITLEMENT_/u);
  assert.match(ui, /Return to your Profile to verify ownership and active membership/u);
  assert.match(ui, /<Link to="\/profile">Return to Profile<\/Link>/u);
});
