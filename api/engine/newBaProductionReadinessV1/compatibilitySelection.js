import {
  NEW_BA_REALIZATION_IDENTITY_VERSION,
  NEW_BA_REALIZATION_IDENTITY_VERSION_V3,
} from './realizationIdentity.js';
import { sha256Stable } from './stable.js';
import { REAL_ESTATE_CASSETTE_REGISTRATION } from '../../../src/lib/baVerticalCassettesV1/index.js';

const COMPATIBLE_PRIOR_DRIFT_FIELDS = Object.freeze(new Set([
  'bos_authority_sha256',
  'bos_fusion_contract_sha256',
  'bos_evidence_boundary_sha256',
  'real_profile_projection_adapter_version',
  'projection_sha256',
  'ui_version',
  'ui_sha256',
]));

export function classifyCompatiblePriorRealization({ current, desiredIdentity } = {}) {
  const currentVersion = current?.realization_identity?.version;
  const desiredVersion = desiredIdentity?.version;
  const sameVersion = currentVersion === desiredVersion
    && [NEW_BA_REALIZATION_IDENTITY_VERSION, NEW_BA_REALIZATION_IDENTITY_VERSION_V3].includes(currentVersion);
  const explicitV2RealEstateCompatibility = currentVersion === NEW_BA_REALIZATION_IDENTITY_VERSION
    && desiredVersion === NEW_BA_REALIZATION_IDENTITY_VERSION_V3;
  if (!sameVersion && !explicitV2RealEstateCompatibility) {
    return Object.freeze({ serveable: false, reason: 'identity_version_mismatch', drift_fields: Object.freeze([]) });
  }
  if (current?.completeness?.status !== 'PASS') {
    return Object.freeze({ serveable: false, reason: 'current_realization_incomplete', drift_fields: Object.freeze([]) });
  }

  const currentComponents = current.realization_identity.components || {};
  const desiredComponents = desiredIdentity.components || {};
  const currentSha256 = sha256Stable(currentComponents);
  const desiredSha256 = sha256Stable(desiredComponents);
  const currentExpectedId = `new-ba:${currentComponents.profile_id}:${currentComponents.assessment_id}:${currentSha256}`;
  const desiredExpectedId = `new-ba:${desiredComponents.profile_id}:${desiredComponents.assessment_id}:${desiredSha256}`;
  if (current.realization_identity.sha256 !== currentSha256
    || current.realization_identity.realization_id !== currentExpectedId
    || desiredIdentity.sha256 !== desiredSha256
    || desiredIdentity.realization_id !== desiredExpectedId) {
    return Object.freeze({ serveable: false, reason: 'identity_digest_invalid', drift_fields: Object.freeze([]) });
  }
  if (explicitV2RealEstateCompatibility) {
    const registration = REAL_ESTATE_CASSETTE_REGISTRATION;
    const exactCassette = currentComponents.cassette_version === registration.cassette_id
      && desiredComponents.vertical_id === registration.vertical_id
      && desiredComponents.cassette_id === registration.cassette_id
      && desiredComponents.cassette_version === registration.cassette_version
      && desiredComponents.cassette_manifest_sha256 === registration.cassette_manifest_sha256
      && desiredComponents.cassette_registry_sha256 === registration.cassette_registry_sha256
      && desiredComponents.intake_contract_id === registration.intake_contract.contract_id
      && desiredComponents.intake_contract_version === registration.intake_contract.version
      && desiredComponents.intake_contract_sha256 === registration.intake_contract.sha256
      && desiredComponents.evidence_contract_id === registration.evidence_contract.contract_id
      && desiredComponents.evidence_contract_version === registration.evidence_contract.version
      && desiredComponents.evidence_contract_sha256 === registration.evidence_contract.sha256
      && desiredComponents.box_1_projection_contract_id === registration.box_1_projection.contract_id
      && desiredComponents.box_1_projection_contract_version === registration.box_1_projection.version
      && desiredComponents.box_1_projection_adapter_id === registration.box_1_projection.adapter_id
      && desiredComponents.box_1_projection_contract_sha256 === registration.box_1_projection.sha256;
    if (!exactCassette) {
      return Object.freeze({ serveable: false, reason: 'v2_cassette_compatibility_invalid', drift_fields: Object.freeze([]) });
    }
  }
  const verticalIdentityFields = new Set([
    'vertical_id', 'cassette_id', 'cassette_version', 'cassette_manifest_sha256', 'cassette_registry_sha256',
    'intake_contract_id', 'intake_contract_version', 'intake_contract_sha256',
    'evidence_contract_id', 'evidence_contract_version', 'evidence_contract_sha256',
    'box_1_projection_contract_id', 'box_1_projection_contract_version',
    'box_1_projection_adapter_id', 'box_1_projection_contract_sha256', 'vertical_binding_sha256',
  ]);
  const fields = [...new Set([...Object.keys(currentComponents), ...Object.keys(desiredComponents)])].sort();
  const driftFields = fields.filter((field) => currentComponents[field] !== desiredComponents[field]);
  const semanticDriftFields = explicitV2RealEstateCompatibility
    ? driftFields.filter((field) => !verticalIdentityFields.has(field))
    : driftFields;
  if (!semanticDriftFields.length && sameVersion) {
    return Object.freeze({ serveable: true, reason: 'identity_equivalent', drift_fields: Object.freeze([]) });
  }
  const prohibitedDrift = semanticDriftFields.filter((field) => !COMPATIBLE_PRIOR_DRIFT_FIELDS.has(field));
  if (prohibitedDrift.length) {
    return Object.freeze({ serveable: false, reason: 'canonical_authority_drift', drift_fields: Object.freeze(driftFields), prohibited_drift_fields: Object.freeze(prohibitedDrift) });
  }

  const fusion = current.artifact?.fusion;
  const frozenWholePerson = current.artifact?.business_reality?.frozen_whole_person_authority;
  if (!fusion?.proof_sha256 || fusion.bos_authority?.artifact_sha256 !== frozenWholePerson?.bos_hash) {
    return Object.freeze({ serveable: false, reason: 'recorded_bos_fusion_snapshot_invalid', drift_fields: Object.freeze(driftFields) });
  }
  return Object.freeze({
    serveable: true,
    reason: explicitV2RealEstateCompatibility
      ? 'immutable_v2_real_estate_prior_served_through_hash_validated_cassette_compatibility'
      : 'immutable_prior_remains_compatible',
    drift_fields: Object.freeze(driftFields),
    uses_recorded_bos_fusion_snapshot: true,
  });
}
