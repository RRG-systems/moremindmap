import { hashCanonicalJson } from '../../hashing.js';
import { deepFreeze } from '../../validation.js';
import { PRODUCTION_SECURITY_PREREQUISITE_SCHEMA } from './constants.js';

const BLOCKED_KEYS = new Set([
  'access_token',
  'assertion',
  'authorization',
  'cookie',
  'credential',
  'id_token',
  'password',
  'provider_payload',
  'raw_address',
  'raw_ip',
  'raw_token',
  'recording_content',
  'secret',
  'transcript_content',
]);

function sanitize(value, depth = 0, seen = new Set()) {
  if (depth > 7) return '[DEPTH_LIMIT]';
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.length <= 512 ? value : `${value.slice(0, 80)}…[TRUNCATED]`;
  if (typeof value !== 'object') return '[UNSERIALIZABLE]';
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitize(item, depth + 1, seen));
  const output = {};
  for (const [key, item] of Object.entries(value).slice(0, 100)) {
    output[key] = BLOCKED_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : sanitize(item, depth + 1, seen);
  }
  return output;
}

export function containsForbiddenProductionSecurityMaterial(value) {
  if (value == null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsForbiddenProductionSecurityMaterial);
  return Object.entries(value).some(([key, item]) => BLOCKED_KEYS.has(key.toLowerCase())
    || containsForbiddenProductionSecurityMaterial(item));
}

export function createProductionSecurityAuditReceipt({
  event_type,
  decision,
  failure_code = null,
  occurred_at,
  correlation_id,
  subject_ref = null,
  session_ref = null,
  entitlement_ref = null,
  exact_scope_hash = null,
  action = null,
  reason_code = null,
  approver_refs = [],
  details = {},
  policy_version,
}) {
  if (!event_type || !['ALLOWED', 'DENIED', 'RECORDED'].includes(decision)
    || !Number.isFinite(Date.parse(occurred_at)) || !correlation_id || !policy_version) {
    return deepFreeze({ ok: false, code: 'OPERATOR_AUDIT_FAILED' });
  }
  const safeDetails = sanitize(details);
  if (containsForbiddenProductionSecurityMaterial(safeDetails)) {
    return deepFreeze({ ok: false, code: 'OPERATOR_AUDIT_FAILED' });
  }
  const body = {
    schema_version: PRODUCTION_SECURITY_PREREQUISITE_SCHEMA,
    event_type,
    decision,
    failure_code,
    occurred_at,
    correlation_id,
    subject_ref,
    session_ref,
    entitlement_ref,
    exact_scope_hash,
    action,
    reason_code,
    approver_refs: [...approver_refs],
    policy_version,
    privacy_class: 'RESTRICTED_SECURITY_AUDIT',
    details: safeDetails,
  };
  return deepFreeze({
    ok: true,
    receipt: {
      ...body,
      audit_event_id: `production_security_${hashCanonicalJson(body).slice(0, 32)}`,
    },
  });
}

export function appendProductionSecurityAudit(store, input) {
  const created = createProductionSecurityAuditReceipt(input);
  if (!created.ok) return created;
  const appended = store?.appendAuditReceipt?.(created.receipt);
  return appended?.ok
    ? deepFreeze({ ok: true, receipt: created.receipt })
    : deepFreeze({ ok: false, code: appended?.code || 'OPERATOR_AUDIT_FAILED' });
}
