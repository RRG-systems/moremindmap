import test from 'node:test'; import assert from 'node:assert/strict';
import { SYNTHETIC_IDS, syntheticEvent, createPayloadHash, hashCanonicalJson } from '../src/lib/intelligenceFabric/index.js';
import { createInMemoryRuntimeStoresForTest } from '../src/lib/intelligenceFabric/testing/inMemoryRuntimeAdapter.js';
import { compareReplayResults, createProjectionCheckpoint, defineProjection, replayProjection } from '../src/lib/intelligenceFabric/runtime/replay.js';

const aggregate = { tenant_id: SYNTHETIC_IDS.tenant, aggregate_type: 'PROFILE', aggregate_id: SYNTHETIC_IDS.profile };
const projection = defineProjection({ projection_id: 'synthetic-metric', projection_version: '1.0.0', initial_state: { value: null, applied: [] },
  apply: (state, event) => event.payload.metric_value == null ? state : ({ value: event.payload.metric_value, applied: [...state.applied, event.event_id] }) });
const metricEvent = (id, value, patch = {}) => { const payload = { metric_value: value }; return syntheticEvent({ event_id: id, event_type: 'KPI_EVIDENCE_RECORDED', idempotency_key: `idem_${id}`, authority_type: 'USER_EVIDENCE', truth_class: 'OBSERVED_TRUTH', payload, payload_hash: createPayloadHash(payload), ...patch }); };

function populated() { const stores = createInMemoryRuntimeStoresForTest(); stores.events.append({ event: metricEvent('evt_metric_1', 10), aggregate_key: aggregate }); stores.events.append({ event: metricEvent('evt_metric_2', 12), aggregate_key: aggregate }); return stores; }

test('identical history produces deterministic replay hash', () => {
  const { events } = populated(), stored = events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events;
  const a = replayProjection({ definition: projection, stored_events: stored, tenant_id: SYNTHETIC_IDS.tenant, context: { policy_version: 'synthetic-v1' } });
  const b = replayProjection({ definition: projection, stored_events: [...stored].reverse(), tenant_id: SYNTHETIC_IDS.tenant, context: { policy_version: 'synthetic-v1' } });
  assert.equal(a.state.value, 12); assert.equal(compareReplayResults(a, b).equivalent, true);
});

test('checkpoint replay equals full replay', () => {
  const { events } = populated(), stored = events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events;
  const first = replayProjection({ definition: projection, stored_events: stored.slice(0, 1), tenant_id: SYNTHETIC_IDS.tenant });
  const checkpoint = createProjectionCheckpoint({ definition: projection, tenant_id: SYNTHETIC_IDS.tenant,
    filter_fingerprint: hashCanonicalJson({}), last_store_sequence: 1, input_prefix: stored.slice(0, 1), state: first.state, context: {} });
  const resumed = replayProjection({ definition: projection, stored_events: stored, tenant_id: SYNTHETIC_IDS.tenant, checkpoint });
  const full = replayProjection({ definition: projection, stored_events: stored, tenant_id: SYNTHETIC_IDS.tenant });
  assert.deepEqual(resumed.state, full.state); assert.equal(resumed.receipt.output_hash, full.receipt.output_hash);
});

test('profile and business replay filters exclude other same-tenant scopes', () => {
  const { events } = populated();
  const otherAggregate = { tenant_id: SYNTHETIC_IDS.tenant, aggregate_type: 'PROFILE', aggregate_id: 'mm-20260115-other001' };
  events.append({ event: metricEvent('evt_metric_other_scope', 99, { profile_id: 'mm-20260115-other001', business_id: 'business_synthetic_other' }), aggregate_key: otherAggregate });
  const stored = events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events;
  const result = replayProjection({ definition: projection, stored_events: stored, tenant_id: SYNTHETIC_IDS.tenant,
    filter: { tenant_id: SYNTHETIC_IDS.tenant, profile_id: SYNTHETIC_IDS.profile, business_id: SYNTHETIC_IDS.business } });
  assert.equal(result.state.value, 12); assert.doesNotMatch(JSON.stringify(result), /evt_metric_other_scope/);
});

test('late-effective append bypasses checkpoint and rebuilds in chronological order', () => {
  const { events } = populated(), checkpointed = events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events;
  const first = replayProjection({ definition: projection, stored_events: checkpointed, tenant_id: SYNTHETIC_IDS.tenant });
  const checkpoint = createProjectionCheckpoint({ definition: projection, tenant_id: SYNTHETIC_IDS.tenant,
    filter_fingerprint: hashCanonicalJson({}), last_store_sequence: 2, input_prefix: checkpointed, state: first.state, context: {} });
  events.append({ event: metricEvent('evt_metric_late_checkpoint', 9, { occurred_at: '2025-12-01T00:00:00.000Z', effective_at: '2025-12-01T00:00:00.000Z', recorded_at: '2026-02-01T00:00:00.000Z' }), aggregate_key: aggregate });
  const stored = events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events;
  const resumed = replayProjection({ definition: projection, stored_events: stored, tenant_id: SYNTHETIC_IDS.tenant, checkpoint });
  const full = replayProjection({ definition: projection, stored_events: stored, tenant_id: SYNTHETIC_IDS.tenant });
  assert.deepEqual(resumed.state, full.state); assert.equal(resumed.replay_hash, full.replay_hash); assert.equal(resumed.receipt.checkpoint_id, null);
});

test('post-checkpoint replacement of checkpointed history forces full rebuild', () => {
  const { events } = populated(), checkpointed = events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events;
  const first = replayProjection({ definition: projection, stored_events: checkpointed, tenant_id: SYNTHETIC_IDS.tenant });
  const checkpoint = createProjectionCheckpoint({ definition: projection, tenant_id: SYNTHETIC_IDS.tenant,
    filter_fingerprint: hashCanonicalJson({}), last_store_sequence: 2, input_prefix: checkpointed, state: first.state, context: {} });
  const payload = { target_event_id: 'evt_metric_2', reason_code: 'SYNTHETIC_TOMBSTONE' };
  events.append({ event: syntheticEvent({ event_id: 'evt_metric_checkpoint_tombstone', event_type: 'EVIDENCE_TOMBSTONED', idempotency_key: 'idem_metric_checkpoint_tombstone', authority_type: 'USER_EVIDENCE', truth_class: 'OBSERVED_TRUTH', privacy_classification: 'TENANT_PRIVATE', supersedes_event_id: 'evt_metric_2', payload, payload_hash: createPayloadHash(payload) }), aggregate_key: aggregate });
  const stored = events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events;
  const resumed = replayProjection({ definition: projection, stored_events: stored, tenant_id: SYNTHETIC_IDS.tenant, checkpoint });
  const full = replayProjection({ definition: projection, stored_events: stored, tenant_id: SYNTHETIC_IDS.tenant });
  assert.deepEqual(resumed.state, full.state); assert.equal(resumed.replay_hash, full.replay_hash); assert.equal(resumed.receipt.checkpoint_id, null);
});

test('correction changes current projection while system cutoff preserves prior reconstruction', () => {
  const { events } = populated(); const corrected = metricEvent('evt_metric_correction', 15, { correction_of_event_id: 'evt_metric_2' });
  events.append({ event: corrected, aggregate_key: aggregate });
  const historical = replayProjection({ definition: projection, stored_events: events.read({ tenant_id: SYNTHETIC_IDS.tenant, through_sequence: 2 }).events, tenant_id: SYNTHETIC_IDS.tenant });
  const current = replayProjection({ definition: projection, stored_events: events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events, tenant_id: SYNTHETIC_IDS.tenant });
  assert.equal(historical.state.value, 12); assert.equal(current.state.value, 15); assert.notEqual(historical.replay_hash, current.replay_hash);
});

test('late effective evidence changes current but not prior system-time receipt', () => {
  const { events } = populated(); const before = events.read({ tenant_id: SYNTHETIC_IDS.tenant });
  events.append({ event: metricEvent('evt_metric_late', 9, { occurred_at: '2025-12-01T00:00:00.000Z', effective_at: '2025-12-01T00:00:00.000Z', recorded_at: '2026-02-01T00:00:00.000Z' }), aggregate_key: aggregate });
  const old = replayProjection({ definition: projection, stored_events: before.events, tenant_id: SYNTHETIC_IDS.tenant });
  const rebuilt = replayProjection({ definition: projection, stored_events: events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events, tenant_id: SYNTHETIC_IDS.tenant });
  assert.notEqual(old.replay_hash, rebuilt.replay_hash); assert.equal(old.state.value, 12);
});

test('tombstone suppresses target without deleting history', () => {
  const { events } = populated(); const payload = { target_event_id: 'evt_metric_2', reason_code: 'SYNTHETIC_TOMBSTONE' };
  events.append({ event: syntheticEvent({ event_id: 'evt_metric_tombstone', event_type: 'EVIDENCE_TOMBSTONED', idempotency_key: 'idem_metric_tombstone', authority_type: 'USER_EVIDENCE', truth_class: 'OBSERVED_TRUTH', supersedes_event_id: 'evt_metric_2', payload, payload_hash: createPayloadHash(payload) }), aggregate_key: aggregate });
  const stored = events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events, result = replayProjection({ definition: projection, stored_events: stored, tenant_id: SYNTHETIC_IDS.tenant });
  assert.equal(stored.length, 3); assert.equal(result.state.value, 10); assert.ok(result.receipt.skipped_events.some((x) => x.reason === 'TOMBSTONED'));
});

test('invalid event/hash and corrupted checkpoint fail closed safely', () => {
  const { events } = populated(), stored = events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events;
  const corrupt = [{ ...stored[0], envelope_hash: 'corrupt' }];
  assert.equal(replayProjection({ definition: projection, stored_events: corrupt, tenant_id: SYNTHETIC_IDS.tenant }).status, 'REPLAY_FAILED');
  const first = replayProjection({ definition: projection, stored_events: stored.slice(0, 1), tenant_id: SYNTHETIC_IDS.tenant });
  const checkpoint = createProjectionCheckpoint({ definition: projection, tenant_id: SYNTHETIC_IDS.tenant, filter_fingerprint: hashCanonicalJson({}), last_store_sequence: 1, input_prefix: stored.slice(0, 1), state: first.state, context: {} });
  assert.equal(replayProjection({ definition: projection, stored_events: stored, tenant_id: SYNTHETIC_IDS.tenant, checkpoint: { ...checkpoint, state_hash: 'corrupt' } }).status, 'CHECKPOINT_INVALID');
});
