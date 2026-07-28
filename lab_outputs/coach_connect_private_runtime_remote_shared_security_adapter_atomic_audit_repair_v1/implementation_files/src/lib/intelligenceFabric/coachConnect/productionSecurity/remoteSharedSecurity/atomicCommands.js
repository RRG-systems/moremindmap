import { hashCanonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';
import {
  ASYNC_SECURITY_COMMAND_RESULT_VERSION,
} from '../asyncSecurityContracts.js';
import {
  RemoteSharedSecurityAdapterError,
  assertRemoteCommandResult,
  validateRemoteCommandEnvelope,
} from './contracts.js';
import {
  remoteSharedSecurityCommandScript,
} from './scriptManifest.js';

const frozen = (value) => deepFreeze(structuredClone(value));
const timestampMs = (value) => Number.isSafeInteger(value) && value >= 0;

function expiryMap(command) {
  const values = {};
  const scan = (value) => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.expires_at === 'string' && Number.isFinite(Date.parse(value.expires_at))) {
      values[value.expires_at] = Date.parse(value.expires_at);
    }
    for (const child of Object.values(value)) scan(child);
  };
  scan(command.arguments);
  return values;
}

function required(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new RemoteSharedSecurityAdapterError('ASYNC_SECURITY_CONTRACT_VIOLATION');
  }
  return value;
}

function normalizeProviderMap(value) {
  return Array.isArray(value) && value.length === 0 ? {} : (value || {});
}

function buildOperationKeys(command, keyspace) {
  const args = command.arguments;
  switch (command.command_type) {
    case 'BIND_APPROVED_CANONICAL_SUBJECT':
      return {
        subject_forward: keyspace.externalSubject(required(args.subject_mapping?.external_subject_ref, 'external_subject_ref')),
        subject_inverse: keyspace.exactScope(required(args.subject_mapping?.exact_scope_hash, 'exact_scope_hash')),
        scope_epoch: keyspace.scopeEpoch(required(args.subject_mapping?.exact_scope_hash, 'exact_scope_hash')),
      };
    case 'BEGIN_PRE_AUTH':
      return {
        session_token: keyspace.sessionToken(required(args.pre_auth_session?.session_token_hash, 'session_token_hash')),
        session_ref: keyspace.sessionRef(required(args.pre_auth_session?.pre_auth_session_ref, 'pre_auth_session_ref')),
        scope_epoch: keyspace.environment_epoch,
      };
    case 'ELEVATE_AUTHENTICATED_SESSION': {
      const session = args.authenticated_session;
      return {
        preauth_ref: keyspace.sessionRef(required(args.pre_auth_session_ref, 'pre_auth_session_ref')),
        preauth_token: keyspace.sessionToken(required(args.pre_auth_token_hash || session?.rotation_parent_token_hash || command.idempotency_key_hash, 'pre_auth_token_hash')),
        new_session_token: keyspace.sessionToken(required(session?.session_token_hash, 'session_token_hash')),
        new_session_ref: keyspace.sessionRef(required(session?.authenticated_session_ref, 'authenticated_session_ref')),
        prior_session_ref: keyspace.sessionRef(required(session?.rotation_parent_reference, 'rotation_parent_reference')),
        subject_inverse: keyspace.exactScope(required(session?.exact_scope_hash, 'exact_scope_hash')),
        scope_epoch: keyspace.scopeEpoch(required(session?.exact_scope_hash, 'exact_scope_hash')),
      };
    }
    case 'ISSUE_CSRF_GRANT':
      return {
        session_ref: keyspace.sessionRef(required(args.csrf_grant?.authenticated_session_ref, 'authenticated_session_ref')),
        csrf: keyspace.csrf(required(args.csrf_grant?.csrf_proof_hash, 'csrf_proof_hash')),
        csrf_index: keyspace.sessionCsrf(required(args.csrf_grant?.authenticated_session_ref, 'authenticated_session_ref')),
      };
    case 'CONSUME_CSRF_AND_ISSUE_TEMPORARY_ENTITLEMENT':
      return {
        csrf: keyspace.csrf(required(args.csrf_proof_hash, 'csrf_proof_hash')),
        session_ref: keyspace.sessionRef(required(args.authenticated_session_ref, 'authenticated_session_ref')),
        approval: keyspace.approval(required(args.subscriber_subject_ref, 'subscriber_subject_ref'), required(args.exact_scope_hash, 'exact_scope_hash')),
        scope_epoch: keyspace.scopeEpoch(required(args.exact_scope_hash, 'exact_scope_hash')),
        entitlement_token: keyspace.entitlementToken(required(args.entitlement?.entitlement_token_hash, 'entitlement_token_hash')),
        entitlement_ref: keyspace.entitlementRef(required(args.entitlement?.entitlement_ref, 'entitlement_ref')),
        entitlement_index: keyspace.sessionEntitlements(required(args.authenticated_session_ref, 'authenticated_session_ref')),
      };
    case 'CLAIM_REPLAY':
    case 'COMPLETE_REPLAY':
      return {
        replay: keyspace.replay(required(args.replay_key_hash || command.idempotency_key_hash, 'replay_key_hash')),
      };
    case 'REVOKE_TEMPORARY_ENTITLEMENT':
      return {
        entitlement_ref: keyspace.entitlementRef(required(args.entitlement_ref, 'entitlement_ref')),
        entitlement_token: keyspace.entitlementToken(required(args.entitlement_token_hash || command.idempotency_key_hash, 'entitlement_token_hash')),
        entitlement_index: keyspace.sessionEntitlements(required(args.authenticated_session_ref || command.correlation_ref, 'authenticated_session_ref')),
      };
    case 'REVOKE_RUNTIME_ACCESS':
      return {
        session_ref: keyspace.sessionRef(required(args.authenticated_session_ref, 'authenticated_session_ref')),
        session_token: keyspace.sessionToken(required(args.session_token_hash || command.idempotency_key_hash, 'session_token_hash')),
        entitlement_ref: keyspace.entitlementRef(required(args.entitlement_ref || command.correlation_ref, 'entitlement_ref')),
        scope_epoch: keyspace.scopeEpoch(required(args.exact_scope_hash || command.idempotency_key_hash, 'exact_scope_hash')),
      };
    case 'ADVANCE_SECURITY_EPOCH':
      return {
        scope_epoch: args.exact_scope_hash
          ? keyspace.scopeEpoch(args.exact_scope_hash)
          : keyspace.environment_epoch,
      };
    case 'APPLY_RATE_LIMIT':
      return {
        rate: keyspace.rateLimit(
          required(args.policy_id || 'private_runtime', 'policy_id'),
          required(args.dimension_hash, 'dimension_hash'),
          required(args.window_id || 'provider_time_window', 'window_id'),
        ),
      };
    case 'APPEND_SECURITY_AUDIT':
      return {};
    default:
      throw new RemoteSharedSecurityAdapterError('ASYNC_SECURITY_CONTRACT_VIOLATION');
  }
}

export function buildRemoteAtomicCommandInvocation(command, {
  keyspace,
  configuration_digest,
  environment_digest,
  emergency_disabled = true,
  audit_retention_ms = 24 * 60 * 60 * 1000,
  audit_max_entries = 10000,
  idempotency_retention_ms = 30 * 60 * 1000,
  terminal_retention_ms = 30 * 60 * 1000,
  rate_cooldown_ms = 60 * 1000,
  default_replay_ttl_ms = 30 * 60 * 1000,
  now_hint_ms = Date.now(),
} = {}) {
  const checked = validateRemoteCommandEnvelope(command);
  const script = remoteSharedSecurityCommandScript(checked.command_type);
  if (!script || !keyspace) {
    throw new RemoteSharedSecurityAdapterError('SCRIPT_VERSION_MISMATCH');
  }
  const operationKeys = buildOperationKeys(checked, keyspace);
  const labels = [
    'command_result',
    'audit_stream',
    'audit_unique',
    ...Object.keys(operationKeys),
  ];
  const keys = [
    keyspace.commandResult(checked.idempotency_key_hash),
    keyspace.audit,
    keyspace.auditUnique(checked.idempotency_key_hash),
    ...Object.values(operationKeys),
  ];
  const keyIndex = Object.fromEntries(labels.map((label, index) => [label, index + 1]));
  const envelope = {
    command: checked,
    key_index: keyIndex,
    environment_digest,
    expected_environment_digest: keyspace.namespace_digest,
    configuration_digest,
    script_digest: script.sha256,
    emergency_disabled,
    audit_receipt_ref: `audit_${hashCanonicalJson({
      command_type: checked.command_type,
      idempotency_key_hash: checked.idempotency_key_hash,
      fingerprint: checked.fingerprint,
    }).slice(0, 32)}`,
    audit_retention_ms,
    audit_max_entries,
    idempotency_retention_ms,
    terminal_retention_ms,
    rate_cooldown_ms,
    default_replay_expires_at_ms: now_hint_ms + default_replay_ttl_ms,
    expiry_by_ref: expiryMap(checked),
  };
  return frozen({
    primitive: 'EVAL',
    operation_class: 'ATOMIC_COMMAND',
    operation_type: checked.command_type,
    script_sha256: script.sha256,
    command: ['EVAL', script.source, keys.length, ...keys, JSON.stringify(envelope)],
    key_count: keys.length,
    application_layer_reads: 0,
    application_layer_writes: 0,
    same_script_audit: true,
  });
}

export function parseRemoteAtomicCommandReply(reply, expectedType) {
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
  const result = {
    result_version: ASYNC_SECURITY_COMMAND_RESULT_VERSION,
    ok: internal.ok === true,
    command_type: internal.command_type,
    committed: internal.committed === true,
    idempotent_replay: internal.idempotent_replay === true,
    server_time: new Date(internal.server_time_ms).toISOString(),
    new_versions: normalizeProviderMap(internal.new_versions),
    result_refs: normalizeProviderMap(internal.result_refs),
    failure_code: internal.failure_code ?? null,
    audit_receipt_ref: internal.audit_receipt_ref ?? null,
  };
  return assertRemoteCommandResult(result, expectedType);
}

export function remoteAtomicCommandRetryDecision({
  attempt,
  error_code,
  command,
}) {
  const ambiguous = ['PROVIDER_TIMEOUT', 'PROVIDER_UNAVAILABLE'].includes(error_code);
  const exactIdempotency = typeof command?.idempotency_key_hash === 'string'
    && typeof command?.fingerprint === 'string';
  return frozen({
    retry: attempt === 0 && ambiguous && exactIdempotency,
    same_idempotency_key_required: true,
    same_fingerprint_required: true,
    new_token_material_allowed: false,
    maximum_attempts: 2,
  });
}
