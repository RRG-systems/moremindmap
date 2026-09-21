import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { MemoryPublicStore } from '../src/lib/publicSiteAirlockV1/memoryStore.js';
import { normalizeProfileOwnershipReturnPath } from '../src/lib/publicSiteAirlockV1/profileOwnership.js';
import { createPublicSiteService } from '../src/lib/publicSiteAirlockV1/service.js';

const profileId = 'mm-20260921-a1b2c3d4';
const grantId = 'grant_cs_test_existing_subscription_entry';
const scope = Object.freeze({
  subject_id: 'subject_existing_subscription_entry',
  membership_id: 'membership_existing_subscription_entry',
  tenant_id: 'tenant_existing_subscription_entry',
  profile_id: profileId,
  business_id: 'business_existing_subscription_entry',
});

function activeEntitlement() {
  return {
    contract_id: 'paid_entitlement',
    schema_version: '1.1.0',
    entitlement_id: 'entitlement_existing_subscription_entry',
    scope,
    stripe_customer_hash: 'a'.repeat(64),
    stripe_subscription_hash: 'b'.repeat(64),
    state: 'ACTIVE',
    billing_cycle_start: '2026-09-01T00:00:00.000Z',
    billing_cycle_end: '2026-10-01T00:00:00.000Z',
    access_ends_at: null,
    source_event_ids: ['evt_existing_subscription_entry'],
    projected_at: '2026-09-21T12:00:00.000Z',
    policy_version: 'retrieval_entry_repair_test_v1',
  };
}

function buildService(overrides = {}) {
  const store = overrides.store || new MemoryPublicStore();
  return {
    store,
    service: createPublicSiteService({
      store,
      startSigningKey: 'retrieval-entry-repair-signing-key-at-least-32-characters',
      ownershipVerifier: async () => true,
      profileStateReader: async () => ({ bos: 'ready', ba: 'ready' }),
      monthlyEntitlementResolver: async () => activeEntitlement(),
      subscriptionDestination: '/subscription',
      clock: () => Date.parse('2026-09-21T12:00:00.000Z'),
      ...overrides,
    }),
  };
}

test('ownership return paths preserve BA retrieval and Subscription intent without accepting open redirects', () => {
  assert.equal(
    normalizeProfileOwnershipReturnPath('/step-2?continue=retrieval'),
    '/step-2?continue=retrieval',
  );
  assert.equal(normalizeProfileOwnershipReturnPath('/step-3'), '/step-3');
  assert.equal(
    normalizeProfileOwnershipReturnPath('/step-3?next=https://attacker.example.test'),
    '/step-1',
  );
});

test('Subscription entry does not reveal whether a Profile has paid access before ownership verification', async () => {
  const { service } = buildService({ ownershipVerifier: async () => false });
  assert.deepEqual(
    await service.enterMonthlySubscription({ profile_id: profileId }),
    { state: 'ownership_verification_required' },
  );
});

test('a verified Profile without an active Subscription proceeds to the governed checkout decision', async () => {
  const { service } = buildService();
  assert.deepEqual(await service.enterMonthlySubscription({ profile_id: profileId }), {
    state: 'not_subscribed',
    profile_id: profileId,
    behavior_operating_system_state: 'ready',
    business_assessment_state: 'ready',
    ownership_verified: true,
  });
});

test('homepage BA lookup recognizes exact saved current-product custody without generation', async () => {
  const store = new MemoryPublicStore();
  const assessmentId = 'ba-20260921-a1b2c3d4';
  const assessment = { assessment_id: assessmentId, owner_profile_id: profileId };
  await store.set(`business_assessment_by_profile:${profileId}`, assessmentId);
  await store.set(`business_assessment:${assessmentId}`, JSON.stringify(assessment));
  let readinessReads = 0;
  const { service } = buildService({
    store,
    profileStateReader: async () => ({ bos: 'ready', ba: 'pending' }),
    currentBusinessAssessmentReadinessReader: async (input) => {
      readinessReads += 1;
      assert.deepEqual(input, { profile_id: profileId, assessment });
      return { ready: true, mutation_performed: false };
    },
  });
  assert.deepEqual(await service.lookupEntry({
    value: profileId,
    product_key: 'business_assessment',
  }), {
    state: 'ready',
    profile_id: profileId,
    behavior_operating_system_state: 'ready',
    business_assessment_state: 'ready',
    ownership_verified: true,
    destination: '/business-assessment',
  });
  assert.equal(readinessReads, 1);
});

test('a verified active subscriber receives only the existing governed Subscription start path', async () => {
  const { store, service } = buildService();
  await store.set(`access_grant:${grantId}`, JSON.stringify({
    grant_id: grantId,
    contract_version: 'mmm-public-access-v1',
    product_key: 'more_monthly_intelligence',
    profile_id: profileId,
    status: 'active',
    source: 'paid_stripe',
    scope,
  }));
  await store.sadd(`access_grant_by_profile:${profileId}`, grantId);

  const entry = await service.enterMonthlySubscription(
    { profile_id: profileId },
    { cookie_header: 'verified-owner-receipt' },
  );
  assert.equal(entry.state, 'ready');
  assert.equal(entry.profile_id, profileId);
  assert.equal(entry.destination, '/subscription');
  assert.ok(entry.start_token);
  assert.equal(entry.idempotent, false);

  const replay = await service.enterMonthlySubscription(
    { profile_id: profileId },
    { cookie_header: 'verified-owner-receipt' },
  );
  assert.equal(replay.destination, '/subscription');
  assert.equal(replay.start_token, entry.start_token);
  assert.equal(replay.idempotent, true);
});

test('ambiguous active Subscription grants fail closed instead of selecting customer authority', async () => {
  const { store, service } = buildService();
  for (const id of [grantId, `${grantId}_duplicate`]) {
    await store.set(`access_grant:${id}`, JSON.stringify({
      grant_id: id,
      product_key: 'more_monthly_intelligence',
      profile_id: profileId,
      status: 'active',
      scope,
    }));
    await store.sadd(`access_grant_by_profile:${profileId}`, id);
  }
  await assert.rejects(
    service.enterMonthlySubscription({ profile_id: profileId }),
    /paid_entitlement_reconciliation_required/u,
  );
});

test('public UI preserves exact BA retrieval continuation and uses the governed Subscription entry action', () => {
  const source = readFileSync(new URL('../src/PublicSiteV21.jsx', import.meta.url), 'utf8');
  assert.match(source, /requestProfileOwnership\(profileId, '\/step-2\?continue=retrieval'\)/u);
  assert.match(source, /continuation === 'retrieval'/u);
  assert.match(source, /messageSurface === 'retrieval'/u);
  assert.match(source, /onFailureRef\.current/u);
  assert.match(source, /retrievalReturn \? \{ messageSurface: 'retrieval' \}/u);
  assert.match(source, /action: 'enter_subscription'/u);
  assert.match(source, /requestProfileOwnership\(profileId, '\/step-3'\)/u);
  assert.doesNotMatch(source, /Subscription checkout is not open in this candidate/u);
});
