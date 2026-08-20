import crypto from 'node:crypto';

import {
  NEW_BOS_DEPTH_CONTRACT_VERSION,
  NEW_BOS_HUMAN_REALIZATION_PROMPT_VERSION,
  NEW_BOS_HUMAN_REALIZATION_VERSION,
  NEW_BOS_RUNTIME_VERSION,
  NEW_BOS_SURFACE_MISSION_VERSION,
  NEW_BOS_VISUAL_SYSTEM_VERSION,
  NEW_BOS_WHOLE_PERSON_VERSION,
} from '../../../src/lib/newBosPersonalityDnaV1/constants.js';
import { LIBRARY_MANIFEST_SHA256 } from '../../../src/lib/newBosPersonalityDnaV1/libraryRegistry.js';
import { NEW_BOS_TOP_PROJECTION_VERSION } from '../../../src/lib/newBosPersonalityDnaV1/topProjection.js';

export const NEW_BOS_RENDERING_ASSEMBLY_VERSION = 'bos_browser_rendering_completeness_v1';
export const NEW_BOS_REALIZATION_IDENTITY_VERSION = 'new_bos_composite_realization_identity_v1';
export const NEW_BOS_PROVIDER_POLICY_VERSION = 'gpt_5_6_sol_store_false_strict_v1';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function sha256Stable(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

export function buildNewBosRealizationIdentity({
  profileId,
  canonicalSourceSha256,
  rawEvidenceVersion,
  providerModel,
  compatibilityClass,
  libraryManifestSha256 = LIBRARY_MANIFEST_SHA256,
} = {}) {
  const normalizedProfileId = String(profileId || '').trim().toUpperCase();
  if (!/^MM-[A-Z0-9-]+$/u.test(normalizedProfileId)) throw new Error('new_bos_realization_identity_profile_invalid');
  if (!/^[a-f0-9]{64}$/u.test(String(canonicalSourceSha256 || ''))) throw new Error('new_bos_realization_identity_evidence_hash_invalid');
  if (!rawEvidenceVersion) throw new Error('new_bos_realization_identity_evidence_version_required');
  if (providerModel !== 'gpt-5.6-sol') throw new Error('new_bos_realization_identity_model_mismatch');
  if (!['A', 'B'].includes(compatibilityClass)) throw new Error('new_bos_realization_identity_incompatible');

  const components = Object.freeze({
    profile_id: normalizedProfileId,
    canonical_evidence_sha256: canonicalSourceSha256,
    canonical_evidence_version: rawEvidenceVersion,
    runtime_version: NEW_BOS_RUNTIME_VERSION,
    library_manifest_sha256: libraryManifestSha256,
    depth_contract_version: NEW_BOS_DEPTH_CONTRACT_VERSION,
    whole_person_version: NEW_BOS_WHOLE_PERSON_VERSION,
    human_realization_version: NEW_BOS_HUMAN_REALIZATION_VERSION,
    human_realization_prompt_version: NEW_BOS_HUMAN_REALIZATION_PROMPT_VERSION,
    surface_mission_version: NEW_BOS_SURFACE_MISSION_VERSION,
    top_projection_version: NEW_BOS_TOP_PROJECTION_VERSION,
    visual_system_version: NEW_BOS_VISUAL_SYSTEM_VERSION,
    rendering_assembly_version: NEW_BOS_RENDERING_ASSEMBLY_VERSION,
    provider_model: providerModel,
    provider_policy_version: NEW_BOS_PROVIDER_POLICY_VERSION,
    compatibility_class: compatibilityClass,
  });
  const sha256 = sha256Stable(components);
  return Object.freeze({
    version: NEW_BOS_REALIZATION_IDENTITY_VERSION,
    realization_id: `new-bos:${normalizedProfileId}:${sha256}`,
    sha256,
    components,
  });
}

export function sameNewBosRealizationIdentity(left, right) {
  return left?.version === NEW_BOS_REALIZATION_IDENTITY_VERSION
    && right?.version === NEW_BOS_REALIZATION_IDENTITY_VERSION
    && left.sha256 === right.sha256
    && left.realization_id === right.realization_id;
}
