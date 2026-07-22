import test from 'node:test';
import assert from 'node:assert/strict';
import { DurableLiveSessionAdapter } from '../src/lib/intelligenceFabric/coachConnect/liveSession/durable/adapter.js';
import { replayAndCheckpoint, recordTeardownFailure } from '../src/lib/intelligenceFabric/coachConnect/liveSession/durable/checkpointReplay.js';
import { InMemoryDurableLiveSessionDriver } from '../src/lib/intelligenceFabric/testing/inMemoryDurableLiveSessionDriver.js';

const scope = { tenant_id: 'tenant_synthetic', profile_id: 'profile_synthetic', business_id: 'business_synthetic', subscriber_id: 'subscriber_synthetic', session_id: 'session_synthetic' };
const active = { foundation_enabled: true, synthetic_only: true, writes_enabled: true, emergency_disabled: false };
const adapter = () => new DurableLiveSessionAdapter({ driver: new InMemoryDurableLiveSessionDriver(), capability: active, clock: () => '2026-07-22T00:00:00.000Z' });

test('replay becomes ACTIVE only after checkpoint succeeds', async () => {
  const result = await replayAndCheckpoint({ adapter: adapter(), scope, events: [{ aggregate_sequence: 1, envelope_hash: 'h1', event: { delta: 2 } }], reducer: (state, event) => ({ count: state.count + event.delta }), initial_state: { count: 0 } });
  assert.equal(result.ok, true); assert.equal(result.state, 'ACTIVE'); assert.equal(result.checkpoint.state.count, 2);
});

test('sequence and checkpoint failures fail closed and preserve unresolved work', async () => {
  const sequence = await replayAndCheckpoint({ adapter: adapter(), scope, events: [{ aggregate_sequence: 2, event: {} }], reducer: (state) => state, initial_state: {} });
  assert.equal(sequence.state, 'RECOVERY_FAILED'); assert.equal(sequence.unresolved, true);
  const failing = adapter(); failing.driver.writeDurable = async () => ({ ok: false, status: 'UNAVAILABLE' });
  const checkpoint = await replayAndCheckpoint({ adapter: failing, scope, events: [], reducer: (state) => state, initial_state: {} });
  assert.equal(checkpoint.cause_code, 'CHECKPOINT_FAILURE'); assert.equal(checkpoint.state, 'RECOVERY_FAILED');
});

test('provider teardown failure is incomplete and preserves retry work', async () => {
  const result = await recordTeardownFailure({ adapter: adapter(), scope });
  assert.equal(result.ok, false); assert.equal(result.closure_verdict, 'INCOMPLETE'); assert.notEqual(result.state, 'CLOSED');
});
