/**
 * getCognitionContext.js
 * 
 * Safe helper: Extract behavioral cognition layer from canonical.
 * Implements fallback chain:
 * GPT → V1 → Structured Interpreter
 * 
 * Used by buildNarrativeV3 to provide ProfileDNA and scoring narratives
 * with actual behavioral depth instead of deterministic template.
 */

/**
 * Get the best available cognition context from canonical.
 * 
 * Returns structured object with all necessary fields from whichever layer is available.
 * 
 * @param {Object} canonical - Complete canonical dossier
 * @returns {Object} cognition_context with ranked_dimensions, dominance_profile, etc.
 */
export function getCognitionContext(canonical) {
  if (!canonical) {
    return null;
  }

  // PRIORITY 1: rescoring_gpt (GPT behavioral cognition)
  if (canonical.rescoring_gpt && canonical.rescoring_gpt.ranked_dimensions) {
    console.log('[COGNITION] Using rescoring_gpt layer');
    return {
      source: 'gpt',
      version: canonical.rescoring_gpt.model || 'gpt-5.5',
      ranked_dimensions: canonical.rescoring_gpt.ranked_dimensions,
      dominance_profile: canonical.rescoring_gpt.dominance_profile || {},
      spread_profile: canonical.rescoring_gpt.spread_profile || {},
      tension_pairs: canonical.rescoring_gpt.tension_pairs || {},
      render_ready: canonical.rescoring_gpt.render_ready || {},
      audit: canonical.rescoring_gpt.audit || {},
      confidence: canonical.rescoring_gpt.dominance_profile?.confidence || 0.9,
      generated_at: canonical.rescoring_gpt.generated_at,
      rationales: canonical.rescoring_gpt.ranked_dimensions.map(d => ({
        dimension: d.dimension,
        rationale: d.rationale
      }))
    };
  }

  // PRIORITY 2: rescoring_v1 (Deterministic behavioral topology)
  if (canonical.rescoring_v1 && canonical.rescoring_v1.ranked_dimensions) {
    console.log('[COGNITION] Using rescoring_v1 layer (deterministic fallback)');
    return {
      source: 'v1',
      version: canonical.rescoring_v1.version || 'v2-deterministic',
      ranked_dimensions: canonical.rescoring_v1.ranked_dimensions,
      dominance_profile: canonical.rescoring_v1.dominance_profile || {},
      spread_profile: canonical.rescoring_v1.spread_profile || {},
      tension_pairs: canonical.rescoring_v1.tension_pairs || {},
      render_ready: canonical.rescoring_v1.render_ready || {},
      amplitude_metrics: canonical.rescoring_v1.amplitude_metrics || {},
      confidence: canonical.rescoring_v1.dominance_profile?.confidence || 0.85
    };
  }

  // PRIORITY 3: Fall back to baseline ranked_dimensions (last resort)
  if (canonical.ranked_dimensions) {
    console.log('[COGNITION] Using baseline layer (final fallback)');
    return {
      source: 'baseline',
      version: 'empirical',
      ranked_dimensions: canonical.ranked_dimensions,
      dominance_profile: {
        primary_dimension: canonical.ranked_dimensions[0]?.dimension || 'unknown',
        secondary_dimension: canonical.ranked_dimensions[1]?.dimension || 'unknown'
      },
      spread_profile: {},
      confidence: 0.7
    };
  }

  // No cognition context available
  console.warn('[COGNITION] No cognition context found in canonical');
  return null;
}

/**
 * Get primary + secondary systems from cognition context.
 * Used by narrative prompts to reference the actual operating pattern.
 * 
 * @param {Object} cognitionContext - Result from getCognitionContext()
 * @returns {Object} { primary, secondary }
 */
export function getPrimarySecondary(cognitionContext) {
  if (!cognitionContext || !cognitionContext.ranked_dimensions) {
    return null;
  }

  const ranked = cognitionContext.ranked_dimensions;
  return {
    primary: {
      dimension: ranked[0]?.dimension || 'vector',
      score: ranked[0]?.score || ranked[0]?.gpt_rescored_score || 0,
      code: ranked[0]?.code || ranked[0]?.dimension?.substring(0, 3).toUpperCase(),
      role: ranked[0]?.role || 'PRIMARY'
    },
    secondary: {
      dimension: ranked[1]?.dimension || 'horizon',
      score: ranked[1]?.score || ranked[1]?.gpt_rescored_score || 0,
      code: ranked[1]?.code || ranked[1]?.dimension?.substring(0, 3).toUpperCase(),
      role: ranked[1]?.role || 'SECONDARY'
    }
  };
}

/**
 * Build ProfileDNA context string from cognition layer.
 * Used by narrative prompt to ground ProfileDNA in actual topology.
 * 
 * @param {Object} cognitionContext - Result from getCognitionContext()
 * @returns {String} Grounding context for ProfileDNA prompt
 */
export function buildProfileDNAContext(cognitionContext) {
  if (!cognitionContext) {
    return '';
  }

  const { source, ranked_dimensions, dominance_profile, render_ready } = cognitionContext;

  // Build context string based on source
  if (source === 'gpt') {
    // GPT context: include behavioral interpretation
    const primary = ranked_dimensions[0];
    const secondary = ranked_dimensions[1];
    
    return `
GPT Behavioral Interpretation (confidence: ${cognitionContext.confidence}):
Primary: ${primary.dimension} (${primary.gpt_rescored_score > 0 ? '+' : ''}${primary.gpt_rescored_score}, role: ${primary.role})
Rationale: ${primary.rationale}

Secondary: ${secondary.dimension} (${secondary.gpt_rescored_score > 0 ? '+' : ''}${secondary.gpt_rescored_score}, role: ${secondary.role})
Rationale: ${secondary.rationale}

Dominance: ${dominance_profile.primary_dimension} (${dominance_profile.dominance_amplitude})
Profile Intensity: ${dominance_profile.profile_intensity}
Tension: ${dominance_profile.tension_analysis || 'none'}

ProfileDNA should reflect this behavioral pattern, not generic topology.
    `.trim();
  }

  if (source === 'v1') {
    // V1 context: deterministic topology
    const primary = ranked_dimensions[0];
    const secondary = ranked_dimensions[1];
    
    return `
Deterministic Topology Analysis (confidence: ${cognitionContext.confidence}):
Primary: ${primary.dimension} (${primary.score > 0 ? '+' : ''}${primary.score})
Secondary: ${secondary.dimension} (${secondary.score > 0 ? '+' : ''}${secondary.score})

Dominance Amplitude: ${dominance_profile.dominance_amplitude}
Spread Type: ${dominance_profile.spread_type}
Profile Intensity: ${dominance_profile.profile_intensity}

Use deterministic topology as foundation.
    `.trim();
  }

  return '';
}

export default getCognitionContext;
