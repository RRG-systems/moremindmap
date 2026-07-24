import { deepFreeze } from '../../../validation.js';
import { InactiveRedisRuntimeAdapter } from '../../../production/persistence.js';
import { buildDurableRecord, durableScopeKey, validateDurableRecord } from './contracts.js';

export const DEFAULT_DURABLE_LIVE_SESSION_FLAGS = deepFreeze({
  foundation_enabled: false, synthetic_only: true, writes_enabled: false, emergency_disabled: true,
});

export class DurableLiveSessionAdapter {
  constructor({ driver, capability = DEFAULT_DURABLE_LIVE_SESSION_FLAGS, clock = () => new Date().toISOString(), deletionEpochProvider = () => 0 }) {
    if (!driver) throw new TypeError('driver is required');
    if (typeof deletionEpochProvider !== 'function') throw new TypeError('deletionEpochProvider must be a function');
    this.driver = driver; this.capability = capability; this.clock = clock; this.deletionEpochProvider = deletionEpochProvider;
    this.productionEvents = new InactiveRedisRuntimeAdapter({ driver, capability });
  }
  active(write = false) { return this.capability.foundation_enabled === true && this.capability.synthetic_only === true && this.capability.emergency_disabled === false && (!write || this.capability.writes_enabled === true); }
  currentDeletionEpoch(scope) {
    const epoch = this.deletionEpochProvider(scope);
    return Number.isInteger(epoch) && epoch >= 0 ? epoch : null;
  }
  async append(input) { return this.productionEvents.append(input); }
  async read(scope) { return this.productionEvents.read(scope); }
  async write({ kind, object_id, scope, value, expected_version = 0, correlation_id, causation_id = null, privacy_classification }) {
    if (!this.active(true)) return deepFreeze({ ok: false, status: 'INACTIVE' });
    const deletion_epoch = this.currentDeletionEpoch(scope);
    if (deletion_epoch == null) return deepFreeze({ ok: false, status: 'DELETION_REQUIRED' });
    const record = buildDurableRecord({ kind, object_id, scope, value, version: expected_version + 1, correlation_id, causation_id, recorded_at: this.clock(), privacy_classification, deletion_epoch });
    if (!record) return deepFreeze({ ok: false, status: 'INVALID_SCOPE' });
    return deepFreeze(await this.driver.writeDurable({ key: `${durableScopeKey(scope)}:${kind}:${object_id}`, record, expected_version }));
  }
  async readObject({ kind, object_id, scope }) {
    if (!this.active()) return deepFreeze({ ok: false, status: 'INACTIVE' });
    const result = await this.driver.readDurable({ key: `${durableScopeKey(scope)}:${kind}:${object_id}` });
    if (!result.ok || result.status === 'NOT_FOUND') return deepFreeze(result);
    const validation = validateDurableRecord(result.record);
    if (!validation.valid) return deepFreeze({ ok: false, status: validation.code });
    const deletion_epoch = this.currentDeletionEpoch(scope);
    if (deletion_epoch == null || result.record.deletion_epoch < deletion_epoch) return deepFreeze({ ok: false, status: 'RETENTION_EXPIRED', code: 'DELETION_REQUIRED', current_deletion_epoch: deletion_epoch });
    return deepFreeze(result);
  }
  async list({ kind, scope }) {
    if (!this.active()) return deepFreeze({ ok: false, status: 'INACTIVE', records: [] });
    const result = await this.driver.listDurable({ prefix: `${durableScopeKey(scope)}:${kind}:` });
    if (!result.ok) return deepFreeze(result);
    const deletion_epoch = this.currentDeletionEpoch(scope);
    if (deletion_epoch == null) return deepFreeze({ ok: false, status: 'DELETION_REQUIRED', records: [] });
    const records = result.records.filter((record) => validateDurableRecord(record).valid && record.deletion_epoch >= deletion_epoch);
    return deepFreeze({ ...result, records, denied_expired_count: result.records.length - records.length, current_deletion_epoch: deletion_epoch });
  }
}
