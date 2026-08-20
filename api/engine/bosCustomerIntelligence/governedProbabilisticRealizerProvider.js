import { GOVERNED_PROBABILISTIC_PRICING } from '../../../src/lib/bosCustomerIntelligence/governedProbabilisticContracts.js';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

export function providerUsage(response) {
  const usage = response?.usage || {};
  return deepFreeze({
    input_tokens: Number(usage.input_tokens) || 0,
    cached_input_tokens: Number(usage.input_tokens_details?.cached_tokens) || 0,
    cache_write_tokens: Number(usage.input_tokens_details?.cache_write_tokens) || 0,
    output_tokens: Number(usage.output_tokens) || 0,
    reasoning_tokens: Number(usage.output_tokens_details?.reasoning_tokens) || 0,
  });
}

export function estimateProviderCost(usage, pricing = GOVERNED_PROBABILISTIC_PRICING) {
  const cached = Math.min(usage.input_tokens, usage.cached_input_tokens);
  const written = Math.min(Math.max(0, usage.input_tokens - cached), usage.cache_write_tokens);
  const uncached = Math.max(0, usage.input_tokens - cached - written);
  const rates = pricing.per_million_tokens;
  return Number((
    (uncached * rates.input)
    + (cached * rates.cached_input)
    + (written * rates.cache_write)
    + (usage.output_tokens * rates.output)
  ).toFixed(8)) / 1_000_000;
}
