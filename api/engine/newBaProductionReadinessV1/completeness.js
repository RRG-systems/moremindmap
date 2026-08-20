import { normalizeAssessmentId, normalizeProfileId, sha256Stable } from './stable.js';
import { validateBosBaFusionProof } from './fusionAssembler.js';

const FUTURE_ROLES = Object.freeze(['current_course', 'emerging_future', 'better_future', 'bold_future', 'downside_future']);

export function validateCompleteNewBaRealization(artifact, { profileId = artifact?.profile_id, assessmentId = artifact?.assessment_id, allowLegacyContract = false } = {}) {
  const profile = normalizeProfileId(profileId);
  const assessment = normalizeAssessmentId(assessmentId);
  const legacy = artifact?.contract_id === 'new-ba-production-realization-v1';
  if (artifact?.contract_id !== 'new-ba-production-realization-v2' && !(allowLegacyContract && legacy)) throw new Error('new_ba_realization_contract_invalid');
  if (artifact.profile_id !== profile || artifact.assessment_id !== assessment) throw new Error('new_ba_realization_identity_mismatch');
  for (const field of ['business_reality', 'five_futures', 'one_move', 'plan_135', 'evidence', 'lineage', 'customer_view_model', 'internal_trace']) {
    if (!artifact[field]) throw new Error(`new_ba_realization_${field}_missing`);
  }
  const futureItems = artifact.customer_view_model?.destinations?.futures?.items;
  if (!Array.isArray(futureItems) || futureItems.length !== 5) throw new Error('new_ba_realization_futures_incomplete');
  if (JSON.stringify(futureItems.map((item) => item.role)) !== JSON.stringify(FUTURE_ROLES)) throw new Error('new_ba_realization_future_role_drift');
  if (futureItems.reduce((sum, item) => sum + Number(item.probability), 0) !== 100) throw new Error('new_ba_realization_future_probability_total_invalid');
  if (!artifact.customer_view_model?.destinations?.move?.headline || !artifact.one_move?.title) throw new Error('new_ba_realization_one_move_incomplete');
  if (artifact.plan_135?.ways?.length !== 3 || artifact.plan_135?.strategies?.length !== 5) throw new Error('new_ba_realization_plan_incomplete');
  if (!artifact.customer_view_model?.destinations?.evidence || !artifact.evidence?.categories?.length) throw new Error('new_ba_realization_evidence_incomplete');
  if (artifact.customer_view_model?.layerContract?.stop_after !== 2 || artifact.customer_view_model?.layerContract?.layer_3_exists !== false) throw new Error('new_ba_realization_layer_contract_invalid');
  if (Object.keys(artifact.customer_view_model?.objects || {}).length < 30) throw new Error('new_ba_realization_projection_depth_incomplete');
  if (artifact.provider_accounting?.store !== false) throw new Error('new_ba_realization_provider_store_false_missing');
  if (!legacy) validateBosBaFusionProof(artifact.fusion, { profileId: profile, assessmentId: assessment });
  return Object.freeze({ status: 'PASS', contract_version: legacy ? 1 : 2, fusion_validated: !legacy, destination_count: 5, future_count: 5, plan_strategy_count: 5, inspectable_object_count: Object.keys(artifact.customer_view_model.objects).length, artifact_sha256: sha256Stable(artifact) });
}
