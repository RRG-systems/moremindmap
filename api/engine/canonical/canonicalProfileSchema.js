/**
 * canonicalProfileSchema.js
 * 
 * Defines the authoritative schema for canonical behavioral profiles.
 * This is the single source of truth for behavioral intelligence.
 * 
 * Canonical profiles are NOT presentation artifacts.
 * They are semantic intelligence artifacts that FEED presentation layers.
 */

/**
 * Canonical Profile Schema
 * 
 * @typedef {Object} CanonicalProfile
 * 
 * @property {string} profile_id - Unique profile identifier (MM-YYYYMMDD-SHORTUUID)
 * 
 * @property {Object} metadata - Profile metadata
 * @property {string} metadata.assessment_version - Assessment version used
 * @property {string} metadata.generated_at - ISO timestamp
 * @property {string} metadata.model - AI model used for inference
 * @property {string} metadata.person_name - Optional person name
 * @property {string} metadata.email - Optional contact email
 * 
 * @property {Object} vector_scores - Raw dimension scores (0-10 scale)
 * @property {number} vector_scores.vector - Command/Direction
 * @property {number} vector_scores.signal - Relational Awareness
 * @property {number} vector_scores.fidelity - Precision
 * @property {number} vector_scores.velocity - Tempo
 * @property {number} vector_scores.leverage - Influence
 * @property {number} vector_scores.flex - Adaptability
 * @property {number} vector_scores.framework - Structure
 * @property {number} vector_scores.horizon - Perspective
 * 
 * @property {Array<Object>} ranked_dimensions - Dimensions sorted by score (1-8)
 * @property {string} ranked_dimensions[].dimension - Dimension name
 * @property {number} ranked_dimensions[].score - Raw score
 * @property {number} ranked_dimensions[].rank - Position in ranking
 * 
 * @property {Object} top_systems - Primary behavioral drivers
 * @property {Object} top_systems.primary_driver - Highest scoring dimension
 * @property {Object} top_systems.secondary_stabilizer - Second dimension
 * @property {Object} top_systems.opposing_pattern_1 - 7th ranked (strain point)
 * @property {Object} top_systems.opposing_pattern_2 - 8th ranked (blind spot)
 * 
 * @property {Object} inferred_patterns - Behavioral pattern intelligence
 * @property {string} inferred_patterns.profile_type - e.g., "Command/Perspective"
 * @property {string} inferred_patterns.operating_signature - One-line behavioral frame
 * @property {Object} inferred_patterns.leadership_approach - How they lead
 * @property {Object} inferred_patterns.decision_architecture - How they decide
 * @property {Object} inferred_patterns.communication_style - How they communicate
 * @property {Object} inferred_patterns.pressure_response - Behavior under strain
 * 
 * @property {Array<Object>} contradictions - Internal behavioral tensions
 * @property {string} contradictions[].tension - Description of contradiction
 * @property {Array<string>} contradictions[].dimensions_in_conflict - Conflicting dimensions
 * @property {string} contradictions[].manifestation - How it shows up
 * @property {string} contradictions[].resolution_path - How to resolve
 * 
 * @property {Array<Object>} development_targets - Growth priorities
 * @property {string} development_targets[].dimension - Dimension to develop
 * @property {string} development_targets[].rationale - Why this matters
 * @property {string} development_targets[].approach - How to develop
 * @property {number} development_targets[].priority - 1-5 ranking
 * 
 * @property {Object} environment_fit - Where they thrive/struggle
 * @property {Array<string>} environment_fit.thrives_in - Environments that unlock performance
 * @property {Array<string>} environment_fit.struggles_in - Environments that create friction
 * @property {Array<string>} environment_fit.requires - Non-negotiable environmental needs
 * 
 * @property {Object} life_direction - Values, priorities, and future orientation (Q2)
 * @property {Array<string>} life_direction.stated_priorities - What they claim matters
 * @property {string} life_direction.future_vision - Where they want to go (5-10 years)
 * @property {string} life_direction.meaning_definition - What meaningful life looks like
 * @property {Object} life_direction.inference - Values vs operational reality gap
 * 
 * @property {Object} business_operating_reality - Actual business/leadership state (Q26)
 * @property {Object} business_operating_reality.sales_metrics - Production, database, goals
 * @property {Object} business_operating_reality.leadership_scope - Who they lead, performance level
 * @property {string} business_operating_reality.biggest_gap - Primary constraint identified
 * @property {number} business_operating_reality.numerical_grounding - Specificity level (1-5)
 * 
 * @property {Object} growth_tension - Scaling response and capacity (Q27)
 * @property {string} growth_tension.emotional_scaling_response - Reaction to 3x growth scenario
 * @property {string} growth_tension.vision_articulation - Mission/vision clarity
 * @property {string} growth_tension.adaptive_ceiling - Where resistance appears
 * @property {Array<string>} growth_tension.priority_hierarchy - Time/money/freedom/impact ranking
 * 
 * @property {Object} systems_accountability - Operational maturity (Q28)
 * @property {string} systems_accountability.systems_description - Current systems/habits
 * @property {string} systems_accountability.system_confidence - Belief in current systems
 * @property {string} systems_accountability.accountability_structure - Who holds them accountable
 * @property {string} systems_accountability.coachability_claim - Self-assessment
 * @property {string} systems_accountability.meta_reflection - Thoughts after assessment
 * 
 * @property {Object} stall_patterns - Professional friction and bottlenecks (Q24)
 * @property {string} stall_patterns.attention_direction - Where focus goes when stalled
 * @property {Array<string>} stall_patterns.professional_frustrations - What drains energy
 * @property {Array<string>} stall_patterns.relational_friction - People dynamics
 * @property {Array<string>} stall_patterns.avoidance_patterns - What gets delayed
 * @property {string} stall_patterns.performance_gap_awareness - Self-assessment of shortfalls
 * 
 * @property {Object} narrative_profile - Human-readable strategic framing
 * @property {string} narrative_profile.executive_summary - 2-3 sentence profile essence
 * @property {string} narrative_profile.leadership_narrative - How they lead (paragraph)
 * @property {string} narrative_profile.decision_narrative - How they decide (paragraph)
 * @property {string} narrative_profile.communication_narrative - How they communicate (paragraph)
 * @property {string} narrative_profile.development_narrative - Growth path (paragraph)
 * @property {string} narrative_profile.business_manifestation - How profile shows up in business/sales
 * @property {string} narrative_profile.contradiction_analysis - Internal tensions synthesis
 * 
 * @property {Object} leadership_readiness - Executive/leadership capacity assessment
 * @property {string} leadership_readiness.scale_capacity - Can they lead at 2x/5x/10x scale?
 * @property {string} leadership_readiness.clarity_generation - Do they create clarity or confusion?
 * @property {string} leadership_readiness.followership_quality - Willing followers vs compliance?
 * @property {string} leadership_readiness.relational_collapse_risk - Collapse under resistance?
 * @property {string} leadership_readiness.control_tendency - Over-control vs appropriate delegation
 * @property {string} leadership_readiness.development_capability - Can they develop others?
 * @property {number} leadership_readiness.confidence - 0.0-1.0 confidence score
 * 
 * @property {Object} role_fit_analysis - Natural role alignment
 * @property {string} role_fit_analysis.builder_vs_optimizer - Create new vs improve existing
 * @property {string} role_fit_analysis.operator_vs_visionary - Execute vs imagine
 * @property {string} role_fit_analysis.manager_vs_producer - Lead others vs produce directly
 * @property {string} role_fit_analysis.explorer_vs_stabilizer - New territory vs consolidation
 * @property {string} role_fit_analysis.executor_vs_strategist - Do vs plan
 * @property {string} role_fit_analysis.ambiguity_tolerance - High chaos vs low chaos fit
 * @property {Array<string>} role_fit_analysis.natural_roles - Best-fit role archetypes
 * @property {Array<string>} role_fit_analysis.friction_roles - High-friction role archetypes
 * 
 * @property {Object} future_growth_constraints - Scaling bottlenecks
 * @property {Array<string>} future_growth_constraints.at_2x_scale - Likely constraints at 2x
 * @property {Array<string>} future_growth_constraints.at_5x_scale - Likely constraints at 5x
 * @property {string} future_growth_constraints.stress_amplification - How stress compounds
 * @property {string} future_growth_constraints.operational_fragility - System weakness points
 * @property {string} future_growth_constraints.relational_fragility - Relationship strain points
 * @property {string} future_growth_constraints.decision_overload_risk - Bottleneck likelihood
 * @property {string} future_growth_constraints.scaling_resistance_pattern - Where resistance emerges
 * 
 * @property {Object} coaching_leverage_points - Highest-ROI development areas
 * @property {string} coaching_leverage_points.highest_roi_adjustment - Smallest change, biggest impact
 * @property {Array<string>} coaching_leverage_points.invisible_drag_habits - Unseen friction sources
 * @property {string} coaching_leverage_points.resistance_likelihood - How coachable actually?
 * @property {string} coaching_leverage_points.accountability_dependency - External structure need
 * @property {Array<string>} coaching_leverage_points.quick_wins - 30-90 day improvements
 * @property {Array<string>} coaching_leverage_points.long_term_work - 6-24 month development
 * 
 * @property {Object} hidden_risk_patterns - Non-obvious failure modes
 * @property {Array<string>} hidden_risk_patterns.strengths_as_liabilities - When strengths hurt
 * @property {string} hidden_risk_patterns.relational_erosion_risk - Relationship damage trajectory
 * @property {string} hidden_risk_patterns.strategic_drift_risk - Loss of direction likelihood
 * @property {string} hidden_risk_patterns.execution_inconsistency - Follow-through reliability
 * @property {string} hidden_risk_patterns.burnout_trajectory - Sustainability assessment
 * @property {string} hidden_risk_patterns.isolation_pattern - Tendency to operate alone
 * @property {number} hidden_risk_patterns.severity - 0.0-1.0 aggregate risk score
 * 
 * @property {Object} execution_identity - How they actually operate (not how they think)
 * @property {string} execution_identity.true_default - Real operating mode under pressure
 * @property {string} execution_identity.claimed_identity - How they describe themselves
 * @property {string} execution_identity.identity_gap - Difference between claim and reality
 * @property {string} execution_identity.operational_truth - What actually happens
 * 
 * @property {Object} strategic_ceiling_analysis - Long-term growth limits
 * @property {string} strategic_ceiling_analysis.current_ceiling - Where they'll hit wall
 * @property {string} strategic_ceiling_analysis.ceiling_cause - Why the ceiling exists
 * @property {string} strategic_ceiling_analysis.breakthrough_requirement - What it takes to break through
 * @property {number} strategic_ceiling_analysis.ceiling_proximity - How close? (0.0-1.0)
 * 
 * @property {Object} scaling_readiness - Infrastructure and capacity for growth
 * @property {string} scaling_readiness.systems_maturity - Operational infrastructure level
 * @property {string} scaling_readiness.delegation_capacity - Can they let go?
 * @property {string} scaling_readiness.talent_development - Can they build a team?
 * @property {string} scaling_readiness.process_thinking - Systems vs ad-hoc
 * @property {number} scaling_readiness.readiness_score - 0.0-1.0 aggregate score
 * 
 * @property {Object} team_interaction_patterns - How they show up in groups
 * @property {string} team_interaction_patterns.conflict_mode - How they handle disagreement
 * @property {string} team_interaction_patterns.collaboration_style - How they work with others
 * @property {string} team_interaction_patterns.feedback_reception - How they receive input
 * @property {string} team_interaction_patterns.trust_building - How they build relationships
 * @property {Array<string>} team_interaction_patterns.friction_triggers - What creates tension
 * @property {Array<string>} team_interaction_patterns.team_value_add - What they bring to groups
 */

export const CANONICAL_PROFILE_SCHEMA = {
  profile_id: 'string',
  metadata: {
    assessment_version: 'string',
    generated_at: 'string',
    model: 'string',
    person_name: 'string (optional)',
    email: 'string (optional)'
  },
  vector_scores: {
    vector: 'number (0-10)',
    signal: 'number (0-10)',
    fidelity: 'number (0-10)',
    velocity: 'number (0-10)',
    leverage: 'number (0-10)',
    flex: 'number (0-10)',
    framework: 'number (0-10)',
    horizon: 'number (0-10)'
  },
  ranked_dimensions: [
    {
      dimension: 'string',
      score: 'number',
      rank: 'number (1-8)'
    }
  ],
  top_systems: {
    primary_driver: {
      dimension: 'string',
      score: 'number',
      rank: 'number',
      label: 'string',
      description: 'string'
    },
    secondary_stabilizer: 'object (same structure)',
    opposing_pattern_1: 'object (same structure)',
    opposing_pattern_2: 'object (same structure)'
  },
  inferred_patterns: {
    profile_type: 'string',
    operating_signature: 'string',
    leadership_approach: 'object',
    decision_architecture: 'object',
    communication_style: 'object',
    pressure_response: 'object'
  },
  contradictions: [
    {
      tension: 'string',
      dimensions_in_conflict: ['string'],
      manifestation: 'string',
      resolution_path: 'string'
    }
  ],
  development_targets: [
    {
      dimension: 'string',
      rationale: 'string',
      approach: 'string',
      priority: 'number (1-5)'
    }
  ],
  environment_fit: {
    thrives_in: ['string'],
    struggles_in: ['string'],
    requires: ['string']
  },
  narrative_profile: {
    executive_summary: 'string',
    leadership_narrative: 'string',
    decision_narrative: 'string',
    communication_narrative: 'string',
    development_narrative: 'string'
  }
};

/**
 * Dimension labels for semantic interpretation
 */
export const DIMENSION_LABELS = {
  vector: 'Command',
  signal: 'Relational Awareness',
  fidelity: 'Precision',
  velocity: 'Tempo',
  leverage: 'Influence',
  flex: 'Adaptability',
  framework: 'Structure',
  horizon: 'Perspective'
};

/**
 * Dimension descriptions (short form)
 */
export const DIMENSION_DESCRIPTIONS = {
  vector: 'Establishes direction and pulls toward action',
  signal: 'Reads relational dynamics and adjusts approach',
  fidelity: 'Catches errors and verifies assumptions',
  velocity: 'Prefers speed and moves quickly to action',
  leverage: 'Positions influence and thinks about power dynamics',
  flex: 'Adjusts approach based on context and pivots easily',
  framework: 'Prefers clear process and defined structure',
  horizon: 'Thinks multi-move ahead and connects to future states'
};
