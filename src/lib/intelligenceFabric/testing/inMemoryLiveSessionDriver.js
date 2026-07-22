import { hashCanonicalJson } from '../hashing.js';
import { deepFreeze } from '../validation.js';

export class InMemoryLiveSessionDriver {
  constructor(snapshot = null) {
    this.sessions = new Map(snapshot?.sessions || []); this.authorities = new Map(snapshot?.authorities || []); this.events = new Map(snapshot?.events || []);
    this.transcripts = new Map(snapshot?.transcripts || []); this.artifacts = new Map(snapshot?.artifacts || []); this.reviews = new Map(snapshot?.reviews || []);
    this.proposals = new Map(snapshot?.proposals || []); this.confirmations = new Map(snapshot?.confirmations || []); this.refreshes = new Map(snapshot?.refreshes || []);
    this.commands = new Map(snapshot?.commands || []); this.checkpoints = new Map(snapshot?.checkpoints || []); this.failures = new Map(snapshot?.failures || []);
  }
  get(collection, id) { return structuredClone(this[collection]?.get(id) || null); }
  list(collection) { return [...(this[collection]?.values() || [])].map((value) => structuredClone(value)); }
  save(collection, id, value) { this[collection].set(id, structuredClone(value)); return deepFreeze(structuredClone(value)); }
  command(key, semantic, resultFactory) {
    const hash = hashCanonicalJson(semantic), prior = this.commands.get(key);
    if (prior) return deepFreeze(prior.hash === hash ? { ok: true, status: 'IDEMPOTENT_REPLAY', value: structuredClone(prior.value) } : { ok: false, status: 'IDEMPOTENCY_CONFLICT' });
    const value = resultFactory();
    if (value?.ok === true) this.commands.set(key, { hash, value: structuredClone(value) });
    return deepFreeze({ ok: true, status: 'APPLIED', value: structuredClone(value) });
  }
  snapshot() { return deepFreeze(Object.fromEntries(['sessions', 'authorities', 'events', 'transcripts', 'artifacts', 'reviews', 'proposals', 'confirmations', 'refreshes', 'commands', 'checkpoints', 'failures'].map((name) => [name, [...this[name].entries()].map(([key, value]) => [key, structuredClone(value)])]))); }
  stateHash() { return hashCanonicalJson(this.snapshot()); }
}
