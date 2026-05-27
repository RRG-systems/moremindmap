/**
 * rescoreDimensions.js
 * 
 * RESCORING ENGINE: Behavioral Dominance Inference
 * 
 * Reads ENTIRE canonical dossier to detect and amplify true behavioral hierarchies.
 * Does NOT modify baseline. Produces rescored_v1 as downstream intelligence layer.
 * 
 * Core principle:
 * Humans are hierarchical, not balanced.
 * One dominant system bends the rest of the profile.
 * Rescoring reveals that hierarchy more clearly.
 */

/**
 * Main rescoring entry point
 * 
 * @param {Object} canonical - Complete canonical dossier
 * @returns {Object} rescoring_v1 object with scored dimensions + analysis
 */
export function rescoreDimensions(canonical) {
  if (!canonical || !canonical.ranked_dimensions) {
    return getEmptyRescoring();
  }

  const baseline = canonical.ranked_dimensions || [];
  
  // Step 1: Extract evidence from entire canonical
  const evidence = extractEvidence(canonical);
  
  // Step 2: Detect dominance patterns
  const dominance = detectDominance(baseline, evidence);
  
  // Step 3: Calculate rescored dimensions with dominance adjustment
  const rescored = calculateRescoredDimensions(baseline, dominance, evidence);
  
  // Step 4: Analyze spread characteristics
  const spread = analyzeSpread(rescored);
  
  // Step 5: Calculate gravity (which dimension drives others)
  const gravity = calculateGravity(rescored, dominance, evidence);
  
  // Step 6: Analyze tension pairs
  const tensions = analyzeTensionPairs(rescored, dominance);
  
  // Step 7: Calculate amplitude metrics
  const amplitude = calculateAmplitudeMetrics(rescored);
  
  // Step 8: Assemble rescoring_v1 structure
  return assembleRescoring(rescored, dominance, spread, gravity, tensions, amplitude);
}

/**
 * Extract all evidence from canonical dossier
 */
function extractEvidence(canonical) {
  return {
    // Baseline scores
    baseline_scores: canonical.ranked_dimensions || [],
    
    // Intake answers
    intake_answers: canonical.intake_answers || {},
    
    // Contradictions
    contradictions: canonical.contradictions || {},
    dimension_contradictions: canonical.dimension_contradictions || {},
    
    // Pressure/stress patterns
    stress_patterns: canonical.stress_patterns || {},
    hidden_costs: canonical.hidden_costs || {},
    
    // Behavioral patterns
    inferred_patterns: canonical.inferred_patterns || {},
    communication_style: canonical.communication_style || {},
    
    // Operating model
    life_direction: canonical.life_direction || {},
    business_operating_reality: canonical.business_operating_reality || {},
    
    // Written responses
    written_signals: extractWrittenSignals(canonical.intake_answers || {}),
    
    // Top systems
    top_systems: canonical.top_systems || {},
    
    // Metadata
    vector_scores: canonical.vector_scores || {}
  };
}

/**
 * Extract signals from written answers
 */
function extractWrittenSignals(answers) {
  const signals = {
    directiveness_words: 0,
    precision_words: 0,
    momentum_words: 0,
    relational_words: 0,
    contradiction_count: 0
  };

  // Q2, Q14, Q17, Q20, Q22, Q24, Q25, Q26, Q27, Q28 are written responses
  const writtenQuestions = [2, 14, 17, 20, 22, 24, 25, 26, 27, 28];
  
  writtenQuestions.forEach(q => {
    const answer = answers[`Q${q}`] || '';
    if (!answer) return;
    
    const text = String(answer).toLowerCase();
    
    // Directiveness signals
    if (/move|go|now|decide|act|push|drive|command/i.test(text)) signals.directiveness_words++;
    
    // Precision signals
    if (/precise|exact|right|careful|detail|check|verify|consider/i.test(text)) signals.precision_words++;
    
    // Momentum signals
    if (/fast|quick|speed|energy|momentum|pace|accelerate/i.test(text)) signals.momentum_words++;
    
    // Relational signals
    if (/people|team|together|collaborate|listen|understand|empathy/i.test(text)) signals.relational_words++;
    
    // Contradictions (conflicting signals in same answer)
    if (/but|however|though|yet|conflict|tension|struggle/i.test(text)) signals.contradiction_count++;
  });

  return signals;
}

/**
 * Detect dominance patterns from evidence
 */
function detectDominance(baseline, evidence) {
  if (!baseline || baseline.length === 0) {
    return { primary_dimension: null, dominance_score: 0, patterns: {} };
  }

  const primary = baseline[0];
  const secondary = baseline[1];
  const tertiary = baseline[2];
  
  // Dominance amplitude
  const dominance_score = primary.score;
  const gap_to_secondary = (primary.score - (secondary?.score || 0));
  const gap_to_average = primary.score - (baseline.reduce((s, d) => s + d.score, 0) / baseline.length);
  
  // Is dominance clear or contested?
  const dominance_clarity = gap_to_secondary > 0.5 ? 'clear' : gap_to_secondary > 0.2 ? 'moderate' : 'contested';
  
  // Does written evidence support baseline ordering?
  const written_alignment = checkWrittenAlignment(primary.dimension, evidence.written_signals);
  
  // Do contradictions reduce dominance perception?
  const contradiction_count = Object.values(evidence.contradictions || {}).length;
  const contradiction_dampening = Math.min(contradiction_count * 0.05, 0.3);
  
  // Do pressure patterns reveal true dominance?
  const pressure_harmony = checkPressureHarmony(primary.dimension, evidence.stress_patterns);
  
  return {
    primary_dimension: primary.dimension,
    primary_score: primary.score,
    secondary_dimension: secondary?.dimension,
    secondary_score: secondary?.score || 0,
    dominance_score: dominance_score,
    gap_to_secondary: gap_to_secondary,
    gap_to_average: gap_to_average,
    dominance_clarity: dominance_clarity,
    written_alignment: written_alignment,
    contradiction_dampening: contradiction_dampening,
    pressure_harmony: pressure_harmony,
    final_dominance_amplitude: Math.max(primary.score + (pressure_harmony * 0.15), primary.score)
  };
}

/**
 * Check if written signals align with primary dimension
 */
function checkWrittenAlignment(primary_dimension, written_signals) {
  const dimension_signal_map = {
    vector: written_signals.directiveness_words,
    horizon: written_signals.relational_words,
    velocity: written_signals.momentum_words,
    leverage: written_signals.directiveness_words,
    signal: written_signals.precision_words,
    fidelity: written_signals.precision_words,
    flex: written_signals.relational_words,
    framework: written_signals.precision_words
  };
  
  const signal_count = dimension_signal_map[primary_dimension] || 0;
  const alignment_strength = Math.min(signal_count / 5, 1.0); // 0-1 scale
  
  return alignment_strength;
}

/**
 * Check if pressure patterns harmonize with primary dimension
 */
function checkPressureHarmony(primary_dimension, stress_patterns) {
  if (!stress_patterns || typeof stress_patterns !== 'object') return 0;
  
  const harmony_patterns = {
    vector: ['increases_directiveness', 'accelerates_pace', 'doubles_down'],
    horizon: ['withdraws', 'seeks_input', 'pauses'],
    velocity: ['accelerates', 'cuts_corners', 'increases_pace'],
    signal: ['becomes_cautious', 'slows_down', 'increases_analysis'],
    fidelity: ['increases_precision', 'slows_down', 'seeks_perfection'],
    flex: ['withdraws', 'adapts', 'becomes_passive'],
    framework: ['systematizes', 'structures_more', 'increases_control'],
    leverage: ['focuses_more', 'increases_direction', 'becomes_more_decisive']
  };
  
  const expected_patterns = harmony_patterns[primary_dimension] || [];
  let harmony_count = 0;
  
  Object.entries(stress_patterns).forEach(([pattern, value]) => {
    if (expected_patterns.includes(pattern) && value) harmony_count++;
  });
  
  return harmony_count > 0 ? 0.2 : 0;
}

/**
 * Calculate rescored dimensions with dominance amplification
 */
function calculateRescoredDimensions(baseline, dominance, evidence) {
  return baseline.map((dim, idx) => {
    let rescored_score = dim.score;
    
    // If this is the primary dimension, potentially amplify
    if (idx === 0 && dominance.dominance_clarity === 'clear') {
      // Amplify if dominance is clear and supports actual behavior
      const amplification = dominance.written_alignment * 0.15 + dominance.pressure_harmony * 0.1;
      rescored_score = Math.min(rescored_score + amplification, 10); // Cap at 10
    }
    
    // If this is secondary and far from primary, potentially reduce
    if (idx === 1 && dominance.gap_to_secondary > 0.5) {
      // Make distance clearer (but only if primary is truly dominant)
      const reduction = Math.abs(dominance.gap_to_secondary) * 0.1;
      rescored_score = Math.max(rescored_score - reduction, -10); // Floor at -10
    }
    
    // If profile is flat (low variance), keep it flatter
    const baseline_variance = calculateVariance(baseline);
    if (baseline_variance < 0.5 && idx > 0) {
      // Compress secondary dimensions more (they're already close)
      rescored_score *= 0.95;
    }
    
    // Contradiction dampening (if written evidence contradicts score)
    if (dominance.contradiction_dampening > 0 && idx < 2) {
      rescored_score *= (1 - dominance.contradiction_dampening * 0.5);
    }

    return {
      dimension: dim.dimension,
      baseline_score: dim.score,
      rescored_score: Math.round(rescored_score * 100) / 100, // 2 decimals
      rank: idx + 1,
      delta: Math.round((rescored_score - dim.score) * 100) / 100,
      confidence: calculateConfidence(dim.dimension, evidence)
    };
  });
}

/**
 * Calculate confidence in rescored dimension
 */
function calculateConfidence(dimension, evidence) {
  let confidence = 0.8; // Base

  // Higher if written signals align
  const written_signals = evidence.written_signals || {};
  const signal_strength = checkWrittenAlignment(dimension, written_signals);
  confidence += signal_strength * 0.1;

  // Lower if contradictions exist for this dimension
  const contradictions = evidence.dimension_contradictions || {};
  if (contradictions[dimension]) confidence -= 0.1;

  return Math.min(Math.max(confidence, 0.5), 1.0);
}

/**
 * Analyze spread characteristics
 */
function analyzeSpread(rescored) {
  if (!rescored || rescored.length < 2) {
    return { flatness_score: 0, polarization_score: 0, dominance_gap: 0, balanced_vs_extreme: 'balanced' };
  }

  const scores = rescored.map(d => d.rescored_score);
  const highest = Math.max(...scores);
  const lowest = Math.min(...scores);
  const average = scores.reduce((s, v) => s + v, 0) / scores.length;
  
  const total_spread = highest - lowest;
  const variance = calculateVariance(scores);
  
  // Flatness: how close are all scores? (0=flat, 1=extreme)
  const flatness_score = 1 - Math.min(variance / 2, 1);
  
  // Polarization: do scores cluster at extremes?
  const extreme_count = scores.filter(s => Math.abs(s) > 0.5).length;
  const polarization_score = extreme_count / scores.length;
  
  // Dominance gap
  const dominance_gap = highest - (scores[1] || 0);
  
  // Classification
  let balanced_vs_extreme = 'balanced';
  if (total_spread > 1.5) balanced_vs_extreme = 'extreme';
  if (total_spread < 0.5) balanced_vs_extreme = 'flat';
  
  return {
    flatness_score: Math.round(flatness_score * 100) / 100,
    polarization_score: Math.round(polarization_score * 100) / 100,
    dominance_gap: Math.round(dominance_gap * 100) / 100,
    total_spread: Math.round(total_spread * 100) / 100,
    variance: Math.round(variance * 100) / 100,
    balanced_vs_extreme: balanced_vs_extreme
  };
}

/**
 * Calculate dominance gravity (which dimension drives others)
 */
function calculateGravity(rescored, dominance, evidence) {
  const primary = rescored[0];
  
  // Which other dimensions move with primary?
  const downstream_influence = [];
  
  // If vector is dominant, horizon/leverage typically follow
  if (primary.dimension === 'vector') {
    const horizon_dim = rescored.find(d => d.dimension === 'horizon');
    const leverage_dim = rescored.find(d => d.dimension === 'leverage');
    if (horizon_dim) downstream_influence.push({ dimension: 'horizon', correlation: 0.65 });
    if (leverage_dim) downstream_influence.push({ dimension: 'leverage', correlation: 0.72 });
  }
  
  // If signal is dominant, fidelity/framework typically follow
  if (primary.dimension === 'signal') {
    const fidelity_dim = rescored.find(d => d.dimension === 'fidelity');
    const framework_dim = rescored.find(d => d.dimension === 'framework');
    if (fidelity_dim) downstream_influence.push({ dimension: 'fidelity', correlation: 0.68 });
    if (framework_dim) downstream_influence.push({ dimension: 'framework', correlation: 0.55 });
  }
  
  // If velocity is dominant, flex typically follows
  if (primary.dimension === 'velocity') {
    const flex_dim = rescored.find(d => d.dimension === 'flex');
    if (flex_dim) downstream_influence.push({ dimension: 'flex', correlation: 0.75 });
  }
  
  return {
    strongest_system: primary.dimension,
    gravity_strength: Math.round(Math.abs(primary.rescored_score) * 100) / 100,
    downstream_influence: downstream_influence,
    drives_entire_profile: primary.rescored_score > 0.7
  };
}

/**
 * Analyze tension pairs
 */
function analyzeTensionPairs(rescored) {
  const scoreMap = {};
  rescored.forEach(d => { scoreMap[d.dimension] = d.rescored_score; });
  
  // Calculate tension (delta) for key pairs
  const tension_pairs = {
    velocity_vs_fidelity: Math.round((scoreMap.velocity - scoreMap.fidelity) * 100) / 100,
    vector_vs_signal: Math.round((scoreMap.vector - scoreMap.signal) * 100) / 100,
    horizon_vs_flex: Math.round((scoreMap.horizon - scoreMap.flex) * 100) / 100,
    leverage_vs_flex: Math.round((scoreMap.leverage - scoreMap.flex) * 100) / 100
  };
  
  return tension_pairs;
}

/**
 * Calculate amplitude metrics
 */
function calculateAmplitudeMetrics(rescored) {
  const scores = rescored.map(d => d.rescored_score);
  const highest = Math.max(...scores);
  const lowest = Math.min(...scores);
  
  return {
    highest_score: Math.round(highest * 100) / 100,
    lowest_score: Math.round(lowest * 100) / 100,
    total_spread: Math.round((highest - lowest) * 100) / 100,
    score_variance: Math.round(calculateVariance(scores) * 100) / 100
  };
}

/**
 * Helper: Calculate variance
 */
function calculateVariance(scores) {
  if (!scores || scores.length === 0) return 0;
  const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
  return scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scores.length;
}

/**
 * Assemble final rescoring_v1 object
 */
function assembleRescoring(rescored, dominance, spread, gravity, tensions, amplitude) {
  return {
    version: 'v1',
    generated_at: new Date().toISOString(),
    generation_source: 'rescoring_engine_v1',
    
    ranked_dimensions: rescored.map((d, idx) => ({
      dimension: d.dimension,
      score: d.rescored_score,
      baseline_score: d.baseline_score,
      delta: d.delta,
      rank: idx + 1,
      confidence: d.confidence
    })),
    
    dominance_profile: {
      primary_dimension: dominance.primary_dimension,
      secondary_dimension: dominance.secondary_dimension,
      dominance_amplitude: Math.round(dominance.final_dominance_amplitude * 100) / 100,
      spread_type: spread.balanced_vs_extreme,
      profile_intensity: dominance.gap_to_average > 0.5 ? 'high' : dominance.gap_to_average > 0 ? 'medium' : 'low'
    },
    
    spread_profile: spread,
    
    tension_pairs: tensions,
    
    dominance_gravity: gravity,
    
    amplitude_metrics: amplitude,
    
    render_ready: {
      dna_summary: null, // Will be built by renderer
      command_clarity: rescored[0]?.rescored_score || 0,
      speed_vs_fidelity: tensions.velocity_vs_fidelity,
      strategic_leverage: rescored.find(d => d.dimension === 'leverage')?.rescored_score || 0
    },
    
    metadata: {
      baseline_hash: hashDimensions(rescored),
      rescoring_timestamp: new Date().toISOString(),
      rescoring_engine_version: 'v1.0.0',
      input_canonical_keys: '(full canonical)'
    }
  };
}

/**
 * Helper: Simple hash for dimensions
 */
function hashDimensions(dimensions) {
  if (!dimensions || dimensions.length === 0) return 'empty';
  const scores = dimensions.map(d => String(d.baseline_score)).join(':');
  return scores.substring(0, 16);
}

/**
 * Return empty rescoring if no baseline
 */
function getEmptyRescoring() {
  return {
    version: 'v1',
    generated_at: new Date().toISOString(),
    generation_source: null,
    ranked_dimensions: [],
    dominance_profile: {
      primary_dimension: null,
      secondary_dimension: null,
      dominance_amplitude: 0,
      spread_type: null,
      profile_intensity: null
    },
    spread_profile: {
      flatness_score: 0,
      polarization_score: 0,
      dominance_gap: 0,
      total_spread: 0,
      variance: 0,
      balanced_vs_extreme: 'balanced'
    },
    tension_pairs: {
      velocity_vs_fidelity: 0,
      vector_vs_signal: 0,
      horizon_vs_flex: 0,
      leverage_vs_flex: 0
    },
    dominance_gravity: {
      strongest_system: null,
      gravity_strength: 0,
      downstream_influence: [],
      drives_entire_profile: false
    },
    amplitude_metrics: {
      highest_score: 0,
      lowest_score: 0,
      total_spread: 0,
      score_variance: 0
    },
    render_ready: {
      dna_summary: null,
      command_clarity: 0,
      speed_vs_fidelity: 0,
      strategic_leverage: 0
    },
    metadata: {
      baseline_hash: null,
      rescoring_timestamp: new Date().toISOString(),
      rescoring_engine_version: 'v1.0.0',
      input_canonical_keys: null
    }
  };
}
