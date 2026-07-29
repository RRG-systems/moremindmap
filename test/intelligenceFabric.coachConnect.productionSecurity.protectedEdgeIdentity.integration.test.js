import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createPrivateRuntimeLoginHandler,
} from '../api/internal/private-runtime-login.js';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';
import {
  ASYNC_SECURITY_STATE_CONTRACT_VERSION,
  PROTECTED_EDGE_IDENTITY_ADAPTER_ID,
  PROTECTED_EDGE_IDENTITY_BINDING_CONTRACT_VERSION,
  PROTECTED_EDGE_IDENTITY_CONFIGURATION_VERSION,
  createProtectedEdgeIdentityBindingV1,
  createSyntheticAsyncSecurityStateAdapter,
  protectedEdgeIdentityConfigurationDigest,
  protectedEdgeIdentityPolicyDigest,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js';

const now = Date.parse('2026-07-28T12:00:00.000Z');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const jwks = {
  keys: [{
    ...publicKey.export({ format: 'jwk' }),
    kid: 'integration-key',
    use: 'sig',
    alg: 'RS256',
  }],
};

function config() {
  const value = {
    config_version: PROTECTED_EDGE_IDENTITY_CONFIGURATION_VERSION,
    enabled: true,
    emergency_disabled: false,
    adapter_id: PROTECTED_EDGE_IDENTITY_ADAPTER_ID,
    contract_version: PROTECTED_EDGE_IDENTITY_BINDING_CONTRACT_VERSION,
    provider_type: 'AUTH0_OIDC_JWT',
    token_source: 'AUTHORIZATION_BEARER',
    issuer: 'https://identity.integration.example/',
    audiences: ['https://edge.integration.example/'],
    jwks_ref: 'MORE_PRIVATE_RUNTIME_PROTECTED_EDGE_JWKS_VALUE',
    jwks_sha256: hashCanonicalJson(jwks),
    allowed_algorithms: ['RS256'],
    subject_claim: 'sub',
    token_id_claim: 'jti',
    authentication_time_claim: 'auth_time',
    mfa_claim: 'amr',
    acr_claim: 'acr',
    accepted_mfa_values: ['mfa'],
    accepted_acr_values: ['urn:more:mfa'],
    mfa_required: true,
    environment_id: 'private_live_integration',
    deployment_id: 'd'.repeat(64),
    protected_edge_policy_digest: '0'.repeat(64),
    identity_hash_key_ref: 'MORE_PRIVATE_RUNTIME_IDENTITY_HASH_KEY_VALUE',
    internal_signing_key_ref: 'MORE_PRIVATE_RUNTIME_EDGE_ASSERTION_KEY_VALUE',
    clock_skew_seconds: 30,
    max_token_age_seconds: 600,
    internal_assertion_ttl_seconds: 60,
    replay_mode: 'ONE_TIME',
    replay_ttl_seconds: 600,
    replay_store_contract: ASYNC_SECURITY_STATE_CONTRACT_VERSION,
    configuration_sha256: '0'.repeat(64),
  };
  const policy = {
    ...value,
    protected_edge_policy_digest: protectedEdgeIdentityPolicyDigest(value),
  };
  return {
    ...policy,
    configuration_sha256: protectedEdgeIdentityConfigurationDigest(policy),
  };
}

function token() {
  const seconds = Math.floor(now / 1000);
  const header = Buffer.from(JSON.stringify({
    alg: 'RS256',
    kid: 'integration-key',
    typ: 'JWT',
  })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: 'https://identity.integration.example/',
    aud: 'https://edge.integration.example/',
    sub: 'synthetic-integration-subject',
    jti: 'synthetic-integration-token',
    iat: seconds - 5,
    nbf: seconds - 5,
    exp: seconds + 300,
    auth_time: seconds - 10,
    amr: ['mfa'],
  })).toString('base64url');
  const signature = crypto.sign(
    'RSA-SHA256',
    Buffer.from(`${header}.${payload}`),
    privateKey,
  ).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

async function adapter() {
  return createProtectedEdgeIdentityBindingV1({
    configuration: config(),
    resolveReference: async (reference) => ({
      MORE_PRIVATE_RUNTIME_PROTECTED_EDGE_JWKS_VALUE: JSON.stringify(jwks),
      MORE_PRIVATE_RUNTIME_IDENTITY_HASH_KEY_VALUE:
        'integration-identity-hash-key-material-0000000000',
      MORE_PRIVATE_RUNTIME_EDGE_ASSERTION_KEY_VALUE:
        'integration-assertion-signing-key-material-0000000',
    })[reference] ?? null,
    statePort: createSyntheticAsyncSecurityStateAdapter({
      environment_id: 'private_live_integration',
      clock: () => now,
    }),
    clock: () => now,
    assertionIdFactory: () => 'edge_assertion_integration',
  });
}

function response() {
  return {
    headers: {},
    statusCode: null,
    payload: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.payload = value; return this; },
  };
}

test('private login awaits protected-edge binding before pre-auth begins', async () => {
  const identityAdapter = await adapter();
  const sequence = [];
  const handler = createPrivateRuntimeLoginHandler({
    enabled: () => true,
    beginLogin: async (input, req) => {
      sequence.push('verify_upstream_identity');
      const identity = await identityAdapter.bindRequest(req, {
        correlationRef: input.correlation_id,
      });
      if (!identity.allowed) return identity;
      sequence.push('begin_pre_auth');
      return {
        ok: true,
        allowed: true,
        pre_auth_session_ref: 'pre_auth_identity_integration',
        pre_auth_cookie_value: 'pre_auth_cookie_identity_integration',
        browser_binding_cookie_value: input.browser_binding_reference,
        transaction_cookie_value: 'oidc_transaction_identity_integration',
        expires_at: new Date(now + 300_000).toISOString(),
        authority_granted: false,
      };
    },
  });
  const res = response();
  await handler({
    method: 'POST',
    url: '/api/internal/private-runtime-login',
    headers: { authorization: `Bearer ${token()}` },
    body: {
      browser_binding_reference: 'browser_binding_identity_integration',
      correlation_id: 'correlation_identity_integration',
    },
  }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(sequence, ['verify_upstream_identity', 'begin_pre_auth']);
  assert.equal(JSON.stringify(res.payload).includes('Bearer'), false);
  assert.equal(JSON.stringify(res.payload).includes('synthetic-integration-subject'), false);
});

test('verified identity alone grants no entitlement, tester, Profile ID, or runtime authority', async () => {
  const identityAdapter = await adapter();
  const result = await identityAdapter.bindRequest({
    method: 'POST',
    url: '/api/internal/private-runtime-login',
    headers: { authorization: `Bearer ${token()}` },
  }, {
    correlationRef: 'correlation_identity_authority_separation',
  });
  assert.equal(result.allowed, true);
  assert.equal(result.identity_receipt.entitlement_authority, false);
  assert.equal(result.identity_receipt.tester_authority, false);
  assert.equal(result.identity_receipt.profile_id_authority, false);
  assert.equal('runtime_authority' in result.identity_receipt, false);
});

test('spoofed internal assertion never reaches login pre-auth', async () => {
  const identityAdapter = await adapter();
  let preAuthCalls = 0;
  const handler = createPrivateRuntimeLoginHandler({
    enabled: () => true,
    beginLogin: async (input, req) => {
      const identity = await identityAdapter.bindRequest(req, {
        correlationRef: input.correlation_id,
      });
      if (!identity.allowed) return identity;
      preAuthCalls += 1;
      return { ok: true, allowed: true };
    },
  });
  const res = response();
  await handler({
    method: 'POST',
    url: '/api/internal/private-runtime-login',
    headers: {
      authorization: `Bearer ${token()}`,
      'x-more-protected-edge-assertion': 'browser-controlled-value',
    },
    body: {
      browser_binding_reference: 'browser_binding_spoof_integration',
      correlation_id: 'correlation_spoof_integration',
    },
  }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(preAuthCalls, 0);
});

test('one composition root owns the binding; handlers contain no provider verification logic', async () => {
  const root = await readFile(new URL(
    '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/compositionRoot.js',
    import.meta.url,
  ), 'utf8');
  assert.equal(root.includes('createProtectedEdgeIdentityBindingV1'), true);
  assert.equal(root.includes('protectedEdgeBinding.bindRequest'), true);
  assert.equal(root.includes('createProtectedEdgeIdentityAdapter'), false);
  for (const file of [
    '../api/internal/private-runtime-login.js',
    '../api/internal/private-runtime-callback.js',
    '../api/internal/private-runtime-session.js',
    '../api/internal/private-runtime-bootstrap.js',
    '../api/internal/private-runtime-logout.js',
    '../api/internal/developer-access.js',
    '../api/internal/subscription-entitlement.js',
  ]) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.equal(source.includes('jsonwebtoken'), false);
    assert.equal(source.includes('createPublicKey'), false);
    assert.equal(source.includes('x-vercel-oidc-passport-token'), false);
  }
});
