/**
 * inferHiddenCosts.js
 * 
 * Invisible costs that compound silently
 * Emotional, organizational, relational, scaling, identity costs
 */

export function inferHiddenCosts(vectorScores, analyzedResponses, behavioralConsequences, organizationalEffects) {
  const costs = [];
  
  const { stall_patterns, systems_accountability, business_reality } = analyzedResponses;
  
  // Emotional costs
  if (vectorScores.vector > 6.5 && vectorScores.velocity > 6.5 && vectorScores.signal < 3.5) {
    costs.push({
      cost_category: 'Emotional compression',
      description: 'Speed creates clarity initially, but emotional compression delays conflict until stakes are higher; resolution becomes more expensive',
      visibility: 'Invisible until blowup',
      compounding: 'Exponential - each delayed conversation makes next one harder'
    });
  }
  
  // Organizational costs
  if (vectorScores.vector > 6.5 && business_reality?.gap_awareness) {
    costs.push({
      cost_category: 'Competence dependency',
      description: 'Competence becomes expensive because others unconsciously defer instead of developing; organizational capability concentrates rather than distributes',
      visibility: 'Becomes visible when leader tries to step back',
      compounding: 'Linear initially, then exponential as scale increases'
    });
  }
  
  // Relationship costs
  if (vectorScores.signal < 3.5 && stall_patterns?.frustrations?.includes('relational')) {
    costs.push({
      cost_category: 'Relational maintenance tax',
      description: 'Relationships require active repair rather than natural maintenance; time spent fixing what speed/directness damaged',
      visibility: 'Quarterly when turnover or conflict surfaces',
      compounding: 'Compounds with each relationship lost; replacement quality decreases'
    });
  }
  
  // Scaling costs
  if (systems_accountability?.system_confidence === 'low' && business_reality?.has_specific_metrics) {
    costs.push({
      cost_category: 'Systems debt at scale',
      description: 'Every scaling step without infrastructure creates technical debt; refactoring becomes more expensive than building correctly initially',
      visibility: 'Invisible early, catastrophic later',
      compounding: 'Exponential - 2x harder at each doubling'
    });
  }
  
  // Identity costs
  if (vectorScores.vector > 6.5 && vectorScores.signal < 4.0) {
    costs.push({
      cost_category: 'Self-reliance preservation cost',
      description: 'Self-reliance creates operational stability while simultaneously reducing collaborative resilience; when operator is unavailable, organization fragility surfaces',
      visibility: 'Hidden by continuous presence',
      compounding: 'Increases with tenure; succession becomes crisis rather than transition'
    });
  }
  
  // Psychological safety costs
  if (vectorScores.fidelity > 6.5 || (vectorScores.vector > 6.5 && vectorScores.signal < 4.0)) {
    costs.push({
      cost_category: 'Psychological safety erosion',
      description: 'High standards improve execution while slowly shrinking psychological safety; experimentation decreases invisibly',
      visibility: 'Becomes visible when innovation is needed and absent',
      compounding: 'Gradual then sudden - culture shift takes years to reverse'
    });
  }
  
  return costs;
}
