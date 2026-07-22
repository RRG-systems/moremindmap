import { AUTHORITY_TYPES, NO_MODEL_USED, NO_PROMPT_USED, NOT_CONFIGURED, PRIVACY_CLASSIFICATIONS, RECEIPT_TYPES, TRUTH_CLASSES, VALIDATION_ERROR_CODES } from './constants.js';
import { deepFreeze, isPlainObject, issue, requireEnum, requireString, validateTimestamp, validationResult } from './validation.js';

const RAW_PRIVATE_KEYS = new Set(['raw_content', 'raw_payload', 'transcript', 'message_body', 'secret', 'token']);
function findPrivateKeys(value, path = '$', found = [], seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return found;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (RAW_PRIVATE_KEYS.has(key)) found.push(`${path}.${key}`);
    findPrivateKeys(child, `${path}.${key}`, found, seen);
  }
  return found;
}

export function validateSourceReference(value) {
  const errors = [];
  if (!isPlainObject(value)) return validationResult('SourceReference', [issue(VALIDATION_ERROR_CODES.INVALID_TYPE, '$', 'source reference must be an object')]);
  for (const key of ['source_id', 'source_type', 'source_version', 'source_hash']) requireString(value[key], key, errors);
  for (const path of findPrivateKeys(value)) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_TYPE, path, 'source references must not embed raw private content'));
  return validationResult('SourceReference', errors, [], errors.length ? null : deepFreeze({ ...value }));
}

export function validateProvenanceRecord(value, { synthetic = false, deterministic = false } = {}) {
  const errors = [];
  if (!isPlainObject(value)) return validationResult('ProvenanceRecord', [issue(VALIDATION_ERROR_CODES.INVALID_TYPE, '$', 'provenance must be an object')]);
  requireString(value.source_id, 'source_id', errors);
  requireString(value.source_type, 'source_type', errors);
  requireString(value.source_version, 'source_version', errors);
  requireString(value.source_hash, 'source_hash', errors);
  if (!isPlainObject(value.source_actor)) errors.push(issue(VALIDATION_ERROR_CODES.PROVENANCE_REQUIRED, 'source_actor', 'source_actor attribution is required'));
  if (!isPlainObject(value.source_system)) errors.push(issue(VALIDATION_ERROR_CODES.PROVENANCE_REQUIRED, 'source_system', 'source_system attribution is required'));
  validateTimestamp(value.captured_at, 'captured_at', errors, true);
  validateTimestamp(value.transformed_at, 'transformed_at', errors);
  if (deterministic && !value.transformer_version) errors.push(issue(VALIDATION_ERROR_CODES.PROVENANCE_REQUIRED, 'transformer_version', 'deterministic transform requires transformer_version'));
  if (synthetic && (!value.model_receipt_id || !value.prompt_receipt_id)) errors.push(issue(VALIDATION_ERROR_CODES.PROVENANCE_REQUIRED, '$', 'model-derived provenance requires model and prompt receipt IDs'));
  for (const path of findPrivateKeys(value)) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_TYPE, path, 'provenance must not embed raw private content'));
  return validationResult('ProvenanceRecord', errors, [], errors.length ? null : deepFreeze({ parent_source_ids: [], ...value }));
}

export function validateUseReceipt(value) {
  const errors = [];
  if (!isPlainObject(value)) return validationResult('UseReceipt', [issue(VALIDATION_ERROR_CODES.INVALID_TYPE, '$', 'receipt must be an object')]);
  requireString(value.receipt_id, 'receipt_id', errors);
  requireEnum(value.receipt_type, RECEIPT_TYPES, 'receipt_type', errors);
  requireString(value.consumer_operation, 'consumer_operation', errors);
  requireString(value.consumer_version, 'consumer_version', errors);
  validateTimestamp(value.used_at, 'used_at', errors, true);
  requireString(value.tenant_id, 'tenant_id', errors);
  requireEnum(value.privacy_classification, PRIVACY_CLASSIFICATIONS, 'privacy_classification', errors);
  if (!Array.isArray(value.source_ids) || !Array.isArray(value.source_versions) || !Array.isArray(value.source_hashes) || value.source_ids.length !== value.source_versions.length || value.source_ids.length !== value.source_hashes.length || value.source_ids.some((_, i) => !value.source_versions[i] || !value.source_hashes[i])) {
    errors.push(issue(VALIDATION_ERROR_CODES.RECEIPT_SOURCE_INCOMPLETE, 'source_ids', 'each used source requires aligned ID, version, and hash'));
  }
  if (value.authority_type != null) requireEnum(value.authority_type, AUTHORITY_TYPES, 'authority_type', errors);
  if (value.truth_class != null) requireEnum(value.truth_class, TRUTH_CLASSES, 'truth_class', errors);
  if (value.receipt_type === 'MODEL_USE' && !value.model_name) errors.push(issue(VALIDATION_ERROR_CODES.REQUIRED, 'model_name', `model_name or ${NO_MODEL_USED} is required`));
  if (value.receipt_type === 'PROMPT_USE' && !value.prompt_id) errors.push(issue(VALIDATION_ERROR_CODES.REQUIRED, 'prompt_id', `prompt_id or ${NO_PROMPT_USED} is required`));
  if (value.receipt_type === 'POLICY_USE' && !value.policy_id) errors.push(issue(VALIDATION_ERROR_CODES.REQUIRED, 'policy_id', `policy_id or ${NOT_CONFIGURED} is required`));
  if (!isPlainObject(value.provenance)) errors.push(issue(VALIDATION_ERROR_CODES.PROVENANCE_REQUIRED, 'provenance', 'receipt provenance is required'));
  for (const path of findPrivateKeys(value)) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_TYPE, path, 'receipt must not embed raw private content'));
  const normalized = errors.length ? null : deepFreeze({ ...value, grants_authority: false, records_approval: false });
  return validationResult(`${value.receipt_type || 'Use'}Receipt`, errors, [], normalized);
}

export const validateEvidenceUseReceipt = (v) => validateUseReceipt({ ...v, receipt_type: 'EVIDENCE_USE' });
export const validateKnowledgeUseReceipt = (v) => validateUseReceipt({ ...v, receipt_type: 'KNOWLEDGE_USE' });
export const validateModelUseReceipt = (v) => validateUseReceipt({ ...v, receipt_type: 'MODEL_USE' });
export const validatePromptUseReceipt = (v) => validateUseReceipt({ ...v, receipt_type: 'PROMPT_USE' });
export const validatePolicyUseReceipt = (v) => validateUseReceipt({ ...v, receipt_type: 'POLICY_USE' });
export const validateAuthorityUseReceipt = (v) => validateUseReceipt({ ...v, receipt_type: 'AUTHORITY_USE' });
