import { hashCanonicalJson } from '../../hashing.js';
import { deepFreeze } from '../../validation.js';
import {
  createPrivateRuntimeSubjectReceipt,
  exactPrivateRuntimeScope,
  externalSubscriberSubjectReference,
  hashPrivateRuntimeScope,
  samePrivateRuntimeScope,
  validatePrivateRuntimeTesterApproval,
  validatePrivateRuntimeVerifiedAssertion,
} from './contracts.js';

export const CANONICAL_SUBJECT_REGISTRY_METHODS = deepFreeze([
  'resolveExternalSubject',
  'resolveCanonicalSubject',
  'resolveExactScope',
  'atomicBindExternalSubjectToExactScope',
  'beginSubjectRecovery',
  'completeSubjectRecovery',
  'disableSubject',
  'health',
  'describeCapability',
]);

export function validateCanonicalSubjectRegistryPort(registry) {
  const missing = CANONICAL_SUBJECT_REGISTRY_METHODS
    .filter((method) => typeof registry?.[method] !== 'function');
  let description = null;
  let health = null;
  try {
    description = missing.length ? null : registry.describeCapability();
    health = missing.length ? null : registry.health();
  } catch {
    description = null;
    health = null;
  }
  const validDescription = description?.provider_neutral === true
    && description?.atomic_one_to_one_binding === true
    && description?.auto_enrollment === false
    && description?.production_connection === false;
  return deepFreeze({
    valid: missing.length === 0 && validDescription && health?.ok === true,
    missing,
    description: validDescription ? structuredClone(description) : null,
  });
}

const statusFailure = (status) => {
  if (status === 'DELETED') return 'SUBJECT_DELETED';
  if (status === 'DISABLED' || status === 'RECOVERY_PENDING') return 'SUBJECT_DISABLED';
  return 'SUBJECT_MAPPING_STALE';
};

function validateResolvedSubject(subject, assertion, scope = null) {
  if (!subject
    || subject.issuer !== assertion.issuer
    || subject.external_subject_id !== assertion.subject_id
    || subject.audience !== assertion.audience
    || subject.security_version !== assertion.security_version
    || !Number.isInteger(subject.mapping_version)
    || !Number.isInteger(subject.security_version)
    || !exactPrivateRuntimeScope(subject.exact_scope)) {
    return { ok: false, code: 'SUBJECT_MAPPING_STALE' };
  }
  if (subject.status !== 'ACTIVE') return { ok: false, code: statusFailure(subject.status) };
  if (scope && !samePrivateRuntimeScope(subject.exact_scope, scope)) {
    return { ok: false, code: 'SUBJECT_MAPPING_AMBIGUOUS' };
  }
  return { ok: true };
}

export async function resolvePrivateRuntimeCanonicalSubject({
  registry,
  assertion,
  expectedIssuer,
  expectedAudience,
  expectedSessionBindingReference,
  scope = null,
  environmentId,
  receiptId,
  policyVersion,
  correlationId,
  now,
}) {
  const port = validateCanonicalSubjectRegistryPort(registry);
  if (!port.valid) return deepFreeze({ ok: false, code: 'SHARED_SECURITY_STATE_REQUIRED' });
  const assertionValidation = validatePrivateRuntimeVerifiedAssertion(assertion, {
    expectedIssuer,
    expectedAudience,
    expectedSessionBindingReference,
    now: Date.parse(now),
  });
  if (!assertionValidation.valid) {
    return deepFreeze({ ok: false, code: assertionValidation.errors[0]?.code || 'SUBJECT_ASSERTION_INVALID' });
  }
  const resolved = await registry.resolveExternalSubject(assertion.issuer, assertion.subject_id);
  if (!resolved?.ok || !resolved.subject) {
    return deepFreeze({ ok: false, code: resolved?.code || 'SUBJECT_MAPPING_NOT_FOUND' });
  }
  const subjectValidation = validateResolvedSubject(resolved.subject, assertion, scope);
  if (!subjectValidation.ok) return deepFreeze(subjectValidation);
  const receipt = createPrivateRuntimeSubjectReceipt({
    receiptId,
    environmentId,
    assertion,
    subject: resolved.subject,
    scope: resolved.subject.exact_scope,
    resolutionResult: 'RESOLVED',
    resolvedAt: now,
    policyVersion,
    correlationId,
  });
  return receipt.ok
    ? deepFreeze({ ok: true, status: 'RESOLVED', subject: resolved.subject, receipt: receipt.receipt })
    : receipt;
}

export async function bindApprovedPrivateRuntimeCanonicalSubject({
  registry,
  assertion,
  approval,
  scope,
  environmentId,
  receiptId,
  policyVersion,
  correlationId,
  now,
}) {
  const port = validateCanonicalSubjectRegistryPort(registry);
  if (!port.valid) return deepFreeze({ ok: false, code: 'SHARED_SECURITY_STATE_REQUIRED' });
  const assertionValidation = validatePrivateRuntimeVerifiedAssertion(assertion, { now: Date.parse(now) });
  if (!assertionValidation.valid || !exactPrivateRuntimeScope(scope)) {
    return deepFreeze({ ok: false, code: assertionValidation.errors?.[0]?.code || 'SUBJECT_ASSERTION_INVALID' });
  }
  const approvalValidation = validatePrivateRuntimeTesterApproval(approval, {
    assertion,
    scope,
    environmentId,
    now: Date.parse(now),
  });
  if (!approvalValidation.valid) {
    return deepFreeze({ ok: false, code: approvalValidation.errors[0]?.code || 'PRIVATE_TESTER_APPROVAL_REQUIRED' });
  }
  const subjectRef = externalSubscriberSubjectReference(assertion);
  const result = await registry.atomicBindExternalSubjectToExactScope(assertion, scope, approval);
  if (!result?.ok || !result.subject) {
    return deepFreeze({ ok: false, code: result?.code || 'SUBJECT_MAPPING_AMBIGUOUS' });
  }
  const subjectValidation = validateResolvedSubject(result.subject, assertion, scope);
  if (!subjectValidation.ok) return deepFreeze(subjectValidation);
  if (result.subject.subscriber_subject_id === assertion.subject_id
    || result.subject.subscriber_subject_id === approval.approval_id
    || result.subject.subscriber_subject_id === subjectRef
    || result.subject.exact_scope_hash !== hashPrivateRuntimeScope(scope)) {
    return deepFreeze({ ok: false, code: 'SUBJECT_MAPPING_STALE' });
  }
  const status = result.status === 'IDEMPOTENT_BINDING' ? result.status : 'BOUND';
  const receipt = createPrivateRuntimeSubjectReceipt({
    receiptId,
    environmentId,
    assertion,
    subject: result.subject,
    scope,
    resolutionResult: status,
    resolvedAt: now,
    policyVersion,
    correlationId,
  });
  return receipt.ok
    ? deepFreeze({
      ok: true,
      status,
      subject: result.subject,
      receipt: receipt.receipt,
      binding_fingerprint: hashCanonicalJson({
        external_subject_ref: subjectRef,
        exact_scope_hash: hashPrivateRuntimeScope(scope),
        mapping_version: result.subject.mapping_version,
      }),
    })
    : receipt;
}
