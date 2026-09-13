import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PAID_MEMBERSHIP_NAMESPACE,
  createPaidMembershipAuthority,
  persistPaidMembershipAuthority,
} from '../api/stripe/paidMembership.js';
import {
  authenticatePaidRuntimeRequest,
  paidSubscriptionRuntimeEnabled,
  resolveActivePaidMembershipByProfile,
} from '../api/engine/subscriptionV1/paidRuntimeAuth.js';
import { buildCustomerConfirmedVerticalBinding } from '../api/business-assessment/verticalBinding.js';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';
import {
  PROFILE_OWNER_COOKIE,
  createProfileOwnershipAdapter,
} from '../src/lib/publicSiteAirlockV1/profileOwnership.js';
import { MemoryPublicStore } from '../src/lib/publicSiteAirlockV1/memoryStore.js';
import {
  PRODUCTION_BA_CASSETTE_REGISTRY,
  buildCustomerConfirmedSelection,
} from '../src/lib/baVerticalCassettesV1/index.js';

const signingKey = 'synthetic-paid-runtime-owner-signing-key-at-least-32-characters';
const nowMs = Date.parse('2026-09-11T21:00:00.000Z');
const profileId = 'mm-20260911-a1b2c3d4';
const conflictingProfileId = 'mm-20260911-deadbeef';
const ownerEmail = 'paid-owner@example.test';
const env = Object.freeze({
  PUBLIC_SUBSCRIPTION_RUNTIME_ENABLED: 'true',
  PUBLIC_PROFILE_OWNERSHIP_ENVIRONMENT: 'preview',
  PUBLIC_SITE_URL: 'https://paid-candidate.example.test',
  MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_SIGNING_KEY: signingKey,
});

class MemoryStore {
  constructor() {
    this.values = new Map();
    this.reads = [];
  }

  async get(key) {
    this.reads.push(key);
    return this.values.get(key) ?? null;
  }

  async setNx(key, value) {
    if (this.values.has(key)) return false;
    this.values.set(key, value);
    return true;
  }
}

const selection = buildCustomerConfirmedSelection(
  PRODUCTION_BA_CASSETTE_REGISTRY.resolveVertical('real_estate'),
);
const assessment = Object.freeze({
  assessment_id: 'ba-20260911-acde1234',
  owner_profile_id: profileId,
  vertical_binding: buildCustomerConfirmedVerticalBinding({
    selection,
    selectedAt: '2026-09-11T20:00:00.000Z',
  }),
});

function authority() {
  return createPaidMembershipAuthority({
    provider_subject: ownerEmail,
    profile_id: profileId,
    profile_state: { bos: 'ready', ba: 'ready' },
    assessment,
    ownership_verified: true,
    created_at: '2026-09-11T20:00:00.000Z',
  });
}

async function verifiedOwnerCookie({ profile = profileId, clock = nowMs } = {}) {
  const ownershipStore = new MemoryPublicStore();
  await ownershipStore.set(`vault:profile:${profile}`, JSON.stringify({ email: ownerEmail }));
  let token = '';
  const adapter = createProfileOwnershipAdapter({
    store: ownershipStore,
    ownerReader: async (requestedProfile) => requestedProfile === profile
      ? { profile_id: profile, recipient_email: ownerEmail }
      : null,
    transport: { send: async (delivery) => { token = delivery.token; return { success: true }; } },
    signingKey,
    audience: 'more-public-profile-owner-receipt-v1|preview|https://paid-candidate.example.test',
    clock: () => clock,
    tokenFactory: () => 'synthetic-paid-owner-token-abcdefghijklmnopqrstuvwxyz',
    minimumResponseDelayMs: 0,
  });
  await adapter.requestChallenge({ profile_id: profile });
  const verified = await adapter.consumeChallenge(token);
  return `${PROFILE_OWNER_COOKIE}=${encodeURIComponent(verified.receipt)}`;
}

test('paid runtime auth is exact-value default-off before receipt or store access', async () => {
  let reads = 0;
  const redis = { async get() { reads += 1; throw new Error('must not read'); } };
  assert.equal(paidSubscriptionRuntimeEnabled({ PUBLIC_SUBSCRIPTION_RUNTIME_ENABLED: 'true' }), true);
  for (const value of [undefined, '', 'TRUE', '1', true]) {
    assert.equal(paidSubscriptionRuntimeEnabled({ PUBLIC_SUBSCRIPTION_RUNTIME_ENABLED: value }), false);
  }
  const result = await authenticatePaidRuntimeRequest({
    redis,
    req: { headers: {} },
    env: { ...env, PUBLIC_SUBSCRIPTION_RUNTIME_ENABLED: 'TRUE' },
    nowMs,
  });
  assert.deepEqual(result, {
    ok: false,
    code: 'SUBSCRIPTION_V1_PAID_RUNTIME_DEFAULT_OFF',
    status: 404,
    failure_class: 'RUNTIME_DEFAULT_OFF',
  });
  assert.equal(reads, 0);
});

test('signed Profile is the sole locator and produces a stable, exact paid membership capability', async () => {
  const redis = new MemoryStore();
  const paidAuthority = authority();
  await persistPaidMembershipAuthority(redis, paidAuthority);
  redis.reads.length = 0;
  const cookie = await verifiedOwnerCookie();
  const request = {
    headers: {
      cookie,
      'x-profile-id': conflictingProfileId,
    },
    query: { profile_id: conflictingProfileId },
    body: { profile_id: conflictingProfileId, email: 'attacker@example.test' },
  };

  const first = await authenticatePaidRuntimeRequest({ redis, req: request, env, nowMs });
  const second = await authenticatePaidRuntimeRequest({
    redis,
    req: { ...request, body: { profile_id: 'mm-20260911-ffffffff' } },
    env,
    nowMs: nowMs + 60_000,
  });

  assert.equal(first.ok, true);
  assert.equal(first.code, 'SUBSCRIPTION_V1_PAID_RUNTIME_AUTHENTICATED');
  assert.deepEqual(first.scope, paidAuthority.scope);
  assert.deepEqual(first.paid_membership_scope, paidAuthority.scope);
  assert.deepEqual(first.capability.paid_membership_scope, paidAuthority.scope);
  assert.equal(first.capability.subject_key, paidAuthority.scope.subject_id);
  assert.match(first.capability.relationship_key, /^paid_[a-f0-9]{32}$/u);
  assert.equal(first.authenticated, true);
  assert.equal(first.capability.authenticated, true);
  assert.equal(first.capability.membership_verified, true);
  assert.equal(first.capability.binding_source, 'AUTHENTICATED_SERVER_CONTEXT');
  assert.equal(first.capability.synthetic_only, false);
  assert.equal(first.capability_hash, hashCanonicalJson(first.capability));
  assert.equal(second.capability_hash, first.capability_hash);
  assert.deepEqual(second.capability, first.capability);
  assert.equal(JSON.stringify(first).includes(ownerEmail), false);
  assert.equal(JSON.stringify(first).includes('provider_subject'), false);
  assert.equal(redis.reads.includes(`${PAID_MEMBERSHIP_NAMESPACE}:profile:${conflictingProfileId}`), false);
  assert.deepEqual(redis.reads.slice(0, 3), [
    `${PAID_MEMBERSHIP_NAMESPACE}:profile:${profileId}`,
    `${PAID_MEMBERSHIP_NAMESPACE}:membership:${paidAuthority.scope.membership_id}`,
    `${PAID_MEMBERSHIP_NAMESPACE}:subject:${paidAuthority.scope.subject_id}`,
  ]);
});

test('missing, expired, tampered, and cross-audience receipts fail before paid membership reads', async () => {
  const validCookie = await verifiedOwnerCookie();
  const [cookieName, receipt] = validCookie.split('=');
  const cases = [
    { headers: {} },
    { headers: { cookie: `${cookieName}=${receipt.slice(0, -1)}x` } },
    { headers: { cookie: validCookie }, nowMs: nowMs + (31 * 60 * 1000) },
    { headers: { cookie: validCookie }, env: { ...env, PUBLIC_SITE_URL: 'https://other-candidate.example.test' } },
  ];
  for (const item of cases) {
    const redis = new MemoryStore();
    const result = await authenticatePaidRuntimeRequest({
      redis,
      req: { headers: item.headers },
      env: item.env || env,
      nowMs: item.nowMs || nowMs,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'SUBSCRIPTION_V1_PAID_PROFILE_OWNER_RECEIPT_REQUIRED');
    assert.equal(result.status, 401);
    assert.equal(redis.reads.length, 0);
  }
});

test('enabled runtime fails closed when receipt configuration, clock, or durable store is unavailable', async () => {
  const cookie = await verifiedOwnerCookie();
  const missingSigningKey = await authenticatePaidRuntimeRequest({
    redis: new MemoryStore(),
    req: { headers: { cookie } },
    env: { ...env, MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_SIGNING_KEY: '' },
    nowMs,
  });
  assert.equal(missingSigningKey.status, 503);
  assert.equal(missingSigningKey.failure_class, 'PROFILE_OWNER_SIGNING_CONFIGURATION_UNAVAILABLE');

  const invalidClock = await authenticatePaidRuntimeRequest({
    redis: new MemoryStore(),
    req: { headers: { cookie } },
    env,
    nowMs: Number.NaN,
  });
  assert.equal(invalidClock.status, 503);
  assert.equal(invalidClock.failure_class, 'PROFILE_OWNER_CLOCK_UNAVAILABLE');

  const storeFailure = await authenticatePaidRuntimeRequest({
    redis: { async get() { throw new Error('synthetic connection failure'); } },
    req: { headers: { cookie } },
    env,
    nowMs,
  });
  assert.equal(storeFailure.status, 503);
  assert.equal(storeFailure.failure_class, 'PAID_MEMBERSHIP_STORE_UNAVAILABLE');
});

test('profile-only resolver validates the active subject, owner membership, and exact scope', async () => {
  const redis = new MemoryStore();
  const paidAuthority = authority();
  await persistPaidMembershipAuthority(redis, paidAuthority);
  const resolved = await resolveActivePaidMembershipByProfile({ store: redis, profile_id: profileId });
  assert.deepEqual(resolved.scope, paidAuthority.scope);
  assert.equal(resolved.scope_hash, hashCanonicalJson(paidAuthority.scope));
  assert.equal(resolved.membership_verified, true);
  assert.equal(resolved.profile_id_role, 'SIGNED_CLAIM_MEMBERSHIP_LOCATOR_ONLY');
  assert.equal(Object.hasOwn(resolved, 'subject'), false);
  assert.equal(Object.hasOwn(resolved, 'membership'), false);

  const membershipKey = `${PAID_MEMBERSHIP_NAMESPACE}:membership:${paidAuthority.scope.membership_id}`;
  const activeMembership = JSON.parse(redis.values.get(membershipKey));
  redis.values.set(membershipKey, JSON.stringify({
    ...activeMembership,
    status: 'ENDED',
    ended_at: '2026-09-11T20:30:00.000Z',
  }));
  await assert.rejects(
    resolveActivePaidMembershipByProfile({ store: redis, profile_id: profileId }),
    /paid_membership_reconciliation_required/u,
  );
});

test('absent or corrupt durable membership custody fails closed without accepting request identity', async () => {
  const cookie = await verifiedOwnerCookie();
  const missing = new MemoryStore();
  const noMembership = await authenticatePaidRuntimeRequest({
    redis: missing,
    req: { headers: { cookie }, query: { profile_id: conflictingProfileId } },
    env,
    nowMs,
  });
  assert.equal(noMembership.code, 'SUBSCRIPTION_V1_PAID_MEMBERSHIP_REQUIRED');
  assert.equal(noMembership.status, 403);

  const corrupt = new MemoryStore();
  const paidAuthority = authority();
  await persistPaidMembershipAuthority(corrupt, paidAuthority);
  const subjectKey = `${PAID_MEMBERSHIP_NAMESPACE}:subject:${paidAuthority.scope.subject_id}`;
  const subject = JSON.parse(corrupt.values.get(subjectKey));
  corrupt.values.set(subjectKey, JSON.stringify({ ...subject, status: 'SUSPENDED' }));
  const reconciled = await authenticatePaidRuntimeRequest({
    redis: corrupt,
    req: { headers: { cookie } },
    env,
    nowMs,
  });
  assert.equal(reconciled.code, 'SUBSCRIPTION_V1_PAID_MEMBERSHIP_RECONCILIATION_REQUIRED');
  assert.equal(reconciled.status, 403);
  assert.equal(Object.hasOwn(reconciled, 'capability_hash'), false);
});
