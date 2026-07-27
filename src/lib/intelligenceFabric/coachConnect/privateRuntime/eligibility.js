import { deepFreeze } from '../../validation.js';

export const PRIVATE_TEST_APPROVAL_VERSION = 'private-test-approval-v1';
export const PRIVATE_TEST_ELIGIBILITY_VERSION = 'private-test-bootstrap-eligibility-v1';
export const AUTHENTICATED_PRIVATE_CONTEXT_VERSION = 'authenticated-private-context-v2';

export const DEFAULT_PRIVATE_TEST_ELIGIBILITY_CONFIGURATION = deepFreeze({
  enabled: false,
  emergency_disabled: true,
  environment_allowlist: [],
  subject_allowlist: [],
  scope_allowlist: [],
});

export const ZERO_PRIVATE_RUNTIME_AUTHORITIES = deepFreeze({
  runtime_access: false,
  admin_authority: false,
  operator_authority: false,
  deployment_authority: false,
  billing_authority: false,
  coach_authority: false,
  canonical_mutation_authority: false,
});

const frozen = (value) => deepFreeze(structuredClone(value));
const text = (value, max = 256) => typeof value === 'string'
  && value.trim().length > 0
  && value.length <= max;
const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const timestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));

export function normalizePrivateTestEligibilityConfiguration(value = {}) {
  const normalized = {
    ...DEFAULT_PRIVATE_TEST_ELIGIBILITY_CONFIGURATION,
    ...(value || {}),
    environment_allowlist: Array.isArray(value?.environment_allowlist)
      ? [...new Set(value.environment_allowlist)]
      : [],
    subject_allowlist: Array.isArray(value?.subject_allowlist)
      ? [...new Set(value.subject_allowlist)]
      : [],
    scope_allowlist: Array.isArray(value?.scope_allowlist)
      ? [...new Set(value.scope_allowlist)]
      : [],
  };
  return frozen(normalized);
}

export function evaluatePrivateTestEligibilityActivation({
  configuration,
  environmentId,
  subscriberSubjectRef,
  exactScopeHash,
}) {
  const flags = normalizePrivateTestEligibilityConfiguration(configuration);
  let code = null;
  if (flags.emergency_disabled !== false) code = 'EMERGENCY_DISABLED';
  else if (flags.enabled !== true) code = 'PRIVATE_TEST_BOOTSTRAP_INELIGIBLE';
  else if (!text(environmentId)
    || !text(subscriberSubjectRef)
    || !sha256(exactScopeHash)
    || !flags.environment_allowlist.includes(environmentId)
    || !flags.subject_allowlist.includes(subscriberSubjectRef)
    || !flags.scope_allowlist.includes(exactScopeHash)) {
    code = 'PRIVATE_TEST_BOOTSTRAP_INELIGIBLE';
  }
  return frozen({
    allowed: code === null,
    code,
    environment_id: environmentId || null,
    subscriber_subject_ref: subscriberSubjectRef || null,
    exact_scope_hash: exactScopeHash || null,
    emergency_disabled: flags.emergency_disabled !== false,
  });
}

export function validatePrivateTestApprovalV1(value, {
  environmentId,
  subscriberSubjectRef,
  exactScopeHash,
  securityEpoch,
  now,
} = {}) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return frozen({ valid: false, errors: [{ code: 'PRIVATE_TEST_APPROVAL_REQUIRED', field: '$' }] });
  }
  if (value.record_version !== PRIVATE_TEST_APPROVAL_VERSION) errors.push({ code: 'PRIVATE_TEST_APPROVAL_REQUIRED', field: 'record_version' });
  if (!text(value.approval_ref)
    || !text(value.environment_id)
    || !text(value.subscriber_subject_ref)
    || !sha256(value.exact_scope_hash)) {
    errors.push({ code: 'PRIVATE_TEST_APPROVAL_REQUIRED', field: 'identity' });
  }
  if (value.environment_id !== environmentId) errors.push({ code: 'PRIVATE_TEST_APPROVAL_REQUIRED', field: 'environment_id' });
  if (value.subscriber_subject_ref !== subscriberSubjectRef) errors.push({ code: 'PRIVATE_TEST_APPROVAL_REQUIRED', field: 'subscriber_subject_ref' });
  if (value.exact_scope_hash !== exactScopeHash) errors.push({ code: 'PRIVATE_TEST_APPROVAL_REQUIRED', field: 'exact_scope_hash' });
  if (value.purpose !== 'TEMPORARY_PRIVATE_SUBSCRIPTION_TEST') errors.push({ code: 'PRIVATE_TEST_APPROVAL_REQUIRED', field: 'purpose' });
  if (value.status === 'REVOKED') errors.push({ code: 'PRIVATE_TEST_APPROVAL_REVOKED', field: 'status' });
  else if (value.status !== 'ACTIVE') errors.push({ code: 'PRIVATE_TEST_APPROVAL_REQUIRED', field: 'status' });
  if (!timestamp(value.issued_at) || !timestamp(value.expires_at)) errors.push({ code: 'PRIVATE_TEST_APPROVAL_REQUIRED', field: 'time' });
  if (Number.isFinite(now) && timestamp(value.expires_at) && Date.parse(value.expires_at) <= now) {
    errors.push({ code: 'PRIVATE_TEST_APPROVAL_EXPIRED', field: 'expires_at' });
  }
  if (!Number.isInteger(value.security_epoch) || value.security_epoch !== securityEpoch) {
    errors.push({ code: 'SUBJECT_MAPPING_STALE', field: 'security_epoch' });
  }
  return frozen({
    valid: errors.length === 0,
    errors,
    value: errors.length ? null : value,
  });
}

export function createPrivateTestEligibilityDecision({
  environmentId,
  authenticatedContext,
  approval,
  securityEpoch,
  evaluatedAt,
}) {
  if (!text(environmentId)
    || authenticatedContext?.context_version !== AUTHENTICATED_PRIVATE_CONTEXT_VERSION
    || !text(authenticatedContext.subscriber_subject_ref)
    || !text(authenticatedContext.authenticated_session_ref)
    || !sha256(authenticatedContext.exact_scope_hash)
    || approval?.record_version !== PRIVATE_TEST_APPROVAL_VERSION
    || approval.approval_ref == null
    || approval.security_epoch !== securityEpoch
    || !timestamp(evaluatedAt)
    || !timestamp(approval.expires_at)) {
    return frozen({
      ok: false,
      allowed: false,
      decision_version: PRIVATE_TEST_ELIGIBILITY_VERSION,
      code: 'PRIVATE_TEST_BOOTSTRAP_INELIGIBLE',
      ...ZERO_PRIVATE_RUNTIME_AUTHORITIES,
    });
  }
  return frozen({
    ok: true,
    allowed: true,
    decision_version: PRIVATE_TEST_ELIGIBILITY_VERSION,
    code: null,
    environment_id: environmentId,
    subscriber_subject_ref: authenticatedContext.subscriber_subject_ref,
    authenticated_session_ref: authenticatedContext.authenticated_session_ref,
    exact_scope_hash: authenticatedContext.exact_scope_hash,
    approval_ref: approval.approval_ref,
    security_epoch: securityEpoch,
    evaluated_at: evaluatedAt,
    expires_at: approval.expires_at,
    may_attempt_subdev1: true,
    ...ZERO_PRIVATE_RUNTIME_AUTHORITIES,
  });
}
