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
 *
 * Phase 3A Integration:
 * - Executive Summary (causal specificity + operational realism)
 * - Leadership Narrative (directness-as-efficiency mechanism)
 * - Decision Narrative (certainty-seeking + pressure response)
 */

import {
  generateExecutiveSummary,
  generateLeadershipNarrative,
  generateDecisionNarrative,
  shouldUsePhase3AUpgrades
} from './phase3a-narrative-upgrades.js';

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
  strategicCeiling = null,
  vectorScores = {},
  organizationalMetadata = {}
) {
  // Defensive normalization for semantic objects
  if (!leadershipArchitecture) {
    leadershipArchitecture = {
      primary_mode: 'leadership approach undefined',
      team_experience: 'team dynamics not assessed',
      stabilizing_force: 'stabilizing mechanism undefined',
      challenge_surface: 'challenges not fully mapped',
      calibrations: []
    };
  }

  if (!inferredPatterns) {
    inferredPatterns = {
      profile_type: 'Profile',
      operating_signature: 'signature undefined',
      decision_architecture: {
        formation_pattern: 'formation undefined',
        validation_method: 'validation method undefined',
        speed_driver: 'speed driver undefined',
        blind_spot: 'blind spot undefined'
      }
    };
  }

  if (!stressPatterns) {
    stressPatterns = {
      primary_stress_response: 'stress response undefined',
      blind_spot_emergence: 'blind spot emergence undefined',
      recovery_paths: []
    };
  }
  
  if (!contradictions || !Array.isArray(contradictions)) {
    contradictions = [];
  }
  
  if (!communicationStyle) {
    communicationStyle = {
      message_structure: 'direct',
      directness: 'moderate',
      abstraction_level: 'mixed',
      emotional_calibration: 'Calibration undefined',
      effectiveness_peaks: [],
      friction_points: []
    };
  }
  
  const { profile_type, operating_signature } = inferredPatterns;
  const challengeSurface = String((leadershipArchitecture && leadershipArchitecture.challenge_surface) || 'challenge').toLowerCase();

  // Phase 3A Executive summary with operational specificity
  let executive_summary;
  if (shouldUsePhase3AUpgrades(vectorScores, stressPatterns, analyzedResponses.stall_patterns)) {
    executive_summary = generateExecutiveSummary(
      vectorScores,
      inferredPatterns,
      leadershipArchitecture,
      organizationalMetadata
    );
  } else {
    const opSig = String(operating_signature || 'profile').toLowerCase();
    executive_summary = `This is a ${profile_type} profile - ${opSig}. ` +
      `${leadershipArchitecture && leadershipArchitecture.primary_mode || 'operates'}. ` +
      `${leadershipArchitecture && leadershipArchitecture.challenge_surface || 'surfaces in complex situations'}.`;
  }

  // Phase 3A Leadership narrative with mechanism explanation
  let leadership_narrative;
  if (shouldUsePhase3AUpgrades(vectorScores, stressPatterns, analyzedResponses.stall_patterns)) {
    leadership_narrative = generateLeadershipNarrative(
      vectorScores,
      stressPatterns,
      communicationStyle,
      contradictions,
      organizationalMetadata
    );
  } else {
    leadership_narrative = 
      `${leadershipArchitecture?.primary_mode || 'leadership approach undefined'}. ` +
      `${leadershipArchitecture?.team_experience || 'team experience undefined'}. ` +
      `${leadershipArchitecture?.stabilizing_force || 'stabilizing force undefined'}. ` +
      `The challenge surface appears when ${challengeSurface}. ` +
      (Array.isArray(contradictions) && contradictions.length > 0 
        ? `Internal tension: ${contradictions[0]?.manifestation || 'tension undefined'}. ` 
        : '') +
      `Development path: ${leadershipArchitecture?.calibrations?.[0] || 'Build capacity in underutilized dimensions'}.`;
  }

  // Phase 3A Decision narrative with pressure response analysis
  let decision_narrative;
  if (shouldUsePhase3AUpgrades(vectorScores, stressPatterns, analyzedResponses.stall_patterns)) {
    decision_narrative = generateDecisionNarrative(
      vectorScores,
      stressPatterns,
      inferredPatterns,
      organizationalMetadata
    );
  } else {
    decision_narrative =
      `${inferredPatterns?.decision_architecture?.formation_pattern || 'formation pattern undefined'}. ` +
      `${inferredPatterns?.decision_architecture?.validation_method || 'validation method undefined'}. ` +
      `${inferredPatterns?.decision_architecture?.speed_driver || 'speed driver undefined'}. ` +
      `Blind spot: ${inferredPatterns?.decision_architecture?.blind_spot || 'blind spot undefined'}. ` +
      (Array.isArray(contradictions) && contradictions.length > 1
        ? `This creates tension — ${contradictions[1]?.manifestation || 'speed vs thoroughness tradeoff'}.`
        : '');
  }

  // Communication narrative
  const communication_narrative =
    `Communication style: ${communicationStyle?.message_structure || 'direct'}. ` +
    `Directness: ${communicationStyle?.directness || 'moderate'}. ` +
    `Abstraction level: ${communicationStyle?.abstraction_level || 'mixed'}. ` +
    `${communicationStyle?.emotional_calibration || 'Calibration context-dependent'}. ` +
    `Works best ${(Array.isArray(communicationStyle?.effectiveness_peaks) && communicationStyle.effectiveness_peaks[0]) || 'in aligned environments'}. ` +
    `Friction point: ${(Array.isArray(communicationStyle?.friction_points) && communicationStyle.friction_points[0]) || 'when style mismatches culture'}.`;

  // Development narrative
  const development_narrative =
    (Array.isArray(contradictions) && contradictions.length > 0
      ? `Primary development opportunity: ${contradictions[0]?.resolution_path || 'Build capacity in underutilized dimensions'}. `
      : 'Development focuses on building capacity in underutilized dimensions. ') +
    `Under pressure, ${String((stressPatterns && stressPatterns.primary_stress_response) || 'stress intensifies').toLowerCase()}. ` +
    `${stressPatterns?.blind_spot_emergence || 'Blind spot patterns emerge under sustained pressure'}. ` +
    `Recovery path: ${(Array.isArray(stressPatterns?.recovery_paths) && stressPatterns.recovery_paths[0]) || 'Re-engage dropped dimensions after stress passes'}.`;

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
      (Array.isArray(hiddenRisks?.strengths_as_liabilities) && hiddenRisks.strengths_as_liabilities.length > 0
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
      narrative += 'Acknowledges avoidance patterns - awareness present but execution gap remains. ';
    }
  }

  // Growth ceiling
  if (growth_tension) {
    if (growth_tension.scaling_response === 'resistance' || growth_tension.scaling_response === 'ceiling') {
      narrative += 'Growth ceiling tension: emotional resistance to 3x scale suggests capacity limit below stated ambition. ';
    } else if (growth_tension.scaling_response === 'positive') {
      narrative += 'Emotionally positive about scale - ambition elasticity present. ';
    }
  }

  // Systems maturity
  if (business_reality) {
    if (business_reality.numerical_grounding === 'high') {
      narrative += 'High numerical grounding - operationally specific about metrics and scale. ';
    } else if (business_reality.numerical_grounding === 'low') {
      narrative += 'Low numerical grounding - operates more conceptually than metrically. ';
    }
  }

  return narrative || 'Business manifestation patterns require more detailed responses for full analysis.';
}

/**
 * Build contradiction analysis narrative
 */
function buildContradictionAnalysisNarrative(contradictions) {
  if (!Array.isArray(contradictions) || contradictions.length === 0) {
    return 'No significant internal contradictions detected. Operating system shows dimensional coherence.';
  }
  
  const highSeverity = contradictions.filter(c => c?.severity === 'high');
  const moderateSeverity = contradictions.filter(c => c?.severity === 'moderate');

  let narrative = '';
  
  if (Array.isArray(highSeverity) && highSeverity.length > 0) {
    narrative += `Critical tension: ${highSeverity[0]?.manifestation || 'critical tension present'}. `;
  }

  if (Array.isArray(moderateSeverity) && moderateSeverity.length > 0) {
    narrative += `Internal contradiction: ${moderateSeverity[0]?.manifestation || 'internal contradiction present'}. `;
    if (moderateSeverity.length > 1) {
      narrative += `Additional tension: ${moderateSeverity[1]?.manifestation || 'additional tension present'}. `;
    }
  }
  
  // Resolution framing
  if (Array.isArray(contradictions) && contradictions.length > 0) {
    narrative += `Resolution path: ${contradictions[0]?.resolution_path || 'Build conscious integration between conflicting dimensions'}.`;
  }

  return narrative;
}
