/**
 * Build District Director Role Fit dashboard view model.
 *
 * Hybrid V1H: BOS + Fathom DD role model + deterministic scoring guardrail
 * + free-text evidence + optional GPT-5.5 evidence interpretation.
 * GPT interprets; deterministic code applies bounded adjustments.
 * Read-only. No Redis writes. No profile mutation.
 */

import { getDefaultDistrictDirectorRoleModel } from './roleModels/index.js';
import {
  extractBosSignalMap,
  extractProfileIdentity,
  extractNarrativeHints,
  scoreRoleDimension,
  computeWeightedOverall,
  computeGrowthWeightedOverall,
  computeAnalysisConfidence,
  classifyOverallVerdict,
  resolveEvidenceParse,
  applyEvidenceToDimensions,
  classifyComplianceOperationsRisk,
  classifySupportRequired,
} from './roleFitScoring.js';

/**
 * @param {object} options
 * @param {object} options.profilePayload - Response from /api/moremindmap/retrieve-profile
 * @param {string} [options.profileId]
 * @param {object} [options.roleModel] - defaults to Fathom DD v1
 * @param {object} [options.context] - optional market_size, current_agents
 * @param {string} [options.performanceEvidence] - local-only known performance evidence (not persisted)
 * @param {object|null} [options.gptEvidenceInterpretation] - structured GPT interpretation (optional)
 * @param {boolean} [options.forceDeterministicEvidence=false] - skip GPT mapping
 * @param {string|null} [options.evidenceInterpretationSource] - audit label from caller
 * @param {string|null} [options.evidenceFallbackMessage]
 * @param {string|null} [options.gptModelUsed]
 * @returns {object} dashboard view model
 */
export function buildDistrictDirectorFit({
  profilePayload,
  profileId = '',
  roleModel = null,
  context = {},
  performanceEvidence = '',
  gptEvidenceInterpretation = null,
  forceDeterministicEvidence = false,
  evidenceInterpretationSource = null,
  evidenceFallbackMessage = null,
  gptModelUsed = null,
} = {}) {
  const model = roleModel || getDefaultDistrictDirectorRoleModel();
  const analyzedAt = new Date().toISOString();

  if (!profilePayload || typeof profilePayload !== 'object') {
    return buildErrorModel(model, profileId, analyzedAt, 'No profile payload provided.');
  }

  const identity = extractProfileIdentity(profilePayload, profileId);
  const { signals, availableCount, totalExpected, ranked, data } =
    extractBosSignalMap(profilePayload);
  const hints = extractNarrativeHints(profilePayload);

  // Behavioral dimensions — BOS only, no external evidence
  const behavioralDimensions = (model.dimensions || []).map((dimDef) =>
    scoreRoleDimension(dimDef, signals),
  );

  const {
    evidenceParse,
    interpretation_source: resolvedSource,
    fallback_used: evidenceFallbackUsed,
    fallback_message: resolvedFallbackMessage,
  } = resolveEvidenceParse(performanceEvidence, gptEvidenceInterpretation, {
    forceDeterministic: forceDeterministicEvidence,
  });

  const interpretationSource =
    evidenceInterpretationSource ||
    resolvedSource ||
    (evidenceParse.has_input ? 'deterministic_fallback' : 'none');
  const fallbackMessage =
    evidenceFallbackMessage ||
    resolvedFallbackMessage ||
    (evidenceFallbackUsed
      ? 'Evidence interpretation unavailable. Deterministic fallback applied.'
      : null);

  const {
    dimensions: evidenceDimensions,
    growth_boost_applied,
    growth_boost_points,
    growth_penalty_applied,
    growth_penalty_points,
    compliance_penalty_applied,
    support_penalty_applied,
    adjustments: evidenceAdjustments,
  } = applyEvidenceToDimensions(behavioralDimensions, evidenceParse);

  // Behavioral overall: growth-weighted BOS-only (no excellence/underperformance blend)
  const behavioralOverallMeta = computeGrowthWeightedOverall(behavioralDimensions, {
    strongRecruitingEvidence: false,
    negativeRecruitingEvidence: false,
  });
  const behavioralVerdict = classifyOverallVerdict(
    behavioralOverallMeta.overall_percent,
    model.verdict_bands || [],
  );

  // Evidence-adjusted / Overall: growth-weighted with +/− evidence calibration
  const evidenceOverallMeta = computeGrowthWeightedOverall(evidenceDimensions, {
    strongRecruitingEvidence: Boolean(
      evidenceParse.strong_recruiting_evidence || evidenceParse.positive_recruiting,
    ),
    negativeRecruitingEvidence: Boolean(
      evidenceParse.strong_negative_recruiting_evidence || evidenceParse.negative_recruiting,
    ),
  });
  const evidenceVerdict = classifyOverallVerdict(
    evidenceOverallMeta.overall_percent,
    model.verdict_bands || [],
  );

  // Headline overall = evidence-adjusted business score (includes optional evidence)
  const overallMeta = evidenceOverallMeta;
  const verdict = evidenceVerdict;

  const confidence = computeAnalysisConfidence({
    availableCount,
    totalExpected,
    coverage_ratio: overallMeta.coverage_ratio,
  });

  const growthDim = evidenceDimensions.find((d) => d.id === 'recruiting_growth_drive');
  const behavioralGrowthDim = behavioralDimensions.find(
    (d) => d.id === 'recruiting_growth_drive',
  );

  const complianceOpsRisk = classifyComplianceOperationsRisk(
    evidenceDimensions,
    evidenceParse,
  );
  const riskPattern = buildRiskPattern(evidenceDimensions, hints, verdict, evidenceParse);
  const supportRequired = classifySupportRequired(
    evidenceDimensions,
    riskPattern.risk_level,
    evidenceParse,
  );

  const bestUse = buildBestUse(evidenceDimensions, identity, hints, model, evidenceParse);
  const oneMove = buildOneMove(evidenceDimensions, hints, verdict, evidenceParse);
  const technicalSource = buildTechnicalSource(
    model,
    availableCount,
    totalExpected,
    ranked,
    evidenceParse,
  );

  const scoreStack = buildScoreStack({
    overallMeta,
    verdict,
    behavioralOverallMeta,
    behavioralVerdict,
    evidenceOverallMeta,
    evidenceVerdict,
    growthDim,
    behavioralGrowthDim,
    complianceOpsRisk,
    supportRequired,
    evidenceParse,
    model,
  });

  return {
    ok: true,
    analyzed_at: analyzedAt,
    role_model: {
      role_model_id: model.role_model_id,
      label: model.label,
      version: model.version,
      source_document: model.source?.document || 'DD Agreement 2025',
      growth_target: model.growth_target?.value || '4%+ monthly',
    },
    analysis_engine: {
      label: model.analysis_engine?.display_label || 'Deterministic Role Fit Engine v1B',
      v1_label: model.analysis_engine?.v1_label,
      prepared_for: model.analysis_engine?.prepared_for,
      model_calls: false,
      scoring_mode: model.analysis_engine?.scoring_mode || 'deterministic_v1b_growth_weighted_evidence',
    },
    profile: {
      ...identity,
      avatar_placeholder: buildAvatarInitials(identity.name),
      date_analyzed: analyzedAt,
      active_status: identity.status || 'active',
    },
    analysis_context: {
      role_model: model.label,
      source_document: model.source?.document || 'DD Agreement 2025',
      analysis_engine: model.analysis_engine?.display_label,
      market_size: context.market_size || null,
      current_agents: context.current_agents || null,
      growth_target: model.growth_target?.value || '4%+ monthly',
      best_practice_recruiting: model.growth_target?.best_practice_recruiting || null,
      role_archetype: (model.role_archetype || []).map((a) => a.label),
      performance_evidence_summary: evidenceParse.summary,
      performance_evidence_entered: evidenceParse.has_input,
      performance_evidence_classification: evidenceParse.classification,
      performance_evidence_impact: evidenceParse.evidenceImpactSummary,
    },
    performance_evidence: {
      entered: evidenceParse.has_input,
      text: evidenceParse.raw,
      summary: evidenceParse.summary,
      classification: evidenceParse.classification,
      impact_label: classificationImpactLabel(evidenceParse.classification),
      evidence_impact_summary: evidenceParse.evidenceImpactSummary,
      score_adjustment_summary: evidenceParse.scoreAdjustmentSummary,
      affected_dimensions:
        evidenceParse.gpt_affected_dimensions?.length
          ? evidenceParse.gpt_affected_dimensions
          : evidenceParse.affectedDimensions || [],
      strong_recruiting_evidence: evidenceParse.strong_recruiting_evidence,
      strong_negative_recruiting_evidence: evidenceParse.strong_negative_recruiting_evidence,
      strong_negative_compliance_ops_evidence:
        evidenceParse.strong_negative_compliance_ops_evidence,
      positive_recruiting: evidenceParse.positive_recruiting,
      negative_recruiting: evidenceParse.negative_recruiting,
      negative_compliance_ops: evidenceParse.negative_compliance_ops,
      sustained_underperformance: evidenceParse.sustained_underperformance,
      detected_positive_signals: evidenceParse.detectedPositiveSignals || [],
      detected_negative_signals: evidenceParse.detectedNegativeSignals || [],
      matched_phrases: evidenceParse.matched_phrases,
      matched_positive_phrases: evidenceParse.matched_positive_phrases || [],
      matched_negative_phrases: evidenceParse.matched_negative_phrases || [],
      growth_boost_applied,
      growth_boost_points,
      growth_penalty_applied,
      growth_penalty_points,
      compliance_penalty_applied,
      support_penalty_applied,
      adjustments: evidenceAdjustments || [],
      // Explicit: evidence is local session state only — never written to profile/Redis
      persistence: 'local_component_state_only',
      // Interpreter audit (1H) — interpretation_label is user-facing; interpreter ids remain internal
      interpretation_source: interpretationSource,
      interpretation_label:
        interpretationSource === 'gpt'
          ? 'Intelligence layer'
          : interpretationSource === 'deterministic_fallback'
            ? 'Deterministic fallback'
            : interpretationSource === 'none'
              ? 'None'
              : String(interpretationSource),
      plain_english_summary:
        evidenceParse.plain_english_summary || evidenceParse.summary || null,
      board_safe_interpretation:
        evidenceParse.board_safe_interpretation || evidenceParse.evidenceImpactSummary || null,
      guardrail_note:
        evidenceParse.guardrail_note ||
        'Deterministic scoring remains the scoring guardrail. The intelligence layer may interpret evidence only.',
      recommended_adjustments: evidenceParse.recommended_adjustments || null,
      gpt_confidence: evidenceParse.gpt_confidence ?? null,
      gpt_signals: evidenceParse.gpt_signals || null,
      gpt_model_used: gptModelUsed || null,
      fallback_used: Boolean(
        evidenceFallbackUsed || interpretationSource === 'deterministic_fallback',
      ),
      fallback_message: fallbackMessage,
      applied_at: analyzedAt,
    },
    overall: {
      score_percent: overallMeta.overall_percent,
      verdict_id: verdict.id,
      verdict_label: verdict.label,
      summary: buildOverallSummary(verdict, evidenceParse, overallMeta),
      coverage_ratio: overallMeta.coverage_ratio,
      growth_weighted: true,
      weighting_note:
        model.overall_score_weighting_note ||
        'This overall score is intentionally weighted toward recruiting/growth because agent growth is the DD role’s primary economic performance lever. Compliance, operations, support, training, and partner advocacy remain critical risk and coaching dimensions and should be reviewed before making role decisions.',
      excellence_calibration_applied: Boolean(overallMeta.excellence_calibration_applied),
      underperformance_calibration_applied: Boolean(
        overallMeta.underperformance_calibration_applied,
      ),
      base_weighted_percent: overallMeta.base_weighted_percent ?? overallMeta.overall_percent,
    },
    behavioral_fit: {
      score_percent: behavioralOverallMeta.overall_percent,
      verdict_id: behavioralVerdict.id,
      verdict_label: behavioralVerdict.label,
      summary:
        'Behavioral Role Fit is the BOS-only growth-weighted baseline with no external performance evidence applied.',
    },
    evidence_adjusted_fit: {
      score_percent: evidenceOverallMeta.overall_percent,
      verdict_id: evidenceVerdict.id,
      verdict_label: evidenceVerdict.label,
      summary: buildEvidenceAdjustedSummary(evidenceParse),
    },
    score_stack: scoreStack,
    dimensions: evidenceDimensions,
    behavioral_dimensions: behavioralDimensions,
    best_use: bestUse,
    risk: {
      ...riskPattern,
      compliance_operations: complianceOpsRisk,
      support_required: supportRequired,
    },
    one_move: oneMove,
    technical_source: technicalSource,
    board_safe_disclaimer:
      model.board_safe_disclaimer ||
      'This is a hybrid behavioral + evidence-informed role alignment analysis. It surfaces natural strengths, risks, and targeted development opportunities to inform decisions. It is not a standalone hiring or placement tool and should be used alongside proven performance history, interviews, and reference checks.',
    confidence,
    locked_weights_used: true,
    scoring_mode: 'hybrid_v1h_gpt_evidence_plus_deterministic_guardrail',
    scoring_guardrail: 'deterministic_v1b_growth_weighted_evidence',
    evidence_intelligence: {
      interpreter:
        interpretationSource === 'gpt'
          ? 'gpt-5.5'
          : interpretationSource === 'deterministic_fallback'
            ? 'deterministic_keyword_parser'
            : 'none',
      fallback_used: Boolean(
        evidenceFallbackUsed || interpretationSource === 'deterministic_fallback',
      ),
      fallback_message: fallbackMessage,
      model_used: gptModelUsed || null,
      gpt_decides_final_score: false,
      deterministic_baseline_visible: true,
    },
    contract_evidence_statements: model.contract_evidence_statements || [],
    _debug: {
      bos_signals: signals,
      available_count: availableCount,
      total_expected: totalExpected,
      ranked_count: Array.isArray(ranked) ? ranked.length : 0,
      has_canonical: Boolean(data && Object.keys(data).length),
      behavioral_overall: behavioralOverallMeta.overall_percent,
      evidence_overall: evidenceOverallMeta.overall_percent,
      growth_boost_applied,
      growth_penalty_applied,
      evidence_classification: evidenceParse.classification,
    },
  };
}

function classificationImpactLabel(classification) {
  switch (classification) {
    case 'positive':
      return 'Positive';
    case 'negative':
      return 'Negative';
    case 'mixed':
      return 'Mixed';
    case 'neutral':
    default:
      return 'Neutral';
  }
}

function buildEvidenceAdjustedSummary(evidenceParse) {
  if (!evidenceParse?.has_input) {
    return 'No external performance evidence entered. Evidence-Adjusted Fit matches Behavioral Fit.';
  }
  const c = evidenceParse.classification;
  if (c === 'positive' && evidenceParse.positive_recruiting) {
    return 'Evidence-Adjusted Role Fit includes known performance evidence. Strong recruiting history materially lifts growth and overall DD fit; secondary risks remain visible.';
  }
  if (c === 'negative' && evidenceParse.negative_recruiting) {
    return 'Evidence-Adjusted Role Fit includes known underperformance evidence. Recruiting/growth shortfalls materially lower growth confidence and overall DD fit; Behavioral Fit remains the BOS baseline.';
  }
  if (c === 'negative') {
    return 'Evidence-Adjusted Role Fit includes known operational/compliance risk evidence. Growth is not automatically erased, but risk and support requirements rise.';
  }
  if (c === 'mixed') {
    return 'Evidence-Adjusted Role Fit reflects mixed known evidence — growth and risk/support dimensions may move in opposite directions. Behavioral Fit remains the BOS baseline.';
  }
  return 'Evidence was entered but no recognized positive or negative keywords drove automatic adjustments. Score closely matches behavioral baseline.';
}

function buildScoreStack({
  overallMeta,
  verdict,
  behavioralOverallMeta,
  behavioralVerdict,
  evidenceOverallMeta,
  evidenceVerdict,
  growthDim,
  behavioralGrowthDim,
  complianceOpsRisk,
  supportRequired,
  evidenceParse,
  model,
}) {
  let growthNote = 'Primary economic lever for the DD seat.';
  if (growthDim?.evidence_boost_applied && growthDim?.evidence_penalty_applied) {
    growthNote = 'Mixed recruiting evidence — net adjustment applied.';
  } else if (growthDim?.evidence_boost_applied) {
    growthNote = 'Elite or very strong when known recruiting evidence supports it.';
  } else if (growthDim?.evidence_penalty_applied) {
    growthNote = 'Reduced by known recruiting underperformance evidence.';
  }

  return {
    overall: {
      id: 'overall_dd_role_fit',
      label: 'Overall DD Role Fit',
      score_percent: overallMeta.overall_percent,
      verdict_id: verdict.id,
      verdict_label: verdict.label,
      prominence: 'primary',
      note: model.overall_score_weighting_note,
    },
    behavioral: {
      id: 'behavioral_role_fit',
      label: 'Behavioral Role Fit',
      score_percent: behavioralOverallMeta.overall_percent,
      verdict_id: behavioralVerdict.id,
      verdict_label: behavioralVerdict.label,
      prominence: 'secondary',
      note: 'BOS-only inference baseline — no external evidence.',
    },
    evidence_adjusted: {
      id: 'evidence_adjusted_role_fit',
      label: 'Evidence-Adjusted Role Fit',
      score_percent: evidenceOverallMeta.overall_percent,
      verdict_id: evidenceVerdict.id,
      verdict_label: evidenceVerdict.label,
      prominence: 'secondary',
      note: evidenceParse.evidenceImpactSummary || evidenceParse.summary,
      classification: evidenceParse.classification,
    },
    growth: {
      id: 'growth_recruiting_fit',
      label: 'Growth / Recruiting Fit',
      score_percent: growthDim?.score_percent ?? null,
      behavioral_score_percent: behavioralGrowthDim?.score_percent ?? null,
      fit_category: growthDim?.fit_category || null,
      fit_category_id: growthDim?.fit_category_id || null,
      prominence: 'dimension',
      evidence_boost_applied: Boolean(growthDim?.evidence_boost_applied),
      evidence_penalty_applied: Boolean(growthDim?.evidence_penalty_applied),
      note: growthNote,
    },
    compliance_operations_risk: {
      id: 'compliance_operations_risk',
      label: complianceOpsRisk.label,
      level: complianceOpsRisk.level,
      score_percent: complianceOpsRisk.score_percent,
      prominence: 'risk',
      note: complianceOpsRisk.detail,
      evidence_elevated: Boolean(complianceOpsRisk.evidence_elevated),
    },
    support_required: {
      id: 'support_required',
      label: supportRequired.label,
      level: supportRequired.level,
      prominence: 'risk',
      note: supportRequired.detail,
      evidence_elevated: Boolean(supportRequired.evidence_elevated),
    },
  };
}

function buildOverallSummary(verdict, evidenceParse, overallMeta) {
  const base = verdict.summary || '';
  if (
    evidenceParse?.classification === 'mixed' ||
    (evidenceParse?.positive_recruiting &&
      (evidenceParse?.negative_compliance_ops || evidenceParse?.negative_recruiting))
  ) {
    return `${base} Known evidence is mixed: growth evidence may strengthen fit while operational/compliance or recruiting underperformance raises support and risk requirements.`;
  }
  if (evidenceParse?.negative_recruiting && !evidenceParse?.positive_recruiting) {
    return `${base} Known performance evidence indicates recruiting/growth underperformance. Because recruiting/growth is the DD role’s primary economic performance lever, this materially reduces role-fit confidence even if some BOS behavioral signals are positive.`;
  }
  if (evidenceParse?.negative_compliance_ops && !evidenceParse?.positive_recruiting) {
    return `${base} Known performance evidence indicates operational or compliance risk. This does not automatically erase growth fit, but it raises the support requirement and risk profile for the DD seat.`;
  }
  if (evidenceParse?.strong_recruiting_evidence || evidenceParse?.positive_recruiting) {
    return `${base} Known recruiting evidence materially strengthens this person’s DD fit. The remaining question is not whether they can create growth; it is whether compliance discipline, operational cadence, agent support, and partner advocacy are structured around them.`;
  }
  if (overallMeta?.excellence_calibration_applied) {
    return `${base} Growth excellence calibration applied so secondary developmental dimensions do not alone suppress a proven recruiting profile.`;
  }
  if (overallMeta?.underperformance_calibration_applied) {
    return `${base} Growth underperformance calibration applied so weak known recruiting evidence keeps overall role-fit confidence appropriately lower.`;
  }
  return base;
}

function buildErrorModel(model, profileId, analyzedAt, message) {
  return {
    ok: false,
    error: message,
    analyzed_at: analyzedAt,
    role_model: {
      role_model_id: model.role_model_id,
      label: model.label,
    },
    profile: { profile_id: profileId },
  };
}

function buildAvatarInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length || /^name unavailable$/i.test(name)) return 'MM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function dimById(dimensions, id) {
  return dimensions.find((d) => d.id === id) || null;
}

function buildBestUse(dimensions, identity, hints, model, evidenceParse) {
  const bullets = [];
  const recruiting = dimById(dimensions, 'recruiting_growth_drive');
  const support = dimById(dimensions, 'agent_support_service');
  const compliance = dimById(dimensions, 'compliance_discipline');
  const training = dimById(dimensions, 'training_communication');
  const ops = dimById(dimensions, 'operational_responsiveness');
  const account = dimById(dimensions, 'accountability_follow_through');
  const partner = dimById(dimensions, 'partner_ecosystem_advocacy');

  const strong = dimensions
    .filter((d) => typeof d.score_percent === 'number' && d.score_percent >= 70)
    .sort((a, b) => b.score_percent - a.score_percent);

  if (evidenceParse?.negative_recruiting && !evidenceParse?.positive_recruiting) {
    bullets.push(
      'Pair with a strong recruiting partner or structured recruiting system — known performance evidence indicates recruiting/growth underperformance on the primary economic lever.',
    );
  } else if (evidenceParse?.positive_recruiting || (recruiting && recruiting.score_percent >= 65)) {
    bullets.push(
      evidenceParse?.positive_recruiting
        ? 'Lead Market Center recruiting cadence from proven growth strength — known recruiting evidence supports elite growth ownership.'
        : 'Lead or co-own Market Center recruiting cadence — growth is a primary economic lever in this seat.',
    );
  } else {
    bullets.push(
      'Pair with a strong recruiting partner or structured recruiting system; do not force a pure hunter identity if growth drive is not a natural peak.',
    );
  }

  if (support && support.score_percent >= 60) {
    bullets.push('Own agent support, mentoring, and culture leadership for the Market Center.');
  } else if (support) {
    bullets.push(
      'Pair growth ownership with an agent-support partner or structured mentoring system until support orientation strengthens.',
    );
  }

  if (compliance && compliance.score_percent >= 60) {
    bullets.push('Serve as a reliable compliance and document-review guardian for transaction risk.');
  } else if (compliance) {
    bullets.push(
      'Use checklists and second-review partners for compliance-heavy work — do not let growth strength mask process risk.',
    );
  }

  if (training && training.score_percent >= 60) {
    bullets.push('Run training, onboarding clarity, and standards communication for agents.');
  }

  if (ops && ops.score_percent >= 60) {
    bullets.push('Be the field operator for transaction friction and time-sensitive agent issues.');
  }

  if (account && account.score_percent >= 65) {
    bullets.push('Hold the monthly operating rhythm and closed-loop accountability for the team.');
  }

  if (partner && partner.score_percent >= 60) {
    bullets.push('Promote partner ecosystem thoughtfully as a secondary growth and service lever.');
  }

  if (bullets.length < 3 && strong.length) {
    for (const s of strong) {
      if (bullets.length >= 5) break;
      bullets.push(`Lean into ${s.label} — this is a relative strength for the DD seat.`);
    }
  }

  while (bullets.length < 3) {
    bullets.push(
      'Operate as a multi-lever DD: growth + support + compliance + training — recruiting is primary but not the only job.',
    );
  }

  const thrives = hints?.environmentFit?.thrives_in;
  const marketContext = Array.isArray(thrives) && thrives.length
    ? thrives.slice(0, 3).join('; ')
    : identity.market_center || identity.company
      ? `Best validated inside ${identity.market_center || identity.company} with clear recruiting targets and support systems.`
      : 'Best in a Market Center with clear growth targets, coaching support, and compliance infrastructure.';

  return {
    bullets: bullets.slice(0, 6),
    market_team_context: marketContext,
    archetype_alignment: (model.role_archetype || []).map((a) => a.label),
  };
}

function buildRiskPattern(dimensions, hints, verdict, evidenceParse) {
  const bullets = [];
  const weak = dimensions
    .filter((d) => typeof d.score_percent === 'number')
    .sort((a, b) => a.score_percent - b.score_percent);

  for (const d of weak.slice(0, 3)) {
    if (d.score_percent >= 60) continue;
    // Skip growth dim when evidence already elevated it — focus on remaining risks
    if (
      d.id === 'recruiting_growth_drive' &&
      evidenceParse?.positive_recruiting &&
      !evidenceParse?.negative_recruiting
    ) {
      continue;
    }
    bullets.push(
      `${d.label} is a relative gap (${Math.round(d.score_percent)}%) — without support this can become a wrong-seat pattern.`,
    );
  }

  const recruiting = dimById(dimensions, 'recruiting_growth_drive');
  const compliance = dimById(dimensions, 'compliance_discipline');
  if (evidenceParse?.negative_recruiting) {
    bullets.push(
      evidenceParse.sustained_underperformance
        ? 'Known evidence indicates sustained recruiting underperformance — the DD economic model (agent adds, stock, revenue share) is under material pressure without a structured recruiting partner system.'
        : 'Known evidence indicates recruiting/growth underperformance — without a recruiting system and coaching, Market Center growth economics will lag.',
    );
  } else if (
    recruiting &&
    recruiting.score_percent < 55 &&
    !evidenceParse?.positive_recruiting
  ) {
    bullets.push(
      'If growth drive stays low, the DD economic model (agent adds, stock, revenue share) will feel like constant pressure rather than natural leverage.',
    );
  }
  if (compliance && compliance.score_percent < 50) {
    bullets.push(
      'Low compliance discipline under DD document-review and risk duties is a material risk to agents and the Market Center — structure second-review even if recruiting is elite.',
    );
  }

  if (evidenceParse?.negative_compliance_ops) {
    bullets.push(
      'Known performance evidence indicates operational or compliance risk — raise support structure and second-review even when growth signals look strong.',
    );
  }

  if (evidenceParse?.positive_recruiting && !evidenceParse?.negative_recruiting) {
    bullets.push(
      'Known recruiting strength does not eliminate secondary risk: structure compliance, operations, and agent support around this person.',
    );
  }

  const struggles = hints?.environmentFit?.struggles_in;
  if (Array.isArray(struggles) && struggles.length) {
    bullets.push(`Environment friction signals: ${struggles.slice(0, 2).join('; ')}.`);
  }

  if (!bullets.length) {
    bullets.push(
      'No severe wrong-seat pattern detected from available signals — still validate live Market Center load and recruiting economics.',
    );
  }

  let riskLevel = 'Moderate';
  if (verdict.id === 'high_risk_poor' || verdict.id === 'risk_fit') riskLevel = 'High';
  else if (
    verdict.id === 'moderate_developmental' ||
    verdict.id === 'developmental_fit'
  ) {
    riskLevel = 'Elevated';
  } else if (verdict.id === 'viable_fit' || verdict.id === 'conditional_fit') {
    riskLevel = 'Moderate';
  } else if (verdict.id === 'strong_fit' || verdict.id === 'elite_ready_now') {
    // Strong/elite overall can still carry secondary risk when compliance/ops weak
    const copRisk = classifyComplianceOperationsRisk(dimensions);
    if (copRisk.level === 'High' || copRisk.level === 'Elevated') riskLevel = 'Moderate';
    else riskLevel = 'Low';
  }

  const supportRequired =
    riskLevel === 'High' || riskLevel === 'Elevated'
      ? 'Requires structured recruiting support, compliance peer-review, and staged responsibility load before full DD ownership.'
      : riskLevel === 'Moderate'
        ? 'Benefits from clear KPIs, coaching on weakest levers, and a defined Market Center support bench.'
        : 'Standard DD operating cadence with periodic coaching on secondary levers is sufficient.';

  return {
    bullets: bullets.slice(0, 5),
    risk_level: riskLevel,
    support_environment_required: supportRequired,
  };
}

function buildOneMove(dimensions, hints, verdict, evidenceParse) {
  const weak = dimensions
    .filter((d) => typeof d.score_percent === 'number')
    .filter((d) => !(d.id === 'recruiting_growth_drive' && evidenceParse?.strong_recruiting_evidence))
    .sort((a, b) => a.score_percent - b.score_percent)[0];

  const recruiting = dimById(dimensions, 'recruiting_growth_drive');
  const account = dimById(dimensions, 'accountability_follow_through');
  const compliance = dimById(dimensions, 'compliance_discipline');

  let move;
  let why;
  let impact = 'High';

  // Negative recruiting evidence → growth recovery system first
  if (evidenceParse?.negative_recruiting && !evidenceParse?.positive_recruiting) {
    move =
      'Install a coached weekly recruiting operating rhythm with a recruiting partner: 2–3 prospect conversations, one conversion follow-up block, and a pipeline board reviewed every Monday — do not leave growth to unassisted effort.';
    why = evidenceParse.sustained_underperformance
      ? 'Known evidence of sustained recruiting underperformance means the primary DD economic lever needs structured partnership and accountability before full independent ownership.'
      : 'Known recruiting underperformance evidence reduces role-fit confidence on the primary economic lever; a coached rhythm is the highest-leverage correction.';
    impact = 'Very High';
  } else if (evidenceParse?.positive_recruiting && evidenceParse?.negative_compliance_ops) {
    move =
      'Keep recruiting ownership intact while installing a fixed document-review checklist and same-day triage rule — mixed evidence says growth can work if compliance/ops risk is structured.';
    why =
      'Known evidence is mixed: growth evidence strengthens fit, while operational/compliance evidence raises support and risk requirements.';
    impact = 'Very High';
  } else if (evidenceParse?.positive_recruiting || evidenceParse?.strong_recruiting_evidence) {
    // When recruiting evidence is already strong, prioritize secondary structure
    if (compliance && compliance.score_percent < 65) {
      move =
        'Install a fixed document-review checklist and same-day triage rule for transaction risk items — pair elite recruiting ownership with non-negotiable compliance cadence.';
      why =
        'Known recruiting evidence answers the growth question. The remaining DD success condition is whether compliance discipline and operational structure sit around this person.';
      impact = 'Very High';
    } else if (account && account.score_percent < 65) {
      move =
        'Create a visible weekly closed-loop board for agent commitments, compliance items, and recruiting follow-ups — protect growth strength with operating rhythm.';
      why =
        'Elite recruiting still needs closed-loop accountability so agent adds convert into stable Market Center capacity.';
      impact = 'Very High';
    } else if (weak) {
      move = `Run a 30-day structured support sprint on ${weak.label}: one weekly practice, one measured output, one peer/coach check-in — keep recruiting ownership intact.`;
      why = `Growth is a relative strength; ${weak.label} (${Math.round(weak.score_percent)}%) is the secondary constraint for durable DD performance.`;
      impact = 'High';
    } else {
      move =
        'Define a 90-day DD scorecard that keeps recruiting primary while measuring compliance, agent support, and ops responsiveness weekly.';
      why =
        'Strong recruiting evidence supports growth ownership; multi-lever scorecard prevents secondary duties from going dark.';
      impact = 'Medium';
    }
  } else if (recruiting && recruiting.score_percent < 65) {
    move =
      'Install a weekly recruiting operating rhythm: 2–3 prospect conversations, one conversion follow-up block, and a simple pipeline board reviewed every Monday.';
    why =
      'Recruiting / growth is a primary DD economic lever (agent adds, base, stock, revenue share). Without a repeatable rhythm, Market Center 4%+ growth remains accidental.';
    impact = 'Very High';
  } else if (account && account.score_percent < 65) {
    move =
      'Create a visible weekly closed-loop board for agent commitments, compliance items, and recruiting follow-ups — nothing ages past 7 days without an owner and next action.';
    why =
      'Accountability / follow-through is a high-weight DD demand. Missed loops erode agent trust and growth economics at the same time.';
    impact = 'Very High';
  } else if (compliance && compliance.score_percent < 60) {
    move =
      'Adopt a fixed document-review checklist and same-day triage rule for transaction risk items before any non-urgent growth work.';
    why =
      'Compliance discipline protects the Market Center and is a material DD duty that cannot be deferred to recruiting alone.';
    impact = 'High';
  } else if (weak) {
    move = `Run a 30-day focused improvement sprint on ${weak.label}: one weekly practice, one measured output, one coach check-in.`;
    why = `${weak.label} is the relative constraint (${Math.round(weak.score_percent)}%) against the Fathom DD contract demand set.`;
    impact =
      verdict.id === 'strong_fit' || verdict.id === 'elite_ready_now' ? 'Medium' : 'High';
  } else {
    move =
      'Define a 90-day DD scorecard with recruiting, agent support, and compliance metrics — review weekly with a peer or regional leader.';
    why =
      'A multi-lever scorecard keeps recruiting primary without treating it as the only job.';
    impact = 'Medium';
  }

  const narrativeMove = extractOneMoveHint(hints?.oneMove);
  if (narrativeMove && move && !move.includes(narrativeMove.slice(0, 40))) {
    why = `${why} BOS development signal also points toward: ${narrativeMove}`;
  }

  return {
    move,
    why_it_matters: why,
    impact_level: impact,
  };
}

function extractOneMoveHint(oneMove) {
  if (!oneMove) return null;
  if (typeof oneMove === 'string') {
    const clean = oneMove.replace(/\s+/g, ' ').trim();
    return clean ? clean.slice(0, 180) : null;
  }
  if (typeof oneMove === 'object') {
    const text =
      oneMove.headline ||
      oneMove.intervention ||
      oneMove.summary ||
      oneMove.description ||
      null;
    if (typeof text === 'string' && text.trim()) return text.trim().slice(0, 180);
  }
  return null;
}

function buildTechnicalSource(model, availableCount, totalExpected, ranked, evidenceParse) {
  return {
    bos_behavioral_signals: {
      label: 'BOS Behavioral Signals',
      detail: `${availableCount}/${totalExpected} core operating dimensions available; ranked dimensions: ${Array.isArray(ranked) ? ranked.length : 0}.`,
    },
    role_demands_weighted: {
      label: 'Role Demands (Growth-Weighted)',
      detail: (model.dimensions || [])
        .map((d) => `${d.label}: ${d.weight_label} (${Math.round((d.weight || 0) * 100)}%)`)
        .join(' · '),
    },
    performance_evidence: {
      label: 'Known Performance Evidence',
      detail: evidenceParse?.has_input
        ? `Impact: ${classificationImpactLabel(evidenceParse.classification)}. ${
            evidenceParse.summary
          }${
            evidenceParse.affectedDimensions?.length
              ? ` Affected: ${evidenceParse.affectedDimensions.join(', ')}.`
              : ''
          }${
            evidenceParse.matched_phrases?.length
              ? ` Matched: ${evidenceParse.matched_phrases.join(', ')}.`
              : ''
          } Evidence is session-local only (not written to profile or Redis).`
        : 'No external performance evidence entered.',
    },
    analysis_engine: {
      label: 'Analysis Engine',
      detail: model.analysis_engine?.display_label || 'Deterministic Role Fit Engine v1B',
    },
    data_integrity: {
      label: 'Data Integrity',
      detail:
        'Read-only profile retrieval. No profile mutation, Redis writes, BA fusion changes, or Visual DNA changes in this analysis path. Evidence input is local component state only.',
    },
  };
}

// Re-export for tests/callers that may still import pure weighted helper
export { computeWeightedOverall };

export default buildDistrictDirectorFit;
