import { hashCanonicalJson } from '../../hashing.js';
import { deepFreeze } from '../../validation.js';
import {
  evaluateDeploymentSharedStateCapability,
  validateAuthenticatedSubscriberSession,
  validateSharedSecurityStatePort,
} from '../productionSecurity/index.js';
import { evaluatePrivateRuntimeActivation } from './activation.js';
import {
  PRIVATE_RUNTIME_CONTRACT_VERSIONS,
  exactPrivateRuntimeScope,
  hashPrivateRuntimeScope,
  samePrivateRuntimeScope,
  validatePrivateRuntimeTesterApproval,
} from './contracts.js';

const object = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const timestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const opaque = (value) => typeof value === 'string'
  && value.length > 0
  && value.length <= 256
  && !value.includes('@')
  && !/\s/.test(value);
const frozen = (value) => deepFreeze(structuredClone(value));

export function evaluatePrivateRuntimeSharedState({
  store,
  environmentId,
  evidenceClass = 'FUTURE_PRIVATE_LIVE',
}) {
  const port = validateSharedSecurityStatePort(store);
  if (!port.valid) return frozen({ allowed: false, code: 'SHARED_SECURITY_STATE_REQUIRED' });
  const description = port.description;
  if (!description.available) return frozen({ allowed: false, code: 'SHARED_SECURITY_STATE_UNAVAILABLE' });
  const health = store.health();
  if (!health?.ok || health.state === 'PARTITIONED') {
    return frozen({
      allowed: false,
      code: health?.state === 'PARTITIONED'
        ? 'SHARED_SECURITY_STATE_PARTITIONED'
        : 'SHARED_SECURITY_STATE_UNAVAILABLE',
    });
  }
  if (health.state !== 'HEALTHY' && health.state !== 'AVAILABLE') {
    return frozen({ allowed: false, code: 'SHARED_SECURITY_STATE_UNAVAILABLE' });
  }
  const deployment = evaluateDeploymentSharedStateCapability(description);
  if (!deployment.approved
    || description.environment_id !== environmentId
    || description.no_local_fallback !== true) {
    return frozen({
      allowed: false,
      code: 'SHARED_SECURITY_STATE_REQUIRED',
      failures: deployment.failures,
    });
  }
  if (evidenceClass === 'FUTURE_PRIVATE_LIVE'
    && (description.live_connection_verified !== true
      || description.production_connection !== true)) {
    return frozen({ allowed: false, code: 'SHARED_SECURITY_STATE_REQUIRED' });
  }
  if (!['DEPLOYMENT_SHAPED_OFFLINE', 'FUTURE_PRIVATE_LIVE'].includes(evidenceClass)) {
    return frozen({ allowed: false, code: 'SHARED_SECURITY_STATE_REQUIRED' });
  }
  return frozen({
    allowed: true,
    code: null,
    evidence_class: evidenceClass,
    description,
  });
}

export function validatePrivateRuntimeCapabilityEnvelope(value, {
  subject = null,
  session = null,
  scope = null,
  environmentId = null,
  browserBindingHash = null,
  currentEpoch = null,
  now = null,
} = {}) {
  const errors = [];
  if (!object(value)) return frozen({ valid: false, errors: [{ code: 'CAPABILITY_INVALID', field: '$' }] });
  const expectedFields = [
    'envelope_version',
    'capability_id',
    'environment_id',
    'subscriber_subject_ref',
    'authenticated_session_ref',
    'subject_security_version',
    'session_epoch',
    'browser_binding_hash',
    'exact_scope_hash',
    'entitlement_source',
    'allowed_runtime_actions',
    'issued_at',
    'expires_at',
    'status',
    'stripe_authority',
    'billing_authority',
    'operator_authority',
    'deployment_authority',
    'coach_authority',
    'canonical_mutation_authority',
  ];
  if (Object.keys(value).length !== expectedFields.length
    || Object.keys(value).some((field) => !expectedFields.includes(field))) {
    errors.push({ code: 'CAPABILITY_INVALID', field: 'fields' });
  }
  if (value.envelope_version !== PRIVATE_RUNTIME_CONTRACT_VERSIONS.capability) {
    errors.push({ code: 'CAPABILITY_INVALID', field: 'envelope_version' });
  }
  for (const field of [
    'capability_id',
    'environment_id',
    'subscriber_subject_ref',
    'authenticated_session_ref',
    'browser_binding_hash',
  ]) {
    if (!opaque(value[field])) errors.push({ code: 'CAPABILITY_INVALID', field });
  }
  if (!/^[a-f0-9]{64}$/.test(value.exact_scope_hash || '')) {
    errors.push({ code: 'CAPABILITY_INVALID', field: 'exact_scope_hash' });
  }
  if (!Number.isInteger(value.subject_security_version) || value.subject_security_version < 1
    || !Number.isInteger(value.session_epoch) || value.session_epoch < 1) {
    errors.push({ code: 'CAPABILITY_INVALID', field: 'versions' });
  }
  if (!timestamp(value.issued_at) || !timestamp(value.expires_at)) errors.push({ code: 'CAPABILITY_INVALID', field: 'time' });
  if (value.entitlement_source !== 'temporary_internal_subscription_entitlement') {
    errors.push({ code: 'CAPABILITY_INVALID', field: 'entitlement_source' });
  }
  if (!Array.isArray(value.allowed_runtime_actions)
    || value.allowed_runtime_actions.length < 1
    || value.allowed_runtime_actions.some((item) => !opaque(item))) {
    errors.push({ code: 'CAPABILITY_INVALID', field: 'allowed_runtime_actions' });
  }
  if (value.status !== 'ACTIVE') errors.push({ code: value.status === 'REVOKED' ? 'CAPABILITY_REVOKED' : 'CAPABILITY_INVALID', field: 'status' });
  for (const field of [
    'stripe_authority',
    'billing_authority',
    'operator_authority',
    'deployment_authority',
    'coach_authority',
    'canonical_mutation_authority',
  ]) {
    if (value[field] !== false) errors.push({ code: 'CAPABILITY_INVALID', field });
  }
  if (subject && (value.subscriber_subject_ref !== subject.subscriber_subject_id
    || value.subject_security_version !== subject.security_version)) {
    errors.push({ code: 'CAPABILITY_INVALID', field: 'subject_binding' });
  }
  if (session && (value.authenticated_session_ref !== session.authenticated_session_id
    || value.session_epoch !== session.session_epoch)) {
    errors.push({ code: 'CAPABILITY_INVALID', field: 'session_binding' });
  }
  if (scope && (!exactPrivateRuntimeScope(scope) || value.exact_scope_hash !== hashPrivateRuntimeScope(scope))) {
    errors.push({ code: 'CAPABILITY_INVALID', field: 'scope_binding' });
  }
  if (environmentId != null && value.environment_id !== environmentId) {
    errors.push({ code: 'CAPABILITY_INVALID', field: 'environment_id' });
  }
  if (browserBindingHash != null && value.browser_binding_hash !== browserBindingHash) {
    errors.push({ code: 'CAPABILITY_INVALID', field: 'browser_binding_hash' });
  }
  if (currentEpoch != null && value.session_epoch !== currentEpoch) {
    errors.push({ code: 'CAPABILITY_REVOKED', field: 'session_epoch' });
  }
  if (Number.isFinite(now) && timestamp(value.expires_at) && Date.parse(value.expires_at) <= now) {
    errors.push({ code: 'CAPABILITY_EXPIRED', field: 'expires_at' });
  }
  return frozen({ valid: errors.length === 0, errors, value: errors.length ? null : value });
}

export function createPrivateRuntimeCapabilityEnvelope({
  capabilityId,
  environmentId,
  subject,
  session,
  scope,
  browserBindingHash,
  allowedRuntimeActions,
  issuedAt,
  expiresAt,
}) {
  const value = {
    envelope_version: PRIVATE_RUNTIME_CONTRACT_VERSIONS.capability,
    capability_id: capabilityId,
    environment_id: environmentId,
    subscriber_subject_ref: subject?.subscriber_subject_id,
    authenticated_session_ref: session?.authenticated_session_id,
    subject_security_version: subject?.security_version,
    session_epoch: session?.session_epoch,
    browser_binding_hash: browserBindingHash,
    exact_scope_hash: exactPrivateRuntimeScope(scope) ? hashPrivateRuntimeScope(scope) : null,
    entitlement_source: 'temporary_internal_subscription_entitlement',
    allowed_runtime_actions: [...(allowedRuntimeActions || [])],
    issued_at: issuedAt,
    expires_at: expiresAt,
    status: 'ACTIVE',
    stripe_authority: false,
    billing_authority: false,
    operator_authority: false,
    deployment_authority: false,
    coach_authority: false,
    canonical_mutation_authority: false,
  };
  const validation = validatePrivateRuntimeCapabilityEnvelope(value, {
    subject,
    session,
    scope,
    environmentId,
    browserBindingHash,
  });
  return validation.valid
    ? frozen({ ok: true, envelope: value })
    : frozen({ ok: false, code: validation.errors[0]?.code || 'CAPABILITY_INVALID' });
}

export function evaluatePrivateRuntimeAuthority({
  flags,
  environmentId,
  subject,
  session,
  scope,
  approval,
  capability,
  sharedState,
  requestedRuntime,
  requestedAction,
  browserBindingHash,
  currentEpoch,
  now,
}) {
  if (!subject || subject.status !== 'ACTIVE' || !exactPrivateRuntimeScope(subject.exact_scope)
    || !samePrivateRuntimeScope(subject.exact_scope, scope)) {
    return frozen({ allowed: false, code: 'SUBJECT_MAPPING_STALE' });
  }
  const activation = evaluatePrivateRuntimeActivation({
    flags,
    environmentId,
    subscriberSubjectRef: subject.subscriber_subject_id,
    exactScopeHash: hashPrivateRuntimeScope(scope),
    requestedRuntime,
  });
  if (!activation.allowed) return activation;
  const approvalValidation = validatePrivateRuntimeTesterApproval(approval, {
    scope,
    environmentId,
    now,
  });
  if (!approvalValidation.valid) {
    return frozen({ allowed: false, code: approvalValidation.errors[0]?.code || 'PRIVATE_TESTER_APPROVAL_REQUIRED' });
  }
  const sessionValidation = validateAuthenticatedSubscriberSession(session);
  if (!sessionValidation.valid
    || session.status !== 'ACTIVE'
    || session.subscriber_subject_id !== subject.subscriber_subject_id
    || session.subject_security_version !== subject.security_version
    || session.browser_binding_hash !== browserBindingHash) {
    return frozen({ allowed: false, code: 'SESSION_ELEVATION_REQUIRED' });
  }
  if (Date.parse(session.expires_at) <= now) return frozen({ allowed: false, code: 'SESSION_EXPIRED' });
  if (!sharedState?.allowed) return frozen({ allowed: false, code: sharedState?.code || 'SHARED_SECURITY_STATE_REQUIRED' });
  const capabilityValidation = validatePrivateRuntimeCapabilityEnvelope(capability, {
    subject,
    session,
    scope,
    environmentId,
    browserBindingHash,
    currentEpoch,
    now,
  });
  if (!capabilityValidation.valid) {
    return frozen({ allowed: false, code: capabilityValidation.errors[0]?.code || 'CAPABILITY_INVALID' });
  }
  if (!capability.allowed_runtime_actions.includes(requestedAction)) {
    return frozen({ allowed: false, code: 'ACTION_NOT_ALLOWLISTED' });
  }
  return frozen({
    allowed: true,
    code: null,
    authority_fingerprint: hashCanonicalJson({
      environment_id: environmentId,
      subject_ref: subject.subscriber_subject_id,
      session_ref: session.authenticated_session_id,
      scope_hash: hashPrivateRuntimeScope(scope),
      capability_ref: capability.capability_id,
      action: requestedAction,
      session_epoch: currentEpoch,
    }),
    shared_state_evidence_class: sharedState.evidence_class,
    deployment_grade_security_state: sharedState.description?.deployment_grade === true,
    no_local_fallback: sharedState.description?.no_local_fallback === true,
  });
}
