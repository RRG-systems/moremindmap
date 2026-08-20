const CUSTOMER_FUTURE_TEXT = Object.freeze([
  ['MORE estimates the probability of five possible Futures based on everything currently understood about your business.', 'MORE compares the relative support for five possible Futures from the accepted business evidence.'],
  ['Current Odds', 'Current relative support'],
  ['Total probability', 'Total relative support'],
  ['Probabilities always sum to 100%. Confidence reflects the quality and completeness of accepted evidence.', 'Relative-support weights are normalized to exactly 100. They are not probabilities. Confidence reflects the quality and completeness of accepted evidence.'],
  ['Probability', 'Relative support'],
]);

export function rewriteNewBaCustomerFutureText(value) {
  return CUSTOMER_FUTURE_TEXT.reduce((current, [from, to]) => current.replaceAll(from, to), String(value));
}

export function normalizeNewBaRelativeSupportCustomerLanguage(viewModel) {
  const normalized = structuredClone(viewModel);
  const futures = normalized.destinations?.futures;
  if (futures) {
    futures.subhead = rewriteNewBaCustomerFutureText(futures.subhead);
    futures.probabilitySemantics = 'Deterministically normalized relative support across five conditional trajectories; not calibrated probability.';
  }
  return normalized;
}
