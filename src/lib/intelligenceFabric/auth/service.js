import { hashCanonicalJson } from '../hashing.js';
import { deepFreeze } from '../validation.js';
import { evaluateCoachAuthActivation } from './activation.js';
import { createCoachSecurityEvent, opaqueHash, validateCoachActor, validateCoachSession, validatePendingAcceptanceContext } from './contracts.js';
import { transitionAcceptanceContext, transitionCoachAccount, transitionCoachSession, transitionCoachVerification } from './stateMachines.js';

const addMs = (timestamp, milliseconds) => new Date(Date.parse(timestamp) + milliseconds).toISOString();
const nowValid = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));

export function createCoachAuthService({ store, flags, clock = () => new Date().toISOString(), tokenFactory, sessionTtlMs = 3_600_000, contextTtlMs = 900_000 }) {
  if (!store || typeof tokenFactory !== 'function') throw new TypeError('store and tokenFactory are required');
  const gate = (capability) => evaluateCoachAuthActivation({ flags, capability });
  const audit = (input) => { const made = createCoachSecurityEvent(input); if (made.ok) store.appendSecurityEvent(made.event); return made.ok ? made.event.event_id : null; };
  const deny = (code, details = {}) => deepFreeze({ ok: false, code, ...details });

  function createAccount(input) {
    const active = gate('ACCOUNT_CREATE'); if (!active.allowed) return deny(active.code);
    if (!input?.auth_subject_reference || input.synthetic_actor === true) return deny(input?.synthetic_actor ? 'SYNTHETIC_ACTOR_DENIED' : 'AUTH_SUBJECT_REQUIRED');
    const existing = store.getActorBySubject(input.auth_subject_reference);
    if (existing) return existing.primary_contact_reference === input.primary_contact_reference
      ? deepFreeze({ ok: true, status: 'IDEMPOTENT_REPLAY', actor: existing }) : deny('AUTH_SUBJECT_COLLISION');
    const at = clock(), body = { coach_actor_id: opaqueHash('coach_actor', input.auth_subject_reference), auth_subject_reference: input.auth_subject_reference,
      primary_contact_reference: input.primary_contact_reference, display_name: input.display_name, verification_state: 'UNVERIFIED', account_status: 'ACTIVE',
      created_at: at, updated_at: at, last_authenticated_at: null, security_version: 1, metadata: input.metadata || {} };
    const validation = validateCoachActor(body); if (!validation.valid) return deny('INVALID_COACH_ACTOR', { errors: validation.errors });
    const saved = store.saveActor(body); if (!saved.ok) return deny(saved.code);
    const audit_reference = audit({ event_type: 'ACCOUNT_CREATED', actor_id: body.coach_actor_id, reason_code: 'ACCOUNT_CREATED', occurred_at: at, correlation_id: input.correlation_id });
    return deepFreeze({ ok: true, status: 'CREATED', actor: body, audit_reference });
  }

  function changeVerification({ coach_actor_id, action, correlation_id }) {
    const active = gate('VERIFY'); if (!active.allowed) return deny(active.code);
    const actor = store.getActor(coach_actor_id); if (!actor) return deny('ACTOR_NOT_FOUND');
    const moved = transitionCoachVerification(actor.verification_state, action); if (!moved.ok) return deny(moved.code);
    const at = clock(), updated = { ...actor, verification_state: moved.current, updated_at: at, security_version: actor.security_version + 1 };
    store.saveActor(updated);
    const type = action === 'BEGIN' || action === 'RETRY' ? 'VERIFICATION_STARTED' : 'VERIFICATION_COMPLETED';
    const audit_reference = audit({ event_type: type, actor_id: actor.coach_actor_id, reason_code: `VERIFICATION_${moved.current}`, occurred_at: at, correlation_id });
    return deepFreeze({ ok: true, actor: updated, transition: moved, audit_reference });
  }

  function changeAccountStatus({ coach_actor_id, action, correlation_id }) {
    const active = gate('ACCOUNT_CREATE'); if (!active.allowed) return deny(active.code);
    const actor = store.getActor(coach_actor_id); if (!actor) return deny('ACTOR_NOT_FOUND');
    const moved = transitionCoachAccount(actor.account_status, action); if (!moved.ok) return deny(moved.code);
    const at = clock(), updated = { ...actor, account_status: moved.current, updated_at: at, security_version: actor.security_version + 1 };
    store.saveActor(updated);
    const type = moved.current === 'SUSPENDED' ? 'ACCOUNT_SUSPENDED' : moved.current === 'REVOKED' ? 'ACCOUNT_REVOKED' : moved.current === 'LOCKED' ? 'ACCOUNT_LOCKED' : 'SIGN_IN_SUCCEEDED';
    const audit_reference = audit({ event_type: type, actor_id: actor.coach_actor_id, reason_code: `ACCOUNT_${moved.current}`, occurred_at: at, correlation_id });
    return deepFreeze({ ok: true, actor: updated, transition: moved, audit_reference });
  }

  function issueSession({ auth_subject_reference, client_context = {}, auth_strength = 'PROVIDER_ASSERTED', correlation_id }) {
    const active = gate('SESSION'); if (!active.allowed) return deny(active.code);
    const actor = store.getActorBySubject(auth_subject_reference), at = clock();
    if (!actor || actor.account_status !== 'ACTIVE') { audit({ event_type: 'SIGN_IN_FAILED', actor_id: actor?.coach_actor_id, reason_code: actor ? `ACCOUNT_${actor.account_status}` : 'ACTOR_NOT_FOUND', occurred_at: at, correlation_id }); return deny(actor ? `ACCOUNT_${actor.account_status}` : 'ACTOR_NOT_FOUND'); }
    const token = tokenFactory('SESSION'); if (typeof token !== 'string' || token.length < 16) return deny('SECURE_TOKEN_REQUIRED');
    const tokenHash = opaqueHash('session_token', token), body = { session_id: opaqueHash('coach_session', { actor: actor.coach_actor_id, tokenHash, at }), coach_actor_id: actor.coach_actor_id,
      issued_at: at, expires_at: addMs(at, sessionTtlMs), last_seen_at: at, rotation_reference: opaqueHash('rotation', tokenHash), status: 'ACTIVE',
      auth_strength, client_context_hash: hashCanonicalJson(client_context), token_hash: tokenHash, security_version: actor.security_version, revoked_at: null, revocation_reason: null };
    const validation = validateCoachSession(body); if (!validation.valid) return deny('INVALID_SESSION', { errors: validation.errors });
    store.saveSession(body); store.saveActor({ ...actor, last_authenticated_at: at, updated_at: at });
    const audit_reference = audit({ event_type: 'SESSION_ISSUED', actor_id: actor.coach_actor_id, session_id: body.session_id, reason_code: 'SIGN_IN_SUCCEEDED', occurred_at: at, correlation_id });
    return deepFreeze({ ok: true, status: 'SESSION_ISSUED', session: body, session_token: token, audit_reference });
  }

  function validateSession({ session_id, session_token, expected_actor_id = null, evaluated_at = clock(), correlation_id = null }) {
    const active = gate('SESSION'); if (!active.allowed) return deny(active.code);
    const session = store.getSession(session_id); if (!session || !nowValid(evaluated_at)) return deny(session ? 'INVALID_EVALUATION_TIME' : 'SESSION_NOT_FOUND');
    const actor = store.getActor(session.coach_actor_id); let reason = 'AUTHORIZED';
    if (!actor || actor.account_status !== 'ACTIVE') reason = actor ? `ACCOUNT_${actor.account_status}` : 'ACTOR_NOT_FOUND';
    else if (expected_actor_id && expected_actor_id !== actor.coach_actor_id) reason = 'ACTOR_SUBSTITUTION_DENIED';
    else if (session.status !== 'ACTIVE') reason = `SESSION_${session.status}`;
    else if (Date.parse(session.expires_at) <= Date.parse(evaluated_at)) reason = 'SESSION_EXPIRED';
    else if (session.security_version !== actor.security_version) reason = 'SECURITY_VERSION_STALE';
    else if (!session_token || opaqueHash('session_token', session_token) !== session.token_hash) reason = 'SESSION_TOKEN_MISMATCH';
    if (reason !== 'AUTHORIZED') return deny(reason, { decision: deepFreeze({ allowed: false, coach_actor_id: actor?.coach_actor_id || null, session_id, account_status: actor?.account_status || null, verification_state: actor?.verification_state || null, session_status: session.status, reason_code: reason, evaluated_at, audit_reference: null }) });
    return deepFreeze({ ok: true, decision: deepFreeze({ allowed: true, coach_actor_id: actor.coach_actor_id, session_id, account_status: actor.account_status, verification_state: actor.verification_state, session_status: session.status, reason_code: reason, evaluated_at, audit_reference: opaqueHash('session_decision', { session_id, evaluated_at, correlation_id }) }) });
  }

  function rotateSession(input) {
    const validation = validateSession(input); if (!validation.ok) return validation;
    const old = store.getSession(input.session_id), at = clock(), moved = transitionCoachSession(old.status, 'ROTATE');
    store.saveSession({ ...old, status: moved.current, last_seen_at: at, revoked_at: at, revocation_reason: 'ROTATED' });
    const actor = store.getActor(old.coach_actor_id), issued = issueSession({ auth_subject_reference: actor.auth_subject_reference, client_context: input.client_context || {}, auth_strength: old.auth_strength, correlation_id: input.correlation_id });
    audit({ event_type: 'SESSION_ROTATED', actor_id: actor.coach_actor_id, session_id: old.session_id, reason_code: 'SESSION_ROTATED', occurred_at: at, correlation_id: input.correlation_id });
    return issued.ok ? deepFreeze({ ...issued, rotated_session_id: old.session_id }) : issued;
  }

  function revokeSession({ session_id, reason_code = 'SIGN_OUT', correlation_id }) {
    const session = store.getSession(session_id); if (!session) return deny('SESSION_NOT_FOUND');
    const moved = transitionCoachSession(session.status, 'REVOKE'); if (!moved.ok) return deny(moved.code);
    const at = clock(), updated = { ...session, status: moved.current, revoked_at: at, revocation_reason: reason_code, last_seen_at: at }; store.saveSession(updated);
    const audit_reference = audit({ event_type: 'SESSION_REVOKED', actor_id: session.coach_actor_id, session_id, reason_code, occurred_at: at, correlation_id });
    return deepFreeze({ ok: true, session: updated, audit_reference });
  }

  function invalidateSession({ session_id, reason_code = 'SECURITY_INVALIDATION', correlation_id }) {
    const session = store.getSession(session_id); if (!session) return deny('SESSION_NOT_FOUND');
    const moved = transitionCoachSession(session.status, 'INVALIDATE'); if (!moved.ok) return deny(moved.code);
    const at = clock(), updated = { ...session, status: moved.current, revoked_at: at, revocation_reason: reason_code, last_seen_at: at }; store.saveSession(updated);
    const audit_reference = audit({ event_type: 'SESSION_INVALIDATED', actor_id: session.coach_actor_id, session_id, reason_code, occurred_at: at, correlation_id });
    return deepFreeze({ ok: true, session: updated, audit_reference });
  }

  function createAcceptanceContext({ opaque_future_invitation_reference, intended_purpose, browser_reference, correlation_id }) {
    const active = gate('ACCEPTANCE_CONTEXT'); if (!active.allowed) return deny(active.code);
    if (!opaque_future_invitation_reference || !browser_reference) return deny('OPAQUE_CONTEXT_INPUT_REQUIRED');
    const at = clock(), browserHash = opaqueHash('browser', browser_reference), body = { pending_context_id: opaqueHash('pending_context', { opaque_future_invitation_reference, browserHash, at }),
      opaque_future_invitation_reference, intended_purpose, created_at: at, expires_at: addMs(at, contextTtlMs), browser_binding_hash: browserHash,
      authenticated_actor_id: null, bound_session_id: null, status: 'PENDING_AUTH', grants_coach_connect_authority: false };
    const validation = validatePendingAcceptanceContext(body); if (!validation.valid) return deny('INVALID_ACCEPTANCE_CONTEXT', { errors: validation.errors });
    store.saveContext(body); const audit_reference = audit({ event_type: 'ACCEPTANCE_CONTEXT_CREATED', context_id: body.pending_context_id, reason_code: 'PENDING_AUTH', occurred_at: at, correlation_id });
    return deepFreeze({ ok: true, context: body, audit_reference });
  }

  function bindAcceptanceContext({ pending_context_id, session_id, session_token, browser_reference, correlation_id }) {
    const active = gate('ACCEPTANCE_CONTEXT'); if (!active.allowed) return deny(active.code);
    const context = store.getContext(pending_context_id), at = clock(); if (!context) return deny('CONTEXT_NOT_FOUND');
    if (Date.parse(context.expires_at) <= Date.parse(at)) { store.saveContext({ ...context, status: 'EXPIRED' }); return deny('CONTEXT_EXPIRED'); }
    if (opaqueHash('browser', browser_reference) !== context.browser_binding_hash) return deny('CONTEXT_BROWSER_MISMATCH');
    const sessionDecision = validateSession({ session_id, session_token, evaluated_at: at, correlation_id }); if (!sessionDecision.ok) return sessionDecision;
    if (context.authenticated_actor_id && context.authenticated_actor_id !== sessionDecision.decision.coach_actor_id) { const moved = transitionAcceptanceContext(context.status, context.status === 'AUTHENTICATED' ? 'ACCOUNT_SWITCH' : 'REVOKE'); if (moved.ok) store.saveContext({ ...context, status: moved.current }); audit({ event_type: 'ACCEPTANCE_CONTEXT_REVOKED', actor_id: sessionDecision.decision.coach_actor_id, context_id: pending_context_id, reason_code: 'ACCOUNT_SWITCH', occurred_at: at, correlation_id }); return deny('ACCOUNT_SWITCH_DENIED'); }
    const moved = transitionAcceptanceContext(context.status, context.status === 'PENDING_AUTH' ? 'AUTHENTICATE' : 'RESUME'); if (!moved.ok) return deny(moved.code);
    const updated = { ...context, status: moved.current, authenticated_actor_id: sessionDecision.decision.coach_actor_id, bound_session_id: session_id }; store.saveContext(updated);
    if (moved.current === 'RESUMED') audit({ event_type: 'ACCEPTANCE_CONTEXT_RESUMED', actor_id: updated.authenticated_actor_id, context_id: pending_context_id, reason_code: 'EXACT_ACTOR_RESUMED', occurred_at: at, correlation_id });
    return deepFreeze({ ok: true, context: updated });
  }

  function closeAcceptanceContext({ pending_context_id, session_id, session_token, browser_reference, action, correlation_id }) {
    const active = gate('ACCEPTANCE_CONTEXT'); if (!active.allowed) return deny(active.code);
    const context = store.getContext(pending_context_id), at = clock(); if (!context) return deny('CONTEXT_NOT_FOUND');
    if (Date.parse(context.expires_at) <= Date.parse(at)) { store.saveContext({ ...context, status: 'EXPIRED' }); return deny('CONTEXT_EXPIRED'); }
    if (opaqueHash('browser', browser_reference) !== context.browser_binding_hash) return deny('CONTEXT_BROWSER_MISMATCH');
    const sessionDecision = validateSession({ session_id, session_token, expected_actor_id: context.authenticated_actor_id, evaluated_at: at, correlation_id });
    if (!sessionDecision.ok || context.bound_session_id !== session_id) return sessionDecision.ok ? deny('CONTEXT_SESSION_MISMATCH') : sessionDecision;
    const normalizedAction = action === 'CONSUME' ? 'CONSUME' : action === 'REVOKE' ? 'REVOKE' : null;
    if (!normalizedAction) return deny('UNSUPPORTED_CONTEXT_ACTION');
    const moved = transitionAcceptanceContext(context.status, normalizedAction); if (!moved.ok) return deny(moved.code);
    const updated = { ...context, status: moved.current }; store.saveContext(updated);
    audit({ event_type: normalizedAction === 'CONSUME' ? 'ACCEPTANCE_CONTEXT_CONSUMED' : 'ACCEPTANCE_CONTEXT_REVOKED', actor_id: context.authenticated_actor_id, context_id: pending_context_id, reason_code: `CONTEXT_${moved.current}`, occurred_at: at, correlation_id });
    return deepFreeze({ ok: true, context: updated });
  }

  function futureCoachAuthDecision(input) {
    const validation = validateSession(input); if (!validation.ok) return deepFreeze({ ok: true, decision: validation.decision || { allowed: false, reason_code: validation.code } });
    const actor = store.getActor(validation.decision.coach_actor_id), allowed = actor.verification_state === 'VERIFIED' && actor.account_status === 'ACTIVE';
    return deepFreeze({ ok: true, decision: { ...validation.decision, allowed, reason_code: allowed ? 'AUTHENTICATED_VERIFIED_ACTIVE_COACH' : `VERIFICATION_${actor.verification_state}`,
      evaluates_relationship: false, evaluates_entitlement: false, evaluates_subscriber_consent: false, grants_coach_connect_access: false } });
  }

  return deepFreeze({ createAccount, changeVerification, changeAccountStatus, issueSession, validateSession, rotateSession, revokeSession, invalidateSession,
    createAcceptanceContext, bindAcceptanceContext, closeAcceptanceContext, futureCoachAuthDecision, inspect: () => deepFreeze({ public_routes: [], password_store: false, provider_activation: false }) });
}
