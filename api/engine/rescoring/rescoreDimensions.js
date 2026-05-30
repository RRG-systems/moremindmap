/**
 * rescoreDimensions.js - PHASE 2: THRESHOLD + DOMINANCE REFINEMENT
 * 
 * RESCORING ENGINE: Psychologically Believable Dominance Topology
 * 
 * Reads ENTIRE canonical dossier to infer behavioral dominance with:
 * - Threshold-aware gravity (near-threshold systems feel disproportionately influential)
 * - Compensatory suppression (strong systems suppress weak ones behaviorally)
 * - Flatness detection refinement (blended operators remain balanced)
 * - Tension amplification (dimension relationships reshape topology)
 * - Extremity differentiation (spread + intensity matter as much as order)
 * - Render-ready intelligence (prepare meaningful override values)
 * 
 * Core principle:
 * Humans are hierarchical. One or two systems dominate. The profile should FEEL that dominance.
 * Without fake drama. Without cartoon extremity. Without horoscope nonsense.
 */

/**
 * Main rescoring entry point - PHASE 2
 * 
 * @param {Object} canonical - Complete canonical dossier
 * @returns {Object} rescoring_v1 object with threshold-refined dominance topology
 */
export function rescoreDimensions(canonical) {
  if (!canonical || !canonical.ranked_dimensions) {
    return getEmptyRescoring();
  }

  const baseline = normalizeBaselineEvidence(canonical.ranked_dimensions || []);
  
  // Step 1: Extract evidence from entire canonical
  const evidence = extractEvidence(canonical);
  
  // Step 2: Classify profile flatness/dominance confidence
  const profileShape = classifyProfileShape(baseline);
  
  // Step 3: Detect dominance patterns with threshold awareness
  const dominance = detectDominanceWithThreshold(baseline, evidence, profileShape);
  
  // Step 4: Calculate compensatory suppression effects
  const suppressionMap = calculateSuppressionEffects(baseline, dominance);
  
  // Step 5: Calculate rescored dimensions (threshold-aware)
  const rescored = calculateRescoredDimensionsV2(baseline, dominance, suppressionMap, evidence, profileShape);
  
  // Step 6: Analyze spread characteristics with tension sensitivity
  const spread = analyzeSpreadV2(rescored, dominance);
  
  // Step 7: Calculate tension-aware gravity
  const gravity = calculateGravityV2(rescored, dominance, suppressionMap);
  
  // Step 8: Analyze tension pairs with dominance context
  const tensions = analyzeTensionPairsV2(rescored, dominance, suppressionMap);
  
  // Step 9: Calculate amplitude metrics
  const amplitude = calculateAmplitudeMetrics(rescored);
  
  // Step 10: Build render-ready intelligence
  const renderReady = buildRenderReadyV2(rescored, dominance, tensions, suppressionMap);
  
  // Step 11: Assemble final rescoring_v1 structure
  return assembleRescoringV2(rescored, dominance, spread, gravity, tensions, amplitude, renderReady, profileShape);
}

/**
 * PHASE 2 NEW: Classify profile shape (flat vs concentrated vs extreme)
 */
function classifyProfileShape(baseline) {
  if (!baseline || baseline.length < 2) {
    return { shape: 'unknown', flatness: 0, concentration: 0, confidence: 0 };
  }

  const scores = baseline.map(d => d.score);
  const sorted = [...scores].sort((a, b) => b - a);
  
  const highest = sorted[0];
  const secondHighest = sorted[1];
  const lowestAbsScore = Math.min(...scores.map(s => Math.abs(s)));
  
  const spread = highest - Math.min(...scores);
  const variance = calculateVariance(scores);
  const topTwoGap = highest - secondHighest;
  
  // Flatness: how compressed is the profile?
  const flatness = 1 - Math.min(variance / 2.5, 1);
  
  // Concentration: how much does top dimension dominate?
  const concentration = topTwoGap > 0.5 ? Math.min(topTwoGap / 2, 1) : 0;
  
  // Determine shape type
  let shape = 'balanced';
  let confidence = 0.7;
  
  if (flatness > 0.7) {
    shape = 'flat';
    confidence = Math.min(flatness + 0.1, 0.95);
  } else if (topTwoGap > 0.8 && spread > 1.2) {
    shape = 'extreme_concentrated';
    confidence = 0.9;
  } else if (topTwoGap > 0.5) {
    shape = 'concentrated';
    confidence = 0.85;
  } else if (topTwoGap > 0.2) {
    shape = 'moderate_dominance';
    confidence = 0.75;
  }
  
  return {
    shape,
    flatness,
    concentration,
    spread,
    variance,
    topTwoGap,
    confidence
  };
}

/**
 * Extract all evidence from canonical (unchanged from V1, for reference)
 */
function extractEvidence(canonical) {
  return {
    baseline_scores: canonical.ranked_dimensions || [],
    intake_answers: canonical.intake_answers || {},
    contradictions: canonical.contradictions || {},
    dimension_contradictions: canonical.dimension_contradictions || {},
    stress_patterns: canonical.stress_patterns || {},
    hidden_costs: canonical.hidden_costs || {},
    inferred_patterns: canonical.inferred_patterns || {},
    communication_style: canonical.communication_style || {},
    life_direction: canonical.life_direction || {},
    business_operating_reality: canonical.business_operating_reality || {},
    written_signals: extractWrittenSignals(canonical.intake_answers || {}),
    top_systems: canonical.top_systems || {},
    vector_scores: canonical.vector_scores || {}
  };
}

/**
 * Prevent missing-evidence placeholders from becoming behavioral dominance.
 */
function normalizeBaselineEvidence(dimensions) {
  return (dimensions || [])
    .map((dim) => {
      const evidenceCount = dim.evidence_count ?? dim.contributing_answer_count ?? dim.contributing_answers?.length ?? null;
      const hasZeroEvidence = evidenceCount === 0;
      const score = hasZeroEvidence ? 0 : (dim.score ?? 0);
      return {
        ...dim,
        score,
        evidence_count: evidenceCount ?? dim.evidence_count,
        contributing_answer_count: evidenceCount ?? dim.contributing_answer_count
      };
    })
    .sort((a, b) => {
      const aEvidence = a.evidence_count ?? a.contributing_answer_count;
      const bEvidence = b.evidence_count ?? b.contributing_answer_count;
      if (aEvidence === 0 && bEvidence > 0) return 1;
      if (bEvidence === 0 && aEvidence > 0) return -1;
      return (b.score ?? 0) - (a.score ?? 0);
    })
    .map((dim, index) => ({
      ...dim,
      rank: index + 1
    }));
}

/**
 * Extract written signals (unchanged from V1)
 */
function extractWrittenSignals(answers) {
  const signals = {
    directiveness_words: 0,
    precision_words: 0,
    momentum_words: 0,
    relational_words: 0,
    contradiction_count: 0
  };

  const writtenQuestions = [2, 14, 17, 20, 22, 24, 25, 26, 27, 28];
  
  writtenQuestions.forEach(q => {
    const answer = answers[`Q${q}`] || answers[`q${q}`] || '';
    if (!answer) return;
    
    const text = String(
      typeof answer === 'object'
        ? answer.answer_text || answer.text || answer.value || ''
        : answer
    ).toLowerCase();
    if (/move|go|now|decide|act|push|drive|command/i.test(text)) signals.directiveness_words++;
    if (/precise|exact|right|careful|detail|check|verify|consider/i.test(text)) signals.precision_words++;
    if (/fast|quick|speed|energy|momentum|pace|accelerate/i.test(text)) signals.momentum_words++;
    if (/people|team|together|collaborate|listen|understand|empathy/i.test(text)) signals.relational_words++;
    if (/but|however|though|yet|conflict|tension|struggle/i.test(text)) signals.contradiction_count++;
  });

  return signals;
}

/**
 * PHASE 2: Detect dominance with threshold awareness
 */
function detectDominanceWithThreshold(baseline, evidence, profileShape) {
  if (!baseline || baseline.length === 0) {
    return { primary_dimension: null, dominance_score: 0, patterns: {}, threshold_band: 'none' };
  }

  const primary = baseline[0];
  const secondary = baseline[1];
  
  const gap_to_secondary = (primary.score - (secondary?.score || 0));
  const gap_to_average = primary.score - (baseline.reduce((s, d) => s + d.score, 0) / baseline.length);
  
  // THRESHOLD ANALYSIS: Which band is the dominant system in?
  const dominance_score = primary.score;
  let threshold_band = 'moderate';
  let threshold_weight = 1.0;
  
  if (dominance_score > 0.85) {
    threshold_band = 'extreme';
    threshold_weight = 1.4; // Extreme systems disproportionately influence
  } else if (dominance_score > 0.60) {
    threshold_band = 'strong';
    threshold_weight = 1.2;
  } else if (dominance_score > 0.30) {
    threshold_band = 'moderate';
    threshold_weight = 1.0;
  } else {
    threshold_band = 'mild';
    threshold_weight = 0.7;
  }
  
  // Dominance clarity (how clear is the hierarchy?)
  const dominance_clarity = gap_to_secondary > 0.5 ? 'clear' : gap_to_secondary > 0.2 ? 'moderate' : 'contested';
  
  // Written alignment
  const written_alignment = checkWrittenAlignment(primary.dimension, evidence.written_signals);
  
  // Contradiction dampening (but less so for extreme systems)
  const contradiction_count = Object.values(evidence.contradictions || {}).length;
  const contradiction_dampening = Math.min(contradiction_count * 0.05 * (threshold_band === 'extreme' ? 0.5 : 1.0), 0.2);
  
  // Pressure harmony
  const pressure_harmony = checkPressureHarmony(primary.dimension, evidence.stress_patterns);
  
  // Profile shape awareness (flat profiles = lower confidence in dominance)
  const shape_adjustment = profileShape.shape === 'flat' ? 0.5 : 1.0;
  
  return {
    primary_dimension: primary.dimension,
    primary_score: primary.score,
    secondary_dimension: secondary?.dimension,
    secondary_score: secondary?.score || 0,
    dominance_score: dominance_score,
    gap_to_secondary: gap_to_secondary,
    gap_to_average: gap_to_average,
    dominance_clarity: dominance_clarity,
    threshold_band: threshold_band,
    threshold_weight: threshold_weight,
    written_alignment: written_alignment,
    contradiction_dampening: contradiction_dampening,
    pressure_harmony: pressure_harmony,
    shape_adjustment: shape_adjustment,
    final_dominance_amplitude: Math.max(
      primary.score + (pressure_harmony * 0.15) * threshold_weight,
      primary.score
    )
  };
}

/**
 * PHASE 2 NEW: Calculate compensatory suppression effects
 * 
 * Strong systems suppress weak ones (behavioral suppression, not absolute)
 */
function calculateSuppressionEffects(baseline, dominance) {
  const suppressionMap = {};
  
  // Define suppression relationships
  const suppressionRules = {
    vector: ['signal', 'flex'],        // High vector suppresses precision + adaptation
    horizon: ['velocity', 'leverage'], // High horizon suppresses speed + focus
    velocity: ['fidelity', 'signal'],  // High velocity suppresses precision
    signal: ['flex', 'horizon'],       // High signal suppresses adaptation
    fidelity: ['vector', 'flex'],      // High fidelity suppresses directiveness + adaptation
    leverage: ['flex', 'horizon'],     // High leverage suppresses adaptation + relationships
    flex: [],                          // Flex doesn't suppress (absorbs)
    framework: ['velocity']            // Framework suppresses speed
  };
  
  const primary = baseline[0];
  const primaryScore = primary.score;
  
  // How strong is the suppression?
  let suppressionStrength = 0;
  if (primaryScore > 0.85) suppressionStrength = 0.25; // Extreme = 25% suppression
  else if (primaryScore > 0.60) suppressionStrength = 0.15; // Strong = 15% suppression
  else if (primaryScore > 0.30) suppressionStrength = 0.05; // Moderate = 5% suppression
  
  const suppressed = suppressionRules[primary.dimension] || [];
  
  suppressed.forEach(dim => {
    suppressionMap[dim] = {
      suppressed_by: primary.dimension,
      suppression_strength: suppressionStrength,
      suppressed_score_delta: 0 // Will be calculated per dimension
    };
  });
  
  return suppressionMap;
}

/**
 * PHASE 2: Calculate rescored dimensions with threshold + suppression
 */
function calculateRescoredDimensionsV2(baseline, dominance, suppressionMap, evidence, profileShape) {
  return baseline.map((dim, idx) => {
    let rescored_score = dim.score;
    
    // THRESHOLD AMPLIFICATION: Dominant systems get stronger based on threshold
    if (idx === 0 && dominance.dominance_clarity === 'clear') {
      const amplification = (
        dominance.written_alignment * 0.12 +
        dominance.pressure_harmony * 0.10
      ) * dominance.threshold_weight;
      
      rescored_score = Math.min(rescored_score + amplification, 10);
    }
    
    // SECONDARY REDUCTION: Clarify the gap (but respect flat profiles)
    if (idx === 1 && dominance.gap_to_secondary > 0.5 && profileShape.shape !== 'flat') {
      const reduction = Math.abs(dominance.gap_to_secondary) * 0.12;
      rescored_score = Math.max(rescored_score - reduction, -10);
    }
    
    // COMPENSATORY SUPPRESSION: Apply behavioral suppression
    if (suppressionMap[dim.dimension]) {
      const suppression = suppressionMap[dim.dimension];
      suppressionMap[dim.dimension].suppressed_score_delta = -suppression.suppression_strength * 0.5;
      rescored_score = rescored_score + suppressionMap[dim.dimension].suppressed_score_delta;
    }
    
    // FLAT PROFILE PRESERVATION: Keep flat profiles flatter
    if (profileShape.shape === 'flat' && idx > 0) {
      // Compress secondary dimensions more
      rescored_score *= 0.97;
    }
    
    // CONTRADICTION DAMPENING: Less for extreme systems
    if (dominance.contradiction_dampening > 0 && idx < 2) {
      rescored_score *= (1 - dominance.contradiction_dampening * 0.3);
    }
    
    // TENSION SENSITIVITY: Amplify conflicting dimension pairs
    const tensions = getConflictingTensions(dim.dimension, baseline);
    if (tensions && tensions.amplify) {
      rescored_score = rescored_score * (1 + tensions.amplification_factor);
    }
    
    return {
      dimension: dim.dimension,
      baseline_score: dim.score,
      evidence_count: dim.evidence_count ?? dim.contributing_answer_count ?? null,
      contributing_answer_count: dim.contributing_answer_count ?? dim.evidence_count ?? null,
      rescored_score: Math.round(rescored_score * 100) / 100,
      rank: idx + 1,
      delta: Math.round((rescored_score - dim.score) * 100) / 100,
      confidence: calculateConfidenceV2(dim.dimension, evidence, dominance, profileShape)
    };
  });
}

/**
 * PHASE 2 NEW: Identify tension-sensitive dimension pairs
 */
function getConflictingTensions(dimension, baseline) {
  const scoreMap = {};
  baseline.forEach(d => { scoreMap[d.dimension] = d.score; });
  
  const tensions = {
    vector: {
      opponent: 'signal',
      amplify: scoreMap.vector > 0.6 && scoreMap.signal < 0.3,
      amplification_factor: 0.08
    },
    velocity: {
      opponent: 'fidelity',
      amplify: scoreMap.velocity > 0.6 && scoreMap.fidelity < 0.2,
      amplification_factor: 0.10
    },
    horizon: {
      opponent: 'flex',
      amplify: scoreMap.horizon > 0.5 && scoreMap.flex < 0.2,
      amplification_factor: 0.07
    },
    leverage: {
      opponent: 'framework',
      amplify: scoreMap.leverage > 0.6 && scoreMap.framework < 0.1,
      amplification_factor: 0.08
    }
  };
  
  return tensions[dimension] || null;
}

/**
 * PHASE 2: Calculate confidence with profile shape awareness
 */
function calculateConfidenceV2(dimension, evidence, dominance, profileShape) {
  const baselineDimension = (evidence.baseline_scores || []).find(d => d.dimension === dimension);
  const evidenceCount = baselineDimension?.evidence_count ?? baselineDimension?.contributing_answer_count;
  if (evidenceCount === 0) return 0.2;

  let confidence = 0.75;
  
  // Flat profiles: lower confidence in any rescoring
  if (profileShape.shape === 'flat') confidence -= 0.15;
  
  // Written signals alignment
  const written_signals = evidence.written_signals || {};
  const signal_strength = checkWrittenAlignment(dimension, written_signals);
  confidence += signal_strength * 0.12;
  
  // Contradictions reduce confidence
  const contradictions = evidence.dimension_contradictions || {};
  if (contradictions[dimension]) confidence -= 0.12;
  
  // Extreme systems get higher confidence
  if (dominance.threshold_band === 'extreme') confidence += 0.05;
  
  return Math.min(Math.max(confidence, 0.45), 1.0);
}

/**
 * Check written alignment (unchanged from V1)
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
  return Math.min(signal_count / 5, 1.0);
}

/**
 * Check pressure harmony (unchanged from V1)
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
 * PHASE 2: Analyze spread with tension sensitivity
 */
function analyzeSpreadV2(rescored, dominance) {
  if (!rescored || rescored.length < 2) {
    return {
      flatness_score: 0,
      polarization_score: 0,
      dominance_gap: 0,
      total_spread: 0,
      variance: 0,
      balanced_vs_extreme: 'balanced',
      tension_distribution: 'balanced'
    };
  }

  const scores = rescored.map(d => d.rescored_score);
  const highest = Math.max(...scores);
  const lowest = Math.min(...scores);
  const average = scores.reduce((s, v) => s + v, 0) / scores.length;
  
  const total_spread = highest - lowest;
  const variance = calculateVariance(scores);
  
  // Flatness
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
  
  // PHASE 2: Tension distribution (how evenly are tensions spread?)
  const positive_count = scores.filter(s => s > 0.3).length;
  const negative_count = scores.filter(s => s < -0.3).length;
  const tension_distribution = (positive_count > 5 || negative_count > 2) ? 'tensioned' : 'balanced';
  
  return {
    flatness_score: Math.round(flatness_score * 100) / 100,
    polarization_score: Math.round(polarization_score * 100) / 100,
    dominance_gap: Math.round(dominance_gap * 100) / 100,
    total_spread: Math.round(total_spread * 100) / 100,
    variance: Math.round(variance * 100) / 100,
    balanced_vs_extreme: balanced_vs_extreme,
    tension_distribution: tension_distribution
  };
}

/**
 * PHASE 2: Calculate gravity with suppression context
 */
function calculateGravityV2(rescored, dominance, suppressionMap) {
  const primary = rescored[0];
  const downstream_influence = [];
  
  // Define influence patterns with suppression awareness
  if (primary.dimension === 'vector') {
    const horizon_dim = rescored.find(d => d.dimension === 'horizon');
    const leverage_dim = rescored.find(d => d.dimension === 'leverage');
    if (horizon_dim) downstream_influence.push({
      dimension: 'horizon',
      correlation: 0.65,
      influenced_by_suppression: !!suppressionMap['horizon']
    });
    if (leverage_dim) downstream_influence.push({
      dimension: 'leverage',
      correlation: 0.72,
      influenced_by_suppression: !!suppressionMap['leverage']
    });
  }
  
  if (primary.dimension === 'signal') {
    const fidelity_dim = rescored.find(d => d.dimension === 'fidelity');
    const framework_dim = rescored.find(d => d.dimension === 'framework');
    if (fidelity_dim) downstream_influence.push({
      dimension: 'fidelity',
      correlation: 0.68,
      influenced_by_suppression: !!suppressionMap['fidelity']
    });
    if (framework_dim) downstream_influence.push({
      dimension: 'framework',
      correlation: 0.55,
      influenced_by_suppression: !!suppressionMap['framework']
    });
  }
  
  if (primary.dimension === 'velocity') {
    const flex_dim = rescored.find(d => d.dimension === 'flex');
    if (flex_dim) downstream_influence.push({
      dimension: 'flex',
      correlation: 0.75,
      influenced_by_suppression: !!suppressionMap['flex']
    });
  }
  
  return {
    strongest_system: primary.dimension,
    gravity_strength: Math.round(Math.abs(primary.rescored_score) * 100) / 100,
    downstream_influence: downstream_influence,
    drives_entire_profile: primary.rescored_score > 0.7,
    suppression_effects_active: Object.keys(suppressionMap).length > 0
  };
}

/**
 * PHASE 2: Analyze tensions with dominance context
 */
function analyzeTensionPairsV2(rescored, dominance, suppressionMap) {
  const scoreMap = {};
  rescored.forEach(d => { scoreMap[d.dimension] = d.rescored_score; });
  
  const tension_pairs = {
    velocity_vs_fidelity: Math.round((scoreMap.velocity - scoreMap.fidelity) * 100) / 100,
    vector_vs_signal: Math.round((scoreMap.vector - scoreMap.signal) * 100) / 100,
    horizon_vs_flex: Math.round((scoreMap.horizon - scoreMap.flex) * 100) / 100,
    leverage_vs_flex: Math.round((scoreMap.leverage - scoreMap.flex) * 100) / 100
  };
  
  // Mark which tensions are active (>0.4 delta)
  const active_tensions = Object.entries(tension_pairs)
    .filter(([_, delta]) => Math.abs(delta) > 0.4)
    .map(([name, _]) => name);
  
  return {
    ...tension_pairs,
    active_tensions: active_tensions,
    tension_count: active_tensions.length
  };
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
 * PHASE 2 NEW: Build render-ready intelligence
 */
function buildRenderReadyV2(rescored, dominance, tensions, suppressionMap) {
  const scoreMap = {};
  rescored.forEach(d => { scoreMap[d.dimension] = d.rescored_score; });
  
  // Command clarity: primary dimension score
  const command_clarity = rescored[0]?.rescored_score || 0;
  
  // Speed vs fidelity: velocity - fidelity
  const speed_vs_fidelity = tensions.velocity_vs_fidelity || 0;
  
  // Strategic leverage: leverage dimension score
  const strategic_leverage = scoreMap.leverage || 0;
  
  // DNA summary will be generated by renderer, but we can prepare dominance-aware summary
  // This would be expanded in Phase 3
  
  return {
    dna_summary: null, // Generated by renderer
    command_clarity: Math.round(command_clarity * 100) / 100,
    speed_vs_fidelity: Math.round(speed_vs_fidelity * 100) / 100,
    strategic_leverage: Math.round(strategic_leverage * 100) / 100,
    dominance_flavor: dominance.threshold_band,
    active_suppression: Object.keys(suppressionMap).length > 0,
    profile_intensity: determinateIntensity(dominance, rescored)
  };
}

/**
 * Determine profile intensity level
 */
function determinateIntensity(dominance, rescored) {
  const spread = Math.max(...rescored.map(d => d.rescored_score)) - Math.min(...rescored.map(d => d.rescored_score));
  
  if (dominance.threshold_band === 'extreme' && spread > 1.2) return 'extreme';
  if (dominance.threshold_band === 'strong' && spread > 0.8) return 'high';
  if (dominance.gap_to_average > 0.5) return 'high';
  if (dominance.gap_to_average > 0) return 'medium';
  return 'low';
}

/**
 * Calculate variance (unchanged)
 */
function calculateVariance(scores) {
  if (!scores || scores.length === 0) return 0;
  const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
  return scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scores.length;
}

/**
 * Assemble final rescoring_v1 object - PHASE 2
 */
function assembleRescoringV2(rescored, dominance, spread, gravity, tensions, amplitude, renderReady, profileShape) {
  return {
    version: 'v2',
    phase: 'threshold_dominance_refinement',
    generated_at: new Date().toISOString(),
    generation_source: 'rescoring_engine_v2',
    
    ranked_dimensions: rescored.map((d, idx) => ({
      dimension: d.dimension,
      score: d.rescored_score,
      baseline_score: d.baseline_score,
      evidence_count: d.evidence_count,
      contributing_answer_count: d.contributing_answer_count,
      delta: d.delta,
      rank: idx + 1,
      confidence: d.confidence
    })),
    
    dominance_profile: {
      primary_dimension: dominance.primary_dimension,
      secondary_dimension: dominance.secondary_dimension,
      dominance_amplitude: Math.round(dominance.final_dominance_amplitude * 100) / 100,
      spread_type: spread.balanced_vs_extreme,
      profile_intensity: renderReady.profile_intensity,
      threshold_band: dominance.threshold_band,
      threshold_weight: Math.round(dominance.threshold_weight * 100) / 100
    },
    
    spread_profile: {
      ...spread,
      profile_shape: profileShape.shape,
      profile_shape_confidence: Math.round(profileShape.confidence * 100) / 100
    },
    
    tension_pairs: tensions,
    
    dominance_gravity: gravity,
    
    amplitude_metrics: amplitude,
    
    render_ready: renderReady,
    
    metadata: {
      baseline_hash: hashDimensions(rescored),
      rescoring_timestamp: new Date().toISOString(),
      rescoring_engine_version: 'v2.0.0',
      input_canonical_keys: '(full canonical)',
      phase_features: [
        'threshold_gravity',
        'compensatory_suppression',
        'flatness_preservation',
        'tension_amplification',
        'extremity_differentiation',
        'render_ready_intelligence'
      ]
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
    version: 'v2',
    phase: 'threshold_dominance_refinement',
    generated_at: new Date().toISOString(),
    generation_source: null,
    ranked_dimensions: [],
    dominance_profile: {
      primary_dimension: null,
      secondary_dimension: null,
      dominance_amplitude: 0,
      spread_type: null,
      profile_intensity: null,
      threshold_band: 'none',
      threshold_weight: 1.0
    },
    spread_profile: {
      flatness_score: 0,
      polarization_score: 0,
      dominance_gap: 0,
      total_spread: 0,
      variance: 0,
      balanced_vs_extreme: 'balanced',
      tension_distribution: 'balanced',
      profile_shape: 'unknown',
      profile_shape_confidence: 0
    },
    tension_pairs: {
      velocity_vs_fidelity: 0,
      vector_vs_signal: 0,
      horizon_vs_flex: 0,
      leverage_vs_flex: 0,
      active_tensions: [],
      tension_count: 0
    },
    dominance_gravity: {
      strongest_system: null,
      gravity_strength: 0,
      downstream_influence: [],
      drives_entire_profile: false,
      suppression_effects_active: false
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
      strategic_leverage: 0,
      dominance_flavor: 'none',
      active_suppression: false,
      profile_intensity: 'low'
    },
    metadata: {
      baseline_hash: null,
      rescoring_timestamp: new Date().toISOString(),
      rescoring_engine_version: 'v2.0.0',
      input_canonical_keys: null,
      phase_features: []
    }
  };
}
