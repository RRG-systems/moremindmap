import { canonicalHash } from '../wholeBusinessModelV1/canonical.js';
import {
  ONE_MOVE_RUNTIME_BOUNDARIES,
  ONE_MOVE_SELECTION_MODEL_VERSION,
  ONE_MOVE_V2_CONTRACT_ID,
  ONE_MOVE_V2_CONTRACT_VERSION,
  ONE_MOVE_V2_SCHEMA_VERSION,
} from './constants.js';
import { buildOneMoveContext } from './context.js';
import { selectOneMoveCandidate } from './selection.js';
import { validateUnweightedCandidates } from './unweightedValidator.js';
import { validateOneMoveV2 } from './validator.js';

function buildObservationContract(candidate) {
  return {
    contract_id: 'one-move-v2-future-observation-contract-v1',
    execution_started: null,
    execution_fidelity: null,
    leading_indicator_movement: null,
    business_state_movement: null,
    observation_horizon: candidate.observation_horizon,
    unexpected_effects: [],
    confounds: [],
    outcome: null,
    recommendation_still_valid: null,
    wbm_update_trigger: 'Update WBM when governed observations materially change a business state, mechanism, constraint, or its epistemic support.',
    five_futures_update_trigger: 'Recompute Five Futures from a newly validated WBM state; never infer probability movement from intervention intent.',
    tracking_or_subscription_implemented: false,
  };
}

function materialize(candidate, context, selectionReceipt, candidateSetHash) {
  const trace = selectionReceipt.ranked_candidates.find((item) => item.candidate_id === candidate.candidate_id);
  const oneMove = {
    contract_id: ONE_MOVE_V2_CONTRACT_ID,
    contract_version: ONE_MOVE_V2_CONTRACT_VERSION,
    schema_version: ONE_MOVE_V2_SCHEMA_VERSION,
    one_move_id: `one-move-${canonicalHash({ business_id: context.binding.business_id, candidate_id: candidate.candidate_id, wbm: context.binding.whole_business_model_hash, futures: context.binding.five_futures_hash }).slice(0, 20)}`,
    business_id: context.binding.business_id,
    owner_profile_id: context.binding.owner_profile_id,
    title: candidate.title,
    intervention: candidate.intervention,
    why_now: candidate.why_now,
    governing_constraint_id: context.governing_constraint.constraint_id,
    primary_mechanism_ids: candidate.mechanism_attacked_ids,
    symptom_distinction: candidate.symptom_distinction,
    causal_chain: candidate.causal_chain,
    supporting_evidence_refs: candidate.supporting_evidence_refs,
    counterevidence_refs: candidate.counterevidence_refs,
    assumptions: candidate.assumptions,
    prerequisites: candidate.prerequisites,
    execution_definition: candidate.execution_definition,
    bounded_execution_steps: candidate.bounded_execution_steps,
    owner_role: candidate.owner_role,
    team_roles: candidate.team_roles,
    whole_person_execution_considerations: candidate.whole_person_execution_considerations,
    leading_indicators: candidate.leading_indicators,
    success_evidence: candidate.success_evidence,
    failure_evidence: candidate.failure_evidence,
    falsifiers: candidate.falsifiers,
    stop_or_reconsider_conditions: candidate.stop_or_reconsider_conditions,
    observation_horizon: candidate.observation_horizon,
    reversibility_class: candidate.reversibility_class,
    dependency_burden: candidate.dependency_burden,
    trajectory_effect_intent: candidate.trajectory_effect_intent,
    certainty_support_classification: candidate.certainty_support_classification,
    whole_business_model_binding: { version: context.binding.whole_business_model_version, hash: context.binding.whole_business_model_hash },
    five_futures_binding: { version: context.binding.five_futures_version, hash: context.binding.five_futures_hash, support_semantics: 'UNCALIBRATED_RELATIVE_SUPPORT' },
    authority_versions: {
      business_intelligence: context.binding.authority_hashes,
      script_registry: context.binding.script_registry_hash,
      script_library: context.binding.script_library_hash,
    },
    selection_model_version: ONE_MOVE_SELECTION_MODEL_VERSION,
    selection_trace: {
      selection_receipt_hash: selectionReceipt.receipt_hash,
      selected_score: trace.selection_score,
      selected_components: trace.selection_components,
      explanation: selectionReceipt.explainability,
      probability_semantics: selectionReceipt.probability_semantics,
    },
    observation_contract: buildObservationContract(candidate),
    script_intelligence_refs: candidate.script_intelligence_refs,
    dynamic_research_warrant: candidate.dynamic_research_warrant,
    provenance: {
      selected_candidate_id: candidate.candidate_id,
      candidate_set_hash: candidateSetHash,
      context_hash: context.context_hash,
      selected_authority_ids: context.selection_authority_receipt.selected_authority_ids,
      selected_section_ids: context.selection_authority_receipt.selected_section_ids,
      evidence_refs: candidate.supporting_evidence_refs,
      deterministic_selection: true,
      frontier_selected_winner: false,
    },
    runtime_boundaries: ONE_MOVE_RUNTIME_BOUNDARIES,
  };
  const validationReceipt = validateOneMoveV2(oneMove, context, selectionReceipt);
  oneMove.validation_receipt = validationReceipt;
  oneMove.artifact_hash = canonicalHash({ ...oneMove, artifact_hash: undefined });
  return Object.freeze(oneMove);
}

export async function buildOneMoveV2(wholeBusinessModel, fiveFutures, { candidateAdapter, ...contextOptions } = {}) {
  if (!candidateAdapter || typeof candidateAdapter.generate !== 'function') throw new TypeError('one_move_v2_requires_candidate_generation_adapter');
  const context = buildOneMoveContext(wholeBusinessModel, fiveFutures, contextOptions);
  const candidates = await candidateAdapter.generate(context);
  validateUnweightedCandidates(candidates, context);
  const candidateSetHash = canonicalHash(candidates);
  const selectionReceipt = selectOneMoveCandidate(candidates);
  const selected = candidates.find((candidate) => candidate.candidate_id === selectionReceipt.selected_candidate_id);
  const oneMove = materialize(selected, context, selectionReceipt, candidateSetHash);
  return Object.freeze({
    context,
    candidates: Object.freeze(candidates),
    candidate_set_hash: candidateSetHash,
    selection_receipt: selectionReceipt,
    one_move: oneMove,
    validation_receipt: oneMove.validation_receipt,
  });
}

