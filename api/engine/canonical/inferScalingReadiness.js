/**
 * inferScalingReadiness.js
 * 
 * Infrastructure and capacity for growth
 * Can they actually scale?
 */

export function inferScalingReadiness(vectorScores, analyzedResponses, leadershipReadiness) {
  const { systems_accountability, business_reality, growth_tension, stall_patterns } = analyzedResponses;
  
  // Systems maturity
  let systems_maturity = 'Emerging - Basic systems exist but inconsistent';
  
  if (systems_accountability?.systems_thinking === 'high' && systems_accountability?.system_confidence === 'high') {
    systems_maturity = 'Mature - Strong operational infrastructure supports scale';
  }
  
  if (systems_accountability?.systems_thinking === 'low' || systems_accountability?.system_confidence === 'low') {
    systems_maturity = 'Weak - Ad-hoc execution, limited systematic infrastructure';
  }
  
  // Delegation capacity
  let delegation_capacity = leadershipReadiness.control_tendency.includes('High')
    ? 'Low - Over-control limits delegation; trust gaps prevent release'
    : leadershipReadiness.control_tendency.includes('Moderate')
    ? 'Moderate - Can delegate but inconsistent; reverts to control under pressure'
    : 'High - Delegates effectively and maintains accountability';
  
  // Talent development
  let talent_development = leadershipReadiness.development_capability.includes('High')
    ? 'Strong - Invests in people development systematically'
    : leadershipReadiness.development_capability.includes('Low')
    ? 'Weak - Limited capacity for developing others'
    : 'Moderate - Supports people but inconsistent development investment';
  
  // Process thinking
  let process_thinking = (vectorScores.framework > 6.0 && vectorScores.fidelity > 5.5)
    ? 'Strong - Thinks in systems and processes naturally'
    : (vectorScores.framework < 4.0 || systems_accountability?.systems_thinking === 'low')
    ? 'Weak - Ad-hoc executor, process-averse'
    : 'Moderate - Can build process when needed';
  
  // Readiness score
  let readiness_score = 0.5;
  
  if (systems_maturity.includes('Mature')) readiness_score += 0.15;
  if (systems_maturity.includes('Weak')) readiness_score -= 0.15;
  
  if (delegation_capacity.includes('High')) readiness_score += 0.15;
  if (delegation_capacity.includes('Low')) readiness_score -= 0.2;
  
  if (talent_development.includes('Strong')) readiness_score += 0.1;
  if (talent_development.includes('Weak')) readiness_score -= 0.1;
  
  if (process_thinking.includes('Strong')) readiness_score += 0.1;
  if (process_thinking.includes('Weak')) readiness_score -= 0.1;
  
  readiness_score = Math.max(0.0, Math.min(1.0, readiness_score));
  
  return {
    systems_maturity,
    delegation_capacity,
    talent_development,
    process_thinking,
    readiness_score
  };
}
