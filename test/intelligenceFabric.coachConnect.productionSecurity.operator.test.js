import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeOperatorAction,
  createRatifiedOperatorAuthorityPolicy,
  InMemorySharedSecurityState,
  validateOperatorSubject,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js';

const occurredAt = '2026-07-24T17:00:00.000Z';
const policy = createRatifiedOperatorAuthorityPolicy({
  issuer: 'https://operator.synthetic.example/',
  audience: 'coach-connect-operator',
}).policy;

function fixtures({
  roleIds = ['SECURITY_REVIEWER'],
  actions = ['READ_SECURITY_AUDIT'],
  dual = false,
} = {}) {
  const subject = {
    operator_subject_id: 'operator-subject-primary',
    issuer: policy.issuer,
    audience: policy.audience,
    created_at: '2026-07-24T16:00:00.000Z',
    status: 'ACTIVE',
    security_version: 1,
    role_ids: roleIds,
    revoked_at: null,
  };
  const session = {
    operator_session_id: 'operator-session-primary',
    operator_subject_id: subject.operator_subject_id,
    environment_id: 'production-synthetic',
    auth_strength: 'WEBAUTHN_MFA',
    issued_at: '2026-07-24T16:30:00.000Z',
    expires_at: '2026-07-24T18:00:00.000Z',
    idle_expires_at: '2026-07-24T17:30:00.000Z',
    status: 'ACTIVE',
    security_version: 1,
  };
  const entitlement = {
    entitlement_id: 'operator-entitlement-primary',
    operator_subject_id: subject.operator_subject_id,
    environment_scope: 'production-synthetic',
    tenant_scope_allowlist: ['tenant-synthetic'],
    action_allowlist: actions,
    requires_reason: true,
    requires_dual_control: dual,
    issued_by: 'operator-governance-authority',
    issued_at: '2026-07-24T16:00:00.000Z',
    expires_at: '2026-07-25T16:00:00.000Z',
    status: 'ACTIVE',
  };
  return { subject, session, entitlement };
}

function authorize(overrides = {}) {
  const base = fixtures();
  return authorizeOperatorAction({
    store: new InMemorySharedSecurityState(),
    policy,
    ...base,
    action: 'READ_SECURITY_AUDIT',
    tenant_id: 'tenant-synthetic',
    exact_scope_hash: 'scope-hash-operator',
    environment_id: 'production-synthetic',
    reason_code: 'SECURITY_REVIEW',
    approver_subjects: [],
    occurred_at: occurredAt,
    correlation_id: 'operator-correlation-001',
    ...overrides,
  });
}

test('isolated named WebAuthn operator identity allows exact attributable scope only', () => {
  assert.equal(policy.provider, 'AUTH0');
  assert.equal(policy.invite_only, true);
  assert.equal(policy.named_accounts_only, true);
  assert.equal(policy.required_auth_strength, 'WEBAUTHN_MFA');
  assert.equal(policy.workforce_federation_required, false);
  assert.equal(policy.live_provider_enabled, false);
  const store = new InMemorySharedSecurityState();
  const decision = authorizeOperatorAction({
    store,
    policy,
    ...fixtures(),
    action: 'READ_SECURITY_AUDIT',
    tenant_id: 'tenant-synthetic',
    exact_scope_hash: 'scope-hash-operator',
    environment_id: 'production-synthetic',
    reason_code: 'SECURITY_REVIEW',
    approver_subjects: [],
    occurred_at: occurredAt,
    correlation_id: 'operator-correlation-allowed',
  });
  assert.equal(decision.allowed, true);
  assert.equal(store.auditSnapshot().length, 1);
  assert.equal(store.auditSnapshot()[0].subject_ref, 'operator-subject-primary');
});

test('unauthenticated revoked stale wrong-tenant wrong-environment and weak-MFA operator attempts deny', () => {
  const base = fixtures();
  const attacks = [
    { subject: { ...base.subject, status: 'REVOKED', revoked_at: occurredAt } },
    { session: { ...base.session, status: 'REVOKED' } },
    { session: { ...base.session, security_version: 2 } },
    { tenant_id: 'tenant-other' },
    { environment_id: 'environment-other' },
    { session: { ...base.session, auth_strength: 'PASSWORD_ONLY' } },
    { entitlement: { ...base.entitlement, status: 'REVOKED' } },
  ];
  for (const attack of attacks) assert.equal(authorize({ ...base, ...attack }).allowed, false);
  assert.equal(authorize({ ...base, reason_code: '' }).failure_code, 'OPERATOR_REASON_REQUIRED');
});

test('SUBDEV1 and developer capability identities cannot become operator authority', () => {
  const base = fixtures();
  const developerSubject = {
    ...base.subject,
    operator_subject_id: 'SUBDEV1',
  };
  assert.equal(validateOperatorSubject(developerSubject).valid, false);
  const decision = authorize({
    ...base,
    subject: developerSubject,
    session: { ...base.session, operator_subject_id: 'SUBDEV1' },
    entitlement: { ...base.entitlement, operator_subject_id: 'SUBDEV1' },
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.failure_code, 'OPERATOR_AUTHENTICATION_REQUIRED');
  assert.equal(policy.subdev1_operator_authority, false);
});

test('dual-control deletion requires a distinct active approver', () => {
  const base = fixtures({
    roleIds: ['PRIVACY_OPERATOR'],
    actions: ['EXECUTE_DELETION_PLAN'],
    dual: true,
  });
  const denied = authorize({
    ...base,
    action: 'EXECUTE_DELETION_PLAN',
    approver_subjects: [],
  });
  assert.equal(denied.allowed, false);
  assert.equal(denied.failure_code, 'OPERATOR_DUAL_CONTROL_REQUIRED');
  const allowed = authorize({
    ...base,
    action: 'EXECUTE_DELETION_PLAN',
    approver_subjects: [{
      operator_subject_id: 'operator-subject-approver',
      status: 'ACTIVE',
    }],
  });
  assert.equal(allowed.allowed, true);
  assert.deepEqual(allowed.approver_refs, ['operator-subject-approver']);
});

test('audit failure fails even an otherwise valid operator decision closed', () => {
  const store = new InMemorySharedSecurityState();
  store.setAvailability('UNAVAILABLE');
  const decision = authorizeOperatorAction({
    store,
    policy,
    ...fixtures(),
    action: 'READ_SECURITY_AUDIT',
    tenant_id: 'tenant-synthetic',
    exact_scope_hash: 'scope-hash-operator',
    environment_id: 'production-synthetic',
    reason_code: 'SECURITY_REVIEW',
    approver_subjects: [],
    occurred_at: occurredAt,
    correlation_id: 'operator-correlation-audit-failure',
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.failure_code, 'OPERATOR_AUDIT_FAILED');
});
