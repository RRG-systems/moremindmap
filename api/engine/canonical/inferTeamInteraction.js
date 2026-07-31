/**
 * inferTeamInteraction.js
 * 
 * How they show up in groups
 * Team dynamics and collaboration patterns
 */

export function inferTeamInteraction(vectorScores, analyzedResponses, communicationStyle) {
  const { stall_patterns, systems_accountability } = analyzedResponses;
  
  // Conflict mode
  let conflict_mode = 'Neutral - Standard conflict engagement';
  
  if (vectorScores.vector > 0.65 && vectorScores.signal < 0.40) {
    conflict_mode = 'Direct/Forceful - Addresses conflict head-on, may steamroll; low relational calibration';
  }
  
  if (vectorScores.signal > 0.60 && vectorScores.vector < 0.50) {
    conflict_mode = 'Accommodating - Reads tension and adjusts to de-escalate; may avoid necessary conflict';
  }
  
  if (vectorScores.framework > 0.65 && vectorScores.vector > 0.55) {
    conflict_mode = 'Process-mediated - Prefers to resolve conflict through structure and clear expectations';
  }
  
  if (stall_patterns?.frustrations?.includes('relational') && vectorScores.signal < 0.40) {
    conflict_mode = 'Avoidant until escalation - Ignores relational tension until forced to address';
  }
  
  // Collaboration style
  let collaboration_style = 'Standard team player';
  
  if (vectorScores.vector > 0.65 && vectorScores.leverage < 0.45) {
    collaboration_style = 'Directive collaborator - Sets direction, expects alignment; limited consensus-seeking';
  }
  
  if (vectorScores.signal > 0.60 && vectorScores.flex > 0.60) {
    collaboration_style = 'Adaptive collaborator - Reads team dynamics and adjusts approach fluidly';
  }
  
  if (vectorScores.framework > 0.65) {
    collaboration_style = 'Structured collaborator - Collaborates within defined process and roles';
  }
  
  if (vectorScores.vector < 0.40 && vectorScores.signal > 0.55) {
    collaboration_style = 'Supportive contributor - Adds value without driving direction';
  }
  
  // Feedback reception
  let feedback_reception = 'Mixed - Depends on delivery and source';
  
  if (systems_accountability?.coachability === 'no' || systems_accountability?.coachability === 'qualified') {
    feedback_reception = 'Defensive/Qualified - Intellectually receives but operationally resists';
  }
  
  if (vectorScores.flex > 0.65 && systems_accountability?.meta_awareness === 'high') {
    feedback_reception = 'Open - High adaptability supports feedback integration';
  }
  
  if (vectorScores.framework > 0.70 && vectorScores.flex < 0.40) {
    feedback_reception = 'Selective - Accepts feedback that aligns with framework, resists framework challenges';
  }
  
  // Trust building
  let trust_building = 'Standard relationship development';
  
  if (vectorScores.signal > 0.65) {
    trust_building = 'Relational - Builds trust through reading and responding to people dynamics';
  }
  
  if (vectorScores.fidelity > 0.65 && vectorScores.framework > 0.60) {
    trust_building = 'Competence-based - Builds trust through consistent delivery and reliability';
  }
  
  if (vectorScores.vector > 0.65 && vectorScores.signal < 0.40) {
    trust_building = 'Performance-based - Trust earned through results, not relational investment';
  }
  
  // Friction triggers
  const friction_triggers = [];
  
  if (vectorScores.velocity > 0.65) {
    friction_triggers.push('Slow decision-making or excessive deliberation');
  }
  
  if (vectorScores.fidelity > 0.65) {
    friction_triggers.push('Lack of attention to detail or quality shortcuts');
  }
  
  if (vectorScores.vector > 0.65 && vectorScores.signal < 0.40) {
    friction_triggers.push('Relationship-first cultures or consensus requirements');
  }
  
  if (vectorScores.framework > 0.65) {
    friction_triggers.push('Lack of process clarity or frequent pivots');
  }
  
  // Team value-add
  const team_value_add = [];
  
  if (vectorScores.vector > 0.60) {
    team_value_add.push('Direction-setting and decision clarity');
  }
  
  if (vectorScores.signal > 0.60) {
    team_value_add.push('Reading room dynamics and relational calibration');
  }
  
  if (vectorScores.fidelity > 0.60) {
    team_value_add.push('Quality assurance and error detection');
  }
  
  if (vectorScores.velocity > 0.60) {
    team_value_add.push('Execution speed and momentum');
  }
  
  if (vectorScores.horizon > 0.60) {
    team_value_add.push('Strategic thinking and long-range planning');
  }
  
  return {
    conflict_mode,
    collaboration_style,
    feedback_reception,
    trust_building,
    friction_triggers: (Array.isArray(friction_triggers) && friction_triggers.length > 0) ? friction_triggers : ['Standard team friction'],
    team_value_add: (Array.isArray(team_value_add) && team_value_add.length > 0) ? team_value_add : ['Balanced team contribution']
  };
}
