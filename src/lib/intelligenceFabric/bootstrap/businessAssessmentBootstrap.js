import { buildDurableObject } from '../durableCore.js';
import { OBJECT_AUTHORITY, OBJECT_TRUTH_CLASS } from '../durableCoreConstants.js';
import { hashCanonicalJson } from '../hashing.js';
import { deepFreeze } from '../validation.js';

const KNOWN_DOMAINS = new Set(['contract_metadata', 'identity', 'vertical_context', 'current_business_reality',
  'governing_business_pattern', 'behavioral_modifier', 'business_model_alignment', 'business_engine_dimensions',
  'relationship_lake', 'current_trajectory', 'potential_business_future', 'potential_trajectory', 'primary_constraint',
  'causal_explanation', 'no_change_consequence', 'future_change_logic', 'one_move', 'modeled_opportunity',
  'confidence_reality', 'truth_boundaries', 'truth_rail', 'footer_intelligence', 'goal_intelligence',
  'real_estate_target_model', 'future_alignment']);
const EXCLUSIONS = Object.freeze({ potential_business_future: 'FUTURE_EXCLUDED', potential_trajectory: 'FUTURE_EXCLUDED',
  future_change_logic: 'FUTURE_EXCLUDED', future_alignment: 'FUTURE_EXCLUDED', modeled_opportunity: 'FUTURE_EXCLUDED',
  one_move: 'RECOMMENDATION_EXCLUDED', no_change_consequence: 'RECOMMENDATION_EXCLUDED', truth_rail: 'PRESENTATION_EXCLUDED',
  footer_intelligence: 'PRESENTATION_EXCLUDED', relationship_lake: 'PRESENTATION_EXCLUDED', goal_intelligence: 'INTENT_EXCLUDED',
  real_estate_target_model: 'INTENT_EXCLUDED', current_trajectory: 'PREDICTION_RISK_EXCLUDED' });

function base(type, id, input, privacy = 'TENANT_PRIVATE') {
  const at = input.contract.contract_metadata.generated_at;
  return { object_type: type, contract_version: '1.0.0', schema_version: '1.0.0', object_id: id,
    tenant_id: input.tenant_id, profile_id: input.profile_id, business_id: input.business_id,
    organization_id: input.organization_id ?? null, subscription_id: input.subscription_id ?? null,
    status: 'ACTIVE', created_at: at, updated_at: at, effective_at: at, expires_at: null,
    authority_type: OBJECT_AUTHORITY[type], truth_class: OBJECT_TRUTH_CLASS[type],
    source_event_ids: [input.source_event_id], provenance: input.provenance, privacy_classification: privacy,
    consent_record_ids: input.consent_record_ids ?? [], version: 1, previous_version_id: null,
    supersedes_id: null, validation_state: 'VALIDATED' };
}
const nodeValue = (node) => node && typeof node === 'object' && 'current' in node ? node.current : null;
const nodeEvidence = (node) => Array.isArray(node?.evidence_sources) ? node.evidence_sources.filter((x) => typeof x === 'string') : [];
const stateField = (current, evidenceIds, at, missingReason = null) => ({ current, previous: null, trend: 'BASELINE',
  reason_for_change: current == null ? null : 'INITIAL_ASSESSMENT_SNAPSHOT',
  reason_for_non_change: current == null ? (missingReason || 'MISSING_OR_UNSUPPORTED') : null,
  evidence_sources: evidenceIds, confidence: current == null ? 0 : 0.5, last_updated: at });

export function projectBusinessAssessmentSnapshot(input) {
  const errors = [];
  const meta = input?.contract?.contract_metadata;
  if (!meta || meta.contract_name !== 'business_engine_contract' || meta.contract_version !== 'business-engine-contract-v1' || meta.snapshot_mode !== true || meta.customer_facing_model_names_exposed === true) errors.push({ code: 'BOOTSTRAP_CONTRACT_INVALID', path: 'contract_metadata' });
  for (const key of ['tenant_id', 'profile_id', 'business_id', 'source_event_id']) if (!input?.[key]) errors.push({ code: 'BOOTSTRAP_SCOPE_REQUIRED', path: key });
  if (errors.length) return deepFreeze({ ok: false, status: 'INVALID_INPUT', errors });
  const at = meta.generated_at, prefix = hashCanonicalJson({ tenant_id: input.tenant_id, business_id: input.business_id, assessment_id: meta.source_assessment_id }).slice(0, 16);
  const currentNode = input.contract.current_business_reality, current = nodeValue(currentNode);
  const evidenceIds = [...new Set([...(input.evidence_ids || []), ...nodeEvidence(currentNode)])];
  const beliefInputs = [
    ['BEHAVIORAL_INTERPRETATION', input.contract.behavioral_modifier],
    ['BUSINESS_MODEL_ALIGNMENT', input.contract.business_model_alignment],
    ['CONSTRAINT_HYPOTHESIS', input.contract.primary_constraint],
  ].filter(([, node]) => nodeValue(node) != null);
  const beliefs = beliefInputs.map(([claimType, node], i) => ({ belief_id: `belief_bootstrap_${prefix}_${i + 1}`,
    claim: `Bootstrap ${claimType.toLowerCase()} retained as uncertain assessment interpretation.`, claim_type: claimType,
    scope: { business_id: input.business_id }, probability: null, confidence_band: 'UNVALIDATED_BOOTSTRAP', confidence_score: 0.35,
    supporting_evidence_ids: nodeEvidence(node), contradicting_evidence_ids: [], authority_positions: [], knowledge_claim_ids: [],
    market_context_ids: [], human_judgment_ids: [], outcome_ids: [], conflict_ids: [], causal_hypothesis: null,
    alternative_hypotheses: [], validation_level: 'BOOTSTRAP_HYPOTHESIS', last_changed_at: at,
    change_reason: 'INITIAL_ASSESSMENT_SNAPSHOT', non_change_reason: null, next_best_evidence: 'DIRECT_VERIFIED_MEASUREMENT',
    evidence_gap_ids: [], status: 'ACTIVE', provenance: input.provenance,
    explicit_uncertainty: nodeEvidence(node).length === 0 }));
  if (beliefs.length === 0) beliefs.push({ belief_id: `belief_bootstrap_${prefix}_missing`, claim: 'Assessment interpretations are unavailable.', claim_type: 'MISSINGNESS', scope: { business_id: input.business_id }, probability: null, confidence_band: 'INSUFFICIENT', confidence_score: 0, supporting_evidence_ids: [], contradicting_evidence_ids: [], authority_positions: [], knowledge_claim_ids: [], market_context_ids: [], human_judgment_ids: [], outcome_ids: [], conflict_ids: [], causal_hypothesis: null, alternative_hypotheses: [], validation_level: 'UNAVAILABLE', last_changed_at: at, change_reason: 'INITIAL_ASSESSMENT_SNAPSHOT', non_change_reason: null, next_best_evidence: 'COMPLETE_ASSESSMENT', evidence_gap_ids: [], status: 'SUSPENDED', provenance: input.provenance, explicit_uncertainty: true });
  const unsupported_fields = Object.entries(input.contract).filter(([key, value]) => value != null && (EXCLUSIONS[key] || !KNOWN_DOMAINS.has(key))).map(([path]) => ({ path, reason: EXCLUSIONS[path] || 'NO_POLICY_MAPPING' }));
  const requiredMetrics = input.vertical_operating_policy?.required_weekly_metrics || [];
  const availableKeys = new Set(current && typeof current === 'object' ? Object.keys(current) : []);
  const gaps = requiredMetrics.filter((metric) => !availableKeys.has(metric)).map((metric, i) => ({
    ...base('EvidenceGap', `gap_bootstrap_${prefix}_${i + 1}`, input), evidence_gap_id: `gap_bootstrap_${prefix}_${i + 1}`,
    target_ids: [`state_bootstrap_${prefix}`], gap_type: 'MISSING_REQUIRED_METRIC', missing_data: [metric], priority: 'POLICY_REQUIRED',
    expected_confidence_gain: 0.1, expected_future_impact: null, request_reason: 'Required by synthetic vertical operating policy.',
    recommended_question: `Provide the current ${metric} measurement.`, deferral: null, resolution_event_ids: [] }));
  const confidence = { ...base('ConfidenceState', `confidence_bootstrap_${prefix}`, input), confidence_state_id: `confidence_bootstrap_${prefix}`,
    evidence_completeness: requiredMetrics.length ? (requiredMetrics.length - gaps.length) / requiredMetrics.length : 0,
    evidence_quality: evidenceIds.length ? 0.5 : 0, state_confidence: current == null ? 0 : 0.5,
    belief_confidence: beliefs.some((x) => x.supporting_evidence_ids.length) ? 0.35 : 0,
    future_confidence: 'NOT_EVALUATED', intervention_confidence: 'NOT_EVALUATED', market_context_confidence: 'NOT_EVALUATED' };
  const trace = { ...base('ExplanationTrace', `trace_bootstrap_${prefix}`, input), explanation_trace_id: `trace_bootstrap_${prefix}`,
    operation: 'BOOTSTRAP_BUSINESS_ASSESSMENT_SNAPSHOT', operation_version: '1.0.0', input_ids: [input.source_event_id],
    authority_routes: [{ authority_type: 'USER_EVIDENCE', role: 'CURRENT_STATE_CANDIDATE' }, { authority_type: 'DOMAIN_KNOWLEDGE', role: 'INTERPRETATION_ONLY' }],
    dominant_authorities: ['USER_EVIDENCE'], subordinate_authorities: ['DOMAIN_KNOWLEDGE'], conflicts: [],
    evidence_inputs: evidenceIds, knowledge_inputs: input.knowledge_claim_ids || [], human_inputs: [], market_inputs: [],
    model_receipt_ids: ['NO_MODEL_USED'], prompt_receipt_ids: ['NO_PROMPT_USED'], policy_receipt_ids: [input.vertical_operating_policy?.operating_policy_id || 'NOT_CONFIGURED'],
    changed_outputs: ['initial_state'], unchanged_outputs: [], change_reasons: ['INITIAL_ASSESSMENT_SNAPSHOT'], non_change_reasons: [],
    missing_evidence: gaps.map((x) => x.evidence_gap_id), human_review_required: unsupported_fields.some((x) => x.reason === 'NO_POLICY_MAPPING'), timestamp: at,
    safe_summary: { operation: 'BOOTSTRAP_BUSINESS_ASSESSMENT_SNAPSHOT', unsupported_count: unsupported_fields.length, gap_count: gaps.length } };
  const beliefState = { ...base('BeliefState', `belief_state_bootstrap_${prefix}`, input), belief_state_id: `belief_state_bootstrap_${prefix}`, beliefs };
  const currentObject = current && typeof current === 'object' ? current : null;
  const state = { ...base('BusinessEngineState', `state_bootstrap_${prefix}`, input), business_engine_state_id: `state_bootstrap_${prefix}`,
    vertical_id: input.contract.vertical_context?.vertical_id || 'UNKNOWN', operating_policy_id: input.vertical_operating_policy?.operating_policy_id || 'NOT_CONFIGURED',
    state_version: 1, previous_state_version_id: null, as_of_at: at,
    financial_reality: stateField(currentObject?.financial_reality ?? currentObject?.annual_production ?? null, evidenceIds, at),
    behavioral_reality: stateField(null, [], at, 'ASSESSMENT_INTERPRETATION_RETAINED_AS_BELIEF'),
    business_model_alignment: stateField(null, [], at, 'ASSESSMENT_INTERPRETATION_RETAINED_AS_BELIEF'),
    constraint_reality: stateField(null, [], at, 'CONSTRAINT_RETAINED_AS_BELIEF'),
    confidence_reality: stateField({ confidence_state_id: confidence.confidence_state_id }, [], at),
    primary_constraint_id: beliefs.find((x) => x.claim_type === 'CONSTRAINT_HYPOTHESIS')?.belief_id || null,
    secondary_constraint_ids: [], current_operating_state: stateField(currentObject, evidenceIds, at),
    historical_comparison: null, trend_summary: 'BASELINE_NO_PRIOR_VERSION', belief_ids: beliefs.map((x) => x.belief_id),
    evidence_ids: evidenceIds.length ? evidenceIds : [input.source_event_id], knowledge_claim_ids: input.knowledge_claim_ids || [],
    market_context_ids: [], human_judgment_ids: [], conflict_ids: [], explanation_trace_id: trace.explanation_trace_id,
    confidence_state_id: confidence.confidence_state_id };
  const version = { ...base('BusinessEngineStateVersion', `state_version_bootstrap_${prefix}`, input), state_version_id: `state_version_bootstrap_${prefix}`,
    business_engine_state_id: state.business_engine_state_id, state_version: 1, previous_state_version_id: null,
    projection_version: 'ba-bootstrap-v1', policy_version: input.vertical_operating_policy?.contract_version || 'NOT_CONFIGURED',
    explanation_trace_id: trace.explanation_trace_id, generated_at: at, material_changes: ['INITIAL_STATE'], evaluated_non_material_inputs: [],
    changed_fields: ['financial_reality', 'current_operating_state'], unchanged_fields: [], validation_status: 'VALIDATED' };
  const objects = { business_engine_state: buildDurableObject('BusinessEngineState', state), business_engine_state_version: buildDurableObject('BusinessEngineStateVersion', version),
    belief_state: buildDurableObject('BeliefState', beliefState), confidence_state: buildDurableObject('ConfidenceState', confidence),
    explanation_trace: buildDurableObject('ExplanationTrace', trace), evidence_gaps: gaps.map((x) => buildDurableObject('EvidenceGap', x)) };
  const validationErrors = Object.entries(objects).flatMap(([key, value]) => Array.isArray(value) ? value.flatMap((x) => x.validation.errors.map((e) => ({ ...e, object: key }))) : value.validation.errors.map((e) => ({ ...e, object: key })));
  if (validationErrors.length) return deepFreeze({ ok: false, status: 'PROJECTION_INVALID', errors: validationErrors });
  return deepFreeze({ ok: true, status: 'PROJECTED', objects: {
    business_engine_state: objects.business_engine_state.value, business_engine_state_version: objects.business_engine_state_version.value,
    belief_state: objects.belief_state.value, confidence_state: objects.confidence_state.value,
    explanation_trace: objects.explanation_trace.value, evidence_gaps: objects.evidence_gaps.map((x) => x.value) },
    unsupported_fields, projection_hash: hashCanonicalJson({ objects: Object.fromEntries(Object.entries(objects).map(([k, v]) => [k, Array.isArray(v) ? v.map((x) => x.value) : v.value])), unsupported_fields }) });
}
