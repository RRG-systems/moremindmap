import { hashCanonicalJson } from '../../hashing.js';
import { deepFreeze } from '../../validation.js';
import {
  PRODUCTION_SECURITY_POLICY_VERSIONS,
  PRODUCTION_SECURITY_PREREQUISITE_SCHEMA,
} from './constants.js';
import {
  exactProductionSecurityScope,
  sameProductionSecurityScope,
  validateAuthenticationAssertion,
  validateCanonicalSubscriberSubject,
} from './contracts.js';

const clone = (value) => value == null ? value : structuredClone(value);
const frozen = (value) => deepFreeze(clone(value));
const subjectKey = ({ issuer, subject_id }) => `${issuer}\u0000${subject_id}`;
const scopeKey = (scope) => hashCanonicalJson({
  tenant_id: scope.tenant_id,
  profile_id: scope.profile_id,
  business_id: scope.business_id,
  subscriber_id: scope.subscriber_id,
});

export function createRatifiedSubscriberAuthorityPolicy({
  issuer,
  audience,
  organization_required = true,
} = {}) {
  const valid = typeof issuer === 'string' && issuer.length > 0
    && typeof audience === 'string' && audience.length > 0;
  return frozen(valid
    ? {
      ok: true,
      policy: {
        policy_version: PRODUCTION_SECURITY_POLICY_VERSIONS.subject_binding,
        provider: 'AUTH0',
        issuer,
        audience,
        authorization_flow: 'AUTHORIZATION_CODE_WITH_PKCE',
        organization_required,
        immutable_subject_claim: 'sub',
        provider_neutral_internal_contract: true,
        live_provider_enabled: false,
        status: 'RATIFIED_DEFAULT_OFF',
      },
    }
    : { ok: false, code: 'SUBJECT_ASSERTION_INVALID' });
}

export async function verifySubscriberAuthenticationAssertion({
  assertion_reference,
  verifier,
  authority_policy,
  expected_session_binding_reference,
}) {
  if (typeof verifier !== 'function') return frozen({ ok: false, code: 'SUBJECT_ASSERTION_REQUIRED' });
  if (!authority_policy
    || authority_policy.policy_version !== PRODUCTION_SECURITY_POLICY_VERSIONS.subject_binding
    || authority_policy.live_provider_enabled !== false) {
    return frozen({ ok: false, code: 'SUBJECT_ASSERTION_INVALID' });
  }
  let verified;
  try {
    verified = await verifier({
      assertion_reference,
      expected_issuer: authority_policy.issuer,
      expected_audience: authority_policy.audience,
      expected_session_binding_reference,
    });
  } catch {
    return frozen({ ok: false, code: 'SUBJECT_ASSERTION_INVALID' });
  }
  const assertion = {
    ...verified,
    assertion_reference,
    status: verified?.status,
  };
  const validation = validateAuthenticationAssertion(assertion);
  if (!validation.valid
    || assertion.issuer !== authority_policy.issuer
    || assertion.audience !== authority_policy.audience
    || assertion.session_binding_reference !== expected_session_binding_reference) {
    return frozen({ ok: false, code: 'SUBJECT_ASSERTION_INVALID' });
  }
  return frozen({ ok: true, assertion });
}

export class CanonicalSubscriberSubjectRegistry {
  constructor(snapshot = null) {
    this.bySubject = new Map((snapshot?.subjects || []).map(([key, value]) => [key, clone(value)]));
    this.byScope = new Map(snapshot?.scopes || []);
    this.recoveryReceipts = (snapshot?.recovery_receipts || []).map(clone);
  }

  bind({ assertion, scope, now }) {
    const assertionValidation = validateAuthenticationAssertion(assertion);
    if (!assertionValidation.valid || !exactProductionSecurityScope(scope) || !Number.isFinite(Date.parse(now))) {
      return frozen({ ok: false, code: 'SUBJECT_ASSERTION_INVALID' });
    }
    const key = subjectKey(assertion);
    const exactScopeKey = scopeKey(scope);
    const priorSubject = this.bySubject.get(key);
    const priorScopeSubject = this.byScope.get(exactScopeKey);
    if (priorSubject) {
      return sameProductionSecurityScope(priorSubject, scope)
        ? frozen({ ok: true, status: 'IDEMPOTENT_BINDING', subject: priorSubject })
        : frozen({ ok: false, code: 'SUBJECT_MAPPING_AMBIGUOUS' });
    }
    if (priorScopeSubject && priorScopeSubject !== key) {
      return frozen({ ok: false, code: 'SUBJECT_MAPPING_AMBIGUOUS' });
    }
    const body = {
      schema_version: PRODUCTION_SECURITY_PREREQUISITE_SCHEMA,
      subscriber_subject_id: `subscriber_subject_${hashCanonicalJson({ issuer: assertion.issuer, subject_id: assertion.subject_id }).slice(0, 32)}`,
      issuer: assertion.issuer,
      audience: assertion.audience,
      ...clone(scope),
      mapping_version: 1,
      security_version: assertion.security_version,
      status: 'ACTIVE',
      source_assertion_reference: assertion.assertion_reference,
      bound_at: now,
      effective_at: now,
      revoked_at: null,
      reassignment_prohibited: true,
    };
    const validation = validateCanonicalSubscriberSubject(body);
    if (!validation.valid) return frozen({ ok: false, code: validation.errors[0]?.code || 'SUBJECT_ASSERTION_INVALID' });
    this.bySubject.set(key, body);
    this.byScope.set(exactScopeKey, key);
    return frozen({ ok: true, status: 'BOUND', subject: body });
  }

  resolve({ assertion }) {
    const validation = validateAuthenticationAssertion(assertion);
    if (!validation.valid) return frozen({ ok: false, code: 'SUBJECT_ASSERTION_INVALID', subject: null });
    const subject = this.bySubject.get(subjectKey(assertion));
    if (!subject) return frozen({ ok: false, code: 'SUBJECT_MAPPING_NOT_FOUND', subject: null });
    if (subject.audience !== assertion.audience || subject.security_version !== assertion.security_version) {
      return frozen({ ok: false, code: 'SUBJECT_MAPPING_STALE', subject: null });
    }
    if (subject.status === 'DISABLED' || subject.status === 'RECOVERY_PENDING') {
      return frozen({ ok: false, code: 'SUBJECT_DISABLED', subject: null });
    }
    if (subject.status === 'DELETED') return frozen({ ok: false, code: 'SUBJECT_DELETED', subject: null });
    return frozen({ ok: true, subject });
  }

  beginRecovery({ issuer, subject_id, authority_subject_ref, reason_code, now }) {
    const key = subjectKey({ issuer, subject_id });
    const subject = this.bySubject.get(key);
    if (!subject || subject.status !== 'ACTIVE' || !authority_subject_ref || !reason_code) {
      return frozen({ ok: false, code: 'SUBJECT_MAPPING_NOT_FOUND' });
    }
    const pending = {
      ...subject,
      status: 'RECOVERY_PENDING',
      mapping_version: subject.mapping_version + 1,
      security_version: subject.security_version + 1,
    };
    const receipt = {
      recovery_id: `subject_recovery_${hashCanonicalJson({ key, now, reason_code }).slice(0, 32)}`,
      subject_ref: subject.subscriber_subject_id,
      authority_subject_ref,
      reason_code,
      prior_mapping_version: subject.mapping_version,
      new_mapping_version: pending.mapping_version,
      prior_security_version: subject.security_version,
      new_security_version: pending.security_version,
      occurred_at: now,
      status: 'RECOVERY_PENDING',
    };
    this.bySubject.set(key, pending);
    this.recoveryReceipts.push(receipt);
    return frozen({ ok: true, subject: pending, receipt });
  }

  completeRecovery({ issuer, subject_id, recovery_id, now }) {
    const key = subjectKey({ issuer, subject_id });
    const subject = this.bySubject.get(key);
    const receipt = this.recoveryReceipts.find((item) => item.recovery_id === recovery_id);
    if (!subject || subject.status !== 'RECOVERY_PENDING' || !receipt || receipt.status !== 'RECOVERY_PENDING') {
      return frozen({ ok: false, code: 'SUBJECT_MAPPING_STALE' });
    }
    const active = { ...subject, status: 'ACTIVE', effective_at: now };
    receipt.status = 'COMPLETED';
    receipt.completed_at = now;
    this.bySubject.set(key, active);
    return frozen({ ok: true, subject: active, receipt });
  }

  snapshot() {
    return frozen({
      subjects: [...this.bySubject.entries()],
      scopes: [...this.byScope.entries()],
      recovery_receipts: this.recoveryReceipts,
    });
  }
}

export function canonicalSubjectToDeveloperBindingInput({ subject, session }) {
  const subjectValidation = validateCanonicalSubscriberSubject(subject);
  if (!subjectValidation.valid
    || subject.status !== 'ACTIVE'
    || !session
    || session.subscriber_subject_id !== subject.subscriber_subject_id
    || session.subject_security_version !== subject.security_version
    || session.status !== 'ACTIVE') return null;
  return frozen({
    subject_id: subject.subscriber_subject_id,
    scope: {
      tenant_id: subject.tenant_id,
      profile_id: subject.profile_id,
      business_id: subject.business_id,
      subscriber_id: subject.subscriber_id,
    },
    browser_id: session.browser_binding_hash,
    security_version: subject.security_version,
  });
}
