import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { hashCanonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';

const frozen = (value) => deepFreeze(structuredClone(value));
const deny = (code) => frozen({
  ok: false,
  allowed: false,
  code,
  verified_claims: null,
  raw_token_logged: false,
});
const boundedClaim = (value, maximum = 512) => typeof value === 'string'
  && value.length > 0
  && value.length <= maximum
  && !/[\r\n\0]/.test(value);
const base64urlJson = (value) => {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};
const audienceMatches = (value, expected) => {
  const values = Array.isArray(value) ? value : [value];
  return values.length > 0
    && values.every((entry) => typeof entry === 'string')
    && values.every((entry) => expected.includes(entry));
};

function selectVerificationKey(jwks, header) {
  if (!jwks || typeof jwks !== 'object' || !Array.isArray(jwks.keys)
    || jwks.keys.length < 1 || jwks.keys.length > 32) {
    return null;
  }
  const matches = jwks.keys.filter((key) => key?.kid === header.kid
    && key?.kty === 'RSA'
    && (key.use == null || key.use === 'sig')
    && (key.alg == null || key.alg === 'RS256'));
  return matches.length === 1 ? matches[0] : null;
}

function mfaProven(claims, configuration) {
  const amr = Array.isArray(claims?.[configuration.mfa_claim])
    ? claims[configuration.mfa_claim]
    : [];
  const acr = claims?.[configuration.acr_claim];
  return amr.some((value) => configuration.accepted_mfa_values.includes(value))
    || (typeof acr === 'string' && configuration.accepted_acr_values.includes(acr));
}

export function verifyProtectedEdgeUpstreamJwtV1({
  serialized,
  configuration,
  jwks,
  clock = () => Date.now(),
} = {}) {
  if (typeof serialized !== 'string' || serialized.length > 16384) {
    return deny('PROTECTED_EDGE_TOKEN_MALFORMED');
  }
  if (hashCanonicalJson(jwks) !== configuration?.jwks_sha256) {
    return deny('PROTECTED_EDGE_JWKS_UNAVAILABLE');
  }
  const parts = serialized.split('.');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    return deny('PROTECTED_EDGE_TOKEN_MALFORMED');
  }
  const header = base64urlJson(parts[0]);
  const claims = base64urlJson(parts[1]);
  if (!header || !claims || typeof header !== 'object' || typeof claims !== 'object') {
    return deny('PROTECTED_EDGE_TOKEN_MALFORMED');
  }
  if (header.alg === 'none'
    || !configuration.allowed_algorithms.includes(header.alg)
    || header.alg !== 'RS256') {
    return deny('PROTECTED_EDGE_ALGORITHM_REJECTED');
  }
  if (!boundedClaim(header.kid, 256)) return deny('PROTECTED_EDGE_KEY_ID_MISSING');
  const jwk = selectVerificationKey(jwks, header);
  if (!jwk) return deny('PROTECTED_EDGE_KEY_ID_UNKNOWN');
  let verified = false;
  try {
    const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    verified = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8'),
      key,
      Buffer.from(parts[2], 'base64url'),
    );
  } catch {
    return deny('PROTECTED_EDGE_SIGNATURE_INVALID');
  }
  if (!verified) return deny('PROTECTED_EDGE_SIGNATURE_INVALID');
  if (claims.iss !== configuration.issuer) return deny('PROTECTED_EDGE_ISSUER_MISMATCH');
  if (!audienceMatches(claims.aud, configuration.audiences)) {
    return deny('PROTECTED_EDGE_AUDIENCE_MISMATCH');
  }
  const nowSeconds = Math.floor(clock() / 1000);
  const skew = configuration.clock_skew_seconds;
  if (!Number.isInteger(claims.exp)
    || !Number.isInteger(claims.iat)
    || (claims.nbf != null && !Number.isInteger(claims.nbf))) {
    return deny('PROTECTED_EDGE_TOKEN_TEMPORAL_INVALID');
  }
  if (claims.exp <= claims.iat
    || (claims.nbf != null && claims.exp <= claims.nbf)) {
    return deny('PROTECTED_EDGE_TOKEN_TEMPORAL_INVALID');
  }
  if (claims.exp + skew < nowSeconds) {
    return deny('PROTECTED_EDGE_TOKEN_EXPIRED');
  }
  if (claims.iat - skew > nowSeconds
    || (claims.nbf != null && claims.nbf - skew > nowSeconds)) {
    return deny('PROTECTED_EDGE_TOKEN_NOT_YET_VALID');
  }
  if (nowSeconds - claims.iat > configuration.max_token_age_seconds + skew
    || claims.exp - claims.iat > configuration.max_token_age_seconds + skew) {
    return deny('PROTECTED_EDGE_TOKEN_STALE');
  }
  const subject = claims[configuration.subject_claim];
  const tokenId = claims[configuration.token_id_claim];
  if (!boundedClaim(subject) || !boundedClaim(tokenId, 256)) {
    return deny(!boundedClaim(subject)
      ? 'PROTECTED_EDGE_SUBJECT_MISSING'
      : 'PROTECTED_EDGE_TOKEN_ID_MISSING');
  }
  const mfaVerified = mfaProven(claims, configuration);
  if (configuration.mfa_required && !mfaVerified) {
    return deny('PROTECTED_EDGE_MFA_REQUIRED');
  }
  const authenticationTimeValue = claims[configuration.authentication_time_claim];
  if (authenticationTimeValue != null && !Number.isInteger(authenticationTimeValue)) {
    return deny('PROTECTED_EDGE_TOKEN_TEMPORAL_INVALID');
  }
  const authenticationTimeSeconds = Number.isInteger(authenticationTimeValue)
    ? authenticationTimeValue
    : claims.iat;
  if (authenticationTimeSeconds > claims.iat
    || authenticationTimeSeconds >= claims.exp) {
    return deny('PROTECTED_EDGE_TOKEN_TEMPORAL_INVALID');
  }
  if (authenticationTimeSeconds - skew > nowSeconds) {
    return deny('PROTECTED_EDGE_TOKEN_NOT_YET_VALID');
  }
  if (nowSeconds - authenticationTimeSeconds
    > configuration.max_token_age_seconds + skew) {
    return deny('PROTECTED_EDGE_TOKEN_STALE');
  }
  return frozen({
    ok: true,
    allowed: false,
    code: null,
    verified_claims: {
      issuer: claims.iss,
      audiences: Array.isArray(claims.aud) ? claims.aud : [claims.aud],
      subject,
      token_id: tokenId,
      issued_at: new Date(claims.iat * 1000).toISOString(),
      expires_at: new Date(claims.exp * 1000).toISOString(),
      authenticated_at: new Date(authenticationTimeSeconds * 1000).toISOString(),
      mfa_verified: mfaVerified,
      named_identity_verified: true,
      verified_email_present:
        typeof claims.email === 'string' && claims.email_verified === true,
    },
    raw_token_logged: false,
  });
}
