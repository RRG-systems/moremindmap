import {
  BA_VERTICAL_FAILURE_CODES,
  BaVerticalContractError,
} from './contracts.js';
import { PRODUCTION_BA_CASSETTE_REGISTRY } from './registry.js';

export function projectBaCassetteBindingToSubscriptionVerticalContext(binding, {
  registry = PRODUCTION_BA_CASSETTE_REGISTRY,
} = {}) {
  if (!binding || typeof binding !== 'object') {
    throw new BaVerticalContractError(BA_VERTICAL_FAILURE_CODES.BINDING_MISMATCH);
  }
  const registration = registry.resolveVertical(binding.vertical_id);
  const exact = [
    ['cassette_id', registration.cassette_id],
    ['cassette_version', registration.cassette_version],
    ['cassette_manifest_sha256', registration.cassette_manifest_sha256],
    ['intake_contract_sha256', registration.intake_contract.sha256],
    ['evidence_contract_sha256', registration.evidence_contract.sha256],
    ['box_1_projection_contract_sha256', registration.box_1_projection.sha256],
  ];
  const mismatch = exact.find(([key, expected]) => binding[key] !== expected);
  if (mismatch) {
    throw new BaVerticalContractError(
      mismatch[0].endsWith('_sha256')
        ? BA_VERTICAL_FAILURE_CODES.AUTHORITY_HASH_MISMATCH
        : BA_VERTICAL_FAILURE_CODES.BINDING_MISMATCH,
      mismatch[0],
    );
  }
  return Object.freeze({
    vertical_id: registration.downstream.subscription_vertical_id,
    ba_vertical_id: registration.vertical_id,
    ba_cassette_id: registration.cassette_id,
    ba_cassette_version: registration.cassette_version,
    ba_cassette_manifest_sha256: registration.cassette_manifest_sha256,
    provenance: 'GOVERNED_BA_CASSETTE_BINDING',
  });
}
