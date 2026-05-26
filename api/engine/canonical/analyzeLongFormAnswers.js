/**
 * analyzeLongFormAnswers.js
 * 
 * Analyzes long-form written responses for behavioral signals.
 * 
 * This is NOT keyword matching.
 * This is structural and behavioral inference from prose.
 * 
 * Extracts:
 * - Contradiction surfaces
 * - Stress patterns
 * - Emotional leakage
 * - Operational priorities
 * - Adaptive ceilings
 * - Self-awareness calibration
 */

/**
 * Analyze Q2 (What matters most / life direction)
 */
export function analyzeLifeDirection(answerText) {
  if (!answerText || typeof answerText !== 'string') return null;
  
  const text = String(answerText).toLowerCase();
  const length = answerText.split(/\s+/).length;
  
  // Extract stated priorities from content
  const priorities = [];
  if (text.includes('family') || text.includes('children')) priorities.push('family');
  if (text.includes('career') || text.includes('business') || text.includes('work')) priorities.push('career');
  if (text.includes('freedom') || text.includes('autonomy')) priorities.push('freedom');
  if (text.includes('money') || text.includes('financial') || text.includes('wealth')) priorities.push('money');
  if (text.includes('impact') || text.includes('legacy')) priorities.push('impact');
  if (text.includes('growth') || text.includes('learning')) priorities.push('growth');
  if (text.includes('health')) priorities.push('health');
  if (text.includes('stability') || text.includes('security')) priorities.push('stability');
  
  // Detect future orientation
  const futureWords = (text.match(/\b(will|going to|plan|future|legacy|build|become)\b/g) || []).length;
  const presentWords = (text.match(/\b(now|current|today|current)\b/g) || []).length;
  const future_orientation = futureWords > presentWords ? 'high' : 'moderate';
  
  // Detect meaning articulation clarity
  const meaning_clarity = length > 150 ? 'detailed' : length > 50 ? 'moderate' : 'brief';
  
  // Detect identity language
  const identity_language = text.includes('become') || text.includes('transform') || text.includes('build myself');
  
  return {
    stated_priorities: priorities,
    priority_count: priorities.length,
    future_orientation,
    meaning_clarity,
    identity_focused: identity_language,
    word_count: length
  };
}

/**
 * Analyze Q24 (Stall patterns / professional frustrations)
 */
export function analyzeStallPatterns(answerText) {
  if (!answerText || typeof answerText !== 'string') return null;
  
  const text = String(answerText).toLowerCase();
  
  // Detect blame direction
  const externalBlame = (text.match(/\b(they|them|their|others|people|market|economy)\b/g) || []).length;
  const internalBlame = (text.match(/\b(I|me|my|myself)\b/g) || []).length;
  const blame_direction = externalBlame > internalBlame * 1.5 ? 'external' : internalBlame > externalBlame * 1.5 ? 'internal' : 'mixed';
  
  // Detect frustration focus
  const frustrations = [];
  if (text.includes('people') || text.includes('team') || text.includes('resistance')) frustrations.push('relational');
  if (text.includes('system') || text.includes('process') || text.includes('structure')) frustrations.push('structural');
  if (text.includes('time') || text.includes('overwhelm') || text.includes('capacity')) frustrations.push('capacity');
  if (text.includes('lead') || text.includes('prospect') || text.includes('opportunity')) frustrations.push('pipeline');
  
  // Detect avoidance admission
  const avoidance_admitted = 
    text.includes('avoid') || 
    text.includes('put off') || 
    text.includes('delay') || 
    text.includes('stuck') || 
    text.includes('paralysis') ||
    text.includes('stop') ||
    text.includes('freeze') ||
    text.includes('stall') ||
    text.includes('overanalyze') ||
    text.includes('perfection') ||
    text.includes("can't move") ||
    text.includes("can't proceed")
  
  // Detect self-awareness
  const self_awareness_markers = (text.match(/\b(I know|I realize|I need to|I struggle|I should)\b/g) || []).length;
  const self_awareness = self_awareness_markers > 3 ? 'high' : self_awareness_markers > 1 ? 'moderate' : 'low';
  
  return {
    blame_direction,
    frustrations,
    avoidance_admitted,
    self_awareness,
    word_count: answerText.split(/\s+/).length
  };
}

/**
 * Analyze Q26 (Business reality / numerical grounding)
 */
export function analyzeBusinessReality(answerText) {
  if (!answerText || typeof answerText !== 'string') return null;
  
  const text = String(answerText).toLowerCase();
  
  // Detect numerical specificity
  const numbers = (text.match(/\d+/g) || []).length;
  const hasSpecificMetrics = numbers > 3;
  const numerical_grounding = hasSpecificMetrics ? 'high' : numbers > 0 ? 'moderate' : 'low';
  
  // Detect vague vs specific language
  const vagueMarkers = (text.match(/\b(some|many|several|various|few)\b/g) || []).length;
  const specificMarkers = numbers + (text.match(/\b(exactly|specifically|precisely)\b/g) || []).length;
  
  // Detect gap awareness
  const gap_awareness = text.includes('not enough') || 
                        text.includes('need more') ||
                        text.includes('gap') ||
                        text.includes('shortfall');
  
  // Detect scale indicators
  const has_database_size = /database|clients|prospects|relationships/i.test(text) && numbers > 0;
  const has_production_numbers = /production|revenue|commission|volume/i.test(text) && numbers > 0;
  
  return {
    numerical_grounding,
    has_specific_metrics: hasSpecificMetrics,
    gap_awareness,
    scale_indicators: {
      database_mentioned: has_database_size,
      production_mentioned: has_production_numbers
    },
    vague_vs_specific_ratio: vagueMarkers > 0 ? specificMarkers / vagueMarkers : specificMarkers,
    word_count: answerText.split(/\s+/).length
  };
}

/**
 * Analyze Q27 (Growth capacity / emotional scaling response)
 */
export function analyzeGrowthTension(answerText) {
  if (!answerText || typeof answerText !== 'string') return null;
  
  const text = String(answerText).toLowerCase();
  
  // Detect emotional response to 3x scale
  let scaling_response = 'not_answered';
  if (text.includes('excit') || text.includes('motivated') || text.includes('energized')) {
    scaling_response = 'positive';
  } else if (text.includes('pressure') || text.includes('overwhelm') || text.includes('exhaust') || text.includes('strain')) {
    scaling_response = 'resistance';
  } else if (text.includes('disbelief') || text.includes('unrealistic') || text.includes('impossible')) {
    scaling_response = 'ceiling';
  } else if (text.includes('both') || text.includes('mix')) {
    scaling_response = 'ambivalent';
  }
  
  // Detect vision clarity
  const vision_words = (text.match(/\b(mission|vision|value|belief|perspective)\b/g) || []).length;
  const vision_clarity = vision_words > 3 ? 'articulated' : vision_words > 0 ? 'partial' : 'absent';
  
  // Detect priority clarity (time/money/freedom/etc)
  const priority_stated = /time|money|freedom|stability|impact|growth/i.test(text);
  
  return {
    scaling_response,
    vision_clarity,
    priority_stated,
    word_count: answerText.split(/\s+/).length
  };
}

/**
 * Analyze Q28 (Systems, accountability, self-awareness)
 */
export function analyzeSystemsAccountability(answerText) {
  if (!answerText || typeof answerText !== 'string') return null;
  
  const text = String(answerText).toLowerCase();
  
  // Detect systems thinking
  const system_words = (text.match(/\b(system|process|habit|tool|crm|follow|organize)\b/g) || []).length;
  const systems_thinking = system_words > 5 ? 'high' : system_words > 2 ? 'moderate' : 'low';
  
  // Detect system confidence
  const confidence_positive = text.includes('working well') || text.includes('strong') || text.includes('effective');
  const confidence_negative = text.includes('not strong') || text.includes('concern') || text.includes('struggling');
  const system_confidence = confidence_positive && !confidence_negative ? 'high' : 
                            confidence_negative ? 'low' : 'uncertain';
  
  // Detect accountability structure
  const has_accountability = text.includes('coach') || text.includes('accountability') || 
                             text.includes('partner') || text.includes('manager');
  
  // Detect coachability signals
  let coachability = 'not_answered';
  if (text.includes('coachable')) {
    if (text.includes('yes') || text.includes('open') || text.includes('willing')) {
      coachability = 'claimed_yes';
    } else if (text.includes('but') || text.includes('depends') || text.includes('resistant')) {
      coachability = 'qualified';
    }
  }
  
  // Detect meta-reflection depth
  const reflection_words = (text.match(/\b(realize|notice|aware|think|feel|concern)\b/g) || []).length;
  const meta_awareness = reflection_words > 4 ? 'high' : reflection_words > 1 ? 'moderate' : 'low';
  
  return {
    systems_thinking,
    system_confidence,
    has_accountability_structure: has_accountability,
    coachability,
    meta_awareness,
    word_count: answerText.split(/\s+/).length
  };
}

/**
 * Main analysis orchestrator
 * 
 * @param {Object} profileInput - Profile input with raw_answers
 * @returns {Object} analyzed_responses
 */
export function analyzeLongFormAnswers(profileInput) {
  const rawAnswers = profileInput.raw_answers || {};
  
  // Analyze Q2 (life direction)
  const q2 = rawAnswers.q2;
  const life_direction = q2 ? analyzeLifeDirection(q2.answer_text) : null;
  
  // Analyze Q24 (stall patterns)
  const q24 = rawAnswers.q24;
  const stall_patterns = q24 ? analyzeStallPatterns(q24.answer_text) : null;
  
  // Analyze Q26 (business reality)
  const q26 = rawAnswers.q26;
  const business_reality = q26 ? analyzeBusinessReality(q26.answer_text) : null;
  
  // Analyze Q27 (growth tension)
  const q27 = rawAnswers.q27;
  const growth_tension = q27 ? analyzeGrowthTension(q27.answer_text) : null;
  
  // Analyze Q28 (systems/accountability)
  const q28 = rawAnswers.q28;
  const systems_accountability = q28 ? analyzeSystemsAccountability(q28.answer_text) : null;
  
  return {
    life_direction,
    stall_patterns,
    business_reality,
    growth_tension,
    systems_accountability
  };
}
