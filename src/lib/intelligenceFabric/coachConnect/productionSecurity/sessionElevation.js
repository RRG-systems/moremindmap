import { hashCanonicalJson } from '../../hashing.js';
import { deepFreeze } from '../../validation.js';
import { createProductionSecurityAuditReceipt } from './audit.js';
import {
  PRODUCTION_SECURITY_POLICY_VERSIONS,
  PRODUCTION_SECURITY_PREREQUISITE_SCHEMA,
} from './constants.js';
import {
  validateAuthenticationAssertion,
  validateCanonicalSubscriberSubject,
  validatePreAuthSession,
} from './contracts.js';
import { requireSharedSecurityStatePort } from './sharedSecurityStatePorts.js';

const frozen = (value) => deepFreeze(structuredClone(value));

export function createPreAuthSession({
  pre_auth_session_id,
  browser_binding_hash,
  issued_at,
  expires_at,
  csrf_generation = 1,
}) {
  const session = {
    schema_version: PRODUCTION_SECURITY_PREREQUISITE_SCHEMA,
    pre_auth_session_id,
    browser_binding_hash,
    csrf_generation,
    issued_at,
    expires_at,
    status: 'ACTIVE',
    grants_authenticated_authority: false,
  };
  const validation = validatePreAuthSession(session);
  return validation.valid
    ? frozen({ ok: true, session })
    : frozen({ ok: false, code: validation.errors[0]?.code || 'SESSION_ELEVATION_REQUIRED' });
}

export function registerPreAuthSession({ store, session }) {
  requireSharedSecurityStatePort(store);
  const validation = validatePreAuthSession(session);
  if (!validation.valid || session.status !== 'ACTIVE') return frozen({ ok: false, code: 'SESSION_ELEVATION_REQUIRED' });
  return store.atomicCreateSession({ session });
}

export function elevateSubscriberSession({
  store,
  pre_auth_session_id,
  assertion,
  subject,
  expected_csrf_generation,
  authenticated_session_id,
  authenticated_session_token,
  expires_at,
  occurred_at,
  correlation_id,
  invalidated_capability_hashes = [],
}) {
  requireSharedSecurityStatePort(store);
  const assertionValidation = validateAuthenticationAssertion(assertion);
  const subjectValidation = validateCanonicalSubscriberSubject(subject);
  if (!assertionValidation.valid || !subjectValidation.valid || subject.status !== 'ACTIVE') {
    return frozen({ ok: false, code: 'SUBJECT_ASSERTION_INVALID' });
  }
  if (subject.issuer !== assertion.issuer
    || subject.audience !== assertion.audience
    || subject.subscriber_subject_id === pre_auth_session_id
    || assertion.subject_id === pre_auth_session_id
    || assertion.security_version !== subject.security_version
    || typeof authenticated_session_token !== 'string'
    || authenticated_session_token.length < 32
    || authenticated_session_token === pre_auth_session_id
    || authenticated_session_id === pre_auth_session_id) {
    return frozen({ ok: false, code: 'SESSION_ROTATION_FAILED' });
  }
  const prior = store.getSession(pre_auth_session_id);
  if (!prior.ok || prior.status !== 'FOUND' || prior.session.status !== 'ACTIVE') {
    return frozen({ ok: false, code: 'PRE_AUTH_SESSION_REPLAYED' });
  }
  if (prior.session.browser_binding_hash !== assertion.session_binding_reference) {
    return frozen({ ok: false, code: 'SESSION_ROTATION_FAILED' });
  }
  const replayKey = `session-elevation:${pre_auth_session_id}`;
  const fingerprint = hashCanonicalJson({
    subscriber_subject_id: subject.subscriber_subject_id,
    expected_csrf_generation,
    assertion_reference: assertion.assertion_reference,
  });
  const replay = store.claimReplay({ key: replayKey, fingerprint, ttl_ms: 900_000 });
  if (!replay.ok) return frozen({ ok: false, code: replay.code });
  if (replay.status === 'IDEMPOTENT_REPLAY') {
    const recovered = store.getSession(replay.result_reference);
    return recovered.ok && recovered.status === 'FOUND'
      ? frozen({ ok: true, status: 'IDEMPOTENT_REPLAY', authenticated_session: recovered.session })
      : frozen({ ok: false, code: 'SESSION_ROTATION_FAILED' });
  }
  if (replay.status !== 'CLAIMED') return frozen({ ok: false, code: 'PRE_AUTH_SESSION_REPLAYED' });

  const authenticatedSession = {
    schema_version: PRODUCTION_SECURITY_PREREQUISITE_SCHEMA,
    authenticated_session_id,
    subscriber_subject_id: subject.subscriber_subject_id,
    subject_security_version: subject.security_version,
    browser_binding_hash: prior.session.browser_binding_hash,
    issuer: subject.issuer,
    audience: subject.audience,
    auth_strength: assertion.auth_strength,
    issued_at: occurred_at,
    expires_at,
    last_seen_at: occurred_at,
    status: 'ACTIVE',
    rotation_parent_reference: pre_auth_session_id,
    csrf_generation: expected_csrf_generation + 1,
    session_epoch: 1,
    token_hash: hashCanonicalJson({
      domain: 'authenticated_session_token',
      value: authenticated_session_token,
    }),
  };
  const elevationBody = {
    pre_auth_session_ref: pre_auth_session_id,
    authenticated_session_ref: authenticated_session_id,
    subscriber_subject_ref: subject.subscriber_subject_id,
    invalidated_csrf_generation: expected_csrf_generation,
    invalidated_capability_refs: [...invalidated_capability_hashes],
    prior_session_status: 'ROTATED',
    new_session_status: 'ACTIVE',
    occurred_at,
    policy_version: PRODUCTION_SECURITY_POLICY_VERSIONS.session_elevation,
    correlation_id,
  };
  const audit = createProductionSecurityAuditReceipt({
    event_type: 'SUBSCRIBER_SESSION_ELEVATED',
    decision: 'ALLOWED',
    occurred_at,
    correlation_id,
    subject_ref: subject.subscriber_subject_id,
    session_ref: authenticated_session_id,
    action: 'ELEVATE_SUBSCRIBER_SESSION',
    policy_version: PRODUCTION_SECURITY_POLICY_VERSIONS.session_elevation,
    details: {
      pre_auth_invalidated: true,
      csrf_generation_rotated: true,
      capability_count: invalidated_capability_hashes.length,
    },
  });
  if (!audit.ok) return frozen({ ok: false, code: 'SESSION_ROTATION_FAILED' });
  const receipt = {
    ...elevationBody,
    elevation_id: `session_elevation_${hashCanonicalJson(elevationBody).slice(0, 32)}`,
    audit_event_id: audit.receipt.audit_event_id,
  };
  const rotated = store.rotateSession({
    pre_auth_session_id,
    authenticated_session: authenticatedSession,
    invalidated_capability_hashes,
    expected_csrf_generation,
    elevation_receipt: receipt,
    audit_receipt: audit.receipt,
  });
  if (!rotated.ok) return frozen({ ok: false, code: rotated.code || 'SESSION_ROTATION_FAILED' });
  const completed = store.completeReplay({
    key: replayKey,
    fingerprint,
    result_reference: authenticated_session_id,
  });
  if (!completed.ok) return frozen({ ok: false, code: 'SESSION_ROTATION_FAILED' });
  return frozen({
    ok: true,
    status: 'AUTHENTICATED_ACTIVE',
    authenticated_session: authenticatedSession,
    elevation_receipt: receipt,
    cookie: {
      name: '__Host-more_session',
      http_only: true,
      secure: true,
      same_site: 'Lax',
      path: '/',
      raw_token_stored_server_side: false,
    },
  });
}

export function revokeAuthenticatedSubscriberSession({
  store,
  authenticated_session_id,
  reason_code,
}) {
  requireSharedSecurityStatePort(store);
  return store.revokeSession({
    session_id: authenticated_session_id,
    reason_code,
    expected_status: 'ACTIVE',
  });
}
