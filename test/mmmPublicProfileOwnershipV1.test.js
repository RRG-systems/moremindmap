import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { createProfileOwnershipHandler } from '../src/lib/publicSiteAirlockV1/handlers.js';
import { MemoryPublicStore } from '../src/lib/publicSiteAirlockV1/memoryStore.js';
import { RedisPublicStore } from '../src/lib/publicSiteAirlockV1/redisStore.js';
import { createCanonicalProfileOwnerReader } from '../src/lib/publicSiteAirlockV1/canonicalProfileOwnerReader.js';
import {
  PROFILE_OWNER_COOKIE,
  createProfileOwnershipAdapter,
  profileOwnerCookie,
  readVerifiedProfileOwnerRequest,
  resolveProfileOwnershipAudience,
} from '../src/lib/publicSiteAirlockV1/profileOwnership.js';
import { authorizeExistingProductRead } from '../src/lib/publicSiteAirlockV1/productBoundary.js';
import { createPublicSiteService } from '../src/lib/publicSiteAirlockV1/service.js';
import { complimentaryDigest, sealStartToken } from '../src/lib/publicSiteAirlockV1/security.js';
import { createNewBosProductionRouteHandler } from '../api/engine/newBosProductionReadinessV1/routeHandler.js';
import { createNewBaRouteHandler } from '../api/engine/newBaProductionReadinessV1/routeHandler.js';
import { businessAssessmentByProfileKey } from '../api/business-assessment/shared.js';
import { readAuthorizedAssessmentById } from '../api/business-assessment/retrieve.js';
import { authorizeBusinessAssessmentIdBeforeRead } from '../api/engine/recruitingV1/canonicalAdapters.js';

const signingKey = 'synthetic-owner-signing-key-at-least-32-characters';
const startKey = 'synthetic-product-start-key-at-least-32-characters';
const pepper = 'synthetic-complimentary-pepper-at-least-32-characters';
const profileId = 'mm-20990101-owner001';
const otherProfileId = 'mm-20990101-owner002';
const ownerEmail = 'owner@example.test';
const ownershipAudience = 'more-public-profile-owner-receipt-v1|test|https://candidate.example.test';
const ownershipEnvironment = {
  PUBLIC_PROFILE_OWNERSHIP_ENVIRONMENT: 'test',
  PUBLIC_SITE_URL: 'https://candidate.example.test',
};

function response() {
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

function cookieHeader(receipt) {
  return `${PROFILE_OWNER_COOKIE}=${encodeURIComponent(receipt)}`;
}

test('canonical owner reader accepts only the exact Profile top-level email and legacy key casing', async () => {
  const store = new MemoryPublicStore();
  const reader = createCanonicalProfileOwnerReader(store);
  await store.set(`vault:profile:${profileId}`, JSON.stringify({ email: ownerEmail, canonical_profile_json: { email: 'ignored@example.test' } }));
  assert.deepEqual(await reader(profileId), { profile_id: profileId, recipient_email: ownerEmail });
  await store.del(`vault:profile:${profileId}`);
  await store.set('vault:profile:MM-20990101-owner001', JSON.stringify({ email: ownerEmail }));
  assert.deepEqual(await reader(profileId.toUpperCase()), { profile_id: profileId, recipient_email: ownerEmail });
  await store.set(`vault:profile:${otherProfileId}`, JSON.stringify({ canonical_profile_json: { email: 'nested@example.test' } }));
  assert.equal(await reader(otherProfileId), null);
});

test('Redis NX writes are durable unless a lock TTL is explicitly requested', async () => {
  const calls = [];
  const store = new RedisPublicStore({
    async set(...args) { calls.push(args); return 'OK'; },
  });
  assert.equal(await store.setNx('durable_receipt', 'value'), true);
  assert.equal(await store.setNx('bounded_lock', 'token', 30), true);
  assert.equal(await store.setExpiring('expiring_record', 'value', 120), 'OK');
  assert.deepEqual(calls, [
    ['durable_receipt', 'value', 'NX'],
    ['bounded_lock', 'token', 'EX', 30, 'NX'],
    ['expiring_record', 'value', 'EX', 120],
  ]);
});

test('ownership challenge transitions always retain bounded TTL and a failed replacement leaves the prior link usable', async () => {
  const store = new MemoryPublicStore();
  await store.set(`vault:profile:${profileId}`, JSON.stringify({ email: ownerEmail }));
  const transitions = [];
  const originalSetExpiring = store.setExpiring.bind(store);
  store.setExpiring = async (key, value, ttlSeconds) => {
    if (key.includes(':challenge:')) transitions.push({ status: JSON.parse(value).status, ttlSeconds });
    return originalSetExpiring(key, value, ttlSeconds);
  };
  const sent = [];
  const adapter = createProfileOwnershipAdapter({
    store,
    ownerReader: createCanonicalProfileOwnerReader(store),
    transport: {
      send: async (item) => {
        sent.push(item);
        return { success: sent.length === 1 };
      },
    },
    signingKey,
    audience: ownershipAudience,
    clock: () => Date.parse('2099-01-01T00:00:00.000Z'),
    tokenFactory: () => `synthetic-delivery-token-${sent.length + 1}-abcdefghijklmnopqrstuvwxyz`,
    minimumResponseDelayMs: 0,
  });

  await adapter.requestChallenge({ profile_id: profileId });
  await adapter.requestChallenge({ profile_id: profileId.toUpperCase() });
  assert.deepEqual(
    transitions.map(({ status }) => status),
    ['delivery_pending', 'pending', 'delivery_pending', 'delivery_failed'],
  );
  assert.equal(transitions.every(({ ttlSeconds }) => ttlSeconds === 660), true);
  await assert.rejects(adapter.consumeChallenge(sent[1].token), /ownership_verification_failed/u);
  const verified = await adapter.consumeChallenge(sent[0].token);
  assert.equal(verified.profile_id, profileId);
  assert.equal(transitions.at(-1).status, 'consumed');
  assert.equal(transitions.at(-1).ttlSeconds, 660);
});

test('successful replacement is serialized per normalized Profile and only the latest digest can be consumed', async () => {
  const store = new MemoryPublicStore();
  await store.set(`vault:profile:${profileId}`, JSON.stringify({ email: ownerEmail }));
  const sent = [];
  const transitions = [];
  const originalSetExpiring = store.setExpiring.bind(store);
  store.setExpiring = async (key, value, ttlSeconds) => {
    if (key.includes(':challenge:')) transitions.push({ status: JSON.parse(value).status, ttlSeconds });
    return originalSetExpiring(key, value, ttlSeconds);
  };
  const adapter = createProfileOwnershipAdapter({
    store,
    ownerReader: createCanonicalProfileOwnerReader(store),
    transport: { send: async (item) => { sent.push(item); return { success: true }; } },
    signingKey,
    audience: ownershipAudience,
    clock: () => Date.parse('2099-01-01T00:00:00.000Z'),
    tokenFactory: () => `synthetic-latest-token-${sent.length + 1}-abcdefghijklmnopqrstuvwxyz`,
    minimumResponseDelayMs: 0,
  });

  await adapter.requestChallenge({ profile_id: profileId });
  await adapter.requestChallenge({ profile_id: `  ${profileId.toUpperCase()}  ` });
  assert.equal(sent.length, 2);
  assert.equal(transitions.some(({ status, ttlSeconds }) => status === 'superseded' && ttlSeconds === 660), true);
  await assert.rejects(adapter.consumeChallenge(sent[0].token), /ownership_verification_failed/u);
  const verified = await adapter.consumeChallenge(sent[1].token);
  assert.equal(verified.profile_id, profileId);
});

test('concurrent issuance is serialized before delivery across normalized Profile casing', async () => {
  const store = new MemoryPublicStore();
  await store.set(`vault:profile:${profileId}`, JSON.stringify({ email: ownerEmail }));
  let releaseDelivery;
  let deliveryStarted;
  const deliveryGate = new Promise((resolve) => { releaseDelivery = resolve; });
  const enteredDelivery = new Promise((resolve) => { deliveryStarted = resolve; });
  let sends = 0;
  const adapter = createProfileOwnershipAdapter({
    store,
    ownerReader: createCanonicalProfileOwnerReader(store),
    transport: {
      send: async () => {
        sends += 1;
        deliveryStarted();
        await deliveryGate;
        return { success: true };
      },
    },
    signingKey,
    audience: ownershipAudience,
    tokenFactory: () => 'synthetic-serialized-token-abcdefghijklmnopqrstuvwxyz',
    minimumResponseDelayMs: 0,
  });

  const first = adapter.requestChallenge({ profile_id: profileId });
  await enteredDelivery;
  const secondResult = await adapter.requestChallenge({ profile_id: profileId.toUpperCase() });
  assert.deepEqual(secondResult, { state: 'verification_requested_if_available' });
  assert.equal(sends, 1);
  releaseDelivery();
  await first;
});

test('ownership challenge keys and receipts cannot cross deployment audiences in a shared store', async () => {
  const store = new MemoryPublicStore();
  await store.set(`vault:profile:${profileId}`, JSON.stringify({ email: ownerEmail }));
  const previewAudience = resolveProfileOwnershipAudience({
    VERCEL_ENV: 'preview',
    VERCEL_URL: 'candidate-abc.vercel.app',
  });
  const productionAudience = resolveProfileOwnershipAudience({
    VERCEL_ENV: 'production',
    PUBLIC_SITE_URL: 'https://moremindmap.com',
  });
  let token = '';
  const common = {
    store,
    ownerReader: createCanonicalProfileOwnerReader(store),
    signingKey,
    clock: () => Date.parse('2099-01-01T00:00:00.000Z'),
    minimumResponseDelayMs: 0,
  };
  const preview = createProfileOwnershipAdapter({
    ...common,
    audience: previewAudience,
    transport: { send: async (item) => { token = item.token; return { success: true }; } },
    tokenFactory: () => 'synthetic-cross-audience-token-abcdefghijklmnopqrstuvwxyz',
  });
  const production = createProfileOwnershipAdapter({
    ...common,
    audience: productionAudience,
    transport: { send: async () => ({ success: true }) },
    tokenFactory: () => 'synthetic-production-audience-token-abcdefghijklmnopqrstuvwxyz',
  });

  await preview.requestChallenge({ profile_id: profileId });
  await production.requestChallenge({ profile_id: profileId });
  await assert.rejects(production.consumeChallenge(token), /ownership_verification_failed/u);
  const verified = await preview.consumeChallenge(token);
  const cookie = cookieHeader(verified.receipt);
  assert.equal(preview.verifyRequest({ profile_id: profileId, cookie_header: cookie }), true);
  assert.equal(production.verifyRequest({ profile_id: profileId, cookie_header: cookie }), false);
  const ownershipKeys = Object.keys(store.snapshot().values).filter((key) => key.startsWith('public_profile_owner_v1:'));
  assert.equal(new Set(ownershipKeys.map((key) => key.split(':')[1])).size >= 2, true);
});

test('existing and missing Profile challenge requests share the same injected minimum response floor', async () => {
  let monotonicNow = 0;
  const waits = [];
  const store = new MemoryPublicStore();
  const adapter = createProfileOwnershipAdapter({
    store,
    ownerReader: async (seenProfileId) => {
      monotonicNow += seenProfileId === profileId ? 120 : 20;
      return seenProfileId === profileId
        ? { profile_id: profileId, recipient_email: ownerEmail }
        : null;
    },
    transport: { send: async () => ({ success: true }) },
    signingKey,
    audience: ownershipAudience,
    tokenFactory: () => 'synthetic-minimum-delay-token-abcdefghijklmnopqrstuvwxyz',
    minimumResponseDelayMs: 500,
    monotonicClock: () => monotonicNow,
    delay: async (milliseconds) => { waits.push(milliseconds); monotonicNow += milliseconds; },
  });

  const existingStart = monotonicNow;
  const existing = await adapter.requestChallenge({ profile_id: profileId });
  const existingDuration = monotonicNow - existingStart;
  const missingStart = monotonicNow;
  const missing = await adapter.requestChallenge({ profile_id: otherProfileId });
  const missingDuration = monotonicNow - missingStart;
  assert.deepEqual(existing, missing);
  assert.deepEqual([existingDuration, missingDuration], [500, 500]);
  assert.deepEqual(waits, [380, 480]);
});

test('ownership HTTP per-Profile limiter canonicalizes casing and whitespace before counting', async () => {
  const store = new MemoryPublicStore();
  const adapter = createProfileOwnershipAdapter({
    store,
    ownerReader: async () => null,
    transport: { send: async () => ({ success: true }) },
    signingKey,
    audience: ownershipAudience,
    minimumResponseDelayMs: 0,
  });
  const service = createPublicSiteService({ store, ownershipVerifier: async () => false });
  const backgroundTasks = [];
  const handler = createProfileOwnershipHandler({
    env: { PUBLIC_ALLOWED_ORIGINS: 'https://candidate.example.test' },
    serviceFactory: async () => ({ store, service, ownership: adapter }),
    waitUntil: (task) => backgroundTasks.push(task),
  });
  const invoke = async (value) => {
    const res = response();
    await handler({
      method: 'POST',
      headers: { origin: 'https://candidate.example.test', 'x-forwarded-for': '192.0.2.10' },
      body: { action: 'request', profile_id: value },
    }, res);
    return res;
  };

  const results = [];
  for (const value of [profileId, profileId.toUpperCase(), `  ${profileId.toUpperCase()}  `, profileId]) {
    results.push(await invoke(value));
  }
  assert.deepEqual(results.map((item) => item.statusCode), [202, 202, 202, 429]);
  assert.equal(results[3].payload.error, 'rate_limited');
  await Promise.all(backgroundTasks);
});

test('ownership challenge is uniform, stores no raw token/email, is single-use and mints an exact short cookie receipt', async () => {
  const store = new MemoryPublicStore();
  await store.set(`vault:profile:${profileId}`, JSON.stringify({ email: ownerEmail }));
  const sent = [];
  let now = Date.parse('2099-01-01T00:00:00.000Z');
  let sequence = 0;
  const adapter = createProfileOwnershipAdapter({
    store,
    ownerReader: createCanonicalProfileOwnerReader(store),
    transport: { send: async (item) => { sent.push(item); return { success: true, id: 'synthetic-mail' }; } },
    signingKey,
    audience: ownershipAudience,
    clock: () => now,
    tokenFactory: () => `synthetic-owner-token-${++sequence}-abcdefghijklmnopqrstuvwxyz`,
    minimumResponseDelayMs: 0,
  });
  const existing = await adapter.requestChallenge({ profile_id: profileId, return_path: '/step-2' });
  const missing = await adapter.requestChallenge({ profile_id: 'mm-20990101-missing1', return_path: '/step-2' });
  assert.deepEqual(existing, missing);
  assert.deepEqual(existing, { state: 'verification_requested_if_available' });
  assert.equal(sent.length, 1);
  const publicOwnerRecords = Object.entries(store.snapshot().values)
    .filter(([key]) => key.startsWith('public_profile_owner_v1:'));
  assert.doesNotMatch(JSON.stringify(publicOwnerRecords), /synthetic-owner-token|owner@example\.test/u);

  const token = sent[0].token;
  const outcomes = await Promise.allSettled([
    adapter.consumeChallenge(token),
    adapter.consumeChallenge(token),
  ]);
  assert.equal(outcomes.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter((item) => item.status === 'rejected').length, 1);
  const verified = outcomes.find((item) => item.status === 'fulfilled').value;
  assert.equal(verified.profile_id, profileId);
  assert.equal(verified.return_path, '/step-2');
  assert.match(profileOwnerCookie(verified.receipt), /^__Host-more_profile_owner=.*; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=1800$/u);
  assert.deepEqual(readVerifiedProfileOwnerRequest({
    cookieHeader: cookieHeader(verified.receipt),
    signingKey,
    audience: ownershipAudience,
    nowMs: now,
  }), { profile_id: profileId });
  assert.equal(adapter.verifyRequest({ profile_id: profileId, cookie_header: cookieHeader(verified.receipt) }), true);
  assert.equal(adapter.verifyRequest({ profile_id: otherProfileId, cookie_header: cookieHeader(verified.receipt) }), false);
  now += 31 * 60 * 1000;
  assert.equal(readVerifiedProfileOwnerRequest({
    cookieHeader: cookieHeader(verified.receipt),
    signingKey,
    audience: ownershipAudience,
    nowMs: now,
  }), null);
  assert.equal(adapter.verifyRequest({ profile_id: profileId, cookie_header: cookieHeader(verified.receipt) }), false);
});

test('Assessment-ID owner retrieval proves the signed Profile and its exact pointer before record read', async () => {
  const assessmentId = 'ba-20990101-a1b2c3d4';
  const store = new MemoryPublicStore();
  await store.set(`vault:profile:${profileId}`, JSON.stringify({ email: ownerEmail }));
  let rawToken = '';
  const adapter = createProfileOwnershipAdapter({
    store,
    ownerReader: createCanonicalProfileOwnerReader(store),
    transport: { send: async (item) => { rawToken = item.token; return { success: true }; } },
    signingKey,
    audience: ownershipAudience,
    clock: () => Date.parse('2099-01-01T00:00:00.000Z'),
    tokenFactory: () => 'synthetic-assessment-owner-token-abcdefghijklmnopqrstuvwxyz',
    minimumResponseDelayMs: 0,
  });
  await adapter.requestChallenge({ profile_id: profileId });
  const verified = await adapter.consumeChallenge(rawToken);
  await store.set(businessAssessmentByProfileKey(profileId), assessmentId);
  const env = {
    PUBLIC_PRODUCT_START_ENFORCEMENT_ENABLED: 'true',
    MOREMINDMAP_SERVER_ONLY_PRODUCT_START_SIGNING_KEY: startKey,
    MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_SIGNING_KEY: signingKey,
    ...ownershipEnvironment,
  };
  const authority = await authorizeBusinessAssessmentIdBeforeRead({
    req: { headers: { cookie: cookieHeader(verified.receipt) } },
    store,
    assessmentId,
    env,
  });
  assert.equal(authority.mode, 'profile_owner_receipt');
  assert.equal(authority.profile_id, profileId);

  await assert.rejects(
    authorizeBusinessAssessmentIdBeforeRead({
      req: { headers: { cookie: `${PROFILE_OWNER_COOKIE}=forged` } },
      store: { async get() { throw new Error('unauthorized_store_read'); } },
      assessmentId,
      env,
    }),
    /public_product_authority_denied/u,
  );
});

test('forged request-body ownership proof cannot authorize lookup, BA purchase or complimentary BA', async () => {
  const store = new MemoryPublicStore();
  let reads = 0;
  const service = createPublicSiteService({
    store,
    startSigningKey: startKey,
    complimentaryPepper: pepper,
    complimentaryManifest: JSON.stringify([{
      digest: complimentaryDigest('synthetic-ba-code', pepper),
      product_key: 'business_assessment',
      status: 'active',
      expires_at: '2099-02-01T00:00:00.000Z',
      max_uses: 1,
    }]),
    clock: () => Date.parse('2099-01-01T00:00:00.000Z'),
    profileStateReader: async () => { reads += 1; return { bos: 'ready', ba: 'ready' }; },
    ownershipVerifier: async ({ cookie_header: cookie }) => cookie === 'trusted-server-cookie',
  });
  assert.deepEqual(
    await service.lookupEntry({ value: profileId, ownership_proof: 'forged' }),
    { state: 'ownership_verification_required' },
  );
  await assert.rejects(
    service.createPurchaseIntent({
      product_key: 'business_assessment',
      profile_id: profileId,
      ownership_proof: 'forged',
      vertical_selection: { vertical_id: 'real_estate', confirmation: 'CUSTOMER_CONFIRMED' },
      idempotency_key: 'synthetic-owner-ba-purchase',
    }),
    /profile_ownership_required/u,
  );
  await assert.rejects(
    service.redeemComplimentary({
      product_key: 'business_assessment',
      profile_id: profileId,
      capability: 'synthetic-ba-code',
      ownership_proof: 'forged',
      vertical_selection: { vertical_id: 'real_estate', confirmation: 'CUSTOMER_CONFIRMED' },
      idempotency_key: 'synthetic-owner-ba-complimentary',
    }),
    /profile_ownership_required/u,
  );
  assert.equal(reads, 0);
  assert.equal(Object.keys(store.snapshot().values).some((key) => key.includes('purchase_intent')), false);
});

test('owner receipt authorizes only existing Product reads while grant-only mutation authority stays closed', async () => {
  const store = new MemoryPublicStore();
  await store.set(`vault:profile:${profileId}`, JSON.stringify({ email: ownerEmail }));
  let rawToken = '';
  const adapter = createProfileOwnershipAdapter({
    store,
    ownerReader: createCanonicalProfileOwnerReader(store),
    transport: { send: async (item) => { rawToken = item.token; return { success: true }; } },
    signingKey,
    audience: ownershipAudience,
    clock: () => Date.parse('2099-01-01T00:00:00.000Z'),
    tokenFactory: () => 'synthetic-read-token-abcdefghijklmnopqrstuvwxyz',
    minimumResponseDelayMs: 0,
  });
  await adapter.requestChallenge({ profile_id: profileId });
  const verified = await adapter.consumeChallenge(rawToken);
  const req = { headers: { cookie: cookieHeader(verified.receipt) } };
  const env = {
    PUBLIC_PRODUCT_START_ENFORCEMENT_ENABLED: 'true',
    MOREMINDMAP_SERVER_ONLY_PRODUCT_START_SIGNING_KEY: startKey,
    MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_SIGNING_KEY: signingKey,
    ...ownershipEnvironment,
  };
  const allowed = await authorizeExistingProductRead({ req, store, productKey: 'behavior_operating_system', profileId, env });
  assert.equal(allowed.mode, 'profile_owner_receipt');
  await assert.rejects(
    authorizeExistingProductRead({ req, store, productKey: 'behavior_operating_system', profileId: otherProfileId, env }),
    /public_product_authority_denied/u,
  );
});

test('unbound or cross-Profile Product grants cannot be reused to read an existing Profile', async () => {
  const store = new MemoryPublicStore();
  const env = {
    PUBLIC_PRODUCT_START_ENFORCEMENT_ENABLED: 'true',
    MOREMINDMAP_SERVER_ONLY_PRODUCT_START_SIGNING_KEY: startKey,
    MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_SIGNING_KEY: signingKey,
  };
  await store.set('access_grant:grant_unbound', JSON.stringify({
    grant_id: 'grant_unbound',
    product_key: 'behavior_operating_system',
    status: 'active',
    profile_id: '',
  }));
  const unboundToken = sealStartToken({ grant_id: 'grant_unbound', product_key: 'behavior_operating_system' }, startKey);
  await assert.rejects(
    authorizeExistingProductRead({
      req: { headers: { 'x-more-start-token': unboundToken } },
      store,
      productKey: 'behavior_operating_system',
      profileId,
      env,
    }),
    /public_product_profile_binding_mismatch/u,
  );

  await store.set('access_grant:grant_other', JSON.stringify({
    grant_id: 'grant_other',
    product_key: 'behavior_operating_system',
    status: 'active',
    profile_id: otherProfileId,
  }));
  const otherToken = sealStartToken({ grant_id: 'grant_other', product_key: 'behavior_operating_system' }, startKey);
  await assert.rejects(
    authorizeExistingProductRead({
      req: { headers: { 'x-more-start-token': otherToken } },
      store,
      productKey: 'behavior_operating_system',
      profileId,
      env,
    }),
    /public_product_profile_binding_mismatch/u,
  );
});

test('an explicitly forced existing-read boundary validates an exact grant even while legacy rollout enforcement is disabled', async () => {
  const store = new MemoryPublicStore();
  await store.set('access_grant:grant_bound', JSON.stringify({
    grant_id: 'grant_bound',
    product_key: 'business_assessment',
    status: 'active',
    profile_id: profileId,
  }));
  const token = sealStartToken({ grant_id: 'grant_bound', product_key: 'business_assessment' }, startKey);
  const env = {
    PUBLIC_PRODUCT_START_ENFORCEMENT_ENABLED: 'false',
    MOREMINDMAP_SERVER_ONLY_PRODUCT_START_SIGNING_KEY: startKey,
    MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_SIGNING_KEY: signingKey,
  };
  const authority = await authorizeExistingProductRead({
    req: { headers: { 'x-more-start-token': token } },
    store,
    productKey: 'business_assessment',
    profileId,
    env,
    force: true,
  });
  assert.equal(authority.mode, 'server_grant');
  await assert.rejects(
    authorizeExistingProductRead({ req: { headers: {} }, store, productKey: 'business_assessment', profileId, env, force: true }),
    /public_product_authority_denied/u,
  );
});

test('assessment-ID reads require a valid stored owner and exact read authority before returning the record', async () => {
  const records = new Map();
  const redis = { async get(key) { return records.get(key) ?? null; } };
  const assessmentId = 'ba-20990101-a1b2c3d4';
  const key = `business_assessment:${assessmentId}`;
  let authorizations = 0;
  const authorizeRead = async (seenProfileId) => {
    authorizations += 1;
    assert.equal(seenProfileId, profileId);
  };

  assert.equal(await readAuthorizedAssessmentById({ redis, assessmentId, authorizeRead }), null);
  records.set(key, '{corrupt');
  assert.equal(await readAuthorizedAssessmentById({ redis, assessmentId, authorizeRead }), null);
  records.set(key, JSON.stringify({ assessment_id: assessmentId, owner_profile_id: '' }));
  assert.equal(await readAuthorizedAssessmentById({ redis, assessmentId, authorizeRead }), null);
  assert.equal(authorizations, 0);

  const assessment = { assessment_id: assessmentId, owner_profile_id: profileId.toUpperCase(), status: 'complete' };
  records.set(key, JSON.stringify(assessment));
  const authorized = await readAuthorizedAssessmentById({ redis, assessmentId, authorizeRead });
  assert.equal(authorizations, 1);
  assert.equal(authorized.ownerProfileId, profileId);
  assert.deepEqual(authorized.assessment, assessment);

  await assert.rejects(
    readAuthorizedAssessmentById({
      redis,
      assessmentId,
      authorizeRead: async () => { throw new Error('public_product_profile_binding_mismatch'); },
    }),
    /public_product_profile_binding_mismatch/u,
  );
});

test('BA retrieval resolves supported locator authority before index or assessment reads', () => {
  const source = fs.readFileSync('api/business-assessment/retrieve.js', 'utf8');
  assert.match(source, /authorizeBusinessAssessmentIdBeforeRead\([\s\S]*?readAuthorizedAssessmentById\(/u);
  assert.match(source, /allowProfileBoundBaRead: true,[\s\S]*?const assessmentId = await redis\.get\(businessAssessmentByProfileKey/u);
  assert.doesNotMatch(source, /hasProfileOwnerReceipt/u);
  assert.match(source, /authorizeBusinessAssessmentIdBeforeRead\([\s\S]*?authorizeRead: \(ownerProfileId, assessment\) => authorizePublicOrRecruitingProductRequest/u);
});

test('ownership HTTP boundary is exact-origin, uniform and never returns token or email', async () => {
  const store = new MemoryPublicStore();
  await store.set(`vault:profile:${profileId}`, JSON.stringify({ email: ownerEmail }));
  const adapter = createProfileOwnershipAdapter({
    store,
    ownerReader: createCanonicalProfileOwnerReader(store),
    transport: { send: async () => ({ success: true }) },
    signingKey,
    audience: ownershipAudience,
    tokenFactory: () => 'synthetic-http-token-abcdefghijklmnopqrstuvwxyz',
    minimumResponseDelayMs: 0,
  });
  let factories = 0;
  const backgroundTasks = [];
  const handler = createProfileOwnershipHandler({
    env: { PUBLIC_ALLOWED_ORIGINS: 'https://candidate.example.test' },
    serviceFactory: async () => {
      factories += 1;
      return {
        service: createPublicSiteService({ store, ownershipVerifier: async () => false }),
        ownership: adapter,
      };
    },
    waitUntil: (task) => backgroundTasks.push(task),
  });
  const invoke = async (profile, origin = 'https://candidate.example.test') => {
    const res = response();
    await handler({ method: 'POST', headers: { origin }, body: { action: 'request', profile_id: profile, return_path: '/step-1' } }, res);
    return res;
  };
  const existing = await invoke(profileId);
  const missing = await invoke('mm-20990101-missing1');
  assert.equal(existing.statusCode, 202);
  assert.deepEqual(existing.payload, missing.payload);
  assert.doesNotMatch(JSON.stringify(existing.payload), /owner@example|synthetic-http-token/u);
  const denied = await invoke(profileId, 'https://attacker.example.test');
  assert.equal(denied.statusCode, 403);
  assert.equal(factories, 2);
  await Promise.all(backgroundTasks);
});

test('ownership HTTP request returns before owner lookup or mail and keeps runtime open through background completion', async () => {
  const store = new MemoryPublicStore();
  let resolveLookup;
  const lookupGate = new Promise((resolve) => { resolveLookup = resolve; });
  let lookupStarted = false;
  let sends = 0;
  let closes = 0;
  const adapter = createProfileOwnershipAdapter({
    store,
    ownerReader: async () => {
      lookupStarted = true;
      await lookupGate;
      return { profile_id: profileId, recipient_email: ownerEmail };
    },
    transport: { send: async () => { sends += 1; return { success: true }; } },
    signingKey,
    audience: ownershipAudience,
    minimumResponseDelayMs: 0,
  });
  const backgroundTasks = [];
  const handler = createProfileOwnershipHandler({
    env: { PUBLIC_ALLOWED_ORIGINS: 'https://candidate.example.test' },
    serviceFactory: async () => ({
      service: createPublicSiteService({ store, ownershipVerifier: async () => false }),
      ownership: adapter,
      close: async () => { closes += 1; },
    }),
    waitUntil: (task) => backgroundTasks.push(task),
  });
  const res = response();
  await handler({
    method: 'POST',
    headers: { origin: 'https://candidate.example.test', 'x-forwarded-for': '192.0.2.44' },
    body: { action: 'request', profile_id: profileId },
  }, res);

  assert.equal(res.statusCode, 202);
  assert.deepEqual(res.payload, { ok: true, state: 'verification_requested_if_available' });
  assert.equal(backgroundTasks.length, 1);
  assert.equal(lookupStarted, true);
  assert.equal(sends, 0);
  assert.equal(closes, 0);
  resolveLookup();
  await backgroundTasks[0];
  assert.equal(sends, 1);
  assert.equal(closes, 1);
});

test('ownership HTTP request never dispatches provider work when background registration is unavailable', async () => {
  const store = new MemoryPublicStore();
  let ownerReads = 0;
  let closes = 0;
  const adapter = createProfileOwnershipAdapter({
    store,
    ownerReader: async () => { ownerReads += 1; return { profile_id: profileId, recipient_email: ownerEmail }; },
    transport: { send: async () => { throw new Error('must_not_run'); } },
    signingKey,
    audience: ownershipAudience,
    minimumResponseDelayMs: 0,
  });
  const handler = createProfileOwnershipHandler({
    env: { PUBLIC_ALLOWED_ORIGINS: 'https://candidate.example.test' },
    serviceFactory: async () => ({
      service: createPublicSiteService({ store, ownershipVerifier: async () => false }),
      ownership: adapter,
      close: async () => { closes += 1; },
    }),
    waitUntil: () => { throw new Error('request_context_unavailable'); },
  });
  const res = response();
  await handler({
    method: 'POST',
    headers: { origin: 'https://candidate.example.test', 'x-forwarded-for': '192.0.2.45' },
    body: { action: 'request', profile_id: profileId },
  }, res);
  await Promise.resolve();
  assert.equal(res.statusCode, 202);
  assert.equal(ownerReads, 0);
  assert.equal(closes, 1);
});

test('customer-active modern BOS and BA routes authorize the exact Profile before constructing Product services', async () => {
  const config = { staged: true, canaryEnabled: false, customerActive: true };
  for (const createHandler of [createNewBosProductionRouteHandler, createNewBaRouteHandler]) {
    let services = 0;
    let authorizations = 0;
    const denied = createHandler({
      config,
      authorizeCustomerRead: async ({ profileId: seen }) => {
        authorizations += 1;
        assert.equal(seen, profileId);
        throw new Error('public_product_authority_denied');
      },
      serviceFactory: async () => {
        services += 1;
        return { service: { retrieve: async () => ({ artifact: { safe: true } }) } };
      },
    });
    const deniedResponse = response();
    await denied({ method: 'GET', headers: {}, query: { id: profileId } }, deniedResponse);
    assert.equal(deniedResponse.statusCode, 404);
    assert.equal(authorizations, 1);
    assert.equal(services, 0);

    const allowed = createHandler({
      config,
      authorizeCustomerRead: async () => { authorizations += 1; },
      serviceFactory: async () => {
        services += 1;
        return { service: { retrieve: async () => ({ artifact: { safe: true } }) } };
      },
    });
    const allowedResponse = response();
    await allowed({ method: 'GET', headers: {}, query: { id: profileId } }, allowedResponse);
    assert.equal(allowedResponse.statusCode, 200);
    assert.equal(authorizations, 2);
    assert.equal(services, 1);
  }
});
