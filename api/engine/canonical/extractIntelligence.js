/**
 * extractIntelligence.js
 * 
 * Behavioral Intelligence Extraction Layer (Phase 1: Tier 1)
 * Pure read-only transformation: canonical_profile_json → behavioral_intelligence_v1
 * 
 * CONSTRAINTS:
 * - Pure function (no mutations, no side effects)
 * - No GPT calls
 * - No rendering
 * - Uses existing dossier fields only
 * - Downstream only (does not modify canonical)
 */

/**
 * Main entry point for behavioral intelligence extraction.
 * 
 * @param {object} canonical_profile - Canonical dossier from buildMinimalCanonical
 * @returns {object} behavioral_intelligence_v1 - Extracted intelligence components
 */
export function extractBehavioralIntelligence(canonical_profile) {
  if (!canonical_profile) {
    return getEmptyIntelligence('canonical_profile is null or undefined');
  }

  // Handle both vault format (wrapped) and direct canonical format
  // Vault format: { profile_id, canonical_profile_json: { ... }, vector_scores, ... }
  // Direct format: { profile_id, top_systems, vector_scores, ... }
  const canonical = canonical_profile.canonical_profile_json || canonical_profile;

  const extraction_start = Date.now();

  try {
    const intelligence = {
      extraction_version: 'v1.0.0-tier1',
      extraction_timestamp: new Date().toISOString(),
      profile_id: canonical_profile.profile_id || canonical.profile_id || null,
      extraction_time_ms: 0,
      
      // Tier 1 extractions
      domains: {
        operatingSystem: extractOperatingSystem(canonical),
        worldExperience: extractWorldExperience(canonical),
        othersExperience: extractOthersExperience(canonical),
        pressureMechanics: extractPressureMechanicsStarter(canonical),
        contradictions: extractContradictionsStarter(canonical)
      },
      
      confidence_tiers: {
        operatingSystem: 'tier_1_high',
        worldExperience: 'tier_2_medium_high',
        othersExperience: 'tier_3_medium',
        pressureMechanics: 'tier_2_medium_high',
        contradictions: 'tier_3_medium'
      }
    };

    intelligence.extraction_time_ms = Date.now() - extraction_start;

    return intelligence;
  } catch (error) {
    console.error('[EXTRACT-INTELLIGENCE] Extraction failed:', error);
    return getEmptyIntelligence(error.message);
  }
}

/**
 * Domain 1: Known Operating System (Tier 1 - High Confidence)
 */
function extractOperatingSystem(canonical) {
  const top_systems = canonical.top_systems || {};
  const vector_scores = canonical.vector_scores || {};
  const dimension_tradeoffs = top_systems.dimension_tradeoffs || [];

  const primary = top_systems.primary_driver || {};
  const secondary = top_systems.secondary_stabilizer || {};
  const opposing1 = top_systems.opposing_pattern_1 || {};
  const opposing2 = top_systems.opposing_pattern_2 || {};
  const tradeoff = dimension_tradeoffs[0] || {};

  return {
    title: 'Known Operating System',
    confidence: 'tier_1_high',
    source_fields: ['top_systems.primary_driver', 'top_systems.secondary_stabilizer', 'vector_scores', 'dimension_tradeoffs'],
    
    summary: buildOperatingSystemSummary(primary, secondary, tradeoff),
    
    primary_driver: {
      dimension: primary.dimension || 'unknown',
      score: primary.score || 0,
      rank: primary.rank || 1,
      description: primary.description || '',
      operating_manifestation: primary.operating_manifestation || '',
      pressure_manifestation: primary.pressure_manifestation || ''
    },
    
    secondary_stabilizer: {
      dimension: secondary.dimension || 'unknown',
      score: secondary.score || 0,
      rank: secondary.rank || 2,
      description: secondary.description || '',
      operating_manifestation: secondary.operating_manifestation || '',
      pressure_manifestation: secondary.pressure_manifestation || ''
    },
    
    opposing_patterns: [
      {
        dimension: opposing1.dimension || 'unknown',
        score: opposing1.score || 0,
        rank: opposing1.rank || 0,
        description: opposing1.description || '',
        operating_manifestation: opposing1.operating_manifestation || ''
      },
      {
        dimension: opposing2.dimension || 'unknown',
        score: opposing2.score || 0,
        rank: opposing2.rank || 0,
        description: opposing2.description || '',
        operating_manifestation: opposing2.operating_manifestation || ''
      }
    ],
    
    core_tradeoff: {
      dimensions: tradeoff.dimensions || [],
      tradeoff: tradeoff.tradeoff || '',
      cost: tradeoff.cost || '',
      manifestation: tradeoff.manifestation || ''
    },
    
    all_scores: vector_scores,
    
    key_signals: [
      `Primary: ${primary.dimension} (${primary.score?.toFixed(1) || 0})`,
      `Secondary: ${secondary.dimension} (${secondary.score?.toFixed(1) || 0})`,
      `Core tension: ${tradeoff.tradeoff || 'Not identified'}`
    ],
    
    causal_interpretation: buildCausalInterpretation(primary, secondary, tradeoff)
  };
}

/**
 * Domain 2: How You Experience The World (Tier 1-2)
 */
function extractWorldExperience(canonical) {
  const vector_scores = canonical.vector_scores || {};
  const top_systems = canonical.top_systems || {};
  const primary = top_systems.primary_driver || {};

  const signal_score = vector_scores.signal || 0;
  const vector_score = vector_scores.vector || 0;
  const velocity_score = vector_scores.velocity || 0;
  const fidelity_score = vector_scores.fidelity || 0;
  const horizon_score = vector_scores.horizon || 0;
  const flex_score = vector_scores.flex || 0;
  const framework_score = vector_scores.framework || 0;

  return {
    title: 'How You Experience The World',
    confidence: 'tier_2_medium_high',
    source_fields: ['vector_scores', 'primary_driver.operating_manifestation'],
    
    summary: buildWorldExperienceSummary(vector_scores, primary),
    
    perception_filter: {
      signal: 'What you notice first',
      score: signal_score,
      interpretation: signal_score > 6.5 
        ? 'High perceptual acuity—notices patterns, shifts, unspoken dynamics first.'
        : signal_score > 4.5
        ? 'Balanced perception—notices both action and context.'
        : 'Action-focused perception—notices results, momentum, forward movement first.'
    },
    
    information_processing: {
      speed: velocity_score,
      detail: fidelity_score,
      interpretation: velocity_score > fidelity_score
        ? 'Processes quickly, prioritizes momentum over completeness.'
        : fidelity_score > velocity_score
        ? 'Processes thoroughly, prioritizes accuracy over speed.'
        : 'Balanced processing—adjusts speed vs detail by context.'
    },
    
    decision_formation: {
      primary_path: primary.operating_manifestation || 'Standard decision path',
      structure_bias: framework_score,
      interpretation: vector_score > 6.5
        ? `Decisions form through directional action: ${primary.operating_manifestation || 'moves immediately'}.`
        : framework_score > 6.5
        ? 'Decisions form through structured analysis and planning.'
        : 'Decisions form through balanced assessment of options.'
    },
    
    time_horizon: {
      score: horizon_score,
      interpretation: horizon_score > 7
        ? 'Extended time horizon—thinks in quarters and years, strategic planning emphasis.'
        : horizon_score > 5
        ? 'Balanced time horizon—plans ahead but stays present-focused.'
        : 'Near-term time horizon—focuses on immediate next steps and short cycles.'
    },
    
    risk_calibration: {
      flex_score: flex_score,
      vector_score: vector_score,
      interpretation: vector_score > 6.5 && flex_score < 4.5
        ? 'Higher risk tolerance—moves with conviction, less concerned with reversibility.'
        : flex_score > 6.5
        ? 'Measured risk approach—maintains optionality, adapts as information changes.'
        : 'Moderate risk calibration—situational assessment drives risk decisions.'
    },
    
    key_signals: [
      `Signal (perception): ${signal_score.toFixed(1)}`,
      `Velocity vs Fidelity: ${velocity_score.toFixed(1)} vs ${fidelity_score.toFixed(1)}`,
      `Horizon (future): ${horizon_score.toFixed(1)}`,
      `Flex (adaptability): ${flex_score.toFixed(1)}`
    ],
    
    causal_interpretation: 'Dimension scores shape perceptual filters → decision formation → behavioral patterns.'
  };
}

/**
 * Domain 3: How Others Experience You (Tier 2-3)
 */
function extractOthersExperience(canonical) {
  const top_systems = canonical.top_systems || {};
  const vector_scores = canonical.vector_scores || {};
  const primary = top_systems.primary_driver || {};
  
  const signal_score = vector_scores.signal || 0;
  const vector_score = vector_scores.vector || 0;
  const fidelity_score = vector_scores.fidelity || 0;
  const velocity_score = vector_scores.velocity || 0;
  const flex_score = vector_scores.flex || 0;

  return {
    title: 'How Others Experience You',
    confidence: 'tier_3_medium',
    source_fields: ['primary_driver', 'vector_scores.signal', 'vector_scores.vector', 'vector_scores.flex'],
    
    summary: buildOthersExperienceSummary(primary, vector_scores),
    
    first_impression: {
      primary_signal: primary.dimension || 'unknown',
      interpretation: buildFirstImpressionInterpretation(primary.dimension, vector_score, signal_score)
    },
    
    communication_pattern: {
      clarity_vs_brevity: fidelity_score > velocity_score ? 'clarity-oriented' : 'brevity-oriented',
      fidelity_score: fidelity_score,
      velocity_score: velocity_score,
      interpretation: fidelity_score > 6.5
        ? 'Communication prioritizes precision and completeness—detailed, thorough.'
        : velocity_score > 6.5
        ? 'Communication prioritizes speed and direction—concise, action-oriented.'
        : 'Communication balances detail and speed contextually.'
    },
    
    listening_pattern: {
      signal_score: signal_score,
      vector_dominance: vector_score,
      interpretation: signal_score > 6.5
        ? 'Attentive listener—tracks unspoken dynamics, tone, context.'
        : vector_score > 6.5 && signal_score < 5
        ? 'Goal-oriented listening—focuses on actionable information, may miss relational cues.'
        : 'Balanced listening—adjusts attention by situation.'
    },
    
    trust_building_speed: {
      signal_score: signal_score,
      flex_score: flex_score,
      composite: (signal_score * flex_score) / 10,
      interpretation: (signal_score * flex_score) / 10 > 5
        ? 'Builds trust relatively quickly—perceptive + adaptable creates relational ease.'
        : 'Trust builds more gradually—others may experience initial reserve or directness.'
    },
    
    key_signals: [
      `First impression: ${primary.dimension}-driven`,
      `Communication: ${fidelity_score > velocity_score ? 'clarity-oriented' : 'brevity-oriented'}`,
      `Listening: Signal ${signal_score.toFixed(1)} vs Vector ${vector_score.toFixed(1)}`,
      `Trust speed: ${((signal_score * flex_score) / 10).toFixed(1)}/10`
    ],
    
    causal_interpretation: 'Operating system → external behavior → how others perceive → relationship formation patterns.'
  };
}

/**
 * Domain 5: Pressure Mechanics (Tier 1-2 - Starter)
 */
function extractPressureMechanicsStarter(canonical) {
  const top_systems = canonical.top_systems || {};
  const stress_patterns = canonical.stress_patterns || {};
  
  const primary = top_systems.primary_driver || {};
  const secondary = top_systems.secondary_stabilizer || {};

  return {
    title: 'Pressure Mechanics (Starter)',
    confidence: 'tier_2_medium_high',
    source_fields: ['primary_driver.pressure_manifestation', 'secondary_stabilizer.pressure_manifestation', 'stress_patterns'],
    
    summary: buildPressureSummary(primary, secondary),
    
    primary_under_load: {
      dimension: primary.dimension || 'unknown',
      normal_state: primary.operating_manifestation || '',
      pressure_state: primary.pressure_manifestation || '',
      interpretation: primary.pressure_manifestation
        ? `Under pressure: ${primary.pressure_manifestation}`
        : 'Pressure response pattern not yet identified.'
    },
    
    secondary_override: {
      dimension: secondary.dimension || 'unknown',
      normal_state: secondary.operating_manifestation || '',
      override_pattern: secondary.pressure_manifestation || '',
      interpretation: secondary.pressure_manifestation
        ? `Secondary system response: ${secondary.pressure_manifestation}`
        : 'Secondary pressure response pattern not yet identified.'
    },
    
    stress_patterns_available: Object.keys(stress_patterns).length > 0,
    
    key_signals: [
      `Primary pressure: ${primary.pressure_manifestation || 'Not mapped'}`,
      `Secondary pressure: ${secondary.pressure_manifestation || 'Not mapped'}`,
      `Stress patterns: ${Object.keys(stress_patterns).length} dimensions tracked`
    ],
    
    causal_interpretation: 'Normal operating → pressure applied → primary intensifies → secondary compensates or overrides.',
    
    note: 'Full pressure mechanics (all 8 dimensions, breaking points, recovery) in Phase 2.'
  };
}

/**
 * Domain 6: Hidden Contradictions (Tier 2-3 - Starter)
 */
function extractContradictionsStarter(canonical) {
  const contradictions_array = canonical.contradictions || [];
  const dimension_tradeoffs = canonical.top_systems?.dimension_tradeoffs || [];

  return {
    title: 'Hidden Contradictions (Starter)',
    confidence: 'tier_3_medium',
    source_fields: ['contradictions', 'dimension_tradeoffs'],
    
    summary: buildContradictionsSummary(contradictions_array),
    
    contradiction_count: contradictions_array.length,
    
    contradictions: contradictions_array.slice(0, 3).map(c => ({
      type: c.type || 'unknown',
      primary_dimension: c.primary_dimension || null,
      secondary_dimension: c.secondary_dimension || null,
      cost: c.cost || '',
      resolution_attempted: c.resolution_attempted || false,
      interpretation: buildContradictionInterpretation(c)
    })),
    
    core_tradeoff: dimension_tradeoffs[0] || null,
    
    key_signals: [
      `${contradictions_array.length} contradictions identified`,
      contradictions_array[0]?.type ? `Primary: ${contradictions_array[0].type}` : 'No contradictions mapped yet',
      dimension_tradeoffs[0]?.tradeoff ? `Core friction: ${dimension_tradeoffs[0].tradeoff}` : 'Tradeoff not identified'
    ],
    
    causal_interpretation: 'Belief system → behavioral pattern → contradiction emerges → organizational cost.',
    
    note: 'Full contradiction unpacking (know vs apply gaps, evidence chains) in Phase 2.'
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function buildOperatingSystemSummary(primary, secondary, tradeoff) {
  const parts = [];
  
  if (primary.operating_manifestation) {
    parts.push(primary.operating_manifestation);
  }
  
  if (secondary.operating_manifestation) {
    parts.push(`Stabilized by ${secondary.operating_manifestation.toLowerCase()}`);
  }
  
  if (tradeoff.tradeoff) {
    parts.push(`Core friction: ${tradeoff.tradeoff}`);
  }
  
  return parts.length > 0 
    ? parts.join('. ') + '.'
    : 'Operating system profile not yet fully mapped.';
}

function buildCausalInterpretation(primary, secondary, tradeoff) {
  if (!primary.operating_manifestation) {
    return 'Causal chain: Primary dimension → operating behavior → outcomes.';
  }
  
  return `Primary (${primary.dimension}) drives forward movement. Secondary (${secondary.dimension}) provides stabilization. Friction emerges when ${tradeoff.tradeoff || 'systems conflict'}.`;
}

function buildWorldExperienceSummary(scores, primary) {
  const signal = scores.signal || 0;
  const velocity = scores.velocity || 0;
  const horizon = scores.horizon || 0;
  
  const perceptual = signal > 6.5 ? 'High perceptual acuity' : signal < 4 ? 'Action-focused perception' : 'Balanced perception';
  const processing = velocity > 6.5 ? 'rapid processing' : 'thorough processing';
  const planning = horizon > 7 ? 'extended time horizon' : 'near-term focus';
  
  return `${perceptual}, ${processing}, ${planning}. World experienced through ${primary.dimension || 'primary'} lens.`;
}

function buildOthersExperienceSummary(primary, scores) {
  const dimension = primary.dimension || 'unknown';
  const vector = scores.vector || 0;
  const signal = scores.signal || 0;
  
  const impression = dimension === 'vector' && vector > 6.5
    ? 'commanding presence'
    : dimension === 'signal' && signal > 6.5
    ? 'perceptive awareness'
    : 'balanced approach';
  
  return `Others experience ${impression} first. Communication and listening patterns shaped by dimension balance.`;
}

function buildFirstImpressionInterpretation(dimension, vector_score, signal_score) {
  switch (dimension) {
    case 'vector':
      return vector_score > 6.5
        ? 'Others experience commanding, directional presence first—clarity of purpose is immediately visible.'
        : 'Others experience purposeful energy, though less intensely directive.';
    
    case 'signal':
      return signal_score > 6.5
        ? 'Others experience perceptive awareness first—feels "seen" and understood quickly.'
        : 'Others experience attentiveness, though may not feel deeply read.';
    
    case 'fidelity':
      return 'Others experience precision and thoroughness first—attention to detail is immediately apparent.';
    
    case 'framework':
      return 'Others experience structured thinking first—organization and clarity stand out.';
    
    case 'leverage':
      return 'Others experience strategic focus first—impact-orientation is visible quickly.';
    
    default:
      return `Others experience ${dimension}-driven approach first.`;
  }
}

function buildPressureSummary(primary, secondary) {
  if (!primary.pressure_manifestation) {
    return 'Pressure response patterns not yet fully mapped.';
  }
  
  return `Under pressure: ${primary.pressure_manifestation}. Secondary system: ${secondary.pressure_manifestation || 'response not mapped'}.`;
}

function buildContradictionsSummary(contradictions) {
  if (contradictions.length === 0) {
    return 'No contradictions currently identified in dossier.';
  }
  
  if (contradictions.length === 1) {
    return `1 contradiction identified: ${contradictions[0].type || 'type not specified'}.`;
  }
  
  return `${contradictions.length} contradictions identified. Primary: ${contradictions[0].type || 'type not specified'}.`;
}

function buildContradictionInterpretation(contradiction) {
  const type = contradiction.type || 'unknown';
  const cost = contradiction.cost || 'organizational friction';
  
  return `Type: ${type}. Cost: ${cost}. ${contradiction.resolution_attempted ? 'Resolution attempted.' : 'Unresolved.'}`;
}

function getEmptyIntelligence(reason) {
  return {
    extraction_version: 'v1.0.0-tier1',
    extraction_timestamp: new Date().toISOString(),
    profile_id: null,
    extraction_time_ms: 0,
    extraction_error: reason,
    domains: {},
    confidence_tiers: {}
  };
}
