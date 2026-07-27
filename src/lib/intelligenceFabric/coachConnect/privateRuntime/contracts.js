import { hashCanonicalJson } from '../../hashing.js';
import { deepFreeze } from '../../validation.js';
import { isPrivateRuntimeFailureCode } from './failureCodes.js';

export const PRIVATE_RUNTIME_CONTRACT_VERSIONS = deepFreeze({
  verifiedAssertion: 'private-runtime-verified-assertion-v1',
  testerApproval: 'private-runtime-tester-approval-v1',
  subjectReceipt: 'private-runtime-subject-receipt-v1',
  capability: 'private-runtime-capability-v1',
  sessionReceipt: 'private-runtime-session-receipt-v1',
  attachmentRequest: 'private-runtime-attachment-request-v1',
  businessEngineAttachment: 'business-engine-attachment-v1',
  subscriptionAttachment: 'subscription-runtime-attachment-v1',
  coachConnectAttachment: 'coach-connect-attachment-v1',
  attachmentSet: 'private-runtime-attachment-set-v1',
  interactionReceipt: 'private-runtime-interaction-receipt-v1',
  evidenceIndex: 'private-runtime-evidence-index-v1',
});

export const PRIVATE_RUNTIME_SCOPE_FIELDS = deepFreeze([
  'tenant_id',
  'profile_id',
  'business_id',
  'subscriber_id',
]);

export const PRIVATE_RUNTIME_APPROVED_CAPABILITIES = deepFreeze([
  'BUSINESS_ENGINE_READ',
  'SUBSCRIPTION_INTERACTION',
  'COACH_CONNECT_SUBSCRIBER',
]);

const ASSERTION_FIELDS = deepFreeze([
  'schema_version',
  'assertion_reference',
  'subject_id',
  'issuer',
  'audience',
  'auth_strength',
  'session_binding_reference',
  'authenticated_at',
  'security_version',
  'status',
]);

const APPROVAL_FIELDS = deepFreeze([
  'approval_version',
  'approval_id',
  'environment_id',
  'tester_subject_ref',
  'exact_scope_hash',
  'purpose',
  'capability_allowlist',
  'approved_by',
  'approved_at',
  'expires_at',
  'status',
  'public_launch_authorized',
  'paid_entitlement_authorized',
  'canonical_promotion_authorized',
]);

const object = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value, max = 256) => typeof value === 'string'
  && value.trim().length > 0
  && value.length <= max;
const timestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const exactFields = (value, fields) => object(value)
  && Object.keys(value).length === fields.length
  && Object.keys(value).every((key) => fields.includes(key));
const result = (errors, value = null) => deepFreeze({
  valid: errors.length === 0,
  errors,
  value: errors.length ? null : structuredClone(value),
});
const fieldError = (code, field) => ({ code, field });

export function isOpaquePrivateRuntimeReference(value, max = 256) {
  return text(value, max)
    && !value.includes('@')
    && !/\s/.test(value)
    && !/^https?:\/\//i.test(value)
    && !/[/?#]/.test(value);
}

export function exactPrivateRuntimeScope(scope) {
  return exactFields(scope, PRIVATE_RUNTIME_SCOPE_FIELDS)
    && PRIVATE_RUNTIME_SCOPE_FIELDS.every((field) => isOpaquePrivateRuntimeReference(scope[field], 160));
}

export function samePrivateRuntimeScope(left, right) {
  return exactPrivateRuntimeScope(left)
    && exactPrivateRuntimeScope(right)
    && PRIVATE_RUNTIME_SCOPE_FIELDS.every((field) => left[field] === right[field]);
}

export function hashPrivateRuntimeScope(scope) {
  if (!exactPrivateRuntimeScope(scope)) throw new TypeError('exact private runtime scope is required');
  return hashCanonicalJson(Object.fromEntries(PRIVATE_RUNTIME_SCOPE_FIELDS.map((field) => [field, scope[field]])));
}

export function externalSubscriberSubjectReference(assertion) {
  const validation = validatePrivateRuntimeVerifiedAssertion(assertion);
  if (!validation.valid) return null;
  return `external_subject_${hashCanonicalJson({
    issuer: assertion.issuer,
    subject_id: assertion.subject_id,
  })}`;
}

export function validatePrivateRuntimeVerifiedAssertion(value, {
  expectedIssuer = null,
  expectedAudience = null,
  expectedSessionBindingReference = null,
  now = null,
  maxAgeMs = 15 * 60 * 1000,
} = {}) {
  const errors = [];
  if (!object(value)) return result([fieldError('SUBJECT_ASSERTION_REQUIRED', '$')]);
  if (!exactFields(value, ASSERTION_FIELDS)) errors.push(fieldError('SUBJECT_ASSERTION_INVALID', 'fields'));
  if (value.schema_version !== PRIVATE_RUNTIME_CONTRACT_VERSIONS.verifiedAssertion) {
    errors.push(fieldError('SUBJECT_ASSERTION_INVALID', 'schema_version'));
  }
  for (const field of ['assertion_reference', 'subject_id', 'audience', 'auth_strength', 'session_binding_reference']) {
    if (!isOpaquePrivateRuntimeReference(value[field])) errors.push(fieldError('SUBJECT_ASSERTION_INVALID', field));
  }
  if (value.subject_id === 'SUBDEV1') {
    errors.push(fieldError('SUBJECT_ASSERTION_INVALID', 'subject_id'));
  }
  if (!text(value.issuer, 512)) errors.push(fieldError('SUBJECT_ASSERTION_INVALID', 'issuer'));
  if (!timestamp(value.authenticated_at)) errors.push(fieldError('SUBJECT_ASSERTION_INVALID', 'authenticated_at'));
  if (!Number.isInteger(value.security_version) || value.security_version < 1) {
    errors.push(fieldError('SUBJECT_MAPPING_STALE', 'security_version'));
  }
  if (value.status !== 'VERIFIED') errors.push(fieldError('SUBJECT_ASSERTION_INVALID', 'status'));
  if (expectedIssuer != null && value.issuer !== expectedIssuer) errors.push(fieldError('SUBJECT_ASSERTION_INVALID', 'issuer'));
  if (expectedAudience != null && value.audience !== expectedAudience) errors.push(fieldError('SUBJECT_ASSERTION_INVALID', 'audience'));
  if (expectedSessionBindingReference != null
    && value.session_binding_reference !== expectedSessionBindingReference) {
    errors.push(fieldError('SUBJECT_ASSERTION_INVALID', 'session_binding_reference'));
  }
  if (Number.isFinite(now) && timestamp(value.authenticated_at)) {
    const authenticatedAt = Date.parse(value.authenticated_at);
    if (authenticatedAt > now || now - authenticatedAt > maxAgeMs) {
      errors.push(fieldError('SUBJECT_ASSERTION_INVALID', 'authenticated_at'));
    }
  }
  return result(errors, value);
}

export function validatePrivateRuntimeTesterApproval(value, {
  assertion = null,
  scope = null,
  environmentId = null,
  now = null,
} = {}) {
  const errors = [];
  if (!object(value)) return result([fieldError('PRIVATE_TESTER_APPROVAL_REQUIRED', '$')]);
  if (!exactFields(value, APPROVAL_FIELDS)) errors.push(fieldError('PRIVATE_TESTER_APPROVAL_REQUIRED', 'fields'));
  if (value.approval_version !== PRIVATE_RUNTIME_CONTRACT_VERSIONS.testerApproval) {
    errors.push(fieldError('PRIVATE_TESTER_APPROVAL_REQUIRED', 'approval_version'));
  }
  for (const field of ['approval_id', 'environment_id', 'tester_subject_ref', 'approved_by']) {
    if (!isOpaquePrivateRuntimeReference(value[field])) {
      errors.push(fieldError('PRIVATE_TESTER_APPROVAL_REQUIRED', field));
    }
  }
  if (!sha256(value.exact_scope_hash)) errors.push(fieldError('PRIVATE_TESTER_APPROVAL_REQUIRED', 'exact_scope_hash'));
  if (value.purpose !== 'FOUNDER_PRIVATE_RUNTIME_TEST') {
    errors.push(fieldError('PRIVATE_TESTER_APPROVAL_REQUIRED', 'purpose'));
  }
  if (!Array.isArray(value.capability_allowlist)
    || value.capability_allowlist.length < 1
    || value.capability_allowlist.some((capability) => !PRIVATE_RUNTIME_APPROVED_CAPABILITIES.includes(capability))
    || new Set(value.capability_allowlist).size !== value.capability_allowlist.length) {
    errors.push(fieldError('PRIVATE_TESTER_APPROVAL_REQUIRED', 'capability_allowlist'));
  }
  if (!timestamp(value.approved_at) || !timestamp(value.expires_at)) {
    errors.push(fieldError('PRIVATE_TESTER_APPROVAL_REQUIRED', 'time'));
  }
  if (value.status !== 'ACTIVE') errors.push(fieldError('PRIVATE_TESTER_APPROVAL_REQUIRED', 'status'));
  for (const field of [
    'public_launch_authorized',
    'paid_entitlement_authorized',
    'canonical_promotion_authorized',
  ]) {
    if (value[field] !== false) errors.push(fieldError('PRIVATE_TESTER_APPROVAL_REQUIRED', field));
  }
  if (environmentId != null && value.environment_id !== environmentId) {
    errors.push(fieldError('PRIVATE_RUNTIME_ENVIRONMENT_DENIED', 'environment_id'));
  }
  if (scope != null && (!exactPrivateRuntimeScope(scope) || value.exact_scope_hash !== hashPrivateRuntimeScope(scope))) {
    errors.push(fieldError('PRIVATE_TESTER_APPROVAL_REQUIRED', 'exact_scope_hash'));
  }
  if (assertion != null && value.tester_subject_ref !== externalSubscriberSubjectReference(assertion)) {
    errors.push(fieldError('PRIVATE_TESTER_APPROVAL_REQUIRED', 'tester_subject_ref'));
  }
  if (Number.isFinite(now) && timestamp(value.expires_at) && Date.parse(value.expires_at) <= now) {
    errors.push(fieldError('PRIVATE_TESTER_APPROVAL_EXPIRED', 'expires_at'));
  }
  return result(errors, value);
}

export function createPrivateRuntimeSubjectReceipt({
  receiptId,
  environmentId,
  assertion,
  subject,
  scope,
  resolutionResult,
  resolvedAt,
  policyVersion,
  correlationId,
}) {
  const assertionValidation = validatePrivateRuntimeVerifiedAssertion(assertion);
  const valid = assertionValidation.valid
    && isOpaquePrivateRuntimeReference(receiptId)
    && isOpaquePrivateRuntimeReference(environmentId)
    && isOpaquePrivateRuntimeReference(subject?.subscriber_subject_id)
    && exactPrivateRuntimeScope(scope)
    && Number.isInteger(subject?.mapping_version)
    && Number.isInteger(subject?.security_version)
    && ['RESOLVED', 'BOUND', 'IDEMPOTENT_BINDING'].includes(resolutionResult)
    && timestamp(resolvedAt)
    && isOpaquePrivateRuntimeReference(policyVersion)
    && isOpaquePrivateRuntimeReference(correlationId);
  if (!valid) return deepFreeze({ ok: false, code: 'SUBJECT_ASSERTION_INVALID' });
  return deepFreeze({
    ok: true,
    receipt: {
      subject_receipt_version: PRIVATE_RUNTIME_CONTRACT_VERSIONS.subjectReceipt,
      receipt_id: receiptId,
      environment_id: environmentId,
      assertion_ref_hash: hashCanonicalJson({
        domain: 'private_runtime_assertion_reference',
        value: assertion.assertion_reference,
      }),
      subscriber_subject_ref: subject.subscriber_subject_id,
      exact_scope_hash: hashPrivateRuntimeScope(scope),
      mapping_version: subject.mapping_version,
      security_version: subject.security_version,
      resolution_result: resolutionResult,
      duplicate_subject_detected: false,
      duplicate_scope_detected: false,
      resolved_at: resolvedAt,
      policy_version: policyVersion,
      correlation_id: correlationId,
    },
  });
}

export function governedPrivateRuntimeFailure(code) {
  const safeCode = isPrivateRuntimeFailureCode(code) ? code : 'PRIVATE_RUNTIME_DISABLED';
  return deepFreeze({
    ok: false,
    code: safeCode,
    client: {
      ok: false,
      error: safeCode === 'SESSION_ELEVATION_REQUIRED'
        ? 'authentication_required'
        : 'request_denied',
    },
  });
}
