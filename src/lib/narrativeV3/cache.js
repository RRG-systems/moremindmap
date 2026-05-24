/**
 * cache.js
 * 
 * Cache layer for V3 narrative outputs.
 * Prevents regeneration on refresh.
 * 
 * Current implementation: In-memory cache (browser) + localStorage fallback
 * Production: Redis recommended, but this works for MVP.
 */

// In-memory cache
const memoryCache = new Map();

// Version tracking: invalidate old cache when schema changes
const CACHE_VERSION = 2;  // Bumped to 2 when coachingLeverage/recommendedNextStep added

/**
 * Generate cache key from profile ID.
 * Format: v3_narrative_PROFILEID
 */
function getCacheKey(profileId) {
  return `v3_narrative_${profileId}`;
}

/**
 * Get cached narrative from memory or localStorage.
 */
export function getCachedNarrative(profileId) {
  if (!profileId) return null;

  const cacheKey = getCacheKey(profileId);

  // Check memory first (fastest)
  if (memoryCache.has(cacheKey)) {
    console.log(`[V3 CACHE HIT] Memory: ${profileId}`);
    return memoryCache.get(cacheKey);
  }

  // Check localStorage (browser persistence)
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        const wrapped = JSON.parse(stored);
        
        // Check cache version to invalidate old schemas
        if (wrapped.cacheVersion && wrapped.cacheVersion !== CACHE_VERSION) {
          console.log(`[V3 CACHE INVALIDATED] ${profileId} - version mismatch (${wrapped.cacheVersion} vs ${CACHE_VERSION})`);
          localStorage.removeItem(cacheKey);
          return null;
        }
        
        // Unwrap if stored with metadata (old format had: { data: {...}, cachedAt, ttlHours })
        const cached = wrapped.data || wrapped;
        
        // Validate that cached narrative has all required sections
        const requiredSections = ['coachingLeverage', 'recommendedNextStep'];
        const missingSection = requiredSections.find(s => !(s in cached));
        if (missingSection) {
          console.log(`[V3 CACHE INVALIDATED] ${profileId} - missing section: ${missingSection}`);
          localStorage.removeItem(cacheKey);
          return null;
        }
        
        memoryCache.set(cacheKey, cached); // Reload into memory
        console.log(`[V3 CACHE HIT] Storage: ${profileId}`);
        return cached;
      }
    } catch (e) {
      console.warn(`[V3 CACHE] Storage read failed:`, e);
    }
  }

  console.log(`[V3 CACHE MISS] ${profileId}`);
  return null;
}

/**
 * Store narrative in cache (memory + localStorage).
 */
export function cacheNarrative(profileId, narrativeObj) {
  if (!profileId || !narrativeObj) return;

  const cacheKey = getCacheKey(profileId);

  // Store in memory
  memoryCache.set(cacheKey, narrativeObj);

  // Store in localStorage (with version + TTL metadata)
  if (typeof localStorage !== 'undefined') {
    try {
      const cacheEntry = {
        data: narrativeObj,
        cacheVersion: CACHE_VERSION,
        cachedAt: new Date().toISOString(),
        ttlHours: 24,
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
      console.log(`[V3 CACHE STORED] ${profileId}`);
    } catch (e) {
      console.warn(`[V3 CACHE] Storage write failed:`, e);
    }
  }
}

/**
 * Clear cache for a profile (force refresh).
 */
export function clearCache(profileId) {
  if (profileId) {
    const cacheKey = getCacheKey(profileId);
    memoryCache.delete(cacheKey);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(cacheKey);
    }
    console.log(`[V3 CACHE CLEARED] ${profileId}`);
  } else {
    // Clear all
    memoryCache.clear();
    if (typeof localStorage !== 'undefined') {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith('v3_narrative_')) {
          localStorage.removeItem(key);
        }
      });
    }
    console.log(`[V3 CACHE CLEARED ALL]`);
  }
}

export default {
  getCachedNarrative,
  cacheNarrative,
  clearCache,
};
