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
 * @returns {Object} narrative_profile
 */
export function buildNarrativeProfile(
  inferredPatterns,
  contradictions,
  stressPatterns,
  communicationStyle,
  leadershipArchitecture
) {
  const { profile_type, operating_signature } = inferredPatterns;
  
  // Executive summary (2-3 sentences)
  const executive_summary = `This is a ${profile_type} profile — ${operating_signature.toLowerCase()}. ` +
    `${leadershipArchitecture.primary_mode}. ` +
    `${leadershipArchitecture.challenge_surface}.`;
  
  // Leadership narrative
  const leadership_narrative = 
    `${leadershipArchitecture.primary_mode}. ` +
    `${leadershipArchitecture.team_experience}. ` +
    `${leadershipArchitecture.stabilizing_force}. ` +
    `The challenge surface appears when ${leadershipArchitecture.challenge_surface.toLowerCase()}. ` +
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
    `Under pressure, ${stressPatterns.primary_stress_response.toLowerCase()}. ` +
    `${stressPatterns.blind_spot_emergence}. ` +
    `Recovery path: ${stressPatterns.recovery_paths[0] || 'Re-engage dropped dimensions after stress passes'}.`;
  
  return {
    executive_summary,
    leadership_narrative,
    decision_narrative,
    communication_narrative,
    development_narrative
  };
}
