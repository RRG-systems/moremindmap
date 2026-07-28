import { Buffer } from 'node:buffer';
import { hashCanonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';
import {
  ASYNC_SECURITY_CAPABILITY_VERSION,
  ASYNC_SECURITY_COMMAND_RESULT_VERSION,
  ASYNC_SECURITY_FAILURE_CODES,
  ASYNC_SECURITY_HEALTH_VERSION,
  ASYNC_SECURITY_QUERY_RESULT_VERSION,
  ASYNC_SECURITY_STATE_CONTRACT_VERSION,
  ASYNC_SECURITY_TIME_VERSION,
  asyncSecurityFailureCode,
  validateAsyncSecurityCapability,
  validateAsyncSecurityCommand,
  validateAsyncSecurityCommandResult,
  validateAsyncSecurityHealth,
  validateAsyncSecurityQuery,
  validateAsyncSecurityQueryResult,
  validateAsyncSecurityTime,
} from '../asyncSecurityContracts.js';
import {
  REMOTE_SHARED_SECURITY_ADAPTER_CONTRACT_VERSION,
} from './configuration.js';

export const REMOTE_SHARED_SECURITY_ERROR_VERSION =
  'remote-shared-security-adapter-error-v1';
export const REMOTE_SHARED_SECURITY_INTERNAL_CAPABILITY_VERSION =
  'remote-shared-security-capability-v1';
export const REMOTE_SHARED_SECURITY_INTERNAL_HEALTH_VERSION =
  'remote-security-health-decision-v1';
export const REMOTE_SHARED_SECURITY_INTERNAL_TIME_VERSION =
  'remote-security-server-time-v1';
export const REMOTE_SHARED_SECURITY_MAX_ENVELOPE_BYTES = 16 * 1024;

export const REMOTE_SHARED_SECURITY_ERROR_CODES = deepFreeze([
  'UNCONFIGURED',
  'CONFIGURATION_INVALID',
  'ASYNC_SECURITY_CONTRACT_VIOLATION',
  'ENVIRONMENT_MISMATCH',
  'NAMESPACE_MISMATCH',
  'CAPABILITY_MISMATCH',
  'PRIMARY_AUTHORITY_NOT_PROVEN',
  'ATOMICITY_NOT_PROVEN',
  'SERVER_TIME_NOT_PROVEN',
  'PROVIDER_AUTHENTICATION_FAILED',
  'PROVIDER_FORBIDDEN',
  'PROVIDER_RATE_LIMITED',
  'PROVIDER_TIMEOUT',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_PARTITION_SUSPECTED',
  'PROVIDER_RESPONSE_MALFORMED',
  'SCRIPT_VERSION_MISMATCH',
  'SCRIPT_RUNTIME_FAILURE',
  'IDEMPOTENCY_FINGERPRINT_CONFLICT',
  'RECORD_VERSION_MISMATCH',
  'RECORD_CORRUPT',
  'AUDIT_COMMIT_FAILED',
  'RECOVERY_NOT_PROVEN',
]);

const PROVIDER_TO_V2_FAILURE = deepFreeze({
  UNCONFIGURED: 'ASYNC_SECURITY_UNCONFIGURED',
  CONFIGURATION_INVALID: 'ASYNC_SECURITY_UNCONFIGURED',
  ASYNC_SECURITY_CONTRACT_VIOLATION: 'ASYNC_SECURITY_CONTRACT_VIOLATION',
  ENVIRONMENT_MISMATCH: 'SHARED_SECURITY_STATE_REQUIRED',
  NAMESPACE_MISMATCH: 'SHARED_SECURITY_STATE_PARTITIONED',
  CAPABILITY_MISMATCH: 'SHARED_SECURITY_STATE_REQUIRED',
  PRIMARY_AUTHORITY_NOT_PROVEN: 'NON_AUTHORITATIVE_READ',
  ATOMICITY_NOT_PROVEN: 'ASYNC_SECURITY_CONTRACT_VIOLATION',
  SERVER_TIME_NOT_PROVEN: 'SECURITY_STATE_CLOCK_INVALID',
  PROVIDER_AUTHENTICATION_FAILED: 'SHARED_SECURITY_STATE_UNAVAILABLE',
  PROVIDER_FORBIDDEN: 'SHARED_SECURITY_STATE_UNAVAILABLE',
  PROVIDER_RATE_LIMITED: 'RATE_LIMITED',
  PROVIDER_TIMEOUT: 'ASYNC_SECURITY_TIMEOUT',
  PROVIDER_UNAVAILABLE: 'SHARED_SECURITY_STATE_UNAVAILABLE',
  PROVIDER_PARTITION_SUSPECTED: 'SHARED_SECURITY_STATE_PARTITIONED',
  PROVIDER_RESPONSE_MALFORMED: 'ASYNC_SECURITY_RESULT_INVALID',
  SCRIPT_VERSION_MISMATCH: 'ASYNC_SECURITY_CONTRACT_VIOLATION',
  SCRIPT_RUNTIME_FAILURE: 'ASYNC_SECURITY_REJECTED',
  IDEMPOTENCY_FINGERPRINT_CONFLICT: 'IDEMPOTENCY_FINGERPRINT_CONFLICT',
  RECORD_VERSION_MISMATCH: 'ASYNC_SECURITY_RESULT_INVALID',
  RECORD_CORRUPT: 'ASYNC_SECURITY_RESULT_INVALID',
  AUDIT_COMMIT_FAILED: 'AUDIT_APPEND_FAILED',
  RECOVERY_NOT_PROVEN: 'SHARED_SECURITY_STATE_RECOVERING',
});

const frozen = (value) => deepFreeze(structuredClone(value));
const safeReceipt = (domain, value) => `${domain}_${hashCanonicalJson(value).slice(0, 32)}`;

export class RemoteSharedSecurityAdapterError extends Error {
  constructor(code, {
    receipt_ref = null,
    cause = null,
  } = {}) {
    const normalized = REMOTE_SHARED_SECURITY_ERROR_CODES.includes(code)
      ? code
      : 'PROVIDER_UNAVAILABLE';
    super(`remote shared security adapter denied: ${normalized}`, cause ? { cause } : undefined);
    this.name = 'RemoteSharedSecurityAdapterError';
    this.error_version = REMOTE_SHARED_SECURITY_ERROR_VERSION;
    this.code = normalized;
    this.failure_code = PROVIDER_TO_V2_FAILURE[normalized];
    this.receipt_ref = receipt_ref || safeReceipt('remote_error', { code: normalized });
  }
}

export function remoteProviderFailureCode(code) {
  return PROVIDER_TO_V2_FAILURE[code] || 'SHARED_SECURITY_STATE_UNAVAILABLE';
}

export function normalizeRemoteProviderFailure(value) {
  if (value instanceof RemoteSharedSecurityAdapterError) return value;
  const status = Number(value?.status);
  const code = value?.name === 'AbortError'
    ? 'PROVIDER_TIMEOUT'
    : status === 401
      ? 'PROVIDER_AUTHENTICATION_FAILED'
      : status === 403
        ? 'PROVIDER_FORBIDDEN'
        : status === 429
          ? 'PROVIDER_RATE_LIMITED'
          : status >= 500
            ? 'PROVIDER_UNAVAILABLE'
            : 'PROVIDER_RESPONSE_MALFORMED';
  return new RemoteSharedSecurityAdapterError(code);
}

function serializedBytes(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

export function validateRemoteQueryEnvelope(value) {
  const checked = validateAsyncSecurityQuery(value);
  if (!checked.valid || serializedBytes(value) > REMOTE_SHARED_SECURITY_MAX_ENVELOPE_BYTES) {
    throw new RemoteSharedSecurityAdapterError('ASYNC_SECURITY_CONTRACT_VIOLATION');
  }
  return checked.value;
}

export function validateRemoteCommandEnvelope(value) {
  const checked = validateAsyncSecurityCommand(value);
  if (!checked.valid || serializedBytes(value) > REMOTE_SHARED_SECURITY_MAX_ENVELOPE_BYTES) {
    throw new RemoteSharedSecurityAdapterError('ASYNC_SECURITY_CONTRACT_VIOLATION');
  }
  return checked.value;
}

export function projectRemoteCapabilityToV2(internal) {
  const value = frozen({
    description_version: ASYNC_SECURITY_CAPABILITY_VERSION,
    contract_version: ASYNC_SECURITY_STATE_CONTRACT_VERSION,
    adapter_id: internal.adapter_id,
    adapter_class: 'REMOTE_DEPLOYMENT_CANDIDATE',
    provider_class: 'REMOTE_SHARED_SECURITY_STATE',
    provider_name: 'UPSTASH_REDIS',
    environment_id: internal.environment_id,
    available: internal.available === true,
    deployment_grade: internal.deployment_grade === true,
    promise_native: true,
    authoritative_reads: internal.primary_authority_proven === true
      ? 'PRIMARY_OR_LINEARIZABLE'
      : 'PRIMARY_ATOMIC_SCRIPT_REQUIRED',
    atomic_command_model: 'VERSIONED_LUA_SCRIPT',
    server_time_ttl: true,
    durable_security_records: true,
    durable_privacy_safe_audit: true,
    restart_safe: true,
    outage_behavior: 'FAIL_CLOSED',
    partition_behavior: 'FAIL_CLOSED',
    no_local_fallback: true,
    stores_product_content: false,
    stores_transcripts: false,
    stores_raw_identity_material: false,
    live_connection_verified: internal.live_connection_verified === true,
  });
  if (!validateAsyncSecurityCapability(value).valid) {
    throw new RemoteSharedSecurityAdapterError('CAPABILITY_MISMATCH');
  }
  return value;
}

export function projectRemoteHealthToV2(internal) {
  const value = frozen({
    decision_version: ASYNC_SECURITY_HEALTH_VERSION,
    state: internal.state,
    allowed_for_security: internal.state === 'HEALTHY'
      && internal.allowed_for_security === true,
    environment_id: internal.environment_id,
    adapter_id: internal.adapter_id,
    deployment_grade: internal.deployment_grade === true,
    live_connection_verified: internal.live_connection_verified === true,
    no_local_fallback: true,
    server_time: new Date(internal.server_time_ms || 0).toISOString(),
    failure_code: internal.state === 'HEALTHY'
      ? null
      : asyncSecurityFailureCode(
        remoteProviderFailureCode(internal.failure_code || 'PROVIDER_UNAVAILABLE'),
      ),
    receipt_ref: internal.receipt_ref,
  });
  if (!validateAsyncSecurityHealth(value).valid) {
    throw new RemoteSharedSecurityAdapterError('PROVIDER_RESPONSE_MALFORMED');
  }
  return value;
}

export function projectRemoteServerTimeToV2(internal) {
  const ok = internal.ok === true;
  const value = frozen({
    receipt_version: ASYNC_SECURITY_TIME_VERSION,
    ok,
    server_time: new Date(internal.server_time_ms || 0).toISOString(),
    source: 'PROVIDER_SERVER_TIME_PRIMARY_SCRIPT',
    failure_code: ok
      ? null
      : asyncSecurityFailureCode(
        remoteProviderFailureCode(internal.failure_code || 'SERVER_TIME_NOT_PROVEN'),
      ),
    receipt_ref: internal.receipt_ref,
  });
  if (!validateAsyncSecurityTime(value).valid) {
    throw new RemoteSharedSecurityAdapterError('PROVIDER_RESPONSE_MALFORMED');
  }
  return value;
}

export function assertRemoteQueryResult(value, expectedType) {
  const checked = validateAsyncSecurityQueryResult(value, expectedType);
  if (!checked.valid) throw new RemoteSharedSecurityAdapterError('PROVIDER_RESPONSE_MALFORMED');
  return checked.value;
}

export function assertRemoteCommandResult(value, expectedType) {
  const checked = validateAsyncSecurityCommandResult(value, expectedType);
  if (!checked.valid) throw new RemoteSharedSecurityAdapterError('PROVIDER_RESPONSE_MALFORMED');
  return checked.value;
}

export function remoteQueryFailure(queryType, code, serverTimeMs = 0) {
  return frozen({
    result_version: ASYNC_SECURITY_QUERY_RESULT_VERSION,
    ok: false,
    query_type: queryType,
    consistency_proven: false,
    server_time: new Date(serverTimeMs).toISOString(),
    record_version: null,
    record: null,
    failure_code: asyncSecurityFailureCode(remoteProviderFailureCode(code)),
    receipt_ref: safeReceipt('remote_query_denied', { queryType, code, serverTimeMs }),
  });
}

export function remoteCommandFailure(commandType, code, serverTimeMs = 0) {
  return frozen({
    result_version: ASYNC_SECURITY_COMMAND_RESULT_VERSION,
    ok: false,
    command_type: commandType,
    committed: false,
    idempotent_replay: false,
    server_time: new Date(serverTimeMs).toISOString(),
    new_versions: {},
    result_refs: {},
    failure_code: asyncSecurityFailureCode(remoteProviderFailureCode(code)),
    audit_receipt_ref: null,
  });
}

export function remoteSharedSecurityContractIdentity() {
  return frozen({
    contract_version: ASYNC_SECURITY_STATE_CONTRACT_VERSION,
    adapter_contract_version: REMOTE_SHARED_SECURITY_ADAPTER_CONTRACT_VERSION,
    capability_version: ASYNC_SECURITY_CAPABILITY_VERSION,
    health_version: ASYNC_SECURITY_HEALTH_VERSION,
    time_version: ASYNC_SECURITY_TIME_VERSION,
    query_result_version: ASYNC_SECURITY_QUERY_RESULT_VERSION,
    command_result_version: ASYNC_SECURITY_COMMAND_RESULT_VERSION,
    provider_client_exposed: false,
  });
}

export function allRemoteFailuresMapToV2() {
  return REMOTE_SHARED_SECURITY_ERROR_CODES.every((code) => (
    ASYNC_SECURITY_FAILURE_CODES.includes(remoteProviderFailureCode(code))
  ));
}
