import {
  CONTRACT_VERSIONS,
  EVIDENCE_CLASSES,
  GATE_STATES,
} from './constants.js';
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

const stateRank = new Map([
  ['PASS_STATIC', 1],
  ['PASS_SYNTHETIC', 2],
  ['PASS_DEPLOYMENT_SHAPED_OFFLINE', 3],
  ['PASS_INTERNAL_LIVE', 4],
]);

export function validateGateRecord(value, now = Date.now()) {
  const errors = [];
  if (!isObject(value)) return validationResult([{ code: 'ACTIVATION_GATE_INCOMPLETE', field: '$' }], value);
  requireVersion(errors, value, 'gate_record_version', 'gate');
  requireFields(errors, value, [
    'gate_id', 'campaign_id', 'artifact_sha', 'artifact_manifest_sha256',
    'configuration_digest', 'environment_id', 'topology_digest', 'evidence_class',
    'evidence_refs', 'approved_by_roles', 'approved_at', 'expires_at', 'state',
    'limitations',
  ], 'ACTIVATION_GATE_INCOMPLETE');
  if (![value.artifact_sha, value.artifact_manifest_sha256, value.configuration_digest, value.topology_digest].every(isSha256)) {
    errors.push({ code: 'ACTIVATION_GATE_INCOMPLETE', field: 'digest_binding' });
  }
  if (!EVIDENCE_CLASSES.includes(value.evidence_class) || !GATE_STATES.includes(value.state)) {
    errors.push({ code: 'ACTIVATION_GATE_INCOMPLETE', field: 'state' });
  }
  if (!isTimestamp(value.approved_at) || !isTimestamp(value.expires_at)
    || Date.parse(value.approved_at) >= Date.parse(value.expires_at)
    || now >= Date.parse(value.expires_at)) {
    errors.push({ code: 'ACTIVATION_GATE_EXPIRED', field: 'expires_at' });
  }
  if (!Array.isArray(value.evidence_refs) || !Array.isArray(value.approved_by_roles)
    || !isOpaque(value.gate_id) || !isOpaque(value.environment_id)) {
    errors.push({ code: 'ACTIVATION_GATE_INCOMPLETE', field: 'authority' });
  }
  return validationResult(errors, value);
}

export function aggregateGateRecords(records, requiredState = 'PASS_DEPLOYMENT_SHAPED_OFFLINE') {
  if (!Array.isArray(records) || records.length === 0) {
    return Object.freeze({ activation_permitted: false, state: 'BLOCKED_AUTHORITY', errors: ['ACTIVATION_GATE_INCOMPLETE'] });
  }
  const invalid = records.some((record) => !validateGateRecord(record).valid);
  const bindingFields = ['artifact_sha', 'artifact_manifest_sha256', 'configuration_digest', 'environment_id', 'topology_digest'];
  const bindingMismatch = bindingFields.some((field) => new Set(records.map((record) => record[field])).size !== 1);
  const insufficient = records.some((record) => (stateRank.get(record.state) ?? 0) < (stateRank.get(requiredState) ?? Infinity));
  return Object.freeze({
    activation_permitted: false,
    state: invalid || bindingMismatch || insufficient ? 'BLOCKED_AUTHORITY' : 'READY_FOR_HUMAN_REVIEW',
    errors: Object.freeze([
      ...(invalid ? ['ACTIVATION_GATE_INCOMPLETE'] : []),
      ...(bindingMismatch ? ['ACTIVATION_BYPASS_DETECTED'] : []),
      ...(insufficient ? ['ACTIVATION_GATE_INCOMPLETE'] : []),
    ]),
  });
}

export function validateDeploymentReceipt(value) {
  const errors = [];
  if (!isObject(value)) return validationResult([{ code: 'DEPLOYMENT_AUTHORITY_REQUIRED', field: '$' }], value);
  requireVersion(errors, value, 'deployment_receipt_version', 'deploymentReceipt');
  requireFields(errors, value, [
    'deployment_window_id', 'artifact_sha', 'config_digest', 'environment_id',
    'rollback_artifact', 'rollback_config_digest', 'deployment_operator',
    'deployment_started', 'deployment_completed', 'deployment_result',
    'activation_state', 'deployment_receipt_id', 'deployment_adapter_class',
    'target_reference_hash', 'idempotency_key_hash', 'request_fingerprint',
    'edge_access_state', 'public_access_state', 'provider_call_count',
    'persistence_connection_count', 'persistence_write_count', 'stripe_call_count',
    'transcript_record_count', 'evidence_refs', 'audit_event_id',
  ], 'DEPLOYMENT_AUTHORITY_REQUIRED');
  for (const field of ['artifact_sha', 'config_digest', 'rollback_artifact', 'rollback_config_digest', 'target_reference_hash', 'idempotency_key_hash', 'request_fingerprint']) {
    if (!isSha256(value[field])) errors.push({ code: 'ARTIFACT_UNVERIFIED', field });
  }
  if (!isTimestamp(value.deployment_started) || !isTimestamp(value.deployment_completed)
    || Date.parse(value.deployment_started) > Date.parse(value.deployment_completed)) {
    errors.push({ code: 'DEPLOYMENT_AUTHORITY_REQUIRED', field: 'time' });
  }
  if (value.deployment_operator === 'SUBDEV1' || !isOpaque(value.deployment_operator)) {
    errors.push({ code: 'DEPLOYMENT_AUTHORITY_REQUIRED', field: 'deployment_operator' });
  }
  if (value.deployment_result !== 'NOT_EXECUTED_AUTHORITY_WITHHELD'
    || value.activation_state !== 'INACTIVE_DEFAULT_OFF'
    || value.edge_access_state !== 'NOT_INSPECTED'
    || value.public_access_state !== 'DENIED_BY_CONTRACT') {
    errors.push({ code: 'DEPLOYMENT_AUTHORITY_REQUIRED', field: 'state' });
  }
  for (const field of ['provider_call_count', 'persistence_connection_count', 'persistence_write_count', 'stripe_call_count', 'transcript_record_count']) {
    if (value[field] !== 0) errors.push({ code: 'LIVE_DEPENDENCY_PROHIBITED', field });
  }
  if (hasSensitiveKey(value)) errors.push({ code: 'CONFIGURATION_SECRET_PRESENT', field: '$' });
  return validationResult(errors, value);
}

export function createNotExecutedDeploymentReceipt(overrides = {}) {
  return Object.freeze({
    deployment_receipt_version: CONTRACT_VERSIONS.deploymentReceipt,
    deployment_window_id: 'window-authority-withheld',
    artifact_sha: 'a'.repeat(64),
    config_digest: 'd'.repeat(64),
    environment_id: 'offline-readiness',
    rollback_artifact: 'e'.repeat(64),
    rollback_config_digest: 'f'.repeat(64),
    deployment_operator: 'operator-reference-withheld',
    deployment_started: '2026-07-25T00:00:00.000Z',
    deployment_completed: '2026-07-25T00:00:00.000Z',
    deployment_result: 'NOT_EXECUTED_AUTHORITY_WITHHELD',
    activation_state: 'INACTIVE_DEFAULT_OFF',
    deployment_receipt_id: 'deployment-receipt-not-executed',
    deployment_adapter_class: 'PROVIDER_SPECIFIC_DEPLOYMENT_ADAPTER',
    target_reference_hash: 'c'.repeat(64),
    idempotency_key_hash: '1'.repeat(64),
    request_fingerprint: '2'.repeat(64),
    edge_access_state: 'NOT_INSPECTED',
    public_access_state: 'DENIED_BY_CONTRACT',
    provider_call_count: 0,
    persistence_connection_count: 0,
    persistence_write_count: 0,
    stripe_call_count: 0,
    transcript_record_count: 0,
    evidence_refs: [],
    audit_event_id: 'audit-not-executed',
    ...overrides,
  });
}
