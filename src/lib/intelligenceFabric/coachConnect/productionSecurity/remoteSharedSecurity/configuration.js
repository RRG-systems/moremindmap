import { hashCanonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';
import {
  ASYNC_SECURITY_STATE_CONTRACT_VERSION,
  isOpaqueAsyncSecurityReference,
} from '../asyncSecurityContracts.js';

export const REMOTE_SHARED_SECURITY_ADAPTER_CONTRACT_VERSION =
  'remote-shared-security-adapter-v1';
export const REMOTE_SHARED_SECURITY_CONFIGURATION_VERSION =
  'remote-shared-security-adapter-config-v1';

export const REMOTE_SHARED_SECURITY_ENVIRONMENTS = deepFreeze([
  'LOCAL_SYNTHETIC',
  'TEST',
  'DISPOSABLE_QUALIFICATION',
  'PRIVATE_PREVIEW',
  'PRIVATE_PRODUCTION_CLASSIFIED',
]);

export const REMOTE_SHARED_SECURITY_PROVIDERS = deepFreeze([
  'UPSTASH_REDIS',
]);

const CONFIGURATION_FIELDS = deepFreeze([
  'config_version',
  'enabled',
  'emergency_disabled',
  'provider',
  'provider_endpoint_ref',
  'provider_credential_ref',
  'environment_id',
  'provider_database_id_digest',
  'provider_region',
  'namespace_prefix',
  'namespace_digest',
  'adapter_id',
  'contract_version',
  'adapter_contract_version',
  'script_manifest_digest',
  'query_timeout_ms',
  'command_timeout_ms',
  'operation_deadline_ms',
  'query_retry_limit',
  'command_retry_limit',
  'breaker_failure_threshold',
  'breaker_window_ms',
  'breaker_open_ms',
  'recovery_success_threshold',
  'audit_retention_days',
  'backup_retention_days',
  'token_hash_key_ref',
  'token_hash_key_id',
  'identity_hash_key_ref',
  'identity_hash_key_id',
  'scope_hash_key_ref',
  'scope_hash_key_id',
  'telemetry_enabled',
]);

const SECRET_REFERENCE_FIELDS = deepFreeze([
  'provider_endpoint_ref',
  'provider_credential_ref',
  'token_hash_key_ref',
  'identity_hash_key_ref',
  'scope_hash_key_ref',
]);

const SHA256_FIELDS = deepFreeze([
  'provider_database_id_digest',
  'namespace_digest',
  'script_manifest_digest',
]);

const OPAQUE_FIELDS = deepFreeze([
  ...SECRET_REFERENCE_FIELDS,
  'provider_region',
  'adapter_id',
  'token_hash_key_id',
  'identity_hash_key_id',
  'scope_hash_key_id',
]);

const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const integerWithin = (value, minimum, maximum) => Number.isInteger(value)
  && value >= minimum
  && value <= maximum;
const frozen = (value) => deepFreeze(structuredClone(value));

function issue(code, field) {
  return frozen({ code, field });
}

export function defaultRemoteSharedSecurityConfiguration() {
  return frozen({
    config_version: REMOTE_SHARED_SECURITY_CONFIGURATION_VERSION,
    enabled: false,
    emergency_disabled: true,
    provider: 'UPSTASH_REDIS',
    provider_endpoint_ref: 'unconfigured_endpoint_ref',
    provider_credential_ref: 'unconfigured_credential_ref',
    environment_id: 'LOCAL_SYNTHETIC',
    provider_database_id_digest: '0'.repeat(64),
    provider_region: 'unconfigured_region',
    namespace_prefix: 'more:cc:security:v2',
    namespace_digest: '0'.repeat(64),
    adapter_id: 'remote_shared_security_unconfigured',
    contract_version: ASYNC_SECURITY_STATE_CONTRACT_VERSION,
    adapter_contract_version: REMOTE_SHARED_SECURITY_ADAPTER_CONTRACT_VERSION,
    script_manifest_digest: '0'.repeat(64),
    query_timeout_ms: 750,
    command_timeout_ms: 1500,
    operation_deadline_ms: 3000,
    query_retry_limit: 1,
    command_retry_limit: 1,
    breaker_failure_threshold: 3,
    breaker_window_ms: 30000,
    breaker_open_ms: 15000,
    recovery_success_threshold: 3,
    audit_retention_days: 0,
    backup_retention_days: 0,
    token_hash_key_ref: 'unconfigured_token_hash_key_ref',
    token_hash_key_id: 'unconfigured_token_hash_key_id',
    identity_hash_key_ref: 'unconfigured_identity_hash_key_ref',
    identity_hash_key_id: 'unconfigured_identity_hash_key_id',
    scope_hash_key_ref: 'unconfigured_scope_hash_key_ref',
    scope_hash_key_id: 'unconfigured_scope_hash_key_id',
    telemetry_enabled: false,
  });
}

export function validateRemoteSharedSecurityConfiguration(configuration, {
  qualification_authorized = false,
  operating_authorized = false,
  expected_script_manifest_digest = null,
} = {}) {
  const errors = [];
  if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
    return frozen({ valid: false, errors: [issue('CONFIGURATION_INVALID', 'configuration')], value: null });
  }
  const keys = Object.keys(configuration);
  if (keys.length !== CONFIGURATION_FIELDS.length
    || keys.some((key) => !CONFIGURATION_FIELDS.includes(key))) {
    errors.push(issue('CONFIGURATION_INVALID', 'fields'));
  }
  if (configuration.config_version !== REMOTE_SHARED_SECURITY_CONFIGURATION_VERSION) {
    errors.push(issue('CONFIGURATION_INVALID', 'config_version'));
  }
  if (configuration.contract_version !== ASYNC_SECURITY_STATE_CONTRACT_VERSION) {
    errors.push(issue('ASYNC_SECURITY_CONTRACT_VIOLATION', 'contract_version'));
  }
  if (configuration.adapter_contract_version !== REMOTE_SHARED_SECURITY_ADAPTER_CONTRACT_VERSION) {
    errors.push(issue('CONFIGURATION_INVALID', 'adapter_contract_version'));
  }
  if (!REMOTE_SHARED_SECURITY_PROVIDERS.includes(configuration.provider)) {
    errors.push(issue('CONFIGURATION_INVALID', 'provider'));
  }
  if (!REMOTE_SHARED_SECURITY_ENVIRONMENTS.includes(configuration.environment_id)) {
    errors.push(issue('CONFIGURATION_INVALID', 'environment_id'));
  }
  if (configuration.namespace_prefix !== 'more:cc:security:v2') {
    errors.push(issue('NAMESPACE_MISMATCH', 'namespace_prefix'));
  }
  for (const field of SHA256_FIELDS) {
    if (!sha256(configuration[field])) errors.push(issue('CONFIGURATION_INVALID', field));
  }
  for (const field of OPAQUE_FIELDS) {
    if (!isOpaqueAsyncSecurityReference(configuration[field])) {
      errors.push(issue('CONFIGURATION_INVALID', field));
    }
  }
  if (typeof configuration.enabled !== 'boolean'
    || typeof configuration.emergency_disabled !== 'boolean'
    || configuration.telemetry_enabled !== false) {
    errors.push(issue('CONFIGURATION_INVALID', 'activation'));
  }
  if (!integerWithin(configuration.query_timeout_ms, 100, 750)
    || !integerWithin(configuration.command_timeout_ms, 250, 1500)
    || !integerWithin(configuration.operation_deadline_ms, 500, 3000)
    || configuration.operation_deadline_ms < configuration.command_timeout_ms) {
    errors.push(issue('CONFIGURATION_INVALID', 'timeouts'));
  }
  if (!integerWithin(configuration.query_retry_limit, 0, 1)
    || !integerWithin(configuration.command_retry_limit, 0, 1)) {
    errors.push(issue('CONFIGURATION_INVALID', 'retry_limits'));
  }
  if (configuration.breaker_failure_threshold !== 3
    || configuration.breaker_window_ms !== 30000
    || configuration.breaker_open_ms !== 15000
    || configuration.recovery_success_threshold !== 3) {
    errors.push(issue('CONFIGURATION_INVALID', 'health_thresholds'));
  }
  for (const field of ['audit_retention_days', 'backup_retention_days']) {
    if (!integerWithin(configuration[field], 0, 30)) {
      errors.push(issue('CONFIGURATION_INVALID', field));
    }
  }
  const deploymentClass = ['PRIVATE_PREVIEW', 'PRIVATE_PRODUCTION_CLASSIFIED']
    .includes(configuration.environment_id);
  if (deploymentClass
    && (configuration.audit_retention_days === 0 || configuration.backup_retention_days === 0)) {
    errors.push(issue('CONFIGURATION_INVALID', 'retention_authority'));
  }
  if (configuration.enabled === true
    && (configuration.emergency_disabled !== false
      || (operating_authorized !== true && qualification_authorized !== true))) {
    errors.push(issue('UNCONFIGURED', 'operating_authority'));
  }
  if (expected_script_manifest_digest
    && configuration.script_manifest_digest !== expected_script_manifest_digest) {
    errors.push(issue('SCRIPT_VERSION_MISMATCH', 'script_manifest_digest'));
  }
  return frozen({
    valid: errors.length === 0,
    errors,
    value: errors.length ? null : configuration,
  });
}

export function remoteSharedSecurityConfigurationDigest(configuration) {
  const checked = validateRemoteSharedSecurityConfiguration(configuration, {
    qualification_authorized: configuration?.enabled !== true,
  });
  if (!checked.valid && configuration?.enabled !== true) {
    throw new TypeError('remote shared security configuration is invalid');
  }
  const nonSecret = Object.fromEntries(Object.entries(configuration)
    .filter(([field]) => !SECRET_REFERENCE_FIELDS.includes(field)));
  return hashCanonicalJson({
    ...nonSecret,
    secret_reference_versions: {
      provider_credential_ref: configuration.provider_credential_ref,
      token_hash_key_id: configuration.token_hash_key_id,
      identity_hash_key_id: configuration.identity_hash_key_id,
      scope_hash_key_id: configuration.scope_hash_key_id,
    },
  });
}

export function remoteSharedSecurityConfigurationFields() {
  return CONFIGURATION_FIELDS;
}

export function remoteSharedSecurityEnvironmentIsolationDecision(left, right) {
  const failures = [];
  if (!left || !right) failures.push('CONFIGURATION_REQUIRED');
  if (left?.environment_id === right?.environment_id) failures.push('ENVIRONMENT_ID_COLLISION');
  if (left?.provider_database_id_digest === right?.provider_database_id_digest) {
    failures.push('PROVIDER_DATABASE_COLLISION');
  }
  if (left?.provider_credential_ref === right?.provider_credential_ref) {
    failures.push('PROVIDER_CREDENTIAL_COLLISION');
  }
  if (left?.namespace_digest === right?.namespace_digest) {
    failures.push('NAMESPACE_COLLISION');
  }
  for (const field of ['token_hash_key_ref', 'identity_hash_key_ref', 'scope_hash_key_ref']) {
    if (left?.[field] === right?.[field]) failures.push(`${field.toUpperCase()}_COLLISION`);
  }
  return frozen({
    isolated: failures.length === 0,
    failures,
    sessions_shared: false,
    entitlements_shared: false,
    approvals_shared: false,
    audit_shared: false,
    backups_shared: false,
  });
}

export function remoteSharedSecurityRetentionDecision(configuration) {
  const errors = [];
  for (const field of ['audit_retention_days', 'backup_retention_days']) {
    if (!integerWithin(configuration?.[field], 0, 30)) errors.push(`${field.toUpperCase()}_INVALID`);
  }
  if (['PRIVATE_PREVIEW', 'PRIVATE_PRODUCTION_CLASSIFIED'].includes(configuration?.environment_id)
    && (configuration?.audit_retention_days === 0 || configuration?.backup_retention_days === 0)) {
    errors.push('NAMED_RETENTION_AUTHORITY_REQUIRED');
  }
  return frozen({
    allowed: errors.length === 0,
    errors,
    maximum_days: 30,
    cache_eviction_is_deletion_proof: false,
    ttl_is_backup_deletion_proof: false,
    cryptographic_erasure_claimed: false,
  });
}

export function remoteSharedSecuritySecretBoundary() {
  return frozen({
    server_side_only: true,
    repository_values_allowed: false,
    client_bundle_values_allowed: false,
    log_values_allowed: false,
    independently_rotatable: true,
    named_owner_required: true,
    credential_binding_campaign_required: true,
    accepted_sources: ['APPROVED_SERVER_SIDE_SECRET_REFERENCE_RESOLVER'],
    rejected_sources: ['REQUEST', 'COOKIE', 'CLIENT_ENV', 'REPOSITORY', 'EVIDENCE'],
  });
}
