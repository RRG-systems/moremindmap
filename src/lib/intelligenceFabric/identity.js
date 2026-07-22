import { IDENTITY_TYPES, RELATIONSHIP_STATUSES, RELATIONSHIP_TYPES, VALIDATION_ERROR_CODES } from './constants.js';
import { isPlainObject, issue, requireEnum, requireString, validateTimestamp, validationResult } from './validation.js';

export const PROFILE_ID_PATTERN = /^mm-\d{8}-[a-z0-9]{8}$/;
export const OPAQUE_ID_PATTERN = /^[a-z][a-z0-9_-]{2,127}$/i;

export function isCompatibleProfileId(value) { return typeof value === 'string' && PROFILE_ID_PATTERN.test(value); }

export function validateIdentityRef(value, expectedType = null) {
  const errors = [];
  if (!isPlainObject(value)) return validationResult(`${expectedType || 'Identity'}Ref`, [issue(VALIDATION_ERROR_CODES.INVALID_TYPE, '$', 'identity reference must be a plain object')]);
  requireEnum(value.type, IDENTITY_TYPES, 'type', errors);
  if (expectedType && value.type !== expectedType) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_ID, 'type', `identity type must be ${expectedType}`));
  if (requireString(value.id, 'id', errors)) {
    const valid = value.type === 'PROFILE' ? isCompatibleProfileId(value.id) : OPAQUE_ID_PATTERN.test(value.id);
    if (!valid) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_ID, 'id', 'id must be opaque, stable, and valid for its identity type'));
  }
  if (value.display_name && value.display_name === value.id) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_ID, 'id', 'display name cannot substitute for canonical ID'));
  if (value.type !== 'TENANT') requireString(value.tenant_id, 'tenant_id', errors);
  return validationResult(`${expectedType || value.type || 'Identity'}Ref`, errors, [], errors.length ? null : Object.freeze({ ...value }));
}

export const validatePersonRef = (v) => validateIdentityRef(v, 'PERSON');
export const validateProfileRef = (v) => validateIdentityRef(v, 'PROFILE');
export const validateBusinessRef = (v) => validateIdentityRef(v, 'BUSINESS');
export const validateTeamRef = (v) => validateIdentityRef(v, 'TEAM');
export const validateCoachRef = (v) => validateIdentityRef(v, 'COACH');
export const validateOrganizationRef = (v) => validateIdentityRef(v, 'ORGANIZATION');
export const validateSubscriptionRef = (v) => validateIdentityRef(v, 'SUBSCRIPTION');
export const validateTenantRef = (v) => validateIdentityRef(v, 'TENANT');
export const validateActorRef = (v) => validateIdentityRef(v, 'ACTOR');

export function validateEventIdentityScope(event) {
  const errors = [];
  if (!requireString(event?.tenant_id, 'tenant_id', errors)) return validationResult('EventIdentityScope', errors);
  const scoped = ['profile_id', 'business_id', 'organization_id', 'subscription_id'].filter((key) => typeof event[key] === 'string' && event[key]);
  if (scoped.length === 0) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_IDENTITY_SCOPE, '$', 'at least one profile, business, organization, or subscription ID is required'));
  if (event.profile_id && !isCompatibleProfileId(event.profile_id)) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_ID, 'profile_id', 'profile_id is incompatible with current MORE profile IDs'));
  for (const key of scoped.filter((key) => key !== 'profile_id')) if (!OPAQUE_ID_PATTERN.test(event[key])) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_ID, key, `${key} must be opaque`));
  return validationResult('EventIdentityScope', errors, [], errors.length ? null : { tenant_id: event.tenant_id, scoped_ids: scoped });
}

export function validateTenantRelationship(value, expectedType = null) {
  const errors = [];
  if (!isPlainObject(value)) return validationResult(expectedType || 'TenantRelationship', [issue(VALIDATION_ERROR_CODES.INVALID_TYPE, '$', 'relationship must be a plain object')]);
  requireString(value.relationship_id, 'relationship_id', errors);
  requireEnum(value.relationship_type, RELATIONSHIP_TYPES, 'relationship_type', errors);
  if (expectedType && value.relationship_type !== expectedType) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_ENUM, 'relationship_type', `relationship_type must be ${expectedType}`));
  requireString(value.source_tenant_id, 'source_tenant_id', errors);
  requireString(value.target_id, 'target_id', errors);
  requireEnum(value.status, RELATIONSHIP_STATUSES, 'status', errors);
  if (!Array.isArray(value.granted_scopes)) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_TYPE, 'granted_scopes', 'granted_scopes must be an array'));
  if (!Array.isArray(value.revoked_scopes)) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_TYPE, 'revoked_scopes', 'revoked_scopes must be an array'));
  validateTimestamp(value.effective_at, 'effective_at', errors, true);
  validateTimestamp(value.created_at, 'created_at', errors, true);
  validateTimestamp(value.revoked_at, 'revoked_at', errors);
  if (!isPlainObject(value.provenance)) errors.push(issue(VALIDATION_ERROR_CODES.PROVENANCE_REQUIRED, 'provenance', 'relationship provenance is required'));
  const crossTenant = value.target_tenant_id && value.target_tenant_id !== value.source_tenant_id;
  if (crossTenant && (!value.cross_tenant_authorization || !Array.isArray(value.consent_record_ids) || value.consent_record_ids.length === 0)) {
    errors.push(issue(VALIDATION_ERROR_CODES.CROSS_TENANT_DENIED, 'cross_tenant_authorization', 'cross-tenant relationship requires explicit authorization structure and consent references'));
  }
  return validationResult(expectedType || 'TenantRelationship', errors, [], errors.length ? null : Object.freeze({ ...value, grants_runtime_authorization: false }));
}

export const validateUserBusinessRelationship = (v) => validateTenantRelationship(v, 'USER_BUSINESS');
export const validateCoachUserRelationship = (v) => validateTenantRelationship(v, 'COACH_USER');
export const validateOrganizationMembership = (v) => validateTenantRelationship(v, 'ORGANIZATION_MEMBERSHIP');
export const validateSubscriptionEntitlementRef = (v) => validateTenantRelationship(v, 'SUBSCRIPTION_ENTITLEMENT');

export function evaluateRelationshipAuthorization({ relationship, required_scope, tenant_id }) {
  const validation = validateTenantRelationship(relationship);
  const authorized = validation.valid && relationship.status === 'ACTIVE' && relationship.source_tenant_id === tenant_id && relationship.granted_scopes.includes(required_scope) && !relationship.revoked_scopes.includes(required_scope);
  return Object.freeze({ authorized, validation, reason: authorized ? 'RELATIONSHIP_SCOPE_ACTIVE' : 'AUTHORIZATION_REQUIRED' });
}
