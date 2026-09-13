import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveAccessPaymentTruth } from '../api/stripe/access-status.js';
import { PUBLIC_ACCESS_CONTRACT_VERSION } from '../src/lib/publicSiteAirlockV1/contracts.js';
import { MemoryPublicStore } from '../src/lib/publicSiteAirlockV1/memoryStore.js';
import { createPublicRuntime } from '../src/lib/publicSiteAirlockV1/runtime.js';
import { publicSubscriptionAccessConfigured, runtimeFlags } from '../src/lib/publicSiteAirlockV1/security.js';
import { createPublicSiteService } from '../src/lib/publicSiteAirlockV1/service.js';

const nowMs = Date.parse('2026-09-12T18:00:00.000Z');
const scope = Object.freeze({
  subject_id: 'subject_paid_start_0001',
  membership_id: 'membership_paid_start_0001',
  tenant_id: 'tenant_paid_start_0001',
  profile_id: 'mm-20260912-paid0001',
  business_id: 'business_paid_start_0001',
});
const grant = Object.freeze({
  contract_version: PUBLIC_ACCESS_CONTRACT_VERSION,
  grant_id: 'grant_cs_test_paid_start_0001',
  product_key: 'more_monthly_intelligence',
  status: 'active',
  source: 'paid_stripe',
  checkout_session_id: 'cs_test_paid_start_0001',
  subscription_id: 'sub_paid_start_0001',
  customer_id: 'cus_paid_start_0001',
  profile_id: scope.profile_id,
  membership_id: scope.membership_id,
  membership_verified: true,
  binding_source: 'AUTHENTICATED_SERVER_CONTEXT',
  scope,
});

function entitlement(state = 'ACTIVE') {
  return {
    contract_id: 'paid_entitlement',
    schema_version: '1.1.0',
    entitlement_id: 'entitlement_paid_start_0001',
    scope,
    stripe_customer_hash: 'a'.repeat(64),
    stripe_subscription_hash: 'b'.repeat(64),
    state,
    billing_cycle_start: '2026-09-01T00:00:00.000Z',
    billing_cycle_end: '2026-10-01T00:00:00.000Z',
    access_ends_at: state === 'ACTIVE_CANCELING' ? '2026-10-01T00:00:00.000Z' : null,
    source_event_ids: ['evt_paid_start_0001'],
    projected_at: '2026-09-12T18:00:00.000Z',
    policy_version: 'subscription_v1_paid_start_test',
  };
}

async function seedGrant(store) {
  await store.set(`access_grant:${grant.grant_id}`, JSON.stringify(grant));
  await store.sadd(`access_grant_by_session:${grant.checkout_session_id}`, grant.grant_id);
}

function service(store, monthlyEntitlementResolver) {
  return createPublicSiteService({
    store,
    startSigningKey: 'synthetic-paid-start-signing-key-at-least-thirty-two-characters',
    subscriptionDestination: '/subscription',
    monthlyEntitlementResolver,
    clock: () => nowMs,
  });
}

test('monthly start-token exchange stays unavailable until exact paid lifecycle entitlement projects', async () => {
  const store = new MemoryPublicStore();
  await seedGrant(store);
  await assert.rejects(
    service(store, async () => { throw new Error('lifecycle_pending'); })
      .createStartTokenForSession({ checkout_session_id: grant.checkout_session_id }),
    /paid_entitlement_reconciliation_required/u,
  );
  assert.equal(await store.get(`public_product_v1:start_token_exchange:${grant.grant_id}`), null);

  await assert.rejects(
    service(store, async () => entitlement('SUSPENDED_PAYMENT'))
      .createStartTokenForGrant({ grant_id: grant.grant_id }),
    /paid_entitlement_reconciliation_required/u,
  );
  assert.equal(await store.get(`public_product_v1:start_token_exchange:${grant.grant_id}`), null);
});

test('active paid entitlement is rechecked at token issue and product start', async () => {
  const store = new MemoryPublicStore();
  await seedGrant(store);
  let state = 'ACTIVE';
  const runtime = service(store, async () => entitlement(state));
  const token = await runtime.createStartTokenForSession({ checkout_session_id: grant.checkout_session_id });
  state = 'SUSPENDED_PAYMENT';
  await assert.rejects(
    runtime.startProduct({ start_token: token.start_token }),
    /paid_entitlement_reconciliation_required/u,
  );
  assert.equal(await store.get(`public_product_v1:start:${grant.grant_id}`), null);

  state = 'ACTIVE';
  const started = await runtime.startProduct({ start_token: token.start_token });
  assert.equal(started.destination, '/subscription');
  assert.equal(started.profile_id, scope.profile_id);
});

test('checkout status reports monthly webhook confirmation only after usable lifecycle projection', async () => {
  const store = new MemoryPublicStore();
  assert.equal(await resolveAccessPaymentTruth({
    redis: store,
    grants: [grant],
    resolveMonthlyEntitlement: async () => { throw new Error('lifecycle_pending'); },
  }), 'lifecycle_pending');
  assert.equal(await resolveAccessPaymentTruth({
    redis: store,
    grants: [grant],
    resolveMonthlyEntitlement: async () => entitlement('SUSPENDED_PAYMENT'),
  }), 'lifecycle_pending');
  assert.equal(await resolveAccessPaymentTruth({
    redis: store,
    grants: [grant],
    resolveMonthlyEntitlement: async () => entitlement('ACTIVE'),
    now: new Date(nowMs),
  }), 'webhook_confirmed');
  assert.equal(await resolveAccessPaymentTruth({
    redis: store,
    grants: [{ ...grant, product_key: 'business_assessment' }],
  }), 'webhook_confirmed');
});

test('existing paid access remains available when new subscription sales are disabled', async () => {
  const store = new MemoryPublicStore();
  await seedGrant(store);
  const env = {
    PUBLIC_PRODUCT_START_ENFORCEMENT_ENABLED: 'true',
    PUBLIC_SUBSCRIPTION_RUNTIME_ENABLED: 'true',
    PUBLIC_SUBSCRIPTION_CHECKOUT_ENABLED: 'false',
    PUBLIC_CHECKOUT_ENABLED: 'false',
    PUBLIC_SUBSCRIPTION_DESTINATION: '/subscription',
    MOREMINDMAP_SERVER_ONLY_PRODUCT_START_SIGNING_KEY: 'synthetic-paid-start-signing-key-at-least-thirty-two-characters',
    REDIS_URL: 'redis://synthetic.example.test:6379',
  };
  assert.equal(runtimeFlags(env).subscription_checkout_enabled, false);
  assert.equal(publicSubscriptionAccessConfigured(env), true);
  const runtime = createPublicRuntime(env, {
    store,
    ownership: { verifyRequest: async () => false },
    monthlyEntitlementResolver: async () => entitlement('ACTIVE'),
    clock: () => nowMs,
  });
  const token = await runtime.service.createStartTokenForSession({
    checkout_session_id: grant.checkout_session_id,
  });
  const started = await runtime.service.startProduct({ start_token: token.start_token });
  assert.equal(started.destination, '/subscription');
});
