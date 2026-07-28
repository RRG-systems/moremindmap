import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPrivateRuntimeLiveCompositionRootV2,
  createDeferredPrivateRuntimeLiveCompositionV2,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/index.js';
import {
  createPrivateRuntimeLiveCompositionV2,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveComposition.js';

function canonicalService(log = [], observations = {}) {
  return {
    async describe() {
      log.push('describe');
      return {
        ok: true,
        allowed: false,
        capability: {
          live_connection_verified: true,
          deployment_grade: true,
          no_local_fallback: true,
        },
      };
    },
    async health() { log.push('health'); return { ok: true, allowed: true }; },
    async beginPreAuth() {
      log.push('begin_pre_auth');
      return {
        ok: true,
        allowed: true,
        pre_auth_session_ref: 'pre_auth_composition',
        pre_auth_cookie_value: 'pre_auth_cookie_composition',
        expires_at: '2026-08-28T10:00:00.000Z',
      };
    },
    async completeAuthentication(input) {
      log.push('complete_authentication');
      observations.complete_authentication_input = input;
      return {
        ok: true,
        allowed: true,
        session_cookie_value: 'raw_session_value',
        expires_at: '2026-08-28T10:00:00.000Z',
        canonical_subject: {
          external_subject_ref: 'external_subject_composition',
          exact_scope_hash: 'a'.repeat(64),
        },
      };
    },
    async resolveAuthenticatedContext() {
      log.push('resolve_authenticated_context');
      return {
        ok: true,
        allowed: true,
        canonical_subject: { receipt_ref: 'subject_receipt_composition' },
        authenticated_context: {},
      };
    },
    async evaluatePrivateTestEligibility() { return { ok: true, allowed: true }; },
    async issueCsrfGrant() { return { ok: true, allowed: true }; },
    async issueTemporaryEntitlement() { return { ok: true, allowed: true }; },
    async inspectTemporaryEntitlement() {
      return { ok: false, allowed: false, code: 'ENTITLEMENT_REQUIRED' };
    },
    async evaluatePrivateRuntimeAuthority() {
      return { ok: false, allowed: false, code: 'RUNTIME_AUTHORITY_DENIED' };
    },
    async revokeTemporaryEntitlement() { return { ok: true, allowed: false }; },
    async logout() { return { ok: true, allowed: false, server_revocation_confirmed: true }; },
    async inspectRecovery() { return { ok: false, allowed: false }; },
  };
}

test('missing live configuration returns explicit async UNCONFIGURED without provider call', async () => {
  let providerCalls = 0;
  const composition = await buildPrivateRuntimeLiveCompositionRootV2({
    createLiveComposition: createPrivateRuntimeLiveCompositionV2,
    env: {},
    fetchImpl: async () => {
      providerCalls += 1;
      throw new Error('must not run');
    },
  });
  assert.equal(composition.configured, false);
  assert.equal((await composition.operations.beginLogin()).code, 'ASYNC_SECURITY_UNCONFIGURED');
  assert.equal(providerCalls, 0);
});

test('deferred root resolves one shared composition and every operation stays Promise-native', async () => {
  let builds = 0;
  const target = {
    operations: Object.freeze(Object.fromEntries([
      'beginLogin',
      'completeLogin',
      'inspectSession',
      'developerAccess',
      'resolveSubscriptionEntitlement',
      'bootstrap',
      'logout',
    ].map((name) => [name, async () => ({ ok: false, allowed: false, code: name })]))),
    enabled: async () => false,
    describe: async () => ({ ok: true, allowed: false }),
  };
  const deferred = createDeferredPrivateRuntimeLiveCompositionV2({
    build: async () => { builds += 1; return target; },
  });
  const results = await Promise.all(Object.values(deferred.operations)
    .map((operation) => operation()));
  assert.equal(builds, 1);
  assert.equal(results.length, 7);
  assert.equal(results.every((entry) => entry.ok === false), true);
  assert.equal(deferred.v1_fallback, false);
  assert.equal(deferred.provider_adapter, false);
});

test('login orders edge activation, pre-auth, then assertion initiation', async () => {
  const log = [];
  const composition = createPrivateRuntimeLiveCompositionV2({
    canonicalSecurityService: canonicalService(log),
    activationDecision: async () => {
      log.push('activation');
      return { ok: true, allowed: true };
    },
    resolveRequestContext: async () => {
      log.push('request_context');
      return {
        ok: true,
        allowed: false,
        value: {
          browser_binding_hash: 'b'.repeat(64),
          browser_binding_reference: 'browser_binding_composition',
          correlation_ref: 'correlation_composition',
          edge_attestation: {
            named_identity_verified: true,
            mfa_verified: true,
            public_access: false,
          },
        },
      };
    },
    assertionPort: {
      async beginAuthorization() {
        log.push('assertion_begin');
        return {
          ok: true,
          allowed: false,
          authorization_url: 'https://identity.private.example/authorize',
          transaction_cookie_value: 'transaction_cookie_composition',
        };
      },
    },
  });
  const result = await composition.operations.beginLogin({
    browser_binding_reference: 'browser_binding_composition',
  });
  assert.equal(result.ok, true);
  assert.deepEqual(log, [
    'activation',
    'request_context',
    'begin_pre_auth',
    'assertion_begin',
  ]);
  assert.equal(result.authority_granted, false);
});

test('callback waits for verification and service settlement before sealing session', async () => {
  const log = [];
  const composition = createPrivateRuntimeLiveCompositionV2({
    canonicalSecurityService: canonicalService(log),
    activationDecision: async () => ({ ok: true, allowed: true }),
    resolveRequestContext: async () => ({
      ok: true,
      allowed: false,
      value: {
        browser_binding_reference: 'browser_binding_composition',
        assertion_input: {},
      },
    }),
    assertionPort: {
      async verify() {
        log.push('assertion_verify');
        return {
          ok: true,
          allowed: false,
          verified_assertion: {
            verification_status: 'VERIFIED',
          },
        };
      },
    },
    serializeAuthenticatedSession: async () => {
      log.push('serialize_session');
      return { ok: true, allowed: false, value: 'sealed_session_composition' };
    },
  });
  const result = await composition.operations.completeLogin({ method: 'GET' });
  assert.equal(result.ok, true);
  assert.equal(result.session_cookie_value, 'sealed_session_composition');
  assert.deepEqual(log, [
    'assertion_verify',
    'complete_authentication',
    'serialize_session',
  ]);
});

test('callback passes sealed rotation references into authenticated elevation', async () => {
  const observations = {};
  const composition = createPrivateRuntimeLiveCompositionV2({
    canonicalSecurityService: canonicalService([], observations),
    activationDecision: async () => ({ ok: true, allowed: true }),
    resolveRequestContext: async () => ({
      ok: true,
      allowed: false,
      value: {
        browser_binding_reference: 'browser_binding_composition',
        assertion_input: {},
      },
    }),
    assertionPort: {
      async verify() {
        return {
          ok: true,
          allowed: false,
          verified_assertion: { verification_status: 'VERIFIED' },
          rotation_parent_session_token_hash: 'd'.repeat(64),
          rotation_parent_reference: 'authenticated_session_parent',
        };
      },
    },
    serializeAuthenticatedSession: async () => ({
      ok: true,
      allowed: false,
      value: 'sealed_session_composition',
    }),
  });
  const result = await composition.operations.completeLogin({ method: 'GET' });
  assert.equal(result.ok, true);
  assert.equal(
    observations.complete_authentication_input.rotation_parent_session_token_hash,
    'd'.repeat(64),
  );
  assert.equal(
    observations.complete_authentication_input.rotation_parent_reference,
    'authenticated_session_parent',
  );
});

test('synchronous assertion and serializer implementations fail closed', async () => {
  const composition = createPrivateRuntimeLiveCompositionV2({
    canonicalSecurityService: canonicalService(),
    activationDecision: async () => ({ ok: true, allowed: true }),
    resolveRequestContext: async () => ({
      ok: true,
      allowed: false,
      value: { assertion_input: {} },
    }),
    assertionPort: {
      verify: () => ({
        ok: true,
        verified_assertion: { verification_status: 'VERIFIED' },
      }),
    },
    serializeAuthenticatedSession: () => ({
      ok: true,
      value: 'not_promise',
    }),
  });
  const result = await composition.operations.completeLogin({ method: 'GET' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ASYNC_SECURITY_CONTRACT_VIOLATION');
});
