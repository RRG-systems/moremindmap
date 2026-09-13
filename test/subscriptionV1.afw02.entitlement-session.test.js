import assert from 'node:assert/strict';
import test from 'node:test';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';
import {
  InMemoryAllowanceSessionLedger,
  entitlementAllowsCoaching,
  projectPaidEntitlement,
  reconcileLegacyAccessGrant,
} from '../src/lib/subscriptionV1/index.js';
import {
  MONTHLY_PRODUCT_KEY,
  resolveMonthlyAccessLookup,
  resolveMonthlyCheckoutBinding,
} from '../api/stripe/subscriptionV1Foundation.js';
import stripeWebhookHandler, { processEvent } from '../api/stripe/webhook.js';
import { accessGrantByMembershipKey, accessGrantKey } from '../api/stripe/shared.js';
import { resolveSubscriptionEntitlement } from '../api/internal/subscription-entitlement.js';
import { TEST_TIME, testScope, testStripeEvents } from './subscriptionV1.testFixtures.js';

const scope = testScope();
const requestContext = {
  authenticated: true,
  membership_verified: true,
  subject_id: scope.subject_id,
  membership_id: scope.membership_id,
  email: 'member@example.test',
  assessment_id: 'assessment_test_alpha',
  scope,
};

function entitlement(events = testStripeEvents(scope)) {
  const result = projectPaidEntitlement({ scope, stripe_events: events, projected_at: TEST_TIME });
  assert.equal(result.ok, true, result.code);
  return result.entitlement;
}

class FakeRedis {
  constructor() { this.values = new Map(); this.sets = new Map(); }
  async get(key) { return this.values.get(key) || null; }
  async set(key, value) { this.values.set(key, value); return 'OK'; }
  async setNx(key, value) {
    if (this.values.has(key)) return false;
    this.values.set(key, value);
    return true;
  }
  async compareDel(key, expected) {
    if (this.values.get(key) !== expected) return 0;
    this.values.delete(key);
    return 1;
  }
  async sadd(key, value) { const set = this.sets.get(key) || new Set(); set.add(value); this.sets.set(key, set); return 1; }
  async smembers(key) { return [...(this.sets.get(key) || [])]; }
}

test('AFW-02 monthly checkout/access identity is server-bound and default-off', () => {
  assert.equal(resolveMonthlyCheckoutBinding({ product_key: MONTHLY_PRODUCT_KEY, request_context: requestContext, enabled: false }).code, 'SUBSCRIPTION_V1_FOUNDATION_DEFAULT_OFF');
  assert.equal(resolveMonthlyCheckoutBinding({ product_key: MONTHLY_PRODUCT_KEY, request_context: null, enabled: true }).code, 'AUTHENTICATED_MEMBERSHIP_CONTEXT_REQUIRED');
  assert.equal(resolveMonthlyCheckoutBinding({ product_key: MONTHLY_PRODUCT_KEY, request_context: requestContext, body: { profile_id: 'MM-OTHER' }, enabled: true }).code, 'CLIENT_SUPPLIED_IDENTITY_OVERRIDE_DENIED');
  const bound = resolveMonthlyCheckoutBinding({ product_key: MONTHLY_PRODUCT_KEY, request_context: requestContext, body: {}, enabled: true });
  assert.equal(bound.ok, true);
  assert.equal(bound.metadata.membership_id, scope.membership_id);
  assert.equal(bound.client_reference_id, scope.membership_id);
  assert.equal(resolveMonthlyAccessLookup({ product_key: MONTHLY_PRODUCT_KEY, request_context: requestContext, enabled: true }).scope.business_id, scope.business_id);
  assert.equal(resolveMonthlyCheckoutBinding({ product_key: 'business_assessment', body: { profile_id: 'legacy' } }).code, 'LEGACY_ONE_TIME_PRODUCT_UNCHANGED');
});

test('AFW-02 verified Stripe lifecycle projects all governed entitlement states', () => {
  assert.equal(entitlement().state, 'ACTIVE');
  assert.equal(entitlement(testStripeEvents(scope, { cancel_at_period_end: true })).state, 'ACTIVE_CANCELING');
  assert.equal(entitlement(testStripeEvents(scope, { status: 'past_due' })).state, 'SUSPENDED_PAYMENT');
  assert.equal(entitlement(testStripeEvents(scope, { event_type: 'customer.subscription.deleted', status: 'canceled' })).state, 'TERMINATED');
  assert.equal(entitlementAllowsCoaching(entitlement(), TEST_TIME).allowed, true);
  assert.equal(entitlementAllowsCoaching(entitlement(testStripeEvents(scope, { status: 'past_due' })), TEST_TIME).allowed, false);
});

test('AFW-02 membership-scoped paid entitlement reaches runtime while legacy unbound grants reconcile', () => {
  const paid = entitlement();
  const resolved = resolveSubscriptionEntitlement({
    paidEntitlement: paid,
    authenticatedMembershipScope: scope,
    now: Date.parse(TEST_TIME),
    compositionAccessor: () => null,
  });
  assert.equal(resolved.allowed, true);
  assert.equal(resolved.entitlement.source, 'paid_stripe_membership_projection');
  assert.equal(resolved.entitlement.membership_scoped, true);
  const denied = resolveSubscriptionEntitlement({
    paidAccessGrant: { access_type: MONTHLY_PRODUCT_KEY, status: 'active' },
    authenticatedMembershipScope: scope,
    now: Date.parse(TEST_TIME),
    compositionAccessor: () => null,
  });
  assert.equal(denied.allowed, false);
  assert.equal(denied.code, 'LEGACY_PAID_GRANT_RECONCILIATION_REQUIRED');
});

test('AFW-02 unbound, drifted and incomplete Stripe evidence fails closed without fabrication', () => {
  const unbound = testStripeEvents(scope).map((event) => {
    const copy = { ...event };
    delete copy.membership_binding;
    return copy;
  });
  assert.equal(projectPaidEntitlement({ scope, stripe_events: unbound, projected_at: TEST_TIME }).code, 'STRIPE_EVENT_MEMBERSHIP_BINDING_REQUIRED');
  const wrongScope = testStripeEvents(scope, { membership_binding: { ...testStripeEvents(scope)[0].membership_binding, scope: { ...scope, business_id: 'business_wrong_scope' } } });
  assert.equal(projectPaidEntitlement({ scope, stripe_events: wrongScope, projected_at: TEST_TIME }).code, 'STRIPE_EVENT_SCOPE_MISMATCH');
  const incomplete = testStripeEvents(scope, { subscription_id: null });
  const result = projectPaidEntitlement({ scope, stripe_events: incomplete, projected_at: TEST_TIME });
  assert.equal(result.code, 'ENTITLEMENT_RECONCILIATION_REQUIRED');
  assert.equal(result.fabricated, false);
  assert.equal(reconcileLegacyAccessGrant({ grant: { grant_id: 'legacy', profile_id: scope.profile_id } }).code, 'LEGACY_GRANT_RECONCILIATION_REQUIRED');
});

test('AFW-02 four standard slots consume exactly once and onboarding stays separate', () => {
  const ledger = new InMemoryAllowanceSessionLedger();
  const created = ledger.createCycle(entitlement());
  assert.equal(created.ledger.standard_slots_total, 4);
  for (let index = 0; index < 4; index += 1) {
    const reserved = ledger.reserve({ ledger_id: created.ledger.ledger_id, scope, idempotency_key: `standard-${index}`, now: `2026-08-${18 + index}T20:00:00.000Z` });
    assert.equal(reserved.ok, true);
    assert.equal(ledger.activate({ session_id: reserved.session.session_id, scope, now: `2026-08-${18 + index}T20:01:00.000Z` }).ok, true);
    const charged = ledger.recordFirstValidResponse({ session_id: reserved.session.session_id, scope, response_hash: hashCanonicalJson({ response: index }), now: `2026-08-${18 + index}T20:02:00.000Z` });
    assert.equal(charged.ok, true);
    assert.equal(ledger.recordFirstValidResponse({ session_id: reserved.session.session_id, scope, response_hash: hashCanonicalJson({ response: index }), now: `2026-08-${18 + index}T20:02:30.000Z` }).code, 'IDEMPOTENT_REPLAY');
    assert.equal(ledger.complete({ session_id: reserved.session.session_id, scope, now: `2026-08-${18 + index}T20:10:00.000Z` }).ok, true);
  }
  const state = ledger.inspect({ ledger_id: created.ledger.ledger_id, scope, now: '2026-08-25T20:00:00.000Z' });
  assert.equal(state.ledger.standard_slots_consumed, 4);
  assert.equal(state.ledger.standard_slots_available, 0);
  assert.equal(ledger.reserve({ ledger_id: created.ledger.ledger_id, scope, idempotency_key: 'standard-5', now: '2026-08-25T20:00:00.000Z' }).code, 'STANDARD_ALLOWANCE_EXHAUSTED');
  const onboarding = ledger.reserve({ ledger_id: created.ledger.ledger_id, scope, session_class: 'ONBOARDING_INCLUDED', idempotency_key: 'onboarding', now: '2026-08-25T20:00:00.000Z' });
  assert.equal(onboarding.ok, true);
  ledger.activate({ session_id: onboarding.session.session_id, scope, now: '2026-08-25T20:01:00.000Z' });
  const charged = ledger.recordFirstValidResponse({ session_id: onboarding.session.session_id, scope, response_hash: hashCanonicalJson({ onboarding: true }), now: '2026-08-25T20:02:00.000Z' });
  assert.equal(charged.ledger.standard_slots_consumed, 4);
  assert.equal(charged.ledger.onboarding_consumed, true);
});

test('AFW-02 transport release, active-session exclusion and reconnect are idempotent', () => {
  const ledger = new InMemoryAllowanceSessionLedger();
  const cycle = ledger.createCycle(entitlement()).ledger;
  const reserved = ledger.reserve({ ledger_id: cycle.ledger_id, scope, idempotency_key: 'transport-failure', now: TEST_TIME });
  ledger.activate({ session_id: reserved.session.session_id, scope, now: '2026-08-18T20:01:00.000Z' });
  assert.equal(ledger.reserve({ ledger_id: cycle.ledger_id, scope, idempotency_key: 'parallel', now: '2026-08-18T20:02:00.000Z' }).code, 'ACTIVE_SESSION_ALREADY_EXISTS');
  const released = ledger.release({ session_id: reserved.session.session_id, scope, now: '2026-08-18T20:03:00.000Z' });
  assert.equal(released.code, 'SESSION_RELEASED_WITHOUT_CHARGE');
  assert.equal(released.ledger.standard_slots_consumed, 0);
  const next = ledger.reserve({ ledger_id: cycle.ledger_id, scope, idempotency_key: 'reconnect', now: '2026-08-18T20:04:00.000Z' });
  ledger.activate({ session_id: next.session.session_id, scope, now: '2026-08-18T20:05:00.000Z' });
  ledger.recordFirstValidResponse({ session_id: next.session.session_id, scope, response_hash: hashCanonicalJson({ response: 'valid' }), now: '2026-08-18T20:06:00.000Z' });
  ledger.enterGrace({ session_id: next.session.session_id, scope, now: '2026-08-18T20:07:00.000Z' });
  assert.equal(ledger.resume({ session_id: next.session.session_id, scope, now: '2026-08-18T20:08:00.000Z' }).code, 'SESSION_RESUMED_NO_ADDITIONAL_CHARGE');
  assert.equal(ledger.inspect({ ledger_id: cycle.ledger_id, scope, now: '2026-08-18T20:09:00.000Z' }).ledger.standard_slots_consumed, 1);
});

test('AFW-02 webhook lifecycle binds grants to membership and revokes stale active access', async () => {
  const redis = new FakeRedis();
  const metadata = {
    product_key: MONTHLY_PRODUCT_KEY,
    access_type: MONTHLY_PRODUCT_KEY,
    subject_id: scope.subject_id,
    membership_id: scope.membership_id,
    tenant_id: scope.tenant_id,
    profile_id: scope.profile_id,
    business_id: scope.business_id,
    binding_source: 'AUTHENTICATED_SERVER_CONTEXT',
    membership_verified: 'true',
  };
  const checkout = {
    id: 'evt_checkout_fixture', type: 'checkout.session.completed', created: 1787083200, livemode: false,
    data: { object: { id: 'cs_fixture', mode: 'subscription', payment_status: 'paid', customer: 'cus_fixture', subscription: 'sub_fixture', metadata } },
  };
  assert.equal((await processEvent(redis, checkout)).processed, true);
  assert.equal((await processEvent(redis, checkout)).idempotent, true);
  const ids = await redis.smembers(accessGrantByMembershipKey(scope.membership_id));
  assert.equal(ids.length, 1);
  assert.equal(JSON.parse(await redis.get(accessGrantKey(ids[0]))).status, 'active');
  const canceled = {
    id: 'evt_canceled_fixture', type: 'customer.subscription.deleted', created: 1787086800, livemode: false,
    data: { object: { id: 'sub_fixture', customer: 'cus_fixture', status: 'canceled', current_period_start: 1785542400, current_period_end: 1788220800 } },
  };
  await processEvent(redis, canceled);
  assert.equal(JSON.parse(await redis.get(accessGrantKey(ids[0]))).status, 'terminated');
});

test('AFW-02 webhook signature boundary rejects unsigned requests before persistence', async () => {
  const response = {
    statusCode: null,
    payload: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
    end() { return this; },
  };
  await stripeWebhookHandler({ method: 'POST', headers: {} }, response);
  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.payload, { ok: false, error: 'stripe_webhook_signature_required' });
});
