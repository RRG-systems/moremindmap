import {
  BOS_CUSTOMER_INTELLIGENCE_MAX_OUTPUT_CHARACTERS,
  BOS_CUSTOMER_INTELLIGENCE_MODEL,
  BOS_CUSTOMER_INTELLIGENCE_TIMEOUT_MS,
} from './contracts.js';
import { buildLayer3TranslationRequest } from './modelContract.js';
import {
  cacheLayer3Translation,
  getCachedLayer3Translation,
} from './translationCache.js';
import {
  validateLayer3SemanticPacket,
  validateLayer3TranslationBundle,
} from './translationValidator.js';

function receipt({
  source,
  packet,
  reason = null,
  model = null,
  latencyMs = 0,
  usage = null,
}) {
  return Object.freeze({
    source,
    source_hash: packet.semantic_hash,
    model,
    translation_only: true,
    semantics_modified: false,
    reason,
    latency_ms: Math.max(0, Math.round(latencyMs)),
    usage: usage ? Object.freeze({ ...usage }) : null,
    estimated_cost_usd: null,
    cost_basis: 'not_configured',
  });
}

function parseTransportOutput(value) {
  if (typeof value === 'string') {
    if (value.length > BOS_CUSTOMER_INTELLIGENCE_MAX_OUTPUT_CHARACTERS) {
      throw new Error('layer3_model_output_too_large');
    }
    return JSON.parse(value);
  }
  if (typeof value?.output_text === 'string') {
    if (value.output_text.length > BOS_CUSTOMER_INTELLIGENCE_MAX_OUTPUT_CHARACTERS) {
      throw new Error('layer3_model_output_too_large');
    }
    return JSON.parse(value.output_text);
  }
  if (value?.version && Array.isArray(value?.translations)) {
    if (JSON.stringify(value).length > BOS_CUSTOMER_INTELLIGENCE_MAX_OUTPUT_CHARACTERS) {
      throw new Error('layer3_model_output_too_large');
    }
    return value;
  }
  throw new Error('layer3_empty_or_invalid_model_output');
}

function normalizeUsage(output) {
  const usage = output?.usage;
  if (!usage || typeof usage !== 'object') return null;
  return {
    input_tokens: Number.isFinite(Number(usage.input_tokens)) ? Number(usage.input_tokens) : null,
    output_tokens: Number.isFinite(Number(usage.output_tokens)) ? Number(usage.output_tokens) : null,
    total_tokens: Number.isFinite(Number(usage.total_tokens)) ? Number(usage.total_tokens) : null,
  };
}

function safeFailureReason(error) {
  const message = String(error?.message || '');
  return /^layer3_[a-z0-9_]+$/.test(message) ? message : 'translation_failed';
}

async function callWithTimeout(transport, request, timeoutMs) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      transport(request, { signal: controller.signal }),
      new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('layer3_translation_timeout'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function translateLayer3SemanticPacket({
  packet,
  enabled = false,
  transport = null,
  timeoutMs = BOS_CUSTOMER_INTELLIGENCE_TIMEOUT_MS,
  cacheOptions = {},
} = {}) {
  const startedAt = Date.now();
  const packetValidation = validateLayer3SemanticPacket(packet);
  if (!packetValidation.valid) {
    const error = new Error('layer3_semantic_packet_rejected');
    error.failures = packetValidation.failures;
    throw error;
  }

  const cached = getCachedLayer3Translation(packet, cacheOptions);
  if (cached) {
    return {
      bundle: cached,
      receipt: receipt({ source: 'cache', packet, latencyMs: Date.now() - startedAt }),
    };
  }

  if (!enabled) {
    return {
      bundle: null,
      receipt: receipt({
        source: 'layer2_fallback',
        packet,
        reason: 'feature_disabled',
        latencyMs: Date.now() - startedAt,
      }),
    };
  }
  if (typeof transport !== 'function') {
    return {
      bundle: null,
      receipt: receipt({
        source: 'layer2_fallback',
        packet,
        reason: 'transport_unavailable',
        latencyMs: Date.now() - startedAt,
      }),
    };
  }

  try {
    const output = await callWithTimeout(
      transport,
      buildLayer3TranslationRequest(packet),
      Math.max(1, Number(timeoutMs) || BOS_CUSTOMER_INTELLIGENCE_TIMEOUT_MS),
    );
    const bundle = parseTransportOutput(output);
    const validation = validateLayer3TranslationBundle(packet, bundle);
    if (!validation.valid) {
      const error = new Error('layer3_model_translation_rejected');
      error.failures = validation.failures;
      throw error;
    }
    cacheLayer3Translation(packet, bundle, cacheOptions);
    return {
      bundle,
      receipt: receipt({
        source: 'gpt_translation',
        packet,
        model: BOS_CUSTOMER_INTELLIGENCE_MODEL,
        latencyMs: Date.now() - startedAt,
        usage: normalizeUsage(output),
      }),
    };
  } catch (error) {
    return {
      bundle: null,
      receipt: receipt({
        source: 'layer2_fallback',
        packet,
        reason: safeFailureReason(error),
        latencyMs: Date.now() - startedAt,
      }),
    };
  }
}

export { parseTransportOutput };
