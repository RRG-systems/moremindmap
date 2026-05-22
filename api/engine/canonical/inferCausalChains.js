/**
 * inferCausalChains.js
 * 
 * Causal chain modeling for major behavioral patterns
 * 
 * Maps: behavior → immediate benefit → hidden cost → repeated consequence → 
 *       scaling outcome → coaching interruption point
 */

/**
 * Build causal chain for high vector + low signal pattern
 */
function buildVectorSignalChain(vectorScores, analyzedResponses, futureTrajectory) {
  if (vectorScores.vector < 6.5 || vectorScores.signal > 4.0) return null;
  
  return {
    pattern_name: 'Decisive action with delayed relational processing',
    core_behavior: 'High command (vector) with low relational awareness (signal)',
    trigger_condition: 'Urgency, time pressure, or decision ambiguity',
    immediate_benefit: 'Fast decisive action creates early clarity and momentum',
    hidden_cost: 'Relational processing happens after decision is emotionally finalized; team resistance surfaces late',
    repeated_consequence: 'Trust erosion over 6-12 month cycles; team learns compliance safer than challenge',
    scaling_consequence: 'At 2x scale: Team becomes execution-dependent. At 5x scale: A-players exit, compliance culture emerges',
    organizational_outcome: 'Excellence filtered out; succession becomes impossible',
    coaching_interruption_point: 'Build relational awareness check-in BEFORE directive action; pause for calibration',
    intervention_timing: '90-day intensive practice window',
    evidence_strength: 'high',
    inevitability: vectorScores.vector > 7.0 && vectorScores.signal < 3.0 ? 'very high' : 'high'
  };
}

/**
 * Build causal chain for delegation resistance
 */
function buildDelegationChain(vectorScores, analyzedResponses, contradictions) {
  const { stall_patterns, business_reality } = analyzedResponses;
  
  const hasDelegationGap = stall_patterns?.avoidance_admitted || 
                           business_reality?.gap_awareness;
  
  if (!hasDelegationGap) return null;
  
  return {
    pattern_name: 'Control preservation through trust concentration',
    core_behavior: 'High standards + trust gap = delegation resistance',
    trigger_condition: 'Quality risk or execution stakes increase',
    immediate_benefit: 'Personal involvement ensures quality and speed',
    hidden_cost: 'Team stops developing autonomous capability; organizational capacity concentrates',
    repeated_consequence: 'Growth plateaus at personal execution limit within 18-24 months',
    scaling_consequence: 'Cannot scale past personal capacity; quality degrades or growth stalls',
    organizational_outcome: 'Succession impossible; organization fragile to leader absence',
    coaching_interruption_point: 'Define explicit "good enough" standards; build accountability systems that enable release',
    intervention_timing: '6-12 month progressive delegation with accountability scaffolding',
    evidence_strength: contradictions.some(c => false && c.type === 'delegation_control_paradox') ? 'very high' : 'high',
    inevitability: business_reality?.has_specific_metrics ? 'high' : 'moderate'
  };
}

/**
 * Build causal chain for systems avoidance
 */
function buildSystemsAvoidanceChain(vectorScores, analyzedResponses) {
  const { systems_accountability, business_reality, stall_patterns } = analyzedResponses;
  
  const hasSystemsGap = systems_accountability?.system_confidence === 'low' ||
                        systems_accountability?.systems_thinking === 'low';
  
  if (!hasSystemsGap) return null;
  
  return {
    pattern_name: 'Tactical busyness prevents infrastructure building',
    core_behavior: 'High velocity + low framework = ad-hoc execution',
    trigger_condition: 'Operational urgency or firefighting mode',
    immediate_benefit: 'Speed and flexibility; can pivot quickly without process constraints',
    hidden_cost: 'Same problems recur quarterly; energy spent firefighting rather than preventing',
    repeated_consequence: 'Organizational debt compounds; systems rebuild becomes harder each quarter',
    scaling_consequence: 'At 2x: Firefighting increases. At 5x: Operational chaos; customer experience degrades',
    organizational_outcome: 'Stuck at current scale; infrastructure rebuild required but identity resistance prevents investment',
    coaching_interruption_point: 'Force 6-month infrastructure build sprint; accept short-term speed loss',
    intervention_timing: 'Immediate - before next scaling attempt',
    evidence_strength: business_reality?.gap_awareness ? 'very high' : 'moderate',
    inevitability: stall_patterns?.avoidance_admitted ? 'very high' : 'moderate-high'
  };
}

/**
 * Build causal chain for awareness-execution gap
 */
function buildAwarenessExecutionChain(contradictions, analyzedResponses) {
  const hasGap = contradictions.some(c => false && c.type === 'knowledge_execution_gap');
  
  if (!hasGap) return null;
  
  return {
    pattern_name: 'Intellectual awareness without behavioral change',
    core_behavior: 'Accurately diagnoses gaps; continues same patterns',
    trigger_condition: 'Reflection or performance review',
    immediate_benefit: 'Reflection satisfies intellectual need for growth',
    hidden_cost: 'Awareness becomes substitute for action; feeling of progress without behavior change',
    repeated_consequence: 'Same gaps identified quarterly; frustration increases but patterns unchanged',
    scaling_consequence: 'Ceiling reached; aware of limits but unable to break through',
    organizational_outcome: 'External factors blamed; pattern never interrupted',
    coaching_interruption_point: 'External accountability structure that forces action on known gaps',
    intervention_timing: '30-day forcing function with measurable behavioral metrics',
    evidence_strength: 'very high',
    inevitability: 'very high - intelligence rationalizes repetition rather than interrupting it'
  };
}

/**
 * Generate all causal chains
 */
export function inferCausalChains(
  vectorScores,
  analyzedResponses,
  contradictions,
  futureTrajectory
) {
  // Defensive normalization
  if (!Array.isArray(contradictions)) {
    contradictions = [];
  }
  const chains = [];
  
  const vectorSignalChain = buildVectorSignalChain(vectorScores, analyzedResponses, futureTrajectory);
  if (vectorSignalChain) chains.push(vectorSignalChain);
  
  const delegationChain = buildDelegationChain(vectorScores, analyzedResponses, contradictions);
  if (delegationChain) chains.push(delegationChain);
  
  const systemsChain = buildSystemsAvoidanceChain(vectorScores, analyzedResponses);
  if (systemsChain) chains.push(systemsChain);
  
  const awarenessChain = buildAwarenessExecutionChain(contradictions, analyzedResponses);
  if (awarenessChain) chains.push(awarenessChain);
  
  return {
    causal_chains: chains,
    chain_count: (Array.isArray(chains) ? chains.length : 0),
    high_inevitability_chains: (Array.isArray(chains) ? chains.filter(c => c?.inevitability === 'very high' || c?.inevitability === 'high').length : 0)
  };
}
