import {
  BOS_CUSTOMER_INTELLIGENCE_MAX_CONCURRENT_CALLS,
  BOS_CUSTOMER_INTELLIGENCE_MODEL,
} from '../../../src/lib/bosCustomerIntelligence/contracts.js';
import { translateLayer3SemanticPacket } from '../../../src/lib/bosCustomerIntelligence/orchestrator.js';
import { buildLayer3CacheIdentity } from '../../../src/lib/bosCustomerIntelligence/translationCache.js';
import {
  acquireLayer3GenerationLock,
  readDurableLayer3Translation,
  releaseLayer3GenerationLock,
  writeDurableLayer3Translation,
} from './redisTranslationStore.js';

let activeModelCalls = 0;

function layer2Fallback(packet, reason, startedAt = Date.now()) {
  return {
    bundle: null,
    receipt: Object.freeze({
      source: 'layer2_fallback',
      source_hash: packet.semantic_hash,
      model: null,
      translation_only: true,
      semantics_modified: false,
      reason,
      latency_ms: Math.max(0, Date.now() - startedAt),
      usage: null,
      estimated_cost_usd: null,
      cost_basis: 'not_configured',
      cache_identity: buildLayer3CacheIdentity(packet),
    }),
  };
}

function cacheResult(packet, bundle, startedAt) {
  return {
    bundle,
    receipt: Object.freeze({
      source: 'cache',
      source_hash: packet.semantic_hash,
      model: BOS_CUSTOMER_INTELLIGENCE_MODEL,
      translation_only: true,
      semantics_modified: false,
      reason: null,
      latency_ms: Math.max(0, Date.now() - startedAt),
      usage: null,
      estimated_cost_usd: 0,
      cost_basis: 'durable_cache_hit',
      cache_identity: buildLayer3CacheIdentity(packet),
    }),
  };
}

async function defaultWait(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function getOrGenerateLayer3Translation({
  redis,
  packet,
  transport,
  wait = defaultWait,
  singleFlightWaitMs = 2000,
  pollIntervalMs = 100,
  maxConcurrentCalls = BOS_CUSTOMER_INTELLIGENCE_MAX_CONCURRENT_CALLS,
} = {}) {
  const startedAt = Date.now();
  try {
    const cached = await readDurableLayer3Translation(redis, packet);
    if (cached) return cacheResult(packet, cached, startedAt);
  } catch {
    return layer2Fallback(packet, 'durable_cache_unavailable', startedAt);
  }

  let lockToken;
  try {
    lockToken = await acquireLayer3GenerationLock(redis, packet);
  } catch {
    return layer2Fallback(packet, 'single_flight_unavailable', startedAt);
  }

  if (!lockToken) {
    const deadline = Date.now() + Math.max(0, singleFlightWaitMs);
    while (Date.now() < deadline) {
      await wait(Math.max(1, pollIntervalMs));
      try {
        const cached = await readDurableLayer3Translation(redis, packet);
        if (cached) return cacheResult(packet, cached, startedAt);
      } catch {
        return layer2Fallback(packet, 'durable_cache_unavailable', startedAt);
      }
    }
    return layer2Fallback(packet, 'single_flight_in_progress', startedAt);
  }

  try {
    const cachedAfterLock = await readDurableLayer3Translation(redis, packet);
    if (cachedAfterLock) return cacheResult(packet, cachedAfterLock, startedAt);
    if (activeModelCalls >= maxConcurrentCalls) {
      return layer2Fallback(packet, 'model_concurrency_limit', startedAt);
    }

    activeModelCalls += 1;
    let result;
    try {
      result = await translateLayer3SemanticPacket({
        packet,
        enabled: true,
        transport,
        cacheOptions: { disabled: true },
      });
    } finally {
      activeModelCalls -= 1;
    }

    if (result.receipt.source !== 'gpt_translation' || !result.bundle) return result;
    try {
      await writeDurableLayer3Translation(redis, packet, result.bundle);
    } catch {
      return layer2Fallback(packet, 'durable_cache_write_failed', startedAt);
    }
    return {
      ...result,
      receipt: Object.freeze({
        ...result.receipt,
        cache_identity: buildLayer3CacheIdentity(packet),
      }),
    };
  } catch {
    return layer2Fallback(packet, 'translation_service_failed', startedAt);
  } finally {
    try {
      await releaseLayer3GenerationLock(redis, packet, lockToken);
    } catch {
      // Lock expiry is bounded; release failure never affects the Layer 2 path.
    }
  }
}

export function getActiveLayer3ModelCallCount() {
  return activeModelCalls;
}
