import { hashCanonicalJson } from '../intelligenceFabric/hashing.js';
import { deepFreeze } from '../intelligenceFabric/validation.js';
import {
  ACTOR_TYPES,
  COACHING_PURPOSES,
  CUSTOMER_LENSES,
  ENTITLEMENT_STATES,
  MEMBERSHIP_ROLES,
  MEMBERSHIP_STATUSES,
  OUTCOME_DIRECTIONS,
  RSL_EVENT_TYPES,
  SESSION_CLASSES,
  SESSION_STATES,
  SOURCE_CLASSES,
  SUBJECT_STATUSES,
  SUBSCRIPTION_V1_CONTRACT_VERSIONS,
} from './constants.js';

const HASH_256 = /^[a-f0-9]{64}$/;
const SEMVER = /^\d+\.\d+\.\d+$/;
const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const isString = (value, min = 1, max = 512) => typeof value === 'string' && value.length >= min && value.length <= max;
const isTimestamp = (value) => isString(value, 20, 40) && Number.isFinite(Date.parse(value));
const isHash = (value) => typeof value === 'string' && HASH_256.test(value);
const uniqueStrings = (value, max = 80) => Array.isArray(value) && value.length <= max
  && value.every((entry) => isString(entry)) && new Set(value).size === value.length;
const exactKeys = (value, allowed) => isObject(value) && Object.keys(value).every((key) => allowed.includes(key));

const BUSINESS_SCOPE_KEYS = Object.freeze(['subject_id', 'membership_id', 'tenant_id', 'profile_id', 'business_id']);
const ATHLETE_SCOPE_KEYS = Object.freeze(['domain', 'subject_id', 'membership_id', 'tenant_id', 'profile_id', 'athlete_relationship_id']);

function scopeKeys(scope) {
  return scope?.domain === 'ATHLETE' ? ATHLETE_SCOPE_KEYS : BUSINESS_SCOPE_KEYS;
}

function validateScope(scope, path, errors) {
  const keys = scopeKeys(scope);
  if (!exactKeys(scope, keys)) errors.push({ code: 'SCOPE_FIELDS_INVALID', path });
  if (scope?.domain != null && scope.domain !== 'ATHLETE') errors.push({ code: 'SCOPE_DOMAIN_INVALID', path: `${path}.domain` });
  for (const key of keys.filter((item) => item !== 'domain')) {
    if (!isString(scope?.[key], key === 'tenant_id' ? 3 : 8, 128)) errors.push({ code: 'SCOPE_VALUE_INVALID', path: `${path}.${key}` });
  }
}

function validateAuthority(authority, path, errors) {
  if (!exactKeys(authority, ['authority_id', 'authority_version', 'authority_hash'])) errors.push({ code: 'AUTHORITY_FIELDS_INVALID', path });
  if (!isString(authority?.authority_id, 3, 160)) errors.push({ code: 'AUTHORITY_ID_INVALID', path: `${path}.authority_id` });
  if (!isString(authority?.authority_version, 1, 80)) errors.push({ code: 'AUTHORITY_VERSION_INVALID', path: `${path}.authority_version` });
  if (!isHash(authority?.authority_hash)) errors.push({ code: 'AUTHORITY_HASH_INVALID', path: `${path}.authority_hash` });
}

function validateEvidenceRef(reference, path, errors) {
  const domains = ['BUSINESS', 'WHOLE_PERSON_EXECUTION', 'ATHLETE_BOS', 'ATHLETE_APA', 'ATHLETE_SHARED_CONTEXT', 'ATHLETE_CURRENT_REALITY', 'PERSONAL_RSL', 'UNIVERSAL_RSL', 'EXTERNAL', 'SYSTEM'];
  const certainty = ['KNOWN', 'OBSERVED', 'INFERRED', 'MODELED', 'UNCERTAIN', 'MISSING', 'CONTRADICTED'];
  if (!exactKeys(reference, ['evidence_id', 'evidence_domain', 'content_hash', 'certainty'])) errors.push({ code: 'EVIDENCE_FIELDS_INVALID', path });
  if (!isString(reference?.evidence_id, 3, 160)) errors.push({ code: 'EVIDENCE_ID_INVALID', path: `${path}.evidence_id` });
  if (!domains.includes(reference?.evidence_domain)) errors.push({ code: 'EVIDENCE_DOMAIN_INVALID', path: `${path}.evidence_domain` });
  if (!isHash(reference?.content_hash)) errors.push({ code: 'EVIDENCE_HASH_INVALID', path: `${path}.content_hash` });
  if (!certainty.includes(reference?.certainty)) errors.push({ code: 'EVIDENCE_CERTAINTY_INVALID', path: `${path}.certainty` });
}

function validateHeader(value, contractId, errors) {
  if (!isObject(value)) {
    errors.push({ code: 'CONTRACT_OBJECT_REQUIRED', path: '$' });
    return;
  }
  if (value.contract_id !== contractId) errors.push({ code: 'CONTRACT_ID_INVALID', path: '$.contract_id' });
  if (value.schema_version !== SUBSCRIPTION_V1_CONTRACT_VERSIONS[contractId] || !SEMVER.test(value.schema_version || '')) {
    errors.push({ code: 'CONTRACT_VERSION_INCOMPATIBLE', path: '$.schema_version' });
  }
}

function validateAllowedKeys(value, allowed, errors) {
  if (isObject(value)) {
    for (const key of Object.keys(value)) if (!allowed.includes(key)) errors.push({ code: 'ADDITIONAL_PROPERTY_DENIED', path: `$.${key}` });
  }
}

function finalize(errors) {
  return deepFreeze({ valid: errors.length === 0, errors });
}

function validateSubject(value) {
  const errors = [];
  validateHeader(value, 'canonical_customer_subject', errors);
  validateAllowedKeys(value, ['contract_id', 'schema_version', 'subject_id', 'status', 'auth_bindings', 'created_at', 'updated_at', 'authority'], errors);
  if (!SUBJECT_STATUSES.includes(value?.status)) errors.push({ code: 'SUBJECT_STATUS_INVALID', path: '$.status' });
  if (!isString(value?.subject_id, 8, 128)) errors.push({ code: 'SUBJECT_ID_INVALID', path: '$.subject_id' });
  if (!Array.isArray(value?.auth_bindings) || value.auth_bindings.length < 1 || value.auth_bindings.length > 8) errors.push({ code: 'AUTH_BINDINGS_INVALID', path: '$.auth_bindings' });
  for (const [index, binding] of (value?.auth_bindings || []).entries()) {
    if (!exactKeys(binding, ['issuer', 'provider_subject_hash', 'status', 'bound_at', 'revoked_at'])) errors.push({ code: 'AUTH_BINDING_FIELDS_INVALID', path: `$.auth_bindings[${index}]` });
    if (!isString(binding?.issuer, 3, 200) || !isHash(binding?.provider_subject_hash)
      || !['ACTIVE', 'REVOKED'].includes(binding?.status) || !isTimestamp(binding?.bound_at)
      || (binding?.revoked_at != null && !isTimestamp(binding.revoked_at))) errors.push({ code: 'AUTH_BINDING_INVALID', path: `$.auth_bindings[${index}]` });
  }
  if (!isTimestamp(value?.created_at) || !isTimestamp(value?.updated_at)) errors.push({ code: 'SUBJECT_TIMESTAMPS_INVALID', path: '$' });
  validateAuthority(value?.authority, '$.authority', errors);
  return finalize(errors);
}

function validateMembership(value) {
  const errors = [];
  validateHeader(value, 'business_membership', errors);
  validateAllowedKeys(value, ['contract_id', 'schema_version', 'membership_id', 'subject_id', 'tenant_id', 'profile_id', 'business_id', 'role', 'status', 'created_at', 'ended_at', 'authority'], errors);
  for (const [key, min] of [['membership_id', 8], ['subject_id', 8], ['tenant_id', 3], ['profile_id', 8], ['business_id', 8]]) {
    if (!isString(value?.[key], min, 128)) errors.push({ code: 'MEMBERSHIP_IDENTITY_INVALID', path: `$.${key}` });
  }
  if (!MEMBERSHIP_ROLES.includes(value?.role)) errors.push({ code: 'MEMBERSHIP_ROLE_INVALID', path: '$.role' });
  if (!MEMBERSHIP_STATUSES.includes(value?.status)) errors.push({ code: 'MEMBERSHIP_STATUS_INVALID', path: '$.status' });
  if (!isTimestamp(value?.created_at) || (value?.ended_at != null && !isTimestamp(value.ended_at))) errors.push({ code: 'MEMBERSHIP_TIMESTAMPS_INVALID', path: '$' });
  validateAuthority(value?.authority, '$.authority', errors);
  return finalize(errors);
}

function validateEntitlement(value) {
  const errors = [];
  validateHeader(value, 'paid_entitlement', errors);
  validateAllowedKeys(value, ['contract_id', 'schema_version', 'entitlement_id', 'scope', 'stripe_customer_hash', 'stripe_subscription_hash', 'state', 'billing_cycle_start', 'billing_cycle_end', 'access_ends_at', 'source_event_ids', 'projected_at', 'policy_version'], errors);
  validateScope(value?.scope, '$.scope', errors);
  if (!isString(value?.entitlement_id, 8, 128)) errors.push({ code: 'ENTITLEMENT_ID_INVALID', path: '$.entitlement_id' });
  if (!isHash(value?.stripe_customer_hash) || !isHash(value?.stripe_subscription_hash)) errors.push({ code: 'STRIPE_REFERENCE_HASH_INVALID', path: '$' });
  if (!ENTITLEMENT_STATES.includes(value?.state)) errors.push({ code: 'ENTITLEMENT_STATE_INVALID', path: '$.state' });
  if (!isTimestamp(value?.billing_cycle_start) || !isTimestamp(value?.billing_cycle_end)
    || (value?.access_ends_at != null && !isTimestamp(value.access_ends_at)) || !isTimestamp(value?.projected_at)) errors.push({ code: 'ENTITLEMENT_TIMESTAMPS_INVALID', path: '$' });
  if (!uniqueStrings(value?.source_event_ids) || value.source_event_ids.length < 1) errors.push({ code: 'ENTITLEMENT_SOURCES_INVALID', path: '$.source_event_ids' });
  if (!isString(value?.policy_version, 1, 100)) errors.push({ code: 'ENTITLEMENT_POLICY_INVALID', path: '$.policy_version' });
  return finalize(errors);
}

function validateLedger(value) {
  const errors = [];
  validateHeader(value, 'session_allowance_ledger', errors);
  validateAllowedKeys(value, ['contract_id', 'schema_version', 'ledger_id', 'scope', 'entitlement_id', 'billing_cycle_start', 'billing_cycle_end', 'standard_slots_total', 'standard_slots_consumed', 'standard_slots_reserved', 'standard_slots_available', 'onboarding_consumed', 'ledger_version', 'ledger_hash', 'last_transition_id'], errors);
  validateScope(value?.scope, '$.scope', errors);
  for (const key of ['ledger_id', 'entitlement_id', 'billing_cycle_start', 'billing_cycle_end']) if (!isString(value?.[key], 3, 160)) errors.push({ code: 'LEDGER_IDENTITY_INVALID', path: `$.${key}` });
  for (const key of ['standard_slots_total', 'standard_slots_consumed', 'standard_slots_reserved', 'standard_slots_available', 'ledger_version']) if (!Number.isInteger(value?.[key]) || value[key] < 0) errors.push({ code: 'LEDGER_COUNT_INVALID', path: `$.${key}` });
  if (value?.standard_slots_available !== value?.standard_slots_total - value?.standard_slots_consumed - value?.standard_slots_reserved) errors.push({ code: 'LEDGER_ARITHMETIC_INVALID', path: '$.standard_slots_available' });
  if (typeof value?.onboarding_consumed !== 'boolean' || !isHash(value?.ledger_hash)) errors.push({ code: 'LEDGER_STATE_INVALID', path: '$' });
  if (isObject(value)) { const unsigned = { ...value }; delete unsigned.ledger_hash; if (value.ledger_hash !== hashCanonicalJson(unsigned)) errors.push({ code: 'LEDGER_HASH_INVALID', path: '$.ledger_hash' }); }
  return finalize(errors);
}

function validateSession(value) {
  const errors = [];
  validateHeader(value, 'active_coaching_session', errors);
  validateAllowedKeys(value, ['contract_id', 'schema_version', 'session_id', 'scope', 'ledger_id', 'session_class', 'state', 'idempotency_key_hash', 'timing_policy_ref', 'reserved_at', 'reservation_expires_at', 'activated_at', 'grace_expires_at', 'hard_expires_at', 'ended_at', 'cumulative_active_seconds', 'charge_point_reached', 'first_valid_response_hash', 'state_version'], errors);
  validateScope(value?.scope, '$.scope', errors);
  if (!isString(value?.session_id, 8, 128) || !isString(value?.ledger_id, 8, 128)) errors.push({ code: 'SESSION_IDENTITY_INVALID', path: '$' });
  if (!SESSION_CLASSES.includes(value?.session_class) || !SESSION_STATES.includes(value?.state)) errors.push({ code: 'SESSION_STATE_INVALID', path: '$' });
  if (!isHash(value?.idempotency_key_hash) || !isString(value?.timing_policy_ref, 3, 160)) errors.push({ code: 'SESSION_POLICY_OR_IDEMPOTENCY_INVALID', path: '$' });
  for (const key of ['reserved_at', 'reservation_expires_at']) if (!isTimestamp(value?.[key])) errors.push({ code: 'SESSION_TIMESTAMP_INVALID', path: `$.${key}` });
  for (const key of ['activated_at', 'grace_expires_at', 'hard_expires_at', 'ended_at']) if (value?.[key] != null && !isTimestamp(value[key])) errors.push({ code: 'SESSION_TIMESTAMP_INVALID', path: `$.${key}` });
  if (!Number.isInteger(value?.cumulative_active_seconds) || value.cumulative_active_seconds < 0 || typeof value?.charge_point_reached !== 'boolean' || !Number.isInteger(value?.state_version) || value.state_version < 1) errors.push({ code: 'SESSION_COUNTER_INVALID', path: '$' });
  if (value?.first_valid_response_hash != null && !isHash(value.first_valid_response_hash)) errors.push({ code: 'SESSION_RESPONSE_HASH_INVALID', path: '$.first_valid_response_hash' });
  return finalize(errors);
}

function validateRslEvent(value) {
  const errors = [];
  validateHeader(value, 'personal_rsl_event', errors);
  validateAllowedKeys(value, ['contract_id', 'schema_version', 'event_id', 'scope', 'session_id', 'event_type', 'effective_at', 'recorded_at', 'source_class', 'actor', 'establishing_authority', 'semantic_payload', 'evidence_refs', 'supersedes_event_ids', 'retracts_event_ids', 'confirmation_event_id', 'content_hash'], errors);
  validateScope(value?.scope, '$.scope', errors);
  if (!isString(value?.event_id, 8, 160) || (value?.session_id != null && !isString(value.session_id, 8, 160))) errors.push({ code: 'RSL_EVENT_IDENTITY_INVALID', path: '$' });
  if (!RSL_EVENT_TYPES.includes(value?.event_type)) errors.push({ code: 'RSL_EVENT_TYPE_INVALID', path: '$.event_type' });
  if (!isTimestamp(value?.effective_at) || !isTimestamp(value?.recorded_at)) errors.push({ code: 'RSL_EVENT_TIME_INVALID', path: '$' });
  if (!SOURCE_CLASSES.includes(value?.source_class) || !ACTOR_TYPES.includes(value?.actor?.actor_type) || !isString(value?.actor?.actor_ref, 3, 160)) errors.push({ code: 'RSL_PROVENANCE_INVALID', path: '$' });
  if (!exactKeys(value?.actor, ['actor_type', 'actor_ref'])) errors.push({ code: 'RSL_ACTOR_FIELDS_INVALID', path: '$.actor' });
  validateAuthority(value?.establishing_authority, '$.establishing_authority', errors);
  if (!isObject(value?.semantic_payload) || Object.keys(value.semantic_payload).length > 32) errors.push({ code: 'RSL_SEMANTIC_PAYLOAD_INVALID', path: '$.semantic_payload' });
  if (!Array.isArray(value?.evidence_refs) || value.evidence_refs.length > 32) errors.push({ code: 'RSL_EVIDENCE_REFS_INVALID', path: '$.evidence_refs' });
  for (const [index, ref] of (value?.evidence_refs || []).entries()) validateEvidenceRef(ref, `$.evidence_refs[${index}]`, errors);
  if (!uniqueStrings(value?.supersedes_event_ids, 16) || !uniqueStrings(value?.retracts_event_ids, 16)) errors.push({ code: 'RSL_REPLACEMENT_REFS_INVALID', path: '$' });
  if (value?.confirmation_event_id != null && !isString(value.confirmation_event_id, 3, 160)) errors.push({ code: 'RSL_CONFIRMATION_INVALID', path: '$.confirmation_event_id' });
  if (!isHash(value?.content_hash)) errors.push({ code: 'RSL_CONTENT_HASH_INVALID', path: '$.content_hash' });
  if (isObject(value)) { const unsigned = { ...value }; delete unsigned.content_hash; if (value.content_hash !== hashCanonicalJson(unsigned)) errors.push({ code: 'RSL_CONTENT_HASH_INVALID', path: '$.content_hash' }); }
  return finalize(errors);
}

function validateRslEnvelope(value) {
  const errors = [];
  validateHeader(value, 'personal_rsl_envelope', errors);
  validateAllowedKeys(value, ['contract_id', 'schema_version', 'envelope_id', 'scope_hash', 'sequence', 'event_id', 'event_hash', 'previous_envelope_hash', 'envelope_hash', 'appended_at', 'store_version'], errors);
  if (!isString(value?.envelope_id, 8, 160) || !isHash(value?.scope_hash) || !Number.isInteger(value?.sequence) || value.sequence < 1 || !isString(value?.event_id, 8, 160) || !isHash(value?.event_hash) || (value?.previous_envelope_hash != null && !isHash(value.previous_envelope_hash)) || !isHash(value?.envelope_hash) || !isTimestamp(value?.appended_at) || !isString(value?.store_version, 1, 80)) errors.push({ code: 'RSL_ENVELOPE_INVALID', path: '$' });
  if (isObject(value)) { const unsigned = { ...value }; delete unsigned.envelope_hash; if (value.envelope_hash !== hashCanonicalJson(unsigned)) errors.push({ code: 'RSL_ENVELOPE_HASH_INVALID', path: '$.envelope_hash' }); }
  return finalize(errors);
}

function validateRetrieval(value) {
  const errors = [];
  validateHeader(value, 'relevant_history_retrieval_result', errors);
  validateAllowedKeys(value, ['contract_id', 'schema_version', 'retrieval_id', 'scope', 'purpose', 'policy_version', 'ranking_method', 'scope_filter_applied_first', 'privacy_filter_applied_before_ranking', 'authority_filter_applied_before_ranking', 'future_ranking_methods_after_scope_filter', 'candidate_count', 'selected_event_ids', 'omitted_counts', 'token_estimate', 'retrieved_at', 'result_hash'], errors);
  validateScope(value?.scope, '$.scope', errors);
  if (!isString(value?.retrieval_id, 8, 160) || !isString(value?.purpose, 3, 100) || !isString(value?.policy_version, 1, 100) || !isString(value?.ranking_method, 3, 100)) errors.push({ code: 'RETRIEVAL_IDENTITY_INVALID', path: '$' });
  if (!Number.isInteger(value?.candidate_count) || value.candidate_count < 0 || !uniqueStrings(value?.selected_event_ids, 80) || !Number.isInteger(value?.token_estimate) || value.token_estimate < 0 || !isTimestamp(value?.retrieved_at) || !isHash(value?.result_hash)) errors.push({ code: 'RETRIEVAL_RESULT_INVALID', path: '$' });
  if (!isObject(value?.omitted_counts) || Object.values(value.omitted_counts).some((count) => !Number.isInteger(count) || count < 0)) errors.push({ code: 'RETRIEVAL_OMISSION_COUNTS_INVALID', path: '$.omitted_counts' });
  if (value?.scope_filter_applied_first !== true || value?.privacy_filter_applied_before_ranking !== true || value?.authority_filter_applied_before_ranking !== true || !uniqueStrings(value?.future_ranking_methods_after_scope_filter || [], 8)) errors.push({ code: 'RETRIEVAL_FILTER_ORDER_INVALID', path: '$' });
  if (isObject(value)) { const unsigned = { ...value }; delete unsigned.result_hash; if (value.result_hash !== hashCanonicalJson(unsigned)) errors.push({ code: 'RETRIEVAL_RESULT_HASH_INVALID', path: '$.result_hash' }); }
  return finalize(errors);
}

function validateLineage(value) {
  const errors = [];
  validateHeader(value, 'lineage_version_identity', errors);
  validateAllowedKeys(value, ['contract_id', 'schema_version', 'artifact_id', 'artifact_type', 'version', 'content_hash', 'authority', 'parent_artifact_ids', 'created_at', 'supersedes_artifact_id'], errors);
  for (const key of ['artifact_id', 'artifact_type', 'version']) if (!isString(value?.[key], key === 'version' ? 1 : 3, 200)) errors.push({ code: 'LINEAGE_IDENTITY_INVALID', path: `$.${key}` });
  if (!isHash(value?.content_hash) || !isTimestamp(value?.created_at) || !uniqueStrings(value?.parent_artifact_ids || [], 32)) errors.push({ code: 'LINEAGE_CONTENT_INVALID', path: '$' });
  validateAuthority(value?.authority, '$.authority', errors);
  return finalize(errors);
}

function validateStatePacket(value) {
  const errors = [];
  validateHeader(value, 'coaching_state_packet', errors);
  validateAllowedKeys(value, ['contract_id', 'schema_version', 'packet_id', 'scope', 'session_id', 'purpose', 'active_lens', 'artifact_lineage', 'business_truth', 'whole_person_execution_context', 'personal_rsl_retrieval_hash', 'relevant_history', 'current_state', 'external_evidence_ids', 'universal_pattern_ids', 'uncertainty', 'assembled_at', 'packet_hash'], errors);
  validateScope(value?.scope, '$.scope', errors);
  if (!isString(value?.packet_id, 8, 160) || !isString(value?.session_id, 8, 160) || !COACHING_PURPOSES.includes(value?.purpose) || !CUSTOMER_LENSES.includes(value?.active_lens)) errors.push({ code: 'STATE_PACKET_IDENTITY_INVALID', path: '$' });
  if (!Array.isArray(value?.artifact_lineage) || value.artifact_lineage.length < 4 || value.artifact_lineage.length > 32) errors.push({ code: 'STATE_PACKET_LINEAGE_INVALID', path: '$.artifact_lineage' });
  for (const [index, lineage] of (value?.artifact_lineage || []).entries()) {
    const result = validateLineage(lineage);
    for (const error of result.errors) errors.push({ ...error, path: `$.artifact_lineage[${index}]${error.path.slice(1)}` });
  }
  for (const [key, domain, max] of [['business_truth', 'BUSINESS', 120], ['whole_person_execution_context', 'WHOLE_PERSON_EXECUTION', 12]]) {
    if (!Array.isArray(value?.[key]) || value[key].length > max) errors.push({ code: 'STATE_PACKET_EVIDENCE_INVALID', path: `$.${key}` });
    for (const [index, ref] of (value?.[key] || []).entries()) {
      validateEvidenceRef(ref, `$.${key}[${index}]`, errors);
      if (ref.evidence_domain !== domain) errors.push({ code: 'STATE_PACKET_DOMAIN_BOUNDARY_INVALID', path: `$.${key}[${index}].evidence_domain` });
    }
  }
  if (!isHash(value?.personal_rsl_retrieval_hash) || !uniqueStrings(value?.external_evidence_ids, 12) || !uniqueStrings(value?.universal_pattern_ids, 8) || !Array.isArray(value?.uncertainty) || value.uncertainty.length > 40 || !Array.isArray(value?.relevant_history) || value.relevant_history.length > 80 || !isObject(value?.current_state) || !isTimestamp(value?.assembled_at) || !isHash(value?.packet_hash)) errors.push({ code: 'STATE_PACKET_CONTENT_INVALID', path: '$' });
  if (isObject(value)) { const unsigned = { ...value }; delete unsigned.packet_hash; if (value.packet_hash !== hashCanonicalJson(unsigned)) errors.push({ code: 'STATE_PACKET_HASH_INVALID', path: '$.packet_hash' }); }
  return finalize(errors);
}

function validateUniversalCandidate(value) {
  const errors = [];
  validateHeader(value, 'universal_rsl_candidate', errors);
  validateAllowedKeys(value, ['contract_id', 'schema_version', 'candidate_id', 'source_scope_hash', 'source_event_hashes', 'state', 'condition', 'intervention', 'execution_context', 'outcome', 'outcome_direction', 'validation_state', 'confounders', 'falsifiers', 'privacy_policy_ref', 'eligibility_policy_ref', 'runtime_read_enabled', 'promotion_enabled', 'created_at', 'candidate_hash'], errors);
  if (!isString(value?.candidate_id, 8, 160) || !['PERSONAL_ONLY', 'CANDIDATE_PRIVATE', 'REJECTED', 'WITHDRAWN'].includes(value?.state) || !OUTCOME_DIRECTIONS.includes(value?.outcome_direction)) errors.push({ code: 'UNIVERSAL_CANDIDATE_IDENTITY_INVALID', path: '$' });
  for (const key of ['condition', 'intervention', 'execution_context', 'outcome']) if (!isObject(value?.[key]) || Object.keys(value[key]).length > 24) errors.push({ code: 'UNIVERSAL_CANDIDATE_SECTION_INVALID', path: `$.${key}` });
  if (!isHash(value?.source_scope_hash) || !uniqueStrings(value?.source_event_hashes || [], 80) || value.source_event_hashes.length < 1 || value.source_event_hashes.some((hash) => !isHash(hash)) || !['PENDING', 'SUPPORTED', 'FALSIFIED', 'CONFOUNDED', 'INSUFFICIENT'].includes(value?.validation_state) || !Array.isArray(value?.confounders) || value.confounders.length > 16 || !Array.isArray(value?.falsifiers) || value.falsifiers.length > 16 || !isString(value?.privacy_policy_ref, 3, 160) || !isString(value?.eligibility_policy_ref, 3, 160) || typeof value?.runtime_read_enabled !== 'boolean' || typeof value?.promotion_enabled !== 'boolean' || value?.runtime_read_enabled !== false || value?.promotion_enabled !== false || !isTimestamp(value?.created_at) || !isHash(value?.candidate_hash)) errors.push({ code: 'UNIVERSAL_CANDIDATE_CONTROL_INVALID', path: '$' });
  if (isObject(value)) { const unsigned = { ...value }; delete unsigned.candidate_hash; if (value.candidate_hash !== hashCanonicalJson(unsigned)) errors.push({ code: 'UNIVERSAL_CANDIDATE_HASH_INVALID', path: '$.candidate_hash' }); }
  return finalize(errors);
}

export const SUBSCRIPTION_V1_CONTRACT_REGISTRY = deepFreeze({
  canonical_customer_subject: { authority: 'identity_authority', validator: validateSubject },
  business_membership: { authority: 'membership_authority', validator: validateMembership },
  paid_entitlement: { authority: 'stripe_lifecycle_projector', validator: validateEntitlement },
  session_allowance_ledger: { authority: 'deterministic_session_ledger', validator: validateLedger },
  active_coaching_session: { authority: 'deterministic_session_ledger', validator: validateSession },
  personal_rsl_event: { authority: 'personal_rsl_authority', validator: validateRslEvent },
  personal_rsl_envelope: { authority: 'personal_rsl_store', validator: validateRslEnvelope },
  relevant_history_retrieval_result: { authority: 'scope_first_retriever', validator: validateRetrieval },
  coaching_state_packet: { authority: 'coaching_state_assembler', validator: validateStatePacket },
  lineage_version_identity: { authority: 'artifact_authority', validator: validateLineage },
  universal_rsl_candidate: { authority: 'private_candidate_capture', validator: validateUniversalCandidate },
});

export function validateSubscriptionV1Contract(value) {
  const entry = SUBSCRIPTION_V1_CONTRACT_REGISTRY[value?.contract_id];
  return entry ? entry.validator(value) : finalize([{ code: 'UNKNOWN_CONTRACT', path: '$.contract_id' }]);
}

export function contractHeader(contractId) {
  const schemaVersion = SUBSCRIPTION_V1_CONTRACT_VERSIONS[contractId];
  if (!schemaVersion) throw new TypeError(`Unknown Subscription V1 contract: ${contractId}`);
  return deepFreeze({ contract_id: contractId, schema_version: schemaVersion });
}

export function scopeFingerprint(scope) {
  const errors = [];
  validateScope(scope, '$.scope', errors);
  if (errors.length) throw new TypeError('Exact Subscription V1 scope required');
  return hashCanonicalJson(scope);
}

export function sameScope(left, right) {
  if (!left || !right || (left.domain || 'BUSINESS') !== (right.domain || 'BUSINESS')) return false;
  return scopeKeys(left).every((key) => left?.[key] && left[key] === right?.[key]);
}

export function relationshipIdentityForScope(scope) {
  const errors = [];
  validateScope(scope, '$.scope', errors);
  if (errors.length) throw new TypeError('Exact Subscription V1 scope required');
  return scope.domain === 'ATHLETE' ? scope.athlete_relationship_id : scope.business_id;
}

export function createAuthorityReference({ authority_id, authority_version, authority_hash = null }) {
  const reference = {
    authority_id,
    authority_version,
    authority_hash: authority_hash || hashCanonicalJson({ authority_id, authority_version }),
  };
  const errors = [];
  validateAuthority(reference, '$', errors);
  if (errors.length) throw new TypeError('Valid authority reference required');
  return deepFreeze(reference);
}

export function createEvidenceReference({ evidence_id, evidence_domain, content_hash, certainty }) {
  const reference = { evidence_id, evidence_domain, content_hash, certainty };
  const errors = [];
  validateEvidenceRef(reference, '$', errors);
  if (errors.length) throw new TypeError('Valid evidence reference required');
  return deepFreeze(reference);
}
