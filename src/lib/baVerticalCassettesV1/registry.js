import {
  BA_VERTICAL_FAILURE_CODES,
  BA_VERTICAL_SELECTION_CONFIRMATION,
  BA_VERTICAL_SELECTION_CONTRACT_VERSION,
  BaVerticalContractError,
  deepFreeze,
} from './contracts.js';
import { REAL_ESTATE_CASSETTE_REGISTRATION } from './realEstateCassette.js';

function normalizeId(value) {
  return String(value || '').trim().toLowerCase();
}

function assertRegistration(registration) {
  if (!registration || typeof registration !== 'object') {
    throw new BaVerticalContractError(BA_VERTICAL_FAILURE_CODES.REGISTRATION_MISSING);
  }
  for (const key of ['vertical_id', 'vertical_label', 'cassette_id', 'cassette_version', 'cassette_manifest_sha256', 'cassette_registry_sha256']) {
    if (!registration[key]) throw new BaVerticalContractError(BA_VERTICAL_FAILURE_CODES.REGISTRATION_MISSING, key);
  }
  if (!registration.intake_contract?.questions?.length || !registration.evidence_contract?.question_authority) {
    throw new BaVerticalContractError(BA_VERTICAL_FAILURE_CODES.REGISTRATION_MISSING, 'intake_or_evidence_contract');
  }
  if (!registration.wbm_authority?.route
    || !registration.box_1_projection?.contract_id
    || !registration.box_1_projection?.version
    || !registration.box_1_projection?.adapter_id) {
    throw new BaVerticalContractError(BA_VERTICAL_FAILURE_CODES.REGISTRATION_MISSING, 'wbm_or_projection_binding');
  }
  for (const value of [
    registration.cassette_manifest_sha256,
    registration.cassette_registry_sha256,
    registration.intake_contract?.sha256,
    registration.evidence_contract?.sha256,
    registration.box_1_projection?.sha256,
  ]) {
    if (!/^[a-f0-9]{64}$/u.test(String(value || ''))) {
      throw new BaVerticalContractError(BA_VERTICAL_FAILURE_CODES.AUTHORITY_HASH_MISMATCH, 'registration_hash');
    }
  }
  return registration;
}

export function createGovernedCassetteRegistry(registrations = [REAL_ESTATE_CASSETTE_REGISTRATION]) {
  const byVertical = new Map();
  const byCassette = new Map();
  for (const candidate of registrations) {
    const registration = deepFreeze(structuredClone(assertRegistration(candidate)));
    const verticalId = normalizeId(registration.vertical_id);
    const cassetteId = normalizeId(registration.cassette_id);
    if (byVertical.has(verticalId) || byCassette.has(cassetteId)) {
      throw new BaVerticalContractError(BA_VERTICAL_FAILURE_CODES.BINDING_MISMATCH, 'duplicate_registration');
    }
    byVertical.set(verticalId, registration);
    byCassette.set(cassetteId, registration);
  }

  return Object.freeze({
    listSupported() {
      return Object.freeze([...byVertical.values()].filter((item) => item.supported && item.active));
    },
    resolveVertical(verticalId) {
      const registration = byVertical.get(normalizeId(verticalId));
      if (!registration || !registration.supported || !registration.active) {
        throw new BaVerticalContractError(BA_VERTICAL_FAILURE_CODES.SELECTION_UNSUPPORTED);
      }
      return registration;
    },
    resolveCassette(cassetteId) {
      const registration = byCassette.get(normalizeId(cassetteId));
      if (!registration || !registration.supported || !registration.active) {
        throw new BaVerticalContractError(BA_VERTICAL_FAILURE_CODES.REGISTRATION_MISSING);
      }
      return registration;
    },
    hasVertical(verticalId) {
      return byVertical.has(normalizeId(verticalId));
    },
  });
}

export const PRODUCTION_BA_CASSETTE_REGISTRY = createGovernedCassetteRegistry();

export function resolveConfirmedVerticalSelection(selection, { registry = PRODUCTION_BA_CASSETTE_REGISTRY } = {}) {
  if (!selection) throw new BaVerticalContractError(BA_VERTICAL_FAILURE_CODES.SELECTION_REQUIRED);
  if (typeof selection !== 'object' || Array.isArray(selection)) {
    throw new BaVerticalContractError(BA_VERTICAL_FAILURE_CODES.SELECTION_MALFORMED);
  }
  if (selection.contract_version !== BA_VERTICAL_SELECTION_CONTRACT_VERSION) {
    throw new BaVerticalContractError(BA_VERTICAL_FAILURE_CODES.SELECTION_MALFORMED, 'contract_version');
  }
  const registration = registry.resolveVertical(selection.vertical_id);
  if (selection.confirmation !== BA_VERTICAL_SELECTION_CONFIRMATION) {
    throw new BaVerticalContractError(BA_VERTICAL_FAILURE_CODES.SELECTION_UNCONFIRMED);
  }
  if (normalizeId(selection.cassette_id) !== normalizeId(registration.cassette_id)
    || String(selection.cassette_version || '') !== registration.cassette_version) {
    throw new BaVerticalContractError(BA_VERTICAL_FAILURE_CODES.BINDING_MISMATCH);
  }
  return registration;
}

export function buildCustomerConfirmedSelection(registration) {
  const accepted = assertRegistration(registration);
  return deepFreeze({
    contract_version: BA_VERTICAL_SELECTION_CONTRACT_VERSION,
    vertical_id: accepted.vertical_id,
    cassette_id: accepted.cassette_id,
    cassette_version: accepted.cassette_version,
    confirmation: BA_VERTICAL_SELECTION_CONFIRMATION,
  });
}

export function suggestVerticalFromIndustry(industry, { registry = PRODUCTION_BA_CASSETTE_REGISTRY } = {}) {
  const normalized = normalizeId(industry).replaceAll(/[^a-z0-9]+/gu, '_');
  if (!normalized) return Object.freeze({ status: 'NONE', vertical_id: null, label: '' });
  if (normalized === 'real_estate' || normalized.includes('realtor') || normalized.includes('real_estate')) {
    const registration = registry.resolveVertical('real_estate');
    return Object.freeze({ status: 'SUPPORTED_SUGGESTION', vertical_id: registration.vertical_id, label: registration.vertical_label });
  }
  return Object.freeze({ status: 'UNSUPPORTED_SUGGESTION', vertical_id: null, label: String(industry).trim() });
}
