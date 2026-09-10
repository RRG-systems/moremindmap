import test from 'node:test';
import assert from 'node:assert/strict';

import { createRedisSingleFlight } from '../api/engine/newBaProductionReadinessV1/singleFlight.js';

test('New BA Redis single-flight releases only its own lease atomically', async () => {
  const calls = [];
  const redis = {
    async set(key, owner) { calls.push(['set', key]); this.owner = owner; return 'OK'; },
    async eval(script, count, key, owner) {
      calls.push(['eval', count, key, owner === this.owner, /GET/u.test(script), /DEL/u.test(script)]);
      return owner === this.owner ? 1 : 0;
    },
  };
  const singleFlight = createRedisSingleFlight({
    redis,
    namespace: 'preview:new-ba:release5-test',
    leaseMs: 1000,
    waitTimeoutMs: 1000,
  });

  assert.equal(await singleFlight.run('profile', async () => 'complete'), 'complete');
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].slice(0, 3), ['eval', 1, 'preview:new-ba:release5-test:single-flight:profile']);
  assert.deepEqual(calls[1].slice(3), [true, true, true]);
});

test('New BA Redis single-flight requires atomic compare-and-delete support', () => {
  assert.throws(
    () => createRedisSingleFlight({ redis: { set() {} }, namespace: 'preview:new-ba:test' }),
    /new_ba_single_flight_redis_invalid/u,
  );
});

test('New BA stale owner release preserves a successor lease', async () => {
  const redis = {
    currentOwner: null,
    async set(_key, owner) {
      this.currentOwner = owner;
      return 'OK';
    },
    async eval(_script, _count, _key, staleOwner) {
      this.currentOwner = 'successor-owner';
      if (this.currentOwner === staleOwner) {
        this.currentOwner = null;
        return 1;
      }
      return 0;
    },
  };
  const singleFlight = createRedisSingleFlight({
    redis,
    namespace: 'preview:new-ba:release5-successor-test',
    leaseMs: 1000,
    waitTimeoutMs: 1000,
  });

  assert.equal(await singleFlight.run('profile', async () => 'complete'), 'complete');
  assert.equal(redis.currentOwner, 'successor-owner');
});
