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
import { sha256Stable } from './realizationIdentity.js';

export const NEW_BOS_PRODUCTION_SURFACE_CONCURRENCY = 4;

function surfaceUnit({ artifact, packet, providerModel, campaignIdentity }) {
  const requestContract = Object.freeze({
    campaign_sha256: campaignIdentity.sha256,
    surface_id: packet.surface_id,
    resolved_local_truth_sha256: sha256Stable(packet.resolved_local_truth),
    whole_person_model_sha256: sha256Stable(artifact.whole_person_model),
    local_surface_packet_sha256: sha256Stable(packet),
    provider_model: providerModel,
    writer_instruction: communicationDoctrineForSurface(packet.surface_id),
    cache_key: runtimeCacheKey({ rawEvidence: artifact.raw_evidence, providerModel, surfaceId: packet.surface_id }),
  });
  return Object.freeze({
    unit_id: `surface:${packet.surface_id}`,
    unit_identity_sha256: sha256Stable({ version: 'new_bos_resumable_surface_unit_v1', ...requestContract }),
    request_sha256: sha256Stable(requestContract),
  });
}

function validateAcceptedSurface({ artifact, packet, acceptedPacket }) {
  invariant(acceptedPacket?.surface_id === packet.surface_id, 'Accepted surface ID mismatch');
  validateHumanRealization({
    surfaceId: packet.surface_id,
    realization: acceptedPacket.human_realization,
    localTruth: packet.resolved_local_truth,
    subjectToken: artifact.subject_token,
  });
  return Object.freeze(acceptedPacket);
}

function terminalEvent(error) {
  return Object.freeze({
    provider_response_id: error?.provider_response_id || null,
    status: error?.provider_status || 'failed',
    incomplete_details_reason: error?.incomplete_details_reason || null,
    error_code: error?.provider_error_code || (error?.provider_response_id ? null : 'transport_error'),
    usage: error?.provider_usage || null,
    observed_at: new Date().toISOString(),
  });
}

async function realizeSurface({
  artifact,
  packet,
  providerModel,
  surfaceRealizer,
  checkpointStore,
  campaignIdentity,
}) {
  const humanRealizationInput = buildHumanRealizationInput({
    identityContext: artifact.identity_context,
    wholePersonModel: artifact.whole_person_model,
    localSurfacePacket: packet,
    resolvedLocalTruth: packet.resolved_local_truth,
  });
  const unit = surfaceUnit({ artifact, packet, providerModel, campaignIdentity });
  const prepared = await checkpointStore.prepare({
    campaignSha256: campaignIdentity.sha256,
    unitId: unit.unit_id,
    unitIdentitySha256: unit.unit_identity_sha256,
    requestSha256: unit.request_sha256,
  });
  if (prepared.disposition === 'REUSE_ACCEPTED') {
    return validateAcceptedSurface({ artifact, packet, acceptedPacket: prepared.record.accepted_value });
  }
  if (!['START_INITIAL', 'START_REPLACEMENT'].includes(prepared.disposition)) {
    throw Object.assign(new Error(`new_bos_surface_checkpoint_${prepared.classification?.state || 'unavailable'}`), {
      human_review_required: true,
      recovery_phase: 'CRAFTING_YOUR_EXPERIENCE',
    });
  }

  let realized;
  try {
    realized = await surfaceRealizer.realize({
      surface_id: packet.surface_id,
      human_realization_input: humanRealizationInput,
      writer_instruction: communicationDoctrineForSurface(packet.surface_id),
      cache_key: runtimeCacheKey({ rawEvidence: artifact.raw_evidence, providerModel, surfaceId: packet.surface_id }),
    });
    await checkpointStore.observe({
      campaignSha256: campaignIdentity.sha256,
      unitId: unit.unit_id,
      unitIdentitySha256: unit.unit_identity_sha256,
      requestSha256: unit.request_sha256,
      event: Object.freeze({
        provider_response_id: realized?.generation?.provider_response_id || null,
        status: 'completed',
        model: realized?.generation?.returned_model || null,
        usage: realized?.generation?.usage || null,
        observed_at: new Date().toISOString(),
      }),
    });
  } catch (error) {
    await checkpointStore.observe({
      campaignSha256: campaignIdentity.sha256,
      unitId: unit.unit_id,
      unitIdentitySha256: unit.unit_identity_sha256,
      requestSha256: unit.request_sha256,
      event: terminalEvent(error),
    });
    if (error?.semantic_rejection || error?.provider_status === 'completed') {
      await checkpointStore.rejectSemantic({
        campaignSha256: campaignIdentity.sha256,
        unitId: unit.unit_id,
        unitIdentitySha256: unit.unit_identity_sha256,
        requestSha256: unit.request_sha256,
        code: error?.message,
      });
    }
    throw error;
  }
  const humanRealization = createHumanRealization({
    surfaceId: packet.surface_id,
    customerProse: realized?.customer_prose,
    localSurfacePacket: packet,
    generation: realized?.generation,
  });
  try {
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
    const acceptedPacket = Object.freeze({
      ...packet,
      human_realization: humanRealization,
      human_realization_audit: humanRealizationAudit,
      rendering,
    });
    await checkpointStore.accept({
      campaignSha256: campaignIdentity.sha256,
      unitId: unit.unit_id,
      unitIdentitySha256: unit.unit_identity_sha256,
      requestSha256: unit.request_sha256,
      value: acceptedPacket,
    });
    return acceptedPacket;
  } catch (error) {
    await checkpointStore.rejectSemantic({
      campaignSha256: campaignIdentity.sha256,
      unitId: unit.unit_id,
      unitIdentitySha256: unit.unit_identity_sha256,
      requestSha256: unit.request_sha256,
      code: error?.message,
    });
    throw error;
  }
}

export async function realizePersonalityDnaArtifactBounded({
  artifact,
  providerModel,
  surfaceRealizer,
  checkpointStore,
  campaignIdentity,
  onSurfaceCheckpoint = async () => {},
  concurrency = NEW_BOS_PRODUCTION_SURFACE_CONCURRENCY,
  maxNewSurfaces = Number.POSITIVE_INFINITY,
} = {}) {
  invariant(artifact?.real_profile_gate === true, 'Bounded production realization requires an authorized real-profile artifact');
  invariant(
    artifact.personality_dna?.specialized_intelligence?.version === NEW_BOS_DEPTH_CONTRACT_VERSION,
    'Bounded production realization requires the frozen rich depth contract',
  );
  invariant(typeof surfaceRealizer?.realize === 'function', 'Bounded production surface realizer requires realize()');
  invariant(typeof checkpointStore?.prepare === 'function', 'Bounded production surface checkpoint store requires prepare()');
  invariant(campaignIdentity?.sha256, 'Bounded production surface campaign identity is required');
  invariant(typeof onSurfaceCheckpoint === 'function', 'Bounded production surface checkpoint observer invalid');
  invariant(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= SURFACES.length, 'Bounded production surface concurrency invalid');
  invariant(
    maxNewSurfaces === Number.POSITIVE_INFINITY
      || (Number.isSafeInteger(maxNewSurfaces) && maxNewSurfaces >= 1),
    'Bounded production surface step limit invalid',
  );
  invariant(artifact.surface_packets?.length === SURFACES.length, 'Bounded production realization requires exactly 15 surfaces');

  const realizedSurfaces = new Array(artifact.surface_packets.length);
  const priorInspections = await Promise.all(artifact.surface_packets.map((packet) => checkpointStore.inspect({
    campaignSha256: campaignIdentity.sha256,
    unitId: `surface:${packet.surface_id}`,
  })));
  const reusedIndexes = [];
  const newIndexes = [];
  priorInspections.forEach((inspection, index) => {
    if (inspection?.classification?.state === 'ACCEPTED') reusedIndexes.push(index);
    else if (newIndexes.length < maxNewSurfaces) newIndexes.push(index);
  });
  const workIndexes = [...reusedIndexes, ...newIndexes];
  let nextIndex = 0;
  let firstFailure = null;
  const worker = async () => {
    while (!firstFailure) {
      const workIndex = nextIndex;
      nextIndex += 1;
      if (workIndex >= workIndexes.length) return;
      const index = workIndexes[workIndex];
      try {
        const prior = priorInspections[index];
        realizedSurfaces[index] = await realizeSurface({
          artifact,
          packet: artifact.surface_packets[index],
          providerModel,
          surfaceRealizer,
          checkpointStore,
          campaignIdentity,
        });
        const accepted = await checkpointStore.inspect({
          campaignSha256: campaignIdentity.sha256,
          unitId: `surface:${artifact.surface_packets[index].surface_id}`,
        });
        await onSurfaceCheckpoint(Object.freeze({
          surface_id: artifact.surface_packets[index].surface_id,
          reused: prior.classification.state === 'ACCEPTED',
          provider_submissions: Number(accepted.record?.attempt) || 1,
          usage: accepted.record?.observation?.usage || null,
        }));
      } catch (error) {
        firstFailure ||= error;
      }
    }
  };
  await Promise.all(Array.from(
    { length: Math.min(concurrency, workIndexes.length) },
    () => worker(),
  ));
  if (firstFailure) throw firstFailure;

  if (realizedSurfaces.filter(Boolean).length !== artifact.surface_packets.length) {
    throw Object.assign(new Error('new_bos_bounded_surface_step_complete'), {
      code: 'new_bos_bounded_surface_step_complete',
      background_pending: true,
      recovery_phase: 'BUILDING_EXPLANATION_SURFACES',
      accepted_surface_count: reusedIndexes.length + newIndexes.length,
    });
  }

  const candidate = Object.freeze({
    ...artifact,
    surface_packets: Object.freeze(realizedSurfaces),
    safety: Object.freeze({ ...artifact.safety, provider_called: true }),
  });
  validateBrowserRenderableCandidate(candidate);
  return candidate;
}
