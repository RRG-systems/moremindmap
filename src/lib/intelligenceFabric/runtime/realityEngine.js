import { buildDurableObject } from '../durableCore.js';
import { OBJECT_AUTHORITY, OBJECT_TRUTH_CLASS } from '../durableCoreConstants.js';
import { hashCanonicalJson } from '../hashing.js';
import { deepFreeze } from '../validation.js';

const base = (type, id, input) => ({ object_type: type, contract_version: '1.0.0', schema_version: '1.0.0', object_id: id,
  tenant_id: input.tenant_id, profile_id: input.profile_id, business_id: input.business_id, organization_id: input.organization_id ?? null,
  subscription_id: input.subscription_id ?? null, authority_type: OBJECT_AUTHORITY[type], truth_class: OBJECT_TRUTH_CLASS[type],
  status: 'ACTIVE', created_at: input.as_of_at, updated_at: input.as_of_at, effective_at: input.as_of_at, expires_at: null,
  source_event_ids: input.source_event_ids, provenance: input.provenance, privacy_classification: 'TENANT_PRIVATE',
  consent_record_ids: input.consent_record_ids ?? [], version: input.next_version, previous_version_id: input.previous_version_id,
  supersedes_id: null, validation_state: 'VALIDATED' });

function currentEvidence(entries) {
  const superseded = new Set(entries.flatMap((x) => [x.correction_of_evidence_id, x.supersedes_evidence_id]).filter(Boolean));
  return entries.filter((x) => !superseded.has(x.evidence_id)).sort((a, b) => String(a.recorded_at).localeCompare(String(b.recorded_at)) || a.evidence_id.localeCompare(b.evidence_id));
}
const stateField = (current, previous, changed, ids, at, reason) => ({ current, previous, trend: changed ? 'CHANGED' : 'STABLE',
  reason_for_change: changed ? reason : null, reason_for_non_change: changed ? null : 'PROJECTION_UNCHANGED',
  evidence_sources: ids, confidence: ids.length ? 0.6 : 0, last_updated: at });

export function runRealityEngine(input) {
  const errors = [];
  for (const key of ['tenant_id', 'profile_id', 'business_id', 'as_of_at', 'evidence_ledger', 'vertical_operating_policy', 'provenance']) if (!input?.[key]) errors.push({ code: 'REALITY_INPUT_REQUIRED', path: key });
  if (errors.length) return deepFreeze({ ok: false, status: 'INVALID_INPUT', errors });
  const entries = currentEvidence(input.evidence_ledger.evidence_entries || []), metrics = Object.fromEntries(entries.filter((x) => x.metric_id).map((x) => [x.metric_id, { value: x.value, unit: x.unit, evidence_id: x.evidence_id }]));
  const prior = input.prior_state_version?.state_snapshot || input.prior_state || null;
  const priorMetrics = prior?.current_operating_state?.current || {};
  const changedMetricIds = Object.keys(metrics).filter((key) => JSON.stringify(metrics[key]?.value) !== JSON.stringify(priorMetrics[key]?.value));
  const required = input.vertical_operating_policy.required_weekly_metrics || [], missing = required.filter((key) => !metrics[key]);
  const staleMarket = (input.market_context_graph?.indicator_nodes || []).filter((x) => x.expires_at && Date.parse(x.expires_at) <= Date.parse(input.as_of_at));
  const unresolvedConflicts = (input.authority_conflict_graph?.conflicts || []).filter((x) => x.status === 'OPEN');
  const seed = hashCanonicalJson({ tenant: input.tenant_id, business: input.business_id, version: (prior?.state_version || 0) + 1, as_of: input.as_of_at }).slice(0, 16);
  const meta = { ...input, next_version: (prior?.version || input.prior_state_version?.version || 0) + 1,
    previous_version_id: input.prior_state_version?.state_version_id || null, source_event_ids: [...new Set(entries.map((x) => x.source_event_id).filter(Boolean))] };
  if (!meta.source_event_ids.length) meta.source_event_ids = input.source_event_ids || [];
  const gaps = [...missing.map((metric, i) => ({ ...base('EvidenceGap', `gap_reality_${seed}_${i + 1}`, meta), evidence_gap_id: `gap_reality_${seed}_${i + 1}`,
    target_ids: [`state_reality_${seed}`], gap_type: 'MISSING_REQUIRED_METRIC', missing_data: [metric], priority: 'POLICY_REQUIRED',
    expected_confidence_gain: 0.15, expected_future_impact: null, current_state_impact: 'HIGH', collection_cost: 'LOW', privacy_burden: 'LOW', staleness_urgency: 'CURRENT',
    request_reason: 'Required metric is missing from accepted current evidence.', recommended_question: `Provide ${metric}.`, deferral: null, resolution_event_ids: [] })),
    ...staleMarket.map((indicator, i) => ({ ...base('EvidenceGap', `gap_market_${seed}_${i + 1}`, meta), evidence_gap_id: `gap_market_${seed}_${i + 1}`,
      target_ids: [`state_reality_${seed}`], gap_type: 'STALE_MARKET_CONTEXT', missing_data: [indicator.indicator_id], priority: 'CONTEXT_STALE',
      expected_confidence_gain: 0.1, expected_future_impact: null, current_state_impact: 'MEDIUM', collection_cost: 'MEDIUM', privacy_burden: 'LOW', staleness_urgency: 'STALE',
      request_reason: 'Market indicator expired before the projection time.', recommended_question: 'Refresh the eligible market indicator.', deferral: null, resolution_event_ids: [] }))];
  const evidenceIds = entries.map((x) => x.evidence_id), currentMetrics = Object.fromEntries(Object.entries(metrics).map(([k, v]) => [k, v]));
  const state = { ...base('BusinessEngineState', `state_reality_${seed}`, meta), business_engine_state_id: `state_reality_${seed}`,
    vertical_id: input.vertical_operating_policy.vertical_id, operating_policy_id: input.vertical_operating_policy.operating_policy_id,
    state_version: meta.next_version, previous_state_version_id: meta.previous_version_id, as_of_at: input.as_of_at,
    financial_reality: stateField(currentMetrics, prior?.financial_reality?.current || null, changedMetricIds.length > 0, evidenceIds, input.as_of_at, 'QUALIFYING_EVIDENCE_CHANGED'),
    behavioral_reality: stateField(prior?.behavioral_reality?.current || null, prior?.behavioral_reality?.current || null, false, [], input.as_of_at),
    business_model_alignment: stateField(prior?.business_model_alignment?.current || null, prior?.business_model_alignment?.current || null, false, [], input.as_of_at),
    constraint_reality: stateField(prior?.constraint_reality?.current || null, prior?.constraint_reality?.current || null, false, [], input.as_of_at),
    confidence_reality: stateField({ confidence_state_id: `confidence_reality_${seed}` }, prior?.confidence_reality?.current || null, true, evidenceIds, input.as_of_at, 'CONFIDENCE_RECOMPUTED'),
    primary_constraint_id: input.primary_constraint_belief_id || prior?.primary_constraint_id || null,
    secondary_constraint_ids: input.secondary_constraint_ids || prior?.secondary_constraint_ids || [],
    current_operating_state: stateField(currentMetrics, priorMetrics, changedMetricIds.length > 0, evidenceIds, input.as_of_at, 'QUALIFYING_EVIDENCE_CHANGED'),
    historical_comparison: prior ? { previous_state_version_id: meta.previous_version_id } : null,
    trend_summary: changedMetricIds.length ? 'QUALIFYING_CURRENT_STATE_CHANGE' : 'NO_MATERIAL_CURRENT_STATE_CHANGE',
    belief_ids: input.belief_ids || prior?.belief_ids || ['belief_reality_explicit_uncertainty'], evidence_ids: evidenceIds,
    knowledge_claim_ids: input.knowledge_claim_ids || [], market_context_ids: (input.market_context_graph?.indicator_nodes || []).filter((x) => !staleMarket.includes(x)).map((x) => x.indicator_id),
    human_judgment_ids: input.synthesis_bundle?.positions?.filter((x) => x.authority_type === 'PRIVATE_HUMAN_JUDGMENT').map((x) => x.position_id) || [],
    conflict_ids: unresolvedConflicts.map((x) => x.conflict_id), explanation_trace_id: `trace_reality_${seed}`, confidence_state_id: `confidence_reality_${seed}` };
  const confidence = { ...base('ConfidenceState', `confidence_reality_${seed}`, meta), confidence_state_id: `confidence_reality_${seed}`,
    evidence_completeness: required.length ? (required.length - missing.length) / required.length : 0,
    evidence_quality: entries.length ? entries.reduce((a, x) => a + (x.verification_state === 'EXTERNALLY_VERIFIED' ? 1 : .5), 0) / entries.length : 0,
    state_confidence: unresolvedConflicts.length ? .35 : entries.length ? .6 : 0, belief_confidence: 'NOT_EVALUATED',
    future_confidence: 'NOT_EVALUATED', intervention_confidence: 'NOT_EVALUATED', market_context_confidence: staleMarket.length ? .2 : input.market_context_graph ? .6 : 'NOT_EVALUATED' };
  const changed = changedMetricIds.map((x) => `current_operating_state.${x}`), unchanged = Object.keys(metrics).filter((x) => !changedMetricIds.includes(x)).map((x) => `current_operating_state.${x}`);
  const trace = { ...base('ExplanationTrace', `trace_reality_${seed}`, meta), explanation_trace_id: `trace_reality_${seed}`,
    operation: 'REALITY_ENGINE_PROJECT', operation_version: '1.0.0', input_ids: [...evidenceIds, input.vertical_operating_policy.operating_policy_id],
    authority_routes: input.synthesis_receipt ? [input.synthesis_receipt.receipt_hash] : [], dominant_authorities: ['USER_EVIDENCE'], subordinate_authorities: ['DOMAIN_KNOWLEDGE', 'MARKET_CONTEXT'],
    conflicts: unresolvedConflicts.map((x) => x.conflict_id), evidence_inputs: evidenceIds, knowledge_inputs: input.knowledge_claim_ids || [], human_inputs: state.human_judgment_ids, market_inputs: state.market_context_ids,
    model_receipt_ids: ['NO_MODEL_USED'], prompt_receipt_ids: ['NO_PROMPT_USED'], policy_receipt_ids: [input.vertical_operating_policy.operating_policy_id],
    changed_outputs: changed, unchanged_outputs: unchanged, change_reasons: changed.length ? ['QUALIFYING_EVIDENCE_CHANGED'] : [],
    non_change_reasons: changed.length ? [] : ['PROJECTION_UNCHANGED'], missing_evidence: gaps.map((x) => x.evidence_gap_id),
    human_review_required: unresolvedConflicts.length > 0, timestamp: input.as_of_at,
    safe_summary: { operation: 'REALITY_ENGINE_PROJECT', changed_count: changed.length, unchanged_count: unchanged.length, gap_count: gaps.length, conflict_count: unresolvedConflicts.length } };
  const stateVersion = { ...base('BusinessEngineStateVersion', `state_version_reality_${seed}`, meta), state_version_id: `state_version_reality_${seed}`,
    business_engine_state_id: state.business_engine_state_id, state_version: meta.next_version, previous_state_version_id: meta.previous_version_id,
    projection_version: 'reality-engine-v1', policy_version: input.vertical_operating_policy.contract_version,
    explanation_trace_id: trace.explanation_trace_id, generated_at: input.as_of_at, material_changes: changed,
    evaluated_non_material_inputs: unchanged, changed_fields: changed, unchanged_fields: unchanged, validation_status: 'VALIDATED', state_snapshot: state };
  const builds = { business_engine_state: buildDurableObject('BusinessEngineState', state), business_engine_state_version: buildDurableObject('BusinessEngineStateVersion', stateVersion),
    confidence_state: buildDurableObject('ConfidenceState', confidence), explanation_trace: buildDurableObject('ExplanationTrace', trace), evidence_gaps: gaps.map((x) => buildDurableObject('EvidenceGap', x)) };
  const buildErrors = Object.values(builds).flatMap((x) => Array.isArray(x) ? x.flatMap((y) => y.validation.errors) : x.validation.errors);
  if (buildErrors.length) return deepFreeze({ ok: false, status: 'REALITY_VALIDATION_FAILED', errors: buildErrors });
  const output = { business_engine_state: builds.business_engine_state.value, business_engine_state_version: builds.business_engine_state_version.value,
    confidence_state: builds.confidence_state.value, explanation_trace: builds.explanation_trace.value, evidence_gaps: builds.evidence_gaps.map((x) => x.value) };
  return deepFreeze({ ok: true, status: 'PROJECTED', ...output, output_hash: hashCanonicalJson(output) });
}
