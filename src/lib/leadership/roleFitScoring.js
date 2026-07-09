/**
 * Deterministic Leadership Role Fit scoring helpers.
 *
 * Transparent, conservative first-pass scoring from BOS operating signals.
 * No fake precision. No model calls. Display-time only — never mutates profiles.
 */

import { normalizeOperatingScore, getScoreFromProfile } from '../reports/scoreLabels.js';

const BOS_DIMENSIONS = [
  'vector',
  'velocity',
  'signal',
  'fidelity',
  'leverage',
  'flex',
  'framework',
  'horizon',
];

/**
 * Map a raw BOS dimension value to 0–1 for role-fit scoring.
 * Prefer rescored display scores (already ~0–1). For legacy signed vector
 * scores (~-3..3), use a linear map — NOT abs() — so low/negative structure
 * does not falsely read as high strength.
 */
export function normalizeRoleFitSignal(raw, { preferSignedLinear = false } = {}) {
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;

  // Legacy signed vector-ish scale (~-3..3). Prefer linear map when requested
  // so values like 2 or 3 are NOT treated as "2%" / "3%".
  if (preferSignedLinear) {
    const mapped = (value + 3) / 6;
    return Math.round(Math.min(1, Math.max(0, mapped)) * 1000) / 1000;
  }

  // Already unit-ish
  if (value >= 0 && value <= 1) return Math.round(value * 1000) / 1000;

  // Negative without explicit linear flag still maps as signed strength
  if (value < 0) {
    const mapped = (value + 3) / 6;
    return Math.round(Math.min(1, Math.max(0, mapped)) * 1000) / 1000;
  }

  // Small integers above 1 (typical BOS vector magnitude) → signed linear
  if (value > 1 && value <= 5) {
    const mapped = (value + 3) / 6;
    return Math.round(Math.min(1, Math.max(0, mapped)) * 1000) / 1000;
  }

  // Percent-like (e.g. 72)
  if (value > 5 && value <= 100) return Math.round((value / 100) * 1000) / 1000;

  return normalizeOperatingScore(value);
}

/**
 * Extract BOS signal map (0–1) for role-fit dimensions.
 * Prefers rescored ranked display scores when present.
 */
function vectorScoresLookSigned(vectorScores = {}) {
  const values = Object.values(vectorScores)
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n));
  if (!values.length) return false;
  // Any value outside unit interval (or negative) ⇒ signed legacy scale
  return values.some((n) => n < 0 || n > 1);
}

function pickRankedCandidate(entry) {
  if (!entry || typeof entry !== 'object') return null;
  // Prefer explicitly unit-ish rescored fields first
  if (entry.display_score !== undefined && entry.display_score !== null) return { value: entry.display_score, kind: 'display' };
  if (entry.gpt_rescored_score !== undefined && entry.gpt_rescored_score !== null) return { value: entry.gpt_rescored_score, kind: 'rescored' };
  if (entry.support_adjusted_score !== undefined && entry.support_adjusted_score !== null) return { value: entry.support_adjusted_score, kind: 'rescored' };
  if (entry.rescored_score !== undefined && entry.rescored_score !== null) return { value: entry.rescored_score, kind: 'rescored' };
  if (entry.score !== undefined && entry.score !== null) return { value: entry.score, kind: 'raw' };
  return null;
}

export function extractBosSignalMap(profilePayload = {}) {
  const canonical = unwrapCanonical(profilePayload);
  const data = canonical?.canonical_profile_json || canonical || {};
  const ranked =
    data?.rescoring_gpt?.ranked_dimensions ||
    data?.rescoring_v1?.ranked_dimensions ||
    data?.ranked_dimensions ||
    canonical?.ranked_dimensions ||
    [];
  const vectorScores = data?.vector_scores || {};
  const signedScale = vectorScoresLookSigned(vectorScores);

  const signals = {};
  let availableCount = 0;

  for (const dim of BOS_DIMENSIONS) {
    let resolved = null;

    // 1) Ranked / rescored entries
    const rankedEntry = (ranked || []).find(
      (entry) => String(entry?.dimension || entry?.name || '').toLowerCase() === dim,
    );
    if (rankedEntry) {
      const picked = pickRankedCandidate(rankedEntry);
      if (picked) {
        const n = Number(picked.value);
        const looksUnit =
          Number.isFinite(n) && n >= 0 && n <= 1 && (picked.kind === 'display' || picked.kind === 'rescored');
        if (looksUnit) {
          resolved = normalizeRoleFitSignal(n);
        } else if (signedScale || (Number.isFinite(n) && (n < 0 || (n > 1 && n <= 5)))) {
          resolved = normalizeRoleFitSignal(n, { preferSignedLinear: true });
        } else {
          resolved = normalizeRoleFitSignal(picked.value);
        }
      }
    }

    // 2) Direct vector_scores (prefer when scale is signed legacy)
    if (resolved === null || (signedScale && vectorScores[dim] !== undefined && vectorScores[dim] !== null)) {
      const vs = vectorScores[dim];
      if (vs !== undefined && vs !== null) {
        resolved = normalizeRoleFitSignal(vs, {
          preferSignedLinear: signedScale || Number(vs) < 0 || Math.abs(Number(vs)) > 1,
        });
      }
    }

    // 3) Production helper last (title-case dimension)
    if (resolved === null) {
      const title = dim.charAt(0).toUpperCase() + dim.slice(1);
      const fromHelper = getScoreFromProfile(title, data, ranked);
      if (fromHelper !== null && fromHelper !== undefined) {
        resolved = fromHelper;
      }
    }

    signals[dim] = resolved;
    if (resolved !== null && resolved !== undefined) availableCount += 1;
  }

  return {
    signals,
    availableCount,
    totalExpected: BOS_DIMENSIONS.length,
    ranked,
    data,
    canonical,
    signed_scale_detected: signedScale,
  };
}

export function unwrapCanonical(payload = {}) {
  if (!payload || typeof payload !== 'object') return {};
  const dossier =
    payload.canonical_dossier ||
    payload.profile ||
    payload.canonical ||
    payload;
  return (
    dossier?.canonical_profile_json ||
    dossier?.canonical_dossier?.canonical_profile_json ||
    dossier ||
    {}
  );
}

/**
 * Average available BOS signals for a dimension, skip nulls.
 * Returns null if no signals available (caller should handle conservatively).
 */
export function averageSignals(signalMap, keys = []) {
  const values = keys
    .map((k) => signalMap[k])
    .filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Convert 0–1 signal average into a role-fit percentage (0–100).
 * Mild conservative floor/ceiling to avoid fake 0/100 precision.
 */
export function signalAverageToPercent(avg) {
  if (avg === null || avg === undefined || !Number.isFinite(avg)) return null;
  const clamped = Math.min(1, Math.max(0, avg));
  // Map to 18–96 band for honesty; pure extremes are rare with multi-signal averages
  const percent = 18 + clamped * 78;
  return Math.round(percent * 10) / 10;
}

export function classifyDimensionFit(percent) {
  if (percent === null || percent === undefined) {
    return { id: 'unavailable', label: 'Insufficient Signal' };
  }
  if (percent >= 90) return { id: 'elite', label: 'Elite' };
  if (percent >= 80) return { id: 'strong', label: 'Strong' };
  if (percent >= 70) return { id: 'viable', label: 'Viable' };
  if (percent >= 60) return { id: 'moderate', label: 'Moderate' };
  if (percent >= 50) return { id: 'developing', label: 'Developing' };
  if (percent >= 35) return { id: 'stretch', label: 'Stretch' };
  return { id: 'risk', label: 'Risk' };
}

/** V1B business-consequence bands (fallback if role model omits verdict_bands). */
export const DEFAULT_SCORE_BANDS_V1B = [
  { id: 'elite_ready_now', label: 'Elite / Ready-Now Fit', min: 90, max: 100 },
  { id: 'strong_fit', label: 'Strong Fit', min: 80, max: 89.999 },
  { id: 'viable_fit', label: 'Viable Fit', min: 70, max: 79.999 },
  { id: 'moderate_developmental', label: 'Moderate / Developmental Fit', min: 60, max: 69.999 },
  { id: 'high_risk_poor', label: 'High-Risk / Poor Fit', min: 0, max: 59.999 },
];

export function classifyOverallVerdict(percent, verdictBands = []) {
  if (percent === null || percent === undefined) {
    return {
      id: 'unavailable',
      label: 'Insufficient Data',
      summary: 'Not enough BOS signal data to score role fit.',
    };
  }
  const bands = Array.isArray(verdictBands) && verdictBands.length
    ? verdictBands
    : DEFAULT_SCORE_BANDS_V1B;
  for (const band of bands) {
    if (percent >= band.min && percent <= band.max) {
      return {
        id: band.id,
        label: band.label,
        summary: defaultVerdictSummary(band.id, percent),
      };
    }
  }
  // Fallback bands if model omitted them
  if (percent >= 90) {
    return {
      id: 'elite_ready_now',
      label: 'Elite / Ready-Now Fit',
      summary: defaultVerdictSummary('elite_ready_now', percent),
    };
  }
  if (percent >= 80) {
    return {
      id: 'strong_fit',
      label: 'Strong Fit',
      summary: defaultVerdictSummary('strong_fit', percent),
    };
  }
  if (percent >= 70) {
    return {
      id: 'viable_fit',
      label: 'Viable Fit',
      summary: defaultVerdictSummary('viable_fit', percent),
    };
  }
  if (percent >= 60) {
    return {
      id: 'moderate_developmental',
      label: 'Moderate / Developmental Fit',
      summary: defaultVerdictSummary('moderate_developmental', percent),
    };
  }
  return {
    id: 'high_risk_poor',
    label: 'High-Risk / Poor Fit',
    summary: defaultVerdictSummary('high_risk_poor', percent),
  };
}

function defaultVerdictSummary(verdictId, percent) {
  const p = Math.round(percent);
  switch (verdictId) {
    case 'elite_ready_now':
      return `Overall DD role fit is elite / ready-now (${p}%). Growth and operating signals support high-confidence DD seating — still structure compliance, ops, and support around the person.`;
    case 'strong_fit':
      return `Overall DD role fit is strong (${p}%). Profile aligns with growth leadership and DD economic levers — validate compliance, operations, and support structure before full load.`;
    case 'viable_fit':
      return `Overall DD role fit is viable (${p}%). Core levers can work with the right seat support, coaching focus, and Market Center conditions.`;
    case 'moderate_developmental':
    case 'developmental_fit':
      return `Overall DD role fit is moderate / developmental (${p}%). Profile can contribute in parts of the DD seat but needs deliberate skill building and structured support before full load.`;
    case 'conditional_fit':
      return `Overall DD role fit is viable-to-conditional (${p}%). Core levers can work with the right seat support, coaching focus, and Market Center conditions.`;
    case 'high_risk_poor':
    case 'risk_fit':
      return `Overall DD role fit is high-risk / poor fit (${p}%). Wrong-seat risk is material unless environment and proven performance history strongly compensate.`;
    default:
      return `Overall DD role fit score: ${p}%. Growth-weighted estimate — review secondary risk dimensions before role decisions.`;
  }
}

/**
 * Deterministic V1D evidence parser for optional Known Performance Evidence.
 * General keyword/phrase matching only — no profile-id or person-name branches.
 *
 * Evidence can help, hurt, or qualify the result (not a one-way boost machine).
 * Classifies: positive | negative | mixed | neutral
 *
 * Positive recruiting/growth:
 * - number 1 / number one / #1 recruiter
 * - top 10% / top ten percent / top recruiter
 * - award-winning / award winning recruiter
 * - recruiter at Fathom / Fathom recruiter
 * - added/recruited agents, agent growth, market center growth, growth above target
 *
 * Negative recruiting/growth + compliance/ops/support — see pattern lists below.
 */
export const STRONG_RECRUITING_EVIDENCE_PATTERNS = [
  // Rank / elite recruiter forms
  /#\s*1\s+recruiter/i,
  /\bnumber\s*1\s+recruiter\b/i,
  /\bnumber\s+one\s+recruiter\b/i,
  /\btop\s+10\s*%?\s*recruiter\b/i,
  /\btop\s+ten\s+percent\s+recruiter\b/i,
  /\btop\s+recruiter\b/i,
  /\btop\s+recruiting\b/i,
  // Awards
  /\baward[\s-]+winning\s+recruiter\b/i,
  /\baward\s+winning\s+recruiter\b/i,
  /\brecruiting\s+award\b/i,
  // Fathom / company recruiter context (general — not person-specific)
  /\brecruiter\s+at\s+fathom\b/i,
  /\bfathom\s+recruiter\b/i,
  // Agent adds / growth outcomes
  /\brecruited\s+agents?\b/i,
  /\brecruited\b/i,
  /\badded\s+\d+\+?\s+agents?\b/i,
  /\badded\s+agents?\b/i,
  /\bagent\s+growth\b/i,
  /\bmarket\s+center\s+growth\b/i,
  /\bgrew\s+market\s+center\b/i,
  /\bnet\s+agent\s+growth\b/i,
  /\bgrowth\s+above\s+target\b/i,
];

/** Positive compliance / ops (used for classification only; modest support-risk relief). */
export const POSITIVE_COMPLIANCE_OPS_PATTERNS = [
  /\bstrong\s+compliance\s+record\b/i,
  /\bno\s+material\s+audit\s+issues\b/i,
  /\bclean\s+compliance\b/i,
  /\bno\s+compliance\s+issues\b/i,
];

/**
 * Negative recruiting / growth performance phrases.
 * Generalized — no person names or profile IDs.
 */
export const NEGATIVE_RECRUITING_EVIDENCE_PATTERNS = [
  /\bbelow\s+standard\s+in\s+recruiting\b/i,
  /\bbelow\s+target\s+recruiting\b/i,
  /\bbelow\s+standard\s+recruiting\b/i,
  /\bunder\s+target\s+recruiting\b/i,
  /\bmissed\s+recruiting\s+targets?\b/i,
  /\bmissed\s+growth\s+targets?\b/i,
  /\bunderperformed\s+recruiting\b/i,
  /\bunderperformed\s+growth\b/i,
  /\bweak\s+recruiter\b/i,
  /\bnot\s+a\s+(very\s+)?good\s+recruiter\b/i,
  /\bisn['’]?t\s+a\s+(very\s+)?good\s+recruiter\b/i,
  /\bnot\s+a\s+strong\s+recruiter\b/i,
  /\bpoor\s+recruiter\b/i,
  /\bpoor\s+recruiting\s+conversion\b/i,
  /\blow\s+recruiting\s+conversion\b/i,
  /\brecruiting\s+on\s+(my\s+)?watch\s+list\b/i,
  /\bwatch\s+list\s+for\s+recruiting\b/i,
  /\bon\s+(my\s+)?watch\s+list\b/i,
  /\bagent\s+count\s+declined\b/i,
  /\bdeclining\s+agent\s+count\b/i,
  /\blow\s+agent\s+growth\b/i,
  /\bnegative\s+agent\s+growth\b/i,
  /\bfailed\s+to\s+recruit\b/i,
  /\bfailed\s+recruiting\b/i,
  /\bno\s+recruiting\s+momentum\b/i,
  /\b\d+\s*%\s+below\s+(goal|target|quota|plan|standard)\b/i,
  /\bbelow\s+(goal|quota|plan)\b/i,
  /\bbelow\s+target\b/i,
  /\bthree\s+years\s+below\s+target\b/i,
  /\bpast\s+(three|3)\s+years\b/i,
  /\brecruiting\s+by\s+\d+\s*%\s+of\s+goal\b/i,
  /\bin\s+recruiting\s+by\s+\d+\s*%\b/i,
];

/**
 * Sustained / multi-year underperformance intensifiers (recruiting severity).
 */
export const SUSTAINED_UNDERPERFORMANCE_PATTERNS = [
  /\bon\s+(my\s+)?watch\s+list\b/i,
  /\bpast\s+(three|3)\s+years\b/i,
  /\bfor\s+(three|3)\s+years\b/i,
  /\bthree\s+years\s+below\s+target\b/i,
  /\bmissed\s+recruiting\s+targets?\s+for\s+the\s+past\b/i,
];

/**
 * Negative compliance / operations / support / training / partner phrases.
 * Each entry: { pattern, dimensions: string[] }
 */
export const NEGATIVE_COMPLIANCE_OPS_SUPPORT_PATTERNS = [
  { pattern: /\bcompliance\s+(issues|problems)\b/i, dimensions: ['Compliance / Operations'] },
  { pattern: /\baudit\s+(issues|problems)\b/i, dimensions: ['Compliance / Operations'] },
  { pattern: /\bdocument\s+review\s+delays\b/i, dimensions: ['Compliance / Operations'] },
  { pattern: /\bslow\s+document\s+review\b/i, dimensions: ['Compliance / Operations'] },
  { pattern: /\blate\s+document\s+review\b/i, dimensions: ['Compliance / Operations'] },
  { pattern: /\brecurring\s+compliance\b/i, dimensions: ['Compliance / Operations'] },
  { pattern: /\bcompliance\s+document\s+review\b/i, dimensions: ['Compliance / Operations'] },
  { pattern: /\bunresolved\s+agent\s+complaints\b/i, dimensions: ['Agent Support', 'Compliance / Operations'] },
  { pattern: /\bagent\s+complaints\b/i, dimensions: ['Agent Support'] },
  { pattern: /\bpoor\s+response\s+times?\b/i, dimensions: ['Compliance / Operations', 'Agent Support'] },
  { pattern: /\bslow\s+response\b/i, dimensions: ['Compliance / Operations'] },
  { pattern: /\bpoor\s+follow[\s-]?through\b/i, dimensions: ['Compliance / Operations'] },
  { pattern: /\bmissed\s+deadlines\b/i, dimensions: ['Compliance / Operations'] },
  { pattern: /\boperational\s+issues\b/i, dimensions: ['Compliance / Operations'] },
  { pattern: /\bpoor\s+training\s+attendance\b/i, dimensions: ['Training / Communication'] },
  { pattern: /\bweak\s+agent\s+support\b/i, dimensions: ['Agent Support'] },
  { pattern: /\blow\s+agent\s+support\b/i, dimensions: ['Agent Support'] },
  { pattern: /\bpartner\s+advocacy\s+issues\b/i, dimensions: ['Partner Advocacy'] },
];

/**
 * Approved UI example lines for Known Performance Evidence (placeholders / help).
 * Neutral — no brand-specific competitor names. Includes positive + negative examples.
 */
export const PERFORMANCE_EVIDENCE_UI_EXAMPLES = [
  'Was a top 10% recruiter at Fathom.',
  'Was an award-winning recruiter at another company in the last three years.',
  'Added 25+ agents in the last 12 months.',
  'Led market center growth above target.',
  'This DD is below standard in recruiting by 10% of goal.',
  'Missed recruiting target for the past three years.',
  'Has recurring compliance document review delays.',
  'Maintained strong compliance record with no material audit issues.',
  'Led recurring agent training or onboarding programs.',
];

const EMPTY_EVIDENCE_PARSE = {
  raw: '',
  has_input: false,
  summary: 'No external performance evidence entered.',
  classification: 'neutral',
  strong_recruiting_evidence: false,
  strong_negative_recruiting_evidence: false,
  strong_negative_compliance_ops_evidence: false,
  positive_recruiting: false,
  negative_recruiting: false,
  negative_compliance_ops: false,
  negative_support: false,
  sustained_underperformance: false,
  detectedPositiveSignals: [],
  detectedNegativeSignals: [],
  matched_phrases: [],
  matched_positive_phrases: [],
  matched_negative_phrases: [],
  affectedDimensions: [],
  evidenceImpactSummary: 'No external performance evidence entered.',
  scoreAdjustmentSummary: 'No score adjustments.',
  strength: 'none',
};

function pushUniquePhrase(list, phrase) {
  const cleaned = String(phrase || '').trim();
  if (!cleaned) return;
  if (!list.some((p) => p.toLowerCase() === cleaned.toLowerCase())) {
    list.push(cleaned);
  }
}

function collectPatternMatches(text, patterns) {
  const matched = [];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m && m[0]) pushUniquePhrase(matched, m[0]);
  }
  return matched;
}

/**
 * Avoid counting bare positive growth phrases when they appear inside a clear negative frame
 * (e.g. "low agent growth" should not also fire "agent growth" as positive).
 */
function filterPositiveMatchesAgainstNegatives(positiveMatches, negativeMatches, rawText) {
  const lower = String(rawText || '').toLowerCase();
  const negBlob = negativeMatches.map((p) => p.toLowerCase()).join(' | ');
  return positiveMatches.filter((pos) => {
    const p = pos.toLowerCase();
    // Strip positives that are substrings of a negative match
    if (negBlob.includes(p) && negBlob !== p) return false;
    // Common false positives when negative framing is present
    if (/\b(low|negative|declining|no)\s+agent\s+growth\b/i.test(lower) && /agent\s+growth/i.test(p)) {
      return false;
    }
    if (/\bbelow\s+target\s+recruiting\b/i.test(lower) && /^recruit/i.test(p)) return false;
    return true;
  });
}

function buildEvidenceImpactCopy({
  classification,
  positiveRecruiting,
  negativeRecruiting,
  negativeComplianceOps,
  negativeSupport,
  positivePhrases,
  negativePhrases,
  sustained,
}) {
  if (classification === 'neutral') {
    return {
      summary:
        'Performance evidence entered; no recognized positive or negative role-fit keywords detected for automatic score adjustment.',
      impact:
        'Evidence Impact: Neutral — text was entered but no automatic dimension adjustments applied.',
      scoreAdj: 'No automatic score adjustments from recognized evidence keywords.',
    };
  }

  if (classification === 'positive' && positiveRecruiting) {
    return {
      summary: `Strong positive recruiting/growth evidence detected (${positivePhrases.length} signal${
        positivePhrases.length === 1 ? '' : 's'
      }: ${positivePhrases.join(', ')}).`,
      impact:
        'Evidence Impact: Positive — known performance evidence strengthens recruiting/growth fit.',
      scoreAdj:
        'Growth / Recruiting Fit raised; Evidence-Adjusted and Overall DD Role Fit may rise. Behavioral Fit unchanged. Risk dimensions remain visible.',
    };
  }

  if (classification === 'negative' && negativeRecruiting && !negativeComplianceOps && !negativeSupport) {
    return {
      summary: `Negative recruiting/growth evidence detected (${negativePhrases.length} signal${
        negativePhrases.length === 1 ? '' : 's'
      }: ${negativePhrases.join(', ')})${sustained ? ' with sustained underperformance markers' : ''}.`,
      impact:
        'Known performance evidence indicates recruiting/growth underperformance. Because recruiting/growth is the DD role’s primary economic performance lever, this materially reduces role-fit confidence even if some BOS behavioral signals are positive.',
      scoreAdj: sustained
        ? 'Growth Fit decreased (sustained underperformance). Evidence-Adjusted and Overall DD Role Fit decreased. Support requirement strengthened. Behavioral Fit unchanged.'
        : 'Growth Fit decreased materially. Evidence-Adjusted and Overall DD Role Fit decreased. Behavioral Fit unchanged. Compliance/ops unchanged unless compliance terms are present.',
    };
  }

  if (classification === 'negative' && (negativeComplianceOps || negativeSupport) && !negativeRecruiting) {
    return {
      summary: `Negative operational/compliance/support evidence detected (${negativePhrases.length} signal${
        negativePhrases.length === 1 ? '' : 's'
      }: ${negativePhrases.join(', ')}).`,
      impact:
        'Known performance evidence indicates operational or compliance risk. This does not automatically erase growth fit, but it raises the support requirement and risk profile for the DD seat.',
      scoreAdj:
        'Compliance / Ops Risk raised; Support Required may increase; Evidence-Adjusted Fit may decline modestly. Growth Fit not erased by ops evidence alone. Behavioral Fit unchanged.',
    };
  }

  if (classification === 'mixed') {
    const parts = [];
    if (positiveRecruiting) parts.push('growth evidence strengthens fit');
    if (negativeRecruiting) parts.push('recruiting underperformance lowers growth confidence');
    if (negativeComplianceOps || negativeSupport) {
      parts.push('operational/compliance evidence raises support and risk requirements');
    }
    return {
      summary: `Mixed evidence detected — positive: ${
        positivePhrases.length ? positivePhrases.join(', ') : 'none'
      }; negative: ${negativePhrases.length ? negativePhrases.join(', ') : 'none'}.`,
      impact: `Known evidence is mixed: ${parts.join(', while ')}.`,
      scoreAdj:
        'Positive and negative impacts applied by dimension. Growth and risk/support may move in opposite directions. Behavioral Fit unchanged.',
    };
  }

  // Fallback negative (combined recruiting + ops)
  if (classification === 'negative') {
    return {
      summary: `Negative performance evidence detected (${negativePhrases.join(', ')}).`,
      impact:
        'Known performance evidence indicates underperformance and/or elevated operational risk for the DD seat.',
      scoreAdj:
        'Relevant dimensions adjusted downward or risk raised. Evidence-Adjusted and Overall may decrease. Behavioral Fit unchanged.',
    };
  }

  return {
    summary: 'Performance evidence entered.',
    impact: 'Evidence Impact: Neutral.',
    scoreAdj: 'No automatic score adjustments.',
  };
}

/**
 * @param {string} evidenceText
 * @returns {object} structured evidence parse with classification + signals
 */
export function parsePerformanceEvidence(evidenceText = '') {
  const raw = typeof evidenceText === 'string' ? evidenceText.trim() : '';
  if (!raw) {
    return { ...EMPTY_EVIDENCE_PARSE };
  }

  const positiveRecruitingRaw = collectPatternMatches(raw, STRONG_RECRUITING_EVIDENCE_PATTERNS);
  const positiveCompliance = collectPatternMatches(raw, POSITIVE_COMPLIANCE_OPS_PATTERNS);
  const negativeRecruiting = collectPatternMatches(raw, NEGATIVE_RECRUITING_EVIDENCE_PATTERNS);
  const sustainedMatches = collectPatternMatches(raw, SUSTAINED_UNDERPERFORMANCE_PATTERNS);

  const negativeOpsSupportPhrases = [];
  const affectedDimSet = new Set();
  let hitsComplianceOps = false;
  let hitsSupport = false;
  let hitsTraining = false;
  let hitsPartner = false;

  for (const entry of NEGATIVE_COMPLIANCE_OPS_SUPPORT_PATTERNS) {
    const m = raw.match(entry.pattern);
    if (m && m[0]) {
      pushUniquePhrase(negativeOpsSupportPhrases, m[0]);
      for (const dim of entry.dimensions || []) {
        affectedDimSet.add(dim);
        if (dim === 'Compliance / Operations') hitsComplianceOps = true;
        if (dim === 'Agent Support') hitsSupport = true;
        if (dim === 'Training / Communication') hitsTraining = true;
        if (dim === 'Partner Advocacy') hitsPartner = true;
      }
    }
  }

  const positiveRecruiting = filterPositiveMatchesAgainstNegatives(
    positiveRecruitingRaw,
    negativeRecruiting,
    raw,
  );

  // Sustained markers only count as recruiting severity when recruiting-negative is present
  // OR the text clearly is a recruiting watchlist case (isn’t a good recruiter + watch list).
  const recruitingNegativeContext =
    negativeRecruiting.length > 0 ||
    /\b(recruiter|recruiting|growth|agent\s+count|agent\s+growth)\b/i.test(raw);
  const sustained =
    sustainedMatches.length > 0 &&
    (negativeRecruiting.length > 0 || recruitingNegativeContext);

  // If only "past three years" without negative recruiting, don't treat as negative alone
  // unless paired with recruiting underperformance phrases already in negativeRecruiting.
  const effectiveNegativeRecruiting = negativeRecruiting.filter((p) => {
    if (/^past\s+(three|3)\s+years$/i.test(p) && negativeRecruiting.length === 1) {
      // Alone is weak — still keep if other recruiting negatives exist (filtered out here means alone)
      return false;
    }
    return true;
  });

  // Re-collect if we dropped standalone year phrase: keep original when other neg recruiting exists
  const negRecruitFinal =
    effectiveNegativeRecruiting.length > 0
      ? effectiveNegativeRecruiting
      : negativeRecruiting.length > 1
        ? negativeRecruiting
        : /\b(weak|poor|not a|isn['’]?t a|missed|below|failed|declin|underperform|watch list)/i.test(
              raw,
            ) && /recruit|growth|agent count|agent growth/i.test(raw)
          ? negativeRecruiting
          : negativeRecruiting.filter((p) => !/^past\s+(three|3)\s+years$/i.test(p));

  const hasPositiveRecruiting = positiveRecruiting.length > 0;
  const hasNegativeRecruiting = negRecruitFinal.length > 0;
  const hasNegativeOps = hitsComplianceOps || hitsSupport || hitsTraining || hitsPartner;
  const hasPositiveOnlyCompliance = positiveCompliance.length > 0 && !hasPositiveRecruiting;
  const hasAnyPositive = hasPositiveRecruiting || positiveCompliance.length > 0;
  const hasAnyNegative = hasNegativeRecruiting || hasNegativeOps;

  let classification = 'neutral';
  if (hasAnyPositive && hasAnyNegative) classification = 'mixed';
  else if (hasAnyPositive) classification = 'positive';
  else if (hasAnyNegative) classification = 'negative';

  if (hasPositiveRecruiting) affectedDimSet.add('Recruiting / Growth');
  if (hasNegativeRecruiting) affectedDimSet.add('Recruiting / Growth');

  const detectedPositiveSignals = [...positiveRecruiting, ...positiveCompliance];
  const detectedNegativeSignals = [...negRecruitFinal, ...negativeOpsSupportPhrases];
  // Include sustained markers in negative signals for audit when recruiting-negative
  if (sustained && hasNegativeRecruiting) {
    for (const s of sustainedMatches) pushUniquePhrase(detectedNegativeSignals, s);
  }

  const copy = buildEvidenceImpactCopy({
    classification,
    positiveRecruiting: hasPositiveRecruiting,
    negativeRecruiting: hasNegativeRecruiting,
    negativeComplianceOps: hitsComplianceOps,
    negativeSupport: hitsSupport || hitsTraining || hitsPartner,
    positivePhrases: detectedPositiveSignals,
    negativePhrases: detectedNegativeSignals,
    sustained: sustained && hasNegativeRecruiting,
  });

  return {
    raw,
    has_input: true,
    summary: copy.summary,
    classification,
    // Positive recruiting component present (boost path may co-exist with mixed negatives)
    strong_recruiting_evidence: hasPositiveRecruiting,
    strong_negative_recruiting_evidence: hasNegativeRecruiting,
    strong_negative_compliance_ops_evidence: hitsComplianceOps,
    positive_recruiting: hasPositiveRecruiting,
    negative_recruiting: hasNegativeRecruiting,
    negative_compliance_ops: hitsComplianceOps,
    negative_support: hitsSupport,
    negative_training: hitsTraining,
    negative_partner: hitsPartner,
    positive_compliance: positiveCompliance.length > 0,
    sustained_underperformance: Boolean(sustained && hasNegativeRecruiting),
    detectedPositiveSignals,
    detectedNegativeSignals,
    matched_phrases: [...detectedPositiveSignals, ...detectedNegativeSignals],
    matched_positive_phrases: detectedPositiveSignals,
    matched_negative_phrases: detectedNegativeSignals,
    affectedDimensions: Array.from(affectedDimSet),
    evidenceImpactSummary: copy.impact,
    scoreAdjustmentSummary: copy.scoreAdj,
    strength:
      classification === 'positive'
        ? 'strong'
        : classification === 'negative'
          ? 'negative'
          : classification === 'mixed'
            ? 'mixed'
            : hasPositiveOnlyCompliance
              ? 'mild'
              : 'none',
  };
}

function applyDimScore(dim, nextScore, noteExtra = {}) {
  const behavioral =
    typeof dim.behavioral_score_percent === 'number' && Number.isFinite(dim.behavioral_score_percent)
      ? dim.behavioral_score_percent
      : typeof dim.score_percent === 'number' && Number.isFinite(dim.score_percent)
        ? dim.score_percent
        : null;
  const score =
    typeof nextScore === 'number' && Number.isFinite(nextScore)
      ? Math.round(Math.min(96, Math.max(18, nextScore)) * 10) / 10
      : dim.score_percent;
  const fit = classifyDimensionFit(score);
  const delta =
    behavioral === null || score === null || score === undefined
      ? 0
      : Math.round((score - behavioral) * 10) / 10;

  return {
    ...dim,
    score_percent: score,
    fit_category: fit.label,
    fit_category_id: fit.id,
    behavioral_score_percent: behavioral,
    evidence_boost_applied: delta > 0.05,
    evidence_penalty_applied: delta < -0.05,
    evidence_boost_points: delta > 0 ? delta : 0,
    evidence_penalty_points: delta < 0 ? Math.abs(delta) : 0,
    evidence_delta_points: delta,
    ...noteExtra,
    note:
      noteExtra.note ||
      dim.note ||
      `${fit.label} on ${dim.label} (${score == null ? '—' : `${Math.round(score)}%`}).`,
  };
}

/**
 * Apply positive and/or negative evidence to dimension results (immutable-style).
 * Behavioral dimensions are left to the caller; this mutates only the evidence-adjusted copy.
 */
export function applyEvidenceToDimensions(dimensionResults = [], evidenceParse = null) {
  const dims = (dimensionResults || []).map((d) => ({
    ...d,
    behavioral_score_percent:
      typeof d.score_percent === 'number' && Number.isFinite(d.score_percent)
        ? d.score_percent
        : null,
    evidence_boost_applied: false,
    evidence_penalty_applied: false,
    evidence_boost_points: 0,
    evidence_penalty_points: 0,
    evidence_delta_points: 0,
  }));

  if (!evidenceParse?.has_input) {
    return {
      dimensions: dims,
      growth_boost_applied: false,
      growth_boost_points: 0,
      growth_penalty_applied: false,
      growth_penalty_points: 0,
      compliance_penalty_applied: false,
      support_penalty_applied: false,
      adjustments: [],
    };
  }

  const adjustments = [];
  const growthIdx = dims.findIndex((d) => d.id === 'recruiting_growth_drive');
  const complianceIdx = dims.findIndex((d) => d.id === 'compliance_discipline');
  const opsIdx = dims.findIndex((d) => d.id === 'operational_responsiveness');
  const supportIdx = dims.findIndex((d) => d.id === 'agent_support_service');
  const trainingIdx = dims.findIndex((d) => d.id === 'training_communication');
  const partnerIdx = dims.findIndex((d) => d.id === 'partner_ecosystem_advocacy');

  let growth_boost_applied = false;
  let growth_boost_points = 0;
  let growth_penalty_applied = false;
  let growth_penalty_points = 0;
  let compliance_penalty_applied = false;
  let support_penalty_applied = false;

  const ra =
    evidenceParse.recommended_adjustments && typeof evidenceParse.recommended_adjustments === 'object'
      ? evidenceParse.recommended_adjustments
      : null;
  const growthAdj = String(ra?.growth_fit || '').toLowerCase();

  // Prefer explicit GPT adjustment categories when present; otherwise binary flags.
  let posGrowth = Boolean(evidenceParse.positive_recruiting || evidenceParse.strong_recruiting_evidence);
  let negGrowth = Boolean(
    evidenceParse.negative_recruiting || evidenceParse.strong_negative_recruiting_evidence,
  );
  if (growthAdj === 'increase_materially' || growthAdj === 'increase_modestly') {
    posGrowth = true;
    if (growthAdj.startsWith('increase') && !growthAdj.includes('decrease')) {
      // keep neg only if classification mixed with explicit negative recruiting flag
      if (!evidenceParse.negative_recruiting && evidenceParse.classification !== 'mixed') {
        negGrowth = false;
      }
    }
  } else if (growthAdj === 'decrease_materially' || growthAdj === 'decrease_modestly') {
    negGrowth = true;
    if (evidenceParse.classification !== 'mixed' && !evidenceParse.positive_recruiting) {
      posGrowth = false;
    }
  } else if (growthAdj === 'no_change' && ra) {
    // Explicit no_change from interpreter — skip growth adjustment unless mixed flags force it
    if (!evidenceParse.positive_recruiting && !evidenceParse.negative_recruiting) {
      posGrowth = false;
      negGrowth = false;
    }
  }

  const sustained = Boolean(evidenceParse.sustained_underperformance);
  const modestPositive = growthAdj === 'increase_modestly';
  const modestNegative = growthAdj === 'decrease_modestly';

  // --- Growth / Recruiting ---
  if (growthIdx >= 0 && (posGrowth || negGrowth)) {
    const growth = dims[growthIdx];
    const behavioralGrowth =
      typeof growth.behavioral_score_percent === 'number'
        ? growth.behavioral_score_percent
        : typeof growth.score_percent === 'number'
          ? growth.score_percent
          : null;

    if (posGrowth && !negGrowth) {
      // Elite / modest positive recruiting — bounded deterministic floors
      const ELITE_GROWTH_FLOOR = modestPositive ? 82 : 93;
      const boosted =
        behavioralGrowth === null
          ? ELITE_GROWTH_FLOOR
          : Math.min(96, Math.max(behavioralGrowth, ELITE_GROWTH_FLOOR));
      growth_boost_points =
        behavioralGrowth === null
          ? ELITE_GROWTH_FLOOR
          : Math.round((boosted - behavioralGrowth) * 10) / 10;
      growth_boost_applied = true;
      dims[growthIdx] = applyDimScore(growth, boosted, {
        note: modestPositive
          ? `Growth Fit raised to ${Math.round(boosted)}% — evidence supports a modest recruiting/growth lift. Behavioral baseline was ${
              behavioralGrowth === null ? 'unavailable' : `${Math.round(behavioralGrowth)}%`
            }.`
          : `Elite Growth Fit (${Math.round(boosted)}%) — known recruiting evidence materially strengthens this lever. Behavioral baseline was ${
              behavioralGrowth === null ? 'unavailable' : `${Math.round(behavioralGrowth)}%`
            }. Secondary compliance/ops/support risks remain reviewable.`,
      });
      adjustments.push({
        dimension: 'Recruiting / Growth',
        direction: 'up',
        points: growth_boost_points,
        intensity: modestPositive ? 'modest' : 'material',
      });
    } else if (negGrowth && !posGrowth) {
      // Material / modest / sustained negative recruiting
      const CAP = modestNegative ? (sustained ? 48 : 54) : sustained ? 34 : 42;
      const DROP = modestNegative ? (sustained ? 12 : 8) : sustained ? 22 : 16;
      let reduced;
      if (behavioralGrowth === null) {
        reduced = CAP;
      } else {
        reduced = Math.min(behavioralGrowth, CAP, behavioralGrowth - DROP);
        reduced = Math.max(22, reduced);
      }
      growth_penalty_points =
        behavioralGrowth === null
          ? Math.round((100 - reduced) * 0.1) // nominal
          : Math.round((behavioralGrowth - reduced) * 10) / 10;
      growth_penalty_applied = true;
      dims[growthIdx] = applyDimScore(growth, reduced, {
        note: sustained
          ? `Growth Fit reduced to ${Math.round(reduced)}% — known evidence indicates sustained recruiting underperformance (e.g. watch list / multi-year). Behavioral baseline was ${
              behavioralGrowth === null ? 'unavailable' : `${Math.round(behavioralGrowth)}%`
            }. This materially lowers role-fit confidence on the primary economic lever.`
          : `Growth Fit reduced to ${Math.round(reduced)}% — known evidence indicates recruiting/growth underperformance. Behavioral baseline was ${
              behavioralGrowth === null ? 'unavailable' : `${Math.round(behavioralGrowth)}%`
            }. Because growth is the DD role’s primary economic lever, this reduces Evidence-Adjusted and Overall fit.`,
      });
      adjustments.push({
        dimension: 'Recruiting / Growth',
        direction: 'down',
        points: growth_penalty_points,
        sustained,
        intensity: modestNegative ? 'modest' : 'material',
      });
    } else if (posGrowth && negGrowth) {
      // Conflicting recruiting signals — net middle (mixed on same lever)
      const ELITE = modestPositive ? 82 : 93;
      const CAP = modestNegative ? (sustained ? 48 : 54) : sustained ? 34 : 42;
      const posScore =
        behavioralGrowth === null ? ELITE : Math.min(96, Math.max(behavioralGrowth, ELITE));
      const negScore =
        behavioralGrowth === null
          ? CAP
          : Math.max(22, Math.min(behavioralGrowth, CAP, behavioralGrowth - (modestNegative ? 8 : 16)));
      const net = Math.round(((posScore + negScore) / 2) * 10) / 10;
      const delta =
        behavioralGrowth === null ? 0 : Math.round((net - behavioralGrowth) * 10) / 10;
      if (delta >= 0) {
        growth_boost_applied = true;
        growth_boost_points = Math.abs(delta);
      } else {
        growth_penalty_applied = true;
        growth_penalty_points = Math.abs(delta);
      }
      dims[growthIdx] = applyDimScore(growth, net, {
        note: `Mixed recruiting evidence — net Growth Fit ${Math.round(net)}% (positive and negative recruiting signals both present). Behavioral baseline was ${
          behavioralGrowth === null ? 'unavailable' : `${Math.round(behavioralGrowth)}%`
        }.`,
      });
      adjustments.push({
        dimension: 'Recruiting / Growth',
        direction: delta >= 0 ? 'up' : 'down',
        points: Math.abs(delta),
        mixed: true,
      });
    }
  }

  // --- Compliance / Ops penalties ---
  const complianceRiskAdj = String(ra?.compliance_ops_risk || '').toLowerCase();
  const forceCompliance =
    evidenceParse.negative_compliance_ops ||
    evidenceParse.strong_negative_compliance_ops_evidence ||
    complianceRiskAdj === 'increase';
  if (forceCompliance) {
    const PENALTY = complianceRiskAdj === 'increase' ? 14 : 14;
    for (const idx of [complianceIdx, opsIdx]) {
      if (idx < 0) continue;
      const d = dims[idx];
      const base =
        typeof d.behavioral_score_percent === 'number'
          ? d.behavioral_score_percent
          : d.score_percent;
      if (typeof base !== 'number') continue;
      const next = Math.max(18, base - PENALTY);
      dims[idx] = applyDimScore(d, next, {
        note: `${d.label} reduced to ${Math.round(next)}% — known evidence indicates operational or compliance risk (behavioral baseline ${Math.round(base)}%). Does not erase growth fit by itself.`,
      });
      compliance_penalty_applied = true;
      adjustments.push({
        dimension: d.id === 'compliance_discipline' ? 'Compliance / Operations' : 'Compliance / Operations',
        direction: 'down',
        points: Math.round((base - next) * 10) / 10,
      });
    }
  }

  // --- Agent support / training / partner penalties ---
  const supportAdj = String(ra?.support_required || '').toLowerCase();
  const forceSupport = evidenceParse.negative_support || supportAdj === 'increase';
  if (forceSupport) {
    if (supportIdx >= 0) {
      const d = dims[supportIdx];
      const base =
        typeof d.behavioral_score_percent === 'number'
          ? d.behavioral_score_percent
          : d.score_percent;
      if (typeof base === 'number') {
        const next = Math.max(18, base - 12);
        dims[supportIdx] = applyDimScore(d, next, {
          note: `Agent Support reduced to ${Math.round(next)}% — known evidence indicates weak agent support or unresolved agent issues.`,
        });
        support_penalty_applied = true;
        adjustments.push({
          dimension: 'Agent Support',
          direction: 'down',
          points: Math.round((base - next) * 10) / 10,
        });
      }
    }
  }
  if (evidenceParse.negative_training && trainingIdx >= 0) {
    const d = dims[trainingIdx];
    const base =
      typeof d.behavioral_score_percent === 'number'
        ? d.behavioral_score_percent
        : d.score_percent;
    if (typeof base === 'number') {
      const next = Math.max(18, base - 10);
      dims[trainingIdx] = applyDimScore(d, next, {
        note: `Training / Communication reduced to ${Math.round(next)}% — known evidence indicates training/attendance weakness.`,
      });
      adjustments.push({
        dimension: 'Training / Communication',
        direction: 'down',
        points: Math.round((base - next) * 10) / 10,
      });
    }
  }
  if (evidenceParse.negative_partner && partnerIdx >= 0) {
    const d = dims[partnerIdx];
    const base =
      typeof d.behavioral_score_percent === 'number'
        ? d.behavioral_score_percent
        : d.score_percent;
    if (typeof base === 'number') {
      const next = Math.max(18, base - 10);
      dims[partnerIdx] = applyDimScore(d, next, {
        note: `Partner Advocacy reduced to ${Math.round(next)}% — known evidence indicates partner advocacy issues.`,
      });
      adjustments.push({
        dimension: 'Partner Advocacy',
        direction: 'down',
        points: Math.round((base - next) * 10) / 10,
      });
    }
  }

  return {
    dimensions: dims,
    growth_boost_applied,
    growth_boost_points,
    growth_penalty_applied,
    growth_penalty_points,
    compliance_penalty_applied,
    support_penalty_applied,
    adjustments,
  };
}

/**
 * Growth-weighted overall with optional excellence OR underperformance calibration.
 *
 * Positive recruiting evidence:
 *   base = standard growth-weighted average (with boosted growth dim)
 *   excellence = 0.58 * GrowthFit + 0.42 * base
 *   overall = max(base, excellence)
 *
 * Negative recruiting evidence:
 *   underperformance = 0.62 * GrowthFit + 0.38 * base
 *   overall = min(base, underperformance)  — keeps overall aligned with weak growth lever
 */
export function computeGrowthWeightedOverall(
  dimensionResults = [],
  {
    strongRecruitingEvidence = false,
    negativeRecruitingEvidence = false,
  } = {},
) {
  const base = computeWeightedOverall(dimensionResults);
  if (base.overall_percent === null || base.overall_percent === undefined) {
    return {
      ...base,
      excellence_calibration_applied: false,
      underperformance_calibration_applied: false,
      base_weighted_percent: null,
    };
  }

  const growth = dimensionResults.find((d) => d.id === 'recruiting_growth_drive');
  const growthScore =
    typeof growth?.score_percent === 'number' && Number.isFinite(growth.score_percent)
      ? growth.score_percent
      : null;

  // Mixed: both positive and negative recruiting — prefer underperformance if growth is low,
  // excellence if growth is elite. Net growth score already reflects mix.
  if (negativeRecruitingEvidence && !strongRecruitingEvidence && growthScore !== null) {
    const underperf =
      Math.round((0.62 * growthScore + 0.38 * base.overall_percent) * 10) / 10;
    const overall = Math.round(Math.min(base.overall_percent, underperf) * 10) / 10;
    return {
      ...base,
      overall_percent: overall,
      excellence_calibration_applied: false,
      underperformance_calibration_applied: overall < base.overall_percent - 0.05,
      base_weighted_percent: base.overall_percent,
      underperformance_blend_percent: underperf,
    };
  }

  if (strongRecruitingEvidence && growthScore !== null && !negativeRecruitingEvidence) {
    const excellence =
      Math.round((0.58 * growthScore + 0.42 * base.overall_percent) * 10) / 10;
    const overall = Math.round(Math.max(base.overall_percent, excellence) * 10) / 10;
    return {
      ...base,
      overall_percent: overall,
      excellence_calibration_applied: overall > base.overall_percent + 0.05,
      underperformance_calibration_applied: false,
      base_weighted_percent: base.overall_percent,
      excellence_blend_percent: excellence,
    };
  }

  // Mixed pos+neg recruiting or no special calibration
  if (strongRecruitingEvidence && negativeRecruitingEvidence && growthScore !== null) {
    // No one-way excellence or underperformance blend — use base weighted with net growth
    return {
      ...base,
      excellence_calibration_applied: false,
      underperformance_calibration_applied: false,
      base_weighted_percent: base.overall_percent,
      mixed_recruiting_evidence: true,
    };
  }

  return {
    ...base,
    excellence_calibration_applied: false,
    underperformance_calibration_applied: false,
    base_weighted_percent: base.overall_percent,
  };
}

const RISK_LEVEL_ORDER = ['Low', 'Manageable', 'Moderate', 'Elevated', 'High', 'Unknown'];

function elevateRiskLevel(level, steps = 1) {
  const idx = RISK_LEVEL_ORDER.indexOf(level);
  if (idx < 0 || level === 'Unknown') return steps >= 2 ? 'High' : 'Elevated';
  return RISK_LEVEL_ORDER[Math.min(RISK_LEVEL_ORDER.length - 2, idx + steps)]; // cap at High
}

/**
 * Compliance / Operations risk from those dimensions — visible, not crushing overall alone.
 * Optional evidenceParse raises risk when negative compliance/ops evidence is present.
 */
export function classifyComplianceOperationsRisk(dimensionResults = [], evidenceParse = null) {
  const compliance = dimensionResults.find((d) => d.id === 'compliance_discipline');
  const ops = dimensionResults.find((d) => d.id === 'operational_responsiveness');
  const scores = [compliance?.score_percent, ops?.score_percent].filter(
    (v) => typeof v === 'number' && Number.isFinite(v),
  );
  if (!scores.length) {
    return {
      level: 'Unknown',
      label: 'Compliance / Operations Risk',
      detail: 'Insufficient compliance/ops signals to classify risk.',
      score_percent: null,
    };
  }
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  let level = 'Low';
  if (avg < 45) level = 'High';
  else if (avg < 55) level = 'Elevated';
  else if (avg < 65) level = 'Moderate';
  else if (avg < 75) level = 'Manageable';

  const negOps = Boolean(
    evidenceParse?.negative_compliance_ops || evidenceParse?.strong_negative_compliance_ops_evidence,
  );
  const negRecruitSustained = Boolean(
    evidenceParse?.sustained_underperformance && evidenceParse?.negative_recruiting,
  );

  if (negOps) {
    level = elevateRiskLevel(level, 1);
  }
  // Sustained recruiting failure also raises coaching/risk visibility modestly
  if (negRecruitSustained && !negOps) {
    level = elevateRiskLevel(level, 1);
  }

  let detail = `Compliance ${
    compliance?.score_percent == null ? '—' : `${Math.round(compliance.score_percent)}%`
  } · Operations ${ops?.score_percent == null ? '—' : `${Math.round(ops.score_percent)}%`}. Risk stays visible for coaching structure even when growth evidence is strong.`;

  if (negOps) {
    detail = `Known performance evidence indicates operational or compliance risk. ${detail}`;
  } else if (negRecruitSustained) {
    detail = `Sustained recruiting underperformance raises the support/risk profile for the DD seat. ${detail}`;
  }

  return {
    level,
    label: 'Compliance / Operations Risk',
    detail,
    score_percent: Math.round(avg * 10) / 10,
    evidence_elevated: Boolean(negOps || negRecruitSustained),
  };
}

const SUPPORT_LEVEL_ORDER = ['Low', 'Moderate', 'Structured', 'High'];

function elevateSupportLevel(level, steps = 1) {
  const idx = SUPPORT_LEVEL_ORDER.indexOf(level);
  if (idx < 0) return steps >= 2 ? 'High' : 'Structured';
  return SUPPORT_LEVEL_ORDER[Math.min(SUPPORT_LEVEL_ORDER.length - 1, idx + steps)];
}

/**
 * Support Required: Low / Moderate / Structured / High
 * Negative evidence (especially sustained recruiting or compliance/ops) can raise support need.
 */
export function classifySupportRequired(dimensionResults = [], riskLevel = '', evidenceParse = null) {
  const weakCount = (dimensionResults || []).filter(
    (d) => typeof d.score_percent === 'number' && d.score_percent < 55,
  ).length;
  const compliance = dimensionResults.find((d) => d.id === 'compliance_discipline');
  const support = dimensionResults.find((d) => d.id === 'agent_support_service');
  const ops = dimensionResults.find((d) => d.id === 'operational_responsiveness');
  const secondaryWeak = [compliance, support, ops].filter(
    (d) => d && typeof d.score_percent === 'number' && d.score_percent < 55,
  ).length;

  let level = 'Low';
  if (weakCount >= 4 || secondaryWeak >= 3) level = 'High';
  else if (weakCount >= 2 || secondaryWeak >= 2) level = 'Structured';
  else if (weakCount >= 1 || secondaryWeak >= 1 || /high|elevated/i.test(String(riskLevel))) {
    level = 'Moderate';
  }

  if (evidenceParse?.sustained_underperformance && evidenceParse?.negative_recruiting) {
    level = elevateSupportLevel(level, 2);
  } else if (evidenceParse?.negative_recruiting) {
    level = elevateSupportLevel(level, 1);
  }
  if (
    evidenceParse?.negative_compliance_ops ||
    evidenceParse?.strong_negative_compliance_ops_evidence ||
    evidenceParse?.negative_support
  ) {
    level = elevateSupportLevel(level, 1);
  }

  const notes = {
    Low: 'Standard DD operating cadence with periodic coaching on secondary levers is sufficient.',
    Moderate: 'Benefits from clear KPIs, coaching on weakest levers, and a defined Market Center support bench.',
    Structured:
      'Requires structured compliance peer-review, operational cadence partners, and staged ownership on non-growth duties.',
    High: 'Requires high-touch support structure: compliance second-review, ops coverage, and coaching before full independent DD load.',
  };

  let detail = notes[level] || notes.Moderate;
  if (evidenceParse?.sustained_underperformance && evidenceParse?.negative_recruiting) {
    detail = `Known evidence of sustained recruiting underperformance raises support need. ${detail}`;
  } else if (evidenceParse?.negative_compliance_ops) {
    detail = `Known operational/compliance evidence raises support and risk requirements. ${detail}`;
  } else if (evidenceParse?.negative_recruiting) {
    detail = `Known recruiting underperformance increases coaching structure around the growth lever. ${detail}`;
  }

  return {
    level,
    label: 'Support Required',
    detail,
    evidence_elevated: Boolean(
      evidenceParse?.negative_recruiting ||
        evidenceParse?.negative_compliance_ops ||
        evidenceParse?.negative_support,
    ),
  };
}

/**
 * Score a single role dimension from BOS signals + role model definition.
 */
export function scoreRoleDimension(dimensionDef, signalMap) {
  const keys = (dimensionDef.bos_signals || []).map((k) => String(k).toLowerCase());
  const avg = averageSignals(signalMap, keys);
  const percent = signalAverageToPercent(avg);
  const fit = classifyDimensionFit(percent);
  const availableSignals = keys.filter(
    (k) => typeof signalMap[k] === 'number' && Number.isFinite(signalMap[k]),
  );

  return {
    id: dimensionDef.id,
    label: dimensionDef.label,
    weight: dimensionDef.weight,
    weight_label: dimensionDef.weight_label,
    accent: dimensionDef.accent,
    score_percent: percent,
    fit_category: fit.label,
    fit_category_id: fit.id,
    note: buildDimensionNote(dimensionDef, percent, fit, availableSignals),
    bos_signals_used: availableSignals,
    bos_signals_expected: keys,
    role_demand: dimensionDef.role_demand,
    signal_average: avg === null ? null : Math.round(avg * 1000) / 1000,
  };
}

function buildDimensionNote(dimensionDef, percent, fit, availableSignals) {
  if (percent === null) {
    return `Insufficient BOS signal coverage for ${dimensionDef.label}.`;
  }
  const signalText = availableSignals.length
    ? availableSignals.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')
    : 'limited signals';
  return `${fit.label} on ${dimensionDef.label} (${Math.round(percent)}%) from ${signalText}. ${shortDemandHint(dimensionDef.id)}`;
}

function shortDemandHint(dimensionId) {
  switch (dimensionId) {
    case 'recruiting_growth_drive':
      return 'Growth is a primary DD economic lever — not the only job.';
    case 'accountability_follow_through':
      return 'Monthly rhythm and closed loops matter as much as ambition.';
    case 'agent_support_service':
      return 'Agent culture and support are core DD duties.';
    case 'compliance_discipline':
      return 'Risk and document discipline protect the Market Center.';
    case 'training_communication':
      return 'Clear teaching and standards reduce field friction.';
    case 'operational_responsiveness':
      return 'Speed with accuracy wins transaction issue resolution.';
    case 'partner_ecosystem_advocacy':
      return 'Partner advocacy is supporting, not primary.';
    default:
      return '';
  }
}

/**
 * Weighted overall score from dimension results.
 */
export function computeWeightedOverall(dimensionResults = []) {
  let weightSum = 0;
  let scoredWeightSum = 0;
  let weightedScore = 0;

  for (const dim of dimensionResults) {
    const w = typeof dim.weight === 'number' ? dim.weight : 1;
    weightSum += w;
    if (dim.score_percent === null || dim.score_percent === undefined) continue;
    scoredWeightSum += w;
    weightedScore += dim.score_percent * w;
  }

  if (scoredWeightSum <= 0) {
    return {
      overall_percent: null,
      coverage_ratio: 0,
      weight_coverage: 0,
      total_weight: weightSum,
    };
  }

  const overall = weightedScore / scoredWeightSum;
  return {
    overall_percent: Math.round(overall * 10) / 10,
    coverage_ratio: Math.round((scoredWeightSum / (weightSum || 1)) * 1000) / 1000,
    weight_coverage: scoredWeightSum,
    total_weight: weightSum,
  };
}

/**
 * Confidence from signal coverage + weight coverage. Conservative.
 */
export function computeAnalysisConfidence({ availableCount, totalExpected, coverage_ratio }) {
  const signalCoverage = totalExpected > 0 ? availableCount / totalExpected : 0;
  const weightCoverage = typeof coverage_ratio === 'number' ? coverage_ratio : 0;
  // Cap confidence — deterministic V1 without GPT reasoning layer
  const raw = signalCoverage * 0.55 + weightCoverage * 0.35 + 0.08;
  const percent = Math.round(Math.min(0.88, Math.max(0.22, raw)) * 1000) / 10;
  let label = 'Moderate';
  if (percent >= 75) label = 'High';
  else if (percent >= 55) label = 'Moderate';
  else if (percent >= 40) label = 'Limited';
  else label = 'Low';

  return {
    percent,
    label,
    note: 'Deterministic first-pass confidence from BOS signal coverage. GPT-5.5 reasoning layer not applied in V1.',
  };
}

/**
 * Safe string pick from many possible field shapes.
 * Never throws. Empty / non-string values are ignored.
 */
function firstNonEmptyString(...candidates) {
  for (const value of candidates) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
      continue;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    // Common answer-wrapper shapes: { answer_text }, { text }, { value }
    if (typeof value === 'object') {
      const nested =
        value.answer_text ?? value.text ?? value.value ?? value.label ?? value.name;
      if (typeof nested === 'string' && nested.trim()) return nested.trim();
    }
  }
  return null;
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

/**
 * Collect likely identity-bearing objects from retrieve-profile payload shapes.
 * Covers top-level, dossier, canonical_profile_json, nested profile wrappers, etc.
 */
function collectIdentitySources(payload = {}) {
  const root = safeObject(payload);
  const dataWrapper = safeObject(root.data);
  const dossier = safeObject(
    root.canonical_dossier ||
      root.profile ||
      root.record ||
      root.profile_record ||
      dataWrapper.canonical_dossier ||
      dataWrapper.profile ||
      dataWrapper.record ||
      dataWrapper.profile_record,
  );
  const nestedDossier = safeObject(dossier.canonical_dossier);
  const canonicalJson = safeObject(
    dossier.canonical_profile_json ||
      nestedDossier.canonical_profile_json ||
      root.canonical_profile_json ||
      dataWrapper.canonical_profile_json ||
      unwrapCanonical(root),
  );
  const metadata = safeObject(
    canonicalJson.metadata ||
      dossier.metadata ||
      root.metadata ||
      canonicalJson.profile_metadata ||
      dossier.profile_metadata,
  );
  const identity = safeObject(
    metadata.identity ||
      canonicalJson.identity ||
      dossier.identity ||
      root.identity,
  );
  const answers = safeObject(
    canonicalJson.answers ||
      canonicalJson.assessment_answers ||
      dossier.answers ||
      root.answers,
  );
  const intake = safeObject(
    canonicalJson.intake_answers ||
      dossier.intake_answers ||
      root.intake_answers ||
      answers,
  );
  const profileNested = safeObject(root.profile || dossier.profile || dataWrapper.profile);
  const organization = safeObject(
    metadata.organization ||
      identity.organization ||
      canonicalJson.organization ||
      dossier.organization,
  );

  return {
    root,
    dataWrapper,
    dossier,
    nestedDossier,
    canonicalJson,
    metadata,
    identity,
    answers,
    intake,
    profileNested,
    organization,
  };
}

/**
 * Robust BOS / leadership profile identity extraction.
 * Prefer real retrieve-profile locations (canonical_dossier.person_name, etc.).
 * Never hardcodes a person name or profile-id-specific branch.
 * Fallback name remains "Name unavailable".
 *
 * @param {object} profilePayload - retrieve-profile response or nested profile object
 * @param {string} [profileId]
 * @returns {{
 *   profile_id: string,
 *   name: string,
 *   company: string|null,
 *   market_center: string|null,
 *   current_role: string|null,
 *   status: string,
 *   generated_at: string|null,
 *   name_source: string|null,
 *   inspected_fields: string[],
 * }}
 */
export function extractLeadershipProfileIdentity(profilePayload = {}, profileId = '') {
  const inspected = [];
  const mark = (label, value) => {
    inspected.push(label);
    return value;
  };

  try {
    const sources = collectIdentitySources(profilePayload);
    const {
      root,
      dataWrapper,
      dossier,
      nestedDossier,
      canonicalJson,
      metadata,
      identity,
      answers,
      intake,
      profileNested,
      organization,
    } = sources;

    // Name candidates — ordered by observed production reliability.
    // Critical: person_name lives on canonical_dossier for mini-v2 retrieve payloads.
    const nameCandidates = [
      ['canonical_dossier.person_name', mark('canonical_dossier.person_name', dossier.person_name)],
      ['canonical_dossier.full_name', mark('canonical_dossier.full_name', dossier.full_name)],
      ['canonical_dossier.name', mark('canonical_dossier.name', dossier.name)],
      ['canonical_dossier.display_name', mark('canonical_dossier.display_name', dossier.display_name)],
      ['canonical_dossier.profile_name', mark('canonical_dossier.profile_name', dossier.profile_name)],
      ['canonical_dossier.user_name', mark('canonical_dossier.user_name', dossier.user_name)],
      ['payload.person_name', mark('payload.person_name', root.person_name)],
      ['payload.full_name', mark('payload.full_name', root.full_name)],
      ['payload.name', mark('payload.name', root.name)],
      ['payload.display_name', mark('payload.display_name', root.display_name)],
      ['payload.profile_name', mark('payload.profile_name', root.profile_name)],
      ['payload.user_name', mark('payload.user_name', root.user_name)],
      ['data.person_name', mark('data.person_name', dataWrapper.person_name)],
      ['data.full_name', mark('data.full_name', dataWrapper.full_name)],
      ['data.name', mark('data.name', dataWrapper.name)],
      [
        'canonical_profile_json.person_name',
        mark('canonical_profile_json.person_name', canonicalJson.person_name),
      ],
      [
        'canonical_profile_json.full_name',
        mark('canonical_profile_json.full_name', canonicalJson.full_name),
      ],
      ['canonical_profile_json.name', mark('canonical_profile_json.name', canonicalJson.name)],
      [
        'canonical_profile_json.display_name',
        mark('canonical_profile_json.display_name', canonicalJson.display_name),
      ],
      ['metadata.person_name', mark('metadata.person_name', metadata.person_name)],
      ['metadata.full_name', mark('metadata.full_name', metadata.full_name)],
      ['metadata.name', mark('metadata.name', metadata.name)],
      ['metadata.display_name', mark('metadata.display_name', metadata.display_name)],
      ['identity.full_name', mark('identity.full_name', identity.full_name)],
      ['identity.name', mark('identity.name', identity.name)],
      ['identity.person_name', mark('identity.person_name', identity.person_name)],
      ['identity.display_name', mark('identity.display_name', identity.display_name)],
      ['profile.person_name', mark('profile.person_name', profileNested.person_name)],
      ['profile.full_name', mark('profile.full_name', profileNested.full_name)],
      ['profile.name', mark('profile.name', profileNested.name)],
      [
        'nested_dossier.person_name',
        mark('nested_dossier.person_name', nestedDossier.person_name),
      ],
      ['answers.full_name', mark('answers.full_name', answers.full_name)],
      ['answers.name', mark('answers.name', answers.name)],
      ['intake.full_name', mark('intake.full_name', intake.full_name)],
      ['intake.name', mark('intake.name', intake.name)],
    ];

    // first + last composition (metadata / identity / intake)
    const firstLast = firstNonEmptyString(
      [
        firstNonEmptyString(
          metadata.first_name,
          identity.first_name,
          intake.first_name,
          answers.first_name,
        ),
        firstNonEmptyString(
          metadata.last_name,
          identity.last_name,
          intake.last_name,
          answers.last_name,
        ),
      ]
        .filter(Boolean)
        .join(' ')
        .trim() || null,
    );
    if (firstLast) {
      nameCandidates.push(['composed.first_last', mark('composed.first_last', firstLast)]);
    }

    let name = null;
    let nameSource = null;
    for (const [source, raw] of nameCandidates) {
      const resolved = firstNonEmptyString(raw);
      if (resolved) {
        name = resolved;
        nameSource = source;
        break;
      }
    }

    const company =
      firstNonEmptyString(
        mark('canonical_dossier.company_name', dossier.company_name),
        mark('canonical_dossier.company', dossier.company),
        mark('canonical_dossier.organization', dossier.organization),
        mark('payload.company_name', root.company_name),
        mark('payload.company', root.company),
        mark('canonical_profile_json.company_name', canonicalJson.company_name),
        mark('canonical_profile_json.company', canonicalJson.company),
        mark('metadata.company', metadata.company),
        mark('metadata.company_name', metadata.company_name),
        mark('metadata.organization', metadata.organization),
        mark('organization.name', organization.name),
        mark('organization.company_name', organization.company_name),
        mark('organization.company', organization.company),
        mark('answers.company', answers.company),
        mark('intake.company', intake.company),
      ) || null;

    const marketCenter =
      firstNonEmptyString(
        mark('metadata.market_center', metadata.market_center),
        mark('canonical_dossier.market_center', dossier.market_center),
        mark('canonical_profile_json.market_center', canonicalJson.market_center),
        mark('organization.market_center', organization.market_center),
        mark('identity.market_center', identity.market_center),
        mark('payload.market_center', root.market_center),
        company,
      ) || null;

    const currentRole =
      firstNonEmptyString(
        mark('payload.current_role', root.current_role),
        mark('canonical_dossier.current_role', dossier.current_role),
        mark('canonical_dossier.role', dossier.role),
        mark('canonical_dossier.job_title', dossier.job_title),
        mark('canonical_profile_json.current_role', canonicalJson.current_role),
        mark('metadata.role', metadata.role),
        mark('metadata.current_role', metadata.current_role),
        mark('metadata.job_title', metadata.job_title),
        mark('identity.role', identity.role),
        mark('identity.current_role', identity.current_role),
        mark('identity.job_title', identity.job_title),
        mark('organization.role', organization.role),
        mark('answers.role', answers.role),
        mark('answers.current_role', answers.current_role),
        mark('intake.role', intake.role),
      ) || null;

    const resolvedId =
      firstNonEmptyString(
        mark('payload.profile_id', root.profile_id),
        mark('canonical_dossier.profile_id', dossier.profile_id),
        mark('canonical_profile_json.profile_id', canonicalJson.profile_id),
        mark('metadata.profile_id', metadata.profile_id),
        mark('data.profile_id', dataWrapper.profile_id),
        profileId,
      ) || '';

    const status =
      firstNonEmptyString(
        mark('payload.status', root.status),
        mark('metadata.status', metadata.status),
        mark('canonical_dossier.status', dossier.status),
      ) ||
      (root.canonical_dossier || Object.keys(canonicalJson).length ? 'active' : 'unknown');

    const generatedAt =
      firstNonEmptyString(
        metadata.generated_at,
        canonicalJson.generated_at,
        dossier.created_at,
        root.retrieved_at,
      ) || null;

    return {
      profile_id: resolvedId,
      name: name || 'Name unavailable',
      company: company || marketCenter || null,
      market_center: marketCenter || company || null,
      current_role: currentRole || null,
      status: status || 'active',
      generated_at: generatedAt,
      name_source: nameSource,
      inspected_fields: inspected,
    };
  } catch {
    // Absolute safety net — identity extraction must never crash scoring.
    return {
      profile_id: profileId || '',
      name: 'Name unavailable',
      company: null,
      market_center: null,
      current_role: null,
      status: 'unknown',
      generated_at: null,
      name_source: null,
      inspected_fields: inspected,
    };
  }
}

/**
 * Backward-compatible alias used by Role Fit dashboard builders.
 * Delegates to extractLeadershipProfileIdentity.
 */
export function extractProfileIdentity(payload = {}, profileId = '') {
  return extractLeadershipProfileIdentity(payload, profileId);
}

export function extractNarrativeHints(payload = {}) {
  const bi = payload?.behavioral_intelligence_v1 || {};
  const canonical = unwrapCanonical(payload);
  const data = canonical?.canonical_profile_json || canonical || {};

  const oneMove =
    bi?.one_move ||
    bi?.recommendedNextStep ||
    data?.development_targets ||
    null;

  const risks =
    data?.hidden_risk_patterns ||
    data?.stall_patterns ||
    bi?.risks ||
    null;

  const constraints =
    data?.future_growth_constraints ||
    data?.growth_tension ||
    bi?.constraints ||
    null;

  const environmentFit = data?.environment_fit || null;
  const roleFitAnalysis = data?.role_fit_analysis || null;
  const leadershipReadiness = data?.leadership_readiness || null;

  return {
    oneMove,
    risks,
    constraints,
    environmentFit,
    roleFitAnalysis,
    leadershipReadiness,
  };
}

/**
 * Map GPT evidence interpreter output → evidenceParse shape used by applyEvidenceToDimensions.
 * GPT recommends; deterministic code applies bounded adjustments.
 *
 * @param {object} interpretation - validated GPT JSON interpretation
 * @param {string} evidenceText - original free-text evidence
 * @returns {object} evidenceParse compatible object
 */
export function mapGptInterpretationToEvidenceParse(interpretation, evidenceText = '') {
  const raw = typeof evidenceText === 'string' ? evidenceText.trim() : String(evidenceText ?? '').trim();
  if (!raw) {
    return { ...EMPTY_EVIDENCE_PARSE };
  }

  const interp = interpretation && typeof interpretation === 'object' ? interpretation : {};
  const classificationRaw = String(interp.classification || 'neutral').toLowerCase();
  const classification = ['positive', 'negative', 'mixed', 'neutral'].includes(classificationRaw)
    ? classificationRaw
    : 'neutral';

  const signals = Array.isArray(interp.signals) ? interp.signals : [];
  const affected = Array.isArray(interp.affected_dimensions)
    ? interp.affected_dimensions.map(String)
    : [];

  const isGrowthDim = (name) => /recruit|growth/i.test(String(name || ''));
  const isComplianceDim = (name) => /compliance|operational|ops/i.test(String(name || ''));
  const isSupportDim = (name) => /agent support|service/i.test(String(name || ''));
  const isTrainingDim = (name) => /training|communication/i.test(String(name || ''));
  const isPartnerDim = (name) => /partner|ecosystem/i.test(String(name || ''));
  const isAccountabilityDim = (name) => /accountab|follow/i.test(String(name || ''));

  const posSignals = signals.filter((s) => String(s?.direction).toLowerCase() === 'positive');
  const negSignals = signals.filter((s) => String(s?.direction).toLowerCase() === 'negative');

  const posGrowth = posSignals.some((s) => isGrowthDim(s.dimension));
  const negGrowth = negSignals.some((s) => isGrowthDim(s.dimension));
  const negCompliance = negSignals.some((s) => isComplianceDim(s.dimension));
  const negSupport = negSignals.some((s) => isSupportDim(s.dimension));
  const negTraining = negSignals.some((s) => isTrainingDim(s.dimension));
  const negPartner = negSignals.some((s) => isPartnerDim(s.dimension));
  const negAccountability = negSignals.some((s) => isAccountabilityDim(s.dimension));

  const sustained = negSignals.some(
    (s) =>
      String(s?.duration).toLowerCase() === 'sustained' &&
      (isGrowthDim(s.dimension) || /watch\s*list|years|underperform/i.test(String(s?.summary || ''))),
  );

  const ra =
    interp.recommended_adjustments && typeof interp.recommended_adjustments === 'object'
      ? interp.recommended_adjustments
      : {};

  // Derive flags from signals OR recommended_adjustments so scoring always has a path
  const growthAdj = String(ra.growth_fit || '').toLowerCase();
  const effectivePosGrowth =
    posGrowth ||
    growthAdj === 'increase_materially' ||
    growthAdj === 'increase_modestly';
  const effectiveNegGrowth =
    negGrowth ||
    growthAdj === 'decrease_materially' ||
    growthAdj === 'decrease_modestly';
  const complianceRiskAdj = String(ra.compliance_ops_risk || '').toLowerCase();
  const supportAdj = String(ra.support_required || '').toLowerCase();
  const effectiveNegCompliance = negCompliance || complianceRiskAdj === 'increase';
  const effectiveNegSupport =
    negSupport || negAccountability || supportAdj === 'increase';

  const dimSet = new Set();
  for (const d of affected) {
    if (isGrowthDim(d)) dimSet.add('Recruiting / Growth');
    else if (isComplianceDim(d)) dimSet.add('Compliance / Operations');
    else if (isSupportDim(d)) dimSet.add('Agent Support');
    else if (isTrainingDim(d)) dimSet.add('Training / Communication');
    else if (isPartnerDim(d)) dimSet.add('Partner Advocacy');
    else if (isAccountabilityDim(d)) dimSet.add('Accountability / Follow-through');
    else dimSet.add(d);
  }
  if (effectivePosGrowth || effectiveNegGrowth) dimSet.add('Recruiting / Growth');
  if (effectiveNegCompliance) dimSet.add('Compliance / Operations');
  if (effectiveNegSupport) dimSet.add('Agent Support');

  const detectedPositiveSignals = posSignals
    .map((s) => String(s.summary || s.dimension || '').trim())
    .filter(Boolean);
  const detectedNegativeSignals = negSignals
    .map((s) => String(s.summary || s.dimension || '').trim())
    .filter(Boolean);

  const plain =
    String(interp.plain_english_summary || '').trim() ||
    'GPT-5.5 interpreted free-text performance evidence.';
  const boardSafe =
    String(interp.board_safe_interpretation || '').trim() || plain;
  const impact =
    classification === 'neutral'
      ? 'Evidence Impact: Neutral — interpreter found no automatic dimension adjustments.'
      : classification === 'positive'
        ? `Evidence Impact: Positive — ${plain}`
        : classification === 'negative'
          ? `Evidence Impact: Negative — ${plain}`
          : `Evidence Impact: Mixed — ${plain}`;

  return {
    raw,
    has_input: true,
    summary: plain,
    classification,
    strong_recruiting_evidence: Boolean(effectivePosGrowth && !effectiveNegGrowth),
    strong_negative_recruiting_evidence: Boolean(effectiveNegGrowth),
    strong_negative_compliance_ops_evidence: Boolean(effectiveNegCompliance),
    positive_recruiting: Boolean(effectivePosGrowth),
    negative_recruiting: Boolean(effectiveNegGrowth),
    negative_compliance_ops: Boolean(effectiveNegCompliance),
    negative_support: Boolean(effectiveNegSupport),
    negative_training: Boolean(negTraining),
    negative_partner: Boolean(negPartner),
    positive_compliance: posSignals.some((s) => isComplianceDim(s.dimension)),
    sustained_underperformance: Boolean(sustained && effectiveNegGrowth),
    detectedPositiveSignals,
    detectedNegativeSignals,
    matched_phrases: [...detectedPositiveSignals, ...detectedNegativeSignals],
    matched_positive_phrases: detectedPositiveSignals,
    matched_negative_phrases: detectedNegativeSignals,
    affectedDimensions: Array.from(dimSet),
    evidenceImpactSummary: impact,
    scoreAdjustmentSummary: boardSafe,
    strength:
      classification === 'positive'
        ? 'strong'
        : classification === 'negative'
          ? 'negative'
          : classification === 'mixed'
            ? 'mixed'
            : 'none',
    // GPT metadata for audit / UI
    interpretation_source: 'gpt',
    recommended_adjustments: {
      growth_fit: ra.growth_fit || 'no_change',
      evidence_adjusted_fit: ra.evidence_adjusted_fit || 'no_change',
      overall_fit: ra.overall_fit || 'no_change',
      compliance_ops_risk: ra.compliance_ops_risk || 'no_change',
      support_required: ra.support_required || 'no_change',
    },
    gpt_confidence:
      typeof interp.confidence === 'number' && Number.isFinite(interp.confidence)
        ? interp.confidence
        : null,
    gpt_signals: signals,
    gpt_affected_dimensions: affected,
    plain_english_summary: plain,
    board_safe_interpretation: boardSafe,
    guardrail_note:
      String(interp.guardrail_note || '').trim() ||
      'GPT interprets evidence; deterministic code applies bounded adjustments.',
  };
}

/**
 * Resolve evidence parse: prefer GPT interpretation when present and valid;
 * otherwise fall back to deterministic keyword parser.
 *
 * @param {string} evidenceText
 * @param {object|null} gptInterpretation
 * @param {{ forceDeterministic?: boolean }} [options]
 */
export function resolveEvidenceParse(evidenceText = '', gptInterpretation = null, options = {}) {
  const raw = typeof evidenceText === 'string' ? evidenceText.trim() : String(evidenceText ?? '').trim();
  if (!raw) {
    return {
      evidenceParse: { ...EMPTY_EVIDENCE_PARSE },
      interpretation_source: 'none',
      fallback_used: false,
      fallback_message: null,
    };
  }

  if (!options.forceDeterministic && gptInterpretation && typeof gptInterpretation === 'object') {
    const classification = String(gptInterpretation.classification || '').toLowerCase();
    if (['positive', 'negative', 'mixed', 'neutral'].includes(classification)) {
      const mapped = mapGptInterpretationToEvidenceParse(gptInterpretation, raw);
      return {
        evidenceParse: mapped,
        interpretation_source: 'gpt',
        fallback_used: false,
        fallback_message: null,
      };
    }
  }

  const deterministic = parsePerformanceEvidence(raw);
  return {
    evidenceParse: {
      ...deterministic,
      interpretation_source: 'deterministic_fallback',
      plain_english_summary: deterministic.summary,
      board_safe_interpretation: deterministic.evidenceImpactSummary,
      guardrail_note:
        'GPT-5.5 evidence interpretation unavailable. Deterministic fallback applied.',
    },
    interpretation_source: 'deterministic_fallback',
    fallback_used: true,
    fallback_message:
      'GPT-5.5 evidence interpretation unavailable. Deterministic fallback applied.',
  };
}

export { BOS_DIMENSIONS };
