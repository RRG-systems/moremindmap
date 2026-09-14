import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import net from 'node:net';
import { canonicalJson, hashCanonicalJson } from '../../../src/lib/intelligenceFabric/hashing.js';
import { deepFreeze, isPlainObject } from '../../../src/lib/intelligenceFabric/validation.js';
import { normalizeProfileId } from '../../../src/lib/publicSiteAirlockV1/contracts.js';

// Maximum reviewed cohort size. An omitted case has no access authority.
export const FULL_PERSON_QA_MANIFEST_COUNT = 4;
export const FULL_PERSON_QA_MANIFEST_VERSION = 'subscription_v1_full_person_qa_manifest_v3';
export const FULL_PERSON_QA_CAPABILITY_CONTRACT = 'subscription_v1_full_person_qa_capability_v3';
export const FULL_PERSON_QA_CUSTODY_VERSION = 'subscription_v1_full_person_qa_custody_v3';
export const FULL_PERSON_QA_VERTICAL_AUTHORITY_VERSION = 'subscription_v1_full_person_qa_vertical_authority_v1';
export const FULL_PERSON_QA_SYNTHETIC_PROVENANCE_CONTRACT = 'subscription_v1_full_person_qa_synthetic_provenance_v1';
export const FULL_PERSON_QA_SYNTHETIC_PROVENANCE_AUTHOR = 'SERVER_AUTHORED_RELEASE_4_SYNTHETIC_PIPELINE';
export const FULL_PERSON_QA_SYNTHETIC_DATA_CLASSIFICATION = 'FICTIONAL_SYNTHETIC_QA_ONLY';
export const FULL_PERSON_QA_CAPABILITY_COOKIE = '__Host-more_subscription_full_person_qa';
export const FULL_PERSON_QA_CAPABILITY_TTL_SECONDS = 8 * 60 * 60;
export const FULL_PERSON_QA_SYNTHETIC_LABEL = 'Synthetic QA (no paid subscription)';

export const FULL_PERSON_QA_CASE_VERTICALS = deepFreeze({
  'COHORT-V1-LO-A': 'loan_originator',
  'COHORT-V1-LO-B': 'loan_originator',
  'COHORT-V1-RE-A': 'real_estate',
  'COHORT-V1-RE-B': 'real_estate',
});

export const FULL_PERSON_QA_HMAC_DOMAINS = deepFreeze({
  profile_digest: 'more-subscription-full-person-qa-profile-id-digest-v2',
  assessment_digest: 'more-subscription-full-person-qa-assessment-id-digest-v2',
  ba_realization_id_digest: 'more-subscription-full-person-qa-ba-realization-id-digest-v2',
  bos_realization_id_digest: 'more-subscription-full-person-qa-bos-realization-id-digest-v2',
  capability_token: 'more-subscription-full-person-qa-capability-token-v2',
  browser_binding: 'more-subscription-full-person-qa-browser-binding-v2',
  receipt_signature: 'more-subscription-full-person-qa-receipt-signature-v2',
});

const HASH_256 = /^[a-f0-9]{64}$/u;
const AUTHORITY_ID = /^[a-z0-9][a-z0-9:_-]{7,159}$/u;
const ASSESSMENT_ID = /^ba-\d{8}-[a-f0-9]{8}$/u;
const OPAQUE_TOKEN = /^[A-Za-z0-9_-]{43}$/u;
const MANIFEST_ENTRY_KEYS = Object.freeze([
  'assessment_digest',
  'assessment_evidence_sha256',
  'authority_id',
  'ba_artifact_sha256',
  'ba_envelope_sha256',
  'ba_realization_id_digest',
  'ba_realization_identity_sha256',
  'bos_artifact_sha256',
  'bos_canonical_source_sha256',
  'bos_envelope_sha256',
  'bos_realization_id_digest',
  'bos_realization_identity_sha256',
  'canonical_profile_artifact_sha256',
  'case_id',
  'custody_sha256',
  'expires_at',
  'profile_digest',
  'status',
  'synthetic_provenance_sha256',
  'vertical_authority_sha256',
  'vertical_binding_sha256',
  'vertical_id',
]);
const CUSTODY_HASH_FIELDS = Object.freeze([
  'assessment_digest',
  'assessment_evidence_sha256',
  'ba_artifact_sha256',
  'ba_envelope_sha256',
  'ba_realization_id_digest',
  'ba_realization_identity_sha256',
  'bos_artifact_sha256',
  'bos_canonical_source_sha256',
  'bos_envelope_sha256',
  'bos_realization_id_digest',
  'bos_realization_identity_sha256',
  'canonical_profile_artifact_sha256',
  'profile_digest',
  'synthetic_provenance_sha256',
  'vertical_authority_sha256',
  'vertical_binding_sha256',
]);
const UNIQUE_MANIFEST_FIELDS = Object.freeze([
  'authority_id',
  'case_id',
  ...CUSTODY_HASH_FIELDS.filter((field) => ![
    'vertical_authority_sha256',
    'vertical_binding_sha256',
  ].includes(field)),
  'custody_sha256',
]);
const RECEIPT_KEYS = Object.freeze([
  'access_class',
  'access_label',
  'allowed_product',
  'assessment_digest',
  'assessment_evidence_sha256',
  'authority_expires_at',
  'authority_id',
  'ba_artifact_sha256',
  'ba_envelope_sha256',
  'ba_realization_id_digest',
  'ba_realization_identity_sha256',
  'billing_evidence',
  'bos_artifact_sha256',
  'bos_canonical_source_sha256',
  'bos_envelope_sha256',
  'bos_realization_id_digest',
  'bos_realization_identity_sha256',
  'browser_binding_hash',
  'canonical_profile_artifact_sha256',
  'capability_hash',
  'case_id',
  'contract',
  'custody_sha256',
  'expires_at',
  'issued_at',
  'manifest_sha256',
  'manifest_version',
  'profile_digest',
  'profile_id',
  'signature',
  'stripe_subscription_created',
  'synthetic_only',
  'synthetic_provenance_sha256',
  'vertical_authority_sha256',
  'vertical_binding_sha256',
  'vertical_id',
]);
const ALLOWED_MANIFEST_STATUSES = Object.freeze(['active', 'revoked']);
const MAX_CONFIG_BYTES = 32 * 1024;
const MAX_RECEIPT_BYTES = 16 * 1024;
const VERTICAL_AUTHORITY_FIELDS = Object.freeze([
  'binding_version',
  'box_1_projection_adapter_id',
  'box_1_projection_contract_id',
  'box_1_projection_contract_sha256',
  'box_1_projection_contract_version',
  'cassette_id',
  'cassette_manifest_sha256',
  'cassette_registry_sha256',
  'cassette_version',
  'evidence_contract_id',
  'evidence_contract_sha256',
  'evidence_contract_version',
  'intake_contract_id',
  'intake_contract_sha256',
  'intake_contract_version',
  'selection_contract_version',
  'vertical_id',
  'vertical_label',
]);
const PLACEHOLDER_TEXT = /(?:^|[_:-])(?:changeme|placeholder|redacted|replace(?:me)?|tbd|todo|unknown|unset)(?:$|[_:-])/iu;
const PLACEHOLDER_HASH = /^([a-f0-9])\1{63}$/u;
const RAW_ID_TEXT = /(?:mm-\d{8}-[a-z0-9]{8}|ba-\d{8}-[a-f0-9]{8}|new-(?:ba|bos):)/iu;
const SYNTHETIC_PROVENANCE_KEYS = Object.freeze([
  'authority_id',
  'authorship',
  'billing_evidence',
  'case_id',
  'contract',
  'data_classification',
  'real_customer_state',
  'synthetic_only',
]);

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
    || Buffer.byteLength(value, 'utf8') > 4096
    || value !== value.trim()
    || isPlaceholder(value)
    || /^(.)\1+$/u.test(value)) {
    deny(code);
  }
  return value;
}

function isPlaceholder(value) {
  return typeof value !== 'string'
    || value.length === 0
    || value !== value.trim()
    || PLACEHOLDER_TEXT.test(value)
    || PLACEHOLDER_HASH.test(value);
}

function isCustodyHash(value) {
  return typeof value === 'string' && HASH_256.test(value) && !isPlaceholder(value);
}

function exactAuthorityId(value) {
  if (!AUTHORITY_ID.test(value) || isPlaceholder(value) || RAW_ID_TEXT.test(value)) {
    deny('SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_AUTHORITY_INVALID');
  }
  return value;
}

function exactProfileId(value) {
  const profileId = normalizeProfileId(value);
  if (!profileId) deny('SUBSCRIPTION_V1_FULL_PERSON_QA_PROFILE_ID_INVALID');
  return profileId;
}

function exactAssessmentId(value) {
  const assessmentId = typeof value === 'string' ? value.toLowerCase() : '';
  if (!ASSESSMENT_ID.test(assessmentId)) {
    deny('SUBSCRIPTION_V1_FULL_PERSON_QA_ASSESSMENT_ID_INVALID');
  }
  return assessmentId;
}

function exactRealizationId(value, code) {
  const hasControlCharacter = typeof value === 'string'
    && Array.from(value).some((character) => {
      const point = character.codePointAt(0);
      return point <= 0x1f || point === 0x7f;
    });
  if (typeof value !== 'string'
    || value !== value.trim()
    || Buffer.byteLength(value, 'utf8') < 8
    || Buffer.byteLength(value, 'utf8') > 512
    || hasControlCharacter
    || isPlaceholder(value)) {
    deny(code);
  }
  return value;
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

function custodyPayload(entry = {}) {
  return {
    assessment_digest: entry.assessment_digest,
    assessment_evidence_sha256: entry.assessment_evidence_sha256,
    authority_id: entry.authority_id,
    ba_artifact_sha256: entry.ba_artifact_sha256,
    ba_envelope_sha256: entry.ba_envelope_sha256,
    ba_realization_id_digest: entry.ba_realization_id_digest,
    ba_realization_identity_sha256: entry.ba_realization_identity_sha256,
    bos_artifact_sha256: entry.bos_artifact_sha256,
    bos_canonical_source_sha256: entry.bos_canonical_source_sha256,
    bos_envelope_sha256: entry.bos_envelope_sha256,
    bos_realization_id_digest: entry.bos_realization_id_digest,
    bos_realization_identity_sha256: entry.bos_realization_identity_sha256,
    canonical_profile_artifact_sha256: entry.canonical_profile_artifact_sha256,
    case_id: entry.case_id,
    custody_version: FULL_PERSON_QA_CUSTODY_VERSION,
    expires_at: entry.expires_at,
    profile_digest: entry.profile_digest,
    status: entry.status,
    synthetic_provenance_sha256: entry.synthetic_provenance_sha256,
    vertical_authority_sha256: entry.vertical_authority_sha256,
    vertical_binding_sha256: entry.vertical_binding_sha256,
    vertical_id: entry.vertical_id,
  };
}

export function fullPersonQaSyntheticProvenance({ authority_id, case_id } = {}) {
  const authorityId = exactAuthorityId(authority_id);
  if (!Object.hasOwn(FULL_PERSON_QA_CASE_VERTICALS, case_id)) {
    deny('SUBSCRIPTION_V1_FULL_PERSON_QA_SYNTHETIC_PROVENANCE_INVALID');
  }
  return deepFreeze({
    authority_id: authorityId,
    authorship: FULL_PERSON_QA_SYNTHETIC_PROVENANCE_AUTHOR,
    billing_evidence: false,
    case_id,
    contract: FULL_PERSON_QA_SYNTHETIC_PROVENANCE_CONTRACT,
    data_classification: FULL_PERSON_QA_SYNTHETIC_DATA_CLASSIFICATION,
    real_customer_state: false,
    synthetic_only: true,
  });
}

export function fullPersonQaSyntheticProvenanceSha256(value = {}) {
  if (!exactKeys(value, SYNTHETIC_PROVENANCE_KEYS)
    || value.authorship !== FULL_PERSON_QA_SYNTHETIC_PROVENANCE_AUTHOR
    || value.billing_evidence !== false
    || value.contract !== FULL_PERSON_QA_SYNTHETIC_PROVENANCE_CONTRACT
    || value.data_classification !== FULL_PERSON_QA_SYNTHETIC_DATA_CLASSIFICATION
    || value.real_customer_state !== false
    || value.synthetic_only !== true) {
    deny('SUBSCRIPTION_V1_FULL_PERSON_QA_SYNTHETIC_PROVENANCE_INVALID');
  }
  const expected = fullPersonQaSyntheticProvenance({
    authority_id: value.authority_id,
    case_id: value.case_id,
  });
  if (canonicalJson(value) !== canonicalJson(expected)) {
    deny('SUBSCRIPTION_V1_FULL_PERSON_QA_SYNTHETIC_PROVENANCE_INVALID');
  }
  return hashCanonicalJson(expected);
}

export function fullPersonQaCustodySha256(entry = {}) {
  return hashCanonicalJson(custodyPayload(entry));
}

export function fullPersonQaVerticalAuthoritySha256(binding = {}) {
  if (!isPlainObject(binding)) {
    deny('SUBSCRIPTION_V1_FULL_PERSON_QA_VERTICAL_AUTHORITY_BINDING_INVALID');
  }
  for (const field of VERTICAL_AUTHORITY_FIELDS) {
    const value = binding[field];
    if (typeof value !== 'string'
      || value.length === 0
      || value !== value.trim()
      || Buffer.byteLength(value, 'utf8') > 512
      || (field.endsWith('_sha256') && !isCustodyHash(value))) {
      deny('SUBSCRIPTION_V1_FULL_PERSON_QA_VERTICAL_AUTHORITY_BINDING_INVALID');
    }
  }
  const authority = Object.fromEntries(
    VERTICAL_AUTHORITY_FIELDS.map((field) => [field, binding[field]]),
  );
  return hashCanonicalJson({
    contract: FULL_PERSON_QA_VERTICAL_AUTHORITY_VERSION,
    authority,
  });
}

function receiptAuthorityEntry(receipt) {
  return {
    assessment_digest: receipt.assessment_digest,
    assessment_evidence_sha256: receipt.assessment_evidence_sha256,
    authority_id: receipt.authority_id,
    ba_artifact_sha256: receipt.ba_artifact_sha256,
    ba_envelope_sha256: receipt.ba_envelope_sha256,
    ba_realization_id_digest: receipt.ba_realization_id_digest,
    ba_realization_identity_sha256: receipt.ba_realization_identity_sha256,
    bos_artifact_sha256: receipt.bos_artifact_sha256,
    bos_canonical_source_sha256: receipt.bos_canonical_source_sha256,
    bos_envelope_sha256: receipt.bos_envelope_sha256,
    bos_realization_id_digest: receipt.bos_realization_id_digest,
    bos_realization_identity_sha256: receipt.bos_realization_identity_sha256,
    canonical_profile_artifact_sha256: receipt.canonical_profile_artifact_sha256,
    case_id: receipt.case_id,
    custody_sha256: receipt.custody_sha256,
    expires_at: receipt.authority_expires_at,
    profile_digest: receipt.profile_digest,
    status: 'active',
    synthetic_provenance_sha256: receipt.synthetic_provenance_sha256,
    vertical_authority_sha256: receipt.vertical_authority_sha256,
    vertical_binding_sha256: receipt.vertical_binding_sha256,
    vertical_id: receipt.vertical_id,
  };
}

function sameSelectedAuthority(authority, receipt) {
  const supplied = receiptAuthorityEntry(receipt);
  for (const field of [...CUSTODY_HASH_FIELDS, 'custody_sha256']) {
    if (!constantTimeEqual(authority[field], supplied[field])) return false;
  }
  return authority.authority_id === supplied.authority_id
    && authority.case_id === supplied.case_id
    && authority.vertical_id === supplied.vertical_id
    && authority.expires_at === supplied.expires_at;
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
    || isPlaceholder(receipt.authority_id)
    || RAW_ID_TEXT.test(receipt.authority_id)
    || !Object.hasOwn(FULL_PERSON_QA_CASE_VERTICALS, receipt.case_id)
    || receipt.vertical_id !== FULL_PERSON_QA_CASE_VERTICALS[receipt.case_id]
    || !CUSTODY_HASH_FIELDS.every((field) => isCustodyHash(receipt[field]))
    || !isCustodyHash(receipt.custody_sha256)
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
    || expiresAt > Date.parse(receipt.authority_expires_at)
    || !constantTimeEqual(
      receipt.custody_sha256,
      fullPersonQaCustodySha256(receiptAuthorityEntry(receipt)),
    )) {
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

export function fullPersonQaAssessmentDigest(assessmentId, digestKey) {
  const normalized = exactAssessmentId(assessmentId);
  const secret = requireSecret(
    digestKey,
    'SUBSCRIPTION_V1_FULL_PERSON_QA_DIGEST_KEY_REQUIRED',
  );
  return domainHmac(FULL_PERSON_QA_HMAC_DOMAINS.assessment_digest, normalized, secret);
}

export function fullPersonQaBaRealizationIdDigest(realizationId, digestKey) {
  const normalized = exactRealizationId(
    realizationId,
    'SUBSCRIPTION_V1_FULL_PERSON_QA_BA_REALIZATION_ID_INVALID',
  );
  const secret = requireSecret(
    digestKey,
    'SUBSCRIPTION_V1_FULL_PERSON_QA_DIGEST_KEY_REQUIRED',
  );
  return domainHmac(
    FULL_PERSON_QA_HMAC_DOMAINS.ba_realization_id_digest,
    normalized,
    secret,
  );
}

export function fullPersonQaBosRealizationIdDigest(realizationId, digestKey) {
  const normalized = exactRealizationId(
    realizationId,
    'SUBSCRIPTION_V1_FULL_PERSON_QA_BOS_REALIZATION_ID_INVALID',
  );
  const secret = requireSecret(
    digestKey,
    'SUBSCRIPTION_V1_FULL_PERSON_QA_DIGEST_KEY_REQUIRED',
  );
  return domainHmac(
    FULL_PERSON_QA_HMAC_DOMAINS.bos_realization_id_digest,
    normalized,
    secret,
  );
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
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > FULL_PERSON_QA_MANIFEST_COUNT) {
    deny('SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_COUNT_INVALID');
  }
  const entries = parsed.map((entry) => {
    if (!exactKeys(entry, MANIFEST_ENTRY_KEYS)) {
      deny('SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_FIELDS_INVALID');
    }
    if (!isCustodyHash(entry.profile_digest)) {
      deny('SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_DIGEST_INVALID');
    }
    if (!CUSTODY_HASH_FIELDS.every((field) => isCustodyHash(entry[field]))) {
      deny('SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_CUSTODY_FIELD_INVALID');
    }
    exactAuthorityId(entry.authority_id);
    if (!Object.hasOwn(FULL_PERSON_QA_CASE_VERTICALS, entry.case_id)) {
      deny('SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_CASE_SET_INVALID');
    }
    if (entry.vertical_id !== FULL_PERSON_QA_CASE_VERTICALS[entry.case_id]) {
      deny('SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_VERTICAL_INVALID');
    }
    if (!ALLOWED_MANIFEST_STATUSES.includes(entry.status)) {
      deny('SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_STATUS_INVALID');
    }
    const normalized = {
      assessment_digest: entry.assessment_digest,
      assessment_evidence_sha256: entry.assessment_evidence_sha256,
      authority_id: entry.authority_id,
      ba_artifact_sha256: entry.ba_artifact_sha256,
      ba_envelope_sha256: entry.ba_envelope_sha256,
      ba_realization_id_digest: entry.ba_realization_id_digest,
      ba_realization_identity_sha256: entry.ba_realization_identity_sha256,
      bos_artifact_sha256: entry.bos_artifact_sha256,
      bos_canonical_source_sha256: entry.bos_canonical_source_sha256,
      bos_envelope_sha256: entry.bos_envelope_sha256,
      bos_realization_id_digest: entry.bos_realization_id_digest,
      bos_realization_identity_sha256: entry.bos_realization_identity_sha256,
      canonical_profile_artifact_sha256: entry.canonical_profile_artifact_sha256,
      case_id: entry.case_id,
      custody_sha256: entry.custody_sha256,
      expires_at: canonicalTimestamp(
        entry.expires_at,
        'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_EXPIRY_INVALID',
      ),
      profile_digest: entry.profile_digest,
      status: entry.status,
      synthetic_provenance_sha256: entry.synthetic_provenance_sha256,
      vertical_authority_sha256: entry.vertical_authority_sha256,
      vertical_binding_sha256: entry.vertical_binding_sha256,
      vertical_id: entry.vertical_id,
    };
    if (!isCustodyHash(normalized.custody_sha256)
      || !constantTimeEqual(
        normalized.custody_sha256,
        fullPersonQaCustodySha256(normalized),
      )) {
      deny('SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_CUSTODY_INVALID');
    }
    return normalized;
  }).sort((left, right) => left.case_id.localeCompare(right.case_id));
  for (const field of UNIQUE_MANIFEST_FIELDS) {
    if (new Set(entries.map((entry) => entry[field])).size !== entries.length) {
      deny('SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_DUPLICATE');
    }
  }
  const verticalAuthorities = new Map();
  for (const entry of entries) {
    const prior = verticalAuthorities.get(entry.vertical_id);
    if (prior && !constantTimeEqual(prior, entry.vertical_authority_sha256)) {
      deny('SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_VERTICAL_AUTHORITY_INVALID');
    }
    verticalAuthorities.set(entry.vertical_id, entry.vertical_authority_sha256);
  }
  if (new Set(verticalAuthorities.values()).size !== verticalAuthorities.size) {
    deny('SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_VERTICAL_AUTHORITY_INVALID');
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
    ...matched,
    profile_id: profileId,
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
    assessment_digest: authority.assessment_digest,
    assessment_evidence_sha256: authority.assessment_evidence_sha256,
    authority_expires_at: authority.expires_at,
    authority_id: authority.authority_id,
    ba_artifact_sha256: authority.ba_artifact_sha256,
    ba_envelope_sha256: authority.ba_envelope_sha256,
    ba_realization_id_digest: authority.ba_realization_id_digest,
    ba_realization_identity_sha256: authority.ba_realization_identity_sha256,
    billing_evidence: false,
    bos_artifact_sha256: authority.bos_artifact_sha256,
    bos_canonical_source_sha256: authority.bos_canonical_source_sha256,
    bos_envelope_sha256: authority.bos_envelope_sha256,
    bos_realization_id_digest: authority.bos_realization_id_digest,
    bos_realization_identity_sha256: authority.bos_realization_identity_sha256,
    browser_binding_hash: browserBindingHash(req, signingKey),
    capability_hash: capabilityTokenHash(token, signingKey),
    canonical_profile_artifact_sha256: authority.canonical_profile_artifact_sha256,
    case_id: authority.case_id,
    contract: FULL_PERSON_QA_CAPABILITY_CONTRACT,
    custody_sha256: authority.custody_sha256,
    expires_at: new Date(expiresAtMs).toISOString(),
    issued_at: currentTime.toISOString(),
    manifest_sha256: authority.manifest_sha256,
    manifest_version: authority.manifest_version,
    profile_digest: authority.profile_digest,
    profile_id: authority.profile_id,
    stripe_subscription_created: false,
    synthetic_only: true,
    synthetic_provenance_sha256: authority.synthetic_provenance_sha256,
    vertical_authority_sha256: authority.vertical_authority_sha256,
    vertical_binding_sha256: authority.vertical_binding_sha256,
    vertical_id: authority.vertical_id,
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
  if (!sameSelectedAuthority(authority, receipt)
    || authority.manifest_version !== receipt.manifest_version
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
      assessment_digest: receipt.assessment_digest,
      authority_id: receipt.authority_id,
      case_id: receipt.case_id,
      allowed_product: receipt.allowed_product,
      access_class: receipt.access_class,
      access_label: receipt.access_label,
      manifest_version: receipt.manifest_version,
      manifest_sha256: authority.manifest_sha256,
      authority_expires_at: authority.expires_at,
      vertical_id: receipt.vertical_id,
      vertical_authority_sha256: receipt.vertical_authority_sha256,
      vertical_binding_sha256: receipt.vertical_binding_sha256,
      canonical_profile_artifact_sha256: receipt.canonical_profile_artifact_sha256,
      bos_canonical_source_sha256: receipt.bos_canonical_source_sha256,
      assessment_evidence_sha256: receipt.assessment_evidence_sha256,
      ba_realization_id_digest: receipt.ba_realization_id_digest,
      ba_realization_identity_sha256: receipt.ba_realization_identity_sha256,
      ba_artifact_sha256: receipt.ba_artifact_sha256,
      ba_envelope_sha256: receipt.ba_envelope_sha256,
      bos_realization_id_digest: receipt.bos_realization_id_digest,
      bos_realization_identity_sha256: receipt.bos_realization_identity_sha256,
      bos_artifact_sha256: receipt.bos_artifact_sha256,
      bos_envelope_sha256: receipt.bos_envelope_sha256,
      custody_sha256: receipt.custody_sha256,
      synthetic_only: true,
      synthetic_provenance_sha256: receipt.synthetic_provenance_sha256,
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
