import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';
import {
  COACH_CONNECT_RETENTION_POLICY,
  createRetentionPlan,
  evaluateRecordDeletionEpoch,
  executeSyntheticLogicalDeletion,
  InMemorySecurityStateStore,
  LOCAL_JSONL_DELETION_CAPABILITY,
} from '../src/lib/intelligenceFabric/coachConnect/security/index.js';
import { DurableLiveSessionAdapter } from '../src/lib/intelligenceFabric/coachConnect/liveSession/durable/adapter.js';
import { LocalJsonlDurableLiveSessionDriver } from '../src/lib/intelligenceFabric/coachConnect/liveSession/durable/localJsonlDriver.js';
import { replayAndCheckpoint } from '../src/lib/intelligenceFabric/coachConnect/liveSession/durable/checkpointReplay.js';
import { InMemoryDurableLiveSessionDriver } from '../src/lib/intelligenceFabric/testing/inMemoryDurableLiveSessionDriver.js';

const scope = { tenant_id: 'tenant_retention', profile_id: 'profile_retention', business_id: 'business_retention', subscriber_id: 'subscriber_retention', session_id: 'session_retention' };
const activeDurable = { foundation_enabled: true, synthetic_only: true, writes_enabled: true, emergency_disabled: false };
const activeDeletion = { retention_policy_approved: true, deletion_execution_enabled: true, synthetic_only: true, production_traffic_enabled: false, emergency_disabled: false };

test('retention matrix is proposed and destructive execution remains unauthorized by default', () => {
  assert.equal(COACH_CONNECT_RETENTION_POLICY.status, 'PROPOSED_NOT_AUTHORIZED');
  assert.equal(COACH_CONNECT_RETENTION_POLICY.destructive_execution_authorized, false);
  const result = createRetentionPlan({ record_type: 'raw_transcript_reference', scope, reference_time: '2026-07-01T00:00:00.000Z', evaluated_at: '2026-07-24T00:00:00.000Z' });
  assert.equal(result.plan.status, 'DUE');
  assert.equal(result.plan.destructive_execution_authorized, false);
  assert.equal(result.plan.physical_deletion_supported, false);
});

test('synthetic logical deletion is gated and never claims physical JSONL erasure', async () => {
  const store = new InMemorySecurityStateStore();
  const blocked = await executeSyntheticLogicalDeletion({ store, scope, reason_code: 'RETENTION_EXPIRED', actor: { actor_id: 'operator' }, flags: {}, now: '2026-07-24T00:00:00.000Z' });
  assert.equal(blocked.code, 'DELETION_REQUIRED');
  const result = await executeSyntheticLogicalDeletion({
    store,
    scope,
    reason_code: 'RETENTION_EXPIRED',
    actor: { actor_id: 'operator' },
    flags: activeDeletion,
    now: '2026-07-24T00:00:00.000Z',
    backing_delete: async () => ({ ok: true }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.logical_denial_proven, true);
  assert.equal(result.physical_deletion, false);
  assert.equal(result.local_jsonl_physical_deletion, false);
  assert.equal(evaluateRecordDeletionEpoch({ store, scope, record_epoch: 0 }).code, 'DELETION_REQUIRED');
  assert.equal(evaluateRecordDeletionEpoch({ store, scope, record_epoch: 1 }).allowed, true);
});

test('durable reads and replay deny records older than the current deletion epoch', async () => {
  const securityStore = new InMemorySecurityStateStore();
  const epochProvider = (recordScope) => securityStore.getDeletionEpoch(hashCanonicalJson(recordScope)).epoch;
  const adapter = new DurableLiveSessionAdapter({ driver: new InMemoryDurableLiveSessionDriver(), capability: activeDurable, clock: () => '2026-07-24T00:00:00.000Z', deletionEpochProvider: epochProvider });
  assert.equal((await adapter.write({ kind: 'projection', object_id: 'projection_old', scope, value: { status: 'ACTIVE' }, correlation_id: scope.session_id })).ok, true);
  await executeSyntheticLogicalDeletion({ store: securityStore, scope, reason_code: 'RETENTION_EXPIRED', actor: { actor_id: 'operator' }, flags: activeDeletion, now: '2026-07-24T00:01:00.000Z', backing_delete: async () => ({ ok: true }) });
  const denied = await adapter.readObject({ kind: 'projection', object_id: 'projection_old', scope });
  assert.equal(denied.status, 'RETENTION_EXPIRED');
  assert.equal(denied.code, 'DELETION_REQUIRED');
  const replay = await replayAndCheckpoint({ adapter, scope, record_epoch: 0, events: [], reducer: (state) => state, initial_state: {} });
  assert.equal(replay.code, 'DELETION_REQUIRED');
});

test('local append-only journal explicitly reports logical-only deletion capability', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coach-connect-retention-'));
  const driver = new LocalJsonlDurableLiveSessionDriver({ dataRoot: root });
  assert.deepEqual(driver.inspectDeletionCapability(), {
    logical_tombstone_supported: true,
    deletion_epoch_supported: true,
    physical_deletion_supported: false,
    physical_deletion_claim: 'NOT_PROVEN_APPEND_ONLY_FULL_SNAPSHOTS',
  });
  assert.equal(LOCAL_JSONL_DELETION_CAPABILITY.physical_deletion_supported, false);
  assert.equal(LOCAL_JSONL_DELETION_CAPABILITY.claim, 'LOGICAL_DENIAL_ONLY');
});
