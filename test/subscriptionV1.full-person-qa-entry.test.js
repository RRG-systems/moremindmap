import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FULL_PERSON_QA_CAPABILITY_COOKIE,
  fullPersonQaCapabilityLookup,
  fullPersonQaProfileDigest,
  verifyFullPersonQaCapability,
} from '../api/engine/subscriptionV1/fullPersonQaAccess.js';
import {
  FULL_PERSON_QA_CAPABILITY_RECEIPT_NAMESPACE,
  FULL_PERSON_QA_ENTRY_CSRF_NAMESPACE,
  FULL_PERSON_QA_ENTRY_RATE_LIMIT,
  FULL_PERSON_QA_ENTRY_RATE_NAMESPACE,
  FULL_PERSON_QA_MAX_ACTIVE_CAPABILITIES_PER_AUTHORITY,
  createSubscriptionV1QaEntryHandler,
  fullPersonQaCapabilityReceiptKey,
} from '../api/internal/subscription-v1-qa-entry.js';

const NOW = new Date('2026-09-13T18:00:00.000Z');
const EXPIRES = '2026-09-30T00:00:00.000Z';
const DIGEST_KEY = 'synthetic-qa-entry-digest-key-for-tests-000000000000000001';
const SIGNING_KEY = 'synthetic-qa-entry-signing-key-for-tests-0000000000000001';
const PROFILE_IDS = Object.freeze([
  'mm-20260913-a1b2c3d4',
  'mm-20260913-b2c3d4e5',
  'mm-20260913-c3d4e5f6',
  'mm-20260913-d4e5f6g7',
]);

class FakeRedis {
  constructor() {
    this.values = new Map();
    this.operations = [];
  }

  async get(key) {
    this.operations.push(['get', key]);
    return this.values.get(key) ?? null;
  }

  async getdel(key) {
    this.operations.push(['getdel', key]);
    const value = this.values.get(key) ?? null;
    this.values.delete(key);
    return value;
  }

  async set(key, value, ...args) {
    this.operations.push(['set', key, String(value), ...args]);
    if (args.includes('NX') && this.values.has(key)) return null;
    this.values.set(key, String(value));
    return 'OK';
  }

  async del(key) {
    this.operations.push(['del', key]);
    return this.values.delete(key) ? 1 : 0;
  }

  async incr(key) {
    this.operations.push(['incr', key]);
    const count = Number(this.values.get(key) || 0) + 1;
    this.values.set(key, String(count));
    return count;
  }

  async expire(key, seconds) {
    this.operations.push(['expire', key, seconds]);
    return 1;
  }

  async eval(script, keyCount, ...args) {
    this.operations.push(['eval', script, keyCount, ...args]);
    if (keyCount === 1) {
      const [key] = args;
      const count = Number(this.values.get(key) || 0) + 1;
      this.values.set(key, String(count));
      return count;
    }
    if (keyCount === 2 && args.length === 7) {
      const [authorityKey, receiptKey, serialized, _ttl, capabilityHash, receiptPrefix, limit] = args;
      if (this.values.has(receiptKey)) return 0;
      const members = this.values.get(authorityKey) instanceof Set
        ? new Set(this.values.get(authorityKey))
        : new Set();
      for (const member of members) {
        if (!/^[a-f0-9]{64}$/u.test(member) || !this.values.has(`${receiptPrefix}${member}`)) {
          members.delete(member);
        }
      }
      if (members.size >= Number(limit)) {
        if (members.size === 0) this.values.delete(authorityKey);
        else this.values.set(authorityKey, members);
        return -1;
      }
      this.values.set(receiptKey, serialized);
      members.add(capabilityHash);
      this.values.set(authorityKey, members);
      return 1;
    }
    if (keyCount === 4 && args.length === 10) {
      const [newAuthorityKey, newReceiptKey, oldAuthorityKey, oldReceiptKey,
        serialized, _ttl, newCapabilityHash, receiptPrefix, limit, oldCapabilityHash] = args;
      if (!this.values.has(oldReceiptKey)) return -2;
      if (this.values.has(newReceiptKey)) return 0;
      const newMembers = this.values.get(newAuthorityKey) instanceof Set
        ? new Set(this.values.get(newAuthorityKey))
        : new Set();
      for (const member of newMembers) {
        if (!/^[a-f0-9]{64}$/u.test(member) || !this.values.has(`${receiptPrefix}${member}`)) {
          newMembers.delete(member);
        }
      }
      const replacingInSameAuthority = newAuthorityKey === oldAuthorityKey
        && this.values.has(oldReceiptKey)
        && newMembers.has(oldCapabilityHash);
      if (newMembers.size - (replacingInSameAuthority ? 1 : 0) >= Number(limit)) return -1;
      this.values.set(newReceiptKey, serialized);
      newMembers.add(newCapabilityHash);
      let oldMembers = oldAuthorityKey === newAuthorityKey
        ? newMembers
        : this.values.get(oldAuthorityKey) instanceof Set
          ? new Set(this.values.get(oldAuthorityKey))
          : new Set();
      if (this.values.has(oldReceiptKey)) {
        oldMembers.delete(oldCapabilityHash);
        this.values.delete(oldReceiptKey);
      }
      if (newMembers.size === 0) this.values.delete(newAuthorityKey);
      else this.values.set(newAuthorityKey, newMembers);
      if (oldAuthorityKey !== newAuthorityKey) {
        if (oldMembers.size === 0) this.values.delete(oldAuthorityKey);
        else this.values.set(oldAuthorityKey, oldMembers);
      }
      return 1;
    }
    if (keyCount === 2 && args.length === 3) {
      const [authorityKey, receiptKey, capabilityHash] = args;
      const members = this.values.get(authorityKey);
      if (members instanceof Set) {
        members.delete(capabilityHash);
        if (members.size === 0) this.values.delete(authorityKey);
        else this.values.set(authorityKey, members);
      }
      this.values.delete(receiptKey);
      return 1;
    }
    throw new Error(`unsupported fake Redis eval: ${script.slice(0, 20)}`);
  }
}

function qaManifest(entriesTransform = (entries) => entries) {
  const entries = PROFILE_IDS.map((profileId, index) => ({
    authority_id: `synthetic_qa_person_${index + 1}`,
    expires_at: EXPIRES,
    profile_digest: fullPersonQaProfileDigest(profileId, DIGEST_KEY),
    status: 'active',
  }));
  return JSON.stringify(entriesTransform(entries));
}

function environment(overrides = {}) {
  return {
    PUBLIC_SUBSCRIPTION_SYNTHETIC_QA_ENABLED: 'true',
    MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_MANIFEST: qaManifest(),
    MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_DIGEST_KEY: DIGEST_KEY,
    MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_SIGNING_KEY: SIGNING_KEY,
    REDIS_URL: 'redis://synthetic.invalid:6379',
    ...overrides,
  };
}

function request(method = 'GET', {
  body,
  cookie = '',
  csrf = '',
  origin = 'https://preview.moremindmap.test',
  address = '203.0.113.42',
  rawForwarded = address,
  userAgent = 'Synthetic full-person QA browser',
} = {}) {
  return {
    method,
    body,
    headers: {
      host: 'preview.moremindmap.test',
      origin,
      'x-forwarded-proto': 'https',
      'x-vercel-forwarded-for': address,
      'x-forwarded-for': rawForwarded,
      'user-agent': userAgent,
      ...(cookie ? { cookie } : {}),
      ...(csrf ? { 'x-subscription-qa-entry-csrf': csrf } : {}),
    },
    socket: {},
  };
}

function response() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

function tokenSequence(prefix = 'C') {
  let index = 0;
  return () => {
    const suffix = String(index += 1).padStart(3, '0');
    return `${prefix.repeat(40)}${suffix}`;
  };
}

async function getCsrf(handler, options = {}) {
  const res = response();
  await handler(request('GET', options), res);
  assert.equal(res.statusCode, 200);
  assert.equal(typeof res.payload.csrf_token, 'string');
  return res.payload.csrf_token;
}

function cookiePair(setCookie) {
  return String(setCookie).split(';')[0];
}

test('the entry lane is exact-value default-off and never resolves Redis while disabled', async () => {
  for (const configured of [undefined, '', 'TRUE', '1', true]) {
    let redisResolved = false;
    const env = environment();
    if (configured === undefined) delete env.PUBLIC_SUBSCRIPTION_SYNTHETIC_QA_ENABLED;
    else env.PUBLIC_SUBSCRIPTION_SYNTHETIC_QA_ENABLED = configured;
    const handler = createSubscriptionV1QaEntryHandler({
      env,
      getRedis: () => {
        redisResolved = true;
        throw new Error('must not run');
      },
    });
    const res = response();
    await handler(request('GET'), res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.payload.code, 'SUBSCRIPTION_V1_SYNTHETIC_QA_DEFAULT_OFF');
    assert.equal(redisResolved, false);
    assert.equal(res.headers['cache-control'], 'no-store, private, max-age=0');
  }
});

test('GET requires same origin and issues a QA-dedicated, browser-bound, no-store CSRF proof', async () => {
  const redis = new FakeRedis();
  const handler = createSubscriptionV1QaEntryHandler({
    env: environment(),
    getRedis: () => redis,
    csrfTokenFactory: tokenSequence('C'),
    clock: () => NOW,
  });

  const missingOrigin = response();
  await handler(request('GET', { origin: '' }), missingOrigin);
  assert.equal(missingOrigin.statusCode, 403);
  assert.equal(redis.operations.length, 0);

  const res = response();
  await handler(request('GET'), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(Object.keys(res.payload).sort(), [
    'billing_evidence',
    'code',
    'csrf_token',
    'ok',
    'synthetic_only',
  ]);
  assert.equal(res.headers['cache-control'], 'no-store, private, max-age=0');
  assert.equal(res.headers.pragma, 'no-cache');
  const csrfSet = redis.operations.find((operation) => operation[0] === 'set');
  assert.match(csrfSet[1], new RegExp(`^${FULL_PERSON_QA_ENTRY_CSRF_NAMESPACE}:`));
  assert.deepEqual(csrfSet.slice(3), ['EX', 300, 'NX']);
  assert.equal(PROFILE_IDS.some((profileId) => JSON.stringify(res.payload).includes(profileId)), false);
});

test('one-time CSRF is bound to the requesting browser and replay fails closed', async () => {
  const redis = new FakeRedis();
  const handler = createSubscriptionV1QaEntryHandler({
    env: environment(),
    getRedis: () => redis,
    csrfTokenFactory: tokenSequence('D'),
    capabilityTokenFactory: tokenSequence('T'),
    clock: () => NOW,
  });
  const proof = await getCsrf(handler);
  const changedBrowser = response();
  await handler(request('POST', {
    body: { profile_id: PROFILE_IDS[0] },
    csrf: proof,
    address: '203.0.113.43',
  }), changedBrowser);
  assert.equal(changedBrowser.statusCode, 403);
  assert.equal(changedBrowser.payload.code, 'SUBSCRIPTION_V1_SYNTHETIC_QA_ENTRY_CSRF_DENIED');

  const replay = response();
  await handler(request('POST', {
    body: { profile_id: PROFILE_IDS[0] },
    csrf: proof,
  }), replay);
  assert.equal(replay.statusCode, 403);
  assert.equal(replay.payload.code, 'SUBSCRIPTION_V1_SYNTHETIC_QA_ENTRY_CSRF_DENIED');
  assert.equal([...redis.values.keys()].some((key) => key.startsWith(FULL_PERSON_QA_CAPABILITY_RECEIPT_NAMESPACE)), false);
});

test('all and only the four manifest people receive opaque, TTL-bound nonbilling entry receipts', async () => {
  const redis = new FakeRedis();
  const handler = createSubscriptionV1QaEntryHandler({
    env: environment(),
    getRedis: () => redis,
    csrfTokenFactory: tokenSequence('E'),
    capabilityTokenFactory: tokenSequence('U'),
    clock: () => NOW,
  });
  const issued = [];

  for (const profileId of PROFILE_IDS) {
    const csrf = await getCsrf(handler);
    const res = response();
    await handler(request('POST', { body: { profile_id: profileId }, csrf }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload, {
      ok: true,
      code: 'SUBSCRIPTION_V1_SYNTHETIC_QA_ENTITLEMENT_ISSUED',
      redirect_to: '/subscription',
      synthetic_only: true,
      billing_evidence: false,
    });
    const serializedResponse = JSON.stringify(res.payload);
    assert.equal(serializedResponse.includes(profileId), false);
    assert.doesNotMatch(serializedResponse, /provider|model|stripe|customer/iu);
    assert.equal(Array.isArray(res.headers['set-cookie']), true);
    assert.equal(res.headers['set-cookie'].some((value) => value.startsWith('__Host-more_subscription_internal=;')), true);
    assert.equal(res.headers['set-cookie'].some((value) => value.startsWith('__Host-more_subscription_relationship=;')), true);
    const qaCookie = res.headers['set-cookie'].find((value) => value.startsWith(`${FULL_PERSON_QA_CAPABILITY_COOKIE}=`));
    assert.match(qaCookie, /HttpOnly; Secure; SameSite=Strict; Max-Age=/u);
    assert.equal(qaCookie.includes(profileId), false);
    issued.push({ profileId, qaCookie });
  }

  const receiptEntries = [...redis.values.entries()]
    .filter(([key]) => key.startsWith(`${FULL_PERSON_QA_CAPABILITY_RECEIPT_NAMESPACE}:`));
  assert.equal(receiptEntries.length, 4);
  const persistedProfiles = receiptEntries.map(([, value]) => JSON.parse(value).profile_id).sort();
  assert.deepEqual(persistedProfiles, [...PROFILE_IDS].sort());
  for (const [key, value] of receiptEntries) {
    assert.equal(key, fullPersonQaCapabilityReceiptKey(JSON.parse(value).capability_hash));
    const persistence = redis.operations.find((operation) => (
      operation[0] === 'eval' && operation[4] === key
    ));
    assert.equal(typeof persistence[5], 'string');
    assert.equal(Number.isInteger(Number(persistence[6])), true);
    assert.equal(Number(persistence[6]) > 0 && Number(persistence[6]) <= 8 * 60 * 60, true);
  }
  assert.equal([...redis.values.keys()].every((key) => (
    key.startsWith(`${FULL_PERSON_QA_ENTRY_CSRF_NAMESPACE}:`)
      || key.startsWith(`${FULL_PERSON_QA_ENTRY_RATE_NAMESPACE}:`)
      || key.startsWith(`${FULL_PERSON_QA_CAPABILITY_RECEIPT_NAMESPACE}:`)
      || key.startsWith('more:subscription-v1:synthetic-qa:v1:authority-capability:')
  )), true);

  const firstReceipt = JSON.parse(receiptEntries.find(([, value]) => (
    JSON.parse(value).profile_id === issued[0].profileId
  ))[1]);
  const verified = verifyFullPersonQaCapability({
    req: request('GET', { cookie: cookiePair(issued[0].qaCookie) }),
    receipt: firstReceipt,
    manifest: environment().MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_MANIFEST,
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    now: new Date('2026-09-13T19:00:00.000Z'),
  });
  assert.equal(verified.ok, true);
  assert.equal(verified.capability.profile_id, PROFILE_IDS[0]);
  assert.equal(verified.capability.synthetic_only, true);
  assert.equal(verified.capability.billing_evidence, false);
  assert.equal(verified.capability.stripe_subscription_created, false);
});

test('malformed, unlisted, revoked, and expired identifiers share one denial response', async () => {
  const cases = [
    { profileId: 'not-an-mm-id' },
    { profileId: 'mm-20260913-z9y8x7w6' },
    {
      profileId: PROFILE_IDS[0],
      manifest: qaManifest((entries) => {
        entries[0].status = 'revoked';
        return entries;
      }),
    },
    {
      profileId: PROFILE_IDS[0],
      manifest: qaManifest((entries) => {
        entries[0].expires_at = NOW.toISOString();
        return entries;
      }),
    },
  ];
  const denials = [];
  for (const [index, scenario] of cases.entries()) {
    const redis = new FakeRedis();
    const handler = createSubscriptionV1QaEntryHandler({
      env: environment(scenario.manifest ? {
        MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_MANIFEST: scenario.manifest,
      } : {}),
      getRedis: () => redis,
      csrfTokenFactory: tokenSequence(String.fromCharCode(70 + index)),
      capabilityTokenFactory: tokenSequence(String.fromCharCode(75 + index)),
      clock: () => NOW,
    });
    const csrf = await getCsrf(handler);
    const res = response();
    await handler(request('POST', { body: { profile_id: scenario.profileId }, csrf }), res);
    denials.push({ status: res.statusCode, payload: res.payload });
    assert.equal([...redis.values.keys()].some((key) => key.startsWith(`${FULL_PERSON_QA_CAPABILITY_RECEIPT_NAMESPACE}:`)), false);
  }
  assert.equal(denials.every((denial) => denial.status === 401), true);
  assert.equal(new Set(denials.map((denial) => JSON.stringify(denial.payload))).size, 1);
  assert.deepEqual(denials[0].payload, {
    ok: false,
    code: 'SUBSCRIPTION_V1_SYNTHETIC_QA_PROFILE_INVALID',
  });
});

test('the dedicated client rate limit rejects the thirteenth consumed entry attempt', async () => {
  const redis = new FakeRedis();
  const handler = createSubscriptionV1QaEntryHandler({
    env: environment(),
    getRedis: () => redis,
    csrfTokenFactory: tokenSequence('R'),
    capabilityTokenFactory: tokenSequence('V'),
    clock: () => NOW,
  });
  for (let attempt = 1; attempt <= FULL_PERSON_QA_ENTRY_RATE_LIMIT + 1; attempt += 1) {
    const csrf = await getCsrf(handler);
    const res = response();
    await handler(request('POST', {
      body: { profile_id: 'mm-20260913-z9y8x7w6' },
      csrf,
    }), res);
    assert.equal(res.statusCode, attempt <= FULL_PERSON_QA_ENTRY_RATE_LIMIT ? 401 : 429);
  }
  const rateKeys = [...redis.values.keys()].filter((key) => key.startsWith(`${FULL_PERSON_QA_ENTRY_RATE_NAMESPACE}:post:`));
  assert.equal(rateKeys.length, 1);
  assert.equal(redis.values.get(rateKeys[0]), String(FULL_PERSON_QA_ENTRY_RATE_LIMIT + 1));
});

test('GET key creation is network-bounded even when user-agent strings rotate', async () => {
  const redis = new FakeRedis();
  const handler = createSubscriptionV1QaEntryHandler({
    env: environment(),
    getRedis: () => redis,
    csrfTokenFactory: tokenSequence('G'),
    clock: () => NOW,
  });
  for (let attempt = 1; attempt <= 37; attempt += 1) {
    const res = response();
    await handler(request('GET', { userAgent: `rotating-agent-${attempt}` }), res);
    assert.equal(res.statusCode, attempt <= 36 ? 200 : 429);
  }
  const csrfKeys = [...redis.values.keys()].filter((key) => key.startsWith(`${FULL_PERSON_QA_ENTRY_CSRF_NAMESPACE}:`));
  assert.equal(csrfKeys.length, 36);
  const getRateKeys = [...redis.values.keys()].filter((key) => key.startsWith(`${FULL_PERSON_QA_ENTRY_RATE_NAMESPACE}:get:`));
  assert.equal(getRateKeys.length, 1);
  assert.equal(redis.values.get(getRateKeys[0]), '37');
});

test('untrusted legacy forwarding cannot create a fresh network rate bucket', async () => {
  const redis = new FakeRedis();
  const handler = createSubscriptionV1QaEntryHandler({
    env: environment(),
    getRedis: () => redis,
    csrfTokenFactory: tokenSequence('J'),
    clock: () => NOW,
  });
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const res = response();
    await handler(request('GET', {
      rawForwarded: `198.51.100.${attempt}`,
    }), res);
    assert.equal(res.statusCode, 200);
  }
  const getRateKeys = [...redis.values.keys()].filter((key) => key.startsWith(`${FULL_PERSON_QA_ENTRY_RATE_NAMESPACE}:get:`));
  assert.equal(getRateKeys.length, 1);
  assert.equal(redis.values.get(getRateKeys[0]), '4');
});

test('two browsers for one exact person retain independent usable capabilities and one logout revokes only itself', async () => {
  const redis = new FakeRedis();
  const handler = createSubscriptionV1QaEntryHandler({
    env: environment(),
    getRedis: () => redis,
    csrfTokenFactory: tokenSequence('H'),
    capabilityTokenFactory: tokenSequence('Y'),
    clock: () => NOW,
  });
  const enter = async (browser) => {
    const csrf = await getCsrf(handler, browser);
    const res = response();
    await handler(request('POST', {
      ...browser,
      body: { profile_id: PROFILE_IDS[0] },
      csrf,
    }), res);
    assert.equal(res.statusCode, 200);
    return res.headers['set-cookie'].find((value) => value.startsWith(`${FULL_PERSON_QA_CAPABILITY_COOKIE}=`));
  };
  const browserOne = { address: '203.0.113.51', userAgent: 'QA browser one' };
  const browserTwo = { address: '203.0.113.52', userAgent: 'QA browser two' };
  const firstCookie = await enter(browserOne);
  const firstLookup = fullPersonQaCapabilityLookup({
    req: request('GET', { ...browserOne, cookie: cookiePair(firstCookie) }),
    signing_key: SIGNING_KEY,
  });
  assert.equal(redis.values.has(fullPersonQaCapabilityReceiptKey(firstLookup.capability_hash)), true);
  const secondCookie = await enter(browserTwo);
  const secondLookup = fullPersonQaCapabilityLookup({
    req: request('GET', { ...browserTwo, cookie: cookiePair(secondCookie) }),
    signing_key: SIGNING_KEY,
  });
  assert.notEqual(secondLookup.capability_hash, firstLookup.capability_hash);
  assert.equal(redis.values.has(fullPersonQaCapabilityReceiptKey(firstLookup.capability_hash)), true);
  assert.equal(redis.values.has(fullPersonQaCapabilityReceiptKey(secondLookup.capability_hash)), true);
  assert.equal([...redis.values.keys()].filter((key) => (
    key.startsWith(`${FULL_PERSON_QA_CAPABILITY_RECEIPT_NAMESPACE}:`)
  )).length, 2);

  for (const [browser, cookie, lookup] of [
    [browserOne, firstCookie, firstLookup],
    [browserTwo, secondCookie, secondLookup],
  ]) {
    const receipt = redis.values.get(fullPersonQaCapabilityReceiptKey(lookup.capability_hash));
    const verified = verifyFullPersonQaCapability({
      req: request('GET', { ...browser, cookie: cookiePair(cookie) }),
      receipt,
      manifest: environment().MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_MANIFEST,
      digest_key: DIGEST_KEY,
      signing_key: SIGNING_KEY,
      now: new Date('2026-09-13T19:00:00.000Z'),
    });
    assert.equal(verified.ok, true);
  }

  const logout = response();
  await handler(request('DELETE', { ...browserOne, cookie: cookiePair(firstCookie) }), logout);
  assert.equal(logout.statusCode, 200);
  assert.equal(redis.values.has(fullPersonQaCapabilityReceiptKey(firstLookup.capability_hash)), false);
  assert.equal(redis.values.has(fullPersonQaCapabilityReceiptKey(secondLookup.capability_hash)), true);
  const secondStillValid = verifyFullPersonQaCapability({
    req: request('GET', { ...browserTwo, cookie: cookiePair(secondCookie) }),
    receipt: redis.values.get(fullPersonQaCapabilityReceiptKey(secondLookup.capability_hash)),
    manifest: environment().MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_MANIFEST,
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    now: new Date('2026-09-13T19:01:00.000Z'),
  });
  assert.equal(secondStillValid.ok, true);
});

test('same-browser re-entry and person switching replace only that browser capability without quota leaks', async () => {
  const redis = new FakeRedis();
  const handler = createSubscriptionV1QaEntryHandler({
    env: environment(),
    getRedis: () => redis,
    csrfTokenFactory: tokenSequence('P'),
    capabilityTokenFactory: tokenSequence('X'),
    clock: () => NOW,
  });
  const browser = { address: '203.0.113.55', userAgent: 'QA switching browser' };
  const enter = async (profileId, priorCookie = '') => {
    const csrf = await getCsrf(handler, { ...browser, cookie: priorCookie });
    const res = response();
    await handler(request('POST', {
      ...browser,
      cookie: priorCookie,
      body: { profile_id: profileId },
      csrf,
    }), res);
    assert.equal(res.statusCode, 200);
    return res.headers['set-cookie'].find((value) => (
      value.startsWith(`${FULL_PERSON_QA_CAPABILITY_COOKIE}=`)
    ));
  };
  const lookup = (cookie) => fullPersonQaCapabilityLookup({
    req: request('GET', { ...browser, cookie: cookiePair(cookie) }),
    signing_key: SIGNING_KEY,
  });
  const receiptKeys = () => [...redis.values.keys()].filter((key) => (
    key.startsWith(`${FULL_PERSON_QA_CAPABILITY_RECEIPT_NAMESPACE}:`)
  ));

  const firstCookie = await enter(PROFILE_IDS[0]);
  const first = lookup(firstCookie);
  const reentryCookie = await enter(PROFILE_IDS[0], cookiePair(firstCookie));
  const reentry = lookup(reentryCookie);
  assert.notEqual(reentry.capability_hash, first.capability_hash);
  assert.equal(redis.values.has(fullPersonQaCapabilityReceiptKey(first.capability_hash)), false);
  assert.equal(redis.values.has(fullPersonQaCapabilityReceiptKey(reentry.capability_hash)), true);
  assert.equal(receiptKeys().length, 1);

  const switchedCookie = await enter(PROFILE_IDS[1], cookiePair(reentryCookie));
  const switched = lookup(switchedCookie);
  assert.equal(redis.values.has(fullPersonQaCapabilityReceiptKey(reentry.capability_hash)), false);
  assert.equal(redis.values.has(fullPersonQaCapabilityReceiptKey(switched.capability_hash)), true);
  assert.equal(receiptKeys().length, 1);
  const authoritySets = [...redis.values.values()].filter((value) => value instanceof Set);
  assert.equal(authoritySets.reduce((count, set) => count + set.size, 0), 1);
});

test('two concurrent replacements of one browser capability leave one winner and fail the stale request closed', async () => {
  const redis = new FakeRedis();
  const handler = createSubscriptionV1QaEntryHandler({
    env: environment(),
    getRedis: () => redis,
    csrfTokenFactory: tokenSequence('Q'),
    capabilityTokenFactory: tokenSequence('N'),
    clock: () => NOW,
  });
  const browser = { address: '203.0.113.56', userAgent: 'QA concurrent replacement browser' };
  const initialCsrf = await getCsrf(handler, browser);
  const initial = response();
  await handler(request('POST', {
    ...browser,
    body: { profile_id: PROFILE_IDS[0] },
    csrf: initialCsrf,
  }), initial);
  assert.equal(initial.statusCode, 200);
  const initialCookie = initial.headers['set-cookie'].find((value) => (
    value.startsWith(`${FULL_PERSON_QA_CAPABILITY_COOKIE}=`)
  ));
  const oldLookup = fullPersonQaCapabilityLookup({
    req: request('GET', { ...browser, cookie: cookiePair(initialCookie) }),
    signing_key: SIGNING_KEY,
  });

  const [csrfOne, csrfTwo] = await Promise.all([
    getCsrf(handler, { ...browser, cookie: cookiePair(initialCookie) }),
    getCsrf(handler, { ...browser, cookie: cookiePair(initialCookie) }),
  ]);
  const first = response();
  const second = response();
  await Promise.all([
    handler(request('POST', {
      ...browser,
      cookie: cookiePair(initialCookie),
      body: { profile_id: PROFILE_IDS[0] },
      csrf: csrfOne,
    }), first),
    handler(request('POST', {
      ...browser,
      cookie: cookiePair(initialCookie),
      body: { profile_id: PROFILE_IDS[1] },
      csrf: csrfTwo,
    }), second),
  ]);

  assert.deepEqual([first.statusCode, second.statusCode].sort((a, b) => a - b), [200, 409]);
  const stale = first.statusCode === 409 ? first : second;
  const winner = first.statusCode === 200 ? first : second;
  assert.deepEqual(stale.payload, {
    ok: false,
    code: 'SUBSCRIPTION_V1_SYNTHETIC_QA_CURRENT_CAPABILITY_CHANGED',
    reentry_required: true,
  });
  assert.match(stale.headers['set-cookie'], new RegExp(`^${FULL_PERSON_QA_CAPABILITY_COOKIE}=;`));
  assert.match(stale.headers['set-cookie'], /Max-Age=0/u);

  const winnerCookie = winner.headers['set-cookie'].find((value) => (
    value.startsWith(`${FULL_PERSON_QA_CAPABILITY_COOKIE}=`)
  ));
  const winnerLookup = fullPersonQaCapabilityLookup({
    req: request('GET', { ...browser, cookie: cookiePair(winnerCookie) }),
    signing_key: SIGNING_KEY,
  });
  assert.equal(redis.values.has(fullPersonQaCapabilityReceiptKey(oldLookup.capability_hash)), false);
  assert.equal(redis.values.has(fullPersonQaCapabilityReceiptKey(winnerLookup.capability_hash)), true);
  assert.equal([...redis.values.keys()].filter((key) => (
    key.startsWith(`${FULL_PERSON_QA_CAPABILITY_RECEIPT_NAMESPACE}:`)
  )).length, 1);
  const authoritySets = [...redis.values.values()].filter((value) => value instanceof Set);
  assert.equal(authoritySets.reduce((count, set) => count + set.size, 0), 1);
});

test('each exact authority has a strict small concurrent capability bound and expired state is pruned', async () => {
  const redis = new FakeRedis();
  const handler = createSubscriptionV1QaEntryHandler({
    env: environment(),
    getRedis: () => redis,
    csrfTokenFactory: tokenSequence('K'),
    capabilityTokenFactory: tokenSequence('Z'),
    clock: () => NOW,
  });
  const cookies = [];
  for (let index = 0; index < FULL_PERSON_QA_MAX_ACTIVE_CAPABILITIES_PER_AUTHORITY; index += 1) {
    const browser = {
      address: `203.0.113.${60 + index}`,
      userAgent: `bounded QA browser ${index}`,
    };
    const csrf = await getCsrf(handler, browser);
    const entered = response();
    await handler(request('POST', {
      ...browser,
      body: { profile_id: PROFILE_IDS[0] },
      csrf,
    }), entered);
    assert.equal(entered.statusCode, 200);
    cookies.push(entered.headers['set-cookie'].find((value) => (
      value.startsWith(`${FULL_PERSON_QA_CAPABILITY_COOKIE}=`)
    )));
  }
  const blockedBrowser = { address: '203.0.113.70', userAgent: 'bounded QA browser blocked' };
  const blockedCsrf = await getCsrf(handler, blockedBrowser);
  const blocked = response();
  await handler(request('POST', {
    ...blockedBrowser,
    body: { profile_id: PROFILE_IDS[0] },
    csrf: blockedCsrf,
  }), blocked);
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.payload.code, 'SUBSCRIPTION_V1_SYNTHETIC_QA_CAPABILITY_LIMIT_REACHED');
  assert.equal(blocked.headers['set-cookie'], undefined);
  assert.equal([...redis.values.keys()].filter((key) => (
    key.startsWith(`${FULL_PERSON_QA_CAPABILITY_RECEIPT_NAMESPACE}:`)
  )).length, FULL_PERSON_QA_MAX_ACTIVE_CAPABILITIES_PER_AUTHORITY);

  const firstLookup = fullPersonQaCapabilityLookup({
    req: request('GET', { cookie: cookiePair(cookies[0]) }),
    signing_key: SIGNING_KEY,
  });
  redis.values.delete(fullPersonQaCapabilityReceiptKey(firstLookup.capability_hash));
  const retryCsrf = await getCsrf(handler, blockedBrowser);
  const afterExpiryPrune = response();
  await handler(request('POST', {
    ...blockedBrowser,
    body: { profile_id: PROFILE_IDS[0] },
    csrf: retryCsrf,
  }), afterExpiryPrune);
  assert.equal(afterExpiryPrune.statusCode, 200);
  assert.equal([...redis.values.keys()].filter((key) => (
    key.startsWith(`${FULL_PERSON_QA_CAPABILITY_RECEIPT_NAMESPACE}:`)
  )).length, FULL_PERSON_QA_MAX_ACTIVE_CAPABILITIES_PER_AUTHORITY);
});

test('DELETE removes the exact backing receipt when present and always expires QA and internal cookies', async () => {
  const redis = new FakeRedis();
  const handler = createSubscriptionV1QaEntryHandler({
    env: environment(),
    getRedis: () => redis,
    csrfTokenFactory: tokenSequence('S'),
    capabilityTokenFactory: tokenSequence('W'),
    clock: () => NOW,
  });
  const csrf = await getCsrf(handler);
  const entered = response();
  await handler(request('POST', { body: { profile_id: PROFILE_IDS[0] }, csrf }), entered);
  const qaCookie = entered.headers['set-cookie'].find((value) => (
    value.startsWith(`${FULL_PERSON_QA_CAPABILITY_COOKIE}=`)
  ));
  const receiptKey = [...redis.values.keys()].find((key) => (
    key.startsWith(`${FULL_PERSON_QA_CAPABILITY_RECEIPT_NAMESPACE}:`)
  ));
  assert.equal(redis.values.has(receiptKey), true);

  const cleared = response();
  await handler(request('DELETE', { cookie: cookiePair(qaCookie) }), cleared);
  assert.equal(cleared.statusCode, 200);
  assert.equal(redis.values.has(receiptKey), false);
  assert.equal(redis.operations.some((operation) => operation[0] === 'eval' && operation.includes(receiptKey)), true);
  assert.equal(cleared.headers['set-cookie'].length, 3);
  assert.equal(cleared.headers['set-cookie'].every((value) => /Max-Age=0/u.test(value)), true);
  assert.equal(cleared.headers['set-cookie'].some((value) => value.startsWith(`${FULL_PERSON_QA_CAPABILITY_COOKIE}=;`)), true);

  const storeUnavailable = createSubscriptionV1QaEntryHandler({
    env: environment(),
    capabilityLookup: () => ({ ok: true, capability_hash: 'a'.repeat(64) }),
    getRedis: () => { throw new Error('synthetic store unavailable'); },
  });
  const localClear = response();
  await storeUnavailable(request('DELETE', { cookie: cookiePair(qaCookie) }), localClear);
  assert.equal(localClear.statusCode, 503);
  assert.equal(localClear.payload.code, 'SUBSCRIPTION_V1_SYNTHETIC_QA_REVOCATION_UNAVAILABLE');
  assert.equal(localClear.headers['set-cookie'].every((value) => /Max-Age=0/u.test(value)), true);
});

test('capability receipt keys accept only exact SHA-256 custody', () => {
  const hash = 'A'.repeat(64);
  assert.equal(
    fullPersonQaCapabilityReceiptKey(hash),
    `${FULL_PERSON_QA_CAPABILITY_RECEIPT_NAMESPACE}:${hash.toLowerCase()}`,
  );
  for (const invalid of ['', 'a'.repeat(63), 'g'.repeat(64), `${'a'.repeat(64)}x`]) {
    assert.throws(
      () => fullPersonQaCapabilityReceiptKey(invalid),
      /SUBSCRIPTION_V1_SYNTHETIC_QA_CAPABILITY_HASH_INVALID/u,
    );
  }
});
