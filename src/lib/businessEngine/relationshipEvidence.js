/**
 * Relationship-structure evidence shared by BA generation and the read-time
 * Business Engine compatibility projection.
 *
 * This is deterministic evidence classification, not generated intelligence.
 * Explicit negation always wins over keyword presence.
 */

function normalizedText(...values) {
  return values
    .map((value) => String(value || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ');
}

const SEGMENTATION_NEGATION_PATTERNS = [
  /\b(?:do not|don['’]t|does not|doesn['’]t|did not|didn['’]t)\s+have\s+(?:an?\s+|any\s+|official\s+)?(?:contact\s+|database\s+|relationship\s+)?(?:segmentation|segments?|segmented|tiers?|categor(?:y|ies|ized|ization)|tags?)\b/i,
  /\b(?:have not|haven['’]t|without|no)\s+(?:an?\s+|any\s+|official\s+)?(?:contact\s+|database\s+|relationship\s+)?(?:segmentation|segments?|segmented|tiers?|categor(?:y|ies|ized|ization)|tags?)\b/i,
  /\bnot\s+(?:yet\s+|currently\s+)?(?:segmented|categorized|tiered|tagged)\b/i,
  /\bsegmentation\s+(?:is\s+)?(?:not|missing|absent|none)\b/i,
];

const SEGMENTATION_POSITIVE_PATTERNS = [
  /\b(?:a\+?|b|c|d)\s*(?:\/|,|and|-)\s*(?:a\+?|b|c|d)\b.{0,80}\b(?:contacts?|database|relationships?)\b/i,
  /\b(?:contacts?|database|relationships?)\b.{0,80}\b(?:a\+?|b|c|d)\s*(?:\/|,|and|-)\s*(?:a\+?|b|c|d)\b/i,
  /\bsegment(?:ed|ation|ing)?\s+(?:by|into|exists|is set up|set up|in place)\b/i,
  /\b(?:tiered|categorized|tagged)\s+(?:contacts?|database|relationships?)\b/i,
];

const VENDOR_NEGATION_PATTERNS = [
  /\b(?:do not|don['’]t|does not|doesn['’]t)\s+have\s+(?:an?\s+|any\s+|official\s+)?(?:preferred\s+)?vendor\s+(?:database|list|system)\b/i,
  /\b(?:have not|haven['’]t|without|no)\s+(?:an?\s+|any\s+|official\s+)?(?:preferred\s+)?vendor\s+(?:database|list|system)\b/i,
];

const CRM_NEGATION_PATTERNS = [
  /\b(?:do not|don['’]t|does not|doesn['’]t)\s+have\s+(?:(?:an?|any|active|official|working)\s+)*crm\b/i,
  /\b(?:have not|haven['’]t|without|no)\s+(?:(?:an?|any|active|official|working)\s+)*crm\b/i,
  /\bnot\s+(?:currently\s+)?using\s+(?:(?:an?|any|active|official|working)\s+)*crm\b/i,
];

export const TRUE_RELATIONSHIP_PROVENANCE = Object.freeze({
  EXPLICIT: 'EXPLICIT',
  ESTIMATED: 'ESTIMATED',
  UNKNOWN: 'UNKNOWN',
});

export const TRUE_RELATIONSHIP_SOURCE_CLASSES = Object.freeze({
  EXPLICIT_NUMERIC: 'EXPLICIT_NUMERIC',
  EXPLICIT_RANGE: 'EXPLICIT_RANGE',
  EXPLICIT_APPROXIMATE: 'EXPLICIT_APPROXIMATE',
  ESTIMATED_INDIVIDUALIZED: 'ESTIMATED_INDIVIDUALIZED',
  UNKNOWN: 'UNKNOWN',
  TOTAL_CONTACTS_ONLY: 'TOTAL_CONTACTS_ONLY',
  FUTURE_TARGET: 'FUTURE_TARGET',
  LEGACY_POSITIONAL_INFERENCE: 'LEGACY_POSITIONAL_INFERENCE',
  INVALID: 'INVALID',
  AMBIGUOUS: 'AMBIGUOUS',
});

const CURRENT_TEMPORAL_STATE = 'CURRENT';
const COUNT_TOKEN = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)`;
const APPROX_TOKEN = String.raw`(?<approx>about|approximately|approx\.?|roughly|around|maybe|probably)\s+`;
const RELATIONSHIP_LABEL = String.raw`(?:true|real)\s+relationships?`;
const COUNT_END = String.raw`(?!(?:[\d,%]|\.\d))`;
const SINGLE_COUNT_END = String.raw`(?!(?:[\d,%]|\.\d|\s*[-–]\s*${COUNT_TOKEN}))`;
const TARGET_CONTEXT_RE =
  /\b(?:want(?:\s+to)?|target(?:\s+is|\s+of)?|goal(?:\s+is)?|need(?:\s+to)?|build(?:ing)?\s+(?:to|toward)|grow(?:ing)?\s+(?:to|toward)|aim(?:ing)?\s+(?:for|to)|desired|future|within\s+\d+\s*(?:months?|years?))\b[^.!?;\n]{0,36}$/i;
const TARGET_SIGNAL_RE =
  /\b(?:want|target|goal|need|build\s+to|grow\s+to|grow\s+toward|aim|desired|future|within\s+\d+\s*(?:months?|years?))\b/i;
const UNKNOWN_SIGNAL_RE =
  /\b(?:i\s+(?:do not|don['’]t)\s+know|not\s+sure|unknown|not\s+measured|never\s+measured|no\s+(?:reliable|accurate|current)\s+(?:true\s+)?relationship\s+count)\b/i;
const TOTAL_CONTACT_SIGNAL_RE =
  /\b(?:total\s+contacts?|contacts?|database|sphere|soi|contact\s+list)\b/i;
const RELATIONSHIP_SIGNAL_RE =
  /\b(?:true|real)\s+relationships?\b|\bpeople\s+who\s+(?:would|will|do)\s+refer\s+me\b/i;

function formatCount(value) {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

function countFromToken(raw) {
  const source = String(raw || '');
  if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)$/.test(source)) return null;
  const value = Number(source.replace(/,/g, ''));
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function makeTrueRelationshipEvidence({
  value = null,
  low = null,
  high = null,
  provenance = TRUE_RELATIONSHIP_PROVENANCE.UNKNOWN,
  sourceClass = TRUE_RELATIONSHIP_SOURCE_CLASSES.UNKNOWN,
  sourceField = null,
  approximate = false,
  confidence = null,
  estimateMethod = null,
  basis = null,
  displayValue = null,
} = {}) {
  const range =
    Number.isSafeInteger(low) &&
    low >= 0 &&
    Number.isSafeInteger(high) &&
    high >= 0;
  const resolvedLow = range ? Math.min(low, high) : null;
  const resolvedHigh = range ? Math.max(low, high) : null;
  const resolvedValue = range
    ? (resolvedLow + resolvedHigh) / 2
    : Number.isSafeInteger(value) && value >= 0
      ? value
      : null;
  const available =
    provenance !== TRUE_RELATIONSHIP_PROVENANCE.UNKNOWN &&
    Number.isFinite(resolvedValue);
  const resolvedDisplay = available
    ? displayValue ||
      (range
        ? `${formatCount(resolvedLow)}–${formatCount(resolvedHigh)}`
        : `${approximate || provenance === TRUE_RELATIONSHIP_PROVENANCE.ESTIMATED ? '~' : ''}${formatCount(resolvedValue)}`)
    : null;

  return {
    value: available ? resolvedValue : null,
    range_min: available && range ? resolvedLow : null,
    range_max: available && range ? resolvedHigh : null,
    low: available && range ? resolvedLow : null,
    high: available && range ? resolvedHigh : null,
    range: Boolean(available && range),
    display_value: resolvedDisplay,
    display: resolvedDisplay,
    provenance,
    source_class: sourceClass,
    confidence:
      typeof confidence === 'number' && Number.isFinite(confidence)
        ? confidence
        : available
          ? provenance === TRUE_RELATIONSHIP_PROVENANCE.ESTIMATED
            ? 0.7
            : approximate || range
              ? 0.95
              : 1
          : null,
    source_field: sourceField,
    temporal_state: CURRENT_TEMPORAL_STATE,
    approximate: Boolean(available && approximate),
    customer_reported:
      available && provenance === TRUE_RELATIONSHIP_PROVENANCE.EXPLICIT,
    estimated:
      available && provenance === TRUE_RELATIONSHIP_PROVENANCE.ESTIMATED,
    estimate_method:
      provenance === TRUE_RELATIONSHIP_PROVENANCE.ESTIMATED
        ? estimateMethod || null
        : null,
    basis: basis || null,
    source:
      provenance === TRUE_RELATIONSHIP_PROVENANCE.EXPLICIT
        ? 'User provided'
        : provenance === TRUE_RELATIONSHIP_PROVENANCE.ESTIMATED
          ? 'Model estimate'
          : 'Insufficient data',
  };
}

export function makeUnknownTrueRelationshipEvidence({
  sourceClass = TRUE_RELATIONSHIP_SOURCE_CLASSES.UNKNOWN,
  sourceField = null,
} = {}) {
  return makeTrueRelationshipEvidence({ sourceClass, sourceField });
}

function matchIsTarget(source, match) {
  const before = source.slice(Math.max(0, match.index - 64), match.index);
  return TARGET_CONTEXT_RE.test(before);
}

function explicitCandidates(source) {
  const patterns = [
    {
      kind: 'range',
      regex: new RegExp(
        String.raw`\b(?<approx>about|approximately|roughly|around|maybe|probably)?\s*between\s+(?<low>${COUNT_TOKEN})\s+and\s+(?<high>${COUNT_TOKEN})\s+${RELATIONSHIP_LABEL}\b`,
        'gi'
      ),
    },
    {
      kind: 'range',
      regex: new RegExp(
        String.raw`(?:^|[^\d.,$])(?:${APPROX_TOKEN})?(?<low>${COUNT_TOKEN})\s*[-–]\s*(?<high>${COUNT_TOKEN})${COUNT_END}\s+${RELATIONSHIP_LABEL}\b`,
        'gi'
      ),
    },
    {
      kind: 'range',
      regex: new RegExp(
        String.raw`\b(?:current\s+)?${RELATIONSHIP_LABEL}\s*(?:(?:are|is|:|=|count(?:\s+is|\s*:)?|number(?:\s+is|\s*:)?))?\s*(?:${APPROX_TOKEN})?(?<low>${COUNT_TOKEN})\s*[-–]\s*(?<high>${COUNT_TOKEN})${COUNT_END}`,
        'gi'
      ),
    },
    {
      kind: 'numeric',
      regex: new RegExp(
        String.raw`(?:^|[^\d.,$])(?:${APPROX_TOKEN})?(?<value>${COUNT_TOKEN})${SINGLE_COUNT_END}\s+(?:are\s+)?(?:my\s+)?${RELATIONSHIP_LABEL}\b`,
        'gi'
      ),
    },
    {
      kind: 'numeric',
      regex: new RegExp(
        String.raw`\b(?:current\s+)?${RELATIONSHIP_LABEL}\s*(?:are|is|:|=|count(?:\s+is|\s*:)?|number(?:\s+is|\s*:)?)\s*(?:${APPROX_TOKEN})?(?<value>${COUNT_TOKEN})${SINGLE_COUNT_END}`,
        'gi'
      ),
    },
    {
      kind: 'numeric',
      regex: new RegExp(
        String.raw`(?:^|[^\d.,$])(?:${APPROX_TOKEN})?(?<value>${COUNT_TOKEN})${SINGLE_COUNT_END}\s+(?:people\s+)?who\s+(?:would|will|do)\s+refer\s+me\b`,
        'gi'
      ),
    },
  ];
  const candidates = [];

  for (const { kind, regex } of patterns) {
    for (const match of source.matchAll(regex)) {
      if (matchIsTarget(source, match)) continue;
      const low = countFromToken(match.groups?.low);
      const high = countFromToken(match.groups?.high);
      const value = countFromToken(match.groups?.value);
      if (kind === 'range' && (!Number.isFinite(low) || !Number.isFinite(high))) {
        continue;
      }
      if (kind === 'numeric' && !Number.isFinite(value)) continue;
      candidates.push({
        kind,
        value,
        low,
        high,
        approximate: Boolean(match.groups?.approx),
        index: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  const rangeCandidates = candidates.filter((candidate) => candidate.kind === 'range');
  return candidates
    .filter(
      (candidate) =>
        candidate.kind === 'range' ||
        !rangeCandidates.some(
          (range) => candidate.index < range.end && candidate.end > range.index
        )
    )
    .sort((a, b) => a.index - b.index)
    .filter(
      (candidate, index, list) =>
        index ===
        list.findIndex(
          (item) =>
            item.kind === candidate.kind &&
            item.value === candidate.value &&
            item.low === candidate.low &&
            item.high === candidate.high
        )
    );
}

export function parseCurrentTrueRelationshipAnswer(
  text,
  { sourceField = 'answers.q3' } = {}
) {
  const source = String(text || '').replace(/\s+/g, ' ').trim();
  if (!source) {
    return makeUnknownTrueRelationshipEvidence({ sourceField });
  }

  if (
    /^(?:none|none\s+yet|zero|zero\s+yet|zero\s+(?:true|real)\s+relationships?|no\s+(?:true|real)\s+relationships?(?:\s+yet)?)\.?$/i.test(
      source
    )
  ) {
    return makeTrueRelationshipEvidence({
      value: 0,
      provenance: TRUE_RELATIONSHIP_PROVENANCE.EXPLICIT,
      sourceClass: TRUE_RELATIONSHIP_SOURCE_CLASSES.EXPLICIT_NUMERIC,
      sourceField,
    });
  }

  const candidates = explicitCandidates(source);
  const distinct = candidates.filter(
    (candidate, index, list) =>
      index ===
      list.findIndex(
        (item) =>
          item.kind === candidate.kind &&
          item.value === candidate.value &&
          item.low === candidate.low &&
          item.high === candidate.high
      )
  );

  if (distinct.length === 1) {
    const candidate = distinct[0];
    if (candidate.kind === 'range') {
      return makeTrueRelationshipEvidence({
        low: candidate.low,
        high: candidate.high,
        provenance: TRUE_RELATIONSHIP_PROVENANCE.EXPLICIT,
        sourceClass: TRUE_RELATIONSHIP_SOURCE_CLASSES.EXPLICIT_RANGE,
        sourceField,
        approximate: candidate.approximate,
      });
    }
    return makeTrueRelationshipEvidence({
      value: candidate.value,
      provenance: TRUE_RELATIONSHIP_PROVENANCE.EXPLICIT,
      sourceClass: candidate.approximate
        ? TRUE_RELATIONSHIP_SOURCE_CLASSES.EXPLICIT_APPROXIMATE
        : TRUE_RELATIONSHIP_SOURCE_CLASSES.EXPLICIT_NUMERIC,
      sourceField,
      approximate: candidate.approximate,
    });
  }

  if (distinct.length > 1) {
    return makeUnknownTrueRelationshipEvidence({
      sourceClass: TRUE_RELATIONSHIP_SOURCE_CLASSES.AMBIGUOUS,
      sourceField,
    });
  }

  if (UNKNOWN_SIGNAL_RE.test(source)) {
    return makeUnknownTrueRelationshipEvidence({ sourceField });
  }
  if (TARGET_SIGNAL_RE.test(source)) {
    return makeUnknownTrueRelationshipEvidence({
      sourceClass: TRUE_RELATIONSHIP_SOURCE_CLASSES.FUTURE_TARGET,
      sourceField,
    });
  }
  if (TOTAL_CONTACT_SIGNAL_RE.test(source) && !RELATIONSHIP_SIGNAL_RE.test(source)) {
    return makeUnknownTrueRelationshipEvidence({
      sourceClass: TRUE_RELATIONSHIP_SOURCE_CLASSES.TOTAL_CONTACTS_ONLY,
      sourceField,
    });
  }
  if (
    RELATIONSHIP_SIGNAL_RE.test(source) &&
    (/%|\$\s*\d|\d+\.\d+|(?:\d,\d{1,2},\d)|\b(?:one|two|three|four|five|six|seven|eight|nine)\b/i.test(
      source
    ) ||
      /\d/.test(source))
  ) {
    return makeUnknownTrueRelationshipEvidence({
      sourceClass: TRUE_RELATIONSHIP_SOURCE_CLASSES.INVALID,
      sourceField,
    });
  }
  if (/\d/.test(source)) {
    return makeUnknownTrueRelationshipEvidence({
      sourceClass: TRUE_RELATIONSHIP_SOURCE_CLASSES.AMBIGUOUS,
      sourceField,
    });
  }
  return makeUnknownTrueRelationshipEvidence({ sourceField });
}

function hasFutureSource(metric) {
  const source = [
    metric?.source_field,
    metric?.source,
    metric?.basis,
    metric?.estimate_method,
    metric?.temporal_state,
  ]
    .map((value) => String(value || ''))
    .join(' ');
  return (
    (metric?.temporal_state &&
      String(metric.temporal_state).toUpperCase() !== CURRENT_TEMPORAL_STATE) ||
    /\b(?:target|goal|future|one_move|five_futures|success_indicator)\b/i.test(
      source
    )
  );
}

export function normalizeCurrentTrueRelationshipMetric(
  metric,
  { sourceField = 'options.metrics.currentTrueRelationships' } = {}
) {
  if (metric === null || metric === undefined || metric === '') {
    return makeUnknownTrueRelationshipEvidence({ sourceField });
  }
  if (typeof metric === 'string') {
    return parseCurrentTrueRelationshipAnswer(metric, { sourceField });
  }
  if (Number.isSafeInteger(metric) && metric >= 0) {
    return makeTrueRelationshipEvidence({
      value: metric,
      provenance: TRUE_RELATIONSHIP_PROVENANCE.EXPLICIT,
      sourceClass: TRUE_RELATIONSHIP_SOURCE_CLASSES.EXPLICIT_NUMERIC,
      sourceField,
    });
  }
  if (!metric || typeof metric !== 'object' || hasFutureSource(metric)) {
    return makeUnknownTrueRelationshipEvidence({
      sourceClass: hasFutureSource(metric)
        ? TRUE_RELATIONSHIP_SOURCE_CLASSES.FUTURE_TARGET
        : TRUE_RELATIONSHIP_SOURCE_CLASSES.INVALID,
      sourceField,
    });
  }

  if (
    metric.provenance === TRUE_RELATIONSHIP_PROVENANCE.UNKNOWN ||
    metric.provenance_state === TRUE_RELATIONSHIP_PROVENANCE.UNKNOWN
  ) {
    return makeUnknownTrueRelationshipEvidence({
      sourceClass:
        metric.source_class || TRUE_RELATIONSHIP_SOURCE_CLASSES.UNKNOWN,
      sourceField: metric.source_field || sourceField,
    });
  }

  const low = Number.isSafeInteger(metric.range_min)
    ? metric.range_min
    : metric.low;
  const high = Number.isSafeInteger(metric.range_max)
    ? metric.range_max
    : metric.high;
  const value = Number.isSafeInteger(metric.value) ? metric.value : null;
  const estimated =
    metric.provenance === TRUE_RELATIONSHIP_PROVENANCE.ESTIMATED ||
    metric.provenance_state === TRUE_RELATIONSHIP_PROVENANCE.ESTIMATED ||
    metric.estimated === true;
  const estimateMethod = metric.estimate_method || metric.basis || null;

  if (estimated && !estimateMethod) {
    return makeUnknownTrueRelationshipEvidence({
      sourceClass: TRUE_RELATIONSHIP_SOURCE_CLASSES.INVALID,
      sourceField: metric.source_field || sourceField,
    });
  }

  const hasExplicitEvidence =
    metric.provenance === TRUE_RELATIONSHIP_PROVENANCE.EXPLICIT ||
    metric.provenance_state === TRUE_RELATIONSHIP_PROVENANCE.EXPLICIT ||
    metric.customer_reported === true ||
    /^user provided$/i.test(String(metric.source || '')) ||
    /(?:^|\.)answers\.q[35]$|relationship_reality\.evidence\.q[35]$/i.test(
      String(metric.source_field || '')
    );
  if (!estimated && !hasExplicitEvidence) {
    return makeUnknownTrueRelationshipEvidence({
      sourceClass:
        /^extracted$/i.test(String(metric.source || ''))
          ? TRUE_RELATIONSHIP_SOURCE_CLASSES.LEGACY_POSITIONAL_INFERENCE
          : TRUE_RELATIONSHIP_SOURCE_CLASSES.INVALID,
      sourceField: metric.source_field || sourceField,
    });
  }

  if (
    !Number.isSafeInteger(value) &&
    !(Number.isSafeInteger(low) && Number.isSafeInteger(high))
  ) {
    return makeUnknownTrueRelationshipEvidence({
      sourceClass: TRUE_RELATIONSHIP_SOURCE_CLASSES.INVALID,
      sourceField: metric.source_field || sourceField,
    });
  }

  const approximate =
    metric.approximate === true ||
    (!estimated && /^~|^approx/i.test(String(metric.display_value || metric.display || '')));
  return makeTrueRelationshipEvidence({
    value,
    low,
    high,
    provenance: estimated
      ? TRUE_RELATIONSHIP_PROVENANCE.ESTIMATED
      : TRUE_RELATIONSHIP_PROVENANCE.EXPLICIT,
    sourceClass:
      metric.source_class ||
      (estimated
        ? TRUE_RELATIONSHIP_SOURCE_CLASSES.ESTIMATED_INDIVIDUALIZED
        : Number.isSafeInteger(low) && Number.isSafeInteger(high)
          ? TRUE_RELATIONSHIP_SOURCE_CLASSES.EXPLICIT_RANGE
          : approximate
            ? TRUE_RELATIONSHIP_SOURCE_CLASSES.EXPLICIT_APPROXIMATE
            : TRUE_RELATIONSHIP_SOURCE_CLASSES.EXPLICIT_NUMERIC),
    sourceField: metric.source_field || sourceField,
    approximate,
    confidence: metric.confidence,
    estimateMethod,
    basis: metric.basis,
    displayValue: metric.display_value || metric.display || null,
  });
}

export function resolveCurrentTrueRelationshipEvidence({
  answers = {},
  draft = {},
  metricOption = null,
} = {}) {
  const evidence = draft?.relationship_reality?.evidence || {};
  const textCandidates = [
    ['answers.q3', answers.q3],
    ['relationship_reality.evidence.q3', evidence.q3],
    ['answers.q5', answers.q5],
    ['relationship_reality.evidence.q5', evidence.q5],
  ];
  const parsed = textCandidates
    .filter(([, text]) => String(text || '').trim())
    .map(([sourceField, text]) =>
      parseCurrentTrueRelationshipAnswer(text, { sourceField })
    );
  const explicit = parsed.find(
    (item) => item.provenance === TRUE_RELATIONSHIP_PROVENANCE.EXPLICIT
  );
  if (explicit) return explicit;

  const normalizedMetric = normalizeCurrentTrueRelationshipMetric(metricOption);
  if (
    normalizedMetric.provenance === TRUE_RELATIONSHIP_PROVENANCE.EXPLICIT ||
    normalizedMetric.provenance === TRUE_RELATIONSHIP_PROVENANCE.ESTIMATED
  ) {
    return normalizedMetric;
  }

  return (
    parsed.find(
      (item) =>
        item.source_class === TRUE_RELATIONSHIP_SOURCE_CLASSES.FUTURE_TARGET
    ) ||
    parsed.find(
      (item) =>
        item.source_class === TRUE_RELATIONSHIP_SOURCE_CLASSES.TOTAL_CONTACTS_ONLY
    ) ||
    parsed.find(
      (item) =>
        item.source_class === TRUE_RELATIONSHIP_SOURCE_CLASSES.AMBIGUOUS
    ) ||
    parsed.find(
      (item) => item.source_class === TRUE_RELATIONSHIP_SOURCE_CLASSES.INVALID
    ) ||
    normalizedMetric
  );
}

export function trueRelationshipMetricFromEvidence(evidence) {
  if (
    !evidence ||
    evidence.provenance === TRUE_RELATIONSHIP_PROVENANCE.UNKNOWN ||
    !Number.isFinite(evidence.value)
  ) {
    return null;
  }
  return { ...evidence };
}

export function deriveRelationshipStructureEvidence({ q3 = '', q5 = '' } = {}) {
  const source = normalizedText(q3, q5);
  const segmentationNegated = SEGMENTATION_NEGATION_PATTERNS.some((pattern) => pattern.test(source));
  const segmentationPresent =
    !segmentationNegated &&
    SEGMENTATION_POSITIVE_PATTERNS.some((pattern) => pattern.test(source));
  const trueRelationshipsPresent = /\btrue relationships?\b/i.test(source);
  const databasePresent = /\b(?:database|crm|contacts?|sphere|soi|relationships?)\b/i.test(source);
  const vendorNegated = VENDOR_NEGATION_PATTERNS.some((pattern) => pattern.test(source));
  const vendorPresent = !vendorNegated && /\bvendor(?:s|\s+(?:database|list|system))?\b/i.test(source);
  const crmNegated = CRM_NEGATION_PATTERNS.some((pattern) => pattern.test(source));
  const crmPresent =
    !crmNegated &&
    /\b(?:crm|follow[\s-]*up boss|intelliagent)\b/i.test(source);

  const segmentationStatus = segmentationNegated
    ? 'absent'
    : segmentationPresent
      ? 'present'
      : 'unknown';

  let lakeHealth = 'unclear';
  if (trueRelationshipsPresent && segmentationStatus === 'present') {
    lakeHealth = 'organized_lake_signal';
  } else if (trueRelationshipsPresent && segmentationStatus === 'absent') {
    lakeHealth = 'relationship_asset_present_unorganized';
  } else if (trueRelationshipsPresent) {
    lakeHealth = 'relationship_asset_present';
  } else if (databasePresent && segmentationStatus === 'present') {
    lakeHealth = 'organized_database_signal';
  } else if (databasePresent) {
    lakeHealth = 'database_asset_present_structure_unconfirmed';
  }

  return {
    segmentation_status: segmentationStatus,
    segmentation_present: segmentationPresent,
    segmentation_negated: segmentationNegated,
    true_relationship_count_mentioned: trueRelationshipsPresent,
    database_mentioned: databasePresent,
    vendor_database_present: vendorPresent,
    vendor_database_negated: vendorNegated,
    crm_status: crmNegated ? 'absent' : crmPresent ? 'present' : 'unknown',
    crm_present: crmPresent,
    crm_negated: crmNegated,
    lake_health: lakeHealth,
    evidence_source: 'answers.q3|answers.q5',
  };
}

export default deriveRelationshipStructureEvidence;
