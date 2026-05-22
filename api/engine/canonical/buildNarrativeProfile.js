/**
 * buildNarrativeProfile.js
 * 
 * Builds human-readable narrative summaries from inferred patterns.
 * 
 * CRITICAL STYLE RULES:
 * - Observational, not motivational
 * - Precise, not vague
 * - Operational, not inspirational
 * - Tension-aware, not smoothed
 * - Psychologically accurate, not flattering
 * 
 * BANNED:
 * - Therapy language
 * - Horoscope language
 * - Generic positivity
 * - "You're a natural leader"
 * - Motivational fluff
 */

/**
 * Build narrative profile from inferred patterns
 * 
 * @param {Object} inferredPatterns - Behavioral patterns
 * @param {Array} contradictions - Internal tensions
 * @param {Object} stressPatterns - Pressure response
 * @param {Object} communicationStyle - Communication mechanics
 * @param {Object} leadershipArchitecture - Leadership dynamics
 * @param {Object} analyzedResponses - Long-form answer analysis (Step 2D)
 * @returns {Object} narrative_profile
 */
export function buildNarrativeProfile(
  inferredPatterns,
  contradictions,
  stressPatterns,
  communicationStyle,
  leadershipArchitecture,
  analyzedResponses = {},
  leadershipReadiness = null,
  futureConstraints = null,
  coachingLeverage = null,
  hiddenRisks = null,
  strategicCeiling = null
) {
  const { profile_type, operating_signature } = inferredPatterns;
  
  // Executive summary (2-3 sentences)
  const opSig = String(operating_signature || 'profile').toLowerCase();
  const challengeSurface = String((leadershipArchitecture && leadershipArchitecture.challenge_surface) || 'challenge').toLowerCase();
  const executive_summary = `This is a ${profile_type} profile — ${opSig}. ` +
    `${leadershipArchitecture && leadershipArchitecture.primary_mode || 'operates'}. ` +
    `${leadershipArchitecture && leadershipArchitecture.challenge_surface || 'surfaces in complex situations'}.`;
  
  // Leadership narrative
  const leadership_narrative = 
    `${leadershipArchitecture.primary_mode}. ` +
    `${leadershipArchitecture.team_experience}. ` +
    `${leadershipArchitecture.stabilizing_force}. ` +
    `The challenge surface appears when ${challengeSurface}. ` +
    (contradictions.length > 0 
      ? `Internal tension: ${contradictions[0].manifestation}. ` 
      : '') +
    `Development path: ${leadershipArchitecture.calibrations[0] || 'Build capacity in underutilized dimensions'}.`;
  
  // Decision narrative
  const decision_narrative =
    `${inferredPatterns.decision_architecture.formation_pattern}. ` +
    `${inferredPatterns.decision_architecture.validation_method}. ` +
    `${inferredPatterns.decision_architecture.speed_driver}. ` +
    `Blind spot: ${inferredPatterns.decision_architecture.blind_spot}. ` +
    (contradictions.length > 1
      ? `This creates tension — ${contradictions[1]?.manifestation || 'speed vs thoroughness tradeoff'}.`
      : '');
  
  // Communication narrative
  const communication_narrative =
    `Communication style: ${communicationStyle.message_structure}. ` +
    `Directness: ${communicationStyle.directness}. ` +
    `Abstraction level: ${communicationStyle.abstraction_level}. ` +
    `${communicationStyle.emotional_calibration}. ` +
    `Works best ${communicationStyle.effectiveness_peaks[0] || 'in aligned environments'}. ` +
    `Friction point: ${communicationStyle.friction_points[0] || 'when style mismatches culture'}.`;
  
  // Development narrative
  const development_narrative =
    (contradictions.length > 0
      ? `Primary development opportunity: ${contradictions[0].resolution_path}. `
      : 'Development focuses on building capacity in underutilized dimensions. ') +
    `Under pressure, ${String((stressPatterns && stressPatterns.primary_stress_response) || 'stress intensifies').toLowerCase()}. ` +
    `${stressPatterns.blind_spot_emergence}. ` +
    `Recovery path: ${stressPatterns.recovery_paths[0] || 'Re-engage dropped dimensions after stress passes'}.`;
  
  // Business manifestation narrative (Step 2D)
  const business_manifestation = buildBusinessManifestationNarrative(
    analyzedResponses,
    inferredPatterns,
    contradictions
  );
  
  // Contradiction analysis narrative (Step 2D)
  const contradiction_analysis = buildContradictionAnalysisNarrative(contradictions);
  
  // Leadership readiness narrative (Step 2E-D)
  const leadership_readiness_narrative = leadershipReadiness
    ? `Leadership readiness: ${leadershipReadiness.scale_capacity}. ` +
      `${leadershipReadiness.clarity_generation}. ` +
      `Followership: ${leadershipReadiness.followership_quality}. ` +
      `Control tendency: ${leadershipReadiness.control_tendency}. ` +
      `${leadershipReadiness.development_capability}.`
    : 'Leadership readiness assessment unavailable.';
  
  // Future bottlenecks narrative (Step 2E-D)
  const future_bottlenecks_narrative = futureConstraints
    ? `At 2x scale: ${futureConstraints.at_2x_scale.slice(0, 2).join('; ')}. ` +
      `At 5x scale: ${futureConstraints.at_5x_scale.slice(0, 2).join('; ')}. ` +
      `${futureConstraints.scaling_resistance_pattern}.`
    : 'Future constraint analysis unavailable.';
  
  // Coaching leverage narrative (Step 2E-D)
  const coaching_leverage_narrative = coachingLeverage
    ? `Highest ROI: ${coachingLeverage.highest_roi_adjustment}. ` +
      `Resistance likelihood: ${coachingLeverage.resistance_likelihood}. ` +
      `Quick wins: ${coachingLeverage.quick_wins[0] || 'None identified'}. ` +
      `Invisible drag: ${coachingLeverage.invisible_drag_habits[0] || 'Minimal'}.`
    : 'Coaching leverage assessment unavailable.';
  
  // Hidden risks narrative (Step 2E-D)
  const hidden_risks_narrative = hiddenRisks
    ? `Risk severity: ${(hiddenRisks.severity * 100).toFixed(0)}%. ` +
      `${hiddenRisks.relational_erosion_risk}. ` +
      `${hiddenRisks.burnout_trajectory}. ` +
      (hiddenRisks.strengths_as_liabilities.length > 0
        ? `Strength liability: ${hiddenRisks.strengths_as_liabilities[0]}.`
        : '')
    : 'Risk assessment unavailable.';
  
  // Strategic ceiling narrative (Step 2E-D)
  const strategic_ceiling_narrative = strategicCeiling
    ? `Current ceiling: ${strategicCeiling.current_ceiling}. ` +
      `Cause: ${strategicCeiling.ceiling_cause}. ` +
      `Breakthrough requirement: ${strategicCeiling.breakthrough_requirement}. ` +
      `Ceiling proximity: ${(strategicCeiling.ceiling_proximity * 100).toFixed(0)}%.`
    : 'Strategic ceiling assessment unavailable.';
  
  return {
    executive_summary,
    leadership_narrative,
    decision_narrative,
    communication_narrative,
    development_narrative,
    business_manifestation,
    contradiction_analysis,
    leadership_readiness_narrative,
    future_bottlenecks_narrative,
    coaching_leverage_narrative,
    hidden_risks_narrative,
    strategic_ceiling_narrative
  };
}

/**
 * Build business manifestation narrative from analyzed responses
 */
function buildBusinessManifestationNarrative(analyzedResponses, inferredPatterns, contradictions) {
  const { business_reality, stall_patterns, growth_tension } = analyzedResponses;
  
  if (!business_reality && !stall_patterns) {
    return 'Business context not provided in assessment.';
  }
  
  let narrative = '';
  
  // Stall pattern analysis
  if (stall_patterns) {
    const blameDirection = stall_patterns.blame_direction === 'external' 
      ? 'externalizes bottlenecks to market, people, or circumstances'
      : stall_patterns.blame_direction === 'internal'
      ? 'internalizes friction and looks inward for solutions'
      : 'balances external constraints with internal accountability';
    
    narrative += `When performance stalls, ${blameDirection}. `;
    
    if (Array.isArray(stall_patterns.frustrations) && stall_patterns.frustrations.includes('relational')) {
      narrative += 'Relational friction surfaces as primary frustration point. ';
    }
    if (stall_patterns.avoidance_admitted) {
      narrative += 'Acknowledges avoidance patterns — awareness present but execution gap remains. ';
    }
  }
  
  // Growth ceiling
  if (growth_tension) {
    if (growth_tension.scaling_response === 'resistance' || growth_tension.scaling_response === 'ceiling') {
      narrative += 'Growth ceiling tension: emotional resistance to 3x scale suggests capacity limit below stated ambition. ';
    } else if (growth_tension.scaling_response === 'positive') {
      narrative += 'Emotionally positive about scale — ambition elasticity present. ';
    }
  }
  
  // Systems maturity
  if (business_reality) {
    if (business_reality.numerical_grounding === 'high') {
      narrative += 'High numerical grounding — operationally specific about metrics and scale. ';
    } else if (business_reality.numerical_grounding === 'low') {
      narrative += 'Low numerical grounding — operates more conceptually than metrically. ';
    }
  }
  
  return narrative || 'Business manifestation patterns require more detailed responses for full analysis.';
}

/**
 * Build contradiction analysis narrative
 */
function buildContradictionAnalysisNarrative(contradictions) {
  if (contradictions.length === 0) {
    return 'No significant internal contradictions detected. Operating system shows dimensional coherence.';
  }
  
  const highSeverity = contradictions.filter(c => c.severity === 'high');
  const moderateSeverity = contradictions.filter(c => c.severity === 'moderate');
  
  let narrative = '';
  
  if (highSeverity.length > 0) {
    narrative += `Critical tension: ${highSeverity[0].manifestation}. `;
  }
  
  if (moderateSeverity.length > 0) {
    narrative += `Internal contradiction: ${moderateSeverity[0].manifestation}. `;
    if (moderateSeverity.length > 1) {
      narrative += `Additional tension: ${moderateSeverity[1].manifestation}. `;
    }
  }
  
  // Resolution framing
  if (contradictions.length > 0) {
    narrative += `Resolution path: ${contradictions[0].resolution_path || 'Build conscious integration between conflicting dimensions'}.`;
  }
  
  return narrative;
}
