import crypto from 'node:crypto';

import OpenAI from 'openai';

import {
  buildProviderSafeSurfaceInput,
  deriveProviderIdentityTokens,
  inspectProviderPrivacy,
} from '../newBosProductionReadinessV1/privacyEgress.js';

import {
  buildHumanRealizationRequest,
  communicationDoctrineForSurface,
} from '../../../src/lib/newBosPersonalityDnaV1/index.js';

function responseText(response) {
  if (typeof response?.output_text === 'string') return response.output_text;
  return (response?.output || []).flatMap((item) => item?.content || [])
    .filter((item) => item?.type === 'output_text')
    .map((item) => item.text)
    .join('');
}

function usageReceipt(response) {
  const usage = response?.usage || {};
  return Object.freeze({
    input_tokens: Number(usage.input_tokens) || 0,
    cached_input_tokens: Number(usage.input_tokens_details?.cached_tokens) || 0,
    output_tokens: Number(usage.output_tokens) || 0,
    reasoning_tokens: Number(usage.output_tokens_details?.reasoning_tokens) || 0,
  });
}

function parseResponse(response) {
  const text = responseText(response);
  if (!text) throw new Error('human_realization_provider_empty_output');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('human_realization_provider_invalid_json');
  }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.customer_prose !== 'string' || !parsed.customer_prose.trim()) {
    throw new Error('human_realization_provider_invalid_schema');
  }
  if (Object.keys(parsed).length !== 1) throw new Error('human_realization_provider_extra_fields');
  return parsed;
}

function safetyIdentifier(cacheKey) {
  return crypto.createHash('sha256').update(String(cacheKey)).digest('hex').slice(0, 32);
}

function modelMatches(requested, returned) {
  return !returned || returned === requested || String(returned).startsWith(`${requested}-`);
}

export function createNewBosHumanRealizationProvider({
  transport,
  model,
  capture = async () => {},
  privacyTokens = [],
} = {}) {
  if (typeof transport !== 'function') throw new Error('human_realization_transport_required');
  if (!model) throw new Error('human_realization_model_required');
  if (typeof capture !== 'function') throw new Error('human_realization_capture_must_be_function');

  return Object.freeze({
    async realize({ surface_id: surfaceId, human_realization_input: input, writer_instruction: doctrine, cache_key: cacheKey }) {
      if (JSON.stringify(doctrine) !== JSON.stringify(communicationDoctrineForSurface(surfaceId))) {
        throw new Error('human_realization_doctrine_mismatch');
      }
      const governedPrivacyTokens = [
        ...deriveProviderIdentityTokens({ identity_context: input?.person || {} }),
        ...privacyTokens,
      ];
      const providerSafeInput = buildProviderSafeSurfaceInput(input, governedPrivacyTokens);
      const request = buildHumanRealizationRequest({
        model,
        input: providerSafeInput,
        safetyIdentifier: safetyIdentifier(cacheKey),
        writerInstruction: doctrine,
      });
      const privacy = inspectProviderPrivacy(request, governedPrivacyTokens);
      if (!privacy.valid) {
        throw Object.assign(new Error('new_bos_surface_provider_privacy_gate_failed'), {
          failures: privacy.failures,
        });
      }
      const startedAt = Date.now();
      const response = await transport(request);
      if (response?.status && response.status !== 'completed') {
        throw new Error(`human_realization_provider_terminal_status:${response.status}`);
      }
      if (!modelMatches(model, response?.model)) {
        throw new Error('human_realization_provider_model_substitution_rejected');
      }
      const parsed = parseResponse(response);
      const receipt = Object.freeze({
        surface_id: surfaceId,
        requested_model: model,
        returned_model: response?.model || null,
        provider_response_id: response?._request_id || response?.id || null,
        latency_ms: Date.now() - startedAt,
        usage: usageReceipt(response),
      });
      await capture(Object.freeze({ request, response, receipt }));
      return Object.freeze({
        customer_prose: parsed.customer_prose.trim(),
        generation: receipt,
      });
    },
  });
}

export function createOpenAINewBosHumanRealizationProvider({
  apiKey,
  model,
  timeoutMs = 900_000,
  capture,
  privacyTokens = [],
} = {}) {
  if (!apiKey) throw new Error('human_realization_openai_key_missing');
  const client = new OpenAI({ apiKey, maxRetries: 0, timeout: timeoutMs });
  return createNewBosHumanRealizationProvider({
    model,
    capture,
    privacyTokens,
    transport: (request) => client.responses.create(request),
  });
}

export { parseResponse as parseNewBosHumanRealizationResponse };
