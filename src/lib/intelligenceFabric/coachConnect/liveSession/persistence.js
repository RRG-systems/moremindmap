import { deepFreeze } from '../../validation.js';
import { liveSessionSemanticHash, validateSessionEvent } from './contracts.js';

export class LiveSessionEventStore {
  append() { throw new Error('LiveSessionEventStore.append must be implemented'); }
  read() { throw new Error('LiveSessionEventStore.read must be implemented'); }
  checkpoint() { throw new Error('LiveSessionEventStore.checkpoint must be implemented'); }
}

export class InjectedLiveSessionEventStore extends LiveSessionEventStore {
  constructor({ driver }) { super(); if (!driver) throw new TypeError('driver is required'); this.driver = driver; }
  append({ event, expected_sequence }) {
    const validation = validateSessionEvent(event); if (!validation.valid) return deepFreeze({ ok: false, status: 'INVALID', errors: validation.errors });
    const events = this.driver.list('events').filter((item) => item.session_id === event.session_id).sort((a, b) => a.sequence_number - b.sequence_number);
    const duplicate = events.find((item) => item.event_id === event.event_id || item.idempotency_key === event.idempotency_key);
    if (duplicate) return deepFreeze(liveSessionSemanticHash(duplicate) === liveSessionSemanticHash(event) ? { ok: true, status: 'IDEMPOTENT_REPLAY', event: duplicate } : { ok: false, status: 'IDEMPOTENCY_CONFLICT' });
    const current = events.at(-1)?.sequence_number || 0;
    if (expected_sequence !== current || event.sequence_number !== current + 1) return deepFreeze({ ok: false, status: event.sequence_number > current + 1 ? 'SEQUENCE_GAP' : 'CONCURRENCY_CONFLICT', current_sequence: current });
    this.driver.save('events', event.event_id, event); return deepFreeze({ ok: true, status: 'APPENDED', event });
  }
  read({ session_id }) { return deepFreeze(this.driver.list('events').filter((event) => event.session_id === session_id).sort((a, b) => a.sequence_number - b.sequence_number)); }
  checkpoint({ session_id, sequence_number, state_hash }) { const prior = this.driver.get('checkpoints', session_id); if (prior && sequence_number < prior.sequence_number) return deepFreeze({ ok: false, status: 'STALE_CHECKPOINT' }); const value = { session_id, sequence_number, state_hash }; this.driver.save('checkpoints', session_id, value); return deepFreeze({ ok: true, status: 'CHECKPOINTED', checkpoint: value }); }
}
