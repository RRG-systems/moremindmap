/**
 * inferEvidenceMap.js
 * 
 * Evidence trace system for canonical inferences
 * Shows not just WHAT we infer, but WHY
 * 
 * Each major inference includes:
 * - source_question_ids
 * - direct_evidence
 * - inferred_evidence
 * - confidence
 * - contradiction_support
 * - risk_of_overread
 */

/**
 * Create evidence entry for an inference
 */
function createEvidenceEntry(options) {
  return {
    inference: options.inference,
    source_questions: options.source_questions || [],
    direct_evidence: options.direct_evidence || [],
    inferred_evidence: options.inferred_evidence || [],
    dimension_support: options.dimension_support || {},
    contradiction_support: options.contradiction_support || [],
    confidence: options.confidence || 0.5,
    risk_of_overread: options.risk_of_overread || 'moderate',
    alternative_explanations: options.alternative_explanations || []
  };
}

/**
 * Map evidence for delegation resistance
 */
function mapDelegationEvidence(analyzedResponses, vectorScores, contradictions) {
  const { stall_patterns, business_reality, systems_accountability } = analyzedResponses;
  
  const direct_evidence = [];
  const source_questions = [];
  
  if (stall_patterns?.avoidance_patterns?.includes('delegation')) {
    direct_evidence.push('Q24: Explicitly states delegation underperformance');
    source_questions.push('Q24');
  }
  
  if (business_reality?.gap_awareness) {
    direct_evidence.push('Q26: "I still try to do too much myself" or similar language');
    source_questions.push('Q26');
  }
  
  if (systems_accountability?.coachability === 'qualified') {
    direct_evidence.push('Q28: Qualified coachability suggests resistance to changing approach');
    source_questions.push('Q28');
  }
  
  const dimension_support = {};
  if (vectorScores.vector > 6.5) {
    dimension_support.vector = `High (${vectorScores.vector.toFixed(1)}) - Control tendency from command preference`;
  }
  
  const contradiction_support = contradictions
    .filter(c => false && c.type === 'knowledge_execution_gap' || false && c.type === 'delegation_control_paradox')
    .map(c => c.type);
  
  let confidence = 0.5;
  if (direct_evidence.length >= 2) confidence = 0.8;
  if (direct_evidence.length >= 3 && dimension_support.vector) confidence = 0.9;
  
  return createEvidenceEntry({
    inference: 'delegation_resistance',
    source_questions,
    direct_evidence,
    inferred_evidence: ['High vector score combined with trust gap language'],
    dimension_support,
    contradiction_support,
    confidence,
    risk_of_overread: direct_evidence.length < 2 ? 'moderate-high' : 'low',
    alternative_explanations: ['Could be environmental (bad prior delegation experiences)', 'Could be temporary phase during scaling']
  });
}

/**
 * Map evidence for relational friction
 */
function mapRelationalFrictionEvidence(analyzedResponses, vectorScores, contradictions) {
  const { stall_patterns } = analyzedResponses;
  
  const direct_evidence = [];
  const source_questions = [];
  
  if (stall_patterns?.frustrations?.includes('relational')) {
    direct_evidence.push('Q24: Relational friction explicitly mentioned as frustration');
    source_questions.push('Q24');
  }
  
  if (stall_patterns?.attention_direction === 'people_problems') {
    direct_evidence.push('Q24: Attention goes to people issues when stalled');
    source_questions.push('Q24');
  }
  
  const dimension_support = {};
  if (vectorScores.signal < 3.5) {
    dimension_support.signal = `Low (${vectorScores.signal.toFixed(1)}) - Limited relational awareness capacity`;
  }
  if (vectorScores.vector > 6.5) {
    dimension_support.vector = `High (${vectorScores.vector.toFixed(1)}) - Directive tendency may bypass calibration`;
  }
  
  let confidence = 0.5;
  if (direct_evidence.length >= 1 && dimension_support.signal) confidence = 0.8;
  if (contradictions.some(c => c.tension && typeof c.tension === 'string' && c.tension.toLowerCase().includes('relational'))) confidence = 0.85;
  
  return createEvidenceEntry({
    inference: 'relational_friction_pattern',
    source_questions,
    direct_evidence,
    inferred_evidence: ['Low signal dimension combined with relational frustration language'],
    dimension_support,
    contradiction_support: contradictions.filter(c => c.tension && typeof c.tension === 'string' && c.tension.toLowerCase().includes('relational')).map(c => c.tension),
    confidence,
    risk_of_overread: 'low',
    alternative_explanations: ['Team composition mismatch', 'Cultural environment factor']
  });
}

/**
 * Map evidence for systems weakness
 */
function mapSystemsWeaknessEvidence(analyzedResponses, vectorScores) {
  const { systems_accountability, business_reality } = analyzedResponses;
  
  const direct_evidence = [];
  const source_questions = [];
  
  if (systems_accountability?.system_confidence === 'low') {
    direct_evidence.push('Q28: Explicitly states systems are not strong enough');
    source_questions.push('Q28');
  }
  
  if (systems_accountability?.systems_thinking === 'low') {
    direct_evidence.push('Q28: Limited systems language or ad-hoc execution described');
    source_questions.push('Q28');
  }
  
  if (business_reality?.gap_awareness && business_reality?.has_specific_metrics) {
    direct_evidence.push('Q26: Acknowledges infrastructure gaps or execution inconsistency');
    source_questions.push('Q26');
  }
  
  const dimension_support = {};
  if (vectorScores.framework < 4.5) {
    dimension_support.framework = `Low-Moderate (${vectorScores.framework.toFixed(1)}) - Limited process orientation`;
  }
  if (vectorScores.velocity > 6.5) {
    dimension_support.velocity = `High (${vectorScores.velocity.toFixed(1)}) - Speed may bypass systems building`;
  }
  
  let confidence = direct_evidence.length >= 2 ? 0.85 : 0.6;
  
  return createEvidenceEntry({
    inference: 'systems_infrastructure_weakness',
    source_questions,
    direct_evidence,
    inferred_evidence: ['Low framework dimension + high velocity = systems deprioritized'],
    dimension_support,
    confidence,
    risk_of_overread: 'low',
    alternative_explanations: ['Rapid growth phase legitimately delays infrastructure', 'Systems exist but not articulated in answers']
  });
}

/**
 * Generate complete evidence map
 */
export function inferEvidenceMap(
  vectorScores,
  analyzedResponses,
  contradictions,
  inferences
) {
  const evidence_map = {
    delegation_resistance: mapDelegationEvidence(analyzedResponses, vectorScores, contradictions),
    relational_friction: mapRelationalFrictionEvidence(analyzedResponses, vectorScores, contradictions),
    systems_weakness: mapSystemsWeaknessEvidence(analyzedResponses, vectorScores)
  };
  
  // Calculate aggregate confidence
  const confidences = Object.values(evidence_map).map(e => e.confidence);
  const aggregate_confidence = confidences.length > 0
    ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
    : 0.5;
  
  return {
    evidence_entries: evidence_map,
    aggregate_confidence,
    total_evidence_sources: new Set(
      Object.values(evidence_map).flatMap(e => e.source_questions)
    ).size,
    high_confidence_inferences: Object.entries(evidence_map)
      .filter(([, e]) => e.confidence >= 0.8)
      .map(([key]) => key),
    low_confidence_inferences: Object.entries(evidence_map)
      .filter(([, e]) => e.confidence < 0.6)
      .map(([key]) => key)
  };
}
