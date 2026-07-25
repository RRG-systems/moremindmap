import { CONTRACT_VERSIONS } from './constants.js';
import {
  isObject,
  isOpaque,
  isSha256,
  isTimestamp,
  requireFields,
  requireVersion,
  validationResult,
} from './contracts.js';

export function validateRecoveryReceipt(value) {
  const errors = [];
  if (!isObject(value)) return validationResult([{ code: 'RECOVERY_NOT_PROVEN', field: '$' }], value);
  requireVersion(errors, value, 'recovery_contract_version', 'recovery');
  requireFields(errors, value, [
    'recovery_receipt_id', 'environment_id', 'artifact_sha', 'config_digest',
    'failure_class', 'recovery_action', 'idempotency_key_hash', 'prior_state_ref',
    'result_state', 'replayed_event_count', 'duplicate_promotion_count',
    'provider_call_count', 'persistence_write_count', 'started_at', 'completed_at',
    'result', 'limitations',
  ], 'RECOVERY_NOT_PROVEN');
  if (![value.artifact_sha, value.config_digest, value.idempotency_key_hash].every(isSha256)
    || !isOpaque(value.recovery_receipt_id)
    || !isOpaque(value.environment_id)) {
    errors.push({ code: 'RECOVERY_NOT_PROVEN', field: 'binding' });
  }
  if (!isTimestamp(value.started_at) || !isTimestamp(value.completed_at)
    || Date.parse(value.started_at) > Date.parse(value.completed_at)) {
    errors.push({ code: 'RECOVERY_NOT_PROVEN', field: 'time' });
  }
  for (const field of ['replayed_event_count', 'duplicate_promotion_count', 'provider_call_count', 'persistence_write_count']) {
    if (!Number.isInteger(value[field]) || value[field] < 0) errors.push({ code: 'RECOVERY_NOT_PROVEN', field });
  }
  if (value.duplicate_promotion_count !== 0) errors.push({ code: 'RECOVERY_DUPLICATE_PROMOTION', field: 'duplicate_promotion_count' });
  if (value.provider_call_count !== 0 || value.persistence_write_count !== 0) errors.push({ code: 'LIVE_DEPENDENCY_PROHIBITED', field: 'side_effect_count' });
  if (value.result_state !== 'HEALTHY_INACTIVE'
    || value.result !== 'RECOVERED_OFFLINE'
    || !Array.isArray(value.limitations)
    || !value.limitations.includes('NO_PRODUCTION_PERSISTENCE_PROOF')
    || !value.limitations.includes('LOCAL_JSONL_LOGICAL_DENIAL_ONLY')) {
    errors.push({ code: 'RECOVERY_NOT_PROVEN', field: 'result' });
  }
  return validationResult(errors, value);
}

export function createOfflineRecoveryReceipt(overrides = {}) {
  return Object.freeze({
    recovery_contract_version: CONTRACT_VERSIONS.recovery,
    recovery_receipt_id: 'recovery-receipt-offline',
    environment_id: 'offline-readiness',
    artifact_sha: 'a'.repeat(64),
    config_digest: 'b'.repeat(64),
    failure_class: 'SYNTHETIC_RESTART',
    recovery_action: 'SIMULATE_RESTART_WITH_ACTIVATION_DISABLED',
    idempotency_key_hash: 'c'.repeat(64),
    prior_state_ref: 'synthetic-prior-state',
    result_state: 'HEALTHY_INACTIVE',
    replayed_event_count: 1,
    duplicate_promotion_count: 0,
    provider_call_count: 0,
    persistence_write_count: 0,
    started_at: '2026-07-25T00:00:00.000Z',
    completed_at: '2026-07-25T00:00:01.000Z',
    result: 'RECOVERED_OFFLINE',
    limitations: ['NO_PRODUCTION_PERSISTENCE_PROOF', 'LOCAL_JSONL_LOGICAL_DENIAL_ONLY'],
    ...overrides,
  });
}

export function simulateRecovery(receipt, replayKeys) {
  const validation = validateRecoveryReceipt(receipt);
  if (!validation.valid) return Object.freeze({ valid: false, errors: validation.errors });
  const keys = Array.isArray(replayKeys) ? replayKeys : [];
  const duplicateCount = keys.length - new Set(keys).size;
  return Object.freeze({
    valid: duplicateCount === 0,
    result_state: duplicateCount === 0 ? 'HEALTHY_INACTIVE' : 'BLOCKED_DUPLICATE_REPLAY',
    activation_state: 'INACTIVE_DEFAULT_OFF',
    duplicate_promotion_count: duplicateCount,
    fallback_to_local_state: false,
    provider_call_count: 0,
    persistence_write_count: 0,
  });
}
