// buildProfileInput.js - Canonical Profile Input Pipeline V1
// Converts raw assessment answers into normalized interpreter payload
// Created: Tue May 12, 2026 21:33 MST

import { QUESTION_MAP } from './questionMap.js';
import { DIMENSIONS, DIMENSION_LABELS, DIMENSION_TRADEOFFS } from './dimensionMap.js';

/**
 * BuildProfileInput
 * 
 * Main pipeline to convert raw assessment data into canonical profile_input object
 * that will be consumed by GPT-5.5 for report generation.
 */

export class BuildProfileInput {
  constructor() {
    this.QUESTION_MAP = QUESTION_MAP;
    this.DIMENSIONS = DIMENSIONS;
    this.DIMENSION_LABELS = DIMENSION_LABELS;
    this.DIMENSION_TRADEOFFS = DIMENSION_TRADEOFFS;
  }

  /**
   * Main entry point
   * @param {Object} rawAssessment - Raw frontend payload with answers
   * @returns {Object} Canonical profile_input object
   */
  build(rawAssessment) {
    const metadata = this.buildMetadata(rawAssessment);
    const rawAnswers = this.buildRawAnswers(rawAssessment);
    const dimensionScores = this.buildDimensionScores(rawAnswers);
    const topSystems = this.buildTopSystems(dimensionScores);
    const writtenResponses = this.buildWrittenResponses(rawAnswers);
    const languageSignals = this.buildLanguageSignals(writtenResponses);
    const contradictions = this.buildContradictions(rawAnswers, dimensionScores, writtenResponses);
    const pressureAnalysis = this.buildPressureAnalysis(writtenResponses);
    const profileFlags = this.buildProfileFlags(dimensionScores, contradictions, pressureAnalysis);
    const confidenceEngine = this.buildConfidenceEngine(metadata, contradictions, writtenResponses);

    return {
      metadata,
      raw_answers: rawAnswers,
      dimension_scores: dimensionScores,
      top_systems: topSystems,
      written_responses: writtenResponses,
      language_signals: languageSignals,
      contradictions,
      pressure_analysis: pressureAnalysis,
      profile_flags: profileFlags,
      confidence_engine: confidenceEngine
    };
  }

  buildMetadata(rawAssessment) {
    return {
      assessment_id: rawAssessment.assessment_id || `ast_${Date.now()}`,
      generated_at: new Date().toISOString(),
      profile_version: 'mini-v2',
      question_set_version: 'set_1_v1',
      question_count: 28,
      written_response_count: 10,
      multiple_choice_count: 18,
      confidence_score: 0.75, // Will be refined by confidence engine
      assessment_duration_seconds: rawAssessment.duration_seconds || 0,
      completion_date: new Date().toISOString(),
      data_quality: this.assessDataQuality(rawAssessment)
    };
  }

  assessDataQuality(rawAssessment) {
    let quality = 'high';
    let penalties = 0;

    // Check written response depth (updated for 28-question intake)
    const writtenResponses = Object.entries(rawAssessment.answers || {})
      .filter(([key, val]) => key.startsWith('q') && [2, 19, 20, 21, 22, 23, 24, 26, 27, 28].includes(parseInt(key.slice(1))))
      .map(([, val]) => {
        // Safe text extraction
        if (typeof val === 'string') return val;
        if (val && typeof val === 'object' && val.text) return String(val.text);
        if (val && typeof val === 'object' && val.answer) return String(val.answer);
        if (val && typeof val === 'object' && val.value) return String(val.value);
        return '';
      });

    const avgWrittenLength = writtenResponses.reduce((sum, t) => sum + (t || '').length, 0) / writtenResponses.length;
    if (avgWrittenLength < 30) penalties += 1;

    // Check for defensive language (crude heuristic)
    const defensiveMarkers = ['shouldn\'t', 'wasn\'t', 'not my', 'miscommunication', 'they didn\'t'];
    const defensiveCount = writtenResponses.reduce((sum, t) => {
      // Safe string operation
      const text = typeof t === 'string' ? t : String(t || '');
      return sum + defensiveMarkers.filter(m => text.toLowerCase().includes(m)).length;
    }, 0);
    if (defensiveCount > 3) penalties += 1;

    // Assign quality based on penalties
    if (penalties >= 2) quality = 'low';
    else if (penalties === 1) quality = 'moderate';

    return quality;
  }

  buildRawAnswers(rawAssessment) {
    const rawAnswers = {};
    const questions = QUESTION_MAP.set_1.v1;

    // GUARD: Ensure rawAssessment has answers object (prevent undefined access crash)
    if (!rawAssessment || !rawAssessment.answers || typeof rawAssessment.answers !== 'object') {
      console.warn('[buildRawAnswers] GUARD: rawAssessment.answers is missing or invalid', {
        has_rawAssessment: !!rawAssessment,
        has_answers: !!rawAssessment?.answers,
        answers_type: typeof rawAssessment?.answers
      });
      return rawAnswers; // Return empty answers (safe fallback - triggers neutral scores)
    }

    questions.forEach(question => {
      const answer = rawAssessment.answers[`q${question.id}`];
      
      // GUARD: Skip if answer is missing (don't crash on undefined.property)
      if (!answer) {
        console.warn(`[buildRawAnswers] GUARD: Missing answer for q${question.id}`);
        return; // Continue loop
      }
      
      if (question.type === 'mc' || question.type === 'ranking') {
        // GUARD: MC/ranking answer must have choice property
        if (!answer.choice) {
          console.warn(`[buildRawAnswers] GUARD: ${question.type.toUpperCase()} q${question.id} missing choice`);
          return; // Skip this answer
        }
        
        // Find the answer option text from question.answers array (new structure)
        const answerOption = question.answers?.find(opt => opt.key === answer.choice);
        const answerText = answerOption?.text || 'Unknown';
        
        // Get normalized_dimensions from question (new structure)
        const normalizedDims = question.normalized_dimensions?.[answer.choice] || {};
        
        rawAnswers[`q${question.id}`] = {
          question_id: question.id,
          question_type: question.type,
          question_text: question.text,
          answer_choice: answer.choice,
          answer_text: answerText,
          normalized_dimensions: normalizedDims
        };
      } else if (question.type === 'written') {
        rawAnswers[`q${question.id}`] = {
          question_id: question.id,
          question_type: 'written',
          question_text: question.text,
          answer_text: answer.text || '',
          character_count: (answer.text || '').length,
          word_count: (answer.text || '').split(/\s+/).length,
          sentence_count: (answer.text || '').split(/[.!?]+/).length - 1
        };
      }
    });

    return rawAnswers;
  }

  buildDimensionScores(rawAnswers) {
    const scores = {};

    DIMENSIONS.forEach(dim => {
      const contributingAnswers = [];
      let totalScore = 0;
      let answerCount = 0;

      Object.entries(rawAnswers).forEach(([key, answer]) => {
        if (answer.normalized_dimensions && answer.normalized_dimensions[dim]) {
          totalScore += answer.normalized_dimensions[dim];
          answerCount += 1;
          contributingAnswers.push(answer.question_id);
        }
      });

      const rawScore = answerCount > 0 ? totalScore / answerCount : 0;
      const evidenceBand = this.getEvidenceBand(answerCount);
      const supportFactor = Math.min(1, answerCount / 3);
      const supportAdjustedScore = rawScore * supportFactor;
      scores[dim] = {
        raw_score: Math.round(rawScore * 100) / 100,
        support_adjusted_score: Math.round(supportAdjustedScore * 100) / 100,
        normalized_percent: Math.round((rawScore / 4.0) * 100),
        confidence: this.calculateDimensionConfidence(rawAnswers, dim),
        evidence_count: answerCount,
        contributing_answer_count: answerCount,
        distance_from_neutral: Math.round(Math.abs(supportAdjustedScore) * 100) / 100,
        evidence_band: evidenceBand,
        intensity_band: this.getIntensityBand(supportAdjustedScore, answerCount),
        contributing_answers: contributingAnswers,
        label: DIMENSION_LABELS[dim],
        description: this.getDimensionDescription(dim)
      };
    });

    // Assign ranks; no-evidence dimensions should never outrank evidence-backed dimensions.
    const sortedDims = Object.entries(scores).sort((a, b) => {
      const aEvidence = a[1].evidence_count || 0;
      const bEvidence = b[1].evidence_count || 0;
      if (aEvidence === 0 && bEvidence > 0) return 1;
      if (bEvidence === 0 && aEvidence > 0) return -1;
      return b[1].support_adjusted_score - a[1].support_adjusted_score;
    });
    sortedDims.forEach(([dim, data], index) => {
      scores[dim].rank = index + 1;
    });

    return scores;
  }

  calculateDimensionConfidence(rawAnswers, dimension) {
    const contributingAnswers = Object.values(rawAnswers).filter(a => a.normalized_dimensions && a.normalized_dimensions[dimension]);
    let confidence = 0.75; // Base
    
    if (contributingAnswers.length === 0) return 0.2;
    if (contributingAnswers.length < 3) confidence = 0.45;
    else if (contributingAnswers.length < 5) confidence = 0.65;
    if (contributingAnswers.some(a => a.question_type === 'written')) confidence += 0.1;

    return Math.min(Math.max(confidence, 0.2), 1.0);
  }

  getEvidenceBand(evidenceCount) {
    if (evidenceCount === 0) return 'none';
    if (evidenceCount === 1) return 'thin';
    if (evidenceCount === 2) return 'moderate';
    return 'strong';
  }

  getIntensityBand(score, evidenceCount) {
    const absScore = Math.abs(score);
    if (absScore >= 0.85 && evidenceCount >= 3) return 'extreme';
    if (absScore >= 0.65 && evidenceCount >= 2) return 'high';
    if (absScore >= 0.35) return 'moderate';
    return 'low';
  }

  getDimensionDescription(dim) {
    const descriptions = {
      vector: 'Tendency to move toward clear direction; command bias',
      signal: 'Tendency to read room dynamics; relational calibration',
      fidelity: 'Tendency to prioritize precision; attention to detail',
      velocity: 'Tendency to prioritize speed; action bias',
      leverage: 'Tendency to influence through positioning; leverage',
      flex: 'Tendency to adapt; responsiveness to change',
      framework: 'Tendency to prefer structure; organizational preference',
      horizon: 'Tendency to think long-term; strategic perspective'
    };
    return descriptions[dim] || '';
  }

  buildTopSystems(dimensionScores) {
    const ranked = Object.entries(dimensionScores).sort((a, b) => a[1].rank - b[1].rank);

    return {
      primary_driver: {
        dimension: ranked[0][0],
        score: ranked[0][1].raw_score,
        rank: 1,
        description: this.getOperatingDescription(ranked[0][0], ranked[0][1].raw_score),
        operating_manifestation: this.getOperatingManifestation(ranked[0][0]),
        pressure_manifestation: this.getPressureManifestation(ranked[0][0])
      },
      secondary_stabilizer: {
        dimension: ranked[1][0],
        score: ranked[1][1].raw_score,
        rank: 2,
        description: this.getOperatingDescription(ranked[1][0], ranked[1][1].raw_score),
        operating_manifestation: this.getOperatingManifestation(ranked[1][0]),
        pressure_manifestation: this.getPressureManifestation(ranked[1][0])
      },
      opposing_pattern_1: {
        dimension: ranked[6][0],
        score: ranked[6][1].raw_score,
        rank: 7,
        description: this.getOperatingDescription(ranked[6][0], ranked[6][1].raw_score),
        operating_manifestation: this.getOperatingManifestation(ranked[6][0]),
        pressure_manifestation: this.getPressureManifestation(ranked[6][0])
      },
      opposing_pattern_2: {
        dimension: ranked[7][0],
        score: ranked[7][1].raw_score,
        rank: 8,
        description: this.getOperatingDescription(ranked[7][0], ranked[7][1].raw_score),
        operating_manifestation: this.getOperatingManifestation(ranked[7][0]),
        pressure_manifestation: this.getPressureManifestation(ranked[7][0])
      },
      dimension_tradeoffs: this.buildTradeoffs(dimensionScores),
      dimension_synergies: this.buildSynergies(dimensionScores)
    };
  }

  getOperatingDescription(dim, score) {
    const level = score > 2.5 ? 'high' : score > 1.5 ? 'moderate' : 'low';
    return `${level} ${this.DIMENSION_LABELS[dim]}`;
  }

  getOperatingManifestation(dim) {
    const manifestations = {
      vector: 'Enters situations with direction already forming; pulls team toward action',
      signal: 'Reads room tension before people speak; adjusts based on perceived dynamics',
      fidelity: 'Catches errors others miss; verifies assumptions before moving',
      velocity: 'Prefers speed; moves to action quickly; impatient with deliberation',
      leverage: 'Positions influence strategically; thinks about who needs to agree',
      flex: 'Adjusts approach based on context; comfortable with pivot and iteration',
      framework: 'Prefers clear process and structure; comfortable with defined roles',
      horizon: 'Thinks multi-move ahead; connects current decisions to future states'
    };
    return manifestations[dim] || '';
  }

  getPressureManifestation(dim) {
    const pressures = {
      vector: 'Under strain, decisiveness increases; moves faster, reads less',
      signal: 'Under strain, relational awareness increases; can create hesitation',
      fidelity: 'Under strain, precision preference increases; can create delays',
      velocity: 'Under strain, speed preference increases; detail drops',
      leverage: 'Under strain, leverage-focus increases; relationship-focus drops',
      flex: 'Under strain, flexibility decreases; retreats to familiar patterns',
      framework: 'Under strain, structure-preference increases; rigidity increases',
      horizon: 'Under strain, strategic perspective may narrow; near-term focus only'
    };
    return pressures[dim] || '';
  }

  buildTradeoffs(dimensionScores) {
    const tradeoffs = [];
    const high = Object.entries(dimensionScores).filter(([, data]) => data.raw_score > 2.5).map(([dim]) => dim);
    const low = Object.entries(dimensionScores).filter(([, data]) => data.raw_score < 1.5).map(([dim]) => dim);

    high.forEach(highDim => {
      (DIMENSION_TRADEOFFS[highDim] || []).forEach(lowDim => {
        if (high.includes(lowDim) || low.includes(lowDim)) {
          tradeoffs.push({
            dimensions: [highDim, lowDim],
            tradeoff: `${this.DIMENSION_LABELS[highDim]} creates friction with ${this.DIMENSION_LABELS[lowDim]}`,
            cost: `Under time pressure, ${highDim} preference overrides ${lowDim}`
          });
        }
      });
    });

    return tradeoffs;
  }

  buildSynergies(dimensionScores) {
    const high = Object.entries(dimensionScores).filter(([, data]) => data.raw_score > 2.5).map(([dim]) => dim);
    
    if (high.includes('vector') && high.includes('fidelity')) {
      return [{
        dimensions: ['vector', 'fidelity'],
        synergy: 'Command + Precision = decisive with evidence',
        benefit: 'Clear decisions backed by detail'
      }];
    }

    return [];
  }

  buildWrittenResponses(rawAnswers) {
    // Step 2C Expansion: Now 10 written questions (Q2, Q19, Q20, Q21, Q22, Q23, Q24, Q25, Q26, Q27, Q28)
    // Q19-Q23 are from original set
    // Q24-Q28 are Step 2C additions (business/leadership/systems)
    const writtenIds = [2, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28];
    const responses = {};

    writtenIds.forEach(id => {
      const answer = rawAnswers[`q${id}`];
      if (answer && answer.question_type === 'written') {
        responses[`q${id}_written`] = {
          question_id: id,
          question_text: answer.question_text,
          response_text: answer.answer_text,
          metadata: {
            word_count: answer.word_count,
            character_count: answer.character_count,
            sentence_count: answer.sentence_count,
            paragraph_count: (answer.answer_text || '').split(/\n\n+/).length
          },
          extraction_signals: this.extractLanguageSignals(answer.answer_text)
        };
      }
    });

    return responses;
  }

  extractLanguageSignals(text) {
    const blameWords = ['they', 'them', 'their', 'others', 'wasn\'t', 'shouldn\'t', 'they didn\'t'];
    const ownershipWords = ['I', 'me', 'my', 'I realized', 'I changed', 'I adjusted'];
    const defensiveWords = ['shouldn\'t have', 'wasn\'t my', 'miscommunication', 'they didn\'t'];

    const blameMentions = blameWords.filter(w => text.toLowerCase().includes(w.toLowerCase())).length;
    const ownershipMentions = ownershipWords.filter(w => text.toLowerCase().includes(w.toLowerCase())).length;
    const defensiveMentions = defensiveWords.filter(w => text.toLowerCase().includes(w.toLowerCase())).length;

    return {
      blame_mentions: blameMentions,
      ownership_mentions: ownershipMentions,
      abstraction_level: this.calculateAbstractionLevel(text),
      emotional_tone: defensiveMentions > 2 ? 'defensive' : 'neutral',
      certainty_level: text.includes('maybe') || text.includes('perhaps') ? 2 : 4,
      narrative_density: Math.min(5, Math.ceil(text.split(/\s+/).length / 30))
    };
  }

  calculateAbstractionLevel(text) {
    // Simple heuristic: count theoretical vs concrete language
    const abstractMarkers = ['system', 'pattern', 'mechanism', 'process', 'tendency', 'typically'];
    const concreteMarkers = ['I did', 'I said', 'they said', 'happened', 'specific'];
    
    const abstractCount = abstractMarkers.filter(m => text.toLowerCase().includes(m)).length;
    const concreteCount = concreteMarkers.filter(m => text.toLowerCase().includes(m)).length;
    
    if (abstractCount > concreteCount) return 4;
    if (concreteCount > abstractCount) return 2;
    return 3;
  }

  buildLanguageSignals(writtenResponses) {
    const signals = {
      blame_pattern: {
        total_blame_mentions: 0,
        total_ownership_mentions: 0,
        interpretation: 'Balanced'
      },
      abstraction_level: {
        average_abstraction: 3,
        pattern: 'Mixed'
      },
      emotional_compression: {
        emotional_tone: 'Moderate'
      },
      defensiveness: {
        defensiveness_score: 0,
        interpretation: 'Not-defensive'
      }
    };

    Object.values(writtenResponses).forEach(resp => {
      signals.blame_pattern.total_blame_mentions += resp.extraction_signals.blame_mentions;
      signals.blame_pattern.total_ownership_mentions += resp.extraction_signals.ownership_mentions;
      signals.abstraction_level.average_abstraction += resp.extraction_signals.abstraction_level;
      signals.defensiveness.defensiveness_score += resp.extraction_signals.emotional_tone === 'defensive' ? 1 : 0;
    });

    signals.abstraction_level.average_abstraction = Math.round(signals.abstraction_level.average_abstraction / Object.keys(writtenResponses).length);
    
    const blameRatio = signals.blame_pattern.total_blame_mentions / (signals.blame_pattern.total_blame_mentions + signals.blame_pattern.total_ownership_mentions + 1);
    if (blameRatio > 0.6) signals.blame_pattern.interpretation = 'Blame-external';
    else if (blameRatio < 0.4) signals.blame_pattern.interpretation = 'Ownership-internal';

    return signals;
  }

  buildContradictions(rawAnswers, dimensionScores, writtenResponses) {
    const contradictions = [];

    // Example: high vector score but written description shows collaborative pattern
    if (dimensionScores.vector.raw_score > 2.5) {
      const writtenText = Object.values(writtenResponses).map(r => r.response_text).join(' ');
      if (writtenText.includes('collaborative') || writtenText.includes('gather')) {
        contradictions.push({
          contradiction_id: 'mc_written_01',
          type: 'MC_vs_Written',
          contradiction: 'High vector (command) but written shows collaborative pattern',
          interpretation: 'Gap between aspiration (collaborative) and default (command)',
          severity: 'moderate',
          confidence: 0.75
        });
      }
    }

    return {
      mc_vs_written: contradictions,
      total_contradictions: contradictions.length,
      contradiction_severity_summary: contradictions.length === 0 ? 'none' : 'moderate'
    };
  }

  buildPressureAnalysis(writtenResponses) {
    const q15 = writtenResponses.q15_written;
    const q24 = writtenResponses.q24_written;

    return {
      immediate_stress_response: {
        source: 'Q15',
        pattern_type: q15 ? this.inferPressurePattern(q15.response_text) : 'unknown',
        description: 'What happens first when stressed'
      },
      sustained_stress_response: {
        source: 'Q24',
        pattern_type: q24 ? this.inferPressurePattern(q24.response_text) : 'unknown',
        description: 'What happens after sustained strain'
      },
      pressure_indicators: this.derivePressureIndicators(q15, q24)
    };
  }

  inferPressurePattern(text) {
    if (text.includes('structure') || text.includes('process')) return 'Tighter+Faster';
    if (text.includes('input') || text.includes('feedback')) return 'Slower+Deeper';
    if (text.includes('familiar') || text.includes('retreat')) return 'Withdrawal+Rigidity';
    if (text.includes('delegate') || text.includes('accelerate')) return 'Acceleration+Delegation';
    return 'Unknown';
  }

  derivePressureIndicators(q15, q24) {
    const indicators = [];
    
    if (q15 && q15.response_text.includes('tighter')) indicators.push('high_rigidity_under_strain');
    if (q24 && q24.response_text.includes('control')) indicators.push('over_control_risk');
    if (q15 && q15.extraction_signals.abstraction_level >= 4) indicators.push('intellectualization_under_stress');

    return indicators;
  }

  buildProfileFlags(dimensionScores, contradictions, pressureAnalysis) {
    return {
      high_rigidity: {
        flag: dimensionScores.flex.raw_score < 1.5,
        severity: dimensionScores.flex.raw_score < 1.5 ? 7 : 0
      },
      over_control_risk: {
        flag: dimensionScores.framework.raw_score > 2.5 && dimensionScores.vector.raw_score > 2.5,
        severity: dimensionScores.framework.raw_score > 2.5 && dimensionScores.vector.raw_score > 2.5 ? 6 : 0
      },
      collaboration_instability: {
        flag: contradictions.total_contradictions > 0,
        severity: contradictions.total_contradictions > 0 ? 5 : 0
      },
      relational_blindness: {
        flag: dimensionScores.signal.raw_score < 1.5,
        severity: dimensionScores.signal.raw_score < 1.5 ? 6 : 0
      }
    };
  }

  buildConfidenceEngine(metadata, contradictions, writtenResponses) {
    let baseConfidence = 0.75;

    // Adjust based on written response depth
    const avgWrittenLength = Object.values(writtenResponses).reduce((sum, r) => sum + r.response_text.length, 0) / Object.keys(writtenResponses).length;
    if (avgWrittenLength < 50) baseConfidence -= 0.15;
    else if (avgWrittenLength > 200) baseConfidence += 0.05;

    // Adjust based on contradictions
    if (contradictions.total_contradictions > 2) baseConfidence -= 0.2;

    baseConfidence = Math.min(Math.max(baseConfidence, 0.5), 1.0);

    return {
      overall_confidence: Math.round(baseConfidence * 100) / 100,
      section_confidence: {
        dimension_scores: 0.8,
        written_responses: baseConfidence,
        pressure_analysis: 0.7,
        contradictions: 0.65,
        language_signals: 0.7
      }
    };
  }
}

export default BuildProfileInput;

// Wrapper function for serverless compatibility
export async function buildProfileInput(answers) {
  const builder = new BuildProfileInput();
  return await builder.build(answers);
}
