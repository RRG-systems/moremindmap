import { CONTRACT_VERSIONS } from './constants.js';
import {
  isObject,
  isOpaque,
  isSha256,
  requireFields,
  requireVersion,
  validationResult,
} from './contracts.js';

export const NON_DECREASING_STATE_FIELDS = Object.freeze([
  'security_epochs',
  'deletion_epochs',
  'tombstones',
  'legal_holds',
  'audit_receipts',
  'subject_security_versions',
]);

export function validateRollbackPlan(value) {
  const errors = [];
  if (!isObject(value)) return validationResult([{ code: 'ROLLBACK_NOT_PROVEN', field: '$' }], value);
  requireVersion(errors, value, 'rollback_contract_version', 'rollback');
  requireFields(errors, value, [
    'rollback_plan_id', 'current_artifact_sha', 'current_config_digest',
    'rollback_artifact_sha', 'rollback_config_digest', 'environment_id',
    'immutable_artifacts_verified', 'edge_protection_preserved',
    'emergency_disable_required', 'non_decreasing_state_fields',
    'expected_rto_seconds', 'idempotency_policy', 'approved_by_ref', 'status',
  ], 'ROLLBACK_NOT_PROVEN');
  for (const field of ['current_artifact_sha', 'current_config_digest', 'rollback_artifact_sha', 'rollback_config_digest']) {
    if (!isSha256(value[field])) errors.push({ code: 'ROLLBACK_NOT_PROVEN', field });
  }
  if (value.current_artifact_sha === value.rollback_artifact_sha
    || value.current_config_digest === value.rollback_config_digest) {
    errors.push({ code: 'ROLLBACK_NOT_PROVEN', field: 'rollback_target' });
  }
  for (const field of ['immutable_artifacts_verified', 'edge_protection_preserved', 'emergency_disable_required']) {
    if (value[field] !== true) errors.push({ code: 'ROLLBACK_NOT_PROVEN', field });
  }
  if (!Array.isArray(value.non_decreasing_state_fields)
    || NON_DECREASING_STATE_FIELDS.some((field) => !value.non_decreasing_state_fields.includes(field))) {
    errors.push({ code: 'ROLLBACK_STATE_REGRESSION', field: 'non_decreasing_state_fields' });
  }
  if (!Number.isInteger(value.expected_rto_seconds) || value.expected_rto_seconds <= 0
    || value.idempotency_policy !== 'SAME_KEY_SAME_RESULT'
    || !isOpaque(value.rollback_plan_id)
    || value.status !== 'VALIDATED_OFFLINE') {
    errors.push({ code: 'ROLLBACK_NOT_PROVEN', field: 'policy' });
  }
  return validationResult(errors, value);
}

export function createOfflineRollbackPlan(overrides = {}) {
  return Object.freeze({
    rollback_contract_version: CONTRACT_VERSIONS.rollback,
    rollback_plan_id: 'rollback-plan-offline',
    current_artifact_sha: 'a'.repeat(64),
    current_config_digest: 'b'.repeat(64),
    rollback_artifact_sha: 'c'.repeat(64),
    rollback_config_digest: 'd'.repeat(64),
    environment_id: 'offline-readiness',
    immutable_artifacts_verified: true,
    edge_protection_preserved: true,
    emergency_disable_required: true,
    non_decreasing_state_fields: [...NON_DECREASING_STATE_FIELDS],
    expected_rto_seconds: 900,
    idempotency_policy: 'SAME_KEY_SAME_RESULT',
    approved_by_ref: 'approval-withheld',
    status: 'VALIDATED_OFFLINE',
    ...overrides,
  });
}

export function simulateRollback(plan, state = {}) {
  const validation = validateRollbackPlan(plan);
  if (!validation.valid) return Object.freeze({ result: 'BLOCKED', activation_state: 'INACTIVE_DEFAULT_OFF', errors: validation.errors });
  const regression = NON_DECREASING_STATE_FIELDS.some((field) => (
    Number(state.after?.[field] ?? 0) < Number(state.before?.[field] ?? 0)
  ));
  return Object.freeze({
    result: regression ? 'BLOCKED_STATE_REGRESSION' : 'VERIFIED_INACTIVE',
    activation_state: 'INACTIVE_DEFAULT_OFF',
    persistence_rollback_performed: false,
    physical_jsonl_deletion_claimed: false,
    errors: regression ? Object.freeze(['ROLLBACK_STATE_REGRESSION']) : Object.freeze([]),
  });
}
