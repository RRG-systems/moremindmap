/**
 * Real-estate vertical adapter.
 *
 * Separates RE-specific business-model semantics (MET-style lake, GCI, units,
 * industry stream defaults) from the universal Business Engine Contract.
 *
 * Universal contract must not require these fields for other verticals.
 *
 * IMPORTANT: Alias/regex/text-scan extraction is deterministic inference, not
 * canonical domain intelligence. Callers must mark fallback provenance.
 */

import { VERTICAL_ADAPTER_VERSION_REAL_ESTATE } from './contractVersion.js';
import { asArray, hasMeaningfulValue, textFrom } from './intelligenceField.js';

export const REAL_ESTATE_LEGACY_STREAMS = Object.freeze([
  'Past Clients',
  'Referrals',
  'Open Houses',
  'Sphere / Network',
  'Vendor Partners',
  'Community Events',
  'Database Reactivation',
]);

export const REAL_ESTATE_LEGACY_OUTFLOW = Object.freeze([
  'Appointments',
  'Listings',
  'Buyers',
  'Referrals',
  'Repeat Business',
  'GCI',
  'Time Freedom',
]);

/** Outcome-shaped labels only — never clipped prose or issue fragments. */
export const REAL_ESTATE_OUTCOME_LABELS = Object.freeze(new Set(REAL_ESTATE_LEGACY_OUTFLOW.concat([
  'Relationship Touches',
  'Pipeline Conversion',
  'Paid / Online Leads',
  'Personal Connections',
])));

const STREAM_ALIASES = [
  { match: /past client|past-client|prior client/i, name: 'Past Clients' },
  { match: /referral/i, name: 'Referrals' },
  { match: /open house/i, name: 'Open Houses' },
  { match: /sphere|network|soi|sphere of influence/i, name: 'Sphere / Network' },
  { match: /vendor|builder|partner/i, name: 'Vendor Partners' },
  { match: /community|event|gather/i, name: 'Community Events' },
  { match: /database|reactivat|crm|nurture|follow-?up/i, name: 'Database Reactivation' },
  { match: /paid lead|lead gen|zillow|online lead|cold/i, name: 'Paid / Online Leads' },
  { match: /friend|call friend|personal connection|natural connection/i, name: 'Personal Connections' },
];

const OUTFLOW_ALIASES = [
  { match: /appointment/i, name: 'Appointments' },
  { match: /listing/i, name: 'Listings' },
  { match: /buyer/i, name: 'Buyers' },
  { match: /referral/i, name: 'Referrals' },
  { match: /repeat/i, name: 'Repeat Business' },
  { match: /\bgci\b|commission/i, name: 'GCI' },
  { match: /time freedom|freedom|leverage/i, name: 'Time Freedom' },
  { match: /conversation|touch|relationship touch/i, name: 'Relationship Touches' },
  { match: /pipeline|conversion/i, name: 'Pipeline Conversion' },
];

/** Labels that look like issue diagnoses or clipped prose — never valid outflow. */
const INVALID_OUTFLOW_NAME_RE =
  /lead shortage|shortage possible|all known contacts|\.\.\.|overdue follow-up|weekly inspection|can state how many|new leads are not|not just contacted/i;

export function isRealEstateAssessment(assessmentType, answers = {}) {
  const type = String(assessmentType || '').toLowerCase();
  if (type.includes('real_estate') || type.includes('real-estate') || type.includes('realtor')) {
    return true;
  }
  // Many BA records use generic business_assessment but are RE by intake language.
  const blob = JSON.stringify(answers || {}).toLowerCase();
  return /real estate|listing|gci|buyer|seller|open house|crm relationship/.test(blob);
}

export function buildVerticalContext({ assessmentType, answers, lastUpdated }) {
  const realEstate = isRealEstateAssessment(assessmentType, answers);
  return {
    vertical_id: realEstate ? 'real_estate' : 'universal_or_unspecified',
    vertical_label: realEstate ? 'Real Estate' : 'Universal / Unspecified',
    vertical_adapter_version: realEstate ? VERTICAL_ADAPTER_VERSION_REAL_ESTATE : null,
    is_first_vertical: realEstate,
    notes: realEstate
      ? 'Real estate is the first vertical adapter, not the universal Business Engine itself.'
      : 'No dedicated vertical adapter selected; universal contract fields only.',
    last_updated: lastUpdated || null,
    surface_projections_allowed: realEstate
      ? ['relationship_lake', 'gci_units_metrics', 'real_estate_streams_outflow']
      : [],
  };
}

function uniqueNames(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const name = typeof item === 'string' ? item : item?.name;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(
      typeof item === 'string'
        ? {
            name,
            role: null,
            current_strength: null,
            momentum_or_drag: null,
            evidence: [],
            confidence: null,
            derivation: 'deterministic_alias_or_text_scan',
          }
        : item
    );
  }
  return out;
}

function extractNamesFromText(text, aliases, evidencePath) {
  const source = String(text || '');
  if (!source.trim()) return [];
  const found = [];
  for (const alias of aliases) {
    if (alias.match.test(source)) {
      found.push({
        name: alias.name,
        role: 'detected_from_intelligence_text',
        current_strength: null,
        momentum_or_drag: null,
        evidence: [
          {
            path: evidencePath || 'text_scan',
            snippet: source.slice(0, 160),
            derivation: 'alias_regex_text_scan',
          },
        ],
        confidence: 'inferred',
        derivation: 'deterministic_alias_regex_text_scan',
      });
    }
  }
  return found;
}

function isValidOutflowName(name) {
  const label = String(name || '').trim();
  if (!label) return false;
  if (label.length > 42) return false;
  if (INVALID_OUTFLOW_NAME_RE.test(label)) return false;
  if (/\.\.\.$/.test(label)) return false;
  // Prefer known outcome labels; reject free-form issue prose title-cased fragments.
  if (REAL_ESTATE_OUTCOME_LABELS.has(label)) return true;
  // Short multi-word title-case outcomes from alias table only (alias path sets known names).
  return false;
}

/**
 * Build personalized stream candidates from RE intelligence (not universal).
 * All results are deterministic alias/text-scan inference — not canonical domain intelligence.
 */
export function deriveRealEstateStreams({ draft, briefing, answers }) {
  const lead = draft?.lead_generation_reality || {};
  const sources = [];

  const diversity = asArray(lead.lead_source_diversity);
  for (const item of diversity) {
    const label = textFrom(item);
    if (!label) continue;
    const alias = STREAM_ALIASES.find((entry) => entry.match.test(label));
    sources.push({
      name: alias?.name || label.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      role: 'stated_or_inferred_lead_source',
      current_strength: lead.lead_shortage_signal ? 'constrained' : 'active',
      momentum_or_drag: lead.consistency_risk === 'elevated' ? 'drag' : 'momentum',
      evidence: asArray(lead.evidence ? Object.values(lead.evidence) : []).slice(0, 2).concat([
        {
          path: 'lead_generation_reality.lead_source_diversity',
          value: label,
          derivation: alias ? 'alias_match' : 'label_normalize',
        },
      ]),
      confidence: lead.lead_generation_constraint_probability || 'inferred',
      derivation: 'deterministic_alias_or_label_normalize',
    });
  }

  const behaviorText = textFrom(lead.stated_generation_behaviors);
  sources.push(
    ...extractNamesFromText(behaviorText, STREAM_ALIASES, 'lead_generation_reality.stated_generation_behaviors')
  );

  const sectionBody = (() => {
    const sections = Array.isArray(briefing?.sections) ? briefing.sections : [];
    const section = sections.find((item) => item?.key === 'lead_generation_reality');
    return section?.body || '';
  })();
  sources.push(
    ...extractNamesFromText(sectionBody, STREAM_ALIASES, 'briefing.sections.lead_generation_reality.body')
  );

  const answerBlob = [answers?.q4, answers?.q5].map((v) => textFrom(v)).filter(Boolean).join('\n');
  sources.push(...extractNamesFromText(answerBlob, STREAM_ALIASES, 'intake.answers.q4|q5'));

  return uniqueNames(sources);
}

/**
 * Build outflow candidates that represent actual business outcomes.
 * Rejects conversion-issue labels and clipped One Move success-indicator prose.
 * All results are deterministic inference — not canonical domain intelligence.
 */
export function deriveRealEstateOutflow({ draft, oneMove, briefing }) {
  const conversion = draft?.lead_conversion_reality || {};
  const production = draft?.business_reality?.current_production_reality || draft?.business_reality || {};
  const sources = [];

  // Do NOT promote conversion.likely_issue (e.g. "Lead Shortage Possible") to outflow.
  // Conversion issues are constraint signals, not business outcomes.

  // Only alias-matched outcome names from success indicators — never clipName(prose).
  const success = asArray(oneMove?.success_indicators);
  for (const item of success) {
    const text = textFrom(item);
    if (!text) continue;
    const alias = OUTFLOW_ALIASES.find((entry) => entry.match.test(text));
    if (!alias) continue;
    sources.push({
      name: alias.name,
      role: 'one_move_success_indicator_alias',
      current_state: 'modeled_target',
      conversion_implication: text,
      evidence: [
        {
          path: 'one_move_v1.success_indicators',
          snippet: text.slice(0, 160),
          derivation: 'alias_regex_match_only',
        },
      ],
      confidence: 'inferred',
      derivation: 'deterministic_alias_from_success_indicators',
    });
  }

  const shiftText = textFrom(oneMove?.expected_probability_shift?.explanation || oneMove?.expected_probability_shift);
  sources.push(
    ...extractNamesFromText(shiftText, OUTFLOW_ALIASES, 'one_move_v1.expected_probability_shift').map((item) => ({
      ...item,
      role: 'modeled_shift_outcome_alias',
      current_state: 'modeled',
      conversion_implication: shiftText,
      confidence: 'inferred',
    }))
  );

  const productionText = textFrom(production.summary || production.diagnostic_summary);
  sources.push(
    ...extractNamesFromText(productionText, OUTFLOW_ALIASES, 'business_reality.production')
  );

  const sectionBody = (() => {
    const sections = Array.isArray(briefing?.sections) ? briefing.sections : [];
    const section = sections.find((item) =>
      ['lead_conversion_follow_up_reality', 'current_business_reality'].includes(item?.key)
    );
    return section?.body || '';
  })();
  sources.push(
    ...extractNamesFromText(sectionBody, OUTFLOW_ALIASES, 'briefing.conversion_or_production_section')
  );

  // Structured conversion discipline → pipeline conversion when present
  if (textFrom(conversion.conversion_discipline) || textFrom(conversion.follow_up_system_strength)) {
    sources.push({
      name: 'Pipeline Conversion',
      role: 'conversion_system_signal',
      current_state: textFrom(conversion.conversion_discipline) || 'unclear',
      conversion_implication: textFrom(conversion.follow_up_system_strength)
        ? `Follow-up system strength: ${textFrom(conversion.follow_up_system_strength)}`
        : null,
      evidence: [
        {
          path: 'lead_conversion_reality',
          derivation: 'structured_field_to_outcome_label',
        },
      ],
      confidence: 'inferred',
      derivation: 'deterministic_structured_mapping',
    });
  }

  const unique = uniqueNames(sources).filter((item) => isValidOutflowName(item.name));
  return unique;
}

export function legacyStreamFallback() {
  return REAL_ESTATE_LEGACY_STREAMS.map((name) => ({
    name,
    role: 'legacy_real_estate_default',
    current_strength: null,
    momentum_or_drag: null,
    evidence: [],
    confidence: null,
    fallback: true,
    derivation: 'legacy_default_list',
  }));
}

export function legacyOutflowFallback() {
  return REAL_ESTATE_LEGACY_OUTFLOW.map((name) => ({
    name,
    role: 'legacy_real_estate_default',
    current_state: null,
    conversion_implication: null,
    evidence: [],
    confidence: null,
    fallback: true,
    derivation: 'legacy_default_list',
  }));
}

export function hasPersonalizedStreams(streams) {
  return asArray(streams).some((item) => item && !item.fallback && hasMeaningfulValue(item.name));
}

/**
 * True when items were produced by alias/regex/text-scan deterministic inference.
 */
export function isDeterministicStreamOrOutflowDerivation(items) {
  const list = asArray(items);
  if (!list.length) return false;
  return list.every(
    (item) =>
      item?.fallback === true ||
      item?.derivation ||
      item?.role === 'legacy_real_estate_default' ||
      item?.role === 'detected_from_intelligence_text' ||
      item?.role === 'stated_or_inferred_lead_source' ||
      item?.role === 'one_move_success_indicator_alias' ||
      item?.role === 'modeled_shift_outcome_alias' ||
      item?.role === 'conversion_system_signal'
  );
}
