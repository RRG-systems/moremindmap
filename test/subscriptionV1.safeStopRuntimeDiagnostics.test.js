import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { createSubscriptionV1RuntimeHandler } from '../api/internal/subscription-v1-runtime.js';

function request() {
  return {
    method: 'POST',
    body: { action: 'TURN' },
    query: {},
    headers: {
      host: 'moremindmap.com',
      origin: 'https://moremindmap.com',
      'x-forwarded-proto': 'https',
      'x-vercel-id': 'iad1::synthetic-safe-stop-correlation',
    },
    socket: {},
  };
}

async function invoke(handler, req) {
  let status = 200;
  let body = null;
  const headers = {};
  await handler(req, {
    status(value) { status = value; return this; },
    setHeader(name, value) { headers[String(name).toLowerCase()] = value; },
    json(value) { body = value; return value; },
  });
  return { status, body, headers };
}

test('runtime preserves fail-closed 401 while emitting only sanitized exact auth classification', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (value) => warnings.push(String(value));
  try {
    const handler = createSubscriptionV1RuntimeHandler({
      getRedis: () => ({}),
      authenticate: async () => ({
        ok: false,
        status: 401,
        code: 'SUBSCRIPTION_V1_INTERNAL_ENTITLEMENT_INVALID',
        failure_class: 'CAPABILITY_BROWSER_BINDING_MISMATCH',
      }),
      env: {},
    });
    const result = await invoke(handler, request());
    assert.equal(result.status, 401);
    assert.deepEqual(result.body, {
      ok: false,
      code: 'SUBSCRIPTION_V1_INTERNAL_ENTITLEMENT_INVALID',
      reentry_required: true,
    });
    assert.equal(warnings.length, 1);
    const logged = JSON.parse(warnings[0]);
    assert.equal(logged.event, 'SUBSCRIPTION_V1_RUNTIME_AUTH_REJECTED');
    assert.equal(logged.failure_class, 'CAPABILITY_BROWSER_BINDING_MISMATCH');
    assert.match(logged.request_correlation_hash, /^[a-f0-9]{20}$/u);
    assert.equal(logged.capability_material_logged, false);
    assert.equal(logged.customer_data_logged, false);
    assert.doesNotMatch(warnings[0], /synthetic-safe-stop-correlation/u);
  } finally {
    console.warn = originalWarn;
  }
});

test('Subscription UI routes entitlement loss to the existing Leadership re-entry boundary instead of generic coaching SAFE STOP', () => {
  const source = fs.readFileSync(new URL('../src/subscriptionV1/SubscriptionV1InternalDevApp.jsx', import.meta.url), 'utf8');
  assert.match(source, /failure\.status === 401 && failure\.reentryRequired/u);
  assert.match(source, /onEntitlementLost\?\.\(failure\.code\)/u);
  assert.match(source, /Return to Leadership Portal/u);
  assert.match(source, /Internal Subscription access required\./u);
  assert.doesNotMatch(source, /CAPABILITY_BROWSER_BINDING_MISMATCH/u);
});
