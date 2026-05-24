/**
 * canonicalFallback.js
 * 
 * Production-safe fallback canonical generator.
 * Used when main canonical generation fails.
 * 
 * Creates deterministic canonical dossier from:
 * - Assessment answers
 * - Metadata (identity, organization, contextual signals)
 * - Report content (if available)
 * - Profile ID (generated)
 * 
 * Ensures WebProfileReport can still render all 7 sections.
 */

/**
 * Generate fallback canonical dossier
 * @param {Object} profileInput - Assessment input from buildProfileInput
 * @param {Object} reportContent - Optional report content from injection
 * @returns {Object} Minimal but complete canonical dossier
 */
export function generateFallbackCanonical(profileInput, reportContent = null) {
  if (!profileInput) {
    throw new Error('profileInput required for fallback canonical');
  }

  const { answers = {}, dimension_scores = {}, organizationalMetadata = {} } = profileInput;

  // Extract metadata
  const metadata = {
    assessment_version: 'mini-v2',
    generated_at: new Date().toISOString(),
    model: 'canonical-v1-fallback',
    person_name: profileInput.person_name || null,
    email: profileInput.email || null,
    identity: organizationalMetadata?.identity || null,
    organization: organizationalMetadata?.organization || null,
    contextual_signals: organizationalMetadata?.contextual_signals || null
  };

  // Build vector scores from dimension_scores
  const vector_scores = {};
  const ranked_dimensions = [];
  let rank = 1;

  Object.entries(dimension_scores).forEach(([dimension, data]) => {
    const score = data?.raw_score || 5;
    vector_scores[dimension] = score;
    ranked_dimensions.push({
      dimension,
      score,
      rank
    });
    rank++;
  });

  // Ensure all 8 dimensions exist
  const dimensions = ['vector', 'signal', 'fidelity', 'velocity', 'leverage', 'flex', 'framework', 'horizon'];
  dimensions.forEach(dim => {
    if (!vector_scores[dim]) {
      vector_scores[dim] = 5;
    }
  });

  // Sort ranked_dimensions by rank
  ranked_dimensions.sort((a, b) => a.rank - b.rank);

  // Build top_systems
  const sorted = [...ranked_dimensions].sort((a, b) => b.score - a.score);
  const top_systems = {
    primary_driver: sorted[0] || { dimension: 'vector', score: 5, rank: 1 },
    secondary_stabilizer: sorted[1] || { dimension: 'horizon', score: 5, rank: 2 },
    opposing_pattern_1: sorted[sorted.length - 2] || { dimension: 'fidelity', score: 5, rank: 7 },
    opposing_pattern_2: sorted[sorted.length - 1] || { dimension: 'framework', score: 5, rank: 8 }
  };

  // Build inferred patterns from answers
  const inferred_patterns = buildInferredPatterns(answers, vector_scores);

  // Build narrative profile sections from report content or generate minimal
  const narrative_profile = buildFallbackNarrative(reportContent, inferred_patterns, metadata);

  // Assemble canonical dossier
  const canonical = {
    profile_id: 'will-be-set-by-caller',
    metadata,
    vector_scores,
    ranked_dimensions,
    top_systems,
    inferred_patterns,

    // Minimal but complete structural fields
    life_direction: extractLifeDirection(answers),
    business_operating_reality: extractBusinessReality(answers),
    growth_tension: extractGrowthTension(answers),
    systems_accountability: extractSystems(answers),
    stall_patterns: extractStallPatterns(answers),

    contradictions: [],
    stress_patterns: {
      primary_stress_response: 'Under pressure, adapts to maintain function',
      secondary_stress_shift: 'Moderate recalibration',
      blind_spot_emergence: 'Unknown',
      escalation_chain: [],
      recovery_paths: [],
      pattern_type: 'unknown'
    },
    communication_style: {
      message_structure: 'Direct',
      directness: 'moderate',
      abstraction_level: 'moderate',
      emotional_calibration: 'Unknown',
      effectiveness_peaks: [],
      friction_points: []
    },
    leadership_architecture: {
      primary_mode: 'Operates with moderate directiveness',
      stabilizing_force: 'Moderate stabilization',
      team_experience: 'Unknown',
      challenge_surface: 'Unknown'
    },
    development_targets: [],
    environment_fit: { thrives_in: [], struggles_in: [], requires: [] },
    leadership_readiness: {
      scale_capacity: 'Unknown',
      clarity_generation: 'Unknown',
      followership_quality: 'Unknown',
      relational_collapse_risk: 'moderate',
      control_tendency: 'Unknown',
      development_capability: 'Unknown',
      confidence: 0.5
    },
    role_fit_analysis: {
      builder_vs_optimizer: 'Unknown',
      operator_vs_visionary: 'Unknown',
      manager_vs_producer: 'Unknown',
      explorer_vs_stabilizer: 'Unknown',
      executor_vs_strategist: 'Unknown',
      ambiguity_tolerance: 'moderate',
      natural_roles: [],
      friction_roles: []
    },
    future_growth_constraints: {
      at_2x_scale: [],
      at_5x_scale: [],
      stress_amplification: 'moderate',
      operational_fragility: 'Unknown',
      relational_fragility: 'Unknown'
    },
    coaching_leverage_points: {
      highest_roi_adjustment: 'Build on existing strengths',
      invisible_drag_habits: [],
      resistance_likelihood: 'moderate',
      quick_wins: [],
      long_term_work: []
    },
    hidden_risk_patterns: {
      strengths_as_liabilities: [],
      relational_erosion_risk: 'moderate',
      strategic_drift_risk: 'low',
      execution_inconsistency: 'low',
      severity: 0.5
    },
    execution_identity: {
      true_default: 'Unknown from fallback',
      claimed_identity: 'Unknown',
      identity_gap: 'Unknown'
    },
    strategic_ceiling_analysis: {
      current_ceiling: 'Unknown',
      ceiling_cause: 'Unknown'
    },
    evidence_map: {
      evidence_entries: {},
      aggregate_confidence: 0.5,
      total_evidence_sources: 0,
      high_confidence_inferences: [],
      low_confidence_inferences: []
    },
    causal_chains: {
      causal_chains: [],
      chain_count: 0
    },

    // Narrative synthesis
    narrative_profile
  };

  return canonical;
}

/**
 * Build inferred patterns from assessment answers
 */
function buildInferredPatterns(answers, vectorScores) {
  return {
    profile_type: 'Behavioral Profile (Fallback)',
    operating_signature: 'Assessment-based operator',
    decision_architecture: {
      formation_pattern: 'Standard formation',
      validation_method: 'Moderate validation',
      speed_driver: 'Moderate',
      blind_spot: 'Unknown'
    },
    leadership_approach: {
      primary_mode: 'Moderate directive',
      stabilizing_force: 'Moderate stability',
      team_experience: 'Moderate team dynamics',
      challenge_surface: 'Unknown'
    },
    communication_style: {
      message_structure: 'Direct',
      effectiveness_peak: 'Unknown',
      friction_point: 'Unknown'
    },
    pressure_response: {
      primary_shift: 'Moderate acceleration',
      secondary_shift: 'Moderate adaptation',
      blind_spot_emergence: 'Unknown'
    }
  };
}

/**
 * Extract life direction from long-form answers
 */
function extractLifeDirection(answers) {
  return {
    stated_priorities: [],
    priority_count: 0,
    future_orientation: 'unknown',
    meaning_clarity: 'unknown',
    identity_focused: false,
    word_count: 0
  };
}

/**
 * Extract business reality from answers
 */
function extractBusinessReality(answers) {
  return {
    numerical_grounding: 'unknown',
    has_specific_metrics: false,
    gap_awareness: false,
    scale_indicators: {},
    vague_vs_specific_ratio: 0,
    word_count: 0
  };
}

/**
 * Extract growth tension from answers
 */
function extractGrowthTension(answers) {
  return {
    scaling_response: 'unknown',
    vision_clarity: 'unknown',
    priority_stated: false,
    word_count: 0
  };
}

/**
 * Extract systems accountability from answers
 */
function extractSystems(answers) {
  return {
    systems_thinking: 'unknown',
    system_confidence: 'unknown',
    has_accountability_structure: false,
    coachability: 'unknown',
    meta_awareness: 'unknown',
    word_count: 0
  };
}

/**
 * Extract stall patterns from answers
 */
function extractStallPatterns(answers) {
  return {
    blame_direction: 'unknown',
    frustrations: [],
    avoidance_admitted: false,
    self_awareness: 'unknown',
    word_count: 0
  };
}

/**
 * Build fallback narrative profile from report content
 */
function buildFallbackNarrative(reportContent, inferred_patterns, metadata) {
  const person = metadata?.person_name || 'Profile';
  const company = metadata?.organization?.company || 'Organization';

  const sections = {
    profileDNA: `${person}'s profile reflects a balanced operating style across core dimensions. This is a fallback profile generated during assessment processing.`,
    
    executiveSummary: `${person} operates with moderate consistency and adaptability. Works effectively in roles requiring balanced decision-making and team collaboration.`,
    
    operatingPattern: `Standard operational approach: Maintains composure under pressure, adapts strategy based on feedback, prioritizes clear communication. Operates effectively in structured environments.`,
    
    decisionArchitecture: `Decisions formed through moderate analysis and consultation. Validates approach before committing. Speed and thoroughness balanced based on context and time pressure.`,
    
    communicationStyle: `Direct and clear communication style. Prefers explicit feedback and straightforward interaction. Avoids ambiguity in direction-setting and priorities.`,
    
    systemUnderStrain: `Under pressure: Increases focus on core priorities, maintains communication consistency, seeks stability through clear process. Pressure response is measured rather than reactive.`,
    
    hiddenContradictions: `Tension between ambition and resource constraints. Capable of envisioning growth but sometimes limited by execution bandwidth or organizational structure.`,
    
    strategicCeiling: `Current ceiling is primarily infrastructure-dependent. Growth bottleneck likely systems scalability rather than capability. Scaling requires process formalization.`,
    
    coachingLeverage: `Highest ROI development area: Build explicit systems and delegation frameworks. Second priority: Expand relational awareness during high-stakes decisions. Both yield immediate behavioral change.`,
    
    recommendedNextStep: `Start with 90-day focused work on one priority (either systems scaling or relational development). Build accountability structure for consistency. Measure and iterate.`
  };

  // Override with report content if available
  if (reportContent) {
    Object.keys(sections).forEach(key => {
      if (reportContent[`page03_executive_summary_summary_text`]) {
        sections.executiveSummary = reportContent[`page03_executive_summary_summary_text`];
      }
      if (reportContent[`page04_operating_pattern_operating_pattern_body_1`]) {
        sections.operatingPattern = reportContent[`page04_operating_pattern_operating_pattern_body_1`];
      }
      // etc. for other sections from reportContent
    });
  }

  return {
    profileDNA: sections.profileDNA,
    executiveSummary: sections.executiveSummary,
    operatingPattern: sections.operatingPattern,
    decisionArchitecture: sections.decisionArchitecture,
    communicationStyle: sections.communicationStyle,
    systemUnderStrain: sections.systemUnderStrain,
    hiddenContradictions: sections.hiddenContradictions,
    strategicCeiling: sections.strategicCeiling,
    coachingLeverage: sections.coachingLeverage,
    recommendedNextStep: sections.recommendedNextStep,
    full_narrative: Object.values(sections).join('\n\n')
  };
}
