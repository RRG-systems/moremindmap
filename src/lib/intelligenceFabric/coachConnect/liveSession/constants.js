import { deepFreeze } from '../../validation.js';

export const LIVE_SESSION_VERSION = '1.0.0';
export const LIVE_SESSION_STATES = Object.freeze(['CREATED', 'AUTHORIZING', 'READY', 'CONNECTING', 'ACTIVE', 'PAUSED', 'CLOSING', 'CLOSED', 'AUTHORIZATION_FAILED', 'CONSENT_BLOCKED', 'CONNECTION_DEGRADED', 'INTERRUPTED', 'RECOVERING', 'RECOVERY_FAILED', 'CANCELLED', 'FAILED']);
export const ARTIFACT_STATES = Object.freeze(['EXTRACTED', 'PENDING_COACH_REVIEW', 'COACH_ACCEPTED', 'COACH_EDITED', 'COACH_REJECTED', 'PENDING_ENGINE_EVALUATION', 'ENGINE_ACCEPTED_AS_NOTE', 'PENDING_SUBSCRIBER_CONFIRMATION', 'SUBSCRIBER_CONFIRMED', 'SUBSCRIBER_REJECTED', 'PROMOTED', 'SUPERSEDED']);
export const COMMITMENT_STATES = Object.freeze(['PROPOSED', 'ACCEPTED', 'ACTIVE', 'EVIDENCE_PENDING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'MISSED', 'CANCELLED', 'OUTCOME_VALIDATED']);
export const PROPOSAL_STATES = Object.freeze(['DRAFT', 'REVIEWED', 'SUBMITTED', 'EVALUATING', 'ACCEPTED_CONDITIONALLY', 'CONFIRMATION_REQUIRED', 'ACCEPTED', 'REJECTED', 'DEFERRED', 'SUPERSEDED']);
export const CONSENT_STATES = Object.freeze(['UNKNOWN', 'REQUESTED', 'GRANTED', 'RESTRICTED', 'REVOKED', 'EXPIRED']);
export const PARTICIPANT_STATES = Object.freeze(['INVITED', 'AUTHENTICATED', 'CONNECTED', 'DISCONNECTED', 'RECONNECTED', 'REMOVED', 'DECLINED', 'UNKNOWN']);
export const MEDIA_STATES = Object.freeze(['NOT_INITIALIZED', 'INITIALIZING', 'ACTIVE', 'DEGRADED', 'INTERRUPTED', 'STOPPED', 'FAILED']);
export const RECORDING_STATES = Object.freeze(['PROHIBITED', 'NOT_REQUESTED', 'REQUESTED', 'AUTHORIZED', 'ACTIVE', 'STOPPED', 'FAILED', 'DELETED', 'RETENTION_EXPIRED']);
export const TRANSCRIPT_STATES = Object.freeze(['NOT_STARTED', 'CAPTURING', 'PARTIAL', 'FINALIZED', 'FAILED', 'REDACTED']);
export const PRIVACY_CLASSES = Object.freeze(['SUBSCRIBER_PRIVATE', 'COACH_SHARED', 'BUSINESS_ENGINE_ELIGIBLE', 'RESTRICTED_SENSITIVE', 'REDACTED', 'LEARNING_INELIGIBLE', 'LEARNING_CANDIDATE']);
export const ARTIFACT_TYPES = Object.freeze(['FACT_CLAIM', 'GOAL', 'OBSERVATION', 'RECOMMENDATION', 'COMMITMENT', 'CONTRADICTION', 'MISSING_EVIDENCE', 'INTERVENTION']);
export const CONSENT_PURPOSES = Object.freeze(['PARTICIPATION', 'TRANSCRIPTION', 'RECORDING', 'STRUCTURED_EXTRACTION', 'COACH_SHARING', 'BUSINESS_ENGINE_EVALUATION', 'FUTURE_LEARNING']);

export const DEFAULT_LIVE_SESSION_FLAGS = deepFreeze({
  live_session_enabled: false,
  session_establishment_enabled: false,
  provider_adapter_enabled: false,
  transcription_enabled: false,
  extraction_enabled: false,
  coach_review_enabled: false,
  engine_evaluation_enabled: false,
  subscriber_confirmation_enabled: false,
  projection_refresh_enabled: false,
  synthetic_proof_enabled: false,
  synthetic_only: true,
  live_media_enabled: false,
  live_model_enabled: false,
  production_traffic_enabled: false,
  emergency_disabled: true,
});

const CAPABILITY_FLAGS = Object.freeze({
  SESSION: 'session_establishment_enabled', PROVIDER: 'provider_adapter_enabled', TRANSCRIPTION: 'transcription_enabled',
  EXTRACTION: 'extraction_enabled', REVIEW: 'coach_review_enabled', ENGINE: 'engine_evaluation_enabled',
  CONFIRMATION: 'subscriber_confirmation_enabled', PROJECTION: 'projection_refresh_enabled', PROOF: 'synthetic_proof_enabled',
});

export function evaluateLiveSessionActivation({ flags = DEFAULT_LIVE_SESSION_FLAGS, parentDecision = { allowed: false }, capability }) {
  let code = 'ACTIVE';
  if (flags.emergency_disabled !== false) code = 'EMERGENCY_DISABLED';
  else if (flags.live_session_enabled !== true) code = 'LIVE_SESSION_DISABLED';
  else if (parentDecision?.allowed !== true) code = 'PARENT_AUTHORITY_DISABLED';
  else if (flags.synthetic_only !== true || flags.live_media_enabled === true || flags.live_model_enabled === true || flags.production_traffic_enabled === true) code = 'PRODUCTION_ACTIVATION_DENIED';
  else if (!CAPABILITY_FLAGS[capability] || flags[CAPABILITY_FLAGS[capability]] !== true) code = 'CAPABILITY_DISABLED';
  return deepFreeze({ allowed: code === 'ACTIVE', code, capability });
}

export const COACH_CONNECT_PRIVACY_MAP = deepFreeze({
  SUBSCRIBER_PRIVATE: 'COACH_SESSION_PRIVATE',
  COACH_SHARED: 'COACH_ATTRIBUTED_SHAREABLE',
  BUSINESS_ENGINE_ELIGIBLE: 'TENANT_PRIVATE_BUSINESS_ENGINE',
  RESTRICTED_SENSITIVE: 'COACH_SESSION_PRIVATE',
  REDACTED: 'SYSTEM_INTERNAL',
  LEARNING_INELIGIBLE: 'COACH_SESSION_PRIVATE',
  LEARNING_CANDIDATE: 'COACH_SESSION_PRIVATE',
});
