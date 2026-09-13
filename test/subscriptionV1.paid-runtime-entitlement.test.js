import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PAID_RUNTIME_NAMESPACE,
  paidRuntimeKeys,
  resolvePaidEntitlementFromStore,
} from '../api/engine/subscriptionV1/paidRuntimeInfrastructure.js';
import { accessGrantByMembershipKey, accessGrantKey, subscriptionStateKey } from '../api/stripe/shared.js';

class MemoryRedis {
  constructor() { this.values = new Map(); this.sets = new Map(); }
  async get(key) { return this.values.get(key) ?? null; }
  async set(key, value) { this.values.set(key, String(value)); return 'OK'; }
  async sadd(key, value) { const set = this.sets.get(key) || new Set(); set.add(value); this.sets.set(key, set); return 1; }
  async smembers(key) { return [...(this.sets.get(key) || [])]; }
}

const scope = Object.freeze({
  subject_id: 'subject_paid_synthetic_0001',
  membership_id: 'membership_paid_synthetic_0001',
  tenant_id: 'tenant_paid_synthetic_0001',
  profile_id: 'mm-20260911-a1b2c3d4',
  business_id: 'business_paid_synthetic_0001',
});

async function seed(redis, overrides = {}) {
  const grantId = 'grant_cs_test_paid_synthetic_0001';
  await redis.set(accessGrantKey(grantId), JSON.stringify({
    grant_id: grantId,
    product_key: 'more_monthly_intelligence',
    access_type: 'more_monthly_intelligence',
    membership_verified: true,
    binding_source: 'AUTHENTICATED_SERVER_CONTEXT',
    scope,
    membership_id: scope.membership_id,
    subscription_id: 'sub_paid_synthetic_0001',
    customer_id: 'cus_paid_synthetic_0001',
  }));
  await redis.sadd(accessGrantByMembershipKey(scope.membership_id), grantId);
  await redis.set(subscriptionStateKey('sub_paid_synthetic_0001'), JSON.stringify({
    subscription_id: 'sub_paid_synthetic_0001',
    customer_id: 'cus_paid_synthetic_0001',
    status: 'active',
    payment_status: 'paid',
    current_period_start: 1788220800,
    current_period_end: 1790812800,
    cancel_at_period_end: false,
    lifecycle_stripe_created: 1788220801,
    lifecycle_stripe_event_id: 'evt_subscription_active_0001',
    lifecycle_stripe_event_type: 'customer.subscription.updated',
    payment_stripe_created: 1788220802,
    payment_stripe_event_id: 'evt_invoice_paid_0001',
    payment_stripe_event_type: 'invoice.paid',
    membership_metadata: {
      subject_id: scope.subject_id,
      membership_id: scope.membership_id,
      tenant_id: scope.tenant_id,
      profile_id: scope.profile_id,
      business_id: scope.business_id,
      binding_source: 'AUTHENTICATED_SERVER_CONTEXT',
      membership_verified: 'true',
    },
    ...overrides,
  }));
}

test('paid runtime keys use an isolated stable membership scope without calendar expiry', () => {
  const keys = paidRuntimeKeys({ scope });
  assert.equal(Object.values(keys).filter((value) => typeof value === 'string').every((value) => value === keys.scope_hash || value.startsWith(PAID_RUNTIME_NAMESPACE)), true);
  assert.equal(keys.allowance.includes(new Date().toISOString().slice(0, 7)), false);
  assert.notEqual(keys.living_state, keys.allowance);
});

test('stored signed lifecycle projects an exact active paid entitlement', async () => {
  const redis = new MemoryRedis();
  await seed(redis);
  const entitlement = await resolvePaidEntitlementFromStore({ redis, scope, now: new Date('2026-09-12T00:00:00.000Z') });
  assert.equal(entitlement.state, 'ACTIVE');
  assert.deepEqual(entitlement.scope, scope);
  assert.equal(entitlement.policy_version, 'subscription_v1_stripe_stored_lifecycle_v1');
});

test('payment failure suspends paid coaching while lifecycle truth and durable scope remain intact', async () => {
  const redis = new MemoryRedis();
  await seed(redis, { payment_status: 'failed', payment_stripe_event_type: 'invoice.payment_failed' });
  const entitlement = await resolvePaidEntitlementFromStore({ redis, scope, now: new Date('2026-09-12T00:00:00.000Z') });
  assert.equal(entitlement.state, 'SUSPENDED_PAYMENT');
  assert.deepEqual(entitlement.scope, scope);
});

test('current failed payment remains authoritative when a newer lifecycle event supplies subscription status', async () => {
  const redis = new MemoryRedis();
  await seed(redis, {
    payment_status: 'failed',
    payment_stripe_created: 1788220802,
    payment_stripe_event_type: 'invoice.payment_failed',
    lifecycle_stripe_created: 1788220803,
  });
  const entitlement = await resolvePaidEntitlementFromStore({ redis, scope, now: new Date('2026-09-12T00:00:00.000Z') });
  assert.equal(entitlement.state, 'SUSPENDED_PAYMENT');
  assert.deepEqual(entitlement.scope, scope);
});

test('missing, ambiguous or cross-scope lifecycle custody fails closed', async () => {
  await assert.rejects(resolvePaidEntitlementFromStore({ redis: new MemoryRedis(), scope }), /PAID_ENTITLEMENT_RECONCILIATION_REQUIRED/u);
  const redis = new MemoryRedis();
  await seed(redis, { membership_metadata: { membership_verified: 'false' } });
  await assert.rejects(resolvePaidEntitlementFromStore({ redis, scope }), /PAID_ENTITLEMENT_RECONCILIATION_REQUIRED/u);
});
