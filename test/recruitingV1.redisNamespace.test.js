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
    for (let index = 2; index < keys.length; index += 1) {
      if (this.values.get(keys[index]) !== argv[index]) return -1;
    }
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

test('Recruiting Redis guarded transaction CASes exact external strings with the state commit', async () => {
  const redis = new FakeRedis();
  const store = new RedisRecruitingStore(redis, { namespace: 'nonprod:recruiting-v1:ba-source-cas' });
  const pointerKey = 'business_assessment_by_profile:mm-20990101-guard001';
  const assessmentKey = 'business_assessment:ba-20990101-acde0001';
  const pointerRaw = ' BA-20990101-ACDE0001 ';
  const assessmentRaw = '{"assessment_id":"ba-20990101-acde0001","revision":1}\n';
  await redis.set(pointerKey, pointerRaw);
  await redis.set(assessmentKey, assessmentRaw);

  await store.transactionWithExternalStringGuards((state) => {
    state.audit.push({ event_id: 'exact-source-committed' });
  }, { guards: [
    { key: pointerKey, expected: pointerRaw },
    { key: assessmentKey, expected: assessmentRaw },
  ] });
  assert.equal((await store.read()).audit.at(-1).event_id, 'exact-source-committed');

  await assert.rejects(
    store.transactionWithExternalStringGuards((state) => {
      state.audit.push({ event_id: 'stale-source-must-not-commit' });
      redis.values.set(assessmentKey, '{"assessment_id":"ba-20990101-acde0001","revision":2}');
    }, { guards: [
      { key: pointerKey, expected: pointerRaw },
      { key: assessmentKey, expected: assessmentRaw },
    ] }),
    /RECRUITING_CANONICAL_BA_SOURCE_GUARD_CHANGED/u,
  );
  assert.equal((await store.read()).audit.some((event) => event.event_id === 'stale-source-must-not-commit'), false);
});
