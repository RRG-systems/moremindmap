import { deepFreeze } from '../../validation.js';

export const ASYNC_SECURITY_STATE_CONTRACT_VERSION = 'shared-security-state-async-v2';
export const ASYNC_SECURITY_QUERY_VERSION = 'async-security-query-v2';
export const ASYNC_SECURITY_QUERY_RESULT_VERSION = 'async-security-query-result-v2';
export const ASYNC_SECURITY_COMMAND_VERSION = 'async-security-command-v2';
export const ASYNC_SECURITY_COMMAND_RESULT_VERSION = 'async-security-command-result-v2';
export const ASYNC_SECURITY_CAPABILITY_VERSION = 'async-security-capability-description-v2';
export const ASYNC_SECURITY_HEALTH_VERSION = 'async-security-health-decision-v2';
export const ASYNC_SECURITY_TIME_VERSION = 'async-security-server-time-v2';

export const ASYNC_SECURITY_QUERY_TYPES = deepFreeze([
  'RESOLVE_CANONICAL_SUBJECT',
  'RESOLVE_EXACT_SCOPE',
  'GET_SESSION_BY_TOKEN_HASH',
  'GET_TEMPORARY_ENTITLEMENT_BY_TOKEN_HASH',
  'GET_PRIVATE_TEST_APPROVAL',
  'READ_AUTHORITY_SNAPSHOT',
  'GET_SECURITY_EPOCH',
  'GET_REPLAY_RESULT',
]);

export const ASYNC_SECURITY_COMMAND_TYPES = deepFreeze([
  'BIND_APPROVED_CANONICAL_SUBJECT',
  'BEGIN_PRE_AUTH',
  'ELEVATE_AUTHENTICATED_SESSION',
  'ISSUE_CSRF_GRANT',
  'CONSUME_CSRF_AND_ISSUE_TEMPORARY_ENTITLEMENT',
  'CLAIM_REPLAY',
  'COMPLETE_REPLAY',
  'REVOKE_TEMPORARY_ENTITLEMENT',
  'REVOKE_RUNTIME_ACCESS',
  'ADVANCE_SECURITY_EPOCH',
  'APPLY_RATE_LIMIT',
  'APPEND_SECURITY_AUDIT',
]);

export const ASYNC_SECURITY_HEALTH_STATES = deepFreeze([
  'UNCONFIGURED',
  'HEALTHY',
  'DEGRADED',
  'UNAVAILABLE',
  'PARTITIONED',
  'RECOVERING',
]);

export const ASYNC_SECURITY_FAILURE_CODES = deepFreeze([
  'ASYNC_SECURITY_CONTRACT_VIOLATION',
  'ASYNC_SECURITY_SCHEMA_INVALID',
  'ASYNC_SECURITY_RESULT_INVALID',
  'ASYNC_SECURITY_TIMEOUT',
  'ASYNC_SECURITY_REJECTED',
  'ASYNC_SECURITY_UNCONFIGURED',
  'SHARED_SECURITY_STATE_REQUIRED',
  'SHARED_SECURITY_STATE_UNAVAILABLE',
  'SHARED_SECURITY_STATE_PARTITIONED',
  'SHARED_SECURITY_STATE_RECOVERING',
  'SECURITY_STATE_CLOCK_INVALID',
  'NON_AUTHORITATIVE_READ',
  'SUBJECT_ASSERTION_REQUIRED',
  'SUBJECT_ASSERTION_INVALID',
  'SUBJECT_MAPPING_NOT_FOUND',
  'SUBJECT_MAPPING_AMBIGUOUS',
  'SUBJECT_MAPPING_STALE',
  'SUBJECT_DISABLED',
  'SUBJECT_DELETED',
  'SUBJECT_RECOVERY_PENDING',
  'EXACT_SCOPE_MISMATCH',
  'PRIVATE_TEST_APPROVAL_REQUIRED',
  'PRIVATE_TEST_APPROVAL_EXPIRED',
  'PRIVATE_TEST_APPROVAL_REVOKED',
  'PRIVATE_TEST_BOOTSTRAP_INELIGIBLE',
  'AUTHENTICATION_REQUIRED',
  'SESSION_ELEVATION_REQUIRED',
  'SESSION_ROTATION_FAILED',
  'SESSION_NOT_FOUND',
  'SESSION_EXPIRED',
  'SESSION_REVOKED',
  'SESSION_ROTATED',
  'CSRF_VALIDATION_FAILED',
  'RATE_LIMITED',
  'ENTITLEMENT_INVALID',
  'ENTITLEMENT_REQUIRED',
  'ENTITLEMENT_EXPIRED',
  'ENTITLEMENT_REVOKED',
  'ENTITLEMENT_ROTATED',
  'RUNTIME_AUTHORITY_DENIED',
  'RUNTIME_ACTION_DENIED',
  'CROSS_SUBSCRIBER_SCOPE_MISMATCH',
  'REQUEST_REPLAY_DETECTED',
  'IDEMPOTENCY_FINGERPRINT_CONFLICT',
  'AUDIT_APPEND_FAILED',
  'EMERGENCY_DISABLED',
  'LOGOUT_REVOCATION_UNCONFIRMED',
]);

const QUERY_FIELDS = deepFreeze([
  'query_version',
  'query_type',
  'environment_id',
  'correlation_ref',
  'subject_ref',
  'session_token_hash',
  'entitlement_token_hash',
  'exact_scope_hash',
  'requested_runtime',
  'requested_action',
  'required_consistency',
]);

const COMMAND_FIELDS = deepFreeze([
  'command_version',
  'command_type',
  'environment_id',
  'idempotency_key_hash',
  'fingerprint',
  'correlation_ref',
  'expected_versions',
  'arguments',
]);

const QUERY_RESULT_FIELDS = deepFreeze([
  'result_version',
  'ok',
  'query_type',
  'consistency_proven',
  'server_time',
  'record_version',
  'record',
  'failure_code',
  'receipt_ref',
]);

const COMMAND_RESULT_FIELDS = deepFreeze([
  'result_version',
  'ok',
  'command_type',
  'committed',
  'idempotent_replay',
  'server_time',
  'new_versions',
  'result_refs',
  'failure_code',
  'audit_receipt_ref',
]);

const CAPABILITY_FIELDS = deepFreeze([
  'description_version',
  'contract_version',
  'adapter_id',
  'adapter_class',
  'provider_class',
  'provider_name',
  'environment_id',
  'available',
  'deployment_grade',
  'promise_native',
  'authoritative_reads',
  'atomic_command_model',
  'server_time_ttl',
  'durable_security_records',
  'durable_privacy_safe_audit',
  'restart_safe',
  'outage_behavior',
  'partition_behavior',
  'no_local_fallback',
  'stores_product_content',
  'stores_transcripts',
  'stores_raw_identity_material',
  'live_connection_verified',
]);

const HEALTH_FIELDS = deepFreeze([
  'decision_version',
  'state',
  'allowed_for_security',
  'environment_id',
  'adapter_id',
  'deployment_grade',
  'live_connection_verified',
  'no_local_fallback',
  'server_time',
  'failure_code',
  'receipt_ref',
]);

const TIME_FIELDS = deepFreeze([
  'receipt_version',
  'ok',
  'server_time',
  'source',
  'failure_code',
  'receipt_ref',
]);

const FORBIDDEN_KEYS = new Set([
  'raw_token',
  'token',
  'cookie',
  'access_code',
  'code',
  'credential',
  'secret',
  'password',
  'assertion',
  'email',
  'name',
  'profile_id',
  'address',
  'ip_address',
  'transcript',
  'prompt',
  'model_output',
  'business_engine_payload',
  'customer_data',
]);

const object = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value, max = 512) => typeof value === 'string'
  && value.trim().length > 0
  && value.length <= max;
const optionalText = (value, max = 512) => value == null || text(value, max);
const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const optionalSha256 = (value) => value == null || sha256(value);
const timestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const exactFields = (value, fields) => object(value)
  && Object.keys(value).length === fields.length
  && Object.keys(value).every((field) => fields.includes(field));
const frozen = (value) => deepFreeze(structuredClone(value));
const validation = (errors, value = null) => frozen({
  valid: errors.length === 0,
  errors,
  value: errors.length ? null : value,
});
const error = (code, field) => ({ code, field });

export function containsForbiddenAsyncSecurityMaterial(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((entry) => containsForbiddenAsyncSecurityMaterial(entry, seen));
  return Object.entries(value).some(([key, child]) => (
    FORBIDDEN_KEYS.has(key.toLowerCase())
    || containsForbiddenAsyncSecurityMaterial(child, seen)
  ));
}

export function isOpaqueAsyncSecurityReference(value, max = 256) {
  return text(value, max)
    && !value.includes('@')
    && !/\s/.test(value)
    && !/^https?:\/\//i.test(value)
    && !/[/?#]/.test(value);
}

export function validateAsyncSecurityCapability(value) {
  const errors = [];
  if (!exactFields(value, CAPABILITY_FIELDS)) return validation([error('ASYNC_SECURITY_SCHEMA_INVALID', 'fields')]);
  if (value.description_version !== ASYNC_SECURITY_CAPABILITY_VERSION) errors.push(error('ASYNC_SECURITY_SCHEMA_INVALID', 'description_version'));
  if (value.contract_version !== ASYNC_SECURITY_STATE_CONTRACT_VERSION) errors.push(error('ASYNC_SECURITY_CONTRACT_VIOLATION', 'contract_version'));
  for (const field of ['adapter_id', 'adapter_class', 'provider_class', 'provider_name', 'environment_id']) {
    if (!isOpaqueAsyncSecurityReference(value[field])) errors.push(error('ASYNC_SECURITY_SCHEMA_INVALID', field));
  }
  for (const field of [
    'available',
    'deployment_grade',
    'promise_native',
    'server_time_ttl',
    'durable_security_records',
    'durable_privacy_safe_audit',
    'restart_safe',
    'no_local_fallback',
    'stores_product_content',
    'stores_transcripts',
    'stores_raw_identity_material',
    'live_connection_verified',
  ]) {
    if (typeof value[field] !== 'boolean') errors.push(error('ASYNC_SECURITY_SCHEMA_INVALID', field));
  }
  for (const field of ['authoritative_reads', 'atomic_command_model', 'outage_behavior', 'partition_behavior']) {
    if (!isOpaqueAsyncSecurityReference(value[field], 160)) errors.push(error('ASYNC_SECURITY_SCHEMA_INVALID', field));
  }
  if (value.promise_native !== true || value.no_local_fallback !== true) {
    errors.push(error('ASYNC_SECURITY_CONTRACT_VIOLATION', 'authority_model'));
  }
  if (value.stores_product_content !== false
    || value.stores_transcripts !== false
    || value.stores_raw_identity_material !== false) {
    errors.push(error('ASYNC_SECURITY_CONTRACT_VIOLATION', 'privacy_model'));
  }
  return validation(errors, value);
}

export function validateAsyncSecurityQuery(value) {
  const errors = [];
  if (!exactFields(value, QUERY_FIELDS)) return validation([error('ASYNC_SECURITY_SCHEMA_INVALID', 'fields')]);
  if (value.query_version !== ASYNC_SECURITY_QUERY_VERSION) errors.push(error('ASYNC_SECURITY_CONTRACT_VIOLATION', 'query_version'));
  if (!ASYNC_SECURITY_QUERY_TYPES.includes(value.query_type)) errors.push(error('ASYNC_SECURITY_SCHEMA_INVALID', 'query_type'));
  if (!isOpaqueAsyncSecurityReference(value.environment_id)) errors.push(error('ASYNC_SECURITY_SCHEMA_INVALID', 'environment_id'));
  if (!isOpaqueAsyncSecurityReference(value.correlation_ref)) errors.push(error('ASYNC_SECURITY_SCHEMA_INVALID', 'correlation_ref'));
  if (!optionalText(value.subject_ref, 256)) errors.push(error('ASYNC_SECURITY_SCHEMA_INVALID', 'subject_ref'));
  if (!optionalSha256(value.session_token_hash)) errors.push(error('ASYNC_SECURITY_SCHEMA_INVALID', 'session_token_hash'));
  if (!optionalSha256(value.entitlement_token_hash)) errors.push(error('ASYNC_SECURITY_SCHEMA_INVALID', 'entitlement_token_hash'));
  if (!optionalSha256(value.exact_scope_hash)) errors.push(error('ASYNC_SECURITY_SCHEMA_INVALID', 'exact_scope_hash'));
  if (!optionalText(value.requested_runtime, 160)) errors.push(error('ASYNC_SECURITY_SCHEMA_INVALID', 'requested_runtime'));
  if (!optionalText(value.requested_action, 160)) errors.push(error('ASYNC_SECURITY_SCHEMA_INVALID', 'requested_action'));
  if (value.required_consistency !== 'PRIMARY_OR_LINEARIZABLE') errors.push(error('NON_AUTHORITATIVE_READ', 'required_consistency'));
  if (containsForbiddenAsyncSecurityMaterial(value)) errors.push(error('ASYNC_SECURITY_SCHEMA_INVALID', 'sensitive_material'));
  return validation(errors, value);
}

export function validateAsyncSecurityCommand(value) {
  const errors = [];
  if (!exactFields(value, COMMAND_FIELDS)) return validation([error('ASYNC_SECURITY_SCHEMA_INVALID', 'fields')]);
  if (value.command_version !== ASYNC_SECURITY_COMMAND_VERSION) errors.push(error('ASYNC_SECURITY_CONTRACT_VIOLATION', 'command_version'));
  if (!ASYNC_SECURITY_COMMAND_TYPES.includes(value.command_type)) errors.push(error('ASYNC_SECURITY_SCHEMA_INVALID', 'command_type'));
  if (!isOpaqueAsyncSecurityReference(value.environment_id)) errors.push(error('ASYNC_SECURITY_SCHEMA_INVALID', 'environment_id'));
  if (!sha256(value.idempotency_key_hash)) errors.push(error('ASYNC_SECURITY_SCHEMA_INVALID', 'idempotency_key_hash'));
  if (!sha256(value.fingerprint)) errors.push(error('ASYNC_SECURITY_SCHEMA_INVALID', 'fingerprint'));
  if (!isOpaqueAsyncSecurityReference(value.correlation_ref)) errors.push(error('ASYNC_SECURITY_SCHEMA_INVALID', 'correlation_ref'));
  if (!object(value.expected_versions) || !object(value.arguments)) errors.push(error('ASYNC_SECURITY_SCHEMA_INVALID', 'payload'));
  if (containsForbiddenAsyncSecurityMaterial(value)) errors.push(error('ASYNC_SECURITY_SCHEMA_INVALID', 'sensitive_material'));
  return validation(errors, value);
}

export function validateAsyncSecurityQueryResult(value, expectedType = null) {
  const errors = [];
  if (!exactFields(value, QUERY_RESULT_FIELDS)) return validation([error('ASYNC_SECURITY_RESULT_INVALID', 'fields')]);
  if (value.result_version !== ASYNC_SECURITY_QUERY_RESULT_VERSION) errors.push(error('ASYNC_SECURITY_RESULT_INVALID', 'result_version'));
  if (!ASYNC_SECURITY_QUERY_TYPES.includes(value.query_type) || (expectedType && value.query_type !== expectedType)) errors.push(error('ASYNC_SECURITY_RESULT_INVALID', 'query_type'));
  if (typeof value.ok !== 'boolean' || typeof value.consistency_proven !== 'boolean') errors.push(error('ASYNC_SECURITY_RESULT_INVALID', 'decision'));
  if (!timestamp(value.server_time)) errors.push(error('SECURITY_STATE_CLOCK_INVALID', 'server_time'));
  if (value.ok) {
    if (value.consistency_proven !== true || !object(value.record) || !Number.isInteger(value.record_version) || value.record_version < 1 || value.failure_code !== null) {
      errors.push(error('ASYNC_SECURITY_RESULT_INVALID', 'success'));
    }
  } else if (value.record !== null || value.record_version !== null || !ASYNC_SECURITY_FAILURE_CODES.includes(value.failure_code)) {
    errors.push(error('ASYNC_SECURITY_RESULT_INVALID', 'failure'));
  }
  if (!isOpaqueAsyncSecurityReference(value.receipt_ref)) errors.push(error('ASYNC_SECURITY_RESULT_INVALID', 'receipt_ref'));
  if (containsForbiddenAsyncSecurityMaterial(value)) errors.push(error('ASYNC_SECURITY_RESULT_INVALID', 'sensitive_material'));
  return validation(errors, value);
}

export function validateAsyncSecurityCommandResult(value, expectedType = null) {
  const errors = [];
  if (!exactFields(value, COMMAND_RESULT_FIELDS)) return validation([error('ASYNC_SECURITY_RESULT_INVALID', 'fields')]);
  if (value.result_version !== ASYNC_SECURITY_COMMAND_RESULT_VERSION) errors.push(error('ASYNC_SECURITY_RESULT_INVALID', 'result_version'));
  if (!ASYNC_SECURITY_COMMAND_TYPES.includes(value.command_type) || (expectedType && value.command_type !== expectedType)) errors.push(error('ASYNC_SECURITY_RESULT_INVALID', 'command_type'));
  if (typeof value.ok !== 'boolean' || typeof value.committed !== 'boolean' || typeof value.idempotent_replay !== 'boolean') {
    errors.push(error('ASYNC_SECURITY_RESULT_INVALID', 'decision'));
  }
  if (!timestamp(value.server_time) || !object(value.new_versions) || !object(value.result_refs)) {
    errors.push(error('ASYNC_SECURITY_RESULT_INVALID', 'result'));
  }
  if (value.ok) {
    if (value.committed !== true || value.failure_code !== null || !isOpaqueAsyncSecurityReference(value.audit_receipt_ref)) {
      errors.push(error('ASYNC_SECURITY_RESULT_INVALID', 'success'));
    }
  } else if (!ASYNC_SECURITY_FAILURE_CODES.includes(value.failure_code) || value.audit_receipt_ref !== null) {
    errors.push(error('ASYNC_SECURITY_RESULT_INVALID', 'failure'));
  }
  if (containsForbiddenAsyncSecurityMaterial(value)) errors.push(error('ASYNC_SECURITY_RESULT_INVALID', 'sensitive_material'));
  return validation(errors, value);
}

export function validateAsyncSecurityHealth(value) {
  const errors = [];
  if (!exactFields(value, HEALTH_FIELDS)) return validation([error('ASYNC_SECURITY_RESULT_INVALID', 'fields')]);
  if (value.decision_version !== ASYNC_SECURITY_HEALTH_VERSION) errors.push(error('ASYNC_SECURITY_RESULT_INVALID', 'decision_version'));
  if (!ASYNC_SECURITY_HEALTH_STATES.includes(value.state)) errors.push(error('ASYNC_SECURITY_RESULT_INVALID', 'state'));
  if (typeof value.allowed_for_security !== 'boolean'
    || typeof value.deployment_grade !== 'boolean'
    || typeof value.live_connection_verified !== 'boolean'
    || value.no_local_fallback !== true) {
    errors.push(error('ASYNC_SECURITY_RESULT_INVALID', 'capability'));
  }
  if (!isOpaqueAsyncSecurityReference(value.environment_id) || !isOpaqueAsyncSecurityReference(value.adapter_id)) errors.push(error('ASYNC_SECURITY_RESULT_INVALID', 'identity'));
  if (!timestamp(value.server_time)) errors.push(error('SECURITY_STATE_CLOCK_INVALID', 'server_time'));
  if (value.state === 'HEALTHY' && value.allowed_for_security !== true) errors.push(error('ASYNC_SECURITY_RESULT_INVALID', 'allowed_for_security'));
  if (value.state !== 'HEALTHY' && value.allowed_for_security !== false) errors.push(error('ASYNC_SECURITY_RESULT_INVALID', 'allowed_for_security'));
  if (value.failure_code !== null && !ASYNC_SECURITY_FAILURE_CODES.includes(value.failure_code)) errors.push(error('ASYNC_SECURITY_RESULT_INVALID', 'failure_code'));
  if (!isOpaqueAsyncSecurityReference(value.receipt_ref)) errors.push(error('ASYNC_SECURITY_RESULT_INVALID', 'receipt_ref'));
  return validation(errors, value);
}

export function validateAsyncSecurityTime(value) {
  const errors = [];
  if (!exactFields(value, TIME_FIELDS)) return validation([error('ASYNC_SECURITY_RESULT_INVALID', 'fields')]);
  if (value.receipt_version !== ASYNC_SECURITY_TIME_VERSION) errors.push(error('ASYNC_SECURITY_RESULT_INVALID', 'receipt_version'));
  if (typeof value.ok !== 'boolean' || !timestamp(value.server_time)) errors.push(error('SECURITY_STATE_CLOCK_INVALID', 'server_time'));
  if (!isOpaqueAsyncSecurityReference(value.source) || !isOpaqueAsyncSecurityReference(value.receipt_ref)) errors.push(error('ASYNC_SECURITY_RESULT_INVALID', 'source'));
  if (value.ok ? value.failure_code !== null : !ASYNC_SECURITY_FAILURE_CODES.includes(value.failure_code)) {
    errors.push(error('ASYNC_SECURITY_RESULT_INVALID', 'failure_code'));
  }
  return validation(errors, value);
}

export function asyncSecurityFailureCode(value, fallback = 'ASYNC_SECURITY_RESULT_INVALID') {
  return ASYNC_SECURITY_FAILURE_CODES.includes(value) ? value : fallback;
}

export function knownAsyncSecurityContractVersions() {
  return deepFreeze([
    ASYNC_SECURITY_STATE_CONTRACT_VERSION,
    ASYNC_SECURITY_QUERY_VERSION,
    ASYNC_SECURITY_QUERY_RESULT_VERSION,
    ASYNC_SECURITY_COMMAND_VERSION,
    ASYNC_SECURITY_COMMAND_RESULT_VERSION,
    ASYNC_SECURITY_CAPABILITY_VERSION,
    ASYNC_SECURITY_HEALTH_VERSION,
    ASYNC_SECURITY_TIME_VERSION,
  ]);
}
