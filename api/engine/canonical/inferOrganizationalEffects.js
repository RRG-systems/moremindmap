/**
 * inferOrganizationalEffects.js
 * 
 * Model the culture, atmosphere, and systemic effects this person creates
 * What the organization becomes around them
 */

export function inferOrganizationalEffects(vectorScores, leadershipReadiness, analyzedResponses, hiddenRisks) {
  const { stall_patterns, business_reality } = analyzedResponses;
  
  // Culture unintentionally created
  let unintentional_culture = 'Standard organizational dynamics';
  
  if (vectorScores.vector > 6.5 && vectorScores.signal < 3.5) {
    unintentional_culture = 'Execution-first culture where speed is rewarded and challenge is interpreted as resistance; compliance becomes safer than contribution';
  }
  
  if (vectorScores.framework > 6.5 && vectorScores.flex < 4.0) {
    unintentional_culture = 'Process-adherence culture where following procedure is rewarded over problem-solving; innovation constrained by framework protection';
  }
  
  if (vectorScores.fidelity > 6.5 && vectorScores.velocity < 4.5) {
    unintentional_culture = 'Precision-focused culture where perfectionism masquerades as professionalism; risk aversion increases as standards become identity';
  }
  
  // Communication atmosphere
  let communication_atmosphere = 'Standard professional communication';
  
  if (vectorScores.vector > 6.5 && vectorScores.signal < 4.0) {
    communication_atmosphere = 'Directive and efficient; emotional context processed retrospectively; people learn to suppress concerns until asked directly';
  }
  
  if (vectorScores.signal > 6.5) {
    communication_atmosphere = 'Relationally calibrated; team feels heard but may experience decision ambiguity when consensus delays action';
  }
  
  if (vectorScores.framework > 6.5) {
    communication_atmosphere = 'Structured and procedural; informal communication decreases; relationship quality dependent on formal touchpoints';
  }
  
  // What subordinates stop saying
  const subordinates_stop_saying = [];
  
  if (vectorScores.vector > 6.5 && vectorScores.signal < 3.5 && stall_patterns?.frustrations?.includes('relational')) {
    subordinates_stop_saying.push('Early concerns about direction or approach - learn that speed is valued over deliberation');
    subordinates_stop_saying.push('Personal/emotional impacts of decisions - processed as irrelevant to execution');
  }
  
  if (vectorScores.fidelity > 6.5 && vectorScores.velocity < 4.5) {
    subordinates_stop_saying.push('Imperfect ideas or early-stage thinking - wait until fully formed to avoid critique');
  }
  
  if (leadershipReadiness?.control_tendency?.includes('High')) {
    subordinates_stop_saying.push('Alternative approaches once direction is set - defer to leader judgment');
  }
  
  // What teams become afraid to do
  const teams_become_afraid_to = [];
  
  if (vectorScores.vector > 6.5 && vectorScores.signal < 3.5) {
    teams_become_afraid_to.push('Challenge direction once momentum starts');
    teams_become_afraid_to.push('Slow down for relational processing');
  }
  
  if (vectorScores.fidelity > 6.5) {
    teams_become_afraid_to.push('Ship imperfect work even when iteration would improve it');
    teams_become_afraid_to.push('Experiment with approaches that might fail');
  }
  
  if (vectorScores.framework > 6.5 && vectorScores.flex < 4.0) {
    teams_become_afraid_to.push('Deviate from established process even when situation requires it');
  }
  
  // Where bottlenecks form
  const bottleneck_formation = [];
  
  if (vectorScores.vector > 6.5 && business_reality?.gap_awareness) {
    bottleneck_formation.push({
      location: 'Decision authority',
      mechanism: 'All significant decisions flow through single point; team waits for approval',
      emergence: '6-12 months as complexity increases'
    });
  }
  
  if (vectorScores.signal < 3.5 && business_reality?.leadership_scope) {
    bottleneck_formation.push({
      location: 'Relationship management',
      mechanism: 'Limited relational bandwidth cannot scale; client/team relationships become underserved',
      emergence: 'Already present, worsens at 2x scale'
    });
  }
  
  // Where hidden resentment accumulates
  const hidden_resentment = [];
  
  if (vectorScores.vector > 6.5 && vectorScores.signal < 3.5) {
    hidden_resentment.push({
      source: 'Feeling steamrolled or unheard',
      accumulation: 'Silent during execution, surfaces during exits or performance reviews',
      threshold: '12-18 months before visible departure or conflict'
    });
  }
  
  if (vectorScores.fidelity > 6.5 && vectorScores.velocity < 5.0) {
    hidden_resentment.push({
      source: 'Pace frustration - feels unnecessarily slow',
      accumulation: 'High-velocity team members tolerate initially, then leave for faster environments',
      threshold: '9-15 months'
    });
  }
  
  // Short-term vs long-term effects
  const short_term_effects = [];
  const long_term_effects = [];
  
  if (vectorScores.vector > 6.5 && vectorScores.velocity > 6.0) {
    short_term_effects.push('Team moves quickly under urgency; execution happens fast');
    long_term_effects.push('Independent thinking gradually decreases because speed becomes more rewarded than challenge; culture becomes execute-on-command');
  }
  
  if (vectorScores.fidelity > 6.5) {
    short_term_effects.push('Quality increases; errors caught before shipping');
    long_term_effects.push('Risk tolerance decreases; innovation slows as psychological safety narrows');
  }
  
  if (vectorScores.framework > 6.5 && vectorScores.flex < 4.0) {
    short_term_effects.push('Clear expectations and process reduce confusion');
    long_term_effects.push('Adaptability atrophies; organization responds slowly to market changes despite strong execution');
  }
  
  return {
    unintentional_culture,
    communication_atmosphere,
    subordinates_stop_saying: subordinates_stop_saying.length > 0 ? subordinates_stop_saying : ['Standard communication openness'],
    teams_become_afraid_to: teams_become_afraid_to.length > 0 ? teams_become_afraid_to : ['No unusual fear patterns detected'],
    bottleneck_formation,
    hidden_resentment,
    short_term_effects,
    long_term_effects
  };
}
