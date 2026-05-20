/**
 * inferStressPatterns.js
 * 
 * Infers behavior under pressure and strain.
 * Stress amplifies strengths and eliminates weaknesses.
 * Stress behavior is MORE reliable than resting behavior.
 */

const DIMENSION_LABELS = {
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
 * Infer stress patterns from dimension scores
 * 
 * @param {Object} vectorScores - Normalized dimension scores
 * @param {Array} rankedDimensions - Dimensions sorted by score
 * @returns {Object} stress_patterns
 */
export function inferStressPatterns(vectorScores, rankedDimensions) {
  const primary = rankedDimensions[0]?.dimension || 'vector';
  const secondary = rankedDimensions[1]?.dimension || 'signal';
  const opposing1 = rankedDimensions[6]?.dimension || 'flex';
  const opposing2 = rankedDimensions[7]?.dimension || 'framework';
  
  const primaryScore = vectorScores[primary] || 0;
  
  // Primary stress response (top dimension amplifies)
  let primary_stress_response = '';
  if (primary === 'vector') {
    primary_stress_response = "Accelerates to directive action — decisions form faster, input window narrows";
  } else if (primary === 'framework') {
    primary_stress_response = "Tightens to defined process — structure becomes non-negotiable, flexibility drops";
  } else if (primary === 'velocity') {
    primary_stress_response = "Increases tempo dramatically — execution speed prioritized over context";
  } else if (primary === 'signal') {
    primary_stress_response = "Heightens relational scanning — may over-calibrate to perceived dynamics";
  } else if (primary === 'horizon') {
    primary_stress_response = "Extends planning horizon — may over-invest in future scenario analysis";
  } else if (primary === 'fidelity') {
    primary_stress_response = "Increases verification intensity — may get stuck in validation loops";
  } else if (primary === 'leverage') {
    primary_stress_response = "Intensifies stakeholder positioning — may over-index on politics vs execution";
  } else if (primary === 'flex') {
    primary_stress_response = "Pivots more frequently — may lose directional consistency";
  }
  
  // Secondary stress shift
  const secondary_stress_shift = `${DIMENSION_LABELS[secondary]} becomes compensating mechanism — holds system together as ${DIMENSION_LABELS[primary]} amplifies`;
  
  // Blind spot emergence
  const blind_spot_emergence = `${DIMENSION_LABELS[opposing1]} and ${DIMENSION_LABELS[opposing2]} disappear — these signals don't register until crisis escalates`;
  
  // Escalation chain (mild → moderate → severe)
  const escalation_chain = [
    `Mild pressure: ${DIMENSION_LABELS[primary]} increases slightly, ${DIMENSION_LABELS[opposing1]} signals start getting missed`,
    `Moderate pressure: ${DIMENSION_LABELS[primary]} dominates operating system, ${DIMENSION_LABELS[secondary]} compensates to maintain function`,
    `Severe pressure: Pure ${DIMENSION_LABELS[primary]} execution, blind to ${DIMENSION_LABELS[opposing1]} and ${DIMENSION_LABELS[opposing2]} — repairs relationships/process after conflict resolves`
  ];
  
  // Recovery paths
  const recovery_paths = [
    `Build explicit ${DIMENSION_LABELS[opposing1]} check-ins BEFORE pressure escalates`,
    `Recognize when ${DIMENSION_LABELS[primary]} is amplifying — create circuit breakers`,
    `Post-conflict repair: consciously re-engage ${DIMENSION_LABELS[opposing1]} and ${DIMENSION_LABELS[opposing2]} after stress passes`
  ];
  
  // Narrowing vs spiraling pattern
  let pattern_type = 'narrowing'; // most profiles narrow under stress
  if (primary === 'signal' || primary === 'horizon') {
    pattern_type = 'spiraling'; // relational/future profiles may spiral into analysis
  }
  
  return {
    primary_stress_response,
    secondary_stress_shift,
    blind_spot_emergence,
    escalation_chain,
    recovery_paths,
    pattern_type // narrowing | spiraling
  };
}
