import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  COMPLIMENTARY_FLOW_COOKIE,
  clearComplimentaryFlowCookie,
  complimentaryFlowCookie,
  createComplimentaryFlowReceipt,
  readComplimentaryFlowReceipt,
  verifyComplimentaryFlowReceipt,
} from '../src/lib/publicSiteAirlockV1/complimentaryFlow.js';
import { createAccessHandler } from '../src/lib/publicSiteAirlockV1/handlers.js';
import { MemoryPublicStore } from '../src/lib/publicSiteAirlockV1/memoryStore.js';
import { createPublicSiteService } from '../src/lib/publicSiteAirlockV1/service.js';
import { complimentaryDigest } from '../src/lib/publicSiteAirlockV1/security.js';
import { resolveStep2OwnershipContinuation } from '../src/lib/publicSiteAirlockV1/clientContinuation.js';

const START_KEY = 'synthetic-product-start-signing-key-at-least-32-characters';
const PEPPER = 'synthetic-complimentary-pepper-at-least-32-characters';
const AUDIENCE = 'https://candidate.example.test';
const PROFILE_ID = 'mm-20990101-owner001';
const CODE = 'synthetic-business-assessment-capability';
const NOW = Date.parse('2099-01-01T00:00:00.000Z');
const IDEM = 'synthetic-ba-complimentary-attempt';

function cookieHeader(token) {
  return `${COMPLIMENTARY_FLOW_COOKIE}=${encodeURIComponent(token)}`;
}

function manifest(code = CODE) {
  return JSON.stringify([{
    digest: complimentaryDigest(code, PEPPER),
    product_key: 'business_assessment',
    status: 'active',
    expires_at: '2099-02-01T00:00:00.000Z',
    max_uses: 10,
    capability_id: 'synthetic-ba-access',
  }]);
}

function fixture({
  code = CODE,
  store = new MemoryPublicStore(),
  clock = () => NOW,
  profileStateReader = async () => ({ bos: 'ready', ba: 'missing' }),
} = {}) {
  const service = createPublicSiteService({
    store,
    clock,
    startSigningKey: START_KEY,
    complimentaryPepper: PEPPER,
    complimentaryManifest: manifest(),
    complimentaryFlowAudience: AUDIENCE,
    profileStateReader,
    ownershipVerifier: async ({ cookie_header: value }) => value?.includes('trusted-owner=true') === true,
  });
  return { store, service, code };
}

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

test('prepared complimentary receipt is origin-bound, short-lived, digest-only, and carried only in a secure HttpOnly cookie', () => {
  const token = createComplimentaryFlowReceipt({
    productKey: 'business_assessment',
    capability: CODE,
    idempotencyKey: IDEM,
    signingKey: START_KEY,
    pepper: PEPPER,
    audience: AUDIENCE,
    nowMs: NOW,
    flowId: `comp_flow_${'a'.repeat(32)}`,
  });
  assert.doesNotMatch(token, new RegExp(CODE, 'u'));
  const claims = verifyComplimentaryFlowReceipt(token, { signingKey: START_KEY, audience: AUDIENCE, nowMs: NOW });
  assert.equal(claims.capability_digest, complimentaryDigest(CODE, PEPPER));
  assert.equal('capability' in claims, false);
  assert.equal('profile_id' in claims, false);
  assert.equal('email' in claims, false);
  assert.deepEqual(
    readComplimentaryFlowReceipt(cookieHeader(token), { signingKey: START_KEY, audience: AUDIENCE, nowMs: NOW }),
    claims,
  );
  assert.match(complimentaryFlowCookie(token), /^__Host-more_public_complimentary=.*; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=1800$/u);
  assert.doesNotMatch(complimentaryFlowCookie(token), /Domain=/u);
  assert.equal(clearComplimentaryFlowCookie(), '__Host-more_public_complimentary=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  assert.throws(() => verifyComplimentaryFlowReceipt(token, { signingKey: START_KEY, audience: 'https://other.example.test', nowMs: NOW }), /complimentary_flow_invalid/u);
  assert.throws(() => verifyComplimentaryFlowReceipt(`${token}x`, { signingKey: START_KEY, audience: AUDIENCE, nowMs: NOW }), /complimentary_flow_invalid/u);
  assert.throws(() => verifyComplimentaryFlowReceipt(token, { signingKey: START_KEY, audience: AUDIENCE, nowMs: NOW + 31 * 60 * 1000 }), /complimentary_flow_invalid/u);
});

test('prepare is not a validity oracle; final BA redemption enforces ownership, completed BOS, vertical, idempotency, and exact Profile binding', async () => {
  const { service, store } = fixture();
  const valid = await service.prepareComplimentaryFlow({
    product_key: 'business_assessment', capability: CODE, idempotency_key: IDEM,
  });
  const invalid = await service.prepareComplimentaryFlow({
    product_key: 'business_assessment', capability: 'synthetic-invalid-capability', idempotency_key: 'synthetic-invalid-attempt-key',
  });
  assert.deepEqual(
    { state: valid.state, product_key: valid.product_key },
    { state: invalid.state, product_key: invalid.product_key },
  );

  const requestContext = { cookie_header: `${cookieHeader(valid.receipt)}; trusted-owner=true` };
  await assert.rejects(
    service.redeemPreparedComplimentary({ profile_id: PROFILE_ID, vertical_selection: { vertical_id: 'real_estate', confirmation: 'CUSTOMER_CONFIRMED' } }, { cookie_header: cookieHeader(valid.receipt) }),
    /profile_ownership_required/u,
  );
  const first = await service.redeemPreparedComplimentary({
    profile_id: PROFILE_ID,
    vertical_selection: { vertical_id: 'real_estate', confirmation: 'CUSTOMER_CONFIRMED' },
  }, requestContext);
  const replay = await service.redeemPreparedComplimentary({
    profile_id: PROFILE_ID,
    vertical_selection: { vertical_id: 'real_estate', confirmation: 'CUSTOMER_CONFIRMED' },
  }, requestContext);
  assert.equal(first.grant.profile_id, PROFILE_ID);
  assert.equal(first.grant.vertical_id, 'real_estate');
  assert.equal(replay.grant.grant_id, first.grant.grant_id);
  assert.equal(replay.idempotent, true);

  const token = await service.createStartTokenForGrant({ grant_id: first.grant.grant_id });
  const started = await service.startProduct({ start_token: token.start_token });
  const startedAgain = await service.startProduct({ start_token: token.start_token });
  assert.equal(started.destination, '/business-assessment');
  assert.equal(started.profile_id, PROFILE_ID);
  assert.equal(started.vertical_binding.vertical_id, 'real_estate');
  assert.equal(startedAgain.start_id, started.start_id);
  assert.equal(startedAgain.idempotent, true);
  assert.equal(Object.keys(store.snapshot().values).filter((key) => key.startsWith('access_grant:')).length, 1);

  await assert.rejects(
    service.redeemPreparedComplimentary({
      profile_id: 'mm-20990101-owner002',
      vertical_selection: { vertical_id: 'real_estate', confirmation: 'CUSTOMER_CONFIRMED' },
    }, requestContext),
    /complimentary_flow_conflict/u,
  );
  await assert.rejects(
    service.redeemPreparedComplimentary({
      profile_id: PROFILE_ID,
      vertical_selection: { vertical_id: 'real_estate', confirmation: 'CUSTOMER_CONFIRMED' },
    }, { cookie_header: `${cookieHeader(invalid.receipt)}; trusted-owner=true` }),
    /complimentary_capability_invalid/u,
  );
});

test('prepared BA redemption rejects unfinished BOS and unconfirmed or unsupported vertical before a grant exists', async () => {
  const unfinished = fixture({ profileStateReader: async () => ({ bos: 'missing', ba: 'missing' }) });
  const unfinishedReceipt = await unfinished.service.prepareComplimentaryFlow({
    product_key: 'business_assessment', capability: CODE, idempotency_key: 'synthetic-unfinished-bos-attempt',
  });
  await assert.rejects(
    unfinished.service.redeemPreparedComplimentary({
      profile_id: PROFILE_ID,
      vertical_selection: { vertical_id: 'real_estate', confirmation: 'CUSTOMER_CONFIRMED' },
    }, { cookie_header: `${cookieHeader(unfinishedReceipt.receipt)}; trusted-owner=true` }),
    /completed_bos_required/u,
  );
  assert.equal(Object.keys(unfinished.store.snapshot().values).some((key) => key.startsWith('access_grant:')), false);

  const ready = fixture();
  const readyReceipt = await ready.service.prepareComplimentaryFlow({
    product_key: 'business_assessment', capability: CODE, idempotency_key: 'synthetic-vertical-gate-attempt',
  });
  const context = { cookie_header: `${cookieHeader(readyReceipt.receipt)}; trusted-owner=true` };
  await assert.rejects(
    ready.service.redeemPreparedComplimentary({
      profile_id: PROFILE_ID,
      vertical_selection: { vertical_id: 'real_estate', confirmation: 'UNCONFIRMED' },
    }, context),
    /BA_VERTICAL_SELECTION_UNCONFIRMED/u,
  );
  await assert.rejects(
    ready.service.redeemPreparedComplimentary({
      profile_id: PROFILE_ID,
      vertical_selection: { vertical_id: 'unsupported_vertical', confirmation: 'CUSTOMER_CONFIRMED' },
    }, context),
  );
  assert.equal(Object.keys(ready.store.snapshot().values).some((key) => key.startsWith('access_grant:')), false);
});

test('flow binding passes its remaining TTL and concurrent cross-Profile use has exactly one winner', async () => {
  class TtlCaptureStore extends MemoryPublicStore {
    constructor() { super(); this.flowTtl = null; }
    async setNx(key, value, ttlSeconds) {
      if (key.startsWith('public_product_v1:complimentary_flow_binding:')) this.flowTtl = ttlSeconds;
      return super.setNx(key, value, ttlSeconds);
    }
  }
  const store = new TtlCaptureStore();
  const { service } = fixture({ store });
  const prepared = await service.prepareComplimentaryFlow({
    product_key: 'business_assessment', capability: CODE, idempotency_key: 'synthetic-concurrent-binding-attempt',
  });
  const context = { cookie_header: `${cookieHeader(prepared.receipt)}; trusted-owner=true` };
  const results = await Promise.allSettled([
    service.redeemPreparedComplimentary({
      profile_id: PROFILE_ID,
      vertical_selection: { vertical_id: 'real_estate', confirmation: 'CUSTOMER_CONFIRMED' },
    }, context),
    service.redeemPreparedComplimentary({
      profile_id: 'mm-20990101-owner002',
      vertical_selection: { vertical_id: 'real_estate', confirmation: 'CUSTOMER_CONFIRMED' },
    }, context),
  ]);
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(results.filter((item) => item.status === 'rejected' && /complimentary_flow_conflict/u.test(item.reason.message)).length, 1);
  assert.equal(store.flowTtl, 1800);
  assert.equal(Object.keys(store.snapshot().values).filter((key) => key.startsWith('access_grant:')).length, 1);
});

test('access HTTP prepare response never exposes capability authority and discard clears even while disabled', async () => {
  const { service } = fixture();
  const enabledEnv = {
    PUBLIC_COMPLIMENTARY_REDEMPTION_ENABLED: 'true',
    PUBLIC_PRODUCT_START_ENFORCEMENT_ENABLED: 'true',
    MOREMINDMAP_SERVER_ONLY_PRODUCT_START_SIGNING_KEY: START_KEY,
    MOREMINDMAP_SERVER_ONLY_COMPLIMENTARY_PEPPER: PEPPER,
    MOREMINDMAP_SERVER_ONLY_COMPLIMENTARY_MANIFEST: manifest(),
    PUBLIC_ALLOWED_ORIGINS: AUDIENCE,
    PUBLIC_SITE_URL: AUDIENCE,
  };
  const handler = createAccessHandler({ env: enabledEnv, serviceFactory: async () => ({ service }) });
  const prepared = response();
  await handler({
    method: 'POST',
    headers: { origin: AUDIENCE, 'x-forwarded-for': '192.0.2.2' },
    body: { action: 'prepare_complimentary', product_key: 'business_assessment', capability: CODE, idempotency_key: IDEM },
  }, prepared);
  assert.equal(prepared.statusCode, 202);
  assert.deepEqual(prepared.payload, { ok: true, state: 'complimentary_path_selected', product_key: 'business_assessment' });
  assert.match(prepared.headers['set-cookie'], /^__Host-more_public_complimentary=/u);
  assert.doesNotMatch(JSON.stringify(prepared.payload), /capability|digest|receipt|signing/iu);

  const invalidPrepared = response();
  await handler({
    method: 'POST',
    headers: { origin: AUDIENCE, 'x-forwarded-for': '192.0.2.2' },
    body: {
      action: 'prepare_complimentary',
      product_key: 'business_assessment',
      capability: 'synthetic-invalid-capability',
      idempotency_key: 'synthetic-invalid-attempt-key',
    },
  }, invalidPrepared);
  assert.equal(invalidPrepared.statusCode, prepared.statusCode);
  assert.deepEqual(invalidPrepared.payload, prepared.payload);

  const unauthenticatedPreparedOutcomes = [];
  for (const preparedCookie of [prepared.headers['set-cookie'], invalidPrepared.headers['set-cookie']]) {
    const redemption = response();
    await handler({
      method: 'POST',
      headers: {
        origin: AUDIENCE,
        cookie: preparedCookie.split(';')[0],
        'x-forwarded-for': '192.0.2.3',
      },
      body: {
        action: 'redeem_prepared_complimentary',
        profile_id: PROFILE_ID,
        vertical_selection: { vertical_id: 'real_estate', confirmation: 'CUSTOMER_CONFIRMED' },
      },
    }, redemption);
    unauthenticatedPreparedOutcomes.push({ statusCode: redemption.statusCode, payload: redemption.payload });
  }
  assert.deepEqual(unauthenticatedPreparedOutcomes[0], unauthenticatedPreparedOutcomes[1]);
  assert.deepEqual(unauthenticatedPreparedOutcomes[0], {
    statusCode: 400,
    payload: { ok: false, error: 'profile_ownership_required' },
  });

  const directBaOutcomes = [];
  for (const capability of [CODE, 'synthetic-invalid-capability']) {
    const direct = response();
    await handler({
      method: 'POST',
      headers: { origin: AUDIENCE, 'x-forwarded-for': '192.0.2.3' },
      body: {
        action: 'redeem',
        product_key: 'business_assessment',
        capability,
        idempotency_key: `synthetic-direct-ba-${directBaOutcomes.length + 1}`,
      },
    }, direct);
    directBaOutcomes.push({ statusCode: direct.statusCode, payload: direct.payload });
  }
  assert.deepEqual(directBaOutcomes[0], directBaOutcomes[1]);
  assert.deepEqual(directBaOutcomes[0], {
    statusCode: 400,
    payload: { ok: false, error: 'complimentary_flow_required' },
  });

  const receiptToken = decodeURIComponent(prepared.headers['set-cookie'].split(';')[0].slice(`${COMPLIMENTARY_FLOW_COOKIE}=`.length));
  const expiredService = fixture({ clock: () => NOW + 31 * 60 * 1000 }).service;
  const expiredHandler = createAccessHandler({ env: enabledEnv, serviceFactory: async () => ({ service: expiredService }) });
  const expired = response();
  await expiredHandler({
    method: 'POST',
    headers: { origin: AUDIENCE, cookie: cookieHeader(receiptToken), 'x-forwarded-for': '192.0.2.4' },
    body: { action: 'prepared_complimentary_status' },
  }, expired);
  assert.equal(expired.statusCode, 400);
  assert.deepEqual(expired.payload, { ok: false, error: 'complimentary_flow_invalid' });

  const discard = response();
  const disabled = createAccessHandler({ env: { ...enabledEnv, PUBLIC_COMPLIMENTARY_REDEMPTION_ENABLED: 'false' }, serviceFactory: async () => { throw new Error('must_not_open_runtime'); } });
  await disabled({
    method: 'POST',
    headers: { origin: AUDIENCE },
    body: { action: 'discard_prepared_complimentary' },
  }, discard);
  assert.equal(discard.statusCode, 200);
  assert.equal(discard.headers['set-cookie'], clearComplimentaryFlowCookie());
});

test('Step 1 and Step 2 client paths keep retrieval separate and complete prepared BA access in governed order', () => {
  const source = fs.readFileSync('src/PublicSiteV21.jsx', 'utf8');
  assert.match(source, /Complimentary access code/u);
  assert.match(source, /id="step2-profile" name="profileId"/u);
  assert.match(source, /id="step2-capability" name="capability"/u);
  assert.doesNotMatch(source, /MORE Profile ID or complimentary access code/u);
  assert.match(source, /action: 'prepare_complimentary'/u);
  assert.match(source, /Complimentary Business Assessment selected/u);
  assert.match(source, /We have not validated the access code yet/u);
  assert.match(source, /action: 'prepared_complimentary_status'/u);
  assert.match(source, /action: 'redeem_prepared_complimentary'/u);
  const redemption = source.indexOf("action: 'redeem_prepared_complimentary'");
  const token = source.indexOf("action: 'create_start_token'", redemption);
  const start = source.indexOf("'/api/public-v1/product-start'", token);
  const stored = source.indexOf('storePublicStartToken(token.start_token)', start);
  assert.equal(redemption > 0 && redemption < token && token < start && start < stored, true);
  assert.match(source, /state\.access === 'complimentary'/u);
  assert.match(source, /No payment was started\. Enter the access code again to resume safely\./u);
  assert.doesNotMatch(source, /Please try the verification link again/u);
  assert.match(source, /product_key: 'behavior_operating_system'/u);
  assert.match(source, /product_key: 'business_assessment'/u);
});

test('explicit complimentary ownership returns never fall through to paid checkout on missing, expired, or unavailable status', async () => {
  assert.equal(await resolveStep2OwnershipContinuation({ complimentaryReturn: false }), 'paid');
  assert.equal(await resolveStep2OwnershipContinuation({
    complimentaryReturn: true,
    readPrepared: async () => ({ product_key: 'business_assessment' }),
  }), 'complimentary');
  for (const code of ['complimentary_flow_invalid', 'not_found', 'request_unavailable']) {
    await assert.rejects(
      resolveStep2OwnershipContinuation({
        complimentaryReturn: true,
        readPrepared: async () => { throw new Error(code); },
      }),
      new RegExp(code, 'u'),
    );
  }
});
