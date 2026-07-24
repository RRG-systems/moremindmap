import { hashCanonicalJson } from '../../hashing.js';
import { deepFreeze } from '../../validation.js';
import {
  COACH_CONNECT_SECURITY_POLICY_VERSION,
  SECURITY_CLIENT_ERROR_STATUS,
  SECURITY_EVENT_TYPES,
  SECURITY_FAILURE_CODES,
} from './constants.js';

const BLOCKED_KEYS = new Set([
  'access_code',
  'authorization',
  'cookie',
  'cookies',
  'csrf_token',
  'capability',
  'capability_token',
  'raw_token',
  'session_token',
  'signing_secret',
  'secret',
  'pepper',
  'password',
  'raw_transcript',
  'provider_payload',
  'private_source_content',
  'coach_private',
  'stack',
]);

function safeString(value, sensitiveValues) {
  let output = value;
  for (const sensitive of sensitiveValues) {
    if (typeof sensitive === 'string' && sensitive) output = output.split(sensitive).join('[REDACTED]');
  }
  return output.length > 500 ? `${output.slice(0, 80)}…[TRUNCATED]` : output;
}

export function redactSecurityValue(value, { sensitive_values = [], max_depth = 8, max_entries = 100 } = {}, depth = 0, seen = new Set()) {
  if (depth > max_depth) return '[DEPTH_LIMIT]';
  if (typeof value === 'string') return safeString(value, sensitive_values);
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value !== 'object') return '[UNSERIALIZABLE]';
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  if (value instanceof Error) {
    const safe = {
      name: safeString(value.name || 'Error', sensitive_values),
      message: safeString(value.message || 'Operation failed', sensitive_values),
      code: typeof value.code === 'string' ? safeString(value.code, sensitive_values) : null,
      cause: value.cause ? redactSecurityValue(value.cause, { sensitive_values, max_depth, max_entries }, depth + 1, seen) : null,
    };
    seen.delete(value);
    return safe;
  }
  if (Array.isArray(value)) {
    const output = value.slice(0, max_entries).map((entry) => redactSecurityValue(entry, { sensitive_values, max_depth, max_entries }, depth + 1, seen));
    seen.delete(value);
    return output;
  }
  const output = {};
  for (const [key, child] of Object.entries(value).slice(0, max_entries)) {
    output[key] = BLOCKED_KEYS.has(key.toLowerCase())
      ? '[REDACTED]'
      : redactSecurityValue(child, { sensitive_values, max_depth, max_entries }, depth + 1, seen);
  }
  seen.delete(value);
  return output;
}

export function containsForbiddenSecurityMaterial(value) {
  if (!value || typeof value !== 'object') return false;
  const queue = [value];
  const seen = new Set();
  while (queue.length) {
    const current = queue.pop();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    for (const [key, child] of Object.entries(current)) {
      if (BLOCKED_KEYS.has(key.toLowerCase()) && child !== '[REDACTED]' && child != null) return true;
      if (child && typeof child === 'object') queue.push(child);
    }
  }
  return false;
}

export function createSecurityAuditEvent({
  event_type,
  decision,
  failure_code = null,
  occurred_at,
  correlation_id,
  actor = null,
  session = null,
  scope = null,
  resource = null,
  policy_version = COACH_CONNECT_SECURITY_POLICY_VERSION,
  details = {},
  sensitive_values = [],
}) {
  if (!SECURITY_EVENT_TYPES.includes(event_type)
    || (failure_code && !SECURITY_FAILURE_CODES.includes(failure_code))
    || !Number.isFinite(Date.parse(occurred_at))
    || typeof correlation_id !== 'string'
    || !correlation_id) {
    return deepFreeze({ ok: false, code: 'LOG_SAFETY_VIOLATION' });
  }
  const safeDetails = redactSecurityValue(details, { sensitive_values });
  if (containsForbiddenSecurityMaterial(safeDetails)) return deepFreeze({ ok: false, code: 'LOG_SAFETY_VIOLATION' });
  const body = {
    schema_version: '1.0.0',
    event_type,
    privacy_class: 'RESTRICTED_SENSITIVE',
    decision,
    failure_code,
    occurred_at,
    correlation_id,
    actor_ref: actor?.actor_id ? hashCanonicalJson({ domain: 'actor', value: actor.actor_id }) : null,
    session_ref: session?.session_id ? hashCanonicalJson({ domain: 'session', value: session.session_id }) : null,
    scope_ref: scope ? hashCanonicalJson({ domain: 'scope', value: scope }) : null,
    resource_ref: resource?.resource_id ? hashCanonicalJson({ domain: resource.resource_type || 'resource', value: resource.resource_id }) : null,
    policy_version,
    details: safeDetails,
  };
  return deepFreeze({ ok: true, event: { ...body, event_id: `security_${hashCanonicalJson(body).slice(0, 32)}` } });
}

export function appendSecurityAudit(store, input) {
  const created = createSecurityAuditEvent(input);
  if (!created.ok) return created;
  const appended = store.appendAudit(created.event);
  return appended.ok
    ? deepFreeze({ ok: true, event: created.event })
    : deepFreeze({ ok: false, code: appended.code || 'LOG_SAFETY_VIOLATION' });
}

export function safeSecurityClientError(code, { include_retry_after = null } = {}) {
  const recognized = SECURITY_FAILURE_CODES.includes(code) ? code : 'AUTHORIZATION_DENIED';
  const publicCode = ['SESSION_EXPIRED', 'SESSION_REVOKED', 'AUTHENTICATION_FAILED'].includes(recognized)
    ? 'authentication_required'
    : recognized === 'RATE_LIMITED'
      ? 'temporarily_unavailable'
      : recognized === 'RETENTION_EXPIRED' || recognized === 'DELETION_REQUIRED'
        ? 'resource_unavailable'
        : 'request_denied';
  return deepFreeze({
    status: SECURITY_CLIENT_ERROR_STATUS[recognized] || 403,
    body: {
      ok: false,
      error: publicCode,
      ...(Number.isFinite(include_retry_after) ? { retry_after_seconds: Math.max(1, Math.ceil(include_retry_after / 1000)) } : {}),
    },
  });
}
