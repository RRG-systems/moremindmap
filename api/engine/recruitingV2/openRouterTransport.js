import { FRONTIER_MODEL_CONFIG } from '../../../src/lib/recruitingV2/frontierContract.js';

function providerError(payload, status) {
  const error = new Error('RECRUITING_V2_FRONTIER_PROVIDER_FAILED');
  error.code = 'RECRUITING_V2_FRONTIER_PROVIDER_FAILED';
  error.sanitizedProviderStatus = status;
  error.sanitizedProviderCode = payload?.error?.code || null;
  return error;
}

export function createRecruitingV2OpenRouterTransport({ apiKey, modelConfig = FRONTIER_MODEL_CONFIG, fetchImpl = globalThis.fetch } = {}) {
  if (!apiKey) throw Object.assign(new Error('RECRUITING_V2_FRONTIER_PROVIDER_BINDING_REQUIRED'), { code: 'RECRUITING_V2_FRONTIER_PROVIDER_BINDING_REQUIRED' });
  if (typeof fetchImpl !== 'function') throw new TypeError('RECRUITING_V2_FRONTIER_FETCH_REQUIRED');
  return async ({ messages, schema, schemaName }) => {
    const startedAt = performance.now();
    const response = await fetchImpl('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json',
        'HTTP-Referer': 'http://127.0.0.1:5196', 'X-Title': 'MORE Generative Recruiting V2 Experiment 003A',
      },
      body: JSON.stringify({
        model: modelConfig.model, messages,
        response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } },
        reasoning: { effort: modelConfig.reasoningEffort }, max_tokens: modelConfig.maxOutputTokens,
        provider: { allow_fallbacks: modelConfig.providerFallbacks, require_parameters: true, order: ['OpenAI'] },
      }),
      signal: AbortSignal.timeout(modelConfig.timeoutMs),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.error) throw providerError(payload, response.status);
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw Object.assign(new Error('RECRUITING_V2_FRONTIER_EMPTY'), { code: 'RECRUITING_V2_FRONTIER_EMPTY' });
    let parsed;
    try { parsed = JSON.parse(content); } catch { throw Object.assign(new Error('RECRUITING_V2_FRONTIER_NON_JSON'), { code: 'RECRUITING_V2_FRONTIER_NON_JSON' }); }
    return Object.freeze({
      parsed,
      receipt: Object.freeze({
        gateway: modelConfig.gateway, requestedProvider: modelConfig.requestedProvider,
        modelRequested: modelConfig.model, modelReturned: payload.model || null, providerReturned: payload.provider || null,
        requestId: payload.id || null, finishReason: payload?.choices?.[0]?.finish_reason || null,
        usage: payload.usage || null, latencyMs: Math.round(performance.now() - startedAt), store: false,
      }),
    });
  };
}
