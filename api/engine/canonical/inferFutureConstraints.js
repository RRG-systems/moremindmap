/**
 * inferFutureConstraints.js
 * 
 * Predict scaling bottlenecks before they happen
 */

export function inferFutureConstraints(vectorScores, analyzedResponses, contradictions) {
  const { business_reality, growth_tension, systems_accountability, stall_patterns } = analyzedResponses;
  
  const at_2x_scale = [];
  const at_5x_scale = [];
  
  // Delegation bottleneck
  if (vectorScores.vector > 6.5 && (systems_accountability?.system_confidence === 'low' || stall_patterns?.avoidance_admitted)) {
    at_2x_scale.push('Delegation bottleneck - Will try to maintain control, become execution ceiling');
  }
  
  // Systems immaturity
  if (systems_accountability?.systems_thinking === 'low' || systems_accountability?.systems_thinking === 'moderate') {
    at_2x_scale.push('Systems infrastructure - Current processes insufficient for 2x complexity');
    at_5x_scale.push('Operational chaos - Ad-hoc systems collapse under 5x load');
  }
  
  // Relational bandwidth
  if (vectorScores.signal < 4.0) {
    at_2x_scale.push('Relational bandwidth - Limited capacity for relationship management at scale');
    at_5x_scale.push('Team fragmentation - Relationship gaps create organizational silos');
  }
  
  // Decision overload
  if (vectorScores.vector > 6.5 && vectorScores.leverage < 4.0) {
    at_5x_scale.push('Decision bottleneck - All decisions flow through single point, creates delays');
  }
  
  // Strategic drift
  if (vectorScores.horizon < 4.5 && vectorScores.velocity > 6.0) {
    at_5x_scale.push('Strategic drift - High execution speed without long-range thinking loses direction');
  }
  
  const stress_amplification = contradictions.length > 2
    ? 'High - Multiple internal contradictions will amplify under scaling pressure'
    : 'Moderate - Some tensions will surface but manageable with awareness';
  
  const operational_fragility = (systems_accountability?.system_confidence === 'low')
    ? 'High - Weak systems create fragile operations dependent on key people'
    : 'Moderate - Some operational dependencies exist';
  
  const relational_fragility = (vectorScores.signal < 3.5 && stall_patterns?.frustrations?.includes('relational'))
    ? 'High - Relational friction already present, will compound at scale'
    : 'Low-Moderate - Relational dynamics stable';
  
  const decision_overload_risk = (vectorScores.vector > 6.5 && business_reality?.gap_awareness)
    ? 'High - Centralized decision-making will become bottleneck'
    : 'Moderate - Some decision distribution exists';
  
  const scaling_resistance_pattern = (growth_tension?.scaling_response === 'resistance')
    ? 'Emotional resistance to scale suggests internal ceiling below stated ambition'
    : (growth_tension?.scaling_response === 'positive' && systems_accountability?.system_confidence === 'low')
    ? 'Ambition present but infrastructure missing - will hit execution wall'
    : 'Scaling resistance moderate, addressable with systems';
  
  return {
    at_2x_scale: at_2x_scale.length > 0 ? at_2x_scale : ['Minimal immediate constraints'],
    at_5x_scale: at_5x_scale.length > 0 ? at_5x_scale : ['Standard scaling challenges'],
    stress_amplification,
    operational_fragility,
    relational_fragility,
    decision_overload_risk,
    scaling_resistance_pattern
  };
}
