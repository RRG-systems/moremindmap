/**
 * inferFutureTrajectory.js
 * 
 * Model likely 2-year and 5-year outcomes
 * Both IF UNCHANGED and IF DEVELOPED
 * 
 * We model where their architecture LEADS, not who they ARE
 */

export function inferFutureTrajectory(
  vectorScores,
  contradictions,
  futureConstraints,
  hiddenRisks,
  scalingReadiness,
  analyzedResponses,
  behavioralConsequences
) {
  const { business_reality, growth_tension, systems_accountability, stall_patterns } = analyzedResponses;
  
  // Trajectory if unchanged
  const unchanged_2yr = [];
  const unchanged_5yr = [];
  const unchanged_breakpoints = [];
  
  // Growth ceiling from delegation
  if (behavioralConsequences?.recurring_breakdowns?.some(b => b.pattern === 'Delegation and trust')) {
    unchanged_2yr.push('Growth plateaus at personal execution capacity; becomes organizational bottleneck despite market opportunity');
    unchanged_5yr.push('Ceiling reached; team composition shifts toward execution-dependent rather than autonomous; succession impossible');
    unchanged_breakpoints.push({
      trigger: 'Attempts to scale past personal capacity',
      consequence: 'Quality degrades or growth stalls; no path forward without delegation transformation',
      timing: '18-24 months'
    });
  }
  
  // Relational erosion
  if (hiddenRisks?.relational_erosion_risk?.includes('High')) {
    unchanged_2yr.push('2-3 key relationship departures; A-player talent filtered out by relational friction');
    unchanged_5yr.push('Team quality degrades to relational-friction-tolerant baseline; excellence replaced by compliance');
    unchanged_breakpoints.push({
      trigger: 'High performer exits citing culture fit',
      consequence: 'Talent composition shifts; replacement quality lower; institutional knowledge lost',
      timing: '12-18 months per high performer'
    });
  }
  
  // Systems debt accumulation
  if (systems_accountability?.system_confidence === 'low' && business_reality?.has_specific_metrics) {
    unchanged_2yr.push('Firefighting becomes permanent state; same operational problems recur quarterly');
    unchanged_5yr.push('Organizational debt compounds; systems rebuild required but identity resistance prevents investment; stuck at current scale');
    unchanged_breakpoints.push({
      trigger: 'Growth attempt without infrastructure',
      consequence: 'Operational chaos; customer experience degrades; forced retreat or failure',
      timing: 'Next major scaling push'
    });
  }
  
  // Strategic drift
  if (vectorScores.horizon < 4.0 && vectorScores.velocity > 6.5) {
    unchanged_5yr.push('Tactical efficiency without strategic coherence; wins battles while slowly losing war; market position erodes despite high activity');
    unchanged_breakpoints.push({
      trigger: 'Competitor with strategic clarity gains market leverage',
      consequence: 'Realizes execution was toward wrong target; years of effort lost to drift',
      timing: '3-5 years'
    });
  }
  
  // Trajectory if developed
  const developed_2yr = [];
  const developed_5yr = [];
  const development_requirements = [];
  
  // If delegation developed
  if (behavioralConsequences?.recurring_breakdowns?.some(b => b.pattern === 'Delegation and trust')) {
    developed_2yr.push('Delegation standards explicitly defined; team begins developing autonomous capability; leader capacity freed for strategic work');
    developed_5yr.push('Organization scales through people, not heroic personal execution; succession viable; growth uncapped by single-person constraint');
    development_requirements.push('Explicit trust recalibration - define good enough, build accountability systems, release control progressively over 12 months');
  }
  
  // If systems built
  if (systems_accountability?.system_confidence === 'low') {
    developed_2yr.push('Core operational systems in place; firefighting decreases 60%; capacity for growth created');
    developed_5yr.push('Infrastructure supports 5x scale; operational leverage compounds; time freed for strategic work');
    development_requirements.push('6-month infrastructure build sprint - accept short-term speed loss for long-term capacity gain');
  }
  
  // If relational awareness built
  if (vectorScores.signal < 3.5 && hiddenRisks?.relational_erosion_risk?.includes('High')) {
    developed_2yr.push('Relational timing improves; relationship damage decreases; A-player retention increases');
    developed_5yr.push('Culture shifts from compliance to contribution; talent quality improves; execution multiplies through willing followership');
    development_requirements.push('Sustained relational awareness practice - 90-day intensive coaching on reading room before directing');
  }
  
  // Critical choice points
  const critical_choice_points = [];
  
  if (contradictions.length > 2 && scalingReadiness?.readiness_score < 0.5) {
    critical_choice_points.push({
      decision: 'Scale now vs build infrastructure first',
      window: 'Next 6-12 months',
      consequence_if_scale: 'Operational chaos likely; growth becomes crisis rather than achievement',
      consequence_if_build: 'Short-term revenue opportunity cost; long-term sustainable scaling foundation'
    });
  }
  
  if (hiddenRisks?.relational_erosion_risk?.includes('High')) {
    critical_choice_points.push({
      decision: 'Invest in relational development vs maintain current approach',
      window: 'Next 12 months before key talent departs',
      consequence_if_unchanged: 'A-player talent exits; team quality degrades; recruiting costs compound',
      consequence_if_developed: 'Retention improves; culture strengthens; execution multiplies'
    });
  }
  
  return {
    unchanged_trajectory: {
      year_2: unchanged_2yr,
      year_5: unchanged_5yr,
      breakpoints: unchanged_breakpoints
    },
    developed_trajectory: {
      year_2: developed_2yr,
      year_5: developed_5yr,
      requirements: development_requirements
    },
    critical_choice_points
  };
}
