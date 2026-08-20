import {
  BOS_CUSTOMER_INTELLIGENCE_CACHE_TTL_HOURS,
  BOS_CUSTOMER_INTELLIGENCE_CACHE_VERSION,
  BOS_CUSTOMER_INTELLIGENCE_MODEL,
  BOS_CUSTOMER_INTELLIGENCE_PROMPT_VERSION,
  BOS_CUSTOMER_INTELLIGENCE_VALIDATOR_VERSION,
  BOS_CUSTOMER_INTELLIGENCE_VERSION,
} from './contracts.js';
import { stableStringify } from './semanticPacket.js';
import { validateLayer3TranslationBundle } from './translationValidator.js';

const CACHE_PREFIX = 'bos:l3:';
const memoryCache = new Map();

export function buildLayer3CacheIdentity(packet, {
  modelVersion = BOS_CUSTOMER_INTELLIGENCE_MODEL,
  promptVersion = BOS_CUSTOMER_INTELLIGENCE_PROMPT_VERSION,
  validatorVersion = BOS_CUSTOMER_INTELLIGENCE_VALIDATOR_VERSION,
} = {}) {
  return Object.freeze({
    cache_version: BOS_CUSTOMER_INTELLIGENCE_CACHE_VERSION,
    layer2_version: packet?.layer2_version || '',
    semantic_hash: packet?.semantic_hash || '',
    surface_manifest_hash: packet?.surface_manifest_hash || '',
    model_version: modelVersion,
    prompt_version: promptVersion,
    validator_version: validatorVersion,
    output_variant: packet?.output_variant || '',
    layer3_translation_version: packet?.version || '',
    translation_variant: packet?.translation_variant || '',
  });
}

export function layer3CacheKey(packet, options = {}) {
  const identity = buildLayer3CacheIdentity(packet, options);
  return `${CACHE_PREFIX}${[
    identity.layer2_version,
    identity.semantic_hash,
    identity.surface_manifest_hash,
    identity.model_version,
    identity.prompt_version,
    identity.validator_version,
    identity.output_variant,
    identity.layer3_translation_version,
    identity.translation_variant,
  ].join(':')}`;
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
  disabled = false,
  ...identityOptions
} = {}) {
  if (disabled) return null;
  const identity = buildLayer3CacheIdentity(packet, identityOptions);
  const key = layer3CacheKey(packet, identityOptions);
  const entry = readEntry(key, storage);
  if (!entry) return null;
  const age = now - Date.parse(entry.cached_at || '');
  const maximumAge = BOS_CUSTOMER_INTELLIGENCE_CACHE_TTL_HOURS * 60 * 60 * 1000;
  const valid = entry.version === BOS_CUSTOMER_INTELLIGENCE_VERSION
    && stableStringify(entry.identity) === stableStringify(identity)
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
  disabled = false,
  ...identityOptions
} = {}) {
  if (disabled) return false;
  if (!validateLayer3TranslationBundle(packet, bundle).valid) return false;
  const identity = buildLayer3CacheIdentity(packet, identityOptions);
  const key = layer3CacheKey(packet, identityOptions);
  const entry = {
    version: BOS_CUSTOMER_INTELLIGENCE_VERSION,
    identity,
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
  removeEntry(layer3CacheKey(packet), storage);
}

export { CACHE_PREFIX as LAYER3_CACHE_PREFIX };
