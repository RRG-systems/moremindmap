import test from 'node:test';
import assert from 'node:assert/strict';
import { COACH_CONNECT_PRIVACY_MAP, CONSENT_PURPOSES, DEFAULT_LIVE_SESSION_FLAGS, evaluateLiveSessionActivation, transitionLiveConsent, transitionLiveSession, validateCoachLiveSession, validateLiveSessionAuthority, validateSessionEvent } from '../src/lib/intelligenceFabric/coachConnect/liveSession/index.js';

const at = '2026-07-22T12:00:00.000Z';
const scope = { tenant_id: 'tenant_live', profile_id: 'profile_live', business_id: 'business_live', subscriber_id: 'subscriber_live' };
const base = { subscriber_scope: scope, privacy_class: 'COACH_SHARED', schema_version: '1.0.0', policy_version: 'policy_live_v1' };
const session = { ...base, session_id: 'session_live_1', coach_id: 'coach_live', relationship_id: 'relationship_live', entitlement_id: 'entitlement_live', business_engine_id: 'engine_live', status: 'CREATED', created_at: at, created_by: 'subscriber_live', idempotency_key: 'create_live_1', version: 1, canonical_mutation_authority: false };

test('live session contract requires exact scope and rejects coach canonical authority', () => {
  assert.equal(validateCoachLiveSession(session).valid, true);
  assert.equal(validateCoachLiveSession({ ...session, canonical_mutation_authority: true }).valid, false);
  assert.equal(validateCoachLiveSession({ ...session, subscriber_scope: { ...scope, tenant_id: '' } }).valid, false);
});

test('authority requires every granular consent and never grants canonical mutation', () => {
  const consent = Object.fromEntries(CONSENT_PURPOSES.map((purpose) => [purpose, purpose === 'RECORDING' ? 'RESTRICTED' : 'GRANTED']));
  const authority = { ...base, authority_id: 'authority_live', session_id: session.session_id, relationship_id: session.relationship_id, entitlement_id: session.entitlement_id, authorized_participants: ['subscriber_live', 'coach_live'], consent, issued_at: at, expires_at: '2026-07-22T13:00:00.000Z', grants_canonical_mutation: false };
  assert.equal(validateLiveSessionAuthority(authority).valid, true);
  const incomplete = { ...authority, consent: { ...consent } }; delete incomplete.consent.FUTURE_LEARNING;
  assert.equal(validateLiveSessionAuthority(incomplete).valid, false);
  assert.equal(validateLiveSessionAuthority({ ...authority, grants_canonical_mutation: true }).valid, false);
});

test('session event rejects raw provider payload and requires monotonic position', () => {
  const event = { ...base, event_id: 'event_live_1', session_id: session.session_id, sequence_number: 1, event_type: 'PARTICIPANT_CONNECTED', actor_id: 'coach_live', actor_role: 'COACH', occurred_at: at, received_at: at, payload_reference: 'payload_hash_live', causation_id: null, correlation_id: 'correlation_live', idempotency_key: 'event_key_live' };
  assert.equal(validateSessionEvent(event).valid, true);
  assert.equal(validateSessionEvent({ ...event, provider_payload: { secret: true } }).valid, false);
  assert.equal(validateSessionEvent({ ...event, sequence_number: 0 }).valid, false);
});

test('state machines deny skipped authority and consent transitions', () => {
  assert.equal(transitionLiveSession('CREATED', 'CONNECT').ok, false);
  assert.equal(transitionLiveSession('CREATED', 'AUTHORIZE').current, 'AUTHORIZING');
  assert.equal(transitionLiveSession('AUTHORIZING', 'AUTHORIZE_SUCCESS').current, 'READY');
  assert.equal(transitionLiveSession('CLOSED', 'CONNECT').ok, false);
  assert.equal(transitionLiveConsent('UNKNOWN', 'GRANT').ok, false);
  assert.equal(transitionLiveConsent('UNKNOWN', 'REQUEST').current, 'REQUESTED');
  assert.equal(transitionLiveConsent('GRANTED', 'REVOKE').current, 'REVOKED');
  assert.equal(transitionLiveConsent('REVOKED', 'GRANT').ok, false);
});

test('activation is parent-gated default-off and synthetic-only', () => {
  assert.equal(evaluateLiveSessionActivation({ capability: 'SESSION' }).code, 'EMERGENCY_DISABLED');
  const enabled = { ...DEFAULT_LIVE_SESSION_FLAGS, emergency_disabled: false, live_session_enabled: true, session_establishment_enabled: true };
  assert.equal(evaluateLiveSessionActivation({ flags: enabled, parentDecision: { allowed: false }, capability: 'SESSION' }).code, 'PARENT_AUTHORITY_DISABLED');
  assert.equal(evaluateLiveSessionActivation({ flags: enabled, parentDecision: { allowed: true }, capability: 'SESSION' }).allowed, true);
  assert.equal(evaluateLiveSessionActivation({ flags: { ...enabled, production_traffic_enabled: true }, parentDecision: { allowed: true }, capability: 'SESSION' }).code, 'PRODUCTION_ACTIVATION_DENIED');
  assert.equal(Object.keys(COACH_CONNECT_PRIVACY_MAP).length, 7);
});
