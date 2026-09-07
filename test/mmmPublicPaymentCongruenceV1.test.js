import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertGovernedPublicCheckoutBinding,
  processEvent,
} from '../api/stripe/webhook.js';
import {
  PUBLIC_ACCESS_CONTRACT_VERSION,
  PUBLIC_PRODUCT_CONTRACT_VERSION,
} from '../src/lib/publicSiteAirlockV1/contracts.js';
import { MemoryPublicStore } from '../src/lib/publicSiteAirlockV1/memoryStore.js';
import { createPublicSiteService } from '../src/lib/publicSiteAirlockV1/service.js';

const TEST_ENV = Object.freeze({
  PUBLIC_STRIPE_MODE: 'test',
  PUBLIC_PRODUCT_START_SIGNING_KEY: 'synthetic-public-start-key-at-least-thirty-two-characters',
  PUBLIC_COMPLIMENTARY_PEPPER: 'synthetic-complimentary-pepper-at-least-thirty-two-characters',
});
const PROFILE_ID = 'mm-20990101-paytest1';
const TEST_NOW = Date.parse('2099-01-01T00:00:00.000Z');
const REAL_ESTATE_SELECTION = Object.freeze({
  vertical_id: 'real_estate',
  confirmation: 'CUSTOMER_CONFIRMED',
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function serviceFor(store) {
  return createPublicSiteService({
    store,
    clock: () => TEST_NOW,
    startSigningKey: TEST_ENV.PUBLIC_PRODUCT_START_SIGNING_KEY,
    complimentaryPepper: TEST_ENV.PUBLIC_COMPLIMENTARY_PEPPER,
    complimentaryManifest: '[]',
    profileStateReader: async () => ({ bos: 'ready', ba: 'ready' }),
    ownershipVerifier: async () => true,
  });
}

async function createFixture(productKey, store = new MemoryPublicStore()) {
  const service = serviceFor(store);
  const intent = await service.createPurchaseIntent(
    productKey === 'business_assessment'
      ? {
          product_key: productKey,
          profile_id: PROFILE_ID,
          vertical_selection: REAL_ESTATE_SELECTION,
          idempotency_key: `payment-congruence-${productKey}`,
        }
      : {
          product_key: productKey,
          idempotency_key: `payment-congruence-${productKey}`,
        },
    { cookie_header: 'synthetic-owner-cookie' },
  );
  return { intent, service, store };
}

function eventFor(intent, suffix = intent.product_key) {
  return {
    id: `evt_test_${suffix}`,
    type: 'checkout.session.completed',
    livemode: false,
    created: 4070908800,
    data: {
      object: {
        id: `cs_test_${suffix}`,
        livemode: false,
        mode: 'payment',
        payment_status: 'paid',
        amount_total: intent.expected_price_minor,
        currency: intent.currency,
        client_reference_id: intent.profile_id || intent.intent_id,
        customer_details: { email: 'synthetic-owner@example.test' },
        metadata: {
          product_key: intent.product_key,
          access_type: intent.access_type,
          purchase_intent_id: intent.intent_id,
          profile_id: intent.profile_id || '',
          vertical_binding_sha256: intent.vertical_binding?.binding_sha256 || '',
          internal_version: 'mmm-public-product-v1',
        },
      },
    },
  };
}

function durableSnapshot(store) {
  const snapshot = store.snapshot();
  return { values: snapshot.values, sets: snapshot.sets };
}

function legacyGrantFor(intent, event) {
  return {
    grant_id: `grant_${event.data.object.id}`,
    product_key: intent.product_key,
    access_type: intent.access_type,
    email: 'synthetic-owner@example.test',
    profile_id: intent.profile_id,
    source: 'paid_stripe',
    stripe_event_id: event.id,
    checkout_session_id: event.data.object.id,
    status: 'active',
    created_at: '2098-12-31T23:55:00.000Z',
    updated_at: '2098-12-31T23:55:00.000Z',
    internal_version: 'legacy-stripe-projection-v1',
  };
}

async function assertAcceptedFixture(productKey) {
  const { intent, store } = await createFixture(productKey);
  const event = eventFor(intent);
  const bound = await assertGovernedPublicCheckoutBinding(
    store,
    event,
    event.data.object,
    intent.intent_id,
    TEST_ENV,
  );
  assert.equal(bound.intent_id, intent.intent_id);
  assert.equal(intent.contract_version, PUBLIC_PRODUCT_CONTRACT_VERSION);

  const processed = await processEvent(store, event, TEST_ENV);
  assert.deepEqual(processed, { processed: true, idempotent: false });
  const grant = JSON.parse(await store.get(`access_grant:grant_${event.data.object.id}`));
  assert.equal(grant.product_key, intent.product_key);
  assert.equal(grant.access_type, intent.access_type);
  assert.equal(grant.profile_id, intent.profile_id);
  assert.deepEqual(grant.vertical_binding, intent.vertical_binding);
  assert.equal(grant.source, 'paid_stripe');
  assert.equal(grant.status, 'active');
  assert.equal(grant.contract_version, PUBLIC_ACCESS_CONTRACT_VERSION);
  return { event, grant, intent, store };
}

async function assertPreEffectRejection({ productKey, mutate, expected }) {
  const { intent, store } = await createFixture(productKey);
  const event = eventFor(intent, `rejected_${productKey}`);
  mutate(event);
  const before = store.snapshot();

  await assert.rejects(
    () => assertGovernedPublicCheckoutBinding(
      store,
      event,
      event.data.object,
      intent.intent_id,
      TEST_ENV,
    ),
    expected,
  );
  assert.deepEqual(store.snapshot(), before, 'direct binding rejection must be read-only');

  await assert.rejects(() => processEvent(store, event, TEST_ENV), expected);
  assert.deepEqual(store.snapshot(), before, 'webhook rejection must occur before every effect');
}

test('governed BOS test-mode checkout event is congruent and creates one exact grant', async () => {
  const { grant, intent } = await assertAcceptedFixture('behavior_operating_system');
  assert.equal(intent.expected_price_minor, 14900);
  assert.equal(intent.currency, 'usd');
  assert.equal(intent.cadence, 'one_time');
  assert.equal(grant.profile_id, '');
  assert.equal(grant.vertical_binding, null);
});

test('governed BA test-mode checkout event preserves exact Profile and vertical digest', async () => {
  const { event, grant, intent } = await assertAcceptedFixture('business_assessment');
  assert.equal(intent.expected_price_minor, 4900);
  assert.equal(intent.currency, 'usd');
  assert.equal(intent.cadence, 'one_time');
  assert.equal(grant.profile_id, PROFILE_ID);
  assert.equal(
    event.data.object.metadata.vertical_binding_sha256,
    intent.vertical_binding.binding_sha256,
  );
  assert.equal(grant.vertical_binding.binding_sha256, intent.vertical_binding.binding_sha256);
});

test('every public Stripe congruence mismatch is rejected before any store effect', async (t) => {
  const cases = [
    {
      name: 'live event in test mode',
      productKey: 'behavior_operating_system',
      mutate: (event) => {
        event.livemode = true;
        event.data.object.livemode = true;
      },
      expected: /stripe_event_mode_mismatch/u,
    },
    {
      name: 'live checkout-session prefix in test mode',
      productKey: 'behavior_operating_system',
      mutate: (event) => { event.data.object.id = 'cs_live_wrong_environment'; },
      expected: /stripe_public_checkout_binding_mismatch/u,
    },
    {
      name: 'object live mode disagrees with test event',
      productKey: 'behavior_operating_system',
      mutate: (event) => { event.data.object.livemode = true; },
      expected: /stripe_public_checkout_binding_mismatch/u,
    },
    {
      name: 'amount',
      productKey: 'behavior_operating_system',
      mutate: (event) => { event.data.object.amount_total += 1; },
      expected: /stripe_public_checkout_binding_mismatch/u,
    },
    {
      name: 'currency',
      productKey: 'behavior_operating_system',
      mutate: (event) => { event.data.object.currency = 'eur'; },
      expected: /stripe_public_checkout_binding_mismatch/u,
    },
    {
      name: 'checkout mode',
      productKey: 'behavior_operating_system',
      mutate: (event) => { event.data.object.mode = 'subscription'; },
      expected: /stripe_public_checkout_binding_mismatch/u,
    },
    {
      name: 'product',
      productKey: 'behavior_operating_system',
      mutate: (event) => { event.data.object.metadata.product_key = 'business_assessment'; },
      expected: /stripe_public_checkout_binding_mismatch/u,
    },
    {
      name: 'access type',
      productKey: 'behavior_operating_system',
      mutate: (event) => { event.data.object.metadata.access_type = 'business_assessment'; },
      expected: /stripe_public_checkout_binding_mismatch/u,
    },
    {
      name: 'Profile binding',
      productKey: 'business_assessment',
      mutate: (event) => { event.data.object.metadata.profile_id = 'mm-20990101-attacker'; },
      expected: /stripe_public_checkout_binding_mismatch/u,
    },
    {
      name: 'vertical binding digest',
      productKey: 'business_assessment',
      mutate: (event) => { event.data.object.metadata.vertical_binding_sha256 = 'f'.repeat(64); },
      expected: /stripe_public_checkout_binding_mismatch/u,
    },
    {
      name: 'client reference',
      productKey: 'business_assessment',
      mutate: (event) => { event.data.object.client_reference_id = 'mm-20990101-attacker'; },
      expected: /stripe_public_checkout_binding_mismatch/u,
    },
  ];

  for (const caseDefinition of cases) {
    await t.test(caseDefinition.name, () => assertPreEffectRejection(caseDefinition));
  }
});

test('explicit Stripe mode applies to legacy/no-intent events before every store effect', async () => {
  const store = new MemoryPublicStore();
  const event = {
    id: 'evt_live_legacy_wrong_mode',
    type: 'checkout.session.completed',
    livemode: true,
    created: 4070908800,
    data: {
      object: {
        id: 'cs_live_legacy_wrong_mode',
        livemode: true,
        mode: 'payment',
        payment_status: 'paid',
        amount_total: 14900,
        currency: 'usd',
        metadata: {
          product_key: 'behavior_operating_system',
          access_type: 'behavior_operating_system',
        },
      },
    },
  };
  const before = store.snapshot();
  await assert.rejects(() => processEvent(store, event, TEST_ENV), /stripe_event_mode_mismatch/u);
  assert.deepEqual(store.snapshot(), before);
});

test('persisted purchase-intent identity and catalog contract are verified before effects', async (t) => {
  const cases = [
    ['contract version', (intent) => { intent.contract_version = 'stale-contract'; }],
    ['intent identity', (intent) => { intent.intent_id = 'pi_more_different'; }],
    ['product', (intent) => { intent.product_key = 'unknown_product'; }],
    ['access type', (intent) => { intent.access_type = 'business_assessment'; }],
    ['catalog price', (intent) => { intent.expected_price_minor += 1; }],
    ['catalog currency', (intent) => { intent.currency = 'eur'; }],
    ['catalog cadence', (intent) => { intent.cadence = 'monthly'; }],
    ['lifecycle state', (intent) => { intent.status = 'unknown'; }],
    ['granted session binding', (intent) => {
      intent.status = 'granted';
      intent.grant_id = 'grant_cs_test_wrong_session';
      intent.updated_at = '2099-01-01T00:01:00.000Z';
    }],
    ['vertical authority body', (intent) => { intent.vertical_binding.vertical_label = 'Tampered'; }],
  ];

  for (const [name, mutate] of cases) {
    await t.test(name, async () => {
      const productKey = name === 'vertical authority body'
        ? 'business_assessment'
        : 'behavior_operating_system';
      const { intent, store } = await createFixture(productKey);
      const event = eventFor(intent, `persisted_${name.replaceAll(' ', '_')}`);
      const corrupted = clone(intent);
      mutate(corrupted);
      await store.set(
        `public_product_v1:purchase_intent:${intent.intent_id}`,
        JSON.stringify(corrupted),
      );
      const before = store.snapshot();
      await assert.rejects(
        () => processEvent(store, event, TEST_ENV),
        /purchase_intent_contract_invalid/u,
      );
      assert.deepEqual(store.snapshot(), before);
    });
  }
});

test('exact same-session legacy grant is rebuilt from governed intent authority', async () => {
  const { intent, store } = await createFixture('business_assessment');
  const event = eventFor(intent, 'legacy_upgrade');
  const grantKey = `access_grant:grant_${event.data.object.id}`;
  const legacy = legacyGrantFor(intent, event);
  await store.set(grantKey, JSON.stringify(legacy));

  await processEvent(store, event, TEST_ENV);

  const upgraded = JSON.parse(await store.get(grantKey));
  assert.equal(upgraded.contract_version, PUBLIC_ACCESS_CONTRACT_VERSION);
  assert.equal(upgraded.purchase_intent_id, intent.intent_id);
  assert.equal(upgraded.checkout_session_id, event.data.object.id);
  assert.equal(upgraded.stripe_event_id, event.id);
  assert.equal(upgraded.created_at, legacy.created_at);
  assert.deepEqual(upgraded.vertical_binding, intent.vertical_binding);
  assert.equal('internal_version' in upgraded, false);
});

test('occupied governed grant key rejects every conflicting authority binding', async (t) => {
  const cases = [
    ['session', (grant) => { grant.checkout_session_id = 'cs_test_other'; }],
    ['product', (grant) => { grant.product_key = 'behavior_operating_system'; }],
    ['access type', (grant) => { grant.access_type = 'behavior_operating_system'; }],
    ['Profile', (grant) => { grant.profile_id = 'mm-20990101-attacker'; }],
    ['intent', (grant) => { grant.purchase_intent_id = 'pi_more_other'; }],
    ['event', (grant) => { grant.stripe_event_id = 'evt_test_other'; }],
    ['vertical', (grant) => { grant.vertical_binding = { binding_sha256: 'f'.repeat(64) }; }],
  ];

  for (const [name, mutate] of cases) {
    await t.test(name, async () => {
      const { intent, store } = await createFixture('business_assessment');
      const event = eventFor(intent, `grant_collision_${name.replaceAll(' ', '_')}`);
      const grantKey = `access_grant:grant_${event.data.object.id}`;
      const collision = legacyGrantFor(intent, event);
      mutate(collision);
      await store.set(grantKey, JSON.stringify(collision));
      const before = store.snapshot();

      await assert.rejects(() => processEvent(store, event, TEST_ENV), /payment_grant_collision/u);
      assert.deepEqual(store.snapshot(), before);
    });
  }
});

test('V2 event journal rejects replay under a different intent and session identity', async () => {
  const store = new MemoryPublicStore();
  const { intent: bosIntent } = await createFixture('behavior_operating_system', store);
  const bosEvent = eventFor(bosIntent, 'journal_identity_bos');
  await processEvent(store, bosEvent, TEST_ENV);

  const { intent: baIntent } = await createFixture('business_assessment', store);
  const collision = eventFor(baIntent, 'journal_identity_ba');
  collision.id = bosEvent.id;
  const before = store.snapshot();

  await assert.rejects(
    () => processEvent(store, collision, TEST_ENV),
    /payment_event_journal_collision/u,
  );
  assert.deepEqual(store.snapshot(), before);
});

test('duplicate governed event is idempotent and cannot fork durable grant or indexes', async () => {
  const { event, store } = await assertAcceptedFixture('behavior_operating_system');
  const before = durableSnapshot(store);
  const replay = await processEvent(store, clone(event), TEST_ENV);

  assert.deepEqual(replay, { processed: true, idempotent: true });
  assert.deepEqual(durableSnapshot(store), before);
  assert.deepEqual(
    await store.smembers(`access_grant_by_session:${event.data.object.id}`),
    [`grant_${event.data.object.id}`],
  );
  assert.equal(
    Object.keys(store.snapshot().values).filter((key) => key.startsWith('access_grant:')).length,
    1,
  );
});

test('partial public-grant journal failure resumes deterministically without duplicate grant', async () => {
  const eventId = 'evt_test_partial_resume';
  class FailFinalGrantJournalOnceStore extends MemoryPublicStore {
    constructor() {
      super();
      this.failed = false;
    }

    async set(key, value) {
      if (!this.failed && key === `payment_event_v2:${eventId}` && JSON.parse(value).phase === 'complete') {
        this.failed = true;
        throw new Error('synthetic_final_grant_journal_failure');
      }
      return super.set(key, value);
    }
  }

  const store = new FailFinalGrantJournalOnceStore();
  const { intent } = await createFixture('business_assessment', store);
  const event = eventFor(intent, 'partial_resume');
  event.id = eventId;

  await assert.rejects(
    () => processEvent(store, event, TEST_ENV),
    /synthetic_final_grant_journal_failure/u,
  );
  assert.equal(await store.get(`payment_event:${eventId}`), null);
  assert.equal(
    JSON.parse(await store.get(`payment_event_v2:${eventId}`)).phase,
    'processing',
  );
  const expectedGrantId = `grant_${event.data.object.id}`;
  assert.equal(JSON.parse(await store.get(`access_grant:${expectedGrantId}`)).grant_id, expectedGrantId);

  const recovered = await processEvent(store, clone(event), TEST_ENV);
  assert.deepEqual(recovered, { processed: true, idempotent: false });
  assert.equal(
    JSON.parse(await store.get(`payment_event_v2:${eventId}`)).phase,
    'complete',
  );
  assert.deepEqual(
    await store.smembers(`access_grant_by_session:${event.data.object.id}`),
    [expectedGrantId],
  );
  assert.deepEqual(await store.smembers(`access_grant_by_profile:${PROFILE_ID}`), [expectedGrantId]);
  assert.equal(
    Object.keys(store.snapshot().values).filter((key) => key.startsWith('access_grant:')).length,
    1,
  );

  const replay = await processEvent(store, clone(event), TEST_ENV);
  assert.deepEqual(replay, { processed: true, idempotent: true });
  assert.deepEqual(await store.smembers(`access_grant_by_session:${event.data.object.id}`), [expectedGrantId]);
});
