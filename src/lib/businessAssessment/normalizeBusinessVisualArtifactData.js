import { inferEToPScores } from './inferEToPScores.js';
import {
  buildBusinessEngineContract,
  projectBusinessMapFromContract,
  validateBusinessEngineContract,
} from '../businessEngine/index.js';
import {
  resolveCurrentTrueRelationshipEvidence,
  trueRelationshipMetricFromEvidence,
} from '../businessEngine/relationshipEvidence.js';

const REAL_ESTATE_GROSS_COMMISSION_RATE_ASSUMPTION = 0.0265;

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

function hasRawValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.filter(Boolean).length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function textBlock(...values) {
  return values.map((value) => String(value || '')).join('\n\n');
}

function makeMetric(value, estimated = false, metadata = {}) {
  return Number.isFinite(value) ? { value, estimated, ...metadata } : null;
}

function makeRangeMetric(low, high, estimated = false, metadata = {}) {
  if (!Number.isFinite(low) && !Number.isFinite(high)) return null;
  const resolvedLow = Number.isFinite(low) ? low : high;
  const resolvedHigh = Number.isFinite(high) ? high : low;
  return {
    value: (resolvedLow + resolvedHigh) / 2,
    low: resolvedLow,
    high: resolvedHigh,
    range: true,
    estimated,
    ...metadata,
  };
}

function parseRangeNear(text, patterns, estimated = false) {
  const source = String(text || '');
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match) continue;
    const low = Number(String(match[1] || '').replace(/[$,+]/g, ''));
    const high = Number(String(match[2] || match[1] || '').replace(/[$,+]/g, ''));
    if (Number.isFinite(low) && Number.isFinite(high)) {
      return makeRangeMetric(low, high, estimated);
    }
    if (Number.isFinite(low)) return makeMetric(low, estimated);
  }
  return null;
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
  if (value && typeof value === 'object') {
    const preservedDisplay = value.display_value || value.display;
    if (preservedDisplay !== null && preservedDisplay !== undefined && preservedDisplay !== '') {
      return String(preservedDisplay);
    }
  }
  if (value && typeof value === 'object' && value.range && Number.isFinite(value.low) && Number.isFinite(value.high)) {
    const prefix = value.estimated ? 'Approx. ' : '';
    const low = new Intl.NumberFormat('en-US').format(Math.round(value.low));
    const high = new Intl.NumberFormat('en-US').format(Math.round(value.high));
    return `${prefix}${low}–${high}`;
  }
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

function metricSource(metric, fallback = 'Insufficient data') {
  if (!metric) return fallback;
  if (metric.source) return metric.source;
  return metric.estimated ? 'Extracted' : 'User provided';
}

function metricBasis(metric, fallback = '') {
  return metric?.basis || fallback;
}

function findBriefingSection(briefing, pattern) {
  return (Array.isArray(briefing?.sections) ? briefing.sections : []).find((section) =>
    pattern.test(`${section?.key || ''} ${section?.title || ''}`)
  ) || {};
}

function sectionText(section) {
  return textBlock(section?.title, section?.body, ...(Array.isArray(section?.evidence) ? section.evidence : []));
}

function metricsFromRelationshipDraft(draft) {
  const rel = draft?.relationship_reality || {};
  const mentions = Array.isArray(rel.database_size_mentions) ? rel.database_size_mentions : [];
  const q3Evidence = rel.evidence?.q3 || '';

  let totalContacts = null;

  const totalFromQ3 = parseNumberNear(q3Evidence, [/maybe\s+(\d+)/i, /but maybe\s+(\d+)/i]);
  if (Number.isFinite(totalFromQ3)) {
    totalContacts = makeMetric(totalFromQ3, false, { source: 'User provided' });
  }

  if (!totalContacts && mentions.length >= 1) {
    const total = Number(String(mentions[0]).replace(/,/g, ''));
    if (Number.isFinite(total)) totalContacts = makeMetric(total, false, { source: 'Extracted' });
  }

  return { totalContacts };
}

function metricsFromProductionDraft(draft) {
  const production = draft?.business_reality?.current_production_reality || {};
  const numbers = Array.isArray(production.extracted_numbers) ? production.extracted_numbers : [];
  let units = null;
  let volume = null;

  for (const entry of numbers) {
    const raw = String(entry || '').replace(/[$,]/g, '');
    if (!units && /^\d{1,3}$/.test(raw)) units = Number(raw);
    if (!volume && /^\d{4,}/.test(raw)) volume = Number(raw);
  }

  return {
    units: Number.isFinite(units) ? makeMetric(units, false, { source: 'Extracted' }) : null,
    volume: Number.isFinite(volume) ? makeMetric(volume, false, { source: 'Extracted' }) : null,
  };
}

function extractBusinessMetrics({ answers, draft, briefing, oneMove }) {
  const relationshipSection = findBriefingSection(briefing, /relationship|database/i);
  const currentBusinessSection = findBriefingSection(briefing, /current.*business|business.*reality/i);
  const financialSection = findBriefingSection(briefing, /financial/i);
  const relationshipDraftEvidence = draft?.relationship_reality?.evidence || {};
  const financialDraftEvidence = draft?.financial_reality?.evidence || {};
  const draftRelationshipMetrics = metricsFromRelationshipDraft(draft);
  const draftProductionMetrics = metricsFromProductionDraft(draft);
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
  const trueRelationshipEvidence = resolveCurrentTrueRelationshipEvidence({
    answers,
    draft,
  });
  const currentTrueRelationships = trueRelationshipMetricFromEvidence(
    trueRelationshipEvidence
  );
  const totalContacts = firstMetric(
    parseNumberMetric(answers.q3 + '\n' + answers.q5, [
      /but maybe\s+(\d+)/i,
      /maybe\s+(\d+)\s+and true relationships/i,
      /about\s+([\d,]+)\s+people\s+in\s+my\s+total\s+contact/i,
      /total database(?: is)?(?: roughly)?\s+([\d,]+)/i,
      /total contact list(?: across)?(?: is|:)?\s+(?:around\s+|roughly\s+|about\s+)?([\d,]+)/i,
      /([\d,]+)\s+contacts/i,
    ]),
    draftRelationshipMetrics.totalContacts,
    parseNumberMetric(relationshipText, [
      /([\d,]+)\s+people\s+in\s+my\s+database/i,
      /database\s+estimated\s+at\s+([\d,]+)\s+contacts/i,
      /estimated\s+at\s+([\d,]+)\s+contacts/i,
      /database\s+(?:of|has|includes)\s+([\d,]+)\s+(?:people|contacts)/i,
    ], true)
  );
  const relationshipTarget = firstMetric(
    parseRangeNear(answers.q2, [
      /date base to\s+(\d+)[.\-–]?\s*[-–]?\s*(\d+)/i,
      /relationship(?: and)? date base to\s+(\d+)[.\-–]?\s*[-–]?\s*(\d+)/i,
      /(?:data|date) base (?:at|to)\s+(\d+)[.\-–]?\s*[-–]?\s*(\d+)/i,
    ], false),
    parseRangeNear(relationshipText, [
      /database to\s+(\d+)[.\-–]?\s*[-–]?\s*(\d+)/i,
    ], true),
    parseNumberMetric(relationshipText, [
      /grow\s+true relationships\s+toward\s+([\d,]+)/i,
      /true relationships\s+toward\s+([\d,]+)/i,
      /relationship(?:\s+lake)?\s+target(?:\s+is|:)?\s+([\d,]+)/i,
      /target\s+of\s+([\d,]+)\s+(?:true\s+)?relationships/i,
      /toward\s+([\d,]+)\s+(?:true\s+)?relationships/i,
    ], true)
  );
  const currentUnits = firstMetric(
    makeMetric(
      parseNumberNear(answers.q9 + '\n' + answers.q1, [
        /units closed\s*:?\s*([\d,]+)/i,
        /closed units:\s*([\d,]+)/i,
        /closed\s+([\d,]+)\s+units/i,
        /([\d,]+)\s+closed units/i,
      ]),
      false,
      { source: 'User provided' }
    ),
    draftProductionMetrics.units
  );
  const currentVolume = firstMetric(
    parseMoneyMetric(answers.q9, [
      /(\$[\d,.]+\s*[mk]?)\s+(?:in\s+)?sales volume\b/i,
      /sales volume\s*(?:-|:|=)\s*(\$?[\d,.]{4,}\s*[mk]?)/i,
      /sales volume\s+(\$[\d,.]+\s*[mk]?|[\d,.]{4,}\s*[mk]?)/i,
    ], false),
    parseMoneyMetric(financialText + '\n' + answers.q1, [
      /sales volume:\s*approximately\s*(\$?[\d,.]+\s*[mk]?)/i,
      /annual sales.*?(\$?[\d,.]+\s*(?:m|k|million|billion)?)/i,
      /average sales are about\s*(\$?[\d,.]+\s*(?:m|k|million|billion)?)/i,
      /approximately\s*(\$?[\d,.]+\s*[mk]?)\s+in\s+volume/i,
      /for\s+about\s*(\$?[\d,.]+\s*[mk]?)\s+in\s+volume/i,
    ], true),
    draftProductionMetrics.volume
      ? { ...draftProductionMetrics.volume, estimated: false, source: 'Extracted' }
      : null
  );
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
  const goalVolumeValue = parseMoneyNear(answers.q2, [
    /roughly\s*(\$?[\d,.]+\s*[mk]?)\s+in\s+sales volume/i,
    /around\s*(\$?[\d,.]+\s*[mk]?)\s+in\s+volume/i,
    /(\$?[\d,.]+\s*[mk]?)\s+in\s+sales volume/i,
  ]);
  const goalVolume = makeMetric(goalVolumeValue, false, { source: 'Extracted' });
  const goalGciValue = parseMoneyNear(answers.q2, [
    /with\s+about\s*(\$?[\d,.]+\s*[mk]?)\s+in\s+gci/i,
    /gci\.\s*i want/i,
  ]);
  const goalGci = firstMetric(
    makeMetric(goalGciValue, false, { source: 'Extracted' }),
    goalVolume
      ? makeMetric(goalVolume.value * REAL_ESTATE_GROSS_COMMISSION_RATE_ASSUMPTION, true, {
          source: 'Model estimate',
          basis: 'Goal production x 2.65% gross commission assumption'
        })
      : null
  );
  const goalNetValue = parseMoneyNear(answers.q2, [
    /net at least\s*(\$?[\d,.]+\s*[mk]?)/i,
    /net\s+(?:at least\s+)?(\$?[\d,.]+\s*[mk]?)/i,
  ]);
  const goalNet = makeMetric(goalNetValue, false, { source: 'Extracted' });
  const currentTrueRelationshipValue = metricNumber(currentTrueRelationships);
  const modelRelationshipTarget =
    !relationshipTarget &&
    goalUnits >= 20 &&
    Number.isFinite(currentTrueRelationshipValue) &&
    currentTrueRelationshipValue < 500
    ? makeMetric(500, true, {
        source: 'Model estimate',
        unit: 'true relationships',
        basis: 'Real Estate Business Model V1 relationship economics'
      })
    : null;
  const resolvedRelationshipTarget = firstMetric(
    relationshipTarget ? { ...relationshipTarget, source: 'Extracted', unit: 'true relationships' } : null,
    modelRelationshipTarget
  );
  const relationshipTargetValue = metricNumber(resolvedRelationshipTarget);

  return {
    currentTrueRelationships,
    trueRelationshipEvidence,
    totalContacts,
    currentUnits,
    currentVolume,
    currentGci,
    currentNet,
    goalUnits,
    goalVolume,
    goalGci,
    goalNet,
    relationshipTarget: resolvedRelationshipTarget,
    relationshipGap:
      Number.isFinite(relationshipTargetValue) &&
      Number.isFinite(currentTrueRelationshipValue)
      ? makeMetric(Math.max(0, relationshipTargetValue - currentTrueRelationshipValue), resolvedRelationshipTarget?.estimated || currentTrueRelationships?.estimated, {
          source: resolvedRelationshipTarget?.source,
          basis: resolvedRelationshipTarget?.basis
        })
      : null,
    hasWeeklyRhythmGap: /weekly operating rhythm|weekly database review|inspectable|from my head|memory|follow-up/i.test(all),
  };
}

function deriveBusinessRealitySummary(draft) {
  const businessReality = draft?.business_reality || {};
  if (businessReality.summary || businessReality.diagnostic_summary) {
    return formatValue(businessReality.summary || businessReality.diagnostic_summary);
  }

  const stageDescription = businessReality.current_stage?.description;
  const fusionSummary = draft?.behavior_business_fusion?.fusion_summary;
  const relationshipStrength = draft?.relationship_reality?.relationship_asset_strength;

  if (stageDescription && fusionSummary) {
    return clipForVisual(`${stageDescription} ${fusionSummary}`, 130);
  }
  if (stageDescription) return clipForVisual(stageDescription, 130);
  if (fusionSummary && relationshipStrength) {
    return clipForVisual(
      `${fusionSummary} Relationship strength reads as ${String(relationshipStrength).replace(/_/g, ' ')}.`,
      130
    );
  }
  if (fusionSummary) return clipForVisual(fusionSummary, 130);

  return null;
}

function deriveMapDiagnosisBody({
  metrics,
  businessReality,
  primaryConstraint,
  constraintSummary,
  briefing,
  oneMove,
  draft,
}) {
  if (metricNumber(metrics.currentTrueRelationships) && metrics.goalUnits) {
    return `${compactNumber(metrics.currentTrueRelationships)} true relationships support a real business, but not the ${metrics.goalUnits}-unit goal without growth and inspection.`;
  }

  const strategicSection = (Array.isArray(briefing?.sections) ? briefing.sections : []).find(
    (section) => section?.key === 'strategic_interpretation'
  );
  if (strategicSection?.body) return clipForVisual(strategicSection.body, 130);

  const constraintSection = (Array.isArray(briefing?.sections) ? briefing.sections : []).find(
    (section) => section?.key === 'primary_constraint'
  );
  if (constraintSection?.body) return clipForVisual(constraintSection.body, 130);

  if (oneMove?.root_constraint) return clipForVisual(oneMove.root_constraint, 130);

  const fusionSummary = draft?.behavior_business_fusion?.fusion_summary;
  const constraintEffect =
    primaryConstraint?.summary ||
    primaryConstraint?.diagnostic_summary ||
    primaryConstraint?.likely_effect_if_unchanged;
  if (fusionSummary && constraintEffect) {
    return clipForVisual(`${fusionSummary} ${constraintEffect}`, 130);
  }
  if (fusionSummary) return clipForVisual(fusionSummary, 130);

  const derivedSummary = deriveBusinessRealitySummary(draft);
  if (derivedSummary) return derivedSummary;

  if (constraintEffect && constraintEffect !== 'Primary constraint evidence is still being assembled.') {
    return clipForVisual(constraintEffect, 130);
  }

  if (businessReality?.summary && businessReality.summary !== 'Business reality is still being analyzed.') {
    return clipForVisual(businessReality.summary, 130);
  }

  return clipForVisual(constraintSummary || 'Business reality is still being analyzed.', 130);
}

function buildMetricPanels(metrics) {
  const goalUnits = metrics.goalUnits ? `${metrics.goalUnits}` : 'Not provided';
  return {
    currentMetrics: [
      {
        label: 'True Relationships',
        value: compactNumber(metrics.currentTrueRelationships),
        source: metricSource(metrics.currentTrueRelationships)
      },
      {
        label: 'Total Contacts',
        value: compactNumber(metrics.totalContacts),
        source: metricSource(metrics.totalContacts)
      },
      {
        label: 'Annual Production',
        value: compactMoney(metrics.currentVolume),
        source: metricSource(metrics.currentVolume)
      },
      {
        label: 'Units Closed',
        value: compactNumber(metrics.currentUnits),
        source: metrics.currentUnits ? 'Extracted' : 'Insufficient data'
      },
      {
        label: 'GCI',
        value: compactMoney(metrics.currentGci),
        source: metricSource(metrics.currentGci)
      },
      {
        label: 'Estimated Net',
        value: compactMoney(metrics.currentNet),
        source: metricSource(metrics.currentNet)
      },
    ],
    targetMetrics: [
      {
        label: 'Relationship Target',
        value: `${compactNumber(metrics.relationshipTarget)}${metrics.relationshipTarget?.unit ? ` ${metrics.relationshipTarget.unit}` : ''}`,
        source: metricSource(metrics.relationshipTarget),
        basis: metricBasis(metrics.relationshipTarget)
      },
      {
        label: 'Goal Production',
        value: compactMoney(metrics.goalVolume),
        source: metricSource(metrics.goalVolume),
        basis: metricBasis(metrics.goalVolume)
      },
      {
        label: 'Goal Units',
        value: goalUnits,
        source: metrics.goalUnits ? 'Extracted' : 'Insufficient data'
      },
      {
        label: 'Potential GCI',
        value: compactMoney(metrics.goalGci),
        source: metricSource(metrics.goalGci),
        basis: metricBasis(metrics.goalGci)
      },
      {
        label: 'Potential Net',
        value: compactMoney(metrics.goalNet),
        source: metricSource(metrics.goalNet),
        basis: metrics.goalNet ? metricBasis(metrics.goalNet) : 'Company split / net margin missing'
      },
    ],
    metricDisplays: {
      current: compactNumber(metrics.currentTrueRelationships),
      target: compactNumber(metrics.relationshipTarget),
      gap: compactNumber(metrics.relationshipGap),
      label: 'TRUE RELATIONSHIPS',
      subtext: 'People who know, trust, and think of you.',
    },
  };
}

/**
 * @deprecated Internal hybrid map builder. MMM8 routes intelligence via
 * Business Engine Contract + projectBusinessMapFromContract. Kept only as
 * emergency structural reference; not used for semantic content when contract builds.
 */
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
  const panels = buildMetricPanels(metrics);
  const constraintLabel = formatValue(primaryConstraint.label, 'Primary constraint');
  const constraintSummary = formatValue(primaryConstraint.summary, 'The business needs a more inspectable operating rhythm.');
  const goalUnits = metrics.goalUnits ? `${metrics.goalUnits}` : 'Not provided';
  const closingInsight = buildClosingInsight({ metrics, primaryConstraint, eToP });

  return {
    ...panels,
    lake: {
      current: panels.metricDisplays.current,
      target: panels.metricDisplays.target,
      gap: panels.metricDisplays.gap,
      label: panels.metricDisplays.label,
      subtext: panels.metricDisplays.subtext,
      // Explicit legacy defaults only — marked for contract fallback path
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
        body: deriveMapDiagnosisBody({
          metrics,
          businessReality,
          primaryConstraint,
          constraintSummary,
          briefing,
          oneMove,
          draft,
        }),
      },
      {
        title: 'Impact',
        body: clipForVisual(impact, 120),
      },
      {
        title: 'Opportunity',
        body: clipForVisual(opportunity, 130),
      },
      {
        title: 'Bottom Line',
        body: clipForVisual(bottomLine, 130),
      },
    ],
    _legacy_note: 'Semantic map fields are superseded by Business Engine Contract projection when available.',
    _unused_goal_units_for_legacy: goalUnits,
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

function normalizeDraftSection(section, fallbackSummary = 'Not available', synthesizeSummary = null) {
  const directSummary = section?.summary || section?.diagnostic_summary;
  const resolvedSummary = directSummary
    ? formatValue(directSummary)
    : synthesizeSummary?.() || fallbackSummary;

  return {
    summary: resolvedSummary,
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
  const oneMoveProvenance = {
    hasRawTitle: hasRawValue(oneMove.title),
    hasRawRootConstraint: hasRawValue(oneMove.root_constraint),
    hasRawRecommendation: hasRawValue(oneMove.recommendation),
    hasRawModeledShift: hasRawValue(oneMove.expected_probability_shift?.explanation || oneMove.expected_probability_shift),
    hasRawProofSignals: hasRawValue(oneMove.success_indicators) || hasRawValue(oneMove.first_30_days) || hasRawValue(oneMove.why_this_move) || hasRawValue(oneMove.why_now),
    hasRawConfidence: hasRawValue(oneMove.confidence)
  };
  oneMoveProvenance.completeForPremium = Boolean(
    oneMoveProvenance.hasRawTitle &&
      oneMoveProvenance.hasRawRootConstraint &&
      oneMoveProvenance.hasRawRecommendation &&
      oneMoveProvenance.hasRawModeledShift &&
      oneMoveProvenance.hasRawProofSignals
  );
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

    businessReality: normalizeDraftSection(
      draft.business_reality,
      'Business reality is still being analyzed.',
      () => deriveBusinessRealitySummary(draft) || null
    ),
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
      title: oneMoveProvenance.hasRawTitle ? oneMove.title : 'One Move intelligence unavailable',
      rootConstraint: formatValue(oneMove.root_constraint || primaryConstraint.label || primaryConstraint.constraint_key, 'Root constraint not available.'),
      interventionCategory: formatValue(oneMove.intervention_category, 'Intervention'),
      recommendation: formatValue(oneMove.recommendation, 'One Move not generated yet.'),
      whyThisMove: formatValue(oneMove.why_this_move, 'The probability shift has not been modeled yet.'),
      whyNow: formatValue(oneMove.why_now, 'Timing not modeled yet.'),
      probabilityShift: formatValue(oneMove.expected_probability_shift?.explanation || oneMove.expected_probability_shift, 'Probability shift not available.'),
      first30Days: asArray(oneMove.first_30_days),
      successIndicators: asArray(oneMove.success_indicators),
      confidence: oneMoveProvenance.hasRawConfidence ? formatValue(oneMove.confidence) : 'Confidence not indexed',
      provenance: oneMoveProvenance
    }
  };

  const metrics = extractBusinessMetrics({ answers, draft, briefing, oneMove });
  const metricPanels = buildMetricPanels(metrics);

  // Canonical Business Engine Contract — strongest intelligence routing authority.
  const businessEngineContract = buildBusinessEngineContract(record, {
    eToP,
    metrics: {
      currentTrueRelationships: metrics.currentTrueRelationships,
      trueRelationshipEvidence: metrics.trueRelationshipEvidence,
      relationshipTarget: metrics.relationshipTarget,
      relationshipGap: metrics.relationshipGap,
    },
  });
  const contractValidation = validateBusinessEngineContract(businessEngineContract);

  const projectedMap = projectBusinessMapFromContract(businessEngineContract, {
    currentMetrics: metricPanels.currentMetrics,
    targetMetrics: metricPanels.targetMetrics,
    metricDisplays: metricPanels.metricDisplays,
  });

  normalized.businessEngineContract = businessEngineContract;
  normalized.businessEngineContractValidation = contractValidation;
  normalized.businessMap = projectedMap;

  // Align top-level normalized strings with contract (no weaker override).
  if (businessEngineContract.current_trajectory?.current) {
    const traj = businessEngineContract.current_trajectory.current;
    normalized.currentTrajectory = formatValue(
      traj.summary || traj.label || traj.direction,
      normalized.currentTrajectory
    );
  }
  if (businessEngineContract.potential_business_future?.current) {
    normalized.potentialFuture = formatValue(
      businessEngineContract.potential_business_future.current,
      normalized.potentialFuture
    );
  }
  if (businessEngineContract.primary_constraint?.current) {
    const pc = businessEngineContract.primary_constraint.current;
    normalized.primaryConstraint = {
      ...normalized.primaryConstraint,
      key: pc.category || normalized.primaryConstraint.key,
      label: formatValue(pc.name, normalized.primaryConstraint.label),
      summary: formatValue(pc.explanation, normalized.primaryConstraint.summary),
      evidence: Array.isArray(pc.supporting_evidence) && pc.supporting_evidence.length
        ? pc.supporting_evidence.slice(0, 5)
        : normalized.primaryConstraint.evidence,
      confidence: formatValue(
        businessEngineContract.primary_constraint.confidence,
        normalized.primaryConstraint.confidence
      ),
    };
  }
  if (businessEngineContract.causal_explanation?.current) {
    normalized.diagnosis = formatValue(
      businessEngineContract.causal_explanation.current,
      normalized.diagnosis
    );
  }
  if (businessEngineContract.future_change_logic?.current) {
    normalized.opportunity = formatValue(
      businessEngineContract.future_change_logic.current,
      normalized.opportunity
    );
  }
  if (businessEngineContract.no_change_consequence?.current) {
    normalized.impact = formatValue(
      businessEngineContract.no_change_consequence.current,
      normalized.impact
    );
  }
  if (businessEngineContract.one_move?.current?.recommendation) {
    normalized.bottomLine = formatValue(
      businessEngineContract.one_move.current.recommendation,
      normalized.bottomLine
    );
  }
  if (businessEngineContract.confidence_reality?.current) {
    normalized.confidenceReality = businessEngineContract.confidence_reality.current;
  }
  if (businessEngineContract.truth_boundaries?.current) {
    normalized.truthBoundaries = businessEngineContract.truth_boundaries.current;
  }
  // Final render-ready Truth Rail entries — renderer binds only; no reinterpretation.
  if (Array.isArray(businessEngineContract.truth_rail?.current) && businessEngineContract.truth_rail.current.length) {
    normalized.truthRail = businessEngineContract.truth_rail.current;
  }

  // Preserve legacy emergency builder only for debugging / compatibility inspection.
  normalized._legacyBusinessMapBuilderAvailable = typeof buildBusinessMapVisualCopy === 'function';

  return normalized;
}
