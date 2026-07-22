const clone = (value) => value == null ? value : structuredClone(value);
export class InMemoryCoachConnectStore {
  constructor(snapshot = {}) { this.invites = new Map(snapshot.invites || []); this.relationships = new Map(snapshot.relationships || []); this.entitlements = new Map(snapshot.entitlements || []); this.sessions = new Map(snapshot.sessions || []); this.judgments = new Map(snapshot.judgments || []); this.confidence = new Map(snapshot.confidence || []); this.promotions = new Map(snapshot.promotions || []); this.events = (snapshot.events || []).map(clone); this.billingEvents = new Map(snapshot.billingEvents || []); }
  save(kind, id, value) { this[kind].set(id, clone(value)); return clone(value); }
  get(kind, id) { return clone(this[kind].get(id)); }
  list(kind) { return [...this[kind].values()].map(clone); }
  appendEvent(event) { this.events.push(clone(event)); return clone(event); }
  snapshot() { return clone({ invites: [...this.invites], relationships: [...this.relationships], entitlements: [...this.entitlements], sessions: [...this.sessions], judgments: [...this.judgments], confidence: [...this.confidence], promotions: [...this.promotions], events: this.events, billingEvents: [...this.billingEvents] }); }
}
