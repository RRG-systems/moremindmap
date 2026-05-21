/**
 * inferExecutionIdentity.js
 * 
 * How they actually operate vs how they think they operate
 * Reality check on self-perception
 */

export function inferExecutionIdentity(vectorScores, analyzedResponses, contradictions) {
  const { stall_patterns, systems_accountability, life_direction, business_reality } = analyzedResponses;
  
  // True default (what actually happens under pressure)
  let true_default = 'Execution-focused operator';
  
  if (vectorScores.vector > 6.5 && vectorScores.velocity > 6.0) {
    true_default = 'High-speed executor - Defaults to action over deliberation, moves before consensus';
  }
  
  if (vectorScores.framework > 6.5 && vectorScores.fidelity > 6.0) {
    true_default = 'Process-driven executor - Defaults to structured execution within defined systems';
  }
  
  if (vectorScores.horizon > 6.5 && vectorScores.vector < 5.0) {
    true_default = 'Strategic thinker - Defaults to planning and analysis before execution';
  }
  
  if (vectorScores.signal > 6.0 && vectorScores.vector > 5.5) {
    true_default = 'Relational operator - Defaults to reading dynamics before acting';
  }
  
  // Claimed identity (how they describe themselves)
  let claimed_identity = 'Self-description unavailable from data';
  
  // Infer claims from life direction values
  if (life_direction?.stated_priorities?.includes('family') && life_direction?.stated_priorities?.includes('freedom')) {
    claimed_identity = 'Claims to value balance, family, and freedom';
  }
  
  if (systems_accountability?.coachability === 'claimed_yes') {
    claimed_identity += ', Claims coachability and openness to feedback';
  }
  
  // Identity gap
  let identity_gap = 'Minimal - Self-perception aligned with behavior';
  
  // Family/balance claim but business-obsessed
  if (life_direction?.stated_priorities?.includes('family') && 
      business_reality?.word_count > 150 && 
      stall_patterns?.attention_direction === 'execution_gaps') {
    identity_gap = 'Moderate-High - Claims family/balance but operational reality shows work dominance';
  }
  
  // Coachability claim but resistance signals
  if (contradictions.some(c => c.type === 'coachability_resistance_pattern')) {
    identity_gap = 'Moderate - Claims coachability but behavioral evidence shows resistance';
  }
  
  // Knowledge-execution gap
  if (contradictions.some(c => c.type === 'knowledge_execution_gap')) {
    identity_gap = 'High - Self-aware of gaps but behavior does not change (knows vs does)';
  }
  
  // Operational truth
  let operational_truth = 'Standard operational baseline';
  
  if (vectorScores.vector > 6.5 && vectorScores.signal < 3.5 && stall_patterns?.frustrations?.includes('relational')) {
    operational_truth = 'Operates as high-control, low-relational-bandwidth executor despite claims of collaboration';
  }
  
  if (systems_accountability?.system_confidence === 'low' && stall_patterns?.avoidance_admitted) {
    operational_truth = 'Operates ad-hoc despite strategic ambitions; avoids building infrastructure';
  }
  
  if (vectorScores.velocity > 6.5 && systems_accountability?.systems_thinking === 'low') {
    operational_truth = 'Operates in firefighting mode; speed compensates for lack of systems';
  }
  
  return {
    true_default,
    claimed_identity,
    identity_gap,
    operational_truth
  };
}
