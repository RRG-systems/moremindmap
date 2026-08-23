/* global Buffer, process */

import crypto from 'node:crypto';
import Redis from 'ioredis';
import { createEmptyRecruitingState, normalizeRecruitingState } from '../../../src/lib/recruitingV1/store.js';

const LOCK_TTL_MS = 20_000;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let sharedRedis;

export function normalizeRecruitingNamespace(value) {
  const namespace = String(value || '').trim().toLowerCase();
  if (!/^(preview|production|nonprod):recruiting-v1:[a-z0-9][a-z0-9_-]{2,80}$/u.test(namespace)) {
    throw new Error('RECRUITING_V1_NAMESPACE_INVALID');
  }
  return namespace;
}

export function recruitingRedisKeys(namespace) {
  const normalized = normalizeRecruitingNamespace(namespace);
  return Object.freeze({
    state: `more:${normalized}:state:v1`,
    lock: `more:${normalized}:lock:v1`,
  });
}

export function getRecruitingRedis(env = process.env) {
  if (!env.REDIS_URL) throw new Error('RECRUITING_V1_REDIS_BINDING_REQUIRED');
  if (!sharedRedis) {
    sharedRedis = new Redis(env.REDIS_URL, {
      connectTimeout: 10_000,
      commandTimeout: 15_000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      tls: env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
    });
  }
  return sharedRedis;
}

async function acquire(redis, lockKey) {
  const owner = crypto.randomBytes(24).toString('base64url');
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (await redis.set(lockKey, owner, 'PX', LOCK_TTL_MS, 'NX')) return owner;
    await wait(20 * (attempt + 1));
  }
  throw new Error('RECRUITING_V1_STATE_LOCK_BUSY');
}

async function release(redis, lockKey, owner) {
  await redis.eval("if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end", 1, lockKey, owner);
}

export class RedisRecruitingStore {
  constructor(redis = getRecruitingRedis(), { namespace = process.env.RECRUITING_V1_NAMESPACE } = {}) {
    this.redis = redis;
    this.keys = recruitingRedisKeys(namespace);
  }

  async read() {
    const raw = await this.redis.get(this.keys.state);
    if (!raw) return createEmptyRecruitingState();
    try { return normalizeRecruitingState(JSON.parse(raw)); } catch { throw new Error('RECRUITING_V1_DURABLE_STATE_CORRUPT'); }
  }

  async transaction(operation) {
    const owner = await acquire(this.redis, this.keys.lock);
    try {
      const state = await this.read();
      const value = await operation(state);
      const serialized = JSON.stringify(state);
      if (Buffer.byteLength(serialized) > 6 * 1024 * 1024) throw new Error('RECRUITING_V1_DURABLE_STATE_TOO_LARGE');
      const committed = await this.redis.eval(
        "if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end redis.call('SET',KEYS[2],ARGV[2]); return 1",
        2, this.keys.lock, this.keys.state, owner, serialized,
      );
      if (committed !== 1) throw new Error('RECRUITING_V1_STATE_LOCK_LOST');
      return value;
    } finally {
      await release(this.redis, this.keys.lock, owner);
    }
  }
}
