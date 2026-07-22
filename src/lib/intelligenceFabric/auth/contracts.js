import { hashCanonicalJson } from '../hashing.js';
import { deepFreeze } from '../validation.js';

export const COACH_AUTH_VERSION = '1.0.0';
export const COACH_ACCOUNT_STATUSES = Object.freeze(['ACTIVE', 'SUSPENDED', 'REVOKED', 'LOCKED']);
export const COACH_VERIFICATION_STATES = Object.freeze(['UNVERIFIED', 'PENDING', 'VERIFIED', 'FAILED']);
export const COACH_SESSION_STATUSES = Object.freeze(['ACTIVE', 'EXPIRED', 'REVOKED', 'ROTATED', 'INVALID']);
export const ACCEPTANCE_CONTEXT_STATUSES = Object.freeze(['PENDING_AUTH', 'AUTHENTICATED', 'RESUMED', 'EXPIRED', 'REVOKED', 'CONSUMED']);
export const COACH_SECURITY_EVENT_TYPES = Object.freeze([
  'ACCOUNT_CREATED', 'VERIFICATION_STARTED', 'VERIFICATION_COMPLETED', 'SIGN_IN_SUCCEEDED', 'SIGN_IN_FAILED',
  'SESSION_ISSUED', 'SESSION_ROTATED', 'SESSION_EXPIRED', 'SESSION_REVOKED', 'SESSION_INVALIDATED', 'ACCOUNT_SUSPENDED',
  'ACCOUNT_REVOKED', 'ACCOUNT_LOCKED', 'ACCEPTANCE_CONTEXT_CREATED', 'ACCEPTANCE_CONTEXT_RESUMED',
  'ACCEPTANCE_CONTEXT_REVOKED', 'ACCEPTANCE_CONTEXT_CONSUMED',
]);

const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const isTimestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const isOpaque = (value) => typeof value === 'string' && /^[a-z][a-z0-9_-]{2,127}$/i.test(value);
const result = (errors, value) => deepFreeze({ valid: errors.length === 0, errors, value: errors.length ? null : deepFreeze({ ...value }) });
const required = (value, key, errors, predicate = isOpaque) => { if (!predicate(value?.[key])) errors.push({ code: 'REQUIRED_OR_INVALID', field: key }); };

export const opaqueHash = (domain, value) => `${domain}_${hashCanonicalJson({ domain, value }).slice(0, 32)}`;

export function validateCoachActor(value) {
  const errors = [];
  if (!isObject(value)) return result([{ code: 'INVALID_TYPE', field: '$' }], value);
  required(value, 'coach_actor_id', errors); required(value, 'auth_subject_reference', errors);
  required(value, 'primary_contact_reference', errors); required(value, 'display_name', errors, (x) => typeof x === 'string' && x.trim().length > 0 && x.length <= 120);
  if (!COACH_VERIFICATION_STATES.includes(value.verification_state)) errors.push({ code: 'INVALID_VERIFICATION_STATE', field: 'verification_state' });
  if (!COACH_ACCOUNT_STATUSES.includes(value.account_status)) errors.push({ code: 'INVALID_ACCOUNT_STATUS', field: 'account_status' });
  if (!isTimestamp(value.created_at) || !isTimestamp(value.updated_at)) errors.push({ code: 'INVALID_TIMESTAMP', field: 'created_at_or_updated_at' });
  if (!Number.isInteger(value.security_version) || value.security_version < 1) errors.push({ code: 'INVALID_SECURITY_VERSION', field: 'security_version' });
  if (value.metadata && (!isObject(value.metadata) || Object.keys(value.metadata).some((key) => /password|secret|token|subscriber|business|profile/i.test(key)))) errors.push({ code: 'UNSAFE_METADATA', field: 'metadata' });
  return result(errors, value);
}

export function validateCoachSession(value) {
  const errors = [];
  if (!isObject(value)) return result([{ code: 'INVALID_TYPE', field: '$' }], value);
  for (const key of ['session_id', 'coach_actor_id', 'token_hash', 'rotation_reference']) required(value, key, errors);
  if (!COACH_SESSION_STATUSES.includes(value.status)) errors.push({ code: 'INVALID_SESSION_STATUS', field: 'status' });
  for (const key of ['issued_at', 'expires_at', 'last_seen_at']) if (!isTimestamp(value[key])) errors.push({ code: 'INVALID_TIMESTAMP', field: key });
  if (isTimestamp(value.issued_at) && isTimestamp(value.expires_at) && Date.parse(value.expires_at) <= Date.parse(value.issued_at)) errors.push({ code: 'INVALID_EXPIRY', field: 'expires_at' });
  if (!Number.isInteger(value.security_version) || value.security_version < 1) errors.push({ code: 'INVALID_SECURITY_VERSION', field: 'security_version' });
  if ('raw_token' in value || 'session_token' in value) errors.push({ code: 'RAW_TOKEN_FORBIDDEN', field: 'token' });
  return result(errors, value);
}

export function validatePendingAcceptanceContext(value) {
  const errors = [];
  if (!isObject(value)) return result([{ code: 'INVALID_TYPE', field: '$' }], value);
  for (const key of ['pending_context_id', 'opaque_future_invitation_reference', 'intended_purpose', 'browser_binding_hash']) required(value, key, errors);
  if (!ACCEPTANCE_CONTEXT_STATUSES.includes(value.status)) errors.push({ code: 'INVALID_CONTEXT_STATUS', field: 'status' });
  for (const key of ['created_at', 'expires_at']) if (!isTimestamp(value[key])) errors.push({ code: 'INVALID_TIMESTAMP', field: key });
  if (Object.keys(value).some((key) => /subscriber|tenant|profile|business|entitlement|relationship/i.test(key))) errors.push({ code: 'COACH_CONNECT_SCOPE_FORBIDDEN', field: '$' });
  if (value.grants_coach_connect_authority !== false) errors.push({ code: 'AUTHORITY_MUST_BE_FALSE', field: 'grants_coach_connect_authority' });
  return result(errors, value);
}

export function createCoachSecurityEvent({ event_type, actor_id = null, session_id = null, context_id = null, reason_code, occurred_at, correlation_id = null }) {
  if (!COACH_SECURITY_EVENT_TYPES.includes(event_type) || !isTimestamp(occurred_at) || !reason_code) return deepFreeze({ ok: false, code: 'INVALID_SECURITY_EVENT' });
  const body = { event_version: COACH_AUTH_VERSION, event_type, actor_ref: actor_id ? opaqueHash('actor', actor_id) : null,
    session_ref: session_id ? opaqueHash('session', session_id) : null, context_ref: context_id ? opaqueHash('context', context_id) : null,
    reason_code, occurred_at, correlation_id };
  return deepFreeze({ ok: true, event: deepFreeze({ ...body, event_id: opaqueHash('security_event', body) }) });
}
