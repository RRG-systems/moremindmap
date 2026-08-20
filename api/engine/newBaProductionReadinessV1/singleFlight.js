import process from 'node:process';

export function createMemorySingleFlight() {
  const inflight = new Map();
  return Object.freeze({
    run(key, task) {
      if (inflight.has(key)) return inflight.get(key);
      const promise = Promise.resolve().then(task).finally(() => inflight.delete(key));
      inflight.set(key, promise);
      return promise;
    },
    activeCount: () => inflight.size,
  });
}

export function createRedisSingleFlight({ redis, namespace, leaseMs = 850_000, pollIntervalMs = 250, waitTimeoutMs = 850_000 } = {}) {
  if (typeof redis?.set !== 'function' || typeof redis?.del !== 'function') throw new Error('new_ba_single_flight_redis_invalid');
  const local = createMemorySingleFlight();
  return Object.freeze({
    run(key, task, { awaitExisting = async () => null } = {}) {
      return local.run(key, async () => {
        const lockKey = `${namespace}:single-flight:${key}`;
        const owner = `${process.pid}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
        const acquired = await redis.set(lockKey, owner, 'PX', leaseMs, 'NX');
        if (acquired === 'OK') {
          try { return await task(); }
          finally {
            const current = await redis.get(lockKey);
            if (current === owner) await redis.del(lockKey);
          }
        }
        const started = Date.now();
        while (Date.now() - started < waitTimeoutMs) {
          const existing = await awaitExisting();
          if (existing) return existing;
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }
        throw new Error('new_ba_single_flight_wait_timeout');
      });
    },
    activeCount: local.activeCount,
  });
}
