import { deepFreeze } from '../validation.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
export class InMemoryProductionDriver {
  constructor() { this.scopes = new Map(); this.derived = new Map(); this.quarantines = new Map(); this.recovery = []; }
  #scope(root) { if (!this.scopes.has(root)) this.scopes.set(root, { sequence: 0, records: [], eventIds: new Map(), idempotency: new Map() }); return this.scopes.get(root); }
  async atomicAppend({ keys, event, expected_sequence, command_id, idempotency_key, semantic_hash, buildEnvelope }) {
    const state = this.#scope(keys.root), idem = state.idempotency.get(idempotency_key), existing = state.eventIds.get(event.event_id);
    if (idem) return deepFreeze(idem.semantic_hash === semantic_hash ? { ok: true, status: 'IDEMPOTENT_REPLAY', event_id: idem.event_id, aggregate_sequence: idem.sequence } : { ok: false, status: 'IDEMPOTENCY_CONFLICT' });
    if (existing) return deepFreeze({ ok: false, status: 'IDENTITY_CONFLICT' });
    if (expected_sequence !== state.sequence) return deepFreeze({ ok: false, status: 'CONCURRENCY_CONFLICT', expected_sequence, actual_sequence: state.sequence });
    for (const field of ['correction_of_event_id', 'supersedes_event_id']) if (event[field] && !state.eventIds.has(event[field])) return deepFreeze({ ok: false, status: 'REFERENCE_CONFLICT' });
    const sequence = state.sequence + 1, envelope = buildEnvelope(event, { aggregate_sequence: sequence, recorded_sequence: sequence });
    state.sequence = sequence; state.records.push(clone(envelope)); state.eventIds.set(event.event_id, envelope); state.idempotency.set(idempotency_key, { semantic_hash, event_id: event.event_id, sequence, command_id });
    return deepFreeze({ ok: true, status: 'APPENDED', event_id: event.event_id, aggregate_sequence: sequence, envelope_hash: envelope.envelope_hash });
  }
  async readEvents({ keys }) { return clone(this.#scope(keys.root).records); }
  async writeDerived({ key, value, expected_version, value_hash }) { const prior = this.derived.get(key), version = (prior?.version || 0) + 1; if ((expected_version ?? prior?.version ?? 0) !== (prior?.version || 0)) return deepFreeze({ ok: false, status: 'CONCURRENCY_CONFLICT' }); this.derived.set(key, { version, value: clone(value), value_hash }); return deepFreeze({ ok: true, status: 'WRITTEN', version, value_hash }); }
  async readDerived({ key }) { const value = this.derived.get(key); return deepFreeze(value ? { ok: true, status: 'READ', ...clone(value) } : { ok: true, status: 'NOT_FOUND', value: null }); }
  async quarantine({ keys, records }) { this.quarantines.set(keys.quarantine, [...(this.quarantines.get(keys.quarantine) || []), ...clone(records)]); return { ok: true }; }
  recordRecovery(entry) { this.recovery.push(clone(entry)); }
  snapshot() { return clone({ scopes: [...this.scopes.entries()].map(([key, state]) => [key, { ...state, eventIds: [...state.eventIds.entries()], idempotency: [...state.idempotency.entries()] }]), derived: [...this.derived.entries()], quarantines: [...this.quarantines.entries()], recovery: this.recovery }); }
  static fromSnapshot(snapshot) { const driver = new InMemoryProductionDriver(); driver.scopes = new Map(snapshot.scopes); driver.derived = new Map(snapshot.derived); driver.quarantines = new Map(snapshot.quarantines); driver.recovery = snapshot.recovery; for (const state of driver.scopes.values()) { state.eventIds = new Map(state.eventIds); state.idempotency = new Map(state.idempotency); } return driver; }
}
