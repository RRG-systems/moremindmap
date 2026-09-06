/* global process */
import Redis from 'ioredis';

export class RedisPublicStore {
  constructor(redis) { this.redis = redis; }
  async get(key) { return this.redis.get(key); }
  async set(key, value) { return this.redis.set(key, value); }
  async setNx(key, value, ttlSeconds = 30) {
    return (await this.redis.set(key, value, 'EX', ttlSeconds, 'NX')) === 'OK';
  }
  async del(key) { return this.redis.del(key); }
  async sadd(key, value) { return this.redis.sadd(key, value); }
  async smembers(key) { return this.redis.smembers(key); }
  async incr(key) { return this.redis.incr(key); }
  async expire(key, seconds) { return this.redis.expire(key, seconds); }
  async close() { return this.redis.quit(); }
}

export function createRedisPublicStore(env = process.env) {
  if (!env.REDIS_URL) throw new Error('redis_configuration_unavailable');
  return new RedisPublicStore(new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: false,
  }));
}
