import { deepFreeze } from '../validation.js';

const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

export class InMemoryCoachAuthStore {
  constructor(snapshot = null) {
    this.actors = new Map(snapshot?.actors || []); this.subjects = new Map(snapshot?.subjects || []);
    this.sessions = new Map(snapshot?.sessions || []); this.contexts = new Map(snapshot?.contexts || []); this.events = [...(snapshot?.events || [])];
  }
  getActor(id) { return clone(this.actors.get(id) || null); }
  getActorBySubject(subject) { const id = this.subjects.get(subject); return id ? this.getActor(id) : null; }
  saveActor(actor) { const existing = this.subjects.get(actor.auth_subject_reference); if (existing && existing !== actor.coach_actor_id) return deepFreeze({ ok: false, code: 'AUTH_SUBJECT_COLLISION' }); this.actors.set(actor.coach_actor_id, clone(actor)); this.subjects.set(actor.auth_subject_reference, actor.coach_actor_id); return deepFreeze({ ok: true }); }
  getSession(id) { return clone(this.sessions.get(id) || null); }
  saveSession(session) { this.sessions.set(session.session_id, clone(session)); return deepFreeze({ ok: true }); }
  sessionsForActor(actorId) { return [...this.sessions.values()].filter((x) => x.coach_actor_id === actorId).map(clone); }
  getContext(id) { return clone(this.contexts.get(id) || null); }
  saveContext(context) { this.contexts.set(context.pending_context_id, clone(context)); return deepFreeze({ ok: true }); }
  appendSecurityEvent(event) { this.events.push(clone(event)); return deepFreeze({ ok: true }); }
  snapshot() { return deepFreeze({ actors: [...this.actors.entries()].map(clone), subjects: [...this.subjects.entries()].map(clone), sessions: [...this.sessions.entries()].map(clone), contexts: [...this.contexts.entries()].map(clone), events: this.events.map(clone) }); }
}
