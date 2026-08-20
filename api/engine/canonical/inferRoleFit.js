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
  const builder_vs_optimizer = (vector > 0.60 && horizon > 0.60)
    ? 'Builder - Creates new structures and drives new territory'
    : (framework > 0.65 && fidelity > 0.60)
    ? 'Optimizer - Refines existing systems and improves precision'
    : 'Hybrid - Can build or optimize depending on context';
  
  // Operator vs Visionary
  const operator_vs_visionary = (vector > 0.60 && velocity > 0.60 && horizon < 0.50)
    ? 'Operator - Executes today, limited long-range thinking'
    : (horizon > 0.65 && vector < 0.50)
    ? 'Visionary - Thinks future-state, execution may lag'
    : 'Balanced - Can operate and envision';
  
  // Manager vs Producer
  const hasTeam = business_reality?.leadership_scope !== null;
  const manager_vs_producer = hasTeam && vector > 0.55
    ? 'Manager - Leads through others'
    : 'Producer - Personal production primary';
  
  // Explorer vs Stabilizer
  const explorer_vs_stabilizer = (flex > 0.60 && horizon > 0.60)
    ? 'Explorer - Thrives in ambiguity and new territory'
    : (framework > 0.65 && fidelity > 0.60)
    ? 'Stabilizer - Consolidates and creates predictability'
    : 'Pragmatic - Explores when needed, stabilizes when required';
  
  // Executor vs Strategist
  const executor_vs_strategist = (vector > 0.65 && velocity > 0.60)
    ? 'Executor - Does > plans'
    : (horizon > 0.65 && framework > 0.60)
    ? 'Strategist - Plans > does'
    : 'Balanced executor-strategist';
  
  // Ambiguity tolerance
  const ambiguity_tolerance = (flex > 0.60 && framework < 0.50)
    ? 'High - Thrives in chaos and unclear situations'
    : (framework > 0.65 && flex < 0.40)
    ? 'Low - Needs clear structure and defined process'
    : 'Moderate - Can handle ambiguity with boundaries';
  
  // Natural roles
  const natural_roles = [];
  if (vector > 0.65 && horizon > 0.60) natural_roles.push('Founder/CEO');
  if (vector > 0.65 && velocity > 0.65) natural_roles.push('COO/Operator');
  if (framework > 0.65 && fidelity > 0.60) natural_roles.push('Operations Lead');
  if (horizon > 0.65 && vectorScores.leverage > 0.60) natural_roles.push('Strategic Advisor');
  if (vectorScores.signal > 0.65 && vector > 0.50) natural_roles.push('VP Sales/Customer Success');
  if (fidelity > 0.65 && framework > 0.60) natural_roles.push('Quality/Compliance Lead');
  
  // Friction roles
  const friction_roles = [];
  if (vector < 0.35) friction_roles.push('Executive Leadership');
  if (vectorScores.signal < 0.35) friction_roles.push('Client-Facing/Relationship Management');
  if (framework < 0.35 && velocity < 0.40) friction_roles.push('Process Management');
  if (horizon < 0.35) friction_roles.push('Strategy/Long-Term Planning');
  if (flex < 0.35) friction_roles.push('Startup/High Ambiguity Roles');
  
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
