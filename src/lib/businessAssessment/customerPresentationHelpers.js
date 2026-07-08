/**
 * Presentation-layer helpers for customer BA rendering.
 * Does not mutate stored assessment source data.
 * No OpenAI, no regeneration, no profile-specific branching.
 */

/** Readable labels for internal field keys shown in Technical Source or cleaned in customer tabs. */
export const CUSTOMER_FIELD_LABELS = {
  average_sales_price: 'Average sales price',
  gci: 'GCI',
  expenses: 'Expenses',
  profit: 'Profit',
  marketing_spend: 'Marketing spend',
  p_and_l: 'Profit and loss details',
  team_overhead: 'Team overhead',
  net_income: 'Net income',
  financial_average_sales_price: 'Average sales price',
  financial_gci: 'GCI',
  financial_expenses: 'Expenses',
  financial_profit: 'Profit',
  financial_marketing_spend: 'Marketing spend',
  financial_p_and_l: 'Profit and loss details',
  financial_team_overhead: 'Team overhead',
  financial_net_income: 'Net income',
  complete_financial_detail: 'Complete financial detail',
  stable_solo_producer: 'Stable solo producer',
  organized_lake_signal:
    'Relationship strength exists, but it is not yet organized into a repeatable system',
  moderate_to_strong: 'Moderate to strong',
  systems_constraint: 'Systems bottleneck',
  lead_generation_constraint: 'Lead generation bottleneck',
  relationship_quality_constraint: 'Relationship quality bottleneck',
  lead_conversion_constraint: 'Lead conversion bottleneck',
  accountability_constraint: 'Accountability bottleneck',
  financial_constraint: 'Financial clarity bottleneck',
  team_constraint: 'Team / leadership bottleneck',
  behavioral_profile_ranked_dimensions: 'Behavioral profile dimensions',
  database_numbers: 'Database size and relationship counts',
  contradictions_detected: 'Contradictions between stated goals and current operating pattern',
  q1_missing_or_vague: 'Lead volume detail is thin or unclear',
  q2_specific: 'Business model / production answers provided',
  q3_specific: 'Database and relationship answers provided',
  q4_present_but_thin: 'Lead generation behavior described, but still thin',
  q5_specific: 'Systems and operating history answers provided',
  q6_present_but_thin: 'Willingness / resistance pattern described, but still thin',
  q7_missing_or_vague: 'Team / help structure is thin or unclear',
  q8_specific: 'Process and follow-up answers provided',
  q9_specific: 'Production and financial history answers provided',
  q10_missing_or_vague: 'Income / expense clarity is thin or unclear',
  q12_present_but_thin: 'Accountability pattern described, but still thin',
  signal: 'Relational awareness',
  flex: 'Adaptability',
  horizon: 'Perspective',
  fidelity: 'Precision',
  velocity: 'Tempo',
  leverage: 'Leverage',
  vector: 'Command',
  framework: 'Structure',
  Signal: 'Relational awareness',
  Adaptability: 'Adaptability',
  Perspective: 'Perspective',
  Precision: 'Precision',
  Tempo: 'Tempo',
  Leverage: 'Leverage',
  Command: 'Command',
  Structure: 'Structure',
};

const PHRASE_REPLACEMENTS = [
  [/foremost constraint/gi, 'main bottleneck'],
  [/primary constraint/gi, 'main bottleneck'],
  [/mitigate this constraint/gi, 'address this bottleneck'],
  [/address this constraint/gi, 'address this bottleneck'],
  [/robust operational framework/gi, 'simple operating system'],
  [/fostering an environment conducive to/gi, 'helping create'],
  [/conducive to/gi, 'that supports'],
  [/precipitate confusion/gi, 'create confusion'],
  [/substantial discrepancy/gi, 'gap'],
  [/considerable discrepancy/gi, 'gap'],
  [/systematic enhancements/gi, 'stronger systems'],
  [/operational capacity/gi, 'current capacity'],
  [/behavioral fusion outcomes/gi, 'behavior and business pattern'],
  [/stress response mechanics/gi, 'pressure pattern'],
  [/inefficiencies/gi, 'friction or wasted effort'],
  [/relational intricacies/gi, 'relationship dynamics'],
  [/operational flaw/gi, 'operating weak spot'],
  [/manifest as inconsistencies/gi, 'show up as inconsistency'],
  [/liabilities if robust systems are absent/gi, 'problems when simple systems are missing'],
  [/unpredictability of operation style/gi, 'inconsistent operating style'],
  [/systematic process documentation/gi, 'simple written processes'],
  [/absence of structured systems/gi, 'lack of simple systems'],
  [/absence of structured processes/gi, 'lack of simple processes'],
  [/well-documented systems/gi, 'clear written systems'],
  [/entrepreneurial mode/gi, 'do-it-yourself mode'],
  [/entrepreneurial framework/gi, 'do-it-yourself setup'],
  [/system-oriented purposeful mode/gi, 'more system-supported way of working'],
  [/owner dependency/gi, 'everything still depending on the owner'],
  [/document_core_system/gi, 'document the core system'],
  [/transfer_judgment/gi, 'make decisions repeatable'],
  [/install_operating_cadence/gi, 'install a weekly operating rhythm'],
  [/choose_generation_lane/gi, 'choose one lead generation lane'],
  [/install_generation_rhythm/gi, 'install a lead generation rhythm'],
  [/inspect_activity/gi, 'inspect activity weekly'],
  // Dimension / engine labels that leak as technical trait names
  [/\bSignal\b/g, 'Relational awareness'],
  [/\bFlex\b/g, 'Adaptability'],
  [/\bHorizon\b/g, 'Perspective'],
  [/\bFidelity\b/g, 'Precision'],
  [/\bVelocity\b/g, 'Tempo'],
  [/\bVector\b/g, 'Command'],
  [/\bFramework\b/g, 'Structure'],
  [/\bLeverage\b/g, 'Leverage'],
  [/\binspected behavior\b/gi, 'visible, accountable behavior'],
  [/\bstable solo operation\b/gi, 'stable solo producer setup'],
  [/\bRelational Awareness\/Adaptability\b/gi, 'Relational awareness and adaptability'],
];

const CUSTOMER_EVIDENCE_BLOCK =
  /(?:###?\s*)?Evidence Considered:[\s\S]*$/i;

const Q_REF_PATTERN = /\b(?:q\d{1,2})(?:\s*\/\s*q\d{1,2})*(?:\s+examined)?\b/gi;
const SNAKE_TOKEN = /\b[a-z]+(?:_[a-z0-9]+)+\b/g;
const SIGNAL_PREFIX = /^signal:\s*/i;

/**
 * Map an internal key or token to a customer/technical readable label.
 */
export function customerDisplayLabel(value, { technical = false } = {}) {
  if (value === null || value === undefined || value === '') return '';
  const raw = String(value).trim();
  if (!raw) return '';

  if (CUSTOMER_FIELD_LABELS[raw]) return CUSTOMER_FIELD_LABELS[raw];

  const withoutFinancial = raw.replace(/^financial_/, '');
  if (CUSTOMER_FIELD_LABELS[withoutFinancial]) return CUSTOMER_FIELD_LABELS[withoutFinancial];

  const withoutSignal = raw.replace(SIGNAL_PREFIX, '');
  if (CUSTOMER_FIELD_LABELS[withoutSignal]) return CUSTOMER_FIELD_LABELS[withoutSignal];

  // q-number refs: hide in customer context; readable in technical
  if (/^q\d{1,2}(_|$)/i.test(raw) || /^q\d{1,2}$/i.test(raw)) {
    if (!technical) return '';
    return CUSTOMER_FIELD_LABELS[raw] || `Source answer ${raw.toUpperCase()}`;
  }

  if (/_present_but_thin$/i.test(raw) || /_missing_or_vague$/i.test(raw) || /_specific$/i.test(raw)) {
    if (CUSTOMER_FIELD_LABELS[raw]) return CUSTOMER_FIELD_LABELS[raw];
    if (!technical) return '';
  }

  // Humanize remaining snake_case
  if (/^[a-z0-9]+(?:_[a-z0-9]+)+$/i.test(raw)) {
    return raw
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\bP And L\b/i, 'Profit and loss details')
      .replace(/\bGci\b/i, 'GCI');
  }

  return raw;
}

/**
 * Strip evidence blocks, q-number refs, and consultant fog for customer tabs.
 */
export function simplifyCustomerCopy(text) {
  if (text === null || text === undefined) return '';
  let value = typeof text === 'string' ? text : String(text);
  if (!value.trim()) return '';

  value = value.replace(CUSTOMER_EVIDENCE_BLOCK, '');
  value = value.replace(Q_REF_PATTERN, '');
  value = value.replace(/\(\s*,\s*\)/g, '');
  value = value.replace(/\(\s*\)/g, '');
  value = value.replace(/\s{2,}/g, ' ');

  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    value = value.replace(pattern, replacement);
  }

  // Convert known internal tokens embedded in prose
  value = value.replace(SNAKE_TOKEN, (token) => {
    const mapped = customerDisplayLabel(token, { technical: false });
    return mapped || token.replace(/_/g, ' ');
  });

  // Soften remaining formal openers without inventing facts
  value = value
    .replace(/^The main bottleneck impacting\b/i, 'The main bottleneck for')
    .replace(/\bwill significantly help address\b/gi, 'helps address')
    .replace(/\benabling smoother daily operations\b/gi, 'so day-to-day work runs more smoothly')
    .replace(/\bsubstantially expanding\b/gi, 'growing')
    .replace(/\bsignificantly over the next few years\b/gi, 'over the next few years');

  value = value.replace(/\n{3,}/g, '\n\n').trim();
  // Clean dangling punctuation left by q-ref removal
  value = value
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return value;
}

/**
 * Apply customerDisplayLabel to list items; drop empty / q-only items for customer.
 */
export function mapLabelsForCustomer(items = [], { technical = false } = {}) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (item === null || item === undefined || item === '') return '';
      if (typeof item === 'object') {
        const key = item.key || item.id || item.field || item.label || item.name;
        const label = item.label || item.title || item.summary || item.description;
        if (key && CUSTOMER_FIELD_LABELS[key]) return CUSTOMER_FIELD_LABELS[key];
        if (label) return technical ? String(label) : simplifyCustomerCopy(String(label));
        if (key) return customerDisplayLabel(key, { technical });
        return '';
      }
      const raw = String(item).trim();
      if (!raw) return '';
      // Prefer full-token label map when the whole value is an internal key
      if (CUSTOMER_FIELD_LABELS[raw] || /^[a-z0-9]+(?:_[a-z0-9]+)+$/i.test(raw)) {
        return customerDisplayLabel(raw, { technical });
      }
      if (technical) {
        return raw.replace(SNAKE_TOKEN, (token) => customerDisplayLabel(token, { technical: true }) || token);
      }
      return simplifyCustomerCopy(raw);
    })
    .map((item) => (item || '').trim())
    .filter(Boolean);
}

export function hasRenderableContent(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.some((item) => hasRenderableContent(item));
  if (typeof value === 'object') {
    return Object.values(value).some((item) => hasRenderableContent(item));
  }
  return String(value).trim().length > 0;
}

/**
 * Dimension score -> short plain strength word (no raw technical score required in customer UI).
 */
export function dimensionStrengthBand(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return '';
  if (n >= 0.65) return 'strong';
  if (n >= 0.35) return 'solid';
  if (n >= 0.1) return 'moderate';
  if (n >= 0) return 'low';
  return 'needs support';
}

export function formatDimensionForCustomer(dim = {}) {
  const label =
    customerDisplayLabel(dim.label || dim.dimension || dim.key || '', { technical: false }) ||
    dim.label ||
    dim.dimension ||
    'Trait';
  const band = dimensionStrengthBand(dim.score);
  if (!band) return label;
  return `${label} (${band})`;
}

/**
 * Systems maturity number -> customer sentence. Does not invent extra metrics.
 */
export function systemsMaturityCustomerLine(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return '';
  if (n < 1) {
    return 'Systems and accountability are mostly informal right now. Too much still depends on memory and personal follow-through.';
  }
  if (n < 2) {
    return 'Some systems language is present, but overall maturity is still early. Follow-through is not yet a repeatable operating rhythm.';
  }
  if (n < 3) {
    return 'Some repeatable process exists, but systems and accountability are still uneven across the business.';
  }
  return 'Core systems are forming, but accountability and consistency still need to stay visible week to week.';
}

/**
 * Map relationship / lake health internal tokens into customer language.
 */
export function relationshipAssetCustomerLine(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (CUSTOMER_FIELD_LABELS[raw]) return CUSTOMER_FIELD_LABELS[raw];
  if (/organized_lake|lake_signal/i.test(raw)) {
    return CUSTOMER_FIELD_LABELS.organized_lake_signal;
  }
  if (/stable_solo/i.test(raw)) return CUSTOMER_FIELD_LABELS.stable_solo_producer;
  if (/moderate_to_strong/i.test(raw)) {
    return 'The relationship base looks moderate to strong, but it still needs a clearer system around it.';
  }
  return simplifyCustomerCopy(raw);
}

/**
 * Build short customer-safe unavailable note when a section is important but source is thin.
 */
export function unavailableCustomerNote(topic) {
  const t = topic || 'This area';
  return `${t} is not clear enough from the current answers to state confidently. That gap itself is part of the operating picture.`;
}
