import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import net from 'node:net';
import { canonicalJson, hashCanonicalJson } from '../../../src/lib/intelligenceFabric/hashing.js';
import { deepFreeze, isPlainObject } from '../../../src/lib/intelligenceFabric/validation.js';
import { normalizeProfileId } from '../../../src/lib/publicSiteAirlockV1/contracts.js';

export const FULL_PERSON_QA_MANIFEST_COUNT = 4;
export const FULL_PERSON_QA_MANIFEST_VERSION = 'subscription_v1_full_person_qa_manifest_v1';
export const FULL_PERSON_QA_CAPABILITY_CONTRACT = 'subscription_v1_full_person_qa_capability_v1';
export const FULL_PERSON_QA_CAPABILITY_COOKIE = '__Host-more_subscription_full_person_qa';
export const FULL_PERSON_QA_CAPABILITY_TTL_SECONDS = 8 * 60 * 60;
export const FULL_PERSON_QA_SYNTHETIC_LABEL = 'Synthetic QA (no paid subscription)';

export const FULL_PERSON_QA_HMAC_DOMAINS = deepFreeze({
  profile_digest: 'more-subscription-full-person-qa-profile-digest-v1',
  capability_token: 'more-subscription-full-person-qa-capability-token-v1',
  browser_binding: 'more-subscription-full-person-qa-browser-binding-v1',
  receipt_signature: 'more-subscription-full-person-qa-receipt-signature-v1',
});

const HASH_256 = /^[a-f0-9]{64}$/u;
const AUTHORITY_ID = /^[a-z0-9][a-z0-9:_-]{7,159}$/u;
const OPAQUE_TOKEN = /^[A-Za-z0-9_-]{43}$/u;
const MANIFEST_ENTRY_KEYS = Object.freeze([
  'authority_id',
  'expires_at',
  'profile_digest',
  'status',
]);
const RECEIPT_KEYS = Object.freeze([
  'access_class',
  'access_label',
  'allowed_product',
  'authority_expires_at',
  'authority_id',
  'billing_evidence',
  'browser_binding_hash',
  'capability_hash',
  'contract',
  'expires_at',
  'issued_at',
  'manifest_sha256',
  'manifest_version',
  'profile_digest',
  'profile_id',
  'signature',
  'stripe_subscription_created',
  'synthetic_only',
]);
const ALLOWED_MANIFEST_STATUSES = Object.freeze(['active', 'revoked']);
const MAX_CONFIG_BYTES = 32 * 1024;
const MAX_RECEIPT_BYTES = 16 * 1024;

function deny(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function exactKeys(value, expected) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function requireSecret(value, code) {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') < 32
    || Buffer.byteLength(value, 'utf8') > 4096) {
    deny(code);
  }
  return value;
}

function exactProfileId(value) {
  const profileId = normalizeProfileId(value);
  if (!profileId) deny('SUBSCRIPTION_V1_FULL_PERSON_QA_PROFILE_ID_INVALID');
  return profileId;
}

function exactNow(value) {
  const now = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(now.getTime())) deny('SUBSCRIPTION_V1_FULL_PERSON_QA_TIME_INVALID');
  return now;
}

function canonicalTimestamp(value, code) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) deny(code);
  const normalized = new Date(value).toISOString();
  if (normalized !== value) deny(code);
  return normalized;
}

function domainHmac(domain, value, secret) {
  return crypto.createHmac('sha256', secret)
    .update(domain, 'utf8')
    .update('\0', 'utf8')
    .update(String(value), 'utf8')
    .digest('hex');
}

function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  return leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function fullPersonQaClientNetworkMaterial(req = {}) {
  const forwarded = String(req.headers?.['x-vercel-forwarded-for'] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const socketAddress = String(req.socket?.remoteAddress || '').trim();
  let address = forwarded.length === 1 ? forwarded[0] : socketAddress;
  if (address.startsWith('::ffff:')) address = address.slice(7);
  return net.isIP(address) ? address.toLowerCase() : 'unavailable';
}

function requestBrowserMaterial(req = {}) {
  const address = fullPersonQaClientNetworkMaterial(req);
  const userAgent = String(req.headers?.['user-agent'] || '').slice(0, 240);
  return canonicalJson({ address, user_agent: userAgent });
}

function browserBindingHash(req, signingKey) {
  return domainHmac(
    FULL_PERSON_QA_HMAC_DOMAINS.browser_binding,
    requestBrowserMaterial(req),
    signingKey,
  );
}

function capabilityTokenHash(token, signingKey) {
  return domainHmac(FULL_PERSON_QA_HMAC_DOMAINS.capability_token, token, signingKey);
}

function signedReceipt(claims, signingKey) {
  return domainHmac(
    FULL_PERSON_QA_HMAC_DOMAINS.receipt_signature,
    canonicalJson(claims),
    signingKey,
  );
}

function readCookieValue(header, name) {
  const rawHeader = String(header || '');
  if (!rawHeader || Buffer.byteLength(rawHeader, 'utf8') > 16 * 1024) return '';
  const matches = [];
  for (const part of rawHeader.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf('=');
    const key = separator < 0 ? trimmed : trimmed.slice(0, separator);
    if (key !== name) continue;
    try {
      matches.push(decodeURIComponent(separator < 0 ? '' : trimmed.slice(separator + 1)));
    } catch {
      return '';
    }
  }
  return matches.length === 1 ? matches[0] : '';
}

export function fullPersonQaCapabilityCookiePresent(req = {}) {
  const rawHeader = String(req.headers?.cookie || '');
  if (!rawHeader) return false;
  return rawHeader.split(';').some((part) => {
    const trimmed = part.trim();
    if (!trimmed) return false;
    const separator = trimmed.indexOf('=');
    const key = separator < 0 ? trimmed : trimmed.slice(0, separator);
    return key === FULL_PERSON_QA_CAPABILITY_COOKIE;
  });
}

function capabilityCookie(token, maxAgeSeconds) {
  return `${FULL_PERSON_QA_CAPABILITY_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSeconds}`;
}

function invalidCapability(failureClass) {
  return deepFreeze({
    ok: false,
    code: 'SUBSCRIPTION_V1_FULL_PERSON_QA_CAPABILITY_INVALID',
    failure_class: failureClass,
    status: 401,
  });
}

function normalizeReceipt(value) {
  let receipt = value;
  if (typeof value === 'string') {
    if (!value || Buffer.byteLength(value, 'utf8') > MAX_RECEIPT_BYTES) return null;
    try {
      receipt = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!exactKeys(receipt, RECEIPT_KEYS)) return null;
  if (receipt.contract !== FULL_PERSON_QA_CAPABILITY_CONTRACT
    || receipt.manifest_version !== FULL_PERSON_QA_MANIFEST_VERSION
    || receipt.allowed_product !== 'subscription'
    || receipt.access_class !== 'SYNTHETIC_QA'
    || receipt.access_label !== FULL_PERSON_QA_SYNTHETIC_LABEL
    || receipt.synthetic_only !== true
    || receipt.billing_evidence !== false
    || receipt.stripe_subscription_created !== false
    || !normalizeProfileId(receipt.profile_id)
    || normalizeProfileId(receipt.profile_id) !== receipt.profile_id
    || !AUTHORITY_ID.test(receipt.authority_id)
    || !HASH_256.test(receipt.profile_digest)
    || !HASH_256.test(receipt.capability_hash)
    || !HASH_256.test(receipt.browser_binding_hash)
    || !HASH_256.test(receipt.manifest_sha256)
    || !HASH_256.test(receipt.signature)) {
    return null;
  }
  try {
    canonicalTimestamp(receipt.issued_at, 'SUBSCRIPTION_V1_FULL_PERSON_QA_RECEIPT_INVALID');
    canonicalTimestamp(receipt.expires_at, 'SUBSCRIPTION_V1_FULL_PERSON_QA_RECEIPT_INVALID');
    canonicalTimestamp(receipt.authority_expires_at, 'SUBSCRIPTION_V1_FULL_PERSON_QA_RECEIPT_INVALID');
  } catch {
    return null;
  }
  const issuedAt = Date.parse(receipt.issued_at);
  const expiresAt = Date.parse(receipt.expires_at);
  if (expiresAt <= issuedAt
    || expiresAt - issuedAt > FULL_PERSON_QA_CAPABILITY_TTL_SECONDS * 1000
    || expiresAt > Date.parse(receipt.authority_expires_at)) {
    return null;
  }
  return receipt;
}

export function fullPersonQaProfileDigest(profileId, digestKey) {
  const normalized = exactProfileId(profileId);
  const secret = requireSecret(
    digestKey,
    'SUBSCRIPTION_V1_FULL_PERSON_QA_DIGEST_KEY_REQUIRED',
  );
  return domainHmac(FULL_PERSON_QA_HMAC_DOMAINS.profile_digest, normalized, secret);
}

export function parseFullPersonQaManifest(raw) {
  if (typeof raw !== 'string' || !raw
    || Buffer.byteLength(raw, 'utf8') > MAX_CONFIG_BYTES) {
    deny('SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_REQUIRED');
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    deny('SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_INVALID');
  }
  if (!Array.isArray(parsed) || parsed.length !== FULL_PERSON_QA_MANIFEST_COUNT) {
    deny('SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_COUNT_INVALID');
  }
  const entries = parsed.map((entry) => {
    if (!exactKeys(entry, MANIFEST_ENTRY_KEYS)) {
      deny('SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_FIELDS_INVALID');
    }
    if (!HASH_256.test(entry.profile_digest)) {
      deny('SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_DIGEST_INVALID');
    }
    if (!AUTHORITY_ID.test(entry.authority_id)) {
      deny('SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_AUTHORITY_INVALID');
    }
    if (!ALLOWED_MANIFEST_STATUSES.includes(entry.status)) {
      deny('SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_STATUS_INVALID');
    }
    return {
      authority_id: entry.authority_id,
      expires_at: canonicalTimestamp(
        entry.expires_at,
        'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_EXPIRY_INVALID',
      ),
      profile_digest: entry.profile_digest,
      status: entry.status,
    };
  }).sort((left, right) => left.profile_digest.localeCompare(right.profile_digest));
  if (new Set(entries.map((entry) => entry.profile_digest)).size !== entries.length
    || new Set(entries.map((entry) => entry.authority_id)).size !== entries.length) {
    deny('SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_DUPLICATE');
  }
  const manifest = {
    contract: FULL_PERSON_QA_MANIFEST_VERSION,
    manifest_version: FULL_PERSON_QA_MANIFEST_VERSION,
    entries,
  };
  return deepFreeze({
    ...manifest,
    manifest_sha256: hashCanonicalJson(manifest),
  });
}

export function resolveFullPersonQaManifestEntry({
  profile_id,
  manifest,
  digest_key,
  now = new Date(),
} = {}) {
  const currentTime = exactNow(now);
  const profileId = exactProfileId(profile_id);
  const parsedManifest = parseFullPersonQaManifest(manifest);
  const profileDigest = fullPersonQaProfileDigest(profileId, digest_key);
  let matched = null;
  for (const entry of parsedManifest.entries) {
    if (constantTimeEqual(entry.profile_digest, profileDigest)) matched = entry;
  }
  if (!matched) deny('SUBSCRIPTION_V1_FULL_PERSON_QA_PROFILE_NOT_ALLOWLISTED');
  if (matched.status !== 'active') {
    deny('SUBSCRIPTION_V1_FULL_PERSON_QA_PROFILE_REVOKED');
  }
  if (Date.parse(matched.expires_at) <= currentTime.getTime()) {
    deny('SUBSCRIPTION_V1_FULL_PERSON_QA_PROFILE_EXPIRED');
  }
  return deepFreeze({
    profile_id: profileId,
    profile_digest: profileDigest,
    authority_id: matched.authority_id,
    expires_at: matched.expires_at,
    manifest_version: parsedManifest.manifest_version,
    manifest_sha256: parsedManifest.manifest_sha256,
  });
}

export function fullPersonQaCapabilityLookup({ req, signing_key } = {}) {
  const signingKey = requireSecret(
    signing_key,
    'SUBSCRIPTION_V1_FULL_PERSON_QA_SIGNING_KEY_REQUIRED',
  );
  const token = readCookieValue(req?.headers?.cookie, FULL_PERSON_QA_CAPABILITY_COOKIE);
  if (!OPAQUE_TOKEN.test(token)) {
    return deepFreeze({
      ok: false,
      code: 'SUBSCRIPTION_V1_FULL_PERSON_QA_CAPABILITY_REQUIRED',
      status: 401,
    });
  }
  return deepFreeze({
    ok: true,
    capability_hash: capabilityTokenHash(token, signingKey),
  });
}

export function issueFullPersonQaCapability({
  profile_id,
  manifest,
  digest_key,
  signing_key,
  req,
  now = new Date(),
  token_factory = () => crypto.randomBytes(32).toString('base64url'),
} = {}) {
  const currentTime = exactNow(now);
  const signingKey = requireSecret(
    signing_key,
    'SUBSCRIPTION_V1_FULL_PERSON_QA_SIGNING_KEY_REQUIRED',
  );
  if (typeof token_factory !== 'function') {
    deny('SUBSCRIPTION_V1_FULL_PERSON_QA_TOKEN_FACTORY_INVALID');
  }
  const authority = resolveFullPersonQaManifestEntry({
    profile_id,
    manifest,
    digest_key,
    now: currentTime,
  });
  const token = token_factory();
  if (typeof token !== 'string' || !OPAQUE_TOKEN.test(token)) {
    deny('SUBSCRIPTION_V1_FULL_PERSON_QA_TOKEN_INVALID');
  }
  const manifestExpiry = Date.parse(authority.expires_at);
  const expiresAtMs = Math.min(
    currentTime.getTime() + FULL_PERSON_QA_CAPABILITY_TTL_SECONDS * 1000,
    manifestExpiry,
  );
  const maxAgeSeconds = Math.floor((expiresAtMs - currentTime.getTime()) / 1000);
  if (maxAgeSeconds < 1) deny('SUBSCRIPTION_V1_FULL_PERSON_QA_PROFILE_EXPIRED');
  const claims = {
    access_class: 'SYNTHETIC_QA',
    access_label: FULL_PERSON_QA_SYNTHETIC_LABEL,
    allowed_product: 'subscription',
    authority_id: authority.authority_id,
    authority_expires_at: authority.expires_at,
    billing_evidence: false,
    browser_binding_hash: browserBindingHash(req, signingKey),
    capability_hash: capabilityTokenHash(token, signingKey),
    contract: FULL_PERSON_QA_CAPABILITY_CONTRACT,
    expires_at: new Date(expiresAtMs).toISOString(),
    issued_at: currentTime.toISOString(),
    manifest_sha256: authority.manifest_sha256,
    manifest_version: authority.manifest_version,
    profile_digest: authority.profile_digest,
    profile_id: authority.profile_id,
    stripe_subscription_created: false,
    synthetic_only: true,
  };
  const receipt = deepFreeze({
    ...claims,
    signature: signedReceipt(claims, signingKey),
  });
  return deepFreeze({
    capability_hash: claims.capability_hash,
    cookie: capabilityCookie(token, maxAgeSeconds),
    expires_at: claims.expires_at,
    max_age_seconds: maxAgeSeconds,
    receipt,
  });
}

export function verifyFullPersonQaCapability({
  req,
  receipt: suppliedReceipt,
  manifest,
  digest_key,
  signing_key,
  now = new Date(),
} = {}) {
  const currentTime = exactNow(now);
  const signingKey = requireSecret(
    signing_key,
    'SUBSCRIPTION_V1_FULL_PERSON_QA_SIGNING_KEY_REQUIRED',
  );
  requireSecret(digest_key, 'SUBSCRIPTION_V1_FULL_PERSON_QA_DIGEST_KEY_REQUIRED');
  const lookup = fullPersonQaCapabilityLookup({ req, signing_key: signingKey });
  if (!lookup.ok) return lookup;
  const receipt = normalizeReceipt(suppliedReceipt);
  if (!receipt) return invalidCapability('RECEIPT_MALFORMED');
  const { signature, ...claims } = receipt;
  const expectedSignature = signedReceipt(claims, signingKey);
  if (!constantTimeEqual(signature, expectedSignature)) {
    return invalidCapability('RECEIPT_SIGNATURE_MISMATCH');
  }
  if (!constantTimeEqual(receipt.capability_hash, lookup.capability_hash)) {
    return invalidCapability('CAPABILITY_TOKEN_MISMATCH');
  }
  if (!constantTimeEqual(
    receipt.browser_binding_hash,
    browserBindingHash(req, signingKey),
  )) {
    return invalidCapability('CAPABILITY_BROWSER_BINDING_MISMATCH');
  }
  if (Date.parse(receipt.issued_at) > currentTime.getTime()
    || Date.parse(receipt.expires_at) <= currentTime.getTime()) {
    return invalidCapability('CAPABILITY_EXPIRED');
  }
  let authority;
  try {
    authority = resolveFullPersonQaManifestEntry({
      profile_id: receipt.profile_id,
      manifest,
      digest_key,
      now: currentTime,
    });
  } catch {
    return invalidCapability('MANIFEST_AUTHORITY_REVOKED');
  }
  if (!constantTimeEqual(authority.profile_digest, receipt.profile_digest)
    || authority.manifest_version !== receipt.manifest_version
    || authority.authority_id !== receipt.authority_id
    || authority.expires_at !== receipt.authority_expires_at
    || Date.parse(receipt.expires_at) > Date.parse(authority.expires_at)) {
    return invalidCapability('MANIFEST_AUTHORITY_MISMATCH');
  }
  return deepFreeze({
    ok: true,
    status: 200,
    capability_hash: receipt.capability_hash,
    capability: {
      contract: receipt.contract,
      profile_id: receipt.profile_id,
      profile_digest: receipt.profile_digest,
      authority_id: receipt.authority_id,
      allowed_product: receipt.allowed_product,
      access_class: receipt.access_class,
      access_label: receipt.access_label,
      manifest_version: receipt.manifest_version,
      manifest_sha256: authority.manifest_sha256,
      authority_expires_at: authority.expires_at,
      synthetic_only: true,
      billing_evidence: false,
      stripe_subscription_created: false,
      issued_at: receipt.issued_at,
      expires_at: receipt.expires_at,
    },
  });
}

export function clearFullPersonQaCapabilityCookie() {
  return `${FULL_PERSON_QA_CAPABILITY_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
