import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createDeveloperAccessSecurityFacadeV2,
  validateCanonicalAsyncSecurityServiceShape,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/developerAccessSecurityFacade.js';
import { InMemorySecurityStateStore } from '../src/lib/intelligenceFabric/coachConnect/security/inMemorySecurityStateStore.js';

const authenticatedContext = {
  subscriber_subject_ref: 'canonical_subject_synthetic_facade',
  authenticated_session_ref: 'authenticated_session_synthetic_facade',
  exact_scope_hash: 'a'.repeat(64),
};

function service(overrides = {}) {
  const calls = [];
  const value = {
    calls,
    async describe() {
      calls.push('describe');
      return {
        ok: true,
        service_version: 'private-runtime-canonical-security-service-v2',
      };
    },
    async health() { calls.push('health'); return { ok: true, allowed: true }; },
    async beginPreAuth() { calls.push('beginPreAuth'); return { ok: true, allowed: true }; },
    async completeAuthentication() { calls.push('completeAuthentication'); return { ok: true, allowed: true }; },
    async resolveAuthenticatedContext() {
      calls.push('resolveAuthenticatedContext');
      return { ok: true, allowed: true, authenticated_context: authenticatedContext };
    },
    async evaluatePrivateTestEligibility() {
      calls.push('evaluatePrivateTestEligibility');
      return {
        ok: true,
        allowed: true,
        decision_version: 'private-test-bootstrap-eligibility-v1',
        runtime_access: false,
      };
    },
    async issueCsrfGrant() {
      calls.push('issueCsrfGrant');
      return { ok: true, allowed: true, csrf_proof: 'opaque_csrf_proof' };
    },
    async issueTemporaryEntitlement(input) {
      calls.push(['issueTemporaryEntitlement', input.submitted_code]);
      return {
        ok: true,
        allowed: true,
        entitlement_ref: 'entitlement_synthetic_facade',
        entitlement_cookie: 'opaque_internal_cookie_projection',
      };
    },
    async inspectTemporaryEntitlement() {
      calls.push('inspectTemporaryEntitlement');
      return {
        ok: true,
        allowed: true,
        entitlement: {
          entitlement_ref: 'entitlement_synthetic_facade',
          temporary: true,
          paid_entitlement: false,
        },
      };
    },
    async evaluatePrivateRuntimeAuthority() {
      calls.push('evaluatePrivateRuntimeAuthority');
      return { ok: true, allowed: true };
    },
    async revokeTemporaryEntitlement() {
      calls.push('revokeTemporaryEntitlement');
      return { ok: true, allowed: false, revoked: true };
    },
    async logout() { calls.push('logout'); return { ok: true }; },
    async inspectRecovery() { calls.push('inspectRecovery'); return { ok: true, allowed: true }; },
  };
  return Object.assign(value, overrides);
}

test('facade exposes one Promise-native canonical service path and no independent state', async () => {
  const canonical = service();
  const facade = createDeveloperAccessSecurityFacadeV2({ canonicalSecurityService: canonical });
  for (const [method, args] of [
    ['describe', []],
    ['resolveAuthenticatedContext', [{}]],
    ['evaluateBootstrapEligibility', [{}]],
    ['issueCsrf', [{}, { method: 'POST', route: 'developer_access' }]],
    ['issueEntitlement', [{}, 'opaque-submitted-value']],
    ['inspectEntitlement', [{}]],
    ['revokeEntitlement', [{}]],
  ]) {
    const returned = facade[method](...args);
    assert.equal(returned instanceof Promise, true, method);
    await returned;
  }
  const description = await facade.describe();
  assert.equal(description.canonical_security_path, true);
  assert.equal(description.independent_state, false);
});

test('GET, POST, and DELETE projections delegate through the canonical service only', async () => {
  const canonical = service();
  const facade = createDeveloperAccessSecurityFacadeV2({ canonicalSecurityService: canonical });
  const csrf = await facade.issueCsrf({}, { method: 'POST', route: 'developer_access' });
  const issued = await facade.issueEntitlement({}, 'opaque-submitted-value');
  const inspected = await facade.inspectEntitlement({});
  const revoked = await facade.revokeEntitlement({});
  assert.equal(csrf.allowed, true);
  assert.equal(issued.allowed, true);
  assert.equal(inspected.allowed, true);
  assert.equal(revoked.revoked, true);
  assert.deepEqual(canonical.calls.filter((entry) => typeof entry === 'string'), [
    'resolveAuthenticatedContext',
    'issueCsrfGrant',
    'resolveAuthenticatedContext',
    'evaluatePrivateTestEligibility',
    'resolveAuthenticatedContext',
    'inspectTemporaryEntitlement',
    'resolveAuthenticatedContext',
    'revokeTemporaryEntitlement',
  ]);
  assert.deepEqual(canonical.calls.find(Array.isArray), [
    'issueTemporaryEntitlement',
    'opaque-submitted-value',
  ]);
});

test('authentication and eligibility denial prevent entitlement issuance', async () => {
  const unauthenticated = service({
    async resolveAuthenticatedContext() {
      this.calls.push('resolveAuthenticatedContext');
      return { ok: false, allowed: false, code: 'AUTHENTICATION_REQUIRED' };
    },
  });
  const noAuth = createDeveloperAccessSecurityFacadeV2({ canonicalSecurityService: unauthenticated });
  assert.equal((await noAuth.issueEntitlement({}, 'opaque-submitted-value')).code, 'AUTHENTICATION_REQUIRED');
  assert.equal(unauthenticated.calls.some(Array.isArray), false);

  const ineligible = service({
    async evaluatePrivateTestEligibility() {
      this.calls.push('evaluatePrivateTestEligibility');
      return { ok: false, allowed: false, code: 'PRIVATE_TEST_BOOTSTRAP_INELIGIBLE' };
    },
  });
  const noEligibility = createDeveloperAccessSecurityFacadeV2({ canonicalSecurityService: ineligible });
  assert.equal((await noEligibility.issueEntitlement({}, 'opaque-submitted-value')).code, 'PRIVATE_TEST_BOOTSTRAP_INELIGIBLE');
  assert.equal(ineligible.calls.some(Array.isArray), false);
});

test('synchronous, malformed, rejected, and delayed service decisions fail closed', async () => {
  const synchronous = service({
    resolveAuthenticatedContext() {
      return { ok: true, allowed: true, authenticated_context: authenticatedContext };
    },
  });
  assert.equal(
    (await createDeveloperAccessSecurityFacadeV2({
      canonicalSecurityService: synchronous,
    }).resolveAuthenticatedContext({})).code,
    'ASYNC_SECURITY_CONTRACT_VIOLATION',
  );

  const malformed = service({
    async resolveAuthenticatedContext() { return null; },
  });
  assert.equal(
    (await createDeveloperAccessSecurityFacadeV2({
      canonicalSecurityService: malformed,
    }).resolveAuthenticatedContext({})).code,
    'ASYNC_SECURITY_RESULT_INVALID',
  );

  const rejected = service({
    async resolveAuthenticatedContext() { throw new Error('synthetic rejection'); },
  });
  assert.equal(
    (await createDeveloperAccessSecurityFacadeV2({
      canonicalSecurityService: rejected,
    }).resolveAuthenticatedContext({})).code,
    'ASYNC_SECURITY_REJECTED',
  );

  let settle;
  const delayed = service({
    resolveAuthenticatedContext() {
      this.calls.push('resolveAuthenticatedContext');
      return new Promise((resolve) => { settle = resolve; });
    },
  });
  const facade = createDeveloperAccessSecurityFacadeV2({ canonicalSecurityService: delayed });
  let completed = false;
  const pending = facade.resolveAuthenticatedContext({}).then((result) => {
    completed = true;
    return result;
  });
  await Promise.resolve();
  assert.equal(completed, false);
  settle({ ok: true, allowed: true, authenticated_context: authenticatedContext });
  assert.equal((await pending).allowed, true);
});

test('V1 store cannot satisfy facade dependency and source imports no store or provider', () => {
  assert.equal(validateCanonicalAsyncSecurityServiceShape(new InMemorySecurityStateStore()).valid, false);
  assert.throws(
    () => createDeveloperAccessSecurityFacadeV2({
      canonicalSecurityService: new InMemorySecurityStateStore(),
    }),
    /canonical async security service is invalid/,
  );
  const source = readFileSync(
    new URL('../src/lib/intelligenceFabric/coachConnect/privateRuntime/developerAccessSecurityFacade.js', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /InMemorySecurityStateStore|InMemorySharedSecurityState|@upstash|ioredis|fetch\(/);
});

test('concurrent facade calls cannot create a second facade-owned capability', async () => {
  const canonical = service();
  const facade = createDeveloperAccessSecurityFacadeV2({ canonicalSecurityService: canonical });
  const results = await Promise.all([
    facade.issueEntitlement({}, 'opaque-submitted-value'),
    facade.issueEntitlement({}, 'opaque-submitted-value'),
  ]);
  assert.equal(results.every((result) => result.entitlement_ref === 'entitlement_synthetic_facade'), true);
  assert.equal('snapshot' in facade, false);
  assert.equal('store' in facade, false);
});
