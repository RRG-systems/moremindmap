import { CONTRACT_VERSIONS, REQUIRED_RUNBOOK_IDS } from './constants.js';
import {
  hasSensitiveKey,
  isObject,
  isText,
  requireFields,
  requireVersion,
  validationResult,
} from './contracts.js';

export function validateRunbookManifest(value) {
  const errors = [];
  if (!isObject(value)) return validationResult([{ code: 'RUNBOOK_INVALID', field: '$' }], value);
  requireVersion(errors, value, 'runbook_contract_version', 'runbook');
  requireFields(errors, value, [
    'runbook_id', 'title', 'version', 'purpose', 'authority_roles',
    'prerequisites', 'inputs', 'ordered_steps', 'verification',
    'evidence_outputs', 'rollback', 'stop_conditions', 'escalation',
    'prohibited_actions', 'credential_required', 'production_action_required',
  ], 'RUNBOOK_INVALID');
  if (!REQUIRED_RUNBOOK_IDS.includes(value.runbook_id) || !isText(value.title)) {
    errors.push({ code: 'RUNBOOK_INVALID', field: 'identity' });
  }
  for (const field of [
    'authority_roles', 'prerequisites', 'inputs', 'ordered_steps', 'verification',
    'evidence_outputs', 'rollback', 'stop_conditions', 'escalation', 'prohibited_actions',
  ]) {
    if (!Array.isArray(value[field]) || value[field].length === 0 || value[field].some((item) => !isText(item, 1024))) {
      errors.push({ code: 'RUNBOOK_INVALID', field });
    }
  }
  if (value.credential_required !== false || value.production_action_required !== false) {
    errors.push({ code: 'DEPLOYMENT_AUTHORITY_REQUIRED', field: 'authority' });
  }
  if (!value.prohibited_actions?.includes('NO_DEPLOYMENT_OR_PLATFORM_ACTION')
    || !value.stop_conditions?.includes('STOP_IF_CREDENTIAL_OR_PLATFORM_AUTHORITY_REQUIRED')) {
    errors.push({ code: 'RUNBOOK_INVALID', field: 'safety_boundary' });
  }
  if (hasSensitiveKey(value)) errors.push({ code: 'PRIVACY_UNSAFE_TELEMETRY', field: '$' });
  return validationResult(errors, value);
}

export function createOfflineRunbookManifest(runbookId, title, overrides = {}) {
  return Object.freeze({
    runbook_contract_version: CONTRACT_VERSIONS.runbook,
    runbook_id: runbookId,
    title,
    version: '1.0.0',
    purpose: 'Offline readiness procedure; execution authority is withheld.',
    authority_roles: ['HUMAN_DEPLOYMENT_GOVERNOR'],
    prerequisites: ['APPROVED_EVIDENCE_PACKAGE', 'EMERGENCY_DISABLE_TRUE'],
    inputs: ['CONTENT_FREE_RECEIPT_REFERENCES'],
    ordered_steps: ['VERIFY_AUTHORITY', 'VERIFY_DEFAULT_OFF', 'STOP_WITHOUT_EXECUTION'],
    verification: ['ACTIVATION_REMAINS_INACTIVE', 'NO_EXTERNAL_CALLS'],
    evidence_outputs: ['CONTENT_FREE_VALIDATION_RECEIPT'],
    rollback: ['KEEP_EMERGENCY_DISABLE_TRUE', 'RETURN_FOR_ARCHITECTURE_REVIEW'],
    stop_conditions: ['STOP_IF_CREDENTIAL_OR_PLATFORM_AUTHORITY_REQUIRED'],
    escalation: ['HUMAN_ARCHITECTURE_AND_SECURITY_REVIEW'],
    prohibited_actions: [
      'NO_DEPLOYMENT_OR_PLATFORM_ACTION',
      'NO_PUBLIC_ACCESS',
      'NO_LIVE_PROVIDER_OR_PERSISTENCE',
      'NO_MIGRATION_DELETION_OR_STRIPE',
    ],
    credential_required: false,
    production_action_required: false,
    ...overrides,
  });
}

export function validateRunbookSet(manifests) {
  const ids = new Set((manifests ?? []).map((item) => item.runbook_id));
  const missing = REQUIRED_RUNBOOK_IDS.filter((id) => !ids.has(id));
  const invalid = (manifests ?? []).filter((item) => !validateRunbookManifest(item).valid).map((item) => item.runbook_id);
  return Object.freeze({
    valid: missing.length === 0 && invalid.length === 0 && ids.size === REQUIRED_RUNBOOK_IDS.length,
    missing: Object.freeze(missing),
    invalid: Object.freeze(invalid),
  });
}
