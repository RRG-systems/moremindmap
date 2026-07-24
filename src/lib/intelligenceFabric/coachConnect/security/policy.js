import { hashCanonicalJson } from '../../hashing.js';
import { deepFreeze } from '../../validation.js';
import { appendSecurityAudit } from './audit.js';
import {
  COACH_CONNECT_SECURITY_POLICY_VERSION,
  DEFAULT_COACH_CONNECT_SECURITY_FLAGS,
  SECURITY_ACTIONS,
  SECURITY_MUTATION_ACTIONS,
} from './constants.js';
import { sameSecurityScope, validateSecurityDecisionInput } from './contracts.js';
import { requireSecurityStateStore } from './ports.js';

const ROLE_ACTIONS = deepFreeze({
  ANONYMOUS: [SECURITY_ACTIONS.ISSUE_TEMPORARY_SUBSCRIBER_ENTITLEMENT],
  SUBSCRIBER: [
    SECURITY_ACTIONS.READ_OWN_PROJECTION,
    SECURITY_ACTIONS.READ_OWN_TRANSCRIPT,
    SECURITY_ACTIONS.CREATE_SESSION,
    SECURITY_ACTIONS.CONFIRM_OWN_PROPOSAL,
    SECURITY_ACTIONS.REVOKE_CONSENT,
    SECURITY_ACTIONS.CLOSE_SESSION,
    SECURITY_ACTIONS.REVOKE_OWN_CAPABILITY,
  ],
  DEVELOPER_UNLOCKED_SUBSCRIBER: [
    SECURITY_ACTIONS.READ_OWN_PROJECTION,
    SECURITY_ACTIONS.READ_OWN_TRANSCRIPT,
    SECURITY_ACTIONS.CREATE_SESSION,
    SECURITY_ACTIONS.CONFIRM_OWN_PROPOSAL,
    SECURITY_ACTIONS.REVOKE_CONSENT,
    SECURITY_ACTIONS.CLOSE_SESSION,
    SECURITY_ACTIONS.REVOKE_OWN_CAPABILITY,
  ],
  COACH: [
    SECURITY_ACTIONS.READ_COACH_PROJECTION,
    SECURITY_ACTIONS.READ_COACH_TRANSCRIPT,
    SECURITY_ACTIONS.AUTHORIZE_SESSION,
    SECURITY_ACTIONS.CONNECT_SESSION,
    SECURITY_ACTIONS.INGEST_SESSION_EVENT,
    SECURITY_ACTIONS.CAPTURE_TRANSCRIPT,
    SECURITY_ACTIONS.EXTRACT_STRUCTURED_INTELLIGENCE,
    SECURITY_ACTIONS.WRITE_COACH_REVIEW,
    SECURITY_ACTIONS.PROPOSE_ENGINE_CHANGE,
    SECURITY_ACTIONS.REQUEST_SUBSCRIBER_CONFIRMATION,
    SECURITY_ACTIONS.INTERRUPT_SESSION,
    SECURITY_ACTIONS.CLOSE_SESSION,
  ],
  SERVICE_PROCESS: [
    SECURITY_ACTIONS.INGEST_SESSION_EVENT,
    SECURITY_ACTIONS.CAPTURE_TRANSCRIPT,
    SECURITY_ACTIONS.EXTRACT_STRUCTURED_INTELLIGENCE,
    SECURITY_ACTIONS.REQUEST_SUBSCRIBER_CONFIRMATION,
    SECURITY_ACTIONS.PROMOTE_CONFIRMED_PROPOSAL,
    SECURITY_ACTIONS.REFRESH_PROJECTION,
    SECURITY_ACTIONS.CLOSE_SESSION,
    SECURITY_ACTIONS.PLAN_RETENTION,
  ],
  RECOVERY_OPERATOR: [
    SECURITY_ACTIONS.REPLAY_SESSION,
    SECURITY_ACTIONS.RECOVER_SESSION,
    SECURITY_ACTIONS.CLOSE_SESSION,
  ],
  INTERNAL_OPERATOR: [
    SECURITY_ACTIONS.READ_SECURITY_AUDIT,
    SECURITY_ACTIONS.PLAN_RETENTION,
    SECURITY_ACTIONS.EXECUTE_SYNTHETIC_LOGICAL_DELETION,
  ],
});

const RELATIONSHIP_ACTIONS = new Set([
  SECURITY_ACTIONS.READ_COACH_PROJECTION,
  SECURITY_ACTIONS.READ_COACH_TRANSCRIPT,
  SECURITY_ACTIONS.AUTHORIZE_SESSION,
  SECURITY_ACTIONS.CONNECT_SESSION,
  SECURITY_ACTIONS.INGEST_SESSION_EVENT,
  SECURITY_ACTIONS.CAPTURE_TRANSCRIPT,
  SECURITY_ACTIONS.EXTRACT_STRUCTURED_INTELLIGENCE,
  SECURITY_ACTIONS.WRITE_COACH_REVIEW,
  SECURITY_ACTIONS.PROPOSE_ENGINE_CHANGE,
  SECURITY_ACTIONS.REQUEST_SUBSCRIBER_CONFIRMATION,
]);

const ENTITLEMENT_ACTIONS = new Set([
  SECURITY_ACTIONS.READ_OWN_PROJECTION,
  SECURITY_ACTIONS.READ_COACH_PROJECTION,
  SECURITY_ACTIONS.READ_OWN_TRANSCRIPT,
  SECURITY_ACTIONS.READ_COACH_TRANSCRIPT,
  SECURITY_ACTIONS.CREATE_SESSION,
  SECURITY_ACTIONS.AUTHORIZE_SESSION,
  SECURITY_ACTIONS.CONNECT_SESSION,
  SECURITY_ACTIONS.INGEST_SESSION_EVENT,
  SECURITY_ACTIONS.CAPTURE_TRANSCRIPT,
  SECURITY_ACTIONS.EXTRACT_STRUCTURED_INTELLIGENCE,
  SECURITY_ACTIONS.WRITE_COACH_REVIEW,
  SECURITY_ACTIONS.PROPOSE_ENGINE_CHANGE,
  SECURITY_ACTIONS.REQUEST_SUBSCRIBER_CONFIRMATION,
  SECURITY_ACTIONS.CONFIRM_OWN_PROPOSAL,
  SECURITY_ACTIONS.PROMOTE_CONFIRMED_PROPOSAL,
  SECURITY_ACTIONS.REFRESH_PROJECTION,
  SECURITY_ACTIONS.REPLAY_SESSION,
  SECURITY_ACTIONS.RECOVER_SESSION,
]);

const CONSENT_PURPOSE = deepFreeze({
  [SECURITY_ACTIONS.AUTHORIZE_SESSION]: 'PARTICIPATION',
  [SECURITY_ACTIONS.CONNECT_SESSION]: 'PARTICIPATION',
  [SECURITY_ACTIONS.CAPTURE_TRANSCRIPT]: 'TRANSCRIPTION',
  [SECURITY_ACTIONS.READ_OWN_TRANSCRIPT]: 'TRANSCRIPTION',
  [SECURITY_ACTIONS.READ_COACH_TRANSCRIPT]: 'TRANSCRIPTION',
  [SECURITY_ACTIONS.EXTRACT_STRUCTURED_INTELLIGENCE]: 'STRUCTURED_EXTRACTION',
  [SECURITY_ACTIONS.WRITE_COACH_REVIEW]: 'STRUCTURED_EXTRACTION',
  [SECURITY_ACTIONS.READ_COACH_PROJECTION]: 'COACH_SHARING',
  [SECURITY_ACTIONS.PROPOSE_ENGINE_CHANGE]: 'BUSINESS_ENGINE_EVALUATION',
  [SECURITY_ACTIONS.REQUEST_SUBSCRIBER_CONFIRMATION]: 'BUSINESS_ENGINE_EVALUATION',
  [SECURITY_ACTIONS.CONFIRM_OWN_PROPOSAL]: 'BUSINESS_ENGINE_EVALUATION',
  [SECURITY_ACTIONS.PROMOTE_CONFIRMED_PROPOSAL]: 'BUSINESS_ENGINE_EVALUATION',
  [SECURITY_ACTIONS.REFRESH_PROJECTION]: 'BUSINESS_ENGINE_EVALUATION',
  [SECURITY_ACTIONS.REPLAY_SESSION]: 'PARTICIPATION',
  [SECURITY_ACTIONS.RECOVER_SESSION]: 'PARTICIPATION',
});

function consentDecision(consent_records, purpose) {
  if (!purpose) return null;
  const record = consent_records?.[purpose];
  if (!record) return 'CONSENT_MISSING';
  const state = record.state || record.status;
  if (['REVOKED', 'EXPIRED'].includes(state)) return 'CONSENT_REVOKED';
  if (!['GRANTED', 'ACTIVE'].includes(state)) return 'CONSENT_MISSING';
  return null;
}

function activeSecurityFlags(flags) {
  return flags.security_hardening_enabled === true
    && flags.synthetic_only === true
    && flags.production_traffic_enabled !== true
    && flags.emergency_disabled === false;
}

export function createCoachConnectSecurityPolicy({
  store,
  flags = DEFAULT_COACH_CONNECT_SECURITY_FLAGS,
  clock = () => new Date().toISOString(),
}) {
  requireSecurityStateStore(store);

  function decide(input) {
    const evaluated_at = input?.evaluated_at || clock();
    const normalized = { ...input, evaluated_at, policy_version: input?.policy_version || COACH_CONNECT_SECURITY_POLICY_VERSION };
    let failure = null;
    const validation = validateSecurityDecisionInput(normalized);
    if (!activeSecurityFlags(flags)) failure = 'AUTHORIZATION_DENIED';
    else if (!validation.valid) failure = validation.errors[0]?.code || 'AUTHORIZATION_DENIED';
    else if (normalized.policy_version !== COACH_CONNECT_SECURITY_POLICY_VERSION) failure = 'AUTHORIZATION_DENIED';
    else if (!sameSecurityScope(normalized.actor_scope, normalized.resource.scope)) failure = 'TENANT_SCOPE_VIOLATION';
    else if (normalized.resource.owner_session_id && normalized.resource.owner_session_id !== normalized.session.session_id) failure = 'AUTHORIZATION_DENIED';
    else if (['SUBSCRIBER', 'DEVELOPER_UNLOCKED_SUBSCRIBER'].includes(normalized.actor.role)
      && normalized.resource.owner_actor_id
      && normalized.resource.owner_actor_id !== normalized.actor.actor_id) failure = 'AUTHORIZATION_DENIED';
    else if (normalized.actor.subject_binding_hash !== normalized.session.subject_binding_hash) failure = 'SESSION_FIXATION_DETECTED';
    else if (normalized.session.status === 'REVOKED' || normalized.session.status === 'ROTATED' || normalized.session.status === 'INVALID') failure = 'SESSION_REVOKED';
    else if (normalized.session.status === 'EXPIRED' || Date.parse(normalized.session.expires_at) <= Date.parse(evaluated_at)) failure = 'SESSION_EXPIRED';
    else if (normalized.session.security_version !== normalized.actor.security_version) failure = 'SESSION_REVOKED';
    else if (!(ROLE_ACTIONS[normalized.actor.role] || []).includes(normalized.action)) failure = 'AUTHORIZATION_DENIED';
    else if (normalized.actor.role === 'DEVELOPER_UNLOCKED_SUBSCRIBER'
      && (normalized.capability?.valid !== true || normalized.capability.subject_binding_hash !== normalized.actor.subject_binding_hash)) failure = 'CAPABILITY_INVALID';
    else if (RELATIONSHIP_ACTIONS.has(normalized.action)
      && (!normalized.relationship
        || normalized.relationship.status !== 'ACTIVE'
        || !sameSecurityScope(normalized.relationship.scope, normalized.resource.scope)
        || (normalized.actor.role === 'COACH' && normalized.relationship.coach_actor_id !== normalized.actor.actor_id))) failure = 'RELATIONSHIP_INVALID';
    else if (ENTITLEMENT_ACTIONS.has(normalized.action)
      && (!normalized.entitlement
        || normalized.entitlement.status !== 'ACTIVE'
        || !sameSecurityScope(normalized.entitlement.scope, normalized.resource.scope))) failure = 'ENTITLEMENT_INVALID';
    else {
      failure = consentDecision(normalized.consent_records, CONSENT_PURPOSE[normalized.action]);
      if (!failure && SECURITY_MUTATION_ACTIONS.includes(normalized.action) && normalized.request_integrity?.allowed !== true) {
        failure = normalized.request_integrity?.code === 'ORIGIN_VALIDATION_FAILED' ? 'ORIGIN_VALIDATION_FAILED'
          : normalized.request_integrity?.code === 'CSRF_VALIDATION_FAILED' ? 'CSRF_VALIDATION_FAILED'
            : 'REQUEST_REPLAY_DETECTED';
      }
      if (!failure && normalized.expected_resource_version != null && normalized.expected_resource_version !== normalized.resource.version) failure = 'REQUEST_REPLAY_DETECTED';
      if (!failure) {
        const epoch = store.getDeletionEpoch(hashCanonicalJson(normalized.resource.scope));
        if (!epoch.ok || normalized.resource.deletion_epoch < epoch.epoch) failure = 'DELETION_REQUIRED';
      }
    }

    const decisionBody = {
      allowed: !failure,
      failure_code: failure,
      action: normalized.action || null,
      actor_role: normalized.actor?.role || null,
      evaluated_at,
      policy_version: COACH_CONNECT_SECURITY_POLICY_VERSION,
      correlation_id: normalized.correlation_id || null,
      resource_ref: normalized.resource?.resource_id || null,
    };
    const decision = deepFreeze({ ...decisionBody, decision_id: `decision_${hashCanonicalJson(decisionBody).slice(0, 32)}` });
    appendSecurityAudit(store, {
      event_type: failure === 'TENANT_SCOPE_VIOLATION' ? 'TENANT_SCOPE_VIOLATION' : failure ? 'AUTHORIZATION_DENIED' : 'AUTHORIZATION_ALLOWED',
      decision: failure ? 'DENIED' : 'ALLOWED',
      failure_code: failure,
      occurred_at: evaluated_at,
      correlation_id: normalized.correlation_id || 'missing-correlation',
      actor: normalized.actor,
      session: normalized.session,
      scope: normalized.resource?.scope || normalized.actor_scope,
      resource: normalized.resource,
      details: { action: normalized.action || null, reason_codes: failure ? [failure] : [] },
    });
    return decision;
  }

  return Object.freeze({ decide, flags, policy_version: COACH_CONNECT_SECURITY_POLICY_VERSION });
}

export async function executeAuthorizedOperation({ policy, decision_input, operation }) {
  const decision = policy.decide(decision_input);
  if (!decision.allowed) return deepFreeze({ ok: false, code: decision.failure_code, decision });
  try {
    const result = await operation();
    return deepFreeze({ ok: true, decision, result });
  } catch {
    return deepFreeze({ ok: false, code: 'AUTHORIZATION_DENIED', decision });
  }
}

export const SECURITY_ROLE_ACTIONS = ROLE_ACTIONS;
export const SECURITY_CONSENT_PURPOSES = CONSENT_PURPOSE;
