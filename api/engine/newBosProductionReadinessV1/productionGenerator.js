import OpenAI from 'openai';

import { estimateProviderCost, providerUsage } from '../bosCustomerIntelligence/governedProbabilisticRealizerProvider.js';
import { createNewBosHumanRealizationProvider } from '../newBosPersonalityDnaV1/humanRealizationProvider.js';
import {
  retrieveNewBosGovernedReasoningContext,
  runPersonalityDnaProductionContract,
} from '../../../src/lib/newBosPersonalityDnaV1/runtimeOrchestrator.js';
import { SURFACES } from '../../../src/lib/newBosPersonalityDnaV1/constants.js';

import {
  NEW_BOS_PRODUCTION_SURFACE_CONCURRENCY,
  realizePersonalityDnaArtifactBounded,
} from './boundedSurfaceRealization.js';
import { createHashBoundLibraryRetriever } from './libraryRetriever.js';
import { deriveProviderIdentityTokens, inspectProviderPrivacy } from './privacyEgress.js';
import { sha256Stable } from './realizationIdentity.js';
import {
  executeNewBosBackgroundResponse,
  retireStaleNewBosBackgroundResponse,
} from './backgroundResponsesTransport.js';
import {
  createNewBosSemanticStageProvider,
  NEW_BOS_SEMANTIC_STAGE_REQUEST_CONTRACT_V1,
  NEW_BOS_STAGE3_VECTOR_FREE_REQUEST_CONTRACT_V2,
} from './reasoningProvider.js';
import {
  buildNewBosSemanticUnitPlan,
  runNewBosResumableSemanticGeneration,
} from './resumableGenerationOrchestrator.js';
import {
  assembleNewBosReasoningDraftV1,
  buildNewBosResumableCampaignIdentity,
  NEW_BOS_SEMANTIC_STAGES,
  validateNewBosSemanticStageFragment,
} from './resumableSemanticContract.js';
import {
  classifyCompletedStage3ValidationError,
  classifySemanticValidationError,
  providerResponseIdSha256,
  sanitizeCompletedStage3ProviderMetadata,
} from './completedStage3ValidationDiagnostic.js';

function addUsage(left, right) {
  return Object.freeze({
    input_tokens: left.input_tokens + right.input_tokens,
    cached_input_tokens: left.cached_input_tokens + right.cached_input_tokens,
    cache_write_tokens: left.cache_write_tokens + right.cache_write_tokens,
    output_tokens: left.output_tokens + right.output_tokens,
    reasoning_tokens: left.reasoning_tokens + right.reasoning_tokens,
  });
}

function storedUsage(usage) {
  return Object.freeze({
    input_tokens: Number(usage?.input_tokens) || 0,
    cached_input_tokens: Number(usage?.cached_input_tokens) || 0,
    cache_write_tokens: Number(usage?.cache_write_tokens) || 0,
    output_tokens: Number(usage?.output_tokens) || 0,
    reasoning_tokens: Number(usage?.reasoning_tokens) || 0,
  });
}

const ZERO_USAGE = Object.freeze({
  input_tokens: 0,
  cached_input_tokens: 0,
  cache_write_tokens: 0,
  output_tokens: 0,
  reasoning_tokens: 0,
});

const AUTHORITY_GUARDED_CHECKPOINT_MUTATIONS = new Set([
  'prepare',
  'accept',
  'rejectSemantic',
]);

export function authorityGuardedCheckpointStore(store, assertCurrentAuthority) {
  const guarded = {};
  for (const property of Reflect.ownKeys(store)) {
    const value = store[property];
    if (typeof value !== 'function') {
      guarded[property] = value;
    } else if (AUTHORITY_GUARDED_CHECKPOINT_MUTATIONS.has(property)) {
      guarded[property] = async (...args) => {
        await assertCurrentAuthority();
        return value.apply(store, args);
      };
    } else {
      guarded[property] = value.bind(store);
    }
  }
  return Object.freeze(guarded);
}

async function assertProviderAuthority(assertCurrentAuthority) {
  try {
    await assertCurrentAuthority();
  } catch (error) {
    const denied = new Error(error?.message || 'new_bos_provider_submission_authority_changed', { cause: error });
    denied.provider_submission_blocked_by_authority = true;
    throw denied;
  }
}

export function authorityGuardedProviderClient(client, assertCurrentAuthority) {
  const create = authorityGuardedProviderTransport(client.responses.create.bind(client.responses), assertCurrentAuthority);
  const retrieve = authorityGuardedProviderTransport(client.responses.retrieve.bind(client.responses), assertCurrentAuthority);
  return Object.freeze({
    responses: Object.freeze({
      create,
      retrieve,
    }),
  });
}

export function authorityGuardedProviderTransport(transport, assertCurrentAuthority) {
  return async (...args) => {
    await assertProviderAuthority(assertCurrentAuthority);
    return transport(...args);
  };
}

export function createProductionNewBosGenerator({
  apiKey,
  repositoryRoot,
  model = 'gpt-5.6-sol',
  reasoningTimeoutMs = 7_200_000,
  interactiveWaitMs = 12_000,
  surfaceTimeoutMs = 900_000,
  resumableGenerationStore = null,
  onTechnicalEvent = async () => {},
} = {}) {
  if (!apiKey) throw new Error('new_bos_production_generator_openai_binding_missing');
  if (model !== 'gpt-5.6-sol') throw new Error('new_bos_production_generator_model_mismatch');
  if (typeof resumableGenerationStore?.prepare !== 'function') throw new Error('new_bos_production_generator_resumable_store_required');
  const reasoningClient = new OpenAI({ apiKey, maxRetries: 0, timeout: reasoningTimeoutMs });
  const surfaceClient = new OpenAI({ apiKey, maxRetries: 0, timeout: surfaceTimeoutMs });
  const libraryRetriever = createHashBoundLibraryRetriever({ repositoryRoot });

  async function inspectAcceptedSemanticAssembly({ rawEvidence, providerModel, realizationIdentity }) {
    if (providerModel !== model) throw new Error('new_bos_production_generator_requested_model_mismatch');
    const evidenceIds = rawEvidence.evidence.map(({ evidence_id: evidenceId }) => evidenceId);
    const campaignIdentity = buildNewBosResumableCampaignIdentity({ realizationIdentity, evidenceIds });
    try {
      const fragments = [];
      for (const stage of NEW_BOS_SEMANTIC_STAGES) {
        const inspection = await resumableGenerationStore.inspect({
          campaignSha256: campaignIdentity.sha256,
          unitId: `semantic:${stage.id}`,
        });
        if (inspection?.record?.state !== 'ACCEPTED') {
          throw new Error(`new_bos_semantic_assembly_checkpoint_not_accepted:${stage.id}`);
        }
        fragments.push(Object.freeze({
          stage_id: stage.id,
          fragment: validateNewBosSemanticStageFragment({
            stageId: stage.id,
            fragment: inspection.record.accepted_value,
          }),
        }));
      }
      const interpretationDraft = assembleNewBosReasoningDraftV1({ fragments });
      const governedContext = await retrieveNewBosGovernedReasoningContext({ libraryRetriever });
      const artifact = await runPersonalityDnaProductionContract({
        activation: 'real_profile_hs_gate_v1',
        rawEvidence,
        providerModel: model,
        libraryRetriever,
        reasoningProvider: null,
        governedContext,
        interpretationDraft,
      });
      return Object.freeze({
        status: 'SEMANTIC_ASSEMBLY_VALID',
        campaign_sha256: campaignIdentity.sha256,
        interpretation_draft_sha256: sha256Stable(interpretationDraft),
        surface_packet_count: artifact.surface_packets?.length || 0,
      });
    } catch (error) {
      return Object.freeze({
        status: 'SEMANTIC_ASSEMBLY_INVALID',
        campaign_sha256: campaignIdentity.sha256,
        failure_code: String(error?.message || error?.name || 'unknown_failure').slice(0, 300),
        failure_sha256: sha256Stable({
          name: error?.name || null,
          message: error?.message || null,
          stack_frame: String(error?.stack || '').split('\n')[1]?.trim() || null,
        }),
      });
    }
  }

  const generate = async function generate({
    rawEvidence,
    providerModel,
    realizationIdentity,
    assertCurrentAuthority = async () => {},
  }) {
    if (providerModel !== model) throw new Error('new_bos_production_generator_requested_model_mismatch');
    if (!realizationIdentity?.sha256) throw new Error('new_bos_production_generator_realization_identity_required');
    if (typeof assertCurrentAuthority !== 'function') throw new Error('new_bos_production_generator_authority_assertion_invalid');
    const guardedReasoningClient = authorityGuardedProviderClient(reasoningClient, assertCurrentAuthority);
    const guardedCheckpointStore = authorityGuardedCheckpointStore(resumableGenerationStore, assertCurrentAuthority);
    const privacyTokens = deriveProviderIdentityTokens(rawEvidence);
    let currentExecutionUsage = ZERO_USAGE;
    let surfaceCalls = 0;
    let reusedSurfaces = 0;
    const submitSurfaceRequest = authorityGuardedProviderTransport(async (request) => {
      if (surfaceCalls >= SURFACES.length) throw new Error('new_bos_surface_provider_call_boundary_exceeded');
      surfaceCalls += 1;
      return surfaceClient.responses.create(request);
    }, assertCurrentAuthority);

    const surfaceRealizer = createNewBosHumanRealizationProvider({
      model,
      privacyTokens,
      capture: async ({ request, response, receipt }) => {
        const privacy = inspectProviderPrivacy(request, privacyTokens);
        if (!privacy.valid) throw Object.assign(new Error('new_bos_surface_provider_privacy_gate_failed'), { failures: privacy.failures });
        const usage = providerUsage(response);
        currentExecutionUsage = addUsage(currentExecutionUsage, usage);
        await onTechnicalEvent(Object.freeze({
          stage: 'surface_completed',
          surface_id: receipt.surface_id,
          provider_response_id_sha256: receipt.provider_response_id
            ? sha256Stable(receipt.provider_response_id)
            : null,
          requested_model: receipt.requested_model,
          returned_model: receipt.returned_model,
          latency_ms: receipt.latency_ms,
          usage,
        }));
      },
      transport: async (request) => {
        const privacy = inspectProviderPrivacy(request, privacyTokens);
        if (!privacy.valid) throw Object.assign(new Error('new_bos_surface_provider_privacy_gate_failed'), { failures: privacy.failures });
        return submitSurfaceRequest(request);
      },
    });

    const governedContext = await retrieveNewBosGovernedReasoningContext({ libraryRetriever });
    const semantic = await runNewBosResumableSemanticGeneration({
      rawEvidence,
      governedContext,
      realizationIdentity,
      model,
      client: guardedReasoningClient,
      checkpointStore: guardedCheckpointStore,
      privacyTokens,
      interactiveWaitMs,
      onTechnicalEvent,
      onUsage: async (response) => {
        currentExecutionUsage = addUsage(currentExecutionUsage, providerUsage(response));
      },
    });
    const governedArtifact = await runPersonalityDnaProductionContract({
      activation: 'real_profile_hs_gate_v1',
      rawEvidence,
      providerModel: model,
      libraryRetriever,
      reasoningProvider: null,
      governedContext,
      interpretationDraft: semantic.interpretation_draft,
    });
    const acceptedSurfaceUsage = [];
    let acceptedSurfaceSubmissionCount = 0;
    const artifact = await realizePersonalityDnaArtifactBounded({
      artifact: governedArtifact,
      providerModel: model,
      surfaceRealizer,
      checkpointStore: guardedCheckpointStore,
      campaignIdentity: semantic.campaign_identity,
      onSurfaceCheckpoint: async ({ reused, usage, provider_submissions: providerSubmissions }) => {
        if (reused) reusedSurfaces += 1;
        acceptedSurfaceSubmissionCount += providerSubmissions;
        acceptedSurfaceUsage.push(storedUsage(usage));
      },
    });
    if (semantic.accepted_stages.length !== 4 || artifact.surface_packets.length !== SURFACES.length) {
      throw new Error('new_bos_production_generator_checkpoint_completeness_mismatch');
    }
    const acceptedCampaignUsage = [
      ...semantic.accepted_stage_usage.map(({ usage }) => storedUsage(usage)),
      ...acceptedSurfaceUsage,
    ].reduce(addUsage, ZERO_USAGE);
    const acceptedCampaignSubmissionCount = semantic.campaign_provider_submissions
      + acceptedSurfaceSubmissionCount;
    const currentExecutionSubmissionCount = semantic.provider_submissions + surfaceCalls;
    return Object.freeze({
      artifact,
      provider_accounting: Object.freeze({
        model,
        store: false,
        calls: acceptedCampaignSubmissionCount,
        reasoning_calls: semantic.campaign_provider_submissions,
        reasoning_stage_count: semantic.accepted_stages.length,
        surface_calls: acceptedSurfaceSubmissionCount,
        current_execution_calls: currentExecutionSubmissionCount,
        current_execution_reasoning_calls: semantic.provider_submissions,
        current_execution_surface_calls: surfaceCalls,
        reused_surface_checkpoints: reusedSurfaces,
        surface_concurrency: NEW_BOS_PRODUCTION_SURFACE_CONCURRENCY,
        retries: 0,
        usage: acceptedCampaignUsage,
        current_execution_usage: currentExecutionUsage,
        estimated_cost_usd: estimateProviderCost(acceptedCampaignUsage),
        resumable_campaign_sha256: semantic.campaign_identity.sha256,
        reasoning_draft_sha256: semantic.interpretation_draft_sha256,
        accepted_semantic_stages: semantic.accepted_stages,
        reasoning_provider_submissions: semantic.provider_submissions,
        reasoning_provider_retrievals: semantic.provider_retrievals,
      }),
    });
  };

  Object.defineProperty(generate, 'recoverStaleSurfaceRouting', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: async ({
      rawEvidence,
      providerModel,
      realizationIdentity,
      expectedCampaignSha256,
      expectedUnitIdentitySha256,
      expectedRequestSha256,
      expectedProviderResponseIdSha256,
    } = {}) => {
      if (providerModel !== model) throw new Error('new_bos_production_generator_requested_model_mismatch');
      if (!realizationIdentity?.sha256) throw new Error('new_bos_production_generator_realization_identity_required');
      const privacyTokens = deriveProviderIdentityTokens(rawEvidence);
      const governedContext = await retrieveNewBosGovernedReasoningContext({ libraryRetriever });
      const acceptedDependencies = [];
      for (const stage of NEW_BOS_SEMANTIC_STAGES.slice(0, 3)) {
        const unitId = `semantic:${stage.id}`;
        const inspection = await resumableGenerationStore.inspect({
          campaignSha256: expectedCampaignSha256,
          unitId,
        });
        if (inspection?.record?.state !== 'ACCEPTED'
          || inspection?.classification?.disposition !== 'REUSE_ACCEPTED') {
          throw new Error(`new_bos_stale_queue_dependency_not_accepted:${stage.id}`);
        }
        const fragment = validateNewBosSemanticStageFragment({
          stageId: stage.id,
          fragment: inspection.record.accepted_value,
        });
        acceptedDependencies.push(Object.freeze({
          stage_id: stage.id,
          fragment,
          fragment_sha256: inspection.record.accepted_value_sha256,
        }));
      }
      const plan = buildNewBosSemanticUnitPlan({
        rawEvidence,
        governedContext,
        realizationIdentity,
        model,
        stageId: 'surface_routing',
        acceptedDependencies,
        privacyTokens,
        requestContractVersion: NEW_BOS_SEMANTIC_STAGE_REQUEST_CONTRACT_V1,
      });
      if (plan.campaign_identity.sha256 !== expectedCampaignSha256
        || plan.unit_identity_sha256 !== expectedUnitIdentitySha256
        || plan.request_sha256 !== expectedRequestSha256
        || plan.unit_id !== 'semantic:surface_routing') {
        throw new Error('new_bos_stale_queue_recomputed_identity_mismatch');
      }

      const claimed = await resumableGenerationStore.claimStaleQueuedReplacement({
        campaignSha256: expectedCampaignSha256,
        unitId: plan.unit_id,
        unitIdentitySha256: plan.unit_identity_sha256,
        requestSha256: plan.request_sha256,
        expectedProviderResponseIdSha256,
      });
      const retirement = await retireStaleNewBosBackgroundResponse({
        client: reasoningClient,
        responseId: claimed.responseId,
      });
      if (retirement.disposition === 'PRESERVE_COMPLETED') {
        const provider = createNewBosSemanticStageProvider({
          model,
          stageId: 'surface_routing',
          privacyTokens,
          transport: async (request) => {
            if (sha256Stable(request) !== plan.request_sha256) {
              throw new Error('new_bos_stale_queue_completed_request_drift');
            }
            return retirement.provider_response;
          },
        });
        const fragment = await provider.infer({
          raw_evidence: rawEvidence,
          governed_context: governedContext,
          accepted_dependencies: acceptedDependencies,
        });
        await resumableGenerationStore.accept({
          campaignSha256: expectedCampaignSha256,
          unitId: plan.unit_id,
          unitIdentitySha256: plan.unit_identity_sha256,
          requestSha256: plan.request_sha256,
          value: fragment,
        });
        return Object.freeze({
          status: 'PROVIDER_COMPLETED_ACCEPTED',
          replacement_prepared: false,
          provider_terminal_status: retirement.status,
          campaign_sha256: expectedCampaignSha256,
          unit_identity: plan.unit_id,
        });
      }
      if (retirement.disposition !== 'RETIRE_CANCELLED') {
        return Object.freeze({
          status: 'PROVIDER_TERMINAL_STOP',
          replacement_prepared: false,
          provider_terminal_status: retirement.status,
          provider_terminal_reason: retirement.terminal_reason,
          campaign_sha256: expectedCampaignSha256,
          unit_identity: plan.unit_id,
        });
      }
      const prepared = await resumableGenerationStore.retireStaleQueuedAndPrepareReplacement({
        campaignSha256: expectedCampaignSha256,
        unitId: plan.unit_id,
        unitIdentitySha256: plan.unit_identity_sha256,
        requestSha256: plan.request_sha256,
        expectedProviderResponseIdSha256,
        cancellation: retirement,
      });
      const onEvent = async (event) => resumableGenerationStore.observe({
        campaignSha256: expectedCampaignSha256,
        unitId: plan.unit_id,
        unitIdentitySha256: plan.unit_identity_sha256,
        requestSha256: plan.request_sha256,
        event,
      });
      const provider = createNewBosSemanticStageProvider({
        model,
        stageId: 'surface_routing',
        privacyTokens,
        requestContractVersion: NEW_BOS_SEMANTIC_STAGE_REQUEST_CONTRACT_V1,
        transport: async (request) => {
          if (sha256Stable(request) !== plan.request_sha256) {
            throw new Error('new_bos_stale_queue_replacement_request_drift');
          }
          const result = await executeNewBosBackgroundResponse({
            client: reasoningClient,
            scientificRequest: request,
            maxWaitMs: interactiveWaitMs,
            onEvent,
          });
          return result.response;
        },
      });
      try {
        const fragment = await provider.infer({
          raw_evidence: rawEvidence,
          governed_context: governedContext,
          accepted_dependencies: acceptedDependencies,
        });
        const accepted = await resumableGenerationStore.accept({
          campaignSha256: expectedCampaignSha256,
          unitId: plan.unit_id,
          unitIdentitySha256: plan.unit_identity_sha256,
          requestSha256: plan.request_sha256,
          value: fragment,
        });
        return Object.freeze({
          status: 'SURFACE_ROUTING_REPLACEMENT_ACCEPTED',
          replacement_prepared: prepared.disposition === 'START_REPLACEMENT',
          replacement_attempt: prepared.record.attempt,
          provider_terminal_status: accepted.observation?.status || 'completed',
          campaign_sha256: expectedCampaignSha256,
          unit_identity: plan.unit_id,
          accepted_value_sha256: accepted.accepted_value_sha256,
        });
      } catch (error) {
        if (['background_poll_timeout', 'background_resume_poll_timeout'].includes(error?.code)) {
          return Object.freeze({
            status: 'SURFACE_ROUTING_REPLACEMENT_IN_PROGRESS',
            replacement_prepared: true,
            replacement_attempt: prepared.record.attempt,
            provider_terminal_status: 'queued',
            campaign_sha256: expectedCampaignSha256,
            unit_identity: plan.unit_id,
          });
        }
        if (/privacy|model_substitution|invalid_json|empty_output|fragment|schema|evidence|authority|truth/u.test(error?.message || '')) {
          await resumableGenerationStore.rejectSemantic({
            campaignSha256: expectedCampaignSha256,
            unitId: plan.unit_id,
            unitIdentitySha256: plan.unit_identity_sha256,
            requestSha256: plan.request_sha256,
            code: error?.message,
          });
        }
        throw error;
      }
    },
  });
  Object.defineProperty(generate, 'inspectAcceptedSemanticAssembly', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: inspectAcceptedSemanticAssembly,
  });
  Object.defineProperty(generate, 'repairInvalidStage3VectorFree', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: async ({
      rawEvidence,
      providerModel,
      realizationIdentity,
      expectedCampaignSha256,
      expectedStage3,
      expectedStage4,
    } = {}) => {
      if (providerModel !== model) throw new Error('new_bos_production_generator_requested_model_mismatch');
      if (!realizationIdentity?.sha256) throw new Error('new_bos_production_generator_realization_identity_required');
      const privacyTokens = deriveProviderIdentityTokens(rawEvidence);
      const governedContext = await retrieveNewBosGovernedReasoningContext({ libraryRetriever });
      const acceptedDependencies = [];
      for (const stage of NEW_BOS_SEMANTIC_STAGES.slice(0, 2)) {
        const inspection = await resumableGenerationStore.inspect({
          campaignSha256: expectedCampaignSha256,
          unitId: `semantic:${stage.id}`,
        });
        if (inspection?.record?.state !== 'ACCEPTED'
          || inspection?.classification?.disposition !== 'REUSE_ACCEPTED') {
          throw new Error(`new_bos_invalid_stage3_dependency_not_accepted:${stage.id}`);
        }
        const fragment = validateNewBosSemanticStageFragment({
          stageId: stage.id,
          fragment: inspection.record.accepted_value,
        });
        acceptedDependencies.push(Object.freeze({
          stage_id: stage.id,
          fragment,
          fragment_sha256: inspection.record.accepted_value_sha256,
        }));
      }
      const plan = buildNewBosSemanticUnitPlan({
        rawEvidence,
        governedContext,
        realizationIdentity,
        model,
        stageId: 'whole_person_decision_synthesis',
        acceptedDependencies,
        privacyTokens,
        requestContractVersion: NEW_BOS_SEMANTIC_STAGE_REQUEST_CONTRACT_V1,
      });
      if (plan.campaign_identity.sha256 !== expectedCampaignSha256
        || plan.unit_identity_sha256 !== expectedStage3?.unit_identity_sha256
        || plan.request_sha256 !== expectedStage3?.request_sha256
        || plan.unit_id !== 'semantic:whole_person_decision_synthesis') {
        throw new Error('new_bos_invalid_stage3_recomputed_identity_mismatch');
      }
      const currentStage3 = await resumableGenerationStore.inspect({
        campaignSha256: expectedCampaignSha256,
        unitId: plan.unit_id,
      });
      if (currentStage3?.record?.state !== 'ACCEPTED'
        || currentStage3.record.accepted_value_sha256 !== expectedStage3?.accepted_value_sha256) {
        throw new Error('new_bos_invalid_stage3_checkpoint_identity_mismatch');
      }
      let failureCode = null;
      try {
        validateNewBosSemanticStageFragment({
          stageId: 'whole_person_decision_synthesis',
          fragment: currentStage3.record.accepted_value,
        });
      } catch (error) {
        failureCode = String(error?.message || '');
      }
      if (!failureCode.startsWith('Whole-person model leaked assessment language:')) {
        throw new Error('new_bos_invalid_stage3_vector_free_failure_not_reproduced');
      }
      const currentStage4 = await resumableGenerationStore.inspect({
        campaignSha256: expectedCampaignSha256,
        unitId: 'semantic:surface_routing',
      });
      if (currentStage4?.record?.state !== 'ACCEPTED'
        || currentStage4.record.unit_identity_sha256 !== expectedStage4?.unit_identity_sha256
        || currentStage4.record.request_sha256 !== expectedStage4?.request_sha256
        || currentStage4.record.accepted_value_sha256 !== expectedStage4?.accepted_value_sha256) {
        throw new Error('new_bos_invalid_stage4_checkpoint_identity_mismatch');
      }
      const retired = await resumableGenerationStore.retireInvalidStage3AndDependentStage4({
        campaignSha256: expectedCampaignSha256,
        expectedStage3,
        expectedStage4,
        failureCode,
      });
      const onEvent = async (event) => resumableGenerationStore.observe({
        campaignSha256: expectedCampaignSha256,
        unitId: plan.unit_id,
        unitIdentitySha256: plan.unit_identity_sha256,
        requestSha256: plan.request_sha256,
        event,
      });
      const provider = createNewBosSemanticStageProvider({
        model,
        stageId: 'whole_person_decision_synthesis',
        privacyTokens,
        requestContractVersion: NEW_BOS_SEMANTIC_STAGE_REQUEST_CONTRACT_V1,
        transport: async (request) => {
          if (sha256Stable(request) !== plan.request_sha256) {
            throw new Error('new_bos_invalid_stage3_replacement_request_drift');
          }
          const result = await executeNewBosBackgroundResponse({
            client: reasoningClient,
            scientificRequest: request,
            maxWaitMs: interactiveWaitMs,
            onEvent,
          });
          return result.response;
        },
      });
      try {
        const fragment = await provider.infer({
          raw_evidence: rawEvidence,
          governed_context: governedContext,
          accepted_dependencies: acceptedDependencies,
        });
        const accepted = await resumableGenerationStore.accept({
          campaignSha256: expectedCampaignSha256,
          unitId: plan.unit_id,
          unitIdentitySha256: plan.unit_identity_sha256,
          requestSha256: plan.request_sha256,
          value: fragment,
        });
        return Object.freeze({
          status: 'STAGE3_VECTOR_FREE_REPLACEMENT_ACCEPTED',
          replacement_attempt: retired.stage3.attempt,
          stage4_state: retired.stage4.state,
          accepted_value_sha256: accepted.accepted_value_sha256,
          campaign_sha256: expectedCampaignSha256,
        });
      } catch (error) {
        if (error?.code === 'background_poll_timeout') {
          return Object.freeze({
            status: 'STAGE3_VECTOR_FREE_REPLACEMENT_IN_PROGRESS',
            replacement_attempt: retired.stage3.attempt,
            stage4_state: retired.stage4.state,
            campaign_sha256: expectedCampaignSha256,
          });
        }
        const rejection = classifySemanticValidationError(error);
        if (rejection) {
          await resumableGenerationStore.rejectSemantic({
            campaignSha256: expectedCampaignSha256,
            unitId: plan.unit_id,
            unitIdentitySha256: plan.unit_identity_sha256,
            requestSha256: plan.request_sha256,
            rejection,
          });
        }
        throw error;
      }
    },
  });
  Object.defineProperty(generate, 'replaceSemanticRejectedStage3', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: async ({
      rawEvidence,
      providerModel,
      realizationIdentity,
      expectedCampaignSha256,
      expectedStage3,
    } = {}) => {
      if (providerModel !== model) throw new Error('new_bos_production_generator_requested_model_mismatch');
      if (!realizationIdentity?.sha256) throw new Error('new_bos_production_generator_realization_identity_required');
      const privacyTokens = deriveProviderIdentityTokens(rawEvidence);
      const governedContext = await retrieveNewBosGovernedReasoningContext({ libraryRetriever });
      const acceptedDependencies = [];
      for (const stage of NEW_BOS_SEMANTIC_STAGES.slice(0, 2)) {
        const inspection = await resumableGenerationStore.inspect({
          campaignSha256: expectedCampaignSha256,
          unitId: `semantic:${stage.id}`,
        });
        if (inspection?.record?.state !== 'ACCEPTED'
          || inspection?.classification?.disposition !== 'REUSE_ACCEPTED') {
          throw new Error(`new_bos_semantic_rejected_stage3_dependency_not_accepted:${stage.id}`);
        }
        acceptedDependencies.push(Object.freeze({
          stage_id: stage.id,
          fragment: validateNewBosSemanticStageFragment({
            stageId: stage.id,
            fragment: inspection.record.accepted_value,
          }),
          fragment_sha256: inspection.record.accepted_value_sha256,
        }));
      }
      const plan = buildNewBosSemanticUnitPlan({
        rawEvidence,
        governedContext,
        realizationIdentity,
        model,
        stageId: 'whole_person_decision_synthesis',
        acceptedDependencies,
        privacyTokens,
        requestContractVersion: NEW_BOS_SEMANTIC_STAGE_REQUEST_CONTRACT_V1,
      });
      if (plan.campaign_identity.sha256 !== expectedCampaignSha256
        || plan.unit_identity_sha256 !== expectedStage3?.unit_identity_sha256
        || plan.request_sha256 !== expectedStage3?.request_sha256
        || plan.unit_id !== 'semantic:whole_person_decision_synthesis') {
        throw new Error('new_bos_semantic_rejected_stage3_recomputed_identity_mismatch');
      }
      const current = await resumableGenerationStore.inspect({
        campaignSha256: expectedCampaignSha256,
        unitId: plan.unit_id,
      });
      if (current?.record?.state !== 'SEMANTIC_REJECTED'
        || current.record.attempt !== 2
        || current.record.semantic_rejection_code !== 'VECTOR_FREE_ASSESSMENT_LANGUAGE_REJECTION'
        || current.record.semantic_validator !== 'assertVectorFreeWholePerson'
        || current.record.semantic_rejection_detail !== 'ADAPTABILITY_LANGUAGE') {
        throw new Error('new_bos_semantic_rejected_stage3_state_mismatch');
      }
      const retired = await resumableGenerationStore.retireSemanticRejectedStage3AndPrepareReplacement({
        campaignSha256: expectedCampaignSha256,
        expectedStage3,
      });
      const onEvent = async (event) => resumableGenerationStore.observe({
        campaignSha256: expectedCampaignSha256,
        unitId: plan.unit_id,
        unitIdentitySha256: plan.unit_identity_sha256,
        requestSha256: plan.request_sha256,
        event,
      });
      const provider = createNewBosSemanticStageProvider({
        model,
        stageId: 'whole_person_decision_synthesis',
        privacyTokens,
        requestContractVersion: NEW_BOS_SEMANTIC_STAGE_REQUEST_CONTRACT_V1,
        transport: async (request) => {
          if (sha256Stable(request) !== plan.request_sha256) {
            throw new Error('new_bos_semantic_rejected_stage3_replacement_request_drift');
          }
          const result = await executeNewBosBackgroundResponse({
            client: reasoningClient,
            scientificRequest: request,
            maxWaitMs: interactiveWaitMs,
            onEvent,
          });
          if (result.transport_evidence.submit_count !== 1) {
            throw new Error('new_bos_semantic_rejected_stage3_replacement_submission_count_invalid');
          }
          return result.response;
        },
      });
      try {
        const fragment = await provider.infer({
          raw_evidence: rawEvidence,
          governed_context: governedContext,
          accepted_dependencies: acceptedDependencies,
        });
        const accepted = await resumableGenerationStore.accept({
          campaignSha256: expectedCampaignSha256,
          unitId: plan.unit_id,
          unitIdentitySha256: plan.unit_identity_sha256,
          requestSha256: plan.request_sha256,
          value: fragment,
        });
        return Object.freeze({
          status: 'STAGE3_SEMANTIC_REJECTION_REPLACEMENT_ACCEPTED',
          replacement_attempt: retired.record.attempt,
          archive_sha256: retired.archive_sha256,
          accepted_value_sha256: accepted.accepted_value_sha256,
          campaign_sha256: expectedCampaignSha256,
          provider_submissions: 1,
        });
      } catch (error) {
        if (error?.code === 'background_poll_timeout') {
          return Object.freeze({
            status: 'STAGE3_SEMANTIC_REJECTION_REPLACEMENT_IN_PROGRESS',
            replacement_attempt: retired.record.attempt,
            archive_sha256: retired.archive_sha256,
            campaign_sha256: expectedCampaignSha256,
            provider_submissions: 1,
          });
        }
        const rejection = classifySemanticValidationError(error);
        if (rejection) {
          await resumableGenerationStore.rejectSemantic({
            campaignSha256: expectedCampaignSha256,
            unitId: plan.unit_id,
            unitIdentitySha256: plan.unit_identity_sha256,
            requestSha256: plan.request_sha256,
            rejection,
          });
        }
        throw error;
      }
    },
  });
  Object.defineProperty(generate, 'replaceStage3RequestContractV2', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: async ({
      rawEvidence,
      providerModel,
      realizationIdentity,
      expectedCampaignSha256,
      expectedStage3,
    } = {}) => {
      if (providerModel !== model) throw new Error('new_bos_production_generator_requested_model_mismatch');
      if (!realizationIdentity?.sha256) throw new Error('new_bos_production_generator_realization_identity_required');
      const privacyTokens = deriveProviderIdentityTokens(rawEvidence);
      const governedContext = await retrieveNewBosGovernedReasoningContext({ libraryRetriever });
      const acceptedDependencies = [];
      for (const stage of NEW_BOS_SEMANTIC_STAGES.slice(0, 2)) {
        const inspection = await resumableGenerationStore.inspect({
          campaignSha256: expectedCampaignSha256,
          unitId: `semantic:${stage.id}`,
        });
        if (inspection?.record?.state !== 'ACCEPTED'
          || inspection?.classification?.disposition !== 'REUSE_ACCEPTED') {
          throw new Error(`new_bos_stage3_request_contract_v2_dependency_not_accepted:${stage.id}`);
        }
        acceptedDependencies.push(Object.freeze({
          stage_id: stage.id,
          fragment: validateNewBosSemanticStageFragment({
            stageId: stage.id,
            fragment: inspection.record.accepted_value,
          }),
          fragment_sha256: inspection.record.accepted_value_sha256,
        }));
      }
      const legacyPlan = buildNewBosSemanticUnitPlan({
        rawEvidence,
        governedContext,
        realizationIdentity,
        model,
        stageId: 'whole_person_decision_synthesis',
        acceptedDependencies,
        privacyTokens,
        requestContractVersion: NEW_BOS_SEMANTIC_STAGE_REQUEST_CONTRACT_V1,
      });
      if (legacyPlan.campaign_identity.sha256 !== expectedCampaignSha256
        || legacyPlan.unit_identity_sha256 !== expectedStage3?.unit_identity_sha256
        || legacyPlan.request_sha256 !== expectedStage3?.request_sha256) {
        throw new Error('new_bos_stage3_request_contract_v2_prior_identity_mismatch');
      }
      const repairedPlan = buildNewBosSemanticUnitPlan({
        rawEvidence,
        governedContext,
        realizationIdentity,
        model,
        stageId: 'whole_person_decision_synthesis',
        acceptedDependencies,
        privacyTokens,
        requestContractVersion: NEW_BOS_STAGE3_VECTOR_FREE_REQUEST_CONTRACT_V2,
      });
      const transitioned = await resumableGenerationStore.archiveRejectedStage3AndPrepareRequestContractV2({
        campaignSha256: expectedCampaignSha256,
        expectedStage3,
        nextStage3: {
          unit_identity_sha256: repairedPlan.unit_identity_sha256,
          request_sha256: repairedPlan.request_sha256,
          request_contract_version: repairedPlan.request_contract_version,
        },
      });
      const onEvent = async (event) => resumableGenerationStore.observe({
        campaignSha256: expectedCampaignSha256,
        unitId: repairedPlan.unit_id,
        unitIdentitySha256: repairedPlan.unit_identity_sha256,
        requestSha256: repairedPlan.request_sha256,
        event,
      });
      const provider = createNewBosSemanticStageProvider({
        model,
        stageId: 'whole_person_decision_synthesis',
        privacyTokens,
        requestContractVersion: NEW_BOS_STAGE3_VECTOR_FREE_REQUEST_CONTRACT_V2,
        transport: async (request) => {
          if (sha256Stable(request) !== repairedPlan.request_sha256) {
            throw new Error('new_bos_stage3_request_contract_v2_request_drift');
          }
          const result = await executeNewBosBackgroundResponse({
            client: reasoningClient,
            scientificRequest: request,
            maxWaitMs: interactiveWaitMs,
            onEvent,
          });
          if (result.transport_evidence.submit_count !== 1) {
            throw new Error('new_bos_stage3_request_contract_v2_submission_count_invalid');
          }
          return result.response;
        },
      });
      try {
        const fragment = await provider.infer({
          raw_evidence: rawEvidence,
          governed_context: governedContext,
          accepted_dependencies: acceptedDependencies,
        });
        const accepted = await resumableGenerationStore.accept({
          campaignSha256: expectedCampaignSha256,
          unitId: repairedPlan.unit_id,
          unitIdentitySha256: repairedPlan.unit_identity_sha256,
          requestSha256: repairedPlan.request_sha256,
          value: fragment,
        });
        return Object.freeze({
          status: 'STAGE3_VECTOR_FREE_REQUEST_CONTRACT_V2_ACCEPTED',
          request_contract_version: repairedPlan.request_contract_version,
          request_sha256: repairedPlan.request_sha256,
          unit_identity_sha256: repairedPlan.unit_identity_sha256,
          prior_checkpoint_sha256: transitioned.prior_checkpoint_sha256,
          archive_sha256: transitioned.archive_sha256,
          accepted_value_sha256: accepted.accepted_value_sha256,
          campaign_sha256: expectedCampaignSha256,
          provider_submissions: 1,
        });
      } catch (error) {
        if (error?.code === 'background_poll_timeout') {
          return Object.freeze({
            status: 'STAGE3_VECTOR_FREE_REQUEST_CONTRACT_V2_IN_PROGRESS',
            request_contract_version: repairedPlan.request_contract_version,
            request_sha256: repairedPlan.request_sha256,
            unit_identity_sha256: repairedPlan.unit_identity_sha256,
            prior_checkpoint_sha256: transitioned.prior_checkpoint_sha256,
            archive_sha256: transitioned.archive_sha256,
            campaign_sha256: expectedCampaignSha256,
            provider_submissions: 1,
          });
        }
        const rejection = classifySemanticValidationError(error);
        if (rejection) {
          await resumableGenerationStore.rejectSemantic({
            campaignSha256: expectedCampaignSha256,
            unitId: repairedPlan.unit_id,
            unitIdentitySha256: repairedPlan.unit_identity_sha256,
            requestSha256: repairedPlan.request_sha256,
            rejection,
          });
        }
        throw error;
      }
    },
  });
  Object.defineProperty(generate, 'inspectCompletedStage3Validation', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: async ({
      rawEvidence,
      providerModel,
      realizationIdentity,
      expectedCampaignSha256,
      expectedUnitIdentitySha256,
      expectedRequestSha256,
      expectedProviderResponseIdSha256,
      persistSemanticRejection = false,
    } = {}) => {
      if (providerModel !== model) throw new Error('new_bos_production_generator_requested_model_mismatch');
      if (!realizationIdentity?.sha256) throw new Error('new_bos_production_generator_realization_identity_required');
      const privacyTokens = deriveProviderIdentityTokens(rawEvidence);
      const governedContext = await retrieveNewBosGovernedReasoningContext({ libraryRetriever });
      const acceptedDependencies = [];
      for (const stage of NEW_BOS_SEMANTIC_STAGES.slice(0, 2)) {
        const inspection = await resumableGenerationStore.inspect({
          campaignSha256: expectedCampaignSha256,
          unitId: `semantic:${stage.id}`,
        });
        if (inspection?.record?.state !== 'ACCEPTED'
          || inspection?.classification?.disposition !== 'REUSE_ACCEPTED') {
          throw new Error(`new_bos_completed_stage3_diagnostic_dependency_not_accepted:${stage.id}`);
        }
        acceptedDependencies.push(Object.freeze({
          stage_id: stage.id,
          fragment: validateNewBosSemanticStageFragment({
            stageId: stage.id,
            fragment: inspection.record.accepted_value,
          }),
          fragment_sha256: inspection.record.accepted_value_sha256,
        }));
      }
      const plan = buildNewBosSemanticUnitPlan({
        rawEvidence,
        governedContext,
        realizationIdentity,
        model,
        stageId: 'whole_person_decision_synthesis',
        acceptedDependencies,
        privacyTokens,
        requestContractVersion: NEW_BOS_SEMANTIC_STAGE_REQUEST_CONTRACT_V1,
      });
      if (plan.campaign_identity.sha256 !== expectedCampaignSha256
        || plan.unit_identity_sha256 !== expectedUnitIdentitySha256
        || plan.request_sha256 !== expectedRequestSha256) {
        throw new Error('new_bos_completed_stage3_diagnostic_identity_mismatch');
      }
      const inspection = await resumableGenerationStore.inspect({
        campaignSha256: expectedCampaignSha256,
        unitId: plan.unit_id,
      });
      if (inspection?.record?.state !== 'PROVIDER_COMPLETED'
        || inspection?.record?.attempt !== 2
        || inspection?.record?.observation?.status !== 'completed'
        || inspection?.classification?.reason !== 'completed_result_not_accepted') {
        throw new Error('new_bos_completed_stage3_diagnostic_state_mismatch');
      }
      const responseId = inspection.record.observation.provider_response_id;
      if (!responseId
        || providerResponseIdSha256(responseId) !== expectedProviderResponseIdSha256) {
        throw new Error('new_bos_completed_stage3_diagnostic_response_identity_mismatch');
      }
      const response = await reasoningClient.responses.retrieve(responseId);
      if (response?.id !== responseId) {
        throw new Error('new_bos_completed_stage3_diagnostic_provider_identity_changed');
      }
      const providerMetadata = sanitizeCompletedStage3ProviderMetadata(response);
      if (providerMetadata.provider_response_id_sha256 !== expectedProviderResponseIdSha256) {
        throw new Error('new_bos_completed_stage3_diagnostic_response_hash_changed');
      }
      if (response.status !== 'completed') {
        return Object.freeze({
          version: 'new_bos_completed_stage3_validation_diagnostic_v1',
          category: 'PROVIDER_INCOMPLETE_TERMINAL_ANOMALY',
          validator: 'provider_terminal_state',
          campaign_sha256: expectedCampaignSha256,
          unit_identity_sha256: expectedUnitIdentitySha256,
          request_sha256: expectedRequestSha256,
          provider: providerMetadata,
          provider_submissions: 0,
          provider_retrievals: 1,
          checkpoint_writes: 0,
        });
      }
      const provider = createNewBosSemanticStageProvider({
        model,
        stageId: 'whole_person_decision_synthesis',
        privacyTokens,
        requestContractVersion: NEW_BOS_SEMANTIC_STAGE_REQUEST_CONTRACT_V1,
        transport: async (request) => {
          if (sha256Stable(request) !== expectedRequestSha256) {
            throw new Error('new_bos_completed_stage3_diagnostic_request_drift');
          }
          return response;
        },
      });
      try {
        await provider.infer({
          raw_evidence: rawEvidence,
          governed_context: governedContext,
          accepted_dependencies: acceptedDependencies,
        });
        return Object.freeze({
          version: 'new_bos_completed_stage3_validation_diagnostic_v1',
          category: 'ACCEPTANCE_VALIDATION_PASSED_CHECKPOINT_UNACCEPTED',
          validator: 'stage3_acceptance_validator',
          campaign_sha256: expectedCampaignSha256,
          unit_identity_sha256: expectedUnitIdentitySha256,
          request_sha256: expectedRequestSha256,
          provider: providerMetadata,
          provider_submissions: 0,
          provider_retrievals: 1,
          checkpoint_writes: 0,
        });
      } catch (error) {
        const rejection = classifySemanticValidationError(error);
        if (persistSemanticRejection && !rejection) {
          throw new Error('new_bos_completed_stage3_semantic_rejection_not_typed');
        }
        const checkpoint = persistSemanticRejection
          ? await resumableGenerationStore.rejectSemantic({
            campaignSha256: expectedCampaignSha256,
            unitId: plan.unit_id,
            unitIdentitySha256: expectedUnitIdentitySha256,
            requestSha256: expectedRequestSha256,
            rejection,
          })
          : null;
        return Object.freeze({
          version: 'new_bos_completed_stage3_validation_diagnostic_v1',
          ...classifyCompletedStage3ValidationError(error),
          campaign_sha256: expectedCampaignSha256,
          unit_identity_sha256: expectedUnitIdentitySha256,
          request_sha256: expectedRequestSha256,
          provider: providerMetadata,
          provider_submissions: 0,
          provider_retrievals: 1,
          checkpoint_writes: checkpoint ? 1 : 0,
          checkpoint_state: checkpoint?.state || inspection.record.state,
          semantic_rejection_code: checkpoint?.semantic_rejection_code || null,
          semantic_validator: checkpoint?.semantic_validator || null,
          semantic_rejection_detail: checkpoint?.semantic_rejection_detail || null,
        });
      }
    },
  });
  return Object.freeze(generate);
}
