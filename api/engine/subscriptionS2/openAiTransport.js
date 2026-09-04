import OpenAI from 'openai';
import { hashCanonicalJson } from '../../../src/lib/intelligenceFabric/hashing.js';

const PRIVATE_CUSTOMER_PATTERN = /\bMM-\d{8}-[A-Z0-9]{8}\b|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/iu;

function outputText(response) {
  if (typeof response.output_text === 'string' && response.output_text.trim()) return response.output_text;
  return (response.output || [])
    .filter((item) => item?.type === 'message')
    .flatMap((item) => item.content || [])
    .filter((item) => item?.type === 'output_text')
    .map((item) => item.text)
    .join('');
}

export function createSubscriptionS2OpenAiTransport({ apiKey, timeoutMs = 300_000, maxTransportRetries = 1, client: suppliedClient = null } = {}) {
  if (!apiKey) throw new TypeError('SUBSCRIPTION_S2_OPENAI_API_KEY_REQUIRED');
  const client = suppliedClient || new OpenAI({ apiKey, maxRetries: 0, timeout: timeoutMs });
  return async function subscriptionS2Transport(request) {
    if (request?.model !== 'gpt-5.6-sol' || request?.store !== false || request?.background !== false || request?.reasoning?.effort !== 'xhigh') {
      throw new TypeError('SUBSCRIPTION_S2_PROVIDER_POLICY_DENIED');
    }
    if ((request.tools || []).length !== 0) throw new TypeError('SUBSCRIPTION_S2_GU_TOOLS_DENIED');
    if (PRIVATE_CUSTOMER_PATTERN.test(JSON.stringify(request))) throw new TypeError('SUBSCRIPTION_S2_REAL_CUSTOMER_DATA_DENIED');
    const started = Date.now();
    let attemptCount = 0;
    let lastError = null;
    while (attemptCount <= maxTransportRetries) {
      attemptCount += 1;
      try {
        const response = await client.responses.create(request, { signal: AbortSignal.timeout(timeoutMs) });
        if (response.status !== 'completed') {
          const error = new Error(`SUBSCRIPTION_S2_PROVIDER_${String(response.status || 'UNKNOWN').toUpperCase()}`);
          error.code = response.incomplete_details?.reason === 'max_output_tokens' ? 'SUBSCRIPTION_S2_OUTPUT_BUDGET_INCOMPLETE' : 'SUBSCRIPTION_S2_PROVIDER_INCOMPLETE';
          error.sanitized_provider_status = response.status || null;
          error.sanitized_incomplete_reason = response.incomplete_details?.reason || null;
          throw error;
        }
        const raw = outputText(response);
        if (!raw) throw new Error('SUBSCRIPTION_S2_PROVIDER_OUTPUT_MISSING');
        let output;
        try { output = JSON.parse(raw); } catch {
          const error = new Error('SUBSCRIPTION_S2_STRUCTURED_JSON_INVALID');
          error.code = 'SUBSCRIPTION_S2_STRUCTURED_JSON_INVALID';
          throw error;
        }
        const completed = Date.now();
        return Object.freeze({
          output,
          receipt: Object.freeze({
            provider: 'OpenAI Responses API',
            model: request.model,
            reasoning_effort: request.reasoning.effort,
            store: request.store,
            background: request.background,
            tools: 0,
            request_hash: hashCanonicalJson(request),
            response_id_hash: hashCanonicalJson(response.id),
            input_tokens: response.usage?.input_tokens || 0,
            cached_input_tokens: response.usage?.input_tokens_details?.cached_tokens || 0,
            output_tokens: response.usage?.output_tokens || 0,
            latency_ms: completed - started,
            attempt_count: attemptCount,
            raw_request_persisted: false,
            raw_response_persisted: false,
          }),
        });
      } catch (error) {
        lastError = error;
        const retryable = error?.status === 408 || error?.status === 409 || error?.status === 429 || Number(error?.status) >= 500
          || ['ETIMEDOUT', 'ECONNRESET', 'UND_ERR_CONNECT_TIMEOUT', 'SUBSCRIPTION_S2_STRUCTURED_JSON_INVALID'].includes(error?.code);
        if (!retryable || attemptCount > maxTransportRetries) throw error;
      }
    }
    throw lastError || new Error('SUBSCRIPTION_S2_PROVIDER_RESPONSE_MISSING');
  };
}
