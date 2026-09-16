import { hashCanonicalJson } from '../../../src/lib/intelligenceFabric/hashing.js';
import { deepFreeze } from '../../../src/lib/intelligenceFabric/validation.js';
import { normalizeProfileId as normalizePaidProfileId } from '../../../src/lib/publicSiteAirlockV1/contracts.js';
import { resolveBundledBosAuthority } from '../newBaProductionReadinessV1/canonicalReader.js';
import {
  NEW_BA_COMPLETENESS_STATUS,
  validateCompleteNewBaRealization,
} from '../newBaProductionReadinessV1/completeness.js';
import {
  projectBosFusionAuthorityFromArtifact,
  validateBosFusionAuthority,
} from '../newBaProductionReadinessV1/fusionContract.js';
import {
  NEW_BA_LAUNCH_SAFE_ENVELOPE_VERSION,
  validateLaunchSafeNewBaEnvelope,
} from '../newBaProductionReadinessV1/launchSafeRealizationStore.js';
import {
  isSha256,
  normalizeProfileId as normalizeNewBaProfileId,
  sha256Stable,
} from '../newBaProductionReadinessV1/stable.js';
import { validateLaunchSafeRealizationEnvelope as validateLaunchSafeNewBosEnvelope } from '../newBosProductionReadinessV1/launchSafeRealizationStore.js';

function deny(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function requireCondition(condition, code) {
  if (!condition) deny(code);
}

function canonicalTimestamp(value, code) {
  requireCondition(typeof value === 'string' && Number.isFinite(Date.parse(value)), code);
  return new Date(value).toISOString();
}

function assertHash(value, code) {
  requireCondition(isSha256(value), code);
  return value;
}

export const PAID_SUBSCRIBER_COMPLETENESS_POLICY = Object.freeze({
  COMPLETE_ONLY: 'COMPLETE_ONLY',
  CANONICAL_PAID_LO_OPEN_PLAN: 'CANONICAL_PAID_LO_OPEN_PLAN',
  SYNTHETIC_QA_RELEASE_4_LO_OPEN_PLAN: 'SYNTHETIC_QA_RELEASE_4_LO_OPEN_PLAN',
});

export function paidSubscriberCompletenessPolicy({ verticalId, syntheticOnly = false } = {}) {
  if (verticalId === 'loan_originator') {
    return syntheticOnly
      ? PAID_SUBSCRIBER_COMPLETENESS_POLICY.SYNTHETIC_QA_RELEASE_4_LO_OPEN_PLAN
      : PAID_SUBSCRIBER_COMPLETENESS_POLICY.CANONICAL_PAID_LO_OPEN_PLAN;
  }
  return PAID_SUBSCRIBER_COMPLETENESS_POLICY.COMPLETE_ONLY;
}

export function isPaidSubscriberCompletenessAccepted({
  validation,
  record,
  policy = PAID_SUBSCRIBER_COMPLETENESS_POLICY.COMPLETE_ONLY,
} = {}) {
  if (validation?.status === NEW_BA_COMPLETENESS_STATUS.COMPLETE) {
    return !record?.artifact
      || record.completeness?.status === NEW_BA_COMPLETENESS_STATUS.COMPLETE;
  }
  if (![PAID_SUBSCRIBER_COMPLETENESS_POLICY.CANONICAL_PAID_LO_OPEN_PLAN,
    PAID_SUBSCRIBER_COMPLETENESS_POLICY.SYNTHETIC_QA_RELEASE_4_LO_OPEN_PLAN].includes(policy)
    || validation?.status !== NEW_BA_COMPLETENESS_STATUS.VALID_ANALYSIS_WITH_OPEN_PLAN
    || !record?.artifact) {
    return false;
  }
  const artifact = record.artifact;
  const receipt = record.completeness;
  return record.envelope_version === NEW_BA_LAUNCH_SAFE_ENVELOPE_VERSION
    && artifact.cassette_binding?.vertical_id === 'loan_originator'
    && artifact.business_reality?.assessment_identity?.vertical === 'loan_originator'
    && artifact.lineage?.vertical_id === 'loan_originator'
    && artifact.customer_view_model?.vertical?.vertical_id === 'loan_originator'
    && artifact.plan_135?.plan_state === 'LO_OPEN_DRAFT'
    && validation.plan_state === 'LO_OPEN_DRAFT'
    && validation.plan_customer_commitment === false
    && validation.customer_plan_status === 'OPEN_NOT_CUSTOMER_AGREED'
    && validation.customer_plan_complete === false
    && validation.storage_eligible === true
    && receipt?.status === NEW_BA_COMPLETENESS_STATUS.VALID_ANALYSIS_WITH_OPEN_PLAN
    && receipt.plan_state === validation.plan_state
    && receipt.plan_customer_commitment === false
    && receipt.customer_plan_status === validation.customer_plan_status
    && receipt.customer_plan_complete === false
    && receipt.storage_eligible === true;
}

export function assertCanonicalLineage(artifact, realizationIdentity = null) {
  const lineage = artifact.lineage;
  requireCondition(lineage?.profile_id === artifact.profile_id
    && lineage?.assessment_id === artifact.assessment_id, 'PAID_SUBSCRIBER_REALIZATION_LINEAGE_IDENTITY_MISMATCH');
  const hashes = {
    business_evidence: assertHash(lineage.business_evidence_sha256, 'PAID_SUBSCRIBER_BUSINESS_EVIDENCE_HASH_REQUIRED'),
    vertical_binding: assertHash(lineage.vertical_binding_sha256, 'PAID_SUBSCRIBER_VERTICAL_BINDING_HASH_REQUIRED'),
    bos_authority: assertHash(lineage.bos_authority_sha256, 'PAID_SUBSCRIBER_BOS_AUTHORITY_HASH_REQUIRED'),
    bos_fusion_contract: assertHash(lineage.bos_fusion_contract_sha256, 'PAID_SUBSCRIBER_BOS_FUSION_CONTRACT_HASH_REQUIRED'),
    whole_business_model: assertHash(lineage.whole_business_model_sha256, 'PAID_SUBSCRIBER_WBM_HASH_REQUIRED'),
    five_futures: assertHash(lineage.five_futures_sha256, 'PAID_SUBSCRIBER_FUTURES_HASH_REQUIRED'),
    one_move: assertHash(lineage.one_move_sha256, 'PAID_SUBSCRIBER_ONE_MOVE_HASH_REQUIRED'),
    plan: assertHash(lineage.plan_sha256, 'PAID_SUBSCRIBER_PLAN_HASH_REQUIRED'),
    customer_projection: assertHash(lineage.customer_projection_sha256, 'PAID_SUBSCRIBER_CUSTOMER_PROJECTION_HASH_REQUIRED'),
    fusion: assertHash(artifact.fusion?.proof_sha256, 'PAID_SUBSCRIBER_FUSION_HASH_REQUIRED'),
  };
  const wbmAssessment = artifact.business_reality?.assessment_identity;
  const frozenBos = artifact.business_reality?.frozen_whole_person_authority;
  const fusionBos = artifact.fusion?.bos_authority;
  requireCondition(hashes.whole_business_model === artifact.business_reality?.state_hash
    && hashes.five_futures === artifact.five_futures?.artifact_hash
    && hashes.one_move === artifact.one_move?.artifact_hash
    && hashes.plan === sha256Stable(artifact.plan_135)
    && hashes.customer_projection === sha256Stable(artifact.customer_view_model), 'PAID_SUBSCRIBER_REALIZATION_LINEAGE_HASH_MISMATCH');
  requireCondition(wbmAssessment?.assessment_id === artifact.assessment_id
    && normalizePaidProfileId(wbmAssessment?.owner_profile_id) === normalizePaidProfileId(artifact.profile_id)
    && frozenBos?.bos_hash === hashes.bos_authority
    && fusionBos?.artifact_sha256 === hashes.bos_authority
    && fusionBos?.fusion_contract_sha256 === hashes.bos_fusion_contract,
  'PAID_SUBSCRIBER_RECORDED_AUTHORITY_BINDING_MISMATCH');
  if (realizationIdentity) {
    const components = realizationIdentity.components || {};
    const identitySha256 = sha256Stable(components);
    requireCondition(realizationIdentity.sha256 === identitySha256
      && realizationIdentity.realization_id === `new-ba:${artifact.profile_id}:${artifact.assessment_id}:${identitySha256}`
      && components.profile_id === artifact.profile_id
      && components.assessment_id === artifact.assessment_id
      && components.canonical_business_evidence_sha256 === hashes.business_evidence
      && components.bos_authority_sha256 === hashes.bos_authority
      && components.bos_fusion_contract_sha256 === hashes.bos_fusion_contract
      && (!components.vertical_binding_sha256 || components.vertical_binding_sha256 === hashes.vertical_binding),
    'PAID_SUBSCRIBER_REALIZATION_IDENTITY_BINDING_MISMATCH');
  }
  return deepFreeze(hashes);
}

export function assertPaidBusinessScope(scope, assessmentId, verticalBindingSha256) {
  const expectedBusinessId = `business_${hashCanonicalJson({
    domain: 'more-paid-subscription-business-v1',
    profile_id: scope.profile_id,
    assessment_id: assessmentId,
    vertical_binding_sha256: verticalBindingSha256,
  }).slice(0, 40)}`;
  requireCondition(scope.business_id === expectedBusinessId, 'PAID_SUBSCRIBER_ASSESSMENT_BUSINESS_BINDING_MISMATCH');
}

export function completedRealization(
  record,
  profileId,
  suppliedAssessmentId = null,
  { completenessPolicy = PAID_SUBSCRIBER_COMPLETENESS_POLICY.COMPLETE_ONLY } = {},
) {
  requireCondition(record && typeof record === 'object', 'PAID_SUBSCRIBER_COMPLETED_REALIZATION_REQUIRED');
  if (record.envelope_version) validateLaunchSafeNewBaEnvelope(record, { profileId });
  const artifact = record.artifact || record;
  requireCondition(artifact?.contract_id === 'new-ba-production-realization-v2', 'PAID_SUBSCRIBER_REALIZATION_V2_REQUIRED');
  const assessmentId = artifact.assessment_id;
  const validation = validateCompleteNewBaRealization(artifact, { profileId, assessmentId });
  requireCondition(isPaidSubscriberCompletenessAccepted({
    validation,
    record,
    policy: completenessPolicy,
  })
    && validation.fusion_validated === true
    && artifact.profile_id === profileId, 'PAID_SUBSCRIBER_COMPLETE_BOS_BA_REQUIRED');
  if (record.artifact) {
    requireCondition(record.profile_id === profileId
      && record.assessment_id === assessmentId
      && record.completeness?.status === validation.status
      && ['A', 'B'].includes(record.compatibility?.class)
      && record.provider_accounting?.store === false
      && record.artifact_sha256 === sha256Stable(artifact), 'PAID_SUBSCRIBER_LAUNCH_SAFE_REALIZATION_REQUIRED');
  }
  if (suppliedAssessmentId != null) {
    requireCondition(suppliedAssessmentId === assessmentId, 'PAID_SUBSCRIBER_ASSESSMENT_BINDING_MISMATCH');
  }
  return {
    artifact,
    assessment_id: assessmentId,
    created_at: canonicalTimestamp(record.created_at, 'PAID_SUBSCRIBER_REALIZATION_TIMESTAMP_REQUIRED'),
  };
}

export function completedBosFusionAuthority(record, {
  profileId,
  baArtifact,
  baHashes,
  baIdentity,
  resolveBundledBosAuthorityForProfile,
}) {
  if (!record) {
    const bundled = resolveBundledBosAuthorityForProfile(profileId);
    const authority = bundled?.fusion_authority
      ? validateBosFusionAuthority(bundled.fusion_authority, { profileId })
      : null;
    const recorded = baArtifact.fusion?.bos_authority;
    requireCondition(bundled?.compatible === true
      && bundled?.profile_id === profileId
      && bundled?.custody === 'FROZEN_REPOSITORY_REFERENCE'
      && authority?.custody === 'FROZEN_REPOSITORY_PROJECTION'
      && bundled.realization_id === recorded?.realization_id
      && bundled.sha256 === baHashes.bos_authority
      && bundled.sha256 === authority.source_artifact_sha256
      && bundled.fusion_contract_sha256 === baHashes.bos_fusion_contract
      && bundled.fusion_contract_sha256 === authority.contract_sha256
      && bundled.evidence_boundary_sha256 === authority.evidence_boundary_sha256
      && recorded?.source_version === authority.source_version
      && recorded?.evidence_boundary_sha256 === authority.evidence_boundary_sha256
      && recorded?.claim_count === authority.claims.length
      && baIdentity?.components?.bos_evidence_boundary_sha256 === authority.evidence_boundary_sha256,
    'PAID_SUBSCRIBER_RECORDED_BOS_REALIZATION_REQUIRED');
    return null;
  }
  requireCondition(typeof record === 'object', 'PAID_SUBSCRIBER_COMPLETED_BOS_REALIZATION_REQUIRED');
  validateLaunchSafeNewBosEnvelope(record, { profileId });
  requireCondition(['A', 'B'].includes(record.compatibility?.class)
    && record.provider_accounting?.store === false,
  'PAID_SUBSCRIBER_LAUNCH_SAFE_BOS_REALIZATION_REQUIRED');
  const authority = projectBosFusionAuthorityFromArtifact({
    artifact: record.artifact,
    profileId,
    realizationId: record.realization_id,
    artifactSha256: record.artifact_sha256,
    realizationVersion: record.realization_identity?.version,
  });
  const recorded = baArtifact.fusion?.bos_authority;
  requireCondition(record.artifact_sha256 === baHashes.bos_authority
    && authority.source_artifact_sha256 === baHashes.bos_authority
    && authority.source_realization_id === record.realization_id
    && authority.contract_sha256 === baHashes.bos_fusion_contract
    && recorded?.realization_id === record.realization_id
    && recorded?.artifact_sha256 === record.artifact_sha256
    && recorded?.source_version === authority.source_version
    && recorded?.fusion_contract_sha256 === authority.contract_sha256
    && recorded?.evidence_boundary_sha256 === authority.evidence_boundary_sha256
    && recorded?.claim_count === authority.claims.length
    && baIdentity?.components?.bos_evidence_boundary_sha256 === authority.evidence_boundary_sha256,
  'PAID_SUBSCRIBER_BOS_AUTHORITY_SNAPSHOT_BINDING_MISMATCH');
  return authority;
}

export function validatePaidSubscriberRuntimeCustody({
  profile_id,
  assessment_id,
  realization_record,
  bos_realization_record,
  completeness_policy = PAID_SUBSCRIBER_COMPLETENESS_POLICY.COMPLETE_ONLY,
  resolveBundledBosAuthorityForProfile = resolveBundledBosAuthority,
} = {}) {
  const profileId = normalizeNewBaProfileId(profile_id);
  const completed = completedRealization(realization_record, profileId, assessment_id, {
    completenessPolicy: completeness_policy,
  });
  const hashes = assertCanonicalLineage(
    completed.artifact,
    realization_record?.realization_identity || null,
  );
  completedBosFusionAuthority(bos_realization_record, {
    profileId,
    baArtifact: completed.artifact,
    baHashes: hashes,
    baIdentity: realization_record?.realization_identity || null,
    resolveBundledBosAuthorityForProfile,
  });
  return deepFreeze({
    profile_id: profileId,
    assessment_id: completed.assessment_id,
    realization_id: realization_record.realization_id,
    artifact_sha256: realization_record.artifact_sha256,
    vertical_binding_sha256: hashes.vertical_binding,
    compatibility_class: realization_record.compatibility?.class,
    bos_realization_id: completed.artifact.fusion?.bos_authority?.realization_id,
    bos_artifact_sha256: hashes.bos_authority,
    bos_custody_source: bos_realization_record
      ? 'EXACT_RECORDED_LAUNCH_SAFE_BOS_REALIZATION'
      : 'FROZEN_REPOSITORY_BOS_REFERENCE',
    provider_store: false,
    mutation_performed: false,
  });
}
