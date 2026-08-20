/** Restored pricing authority used by the frozen provider accounting receipts. */
export const GOVERNED_PROBABILISTIC_PRICING = Object.freeze({
  model: 'gpt-5.6-sol',
  observed_at: '2026-08-06',
  source: 'https://developers.openai.com/api/docs/models/gpt-5.6-sol',
  currency: 'USD',
  per_million_tokens: Object.freeze({
    input: 5,
    cached_input: 0.5,
    cache_write: 6.25,
    output: 30,
  }),
});
