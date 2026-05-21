/**
 * inferStrategicCeiling.js
 * 
 * Long-term growth limits
 * Where they'll hit the wall and why
 */

export function inferStrategicCeiling(vectorScores, analyzedResponses, contradictions, futureConstraints) {
  const { business_reality, growth_tension, systems_accountability, stall_patterns } = analyzedResponses;
  
  // Current ceiling assessment
  let current_ceiling = 'No immediate ceiling visible';
  
  // Delegation ceiling
  if (vectorScores.vector > 6.5 && (stall_patterns?.avoidance_patterns?.includes('delegation') || business_reality?.gap_awareness)) {
    current_ceiling = 'Personal execution capacity - Cannot scale without delegation, currently trying to control too much';
  }
  
  // Systems ceiling
  if (systems_accountability?.system_confidence === 'low' && business_reality?.has_specific_metrics) {
    current_ceiling = 'Infrastructure maturity - Goals exceed operational systems; hitting execution ceiling now';
  }
  
  // Leadership ceiling
  if (vectorScores.signal < 3.5 && business_reality?.leadership_scope) {
    current_ceiling = 'Leadership bandwidth - Relational limitations constrain team effectiveness';
  }
  
  // Strategic ceiling
  if (vectorScores.horizon < 4.0 && vectorScores.velocity > 6.5) {
    current_ceiling = 'Strategic vision - High execution without long-range thinking creates direction uncertainty at scale';
  }
  
  // Ceiling cause
  let ceiling_cause = 'Standard growth challenges';
  
  if (current_ceiling.includes('delegation')) {
    ceiling_cause = 'Control tendency + trust gaps prevent delegation; becomes bottleneck';
  }
  
  if (current_ceiling.includes('Infrastructure')) {
    ceiling_cause = 'Ad-hoc execution + avoidance of systems building = operational fragility';
  }
  
  if (current_ceiling.includes('Leadership')) {
    ceiling_cause = 'Low relational awareness limits ability to scale through people';
  }
  
  if (current_ceiling.includes('Strategic')) {
    ceiling_cause = 'Execution focus without strategic scaffolding loses direction at complexity';
  }
  
  // Breakthrough requirement
  let breakthrough_requirement = 'Continue current trajectory';
  
  if (current_ceiling.includes('delegation')) {
    breakthrough_requirement = 'Redefine "good enough" explicitly; build trust through systems, not oversight';
  }
  
  if (current_ceiling.includes('Infrastructure')) {
    breakthrough_requirement = 'Pause growth to build systems; accept short-term speed loss for long-term capacity';
  }
  
  if (current_ceiling.includes('Leadership')) {
    breakthrough_requirement = 'Develop relational awareness actively; invest in people dynamics training';
  }
  
  if (current_ceiling.includes('Strategic')) {
    breakthrough_requirement = 'Add strategic planning discipline; slow execution to ensure direction';
  }
  
  // Ceiling proximity (0.0 = far, 1.0 = at ceiling now)
  let ceiling_proximity = 0.3;
  
  if (contradictions.length > 2) ceiling_proximity += 0.2;
  if (systems_accountability?.system_confidence === 'low') ceiling_proximity += 0.2;
  if (stall_patterns?.avoidance_admitted) ceiling_proximity += 0.15;
  if (futureConstraints?.at_2x_scale?.length > 2) ceiling_proximity += 0.15;
  
  ceiling_proximity = Math.min(1.0, ceiling_proximity);
  
  return {
    current_ceiling,
    ceiling_cause,
    breakthrough_requirement,
    ceiling_proximity
  };
}
