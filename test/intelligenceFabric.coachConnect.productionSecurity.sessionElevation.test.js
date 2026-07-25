import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CanonicalSubscriberSubjectRegistry,
  createPreAuthSession,
  createRatifiedSubscriberAuthorityPolicy,
  InMemorySharedSecurityState,
  registerPreAuthSession,
  revokeAuthenticatedSubscriberSession,
  elevateSubscriberSession,
  verifySubscriberAuthenticationAssertion,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js';

const at = Date.parse('2026-07-24T13:00:00.000Z');
let clock = at;
const store = () => new InMemorySharedSecurityState({ clock: () => clock });
const authority = createRatifiedSubscriberAuthorityPolicy({
  issuer: 'https://more-synthetic.auth0.com/',
  audience: 'https://more.synthetic/subscriber',
}).policy;
const scope = {
  tenant_id: 'tenant-session',
  profile_id: 'profile-session',
  business_id: 'business-session',
  subscriber_id: 'subscriber-session',
};

async function context() {
  const assertion = (await verifySubscriberAuthenticationAssertion({
    assertion_reference: 'assertion-session-001',
    expected_session_binding_reference: 'browser-binding-session',
    authority_policy: authority,
    verifier: async () => ({
      subject_id: 'auth0|subscriber-session',
      issuer: authority.issuer,
      audience: authority.audience,
      authenticated_at: new Date(at).toISOString(),
      auth_strength: 'PASSWORD_MFA',
      security_version: 1,
      session_binding_reference: 'browser-binding-session',
      status: 'VERIFIED',
    }),
  })).assertion;
  const subject = new CanonicalSubscriberSubjectRegistry()
    .bind({ assertion, scope, now: new Date(at).toISOString() }).subject;
  return { assertion, subject };
}

test('pre-auth session grants no authority and rotates atomically to a different session', async () => {
  clock = at;
  const securityState = store();
  const preAuth = createPreAuthSession({
    pre_auth_session_id: 'pre-auth-session-001',
    browser_binding_hash: 'browser-binding-session',
    csrf_generation: 4,
    issued_at: new Date(at).toISOString(),
    expires_at: new Date(at + 300_000).toISOString(),
  }).session;
  assert.equal(preAuth.grants_authenticated_authority, false);
  assert.equal(registerPreAuthSession({ store: securityState, session: preAuth }).ok, true);
  securityState.putCapabilityHash({
    token_hash: 'capability-hash-001',
    capability_ref: 'capability-ref-001',
    status: 'ACTIVE',
  });
  const { assertion, subject } = await context();
  const result = elevateSubscriberSession({
    store: securityState,
    pre_auth_session_id: preAuth.pre_auth_session_id,
    assertion,
    subject,
    expected_csrf_generation: 4,
    authenticated_session_id: 'authenticated-session-001',
    authenticated_session_token: 'opaque-authenticated-session-token-000001',
    expires_at: new Date(at + 3_600_000).toISOString(),
    occurred_at: new Date(at).toISOString(),
    correlation_id: 'correlation-session-001',
    invalidated_capability_hashes: ['capability-hash-001'],
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'AUTHENTICATED_ACTIVE');
  assert.notEqual(result.authenticated_session.authenticated_session_id, preAuth.pre_auth_session_id);
  assert.equal(result.cookie.name, '__Host-more_session');
  assert.equal(result.cookie.http_only, true);
  assert.equal(result.cookie.secure, true);
  assert.equal(result.cookie.raw_token_stored_server_side, false);
  assert.equal(securityState.getSession(preAuth.pre_auth_session_id).session.status, 'ROTATED');
  assert.equal(securityState.getSession('authenticated-session-001').session.status, 'ACTIVE');
  assert.equal(securityState.getCapabilityByHash('capability-hash-001').record.status, 'ROTATED');
  assert.equal(securityState.auditSnapshot().length, 1);
  assert.doesNotMatch(JSON.stringify(securityState.snapshot()), /opaque-authenticated-session-token-000001/);
});

test('replay, stale CSRF, fixation, and state outage fail closed without new authority', async () => {
  clock = at;
  const { assertion, subject } = await context();

  const staleStore = store();
  const stale = createPreAuthSession({
    pre_auth_session_id: 'pre-auth-stale',
    browser_binding_hash: 'browser-binding-session',
    csrf_generation: 2,
    issued_at: new Date(at).toISOString(),
    expires_at: new Date(at + 300_000).toISOString(),
  }).session;
  registerPreAuthSession({ store: staleStore, session: stale });
  assert.equal(elevateSubscriberSession({
    store: staleStore,
    pre_auth_session_id: stale.pre_auth_session_id,
    assertion,
    subject,
    expected_csrf_generation: 1,
    authenticated_session_id: 'auth-stale',
    authenticated_session_token: 'opaque-authenticated-session-token-stale',
    expires_at: new Date(at + 3_600_000).toISOString(),
    occurred_at: new Date(at).toISOString(),
    correlation_id: 'correlation-stale',
  }).code, 'PRE_AUTH_CSRF_REPLAYED');
  assert.equal(staleStore.getSession('auth-stale').status, 'NOT_FOUND');

  const fixationStore = store();
  const fixed = { ...stale, pre_auth_session_id: 'pre-auth-fixed', browser_binding_hash: 'attacker-browser-binding' };
  registerPreAuthSession({ store: fixationStore, session: fixed });
  assert.equal(elevateSubscriberSession({
    store: fixationStore,
    pre_auth_session_id: fixed.pre_auth_session_id,
    assertion,
    subject,
    expected_csrf_generation: 2,
    authenticated_session_id: 'auth-fixed',
    authenticated_session_token: 'opaque-authenticated-session-token-fixed',
    expires_at: new Date(at + 3_600_000).toISOString(),
    occurred_at: new Date(at).toISOString(),
    correlation_id: 'correlation-fixed',
  }).code, 'SESSION_ROTATION_FAILED');

  const outageStore = store();
  registerPreAuthSession({ store: outageStore, session: { ...stale, pre_auth_session_id: 'pre-auth-outage' } });
  outageStore.setAvailability('UNAVAILABLE');
  assert.equal(elevateSubscriberSession({
    store: outageStore,
    pre_auth_session_id: 'pre-auth-outage',
    assertion,
    subject,
    expected_csrf_generation: 2,
    authenticated_session_id: 'auth-outage',
    authenticated_session_token: 'opaque-authenticated-session-token-outage',
    expires_at: new Date(at + 3_600_000).toISOString(),
    occurred_at: new Date(at).toISOString(),
    correlation_id: 'correlation-outage',
  }).code, 'PRE_AUTH_SESSION_REPLAYED');
});

test('logout revokes the authenticated session and a second revocation fails closed', async () => {
  clock = at;
  const securityState = store();
  const preAuth = createPreAuthSession({
    pre_auth_session_id: 'pre-auth-logout',
    browser_binding_hash: 'browser-binding-session',
    csrf_generation: 1,
    issued_at: new Date(at).toISOString(),
    expires_at: new Date(at + 300_000).toISOString(),
  }).session;
  registerPreAuthSession({ store: securityState, session: preAuth });
  const { assertion, subject } = await context();
  const elevated = elevateSubscriberSession({
    store: securityState,
    pre_auth_session_id: preAuth.pre_auth_session_id,
    assertion,
    subject,
    expected_csrf_generation: 1,
    authenticated_session_id: 'authenticated-session-logout',
    authenticated_session_token: 'opaque-authenticated-session-token-logout',
    expires_at: new Date(at + 3_600_000).toISOString(),
    occurred_at: new Date(at).toISOString(),
    correlation_id: 'correlation-logout',
  });
  assert.equal(elevated.ok, true);
  assert.equal(revokeAuthenticatedSubscriberSession({
    store: securityState,
    authenticated_session_id: 'authenticated-session-logout',
    reason_code: 'USER_LOGOUT',
  }).status, 'REVOKED');
  assert.equal(revokeAuthenticatedSubscriberSession({
    store: securityState,
    authenticated_session_id: 'authenticated-session-logout',
    reason_code: 'REPLAYED_LOGOUT',
  }).code, 'SESSION_ROTATION_FAILED');
});
