import { deepFreeze } from '../../validation.js';

export class MediaProviderPort {
  createSession() { throw new Error('MediaProviderPort.createSession must be implemented'); }
  normalizeEvent() { throw new Error('MediaProviderPort.normalizeEvent must be implemented'); }
  teardown() { throw new Error('MediaProviderPort.teardown must be implemented'); }
}

export class SyntheticMediaProvider extends MediaProviderPort {
  constructor({ clock = () => new Date().toISOString() } = {}) { super(); this.clock = clock; this.sessions = new Map(); }
  createSession({ session_id, participants }) { const value = { provider_reference: `synthetic_provider_${session_id}`, session_id, participants: [...participants], media_state: 'INITIALIZING', synthetic: true, access_token: null }; this.sessions.set(session_id, value); return deepFreeze({ ok: true, value }); }
  normalizeEvent({ session_id, type, actor_id, actor_role, payload_reference, occurred_at = this.clock() }) { if (!this.sessions.has(session_id)) return deepFreeze({ ok: false, code: 'PROVIDER_SESSION_NOT_FOUND' }); return deepFreeze({ ok: true, event: { event_type: type, actor_id, actor_role, occurred_at, payload_reference, provider_reference: this.sessions.get(session_id).provider_reference } }); }
  setMediaState(session_id, media_state) { const prior = this.sessions.get(session_id); if (!prior) return deepFreeze({ ok: false, code: 'PROVIDER_SESSION_NOT_FOUND' }); const next = { ...prior, media_state }; this.sessions.set(session_id, next); return deepFreeze({ ok: true, value: next }); }
  teardown({ session_id }) { const prior = this.sessions.get(session_id); if (!prior) return deepFreeze({ ok: false, code: 'PROVIDER_SESSION_NOT_FOUND' }); const next = { ...prior, media_state: 'STOPPED' }; this.sessions.set(session_id, next); return deepFreeze({ ok: true, value: next }); }
}
