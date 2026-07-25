import { hashCanonicalJson } from '../../hashing.js';
import { deepFreeze } from '../../validation.js';
import { createProductionSecurityAuditReceipt } from './audit.js';
import {
  DUAL_CONTROL_OPERATOR_ACTIONS,
  OPERATOR_ACTIONS,
  PRODUCTION_SECURITY_POLICY_VERSIONS,
} from './constants.js';
import {
  validateOperatorEntitlement,
  validateOperatorSession,
  validateOperatorSubject,
} from './contracts.js';
import { requireSharedSecurityStatePort } from './sharedSecurityStatePorts.js';

const frozen = (value) => deepFreeze(structuredClone(value));

const ROLE_ACTIONS = Object.freeze({
  SUPPORT_READONLY: ['READ_CONTROL_METADATA'],
  SECURITY_REVIEWER: ['READ_SECURITY_AUDIT', 'REVIEW_SECURITY_POLICY'],
  PRIVACY_OPERATOR: ['PLAN_DELETION', 'EXECUTE_DELETION_PLAN', 'VERIFY_DELETION_PLAN'],
  AUDIT_REVIEWER: ['READ_SECURITY_AUDIT'],
  INCIDENT_COMMANDER: ['BREAK_GLASS_CONTENT_ACCESS'],
});

export function createRatifiedOperatorAuthorityPolicy({
  issuer,
  audience,
} = {}) {
  if (!issuer || !audience) return frozen({ ok: false, code: 'OPERATOR_AUTHENTICATION_REQUIRED' });
  return frozen({
    ok: true,
    policy: {
      policy_version: PRODUCTION_SECURITY_POLICY_VERSIONS.operator_entitlement,
      provider: 'AUTH0',
      issuer,
      audience,
      invite_only: true,
      named_accounts_only: true,
      required_auth_strength: 'WEBAUTHN_MFA',
      workforce_federation_required: false,
      isolated_from_subscriber_coach_developer: true,
      subdev1_operator_authority: false,
      idle_timeout_minutes: 30,
      absolute_timeout_hours: 8,
      live_provider_enabled: false,
      status: 'RATIFIED_DEFAULT_OFF',
    },
  });
}

function denialBody({
  subject,
  session,
  entitlement,
  action,
  exact_scope_hash,
  reason_code,
  approver_refs,
  failure_code,
  occurred_at,
  audit_event_id = null,
}) {
  const body = {
    operator_subject_ref: subject?.operator_subject_id || null,
    session_ref: session?.operator_session_id || null,
    entitlement_ref: entitlement?.entitlement_id || null,
    action,
    exact_scope_hash,
    reason_code,
    approver_refs,
    allowed: false,
    failure_code,
    occurred_at,
    audit_event_id,
  };
  return {
    ...body,
    decision_id: `operator_decision_${hashCanonicalJson(body).slice(0, 32)}`,
  };
}

export function authorizeOperatorAction({
  store,
  policy,
  subject,
  session,
  entitlement,
  action,
  tenant_id,
  exact_scope_hash,
  environment_id,
  reason_code,
  approver_subjects = [],
  occurred_at,
  correlation_id,
}) {
  requireSharedSecurityStatePort(store);
  let failure = null;
  const subjectValidation = validateOperatorSubject(subject);
  const sessionValidation = validateOperatorSession(session);
  const entitlementValidation = validateOperatorEntitlement(entitlement);
  if (!policy || policy.status !== 'RATIFIED_DEFAULT_OFF' || policy.live_provider_enabled !== false) failure = 'OPERATOR_AUTHENTICATION_REQUIRED';
  else if (!subjectValidation.valid || subject.status !== 'ACTIVE') failure = 'OPERATOR_AUTHENTICATION_REQUIRED';
  else if (!sessionValidation.valid || session.status !== 'ACTIVE') failure = 'OPERATOR_AUTHENTICATION_REQUIRED';
  else if (!entitlementValidation.valid || entitlement.status !== 'ACTIVE') failure = 'OPERATOR_ENTITLEMENT_INVALID';
  else if (!OPERATOR_ACTIONS.includes(action)) failure = 'OPERATOR_ENTITLEMENT_INVALID';
  else if (subject.issuer !== policy.issuer || subject.audience !== policy.audience) failure = 'OPERATOR_AUTHENTICATION_REQUIRED';
  else if (session.operator_subject_id !== subject.operator_subject_id
    || entitlement.operator_subject_id !== subject.operator_subject_id
    || session.security_version !== subject.security_version) failure = 'OPERATOR_AUTHENTICATION_REQUIRED';
  else if (session.auth_strength !== policy.required_auth_strength) failure = 'OPERATOR_AUTHENTICATION_REQUIRED';
  else if (session.environment_id !== environment_id
    || entitlement.environment_scope !== environment_id
    || !entitlement.tenant_scope_allowlist.includes(tenant_id)) failure = 'OPERATOR_ENTITLEMENT_INVALID';
  else if (Date.parse(session.expires_at) <= Date.parse(occurred_at)
    || Date.parse(session.idle_expires_at || session.expires_at) <= Date.parse(occurred_at)
    || Date.parse(entitlement.expires_at) <= Date.parse(occurred_at)) failure = 'OPERATOR_AUTHENTICATION_REQUIRED';
  else if (!entitlement.action_allowlist.includes(action)
    || !subject.role_ids.some((role) => (ROLE_ACTIONS[role] || []).includes(action))) failure = 'OPERATOR_ENTITLEMENT_INVALID';
  else if (entitlement.requires_reason === true && (!reason_code || reason_code.length < 3)) failure = 'OPERATOR_REASON_REQUIRED';
  else if (DUAL_CONTROL_OPERATOR_ACTIONS.includes(action) || entitlement.requires_dual_control === true) {
    const distinctActive = approver_subjects.filter((approver) => approver?.status === 'ACTIVE'
      && approver.operator_subject_id
      && approver.operator_subject_id !== subject.operator_subject_id);
    if (!distinctActive.length) failure = 'OPERATOR_DUAL_CONTROL_REQUIRED';
  }

  const approverRefs = approver_subjects
    .filter((approver) => approver?.operator_subject_id)
    .map((approver) => approver.operator_subject_id);
  const provisional = failure
    ? denialBody({
      subject,
      session,
      entitlement,
      action,
      exact_scope_hash,
      reason_code,
      approver_refs: approverRefs,
      failure_code: failure,
      occurred_at,
    })
    : {
      operator_subject_ref: subject.operator_subject_id,
      session_ref: session.operator_session_id,
      entitlement_ref: entitlement.entitlement_id,
      action,
      exact_scope_hash,
      reason_code,
      approver_refs: approverRefs,
      allowed: true,
      failure_code: null,
      occurred_at,
      audit_event_id: null,
    };
  const audit = createProductionSecurityAuditReceipt({
    event_type: 'OPERATOR_AUTHORIZATION_DECISION',
    decision: failure ? 'DENIED' : 'ALLOWED',
    failure_code: failure,
    occurred_at,
    correlation_id,
    subject_ref: subject?.operator_subject_id || null,
    session_ref: session?.operator_session_id || null,
    entitlement_ref: entitlement?.entitlement_id || null,
    exact_scope_hash,
    action,
    reason_code,
    approver_refs: approverRefs,
    policy_version: PRODUCTION_SECURITY_POLICY_VERSIONS.operator_entitlement,
    details: {
      tenant_scope_verified: !failure,
      environment_scope: environment_id,
      dual_control_required: DUAL_CONTROL_OPERATOR_ACTIONS.includes(action)
        || entitlement?.requires_dual_control === true,
    },
  });
  if (!audit.ok) {
    return frozen({
      allowed: false,
      failure_code: 'OPERATOR_AUDIT_FAILED',
      decision_id: `operator_decision_${hashCanonicalJson({ correlation_id, action, failure: 'OPERATOR_AUDIT_FAILED' }).slice(0, 32)}`,
    });
  }
  const appended = store.appendAuditReceipt(audit.receipt);
  if (!appended.ok) {
    return frozen({
      allowed: false,
      failure_code: 'OPERATOR_AUDIT_FAILED',
      decision_id: `operator_decision_${hashCanonicalJson({ correlation_id, action, failure: 'OPERATOR_AUDIT_FAILED' }).slice(0, 32)}`,
    });
  }
  const body = { ...provisional, audit_event_id: audit.receipt.audit_event_id };
  return frozen({
    ...body,
    decision_id: `operator_decision_${hashCanonicalJson(body).slice(0, 32)}`,
  });
}

export const OPERATOR_ROLE_ACTIONS = ROLE_ACTIONS;
