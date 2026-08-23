import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RedisRecruitingStore,
  normalizeRecruitingNamespace,
  recruitingRedisKeys,
} from '../api/engine/recruitingV1/redisStore.js';

class FakeRedis {
  constructor() { this.values = new Map(); }
  async get(key) { return this.values.get(key) ?? null; }
  async set(key, value, ...args) {
    if (args.includes('NX') && this.values.has(key)) return null;
    this.values.set(key, value);
    return 'OK';
  }
  async eval(script, keyCount, ...args) {
    const keys = args.slice(0, keyCount);
    const argv = args.slice(keyCount);
    if (script.includes("redis.call('DEL'")) {
      if (this.values.get(keys[0]) !== argv[0]) return 0;
      this.values.delete(keys[0]);
      return 1;
    }
    if (this.values.get(keys[0]) !== argv[0]) return 0;
    this.values.set(keys[1], argv[1]);
    return 1;
  }
}

test('Recruiting Redis namespaces are explicit, bounded, and isolate Preview from Production', async () => {
  assert.throws(() => normalizeRecruitingNamespace(''), /NAMESPACE_INVALID/);
  assert.throws(() => normalizeRecruitingNamespace('recruiting-v1'), /NAMESPACE_INVALID/);
  const previewKeys = recruitingRedisKeys('preview:recruiting-v1:airlock');
  const productionKeys = recruitingRedisKeys('production:recruiting-v1:prod-v1');
  assert.notEqual(previewKeys.state, productionKeys.state);
  assert.notEqual(previewKeys.lock, productionKeys.lock);

  const redis = new FakeRedis();
  const preview = new RedisRecruitingStore(redis, { namespace: 'preview:recruiting-v1:airlock' });
  const production = new RedisRecruitingStore(redis, { namespace: 'production:recruiting-v1:prod-v1' });
  await preview.transaction((state) => { state.audit.push({ event_id: 'preview-only' }); });
  assert.equal((await preview.read()).audit[0].event_id, 'preview-only');
  assert.equal((await production.read()).audit.length, 0);

  const restartedPreview = new RedisRecruitingStore(redis, { namespace: 'preview:recruiting-v1:airlock' });
  assert.equal((await restartedPreview.read()).audit[0].event_id, 'preview-only');
});
