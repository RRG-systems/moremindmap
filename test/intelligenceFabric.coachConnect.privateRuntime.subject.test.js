import test from 'node:test';
import assert from 'node:assert/strict';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';
import {
  PRIVATE_RUNTIME_CONTRACT_VERSIONS,
  exactPrivateRuntimeScope,
  externalSubscriberSubjectReference,
  hashPrivateRuntimeScope,
  validatePrivateRuntimeTesterApproval,
  validatePrivateRuntimeVerifiedAssertion,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/contracts.js';
import {
  bindApprovedPrivateRuntimeCanonicalSubject,
  resolvePrivateRuntimeCanonicalSubject,
  validateCanonicalSubjectRegistryPort,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/subjectRegistryPort.js';

const now = '2026-07-27T16:00:00.000Z';
const scope = {
  tenant_id: 'tenant_synthetic_alpha',
  profile_id: 'profile_synthetic_alpha',
  business_id: 'business_synthetic_alpha',
  subscriber_id: 'subscriber_synthetic_alpha',
};
const assertion = {
  schema_version: PRIVATE_RUNTIME_CONTRACT_VERSIONS.verifiedAssertion,
  assertion_reference: 'assertion_synthetic_alpha',
  subject_id: 'provider_subject_synthetic_alpha',
  issuer: 'https://issuer.synthetic.invalid/',
  audience: 'private_runtime_synthetic',
  auth_strength: 'MFA_SYNTHETIC',
  session_binding_reference: 'browser_binding_synthetic_alpha',
  authenticated_at: '2026-07-27T15:59:00.000Z',
  security_version: 1,
  status: 'VERIFIED',
};
const approval = {
  approval_version: PRIVATE_RUNTIME_CONTRACT_VERSIONS.testerApproval,
  approval_id: 'approval_synthetic_alpha',
  environment_id: 'environment_synthetic_alpha',
  tester_subject_ref: externalSubscriberSubjectReference(assertion),
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

function createRegistry(snapshot = null) {
  const byExternal = new Map(snapshot?.byExternal || []);
  const byCanonical = new Map(snapshot?.byCanonical || []);
  const byScope = new Map(snapshot?.byScope || []);
  const recoveries = new Map(snapshot?.recoveries || []);
  const externalKey = (issuer, subjectId) => hashCanonicalJson({ issuer, subject_id: subjectId });
  return {
    async resolveExternalSubject(issuer, subjectId) {
      const subject = byExternal.get(externalKey(issuer, subjectId));
      return subject ? { ok: true, subject: structuredClone(subject) } : { ok: false, code: 'SUBJECT_MAPPING_NOT_FOUND' };
    },
    async resolveCanonicalSubject(subjectId) {
      const subject = byCanonical.get(subjectId);
      return subject ? { ok: true, subject: structuredClone(subject) } : { ok: false, code: 'SUBJECT_MAPPING_NOT_FOUND' };
    },
    async resolveExactScope(tenantId, profileId, businessId, subscriberId) {
      const key = hashPrivateRuntimeScope({
        tenant_id: tenantId,
        profile_id: profileId,
        business_id: businessId,
        subscriber_id: subscriberId,
      });
      const subjectId = byScope.get(key);
      return subjectId ? { ok: true, subject: structuredClone(byCanonical.get(subjectId)) } : { ok: false, code: 'SUBJECT_MAPPING_NOT_FOUND' };
    },
    async atomicBindExternalSubjectToExactScope(inputAssertion, inputScope) {
      const key = externalKey(inputAssertion.issuer, inputAssertion.subject_id);
      const scopeHash = hashPrivateRuntimeScope(inputScope);
      const prior = byExternal.get(key);
      if (prior) {
        return prior.exact_scope_hash === scopeHash
          ? { ok: true, status: 'IDEMPOTENT_BINDING', subject: structuredClone(prior) }
          : { ok: false, code: 'SUBJECT_MAPPING_AMBIGUOUS' };
      }
      if (byScope.has(scopeHash)) return { ok: false, code: 'SUBJECT_MAPPING_AMBIGUOUS' };
      const subject = {
        subscriber_subject_id: `canonical_subject_${hashCanonicalJson({ key, scopeHash }).slice(0, 32)}`,
        external_subject_id: inputAssertion.subject_id,
        issuer: inputAssertion.issuer,
        audience: inputAssertion.audience,
        exact_scope: structuredClone(inputScope),
        exact_scope_hash: scopeHash,
        mapping_version: 1,
        security_version: inputAssertion.security_version,
        status: 'ACTIVE',
      };
      byExternal.set(key, subject);
      byCanonical.set(subject.subscriber_subject_id, subject);
      byScope.set(scopeHash, subject.subscriber_subject_id);
      return { ok: true, status: 'BOUND', subject: structuredClone(subject) };
    },
    async beginSubjectRecovery(subjectRef, authority, reason) {
      const subject = byCanonical.get(subjectRef);
      if (!subject || !authority || !reason) return { ok: false, code: 'SUBJECT_MAPPING_NOT_FOUND' };
      const next = { ...subject, status: 'RECOVERY_PENDING', mapping_version: subject.mapping_version + 1, security_version: subject.security_version + 1 };
      byCanonical.set(subjectRef, next);
      byExternal.set(externalKey(next.issuer, next.external_subject_id), next);
      const recoveryRef = `recovery_${hashCanonicalJson({ subjectRef, authority, reason }).slice(0, 32)}`;
      recoveries.set(recoveryRef, subjectRef);
      return { ok: true, recovery_ref: recoveryRef, subject: structuredClone(next) };
    },
    async completeSubjectRecovery(recoveryRef, authority) {
      const subjectRef = recoveries.get(recoveryRef);
      const subject = byCanonical.get(subjectRef);
      if (!subject || !authority || subject.status !== 'RECOVERY_PENDING') return { ok: false, code: 'SUBJECT_MAPPING_STALE' };
      const next = { ...subject, status: 'ACTIVE' };
      byCanonical.set(subjectRef, next);
      byExternal.set(externalKey(next.issuer, next.external_subject_id), next);
      return { ok: true, subject: structuredClone(next) };
    },
    async disableSubject(subjectRef) {
      const subject = byCanonical.get(subjectRef);
      if (!subject) return { ok: false, code: 'SUBJECT_MAPPING_NOT_FOUND' };
      const next = { ...subject, status: 'DISABLED', security_version: subject.security_version + 1 };
      byCanonical.set(subjectRef, next);
      byExternal.set(externalKey(next.issuer, next.external_subject_id), next);
      return { ok: true, subject: structuredClone(next) };
    },
    health() { return { ok: true, state: 'SYNTHETIC_HEALTHY' }; },
    describeCapability() {
      return {
        provider_neutral: true,
        atomic_one_to_one_binding: true,
        auto_enrollment: false,
        deployment_grade: false,
        production_connection: false,
      };
    },
    snapshot() {
      return {
        byExternal: [...byExternal.entries()],
        byCanonical: [...byCanonical.entries()],
        byScope: [...byScope.entries()],
        recoveries: [...recoveries.entries()],
      };
    },
  };
}

const bindInput = (registry, overrides = {}) => ({
  registry,
  assertion,
  approval,
  scope,
  environmentId: approval.environment_id,
  receiptId: 'subject_receipt_synthetic_alpha',
  policyVersion: 'private_runtime_subject_policy_v1',
  correlationId: 'correlation_synthetic_alpha',
  now,
  ...overrides,
});

test('strict assertion, approval, and exact four-key scope contracts validate', () => {
  assert.equal(validatePrivateRuntimeVerifiedAssertion(assertion, { now: Date.parse(now) }).valid, true);
  assert.equal(validatePrivateRuntimeTesterApproval(approval, {
    assertion,
    scope,
    environmentId: approval.environment_id,
    now: Date.parse(now),
  }).valid, true);
  assert.equal(exactPrivateRuntimeScope(scope), true);
  assert.equal(exactPrivateRuntimeScope({ ...scope, subscription_id: 'not_identity' }), false);
});

test('approved explicit enrollment binds once and identical enrollment is idempotent', async () => {
  const registry = createRegistry();
  assert.equal(validateCanonicalSubjectRegistryPort(registry).valid, true);
  const first = await bindApprovedPrivateRuntimeCanonicalSubject(bindInput(registry));
  assert.equal(first.ok, true);
  assert.equal(first.status, 'BOUND');
  const repeat = await bindApprovedPrivateRuntimeCanonicalSubject(bindInput(registry, { receiptId: 'subject_receipt_synthetic_repeat' }));
  assert.equal(repeat.ok, true);
  assert.equal(repeat.status, 'IDEMPOTENT_BINDING');
  assert.equal(repeat.subject.subscriber_subject_id, first.subject.subscriber_subject_id);
  assert.equal(registry.snapshot().byCanonical.length, 1);
});

test('both subject-to-two-scopes and two-subjects-to-one-scope conflicts deny atomically', async () => {
  const registry = createRegistry();
  assert.equal((await bindApprovedPrivateRuntimeCanonicalSubject(bindInput(registry))).ok, true);
  const otherScope = { ...scope, business_id: 'business_synthetic_other' };
  const otherScopeApproval = { ...approval, exact_scope_hash: hashPrivateRuntimeScope(otherScope) };
  const firstConflict = await bindApprovedPrivateRuntimeCanonicalSubject(bindInput(registry, {
    scope: otherScope,
    approval: otherScopeApproval,
    receiptId: 'subject_receipt_conflict_one',
  }));
  assert.equal(firstConflict.code, 'SUBJECT_MAPPING_AMBIGUOUS');

  const otherAssertion = { ...assertion, subject_id: 'provider_subject_synthetic_other', assertion_reference: 'assertion_synthetic_other' };
  const otherApproval = { ...approval, tester_subject_ref: externalSubscriberSubjectReference(otherAssertion) };
  const secondConflict = await bindApprovedPrivateRuntimeCanonicalSubject(bindInput(registry, {
    assertion: otherAssertion,
    approval: otherApproval,
    receiptId: 'subject_receipt_conflict_two',
  }));
  assert.equal(secondConflict.code, 'SUBJECT_MAPPING_AMBIGUOUS');
  assert.equal(registry.snapshot().byCanonical.length, 1);
});

test('resolution never auto-enrolls and requires a pre-existing exact mapping', async () => {
  const registry = createRegistry();
  const missing = await resolvePrivateRuntimeCanonicalSubject({
    registry,
    assertion,
    expectedIssuer: assertion.issuer,
    expectedAudience: assertion.audience,
    expectedSessionBindingReference: assertion.session_binding_reference,
    scope,
    environmentId: approval.environment_id,
    receiptId: 'subject_receipt_resolution_missing',
    policyVersion: 'private_runtime_subject_policy_v1',
    correlationId: 'correlation_resolution_missing',
    now,
  });
  assert.equal(missing.code, 'SUBJECT_MAPPING_NOT_FOUND');
  assert.equal(registry.snapshot().byCanonical.length, 0);
});

test('snapshot restart, versioned recovery, disable, and stale assertions fail closed', async () => {
  const registry = createRegistry();
  const bound = await bindApprovedPrivateRuntimeCanonicalSubject(bindInput(registry));
  const restarted = createRegistry(registry.snapshot());
  const recovery = await restarted.beginSubjectRecovery(bound.subject.subscriber_subject_id, 'authority_synthetic', 'ROTATE');
  assert.equal(recovery.subject.mapping_version, 2);
  assert.equal(recovery.subject.security_version, 2);
  const pending = await resolvePrivateRuntimeCanonicalSubject({
    registry: restarted,
    assertion: { ...assertion, security_version: 2 },
    expectedIssuer: assertion.issuer,
    expectedAudience: assertion.audience,
    expectedSessionBindingReference: assertion.session_binding_reference,
    scope,
    environmentId: approval.environment_id,
    receiptId: 'subject_receipt_pending',
    policyVersion: 'private_runtime_subject_policy_v1',
    correlationId: 'correlation_pending',
    now,
  });
  assert.equal(pending.code, 'SUBJECT_DISABLED');
  const completed = await restarted.completeSubjectRecovery(recovery.recovery_ref, 'authority_synthetic');
  assert.equal(completed.subject.status, 'ACTIVE');
  const stale = await resolvePrivateRuntimeCanonicalSubject({
    registry: restarted,
    assertion,
    expectedIssuer: assertion.issuer,
    expectedAudience: assertion.audience,
    expectedSessionBindingReference: assertion.session_binding_reference,
    scope,
    environmentId: approval.environment_id,
    receiptId: 'subject_receipt_stale',
    policyVersion: 'private_runtime_subject_policy_v1',
    correlationId: 'correlation_stale',
    now,
  });
  assert.equal(stale.code, 'SUBJECT_MAPPING_STALE');
  await restarted.disableSubject(bound.subject.subscriber_subject_id);
  const disabled = await restarted.resolveExternalSubject(assertion.issuer, assertion.subject_id);
  assert.equal(disabled.subject.status, 'DISABLED');
});

test('issuer, audience, status, version, expiry, and authority-bearing unknown fields deny', () => {
  for (const candidate of [
    { ...assertion, issuer: 'https://wrong.synthetic.invalid/' },
    { ...assertion, audience: 'wrong_audience' },
    { ...assertion, status: 'UNVERIFIED' },
    { ...assertion, security_version: 0 },
    { ...assertion, raw_token: 'forbidden' },
    { ...assertion, email: 'forbidden@example.invalid' },
    { ...assertion, name: 'Forbidden Name' },
    { ...assertion, profile_id: scope.profile_id },
    { ...assertion, subject_id: 'https://subject.invalid/' },
    { ...assertion, subject_id: 'SUBDEV1' },
  ]) {
    assert.equal(validatePrivateRuntimeVerifiedAssertion(candidate, {
      expectedIssuer: assertion.issuer,
      expectedAudience: assertion.audience,
      now: Date.parse(now),
    }).valid, false);
  }
  assert.equal(validatePrivateRuntimeTesterApproval({
    ...approval,
    expires_at: '2026-07-27T15:59:59.000Z',
  }, { assertion, scope, environmentId: approval.environment_id, now: Date.parse(now) }).errors[0].code, 'PRIVATE_TESTER_APPROVAL_EXPIRED');
});

test('subject receipts contain hashes and opaque references, never raw assertion or product content', async () => {
  const result = await bindApprovedPrivateRuntimeCanonicalSubject(bindInput(createRegistry()));
  const serialized = JSON.stringify(result.receipt);
  assert.equal(result.receipt.subject_receipt_version, PRIVATE_RUNTIME_CONTRACT_VERSIONS.subjectReceipt);
  assert.match(result.receipt.assertion_ref_hash, /^[a-f0-9]{64}$/);
  assert.equal(serialized.includes(assertion.assertion_reference), false);
  for (const forbidden of ['raw_token', 'cookie', 'credential', 'email', 'business_engine_payload', 'SUBDEV1']) {
    assert.equal(serialized.includes(forbidden), false);
  }
});
