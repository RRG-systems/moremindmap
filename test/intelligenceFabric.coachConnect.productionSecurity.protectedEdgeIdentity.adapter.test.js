import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import assert from 'node:assert/strict';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';
import {
  ASYNC_SECURITY_STATE_CONTRACT_VERSION,
  PROTECTED_EDGE_IDENTITY_ADAPTER_ID,
  PROTECTED_EDGE_IDENTITY_BINDING_CONTRACT_VERSION,
  PROTECTED_EDGE_IDENTITY_CONFIGURATION_VERSION,
  createProtectedEdgeIdentityBindingV1,
  createProtectedEdgeReplayProtectorV1,
  createSyntheticAsyncSecurityBackend,
  createSyntheticAsyncSecurityStateAdapter,
  issueProtectedEdgeInternalAssertionV1,
  protectedEdgeIdentityConfigurationDigest,
  protectedEdgeIdentityPolicyDigest,
  verifyProtectedEdgeInternalAssertionV1,
  verifyProtectedEdgeUpstreamJwtV1,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js';

const now = Date.parse('2026-07-28T12:00:00.000Z');
const nowSeconds = Math.floor(now / 1000);
const identityHashKey = 'synthetic-identity-hash-key-material-000000000000';
const signingKey = 'synthetic-internal-signing-key-material-0000000000';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const publicJwk = {
  ...publicKey.export({ format: 'jwk' }),
  kid: 'synthetic-key-1',
  use: 'sig',
  alg: 'RS256',
};
const jwks = { keys: [publicJwk] };

function configuration(overrides = {}) {
  const initial = {
    config_version: PROTECTED_EDGE_IDENTITY_CONFIGURATION_VERSION,
    enabled: true,
    emergency_disabled: false,
    adapter_id: PROTECTED_EDGE_IDENTITY_ADAPTER_ID,
    contract_version: PROTECTED_EDGE_IDENTITY_BINDING_CONTRACT_VERSION,
    provider_type: 'AUTH0_OIDC_JWT',
    token_source: 'AUTHORIZATION_BEARER',
    issuer: 'https://identity.synthetic.example/',
    audiences: ['https://edge.synthetic.example/'],
    jwks_ref: 'MORE_PRIVATE_RUNTIME_PROTECTED_EDGE_JWKS_VALUE',
    jwks_sha256: hashCanonicalJson(jwks),
    allowed_algorithms: ['RS256'],
    subject_claim: 'sub',
    token_id_claim: 'jti',
    authentication_time_claim: 'auth_time',
    mfa_claim: 'amr',
    acr_claim: 'acr',
    accepted_mfa_values: ['mfa', 'otp'],
    accepted_acr_values: ['urn:more:mfa'],
    mfa_required: true,
    environment_id: 'private_live_synthetic',
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
    ...overrides,
  };
  const policyBound = {
    ...initial,
    protected_edge_policy_digest: protectedEdgeIdentityPolicyDigest(initial),
  };
  return {
    ...policyBound,
    configuration_sha256: protectedEdgeIdentityConfigurationDigest(policyBound),
  };
}

function jwt({
  claims = {},
  header = {},
  signingPrivateKey = privateKey,
} = {}) {
  const protectedHeader = {
    alg: 'RS256',
    typ: 'JWT',
    kid: publicJwk.kid,
    ...header,
  };
  const payload = {
    iss: 'https://identity.synthetic.example/',
    aud: 'https://edge.synthetic.example/',
    sub: 'synthetic-upstream-subject',
    jti: 'synthetic-token-identifier',
    iat: nowSeconds - 5,
    nbf: nowSeconds - 5,
    exp: nowSeconds + 300,
    auth_time: nowSeconds - 10,
    amr: ['mfa'],
    email: 'not-logged@example.invalid',
    email_verified: true,
    ...claims,
  };
  const encoded = [
    Buffer.from(JSON.stringify(protectedHeader), 'utf8').toString('base64url'),
    Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url'),
  ];
  const signature = crypto.sign(
    'RSA-SHA256',
    Buffer.from(encoded.join('.'), 'utf8'),
    signingPrivateKey,
  ).toString('base64url');
  return [...encoded, signature].join('.');
}

function state({ availability = 'HEALTHY' } = {}) {
  const backend = createSyntheticAsyncSecurityBackend(null, {
    clock: () => now,
  });
  backend.availability = availability;
  return {
    backend,
    port: createSyntheticAsyncSecurityStateAdapter({
      backend,
      environment_id: 'private_live_synthetic',
      clock: () => now,
    }),
  };
}

function resolver({
  jwksValue = JSON.stringify(jwks),
  identityKey = identityHashKey,
  assertionKey = signingKey,
} = {}) {
  return async (reference) => ({
    MORE_PRIVATE_RUNTIME_PROTECTED_EDGE_JWKS_VALUE: jwksValue,
    MORE_PRIVATE_RUNTIME_IDENTITY_HASH_KEY_VALUE: identityKey,
    MORE_PRIVATE_RUNTIME_EDGE_ASSERTION_KEY_VALUE: assertionKey,
  })[reference] ?? null;
}

async function binding(options = {}) {
  const security = options.security || state();
  return {
    security,
    adapter: await createProtectedEdgeIdentityBindingV1({
      configuration: options.configuration || configuration(),
      resolveReference: options.resolveReference || resolver(),
      statePort: security.port,
      clock: () => now,
      assertionIdFactory: options.assertionIdFactory,
      transactionIdFactory: options.transactionIdFactory,
    }),
  };
}

function request(token, overrides = {}) {
  return {
    method: 'POST',
    url: '/api/internal/private-runtime-login',
    headers: {
      authorization: `Bearer ${token}`,
      ...overrides,
    },
  };
}

test('valid upstream JWT becomes only a verified internal edge identity', async () => {
  const { adapter, security } = await binding({
    assertionIdFactory: () => 'edge_assertion_synthetic_valid',
  });
  const raw = jwt();
  const result = await adapter.bindRequest(request(raw), {
    correlationRef: 'correlation_edge_valid',
  });
  assert.equal(result.allowed, true, JSON.stringify(result));
  assert.equal(result.edge_attestation.named_identity_verified, true);
  assert.equal(result.edge_attestation.mfa_verified, true);
  assert.equal(result.edge_attestation.public_access, false);
  assert.equal(result.identity_receipt.entitlement_authority, false);
  assert.equal(result.identity_receipt.tester_authority, false);
  assert.equal(result.identity_receipt.profile_id_authority, false);
  assert.equal(result.internal_assertion_exposed, false);
  assert.equal(JSON.stringify(result).includes(raw), false);
  assert.equal(JSON.stringify(security.backend.snapshot || {}).includes(raw), false);
});

test('missing, malformed, unsigned, algorithm-downgraded, and invalid signatures deny', async () => {
  const invalidRsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const cases = [
    { headers: {} },
    request('not-a-jwt'),
    request(`${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{}').toString('base64url')}.x`),
    request(jwt({ header: { alg: 'HS256' } })),
    request(jwt({ signingPrivateKey: invalidRsa.privateKey })),
  ];
  for (const req of cases) {
    const { adapter } = await binding();
    const result = await adapter.bindRequest(req, {
      correlationRef: 'correlation_edge_invalid',
    });
    assert.equal(result.allowed, false);
    assert.match(result.code, /^PROTECTED_EDGE_/);
  }
});

test('issuer, audience, time, subject, key id, and MFA failures are explicit denials', async () => {
  const cases = [
    [jwt({ claims: { iss: 'https://wrong.synthetic.example/' } }), 'PROTECTED_EDGE_ISSUER_MISMATCH'],
    [jwt({ claims: { aud: 'wrong-audience' } }), 'PROTECTED_EDGE_AUDIENCE_MISMATCH'],
    [jwt({
      claims: {
        iat: nowSeconds - 120,
        nbf: nowSeconds - 120,
        exp: nowSeconds - 60,
        auth_time: nowSeconds - 130,
      },
    }), 'PROTECTED_EDGE_TOKEN_EXPIRED'],
    [jwt({
      claims: {
        nbf: nowSeconds + 300,
        exp: nowSeconds + 600,
      },
    }), 'PROTECTED_EDGE_TOKEN_NOT_YET_VALID'],
    [jwt({ claims: { iat: nowSeconds - 900 } }), 'PROTECTED_EDGE_TOKEN_STALE'],
    [jwt({ claims: { sub: '' } }), 'PROTECTED_EDGE_SUBJECT_MISSING'],
    [jwt({ header: { kid: 'unknown-key' } }), 'PROTECTED_EDGE_KEY_ID_UNKNOWN'],
    [jwt({ header: { kid: '' } }), 'PROTECTED_EDGE_KEY_ID_MISSING'],
    [jwt({ claims: { amr: [], acr: 'urn:no:mfa' } }), 'PROTECTED_EDGE_MFA_REQUIRED'],
  ];
  for (const [raw, code] of cases) {
    const { adapter } = await binding();
    const result = await adapter.bindRequest(request(raw), {
      correlationRef: `correlation_${code.toLowerCase()}`,
    });
    assert.equal(result.code, code, JSON.stringify(result));
  }
});

test('conflicting sources, query tokens, and browser internal assertions deny', async () => {
  const raw = jwt();
  const requests = [
    request(raw, { 'x-vercel-oidc-passport-token': raw }),
    { ...request(raw), url: '/api/internal/private-runtime-login?token=forbidden' },
    request(raw, { 'x-more-protected-edge-assertion': 'browser-spoof' }),
    request(raw, { 'x-more-protected-edge-session': 'browser-spoof' }),
    request(raw, { 'x-more-deployment-id': 'browser-spoof' }),
  ];
  for (const req of requests) {
    const { adapter } = await binding();
    const result = await adapter.bindRequest(req, {
      correlationRef: 'correlation_edge_sources',
    });
    assert.equal(result.allowed, false);
  }
});

test('one-time upstream replay is denied atomically and outage has no fallback', async () => {
  const firstBinding = await binding();
  const raw = jwt();
  const first = await firstBinding.adapter.bindRequest(request(raw), {
    correlationRef: 'correlation_edge_replay_first',
  });
  const replay = await firstBinding.adapter.bindRequest(request(raw), {
    correlationRef: 'correlation_edge_replay_second',
  });
  assert.equal(first.allowed, true);
  assert.equal(replay.code, 'PROTECTED_EDGE_REPLAY_DETECTED');

  const unavailable = await binding({ security: state({ availability: 'UNAVAILABLE' }) });
  const outage = await unavailable.adapter.bindRequest(request(jwt({
    claims: { jti: 'outage-token-id' },
  })), {
    correlationRef: 'correlation_edge_outage',
  });
  assert.equal(outage.code, 'PROTECTED_EDGE_REPLAY_STATE_UNAVAILABLE');
});

test('session-bound replay is one-use and bound to a server-generated transaction', async () => {
  let transaction = 0;
  const { adapter } = await binding({
    configuration: configuration({ replay_mode: 'SESSION_BOUND' }),
    transactionIdFactory: () => `trusted_server_transaction_${transaction += 1}`,
  });
  const raw = jwt({ claims: { jti: 'session-bound-token-id' } });
  const first = await adapter.bindRequest(request(raw), {
    correlationRef: 'correlation_session_bound_first',
  });
  const crossRoute = await adapter.bindRequest({
    ...request(raw),
    method: 'GET',
    url: '/api/internal/private-runtime-session',
  }, {
    correlationRef: 'correlation_session_bound_second',
  });
  assert.equal(first.allowed, true);
  assert.equal(crossRoute.allowed, false);
});

test('session-bound mode rejects missing, malformed, and browser-spoofed bindings', async () => {
  for (const transactionIdFactory of [
    () => null,
    () => 'short',
    () => 'browser supplied value',
  ]) {
    const { adapter } = await binding({
      configuration: configuration({ replay_mode: 'SESSION_BOUND' }),
      transactionIdFactory,
    });
    const result = await adapter.bindRequest(request(jwt({
      claims: { jti: `binding-${String(transactionIdFactory()).replaceAll(' ', '-')}` },
    })));
    assert.equal(result.code, 'PROTECTED_EDGE_TRUSTED_TRANSACTION_REQUIRED');
  }

  const { adapter } = await binding({
    configuration: configuration({ replay_mode: 'SESSION_BOUND' }),
    transactionIdFactory: () => 'trusted_server_transaction_browser_spoof',
  });
  const spoofed = await adapter.bindRequest(request(jwt({
    claims: { jti: 'browser-spoofed-session-binding' },
  }), {
    'x-more-protected-edge-transaction': 'browser-controlled-transaction',
  }));
  assert.equal(spoofed.code, 'PROTECTED_EDGE_AUTHORITY_BINDING_SPOOFED');
});

test('session-bound concurrent replay has one winner and invalidated reuse denies', async () => {
  let transaction = 0;
  const { adapter } = await binding({
    configuration: configuration({ replay_mode: 'SESSION_BOUND' }),
    transactionIdFactory: () => `trusted_server_transaction_race_${transaction += 1}`,
  });
  const raw = jwt({ claims: { jti: 'session-bound-race-token-id' } });
  const raced = await Promise.all([
    adapter.bindRequest(request(raw), {
      correlationRef: 'correlation_session_bound_race_a',
    }),
    adapter.bindRequest(request(raw), {
      correlationRef: 'correlation_session_bound_race_b',
    }),
  ]);
  assert.equal(raced.filter((result) => result.allowed).length, 1);
  const afterInvalidation = await adapter.bindRequest(request(raw), {
    correlationRef: 'correlation_session_bound_after_invalidation',
  });
  assert.equal(afterInvalidation.allowed, false);
});

test('internal assertion is short-lived, environment-bound, deployment-bound, and one-time', async () => {
  const config = configuration();
  const security = state();
  const replayProtector = createProtectedEdgeReplayProtectorV1({
    statePort: security.port,
    environmentId: config.environment_id,
    clock: () => now,
  });
  const identity = {
    canonical_subject_ref: 'edge_subject_synthetic',
    issuer_provenance_ref: 'edge_issuer_synthetic',
    audience_policy_ref: 'edge_audience_synthetic',
    token_identifier_ref: 'edge_token_synthetic',
    authenticated_at: new Date(now - 1000).toISOString(),
    expires_at: new Date(now + 300_000).toISOString(),
    mfa_verified: true,
    named_identity_verified: true,
  };
  const contextHash = 'b'.repeat(64);
  const issued = issueProtectedEdgeInternalAssertionV1({
    identity,
    configuration: config,
    signingKey,
    bindingContextHash: contextHash,
    clock: () => now,
    assertionIdFactory: () => 'edge_assertion_internal_test',
  });
  const first = await verifyProtectedEdgeInternalAssertionV1({
    serialized: issued.serialized,
    configuration: config,
    signingKey,
    replayProtector,
    correlationRef: 'correlation_internal_first',
    bindingContextHash: contextHash,
    clock: () => now,
  });
  const replay = await verifyProtectedEdgeInternalAssertionV1({
    serialized: issued.serialized,
    configuration: config,
    signingKey,
    replayProtector,
    correlationRef: 'correlation_internal_replay',
    bindingContextHash: contextHash,
    clock: () => now,
  });
  const mismatch = await verifyProtectedEdgeInternalAssertionV1({
    serialized: issued.serialized,
    configuration: configuration({ deployment_id: 'e'.repeat(64) }),
    signingKey,
    replayProtector,
    correlationRef: 'correlation_internal_mismatch',
    bindingContextHash: contextHash,
    clock: () => now,
  });
  assert.equal(first.allowed, true);
  assert.equal(replay.code, 'PROTECTED_EDGE_REPLAY_DETECTED');
  assert.equal(mismatch.allowed, false);
});

test('cross-deployment and cross-environment assertion replay deny', async () => {
  const security = state();
  const raw = jwt({ claims: { jti: 'cross-deployment-token-id' } });
  const firstBinding = await binding({
    security,
    configuration: configuration({ deployment_id: '1'.repeat(64) }),
  });
  const secondBinding = await binding({
    security,
    configuration: configuration({ deployment_id: '2'.repeat(64) }),
  });
  const first = await firstBinding.adapter.bindRequest(request(raw), {
    correlationRef: 'correlation_cross_deployment_first',
  });
  const crossDeployment = await secondBinding.adapter.bindRequest(request(raw), {
    correlationRef: 'correlation_cross_deployment_second',
  });
  assert.equal(first.allowed, true);
  assert.equal(crossDeployment.allowed, false);

  const config = configuration({ deployment_id: '3'.repeat(64) });
  const replayProtector = createProtectedEdgeReplayProtectorV1({
    statePort: security.port,
    environmentId: config.environment_id,
    clock: () => now,
  });
  const identity = {
    canonical_subject_ref: 'edge_subject_cross_environment',
    issuer_provenance_ref: 'edge_issuer_cross_environment',
    audience_policy_ref: 'edge_audience_cross_environment',
    token_identifier_ref: 'edge_token_cross_environment',
    authenticated_at: new Date(now - 1000).toISOString(),
    expires_at: new Date(now + 300_000).toISOString(),
    mfa_verified: true,
    named_identity_verified: true,
  };
  const issued = issueProtectedEdgeInternalAssertionV1({
    identity,
    configuration: config,
    signingKey,
    bindingContextHash: 'c'.repeat(64),
    clock: () => now,
    assertionIdFactory: () => 'edge_assertion_cross_environment',
  });
  const crossEnvironment = await verifyProtectedEdgeInternalAssertionV1({
    serialized: issued.serialized,
    configuration: configuration({
      environment_id: 'other_private_environment',
      deployment_id: config.deployment_id,
    }),
    signingKey,
    replayProtector,
    correlationRef: 'correlation_cross_environment',
    bindingContextHash: 'c'.repeat(64),
    clock: () => now,
  });
  assert.equal(crossEnvironment.allowed, false);
});

test('temporal contradictions and malformed NumericDate claims deny independent of skew', () => {
  const invalidClaims = [
    { iat: nowSeconds + 10, exp: nowSeconds + 5 },
    { iat: nowSeconds - 5, nbf: nowSeconds + 5, exp: nowSeconds + 5 },
    { iat: nowSeconds - 5, nbf: nowSeconds + 10, exp: nowSeconds + 5 },
    { iat: nowSeconds - 5, exp: nowSeconds + 5, auth_time: nowSeconds + 6 },
    { iat: 'not-a-number' },
    { exp: Number.NaN },
    { nbf: [] },
    { auth_time: {} },
  ];
  for (const [index, claims] of invalidClaims.entries()) {
    const result = verifyProtectedEdgeUpstreamJwtV1({
      serialized: jwt({
        claims: {
          ...claims,
          jti: `temporal-invalid-${index}`,
        },
      }),
      configuration: configuration(),
      jwks,
      clock: () => now,
    });
    assert.equal(result.code, 'PROTECTED_EDGE_TOKEN_TEMPORAL_INVALID');
  }

  const validSkew = verifyProtectedEdgeUpstreamJwtV1({
    serialized: jwt({
      claims: {
        jti: 'temporal-valid-skew',
        iat: nowSeconds + 20,
        nbf: nowSeconds + 20,
        exp: nowSeconds + 60,
        auth_time: nowSeconds,
      },
    }),
    configuration: configuration(),
    jwks,
    clock: () => now,
  });
  assert.equal(validSkew.ok, true);
});

test('internal assertion temporal ordering fails closed', async () => {
  const config = configuration();
  const security = state();
  const replayProtector = createProtectedEdgeReplayProtectorV1({
    statePort: security.port,
    environmentId: config.environment_id,
    clock: () => now,
  });
  const issued = issueProtectedEdgeInternalAssertionV1({
    identity: {
      canonical_subject_ref: 'edge_subject_internal_temporal',
      issuer_provenance_ref: 'edge_issuer_internal_temporal',
      audience_policy_ref: 'edge_audience_internal_temporal',
      token_identifier_ref: 'edge_token_internal_temporal',
      authenticated_at: new Date(now - 1000).toISOString(),
      expires_at: new Date(now + 300_000).toISOString(),
      mfa_verified: true,
      named_identity_verified: true,
    },
    configuration: config,
    signingKey,
    bindingContextHash: 'a'.repeat(64),
    clock: () => now,
    assertionIdFactory: () => 'edge_assertion_internal_temporal',
  });
  const [payloadPart] = issued.serialized.split('.');
  const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
  payload.issued_at = new Date(now + 10_000).toISOString();
  payload.expires_at = new Date(now + 5_000).toISOString();
  const contradictoryPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const contradictorySignature = crypto.createHmac('sha256', signingKey)
    .update(contradictoryPayload)
    .digest('base64url');
  const result = await verifyProtectedEdgeInternalAssertionV1({
    serialized: `${contradictoryPayload}.${contradictorySignature}`,
    configuration: config,
    signingKey,
    replayProtector,
    correlationRef: 'correlation_internal_temporal',
    bindingContextHash: 'a'.repeat(64),
    clock: () => now,
  });
  assert.equal(result.allowed, false);
});

test('JWKS and signing material resolution is static, required, and fail closed', async () => {
  for (const options of [
    { jwksValue: JSON.stringify({ keys: [] }) },
    { jwksValue: null },
    { identityKey: 'short' },
    { assertionKey: 'short' },
  ]) {
    const { adapter } = await binding({ resolveReference: resolver(options) });
    assert.equal(adapter.configured, false);
    assert.equal((await adapter.bindRequest(request(jwt()))).allowed, false);
  }
});

test('emergency disable dominates before token verification or replay work', async () => {
  const security = state();
  const { adapter } = await binding({
    security,
    configuration: configuration({ emergency_disabled: true }),
  });
  const result = await adapter.bindRequest(request(jwt()));
  assert.equal(result.code, 'EMERGENCY_DISABLED');
  assert.equal(security.backend.replays.size, 0);
});

test('upstream verifier output is bounded and never exposes raw JWT or full email', () => {
  const config = configuration();
  const raw = jwt();
  const result = verifyProtectedEdgeUpstreamJwtV1({
    serialized: raw,
    configuration: config,
    jwks,
    clock: () => now,
  });
  assert.equal(result.ok, true);
  assert.equal(result.verified_claims.verified_email_present, true);
  assert.equal('email' in result.verified_claims, false);
  assert.equal(JSON.stringify(result).includes(raw), false);
  assert.equal(JSON.stringify(result).includes('not-logged@example.invalid'), false);
});
