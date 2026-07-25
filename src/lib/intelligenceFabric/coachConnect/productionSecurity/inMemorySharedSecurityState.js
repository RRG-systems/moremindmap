import { deepFreeze } from '../../validation.js';
import {
  validateAuthenticatedSubscriberSession,
  validatePreAuthSession,
} from './contracts.js';
import { PRODUCTION_SECURITY_POLICY_VERSIONS } from './constants.js';

const clone = (value) => value == null ? value : structuredClone(value);
const frozen = (value) => deepFreeze(clone(value));
const mapFrom = (entries = []) => new Map(entries.map(([key, value]) => [key, clone(value)]));

export function createSyntheticSharedSecurityBackend(snapshot = null, {
  clock = () => Date.now(),
} = {}) {
  return {
    clock,
    availability: snapshot?.availability || 'AVAILABLE',
    sessions: mapFrom(snapshot?.sessions),
    nonces: mapFrom(snapshot?.nonces),
    replays: mapFrom(snapshot?.replays),
    rate_limits: mapFrom(snapshot?.rate_limits),
    capabilities: mapFrom(snapshot?.capabilities),
    security_epochs: mapFrom(snapshot?.security_epochs),
    deletion_epochs: mapFrom(snapshot?.deletion_epochs),
    leases: mapFrom(snapshot?.leases),
    audit_receipts: (snapshot?.audit_receipts || []).map(clone),
    read_cache: new Map(),
    fencing_counter: Number.isInteger(snapshot?.fencing_counter) ? snapshot.fencing_counter : 0,
  };
}

export class InMemorySharedSecurityState {
  constructor({
    backend = null,
    environment_id = 'synthetic-local',
    clock = () => Date.now(),
  } = {}) {
    this.backend = backend || createSyntheticSharedSecurityBackend(null, { clock });
    this.environment_id = environment_id;
  }

  now() {
    const value = this.backend.clock();
    return Number.isFinite(value) ? value : null;
  }

  available() {
    return this.backend.availability === 'AVAILABLE';
  }

  denyUnavailable() {
    return frozen({
      ok: false,
      code: this.backend.availability === 'PARTITIONED'
        ? 'SHARED_SECURITY_STATE_PARTITIONED'
        : 'SHARED_SECURITY_STATE_UNAVAILABLE',
    });
  }

  describeCapability() {
    return deepFreeze({
      contract_version: PRODUCTION_SECURITY_POLICY_VERSIONS.shared_state,
      adapter_class: 'SYNTHETIC_LOCAL',
      provider: 'SYNTHETIC_IN_MEMORY',
      deployment_grade: false,
      atomicity_model: 'SINGLE_EVENT_LOOP_SHARED_BACKEND',
      ttl_clock_source: 'SYNTHETIC_BACKEND_SERVER_TIME',
      partition_behavior: 'FAIL_CLOSED',
      durable_audit: false,
      durability_model: 'EXPLICIT_SNAPSHOT_ONLY',
      eviction_behavior: 'NON_AUTHORITATIVE_READ_CACHE_ONLY',
      read_after_eviction_verified: true,
      no_local_fallback: true,
      shared_across_instances: true,
      environment_id: this.environment_id,
      available: this.available(),
      production_connection: false,
    });
  }

  serverTime() {
    if (!this.available()) return this.denyUnavailable();
    const now = this.now();
    return Number.isFinite(now)
      ? frozen({ ok: true, epoch_ms: now, source: 'SYNTHETIC_BACKEND_SERVER_TIME' })
      : frozen({ ok: false, code: 'SECURITY_STATE_CLOCK_INVALID' });
  }

  health() {
    return frozen({
      ok: this.available(),
      state: this.backend.availability,
      deployment_grade: false,
      live_connection: false,
    });
  }

  setAvailability(state) {
    if (!['AVAILABLE', 'DEGRADED', 'UNAVAILABLE', 'PARTITIONED', 'RECOVERING'].includes(state)) {
      throw new TypeError('invalid availability state');
    }
    this.backend.availability = state;
    return this.health();
  }

  atomicCreateSession({ session, ttl_ms = null }) {
    if (!this.available()) return this.denyUnavailable();
    const isPreAuth = 'pre_auth_session_id' in (session || {});
    const validation = isPreAuth
      ? validatePreAuthSession(session)
      : validateAuthenticatedSubscriberSession(session);
    const sessionId = isPreAuth
      ? session?.pre_auth_session_id
      : session?.authenticated_session_id;
    if (!validation.valid || this.backend.sessions.has(sessionId)) {
      return frozen({ ok: false, code: isPreAuth ? 'SESSION_ELEVATION_REQUIRED' : 'SESSION_ROTATION_FAILED' });
    }
    const now = this.now();
    if (!Number.isFinite(now)) return frozen({ ok: false, code: 'SECURITY_STATE_CLOCK_INVALID' });
    const record = {
      ...clone(session),
      session_class: isPreAuth ? 'PRE_AUTH' : 'AUTHENTICATED',
      ttl_expires_at: Number.isFinite(ttl_ms) ? now + ttl_ms : Date.parse(session.expires_at),
    };
    this.backend.sessions.set(sessionId, record);
    return frozen({ ok: true, status: 'CREATED', session: record });
  }

  rotateSession({
    pre_auth_session_id,
    authenticated_session,
    invalidated_capability_hashes = [],
    expected_csrf_generation,
    elevation_receipt,
    audit_receipt,
  }) {
    if (!this.available()) return this.denyUnavailable();
    const now = this.now();
    const prior = this.backend.sessions.get(pre_auth_session_id);
    const validation = validateAuthenticatedSubscriberSession(authenticated_session);
    if (!Number.isFinite(now)) return frozen({ ok: false, code: 'SECURITY_STATE_CLOCK_INVALID' });
    if (!prior || prior.session_class !== 'PRE_AUTH' || prior.status !== 'ACTIVE') {
      return frozen({ ok: false, code: 'PRE_AUTH_SESSION_REPLAYED' });
    }
    if (prior.ttl_expires_at <= now) {
      this.backend.sessions.set(pre_auth_session_id, { ...prior, status: 'EXPIRED' });
      return frozen({ ok: false, code: 'SESSION_ELEVATION_REQUIRED' });
    }
    if (prior.csrf_generation !== expected_csrf_generation) {
      return frozen({ ok: false, code: 'PRE_AUTH_CSRF_REPLAYED' });
    }
    if (!validation.valid
      || authenticated_session.authenticated_session_id === pre_auth_session_id
      || authenticated_session.rotation_parent_reference === authenticated_session.authenticated_session_id
      || this.backend.sessions.has(authenticated_session.authenticated_session_id)
      || elevation_receipt?.pre_auth_session_ref !== pre_auth_session_id
      || elevation_receipt?.authenticated_session_ref !== authenticated_session.authenticated_session_id
      || !audit_receipt?.audit_event_id
      || elevation_receipt?.audit_event_id !== audit_receipt.audit_event_id
      || this.backend.audit_receipts.some((item) => item.audit_event_id === audit_receipt.audit_event_id)) {
      return frozen({ ok: false, code: 'SESSION_ROTATION_FAILED' });
    }

    const capabilityUpdates = [];
    for (const tokenHash of invalidated_capability_hashes) {
      const capability = this.backend.capabilities.get(tokenHash);
      if (capability) capabilityUpdates.push([tokenHash, { ...capability, status: 'ROTATED', revoked_at: new Date(now).toISOString() }]);
    }
    const rotated = {
      ...prior,
      status: 'ROTATED',
      rotated_at: new Date(now).toISOString(),
      replacement_session_ref: authenticated_session.authenticated_session_id,
      grants_authenticated_authority: false,
    };
    const authenticated = {
      ...clone(authenticated_session),
      session_class: 'AUTHENTICATED',
      ttl_expires_at: Date.parse(authenticated_session.expires_at),
    };

    this.backend.sessions.set(pre_auth_session_id, rotated);
    this.backend.sessions.set(authenticated_session.authenticated_session_id, authenticated);
    for (const [tokenHash, record] of capabilityUpdates) this.backend.capabilities.set(tokenHash, record);
    this.backend.audit_receipts.push(clone(audit_receipt));
    return frozen({
      ok: true,
      status: 'ROTATED',
      prior_session: rotated,
      authenticated_session: authenticated,
      invalidated_csrf_generation: expected_csrf_generation,
      invalidated_capability_count: capabilityUpdates.length,
      elevation_receipt,
    });
  }

  getSession(session_id) {
    if (!this.available()) return this.denyUnavailable();
    const now = this.now();
    if (!Number.isFinite(now)) return frozen({ ok: false, code: 'SECURITY_STATE_CLOCK_INVALID' });
    const record = this.backend.sessions.get(session_id);
    if (!record) return frozen({ ok: true, status: 'NOT_FOUND', session: null });
    if (record.ttl_expires_at <= now && !['REVOKED', 'ROTATED', 'INVALID'].includes(record.status)) {
      const expired = { ...record, status: 'EXPIRED' };
      this.backend.sessions.set(session_id, expired);
      return frozen({ ok: true, status: 'FOUND', session: expired });
    }
    this.backend.read_cache.set(`session:${session_id}`, clone(record));
    return frozen({ ok: true, status: 'FOUND', session: record });
  }

  revokeSession({ session_id, reason_code, expected_status = 'ACTIVE' }) {
    if (!this.available()) return this.denyUnavailable();
    const record = this.backend.sessions.get(session_id);
    if (!record || record.status !== expected_status) {
      return frozen({ ok: false, code: 'SESSION_ROTATION_FAILED' });
    }
    const now = this.now();
    if (!Number.isFinite(now)) return frozen({ ok: false, code: 'SECURITY_STATE_CLOCK_INVALID' });
    const revoked = {
      ...record,
      status: 'REVOKED',
      revoked_at: new Date(now).toISOString(),
      revocation_reason: reason_code,
    };
    this.backend.sessions.set(session_id, revoked);
    return frozen({ ok: true, status: 'REVOKED', session: revoked });
  }

  consumeNonce({ namespace, nonce_hash, ttl_ms = 900_000 }) {
    if (!this.available()) return this.denyUnavailable();
    const now = this.now();
    if (!Number.isFinite(now)) return frozen({ ok: false, code: 'SECURITY_STATE_CLOCK_INVALID' });
    if (!namespace || !nonce_hash || !Number.isFinite(ttl_ms) || ttl_ms <= 0) {
      return frozen({ ok: false, code: 'PRE_AUTH_CSRF_REPLAYED' });
    }
    const key = `${namespace}:${nonce_hash}`;
    const prior = this.backend.nonces.get(key);
    if (prior && prior.expires_at > now) return frozen({ ok: false, code: 'PRE_AUTH_CSRF_REPLAYED' });
    this.backend.nonces.set(key, { consumed_at: now, expires_at: now + ttl_ms });
    return frozen({ ok: true, status: 'CONSUMED', expires_at: now + ttl_ms });
  }

  claimReplay({ key, fingerprint, ttl_ms = 900_000 }) {
    if (!this.available()) return this.denyUnavailable();
    const now = this.now();
    if (!Number.isFinite(now)) return frozen({ ok: false, code: 'SECURITY_STATE_CLOCK_INVALID' });
    const prior = this.backend.replays.get(key);
    if (prior && prior.expires_at > now) {
      if (prior.fingerprint !== fingerprint) return frozen({ ok: false, code: 'PRE_AUTH_SESSION_REPLAYED', status: 'CONFLICT' });
      return frozen({
        ok: true,
        status: prior.status === 'COMPLETED' ? 'IDEMPOTENT_REPLAY' : 'IN_PROGRESS',
        result_reference: prior.result_reference || null,
      });
    }
    this.backend.replays.set(key, {
      fingerprint,
      status: 'CLAIMED',
      claimed_at: now,
      expires_at: now + ttl_ms,
      result_reference: null,
    });
    return frozen({ ok: true, status: 'CLAIMED' });
  }

  completeReplay({ key, fingerprint, result_reference }) {
    if (!this.available()) return this.denyUnavailable();
    const now = this.now();
    const prior = this.backend.replays.get(key);
    if (!prior || prior.fingerprint !== fingerprint || prior.expires_at <= now) {
      return frozen({ ok: false, code: 'PRE_AUTH_SESSION_REPLAYED' });
    }
    const completed = { ...prior, status: 'COMPLETED', completed_at: now, result_reference };
    this.backend.replays.set(key, completed);
    return frozen({ ok: true, status: 'COMPLETED', result_reference });
  }

  rateLimit({ key, window_ms, limit, cooldown_base_ms = window_ms }) {
    if (!this.available()) return this.denyUnavailable();
    const now = this.now();
    if (!Number.isFinite(now)) return frozen({ ok: false, code: 'SECURITY_STATE_CLOCK_INVALID' });
    if (!key || !Number.isInteger(limit) || limit < 1 || !Number.isFinite(window_ms) || window_ms <= 0) {
      return frozen({ ok: false, code: 'SHARED_SECURITY_STATE_REQUIRED' });
    }
    const prior = this.backend.rate_limits.get(key);
    const current = !prior || now - prior.window_started_at >= window_ms
      ? { window_started_at: now, count: 0, blocked_until: 0, violations: 0 }
      : clone(prior);
    if (current.blocked_until > now) {
      return frozen({ ok: false, code: 'RATE_LIMITED', retry_after_ms: current.blocked_until - now });
    }
    current.count += 1;
    if (current.count > limit) {
      current.violations += 1;
      current.blocked_until = now + cooldown_base_ms * (2 ** Math.min(current.violations - 1, 5));
      this.backend.rate_limits.set(key, current);
      return frozen({ ok: false, code: 'RATE_LIMITED', retry_after_ms: current.blocked_until - now });
    }
    this.backend.rate_limits.set(key, current);
    return frozen({ ok: true, remaining: limit - current.count, resets_at: current.window_started_at + window_ms });
  }

  putCapabilityHash(record) {
    if (!this.available()) return this.denyUnavailable();
    if (!record?.token_hash || this.backend.capabilities.has(record.token_hash)) {
      return frozen({ ok: false, code: 'SHARED_SECURITY_STATE_REQUIRED' });
    }
    this.backend.capabilities.set(record.token_hash, clone(record));
    return frozen({ ok: true, status: 'SAVED', capability_ref: record.capability_ref || null });
  }

  getCapabilityByHash(token_hash) {
    if (!this.available()) return this.denyUnavailable();
    const record = this.backend.capabilities.get(token_hash);
    return frozen(record
      ? { ok: true, status: 'FOUND', record }
      : { ok: true, status: 'NOT_FOUND', record: null });
  }

  revokeCapability({ token_hash, reason_code }) {
    if (!this.available()) return this.denyUnavailable();
    const record = this.backend.capabilities.get(token_hash);
    if (!record) return frozen({ ok: false, code: 'SHARED_SECURITY_STATE_REQUIRED' });
    const now = this.now();
    const revoked = {
      ...record,
      status: 'REVOKED',
      revoked_at: new Date(now).toISOString(),
      revocation_reason: reason_code,
    };
    this.backend.capabilities.set(token_hash, revoked);
    return frozen({ ok: true, status: 'REVOKED', record: revoked });
  }

  getSecurityEpoch(scope_hash) {
    if (!this.available()) return this.denyUnavailable();
    return frozen({ ok: true, epoch: this.backend.security_epochs.get(scope_hash) || 0 });
  }

  advanceSecurityEpoch({ scope_hash, expected_epoch, reason_code }) {
    if (!this.available()) return this.denyUnavailable();
    const current = this.backend.security_epochs.get(scope_hash) || 0;
    if (current !== expected_epoch) return frozen({ ok: false, code: 'SUBJECT_MAPPING_STALE', epoch: current });
    const epoch = current + 1;
    this.backend.security_epochs.set(scope_hash, epoch);
    return frozen({ ok: true, epoch, reason_code });
  }

  getDeletionEpoch(scope_hash) {
    if (!this.available()) return this.denyUnavailable();
    return frozen({ ok: true, epoch: this.backend.deletion_epochs.get(scope_hash) || 0 });
  }

  advanceDeletionEpoch({ scope_hash, expected_epoch, reason_code }) {
    if (!this.available()) return this.denyUnavailable();
    const current = this.backend.deletion_epochs.get(scope_hash) || 0;
    if (current !== expected_epoch) return frozen({ ok: false, code: 'DELETION_VERIFICATION_FAILED', epoch: current });
    const epoch = current + 1;
    this.backend.deletion_epochs.set(scope_hash, epoch);
    return frozen({ ok: true, epoch, reason_code });
  }

  acquireRetentionLease({ lease_key, owner_ref, ttl_ms }) {
    if (!this.available()) return this.denyUnavailable();
    const now = this.now();
    if (!Number.isFinite(now)) return frozen({ ok: false, code: 'SECURITY_STATE_CLOCK_INVALID' });
    const prior = this.backend.leases.get(lease_key);
    if (prior && prior.expires_at > now) return frozen({ ok: false, code: 'SHARED_SECURITY_STATE_REQUIRED', status: 'LEASE_HELD' });
    const fencing_token = this.backend.fencing_counter += 1;
    const lease = { lease_key, owner_ref, fencing_token, acquired_at: now, expires_at: now + ttl_ms };
    this.backend.leases.set(lease_key, lease);
    return frozen({ ok: true, status: 'ACQUIRED', lease });
  }

  renewRetentionLease({ lease_key, owner_ref, fencing_token, ttl_ms }) {
    if (!this.available()) return this.denyUnavailable();
    const now = this.now();
    const prior = this.backend.leases.get(lease_key);
    if (!prior || prior.owner_ref !== owner_ref || prior.fencing_token !== fencing_token || prior.expires_at <= now) {
      return frozen({ ok: false, code: 'SHARED_SECURITY_STATE_REQUIRED', status: 'STALE_FENCE' });
    }
    const lease = { ...prior, renewed_at: now, expires_at: now + ttl_ms };
    this.backend.leases.set(lease_key, lease);
    return frozen({ ok: true, status: 'RENEWED', lease });
  }

  releaseRetentionLease({ lease_key, owner_ref, fencing_token }) {
    if (!this.available()) return this.denyUnavailable();
    const prior = this.backend.leases.get(lease_key);
    if (!prior || prior.owner_ref !== owner_ref || prior.fencing_token !== fencing_token) {
      return frozen({ ok: false, code: 'SHARED_SECURITY_STATE_REQUIRED', status: 'STALE_FENCE' });
    }
    this.backend.leases.delete(lease_key);
    return frozen({ ok: true, status: 'RELEASED', fencing_token });
  }

  appendAuditReceipt(receipt) {
    if (!this.available()) return this.denyUnavailable();
    if (!receipt?.audit_event_id || this.backend.audit_receipts.some((item) => item.audit_event_id === receipt.audit_event_id)) {
      return frozen({ ok: false, code: 'OPERATOR_AUDIT_FAILED' });
    }
    this.backend.audit_receipts.push(clone(receipt));
    return frozen({ ok: true, status: 'APPENDED', audit_event_id: receipt.audit_event_id });
  }

  auditSnapshot() {
    return frozen(this.backend.audit_receipts);
  }

  evictNonAuthoritativeReadCache() {
    const authoritativeCounts = {
      sessions: this.backend.sessions.size,
      capabilities: this.backend.capabilities.size,
      replays: this.backend.replays.size,
      epochs: this.backend.security_epochs.size + this.backend.deletion_epochs.size,
    };
    this.backend.read_cache.clear();
    return frozen({
      ok: true,
      status: 'NON_AUTHORITATIVE_CACHE_EVICTED',
      authorization_state_preserved: true,
      authoritative_counts: authoritativeCounts,
    });
  }

  snapshot() {
    return frozen({
      availability: this.backend.availability,
      sessions: [...this.backend.sessions.entries()],
      nonces: [...this.backend.nonces.entries()],
      replays: [...this.backend.replays.entries()],
      rate_limits: [...this.backend.rate_limits.entries()],
      capabilities: [...this.backend.capabilities.entries()],
      security_epochs: [...this.backend.security_epochs.entries()],
      deletion_epochs: [...this.backend.deletion_epochs.entries()],
      leases: [...this.backend.leases.entries()],
      audit_receipts: this.backend.audit_receipts,
      fencing_counter: this.backend.fencing_counter,
    });
  }
}
