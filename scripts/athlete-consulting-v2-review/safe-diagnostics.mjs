// Content-free internal rule receipts; never serialize exception messages or
// provider bodies into the loopback QA log.
const internalCode = /^(?:ATHLETE_VISUAL|APA_COMPOSITION|CURRENT_APA|COACH|ATHLETE_QA)_[A-Z_]{1,120}$/u;
const stages = new Set(['knowledge_retrieval', 'request_evidence', 'provider',
  'response_evidence', 'receipt_evidence']);
export function safeDiagnostics(event) {
  if (event?.kind !== 'failure') return {};
  return {
    code: internalCode.test(event.code || '') ? event.code : null,
    stage: stages.has(event.stage) ? event.stage : null,
    http_status: Number.isInteger(event.http_status) && event.http_status >= 100
      && event.http_status <= 599 ? event.http_status : null,
    validation_errors: Array.isArray(event.validation_errors)
      ? [...new Set(event.validation_errors.filter(code => typeof code === 'string'
        && /^ATHLETE_VISUAL_[A-Z_]{1,120}$/u.test(code)))].slice(0, 40) : [],
  };
}
