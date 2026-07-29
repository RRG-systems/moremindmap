import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASYNC_SECURITY_STATE_CONTRACT_VERSION,
  PROTECTED_EDGE_IDENTITY_ADAPTER_ID,
  PROTECTED_EDGE_IDENTITY_BINDING_CONTRACT_VERSION,
  PROTECTED_EDGE_IDENTITY_CONFIGURATION_VERSION,
  describeProtectedEdgeIdentityBindingCapabilityV1,
  protectedEdgeIdentityConfigurationDigest,
  protectedEdgeIdentityPolicyDigest,
  validateProtectedEdgeIdentityConfigurationV1,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js';

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
    jwks_sha256: 'a'.repeat(64),
    allowed_algorithms: ['RS256'],
    subject_claim: 'sub',
    token_id_claim: 'jti',
    authentication_time_claim: 'auth_time',
    mfa_claim: 'amr',
    acr_claim: 'acr',
    accepted_mfa_values: ['mfa'],
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
    replay_mode: 'SESSION_BOUND',
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

test('provider-neutral configuration is exact, policy-bound, and source-default-off', () => {
  const value = configuration();
  const result = validateProtectedEdgeIdentityConfigurationV1(value, {
    environmentId: value.environment_id,
    deploymentId: value.deployment_id,
    policyDigest: value.protected_edge_policy_digest,
    internalSigningKeyRef: value.internal_signing_key_ref,
  });
  assert.equal(result.valid, true, JSON.stringify(result));
  const capability = describeProtectedEdgeIdentityBindingCapabilityV1({
    configured: true,
    providerType: value.provider_type,
  });
  assert.equal(capability.provider_neutral, true);
  assert.equal(capability.static_jwks_reference_only, true);
  assert.equal(capability.provider_network_calls, false);
  assert.equal(capability.entitlement_authority, false);
  assert.equal(capability.tester_authority, false);
  assert.equal(capability.profile_id_authority, false);
  assert.equal(capability.immutable_deployment_identity, true);
  assert.equal(capability.trusted_server_transaction_binding, true);
});

test('configuration and policy digest drift fail closed', () => {
  const value = configuration();
  for (const changed of [
    { ...value, issuer: 'https://other.synthetic.example/' },
    { ...value, protected_edge_policy_digest: 'f'.repeat(64) },
    { ...value, configuration_sha256: 'e'.repeat(64) },
  ]) {
    assert.equal(
      validateProtectedEdgeIdentityConfigurationV1(changed).valid,
      false,
    );
  }
});

test('only RS256 and explicit supported provider profiles are accepted', () => {
  for (const overrides of [
    { allowed_algorithms: ['none'] },
    { allowed_algorithms: ['HS256'] },
    { provider_type: 'UNKNOWN_PROVIDER' },
    { provider_type: 'AUTH0_OIDC_JWT', token_source: 'X_VERCEL_OIDC_PASSPORT_TOKEN' },
  ]) {
    assert.equal(validateProtectedEdgeIdentityConfigurationV1(
      configuration(overrides),
    ).valid, false);
  }
});

test('Vercel Passport profile is configured explicitly rather than inferred', () => {
  const passport = configuration({
    provider_type: 'VERCEL_PASSPORT_JWT',
    token_source: 'X_VERCEL_OIDC_PASSPORT_TOKEN',
    subject_claim: 'external_sub',
  });
  assert.equal(validateProtectedEdgeIdentityConfigurationV1(passport).valid, true);
  assert.equal(validateProtectedEdgeIdentityConfigurationV1(configuration({
    provider_type: 'VERCEL_PASSPORT_JWT',
    token_source: 'X_VERCEL_OIDC_PASSPORT_TOKEN',
    subject_claim: 'sub',
  })).valid, false);
});

test('configuration mismatches for environment, deployment, policy, and signing ref deny', () => {
  const value = configuration();
  for (const expected of [
    { environmentId: 'other_environment' },
    { deploymentId: 'e'.repeat(64) },
    { policyDigest: 'f'.repeat(64) },
    { internalSigningKeyRef: 'MORE_PRIVATE_RUNTIME_OTHER_SIGNING_KEY' },
  ]) {
    assert.equal(
      validateProtectedEdgeIdentityConfigurationV1(value, expected).valid,
      false,
    );
  }
});

test('deployment identity is an immutable digest and never a project reference or alias', () => {
  assert.equal(validateProtectedEdgeIdentityConfigurationV1(
    configuration({ deployment_id: 'd'.repeat(64) }),
  ).valid, true);
  for (const deploymentId of [
    '',
    'private_project_synthetic',
    'main',
    'private.example.invalid',
    'd'.repeat(63),
  ]) {
    assert.equal(validateProtectedEdgeIdentityConfigurationV1(
      configuration({ deployment_id: deploymentId }),
    ).valid, false);
  }
});
