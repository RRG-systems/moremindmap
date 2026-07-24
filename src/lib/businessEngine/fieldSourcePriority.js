/**
 * Field-level source priority chains for Business Engine Contract v1.
 * Lower array index = higher authority.
 *
 * Pattern:
 * 1. Strongest canonical fused intelligence
 * 2. Strong domain-specific generated intelligence
 * 3. Existing deterministic normalized field
 * 4. Explicit legacy fallback
 * 5. Honest absence
 */

export const FIELD_SOURCE_PRIORITY = Object.freeze({
  governing_business_pattern: [
    'draft.behavior_business_fusion + draft.constraint_analysis.primary_constraint + draft.current_trajectory_signal (fused assembly)',
    'briefing.sections[strategic_interpretation|primary_constraint|current_trajectory_signal]',
    'draft.constraint_analysis.primary_constraint + trajectory label',
    'honest absence',
  ],
  behavioral_modifier: [
    'draft.behavior_business_fusion',
    'draft.behavioral_reality + constraint.behavior_modifiers',
    'one_move_v1.behavior_fit',
    'honest absence',
  ],
  current_trajectory: [
    'draft.current_trajectory_signal.diagnostic_summary',
    'briefing.sections[current_trajectory_signal].body',
    'briefing.current_trajectory_signal.diagnostic_summary',
    'five_futures_v1.futures[current_future].summary',
    'draft.current_trajectory_signal label/signal object',
    'legacy deterministic caption (explicit fallback)',
    'honest absence',
  ],
  potential_trajectory: [
    'five_futures_v1.futures[optimized_future].summary|required_shift',
    'five_futures_v1.futures[transformational_future].summary',
    'one_move_v1.expected_probability_shift.explanation',
    'legacy static "Growing. Predictable. Scalable." (explicit fallback only)',
    'honest absence',
  ],
  relationship_lake_streams: [
    'draft.lead_generation_reality structured sources/behaviors',
    'briefing.sections[lead_generation_reality].body derived source list',
    'answers q4/q5 deterministic extraction',
    'real-estate legacy default stream list (explicit fallback)',
    'honest absence (empty list)',
  ],
  relationship_lake_outflow: [
    'draft.lead_conversion_reality + business_reality production signals',
    'briefing conversion/production sections',
    'honest absence (empty list)',
  ],
  primary_constraint: [
    'draft.constraint_analysis.primary_constraint',
    'briefing.primary_constraint_snapshot',
    'briefing.sections[primary_constraint].body',
    'one_move_v1.root_constraint',
    'honest absence',
  ],
  causal_explanation: [
    'briefing.sections[strategic_interpretation].body',
    'briefing.sections[primary_constraint].body',
    'draft.behavior_business_fusion.fusion_summary + constraint effect',
    'draft.business_reality summary',
    'honest absence',
  ],
  no_change_consequence: [
    'five_futures_v1.futures[current_future].risk_if_unchanged',
    'current_trajectory.current.persistence_risk / draft.current_trajectory_signal.persistence_risk',
    'primary_constraint.likely_effect_if_unchanged / downstream_effects',
    'executive diagnostic / constraint no-change effect',
    'five_futures_v1.futures[constraint_future].risk_if_unchanged|summary (explicit deterministic fallback)',
    'honest absence',
    // NOT used as primary: one_move_v1.expected_probability_shift.explanation (adoption logic)
  ],
  truth_rail: [
    'confidence_reality + truth_boundaries + primary_constraint + behavioral_modifier + vertical_context (final render-ready entries)',
    'honest absence when no confidence/truth/constraint evidence',
  ],
  future_change_logic: [
    'one_move_v1.why_this_move',
    'one_move_v1.recommendation',
    'five_futures_v1.futures[optimized_future].required_shift',
    'honest absence',
  ],
  one_move: [
    'one_move_v1 full object',
    'briefing.sections[preliminary_one_move_direction]',
    'honest absence',
  ],
  modeled_opportunity: [
    'one_move_v1.expected_probability_shift',
    'five_futures_v1.futures[optimized_future] probability/upside',
    'deterministic goal metrics with modeled_not_guaranteed (explicit fallback)',
    'honest absence — never invent financial values',
  ],
  confidence_reality: [
    'draft.confidence_engine',
    'briefing.confidence_snapshot + missing_data + caveats',
    'five_futures_v1.confidence_snapshot',
    'honest partial absence',
  ],
  truth_boundaries: [
    'draft.confidence_engine + draft.missing_data + draft.assumptions',
    'briefing.missing_data + briefing.caveats',
    'one_move_v1.caveats',
    'honest absence',
  ],
  footer_intelligence: [
    'governing_business_pattern conclusion',
    'one_move_v1 title + recommendation',
    'primary_constraint conclusion',
    'legacy closing insight rule tree (explicit fallback)',
  ],
  current_business_reality: [
    'draft.business_reality structured + extracted metrics',
    'briefing.sections[current_business_reality]',
    'answers metric extraction',
    'honest partial',
  ],
  business_model_alignment: [
    'customer_language / shell business_model_alignment_summary when present on record',
    'draft.systems_reality + models language',
    'honest absence',
  ],
  business_engine_dimensions: [
    'draft systems/accountability/tools realities mapped to pillars when structured scores exist',
    'inferEToPScores deterministic (explicit fallback, marked)',
    'honest absence defaults',
  ],
});

export default FIELD_SOURCE_PRIORITY;
