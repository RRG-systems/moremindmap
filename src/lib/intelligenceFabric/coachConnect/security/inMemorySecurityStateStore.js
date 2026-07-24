import { deepFreeze } from '../../validation.js';
import { validateCapabilityRecord, validateCsrfGrant, validateDeletionEpoch } from './contracts.js';

const clone = (value) => value == null ? value : structuredClone(value);
const frozen = (value) => deepFreeze(clone(value));
const fromEntries = (entries = []) => new Map(entries.map(([key, value]) => [key, clone(value)]));

export class InMemorySecurityStateStore {
  constructor(snapshot = null, { available = true } = {}) {
    this.available = available;
    this.capabilities = fromEntries(snapshot?.capabilities);
    this.rateLimits = fromEntries(snapshot?.rate_limits);
    this.csrfGrants = fromEntries(snapshot?.csrf_grants);
    this.replays = fromEntries(snapshot?.replays);
    this.deletionEpochs = fromEntries(snapshot?.deletion_epochs);
    this.auditEvents = (snapshot?.audit_events || []).map(clone);
  }

  describe() {
    return deepFreeze({
      store_class: 'SYNTHETIC_IN_MEMORY',
      deployment_grade: false,
      shared_across_instances: false,
      restart_durable_from_snapshot_only: true,
      available: this.available,
    });
  }

  rateLimit({ key, now, window_ms, limit, cooldown_base_ms = window_ms }) {
    if (!this.available) return deepFreeze({ ok: false, code: 'SECURITY_STATE_UNAVAILABLE' });
    const prior = this.rateLimits.get(key);
    const current = !prior || now - prior.window_started_at >= window_ms
      ? { window_started_at: now, count: 0, blocked_until: 0, violations: 0 }
      : clone(prior);
    if (current.blocked_until > now) {
      return deepFreeze({ ok: false, code: 'RATE_LIMITED', count: current.count, retry_after_ms: current.blocked_until - now });
    }
    current.count += 1;
    if (current.count > limit) {
      current.violations += 1;
      current.blocked_until = now + cooldown_base_ms * (2 ** Math.min(current.violations - 1, 5));
      this.rateLimits.set(key, current);
      return deepFreeze({ ok: false, code: 'RATE_LIMITED', count: current.count, retry_after_ms: current.blocked_until - now });
    }
    this.rateLimits.set(key, current);
    return deepFreeze({ ok: true, code: 'ALLOWED', count: current.count, remaining: limit - current.count, resets_at: current.window_started_at + window_ms });
  }

  saveCapability(record) {
    if (!this.available) return deepFreeze({ ok: false, code: 'SECURITY_STATE_UNAVAILABLE' });
    const validation = validateCapabilityRecord(record);
    if (!validation.valid || this.capabilities.has(record.token_hash)) return deepFreeze({ ok: false, code: 'CAPABILITY_INVALID' });
    this.capabilities.set(record.token_hash, clone(record));
    return deepFreeze({ ok: true, status: 'SAVED', capability_id: record.capability_id });
  }

  getCapabilityByTokenHash(token_hash) {
    if (!this.available) return deepFreeze({ ok: false, code: 'SECURITY_STATE_UNAVAILABLE', record: null });
    const record = this.capabilities.get(token_hash);
    return deepFreeze(record ? { ok: true, status: 'FOUND', record: clone(record) } : { ok: true, status: 'NOT_FOUND', record: null });
  }

  revokeCapability({ token_hash, revoked_at, reason_code = 'USER_REVOKED', replacement_token_hash = null }) {
    if (!this.available) return deepFreeze({ ok: false, code: 'SECURITY_STATE_UNAVAILABLE' });
    const record = this.capabilities.get(token_hash);
    if (!record) return deepFreeze({ ok: false, code: 'CAPABILITY_INVALID' });
    const status = replacement_token_hash ? 'ROTATED' : 'REVOKED';
    const updated = { ...record, status, revoked_at, revocation_reason: reason_code, replacement_token_hash };
    this.capabilities.set(token_hash, updated);
    return deepFreeze({ ok: true, status, capability_id: record.capability_id });
  }

  issueCsrfGrant(record) {
    if (!this.available) return deepFreeze({ ok: false, code: 'SECURITY_STATE_UNAVAILABLE' });
    const validation = validateCsrfGrant(record);
    if (!validation.valid || this.csrfGrants.has(record.proof_hash)) return deepFreeze({ ok: false, code: 'CSRF_VALIDATION_FAILED' });
    this.csrfGrants.set(record.proof_hash, clone(record));
    return deepFreeze({ ok: true, status: 'ISSUED', grant_id: record.grant_id });
  }

  consumeCsrfGrant({ proof_hash, browser_binding_hash, method, route, environment_id, now }) {
    if (!this.available) return deepFreeze({ ok: false, code: 'SECURITY_STATE_UNAVAILABLE' });
    const grant = this.csrfGrants.get(proof_hash);
    if (!grant
      || grant.status !== 'ACTIVE'
      || grant.browser_binding_hash !== browser_binding_hash
      || grant.method !== method
      || grant.route !== route
      || grant.environment_id !== environment_id
      || Date.parse(grant.expires_at) <= now) {
      return deepFreeze({ ok: false, code: 'CSRF_VALIDATION_FAILED' });
    }
    this.csrfGrants.set(proof_hash, { ...grant, status: 'CONSUMED', consumed_at: new Date(now).toISOString() });
    return deepFreeze({ ok: true, status: 'CONSUMED', grant_id: grant.grant_id });
  }

  claimReplay({ key, fingerprint, now, ttl_ms = 900_000 }) {
    if (!this.available) return deepFreeze({ ok: false, code: 'SECURITY_STATE_UNAVAILABLE' });
    const prior = this.replays.get(key);
    if (prior && prior.expires_at > now) {
      if (prior.fingerprint !== fingerprint) return deepFreeze({ ok: false, code: 'REQUEST_REPLAY_DETECTED', status: 'CONFLICT' });
      return deepFreeze({ ok: true, status: prior.status === 'COMPLETED' ? 'IDEMPOTENT_REPLAY' : 'IN_PROGRESS', result_reference: prior.result_reference || null });
    }
    this.replays.set(key, { fingerprint, claimed_at: now, expires_at: now + ttl_ms, status: 'CLAIMED', result_reference: null });
    return deepFreeze({ ok: true, status: 'CLAIMED' });
  }

  completeReplay({ key, fingerprint, result_reference, now }) {
    if (!this.available) return deepFreeze({ ok: false, code: 'SECURITY_STATE_UNAVAILABLE' });
    const prior = this.replays.get(key);
    if (!prior || prior.fingerprint !== fingerprint) return deepFreeze({ ok: false, code: 'REQUEST_REPLAY_DETECTED' });
    this.replays.set(key, { ...prior, status: 'COMPLETED', completed_at: now, result_reference });
    return deepFreeze({ ok: true, status: 'COMPLETED', result_reference });
  }

  getDeletionEpoch(scope_hash) {
    if (!this.available) return deepFreeze({ ok: false, code: 'SECURITY_STATE_UNAVAILABLE', epoch: null });
    const record = this.deletionEpochs.get(scope_hash);
    return deepFreeze({ ok: true, epoch: record?.epoch || 0, record: record ? clone(record) : null });
  }

  advanceDeletionEpoch(record) {
    if (!this.available) return deepFreeze({ ok: false, code: 'SECURITY_STATE_UNAVAILABLE' });
    const validation = validateDeletionEpoch(record);
    if (!validation.valid) return deepFreeze({ ok: false, code: 'DELETION_REQUIRED' });
    const prior = this.deletionEpochs.get(record.scope_hash);
    if (record.epoch !== (prior?.epoch || 0) + 1) return deepFreeze({ ok: false, code: 'REQUEST_REPLAY_DETECTED', actual_epoch: prior?.epoch || 0 });
    this.deletionEpochs.set(record.scope_hash, clone(record));
    return deepFreeze({ ok: true, status: 'ADVANCED', epoch: record.epoch });
  }

  appendAudit(event) {
    if (!this.available) return deepFreeze({ ok: false, code: 'SECURITY_STATE_UNAVAILABLE' });
    this.auditEvents.push(clone(event));
    return deepFreeze({ ok: true, status: 'APPENDED', event_id: event.event_id });
  }

  auditSnapshot() {
    return frozen(this.auditEvents);
  }

  snapshot() {
    return frozen({
      store_metadata: this.describe(),
      capabilities: [...this.capabilities.entries()],
      rate_limits: [...this.rateLimits.entries()],
      csrf_grants: [...this.csrfGrants.entries()],
      replays: [...this.replays.entries()],
      deletion_epochs: [...this.deletionEpochs.entries()],
      audit_events: this.auditEvents,
    });
  }
}
