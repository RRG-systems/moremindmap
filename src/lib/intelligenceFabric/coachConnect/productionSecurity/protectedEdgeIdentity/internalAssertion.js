import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { deepFreeze } from '../../../validation.js';
import {
  PROTECTED_EDGE_INTERNAL_ASSERTION_VERSION,
} from './contracts.js';

const frozen = (value) => deepFreeze(structuredClone(value));
const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const opaque = (value, maximum = 256) => typeof value === 'string'
  && value.length > 0
  && value.length <= maximum
  && !/[\s/?#@\0]/.test(value);
const deny = (code) => frozen({
  ok: false,
  allowed: false,
  code,
  edge_attestation: null,
  raw_token_logged: false,
});

function hmac(keyMaterial, domain, value) {
  return crypto.createHmac('sha256', keyMaterial)
    .update(`${domain}\0${value}`, 'utf8')
    .digest('hex');
}

function decodePayload(payloadPart) {
  try {
    const parsed = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function issueProtectedEdgeInternalAssertionV1({
  identity,
  configuration,
  signingKey,
  bindingContextHash,
  clock = () => Date.now(),
  assertionIdFactory = () => `edge_assertion_${crypto.randomUUID().replaceAll('-', '')}`,
} = {}) {
  const now = clock();
  const identityExpiryMs = Date.parse(identity?.expires_at);
  const identityAuthenticatedAtMs = Date.parse(identity?.authenticated_at);
  if (typeof signingKey !== 'string'
    || signingKey.length < 32
    || !sha256(bindingContextHash)
    || !Number.isFinite(now)
    || !Number.isFinite(identityExpiryMs)
    || !Number.isFinite(identityAuthenticatedAtMs)
    || identityExpiryMs <= now
    || identityAuthenticatedAtMs > now
    || identityAuthenticatedAtMs >= identityExpiryMs
    || identity?.mfa_verified !== true
    || identity?.named_identity_verified !== true
    || !opaque(identity?.canonical_subject_ref)
    || !opaque(identity?.issuer_provenance_ref)
    || !opaque(identity?.audience_policy_ref)
    || !opaque(identity?.token_identifier_ref)) {
    return deny('PROTECTED_EDGE_INTERNAL_SIGNING_UNAVAILABLE');
  }
  const assertionId = assertionIdFactory();
  if (!opaque(assertionId)) return deny('PROTECTED_EDGE_INTERNAL_SIGNING_UNAVAILABLE');
  const expiresAtMs = Math.min(
    identityExpiryMs,
    now + configuration.internal_assertion_ttl_seconds * 1000,
  );
  const payload = {
    assertion_version: PROTECTED_EDGE_INTERNAL_ASSERTION_VERSION,
    environment_id: configuration.environment_id,
    deployment_id: configuration.deployment_id,
    policy_digest: configuration.protected_edge_policy_digest,
    canonical_subject_ref: identity.canonical_subject_ref,
    issuer_provenance_ref: identity.issuer_provenance_ref,
    audience_policy_ref: identity.audience_policy_ref,
    token_identifier_ref: identity.token_identifier_ref,
    provider_type: configuration.provider_type,
    assertion_id: assertionId,
    binding_context_hash: bindingContextHash,
    named_identity_verified: true,
    mfa_verified: true,
    public_access: false,
    authenticated_at: identity.authenticated_at,
    issued_at: new Date(now).toISOString(),
    expires_at: new Date(expiresAtMs).toISOString(),
  };
  const payloadPart = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signaturePart = crypto.createHmac('sha256', signingKey)
    .update(payloadPart)
    .digest('base64url');
  return Object.freeze({
    ok: true,
    allowed: false,
    code: null,
    serialized: `${payloadPart}.${signaturePart}`,
    assertion_id: assertionId,
    expires_at: payload.expires_at,
    raw_token_logged: false,
  });
}

export async function verifyProtectedEdgeInternalAssertionV1({
  serialized,
  configuration,
  signingKey,
  replayProtector,
  correlationRef,
  bindingContextHash,
  clock = () => Date.now(),
} = {}) {
  if (typeof serialized !== 'string'
    || serialized.length > 8192
    || typeof signingKey !== 'string'
    || signingKey.length < 32
    || typeof replayProtector?.claim !== 'function') {
    return deny('PROTECTED_EDGE_IDENTITY_REQUIRED');
  }
  const parts = serialized.split('.');
  if (parts.length !== 2 || parts.some((part) => part.length === 0)) {
    return deny('PROTECTED_EDGE_IDENTITY_REQUIRED');
  }
  const expected = crypto.createHmac('sha256', signingKey)
    .update(parts[0])
    .digest();
  let supplied;
  try {
    supplied = Buffer.from(parts[1], 'base64url');
  } catch {
    return deny('PROTECTED_EDGE_IDENTITY_REQUIRED');
  }
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
    return deny('PROTECTED_EDGE_IDENTITY_REQUIRED');
  }
  const payload = decodePayload(parts[0]);
  const now = clock();
  const issuedAtMs = Date.parse(payload?.issued_at);
  const expiresAtMs = Date.parse(payload?.expires_at);
  const authenticatedAtMs = Date.parse(payload?.authenticated_at);
  if (payload?.assertion_version !== PROTECTED_EDGE_INTERNAL_ASSERTION_VERSION
    || payload.environment_id !== configuration.environment_id
    || payload.deployment_id !== configuration.deployment_id
    || payload.policy_digest !== configuration.protected_edge_policy_digest
    || payload.provider_type !== configuration.provider_type
    || payload.binding_context_hash !== bindingContextHash
    || payload.named_identity_verified !== true
    || payload.mfa_verified !== true
    || payload.public_access !== false
    || !opaque(payload.canonical_subject_ref)
    || !opaque(payload.issuer_provenance_ref)
    || !opaque(payload.audience_policy_ref)
    || !opaque(payload.token_identifier_ref)
    || !opaque(payload.assertion_id)
    || !Number.isFinite(issuedAtMs)
    || !Number.isFinite(expiresAtMs)
    || !Number.isFinite(authenticatedAtMs)
    || issuedAtMs > now + configuration.clock_skew_seconds * 1000
    || expiresAtMs <= now
    || expiresAtMs <= issuedAtMs
    || authenticatedAtMs > issuedAtMs
    || authenticatedAtMs >= expiresAtMs
    || expiresAtMs - issuedAtMs > configuration.internal_assertion_ttl_seconds * 1000) {
    return deny('PROTECTED_EDGE_IDENTITY_REQUIRED');
  }
  const replay = await replayProtector.claim({
    replayKeyHash: hmac(
      signingKey,
      'protected_edge_internal_replay_key',
      payload.assertion_id,
    ),
    fingerprint: hmac(
      signingKey,
      'protected_edge_internal_replay_fingerprint',
      `${payload.assertion_id}\0${payload.canonical_subject_ref}`
        + `\0${payload.environment_id}\0${payload.deployment_id}`,
    ),
    correlationRef,
    expiresAtMs,
    strictOneTime: true,
  });
  if (!replay.allowed) return deny(replay.code || 'PROTECTED_EDGE_REPLAY_DETECTED');
  return frozen({
    ok: true,
    allowed: true,
    code: null,
    edge_attestation: {
      named_identity_verified: true,
      mfa_verified: true,
      public_access: false,
      policy_digest: configuration.protected_edge_policy_digest,
      canonical_subject_ref: payload.canonical_subject_ref,
      issuer_provenance_ref: payload.issuer_provenance_ref,
      provider_type: payload.provider_type,
      environment_id: payload.environment_id,
      deployment_id: payload.deployment_id,
      receipt_ref: `edge_receipt_${hmac(
        signingKey,
        'protected_edge_receipt',
        serialized,
      ).slice(0, 32)}`,
    },
    raw_token_logged: false,
  });
}
