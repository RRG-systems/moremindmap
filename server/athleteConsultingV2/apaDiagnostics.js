// Closed, content-free diagnostic vocabulary. Never retain arbitrary exception
// prose, provider text, entity IDs or athlete answers in a failure receipt.
const codes = new Set([
  'CURRENT_APA_SUPERSEDED_SOURCE_STILL_ACTIVE', 'CURRENT_APA_SYNTHETIC_ONLY',
  'CURRENT_APA_CONFIRMATION_INVALID', 'CURRENT_APA_IDENTITY_MISMATCH',
  'CURRENT_APA_ARTIFACT_TAMPERED', 'CURRENT_APA_SOURCES_CHANGED',
  'CURRENT_APA_REPORT_SCHEMA_INVALID', 'CURRENT_APA_MOVE_SELECTION_CHANGED',
  'CURRENT_APA_RECORD_INVALID', 'CURRENT_APA_RECEIPT_TAMPERED',
  'CURRENT_APA_ATHLETE_CONFIRMATION_REQUIRED', 'CURRENT_APA_CORRECTION_LINEAGE_INVALID',
  'CURRENT_APA_CHANGE_ALREADY_PUBLISHED', 'CURRENT_APA_UNCITED_FIELD_CHANGED',
  'CURRENT_APA_CHANGE_NOT_SOURCE_BOUND', 'CURRENT_APA_SOURCE_REFERENCES_CHANGED',
  'CURRENT_APA_STRUCTURE_CHANGED', 'CURRENT_APA_STALE_VERSION',
  'CURRENT_APA_REVISION_LIMIT', 'CURRENT_APA_CANDIDATE_INVALID',
  'CURRENT_APA_COACH_VIEW_UNVERIFIED',
  'APA_COMPOSITION_MESSAGE_INVALID', 'APA_COMPOSITION_PACKET_TOO_LARGE',
  'APA_COMPOSITION_REQUEST_FAILED', 'APA_COMPOSITION_PRIVATE_EVIDENCE_SINK_REQUIRED',
  'APA_COMPOSITION_TRANSPORT_INVALID', 'APA_COMPOSITION_CONNECTION_UNAVAILABLE',
  'APA_COMPOSITION_EVIDENCE_UNAVAILABLE', 'APA_COMPOSITION_RESPONSE_INCOMPLETE',
  'APA_COMPOSITION_MODEL_MISMATCH', 'APA_COMPOSITION_RESPONSE_INVALID',
  'APA_COMPOSITION_CANDIDATE_INVALID', 'APA_COMPOSITION_COACH_VIEW_CHANGED',
  'UNRESOLVED_SOURCE_REFERENCE', 'FOUR_DISTINCT_DOMAINS_REQUIRED',
  'ATHLETE_GOAL_CHANGED', 'DOMAIN_INCOMPLETE', 'FIRST_LAYER_TOO_LONG',
  'FIVE_FUTURE_ROLES_REQUIRED', 'FUTURE_INCOMPLETE', 'FUTURE_HEADLINE_TOO_LONG',
  'COMPARE_DISTINCT_MOVES', 'EXPLICIT_REVIEW_STAGES_REQUIRED', 'MOVE_TOO_COMPLEX',
  'FIVE_YOUTH_GATES_REQUIRED', 'INVALID_SELECTION_SIGNAL',
  'INVENTED_COACH_RESPONSE', 'CUSTOMER_LANGUAGE_OR_ODDS_FAILURE', 'INVALID_CONTENT',
  'APA_DELTA_SYNTHETIC_ONLY', 'APA_DELTA_PRIOR_INVALID',
  'APA_DELTA_CONFIRMED_SOURCE_INVALID', 'APA_DELTA_CORRECTION_LINEAGE_INVALID',
  'APA_DELTA_COACH_CORRECTION_CONFLICT', 'APA_DELTA_SOURCE_REFERENCES_CHANGED',
  'APA_DELTA_CHANGE_NOT_SOURCE_BOUND', 'APA_DELTA_TARGET_INVALID',
  'APA_DELTA_TARGET_ORDER_INVALID', 'APA_DELTA_GATE_STRUCTURE_CHANGED',
  'APA_DELTA_SCHEMA_INVALID', 'APA_DELTA_BINDING_MISMATCH',
  'APA_DELTA_CORRECTION_DEPENDENCY_OMITTED',
  'APA_NARRATIVE_PROVENANCE_INVALID', 'APA_NARRATIVE_UPDATE_INVALID',
  'APA_NARRATIVE_VALUE_MISMATCH', 'APA_NARRATIVE_SOURCE_INVALID',
  'APA_NARRATIVE_SOURCE_TEXT_REQUIRED',
  'APA_NARRATIVE_SOURCE_REFERENCES_CHANGED', 'APA_NARRATIVE_CORRECTION_REVIEW_REQUIRED',
]);
const stages = new Set(['source_preflight', 'request_evidence', 'provider',
  'response_evidence', 'delta_schema', 'reconstruction', 'candidate_schema',
  'coach_view', 'publication_dry_run', 'receipt_evidence']);
const roots = new Set(['confirmation', 'report', 'delta', 'binding', 'record', 'sources', 'prior',
  'narrative_updates', 'narrative_provenance']);
const fields = new Set(['goals', 'sport', 'training', 'mindset', 'school',
  'priority', 'assessment_date', 'review_date', 'horizon_date', 'confirmed',
  'headline', 'opening', 'domains', 'connection', 'main_obstacle', 'what_we_dont_know',
  'coach_view', 'status', 'summary', 'refs', 'bos_refs', 'futures', 'candidates',
  'id', 'goal', 'strength', 'gap', 'help', 'bos_connection', 'detail', 'unknowns',
  'role', 'what', 'conditions', 'first_sign', 'details', 'sufficient_evidence',
  'candidate_id', 'domain', 'action', 'why', 'when', 'who', 'action_signal',
  'progress_signal', 'review', 'review_schedule', 'purpose', 'setup_check',
  'progress_check', 'stop_or_change', 'bos_fit', 'selection_signals', 'gates',
  'pass', 'reason', 'contract', 'synthetic', 'athlete_slug', 'mm', 'bos_sha256',
  'baseline_apa_sha256', 'current_apa_sha256', 'current_apa_version', 'source_id',
  'source_message_id', 'sources', 'report', 'move', 'artifact', 'version',
  'fields', 'field', 'value', 'value_sha256']);

export function safeApaValidatorPath(value) {
  if (typeof value !== 'string' || value.length > 200) return null;
  const parts = value.split('.');
  if (parts.length > 10 || !roots.has(parts[0])) return null;
  return parts.slice(1).every(part => fields.has(part) || /^(?:0|[1-9]\d?)$/u.test(part))
    ? value : null;
}

export function apaValidatorDiagnostic(error, { stage, path = null } = {}) {
  const code = typeof error?.message === 'string' && codes.has(error.message)
    ? error.message : null;
  return {
    validator_code: code,
    // Unknown errors have no trusted structural location, even if they supply
    // an apparently valid property path.
    validator_path: code ? safeApaValidatorPath(path ?? error?.validation_path) : null,
    stage: stages.has(stage) ? stage : null,
  };
}
