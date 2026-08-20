import {
  FUTURE_ROLES,
  NORMALIZATION_VERSION,
  SUPPORT_COMPONENTS,
  SUPPORT_SEMANTICS,
  WEIGHTING_MODEL_VERSION,
} from './constants.js';
import { integrity } from './errors.js';

const componentById = new Map(SUPPORT_COMPONENTS.map((component) => [component.component_id, component]));

function valueFor(componentId, level) {
  const component = componentById.get(componentId);
  integrity(component, 'MALFORMED_FUTURE_OBJECT', `Unknown support component ${componentId}`);
  integrity(Object.hasOwn(component.levels, level), 'MALFORMED_FUTURE_OBJECT', `Invalid ${componentId} level ${level}`);
  return component.levels[level];
}

export function computeRawRelativeSupport(supportSignals) {
  integrity(supportSignals && typeof supportSignals === 'object', 'MALFORMED_FUTURE_OBJECT', 'support_signals object is required');
  const contributions = SUPPORT_COMPONENTS.map((component) => {
    const level = supportSignals[component.component_id];
    return {
      component_id: component.component_id,
      level,
      contribution: valueFor(component.component_id, level),
      meaning: component.meaning,
    };
  });
  return Object.freeze({
    raw_relative_support_score: contributions.reduce((sum, component) => sum + component.contribution, 0),
    support_components: contributions,
    weighting_model_version: WEIGHTING_MODEL_VERSION,
  });
}

export function normalizeRelativeSupport(rawScores) {
  integrity(Array.isArray(rawScores) && rawScores.length === FUTURE_ROLES.length, 'NORMALIZATION_FAILURE', 'Exactly five raw support scores are required');
  rawScores.forEach((score) => integrity(Number.isInteger(score) && score >= 0, 'NORMALIZATION_FAILURE', 'Raw support scores must be nonnegative integers'));
  const total = rawScores.reduce((sum, score) => sum + score, 0);
  const effectiveScores = total === 0 ? rawScores.map(() => 1) : rawScores;
  const effectiveTotal = effectiveScores.reduce((sum, score) => sum + score, 0);
  const exact = effectiveScores.map((score) => (score * 100) / effectiveTotal);
  const weights = exact.map(Math.floor);
  let remainder = 100 - weights.reduce((sum, value) => sum + value, 0);
  const allocationOrder = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let cursor = 0; remainder > 0; cursor += 1, remainder -= 1) {
    weights[allocationOrder[cursor % allocationOrder.length].index] += 1;
  }
  integrity(weights.reduce((sum, value) => sum + value, 0) === 100, 'NORMALIZATION_FAILURE', 'Normalized support must total exactly 100');
  return Object.freeze({
    normalized_relative_support_weights: weights,
    normalization_version: NORMALIZATION_VERSION,
    normalization_method: 'LARGEST_REMAINDER_EXACT_100',
    tie_break: 'FIXED_FUTURE_ROLE_ORDER',
    zero_total_fallback: total === 0 ? 'EQUAL_BASE_SUPPORT' : null,
    support_semantics: SUPPORT_SEMANTICS,
  });
}

export function applyDeterministicRelativeSupport(unweightedFutures) {
  integrity(Array.isArray(unweightedFutures) && unweightedFutures.length === FUTURE_ROLES.length, 'MALFORMED_FUTURE_OBJECT', 'Exactly five unweighted futures are required');
  const computations = unweightedFutures.map((future) => computeRawRelativeSupport(future.support_signals));
  const normalization = normalizeRelativeSupport(computations.map((item) => item.raw_relative_support_score));
  const futures = unweightedFutures.map((future, index) => {
    const { support_signals: omittedSupportSignals, ...structuredFuture } = future;
    void omittedSupportSignals;
    return Object.freeze({
      ...structuredFuture,
      raw_relative_support_score: computations[index].raw_relative_support_score,
      normalized_relative_support_weight: normalization.normalized_relative_support_weights[index],
      support_components: computations[index].support_components,
      weighting_model_version: WEIGHTING_MODEL_VERSION,
      support_semantics: SUPPORT_SEMANTICS,
    });
  });
  return Object.freeze({ futures, normalization });
}
