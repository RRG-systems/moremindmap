/**
 * inferVectorScores.js
 * 
 * Extracts and normalizes raw dimension scores from profileInput.
 * Pure data extraction and normalization - no interpretation.
 */

/**
 * Infer vector scores from profileInput
 * 
 * @param {Object} profileInput - Output from buildProfileInput
 * @returns {Object} { vector_scores, ranked_dimensions, top_systems }
 */
export function inferVectorScores(profileInput) {
  // Extract dimension scores from profileInput
  const dimensionScores = profileInput.dimension_scores || {};
  
  // Normalize scores to 0-10 scale (already in raw_score format)
  const vector_scores = {
    vector: dimensionScores.vector?.raw_score || 0,
    signal: dimensionScores.signal?.raw_score || 0,
    fidelity: dimensionScores.fidelity?.raw_score || 0,
    velocity: dimensionScores.velocity?.raw_score || 0,
    leverage: dimensionScores.leverage?.raw_score || 0,
    flex: dimensionScores.flex?.raw_score || 0,
    framework: dimensionScores.framework?.raw_score || 0,
    horizon: dimensionScores.horizon?.raw_score || 0
  };
  
  // Build ranked dimensions array
  const ranked_dimensions = Object.entries(dimensionScores)
    .map(([dimension, data]) => ({
      dimension,
      score: data.raw_score || 0,
      rank: data.rank || 0
    }))
    .sort((a, b) => a.rank - b.rank);
  
  // Extract top systems from profileInput (already computed by buildProfileInput)
  const top_systems = profileInput.top_systems || {
    primary_driver: ranked_dimensions[0] || {},
    secondary_stabilizer: ranked_dimensions[1] || {},
    opposing_pattern_1: ranked_dimensions[6] || {},
    opposing_pattern_2: ranked_dimensions[7] || {}
  };
  
  return { 
    vector_scores, 
    ranked_dimensions,
    top_systems
  };
}
