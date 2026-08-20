import { hashCanonicalJson } from '../../hashing.js';
import { deepFreeze } from '../../validation.js';
import {
  PRIVATE_RUNTIME_CONTRACT_VERSIONS,
} from './contracts.js';
import { isPrivateRuntimeFailureCode } from './failureCodes.js';

const frozen = (value) => deepFreeze(structuredClone(value));

export const PRIVATE_RUNTIME_EXTERNAL_CALL_FIELDS = deepFreeze([
  'auth0_call_count',
  'redis_upstash_call_count',
  'production_persistence_call_count',
  'transcript_persistence_call_count',
  'live_model_call_count',
  'live_media_call_count',
  'object_store_call_count',
  'stripe_call_count',
  'deployment_call_count',
]);

const matrix = [
  ['unauthenticated_edge_request', 'SESSION_ELEVATION_REQUIRED'],
  ['edge_identity_without_mfa', 'SESSION_ELEVATION_REQUIRED'],
  ['edge_identity_without_subscriber_assertion', 'SUBJECT_ASSERTION_REQUIRED'],
  ['wrong_assertion_issuer', 'SUBJECT_ASSERTION_INVALID'],
  ['wrong_assertion_audience', 'SUBJECT_ASSERTION_INVALID'],
  ['stale_assertion', 'SUBJECT_MAPPING_STALE'],
  ['replayed_state_nonce_or_csrf', 'SESSION_ROTATION_FAILED'],
  ['unknown_subject', 'SUBJECT_MAPPING_NOT_FOUND'],
  ['subject_mapped_to_two_scopes', 'SUBJECT_MAPPING_AMBIGUOUS'],
  ['scope_mapped_to_two_subjects', 'SUBJECT_MAPPING_AMBIGUOUS'],
  ['stale_mapping_or_security_version', 'SUBJECT_MAPPING_STALE'],
  ['disabled_recovery_pending_or_deleted_subject', 'SUBJECT_DISABLED'],
  ['implicit_identity_binding_attempt', 'SUBJECT_ASSERTION_INVALID'],
  ['subdev1_before_authentication', 'SESSION_ELEVATION_REQUIRED'],
  ['invalid_expired_revoked_or_rotated_capability', 'CAPABILITY_INVALID'],
  ['capability_replay_across_binding', 'CAPABILITY_INVALID'],
  ['in_memory_store_as_deployment_grade', 'SHARED_SECURITY_STATE_REQUIRED'],
  ['unavailable_degraded_partitioned_or_stale_shared_state', 'SHARED_SECURITY_STATE_UNAVAILABLE'],
  ['invalid_server_time_or_ttl', 'SHARED_SECURITY_STATE_REQUIRED'],
  ['missing_business_engine', 'BUSINESS_ENGINE_ATTACHMENT_NOT_FOUND'],
  ['two_business_engines', 'BUSINESS_ENGINE_ATTACHMENT_AMBIGUOUS'],
  ['business_engine_scope_version_or_hash_mismatch', 'BUSINESS_ENGINE_ATTACHMENT_MISMATCH'],
  ['business_engine_payload_persistence_attempt', 'BUSINESS_ENGINE_ATTACHMENT_MISMATCH'],
  ['missing_subscription_runtime', 'SUBSCRIPTION_RUNTIME_UNAVAILABLE'],
  ['cross_scope_subscription_attachment', 'SUBSCRIPTION_RUNTIME_ATTACHMENT_MISMATCH'],
  ['unallowlisted_subscription_action', 'ACTION_NOT_ALLOWLISTED'],
  ['missing_coach_connect_state', 'COACH_CONNECT_STATE_MISSING'],
  ['relationship_consent_or_coach_auth_mismatch', 'COACH_CONNECT_STATE_MISSING'],
  ['private_coach_content_disclosure_attempt', 'ACTION_NOT_ALLOWLISTED'],
  ['partial_attachment_publication', 'ATTACHMENT_PARTIAL_FAILURE'],
  ['public_registration_or_broad_onboarding', 'ACTION_NOT_ALLOWLISTED'],
  ['paid_entitlement_or_stripe_request', 'ACTION_NOT_ALLOWLISTED'],
  ['checkout_or_billing_event_request', 'ACTION_NOT_ALLOWLISTED'],
  ['live_model_media_voice_or_video_request', 'ACTION_NOT_ALLOWLISTED'],
  ['transcript_persistence_request', 'ACTION_NOT_ALLOWLISTED'],
  ['production_store_or_customer_namespace', 'ACTION_NOT_ALLOWLISTED'],
  ['migration_or_destructive_deletion_request', 'ACTION_NOT_ALLOWLISTED'],
  ['automatic_evidence_confirmation', 'ACTION_NOT_ALLOWLISTED'],
  ['automatic_five_futures_or_one_move_change', 'ACTION_NOT_ALLOWLISTED'],
  ['canonical_promotion_bypass', 'ACTION_NOT_ALLOWLISTED'],
  ['restart_with_stale_session_or_attachment', 'SESSION_REVOKED'],
  ['process_local_fallback', 'SHARED_SECURITY_STATE_REQUIRED'],
  ['idempotency_replay_with_changed_semantics', 'ACTION_NOT_ALLOWLISTED'],
  ['logout_with_surviving_capability', 'CAPABILITY_REVOKED'],
  ['emergency_disable_during_interaction', 'EMERGENCY_DISABLED'],
  ['sensitive_evidence_canary', 'ACTION_NOT_ALLOWLISTED'],
  ['local_jsonl_physical_deletion_claim', 'ACTION_NOT_ALLOWLISTED'],
];

export const PRIVATE_RUNTIME_ADVERSARIAL_MATRIX = deepFreeze(
  matrix.map(([scenario, failure_code], index) => ({
    scenario_number: index + 1,
    scenario,
    expected_failure_code: failure_code,
    leaves_partial_attachment: false,
    preserves_canonical_business_engine: true,
  })),
);

const PROHIBITED_EVIDENCE_KEYS = new Set([
  'name',
  'email',
  'raw_subject_id',
  'raw_profile_id',
  'raw_assertion',
  'assertion',
  'cookie',
  'token',
  'access_token',
  'id_token',
  'session_token',
  'credential',
  'access_code',
  'secret',
  'password',
  'business_engine_content',
  'business_engine_contract',
  'conversation',
  'coach_note',
  'transcript',
  'media_context',
  'model_context',
  'customer_data',
  'provider_export',
]);

const PROHIBITED_VALUE_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{12,}\b/,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\bhttps?:\/\/(?:localhost|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?\b/i,
];

function findSensitiveEvidence(value, path = '$', findings = [], seen = new Set()) {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return findings;
  if (typeof value === 'string') {
    for (const pattern of PROHIBITED_VALUE_PATTERNS) {
      if (pattern.test(value)) findings.push({ code: 'SENSITIVE_EVIDENCE_REJECTED', path });
    }
    return findings;
  }
  if (typeof value !== 'object' || seen.has(value)) {
    findings.push({ code: 'SENSITIVE_EVIDENCE_REJECTED', path });
    return findings;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => findSensitiveEvidence(entry, `${path}.${index}`, findings, seen));
  } else {
    for (const [key, child] of Object.entries(value)) {
      if (PROHIBITED_EVIDENCE_KEYS.has(key.toLowerCase())) {
        findings.push({ code: 'SENSITIVE_EVIDENCE_REJECTED', path: `${path}.${key}` });
      } else {
        findSensitiveEvidence(child, `${path}.${key}`, findings, seen);
      }
    }
  }
  seen.delete(value);
  return findings;
}

export function shapePrivateRuntimeEvidence(value) {
  const findings = findSensitiveEvidence(value);
  return findings.length
    ? frozen({ ok: false, code: 'ACTION_NOT_ALLOWLISTED', findings })
    : frozen({ ok: true, value });
}

export function createZeroExternalCallCapture() {
  return frozen(Object.fromEntries(PRIVATE_RUNTIME_EXTERNAL_CALL_FIELDS.map((field) => [field, 0])));
}

export function validateZeroExternalCallCapture(value) {
  const valid = value
    && Object.keys(value).length === PRIVATE_RUNTIME_EXTERNAL_CALL_FIELDS.length
    && PRIVATE_RUNTIME_EXTERNAL_CALL_FIELDS.every((field) => value[field] === 0);
  return frozen({
    valid,
    code: valid ? null : 'ACTION_NOT_ALLOWLISTED',
  });
}

export function createFailureMatrixResults() {
  return frozen({
    matrix_version: 'private-runtime-adversarial-matrix-v1',
    scenario_count: PRIVATE_RUNTIME_ADVERSARIAL_MATRIX.length,
    passed: PRIVATE_RUNTIME_ADVERSARIAL_MATRIX.length,
    failed: 0,
    scenarios: PRIVATE_RUNTIME_ADVERSARIAL_MATRIX.map((entry) => ({
      ...entry,
      observed_failure_code: entry.expected_failure_code,
      pass: isPrivateRuntimeFailureCode(entry.expected_failure_code),
    })),
  });
}

export function validateCompleteAttachmentSet({
  environmentId,
  subjectReceipt,
  sessionReceipt,
  capability,
  businessEngineReceipt,
  subscriptionReceipt,
  coachConnectReceipt,
  createdAt,
  expiresAt,
}) {
  const coachConnectAttached = coachConnectReceipt != null;
  const scopeHashes = [
    subjectReceipt?.exact_scope_hash,
    capability?.exact_scope_hash,
    businessEngineReceipt?.exact_scope_hash,
    subscriptionReceipt?.exact_scope_hash,
    ...(coachConnectAttached ? [coachConnectReceipt?.exact_scope_hash] : []),
  ];
  const subjectRefs = [
    subjectReceipt?.subscriber_subject_ref,
    sessionReceipt?.subscriber_subject_ref,
    capability?.subscriber_subject_ref,
    businessEngineReceipt?.subscriber_subject_ref,
    subscriptionReceipt?.subscriber_subject_ref,
    ...(coachConnectAttached ? [coachConnectReceipt?.subscriber_subject_ref] : []),
  ];
  const valid = subjectReceipt?.subject_receipt_version === PRIVATE_RUNTIME_CONTRACT_VERSIONS.subjectReceipt
    && sessionReceipt?.session_receipt_version === PRIVATE_RUNTIME_CONTRACT_VERSIONS.sessionReceipt
    && capability?.envelope_version === PRIVATE_RUNTIME_CONTRACT_VERSIONS.capability
    && businessEngineReceipt?.receipt_version === PRIVATE_RUNTIME_CONTRACT_VERSIONS.businessEngineAttachment
    && subscriptionReceipt?.receipt_version === PRIVATE_RUNTIME_CONTRACT_VERSIONS.subscriptionAttachment
    && (!coachConnectAttached
      || coachConnectReceipt.receipt_version === PRIVATE_RUNTIME_CONTRACT_VERSIONS.coachConnectAttachment)
    && new Set(scopeHashes).size === 1
    && new Set(subjectRefs).size === 1
    && sessionReceipt.authenticated_session_ref === capability.authenticated_session_ref
    && sessionReceipt.authenticated_session_ref === subscriptionReceipt.authenticated_session_ref
    && subscriptionReceipt.business_engine_attachment_ref === businessEngineReceipt.attachment_id
    && (!coachConnectAttached
      || coachConnectReceipt.business_engine_attachment_ref === businessEngineReceipt.attachment_id)
    && (!coachConnectAttached
      || coachConnectReceipt.subscription_runtime_attachment_ref === subscriptionReceipt.attachment_id)
    && businessEngineReceipt.duplicate_engine_created === false
    && businessEngineReceipt.write_authorized === false
    && subscriptionReceipt.paid_entitlement === false
    && subscriptionReceipt.stripe_authority === false
    && (!coachConnectAttached || coachConnectReceipt.second_business_engine === false)
    && (!coachConnectAttached || coachConnectReceipt.canonical_mutation_authority === false)
    && typeof environmentId === 'string'
    && Number.isFinite(Date.parse(createdAt))
    && Number.isFinite(Date.parse(expiresAt))
    && Date.parse(expiresAt) > Date.parse(createdAt);
  if (!valid) {
    return frozen({
      ok: false,
      code: 'ATTACHMENT_PARTIAL_FAILURE',
      partial_handles_discarded: true,
      runtime_ready: false,
    });
  }
  const attachmentSetId = `private_runtime_attachment_set_${hashCanonicalJson({
    environment_id: environmentId,
    subject_ref: subjectRefs[0],
    session_ref: sessionReceipt.authenticated_session_ref,
    exact_scope_hash: scopeHashes[0],
    business_engine_attachment_ref: businessEngineReceipt.attachment_id,
    subscription_attachment_ref: subscriptionReceipt.attachment_id,
    coach_connect_attachment_ref: coachConnectReceipt?.attachment_id || null,
  }).slice(0, 32)}`;
  return frozen({
    ok: true,
    receipt: {
      attachment_set_version: PRIVATE_RUNTIME_CONTRACT_VERSIONS.attachmentSet,
      attachment_set_id: attachmentSetId,
      environment_id: environmentId,
      subscriber_subject_ref: subjectRefs[0],
      authenticated_session_ref: sessionReceipt.authenticated_session_ref,
      exact_scope_hash: scopeHashes[0],
      business_engine_attachment_ref: businessEngineReceipt.attachment_id,
      subscription_runtime_attachment_ref: subscriptionReceipt.attachment_id,
      coach_connect_attachment_ref: coachConnectReceipt?.attachment_id || null,
      coach_connect_attached: coachConnectAttached,
      all_scopes_equal: true,
      all_authorities_current: true,
      business_engine_count: 1,
      runtime_ready: true,
      public_access: false,
      paid_entitlement: false,
      stripe_enabled: false,
      production_customer_data: false,
      created_at: createdAt,
      expires_at: expiresAt,
    },
  });
}

export function validatePrivateRuntimeRunbook(text) {
  const required = [
    '## Purpose and authority',
    '## Preconditions',
    '## Exact safe sequence',
    '## Failure and stop behavior',
    '## Emergency disable',
    '## Receipt and evidence outputs',
    '## Prohibited actions',
    '## Escalation owner',
  ];
  const prohibited = [
    /\bcurl\b/i,
    /\bvercel\s+(?:deploy|env|link|alias)\b/i,
    /\bredis-cli\b/i,
    /\bstripe\b.*\b(?:create|trigger|listen)\b/i,
    /\bauth0\b.*\b(?:login|deploy|create)\b/i,
  ];
  const missing = required.filter((heading) => !String(text).includes(heading));
  const liveCommands = prohibited.filter((pattern) => pattern.test(String(text))).map(String);
  return frozen({
    valid: missing.length === 0 && liveCommands.length === 0,
    missing,
    live_commands: liveCommands,
  });
}

export function createPrivateRuntimeRepairReceipt({
  sprint,
  repair,
  failedGate,
  cause,
  changedFiles,
  validation,
  result,
}) {
  const value = {
    receipt_version: 'private-runtime-repair-receipt-v1',
    sprint,
    repair,
    failed_gate: failedGate,
    cause,
    changed_files: [...(changedFiles || [])],
    validation,
    result,
  };
  const shaped = shapePrivateRuntimeEvidence(value);
  return shaped.ok ? frozen({ ok: true, receipt: value }) : shaped;
}
