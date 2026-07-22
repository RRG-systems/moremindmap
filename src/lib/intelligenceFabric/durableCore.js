import {
  AUTHORITY_TYPES, PRIVACY_CLASSIFICATIONS, TRUTH_CLASSES, VALIDATION_ERROR_CODES,
} from './constants.js';
import {
  DURABLE_CORE_CONTRACT_VERSION, DURABLE_OBJECT_TYPES, OBJECT_AUTHORITY, OBJECT_TRUTH_CLASS,
  INTERVENTION_STATUSES, INTERVENTION_TRANSITIONS, LEARNING_STATES, CONVERSATION_EVENT_TYPES, CONFIDENCE_DIMENSIONS,
} from './durableCoreConstants.js';
import { canonicalJson } from './hashing.js';
import { validateEventIdentityScope } from './identity.js';
import { validateIntelligenceEvent } from './intelligenceEvent.js';
import { validateProvenanceRecord } from './provenanceReceipts.js';
import {
  deepFreeze, isPlainObject, issue, requireEnum, requireString, validateTimestamp, validationResult,
} from './validation.js';

const REQUIRED_FIELDS = Object.freeze({
  UserIntentState: ['intent_state_id', 'goal_claims', 'desired_future', 'status', 'source_event_ids', 'version'],
  UserEvidenceLedger: ['ledger_id', 'scope', 'evidence_entries', 'verification_state', 'completeness_state', 'status', 'version'],
  RealEstateKnowledgeGraph: ['knowledge_graph_id', 'graph_version', 'claim_nodes', 'source_nodes', 'relationships', 'refresh_status', 'review_status'],
  HumanJudgmentAuthority: ['human_judgment_authority_id', 'subject_scope', 'authority_actor_ref', 'relationship_ref', 'observation_records', 'recommendation_records', 'status', 'version'],
  CoachingInterventionLibrary: ['library_id', 'interventions', 'status', 'version'],
  MarketContextGraph: ['market_context_graph_id', 'market_scope', 'indicator_nodes', 'relationships', 'effective_window', 'refresh_status', 'version'],
  OutcomeValidationLedger: ['ledger_id', 'outcome_records', 'status', 'version'],
  AuthorityConflictGraph: ['conflict_graph_id', 'conflicts', 'resolutions', 'status', 'version'],
  BeliefState: ['belief_state_id', 'beliefs', 'status', 'version'],
  BusinessEngineState: ['business_engine_state_id', 'vertical_id', 'operating_policy_id', 'state_version', 'financial_reality', 'behavioral_reality', 'business_model_alignment', 'constraint_reality', 'confidence_reality', 'current_operating_state', 'belief_ids', 'evidence_ids', 'status'],
  BusinessEngineStateVersion: ['state_version_id', 'business_engine_state_id', 'state_version', 'projection_version', 'policy_version', 'material_changes', 'changed_fields', 'unchanged_fields', 'validation_status'],
  FutureState: ['future_state_id', 'stable_future_identity', 'name', 'trajectory_type', 'probability', 'status', 'supporting_belief_ids', 'time_horizon'],
  FutureProbabilityChange: ['probability_change_id', 'future_state_id', 'from_probability', 'to_probability', 'delta', 'reason', 'policy_version', 'explanation_trace_id'],
  InterventionState: ['intervention_state_id', 'intervention_id', 'status', 'target_constraint_ids', 'expected_outcomes', 'required_execution', 'success_metrics', 'stop_conditions'],
  InterventionEvent: ['intervention_event_id', 'intervention_state_id', 'from_status', 'to_status', 'intelligence_event'],
  ConversationSession: ['session_id', 'state_snapshot_id', 'belief_state_id', 'future_state_ids', 'evidence_gap_ids', 'weekly_update_status', 'status'],
  ConversationEvent: ['conversation_event_id', 'session_id', 'conversation_event_type', 'confirmation_state', 'status'],
  EvidenceGap: ['evidence_gap_id', 'target_ids', 'gap_type', 'missing_data', 'priority', 'request_reason', 'status'],
  ConfidenceState: ['confidence_state_id', ...CONFIDENCE_DIMENSIONS, 'status'],
  ExplanationTrace: ['explanation_trace_id', 'operation', 'operation_version', 'input_ids', 'authority_routes', 'changed_outputs', 'unchanged_outputs', 'human_review_required'],
  LearningPromotionRecord: ['learning_promotion_id', 'candidate_id', 'from_state', 'to_state', 'source_outcome_ids', 'replication_count', 'privacy_review', 'consent_review', 'causal_review', 'status'],
  ExperimentRecord: ['experiment_id', 'hypothesis', 'target_ids', 'intervention_id', 'baseline_reference', 'duration', 'success_metric', 'expected_result', 'stop_condition', 'execution_evidence_ids', 'confounders', 'promotion_status', 'status'],
  VerticalOperatingPolicy: ['operating_policy_id', 'vertical_id', 'role_scope', 'business_model_scope', 'required_weekly_metrics', 'evidence_frequency', 'staleness_rules', 'confidence_requirements', 'question_priority_rules', 'constraint_taxonomy_version', 'future_policy_version', 'intervention_policy_version', 'status'],
});

const ID_FIELD = Object.freeze(Object.fromEntries(DURABLE_OBJECT_TYPES.map((name) => [name, ({
    UserIntentState: 'intent_state_id', UserEvidenceLedger: 'ledger_id', RealEstateKnowledgeGraph: 'knowledge_graph_id',
    HumanJudgmentAuthority: 'human_judgment_authority_id', CoachingInterventionLibrary: 'library_id',
    MarketContextGraph: 'market_context_graph_id', OutcomeValidationLedger: 'ledger_id', AuthorityConflictGraph: 'conflict_graph_id',
    BeliefState: 'belief_state_id', BusinessEngineState: 'business_engine_state_id', BusinessEngineStateVersion: 'state_version_id',
    FutureState: 'future_state_id', FutureProbabilityChange: 'probability_change_id', InterventionState: 'intervention_state_id',
    InterventionEvent: 'intervention_event_id', ConversationSession: 'session_id', ConversationEvent: 'conversation_event_id',
    EvidenceGap: 'evidence_gap_id', ConfidenceState: 'confidence_state_id', ExplanationTrace: 'explanation_trace_id',
    LearningPromotionRecord: 'learning_promotion_id', ExperimentRecord: 'experiment_id', VerticalOperatingPolicy: 'operating_policy_id',
  })[name]])));

function jsonSafe(value) { try { canonicalJson(value); return true; } catch { return false; } }

function validateCommon(value, contractName, errors) {
  if (!isPlainObject(value)) { errors.push(issue(VALIDATION_ERROR_CODES.INVALID_TYPE, '$', `${contractName} must be a plain object`)); return; }
  if (value.object_type !== contractName) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_ENUM, 'object_type', `object_type must be ${contractName}`));
  if (value.contract_version !== DURABLE_CORE_CONTRACT_VERSION || value.schema_version !== DURABLE_CORE_CONTRACT_VERSION) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_ENUM, 'contract_version', `contract and schema versions must be ${DURABLE_CORE_CONTRACT_VERSION}`));
  requireString(value[ID_FIELD[contractName]], ID_FIELD[contractName], errors);
  const scope = validateEventIdentityScope(value); if (!scope.valid) errors.push(...scope.errors);
  requireEnum(value.authority_type, AUTHORITY_TYPES, 'authority_type', errors);
  requireEnum(value.truth_class, TRUTH_CLASSES, 'truth_class', errors);
  if (value.authority_type !== OBJECT_AUTHORITY[contractName]) errors.push(issue(VALIDATION_ERROR_CODES.AUTHORITY_TRUTH_CONFLICT, 'authority_type', `${contractName} authority must remain ${OBJECT_AUTHORITY[contractName]}`));
  if (value.truth_class !== OBJECT_TRUTH_CLASS[contractName]) errors.push(issue(VALIDATION_ERROR_CODES.AUTHORITY_TRUTH_CONFLICT, 'truth_class', `${contractName} truth class must remain ${OBJECT_TRUTH_CLASS[contractName]}`));
  requireEnum(value.privacy_classification, PRIVACY_CLASSIFICATIONS, 'privacy_classification', errors);
  if (!Array.isArray(value.consent_record_ids)) errors.push(issue(VALIDATION_ERROR_CODES.CONSENT_REQUIRED, 'consent_record_ids', 'consent_record_ids must be explicit'));
  if (!Array.isArray(value.source_event_ids)) errors.push(issue(VALIDATION_ERROR_CODES.PROVENANCE_REQUIRED, 'source_event_ids', 'source_event_ids must be explicit'));
  const provenance = validateProvenanceRecord(value.provenance); if (!provenance.valid) errors.push(...provenance.errors.map((x) => ({ ...x, path: `provenance.${x.path}` })));
  validateTimestamp(value.created_at, 'created_at', errors, true); validateTimestamp(value.updated_at, 'updated_at', errors, true);
  validateTimestamp(value.effective_at, 'effective_at', errors, true); validateTimestamp(value.expires_at, 'expires_at', errors);
  if (!Number.isInteger(value.version) || value.version < 1) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_TYPE, 'version', 'version must be a positive integer'));
  if (value.previous_version_id === value[ID_FIELD[contractName]] || value.supersedes_id === value[ID_FIELD[contractName]]) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_ID, 'previous_version_id', 'object cannot reference itself as previous or superseded'));
  if (!jsonSafe(value)) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_JSON, '$', `${contractName} must be JSON-safe`));
  for (const field of REQUIRED_FIELDS[contractName]) if (value[field] == null) errors.push(issue(VALIDATION_ERROR_CODES.REQUIRED, field, `${field} is required`));
}

function validateSpecific(value, name, errors) {
  if (name === 'UserIntentState' && value.inferred === true && value.confirmation_state !== 'USER_CONFIRMED') errors.push(issue(VALIDATION_ERROR_CODES.CONSENT_REQUIRED, 'confirmation_state', 'inferred user intent requires user confirmation'));
  if (name === 'UserEvidenceLedger') for (const [i, e] of (value.evidence_entries || []).entries()) {
    if (e.correction_of_evidence_id && !value.evidence_entries.some((x) => x.evidence_id === e.correction_of_evidence_id)) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_ID, `evidence_entries.${i}.correction_of_evidence_id`, 'correction must reference preserved ledger evidence'));
    if (e.verification_method === 'USER_ENTERED' && e.verification_state === 'EXTERNALLY_VERIFIED') errors.push(issue(VALIDATION_ERROR_CODES.AUTHORITY_TRUTH_CONFLICT, `evidence_entries.${i}.verification_state`, 'user entry is not externally verified'));
  }
  if (name === 'RealEstateKnowledgeGraph') for (const [i, c] of (value.claim_nodes || []).entries()) {
    if (!Array.isArray(c.supporting_source_ids) || c.supporting_source_ids.some((id) => !(value.source_nodes || []).some((s) => s.source_id === id))) errors.push(issue(VALIDATION_ERROR_CODES.PROVENANCE_REQUIRED, `claim_nodes.${i}.supporting_source_ids`, 'claim sources must resolve in graph'));
    if (c.claim_type === 'BENCHMARK' && (!c.unit || !c.applicability || !c.effective_at)) errors.push(issue(VALIDATION_ERROR_CODES.REQUIRED, `claim_nodes.${i}`, 'benchmark requires unit, scope, date, and source'));
  }
  if (name === 'HumanJudgmentAuthority') {
    if (value.privacy_classification !== 'COACH_SESSION_PRIVATE') errors.push(issue(VALIDATION_ERROR_CODES.INVALID_ENUM, 'privacy_classification', 'human judgment defaults to COACH_SESSION_PRIVATE'));
    if (!value.relationship_ref || !(value.consent_record_ids || []).length) errors.push(issue(VALIDATION_ERROR_CODES.CONSENT_REQUIRED, 'relationship_ref', 'human judgment requires relationship and consent references'));
  }
  if (name === 'BeliefState') for (const [i, b] of (value.beliefs || []).entries()) {
    if (!(b.supporting_evidence_ids || []).length && !b.explicit_uncertainty) errors.push(issue(VALIDATION_ERROR_CODES.PROVENANCE_REQUIRED, `beliefs.${i}`, 'belief requires support or explicit uncertainty'));
    if (b.change_reason == null && b.non_change_reason == null) errors.push(issue(VALIDATION_ERROR_CODES.REQUIRED, `beliefs.${i}`, 'belief requires change or non-change reason'));
    if (b.probability != null && (b.probability < 0 || b.probability > 1)) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_TYPE, `beliefs.${i}.probability`, 'probability must be bounded'));
  }
  if (name === 'FutureState' && (value.probability < 0 || value.probability > 1)) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_TYPE, 'probability', 'future probability must be between zero and one'));
  if (name === 'FutureProbabilityChange') {
    if ([value.from_probability, value.to_probability].some((p) => typeof p !== 'number' || p < 0 || p > 1)) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_TYPE, 'from_probability', 'probability change endpoints must be bounded'));
    if (Math.abs((value.to_probability - value.from_probability) - value.delta) > 1e-9) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_TYPE, 'delta', 'delta must equal to_probability minus from_probability'));
  }
  if (name === 'OutcomeValidationLedger') for (const [i, o] of (value.outcome_records || []).entries()) {
    if (o.effectiveness_status === 'VALIDATED_EFFECTIVE' && !(o.execution_evidence_ids || []).length) errors.push(issue(VALIDATION_ERROR_CODES.PROVENANCE_REQUIRED, `outcome_records.${i}`, 'effectiveness requires execution evidence'));
    if (o.privacy_classification !== 'ANONYMIZED_AGGREGATE' && o.learning_eligibility !== false) errors.push(issue(VALIDATION_ERROR_CODES.CONSENT_REQUIRED, `outcome_records.${i}.learning_eligibility`, 'private outcomes default learning-ineligible'));
  }
  if (name === 'LearningPromotionRecord') {
    const from = LEARNING_STATES.indexOf(value.from_state), to = LEARNING_STATES.indexOf(value.to_state);
    if (!LEARNING_STATES.includes(value.from_state) || !LEARNING_STATES.includes(value.to_state) || (to > from + 1 && !['REJECTED', 'RETIRED'].includes(value.to_state))) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_ENUM, 'to_state', 'learning promotion cannot skip validation stages'));
    if (value.replication_count !== (value.source_outcome_ids || []).length) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_TYPE, 'replication_count', 'replication count must match distinct source outcomes'));
    if (value.to_state === 'CANONICAL' && (!value.human_approval || value.source_outcome_ids.length < 2)) errors.push(issue(VALIDATION_ERROR_CODES.CONSENT_REQUIRED, 'human_approval', 'canonical promotion requires human approval and replicated outcomes'));
  }
  if (name === 'ConfidenceState' && value.master_confidence != null) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_TYPE, 'master_confidence', 'a single master confidence score is prohibited'));
  if (name === 'ConversationEvent' && ['EXTRACTION_PROPOSAL', 'EVIDENCE_CAPTURE_CANDIDATE'].includes(value.conversation_event_type) && value.confirmation_state === 'DURABLE_ACCEPTED') errors.push(issue(VALIDATION_ERROR_CODES.CONSENT_REQUIRED, 'confirmation_state', 'proposal cannot become durable without a separate confirmation event'));
  if (name === 'ExplanationTrace' && ['raw_payload', 'transcript', 'chain_of_thought'].some((key) => key in value)) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_TYPE, '$', 'ExplanationTrace excludes raw private payloads and hidden chain of thought'));
  if (name === 'InterventionState') requireEnum(value.status, INTERVENTION_STATUSES, 'status', errors);
  if (name === 'InterventionEvent') {
    if (!(INTERVENTION_TRANSITIONS[value.from_status] || []).includes(value.to_status)) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_ENUM, 'to_status', 'InterventionEvent must represent a valid lifecycle transition'));
    const event = validateIntelligenceEvent(value.intelligence_event); if (!event.valid) errors.push(...event.errors.map((x) => ({ ...x, path: `intelligence_event.${x.path}` })));
  }
  if (name === 'ConversationEvent') requireEnum(value.conversation_event_type, CONVERSATION_EVENT_TYPES, 'conversation_event_type', errors);
}

export function validateDurableObject(value, contractName) {
  const errors = [], warnings = [];
  if (!DURABLE_OBJECT_TYPES.includes(contractName)) return validationResult(contractName, [issue(VALIDATION_ERROR_CODES.INVALID_ENUM, 'contract_name', 'unknown durable contract')]);
  validateCommon(value, contractName, errors); if (isPlainObject(value)) validateSpecific(value, contractName, errors, warnings);
  return validationResult(contractName, errors, warnings, errors.length ? null : deepFreeze({ ...value }));
}

export function buildDurableObject(contractName, value) {
  const candidate = { contract_version: DURABLE_CORE_CONTRACT_VERSION, schema_version: DURABLE_CORE_CONTRACT_VERSION,
    object_type: contractName, validation_state: 'VALIDATED', ...value };
  const validation = validateDurableObject(candidate, contractName);
  return Object.freeze({ value: validation.normalized_value, validation });
}

const names = DURABLE_OBJECT_TYPES;
export const DURABLE_CONTRACT_REGISTRY = deepFreeze(Object.fromEntries(names.map((name) => [name, {
  contract_name: name, contract_version: DURABLE_CORE_CONTRACT_VERSION, id_field: ID_FIELD[name],
  authority_type: OBJECT_AUTHORITY[name], truth_class: OBJECT_TRUTH_CLASS[name], required_fields: REQUIRED_FIELDS[name],
}])));

export const validateUserIntentState = (v) => validateDurableObject(v, 'UserIntentState');
export const validateUserEvidenceLedger = (v) => validateDurableObject(v, 'UserEvidenceLedger');
export const validateRealEstateKnowledgeGraph = (v) => validateDurableObject(v, 'RealEstateKnowledgeGraph');
export const validateHumanJudgmentAuthority = (v) => validateDurableObject(v, 'HumanJudgmentAuthority');
export const validateCoachingInterventionLibrary = (v) => validateDurableObject(v, 'CoachingInterventionLibrary');
export const validateMarketContextGraph = (v) => validateDurableObject(v, 'MarketContextGraph');
export const validateOutcomeValidationLedger = (v) => validateDurableObject(v, 'OutcomeValidationLedger');
export const validateAuthorityConflictGraph = (v) => validateDurableObject(v, 'AuthorityConflictGraph');
export const validateBeliefState = (v) => validateDurableObject(v, 'BeliefState');
export const validateBusinessEngineState = (v) => validateDurableObject(v, 'BusinessEngineState');
export const validateBusinessEngineStateVersion = (v) => validateDurableObject(v, 'BusinessEngineStateVersion');
export const validateFutureState = (v) => validateDurableObject(v, 'FutureState');
export const validateFutureProbabilityChange = (v) => validateDurableObject(v, 'FutureProbabilityChange');
export const validateInterventionState = (v) => validateDurableObject(v, 'InterventionState');
export const validateInterventionEvent = (v) => validateDurableObject(v, 'InterventionEvent');
export const validateConversationSession = (v) => validateDurableObject(v, 'ConversationSession');
export const validateConversationEvent = (v) => validateDurableObject(v, 'ConversationEvent');
export const validateEvidenceGap = (v) => validateDurableObject(v, 'EvidenceGap');
export const validateConfidenceState = (v) => validateDurableObject(v, 'ConfidenceState');
export const validateExplanationTrace = (v) => validateDurableObject(v, 'ExplanationTrace');
export const validateLearningPromotionRecord = (v) => validateDurableObject(v, 'LearningPromotionRecord');
export const validateExperimentRecord = (v) => validateDurableObject(v, 'ExperimentRecord');
export const validateVerticalOperatingPolicy = (v) => validateDurableObject(v, 'VerticalOperatingPolicy');
