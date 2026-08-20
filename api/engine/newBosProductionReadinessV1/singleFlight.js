import crypto from 'node:crypto';

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function createLocalSingleFlightCoordinator() {
  const inFlight = new Map();
  return Object.freeze({
    async run(key, task) {
      if (inFlight.has(key)) return inFlight.get(key);
      const promise = Promise.resolve().then(task).finally(() => inFlight.delete(key));
      inFlight.set(key, promise);
      return promise;
    },
    activeCount() {
      return inFlight.size;
    },
  });
}

const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

export function createRedisSingleFlightCoordinator({
  redis,
  namespace,
  lockTtlMs = 1_800_000,
  waitTimeoutMs = 1_850_000,
  pollIntervalMs = 250,
  sleep = wait,
} = {}) {
  if (typeof redis?.set !== 'function' || typeof redis?.eval !== 'function') throw new Error('new_bos_single_flight_redis_contract_invalid');
  if (!String(namespace || '').startsWith('preview:new-bos:') && !String(namespace || '').startsWith('nonprod:new-bos:')) {
    throw new Error('new_bos_single_flight_namespace_invalid');
  }
  const local = createLocalSingleFlightCoordinator();

  return Object.freeze({
    async run(key, task, { awaitExisting = async () => null } = {}) {
      return local.run(key, async () => {
        const lockKey = `${namespace}:single-flight:${key}`;
        const token = crypto.randomUUID();
        const acquired = await redis.set(lockKey, token, 'PX', lockTtlMs, 'NX');
        if (acquired === 'OK') {
          try {
            return await task();
          } finally {
            await redis.eval(RELEASE_SCRIPT, 1, lockKey, token);
          }
        }

        const startedAt = Date.now();
        while (Date.now() - startedAt < waitTimeoutMs) {
          const existing = await awaitExisting();
          if (existing) return existing;
          await sleep(pollIntervalMs);
        }
        throw new Error('new_bos_single_flight_wait_timeout');
      });
    },
    activeCount: local.activeCount,
  });
}
