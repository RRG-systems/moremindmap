/**
 * Canonical goal intelligence for Business Engine Contract.
 *
 * Deterministic evidence assembly only — not Intelligence Layer reinterpretation,
 * not renderer inference. Labels declared vs inferred vs fallback vs unavailable.
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

export const GOAL_SOURCES = Object.freeze([
  'declared',
  'inferred',
  'fallback',
  'unavailable',
]);

export const GOAL_TYPES = Object.freeze([
  'annual_income',
  'gci',
  'production',
  'units',
  'lifestyle',
  'relationship_base',
  'unavailable',
]);

function parseMoneyToken(raw) {
  if (raw == null) return null;
  const source = String(raw).trim();
  if (!source) return null;
  // Normalize "111, 000.00" / "111,000" / "$250K"
  const normalized = source
    .replace(/\$/g, '')
    .replace(/(\d),\s+(\d)/g, '$1$2')
    .replace(/,/g, '')
    .replace(/\s+/g, '');
  const multiplier = /billion|bn\b/i.test(source)
    ? 1000000000
    : /million|mm\b/i.test(source) || /[0-9]m\b/i.test(source)
      ? 1000000
      : /thousand/i.test(source) || /[0-9]k\b/i.test(source)
        ? 1000
        : 1;
  const numeric = Number(normalized.replace(/(billion|million|thousand|bn|mm|[bmk])/gi, ''));
  if (!Number.isFinite(numeric)) return null;
  return numeric * multiplier;
}

function parseNumberToken(raw) {
  if (raw == null) return null;
  const numeric = Number(String(raw).replace(/[$,\s]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function firstMatch(text, patterns) {
  const source = String(text || '');
  for (const entry of patterns) {
    const pattern = entry.re || entry;
    const match = source.match(pattern);
    if (!match) continue;
    return { match, meta: entry };
  }
  return null;
}

function answerBlob(answers = {}) {
  return [
    answers.q2,
    answers.q1,
    answers.q9,
    answers.q12,
    answers.q10,
    answers.q8,
  ]
    .map((v) => textFrom(v))
    .filter(Boolean)
    .join('\n\n');
}

function horizonFromText(text) {
  const source = String(text || '');
  const m = source.match(
    /\b(12\s*[-–]?\s*months?|24\s*[-–]?\s*months?|36\s*[-–]?\s*months?|1\s*year|2\s*years?|3\s*years?|5\s*[-–]?\s*7\s*years?|this year|next year)\b/i
  );
  return m ? m[1].replace(/\s+/g, ' ').trim() : null;
}

function emptyGoal(overrides = {}) {
  return {
    goal_type: 'unavailable',
    goal_value: null,
    goal_unit: null,
    goal_time_horizon: null,
    goal_source: 'unavailable',
    goal_confidence: null,
    declared_text: null,
    inference_reason: null,
    evidence_sources: [],
    contradictions: [],
    last_updated: null,
    provenance: makeProvenance({
      source_artifact: 'goal_intelligence',
      source_path: 'honest_absence',
      source_rank: 5,
      notes: 'No usable goal evidence',
    }),
    goal_summary: null,
    display_label: null,
    ...overrides,
  };
}

function moneySummary(value, unitLabel) {
  if (!Number.isFinite(value)) return null;
  const abs = Math.abs(value);
  let compact;
  if (abs >= 1000000) {
    const m = value / 1000000;
    compact = `$${Number.isInteger(m) ? m.toFixed(0) : m.toFixed(1)}M`;
  } else if (abs >= 1000) {
    compact = `$${Math.round(value / 1000)}K`;
  } else {
    compact = `$${Math.round(value)}`;
  }
  return unitLabel ? `${compact} ${unitLabel}` : compact;
}

/**
 * Build canonical goal intelligence from assessment evidence.
 * Priority order is enforced strictly.
 */
export function buildGoalIntelligence({
  answers = {},
  draft = {},
  briefing = {},
  lastUpdated = null,
} = {}) {
  const q2 = textFrom(answers.q2);
  const q12 = textFrom(answers.q12);
  const q9 = textFrom(answers.q9);
  const blob = answerBlob(answers);
  const financialEvidence = textFrom(draft?.financial_reality?.evidence?.q9) || '';
  const productionEvidence = textFrom(
    draft?.business_reality?.current_production_reality?.diagnostic_summary ||
      draft?.business_reality?.diagnostic_summary
  );
  const searchPrimary = [q2, q12].filter(Boolean).join('\n');
  const searchAll = [searchPrimary, q9, financialEvidence, productionEvidence, blob]
    .filter(Boolean)
    .join('\n');

  const contradictions = [];
  const evidence = [];

  // --- Priority 1: Explicit declared annual income / GCI ---
  const incomeDeclared = firstMatch(searchPrimary, [
    {
      re: /(?:i\s+want\s+to\s+make|want\s+to\s+make|want\s+to\s+earn|make|earn|target(?:ing)?|goal(?:\s+is)?|aim(?:ing)?\s+(?:for|to)|annual\s+(?:income|gci)|gci(?:\s+goal)?(?:\s+is|:)?|gross\s+commission\s+income)\s*(?:of\s+|about\s+|approximately\s+|around\s+|at\s+least\s+|~)?\$?\s*([\d,. ]+)\s*([kmb]|thousand|million)?(?:\s*(?:per\s+year|\/\s*year|annually|a\s+year|in\s+(?:annual\s+)?(?:income|gci)))?/i,
      kind: 'income_or_gci',
    },
    {
      re: /\$\s*([\d,. ]+)\s*([kmb])?\s*(?:in\s+)?(?:annual\s+)?(?:income|gci|gross\s+commission)/i,
      kind: 'income_or_gci',
    },
    {
      re: /(?:annual\s+income|gci|income\s+goal)\s*(?:of|:)?\s*\$?\s*([\d,. ]+)\s*([kmb])?/i,
      kind: 'income_or_gci',
    },
    {
      re: /(?:with\s+about|about)\s*\$?\s*([\d,. ]+)\s*([kmb])?\s+in\s+gci/i,
      kind: 'gci',
    },
  ]);

  if (incomeDeclared) {
    const value = parseMoneyToken(
      `${incomeDeclared.match[1]}${incomeDeclared.match[2] || ''}`
    );
    if (Number.isFinite(value) && value >= 1000) {
      const isGci =
        incomeDeclared.meta.kind === 'gci' ||
        /gci|gross\s+commission/i.test(incomeDeclared.match[0]);
      const declared_text = incomeDeclared.match[0].trim();
      evidence.push({
        artifact: 'business_assessment_intake',
        path: 'answers.q2|q12',
        value: declared_text,
      });
      return {
        goal_type: isGci ? 'gci' : 'annual_income',
        goal_value: value,
        goal_unit: isGci ? 'gci_usd' : 'annual_income_usd',
        goal_time_horizon: horizonFromText(searchPrimary) || '12 months',
        goal_source: 'declared',
        goal_confidence: 'high',
        declared_text,
        inference_reason: null,
        evidence_sources: evidence,
        contradictions,
        last_updated: lastUpdated,
        provenance: makeProvenance({
          source_artifact: 'business_assessment_intake',
          source_path: 'answers.q2|q12',
          source_rank: 1,
          notes: 'Explicit declared income/GCI goal',
        }),
        goal_summary: moneySummary(value, isGci ? 'GCI' : 'annual income'),
        display_label: moneySummary(value, isGci ? 'GCI' : 'annual income'),
        source_type: SOURCE_TYPES.DETERMINISTIC_NORMALIZED,
        intelligence_status: INTELLIGENCE_STATUS.PARTIAL,
      };
    }
  }

  // Net income declared (still income family, priority 1 adjacent)
  const netDeclared = firstMatch(searchPrimary, [
    {
      // Bound number to money tokens only — do not swallow "24 months" into multiplier.
      re: /net(?:ted|)\s+(?:at\s+least\s+)?\$?\s*((?:\d{1,3}(?:,\s?\d{3})+|\d+)(?:\.\d+)?)\s*([kmb])?(?![a-z])/i,
      kind: 'net',
    },
    {
      re: /net\s+income(?:\s+before\s+taxes)?\s*(?:of|:)?\s*\$?\s*((?:\d{1,3}(?:,\s?\d{3})+|\d+)(?:\.\d+)?)\s*([kmb])?(?![a-z])/i,
      kind: 'net',
    },
  ]);
  if (netDeclared) {
    const suffix = netDeclared.match[2] || '';
    const value = parseMoneyToken(`${netDeclared.match[1]}${suffix}`);
    if (Number.isFinite(value) && value >= 1000) {
      const declared_text = `Netted ${netDeclared.match[1]}${suffix}`.trim();
      return {
        goal_type: 'annual_income',
        goal_value: value,
        goal_unit: 'net_income_usd',
        goal_time_horizon: horizonFromText(searchPrimary) || '12 months',
        goal_source: 'declared',
        goal_confidence: 'high',
        declared_text,
        inference_reason: null,
        evidence_sources: [
          {
            artifact: 'business_assessment_intake',
            path: 'answers.q2',
            value: declared_text,
          },
        ],
        contradictions,
        last_updated: lastUpdated,
        provenance: makeProvenance({
          source_artifact: 'business_assessment_intake',
          source_path: 'answers.q2',
          source_rank: 1,
          notes: 'Explicit declared net income goal',
        }),
        goal_summary: moneySummary(value, 'net income'),
        display_label: moneySummary(value, 'net income'),
        source_type: SOURCE_TYPES.DETERMINISTIC_NORMALIZED,
        intelligence_status: INTELLIGENCE_STATUS.PARTIAL,
      };
    }
  }

  // --- Priority 2: Explicit declared production goal ---
  const productionDeclared = firstMatch(searchPrimary, [
    {
      re: /(?:sales\s+volume|production(?:\s+goal)?|volume\s+goal)\s*(?:of|:|to)?\s*\$?\s*([\d,.]+)\s*([kmb]|million)?/i,
    },
    {
      re: /(?:roughly|around|about)\s*\$?\s*([\d,.]+)\s*([kmb])?\s+in\s+sales\s+volume/i,
    },
    {
      re: /\$?\s*([\d,.]+)\s*([kmb]|million)?\s+in\s+sales\s+volume/i,
    },
  ]);
  if (productionDeclared) {
    const value = parseMoneyToken(
      `${productionDeclared.match[1]}${productionDeclared.match[2] || ''}`
    );
    if (Number.isFinite(value) && value >= 10000) {
      const declared_text = productionDeclared.match[0].trim();
      return {
        goal_type: 'production',
        goal_value: value,
        goal_unit: 'sales_volume_usd',
        goal_time_horizon: horizonFromText(searchPrimary) || '12 months',
        goal_source: 'declared',
        goal_confidence: 'high',
        declared_text,
        inference_reason: null,
        evidence_sources: [
          {
            artifact: 'business_assessment_intake',
            path: 'answers.q2',
            value: declared_text,
          },
        ],
        contradictions,
        last_updated: lastUpdated,
        provenance: makeProvenance({
          source_artifact: 'business_assessment_intake',
          source_path: 'answers.q2',
          source_rank: 1,
          notes: 'Explicit declared production/volume goal',
        }),
        goal_summary: moneySummary(value, 'sales volume'),
        display_label: moneySummary(value, 'sales volume'),
        source_type: SOURCE_TYPES.DETERMINISTIC_NORMALIZED,
        intelligence_status: INTELLIGENCE_STATUS.PARTIAL,
      };
    }
  }

  // --- Priority 3: Explicit declared units goal ---
  const unitsDeclared = firstMatch(searchPrimary, [
    {
      re: /(?:12-month\s+goal:\s*)?close\s+([\d,]+)\s+units/i,
    },
    {
      re: /goal\s+is\s+([\d,]+)\s+units/i,
    },
    {
      re: /(?:like\s+to\s+be\s+at|target(?:ing)?)\s+([\d,]+)\s*(?:transactions|units|closings)/i,
    },
  ]);
  if (unitsDeclared) {
    const value = parseNumberToken(unitsDeclared.match[1]);
    if (Number.isFinite(value) && value > 0 && value < 10000) {
      const declared_text = unitsDeclared.match[0].trim();
      return {
        goal_type: 'units',
        goal_value: value,
        goal_unit: 'units',
        goal_time_horizon: horizonFromText(searchPrimary) || '12 months',
        goal_source: 'declared',
        goal_confidence: 'high',
        declared_text,
        inference_reason: null,
        evidence_sources: [
          {
            artifact: 'business_assessment_intake',
            path: 'answers.q2|q12',
            value: declared_text,
          },
        ],
        contradictions,
        last_updated: lastUpdated,
        provenance: makeProvenance({
          source_artifact: 'business_assessment_intake',
          source_path: 'answers.q2|q12',
          source_rank: 1,
          notes: 'Explicit declared units goal',
        }),
        goal_summary: `${value} units`,
        display_label: `${value} units`,
        source_type: SOURCE_TYPES.DETERMINISTIC_NORMALIZED,
        intelligence_status: INTELLIGENCE_STATUS.PARTIAL,
      };
    }
  }

  // --- Priority 4: Explicit stated future income/business condition (broader narrative) ---
  const futureCondition = firstMatch(searchAll, [
    {
      re: /(?:want|need|plan(?:ning)?\s+to|hope\s+to|looking\s+to)\s+(?:make|earn|hit|reach)\s+\$?\s*([\d,.]+)\s*([kmb])?/i,
    },
    {
      re: /\$\s*([\d,.]+)\s*([kmb])\s*(?:year|annual|income|gci)/i,
    },
  ]);
  if (futureCondition) {
    const value = parseMoneyToken(
      `${futureCondition.match[1]}${futureCondition.match[2] || ''}`
    );
    if (Number.isFinite(value) && value >= 10000) {
      const declared_text = futureCondition.match[0].trim();
      return {
        goal_type: 'annual_income',
        goal_value: value,
        goal_unit: 'annual_income_usd',
        goal_time_horizon: horizonFromText(searchAll) || null,
        goal_source: 'declared',
        goal_confidence: 'medium',
        declared_text,
        inference_reason: null,
        evidence_sources: [
          {
            artifact: 'business_assessment_intake',
            path: 'answers.narrative',
            value: declared_text,
          },
        ],
        contradictions,
        last_updated: lastUpdated,
        provenance: makeProvenance({
          source_artifact: 'business_assessment_intake',
          source_path: 'answers.narrative_goal_recovery',
          source_rank: 2,
          notes: 'Narrative future income/business condition recovered',
        }),
        goal_summary: moneySummary(value, 'annual income'),
        display_label: moneySummary(value, 'annual income'),
        source_type: SOURCE_TYPES.DETERMINISTIC_NORMALIZED,
        intelligence_status: INTELLIGENCE_STATUS.PARTIAL,
      };
    }
  }

  // --- Priority 5: Strong fused inference (multiple quantitative goal signals) ---
  const relTarget = firstMatch(q2, [
    {
      re: /(?:relationship|date\s*base|data\s*base|database).{0,40}?(\d+)\s*[.\-–]\s*(\d+)/i,
    },
    {
      re: /(?:relationship|date\s*base|data\s*base|database).{0,40}?(?:to|at)\s+(\d{2,5})/i,
    },
  ]);
  const netInQ2 = firstMatch(q2, [{ re: /net(?:ted|)\s+\$?\s*([\d,.]+)/i }]);
  if (relTarget && netInQ2) {
    const netValue = parseMoneyToken(netInQ2.match[1]);
    const low = parseNumberToken(relTarget.match[1]);
    const high = parseNumberToken(relTarget.match[2] || relTarget.match[1]);
    if (Number.isFinite(netValue) && Number.isFinite(low)) {
      return {
        goal_type: 'annual_income',
        goal_value: netValue,
        goal_unit: 'net_income_usd',
        goal_time_horizon: horizonFromText(q2) || '12 months',
        goal_source: 'inferred',
        goal_confidence: 'medium',
        declared_text: null,
        inference_reason:
          'Fused net-income language with relationship/database target in goal answers',
        evidence_sources: [
          {
            artifact: 'business_assessment_intake',
            path: 'answers.q2',
            value: netInQ2.match[0],
          },
          {
            artifact: 'business_assessment_intake',
            path: 'answers.q2',
            value: relTarget.match[0],
          },
        ],
        contradictions,
        last_updated: lastUpdated,
        provenance: makeProvenance({
          source_artifact: 'goal_intelligence',
          source_path: 'fused_q2_income_and_relationship_target',
          source_rank: 3,
          notes: 'Strong multi-signal inference',
        }),
        goal_summary: moneySummary(netValue, 'net income'),
        display_label: moneySummary(netValue, 'net income'),
        source_type: SOURCE_TYPES.DETERMINISTIC_NORMALIZED,
        intelligence_status: INTELLIGENCE_STATUS.FALLBACK,
        related_relationship_target:
          Number.isFinite(high) && high !== low
            ? { low, high, range: true }
            : { value: low },
      };
    }
  }

  // --- Priority 6: Bounded conversion from explicit relationship-base goal alone ---
  if (relTarget) {
    const low = parseNumberToken(relTarget.match[1]);
    const high = parseNumberToken(relTarget.match[2] || relTarget.match[1]);
    if (Number.isFinite(low) && low >= 10) {
      const mid = Number.isFinite(high) ? (low + high) / 2 : low;
      return {
        goal_type: 'relationship_base',
        goal_value: Math.round(mid),
        goal_unit: 'true_relationships_or_database',
        goal_time_horizon: horizonFromText(q2) || '12 months',
        goal_source: 'inferred',
        goal_confidence: 'medium',
        declared_text: relTarget.match[0].trim(),
        inference_reason:
          'Relationship/database target stated without clean income goal; treated as relationship-base goal',
        evidence_sources: [
          {
            artifact: 'business_assessment_intake',
            path: 'answers.q2',
            value: relTarget.match[0],
          },
        ],
        contradictions,
        last_updated: lastUpdated,
        provenance: makeProvenance({
          source_artifact: 'goal_intelligence',
          source_path: 'answers.q2.relationship_or_database_target',
          source_rank: 3,
          notes: 'Bounded from explicit relationship/database target',
        }),
        goal_summary:
          Number.isFinite(high) && high !== low
            ? `${low}–${high} relationship base`
            : `${low} relationship base`,
        display_label:
          Number.isFinite(high) && high !== low
            ? `${low}–${high} relationship base`
            : `${low} relationship base`,
        source_type: SOURCE_TYPES.DETERMINISTIC_NORMALIZED,
        intelligence_status: INTELLIGENCE_STATUS.FALLBACK,
      };
    }
  }

  // Lifestyle language without numbers — honest partial absence for numeric goal
  if (/retirement|balanced life|time freedom|lifestyle/i.test(searchPrimary) && !/\$|\d{2,}/.test(searchPrimary)) {
    return emptyGoal({
      goal_type: 'lifestyle',
      goal_source: 'unavailable',
      goal_confidence: 'low',
      declared_text: textFrom(q2)?.slice(0, 160) || null,
      inference_reason:
        'Lifestyle objective present without quantifiable income/production/units goal',
      evidence_sources: q2
        ? [{ artifact: 'business_assessment_intake', path: 'answers.q2', value: q2.slice(0, 160) }]
        : [],
      last_updated: lastUpdated,
      provenance: makeProvenance({
        source_artifact: 'goal_intelligence',
        source_path: 'lifestyle_without_quantified_goal',
        source_rank: 5,
        notes: 'Honest absence of numeric goal',
      }),
      goal_summary: null,
      display_label: null,
    });
  }

  // --- Priority 7: Honest absence ---
  void briefing;
  void asArray;
  void hasMeaningfulValue;

  return emptyGoal({
    last_updated: lastUpdated,
    inference_reason: 'No declared or responsibly inferable quantified business goal found',
  });
}

export function isGoalAvailable(goal) {
  return Boolean(
    goal &&
      goal.goal_source !== 'unavailable' &&
      Number.isFinite(goal.goal_value)
  );
}

export default buildGoalIntelligence;
