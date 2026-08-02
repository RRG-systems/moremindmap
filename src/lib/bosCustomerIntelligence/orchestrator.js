import {
  BOS_CUSTOMER_INTELLIGENCE_MODEL,
  BOS_CUSTOMER_INTELLIGENCE_TIMEOUT_MS,
} from './contracts.js';
import { buildDeterministicLayer3Translation } from './deterministicFallback.js';
import { buildLayer3TranslationRequest } from './modelContract.js';
import {
  cacheLayer3Translation,
  getCachedLayer3Translation,
} from './translationCache.js';
import {
  validateLayer3SemanticPacket,
  validateLayer3TranslationBundle,
} from './translationValidator.js';

function receipt({ source, packet, reason = null, model = null }) {
  return Object.freeze({
    source,
    source_hash: packet.semantic_hash,
    model,
    translation_only: true,
    semantics_modified: false,
    reason,
  });
}

function parseTransportOutput(value) {
  if (typeof value === 'string') return JSON.parse(value);
  if (typeof value?.output_text === 'string') return JSON.parse(value.output_text);
  if (value?.version && Array.isArray(value?.translations)) return value;
  throw new Error('layer3_empty_or_invalid_model_output');
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
      receipt: receipt({ source: 'cache', packet }),
    };
  }

  const fallback = buildDeterministicLayer3Translation(packet);
  if (!enabled) {
    return {
      bundle: fallback,
      receipt: receipt({ source: 'deterministic_fallback', packet, reason: 'feature_disabled' }),
    };
  }
  if (typeof transport !== 'function') {
    return {
      bundle: fallback,
      receipt: receipt({ source: 'deterministic_fallback', packet, reason: 'transport_unavailable' }),
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
      receipt: receipt({ source: 'gpt_translation', packet, model: BOS_CUSTOMER_INTELLIGENCE_MODEL }),
    };
  } catch (error) {
    return {
      bundle: fallback,
      receipt: receipt({
        source: 'deterministic_fallback',
        packet,
        reason: safeFailureReason(error),
      }),
    };
  }
}

export { parseTransportOutput };
