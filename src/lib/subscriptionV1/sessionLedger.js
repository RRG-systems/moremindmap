import { hashCanonicalJson } from '../intelligenceFabric/hashing.js';
import { deepFreeze } from '../intelligenceFabric/validation.js';
import { contractHeader, sameScope, scopeFingerprint, validateSubscriptionV1Contract } from './contracts.js';
import { DEFAULT_SESSION_TIMING_POLICY } from './constants.js';
import { entitlementAllowsCoaching } from './entitlement.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const iso = (value) => new Date(value).toISOString();
const plusSeconds = (value, seconds) => new Date(Date.parse(value) + seconds * 1000).toISOString();
const isOpen = (session) => ['RESERVED', 'ACTIVE', 'GRACE'].includes(session.state);

function withLedgerHash(ledger) {
  const unsigned = { ...ledger };
  delete unsigned.ledger_hash;
  return deepFreeze({ ...unsigned, ledger_hash: hashCanonicalJson(unsigned) });
}

function validateTimingPolicy(policy) {
  const integer = (value) => Number.isInteger(value) && value > 0;
  return Boolean(policy?.policy_id && policy?.policy_version
    && integer(policy.reservation_ttl_seconds)
    && integer(policy.reconnect_grace_seconds)
    && integer(policy.active_hard_cap_seconds)
    && (policy.active_hard_cap_enforced == null || typeof policy.active_hard_cap_enforced === 'boolean')
    && integer(policy.standard_slots_per_billing_cycle)
    && integer(policy.onboarding_included_per_membership));
}

export class InMemoryAllowanceSessionLedger {
  constructor({ timing_policy = DEFAULT_SESSION_TIMING_POLICY } = {}) {
    if (!validateTimingPolicy(timing_policy)) throw new TypeError('Valid versioned session timing policy required');
    this.timingPolicy = clone(timing_policy);
    this.ledgers = new Map();
    this.sessions = new Map();
    this.idempotency = new Map();
  }

  createCycle(entitlement, { onboarding_consumed = false } = {}) {
    const allowed = entitlementAllowsCoaching(entitlement, entitlement.billing_cycle_start);
    if (!allowed.allowed) return deepFreeze({ ok: false, code: allowed.code });
    const ledgerId = `allowance_${hashCanonicalJson({ scope: entitlement.scope, entitlement_id: entitlement.entitlement_id, start: entitlement.billing_cycle_start, end: entitlement.billing_cycle_end }).slice(0, 24)}`;
    const existing = this.ledgers.get(ledgerId);
    if (existing) return deepFreeze({ ok: true, code: 'IDEMPOTENT_REPLAY', ledger: clone(existing) });
    const total = this.timingPolicy.standard_slots_per_billing_cycle;
    const unsigned = {
      ...contractHeader('session_allowance_ledger'),
      ledger_id: ledgerId,
      scope: clone(entitlement.scope),
      entitlement_id: entitlement.entitlement_id,
      billing_cycle_start: entitlement.billing_cycle_start,
      billing_cycle_end: entitlement.billing_cycle_end,
      standard_slots_total: total,
      standard_slots_consumed: 0,
      standard_slots_reserved: 0,
      standard_slots_available: total,
      onboarding_consumed,
      ledger_version: 1,
      last_transition_id: null,
    };
    const ledger = withLedgerHash(unsigned);
    const validation = validateSubscriptionV1Contract(ledger);
    if (!validation.valid) return deepFreeze({ ok: false, code: 'ALLOWANCE_LEDGER_CONTRACT_INVALID', errors: validation.errors });
    this.ledgers.set(ledgerId, clone(ledger));
    return deepFreeze({ ok: true, code: 'ALLOWANCE_CYCLE_CREATED', ledger });
  }

  #replaceLedger(ledgerId, changes, transitionId) {
    const current = this.ledgers.get(ledgerId);
    const next = withLedgerHash({
      ...current,
      ...changes,
      standard_slots_available: (changes.standard_slots_total ?? current.standard_slots_total)
        - (changes.standard_slots_consumed ?? current.standard_slots_consumed)
        - (changes.standard_slots_reserved ?? current.standard_slots_reserved),
      ledger_version: current.ledger_version + 1,
      last_transition_id: transitionId,
    });
    const validation = validateSubscriptionV1Contract(next);
    if (!validation.valid) throw new Error(`Ledger invariant failure: ${validation.errors[0]?.code}`);
    this.ledgers.set(ledgerId, clone(next));
    return next;
  }

  #replaceSession(sessionId, changes) {
    const current = this.sessions.get(sessionId);
    const next = deepFreeze({ ...current, ...changes, state_version: current.state_version + 1 });
    const validation = validateSubscriptionV1Contract(next);
    if (!validation.valid) throw new Error(`Session invariant failure: ${validation.errors[0]?.code}`);
    this.sessions.set(sessionId, clone(next));
    return next;
  }

  #expireOpenSessions(now) {
    const at = Date.parse(now);
    for (const session of [...this.sessions.values()]) {
      if (!isOpen(session)) continue;
      const reservationExpired = session.state === 'RESERVED' && Date.parse(session.reservation_expires_at) <= at;
      const graceExpired = session.state === 'GRACE' && Date.parse(session.grace_expires_at) <= at;
      const hardExpired = this.timingPolicy.active_hard_cap_enforced === true
        && session.hard_expires_at
        && Date.parse(session.hard_expires_at) <= at;
      if (!reservationExpired && !graceExpired && !hardExpired) continue;
      if (!session.charge_point_reached) {
        const ledger = this.ledgers.get(session.ledger_id);
        if (session.session_class === 'STANDARD' && ledger.standard_slots_reserved > 0) {
          this.#replaceLedger(session.ledger_id, { standard_slots_reserved: ledger.standard_slots_reserved - 1 }, `expire_${session.session_id}`);
        }
        this.#replaceSession(session.session_id, { state: 'RELEASED', ended_at: now });
      } else {
        this.#replaceSession(session.session_id, { state: 'CONSUMED', ended_at: now });
      }
    }
  }

  reserve({ ledger_id, scope, session_class = 'STANDARD', idempotency_key, now }) {
    if (!idempotency_key) return deepFreeze({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED' });
    const at = iso(now);
    this.#expireOpenSessions(at);
    const ledger = this.ledgers.get(ledger_id);
    if (!ledger || !sameScope(ledger.scope, scope)) return deepFreeze({ ok: false, code: 'ALLOWANCE_SCOPE_DENIED' });
    if (Date.parse(at) < Date.parse(ledger.billing_cycle_start) || Date.parse(at) >= Date.parse(ledger.billing_cycle_end)) return deepFreeze({ ok: false, code: 'ALLOWANCE_CYCLE_INACTIVE' });
    const idemHash = hashCanonicalJson({ scope, ledger_id, idempotency_key });
    const replayId = this.idempotency.get(idemHash);
    if (replayId) return deepFreeze({ ok: true, code: 'IDEMPOTENT_REPLAY', session: clone(this.sessions.get(replayId)), ledger: clone(this.ledgers.get(ledger_id)) });
    const conflicting = [...this.sessions.values()].find((session) => isOpen(session) && session.scope.business_id === scope.business_id);
    if (conflicting) return deepFreeze({ ok: false, code: 'ACTIVE_SESSION_ALREADY_EXISTS', session_id: conflicting.session_id });
    if (session_class === 'STANDARD' && ledger.standard_slots_available < 1) return deepFreeze({ ok: false, code: 'STANDARD_ALLOWANCE_EXHAUSTED' });
    if (session_class === 'ONBOARDING_INCLUDED' && ledger.onboarding_consumed) return deepFreeze({ ok: false, code: 'ONBOARDING_ALREADY_CONSUMED' });
    if (!['STANDARD', 'ONBOARDING_INCLUDED'].includes(session_class)) return deepFreeze({ ok: false, code: 'SESSION_CLASS_INVALID' });
    const sessionId = `session_${hashCanonicalJson({ ledger_id, scope: scopeFingerprint(scope), idemHash }).slice(0, 24)}`;
    const reservationExpiresAt = plusSeconds(at, this.timingPolicy.reservation_ttl_seconds);
    const session = {
      ...contractHeader('active_coaching_session'),
      session_id: sessionId,
      scope: clone(scope),
      ledger_id,
      session_class,
      state: 'RESERVED',
      idempotency_key_hash: idemHash,
      timing_policy_ref: `${this.timingPolicy.policy_id}@${this.timingPolicy.policy_version}`,
      reserved_at: at,
      reservation_expires_at: reservationExpiresAt,
      activated_at: null,
      grace_expires_at: null,
      hard_expires_at: null,
      ended_at: null,
      cumulative_active_seconds: 0,
      charge_point_reached: false,
      first_valid_response_hash: null,
      state_version: 1,
    };
    const validation = validateSubscriptionV1Contract(session);
    if (!validation.valid) return deepFreeze({ ok: false, code: 'SESSION_CONTRACT_INVALID', errors: validation.errors });
    this.sessions.set(sessionId, clone(session));
    this.idempotency.set(idemHash, sessionId);
    const nextLedger = session_class === 'STANDARD'
      ? this.#replaceLedger(ledger_id, { standard_slots_reserved: ledger.standard_slots_reserved + 1 }, `reserve_${sessionId}`)
      : this.#replaceLedger(ledger_id, {}, `reserve_onboarding_${sessionId}`);
    return deepFreeze({ ok: true, code: 'SESSION_RESERVED', session, ledger: nextLedger });
  }

  activate({ session_id, scope, now }) {
    const at = iso(now);
    this.#expireOpenSessions(at);
    const session = this.sessions.get(session_id);
    if (!session || !sameScope(session.scope, scope)) return deepFreeze({ ok: false, code: 'SESSION_SCOPE_DENIED' });
    if (session.state === 'ACTIVE') return deepFreeze({ ok: true, code: 'IDEMPOTENT_REPLAY', session: clone(session) });
    if (session.state !== 'RESERVED') return deepFreeze({ ok: false, code: 'SESSION_NOT_RESERVABLE' });
    const activated = this.#replaceSession(session_id, {
      state: 'ACTIVE',
      activated_at: at,
      hard_expires_at: this.timingPolicy.active_hard_cap_enforced === true
        ? plusSeconds(at, this.timingPolicy.active_hard_cap_seconds)
        : null,
    });
    return deepFreeze({ ok: true, code: 'SESSION_ACTIVE', session: activated });
  }

  recordFirstValidResponse({ session_id, scope, response_hash, now }) {
    const at = iso(now);
    this.#expireOpenSessions(at);
    const session = this.sessions.get(session_id);
    if (!session || !sameScope(session.scope, scope)) return deepFreeze({ ok: false, code: 'SESSION_SCOPE_DENIED' });
    if (session.charge_point_reached) return deepFreeze({ ok: true, code: 'IDEMPOTENT_REPLAY', session: clone(session), ledger: clone(this.ledgers.get(session.ledger_id)) });
    if (session.state !== 'ACTIVE' || !/^[a-f0-9]{64}$/.test(response_hash || '')) return deepFreeze({ ok: false, code: 'VALID_ACTIVE_RESPONSE_REQUIRED' });
    const ledger = this.ledgers.get(session.ledger_id);
    let ledgerChanges;
    if (session.session_class === 'STANDARD') {
      if (ledger.standard_slots_reserved !== 1 || ledger.standard_slots_consumed >= ledger.standard_slots_total) return deepFreeze({ ok: false, code: 'LEDGER_CHARGE_INVARIANT_FAILED' });
      ledgerChanges = { standard_slots_reserved: 0, standard_slots_consumed: ledger.standard_slots_consumed + 1 };
    } else {
      if (ledger.onboarding_consumed) return deepFreeze({ ok: false, code: 'ONBOARDING_ALREADY_CONSUMED' });
      ledgerChanges = { onboarding_consumed: true };
    }
    const nextLedger = this.#replaceLedger(session.ledger_id, ledgerChanges, `charge_${session_id}`);
    const nextSession = this.#replaceSession(session_id, {
      charge_point_reached: true,
      first_valid_response_hash: response_hash,
    });
    return deepFreeze({ ok: true, code: 'SESSION_ALLOWANCE_CONSUMED_ONCE', charged_at: at, session: nextSession, ledger: nextLedger });
  }

  enterGrace({ session_id, scope, now, cumulative_active_seconds = null }) {
    const at = iso(now);
    const session = this.sessions.get(session_id);
    if (!session || !sameScope(session.scope, scope)) return deepFreeze({ ok: false, code: 'SESSION_SCOPE_DENIED' });
    if (session.state === 'GRACE') return deepFreeze({ ok: true, code: 'IDEMPOTENT_REPLAY', session: clone(session) });
    if (session.state !== 'ACTIVE') return deepFreeze({ ok: false, code: 'ACTIVE_SESSION_REQUIRED' });
    const seconds = cumulative_active_seconds == null ? session.cumulative_active_seconds : cumulative_active_seconds;
    const next = this.#replaceSession(session_id, {
      state: 'GRACE',
      grace_expires_at: plusSeconds(at, this.timingPolicy.reconnect_grace_seconds),
      cumulative_active_seconds: Math.max(session.cumulative_active_seconds, seconds),
    });
    return deepFreeze({ ok: true, code: 'SESSION_GRACE_STARTED', session: next });
  }

  resume({ session_id, scope, now }) {
    const at = iso(now);
    this.#expireOpenSessions(at);
    const session = this.sessions.get(session_id);
    if (!session || !sameScope(session.scope, scope)) return deepFreeze({ ok: false, code: 'SESSION_SCOPE_DENIED' });
    if (session.state === 'ACTIVE') return deepFreeze({ ok: true, code: 'IDEMPOTENT_REPLAY', session: clone(session) });
    if (session.state !== 'GRACE' || Date.parse(at) >= Date.parse(session.grace_expires_at)) return deepFreeze({ ok: false, code: 'SESSION_GRACE_EXPIRED' });
    const next = this.#replaceSession(session_id, { state: 'ACTIVE', grace_expires_at: null });
    return deepFreeze({ ok: true, code: 'SESSION_RESUMED_NO_ADDITIONAL_CHARGE', session: next });
  }

  release({ session_id, scope, now }) {
    const at = iso(now);
    const session = this.sessions.get(session_id);
    if (!session || !sameScope(session.scope, scope)) return deepFreeze({ ok: false, code: 'SESSION_SCOPE_DENIED' });
    if (session.state === 'RELEASED') return deepFreeze({ ok: true, code: 'IDEMPOTENT_REPLAY', session: clone(session), ledger: clone(this.ledgers.get(session.ledger_id)) });
    if (session.charge_point_reached || !['RESERVED', 'ACTIVE', 'GRACE'].includes(session.state)) return deepFreeze({ ok: false, code: 'CHARGED_SESSION_CANNOT_RELEASE' });
    const ledger = this.ledgers.get(session.ledger_id);
    const nextLedger = session.session_class === 'STANDARD' && ledger.standard_slots_reserved > 0
      ? this.#replaceLedger(session.ledger_id, { standard_slots_reserved: ledger.standard_slots_reserved - 1 }, `release_${session_id}`)
      : this.#replaceLedger(session.ledger_id, {}, `release_${session_id}`);
    const nextSession = this.#replaceSession(session_id, { state: 'RELEASED', ended_at: at });
    return deepFreeze({ ok: true, code: 'SESSION_RELEASED_WITHOUT_CHARGE', session: nextSession, ledger: nextLedger });
  }

  complete({ session_id, scope, now, cumulative_active_seconds = null }) {
    const at = iso(now);
    const session = this.sessions.get(session_id);
    if (!session || !sameScope(session.scope, scope)) return deepFreeze({ ok: false, code: 'SESSION_SCOPE_DENIED' });
    if (['CONSUMED', 'RELEASED'].includes(session.state)) return deepFreeze({ ok: true, code: 'IDEMPOTENT_REPLAY', session: clone(session) });
    if (!session.charge_point_reached) return this.release({ session_id, scope, now: at });
    const seconds = cumulative_active_seconds == null ? session.cumulative_active_seconds : cumulative_active_seconds;
    const next = this.#replaceSession(session_id, { state: 'CONSUMED', ended_at: at, cumulative_active_seconds: Math.max(session.cumulative_active_seconds, seconds) });
    return deepFreeze({ ok: true, code: 'SESSION_COMPLETED', session: next, ledger: clone(this.ledgers.get(session.ledger_id)) });
  }

  inspect({ ledger_id, scope, now }) {
    this.#expireOpenSessions(iso(now));
    const ledger = this.ledgers.get(ledger_id);
    if (!ledger || !sameScope(ledger.scope, scope)) return deepFreeze({ ok: false, code: 'ALLOWANCE_SCOPE_DENIED' });
    const sessions = [...this.sessions.values()].filter((session) => session.ledger_id === ledger_id).map(clone);
    return deepFreeze({ ok: true, code: 'VIEW_ONLY_NO_ALLOWANCE_CONSUMPTION', ledger: clone(ledger), sessions });
  }

  snapshot() {
    return deepFreeze({
      timing_policy: clone(this.timingPolicy),
      ledgers: [...this.ledgers.values()].map(clone),
      sessions: [...this.sessions.values()].map(clone),
    });
  }
}
