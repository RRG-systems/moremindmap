import assert from 'node:assert/strict';
import test from 'node:test';

import { createPurchaseIntentHandler } from '../src/lib/publicSiteAirlockV1/handlers.js';
import { MemoryPublicStore } from '../src/lib/publicSiteAirlockV1/memoryStore.js';
import { createPublicRuntime } from '../src/lib/publicSiteAirlockV1/runtime.js';
import { createPublicSiteService, assertPersistedPurchaseIntentContract } from '../src/lib/publicSiteAirlockV1/service.js';
import { runtimeFlags } from '../src/lib/publicSiteAirlockV1/security.js';
import { processEvent } from '../api/stripe/webhook.js';
import { createPaidMembershipBinder, PAID_MEMBERSHIP_NAMESPACE } from '../api/stripe/paidMembership.js';
import { buildCustomerConfirmedVerticalBinding } from '../api/business-assessment/verticalBinding.js';
import { PRODUCTION_BA_CASSETTE_REGISTRY, buildCustomerConfirmedSelection } from '../src/lib/baVerticalCassettesV1/index.js';

const profileId = 'mm-20260911-a1b2c3d4';
const scope = Object.freeze({
  subject_id: 'subject_paid_synthetic_0001',
  membership_id: 'membership_paid_synthetic_0001',
  tenant_id: 'tenant_paid_synthetic_0001',
  profile_id: profileId,
  business_id: 'business_paid_synthetic_0001',
});
const membershipBinding = Object.freeze({
  ...scope,
  assessment_id: 'assessment_paid_synthetic_0001',
  binding_source: 'AUTHENTICATED_SERVER_CONTEXT',
  membership_verified: true,
});
const membershipContext = Object.freeze({
  authenticated: true,
  membership_verified: true,
  subject_id: scope.subject_id,
  membership_id: scope.membership_id,
  email: 'member@example.test',
  assessment_id: membershipBinding.assessment_id,
  scope,
  membership_binding: membershipBinding,
});

function enabledEnv(overrides = {}) {
  return {
    PUBLIC_CHECKOUT_ENABLED: 'true',
    PUBLIC_SUBSCRIPTION_CHECKOUT_ENABLED: 'true',
    PUBLIC_PRODUCT_START_ENFORCEMENT_ENABLED: 'true',
    MOREMINDMAP_SERVER_ONLY_PRODUCT_START_SIGNING_KEY: 'synthetic-start-key-at-least-thirty-two-characters',
    PUBLIC_STRIPE_MODE: 'test',
    STRIPE_SECRET_KEY: 'sk_test_synthetic_never_sent',
    STRIPE_PRICE_BEHAVIOR_OS: 'price_synthetic_bos_14900',
    STRIPE_PRICE_BUSINESS_ASSESSMENT: 'price_synthetic_ba_4900',
    STRIPE_PRICE_MORE_MONTHLY_INTELLIGENCE: 'price_synthetic_monthly_3895',
    STRIPE_WEBHOOK_SECRET: 'whsec_synthetic_paid_subscription_1234567890',
    PUBLIC_SUBSCRIPTION_DESTINATION: '/subscription',
    PUBLIC_SUBSCRIPTION_RUNTIME_ENABLED: 'true',
    REDIS_URL: 'redis://synthetic.example.test:6379',
    NEW_BA_DERIVED_NAMESPACE: 'preview:new-ba:paid-subscription-v1',
    NEW_BA_BOS_NAMESPACE: 'preview:new-bos:paid-subscription-v1',
    NEW_BA_PROVIDER_MODEL: 'gpt-5.6-sol',
    MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_SIGNING_KEY: 'synthetic-owner-key-at-least-thirty-two-characters',
    MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_RESEND_API_KEY: 're_synthetic_profile_owner_key_123456',
    PUBLIC_PROFILE_OWNERSHIP_EMAIL_FROM: 'MORE MindMap <hello@moremindmap.example>',
    VERCEL_ENV: 'preview',
    VERCEL_URL: 'paid-subscription.example.vercel.app',
    ...overrides,
  };
}

function response() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.payload = value; return this; },
  };
}

function legacyCompleteBaOutput() {
  return {
    business_intelligence_draft: { version: 'business_intelligence_draft_v1' },
    executive_diagnostic_briefing_v1: { version: 'executive_diagnostic_briefing_v1' },
    five_futures_v1: { version: 'five_futures_v1' },
    one_move_v1: { version: 'one_move_v1' },
  };
}

function activePaidEntitlement() {
  return {
    contract_id: 'paid_entitlement',
    schema_version: '1.1.0',
    entitlement_id: 'entitlement_paid_entry_0001',
    scope,
    stripe_customer_hash: 'a'.repeat(64),
    stripe_subscription_hash: 'b'.repeat(64),
    state: 'ACTIVE',
    billing_cycle_start: '2026-09-01T00:00:00.000Z',
    billing_cycle_end: '2026-10-01T00:00:00.000Z',
    access_ends_at: null,
    source_event_ids: ['evt_paid_entry_0001'],
    projected_at: '2026-09-11T20:00:00.000Z',
    policy_version: 'subscription_v1_paid_entry_test',
  };
}

test('paid monthly purchase intent is server-membership bound and idempotent', async () => {
  const store = new MemoryPublicStore();
  const service = createPublicSiteService({
    store,
    monthlyCheckoutEnabled: true,
    monthlyMembershipBinder: async () => membershipContext,
    clock: () => Date.parse('2026-09-11T20:00:00.000Z'),
  });
  const input = {
    product_key: 'more_monthly_intelligence',
    profile_id: profileId,
    email: 'member@example.test',
    idempotency_key: 'paid-monthly-synthetic-0001',
  };
  const first = await service.createPurchaseIntent(input, { cookie_header: 'private-owner-receipt' });
  const replay = await service.createPurchaseIntent(input, { cookie_header: 'private-owner-receipt' });
  assert.equal(replay.intent_id, first.intent_id);
  assert.equal(replay.idempotent, true);
  assert.equal(first.expected_price_minor, 3895);
  assert.equal(first.currency, 'usd');
  assert.equal(first.cadence, 'monthly');
  assert.deepEqual(first.membership_binding, membershipBinding);
  assert.equal(assertPersistedPurchaseIntentContract(first, { intentId: first.intent_id }).product.product_key, 'more_monthly_intelligence');
});

test('real membership binding keeps an identical monthly purchase replay idempotent across clock advance', async () => {
  const store = new MemoryPublicStore();
  const assessmentId = 'ba-20260911-paid-replay';
  const ownerEmail = 'paid-replay@example.test';
  const verticalSelection = buildCustomerConfirmedSelection(
    PRODUCTION_BA_CASSETTE_REGISTRY.resolveVertical('real_estate'),
  );
  await store.set(`business_assessment_by_profile:${profileId}`, assessmentId);
  await store.set(`business_assessment:${assessmentId}`, JSON.stringify({
    assessment_id: assessmentId,
    owner_profile_id: profileId,
    output: legacyCompleteBaOutput(),
    vertical_binding: buildCustomerConfirmedVerticalBinding({
      selection: verticalSelection,
      selectedAt: '2026-09-11T20:00:00.000Z',
    }),
  }));
  let now = Date.parse('2026-09-11T20:00:00.000Z');
  const binder = createPaidMembershipBinder({
    store,
    ownershipVerifier: async () => true,
    ownerReader: async () => ({ profile_id: profileId, recipient_email: ownerEmail }),
    profileStateReader: async () => ({ bos: 'ready', ba: 'ready' }),
    clock: () => now,
  });
  const service = createPublicSiteService({
    store,
    monthlyCheckoutEnabled: true,
    monthlyMembershipBinder: binder,
    clock: () => now,
  });
  const input = {
    product_key: 'more_monthly_intelligence',
    profile_id: profileId,
    idempotency_key: 'paid-monthly-clock-advance-replay-0001',
  };
  const first = await service.createPurchaseIntent(input, { cookie_header: 'private-owner-receipt' });
  const persistedBeforeReplay = [...store.values.entries()]
    .filter(([key]) => key.startsWith(`${PAID_MEMBERSHIP_NAMESPACE}:`));
  now += 1_000;
  const replay = await service.createPurchaseIntent(input, { cookie_header: 'private-owner-receipt' });
  const persistedAfterReplay = [...store.values.entries()]
    .filter(([key]) => key.startsWith(`${PAID_MEMBERSHIP_NAMESPACE}:`));
  assert.equal(replay.intent_id, first.intent_id);
  assert.equal(replay.idempotent, true);
  assert.deepEqual(persistedAfterReplay, persistedBeforeReplay);
});

test('public runtime wires current New BA readiness into the normal monthly membership path', async () => {
  const store = new MemoryPublicStore();
  const assessmentId = 'ba-20260912-current-new-ba-runtime';
  const ownerEmail = 'current-new-ba-owner@example.test';
  const verticalSelection = buildCustomerConfirmedSelection(
    PRODUCTION_BA_CASSETTE_REGISTRY.resolveVertical('real_estate'),
  );
  const verticalBinding = buildCustomerConfirmedVerticalBinding({
    selection: verticalSelection,
    selectedAt: '2026-09-12T20:00:00.000Z',
  });
  const assessment = {
    assessment_id: assessmentId,
    owner_profile_id: profileId,
    vertical_binding: verticalBinding,
  };
  await store.set(`business_assessment_by_profile:${profileId}`, assessmentId);
  await store.set(`business_assessment:${assessmentId}`, JSON.stringify(assessment));
  let readinessReads = 0;
  const runtime = createPublicRuntime(enabledEnv({
    NEW_BA_DERIVED_NAMESPACE: 'nonprod:new-ba:paid-release-integration-v1',
  }), {
    store,
    ownership: { verifyRequest: async () => true },
    ownershipVerifier: async () => true,
    ownerReader: async () => ({ profile_id: profileId, recipient_email: ownerEmail }),
    profileStateReader: async () => ({ bos: 'ready', ba: 'pending' }),
    currentNewBaReadinessReader: async ({ profile_id: receiptProfileId, assessment: receiptAssessment }) => {
      readinessReads += 1;
      assert.equal(receiptProfileId, profileId);
      assert.deepEqual(receiptAssessment, assessment);
      return {
        ready: true,
        code: 'PAID_CURRENT_NEW_BA_MEMBERSHIP_READY',
        source: 'CURRENT_NEW_BA_LAUNCH_SAFE_REALIZATION',
        profile_id: profileId,
        assessment_id: assessmentId,
        realization_id: `new-ba:${profileId.toUpperCase()}:${assessmentId}:${'a'.repeat(64)}`,
        artifact_sha256: 'b'.repeat(64),
        vertical_binding_sha256: verticalBinding.binding_sha256,
        compatibility_class: 'A',
        provider_store: false,
        mutation_performed: false,
      };
    },
    clock: () => Date.parse('2026-09-12T20:00:00.000Z'),
  });
  const intent = await runtime.service.createPurchaseIntent({
    product_key: 'more_monthly_intelligence',
    profile_id: profileId,
    idempotency_key: 'current-new-ba-runtime-wiring-0001',
  }, { cookie_header: 'synthetic-owner-receipt' });
  assert.equal(intent.status, 'awaiting_provider_checkout');
  assert.equal(intent.expected_price_minor, 3895);
  assert.equal(readinessReads, 1);
  assert.equal(
    [...store.values.keys()].filter((key) => key.startsWith(`${PAID_MEMBERSHIP_NAMESPACE}:`)).length,
    4,
  );
  assert.equal(
    [...store.values.keys()].some((key) => key.startsWith('access_grant:') || key.startsWith('stripe_')),
    false,
  );
});

test('an unsafe current New BA namespace fail-closes monthly checkout without disabling the public runtime', () => {
  const store = new MemoryPublicStore();
  const options = {
    store,
    ownership: { verifyRequest: async () => false },
    ownerReader: async () => null,
    profileStateReader: async () => ({ bos: 'missing', ba: 'missing' }),
  };
  assert.doesNotThrow(() => createPublicRuntime(enabledEnv({
    PUBLIC_SUBSCRIPTION_CHECKOUT_ENABLED: 'false',
    NEW_BA_DERIVED_NAMESPACE: 'production:new-ba:invalid',
  }), options));
  const unsafeEnv = enabledEnv({
    NEW_BA_DERIVED_NAMESPACE: 'production:new-ba:invalid',
  });
  assert.equal(runtimeFlags(unsafeEnv).subscription_checkout_enabled, false);
  assert.doesNotThrow(() => createPublicRuntime(unsafeEnv, options));
});

test('governed monthly Checkout grants only the exact membership and subscription scope', async () => {
  const store = new MemoryPublicStore();
  const service = createPublicSiteService({
    store,
    monthlyCheckoutEnabled: true,
    monthlyMembershipBinder: async () => membershipContext,
    clock: () => Date.parse('2026-09-11T20:00:00.000Z'),
  });
  const intent = await service.createPurchaseIntent({
    product_key: 'more_monthly_intelligence',
    profile_id: profileId,
    idempotency_key: 'paid-monthly-webhook-0001',
  }, { cookie_header: 'private-owner-receipt' });
  const event = {
    id: 'evt_paid_monthly_synthetic_0001',
    type: 'checkout.session.completed',
    created: 1789156800,
    livemode: false,
    data: {
      object: {
        id: 'cs_test_paid_monthly_synthetic_0001',
        livemode: false,
        mode: 'subscription',
        payment_status: 'paid',
        amount_total: 3895,
        currency: 'usd',
        customer: 'cus_paid_monthly_synthetic_0001',
        subscription: 'sub_paid_monthly_synthetic_0001',
        client_reference_id: scope.membership_id,
        customer_details: { email: membershipContext.email },
        metadata: {
          product_key: intent.product_key,
          access_type: intent.access_type,
          purchase_intent_id: intent.intent_id,
          profile_id: profileId,
          vertical_binding_sha256: '',
          internal_version: 'mmm-public-product-v1',
          subject_id: scope.subject_id,
          membership_id: scope.membership_id,
          tenant_id: scope.tenant_id,
          business_id: scope.business_id,
          assessment_id: membershipBinding.assessment_id,
          binding_source: 'AUTHENTICATED_SERVER_CONTEXT',
          membership_verified: 'true',
        },
      },
    },
  };
  assert.deepEqual(await processEvent(store, event, enabledEnv()), { processed: true, idempotent: false });
  const grant = JSON.parse(await store.get('access_grant:grant_cs_test_paid_monthly_synthetic_0001'));
  assert.equal(grant.status, 'active');
  assert.equal(grant.membership_verified, true);
  assert.deepEqual(grant.scope, scope);
  assert.equal(grant.subscription_id, 'sub_paid_monthly_synthetic_0001');
  assert.deepEqual(await store.smembers(`access_grant_by_membership:${scope.membership_id}`), [grant.grant_id]);
  assert.deepEqual(await store.smembers('access_grant_by_subscription:sub_paid_monthly_synthetic_0001'), [grant.grant_id]);
  const savedIntent = JSON.parse(await store.get(`public_product_v1:purchase_intent:${intent.intent_id}`));
  assert.equal(savedIntent.status, 'granted');
});

test('governed monthly grant mutation waits for concurrent failed-payment reconciliation', { timeout: 2000 }, async () => {
  const subscriptionId = 'sub_paid_monthly_concurrent_failure';
  const checkoutSessionId = 'cs_test_paid_monthly_concurrent_failure';
  const invoiceEventId = 'evt_paid_monthly_concurrent_failure';
  const subscriptionLockKey = `stripe_subscription_mutation_lock:${subscriptionId}`;
  const grantKey = `access_grant:grant_${checkoutSessionId}`;

  class GovernedCheckoutRaceStore extends MemoryPublicStore {
    constructor() {
      super();
      this.armed = false;
      this.subscriptionLockAttempts = 0;
      this.failureCompletionStarted = new Promise((resolve) => { this.resolveFailureCompletionStarted = resolve; });
      this.checkoutLockAttempted = new Promise((resolve) => { this.resolveCheckoutLockAttempted = resolve; });
      this.failureCompletionReleased = new Promise((resolve) => { this.resolveFailureCompletionReleased = resolve; });
    }

    async setNx(key, value, ttlSeconds) {
      const acquired = await super.setNx(key, value, ttlSeconds);
      if (this.armed && key === subscriptionLockKey) {
        this.subscriptionLockAttempts += 1;
        if (this.subscriptionLockAttempts >= 2) this.resolveCheckoutLockAttempted();
      }
      return acquired;
    }

    async set(key, value) {
      if (this.armed && key === `stripe_webhook_completion:${invoiceEventId}`) {
        const completion = JSON.parse(value);
        if (completion.phase === 'complete') {
          this.resolveFailureCompletionStarted();
          await this.failureCompletionReleased;
        }
      }
      return super.set(key, value);
    }
  }

  const store = new GovernedCheckoutRaceStore();
  const service = createPublicSiteService({
    store,
    monthlyCheckoutEnabled: true,
    monthlyMembershipBinder: async () => membershipContext,
    clock: () => Date.parse('2026-09-11T20:00:00.000Z'),
  });
  const intent = await service.createPurchaseIntent({
    product_key: 'more_monthly_intelligence',
    profile_id: profileId,
    idempotency_key: 'paid-monthly-concurrent-failure-0001',
  }, { cookie_header: 'private-owner-receipt' });
  const stripeMetadata = {
    product_key: intent.product_key,
    access_type: intent.access_type,
    purchase_intent_id: intent.intent_id,
    profile_id: profileId,
    vertical_binding_sha256: '',
    internal_version: 'mmm-public-product-v1',
    subject_id: scope.subject_id,
    membership_id: scope.membership_id,
    tenant_id: scope.tenant_id,
    business_id: scope.business_id,
    assessment_id: membershipBinding.assessment_id,
    binding_source: 'AUTHENTICATED_SERVER_CONTEXT',
    membership_verified: 'true',
  };

  await processEvent(store, {
    id: 'evt_paid_monthly_active_seed',
    type: 'customer.subscription.updated',
    created: 1789156700,
    livemode: false,
    data: { object: {
      id: subscriptionId,
      customer: 'cus_paid_monthly_concurrent_failure',
      status: 'active',
      current_period_start: 1789150000,
      current_period_end: 1791828400,
      metadata: stripeMetadata,
    } },
  }, enabledEnv());

  store.armed = true;
  const failurePromise = processEvent(store, {
    id: invoiceEventId,
    type: 'invoice.payment_failed',
    created: 1789156800,
    livemode: false,
    data: { object: {
      id: 'in_paid_monthly_concurrent_failure',
      subscription: subscriptionId,
      customer: 'cus_paid_monthly_concurrent_failure',
      status: 'open',
      metadata: stripeMetadata,
    } },
  }, enabledEnv());
  await store.failureCompletionStarted;

  const checkoutEvent = {
    id: 'evt_paid_monthly_checkout_after_failure',
    type: 'checkout.session.completed',
    created: 1789156810,
    livemode: false,
    data: { object: {
      id: checkoutSessionId,
      livemode: false,
      mode: 'subscription',
      payment_status: 'paid',
      amount_total: 3895,
      currency: 'usd',
      customer: 'cus_paid_monthly_concurrent_failure',
      subscription: subscriptionId,
      client_reference_id: scope.membership_id,
      customer_details: { email: membershipContext.email },
      metadata: stripeMetadata,
    } },
  };
  const checkoutPromise = processEvent(store, checkoutEvent, enabledEnv());
  await store.checkoutLockAttempted;

  assert.equal(await store.get(grantKey), null);
  store.resolveFailureCompletionReleased();
  assert.deepEqual(await Promise.all([failurePromise, checkoutPromise]), [
    { processed: true, idempotent: false },
    { processed: true, idempotent: false },
  ]);
  const grant = JSON.parse(await store.get(grantKey));
  assert.equal(grant.status, 'payment_suspended');
  assert.equal(grant.subscription_id, subscriptionId);
  assert.equal(await store.get(subscriptionLockKey), null);
  assert.deepEqual(
    await processEvent(store, structuredClone(checkoutEvent), enabledEnv()),
    { processed: true, idempotent: true },
  );
  assert.equal(JSON.parse(await store.get(grantKey)).status, 'payment_suspended');
});

test('paid monthly intent refuses client identity override and remains default-off', async () => {
  const store = new MemoryPublicStore();
  const enabled = createPublicSiteService({
    store,
    monthlyCheckoutEnabled: true,
    monthlyMembershipBinder: async () => membershipContext,
  });
  await assert.rejects(enabled.createPurchaseIntent({
    product_key: 'more_monthly_intelligence',
    profile_id: profileId,
    email: 'attacker@example.test',
    idempotency_key: 'paid-monthly-override-0001',
  }), /client_supplied_identity_override_denied/u);
  const disabled = createPublicSiteService({
    store: new MemoryPublicStore(),
    monthlyMembershipBinder: async () => membershipContext,
  });
  await assert.rejects(disabled.createPurchaseIntent({
    product_key: 'more_monthly_intelligence',
    profile_id: profileId,
    idempotency_key: 'paid-monthly-disabled-0001',
  }), /subscription_checkout_gated/u);
});

test('monthly runtime activation requires its own exact Price and destination in addition to base checkout', () => {
  assert.equal(runtimeFlags(enabledEnv()).subscription_checkout_enabled, true);
  assert.equal(runtimeFlags(enabledEnv({ STRIPE_PRICE_MORE_MONTHLY_INTELLIGENCE: '' })).subscription_checkout_enabled, false);
  assert.equal(runtimeFlags(enabledEnv({ PUBLIC_SUBSCRIPTION_DESTINATION: '' })).subscription_checkout_enabled, false);
  assert.equal(runtimeFlags(enabledEnv({ PUBLIC_SUBSCRIPTION_CHECKOUT_ENABLED: 'false' })).subscription_checkout_enabled, false);
  assert.equal(runtimeFlags(enabledEnv({ PUBLIC_SUBSCRIPTION_RUNTIME_ENABLED: 'false' })).subscription_checkout_enabled, false);
  assert.equal(runtimeFlags(enabledEnv({ STRIPE_WEBHOOK_SECRET: '' })).subscription_checkout_enabled, false);
  assert.equal(runtimeFlags(enabledEnv({ REDIS_URL: '' })).subscription_checkout_enabled, false);
  assert.equal(runtimeFlags(enabledEnv({ NEW_BA_DERIVED_NAMESPACE: '' })).subscription_checkout_enabled, false);
  assert.equal(runtimeFlags(enabledEnv({ NEW_BA_BOS_NAMESPACE: '' })).subscription_checkout_enabled, false);
  assert.equal(runtimeFlags(enabledEnv({ NEW_BA_PROVIDER_MODEL: 'unexpected-model' })).subscription_checkout_enabled, false);
  assert.equal(runtimeFlags(enabledEnv({ MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_RESEND_API_KEY: '' })).subscription_checkout_enabled, false);
});

test('disabled monthly route is indistinguishable from a missing endpoint and creates no runtime', async () => {
  let runtimeCalls = 0;
  const handler = createPurchaseIntentHandler({
    env: enabledEnv({ PUBLIC_SUBSCRIPTION_CHECKOUT_ENABLED: 'false' }),
    serviceFactory: async () => { runtimeCalls += 1; throw new Error('must_not_construct'); },
    checkoutProviderFactory: () => { throw new Error('must_not_construct'); },
  });
  const res = response();
  await handler({
    method: 'POST',
    headers: {},
    body: { product_key: 'more_monthly_intelligence', profile_id: profileId },
    socket: {},
  }, res);
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.payload, { ok: false, error: 'not_found' });
  assert.equal(runtimeCalls, 0);
});

test('verified monthly grant starts only at the exact configured subscriber entrance', async () => {
  const store = new MemoryPublicStore();
  const startSigningKey = 'synthetic-start-key-at-least-thirty-two-characters';
  const service = createPublicSiteService({
    store,
    startSigningKey,
    subscriptionDestination: '/subscription',
    monthlyEntitlementResolver: async () => activePaidEntitlement(),
    clock: () => Date.parse('2026-09-11T20:00:00.000Z'),
  });
  const grantId = 'grant_cs_test_paid_entry_synthetic_0001';
  await store.set(`access_grant:${grantId}`, JSON.stringify({
    grant_id: grantId,
    product_key: 'more_monthly_intelligence',
    status: 'active',
    profile_id: profileId,
    scope,
  }));
  const token = await service.createStartTokenForGrant({ grant_id: grantId });
  const started = await service.startProduct({ start_token: token.start_token });
  assert.equal(started.destination, '/subscription');
  assert.equal(started.profile_id, profileId);

  const gated = createPublicSiteService({
    store,
    startSigningKey,
    subscriptionDestination: '/not-authorized',
    monthlyEntitlementResolver: async () => activePaidEntitlement(),
    clock: () => Date.parse('2026-09-11T20:00:00.000Z'),
  });
  await assert.rejects(gated.startProduct({ start_token: token.start_token }), /product_destination_gated/u);
});
