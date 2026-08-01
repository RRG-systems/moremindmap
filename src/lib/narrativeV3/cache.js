/**
 * cache.js
 *
 * Cache layer for V3 narrative outputs.
 * Prevents regeneration on refresh while enforcing the active Layer 2
 * truthfulness contract.
 */

import { BOS_TRUTHFULNESS_VERSION } from '../bosTruthfulness/evidenceContract.js';

const memoryCache = new Map();

export const NARRATIVE_CACHE_VERSION = 9;
export const NARRATIVE_CACHE_TTL_HOURS = 24;

function isValidCachedSection(section, value) {
  if (section === 'fiveFutures') {
    return Array.isArray(value?.futures) && value.futures.length >= 5;
  }

  if (section === 'facilitatorNotes') {
    return Array.isArray(value?.notes);
  }

  if (section === 'teamExperience') {
    const validSignals = [
      value?.first_impression?.interpretation,
      value?.communication_pattern?.interpretation,
      value?.listening_pattern?.interpretation,
      value?.relational_friction?.interpretation,
      Array.isArray(value?.key_signals),
      value?.causal_interpretation,
    ].filter(Boolean).length;

    return Boolean(value?.summary) && validSignals >= 2;
  }

  if (section === 'recommendedNextStep') {
    if (typeof value === 'string') return value.trim().length > 0;
    return Boolean(value?.futureBottleneck || value?.intervention || value?.body);
  }

  return value != null;
}

function getCacheKey(profileId) {
  return `v3_narrative_${profileId}`;
}

function getBrowserStorage() {
  const storage = globalThis?.localStorage;
  return storage
    && typeof storage.getItem === 'function'
    && typeof storage.setItem === 'function'
    && typeof storage.removeItem === 'function'
    ? storage
    : null;
}

function hasActiveTruthfulnessContract(narrative) {
  return narrative?.truthfulness_version === BOS_TRUTHFULNESS_VERSION
    && narrative?.truthfulness?.version === BOS_TRUTHFULNESS_VERSION
    && narrative?.truthfulness?.authority === 'deterministic_layer_2'
    && Array.isArray(narrative?.truthfulness?.claims)
    && typeof narrative?.truthfulness?.claims_by_id === 'object'
    && typeof narrative?.truthfulness?.section_claim_map === 'object'
    && typeof narrative?.truthfulness?.summary === 'object';
}

function isCacheEntryCurrent(entry, nowMs = Date.now()) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
  if (entry.cacheVersion !== NARRATIVE_CACHE_VERSION) return false;
  if (entry.truthfulnessVersion !== BOS_TRUTHFULNESS_VERSION) return false;

  const cachedAtMs = Date.parse(entry.cachedAt);
  const requestedTtl = Number(entry.ttlHours);
  if (!Number.isFinite(cachedAtMs) || !Number.isFinite(requestedTtl) || requestedTtl <= 0) {
    return false;
  }

  const ttlHours = Math.min(requestedTtl, NARRATIVE_CACHE_TTL_HOURS);
  const ageMs = nowMs - cachedAtMs;
  return ageMs >= 0 && ageMs <= ttlHours * 60 * 60 * 1000;
}

function validateCacheEntry(entry, nowMs = Date.now()) {
  if (!isCacheEntryCurrent(entry, nowMs)) return null;

  const narrative = entry.data;
  if (!hasActiveTruthfulnessContract(narrative)) return null;

  const requiredSections = [
    'profileDNA',
    'communicationStyle',
    'hiddenContradictions',
    'strategicCeiling',
    'coachingLeverage',
    'teamExperience',
    'facilitatorNotes',
    'fiveFutures',
    'recommendedNextStep',
    'executiveSummary',
  ];
  const invalidSection = requiredSections.find((section) =>
    !isValidCachedSection(section, narrative?.[section])
  );

  return invalidSection ? null : narrative;
}

function createCacheEntry(narrativeObj) {
  return {
    data: narrativeObj,
    cacheVersion: NARRATIVE_CACHE_VERSION,
    truthfulnessVersion: BOS_TRUTHFULNESS_VERSION,
    cachedAt: new Date().toISOString(),
    ttlHours: NARRATIVE_CACHE_TTL_HOURS,
  };
}

/**
 * Get a cache entry only when its schema, TTL, required sections, and active
 * truthfulness contract all validate. Legacy entries fail closed.
 */
export function getCachedNarrative(profileId) {
  if (!profileId) return null;

  const cacheKey = getCacheKey(profileId);
  if (memoryCache.has(cacheKey)) {
    const cached = validateCacheEntry(memoryCache.get(cacheKey));
    if (cached) {
      console.log(`[V3 CACHE HIT] Memory: ${profileId}`);
      return cached;
    }
    memoryCache.delete(cacheKey);
    console.log(`[V3 CACHE INVALIDATED] ${profileId} - memory invariant failed`);
  }

  const storage = getBrowserStorage();
  if (storage) {
    try {
      const stored = storage.getItem(cacheKey);
      if (stored) {
        const entry = JSON.parse(stored);
        const cached = validateCacheEntry(entry);
        if (!cached) {
          console.log(`[V3 CACHE INVALIDATED] ${profileId} - storage invariant failed`);
          storage.removeItem(cacheKey);
          return null;
        }

        memoryCache.set(cacheKey, entry);
        console.log(`[V3 CACHE HIT] Storage: ${profileId}`);
        return cached;
      }
    } catch (error) {
      console.warn('[V3 CACHE] Storage read failed:', error);
      try {
        storage.removeItem(cacheKey);
      } catch {
        // Storage is optional; the validated memory cache remains available.
      }
    }
  }

  console.log(`[V3 CACHE MISS] ${profileId}`);
  return null;
}

/**
 * Store only narratives that already satisfy the active Layer 2 contract.
 */
export function cacheNarrative(profileId, narrativeObj) {
  if (!profileId || !hasActiveTruthfulnessContract(narrativeObj)) return false;

  const cacheKey = getCacheKey(profileId);
  const cacheEntry = createCacheEntry(narrativeObj);
  memoryCache.set(cacheKey, cacheEntry);

  const storage = getBrowserStorage();
  if (storage) {
    try {
      storage.setItem(cacheKey, JSON.stringify(cacheEntry));
      console.log(`[V3 CACHE STORED] ${profileId}`);
    } catch (error) {
      console.warn('[V3 CACHE] Storage write failed:', error);
    }
  }

  return true;
}

export function clearCache(profileId) {
  if (profileId) {
    const cacheKey = getCacheKey(profileId);
    memoryCache.delete(cacheKey);
    const storage = getBrowserStorage();
    if (storage) {
      storage.removeItem(cacheKey);
    }
    console.log(`[V3 CACHE CLEARED] ${profileId}`);
    return;
  }

  memoryCache.clear();
  const storage = getBrowserStorage();
  if (storage) {
    const keys = Object.keys(storage);
    keys.forEach((key) => {
      if (key.startsWith('v3_narrative_')) {
        storage.removeItem(key);
      }
    });
  }
  console.log('[V3 CACHE CLEARED ALL]');
}

export const cacheInvariants = Object.freeze({
  cache_version: NARRATIVE_CACHE_VERSION,
  truthfulness_version: BOS_TRUTHFULNESS_VERSION,
  ttl_hours: NARRATIVE_CACHE_TTL_HOURS,
});

export default {
  getCachedNarrative,
  cacheNarrative,
  clearCache,
};
