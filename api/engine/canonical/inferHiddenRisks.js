/**
 * inferHiddenRisks.js
 * 
 * Non-obvious failure modes
 * When strengths become liabilities
 */

export function inferHiddenRisks(vectorScores, stressPatterns, analyzedResponses, contradictions) {
  // Defensive normalization
  if (!Array.isArray(contradictions)) {
    contradictions = [];
  }
  const { stall_patterns, business_reality, systems_accountability } = analyzedResponses;
  
  // Strengths as liabilities
  const strengths_as_liabilities = [];
  
  if (vectorScores.vector > 6.5 && vectorScores.signal < 4.0) {
    strengths_as_liabilities.push('High command becomes steamrolling - speed advantage creates relationship damage');
  }
  
  if (vectorScores.fidelity > 6.5 && vectorScores.velocity < 4.0) {
    strengths_as_liabilities.push('High precision becomes perfectionism - quality advantage creates speed liability');
  }
  
  if (vectorScores.framework > 6.5 && vectorScores.flex < 4.0) {
    strengths_as_liabilities.push('Strong process becomes rigidity - structure advantage limits adaptive capacity');
  }
  
  if (vectorScores.horizon > 6.5 && vectorScores.velocity < 4.5) {
    strengths_as_liabilities.push('Strategic thinking becomes analysis paralysis - vision advantage delays execution');
  }
  
  // Relational erosion risk
  let relational_erosion_risk = 'Low - Relational dynamics stable';
  
  if (vectorScores.signal < 3.5 && stall_patterns?.frustrations?.includes('relational')) {
    relational_erosion_risk = 'High - Current relational friction will compound; relationship damage accumulates invisibly until sudden departure/conflict';
  }
  
  if (vectorScores.signal < 4.0 && stressPatterns?.pattern_type === 'narrowing') {
    relational_erosion_risk = 'Moderate-High - Under stress, relational awareness disappears; damage done without awareness';
  }
  
  // Strategic drift risk
  let strategic_drift_risk = 'Low - Direction stable';
  
  if (vectorScores.horizon < 4.0 && vectorScores.velocity > 6.5) {
    strategic_drift_risk = 'High - High execution speed without strategic anchoring creates drift; busy but off course';
  }
  
  if (vectorScores.vector > 6.5 && vectorScores.horizon < 4.5) {
    strategic_drift_risk = 'Moderate - Strong direction but limited long-range thinking; may execute toward wrong target';
  }
  
  // Execution inconsistency
  let execution_inconsistency = 'Low - Execution reliable';
  
  if (systems_accountability?.system_confidence === 'low' && stall_patterns?.avoidance_admitted) {
    execution_inconsistency = 'High - Weak systems + avoidance patterns = inconsistent follow-through on known priorities';
  }
  
  if (contradictions.some(c => false && c.type === 'knowledge_execution_gap')) {
    execution_inconsistency = 'Moderate-High - Knows what to do but does not do it consistently';
  }
  
  // Burnout trajectory
  let burnout_trajectory = 'Low risk - sustainable pace';
  
  if (vectorScores.vector > 6.5 && vectorScores.velocity > 6.5 && business_reality?.word_count > 150) {
    burnout_trajectory = 'Moderate-High - High drive + high speed + significant business complexity = burnout risk within 12-18 months without intervention';
  }
  
  if (stall_patterns?.frustrations?.includes('relational') && vectorScores.signal < 3.5) {
    burnout_trajectory = 'Moderate - Relational friction drains energy; isolation increases over time';
  }
  
  // Isolation pattern
  let isolation_pattern = 'Low - Operates collaboratively';
  
  if (vectorScores.signal < 3.5 && vectorScores.vector > 6.5) {
    isolation_pattern = 'High - Tends to operate alone; relational friction pushes toward solo execution';
  }
  
  if (stall_patterns?.attention_direction === 'execution_gaps' && systems_accountability?.accountability_structure === 'none') {
    isolation_pattern = 'Moderate-High - Limited external connection creates operational isolation';
  }
  
  // Calculate severity score
  let severity = 0.3;
  
  if (typeof relational_erosion_risk === 'string' && relational_erosion_risk.includes('High')) severity += 0.2;
  if (typeof burnout_trajectory === 'string' && burnout_trajectory.includes('High')) severity += 0.2;
  if (typeof execution_inconsistency === 'string' && execution_inconsistency.includes('High')) severity += 0.15;
  if (typeof strategic_drift_risk === 'string' && strategic_drift_risk.includes('High')) severity += 0.15;
  
  severity = Math.min(1.0, severity);
  
  return {
    strengths_as_liabilities: (Array.isArray(strengths_as_liabilities) && strengths_as_liabilities.length > 0) ? strengths_as_liabilities : ['Strengths remain assets at current scale'],
    relational_erosion_risk,
    strategic_drift_risk,
    execution_inconsistency,
    burnout_trajectory,
    isolation_pattern,
    severity
  };
}
