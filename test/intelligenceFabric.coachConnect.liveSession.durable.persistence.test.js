import test from 'node:test';
import assert from 'node:assert/strict';
import { DurableLiveSessionAdapter } from '../src/lib/intelligenceFabric/coachConnect/liveSession/durable/adapter.js';
import { InMemoryDurableLiveSessionDriver } from '../src/lib/intelligenceFabric/testing/inMemoryDurableLiveSessionDriver.js';
import { LocalJsonlDurableLiveSessionDriver } from '../src/lib/intelligenceFabric/coachConnect/liveSession/durable/localJsonlDriver.js';
import { DurableBusinessEngineWorkflowStore } from '../src/lib/intelligenceFabric/coachConnect/liveSession/durable/businessEngineStore.js';
import { replayAndCheckpoint } from '../src/lib/intelligenceFabric/coachConnect/liveSession/durable/checkpointReplay.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const scope = { tenant_id: 'tenant_synthetic', profile_id: 'profile_synthetic', business_id: 'business_synthetic', subscriber_id: 'subscriber_synthetic', session_id: 'session_synthetic' };
const active = { foundation_enabled: true, synthetic_only: true, writes_enabled: true, emergency_disabled: false };

test('durable adapter is default-off and enforces optimistic versions and scope isolation', async () => {
  const driver = new InMemoryDurableLiveSessionDriver();
  const inactive = new DurableLiveSessionAdapter({ driver });
  assert.equal((await inactive.write({ kind: 'projection', object_id: 'p', scope, value: {}, correlation_id: scope.session_id })).status, 'INACTIVE');
  const adapter = new DurableLiveSessionAdapter({ driver, capability: active, clock: () => '2026-07-22T00:00:00.000Z' });
  assert.equal((await adapter.write({ kind: 'projection', object_id: 'p', scope, value: { count: 1 }, correlation_id: scope.session_id })).status, 'WRITTEN');
  assert.equal((await adapter.write({ kind: 'projection', object_id: 'p', scope, value: { count: 2 }, correlation_id: scope.session_id })).status, 'CONCURRENCY_CONFLICT');
  assert.equal((await adapter.readObject({ kind: 'projection', object_id: 'p', scope })).record.value.count, 1);
  const other = { ...scope, tenant_id: 'other' };
  assert.equal((await adapter.readObject({ kind: 'projection', object_id: 'p', scope: other })).status, 'NOT_FOUND');
});

test('file-backed JSONL driver survives a fresh service instance and canonical promotion remains exactly once', async () => {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'coach-connect-durable-'));
  const counter = path.join(dataRoot, 'canonical-count.txt');
  const firstDriver = new LocalJsonlDurableLiveSessionDriver({ dataRoot });
  const firstAdapter = new DurableLiveSessionAdapter({ driver: firstDriver, capability: active, clock: () => '2026-07-22T00:00:00.000Z' });
  await firstAdapter.write({ kind: 'projection', object_id: 'session-state', scope, value: { status: 'PAUSED', last_sequence: 1 }, correlation_id: scope.session_id });
  const replayA = await replayAndCheckpoint({ adapter: firstAdapter, scope, events: [{ aggregate_sequence: 1, envelope_hash: 'h1', event: { delta: 1 } }], reducer: (state, event) => ({ count: state.count + event.delta }), initial_state: { count: 0 } });
  assert.equal(replayA.state, 'ACTIVE');
  const workflowA = new DurableBusinessEngineWorkflowStore(firstAdapter), proposal = { proposal_id: 'restart-proposal', base_business_engine_version: 1 }, confirmation = { confirmation_id: 'restart-confirmation', proposal_id: 'restart-proposal', response_state: 'ACCEPTED', response_actor_id: scope.subscriber_id };
  const promoted = await workflowA.promote({ scope, proposal, confirmation, business_engine: { version: 1 }, event: {}, canonicalAppend: async () => { fs.appendFileSync(counter, 'append\n'); return { ok: true, event_id: 'canonical-restart', new_version: 2 }; } });
  assert.equal(promoted.canonical_append_count, 1);

  const secondDriver = new LocalJsonlDurableLiveSessionDriver({ dataRoot });
  const secondAdapter = new DurableLiveSessionAdapter({ driver: secondDriver, capability: active, clock: () => '2026-07-22T00:01:00.000Z' });
  assert.equal((await secondAdapter.readObject({ kind: 'projection', object_id: 'session-state', scope })).record.value.status, 'PAUSED');
  assert.equal((await secondAdapter.readObject({ kind: 'checkpoint', object_id: scope.session_id, scope })).record.value.last_sequence, 1);
  const replayB = await replayAndCheckpoint({ adapter: secondAdapter, scope, checkpoint_id: 'restart-resume', events: [{ aggregate_sequence: 1, envelope_hash: 'h1', event: { delta: 1 } }], reducer: (state, event) => ({ count: state.count + event.delta }), initial_state: { count: 0 } });
  assert.equal(replayB.state, 'ACTIVE');
  const replayedPromotion = await new DurableBusinessEngineWorkflowStore(secondAdapter).promote({ scope, proposal, confirmation, business_engine: { version: 1 }, event: {}, canonicalAppend: async () => { fs.appendFileSync(counter, 'duplicate\n'); return { ok: true }; } });
  assert.equal(replayedPromotion.status, 'IDEMPOTENT_REPLAY'); assert.equal(replayedPromotion.canonical_append_count, 0);
  assert.equal(fs.readFileSync(counter, 'utf8').trim(), 'append');
  fs.writeFileSync(secondDriver.lockPath, 'competing-writer');
  assert.equal((await secondDriver.writeDurable({ key: 'blocked', record: {}, expected_version: 0 })).status, 'LOCAL_DURABILITY_BUSY');
  fs.unlinkSync(secondDriver.lockPath);
  assert.throws(() => new LocalJsonlDurableLiveSessionDriver({ dataRoot, filename: '../escape.jsonl' }), /safe dataRoot and filename/);
});
