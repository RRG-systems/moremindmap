import { hashCanonicalJson } from '../../hashing.js';
import { deepFreeze } from '../../validation.js';
import { validateCsrfGrant } from './contracts.js';

const header = (request, name) => {
  const headers = request?.headers || {};
  return headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()] ?? '';
};

function normalizedOrigin(value) {
  if (typeof value !== 'string' || !value || value.includes(',')) return null;
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function evaluateRequestOrigin({ request, allowed_origins = [], require_origin = true }) {
  const allowed = new Set(allowed_origins.map(normalizedOrigin).filter(Boolean));
  if (!allowed.size) return deepFreeze({ allowed: false, code: 'ORIGIN_VALIDATION_FAILED' });
  const supplied = normalizedOrigin(header(request, 'origin'));
  if (supplied) return deepFreeze(allowed.has(supplied) ? { allowed: true, code: null, origin: supplied } : { allowed: false, code: 'ORIGIN_VALIDATION_FAILED' });
  if (require_origin) {
    const referer = header(request, 'referer');
    const fetchSite = String(header(request, 'sec-fetch-site')).toLowerCase();
    let refererOrigin = null;
    try { refererOrigin = referer ? new URL(referer).origin : null; } catch { refererOrigin = null; }
    if (fetchSite === 'same-origin' && refererOrigin && allowed.has(refererOrigin)) return deepFreeze({ allowed: true, code: null, origin: refererOrigin, fallback: 'REFERER_AND_FETCH_METADATA' });
    return deepFreeze({ allowed: false, code: 'ORIGIN_VALIDATION_FAILED' });
  }
  return deepFreeze({ allowed: true, code: null, origin: null, fallback: 'SAFE_METHOD_NO_ORIGIN' });
}

export function issueCsrfGrant({
  store,
  proof,
  browser_binding_hash,
  method,
  route,
  environment_id,
  now = Date.now(),
  ttl_ms = 300_000,
}) {
  if (typeof proof !== 'string' || proof.length < 24) return deepFreeze({ ok: false, code: 'CSRF_VALIDATION_FAILED' });
  const proof_hash = hashCanonicalJson({ domain: 'coach_connect_csrf', proof });
  const record = {
    grant_id: `csrf_${proof_hash.slice(0, 32)}`,
    proof_hash,
    browser_binding_hash,
    method: String(method || '').toUpperCase(),
    route,
    environment_id,
    issued_at: new Date(now).toISOString(),
    expires_at: new Date(now + ttl_ms).toISOString(),
    status: 'ACTIVE',
  };
  const validation = validateCsrfGrant(record);
  if (!validation.valid) return deepFreeze({ ok: false, code: 'CSRF_VALIDATION_FAILED' });
  const saved = store.issueCsrfGrant(record);
  return saved.ok ? deepFreeze({ ok: true, proof, grant_id: record.grant_id, expires_at: record.expires_at }) : deepFreeze({ ok: false, code: saved.code || 'CSRF_VALIDATION_FAILED' });
}

export function consumeCsrfGrant({
  store,
  proof,
  browser_binding_hash,
  method,
  route,
  environment_id,
  now = Date.now(),
}) {
  if (typeof proof !== 'string' || proof.length < 24) return deepFreeze({ allowed: false, code: 'CSRF_VALIDATION_FAILED' });
  const proof_hash = hashCanonicalJson({ domain: 'coach_connect_csrf', proof });
  const consumed = store.consumeCsrfGrant({
    proof_hash,
    browser_binding_hash,
    method: String(method || '').toUpperCase(),
    route,
    environment_id,
    now,
  });
  return deepFreeze(consumed.ok ? { allowed: true, code: null, grant_id: consumed.grant_id } : { allowed: false, code: consumed.code === 'SECURITY_STATE_UNAVAILABLE' ? 'CSRF_VALIDATION_FAILED' : consumed.code });
}

export function evaluateRequestTimestamp({ timestamp, now = Date.now(), window_ms = 300_000 }) {
  const parsed = typeof timestamp === 'number' ? timestamp : Date.parse(timestamp);
  if (!Number.isFinite(parsed) || Math.abs(now - parsed) > window_ms) return deepFreeze({ allowed: false, code: 'REQUEST_REPLAY_DETECTED' });
  return deepFreeze({ allowed: true, code: null, request_time: parsed });
}

export function claimRequestReplay({
  store,
  scope,
  action,
  idempotency_key,
  nonce,
  request_fingerprint,
  now = Date.now(),
  ttl_ms = 900_000,
}) {
  if (!idempotency_key || !nonce || !request_fingerprint) return deepFreeze({ allowed: false, code: 'REQUEST_REPLAY_DETECTED' });
  const key = hashCanonicalJson({ domain: 'coach_connect_request', scope, action, idempotency_key, nonce });
  const fingerprint = hashCanonicalJson({ request_fingerprint, action, scope });
  const claimed = store.claimReplay({ key, fingerprint, now, ttl_ms });
  return deepFreeze(claimed.ok
    ? { allowed: true, code: null, key, fingerprint, status: claimed.status, result_reference: claimed.result_reference || null }
    : { allowed: false, code: claimed.code === 'SECURITY_STATE_UNAVAILABLE' ? 'REQUEST_REPLAY_DETECTED' : claimed.code });
}

export function completeRequestReplay({ store, key, fingerprint, result_reference, now = Date.now() }) {
  const completed = store.completeReplay({ key, fingerprint, result_reference, now });
  return deepFreeze(completed.ok ? { ok: true, status: completed.status } : { ok: false, code: completed.code || 'REQUEST_REPLAY_DETECTED' });
}
