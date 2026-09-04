import OpenAI from 'openai';
import { hashCanonicalJson } from '../../../src/lib/intelligenceFabric/hashing.js';

const ALLOWED_STAGES = new Set(['CONVERSATION', 'CANDIDATE_EXTRACTION', 'NATURAL_AUTHORIZATION', 'SESSION_CLOSE']);
const PRIVATE_CUSTOMER_PATTERN = /\bMM-\d{8}-[A-Z0-9]{8}\b|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/iu;

function assertRequest(request, stage) {
  if (!ALLOWED_STAGES.has(stage)) throw new TypeError('SUBSCRIPTION_LIVE_DEMO_STAGE_DENIED');
  if (request?.model !== 'gpt-5.6-sol' || request?.store !== false || request?.background !== false) {
    throw new TypeError('SUBSCRIPTION_LIVE_DEMO_PROVIDER_POLICY_DENIED');
  }
  if (PRIVATE_CUSTOMER_PATTERN.test(JSON.stringify(request))) throw new TypeError('SUBSCRIPTION_LIVE_DEMO_REAL_CUSTOMER_DATA_DENIED');
  const tools = Array.isArray(request.tools) ? request.tools : [];
  if (stage === 'CONVERSATION') {
    if (tools.length !== 1 || tools[0]?.type !== 'web_search') throw new TypeError('SUBSCRIPTION_LIVE_DEMO_RESEARCH_TOOL_CONTRACT_INVALID');
  } else if (tools.length !== 0) throw new TypeError('SUBSCRIPTION_LIVE_DEMO_NONCONVERSATION_TOOLS_DENIED');
}

function outputText(response) {
  if (typeof response.output_text === 'string' && response.output_text.trim()) return response.output_text;
  return (response.output || [])
    .filter((item) => item?.type === 'message')
    .flatMap((item) => item.content || [])
    .filter((item) => item?.type === 'output_text')
    .map((item) => item.text)
    .join('');
}

export function parseSubscriptionStructuredOutput(response) {
  const text = outputText(response);
  if (!text) throw new Error('SUBSCRIPTION_LIVE_DEMO_PROVIDER_OUTPUT_MISSING');
  try {
    return JSON.parse(text);
  } catch {
    const error = new Error('SUBSCRIPTION_LIVE_DEMO_STRUCTURED_JSON_INVALID');
    error.code = 'SUBSCRIPTION_LIVE_DEMO_STRUCTURED_JSON_INVALID';
    throw error;
  }
}

function researchTrace(response, retrievedAt) {
  const searches = (response.output || []).filter((item) => item?.type === 'web_search_call');
  const sourceByUrl = new Map();
  for (const search of searches) {
    for (const source of search?.action?.sources || []) {
      const url = String(source?.url || '').trim();
      if (!url.startsWith('https://')) continue;
      sourceByUrl.set(url, { url, title: String(source?.title || source?.name || new URL(url).hostname).slice(0, 240) });
    }
  }
  for (const item of response.output || []) {
    if (item?.type !== 'message') continue;
    for (const content of item.content || []) {
      for (const annotation of content?.annotations || []) {
        if (annotation?.type !== 'url_citation') continue;
        const url = String(annotation.url || '').trim();
        if (!url.startsWith('https://')) continue;
        sourceByUrl.set(url, { url, title: String(annotation.title || new URL(url).hostname).slice(0, 240) });
      }
    }
  }
  const evidence = [...sourceByUrl.values()].slice(0, 12).map((source) => {
    const body = {
      external_evidence_id: `external_${hashCanonicalJson(source).slice(0, 24)}`,
      purpose: 'Current external context selected by frontier reasoning for this coaching turn.',
      status: 'TEMPORARY_CONTEXT',
      source_url: source.url,
      source_title: source.title,
      source_trust: 'PUBLIC_WEB_SOURCE_REQUIRES_CLAIM_LEVEL_JUDGMENT',
      citation: `${source.title} — ${source.url}`,
      retrieved_at: retrievedAt,
      privacy_classification: 'PUBLIC',
      customer_truth_override_allowed: false,
    };
    return { ...body, content_hash: hashCanonicalJson(body) };
  });
  return { calls: searches.length, evidence };
}

export function createSubscriptionLiveDemoOpenAiTransport({ apiKey, timeoutMs = 180000, maxTransportRetries = 1, client: suppliedClient = null }) {
  if (!apiKey) throw new TypeError('SUBSCRIPTION_LIVE_DEMO_OPENAI_API_KEY_REQUIRED');
  const client = suppliedClient || new OpenAI({ apiKey, maxRetries: 0, timeout: timeoutMs });
  return async function subscriptionLiveDemoTransport(request, { stage }) {
    assertRequest(request, stage);
    const started = Date.now();
    let response;
    let output;
    let attemptCount = 0;
    let lastError;
    while (attemptCount <= maxTransportRetries) {
      attemptCount += 1;
      try {
        response = await client.responses.create(request, { signal: AbortSignal.timeout(timeoutMs) });
        if (response.status === 'completed') {
          try {
            output = parseSubscriptionStructuredOutput(response);
          } catch (error) {
            lastError = error;
            if (error?.code === 'SUBSCRIPTION_LIVE_DEMO_STRUCTURED_JSON_INVALID' && attemptCount <= maxTransportRetries) {
              response = undefined;
              continue;
            }
            throw error;
          }
        }
        break;
      } catch (error) {
        lastError = error;
        const retryable = error?.status === 408 || error?.status === 409 || error?.status === 429 || Number(error?.status) >= 500 || ['ETIMEDOUT', 'ECONNRESET', 'UND_ERR_CONNECT_TIMEOUT'].includes(error?.code);
        if (!retryable || attemptCount > maxTransportRetries) throw error;
      }
    }
    if (!response) throw lastError || new Error('SUBSCRIPTION_LIVE_DEMO_PROVIDER_RESPONSE_MISSING');
    const completed = Date.now();
    if (response.status !== 'completed') {
      const error = new Error(`SUBSCRIPTION_LIVE_DEMO_PROVIDER_${String(response.status || 'UNKNOWN').toUpperCase()}`);
      error.code = response.incomplete_details?.reason === 'max_output_tokens' ? 'OUTPUT_BUDGET_INCOMPLETE' : 'PROVIDER_INCOMPLETE';
      error.sanitized_stage = stage;
      error.sanitized_provider_status = response.status || null;
      error.sanitized_incomplete_reason = response.incomplete_details?.reason || null;
      error.sanitized_output_tokens = Number(response.usage?.output_tokens || 0);
      error.sanitized_max_output_tokens = Number(request.max_output_tokens || 0);
      throw error;
    }
    if (!output) output = parseSubscriptionStructuredOutput(response);
    const research = researchTrace(response, new Date(completed).toISOString());
    return {
      output,
      request_hash: hashCanonicalJson(request),
      response_id_hash: hashCanonicalJson(response.id),
      usage: {
        input_tokens: response.usage?.input_tokens || 0,
        cached_input_tokens: response.usage?.input_tokens_details?.cached_tokens || 0,
        output_tokens: response.usage?.output_tokens || 0,
      },
      latency_ms: completed - started,
      attempt_count: attemptCount,
      estimated_cost_microusd: Math.round(
        Math.max(0, (response.usage?.input_tokens || 0) - (response.usage?.input_tokens_details?.cached_tokens || 0)) * 5
        + (response.usage?.input_tokens_details?.cached_tokens || 0) * 0.5
        + (response.usage?.output_tokens || 0) * 30,
      ),
      web_search_calls: research.calls,
      external_evidence: research.evidence,
      raw_request_persisted: false,
      raw_response_persisted: false,
    };
  };
}
