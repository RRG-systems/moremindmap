// Content-free internal rule receipts; never serialize exception messages or
// provider bodies into the loopback QA log.
import { apaValidatorDiagnostic } from '../../server/athleteConsultingV2/apaDiagnostics.js';
const internalCode = /^(?:ATHLETE_VISUAL|APA_COMPOSITION|CURRENT_APA|COACH|ATHLETE_QA)_[A-Z_]{1,120}$/u;
const stages = new Set(['knowledge_retrieval', 'request_evidence', 'provider',
  'response_evidence', 'receipt_evidence', 'source_preflight', 'delta_schema',
  'reconstruction', 'candidate_schema', 'coach_view', 'publication_dry_run']);
export function safeDiagnostics(event) {
  if (event?.kind !== 'failure') return {};
  const apa = apaValidatorDiagnostic({ message: event.validator_code,
    validation_path: event.validator_path }, { stage: event.stage });
  return {
    code: typeof event.code === 'string' && internalCode.test(event.code) ? event.code : null,
    stage: stages.has(event.stage) ? event.stage : null,
    http_status: Number.isInteger(event.http_status) && event.http_status >= 100
      && event.http_status <= 599 ? event.http_status : null,
    validation_errors: Array.isArray(event.validation_errors)
      ? [...new Set(event.validation_errors.filter(code => typeof code === 'string'
        && /^ATHLETE_VISUAL_[A-Z_]{1,120}$/u.test(code)))].slice(0, 40) : [],
    ...(Object.hasOwn(event, 'validator_code') || Object.hasOwn(event, 'validator_path')
      ? { validator_code: apa.validator_code, validator_path: apa.validator_path } : {}),
  };
}

// Preserve bounded composition accounting without the request or model text.
// No unconstrained strings or nested receipt objects are copied.
export function safeApaMetadata(event) {
  const basis = event?.basis || event?.receipt;
  if (typeof basis?.delta_binding_sha256 !== 'string'
    || !/^[a-f0-9]{64}$/u.test(basis.delta_binding_sha256)) return {};
  const values = { ...basis, ...event?.receipt, ...event };
  const apa = {};
  for (const key of ['baseline_apa', 'current_apa', 'bos', 'delta_binding_sha256',
    'packet_sha256', 'request_sha256', 'before_sha256', 'after_sha256', 'delta_sha256',
    'reconstructed_candidate_sha256', 'reconstruction_receipt_sha256',
    'candidate_sha256', 'preview_content_hash']) {
    if (typeof values[key] === 'string' && /^[a-f0-9]{64}$/u.test(values[key])) apa[key] = values[key];
  }
  for (const key of ['input_chars', 'input_bytes', 'output_chars', 'output_bytes']) {
    if (Number.isSafeInteger(values[key]) && values[key] >= 0 && values[key] <= 10000000) apa[key] = values[key];
  }
  if (Number.isSafeInteger(values.current_version) && values.current_version >= 0
    && values.current_version <= 24) apa.current_version = values.current_version;
  if (['nia', 'sofia'].includes(values.athlete_slug)) apa.athlete_slug = values.athlete_slug;
  if (typeof values.source_id === 'string'
    && /^APA:CURRENT:[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u.test(values.source_id)) apa.source_id = values.source_id;
  if (typeof values.source_message_id === 'string'
    && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u.test(values.source_message_id)) apa.source_message_id = values.source_message_id;
  if (typeof values.changed === 'boolean') apa.changed = values.changed;
  if (values.publication_performed === false) apa.publication_performed = false;
  return { apa };
}
