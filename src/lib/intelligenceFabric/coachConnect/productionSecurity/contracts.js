import { deepFreeze } from '../../validation.js';
import {
  AUTHENTICATED_SESSION_STATUSES,
  DELETION_JOB_STATES,
  DELETION_TARGET_STATES,
  OPERATOR_ACTIONS,
  OPERATOR_ROLES,
  PRE_AUTH_SESSION_STATUSES,
  PRODUCTION_SECURITY_POLICY_VERSIONS,
  PRODUCTION_SECURITY_PREREQUISITE_SCHEMA,
  RETENTION_DATA_CLASSES,
  SUBJECT_STATUSES,
} from './constants.js';

const object = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value, max = 512) => typeof value === 'string'
  && value.trim().length > 0
  && value.length <= max;
const integer = (value, minimum = 0) => Number.isInteger(value) && value >= minimum;
const timestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const opaque = (value, max = 256) => text(value, max) && !value.includes('@');
const result = (errors, value) => deepFreeze({
  valid: errors.length === 0,
  errors,
  value: errors.length ? null : deepFreeze(structuredClone(value)),
});

export function exactProductionSecurityScope(scope) {
  return object(scope)
    && ['tenant_id', 'profile_id', 'business_id', 'subscriber_id']
      .every((key) => opaque(scope[key], 160));
}

export function sameProductionSecurityScope(left, right) {
  return exactProductionSecurityScope(left)
    && exactProductionSecurityScope(right)
    && ['tenant_id', 'profile_id', 'business_id', 'subscriber_id']
      .every((key) => left[key] === right[key]);
}

export function validateCanonicalSubscriberSubject(value) {
  const errors = [];
  if (!object(value)) return result([{ code: 'SUBJECT_MAPPING_NOT_FOUND', field: '$' }], value);
  for (const key of [
    'subscriber_subject_id',
    'issuer',
    'audience',
    'tenant_id',
    'profile_id',
    'business_id',
    'subscriber_id',
    'source_assertion_reference',
  ]) {
    if (!opaque(value[key], 256)) errors.push({ code: 'SUBJECT_ASSERTION_INVALID', field: key });
  }
  if (value.schema_version !== PRODUCTION_SECURITY_PREREQUISITE_SCHEMA) errors.push({ code: 'SUBJECT_MAPPING_STALE', field: 'schema_version' });
  if (!SUBJECT_STATUSES.includes(value.status)) errors.push({ code: 'SUBJECT_ASSERTION_INVALID', field: 'status' });
  if (!integer(value.mapping_version, 1) || !integer(value.security_version, 1)) errors.push({ code: 'SUBJECT_MAPPING_STALE', field: 'versions' });
  if (!timestamp(value.bound_at) || !timestamp(value.effective_at)) errors.push({ code: 'SUBJECT_ASSERTION_INVALID', field: 'time' });
  if (value.revoked_at != null && !timestamp(value.revoked_at)) errors.push({ code: 'SUBJECT_ASSERTION_INVALID', field: 'revoked_at' });
  if (value.reassignment_prohibited !== true) errors.push({ code: 'SUBJECT_MAPPING_AMBIGUOUS', field: 'reassignment_prohibited' });
  if (!exactProductionSecurityScope(value)) errors.push({ code: 'SUBJECT_MAPPING_AMBIGUOUS', field: 'scope' });
  for (const forbidden of ['email', 'raw_token', 'access_token', 'id_token', 'assertion']) {
    if (forbidden in value) errors.push({ code: 'SUBJECT_ASSERTION_INVALID', field: forbidden });
  }
  return result(errors, value);
}

export function validateAuthenticationAssertion(value) {
  const errors = [];
  if (!object(value)) return result([{ code: 'SUBJECT_ASSERTION_REQUIRED', field: '$' }], value);
  for (const key of ['assertion_reference', 'subject_id', 'issuer', 'audience', 'auth_strength', 'session_binding_reference']) {
    if (!opaque(value[key], 256)) errors.push({ code: 'SUBJECT_ASSERTION_INVALID', field: key });
  }
  if (!timestamp(value.authenticated_at)) errors.push({ code: 'SUBJECT_ASSERTION_INVALID', field: 'authenticated_at' });
  if (!integer(value.security_version, 1)) errors.push({ code: 'SUBJECT_MAPPING_STALE', field: 'security_version' });
  if (value.status !== 'VERIFIED') errors.push({ code: 'SUBJECT_ASSERTION_INVALID', field: 'status' });
  for (const forbidden of ['raw_token', 'access_token', 'id_token', 'cookie', 'credential']) {
    if (forbidden in value) errors.push({ code: 'SUBJECT_ASSERTION_INVALID', field: forbidden });
  }
  return result(errors, value);
}

export function validatePreAuthSession(value) {
  const errors = [];
  if (!object(value)) return result([{ code: 'SESSION_ELEVATION_REQUIRED', field: '$' }], value);
  if (!opaque(value.pre_auth_session_id, 256) || !opaque(value.browser_binding_hash, 256)) errors.push({ code: 'SESSION_ELEVATION_REQUIRED', field: 'binding' });
  if (!integer(value.csrf_generation, 1)) errors.push({ code: 'PRE_AUTH_CSRF_REPLAYED', field: 'csrf_generation' });
  if (!timestamp(value.issued_at) || !timestamp(value.expires_at)) errors.push({ code: 'SESSION_ELEVATION_REQUIRED', field: 'time' });
  if (!PRE_AUTH_SESSION_STATUSES.includes(value.status)) errors.push({ code: 'SESSION_ELEVATION_REQUIRED', field: 'status' });
  if (value.grants_authenticated_authority !== false) errors.push({ code: 'SESSION_ELEVATION_REQUIRED', field: 'grants_authenticated_authority' });
  return result(errors, value);
}

export function validateAuthenticatedSubscriberSession(value) {
  const errors = [];
  if (!object(value)) return result([{ code: 'SESSION_ELEVATION_REQUIRED', field: '$' }], value);
  for (const key of [
    'authenticated_session_id',
    'subscriber_subject_id',
    'browser_binding_hash',
    'issuer',
    'audience',
    'auth_strength',
    'rotation_parent_reference',
  ]) {
    if (!opaque(value[key], 256)) errors.push({ code: 'SESSION_ELEVATION_REQUIRED', field: key });
  }
  for (const key of ['issued_at', 'expires_at', 'last_seen_at']) {
    if (!timestamp(value[key])) errors.push({ code: 'SESSION_ELEVATION_REQUIRED', field: key });
  }
  for (const key of ['subject_security_version', 'csrf_generation', 'session_epoch']) {
    if (!integer(value[key], 1)) errors.push({ code: 'SESSION_ROTATION_FAILED', field: key });
  }
  if (!AUTHENTICATED_SESSION_STATUSES.includes(value.status)) errors.push({ code: 'SESSION_ELEVATION_REQUIRED', field: 'status' });
  if ('raw_token' in value || 'cookie' in value) errors.push({ code: 'SESSION_ELEVATION_REQUIRED', field: 'raw_session_material' });
  return result(errors, value);
}

export function validateRetentionAuthority(value) {
  const errors = [];
  if (!object(value)) return result([{ code: 'RETENTION_AUTHORITY_INVALID', field: '$' }], value);
  for (const key of ['policy_id', 'owner_subject_ref', 'effective_at', 'human_approval_reference', 'migration_disposition']) {
    if (!text(value[key], 512)) errors.push({ code: 'RETENTION_AUTHORITY_INVALID', field: key });
  }
  if (!integer(value.version, 1)) errors.push({ code: 'RETENTION_AUTHORITY_INVALID', field: 'version' });
  if (!['DRAFT', 'APPROVED', 'SUPERSEDED', 'REVOKED'].includes(value.status)) errors.push({ code: 'RETENTION_POLICY_UNAPPROVED', field: 'status' });
  if (!timestamp(value.effective_at)) errors.push({ code: 'RETENTION_AUTHORITY_INVALID', field: 'effective_at' });
  if (!Array.isArray(value.approver_subject_refs) || value.approver_subject_refs.length < 1 || value.approver_subject_refs.some((item) => !text(item, 256))) {
    errors.push({ code: 'RETENTION_AUTHORITY_INVALID', field: 'approver_subject_refs' });
  }
  if (!Array.isArray(value.rules) || value.rules.length < 1) {
    errors.push({ code: 'RETENTION_AUTHORITY_INVALID', field: 'rules' });
  } else {
    for (const [index, rule] of value.rules.entries()) {
      if (!RETENTION_DATA_CLASSES.includes(rule?.data_class)) errors.push({ code: 'RETENTION_AUTHORITY_INVALID', field: `rules.${index}.data_class` });
      for (const key of [
        'trigger',
        'duration_or_event_rule',
        'legal_hold_behavior',
        'subscriber_request_behavior',
        'coach_request_behavior',
        'deletion_eligibility',
        'execution_entitlement',
        'audit_retention_rule',
        'backup_disposition',
        'human_approved_source_reference',
      ]) {
        if (!text(rule?.[key], 512)) errors.push({ code: 'RETENTION_AUTHORITY_INVALID', field: `rules.${index}.${key}` });
      }
    }
  }
  return result(errors, value);
}

export function validateLegalHold(value) {
  const errors = [];
  if (!object(value)) return result([{ code: 'LEGAL_HOLD_ACTIVE', field: '$' }], value);
  for (const key of ['hold_id', 'exact_scope_hash', 'authority_subject_ref', 'reason_code', 'policy_version', 'audit_event_id']) {
    if (!opaque(value[key], 256)) errors.push({ code: 'RETENTION_AUTHORITY_INVALID', field: key });
  }
  if (!timestamp(value.issued_at) || !timestamp(value.review_at)) errors.push({ code: 'RETENTION_AUTHORITY_INVALID', field: 'time' });
  if (value.released_at != null && !timestamp(value.released_at)) errors.push({ code: 'RETENTION_AUTHORITY_INVALID', field: 'released_at' });
  if (!['ACTIVE', 'RELEASED', 'EXPIRED'].includes(value.status)) errors.push({ code: 'RETENTION_AUTHORITY_INVALID', field: 'status' });
  if (!Array.isArray(value.governed_data_classes) || value.governed_data_classes.some((item) => !RETENTION_DATA_CLASSES.includes(item))) errors.push({ code: 'RETENTION_AUTHORITY_INVALID', field: 'governed_data_classes' });
  return result(errors, value);
}

export function validateDeletionJob(value) {
  const errors = [];
  if (!object(value)) return result([{ code: 'DELETION_TARGET_INCOMPLETE', field: '$' }], value);
  for (const key of ['deletion_job_id', 'exact_scope_hash', 'policy_id', 'requested_by_subject_ref', 'created_at', 'updated_at']) {
    if (!opaque(value[key], 256)) errors.push({ code: 'DELETION_TARGET_INCOMPLETE', field: key });
  }
  for (const key of ['policy_version', 'deletion_epoch', 'lease_fencing_token']) {
    if (!integer(value[key], 1)) errors.push({ code: 'DELETION_TARGET_INCOMPLETE', field: key });
  }
  if (!DELETION_JOB_STATES.includes(value.state)) errors.push({ code: 'DELETION_TARGET_INCOMPLETE', field: 'state' });
  if (!Array.isArray(value.approved_by_subject_refs) || value.approved_by_subject_refs.length < 1) errors.push({ code: 'RETENTION_AUTHORITY_INVALID', field: 'approved_by_subject_refs' });
  if (!Array.isArray(value.targets) || value.targets.length < 1) {
    errors.push({ code: 'DELETION_TARGET_INCOMPLETE', field: 'targets' });
  } else {
    for (const [index, target] of value.targets.entries()) {
      for (const key of ['target_id', 'target_class', 'store_id', 'required_disposition']) {
        if (!opaque(target?.[key], 256)) errors.push({ code: 'DELETION_TARGET_INCOMPLETE', field: `targets.${index}.${key}` });
      }
      if (!DELETION_TARGET_STATES.includes(target?.state)) errors.push({ code: 'DELETION_TARGET_INCOMPLETE', field: `targets.${index}.state` });
      if (!integer(target?.attempt_count, 0)) errors.push({ code: 'DELETION_TARGET_INCOMPLETE', field: `targets.${index}.attempt_count` });
    }
  }
  return result(errors, value);
}

export function validateOperatorSubject(value) {
  const errors = [];
  if (!object(value)) return result([{ code: 'OPERATOR_AUTHENTICATION_REQUIRED', field: '$' }], value);
  for (const key of ['operator_subject_id', 'issuer', 'audience', 'created_at']) {
    if (!opaque(value[key], 256)) errors.push({ code: 'OPERATOR_AUTHENTICATION_REQUIRED', field: key });
  }
  if (!['ACTIVE', 'REVOKED', 'DISABLED'].includes(value.status)) errors.push({ code: 'OPERATOR_AUTHENTICATION_REQUIRED', field: 'status' });
  if (!integer(value.security_version, 1)) errors.push({ code: 'OPERATOR_AUTHENTICATION_REQUIRED', field: 'security_version' });
  if (!Array.isArray(value.role_ids) || value.role_ids.length < 1 || value.role_ids.some((role) => !OPERATOR_ROLES.includes(role))) errors.push({ code: 'OPERATOR_ENTITLEMENT_INVALID', field: 'role_ids' });
  if (value.revoked_at != null && !timestamp(value.revoked_at)) errors.push({ code: 'OPERATOR_AUTHENTICATION_REQUIRED', field: 'revoked_at' });
  if (value.operator_subject_id === 'SUBDEV1' || value.role_ids?.includes('SUBDEV1')) errors.push({ code: 'OPERATOR_AUTHENTICATION_REQUIRED', field: 'developer_operator_separation' });
  return result(errors, value);
}

export function validateOperatorSession(value) {
  const errors = [];
  if (!object(value)) return result([{ code: 'OPERATOR_AUTHENTICATION_REQUIRED', field: '$' }], value);
  for (const key of ['operator_session_id', 'operator_subject_id', 'environment_id', 'auth_strength']) {
    if (!opaque(value[key], 256)) errors.push({ code: 'OPERATOR_AUTHENTICATION_REQUIRED', field: key });
  }
  if (!timestamp(value.issued_at) || !timestamp(value.expires_at)) errors.push({ code: 'OPERATOR_AUTHENTICATION_REQUIRED', field: 'time' });
  if (!['ACTIVE', 'REVOKED', 'EXPIRED'].includes(value.status)) errors.push({ code: 'OPERATOR_AUTHENTICATION_REQUIRED', field: 'status' });
  if (!integer(value.security_version, 1)) errors.push({ code: 'OPERATOR_AUTHENTICATION_REQUIRED', field: 'security_version' });
  return result(errors, value);
}

export function validateOperatorEntitlement(value) {
  const errors = [];
  if (!object(value)) return result([{ code: 'OPERATOR_ENTITLEMENT_INVALID', field: '$' }], value);
  for (const key of ['entitlement_id', 'operator_subject_id', 'environment_scope', 'issued_by', 'issued_at', 'expires_at']) {
    if (!opaque(value[key], 256)) errors.push({ code: 'OPERATOR_ENTITLEMENT_INVALID', field: key });
  }
  if (!Array.isArray(value.action_allowlist) || value.action_allowlist.some((action) => !OPERATOR_ACTIONS.includes(action))) errors.push({ code: 'OPERATOR_ENTITLEMENT_INVALID', field: 'action_allowlist' });
  if (!Array.isArray(value.tenant_scope_allowlist) || value.tenant_scope_allowlist.some((scope) => !opaque(scope, 160))) errors.push({ code: 'OPERATOR_ENTITLEMENT_INVALID', field: 'tenant_scope_allowlist' });
  if (typeof value.requires_reason !== 'boolean' || typeof value.requires_dual_control !== 'boolean') errors.push({ code: 'OPERATOR_ENTITLEMENT_INVALID', field: 'requirements' });
  if (!['ACTIVE', 'REVOKED', 'EXPIRED'].includes(value.status)) errors.push({ code: 'OPERATOR_ENTITLEMENT_INVALID', field: 'status' });
  return result(errors, value);
}

export function knownProductionSecurityPolicyVersions() {
  return deepFreeze(Object.values(PRODUCTION_SECURITY_POLICY_VERSIONS));
}
