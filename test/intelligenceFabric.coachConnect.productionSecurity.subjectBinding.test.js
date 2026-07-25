import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CanonicalSubscriberSubjectRegistry,
  createRatifiedSubscriberAuthorityPolicy,
  verifySubscriberAuthenticationAssertion,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js';

const scope = {
  tenant_id: 'tenant-subject',
  profile_id: 'profile-subject',
  business_id: 'business-subject',
  subscriber_id: 'subscriber-subject',
};
const policy = createRatifiedSubscriberAuthorityPolicy({
  issuer: 'https://more-synthetic.auth0.com/',
  audience: 'https://more.synthetic/subscriber',
}).policy;

async function verifiedAssertion(overrides = {}) {
  return verifySubscriberAuthenticationAssertion({
    assertion_reference: 'assertion-ref-001',
    expected_session_binding_reference: 'browser-binding-001',
    authority_policy: policy,
    verifier: async ({ expected_issuer, expected_audience, expected_session_binding_reference }) => ({
      subject_id: 'auth0|subscriber-001',
      issuer: expected_issuer,
      audience: expected_audience,
      authenticated_at: '2026-07-24T12:00:00.000Z',
      auth_strength: 'PASSWORD_MFA',
      security_version: 1,
      session_binding_reference: expected_session_binding_reference,
      status: 'VERIFIED',
      ...overrides,
    }),
  });
}

test('ratified Auth0 authority remains provider-neutral and live-provider-off', () => {
  assert.equal(policy.provider, 'AUTH0');
  assert.equal(policy.provider_neutral_internal_contract, true);
  assert.equal(policy.live_provider_enabled, false);
  assert.equal(policy.authorization_flow, 'AUTHORIZATION_CODE_WITH_PKCE');
});

test('injected verifier must prove exact issuer audience and browser binding', async () => {
  assert.equal((await verifiedAssertion()).ok, true);
  assert.equal((await verifiedAssertion({ audience: 'wrong-audience' })).code, 'SUBJECT_ASSERTION_INVALID');
  assert.equal((await verifySubscriberAuthenticationAssertion({
    assertion_reference: 'assertion-ref-001',
    authority_policy: policy,
    expected_session_binding_reference: 'browser-binding-001',
  })).code, 'SUBJECT_ASSERTION_REQUIRED');
});

test('canonical binding is immutable, exact-scope, non-email, and one-to-one', async () => {
  const assertion = (await verifiedAssertion()).assertion;
  const registry = new CanonicalSubscriberSubjectRegistry();
  const bound = registry.bind({ assertion, scope, now: '2026-07-24T12:00:00.000Z' });
  assert.equal(bound.ok, true);
  assert.equal(bound.subject.status, 'ACTIVE');
  assert.equal(bound.subject.reassignment_prohibited, true);
  assert.equal('email' in bound.subject, false);
  assert.equal('raw_token' in bound.subject, false);
  assert.equal(registry.bind({ assertion, scope, now: '2026-07-24T12:00:01.000Z' }).status, 'IDEMPOTENT_BINDING');
  assert.equal(registry.bind({
    assertion,
    scope: { ...scope, tenant_id: 'tenant-other' },
    now: '2026-07-24T12:00:02.000Z',
  }).code, 'SUBJECT_MAPPING_AMBIGUOUS');
  const otherAssertion = { ...assertion, subject_id: 'auth0|subscriber-002', assertion_reference: 'assertion-ref-002' };
  assert.equal(registry.bind({ assertion: otherAssertion, scope, now: '2026-07-24T12:00:03.000Z' }).code, 'SUBJECT_MAPPING_AMBIGUOUS');
});

test('recovery increments mapping and security versions without reassignment', async () => {
  const assertion = (await verifiedAssertion()).assertion;
  const registry = new CanonicalSubscriberSubjectRegistry();
  const bound = registry.bind({ assertion, scope, now: '2026-07-24T12:00:00.000Z' });
  const pending = registry.beginRecovery({
    issuer: assertion.issuer,
    subject_id: assertion.subject_id,
    authority_subject_ref: 'operator-security-reviewer',
    reason_code: 'ACCOUNT_RECOVERY',
    now: '2026-07-24T12:10:00.000Z',
  });
  assert.equal(pending.subject.status, 'RECOVERY_PENDING');
  assert.equal(pending.subject.mapping_version, bound.subject.mapping_version + 1);
  assert.equal(pending.subject.security_version, bound.subject.security_version + 1);
  assert.equal(registry.resolve({ assertion }).code, 'SUBJECT_MAPPING_STALE');
  const completed = registry.completeRecovery({
    issuer: assertion.issuer,
    subject_id: assertion.subject_id,
    recovery_id: pending.receipt.recovery_id,
    now: '2026-07-24T12:11:00.000Z',
  });
  assert.equal(completed.subject.status, 'ACTIVE');
  assert.equal(completed.subject.subscriber_subject_id, bound.subject.subscriber_subject_id);
});
