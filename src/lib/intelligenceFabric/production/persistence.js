import { hashCanonicalJson } from '../hashing.js'; import { validateIntelligenceEvent } from '../intelligenceEvent.js'; import { deepFreeze } from '../validation.js';
import { PRODUCTION_EVENT_SCHEMA_VERSIONS, runtimeStoreKeys } from './contracts.js';

export class ProductionEventStore { async append() { throw new Error('NOT_IMPLEMENTED'); } async read() { throw new Error('NOT_IMPLEMENTED'); } }
export class ProductionProjectionStore { async write() { throw new Error('NOT_IMPLEMENTED'); } async read() { throw new Error('NOT_IMPLEMENTED'); } }
export class ProductionCheckpointStore extends ProductionProjectionStore {}
export class ProductionIdempotencyStore extends ProductionProjectionStore {}

export function buildProductionEventEnvelope(event, { aggregate_sequence, recorded_sequence }) {
  const body = { envelope_version: '1.0.0', event_schema_version: event.schema_version, tenant_id: event.tenant_id, profile_id: event.profile_id,
    business_id: event.business_id, subscription_id: event.subscription_id || null, event_id: event.event_id, event_type: event.event_type,
    aggregate_sequence, recorded_sequence, effective_at: event.effective_at, recorded_at: event.recorded_at, causation_id: event.causation_event_id || null,
    correlation_id: event.correlation_id, actor_type: event.source_actor?.type, privacy_classification: event.privacy_classification,
    payload_hash: event.payload_hash, correction_of_event_id: event.correction_of_event_id || null, supersedes_event_id: event.supersedes_event_id || null, event };
  return deepFreeze({ ...body, envelope_hash: hashCanonicalJson(body) });
}

export function validateProductionEnvelope(envelope) {
  if (!envelope || envelope.envelope_version !== '1.0.0' || !PRODUCTION_EVENT_SCHEMA_VERSIONS.includes(envelope.event_schema_version)) return deepFreeze({ valid: false, code: 'UNSUPPORTED_SCHEMA_VERSION' });
  const body = { ...envelope }; delete body.envelope_hash;
  if (hashCanonicalJson(body) !== envelope.envelope_hash || !validateIntelligenceEvent(envelope.event).valid || envelope.payload_hash !== envelope.event.payload_hash) return deepFreeze({ valid: false, code: 'CORRUPTED_RECORD' });
  return deepFreeze({ valid: true });
}

export class InactiveRedisRuntimeAdapter extends ProductionEventStore {
  constructor({ driver, capability }) { super(); this.driver = driver; this.capability = capability; }
  #active(operation) { return this.capability?.foundation_enabled === true && this.capability?.synthetic_only === true && (operation !== 'WRITE' || this.capability?.writes_enabled === true) && this.capability?.emergency_disabled !== true; }
  async append({ event, expected_sequence, command_id, idempotency_key }) {
    if (!this.#active('WRITE')) return deepFreeze({ ok: false, status: 'INACTIVE' });
    if (!PRODUCTION_EVENT_SCHEMA_VERSIONS.includes(event.schema_version)) return deepFreeze({ ok: false, status: 'UNSUPPORTED_SCHEMA_VERSION' });
    const validation = validateIntelligenceEvent(event); const keys = runtimeStoreKeys(event);
    if (!validation.valid || !keys) return deepFreeze({ ok: false, status: 'INVALID_SCOPE' });
    return deepFreeze(await this.driver.atomicAppend({ keys, event, expected_sequence, command_id, idempotency_key,
      semantic_hash: hashCanonicalJson({ command_id, idempotency_key, event_id: event.event_id, payload_hash: event.payload_hash, effective_at: event.effective_at }), buildEnvelope: buildProductionEventEnvelope }));
  }
  async read(scope) {
    if (!this.#active('READ')) return deepFreeze({ ok: false, status: 'INACTIVE', records: [] });
    const keys = runtimeStoreKeys(scope); if (!keys) return deepFreeze({ ok: false, status: 'INVALID_SCOPE', records: [] });
    const records = await this.driver.readEvents({ keys }); const accepted = [], quarantined = [];
    for (const record of records) { const validation = validateProductionEnvelope(record); (validation.valid ? accepted : quarantined).push(validation.valid ? record : { event_id: record?.event_id || null, reason: validation.code }); }
    if (quarantined.length) await this.driver.quarantine({ keys, records: quarantined });
    return deepFreeze({ ok: true, status: quarantined.length ? 'READ_WITH_QUARANTINE' : 'READ', records: accepted, quarantined });
  }
  async writeDerived({ scope, kind, object_id, value, expected_version }) {
    if (!this.#active('WRITE')) return deepFreeze({ ok: false, status: 'INACTIVE' }); const keys = runtimeStoreKeys(scope);
    if (!keys || !['projection', 'checkpoint', 'idempotency'].includes(kind)) return deepFreeze({ ok: false, status: 'INVALID_SCOPE' });
    return deepFreeze(await this.driver.writeDerived({ key: `${keys[`${kind}_prefix`]}${object_id}`, value, expected_version, value_hash: hashCanonicalJson(value) }));
  }
  async readDerived({ scope, kind, object_id }) { if (!this.#active('READ')) return deepFreeze({ ok: false, status: 'INACTIVE' }); const keys = runtimeStoreKeys(scope); return deepFreeze(await this.driver.readDerived({ key: `${keys?.[`${kind}_prefix`]}${object_id}` })); }
}
