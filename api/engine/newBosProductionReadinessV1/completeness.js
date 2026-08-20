import {
  SURFACES,
  assembleRealizedSurfaceRendering,
  validateBrowserRenderableCandidate,
} from '../../../src/lib/newBosPersonalityDnaV1/index.js';

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function renderingIsIdentityBound(candidate, packet) {
  const identity = packet?.rendering?.assembly_identity;
  return identity?.surface_id === packet.surface_id
    && (identity.profile_id || null) === (candidate.profile_id || null)
    && identity.subject_token === candidate.subject_token;
}

/**
 * Replays the deterministic browser assembly over an already-governed candidate.
 * It may repair packaging identity only; it never changes truth or customer prose.
 */
export function completeNewBosCandidate(candidate) {
  invariant(candidate && typeof candidate === 'object', 'new_bos_candidate_required');
  invariant(Array.isArray(candidate.surface_packets), 'new_bos_candidate_surface_packets_required');
  invariant(candidate.surface_packets.length === SURFACES.length, 'new_bos_candidate_requires_exactly_15_surfaces');
  invariant(new Set(candidate.surface_packets.map(({ surface_id: id }) => id)).size === SURFACES.length, 'new_bos_candidate_surface_ids_must_be_unique');

  let repairedCount = 0;
  const surfacePackets = candidate.surface_packets.map((packet) => {
    invariant(packet?.human_realization?.customer_prose, `new_bos_surface_human_realization_required:${packet?.surface_id || 'unknown'}`);
    invariant(packet?.resolved_local_truth?.surface_id === packet.surface_id, `new_bos_surface_truth_mismatch:${packet.surface_id}`);
    if (renderingIsIdentityBound(candidate, packet)) return packet;
    repairedCount += 1;
    return Object.freeze({
      ...packet,
      rendering: assembleRealizedSurfaceRendering({
        packet,
        humanRealization: packet.human_realization,
        profileId: candidate.profile_id || null,
        subjectToken: candidate.subject_token,
      }),
    });
  });

  const completed = Object.freeze({
    ...candidate,
    surface_packets: Object.freeze(surfacePackets),
  });
  validateBrowserRenderableCandidate(completed);
  return Object.freeze({
    candidate: completed,
    receipt: Object.freeze({
      contract: 'new_bos_unconditional_15_surface_completeness_v1',
      required_surface_count: SURFACES.length,
      complete_surface_count: SURFACES.length,
      deterministic_packaging_repairs: repairedCount,
      semantic_mutations: 0,
      customer_prose_mutations: 0,
      status: 'PASS',
    }),
  });
}

export function validateCompleteNewBosCandidate(candidate, forbiddenIdentityTokens = []) {
  const validated = validateBrowserRenderableCandidate(candidate, forbiddenIdentityTokens);
  return Object.freeze({
    candidate: validated,
    surface_count: validated.surface_packets.length,
    status: 'PASS',
  });
}
