import { hashCanonicalJson } from '../hashing.js';
import { deepFreeze } from '../validation.js';
import { assessAttribution } from './causalBoundaries.js';

export const OUTCOME_VALIDATION_STATUSES = Object.freeze(['PENDING_EXECUTION', 'EXECUTION_INCOMPLETE', 'AWAITING_SIGNAL', 'AWAITING_OUTCOME', 'OUTCOME_OBSERVED', 'VALIDATED_SUCCESS', 'VALIDATED_FAILURE', 'INCONCLUSIVE', 'CONFOUNDED', 'EXTERNAL_SHOCK', 'INSUFFICIENT_EVIDENCE', 'NOT_GENERALIZABLE', 'REPLICATION_REQUIRED']);

export function recordExecutionEvidence(input) {
  const required = ['planned_action', 'actual_action', 'start_time', 'execution_quality', 'adherence', 'privacy_classification', 'consent_basis'];
  if (required.some((key) => input?.[key] == null)) return deepFreeze({ ok: false, code: 'EXECUTION_EVIDENCE_INCOMPLETE' });
  if (input.scope_ref?.tenant_id !== input.tenant_id) return deepFreeze({ ok: false, code: 'CROSS_TENANT_EVIDENCE_DENIED' });
  const record = { ...input, execution_evidence_id: `execution_${hashCanonicalJson(input).slice(0, 20)}`,
    supporting_artifacts: (input.supporting_artifacts || []).map((x) => ({ artifact_ref: x.artifact_ref, content_hash: x.content_hash })),
    missing_execution_evidence: input.missing_execution_evidence || [], system_observation: input.system_observation || null, human_observation: input.human_observation || null };
  return deepFreeze({ ok: true, record });
}

export function validateOutcome(input) {
  if (!input?.intervention_id || !input.execution || !input.as_of_at) return deepFreeze({ ok: false, code: 'OUTCOME_INPUT_INCOMPLETE' });
  if (input.execution.tenant_id !== input.tenant_id) return deepFreeze({ ok: false, code: 'CROSS_TENANT_EVIDENCE_DENIED' });
  const completed = input.execution.completion_time != null;
  const partial = input.execution.adherence < 1 || input.execution.execution_quality < .7;
  const now = Date.parse(input.as_of_at), signalStart = Date.parse(input.expected_signal?.start), outcomeEnd = Date.parse(input.expected_outcome?.end);
  let validation_status = !completed ? (input.execution.actual_action ? 'EXECUTION_INCOMPLETE' : 'PENDING_EXECUTION')
    : now < signalStart ? 'AWAITING_SIGNAL' : now <= outcomeEnd && input.actual_outcome == null ? 'AWAITING_OUTCOME' : 'OUTCOME_OBSERVED';
  if (input.external_shocks?.length) validation_status = 'EXTERNAL_SHOCK';
  else if (input.confounders?.length) validation_status = 'CONFOUNDED';
  else if (now > outcomeEnd && input.actual_outcome == null) validation_status = 'INSUFFICIENT_EVIDENCE';
  else if (completed && !partial && input.actual_outcome?.success === true && now >= outcomeEnd) validation_status = input.replication_count >= 2 ? 'VALIDATED_SUCCESS' : 'REPLICATION_REQUIRED';
  else if (completed && !partial && input.actual_outcome?.success === false && now >= outcomeEnd) validation_status = 'VALIDATED_FAILURE';
  else if (partial && input.actual_outcome != null) validation_status = 'INCONCLUSIVE';
  const attribution = assessAttribution({ requested_level: input.requested_attribution, confounders: input.confounders, external_shocks: input.external_shocks,
    matched_contexts: input.matched_contexts, replicated_contexts: input.replicated_contexts, alternative_explanations: input.alternative_explanations,
    design_receipt: input.design_receipt, human_authorization: input.causal_authorization });
  const record = { outcome_validation_id: `outcome_${hashCanonicalJson({ ...input, validation_status, attribution }).slice(0, 20)}`, ...input,
    validation_status, success_or_failure: input.actual_outcome?.success ?? null, attribution_status: attribution.attribution_status,
    causal_confidence: attribution.causal_confidence, counterfactual_status: 'MODELED_HYPOTHESIS_ONLY', learning_eligibility: input.privacy_classification === 'ANONYMIZED_AGGREGATE' && input.consent_basis === 'AGGREGATE_LEARNING' };
  return deepFreeze({ ok: attribution.attribution_status !== 'CAUSAL_CLAIM_NOT_AUTHORIZED', record, attribution });
}

export function safeOutcomeSummary(record) {
  return deepFreeze({ outcome_validation_id: record.outcome_validation_id, validation_status: record.validation_status,
    attribution_status: record.attribution_status, causal_confidence: record.causal_confidence, replication_status: record.replication_status || null,
    privacy_classification: record.privacy_classification, learning_eligibility: record.learning_eligibility });
}
