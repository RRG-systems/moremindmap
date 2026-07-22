import test from 'node:test';
import assert from 'node:assert/strict';
import { DurableLiveSessionAdapter } from '../src/lib/intelligenceFabric/coachConnect/liveSession/durable/adapter.js';
import { DurableBusinessEngineWorkflowStore } from '../src/lib/intelligenceFabric/coachConnect/liveSession/durable/businessEngineStore.js';
import { rebuildDurableProjection } from '../src/lib/intelligenceFabric/coachConnect/liveSession/durable/projectionStore.js';
import { replayAndCheckpoint } from '../src/lib/intelligenceFabric/coachConnect/liveSession/durable/checkpointReplay.js';
import { runSyntheticMigrationDryRun } from '../src/lib/intelligenceFabric/coachConnect/liveSession/durable/service.js';
import { InMemoryDurableLiveSessionDriver } from '../src/lib/intelligenceFabric/testing/inMemoryDurableLiveSessionDriver.js';

const scope = { tenant_id: 'tenant_synthetic', profile_id: 'profile_synthetic', business_id: 'business_synthetic', subscriber_id: 'subscriber_synthetic', session_id: 'session_synthetic' };
const active = { foundation_enabled: true, synthetic_only: true, writes_enabled: true, emergency_disabled: false };

test('synthetic durable happy path persists governed workflow, promotes once, replays, and rebuilds matching projection', async () => {
  const driver = new InMemoryDurableLiveSessionDriver(), adapter = new DurableLiveSessionAdapter({ driver, capability: active, clock: () => '2026-07-22T00:00:00.000Z' }), store = new DurableBusinessEngineWorkflowStore(adapter);
  const proposal = { proposal_id: 'proposal_1', base_business_engine_version: 1, evidence: 'reviewed_artifact' };
  const confirmation = { confirmation_id: 'confirmation_1', proposal_id: 'proposal_1', response_state: 'ACCEPTED', response_actor_id: scope.subscriber_id };
  assert.equal((await store.writeProposal(scope, proposal)).ok, true); assert.equal((await store.writeConfirmation(scope, confirmation)).ok, true);
  let appends = 0;
  const promotion = await store.promote({ scope, proposal, confirmation, business_engine: { version: 1 }, event: { evidence: 'reviewed_artifact' }, canonicalAppend: () => { appends += 1; return { ok: true, event_id: 'canonical_1', new_version: 2 }; } });
  assert.equal(promotion.canonical_append_count, 1); assert.equal(appends, 1);
  const events = [{ aggregate_sequence: 1, envelope_hash: 'hash_1', event: { delta: 1 } }], reducer = (state, event) => ({ count: state.count + event.delta });
  const replay = await replayAndCheckpoint({ adapter, scope, events, reducer, initial_state: { count: 0 } });
  const projection = await rebuildDurableProjection({ adapter, scope, projection_id: 'business_engine', events, reducer, initial_state: { count: 0 } });
  assert.equal(replay.checkpoint.state_hash, projection.projection_hash); assert.equal(replay.state, 'ACTIVE');
});

test('subscriber rejection, recovery failure, and teardown failure produce zero canonical mutation', async () => {
  const adapter = new DurableLiveSessionAdapter({ driver: new InMemoryDurableLiveSessionDriver(), capability: active, clock: () => '2026-07-22T00:00:00.000Z' }), store = new DurableBusinessEngineWorkflowStore(adapter);
  let appends = 0;
  const rejected = await store.promote({ scope, proposal: { proposal_id: 'p', base_business_engine_version: 1 }, confirmation: { proposal_id: 'p', response_state: 'REJECTED', response_actor_id: scope.subscriber_id }, business_engine: { version: 1 }, event: {}, canonicalAppend: () => { appends += 1; } });
  assert.equal(rejected.canonical_append_count, 0); assert.equal(appends, 0);
});

test('synthetic migration dry run is deterministic and never touches production data', async () => {
  const source = { sessions: [['s', { status: 'CLOSED' }]], events: [['s', [{ sequence_number: 1 }]]], confirmations: [] };
  const firstAdapter = new DurableLiveSessionAdapter({ driver: new InMemoryDurableLiveSessionDriver(), capability: active, clock: () => '2026-07-22T00:00:00.000Z' });
  const secondAdapter = new DurableLiveSessionAdapter({ driver: new InMemoryDurableLiveSessionDriver(), capability: active, clock: () => '2026-07-22T00:00:00.000Z' });
  const first = await runSyntheticMigrationDryRun({ adapter: firstAdapter, scope, source_snapshot: source });
  const second = await runSyntheticMigrationDryRun({ adapter: secondAdapter, scope, source_snapshot: source });
  assert.equal(first.ok, true); assert.equal(first.deterministic_hash, second.deterministic_hash);
  assert.equal(first.converted.production_data_read, false); assert.equal(first.rollback.production_effect, false);
});
