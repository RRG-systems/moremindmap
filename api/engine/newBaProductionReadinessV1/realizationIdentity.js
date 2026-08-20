import { NEW_BA_FROZEN_AUTHORITY } from './frozenAuthority.js';
import { isSha256, normalizeAssessmentId, normalizeProfileId, sha256Stable } from './stable.js';

export const NEW_BA_REALIZATION_IDENTITY_VERSION = 'new_ba_composite_realization_identity_v2';

export function buildNewBaRealizationIdentity({
  profileId,
  assessmentId,
  evidenceSha256,
  bosAuthoritySha256,
  bosFusionContractSha256,
  bosEvidenceBoundarySha256,
  compatibilityClass,
  providerModel = 'gpt-5.6-sol',
  frozenAuthority = NEW_BA_FROZEN_AUTHORITY,
} = {}) {
  const profile = normalizeProfileId(profileId);
  const assessment = normalizeAssessmentId(assessmentId);
  if (!isSha256(evidenceSha256)) throw new Error('new_ba_identity_evidence_hash_invalid');
  if (!isSha256(bosAuthoritySha256)) throw new Error('new_ba_identity_bos_hash_invalid');
  if (!isSha256(bosFusionContractSha256)) throw new Error('new_ba_identity_bos_fusion_contract_hash_invalid');
  if (!isSha256(bosEvidenceBoundarySha256)) throw new Error('new_ba_identity_bos_evidence_boundary_hash_invalid');
  if (!['A', 'B'].includes(compatibilityClass)) throw new Error('new_ba_identity_incompatible');
  if (providerModel !== 'gpt-5.6-sol') throw new Error('new_ba_identity_model_mismatch');
  const components = Object.freeze({
    profile_id: profile,
    assessment_id: assessment,
    canonical_business_evidence_sha256: evidenceSha256,
    bos_authority_sha256: bosAuthoritySha256,
    bos_fusion_contract_sha256: bosFusionContractSha256,
    bos_evidence_boundary_sha256: bosEvidenceBoundarySha256,
    bos_ba_fusion_policy_version: 'business-cause-from-business-evidence_execution-modifiers-from-bos_v1',
    ba_intelligence_version: 'wbm-v1_five-futures-v2_one-move-v2_plan-135-v1',
    universal_authority_manifest_sha256: frozenAuthority.wbm_manifest_sha256,
    cassette_version: frozenAuthority.cassette_version,
    projection_version: frozenAuthority.projection_version,
    real_profile_projection_adapter_version: frozenAuthority.real_profile_projection_adapter_version,
    projection_sha256: frozenAuthority.progressive_disclosure_projection_sha256,
    ui_version: frozenAuthority.ui_version,
    ui_sha256: frozenAuthority.progressive_disclosure_ui_sha256,
    provider_model: providerModel,
    provider_policy_version: frozenAuthority.provider_policy_version,
    compatibility_class: compatibilityClass,
  });
  const sha256 = sha256Stable(components);
  return Object.freeze({
    version: NEW_BA_REALIZATION_IDENTITY_VERSION,
    realization_id: `new-ba:${profile}:${assessment}:${sha256}`,
    sha256,
    components,
  });
}

export function sameNewBaRealizationIdentity(left, right) {
  return left?.version === NEW_BA_REALIZATION_IDENTITY_VERSION
    && right?.version === NEW_BA_REALIZATION_IDENTITY_VERSION
    && left.sha256 === right.sha256
    && left.realization_id === right.realization_id;
}
