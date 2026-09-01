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
import { createNewBosSemanticStageProvider } from './reasoningProvider.js';
import {
  buildNewBosSemanticUnitPlan,
  runNewBosResumableSemanticGeneration,
} from './resumableGenerationOrchestrator.js';
import {
  NEW_BOS_SEMANTIC_STAGES,
  validateNewBosSemanticStageFragment,
} from './resumableSemanticContract.js';

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

  const generate = async function generate({ rawEvidence, providerModel, realizationIdentity }) {
    if (providerModel !== model) throw new Error('new_bos_production_generator_requested_model_mismatch');
    if (!realizationIdentity?.sha256) throw new Error('new_bos_production_generator_realization_identity_required');
    const privacyTokens = deriveProviderIdentityTokens(rawEvidence);
    let currentExecutionUsage = ZERO_USAGE;
    let surfaceCalls = 0;
    let reusedSurfaces = 0;

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
        if (surfaceCalls >= SURFACES.length) throw new Error('new_bos_surface_provider_call_boundary_exceeded');
        const privacy = inspectProviderPrivacy(request, privacyTokens);
        if (!privacy.valid) throw Object.assign(new Error('new_bos_surface_provider_privacy_gate_failed'), { failures: privacy.failures });
        surfaceCalls += 1;
        return surfaceClient.responses.create(request);
      },
    });

    const governedContext = await retrieveNewBosGovernedReasoningContext({ libraryRetriever });
    const semantic = await runNewBosResumableSemanticGeneration({
      rawEvidence,
      governedContext,
      realizationIdentity,
      model,
      client: reasoningClient,
      checkpointStore: resumableGenerationStore,
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
      checkpointStore: resumableGenerationStore,
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
  return Object.freeze(generate);
}
