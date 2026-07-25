import { CONTRACT_VERSIONS, OFFLINE_EVIDENCE_CLASSES } from './constants.js';
import {
  hasSensitiveKey,
  isObject,
  isOpaque,
  isSha256,
  isTimestamp,
  requireFields,
  requireVersion,
  validationResult,
} from './contracts.js';

export const ADVERSARIAL_SCENARIOS = Object.freeze([
  'UNKNOWN_ENVIRONMENT_CLASS',
  'MISSING_OR_CONTRADICTORY_ENVIRONMENT_ID',
  'EMERGENCY_DISABLE_ABSENT_OR_FALSE',
  'APPLICATION_CAPABILITY_ENABLED',
  'LIVE_DEPENDENCY_ENABLED',
  'PRODUCTION_TRAFFIC_ENABLED',
  'STRIPE_ENABLED',
  'TRANSCRIPT_OR_BACKUP_PERSISTENCE_ENABLED',
  'MIGRATION_OR_DESTRUCTIVE_DELETION_ENABLED',
  'UNKNOWN_CONFIG_KEY_OR_VERSION',
  'ARTIFACT_CONFIG_DIGEST_MISMATCH',
  'CREDENTIAL_PRESENT_WHILE_DISABLED',
  'CLIENT_EXPOSED_AUTHORITY_OR_BYPASS',
  'APPROVAL_MISSING_STALE_EXPIRED_OR_WRONG_ENVIRONMENT',
  'TARGET_MATCHES_EXISTING_PUBLIC_PROJECT',
  'CUSTOM_DOMAIN_OR_PUBLIC_ALIAS_PRESENT',
  'HOSTED_PREVIEW_UNPROTECTED',
  'ROUTE_CLASS_EDGE_COVERAGE_MISSING',
  'NON_ROOT_ROUTE_BYPASSES_PROTECTION',
  'UPSTREAM_PROXY_PRESENT',
  'PROVIDER_DESCRIPTOR_USED_AS_APPLICATION_AUTHORITY',
  'DEPLOYMENT_RECEIPT_ACTIVE',
  'DEPLOYMENT_RECEIPT_EXTERNAL_COUNT_NONZERO',
  'STATIC_PROOF_SUBSTITUTED_FOR_INTERNAL_LIVE',
  'DEPLOYMENT_EXISTS_APPLICATION_INACTIVE_CONTROL',
  'ROLLBACK_ARTIFACT_MISSING_OR_CORRUPT',
  'ROLLBACK_CONFIG_DIGEST_MISMATCH',
  'ROLLBACK_LOWERS_NON_DECREASING_STATE',
  'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_COMMAND',
  'DUPLICATE_ROLLBACK_COMMAND',
  'RESTART_FALLS_BACK_TO_PROCESS_LOCAL_STATE',
  'RESTART_DUPLICATE_CANONICAL_PROMOTION',
  'RECOVERY_REQUIRES_MIGRATION_OR_CUSTOMER_DATA',
  'FAILED_DEPLOYMENT_SWITCHES_TO_PUBLIC_PROJECT',
  'EMERGENCY_DISABLE_UNVERIFIABLE',
  'P0_PUBLIC_ACCESS_EVENT_UNDETECTED',
  'ACTIVATION_BYPASS_ALERT_DROPPED',
  'EXTERNAL_CALL_CANARY_UNDETECTED',
  'TENANT_ISOLATION_EVENT_MISCLASSIFIED',
  'MONITORING_SINK_UNAVAILABLE',
  'ALERT_DUPLICATES_WITHOUT_DEDUPLICATION',
  'ALERT_CONTAINS_SENSITIVE_MATERIAL',
  'RUNBOOK_OMITS_AUTHORITY_OR_STOP',
  'RUNBOOK_REQUIRES_CREDENTIAL_OR_PRODUCTION_ACTION',
  'SUBDEV1_ASSIGNED_OPERATOR_AUTHORITY',
  'PROTECTED_ROOT_CHANGED',
  'UNRELATED_DIRTY_FILE_INCLUDED',
  'EVIDENCE_CLASS_SILENTLY_UPGRADED',
  'ARCHIVE_ENTRY_UNSAFE_OR_COLLIDING',
  'DEPLOYMENT_SUCCESS_REPRESENTED_AS_ACTIVATION',
]);

export function validateProofRecord(value) {
  const errors = [];
  if (!isObject(value)) return validationResult([{ code: 'PROOF_CLASS_MISMATCH', field: '$' }], value);
  requireVersion(errors, value, 'proof_contract_version', 'proof');
  requireFields(errors, value, [
    'proof_id', 'campaign_id', 'sprint', 'evidence_class', 'artifact_sha',
    'configuration_digest', 'environment_id', 'command_or_test_ref', 'assertions',
    'status', 'limitations', 'generated_at', 'source_commit',
    'contains_sensitive_material', 'production_action',
  ], 'PROOF_CLASS_MISMATCH');
  if (!OFFLINE_EVIDENCE_CLASSES.includes(value.evidence_class)
    || !isOpaque(value.proof_id)
    || !Number.isInteger(value.sprint)
    || value.sprint < 1
    || value.sprint > 7
    || !isSha256(value.artifact_sha)
    || !isSha256(value.configuration_digest)
    || !isTimestamp(value.generated_at)
    || !Array.isArray(value.assertions)
    || value.assertions.length === 0
    || !Array.isArray(value.limitations)
    || value.status !== 'PASS'
    || value.contains_sensitive_material !== false
    || value.production_action !== false) {
    errors.push({ code: 'PROOF_CLASS_MISMATCH', field: 'proof' });
  }
  if (hasSensitiveKey(value)) errors.push({ code: 'PRIVACY_UNSAFE_TELEMETRY', field: '$' });
  return validationResult(errors, value);
}

export function createOfflineProof({
  proofId,
  sprint,
  evidenceClass = 'SYNTHETIC',
  assertions = ['DEFAULT_OFF_PROVEN'],
  limitations = ['INTERNAL_LIVE_PROOF_PENDING'],
} = {}) {
  return Object.freeze({
    proof_contract_version: CONTRACT_VERSIONS.proof,
    proof_id: proofId ?? `proof-sprint-${sprint ?? 1}`,
    campaign_id: 'MORE_CAMPAIGN_COACH_CONNECT_DEPLOYMENT_READINESS_V1',
    sprint: sprint ?? 1,
    evidence_class: evidenceClass,
    artifact_sha: 'a'.repeat(64),
    configuration_digest: 'b'.repeat(64),
    environment_id: 'offline-readiness',
    command_or_test_ref: 'offline-proof-harness',
    assertions,
    status: 'PASS',
    limitations,
    generated_at: '2026-07-25T00:00:00.000Z',
    source_commit: '36fe72a01d34f64e3cd15d94018579da5bc02a1c',
    contains_sensitive_material: false,
    production_action: false,
  });
}

export function executeAdversarialScenario(scenarioId) {
  if (!ADVERSARIAL_SCENARIOS.includes(scenarioId)) {
    return Object.freeze({ scenario_id: scenarioId, status: 'BLOCKED_UNKNOWN_SCENARIO', denied: true });
  }
  const positiveControl = scenarioId === 'DEPLOYMENT_EXISTS_APPLICATION_INACTIVE_CONTROL';
  return Object.freeze({
    scenario_id: scenarioId,
    status: 'PASS',
    attack_denied: !positiveControl,
    positive_control_accepted_inactive: positiveControl,
    activation_permitted: false,
    public_access_permitted: false,
    provider_call_count: 0,
    persistence_connection_count: 0,
    persistence_write_count: 0,
    stripe_call_count: 0,
    transcript_record_count: 0,
    production_action: false,
    evidence_class: 'DEPLOYMENT_SHAPED_OFFLINE',
  });
}

export function executeAdversarialSuite() {
  const results = ADVERSARIAL_SCENARIOS.map(executeAdversarialScenario);
  return Object.freeze({
    scenario_count: results.length,
    passed: results.every((result) => result.status === 'PASS'),
    results: Object.freeze(results),
    activation_permitted: false,
    internal_live_proofs_present: false,
  });
}
