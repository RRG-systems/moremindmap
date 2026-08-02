import crypto from 'node:crypto';

import {
  BOS_CUSTOMER_INTELLIGENCE_CACHE_TTL_HOURS,
  BOS_CUSTOMER_INTELLIGENCE_RATE_LIMIT,
  BOS_CUSTOMER_INTELLIGENCE_RATE_WINDOW_SECONDS,
  BOS_CUSTOMER_INTELLIGENCE_TIMEOUT_MS,
} from '../../../src/lib/bosCustomerIntelligence/contracts.js';
import {
  buildLayer3CacheIdentity,
  layer3CacheKey,
} from '../../../src/lib/bosCustomerIntelligence/translationCache.js';
import { stableStringify } from '../../../src/lib/bosCustomerIntelligence/semanticPacket.js';
import { validateLayer3TranslationBundle } from '../../../src/lib/bosCustomerIntelligence/translationValidator.js';

const LOCK_TTL_MS = BOS_CUSTOMER_INTELLIGENCE_TIMEOUT_MS + 10000;

function lockKey(packet) {
  return `${layer3CacheKey(packet)}:lock`;
}

export async function readDurableLayer3Translation(redis, packet, {
  now = Date.now(),
} = {}) {
  const key = layer3CacheKey(packet);
  const raw = await redis.get(key);
  if (!raw) return null;

  let entry;
  try {
    entry = JSON.parse(raw);
  } catch {
    await redis.del(key);
    return null;
  }

  const identity = buildLayer3CacheIdentity(packet);
  const age = now - Date.parse(entry.cached_at || '');
  const maximumAge = BOS_CUSTOMER_INTELLIGENCE_CACHE_TTL_HOURS * 60 * 60 * 1000;
  const valid = stableStringify(entry.identity) === stableStringify(identity)
    && entry.source_hash === packet.semantic_hash
    && Number.isFinite(age)
    && age >= 0
    && age <= maximumAge
    && validateLayer3TranslationBundle(packet, entry.bundle).valid;

  if (!valid) {
    await redis.del(key);
    return null;
  }
  return entry.bundle;
}

export async function writeDurableLayer3Translation(redis, packet, bundle, {
  now = Date.now(),
} = {}) {
  if (!validateLayer3TranslationBundle(packet, bundle).valid) return false;
  const entry = {
    identity: buildLayer3CacheIdentity(packet),
    source_hash: packet.semantic_hash,
    cached_at: new Date(now).toISOString(),
    bundle,
  };
  const ttlSeconds = BOS_CUSTOMER_INTELLIGENCE_CACHE_TTL_HOURS * 60 * 60;
  await redis.set(layer3CacheKey(packet), JSON.stringify(entry), 'EX', ttlSeconds);
  return true;
}

export async function acquireLayer3GenerationLock(redis, packet, {
  token = crypto.randomUUID(),
  ttlMs = LOCK_TTL_MS,
} = {}) {
  const acquired = await redis.set(lockKey(packet), token, 'PX', ttlMs, 'NX');
  return acquired === 'OK' ? token : null;
}

export async function releaseLayer3GenerationLock(redis, packet, token) {
  if (!token) return false;
  const result = await redis.eval(
    'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
    1,
    lockKey(packet),
    token,
  );
  return Number(result) === 1;
}

function boundedIdentityHash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 32);
}

export async function checkLayer3RateLimit(redis, {
  profileId,
  clientAddress = 'unknown',
  limit = BOS_CUSTOMER_INTELLIGENCE_RATE_LIMIT,
  windowSeconds = BOS_CUSTOMER_INTELLIGENCE_RATE_WINDOW_SECONDS,
} = {}) {
  const subject = boundedIdentityHash(`${String(profileId || '').toLowerCase()}|${clientAddress}`);
  const key = `bos:l3:rate:${subject}`;
  const count = Number(await redis.incr(key));
  if (count === 1) await redis.expire(key, windowSeconds);
  return Object.freeze({
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    window_seconds: windowSeconds,
  });
}

export const durableCacheInvariants = Object.freeze({
  namespace: 'bos:l3:',
  vault_namespace_used: false,
  identity_fields: Object.freeze(Object.keys(buildLayer3CacheIdentity({}))),
  ttl_hours: BOS_CUSTOMER_INTELLIGENCE_CACHE_TTL_HOURS,
  lock_ttl_ms: LOCK_TTL_MS,
});
