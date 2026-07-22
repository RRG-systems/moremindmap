import { deepFreeze } from '../validation.js';
import { InMemoryProductionDriver } from './inMemoryProductionDriver.js';

export class InMemoryDurableLiveSessionDriver extends InMemoryProductionDriver {
  constructor(snapshot = null) {
    super();
    this.durable = new Map(snapshot?.durable || []);
    if (snapshot?.production) {
      const restored = InMemoryProductionDriver.fromSnapshot(snapshot.production);
      this.scopes = restored.scopes; this.derived = restored.derived; this.quarantines = restored.quarantines; this.recovery = restored.recovery;
    }
  }
  async writeDurable({ key, record, expected_version = 0 }) {
    const prior = this.durable.get(key), actual = prior?.record?.version || 0;
    if (actual !== expected_version) return deepFreeze({ ok: false, status: 'CONCURRENCY_CONFLICT', actual_version: actual });
    this.durable.set(key, { record: structuredClone(record) });
    return deepFreeze({ ok: true, status: 'WRITTEN', version: record.version, integrity_hash: record.integrity_hash });
  }
  async readDurable({ key }) { const found = this.durable.get(key); return deepFreeze(found ? { ok: true, status: 'READ', record: structuredClone(found.record) } : { ok: true, status: 'NOT_FOUND', record: null }); }
  async listDurable({ prefix }) { return deepFreeze({ ok: true, status: 'READ', records: [...this.durable.entries()].filter(([key]) => key.startsWith(prefix)).map(([, item]) => structuredClone(item.record)) }); }
  durableSnapshot() { return deepFreeze([...this.durable.entries()].map(([key, value]) => [key, structuredClone(value)])); }
  completeSnapshot() { return deepFreeze({ production: super.snapshot(), durable: this.durableSnapshot() }); }
  restoreCompleteSnapshot(snapshot) {
    const restored = new InMemoryDurableLiveSessionDriver(snapshot);
    this.scopes = restored.scopes; this.derived = restored.derived; this.quarantines = restored.quarantines; this.recovery = restored.recovery; this.durable = restored.durable;
  }
}
