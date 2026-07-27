import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  SyntheticAsyncSecurityStateAdapter,
  createSyntheticAsyncSecurityBackend,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js';
import {
  createCanonicalAsyncSecurityServiceV2,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/index.js';

const now = Date.parse('2026-07-27T21:00:00.000Z');
const environmentId = 'synthetic_async_environment';
const externalSubjectRef = 'verified_external_subject_alpha';
const subscriberSubjectRef = 'canonical_subscriber_alpha';
const scopeHash = 'a'.repeat(64);
const sessionHash = 'b'.repeat(64);
const browserHash = 'c'.repeat(64);

function activeSnapshot(overrides = {}) {
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
  const inverse = {
    subscriber_subject_ref: subscriberSubjectRef,
    external_subject_ref: externalSubjectRef,
    exact_scope_hash: scopeHash,
    mapping_version: 1,
    status: 'ACTIVE',
  };
  const session = {
    record_version: 'authenticated-private-session-v2',
    authenticated_session_ref: 'authenticated_session_alpha',
    session_token_hash: sessionHash,
    environment_id: environmentId,
    subscriber_subject_ref: subscriberSubjectRef,
    exact_scope_hash: scopeHash,
    browser_binding_hash: browserHash,
    subject_security_version: 1,
    session_epoch: 1,
    security_epoch: 1,
    session_class: 'AUTHENTICATED',
    status: 'ACTIVE',
    issued_at: '2026-07-27T20:00:00.000Z',
    expires_at: '2026-07-27T22:00:00.000Z',
  };
  const approval = {
    record_version: 'private-test-approval-v1',
    approval_ref: 'private_test_approval_alpha',
    environment_id: environmentId,
    subscriber_subject_ref: subscriberSubjectRef,
    exact_scope_hash: scopeHash,
    purpose: 'TEMPORARY_PRIVATE_SUBSCRIPTION_TEST',
    status: 'ACTIVE',
    issued_at: '2026-07-27T20:00:00.000Z',
    expires_at: '2026-07-27T21:30:00.000Z',
    security_epoch: 1,
  };
  return {
    canonical_by_external: [[externalSubjectRef, mapping]],
    canonical_by_scope: [[scopeHash, inverse]],
    sessions_by_token: [[sessionHash, session]],
    sessions_by_ref: [['authenticated_session_alpha', session]],
    approvals: [[`${subscriberSubjectRef}|${scopeHash}`, approval]],
    security_epochs: [[scopeHash, 1]],
    ...overrides,
  };
}

function context(overrides = {}) {
  return {
    environment_id: environmentId,
    external_subject_ref: externalSubjectRef,
    session_token_hash: sessionHash,
    exact_scope_hash: scopeHash,
    browser_binding_hash: browserHash,
    correlation_ref: 'correlation_subject_resolution_alpha',
    edge_attestation: {
      named_identity_verified: true,
      mfa_verified: true,
      public_access: false,
    },
    ...overrides,
  };
}

function configuredService(snapshot = activeSnapshot(), configuration = {}) {
  const backend = createSyntheticAsyncSecurityBackend(snapshot, { clock: () => now });
  const statePort = new SyntheticAsyncSecurityStateAdapter({
    backend,
    environment_id: environmentId,
  });
  const service = createCanonicalAsyncSecurityServiceV2({
    statePort,
    environmentId,
    configuration: {
      enabled: true,
      emergency_disabled: false,
      environment_allowlist: [environmentId],
      subject_allowlist: [subscriberSubjectRef],
      scope_allowlist: [scopeHash],
      ...configuration,
    },
  });
  return { backend, service };
}

test('active authenticated subject resolves exactly once in both mapping directions', async () => {
  const { service } = configuredService();
  const decision = await service.resolveAuthenticatedContext(context());
  assert.equal(decision.allowed, true);
  assert.equal(decision.canonical_subject.subscriber_subject_ref, subscriberSubjectRef);
  assert.equal(decision.canonical_subject.exact_scope_hash, scopeHash);
  assert.equal(decision.canonical_subject.auto_enrolled, false);
  assert.equal(decision.authenticated_context.authenticated_session_ref, 'authenticated_session_alpha');
});

test('unknown or ambiguous canonical subject fails closed without enrollment', async () => {
  const unknown = configuredService({
    ...activeSnapshot(),
    canonical_by_external: [],
  });
  assert.equal((await unknown.service.resolveAuthenticatedContext(context())).allowed, false);
  assert.equal(unknown.backend.canonical_by_external.size, 0);

  const ambiguousMapping = {
    ...activeSnapshot().canonical_by_external[0][1],
    ambiguous: true,
  };
  const ambiguous = configuredService({
    ...activeSnapshot(),
    canonical_by_external: [[externalSubjectRef, ambiguousMapping]],
  });
  const ambiguousDecision = await ambiguous.service.resolveAuthenticatedContext(context());
  assert.equal(ambiguousDecision.allowed, false);
  assert.equal(ambiguousDecision.code, 'SUBJECT_MAPPING_AMBIGUOUS');
});

test('scope inverse mismatch and cross-subscriber collision fail closed', async () => {
  const collision = configuredService({
    ...activeSnapshot(),
    canonical_by_scope: [[scopeHash, {
      ...activeSnapshot().canonical_by_scope[0][1],
      subscriber_subject_ref: 'different_canonical_subscriber',
    }]],
  });
  const decision = await collision.service.resolveAuthenticatedContext(context());
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, 'SUBJECT_MAPPING_AMBIGUOUS');
});

test('unverified request fields and bootstrap values cannot establish identity', async () => {
  const { service } = configuredService();
  const candidates = [
    { external_subject_ref: null },
    { external_subject_ref: 'person@example.invalid' },
    { external_subject_ref: 'first last' },
    { external_subject_ref: 'https://invalid.example/subject' },
    { external_subject_ref: 'SUBDEV1' },
    { edge_attestation: { named_identity_verified: false, mfa_verified: true, public_access: false } },
    { edge_attestation: { named_identity_verified: true, mfa_verified: false, public_access: false } },
    { edge_attestation: { named_identity_verified: true, mfa_verified: true, public_access: true } },
  ];
  for (const candidate of candidates) {
    assert.equal((await service.resolveAuthenticatedContext(context(candidate))).allowed, false);
  }
  assert.equal((await service.resolveAuthenticatedContext({
    profile_id: 'profile_input_is_not_authority',
    developer_capability: 'developer_input_is_not_authority',
    request_body: { subject: externalSubjectRef },
  })).allowed, false);
});

test('eligibility requires both exact activation configuration and active approval', async () => {
  const configured = configuredService();
  const authenticated = await configured.service.resolveAuthenticatedContext(context());
  const allowed = await configured.service.evaluatePrivateTestEligibility(
    authenticated.authenticated_context,
  );
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.may_attempt_subdev1, true);
  for (const field of [
    'runtime_access',
    'admin_authority',
    'operator_authority',
    'deployment_authority',
    'billing_authority',
    'coach_authority',
    'canonical_mutation_authority',
  ]) {
    assert.equal(allowed[field], false, field);
  }

  const noApproval = configuredService({ ...activeSnapshot(), approvals: [] });
  const authenticatedWithoutApproval = await noApproval.service.resolveAuthenticatedContext(context());
  assert.equal((await noApproval.service.evaluatePrivateTestEligibility(
    authenticatedWithoutApproval.authenticated_context,
  )).allowed, false);

  const noActivation = configuredService(activeSnapshot(), { enabled: false });
  const authenticatedWithoutActivation = await noActivation.service.resolveAuthenticatedContext(context());
  assert.equal((await noActivation.service.evaluatePrivateTestEligibility(
    authenticatedWithoutActivation.authenticated_context,
  )).allowed, false);
});

test('expired, revoked, wrong-purpose, wrong-environment, subject, scope, or epoch approval denies', async () => {
  const baseApproval = activeSnapshot().approvals[0][1];
  const variants = [
    { expires_at: '2026-07-27T20:59:59.000Z' },
    { status: 'REVOKED' },
    { purpose: 'UNREVIEWED_PURPOSE' },
    { environment_id: 'different_environment' },
    { subscriber_subject_ref: 'different_subject' },
    { exact_scope_hash: 'd'.repeat(64) },
    { security_epoch: 2 },
  ];
  for (const variant of variants) {
    const snapshot = activeSnapshot({
      approvals: [[`${subscriberSubjectRef}|${scopeHash}`, { ...baseApproval, ...variant }]],
    });
    const { service } = configuredService(snapshot);
    const authenticated = await service.resolveAuthenticatedContext(context());
    assert.equal((await service.evaluatePrivateTestEligibility(
      authenticated.authenticated_context,
    )).allowed, false);
  }
});

test('emergency disable and every non-healthy state deny authentication or eligibility', async () => {
  const emergency = configuredService(activeSnapshot(), { emergency_disabled: true });
  assert.equal((await emergency.service.resolveAuthenticatedContext(context())).code, 'EMERGENCY_DISABLED');

  for (const availability of ['DEGRADED', 'UNAVAILABLE', 'PARTITIONED', 'RECOVERING']) {
    const { service } = configuredService({ ...activeSnapshot(), availability });
    assert.equal((await service.resolveAuthenticatedContext(context())).allowed, false, availability);
  }
});

test('approval revocation and epoch advance eliminate eligibility without runtime authority', async () => {
  const { backend, service } = configuredService();
  const authenticated = await service.resolveAuthenticatedContext(context());
  backend.approvals.set(`${subscriberSubjectRef}|${scopeHash}`, {
    ...backend.approvals.get(`${subscriberSubjectRef}|${scopeHash}`),
    status: 'REVOKED',
  });
  assert.equal((await service.evaluatePrivateTestEligibility(
    authenticated.authenticated_context,
  )).allowed, false);

  backend.approvals.set(`${subscriberSubjectRef}|${scopeHash}`, activeSnapshot().approvals[0][1]);
  backend.security_epochs.set(scopeHash, 2);
  assert.equal((await service.evaluatePrivateTestEligibility(
    authenticated.authenticated_context,
  )).code, 'SUBJECT_MAPPING_STALE');
});

test('runtime subject resolution contains no canonical bind command', async () => {
  const source = await readFile(
    new URL('../src/lib/intelligenceFabric/coachConnect/privateRuntime/canonicalAsyncSecurityService.js', import.meta.url),
    'utf8',
  );
  const resolutionMethod = source.slice(
    source.indexOf('async resolveAuthenticatedContext'),
    source.indexOf('async evaluatePrivateTestEligibility'),
  );
  assert.equal(resolutionMethod.includes('BIND_APPROVED_CANONICAL_SUBJECT'), false);
  assert.equal(resolutionMethod.includes('executeAtomic'), false);
});
