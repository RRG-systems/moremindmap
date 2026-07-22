import test from 'node:test'; import assert from 'node:assert/strict';
import { syntheticEvent, SYNTHETIC_IDS, createPayloadHash } from '../src/lib/intelligenceFabric/index.js';
import { createInMemoryRuntimeStoresForTest } from '../src/lib/intelligenceFabric/testing/inMemoryRuntimeAdapter.js';

const aggregate = { tenant_id: SYNTHETIC_IDS.tenant, aggregate_type: 'PROFILE', aggregate_id: SYNTHETIC_IDS.profile };
const event = (patch = {}) => syntheticEvent(patch);

test('append is immutable, sequenced, scoped, and retry-safe', () => {
  const { events } = createInMemoryRuntimeStoresForTest(); const input = event();
  assert.equal(events.append({ event: input, aggregate_key: aggregate }).status, 'APPENDED');
  assert.throws(() => { input.payload.goal = 'caller mutation'; }, TypeError);
  const stored = events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events[0];
  assert.equal(stored.event.payload.goal, 'Synthetic goal'); assert.equal(Object.isFrozen(stored), true);
  assert.equal(events.append({ event: event(), aggregate_key: aggregate }).status, 'IDEMPOTENT_REPLAY');
});

test('identity, idempotency, and concurrency conflicts remain distinct', () => {
  const { events } = createInMemoryRuntimeStoresForTest(); events.append({ event: event(), aggregate_key: aggregate });
  const changed = { changed: true };
  assert.equal(events.append({ event: event({ payload: changed, payload_hash: createPayloadHash(changed) }), aggregate_key: aggregate }).status, 'IDENTITY_CONFLICT');
  assert.equal(events.append({ event: event({ event_id: 'evt_synthetic_other', payload: changed, payload_hash: createPayloadHash(changed) }), aggregate_key: aggregate }).status, 'IDEMPOTENCY_CONFLICT');
  assert.equal(events.append({ event: event({ event_id: 'evt_synthetic_race', idempotency_key: 'idem_synthetic_race' }), aggregate_key: aggregate, expected_aggregate_sequence: 0 }).status, 'CONCURRENCY_CONFLICT');
});

test('cross-tenant append and reads fail closed', () => {
  const { events } = createInMemoryRuntimeStoresForTest();
  assert.equal(events.append({ event: event(), aggregate_key: { ...aggregate, tenant_id: 'tenant_synthetic_other' } }).status, 'SCOPE_DENIED');
  events.append({ event: event(), aggregate_key: aggregate });
  assert.equal(events.read({ tenant_id: 'tenant_synthetic_other' }).events.length, 0);
  assert.equal(events.read({}).status, 'SCOPE_DENIED');
});

test('correction, supersession, and tombstone append without erasing history', () => {
  const { events } = createInMemoryRuntimeStoresForTest(); events.append({ event: event(), aggregate_key: aggregate });
  const records = [
    event({ event_id: 'evt_synthetic_correction2', event_type: 'EVIDENCE_CORRECTED', idempotency_key: 'idem_correction2', correction_of_event_id: 'evt_synthetic_001' }),
    event({ event_id: 'evt_synthetic_supersession', event_type: 'EVIDENCE_SUPERSEDED', idempotency_key: 'idem_supersession', supersedes_event_id: 'evt_synthetic_correction2' }),
    event({ event_id: 'evt_synthetic_tombstone', event_type: 'EVIDENCE_TOMBSTONED', idempotency_key: 'idem_tombstone', supersedes_event_id: 'evt_synthetic_supersession', payload: { target_event_id: 'evt_synthetic_supersession', reason_code: 'SYNTHETIC_TOMBSTONE' }, payload_hash: createPayloadHash({ target_event_id: 'evt_synthetic_supersession', reason_code: 'SYNTHETIC_TOMBSTONE' }) }),
  ];
  for (const x of records) assert.equal(events.append({ event: x, aggregate_key: aggregate }).status, 'APPENDED');
  assert.equal(events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events.length, 4);
});

test('bitemporal query separates system cutoff from half-open effective window', () => {
  const { events } = createInMemoryRuntimeStoresForTest();
  events.append({ event: event({ event_id: 'evt_effective_late', idempotency_key: 'idem_effective_late', occurred_at: '2026-01-01T00:00:00.000Z', effective_at: '2026-01-01T00:00:00.000Z', recorded_at: '2026-02-01T00:00:00.000Z' }), aggregate_key: aggregate });
  events.append({ event: event({ event_id: 'evt_effective_current', idempotency_key: 'idem_effective_current', occurred_at: '2026-01-15T00:00:00.000Z', effective_at: '2026-01-15T00:00:00.000Z', recorded_at: '2026-01-15T00:00:00.000Z' }), aggregate_key: aggregate });
  const knownFirst = events.queryBitemporal({ tenant_id: SYNTHETIC_IDS.tenant, recorded_through_sequence: 1, effective_to: '2026-01-10T00:00:00.000Z' });
  assert.deepEqual(knownFirst.events.map((x) => x.event.event_id), ['evt_effective_late']);
  const window = events.queryBitemporal({ tenant_id: SYNTHETIC_IDS.tenant, effective_from: '2026-01-10T00:00:00.000Z', effective_to: '2026-02-01T00:00:00.000Z' });
  assert.deepEqual(window.events.map((x) => x.event.event_id), ['evt_effective_current']);
});

test('invalid reference and explicit test reset are isolated', () => {
  const { events } = createInMemoryRuntimeStoresForTest();
  const correction = event({ event_id: 'evt_bad_correction', idempotency_key: 'idem_bad_correction', correction_of_event_id: 'evt_missing' });
  assert.equal(events.append({ event: correction, aggregate_key: aggregate }).status, 'REFERENCE_CONFLICT');
  events.append({ event: event(), aggregate_key: aggregate }); events.resetForTestOnly();
  assert.equal(events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events.length, 0);
});
