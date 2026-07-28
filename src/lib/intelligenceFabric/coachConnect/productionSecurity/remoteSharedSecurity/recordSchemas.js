import { hashCanonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';

export const REMOTE_SECURITY_RECORD_SCHEMAS = deepFreeze({
  CanonicalSubjectMappingV1: {
    record_type: 'canonical-subject-mapping-v1',
    record_version: 1,
    ttl_class: 'GOVERNED_NO_ACTIVE_TTL',
    mutable_fields: ['status', 'subject_security_version', 'security_epoch', 'updated_at_ms', 'record_etag'],
  },
  AuthenticatedSubscriberSessionV1: {
    record_type: 'authenticated-subscriber-session-v1',
    record_version: 1,
    ttl_class: 'EXPIRES_AT_PLUS_REPLAY_WINDOW',
    mutable_fields: ['status', 'session_epoch', 'security_epoch', 'rotated_to_ref', 'updated_at_ms', 'record_etag'],
  },
  PrivateTestApprovalV1: {
    record_type: 'private-test-approval-v1',
    record_version: 1,
    ttl_class: 'EXACT_APPROVAL_EXPIRY',
    mutable_fields: ['status', 'approval_epoch', 'security_epoch', 'updated_at_ms', 'record_etag'],
  },
  TemporaryPrivateEntitlementV2: {
    record_type: 'temporary-private-entitlement-v2',
    record_version: 2,
    ttl_class: 'EARLIEST_BOUND_AUTHORITY_EXPIRY',
    mutable_fields: ['status', 'security_epoch', 'updated_at_ms', 'record_etag'],
  },
  CsrfGrantV2: {
    record_type: 'csrf-grant-v2',
    record_version: 2,
    ttl_class: 'SHORT_SINGLE_USE',
    mutable_fields: ['status', 'consumed_at_ms', 'updated_at_ms', 'record_etag'],
  },
  SecurityReplayClaimV2: {
    record_type: 'security-replay-claim-v2',
    record_version: 2,
    ttl_class: 'AMBIGUOUS_RECOVERY_WINDOW',
    mutable_fields: ['state', 'result_ref', 'updated_at_ms', 'record_etag'],
  },
  SecurityRateLimitV2: {
    record_type: 'security-rate-limit-v2',
    record_version: 2,
    ttl_class: 'WINDOW_PLUS_COOLDOWN',
    mutable_fields: ['count', 'blocked_until_ms', 'updated_at_ms', 'record_etag'],
  },
  SecurityEpochV1: {
    record_type: 'security-epoch-v1',
    record_version: 1,
    ttl_class: 'NO_TTL_WHILE_RESTORABLE',
    mutable_fields: ['epoch', 'status', 'reason_code', 'last_audit_receipt_ref', 'updated_at_ms', 'record_etag'],
  },
  PrivacySafeSecurityAuditV2: {
    record_type: 'privacy-safe-security-audit-v2',
    record_version: 2,
    ttl_class: 'MAXIMUM_30_DAYS',
    mutable_fields: [],
  },
  AdapterHealthRecoveryV1: {
    record_type: 'adapter-health-recovery-v1',
    record_version: 1,
    ttl_class: 'CANARY_60_SECONDS_RECOVERY_MAXIMUM_30_DAYS',
    mutable_fields: ['state', 'generation', 'updated_at_ms', 'record_etag'],
  },
});

export const REMOTE_SECURITY_FORBIDDEN_FIELD_FRAGMENTS = deepFreeze([
  'raw_token',
  'cookie',
  'access_code',
  'credential',
  'secret',
  'password',
  'assertion',
  'email',
  'name',
  'address',
  'ip_address',
  'profile_id',
  'transcript',
  'prompt',
  'message',
  'model_output',
  'business_engine',
  'billing',
  'stripe',
  'customer_data',
]);

const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const object = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const timestampMs = (value) => Number.isSafeInteger(value) && value >= 0;
const frozen = (value) => deepFreeze(structuredClone(value));

export function containsForbiddenRemoteSecurityMaterial(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((entry) => containsForbiddenRemoteSecurityMaterial(entry, seen));
  }
  return Object.entries(value).some(([key, child]) => (
    REMOTE_SECURITY_FORBIDDEN_FIELD_FRAGMENTS.some((fragment) => (
      key.toLowerCase() === fragment
      || key.toLowerCase().startsWith(`${fragment}_`)
    ))
    || containsForbiddenRemoteSecurityMaterial(child, seen)
  ));
}

export function remoteSecurityRecordSchemaByType(recordType) {
  return Object.values(REMOTE_SECURITY_RECORD_SCHEMAS)
    .find((schema) => schema.record_type === recordType) || null;
}

export function validateRemoteSecurityRecord(record, {
  environment_digest = null,
  provider_time_ms = null,
  require_active_ttl = false,
} = {}) {
  const errors = [];
  if (!object(record)) {
    return frozen({ valid: false, errors: ['RECORD_CORRUPT'], value: null });
  }
  const schema = remoteSecurityRecordSchemaByType(record.record_type);
  if (!schema || record.record_version !== schema.record_version) {
    errors.push('RECORD_VERSION_MISMATCH');
  }
  if (!sha256(record.environment_digest)
    || (environment_digest && record.environment_digest !== environment_digest)) {
    errors.push('ENVIRONMENT_MISMATCH');
  }
  if (!timestampMs(record.created_at_ms)
    || !timestampMs(record.updated_at_ms)
    || record.updated_at_ms < record.created_at_ms
    || !sha256(record.record_etag)) {
    errors.push('RECORD_CORRUPT');
  }
  if (containsForbiddenRemoteSecurityMaterial(record)) {
    errors.push('RECORD_CORRUPT');
  }
  if (require_active_ttl) {
    if (!timestampMs(provider_time_ms)
      || !timestampMs(record.expires_at_ms)
      || record.expires_at_ms <= provider_time_ms) {
      errors.push('RECORD_CORRUPT');
    }
  }
  return frozen({
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    value: errors.length ? null : record,
  });
}

export function createRemoteSecurityRecord({
  schema_name,
  environment_digest,
  provider_time_ms,
  fields,
}) {
  const schema = REMOTE_SECURITY_RECORD_SCHEMAS[schema_name];
  if (!schema || !sha256(environment_digest) || !timestampMs(provider_time_ms) || !object(fields)) {
    throw new TypeError('remote security record input is invalid');
  }
  const base = {
    record_type: schema.record_type,
    record_version: schema.record_version,
    environment_digest,
    created_at_ms: provider_time_ms,
    updated_at_ms: provider_time_ms,
    ...structuredClone(fields),
  };
  const record = {
    ...base,
    record_etag: hashCanonicalJson(base),
  };
  const checked = validateRemoteSecurityRecord(record, { environment_digest });
  if (!checked.valid) throw new TypeError(`remote security record is invalid: ${checked.errors.join(',')}`);
  return checked.value;
}

export function remoteSecurityRecordManifest() {
  return frozen(Object.entries(REMOTE_SECURITY_RECORD_SCHEMAS).map(([name, schema]) => ({
    name,
    ...schema,
    raw_token_persistence: false,
    product_content_persistence: false,
    transcript_persistence: false,
  })));
}

export function remoteSecurityRecordRetentionDecision(record, providerTimeMs) {
  const schema = remoteSecurityRecordSchemaByType(record?.record_type);
  if (!schema || !Number.isSafeInteger(providerTimeMs)) {
    return frozen({ authoritative: false, code: 'RECORD_CORRUPT' });
  }
  if (Number.isSafeInteger(record.expires_at_ms) && providerTimeMs >= record.expires_at_ms) {
    return frozen({ authoritative: false, code: 'EXPIRED_AT_PROVIDER_TIME' });
  }
  return frozen({
    authoritative: true,
    ttl_class: schema.ttl_class,
    deletion_proof: false,
    cache_eviction_is_deletion_proof: false,
    backup_retention_extends_authority: false,
  });
}

export function remoteSecurityBackupRestoreQualificationPlan({
  source_environment_id,
  source_namespace_digest,
  restore_environment_id,
  restore_namespace_digest,
  backup_retention_days,
} = {}) {
  const isolated = typeof source_environment_id === 'string'
    && typeof restore_environment_id === 'string'
    && source_environment_id !== restore_environment_id
    && sha256(source_namespace_digest)
    && sha256(restore_namespace_digest)
    && source_namespace_digest !== restore_namespace_digest;
  const retentionValid = Number.isInteger(backup_retention_days)
    && backup_retention_days >= 1
    && backup_retention_days <= 30;
  return frozen({
    allowed_for_qualification: isolated && retentionValid,
    source_environment_id: source_environment_id || null,
    restore_environment_id: restore_environment_id || null,
    isolated_empty_restore_required: true,
    in_place_restore_allowed: false,
    production_customer_data_allowed: false,
    transcript_backup_allowed: false,
    product_content_backup_allowed: false,
    current_epoch_reapplication_required: true,
    revocation_tombstone_reapplication_required: true,
    expiry_revalidation_at_provider_time_required: true,
    unknown_record_version_denied: true,
    teardown_after_proof_required: true,
    retention_days: retentionValid ? backup_retention_days : null,
  });
}

export function remoteSecurityDeletionDecision({
  active_authority_revoked,
  epoch_advanced,
  terminal_tombstone_retained,
  eligible_backups_expired,
  provider_control_plane_receipt,
} = {}) {
  const proven = active_authority_revoked === true
    && epoch_advanced === true
    && terminal_tombstone_retained === true
    && eligible_backups_expired === true
    && typeof provider_control_plane_receipt === 'string'
    && provider_control_plane_receipt.length > 0;
  return frozen({
    deletion_proven: proven,
    cache_eviction_is_deletion_proof: false,
    expiry_is_deletion_proof: false,
    namespace_teardown_is_backup_deletion_proof: false,
    cryptographic_erasure_claimed: false,
    failure_code: proven ? null : 'DELETION_PROOF_INCOMPLETE',
  });
}
