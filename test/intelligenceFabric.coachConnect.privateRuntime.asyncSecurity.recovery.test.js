import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  SyntheticAsyncSecurityStateAdapter,
  createRemoteSecurityRecord,
  createSyntheticAsyncSecurityBackend,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js';
import {
  createCanonicalAsyncSecurityServiceV2,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/index.js';

const environmentId = 'synthetic_async_environment';
const externalSubjectRef = 'verified_external_subject_alpha';
const subscriberSubjectRef = 'canonical_subscriber_alpha';
const scopeHash = 'a'.repeat(64);
const browserHash = 'c'.repeat(64);
const accessCode = 'SUBDEV1';
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

function canonicalApprovalRecord() {
  const issuedAtMs = Date.parse('2026-07-27T20:00:00.000Z');
  const expiresAtMs = Date.parse('2026-07-27T23:00:00.000Z');
  return createRemoteSecurityRecord({
    schema_name: 'PrivateTestApprovalV1',
    environment_digest: 'd'.repeat(64),
    provider_time_ms: issuedAtMs,
    fields: {
      approval_ref: 'private_test_approval_alpha',
      environment_id: environmentId,
      subscriber_subject_ref: subscriberSubjectRef,
      exact_scope_hash: scopeHash,
      purpose: 'TEMPORARY_PRIVATE_SUBSCRIPTION_TEST',
      provenance_ref: 'e'.repeat(64),
      status: 'ACTIVE',
      approval_epoch: 1,
      security_epoch: 1,
      issued_at: new Date(issuedAtMs).toISOString(),
      expires_at: new Date(expiresAtMs).toISOString(),
      issued_at_ms: issuedAtMs,
      expires_at_ms: expiresAtMs,
    },
  });
}

function baseSnapshot() {
  const mapping = {
    record_version: 'canonical-subject-mapping-v1',
    external_subject_ref: externalSubjectRef,
    subscriber_subject_ref: subscriberSubjectRef,
    exact_scope_hash: scopeHash,
    mapping_version: 1,
    security_version: 1,
    status: 'ACTIVE',
    subscriber_confirmed: true,
    auto_enrolled: false,
    bound_at: '2026-07-27T20:00:00.000Z',
  };
  return {
    canonical_by_external: [[externalSubjectRef, mapping]],
    canonical_by_scope: [[scopeHash, {
      subscriber_subject_ref: subscriberSubjectRef,
      external_subject_ref: externalSubjectRef,
      exact_scope_hash: scopeHash,
      mapping_version: 1,
      status: 'ACTIVE',
    }]],
    approvals: [[`${subscriberSubjectRef}|${scopeHash}`, canonicalApprovalRecord()]],
    security_epochs: [[scopeHash, 1]],
  };
}

function configuration(overrides = {}) {
  return {
    enabled: true,
    emergency_disabled: false,
    environment_allowlist: [environmentId],
    subject_allowlist: [subscriberSubjectRef],
    scope_allowlist: [scopeHash],
    pre_auth_ttl_ms: 60_000,
    session_ttl_ms: 600_000,
    csrf_ttl_ms: 60_000,
    entitlement_ttl_ms: 300_000,
    ...overrides,
  };
}

function createHarness({
  state = baseSnapshot(),
  availability,
  emergencyDisabled = false,
} = {}) {
  const time = { now: Date.parse('2026-07-27T21:00:00.000Z') };
  const backend = createSyntheticAsyncSecurityBackend({
    ...state,
    ...(availability ? { availability } : {}),
  }, { clock: () => time.now });
  const counts = new Map();
  const tokenFactory = async (kind) => {
    const next = (counts.get(kind) || 0) + 1;
    counts.set(kind, next);
    return `${kind}_material_${next}`;
  };
  const makeService = () => createCanonicalAsyncSecurityServiceV2({
    statePort: new SyntheticAsyncSecurityStateAdapter({
      backend,
      environment_id: environmentId,
    }),
    environmentId,
    expectedPrivateAccessCode: accessCode,
    tokenFactory,
    tokenHasher: async (value) => hash(value),
    configuration: configuration({ emergency_disabled: emergencyDisabled }),
  });
  return { backend, time, makeService, service: makeService() };
}

function edgeAttestation() {
  return {
    named_identity_verified: true,
    mfa_verified: true,
    public_access: false,
  };
}

function verifiedAssertion() {
  return {
    verification_status: 'VERIFIED',
    named_identity_verified: true,
    mfa_verified: true,
    external_subject_ref: externalSubjectRef,
    exact_scope_hash: scopeHash,
  };
}

async function login(service, {
  correlation = 'correlation_login_alpha',
  rotationParent = null,
} = {}) {
  const begun = await service.beginPreAuth({
    environment_id: environmentId,
    browser_binding_hash: browserHash,
    correlation_ref: correlation,
    edge_attestation: edgeAttestation(),
  });
  assert.equal(begun.allowed, true);
  const authenticated = await service.completeAuthentication({
    environment_id: environmentId,
    pre_auth_token_hash: hash(begun.pre_auth_cookie_value),
    browser_binding_hash: browserHash,
    correlation_ref: correlation,
    edge_attestation: edgeAttestation(),
    verified_assertion: verifiedAssertion(),
    ...(rotationParent ? {
      rotation_parent_reference: rotationParent.authenticated_session_ref,
      rotation_parent_session_token_hash: rotationParent.session_token_hash,
    } : {}),
  });
  return { begun, authenticated };
}

function contextFrom(authenticated, overrides = {}) {
  return {
    environment_id: environmentId,
    external_subject_ref: externalSubjectRef,
    session_token_hash: hash(authenticated.session_cookie_value),
    exact_scope_hash: scopeHash,
    browser_binding_hash: browserHash,
    correlation_ref: 'correlation_runtime_alpha',
    route: '/api/internal/developer-access',
    method: 'POST',
    idempotency_ref: 'entitlement_attempt_alpha',
    edge_attestation: edgeAttestation(),
    ...overrides,
  };
}

async function issueEntitlement(service, authenticated) {
  const context = contextFrom(authenticated);
  const resolved = await service.resolveAuthenticatedContext(context);
  const eligibility = await service.evaluatePrivateTestEligibility(
    resolved.authenticated_context,
  );
  const csrf = await service.issueCsrfGrant(resolved.authenticated_context, {
    route: context.route,
    method: context.method,
    browser_binding_hash: context.browser_binding_hash,
  });
  const issued = await service.issueTemporaryEntitlement({
    request_context: { ...context, csrf_proof: csrf.csrf_proof },
    eligibility_decision: eligibility,
    submitted_code: accessCode,
  });
  return {
    issued,
    context: {
      ...context,
      entitlement_token_hash: issued.allowed
        ? hash(issued.entitlement_cookie_value)
        : null,
    },
  };
}

test('pre-auth rotates atomically into one authenticated session', async () => {
  const { service, backend } = createHarness();
  const { begun, authenticated } = await login(service);
  assert.equal(authenticated.allowed, true);
  assert.notEqual(hash(authenticated.session_cookie_value), hash(begun.pre_auth_cookie_value));
  assert.equal(backend.sessions_by_ref.get(begun.pre_auth_session_ref).status, 'ROTATED');
  assert.equal(backend.sessions_by_ref.get(authenticated.authenticated_session_ref).status, 'ACTIVE');
  assert.equal(authenticated.authenticated_context.session_epoch, 1);
});

test('session rotation invalidates old session, CSRF, and entitlement authority', async () => {
  const { service, backend } = createHarness();
  const first = (await login(service)).authenticated;
  const entitlement = await issueEntitlement(service, first);
  assert.equal(entitlement.issued.allowed, true);
  const rotated = (await login(service, {
    correlation: 'correlation_rotation_alpha',
    rotationParent: {
      authenticated_session_ref: first.authenticated_session_ref,
      session_token_hash: hash(first.session_cookie_value),
    },
  })).authenticated;
  assert.equal(rotated.allowed, true);
  assert.equal(rotated.authenticated_context.session_epoch, 2);
  assert.equal(backend.sessions_by_ref.get(first.authenticated_session_ref).status, 'ROTATED');
  assert.equal([...backend.entitlements_by_ref.values()][0].status, 'ROTATED');
  assert.equal((await service.evaluatePrivateRuntimeAuthority({
    request_context: entitlement.context,
    requested_runtime: 'SUBSCRIPTION_RUNTIME',
    requested_action: 'continue_session',
  })).allowed, false);
});

test('authoritative time expires session and entitlement without process-local fallback', async () => {
  const { service, time } = createHarness();
  const authenticated = (await login(service)).authenticated;
  const entitlement = await issueEntitlement(service, authenticated);
  assert.equal((await service.inspectTemporaryEntitlement(entitlement.context)).allowed, true);
  time.now += 11 * 60_000;
  assert.equal((await service.resolveAuthenticatedContext(
    contextFrom(authenticated),
  )).allowed, false);
  assert.equal((await service.inspectTemporaryEntitlement(entitlement.context)).allowed, false);
});

test('explicit entitlement revocation invalidates subsequent inspection and authority', async () => {
  const { service } = createHarness();
  const authenticated = (await login(service)).authenticated;
  const entitlement = await issueEntitlement(service, authenticated);
  const revoked = await service.revokeTemporaryEntitlement({
    request_context: entitlement.context,
  });
  assert.equal(revoked.entitlement_revoked, true);
  assert.equal((await service.inspectTemporaryEntitlement(entitlement.context)).allowed, false);
  assert.equal((await service.evaluatePrivateRuntimeAuthority({
    request_context: entitlement.context,
    requested_runtime: 'COACH_CONNECT',
    requested_action: 'send_text',
  })).allowed, false);
});

test('healthy logout revokes session and entitlement, advances epoch, and is repeat-safe', async () => {
  const { service, backend } = createHarness();
  const authenticated = (await login(service)).authenticated;
  const entitlement = await issueEntitlement(service, authenticated);
  const loggedOut = await service.logout({ request_context: entitlement.context });
  assert.equal(loggedOut.server_revocation_confirmed, true);
  assert.equal(loggedOut.client_session_cookie_clear, true);
  assert.equal(loggedOut.client_entitlement_cookie_clear, true);
  assert.equal(loggedOut.runtime_handles_detached, true);
  assert.equal(backend.security_epochs.get(scopeHash), 2);
  assert.equal(backend.sessions_by_ref.get(authenticated.authenticated_session_ref).status, 'REVOKED');
  assert.equal([...backend.entitlements_by_ref.values()][0].status, 'REVOKED');
  const repeated = await service.logout({ request_context: entitlement.context });
  assert.equal(repeated.server_revocation_confirmed, true);
  assert.equal(repeated.already_revoked, true);
  assert.equal(backend.security_epochs.get(scopeHash), 2);
});

test('outage logout clears client authority but never claims or queues server revocation', async () => {
  const { service, backend } = createHarness();
  const authenticated = (await login(service)).authenticated;
  const entitlement = await issueEntitlement(service, authenticated);
  backend.availability = 'UNAVAILABLE';
  const decision = await service.logout({ request_context: entitlement.context });
  assert.equal(decision.code, 'LOGOUT_REVOCATION_UNCONFIRMED');
  assert.equal(decision.client_session_cookie_clear, true);
  assert.equal(decision.client_entitlement_cookie_clear, true);
  assert.equal(decision.server_revocation_confirmed, false);
  assert.equal(decision.local_revocation_queued, false);
  assert.equal(backend.sessions_by_ref.get(authenticated.authenticated_session_ref).status, 'ACTIVE');
});

test('emergency disable dominates login, continuation, entitlement, and runtime authority', async () => {
  const active = createHarness();
  const authenticated = (await login(active.service)).authenticated;
  const entitlement = await issueEntitlement(active.service, authenticated);
  const emergencyService = createCanonicalAsyncSecurityServiceV2({
    statePort: new SyntheticAsyncSecurityStateAdapter({
      backend: active.backend,
      environment_id: environmentId,
    }),
    environmentId,
    expectedPrivateAccessCode: accessCode,
    tokenFactory: async (kind) => `${kind}_emergency_material`,
    tokenHasher: async (value) => hash(value),
    configuration: configuration({ emergency_disabled: true }),
  });
  assert.equal((await emergencyService.beginPreAuth({
    environment_id: environmentId,
    browser_binding_hash: browserHash,
    correlation_ref: 'correlation_emergency_alpha',
    edge_attestation: edgeAttestation(),
  })).code, 'EMERGENCY_DISABLED');
  assert.equal((await emergencyService.resolveAuthenticatedContext(
    contextFrom(authenticated),
  )).code, 'EMERGENCY_DISABLED');
  assert.equal((await emergencyService.inspectTemporaryEntitlement(
    entitlement.context,
  )).code, 'EMERGENCY_DISABLED');
  assert.equal((await emergencyService.evaluatePrivateRuntimeAuthority({
    request_context: entitlement.context,
    requested_runtime: 'COACH_CONNECT',
    requested_action: 'send_text',
  })).code, 'EMERGENCY_DISABLED');
});

test('stale epoch and logout racing runtime action leave no surviving allow', async () => {
  const { service, backend } = createHarness();
  const authenticated = (await login(service)).authenticated;
  const entitlement = await issueEntitlement(service, authenticated);
  backend.security_epochs.set(scopeHash, 2);
  assert.equal((await service.evaluatePrivateRuntimeAuthority({
    request_context: entitlement.context,
    requested_runtime: 'BUSINESS_ENGINE',
    requested_action: 'attach_existing',
  })).allowed, false);

  const second = createHarness();
  const secondAuth = (await login(second.service)).authenticated;
  const secondEntitlement = await issueEntitlement(second.service, secondAuth);
  await Promise.all([
    second.service.logout({ request_context: secondEntitlement.context }),
    second.service.evaluatePrivateRuntimeAuthority({
      request_context: secondEntitlement.context,
      requested_runtime: 'COACH_CONNECT',
      requested_action: 'send_text',
    }),
  ]);
  assert.equal((await second.service.evaluatePrivateRuntimeAuthority({
    request_context: secondEntitlement.context,
    requested_runtime: 'COACH_CONNECT',
    requested_action: 'send_text',
  })).allowed, false);
});

test('two concurrent callback rotations create exactly one active session', async () => {
  const { service, backend } = createHarness();
  const begun = await service.beginPreAuth({
    environment_id: environmentId,
    browser_binding_hash: browserHash,
    correlation_ref: 'correlation_callback_race',
    edge_attestation: edgeAttestation(),
  });
  const complete = () => service.completeAuthentication({
    environment_id: environmentId,
    pre_auth_token_hash: hash(begun.pre_auth_cookie_value),
    browser_binding_hash: browserHash,
    correlation_ref: 'correlation_callback_race',
    edge_attestation: edgeAttestation(),
    verified_assertion: verifiedAssertion(),
  });
  const results = await Promise.all([complete(), complete()]);
  assert.equal(results.filter((result) => result.allowed).length, 1);
  assert.equal([...backend.sessions_by_ref.values()]
    .filter((record) => record.session_class === 'AUTHENTICATED'
      && record.status === 'ACTIVE').length, 1);
});

test('fresh service instance rebuilds synthetic authority without deployment-grade claim', async () => {
  const { service, makeService } = createHarness();
  const authenticated = (await login(service)).authenticated;
  const entitlement = await issueEntitlement(service, authenticated);
  const before = await service.inspectRecovery({
    request_context: entitlement.context,
    requested_runtime: 'SUBSCRIPTION_RUNTIME',
    requested_action: 'continue_session',
  });
  const after = await makeService().inspectRecovery({
    request_context: entitlement.context,
    requested_runtime: 'SUBSCRIPTION_RUNTIME',
    requested_action: 'continue_session',
  });
  assert.equal(before.allowed, true);
  assert.equal(after.allowed, true);
  assert.equal(before.authority.authority_fingerprint, after.authority.authority_fingerprint);
  assert.equal(after.evidence_class, 'SYNTHETIC');
  assert.equal(after.deployment_grade, false);
  assert.equal(after.local_fallback_used, false);
});
