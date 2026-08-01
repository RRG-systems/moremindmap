import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
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
  readPrivateRuntimeLiveConfigurationAuthorityV1,
} from './configurationAuthority.js';
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

function denied(code = 'OPERATIONAL_RUNNER_REQUEST_DENIED') {
  return frozen({ ok: false, allowed: false, code });
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
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credential}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
        signal: controller.signal,
      });
      if (!response?.ok) throw new Error('provider unavailable');
      const body = await response.json();
      if (!body || Object.hasOwn(body, 'error') || !Object.hasOwn(body, 'result')) {
        throw new Error('provider unavailable');
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

function parseProviderResult(raw, operation) {
  const payload = Array.isArray(raw) && raw.length === 1 ? raw[0] : raw;
  const value = typeof payload === 'string' ? JSON.parse(payload) : payload;
  if (!validProviderResultForOperation(value, operation)) {
    throw new TypeError('provider result invalid');
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
  adapterFactory = createUpstashRedisRemoteSharedSecurityAdapter,
  providerCommandExecutor = null,
} = {}) {
  if (serverContextLocked(env)) return denied('OPERATIONAL_RUNNER_CONFIGURATION_INVALID');
  const runnerAuthority = parseAuthority(env, clock());
  const adapterSourceSha256 = env.MORE_PRIVATE_RUNTIME_QUALIFIED_ADAPTER_SOURCE_SHA256;
  if (!runnerAuthority || !sha256(adapterSourceSha256)) {
    return denied('OPERATIONAL_RUNNER_CONFIGURATION_INVALID');
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
    return denied('OPERATIONAL_RUNNER_AUTHORITY_INVALID');
  }
  const scopeHashKey = await authority.resolve_secret_reference(
    authority.remote_configuration.scope_hash_key_ref,
    { purpose: 'PRIVATE_RUNTIME_SCOPE_HASH_KEY', secret: true },
  );
  if (typeof scopeHashKey !== 'string' || scopeHashKey.length < 32) {
    return denied('OPERATIONAL_RUNNER_AUTHORITY_INVALID');
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
    return denied('OPERATIONAL_RUNNER_AUTHORITY_INVALID');
  }
  const executeProviderCommand = await createProviderExecutor({
    authority,
    fetchImpl,
    providerCommandExecutor,
  });
  if (typeof executeProviderCommand !== 'function') {
    return denied('OPERATIONAL_RUNNER_PROVIDER_UNAVAILABLE');
  }

  async function runProviderOperation(operation, request, sequenceDigest = null) {
    const invocation = operationalInvocation({
      operation,
      request,
      authority,
      keyspace,
      sequenceDigest,
      nowMs: clock(),
    });
    try {
      const raw = await executeProviderCommand(invocation.command);
      return projectResult(
        request.operation,
        parseProviderResult(raw, operation),
        authority,
        keyspace,
      );
    } catch {
      return denied('OPERATIONAL_RUNNER_PROVIDER_UNAVAILABLE');
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
          const decision = await adapter.health();
          decisions.push(decision);
          const expected = index < 2 ? 'RECOVERING' : 'HEALTHY';
          if (!validateAsyncSecurityHealth(decision).valid
            || decision.state !== expected) {
            return denied('OPERATIONAL_RUNNER_CANARY_SEQUENCE_INVALID');
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
        if (!stored.ok) return stored;
        return frozen({
          ...stored,
          provider_states: decisions.map((decision) => decision.state),
          provider_timestamps: decisions.map((decision) => decision.server_time),
          receipt_hashes: decisions.map(
            (decision) => hashCanonicalJson(decision.receipt_ref),
          ),
        });
      }
      return runProviderOperation(checked.value.operation, checked.value);
    },
  });
}
