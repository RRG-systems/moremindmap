/**
 * inferBehavioralPatterns.js
 * 
 * CORE INTELLIGENCE LAYER
 * 
 * Interprets dimension scores into behavioral mechanics.
 * This is NOT personality description.
 * This is operational behavior inference.
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
 * Classify profile type from dimension combination
 */
function classifyProfileType(primary, secondary) {
  const primaryLabel = DIMENSION_LABELS[primary] || primary;
  const secondaryLabel = DIMENSION_LABELS[secondary] || secondary;
  return `${primaryLabel}/${secondaryLabel}`;
}

/**
 * Generate operating signature from top dimensions
 */
function generateOperatingSignature(primary, secondary, vectorScores) {
  const patterns = {
    vector_horizon: "Decisive directive with long-range framing",
    vector_framework: "Directive execution within structured process",
    vector_leverage: "Strategic command through influence positioning",
    signal_framework: "Relational calibration through structured process",
    signal_horizon: "Relational awareness with future-state framing",
    framework_fidelity: "Process-driven precision execution",
    velocity_vector: "High-speed directive action",
    horizon_leverage: "Strategic positioning with future orientation"
  };
  
  const key = `${primary}_${secondary}`;
  return patterns[key] || `${DIMENSION_LABELS[primary]}-driven with ${DIMENSION_LABELS[secondary]} stabilization`;
}

/**
 * Infer leadership approach from dimension profile
 */
function inferLeadershipApproach(primary, secondary, opposing1, vectorScores) {
  const primaryLabel = DIMENSION_LABELS[primary];
  const secondaryLabel = DIMENSION_LABELS[secondary];
  const opposing1Label = DIMENSION_LABELS[opposing1];
  
  let primary_mode = '';
  let stabilizing_force = '';
  let team_experience = '';
  let challenge_surface = '';
  
  // Infer based on primary dimension
  if (primary === 'vector') {
    primary_mode = "Establishes direction before consensus forms";
    team_experience = "Clear where we're going, may feel hard to slow down";
    challenge_surface = "Speed can outpace shared understanding";
  } else if (primary === 'signal') {
    primary_mode = "Reads relational dynamics before acting";
    team_experience = "Feels understood and calibrated to";
    challenge_surface = "May delay action waiting for perfect timing";
  } else if (primary === 'framework') {
    primary_mode = "Establishes process before execution";
    team_experience = "Clear structure and expectations";
    challenge_surface = "Process can constrain speed when pivot needed";
  } else if (primary === 'horizon') {
    primary_mode = "Frames decisions through future-state lens";
    team_experience = "Understands where this leads long-term";
    challenge_surface = "May under-invest in present-state execution";
  } else if (primary === 'velocity') {
    primary_mode = "Moves to action quickly";
    team_experience = "High momentum and pace";
    challenge_surface = "Speed can bypass necessary context-building";
  } else if (primary === 'leverage') {
    primary_mode = "Positions influence strategically";
    team_experience = "Aware of power dynamics and stakeholders";
    challenge_surface = "May over-index on who vs what";
  } else if (primary === 'fidelity') {
    primary_mode = "Verifies assumptions before moving";
    team_experience = "High precision and error-catching";
    challenge_surface = "Verification can slow momentum";
  } else if (primary === 'flex') {
    primary_mode = "Adjusts approach based on context";
    team_experience = "Adaptable and responsive";
    challenge_surface = "May lack consistent direction";
  }
  
  stabilizing_force = `${secondaryLabel} provides structural support`;
  
  return {
    primary_mode,
    stabilizing_force,
    team_experience,
    challenge_surface
  };
}

/**
 * Infer decision architecture from dimensions
 */
function inferDecisionArchitecture(primary, secondary, opposing1, vectorScores) {
  const primaryLabel = DIMENSION_LABELS[primary];
  const secondaryLabel = DIMENSION_LABELS[secondary];
  
  let formation_pattern = '';
  let validation_method = '';
  let speed_driver = '';
  let blind_spot = '';
  
  // High vector = fast formation
  if (vectorScores.vector > 6.0) {
    formation_pattern = "Direction emerges quickly";
    speed_driver = "High command creates urgency bias";
  } else if (vectorScores.framework > 6.0) {
    formation_pattern = "Decisions follow defined process";
    speed_driver = "Structure constrains speed";
  } else if (vectorScores.signal > 6.0) {
    formation_pattern = "Decisions calibrate to relational context";
    speed_driver = "Relational awareness slows formation";
  } else {
    formation_pattern = `${primaryLabel} drives decision formation`;
    speed_driver = "Moderate decision velocity";
  }
  
  validation_method = `${secondaryLabel} validates approach`;
  
  // Blind spot = lowest dimension
  blind_spot = `Low ${DIMENSION_LABELS[opposing1]} means ${opposing1} signals get missed`;
  
  return {
    formation_pattern,
    validation_method,
    speed_driver,
    blind_spot
  };
}

/**
 * Infer communication style from dimensions
 */
function inferCommunicationStyleBasic(primary, secondary, vectorScores) {
  const primaryLabel = DIMENSION_LABELS[primary];
  
  let message_structure = '';
  let effectiveness_peak = '';
  let friction_point = '';
  
  if (primary === 'vector') {
    message_structure = "Direction-first, context-later";
    effectiveness_peak = "When team already shares urgency";
    friction_point = "Can feel too directive in consensus cultures";
  } else if (primary === 'signal') {
    message_structure = "Context-first, direction-emerges";
    effectiveness_peak = "When relational calibration matters";
    friction_point = "May feel slow in fast-execution cultures";
  } else if (primary === 'framework') {
    message_structure = "Process-first, structure-clear";
    effectiveness_peak = "When clarity and consistency matter";
    friction_point = "Can feel rigid when pivot needed";
  } else if (primary === 'horizon') {
    message_structure = "Future-framing before present-action";
    effectiveness_peak = "When strategic context matters";
    friction_point = "May under-communicate immediate next steps";
  } else {
    message_structure = `${primaryLabel}-first communication`;
    effectiveness_peak = "When operating environment values this dimension";
    friction_point = "When environment prioritizes opposing dimensions";
  }
  
  return {
    message_structure,
    effectiveness_peak,
    friction_point
  };
}

/**
 * Infer pressure response from dimension profile
 */
function inferPressureResponse(primary, secondary, opposing1, vectorScores) {
  const primaryLabel = DIMENSION_LABELS[primary];
  const opposing1Label = DIMENSION_LABELS[opposing1];
  
  let primary_shift = '';
  let secondary_shift = '';
  let blind_spot_emergence = '';
  
  // Under pressure, primary amplifies
  if (primary === 'vector') {
    primary_shift = "Accelerates to directive action";
  } else if (primary === 'framework') {
    primary_shift = "Tightens to defined process";
  } else if (primary === 'velocity') {
    primary_shift = "Increases tempo and execution speed";
  } else if (primary === 'horizon') {
    primary_shift = "Extends planning horizon";
  } else {
    primary_shift = `${primaryLabel} amplifies under pressure`;
  }
  
  secondary_shift = `${DIMENSION_LABELS[secondary]} becomes compensating mechanism`;
  blind_spot_emergence = `${opposing1Label} disappears — ${opposing1} signals get missed`;
  
  return {
    primary_shift,
    secondary_shift,
    blind_spot_emergence
  };
}

/**
 * Main inference function
 * 
 * @param {Object} vectorScores - Normalized dimension scores
 * @param {Array} rankedDimensions - Dimensions sorted by score
 * @param {Object} profileInput - Original profile input (for written responses)
 * @returns {Object} inferred_patterns
 */
export function inferBehavioralPatterns(vectorScores, rankedDimensions, profileInput) {
  // Extract top dimensions
  const primary = rankedDimensions[0]?.dimension || 'vector';
  const secondary = rankedDimensions[1]?.dimension || 'signal';
  const tertiary = rankedDimensions[2]?.dimension || 'fidelity';
  const opposing1 = rankedDimensions[6]?.dimension || 'flex';
  const opposing2 = rankedDimensions[7]?.dimension || 'framework';
  
  // Classify profile type
  const profile_type = classifyProfileType(primary, secondary);
  
  // Generate operating signature
  const operating_signature = generateOperatingSignature(primary, secondary, vectorScores);
  
  // Infer leadership approach
  const leadership_approach = inferLeadershipApproach(primary, secondary, opposing1, vectorScores);
  
  // Infer decision architecture
  const decision_architecture = inferDecisionArchitecture(primary, secondary, opposing1, vectorScores);
  
  // Infer communication style
  const communication_style = inferCommunicationStyleBasic(primary, secondary, vectorScores);
  
  // Infer pressure response
  const pressure_response = inferPressureResponse(primary, secondary, opposing1, vectorScores);
  
  return {
    profile_type,
    operating_signature,
    leadership_approach,
    decision_architecture,
    communication_style,
    pressure_response
  };
}
