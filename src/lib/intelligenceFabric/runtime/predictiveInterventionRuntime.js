import { hashCanonicalJson } from '../hashing.js';
import { deepFreeze } from '../validation.js';
import { runDurableIntelligenceRuntime } from './durableRuntime.js';
import { runFutureEngine } from './futureEngine.js';
import { rankInterventionCandidates } from './interventionRanking.js';
import { createOneMove, transitionOneMove } from './oneMoveLifecycle.js';
import { validateOutcome } from './outcomeValidation.js';

export const PREDICTIVE_INTERVENTION_RUNTIME_VERSION = 'predictive-intervention-reference-v1';

export function runPredictiveInterventionRuntime(input) {
  const durable = input.durable_runtime_result || runDurableIntelligenceRuntime(input);
  if (!durable?.ok) return deepFreeze({ ok: false, phase: 'DURABLE_RUNTIME', failure: durable?.failure });
  const future = runFutureEngine({ ...input, business_engine_state_version: durable.business_engine_state_version,
    belief_state: durable.belief_state, current_future_set: input.current_future_set });
  if (!future.ok) return deepFreeze({ ok: false, phase: 'FUTURE_ENGINE', failure: future });
  const ranking = rankInterventionCandidates({ candidates: input.intervention_candidates || [], tenant_id: input.tenant_id,
    policy_version: input.intervention_policy_version, authority_conflict: future.human_review_required });
  if (!ranking.ok) return deepFreeze({ ok: false, phase: 'INTERVENTION_RANKING', failure: ranking });
  let oneMove = null;
  if (ranking.selected) {
    const created = createOneMove({ candidate: ranking.selected, tenant_id: input.tenant_id, business_id: input.business_id,
      profile_id: input.profile_id, as_of_at: input.as_of_at, explanation_trace_ref: future.explanation_trace.explanation_trace_id });
    oneMove = transitionOneMove(created.one_move, { to_status: 'PROPOSED', as_of_at: input.as_of_at,
      actor: { type: 'SYSTEM', actor_ref: 'predictive-reference-runtime' }, record: { ranking_receipt_id: ranking.receipt.receipt_id } }).one_move;
  }
  const outcomes = (input.outcome_inputs || []).map((outcome) => validateOutcome({ ...outcome, tenant_id: input.tenant_id }));
  if (outcomes.some((x) => !x.ok && x.record?.attribution_status === 'CAUSAL_CLAIM_NOT_AUTHORIZED')) return deepFreeze({ ok: false, phase: 'CAUSAL_BOUNDARY', failure: outcomes.find((x) => !x.ok) });
  const result = { runtime_version: PREDICTIVE_INTERVENTION_RUNTIME_VERSION, durable_runtime_hash: durable.runtime_hash,
    future_engine: future, intervention_ranking: ranking, one_move: oneMove, outcome_validation_ledger: outcomes.map((x) => x.record),
    human_review_required: future.human_review_required || ranking.receipt.human_review_required };
  return deepFreeze({ ok: true, status: 'PREDICTIVE_INTERVENTION_RECONSTRUCTED', ...result, runtime_hash: hashCanonicalJson(result) });
}
