import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCustomerConfirmedVerticalBinding } from '../api/business-assessment/verticalBinding.js';
import {
  fullPersonQaProfileDigest,
  issueFullPersonQaCapability,
} from '../api/engine/subscriptionV1/fullPersonQaAccess.js';
import {
  authenticateSyntheticQaRuntimeRequest,
  syntheticQaAccessContext,
  syntheticQaRuntimeEnabled,
} from '../api/engine/subscriptionV1/syntheticQaRuntimeAuth.js';
import { syntheticQaCapabilityStateKey } from '../api/engine/subscriptionV1/syntheticQaRuntimeInfrastructure.js';
import {
  createSyntheticQaProviderBoundary,
  createSyntheticQaSubscriptionV1RuntimeComposition,
  resolveSyntheticQaEntitlement,
  syntheticQaFailureProjection,
  syntheticQaGetProjection,
  syntheticQaProviderEnabled,
} from '../api/engine/subscriptionV1/syntheticQaRuntimeComposition.js';
import { redactPaidRuntimePayload } from '../api/engine/subscriptionV1/paidRuntimeHandler.js';
import { createSubscriptionV1RuntimeEntry } from '../api/internal/subscription-v1-runtime.js';
import {
  PRODUCTION_BA_CASSETTE_REGISTRY,
  buildCustomerConfirmedSelection,
} from '../src/lib/baVerticalCassettesV1/index.js';
import { InMemoryAllowanceSessionLedger } from '../src/lib/subscriptionV1/sessionLedger.js';

const NOW = new Date('2026-09-13T18:00:00.000Z');
const PROFILE_IDS = Object.freeze([
  'mm-20260913-a1b2c3d4',
  'mm-20260913-b2c3d4e5',
  'mm-20260913-c3d4e5f6',
  'mm-20260913-d4e5f6g7',
]);
const PROFILE_ID = PROFILE_IDS[0];
const ASSESSMENT_ID = 'ba-20260913-aabbccdd';
const DIGEST_KEY = 'synthetic-runtime-auth-digest-key-for-tests-0000000000000001';
const SIGNING_KEY = 'synthetic-runtime-auth-signing-key-for-tests-000000000000001';
const TOKEN = 'Q'.repeat(43);

class MemoryRedis {
  constructor() {
    this.values = new Map();
    this.reads = [];
  }

  async get(key) {
    this.reads.push(key);
    return this.values.get(key) ?? null;
  }
}

function request(cookie = '') {
  return {
    method: 'GET',
    headers: {
      host: 'subscription-canary.example.test',
      origin: 'https://subscription-canary.example.test',
      'x-forwarded-proto': 'https',
      'x-vercel-forwarded-for': '203.0.113.24',
      'x-forwarded-for': '203.0.113.24',
      'user-agent': 'Synthetic QA runtime test browser',
      ...(cookie ? { cookie } : {}),
    },
    socket: {},
  };
}

function manifest() {
  return JSON.stringify(PROFILE_IDS.map((profileId, index) => ({
    authority_id: `synthetic_qa_runtime_person_${index + 1}`,
    expires_at: '2026-09-30T00:00:00.000Z',
    profile_digest: fullPersonQaProfileDigest(profileId, DIGEST_KEY),
    status: 'active',
  })));
}

function environment(overrides = {}) {
  return {
    PUBLIC_SUBSCRIPTION_SYNTHETIC_QA_ENABLED: 'true',
    MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_MANIFEST: manifest(),
    MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_DIGEST_KEY: DIGEST_KEY,
    MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_SIGNING_KEY: SIGNING_KEY,
    ...overrides,
  };
}

function assessmentRecord() {
  const registration = PRODUCTION_BA_CASSETTE_REGISTRY.resolveVertical('real_estate');
  const selection = buildCustomerConfirmedSelection(registration);
  return {
    owner_profile_id: PROFILE_ID,
    assessment_id: ASSESSMENT_ID,
    status: 'complete',
    version: 'business_assessment_v1_intake',
    assessment_type: 'real_estate_agent',
    created_at: '2026-09-13T17:00:00.000Z',
    updated_at: '2026-09-13T17:05:00.000Z',
    vertical_binding: buildCustomerConfirmedVerticalBinding({
      selection,
      selectedAt: '2026-09-13T17:00:00.000Z',
    }),
    inputs: {
      answers: Object.fromEntries(Array.from({ length: 12 }, (_, index) => [
        `q${index + 1}`,
        `Governed synthetic evidence for question ${index + 1}`,
      ])),
    },
  };
}

function provisionRuntimeAuthority(redis, { record = assessmentRecord() } = {}) {
  const req = request();
  const issued = issueFullPersonQaCapability({
    profile_id: PROFILE_ID,
    manifest: manifest(),
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    req,
    now: NOW,
    token_factory: () => TOKEN,
  });
  redis.values.set(
    syntheticQaCapabilityStateKey(issued.capability_hash),
    JSON.stringify(issued.receipt),
  );
  redis.values.set(`business_assessment_by_profile:${PROFILE_ID}`, ASSESSMENT_ID);
  redis.values.set(`business_assessment:${ASSESSMENT_ID}`, JSON.stringify(record));
  return {
    req: request(`__Host-more_subscription_full_person_qa=${TOKEN}`),
    issued,
  };
}

function response() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.payload = value; return this; },
  };
}

test('synthetic QA runtime is exact-value default-off before cookie or Redis access', async () => {
  assert.equal(syntheticQaRuntimeEnabled({ PUBLIC_SUBSCRIPTION_SYNTHETIC_QA_ENABLED: 'true' }), true);
  for (const value of [undefined, '', 'TRUE', '1', true]) {
    let reads = 0;
    const result = await authenticateSyntheticQaRuntimeRequest({
      redis: { async get() { reads += 1; throw new Error('must not read'); } },
      req: request(),
      env: { PUBLIC_SUBSCRIPTION_SYNTHETIC_QA_ENABLED: value },
      now: NOW,
    });
    assert.equal(result.status, 404);
    assert.equal(result.code, 'SUBSCRIPTION_V1_SYNTHETIC_QA_DEFAULT_OFF');
    assert.equal(reads, 0);
  }
});

test('composition keeps provider spending independently default-off and private', async () => {
  for (const value of [undefined, '', 'true', 'TRUE', '1', true]) {
    assert.equal(syntheticQaProviderEnabled({
      SUBSCRIPTION_V1_SYNTHETIC_QA_PROVIDER_ENABLED: value,
    }), false);
  }
  let transportFactories = 0;
  let guCalls = 0;
  const held = createSyntheticQaProviderBoundary({
    env: {},
    transportFactory: () => { transportFactories += 1; return async () => ({}); },
    guGenerator: async () => { guCalls += 1; return {}; },
  });
  assert.throws(() => held.createTransport(), /PROVIDER_BUDGET_NOT_AUTHORIZED/u);
  await assert.rejects(held.generateGu({}), /PROVIDER_BUDGET_NOT_AUTHORIZED/u);
  assert.equal(transportFactories, 0);
  assert.equal(guCalls, 0);

  const redis = {
    async get() { throw new Error('must not read during composition'); },
    async set() { throw new Error('must not write during composition'); },
    async eval() { throw new Error('must not evaluate during composition'); },
  };
  const composed = createSyntheticQaSubscriptionV1RuntimeComposition({
    redis,
    env: {
      NEW_BA_DERIVED_NAMESPACE: 'preview:new-ba:synthetic-full-person-qa-v1',
      NEW_BA_BOS_NAMESPACE: 'preview:new-bos:synthetic-full-person-qa-v1',
    },
    providerTransportFactory: () => { transportFactories += 1; return async () => ({}); },
    guGenerator: async () => { guCalls += 1; return {}; },
  });
  assert.equal(typeof composed, 'function');
  assert.equal(transportFactories, 0);
  assert.equal(guCalls, 0);

  const publicPayload = redactPaidRuntimePayload({
    ok: true,
    provider: { model: 'hidden-model', assignment: 'hidden-assignment' },
    provider_receipt: { credential: 'hidden-secret' },
    architecture: { source_library: 'hidden-library' },
    stripe_customer_hash: 'a'.repeat(64),
    stripe_subscription_hash: 'b'.repeat(64),
  }, {
    successful_get: true,
    successful_get_projector: syntheticQaGetProjection,
    failure_projector: syntheticQaFailureProjection,
  });
  assert.equal(publicPayload.subscriber.kind, 'SYNTHETIC_QA_SUBSCRIBER');
  assert.equal(publicPayload.entitlement.billing_evidence, false);
  assert.equal(publicPayload.entitlement.stripe_subscription_created, undefined);
  const serialized = JSON.stringify(publicPayload);
  for (const forbidden of ['hidden-model', 'hidden-assignment', 'hidden-secret', 'hidden-library', 'stripe_customer_hash', 'stripe_subscription_hash']) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test('a selected but invalid synthetic QA cookie fails closed instead of falling through', async () => {
  const calls = [];
  const env = environment({ PUBLIC_SUBSCRIPTION_RUNTIME_ENABLED: 'true' });
  const entry = createSubscriptionV1RuntimeEntry({
    env,
    getRedis: () => ({ marker: 'redis' }),
    authenticateSyntheticQa: async () => ({
      ok: false,
      status: 401,
      code: 'SUBSCRIPTION_V1_SYNTHETIC_QA_CAPABILITY_INVALID',
    }),
    authenticateInternal: async () => { calls.push('internal'); return { ok: true }; },
    paidRuntimeFactory: async () => { calls.push('paid'); return async () => {}; },
  });
  const res = response();
  await entry(request('__Host-more_subscription_full_person_qa=malformed'), res);
  assert.deepEqual(calls, []);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.payload, {
    ok: false,
    code: 'SUBSCRIPTION_V1_SYNTHETIC_QA_CAPABILITY_INVALID',
    reentry_required: true,
  });
});

test('opaque capability selects one exact governed Profile and stable isolated scope', async () => {
  const redis = new MemoryRedis();
  const { req, issued } = provisionRuntimeAuthority(redis);
  const result = await authenticateSyntheticQaRuntimeRequest({
    redis,
    req,
    env: environment(),
    now: NOW,
  });

  assert.equal(result.ok, true);
  assert.equal(result.capability.profile_id, undefined);
  assert.equal(result.capability.subject_key, result.scope.subject_id);
  assert.equal(result.scope.profile_id, PROFILE_ID);
  assert.equal(result.scope.tenant_id, 'synthetic_qa');
  assert.equal(result.membership_verified, false);
  assert.equal(result.capability_verified, true);
  assert.equal(result.capability.synthetic_only, true);
  assert.equal(result.capability.billing_evidence, false);
  assert.equal(result.capability.stripe_subscription_created, false);
  assert.equal(result.membership_context.assessment_id, ASSESSMENT_ID);
  assert.equal(result.membership_context.authority_id, issued.receipt.authority_id);
  assert.equal(result.capability_hash, issued.capability_hash);
  assert.deepEqual(redis.reads, [
    syntheticQaCapabilityStateKey(issued.capability_hash),
    `business_assessment_by_profile:${PROFILE_ID}`,
    `business_assessment:${ASSESSMENT_ID}`,
    `business_assessment_by_profile:${PROFILE_ID}`,
    `business_assessment:${ASSESSMENT_ID}`,
  ]);
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /PAID_STRIPE|stripe_customer|stripe_subscription_hash|provider|model/iu);
});

test('missing capability and changed or mismatched governed assessment fail closed', async () => {
  const missing = new MemoryRedis();
  const absent = await authenticateSyntheticQaRuntimeRequest({
    redis: missing,
    req: request(),
    env: environment(),
    now: NOW,
  });
  assert.equal(absent.status, 401);
  assert.equal(missing.reads.length, 0);

  const mismatched = new MemoryRedis();
  const record = assessmentRecord();
  record.owner_profile_id = PROFILE_IDS[1];
  const { req } = provisionRuntimeAuthority(mismatched, { record });
  const denied = await authenticateSyntheticQaRuntimeRequest({
    redis: mismatched,
    req,
    env: environment(),
    now: NOW,
  });
  assert.equal(denied.status, 409);
  assert.equal(denied.code, 'SUBSCRIPTION_V1_SYNTHETIC_QA_PROFILE_NOT_READY');
  assert.equal(Object.hasOwn(denied, 'scope'), false);
});

test('synthetic access context projects a valid nonbilling entitlement and public label', async () => {
  const redis = new MemoryRedis();
  const { req } = provisionRuntimeAuthority(redis);
  const auth = await authenticateSyntheticQaRuntimeRequest({ redis, req, env: environment(), now: NOW });
  const context = syntheticQaAccessContext(auth);
  const entitlement = await resolveSyntheticQaEntitlement({
    scope: auth.scope,
    membership_context: context,
    now: NOW,
  });
  assert.equal(entitlement.contract_id, 'synthetic_qa_entitlement');
  assert.equal(entitlement.billing_evidence, false);
  assert.equal(entitlement.stripe_subscription_created, false);
  assert.equal(entitlement.synthetic_only, true);

  const projected = syntheticQaGetProjection({
    ok: true,
    demo_subject: 'must disappear',
    provider: { model: 'must disappear later at redaction' },
  });
  assert.equal(projected.demo_subject, undefined);
  assert.equal(projected.subscriber.kind, 'SYNTHETIC_QA_SUBSCRIBER');
  assert.equal(projected.entitlement.source, 'EXACT_FOUR_SYNTHETIC_QA_MANIFEST');
  assert.equal(projected.entitlement.billing_evidence, false);
  assert.equal(syntheticQaFailureProjection({ ok: false, code: 'SUBSCRIPTION_V1_RUNTIME_UNAVAILABLE' }).code,
    'SUBSCRIPTION_V1_SYNTHETIC_QA_RUNTIME_UNAVAILABLE');
});

test('capability reissue preserves the manifest-governed cycle and cannot reset allowance', async () => {
  const redis = new MemoryRedis();
  const record = assessmentRecord();
  redis.values.set(`business_assessment_by_profile:${PROFILE_ID}`, ASSESSMENT_ID);
  redis.values.set(`business_assessment:${ASSESSMENT_ID}`, JSON.stringify(record));
  const issueAt = async (at, token) => {
    const baseRequest = request();
    const issued = issueFullPersonQaCapability({
      profile_id: PROFILE_ID,
      manifest: manifest(),
      digest_key: DIGEST_KEY,
      signing_key: SIGNING_KEY,
      req: baseRequest,
      now: at,
      token_factory: () => token,
    });
    redis.values.set(syntheticQaCapabilityStateKey(issued.capability_hash), JSON.stringify(issued.receipt));
    return authenticateSyntheticQaRuntimeRequest({
      redis,
      req: request(`__Host-more_subscription_full_person_qa=${token}`),
      env: environment(),
      now: at,
    });
  };

  const firstAuth = await issueAt(NOW, 'L'.repeat(43));
  const secondNow = new Date(NOW.getTime() + 60 * 60 * 1000);
  const secondAuth = await issueAt(secondNow, 'M'.repeat(43));
  assert.notEqual(firstAuth.capability.expires_at, secondAuth.capability.expires_at);
  assert.equal(firstAuth.membership_context.access_ends_at, '2026-09-30T00:00:00.000Z');
  assert.equal(secondAuth.membership_context.access_ends_at, firstAuth.membership_context.access_ends_at);

  const firstEntitlement = await resolveSyntheticQaEntitlement({
    scope: firstAuth.scope,
    membership_context: firstAuth.membership_context,
    now: NOW,
  });
  const secondEntitlement = await resolveSyntheticQaEntitlement({
    scope: secondAuth.scope,
    membership_context: secondAuth.membership_context,
    now: secondNow,
  });
  assert.equal(secondEntitlement.entitlement_id, firstEntitlement.entitlement_id);
  assert.equal(secondEntitlement.billing_cycle_start, firstEntitlement.billing_cycle_start);
  assert.equal(secondEntitlement.billing_cycle_end, firstEntitlement.billing_cycle_end);

  const ledger = new InMemoryAllowanceSessionLedger();
  const firstCycle = ledger.createCycle(firstEntitlement).ledger;
  const reserved = ledger.reserve({
    ledger_id: firstCycle.ledger_id,
    scope: firstAuth.scope,
    idempotency_key: 'synthetic-reissue-first-use',
    now: NOW.toISOString(),
  });
  ledger.activate({ session_id: reserved.session.session_id, scope: firstAuth.scope, now: NOW.toISOString() });
  ledger.recordFirstValidResponse({
    session_id: reserved.session.session_id,
    scope: firstAuth.scope,
    response_hash: 'a'.repeat(64),
    now: NOW.toISOString(),
  });
  const replayedCycle = ledger.createCycle(secondEntitlement);
  assert.equal(replayedCycle.code, 'IDEMPOTENT_REPLAY');
  assert.equal(replayedCycle.ledger.ledger_id, firstCycle.ledger_id);
  assert.equal(replayedCycle.ledger.standard_slots_consumed, 1);
});

test('valid synthetic QA authority has priority while an absent authority preserves existing routes', async () => {
  const calls = [];
  const env = environment({ PUBLIC_SUBSCRIPTION_RUNTIME_ENABLED: 'true' });
  const synthetic = createSubscriptionV1RuntimeEntry({
    env,
    getRedis: () => ({ marker: 'redis' }),
    authenticateSyntheticQa: async () => ({ ok: true }),
    syntheticQaRuntimeFactory: async () => async (_req, res) => {
      calls.push('synthetic');
      return res.status(200).json({ ok: true });
    },
    authenticateInternal: async () => { calls.push('internal'); return { ok: false }; },
    paidRuntimeFactory: async () => { calls.push('paid'); throw new Error('must not run'); },
  });
  await synthetic(request(), response());
  assert.deepEqual(calls, ['synthetic']);

  calls.length = 0;
  const paid = createSubscriptionV1RuntimeEntry({
    env,
    getRedis: () => ({ marker: 'redis' }),
    authenticateSyntheticQa: async () => ({ ok: false, status: 401 }),
    authenticateInternal: async () => { calls.push('internal'); return { ok: false }; },
    paidRuntimeFactory: async () => async (_req, res) => {
      calls.push('paid');
      return res.status(403).json({ ok: false, code: 'SUBSCRIPTION_V1_PAID_MEMBERSHIP_REQUIRED' });
    },
  });
  await paid(request(), response());
  assert.deepEqual(calls, ['internal', 'paid']);
});
