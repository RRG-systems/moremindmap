export const ONE_MOVE_V2_CONTRACT_ID = 'more-one-move-v2';
export const ONE_MOVE_V2_CONTRACT_VERSION = '2.0.0';
export const ONE_MOVE_V2_SCHEMA_VERSION = '2.0.0';
export const ONE_MOVE_SELECTION_MODEL_VERSION = 'one-move-v2-inspectable-rubric-v1';
export const CANDIDATE_GENERATION_CONTRACT_ID = 'one-move-v2-candidate-generation-v1';

export const FUTURE_ROLES = Object.freeze([
  'current_course',
  'emerging_future',
  'better_future',
  'bold_future',
  'downside_future',
]);

export const SELECTION_DIMENSIONS = Object.freeze([
  Object.freeze({
    dimension_id: 'constraint_leverage',
    meaning: 'How directly the intervention weakens the governing constraint.',
    levels: Object.freeze({ NONE: 0, WEAK: 1, MATERIAL: 2, DIRECT: 3 }),
  }),
  Object.freeze({
    dimension_id: 'causal_reach',
    meaning: 'How far the intervention reaches through the supported causal chain.',
    levels: Object.freeze({ SYMPTOM_ONLY: 0, LOCAL: 1, MECHANISM_CHAIN: 2, SYSTEMIC: 3 }),
  }),
  Object.freeze({
    dimension_id: 'evidence_support',
    meaning: 'Strength of governed evidence for the intervention hypothesis.',
    levels: Object.freeze({ NONE: 0, WEAK: 1, MODERATE: 2, STRONG: 3 }),
  }),
  Object.freeze({
    dimension_id: 'execution_feasibility',
    meaning: 'Whether execution can realistically start with present capability and authority.',
    levels: Object.freeze({ INFEASIBLE: 0, DIFFICULT: 1, FEASIBLE: 2, READY: 3 }),
  }),
  Object.freeze({
    dimension_id: 'time_to_signal',
    meaning: 'How soon a truthful leading signal can be observed.',
    levels: Object.freeze({ DISTANT: 0, LONG: 1, MEDIUM: 2, NEAR: 3 }),
  }),
  Object.freeze({
    dimension_id: 'reversibility_low_regret',
    meaning: 'How bounded, reversible, and low-regret the intervention is.',
    levels: Object.freeze({ HIGH_REGRET: 0, LOCK_IN: 1, REVERSIBLE: 2, BOUNDED_TEST: 3 }),
  }),
  Object.freeze({
    dimension_id: 'trajectory_leverage',
    meaning: 'How materially the intervention changes the mechanisms beneath the five trajectories.',
    levels: Object.freeze({ NONE: 0, INDIRECT: 1, MATERIAL: 2, DIRECT: 3 }),
  }),
  Object.freeze({
    dimension_id: 'dependency_burden',
    meaning: 'The degree to which execution avoids outside dependencies and coordination burden.',
    levels: Object.freeze({ HIGH: 0, MODERATE: 1, LOW: 2, NONE: 3 }),
  }),
]);

export const PROHIBITED_MODEL_SELECTION_FIELDS = Object.freeze([
  'selection_score',
  'selection_components',
  'selection_model_version',
  'rank',
  'selected',
  'winner',
  'probability',
  'probability_movement',
  'intervention_probability',
  'normalized_probability',
  'percent',
  'percentage',
]);

export const REVERSIBILITY_CLASSES = Object.freeze([
  'BOUNDED_TEST',
  'REVERSIBLE',
  'LOCK_IN',
  'HIGH_REGRET',
]);

export const DEPENDENCY_BURDENS = Object.freeze(['NONE', 'LOW', 'MODERATE', 'HIGH']);

export const CERTAINTY_SUPPORT_CLASSES = Object.freeze([
  'STRONGLY_SUPPORTED_INTERVENTION',
  'SUPPORTED_INTERVENTION_HYPOTHESIS',
  'BOUNDED_LOW_REGRET_HYPOTHESIS',
]);

export const ONE_MOVE_RUNTIME_BOUNDARIES = Object.freeze({
  customer_realization_implemented: false,
  customer_ui_implemented: false,
  production_wired: false,
  deployed_or_activated: false,
  one_three_five_implemented: false,
  rsl_implemented: false,
  outcome_engine_implemented: false,
  calibrated_intervention_probability_implemented: false,
  bayesian_model_implemented: false,
  mdp_or_pomdp_implemented: false,
  monte_carlo_implemented: false,
});

export const SCRIPT_ROUTE_BY_DOMAIN = Object.freeze({
  relationship: Object.freeze(['SC-01', 'SC-02', 'SC-04']),
  demand: Object.freeze(['SC-01', 'SC-22', 'SC-16']),
  conversion: Object.freeze(['SC-16', 'SC-26', 'SC-27']),
  listing: Object.freeze(['SC-14', 'SC-17', 'SC-18']),
  buyer: Object.freeze(['SC-15', 'SC-20', 'SC-27']),
  pipeline: Object.freeze(['SC-16', 'SC-27']),
});

export const AUTHORITY_ROUTE_BY_CONSTRAINT = Object.freeze({
  demand: Object.freeze(['UB-04', 'UB-06', 'UB-03', 'RE-02', 'RE-03', 'RE-05']),
  conversion: Object.freeze(['UB-06', 'UB-12', 'UB-03', 'RE-03', 'RE-06', 'RE-10']),
  capacity: Object.freeze(['UB-03', 'UB-08', 'UB-10', 'RE-11', 'RE-12', 'RE-14']),
  economics: Object.freeze(['UB-01', 'UB-02', 'UB-11', 'RE-01', 'RE-13', 'RE-16']),
  role: Object.freeze(['UB-08', 'UB-09', 'UB-10', 'RE-12', 'RE-13', 'RE-14']),
  team: Object.freeze(['UB-08', 'UB-09', 'UB-10', 'RE-13', 'RE-14', 'RE-15']),
  system: Object.freeze(['UB-03', 'UB-08', 'UB-12', 'RE-06', 'RE-12', 'RE-13']),
  market: Object.freeze(['UB-01', 'UB-11', 'UB-12', 'RE-01', 'RE-05', 'RE-16']),
  mixed: Object.freeze(['UB-03', 'UB-08', 'UB-12', 'RE-06', 'RE-12', 'RE-13']),
  insufficient_evidence: Object.freeze(['UB-03', 'UB-12', 'UB-11', 'RE-06', 'RE-12', 'RE-16']),
});

