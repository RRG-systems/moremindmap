import { hashCanonicalJson } from '../../hashing.js';
import { deepFreeze } from '../../validation.js';

export const DEFAULT_ABUSE_POLICIES = deepFreeze({
  developer_unlock: { window_ms: 60_000, limit: 5, cooldown_base_ms: 60_000 },
  session_create: { window_ms: 60_000, limit: 10, cooldown_base_ms: 60_000 },
  confirmation: { window_ms: 60_000, limit: 3, cooldown_base_ms: 60_000 },
  sensitive_read: { window_ms: 60_000, limit: 30, cooldown_base_ms: 60_000 },
  recovery: { window_ms: 300_000, limit: 3, cooldown_base_ms: 300_000 },
  failed_authorization: { window_ms: 300_000, limit: 10, cooldown_base_ms: 300_000 },
});

export function keyedAbuseDimension({ dimension, value, key_id = 'synthetic-keyed-dimension-v1' }) {
  if (!dimension || value == null) return null;
  return hashCanonicalJson({ domain: 'coach_connect_abuse_dimension', key_id, dimension, value });
}

export function evaluateAbuseControls({
  store,
  policy = 'developer_unlock',
  dimensions = {},
  now = Date.now(),
  policies = DEFAULT_ABUSE_POLICIES,
  key_id,
}) {
  const selected = policies[policy];
  if (!selected) return deepFreeze({ allowed: false, code: 'RATE_LIMITED', reason: 'UNKNOWN_POLICY' });
  const keys = Object.entries(dimensions)
    .filter(([, value]) => value != null && value !== '')
    .map(([dimension, value]) => keyedAbuseDimension({ dimension: `${policy}:${dimension}`, value, key_id }))
    .filter(Boolean);
  if (!keys.length) return deepFreeze({ allowed: false, code: 'RATE_LIMITED', reason: 'DIMENSION_REQUIRED' });
  const decisions = keys.map((key) => store.rateLimit({ key, now, ...selected }));
  const denied = decisions.find((decision) => !decision.ok);
  return deepFreeze(denied
    ? { allowed: false, code: 'RATE_LIMITED', retry_after_ms: denied.retry_after_ms || selected.cooldown_base_ms, dimension_count: keys.length }
    : { allowed: true, code: null, dimension_count: keys.length, remaining: Math.min(...decisions.map((decision) => decision.remaining)) });
}
