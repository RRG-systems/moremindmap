import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { deepFreeze } from '../../../validation.js';
import {
  describeLiveSubscriberAssertionCapabilityV1,
  validateLiveSubscriberAssertionConfigurationV1,
} from './contracts.js';
import {
  createOidcTransactionCodecV1,
  OIDC_TRANSACTION_VERSION,
  oidcTransactionHash,
} from './oidcTransaction.js';

const frozen = (value) => deepFreeze(structuredClone(value));
const deny = (code, status = 401) => frozen({
  ok: false,
  allowed: false,
  code,
  status,
  raw_assertion_present: false,
  raw_token_persisted: false,
});
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
const base64urlJson = (value) => {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

async function fetchWithDeadline(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function validMfa(claims) {
  const amr = Array.isArray(claims?.amr) ? claims.amr : [];
  return amr.includes('mfa')
    || amr.includes('otp')
    || amr.includes('hwk')
    || (typeof claims?.acr === 'string' && /mfa|multi/i.test(claims.acr));
}

function audienceMatches(claims, expected) {
  return claims?.aud === expected
    || (Array.isArray(claims?.aud) && claims.aud.includes(expected));
}

function verifyJwtSignature(idToken, jwk) {
  const parts = idToken.split('.');
  if (parts.length !== 3) return false;
  try {
    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    return crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8'),
      publicKey,
      Buffer.from(parts[2], 'base64url'),
    );
  } catch {
    return false;
  }
}

export async function createAuth0LiveSubscriberAssertionAdapterV1({
  configuration,
  resolveSecretReference,
  fetchImpl = globalThis.fetch,
  clock = () => Date.now(),
  tokenFactory = async (kind) => `${kind}_${randomToken(32)}`,
} = {}) {
  const checked = validateLiveSubscriberAssertionConfigurationV1(configuration);
  if (!checked.valid
    || typeof resolveSecretReference !== 'function'
    || typeof fetchImpl !== 'function') {
    return Object.freeze({
      configured: false,
      describeCapability: () => describeLiveSubscriberAssertionCapabilityV1({
        configured: false,
      }),
      beginAuthorization: async () => deny('OIDC_CONFIGURATION_UNAVAILABLE', 503),
      verify: async () => deny('OIDC_CONFIGURATION_UNAVAILABLE', 503),
    });
  }

  const transactionKey = await resolveSecretReference(configuration.transaction_key_ref, {
    purpose: 'OIDC_TRANSACTION_KEY',
    secret: true,
  });
  const identityHashKey = await resolveSecretReference(configuration.identity_hash_key_ref, {
    purpose: 'OIDC_IDENTITY_HASH_KEY',
    secret: true,
  });
  const clientSecret = await resolveSecretReference(configuration.client_secret_ref, {
    purpose: 'OIDC_CLIENT_SECRET',
    secret: true,
  });
  if (typeof transactionKey !== 'string' || transactionKey.length < 32
    || typeof identityHashKey !== 'string' || identityHashKey.length < 32
    || typeof clientSecret !== 'string' || clientSecret.length < 16) {
    return Object.freeze({
      configured: false,
      describeCapability: () => describeLiveSubscriberAssertionCapabilityV1({
        configured: false,
      }),
      beginAuthorization: async () => deny('OIDC_CONFIGURATION_UNAVAILABLE', 503),
      verify: async () => deny('OIDC_CONFIGURATION_UNAVAILABLE', 503),
    });
  }
  const codec = createOidcTransactionCodecV1({
    keyMaterial: transactionKey,
    clock,
  });

  async function makeToken(kind) {
    const returned = tokenFactory(kind);
    if (!returned || typeof returned.then !== 'function') return null;
    try {
      const value = await returned;
      return typeof value === 'string' && value.length >= 32 ? value : null;
    } catch {
      return null;
    }
  }

  return Object.freeze({
    configured: true,
    describeCapability: () => describeLiveSubscriberAssertionCapabilityV1({
      configured: true,
    }),

    async beginAuthorization(input) {
      if (input?.edge_attestation?.named_identity_verified !== true
        || input?.edge_attestation?.mfa_verified !== true
        || input?.edge_attestation?.public_access !== false
        || input.edge_attestation.policy_digest
          !== configuration.protected_edge_policy_digest
        || typeof input.pre_auth_session_ref !== 'string'
        || !/^[a-f0-9]{64}$/.test(input.browser_binding_hash || '')) {
        return deny('PROTECTED_EDGE_IDENTITY_REQUIRED');
      }
      const state = await makeToken('oidc_state');
      const nonce = await makeToken('oidc_nonce');
      const pkceVerifier = await makeToken('oidc_pkce');
      if (!state || !nonce || !pkceVerifier) {
        return deny('OIDC_CONFIGURATION_UNAVAILABLE', 503);
      }
      const issuedAt = new Date(clock()).toISOString();
      const expiresAt = new Date(clock() + configuration.transaction_ttl_ms).toISOString();
      const transaction = {
        transaction_version: OIDC_TRANSACTION_VERSION,
        pre_auth_session_ref: input.pre_auth_session_ref,
        state_hash: oidcTransactionHash(state),
        nonce_hash: oidcTransactionHash(nonce),
        pkce_verifier: pkceVerifier.slice(0, 128),
        browser_binding_hash: input.browser_binding_hash,
        environment_id: configuration.environment_id,
        issued_at: issuedAt,
        expires_at: expiresAt,
        ...(input.rotation_parent_session_token_hash == null
          && input.rotation_parent_reference == null
          ? {}
          : {
              rotation_parent_session_token_hash:
                input.rotation_parent_session_token_hash,
              rotation_parent_reference: input.rotation_parent_reference,
            }),
      };
      const challenge = crypto.createHash('sha256')
        .update(transaction.pkce_verifier)
        .digest('base64url');
      const url = new URL(configuration.authorization_endpoint);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('client_id', configuration.client_id);
      url.searchParams.set('redirect_uri', configuration.redirect_uri);
      url.searchParams.set('audience', configuration.audience);
      url.searchParams.set('scope', 'openid');
      url.searchParams.set('state', state);
      url.searchParams.set('nonce', nonce);
      url.searchParams.set('code_challenge', challenge);
      url.searchParams.set('code_challenge_method', 'S256');
      url.searchParams.set('prompt', 'login');
      return frozen({
        ok: true,
        allowed: false,
        status: 200,
        authorization_url: url.toString(),
        transaction_cookie_value: codec.seal(transaction),
        pre_auth_session_ref: input.pre_auth_session_ref,
        expires_at: expiresAt,
        authority_granted: false,
        raw_assertion_present: false,
        raw_token_persisted: false,
      });
    },

    async verify(input) {
      if (input?.edge_attestation?.named_identity_verified !== true
        || input?.edge_attestation?.mfa_verified !== true
        || input?.edge_attestation?.public_access !== false
        || input.edge_attestation.policy_digest
          !== configuration.protected_edge_policy_digest) {
        return deny('PROTECTED_EDGE_IDENTITY_REQUIRED');
      }
      const transaction = codec.open(input.transaction_cookie_value);
      if (!transaction
        || transaction.environment_id !== configuration.environment_id
        || (input.pre_auth_session_ref != null
          && transaction.pre_auth_session_ref !== input.pre_auth_session_ref)
        || transaction.browser_binding_hash !== input.browser_binding_hash) {
        return deny('OIDC_STATE_INVALID');
      }
      if (typeof input.state !== 'string'
        || oidcTransactionHash(input.state) !== transaction.state_hash) {
        return deny('OIDC_STATE_INVALID');
      }
      if (typeof input.code !== 'string' || input.code.length < 8 || input.code.length > 2048) {
        return deny('OIDC_PKCE_INVALID');
      }

      try {
        const tokenResponse = await fetchWithDeadline(
          fetchImpl,
          configuration.token_endpoint,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              client_id: configuration.client_id,
              client_secret: clientSecret,
              code: input.code,
              redirect_uri: configuration.redirect_uri,
              code_verifier: transaction.pkce_verifier,
            }).toString(),
          },
          configuration.request_timeout_ms,
        );
        if (!tokenResponse?.ok) return deny('OIDC_ASSERTION_INVALID');
        const tokenBody = await tokenResponse.json();
        const idToken = tokenBody?.id_token;
        if (typeof idToken !== 'string' || idToken.length > 16384) {
          return deny('OIDC_ASSERTION_INVALID');
        }
        const parts = idToken.split('.');
        if (parts.length !== 3) return deny('OIDC_ASSERTION_INVALID');
        const header = base64urlJson(parts[0]);
        const claims = base64urlJson(parts[1]);
        if (!header || !claims
          || header.alg !== 'RS256'
          || typeof header.kid !== 'string') {
          return deny('OIDC_SIGNATURE_INVALID');
        }
        const jwksResponse = await fetchWithDeadline(
          fetchImpl,
          configuration.jwks_uri,
          { method: 'GET', headers: { Accept: 'application/json' } },
          configuration.request_timeout_ms,
        );
        if (!jwksResponse?.ok) return deny('OIDC_PROVIDER_TIMEOUT', 503);
        const jwks = await jwksResponse.json();
        const matchingKeys = Array.isArray(jwks?.keys)
          ? jwks.keys.filter((key) => key?.kid === header.kid
            && key?.kty === 'RSA'
            && (key?.use == null || key.use === 'sig'))
          : [];
        if (matchingKeys.length !== 1 || !verifyJwtSignature(idToken, matchingKeys[0])) {
          return deny('OIDC_SIGNATURE_INVALID');
        }

        const nowSeconds = Math.floor(clock() / 1000);
        const skew = configuration.clock_skew_seconds;
        if (claims.iss !== configuration.issuer) return deny('OIDC_ISSUER_MISMATCH');
        if (!audienceMatches(claims, configuration.audience)) {
          return deny('OIDC_AUDIENCE_MISMATCH');
        }
        if (!Number.isInteger(claims.exp) || claims.exp + skew < nowSeconds
          || !Number.isInteger(claims.iat) || claims.iat - skew > nowSeconds
          || (claims.nbf != null
            && (!Number.isInteger(claims.nbf) || claims.nbf - skew > nowSeconds))) {
          return deny('OIDC_ASSERTION_EXPIRED');
        }
        if (typeof claims.nonce !== 'string'
          || oidcTransactionHash(claims.nonce) !== transaction.nonce_hash) {
          return deny('OIDC_NONCE_INVALID');
        }
        if (typeof claims.sub !== 'string' || claims.sub.length < 3 || claims.sub.length > 512) {
          return deny('OIDC_ASSERTION_INVALID');
        }
        if (configuration.mfa_required && !validMfa(claims)) {
          return deny('OIDC_MFA_REQUIRED');
        }
        const externalSubjectRef = `external_subject_${crypto
          .createHmac('sha256', identityHashKey)
          .update(`${configuration.issuer}\0${claims.sub}`, 'utf8')
          .digest('hex')}`;
        const authenticatedAt = Number.isInteger(claims.auth_time)
          ? new Date(claims.auth_time * 1000).toISOString()
          : new Date(claims.iat * 1000).toISOString();
        return frozen({
          ok: true,
          allowed: false,
          status: 200,
          verified_assertion: {
            verification_status: 'VERIFIED',
            external_subject_ref: externalSubjectRef,
            exact_scope_hash: configuration.exact_scope_hash,
            named_identity_verified: true,
            mfa_verified: true,
            issuer_policy_ref: `issuer_policy_${configuration.configuration_sha256.slice(0, 24)}`,
            audience_policy_ref: `audience_policy_${configuration.configuration_sha256.slice(24, 48)}`,
            authenticated_at: authenticatedAt,
            assertion_receipt_ref: `assertion_receipt_${oidcTransactionHash(
              `${externalSubjectRef}\0${transaction.pre_auth_session_ref}\0${claims.iat}`,
            ).slice(0, 32)}`,
          },
          rotation_parent_session_token_hash:
            transaction.rotation_parent_session_token_hash,
          rotation_parent_reference: transaction.rotation_parent_reference,
          raw_assertion_present: false,
          raw_token_persisted: false,
        });
      } catch (cause) {
        return deny(cause?.name === 'AbortError' ? 'OIDC_PROVIDER_TIMEOUT' : 'OIDC_ASSERTION_INVALID',
          cause?.name === 'AbortError' ? 503 : 401);
      }
    },
  });
}
