import { hashCanonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';
import {
  isOpaqueAsyncSecurityReference,
} from '../asyncSecurityContracts.js';

export const LIVE_SUBSCRIBER_ASSERTION_CONTRACT_VERSION =
  'live-subscriber-assertion-verifier-v1';
export const LIVE_SUBSCRIBER_ASSERTION_CONFIGURATION_VERSION =
  'live-subscriber-assertion-configuration-v1';
export const LIVE_SUBSCRIBER_ASSERTION_ADAPTER_ID =
  'auth0-live-subscriber-assertion-adapter-v1';

const CONFIGURATION_FIELDS = deepFreeze([
  'config_version',
  'enabled',
  'adapter_id',
  'contract_version',
  'environment_id',
  'issuer',
  'audience',
  'client_id',
  'client_secret_ref',
  'authorization_endpoint',
  'token_endpoint',
  'jwks_uri',
  'redirect_uri',
  'transaction_key_ref',
  'identity_hash_key_ref',
  'exact_scope_hash',
  'protected_edge_policy_digest',
  'allowed_algorithms',
  'mfa_required',
  'clock_skew_seconds',
  'transaction_ttl_ms',
  'request_timeout_ms',
  'configuration_sha256',
]);

const object = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const exactFields = (value, fields) => object(value)
  && Object.keys(value).length === fields.length
  && Object.keys(value).every((field) => fields.includes(field));
const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const https = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};
const boundedText = (value, max = 512) => typeof value === 'string'
  && value.length > 0
  && value.length <= max
  && !/\s/.test(value);
const frozen = (value) => deepFreeze(structuredClone(value));
const issue = (code, field) => ({ code, field });

function digestWithout(value, field) {
  const copy = { ...value };
  delete copy[field];
  return hashCanonicalJson(copy);
}

export function liveSubscriberAssertionConfigurationDigest(configuration) {
  if (!object(configuration)) throw new TypeError('assertion configuration required');
  return digestWithout(configuration, 'configuration_sha256');
}

export function validateLiveSubscriberAssertionConfigurationV1(configuration, {
  environmentId = null,
  exactScopeHash = null,
} = {}) {
  const errors = [];
  if (!exactFields(configuration, CONFIGURATION_FIELDS)) {
    return frozen({
      valid: false,
      errors: [issue('OIDC_CONFIGURATION_UNAVAILABLE', 'fields')],
      value: null,
    });
  }
  if (configuration.config_version !== LIVE_SUBSCRIBER_ASSERTION_CONFIGURATION_VERSION
    || configuration.adapter_id !== LIVE_SUBSCRIBER_ASSERTION_ADAPTER_ID
    || configuration.contract_version !== LIVE_SUBSCRIBER_ASSERTION_CONTRACT_VERSION
    || configuration.enabled !== true) {
    errors.push(issue('OIDC_CONFIGURATION_UNAVAILABLE', 'identity'));
  }
  if (!isOpaqueAsyncSecurityReference(configuration.environment_id)
    || (environmentId != null && configuration.environment_id !== environmentId)) {
    errors.push(issue('OIDC_CONFIGURATION_UNAVAILABLE', 'environment_id'));
  }
  if (!https(configuration.issuer)
    || !configuration.issuer.endsWith('/')
    || !boundedText(configuration.audience)
    || !isOpaqueAsyncSecurityReference(configuration.client_id)
    || !isOpaqueAsyncSecurityReference(configuration.client_secret_ref)
    || !https(configuration.authorization_endpoint)
    || !https(configuration.token_endpoint)
    || !https(configuration.jwks_uri)
    || !https(configuration.redirect_uri)
    || !isOpaqueAsyncSecurityReference(configuration.transaction_key_ref)
    || !isOpaqueAsyncSecurityReference(configuration.identity_hash_key_ref)) {
    errors.push(issue('OIDC_CONFIGURATION_UNAVAILABLE', 'provider'));
  }
  if (!sha256(configuration.exact_scope_hash)
    || (exactScopeHash != null && configuration.exact_scope_hash !== exactScopeHash)
    || !sha256(configuration.protected_edge_policy_digest)) {
    errors.push(issue('OIDC_CONFIGURATION_UNAVAILABLE', 'binding'));
  }
  if (!Array.isArray(configuration.allowed_algorithms)
    || configuration.allowed_algorithms.length !== 1
    || configuration.allowed_algorithms[0] !== 'RS256'
    || configuration.mfa_required !== true
    || !Number.isInteger(configuration.clock_skew_seconds)
    || configuration.clock_skew_seconds < 0
    || configuration.clock_skew_seconds > 120
    || !Number.isInteger(configuration.transaction_ttl_ms)
    || configuration.transaction_ttl_ms < 60_000
    || configuration.transaction_ttl_ms > 10 * 60_000
    || !Number.isInteger(configuration.request_timeout_ms)
    || configuration.request_timeout_ms < 100
    || configuration.request_timeout_ms > 3_000) {
    errors.push(issue('OIDC_CONFIGURATION_UNAVAILABLE', 'policy'));
  }
  if (!sha256(configuration.configuration_sha256)
    || configuration.configuration_sha256
      !== liveSubscriberAssertionConfigurationDigest(configuration)) {
    errors.push(issue('OIDC_CONFIGURATION_UNAVAILABLE', 'configuration_sha256'));
  }
  return frozen({
    valid: errors.length === 0,
    errors,
    value: errors.length === 0 ? configuration : null,
  });
}

export function liveSubscriberAssertionConfigurationFields() {
  return CONFIGURATION_FIELDS;
}

export function describeLiveSubscriberAssertionCapabilityV1({
  configured = false,
} = {}) {
  return frozen({
    contract_version: LIVE_SUBSCRIBER_ASSERTION_CONTRACT_VERSION,
    adapter_id: LIVE_SUBSCRIBER_ASSERTION_ADAPTER_ID,
    provider_neutral: true,
    initial_provider: 'AUTH0',
    authorization_flow: 'AUTHORIZATION_CODE_WITH_PKCE',
    configured: configured === true,
    raw_token_output: false,
    email_identity_authority: false,
    auto_enrollment: false,
    subdev1_authentication: false,
    source_default_off: true,
  });
}
