/* global process */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  PUBLIC_PRODUCT_CATALOG_SHA256,
  PUBLIC_PRODUCTS,
  publicCatalogProjection,
} from '../src/lib/publicSiteAirlockV1/contracts.js';
import { createPublicSiteService } from '../src/lib/publicSiteAirlockV1/service.js';
import { MemoryPublicStore } from '../src/lib/publicSiteAirlockV1/memoryStore.js';
import { complimentaryDigest, nonsecretRuntimeAttestation, runtimeFlags } from '../src/lib/publicSiteAirlockV1/security.js';
import { createInquiryHandler } from '../src/lib/publicSiteAirlockV1/handlers.js';
import { authorizeProductRequest } from '../src/lib/publicSiteAirlockV1/productBoundary.js';
import { resolveProductionAthleteDestination } from '../src/publicSiteV21Config.js';
import { createNewBosProductionRouteHandler } from '../api/engine/newBosProductionReadinessV1/routeHandler.js';
import legacyCheckoutHandler from '../api/stripe/create-checkout-session.js';
import accessStatusHandler from '../api/stripe/access-status.js';
import { processEvent } from '../api/stripe/webhook.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const signingKey = 'test-start-signing-key-that-is-at-least-thirty-two-characters';
const pepper = 'test-complimentary-pepper-that-is-at-least-thirty-two-characters';
const profileId = 'mm-20990101-demo0001';
const realEstateSelection = { vertical_id: 'real_estate', confirmation: 'CUSTOMER_CONFIRMED' };

function buildService(options = {}) {
  const store = options.store || new MemoryPublicStore();
  const transport = options.inquiryTransport || { send: async () => ({ id: 'mock-delivery-1' }) };
  return {
    store,
    service: createPublicSiteService({
      store,
      clock: options.clock || (() => Date.parse('2099-01-01T00:00:00.000Z')),
      startSigningKey: signingKey,
      complimentaryPepper: pepper,
      complimentaryManifest: options.complimentaryManifest || '[]',
      profileStateReader: options.profileStateReader || (async () => ({ bos: 'ready', ba: 'ready' })),
      ownershipVerifier: options.ownershipVerifier || (async () => false),
      inquiryTransport: transport,
    }),
  };
}

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    ended: false,
    setHeader(key, value) { this.headers[String(key).toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.payload = value; return this; },
    end() { this.ended = true; return this; },
  };
}

test('frozen public catalog converges active launch prices and keeps subscription gated', () => {
  assert.equal(PUBLIC_PRODUCTS.behavior_operating_system.price_minor, 14900);
  assert.equal(PUBLIC_PRODUCTS.business_assessment.price_minor, 4900);
  assert.equal(PUBLIC_PRODUCTS.more_monthly_intelligence.price_minor, 3895);
  assert.equal(PUBLIC_PRODUCTS.more_monthly_intelligence.destination, null);
  assert.match(PUBLIC_PRODUCT_CATALOG_SHA256, /^[a-f0-9]{64}$/u);
  const projected = publicCatalogProjection({ checkoutEnabled: true, subscriptionEnabled: false });
  assert.equal(projected.products.find((item) => item.product_key === 'more_monthly_intelligence').checkout_state, 'gated');
});

test('runtime mutation flags default off and nonsecret attestation excludes secrets', () => {
  const flags = runtimeFlags({});
  assert.deepEqual(flags, {
    checkout_enabled: false,
    complimentary_redemption_enabled: false,
    inquiry_intake_enabled: false,
    product_start_enforcement_enabled: false,
    subscription_checkout_enabled: false,
  });
  const attestation = nonsecretRuntimeAttestation({ STRIPE_SECRET_KEY: 'must-not-escape', REDIS_URL: 'must-not-escape' });
  assert.doesNotMatch(JSON.stringify(attestation), /must-not-escape/u);
  assert.match(attestation.sha256, /^[a-f0-9]{64}$/u);
});

test('Production Athlete route seam fails closed unless an HTTPS or same-origin path is configured', () => {
  assert.equal(resolveProductionAthleteDestination(''), '');
  assert.equal(resolveProductionAthleteDestination('http://unfinished.example.test'), '');
  assert.equal(resolveProductionAthleteDestination('javascript:alert(1)'), '');
  assert.equal(resolveProductionAthleteDestination('/more-athlete'), '/more-athlete');
  assert.equal(resolveProductionAthleteDestination('https://athlete.example.test/'), 'https://athlete.example.test/');
});

test('purchase intent is idempotent and BA binds the existing Cassette Foundation contract', async () => {
  const { store, service } = buildService();
  const bosInput = { product_key: 'behavior_operating_system', idempotency_key: 'checkout-bos-000001' };
  const first = await service.createPurchaseIntent(bosInput);
  const replay = await service.createPurchaseIntent(bosInput);
  assert.equal(first.intent_id, replay.intent_id);
  assert.equal(replay.idempotent, true);

  const ba = await service.createPurchaseIntent({
    product_key: 'business_assessment',
    profile_id: profileId,
    vertical_selection: realEstateSelection,
    idempotency_key: 'checkout-ba-0000001',
  });
  assert.equal(ba.vertical_binding.vertical_id, 'real_estate');
  assert.equal(ba.vertical_binding.intake_contract_id, 'real-estate-business-assessment-intake-v1');
  assert.equal(ba.vertical_binding.evidence_contract_id, 'real-estate-business-evidence-routing-v1');
  assert.equal(store.snapshot().effects.filter(([op, key]) => op === 'set' && key.includes('purchase_intent:')).length, 2);
});

test('BA purchase fails closed without completed BOS or explicit supported vertical', async () => {
  const missingBos = buildService({ profileStateReader: async () => ({ bos: 'missing', ba: 'missing' }) }).service;
  await assert.rejects(() => missingBos.createPurchaseIntent({ product_key: 'business_assessment', profile_id: profileId, vertical_selection: realEstateSelection, idempotency_key: 'checkout-ba-missing' }), /completed_bos_required/u);
  const { service } = buildService();
  await assert.rejects(() => service.createPurchaseIntent({ product_key: 'business_assessment', profile_id: profileId, idempotency_key: 'checkout-ba-novertical' }), /BA_VERTICAL_SELECTION_UNCONFIRMED/u);
  await assert.rejects(() => service.createPurchaseIntent({ product_key: 'business_assessment', profile_id: profileId, vertical_selection: { vertical_id: 'loan_originator', confirmation: 'CUSTOMER_CONFIRMED' }, idempotency_key: 'checkout-ba-unsupported' }), /BA_VERTICAL_SELECTION_UNSUPPORTED|BA_CASSETTE_REGISTRATION_MISSING/u);
});

test('payment event repair resumes after a partial failure and never duplicates its grant', async () => {
  class FailFinalEventOnceStore extends MemoryPublicStore {
    constructor() { super(); this.failed = false; }
    async set(key, value) {
      if (!this.failed && key.startsWith('payment_event_v2:') && JSON.parse(value).phase === 'complete') {
        this.failed = true;
        throw new Error('synthetic_final_event_write_failure');
      }
      return super.set(key, value);
    }
  }
  const store = new FailFinalEventOnceStore();
  const { service } = buildService({ store });
  const intent = await service.createPurchaseIntent({ product_key: 'behavior_operating_system', idempotency_key: 'checkout-repair-001' });
  const input = { event_id: 'evt_repair_1', checkout_session_id: 'cs_repair_1', intent_id: intent.intent_id, payment_truth: 'provider_confirmed', customer_email: 'owner@example.test' };
  await assert.rejects(() => service.recordPaymentGrant(input), /synthetic_final_event_write_failure/u);
  const repaired = await service.recordPaymentGrant(input);
  assert.equal(repaired.grant.grant_id, 'grant_cs_repair_1');
  assert.equal(repaired.grant.status, 'active');
  const grantWrites = store.snapshot().effects.filter(([op, key]) => op === 'set' && key === 'access_grant:grant_cs_repair_1');
  assert.equal(grantWrites.length, 2, 'deterministic replay may rewrite but cannot fork the grant');
  assert.deepEqual(await store.smembers('access_grant_by_session:cs_repair_1'), ['grant_cs_repair_1']);
});

test('governed webhook grant preserves Cassette vertical binding instead of being replayed as legacy', async () => {
  const { store, service } = buildService();
  const intent = await service.createPurchaseIntent({
    product_key: 'business_assessment',
    profile_id: profileId,
    vertical_selection: realEstateSelection,
    idempotency_key: 'checkout-webhook-binding-001',
  });
  const event = {
    id: 'evt_governed_ba_1',
    type: 'checkout.session.completed',
    livemode: false,
    created: 4070908800,
    data: {
      object: {
        id: 'cs_governed_ba_1',
        mode: 'payment',
        payment_status: 'paid',
        amount_total: 4900,
        currency: 'usd',
        customer_details: { email: 'owner@example.test' },
        metadata: {
          product_key: 'business_assessment',
          access_type: 'business_assessment',
          purchase_intent_id: intent.intent_id,
          profile_id: profileId,
        },
      },
    },
  };
  await processEvent(store, event);
  const grant = JSON.parse(await store.get('access_grant:grant_cs_governed_ba_1'));
  assert.equal(grant.purchase_intent_id, intent.intent_id);
  assert.equal(grant.vertical_binding.vertical_id, 'real_estate');
  assert.equal(grant.vertical_binding.intake_contract_id, 'real-estate-business-assessment-intake-v1');
  assert.equal(grant.vertical_binding.evidence_contract_id, 'real-estate-business-evidence-routing-v1');
});

test('parallel duplicate purchase intent cannot create two intents', async () => {
  const { store, service } = buildService();
  const input = { product_key: 'behavior_operating_system', idempotency_key: 'parallel-checkout-0001' };
  const outcomes = await Promise.allSettled([service.createPurchaseIntent(input), service.createPurchaseIntent(input)]);
  assert.equal(outcomes.filter((item) => item.status === 'fulfilled').length >= 1, true);
  const retry = await service.createPurchaseIntent(input);
  const ids = Object.values(store.snapshot().values).map((value) => { try { return JSON.parse(value).intent_id; } catch { return null; } }).filter(Boolean);
  assert.equal(new Set(ids).size, 1);
  assert.equal(retry.idempotent, true);
});

test('complimentary capability remains server-digested, product-scoped, bounded and idempotent', async () => {
  const bosCode = 'synthetic-bos-capability-never-shipped';
  const baCode = 'synthetic-ba-capability-never-shipped';
  const manifest = JSON.stringify([
    { digest: complimentaryDigest(bosCode, pepper), product_key: 'behavior_operating_system', capability_id: 'synthetic-bos', expires_at: '2099-02-01T00:00:00.000Z', max_uses: 1 },
    { digest: complimentaryDigest(baCode, pepper), product_key: 'business_assessment', capability_id: 'synthetic-ba', expires_at: '2099-02-01T00:00:00.000Z', max_uses: 1 },
  ]);
  const { service } = buildService({ complimentaryManifest: manifest });
  const bos = await service.redeemComplimentary({ product_key: 'behavior_operating_system', capability: bosCode, idempotency_key: 'comp-bos-redeem-001' });
  const replay = await service.redeemComplimentary({ product_key: 'behavior_operating_system', capability: bosCode, idempotency_key: 'comp-bos-redeem-001' });
  assert.equal(bos.grant.grant_id, replay.grant.grant_id);
  assert.equal(replay.idempotent, true);
  await assert.rejects(() => service.redeemComplimentary({ product_key: 'business_assessment', capability: baCode, idempotency_key: 'comp-ba-missing-profile' }), /profile_id_required/u);
  const ba = await service.redeemComplimentary({ product_key: 'business_assessment', capability: baCode, profile_id: profileId, vertical_selection: realEstateSelection, idempotency_key: 'comp-ba-redeem-0001' });
  assert.equal(ba.grant.profile_id, profileId);
  assert.equal(ba.grant.vertical_id, 'real_estate');
  assert.equal(JSON.stringify(ba).includes(baCode), false);
});

test('start token and Product start are bound and idempotent', async () => {
  const { service } = buildService();
  const intent = await service.createPurchaseIntent({ product_key: 'behavior_operating_system', idempotency_key: 'checkout-start-0001' });
  const paid = await service.recordPaymentGrant({ event_id: 'evt_start_1', checkout_session_id: 'cs_start_1', intent_id: intent.intent_id, payment_truth: 'provider_confirmed' });
  const token = await service.createStartTokenForGrant({ grant_id: paid.grant.grant_id });
  const first = await service.startProduct({ start_token: token.start_token });
  const replay = await service.startProduct({ start_token: token.start_token });
  assert.equal(first.destination, '/profile');
  assert.equal(first.start_id, replay.start_id);
  assert.equal(replay.idempotent, true);
});

test('profile locator does not reveal existence until subject ownership is verified', async () => {
  const unverified = buildService({ ownershipVerifier: async () => false }).service;
  assert.deepEqual(await unverified.lookupEntry({ value: profileId }), { state: 'ownership_verification_required' });
  const verified = buildService({ ownershipVerifier: async () => true }).service;
  assert.deepEqual(await verified.lookupEntry({ value: profileId }), { state: 'ready', profile_id: profileId, business_assessment_state: 'ready' });
});

test('inquiry intake is concurrent-idempotent and delivery failure never loses the accepted receipt', async () => {
  let attempts = 0;
  const transport = { send: async () => { attempts += 1; if (attempts === 1) throw new Error('synthetic_transport_down'); return { id: 'sandbox-delivery-2' }; } };
  const { store, service } = buildService({ inquiryTransport: transport });
  const input = { name: 'Synthetic Founder', phone: '6025550101', email: 'founder@example.test', idempotency_key: 'inquiry-concurrent-001' };
  const [a, b] = await Promise.all([service.createInquiry(input), service.createInquiry(input)]);
  assert.equal(a.receipt_id, b.receipt_id);
  assert.equal((await store.smembers('public_inquiry_v1:outbox:pending')).length, 1);
  const outboxId = `outbox_${a.receipt_id}`;
  assert.equal((await service.dispatchInquiry(outboxId)).state, 'retry_pending');
  assert.equal(JSON.parse(await store.get(`public_inquiry_v1:receipt:${a.receipt_id}`)).state, 'accepted_for_delivery');
  assert.equal((await service.dispatchInquiry(outboxId)).state, 'delivered');
  assert.equal((await service.dispatchInquiry(outboxId)).idempotent, true);
  assert.equal(attempts, 2);
});

test('disallowed CORS origin is denied before store, grant, provider or outbox work', async () => {
  let factoryCalls = 0;
  const handler = createInquiryHandler({ env: { PUBLIC_ALLOWED_ORIGINS: 'https://moremindmap.com', PUBLIC_INQUIRY_INTAKE_ENABLED: 'true' }, serviceFactory: async () => { factoryCalls += 1; throw new Error('must_not_run'); } });
  const req = { method: 'POST', headers: { origin: 'https://attacker.example.test' }, body: { name: 'A', phone: '6025550101', email: 'a@example.test' } };
  const res = createResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 403);
  assert.equal(factoryCalls, 0);
});

test('rate limits fail closed without creating purchase, grant or inquiry records', async () => {
  const { store, service } = buildService();
  for (let index = 0; index < 2; index += 1) {
    await service.enforceRateLimit({ scope: 'synthetic', identity: '203.0.113.9', limit: 2 });
  }
  await assert.rejects(
    () => service.enforceRateLimit({ scope: 'synthetic', identity: '203.0.113.9', limit: 2 }),
    /rate_limited/u,
  );
  const keys = Object.keys(store.snapshot().values);
  assert.equal(keys.some((key) => /purchase_intent|access_grant|public_inquiry/u.test(key)), false);
});

test('legacy checkout is default-off and access status accepts only opaque checkout session lookup', async () => {
  const prior = process.env.PUBLIC_LEGACY_STRIPE_CHECKOUT_ENABLED;
  delete process.env.PUBLIC_LEGACY_STRIPE_CHECKOUT_ENABLED;
  try {
    const checkoutResponse = createResponse();
    await legacyCheckoutHandler({ method: 'POST', headers: {}, body: { product_key: 'behavior_operating_system' } }, checkoutResponse);
    assert.equal(checkoutResponse.statusCode, 404);
    assert.equal(checkoutResponse.payload.error, 'not_found');

    const statusResponse = createResponse();
    await accessStatusHandler({ method: 'GET', headers: {}, query: { email: 'owner@example.test' } }, statusResponse);
    assert.equal(statusResponse.statusCode, 400);
    assert.equal(statusResponse.payload.error, 'checkout_session_required');
  } finally {
    if (prior === undefined) delete process.env.PUBLIC_LEGACY_STRIPE_CHECKOUT_ENABLED;
    else process.env.PUBLIC_LEGACY_STRIPE_CHECKOUT_ENABLED = prior;
  }
});

test('product data access requires a valid server grant when enforcement is enabled', async () => {
  const { store } = buildService();
  await assert.rejects(
    () => authorizeProductRequest({
      req: { headers: {} },
      store,
      productKey: 'business_assessment',
      profileId,
      env: {
        PUBLIC_PRODUCT_START_ENFORCEMENT_ENABLED: 'true',
        PUBLIC_PRODUCT_START_SIGNING_KEY: signingKey,
      },
    }),
    /public_product_/u,
  );
  assert.deepEqual(store.snapshot().effects, []);
});

test('matching a direct deployment Host never grants protected New BOS operator authority', async () => {
  const seen = [];
  const secret = 'synthetic-platform-authority-secret-1234567890';
  const handler = createNewBosProductionRouteHandler({
    config: { staged: true, canaryEnabled: true, customerActive: false, platformAuthoritySecret: secret },
    serviceFactory: async () => ({ inspectResumable: async (input) => { seen.push(input); return { ok: true }; } }),
  });
  const req = { method: 'GET', headers: { host: 'candidate.vercel.app', 'x-new-bos-canary-token': 'wrong' }, query: { diagnostic: 'resumable-state', id: 'MM-20990101-DEMO0001' } };
  const res = createResponse();
  await handler(req, res);
  assert.equal(seen[0].platformProtected, false);
  const authorized = { ...req, headers: { ...req.headers, 'x-more-platform-authority': secret } };
  await handler(authorized, createResponse());
  assert.equal(seen[1].platformProtected, true);
});

test('deployable API tree contains no identified diagnostic, test or raw handlers', () => {
  const forbidden = [
    'api/diagnostic.js', 'api/diagnostic-repair.js', 'api/get-raw-job.js', 'api/ping-test.js',
    'api/test.js', 'api/test-redis.js', 'api/test-update-job.js', 'api/moremindmap/inspect-job.js',
    'api/moremindmap/mini-profile-v2.js', 'api/moremindmap/ping.js',
    'api/engine/testMiniProfileGenerator.js', 'api/engine/testScore.js',
    ...Array.from({ length: 6 }, (_, index) => `api/moremindmap/start-test${index ? index + 1 : ''}.js`),
  ];
  forbidden.forEach((relative) => assert.equal(fs.existsSync(path.join(root, relative)), false, relative));
  const diagnosticDirectory = path.join(root, 'api/diagnostic');
  if (fs.existsSync(diagnosticDirectory)) assert.deepEqual(fs.readdirSync(diagnosticDirectory), []);
  assert.equal(fs.existsSync(path.join(root, 'quarantined-api-source/README.md')), true);
});

test('active client source contains no prior complimentary capability values, stale price or payment bypass link', () => {
  const files = ['src/Profile.jsx', 'src/BusinessAssessment.jsx', 'src/PublicSiteV21.jsx', 'src/PaymentSuccess.jsx', 'src/PaymentCancelled.jsx', 'src/components/businessAssessment/BAMonthlyIntelligenceCard.jsx'];
  const source = files.map((relative) => fs.readFileSync(path.join(root, relative), 'utf8')).join('\n');
  assert.doesNotMatch(source, /FATHOMFREE|MOREFREE26|BA5FREE/u);
  assert.doesNotMatch(source, /\$23\.95|\$28\.95/u);
  assert.match(source, /\$38\.95/u);
  assert.doesNotMatch(source, /Coach Connect/u);
  const paymentSuccess = fs.readFileSync(path.join(root, 'src/PaymentSuccess.jsx'), 'utf8');
  assert.doesNotMatch(paymentSuccess, /to="\/(?:profile|business-assessment)"/u);
  assert.match(paymentSuccess, /Continue To Product/u);
});
