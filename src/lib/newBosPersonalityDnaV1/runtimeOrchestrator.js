import {
  NEW_BOS_REAL_PROFILE_HS_GATE_V1,
  NEW_BOS_DEPTH_CONTRACT_VERSION,
  NEW_BOS_RUNTIME_VERSION,
  NEW_BOS_SURFACE_MISSION_VERSION,
  SURFACES,
  communicationDoctrineForSurface,
} from './constants.js';
import { invariant } from './contracts.js';
import { buildPersonalityDnaRuntime } from './engine.js';
import { buildHumanRealizationInput, createHumanRealization } from './humanRealization.js';
import { LIBRARY_MANIFEST_SHA256, selectLibraryForStage } from './libraryRegistry.js';
import { assembleRealizedSurfaceRendering, validateBrowserRenderableCandidate } from './renderingAssembly.js';
import { auditHumanRealization, validateHumanRealization } from './truthValidator.js';

export const NEW_BOS_REASONING_AUTHORITY_STAGES = Object.freeze([
  'vector_priors',
  'cross_vector_topology',
  'higher_order_attributes',
  'causal_dynamics',
  'specialized_intelligence',
  'evidence_certainty',
  'personality_dna',
  'whole_person_model',
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function fnv1a64(text) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, '0')}`;
}

export function runtimeCacheKey({ rawEvidence, providerModel, surfaceId = 'personality_dna' }) {
  return fnv1a64(JSON.stringify(stable({
    subject_token: rawEvidence.subject_token,
    source_artifact_ids: rawEvidence.source_artifact_ids,
    raw_evidence_version: rawEvidence.version,
    raw_evidence: rawEvidence,
    runtime_version: NEW_BOS_RUNTIME_VERSION,
    library_manifest_sha256: LIBRARY_MANIFEST_SHA256,
    provider_model: providerModel,
    surface_id: surfaceId,
    surface_mission_version: NEW_BOS_SURFACE_MISSION_VERSION,
  })));
}

function validateRetrievedAuthority(selection, retrieved) {
  invariant(retrieved?.manifest_sha256 === selection.manifest_sha256, `Retrieved manifest mismatch for ${selection.stage_id}`);
  const actual = new Map((retrieved.authorities || []).map((item) => [item.id, item.sha256]));
  selection.authorities.forEach((expected) => {
    invariant(actual.get(expected.id) === expected.sha256, `Retrieved Bible ${expected.id} hash mismatch`);
  });
}

export async function retrieveNewBosGovernedReasoningContext({ libraryRetriever }) {
  invariant(typeof libraryRetriever?.retrieve === 'function', 'Hash-verifying library retriever is required');
  const retrievedContexts = [];
  for (const stageId of NEW_BOS_REASONING_AUTHORITY_STAGES) {
    const selection = selectLibraryForStage(stageId);
    const retrieved = await libraryRetriever.retrieve(selection);
    validateRetrievedAuthority(selection, retrieved);
    retrievedContexts.push({ stage_id: stageId, selection, retrieved });
  }
  return Object.freeze(retrievedContexts);
}

export async function runPersonalityDnaProductionContract({
  activation,
  rawEvidence,
  providerModel,
  libraryRetriever,
  reasoningProvider,
  surfaceRealizer = null,
  governedContext = null,
  interpretationDraft = null,
}) {
  invariant(
    activation === 'synthetic_lab' || activation === NEW_BOS_REAL_PROFILE_HS_GATE_V1,
    'New BOS V1 remains default-off and synthetic-only outside the exact private real-profile HS gate',
  );
  if (activation === 'synthetic_lab') {
    invariant(rawEvidence?.synthetic === true, 'Customer evidence is not authorized in the synthetic lab runtime');
  } else {
    invariant(rawEvidence?.real_profile_gate === true, 'Real-profile HS gate evidence classification is required');
    invariant(rawEvidence?.identity_verified_by_adapter === true, 'Real-profile HS gate adapter identity proof is required');
    invariant(rawEvidence?.governed_local_snapshot === true, 'Real-profile HS gate requires a governed local snapshot');
  }
  invariant(typeof libraryRetriever?.retrieve === 'function', 'Hash-verifying library retriever is required');
  if (!interpretationDraft) invariant(typeof reasoningProvider?.infer === 'function', 'Reasoning provider adapter is required');

  const retrievedContexts = governedContext || await retrieveNewBosGovernedReasoningContext({ libraryRetriever });
  if (governedContext) {
    invariant(governedContext.length === NEW_BOS_REASONING_AUTHORITY_STAGES.length, 'Governed reasoning context stage count mismatch');
    NEW_BOS_REASONING_AUTHORITY_STAGES.forEach((stageId, index) => {
      invariant(governedContext[index]?.stage_id === stageId, `Governed reasoning context order mismatch for ${stageId}`);
      validateRetrievedAuthority(governedContext[index].selection, governedContext[index].retrieved);
    });
  }

  const resolvedInterpretationDraft = interpretationDraft || await reasoningProvider.infer({
    raw_evidence: rawEvidence,
    governed_context: retrievedContexts,
    mission: 'Produce a typed Personality DNA artifact and vector-free whole-person model. Scores are priors; claims require evidence.',
    output_contract: 'BOS_PERSONALITY_DNA_RUNTIME_V1_CONTRACT',
    cache_key: runtimeCacheKey({ rawEvidence, providerModel }),
  });
  const artifact = buildPersonalityDnaRuntime({ rawEvidence, interpretationDraft: resolvedInterpretationDraft });

  return realizePersonalityDnaArtifact({ artifact, providerModel, surfaceRealizer });
}

export async function realizePersonalityDnaArtifact({ artifact, providerModel, surfaceRealizer = null }) {
  if (!surfaceRealizer) return artifact;
  invariant(typeof surfaceRealizer.realize === 'function', 'Surface realizer adapter requires realize()');
  const requiresBrowserCompleteRendering = artifact.real_profile_gate === true
    || artifact.personality_dna?.specialized_intelligence?.version === NEW_BOS_DEPTH_CONTRACT_VERSION;
  if (artifact.real_profile_gate === true) {
    invariant(
      artifact.personality_dna?.specialized_intelligence?.version === NEW_BOS_DEPTH_CONTRACT_VERSION,
      'Real-profile human realization requires the rich governed rendering depth contract',
    );
  }
  const realizedSurfaces = [];
  for (const packet of artifact.surface_packets) {
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
    const rendering = requiresBrowserCompleteRendering
      ? assembleRealizedSurfaceRendering({
        packet,
        humanRealization,
        profileId: artifact.profile_id || null,
        subjectToken: artifact.subject_token,
      })
      : packet.rendering;
    realizedSurfaces.push(Object.freeze({
      ...packet,
      human_realization: humanRealization,
      human_realization_audit: humanRealizationAudit,
      rendering,
    }));
  }
  invariant(realizedSurfaces.length === SURFACES.length, 'Every governed surface must be realized or fail closed');
  const candidate = Object.freeze({
    ...artifact,
    surface_packets: Object.freeze(realizedSurfaces),
    safety: Object.freeze({ ...artifact.safety, provider_called: true }),
  });
  if (requiresBrowserCompleteRendering) validateBrowserRenderableCandidate(candidate);
  return candidate;
}
