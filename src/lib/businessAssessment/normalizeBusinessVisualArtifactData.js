import { inferEToPScores } from './inferEToPScores.js';

function formatValue(value, fallback = 'Not available') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string') return value.replace(/_/g, ' ');
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map((item) => formatValue(item)).join(', ') : fallback;
  if (typeof value === 'object') {
    return formatValue(
      value.diagnostic_summary ||
        value.summary ||
        value.label ||
        value.title ||
        value.signal ||
        value.constraint_key ||
        value.value,
      fallback
    );
  }
  return String(value);
}

function firstAvailable(...values) {
  return values.find((value) => value !== null && value !== undefined && value !== '');
}

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value];
}

function textBlock(...values) {
  return values.map((value) => String(value || '')).join('\n\n');
}

function makeMetric(value, estimated = false) {
  return Number.isFinite(value) ? { value, estimated } : null;
}

function metricNumber(metric) {
  if (Number.isFinite(metric)) return metric;
  if (metric && typeof metric === 'object' && Number.isFinite(metric.value)) return metric.value;
  return null;
}

function parseNumberNear(text, patterns) {
  const source = String(text || '');
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match) continue;
    const raw = match[1] || match[0];
    const parsed = Number(String(raw).replace(/[$,+]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseNumberMetric(text, patterns, estimated = false) {
  const value = parseNumberNear(text, patterns);
  return makeMetric(value, estimated);
}

function firstMetric(...metrics) {
  return metrics.find((metric) => metricNumber(metric) !== null) || null;
}

function parseMoneyNear(text, patterns) {
  const source = String(text || '');
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match) continue;
    const raw = String(match[1] || match[0]).replace(/[$,\s]/g, '');
    const multiplier = /billion|bn|b\b/i.test(raw) ? 1000000000 : /million|mm|m\b/i.test(raw) ? 1000000 : /thousand|k\b/i.test(raw) ? 1000 : 1;
    const numeric = Number(raw.replace(/billion|million|thousand|bn|mm|[bmk]/gi, ''));
    if (Number.isFinite(numeric)) return numeric * multiplier;
  }
  return null;
}

function parseMoneyMetric(text, patterns, estimated = false) {
  const value = parseMoneyNear(text, patterns);
  return makeMetric(value, estimated);
}

function compactNumber(value) {
  const numeric = metricNumber(value);
  if (!Number.isFinite(numeric)) return 'Not provided';
  const prefix = value && typeof value === 'object' && value.estimated ? '~' : '';
  return `${prefix}${new Intl.NumberFormat('en-US').format(Math.round(numeric))}`;
}

function compactMoney(value) {
  const numeric = metricNumber(value);
  if (!Number.isFinite(numeric)) return 'Not provided';
  const prefix = value && typeof value === 'object' && value.estimated ? '~' : '';
  const abs = Math.abs(numeric);
  if (abs >= 1000000) {
    const millions = numeric / 1000000;
    return `${prefix}$${Number.isInteger(millions) ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }
  if (abs >= 1000) return `${prefix}$${Math.round(numeric / 1000)}K`;
  return `${prefix}$${Math.round(numeric)}`;
}

function findBriefingSection(briefing, pattern) {
  return (Array.isArray(briefing?.sections) ? briefing.sections : []).find((section) =>
    pattern.test(`${section?.key || ''} ${section?.title || ''}`)
  ) || {};
}

function sectionText(section) {
  return textBlock(section?.title, section?.body, ...(Array.isArray(section?.evidence) ? section.evidence : []));
}

function extractBusinessMetrics({ answers, draft, briefing, oneMove }) {
  const relationshipSection = findBriefingSection(briefing, /relationship|database/i);
  const currentBusinessSection = findBriefingSection(briefing, /current.*business|business.*reality/i);
  const financialSection = findBriefingSection(briefing, /financial/i);
  const relationshipDraftEvidence = draft?.relationship_reality?.evidence || {};
  const financialDraftEvidence = draft?.financial_reality?.evidence || {};
  const relationshipText = textBlock(
    answers.q3,
    answers.q5,
    relationshipDraftEvidence.q3,
    relationshipDraftEvidence.q5,
    sectionText(relationshipSection),
    oneMove?.recommendation,
    oneMove?.why_this_move
  );
  const financialText = textBlock(
    answers.q9,
    answers.q2,
    financialDraftEvidence.q9,
    sectionText(currentBusinessSection),
    sectionText(financialSection)
  );
  const all = textBlock(answers.q1, answers.q2, answers.q3, answers.q5, answers.q8, answers.q9, answers.q10, answers.q12, relationshipText);
  const currentTrueRelationships = firstMetric(
    parseNumberMetric(answers.q3, [
      /about\s+([\d,]+)\s+are\s+true relationships/i,
      /approximately\s+([\d,]+)\s+are\s+true relationships/i,
      /([\d,]+)\s+are\s+true relationships/i,
      /true relationship(?:s)?(?: database)?(?: is|:)?\s+(?:probably\s+)?([\d,]+)/i,
    ]),
    parseNumberMetric(relationshipText, [
      /about\s+([\d,]+)\s+strong relationships/i,
      /([\d,]+)\s+strong relationships/i,
      /([\d,]+)\s+of\s+those\s+are\s+friends,\s*good relationships/i,
      /([\d,]+)\s+friends,\s*good relationships/i,
      /with\s+about\s+([\d,]+)\s+strong relationships/i,
    ], true)
  );
  const totalContacts = firstMetric(
    parseNumberMetric(answers.q3 + '\n' + answers.q5, [
      /about\s+([\d,]+)\s+people\s+in\s+my\s+total\s+contact/i,
      /total database(?: is)?(?: roughly)?\s+([\d,]+)/i,
      /total contact list(?: across)?(?: is|:)?\s+(?:around\s+|roughly\s+|about\s+)?([\d,]+)/i,
      /([\d,]+)\s+contacts/i,
    ]),
    parseNumberMetric(relationshipText, [
      /([\d,]+)\s+people\s+in\s+my\s+database/i,
      /database\s+estimated\s+at\s+([\d,]+)\s+contacts/i,
      /estimated\s+at\s+([\d,]+)\s+contacts/i,
      /database\s+(?:of|has|includes)\s+([\d,]+)\s+(?:people|contacts)/i,
    ], true)
  );
  const relationshipTarget = parseNumberMetric(relationshipText, [
    /grow\s+true relationships\s+toward\s+([\d,]+)/i,
    /true relationships\s+toward\s+([\d,]+)/i,
    /relationship(?:\s+lake)?\s+target(?:\s+is|:)?\s+([\d,]+)/i,
    /target\s+of\s+([\d,]+)\s+(?:true\s+)?relationships/i,
    /toward\s+([\d,]+)\s+(?:true\s+)?relationships/i,
  ], true);
  const currentUnits = parseNumberNear(answers.q9 + '\n' + answers.q1, [
    /closed units:\s*([\d,]+)/i,
    /closed\s+([\d,]+)\s+units/i,
    /([\d,]+)\s+closed units/i,
  ]);
  const currentVolume = firstMetric(parseMoneyMetric(financialText + '\n' + answers.q1, [
    /sales volume:\s*approximately\s*(\$?[\d,.]+\s*[mk]?)/i,
    /annual sales.*?(\$?[\d,.]+\s*(?:m|k|million|billion)?)/i,
    /average sales are about\s*(\$?[\d,.]+\s*(?:m|k|million|billion)?)/i,
    /approximately\s*(\$?[\d,.]+\s*[mk]?)\s+in\s+volume/i,
    /for\s+about\s*(\$?[\d,.]+\s*[mk]?)\s+in\s+volume/i,
  ], true));
  const currentGci = firstMetric(parseMoneyMetric(financialText + '\n' + answers.q2, [
    /gross commission income:\s*approximately\s*(\$?[\d,.]+\s*[mk]?)/i,
    /gci:\s*(?:about\s+|approximately\s+)?(\$?[\d,.]+\s*[mk]?)/i,
    /about\s*(\$?[\d,.]+\s*[mk]?)\s+in\s+gci/i,
    /earn\s+about\s+(\$?[\d,.]+\s*(?:m|k|million|billion)?)\s+per\s+year/i,
  ], true));
  const currentNet = firstMetric(parseMoneyMetric(financialText + '\n' + answers.q2, [
    /estimated net income before taxes:\s*approximately\s*(\$?[\d,.]+\s*[mk]?)/i,
    /estimated net before taxes:\s*about\s*(\$?[\d,.]+\s*[mk]?)/i,
    /net before taxes:\s*(?:approximately\s+|about\s+)?(\$?[\d,.]+\s*[mk]?)/i,
    /profit\s+is\s+about\s+(\$?[\d,.]+\s*(?:m|k|million|billion)?)/i,
  ], true));
  const goalUnits = parseNumberNear(answers.q2 + '\n' + answers.q12, [
    /12-month goal:\s*close\s+([\d,]+)\s+units/i,
    /close\s+([\d,]+)\s+units/i,
    /goal is\s+([\d,]+)\s+units/i,
    /like\s+to\s+be\s+at\s+([\d,]+)\s*transactions/i,
  ]);
  const goalVolume = parseMoneyNear(answers.q2, [
    /roughly\s*(\$?[\d,.]+\s*[mk]?)\s+in\s+sales volume/i,
    /around\s*(\$?[\d,.]+\s*[mk]?)\s+in\s+volume/i,
    /(\$?[\d,.]+\s*[mk]?)\s+in\s+sales volume/i,
  ]);
  const goalGci = parseMoneyNear(answers.q2, [
    /with\s+about\s*(\$?[\d,.]+\s*[mk]?)\s+in\s+gci/i,
    /gci\.\s*i want/i,
  ]);
  const goalNet = parseMoneyNear(answers.q2, [
    /net at least\s*(\$?[\d,.]+\s*[mk]?)/i,
    /net\s+(?:at least\s+)?(\$?[\d,.]+\s*[mk]?)/i,
  ]);
  const currentTrueRelationshipValue = metricNumber(currentTrueRelationships);
  const relationshipTargetValue = metricNumber(relationshipTarget);

  return {
    currentTrueRelationships,
    totalContacts,
    currentUnits,
    currentVolume,
    currentGci,
    currentNet,
    goalUnits,
    goalVolume,
    goalGci,
    goalNet,
    relationshipTarget,
    relationshipGap: relationshipTargetValue && currentTrueRelationshipValue
      ? makeMetric(Math.max(0, relationshipTargetValue - currentTrueRelationshipValue), relationshipTarget?.estimated || currentTrueRelationships?.estimated)
      : null,
    hasWeeklyRhythmGap: /weekly operating rhythm|weekly database review|inspectable|from my head|memory|follow-up/i.test(all),
  };
}

function buildBusinessMapVisualCopy({
  answers,
  primaryConstraint,
  businessReality,
  currentTrajectory,
  opportunity,
  impact,
  bottomLine,
  eToP,
  draft,
  briefing,
  oneMove,
}) {
  const metrics = extractBusinessMetrics({ answers, draft, briefing, oneMove });
  const constraintLabel = formatValue(primaryConstraint.label, 'Primary constraint');
  const constraintSummary = formatValue(primaryConstraint.summary, 'The business needs a more inspectable operating rhythm.');
  const goalUnits = metrics.goalUnits ? `${metrics.goalUnits}` : 'Not provided';
  const closingInsight = buildClosingInsight({ metrics, primaryConstraint, eToP });

  return {
    currentMetrics: [
      { label: 'True Relationships', value: compactNumber(metrics.currentTrueRelationships) },
      { label: 'Total Contacts', value: compactNumber(metrics.totalContacts) },
      { label: 'Annual Production', value: compactMoney(metrics.currentVolume) },
      { label: 'Units Closed', value: compactNumber(metrics.currentUnits) },
      { label: 'GCI', value: compactMoney(metrics.currentGci) },
      { label: 'Estimated Net', value: compactMoney(metrics.currentNet) },
    ],
    targetMetrics: [
      { label: 'Relationship Target', value: compactNumber(metrics.relationshipTarget) },
      { label: 'Goal Production', value: compactMoney(metrics.goalVolume) },
      { label: 'Goal Units', value: goalUnits },
      { label: 'Potential GCI', value: compactMoney(metrics.goalGci) },
      { label: 'Potential Net', value: compactMoney(metrics.goalNet) },
    ],
    lake: {
      current: compactNumber(metrics.currentTrueRelationships),
      target: compactNumber(metrics.relationshipTarget),
      gap: compactNumber(metrics.relationshipGap),
      label: 'TRUE RELATIONSHIPS',
      subtext: 'People who know, trust, and think of you.',
      streams: ['Past Clients', 'Referrals', 'Open Houses', 'Sphere / Network', 'Vendor Partners', 'Community Events', 'Database Reactivation'],
      outflow: ['Appointments', 'Listings', 'Buyers', 'Referrals', 'Repeat Business', 'GCI', 'Time Freedom'],
    },
    currentTrajectory: {
      caption: metrics.hasWeeklyRhythmGap ? 'Stable. Not Scaling.' : 'Current rhythm needs validation.',
      line: 'Growth is capped by the current operating rhythm.',
      summary: clipForVisual(currentTrajectory, 120),
    },
    potentialTrajectory: {
      caption: 'Growing. Predictable. Scalable.',
      line: 'A weekly rhythm turns relationship equity into appointments.',
    },
    closingInsight,
    chain: [
      {
        title: 'Primary Constraint',
        body: clipForVisual(constraintLabel, 96),
      },
      {
        title: 'Diagnosis',
        body: metricNumber(metrics.currentTrueRelationships) && metrics.goalUnits
          ? `${compactNumber(metrics.currentTrueRelationships)} true relationships support a real business, but not the ${goalUnits}-unit goal without growth and inspection.`
          : clipForVisual(businessReality.summary || constraintSummary, 130),
      },
      {
        title: 'Impact',
        body: clipForVisual(impact, 120),
      },
      {
        title: 'Opportunity',
        body: metricNumber(metrics.relationshipTarget)
          ? `Grow the lake toward ${compactNumber(metrics.relationshipTarget)}. Activate the current relationships. Create a weekly appointment rhythm.`
          : clipForVisual(opportunity, 130),
      },
      {
        title: 'Bottom Line',
        body: metrics.goalUnits
          ? `Close the relationship gap. Build the weekly rhythm. Move toward ${goalUnits} units.`
          : clipForVisual(bottomLine, 130),
      },
    ],
  };
}

function buildClosingInsight({ metrics, primaryConstraint, eToP }) {
  const constraintText = textBlock(primaryConstraint?.label, primaryConstraint?.summary, primaryConstraint?.key).toLowerCase();
  const systemsScore = Number(eToP?.systems?.score || 0);
  const accountabilityScore = Number(eToP?.accountability?.score || 0);
  const toolsScore = Number(eToP?.tools?.score || 0);

  if (
    metricNumber(metrics.currentTrueRelationships) &&
    metricNumber(metrics.relationshipTarget) &&
    metricNumber(metrics.relationshipTarget) > metricNumber(metrics.currentTrueRelationships)
  ) {
    return {
      headline: 'THE LAKE IS REAL. THE RHYTHM IS THE GAP.',
      subline: `Grow true relationships toward ${compactNumber(metrics.relationshipTarget)} and inspect weekly appointment creation.`,
    };
  }

  if (/financial|profit|p&l|net income|roi/.test(constraintText)) {
    return {
      headline: 'PRODUCTION IS NOT THE SAME AS PROFIT.',
      subline: 'Clarify net income, source ROI, and monthly numbers before scaling.',
    };
  }

  if (/team|leadership|leverage|delegat|role/.test(constraintText)) {
    return {
      headline: 'THE BUSINESS CANNOT SCALE WHILE JUDGMENT STAYS IN ONE HEAD.',
      subline: 'Transfer standards, priorities, and follow-up rules into an inspectable operating model.',
    };
  }

  if (/accountability|inspection|scorecard|cadence/.test(constraintText) || accountabilityScore <= 3) {
    return {
      headline: 'THE PLAN IS NOT THE PROBLEM. INSPECTION IS.',
      subline: 'Make the leading activities visible, reviewed, and corrected every week.',
    };
  }

  if (/crm|tool|technology/.test(constraintText) || (toolsScore <= 5 && systemsScore <= 5)) {
    return {
      headline: 'THE TOOL IS NOT THE SYSTEM.',
      subline: 'CRM only matters when it creates conversations, appointments, and follow-up discipline.',
    };
  }

  if (/system|operating rhythm|follow-up|database|conversion|lead/.test(constraintText) || systemsScore <= 4) {
    return {
      headline: 'THE BUSINESS IS WORKING. THE SYSTEM IS CAPPING IT.',
      subline: 'Turn memory-based execution into a weekly operating rhythm.',
    };
  }

  return {
    headline: 'REAL ESTATE SUCCESS IS NOT RANDOM. IT IS OPERATED.',
    subline: 'Use the One Move to shift the business toward a more predictable future.',
  };
}

function clipForVisual(value, max = 120) {
  const text = String(value || 'Not provided').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
}

function extractFutureByKey(futures, key) {
  return futures.find((future) => future.key === key) || {};
}

function normalizeConstraint(draft, briefing) {
  return (
    draft?.constraint_analysis?.primary_constraint ||
    briefing?.primary_constraint_snapshot ||
    {}
  );
}

function normalizeDraftSection(section, fallbackSummary = 'Not available') {
  return {
    summary: formatValue(section?.summary || section?.diagnostic_summary || section, fallbackSummary),
    evidence: asArray(section?.evidence || section?.supporting_evidence).slice(0, 4),
    confidence: formatValue(section?.confidence || section?.confidence_band, 'Moderate')
  };
}

export function normalizeBusinessVisualArtifactData(record) {
  const assessment = record?.assessment || record?.business_assessment || record || {};
  const output = assessment.output || {};
  const draft = output.business_intelligence_draft || {};
  const briefing = output.executive_diagnostic_briefing_v1 || {};
  const fiveFutures = output.five_futures_v1 || {};
  const oneMove = output.one_move_v1 || {};
  const futures = Array.isArray(fiveFutures.futures) ? fiveFutures.futures : [];
  const primaryConstraint = normalizeConstraint(draft, briefing);
  const answers = assessment.inputs?.answers || {};
  const eToP = inferEToPScores(record);

  const currentFuture = extractFutureByKey(futures, 'current_future');
  const optimizedFuture = extractFutureByKey(futures, 'optimized_future');
  const transformationalFuture = extractFutureByKey(futures, 'transformational_future');

  const normalized = {
    profileId: assessment.owner_profile_id || briefing.owner_profile_id || fiveFutures.owner_profile_id,
    assessmentId: assessment.assessment_id || briefing.assessment_id || fiveFutures.assessment_id,
    assessmentType: assessment.assessment_type || briefing.audience_type || 'business_assessment',
    status: assessment.status || record?.status,
    ownerName: assessment.profile_context?.owner_profile_name || 'Business Operator',
    ownerProfileType: assessment.profile_context?.owner_profile_type || 'MORE MindMap Profile',
    hasMap: Boolean(record?.has_business_intelligence_draft || output.business_intelligence_draft || output.executive_diagnostic_briefing_v1),
    hasFutures: Boolean(record?.has_five_futures && record?.has_one_move) || Boolean(output.five_futures_v1 && output.one_move_v1),

    businessReality: normalizeDraftSection(draft.business_reality, 'Business reality is still being analyzed.'),
    relationshipReality: normalizeDraftSection(draft.relationship_reality, 'Relationship and database reality is still being analyzed.'),
    leadGenerationReality: normalizeDraftSection(draft.lead_generation_reality, 'Lead generation reality is still being analyzed.'),
    systemsReality: normalizeDraftSection(draft.systems_reality, 'Systems reality is still being analyzed.'),
    accountabilityReality: normalizeDraftSection(draft.accountability_reality, 'Accountability reality is still being analyzed.'),
    financialReality: normalizeDraftSection(draft.financial_reality, 'Financial reality is still being analyzed.'),
    teamReality: normalizeDraftSection(draft.team_reality, 'Team reality is still being analyzed.'),

    currentTrajectory: formatValue(
      draft.current_trajectory_signal?.diagnostic_summary ||
        briefing.current_trajectory_signal?.diagnostic_summary ||
        currentFuture.summary ||
        draft.current_trajectory_signal,
      'Current trajectory not modeled yet.'
    ),
    potentialFuture: formatValue(
      optimizedFuture.summary ||
        transformationalFuture.summary ||
        'Potential future becomes visible after Five Futures generation.'
    ),
    primaryConstraint: {
      key: primaryConstraint.constraint_key || primaryConstraint.key,
      label: formatValue(primaryConstraint.label || primaryConstraint.constraint_key, 'Primary constraint'),
      summary: formatValue(
        primaryConstraint.diagnostic_summary ||
          primaryConstraint.likely_effect_if_unchanged ||
          primaryConstraint.description ||
          primaryConstraint.summary,
        'Primary constraint evidence is still being assembled.'
      ),
      evidence: asArray(primaryConstraint.supporting_evidence || primaryConstraint.evidence).slice(0, 5),
      confidence: formatValue(primaryConstraint.confidence, 'Moderate')
    },
    diagnosis: formatValue(briefing.sections?.find((section) => section.key === 'strategic_interpretation')?.body || briefing.sections?.find((section) => /strategic/i.test(section.title || ''))?.body || briefing.briefing_markdown, 'Diagnostic briefing not available.'),
    opportunity: formatValue(oneMove.why_this_move || oneMove.recommendation || optimizedFuture.required_shift, 'Opportunity becomes clearer after One Move generation.'),
    impact: formatValue(oneMove.expected_probability_shift?.explanation || currentFuture.risk_if_unchanged || primaryConstraint.likely_effect_if_unchanged, 'Impact not modeled yet.'),
    bottomLine: formatValue(oneMove.recommendation || primaryConstraint.likely_effect_if_unchanged, 'Complete the intelligence pipeline to generate the bottom line.'),
    answers,
    eToP,

    fiveFutures: {
      title: fiveFutures.title || 'Five Futures',
      subtitle: fiveFutures.subtitle || 'The future is not predicted. It is modeled.',
      probabilityTotal: firstAvailable(fiveFutures.probability_total, futures.reduce((sum, future) => sum + Number(future.probability || 0), 0)),
      confidenceSnapshot: formatValue(fiveFutures.confidence_snapshot || briefing.confidence_snapshot, 'Moderate'),
      futures
    },
    oneMove: {
      title: oneMove.title || 'One Move',
      rootConstraint: formatValue(oneMove.root_constraint || primaryConstraint.label || primaryConstraint.constraint_key, 'Root constraint not available.'),
      interventionCategory: formatValue(oneMove.intervention_category, 'Intervention'),
      recommendation: formatValue(oneMove.recommendation, 'One Move not generated yet.'),
      whyThisMove: formatValue(oneMove.why_this_move, 'The probability shift has not been modeled yet.'),
      whyNow: formatValue(oneMove.why_now, 'Timing not modeled yet.'),
      probabilityShift: formatValue(oneMove.expected_probability_shift?.explanation || oneMove.expected_probability_shift, 'Probability shift not available.'),
      first30Days: asArray(oneMove.first_30_days),
      successIndicators: asArray(oneMove.success_indicators),
      confidence: formatValue(oneMove.confidence, 'Moderate')
    }
  };

  normalized.businessMap = buildBusinessMapVisualCopy({
    answers,
    primaryConstraint: normalized.primaryConstraint,
    businessReality: normalized.businessReality,
    currentTrajectory: normalized.currentTrajectory,
    opportunity: normalized.opportunity,
    impact: normalized.impact,
    bottomLine: normalized.bottomLine,
    eToP,
    draft,
    briefing,
    oneMove,
  });

  return normalized;
}
