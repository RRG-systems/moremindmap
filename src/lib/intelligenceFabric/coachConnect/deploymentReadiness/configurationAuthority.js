import { CONTRACT_VERSIONS, READINESS_FLAGS } from './constants.js';
import {
  canonicalDigest,
  hasSensitiveKey,
  isObject,
  isOpaque,
  isSha256,
  isTimestamp,
  requireFields,
  requireVersion,
  validationResult,
} from './contracts.js';

export function computeConfigurationDigest(value) {
  return canonicalDigest(value, ['configuration_digest']);
}

export function validateConfiguration(value, now = Date.now()) {
  const errors = [];
  if (!isObject(value)) return validationResult([{ code: 'CONFIGURATION_NOT_READY', field: '$' }], value);
  requireVersion(errors, value, 'configuration_contract_version', 'configuration');
  requireFields(errors, value, [
    'campaign_id', 'artifact_sha', 'artifact_manifest_sha256', 'environment_id',
    'policy_versions', 'application_flags', 'live_dependency_flags',
    'emergency_disabled', 'read_only', 'synthetic_only', 'public_access_permitted',
    'activation_permitted', 'deployment_permitted', 'rollback_plan_ref',
    'monitoring_plan_ref', 'issued_at', 'expires_at', 'approver_refs',
    'configuration_digest', 'status',
  ], 'CONFIGURATION_NOT_READY');
  if (!isSha256(value.artifact_sha) || !isSha256(value.artifact_manifest_sha256)) {
    errors.push({ code: 'ARTIFACT_UNVERIFIED', field: 'artifact_sha' });
  }
  if (!isOpaque(value.environment_id) || !isObject(value.policy_versions)) {
    errors.push({ code: 'CONFIGURATION_NOT_READY', field: 'authority' });
  }
  for (const collection of ['application_flags', 'live_dependency_flags']) {
    if (!isObject(value[collection])) {
      errors.push({ code: 'CONFIGURATION_NOT_READY', field: collection });
      continue;
    }
    for (const flag of READINESS_FLAGS) {
      if (value[collection][flag] !== false) errors.push({ code: 'LIVE_DEPENDENCY_PROHIBITED', field: `${collection}.${flag}` });
    }
  }
  for (const [field, expected] of Object.entries({
    emergency_disabled: true,
    read_only: true,
    synthetic_only: true,
    public_access_permitted: false,
    activation_permitted: false,
    deployment_permitted: false,
  })) {
    if (value[field] !== expected) errors.push({ code: field === 'emergency_disabled' ? 'EMERGENCY_DISABLE_REQUIRED' : 'CONFIGURATION_NOT_READY', field });
  }
  if (!isTimestamp(value.issued_at) || !isTimestamp(value.expires_at)
    || Date.parse(value.issued_at) >= Date.parse(value.expires_at)
    || now >= Date.parse(value.expires_at)) {
    errors.push({ code: 'CONFIGURATION_NOT_READY', field: 'time' });
  }
  if (hasSensitiveKey(value)) errors.push({ code: 'CONFIGURATION_SECRET_PRESENT', field: '$' });
  if (computeConfigurationDigest(value) !== value.configuration_digest) {
    errors.push({ code: 'CONFIGURATION_DIGEST_MISMATCH', field: 'configuration_digest' });
  }
  if (value.status !== 'VALIDATED_OFFLINE') errors.push({ code: 'CONFIGURATION_NOT_READY', field: 'status' });
  return validationResult(errors, value);
}

export function createOfflineConfiguration(overrides = {}) {
  const falseFlags = Object.fromEntries(READINESS_FLAGS.map((flag) => [flag, false]));
  const value = {
    configuration_contract_version: CONTRACT_VERSIONS.configuration,
    campaign_id: 'MORE_CAMPAIGN_COACH_CONNECT_DEPLOYMENT_READINESS_V1',
    artifact_sha: 'a'.repeat(64),
    artifact_manifest_sha256: 'b'.repeat(64),
    environment_id: 'offline-readiness',
    policy_versions: { deployment_readiness: '1.0.0' },
    application_flags: { ...falseFlags },
    live_dependency_flags: { ...falseFlags },
    emergency_disabled: true,
    read_only: true,
    synthetic_only: true,
    public_access_permitted: false,
    activation_permitted: false,
    deployment_permitted: false,
    rollback_plan_ref: 'rollback-plan-offline',
    monitoring_plan_ref: 'monitoring-plan-offline',
    issued_at: '2026-07-25T00:00:00.000Z',
    expires_at: '2099-01-01T00:00:00.000Z',
    approver_refs: [],
    status: 'VALIDATED_OFFLINE',
    ...overrides,
  };
  value.configuration_digest = computeConfigurationDigest(value);
  return Object.freeze(value);
}
