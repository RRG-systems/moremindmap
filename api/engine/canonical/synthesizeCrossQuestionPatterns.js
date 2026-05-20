/**
 * synthesizeCrossQuestionPatterns.js
 * 
 * CRITICAL INTELLIGENCE LAYER
 * 
 * Synthesizes patterns ACROSS answers to detect:
 * - Values vs operational reality gaps
 * - Self-perception vs behavioral evidence mismatches
 * - Aspiration vs capability ceilings
 * - Claimed traits vs operational defaults
 * 
 * This is where "eerily accurate" comes from.
 */

/**
 * Detect values vs operational reality gap
 * 
 * Q2 claims family matters most
 * BUT Q26/Q27 reveal extreme work obsession
 * → identity tension or aspiration vs reality gap
 */
function detectValuesRealityGap(lifeDirection, businessReality, growthTension) {
  const gaps = [];
  
  if (!lifeDirection || !businessReality) return gaps;
  
  // Family stated but business answers dominate
  const statesFamily = lifeDirection.stated_priorities.includes('family');
  const businessFocused = businessReality.word_count > 200; // substantial business detail
  
  if (statesFamily && businessFocused) {
    gaps.push({
      type: 'values_vs_operational_priority',
      tension: 'States family matters most but operational reality reveals work dominance',
      manifestation: 'Identity tension between stated values and actual time/energy allocation',
      severity: 'moderate'
    });
  }
  
  // Claims balance but growth response shows pure work orientation
  if (lifeDirection.stated_priorities.includes('freedom') && 
      growthTension?.scaling_response === 'positive') {
    gaps.push({
      type: 'freedom_vs_growth_ambition',
      tension: 'Values freedom but emotionally positive about 3x growth (which constrains freedom)',
      manifestation: 'Unresolved tension between autonomy and scale ambition',
      severity: 'mild'
    });
  }
  
  return gaps;
}

/**
 * Detect self-perception vs behavioral evidence mismatch
 * 
 * User claims coachability
 * BUT all leadership language shows rigidity
 * → self-perception mismatch
 */
function detectSelfPerceptionMismatch(systemsAccountability, stallPatterns, vectorScores) {
  const mismatches = [];
  
  if (!systemsAccountability) return mismatches;
  
  // Claims coachable but high rigidity signals
  const claimsCoachable = systemsAccountability.coachability === 'claimed_yes';
  const highRigidity = (vectorScores.framework || 0) > 6.5 && (vectorScores.flex || 0) < 4.0;
  
  if (claimsCoachable && highRigidity) {
    mismatches.push({
      type: 'coachability_claim_vs_rigidity',
      tension: 'Claims coachability but dimension profile shows structural rigidity',
      manifestation: 'Open to coaching within established framework, resistant to framework changes',
      severity: 'moderate'
    });
  }
  
  // Claims high self-awareness but external blame dominant
  const claimsAwareness = systemsAccountability.meta_awareness === 'high';
  const externalBlame = stallPatterns?.blame_direction === 'external';
  
  if (claimsAwareness && externalBlame) {
    mismatches.push({
      type: 'awareness_claim_vs_blame_pattern',
      tension: 'High meta-awareness language but stall analysis externalizes bottlenecks',
      manifestation: 'Aware of own patterns but attributes friction to external factors',
      severity: 'mild'
    });
  }
  
  return mismatches;
}

/**
 * Detect growth ceiling vs ambition tension
 * 
 * User wants scale
 * BUT triple-goal scenario triggers fear/resistance language
 * → growth ceiling tension
 */
function detectGrowthCeilingTension(growthTension, businessReality) {
  const tensions = [];
  
  if (!growthTension) return tensions;
  
  // Ambitious goals but resistance to scale
  const hasAmbitiousGoals = businessReality?.word_count > 100; // detailed business vision
  const scaleResistance = growthTension.scaling_response === 'resistance' || 
                          growthTension.scaling_response === 'ceiling';
  
  if (hasAmbitiousGoals && scaleResistance) {
    tensions.push({
      type: 'ambition_vs_scaling_resistance',
      tension: 'Describes ambitious goals but emotional response to 3x growth shows resistance',
      manifestation: 'Growth ceiling exists below stated ambition — internal capacity limit not consciously recognized',
      severity: 'high'
    });
  }
  
  // Positive scale response but no system confidence
  const scalePositive = growthTension.scaling_response === 'positive';
  const weakSystems = businessReality?.system_confidence === 'low';
  
  if (scalePositive && weakSystems) {
    tensions.push({
      type: 'growth_ambition_vs_infrastructure',
      tension: 'Emotionally positive about growth but systems insufficient to support scale',
      manifestation: 'Ambition outpaces operational infrastructure — likely to hit execution ceiling',
      severity: 'moderate'
    });
  }
  
  return tensions;
}

/**
 * Synthesize all cross-question patterns
 * 
 * @param {Object} analyzedResponses - Output from analyzeLongFormAnswers
 * @param {Object} vectorScores - Dimension scores
 * @returns {Array} cross_question_tensions
 */
export function synthesizeCrossQuestionPatterns(analyzedResponses, vectorScores) {
  const {
    life_direction,
    stall_patterns,
    business_reality,
    growth_tension,
    systems_accountability
  } = analyzedResponses;
  
  const tensions = [];
  
  // Detect values vs reality gaps
  const valuesGaps = detectValuesRealityGap(life_direction, business_reality, growth_tension);
  tensions.push(...valuesGaps);
  
  // Detect self-perception mismatches
  const perceptionMismatches = detectSelfPerceptionMismatch(systems_accountability, stall_patterns, vectorScores);
  tensions.push(...perceptionMismatches);
  
  // Detect growth ceiling tensions
  const growthCeilings = detectGrowthCeilingTension(growth_tension, business_reality);
  tensions.push(...growthCeilings);
  
  return tensions;
}
