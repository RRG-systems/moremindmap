/**
 * inferCommunicationStyle.js
 * 
 * Infers communication patterns from dimension profile.
 * Communication = dimension priorities + operational framing + calibration patterns
 */

import { topologyThreshold } from '../measurement/measurementContract.js';

const HIGH_EMOTIONAL_SMOOTHING_THRESHOLD = topologyThreshold(12.0);

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
 * Infer communication style from dimension scores
 * 
 * @param {Object} vectorScores - Normalized dimension scores
 * @param {Array} rankedDimensions - Dimensions sorted by score
 * @returns {Object} communication_style
 */
export function inferCommunicationStyle(vectorScores, rankedDimensions) {
  const primary = rankedDimensions[0]?.dimension || 'vector';
  const secondary = rankedDimensions[1]?.dimension || 'signal';
  const opposing1 = rankedDimensions[6]?.dimension || 'flex';
  
  const primaryScore = vectorScores[primary] || 0;
  const signalScore = vectorScores.signal || 0;
  const vectorScore = vectorScores.vector || 0;
  
  // Message structure (what comes first)
  let message_structure = '';
  if (vectorScore > 0.60) {
    message_structure = "Direction-first, context-later — establishes where we're going before explaining why";
  } else if (signalScore > 0.60) {
    message_structure = "Context-first, direction-emerges — builds relational alignment before stating conclusion";
  } else if (vectorScores.framework > 0.60) {
    message_structure = "Process-first, structure-clear — explains methodology before diving into content";
  } else if (vectorScores.horizon > 0.60) {
    message_structure = "Future-framing before present-action — orients to end-state before immediate next steps";
  } else {
    message_structure = `${DIMENSION_LABELS[primary]}-first communication structure`;
  }
  
  // Directness level
  let directness = 'moderate';
  if (vectorScore > 0.65 && signalScore < 0.40) {
    directness = 'very high';
  } else if (signalScore > 0.65 && vectorScore < 0.40) {
    directness = 'calibrated';
  } else if (vectorScores.fidelity > 0.65) {
    directness = 'precise';
  }
  
  // Abstraction level (compression thinking)
  let abstraction_level = 'moderate';
  if (vectorScores.horizon > 0.65 || vectorScores.framework > 0.65) {
    abstraction_level = 'high'; // compresses into frameworks/patterns
  } else if (vectorScores.velocity > 0.65 || vectorScore > 0.65) {
    abstraction_level = 'low'; // operational/concrete
  }
  
  // Emotional smoothing (signal + flex)
  const emotionalSmoothing = signalScore + vectorScores.flex;
  let emotional_calibration = '';
  if (emotionalSmoothing > HIGH_EMOTIONAL_SMOOTHING_THRESHOLD) {
    emotional_calibration = "High emotional smoothing — adjusts tone and delivery based on perceived reception";
  } else if (emotionalSmoothing < 0.70) {
    emotional_calibration = "Low emotional smoothing — message delivery prioritizes clarity over reception management";
  } else {
    emotional_calibration = "Moderate emotional calibration";
  }
  
  // Effectiveness peaks
  const effectiveness_peaks = [];
  if (vectorScore > 0.60) {
    effectiveness_peaks.push("When team already shares urgency");
    effectiveness_peaks.push("In fast-execution environments");
  }
  if (signalScore > 0.60) {
    effectiveness_peaks.push("When relational dynamics matter");
    effectiveness_peaks.push("In consensus-driven cultures");
  }
  if (vectorScores.framework > 0.60) {
    effectiveness_peaks.push("When clarity and structure are valued");
  }
  
  // Friction points
  const friction_points = [];
  if (vectorScore > 0.65 && signalScore < 0.40) {
    friction_points.push("Can feel too directive in consensus cultures");
    friction_points.push("May miss relational timing cues");
  }
  if (vectorScores.framework > 0.65 && vectorScores.flex < 0.40) {
    friction_points.push("May resist process changes mid-execution");
  }
  if (abstraction_level === 'high') {
    friction_points.push("High abstraction may lose operational audiences");
  }
  
  // Calibrations
  const calibrations = [];
  if (vectorScore > 0.65 && signalScore < 0.40) {
    calibrations.push("Provide 30 seconds of relational context before directive close");
    calibrations.push("Explicitly invite dissent rather than assuming silence = agreement");
  }
  if (abstraction_level === 'high') {
    calibrations.push("Drop one level of abstraction for operational audiences");
  }
  
  return {
    message_structure,
    directness,
    abstraction_level,
    emotional_calibration,
    effectiveness_peaks,
    friction_points,
    calibrations
  };
}
