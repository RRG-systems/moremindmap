import {
  NEW_BOS_DEPTH_CONTRACT_VERSION,
  SURFACES,
  communicationDoctrineForSurface,
} from '../../../src/lib/newBosPersonalityDnaV1/constants.js';
import { invariant } from '../../../src/lib/newBosPersonalityDnaV1/contracts.js';
import {
  buildHumanRealizationInput,
  createHumanRealization,
} from '../../../src/lib/newBosPersonalityDnaV1/humanRealization.js';
import {
  assembleRealizedSurfaceRendering,
  validateBrowserRenderableCandidate,
} from '../../../src/lib/newBosPersonalityDnaV1/renderingAssembly.js';
import { runtimeCacheKey } from '../../../src/lib/newBosPersonalityDnaV1/runtimeOrchestrator.js';
import {
  auditHumanRealization,
  validateHumanRealization,
} from '../../../src/lib/newBosPersonalityDnaV1/truthValidator.js';

export const NEW_BOS_PRODUCTION_SURFACE_CONCURRENCY = 4;

async function realizeSurface({ artifact, packet, providerModel, surfaceRealizer }) {
  const humanRealizationInput = buildHumanRealizationInput({
    identityContext: artifact.identity_context,
    wholePersonModel: artifact.whole_person_model,
    localSurfacePacket: packet,
    resolvedLocalTruth: packet.resolved_local_truth,
  });
  const realized = await surfaceRealizer.realize({
    surface_id: packet.surface_id,
    human_realization_input: humanRealizationInput,
    writer_instruction: communicationDoctrineForSurface(packet.surface_id),
    cache_key: runtimeCacheKey({ rawEvidence: artifact.raw_evidence, providerModel, surfaceId: packet.surface_id }),
  });
  const humanRealization = createHumanRealization({
    surfaceId: packet.surface_id,
    customerProse: realized?.customer_prose,
    localSurfacePacket: packet,
    generation: realized?.generation,
  });
  validateHumanRealization({
    surfaceId: packet.surface_id,
    realization: humanRealization,
    localTruth: packet.resolved_local_truth,
    subjectToken: artifact.subject_token,
  });
  const humanRealizationAudit = auditHumanRealization({
    surfaceId: packet.surface_id,
    realization: humanRealization,
    localTruth: packet.resolved_local_truth,
  });
  const rendering = assembleRealizedSurfaceRendering({
    packet,
    humanRealization,
    profileId: artifact.profile_id || null,
    subjectToken: artifact.subject_token,
  });
  return Object.freeze({
    ...packet,
    human_realization: humanRealization,
    human_realization_audit: humanRealizationAudit,
    rendering,
  });
}

export async function realizePersonalityDnaArtifactBounded({
  artifact,
  providerModel,
  surfaceRealizer,
  concurrency = NEW_BOS_PRODUCTION_SURFACE_CONCURRENCY,
} = {}) {
  invariant(artifact?.real_profile_gate === true, 'Bounded production realization requires an authorized real-profile artifact');
  invariant(
    artifact.personality_dna?.specialized_intelligence?.version === NEW_BOS_DEPTH_CONTRACT_VERSION,
    'Bounded production realization requires the frozen rich depth contract',
  );
  invariant(typeof surfaceRealizer?.realize === 'function', 'Bounded production surface realizer requires realize()');
  invariant(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= SURFACES.length, 'Bounded production surface concurrency invalid');
  invariant(artifact.surface_packets?.length === SURFACES.length, 'Bounded production realization requires exactly 15 surfaces');

  const realizedSurfaces = new Array(artifact.surface_packets.length);
  let nextIndex = 0;
  let firstFailure = null;
  const worker = async () => {
    while (!firstFailure) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= artifact.surface_packets.length) return;
      try {
        realizedSurfaces[index] = await realizeSurface({
          artifact,
          packet: artifact.surface_packets[index],
          providerModel,
          surfaceRealizer,
        });
      } catch (error) {
        firstFailure ||= error;
      }
    }
  };
  await Promise.all(Array.from(
    { length: Math.min(concurrency, artifact.surface_packets.length) },
    () => worker(),
  ));
  if (firstFailure) throw firstFailure;

  invariant(realizedSurfaces.every(Boolean), 'Every governed surface must be realized or fail closed');
  const candidate = Object.freeze({
    ...artifact,
    surface_packets: Object.freeze(realizedSurfaces),
    safety: Object.freeze({ ...artifact.safety, provider_called: true }),
  });
  validateBrowserRenderableCandidate(candidate);
  return candidate;
}
