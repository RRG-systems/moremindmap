import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import defaultDeveloperAccessHandler, {
  createDeveloperAccessHandler,
} from '../api/internal/developer-access.js';
import defaultLoginHandler, {
  createPrivateRuntimeLoginHandler,
} from '../api/internal/private-runtime-login.js';
import defaultCallbackHandler, {
  createPrivateRuntimeCallbackHandler,
} from '../api/internal/private-runtime-callback.js';
import defaultSessionHandler, {
  createPrivateRuntimeSessionHandler,
} from '../api/internal/private-runtime-session.js';
import defaultBootstrapHandler, {
  createPrivateRuntimeBootstrapHandler,
} from '../api/internal/private-runtime-bootstrap.js';
import defaultLogoutHandler, {
  createPrivateRuntimeLogoutHandler,
} from '../api/internal/private-runtime-logout.js';
import { resolveSubscriptionEntitlement } from '../api/internal/subscription-entitlement.js';
import {
  createPrivateRuntimeLiveCompositionV2,
  getPrivateRuntimeLiveCompositionV2,
  settlePrivateRuntimeLiveOperation,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/index.js';

function response() {
  return {
    headers: {},
    statusCode: null,
    payload: null,
    sendCount: 0,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.payload = value;
      this.sendCount += 1;
      return this;
    },
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const validLoginRequest = {
  method: 'POST',
  headers: {},
  body: {
    browser_binding_reference: 'opaque_browser_reference',
    correlation_id: 'opaque_correlation_reference',
  },
};

test('default composition exposes seven Promise operations and remains frozen UNCONFIGURED', async () => {
  const composition = getPrivateRuntimeLiveCompositionV2();
  assert.equal(Object.isFrozen(composition), true);
  assert.equal(composition.configured, false);
  assert.equal(composition.source_default_off, true);
  assert.equal(composition.provider_adapter, false);
  assert.equal(composition.v1_fallback, false);
  for (const name of [
    'beginLogin',
    'completeLogin',
    'inspectSession',
    'developerAccess',
    'resolveSubscriptionEntitlement',
    'bootstrap',
    'logout',
  ]) {
    const returned = composition.operations[name]();
    assert.equal(returned instanceof Promise, true, name);
    assert.equal((await returned).code, 'ASYNC_SECURITY_UNCONFIGURED');
  }
});

test('all six default HTTP exports are structurally bound and deny unconfigured', async () => {
  const handlers = [
    [defaultDeveloperAccessHandler, { method: 'GET', headers: {} }],
    [defaultLoginHandler, validLoginRequest],
    [defaultCallbackHandler, { method: 'POST', headers: {}, body: {} }],
    [defaultSessionHandler, { method: 'GET', headers: {} }],
    [defaultBootstrapHandler, { method: 'POST', headers: {} }],
    [defaultLogoutHandler, { method: 'POST', headers: {} }],
  ];
  for (const [handler, req] of handlers) {
    const res = response();
    await handler(req, res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.sendCount, 1);
  }
});

test('login, callback, session, bootstrap, and logout wait for security settlement', async () => {
  const cases = [
    [
      createPrivateRuntimeLoginHandler({
        enabled: () => true,
        beginLogin: () => gate.promise,
      }),
      validLoginRequest,
      {
        ok: true,
        pre_auth_session_ref: 'pre_auth_alpha',
        pre_auth_cookie_value: 'pre_auth_cookie_material',
        expires_at: '2026-07-27T22:00:00.000Z',
      },
    ],
    [
      createPrivateRuntimeCallbackHandler({
        enabled: () => true,
        completeLogin: () => gate.promise,
      }),
      { method: 'POST', headers: {}, body: {} },
      {
        ok: true,
        session_cookie_value: 'session_cookie_material',
        session_receipt: 'session_receipt_alpha',
      },
    ],
    [
      createPrivateRuntimeSessionHandler({
        enabled: () => true,
        inspectSession: () => gate.promise,
      }),
      { method: 'GET', headers: {} },
      {
        ok: true,
        entitlement_active: true,
        runtime_ready: false,
        session_receipt: 'session_receipt_alpha',
      },
    ],
    [
      createPrivateRuntimeBootstrapHandler({
        enabled: () => true,
        bootstrap: () => gate.promise,
      }),
      { method: 'POST', headers: {} },
      {
        ok: true,
        runtime_ready: true,
        attachment_set: 'attachment_set_alpha',
        business_engine_attachment: 'business_engine_attachment_alpha',
        subscription_runtime_attachment: 'subscription_attachment_alpha',
        coach_connect_attachment: 'coach_attachment_alpha',
      },
    ],
    [
      createPrivateRuntimeLogoutHandler({
        enabled: () => true,
        logout: () => gate.promise,
      }),
      { method: 'POST', headers: {} },
      {
        ok: true,
        server_revocation_confirmed: true,
        runtime_handles_detached: true,
      },
    ],
  ];
  for (const [handler, req, decision] of cases) {
    var gate = deferred();
    const res = response();
    const pending = handler(req, res);
    await Promise.resolve();
    assert.equal(res.sendCount, 0);
    gate.resolve(decision);
    await pending;
    assert.equal(res.sendCount, 1);
  }
});

test('default developer-access V2 path awaits composition and never emits cookie material in JSON', async () => {
  const gate = deferred();
  const composition = {
    operations: {
      async developerAccess() {
        return gate.promise;
      },
    },
  };
  const handler = createDeveloperAccessHandler({ liveCompositionV2: composition });
  const res = response();
  const pending = handler({
    method: 'POST',
    headers: {},
    body: { access_code: 'opaque_request_value' },
  }, res);
  await Promise.resolve();
  assert.equal(res.sendCount, 0);
  gate.resolve({
    ok: true,
    allowed: true,
    entitlement_cookie_value: 'opaque_entitlement_cookie_material',
    entitlement: { expires_at: '2026-07-27T22:00:00.000Z' },
  });
  await pending;
  assert.equal(res.statusCode, 200);
  assert.equal(res.sendCount, 1);
  assert.equal(JSON.stringify(res.payload).includes('opaque_entitlement_cookie_material'), false);
  assert.equal(String(res.headers['Set-Cookie']).includes('opaque_entitlement_cookie_material'), true);
});

test('private subscription entitlement waits for the V2 composition and cannot use a paid fallback', async () => {
  const gate = deferred();
  const returned = resolveSubscriptionEntitlement({
    req: { method: 'GET', headers: {} },
    liveCompositionV2: {
      operations: {
        async resolveSubscriptionEntitlement() {
          return gate.promise;
        },
      },
    },
    paidAccessGrant: {
      access_type: 'more_monthly_intelligence',
      status: 'active',
    },
  });
  assert.equal(returned instanceof Promise, true);
  gate.resolve({
    ok: true,
    allowed: true,
    entitlement: {
      temporary: true,
      paid_entitlement: false,
      expires_at: '2026-07-27T22:00:00.000Z',
    },
    authority: { allowed: true },
  });
  const result = await returned;
  assert.equal(result.allowed, true);
  assert.equal(result.entitlement.source, 'temporary_internal_subscription_entitlement');
  assert.equal(result.entitlement.billing_evidence, false);
});

test('synchronous, rejected, and malformed operation decisions fail closed', async () => {
  const decisions = [
    () => ({ ok: true, allowed: true }),
    async () => { throw new Error('synthetic rejection'); },
    async () => ({ allowed: true }),
  ];
  for (const operation of decisions) {
    const result = await settlePrivateRuntimeLiveOperation(operation);
    assert.equal(result.ok, false);
    assert.ok([
      'ASYNC_SECURITY_CONTRACT_VIOLATION',
      'ASYNC_SECURITY_REJECTED',
      'ASYNC_SECURITY_RESULT_INVALID',
    ].includes(result.code));
  }
});

function canonicalService({ authorityState = { allowed: true } } = {}) {
  const authority = () => authorityState.allowed
    ? {
      ok: true,
      allowed: true,
      code: null,
      authority_fingerprint: 'a'.repeat(64),
    }
    : { ok: false, allowed: false, code: 'RUNTIME_AUTHORITY_DENIED', status: 403 };
  return {
    async describe() {
      return {
        ok: true,
        service_version: 'private-runtime-canonical-security-service-v2',
        capability: { live_connection_verified: false },
      };
    },
    async health() { return { ok: true, allowed: true }; },
    async beginPreAuth() { return { ok: false, allowed: false, code: 'AUTHENTICATION_REQUIRED' }; },
    async completeAuthentication() { return { ok: false, allowed: false, code: 'AUTHENTICATION_REQUIRED' }; },
    async resolveAuthenticatedContext() { return { ok: true, allowed: true, authenticated_context: {} }; },
    async evaluatePrivateTestEligibility() { return { ok: true, allowed: true }; },
    async issueCsrfGrant() { return { ok: true, allowed: true, csrf_proof: 'csrf_proof_alpha' }; },
    async issueTemporaryEntitlement() { return { ok: true, allowed: true }; },
    async inspectTemporaryEntitlement() { return { ok: true, allowed: true, entitlement: {} }; },
    async evaluatePrivateRuntimeAuthority() { return authority(); },
    async revokeTemporaryEntitlement() { return { ok: true, allowed: false }; },
    async logout() {
      authorityState.allowed = false;
      return {
        ok: true,
        allowed: false,
        server_revocation_confirmed: true,
        client_session_cookie_clear: true,
        client_entitlement_cookie_clear: true,
      };
    },
    async inspectRecovery() { return { ok: false, allowed: false }; },
  };
}

function compositionHarness({
  bridgeDecision = null,
  authorityState = { allowed: true },
} = {}) {
  let bridgeCalls = 0;
  const bridgeGate = bridgeDecision || Promise.resolve({
    ok: true,
    allowed: true,
    runtime_ready: true,
    attachment_set: 'attachment_set_alpha',
    business_engine_attachment: 'business_engine_attachment_alpha',
    subscription_runtime_attachment: 'subscription_attachment_alpha',
    coach_connect_attachment: 'coach_attachment_alpha',
  });
  const composition = createPrivateRuntimeLiveCompositionV2({
    canonicalSecurityService: canonicalService({ authorityState }),
    activationDecision: async () => ({ ok: true, allowed: true }),
    resolveRequestContext: async () => ({ ok: true, value: { correlation_ref: 'correlation_alpha' } }),
    resolveBridgeInput: async () => ({ ok: true, value: { request: {} } }),
    privateRuntimeBridge: {
      async attach() {
        bridgeCalls += 1;
        return bridgeGate;
      },
    },
  });
  return { composition, authorityState, bridgeCalls: () => bridgeCalls };
}

test('concurrent bootstrap calls the existing bridge once and publishes one attachment result', async () => {
  const gate = deferred();
  const harness = compositionHarness({ bridgeDecision: gate.promise });
  const operation = harness.composition.operations.bootstrap;
  const first = operation({ method: 'POST' });
  const second = operation({ method: 'POST' });
  await Promise.resolve();
  await Promise.resolve();
  gate.resolve({
    ok: true,
    allowed: true,
    runtime_ready: true,
    attachment_set: 'attachment_set_alpha',
    business_engine_attachment: 'business_engine_attachment_alpha',
    subscription_runtime_attachment: 'subscription_attachment_alpha',
    coach_connect_attachment: 'coach_attachment_alpha',
  });
  const [one, two] = await Promise.all([first, second]);
  assert.equal(harness.bridgeCalls(), 1);
  assert.equal(one.attachment_set, two.attachment_set);
});

test('partial bridge attachment is discarded and never projected by bootstrap handler', async () => {
  const harness = compositionHarness({
    bridgeDecision: Promise.resolve({
      ok: false,
      allowed: false,
      code: 'PRIVATE_RUNTIME_PARTIAL_ATTACHMENT',
      partial_handles_discarded: true,
      status: 403,
    }),
  });
  const handler = createPrivateRuntimeBootstrapHandler({
    enabled: () => true,
    bootstrap: harness.composition.operations.bootstrap,
  });
  const res = response();
  await handler({ method: 'POST', headers: {} }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.ok, false);
  assert.equal(harness.bridgeCalls(), 1);
});

test('logout racing pending bootstrap prevents attachment publication after settlement', async () => {
  const gate = deferred();
  const harness = compositionHarness({ bridgeDecision: gate.promise });
  const bootstrap = harness.composition.operations.bootstrap({ method: 'POST' });
  await Promise.resolve();
  await harness.composition.operations.logout({ method: 'POST' });
  gate.resolve({
    ok: true,
    allowed: true,
    runtime_ready: true,
    attachment_set: 'attachment_set_alpha',
  });
  const result = await bootstrap;
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'RUNTIME_AUTHORITY_DENIED');
});

test('missing assertion port denies callback without a fallback identity path', async () => {
  const harness = compositionHarness();
  const decision = await harness.composition.operations.completeLogin({ method: 'POST' });
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, 'SUBJECT_ASSERTION_REQUIRED');
});

test('handler source imports one composition accessor and no adapter or V1 store on default path', async () => {
  const handlerPaths = [
    '../api/internal/private-runtime-login.js',
    '../api/internal/private-runtime-callback.js',
    '../api/internal/private-runtime-session.js',
    '../api/internal/private-runtime-bootstrap.js',
    '../api/internal/private-runtime-logout.js',
  ];
  for (const relativePath of handlerPaths) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
    assert.equal(source.includes('getPrivateRuntimeLiveCompositionV2'), true);
    assert.equal(source.includes('SyntheticAsyncSecurityStateAdapter'), false);
    assert.equal(source.includes('AsyncSecurityStatePort'), false);
    assert.equal(source.includes('InMemorySecurityStateStore'), false);
  }
  const developerSource = await readFile(
    new URL('../api/internal/developer-access.js', import.meta.url),
    'utf8',
  );
  const defaultExport = developerSource.slice(developerSource.lastIndexOf('export default'));
  assert.equal(defaultExport.includes('getDefaultDeveloperSecurityStore'), false);
});
