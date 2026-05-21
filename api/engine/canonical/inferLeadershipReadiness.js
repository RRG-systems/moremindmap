/**
 * inferLeadershipReadiness.js
 * 
 * Executive/leadership capacity assessment
 * 
 * Questions:
 * - Can this person truly lead scale?
 * - Do they create clarity or confusion?
 * - Do people follow willingly or compliantly?
 * - Do they collapse under relational resistance?
 * - Do they over-control?
 * - Can they delegate?
 * - Can they develop people?
 */

/**
 * Assess scale capacity
 */
function assessScaleCapacity(vectorScores, leadershipArchitecture, systemsAccountability, stallPatterns) {
  const vector = vectorScores.vector || 0;
  const horizon = vectorScores.horizon || 0;
  const framework = vectorScores.framework || 0;
  const signal = vectorScores.signal || 0;
  
  // High vector + horizon = can see and drive scale
  if (vector > 6.5 && horizon > 6.5) {
    return 'High - Naturally thinks multi-level and drives organizational direction';
  }
  
  // High vector, low horizon = execution strong but limited strategic depth
  if (vector > 6.5 && horizon < 5.0) {
    return 'Moderate - Strong execution but may hit ceiling without strategic scaffolding';
  }
  
  // Low vector = struggles to establish direction at scale
  if (vector < 4.0) {
    return 'Low - Direction-setting becomes bottleneck as complexity increases';
  }
  
  // High framework + low flex = process-bound, struggles with scale chaos
  if (framework > 7.0 && vectorScores.flex < 4.0) {
    return 'Moderate - Process-oriented but rigidity limits adaptive scaling';
  }
  
  return 'Moderate - Can scale with appropriate support structures';
}

/**
 * Assess clarity generation
 */
function assessClarityGeneration(vectorScores, communicationStyle, leadershipArchitecture) {
  const vector = vectorScores.vector || 0;
  const framework = vectorScores.framework || 0;
  const signal = vectorScores.signal || 0;
  
  // High vector + framework = clear direction + process
  if (vector > 6.0 && framework > 6.0) {
    return 'High - Establishes clear direction within structured process';
  }
  
  // High vector, low framework = direction clear but execution ambiguous
  if (vector > 6.5 && framework < 4.0) {
    return 'Moderate - Sets direction clearly but process ambiguity creates confusion';
  }
  
  // Low vector + low framework = ambiguity compounds
  if (vector < 4.0 && framework < 4.0) {
    return 'Low - Direction and process both unclear, team operates in fog';
  }
  
  // High signal + moderate vector = adjusts for clarity
  if (signal > 6.0 && vector > 4.5) {
    return 'High - Reads when clarity is missing and adjusts communication';
  }
  
  return 'Moderate - Clarity varies by context and team composition';
}

/**
 * Assess followership quality
 */
function assessFollowershipQuality(vectorScores, leadershipArchitecture, stallPatterns) {
  const vector = vectorScores.vector || 0;
  const signal = vectorScores.signal || 0;
  const leverage = vectorScores.leverage || 0;
  
  const relationalFriction = stallPatterns?.frustrations?.includes('relational') || false;
  const resistancePattern = stallPatterns?.attention_direction === 'people_problems';
  
  // High vector + low signal + relational friction = compliance, not willingness
  if (vector > 6.5 && signal < 3.5 && relationalFriction) {
    return 'Compliance-based - People follow directives but not leader; relationship erosion likely';
  }
  
  // High vector + high signal = willing followers
  if (vector > 6.0 && signal > 6.0) {
    return 'Willing - Commands direction while maintaining relational connection';
  }
  
  // High leverage + moderate vector = influence-based followership
  if (leverage > 6.0 && vector > 4.5) {
    return 'Influence-based - People follow through positioning and persuasion';
  }
  
  // Low vector + high signal = supportive but lacks directional pull
  if (vector < 4.0 && signal > 6.0) {
    return 'Supportive but weak direction - People like them but unclear where to go';
  }
  
  if (resistancePattern) {
    return 'Mixed - Followership quality degrades when resistance emerges';
  }
  
  return 'Moderate - Followership depends on alignment and context';
}

/**
 * Assess relational collapse risk
 */
function assessRelationalCollapseRisk(vectorScores, stressPatterns, stallPatterns) {
  const signal = vectorScores.signal || 0;
  const flex = vectorScores.flex || 0;
  
  const relationalFriction = stallPatterns?.frustrations?.includes('relational') || false;
  const avoidanceAdmitted = stallPatterns?.avoidance_admitted || false;
  const stressNarrows = stressPatterns?.pattern_type === 'narrowing';
  
  // Low signal + stress narrows + relational frustration = high risk
  if (signal < 3.5 && stressNarrows && relationalFriction) {
    return 'High - Under pressure, relational awareness disappears; repairs relationships after damage done';
  }
  
  // Low signal + low flex = rigidity under relational resistance
  if (signal < 3.5 && flex < 3.5) {
    return 'Moderate-High - Limited relational bandwidth; resists adjusting when pushed back';
  }
  
  // High signal = resilient to relational pressure
  if (signal > 6.5) {
    return 'Low - Maintains relational calibration even under resistance';
  }
  
  if (avoidanceAdmitted && relationalFriction) {
    return 'Moderate - Aware of relational friction but avoids addressing until forced';
  }
  
  return 'Moderate - Relational strain emerges under sustained resistance';
}

/**
 * Assess control tendency
 */
function assessControlTendency(vectorScores, systemsAccountability, businessReality, stallPatterns) {
  const vector = vectorScores.vector || 0;
  const framework = vectorScores.framework || 0;
  const signal = vectorScores.signal || 0;
  
  const delegationGap = stallPatterns?.avoidance_patterns?.includes('delegation');
  const trustIssue = businessReality?.word_count > 150 && businessReality?.gap_awareness;
  
  // High vector + high framework + delegation gap = over-control
  if (vector > 6.5 && framework > 6.0 && delegationGap) {
    return 'High - Tends to over-control; struggles to trust others with execution standards';
  }
  
  // High vector + low signal = directive without calibration
  if (vector > 6.5 && signal < 3.5) {
    return 'Moderate-High - Commands direction without reading when to release control';
  }
  
  // Low vector = under-control risk
  if (vector < 3.5) {
    return 'Low - May under-direct; control too loose for accountability';
  }
  
  if (trustIssue) {
    return 'High - Explicitly acknowledges delegation struggles and trust gaps';
  }
  
  return 'Moderate - Control level varies by trust and stakes';
}

/**
 * Assess development capability
 */
function assessDevelopmentCapability(vectorScores, systemsAccountability, stallPatterns) {
  const signal = vectorScores.signal || 0;
  const horizon = vectorScores.horizon || 0;
  const framework = vectorScores.framework || 0;
  
  const relationalFriction = stallPatterns?.frustrations?.includes('relational');
  const avoidsDevelopment = stallPatterns?.avoidance_patterns?.includes('coaching') ||
                            stallPatterns?.avoidance_patterns?.includes('development');
  
  // High signal + high horizon = sees potential and invests
  if (signal > 6.0 && horizon > 6.0) {
    return 'High - Reads people dynamics and invests in long-term development';
  }
  
  // High signal, low horizon = supportive but no development depth
  if (signal > 6.0 && horizon < 4.0) {
    return 'Moderate - Supportive in moment but lacks long-term development thinking';
  }
  
  // Low signal = blind to development needs
  if (signal < 3.5) {
    return 'Low - Limited bandwidth for reading individual development needs';
  }
  
  // High framework + low signal = process-based development (training vs coaching)
  if (framework > 6.5 && signal < 4.0) {
    return 'Moderate - Develops through process/training, not personalized coaching';
  }
  
  if (avoidsDevelopment || relationalFriction) {
    return 'Low-Moderate - Development deprioritized under operational pressure';
  }
  
  return 'Moderate - Can develop others but inconsistent investment';
}

/**
 * Calculate aggregate confidence score
 */
function calculateConfidence(assessments) {
  // Confidence based on assessment specificity
  let confidence = 0.7; // base
  
  // Reduce confidence if many "moderate" assessments (ambiguous)
  const moderateCount = Object.values(assessments).filter(v => 
    typeof v === 'string' && v.toLowerCase().includes('moderate')
  ).length;
  
  if (moderateCount > 3) {
    confidence -= 0.1;
  }
  
  return Math.max(0.5, Math.min(1.0, confidence));
}

/**
 * Infer leadership readiness
 * 
 * @param {Object} vectorScores
 * @param {Object} leadershipArchitecture
 * @param {Object} communicationStyle
 * @param {Object} stressPatterns
 * @param {Object} analyzedResponses
 * @returns {Object} leadership_readiness
 */
export function inferLeadershipReadiness(
  vectorScores,
  leadershipArchitecture,
  communicationStyle,
  stressPatterns,
  analyzedResponses
) {
  const { stall_patterns, business_reality, systems_accountability } = analyzedResponses;
  
  const scale_capacity = assessScaleCapacity(vectorScores, leadershipArchitecture, systems_accountability, stall_patterns);
  const clarity_generation = assessClarityGeneration(vectorScores, communicationStyle, leadershipArchitecture);
  const followership_quality = assessFollowershipQuality(vectorScores, leadershipArchitecture, stall_patterns);
  const relational_collapse_risk = assessRelationalCollapseRisk(vectorScores, stressPatterns, stall_patterns);
  const control_tendency = assessControlTendency(vectorScores, systems_accountability, business_reality, stall_patterns);
  const development_capability = assessDevelopmentCapability(vectorScores, systems_accountability, stall_patterns);
  
  const assessments = {
    scale_capacity,
    clarity_generation,
    followership_quality,
    relational_collapse_risk,
    control_tendency,
    development_capability
  };
  
  const confidence = calculateConfidence(assessments);
  
  return {
    ...assessments,
    confidence
  };
}
