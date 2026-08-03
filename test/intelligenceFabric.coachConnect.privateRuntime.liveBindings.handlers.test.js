import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createPrivateRuntimeLoginHandler,
} from '../api/internal/private-runtime-login.js';
import {
  createPrivateRuntimeCallbackHandler,
} from '../api/internal/private-runtime-callback.js';
import {
  createPrivateRuntimeLogoutHandler,
} from '../api/internal/private-runtime-logout.js';
import {
  createPrivateRuntimeBootstrapHandler,
} from '../api/internal/private-runtime-bootstrap.js';
import {
  resolveSubscriptionEntitlement,
} from '../api/internal/subscription-entitlement.js';

function response() {
  return {
    headers: {},
    statusCode: null,
    payload: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.payload = value; return this; },
  };
}

test('all seven live surfaces consume the one composition accessor', async () => {
  const paths = [
    '../api/internal/private-runtime-login.js',
    '../api/internal/private-runtime-callback.js',
    '../api/internal/private-runtime-session.js',
    '../api/internal/private-runtime-bootstrap.js',
    '../api/internal/private-runtime-logout.js',
    '../api/internal/developer-access.js',
    '../api/internal/subscription-entitlement.js',
  ];
  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.equal(source.includes('getPrivateRuntimeLiveCompositionV2'), true, path);
    assert.equal(source.includes('createUpstashRedisRemoteSharedSecurityAdapter'), false, path);
    assert.equal(source.includes('SyntheticAsyncSecurityStateAdapter'), false, path);
  }
});

test('login handler writes pre-auth, browser, and OIDC transaction cookies without JSON secrets', async () => {
  const handler = createPrivateRuntimeLoginHandler({
    enabled: () => true,
    beginLogin: async () => ({
      ok: true,
      allowed: true,
      pre_auth_session_ref: 'pre_auth_handler',
      pre_auth_cookie_value: 'pre_auth_cookie_handler',
      browser_binding_cookie_value: 'browser_cookie_handler',
      transaction_cookie_value: 'transaction_cookie_handler',
      authorization_url: 'https://identity.private.example/authorize',
      expires_at: '2026-08-28T10:00:00.000Z',
    }),
  });
  const res = response();
  await handler({
    method: 'POST',
    headers: {},
    body: {
      browser_binding_reference: 'browser_binding_reference_handler',
      correlation_id: 'correlation_handler',
    },
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(Array.isArray(res.headers['Set-Cookie']), true);
  assert.equal(res.headers['Set-Cookie'].length, 3);
  assert.equal(JSON.stringify(res.payload).includes('pre_auth_cookie_handler'), false);
  assert.equal(JSON.stringify(res.payload).includes('transaction_cookie_handler'), false);
});

test('callback handler supports provider callback and clears transaction state', async () => {
  const handler = createPrivateRuntimeCallbackHandler({
    enabled: () => true,
    completeLogin: async () => ({
      ok: true,
      allowed: true,
      session_cookie_value: 'sealed_session_handler',
      raw_assertion_present: false,
      raw_token_persisted: false,
      audit_receipt_ref: 'audit_handler',
    }),
  });
  const res = response();
  await handler({ method: 'GET', headers: {}, query: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(Array.isArray(res.headers['Set-Cookie']), true);
  assert.equal(String(res.headers['Set-Cookie'][1]).includes('Max-Age=0'), true);
  assert.equal(JSON.stringify(res.payload).includes('sealed_session_handler'), false);
});

test('logout clears local cookies even when authoritative revocation cannot be claimed', async () => {
  const handler = createPrivateRuntimeLogoutHandler({
    enabled: () => true,
    logout: async () => ({
      ok: false,
      allowed: false,
      code: 'PROVIDER_UNAVAILABLE',
      status: 503,
      server_revocation_confirmed: false,
    }),
  });
  const res = response();
  await handler({ method: 'POST', headers: {} }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(Array.isArray(res.headers['Set-Cookie']), true);
  assert.equal(res.payload.ok, false);
});

test('subscription entitlement defaults to the shared V2 composition and never paid fallback', async () => {
  let calls = 0;
  const result = await resolveSubscriptionEntitlement({
    req: { method: 'GET', headers: {} },
    compositionAccessor: () => ({
      operations: {
        async resolveSubscriptionEntitlement() {
          calls += 1;
          return {
            ok: true,
            allowed: true,
            entitlement: {
              temporary: true,
              paid_entitlement: false,
              expires_at: '2026-08-28T10:00:00.000Z',
            },
            authority: { allowed: true },
          };
        },
      },
    }),
  });
  assert.equal(calls, 1);
  assert.equal(result.allowed, true);
  assert.equal(result.entitlement.source, 'temporary_internal_subscription_entitlement');
  assert.equal(result.entitlement.billing_evidence, false);
  assert.equal(result.entitlement.stripe_subscription_created, false);
});

test('attachment predicate remains absent from every bootstrap HTTP projection', async () => {
  const handler = createPrivateRuntimeBootstrapHandler({
    enabled: () => true,
    bootstrap: async () => ({
      ok: false,
      allowed: false,
      code: 'BUSINESS_ENGINE_ATTACHMENT_NOT_FOUND',
      status: 403,
      diagnostic_receipt_written: true,
    }),
  });
  const res = response();
  await handler({
    method: 'POST',
    headers: {
      'x-private-runtime-diagnostic': 'forged',
      cookie: '__Host-more_subdev1_operator=forged',
    },
    body: {},
  }, res);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.payload, { ok: false, error: 'request_denied' });
  assert.equal(JSON.stringify(res.headers).includes('BUSINESS_ENGINE_ATTACHMENT_NOT_FOUND'), false);
  assert.equal(JSON.stringify(res.payload).includes('BUSINESS_ENGINE_ATTACHMENT_NOT_FOUND'), false);
});
