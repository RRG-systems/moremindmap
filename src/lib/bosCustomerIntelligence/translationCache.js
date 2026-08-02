import {
  BOS_CUSTOMER_INTELLIGENCE_CACHE_TTL_HOURS,
  BOS_CUSTOMER_INTELLIGENCE_VERSION,
} from './contracts.js';
import { validateLayer3TranslationBundle } from './translationValidator.js';

const CACHE_PREFIX = 'bos_customer_intelligence_v1:';
const memoryCache = new Map();

function cacheKey(packet) {
  return `${CACHE_PREFIX}${packet.semantic_hash}`;
}

function availableStorage(storage) {
  return storage
    && typeof storage.getItem === 'function'
    && typeof storage.setItem === 'function'
    && typeof storage.removeItem === 'function';
}

function readEntry(key, storage) {
  if (availableStorage(storage)) {
    try {
      const value = storage.getItem(key);
      if (value) return JSON.parse(value);
    } catch {
      return memoryCache.get(key) || null;
    }
  }
  return memoryCache.get(key) || null;
}

function removeEntry(key, storage) {
  memoryCache.delete(key);
  if (availableStorage(storage)) {
    try {
      storage.removeItem(key);
    } catch {
      // Memory invalidation remains sufficient when browser storage is unavailable.
    }
  }
}

export function getCachedLayer3Translation(packet, {
  storage = globalThis?.localStorage,
  now = Date.now(),
} = {}) {
  const key = cacheKey(packet);
  const entry = readEntry(key, storage);
  if (!entry) return null;
  const age = now - Date.parse(entry.cached_at || '');
  const maximumAge = BOS_CUSTOMER_INTELLIGENCE_CACHE_TTL_HOURS * 60 * 60 * 1000;
  const valid = entry.version === BOS_CUSTOMER_INTELLIGENCE_VERSION
    && entry.source_hash === packet.semantic_hash
    && Number.isFinite(age)
    && age >= 0
    && age <= maximumAge
    && validateLayer3TranslationBundle(packet, entry.bundle).valid;
  if (!valid) {
    removeEntry(key, storage);
    return null;
  }
  return entry.bundle;
}

export function cacheLayer3Translation(packet, bundle, {
  storage = globalThis?.localStorage,
  now = Date.now(),
} = {}) {
  if (!validateLayer3TranslationBundle(packet, bundle).valid) return false;
  const key = cacheKey(packet);
  const entry = {
    version: BOS_CUSTOMER_INTELLIGENCE_VERSION,
    source_hash: packet.semantic_hash,
    cached_at: new Date(now).toISOString(),
    bundle,
  };
  memoryCache.set(key, entry);
  if (availableStorage(storage)) {
    try {
      storage.setItem(key, JSON.stringify(entry));
    } catch {
      // Memory cache remains the bounded fallback.
    }
  }
  return true;
}

export function clearLayer3TranslationCache(packet, storage = globalThis?.localStorage) {
  removeEntry(cacheKey(packet), storage);
}

export { CACHE_PREFIX as LAYER3_CACHE_PREFIX };
