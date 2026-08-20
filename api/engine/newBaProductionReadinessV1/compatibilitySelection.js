import { NEW_BA_REALIZATION_IDENTITY_VERSION } from './realizationIdentity.js';
import { sha256Stable } from './stable.js';

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
  if (current?.realization_identity?.version !== NEW_BA_REALIZATION_IDENTITY_VERSION
    || desiredIdentity?.version !== NEW_BA_REALIZATION_IDENTITY_VERSION) {
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
  const fields = [...new Set([...Object.keys(currentComponents), ...Object.keys(desiredComponents)])].sort();
  const driftFields = fields.filter((field) => currentComponents[field] !== desiredComponents[field]);
  if (!driftFields.length) {
    return Object.freeze({ serveable: true, reason: 'identity_equivalent', drift_fields: Object.freeze([]) });
  }
  const prohibitedDrift = driftFields.filter((field) => !COMPATIBLE_PRIOR_DRIFT_FIELDS.has(field));
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
    reason: 'immutable_prior_remains_compatible',
    drift_fields: Object.freeze(driftFields),
    uses_recorded_bos_fusion_snapshot: true,
  });
}
