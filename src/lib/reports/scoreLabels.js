/** Production operating score labels and classification for Customer BOS. */

export const OPERATING_DIMENSION_ORDER = [
  'Vector',
  'Velocity',
  'Signal',
  'Fidelity',
  'Leverage',
  'Flex',
  'Framework',
  'Horizon',
];

export const SCORE_CLASSIFICATION_COLORS = {
  high: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
  strong: 'border-emerald-400/30 bg-emerald-500/8 text-emerald-100',
  moderate: 'border-sky-400/30 bg-sky-500/8 text-sky-100',
  low: 'border-amber-400/30 bg-amber-500/8 text-amber-100',
  'very low': 'border-rose-400/30 bg-rose-500/8 text-rose-100',
  unavailable: 'border-white/15 bg-white/[0.03] text-white/45',
};

export const DIMENSION_COLORS = {
  Vector: '#fb923c',
  Velocity: '#f97316',
  Signal: '#38bdf8',
  Fidelity: '#60a5fa',
  Leverage: '#a78bfa',
  Flex: '#c084fc',
  Framework: '#fbbf24',
  Horizon: '#f87171',
};

const DIMENSION_ONE_LINE = {
  Vector: 'Direction and path-setting in how you operate.',
  Velocity: 'Speed from thought to action once direction forms.',
  Signal: 'Reading relational and contextual cues.',
  Fidelity: 'Precision and detail fidelity when it matters.',
  Leverage: 'Using leverage points and scaling judgment.',
  Flex: 'Adaptability and situational adjustment.',
  Framework: 'Structure, repeatability, and operating rules.',
  Horizon: 'Future orientation and long-range planning.',
};

export function normalizeOperatingScore(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, Math.abs(value)));
}

export function classifyOperatingScore(score) {
  if (score === null || score === undefined) return 'unavailable';
  if (score >= 0.85) return 'high';
  if (score >= 0.7) return 'strong';
  if (score >= 0.4) return 'moderate';
  if (score >= 0.15) return 'low';
  return 'very low';
}

export function getDimensionOneLine(dimension) {
  return DIMENSION_ONE_LINE[dimension] || 'Operating pattern for this dimension.';
}

export function getScoreFromProfile(dimension, data = {}, ranked = []) {
  const key = dimension.toLowerCase();
  const vectorScores = data.vector_scores || {};

  if (vectorScores[key] !== undefined && vectorScores[key] !== null) {
    return normalizeOperatingScore(vectorScores[key]);
  }

  const rankedEntry = (ranked || []).find(
    (entry) => String(entry?.dimension || '').toLowerCase() === key,
  );

  if (!rankedEntry) return null;

  return normalizeOperatingScore(
    rankedEntry.display_score
    ?? rankedEntry.gpt_rescored_score
    ?? rankedEntry.support_adjusted_score
    ?? rankedEntry.rescored_score
    ?? rankedEntry.score,
  );
}

export function buildOperatingScoreCards(data = {}, ranked = []) {
  return OPERATING_DIMENSION_ORDER.map((dimension) => {
    const score = getScoreFromProfile(dimension, data, ranked);
    const classification = classifyOperatingScore(score);

    return {
      dimension,
      score,
      classification,
      oneLine: getDimensionOneLine(dimension),
      available: score !== null,
    };
  });
}