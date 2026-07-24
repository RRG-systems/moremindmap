import { deepFreeze } from '../../validation.js';
import { evaluateLiveSessionActivation } from './constants.js';
import { liveSessionSemanticHash, validateCoachLiveSession, validateLiveSessionAuthority, validateLiveSessionConsentRecord } from './contracts.js';
import { transitionLiveSession } from './stateMachines.js';
import { buildTranscriptArtifact, extractStructuredCandidates } from './extraction.js';
import { queueArtifactForReview, reviewArtifact } from './review.js';
import { buildBusinessEngineProposal, buildConfidenceRealityUpdate, createSubscriberConfirmation, evaluateBusinessEngineProposal, promoteConfirmedProposal, respondToConfirmation } from './businessEngine.js';
import { refreshLiveSessionProjections } from './projections.js';
import { recordLiveSessionFailure, recoverLiveSession } from './recovery.js';
import { SECURITY_ACTIONS } from '../security/constants.js';

const frozen = (value) => deepFreeze(structuredClone(value));
const deny = (code, details = {}) => frozen({ ok: false, code, ...details });
const grantedForProcessing = (authority, purpose) => authority?.consent?.[purpose] === 'GRANTED';

export function createLiveSessionService({ driver, eventStore, provider, flags, parentActivation = () => ({ allowed: false }), authorityEvaluator, canonicalAppend = null, clock = () => new Date().toISOString() }) {
  if (!driver || !eventStore || !provider || typeof authorityEvaluator !== 'function') throw new TypeError('driver eventStore provider and authorityEvaluator are required');
  const gate = (capability) => evaluateLiveSessionActivation({ flags, parentDecision: parentActivation(capability), capability });
  const active = (capability) => { const decision = gate(capability); return decision.allowed ? null : deny(decision.code); };
  const authority = (session, action) => {
    const record = driver.get('authorities', session.authority_id); if (!record) return deny('AUTHORITY_NOT_FOUND');
    if (Date.parse(record.expires_at) <= Date.parse(clock())) return deny('AUTHORITY_EXPIRED');
    const decision = authorityEvaluator({ session, authority: record, action }); return decision?.allowed === true ? frozen({ ok: true, authority: record, decision }) : deny(decision?.reason_code || 'AUTHORITY_DENIED');
  };
  const move = (session, action) => { const moved = transitionLiveSession(session.status, action); if (!moved.ok) return deny(moved.code); const updated = { ...session, status: moved.current, version: session.version + 1, updated_at: clock(), ended_at: moved.current === 'CLOSED' ? clock() : session.ended_at }; driver.save('sessions', session.session_id, updated); return frozen({ ok: true, session: updated }); };

  function createSession(input) {
    const blocked = active('SESSION'); if (blocked) return blocked;
    const command = driver.command(`create:${input.idempotency_key}`, input, () => {
      const now = clock(), session_id = `live_session_${liveSessionSemanticHash({ key: input.idempotency_key, scope: input.subscriber_scope }).slice(0, 24)}`;
      const session = { session_id, subscriber_scope: input.subscriber_scope, coach_id: input.coach_id, relationship_id: input.relationship_id, entitlement_id: input.entitlement_id, business_engine_id: input.business_engine_id, status: 'CREATED', created_at: now, started_at: null, ended_at: null, created_by: input.created_by, policy_version: input.policy_version, privacy_class: input.privacy_class || 'COACH_SHARED', idempotency_key: input.idempotency_key, version: 1, schema_version: '1.0.0', canonical_mutation_authority: false, authority_id: null, unresolved_items: [] };
      const validation = validateCoachLiveSession(session); return validation.valid ? { ok: true, session } : { ok: false, code: 'INVALID_LIVE_SESSION', errors: validation.errors };
    });
    if (!command.ok) return deny(command.status); if (!command.value.ok) return frozen(command.value);
    const stored = driver.get('sessions', command.value.session.session_id); if (!stored) driver.save('sessions', command.value.session.session_id, command.value.session);
    return frozen({ ok: true, status: command.status === 'IDEMPOTENT_REPLAY' ? 'IDEMPOTENT_REPLAY' : 'CREATED', session: stored || command.value.session });
  }

  function authorizeSession({ session_id, authorized_participants, consent, retention_policy, provider_permissions, authority_ttl_ms = 3_600_000 }) {
    const blocked = active('SESSION'); if (blocked) return blocked; let session = driver.get('sessions', session_id); if (!session) return deny('SESSION_NOT_FOUND');
    const moved = move(session, 'AUTHORIZE'); if (!moved.ok) return moved; session = moved.session;
    const preliminary = authorityEvaluator({ session, authority: null, action: 'AUTHORIZE' }); if (preliminary?.allowed !== true) { move(session, 'AUTHORIZE_FAIL'); return deny(preliminary?.reason_code || 'AUTHORITY_DENIED'); }
    const now = clock(), record = { authority_id: `live_authority_${liveSessionSemanticHash({ session_id, issued_at: now }).slice(0, 24)}`, session_id, relationship_id: session.relationship_id, entitlement_id: session.entitlement_id, authorized_participants, subscriber_data_scope: session.subscriber_scope, coach_data_scope: session.subscriber_scope, consent, transcription_allowed: consent.TRANSCRIPTION === 'GRANTED', recording_allowed: consent.RECORDING === 'GRANTED', retention_policy, confirmation_policy: 'FAIL_CLOSED_REQUIRE_SUBSCRIBER', provider_permissions, issued_at: now, expires_at: new Date(Date.parse(now) + authority_ttl_ms).toISOString(), policy_version: session.policy_version, subscriber_scope: session.subscriber_scope, privacy_class: session.privacy_class, schema_version: '1.0.0', grants_canonical_mutation: false };
    const validation = validateLiveSessionAuthority(record); if (!validation.valid) { move(session, 'CONSENT_FAIL'); return deny('INVALID_LIVE_SESSION_AUTHORITY', { errors: validation.errors }); }
    if (consent.PARTICIPATION !== 'GRANTED') { move(session, 'CONSENT_FAIL'); return deny('PARTICIPATION_CONSENT_REQUIRED'); }
    driver.save('authorities', record.authority_id, record); session = { ...session, authority_id: record.authority_id, version: session.version + 1 }; driver.save('sessions', session_id, session); const ready = move(session, 'AUTHORIZE_SUCCESS'); return frozen({ ok: true, session: ready.session, authority: record });
  }

  function connect({ session_id }) {
    const blocked = active('PROVIDER'); if (blocked) return blocked; let session = driver.get('sessions', session_id); if (!session) return deny('SESSION_NOT_FOUND'); const auth = authority(session, 'CONNECT'); if (!auth.ok) return auth;
    const connecting = move(session, 'CONNECT'); if (!connecting.ok) return connecting; session = connecting.session;
    const made = provider.createSession({ session_id, participants: auth.authority.authorized_participants }); if (!made.ok) { move(session, 'FAIL'); return made; }
    const connected = move(session, 'CONNECTED'); if (!connected.ok) return connected; session = { ...connected.session, provider_reference: made.value.provider_reference, media_state: 'ACTIVE', started_at: clock() }; driver.save('sessions', session_id, session); provider.setMediaState(session_id, 'ACTIVE'); return frozen({ ok: true, session, provider: made.value });
  }

  function ingestProviderEvent({ session_id, type, actor_id, actor_role, payload_reference, idempotency_key, expected_sequence, occurred_at }) {
    const blocked = active('PROVIDER'); if (blocked) return blocked; const session = driver.get('sessions', session_id); if (!session) return deny('SESSION_NOT_FOUND'); const auth = authority(session, 'INGEST_EVENT'); if (!auth.ok) return auth;
    const normalized = provider.normalizeEvent({ session_id, type, actor_id, actor_role, payload_reference, occurred_at }); if (!normalized.ok) return normalized;
    const event = { event_id: `session_event_${liveSessionSemanticHash({ session_id, idempotency_key }).slice(0, 24)}`, session_id, sequence_number: expected_sequence + 1, event_type: normalized.event.event_type, actor_id, actor_role, occurred_at: normalized.event.occurred_at, received_at: clock(), payload_reference, causation_id: null, correlation_id: session_id, idempotency_key, privacy_class: session.privacy_class, subscriber_scope: session.subscriber_scope, schema_version: '1.0.0', policy_version: session.policy_version };
    return eventStore.append({ event, expected_sequence });
  }

  function captureTranscript(input) {
    const blocked = active('TRANSCRIPTION'); if (blocked) return blocked; const session = driver.get('sessions', input.session_id); if (!session) return deny('SESSION_NOT_FOUND'); const auth = authority(session, 'TRANSCRIPTION'); if (!auth.ok) return auth; if (!grantedForProcessing(auth.authority, 'TRANSCRIPTION')) return deny('TRANSCRIPTION_CONSENT_REQUIRED');
    const built = buildTranscriptArtifact({ ...input, subscriber_scope: session.subscriber_scope, policy_version: session.policy_version, provider_reference: session.provider_reference, created_at: input.created_at || clock() }); if (built.ok) driver.save('transcripts', built.transcript.transcript_id, built.transcript); return built;
  }

  function extract({ transcript_id, candidates }) {
    const blocked = active('EXTRACTION'); if (blocked) return blocked; const transcript = driver.get('transcripts', transcript_id); if (!transcript) return deny('TRANSCRIPT_NOT_FOUND'); const session = driver.get('sessions', transcript.session_id), auth = authority(session, 'EXTRACTION'); if (!auth.ok) return auth; if (!grantedForProcessing(auth.authority, 'STRUCTURED_EXTRACTION')) return deny('EXTRACTION_CONSENT_REQUIRED');
    const result = extractStructuredCandidates({ transcript, candidates }); if (result.ok) for (const artifact of result.artifacts) driver.save('artifacts', artifact.artifact_id, artifact); return result;
  }

  function queueReview({ artifact_id }) { const blocked = active('REVIEW'); if (blocked) return blocked; const artifact = driver.get('artifacts', artifact_id); if (!artifact) return deny('ARTIFACT_NOT_FOUND'); const session = driver.get('sessions', artifact.session_id), auth = authority(session, 'REVIEW'); if (!auth.ok) return auth; if (!grantedForProcessing(auth.authority, 'STRUCTURED_EXTRACTION')) return deny('CONSENT_REVOKED'); const result = queueArtifactForReview(artifact); if (result.ok) driver.save('artifacts', artifact_id, result.artifact); return result; }
  function review(input) { const blocked = active('REVIEW'); if (blocked) return blocked; const artifact = driver.get('artifacts', input.artifact_id); if (!artifact) return deny('ARTIFACT_NOT_FOUND'); const session = driver.get('sessions', artifact.session_id), auth = authority(session, 'REVIEW'); if (!auth.ok) return auth; if (!grantedForProcessing(auth.authority, 'STRUCTURED_EXTRACTION')) return deny('CONSENT_REVOKED'); if (!auth.authority.authorized_participants.includes(input.coach_id)) return deny('REVIEW_ACTOR_NOT_AUTHORIZED'); const result = reviewArtifact({ artifact, action: input.action, coach_id: input.coach_id, reviewed_at: input.reviewed_at || clock(), edited_content_reference: input.edited_content_reference }); if (result.ok) { driver.save('artifacts', result.artifact.artifact_id, result.artifact); driver.save('reviews', `${result.artifact.artifact_id}:${result.artifact.version}`, result); } return result; }

  function propose({ artifact_id, business_engine, reason_for_change }) { const blocked = active('ENGINE'); if (blocked) return blocked; const artifact = driver.get('artifacts', artifact_id); if (!artifact || !['COACH_ACCEPTED', 'COACH_EDITED'].includes(artifact.lifecycle_state)) return deny('REVIEWED_ARTIFACT_REQUIRED'); const session = driver.get('sessions', artifact.session_id), auth = authority(session, 'ENGINE_EVALUATION'); if (!auth.ok) return auth; if (!grantedForProcessing(auth.authority, 'BUSINESS_ENGINE_EVALUATION')) return deny('ENGINE_EVALUATION_CONSENT_REQUIRED'); const note = buildConfidenceRealityUpdate({ artifact, now: clock() }), built = buildBusinessEngineProposal({ artifact, business_engine, reason_for_change, now: clock() }); if (!built.ok) return built; const evaluated = evaluateBusinessEngineProposal({ proposal: built.proposal, current_business_engine: business_engine, now: clock() }); driver.save('proposals', built.proposal.proposal_id, evaluated.proposal || built.proposal); return frozen({ ...evaluated, confidence_reality_update: note }); }

  function requestConfirmation({ proposal_id }) { const blocked = active('CONFIRMATION'); if (blocked) return blocked; const proposal = driver.get('proposals', proposal_id); if (!proposal || proposal.status !== 'CONFIRMATION_REQUIRED') return deny('EVALUATED_PROPOSAL_REQUIRED'); const session = driver.get('sessions', proposal.session_id), auth = authority(session, 'ENGINE_EVALUATION'); if (!auth.ok) return auth; if (!grantedForProcessing(auth.authority, 'BUSINESS_ENGINE_EVALUATION')) return deny('CONSENT_REVOKED'); const result = createSubscriberConfirmation({ proposal, now: clock() }); if (result.ok) driver.save('confirmations', result.confirmation.confirmation_id, result.confirmation); return result; }
  function confirm({ confirmation_id, response, subscriber_id }) { const blocked = active('CONFIRMATION'); if (blocked) return blocked; const confirmation = driver.get('confirmations', confirmation_id); if (!confirmation) return deny('CONFIRMATION_NOT_FOUND'); const proposal = driver.get('proposals', confirmation.proposal_id), session = proposal ? driver.get('sessions', proposal.session_id) : null, auth = session ? authority(session, 'ENGINE_EVALUATION') : deny('SESSION_NOT_FOUND'); if (!auth.ok) return auth; if (!grantedForProcessing(auth.authority, 'BUSINESS_ENGINE_EVALUATION')) return deny('CONSENT_REVOKED'); const result = respondToConfirmation({ confirmation, response, subscriber_id, now: clock() }); if (result.ok) driver.save('confirmations', confirmation_id, result.confirmation); return result; }
  function promote({ proposal_id, confirmation_id, evidence_references, outcome_references, current_business_engine, idempotency_key }) { const blocked = active('ENGINE'); if (blocked) return blocked; const proposal = driver.get('proposals', proposal_id), confirmation = driver.get('confirmations', confirmation_id); if (!proposal || !confirmation) return deny('PROPOSAL_OR_CONFIRMATION_NOT_FOUND'); const session = driver.get('sessions', proposal.session_id), auth = authority(session, 'ENGINE_EVALUATION'); if (!auth.ok) return auth; if (!grantedForProcessing(auth.authority, 'BUSINESS_ENGINE_EVALUATION')) return deny('CONSENT_REVOKED'); const command = driver.command(`promote:${idempotency_key}`, { proposal_id, confirmation_id, evidence_references, outcome_references, version: current_business_engine.version }, () => promoteConfirmedProposal({ proposal, confirmation, evidence_references, outcome_references, current_business_engine, canonicalAppend, idempotency_key, now: clock() })); return command.ok ? frozen({ ...command.value, status: command.status }) : deny(command.status); }

  function refresh({ subscriber_scope, business_engine, previous_version, reason_for_change, evidence_sources, fail_target = null }) { const blocked = active('PROJECTION'); if (blocked) return blocked; const result = refreshLiveSessionProjections({ subscriber_scope, business_engine, previous_version, reason_for_change, evidence_sources, fail_target, now: clock() }); if (result.refresh) driver.save('refreshes', result.refresh.projection_id, result.refresh); return result; }

  function revokeConsent({ session_id, purpose, actor_id }) { const session = driver.get('sessions', session_id); if (!session) return deny('SESSION_NOT_FOUND'); const authRecord = driver.get('authorities', session.authority_id); if (!authRecord || !Object.hasOwn(authRecord.consent, purpose)) return deny('CONSENT_PURPOSE_NOT_FOUND'); const record = { consent_id: `consent_${liveSessionSemanticHash({ session_id, purpose, actor_id, at: clock() }).slice(0, 24)}`, session_id, purpose, actor_id, state: 'REVOKED', recorded_at: clock(), subscriber_scope: session.subscriber_scope, privacy_class: session.privacy_class, schema_version: '1.0.0', policy_version: session.policy_version }; const validation = validateLiveSessionConsentRecord(record); if (!validation.valid) return deny('INVALID_CONSENT_RECORD'); driver.save('authorities', authRecord.authority_id, { ...authRecord, consent: { ...authRecord.consent, [purpose]: 'REVOKED' } }); if (['PARTICIPATION', 'TRANSCRIPTION', 'STRUCTURED_EXTRACTION', 'BUSINESS_ENGINE_EVALUATION'].includes(purpose) && ['ACTIVE', 'PAUSED', 'RECOVERING'].includes(session.status)) move(session, 'CONSENT_REVOKED'); return frozen({ ok: true, consent_record: record }); }

  function interrupt({ session_id, code = 'PROVIDER_INTERRUPTED' }) { const session = driver.get('sessions', session_id); if (!session) return deny('SESSION_NOT_FOUND'); const moved = move(session, 'INTERRUPT'); if (!moved.ok) return moved; provider.setMediaState(session_id, 'INTERRUPTED'); const updated = { ...moved.session, media_state: 'INTERRUPTED', unresolved_items: [...new Set([...(moved.session.unresolved_items || []), 'PROVIDER_RECOVERY'])], version: moved.session.version + 1 }; driver.save('sessions', session_id, updated); const failure = recordLiveSessionFailure({ driver, session_id, failure_class: 'PROVIDER_FAILURE', code, last_valid_sequence: eventStore.read({ session_id }).at(-1)?.sequence_number || 0, unresolved_items: ['PROVIDER_RECOVERY'], now: clock() }); return frozen({ ok: true, session: updated, failure }); }
  function recover({ session_id, reducer = (state, event) => ({ ...state, last_sequence: event.sequence_number }) }) { const session = driver.get('sessions', session_id); if (!session) return deny('SESSION_NOT_FOUND'); const auth = authority(session, 'RECOVER'); if (!auth.ok) return auth; if (!grantedForProcessing(auth.authority, 'PARTICIPATION')) return deny('CONSENT_REVOKED'); const starting = move(session, 'RECOVER'); if (!starting.ok) return starting; const replay = recoverLiveSession({ driver, eventStore, session_id, reducer, initial_state: { session_id, last_sequence: 0 }, now: clock() }); if (!replay.ok) { const failed = move(starting.session, 'RECOVERY_FAIL'); const unresolved = [...new Set([...(failed.session.unresolved_items || []), ...(replay.failure?.unresolved_items || ['RECOVERY_REQUIRED'])])], updated = { ...failed.session, media_state: 'INTERRUPTED', unresolved_items: unresolved, recovery_failure_reference: replay.failure?.failure_id || null, closure_verdict: 'INCOMPLETE', version: failed.session.version + 1 }; driver.save('sessions', session_id, updated); return deny(replay.code, { cause_code: replay.cause_code, session: updated, failure: replay.failure, replay }); } const providerState = provider.setMediaState(session_id, 'ACTIVE'); if (providerState?.ok !== true) { const failure = recordLiveSessionFailure({ driver, session_id, failure_class: 'RECOVERY_FAILURE', code: providerState?.code || 'PROVIDER_REACTIVATION_FAILED', last_valid_sequence: replay.replayed_event_count, unresolved_items: ['PROVIDER_REACTIVATION'], now: clock() }), failed = move(starting.session, 'RECOVERY_FAIL'), updated = { ...failed.session, media_state: 'INTERRUPTED', unresolved_items: ['PROVIDER_REACTIVATION'], recovery_failure_reference: failure.failure_id, closure_verdict: 'INCOMPLETE', version: failed.session.version + 1 }; driver.save('sessions', session_id, updated); return deny('RECOVERY_PROVIDER_REACTIVATION_FAILED', { session: updated, failure, replay }); } const recovered = move(starting.session, 'RECOVERED'), updated = { ...recovered.session, media_state: 'ACTIVE', unresolved_items: (recovered.session.unresolved_items || []).filter((item) => item !== 'PROVIDER_RECOVERY'), version: recovered.session.version + 1 }; driver.save('sessions', session_id, updated); return frozen({ ok: true, session: updated, replay }); }
  function close({ session_id, unresolved_items = [] }) { let session = driver.get('sessions', session_id); if (!session) return deny('SESSION_NOT_FOUND'); if (!['CONSENT_BLOCKED', 'RECOVERY_FAILED'].includes(session.status)) { const auth = authority(session, 'CLOSE'); if (!auth.ok) return auth; } const closing = move(session, 'CLOSE'); if (!closing.ok) return closing; const teardown = provider.teardown({ session_id }); if (teardown?.ok !== true) { const failure = recordLiveSessionFailure({ driver, session_id, failure_class: 'PROVIDER_FAILURE', code: teardown?.code || 'PROVIDER_TEARDOWN_FAILED', last_valid_sequence: eventStore.read({ session_id }).at(-1)?.sequence_number || 0, unresolved_items: ['PROVIDER_TEARDOWN'], now: clock() }), failed = move(closing.session, 'FAIL'), updated = { ...failed.session, media_state: session.media_state || 'ACTIVE', unresolved_items: [...new Set([...unresolved_items, 'PROVIDER_TEARDOWN'])], closure_verdict: 'INCOMPLETE', closure_failure_reference: failure.failure_id, version: failed.session.version + 1 }; driver.save('sessions', session_id, updated); return deny('PROVIDER_TEARDOWN_FAILED', { cause_code: teardown?.code || null, session: updated, failure }); } if (unresolved_items.length) { const updated = { ...closing.session, unresolved_items, closure_verdict: 'INCOMPLETE', version: closing.session.version + 1 }; driver.save('sessions', session_id, updated); return deny('UNRESOLVED_SESSION_WORK', { session: updated }); } const closed = move(closing.session, 'FINALIZE'); const updated = { ...closed.session, media_state: 'STOPPED', closure_verdict: 'COMPLETE' }; driver.save('sessions', session_id, updated); return frozen({ ok: true, session: updated }); }
  function inspect() { return frozen({ one_business_engine: true, coach_canonical_mutation_authority: false, live_provider: false, live_model: false, production_traffic: false, public_routes: [], flags, snapshot: driver.snapshot() }); }

  return deepFreeze({ createSession, authorizeSession, connect, ingestProviderEvent, captureTranscript, extract, queueReview, review, propose, requestConfirmation, confirm, promote, refresh, revokeConsent, interrupt, recover, close, inspect });
}

const SECURED_METHOD_ACTIONS = Object.freeze({
  createSession: SECURITY_ACTIONS.CREATE_SESSION,
  authorizeSession: SECURITY_ACTIONS.AUTHORIZE_SESSION,
  connect: SECURITY_ACTIONS.CONNECT_SESSION,
  ingestProviderEvent: SECURITY_ACTIONS.INGEST_SESSION_EVENT,
  captureTranscript: SECURITY_ACTIONS.CAPTURE_TRANSCRIPT,
  extract: SECURITY_ACTIONS.EXTRACT_STRUCTURED_INTELLIGENCE,
  queueReview: SECURITY_ACTIONS.WRITE_COACH_REVIEW,
  review: SECURITY_ACTIONS.WRITE_COACH_REVIEW,
  propose: SECURITY_ACTIONS.PROPOSE_ENGINE_CHANGE,
  requestConfirmation: SECURITY_ACTIONS.REQUEST_SUBSCRIBER_CONFIRMATION,
  confirm: SECURITY_ACTIONS.CONFIRM_OWN_PROPOSAL,
  promote: SECURITY_ACTIONS.PROMOTE_CONFIRMED_PROPOSAL,
  refresh: SECURITY_ACTIONS.REFRESH_PROJECTION,
  revokeConsent: SECURITY_ACTIONS.REVOKE_CONSENT,
  interrupt: SECURITY_ACTIONS.INTERRUPT_SESSION,
  recover: SECURITY_ACTIONS.RECOVER_SESSION,
  close: SECURITY_ACTIONS.CLOSE_SESSION,
  inspect: SECURITY_ACTIONS.READ_SECURITY_AUDIT,
});

export function createSecuredLiveSessionService({ service, securityPolicy }) {
  if (!service || typeof securityPolicy?.decide !== 'function') throw new TypeError('service and securityPolicy are required');
  const facade = {};
  for (const [method, action] of Object.entries(SECURED_METHOD_ACTIONS)) {
    if (typeof service[method] !== 'function') continue;
    facade[method] = (input = {}) => {
      const { security_context, ...domainInput } = input;
      if (!security_context) return frozen({ ok: false, code: 'AUTHENTICATION_FAILED' });
      const decision = securityPolicy.decide({ ...security_context, action });
      if (!decision.allowed) return frozen({ ok: false, code: decision.failure_code, decision });
      return service[method](domainInput);
    };
  }
  facade.inspectSecurityBoundary = () => frozen({
    security_policy_version: securityPolicy.policy_version,
    protected_methods: Object.keys(SECURED_METHOD_ACTIONS).sort(),
    base_service_route_exposure: false,
    public_routes: [],
    default_off: securityPolicy.flags?.security_hardening_enabled !== true,
  });
  return Object.freeze(facade);
}
