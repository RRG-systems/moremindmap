import { hashCanonicalJson } from '../hashing.js';
import { validateIntelligenceEvent } from '../intelligenceEvent.js';
import { deepFreeze } from '../validation.js';
import { validateDurableObject, DURABLE_CONTRACT_REGISTRY } from '../durableCore.js';
import { validateVersionTransition } from '../durableCoreInvariants.js';
import { IntelligenceEventStore, DurableObjectVersionStore, makeAppendResult, makeBitemporalQuery, validateAggregateKey } from '../runtime/persistence.js';

const cloneFreeze = (value) => deepFreeze(JSON.parse(JSON.stringify(value)));
const aggregateString = (key) => `${key.tenant_id}:${key.aggregate_type}:${key.aggregate_id}`;
const semanticEventHash = (event) => hashCanonicalJson({ event_type: event.event_type, tenant_id: event.tenant_id,
  profile_id: event.profile_id, business_id: event.business_id, subscription_id: event.subscription_id,
  payload_hash: event.payload_hash, effective_at: event.effective_at, authority_type: event.authority_type,
  truth_class: event.truth_class, privacy_classification: event.privacy_classification,
  consent_scope: event.consent_scope, correction_of_event_id: event.correction_of_event_id,
  supersedes_event_id: event.supersedes_event_id });

export class InMemoryIntelligenceEventStore extends IntelligenceEventStore {
  #events = []; #byId = new Map(); #byIdempotency = new Map(); #aggregateSequences = new Map();

  append({ event, aggregate_key, expected_aggregate_sequence = null }) {
    const validEvent = validateIntelligenceEvent(event); const validKey = validateAggregateKey(aggregate_key);
    if (!validEvent.valid || !validKey.valid) return makeAppendResult('INVALID', { event_id: event?.event_id, errors: [...validEvent.errors, ...validKey.errors] });
    if (event.tenant_id !== aggregate_key.tenant_id) return makeAppendResult('SCOPE_DENIED', { event_id: event.event_id });
    const agg = aggregateString(aggregate_key), currentSequence = this.#aggregateSequences.get(agg) || 0;
    if (expected_aggregate_sequence != null && expected_aggregate_sequence !== currentSequence) return makeAppendResult('CONCURRENCY_CONFLICT', { event_id: event.event_id, aggregate_sequence: currentSequence });
    const existingId = this.#byId.get(event.event_id);
    if (existingId) return makeAppendResult(existingId.semantic_hash === semanticEventHash(event) ? 'IDEMPOTENT_REPLAY' : 'IDENTITY_CONFLICT', { event_id: event.event_id, existing_event_id: existingId.event.event_id, store_sequence: existingId.store_sequence, aggregate_sequence: existingId.aggregate_sequence });
    const idemKey = `${event.tenant_id}:${event.event_type}:${event.idempotency_key}`, existingIdem = this.#byIdempotency.get(idemKey);
    if (existingIdem) return makeAppendResult(existingIdem.semantic_hash === semanticEventHash(event) ? 'IDEMPOTENT_REPLAY' : 'IDEMPOTENCY_CONFLICT', { event_id: event.event_id, existing_event_id: existingIdem.event.event_id, store_sequence: existingIdem.store_sequence, aggregate_sequence: existingIdem.aggregate_sequence });
    for (const field of ['correction_of_event_id', 'supersedes_event_id']) if (event[field]) {
      const target = this.#byId.get(event[field]);
      if (!target || target.event.tenant_id !== event.tenant_id || target.aggregate_key !== agg || target.store_sequence >= this.#events.length + 1) return makeAppendResult('REFERENCE_CONFLICT', { event_id: event.event_id });
    }
    const stored = cloneFreeze({ event, aggregate_key: agg, aggregate_sequence: currentSequence + 1,
      store_sequence: this.#events.length + 1, stored_at: event.recorded_at,
      semantic_hash: semanticEventHash(event), envelope_hash: hashCanonicalJson({ event, aggregate_key: agg, aggregate_sequence: currentSequence + 1, store_sequence: this.#events.length + 1 }) });
    this.#events.push(stored); this.#byId.set(event.event_id, stored); this.#byIdempotency.set(idemKey, stored); this.#aggregateSequences.set(agg, currentSequence + 1);
    return makeAppendResult('APPENDED', { event_id: event.event_id, store_sequence: stored.store_sequence, aggregate_sequence: stored.aggregate_sequence });
  }

  read({ tenant_id, profile_id = null, business_id = null, subscription_id = null, through_sequence = Number.MAX_SAFE_INTEGER } = {}) {
    if (!tenant_id) return deepFreeze({ ok: false, status: 'SCOPE_DENIED', events: [], cursor: null });
    const events = this.#events.filter((x) => x.event.tenant_id === tenant_id && x.store_sequence <= through_sequence
      && (!profile_id || x.event.profile_id === profile_id) && (!business_id || x.event.business_id === business_id)
      && (!subscription_id || x.event.subscription_id === subscription_id)).map(cloneFreeze);
    return deepFreeze({ ok: true, status: 'READ', events, cursor: { version: 1, tenant_id, last_store_sequence: events.at(-1)?.store_sequence || 0 } });
  }

  queryBitemporal(query) {
    const parsed = makeBitemporalQuery(query); if (!parsed.valid) return deepFreeze({ ok: false, errors: parsed.errors, events: [] });
    const q = parsed.normalized_value;
    const events = this.read({ tenant_id: q.tenant_id, profile_id: q.profile_id, business_id: q.business_id,
      subscription_id: q.subscription_id, through_sequence: q.recorded_through_sequence }).events
      .filter((x) => (!q.effective_from || x.event.effective_at >= q.effective_from) && (!q.effective_to || x.event.effective_at < q.effective_to))
      .sort((a, b) => a.event.effective_at.localeCompare(b.event.effective_at) || a.store_sequence - b.store_sequence);
    return deepFreeze({ ok: true, status: 'READ', events: events.map(cloneFreeze), query: q });
  }

  metadataSummary() { return deepFreeze(this.#events.map((x) => ({ event_id: x.event.event_id, event_type: x.event.event_type,
    tenant_id: x.event.tenant_id, store_sequence: x.store_sequence, aggregate_sequence: x.aggregate_sequence,
    effective_at: x.event.effective_at, recorded_at: x.event.recorded_at, envelope_hash: x.envelope_hash }))); }
  resetForTestOnly() { this.#events = []; this.#byId.clear(); this.#byIdempotency.clear(); this.#aggregateSequences.clear(); }
}

export class InMemoryDurableObjectVersionStore extends DurableObjectVersionStore {
  #versions = []; #keys = new Map();
  appendVersion({ object, logical_object_id, version_id, expected_latest_version = null }) {
    const registry = DURABLE_CONTRACT_REGISTRY[object?.object_type];
    if (!registry || !logical_object_id || !version_id) return deepFreeze({ ok: false, status: 'INVALID' });
    const validated = validateDurableObject(object, object.object_type); if (!validated.valid) return deepFreeze({ ok: false, status: 'INVALID', errors: validated.errors });
    const key = `${object.tenant_id}:${object.object_type}:${logical_object_id}`, prior = this.#keys.get(key) || [];
    if (expected_latest_version != null && (prior.at(-1)?.version || 0) !== expected_latest_version) return deepFreeze({ ok: false, status: 'CONCURRENCY_CONFLICT' });
    if (this.#versions.some((x) => x.version_id === version_id) || prior.some((x) => x.version === object.version)) return deepFreeze({ ok: false, status: 'IDENTITY_CONFLICT' });
    if (prior.length && !validateVersionTransition(prior.at(-1).object, object).valid) return deepFreeze({ ok: false, status: 'VERSION_CONFLICT' });
    const wrapper = cloneFreeze({ tenant_id: object.tenant_id, object_type: object.object_type, logical_object_id,
      version_id, version: object.version, previous_version_id: object.previous_version_id,
      source_event_ids: object.source_event_ids, effective_at: object.effective_at,
      store_sequence: this.#versions.length + 1, object_hash: hashCanonicalJson(object), object });
    this.#versions.push(wrapper); this.#keys.set(key, [...prior, wrapper]);
    return deepFreeze({ ok: true, status: 'APPENDED', version_id, store_sequence: wrapper.store_sequence, object_hash: wrapper.object_hash });
  }
  readVersions({ tenant_id, object_type, logical_object_id }) {
    if (!tenant_id) return deepFreeze({ ok: false, status: 'SCOPE_DENIED', versions: [] });
    const key = `${tenant_id}:${object_type}:${logical_object_id}`;
    return deepFreeze({ ok: true, status: 'READ', versions: (this.#keys.get(key) || []).map(cloneFreeze) });
  }
  resetForTestOnly() { this.#versions = []; this.#keys.clear(); }
}

export function createInMemoryRuntimeStoresForTest() {
  return Object.freeze({ events: new InMemoryIntelligenceEventStore(), versions: new InMemoryDurableObjectVersionStore() });
}
