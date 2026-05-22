/**
 * inferRoleFit.js
 * 
 * Natural role alignment analysis
 * Infers where this person naturally fits vs creates friction
 */

export function inferRoleFit(vectorScores, analyzedResponses) {
  const { business_reality, growth_tension, stall_patterns } = analyzedResponses;
  
  const vector = vectorScores.vector || 0;
  const horizon = vectorScores.horizon || 0;
  const framework = vectorScores.framework || 0;
  const velocity = vectorScores.velocity || 0;
  const fidelity = vectorScores.fidelity || 0;
  const flex = vectorScores.flex || 0;
  
  //Builder vs Optimizer
  const builder_vs_optimizer = (vector > 6.0 && horizon > 6.0) 
    ? 'Builder - Creates new structures and drives new territory'
    : (framework > 6.5 && fidelity > 6.0)
    ? 'Optimizer - Refines existing systems and improves precision'
    : 'Hybrid - Can build or optimize depending on context';
  
  // Operator vs Visionary
  const operator_vs_visionary = (vector > 6.0 && velocity > 6.0 && horizon < 5.0)
    ? 'Operator - Executes today, limited long-range thinking'
    : (horizon > 6.5 && vector < 5.0)
    ? 'Visionary - Thinks future-state, execution may lag'
    : 'Balanced - Can operate and envision';
  
  // Manager vs Producer
  const hasTeam = business_reality?.leadership_scope !== null;
  const manager_vs_producer = hasTeam && vector > 5.5
    ? 'Manager - Leads through others'
    : 'Producer - Personal production primary';
  
  // Explorer vs Stabilizer
  const explorer_vs_stabilizer = (flex > 6.0 && horizon > 6.0)
    ? 'Explorer - Thrives in ambiguity and new territory'
    : (framework > 6.5 && fidelity > 6.0)
    ? 'Stabilizer - Consolidates and creates predictability'
    : 'Pragmatic - Explores when needed, stabilizes when required';
  
  // Executor vs Strategist
  const executor_vs_strategist = (vector > 6.5 && velocity > 6.0)
    ? 'Executor - Does > plans'
    : (horizon > 6.5 && framework > 6.0)
    ? 'Strategist - Plans > does'
    : 'Balanced executor-strategist';
  
  // Ambiguity tolerance
  const ambiguity_tolerance = (flex > 6.0 && framework < 5.0)
    ? 'High - Thrives in chaos and unclear situations'
    : (framework > 6.5 && flex < 4.0)
    ? 'Low - Needs clear structure and defined process'
    : 'Moderate - Can handle ambiguity with boundaries';
  
  // Natural roles
  const natural_roles = [];
  if (vector > 6.5 && horizon > 6.0) natural_roles.push('Founder/CEO');
  if (vector > 6.5 && velocity > 6.5) natural_roles.push('COO/Operator');
  if (framework > 6.5 && fidelity > 6.0) natural_roles.push('Operations Lead');
  if (horizon > 6.5 && vectorScores.leverage > 6.0) natural_roles.push('Strategic Advisor');
  if (vectorScores.signal > 6.5 && vector > 5.0) natural_roles.push('VP Sales/Customer Success');
  if (fidelity > 6.5 && framework > 6.0) natural_roles.push('Quality/Compliance Lead');
  
  // Friction roles
  const friction_roles = [];
  if (vector < 3.5) friction_roles.push('Executive Leadership');
  if (vectorScores.signal < 3.5) friction_roles.push('Client-Facing/Relationship Management');
  if (framework < 3.5 && velocity < 4.0) friction_roles.push('Process Management');
  if (horizon < 3.5) friction_roles.push('Strategy/Long-Term Planning');
  if (flex < 3.5) friction_roles.push('Startup/High Ambiguity Roles');
  
  return {
    builder_vs_optimizer,
    operator_vs_visionary,
    manager_vs_producer,
    explorer_vs_stabilizer,
    executor_vs_strategist,
    ambiguity_tolerance,
    natural_roles: (Array.isArray(natural_roles) && natural_roles.length > 0) ? natural_roles : ['Needs dimension refinement for specific role fit'],
    friction_roles: (Array.isArray(friction_roles) && friction_roles.length > 0) ? friction_roles : ['Broad role flexibility']
  };
}
