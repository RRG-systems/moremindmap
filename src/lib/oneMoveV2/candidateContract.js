import { CANDIDATE_GENERATION_CONTRACT_ID, PROHIBITED_MODEL_SELECTION_FIELDS, SELECTION_DIMENSIONS } from './constants.js';

export const REQUIRED_CANDIDATE_FIELDS = Object.freeze([
  'candidate_id', 'title', 'intervention', 'why_now', 'mechanism_attacked_ids',
  'constraint_relationship', 'symptom_distinction', 'causal_chain', 'supporting_evidence_refs',
  'counterevidence_refs', 'assumptions', 'prerequisites', 'execution_burden',
  'execution_definition', 'bounded_execution_steps', 'owner_role', 'team_roles',
  'whole_person_execution_considerations', 'leading_indicators', 'success_evidence',
  'failure_evidence', 'falsifiers', 'stop_or_reconsider_conditions', 'observation_horizon',
  'reversibility_class', 'dependency_burden', 'trajectory_effect_intent',
  'certainty_support_classification', 'script_intelligence_refs', 'dynamic_research_warrant',
  'selection_signals',
]);

export function buildCandidateGenerationMission(context) {
  return Object.freeze({
    mission_id: CANDIDATE_GENERATION_CONTRACT_ID,
    doctrine: [
      'Understand the whole governed business state before generating candidates.',
      'Generate three to five serious candidate interventions, never a generic advice list.',
      'Each candidate must attack a named governed mechanism, not merely its visible symptom.',
      'Keep each candidate singular; bounded execution steps may only serve that one intervention.',
      'Whole-Person context may change execution design but may not change business truth or reject the causal intervention.',
      'Team context may be used only for selected, authorized, structurally relevant members and may not average people.',
      'Five Futures relationships express directional intent only; do not claim calibrated probability movement.',
      'Dynamic research may carry forward a precise WBM warrant but may not become broad research orchestration.',
      'Governed scripts are adaptable mechanisms, never mandatory canned wording.',
      'Return structured internal meaning, never customer prose or UI copy.',
      'Do not author numerical scores, ranks, percentages, probabilities, selection versions, or select the winner.',
    ],
    required_candidate_fields: REQUIRED_CANDIDATE_FIELDS,
    categorical_selection_signals: SELECTION_DIMENSIONS.map((dimension) => ({
      dimension_id: dimension.dimension_id,
      allowed_levels: Object.keys(dimension.levels),
      instruction: `Choose the supported category for ${dimension.meaning} Do not convert it to a number.`,
    })),
    prohibited_output_fields: PROHIBITED_MODEL_SELECTION_FIELDS,
    candidate_count: { minimum: 3, maximum: 5 },
    context,
  });
}

export function createCandidateGenerationAdapter({ generate }) {
  if (typeof generate !== 'function') throw new TypeError('candidate_generation_adapter_requires_generate_function');
  return Object.freeze({
    adapter_id: 'one-move-v2-frontier-candidate-adapter-v1',
    store: false,
    async generate(context) {
      return generate({ mission: buildCandidateGenerationMission(context), store: false });
    },
  });
}

