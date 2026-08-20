import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CanonicalSubjectMembershipRegistry,
  createBusinessMembership,
  createCanonicalCustomerSubject,
  membershipScope,
} from '../src/lib/subscriptionV1/index.js';
import { TEST_TIME, testMembership, testScope, testSubject } from './subscriptionV1.testFixtures.js';

function registryWithTwoBusinesses() {
  const registry = new CanonicalSubjectMembershipRegistry();
  const subject = testSubject();
  const first = testMembership();
  const second = testMembership({
    membership_id: 'membership_test_beta',
    profile_id: 'MM-TEST-PROFILE-BETA',
    business_id: 'business_test_beta',
  });
  assert.equal(registry.registerSubject(subject).ok, true);
  assert.equal(registry.registerMembership(first).ok, true);
  assert.equal(registry.registerMembership(second).ok, true);
  return { registry, subject, first, second };
}

test('AFW-01 canonical authenticated human resolves deterministically to one of N memberships', () => {
  const { registry, first, second } = registryWithTwoBusinesses();
  const auth = { issuer: 'https://identity.example.test', provider_subject: 'provider-subject-alpha' };
  const ambiguous = registry.resolve(auth);
  assert.equal(ambiguous.ok, false);
  assert.equal(ambiguous.code, 'MEMBERSHIP_SELECTION_REQUIRED');
  assert.deepEqual(ambiguous.candidate_membership_ids, [first.membership_id, second.membership_id].sort());
  const selected = registry.resolve({ ...auth, business_id: second.business_id });
  assert.equal(selected.ok, true);
  assert.equal(selected.scope.business_id, second.business_id);
  assert.equal(selected.profile_id_role, 'MEMBERSHIP_LOCATOR_ONLY');
  const byProfileCaseNormalized = registry.resolve({ ...auth, profile_id: second.profile_id.toLowerCase() });
  assert.equal(byProfileCaseNormalized.ok, true);
  assert.equal(byProfileCaseNormalized.scope.membership_id, second.membership_id);
});

test('AFW-01 wrong subject, membership, profile and scope fail closed', () => {
  const { registry, first } = registryWithTwoBusinesses();
  assert.equal(registry.resolve({ issuer: 'https://identity.example.test', provider_subject: 'wrong-subject', membership_id: first.membership_id }).code, 'CANONICAL_SUBJECT_NOT_ACTIVE');
  assert.equal(registry.resolve({ issuer: 'https://identity.example.test', provider_subject: 'provider-subject-alpha', membership_id: 'membership_unknown' }).code, 'GOVERNED_MEMBERSHIP_NOT_FOUND');
  assert.equal(registry.resolve({ issuer: 'https://identity.example.test', provider_subject: 'provider-subject-alpha', profile_id: 'MM-WRONG-PROFILE' }).code, 'GOVERNED_MEMBERSHIP_NOT_FOUND');
  const resolution = registry.resolve({ issuer: 'https://identity.example.test', provider_subject: 'provider-subject-alpha', membership_id: first.membership_id });
  const wrongScope = { ...membershipScope(first), business_id: 'business_cross_scope' };
  assert.equal(registry.authorizeScope(resolution, wrongScope).code, 'EXACT_MEMBERSHIP_SCOPE_DENIED');
});

test('AFW-01 a Profile ID cannot bind active memberships across canonical subjects', () => {
  const registry = new CanonicalSubjectMembershipRegistry();
  const firstSubject = testSubject();
  const secondSubject = createCanonicalCustomerSubject({
    subject_id: 'subject_test_beta',
    issuer: 'https://identity.example.test',
    provider_subject: 'provider-subject-beta',
    created_at: TEST_TIME,
  });
  assert.equal(registry.registerSubject(firstSubject).ok, true);
  assert.equal(registry.registerSubject(secondSubject).ok, true);
  assert.equal(registry.registerMembership(testMembership()).ok, true);
  const contaminated = createBusinessMembership({
    ...testScope({ subject_id: secondSubject.subject_id, membership_id: 'membership_cross_subject', business_id: 'business_cross_subject' }),
    created_at: TEST_TIME,
  });
  assert.equal(registry.registerMembership(contaminated).code, 'PROFILE_CROSS_SUBJECT_CONFLICT');
});

test('AFW-01 suspended membership and ambiguous recovery remain unavailable', () => {
  const registry = new CanonicalSubjectMembershipRegistry();
  assert.equal(registry.registerSubject(testSubject()).ok, true);
  assert.equal(registry.registerMembership(testMembership({ status: 'SUSPENDED' })).ok, true);
  const denied = registry.resolve({ issuer: 'https://identity.example.test', provider_subject: 'provider-subject-alpha' });
  assert.equal(denied.code, 'GOVERNED_MEMBERSHIP_NOT_FOUND');
  const recovery = registry.classifyLegacyBinding({ profile_id: 'MM-TEST-PROFILE-ALPHA' });
  assert.equal(recovery.ok, false);
  assert.equal(recovery.code, 'LEGACY_BINDING_RECONCILIATION_REQUIRED');
  assert.equal(recovery.fabricated, false);
});

test('AFW-01 registry never stores raw provider subjects', () => {
  const { registry } = registryWithTwoBusinesses();
  const serialized = JSON.stringify(registry.snapshot());
  assert.equal(serialized.includes('provider-subject-alpha'), false);
  assert.equal(registry.snapshot().raw_provider_subjects_stored, false);
});
