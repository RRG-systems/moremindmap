import { AUTHORITY_TYPES, PRIVACY_CLASSIFICATIONS, TRUTH_CLASSES, VALIDATION_ERROR_CODES, VALIDATION_WARNING_CODES } from './constants.js';
import { createPayloadHash, isValidPayloadHash } from './hashing.js';
import { validateEventIdentityScope } from './identity.js';
import { validateProvenanceRecord } from './provenanceReceipts.js';
import { deepFreeze, isPlainObject, issue, requireEnum, requireString, validateTimestamp, validationResult } from './validation.js';

export const INTELLIGENCE_EVENT_CONTRACT = 'IntelligenceEvent';
export const INTELLIGENCE_EVENT_SCHEMA_VERSION = '1.0.0';
export const IMMUTABLE_EVENT_FIELDS = Object.freeze(['event_id', 'event_type', 'schema_version', 'payload', 'payload_hash', 'recorded_at', 'tenant_id']);
const EVENT_TYPE_PATTERN = /^[A-Z][A-Z0-9_]{2,127}$/;

function validateAuthorityTruth(event, errors, warnings) {
  const hardConflicts = [
    ['USER_GOAL_RECORDED', 'OBSERVED_TRUTH'], ['COACH_RECOMMENDATION_RECORDED', 'OBSERVED_TRUTH'],
    ['KPI_EVIDENCE_RECORDED', 'PERSONAL_TRUTH'],
  ];
  if (hardConflicts.some(([type, truth]) => event.event_type === type && event.truth_class === truth)) errors.push(issue(VALIDATION_ERROR_CODES.AUTHORITY_TRUTH_CONFLICT, 'truth_class', 'event type and truth class conflict with constitutional doctrine'));
  if (event.authority_type === 'UNIVERSAL_COACHING' && event.truth_class !== 'INTERVENTION_TRUTH') warnings.push(issue(VALIDATION_WARNING_CODES.SUSPICIOUS_AUTHORITY_TRUTH, 'truth_class', 'universal coaching claims normally require intervention truth provenance', 'WARNING'));
}

export function validateIntelligenceEvent(value, { now = new Date().toISOString() } = {}) {
  const errors = [], warnings = [];
  if (!isPlainObject(value)) return validationResult(INTELLIGENCE_EVENT_CONTRACT, [issue(VALIDATION_ERROR_CODES.INVALID_TYPE, '$', 'event must be a plain object')]);
  requireString(value.event_id, 'event_id', errors);
  if (!requireString(value.event_type, 'event_type', errors) || !EVENT_TYPE_PATTERN.test(value.event_type || '')) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_TYPE, 'event_type', 'event_type must be an uppercase stable identifier'));
  if (value.schema_version !== INTELLIGENCE_EVENT_SCHEMA_VERSION) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_ENUM, 'schema_version', `schema_version must be ${INTELLIGENCE_EVENT_SCHEMA_VERSION}`));
  const identity = validateEventIdentityScope(value); if (!identity.valid) errors.push(...identity.errors);
  requireEnum(value.authority_type, AUTHORITY_TYPES, 'authority_type', errors);
  requireEnum(value.truth_class, TRUTH_CLASSES, 'truth_class', errors);
  requireEnum(value.privacy_classification, PRIVACY_CLASSIFICATIONS, 'privacy_classification', errors);
  if (!Array.isArray(value.consent_scope)) errors.push(issue(VALIDATION_ERROR_CODES.CONSENT_REQUIRED, 'consent_scope', 'consent_scope must be an explicit array, including empty when no consent grant applies'));
  for (const key of ['source_actor', 'source_artifact', 'source_system', 'created_by']) if (!isPlainObject(value[key])) errors.push(issue(VALIDATION_ERROR_CODES.REQUIRED, key, `${key} must be an attributed reference object`));
  for (const [key, required] of [['occurred_at', true], ['observed_at', false], ['recorded_at', true], ['effective_at', true], ['expires_at', false]]) validateTimestamp(value[key], key, errors, required);
  if (value.expires_at && value.effective_at && Date.parse(value.expires_at) < Date.parse(value.effective_at)) errors.push(issue(VALIDATION_ERROR_CODES.TEMPORAL_ORDER, 'expires_at', 'expiration cannot precede effective time'));
  if (value.recorded_at && value.occurred_at && Date.parse(value.recorded_at) > Date.parse(value.occurred_at)) warnings.push(issue(VALIDATION_WARNING_CODES.LATE_ARRIVAL, 'recorded_at', 'event was recorded after it occurred', 'WARNING'));
  if (value.occurred_at && Date.parse(value.occurred_at) > Date.parse(now)) warnings.push(issue(VALIDATION_WARNING_CODES.FUTURE_EVENT, 'occurred_at', 'future occurrence remains distinguishable', 'WARNING'));
  if (!isPlainObject(value.payload) && !Array.isArray(value.payload)) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_JSON, 'payload', 'payload must be a JSON-safe object or array'));
  else {
    try { const expected = createPayloadHash(value.payload); if (!isValidPayloadHash(value.payload_hash) || value.payload_hash !== expected) errors.push(issue(VALIDATION_ERROR_CODES.HASH_MISMATCH, 'payload_hash', 'payload_hash does not match canonical payload')); }
    catch { errors.push(issue(VALIDATION_ERROR_CODES.INVALID_JSON, 'payload', 'payload is not canonical JSON-safe')); }
  }
  requireString(value.idempotency_key, 'idempotency_key', errors);
  if (value.correction_of_event_id && value.correction_of_event_id === value.event_id) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_ID, 'correction_of_event_id', 'correction must reference a prior event'));
  if (value.supersedes_event_id && value.supersedes_event_id === value.event_id) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_ID, 'supersedes_event_id', 'supersession must reference a prior event'));
  const provenance = validateProvenanceRecord(value.provenance, { synthetic: value.source_system?.kind === 'MODEL' });
  if (!provenance.valid) errors.push(...provenance.errors.map((entry) => ({ ...entry, path: `provenance.${entry.path}` })));
  validateAuthorityTruth(value, errors, warnings);
  return validationResult(INTELLIGENCE_EVENT_CONTRACT, errors, warnings, errors.length ? null : deepFreeze({ ...value }));
}

export function createIntelligenceEvent(value) {
  const candidate = { ...value, schema_version: value.schema_version ?? INTELLIGENCE_EVENT_SCHEMA_VERSION,
    payload_hash: value.payload_hash ?? createPayloadHash(value.payload) };
  const validation = validateIntelligenceEvent(candidate);
  return Object.freeze({ event: validation.valid ? validation.normalized_value : null, validation });
}
