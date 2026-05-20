/**
 * inferContradictions.js
 * 
 * Detects internal behavioral tensions and contradictions.
 * 
 * Contradictions are NOT weaknesses.
 * They are complexity points requiring conscious integration.
 * 
 * Key inference targets:
 * - Values vs defaults
 * - Capability vs prioritization
 * - Claimed flexibility vs operational rigidity
 * - Collaboration language vs directive dominance
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
 * Detect high-high conflicts (both dimensions strong but create tension)
 */
function detectHighHighConflicts(vectorScores, threshold = 6.0) {
  const conflicts = [];
  
  // Vector + Framework = directive rigidity
  if (vectorScores.vector > threshold && vectorScores.framework > threshold) {
    conflicts.push({
      tension: "High command with high structure creates directive rigidity",
      dimensions_in_conflict: ['vector', 'framework'],
      manifestation: "Decisions form quickly but must follow pre-defined process — creates speed vs structure tension",
      resolution_path: "Build flex capacity to maintain direction while adjusting method",
      severity: 'moderate'
    });
  }
  
  // Framework + Velocity = structure vs speed
  if (vectorScores.framework > threshold && vectorScores.velocity > threshold) {
    conflicts.push({
      tension: "High structure with high tempo creates process vs speed friction",
      dimensions_in_conflict: ['framework', 'velocity'],
      manifestation: "Want to move fast but need defined process first — creates startup delay",
      resolution_path: "Pre-build process templates to enable fast structured execution",
      severity: 'moderate'
    });
  }
  
  // Vector + Signal = directive vs relational
  if (vectorScores.vector > threshold && vectorScores.signal > threshold) {
    conflicts.push({
      tension: "High command with high relational awareness creates directive calibration complexity",
      dimensions_in_conflict: ['vector', 'signal'],
      manifestation: "Know where to go AND sense team resistance — creates internal conflict between direction and accommodation",
      resolution_path: "Establish direction, then calibrate explicitly rather than suppressing command",
      severity: 'mild'
    });
  }
  
  return conflicts;
}

/**
 * Detect high-low tensions (strength suppresses weakness)
 */
function detectHighLowTensions(vectorScores, rankedDimensions) {
  const tensions = [];
  
  const primary = rankedDimensions[0]?.dimension;
  const opposing1 = rankedDimensions[6]?.dimension;
  const opposing2 = rankedDimensions[7]?.dimension;
  
  const primaryScore = vectorScores[primary] || 0;
  const opposing1Score = vectorScores[opposing1] || 0;
  const opposing2Score = vectorScores[opposing2] || 0;
  
  // High primary + Low opposing = blind spot
  if (primaryScore > 6.0 && opposing1Score < 4.0) {
    const gap = primaryScore - opposing1Score;
    const severity = gap > 5.0 ? 'high' : gap > 3.5 ? 'moderate' : 'mild';
    
    tensions.push({
      tension: `High ${DIMENSION_LABELS[primary]} suppresses ${DIMENSION_LABELS[opposing1]}`,
      dimensions_in_conflict: [primary, opposing1],
      manifestation: `${DIMENSION_LABELS[primary]} dominates operating system — ${DIMENSION_LABELS[opposing1]} signals don't register until they escalate`,
      resolution_path: `Build conscious ${DIMENSION_LABELS[opposing1]} check-ins before ${DIMENSION_LABELS[primary]} execution`,
      severity
    });
  }
  
  // Capability vs prioritization gap
  if (primaryScore > 7.0 && opposing2Score < 3.5) {
    tensions.push({
      tension: `Capable of ${DIMENSION_LABELS[opposing2]} but doesn't prioritize it`,
      dimensions_in_conflict: [primary, opposing2],
      manifestation: `Can access ${DIMENSION_LABELS[opposing2]} when necessary but defaults to ${DIMENSION_LABELS[primary]} — feels like conscious effort to shift`,
      resolution_path: `Recognize ${DIMENSION_LABELS[opposing2]} as built capability, not natural default`,
      severity: 'moderate'
    });
  }
  
  return tensions;
}

/**
 * Detect claimed vs operational contradictions from written responses
 */
function detectClaimedVsOperational(profileInput, vectorScores) {
  const contradictions = [];
  
  // Check if they claim flexibility but have low flex score
  const rawAnswers = profileInput.raw_answers || {};
  const writtenResponses = Object.values(rawAnswers)
    .filter(a => a.question_type === 'written')
    .map(a => a.answer_text || '')
    .join(' ')
    .toLowerCase();
  
  // Claims flexibility but low flex score
  if ((writtenResponses.includes('flexible') || writtenResponses.includes('adapt')) && vectorScores.flex < 4.0) {
    contradictions.push({
      tension: "Values flexibility but defaults to directional consistency",
      dimensions_in_conflict: ['vector', 'flex'],
      manifestation: "Describes being adaptable but behavioral traces show maintained direction once set",
      resolution_path: "Recognize flex as capability you've built, not natural default — pivots cost energy",
      severity: 'mild'
    });
  }
  
  // Claims collaboration but high vector + low signal
  if ((writtenResponses.includes('collaborat') || writtenResponses.includes('team')) && 
      vectorScores.vector > 6.0 && vectorScores.signal < 4.0) {
    contradictions.push({
      tension: "Values collaboration but defaults to directive action",
      dimensions_in_conflict: ['vector', 'signal'],
      manifestation: "Collaborative language but operational traces show direction-setting before input-gathering",
      resolution_path: "Build explicit consensus checkpoints rather than assuming directive = anti-collaborative",
      severity: 'moderate'
    });
  }
  
  return contradictions;
}

/**
 * Main contradiction inference function
 * 
 * @param {Object} vectorScores - Normalized dimension scores
 * @param {Array} rankedDimensions - Dimensions sorted by score
 * @param {Object} profileInput - Original profile input for written response analysis
 * @returns {Array<Object>} contradictions
 */
export function inferContradictions(vectorScores, rankedDimensions, profileInput = {}) {
  const contradictions = [];
  
  // Detect high-high conflicts
  const highHighConflicts = detectHighHighConflicts(vectorScores);
  contradictions.push(...highHighConflicts);
  
  // Detect high-low tensions
  const highLowTensions = detectHighLowTensions(vectorScores, rankedDimensions);
  contradictions.push(...highLowTensions);
  
  // Detect claimed vs operational contradictions
  const claimedVsOperational = detectClaimedVsOperational(profileInput, vectorScores);
  contradictions.push(...claimedVsOperational);
  
  return contradictions;
}
