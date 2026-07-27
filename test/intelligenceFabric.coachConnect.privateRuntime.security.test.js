import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRODUCTION_SECURITY_POLICY_VERSIONS,
  InMemorySharedSecurityState,
  createPreAuthSession,
  createSyntheticSharedSecurityBackend,
  elevateSubscriberSession,
  registerPreAuthSession,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js';
import {
  DEFAULT_PRIVATE_RUNTIME_FLAGS,
  evaluatePrivateRuntimeActivation,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/activation.js';
import {
  createPrivateRuntimeCapabilityEnvelope,
  evaluatePrivateRuntimeAuthority,
  evaluatePrivateRuntimeSharedState,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/authority.js';
import {
  hashPrivateRuntimeScope,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/contracts.js';
import {
  createPrivateRuntimeSessionReceipt,
  logoutPrivateRuntimeSession,
  persistPrivateRuntimeCapability,
  resolveAuthoritativePrivateRuntimeSession,
  revalidatePrivateRuntimeCapability,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/sessionResolver.js';
import { developerAccessEnvironmentDecision } from '../api/internal/developer-access-security.js';
import defaultDeveloperAccessHandler from '../api/internal/developer-access.js';
import defaultLoginHandler from '../api/internal/private-runtime-login.js';
import defaultCallbackHandler from '../api/internal/private-runtime-callback.js';
import defaultSessionHandler from '../api/internal/private-runtime-session.js';
import defaultLogoutHandler from '../api/internal/private-runtime-logout.js';

const nowMs = Date.parse('2026-07-27T16:00:00.000Z');
const clock = () => nowMs;
const environmentId = 'environment_synthetic_alpha';
const scope = {
  tenant_id: 'tenant_synthetic_alpha',
  profile_id: 'profile_synthetic_alpha',
  business_id: 'business_synthetic_alpha',
  subscriber_id: 'subscriber_synthetic_alpha',
};
const subject = {
  schema_version: '1.0.0',
  subscriber_subject_id: 'canonical_subject_synthetic_alpha',
  external_subject_id: 'provider_subject_synthetic_alpha',
  issuer: 'https://issuer.synthetic.invalid/',
  audience: 'private_runtime_synthetic',
  tenant_id: scope.tenant_id,
  profile_id: scope.profile_id,
  business_id: scope.business_id,
  subscriber_id: scope.subscriber_id,
  exact_scope: scope,
  exact_scope_hash: hashPrivateRuntimeScope(scope),
  mapping_version: 1,
  security_version: 1,
  status: 'ACTIVE',
  source_assertion_reference: 'assertion_synthetic_alpha',
  bound_at: '2026-07-27T15:00:00.000Z',
  effective_at: '2026-07-27T15:00:00.000Z',
  revoked_at: null,
  reassignment_prohibited: true,
};
const assertion = {
  schema_version: 'private-runtime-verified-assertion-v1',
  assertion_reference: 'assertion_synthetic_alpha',
  subject_id: subject.external_subject_id,
  issuer: subject.issuer,
  audience: subject.audience,
  auth_strength: 'MFA_SYNTHETIC',
  session_binding_reference: 'browser_binding_synthetic_alpha',
  authenticated_at: '2026-07-27T15:59:00.000Z',
  security_version: 1,
  status: 'VERIFIED',
};
const approval = {
  approval_version: 'private-runtime-tester-approval-v1',
  approval_id: 'approval_synthetic_alpha',
  environment_id: environmentId,
  tester_subject_ref: 'external_subject_synthetic_alpha',
  exact_scope_hash: hashPrivateRuntimeScope(scope),
  purpose: 'FOUNDER_PRIVATE_RUNTIME_TEST',
  capability_allowlist: [
    'BUSINESS_ENGINE_READ',
    'SUBSCRIPTION_INTERACTION',
    'COACH_CONNECT_SUBSCRIBER',
  ],
  approved_by: 'human_authority_synthetic_alpha',
  approved_at: '2026-07-27T15:00:00.000Z',
  expires_at: '2026-07-27T17:00:00.000Z',
  status: 'ACTIVE',
  public_launch_authorized: false,
  paid_entitlement_authorized: false,
  canonical_promotion_authorized: false,
};
const enabledFlags = {
  ...DEFAULT_PRIVATE_RUNTIME_FLAGS,
  private_runtime_enabled: true,
  private_runtime_environment_allowlist: [environmentId],
  private_runtime_subject_allowlist: [subject.subscriber_subject_id],
  private_runtime_scope_allowlist: [hashPrivateRuntimeScope(scope)],
  subject_resolution_enabled: true,
  shared_security_state_enabled: true,
  subdev1_enabled: true,
  subscription_runtime_private_enabled: true,
  coach_connect_private_enabled: true,
  private_test_writes_enabled: true,
  emergency_disabled: false,
};

function deploymentDescription(overrides = {}) {
  return {
    contract_version: PRODUCTION_SECURITY_POLICY_VERSIONS.shared_state,
    adapter_class: 'DEPLOYMENT_APPROVED',
    provider: 'UPSTASH_REDIS',
    deployment_grade: true,
    available: true,
    atomicity_model: 'DEPLOYMENT_SHAPED_OFFLINE_CONFORMANCE',
    ttl_clock_source: 'SYNTHETIC_SERVER_TIME',
    partition_behavior: 'FAIL_CLOSED',
    durable_audit: true,
    environment_id: environmentId,
    authoritative_reads_from_primary_only: true,
    durable_persistence_verified: true,
    atomicity_verified: true,
    server_time_ttl_verified: true,
    backup_capability_verified: true,
    regional_behavior_verified: true,
    outage_fail_closed_verified: true,
    read_after_eviction_verified: true,
    no_local_fallback: true,
    production_connection: false,
    live_connection_verified: false,
    evidence_class: 'DEPLOYMENT_SHAPED_OFFLINE',
    ...overrides,
  };
}

function deploymentShapedOfflinePort(backend = createSyntheticSharedSecurityBackend(null, { clock }), overrides = {}) {
  const synthetic = new InMemorySharedSecurityState({ backend, environment_id: environmentId, clock });
  return new Proxy(synthetic, {
    get(target, property, receiver) {
      if (property === 'describeCapability') return () => deploymentDescription(overrides.description);
      if (property === 'health') {
        return () => ({
          ok: target.available(),
          state: overrides.healthState || (target.available() ? 'HEALTHY' : target.backend.availability),
          evidence_class: 'DEPLOYMENT_SHAPED_OFFLINE',
          live_connection: false,
        });
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function createElevatedState() {
  const backend = createSyntheticSharedSecurityBackend(null, { clock });
  const store = deploymentShapedOfflinePort(backend);
  const preAuth = createPreAuthSession({
    pre_auth_session_id: 'pre_auth_synthetic_alpha',
    browser_binding_hash: assertion.session_binding_reference,
    issued_at: '2026-07-27T15:59:00.000Z',
    expires_at: '2026-07-27T16:10:00.000Z',
  });
  assert.equal(preAuth.ok, true);
  assert.equal(registerPreAuthSession({ store, session: preAuth.session }).ok, true);
  const elevated = elevateSubscriberSession({
    store,
    pre_auth_session_id: preAuth.session.pre_auth_session_id,
    assertion,
    subject,
    expected_csrf_generation: 1,
    authenticated_session_id: 'authenticated_session_synthetic_alpha',
    authenticated_session_token: 'authenticated-session-token-synthetic-alpha-000001',
    expires_at: '2026-07-27T16:30:00.000Z',
    occurred_at: '2026-07-27T16:00:00.000Z',
    correlation_id: 'correlation_session_synthetic_alpha',
  });
  assert.equal(elevated.ok, true);
  assert.equal(store.advanceSecurityEpoch({
    scope_hash: hashPrivateRuntimeScope(scope),
    expected_epoch: 0,
    reason_code: 'SESSION_ELEVATED',
  }).ok, true);
  return { backend, store, preAuth: preAuth.session, elevated };
}

function capabilityFor(session) {
  return createPrivateRuntimeCapabilityEnvelope({
    capabilityId: 'capability_synthetic_alpha',
    environmentId,
    subject,
    session,
    scope,
    browserBindingHash: assertion.session_binding_reference,
    allowedRuntimeActions: [
      'BUSINESS_ENGINE_READ',
      'READ_CURRENT_STATE',
      'SUBSCRIBER_PROJECTION',
    ],
    issuedAt: '2026-07-27T16:00:00.000Z',
    expiresAt: '2026-07-27T16:15:00.000Z',
  });
}

const response = () => ({
  statusCode: 0,
  payload: null,
  headers: {},
  setHeader(name, value) { this.headers[name] = value; },
  status(code) { this.statusCode = code; return this; },
  json(value) { this.payload = value; return this; },
});

test('all source defaults deny, emergency disable dominates, and unsafe activation denies', () => {
  assert.equal(evaluatePrivateRuntimeActivation({
    environmentId,
    subscriberSubjectRef: subject.subscriber_subject_id,
    exactScopeHash: hashPrivateRuntimeScope(scope),
    requestedRuntime: 'BUSINESS_ENGINE',
  }).code, 'EMERGENCY_DISABLED');
  assert.equal(evaluatePrivateRuntimeActivation({
    flags: { ...enabledFlags, emergency_disabled: true },
    environmentId,
    subscriberSubjectRef: subject.subscriber_subject_id,
    exactScopeHash: hashPrivateRuntimeScope(scope),
    requestedRuntime: 'BUSINESS_ENGINE',
  }).code, 'EMERGENCY_DISABLED');
  assert.equal(evaluatePrivateRuntimeActivation({
    flags: { ...enabledFlags, live_model_provider_enabled: true },
    environmentId,
    subscriberSubjectRef: subject.subscriber_subject_id,
    exactScopeHash: hashPrivateRuntimeScope(scope),
    requestedRuntime: 'BUSINESS_ENGINE',
  }).code, 'PRIVATE_RUNTIME_DISABLED');
});

test('in-memory and incomplete deployment capability deny; offline conformance never proves private-live', () => {
  const inMemory = new InMemorySharedSecurityState({ environment_id: environmentId, clock });
  assert.equal(evaluatePrivateRuntimeSharedState({
    store: inMemory,
    environmentId,
    evidenceClass: 'DEPLOYMENT_SHAPED_OFFLINE',
  }).code, 'SHARED_SECURITY_STATE_REQUIRED');
  const incomplete = deploymentShapedOfflinePort(undefined, {
    description: { backup_capability_verified: false },
  });
  assert.equal(evaluatePrivateRuntimeSharedState({
    store: incomplete,
    environmentId,
    evidenceClass: 'DEPLOYMENT_SHAPED_OFFLINE',
  }).code, 'SHARED_SECURITY_STATE_REQUIRED');
  const offline = deploymentShapedOfflinePort();
  assert.equal(evaluatePrivateRuntimeSharedState({
    store: offline,
    environmentId,
    evidenceClass: 'DEPLOYMENT_SHAPED_OFFLINE',
  }).allowed, true);
  assert.equal(evaluatePrivateRuntimeSharedState({
    store: offline,
    environmentId,
    evidenceClass: 'FUTURE_PRIVATE_LIVE',
  }).allowed, false);
});

test('unavailable, degraded, and partitioned shared state fail closed without local fallback', () => {
  for (const state of ['DEGRADED', 'UNAVAILABLE', 'PARTITIONED']) {
    const backend = createSyntheticSharedSecurityBackend(null, { clock });
    backend.availability = state;
    const store = deploymentShapedOfflinePort(backend, { healthState: state });
    const result = evaluatePrivateRuntimeSharedState({
      store,
      environmentId,
      evidenceClass: 'DEPLOYMENT_SHAPED_OFFLINE',
    });
    assert.equal(result.allowed, false);
    assert.ok(['SHARED_SECURITY_STATE_UNAVAILABLE', 'SHARED_SECURITY_STATE_PARTITIONED'].includes(result.code));
  }
});

test('pre-auth rotation changes session and CSRF identity; conflicting replay denies', () => {
  const { store, preAuth, elevated } = createElevatedState();
  assert.notEqual(elevated.authenticated_session.authenticated_session_id, preAuth.pre_auth_session_id);
  assert.equal(elevated.authenticated_session.csrf_generation, preAuth.csrf_generation + 1);
  assert.equal(store.getSession(preAuth.pre_auth_session_id).session.status, 'ROTATED');
  const conflict = elevateSubscriberSession({
    store,
    pre_auth_session_id: preAuth.pre_auth_session_id,
    assertion,
    subject,
    expected_csrf_generation: 2,
    authenticated_session_id: 'authenticated_session_conflicting',
    authenticated_session_token: 'authenticated-session-token-synthetic-alpha-conflict',
    expires_at: '2026-07-27T16:30:00.000Z',
    occurred_at: '2026-07-27T16:00:01.000Z',
    correlation_id: 'correlation_session_conflicting',
  });
  assert.equal(conflict.ok, false);
});

test('session and capability revalidate after restart and remain exact-bound', () => {
  const { backend, elevated } = createElevatedState();
  const envelope = capabilityFor(elevated.authenticated_session);
  assert.equal(envelope.ok, true);
  const firstStore = deploymentShapedOfflinePort(backend);
  const rawCapability = 'private-runtime-capability-synthetic-alpha-0000000001';
  assert.equal(persistPrivateRuntimeCapability({
    store: firstStore,
    rawCapability,
    envelope: envelope.envelope,
    now: nowMs,
  }).ok, true);
  const restarted = deploymentShapedOfflinePort(backend);
  const session = resolveAuthoritativePrivateRuntimeSession({
    store: restarted,
    authenticatedSessionId: elevated.authenticated_session.authenticated_session_id,
    subject,
    browserBindingHash: assertion.session_binding_reference,
    environmentScopeHash: hashPrivateRuntimeScope(scope),
    now: nowMs,
  });
  assert.equal(session.ok, true);
  const capability = revalidatePrivateRuntimeCapability({
    store: restarted,
    rawCapability,
    bindings: {
      subject,
      session: session.session,
      scope,
      environmentId,
      browserBindingHash: assertion.session_binding_reference,
      currentEpoch: session.current_epoch,
    },
    now: nowMs,
  });
  assert.equal(capability.ok, true);
  const copied = revalidatePrivateRuntimeCapability({
    store: restarted,
    rawCapability,
    bindings: {
      subject,
      session: session.session,
      scope,
      environmentId,
      browserBindingHash: 'browser_binding_other',
      currentEpoch: session.current_epoch,
    },
    now: nowMs,
  });
  assert.equal(copied.code, 'CAPABILITY_INVALID');
  assert.equal(JSON.stringify(restarted.snapshot()).includes(rawCapability), false);
});

test('complete authority requires current session, approval, capability, epoch, and action', () => {
  const { store, elevated } = createElevatedState();
  const sharedState = evaluatePrivateRuntimeSharedState({
    store,
    environmentId,
    evidenceClass: 'DEPLOYMENT_SHAPED_OFFLINE',
  });
  const capability = capabilityFor(elevated.authenticated_session).envelope;
  const allowed = evaluatePrivateRuntimeAuthority({
    flags: enabledFlags,
    environmentId,
    subject,
    session: elevated.authenticated_session,
    scope,
    approval,
    capability,
    sharedState,
    requestedRuntime: 'BUSINESS_ENGINE',
    requestedAction: 'BUSINESS_ENGINE_READ',
    browserBindingHash: assertion.session_binding_reference,
    currentEpoch: 1,
    now: nowMs,
  });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.shared_state_evidence_class, 'DEPLOYMENT_SHAPED_OFFLINE');
  assert.equal(evaluatePrivateRuntimeAuthority({
    flags: enabledFlags,
    environmentId,
    subject,
    session: elevated.authenticated_session,
    scope,
    approval,
    capability,
    sharedState,
    requestedRuntime: 'BUSINESS_ENGINE',
    requestedAction: 'UNALLOWLISTED',
    browserBindingHash: assertion.session_binding_reference,
    currentEpoch: 1,
    now: nowMs,
  }).code, 'ACTION_NOT_ALLOWLISTED');
});

test('logout revokes capability and session, advances epoch, clears both cookies, and detaches', () => {
  const { store, elevated } = createElevatedState();
  const rawCapability = 'private-runtime-capability-synthetic-alpha-logout-001';
  const envelope = capabilityFor(elevated.authenticated_session).envelope;
  assert.equal(persistPrivateRuntimeCapability({ store, rawCapability, envelope, now: nowMs }).ok, true);
  const logout = logoutPrivateRuntimeSession({
    store,
    authenticatedSessionId: elevated.authenticated_session.authenticated_session_id,
    rawCapability,
    environmentScopeHash: hashPrivateRuntimeScope(scope),
    expectedEpoch: 1,
  });
  assert.equal(logout.ok, true);
  assert.equal(logout.receipt.capability_revoked, true);
  assert.equal(logout.receipt.session_revoked, true);
  assert.equal(logout.receipt.runtime_handles_detached, true);
  assert.equal(store.getSecurityEpoch(hashPrivateRuntimeScope(scope)).epoch, 2);
  assert.equal(resolveAuthoritativePrivateRuntimeSession({
    store,
    authenticatedSessionId: elevated.authenticated_session.authenticated_session_id,
    subject,
    browserBindingHash: assertion.session_binding_reference,
    environmentScopeHash: hashPrivateRuntimeScope(scope),
    now: nowMs,
  }).code, 'SESSION_REVOKED');
});

test('session receipt is content-free and emergency epoch makes prior envelope stale', () => {
  const { store, elevated } = createElevatedState();
  const receipt = createPrivateRuntimeSessionReceipt({
    receiptId: 'session_receipt_synthetic_alpha',
    environmentId,
    session: elevated.authenticated_session,
  });
  assert.equal(receipt.ok, true);
  assert.equal(receipt.receipt.raw_session_material_present, false);
  assert.equal(JSON.stringify(receipt).includes('authenticated-session-token'), false);
  const capability = capabilityFor(elevated.authenticated_session).envelope;
  store.advanceSecurityEpoch({
    scope_hash: hashPrivateRuntimeScope(scope),
    expected_epoch: 1,
    reason_code: 'EMERGENCY_DISABLED',
  });
  const stale = evaluatePrivateRuntimeAuthority({
    flags: enabledFlags,
    environmentId,
    subject,
    session: elevated.authenticated_session,
    scope,
    approval,
    capability,
    sharedState: evaluatePrivateRuntimeSharedState({
      store,
      environmentId,
      evidenceClass: 'DEPLOYMENT_SHAPED_OFFLINE',
    }),
    requestedRuntime: 'BUSINESS_ENGINE',
    requestedAction: 'BUSINESS_ENGINE_READ',
    browserBindingHash: assertion.session_binding_reference,
    currentEpoch: 2,
    now: nowMs,
  });
  assert.equal(stale.code, 'CAPABILITY_REVOKED');
});

test('Production classification alone grants nothing; only future-live full bridge decision can cross environment gate', () => {
  const env = { NODE_ENV: 'production' };
  assert.equal(developerAccessEnvironmentDecision(env, {}).ok, false);
  assert.equal(developerAccessEnvironmentDecision(env, {}, {
    allowed: true,
    shared_state_evidence_class: 'DEPLOYMENT_SHAPED_OFFLINE',
    deployment_grade_security_state: true,
    no_local_fallback: true,
  }).ok, false);
  assert.equal(developerAccessEnvironmentDecision(env, {}, {
    allowed: true,
    shared_state_evidence_class: 'FUTURE_PRIVATE_LIVE',
    deployment_grade_security_state: true,
    no_local_fallback: true,
  }).ok, true);
});

test('default exported handlers remain unavailable and make zero provider calls', async () => {
  const originalEnv = { ...globalThis.process.env };
  try {
    globalThis.process.env.COACH_CONNECT_DEVELOPER_ACCESS_ENABLED = 'false';
    const handlers = [
      [defaultDeveloperAccessHandler, { method: 'GET', headers: {} }],
      [defaultLoginHandler, { method: 'POST', body: {}, headers: {} }],
      [defaultCallbackHandler, { method: 'POST', body: {}, headers: {} }],
      [defaultSessionHandler, { method: 'GET', headers: {} }],
      [defaultLogoutHandler, { method: 'POST', headers: {} }],
    ];
    for (const [handler, request] of handlers) {
      const res = response();
      await handler(request, res);
      assert.ok([403, 404].includes(res.statusCode));
    }
  } finally {
    for (const key of Object.keys(globalThis.process.env)) {
      if (!(key in originalEnv)) delete globalThis.process.env[key];
    }
    Object.assign(globalThis.process.env, originalEnv);
  }
});
