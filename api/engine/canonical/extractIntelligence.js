/**
 * extractIntelligence.js
 * 
 * Behavioral Intelligence Extraction Layer (Phase 3: Tiers 1-2 + Organizational Consequences)
 * Pure read-only transformation: canonical_profile_json → behavioral_intelligence_v1
 * 
 * CONSTRAINTS:
 * - Pure function (no mutations, no side effects)
 * - No GPT calls
 * - No rendering
 * - Uses entire dossier as evidence artifact
 * - Downstream only (does not modify canonical)
 * - Doctrine: describe consequences, not traits
 * - No motivational/therapy language
 * - All evidence grounded in canonical fields
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
      
      // Tier 1-2 extractions + organizational consequences
      domains: {
        operatingSystem: extractOperatingSystem(canonical),
        worldExperience: extractWorldExperience(canonical),
        othersExperience: extractOthersExperience(canonical),
        pressureMechanics: extractPressureMechanicsStarter(canonical),
        contradictions: extractContradictionsStarter(canonical),
        scalingConstraint: extractScalingConstraint(canonical),
        decisionArchitecture: extractDecisionArchitecture(canonical),
        organizationalConsequences: extractOrganizationalConsequences(canonical),
        facilitatorNotes: extractFacilitatorNotes(canonical),
        fiveFuturesStarter: extractFiveFuturesStarter(canonical),
        theOneMove: extractTheOneMove(canonical)
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
 * ENHANCED: Uses communication_style, leadership_architecture, stall_patterns, hidden_risk_patterns
 */
function extractOthersExperience(canonical) {
  const top_systems = canonical.top_systems || {};
  const vector_scores = canonical.vector_scores || {};
  const primary = top_systems.primary_driver || {};
  const communication_style = canonical.communication_style || {};
  const leadership_arch = canonical.leadership_architecture || {};
  const stall_patterns = canonical.stall_patterns || {};
  const hidden_risks = canonical.hidden_risk_patterns || {};
  
  const signal_score = vector_scores.signal || 0;
  const vector_score = vector_scores.vector || 0;
  const fidelity_score = vector_scores.fidelity || 0;
  const velocity_score = vector_scores.velocity || 0;
  const flex_score = vector_scores.flex || 0;

  // Extract communication evidence
  const message_structure = communication_style.message_structure || '';
  const directness = communication_style.directness || 'moderate';
  const emotional_calibration = communication_style.emotional_calibration || '';
  
  // Extract leadership evidence
  const team_experience = leadership_arch.team_experience || '';
  const primary_mode = leadership_arch.primary_mode || '';
  
  // Extract relational friction evidence
  const relational_frustration = stall_patterns.frustrations?.includes('relational');
  const relational_erosion_risk = hidden_risks.relational_erosion_risk || '';

  return {
    title: 'How Others Experience You',
    confidence: 'tier_3_medium',
    source_fields: [
      'primary_driver',
      'vector_scores',
      'communication_style',
      'leadership_architecture',
      'stall_patterns.frustrations',
      'hidden_risk_patterns.relational_erosion_risk'
    ],
    
    summary: buildOthersExperienceSummaryEnhanced(primary, communication_style, team_experience),
    
    first_impression: {
      primary_signal: primary.dimension || 'unknown',
      team_evidence: team_experience || null,
      interpretation: team_experience 
        ? `${team_experience}. ${buildFirstImpressionInterpretation(primary.dimension, vector_score, signal_score)}`
        : buildFirstImpressionInterpretation(primary.dimension, vector_score, signal_score)
    },
    
    communication_pattern: {
      structure: message_structure,
      directness: directness,
      emotional_calibration: emotional_calibration,
      fidelity_score: fidelity_score,
      velocity_score: velocity_score,
      interpretation: emotional_calibration
        ? `${message_structure}. ${emotional_calibration}`
        : buildCommunicationInterpretation(fidelity_score, velocity_score, directness)
    },
    
    listening_pattern: {
      signal_score: signal_score,
      vector_dominance: vector_score,
      under_pressure: relational_erosion_risk,
      interpretation: relational_erosion_risk
        ? `Normal state: ${buildListeningInterpretation(signal_score, vector_score)}. Under pressure: ${relational_erosion_risk}`
        : buildListeningInterpretation(signal_score, vector_score)
    },
    
    relational_friction: {
      friction_admitted: relational_frustration,
      erosion_risk: relational_erosion_risk,
      interpretation: relational_frustration && relational_erosion_risk
        ? `Relational friction acknowledged in stall patterns. Risk: ${relational_erosion_risk}`
        : relational_erosion_risk || 'Relational dynamics stable.'
    },
    
    key_signals: [
      message_structure ? `Structure: ${message_structure}` : `Communication: ${fidelity_score > velocity_score ? 'clarity' : 'brevity'}-oriented`,
      emotional_calibration ? `Calibration: ${emotional_calibration.substring(0, 50)}...` : `Directness: ${directness}`,
      relational_erosion_risk ? `Relational risk: ${relational_erosion_risk.substring(0, 60)}...` : `Listening: Signal ${signal_score.toFixed(1)} vs Vector ${vector_score.toFixed(1)}`,
      team_experience ? `Team sees: ${team_experience.substring(0, 50)}...` : `Primary mode: ${primary_mode || primary.dimension}`
    ],
    
    causal_interpretation: 'Operating system → communication structure → relational patterns → friction points under pressure → organizational consequences.'
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
 * Domain 6: Hidden Contradictions (Tier 2-3)
 * ENHANCED: Full unpacking with tension, manifestation, resolution path, severity
 */
function extractContradictionsStarter(canonical) {
  const contradictions_array = canonical.contradictions || [];
  const dimension_tradeoffs = canonical.top_systems?.dimension_tradeoffs || [];
  const hidden_risks = canonical.hidden_risk_patterns || {};

  return {
    title: 'Hidden Contradictions',
    confidence: 'tier_3_medium',
    source_fields: ['contradictions', 'dimension_tradeoffs', 'hidden_risk_patterns'],
    
    summary: buildContradictionsSummaryEnhanced(contradictions_array, hidden_risks),
    
    contradiction_count: contradictions_array.length,
    
    contradictions: contradictions_array.map(c => ({
      type: c.type || 'structural_tension',
      tension: c.tension || '',
      manifestation: c.manifestation || '',
      dimensions_in_conflict: c.dimensions_in_conflict || [c.primary_dimension, c.secondary_dimension].filter(Boolean),
      resolution_path: c.resolution_path || 'Unaddressed',
      severity: c.severity || 'unknown',
      cost: buildContradictionCost(c, hidden_risks),
      interpretation: buildContradictionInterpretationEnhanced(c)
    })),
    
    core_tradeoff: dimension_tradeoffs[0] || null,
    
    organizational_cost: extractOrganizationalCost(contradictions_array, hidden_risks),
    
    key_signals: [
      `${contradictions_array.length} contradictions identified`,
      contradictions_array[0]?.severity ? `Primary severity: ${contradictions_array[0].severity}` : 'Severity not assessed',
      contradictions_array[0]?.tension ? `Tension: ${contradictions_array[0].tension.substring(0, 60)}...` : 'Core friction not mapped',
      hidden_risks.relational_erosion_risk ? `Relational cost: ${hidden_risks.relational_erosion_risk.substring(0, 50)}...` : 'No relational risk identified'
    ],
    
    causal_interpretation: 'Structural tension (what you value vs what you default to) → behavioral manifestation (what others see) → organizational cost (friction, erosion, ceiling) → resolution path (what needs to shift).'
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

// ============================================================================
// ENHANCED HELPER FUNCTIONS (Phase 2)
// ============================================================================

function buildOthersExperienceSummaryEnhanced(primary, communication_style, team_experience) {
  if (team_experience) {
    return `${team_experience}. ${communication_style.message_structure || 'Communication patterns'} shapes relational dynamics.`;
  }
  
  const dimension = primary.dimension || 'unknown';
  const structure = communication_style.message_structure || '';
  
  if (structure) {
    return `${structure}. Others experience ${dimension}-driven approach in relational interactions.`;
  }
  
  return `Others experience ${dimension}-driven approach first. Communication and listening patterns shaped by dimension balance.`;
}

function buildCommunicationInterpretation(fidelity, velocity, directness) {
  if (fidelity > 6.5) {
    return `Communication prioritizes precision and completeness—detailed, thorough. Directness: ${directness}.`;
  }
  
  if (velocity > 6.5) {
    return `Communication prioritizes speed and direction—concise, action-oriented. Directness: ${directness}.`;
  }
  
  if (velocity > fidelity + 2) {
    return `Communication leans brevity over detail—moves quickly, may skip context. Directness: ${directness}.`;
  }
  
  return `Communication balances detail and speed contextually. Directness: ${directness}.`;
}

function buildListeningInterpretation(signal, vector) {
  if (signal > 6.5) {
    return 'Attentive listener—tracks unspoken dynamics, tone, relational context.';
  }
  
  if (vector > 6.5 && signal < 3) {
    return 'Goal-oriented listening—focuses on actionable information, filters relational cues.';
  }
  
  if (vector > signal + 2) {
    return 'Listening prioritizes direction and outcome—relational signals secondary to task.';
  }
  
  if (signal > 4) {
    return 'Balanced listening—adjusts attention between task and relational dynamics.';
  }
  
  return 'Listening filters for action—relational awareness exists but not primary focus.';
}

function buildContradictionsSummaryEnhanced(contradictions, hidden_risks) {
  if (contradictions.length === 0) {
    return 'No structural contradictions currently identified in dossier.';
  }
  
  const high_severity = contradictions.filter(c => c.severity === 'high' || c.severity === 'severe').length;
  const relational_risk = hidden_risks.relational_erosion_risk;
  
  if (high_severity > 0 && relational_risk) {
    return `${contradictions.length} contradictions identified (${high_severity} high-severity). ${relational_risk}`;
  }
  
  if (high_severity > 0) {
    return `${contradictions.length} contradictions identified (${high_severity} high-severity). Organizational cost: systems gaps, friction under pressure.`;
  }
  
  if (contradictions.length === 1) {
    const c = contradictions[0];
    return `1 contradiction identified: ${c.tension || c.type || 'structural tension'}. Severity: ${c.severity || 'unknown'}.`;
  }
  
  return `${contradictions.length} contradictions identified. Primary: ${contradictions[0].tension || contradictions[0].type || 'structural tension'}.`;
}

function buildContradictionCost(contradiction, hidden_risks) {
  // If explicit cost field exists, use it
  if (contradiction.cost && contradiction.cost.length > 0) {
    return contradiction.cost;
  }
  
  // Infer cost from severity + manifestation
  const severity = contradiction.severity || 'unknown';
  const manifestation = contradiction.manifestation || '';
  const tension = contradiction.tension || '';
  
  if (severity === 'high' || severity === 'severe') {
    if (manifestation.includes('infrastructure') || manifestation.includes('systems')) {
      return 'Systems cannot support stated goals—ceiling hit without infrastructure build.';
    }
    
    if (manifestation.includes('relational') || hidden_risks.relational_erosion_risk) {
      return `${manifestation}. ${hidden_risks.relational_erosion_risk || 'Relational erosion under pressure.'}`;
    }
    
    return manifestation || 'High organizational cost—friction compounds under growth.';
  }
  
  if (severity === 'mild' || severity === 'low') {
    return manifestation || 'Mild friction—manageable at current scale, may amplify under pressure.';
  }
  
  // Fallback: use manifestation or tension
  return manifestation || tension || 'Organizational friction—cost not yet quantified.';
}

function buildContradictionInterpretationEnhanced(contradiction) {
  const parts = [];
  
  if (contradiction.tension) {
    parts.push(`Tension: ${contradiction.tension}`);
  } else if (contradiction.type) {
    parts.push(`Type: ${contradiction.type}`);
  }
  
  if (contradiction.manifestation) {
    parts.push(`Manifests as: ${contradiction.manifestation}`);
  }
  
  if (contradiction.dimensions_in_conflict && contradiction.dimensions_in_conflict.length > 0) {
    parts.push(`Dimensions in conflict: ${contradiction.dimensions_in_conflict.join(' ↔ ')}`);
  }
  
  if (contradiction.resolution_path) {
    parts.push(`Resolution: ${contradiction.resolution_path}`);
  }
  
  if (contradiction.severity) {
    parts.push(`Severity: ${contradiction.severity}`);
  }
  
  return parts.length > 0 ? parts.join('. ') + '.' : 'Structural tension identified but not fully unpacked.';
}

function extractOrganizationalCost(contradictions, hidden_risks) {
  const costs = [];
  
  // Extract from contradictions
  contradictions.forEach(c => {
    if (c.severity === 'high' || c.severity === 'severe') {
      const manifestation = c.manifestation || c.tension || 'High-severity contradiction';
      costs.push(manifestation);
    }
  });
  
  // Extract from hidden risks
  if (hidden_risks.relational_erosion_risk && hidden_risks.relational_erosion_risk !== 'Low') {
    costs.push(hidden_risks.relational_erosion_risk);
  }
  
  if (hidden_risks.burnout_trajectory && hidden_risks.burnout_trajectory !== 'Low') {
    costs.push(`Burnout risk: ${hidden_risks.burnout_trajectory}`);
  }
  
  if (costs.length === 0) {
    return 'Organizational costs not yet quantified at current scale.';
  }
  
  return costs.join('; ');
}


// ============================================================================
// PHASE 3: SCALING + DECISION + CONSEQUENCES + FACILITATOR DOMAINS
// ============================================================================

/**
 * Domain 7: Scaling Constraint (Tier 2-3)
 * Evidence from: infrastructure_maturity, future_ceiling, growth_trajectory
 */
function extractScalingConstraint(canonical) {
  const infrastructure = canonical.infrastructure_maturity || {};
  const ceiling = canonical.future_ceiling || {};
  const growth = canonical.growth_trajectory || {};
  const goals = canonical.stated_goals || {};
  
  const current_systems = infrastructure.current_systems_capacity || 'unknown';
  const systems_readiness = infrastructure.systems_readiness || 'unknown';
  const ceiling_desc = ceiling.ceiling_description || '';
  const primary_constraint = ceiling.primary_constraint || '';
  const growth_pattern = growth.pattern || '';
  const stated_scale = goals.scale_target || '';
  const stated_timeline = goals.timeline || '';
  
  return {
    title: 'Scaling Constraint',
    confidence: 'tier_2_medium',
    source_fields: ['infrastructure_maturity', 'future_ceiling', 'growth_trajectory', 'stated_goals'],
    summary: buildScalingConstraintSummary(current_systems, primary_constraint, stated_scale),
    current_systems_capacity: {
      capacity_description: current_systems,
      readiness_level: systems_readiness,
      interpretation: `Current infrastructure: ${current_systems}. Readiness: ${systems_readiness}.`
    },
    stated_vs_supported: {
      stated_growth_target: stated_scale,
      infrastructure_readiness: systems_readiness,
      gap_exists: systems_readiness !== 'high' && stated_scale !== 'unknown',
      interpretation: buildStatedVsSupportedInterpretation(stated_scale, systems_readiness, ceiling_desc)
    },
    ceiling_mechanics: {
      primary_constraint: primary_constraint,
      ceiling_description: ceiling_desc,
      growth_pattern: growth_pattern,
      interpretation: primary_constraint
        ? `Ceiling formed by: ${primary_constraint}. Growth pattern: ${growth_pattern}.`
        : 'Ceiling not yet identified.'
    },
    implications: {
      without_infrastructure: extractWithoutInfrastructureImplications(primary_constraint, stated_scale),
      with_infrastructure: extractWithInfrastructureImplications(primary_constraint, systems_readiness)
    },
    key_signals: [
      primary_constraint ? `Primary constraint: ${primary_constraint.substring(0, 50)}...` : 'No constraint identified',
      systems_readiness !== 'high' ? `Systems readiness: ${systems_readiness}` : 'Systems ready'
    ]
  };
}

/**
 * Domain 8: Decision Architecture (Tier 2-3)
 * Evidence from: decision_making_patterns, execution_identity, delegation_resistance
 */
function extractDecisionArchitecture(canonical) {
  const decisions = canonical.decision_making_patterns || {};
  const execution = canonical.execution_identity || {};
  const delegation = canonical.delegation_resistance || {};
  const vectors = canonical.vector_scores || {};
  
  const decision_speed = decisions.decision_velocity || 'unknown';
  const data_requirements = decisions.data_requirements || '';
  const claimed_model = execution.claimed_model || '';
  const actual_model = execution.actual_model || '';
  const model_gap = execution.claim_vs_actual_gap || '';
  const what_resists = delegation.what_resists || [];
  const why_resists = delegation.why || '';
  const vector_score = vectors.vector || 0;
  
  return {
    title: 'Decision Architecture',
    confidence: 'tier_2_medium',
    source_fields: ['decision_making_patterns', 'execution_identity', 'delegation_resistance'],
    summary: buildDecisionArchitectureSummary(decision_speed, claimed_model, model_gap),
    decision_velocity: {
      speed: decision_speed,
      data_requirements: data_requirements,
      vector_score: vector_score,
      interpretation: buildDecisionVelocityInterpretation(decision_speed, data_requirements, vector_score)
    },
    execution_model: {
      claimed: claimed_model,
      actual: actual_model,
      gap_description: model_gap,
      gap_exists: claimed_model !== actual_model && model_gap !== '',
      interpretation: model_gap
        ? `Claims: ${claimed_model}. Reality: ${actual_model}. Gap: ${model_gap}`
        : `Execution model: ${actual_model || claimed_model}`
    },
    delegation_resistance: {
      what_resists_delegation: what_resists,
      resistance_reason: why_resists,
      interpretation: buildDelegationResistanceInterpretation(what_resists, why_resists)
    },
    organizational_consequences: {
      decision_bottleneck: decision_speed === 'slow' ? 'Slow decisions. Org waits.' : 'Decision velocity sufficient',
      delegation_ceiling: what_resists.length > 0 ? `Cannot delegate: ${what_resists.join(', ')}` : 'Delegation open'
    },
    key_signals: [
      `Decision velocity: ${decision_speed}`,
      model_gap ? `Gap: ${model_gap.substring(0, 40)}...` : 'Model aligned',
      what_resists.length > 0 ? `Resists: ${what_resists.join(', ')}` : 'Open'
    ]
  };
}

/**
 * Domain 9: Organizational Consequences (Tier 3)
 * Synthesizes all pressure + contradiction + scaling evidence
 */
function extractOrganizationalConsequences(canonical) {
  const contradictions = canonical.contradictions || [];
  const hidden_risks = canonical.hidden_risk_patterns || {};
  const infrastructure = canonical.infrastructure_maturity || {};
  const stall_patterns = canonical.stall_patterns || {};
  
  const relational_cost = hidden_risks.relational_erosion_risk || '';
  const burnout_risk = hidden_risks.burnout_trajectory || '';
  const systems_readiness = infrastructure.systems_readiness || 'unknown';
  const stall_triggers = stall_patterns.triggers || [];
  
  const consequences = [];
  if (relational_cost && relational_cost !== 'Low') {
    consequences.push({ domain: 'relational', cost: relational_cost });
  }
  if (systems_readiness !== 'high') {
    consequences.push({ domain: 'infrastructure', cost: 'Systems weak' });
  }
  if (burnout_risk && burnout_risk !== 'Low') {
    consequences.push({ domain: 'energy', cost: burnout_risk });
  }
  if (stall_triggers.length > 0) {
    consequences.push({ domain: 'momentum', cost: `Stalls: ${stall_triggers.join(', ')}` });
  }
  
  return {
    title: 'Organizational Consequences',
    confidence: 'tier_3_medium',
    source_fields: ['contradictions', 'hidden_risk_patterns', 'infrastructure_maturity', 'stall_patterns'],
    summary: buildOrganizationalConsequencesSummary(consequences),
    consequence_matrix: consequences,
    consequence_count: consequences.length,
    key_signals: consequences.map(c => `${c.domain}: ${c.cost}`)
  };
}

/**
 * Domain 10: Facilitator Notes (Tier 3)
 * Environment design + structural guidance. NOT therapy.
 */
function extractFacilitatorNotes(canonical) {
  const execution = canonical.execution_identity || {};
  const decision = canonical.decision_making_patterns || {};
  const delegation = canonical.delegation_resistance || {};
  const infrastructure = canonical.infrastructure_maturity || {};
  const contradictions = canonical.contradictions || [];
  const ceiling = canonical.future_ceiling || {};
  
  const actual_model = execution.actual_model || '';
  const decision_velocity = decision.decision_velocity || '';
  const what_resists = delegation.what_resists || [];
  const systems_readiness = infrastructure.systems_readiness || '';
  const primary_constraint = ceiling.primary_constraint || '';
  
  const notes = [];
  
  if (systems_readiness !== 'high' && primary_constraint) {
    notes.push({
      category: 'structure',
      note: `Architecture must change before scale. ${primary_constraint}. Build or restructure.`,
      applies_to: 'organizational_design'
    });
  }
  
  if (what_resists.length > 0) {
    notes.push({
      category: 'role_design',
      note: `Cannot delegate: ${what_resists.join(', ')}. Design role around this. Operator becomes specialist role.`,
      applies_to: 'team_structure'
    });
  }
  
  if (decision_velocity === 'slow') {
    notes.push({
      category: 'communication',
      note: 'Assemble data packages before requesting decisions. Build process, not faster thinking.',
      applies_to: 'operational_process'
    });
  }
  
  if (contradictions.length > 1) {
    notes.push({
      category: 'environment_fit',
      note: `Multiple contradictions. Structural misalignment likely.`,
      applies_to: 'organizational_alignment'
    });
  }
  
  return {
    title: 'Facilitator Notes',
    confidence: 'tier_3_medium',
    source_fields: ['execution_identity', 'decision_making_patterns', 'delegation_resistance', 'infrastructure_maturity', 'contradictions'],
    summary: `${notes.length} structural guidance notes.`,
    note_count: notes.length,
    notes: notes,
    primary_guidance: notes.length > 0 ? notes[0].note : 'Insufficient evidence.',
    caution: 'Environment design notes, not behavior coaching. Operator function is fixed; organization design is flexible.'
  };
}

/**
 * Domain 11: Five Possible Futures (Starter - Tier 3)
 * Trajectory simulations, not predictions.
 */
function extractFiveFuturesStarter(canonical) {
  const contradictions = canonical.contradictions || [];
  const hidden_risks = canonical.hidden_risk_patterns || {};
  const ceiling = canonical.future_ceiling || {};
  
  const relational_erosion = hidden_risks.relational_erosion_risk || 'Low';
  const burnout_risk = hidden_risks.burnout_trajectory || 'Low';
  const high_severity = contradictions.filter(c => c.severity === 'high' || c.severity === 'severe').length;
  
  const futures = [
    {
      title: 'Scaled Success',
      likelihood: 'possible',
      trajectory: 'Operator builds infrastructure. Organization becomes leverage-multiplied.',
      organization_experiences: 'Sustainable growth. Operator not rate-limiting.'
    },
    {
      title: 'Optimized Specialty',
      likelihood: 'likely',
      trajectory: 'Operator becomes irreplaceable specialist. Organization structures around them.',
      organization_experiences: 'Stable at current scale. High operator dependency.'
    },
    {
      title: 'Increasing Friction',
      likelihood: relational_erosion !== 'Low' ? 'likely' : 'possible',
      trajectory: 'Contradictions compound. Relational erosion accelerates.',
      organization_experiences: 'Team isolation. Information degraded. Talent erosion.'
    },
    {
      title: 'Infrastructure Crisis',
      likelihood: high_severity > 1 ? 'likely' : 'possible',
      trajectory: 'Systems cannot support goals. Scale attempt fails.',
      organization_experiences: 'Project failures. Organizational paralysis.'
    },
    {
      title: 'Successful Transition',
      likelihood: 'possible',
      trajectory: 'Operator transitions to strategy. Operational structure built.',
      organization_experiences: 'Scalable structure emerges. Operator elevated.'
    }
  ];
  
  return {
    title: 'Five Possible Futures (Starter)',
    confidence: 'tier_3_low',
    source_fields: ['contradictions', 'hidden_risk_patterns', 'future_ceiling'],
    summary: 'Trajectory simulations. Not predictions—indicate which futures become likely if patterns continue.',
    futures: futures,
    most_likely: buildMostLikelyFuture(relational_erosion, burnout_risk, high_severity),
    caution: 'Structural changes alter trajectory.'
  };
}

/**
 * Domain 12: The One Move (Starter - Tier 3)
 * Highest-leverage intervention to shift trajectory.
 */
function extractTheOneMove(canonical) {
  const infrastructure = canonical.infrastructure_maturity || {};
  const delegation = canonical.delegation_resistance || {};
  const contradictions = canonical.contradictions || [];
  const hidden_risks = canonical.hidden_risk_patterns || {};
  
  const systems_readiness = infrastructure.systems_readiness || 'unknown';
  const what_resists = delegation.what_resists || [];
  const high_severity = contradictions.filter(c => c.severity === 'high' || c.severity === 'severe');
  const burnout_risk = hidden_risks.burnout_trajectory || 'Low';
  
  let the_move = null;
  let move_reasoning = '';
  
  if (systems_readiness === 'low' || systems_readiness === 'weak') {
    the_move = 'Build systems + hire operations lead before next growth';
    move_reasoning = 'Infrastructure gap is rate-limiting. Operator bandwidth cannot be scaling lever.';
  } else if (what_resists.length > 2) {
    the_move = `Design role: ${what_resists.slice(0, 2).join(', ')} stay embedded; delegate everything else`;
    move_reasoning = `Accept high specialization. Build team around core ${what_resists.slice(0, 1)[0]}.`;
  } else if (high_severity.length > 0) {
    const first = high_severity[0];
    the_move = first.resolution_path || 'Address structural tension';
    move_reasoning = `High-severity: ${first.tension}. This drives relational erosion + ceiling.`;
  } else if (burnout_risk !== 'Low') {
    the_move = 'Reduce load through structure, not faster thinking';
    move_reasoning = 'Energy depletion indicated. Load reduction more sustainable than speed.';
  } else {
    the_move = 'Define operational clarity: decision criteria, delegation boundaries, role scope';
    move_reasoning = 'Without structure, operator becomes omnipresent default.';
  }
  
  return {
    title: 'The One Move',
    confidence: 'tier_3_low',
    source_fields: ['infrastructure_maturity', 'delegation_resistance', 'contradictions', 'hidden_risk_patterns'],
    summary: 'Highest-leverage intervention.',
    the_move: the_move,
    reasoning: move_reasoning,
    timeline: '90 days to shift trajectory. 6-9 months for full organizational shift.',
    caution: 'Not advice. Highest-leverage intervention based on evidence.'
  };
}

// ============================================================================
// PHASE 3 HELPER FUNCTIONS
// ============================================================================

function buildScalingConstraintSummary(current_systems, constraint, stated_scale) {
  if (!constraint && !stated_scale) return 'Scaling constraint not identified.';
  if (constraint) return `Constraint: ${constraint}. Systems: ${current_systems}.`;
  return `Scale target: ${stated_scale}. Systems: ${current_systems}.`;
}

function buildStatedVsSupportedInterpretation(stated_scale, readiness, ceiling_desc) {
  if (!stated_scale || readiness === 'high') return 'Growth + infrastructure aligned.';
  if (readiness === 'low' || readiness === 'weak') {
    return `Infrastructure NOT ready. Gap: stated ${stated_scale} vs. readiness ${readiness}.`;
  }
  return `Gap: stated vs. readiness.`;
}

function extractWithoutInfrastructureImplications(constraint, stated_scale) {
  if (!constraint) return 'Constraint not identified.';
  if (!stated_scale) return `Growth without addressing: ${constraint}`;
  return `Attempting scale without addressing ${constraint} = failure + burnout.`;
}

function extractWithInfrastructureImplications(constraint, readiness) {
  if (readiness === 'high') return 'Infrastructure ready. Scale supported.';
  if (readiness === 'low' || readiness === 'weak') return `Build ${constraint}. Removes ceiling.`;
  return `Address ${constraint}. Highest-leverage investment.`;
}

function buildDecisionArchitectureSummary(speed, claimed_model, gap) {
  if (gap) return `Gap: claims ${claimed_model}, operates differently. Speed: ${speed}.`;
  return `Model: ${claimed_model}. Speed: ${speed}.`;
}

function buildDecisionVelocityInterpretation(speed, data_reqs, vector_score) {
  if (speed === 'fast') return `Quick decisions. Data: ${data_reqs || 'minimal'}. Vector ${vector_score > 6 ? 'high' : 'variable'}.`;
  if (speed === 'slow') return `Deliberate. Data: ${data_reqs || 'thorough'}. Org must assemble context.`;
  return `Speed: ${speed}. Data: ${data_reqs || 'context-dependent'}.`;
}

function buildDelegationResistanceInterpretation(what_resists, why) {
  if (what_resists.length === 0) return 'No delegation resistance. Open.';
  if (what_resists.length === 1) return `Cannot delegate: ${what_resists[0]}. Stays embedded.`;
  return `Cannot delegate: ${what_resists.join(', ')}. Ceiling at operator bandwidth.`;
}

function buildOrganizationalConsequencesSummary(consequences) {
  if (consequences.length === 0) return 'No major consequences identified.';
  const domains = consequences.map(c => c.domain).join(', ');
  return `${consequences.length} domains: ${domains}. Primary: ${consequences[0].cost}.`;
}

function buildMostLikelyFuture(relational_erosion, burnout_risk, high_severity_count) {
  if (relational_erosion !== 'Low' && burnout_risk !== 'Low') return 'Increasing Friction';
  if (high_severity_count > 1) return 'Infrastructure Crisis';
  if (relational_erosion === 'Low' && high_severity_count === 0) return 'Optimized Specialty';
  return 'Multiple futures possible';
}
