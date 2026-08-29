import { readNewBosProductionConfig } from '../newBosProductionReadinessV1/config.js';
import { validateLaunchSafeRealizationEnvelope } from '../newBosProductionReadinessV1/launchSafeRealizationStore.js';
import { readNewBaProductionConfig } from '../newBaProductionReadinessV1/config.js';
import { createRedisNewBaRealizationStore } from '../newBaProductionReadinessV1/launchSafeRealizationStore.js';
import { buildCustomerSafePresentationViewModel } from '../../../src/lib/baProgressiveDisclosureV1/customerPresentationSanitizer.js';
import { createSyntheticJordanBosArtifact } from '../../../src/recruitingHybridGuV1/syntheticJordanBos.js';
import { createSyntheticJordanBusinessTwinViewModel } from '../../../src/recruitingHybridGuV1/syntheticJordanBusinessTwin.js';

function normalizeProfileId(value) {
  const profile = String(value || '').trim().toUpperCase();
  if (!/^MM-\d{8}-[A-Z0-9]{8}$/u.test(profile)) throw new Error('RECRUITING_GU_V1_PROFILE_ID_INVALID');
  return profile;
}

export function createSyntheticAuthoredSurfaces() {
  return Object.freeze({
    bos: createSyntheticJordanBosArtifact(),
    ba: createSyntheticJordanBusinessTwinViewModel(),
    receipts: {
      bos: { source: 'governed_synthetic_fixture', complete_surface_count: 15 },
      ba: { source: 'governed_synthetic_fixture', complete: true },
    },
  });
}

export async function readCurrentAuthoredSurfaces({ redis, profileId, env = process.env } = {}) {
  if (typeof redis?.get !== 'function') throw new Error('RECRUITING_GU_V1_REDIS_REQUIRED');
  const profile = normalizeProfileId(profileId);
  const bosConfig = readNewBosProductionConfig(env);
  const bosPointer = await redis.get(`${bosConfig.namespace}:latest-compatible:${profile}`);
  if (!bosPointer) throw new Error('RECRUITING_GU_V1_COMPLETE_BOS_NOT_READY');
  const bosRaw = await redis.get(`${bosConfig.namespace}:artifact:${profile}:${bosPointer}`);
  if (!bosRaw) throw new Error('RECRUITING_GU_V1_COMPLETE_BOS_NOT_READY');
  const bosEnvelope = validateLaunchSafeRealizationEnvelope(JSON.parse(bosRaw), { profileId: profile });

  const baConfig = readNewBaProductionConfig(env);
  const baStore = createRedisNewBaRealizationStore({ redis, namespace: baConfig.namespace, persistenceEnabled: false });
  const baEnvelope = await baStore.getCurrent({ profileId: profile });
  const ba = baEnvelope?.artifact?.customer_view_model
    ? buildCustomerSafePresentationViewModel(baEnvelope.artifact.customer_view_model)
    : null;

  return Object.freeze({
    bos: bosEnvelope.artifact,
    ba,
    receipts: {
      bos: { source: 'canonical_derived_read', realization_id: bosEnvelope.realization_id, artifact_sha256: bosEnvelope.artifact_sha256, complete_surface_count: bosEnvelope.complete_surface_count },
      ba: baEnvelope ? { source: 'canonical_derived_read', realization_id: baEnvelope.realization_id, artifact_sha256: baEnvelope.artifact_sha256, complete: baEnvelope.completeness?.status === 'PASS' } : { source: 'canonical_derived_read', complete: false, missing: true },
    },
  });
}
/* global process */
