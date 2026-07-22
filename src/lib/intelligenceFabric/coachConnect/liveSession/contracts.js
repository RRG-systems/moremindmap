import { hashCanonicalJson } from '../../hashing.js';
import { deepFreeze } from '../../validation.js';
import { ARTIFACT_STATES, ARTIFACT_TYPES, COMMITMENT_STATES, CONSENT_PURPOSES, CONSENT_STATES, LIVE_SESSION_STATES, MEDIA_STATES, PARTICIPANT_STATES, PRIVACY_CLASSES, PROPOSAL_STATES, RECORDING_STATES, TRANSCRIPT_STATES } from './constants.js';

const object = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value) => typeof value === 'string' && value.length > 0 && value.length <= 512;
const timestamp = (value) => text(value) && Number.isFinite(Date.parse(value));
const scope = (value) => object(value) && ['tenant_id', 'profile_id', 'business_id', 'subscriber_id'].every((key) => text(value[key]));
const result = (errors, value) => deepFreeze({ valid: errors.length === 0, errors, value: errors.length ? null : structuredClone(value) });
const required = (value, fields, errors) => fields.forEach((field) => { if (!text(value?.[field])) errors.push({ code: 'REQUIRED_OR_INVALID', field }); });
const common = (value, errors) => {
  if (!object(value)) { errors.push({ code: 'INVALID_TYPE', field: '$' }); return; }
  if (!scope(value.subscriber_scope)) errors.push({ code: 'INVALID_EXACT_SCOPE', field: 'subscriber_scope' });
  if (!PRIVACY_CLASSES.includes(value.privacy_class)) errors.push({ code: 'INVALID_PRIVACY_CLASS', field: 'privacy_class' });
  if (!text(value.schema_version) || !text(value.policy_version)) errors.push({ code: 'VERSION_REQUIRED', field: 'schema_or_policy_version' });
};

export function validateCoachLiveSession(value) {
  const errors = []; common(value, errors); required(value, ['session_id', 'coach_id', 'relationship_id', 'entitlement_id', 'business_engine_id', 'created_by', 'idempotency_key'], errors);
  if (!LIVE_SESSION_STATES.includes(value?.status)) errors.push({ code: 'INVALID_SESSION_STATE', field: 'status' });
  if (!timestamp(value?.created_at) || !Number.isInteger(value?.version) || value.version < 1) errors.push({ code: 'INVALID_SESSION_METADATA', field: 'created_at_or_version' });
  if (value?.canonical_mutation_authority !== false) errors.push({ code: 'COACH_AUTHORITY_ESCALATION', field: 'canonical_mutation_authority' });
  return result(errors, value);
}

export function validateLiveSessionAuthority(value) {
  const errors = []; common(value, errors); required(value, ['authority_id', 'session_id', 'relationship_id', 'entitlement_id'], errors);
  if (!Array.isArray(value?.authorized_participants) || value.authorized_participants.length < 2) errors.push({ code: 'PARTICIPANTS_REQUIRED', field: 'authorized_participants' });
  if (!object(value?.consent) || !CONSENT_PURPOSES.every((purpose) => CONSENT_STATES.includes(value.consent[purpose]))) errors.push({ code: 'GRANULAR_CONSENT_REQUIRED', field: 'consent' });
  if (!timestamp(value?.issued_at) || !timestamp(value?.expires_at) || Date.parse(value.expires_at) <= Date.parse(value.issued_at)) errors.push({ code: 'INVALID_AUTHORITY_WINDOW', field: 'issued_at_or_expires_at' });
  if (value?.grants_canonical_mutation !== false) errors.push({ code: 'AUTHORITY_ESCALATION', field: 'grants_canonical_mutation' });
  return result(errors, value);
}

export function validateSessionEvent(value) {
  const errors = []; common(value, errors); required(value, ['event_id', 'session_id', 'event_type', 'actor_id', 'actor_role', 'occurred_at', 'received_at', 'payload_reference', 'idempotency_key'], errors);
  if (!Number.isInteger(value?.sequence_number) || value.sequence_number < 1) errors.push({ code: 'INVALID_SEQUENCE', field: 'sequence_number' });
  if (!timestamp(value?.occurred_at) || !timestamp(value?.received_at)) errors.push({ code: 'INVALID_EVENT_TIME', field: 'occurred_at_or_received_at' });
  if ('provider_payload' in (value || {}) || 'raw_transcript' in (value || {})) errors.push({ code: 'RAW_PROVIDER_CONTENT_FORBIDDEN', field: '$' });
  return result(errors, value);
}

export function validateLiveSessionConsentRecord(value) {
  const errors = []; common(value, errors); required(value, ['consent_id', 'session_id', 'purpose', 'actor_id'], errors);
  if (!CONSENT_PURPOSES.includes(value?.purpose) || !CONSENT_STATES.includes(value?.state)) errors.push({ code: 'INVALID_CONSENT', field: 'purpose_or_state' });
  if (!timestamp(value?.recorded_at)) errors.push({ code: 'INVALID_CONSENT_TIME', field: 'recorded_at' });
  return result(errors, value);
}

export function validateTranscriptArtifact(value) {
  const errors = []; common(value, errors); required(value, ['transcript_id', 'session_id', 'provider_reference'], errors);
  if (!TRANSCRIPT_STATES.includes(value?.status) || !Array.isArray(value?.segments)) errors.push({ code: 'INVALID_TRANSCRIPT', field: 'status_or_segments' });
  if (value?.segments?.some((segment) => !text(segment.segment_id) || !text(segment.speaker_id) || !text(segment.content_reference) || !Number.isFinite(segment.confidence) || !timestamp(segment.started_at))) errors.push({ code: 'INVALID_TRANSCRIPT_SEGMENT', field: 'segments' });
  if (value?.raw_transcript != null) errors.push({ code: 'RAW_TRANSCRIPT_FORBIDDEN', field: 'raw_transcript' });
  return result(errors, value);
}

export function validateStructuredSessionArtifact(value) {
  const errors = []; common(value, errors); required(value, ['artifact_id', 'session_id', 'source_transcript_id', 'extraction_version'], errors);
  if (!ARTIFACT_TYPES.includes(value?.artifact_type) || !ARTIFACT_STATES.includes(value?.lifecycle_state)) errors.push({ code: 'INVALID_ARTIFACT_CLASS', field: 'artifact_type_or_state' });
  if (!Array.isArray(value?.source_spans) || value.source_spans.length === 0 || !text(value?.speaker_id) || !Number.isFinite(value?.confidence)) errors.push({ code: 'ATTRIBUTION_REQUIRED', field: 'source_attribution' });
  if (value?.canonical_authority !== false || value?.direct_statement === undefined) errors.push({ code: 'ARTIFACT_AUTHORITY_INVALID', field: 'canonical_authority' });
  return result(errors, value);
}

export function validateCommitment(value) { const errors = []; common(value, errors); required(value, ['commitment_id', 'session_id', 'owner_id', 'action_reference', 'expected_evidence_reference'], errors); if (!COMMITMENT_STATES.includes(value?.status)) errors.push({ code: 'INVALID_COMMITMENT_STATE', field: 'status' }); return result(errors, value); }
export function validateBusinessEngineProposal(value) { const errors = []; common(value, errors); required(value, ['proposal_id', 'session_id', 'business_engine_id', 'source_artifact_id', 'reason_for_change'], errors); if (!PROPOSAL_STATES.includes(value?.status) || !Number.isInteger(value?.base_business_engine_version)) errors.push({ code: 'INVALID_PROPOSAL', field: 'status_or_version' }); if (value?.canonical_authority !== false || !Array.isArray(value?.required_confirmations)) errors.push({ code: 'PROPOSAL_AUTHORITY_INVALID', field: 'authority_or_confirmations' }); return result(errors, value); }
export function validateSubscriberConfirmationRequest(value) { const errors = []; common(value, errors); required(value, ['confirmation_id', 'proposal_id', 'exact_change_reference', 'plain_language_explanation', 'source_attribution', 'accept_consequence', 'reject_consequence'], errors); if (!['PENDING', 'ACCEPTED', 'REJECTED', 'CLARIFIED', 'DEFERRED', 'EXPIRED'].includes(value?.response_state)) errors.push({ code: 'INVALID_CONFIRMATION_STATE', field: 'response_state' }); return result(errors, value); }
export function validateProjectionRefresh(value) { const errors = []; common(value, errors); required(value, ['projection_id', 'business_engine_id', 'reason_for_change'], errors); if (!Number.isInteger(value?.previous_version) || !Number.isInteger(value?.new_version) || !['PENDING', 'COMPLETED', 'FAILED'].includes(value?.refresh_status)) errors.push({ code: 'INVALID_PROJECTION_REFRESH', field: 'version_or_status' }); return result(errors, value); }

export function validateParticipantState(value) { return result(PARTICIPANT_STATES.includes(value) ? [] : [{ code: 'INVALID_PARTICIPANT_STATE', field: 'state' }], value); }
export function validateMediaState(value) { return result(MEDIA_STATES.includes(value) ? [] : [{ code: 'INVALID_MEDIA_STATE', field: 'state' }], value); }
export function validateRecordingState(value) { return result(RECORDING_STATES.includes(value) ? [] : [{ code: 'INVALID_RECORDING_STATE', field: 'state' }], value); }
export const liveSessionSemanticHash = (value) => hashCanonicalJson(value);
