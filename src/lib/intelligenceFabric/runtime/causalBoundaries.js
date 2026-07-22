import { deepFreeze } from '../validation.js';

export const ATTRIBUTION_LEVELS = Object.freeze(['ASSOCIATED_ONLY', 'TEMPORALLY_ALIGNED', 'MECHANISM_CONSISTENT', 'CONFOUNDED', 'MATCHED_CONTEXT_SUPPORT', 'REPLICATED_CONTEXT_SUPPORT', 'QUASI_EXPERIMENTAL_SUPPORT', 'EXPERIMENTAL_SUPPORT', 'CAUSAL_CLAIM_NOT_AUTHORIZED']);
const CAUSAL_LEVELS = new Set(['QUASI_EXPERIMENTAL_SUPPORT', 'EXPERIMENTAL_SUPPORT']);

export function assessAttribution({ requested_level = 'ASSOCIATED_ONLY', confounders = [], external_shocks = [], matched_contexts = [], replicated_contexts = [], design_receipt = null, human_authorization = null, alternative_explanations = [] }) {
  if (!ATTRIBUTION_LEVELS.includes(requested_level)) return deepFreeze({ ok: false, code: 'INVALID_ATTRIBUTION_LEVEL' });
  let attribution_status = 'ASSOCIATED_ONLY';
  if (external_shocks.length || confounders.length) attribution_status = 'CONFOUNDED';
  else if (replicated_contexts.length >= 2 && new Set(replicated_contexts.map((x) => x.outcome_id)).size >= 2) attribution_status = 'REPLICATED_CONTEXT_SUPPORT';
  else if (matched_contexts.length) attribution_status = 'MATCHED_CONTEXT_SUPPORT';
  else if (requested_level === 'MECHANISM_CONSISTENT') attribution_status = 'MECHANISM_CONSISTENT';
  else if (requested_level === 'TEMPORALLY_ALIGNED') attribution_status = 'TEMPORALLY_ALIGNED';
  if (CAUSAL_LEVELS.has(requested_level)) {
    if (!design_receipt || human_authorization?.actor_type !== 'HUMAN') attribution_status = 'CAUSAL_CLAIM_NOT_AUTHORIZED';
    else attribution_status = requested_level;
  }
  const causal_confidence = attribution_status === 'EXPERIMENTAL_SUPPORT' ? 'HIGH' : attribution_status === 'QUASI_EXPERIMENTAL_SUPPORT' ? 'MODERATE' : 'LOW';
  return deepFreeze({ ok: attribution_status !== 'CAUSAL_CLAIM_NOT_AUTHORIZED', attribution_status, causal_confidence,
    confounders, external_shocks, alternative_explanations, counterfactual_status: 'MODELED_HYPOTHESIS_ONLY',
    explanation: 'The outcome changed after the intervention. Timing and mechanism may be consistent with the recommendation; however, observational evidence and alternative explanations do not establish causal proof.' });
}

export function validateLearningPromotion({ outcome_ids = [], contexts = [], privacy_classification, learning_eligibility, requested_state }) {
  if (privacy_classification !== 'ANONYMIZED_AGGREGATE' || learning_eligibility !== true) return deepFreeze({ ok: false, code: 'PRIVATE_OR_INELIGIBLE_OUTCOME' });
  if (requested_state !== 'OBSERVED' && (new Set(outcome_ids).size < 2 || new Set(contexts).size < 2)) return deepFreeze({ ok: false, code: 'REPLICATION_REQUIRED' });
  return deepFreeze({ ok: true, requested_state });
}
