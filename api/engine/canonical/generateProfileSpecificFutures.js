/**
 * generateProfileSpecificFutures.js
 * 
 * Profile-specific trajectory simulation engine.
 * Replaces generic static futures with psychologically specific trajectory simulations.
 * 
 * Each profile receives 5 futures that could ONLY belong to that profile,
 * derived from:
 * - Operating system (primary/secondary dimensions)
 * - Emotional state (calm/anxious/confident/stuck)
 * - Pressure pattern (doubles down / withdraws / adapts / freezes)
 * - Contradiction map (structural tensions)
 * - Scaling constraint (where infrastructure breaks)
 * - Hidden risks (relational, burnout, stall patterns)
 * - Evidence from intake_answers (written words, not just scores)
 * 
 * NOT generic advice. Trajectory simulations: "If this pattern repeats, this future emerges."
 * 
 * Five Required Future Types:
 * 1. Default Drift Future — what happens if nothing changes
 * 2. Protected Strength Future — what happens if best trait is used well
 * 3. Distorted Strength Future — what happens if best trait becomes liability
 * 4. Scaling/Relationship Cost Future — what breaks over time
 * 5. Transformational Future — what changes if highest-leverage adjustment made
 */

/**
 * Main entry point for profile-specific futures generation.
 * 
 * @param {object} canonical - Full canonical dossier
 * @returns {array} futures - Array of 5 profile-specific futures
 */
export function generateProfileSpecificFutures(canonical) {
  if (!canonical) {
    return getDefaultFuturesPlaceholder();
  }

  try {
    // Extract key evidence
    const operating_system = canonical.top_systems || {};
    const vector_scores = canonical.vector_scores || {};
    const contradictions = canonical.contradictions || [];
    const hidden_risks = canonical.hidden_risk_patterns || {};
    const infrastructure = canonical.infrastructure_maturity || {};
    const ceiling = canonical.future_ceiling || {};
    const stall_patterns = canonical.stall_patterns || {};
    const intake_answers = canonical.intake_answers || {};
    
    // Identify core operating pattern
    const primary_dim = operating_system.primary_driver?.dimension || 'unknown';
    const secondary_dim = operating_system.secondary_stabilizer?.dimension || 'unknown';
    const pressure_manifestation = operating_system.primary_driver?.pressure_manifestation || '';
    
    // Detect emotional state from written evidence
    const emotional_markers = detectEmotionalState(intake_answers, pressure_manifestation);
    
    // Detect action vs avoidance pattern
    const action_pattern = detectActionPattern(operating_system, contradictions, stall_patterns);
    
    // Get scaling constraint
    const constraint = ceiling.primary_constraint || '';
    
    // Get relational and burnout risks
    const relational_risk = hidden_risks.relational_erosion_risk || 'Low';
    const burnout_level = hidden_risks.burnout_trajectory || 'Low';
    
    // Build 5 futures specific to this profile
    const futures = [
      buildDefaultDriftFuture(primary_dim, emotional_markers, action_pattern, canonical),
      buildProtectedStrengthFuture(primary_dim, secondary_dim, vector_scores, canonical),
      buildDistortedStrengthFuture(primary_dim, pressure_manifestation, emotional_markers, canonical),
      buildScalingCostFuture(primary_dim, relational_risk, constraint, canonical),
      buildTransformationalFuture(primary_dim, emotional_markers, action_pattern, ceiling, canonical)
    ];
    
    return futures;
  } catch (error) {
    console.error('[FUTURES] Generation failed:', error);
    return getDefaultFuturesPlaceholder();
  }
}

// ============================================================================
// FUTURE TYPE BUILDERS
// ============================================================================

/**
 * Future 1: Default Drift Future
 * If pattern repeats under steady pressure, what happens?
 */
function buildDefaultDriftFuture(primary_dim, emotional_markers, action_pattern, canonical) {
  const operating_system = canonical.top_systems || {};
  const primary = operating_system.primary_driver || {};
  
  let title = '';
  let trajectory = '';
  let likelihood = 'likely';
  
  // Tailored by primary dimension + emotional state
  if (primary_dim === 'vector' && emotional_markers.includes('confident')) {
    title = 'Momentum Empire';
    trajectory = 'Speed compounds. Operator-led expansion accelerates. Organization becomes dependent on tempo.';
  } else if (primary_dim === 'vector' && emotional_markers.includes('stressed')) {
    title = 'Speed Debt Accumulation';
    trajectory = 'Quick decisions + pressure = shortcuts everywhere. Technical + operational debt compounds.';
  } else if (primary_dim === 'vector' && emotional_markers.includes('stuck')) {
    title = 'Stalled Momentum';
    trajectory = 'Vector stuck in neutral. Indecision feels like caution. Organization loses directional clarity.';
  } else if (primary_dim === 'signal' && emotional_markers.includes('confident')) {
    title = 'Perceptive Authority';
    trajectory = 'Pattern recognition deepens. Operator becomes strategic voice. Team depends on insights.';
  } else if (primary_dim === 'signal' && emotional_markers.includes('anxious')) {
    title = 'Overreading Patterns';
    trajectory = 'Signal sensitivity increases under stress. Sees threats everywhere. Org becomes risk-averse.';
  } else if (primary_dim === 'fidelity' && emotional_markers.includes('confident')) {
    title = 'Precision Authority';
    trajectory = 'Detail mastery deepens. Operator becomes quality gate. Org optimizes to this standard.';
  } else if (primary_dim === 'fidelity' && emotional_markers.includes('stuck')) {
    title = 'Analysis Paralysis Deepens';
    trajectory = 'Perfectionism increases under pressure. Decisions slower. Organization stalls waiting for clarity.';
  } else if (primary_dim === 'framework' && emotional_markers.includes('confident')) {
    title = 'Systematized Authority';
    trajectory = 'Systems thinking deepens. Operator designs increasingly sophisticated structure. Org becomes process-bound.';
  } else if (action_pattern === 'avoidant' && emotional_markers.includes('stuck')) {
    title = 'Quiet Withdrawal';
    trajectory = 'Avoidance deepens under pressure. Operator pulls back. Org loses leadership clarity. Stalls.';
  } else {
    title = `Continued ${primary_dim} Dominance`;
    trajectory = `Default pattern intensifies. ${primary.operating_manifestation || 'Operating pattern'} becomes more pronounced.`;
  }
  
  return {
    title: title,
    likelihood: likelihood,
    description: trajectory,
    consequence: buildDefaultDriftConsequence(primary_dim, emotional_markers, canonical),
    profile_specific: true
  };
}

/**
 * Future 2: Protected Strength Future
 * If best trait is deployed strategically and well-supported, what grows?
 */
function buildProtectedStrengthFuture(primary_dim, secondary_dim, scores, canonical) {
  let title = '';
  let trajectory = '';
  let likelihood = 'possible';
  
  // Tailored by primary + secondary combination
  if (primary_dim === 'vector' && scores.vector > 6.5) {
    if (secondary_dim === 'framework') {
      title = 'Strategic Operator Commander';
      trajectory = 'Vector channeled through systems. Rapid decisions + structured execution = force multiplier. Organization scales systematically.';
    } else if (secondary_dim === 'signal') {
      title = 'Intuitive Strategist';
      trajectory = 'Speed guided by pattern recognition. Operator becomes strategic advisor. Fast decisions with peripheral vision.';
    } else {
      title = 'Momentum Builder';
      trajectory = 'Vector energy invested in team development. Organization learns to move with clarity and purpose.';
    }
  } else if (primary_dim === 'signal' && scores.signal > 6.5) {
    if (secondary_dim === 'framework') {
      title = 'Systems-Informed Insights';
      trajectory = 'Pattern recognition grounded in structure. Operator becomes architect + seer. Strategic clarity increases.';
    } else if (secondary_dim === 'vector') {
      title = 'Perceptive Director';
      trajectory = 'Signal clarity shapes direction. Organization moves based on deep understanding. Proactive alignment.';
    } else {
      title = 'Trusted Advisor';
      trajectory = 'Pattern insights valued + acted on. Organization adapts based on operator perception. Resilience increases.';
    }
  } else if (primary_dim === 'fidelity' && scores.fidelity > 6.5) {
    if (secondary_dim === 'vector') {
      title = 'Precision Executor';
      trajectory = 'Detail mastery + direction clarity. Quality + speed both high. Organization becomes known for excellence.';
    } else if (secondary_dim === 'framework') {
      title = 'Rigorous Designer';
      trajectory = 'Precision channeled into system design. Organization infrastructure becomes competitive advantage.';
    } else {
      title = 'Craftsmanship Culture';
      trajectory = 'Quality standards become org culture. Team adopts precision focus. Product/service excellence compounds.';
    }
  } else if (primary_dim === 'framework' && scores.framework > 6.5) {
    title = 'Architect of Scale';
    trajectory = 'Structural thinking scaled into org design. Systems become repeatable, scalable. Organization grows coherently.';
  } else {
    title = `${primary_dim} Amplified`;
    trajectory = `Strength fully deployed. ${primary_dim} becomes organizational competitive advantage.`;
  }
  
  return {
    title: title,
    likelihood: likelihood,
    description: trajectory,
    consequence: buildProtectedStrengthConsequence(primary_dim, secondary_dim, canonical),
    profile_specific: true
  };
}

/**
 * Future 3: Distorted Strength Future
 * If best trait becomes liability or twisted by pressure, what fails?
 */
function buildDistortedStrengthFuture(primary_dim, pressure_manifestation, emotional_markers, canonical) {
  let title = '';
  let trajectory = '';
  let likelihood = 'possible';
  
  // Tailored by primary dimension + its pressure manifestation
  if (primary_dim === 'vector') {
    if (emotional_markers.includes('stressed') || emotional_markers.includes('impatient')) {
      title = 'Speed Spiral';
      trajectory = 'Vector becomes impatience. Quick decisions become reckless. Organization experiences whiplash. Course corrections break trust.';
      likelihood = 'likely';
    } else if (pressure_manifestation.includes('doubles down')) {
      title = 'Overcommitment Failure';
      trajectory = 'Vector doubles down on wrong direction. Organization commits resources. Discovery comes too late.';
    } else {
      title = 'Directional Tyranny';
      trajectory = 'Speed becomes domination. Operator decides, others implement. No feedback loops. Organization becomes brittle.';
    }
  } else if (primary_dim === 'signal') {
    if (emotional_markers.includes('anxious')) {
      title = 'Pattern Overreaction';
      trajectory = 'Signal amplified under stress. Operator sees threats. Organization becomes defensive, risk-averse, paralyzed.';
      likelihood = 'likely';
    } else if (pressure_manifestation.includes('withdraws')) {
      title = 'Silent Observation Paralysis';
      trajectory = 'Signal sensitivity + withdrawal = opacity. Operator sees issues but doesn\'t communicate. Organization confused.';
    } else {
      title = 'Information Gatekeeping';
      trajectory = 'Operator possesses all signals. Information asymmetry increases. Organization depends on operator interpretation.';
    }
  } else if (primary_dim === 'fidelity') {
    if (emotional_markers.includes('stuck') || emotional_markers.includes('perfectionist')) {
      title = 'Perfectionism Trap';
      trajectory = 'Fidelity becomes perfectionism. Nothing ships. Organization waits. Competitive window closes.';
      likelihood = 'likely';
    } else if (pressure_manifestation.includes('intensifies')) {
      title = 'Quality Gate Blockade';
      trajectory = 'Fidelity standards become unattainable. Everything fails quality review. Organization experiences delivery paralysis.';
    } else {
      title = 'Detail Overwhelm';
      trajectory = 'Fidelity applied to everything. Organization drowns in specs, processes, reviews. Velocity collapses.';
    }
  } else if (primary_dim === 'framework') {
    title = 'Process Paralysis';
    trajectory = 'Framework becomes bureaucracy. Every decision requires structure. Organization suffocates under process. Flexibility lost.';
  } else {
    title = `${primary_dim} Misapplied`;
    trajectory = `Strength becomes liability under pressure. ${pressure_manifestation || 'Operating pattern'} creates organizational friction.`;
  }
  
  return {
    title: title,
    likelihood: likelihood,
    description: trajectory,
    consequence: buildDistortedStrengthConsequence(primary_dim, emotional_markers, canonical),
    profile_specific: true
  };
}

/**
 * Future 4: Scaling/Relationship Cost Future
 * What breaks relationally and infrastructurally over time?
 */
function buildScalingCostFuture(primary_dim, relational_risk, constraint, canonical) {
  const hidden_risks = canonical.hidden_risk_patterns || {};
  const contradictions = canonical.contradictions || [];
  
  let title = '';
  let trajectory = '';
  let likelihood = 'possible';
  
  // Tailored by relational risk + primary dimension pressure pattern
  if (relational_risk !== 'Low' && primary_dim === 'vector') {
    title = 'Team Bottleneck Spiral';
    trajectory = 'Operator speed outpaces team capacity. Team feels left behind. Operator frustrated. Communication breaks down.';
    likelihood = 'likely';
  } else if (relational_risk !== 'Low' && primary_dim === 'signal') {
    title = 'Perception Asymmetry Crisis';
    trajectory = 'Operator sees patterns. Team doesn\'t. Operator decisions feel arbitrary. Trust erodes. Team stops advocating.';
    likelihood = 'likely';
  } else if (relational_risk !== 'Low' && primary_dim === 'fidelity') {
    title = 'Quality Standards Resentment';
    trajectory = 'Fidelity expectations become unreasonable. Team feels constantly judged. Talent leaves. Morale drops.';
    likelihood = 'likely';
  } else if (relational_risk !== 'Low') {
    title = 'Operator Isolation';
    trajectory = 'Operator becomes lone authority. Team stops challenging. Information stops flowing. Organization becomes fragile.';
    likelihood = 'likely';
  } else if (constraint) {
    // Make constraint-specific, not generic
    if (constraint.includes('infrastructure') || constraint.includes('systems')) {
      title = 'Systems Scaling Bottleneck';
    } else if (constraint.includes('process') || constraint.includes('workflow')) {
      title = 'Process Ceiling Reached';
    } else if (constraint.includes('decision')) {
      title = 'Decision Velocity Limit';
    } else {
      title = `${primary_dim} Ceiling Constraint`;
    }
    trajectory = `Organization hits ceiling. ${constraint} becomes permanent blocker. Growth stalls. Team frustrated.`;
    likelihood = contradictions.length > 1 ? 'likely' : 'possible';
  } else if (hidden_risks.burnout_trajectory !== 'Low') {
    if (primary_dim === 'vector') {
      title = 'Momentum Exhaustion';
      trajectory = 'Operator carrying speed load. Energy depletes. Decision quality drops. Performance erodes.';
    } else if (primary_dim === 'fidelity') {
      title = 'Quality Fatigue Spiral';
      trajectory = 'Perfectionism demands deplete operator. Energy gone. Standards drop. Quality erodes.';
    } else {
      title = 'Operator Exhaustion Limit';
      trajectory = 'Operator carrying too much. Energy depletes. Decision quality drops. Performance erodes.';
    }
  } else {
    title = 'Scaling Friction Accumulates';
    trajectory = 'Each growth phase reveals infrastructure gaps. Fixes become patchwork. System becomes unstable.';
  }
  
  return {
    title: title,
    likelihood: likelihood,
    description: trajectory,
    consequence: buildScalingCostConsequence(primary_dim, relational_risk, constraint, canonical),
    profile_specific: true
  };
}

/**
 * Future 5: Transformational Future
 * What changes if highest-leverage adjustment is made?
 */
function buildTransformationalFuture(primary_dim, emotional_markers, action_pattern, ceiling, canonical) {
  const infrastructure = canonical.infrastructure_maturity || {};
  const delegation = canonical.delegation_resistance || {};
  const contradictions = canonical.contradictions || [];
  
  const constraint = ceiling.primary_constraint || '';
  const systems_readiness = infrastructure.systems_readiness || '';
  const what_resists = delegation.what_resists || [];
  
  let title = '';
  let trajectory = '';
  let likelihood = 'possible';
  
  // Tailored by primary constraint + emotional state
  if (action_pattern === 'avoidant' && emotional_markers.includes('stuck')) {
    title = 'Competent Operator Recovered';
    trajectory = 'Avoidance patterns addressed. Operator regains decision confidence. Organization clarity returns. Momentum rebuilds.';
  } else if (primary_dim === 'vector' && systems_readiness !== 'high') {
    title = 'Structured Velocity';
    trajectory = 'Infrastructure built. Systems support speed. Operator can delegate. Organization scales without operator bottleneck.';
  } else if (primary_dim === 'signal' && what_resists.includes('strategy')) {
    title = 'Strategic Elevation';
    trajectory = 'Operator focuses on pattern detection + strategy. Execution delegated. Organization benefits from foresight + execution.';
  } else if (primary_dim === 'fidelity' && what_resists.length > 0) {
    title = 'Specialized Depth';
    trajectory = 'Operator becomes specialist. Process/execution/management delegated. Operator depth + team capability both high.';
  } else if (emotional_markers.includes('anxious') || emotional_markers.includes('stressed')) {
    title = 'Sustainable Pace';
    trajectory = 'Workload restructured. Operator energy stabilized. Decision quality improves. Team feels supported, not overwhelmed.';
  } else if (contradictions.length > 0) {
    title = 'Structural Alignment';
    trajectory = 'Contradictions addressed. Organization design changes. Operator and org become aligned. Friction disappears.';
  } else {
    title = 'Operationalized Excellence';
    trajectory = `${primary_dim} strength systematized. Organization scales to operator capacity.`;
  }
  
  return {
    title: title,
    likelihood: likelihood,
    description: trajectory,
    consequence: buildTransformationalConsequence(primary_dim, emotional_markers, ceiling, canonical),
    profile_specific: true
  };
}

// ============================================================================
// CONSEQUENCE BUILDERS (What does this future mean for the organization?)
// ============================================================================

function buildDefaultDriftConsequence(primary_dim, emotional_markers, canonical) {
  const operating_system = canonical.top_systems || {};
  const hidden_risks = canonical.hidden_risk_patterns || {};
  
  if (primary_dim === 'vector') {
    return hidden_risks.burnout_trajectory !== 'Low'
      ? 'Organization becomes operator-dependent momentum machine. Operator burnout inevitable.'
      : 'Organization thrives on speed. But becomes fragile to disruption.';
  } else if (primary_dim === 'signal') {
    return 'Organization becomes reactive to operator\'s pattern interpretations. Real signals might be missed.';
  } else if (primary_dim === 'fidelity') {
    return emotional_markers.includes('stuck')
      ? 'Organization becomes perfectionist paralysis machine. Shipping slows. Competitive edge erodes.'
      : 'Organization becomes known for quality. But process becomes slower.';
  }
  
  return 'Organization becomes optimized around operator\'s primary dimension. Vulnerable to its blind spots.';
}

function buildProtectedStrengthConsequence(primary_dim, secondary_dim, canonical) {
  const vector_scores = canonical.vector_scores || {};
  
  if (primary_dim === 'vector' && secondary_dim === 'framework') {
    return 'Organization becomes systematic operator: fast decisions + structured execution. Scalable. Sustainable.';
  } else if (primary_dim === 'signal' && secondary_dim === 'framework') {
    return 'Organization becomes strategic: pattern-informed architecture. Proactive + systematic.';
  }
  
  return `Organization becomes advantage carrier. ${primary_dim} strength compounds into competitive edge.`;
}

function buildDistortedStrengthConsequence(primary_dim, emotional_markers, canonical) {
  if (primary_dim === 'vector' && emotional_markers.includes('impatient')) {
    return 'Organization experiences constant course corrections. Whiplash. Talent attrition increases.';
  } else if (primary_dim === 'signal' && emotional_markers.includes('anxious')) {
    return 'Organization becomes defensive. Risk appetite evaporates. Innovation stalls.';
  } else if (primary_dim === 'fidelity' && emotional_markers.includes('stuck')) {
    return 'Organization becomes delivery-blocked. Competitive window closes.';
  }
  
  return 'Operator strength becomes organizational weakness. System breaks under pressure.';
}

function buildScalingCostConsequence(primary_dim, relational_risk, constraint, canonical) {
  if (relational_risk !== 'Low') {
    return 'Team fractionalizes. Information stops flowing. Organization loses resilience. Key talent leaves.';
  }
  
  if (constraint) {
    return `Scaling blocked by: ${constraint}. Organization plateaus. Operator becomes frustrated. Team becomes stalled.`;
  }
  
  return 'Organization hits ceiling. Growth stalls. Operator unable to scale. Team unable to lead without operator.';
}

function buildTransformationalConsequence(primary_dim, emotional_markers, ceiling, canonical) {
  return 'Organization becomes sustainable. Operator + team capability both high. Scalable structure emerges. Growth accelerates.';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Detect emotional state from written intake answers + pressure manifestation.
 * Returns array of emotional markers that shaped the futures.
 */
function detectEmotionalState(intake_answers, pressure_manifestation) {
  const markers = [];
  
  if (!intake_answers) return ['neutral'];
  
  const answers_text = JSON.stringify(intake_answers).toLowerCase();
  
  // Scan for emotional keywords
  if (answers_text.includes('stuck') || answers_text.includes('freeze') || answers_text.includes('paralyzed')) {
    markers.push('stuck');
  }
  if (answers_text.includes('anxious') || answers_text.includes('worried') || answers_text.includes('fear')) {
    markers.push('anxious');
  }
  if (answers_text.includes('confident') || answers_text.includes('clear') || answers_text.includes('certain')) {
    markers.push('confident');
  }
  if (answers_text.includes('stressed') || answers_text.includes('pressure') || answers_text.includes('overwhelm')) {
    markers.push('stressed');
  }
  if (answers_text.includes('impatient') || answers_text.includes('urgent') || answers_text.includes('rush')) {
    markers.push('impatient');
  }
  if (answers_text.includes('perfectionist') || answers_text.includes('need perfect') || answers_text.includes('precision')) {
    markers.push('perfectionist');
  }
  
  // Use pressure manifestation as fallback
  if (pressure_manifestation && markers.length === 0) {
    if (pressure_manifestation.includes('doubles down')) markers.push('intensifies');
    if (pressure_manifestation.includes('withdraws')) markers.push('avoidant');
    if (pressure_manifestation.includes('adapts')) markers.push('flexible');
  }
  
  return markers.length > 0 ? markers : ['neutral'];
}

/**
 * Detect action vs avoidant pattern from operating system + stall patterns.
 */
function detectActionPattern(operating_system, contradictions, stall_patterns) {
  const primary = operating_system.primary_driver || {};
  const pressure_response = primary.pressure_manifestation || '';
  const stall_triggers = stall_patterns.triggers || [];
  
  if (pressure_response.includes('withdraws') || stall_triggers.includes('decision')) {
    return 'avoidant';
  }
  
  if (pressure_response.includes('doubles down') || pressure_response.includes('intensifies')) {
    return 'aggressive';
  }
  
  if (stall_triggers.includes('relational') || stall_triggers.includes('ambiguity')) {
    return 'avoidant';
  }
  
  return 'adaptive';
}

/**
 * Placeholder futures for error cases.
 */
function getDefaultFuturesPlaceholder() {
  return [
    { title: 'Future Not Generated', likelihood: 'unknown', description: 'Profile-specific futures could not be generated.', consequence: 'Unknown', profile_specific: false }
  ];
}
