import assert from 'node:assert/strict';
import test from 'node:test';

import { sha256 } from '../src/lib/publicSiteAirlockV1/contracts.js';
import { createPurchaseIntentHandler } from '../src/lib/publicSiteAirlockV1/handlers.js';
import { MemoryPublicStore } from '../src/lib/publicSiteAirlockV1/memoryStore.js';
import { RedisPublicStore } from '../src/lib/publicSiteAirlockV1/redisStore.js';
import { complimentaryDigest } from '../src/lib/publicSiteAirlockV1/security.js';
import { createPublicSiteService } from '../src/lib/publicSiteAirlockV1/service.js';

const NOW = Date.parse('2099-01-01T00:00:00.000Z');
const COMPLIMENTARY_PEPPER = 'synthetic-complimentary-pepper-at-least-thirty-two-characters';

function fixture(store = new MemoryPublicStore(), options = {}) {
  return {
    store,
    service: createPublicSiteService({
      store,
      clock: options.clock || (() => NOW),
      startSigningKey: 'synthetic-start-signing-key-at-least-thirty-two-characters',
      complimentaryPepper: COMPLIMENTARY_PEPPER,
      complimentaryManifest: options.complimentaryManifest || '[]',
      profileStateReader: async () => ({ bos: 'ready', ba: 'ready' }),
      ownershipVerifier: async () => true,
    }),
  };
}

function responseFixture() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    setHeader(key, value) { this.headers[String(key).toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.payload = value; return this; },
    end() { return this; },
  };
}

test('purchase-intent idempotency is bound to the normalized request and rejects corrupt occupied records', async () => {
  const { store, service } = fixture();
  const idempotencyKey = 'security-integrity-checkout-0001';
  const input = {
    product_key: 'behavior_operating_system',
    email: 'first@example.test',
    idempotency_key: idempotencyKey,
  };
  const first = await service.createPurchaseIntent(input);
  const replay = await service.createPurchaseIntent(input);
  assert.equal(replay.intent_id, first.intent_id);
  assert.equal(replay.idempotent, true);
  await assert.rejects(
    service.createPurchaseIntent({ ...input, email: 'different@example.test' }),
    /idempotency_parameter_mismatch/u,
  );

  const corruptKey = 'security-integrity-corrupt-0001';
  await store.set(
    `public_product_v1:purchase_intent_by_idempotency:${sha256(corruptKey)}`,
    JSON.stringify({ intent_id: 'pi_more_corrupt' }),
  );
  await assert.rejects(
    service.createPurchaseIntent({
      product_key: 'behavior_operating_system',
      idempotency_key: corruptKey,
    }),
    /purchase_intent_contract_invalid/u,
  );
});

test('checkout Session exchange requires the exact forward and reverse grant binding', async () => {
  const { store, service } = fixture();
  const intent = await service.createPurchaseIntent({
    product_key: 'behavior_operating_system',
    idempotency_key: 'security-integrity-session-0001',
  });
  const payment = await service.recordPaymentGrant({
    event_id: 'evt_security_integrity_1',
    checkout_session_id: 'cs_test_security_integrity_1',
    intent_id: intent.intent_id,
    payment_truth: 'provider_confirmed',
  });
  await store.sadd('access_grant_by_session:cs_test_forged_binding', payment.grant.grant_id);
  await assert.rejects(
    service.createStartTokenForSession({ checkout_session_id: 'cs_test_forged_binding' }),
    /active_grant_required/u,
  );
  const exact = await service.createStartTokenForSession({ checkout_session_id: 'cs_test_security_integrity_1' });
  assert.equal(exact.grant.grant_id, payment.grant.grant_id);
});

test('distributed locks are released only by atomic token comparison', async () => {
  const { store, service } = fixture();
  await service.createPurchaseIntent({
    product_key: 'behavior_operating_system',
    idempotency_key: 'security-integrity-lock-0001',
  });
  const lockEffects = store.snapshot().effects.filter(([, key]) => key?.endsWith(':lock'));
  assert.equal(lockEffects.some(([operation]) => operation === 'compareDel'), true);
  assert.equal(lockEffects.some(([operation]) => operation === 'del'), false);
});

test('purchase-intent replay repairs a failed canonical mirror before payment can proceed', async () => {
  class FailCanonicalMirrorOnceStore extends MemoryPublicStore {
    constructor() {
      super();
      this.failed = false;
    }

    async setNx(key, value, ttlSeconds) {
      if (!this.failed && key.startsWith('public_product_v1:purchase_intent:')) {
        this.failed = true;
        throw new Error('synthetic_canonical_mirror_failure');
      }
      return super.setNx(key, value, ttlSeconds);
    }
  }

  const store = new FailCanonicalMirrorOnceStore();
  const { service } = fixture(store);
  const input = {
    product_key: 'behavior_operating_system',
    email: 'repair@example.test',
    idempotency_key: 'security-integrity-intent-repair-0001',
  };
  await assert.rejects(service.createPurchaseIntent(input), /synthetic_canonical_mirror_failure/u);
  const idempotencyKey = `public_product_v1:purchase_intent_by_idempotency:${sha256(input.idempotency_key)}`;
  const winner = JSON.parse(await store.get(idempotencyKey));
  assert.equal(await store.get(`public_product_v1:purchase_intent:${winner.intent_id}`), null);

  const repaired = await service.createPurchaseIntent(input);
  assert.equal(repaired.intent_id, winner.intent_id);
  assert.equal(repaired.idempotent, true);
  assert.equal(
    JSON.parse(await store.get(`public_product_v1:purchase_intent:${winner.intent_id}`)).intent_id,
    winner.intent_id,
  );
  const payment = await service.recordPaymentGrant({
    event_id: 'evt_security_intent_repair_1',
    checkout_session_id: 'cs_test_security_intent_repair_1',
    intent_id: winner.intent_id,
    payment_truth: 'provider_confirmed',
  });
  assert.equal(payment.grant.grant_id, 'grant_cs_test_security_intent_repair_1');
});

test('purchase-intent replay never overwrites a conflicting canonical occupant', async () => {
  class FailCanonicalMirrorOnceStore extends MemoryPublicStore {
    constructor() {
      super();
      this.failed = false;
    }

    async setNx(key, value, ttlSeconds) {
      if (!this.failed && key.startsWith('public_product_v1:purchase_intent:')) {
        this.failed = true;
        throw new Error('synthetic_canonical_mirror_failure');
      }
      return super.setNx(key, value, ttlSeconds);
    }
  }

  const store = new FailCanonicalMirrorOnceStore();
  const { service } = fixture(store);
  const input = {
    product_key: 'behavior_operating_system',
    idempotency_key: 'security-integrity-intent-collision-0001',
  };
  await assert.rejects(service.createPurchaseIntent(input), /synthetic_canonical_mirror_failure/u);
  const idempotencyKey = `public_product_v1:purchase_intent_by_idempotency:${sha256(input.idempotency_key)}`;
  const winner = JSON.parse(await store.get(idempotencyKey));
  const occupied = { ...winner, created_at: '2098-12-31T23:59:59.000Z' };
  const canonicalKey = `public_product_v1:purchase_intent:${winner.intent_id}`;
  await store.set(canonicalKey, JSON.stringify(occupied));

  await assert.rejects(service.createPurchaseIntent(input), /purchase_intent_contract_invalid/u);
  assert.deepEqual(JSON.parse(await store.get(canonicalKey)), occupied);
});

test('an already-granted purchase intent can never open another provider Checkout Session', async () => {
  const { service } = fixture();
  let providerCalls = 0;
  const handler = createPurchaseIntentHandler({
    env: {
      PUBLIC_CHECKOUT_ENABLED: 'true',
      PUBLIC_PRODUCT_START_ENFORCEMENT_ENABLED: 'true',
      PUBLIC_PRODUCT_START_SIGNING_KEY: 'synthetic-start-signing-key-at-least-thirty-two-characters',
      PUBLIC_STRIPE_MODE: 'test',
      STRIPE_SECRET_KEY: 'sk_test_synthetic_never_sent',
      STRIPE_PRICE_BEHAVIOR_OS: 'price_synthetic_bos',
      STRIPE_PRICE_BUSINESS_ASSESSMENT: 'price_synthetic_ba',
    },
    serviceFactory: async () => ({ service }),
    checkoutProviderFactory: () => ({
      create: async () => {
        providerCalls += 1;
        return { url: 'https://checkout.stripe.test/synthetic-session' };
      },
    }),
  });
  const req = {
    method: 'POST',
    headers: { 'idempotency-key': 'security-integrity-handler-granted-0001' },
    body: { product_key: 'behavior_operating_system' },
    socket: { remoteAddress: '127.0.0.1' },
  };
  const firstResponse = responseFixture();
  await handler(req, firstResponse);
  assert.equal(firstResponse.statusCode, 200);
  assert.equal(providerCalls, 1);
  await service.recordPaymentGrant({
    event_id: 'evt_security_handler_granted_1',
    checkout_session_id: 'cs_test_security_handler_granted_1',
    intent_id: firstResponse.payload.intent_id,
    payment_truth: 'provider_confirmed',
  });

  const replayResponse = responseFixture();
  await handler(req, replayResponse);
  assert.equal(replayResponse.statusCode, 409);
  assert.deepEqual(replayResponse.payload, { ok: false, error: 'purchase_already_granted' });
  assert.equal(providerCalls, 1);
});

test('complimentary redemption is atomically replayable after commit acknowledgement failure', async () => {
  class CommitThenThrowOnceStore extends MemoryPublicStore {
    constructor() {
      super();
      this.failed = false;
    }

    async commitComplimentaryRedemption(input) {
      const outcome = await super.commitComplimentaryRedemption(input);
      if (!this.failed) {
        this.failed = true;
        throw new Error('synthetic_complimentary_commit_ack_failure');
      }
      return outcome;
    }
  }

  const capability = 'synthetic-atomic-complimentary-capability';
  const digest = complimentaryDigest(capability, COMPLIMENTARY_PEPPER);
  const complimentaryManifest = JSON.stringify([{
    digest,
    product_key: 'behavior_operating_system',
    capability_id: 'synthetic-atomic-bos',
    expires_at: '2099-02-01T00:00:00.000Z',
    max_uses: 1,
  }]);
  const store = new CommitThenThrowOnceStore();
  const { service } = fixture(store, { complimentaryManifest });
  const input = {
    product_key: 'behavior_operating_system',
    capability,
    email: 'complimentary@example.test',
    idempotency_key: 'security-integrity-complimentary-0001',
  };
  await assert.rejects(service.redeemComplimentary(input), /synthetic_complimentary_commit_ack_failure/u);
  const replay = await service.redeemComplimentary(input);
  assert.equal(replay.idempotent, true);
  const snapshot = store.snapshot();
  const grants = Object.keys(snapshot.values).filter((key) => key.startsWith('access_grant:'));
  assert.equal(grants.length, 1);
  assert.deepEqual(snapshot.sets[`public_product_v1:complimentary_uses:${digest}`].length, 1);
  assert.equal(JSON.parse(snapshot.values[grants[0]]).grant_id, replay.grant.grant_id);

  await assert.rejects(
    service.redeemComplimentary({ ...input, idempotency_key: 'security-integrity-complimentary-0002' }),
    /complimentary_capability_exhausted/u,
  );
  assert.equal(Object.keys(store.snapshot().values).filter((key) => key.startsWith('access_grant:')).length, 1);
});

test('an exact complimentary partial repairs after expiry while a fresh redemption stays denied', async () => {
  let now = NOW;
  const capability = 'synthetic-expiring-complimentary-capability';
  const digest = complimentaryDigest(capability, COMPLIMENTARY_PEPPER);
  const complimentaryManifest = JSON.stringify([{
    digest,
    product_key: 'behavior_operating_system',
    capability_id: 'synthetic-expiring-bos',
    expires_at: new Date(NOW + 1000).toISOString(),
    max_uses: 2,
  }]);
  const store = new MemoryPublicStore();
  const { service } = fixture(store, { complimentaryManifest, clock: () => now });
  const input = {
    product_key: 'behavior_operating_system',
    capability,
    profile_id: 'mm-20990101-comp0001',
    email: 'partial@example.test',
    idempotency_key: 'security-integrity-complimentary-expiry-0001',
  };
  const first = await service.redeemComplimentary(input);
  const redemptionKey = Object.keys(store.snapshot().values)
    .find((key) => key.startsWith('public_product_v1:complimentary_redemption:'));
  await store.del(redemptionKey);
  now = NOW + 2000;

  const repaired = await service.redeemComplimentary(input);
  assert.equal(repaired.grant.grant_id, first.grant.grant_id);
  assert.equal(repaired.idempotent, true);
  assert.ok(await store.get(redemptionKey));
  await assert.rejects(
    service.redeemComplimentary({ ...input, idempotency_key: 'security-integrity-complimentary-expiry-0002' }),
    /complimentary_capability_expired/u,
  );
});

test('Redis complimentary commit declares every accessed key to EVAL', async () => {
  const calls = [];
  const store = new RedisPublicStore({
    async eval(...args) { calls.push(args); return 'CREATED'; },
  });
  const common = {
    redemptionKey: 'redemption-key',
    grantKey: 'grant-key',
    usageKey: 'usage-key',
    redemptionId: 'redemption-id',
    grantId: 'grant-id',
    maxUses: 1,
    serializedGrant: '{"grant":true}',
    serializedJournal: '{"journal":true}',
  };
  assert.equal(await store.commitComplimentaryRedemption({
    ...common,
    profileIndexKey: 'profile-index-key',
  }), 'CREATED');
  assert.equal(calls[0][1], 4);
  assert.deepEqual(calls[0].slice(2, 6), [
    'redemption-key',
    'grant-key',
    'usage-key',
    'profile-index-key',
  ]);
  assert.equal(calls[0][10], '1');

  await store.commitComplimentaryRedemption(common);
  assert.equal(calls[1][1], 4);
  assert.equal(calls[1][5], 'grant-key');
  assert.equal(calls[1][10], '0');
});
