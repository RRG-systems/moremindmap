import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPrivateRuntimeLiveCompositionV2,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveComposition.js';

function service({
  healthAllowed = true,
  authenticatedAllowed = true,
  authorityAllowed = true,
} = {}) {
  return {
    async describe() {
      return {
        ok: true,
        allowed: false,
        capability: {
          deployment_grade: true,
          live_connection_verified: healthAllowed,
          no_local_fallback: true,
        },
      };
    },
    async health() {
      return healthAllowed
        ? { ok: true, allowed: true }
        : { ok: false, allowed: false, code: 'PROVIDER_UNAVAILABLE' };
    },
    async beginPreAuth() { return { ok: false, allowed: false }; },
    async completeAuthentication() { return { ok: false, allowed: false }; },
    async resolveAuthenticatedContext() {
      return authenticatedAllowed
        ? {
          ok: true,
          allowed: true,
          canonical_subject: { receipt_ref: 'subject_receipt_failure' },
          authenticated_context: {},
        }
        : { ok: false, allowed: false, code: 'SESSION_REVOKED' };
    },
    async evaluatePrivateTestEligibility() { return { ok: true, allowed: false }; },
    async issueCsrfGrant() { return { ok: true, allowed: false }; },
    async issueTemporaryEntitlement() { return { ok: false, allowed: false }; },
    async inspectTemporaryEntitlement() {
      return { ok: false, allowed: false, code: 'ENTITLEMENT_REVOKED' };
    },
    async evaluatePrivateRuntimeAuthority() {
      return authorityAllowed
        ? { ok: true, allowed: true, authority_fingerprint: 'a'.repeat(64) }
        : { ok: false, allowed: false, code: 'RUNTIME_AUTHORITY_DENIED' };
    },
    async revokeTemporaryEntitlement() { return { ok: true, allowed: false }; },
    async logout() {
      return healthAllowed
        ? { ok: true, allowed: false, server_revocation_confirmed: true }
        : {
          ok: false,
          allowed: false,
          code: 'PROVIDER_UNAVAILABLE',
          server_revocation_confirmed: false,
        };
    },
    async inspectRecovery() {
      return healthAllowed
        ? { ok: true, allowed: true }
        : { ok: false, allowed: false, code: 'RECOVERY_NOT_PROVEN' };
    },
  };
}

function composition(options = {}) {
  return createPrivateRuntimeLiveCompositionV2({
    canonicalSecurityService: service(options),
    activationDecision: async () => options.emergency
      ? { ok: false, allowed: false, code: 'EMERGENCY_DISABLED', status: 503 }
      : options.activation === false
        ? { ok: false, allowed: false, code: 'RUNTIME_DEFAULT_OFF', status: 404 }
        : { ok: true, allowed: true },
    resolveRequestContext: async () => ({
      ok: true,
      allowed: false,
      value: { correlation_ref: 'correlation_failure' },
    }),
  });
}

test('source default-off and emergency disable deny before security or product work', async () => {
  assert.equal((await composition({ activation: false }).operations.inspectSession({}))
    .code, 'RUNTIME_DEFAULT_OFF');
  assert.equal((await composition({ emergency: true }).operations.inspectSession({}))
    .code, 'EMERGENCY_DISABLED');
});

test('provider outage and recovery uncertainty fail closed without fallback', async () => {
  const denied = composition({ healthAllowed: false });
  const result = await denied.operations.inspectSession({});
  assert.equal(result.ok, true);
  assert.equal(result.authenticated, true);
  const described = await denied.describe();
  assert.equal(described.provider_connection, false);
  assert.equal(described.v1_fallback, false);
});

test('revoked session and entitlement cannot continue private runtime access', async () => {
  const session = await composition({ authenticatedAllowed: false })
    .operations.inspectSession({});
  assert.equal(session.allowed, false);
  assert.equal(session.code, 'SESSION_REVOKED');
  const subscription = await composition({ authorityAllowed: false })
    .operations.resolveSubscriptionEntitlement({});
  assert.equal(subscription.allowed, false);
  assert.equal(subscription.code, 'RUNTIME_AUTHORITY_DENIED');
});

test('logout never claims remote revocation during provider uncertainty', async () => {
  const result = await composition({ healthAllowed: false }).operations.logout({});
  assert.equal(result.ok, false);
  assert.equal(result.server_revocation_confirmed, false);
  assert.equal(result.code, 'PROVIDER_UNAVAILABLE');
});

test('partial or missing attachment bridge cannot publish runtime readiness', async () => {
  const result = await composition().operations.bootstrap({});
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'ASYNC_SECURITY_UNCONFIGURED');
});
