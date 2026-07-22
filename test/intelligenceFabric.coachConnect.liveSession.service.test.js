import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveSessionService, DEFAULT_LIVE_SESSION_FLAGS, InjectedLiveSessionEventStore, InMemoryLiveSessionDriver, SyntheticMediaProvider } from '../src/lib/intelligenceFabric/index.js';

const at = '2026-07-22T12:00:00.000Z';
const scope = { tenant_id: 'tenant_live', profile_id: 'profile_live', business_id: 'business_live', subscriber_id: 'subscriber_live' };
const consent = { PARTICIPATION: 'GRANTED', TRANSCRIPTION: 'GRANTED', RECORDING: 'RESTRICTED', STRUCTURED_EXTRACTION: 'GRANTED', COACH_SHARING: 'GRANTED', BUSINESS_ENGINE_EVALUATION: 'GRANTED', FUTURE_LEARNING: 'RESTRICTED' };
const flags = Object.fromEntries(Object.keys(DEFAULT_LIVE_SESSION_FLAGS).map((key) => [key, key.endsWith('_enabled') || key === 'synthetic_only']));
Object.assign(flags, { emergency_disabled: false, live_media_enabled: false, live_model_enabled: false, production_traffic_enabled: false });

function fixture({ authorityAllowed = true } = {}) {
  const driver = new InMemoryLiveSessionDriver(), eventStore = new InjectedLiveSessionEventStore({ driver }), provider = new SyntheticMediaProvider({ clock: () => at }); let canonicalAppends = 0;
  const canonicalAppend = (event) => ({ ok: true, event_id: `canonical_live_${++canonicalAppends}`, new_version: event.expected_version + 1 });
  const service = createLiveSessionService({ driver, eventStore, provider, flags, parentActivation: () => ({ allowed: true }), authorityEvaluator: () => ({ allowed: authorityAllowed, reason_code: authorityAllowed ? 'AUTHORIZED' : 'RELATIONSHIP_REVOKED' }), canonicalAppend, clock: () => at });
  const input = { subscriber_scope: scope, coach_id: 'coach_live', relationship_id: 'relationship_live', entitlement_id: 'entitlement_live', business_engine_id: 'engine_live', created_by: 'subscriber_live', policy_version: 'policy_live_v1', idempotency_key: 'create_live_session' };
  return { driver, eventStore, provider, service, input, canonicalCount: () => canonicalAppends };
}

function activeSession(fx, consentInput = consent) {
  const created = fx.service.createSession(fx.input), authorized = fx.service.authorizeSession({ session_id: created.session.session_id, authorized_participants: ['subscriber_live', 'coach_live'], consent: consentInput, retention_policy: 'SYNTHETIC_DELETE_AFTER_PROOF', provider_permissions: ['CONNECT', 'TRANSCRIBE'] }), connected = fx.service.connect({ session_id: created.session.session_id });
  return { created, authorized, connected, session_id: created.session.session_id };
}

test('session establishment is authority-gated idempotent and binds synthetic provider', () => {
  const fx = fixture(), first = fx.service.createSession(fx.input), replay = fx.service.createSession(fx.input);
  assert.equal(first.ok, true); assert.equal(replay.status, 'IDEMPOTENT_REPLAY'); assert.equal(first.session.session_id, replay.session.session_id);
  const authorized = fx.service.authorizeSession({ session_id: first.session.session_id, authorized_participants: ['subscriber_live', 'coach_live'], consent, retention_policy: 'SYNTHETIC', provider_permissions: ['CONNECT'] });
  assert.equal(authorized.session.status, 'READY'); assert.equal(authorized.authority.recording_allowed, false); assert.equal(authorized.authority.grants_canonical_mutation, false);
  const connected = fx.service.connect({ session_id: first.session.session_id }); assert.equal(connected.session.status, 'ACTIVE'); assert.equal(connected.provider.synthetic, true); assert.equal(connected.provider.access_token, null);
});

test('authorization denial and missing participation consent fail closed', () => {
  const denied = fixture({ authorityAllowed: false }), created = denied.service.createSession(denied.input), blocked = denied.service.authorizeSession({ session_id: created.session.session_id, authorized_participants: ['subscriber_live', 'coach_live'], consent, retention_policy: 'SYNTHETIC', provider_permissions: [] });
  assert.equal(blocked.code, 'RELATIONSHIP_REVOKED'); assert.equal(denied.driver.get('sessions', created.session.session_id).status, 'AUTHORIZATION_FAILED');
  const fx = fixture(), made = fx.service.createSession(fx.input), noParticipation = fx.service.authorizeSession({ session_id: made.session.session_id, authorized_participants: ['subscriber_live', 'coach_live'], consent: { ...consent, PARTICIPATION: 'RESTRICTED' }, retention_policy: 'SYNTHETIC', provider_permissions: [] });
  assert.equal(noParticipation.code, 'PARTICIPATION_CONSENT_REQUIRED'); assert.equal(fx.driver.get('sessions', made.session.session_id).status, 'CONSENT_BLOCKED');
});

test('event ingestion detects replay collision and sequence gaps', () => {
  const fx = fixture(), live = activeSession(fx), input = { session_id: live.session_id, type: 'PARTICIPANT_CONNECTED', actor_id: 'coach_live', actor_role: 'COACH', payload_reference: 'payload_ref_1', idempotency_key: 'event_1', expected_sequence: 0 };
  assert.equal(fx.service.ingestProviderEvent(input).status, 'APPENDED'); assert.equal(fx.service.ingestProviderEvent(input).status, 'IDEMPOTENT_REPLAY');
  assert.equal(fx.service.ingestProviderEvent({ ...input, payload_reference: 'different_ref' }).status, 'IDEMPOTENCY_CONFLICT');
  assert.equal(fx.service.ingestProviderEvent({ ...input, idempotency_key: 'event_gap', expected_sequence: 4 }).status, 'SEQUENCE_GAP');
});

test('transcript extraction and coach edit preserve attribution and immutable original', () => {
  const fx = fixture(), live = activeSession(fx), transcript = fx.service.captureTranscript({ transcript_id: 'transcript_live', session_id: live.session_id, status: 'FINALIZED', confidence: 0.96, segments: [{ segment_id: 'segment_1', speaker_id: 'subscriber_live', content_reference: 'protected_segment_hash', confidence: 0.96, started_at: at }], finalized_at: at });
  assert.equal(transcript.ok, true); assert.equal(transcript.transcript.raw_transcript, null);
  const extracted = fx.service.extract({ transcript_id: transcript.transcript.transcript_id, candidates: [{ artifact_type: 'OBSERVATION', source_spans: ['segment_1'], speaker_id: 'subscriber_live', confidence: 0.8, direct_statement: true, content_reference: 'protected_observation_ref' }] }), original = extracted.artifacts[0];
  fx.service.queueReview({ artifact_id: original.artifact_id }); const edited = fx.service.review({ artifact_id: original.artifact_id, action: 'EDIT', coach_id: 'coach_live', edited_content_reference: 'reviewed_observation_ref' });
  assert.equal(edited.ok, true); assert.notEqual(edited.artifact.artifact_id, original.artifact_id); assert.equal(edited.artifact.original_artifact_id, original.artifact_id); assert.equal(edited.preserved_original.content_reference, 'protected_observation_ref'); assert.equal(edited.artifact.canonical_authority, false);
});

test('unsafe extraction and revoked consent block future processing without erasing audit', () => {
  const fx = fixture(), live = activeSession(fx), transcript = fx.service.captureTranscript({ transcript_id: 'transcript_unsafe', session_id: live.session_id, status: 'PARTIAL', confidence: 0.5, segments: [{ segment_id: 'segment_unsafe', speaker_id: 'unknown_speaker', content_reference: 'protected_partial_ref', confidence: 0.5, started_at: at }] });
  assert.equal(fx.service.extract({ transcript_id: transcript.transcript.transcript_id, candidates: [{ artifact_type: 'FACT_CLAIM', source_spans: ['segment_unsafe'], speaker_id: 'unknown_speaker', confidence: 0.2, direct_statement: false, content_reference: 'unsafe_ref', speaker_ambiguous: true }] }).code, 'UNSAFE_OR_UNATTRIBUTED_CANDIDATE');
  const revoked = fx.service.revokeConsent({ session_id: live.session_id, purpose: 'TRANSCRIPTION', actor_id: 'subscriber_live' }); assert.equal(revoked.ok, true); assert.equal(fx.driver.get('sessions', live.session_id).status, 'CONSENT_BLOCKED');
  assert.equal(fx.service.captureTranscript({ transcript_id: 'after_revoke', session_id: live.session_id, status: 'PARTIAL', segments: [] }).code, 'TRANSCRIPTION_CONSENT_REQUIRED');
});

test('proposal requires subscriber confirmation evidence outcome and current Business Engine version', () => {
  const fx = fixture(), live = activeSession(fx), transcript = fx.service.captureTranscript({ transcript_id: 'transcript_proposal', session_id: live.session_id, status: 'FINALIZED', confidence: 0.9, segments: [{ segment_id: 'segment_p', speaker_id: 'subscriber_live', content_reference: 'protected_p', confidence: 0.9, started_at: at }], finalized_at: at }), extracted = fx.service.extract({ transcript_id: transcript.transcript.transcript_id, candidates: [{ artifact_type: 'OBSERVATION', source_spans: ['segment_p'], speaker_id: 'subscriber_live', confidence: 0.8, direct_statement: true, content_reference: 'observation_for_engine' }] }), id = extracted.artifacts[0].artifact_id;
  fx.service.queueReview({ artifact_id: id }); const reviewed = fx.service.review({ artifact_id: id, action: 'ACCEPT', coach_id: 'coach_live' }).artifact, engine = { business_engine_id: 'engine_live', version: 4, policy_version: 'policy_live_v1', confidence_reality: { coaching_notes: [] }, five_futures: { probabilities: [0.2] }, one_move: { id: 'one_move_existing' } };
  const proposed = fx.service.propose({ artifact_id: reviewed.artifact_id, business_engine: engine, reason_for_change: 'Reviewed live-session observation' }); assert.equal(proposed.confidence_reality_update.destination_class, 'COACHING_NOTES'); assert.equal(proposed.confidence_reality_update.canonical_authority, false);
  const request = fx.service.requestConfirmation({ proposal_id: proposed.proposal.proposal_id }); assert.equal(fx.service.confirm({ confirmation_id: request.confirmation.confirmation_id, response: 'ACCEPT', subscriber_id: 'coach_live' }).code, 'SUBSCRIBER_CONFIRMATION_ACTOR_REQUIRED');
  assert.equal(fx.service.promote({ proposal_id: proposed.proposal.proposal_id, confirmation_id: request.confirmation.confirmation_id, evidence_references: [], outcome_references: [], current_business_engine: engine, idempotency_key: 'promotion_1' }).code, 'SUBSCRIBER_CONFIRMATION_REQUIRED');
  fx.service.confirm({ confirmation_id: request.confirmation.confirmation_id, response: 'ACCEPT', subscriber_id: 'subscriber_live' });
  assert.equal(fx.service.promote({ proposal_id: proposed.proposal.proposal_id, confirmation_id: request.confirmation.confirmation_id, evidence_references: ['evidence_1'], outcome_references: ['outcome_1'], current_business_engine: { ...engine, version: 5 }, idempotency_key: 'promotion_stale' }).code, 'STALE_PROPOSAL_REEVALUATION_REQUIRED');
  const promoted = fx.service.promote({ proposal_id: proposed.proposal.proposal_id, confirmation_id: request.confirmation.confirmation_id, evidence_references: ['evidence_1'], outcome_references: ['outcome_1'], current_business_engine: engine, idempotency_key: 'promotion_1' }); assert.equal(promoted.ok, true); assert.equal(promoted.promotion.new_business_engine_version, 5); assert.equal(fx.service.promote({ proposal_id: proposed.proposal.proposal_id, confirmation_id: request.confirmation.confirmation_id, evidence_references: ['evidence_1'], outcome_references: ['outcome_1'], current_business_engine: engine, idempotency_key: 'promotion_1' }).status, 'IDEMPOTENT_REPLAY'); assert.equal(fx.canonicalCount(), 1);
});

test('projection refresh exposes one canonical version and hides raw content', () => {
  const fx = fixture(), engine = { business_engine_id: 'engine_live', version: 5, policy_version: 'policy_live_v1', confidence_reality: { coaching_notes: ['safe_ref'], raw_transcript: 'forbidden' }, five_futures: { evaluation: 'RECOMPUTED' }, one_move: { evaluation: 'REEVALUATED', private_note: 'forbidden' } };
  const result = fx.service.refresh({ subscriber_scope: scope, business_engine: engine, previous_version: 4, reason_for_change: 'confirmed proposal', evidence_sources: ['evidence_1'] }); assert.equal(result.ok, true); assert.equal(result.subscriber_projection.business_engine_version, 5); assert.equal(result.coach_projection.business_engine_version, 5); assert.equal(result.coach_projection.canonical_write_capability, false); assert.doesNotMatch(JSON.stringify(result), /forbidden|raw_transcript|private_note/);
  const failed = fx.service.refresh({ subscriber_scope: scope, business_engine: engine, previous_version: 4, reason_for_change: 'retry', evidence_sources: [], fail_target: 'COACH' }); assert.equal(failed.code, 'PROJECTION_REFRESH_FAILED'); assert.equal(failed.exposed_version, 4);
});

test('interruption recovery replays deterministically and closure preserves unresolved work', () => {
  const fx = fixture(), live = activeSession(fx); fx.service.ingestProviderEvent({ session_id: live.session_id, type: 'PARTICIPANT_CONNECTED', actor_id: 'coach_live', actor_role: 'COACH', payload_reference: 'payload_recovery', idempotency_key: 'recovery_event', expected_sequence: 0 });
  assert.equal(fx.service.interrupt({ session_id: live.session_id }).session.status, 'INTERRUPTED'); const recovered = fx.service.recover({ session_id: live.session_id }); assert.equal(recovered.session.status, 'ACTIVE'); assert.equal(recovered.replay.replayed_event_count, 1); assert.equal(recovered.replay.duplicate_canonical_promotions, 0);
  const incomplete = fx.service.close({ session_id: live.session_id, unresolved_items: ['REVIEW_PENDING'] }); assert.equal(incomplete.code, 'UNRESOLVED_SESSION_WORK'); assert.equal(incomplete.session.closure_verdict, 'INCOMPLETE');
});

test('replay and checkpoint failures remain RECOVERY_FAILED with attributable unresolved work and zero canonical mutation', () => {
  const replayFx = fixture(), replayLive = activeSession(replayFx);
  replayFx.service.ingestProviderEvent({ session_id: replayLive.session_id, type: 'PARTICIPANT_CONNECTED', actor_id: 'coach_live', actor_role: 'COACH', payload_reference: 'payload_replay_failure', idempotency_key: 'replay_failure_event', expected_sequence: 0 });
  replayFx.service.interrupt({ session_id: replayLive.session_id });
  const replayFailed = replayFx.service.recover({ session_id: replayLive.session_id, reducer: () => { throw Object.assign(new Error('synthetic replay failure'), { code: 'SYNTHETIC_REPLAY_FAILED' }); } });
  assert.equal(replayFailed.code, 'RECOVERY_REPLAY_FAILED'); assert.equal(replayFailed.session.status, 'RECOVERY_FAILED'); assert.equal(replayFailed.session.media_state, 'INTERRUPTED'); assert.deepEqual(replayFailed.session.unresolved_items, ['PROVIDER_RECOVERY', 'RECOVERY_REPLAY']); assert.equal(replayFailed.failure.failure_class, 'RECOVERY_FAILURE'); assert.equal(replayFailed.failure.session_id, replayLive.session_id); assert.equal(replayFx.provider.sessions.get(replayLive.session_id).media_state, 'INTERRUPTED'); assert.equal(replayFx.driver.list('failures').some((failure) => failure.failure_id === replayFailed.failure.failure_id), true); assert.equal(replayFx.canonicalCount(), 0);

  const checkpointFx = fixture(), checkpointLive = activeSession(checkpointFx);
  checkpointFx.service.ingestProviderEvent({ session_id: checkpointLive.session_id, type: 'PARTICIPANT_CONNECTED', actor_id: 'coach_live', actor_role: 'COACH', payload_reference: 'payload_checkpoint_failure', idempotency_key: 'checkpoint_failure_event', expected_sequence: 0 });
  checkpointFx.service.interrupt({ session_id: checkpointLive.session_id }); checkpointFx.eventStore.checkpoint = () => ({ ok: false, status: 'SYNTHETIC_CHECKPOINT_FAILED' });
  const checkpointFailed = checkpointFx.service.recover({ session_id: checkpointLive.session_id });
  assert.equal(checkpointFailed.code, 'RECOVERY_CHECKPOINT_FAILED'); assert.equal(checkpointFailed.session.status, 'RECOVERY_FAILED'); assert.deepEqual(checkpointFailed.session.unresolved_items, ['PROVIDER_RECOVERY', 'RECOVERY_CHECKPOINT']); assert.equal(checkpointFailed.failure.code, 'SYNTHETIC_CHECKPOINT_FAILED'); assert.equal(checkpointFx.provider.sessions.get(checkpointLive.session_id).media_state, 'INTERRUPTED'); assert.equal(checkpointFx.canonicalCount(), 0);
});

test('provider teardown failure prevents CLOSED and COMPLETE and preserves operator evidence with zero canonical mutation', () => {
  const fx = fixture(), live = activeSession(fx); fx.provider.teardown = () => ({ ok: false, code: 'SYNTHETIC_TEARDOWN_FAILED' });
  const result = fx.service.close({ session_id: live.session_id });
  assert.equal(result.code, 'PROVIDER_TEARDOWN_FAILED'); assert.equal(result.cause_code, 'SYNTHETIC_TEARDOWN_FAILED'); assert.equal(result.session.status, 'FAILED'); assert.equal(result.session.closure_verdict, 'INCOMPLETE'); assert.deepEqual(result.session.unresolved_items, ['PROVIDER_TEARDOWN']); assert.equal(result.failure.failure_class, 'PROVIDER_FAILURE'); assert.equal(result.failure.code, 'SYNTHETIC_TEARDOWN_FAILED'); assert.equal(fx.driver.list('failures').some((failure) => failure.failure_id === result.failure.failure_id), true); assert.equal(fx.canonicalCount(), 0);
});

test('inspect proves inactive synthetic boundary and one Business Engine', () => {
  const fx = fixture(), inspection = fx.service.inspect(); assert.equal(inspection.one_business_engine, true); assert.equal(inspection.coach_canonical_mutation_authority, false); assert.equal(inspection.live_provider, false); assert.equal(inspection.live_model, false); assert.equal(inspection.production_traffic, false); assert.deepEqual(inspection.public_routes, []);
});
