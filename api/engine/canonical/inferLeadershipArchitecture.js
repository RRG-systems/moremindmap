/**
 * inferLeadershipArchitecture.js
 * 
 * Infers leadership approach and team dynamics patterns.
 * Leadership = dimension interactions + power dynamics + team impact
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
 * Infer leadership architecture from dimension scores
 * 
 * @param {Object} vectorScores - Normalized dimension scores
 * @param {Array} rankedDimensions - Dimensions sorted by score
 * @returns {Object} leadership_architecture
 */
export function inferLeadershipArchitecture(vectorScores, rankedDimensions) {
  const primary = rankedDimensions[0]?.dimension || 'vector';
  const secondary = rankedDimensions[1]?.dimension || 'signal';
  const opposing1 = rankedDimensions[6]?.dimension || 'flex';
  
  const vectorScore = vectorScores.vector || 0;
  const leverageScore = vectorScores.leverage || 0;
  const signalScore = vectorScores.signal || 0;
  const frameworkScore = vectorScores.framework || 0;
  
  // Primary leadership mode
  let primary_mode = '';
  if (vectorScore > 6.5) {
    primary_mode = "Directive — establishes direction before building consensus";
  } else if (leverageScore > 6.5) {
    primary_mode = "Influence-positioning — shapes outcomes through stakeholder alignment";
  } else if (frameworkScore > 6.5) {
    primary_mode = "Process-driven — leads through structure and defined methodology";
  } else if (signalScore > 6.5) {
    primary_mode = "Relational — reads dynamics and calibrates approach to team state";
  } else {
    primary_mode = `${DIMENSION_LABELS[primary]}-driven leadership`;
  }
  
  // Stabilizing force
  const stabilizing_force = `${DIMENSION_LABELS[secondary]} provides structural support when ${DIMENSION_LABELS[primary]} creates tension`;
  
  // Team experience (what it's like to be led by them)
  let team_experience = '';
  if (vectorScore > 6.5 && signalScore < 4.0) {
    team_experience = "Clear direction, high momentum — may feel hard to slow down or redirect once moving";
  } else if (vectorScore > 6.5 && signalScore > 5.0) {
    team_experience = "Clear direction with relational calibration — knows where to go AND senses team state";
  } else if (frameworkScore > 6.5 && vectorScores.flex < 4.0) {
    team_experience = "Clear process and structure — may feel rigid when pivot needed";
  } else if (signalScore > 6.5 && vectorScore < 4.0) {
    team_experience = "Highly calibrated to team dynamics — may delay action waiting for alignment";
  } else {
    team_experience = `Team experiences ${DIMENSION_LABELS[primary]} as primary organizing force`;
  }
  
  // Challenge surface (where leadership creates friction)
  let challenge_surface = '';
  if (vectorScore > 6.5 && signalScore < 4.0) {
    challenge_surface = "Speed outpaces shared context — team may struggle to keep up or feel unheard";
  } else if (frameworkScore > 6.5 && vectorScores.flex < 4.0) {
    challenge_surface = "Process rigidity when environment shifts — team may need permission to deviate";
  } else if (signalScore > 6.5 && vectorScore < 4.0) {
    challenge_surface = "Relational calibration can slow decision-making — team may want clearer direction";
  } else {
    challenge_surface = `${DIMENSION_LABELS[primary]} dominance can suppress ${DIMENSION_LABELS[opposing1]} — creates blind spot`;
  }
  
  // Dissent tolerance
  let dissent_tolerance = 'moderate';
  if (vectorScore > 7.0 && signalScore < 3.5) {
    dissent_tolerance = 'low'; // directive dominance suppresses challenge
  } else if (signalScore > 6.5 || vectorScores.flex > 6.5) {
    dissent_tolerance = 'high'; // relational/adaptive profiles welcome input
  } else if (frameworkScore > 7.0) {
    dissent_tolerance = 'process-dependent'; // challenge process = harder than challenge content
  }
  
  // Development orientation
  let development_orientation = '';
  if (vectorScore > 6.5) {
    development_orientation = "Develops people through challenge and stretch assignments";
  } else if (signalScore > 6.5) {
    development_orientation = "Develops people through relational support and calibrated feedback";
  } else if (frameworkScore > 6.5) {
    development_orientation = "Develops people through structured skill-building and clear expectations";
  } else {
    development_orientation = `Development approach reflects ${DIMENSION_LABELS[primary]} priority`;
  }
  
  // Calibrations
  const calibrations = [];
  if (vectorScore > 6.5 && signalScore < 4.0) {
    calibrations.push("Build explicit permission for team to slow you down");
    calibrations.push("Create forced dissent windows before locking direction");
  }
  if (frameworkScore > 6.5 && vectorScores.flex < 4.0) {
    calibrations.push("Pre-authorize deviation paths when pivot signals appear");
  }
  
  return {
    primary_mode,
    stabilizing_force,
    team_experience,
    challenge_surface,
    dissent_tolerance,
    development_orientation,
    calibrations
  };
}
