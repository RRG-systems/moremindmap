import { deepFreeze } from '../../validation.js';
import {
  COACH_CONNECT_SECURITY_POLICY_VERSION,
  COACH_CONNECT_SECURITY_VERSION,
  LIVE_SESSION_SECURITY_PRIVACY_CLASSES,
  SECURITY_ACTIONS,
  SECURITY_ACTOR_ROLES,
} from './constants.js';

const object = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value, max = 512) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const timestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const result = (errors, value) => deepFreeze({
  valid: errors.length === 0,
  errors,
  value: errors.length ? null : deepFreeze(structuredClone(value)),
});

export function exactSecurityScope(scope) {
  return object(scope)
    && ['tenant_id', 'profile_id', 'business_id', 'subscriber_id'].every((key) => text(scope[key], 160));
}

export function sameSecurityScope(left, right) {
  return exactSecurityScope(left)
    && exactSecurityScope(right)
    && ['tenant_id', 'profile_id', 'business_id', 'subscriber_id'].every((key) => left[key] === right[key]);
}

export function validateSecurityActor(value) {
  const errors = [];
  if (!object(value)) return result([{ code: 'AUTHENTICATION_FAILED', field: '$' }], value);
  if (!text(value.actor_id, 160)) errors.push({ code: 'AUTHENTICATION_FAILED', field: 'actor_id' });
  if (!SECURITY_ACTOR_ROLES.includes(value.role)) errors.push({ code: 'AUTHENTICATION_FAILED', field: 'role' });
  if (!text(value.subject_binding_hash, 256)) errors.push({ code: 'AUTHENTICATION_FAILED', field: 'subject_binding_hash' });
  if (!Number.isInteger(value.security_version) || value.security_version < 1) errors.push({ code: 'AUTHENTICATION_FAILED', field: 'security_version' });
  return result(errors, value);
}

export function validateSecuritySession(value) {
  const errors = [];
  if (!object(value)) return result([{ code: 'AUTHENTICATION_FAILED', field: '$' }], value);
  for (const key of ['session_id', 'subject_binding_hash', 'browser_binding_hash']) {
    if (!text(value[key], 256)) errors.push({ code: 'AUTHENTICATION_FAILED', field: key });
  }
  if (!['ACTIVE', 'EXPIRED', 'REVOKED', 'ROTATED', 'INVALID'].includes(value.status)) errors.push({ code: 'AUTHENTICATION_FAILED', field: 'status' });
  if (!timestamp(value.issued_at) || !timestamp(value.expires_at)) errors.push({ code: 'AUTHENTICATION_FAILED', field: 'issued_at_or_expires_at' });
  if (!Number.isInteger(value.security_version) || value.security_version < 1) errors.push({ code: 'AUTHENTICATION_FAILED', field: 'security_version' });
  return result(errors, value);
}

export function validateSecurityResource(value) {
  const errors = [];
  if (!object(value)) return result([{ code: 'AUTHORIZATION_DENIED', field: '$' }], value);
  if (!text(value.resource_type, 96) || !text(value.resource_id, 256)) errors.push({ code: 'AUTHORIZATION_DENIED', field: 'resource_identity' });
  if (!exactSecurityScope(value.scope)) errors.push({ code: 'TENANT_SCOPE_VIOLATION', field: 'scope' });
  if (!Number.isInteger(value.version) || value.version < 0) errors.push({ code: 'AUTHORIZATION_DENIED', field: 'version' });
  if (!Number.isInteger(value.deletion_epoch) || value.deletion_epoch < 0) errors.push({ code: 'DELETION_REQUIRED', field: 'deletion_epoch' });
  if (!LIVE_SESSION_SECURITY_PRIVACY_CLASSES.includes(value.privacy_class)) errors.push({ code: 'REDACTION_FAILED', field: 'privacy_class' });
  return result(errors, value);
}

export function validateSecurityDecisionInput(value) {
  const errors = [];
  const actor = validateSecurityActor(value?.actor);
  const session = validateSecuritySession(value?.session);
  const resource = validateSecurityResource(value?.resource);
  if (!actor.valid) errors.push(...actor.errors);
  if (!session.valid) errors.push(...session.errors);
  if (!resource.valid) errors.push(...resource.errors);
  if (!Object.values(SECURITY_ACTIONS).includes(value?.action)) errors.push({ code: 'AUTHORIZATION_DENIED', field: 'action' });
  if (!exactSecurityScope(value?.actor_scope)) errors.push({ code: 'TENANT_SCOPE_VIOLATION', field: 'actor_scope' });
  if (!timestamp(value?.evaluated_at)) errors.push({ code: 'AUTHENTICATION_FAILED', field: 'evaluated_at' });
  if (!text(value?.correlation_id, 256)) errors.push({ code: 'AUTHORIZATION_DENIED', field: 'correlation_id' });
  if (!text(value?.policy_version || COACH_CONNECT_SECURITY_POLICY_VERSION, 128)) errors.push({ code: 'AUTHORIZATION_DENIED', field: 'policy_version' });
  return result(errors, value);
}

export function validateCapabilityRecord(value) {
  const errors = [];
  if (!object(value)) return result([{ code: 'CAPABILITY_INVALID', field: '$' }], value);
  for (const key of [
    'capability_id',
    'token_hash',
    'purpose',
    'subject_binding_hash',
    'scope_binding_hash',
    'browser_binding_hash',
    'environment_id',
    'issuer',
    'audience',
    'key_id',
  ]) {
    if (!text(value[key], key === 'token_hash' ? 256 : 160)) errors.push({ code: 'CAPABILITY_INVALID', field: key });
  }
  for (const key of ['issued_at', 'not_before', 'expires_at']) {
    if (!timestamp(value[key])) errors.push({ code: 'CAPABILITY_INVALID', field: key });
  }
  if (!['ACTIVE', 'REVOKED', 'ROTATED', 'EXPIRED'].includes(value.status)) errors.push({ code: 'CAPABILITY_INVALID', field: 'status' });
  if (!Number.isInteger(value.security_version) || value.security_version < 1) errors.push({ code: 'CAPABILITY_INVALID', field: 'security_version' });
  if (value.schema_version !== COACH_CONNECT_SECURITY_VERSION) errors.push({ code: 'CAPABILITY_INVALID', field: 'schema_version' });
  for (const key of ['billing_evidence', 'stripe_subscription_created', 'admin_authority', 'coach_authority', 'operator_authority', 'canonical_mutation_authority']) {
    if (value[key] !== false) errors.push({ code: 'CAPABILITY_INVALID', field: key });
  }
  if ('raw_token' in value || 'access_code' in value || 'cookie' in value) errors.push({ code: 'CAPABILITY_INVALID', field: 'forbidden_secret_material' });
  return result(errors, value);
}

export function validateCsrfGrant(value) {
  const errors = [];
  if (!object(value)) return result([{ code: 'CSRF_VALIDATION_FAILED', field: '$' }], value);
  for (const key of ['grant_id', 'proof_hash', 'browser_binding_hash', 'method', 'route', 'environment_id']) {
    if (!text(value[key], 256)) errors.push({ code: 'CSRF_VALIDATION_FAILED', field: key });
  }
  if (!timestamp(value.issued_at) || !timestamp(value.expires_at)) errors.push({ code: 'CSRF_VALIDATION_FAILED', field: 'time' });
  if (!['ACTIVE', 'CONSUMED', 'EXPIRED'].includes(value.status)) errors.push({ code: 'CSRF_VALIDATION_FAILED', field: 'status' });
  if ('proof' in value || 'token' in value) errors.push({ code: 'CSRF_VALIDATION_FAILED', field: 'raw_proof_forbidden' });
  return result(errors, value);
}

export function validateDeletionEpoch(value) {
  const errors = [];
  if (!object(value)) return result([{ code: 'DELETION_REQUIRED', field: '$' }], value);
  if (!text(value.scope_hash, 256) || !text(value.reason_code, 160) || !timestamp(value.advanced_at)) errors.push({ code: 'DELETION_REQUIRED', field: 'identity_or_time' });
  if (!Number.isInteger(value.epoch) || value.epoch < 1) errors.push({ code: 'DELETION_REQUIRED', field: 'epoch' });
  if (!text(value.policy_version, 160)) errors.push({ code: 'DELETION_REQUIRED', field: 'policy_version' });
  return result(errors, value);
}
