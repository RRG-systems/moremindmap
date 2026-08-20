import assert from 'node:assert/strict';
import test from 'node:test';

import { createRedisNewBosBackgroundResponseStore } from '../api/engine/newBosProductionReadinessV1/backgroundResponseStore.js';

const IDENTITY = 'a'.repeat(64);
const REQUEST = 'b'.repeat(64);

function redisFixture() {
  const values = new Map();
  return {
    values,
    async get(key) { return values.get(key) || null; },
    async set(key, value) { values.set(key, value); return 'OK'; },
  };
}

test('background response checkpoint persists only opaque transport identity and resumes by exact realization hash', async () => {
  const redis = redisFixture();
  const store = createRedisNewBosBackgroundResponseStore({ redis, namespace: 'nonprod:new-bos:production-canary:v1' });
  const saved = await store.save({
    realizationIdentitySha256: IDENTITY,
    event: {
      provider_response_id: 'resp_opaque_123',
      scientific_request_sha256: REQUEST,
      status: 'in_progress',
      poll_count: 2,
      observed_at: '2026-08-18T00:00:00.000Z',
    },
  });
  assert.equal(saved.provider_response_id, 'resp_opaque_123');
  assert.deepEqual(await store.load({ realizationIdentitySha256: IDENTITY }), saved);
  const serialized = [...redis.values.values()][0];
  assert.doesNotMatch(serialized, /profile|answer|prompt|request_body|response_body/iu);
});

test('background response checkpoint rejects cross-request or cross-response replacement', async () => {
  const store = createRedisNewBosBackgroundResponseStore({ redis: redisFixture(), namespace: 'nonprod:new-bos:production-canary:v1' });
  await store.save({ realizationIdentitySha256: IDENTITY, event: { provider_response_id: 'resp_1', scientific_request_sha256: REQUEST } });
  await assert.rejects(
    store.save({ realizationIdentitySha256: IDENTITY, event: { provider_response_id: 'resp_2', scientific_request_sha256: REQUEST } }),
    /checkpoint_conflict/u,
  );
  await assert.rejects(
    store.save({ realizationIdentitySha256: IDENTITY, event: { provider_response_id: 'resp_1', scientific_request_sha256: 'c'.repeat(64) } }),
    /checkpoint_conflict/u,
  );
});

test('invalid namespace and identity fail closed before Redis access', () => {
  const redis = redisFixture();
  const store = createRedisNewBosBackgroundResponseStore({ redis, namespace: 'production:new-bos:unsafe' });
  assert.rejects(store.load({ realizationIdentitySha256: IDENTITY }), /namespace_invalid/u);
  const valid = createRedisNewBosBackgroundResponseStore({ redis, namespace: 'nonprod:new-bos:test' });
  assert.rejects(valid.load({ realizationIdentitySha256: 'bad' }), /identity_invalid/u);
});
