import { hashCanonicalJson } from '../hashing.js';
import { deepFreeze } from '../validation.js';

export const FUTURE_PROBABILITY_POLICY_VERSION = 'future-probability-reference-v1';
export const FUTURE_CALIBRATION_STATUS = 'DETERMINISTIC_REFERENCE_NOT_CALIBRATED';

function finiteNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function normalizeFutureSupport(entries, { suspended_policy = 'ZERO_AND_REDISTRIBUTE' } = {}) {
  if (!Array.isArray(entries) || entries.length !== 5) return deepFreeze({ ok: false, code: 'EXACTLY_FIVE_FUTURES_REQUIRED' });
  if (entries.some((entry) => !entry?.stable_future_identity || !finiteNonNegative(entry.raw_support))) {
    return deepFreeze({ ok: false, code: 'INVALID_RAW_SUPPORT' });
  }
  if (new Set(entries.map((entry) => entry.stable_future_identity)).size !== 5) return deepFreeze({ ok: false, code: 'DUPLICATE_FUTURE_IDENTITY' });
  const adjusted = entries.map((entry) => ({ ...entry,
    adjusted_support: entry.suspended && suspended_policy === 'ZERO_AND_REDISTRIBUTE' ? 0 : entry.raw_support }));
  const total = adjusted.reduce((sum, entry) => sum + entry.adjusted_support, 0);
  const weights = total === 0 ? adjusted.map((entry) => entry.suspended ? 0 : 1) : adjusted.map((entry) => entry.adjusted_support);
  const denominator = weights.reduce((sum, value) => sum + value, 0);
  if (denominator === 0) return deepFreeze({ ok: false, code: 'ALL_FUTURES_SUSPENDED' });
  const probabilities = weights.map((value) => value / denominator);
  probabilities[probabilities.length - 1] = 1 - probabilities.slice(0, -1).reduce((sum, value) => sum + value, 0);
  const vector = adjusted.map((entry, index) => ({ ...entry, probability: probabilities[index] }));
  const receipt = { receipt_id: `prob_${hashCanonicalJson({ vector, suspended_policy }).slice(0, 20)}`,
    policy_version: FUTURE_PROBABILITY_POLICY_VERSION, calibration_status: FUTURE_CALIBRATION_STATUS,
    suspended_policy, raw_support: entries.map(({ stable_future_identity, raw_support }) => ({ stable_future_identity, raw_support })),
    normalization_denominator: denominator, probability_sum: probabilities.reduce((sum, value) => sum + value, 0) };
  return deepFreeze({ ok: true, vector, receipt });
}

export function probabilityConfidence({ support_count = 0, contradiction_count = 0, missing_count = 0, stale_context = false } = {}) {
  const score = Math.max(0, Math.min(1, .2 + Math.min(support_count, 5) * .12 - Math.min(contradiction_count, 4) * .1 - Math.min(missing_count, 5) * .08 - (stale_context ? .2 : 0)));
  return deepFreeze({ score, level: score >= .7 ? 'HIGH' : score >= .4 ? 'MODERATE' : 'LOW',
    dimensions: { support_count, contradiction_count, missing_count, stale_context }, calibration_status: FUTURE_CALIBRATION_STATUS });
}

export function describeProbabilityChange(previous, next, { materiality = .005, reasons = [], contradictions = [], stale_context = false } = {}) {
  const delta = next - previous;
  return deepFreeze({ from_probability: previous, to_probability: next, delta,
    changed: Math.abs(delta) >= materiality,
    reason: Math.abs(delta) >= materiality ? (reasons.length ? reasons : ['SUPPORT_REDISTRIBUTED']) : ['NO_MATERIAL_EVIDENCE_CHANGE'],
    contradictions, stale_context, policy_version: FUTURE_PROBABILITY_POLICY_VERSION });
}
