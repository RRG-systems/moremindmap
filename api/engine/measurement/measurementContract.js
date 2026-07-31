export const BOS_MEASUREMENT_CONTRACT_VERSION = 'bos_measurement_v1';

export const BOS_TOPOLOGY_BANDS = Object.freeze({
  low_max_exclusive: 0.35,
  high_min_inclusive: 0.65,
  extreme_min_inclusive: 0.85,
});

/**
 * BOS scores are mean, support-adjusted evidence weights.
 *
 * A positive value means the submitted choices support expression of the
 * dimension. A negative value means inverse/antagonistic evidence is stronger.
 * Zero is neutral net evidence when evidence_count > 0 and no evidence when
 * evidence_count === 0. Missing evidence must never be inferred from score alone.
 *
 * The topology is intentionally not clamped: question metadata is the source of
 * mathematical bounds, and future metadata can extend those bounds without
 * changing the score's meaning.
 */
export function classifyTopologyScore(score, evidenceCount = 1) {
  const value = Number(score);
  const count = Number(evidenceCount);

  if (!Number.isFinite(value)) return 'invalid';
  if (!Number.isFinite(count) || count <= 0) return 'no_evidence';
  if (value < 0) return 'inverse';
  if (value < BOS_TOPOLOGY_BANDS.low_max_exclusive) return 'low';
  if (value < BOS_TOPOLOGY_BANDS.high_min_inclusive) return 'moderate';
  if (value < BOS_TOPOLOGY_BANDS.extreme_min_inclusive) return 'high';
  return 'extreme';
}

export function isLowTopologyScore(score, evidenceCount = 1) {
  return Number(evidenceCount) > 0
    && Number.isFinite(Number(score))
    && Number(score) < BOS_TOPOLOGY_BANDS.low_max_exclusive;
}

export function isHighTopologyScore(score, evidenceCount = 1) {
  return Number(evidenceCount) > 0
    && Number.isFinite(Number(score))
    && Number(score) >= BOS_TOPOLOGY_BANDS.high_min_inclusive;
}

export function isExtremeTopologyScore(score, evidenceCount = 1) {
  return Number(evidenceCount) > 0
    && Number.isFinite(Number(score))
    && Number(score) >= BOS_TOPOLOGY_BANDS.extreme_min_inclusive;
}

export function topologyScoreToPercent(score) {
  const value = Number(score);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

export function topologyThreshold(legacyTenPointThreshold) {
  const value = Number(legacyTenPointThreshold);
  if (!Number.isFinite(value)) {
    throw new TypeError('legacy topology threshold must be finite');
  }
  return value / 10;
}
