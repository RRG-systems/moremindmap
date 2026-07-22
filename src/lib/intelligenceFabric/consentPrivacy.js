import { CONSENT_STATUSES, PRIVACY_CLASSIFICATIONS, PRIVACY_RANK, VALIDATION_ERROR_CODES, VALIDATION_WARNING_CODES } from './constants.js';
import { isPlainObject, issue, requireEnum, requireString, validateTimestamp, validationResult } from './validation.js';
import { validateIdentityRef } from './identity.js';

export function defaultPrivacyClassification(context = {}) {
  if (context.coach_session || context.private_coach_content) return 'COACH_SESSION_PRIVATE';
  if (context.financial) return 'RESTRICTED_FINANCIAL';
  if (context.behavioral) return 'RESTRICTED_BEHAVIORAL';
  return 'TENANT_PRIVATE';
}

export function validatePrivacyClassification(value) {
  const errors = [];
  requireEnum(value, PRIVACY_CLASSIFICATIONS, 'privacy_classification', errors);
  return validationResult('PrivacyClassification', errors, [], errors.length ? null : value);
}

export function validatePrivacyTransition(from, to) {
  const errors = [];
  requireEnum(from, PRIVACY_CLASSIFICATIONS, 'from', errors);
  requireEnum(to, PRIVACY_CLASSIFICATIONS, 'to', errors);
  if (!errors.length && PRIVACY_RANK[to] < PRIVACY_RANK[from]) errors.push(issue(VALIDATION_ERROR_CODES.PRIVACY_DOWNGRADE, 'to', 'privacy classification cannot be silently downgraded'));
  return validationResult('PrivacyTransition', errors, [], errors.length ? null : { from, to, requires_new_event: true });
}

export function validateAnonymizedAggregate(value) {
  const errors = [];
  if (value?.privacy_classification !== 'ANONYMIZED_AGGREGATE') errors.push(issue(VALIDATION_ERROR_CODES.INVALID_ENUM, 'privacy_classification', 'classification must be ANONYMIZED_AGGREGATE'));
  for (const key of ['profile_id', 'person_id', 'business_id', 'subscription_id', 'direct_identity_refs']) {
    if (value?.[key] != null && (!Array.isArray(value[key]) || value[key].length > 0)) errors.push(issue(VALIDATION_ERROR_CODES.DIRECT_IDENTITY_FOR_ANONYMIZED, key, 'anonymized aggregate cannot carry direct identity references'));
  }
  if (value?.pseudonymized === true) errors.push(issue(VALIDATION_ERROR_CODES.DIRECT_IDENTITY_FOR_ANONYMIZED, 'pseudonymized', 'pseudonymized data is not anonymized'));
  return validationResult('AnonymizedAggregate', errors, [], errors.length ? null : value);
}

export function validateConsentRecord(value) {
  const errors = [], warnings = [];
  if (!isPlainObject(value)) return validationResult('ConsentRecord', [issue(VALIDATION_ERROR_CODES.INVALID_TYPE, '$', 'consent record must be a plain object')]);
  requireString(value.consent_id, 'consent_id', errors);
  const subject = validateIdentityRef(value.subject_ref);
  if (!subject.valid) errors.push(...subject.errors.map((entry) => ({ ...entry, path: `subject_ref.${entry.path}` })));
  requireString(value.tenant_id, 'tenant_id', errors);
  requireString(value.consent_type, 'consent_type', errors);
  requireEnum(value.status, CONSENT_STATUSES, 'status', errors);
  if (!Array.isArray(value.scope) || value.scope.length === 0) errors.push(issue(VALIDATION_ERROR_CODES.REQUIRED, 'scope', 'consent scope must be a non-empty array'));
  requireString(value.purpose, 'purpose', errors);
  if (!Array.isArray(value.data_categories)) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_TYPE, 'data_categories', 'data_categories must be an array'));
  if (!Array.isArray(value.authorized_parties)) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_TYPE, 'authorized_parties', 'authorized_parties must be an array'));
  validateTimestamp(value.effective_at, 'effective_at', errors, true);
  validateTimestamp(value.expires_at, 'expires_at', errors);
  validateTimestamp(value.revoked_at, 'revoked_at', errors);
  validateTimestamp(value.created_at, 'created_at', errors, true);
  if (value.expires_at && value.effective_at && Date.parse(value.expires_at) < Date.parse(value.effective_at)) errors.push(issue(VALIDATION_ERROR_CODES.TEMPORAL_ORDER, 'expires_at', 'expiration cannot precede effective time'));
  if (value.revoked_at && value.effective_at && Date.parse(value.revoked_at) < Date.parse(value.effective_at) && !value.correction_of_consent_id) errors.push(issue(VALIDATION_ERROR_CODES.TEMPORAL_ORDER, 'revoked_at', 'revocation cannot precede effective time unless correcting a record'));
  if (value.status === 'REVOKED' && !value.revoked_at) errors.push(issue(VALIDATION_ERROR_CODES.REQUIRED, 'revoked_at', 'revoked consent requires revoked_at'));
  if (!isPlainObject(value.provenance)) errors.push(issue(VALIDATION_ERROR_CODES.PROVENANCE_REQUIRED, 'provenance', 'consent provenance is required'));
  if (!value.source_artifact) errors.push(issue(VALIDATION_ERROR_CODES.REQUIRED, 'source_artifact', 'source artifact is required'));
  if (!value.policy_version) warnings.push(issue(VALIDATION_WARNING_CODES.POLICY_NOT_CONFIGURED, 'policy_version', 'legal policy remains explicitly NOT_CONFIGURED', 'WARNING'));
  const normalized = errors.length ? null : Object.freeze({ ...value,
    learning_eligibility: value.learning_eligibility === true,
    cross_tenant_eligibility: value.cross_tenant_eligibility === true,
    anonymization_requirement: value.anonymization_requirement ?? 'REQUIRED_FOR_ANY_DERIVED_BROAD_USE',
    legal_retention_policy: value.legal_retention_policy ?? 'NOT_CONFIGURED',
    grants_runtime_authorization: false,
  });
  return validationResult('ConsentRecord', errors, warnings, normalized);
}

export function evaluateConsent({ consent, purpose, scope, tenant_id, at = new Date().toISOString(), relationship_authorized = false, private_coach_content = false }) {
  if (!consent) return Object.freeze({ allowed: false, code: VALIDATION_ERROR_CODES.CONSENT_REQUIRED, reason: 'ABSENCE_IS_NOT_CONSENT' });
  const validation = validateConsentRecord(consent);
  if (!validation.valid) return Object.freeze({ allowed: false, code: VALIDATION_ERROR_CODES.CONSENT_INACTIVE, reason: 'INVALID_CONSENT', validation });
  if (consent.status !== 'ACTIVE' || (consent.revoked_at && Date.parse(consent.revoked_at) <= Date.parse(at)) || (consent.expires_at && Date.parse(consent.expires_at) <= Date.parse(at))) return Object.freeze({ allowed: false, code: VALIDATION_ERROR_CODES.CONSENT_INACTIVE, reason: 'CONSENT_NOT_ACTIVE' });
  if (consent.tenant_id !== tenant_id || consent.purpose !== purpose || !consent.scope.includes(scope)) return Object.freeze({ allowed: false, code: VALIDATION_ERROR_CODES.CONSENT_SCOPE_MISMATCH, reason: 'PURPOSE_SCOPE_OR_TENANT_MISMATCH' });
  if (private_coach_content && consent.learning_eligibility !== true && scope.includes('universal')) return Object.freeze({ allowed: false, code: VALIDATION_ERROR_CODES.CONSENT_SCOPE_MISMATCH, reason: 'PRIVATE_COACH_UNIVERSAL_USE_DENIED' });
  if (!relationship_authorized) return Object.freeze({ allowed: false, code: VALIDATION_ERROR_CODES.AUTHORIZATION_REQUIRED, reason: 'CONSENT_DOES_NOT_PROVE_AUTHORIZATION' });
  return Object.freeze({ allowed: true, code: null, reason: 'CONSENT_AND_RELATIONSHIP_MATCH' });
}
