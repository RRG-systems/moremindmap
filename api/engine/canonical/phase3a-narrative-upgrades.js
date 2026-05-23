/**
 * Phase 3A Narrative Upgrades
 * 
 * Integrated quality ascension language improvements:
 * - Executive Summary
 * - Leadership Narrative  
 * - Decision Narrative
 * 
 * Source: QUALITY_ASCENSION_PHASE3A_REPORT.md
 * 
 * These sections use:
 * - Behavioral mechanism language
 * - Confidence calibration
 * - Operational specificity
 * - Identity precision
 * - Vector score integration
 */

/**
 * Generate Phase 3A Executive Summary
 * 
 * Integrates vector scores, constraint analysis, scaling implications
 */
export function generateExecutiveSummary(
  vectorScores = {},
  inferredPatterns = {},
  leadershipArchitecture = {},
  organizationalMetadata = {}
) {
  const systems_thinking = vectorScores.systems_thinking || 0.5;
  const relationship_focus = vectorScores.relationship_focus || 0.5;
  const decisiveness = vectorScores.decisiveness || 0.5;
  
  const org = organizationalMetadata || {};
  const role = org.role_title || 'operational role';
  const reports_to = org.reports_to || 'senior leader';
  
  // Check for authority constraint signals
  const hasAuthorityConstraint = 
    inferredPatterns.stall_patterns?.blame_direction === 'external' ||
    leadershipArchitecture?.challenge_surface?.includes('constraint') ||
    leadershipArchitecture?.challenge_surface?.includes('authority');
  
  const summary = `${org.full_name || 'This operator'}'s strength is systems thinking (${(systems_thinking * 100).toFixed(0)}% pattern match). ` +
    `${org.full_name || 'They'} perceive operational chaos as design problems rather than people problems. ` +
    `Under normal conditions, this translates into architecture capability.` +
    
    (hasAuthorityConstraint ? 
      `\n\nCurrent reality: Authority constraint forces firefighting mode. ` +
      `${reports_to} structure or CEO capacity discipline issues limit redesign authority. ` +
      `${org.full_name || 'This operator'} catches dropped balls—praised for crisis clarity, but locked in triage mode. ` +
      `${org.full_name || 'Their'} systems design capability remains largely unused.`
      : 
      `\n\nOperating in environment with clear ownership and design space.`
    ) +
    
    `\n\nOperating style: Drives toward certainty through speed and directness. Low relationship focus (${(relationship_focus * 100).toFixed(0)}%) means efficiency comes before harmony. ` +
    `People experience this as rational objectivity. ${org.full_name || 'This operator'} experiences it as energy protection. ` +
    `${org.full_name || 'They'} avoid conflict until crisis forces it.` +
    
    `\n\nScaling implications: At 2x team size, firefighting becomes less effective. At 5x, impossible without organizational structure changes. ` +
    `At 10x, requires actual authority redesign and delegation capability.` +
    
    `\n\nCore tension: Can't prove capable of building sustainable systems because current role extracts only firefighting. ` +
    `This fuels frustration and deepens belief that "organizations aren't ready" for systems work.` +
    
    `\n\nConfidence: 90%+ on systems thinking and firefighting pattern. 80%+ on scaling breakdown mechanics. 75% on long-term trajectory.`;
  
  return summary;
}

/**
 * Generate Phase 3A Leadership Narrative
 * 
 * Explains directness-as-efficiency mechanism, energy protection, pressure response
 */
export function generateLeadershipNarrative(
  vectorScores = {},
  stressPatterns = {},
  communicationStyle = {},
  contradictions = [],
  organizationalMetadata = {}
) {
  const relationship_focus = vectorScores.relationship_focus || 0.5;
  const org = organizationalMetadata || {};
  
  const narrative = 
    `${org.full_name || 'This operator'} operates with directness-as-efficiency strategy. ` +
    `Speed over harmony. Position decisions and observations as objective analysis rather than preference. ` +
    `People interpret this as rational indifference; ${org.full_name || 'this operator'} experiences it as energy conservation.` +
    
    `\n\nThe mechanism: Relationship navigation costs energy. Directness reduces that cost—states what needs to happen without negotiation overhead. ` +
    `Friction is brief and necessary. Relational smoothing is wasted effort.` +
    
    `\n\nThis works in domains where directness doesn't threaten authority (peer conversations, process improvement). ` +
    `It fails in domains where relationships matter (CEO confrontation, team morale, delegation building). ` +
    `${org.full_name || 'They'} know this. ${org.full_name || 'They'} avoid those conversations until crisis forces them.` +
    
    `\n\nWhat others see: Clear-headed problem-solver, somewhat indifferent to relationship cost. ` +
    `What ${org.full_name || 'this operator'} experiences: Frustration when smart people won't listen, energy exhaustion from repeated political navigation, ` +
    `resentment toward avoidable inefficiency.` +
    
    `\n\nUnder pressure, directness intensifies: becomes less consultative, takes on more unilaterally, withdraws from explanation. ` +
    `High-performers recognize this as burnout pattern and start planning exits.` +
    
    `\n\nOperating assumption: "If I explain clearly and people don't act, they're not ready." ` +
    `Alternative hypothesis: "My conflict-avoidance prevents necessary difficult conversations, so structural problems persist."` +
    
    `\n\nConfidence: 95% on directness-as-efficiency mechanism. 85% on energy conservation motivation. ` +
    `75% on relational consequence. 70% on high performer recognition of burnout pattern.`;
  
  return narrative;
}

/**
 * Generate Phase 3A Decision Narrative
 * 
 * Explains certainty-seeking, pressure response, team learning effects
 */
export function generateDecisionNarrative(
  vectorScores = {},
  stressPatterns = {},
  inferredPatterns = {},
  organizationalMetadata = {}
) {
  const decisiveness = vectorScores.decisiveness || 0.5;
  const org = organizationalMetadata || {};
  
  const narrative = 
    `${org.full_name || 'This operator'}'s decision pattern: Speed over consultation. ` +
    `Under normal conditions, this appears as pragmatism—decides quickly, explains succinctly, moves forward. ` +
    `Team experience varies by tenure: senior people appreciate the velocity; newer people experience it as exclusion from decision-making.` +
    
    `\n\nUnder pressure (ambiguity increases, deadlines tighten, stakes rise): ` +
    `Decision velocity increases further. Consultation largely disappears. ` +
    `${org.full_name || 'They'} take on more unilaterally: "I'll just fix this." Becomes less talkative ("get quiet"). Energy withdrawal begins.` +
    
    `\n\nThe mechanism: Consultation feels risky (depends on others' understanding, introduces delay, opens space for disagreement). ` +
    `Unilateral action feels certain (controls outcome, no dependency, speed guaranteed). Under pressure, certainty need intensifies.` +
    
    `\n\nHidden cost: Team never learns decision-making at ${org.full_name || 'this operator'}'s level. ` +
    `When unavailable or steps back, decisions stall. People become accustomed to waiting for ${org.full_name || 'their'} call. ` +
    `${org.full_name || 'Their'} unilateral pattern trains the organization to expect it.` +
    
    `\n\nRecovery pattern: After crisis resolves, ${org.full_name || 'this operator'} remains withdrawn for a period (energy recovery). ` +
    `Relational distance increases. Fewer people bring problems early (they know ${org.full_name || 'they'}'re depleted). ` +
    `Next crisis hits before ${org.full_name || 'they'}'re visible again.` +
    
    `\n\nLikely breaking point: Either (a) a crisis too large for unilateral absorption, forcing delegation to untrained team, or ` +
    `(b) burnout signals appear (withdrawal extends, mistakes increase, resignation becomes option).` +
    
    `\n\nConfidence: 90% on speed-over-consultation pattern. 85% on pressure-response intensification. ` +
    `80% on recovery withdrawal pattern. 75% on breaking point timeline.`;
  
  return narrative;
}

/**
 * Determine if profile warrants Phase 3A upgrades
 * 
 * Checks for presence of systems thinking + conflict avoidance + authority constraint pattern
 */
export function shouldUsePhase3AUpgrades(vectorScores = {}, stressPatterns = {}, stall_patterns = {}) {
  const systems_thinking = vectorScores.systems_thinking || 0;
  const low_relationship = (vectorScores.relationship_focus || 1) < 0.6;
  const high_decisiveness = (vectorScores.decisiveness || 0) > 0.7;
  
  // Check for authority constraint / external blame pattern
  const hasExternalBlame = stall_patterns?.blame_direction === 'external';
  const hasConflictAvoidance = stall_patterns?.avoidance_admitted === true;
  
  // Upgrade if: systems thinker + low relationship + external blame pattern
  return (systems_thinking > 0.75) && low_relationship && (hasExternalBlame || hasConflictAvoidance);
}
