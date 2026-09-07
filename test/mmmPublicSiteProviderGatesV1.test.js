/* global Buffer */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolvePublicSiteAllowedOrigins,
  resolvePublicSiteOrigin,
} from '../src/lib/publicSiteAirlockV1/publicSiteOrigin.js';
import {
  assertPublicStripeEventMode,
  createStripeCheckoutProvider,
} from '../src/lib/publicSiteAirlockV1/stripeCheckoutProvider.js';
import {
  PUBLIC_INQUIRY_RESEND_ENDPOINT,
  createResendInquiryTransport,
  createResendInquiryTransportFromEnv,
  publicInquiryTransportConfigured,
} from '../src/lib/publicSiteAirlockV1/resendInquiryTransport.js';
import {
  PUBLIC_INQUIRY_PENDING_SET,
  createPublicInquiryOutboxDrainHandler,
} from '../api/internal/public-inquiry-outbox-drain.js';
import { nonsecretRuntimeAttestation, runtimeFlags } from '../src/lib/publicSiteAirlockV1/security.js';
import { publicProfileOwnershipTransportConfigured } from '../src/lib/publicSiteAirlockV1/resendOwnershipTransport.js';

const previewHostname = 'moremindmap-airlock-synthetic.vercel.app';
const previewOrigin = `https://${previewHostname}`;
const testKey = 'sk_test_synthetic_key_that_never_leaves_the_test';
const drainSecret = 'synthetic-public-inquiry-drain-secret-1234567890';

const bosIntent = Object.freeze({
  intent_id: 'pi_more_synthetic_bos_0001',
  product_key: 'behavior_operating_system',
  access_type: 'behavior_operating_system',
  expected_price_minor: 14900,
  currency: 'usd',
  cadence: 'one_time',
  profile_id: '',
  email: '',
  vertical_binding: null,
});

function stripeEnv(overrides = {}) {
  return {
    PUBLIC_STRIPE_MODE: 'test',
    STRIPE_SECRET_KEY: testKey,
    STRIPE_PRICE_BEHAVIOR_OS: 'price_bos_test_14900',
    VERCEL_ENV: 'preview',
    VERCEL_URL: previewHostname,
    ...overrides,
  };
}

function fakeStripe({ price = {}, session = {} } = {}) {
  const calls = { retrieve: [], create: [] };
  const client = {
    prices: {
      async retrieve(id) {
        calls.retrieve.push(id);
        return {
          id,
          active: true,
          livemode: false,
          unit_amount: 14900,
          currency: 'usd',
          type: 'one_time',
          recurring: null,
          ...price,
        };
      },
    },
    checkout: {
      sessions: {
        async create(payload, options) {
          calls.create.push({ payload, options });
          return {
            id: 'cs_test_synthetic_checkout_0001',
            url: 'https://checkout.stripe.com/c/pay/synthetic',
            livemode: false,
            mode: 'payment',
            ...session,
          };
        },
      },
    },
  };
  return { calls, client };
}

function inquiryTransportOptions(overrides = {}) {
  return {
    apiKey: 're_synthetic_public_inquiry_key_123456',
    from: 'MORE MindMap <hello@moremindmap.example>',
    to: 'private-sales@moremindmap.example',
    ...overrides,
  };
}

function inquiryItem(overrides = {}) {
  return {
    receipt_id: 'inq_synthetic_0001',
    outbox_id: 'outbox_inq_synthetic_0001',
    name: 'Synthetic Founder',
    phone: '602-555-0101',
    email: 'founder@example.test',
    destination_ref: 'server_configured_more_sales_inbox',
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

test('Preview origin comes only from explicit configuration or provider-owned Vercel metadata', () => {
  assert.equal(resolvePublicSiteOrigin({ VERCEL_ENV: 'preview', VERCEL_URL: previewHostname }), previewOrigin);
  assert.equal(resolvePublicSiteOrigin({
    VERCEL_ENV: 'preview',
    VERCEL_URL: previewHostname,
    SITE_URL: 'https://moremindmap.com',
  }), previewOrigin);
  assert.equal(resolvePublicSiteOrigin({ PUBLIC_SITE_URL: 'https://review.moremindmap.example' }), 'https://review.moremindmap.example');
  assert.deepEqual(resolvePublicSiteAllowedOrigins({
    VERCEL_ENV: 'preview',
    VERCEL_URL: previewHostname,
    PUBLIC_ALLOWED_ORIGINS: 'https://moremindmap.com',
  }), ['https://moremindmap.com', previewOrigin]);
  assert.throws(() => resolvePublicSiteOrigin({ PUBLIC_SITE_URL: 'https://example.test/path' }), /public_site_origin_invalid/u);
  assert.throws(() => resolvePublicSiteOrigin({
    VERCEL_ENV: 'preview',
    VERCEL_URL: previewHostname,
    PUBLIC_SITE_URL: 'https://moremindmap.com',
  }), /public_site_preview_origin_mismatch/u);
  assert.throws(() => resolvePublicSiteOrigin({ VERCEL_ENV: 'preview', VERCEL_URL: 'attacker.example.test' }), /public_vercel_origin_invalid/u);
});

test('sandbox Stripe checkout validates Price before creating one idempotent canary Session', async () => {
  const { calls, client } = fakeStripe();
  const provider = createStripeCheckoutProvider(stripeEnv(), { stripeClient: client });
  const result = await provider.create({ intent: bosIntent });
  assert.deepEqual(result, {
    id: 'cs_test_synthetic_checkout_0001',
    url: 'https://checkout.stripe.com/c/pay/synthetic',
  });
  assert.deepEqual(calls.retrieve, ['price_bos_test_14900']);
  assert.equal(calls.create.length, 1);
  const [{ payload, options }] = calls.create;
  assert.equal(payload.mode, 'payment');
  assert.deepEqual(payload.line_items, [{ price: 'price_bos_test_14900', quantity: 1 }]);
  assert.equal(payload.success_url, `${previewOrigin}/payment-success?product=behavior_operating_system&session_id={CHECKOUT_SESSION_ID}`);
  assert.equal(payload.cancel_url, `${previewOrigin}/payment-cancelled?product=behavior_operating_system`);
  assert.equal(payload.metadata.purchase_intent_id, bosIntent.intent_id);
  assert.equal(options.idempotencyKey, bosIntent.intent_id);
});

test('Stripe test/live authority and Price mismatches fail before Session creation', async () => {
  assert.equal(assertPublicStripeEventMode({ livemode: false }, stripeEnv()), 'test');
  assert.throws(() => assertPublicStripeEventMode({ livemode: true }, stripeEnv()), /stripe_event_mode_mismatch/u);
  assert.throws(
    () => createStripeCheckoutProvider(stripeEnv({ PUBLIC_STRIPE_MODE: 'test', STRIPE_SECRET_KEY: 'sk_live_synthetic' }), { stripeClient: fakeStripe().client }),
    /stripe_secret_mode_mismatch/u,
  );
  assert.throws(
    () => createStripeCheckoutProvider(stripeEnv({ PUBLIC_STRIPE_MODE: '' }), { stripeClient: fakeStripe().client }),
    /stripe_mode_unavailable/u,
  );

  const mismatches = [
    { unit_amount: 4900 },
    { currency: 'cad' },
    { livemode: true },
    { active: false },
    { type: 'recurring', recurring: { interval: 'month', interval_count: 1 } },
  ];
  for (const price of mismatches) {
    const { calls, client } = fakeStripe({ price });
    const provider = createStripeCheckoutProvider(stripeEnv(), { stripeClient: client });
    await assert.rejects(provider.create({ intent: bosIntent }), /stripe_price_(?:contract|cadence)_mismatch/u);
    assert.equal(calls.create.length, 0);
  }
});

test('Stripe rejects a live, wrong-mode or malformed Checkout Session before returning its URL', async () => {
  const mismatches = [
    { livemode: true },
    { mode: 'subscription' },
    { id: 'cs_live_synthetic_checkout_0001' },
    { url: 'http://checkout.stripe.test/synthetic' },
  ];
  for (const session of mismatches) {
    const { client } = fakeStripe({ session });
    const provider = createStripeCheckoutProvider(stripeEnv(), { stripeClient: client });
    await assert.rejects(provider.create({ intent: bosIntent }), /stripe_session_contract_mismatch/u);
  }
});

test('public inquiry Resend transport has one fixed endpoint, recipient and provider idempotency key', async () => {
  const calls = [];
  const transport = createResendInquiryTransport(inquiryTransportOptions({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, async json() { return { id: 'email_synthetic_0001' }; } };
    },
  }));
  const sent = await transport.send(inquiryItem({ to: 'attacker@example.test', endpoint: 'https://attacker.example.test' }));
  assert.deepEqual(sent, { id: 'resend:email_synthetic_0001', provider: 'resend' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, PUBLIC_INQUIRY_RESEND_ENDPOINT);
  assert.equal(calls[0].options.headers['idempotency-key'], 'outbox_inq_synthetic_0001');
  const payload = JSON.parse(calls[0].options.body);
  assert.deepEqual(payload.to, ['private-sales@moremindmap.example']);
  assert.equal(JSON.stringify(payload).includes('attacker@example.test'), false);
  assert.equal(JSON.stringify(sent).includes('private-sales@moremindmap.example'), false);
});

test('public inquiry transport fails closed on missing binding, wrong destination ref and provider failure', async () => {
  assert.equal(publicInquiryTransportConfigured({}), false);
  assert.throws(() => createResendInquiryTransportFromEnv({}), /public_inquiry_resend_key_required/u);
  let providerCalls = 0;
  const transport = createResendInquiryTransport(inquiryTransportOptions({
    fetchImpl: async () => {
      providerCalls += 1;
      return { ok: false, async json() { return { message: 'private provider prose must not escape' }; } };
    },
  }));
  await assert.rejects(
    transport.send(inquiryItem({ destination_ref: 'request_supplied_destination' })),
    /public_inquiry_payload_invalid/u,
  );
  assert.equal(providerCalls, 0);
  await assert.rejects(transport.send(inquiryItem()), (error) => {
    assert.equal(error.message, 'public_inquiry_delivery_rejected');
    assert.equal(error.message.includes('provider prose'), false);
    return true;
  });
});

test('public inquiry runtime flag requires the same validated transport contract plus drain authority', () => {
  const configured = {
    PUBLIC_INQUIRY_INTAKE_ENABLED: 'true',
    MOREMINDMAP_SERVER_ONLY_INQUIRY_RESEND_API_KEY: 're_synthetic_public_inquiry_key_123456',
    PUBLIC_INQUIRY_EMAIL_FROM: 'MORE MindMap <hello@moremindmap.example>',
    PUBLIC_INQUIRY_EMAIL_TO: 'private-sales@moremindmap.example',
    MOREMINDMAP_SERVER_ONLY_INQUIRY_OUTBOX_DRAIN_SECRET: drainSecret,
  };
  assert.equal(runtimeFlags(configured).inquiry_intake_enabled, true);
  assert.equal(runtimeFlags({ ...configured, MOREMINDMAP_SERVER_ONLY_INQUIRY_RESEND_API_KEY: 'present-but-invalid' }).inquiry_intake_enabled, false);
  assert.equal(runtimeFlags({ ...configured, PUBLIC_INQUIRY_EMAIL_TO: 'not-a-mailbox' }).inquiry_intake_enabled, false);
  assert.equal(runtimeFlags({ ...configured, MOREMINDMAP_SERVER_ONLY_INQUIRY_OUTBOX_DRAIN_SECRET: 'short' }).inquiry_intake_enabled, false);
});

test('profile ownership transport readiness requires an exact server-only Resend binding', () => {
  const configured = {
    MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_RESEND_API_KEY: 're_synthetic_profile_owner_key_123456',
    PUBLIC_PROFILE_OWNERSHIP_EMAIL_FROM: 'MORE MindMap <hello@moremindmap.example>',
  };
  assert.equal(publicProfileOwnershipTransportConfigured(configured), true);
  assert.equal(publicProfileOwnershipTransportConfigured({ ...configured, MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_RESEND_API_KEY: 'present-but-invalid' }), false);
  assert.equal(publicProfileOwnershipTransportConfigured({ ...configured, PUBLIC_PROFILE_OWNERSHIP_EMAIL_FROM: 'not-a-mailbox' }), false);
});

test('legacy PUBLIC_ secret names cannot activate any migrated server-only gate', () => {
  const legacy = {
    PUBLIC_CHECKOUT_ENABLED: 'true',
    PUBLIC_PRODUCT_START_ENFORCEMENT_ENABLED: 'true',
    PUBLIC_INQUIRY_INTAKE_ENABLED: 'true',
    PUBLIC_COMPLIMENTARY_REDEMPTION_ENABLED: 'true',
    PUBLIC_STRIPE_MODE: 'test',
    STRIPE_SECRET_KEY: 'sk_test_synthetic_never_sent',
    STRIPE_PRICE_BEHAVIOR_OS: 'price_synthetic_bos',
    STRIPE_PRICE_BUSINESS_ASSESSMENT: 'price_synthetic_ba',
    PUBLIC_PRODUCT_START_SIGNING_KEY: 'legacy-start-signing-key-at-least-thirty-two-characters',
    PUBLIC_PROFILE_OWNERSHIP_SIGNING_KEY: 'legacy-owner-signing-key-at-least-thirty-two-characters',
    PUBLIC_INQUIRY_RESEND_API_KEY: 're_synthetic_legacy_inquiry_key_123456',
    PUBLIC_PROFILE_OWNERSHIP_RESEND_API_KEY: 're_synthetic_legacy_owner_key_123456',
    PUBLIC_INQUIRY_OUTBOX_DRAIN_SECRET: 'legacy-drain-secret-at-least-thirty-two-characters',
    PUBLIC_COMPLIMENTARY_PEPPER: 'legacy-complimentary-pepper-at-least-thirty-two-characters',
    PUBLIC_COMPLIMENTARY_MANIFEST: '[]',
    PUBLIC_INQUIRY_EMAIL_FROM: 'MORE MindMap <hello@moremindmap.example>',
    PUBLIC_INQUIRY_EMAIL_TO: 'private-sales@moremindmap.example',
    PUBLIC_PROFILE_OWNERSHIP_EMAIL_FROM: 'MORE MindMap <hello@moremindmap.example>',
    VERCEL_ENV: 'preview',
    VERCEL_URL: 'candidate.example.vercel.app',
  };
  const flags = runtimeFlags(legacy);
  assert.equal(flags.checkout_enabled, false);
  assert.equal(flags.inquiry_intake_enabled, false);
  assert.equal(flags.complimentary_redemption_enabled, false);
  assert.equal(publicInquiryTransportConfigured(legacy), false);
  assert.equal(publicProfileOwnershipTransportConfigured(legacy), false);
  assert.equal(nonsecretRuntimeAttestation(legacy).profile_ownership_binding_state, 'unconfigured');
});

test('public inquiry drain hides without authority and never constructs its runtime', async () => {
  let runtimeCalls = 0;
  const handler = createPublicInquiryOutboxDrainHandler({
    env: { PUBLIC_INQUIRY_INTAKE_ENABLED: 'true', MOREMINDMAP_SERVER_ONLY_INQUIRY_OUTBOX_DRAIN_SECRET: drainSecret },
    runtimeFactory: async () => { runtimeCalls += 1; throw new Error('must_not_run'); },
  });
  const denied = response();
  await handler({ method: 'POST', headers: { authorization: `Bearer ${'x'.repeat(drainSecret.length)}` }, body: {} }, denied);
  assert.equal(denied.statusCode, 404);
  assert.deepEqual(denied.payload, { ok: false, error: 'not_found' });
  assert.equal(runtimeCalls, 0);
  const wrongMethod = response();
  await handler({ method: 'GET', headers: { authorization: `Bearer ${drainSecret}` } }, wrongMethod);
  assert.equal(wrongMethod.statusCode, 405);
  assert.equal(runtimeCalls, 0);
});

test('authorized public inquiry drain is bounded, aggregate-only and removes delivered pending IDs', async () => {
  const pending = Array.from({ length: 24 }, (_, index) => `outbox_synthetic_${String(index).padStart(2, '0')}`);
  const dispatched = [];
  const removed = [];
  let closed = 0;
  const runtime = {
    store: {
      async smembers(key) { assert.equal(key, PUBLIC_INQUIRY_PENDING_SET); return pending; },
      async srem(key, value) { removed.push([key, value]); return 1; },
    },
    service: {
      async dispatchInquiry(id) {
        dispatched.push(id);
        const index = Number(id.slice(-2));
        if (index === 1) return { state: 'retry_pending' };
        if (index === 2) throw new Error('synthetic_customer_value_must_not_escape');
        return { state: 'delivered' };
      },
    },
    async close() { closed += 1; },
  };
  const handler = createPublicInquiryOutboxDrainHandler({
    env: { PUBLIC_INQUIRY_INTAKE_ENABLED: 'true', MOREMINDMAP_SERVER_ONLY_INQUIRY_OUTBOX_DRAIN_SECRET: drainSecret },
    runtimeFactory: async () => runtime,
  });
  const res = response();
  await handler({ method: 'POST', headers: { authorization: `Bearer ${drainSecret}` }, body: { limit: 999 } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload, { ok: true, attempted: 20, delivered: 18, retry_pending: 1, failed: 1 });
  assert.equal(dispatched.length, 20);
  assert.equal(removed.length, 18);
  assert.equal(closed, 1);
  assert.equal(JSON.stringify(res.payload).includes('outbox_synthetic'), false);
  assert.equal(JSON.stringify(res.payload).includes('customer_value'), false);
});

test('drain stays fail-closed when disabled even with a valid secret', async () => {
  let runtimeCalls = 0;
  const handler = createPublicInquiryOutboxDrainHandler({
    env: { PUBLIC_INQUIRY_INTAKE_ENABLED: 'false', MOREMINDMAP_SERVER_ONLY_INQUIRY_OUTBOX_DRAIN_SECRET: drainSecret },
    runtimeFactory: async () => { runtimeCalls += 1; },
  });
  const res = response();
  await handler({ method: 'POST', headers: { authorization: `Bearer ${drainSecret}` }, body: {} }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(runtimeCalls, 0);
});

test('drain authorization secret is never included in its public response', async () => {
  const handler = createPublicInquiryOutboxDrainHandler({
    env: { PUBLIC_INQUIRY_INTAKE_ENABLED: 'true', MOREMINDMAP_SERVER_ONLY_INQUIRY_OUTBOX_DRAIN_SECRET: drainSecret },
    runtimeFactory: async () => ({
      store: { async smembers() { return []; }, async srem() { throw new Error('must_not_run'); } },
      service: { async dispatchInquiry() { throw new Error('must_not_run'); } },
    }),
  });
  const res = response();
  await handler({ method: 'POST', headers: { authorization: `Bearer ${drainSecret}` }, body: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(Buffer.from(JSON.stringify(res.payload)).includes(Buffer.from(drainSecret)), false);
});
