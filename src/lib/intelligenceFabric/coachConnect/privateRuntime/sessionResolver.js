import { hashCanonicalJson } from '../../hashing.js';
import { deepFreeze } from '../../validation.js';
import {
  revokeAuthenticatedSubscriberSession,
  validateAuthenticatedSubscriberSession,
} from '../productionSecurity/index.js';
import { PRIVATE_RUNTIME_CONTRACT_VERSIONS } from './contracts.js';
import { validatePrivateRuntimeCapabilityEnvelope } from './authority.js';

const frozen = (value) => deepFreeze(structuredClone(value));

export function createPrivateRuntimeSessionReceipt({
  receiptId,
  environmentId,
  session,
}) {
  const validation = validateAuthenticatedSubscriberSession(session);
  if (!validation.valid
    || session.status !== 'ACTIVE'
    || typeof receiptId !== 'string'
    || typeof environmentId !== 'string') {
    return frozen({ ok: false, code: 'SESSION_ELEVATION_REQUIRED' });
  }
  return frozen({
    ok: true,
    receipt: {
      session_receipt_version: PRIVATE_RUNTIME_CONTRACT_VERSIONS.sessionReceipt,
      receipt_id: receiptId,
      environment_id: environmentId,
      subscriber_subject_ref: session.subscriber_subject_id,
      authenticated_session_ref: session.authenticated_session_id,
      rotation_parent_ref: session.rotation_parent_reference,
      subject_security_version: session.subject_security_version,
      session_epoch: session.session_epoch,
      csrf_generation: session.csrf_generation,
      auth_strength: session.auth_strength,
      issued_at: session.issued_at,
      expires_at: session.expires_at,
      status: 'ACTIVE',
      raw_session_material_present: false,
    },
  });
}

export function resolveAuthoritativePrivateRuntimeSession({
  store,
  authenticatedSessionId,
  subject,
  browserBindingHash,
  environmentScopeHash,
  now,
}) {
  const found = store?.getSession?.(authenticatedSessionId);
  if (!found?.ok) return frozen({ ok: false, code: found?.code || 'SHARED_SECURITY_STATE_UNAVAILABLE' });
  if (found.status !== 'FOUND') return frozen({ ok: false, code: 'SESSION_ELEVATION_REQUIRED' });
  const session = found.session;
  const validation = validateAuthenticatedSubscriberSession(session);
  if (!validation.valid
    || session.status !== 'ACTIVE'
    || session.subscriber_subject_id !== subject?.subscriber_subject_id
    || session.subject_security_version !== subject?.security_version
    || session.browser_binding_hash !== browserBindingHash) {
    return frozen({
      ok: false,
      code: session?.status === 'REVOKED' ? 'SESSION_REVOKED' : 'SESSION_ELEVATION_REQUIRED',
    });
  }
  if (Date.parse(session.expires_at) <= now) return frozen({ ok: false, code: 'SESSION_EXPIRED' });
  const epoch = store.getSecurityEpoch(environmentScopeHash);
  if (!epoch?.ok) return frozen({ ok: false, code: epoch?.code || 'SHARED_SECURITY_STATE_UNAVAILABLE' });
  if (epoch.epoch !== session.session_epoch) return frozen({ ok: false, code: 'SESSION_REVOKED' });
  return frozen({ ok: true, session, current_epoch: epoch.epoch, authoritative_read: true });
}

export function persistPrivateRuntimeCapability({
  store,
  rawCapability,
  envelope,
  now,
}) {
  const validation = validatePrivateRuntimeCapabilityEnvelope(envelope, { now });
  if (!validation.valid || typeof rawCapability !== 'string' || rawCapability.length < 32) {
    return frozen({ ok: false, code: validation.errors?.[0]?.code || 'CAPABILITY_INVALID' });
  }
  const tokenHash = hashCanonicalJson({
    domain: 'private_runtime_capability',
    value: rawCapability,
  });
  const saved = store?.putCapabilityHash?.({
    token_hash: tokenHash,
    capability_ref: envelope.capability_id,
    envelope,
    status: 'ACTIVE',
  });
  return saved?.ok
    ? frozen({ ok: true, token_hash: tokenHash, raw_material_persisted: false })
    : frozen({ ok: false, code: saved?.code || 'SHARED_SECURITY_STATE_REQUIRED' });
}

export function revalidatePrivateRuntimeCapability({
  store,
  rawCapability,
  bindings,
  now,
}) {
  if (typeof rawCapability !== 'string' || rawCapability.length < 32) {
    return frozen({ ok: false, code: 'CAPABILITY_INVALID' });
  }
  const tokenHash = hashCanonicalJson({
    domain: 'private_runtime_capability',
    value: rawCapability,
  });
  const found = store?.getCapabilityByHash?.(tokenHash);
  if (!found?.ok || found.status !== 'FOUND') {
    return frozen({ ok: false, code: found?.code || 'CAPABILITY_INVALID' });
  }
  if (found.record.status === 'REVOKED') return frozen({ ok: false, code: 'CAPABILITY_REVOKED' });
  const validation = validatePrivateRuntimeCapabilityEnvelope(found.record.envelope, {
    ...bindings,
    now,
  });
  return validation.valid
    ? frozen({ ok: true, envelope: validation.value, authoritative_read: true })
    : frozen({ ok: false, code: validation.errors[0]?.code || 'CAPABILITY_INVALID' });
}

export function logoutPrivateRuntimeSession({
  store,
  authenticatedSessionId,
  rawCapability,
  environmentScopeHash,
  expectedEpoch,
}) {
  const tokenHash = typeof rawCapability === 'string' && rawCapability.length >= 32
    ? hashCanonicalJson({ domain: 'private_runtime_capability', value: rawCapability })
    : null;
  if (!tokenHash) return frozen({ ok: false, code: 'CAPABILITY_INVALID' });
  const capability = store.getCapabilityByHash(tokenHash);
  if (!capability?.ok || capability.status !== 'FOUND') {
    return frozen({ ok: false, code: 'CAPABILITY_INVALID' });
  }
  const revokedCapability = store.revokeCapability({
    token_hash: tokenHash,
    reason_code: 'USER_LOGOUT',
  });
  if (!revokedCapability?.ok) return frozen({ ok: false, code: revokedCapability?.code || 'CAPABILITY_INVALID' });
  const revokedSession = revokeAuthenticatedSubscriberSession({
    store,
    authenticated_session_id: authenticatedSessionId,
    reason_code: 'USER_LOGOUT',
  });
  if (!revokedSession?.ok) return frozen({ ok: false, code: revokedSession?.code || 'SESSION_REVOKED' });
  const epoch = store.advanceSecurityEpoch({
    scope_hash: environmentScopeHash,
    expected_epoch: expectedEpoch,
    reason_code: 'USER_LOGOUT',
  });
  if (!epoch?.ok) return frozen({ ok: false, code: epoch?.code || 'SESSION_REVOKED' });
  return frozen({
    ok: true,
    receipt: {
      receipt_version: 'private-runtime-logout-receipt-v1',
      capability_revoked: true,
      session_revoked: true,
      csrf_invalidated: true,
      security_epoch_advanced: true,
      new_epoch: epoch.epoch,
      session_cookie_cleared: true,
      capability_cookie_cleared: true,
      runtime_handles_detached: true,
    },
  });
}
