import OpenAI from 'openai';

import { RECRUITING_GU_EXPERIMENT_2_MODEL_CONFIG } from '../../../src/lib/recruitingGuV1/experiment2Contract.js';

function outputText(response) {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) return response.output_text;
  return (response?.output || [])
    .filter((item) => item?.type === 'message')
    .flatMap((item) => item.content || [])
    .filter((item) => item?.type === 'output_text')
    .map((item) => item.text)
    .join('');
}

function providerError(error) {
  const wrapped = new Error('RECRUITING_GU_V1_EXPERIMENT_2_PROVIDER_FAILED');
  wrapped.code = 'RECRUITING_GU_V1_EXPERIMENT_2_PROVIDER_FAILED';
  wrapped.sanitizedProviderStatus = Number(error?.status || 0) || null;
  wrapped.sanitizedProviderCode = String(error?.code || error?.type || '').slice(0, 120) || null;
  return wrapped;
}

export function createRecruitingGuExperiment2OpenAiTransport({
  apiKey,
  modelConfig = RECRUITING_GU_EXPERIMENT_2_MODEL_CONFIG,
  client = null,
} = {}) {
  if (!apiKey && !client) throw new Error('RECRUITING_GU_V1_EXPERIMENT_2_OPENAI_BINDING_REQUIRED');
  const openai = client || new OpenAI({ apiKey, maxRetries: 0, timeout: modelConfig.timeoutMs });
  return async ({ messages, schema, schemaName }) => {
    const startedAt = performance.now();
    let response;
    try {
      response = await openai.responses.create({
        model: modelConfig.model,
        store: false,
        background: false,
        reasoning: { effort: modelConfig.reasoningEffort },
        max_output_tokens: modelConfig.maxOutputTokens,
        input: messages.map((message) => ({ role: message.role, content: message.content })),
        text: { format: { type: 'json_schema', name: schemaName, strict: true, schema } },
      }, { signal: AbortSignal.timeout(modelConfig.timeoutMs) });
    } catch (error) {
      throw providerError(error);
    }
    if (response.status !== 'completed') {
      const error = new Error('RECRUITING_GU_V1_EXPERIMENT_2_PROVIDER_INCOMPLETE');
      error.code = 'RECRUITING_GU_V1_EXPERIMENT_2_PROVIDER_INCOMPLETE';
      error.sanitizedProviderStatus = response.status || null;
      error.sanitizedProviderCode = response.incomplete_details?.reason || null;
      throw error;
    }
    const content = outputText(response);
    if (!content) throw new Error('RECRUITING_GU_V1_EXPERIMENT_2_PROVIDER_EMPTY');
    let parsed;
    try { parsed = JSON.parse(content); } catch { throw new Error('RECRUITING_GU_V1_EXPERIMENT_2_PROVIDER_NON_JSON'); }
    return Object.freeze({
      parsed,
      receipt: Object.freeze({
        gateway: modelConfig.gateway,
        requestedProvider: modelConfig.requestedProvider,
        modelRequested: modelConfig.model,
        modelReturned: response.model || null,
        providerReturned: 'OpenAI',
        requestIdHashOnly: response.id ? `${String(response.id).slice(0, 8)}…` : null,
        finishReason: response.status,
        usage: response.usage ? Object.freeze({
          input_tokens: response.usage.input_tokens || 0,
          cached_input_tokens: response.usage.input_tokens_details?.cached_tokens || 0,
          output_tokens: response.usage.output_tokens || 0,
        }) : null,
        latencyMs: Math.round(performance.now() - startedAt),
        store: false,
      }),
    });
  };
}
