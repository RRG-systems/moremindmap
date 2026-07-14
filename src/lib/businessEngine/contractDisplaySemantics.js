/**
 * Contract-owned display rows and trajectory visualization semantics.
 *
 * Assembled upstream during Business Engine Contract build.
 * Visual projection and renderer may format these fields only —
 * they must not re-extract metrics from normalized/currentMetrics/targetMetrics
 * or invent trajectory direction, stage labels, or chart points.
 */

import {
  SOURCE_TYPES,
  INTELLIGENCE_STATUS,
} from './contractVersion.js';
import {
  asArray,
  hasMeaningfulValue,
  makeProvenance,
  textFrom,
} from './intelligenceField.js';

export const TRAJECTORY_DIRECTIONS = Object.freeze([
  'rising',
  'declining',
  'stable',
  'volatile',
  'mixed',
  'unknown',
]);

export const DISPLAY_ROW_IDS_CURRENT = Object.freeze([
  'true_relationships',
  'total_contacts',
  'annual_production',
  'units_closed',
  'gci',
  'estimated_net',
]);

export const DISPLAY_ROW_IDS_POTENTIAL = Object.freeze([
  'relationship_target',
  'goal_production',
  'goal_units',
  'potential_gci',
  'potential_net',
]);

function metricNumber(metric) {
  if (Number.isFinite(metric)) return metric;
  if (metric && typeof metric === 'object' && Number.isFinite(metric.value)) return metric.value;
  return null;
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

function parseMoneyNear(text, patterns) {
  const source = String(text || '');
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match) continue;
    const raw = String(match[1] || match[0]).replace(/[$,\s]/g, '');
    const multiplier = /billion|bn|b\b/i.test(raw)
      ? 1000000000
      : /million|mm|m\b/i.test(raw)
        ? 1000000
        : /thousand|k\b/i.test(raw)
          ? 1000
          : 1;
    const numeric = Number(raw.replace(/billion|million|thousand|bn|mm|[bmk]/gi, ''));
    if (Number.isFinite(numeric)) return numeric * multiplier;
  }
  return null;
}

function parseMoneyMetric(text, patterns, estimated = false) {
  const value = parseMoneyNear(text, patterns);
  return makeMetric(value, estimated);
}

function firstMetric(...metrics) {
  return metrics.find((metric) => metricNumber(metric) !== null) || null;
}

function textBlock(...values) {
  return values.map((value) => String(value || '')).join('\n\n');
}

function compactNumber(value) {
  if (value && typeof value === 'object' && value.range && Number.isFinite(value.low) && Number.isFinite(value.high)) {
    const prefix = value.estimated ? 'Approx. ' : '';
    const low = new Intl.NumberFormat('en-US').format(Math.round(value.low));
    const high = new Intl.NumberFormat('en-US').format(Math.round(value.high));
    return `${prefix}${low}–${high}`;
  }
  const numeric = metricNumber(value);
  if (!Number.isFinite(numeric)) return null;
  const prefix = value && typeof value === 'object' && value.estimated ? '~' : '';
  return `${prefix}${new Intl.NumberFormat('en-US').format(Math.round(numeric))}`;
}

function compactMoney(value) {
  const numeric = metricNumber(value);
  if (!Number.isFinite(numeric)) return null;
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

function metricBasis(metric, fallback = null) {
  return metric?.basis || fallback;
}

/**
 * Accept a true-relationship range only when both ends are plausible TR counts
 * (not total-contacts conflation). Reject spans where high/low > 5 or high looks
 * like a total-contact inventory versus a tight TR estimate.
 */
function isPlausibleTrueRelationshipRange(low, high, totalContacts = null) {
  if (!Number.isFinite(low) || !Number.isFinite(high)) return false;
  const a = Math.min(low, high);
  const b = Math.max(low, high);
  if (a <= 0 || b <= 0) return false;
  if (b / a > 5) return false;
  if (Number.isFinite(totalContacts)) {
    // Never treat total contacts as the high end of true relationships.
    if (b === totalContacts && a < totalContacts * 0.5) return false;
    if (b >= totalContacts && totalContacts > a) return false;
  }
  // True relationships are a relationship quality subset — multi-thousand spans are suspect.
  if (b > 2000 && b / a > 3) return false;
  return true;
}

function sanitizeTrueRelationshipMetric(metric, totalContactsMetric = null) {
  if (!metric) return null;
  const totalN = metricNumber(totalContactsMetric);
  if (metric.range && Number.isFinite(metric.low) && Number.isFinite(metric.high)) {
    if (!isPlausibleTrueRelationshipRange(metric.low, metric.high, totalN)) {
      // Prefer the low end when it looks like TR and high looks like total contacts.
      if (
        Number.isFinite(totalN) &&
        (metric.high === totalN || metric.high > totalN * 0.9) &&
        metric.low < totalN * 0.5
      ) {
        return makeMetric(metric.low, metric.estimated, {
          source: metric.source || 'Extracted',
          basis: 'true_relationships_low_end_after_rejecting_total_contacts_range',
        });
      }
      // Prefer mid only if span is modest; otherwise drop.
      if (metric.high / metric.low <= 5) {
        return makeMetric(metric.value ?? (metric.low + metric.high) / 2, true, {
          source: metric.source || 'Extracted',
          basis: 'range_collapsed_to_point_estimate',
        });
      }
      return makeMetric(metric.low, true, {
        source: metric.source || 'Extracted',
        basis: 'implausible_range_collapsed_to_low',
      });
    }
  }
  return metric;
}

function metricsFromRelationshipDraft(draft) {
  const rel = draft?.relationship_reality || {};
  const mentions = Array.isArray(rel.database_size_mentions) ? rel.database_size_mentions : [];
  const q3Evidence = rel.evidence?.q3 || '';

  let totalContacts = null;
  let trueRelationships = null;

  // Prefer total-before-true phrasing: "maybe 65 and true relationships are maybe 15-20"
  const totalFromQ3 = parseNumberNear(q3Evidence, [
    /maybe\s+(\d+)\s+and\s+true relationships/i,
    /but maybe\s+(\d+)/i,
    /total(?:\s+contacts?|\s+database)?(?:\s+is)?\s*(?:maybe|about|approximately)?\s*([\d,]+)/i,
  ]);
  if (Number.isFinite(totalFromQ3)) {
    totalContacts = makeMetric(totalFromQ3, false, { source: 'User provided' });
  }

  const rangeFromQ3 = parseRangeNear(q3Evidence, [
    /true relationships are maybe\s+(\d+)\s*[-–]\s*(\d+)(?!\s*(?:total|contacts?|people|in\s+my))/i,
    /true relationships(?: are)?(?: maybe)?\s+(\d+)\s*[-–]\s*(\d+)(?!\d)/i,
  ]);
  if (rangeFromQ3 && isPlausibleTrueRelationshipRange(rangeFromQ3.low, rangeFromQ3.high, metricNumber(totalContacts))) {
    trueRelationships = { ...rangeFromQ3, source: 'User provided' };
  } else if (rangeFromQ3) {
    trueRelationships = sanitizeTrueRelationshipMetric(rangeFromQ3, totalContacts);
  }

  const singleTrue = parseNumberNear(q3Evidence, [
    /true relationships are maybe\s+(\d+)(?!\s*[-–])/i,
    /true relationships(?: are)?(?: maybe)?\s+(\d+)(?!\s*[-–])/i,
    /about\s+([\d,]+)\s+are\s+true relationships/i,
  ]);
  if (!trueRelationships && Number.isFinite(singleTrue)) {
    trueRelationships = makeMetric(singleTrue, false, { source: 'User provided' });
  }

  if (!totalContacts && mentions.length >= 1) {
    const total = Number(String(mentions[0]).replace(/,/g, ''));
    if (Number.isFinite(total)) totalContacts = makeMetric(total, false, { source: 'Extracted' });
  }

  // Mentions pattern used by draft: [total, trueLow, trueHigh] — only accept plausible TR ranges.
  if (!trueRelationships && mentions.length >= 3) {
    const low = Number(String(mentions[1]).replace(/,/g, ''));
    const high = Number(String(mentions[2]).replace(/,/g, ''));
    const totalN = metricNumber(totalContacts);
    if (isPlausibleTrueRelationshipRange(low, high, totalN)) {
      trueRelationships = makeRangeMetric(low, high, false, { source: 'Extracted' });
    } else if (Number.isFinite(low) && (!Number.isFinite(totalN) || low !== totalN)) {
      trueRelationships = makeMetric(low, true, {
        source: 'Extracted',
        basis: 'mentions_true_relationship_point_after_range_reject',
      });
    }
  } else if (!trueRelationships && mentions.length === 2) {
    // [total, true] or [true, true-alt] — prefer second as TR when first is larger.
    const a = Number(String(mentions[0]).replace(/,/g, ''));
    const b = Number(String(mentions[1]).replace(/,/g, ''));
    if (Number.isFinite(a) && Number.isFinite(b) && b < a) {
      if (!totalContacts) totalContacts = makeMetric(a, false, { source: 'Extracted' });
      trueRelationships = makeMetric(b, false, { source: 'Extracted' });
    }
  }

  trueRelationships = sanitizeTrueRelationshipMetric(trueRelationships, totalContacts);
  return { totalContacts, trueRelationships };
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

/**
 * Deterministic extraction of metric sources from assessment evidence.
 * Not Intelligence Layer interpretation — evidence normalization for contract rows only.
 * Does not invent missing financial values.
 */
export function extractAssessmentMetricSources({ answers = {}, draft = {}, briefing = {}, oneMove = {} } = {}) {
  const relationshipDraftEvidence = draft?.relationship_reality?.evidence || {};
  const financialDraftEvidence = draft?.financial_reality?.evidence || {};
  const draftRelationshipMetrics = metricsFromRelationshipDraft(draft);
  const draftProductionMetrics = metricsFromProductionDraft(draft);
  const relationshipText = textBlock(
    answers.q3,
    answers.q5,
    relationshipDraftEvidence.q3,
    relationshipDraftEvidence.q5,
    oneMove?.recommendation,
    oneMove?.why_this_move
  );
  const financialText = textBlock(
    answers.q9,
    answers.q2,
    financialDraftEvidence.q9
  );

  const totalContacts = firstMetric(
    parseNumberMetric(String(answers.q3 || '') + '\n' + String(answers.q5 || ''), [
      /maybe\s+(\d+)\s+and\s+true relationships/i,
      /but maybe\s+(\d+)/i,
      /about\s+([\d,]+)\s+people\s+in\s+my\s+total\s+contact/i,
      /total database(?: is)?(?: roughly)?\s+([\d,]+)/i,
      /total contacts?(?: is|:)?\s*([\d,]+)/i,
      /([\d,]+)\s+total contacts/i,
      /([\d,]+)\s+contacts/i,
    ]),
    draftRelationshipMetrics.totalContacts
  );

  const rawTrueRange = parseRangeNear(answers.q3, [
    /true relationships are maybe\s+(\d+)\s*[-–]\s*(\d+)(?!\s*(?:total|contacts?))/i,
    /true relationships(?: are)?(?: maybe)?\s+(\d+)\s*[-–]\s*(\d+)(?!\d)/i,
  ]);
  const totalN = metricNumber(totalContacts);
  const safeTrueRange =
    rawTrueRange && isPlausibleTrueRelationshipRange(rawTrueRange.low, rawTrueRange.high, totalN)
      ? rawTrueRange
      : rawTrueRange
        ? sanitizeTrueRelationshipMetric(rawTrueRange, totalContacts)
        : null;

  const currentTrueRelationships = sanitizeTrueRelationshipMetric(
    firstMetric(
      safeTrueRange,
      parseNumberMetric(answers.q3, [
        /about\s+([\d,]+)\s+are\s+true relationships/i,
        /approximately\s+([\d,]+)\s+are\s+true relationships/i,
        /([\d,]+)\s+are\s+true relationships/i,
        /true relationships are maybe\s+(\d+)(?!\s*[-–])/i,
        /true relationship(?:s)?(?: database)?(?: is|:)?\s+(?:probably\s+|maybe\s+)?([\d,]+)/i,
      ]),
      draftRelationshipMetrics.trueRelationships,
      parseNumberMetric(
        relationshipText,
        [
          /about\s+([\d,]+)\s+strong relationships/i,
          /([\d,]+)\s+strong relationships/i,
          /([\d,]+)\s+of\s+those\s+are\s+friends,\s*good relationships/i,
        ],
        true
      )
    ),
    totalContacts
  );

  const relationshipTarget = firstMetric(
    parseRangeNear(
      answers.q2,
      [
        /date base to\s+(\d+)[.\-–]?\s*[-–]?\s*(\d+)/i,
        /relationship(?: and)? date base to\s+(\d+)[.\-–]?\s*[-–]?\s*(\d+)/i,
        /(?:data|date) base (?:at|to)\s+(\d+)[.\-–]?\s*[-–]?\s*(\d+)/i,
      ],
      false
    ),
    parseRangeNear(relationshipText, [/database to\s+(\d+)[.\-–]?\s*[-–]?\s*(\d+)/i], true),
    parseNumberMetric(
      relationshipText,
      [
        /grow\s+true relationships\s+toward\s+([\d,]+)/i,
        /true relationships\s+toward\s+([\d,]+)/i,
        /relationship(?:\s+lake)?\s+target(?:\s+is|:)?\s+([\d,]+)/i,
      ],
      true
    )
  );

  const currentUnits = firstMetric(
    makeMetric(
      parseNumberNear(String(answers.q9 || '') + '\n' + String(answers.q1 || ''), [
        /units closed\s+(\d+)/i,
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
    parseMoneyMetric(answers.q9, [/sales volume(?:-|:|\s)*(\$?[\d,.]+)/i, /sales volume:\s*(\$?[\d,.]+)/i], false),
    parseMoneyMetric(
      financialText + '\n' + String(answers.q1 || ''),
      [
        /sales volume:\s*approximately\s*(\$?[\d,.]+\s*[mk]?)/i,
        /annual sales.*?(\$?[\d,.]+\s*(?:m|k|million|billion)?)/i,
        /for\s+about\s*(\$?[\d,.]+\s*[mk]?)\s+in\s+volume/i,
      ],
      true
    ),
    draftProductionMetrics.volume
      ? { ...draftProductionMetrics.volume, estimated: false, source: 'Extracted' }
      : null
  );

  const currentGci = firstMetric(
    parseMoneyMetric(financialText + '\n' + String(answers.q2 || ''), [
      /gross commission income:\s*approximately\s*(\$?[\d,.]+\s*[mk]?)/i,
      /gci:\s*(?:about\s+|approximately\s+)?(\$?[\d,.]+\s*[mk]?)/i,
      /about\s*(\$?[\d,.]+\s*[mk]?)\s+in\s+gci/i,
    ], true)
  );

  const currentNet = firstMetric(
    parseMoneyMetric(financialText + '\n' + String(answers.q2 || ''), [
      /estimated net income before taxes:\s*approximately\s*(\$?[\d,.]+\s*[mk]?)/i,
      /estimated net before taxes:\s*about\s*(\$?[\d,.]+\s*[mk]?)/i,
      /net before taxes:\s*(?:approximately\s+|about\s+)?(\$?[\d,.]+\s*[mk]?)/i,
    ], true)
  );

  const goalUnits = parseNumberNear(String(answers.q2 || '') + '\n' + String(answers.q12 || ''), [
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
  ]);
  // Do not invent GCI from commission-rate assumptions — only explicit evidence.
  const goalGci = makeMetric(goalGciValue, false, { source: 'Extracted' });

  const goalNetValue = parseMoneyNear(answers.q2, [
    /net at least\s*(\$?[\d,.]+\s*[mk]?)/i,
    /net\s+(?:at least\s+)?(\$?[\d,.]+\s*[mk]?)/i,
  ]);
  const goalNet = makeMetric(goalNetValue, false, { source: 'Extracted' });

  const resolvedRelationshipTarget = relationshipTarget
    ? { ...relationshipTarget, source: relationshipTarget.source || 'Extracted', unit: 'true relationships' }
    : null;

  return {
    currentTrueRelationships,
    totalContacts,
    currentUnits,
    currentVolume,
    currentGci,
    currentNet,
    goalUnits: Number.isFinite(goalUnits) ? makeMetric(goalUnits, false, { source: 'Extracted' }) : null,
    goalVolume,
    goalGci,
    goalNet,
    relationshipTarget: resolvedRelationshipTarget,
    briefing_present: hasMeaningfulValue(briefing),
  };
}

function rawValueFromMetric(metric) {
  if (!metric) return null;
  if (typeof metric === 'number' && Number.isFinite(metric)) return metric;
  if (metric && typeof metric === 'object') {
    if (metric.range && Number.isFinite(metric.low) && Number.isFinite(metric.high)) {
      return { low: metric.low, high: metric.high, range: true, estimated: Boolean(metric.estimated) };
    }
    if (Number.isFinite(metric.value)) {
      return metric.estimated ? { value: metric.value, estimated: true } : metric.value;
    }
  }
  return null;
}

/**
 * Build a single render-ready display row. Omitted when no displayable value.
 */
export function makeDisplayRow({
  id,
  label,
  metric = null,
  display_value = null,
  unit = null,
  last_updated = null,
  source_type = SOURCE_TYPES.DETERMINISTIC_NORMALIZED,
  evidence_path = null,
  confidence = null,
} = {}) {
  const display =
    display_value ||
    (unit === 'money' ? compactMoney(metric) : compactNumber(metric));
  if (!hasMeaningfulValue(display) || /^not provided$/i.test(String(display))) {
    return null;
  }

  const source = metricSource(metric);
  const basis = metricBasis(metric);
  const estimated = Boolean(metric && typeof metric === 'object' && metric.estimated);
  const fallback_used = estimated || source_type === SOURCE_TYPES.DETERMINISTIC_NORMALIZED;

  return {
    id,
    label,
    display_value: String(display),
    raw_value: rawValueFromMetric(metric),
    unit: metric?.unit || (unit === 'money' ? 'currency' : unit === 'count' ? 'count' : unit || null),
    availability: 'available',
    status: 'present',
    basis: basis || null,
    source_type,
    evidence_sources: evidence_path
      ? [{ artifact: 'business_assessment_intake_or_draft', path: evidence_path, value: display }]
      : [],
    confidence: confidence ?? null,
    provenance: makeProvenance({
      source_artifact: 'deterministic_metric_assembly',
      source_path: evidence_path || id,
      source_rank: estimated ? 3 : 2,
      notes: source,
    }),
    fallback_used,
    fallback_reason: fallback_used
      ? estimated
        ? 'estimated_metric_from_evidence_extraction'
        : 'deterministic_display_assembly_from_assessment_evidence'
      : null,
    intelligence_status: estimated ? INTELLIGENCE_STATUS.FALLBACK : INTELLIGENCE_STATUS.PARTIAL,
    last_updated: last_updated || null,
    source_label: source,
  };
}

/**
 * Contract-owned Current Business Reality display rows.
 */
export function buildCurrentRealityDisplayRows({
  answers,
  draft,
  briefing,
  oneMove,
  lastUpdated,
  metricsOption = null,
} = {}) {
  const extracted = extractAssessmentMetricSources({ answers, draft, briefing, oneMove });
  // Prefer explicit options only when they are complete metric objects (lake path);
  // never accept parallel normalized panel arrays.
  const trueRel = metricsOption?.currentTrueRelationships || extracted.currentTrueRelationships;

  const candidates = [
    makeDisplayRow({
      id: 'true_relationships',
      label: 'True Relationships',
      metric: trueRel,
      unit: 'count',
      last_updated: lastUpdated,
      evidence_path: 'answers.q3|relationship_reality',
    }),
    makeDisplayRow({
      id: 'total_contacts',
      label: 'Total Contacts',
      metric: extracted.totalContacts,
      unit: 'count',
      last_updated: lastUpdated,
      evidence_path: 'answers.q3|answers.q5|relationship_reality',
    }),
    makeDisplayRow({
      id: 'annual_production',
      label: 'Annual Production',
      metric: extracted.currentVolume,
      unit: 'money',
      last_updated: lastUpdated,
      evidence_path: 'answers.q9|business_reality.current_production_reality',
    }),
    makeDisplayRow({
      id: 'units_closed',
      label: 'Units Closed',
      metric: extracted.currentUnits,
      unit: 'count',
      last_updated: lastUpdated,
      evidence_path: 'answers.q9|business_reality.current_production_reality',
    }),
    makeDisplayRow({
      id: 'gci',
      label: 'GCI',
      metric: extracted.currentGci,
      unit: 'money',
      last_updated: lastUpdated,
      evidence_path: 'answers.q9|financial_reality',
    }),
    makeDisplayRow({
      id: 'estimated_net',
      label: 'Estimated Net',
      metric: extracted.currentNet,
      unit: 'money',
      last_updated: lastUpdated,
      evidence_path: 'answers.q9|financial_reality',
    }),
  ].filter(Boolean);

  return {
    rows: candidates,
    availability: candidates.length > 0 ? 'available' : 'absent',
    extracted_for_lake: {
      currentTrueRelationships: trueRel,
      relationshipTarget: extracted.relationshipTarget,
    },
  };
}

/**
 * Contract-owned Potential Business Future display rows.
 * Only includes values with assessment/future evidence — never invents goals.
 */
export function buildPotentialFutureDisplayRows({
  answers,
  draft,
  briefing,
  oneMove,
  lastUpdated,
  metricsOption = null,
} = {}) {
  const extracted = extractAssessmentMetricSources({ answers, draft, briefing, oneMove });
  const target = metricsOption?.relationshipTarget || extracted.relationshipTarget;

  const relationshipDisplay = target
    ? (() => {
        const base = compactNumber(target);
        if (!base) return null;
        const unit = target.unit || 'true relationships';
        return base.includes(unit) ? base : `${base} ${unit}`;
      })()
    : null;

  const candidates = [
    makeDisplayRow({
      id: 'relationship_target',
      label: 'Relationship Target',
      metric: target,
      display_value: relationshipDisplay,
      unit: 'count',
      last_updated: lastUpdated,
      evidence_path: 'answers.q2|relationship target language',
    }),
    makeDisplayRow({
      id: 'goal_production',
      label: 'Goal Production',
      metric: extracted.goalVolume,
      unit: 'money',
      last_updated: lastUpdated,
      evidence_path: 'answers.q2',
    }),
    makeDisplayRow({
      id: 'goal_units',
      label: 'Goal Units',
      metric: extracted.goalUnits,
      unit: 'count',
      last_updated: lastUpdated,
      evidence_path: 'answers.q2|answers.q12',
    }),
    makeDisplayRow({
      id: 'potential_gci',
      label: 'Potential GCI',
      metric: extracted.goalGci,
      unit: 'money',
      last_updated: lastUpdated,
      evidence_path: 'answers.q2',
    }),
    makeDisplayRow({
      id: 'potential_net',
      label: 'Potential Net',
      metric: extracted.goalNet,
      unit: 'money',
      last_updated: lastUpdated,
      evidence_path: 'answers.q2',
    }),
  ].filter(Boolean);

  return {
    rows: candidates,
    availability: candidates.length > 0 ? 'available' : 'absent',
  };
}

/**
 * Future category / role labels describe what kind of future is selected.
 * They are NOT trajectory directions and must never coerce to rising/declining.
 */
export function isFutureCategoryDirectionLabel(raw) {
  if (raw == null) return false;
  const original = String(raw).toLowerCase().trim();
  if (!original) return false;
  const s = original.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

  // Exact category / role keys and common composites (including slash forms).
  const exact = new Set([
    'optimized future',
    'transformational future',
    'preferred future',
    'target future',
    'current future',
    'most likely next future',
    'constraint future',
    'modeled shift',
    'modeled shift trajectory',
    'optimized transformational',
    'optimized/transformational',
    'optimized / transformational',
  ]);
  if (exact.has(s) || exact.has(original.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim())) {
    return true;
  }

  // Probability-mass / shift phrasing that names futures, not motion.
  if (/optimized\s*\/\s*transformational/.test(s) && !/\b(ris|declin|stable|volatil|mixed|unknown)\b/.test(s)) {
    return true;
  }
  if (
    /^(optimized|transformational|preferred|target|current|constraint|most likely next) future\b/.test(s) &&
    !/\b(ris|declin|stable|volatil|mixed|unknown)\b/.test(s)
  ) {
    return true;
  }

  return false;
}

/**
 * Resolve potential-trajectory direction from strongest actual source only.
 * Priority (first supported wins):
 * 1. Explicit canonical visualization direction
 * 2. Explicit potential trajectory direction
 * 3. Explicit expected_direction
 * 4. Explicit trajectory logic direction
 * 5. Supported direction derived upstream from actual evidence (signal)
 * 6. unknown
 * 7. honest absence (caller / empty node)
 *
 * Never uses future category, role label, desirability, or recommendation strength.
 */
export function resolvePotentialTrajectoryDirection(source = null) {
  if (!source || typeof source !== 'object') {
    return {
      direction: 'unknown',
      raw: null,
      source_path: null,
      basis: 'honest_absence',
    };
  }

  const candidates = [
    ['visualization.direction', source.visualization?.direction],
    ['canonical_visualization_direction', source.canonical_visualization_direction],
    ['visualization_direction', source.visualization_direction],
    ['direction', source.direction],
    ['expected_direction', source.expected_direction],
    ['trajectory_direction', source.trajectory_direction],
    [
      'trajectory_logic.direction',
      source.trajectory_logic && typeof source.trajectory_logic === 'object'
        ? source.trajectory_logic.direction
        : null,
    ],
    // Explicit short trajectory_logic tokens only — not free-text narrative inference.
    [
      'trajectory_logic',
      typeof source.trajectory_logic === 'string' && String(source.trajectory_logic).trim().length <= 48
        ? source.trajectory_logic
        : null,
    ],
    ['signal', source.signal],
    ['direction_signal', source.direction_signal],
  ];

  for (const [path, value] of candidates) {
    if (!hasMeaningfulValue(value)) continue;
    const raw = textFrom(value);
    if (!raw) continue;
    if (isFutureCategoryDirectionLabel(raw)) continue;

    const direction = normalizeVisualizationDirection(raw, { role: 'potential' });
    if (direction !== 'unknown') {
      return { direction, raw, source_path: path, basis: path };
    }

    const low = raw.toLowerCase().replace(/[_-]+/g, ' ').trim();
    if (low === 'unknown' || low === 'unclear' || low === 'indeterminate' || low === 'absent') {
      return {
        direction: 'unknown',
        raw,
        source_path: path,
        basis: 'explicit_unknown',
      };
    }
  }

  return {
    direction: 'unknown',
    raw: null,
    source_path: null,
    basis: 'no_supported_direction',
  };
}

/**
 * Normalize free-text / signal vocabulary into bounded visualization directions.
 * Performed only during contract assembly (not in renderer).
 *
 * Future category / role labels are never directions.
 */
export function normalizeVisualizationDirection(raw, { role = 'current' } = {}) {
  void role; // role retained for call-site compatibility; does not invent direction.
  const s = String(raw || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!s) return 'unknown';

  if (TRAJECTORY_DIRECTIONS.includes(s)) return s;

  // Category/role labels must not coerce to rising (or any motion).
  if (isFutureCategoryDirectionLabel(raw) || isFutureCategoryDirectionLabel(s)) {
    return 'unknown';
  }

  if (/\b(declin|downward|down|deterior|worsen|falling|drop|regress|erod)/.test(s)) return 'declining';
  if (/\b(ris|grow|improv|upward|ascend|accelerat|expand|scaling up)\b/.test(s)) return 'rising';
  if (/\b(stable|flat|steady|maintain|status quo|plateau|unchanged)\b/.test(s)) return 'stable';
  if (/\b(volatil|swing|erratic|unpredict|churn)\b/.test(s)) return 'volatile';
  if (/\b(mixed|uneven|partial|conflicted)\b/.test(s)) return 'mixed';

  // Constraint / drag signals describe pressure, not rise.
  if (/\b(drag|stagnat|vulnerab|inefficien|constraint|bottleneck|friction)\b/.test(s)) {
    return 'declining';
  }

  return 'unknown';
}

/**
 * Pick the first non-category direction candidate in mission priority order.
 */
function pickRawDirectionFromCurrent(current) {
  if (!current || typeof current !== 'object') return null;
  const ordered = [
    current.visualization?.direction,
    current.canonical_visualization_direction,
    current.visualization_direction,
    current.direction,
    current.expected_direction,
    current.trajectory_direction,
    current.trajectory_logic && typeof current.trajectory_logic === 'object'
      ? current.trajectory_logic.direction
      : null,
    current.signal,
  ];
  for (const value of ordered) {
    if (!hasMeaningfulValue(value)) continue;
    const raw = textFrom(value);
    if (!raw) continue;
    if (isFutureCategoryDirectionLabel(raw)) continue;
    return raw;
  }
  return null;
}

function defaultStageLabels(direction, role) {
  if (direction === 'rising') {
    return role === 'potential'
      ? ['Current', 'Shift', 'Growth', 'Target']
      : ['Baseline', 'Lift', 'Momentum', 'Higher'];
  }
  if (direction === 'declining') {
    return ['Baseline', 'Pressure', 'Drag', 'Now'];
  }
  if (direction === 'stable') {
    return ['Baseline', 'Steady', 'Hold', 'Now'];
  }
  if (direction === 'volatile') {
    return ['Baseline', 'Swing', 'Swing', 'Now'];
  }
  if (direction === 'mixed') {
    return ['Baseline', 'Mixed', 'Mixed', 'Now'];
  }
  return [];
}

/**
 * Normalized chart points: x in [0,1] left→right, y in [0,1] bottom→top amplitude.
 * Contract-owned — renderer positions only, never rewrites meaning.
 */
function defaultPoints(direction) {
  if (direction === 'rising') {
    return [
      { x: 0.18, y: 0.22 },
      { x: 0.4, y: 0.34 },
      { x: 0.62, y: 0.48 },
      { x: 0.82, y: 0.62 },
    ];
  }
  if (direction === 'declining') {
    return [
      { x: 0.18, y: 0.62 },
      { x: 0.4, y: 0.48 },
      { x: 0.62, y: 0.34 },
      { x: 0.82, y: 0.22 },
    ];
  }
  if (direction === 'stable') {
    return [
      { x: 0.18, y: 0.4 },
      { x: 0.4, y: 0.42 },
      { x: 0.62, y: 0.38 },
      { x: 0.82, y: 0.4 },
    ];
  }
  if (direction === 'volatile') {
    return [
      { x: 0.18, y: 0.35 },
      { x: 0.4, y: 0.55 },
      { x: 0.62, y: 0.28 },
      { x: 0.82, y: 0.5 },
    ];
  }
  if (direction === 'mixed') {
    return [
      { x: 0.18, y: 0.38 },
      { x: 0.4, y: 0.45 },
      { x: 0.62, y: 0.32 },
      { x: 0.82, y: 0.4 },
    ];
  }
  return null;
}

/**
 * Attach contract-owned visualization semantics to a trajectory current payload.
 * Returns visualization object (also mutates payload.visualization for convenience).
 */
export function buildTrajectoryVisualization({
  current = null,
  role = 'current',
  nodeAvailable = false,
  explicitDirection = null,
  explicitStageLabels = null,
  explicitPoints = null,
  accessibilityLabel = null,
} = {}) {
  if (!nodeAvailable || !hasMeaningfulValue(current)) {
    return {
      availability: 'unavailable',
      direction: 'unknown',
      shape: 'none',
      stage_labels: [],
      points: null,
      emphasis: null,
      start_state: null,
      end_state: null,
      uncertainty: 'high',
      accessibility_label: accessibilityLabel || 'Trajectory visualization unavailable',
    };
  }

  const rawDirection =
    explicitDirection ||
    (typeof current === 'object' ? pickRawDirectionFromCurrent(current) : null);

  const direction = normalizeVisualizationDirection(rawDirection, { role });
  const stage_labels =
    Array.isArray(explicitStageLabels) && explicitStageLabels.length
      ? explicitStageLabels.map((label) => String(label))
      : Array.isArray(current?.stage_labels) && current.stage_labels.length
        ? current.stage_labels.map((label) => String(label))
        : defaultStageLabels(direction, role);

  const points =
    Array.isArray(explicitPoints) && explicitPoints.length
      ? explicitPoints
      : Array.isArray(current?.points) && current.points.length
        ? current.points
        : defaultPoints(direction);

  const shape =
    direction === 'unknown' || !points
      ? 'none'
      : direction === 'rising'
        ? 'ascending'
        : direction === 'declining'
          ? 'descending'
          : direction === 'stable'
            ? 'flat'
            : direction;

  const start_state =
    (typeof current === 'object' && textFrom(current.start_state || current.label)) || stage_labels[0] || null;
  const end_state =
    (typeof current === 'object' &&
      textFrom(current.end_state || current.required_structural_change || current.persistence_risk)) ||
    stage_labels[stage_labels.length - 1] ||
    null;

  const uncertainty =
    direction === 'unknown' ? 'high' : direction === 'volatile' || direction === 'mixed' ? 'moderate' : 'stated';

  const visualization = {
    availability: direction === 'unknown' || !points ? 'text_only' : 'available',
    direction,
    shape,
    stage_labels,
    points,
    emphasis: role === 'potential' ? 'modeled' : 'observed',
    start_state,
    end_state,
    uncertainty,
    accessibility_label:
      accessibilityLabel ||
      textFrom(typeof current === 'object' ? current.label || current.summary : current) ||
      `${role} trajectory ${direction}`,
  };

  if (current && typeof current === 'object') {
    current.visualization = visualization;
    // Canonical bounded direction for consumers (does not erase raw signal text).
    if (!current.visualization_direction) {
      current.visualization_direction = direction;
    }
  }

  return visualization;
}

/**
 * Format contract display rows for V2 projection (non-semantic formatting only).
 * Preserves contract-owned row metadata; does not invent values or change availability.
 */
export function formatContractDisplayRows(rows, max = 8) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row && row.availability !== 'unavailable' && hasMeaningfulValue(row.display_value))
    .slice(0, max)
    .map((row) => ({
      id: row.id || null,
      label: textFrom(row.label) || 'Metric',
      value: String(row.display_value),
      display_value: String(row.display_value),
      source: textFrom(row.source_label || row.provenance?.notes || row.basis) || null,
      source_label: textFrom(row.source_label) || null,
      basis: textFrom(row.basis) || null,
      status: textFrom(row.status) || null,
      availability: row.availability || 'available',
      confidence: row.confidence ?? null,
      fallback_used: Boolean(row.fallback_used),
      fallback_reason: textFrom(row.fallback_reason) || null,
      evidence_sources: asArray(row.evidence_sources),
      provenance: row.provenance && typeof row.provenance === 'object' ? row.provenance : null,
      intelligence_status: row.intelligence_status || null,
      last_updated: row.last_updated || null,
      unit: row.unit || null,
      raw_value: row.raw_value ?? null,
    }));
}

export default {
  extractAssessmentMetricSources,
  buildCurrentRealityDisplayRows,
  buildPotentialFutureDisplayRows,
  buildTrajectoryVisualization,
  normalizeVisualizationDirection,
  resolvePotentialTrajectoryDirection,
  isFutureCategoryDirectionLabel,
  formatContractDisplayRows,
  makeDisplayRow,
  TRAJECTORY_DIRECTIONS,
};
