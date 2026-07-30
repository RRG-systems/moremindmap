import { deepFreeze } from '../../../validation.js';
import { validateCsrfGrant } from '../../security/contracts.js';

const clone = (value) => value == null ? value : structuredClone(value);
const frozen = (value) => deepFreeze(clone(value));
const mapFrom = (entries = []) => new Map(entries.map(([key, value]) => [key, clone(value)]));

export const SUBDEV1_OPERATOR_STORE_METHODS = deepFreeze([
  'describe',
  'rateLimit',
  'issueCsrfGrant',
  'consumeCsrfGrant',
  'saveContext',
  'getContextByTokenHash',
  'replaceContext',
  'appendAudit',
  'auditSnapshot',
]);

export function validateSubdev1OperatorStore(value) {
  const missing = SUBDEV1_OPERATOR_STORE_METHODS
    .filter((method) => typeof value?.[method] !== 'function');
  return frozen({
    valid: missing.length === 0,
    missing_methods: missing,
  });
}

export class InMemorySubdev1OperatorBridgeStore {
  constructor(snapshot = null, { available = true } = {}) {
    this.available = available;
    this.contexts = mapFrom(snapshot?.contexts);
    this.rateLimits = mapFrom(snapshot?.rate_limits);
    this.csrfGrants = mapFrom(snapshot?.csrf_grants);
    this.auditEvents = (snapshot?.audit_events || []).map(clone);
  }

  describe() {
    return frozen({
      store_class: 'SYNTHETIC_IN_MEMORY_SUBDEV1_OPERATOR_BRIDGE',
      available: this.available,
      deployment_grade: false,
      shared_across_instances: false,
      restart_durable: false,
      no_local_fallback: false,
      synthetic_only: true,
    });
  }

  rateLimit({
    key,
    now,
    window_ms = 60_000,
    limit = 5,
    cooldown_base_ms = window_ms,
  }) {
    if (!this.available) return frozen({ ok: false, code: 'OPERATOR_STORE_UNAVAILABLE' });
    const prior = this.rateLimits.get(key);
    const current = !prior || now - prior.window_started_at >= window_ms
      ? { window_started_at: now, count: 0, blocked_until: 0, violations: 0 }
      : clone(prior);
    if (current.blocked_until > now) {
      return frozen({
        ok: false,
        code: 'OPERATOR_RATE_LIMITED',
        retry_after_ms: current.blocked_until - now,
      });
    }
    current.count += 1;
    if (current.count > limit) {
      current.violations += 1;
      current.blocked_until = now
        + cooldown_base_ms * (2 ** Math.min(current.violations - 1, 5));
      this.rateLimits.set(key, current);
      return frozen({
        ok: false,
        code: 'OPERATOR_RATE_LIMITED',
        retry_after_ms: current.blocked_until - now,
      });
    }
    this.rateLimits.set(key, current);
    return frozen({ ok: true, remaining: Math.max(0, limit - current.count) });
  }

  issueCsrfGrant(record) {
    if (!this.available) return frozen({ ok: false, code: 'OPERATOR_STORE_UNAVAILABLE' });
    const checked = validateCsrfGrant(record);
    if (!checked.valid || this.csrfGrants.has(record.proof_hash)) {
      return frozen({ ok: false, code: 'CSRF_VALIDATION_FAILED' });
    }
    this.csrfGrants.set(record.proof_hash, clone(record));
    return frozen({ ok: true, grant_id: record.grant_id });
  }

  consumeCsrfGrant({
    proof_hash,
    browser_binding_hash,
    method,
    route,
    environment_id,
    now,
  }) {
    if (!this.available) return frozen({ ok: false, code: 'OPERATOR_STORE_UNAVAILABLE' });
    const grant = this.csrfGrants.get(proof_hash);
    if (!grant
      || grant.status !== 'ACTIVE'
      || grant.browser_binding_hash !== browser_binding_hash
      || grant.method !== method
      || grant.route !== route
      || grant.environment_id !== environment_id
      || Date.parse(grant.expires_at) <= now) {
      return frozen({ ok: false, code: 'CSRF_VALIDATION_FAILED' });
    }
    this.csrfGrants.set(proof_hash, {
      ...grant,
      status: 'CONSUMED',
      consumed_at: new Date(now).toISOString(),
    });
    return frozen({ ok: true, grant_id: grant.grant_id });
  }

  saveContext(context) {
    if (!this.available) return frozen({ ok: false, code: 'OPERATOR_STORE_UNAVAILABLE' });
    if (!context?.token_hash || this.contexts.has(context.token_hash)) {
      return frozen({ ok: false, code: 'OPERATOR_CONTEXT_INVALID' });
    }
    this.contexts.set(context.token_hash, clone(context));
    return frozen({ ok: true, context_id: context.context_id });
  }

  getContextByTokenHash(tokenHash) {
    if (!this.available) {
      return frozen({
        ok: false,
        code: 'OPERATOR_STORE_UNAVAILABLE',
        status: 'UNAVAILABLE',
        context: null,
      });
    }
    const context = this.contexts.get(tokenHash);
    return frozen(context
      ? { ok: true, status: 'FOUND', context }
      : { ok: true, status: 'NOT_FOUND', context: null });
  }

  replaceContext({
    token_hash,
    expected_profile_generation,
    context,
  }) {
    if (!this.available) return frozen({ ok: false, code: 'OPERATOR_STORE_UNAVAILABLE' });
    const prior = this.contexts.get(token_hash);
    if (!prior
      || prior.profile_generation !== expected_profile_generation
      || context?.token_hash !== token_hash) {
      return frozen({ ok: false, code: 'PROFILE_RECEIPT_STALE' });
    }
    this.contexts.set(token_hash, clone(context));
    return frozen({
      ok: true,
      context_id: context.context_id,
      profile_generation: context.profile_generation,
    });
  }

  appendAudit(event) {
    if (!this.available) return frozen({ ok: false, code: 'OPERATOR_STORE_UNAVAILABLE' });
    this.auditEvents.push(clone(event));
    return frozen({ ok: true, event_id: `subdev1_audit_${this.auditEvents.length}` });
  }

  auditSnapshot() {
    return frozen(this.auditEvents);
  }

  snapshot() {
    return frozen({
      contexts: [...this.contexts.entries()].map(([key, value]) => [key, clone(value)]),
      rate_limits: [...this.rateLimits.entries()].map(([key, value]) => [key, clone(value)]),
      csrf_grants: [...this.csrfGrants.entries()].map(([key, value]) => [key, clone(value)]),
      audit_events: this.auditEvents.map(clone),
    });
  }
}
