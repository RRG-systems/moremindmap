import OpenAI from 'openai';

import { estimateProviderCost, providerUsage } from '../bosCustomerIntelligence/governedProbabilisticRealizerProvider.js';
import { createNewBosHumanRealizationProvider } from '../newBosPersonalityDnaV1/humanRealizationProvider.js';
import { runPersonalityDnaProductionContract } from '../../../src/lib/newBosPersonalityDnaV1/runtimeOrchestrator.js';
import { SURFACES } from '../../../src/lib/newBosPersonalityDnaV1/constants.js';

import {
  buildNewBosBackgroundExecutionRequest,
  executeNewBosBackgroundResponse,
  inspectNewBosBackgroundTransportDiff,
  resumeNewBosBackgroundResponse,
} from './backgroundResponsesTransport.js';
import {
  NEW_BOS_PRODUCTION_SURFACE_CONCURRENCY,
  realizePersonalityDnaArtifactBounded,
} from './boundedSurfaceRealization.js';
import { createHashBoundLibraryRetriever } from './libraryRetriever.js';
import { deriveProviderIdentityTokens, inspectProviderPrivacy } from './privacyEgress.js';
import { createNewBosReasoningProvider } from './reasoningProvider.js';

function addUsage(left, right) {
  return Object.freeze({
    input_tokens: left.input_tokens + right.input_tokens,
    cached_input_tokens: left.cached_input_tokens + right.cached_input_tokens,
    cache_write_tokens: left.cache_write_tokens + right.cache_write_tokens,
    output_tokens: left.output_tokens + right.output_tokens,
    reasoning_tokens: left.reasoning_tokens + right.reasoning_tokens,
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
  surfaceTimeoutMs = 900_000,
  backgroundResponseStore = null,
  onTechnicalEvent = async () => {},
} = {}) {
  if (!apiKey) throw new Error('new_bos_production_generator_openai_binding_missing');
  if (model !== 'gpt-5.6-sol') throw new Error('new_bos_production_generator_model_mismatch');
  const reasoningClient = new OpenAI({ apiKey, maxRetries: 0, timeout: reasoningTimeoutMs });
  const surfaceClient = new OpenAI({ apiKey, maxRetries: 0, timeout: surfaceTimeoutMs });
  const libraryRetriever = createHashBoundLibraryRetriever({ repositoryRoot });

  return async function generate({ rawEvidence, providerModel, realizationIdentity }) {
    if (providerModel !== model) throw new Error('new_bos_production_generator_requested_model_mismatch');
    if (!realizationIdentity?.sha256) throw new Error('new_bos_production_generator_realization_identity_required');
    const privacyTokens = deriveProviderIdentityTokens(rawEvidence);
    let aggregateUsage = ZERO_USAGE;
    let providerCalls = 0;
    let surfaceCalls = 0;
    let reasoningTransport = null;

    const reasoningProvider = createNewBosReasoningProvider({
      model,
      privacyTokens,
      transport: async (request) => {
        providerCalls += 1;
        const checkpoint = backgroundResponseStore
          ? await backgroundResponseStore.load({ realizationIdentitySha256: realizationIdentity.sha256 })
          : null;
        if (checkpoint) {
          const inspection = inspectNewBosBackgroundTransportDiff({
            scientificRequest: request,
            executionRequest: buildNewBosBackgroundExecutionRequest(request),
          });
          if (!inspection.valid || inspection.scientific_request_sha256 !== checkpoint.scientific_request_sha256) {
            throw new Error('new_bos_background_resume_request_hash_mismatch');
          }
        }
        const onEvent = async (event) => {
          if (backgroundResponseStore) {
            await backgroundResponseStore.save({
              realizationIdentitySha256: realizationIdentity.sha256,
              event,
            });
          }
          await onTechnicalEvent(Object.freeze({ stage: 'reasoning_transport', ...event }));
        };
        const result = checkpoint
          ? await resumeNewBosBackgroundResponse({
            client: reasoningClient,
            responseId: checkpoint.provider_response_id,
            scientificRequest: request,
            maxWaitMs: reasoningTimeoutMs,
            onEvent,
          })
          : await executeNewBosBackgroundResponse({
            client: reasoningClient,
            scientificRequest: request,
            maxWaitMs: reasoningTimeoutMs,
            onEvent,
          });
        reasoningTransport = result.transport_evidence;
        return result.response;
      },
      capture: async ({ response, receipt }) => {
        const usage = providerUsage(response);
        aggregateUsage = addUsage(aggregateUsage, usage);
        await onTechnicalEvent(Object.freeze({
          stage: 'reasoning_completed',
          provider_response_id: receipt.provider_response_id,
          requested_model: receipt.requested_model,
          returned_model: receipt.returned_model,
          latency_ms: receipt.latency_ms,
          usage,
        }));
      },
    });

    const surfaceRealizer = createNewBosHumanRealizationProvider({
      model,
      privacyTokens,
      capture: async ({ request, response, receipt }) => {
        const privacy = inspectProviderPrivacy(request, privacyTokens);
        if (!privacy.valid) throw Object.assign(new Error('new_bos_surface_provider_privacy_gate_failed'), { failures: privacy.failures });
        const usage = providerUsage(response);
        aggregateUsage = addUsage(aggregateUsage, usage);
        await onTechnicalEvent(Object.freeze({
          stage: 'surface_completed',
          surface_id: receipt.surface_id,
          provider_response_id: receipt.provider_response_id,
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
        providerCalls += 1;
        return surfaceClient.responses.create(request);
      },
    });

    const governedArtifact = await runPersonalityDnaProductionContract({
      activation: 'real_profile_hs_gate_v1',
      rawEvidence,
      providerModel: model,
      libraryRetriever,
      reasoningProvider,
    });
    const artifact = await realizePersonalityDnaArtifactBounded({
      artifact: governedArtifact,
      providerModel: model,
      surfaceRealizer,
    });
    if (reasoningProvider.callCount() !== 1 || surfaceCalls !== SURFACES.length || providerCalls !== SURFACES.length + 1) {
      throw new Error('new_bos_production_generator_call_count_mismatch');
    }
    return Object.freeze({
      artifact,
      provider_accounting: Object.freeze({
        model,
        store: false,
        calls: providerCalls,
        reasoning_calls: 1,
        surface_calls: surfaceCalls,
        surface_concurrency: NEW_BOS_PRODUCTION_SURFACE_CONCURRENCY,
        retries: 0,
        usage: aggregateUsage,
        estimated_cost_usd: estimateProviderCost(aggregateUsage),
        reasoning_transport: reasoningTransport,
        reasoning_provider_submissions: reasoningTransport?.submit_count ?? null,
      }),
    });
  };
}
