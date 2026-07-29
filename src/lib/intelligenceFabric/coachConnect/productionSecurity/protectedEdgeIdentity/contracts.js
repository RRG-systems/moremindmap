import { hashCanonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';
import {
  ASYNC_SECURITY_STATE_CONTRACT_VERSION,
  isOpaqueAsyncSecurityReference,
} from '../asyncSecurityContracts.js';

export const PROTECTED_EDGE_IDENTITY_BINDING_CONTRACT_VERSION =
  'protected-edge-identity-binding-v1';
export const PROTECTED_EDGE_IDENTITY_CONFIGURATION_VERSION =
  'protected-edge-identity-configuration-v1';
export const PROTECTED_EDGE_IDENTITY_ADAPTER_ID =
  'provider-neutral-protected-edge-identity-adapter-v1';
export const PROTECTED_EDGE_INTERNAL_ASSERTION_VERSION =
  'protected-edge-identity-v1';

export const PROTECTED_EDGE_PROVIDER_TYPES = deepFreeze([
  'VERCEL_PASSPORT_JWT',
  'AUTH0_OIDC_JWT',
  'CONFIGURED_OIDC_JWT',
]);

export const PROTECTED_EDGE_TOKEN_SOURCES = deepFreeze([
  'X_VERCEL_OIDC_PASSPORT_TOKEN',
  'AUTHORIZATION_BEARER',
]);

export const PROTECTED_EDGE_REPLAY_MODES = deepFreeze([
  'ONE_TIME',
  'SESSION_BOUND',
]);

const CONFIGURATION_FIELDS = deepFreeze([
  'config_version',
  'enabled',
  'emergency_disabled',
  'adapter_id',
  'contract_version',
  'provider_type',
  'token_source',
  'issuer',
  'audiences',
  'jwks_ref',
  'jwks_sha256',
  'allowed_algorithms',
  'subject_claim',
  'token_id_claim',
  'authentication_time_claim',
  'mfa_claim',
  'acr_claim',
  'accepted_mfa_values',
  'accepted_acr_values',
  'mfa_required',
  'environment_id',
  'deployment_id',
  'protected_edge_policy_digest',
  'identity_hash_key_ref',
  'internal_signing_key_ref',
  'clock_skew_seconds',
  'max_token_age_seconds',
  'internal_assertion_ttl_seconds',
  'replay_mode',
  'replay_ttl_seconds',
  'replay_store_contract',
  'configuration_sha256',
]);

const object = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const exactFields = (value, fields) => object(value)
  && Object.keys(value).length === fields.length
  && Object.keys(value).every((field) => fields.includes(field));
const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const boundedText = (value, maximum = 512) => typeof value === 'string'
  && value.length > 0
  && value.length <= maximum
  && !/[\r\n\0]/.test(value);
const claimName = (value) => typeof value === 'string'
  && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value);
const https = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};
const frozen = (value) => deepFreeze(structuredClone(value));
const issue = (code, field) => ({ code, field });

function digestWithout(value, field) {
  const copy = { ...value };
  delete copy[field];
  return hashCanonicalJson(copy);
}

export function protectedEdgeIdentityPolicyDigest(configuration) {
  if (!object(configuration)) throw new TypeError('protected-edge configuration required');
  const copy = { ...configuration };
  delete copy.protected_edge_policy_digest;
  delete copy.configuration_sha256;
  return hashCanonicalJson(copy);
}

function boundedUniqueStrings(value, maximumEntries = 16, maximumLength = 256) {
  return Array.isArray(value)
    && value.length > 0
    && value.length <= maximumEntries
    && new Set(value).size === value.length
    && value.every((entry) => boundedText(entry, maximumLength) && !/\s/.test(entry));
}

export function protectedEdgeIdentityConfigurationDigest(configuration) {
  if (!object(configuration)) throw new TypeError('protected-edge configuration required');
  return digestWithout(configuration, 'configuration_sha256');
}

export function validateProtectedEdgeIdentityConfigurationV1(configuration, {
  environmentId = null,
  deploymentId = null,
  policyDigest = null,
  internalSigningKeyRef = null,
} = {}) {
  const errors = [];
  if (!exactFields(configuration, CONFIGURATION_FIELDS)) {
    return frozen({
      valid: false,
      errors: [issue('PROTECTED_EDGE_CONFIGURATION_INVALID', 'fields')],
      value: null,
    });
  }
  if (configuration.config_version !== PROTECTED_EDGE_IDENTITY_CONFIGURATION_VERSION
    || configuration.adapter_id !== PROTECTED_EDGE_IDENTITY_ADAPTER_ID
    || configuration.contract_version !== PROTECTED_EDGE_IDENTITY_BINDING_CONTRACT_VERSION) {
    errors.push(issue('PROTECTED_EDGE_CONFIGURATION_INVALID', 'identity'));
  }
  if (typeof configuration.enabled !== 'boolean'
    || typeof configuration.emergency_disabled !== 'boolean') {
    errors.push(issue('PROTECTED_EDGE_CONFIGURATION_INVALID', 'activation'));
  }
  if (!PROTECTED_EDGE_PROVIDER_TYPES.includes(configuration.provider_type)
    || !PROTECTED_EDGE_TOKEN_SOURCES.includes(configuration.token_source)) {
    errors.push(issue('PROTECTED_EDGE_PROVIDER_UNSUPPORTED', 'provider_type'));
  }
  if (configuration.provider_type === 'VERCEL_PASSPORT_JWT'
    && (configuration.token_source !== 'X_VERCEL_OIDC_PASSPORT_TOKEN'
      || configuration.subject_claim !== 'external_sub')) {
    errors.push(issue('PROTECTED_EDGE_CONFIGURATION_INVALID', 'passport_profile'));
  }
  if (configuration.provider_type === 'AUTH0_OIDC_JWT'
    && (configuration.token_source !== 'AUTHORIZATION_BEARER'
      || configuration.subject_claim !== 'sub')) {
    errors.push(issue('PROTECTED_EDGE_CONFIGURATION_INVALID', 'auth0_profile'));
  }
  if (!https(configuration.issuer)
    || !boundedUniqueStrings(configuration.audiences, 8, 512)
    || !isOpaqueAsyncSecurityReference(configuration.jwks_ref)
    || !sha256(configuration.jwks_sha256)
    || !Array.isArray(configuration.allowed_algorithms)
    || configuration.allowed_algorithms.length !== 1
    || configuration.allowed_algorithms[0] !== 'RS256') {
    errors.push(issue('PROTECTED_EDGE_CONFIGURATION_INVALID', 'verification'));
  }
  for (const field of [
    'subject_claim',
    'token_id_claim',
    'authentication_time_claim',
    'mfa_claim',
    'acr_claim',
  ]) {
    if (!claimName(configuration[field])) {
      errors.push(issue('PROTECTED_EDGE_CONFIGURATION_INVALID', field));
    }
  }
  if (!boundedUniqueStrings(configuration.accepted_mfa_values, 16, 64)
    || !boundedUniqueStrings(configuration.accepted_acr_values, 16, 128)
    || configuration.mfa_required !== true) {
    errors.push(issue('PROTECTED_EDGE_CONFIGURATION_INVALID', 'assurance'));
  }
  for (const field of [
    'environment_id',
    'identity_hash_key_ref',
    'internal_signing_key_ref',
  ]) {
    if (!isOpaqueAsyncSecurityReference(configuration[field])) {
      errors.push(issue('PROTECTED_EDGE_CONFIGURATION_INVALID', field));
    }
  }
  if (!sha256(configuration.deployment_id)) {
    errors.push(issue(
      'PROTECTED_EDGE_IMMUTABLE_DEPLOYMENT_IDENTITY_REQUIRED',
      'deployment_id',
    ));
  }
  if ((environmentId != null && configuration.environment_id !== environmentId)
    || (deploymentId != null && configuration.deployment_id !== deploymentId)
    || (policyDigest != null
      && configuration.protected_edge_policy_digest !== policyDigest)
    || (internalSigningKeyRef != null
      && configuration.internal_signing_key_ref !== internalSigningKeyRef)) {
    errors.push(issue('PROTECTED_EDGE_CONFIGURATION_MISMATCH', 'binding'));
  }
  if (!sha256(configuration.protected_edge_policy_digest)
    || configuration.protected_edge_policy_digest
      !== protectedEdgeIdentityPolicyDigest(configuration)) {
    errors.push(issue('PROTECTED_EDGE_CONFIGURATION_INVALID', 'protected_edge_policy_digest'));
  }
  if (!Number.isInteger(configuration.clock_skew_seconds)
    || configuration.clock_skew_seconds < 0
    || configuration.clock_skew_seconds > 120
    || !Number.isInteger(configuration.max_token_age_seconds)
    || configuration.max_token_age_seconds < 60
    || configuration.max_token_age_seconds > 3600
    || !Number.isInteger(configuration.internal_assertion_ttl_seconds)
    || configuration.internal_assertion_ttl_seconds < 15
    || configuration.internal_assertion_ttl_seconds > 120
    || !Number.isInteger(configuration.replay_ttl_seconds)
    || configuration.replay_ttl_seconds < 60
    || configuration.replay_ttl_seconds > 3600) {
    errors.push(issue('PROTECTED_EDGE_CONFIGURATION_INVALID', 'time_policy'));
  }
  if (!PROTECTED_EDGE_REPLAY_MODES.includes(configuration.replay_mode)
    || configuration.replay_store_contract !== ASYNC_SECURITY_STATE_CONTRACT_VERSION) {
    errors.push(issue('PROTECTED_EDGE_CONFIGURATION_INVALID', 'replay_policy'));
  }
  if (!sha256(configuration.configuration_sha256)
    || configuration.configuration_sha256
      !== protectedEdgeIdentityConfigurationDigest(configuration)) {
    errors.push(issue('PROTECTED_EDGE_CONFIGURATION_DIGEST_MISMATCH', 'configuration_sha256'));
  }
  return frozen({
    valid: errors.length === 0,
    errors,
    value: errors.length === 0 ? configuration : null,
  });
}

export function protectedEdgeIdentityConfigurationFields() {
  return CONFIGURATION_FIELDS;
}

export function describeProtectedEdgeIdentityBindingCapabilityV1({
  configured = false,
  providerType = null,
} = {}) {
  return frozen({
    contract_version: PROTECTED_EDGE_IDENTITY_BINDING_CONTRACT_VERSION,
    adapter_id: PROTECTED_EDGE_IDENTITY_ADAPTER_ID,
    provider_neutral: true,
    configured: configured === true,
    provider_type: PROTECTED_EDGE_PROVIDER_TYPES.includes(providerType)
      ? providerType
      : null,
    approved_algorithms: ['RS256'],
    static_jwks_reference_only: true,
    provider_network_calls: false,
    raw_token_output: false,
    raw_token_persistence: false,
    email_identity_authority: false,
    entitlement_authority: false,
    tester_authority: false,
    profile_id_authority: false,
    immutable_deployment_identity: true,
    trusted_server_transaction_binding: true,
    source_default_off: true,
  });
}
