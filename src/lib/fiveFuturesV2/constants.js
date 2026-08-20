export const FIVE_FUTURES_V2_CONTRACT_ID = 'more-five-futures-v2';
export const FIVE_FUTURES_V2_CONTRACT_VERSION = '2.0.0';
export const FIVE_FUTURES_V2_SCHEMA_VERSION = '2.0.0';
export const WEIGHTING_MODEL_VERSION = 'five-futures-relative-support-v1';
export const NORMALIZATION_VERSION = 'largest-remainder-role-order-v1';
export const SUPPORT_SEMANTICS = 'UNCALIBRATED_RELATIVE_SUPPORT';

export const FUTURE_ROLES = Object.freeze([
  'current_course',
  'emerging_future',
  'better_future',
  'bold_future',
  'downside_future',
]);

export const ROLE_PURPOSES = Object.freeze({
  current_course: 'Current momentum if the business continues substantially as it is.',
  emerging_future: 'A materially different future already beginning to form from governed evidence of change.',
  better_future: 'A better causally reachable future if named meaningful changes alter current mechanisms.',
  bold_future: 'A substantially better but more distant plausible future requiring consequential changes not yet sufficiently present.',
  downside_future: 'A credible worse future if vulnerabilities deepen, the governing constraint worsens, or correction does not occur.',
});

export const SUPPORT_COMPONENTS = Object.freeze([
  Object.freeze({
    component_id: 'current_evidence_support',
    meaning: 'Direct support in the current WBM evidence and state.',
    levels: Object.freeze({ NONE: 0, WEAK: 1, MODERATE: 2, STRONG: 3 }),
  }),
  Object.freeze({
    component_id: 'momentum_support',
    meaning: 'Alignment with observed leading, lagging, and direction-of-travel signals.',
    levels: Object.freeze({ OPPOSED: 0, NEUTRAL: 1, ALIGNED: 2, STRONGLY_ALIGNED: 3 }),
  }),
  Object.freeze({
    component_id: 'causal_feasibility',
    meaning: 'Strength and completeness of the evidence-bound causal chain.',
    levels: Object.freeze({ UNSUPPORTED: 0, PLAUSIBLE: 1, SUPPORTED: 2, STRONGLY_SUPPORTED: 3 }),
  }),
  Object.freeze({
    component_id: 'change_distance',
    meaning: 'Inverse support from the burden and distance of required changes.',
    levels: Object.freeze({ TRANSFORMATIONAL: 0, HIGH: 1, MODERATE: 2, LOW_OR_NONE: 3 }),
  }),
  Object.freeze({
    component_id: 'counterevidence',
    meaning: 'Inverse support after contradictions and counterevidence are considered.',
    levels: Object.freeze({ STRONG: 0, MATERIAL: 1, LIMITED: 2, NONE: 3 }),
  }),
  Object.freeze({
    component_id: 'constraint_compatibility',
    meaning: 'Whether the trajectory follows, weakens, bypasses, or worsens the governing constraint.',
    levels: Object.freeze({ CONFLICTS: 0, UNCERTAIN: 1, COMPATIBLE: 2, DIRECTLY_ALIGNED: 3 }),
  }),
  Object.freeze({
    component_id: 'vulnerability_activation',
    meaning: 'Role-sensitive support from material vulnerability activation.',
    levels: Object.freeze({ NONE: 0, WEAK: 1, MODERATE: 2, STRONG: 3 }),
  }),
]);

export const CERTAINTY_SUPPORT_CLASSES = Object.freeze([
  'HIGH_RELATIVE_SUPPORT',
  'MODERATE_RELATIVE_SUPPORT',
  'LOW_RELATIVE_SUPPORT',
  'INSUFFICIENT_EVIDENCE_BOUNDED',
]);

export const PROHIBITED_MODEL_WEIGHT_FIELDS = Object.freeze([
  'raw_relative_support_score',
  'normalized_relative_support_weight',
  'support_components',
  'weighting_model_version',
  'calibrated_probability',
  'probability',
  'percentage',
  'percent',
  'likelihood_percent',
]);

export const LEGACY_COEXISTENCE = Object.freeze({
  five_futures_v1: 'LEGACY_MODEL_GENERATED_PERCENTAGES_UNCHANGED',
  five_futures_v2: SUPPORT_SEMANTICS,
  silent_reinterpretation_prohibited: true,
});

export const FUTURE_RUNTIME_BOUNDARIES = Object.freeze({
  one_move_v2_implemented: false,
  customer_realization_implemented: false,
  customer_ui_implemented: false,
  bayesian_model_implemented: false,
  calibration_project_implemented: false,
  rsl_implemented: false,
  production_wired: false,
});
