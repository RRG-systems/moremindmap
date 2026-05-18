/**
 * PHASE 2A: WRITTEN RESPONSE INTERPRETER
 * 
 * Analyzes HOW users answer, not WHAT they claim.
 * Detects tone, structure, and behavioral signals in written responses.
 * Produces modifier object for profile output.
 */

export function interpretWrittenResponses(writtenResponses = []) {
  if (!writtenResponses || writtenResponses.length === 0) {
    return getDefaultInterpretation()
  }

  // Combine all written responses into single analysis block
  const combinedText = writtenResponses
    .map((r) => (typeof r === 'string' ? r : r.text || ''))
    .filter((t) => t.length > 0)
    .join(' ')

  if (combinedText.length < 20) {
    return getDefaultInterpretation()
  }

  return {
    clarity: measureClarity(combinedText),
    certainty: measureCertainty(combinedText),
    relational_awareness: measureRelationalAwareness(combinedText),
    self_awareness: measureSelfAwareness(combinedText),
    defensiveness: measureDefensiveness(combinedText),
    action_orientation: measureActionOrientation(combinedText),
    emotional_control: measureEmotionalControl(combinedText),
    raw_signal: deriveRawSignal(combinedText),
  }
}

/**
 * DIMENSION 1: CLARITY
 * Concise + structured vs rambling + scattered
 */
function measureClarity(text) {
  const sentenceCount = (text.match(/[.!?]/g) || []).length
  const avgSentenceLength = text.split(/[.!?]/).filter((s) => s.trim()).reduce((sum, s) => sum + s.split(' ').length, 0) / Math.max(sentenceCount, 1)

  // High clarity: short sentences, structured
  // Low clarity: long sentences, stream of consciousness
  if (avgSentenceLength > 25) return 'low'
  if (avgSentenceLength < 12) return 'high'
  return 'medium'
}

/**
 * DIMENSION 2: CERTAINTY
 * Decisive language vs hedging
 */
function measureCertainty(text) {
  const hedges = /\b(maybe|might|could|probably|sort of|kind of|I think|I guess|seems like|appears to|somewhat|relatively|fairly)\b/gi
  const hedgeCount = (text.match(hedges) || []).length

  const decisives = /\b(always|never|definitely|certainly|absolutely|clearly|I do|I am|I will)\b/gi
  const decisiveCount = (text.match(decisives) || []).length

  const ratio = decisiveCount / (hedgeCount + decisiveCount + 1)

  if (ratio > 0.6) return 'high'
  if (ratio < 0.3) return 'low'
  return 'medium'
}

/**
 * DIMENSION 3: RELATIONAL AWARENESS
 * Self-focused vs other-aware
 */
function measureRelationalAwareness(text) {
  const selfReferences = /\b(I |me |my |myself)\b/gi
  const selfCount = (text.match(selfReferences) || []).length

  const otherReferences = /\b(they |them |their |others |people |team |person |someone |someone else)\b/gi
  const otherCount = (text.match(otherReferences) || []).length

  const selfFocusRatio = selfCount / (otherCount + selfCount + 1)

  // High awareness: balanced or other-focused
  // Low awareness: heavily self-focused
  if (selfFocusRatio > 0.7) return 'low'
  if (selfFocusRatio < 0.4) return 'high'
  return 'medium'
}

/**
 * DIMENSION 4: SELF-AWARENESS
 * Reflective + acknowledges flaws vs declarative + only strengths
 */
function measureSelfAwareness(text) {
  const reflective = /\b(I realize|I learned|I noticed|I've come to understand|I struggle with|I tend to|sometimes I|can be|flaws|weakness|difficult|challenge|improve|better at|working on)\b/gi
  const reflectiveCount = (text.match(reflective) || []).length

  const declarative = /\b(I am|I'm|I do|I have|good at|strong|excellent|best|always|perfect|never fail)\b/gi
  const declarativeCount = (text.match(declarative) || []).length

  const selfAwarenessRatio = reflectiveCount / (declarativeCount + reflectiveCount + 1)

  if (selfAwarenessRatio > 0.5) return 'high'
  if (selfAwarenessRatio < 0.2) return 'low'
  return 'medium'
}

/**
 * DIMENSION 5: DEFENSIVENESS
 * Justifying + over-explaining vs neutral tone
 */
function measureDefensiveness(text) {
  const defensive = /\b(because|but|however|though|actually|in reality|to be honest|really|frankly|I know it sounds|it's not|let me explain|what I mean is)\b/gi
  const defensiveCount = (text.match(defensive) || []).length

  const wordCount = text.split(/\s+/).length
  const defensivenessRatio = defensiveCount / wordCount

  if (defensivenessRatio > 0.08) return 'high'
  if (defensivenessRatio < 0.03) return 'low'
  return 'medium'
}

/**
 * DIMENSION 6: ACTION ORIENTATION
 * Describes behavior vs abstract identity
 */
function measureActionOrientation(text) {
  const actionVerbs = /\b(do|make|create|build|run|lead|push|move|take|handle|manage|solve|fix|drive|execute|implement)\b/gi
  const actionVerbCount = (text.match(actionVerbs) || []).length

  const identityAdjectives = /\b(am|creative|innovative|strategic|thoughtful|analytical|organized|motivated|passionate|ambitious)\b/gi
  const identityCount = (text.match(identityAdjectives) || []).length

  const actionRatio = actionVerbCount / (identityCount + actionVerbCount + 1)

  if (actionRatio > 0.6) return 'high'
  if (actionRatio < 0.3) return 'low'
  return 'medium'
}

/**
 * DIMENSION 7: EMOTIONAL CONTROL
 * Measured tone vs reactive language
 */
function measureEmotionalControl(text) {
  const charged = /\b(love|hate|amazing|terrible|frustrated|angry|devastated|thrilled|explode|furious|disgusting|disgusted|outraged)\b/gi
  const chargedCount = (text.match(charged) || []).length

  const measured = /\b(prefer|suitable|appropriate|consider|significant|notable|interesting|challenging|worthwhile)\b/gi
  const measuredCount = (text.match(measured) || []).length

  const controlRatio = measuredCount / (chargedCount + measuredCount + 1)

  if (controlRatio > 0.6) return 'high'
  if (controlRatio < 0.2) return 'low'
  return 'medium'
}

/**
 * Derive overall behavioral signal from dimensions
 */
function deriveRawSignal(text) {
  const interpretations = {
    clarity: measureClarity(text),
    certainty: measureCertainty(text),
    relational_awareness: measureRelationalAwareness(text),
    self_awareness: measureSelfAwareness(text),
    defensiveness: measureDefensiveness(text),
    action_orientation: measureActionOrientation(text),
    emotional_control: measureEmotionalControl(text),
  }

  // Categorize overall signal
  const highDimensions = Object.values(interpretations).filter((v) => v === 'high').length
  const lowDimensions = Object.values(interpretations).filter((v) => v === 'low').length

  if (highDimensions >= 5) return 'grounded'
  if (lowDimensions >= 5) return 'disconnected'
  if (lowDimensions >= 3 && highDimensions <= 2) return 'defensive'
  if (interpretations.self_awareness === 'low' && interpretations.certainty === 'high') return 'overconfident'
  if (interpretations.action_orientation === 'high' && interpretations.relational_awareness === 'low') return 'aggressive'
  if (interpretations.action_orientation === 'low' && interpretations.relational_awareness === 'high') return 'considerate'

  return 'balanced'
}

/**
 * Default interpretation (no written responses)
 */
function getDefaultInterpretation() {
  return {
    clarity: 'medium',
    certainty: 'medium',
    relational_awareness: 'medium',
    self_awareness: 'medium',
    defensiveness: 'medium',
    action_orientation: 'medium',
    emotional_control: 'medium',
    raw_signal: 'balanced',
  }
}

/**
 * Generate modifier text based on interpretation
 * Used to adjust profile output
 */
export function generateInterpreterModifier(interpretation) {
  if (!interpretation) return {}

  const modifiers = {}
  const signal = interpretation.raw_signal?.toLowerCase() || 'balanced'

  // Map based on raw_signal first (authoritative)
  if (signal === 'overconfident') {
    modifiers.tone_adjustment = 'acknowledge_self_perception_gap'
    modifiers.note =
      'Written responses suggest confidence in self-assessment. Profile reflects observed patterns, which may differ from self-perception.'
    return modifiers
  }

  if (signal === 'aggressive') {
    modifiers.friction_emphasis = 'increase'
    modifiers.note = 'Responses suggest strong action focus with lower attention to relational impact. Profile emphasizes interpersonal friction points.'
    return modifiers
  }

  if (signal === 'defensive') {
    modifiers.tone_adjustment = 'direct_not_accusatory'
    modifiers.note = 'Written responses show explanation/justification patterns. Profile avoids triggering defensiveness.'
    return modifiers
  }

  if (signal === 'disconnected') {
    modifiers.structure_adjustment = 'emphasize_coherence'
    modifiers.note = 'Responses suggest scattered thinking patterns. Profile may emphasize need for structure.'
    return modifiers
  }

  if (signal === 'grounded') {
    modifiers.credibility_boost = true
    modifiers.note = 'Responses show reflective, self-aware thinking. Profile findings likely resonate.'
    return modifiers
  }

  if (signal === 'considerate') {
    modifiers.credibility_boost = true
    modifiers.note = 'Responses show strong relational awareness. Profile reflects nuanced understanding of interpersonal dynamics.'
    return modifiers
  }

  // Balanced or unknown signal
  return modifiers
}
