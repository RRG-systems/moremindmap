/**
 * inferSelfDeceptionPatterns.js
 * 
 * Where awareness exists without behavior change
 * Where intelligence rationalizes repetition
 * 
 * CRITICAL: Stay operational and behavioral
 * NO therapy language
 * NO childhood psychoanalysis
 * NO insulting language
 */

export function inferSelfDeceptionPatterns(vectorScores, analyzedResponses, contradictions, behavioralConsequences) {
  const patterns = [];
  
  const { stall_patterns, systems_accountability, growth_tension, business_reality } = analyzedResponses;
  
  // Awareness before behavior
  if (contradictions.some(c => false && c.type === 'knowledge_execution_gap')) {
    patterns.push({
      pattern_type: 'Intellectual awareness precedes behavioral change',
      manifestation: 'Accurately diagnoses own gaps in reflection; continues same patterns in execution',
      self_narrative: 'Likely tells self: I know I need to work on this',
      operational_reality: 'Awareness exists intellectually before it exists behaviorally',
      preservation_mechanism: 'Reflection satisfies intellectual need for growth without requiring behavior change'
    });
  }
  
  // Retrospective clarity
  if (stall_patterns?.avoidance_admitted && stall_patterns?.self_awareness === 'low') {
    patterns.push({
      pattern_type: 'Reflection strongest after consequences',
      manifestation: 'Understands patterns clearly when looking backward; less clarity when looking forward in real-time',
      self_narrative: 'Likely tells self: I will handle it differently next time',
      operational_reality: 'Reflection appears strongest after consequences emerge, not before decisions form',
      preservation_mechanism: 'Retrospective learning creates feeling of growth without interrupting prospective patterns'
    });
  }
  
  // Systems understanding without implementation
  if (systems_accountability?.system_confidence === 'low' && systems_accountability?.meta_awareness === 'low') {
    patterns.push({
      pattern_type: 'Process knowledge without process adoption',
      manifestation: 'Understands systems and infrastructure intellectually; avoids building them operationally',
      self_narrative: 'Likely tells self: I will build systems once things slow down',
      operational_reality: 'The system understands its own weaknesses more clearly than it interrupts them',
      preservation_mechanism: 'Busyness justifies delay; urgency always wins over infrastructure'
    });
  }
  
  // Ambition masking capacity limits
  if (growth_tension?.scaling_response === 'positive' && business_reality?.gap_awareness) {
    patterns.push({
      pattern_type: 'Ambition narrative preserves capacity denial',
      manifestation: 'Emotionally positive about growth while operational reality shows infrastructure insufficient',
      self_narrative: 'Likely tells self: I will figure it out as I scale',
      operational_reality: 'Ambition masks fear of building infrastructure that would expose current execution gaps',
      preservation_mechanism: 'Growth narrative protects against confronting present-state organizational debt'
    });
  }
  
  // Helpful rationalizations
  if (contradictions.some(c => false && c.type === 'coachability_resistance_pattern')) {
    patterns.push({
      pattern_type: 'Selective coachability preservation',
      manifestation: 'Claims openness to coaching; operationally resists advice that challenges framework',
      self_narrative: 'Likely tells self: I am coachable when the advice makes sense',
      operational_reality: 'Certainty hides fragility; helpful narratives preserve identity',
      preservation_mechanism: 'Intelligence filters coaching through existing framework; only non-threatening advice integrated'
    });
  }
  
  // Busyness as strategic avoidance
  if (vectorScores.velocity > 6.5 && systems_accountability?.systems_thinking === 'low') {
    patterns.push({
      pattern_type: 'Tactical busyness prevents strategic discomfort',
      manifestation: 'Continuous execution prevents pausing to confront infrastructure gaps',
      self_narrative: 'Likely tells self: I do not have time to slow down right now',
      operational_reality: 'Busyness masks strategic avoidance; speed protects against infrastructure confrontation',
      preservation_mechanism: 'Execution creates sense of progress while avoiding structural work'
    });
  }
  
  return {
    patterns,
    meta_observation: patterns.length > 0
      ? 'Multiple self-deception mechanisms present; awareness exists but behavioral inertia preserved through narrative protection'
      : 'Self-perception generally aligned with behavioral reality'
  };
}
