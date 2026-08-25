import crypto from 'node:crypto';

import {
  BA_VERTICAL_FAILURE_CODES,
  BA_VERTICAL_SELECTION_CONTRACT_VERSION,
  BaVerticalContractError,
  PRODUCTION_BA_CASSETTE_REGISTRY,
  deepFreeze,
  resolveConfirmedVerticalSelection,
  stableCanonicalize,
} from '../../src/lib/baVerticalCassettesV1/index.js';

export const BA_VERTICAL_BINDING_VERSION = 'ba-vertical-binding-v1';

function sha256Stable(value) {
  return crypto.createHash('sha256').update(stableCanonicalize(value)).digest('hex');
}

function bindingCore(registration, { selectedAt, selectionSource, historicalConfirmationTime }) {
  return {
    binding_version: BA_VERTICAL_BINDING_VERSION,
    selection_contract_version: BA_VERTICAL_SELECTION_CONTRACT_VERSION,
    vertical_id: registration.vertical_id,
    vertical_label: registration.vertical_label,
    cassette_id: registration.cassette_id,
    cassette_version: registration.cassette_version,
    cassette_manifest_sha256: registration.cassette_manifest_sha256,
    cassette_registry_sha256: registration.cassette_registry_sha256,
    intake_contract_id: registration.intake_contract.contract_id,
    intake_contract_version: registration.intake_contract.version,
    intake_contract_sha256: registration.intake_contract.sha256,
    evidence_contract_id: registration.evidence_contract.contract_id,
    evidence_contract_version: registration.evidence_contract.version,
    evidence_contract_sha256: registration.evidence_contract.sha256,
    box_1_projection_contract_id: registration.box_1_projection.contract_id,
    box_1_projection_contract_version: registration.box_1_projection.version,
    box_1_projection_adapter_id: registration.box_1_projection.adapter_id,
    box_1_projection_contract_sha256: registration.box_1_projection.sha256,
    selection_source: selectionSource,
    selected_at: selectedAt,
    historical_confirmation_time: historicalConfirmationTime,
  };
}

function finalizeBinding(core) {
  return deepFreeze({ ...core, binding_sha256: sha256Stable(core) });
}

export function buildCustomerConfirmedVerticalBinding({
  selection,
  selectedAt = new Date().toISOString(),
  registry = PRODUCTION_BA_CASSETTE_REGISTRY,
} = {}) {
  if (!Number.isFinite(Date.parse(selectedAt))) {
    throw new BaVerticalContractError(BA_VERTICAL_FAILURE_CODES.SELECTION_MALFORMED, 'selected_at');
  }
  const registration = resolveConfirmedVerticalSelection(selection, { registry });
  return finalizeBinding(bindingCore(registration, {
    selectedAt,
    selectionSource: 'CUSTOMER_CONFIRMED',
    historicalConfirmationTime: 'KNOWN',
  }));
}

export function buildLegacyRealEstateVerticalBinding(record, {
  registry = PRODUCTION_BA_CASSETTE_REGISTRY,
} = {}) {
  const registration = registry.resolveVertical('real_estate');
  if (record?.version !== registration.compatibility.assessment_version
    || !registration.compatibility.legacy_assessment_types.includes(record?.assessment_type)) {
    throw new BaVerticalContractError(BA_VERTICAL_FAILURE_CODES.LEGACY_IDENTITY_AMBIGUOUS);
  }
  return finalizeBinding(bindingCore(registration, {
    selectedAt: null,
    selectionSource: 'LEGACY_EXPLICIT_COMPATIBILITY',
    historicalConfirmationTime: 'UNKNOWN',
  }));
}

export function validatePersistedVerticalBinding(binding, {
  registry = PRODUCTION_BA_CASSETTE_REGISTRY,
} = {}) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
    throw new BaVerticalContractError(BA_VERTICAL_FAILURE_CODES.BINDING_MISMATCH);
  }
  const registration = registry.resolveVertical(binding.vertical_id);
  const expected = bindingCore(registration, {
    selectedAt: binding.selected_at ?? null,
    selectionSource: binding.selection_source,
    historicalConfirmationTime: binding.historical_confirmation_time,
  });
  for (const [key, value] of Object.entries(expected)) {
    if (binding[key] !== value) {
      const code = key.endsWith('_sha256')
        ? BA_VERTICAL_FAILURE_CODES.AUTHORITY_HASH_MISMATCH
        : BA_VERTICAL_FAILURE_CODES.BINDING_MISMATCH;
      throw new BaVerticalContractError(code, key);
    }
  }
  if (binding.binding_sha256 !== sha256Stable(expected)) {
    throw new BaVerticalContractError(BA_VERTICAL_FAILURE_CODES.AUTHORITY_HASH_MISMATCH, 'binding_sha256');
  }
  return deepFreeze({ ...binding });
}

export function resolveAssessmentVerticalBinding(record, options = {}) {
  if (record?.vertical_binding !== undefined && record?.vertical_binding !== null) {
    return validatePersistedVerticalBinding(record.vertical_binding, options);
  }
  return buildLegacyRealEstateVerticalBinding(record, options);
}

export function verticalBindingDigestPayload(binding) {
  const { binding_sha256: ignored, ...payload } = binding || {};
  void ignored;
  return deepFreeze(payload);
}
