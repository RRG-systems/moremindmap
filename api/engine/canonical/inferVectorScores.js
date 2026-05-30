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
  
  // Preserve raw scores for audit; use support-adjusted scores for topology strength.
  const vector_scores = {
    vector: dimensionScores.vector?.support_adjusted_score ?? dimensionScores.vector?.raw_score ?? 0,
    signal: dimensionScores.signal?.support_adjusted_score ?? dimensionScores.signal?.raw_score ?? 0,
    fidelity: dimensionScores.fidelity?.support_adjusted_score ?? dimensionScores.fidelity?.raw_score ?? 0,
    velocity: dimensionScores.velocity?.support_adjusted_score ?? dimensionScores.velocity?.raw_score ?? 0,
    leverage: dimensionScores.leverage?.support_adjusted_score ?? dimensionScores.leverage?.raw_score ?? 0,
    flex: dimensionScores.flex?.support_adjusted_score ?? dimensionScores.flex?.raw_score ?? 0,
    framework: dimensionScores.framework?.support_adjusted_score ?? dimensionScores.framework?.raw_score ?? 0,
    horizon: dimensionScores.horizon?.support_adjusted_score ?? dimensionScores.horizon?.raw_score ?? 0
  };
  
  // Build ranked dimensions array
  const ranked_dimensions = Object.entries(dimensionScores)
    .map(([dimension, data]) => ({
      dimension,
      score: data.support_adjusted_score ?? data.raw_score ?? 0,
      raw_score: data.raw_score ?? 0,
      support_adjusted_score: data.support_adjusted_score ?? data.raw_score ?? 0,
      rank: data.rank || 0,
      confidence: data.confidence ?? null,
      evidence_count: data.evidence_count ?? data.contributing_answer_count ?? data.contributing_answers?.length ?? 0,
      contributing_answer_count: data.contributing_answer_count ?? data.evidence_count ?? data.contributing_answers?.length ?? 0,
      distance_from_neutral: data.distance_from_neutral ?? Math.abs(data.support_adjusted_score ?? data.raw_score ?? 0),
      evidence_band: data.evidence_band || null,
      intensity_band: data.intensity_band || null,
      contributing_answers: data.contributing_answers || []
    }))
    .sort((a, b) => {
      const aEvidence = a.evidence_count || 0;
      const bEvidence = b.evidence_count || 0;
      if (aEvidence === 0 && bEvidence > 0) return 1;
      if (bEvidence === 0 && aEvidence > 0) return -1;
      return (b.support_adjusted_score ?? b.score ?? 0) - (a.support_adjusted_score ?? a.score ?? 0);
    })
    .map((dimension, index) => ({
      ...dimension,
      rank: index + 1
    }));
  
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
