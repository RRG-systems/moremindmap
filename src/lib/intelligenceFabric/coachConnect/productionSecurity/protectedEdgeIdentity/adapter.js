import crypto from 'node:crypto';
import {
  hashCanonicalJson,
} from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';
import {
  describeProtectedEdgeIdentityBindingCapabilityV1,
  validateProtectedEdgeIdentityConfigurationV1,
} from './contracts.js';
import {
  issueProtectedEdgeInternalAssertionV1,
  verifyProtectedEdgeInternalAssertionV1,
} from './internalAssertion.js';
import {
  createProtectedEdgeReplayProtectorV1,
} from './replayProtection.js';
import {
  extractProtectedEdgeUpstreamTokenV1,
} from './tokenExtraction.js';
import {
  verifyProtectedEdgeUpstreamJwtV1,
} from './jwtVerifier.js';

const frozen = (value) => deepFreeze(structuredClone(value));
const deny = (code, status = 401) => frozen({
  ok: false,
  allowed: false,
  code,
  status,
  edge_attestation: null,
  raw_token_logged: false,
  raw_token_persisted: false,
});

function hmac(keyMaterial, domain, value) {
  return crypto.createHmac('sha256', keyMaterial)
    .update(`${domain}\0${value}`, 'utf8')
    .digest('hex');
}

function parseJwks(serialized) {
  if (serialized && typeof serialized === 'object' && !Array.isArray(serialized)) {
    return structuredClone(serialized);
  }
  if (typeof serialized !== 'string'
    || serialized.length < 16
    || serialized.length > 131072) {
    return null;
  }
  try {
    const parsed = JSON.parse(serialized);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function bindingContextHash(req, configuration, trustedTransactionRef = null) {
  const route = typeof req?.url === 'string' ? req.url.split('?')[0] : '/';
  const method = typeof req?.method === 'string' ? req.method.toUpperCase() : 'GET';
  return hashCanonicalJson({
    environment_id: configuration.environment_id,
    deployment_id: configuration.deployment_id,
    method,
    route,
    trusted_transaction_ref: trustedTransactionRef,
  });
}

function hasBrowserSuppliedAuthorityBinding(req) {
  const prohibited = new Set([
    'x-more-deployment-id',
    'x-more-immutable-deployment-id',
    'x-more-protected-edge-session',
    'x-more-protected-edge-transaction',
  ]);
  return Object.keys(req?.headers || {})
    .some((name) => prohibited.has(name.toLowerCase()));
}

function trustedTransactionReference({
  configuration,
  identityHashKey,
  transactionIdFactory,
} = {}) {
  if (configuration.replay_mode !== 'SESSION_BOUND') return null;
  let rawReference;
  try {
    rawReference = transactionIdFactory();
  } catch {
    return null;
  }
  if (typeof rawReference !== 'string'
    || rawReference.length < 16
    || rawReference.length > 256
    || !/^[A-Za-z0-9:_-]+$/.test(rawReference)) {
    return null;
  }
  return `edge_transaction_${hmac(
    identityHashKey,
    'protected_edge_server_transaction',
    rawReference,
  )}`;
}

function normalizeVerifiedIdentity({
  verifiedClaims,
  configuration,
  identityHashKey,
} = {}) {
  const audienceSet = [...verifiedClaims.audiences].sort();
  return frozen({
    identity_version: 'protected-edge-normalized-identity-v1',
    canonical_subject_ref: `edge_subject_${hmac(
      identityHashKey,
      'protected_edge_subject',
      `${verifiedClaims.issuer}\0${verifiedClaims.subject}`,
    ).slice(0, 48)}`,
    issuer_provenance_ref: `edge_issuer_${hmac(
      identityHashKey,
      'protected_edge_issuer',
      verifiedClaims.issuer,
    ).slice(0, 40)}`,
    audience_policy_ref: `edge_audience_${hmac(
      identityHashKey,
      'protected_edge_audience',
      audienceSet.join('\0'),
    ).slice(0, 40)}`,
    token_identifier_ref: `edge_token_${hmac(
      identityHashKey,
      'protected_edge_token_identifier',
      `${verifiedClaims.issuer}\0${verifiedClaims.token_id}`,
    ).slice(0, 48)}`,
    provider_type: configuration.provider_type,
    authenticated_at: verifiedClaims.authenticated_at,
    issued_at: verifiedClaims.issued_at,
    expires_at: verifiedClaims.expires_at,
    mfa_verified: verifiedClaims.mfa_verified === true,
    named_identity_verified: verifiedClaims.named_identity_verified === true,
    verified_email_present: verifiedClaims.verified_email_present === true,
    provenance: 'CRYPTOGRAPHICALLY_VERIFIED_UPSTREAM_JWT',
    assurance_level: verifiedClaims.mfa_verified === true ? 'MFA_VERIFIED' : 'DENIED',
    profile_id_authority: false,
    tester_authority: false,
    entitlement_authority: false,
  });
}

function unconfiguredAdapter(
  providerType = null,
  code = 'PROTECTED_EDGE_CONFIGURATION_UNAVAILABLE',
) {
  return Object.freeze({
    configured: false,
    describeCapability: () => describeProtectedEdgeIdentityBindingCapabilityV1({
      configured: false,
      providerType,
    }),
    bindRequest: async () => deny(code, 503),
  });
}

export async function createProtectedEdgeIdentityBindingV1({
  configuration,
  resolveReference,
  statePort,
  clock = () => Date.now(),
  assertionIdFactory,
  transactionIdFactory = () => `edge_transaction_${crypto.randomUUID().replaceAll('-', '')}`,
} = {}) {
  const checked = validateProtectedEdgeIdentityConfigurationV1(configuration);
  if (!checked.valid
    || configuration.enabled !== true
    || typeof resolveReference !== 'function') {
    return unconfiguredAdapter(configuration?.provider_type);
  }
  if (configuration.emergency_disabled === true) {
    return unconfiguredAdapter(configuration.provider_type, 'EMERGENCY_DISABLED');
  }
  let jwks;
  let identityHashKey;
  let internalSigningKey;
  try {
    const [jwksDocument, identityKey, signingKey] = await Promise.all([
      resolveReference(configuration.jwks_ref, {
        purpose: 'PROTECTED_EDGE_JWKS_DOCUMENT',
        secret: false,
      }),
      resolveReference(configuration.identity_hash_key_ref, {
        purpose: 'PROTECTED_EDGE_IDENTITY_HASH_KEY',
        secret: true,
      }),
      resolveReference(configuration.internal_signing_key_ref, {
        purpose: 'PROTECTED_EDGE_INTERNAL_SIGNING_KEY',
        secret: true,
      }),
    ]);
    jwks = parseJwks(jwksDocument);
    identityHashKey = identityKey;
    internalSigningKey = signingKey;
  } catch {
    return unconfiguredAdapter(configuration.provider_type);
  }
  if (!jwks
    || hashCanonicalJson(jwks) !== configuration.jwks_sha256
    || typeof identityHashKey !== 'string'
    || identityHashKey.length < 32
    || typeof internalSigningKey !== 'string'
    || internalSigningKey.length < 32) {
    return unconfiguredAdapter(configuration.provider_type);
  }

  const replayProtector = createProtectedEdgeReplayProtectorV1({
    statePort,
    environmentId: configuration.environment_id,
    clock,
  });

  return Object.freeze({
    configured: true,
    describeCapability: () => describeProtectedEdgeIdentityBindingCapabilityV1({
      configured: true,
      providerType: configuration.provider_type,
    }),

    async bindRequest(req, {
      correlationRef = 'protected_edge_request',
    } = {}) {
      if (configuration.emergency_disabled === true) {
        return deny('EMERGENCY_DISABLED', 503);
      }
      if (hasBrowserSuppliedAuthorityBinding(req)) {
        return deny('PROTECTED_EDGE_AUTHORITY_BINDING_SPOOFED');
      }
      const extracted = extractProtectedEdgeUpstreamTokenV1(req, {
        tokenSource: configuration.token_source,
      });
      if (!extracted.ok) return deny(extracted.code);

      const verified = verifyProtectedEdgeUpstreamJwtV1({
        serialized: extracted.serialized,
        configuration,
        jwks,
        clock,
      });
      if (!verified.ok) return deny(verified.code);

      const identity = normalizeVerifiedIdentity({
        verifiedClaims: verified.verified_claims,
        configuration,
        identityHashKey,
      });
      const upstreamExpiresAtMs = Math.min(
        Date.parse(identity.expires_at),
        clock() + configuration.replay_ttl_seconds * 1000,
      );
      const trustedTransactionRef = trustedTransactionReference({
        configuration,
        identityHashKey,
        transactionIdFactory,
      });
      if (configuration.replay_mode === 'SESSION_BOUND' && trustedTransactionRef == null) {
        return deny('PROTECTED_EDGE_TRUSTED_TRANSACTION_REQUIRED');
      }
      const contextHash = bindingContextHash(
        req,
        configuration,
        trustedTransactionRef,
      );
      const upstreamReplay = await replayProtector.claim({
        replayKeyHash: hmac(
          identityHashKey,
          'protected_edge_upstream_replay_key',
          identity.token_identifier_ref,
        ),
        fingerprint: hmac(
          identityHashKey,
          'protected_edge_upstream_replay_fingerprint',
          `${identity.token_identifier_ref}\0${identity.canonical_subject_ref}`
            + `\0${configuration.environment_id}\0${configuration.deployment_id}`
            + `\0${contextHash}`,
        ),
        correlationRef,
        expiresAtMs: upstreamExpiresAtMs,
        strictOneTime: true,
      });
      if (!upstreamReplay.allowed) return deny(upstreamReplay.code);

      const issued = issueProtectedEdgeInternalAssertionV1({
        identity,
        configuration,
        signingKey: internalSigningKey,
        bindingContextHash: contextHash,
        clock,
        assertionIdFactory,
      });
      if (!issued.ok) return deny(issued.code, 503);

      const internal = await verifyProtectedEdgeInternalAssertionV1({
        serialized: issued.serialized,
        configuration,
        signingKey: internalSigningKey,
        replayProtector,
        correlationRef,
        bindingContextHash: contextHash,
        clock,
      });
      if (!internal.allowed) return deny(internal.code, 503);

      return frozen({
        ok: true,
        allowed: true,
        code: null,
        status: 200,
        edge_attestation: internal.edge_attestation,
        identity_receipt: {
          receipt_version: 'protected-edge-identity-receipt-v1',
          adapter_id: 'provider-neutral-protected-edge-identity-adapter-v1',
          provider_type: configuration.provider_type,
          canonical_subject_ref: identity.canonical_subject_ref,
          issuer_provenance_ref: identity.issuer_provenance_ref,
          assurance_level: identity.assurance_level,
          mfa_verified: true,
          profile_id_authority: false,
          tester_authority: false,
          entitlement_authority: false,
          verified_at: new Date(clock()).toISOString(),
          receipt_ref: `edge_identity_${hmac(
            identityHashKey,
            'protected_edge_identity_receipt',
            `${identity.token_identifier_ref}\0${contextHash}`,
          ).slice(0, 40)}`,
        },
        internal_assertion_issued: true,
        internal_assertion_exposed: false,
        raw_token_logged: false,
        raw_token_persisted: false,
      });
    },
  });
}
