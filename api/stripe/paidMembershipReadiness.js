import { validateCompleteNewBaRealization } from '../engine/newBaProductionReadinessV1/completeness.js';
import { validateLaunchSafeNewBaEnvelope } from '../engine/newBaProductionReadinessV1/launchSafeRealizationStore.js';
import { classifyCompatiblePriorRealization } from '../engine/newBaProductionReadinessV1/compatibilitySelection.js';
import {
  NEW_BA_REALIZATION_IDENTITY_VERSION_V3,
  buildNewBaRealizationIdentityV3,
} from '../engine/newBaProductionReadinessV1/realizationIdentity.js';
import {
  normalizeAssessmentId,
  normalizeProfileId as normalizeNewBaProfileId,
  sha256Stable,
} from '../engine/newBaProductionReadinessV1/stable.js';
import { normalizeSubscriptionGovernedAssessment } from '../engine/subscriptionV1/assessmentAuthority.js';
import {
  isPaidSubscriberCompletenessAccepted,
  paidSubscriberCompletenessPolicy,
  validatePaidSubscriberRuntimeCustody,
} from '../engine/subscriptionV1/paidSubscriberCustody.js';
import { normalizeProfileId } from '../../src/lib/publicSiteAirlockV1/contracts.js';

export const DEFAULT_PAID_NEW_BA_READINESS_NAMESPACE = 'nonprod:new-ba:v1';
export const DEFAULT_PAID_NEW_BOS_READINESS_NAMESPACE = 'nonprod:new-bos:production-canary:v1';

function reconciliationRequired() {
  throw new Error('paid_current_new_ba_readiness_reconciliation_required');
}

function readinessNamespace(value) {
  const namespace = String(value || DEFAULT_PAID_NEW_BA_READINESS_NAMESPACE).trim();
  if (!namespace.startsWith('preview:new-ba:') && !namespace.startsWith('nonprod:new-ba:')) {
    throw new Error('paid_current_new_ba_readiness_namespace_invalid');
  }
  return namespace;
}

function bosReadinessNamespace(value) {
  const namespace = String(value || DEFAULT_PAID_NEW_BOS_READINESS_NAMESPACE).trim();
  if (!namespace.startsWith('preview:new-bos:') && !namespace.startsWith('nonprod:new-bos:')) {
    throw new Error('paid_current_new_bos_readiness_namespace_invalid');
  }
  return namespace;
}

function parseEnvelope(raw) {
  if (typeof raw !== 'string' || !raw) reconciliationRequired();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) reconciliationRequired();
    return parsed;
  } catch {
    reconciliationRequired();
  }
}

function exactAssessmentAuthority(assessment, profileId) {
  try {
    const { governedEvidence, verticalBinding } = normalizeSubscriptionGovernedAssessment(
      assessment,
      normalizeNewBaProfileId(profileId),
    );
    const assessmentId = normalizeAssessmentId(governedEvidence.assessment_id);
    return {
      assessmentId,
      verticalBinding,
      businessEvidenceSha256: governedEvidence.evidence_sha256,
    };
  } catch {
    reconciliationRequired();
  }
}

function desiredV3Identity(envelope, {
  profileId,
  assessmentId,
  verticalBinding,
  businessEvidenceSha256,
}) {
  const artifact = envelope?.artifact || {};
  const lineage = artifact.lineage || {};
  const fusionBos = artifact.fusion?.bos_authority || {};
  try {
    return buildNewBaRealizationIdentityV3({
      profileId: normalizeNewBaProfileId(profileId),
      assessmentId,
      evidenceSha256: businessEvidenceSha256,
      bosAuthoritySha256: lineage.bos_authority_sha256,
      bosFusionContractSha256: lineage.bos_fusion_contract_sha256,
      bosEvidenceBoundarySha256: fusionBos.evidence_boundary_sha256,
      compatibilityClass: envelope.compatibility?.class,
      providerModel: envelope.realization_identity?.components?.provider_model,
      verticalBinding,
    });
  } catch {
    reconciliationRequired();
  }
}

function validateCurrentEnvelope(envelope, {
  profileId,
  assessmentId,
  verticalBinding,
  businessEvidenceSha256,
  pointer,
}) {
  const newBaProfileId = normalizeNewBaProfileId(profileId);
  try { validateLaunchSafeNewBaEnvelope(envelope, { profileId: newBaProfileId }); }
  catch { reconciliationRequired(); }

  const identity = envelope.realization_identity;
  const components = identity?.components || {};
  const artifact = envelope.artifact;
  let currentCompleteness;
  try {
    currentCompleteness = validateCompleteNewBaRealization(artifact, {
      profileId: newBaProfileId,
      assessmentId,
    });
  } catch {
    reconciliationRequired();
  }
  const lineage = artifact?.lineage || {};
  const { lineage_sha256: lineageSha256, ...lineageWithoutHash } = lineage;
  const assessmentIdentity = artifact?.business_reality?.assessment_identity || {};
  const frozenBos = artifact?.business_reality?.frozen_whole_person_authority || {};
  const fusionBos = artifact?.fusion?.bos_authority || {};
  const cassetteBinding = artifact?.cassette_binding || {};
  const projectedVertical = artifact?.customer_view_model?.vertical || {};
  const artifactProvider = artifact?.provider_accounting || {};
  const envelopeProvider = envelope?.provider_accounting || {};
  const expectedIdentity = desiredV3Identity(envelope, {
    profileId,
    assessmentId,
    verticalBinding,
    businessEvidenceSha256,
  });
  const expectedRealizationId = expectedIdentity.realization_id;
  const completenessPolicy = paidSubscriberCompletenessPolicy({
    verticalId: verticalBinding.vertical_id,
    syntheticOnly: false,
  });
  const verticalIdentityFields = [
    'vertical_id',
    'cassette_id',
    'cassette_version',
    'cassette_manifest_sha256',
    'cassette_registry_sha256',
    'intake_contract_id',
    'intake_contract_version',
    'intake_contract_sha256',
    'evidence_contract_id',
    'evidence_contract_version',
    'evidence_contract_sha256',
    'box_1_projection_contract_id',
    'box_1_projection_contract_version',
    'box_1_projection_adapter_id',
    'box_1_projection_contract_sha256',
  ];

  if (identity?.version !== NEW_BA_REALIZATION_IDENTITY_VERSION_V3
    || identity.sha256 !== sha256Stable(components)
    || identity.sha256 !== expectedIdentity.sha256
    || identity.realization_id !== expectedRealizationId
    || pointer !== expectedRealizationId
    || envelope.realization_id !== expectedRealizationId
    || envelope.assessment_id !== assessmentId
    || artifact.contract_id !== 'new-ba-production-realization-v2'
    || artifact.version !== '2.0.0'
    || artifact.source_kind !== 'SAVED_BUSINESS_ASSESSMENT'
    || components.profile_id !== newBaProfileId
    || components.assessment_id !== assessmentId
    || components.canonical_business_evidence_sha256 !== businessEvidenceSha256
    || components.canonical_business_evidence_sha256 !== lineage.business_evidence_sha256
    || components.vertical_binding_sha256 !== verticalBinding.binding_sha256
    || lineage.vertical_binding_sha256 !== verticalBinding.binding_sha256
    || lineage.vertical_id !== verticalBinding.vertical_id
    || lineage.cassette_id !== verticalBinding.cassette_id
    || lineage.cassette_version !== verticalBinding.cassette_version
    || lineageSha256 !== sha256Stable(lineageWithoutHash)
    || lineage.whole_business_model_sha256 !== artifact?.business_reality?.state_hash
    || lineage.five_futures_sha256 !== artifact?.five_futures?.artifact_hash
    || lineage.one_move_sha256 !== artifact?.one_move?.artifact_hash
    || lineage.plan_sha256 !== sha256Stable(artifact?.plan_135)
    || lineage.customer_projection_sha256 !== sha256Stable(artifact?.customer_view_model)
    || lineage.provider_response_direct_publication !== false
    || verticalIdentityFields.some((field) => components[field] !== verticalBinding[field])
    || components.bos_authority_sha256 !== lineage.bos_authority_sha256
    || components.bos_authority_sha256 !== frozenBos.bos_hash
    || components.bos_authority_sha256 !== fusionBos.artifact_sha256
    || components.bos_fusion_contract_sha256 !== lineage.bos_fusion_contract_sha256
    || components.bos_fusion_contract_sha256 !== fusionBos.fusion_contract_sha256
    || components.bos_evidence_boundary_sha256 !== fusionBos.evidence_boundary_sha256
    || artifact.profile_id !== newBaProfileId
    || artifact.assessment_id !== assessmentId
    || lineage.profile_id !== newBaProfileId
    || lineage.assessment_id !== assessmentId
    || normalizeProfileId(assessmentIdentity.owner_profile_id) !== profileId
    || assessmentIdentity.assessment_id !== assessmentId
    || assessmentIdentity.vertical !== verticalBinding.vertical_id
    || assessmentIdentity.vertical_binding?.binding_sha256 !== verticalBinding.binding_sha256
    || cassetteBinding.vertical_id !== verticalBinding.vertical_id
    || cassetteBinding.cassette_id !== verticalBinding.cassette_id
    || cassetteBinding.cassette_version !== verticalBinding.cassette_version
    || cassetteBinding.projection_contract_id !== verticalBinding.box_1_projection_contract_id
    || cassetteBinding.projection_contract_version !== verticalBinding.box_1_projection_contract_version
    || cassetteBinding.projection_contract_sha256 !== verticalBinding.box_1_projection_contract_sha256
    || cassetteBinding.adapter_id !== verticalBinding.box_1_projection_adapter_id
    || cassetteBinding.binding_sha256 !== verticalBinding.binding_sha256
    || projectedVertical.vertical_id !== verticalBinding.vertical_id
    || !['A', 'B'].includes(envelope.compatibility?.class)
    || !isPaidSubscriberCompletenessAccepted({
      validation: currentCompleteness,
      record: envelope,
      policy: completenessPolicy,
    })
    || currentCompleteness.contract_version !== 2
    || currentCompleteness.fusion_validated !== true
    || envelope.completeness?.artifact_sha256 !== currentCompleteness.artifact_sha256
    || envelope.completeness?.contract_version !== 2
    || envelope.completeness?.fusion_validated !== true
    || artifactProvider.model !== 'gpt-5.6-sol'
    || Number(artifactProvider.calls) !== 3
    || Number(artifactProvider.accepted_calls) !== 3
    || artifactProvider.store !== false
    || artifactProvider.raw_request_persisted !== false
    || artifactProvider.raw_response_persisted !== false
    || envelopeProvider.model !== 'gpt-5.6-sol'
    || Number(envelopeProvider.calls) !== 3
    || Number(envelopeProvider.accepted_calls) !== 3
    || envelopeProvider.store !== false
    || envelopeProvider.raw_request_persisted !== false
    || envelopeProvider.raw_response_persisted !== false
    || !Number.isFinite(Date.parse(envelope.created_at))) {
    reconciliationRequired();
  }

  return Object.freeze({
    ready: true,
    code: 'PAID_CURRENT_NEW_BA_MEMBERSHIP_READY',
    source: 'CURRENT_NEW_BA_LAUNCH_SAFE_REALIZATION',
    profile_id: profileId,
    assessment_id: assessmentId,
    realization_id: expectedRealizationId,
    artifact_sha256: envelope.artifact_sha256,
    vertical_binding_sha256: verticalBinding.binding_sha256,
    compatibility_class: envelope.compatibility.class,
    provider_store: false,
    mutation_performed: false,
  });
}

function validateRuntimeCompatiblePriorEnvelope(envelope, {
  profileId,
  assessmentId,
  verticalBinding,
  businessEvidenceSha256,
  pointer,
}) {
  try { validateLaunchSafeNewBaEnvelope(envelope, { profileId: normalizeNewBaProfileId(profileId) }); }
  catch { reconciliationRequired(); }
  if (pointer !== envelope.realization_id || envelope.assessment_id !== assessmentId) {
    reconciliationRequired();
  }
  const desiredIdentity = desiredV3Identity(envelope, {
    profileId,
    assessmentId,
    verticalBinding,
    businessEvidenceSha256,
  });
  const compatibility = classifyCompatiblePriorRealization({
    current: envelope,
    desiredIdentity,
  });
  if (compatibility.serveable !== true) reconciliationRequired();
  return Object.freeze({
    ready: true,
    code: 'PAID_CURRENT_NEW_BA_MEMBERSHIP_READY',
    source: 'CURRENT_NEW_BA_LAUNCH_SAFE_REALIZATION',
    profile_id: profileId,
    assessment_id: assessmentId,
    realization_id: envelope.realization_id,
    artifact_sha256: envelope.artifact_sha256,
    vertical_binding_sha256: verticalBinding.binding_sha256,
    compatibility_class: envelope.compatibility?.class,
    provider_store: false,
    mutation_performed: false,
  });
}

/**
 * Read-only bridge from the current immutable New BA pointer to paid
 * membership readiness. It never creates legacy assessment output fields and
 * never advances or repairs realization custody.
 */
export function createCurrentNewBaMembershipReadinessReader({
  store,
  namespace = DEFAULT_PAID_NEW_BA_READINESS_NAMESPACE,
  bosNamespace = DEFAULT_PAID_NEW_BOS_READINESS_NAMESPACE,
} = {}) {
  if (typeof store?.get !== 'function') throw new Error('paid_current_new_ba_readiness_store_required');
  const boundedNamespace = readinessNamespace(namespace);
  const boundedBosNamespace = bosReadinessNamespace(bosNamespace);

  return async function readCurrentNewBaMembershipReadiness({ profile_id, assessment } = {}) {
    const profileId = normalizeProfileId(profile_id);
    if (!profileId) reconciliationRequired();
    const suppliedAuthority = exactAssessmentAuthority(assessment, profileId);
    const assessmentPointerKey = `business_assessment_by_profile:${profileId}`;
    const assessmentPointer = await store.get(assessmentPointerKey);
    if (assessmentPointer !== suppliedAuthority.assessmentId) reconciliationRequired();
    const assessmentRecordKey = `business_assessment:${assessmentPointer}`;
    const assessmentRaw = await store.get(assessmentRecordKey);
    const storedAuthority = exactAssessmentAuthority(parseEnvelope(assessmentRaw), profileId);
    if (storedAuthority.assessmentId !== suppliedAuthority.assessmentId
      || storedAuthority.businessEvidenceSha256 !== suppliedAuthority.businessEvidenceSha256
      || storedAuthority.verticalBinding.binding_sha256 !== suppliedAuthority.verticalBinding.binding_sha256) {
      reconciliationRequired();
    }
    const {
      assessmentId,
      verticalBinding,
      businessEvidenceSha256,
    } = storedAuthority;
    const newBaProfileId = normalizeNewBaProfileId(profileId);
    const pointerKey = `${boundedNamespace}:latest-compatible:${newBaProfileId}`;
    const pointer = await store.get(pointerKey);
    if (!pointer) {
      return Object.freeze({
        ready: false,
        code: 'PAID_CURRENT_NEW_BA_MEMBERSHIP_NOT_READY',
        source: 'CURRENT_NEW_BA_REALIZATION_MISSING',
        mutation_performed: false,
      });
    }
    const artifactKey = `${boundedNamespace}:artifact:${newBaProfileId}:${pointer}`;
    const artifactRaw = await store.get(artifactKey);
    const envelope = parseEnvelope(artifactRaw);
    const baseReceipt = envelope.realization_identity?.version === NEW_BA_REALIZATION_IDENTITY_VERSION_V3
      ? validateCurrentEnvelope(envelope, {
        profileId,
        assessmentId,
        verticalBinding,
        businessEvidenceSha256,
        pointer,
      })
      : validateRuntimeCompatiblePriorEnvelope(envelope, {
        profileId,
        assessmentId,
        verticalBinding,
        businessEvidenceSha256,
        pointer,
      });
    const bosRealizationId = envelope.artifact?.fusion?.bos_authority?.realization_id;
    if (typeof bosRealizationId !== 'string' || !bosRealizationId) reconciliationRequired();
    const bosArtifactKey = `${boundedBosNamespace}:artifact:${newBaProfileId}:${bosRealizationId}`;
    const bosArtifactRaw = await store.get(bosArtifactKey);
    const bosEnvelope = bosArtifactRaw ? parseEnvelope(bosArtifactRaw) : null;
    let runtimeCustody;
    try {
      runtimeCustody = validatePaidSubscriberRuntimeCustody({
        profile_id: profileId,
        assessment_id: assessmentId,
        realization_record: envelope,
        bos_realization_record: bosEnvelope,
        completeness_policy: paidSubscriberCompletenessPolicy({
          verticalId: verticalBinding.vertical_id,
          syntheticOnly: false,
        }),
      });
    } catch {
      reconciliationRequired();
    }
    if (runtimeCustody.vertical_binding_sha256 !== verticalBinding.binding_sha256
      || runtimeCustody.realization_id !== baseReceipt.realization_id
      || runtimeCustody.artifact_sha256 !== baseReceipt.artifact_sha256) {
      reconciliationRequired();
    }
    const receipt = Object.freeze({
      ...baseReceipt,
      runtime_compatible_bos_ready: true,
      bos_realization_id: runtimeCustody.bos_realization_id,
      bos_artifact_sha256: runtimeCustody.bos_artifact_sha256,
      bos_custody_source: runtimeCustody.bos_custody_source,
    });
    const [
      finalAssessmentPointer,
      finalAssessmentRaw,
      finalPointer,
      finalArtifactRaw,
      finalBosArtifactRaw,
    ] = await Promise.all([
      store.get(assessmentPointerKey),
      store.get(assessmentRecordKey),
      store.get(pointerKey),
      store.get(artifactKey),
      store.get(bosArtifactKey),
    ]);
    if (finalAssessmentPointer !== assessmentPointer
      || finalAssessmentRaw !== assessmentRaw
      || finalPointer !== pointer
      || finalArtifactRaw !== artifactRaw
      || finalBosArtifactRaw !== bosArtifactRaw) {
      reconciliationRequired();
    }
    return receipt;
  };
}
