import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PAID_MEMBERSHIP_NAMESPACE,
  createPaidMembershipAuthority,
  persistPaidMembershipAuthority,
  resolvePaidMembershipAuthority,
} from '../api/stripe/paidMembership.js';
import { buildCustomerConfirmedVerticalBinding } from '../api/business-assessment/verticalBinding.js';
import { PRODUCTION_BA_CASSETTE_REGISTRY, buildCustomerConfirmedSelection } from '../src/lib/baVerticalCassettesV1/index.js';

class MemoryStore {
  constructor() { this.values = new Map(); }
  async get(key) { return this.values.get(key) ?? null; }
  async setNx(key, value) {
    if (this.values.has(key)) return false;
    this.values.set(key, value);
    return true;
  }
}

const profileId = 'mm-20260911-a1b2c3d4';
const owner = 'owner@example.test';
const profileState = { bos: 'ready', ba: 'ready' };
const realEstateSelection = buildCustomerConfirmedSelection(
  PRODUCTION_BA_CASSETTE_REGISTRY.resolveVertical('real_estate'),
);
const assessment = {
  assessment_id: 'ba-20260911-acde1234',
  owner_profile_id: profileId,
  vertical_binding: buildCustomerConfirmedVerticalBinding({
    selection: realEstateSelection,
    selectedAt: '2026-09-11T20:00:00.000Z',
  }),
};

function authority(overrides = {}) {
  return createPaidMembershipAuthority({
    provider_subject: owner,
    profile_id: profileId,
    profile_state: profileState,
    assessment,
    ownership_verified: true,
    created_at: '2026-09-11T20:00:00.000Z',
    ...overrides,
  });
}

test('paid membership authority is deterministic, server-owned and contains no raw owner identity', () => {
  const first = authority();
  const second = authority();
  assert.deepEqual(first, second);
  assert.equal(first.membership_binding.profile_id, profileId);
  assert.equal(first.membership_binding.assessment_id, assessment.assessment_id);
  assert.equal(first.membership_binding.binding_source, 'AUTHENTICATED_SERVER_CONTEXT');
  assert.equal(first.membership_binding.membership_verified, true);
  assert.equal(JSON.stringify(first).includes(owner), false);
  assert.equal(first.raw_provider_subject_stored, false);
});

test('paid membership requires verified ownership, completed BOS and BA, exact profile and confirmed vertical authority', () => {
  assert.throws(() => authority({ ownership_verified: false }), /profile_ownership_required/u);
  assert.throws(() => authority({ profile_state: { bos: 'ready', ba: 'pending' } }), /completed_bos_and_business_assessment_required/u);
  assert.throws(() => authority({ assessment: { ...assessment, owner_profile_id: 'mm-20260911-deadbeef' } }), /business_assessment_profile_mismatch/u);
  assert.throws(() => authority({ assessment: { ...assessment, vertical_binding: null } }), /business_assessment_vertical_authority_required/u);
});

test('paid identity persistence is durable, replay-safe and resolves only exact authenticated owner plus profile', async () => {
  const store = new MemoryStore();
  const bound = authority();
  assert.equal((await persistPaidMembershipAuthority(store, bound)).code, 'PAID_MEMBERSHIP_PERSISTED');
  assert.equal((await persistPaidMembershipAuthority(store, bound)).code, 'PAID_MEMBERSHIP_IDEMPOTENT_REPLAY');
  const resolved = await resolvePaidMembershipAuthority(store, { provider_subject: owner, profile_id: profileId });
  assert.equal(resolved.scope.membership_id, bound.membership.membership_id);
  assert.equal(resolved.profile_id_role, 'MEMBERSHIP_LOCATOR_ONLY');
  await assert.rejects(
    resolvePaidMembershipAuthority(store, { provider_subject: 'wrong@example.test', profile_id: profileId }),
    /governed_membership_not_found/u,
  );
  assert.equal([...store.values.keys()].every((key) => key.startsWith(PAID_MEMBERSHIP_NAMESPACE)), true);
  assert.equal(JSON.stringify([...store.values]).includes(owner), false);
});

test('paid identity persistence refuses profile cross-subject or immutable-record collisions', async () => {
  const store = new MemoryStore();
  const first = authority();
  await persistPaidMembershipAuthority(store, first);
  const second = authority({ provider_subject: 'other-owner@example.test' });
  await assert.rejects(persistPaidMembershipAuthority(store, second), /paid_profile_membership_collision/u);
  const subjectKey = [...store.values.keys()].find((key) => key.includes(':subject:'));
  store.values.set(subjectKey, '{}');
  await assert.rejects(persistPaidMembershipAuthority(store, first), /paid_subject_collision/u);
});
