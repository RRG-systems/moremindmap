/**
 * inferBehavioralConsequences.js
 * 
 * SHIFT: Stop describing traits. Start modeling CONSEQUENCES.
 * 
 * Questions:
 * - What does this person's behavior CAUSE?
 * - What breaks around them?
 * - What scales badly?
 * - What silently compounds?
 * - What future problems emerge from current strengths?
 */

/**
 * Infer what strengths unintentionally damage
 */
function inferStrengthDamage(vectorScores, stressPatterns, analyzedResponses) {
  const damages = [];
  
  const { stall_patterns, business_reality } = analyzedResponses;
  
  // High vector + low signal = speed damages relationships
  if (vectorScores.vector > 6.5 && vectorScores.signal < 3.5) {
    damages.push({
      strength: 'Decisive direction-setting',
      damage: 'Creates momentum early, but relational processing often happens after decisions are emotionally finalized, causing resistance to surface downstream rather than during formation',
      timeframe: 'Accumulates over 3-6 months',
      manifestation: 'Team stops raising concerns early; conflict emerges later when harder to resolve'
    });
  }
  
  // High velocity + low fidelity = speed creates rework
  if (vectorScores.velocity > 6.5 && vectorScores.fidelity < 4.0) {
    damages.push({
      strength: 'Execution speed',
      damage: 'Moves fast enough to require rework cycles; total time-to-completion often slower than deliberate approach despite higher tempo',
      timeframe: 'Per project cycle',
      manifestation: 'Quality issues surface after launch, creating emergency fixes'
    });
  }
  
  // High framework + low flex = process becomes cage
  if (vectorScores.framework > 6.5 && vectorScores.flex < 4.0) {
    damages.push({
      strength: 'Clear process and structure',
      damage: 'Process becomes identity; when reality requires pivot, framework resistance creates adaptation lag that competitors exploit',
      timeframe: '6-12 months per market shift',
      manifestation: 'Organization responds to change slowly despite early warning signals'
    });
  }
  
  // High fidelity + low velocity = precision stalls momentum
  if (vectorScores.fidelity > 6.5 && vectorScores.velocity < 4.0) {
    damages.push({
      strength: 'Quality standards and verification',
      damage: 'High standards improve execution while simultaneously creating decision paralysis when stakes increase',
      timeframe: 'Compounds with organizational growth',
      manifestation: 'Critical decisions delayed; perfectionism masquerades as thoroughness'
    });
  }
  
  return damages;
}

/**
 * Infer what repeatedly breaks down
 */
function inferRecurringBreakdowns(vectorScores, analyzedResponses, contradictions) {
  const breakdowns = [];
  
  const { stall_patterns, systems_accountability } = analyzedResponses;
  
  // Knowledge-execution gap = same patterns repeat
  if (contradictions.some(c => c.type === 'knowledge_execution_gap')) {
    breakdowns.push({
      pattern: 'Execution follow-through',
      breakdown: 'Identifies priorities accurately but execution remains inconsistent; the same gaps appear quarterly despite awareness',
      root_cause: 'Awareness exists intellectually before it exists behaviorally',
      frequency: 'Every 90-120 days'
    });
  }
  
  // Delegation avoidance = bottleneck recurs
  const { business_reality } = analyzedResponses;
  if (stall_patterns?.avoidance_admitted && business_reality?.gap_awareness) {
    breakdowns.push({
      pattern: 'Delegation and trust',
      breakdown: 'Becomes personal execution bottleneck; team waits for involvement rather than developing autonomous capability',
      root_cause: 'Trust gap preserved by maintaining control',
      frequency: 'Continuous at scale'
    });
  }
  
  // Relational friction + low signal = relationships degrade
  if (vectorScores.signal < 3.5 && stall_patterns?.frustrations?.includes('relational')) {
    breakdowns.push({
      pattern: 'Relationship repair cycles',
      breakdown: 'Relational damage accumulates invisibly during execution sprints; repair becomes necessary every 4-6 months when turnover or conflict surfaces',
      root_cause: 'Relational signals processed retrospectively, not in real-time',
      frequency: 'Quarterly relationship crises'
    });
  }
  
  return breakdowns;
}

/**
 * Infer what people experience working under/with this person
 */
function inferTeamExperience(vectorScores, leadershipArchitecture, analyzedResponses) {
  const experiences = [];
  
  const { stall_patterns } = analyzedResponses;
  
  // High vector + low signal experience
  if (vectorScores.vector > 6.5 && vectorScores.signal < 3.5) {
    experiences.push({
      dimension: 'Direction clarity',
      positive: 'Always clear where we are going',
      negative: 'Often unclear why we are going there or how it affects us personally',
      long_term_effect: 'Compliance increases, ownership decreases; team becomes execution-dependent on leader presence'
    });
  }
  
  // High velocity + relational friction
  if (vectorScores.velocity > 6.5 && stall_patterns?.frustrations?.includes('relational')) {
    experiences.push({
      dimension: 'Pace and urgency',
      positive: 'Things move fast, decisions happen quickly',
      negative: 'Feel like they are constantly catching up; emotional processing happens after execution',
      long_term_effect: 'Burnout risk increases; tenure decreases among slower processors'
    });
  }
  
  // High fidelity perception
  if (vectorScores.fidelity > 6.5) {
    experiences.push({
      dimension: 'Standards and quality',
      positive: 'High quality output, errors caught early',
      negative: 'Psychological safety erodes when standards feel impossible; risk-taking decreases',
      long_term_effect: 'Innovation narrows; team becomes conservative to avoid critique'
    });
  }
  
  return experiences;
}

/**
 * Infer organizational costs that emerge over time
 */
function inferEmergentCosts(vectorScores, futureConstraints, hiddenRisks, analyzedResponses) {
  const costs = [];
  
  // Delegation gap cost
  if (futureConstraints?.at_2x_scale?.some(c => typeof c === 'string' && c.includes('Delegation'))) {
    costs.push({
      cost_type: 'Growth ceiling from trust concentration',
      mechanism: 'Organization learns to wait for direct involvement rather than developing distributed ownership',
      emergence_timeline: '12-18 months',
      consequence: 'Growth eventually capped by personal execution capacity regardless of market opportunity'
    });
  }
  
  // Relational erosion cost
  if (hiddenRisks?.relational_erosion_risk?.includes('High')) {
    costs.push({
      cost_type: 'Talent attrition from relational friction',
      mechanism: 'High performers leave silently when relational damage accumulates past tolerance threshold',
      emergence_timeline: '18-24 months per high performer',
      consequence: 'Institutional knowledge loss; recruiting costs compound; team quality degrades'
    });
  }
  
  // Systems weakness cost
  if (analyzedResponses?.systems_accountability?.system_confidence === 'low') {
    costs.push({
      cost_type: 'Operational firefighting becomes permanent state',
      mechanism: 'Ad-hoc execution prevents systematic improvement; same problems recur because root causes never addressed',
      emergence_timeline: 'Already present, compounds quarterly',
      consequence: 'Energy drain increases while actual leverage decreases; busy but ineffective'
    });
  }
  
  // Strategic drift cost
  if (vectorScores.horizon < 4.0 && vectorScores.velocity > 6.5) {
    costs.push({
      cost_type: 'Tactical efficiency without strategic coherence',
      mechanism: 'Team executes fast in locally optimal directions without global alignment; effort diffuses',
      emergence_timeline: '6-9 months per strategic cycle',
      consequence: 'High activity, low leverage; wins battles while slowly losing war'
    });
  }
  
  return costs;
}

/**
 * Infer what happens if patterns continue unchanged
 */
function inferUnchangedTrajectory(vectorScores, contradictions, futureConstraints, hiddenRisks) {
  const outcomes = [];
  
  // If knowledge-execution gap persists
  if (contradictions.some(c => c.type === 'knowledge_execution_gap')) {
    outcomes.push({
      pattern: 'Awareness without behavioral change',
      outcome_2yr: 'Same gaps identified in performance reviews; frustration increases but patterns repeat',
      outcome_5yr: 'Ceiling reached; aware of limits but unable to break through; considers external factors responsible',
      inevitability: 'High - Intelligence rationalizes repetition rather than interrupting it'
    });
  }
  
  // If relational friction persists
  if (hiddenRisks?.relational_erosion_risk?.includes('High')) {
    outcomes.push({
      pattern: 'Relational damage accumulation',
      outcome_2yr: '2-3 key relationship departures; replacement quality lower than original talent',
      outcome_5yr: 'Team composition shifts toward compliance over excellence; A-players filtered out by relational friction',
      inevitability: 'High - Pattern invisible to operator until turnover forces recognition'
    });
  }
  
  // If systems weakness persists
  if (typeof futureConstraints?.operational_fragility === 'string' && futureConstraints.operational_fragility.includes('High')) {
    outcomes.push({
      pattern: 'Ad-hoc operations without systematic improvement',
      outcome_2yr: 'Firefighting becomes permanent; growth plateaus despite market opportunity',
      outcome_5yr: 'Organizational debt compounds; systems rebuild required but identity resistance prevents it',
      inevitability: 'Moderate-High - Busyness preserves current state; transformation requires external forcing function'
    });
  }
  
  return outcomes;
}

/**
 * Main export: Infer behavioral consequences
 */
export function inferBehavioralConsequences(
  vectorScores,
  leadershipArchitecture,
  stressPatterns,
  futureConstraints,
  hiddenRisks,
  analyzedResponses,
  contradictions
) {
  const strength_damages = inferStrengthDamage(vectorScores, stressPatterns, analyzedResponses);
  const recurring_breakdowns = inferRecurringBreakdowns(vectorScores, analyzedResponses, contradictions);
  const team_experiences = inferTeamExperience(vectorScores, leadershipArchitecture, analyzedResponses);
  const emergent_costs = inferEmergentCosts(vectorScores, futureConstraints, hiddenRisks, analyzedResponses);
  const unchanged_trajectory = inferUnchangedTrajectory(vectorScores, contradictions, futureConstraints, hiddenRisks);
  
  return {
    strength_damages,
    recurring_breakdowns,
    team_experiences,
    emergent_costs,
    unchanged_trajectory
  };
}
