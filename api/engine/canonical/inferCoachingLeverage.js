/**
 * inferCoachingLeverage.js
 * 
 * Identify highest-ROI development areas
 * Smallest changes with biggest downstream impact
 */

export function inferCoachingLeverage(vectorScores, contradictions, analyzedResponses, leadershipArchitecture) {
  // Defensive normalization
  if (!Array.isArray(contradictions)) {
    contradictions = [];
  }
  const { systems_accountability, stall_patterns, growth_tension } = analyzedResponses;
  
  // Highest ROI adjustment - identify the single biggest lever
  let highest_roi_adjustment = 'Build explicit accountability structure - highest leverage for execution consistency';
  
  // If coachability resistance + systems weak = accountability is the lever
  if (systems_accountability?.coachability === 'qualified' && systems_accountability?.system_confidence === 'low') {
    highest_roi_adjustment = 'External accountability structure - bridges gap between knowing and doing';
  }
  
  // If delegation gap exists = trust/standards recalibration
  if (stall_patterns?.avoidance_patterns?.includes('delegation') || stall_patterns?.attention_direction === 'execution_gaps') {
    highest_roi_adjustment = 'Delegation standards recalibration - define "good enough" explicitly to release control';
  }
  
  // If relational friction high = signal development
  if (vectorScores.signal < 3.5 && stall_patterns?.frustrations?.includes('relational')) {
    highest_roi_adjustment = 'Relational timing awareness - pause before directing to read room dynamics';
  }
  
  // Invisible drag habits - unseen friction sources
  const invisible_drag_habits = [];
  
  if (vectorScores.velocity > 6.5 && vectorScores.fidelity < 4.0) {
    invisible_drag_habits.push('Speed over verification - creates rework cycles that slow overall progress');
  }
  
  if (vectorScores.vector > 6.5 && vectorScores.signal < 4.0) {
    invisible_drag_habits.push('Direction without calibration - team confusion creates execution drag');
  }
  
  if (systems_accountability?.systems_thinking === 'low' && growth_tension?.scaling_response === 'positive') {
    invisible_drag_habits.push('Ad-hoc execution at scale - lack of systems creates invisible time drain');
  }
  
  if (stall_patterns?.avoidance_admitted) {
    invisible_drag_habits.push('Avoidance patterns compound - delayed action creates larger problems later');
  }
  
  // Resistance likelihood
  const coachability = systems_accountability?.coachability || 'unknown';
  let resistance_likelihood = 'Moderate - Will engage but may revert to defaults under pressure';
  
  if (coachability === 'no' || coachability === 'qualified') {
    resistance_likelihood = 'High - Intellectually open but operationally resistant to framework changes';
  }
  
  if (coachability === 'claimed_yes' && Array.isArray(contradictions) && contradictions.length > 2) {
    resistance_likelihood = 'Moderate-High - Claims coachability but multiple contradictions suggest behavioral inertia';
  }
  
  if (vectorScores.flex > 6.0 && systems_accountability?.meta_awareness === 'high') {
    resistance_likelihood = 'Low-Moderate - High adaptability and self-awareness support behavioral change';
  }
  
  // Accountability dependency
  let accountability_dependency = 'Moderate - Benefits from external structure but can self-regulate';
  
  if (systems_accountability?.accountability_structure === 'none' && stall_patterns?.avoidance_admitted) {
    accountability_dependency = 'High - Requires external accountability to bridge knowledge-execution gap';
  }
  
  if (vectorScores.framework > 7.0 && vectorScores.fidelity > 6.5) {
    accountability_dependency = 'Low - Self-accountable through internal standards and process';
  }
  
  // Quick wins (30-90 days)
  const quick_wins = [];
  
  if (systems_accountability?.system_confidence === 'low') {
    quick_wins.push('Weekly pipeline review ritual - immediate execution consistency improvement');
  }
  
  if (vectorScores.signal < 4.0 && stall_patterns?.frustrations?.includes('relational')) {
    quick_wins.push('Pre-directive pause - count to 3 before issuing direction, read room first');
  }
  
  if (stall_patterns?.avoidance_patterns?.includes('firing') || stall_patterns?.avoidance_patterns?.includes('accountability')) {
    quick_wins.push('30-day performance checkpoint - address underperformance faster');
  }
  
  // Long-term work (6-24 months)
  const long_term_work = [];
  
  if (vectorScores.signal < 4.0) {
    long_term_work.push('Relational awareness development - sustained practice in reading team dynamics');
  }
  
  if (systems_accountability?.systems_thinking === 'low') {
    long_term_work.push('Systems thinking capacity - building infrastructure vs firefighting');
  }
  
  if (Array.isArray(contradictions) && contradictions.some(c => c && c.type === 'coachability_resistance_pattern')) {
    long_term_work.push('Framework flexibility - learning when to adapt vs enforce standards');
  }
  
  if (growth_tension?.scaling_response === 'resistance' || growth_tension?.scaling_response === 'ceiling') {
    long_term_work.push('Scaling mindset shift - emotional capacity for complexity and delegation');
  }
  
  return {
    highest_roi_adjustment,
    invisible_drag_habits: (Array.isArray(invisible_drag_habits) && invisible_drag_habits.length > 0) ? invisible_drag_habits : ['No major invisible drag detected'],
    resistance_likelihood,
    accountability_dependency,
    quick_wins: (Array.isArray(quick_wins) && quick_wins.length > 0) ? quick_wins : ['Baseline performance stable, focus on long-term'],
    long_term_work: (Array.isArray(long_term_work) && long_term_work.length > 0) ? long_term_work : ['Maintain current trajectory']
  };
}
