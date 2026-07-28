import crypto from 'node:crypto';
import { deepFreeze } from '../../../validation.js';
import { ASYNC_SECURITY_COMMAND_TYPES } from '../asyncSecurityContracts.js';

export const REMOTE_SHARED_SECURITY_SCRIPT_MANIFEST_VERSION =
  'remote-shared-security-script-manifest-v1';
export const REMOTE_SHARED_SECURITY_COMMAND_SCRIPT_VERSION =
  'remote-shared-security-command-lua-v1';

const sha256Text = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const frozen = (value) => deepFreeze(structuredClone(value));

const LUA_COMMON = String.raw`
local envelope = cjson.decode(ARGV[1])
local command = envelope.command
local args = command.arguments
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
local function decode_key(label)
  local value = redis.call('GET', k(label))
  if value == false then return nil end
  local ok, decoded = pcall(cjson.decode, value)
  if not ok then return { __corrupt = true } end
  return decoded
end
local function active(record, now)
  return record ~= nil and record.__corrupt ~= true and record.status == 'ACTIVE'
    and tonumber(record.expires_at_ms or 0) > now
end
local function deny(code, now)
  return cjson.encode({
    ok = false,
    command_type = command.command_type,
    committed = false,
    idempotent_replay = false,
    server_time_ms = now,
    new_versions = {},
    result_refs = {},
    failure_code = code,
    audit_receipt_ref = cjson.null
  })
end
local function expiry_ms(record)
  if record == nil then return nil end
  local iso = record.expires_at
  if type(record.expires_at_ms) == 'number' then return record.expires_at_ms end
  if type(envelope.expiry_by_ref) == 'table' and type(iso) == 'string' then
    return envelope.expiry_by_ref[iso]
  end
  return nil
end
local function set_json(label, value, expiry)
  local encoded = cjson.encode(value)
  if expiry ~= nil then
    redis.call('SET', k(label), encoded)
    redis.call('PEXPIREAT', k(label), expiry)
  else
    redis.call('SET', k(label), encoded)
  end
end
local function decode_audit_marker(raw)
  if raw == false or raw == nil then return nil end
  local ok, marker = pcall(cjson.decode, raw)
  if not ok or type(marker) ~= 'table' then return nil end
  return marker
end
local function audit_entry_matches(marker, audit_ref)
  if marker == nil or marker.marker_version ~= 'audit-completion-marker-v2'
    or marker.fingerprint ~= command.fingerprint
    or marker.receipt_ref ~= audit_ref
    or type(marker.stream_id) ~= 'string' then
    return false
  end
  local entries = redis.call(
    'XRANGE',
    k('audit_stream'),
    marker.stream_id,
    marker.stream_id,
    'COUNT',
    1
  )
  if #entries ~= 1 or type(entries[1][2]) ~= 'table' then return false end
  local fields = entries[1][2]
  local receipt = nil
  local fingerprint = nil
  for index = 1, #fields, 2 do
    if fields[index] == 'receipt_ref' then receipt = fields[index + 1] end
    if fields[index] == 'fingerprint' then fingerprint = fields[index + 1] end
  end
  return receipt == audit_ref and fingerprint == command.fingerprint
end
local function audit(now, decision, failure)
  local audit_ref = envelope.audit_receipt_ref
  local prior_raw = redis.call('GET', k('audit_unique'))
  if prior_raw ~= false then
    local prior = decode_audit_marker(prior_raw)
    if prior == nil or prior.fingerprint ~= command.fingerprint then return nil end
    redis.call('DEL', k('audit_unique'))
  end
  local stream_id = redis.call(
    'XADD',
    k('audit_stream'),
    'MAXLEN',
    '~',
    tostring(envelope.audit_max_entries),
    '*',
    'receipt_ref', audit_ref,
    'fingerprint', command.fingerprint,
    'event_type', command.command_type,
    'decision', decision,
    'failure_code', failure or '',
    'environment_digest', envelope.environment_digest,
    'correlation_ref', command.correlation_ref,
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
  redis.call(
    'SET',
    k('audit_unique'),
    cjson.encode({
      marker_version = 'audit-completion-marker-v2',
      fingerprint = command.fingerprint,
      receipt_ref = audit_ref,
      stream_id = stream_id
    }),
    'PX',
    tostring(envelope.audit_retention_ms)
  )
  return audit_ref
end
local function success(now, refs, versions)
  local audit_ref = audit(now, 'ALLOWED', nil)
  if audit_ref == nil then return deny('AUDIT_APPEND_FAILED', now), false end
  return cjson.encode({
    ok = true,
    command_type = command.command_type,
    committed = true,
    idempotent_replay = false,
    server_time_ms = now,
    new_versions = versions or {},
    result_refs = refs or {},
    failure_code = cjson.null,
    audit_receipt_ref = audit_ref
  }), true
end
local now = now_ms()
local prior_raw = redis.call('GET', k('command_result'))
if prior_raw ~= false then
  local prior = cjson.decode(prior_raw)
  if prior.fingerprint ~= command.fingerprint then
    return deny('IDEMPOTENCY_FINGERPRINT_CONFLICT', now)
  end
  if prior.result == nil or prior.result.ok ~= true or prior.result.committed ~= true
    or type(prior.result.audit_receipt_ref) ~= 'string'
    or not audit_entry_matches(
      decode_audit_marker(redis.call('GET', k('audit_unique'))),
      prior.result.audit_receipt_ref
    ) then
    return deny('AUDIT_APPEND_FAILED', now)
  end
  prior.result.idempotent_replay = true
  return cjson.encode(prior.result)
end
if envelope.environment_digest ~= envelope.expected_environment_digest then
  return deny('SHARED_SECURITY_STATE_PARTITIONED', now)
end
if envelope.emergency_disabled == true and command.command_type ~= 'ADVANCE_SECURITY_EPOCH'
  and command.command_type ~= 'REVOKE_RUNTIME_ACCESS'
  and command.command_type ~= 'REVOKE_TEMPORARY_ENTITLEMENT'
  and command.command_type ~= 'APPEND_SECURITY_AUDIT' then
  return deny('EMERGENCY_DISABLED', now)
end
`;

const LUA_OPERATIONS = {
  BIND_APPROVED_CANONICAL_SUBJECT: String.raw`
local mapping = args.subject_mapping
if mapping == nil or mapping.subscriber_confirmed ~= true or mapping.auto_enrolled ~= false
  or mapping.external_subject_ref == nil or mapping.subscriber_subject_ref == nil
  or mapping.exact_scope_hash == nil then
  return deny('SUBJECT_ASSERTION_INVALID', now)
end
local forward = decode_key('subject_forward')
local inverse = decode_key('subject_inverse')
if forward ~= nil or inverse ~= nil then
  if forward ~= nil and inverse ~= nil
    and forward.subscriber_subject_ref == mapping.subscriber_subject_ref
    and inverse.subscriber_subject_ref == mapping.subscriber_subject_ref then
    local result, audit_ok = success(now, { subscriber_subject_ref = mapping.subscriber_subject_ref },
      { mapping_version = tonumber(forward.mapping_version or 1) })
    if not audit_ok then return result end
    redis.call('SET', k('command_result'), cjson.encode({
      fingerprint = command.fingerprint, result = cjson.decode(result)
    }), 'PX', tostring(envelope.idempotency_retention_ms))
    return result
  end
  return deny('SUBJECT_MAPPING_AMBIGUOUS', now)
end
local stored = {
  record_version = 'canonical-subject-mapping-v1',
  subscriber_subject_ref = mapping.subscriber_subject_ref,
  exact_scope_hash = mapping.exact_scope_hash,
  mapping_version = 1,
  security_version = tonumber(mapping.security_version or 1),
  status = 'ACTIVE',
  subscriber_confirmed = true,
  auto_enrolled = false,
  bound_at_ms = now
}
stored.inverse_key = k('subject_inverse')
local inverse_record = {
  external_subject_ref = mapping.external_subject_ref,
  subscriber_subject_ref = stored.subscriber_subject_ref,
  exact_scope_hash = stored.exact_scope_hash,
  mapping_version = 1,
  status = 'ACTIVE',
  forward_key = k('subject_forward')
}
local result, audit_ok = success(now, { subscriber_subject_ref = stored.subscriber_subject_ref },
  { mapping_version = 1 })
if not audit_ok then return result end
set_json('subject_forward', stored, nil)
set_json('subject_inverse', inverse_record, nil)
redis.call('SET', k('command_result'), cjson.encode({
  fingerprint = command.fingerprint, result = cjson.decode(result)
}), 'PX', tostring(envelope.idempotency_retention_ms))
return result
`,
  BEGIN_PRE_AUTH: String.raw`
local session = args.pre_auth_session
local expiry = expiry_ms(session)
if session == nil or session.pre_auth_session_ref == nil or session.session_token_hash == nil
  or session.status ~= 'ACTIVE' or expiry == nil or expiry <= now
  or decode_key('session_token') ~= nil or decode_key('session_ref') ~= nil then
  return deny('SESSION_ELEVATION_REQUIRED', now)
end
session.expires_at_ms = expiry
session.issued_at_ms = now
session.record_version = 'pre-auth-private-session-v2'
session.session_class = 'PRE_AUTH'
local result, audit_ok = success(now, { pre_auth_session_ref = session.pre_auth_session_ref },
  { session_epoch = tonumber(session.session_epoch or 1) })
if not audit_ok then return result end
set_json('session_token', session, expiry)
set_json('session_ref', session, expiry)
redis.call('SET', k('command_result'), cjson.encode({
  fingerprint = command.fingerprint, result = cjson.decode(result)
}), 'PX', tostring(envelope.idempotency_retention_ms))
return result
`,
  ELEVATE_AUTHENTICATED_SESSION: String.raw`
local preauth = decode_key('preauth_ref')
local session = args.authenticated_session
local expiry = expiry_ms(session)
if not active(preauth, now) or preauth.session_class ~= 'PRE_AUTH' or session == nil
  or session.status ~= 'ACTIVE' or session.authenticated_session_ref == nil
  or session.session_token_hash == nil or expiry == nil or expiry <= now
  or decode_key('new_session_token') ~= nil or decode_key('new_session_ref') ~= nil then
  return deny('SESSION_ROTATION_FAILED', now)
end
local mapping = decode_key('subject_inverse')
local epoch = decode_key('scope_epoch')
if mapping == nil or mapping.subscriber_subject_ref ~= session.subscriber_subject_ref
  or mapping.exact_scope_hash ~= session.exact_scope_hash
  or epoch == nil or tonumber(epoch.security_epoch or epoch.epoch or 0) ~= tonumber(session.security_epoch or 0) then
  return deny('SUBJECT_MAPPING_NOT_FOUND', now)
end
preauth.status = 'ROTATED'
preauth.rotated_at_ms = now
session.expires_at_ms = expiry
session.issued_at_ms = now
session.record_version = 'authenticated-private-session-v2'
session.session_class = 'AUTHENTICATED'
session.mapping_inverse_key = k('subject_inverse')
session.scope_epoch_key = k('scope_epoch')
local result, audit_ok = success(now, { authenticated_session_ref = session.authenticated_session_ref },
  { session_epoch = tonumber(session.session_epoch or 1) })
if not audit_ok then return result end
set_json('preauth_ref', preauth, tonumber(preauth.expires_at_ms or expiry))
set_json('preauth_token', preauth, tonumber(preauth.expires_at_ms or expiry))
if k('prior_session_ref') ~= nil and redis.call('EXISTS', k('prior_session_ref')) == 1 then
  local prior = decode_key('prior_session_ref')
  prior.status = 'ROTATED'
  prior.rotated_at_ms = now
  set_json('prior_session_ref', prior, tonumber(prior.expires_at_ms or expiry))
end
set_json('new_session_token', session, expiry)
set_json('new_session_ref', session, expiry)
redis.call('SET', k('command_result'), cjson.encode({
  fingerprint = command.fingerprint, result = cjson.decode(result)
}), 'PX', tostring(envelope.idempotency_retention_ms))
return result
`,
  ISSUE_CSRF_GRANT: String.raw`
local grant = args.csrf_grant
local session = decode_key('session_ref')
local expiry = expiry_ms(grant)
if not active(session, now) or grant == nil or grant.status ~= 'ACTIVE'
  or expiry == nil or expiry <= now or grant.authenticated_session_ref ~= session.authenticated_session_ref
  or grant.browser_binding_hash ~= session.browser_binding_hash
  or decode_key('csrf') ~= nil then
  return deny('CSRF_VALIDATION_FAILED', now)
end
grant.expires_at_ms = expiry
grant.issued_at_ms = now
local result, audit_ok = success(now, { csrf_grant_ref = grant.csrf_grant_ref }, {})
if not audit_ok then return result end
set_json('csrf', grant, expiry)
redis.call('SADD', k('csrf_index'), k('csrf'))
redis.call('PEXPIREAT', k('csrf_index'), expiry)
redis.call('SET', k('command_result'), cjson.encode({
  fingerprint = command.fingerprint, result = cjson.decode(result)
}), 'PX', tostring(envelope.idempotency_retention_ms))
return result
`,
  CONSUME_CSRF_AND_ISSUE_TEMPORARY_ENTITLEMENT: String.raw`
local grant = decode_key('csrf')
local session = decode_key('session_ref')
local approval = decode_key('approval')
local epoch = decode_key('scope_epoch')
local entitlement = args.entitlement
local expiry = expiry_ms(entitlement)
if not active(grant, now) or not active(session, now) or not active(approval, now)
  or epoch == nil or args.code_verified ~= true or entitlement == nil
  or entitlement.temporary ~= true or entitlement.paid_entitlement ~= false
  or entitlement.admin_authority ~= false or entitlement.operator_authority ~= false
  or entitlement.deployment_authority ~= false or entitlement.billing_authority ~= false
  or entitlement.canonical_mutation_authority ~= false or expiry == nil or expiry <= now
  or grant.authenticated_session_ref ~= session.authenticated_session_ref
  or session.subscriber_subject_ref ~= approval.subscriber_subject_ref
  or session.exact_scope_hash ~= approval.exact_scope_hash
  or tonumber(session.security_epoch or 0) ~= tonumber(epoch.security_epoch or epoch.epoch or 0)
  or decode_key('entitlement_token') ~= nil or decode_key('entitlement_ref') ~= nil then
  return deny('ENTITLEMENT_INVALID', now)
end
grant.status = 'CONSUMED'
grant.consumed_at_ms = now
entitlement.expires_at_ms = expiry
entitlement.issued_at_ms = now
entitlement.session_key = k('session_ref')
entitlement.approval_key = k('approval')
entitlement.scope_epoch_key = k('scope_epoch')
local result, audit_ok = success(now, { entitlement_ref = entitlement.entitlement_ref },
  { security_epoch = tonumber(session.security_epoch) })
if not audit_ok then return result end
set_json('csrf', grant, tonumber(grant.expires_at_ms or expiry))
set_json('entitlement_token', entitlement, expiry)
set_json('entitlement_ref', entitlement, expiry)
redis.call('SADD', k('entitlement_index'), k('entitlement_ref'))
redis.call('PEXPIREAT', k('entitlement_index'), expiry)
redis.call('SET', k('command_result'), cjson.encode({
  fingerprint = command.fingerprint, result = cjson.decode(result)
}), 'PX', tostring(envelope.idempotency_retention_ms))
return result
`,
  CLAIM_REPLAY: String.raw`
local replay = decode_key('replay')
if replay ~= nil and replay.fingerprint ~= command.fingerprint then
  return deny('IDEMPOTENCY_FINGERPRINT_CONFLICT', now)
end
local expiry = tonumber(args.expires_at_ms or envelope.default_replay_expires_at_ms)
if expiry == nil or expiry <= now then return deny('ASYNC_SECURITY_SCHEMA_INVALID', now) end
local value = replay or {
  record_version = 'security-replay-claim-v2',
  replay_key_hash = args.replay_key_hash or command.idempotency_key_hash,
  fingerprint = command.fingerprint,
  status = 'CLAIMED',
  result_reference = cjson.null,
  expires_at_ms = expiry
}
local result, audit_ok = success(now, { replay_key_hash = value.replay_key_hash }, {})
if not audit_ok then return result end
set_json('replay', value, expiry)
redis.call('SET', k('command_result'), cjson.encode({
  fingerprint = command.fingerprint, result = cjson.decode(result)
}), 'PX', tostring(envelope.idempotency_retention_ms))
return result
`,
  COMPLETE_REPLAY: String.raw`
local replay = decode_key('replay')
if replay == nil or replay.fingerprint ~= args.claim_fingerprint then
  return deny('REQUEST_REPLAY_DETECTED', now)
end
if replay.status == 'COMPLETED' and replay.result_reference ~= args.result_reference then
  return deny('IDEMPOTENCY_FINGERPRINT_CONFLICT', now)
end
replay.status = 'COMPLETED'
replay.result_reference = args.result_reference
replay.completed_at_ms = now
local result, audit_ok = success(now, { result_reference = replay.result_reference }, {})
if not audit_ok then return result end
set_json('replay', replay, tonumber(replay.expires_at_ms))
redis.call('SET', k('command_result'), cjson.encode({
  fingerprint = command.fingerprint, result = cjson.decode(result)
}), 'PX', tostring(envelope.idempotency_retention_ms))
return result
`,
  REVOKE_TEMPORARY_ENTITLEMENT: String.raw`
local entitlement = decode_key('entitlement_ref')
if entitlement == nil then return deny('ENTITLEMENT_REQUIRED', now) end
entitlement.status = args.emergency == true and 'EMERGENCY_REVOKED' or 'REVOKED'
entitlement.revoked_at_ms = now
local result, audit_ok = success(now, { entitlement_ref = entitlement.entitlement_ref }, {})
if not audit_ok then return result end
set_json('entitlement_ref', entitlement, tonumber(entitlement.expires_at_ms or now + envelope.terminal_retention_ms))
if k('entitlement_token') ~= nil then
  set_json('entitlement_token', entitlement, tonumber(entitlement.expires_at_ms or now + envelope.terminal_retention_ms))
end
redis.call('SREM', k('entitlement_index'), k('entitlement_ref'))
redis.call('SET', k('command_result'), cjson.encode({
  fingerprint = command.fingerprint, result = cjson.decode(result)
}), 'PX', tostring(envelope.idempotency_retention_ms))
return result
`,
  REVOKE_RUNTIME_ACCESS: String.raw`
local session = decode_key('session_ref')
local epoch = decode_key('scope_epoch')
if session == nil or epoch == nil then return deny('SESSION_NOT_FOUND', now) end
session.status = args.emergency == true and 'EMERGENCY_REVOKED' or 'REVOKED'
session.revoked_at_ms = now
local next_epoch = tonumber(epoch.security_epoch or epoch.epoch or 0) + 1
epoch.security_epoch = next_epoch
epoch.epoch = next_epoch
epoch.status = args.emergency == true and 'EMERGENCY_DISABLED' or 'ACTIVE'
epoch.updated_at_ms = now
local entitlement = k('entitlement_ref') ~= nil and decode_key('entitlement_ref') or nil
if entitlement ~= nil then
  entitlement.status = args.emergency == true and 'EMERGENCY_REVOKED' or 'REVOKED'
  entitlement.revoked_at_ms = now
end
local result, audit_ok = success(now, {
  authenticated_session_ref = session.authenticated_session_ref,
  entitlement_revoked = entitlement ~= nil
}, { security_epoch = next_epoch })
if not audit_ok then return result end
set_json('session_ref', session, tonumber(session.expires_at_ms or now + envelope.terminal_retention_ms))
if k('session_token') ~= nil then
  set_json('session_token', session, tonumber(session.expires_at_ms or now + envelope.terminal_retention_ms))
end
set_json('scope_epoch', epoch, nil)
if entitlement ~= nil then
  set_json('entitlement_ref', entitlement, tonumber(entitlement.expires_at_ms or now + envelope.terminal_retention_ms))
end
redis.call('SET', k('command_result'), cjson.encode({
  fingerprint = command.fingerprint, result = cjson.decode(result)
}), 'PX', tostring(envelope.idempotency_retention_ms))
return result
`,
  ADVANCE_SECURITY_EPOCH: String.raw`
local epoch = decode_key('scope_epoch')
local current = epoch == nil and 0 or tonumber(epoch.security_epoch or epoch.epoch or 0)
if args.expected_epoch ~= nil and tonumber(args.expected_epoch) ~= current then
  return deny('SUBJECT_MAPPING_STALE', now)
end
local next_epoch = current + 1
local value = epoch or {
  record_version = 'security-epoch-v1',
  exact_scope_hash = args.exact_scope_hash,
  status = 'ACTIVE'
}
value.security_epoch = next_epoch
value.epoch = next_epoch
value.status = args.emergency == true and 'EMERGENCY_DISABLED' or value.status
value.reason_code = args.reason_code or 'GOVERNED_ADVANCE'
value.updated_at_ms = now
local result, audit_ok = success(now, {}, { security_epoch = next_epoch })
if not audit_ok then return result end
set_json('scope_epoch', value, nil)
redis.call('SET', k('command_result'), cjson.encode({
  fingerprint = command.fingerprint, result = cjson.decode(result)
}), 'PX', tostring(envelope.idempotency_retention_ms))
return result
`,
  APPLY_RATE_LIMIT: String.raw`
local rate = decode_key('rate')
local window_ms = tonumber(args.window_ms)
local limit = tonumber(args.limit)
if window_ms == nil or window_ms <= 0 or limit == nil or limit < 1 then
  return deny('ASYNC_SECURITY_SCHEMA_INVALID', now)
end
if rate == nil or tonumber(rate.resets_at_ms or 0) <= now then
  rate = { count = 0, resets_at_ms = now + window_ms, status = 'ACTIVE' }
end
if tonumber(rate.count) >= limit then return deny('RATE_LIMITED', now) end
rate.count = tonumber(rate.count) + 1
rate.updated_at_ms = now
local result, audit_ok = success(now, {
  remaining = limit - rate.count,
  resets_at = rate.resets_at_ms
}, {})
if not audit_ok then return result end
set_json('rate', rate, rate.resets_at_ms + tonumber(envelope.rate_cooldown_ms))
redis.call('SET', k('command_result'), cjson.encode({
  fingerprint = command.fingerprint, result = cjson.decode(result)
}), 'PX', tostring(envelope.idempotency_retention_ms))
return result
`,
  APPEND_SECURITY_AUDIT: String.raw`
local result, audit_ok = success(now, { audit_receipt_ref = envelope.audit_receipt_ref }, {})
if not audit_ok then return result end
redis.call('SET', k('command_result'), cjson.encode({
  fingerprint = command.fingerprint, result = cjson.decode(result)
}), 'PX', tostring(envelope.idempotency_retention_ms))
return result
`,
};

function commandSource(commandType) {
  return `-- ${REMOTE_SHARED_SECURITY_COMMAND_SCRIPT_VERSION}:${commandType}\n`
    + `local EXPECTED_COMMAND = '${commandType}'\n`
    + LUA_COMMON
    + "\nif command.command_type ~= EXPECTED_COMMAND then return deny('ASYNC_SECURITY_CONTRACT_VIOLATION', now) end\n"
    + LUA_OPERATIONS[commandType];
}

export function remoteSharedSecurityCommandScriptManifest() {
  return frozen(ASYNC_SECURITY_COMMAND_TYPES.map((command_type) => {
    const source = commandSource(command_type);
    return {
      manifest_version: REMOTE_SHARED_SECURITY_SCRIPT_MANIFEST_VERSION,
      script_version: REMOTE_SHARED_SECURITY_COMMAND_SCRIPT_VERSION,
      operation_class: 'ATOMIC_COMMAND',
      operation_type: command_type,
      primitive: 'EVAL',
      source,
      sha256: sha256Text(source),
      maximum_keys: 16,
      maximum_argument_bytes: 16 * 1024,
      maximum_audit_bytes: 2048,
      same_script_audit_required: true,
      provider_time_required: true,
      application_layer_transaction: false,
    };
  }));
}

export function remoteSharedSecurityCommandScript(commandType) {
  return remoteSharedSecurityCommandScriptManifest()
    .find((entry) => entry.operation_type === commandType) || null;
}

export function remoteSharedSecurityCommandManifestDigest() {
  const compact = remoteSharedSecurityCommandScriptManifest().map((entry) => ({
    operation_type: entry.operation_type,
    sha256: entry.sha256,
    primitive: entry.primitive,
  }));
  return sha256Text(JSON.stringify(compact));
}
