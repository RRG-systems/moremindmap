import { hashCanonicalJson } from '../../hashing.js';
import { deepFreeze } from '../../validation.js';
import {
  ASYNC_SECURITY_CAPABILITY_VERSION,
  ASYNC_SECURITY_COMMAND_RESULT_VERSION,
  ASYNC_SECURITY_HEALTH_VERSION,
  ASYNC_SECURITY_QUERY_RESULT_VERSION,
  ASYNC_SECURITY_STATE_CONTRACT_VERSION,
  ASYNC_SECURITY_TIME_VERSION,
  asyncSecurityFailureCode,
  validateAsyncSecurityCommand,
  validateAsyncSecurityQuery,
} from './asyncSecurityContracts.js';

const clone = (value) => value == null ? value : structuredClone(value);
const frozen = (value) => deepFreeze(clone(value));
const mapFrom = (entries = []) => new Map(entries.map(([key, value]) => [key, clone(value)]));
const key = (...parts) => parts.join('|');
const timestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const activeAt = (record, now) => record?.status === 'ACTIVE'
  && timestamp(record.expires_at)
  && Date.parse(record.expires_at) > now;

export function createSyntheticAsyncSecurityBackend(snapshot = null, {
  clock = () => Date.now(),
} = {}) {
  return {
    clock,
    availability: snapshot?.availability || 'HEALTHY',
    audit_failure: snapshot?.audit_failure === true,
    canonical_by_external: mapFrom(snapshot?.canonical_by_external),
    canonical_by_scope: mapFrom(snapshot?.canonical_by_scope),
    sessions_by_token: mapFrom(snapshot?.sessions_by_token),
    sessions_by_ref: mapFrom(snapshot?.sessions_by_ref),
    approvals: mapFrom(snapshot?.approvals),
    entitlements_by_token: mapFrom(snapshot?.entitlements_by_token),
    entitlements_by_ref: mapFrom(snapshot?.entitlements_by_ref),
    csrf_grants: mapFrom(snapshot?.csrf_grants),
    replays: mapFrom(snapshot?.replays),
    rate_limits: mapFrom(snapshot?.rate_limits),
    security_epochs: mapFrom(snapshot?.security_epochs),
    command_results: mapFrom(snapshot?.command_results),
    audits: (snapshot?.audits || []).map(clone),
  };
}

function safeNow(backend) {
  const value = backend.clock();
  return Number.isFinite(value) ? value : null;
}

function receipt(prefix, value) {
  return `${prefix}_${hashCanonicalJson(value).slice(0, 32)}`;
}

function failureForHealth(state) {
  if (state === 'PARTITIONED') return 'SHARED_SECURITY_STATE_PARTITIONED';
  if (state === 'RECOVERING') return 'SHARED_SECURITY_STATE_RECOVERING';
  if (state === 'UNCONFIGURED') return 'ASYNC_SECURITY_UNCONFIGURED';
  return 'SHARED_SECURITY_STATE_UNAVAILABLE';
}

function queryFailure(queryType, failureCode, now, context = {}) {
  return frozen({
    result_version: ASYNC_SECURITY_QUERY_RESULT_VERSION,
    ok: false,
    query_type: queryType,
    consistency_proven: false,
    server_time: new Date(Number.isFinite(now) ? now : 0).toISOString(),
    record_version: null,
    record: null,
    failure_code: asyncSecurityFailureCode(failureCode),
    receipt_ref: receipt('query_denied', { queryType, failureCode, ...context }),
  });
}

function querySuccess(queryType, record, now, recordVersion = 1) {
  return frozen({
    result_version: ASYNC_SECURITY_QUERY_RESULT_VERSION,
    ok: true,
    query_type: queryType,
    consistency_proven: true,
    server_time: new Date(now).toISOString(),
    record_version: recordVersion,
    record,
    failure_code: null,
    receipt_ref: receipt('query_allowed', { queryType, now, record }),
  });
}

function commandFailure(commandType, failureCode, now, context = {}) {
  return frozen({
    result_version: ASYNC_SECURITY_COMMAND_RESULT_VERSION,
    ok: false,
    command_type: commandType,
    committed: false,
    idempotent_replay: false,
    server_time: new Date(Number.isFinite(now) ? now : 0).toISOString(),
    new_versions: {},
    result_refs: {},
    failure_code: asyncSecurityFailureCode(failureCode),
    audit_receipt_ref: null,
    ...context,
  });
}

function commandSuccess(command, now, {
  resultRefs = {},
  newVersions = {},
  auditReceiptRef,
} = {}) {
  return frozen({
    result_version: ASYNC_SECURITY_COMMAND_RESULT_VERSION,
    ok: true,
    command_type: command.command_type,
    committed: true,
    idempotent_replay: false,
    server_time: new Date(now).toISOString(),
    new_versions: newVersions,
    result_refs: resultRefs,
    failure_code: null,
    audit_receipt_ref: auditReceiptRef,
  });
}

function appendAudit(backend, command, now, decision = 'ALLOWED', failureCode = null) {
  if (backend.audit_failure) return null;
  const auditReceiptRef = receipt('audit', {
    command_type: command.command_type,
    idempotency_key_hash: command.idempotency_key_hash,
    fingerprint: command.fingerprint,
    now,
    decision,
    failureCode,
  });
  if (!backend.audits.some((event) => event.audit_receipt_ref === auditReceiptRef)) {
    backend.audits.push({
      receipt_version: 'private-runtime-security-receipt-v2',
      audit_receipt_ref: auditReceiptRef,
      event_type: command.command_type,
      decision,
      failure_code: failureCode,
      occurred_at: new Date(now).toISOString(),
      correlation_ref: command.correlation_ref,
      environment_id: command.environment_id,
    });
  }
  return auditReceiptRef;
}

export class SyntheticAsyncSecurityStateAdapter {
  constructor({
    backend = null,
    environment_id = 'synthetic_test',
    adapter_id = 'synthetic_async_security_v2',
    clock = () => Date.now(),
  } = {}) {
    this.backend = backend || createSyntheticAsyncSecurityBackend(null, { clock });
    this.environment_id = environment_id;
    this.adapter_id = adapter_id;
    this.commandQueue = Promise.resolve();
  }

  async describeCapability() {
    return frozen({
      description_version: ASYNC_SECURITY_CAPABILITY_VERSION,
      contract_version: ASYNC_SECURITY_STATE_CONTRACT_VERSION,
      adapter_id: this.adapter_id,
      adapter_class: 'SYNTHETIC_ASYNC',
      provider_class: 'SYNTHETIC',
      provider_name: 'SYNTHETIC_IN_MEMORY',
      environment_id: this.environment_id,
      available: this.backend.availability === 'HEALTHY',
      deployment_grade: false,
      promise_native: true,
      authoritative_reads: 'SYNTHETIC_LINEARIZABLE_MODEL',
      atomic_command_model: 'SYNTHETIC_SERIALIZED_COMMAND_MODEL',
      server_time_ttl: true,
      durable_security_records: false,
      durable_privacy_safe_audit: false,
      restart_safe: false,
      outage_behavior: 'FAIL_CLOSED',
      partition_behavior: 'FAIL_CLOSED',
      no_local_fallback: true,
      stores_product_content: false,
      stores_transcripts: false,
      stores_raw_identity_material: false,
      live_connection_verified: false,
    });
  }

  async health() {
    const now = safeNow(this.backend);
    const state = this.backend.availability;
    return frozen({
      decision_version: ASYNC_SECURITY_HEALTH_VERSION,
      state,
      allowed_for_security: state === 'HEALTHY' && Number.isFinite(now),
      environment_id: this.environment_id,
      adapter_id: this.adapter_id,
      deployment_grade: false,
      live_connection_verified: false,
      no_local_fallback: true,
      server_time: new Date(Number.isFinite(now) ? now : 0).toISOString(),
      failure_code: state === 'HEALTHY' && Number.isFinite(now)
        ? null
        : Number.isFinite(now)
          ? failureForHealth(state)
          : 'SECURITY_STATE_CLOCK_INVALID',
      receipt_ref: receipt('health', { state, now: Number.isFinite(now) ? now : 0 }),
    });
  }

  async serverTime() {
    const now = safeNow(this.backend);
    return frozen({
      receipt_version: ASYNC_SECURITY_TIME_VERSION,
      ok: Number.isFinite(now) && this.backend.availability === 'HEALTHY',
      server_time: new Date(Number.isFinite(now) ? now : 0).toISOString(),
      source: 'SYNTHETIC_BACKEND_SERVER_TIME',
      failure_code: Number.isFinite(now) && this.backend.availability === 'HEALTHY'
        ? null
        : Number.isFinite(now)
          ? failureForHealth(this.backend.availability)
          : 'SECURITY_STATE_CLOCK_INVALID',
      receipt_ref: receipt('server_time', { now: Number.isFinite(now) ? now : 0 }),
    });
  }

  async queryAuthoritative(query) {
    const checked = validateAsyncSecurityQuery(query);
    if (!checked.valid) throw new TypeError('invalid async security query');
    const now = safeNow(this.backend);
    if (!Number.isFinite(now)) return queryFailure(query.query_type, 'SECURITY_STATE_CLOCK_INVALID', now);
    if (query.environment_id !== this.environment_id) {
      return queryFailure(query.query_type, 'SHARED_SECURITY_STATE_REQUIRED', now);
    }
    if (this.backend.availability !== 'HEALTHY') {
      return queryFailure(query.query_type, failureForHealth(this.backend.availability), now);
    }

    switch (query.query_type) {
      case 'RESOLVE_CANONICAL_SUBJECT': {
        const mapping = this.backend.canonical_by_external.get(query.subject_ref);
        if (!mapping) return queryFailure(query.query_type, 'SUBJECT_MAPPING_NOT_FOUND', now);
        if (mapping.ambiguous === true) return queryFailure(query.query_type, 'SUBJECT_MAPPING_AMBIGUOUS', now);
        if (mapping.status === 'DISABLED') return queryFailure(query.query_type, 'SUBJECT_DISABLED', now);
        if (mapping.status === 'DELETED') return queryFailure(query.query_type, 'SUBJECT_DELETED', now);
        if (mapping.status === 'RECOVERY_PENDING') return queryFailure(query.query_type, 'SUBJECT_RECOVERY_PENDING', now);
        const inverse = this.backend.canonical_by_scope.get(mapping.exact_scope_hash);
        if (!inverse || inverse.subscriber_subject_ref !== mapping.subscriber_subject_ref) {
          return queryFailure(query.query_type, 'SUBJECT_MAPPING_AMBIGUOUS', now);
        }
        return querySuccess(query.query_type, mapping, now);
      }
      case 'RESOLVE_EXACT_SCOPE': {
        const mapping = this.backend.canonical_by_scope.get(query.exact_scope_hash);
        if (!mapping) return queryFailure(query.query_type, 'SUBJECT_MAPPING_NOT_FOUND', now);
        if (query.subject_ref && mapping.subscriber_subject_ref !== query.subject_ref) {
          return queryFailure(query.query_type, 'EXACT_SCOPE_MISMATCH', now);
        }
        return querySuccess(query.query_type, mapping, now);
      }
      case 'GET_SESSION_BY_TOKEN_HASH': {
        const session = this.backend.sessions_by_token.get(query.session_token_hash);
        if (!session) return queryFailure(query.query_type, 'SESSION_NOT_FOUND', now);
        return querySuccess(query.query_type, session, now, 2);
      }
      case 'GET_TEMPORARY_ENTITLEMENT_BY_TOKEN_HASH': {
        const entitlement = this.backend.entitlements_by_token.get(query.entitlement_token_hash);
        if (!entitlement) return queryFailure(query.query_type, 'ENTITLEMENT_REQUIRED', now);
        return querySuccess(query.query_type, entitlement, now, 2);
      }
      case 'GET_PRIVATE_TEST_APPROVAL': {
        const approval = this.backend.approvals.get(key(query.subject_ref, query.exact_scope_hash));
        if (!approval) return queryFailure(query.query_type, 'PRIVATE_TEST_APPROVAL_REQUIRED', now);
        return querySuccess(query.query_type, approval, now);
      }
      case 'GET_SECURITY_EPOCH': {
        const epoch = this.backend.security_epochs.get(query.exact_scope_hash) || 0;
        return querySuccess(query.query_type, { exact_scope_hash: query.exact_scope_hash, security_epoch: epoch }, now);
      }
      case 'GET_REPLAY_RESULT': {
        const replay = this.backend.replays.get(query.subject_ref);
        if (!replay) return queryFailure(query.query_type, 'REQUEST_REPLAY_DETECTED', now);
        return querySuccess(query.query_type, replay, now, 2);
      }
      case 'READ_AUTHORITY_SNAPSHOT':
        return this.readAuthoritySnapshot(query, now);
      default:
        return queryFailure(query.query_type, 'ASYNC_SECURITY_SCHEMA_INVALID', now);
    }
  }

  readAuthoritySnapshot(query, now) {
    const session = this.backend.sessions_by_token.get(query.session_token_hash);
    const entitlement = this.backend.entitlements_by_token.get(query.entitlement_token_hash);
    const mapping = session
      ? [...this.backend.canonical_by_external.values()]
        .find((item) => item.subscriber_subject_ref === session.subscriber_subject_ref)
      : null;
    const inverse = mapping ? this.backend.canonical_by_scope.get(mapping.exact_scope_hash) : null;
    const approval = mapping
      ? this.backend.approvals.get(key(mapping.subscriber_subject_ref, mapping.exact_scope_hash))
      : null;
    const securityEpoch = mapping ? (this.backend.security_epochs.get(mapping.exact_scope_hash) || 0) : null;

    if (!mapping || !inverse || inverse.subscriber_subject_ref !== mapping.subscriber_subject_ref) {
      return queryFailure(query.query_type, 'SUBJECT_MAPPING_NOT_FOUND', now);
    }
    if (query.subject_ref && query.subject_ref !== mapping.subscriber_subject_ref) {
      return queryFailure(query.query_type, 'CROSS_SUBSCRIBER_SCOPE_MISMATCH', now);
    }
    if (query.exact_scope_hash && query.exact_scope_hash !== mapping.exact_scope_hash) {
      return queryFailure(query.query_type, 'EXACT_SCOPE_MISMATCH', now);
    }
    if (!session) return queryFailure(query.query_type, 'SESSION_NOT_FOUND', now);
    if (!activeAt(session, now)) {
      const code = session.status === 'REVOKED'
        ? 'SESSION_REVOKED'
        : session.status === 'ROTATED'
          ? 'SESSION_ROTATED'
          : 'SESSION_EXPIRED';
      return queryFailure(query.query_type, code, now);
    }
    if (!approval || !activeAt(approval, now)) {
      return queryFailure(query.query_type, approval?.status === 'REVOKED'
        ? 'PRIVATE_TEST_APPROVAL_REVOKED'
        : 'PRIVATE_TEST_APPROVAL_EXPIRED', now);
    }
    if (!entitlement || !activeAt(entitlement, now)) {
      const code = entitlement?.status === 'REVOKED' || entitlement?.status === 'EMERGENCY_REVOKED'
        ? 'ENTITLEMENT_REVOKED'
        : entitlement?.status === 'ROTATED'
          ? 'ENTITLEMENT_ROTATED'
          : entitlement
            ? 'ENTITLEMENT_EXPIRED'
            : 'ENTITLEMENT_REQUIRED';
      return queryFailure(query.query_type, code, now);
    }
    const aligned = [
      session.subscriber_subject_ref,
      approval.subscriber_subject_ref,
      entitlement.subscriber_subject_ref,
    ].every((value) => value === mapping.subscriber_subject_ref)
      && [session.exact_scope_hash, approval.exact_scope_hash, entitlement.exact_scope_hash]
        .every((value) => value === mapping.exact_scope_hash)
      && entitlement.authenticated_session_ref === session.authenticated_session_ref
      && entitlement.browser_binding_hash === session.browser_binding_hash
      && entitlement.security_epoch === securityEpoch
      && session.security_epoch === securityEpoch
      && approval.security_epoch === securityEpoch;
    if (!aligned) return queryFailure(query.query_type, 'CROSS_SUBSCRIBER_SCOPE_MISMATCH', now);
    if (securityEpoch < 1) return queryFailure(query.query_type, 'SUBJECT_MAPPING_STALE', now);
    return querySuccess(query.query_type, {
      mapping,
      session,
      approval,
      entitlement,
      security_epoch: securityEpoch,
      evaluated_at: new Date(now).toISOString(),
    }, now, 2);
  }

  async executeAtomic(command) {
    const checked = validateAsyncSecurityCommand(command);
    if (!checked.valid) throw new TypeError('invalid async security command');
    const execute = async () => this.executeSerialized(command);
    const result = this.commandQueue.then(execute, execute);
    this.commandQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  executeSerialized(command) {
    const now = safeNow(this.backend);
    if (!Number.isFinite(now)) return commandFailure(command.command_type, 'SECURITY_STATE_CLOCK_INVALID', now);
    if (command.environment_id !== this.environment_id) {
      return commandFailure(command.command_type, 'SHARED_SECURITY_STATE_REQUIRED', now);
    }
    if (this.backend.availability !== 'HEALTHY') {
      return commandFailure(command.command_type, failureForHealth(this.backend.availability), now);
    }
    const priorResult = this.backend.command_results.get(command.idempotency_key_hash);
    if (priorResult) {
      if (priorResult.fingerprint !== command.fingerprint) {
        return commandFailure(command.command_type, 'IDEMPOTENCY_FINGERPRINT_CONFLICT', now);
      }
      return frozen({ ...priorResult.result, idempotent_replay: true });
    }
    if (this.backend.audit_failure) {
      return commandFailure(command.command_type, 'AUDIT_APPEND_FAILED', now);
    }

    let result;
    switch (command.command_type) {
      case 'BIND_APPROVED_CANONICAL_SUBJECT':
        result = this.bindCanonicalSubject(command, now);
        break;
      case 'BEGIN_PRE_AUTH':
        result = this.beginPreAuth(command, now);
        break;
      case 'ELEVATE_AUTHENTICATED_SESSION':
        result = this.elevateSession(command, now);
        break;
      case 'ISSUE_CSRF_GRANT':
        result = this.issueCsrf(command, now);
        break;
      case 'CONSUME_CSRF_AND_ISSUE_TEMPORARY_ENTITLEMENT':
        result = this.consumeCsrfAndIssueEntitlement(command, now);
        break;
      case 'CLAIM_REPLAY':
        result = this.claimReplay(command, now);
        break;
      case 'COMPLETE_REPLAY':
        result = this.completeReplay(command, now);
        break;
      case 'REVOKE_TEMPORARY_ENTITLEMENT':
        result = this.revokeEntitlement(command, now);
        break;
      case 'REVOKE_RUNTIME_ACCESS':
        result = this.revokeRuntimeAccess(command, now);
        break;
      case 'ADVANCE_SECURITY_EPOCH':
        result = this.advanceSecurityEpoch(command, now);
        break;
      case 'APPLY_RATE_LIMIT':
        result = this.applyRateLimit(command, now);
        break;
      case 'APPEND_SECURITY_AUDIT':
        result = this.appendStandaloneAudit(command, now);
        break;
      default:
        result = commandFailure(command.command_type, 'ASYNC_SECURITY_SCHEMA_INVALID', now);
    }
    if (result.ok) {
      this.backend.command_results.set(command.idempotency_key_hash, {
        fingerprint: command.fingerprint,
        result: clone(result),
      });
    }
    return result;
  }

  successWithAudit(command, now, options = {}) {
    const auditReceiptRef = appendAudit(this.backend, command, now);
    return auditReceiptRef
      ? commandSuccess(command, now, { ...options, auditReceiptRef })
      : commandFailure(command.command_type, 'AUDIT_APPEND_FAILED', now);
  }

  bindCanonicalSubject(command, now) {
    const mapping = command.arguments.subject_mapping;
    if (!mapping?.external_subject_ref
      || !mapping?.subscriber_subject_ref
      || !mapping?.exact_scope_hash
      || mapping.subscriber_confirmed !== true
      || mapping.auto_enrolled !== false) {
      return commandFailure(command.command_type, 'SUBJECT_ASSERTION_INVALID', now);
    }
    const byExternal = this.backend.canonical_by_external.get(mapping.external_subject_ref);
    const byScope = this.backend.canonical_by_scope.get(mapping.exact_scope_hash);
    if (byExternal || byScope) {
      const same = byExternal?.subscriber_subject_ref === mapping.subscriber_subject_ref
        && byScope?.subscriber_subject_ref === mapping.subscriber_subject_ref;
      return same
        ? this.successWithAudit(command, now, {
          resultRefs: { subscriber_subject_ref: mapping.subscriber_subject_ref },
          newVersions: { mapping_version: byExternal.mapping_version },
        })
        : commandFailure(command.command_type, 'SUBJECT_MAPPING_AMBIGUOUS', now);
    }
    const record = {
      ...clone(mapping),
      record_version: 'canonical-subject-mapping-v1',
      mapping_version: 1,
      security_version: mapping.security_version || 1,
      status: 'ACTIVE',
      bound_at: new Date(now).toISOString(),
    };
    const auditReceiptRef = appendAudit(this.backend, command, now);
    if (!auditReceiptRef) return commandFailure(command.command_type, 'AUDIT_APPEND_FAILED', now);
    this.backend.canonical_by_external.set(record.external_subject_ref, record);
    this.backend.canonical_by_scope.set(record.exact_scope_hash, {
      subscriber_subject_ref: record.subscriber_subject_ref,
      external_subject_ref: record.external_subject_ref,
      exact_scope_hash: record.exact_scope_hash,
      mapping_version: record.mapping_version,
      status: record.status,
    });
    return commandSuccess(command, now, {
      resultRefs: { subscriber_subject_ref: record.subscriber_subject_ref },
      newVersions: { mapping_version: 1 },
      auditReceiptRef,
    });
  }

  beginPreAuth(command, now) {
    const preAuth = command.arguments.pre_auth_session;
    if (!preAuth?.pre_auth_session_ref || !preAuth?.session_token_hash || !activeAt(preAuth, now)) {
      return commandFailure(command.command_type, 'SESSION_ELEVATION_REQUIRED', now);
    }
    if (this.backend.sessions_by_token.has(preAuth.session_token_hash)
      || this.backend.sessions_by_ref.has(preAuth.pre_auth_session_ref)) {
      return commandFailure(command.command_type, 'REQUEST_REPLAY_DETECTED', now);
    }
    const auditReceiptRef = appendAudit(this.backend, command, now);
    if (!auditReceiptRef) return commandFailure(command.command_type, 'AUDIT_APPEND_FAILED', now);
    const record = { ...clone(preAuth), record_version: 'pre-auth-private-session-v2', session_class: 'PRE_AUTH' };
    this.backend.sessions_by_token.set(record.session_token_hash, record);
    this.backend.sessions_by_ref.set(record.pre_auth_session_ref, record);
    return commandSuccess(command, now, {
      resultRefs: { pre_auth_session_ref: record.pre_auth_session_ref },
      newVersions: { session_epoch: record.session_epoch || 1 },
      auditReceiptRef,
    });
  }

  elevateSession(command, now) {
    const preAuth = this.backend.sessions_by_ref.get(command.arguments.pre_auth_session_ref);
    const session = command.arguments.authenticated_session;
    if (!preAuth || preAuth.session_class !== 'PRE_AUTH' || !activeAt(preAuth, now)) {
      return commandFailure(command.command_type, 'SESSION_ROTATION_FAILED', now);
    }
    if (!session?.authenticated_session_ref
      || !session?.session_token_hash
      || !activeAt(session, now)
      || session.browser_binding_hash !== preAuth.browser_binding_hash
      || this.backend.sessions_by_token.has(session.session_token_hash)) {
      return commandFailure(command.command_type, 'SESSION_ROTATION_FAILED', now);
    }
    const mapping = [...this.backend.canonical_by_external.values()]
      .find((item) => item.subscriber_subject_ref === session.subscriber_subject_ref);
    const currentEpoch = mapping
      ? (this.backend.security_epochs.get(mapping.exact_scope_hash) || 0)
      : 0;
    if (!mapping
      || mapping.exact_scope_hash !== session.exact_scope_hash
      || session.subject_security_version !== mapping.security_version
      || session.security_epoch !== currentEpoch
      || command.expected_versions?.security_epoch !== currentEpoch) {
      return commandFailure(command.command_type, 'SUBJECT_MAPPING_NOT_FOUND', now);
    }
    const rotatingAuthenticatedSession = session.rotation_parent_reference
      && session.rotation_parent_reference !== preAuth.pre_auth_session_ref
      ? this.backend.sessions_by_ref.get(session.rotation_parent_reference)
      : null;
    if (session.rotation_parent_reference !== preAuth.pre_auth_session_ref
      && (!rotatingAuthenticatedSession
        || rotatingAuthenticatedSession.session_class !== 'AUTHENTICATED'
        || !activeAt(rotatingAuthenticatedSession, now)
        || rotatingAuthenticatedSession.subscriber_subject_ref
          !== session.subscriber_subject_ref
        || rotatingAuthenticatedSession.exact_scope_hash !== session.exact_scope_hash
        || rotatingAuthenticatedSession.browser_binding_hash !== session.browser_binding_hash
        || rotatingAuthenticatedSession.security_epoch !== currentEpoch
        || session.session_epoch !== rotatingAuthenticatedSession.session_epoch + 1)) {
      return commandFailure(command.command_type, 'SESSION_ROTATION_FAILED', now);
    }
    const auditReceiptRef = appendAudit(this.backend, command, now);
    if (!auditReceiptRef) return commandFailure(command.command_type, 'AUDIT_APPEND_FAILED', now);
    const rotated = { ...preAuth, status: 'ROTATED', rotated_at: new Date(now).toISOString() };
    const authenticated = { ...clone(session), record_version: 'authenticated-private-session-v2', session_class: 'AUTHENTICATED' };
    this.backend.sessions_by_ref.set(preAuth.pre_auth_session_ref, rotated);
    this.backend.sessions_by_token.set(preAuth.session_token_hash, rotated);
    if (rotatingAuthenticatedSession) {
      const rotatedParent = {
        ...rotatingAuthenticatedSession,
        status: 'ROTATED',
        rotated_at: new Date(now).toISOString(),
      };
      this.backend.sessions_by_ref.set(
        rotatingAuthenticatedSession.authenticated_session_ref,
        rotatedParent,
      );
      this.backend.sessions_by_token.set(
        rotatingAuthenticatedSession.session_token_hash,
        rotatedParent,
      );
    }
    this.backend.sessions_by_ref.set(authenticated.authenticated_session_ref, authenticated);
    this.backend.sessions_by_token.set(authenticated.session_token_hash, authenticated);
    for (const [tokenHash, entitlement] of this.backend.entitlements_by_token) {
      if (entitlement.authenticated_session_ref === authenticated.rotation_parent_reference
        && entitlement.status === 'ACTIVE') {
        const updated = { ...entitlement, status: 'ROTATED', revoked_at: new Date(now).toISOString() };
        this.backend.entitlements_by_token.set(tokenHash, updated);
        this.backend.entitlements_by_ref.set(updated.entitlement_ref, updated);
      }
    }
    for (const [proofHash, grant] of this.backend.csrf_grants) {
      if (grant.authenticated_session_ref === authenticated.rotation_parent_reference
        && grant.status === 'ACTIVE') {
        this.backend.csrf_grants.set(proofHash, { ...grant, status: 'ROTATED' });
      }
    }
    return commandSuccess(command, now, {
      resultRefs: { authenticated_session_ref: authenticated.authenticated_session_ref },
      newVersions: { session_epoch: authenticated.session_epoch },
      auditReceiptRef,
    });
  }

  issueCsrf(command, now) {
    const grant = command.arguments.csrf_grant;
    const session = this.backend.sessions_by_ref.get(grant?.authenticated_session_ref);
    if (!session || session.session_class !== 'AUTHENTICATED' || !activeAt(session, now)
      || !grant?.csrf_proof_hash || !activeAt(grant, now)
      || grant.browser_binding_hash !== session.browser_binding_hash
      || this.backend.csrf_grants.has(grant.csrf_proof_hash)) {
      return commandFailure(command.command_type, 'CSRF_VALIDATION_FAILED', now);
    }
    const auditReceiptRef = appendAudit(this.backend, command, now);
    if (!auditReceiptRef) return commandFailure(command.command_type, 'AUDIT_APPEND_FAILED', now);
    this.backend.csrf_grants.set(grant.csrf_proof_hash, clone(grant));
    return commandSuccess(command, now, {
      resultRefs: { csrf_grant_ref: grant.csrf_grant_ref },
      auditReceiptRef,
    });
  }

  consumeCsrfAndIssueEntitlement(command, now) {
    const args = command.arguments;
    const grant = this.backend.csrf_grants.get(args.csrf_proof_hash);
    const session = this.backend.sessions_by_ref.get(args.authenticated_session_ref);
    const approval = this.backend.approvals.get(key(args.subscriber_subject_ref, args.exact_scope_hash));
    const epoch = this.backend.security_epochs.get(args.exact_scope_hash) || 0;
    if (!grant || !activeAt(grant, now)
      || !session || !activeAt(session, now)
      || !approval || !activeAt(approval, now)
      || args.code_verified !== true
      || grant.authenticated_session_ref !== session.authenticated_session_ref
      || grant.browser_binding_hash !== session.browser_binding_hash
      || grant.method !== args.method
      || grant.route !== args.route
      || session.subscriber_subject_ref !== args.subscriber_subject_ref
      || session.exact_scope_hash !== args.exact_scope_hash
      || approval.security_epoch !== epoch
      || session.security_epoch !== epoch) {
      return commandFailure(command.command_type, args.code_verified === true
        ? 'ENTITLEMENT_INVALID'
        : 'PRIVATE_TEST_BOOTSTRAP_INELIGIBLE', now);
    }
    const existing = [...this.backend.entitlements_by_ref.values()].find((item) => (
      item.authenticated_session_ref === session.authenticated_session_ref
      && item.exact_scope_hash === session.exact_scope_hash
      && activeAt(item, now)
    ));
    if (existing) return commandFailure(command.command_type, 'REQUEST_REPLAY_DETECTED', now);
    const entitlement = args.entitlement;
    if (!entitlement?.entitlement_token_hash || !entitlement?.entitlement_ref
      || !activeAt(entitlement, now)
      || entitlement.temporary !== true
      || entitlement.paid_entitlement !== false
      || entitlement.admin_authority !== false
      || entitlement.operator_authority !== false
      || entitlement.deployment_authority !== false
      || entitlement.billing_authority !== false
      || entitlement.coach_authority !== false
      || entitlement.canonical_mutation_authority !== false) {
      return commandFailure(command.command_type, 'ENTITLEMENT_INVALID', now);
    }
    const auditReceiptRef = appendAudit(this.backend, command, now);
    if (!auditReceiptRef) return commandFailure(command.command_type, 'AUDIT_APPEND_FAILED', now);
    this.backend.csrf_grants.set(args.csrf_proof_hash, {
      ...grant,
      status: 'CONSUMED',
      consumed_at: new Date(now).toISOString(),
    });
    this.backend.entitlements_by_token.set(entitlement.entitlement_token_hash, clone(entitlement));
    this.backend.entitlements_by_ref.set(entitlement.entitlement_ref, clone(entitlement));
    return commandSuccess(command, now, {
      resultRefs: { entitlement_ref: entitlement.entitlement_ref },
      newVersions: { security_epoch: epoch },
      auditReceiptRef,
    });
  }

  claimReplay(command, now) {
    const replayKey = command.arguments.replay_key_hash || command.idempotency_key_hash;
    const existing = this.backend.replays.get(replayKey);
    if (existing && existing.fingerprint !== command.fingerprint) {
      return commandFailure(command.command_type, 'IDEMPOTENCY_FINGERPRINT_CONFLICT', now);
    }
    const auditReceiptRef = appendAudit(this.backend, command, now);
    if (!auditReceiptRef) return commandFailure(command.command_type, 'AUDIT_APPEND_FAILED', now);
    const record = existing || {
      replay_key_hash: replayKey,
      fingerprint: command.fingerprint,
      status: 'CLAIMED',
      result_reference: null,
      expires_at: command.arguments.expires_at,
    };
    this.backend.replays.set(replayKey, record);
    return commandSuccess(command, now, {
      resultRefs: { replay_key_hash: replayKey },
      auditReceiptRef,
    });
  }

  completeReplay(command, now) {
    const replayKey = command.arguments.replay_key_hash;
    const existing = this.backend.replays.get(replayKey);
    if (!existing || existing.fingerprint !== command.arguments.claim_fingerprint) {
      return commandFailure(command.command_type, 'REQUEST_REPLAY_DETECTED', now);
    }
    const auditReceiptRef = appendAudit(this.backend, command, now);
    if (!auditReceiptRef) return commandFailure(command.command_type, 'AUDIT_APPEND_FAILED', now);
    const completed = { ...existing, status: 'COMPLETED', result_reference: command.arguments.result_reference };
    this.backend.replays.set(replayKey, completed);
    return commandSuccess(command, now, {
      resultRefs: { result_reference: completed.result_reference },
      auditReceiptRef,
    });
  }

  revokeEntitlement(command, now) {
    const entitlement = this.backend.entitlements_by_ref.get(command.arguments.entitlement_ref);
    if (!entitlement) return commandFailure(command.command_type, 'ENTITLEMENT_REQUIRED', now);
    const auditReceiptRef = appendAudit(this.backend, command, now);
    if (!auditReceiptRef) return commandFailure(command.command_type, 'AUDIT_APPEND_FAILED', now);
    const revoked = { ...entitlement, status: 'REVOKED', revoked_at: new Date(now).toISOString() };
    this.backend.entitlements_by_ref.set(revoked.entitlement_ref, revoked);
    this.backend.entitlements_by_token.set(revoked.entitlement_token_hash, revoked);
    return commandSuccess(command, now, {
      resultRefs: { entitlement_ref: revoked.entitlement_ref },
      auditReceiptRef,
    });
  }

  revokeRuntimeAccess(command, now) {
    const session = this.backend.sessions_by_ref.get(command.arguments.authenticated_session_ref);
    if (!session) return commandFailure(command.command_type, 'SESSION_NOT_FOUND', now);
    const currentEpoch = this.backend.security_epochs.get(session.exact_scope_hash) || 0;
    const auditReceiptRef = appendAudit(this.backend, command, now);
    if (!auditReceiptRef) return commandFailure(command.command_type, 'AUDIT_APPEND_FAILED', now);
    const revokedSession = { ...session, status: 'REVOKED', revoked_at: new Date(now).toISOString() };
    this.backend.sessions_by_ref.set(session.authenticated_session_ref, revokedSession);
    this.backend.sessions_by_token.set(session.session_token_hash, revokedSession);
    let entitlementRevoked = false;
    for (const [tokenHash, entitlement] of this.backend.entitlements_by_token) {
      if (entitlement.authenticated_session_ref === session.authenticated_session_ref
        && entitlement.status === 'ACTIVE') {
        const revoked = { ...entitlement, status: 'REVOKED', revoked_at: new Date(now).toISOString() };
        this.backend.entitlements_by_token.set(tokenHash, revoked);
        this.backend.entitlements_by_ref.set(revoked.entitlement_ref, revoked);
        entitlementRevoked = true;
      }
    }
    const nextEpoch = currentEpoch + 1;
    this.backend.security_epochs.set(session.exact_scope_hash, nextEpoch);
    return commandSuccess(command, now, {
      resultRefs: {
        authenticated_session_ref: session.authenticated_session_ref,
        entitlement_revoked: entitlementRevoked,
      },
      newVersions: { security_epoch: nextEpoch },
      auditReceiptRef,
    });
  }

  advanceSecurityEpoch(command, now) {
    const scopeHash = command.arguments.exact_scope_hash;
    const current = this.backend.security_epochs.get(scopeHash) || 0;
    if (Number.isInteger(command.arguments.expected_epoch)
      && command.arguments.expected_epoch !== current) {
      return commandFailure(command.command_type, 'SUBJECT_MAPPING_STALE', now);
    }
    const auditReceiptRef = appendAudit(this.backend, command, now);
    if (!auditReceiptRef) return commandFailure(command.command_type, 'AUDIT_APPEND_FAILED', now);
    const next = current + 1;
    this.backend.security_epochs.set(scopeHash, next);
    return commandSuccess(command, now, {
      newVersions: { security_epoch: next },
      auditReceiptRef,
    });
  }

  applyRateLimit(command, now) {
    const dimension = command.arguments.dimension_hash;
    const prior = this.backend.rate_limits.get(dimension);
    const windowMs = command.arguments.window_ms;
    const limit = command.arguments.limit;
    if (!dimension || !Number.isFinite(windowMs) || windowMs <= 0 || !Number.isInteger(limit) || limit < 1) {
      return commandFailure(command.command_type, 'ASYNC_SECURITY_SCHEMA_INVALID', now);
    }
    const current = !prior || now >= prior.resets_at
      ? { count: 0, resets_at: now + windowMs }
      : clone(prior);
    if (current.count >= limit) return commandFailure(command.command_type, 'RATE_LIMITED', now);
    const auditReceiptRef = appendAudit(this.backend, command, now);
    if (!auditReceiptRef) return commandFailure(command.command_type, 'AUDIT_APPEND_FAILED', now);
    current.count += 1;
    this.backend.rate_limits.set(dimension, current);
    return commandSuccess(command, now, {
      resultRefs: { remaining: limit - current.count, resets_at: current.resets_at },
      auditReceiptRef,
    });
  }

  appendStandaloneAudit(command, now) {
    const auditReceiptRef = appendAudit(this.backend, command, now, command.arguments.decision || 'OBSERVED', command.arguments.failure_code || null);
    return auditReceiptRef
      ? commandSuccess(command, now, { resultRefs: { audit_receipt_ref: auditReceiptRef }, auditReceiptRef })
      : commandFailure(command.command_type, 'AUDIT_APPEND_FAILED', now);
  }

  setAvailability(state) {
    if (!['HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'PARTITIONED', 'RECOVERING', 'UNCONFIGURED'].includes(state)) {
      throw new TypeError('invalid synthetic async security availability');
    }
    this.backend.availability = state;
  }

  setAuditFailure(value) {
    this.backend.audit_failure = value === true;
  }

  snapshot() {
    return frozen({
      evidence_class: 'SYNTHETIC',
      deployment_grade: false,
      availability: this.backend.availability,
      audit_failure: this.backend.audit_failure,
      canonical_by_external: [...this.backend.canonical_by_external.entries()],
      canonical_by_scope: [...this.backend.canonical_by_scope.entries()],
      sessions_by_token: [...this.backend.sessions_by_token.entries()],
      sessions_by_ref: [...this.backend.sessions_by_ref.entries()],
      approvals: [...this.backend.approvals.entries()],
      entitlements_by_token: [...this.backend.entitlements_by_token.entries()],
      entitlements_by_ref: [...this.backend.entitlements_by_ref.entries()],
      csrf_grants: [...this.backend.csrf_grants.entries()],
      replays: [...this.backend.replays.entries()],
      rate_limits: [...this.backend.rate_limits.entries()],
      security_epochs: [...this.backend.security_epochs.entries()],
      command_results: [...this.backend.command_results.entries()],
      audits: this.backend.audits,
    });
  }
}

export function createSyntheticAsyncSecurityStateAdapter(options = {}) {
  return new SyntheticAsyncSecurityStateAdapter(options);
}
