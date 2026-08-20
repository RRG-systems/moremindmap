import crypto from 'node:crypto';
import { hashCanonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';
import {
  ASYNC_SECURITY_QUERY_RESULT_VERSION,
  ASYNC_SECURITY_QUERY_TYPES,
} from '../asyncSecurityContracts.js';
import {
  RemoteSharedSecurityAdapterError,
  assertRemoteQueryResult,
  validateRemoteQueryEnvelope,
} from './contracts.js';
import {
  validateCanonicalPrivateTestApprovalRecordV1,
  validateRemoteSecurityRecord,
} from './recordSchemas.js';

export const REMOTE_SHARED_SECURITY_QUERY_SCRIPT_VERSION =
  'remote-shared-security-query-lua-v1';

const sha256Text = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const frozen = (value) => deepFreeze(structuredClone(value));
const timestampMs = (value) => Number.isSafeInteger(value) && value >= 0;

const LUA_COMMON = String.raw`
local envelope = cjson.decode(ARGV[1])
local query = envelope.query
local idx = envelope.key_index
local function k(label)
  local position = idx[label]
  if position == nil then return nil end
  return KEYS[position]
end
local function now_ms()
  local t = redis.call('TIME')
  return (tonumber(t[1]) * 1000) + math.floor(tonumber(t[2]) / 1000)
end
local function decode_key_name(key_name)
  if key_name == nil then return nil end
  local value = redis.call('GET', key_name)
  if value == false then return nil end
  local ok, decoded = pcall(cjson.decode, value)
  if not ok then return { __corrupt = true } end
  return decoded
end
local function decode_label(label)
  return decode_key_name(k(label))
end
local function active(record, now)
  if record == nil or record.__corrupt == true or record.status ~= 'ACTIVE' then return false end
  if record.expires_at_ms == nil then return true end
  return tonumber(record.expires_at_ms) > now
end
local function canonical_private_test_approval(record)
  return record ~= nil
    and record.__corrupt ~= true
    and record.record_type == 'private-test-approval-v1'
    and type(record.record_version) == 'number'
    and record.record_version == 1
end
local function strip_internal(record)
  if record == nil then return nil end
  record.inverse_key = nil
  record.forward_key = nil
  record.token_key = nil
  record.mapping_inverse_key = nil
  record.scope_epoch_key = nil
  record.session_key = nil
  record.approval_key = nil
  return record
end
local function audit_query(now, decision, failure)
  redis.call(
    'XADD',
    k('audit_stream'),
    'MAXLEN',
    '~',
    tostring(envelope.audit_max_entries),
    '*',
    'receipt_ref', envelope.receipt_ref,
    'event_type', query.query_type,
    'decision', decision,
    'failure_code', failure or '',
    'environment_digest', envelope.environment_digest,
    'correlation_ref', query.correlation_ref,
    'occurred_at_ms', tostring(now),
    'configuration_digest', envelope.configuration_digest,
    'script_digest', envelope.script_digest
  )
  redis.call(
    'XTRIM',
    k('audit_stream'),
    'MINID',
    '~',
    tostring(now - envelope.audit_retention_ms) .. '-0'
  )
end
local function deny(code, now)
  audit_query(now, 'DENIED', code)
  return cjson.encode({
    ok = false,
    query_type = query.query_type,
    consistency_proven = false,
    server_time_ms = now,
    record_version = cjson.null,
    record = cjson.null,
    failure_code = code,
    receipt_ref = envelope.receipt_ref
  })
end
local function allow(record, version, now)
  audit_query(now, 'ALLOWED', nil)
  return cjson.encode({
    ok = true,
    query_type = query.query_type,
    consistency_proven = true,
    server_time_ms = now,
    record_version = version,
    record = record,
    failure_code = cjson.null,
    receipt_ref = envelope.receipt_ref
  })
end
local now = now_ms()
if envelope.environment_digest ~= envelope.expected_environment_digest then
  return deny('SHARED_SECURITY_STATE_PARTITIONED', now)
end
redis.call('SET', k('heartbeat'), envelope.script_digest, 'PX', tostring(envelope.heartbeat_ttl_ms))
local environment_epoch = decode_label('environment_epoch')
if environment_epoch == nil or environment_epoch.__corrupt == true then
  return deny('SHARED_SECURITY_STATE_RECOVERING', now)
end
if environment_epoch.status == 'EMERGENCY_DISABLED' then
  return deny('EMERGENCY_DISABLED', now)
end
`;

const LUA_QUERIES = {
  RESOLVE_CANONICAL_SUBJECT: String.raw`
local mapping = decode_label('subject_forward')
if mapping == nil then return deny('SUBJECT_MAPPING_NOT_FOUND', now) end
if mapping.__corrupt == true or mapping.status ~= 'ACTIVE' then
  return deny(mapping.status == 'DISABLED' and 'SUBJECT_DISABLED' or 'SUBJECT_MAPPING_AMBIGUOUS', now)
end
local inverse = decode_key_name(mapping.inverse_key)
if inverse == nil or inverse.__corrupt == true
  or inverse.subscriber_subject_ref ~= mapping.subscriber_subject_ref
  or inverse.exact_scope_hash ~= mapping.exact_scope_hash then
  return deny('SUBJECT_MAPPING_AMBIGUOUS', now)
end
mapping.external_subject_ref = query.subject_ref
return allow(strip_internal(mapping), 1, now)
`,
  RESOLVE_EXACT_SCOPE: String.raw`
local inverse = decode_label('subject_inverse')
if inverse == nil then return deny('SUBJECT_MAPPING_NOT_FOUND', now) end
local forward = decode_key_name(inverse.forward_key)
if forward == nil or forward.__corrupt == true or inverse.__corrupt == true
  or forward.subscriber_subject_ref ~= inverse.subscriber_subject_ref
  or forward.exact_scope_hash ~= inverse.exact_scope_hash
  or (query.subject_ref ~= cjson.null and query.subject_ref ~= inverse.subscriber_subject_ref) then
  return deny('EXACT_SCOPE_MISMATCH', now)
end
inverse.external_subject_ref = inverse.external_subject_ref or forward.external_subject_ref
return allow(strip_internal(inverse), 1, now)
`,
  GET_SESSION_BY_TOKEN_HASH: String.raw`
local session = decode_label('session_token')
if session == nil then return deny('SESSION_NOT_FOUND', now) end
if not active(session, now) then
  return deny(session.status == 'REVOKED' and 'SESSION_REVOKED'
    or session.status == 'ROTATED' and 'SESSION_ROTATED'
    or 'SESSION_EXPIRED', now)
end
if session.session_class == 'AUTHENTICATED' then
  local epoch = decode_key_name(session.scope_epoch_key)
  local inverse = decode_key_name(session.mapping_inverse_key)
  if epoch == nil or inverse == nil
    or tonumber(epoch.security_epoch or epoch.epoch or 0) ~= tonumber(session.security_epoch or 0)
    or inverse.subscriber_subject_ref ~= session.subscriber_subject_ref then
    return deny('SESSION_REVOKED', now)
  end
end
session.session_token_hash = query.session_token_hash
return allow(strip_internal(session), 2, now)
`,
  GET_TEMPORARY_ENTITLEMENT_BY_TOKEN_HASH: String.raw`
local entitlement = decode_label('entitlement_token')
if entitlement == nil then return deny('ENTITLEMENT_REQUIRED', now) end
if not active(entitlement, now) then
  return deny(entitlement.status == 'REVOKED' or entitlement.status == 'EMERGENCY_REVOKED'
    and 'ENTITLEMENT_REVOKED' or entitlement.status == 'ROTATED'
    and 'ENTITLEMENT_ROTATED' or 'ENTITLEMENT_EXPIRED', now)
end
local session = decode_key_name(entitlement.session_key)
local approval = decode_key_name(entitlement.approval_key)
local epoch = decode_key_name(entitlement.scope_epoch_key)
if not active(session, now) or not active(approval, now) or epoch == nil
  or entitlement.temporary ~= true or entitlement.paid_entitlement ~= false
  or entitlement.billing_evidence ~= false or entitlement.stripe_subscription_created ~= false
  or entitlement.subscriber_subject_ref ~= session.subscriber_subject_ref
  or entitlement.exact_scope_hash ~= session.exact_scope_hash
  or tonumber(entitlement.security_epoch or 0) ~= tonumber(epoch.security_epoch or epoch.epoch or 0) then
  return deny('ENTITLEMENT_INVALID', now)
end
entitlement.entitlement_token_hash = query.entitlement_token_hash
return allow(strip_internal(entitlement), 2, now)
`,
  GET_PRIVATE_TEST_APPROVAL: String.raw`
local approval = decode_label('approval')
if approval == nil then return deny('PRIVATE_TEST_APPROVAL_REQUIRED', now) end
if not canonical_private_test_approval(approval) then
  return deny('PRIVATE_TEST_APPROVAL_REQUIRED', now)
end
if not active(approval, now) then
  return deny(approval.status == 'REVOKED' and 'PRIVATE_TEST_APPROVAL_REVOKED'
    or 'PRIVATE_TEST_APPROVAL_EXPIRED', now)
end
if approval.subscriber_subject_ref ~= query.subject_ref
  or approval.exact_scope_hash ~= query.exact_scope_hash then
  return deny('EXACT_SCOPE_MISMATCH', now)
end
return allow(strip_internal(approval), 1, now)
`,
  READ_AUTHORITY_SNAPSHOT: String.raw`
local session = decode_label('session_token')
local entitlement = decode_label('entitlement_token')
local inverse = decode_label('subject_inverse')
local approval = decode_label('approval')
local epoch = decode_label('scope_epoch')
if session == nil or entitlement == nil or inverse == nil or approval == nil or epoch == nil then
  return deny('RUNTIME_AUTHORITY_DENIED', now)
end
if not canonical_private_test_approval(approval) then
  return deny('RUNTIME_AUTHORITY_DENIED', now)
end
local forward = decode_key_name(inverse.forward_key)
if forward == nil or not active(session, now) or not active(entitlement, now)
  or not active(approval, now) or inverse.status ~= 'ACTIVE'
  or forward.subscriber_subject_ref ~= inverse.subscriber_subject_ref
  or query.subject_ref ~= inverse.subscriber_subject_ref
  or query.exact_scope_hash ~= inverse.exact_scope_hash
  or session.subscriber_subject_ref ~= inverse.subscriber_subject_ref
  or entitlement.subscriber_subject_ref ~= inverse.subscriber_subject_ref
  or approval.subscriber_subject_ref ~= inverse.subscriber_subject_ref
  or session.exact_scope_hash ~= inverse.exact_scope_hash
  or entitlement.exact_scope_hash ~= inverse.exact_scope_hash
  or approval.exact_scope_hash ~= inverse.exact_scope_hash
  or entitlement.authenticated_session_ref ~= session.authenticated_session_ref
  or entitlement.browser_binding_hash ~= session.browser_binding_hash
  or entitlement.temporary ~= true or entitlement.paid_entitlement ~= false
  or entitlement.admin_authority ~= false or entitlement.operator_authority ~= false
  or entitlement.deployment_authority ~= false or entitlement.billing_authority ~= false
  or entitlement.canonical_mutation_authority ~= false then
  return deny('CROSS_SUBSCRIBER_SCOPE_MISMATCH', now)
end
local security_epoch = tonumber(epoch.security_epoch or epoch.epoch or 0)
if security_epoch < 1 or tonumber(session.security_epoch or 0) ~= security_epoch
  or tonumber(approval.security_epoch or 0) ~= security_epoch
  or tonumber(entitlement.security_epoch or 0) ~= security_epoch then
  return deny('RUNTIME_AUTHORITY_DENIED', now)
end
forward.external_subject_ref = inverse.external_subject_ref
session.session_token_hash = query.session_token_hash
entitlement.entitlement_token_hash = query.entitlement_token_hash
local valid_until = math.min(
  tonumber(session.expires_at_ms),
  tonumber(approval.expires_at_ms),
  tonumber(entitlement.expires_at_ms)
)
local snapshot = {
  mapping = strip_internal(forward),
  session = strip_internal(session),
  approval = strip_internal(approval),
  entitlement = strip_internal(entitlement),
  security_epoch = security_epoch,
  evaluated_at_ms = now,
  snapshot_valid_until_ms = valid_until,
  snapshot_generation = tostring(security_epoch) .. ':' .. tostring(now)
}
return allow(snapshot, 2, now)
`,
  GET_SECURITY_EPOCH: String.raw`
local scope_epoch = decode_label('scope_epoch')
if scope_epoch == nil then return deny('SUBJECT_MAPPING_STALE', now) end
local environment_value = tonumber(environment_epoch.security_epoch or environment_epoch.epoch or 0)
local scope_value = tonumber(scope_epoch.security_epoch or scope_epoch.epoch or 0)
if environment_value < 1 or scope_value < 1 then return deny('SUBJECT_MAPPING_STALE', now) end
return allow({
  exact_scope_hash = query.exact_scope_hash,
  security_epoch = math.max(environment_value, scope_value),
  environment_epoch = environment_value,
  scope_epoch = scope_value,
  status = scope_epoch.status
}, 1, now)
`,
  GET_REPLAY_RESULT: String.raw`
local replay = decode_label('replay')
if replay == nil or replay.status ~= 'COMPLETED' or tonumber(replay.expires_at_ms or 0) <= now then
  return deny('REQUEST_REPLAY_DETECTED', now)
end
return allow(strip_internal(replay), 2, now)
`,
};

function querySource(queryType) {
  return `-- ${REMOTE_SHARED_SECURITY_QUERY_SCRIPT_VERSION}:${queryType}\n`
    + `local EXPECTED_QUERY = '${queryType}'\n`
    + LUA_COMMON
    + "\nif query.query_type ~= EXPECTED_QUERY then return deny('ASYNC_SECURITY_CONTRACT_VIOLATION', now) end\n"
    + LUA_QUERIES[queryType];
}

export function remoteSharedSecurityQueryScriptManifest() {
  return frozen(ASYNC_SECURITY_QUERY_TYPES.map((query_type) => {
    const source = querySource(query_type);
    return {
      script_version: REMOTE_SHARED_SECURITY_QUERY_SCRIPT_VERSION,
      operation_class: 'AUTHORITATIVE_QUERY',
      operation_type: query_type,
      primitive: 'EVAL',
      source,
      sha256: sha256Text(source),
      write_routed: true,
      primary_authority_required: true,
      ordinary_get_prohibited: true,
      local_cache_authority: false,
      internally_consistent_snapshot: query_type === 'READ_AUTHORITY_SNAPSHOT',
    };
  }));
}

export function remoteSharedSecurityQueryScript(queryType) {
  return remoteSharedSecurityQueryScriptManifest()
    .find((entry) => entry.operation_type === queryType) || null;
}

function queryKeys(query, keyspace) {
  switch (query.query_type) {
    case 'RESOLVE_CANONICAL_SUBJECT':
      return { subject_forward: keyspace.externalSubject(query.subject_ref) };
    case 'RESOLVE_EXACT_SCOPE':
      return { subject_inverse: keyspace.exactScope(query.exact_scope_hash) };
    case 'GET_SESSION_BY_TOKEN_HASH':
      return { session_token: keyspace.sessionToken(query.session_token_hash) };
    case 'GET_TEMPORARY_ENTITLEMENT_BY_TOKEN_HASH':
      return { entitlement_token: keyspace.entitlementToken(query.entitlement_token_hash) };
    case 'GET_PRIVATE_TEST_APPROVAL':
      return { approval: keyspace.approval(query.subject_ref, query.exact_scope_hash) };
    case 'READ_AUTHORITY_SNAPSHOT':
      return {
        session_token: keyspace.sessionToken(query.session_token_hash),
        entitlement_token: keyspace.entitlementToken(query.entitlement_token_hash),
        subject_inverse: keyspace.exactScope(query.exact_scope_hash),
        approval: keyspace.approval(query.subject_ref, query.exact_scope_hash),
        scope_epoch: keyspace.scopeEpoch(query.exact_scope_hash),
      };
    case 'GET_SECURITY_EPOCH':
      return { scope_epoch: keyspace.scopeEpoch(query.exact_scope_hash) };
    case 'GET_REPLAY_RESULT':
      return { replay: keyspace.replay(query.subject_ref) };
    default:
      throw new RemoteSharedSecurityAdapterError('ASYNC_SECURITY_CONTRACT_VIOLATION');
  }
}

export function buildRemoteAuthoritativeQueryInvocation(query, {
  keyspace,
  configuration_digest,
  environment_digest,
  audit_max_entries = 10000,
  audit_retention_ms = 24 * 60 * 60 * 1000,
  heartbeat_ttl_ms = 60000,
} = {}) {
  const checked = validateRemoteQueryEnvelope(query);
  const script = remoteSharedSecurityQueryScript(checked.query_type);
  if (!script || !keyspace) throw new RemoteSharedSecurityAdapterError('SCRIPT_VERSION_MISMATCH');
  const operationKeys = queryKeys(checked, keyspace);
  const labels = [
    'heartbeat',
    'audit_stream',
    'environment_epoch',
    ...Object.keys(operationKeys),
  ];
  const keys = [
    keyspace.canary(hashCanonicalJson({
      query_type: checked.query_type,
      correlation_ref: checked.correlation_ref,
    })),
    keyspace.audit,
    keyspace.environment_epoch,
    ...Object.values(operationKeys),
  ];
  const keyIndex = Object.fromEntries(labels.map((label, index) => [label, index + 1]));
  const envelope = {
    query: checked,
    key_index: keyIndex,
    environment_digest,
    expected_environment_digest: keyspace.namespace_digest,
    configuration_digest,
    script_digest: script.sha256,
    audit_max_entries,
    audit_retention_ms,
    heartbeat_ttl_ms,
    receipt_ref: `query_${hashCanonicalJson({
      query_type: checked.query_type,
      correlation_ref: checked.correlation_ref,
    }).slice(0, 32)}`,
  };
  return frozen({
    primitive: 'EVAL',
    operation_class: 'AUTHORITATIVE_QUERY',
    operation_type: checked.query_type,
    script_sha256: script.sha256,
    command: ['EVAL', script.source, keys.length, ...keys, JSON.stringify(envelope)],
    key_count: keys.length,
    ordinary_reads: 0,
    write_routed: true,
    local_cache_authority: false,
    internally_consistent_snapshot: checked.query_type === 'READ_AUTHORITY_SNAPSHOT',
  });
}

function normalizeProviderRecord(record, queryType) {
  if (queryType !== 'READ_AUTHORITY_SNAPSHOT') return record;
  if (record && Number.isSafeInteger(record.evaluated_at_ms)) {
    return {
      ...record,
      evaluated_at: new Date(record.evaluated_at_ms).toISOString(),
    };
  }
  return record;
}

function assertCanonicalApprovalQueryRecord(record, expectedType, providerTimeMs) {
  const approval = expectedType === 'GET_PRIVATE_TEST_APPROVAL'
    ? record
    : expectedType === 'READ_AUTHORITY_SNAPSHOT'
      ? record?.approval
      : null;
  if (approval == null) return;
  const checked = validateRemoteSecurityRecord(approval, {
    provider_time_ms: providerTimeMs,
    require_active_ttl: true,
  });
  const canonical = validateCanonicalPrivateTestApprovalRecordV1(approval);
  if (!checked.valid || !canonical.valid || approval.status !== 'ACTIVE') {
    throw new RemoteSharedSecurityAdapterError('PROVIDER_RESPONSE_MALFORMED');
  }
}

export function parseRemoteAuthoritativeQueryReply(reply, expectedType) {
  const payload = Array.isArray(reply) && reply.length === 1 ? reply[0] : reply;
  let internal = payload;
  if (typeof internal === 'string') {
    try {
      internal = JSON.parse(internal);
    } catch {
      throw new RemoteSharedSecurityAdapterError('PROVIDER_RESPONSE_MALFORMED');
    }
  }
  if (!internal || typeof internal !== 'object' || !timestampMs(internal.server_time_ms)) {
    throw new RemoteSharedSecurityAdapterError('PROVIDER_RESPONSE_MALFORMED');
  }
  if (internal.ok === true) {
    assertCanonicalApprovalQueryRecord(internal.record, expectedType, internal.server_time_ms);
  }
  const result = {
    result_version: ASYNC_SECURITY_QUERY_RESULT_VERSION,
    ok: internal.ok === true,
    query_type: internal.query_type,
    consistency_proven: internal.consistency_proven === true,
    server_time: new Date(internal.server_time_ms).toISOString(),
    record_version: internal.record_version ?? null,
    record: internal.record ? normalizeProviderRecord(internal.record, expectedType) : null,
    failure_code: internal.failure_code ?? null,
    receipt_ref: internal.receipt_ref,
  };
  return assertRemoteQueryResult(result, expectedType);
}

export function remoteAuthoritativeQueryRetryDecision({
  attempt,
  error_code,
}) {
  return frozen({
    retry: attempt === 0 && ['PROVIDER_TIMEOUT', 'PROVIDER_UNAVAILABLE'].includes(error_code),
    same_primary_path_required: true,
    ordinary_read_fallback_allowed: false,
    local_cache_fallback_allowed: false,
    maximum_attempts: 2,
  });
}
