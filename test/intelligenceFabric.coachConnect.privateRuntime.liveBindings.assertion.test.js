import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import {
  createAuth0LiveSubscriberAssertionAdapterV1,
  liveSubscriberAssertionConfigurationDigest,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/liveSubscriberAssertion/index.js';

const now = Date.parse('2026-07-28T12:00:00.000Z');
const scopeHash = 'a'.repeat(64);
const policyDigest = 'b'.repeat(64);

function configuration(overrides = {}) {
  const value = {
    config_version: 'live-subscriber-assertion-configuration-v1',
    enabled: true,
    adapter_id: 'auth0-live-subscriber-assertion-adapter-v1',
    contract_version: 'live-subscriber-assertion-verifier-v1',
    environment_id: 'PRIVATE_PREVIEW',
    issuer: 'https://identity.private.example/',
    audience: 'https://private.runtime.example/',
    client_id: 'private_runtime_client',
    client_secret_ref: 'MORE_PRIVATE_RUNTIME_OIDC_CLIENT_SECRET_VALUE',
    authorization_endpoint: 'https://identity.private.example/authorize',
    token_endpoint: 'https://identity.private.example/oauth/token',
    jwks_uri: 'https://identity.private.example/.well-known/jwks.json',
    redirect_uri: 'https://private.runtime.example/api/internal/private-runtime-callback',
    transaction_key_ref: 'MORE_PRIVATE_RUNTIME_OIDC_TRANSACTION_KEY_VALUE',
    identity_hash_key_ref: 'MORE_PRIVATE_RUNTIME_IDENTITY_HASH_KEY_VALUE',
    exact_scope_hash: scopeHash,
    protected_edge_policy_digest: policyDigest,
    allowed_algorithms: ['RS256'],
    mfa_required: true,
    clock_skew_seconds: 30,
    transaction_ttl_ms: 5 * 60_000,
    request_timeout_ms: 500,
    configuration_sha256: '0'.repeat(64),
    ...overrides,
  };
  return {
    ...value,
    configuration_sha256: liveSubscriberAssertionConfigurationDigest(value),
  };
}

const edge = {
  named_identity_verified: true,
  mfa_verified: true,
  public_access: false,
  policy_digest: policyDigest,
};

function response(ok, body) {
  return {
    ok,
    async json() { return body; },
  };
}

function signJwt(privateKey, kid, claims) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }))
    .toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = crypto.sign(
    'RSA-SHA256',
    Buffer.from(`${header}.${payload}`, 'utf8'),
    privateKey,
  ).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

async function fixture({
  claimOverrides = {},
  fetchOverride = null,
  rotation = null,
} = {}) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const jwk = publicKey.export({ format: 'jwk' });
  const kid = 'private_runtime_signing_key';
  let nonce = null;
  const fetchImpl = fetchOverride || (async (url) => {
    if (String(url).endsWith('/oauth/token')) {
      const issued = Math.floor(now / 1000);
      return response(true, {
        id_token: signJwt(privateKey, kid, {
          iss: 'https://identity.private.example/',
          aud: 'https://private.runtime.example/',
          sub: 'auth0|synthetic-private-subscriber',
          iat: issued,
          exp: issued + 300,
          auth_time: issued,
          nonce,
          amr: ['pwd', 'mfa'],
          ...claimOverrides,
        }),
      });
    }
    return response(true, {
      keys: [{ ...jwk, kid, use: 'sig', alg: 'RS256' }],
    });
  });
  const secrets = {
    MORE_PRIVATE_RUNTIME_OIDC_CLIENT_SECRET_VALUE:
      'synthetic-client-secret-material',
    MORE_PRIVATE_RUNTIME_OIDC_TRANSACTION_KEY_VALUE:
      'synthetic-transaction-key-material-at-least-32',
    MORE_PRIVATE_RUNTIME_IDENTITY_HASH_KEY_VALUE:
      'synthetic-identity-key-material-at-least-32',
  };
  const adapter = await createAuth0LiveSubscriberAssertionAdapterV1({
    configuration: configuration(),
    resolveSecretReference: async (reference) => secrets[reference] || null,
    fetchImpl,
    clock: () => now,
    tokenFactory: async (kind) => `${kind}_${'x'.repeat(52)}`,
  });
  const begun = await adapter.beginAuthorization({
    pre_auth_session_ref: 'pre_auth_private_live',
    browser_binding_hash: 'c'.repeat(64),
    correlation_ref: 'correlation_private_live',
    edge_attestation: edge,
    ...(rotation || {}),
  });
  nonce = new URL(begun.authorization_url).searchParams.get('nonce');
  const state = new URL(begun.authorization_url).searchParams.get('state');
  return { adapter, begun, state };
}

test('Auth0 adapter performs PKCE initiation without granting authority', async () => {
  const { adapter, begun } = await fixture();
  assert.equal(adapter.describeCapability().provider_neutral, true);
  assert.equal(adapter.describeCapability().initial_provider, 'AUTH0');
  assert.equal(begun.ok, true);
  assert.equal(begun.allowed, false);
  assert.equal(begun.authority_granted, false);
  const url = new URL(begun.authorization_url);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('scope'), 'openid');
  assert.equal(JSON.stringify(begun).includes('pkce_verifier'), false);
});

test('verified callback returns only an opaque assertion receipt and subject reference', async () => {
  const { adapter, begun, state } = await fixture();
  const result = await adapter.verify({
    code: 'synthetic_authorization_code',
    state,
    transaction_cookie_value: begun.transaction_cookie_value,
    pre_auth_session_ref: 'pre_auth_private_live',
    browser_binding_hash: 'c'.repeat(64),
    edge_attestation: edge,
  });
  assert.equal(result.ok, true);
  assert.equal(result.verified_assertion.verification_status, 'VERIFIED');
  assert.match(result.verified_assertion.external_subject_ref, /^external_subject_[a-f0-9]{64}$/);
  assert.equal(result.verified_assertion.exact_scope_hash, scopeHash);
  assert.equal(result.raw_assertion_present, false);
  assert.equal(result.raw_token_persisted, false);
  assert.equal(JSON.stringify(result).includes('synthetic_authorization_code'), false);
  assert.equal(JSON.stringify(result).includes('auth0|'), false);
});

test('sealed assertion transaction carries only exact session-rotation references', async () => {
  const rotation = {
    rotation_parent_session_token_hash: 'd'.repeat(64),
    rotation_parent_reference: 'authenticated_session_parent',
  };
  const { adapter, begun, state } = await fixture({ rotation });
  const result = await adapter.verify({
    code: 'synthetic_authorization_code',
    state,
    transaction_cookie_value: begun.transaction_cookie_value,
    pre_auth_session_ref: 'pre_auth_private_live',
    browser_binding_hash: 'c'.repeat(64),
    edge_attestation: edge,
  });
  assert.equal(result.ok, true);
  assert.equal(
    result.rotation_parent_session_token_hash,
    rotation.rotation_parent_session_token_hash,
  );
  assert.equal(result.rotation_parent_reference, rotation.rotation_parent_reference);
  assert.equal(JSON.stringify(begun).includes(rotation.rotation_parent_reference), false);
});

test('state tampering, transaction tampering, and browser mismatch deny', async () => {
  const { adapter, begun, state } = await fixture();
  for (const input of [
    { state: `${state}tampered` },
    { transaction_cookie_value: `${begun.transaction_cookie_value}tampered` },
    { browser_binding_hash: 'd'.repeat(64) },
  ]) {
    const result = await adapter.verify({
      code: 'synthetic_authorization_code',
      state,
      transaction_cookie_value: begun.transaction_cookie_value,
      pre_auth_session_ref: 'pre_auth_private_live',
      browser_binding_hash: 'c'.repeat(64),
      edge_attestation: edge,
      ...input,
    });
    assert.equal(result.ok, false);
  }
});

test('issuer, audience, expiry, nonce, and MFA failures deny', async () => {
  const cases = [
    [{ iss: 'https://wrong.example/' }, 'OIDC_ISSUER_MISMATCH'],
    [{ aud: 'wrong-audience' }, 'OIDC_AUDIENCE_MISMATCH'],
    [{ exp: Math.floor(now / 1000) - 120 }, 'OIDC_ASSERTION_EXPIRED'],
    [{ nonce: 'wrong-nonce' }, 'OIDC_NONCE_INVALID'],
    [{ amr: ['pwd'], acr: 'single_factor' }, 'OIDC_MFA_REQUIRED'],
  ];
  for (const [claimOverrides, code] of cases) {
    const { adapter, begun, state } = await fixture({ claimOverrides });
    const result = await adapter.verify({
      code: 'synthetic_authorization_code',
      state,
      transaction_cookie_value: begun.transaction_cookie_value,
      pre_auth_session_ref: 'pre_auth_private_live',
      browser_binding_hash: 'c'.repeat(64),
      edge_attestation: edge,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, code);
  }
});

test('protected edge is required before authorization or assertion verification', async () => {
  const { adapter, begun, state } = await fixture();
  assert.equal((await adapter.beginAuthorization({
    pre_auth_session_ref: 'pre_auth_private_live',
    browser_binding_hash: 'c'.repeat(64),
    edge_attestation: { ...edge, mfa_verified: false },
  })).code, 'PROTECTED_EDGE_IDENTITY_REQUIRED');
  assert.equal((await adapter.verify({
    code: 'synthetic_authorization_code',
    state,
    transaction_cookie_value: begun.transaction_cookie_value,
    pre_auth_session_ref: 'pre_auth_private_live',
    browser_binding_hash: 'c'.repeat(64),
    edge_attestation: { ...edge, public_access: true },
  })).code, 'PROTECTED_EDGE_IDENTITY_REQUIRED');
});

test('unconfigured secret resolution denies before any provider request', async () => {
  let providerCalls = 0;
  const adapter = await createAuth0LiveSubscriberAssertionAdapterV1({
    configuration: configuration(),
    resolveSecretReference: async () => null,
    fetchImpl: async () => {
      providerCalls += 1;
      return response(false, {});
    },
    clock: () => now,
  });
  assert.equal(adapter.configured, false);
  assert.equal((await adapter.verify({})).code, 'OIDC_CONFIGURATION_UNAVAILABLE');
  assert.equal(providerCalls, 0);
});
