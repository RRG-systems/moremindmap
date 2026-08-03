import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import Redis from 'ioredis';
import { hashCanonicalJson } from '../../../hashing.js';
import {
  createQualificationDigestFunction,
  createRemoteSharedSecurityKeyspace,
} from '../../productionSecurity/remoteSharedSecurity/keyspace.js';
import {
  createUpstashRedisRemoteSharedSecurityAdapter,
  UPSTASH_REMOTE_SHARED_SECURITY_ADAPTER_VERSION,
} from '../../productionSecurity/remoteSharedSecurity/upstashRedisAdapter.js';
import {
  privateRuntimeProductStoreConnectionAllowedV1,
  readPrivateRuntimeLiveConfigurationAuthorityV1,
} from './configurationAuthority.js';
import {
  readPrivateLiveProductExecutionBindingV1,
} from './productExecutionBinding.js';
import {
  createFixedSyntheticProfileAndBaFixtureV1,
  FIXED_SYNTHETIC_BUSINESS_ENGINE_CONTRACT_SHA256,
  FIXED_SYNTHETIC_PRODUCT_FIXTURE_PROFILE_ID,
} from './fixedSyntheticProductFixture.js';
import {
  validateAsyncSecurityHealth,
} from '../../productionSecurity/asyncSecurityContracts.js';

export const PRIVATE_LIVE_OPERATIONAL_RUNNER_VERSION =
  'private-live-operational-runner-v1';
export const PRIVATE_LIVE_OPERATIONAL_RUNNER_AUTHORITY_VERSION =
  'private-live-operational-runner-authority-v1';
export const PRIVATE_LIVE_OPERATIONAL_RUNNER_AUTHORITY_VARIABLE =
  'MORE_PRIVATE_RUNTIME_OPERATIONAL_RUNNER_AUTHORITY';

export const PRIVATE_LIVE_OPERATIONAL_RUNNER_OPERATIONS = Object.freeze([
  'PROVIDER_HEALTH_CANARY',
  'CREATE_FIXED_SYNTHETIC_PRODUCT_FIXTURE',
  'CREATE_SYNTHETIC_APPROVAL',
  'READ_SYNTHETIC_APPROVAL',
  'REVOKE_SYNTHETIC_APPROVAL',
  'CREATE_SYNTHETIC_EPOCH_1',
  'READ_SYNTHETIC_EPOCH',
  'ADVANCE_SYNTHETIC_EPOCH_1_TO_2',
]);

export const PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE = Object.freeze({
  profile_id: 'mm-20260730-synth001',
  tenant_id: 'tenant_synthetic_private_beta_v1',
  business_id: 'business_synthetic_private_beta_v1',
  subscriber_id: 'subscriber_synthetic_private_beta_v1',
  subscriber_subject_ref: 'subscriber_subject_synthetic_private_beta_v1',
  exact_scope_hash:
    '1840323c2a4d6b394973ad268926d8a1c1849ebf1372dd7b21816562009841fe',
});

const APPROVAL_PURPOSE = 'TEMPORARY_PRIVATE_SUBSCRIPTION_TEST';
const MAX_APPROVAL_MINUTES = 90;
const CANARY_PROOF_TTL_MS = 15 * 60 * 1000;
const AUTHORITY_FIELDS = Object.freeze([
  'authority_version',
  'enabled',
  'deployment_sha256',
  'expires_at',
  'allowed_operations',
  'authorization_sha256',
]);
const COMMON_REQUEST_FIELDS = Object.freeze(['operation', 'request_id', 'scope']);
const APPROVAL_REQUEST_FIELDS = Object.freeze([
  ...COMMON_REQUEST_FIELDS,
  'duration_minutes',
]);
const SCOPE_FIELDS = Object.freeze(Object.keys(PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE));
const EXACT_SCOPE_FIELDS = Object.freeze([
  'tenant_id',
  'profile_id',
  'business_id',
  'subscriber_id',
]);
const PROVIDER_RESULT_FIELDS = Object.freeze([
  'ok',
  'status',
  'code',
  'provider_time_ms',
  'receipt_hash',
  'epoch',
  'approval_status',
  'expires_at_ms',
  'idempotent_replay',
]);
const PROVIDER_RESULT_REQUIRED_FIELDS = Object.freeze([
  'ok',
  'status',
  'code',
  'provider_time_ms',
  'receipt_hash',
  'idempotent_replay',
]);
const PROVIDER_RESULT_NULLABLE_FIELDS = Object.freeze([
  'epoch',
  'approval_status',
  'expires_at_ms',
]);
export const PROVIDER_PROOF_RESPONSE_SHAPE_DIAGNOSTIC_FIELDS = Object.freeze([
  'field_count',
  'field_name_digest',
  'field_type_classes',
  'failed_predicate_id',
]);
export const PROVIDER_PROOF_RESPONSE_SHAPE_PREDICATE_IDS = Object.freeze([
  'EXACT_FIELD_SET_MISMATCH',
  'FIELD_TYPE_MISMATCH',
  'STATUS_ENUM_MISMATCH',
  'CODE_VALUE_CLASS_MISMATCH',
  'RECEIPT_HASH_FORMAT_MISMATCH',
  'TIMESTAMP_RANGE_MISMATCH',
  'EXPIRY_ORDER_MISMATCH',
  'IDEMPOTENCY_FLAG_MISMATCH',
  'NULLABILITY_MISMATCH',
  'OPERATION_RESULT_MISMATCH',
  'UNEXPECTED_RESULT_SHAPE',
]);
const PROVIDER_PROOF_RESPONSE_TYPE_CLASSES = Object.freeze([
  'null',
  'boolean',
  'number',
  'string',
  'array',
  'object',
  'unknown',
]);
const PROVIDER_RESULT_CODES = Object.freeze([
  '',
  'REQUEST_REPLAY_DETECTED',
  'IDEMPOTENCY_FINGERPRINT_CONFLICT',
  'OPERATIONAL_RUNNER_CANARY_PROOF_REQUIRED',
  'OPERATIONAL_RUNNER_EPOCH_CONFLICT',
  'OPERATIONAL_RUNNER_APPROVAL_STALE',
  'OPERATIONAL_RUNNER_APPROVAL_CONFLICT',
  'OPERATIONAL_RUNNER_REQUEST_DENIED',
]);
const APPROVAL_STATUSES = Object.freeze([
  'ABSENT',
  'ACTIVE',
  'EXPIRED',
  'REVOKED',
  'STALE',
]);
const STORE_CANARY_PROOF_FAILURE_CODES = Object.freeze({
  HTTP_4XX: 'CANARY_PROOF_PROVIDER_HTTP_4XX',
  HTTP_5XX: 'CANARY_PROOF_PROVIDER_HTTP_5XX',
  HTTP_OTHER: 'CANARY_PROOF_PROVIDER_HTTP_OTHER',
  TIMEOUT: 'CANARY_PROOF_PROVIDER_TIMEOUT',
  TRANSPORT: 'CANARY_PROOF_PROVIDER_TRANSPORT_FAILURE',
  ERROR_ENVELOPE: 'CANARY_PROOF_PROVIDER_ERROR_ENVELOPE',
  INVALID_JSON: 'CANARY_PROOF_PROVIDER_INVALID_JSON',
  PAYLOAD: 'CANARY_PROOF_PAYLOAD_VALIDATION_FAILED',
  NAMESPACE: 'CANARY_PROOF_NAMESPACE_KEY_CONSTRUCTION_FAILED',
  RECEIPT: 'CANARY_PROOF_RECEIPT_VALIDATION_FAILED',
  PROJECTION: 'CANARY_PROOF_RECEIPT_PROJECTION_FAILED',
  EXECUTOR: 'CANARY_PROOF_EXECUTOR_EXCEPTION',
});
const OPERATIONAL_ENVELOPE_FIELDS = Object.freeze([
  'operation',
  'fingerprint',
  'receipt_hash',
  'namespace_prefix',
  'environment_digest',
  'environment_id',
  'deployment_sha256',
  'exact_scope_hash',
  'subscriber_subject_ref',
  'purpose',
  'provenance_ref',
  'duration_ms',
  'maximum_approval_duration_ms',
  'maximum_clock_skew_ms',
  'issued_at_ms',
  'issued_at',
  'expires_at',
  'approval_ref',
  'record_etag',
  'environment_record_etag',
  'sequence_digest',
  'canary_proof_ttl_ms',
  'audit_retention_ms',
  'command_retention_ms',
]);
const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const object = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const exactFields = (value, fields) => object(value)
  && Object.keys(value).length === fields.length
  && Object.keys(value).every((field) => fields.includes(field));
const safeRef = (value, max = 160) => typeof value === 'string'
  && value.length >= 3
  && value.length <= max
  && /^[a-zA-Z0-9:_-]+$/.test(value);
const timestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const jsonClone = (value) => JSON.parse(JSON.stringify(value));
const frozen = (value) => Object.freeze(jsonClone(value));
const hashText = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

class ProviderCommandDiagnosticError extends Error {
  constructor(diagnosticCode, responseShapeDiagnostic = null) {
    super('provider command failed');
    this.name = 'ProviderCommandDiagnosticError';
    this.diagnosticCode = diagnosticCode;
    this.responseShapeDiagnostic = validateProviderProofResponseShapeDiagnosticV1(
      responseShapeDiagnostic,
    )
      ? responseShapeDiagnostic
      : null;
  }
}

function providerCommandFailure(diagnosticCode, responseShapeDiagnostic = null) {
  return new ProviderCommandDiagnosticError(diagnosticCode, responseShapeDiagnostic);
}

const OPERATIONAL_SCRIPT = String.raw`-- private-live-operational-runner-v1
local input = cjson.decode(ARGV[1])
local t = redis.call('TIME')
local now = (tonumber(t[1]) * 1000) + math.floor(tonumber(t[2]) / 1000)

for index = 1, #KEYS do
  if string.sub(KEYS[index], 1, string.len(input.namespace_prefix))
      ~= input.namespace_prefix then
    return redis.error_reply('NAMESPACE_MISMATCH')
  end
end

local function decode(key)
  local serialized = redis.call('GET', key)
  if not serialized then return nil end
  local ok, value = pcall(cjson.decode, serialized)
  if not ok or type(value) ~= 'table' then return nil end
  return value
end

local function append_audit(operation, decision, failure_code, receipt_hash)
  redis.call('XADD', KEYS[5], 'MAXLEN', '~', '10000', '*',
    'event_type', operation,
    'decision', decision,
    'failure_code', failure_code or '',
    'receipt_hash', receipt_hash,
    'exact_scope_hash', input.exact_scope_hash,
    'deployment_hash', input.deployment_sha256,
    'occurred_at_ms', tostring(now))
  redis.call('XTRIM', KEYS[5], 'MINID', '~',
    tostring(now - input.audit_retention_ms) .. '-0')
end

local function finish(ok, status, code, epoch, approval_status, expires_at_ms,
    preserve_prior_command)
  local value = {
    ok = ok,
    status = status,
    code = code,
    provider_time_ms = now,
    receipt_hash = input.receipt_hash,
    epoch = epoch == nil and cjson.null or epoch,
    approval_status = approval_status == nil and cjson.null or approval_status,
    expires_at_ms = expires_at_ms == nil and cjson.null or expires_at_ms,
    idempotent_replay = false
  }
  append_audit(input.operation, ok and 'ALLOWED' or 'DENIED', code, input.receipt_hash)
  if preserve_prior_command ~= true then
    redis.call('SET', KEYS[6], cjson.encode({
      fingerprint = input.fingerprint,
      completed = true
    }), 'PX', tostring(input.command_retention_ms))
  end
  return cjson.encode(value)
end

local prior = decode(KEYS[6])
if prior ~= nil then
  if prior.fingerprint == input.fingerprint then
    return finish(false, 'DENIED', 'REQUEST_REPLAY_DETECTED', nil, nil, nil, true)
  end
  return finish(false, 'DENIED', 'IDEMPOTENCY_FINGERPRINT_CONFLICT',
    nil, nil, nil, true)
end

if input.operation == 'STORE_CANARY_PROOF' then
  local proof = {
    proof_version = 'private-live-operational-canary-proof-v1',
    deployment_sha256 = input.deployment_sha256,
    exact_scope_hash = input.exact_scope_hash,
    sequence_digest = input.sequence_digest,
    issued_at_ms = now,
    expires_at_ms = now + input.canary_proof_ttl_ms
  }
  redis.call('SET', KEYS[1], cjson.encode(proof), 'PX',
    tostring(input.canary_proof_ttl_ms))
  return finish(true, 'HEALTHY', '', nil, nil, proof.expires_at_ms)
end

local proof = decode(KEYS[1])
if proof == nil
  or proof.proof_version ~= 'private-live-operational-canary-proof-v1'
  or proof.deployment_sha256 ~= input.deployment_sha256
  or proof.exact_scope_hash ~= input.exact_scope_hash
  or tonumber(proof.expires_at_ms or 0) <= now then
  return finish(false, 'DENIED', 'OPERATIONAL_RUNNER_CANARY_PROOF_REQUIRED',
    nil, nil, nil)
end

local scope_epoch = decode(KEYS[3])
local environment_epoch = decode(KEYS[4])
local scope_value = scope_epoch == nil and 0
  or tonumber(scope_epoch.security_epoch or scope_epoch.epoch or 0)
local environment_value = environment_epoch == nil and 0
  or tonumber(environment_epoch.security_epoch or environment_epoch.epoch or 0)

if input.operation == 'CREATE_SYNTHETIC_EPOCH_1' then
  if (scope_value ~= 0 and scope_value ~= 1)
    or (environment_value ~= 0 and environment_value ~= 1) then
    return finish(false, 'DENIED', 'OPERATIONAL_RUNNER_EPOCH_CONFLICT',
      math.max(scope_value, environment_value), nil, nil)
  end
  if scope_epoch == nil then
    scope_epoch = {
      record_type = 'security-epoch-v1',
      record_version = 1,
      environment_digest = input.environment_digest,
      exact_scope_hash = input.exact_scope_hash,
      security_epoch = 1,
      epoch = 1,
      status = 'ACTIVE',
      reason_code = 'SYNTHETIC_PRIVATE_LIVE_QUALIFICATION',
      created_at_ms = now,
      updated_at_ms = now,
      record_etag = input.record_etag
    }
    redis.call('SET', KEYS[3], cjson.encode(scope_epoch))
  end
  if environment_epoch == nil then
    environment_epoch = {
      record_type = 'security-epoch-v1',
      record_version = 1,
      environment_digest = input.environment_digest,
      security_epoch = 1,
      epoch = 1,
      status = 'ACTIVE',
      reason_code = 'SYNTHETIC_PRIVATE_LIVE_QUALIFICATION',
      created_at_ms = now,
      updated_at_ms = now,
      record_etag = input.environment_record_etag
    }
    redis.call('SET', KEYS[4], cjson.encode(environment_epoch))
  end
  return finish(true, 'ACTIVE', '', 1, nil, nil)
end

if input.operation == 'READ_SYNTHETIC_EPOCH' then
  if scope_value < 1 or environment_value < 1 then
    return finish(true, 'ABSENT', '', 0, nil, nil)
  end
  return finish(true, 'ACTIVE', '', math.max(scope_value, environment_value),
    nil, nil)
end

if input.operation == 'ADVANCE_SYNTHETIC_EPOCH_1_TO_2' then
  if scope_value ~= 1 or environment_value ~= 1 then
    return finish(false, 'DENIED', 'OPERATIONAL_RUNNER_EPOCH_CONFLICT',
      math.max(scope_value, environment_value), nil, nil)
  end
  scope_epoch.security_epoch = 2
  scope_epoch.epoch = 2
  scope_epoch.reason_code = 'SYNTHETIC_PRIVATE_LIVE_ROLLBACK'
  scope_epoch.updated_at_ms = now
  scope_epoch.record_etag = input.record_etag
  redis.call('SET', KEYS[3], cjson.encode(scope_epoch))
  return finish(true, 'ACTIVE', '', 2, nil, nil)
end

local approval = decode(KEYS[2])
if input.operation == 'CREATE_SYNTHETIC_APPROVAL' then
  if scope_value ~= 1 or environment_value ~= 1 then
    return finish(false, 'DENIED', 'OPERATIONAL_RUNNER_APPROVAL_STALE',
      math.max(scope_value, environment_value), nil, nil)
  end
  if approval ~= nil then
    return finish(false, 'DENIED', 'OPERATIONAL_RUNNER_APPROVAL_CONFLICT',
      scope_value, approval.status, tonumber(approval.expires_at_ms or 0))
  end
  local duration_ms = tonumber(input.duration_ms)
  if duration_ms == nil or duration_ms < 60000
    or duration_ms > input.maximum_approval_duration_ms
    or math.abs(tonumber(input.issued_at_ms) - now) > input.maximum_clock_skew_ms then
    return finish(false, 'DENIED', 'OPERATIONAL_RUNNER_REQUEST_DENIED',
      scope_value, nil, nil)
  end
  approval = {
    record_type = 'private-test-approval-v1',
    record_version = 1,
    environment_digest = input.environment_digest,
    approval_ref = input.approval_ref,
    environment_id = input.environment_id,
    subscriber_subject_ref = input.subscriber_subject_ref,
    exact_scope_hash = input.exact_scope_hash,
    purpose = 'TEMPORARY_PRIVATE_SUBSCRIPTION_TEST',
    provenance_ref = input.provenance_ref,
    status = 'ACTIVE',
    approval_epoch = 1,
    security_epoch = 1,
    issued_at = input.issued_at,
    expires_at = input.expires_at,
    issued_at_ms = input.issued_at_ms,
    expires_at_ms = input.issued_at_ms + duration_ms,
    created_at_ms = now,
    updated_at_ms = now,
    record_etag = input.record_etag
  }
  redis.call('SET', KEYS[2], cjson.encode(approval), 'PX', tostring(duration_ms))
  return finish(true, 'ACTIVE', '', 1, 'ACTIVE', approval.expires_at_ms)
end

if input.operation == 'READ_SYNTHETIC_APPROVAL' then
  if approval == nil then
    return finish(true, 'ABSENT', '', math.max(scope_value, environment_value),
      'ABSENT', nil)
  end
  local approval_status = approval.status
  if approval.status == 'REVOKED' then
    approval_status = 'REVOKED'
  elseif tonumber(approval.expires_at_ms or 0) <= now then
    approval_status = 'EXPIRED'
  elseif tonumber(approval.security_epoch or 0)
      ~= math.max(scope_value, environment_value) then
    approval_status = 'STALE'
  end
  return finish(true, approval_status, '', math.max(scope_value, environment_value),
    approval_status, tonumber(approval.expires_at_ms or 0))
end

if input.operation == 'REVOKE_SYNTHETIC_APPROVAL' then
  if approval == nil then
    return finish(false, 'DENIED', 'OPERATIONAL_RUNNER_APPROVAL_CONFLICT',
      math.max(scope_value, environment_value), 'ABSENT', nil)
  end
  approval.status = 'REVOKED'
  approval.updated_at_ms = now
  approval.revoked_at_ms = now
  approval.record_etag = input.record_etag
  local remaining = math.max(60000, tonumber(approval.expires_at_ms or now) - now)
  redis.call('SET', KEYS[2], cjson.encode(approval), 'PX', tostring(remaining))
  return finish(true, 'REVOKED', '', math.max(scope_value, environment_value),
    'REVOKED', tonumber(approval.expires_at_ms or 0))
end

return finish(false, 'DENIED', 'OPERATIONAL_RUNNER_REQUEST_DENIED',
  nil, nil, nil)`;

function locked() {
  return frozen({
    ok: false,
    allowed: false,
    code: 'OPERATIONAL_RUNNER_LOCKED',
  });
}

export const PRIVATE_BETA_LAUNCH_STAGE_RECEIPT_VERSION =
  'private-beta-launch-stage-receipt-v1';
export const PRIVATE_BETA_LAUNCH_DIAGNOSTIC_STAGES = Object.freeze([
  'RUNNER_AUTHORIZATION',
  'DEPLOYMENT_BINDING',
  'PROVIDER_CONFIGURATION',
  'PROVIDER_EXECUTION',
  'PROOF_STORAGE',
  'RUNTIME_ENABLEMENT',
]);
const PRIVATE_BETA_LAUNCH_STAGE_RECEIPT_FIELDS = Object.freeze([
  'receipt_version',
  'stage',
  'status',
  'stop_code',
  'provider_health_call_count',
  'expected_provider_state',
  'observed_provider_state',
  'provider_failure_code',
  'proof_storage_attempted',
  'proof_storage_succeeded',
]);
const PRIVATE_BETA_PROVIDER_STATES = Object.freeze([
  'UNCONFIGURED',
  'HEALTHY',
  'DEGRADED',
  'UNAVAILABLE',
  'PARTITIONED',
  'RECOVERING',
]);

const safeDiagnosticCode = (value) => typeof value === 'string'
  && /^[A-Z][A-Z0-9_]{2,95}$/.test(value);

export function validatePrivateBetaLaunchStageReceiptV1(value) {
  return exactFields(value, PRIVATE_BETA_LAUNCH_STAGE_RECEIPT_FIELDS)
    && value.receipt_version === PRIVATE_BETA_LAUNCH_STAGE_RECEIPT_VERSION
    && PRIVATE_BETA_LAUNCH_DIAGNOSTIC_STAGES.includes(value.stage)
    && value.status === 'FAILED'
    && safeDiagnosticCode(value.stop_code)
    && Number.isInteger(value.provider_health_call_count)
    && value.provider_health_call_count >= 0
    && value.provider_health_call_count <= 3
    && (value.expected_provider_state === null
      || PRIVATE_BETA_PROVIDER_STATES.includes(value.expected_provider_state))
    && (value.observed_provider_state === null
      || PRIVATE_BETA_PROVIDER_STATES.includes(value.observed_provider_state))
    && (value.provider_failure_code === null
      || safeDiagnosticCode(value.provider_failure_code))
    && typeof value.proof_storage_attempted === 'boolean'
    && typeof value.proof_storage_succeeded === 'boolean'
    && (!value.proof_storage_succeeded || value.proof_storage_attempted);
}

export function createPrivateBetaLaunchStageReceiptV1({
  stage,
  stop_code,
  provider_health_call_count = 0,
  expected_provider_state = null,
  observed_provider_state = null,
  provider_failure_code = null,
  proof_storage_attempted = false,
  proof_storage_succeeded = false,
} = {}) {
  const value = {
    receipt_version: PRIVATE_BETA_LAUNCH_STAGE_RECEIPT_VERSION,
    stage,
    status: 'FAILED',
    stop_code,
    provider_health_call_count,
    expected_provider_state,
    observed_provider_state,
    provider_failure_code,
    proof_storage_attempted,
    proof_storage_succeeded,
  };
  return validatePrivateBetaLaunchStageReceiptV1(value) ? frozen(value) : null;
}

export function validateProviderProofResponseShapeDiagnosticV1(value) {
  return exactFields(value, PROVIDER_PROOF_RESPONSE_SHAPE_DIAGNOSTIC_FIELDS)
    && Number.isInteger(value.field_count)
    && value.field_count >= 0
    && value.field_count <= 32
    && sha256(value.field_name_digest)
    && Array.isArray(value.field_type_classes)
    && value.field_type_classes.length === value.field_count
    && value.field_type_classes.every(
      (entry) => PROVIDER_PROOF_RESPONSE_TYPE_CLASSES.includes(entry),
    )
    && PROVIDER_PROOF_RESPONSE_SHAPE_PREDICATE_IDS.includes(
      value.failed_predicate_id,
    );
}

function denied(
  code = 'OPERATIONAL_RUNNER_REQUEST_DENIED',
  stageReceipt = null,
  responseShapeDiagnostic = null,
) {
  const value = {
    ok: false,
    allowed: false,
    code,
    stage_receipt: validatePrivateBetaLaunchStageReceiptV1(stageReceipt)
      ? stageReceipt
      : null,
  };
  if (validateProviderProofResponseShapeDiagnosticV1(responseShapeDiagnostic)) {
    value.provider_proof_diagnostic = responseShapeDiagnostic;
  }
  return frozen(value);
}

function parseAuthority(env, nowMs) {
  const serialized = env?.[PRIVATE_LIVE_OPERATIONAL_RUNNER_AUTHORITY_VARIABLE];
  if (typeof serialized !== 'string' || serialized.length < 2 || serialized.length > 8192) {
    return null;
  }
  let value;
  try {
    value = JSON.parse(serialized);
  } catch {
    return null;
  }
  if (!exactFields(value, AUTHORITY_FIELDS)
    || value.authority_version !== PRIVATE_LIVE_OPERATIONAL_RUNNER_AUTHORITY_VERSION
    || value.enabled !== true
    || !sha256(value.deployment_sha256)
    || value.deployment_sha256 !== env.MORE_PRIVATE_RUNTIME_IMMUTABLE_DEPLOYMENT_SHA256
    || !timestamp(value.expires_at)
    || Date.parse(value.expires_at) <= nowMs
    || !sha256(value.authorization_sha256)
    || !Array.isArray(value.allowed_operations)
    || value.allowed_operations.length !== PRIVATE_LIVE_OPERATIONAL_RUNNER_OPERATIONS.length
    || !PRIVATE_LIVE_OPERATIONAL_RUNNER_OPERATIONS.every(
      (operation) => value.allowed_operations.includes(operation),
    )) {
    return null;
  }
  return value;
}

function serverContextLocked(env) {
  return env?.VERCEL !== '1'
    || env?.VERCEL_ENV !== 'production'
    || env?.NODE_ENV !== 'production'
    || env?.MORE_PRIVATE_RUNTIME_LIVE_ENABLED !== 'false'
    || env?.MORE_PRIVATE_RUNTIME_EMERGENCY_DISABLED !== 'false'
    || env?.MORE_SUBDEV1_OPERATOR_ENABLED !== 'false'
    || !sha256(env?.MORE_PRIVATE_RUNTIME_IMMUTABLE_DEPLOYMENT_SHA256);
}

export function authorizePrivateLiveOperationalRunnerRequestV1({
  req,
  env = globalThis.process?.env || {},
  nowMs = Date.now(),
} = {}) {
  if (serverContextLocked(env)
    || req?.method !== 'POST'
    || /^application\/json(?:\s*;\s*[^;=\s]+\s*=\s*(?:"[^"]*"|[^;\s]+))*\s*$/i
      .test(String(req?.headers?.['content-type'] || '')) !== true
    || req?.headers?.origin != null
    || req?.headers?.referer != null
    || req?.headers?.['sec-fetch-site'] != null
    || req?.headers?.['sec-fetch-mode'] != null) {
    return locked();
  }
  const authority = parseAuthority(env, nowMs);
  const supplied = req?.headers?.['x-more-private-live-runner-authorization'];
  if (!authority || typeof supplied !== 'string' || supplied.length < 32 || supplied.length > 256) {
    return locked();
  }
  const suppliedDigest = hashText(supplied);
  const expected = Buffer.from(authority.authorization_sha256, 'hex');
  const actual = Buffer.from(suppliedDigest, 'hex');
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return locked();
  }
  return Object.freeze({
    ok: true,
    allowed: true,
    authority,
  });
}

function sameFixedScope(value) {
  return exactFields(value, SCOPE_FIELDS)
    && SCOPE_FIELDS.every(
      (field) => value[field] === PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE[field],
    );
}

export function validatePrivateLiveOperationalRunnerRequestV1(value) {
  if (!object(value)
    || !PRIVATE_LIVE_OPERATIONAL_RUNNER_OPERATIONS.includes(value.operation)
    || !safeRef(value.request_id)
    || !sameFixedScope(value.scope)) {
    return denied();
  }
  if (value.operation === 'CREATE_SYNTHETIC_APPROVAL') {
    if (!exactFields(value, APPROVAL_REQUEST_FIELDS)
      || !Number.isInteger(value.duration_minutes)
      || value.duration_minutes < 1
      || value.duration_minutes > MAX_APPROVAL_MINUTES) {
      return denied();
    }
  } else if (!exactFields(value, COMMON_REQUEST_FIELDS)) {
    return denied();
  }
  return Object.freeze({ ok: true, allowed: true, value: frozen(value) });
}

async function createProviderExecutor({
  authority,
  fetchImpl,
  providerCommandExecutor,
}) {
  if (typeof providerCommandExecutor === 'function') return providerCommandExecutor;
  const [endpoint, credential] = await Promise.all([
    authority.resolve_secret_reference(
      authority.remote_configuration.provider_endpoint_ref,
      { purpose: 'REMOTE_SHARED_SECURITY_PROVIDER_ENDPOINT', secret: true },
    ),
    authority.resolve_secret_reference(
      authority.remote_configuration.provider_credential_ref,
      { purpose: 'REMOTE_SHARED_SECURITY_PROVIDER_CREDENTIAL', secret: true },
    ),
  ]);
  if (typeof endpoint !== 'string'
    || !endpoint.startsWith('https://')
    || typeof credential !== 'string'
    || credential.length < 16
    || typeof fetchImpl !== 'function') {
    return null;
  }
  return async function executeProviderCommand(command) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      let response;
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${credential}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(command),
          signal: controller.signal,
        });
      } catch (error) {
        throw providerCommandFailure(
          controller.signal.aborted || error?.name === 'AbortError'
            ? STORE_CANARY_PROOF_FAILURE_CODES.TIMEOUT
            : STORE_CANARY_PROOF_FAILURE_CODES.TRANSPORT,
        );
      }
      if (!response?.ok) {
        const status = Number(response?.status);
        throw providerCommandFailure(
          status >= 400 && status <= 499
            ? STORE_CANARY_PROOF_FAILURE_CODES.HTTP_4XX
            : status >= 500 && status <= 599
              ? STORE_CANARY_PROOF_FAILURE_CODES.HTTP_5XX
              : STORE_CANARY_PROOF_FAILURE_CODES.HTTP_OTHER,
        );
      }
      let body;
      try {
        body = await response.json();
      } catch {
        throw providerCommandFailure(STORE_CANARY_PROOF_FAILURE_CODES.INVALID_JSON);
      }
      if (!body || Object.hasOwn(body, 'error') || !Object.hasOwn(body, 'result')) {
        throw providerCommandFailure(
          STORE_CANARY_PROOF_FAILURE_CODES.ERROR_ENVELOPE,
        );
      }
      return body.result;
    } finally {
      clearTimeout(timeout);
    }
  };
}

function operationalInvocation({
  operation,
  request,
  authority,
  keyspace,
  sequenceDigest = null,
  nowMs,
}) {
  const fingerprint = hashCanonicalJson({
    operation,
    request_id: request.request_id,
    exact_scope_hash: PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.exact_scope_hash,
    duration_minutes: request.duration_minutes || null,
  });
  const idempotencyKeyHash = hashCanonicalJson({
    domain: PRIVATE_LIVE_OPERATIONAL_RUNNER_VERSION,
    request_id: request.request_id,
  });
  const receiptHash = hashCanonicalJson({
    domain: PRIVATE_LIVE_OPERATIONAL_RUNNER_VERSION,
    fingerprint,
    deployment_sha256: authority.immutable_deployment_identity,
  });
  const issuedAt = new Date(nowMs).toISOString();
  const durationMs = (request.duration_minutes || 0) * 60 * 1000;
  const provenanceRef = hashCanonicalJson({
    domain: 'private-live-operational-synthetic-provenance-v1',
    deployment_sha256: authority.immutable_deployment_identity,
    exact_scope_hash: PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.exact_scope_hash,
    request_id: request.request_id,
  });
  const envelope = {
    operation,
    fingerprint,
    receipt_hash: receiptHash,
    namespace_prefix:
      `${keyspace.prefix}:{${keyspace.namespace_digest}}:`,
    environment_digest: keyspace.namespace_digest,
    environment_id: authority.authority_packet.environment_id,
    deployment_sha256: authority.immutable_deployment_identity,
    exact_scope_hash: PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.exact_scope_hash,
    subscriber_subject_ref:
      PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.subscriber_subject_ref,
    purpose: APPROVAL_PURPOSE,
    provenance_ref: provenanceRef,
    duration_ms: durationMs,
    maximum_approval_duration_ms: MAX_APPROVAL_MINUTES * 60 * 1000,
    maximum_clock_skew_ms: 5 * 60 * 1000,
    issued_at_ms: nowMs,
    issued_at: issuedAt,
    expires_at: durationMs > 0
      ? new Date(nowMs + durationMs).toISOString()
      : null,
    approval_ref:
      `synthetic_approval_${receiptHash.slice(0, 32)}`,
    record_etag: hashCanonicalJson({ receiptHash, record: 'scope_or_approval' }),
    environment_record_etag:
      hashCanonicalJson({ receiptHash, record: 'environment_epoch' }),
    sequence_digest: sequenceDigest,
    canary_proof_ttl_ms: CANARY_PROOF_TTL_MS,
    audit_retention_ms: 30 * 24 * 60 * 60 * 1000,
    command_retention_ms: 90 * 60 * 1000,
  };
  const proofKey = keyspace.auditUnique(hashCanonicalJson({
    domain: 'private_live_operational_canary_proof',
    exact_scope_hash: PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.exact_scope_hash,
  }));
  return {
    receiptHash,
    command: [
      'EVAL',
      OPERATIONAL_SCRIPT,
      6,
      proofKey,
      keyspace.approval(
        PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.subscriber_subject_ref,
        PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.exact_scope_hash,
      ),
      keyspace.scopeEpoch(PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.exact_scope_hash),
      keyspace.environment_epoch,
      keyspace.audit,
      keyspace.commandResult(idempotencyKeyHash),
      JSON.stringify(envelope),
    ],
  };
}

function parseProofInvocationEnvelope(invocation) {
  if (!object(invocation)
    || !Array.isArray(invocation.command)
    || invocation.command.length !== 10
    || typeof invocation.command[9] !== 'string') {
    return null;
  }
  let envelope;
  try {
    envelope = JSON.parse(invocation.command[9]);
  } catch {
    return null;
  }
  return envelope;
}

function validProofInvocationPayload(invocation, envelope) {
  return exactFields(envelope, OPERATIONAL_ENVELOPE_FIELDS)
    && envelope.operation === 'STORE_CANARY_PROOF'
    && sha256(invocation.receiptHash)
    && envelope.receipt_hash === invocation.receiptHash
    && sha256(envelope.fingerprint)
    && sha256(envelope.environment_digest)
    && safeRef(envelope.environment_id)
    && sha256(envelope.deployment_sha256)
    && sha256(envelope.exact_scope_hash)
    && safeRef(envelope.subscriber_subject_ref)
    && envelope.purpose === APPROVAL_PURPOSE
    && sha256(envelope.provenance_ref)
    && envelope.duration_ms === 0
    && envelope.maximum_approval_duration_ms === MAX_APPROVAL_MINUTES * 60 * 1000
    && envelope.maximum_clock_skew_ms === 5 * 60 * 1000
    && Number.isSafeInteger(envelope.issued_at_ms)
    && envelope.issued_at_ms >= 0
    && timestamp(envelope.issued_at)
    && envelope.expires_at === null
    && safeRef(envelope.approval_ref)
    && sha256(envelope.record_etag)
    && sha256(envelope.environment_record_etag)
    && sha256(envelope.sequence_digest)
    && envelope.canary_proof_ttl_ms === CANARY_PROOF_TTL_MS
    && envelope.audit_retention_ms === 30 * 24 * 60 * 60 * 1000
    && envelope.command_retention_ms === 90 * 60 * 1000;
}

function validProofInvocationNamespace(invocation, envelope, keyspace) {
  const command = invocation.command;
  const expectedPrefix = `${keyspace.prefix}:{${keyspace.namespace_digest}}:`;
  const keys = command.slice(3, 9);
  return command[0] === 'EVAL'
    && command[1] === OPERATIONAL_SCRIPT
    && command[2] === 6
    && envelope.namespace_prefix === expectedPrefix
    && keys.length === 6
    && keys.every((key) => typeof key === 'string' && key.startsWith(expectedPrefix))
    && new Set(keys).size === keys.length;
}

function validProviderResultForOperation(value, operation) {
  if (!exactFields(value, PROVIDER_RESULT_FIELDS)
    || typeof value.ok !== 'boolean'
    || !['HEALTHY', 'ACTIVE', 'ABSENT', 'EXPIRED', 'REVOKED', 'STALE', 'DENIED']
      .includes(value.status)
    || !PROVIDER_RESULT_CODES.includes(value.code)
    || !Number.isSafeInteger(value.provider_time_ms)
    || value.provider_time_ms < 0
    || !sha256(value.receipt_hash)
    || (value.epoch !== null && (!Number.isInteger(value.epoch) || value.epoch < 0))
    || (value.approval_status !== null
      && !APPROVAL_STATUSES.includes(value.approval_status))
    || (value.expires_at_ms !== null
      && (!Number.isSafeInteger(value.expires_at_ms) || value.expires_at_ms <= 0))
    || value.idempotent_replay !== false) {
    return false;
  }
  if (!value.ok) return value.status === 'DENIED' && value.code !== '';
  if (value.code !== '') return false;
  switch (operation) {
    case 'STORE_CANARY_PROOF':
      return value.status === 'HEALTHY'
        && value.epoch === null
        && value.approval_status === null
        && value.expires_at_ms > value.provider_time_ms;
    case 'CREATE_SYNTHETIC_EPOCH_1':
      return value.status === 'ACTIVE'
        && value.epoch === 1
        && value.approval_status === null
        && value.expires_at_ms === null;
    case 'READ_SYNTHETIC_EPOCH':
      return ['ABSENT', 'ACTIVE'].includes(value.status)
        && value.epoch !== null
        && value.approval_status === null
        && value.expires_at_ms === null;
    case 'ADVANCE_SYNTHETIC_EPOCH_1_TO_2':
      return value.status === 'ACTIVE'
        && value.epoch === 2
        && value.approval_status === null
        && value.expires_at_ms === null;
    case 'CREATE_SYNTHETIC_APPROVAL':
      return value.status === 'ACTIVE'
        && value.epoch === 1
        && value.approval_status === 'ACTIVE'
        && value.expires_at_ms > value.provider_time_ms;
    case 'READ_SYNTHETIC_APPROVAL':
      return APPROVAL_STATUSES.includes(value.status)
        && value.epoch !== null
        && value.approval_status === value.status
        && (value.status === 'ABSENT'
          ? value.expires_at_ms === null
          : value.expires_at_ms !== null);
    case 'REVOKE_SYNTHETIC_APPROVAL':
      return value.status === 'REVOKED'
        && value.epoch !== null
        && value.approval_status === 'REVOKED'
        && value.expires_at_ms !== null;
    default:
      return false;
  }
}

function providerResultTypeClass(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  if (value && typeof value === 'object') return 'object';
  return 'unknown';
}

function failedProviderResultPredicate(value, operation) {
  if (!object(value)) return 'UNEXPECTED_RESULT_SHAPE';
  if (!exactFields(value, PROVIDER_RESULT_FIELDS)) return 'EXACT_FIELD_SET_MISMATCH';
  if (value.ok === null
    || value.status === null
    || value.code === null
    || value.provider_time_ms === null
    || value.receipt_hash === null
    || value.idempotent_replay === null) {
    return 'NULLABILITY_MISMATCH';
  }
  if (typeof value.ok !== 'boolean'
    || typeof value.status !== 'string'
    || typeof value.code !== 'string'
    || typeof value.provider_time_ms !== 'number'
    || typeof value.receipt_hash !== 'string'
    || (value.epoch !== null && typeof value.epoch !== 'number')
    || (value.approval_status !== null && typeof value.approval_status !== 'string')
    || (value.expires_at_ms !== null && typeof value.expires_at_ms !== 'number')
    || typeof value.idempotent_replay !== 'boolean') {
    return 'FIELD_TYPE_MISMATCH';
  }
  if (!['HEALTHY', 'ACTIVE', 'ABSENT', 'EXPIRED', 'REVOKED', 'STALE', 'DENIED']
    .includes(value.status)) {
    return 'STATUS_ENUM_MISMATCH';
  }
  if (!PROVIDER_RESULT_CODES.includes(value.code)
    || (!value.ok && value.code === '')
    || (value.ok && value.code !== '')) {
    return 'CODE_VALUE_CLASS_MISMATCH';
  }
  if (!Number.isSafeInteger(value.provider_time_ms) || value.provider_time_ms < 0
    || (value.expires_at_ms !== null
      && (!Number.isSafeInteger(value.expires_at_ms) || value.expires_at_ms <= 0))) {
    return 'TIMESTAMP_RANGE_MISMATCH';
  }
  if (!sha256(value.receipt_hash)) return 'RECEIPT_HASH_FORMAT_MISMATCH';
  if (value.epoch !== null && (!Number.isInteger(value.epoch) || value.epoch < 0)) {
    return 'FIELD_TYPE_MISMATCH';
  }
  if (value.approval_status !== null
    && !APPROVAL_STATUSES.includes(value.approval_status)) {
    return 'STATUS_ENUM_MISMATCH';
  }
  if (value.idempotent_replay !== false) return 'IDEMPOTENCY_FLAG_MISMATCH';
  if (!value.ok) {
    return value.status === 'DENIED'
      ? 'OPERATION_RESULT_MISMATCH'
      : 'STATUS_ENUM_MISMATCH';
  }
  switch (operation) {
    case 'STORE_CANARY_PROOF':
      if (value.status !== 'HEALTHY') return 'STATUS_ENUM_MISMATCH';
      if (value.epoch !== null
        || value.approval_status !== null
        || value.expires_at_ms === null) return 'NULLABILITY_MISMATCH';
      return value.expires_at_ms > value.provider_time_ms
        ? 'OPERATION_RESULT_MISMATCH'
        : 'EXPIRY_ORDER_MISMATCH';
    case 'CREATE_SYNTHETIC_EPOCH_1':
      if (value.status !== 'ACTIVE') return 'STATUS_ENUM_MISMATCH';
      if (value.epoch === null
        || value.approval_status !== null
        || value.expires_at_ms !== null) return 'NULLABILITY_MISMATCH';
      return 'OPERATION_RESULT_MISMATCH';
    case 'READ_SYNTHETIC_EPOCH':
      if (!['ABSENT', 'ACTIVE'].includes(value.status)) return 'STATUS_ENUM_MISMATCH';
      if (value.epoch === null
        || value.approval_status !== null
        || value.expires_at_ms !== null) return 'NULLABILITY_MISMATCH';
      return 'OPERATION_RESULT_MISMATCH';
    case 'ADVANCE_SYNTHETIC_EPOCH_1_TO_2':
      if (value.status !== 'ACTIVE') return 'STATUS_ENUM_MISMATCH';
      if (value.epoch === null
        || value.approval_status !== null
        || value.expires_at_ms !== null) return 'NULLABILITY_MISMATCH';
      return 'OPERATION_RESULT_MISMATCH';
    case 'CREATE_SYNTHETIC_APPROVAL':
      if (value.status !== 'ACTIVE') return 'STATUS_ENUM_MISMATCH';
      if (value.epoch === null
        || value.approval_status === null
        || value.expires_at_ms === null) return 'NULLABILITY_MISMATCH';
      return value.expires_at_ms > value.provider_time_ms
        ? 'OPERATION_RESULT_MISMATCH'
        : 'EXPIRY_ORDER_MISMATCH';
    case 'READ_SYNTHETIC_APPROVAL':
      if (!APPROVAL_STATUSES.includes(value.status)) return 'STATUS_ENUM_MISMATCH';
      if (value.epoch === null || value.approval_status === null) {
        return 'NULLABILITY_MISMATCH';
      }
      if ((value.status === 'ABSENT' && value.expires_at_ms !== null)
        || (value.status !== 'ABSENT' && value.expires_at_ms === null)) {
        return 'NULLABILITY_MISMATCH';
      }
      return 'OPERATION_RESULT_MISMATCH';
    case 'REVOKE_SYNTHETIC_APPROVAL':
      if (value.status !== 'REVOKED') return 'STATUS_ENUM_MISMATCH';
      if (value.epoch === null
        || value.approval_status === null
        || value.expires_at_ms === null) return 'NULLABILITY_MISMATCH';
      return 'OPERATION_RESULT_MISMATCH';
    default:
      return 'OPERATION_RESULT_MISMATCH';
  }
}

function createProviderProofResponseShapeDiagnostic(value, operation) {
  const fieldNames = object(value) ? Object.keys(value).sort() : [];
  if (fieldNames.length > 32) return null;
  const diagnostic = {
    field_count: fieldNames.length,
    field_name_digest: hashText(JSON.stringify(fieldNames)),
    field_type_classes: fieldNames.map((field) => providerResultTypeClass(value[field])),
    failed_predicate_id: failedProviderResultPredicate(value, operation),
  };
  return validateProviderProofResponseShapeDiagnosticV1(diagnostic)
    ? frozen(diagnostic)
    : null;
}

function normalizeProviderResultNullElision(value) {
  if (!object(value)
    || Object.keys(value).some((field) => !PROVIDER_RESULT_FIELDS.includes(field))
    || PROVIDER_RESULT_REQUIRED_FIELDS.some((field) => !Object.hasOwn(value, field))) {
    return value;
  }
  const missing = PROVIDER_RESULT_NULLABLE_FIELDS.filter(
    (field) => !Object.hasOwn(value, field),
  );
  if (missing.length === 0) return value;
  return Object.freeze({
    ...value,
    ...Object.fromEntries(missing.map((field) => [field, null])),
  });
}

function parseProviderResult(raw, operation) {
  const payload = Array.isArray(raw) && raw.length === 1 ? raw[0] : raw;
  let value;
  try {
    value = typeof payload === 'string' ? JSON.parse(payload) : payload;
  } catch {
    throw providerCommandFailure(STORE_CANARY_PROOF_FAILURE_CODES.INVALID_JSON);
  }
  value = normalizeProviderResultNullElision(value);
  if (!validProviderResultForOperation(value, operation)) {
    throw providerCommandFailure(
      STORE_CANARY_PROOF_FAILURE_CODES.RECEIPT,
      createProviderProofResponseShapeDiagnostic(value, operation),
    );
  }
  return value;
}

function projectResult(operation, value, authority, keyspace) {
  const result = {
    ok: value.ok === true,
    operation,
    status: value.status,
    code: value.code || null,
    provider_states: null,
    provider_timestamps: [new Date(value.provider_time_ms).toISOString()],
    receipt_hashes: [value.receipt_hash],
    scope_hash: PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.exact_scope_hash,
    namespace_hash: keyspace.namespace_digest,
    approval_status: value.approval_status || null,
    expires_at: Number.isSafeInteger(value.expires_at_ms) && value.expires_at_ms > 0
      ? new Date(value.expires_at_ms).toISOString()
      : null,
    epoch: Number.isInteger(value.epoch) ? value.epoch : null,
    deployment_hash: authority.immutable_deployment_identity,
    rollback_status: 'RUNNER_DEFAULT_OFF_REVOKE_APPROVAL_ADVANCE_EPOCH_DISABLE',
  };
  return frozen(result);
}

export async function buildPrivateLiveOperationalRunnerV1({
  env = globalThis.process?.env || {},
  resolveReference,
  fetchImpl = globalThis.fetch,
  clock = () => Date.now(),
  authorityReader = readPrivateRuntimeLiveConfigurationAuthorityV1,
  productExecutionBindingReader = readPrivateLiveProductExecutionBindingV1,
  adapterFactory = createUpstashRedisRemoteSharedSecurityAdapter,
  providerCommandExecutor = null,
  proofInvocationTransform = null,
  createProductStoreClient = (url) => new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 5_000,
    commandTimeout: 5_000,
    ...(url.startsWith('rediss://') ? { tls: {} } : {}),
  }),
} = {}) {
  if (serverContextLocked(env)) {
    return denied(
      'OPERATIONAL_RUNNER_CONFIGURATION_INVALID',
      createPrivateBetaLaunchStageReceiptV1({
        stage: 'RUNNER_AUTHORIZATION',
        stop_code: 'RUNNER_CONFIGURATION_INVALID',
      }),
    );
  }
  const runnerAuthority = parseAuthority(env, clock());
  const adapterSourceSha256 = env.MORE_PRIVATE_RUNTIME_QUALIFIED_ADAPTER_SOURCE_SHA256;
  if (!runnerAuthority || !sha256(adapterSourceSha256)) {
    return denied(
      'OPERATIONAL_RUNNER_CONFIGURATION_INVALID',
      createPrivateBetaLaunchStageReceiptV1({
        stage: 'RUNNER_AUTHORIZATION',
        stop_code: 'RUNNER_CONFIGURATION_INVALID',
      }),
    );
  }
  const authority = await authorityReader({
    env,
    resolveReference,
    adapterImplementationId: UPSTASH_REMOTE_SHARED_SECURITY_ADAPTER_VERSION,
    adapterSourceSha256,
    nowMs: clock(),
  });
  const productBinding = authority?.product_binding_attestation;
  const expectedExactScope = Object.fromEntries(EXACT_SCOPE_FIELDS.map((field) => (
    [field, PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE[field]]
  )));
  if (!authority?.ok
    || authority.authority_packet?.live_enabled !== false
    || authority.authority_packet?.emergency_disabled !== false
    || authority.activation_receipt != null
    || authority.immutable_deployment_identity !== runnerAuthority.deployment_sha256
    || productBinding?.subscriber_subject_ref
      !== PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.subscriber_subject_ref
    || !exactFields(productBinding?.exact_scope, EXACT_SCOPE_FIELDS)
    || !EXACT_SCOPE_FIELDS.every((field) => (
      productBinding.exact_scope[field] === expectedExactScope[field]
    ))
    || productBinding?.exact_scope_hash
      !== PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.exact_scope_hash) {
    return denied(
      'OPERATIONAL_RUNNER_AUTHORITY_INVALID',
      createPrivateBetaLaunchStageReceiptV1({
        stage: 'DEPLOYMENT_BINDING',
        stop_code: 'DEPLOYMENT_BINDING_INVALID',
      }),
    );
  }
  const scopeHashKey = await authority.resolve_secret_reference(
    authority.remote_configuration.scope_hash_key_ref,
    { purpose: 'PRIVATE_RUNTIME_SCOPE_HASH_KEY', secret: true },
  );
  if (typeof scopeHashKey !== 'string' || scopeHashKey.length < 32) {
    return denied(
      'OPERATIONAL_RUNNER_AUTHORITY_INVALID',
      createPrivateBetaLaunchStageReceiptV1({
        stage: 'PROVIDER_CONFIGURATION',
        stop_code: 'SCOPE_HASH_KEY_REFERENCE_INVALID',
      }),
    );
  }
  const keyedDigest = createQualificationDigestFunction(scopeHashKey);
  const keyspace = createRemoteSharedSecurityKeyspace({
    namespace_digest: authority.remote_configuration.namespace_digest,
    digest: keyedDigest,
  });
  const adapter = adapterFactory({
    configuration: authority.remote_configuration,
    operating_mode: 'PRIVATE_LIVE',
    qualification_certificate: authority.qualification_certificate,
    live_environment_attestation: authority.live_environment_attestation,
    expected_adapter_source_sha256: adapterSourceSha256,
    expected_qualification_review_package_sha256:
      '28b42df527bea92dce9a0ccfab9b72a933f8975529e3f02a64853b289f0c47ac',
    expected_attestation_repair_review_package_sha256:
      '4545be94544cdaf29940a45968ef2ac52b6865ed901aac87b84c265bf69f1b45',
    resolve_secret_reference: authority.resolve_secret_reference,
    keyed_digest: keyedDigest,
    fetch_impl: fetchImpl,
    clock,
  });
  if (!adapter || typeof adapter.health !== 'function') {
    return denied(
      'OPERATIONAL_RUNNER_AUTHORITY_INVALID',
      createPrivateBetaLaunchStageReceiptV1({
        stage: 'PROVIDER_CONFIGURATION',
        stop_code: 'PROVIDER_ADAPTER_INVALID',
      }),
    );
  }
  const executeProviderCommand = await createProviderExecutor({
    authority,
    fetchImpl,
    providerCommandExecutor,
  });
  if (typeof executeProviderCommand !== 'function') {
    return denied(
      'OPERATIONAL_RUNNER_PROVIDER_UNAVAILABLE',
      createPrivateBetaLaunchStageReceiptV1({
        stage: 'PROVIDER_CONFIGURATION',
        stop_code: 'PROVIDER_EXECUTOR_UNAVAILABLE',
      }),
    );
  }

  async function runProviderOperation(operation, request, sequenceDigest = null) {
    const proofFailure = (stopCode, responseShapeDiagnostic = null) => denied(
      'OPERATIONAL_RUNNER_PROVIDER_UNAVAILABLE',
      operation === 'STORE_CANARY_PROOF'
        ? createPrivateBetaLaunchStageReceiptV1({
          stage: 'PROOF_STORAGE',
          stop_code: stopCode,
          provider_failure_code: stopCode,
          proof_storage_attempted: true,
          proof_storage_succeeded: false,
        })
        : null,
      operation === 'STORE_CANARY_PROOF' ? responseShapeDiagnostic : null,
    );
    let invocation;
    try {
      invocation = operationalInvocation({
        operation,
        request,
        authority,
        keyspace,
        sequenceDigest,
        nowMs: clock(),
      });
      if (operation === 'STORE_CANARY_PROOF'
        && typeof proofInvocationTransform === 'function') {
        invocation = proofInvocationTransform(invocation);
      }
    } catch {
      return proofFailure(STORE_CANARY_PROOF_FAILURE_CODES.PAYLOAD);
    }
    if (operation === 'STORE_CANARY_PROOF') {
      const envelope = parseProofInvocationEnvelope(invocation);
      if (!validProofInvocationPayload(invocation, envelope)) {
        return proofFailure(STORE_CANARY_PROOF_FAILURE_CODES.PAYLOAD);
      }
      if (!validProofInvocationNamespace(invocation, envelope, keyspace)) {
        return proofFailure(STORE_CANARY_PROOF_FAILURE_CODES.NAMESPACE);
      }
    }
    let raw;
    try {
      raw = await executeProviderCommand(invocation.command);
    } catch (error) {
      const stopCode = error instanceof ProviderCommandDiagnosticError
        ? error.diagnosticCode
        : error?.name === 'AbortError'
          ? STORE_CANARY_PROOF_FAILURE_CODES.TIMEOUT
          : STORE_CANARY_PROOF_FAILURE_CODES.EXECUTOR;
      return proofFailure(stopCode, error?.responseShapeDiagnostic);
    }
    let parsed;
    try {
      parsed = parseProviderResult(raw, operation);
    } catch (error) {
      return proofFailure(
        error instanceof ProviderCommandDiagnosticError
          ? error.diagnosticCode
          : STORE_CANARY_PROOF_FAILURE_CODES.RECEIPT,
        error?.responseShapeDiagnostic,
      );
    }
    try {
      return projectResult(request.operation, parsed, authority, keyspace);
    } catch {
      return proofFailure(STORE_CANARY_PROOF_FAILURE_CODES.PROJECTION);
    }
  }

  async function runFixedSyntheticProductFixture() {
    const productExecution = await productExecutionBindingReader({
      env,
      resolveReference: authority.resolve_secret_reference,
      environmentId: authority.authority_packet.environment_id,
      configurationAuthorityPacketSha256:
        authority.authority_packet.packet_sha256,
      productBindingAttestation: productBinding,
      nowMs: clock(),
    });
    const binding = productExecution?.binding;
    if (!productExecution?.ok
      || binding?.business_engine_execution_contract_sha256
        !== FIXED_SYNTHETIC_BUSINESS_ENGINE_CONTRACT_SHA256
      || binding?.exact_scope?.profile_id
        !== FIXED_SYNTHETIC_PRODUCT_FIXTURE_PROFILE_ID
      || !binding?.approved_profile_ids?.includes(
        FIXED_SYNTHETIC_PRODUCT_FIXTURE_PROFILE_ID,
      )
      || binding?.execution_enabled !== true
      || binding?.source_default_off !== true
      || binding?.private_beta_only !== true
      || binding?.public_access !== false
      || binding?.append_only !== true
      || binding?.immutable_history !== true
      || binding?.destructive_updates !== false) {
      return denied('FIXED_SYNTHETIC_FIXTURE_BINDING_MISMATCH');
    }
    let productStoreUrl;
    try {
      productStoreUrl = await authority.resolve_secret_reference(
        binding.product_store_connection_ref,
        { purpose: 'MORE_PRIVATE_RUNTIME_PRODUCT_STORE_CONNECTION', secret: true },
      );
    } catch {
      return denied('FIXED_SYNTHETIC_FIXTURE_STORE_UNAVAILABLE');
    }
    if (!privateRuntimeProductStoreConnectionAllowedV1({
      reference: binding.product_store_connection_ref,
      value: productStoreUrl,
      env,
    })) {
      return denied('FIXED_SYNTHETIC_FIXTURE_STORE_UNAVAILABLE');
    }
    let client;
    try {
      client = createProductStoreClient(productStoreUrl);
      if (typeof client?.connect !== 'function') throw new TypeError();
      await client.connect();
    } catch {
      client?.disconnect?.();
      return denied('FIXED_SYNTHETIC_FIXTURE_STORE_UNAVAILABLE');
    }
    try {
      const fixture = await createFixedSyntheticProfileAndBaFixtureV1({ client });
      if (!fixture.ok) return denied(fixture.code);
      return frozen({
        ok: true,
        operation: 'CREATE_FIXED_SYNTHETIC_PRODUCT_FIXTURE',
        status: fixture.status,
        code: null,
        provider_states: null,
        provider_timestamps: [],
        receipt_hashes: [fixture.fixture_digest],
        scope_hash: PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.exact_scope_hash,
        namespace_hash: hashCanonicalJson(binding.persistence_namespace_prefix),
        approval_status: null,
        expires_at: null,
        epoch: null,
        deployment_hash: authority.immutable_deployment_identity,
        rollback_status: 'RUNNER_DEFAULT_OFF_DISABLE_FIXTURE_OPERATION',
        fixture_version: fixture.fixture_version,
        fixture_status: fixture.status,
        fixture_digest: fixture.fixture_digest,
        vault_record_hash: fixture.vault_record_hash,
        assessment_record_hash: fixture.assessment_record_hash,
        assessment_pointer_hash: fixture.assessment_pointer_hash,
        business_engine_contract_sha256:
          fixture.business_engine_contract_sha256,
        records_created: fixture.records_created,
        keys_created: fixture.keys_created,
        idempotent: fixture.idempotent,
        customer_data: false,
        arbitrary_profile_input: false,
      });
    } finally {
      client?.disconnect?.();
    }
  }

  return Object.freeze({
    runner_version: PRIVATE_LIVE_OPERATIONAL_RUNNER_VERSION,
    ok: true,
    allowed: false,
    source_default_off: true,
    execute: async (input) => {
      const currentRunnerAuthority = parseAuthority(env, clock());
      if (serverContextLocked(env)
        || !currentRunnerAuthority
        || currentRunnerAuthority.deployment_sha256
          !== runnerAuthority.deployment_sha256) {
        return denied('OPERATIONAL_RUNNER_LOCKED');
      }
      const checked = validatePrivateLiveOperationalRunnerRequestV1(input);
      if (!checked.ok
        || !currentRunnerAuthority.allowed_operations.includes(checked.value.operation)) {
        return denied();
      }
      if (checked.value.operation === 'PROVIDER_HEALTH_CANARY') {
        const decisions = [];
        for (let index = 0; index < 3; index += 1) {
          const expected = index < 2 ? 'RECOVERING' : 'HEALTHY';
          let decision;
          try {
            decision = await adapter.health();
          } catch {
            return denied(
              'OPERATIONAL_RUNNER_CANARY_SEQUENCE_INVALID',
              createPrivateBetaLaunchStageReceiptV1({
                stage: 'PROVIDER_EXECUTION',
                stop_code: 'PROVIDER_HEALTH_CALL_FAILED',
                provider_health_call_count: index + 1,
                expected_provider_state: expected,
              }),
            );
          }
          decisions.push(decision);
          const validation = validateAsyncSecurityHealth(decision);
          if (!validation.valid || decision.state !== expected) {
            return denied(
              'OPERATIONAL_RUNNER_CANARY_SEQUENCE_INVALID',
              createPrivateBetaLaunchStageReceiptV1({
                stage: 'PROVIDER_EXECUTION',
                stop_code: 'PROVIDER_HEALTH_SEQUENCE_INVALID',
                provider_health_call_count: decisions.length,
                expected_provider_state: expected,
                observed_provider_state:
                  PRIVATE_BETA_PROVIDER_STATES.includes(decision?.state)
                    ? decision.state
                    : null,
                provider_failure_code: safeDiagnosticCode(decision?.failure_code)
                  ? decision.failure_code
                  : null,
              }),
            );
          }
        }
        const sequenceDigest = hashCanonicalJson(decisions.map((decision) => ({
          state: decision.state,
          server_time: decision.server_time,
          receipt_hash: hashCanonicalJson(decision.receipt_ref),
        })));
        const stored = await runProviderOperation(
          'STORE_CANARY_PROOF',
          checked.value,
          sequenceDigest,
        );
        if (!stored.ok) {
          const proofFailureCode = validatePrivateBetaLaunchStageReceiptV1(
            stored.stage_receipt,
          )
            ? stored.stage_receipt.stop_code
            : safeDiagnosticCode(stored.code)
              ? stored.code
              : 'CANARY_PROOF_STORAGE_FAILED';
          return denied(
            stored.code || 'OPERATIONAL_RUNNER_PROVIDER_UNAVAILABLE',
            createPrivateBetaLaunchStageReceiptV1({
              stage: 'PROOF_STORAGE',
              stop_code: proofFailureCode,
              provider_health_call_count: 3,
              expected_provider_state: 'HEALTHY',
              observed_provider_state: 'HEALTHY',
              provider_failure_code: proofFailureCode,
              proof_storage_attempted: true,
              proof_storage_succeeded: false,
            }),
            stored.provider_proof_diagnostic,
          );
        }
        return frozen({
          ...stored,
          proof_storage_succeeded: true,
          proof_storage_receipt_hash: stored.receipt_hashes[0],
          provider_states: decisions.map((decision) => decision.state),
          provider_timestamps: decisions.map((decision) => decision.server_time),
          receipt_hashes: decisions.map(
            (decision) => hashCanonicalJson(decision.receipt_ref),
          ),
        });
      }
      if (checked.value.operation === 'CREATE_FIXED_SYNTHETIC_PRODUCT_FIXTURE') {
        return runFixedSyntheticProductFixture();
      }
      return runProviderOperation(checked.value.operation, checked.value);
    },
  });
}
