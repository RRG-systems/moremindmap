import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  FULL_PERSON_QA_CAPABILITY_COOKIE,
  FULL_PERSON_QA_CAPABILITY_TTL_SECONDS,
  FULL_PERSON_QA_HMAC_DOMAINS,
  FULL_PERSON_QA_MANIFEST_COUNT,
  FULL_PERSON_QA_MANIFEST_VERSION,
  FULL_PERSON_QA_SYNTHETIC_LABEL,
  clearFullPersonQaCapabilityCookie,
  fullPersonQaCapabilityCookiePresent,
  fullPersonQaCapabilityLookup,
  fullPersonQaProfileDigest,
  issueFullPersonQaCapability,
  parseFullPersonQaManifest,
  resolveFullPersonQaManifestEntry,
  verifyFullPersonQaCapability,
} from '../api/engine/subscriptionV1/fullPersonQaAccess.js';
import { canonicalJson } from '../src/lib/intelligenceFabric/hashing.js';

const NOW = new Date('2026-09-13T18:00:00.000Z');
const EXPIRES = '2026-09-30T00:00:00.000Z';
const DIGEST_KEY = 'full-person-qa-digest-key-for-focused-tests-0000000000000001';
const SIGNING_KEY = 'full-person-qa-signing-key-for-focused-tests-00000000000001';
const TOKEN = 'A'.repeat(43);
const PROFILE_IDS = Object.freeze([
  'mm-20260913-a1b2c3d4',
  'mm-20260913-b2c3d4e5',
  'mm-20260913-c3d4e5f6',
  'mm-20260913-d4e5f6g7',
]);

function manifestEntries() {
  return PROFILE_IDS.map((profileId, index) => ({
    authority_id: `synthetic_qa_authority_${index + 1}`,
    expires_at: EXPIRES,
    profile_digest: fullPersonQaProfileDigest(profileId, DIGEST_KEY),
    status: 'active',
  }));
}

function manifest(overrides = (entries) => entries) {
  return JSON.stringify(overrides(manifestEntries().map((entry) => ({ ...entry }))));
}

function request(cookie = '', {
  address = '203.0.113.17',
  userAgent = 'Full Person QA test browser',
} = {}) {
  return {
    method: 'POST',
    headers: {
      host: 'preview.moremindmap.test',
      origin: 'https://preview.moremindmap.test',
      'x-vercel-forwarded-for': address,
      'x-forwarded-for': address,
      'x-forwarded-proto': 'https',
      'user-agent': userAgent,
      cookie,
    },
    socket: {},
  };
}

function throwsCode(operation, code) {
  assert.throws(operation, (error) => error?.code === code);
}

function cookiePair(setCookie) {
  return setCookie.split(';')[0];
}

function hmac(domain, value, secret) {
  return crypto.createHmac('sha256', secret)
    .update(domain, 'utf8')
    .update('\0', 'utf8')
    .update(String(value), 'utf8')
    .digest('hex');
}

test('strict manifest accepts one order-independent set of exactly four digest-only authorities', () => {
  const raw = manifest();
  const parsed = parseFullPersonQaManifest(raw);
  const reordered = parseFullPersonQaManifest(manifest((entries) => entries.reverse()));

  assert.equal(parsed.entries.length, FULL_PERSON_QA_MANIFEST_COUNT);
  assert.equal(parsed.contract, FULL_PERSON_QA_MANIFEST_VERSION);
  assert.equal(parsed.manifest_version, FULL_PERSON_QA_MANIFEST_VERSION);
  assert.match(parsed.manifest_sha256, /^[a-f0-9]{64}$/u);
  assert.equal(reordered.manifest_sha256, parsed.manifest_sha256);
  assert.deepEqual(reordered.entries, parsed.entries);
  assert.equal(Object.isFrozen(parsed), true);
  assert.equal(Object.isFrozen(parsed.entries), true);
  assert.equal(Object.isFrozen(parsed.entries[0]), true);
  for (const profileId of PROFILE_IDS) assert.equal(raw.includes(profileId), false);
});

test('strict manifest fails closed on count, syntax, fields, digest, authority, status, and expiry defects', () => {
  throwsCode(
    () => parseFullPersonQaManifest(''),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_REQUIRED',
  );
  throwsCode(
    () => parseFullPersonQaManifest('{'),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_INVALID',
  );
  throwsCode(
    () => parseFullPersonQaManifest(JSON.stringify({ entries: manifestEntries() })),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_COUNT_INVALID',
  );
  for (const count of [3, 5]) {
    throwsCode(
      () => parseFullPersonQaManifest(JSON.stringify(manifestEntries().slice(0, count).concat(
        count === 5 ? [{ ...manifestEntries()[0], profile_digest: 'f'.repeat(64), authority_id: 'synthetic_qa_authority_5' }] : [],
      ))),
      'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_COUNT_INVALID',
    );
  }
  throwsCode(
    () => parseFullPersonQaManifest(manifest((entries) => {
      entries[0].profile_id = PROFILE_IDS[0];
      return entries;
    })),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_FIELDS_INVALID',
  );
  throwsCode(
    () => parseFullPersonQaManifest(manifest((entries) => {
      delete entries[0].expires_at;
      return entries;
    })),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_FIELDS_INVALID',
  );
  throwsCode(
    () => parseFullPersonQaManifest(manifest((entries) => {
      entries[0].profile_digest = '*';
      return entries;
    })),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_DIGEST_INVALID',
  );
  throwsCode(
    () => parseFullPersonQaManifest(manifest((entries) => {
      entries[0].authority_id = 'short';
      return entries;
    })),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_AUTHORITY_INVALID',
  );
  throwsCode(
    () => parseFullPersonQaManifest(manifest((entries) => {
      entries[0].status = 'ACTIVE';
      return entries;
    })),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_STATUS_INVALID',
  );
  throwsCode(
    () => parseFullPersonQaManifest(manifest((entries) => {
      entries[0].expires_at = '2026-09-30T00:00:00Z';
      return entries;
    })),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_EXPIRY_INVALID',
  );
});

test('strict manifest rejects duplicate profile digests and duplicate authority identifiers', () => {
  throwsCode(
    () => parseFullPersonQaManifest(manifest((entries) => {
      entries[1].profile_digest = entries[0].profile_digest;
      return entries;
    })),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_DUPLICATE',
  );
  throwsCode(
    () => parseFullPersonQaManifest(manifest((entries) => {
      entries[1].authority_id = entries[0].authority_id;
      return entries;
    })),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_DUPLICATE',
  );
});

test('profile digests are normalized, keyed, and explicitly HMAC-domain separated', () => {
  const profileId = PROFILE_IDS[0];
  const digest = fullPersonQaProfileDigest(profileId, DIGEST_KEY);
  const expected = hmac(
    FULL_PERSON_QA_HMAC_DOMAINS.profile_digest,
    profileId,
    DIGEST_KEY,
  );
  const wrongDomain = hmac(
    FULL_PERSON_QA_HMAC_DOMAINS.receipt_signature,
    profileId,
    DIGEST_KEY,
  );

  assert.equal(digest, expected);
  assert.equal(fullPersonQaProfileDigest(profileId.toUpperCase(), DIGEST_KEY), digest);
  assert.notEqual(fullPersonQaProfileDigest(PROFILE_IDS[1], DIGEST_KEY), digest);
  assert.notEqual(fullPersonQaProfileDigest(profileId, `${DIGEST_KEY}x`), digest);
  assert.notEqual(wrongDomain, digest);
  assert.notEqual(crypto.createHmac('sha256', DIGEST_KEY).update(profileId).digest('hex'), digest);
  throwsCode(
    () => fullPersonQaProfileDigest('mm-wildcard-*', DIGEST_KEY),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_PROFILE_ID_INVALID',
  );
  throwsCode(
    () => fullPersonQaProfileDigest(profileId, 'too-short'),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_DIGEST_KEY_REQUIRED',
  );
});

test('manifest lookup grants only an exact active, unexpired digest and supports exact-entry revocation', () => {
  const active = resolveFullPersonQaManifestEntry({
    profile_id: PROFILE_IDS[0],
    manifest: manifest(),
    digest_key: DIGEST_KEY,
    now: NOW,
  });
  assert.equal(active.profile_id, PROFILE_IDS[0]);
  assert.equal(active.authority_id, 'synthetic_qa_authority_1');

  throwsCode(
    () => resolveFullPersonQaManifestEntry({
      profile_id: 'mm-20260913-z9y8x7w6',
      manifest: manifest(),
      digest_key: DIGEST_KEY,
      now: NOW,
    }),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_PROFILE_NOT_ALLOWLISTED',
  );

  const oneRevoked = manifest((entries) => {
    entries[0].status = 'revoked';
    return entries;
  });
  throwsCode(
    () => resolveFullPersonQaManifestEntry({
      profile_id: PROFILE_IDS[0],
      manifest: oneRevoked,
      digest_key: DIGEST_KEY,
      now: NOW,
    }),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_PROFILE_REVOKED',
  );
  assert.equal(resolveFullPersonQaManifestEntry({
    profile_id: PROFILE_IDS[1],
    manifest: oneRevoked,
    digest_key: DIGEST_KEY,
    now: NOW,
  }).profile_id, PROFILE_IDS[1]);

  const oneExpired = manifest((entries) => {
    entries[0].expires_at = NOW.toISOString();
    return entries;
  });
  throwsCode(
    () => resolveFullPersonQaManifestEntry({
      profile_id: PROFILE_IDS[0],
      manifest: oneExpired,
      digest_key: DIGEST_KEY,
      now: NOW,
    }),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_PROFILE_EXPIRED',
  );
});

test('issued browser capability uses an opaque strict cookie and a domain-separated signed server receipt', () => {
  const issued = issueFullPersonQaCapability({
    profile_id: PROFILE_IDS[0],
    manifest: manifest(),
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    req: request(),
    now: NOW,
    token_factory: () => TOKEN,
  });
  const { signature, ...claims } = issued.receipt;
  const expectedSignature = hmac(
    FULL_PERSON_QA_HMAC_DOMAINS.receipt_signature,
    canonicalJson(claims),
    SIGNING_KEY,
  );
  const wrongDomainSignature = hmac(
    FULL_PERSON_QA_HMAC_DOMAINS.profile_digest,
    canonicalJson(claims),
    SIGNING_KEY,
  );

  assert.equal(signature, expectedSignature);
  assert.notEqual(signature, wrongDomainSignature);
  assert.equal(issued.capability_hash, hmac(
    FULL_PERSON_QA_HMAC_DOMAINS.capability_token,
    TOKEN,
    SIGNING_KEY,
  ));
  assert.equal(issued.max_age_seconds, FULL_PERSON_QA_CAPABILITY_TTL_SECONDS);
  assert.equal(
    issued.cookie,
    `${FULL_PERSON_QA_CAPABILITY_COOKIE}=${TOKEN}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${FULL_PERSON_QA_CAPABILITY_TTL_SECONDS}`,
  );
  assert.equal(issued.cookie.includes(PROFILE_IDS[0]), false);
  assert.equal(issued.cookie.includes(issued.receipt.profile_digest), false);
  assert.equal(issued.cookie.includes(issued.receipt.authority_id), false);
  assert.equal(Object.hasOwn(issued, 'token'), false);
  assert.equal(Object.hasOwn(issued.receipt, 'token'), false);
  assert.equal(issued.receipt.access_label, FULL_PERSON_QA_SYNTHETIC_LABEL);
  assert.equal(issued.receipt.synthetic_only, true);
  assert.equal(issued.receipt.billing_evidence, false);
  assert.equal(issued.receipt.stripe_subscription_created, false);
  assert.equal(Object.isFrozen(issued.receipt), true);
  assert.equal(
    clearFullPersonQaCapabilityCookie(),
    `${FULL_PERSON_QA_CAPABILITY_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  );
  assert.equal(fullPersonQaCapabilityCookiePresent(request(cookiePair(issued.cookie))), true);
  assert.equal(fullPersonQaCapabilityCookiePresent(request()), false);
  const oversizedSelected = request(`${'padding=x;'.repeat(2200)} ${cookiePair(issued.cookie)}`);
  assert.equal(fullPersonQaCapabilityCookiePresent(oversizedSelected), true);
  assert.equal(fullPersonQaCapabilityLookup({ req: oversizedSelected, signing_key: SIGNING_KEY }).ok, false);
  assert.equal(fullPersonQaCapabilityCookiePresent(request(`  ${cookiePair(issued.cookie)}`)), true);
});

test('capability verification requires the exact token, signed receipt, browser, time, and current manifest', () => {
  const originalRequest = request();
  const rawManifest = manifest();
  const issued = issueFullPersonQaCapability({
    profile_id: PROFILE_IDS[0],
    manifest: rawManifest,
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    req: originalRequest,
    now: NOW,
    token_factory: () => TOKEN,
  });
  const authenticatedRequest = request(cookiePair(issued.cookie));
  const verified = verifyFullPersonQaCapability({
    req: authenticatedRequest,
    receipt: JSON.stringify(issued.receipt),
    manifest: rawManifest,
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    now: new Date(NOW.getTime() + 60_000),
  });
  assert.equal(verified.ok, true);
  assert.equal(verified.capability.profile_id, PROFILE_IDS[0]);
  assert.equal(verified.capability.allowed_product, 'subscription');
  assert.equal(verified.capability.access_class, 'SYNTHETIC_QA');
  assert.equal(verified.capability.authority_expires_at, EXPIRES);
  assert.equal(verified.capability.synthetic_only, true);
  assert.equal(verified.capability.billing_evidence, false);
  assert.equal(verified.capability.stripe_subscription_created, false);

  const lookup = fullPersonQaCapabilityLookup({
    req: authenticatedRequest,
    signing_key: SIGNING_KEY,
  });
  assert.deepEqual(lookup, { ok: true, capability_hash: issued.capability_hash });
  assert.equal(Object.hasOwn(lookup, 'token'), false);

  const missing = verifyFullPersonQaCapability({
    req: request(),
    receipt: issued.receipt,
    manifest: rawManifest,
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    now: NOW,
  });
  assert.equal(missing.code, 'SUBSCRIPTION_V1_FULL_PERSON_QA_CAPABILITY_REQUIRED');

  const wrongToken = verifyFullPersonQaCapability({
    req: request(`${FULL_PERSON_QA_CAPABILITY_COOKIE}=${'B'.repeat(43)}`),
    receipt: issued.receipt,
    manifest: rawManifest,
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    now: NOW,
  });
  assert.equal(wrongToken.failure_class, 'CAPABILITY_TOKEN_MISMATCH');

  const duplicateCookie = fullPersonQaCapabilityLookup({
    req: request(`${cookiePair(issued.cookie)}; ${cookiePair(issued.cookie)}`),
    signing_key: SIGNING_KEY,
  });
  assert.equal(duplicateCookie.code, 'SUBSCRIPTION_V1_FULL_PERSON_QA_CAPABILITY_REQUIRED');

  const changedBrowser = verifyFullPersonQaCapability({
    req: request(cookiePair(issued.cookie), { address: '203.0.113.99' }),
    receipt: issued.receipt,
    manifest: rawManifest,
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    now: NOW,
  });
  assert.equal(changedBrowser.failure_class, 'CAPABILITY_BROWSER_BINDING_MISMATCH');

  const wrongSigningKeyBrowserBinding = issueFullPersonQaCapability({
    profile_id: PROFILE_IDS[0],
    manifest: rawManifest,
    digest_key: DIGEST_KEY,
    signing_key: `${SIGNING_KEY}x`,
    req: originalRequest,
    now: NOW,
    token_factory: () => TOKEN,
  });
  assert.notEqual(
    wrongSigningKeyBrowserBinding.receipt.browser_binding_hash,
    issued.receipt.browser_binding_hash,
  );

  const spoofedLegacyForward = request(cookiePair(issued.cookie));
  spoofedLegacyForward.headers['x-forwarded-for'] = '198.51.100.220';
  const legacyHeaderIgnored = verifyFullPersonQaCapability({
    req: spoofedLegacyForward,
    receipt: issued.receipt,
    manifest: rawManifest,
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    now: NOW,
  });
  assert.equal(legacyHeaderIgnored.ok, true);

  const badSignature = verifyFullPersonQaCapability({
    req: authenticatedRequest,
    receipt: { ...issued.receipt, signature: 'f'.repeat(64) },
    manifest: rawManifest,
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    now: NOW,
  });
  assert.equal(badSignature.failure_class, 'RECEIPT_SIGNATURE_MISMATCH');

  const extraReceiptField = verifyFullPersonQaCapability({
    req: authenticatedRequest,
    receipt: { ...issued.receipt, debug: true },
    manifest: rawManifest,
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    now: NOW,
  });
  assert.equal(extraReceiptField.failure_class, 'RECEIPT_MALFORMED');

  const expired = verifyFullPersonQaCapability({
    req: authenticatedRequest,
    receipt: issued.receipt,
    manifest: rawManifest,
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    now: new Date(NOW.getTime() + FULL_PERSON_QA_CAPABILITY_TTL_SECONDS * 1000),
  });
  assert.equal(expired.failure_class, 'CAPABILITY_EXPIRED');

  const revokedManifest = manifest((entries) => {
    entries[0].status = 'revoked';
    return entries;
  });
  const revoked = verifyFullPersonQaCapability({
    req: authenticatedRequest,
    receipt: issued.receipt,
    manifest: revokedManifest,
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    now: NOW,
  });
  assert.equal(revoked.failure_class, 'MANIFEST_AUTHORITY_REVOKED');

  const reordered = verifyFullPersonQaCapability({
    req: authenticatedRequest,
    receipt: issued.receipt,
    manifest: manifest((entries) => entries.reverse()),
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    now: NOW,
  });
  assert.equal(reordered.ok, true);

  const otherEntryRevoked = verifyFullPersonQaCapability({
    req: authenticatedRequest,
    receipt: issued.receipt,
    manifest: manifest((entries) => {
      entries[1].status = 'revoked';
      return entries;
    }),
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    now: NOW,
  });
  assert.equal(otherEntryRevoked.ok, true);

  for (const changedExpiry of ['2026-09-29T00:00:00.000Z', '2026-10-30T00:00:00.000Z']) {
    const selectedEntryChanged = verifyFullPersonQaCapability({
      req: authenticatedRequest,
      receipt: issued.receipt,
      manifest: manifest((entries) => {
        entries[0].expires_at = changedExpiry;
        return entries;
      }),
      digest_key: DIGEST_KEY,
      signing_key: SIGNING_KEY,
      now: NOW,
    });
    assert.equal(selectedEntryChanged.failure_class, 'MANIFEST_AUTHORITY_MISMATCH');
  }
});
