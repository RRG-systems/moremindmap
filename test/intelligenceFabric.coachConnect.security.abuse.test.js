import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateAbuseControls,
  InMemorySecurityStateStore,
  validateSecurityStateStore,
} from '../src/lib/intelligenceFabric/coachConnect/security/index.js';

const dimensions = { subject: 'subject_hash', browser: 'browser_hash', trusted_network: 'network_hash' };

test('unlock limiter allows exact boundary then throttles with cooldown', () => {
  const store = new InMemorySecurityStateStore();
  for (let index = 0; index < 5; index += 1) {
    assert.equal(evaluateAbuseControls({ store, dimensions, now: 1000 }).allowed, true);
  }
  const denied = evaluateAbuseControls({ store, dimensions, now: 1000 });
  assert.equal(denied.code, 'RATE_LIMITED');
  assert.equal(denied.retry_after_ms, 60_000);
  assert.equal(evaluateAbuseControls({ store, dimensions, now: 60_999 }).allowed, false);
  assert.equal(evaluateAbuseControls({ store, dimensions, now: 61_001 }).allowed, true);
});

test('limiter dimensions are hashed and raw identifiers do not enter state', () => {
  const store = new InMemorySecurityStateStore();
  evaluateAbuseControls({ store, dimensions, now: 1000 });
  const snapshot = JSON.stringify(store.snapshot());
  assert.doesNotMatch(snapshot, /subject_hash|browser_hash|network_hash/);
});

test('in-memory store can restore synthetic state but is never deployment grade', () => {
  const first = new InMemorySecurityStateStore();
  for (let index = 0; index < 6; index += 1) evaluateAbuseControls({ store: first, dimensions, now: 1000 });
  const second = new InMemorySecurityStateStore(first.snapshot());
  assert.equal(evaluateAbuseControls({ store: second, dimensions, now: 2000 }).code, 'RATE_LIMITED');
  assert.deepEqual(second.describe(), {
    store_class: 'SYNTHETIC_IN_MEMORY',
    deployment_grade: false,
    shared_across_instances: false,
    restart_durable_from_snapshot_only: true,
    available: true,
  });
  assert.equal(validateSecurityStateStore(second).valid, true);
});

test('security state outage fails protected abuse control closed', () => {
  const store = new InMemorySecurityStateStore(null, { available: false });
  assert.equal(evaluateAbuseControls({ store, dimensions, now: 1000 }).code, 'RATE_LIMITED');
});
