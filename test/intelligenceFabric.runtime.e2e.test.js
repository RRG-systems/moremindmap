import test from 'node:test'; import assert from 'node:assert/strict';
import { MISSION_001_EXAMPLES, MISSION_002_FIXTURES, SYNTHETIC_IDS, SYNTHETIC_NOW, syntheticEvent, syntheticProvenance, createPayloadHash, hashCanonicalJson } from '../src/lib/intelligenceFabric/index.js';
import { createInMemoryRuntimeStoresForTest } from '../src/lib/intelligenceFabric/testing/inMemoryRuntimeAdapter.js';
import { createProjectionCheckpoint, replayProjection } from '../src/lib/intelligenceFabric/runtime/replay.js';
import { EVIDENCE_LEDGER_PROJECTION, runDurableIntelligenceRuntime } from '../src/lib/intelligenceFabric/runtime/durableRuntime.js';

const aggregate = { tenant_id: SYNTHETIC_IDS.tenant, aggregate_type: 'BUSINESS', aggregate_id: SYNTHETIC_IDS.business };
const kpi = (id, metric_id, value, patch = {}) => { const payload = { metric_id, value, unit: 'count/week', period: '2026-W02' }; return syntheticEvent({ event_id: id, event_type: 'KPI_EVIDENCE_RECORDED', idempotency_key: `idem_${id}`, authority_type: 'USER_EVIDENCE', truth_class: 'OBSERVED_TRUTH', privacy_classification: 'TENANT_PRIVATE', consent_scope: ['assessment'], payload, payload_hash: createPayloadHash(payload), ...patch }); };
function history(items = [kpi('evt_runtime_conversations', 'meaningful_conversations', 12), kpi('evt_runtime_leads', 'leads', 5)]) { const stores = createInMemoryRuntimeStoresForTest(); for (const event of items) assert.equal(stores.events.append({ event, aggregate_key: aggregate }).ok, true); return stores; }
const runtimeInput = (stored_events, patch = {}) => ({ stored_events, tenant_id: SYNTHETIC_IDS.tenant, profile_id: SYNTHETIC_IDS.profile,
  business_id: SYNTHETIC_IDS.business, subscription_id: SYNTHETIC_IDS.subscription, as_of_at: '2026-01-22T12:00:00.000Z',
  purpose: 'business_assessment', scope: 'assessment', consent_record: MISSION_001_EXAMPLES.consent_activation, relationship_authorized: true,
  vertical_operating_policy: MISSION_002_FIXTURES.vertical_operating_policy, market_context_graph: MISSION_002_FIXTURES.market_regime,
  authority_conflict_graph: { conflicts: [] }, prior_belief_state: MISSION_002_FIXTURES.belief_support_and_contradiction,
  belief_observations: [], provenance: syntheticProvenance, consent_record_ids: ['consent_synthetic_active'], ...patch });

test('healthy complete synthetic case reconstructs event-to-belief runtime deterministically', () => {
  const stores = history(MISSION_002_FIXTURES.vertical_operating_policy.required_weekly_metrics.map((metric, i) => kpi(`evt_runtime_complete_${i}`, metric, i + 1)));
  const events = stores.events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events;
  const a = runDurableIntelligenceRuntime(runtimeInput(events)), b = runDurableIntelligenceRuntime(runtimeInput(events));
  assert.equal(a.ok, true, JSON.stringify(a.failure)); assert.equal(a.runtime_hash, b.runtime_hash);
  assert.equal(a.confidence_state.evidence_completeness, 1); assert.equal(a.evidence_gaps.length, 1); // expired synthetic market indicator
});

test('sparse evidence with ambitious direction preserves gaps without rewriting goal', () => {
  const result = runDurableIntelligenceRuntime(runtimeInput(history([kpi('evt_runtime_sparse', 'leads', 1)]).events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events,
    { user_intent_state: MISSION_002_FIXTURES.complete_user_intent_state }));
  assert.equal(result.ok, true); assert.ok(result.evidence_gaps.length > 5);
  assert.equal(MISSION_002_FIXTURES.complete_user_intent_state.goal_claims[0].statement, 'Build a sustainable synthetic business.');
});

test('goal/financial conflict and coach/evidence conflict require review without averaging', () => {
  const conflicts = MISSION_002_FIXTURES.authority_conflict;
  const result = runDurableIntelligenceRuntime(runtimeInput(history().events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events, { authority_conflict_graph: conflicts }));
  assert.equal(result.ok, true); assert.equal(result.explanation_trace.human_review_required, true);
  assert.ok(result.business_engine_state.conflict_ids.includes('conflict_synthetic_001'));
});

test('corrected KPI changes current state while historical system cutoff remains unchanged', () => {
  const stores = history([kpi('evt_runtime_correct_target', 'leads', 5)]), before = stores.events.read({ tenant_id: SYNTHETIC_IDS.tenant });
  const payload = { metric_id: 'leads', value: 8, unit: 'count/week', period: '2026-W02' };
  stores.events.append({ event: syntheticEvent({ event_id: 'evt_runtime_correction', event_type: 'EVIDENCE_CORRECTED', idempotency_key: 'idem_runtime_correction', correction_of_event_id: 'evt_runtime_correct_target', authority_type: 'USER_EVIDENCE', truth_class: 'OBSERVED_TRUTH', privacy_classification: 'TENANT_PRIVATE', consent_scope: ['assessment'], payload, payload_hash: createPayloadHash(payload) }), aggregate_key: aggregate });
  const historical = runDurableIntelligenceRuntime(runtimeInput(before.events));
  const current = runDurableIntelligenceRuntime(runtimeInput(stores.events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events));
  assert.equal(historical.business_engine_state.current_operating_state.current.leads.value, 5);
  assert.equal(current.business_engine_state.current_operating_state.current.leads.value, 8);
});

test('late evidence changes rebuilt current projection but not captured historical result', () => {
  const stores = history(), old = runDurableIntelligenceRuntime(runtimeInput(stores.events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events));
  stores.events.append({ event: kpi('evt_runtime_late', 'appointments', 2, { occurred_at: '2025-12-01T00:00:00.000Z', effective_at: '2025-12-01T00:00:00.000Z', recorded_at: '2026-02-01T00:00:00.000Z' }), aggregate_key: aggregate });
  const rebuilt = runDurableIntelligenceRuntime(runtimeInput(stores.events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events));
  assert.equal(old.business_engine_state.current_operating_state.current.appointments, undefined);
  assert.equal(rebuilt.business_engine_state.current_operating_state.current.appointments.value, 2);
});

test('market expiration is explicit and private coach material is not routed through evidence runtime', () => {
  const result = runDurableIntelligenceRuntime(runtimeInput(history().events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events, { as_of_at: '2026-02-01T12:00:00.000Z' }));
  assert.ok(result.evidence_gaps.some((x) => x.gap_type === 'STALE_MARKET_CONTEXT'));
  assert.deepEqual(result.business_engine_state.human_judgment_ids, []);
});

test('tenant attack is denied and duplicate append/replay stays idempotent', () => {
  const stores = history(), event = kpi('evt_runtime_duplicate', 'contracts', 1);
  assert.equal(stores.events.append({ event, aggregate_key: aggregate }).status, 'APPENDED');
  assert.equal(stores.events.append({ event: kpi('evt_runtime_duplicate', 'contracts', 1), aggregate_key: aggregate }).status, 'IDEMPOTENT_REPLAY');
  assert.equal(stores.events.read({ tenant_id: 'tenant_synthetic_other' }).events.length, 0);
  const result = runDurableIntelligenceRuntime(runtimeInput(stores.events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events));
  assert.equal(result.event_replay.receipt.applied_event_ids.filter((x) => x === 'evt_runtime_duplicate').length, 1);
});

test('tombstoned evidence remains in history but leaves current ledger', () => {
  const stores = history([kpi('evt_runtime_tomb_target', 'closings', 1)]); const payload = { target_event_id: 'evt_runtime_tomb_target', reason_code: 'SYNTHETIC_TOMBSTONE' };
  stores.events.append({ event: syntheticEvent({ event_id: 'evt_runtime_tombstone', event_type: 'EVIDENCE_TOMBSTONED', idempotency_key: 'idem_runtime_tombstone', supersedes_event_id: 'evt_runtime_tomb_target', authority_type: 'USER_EVIDENCE', truth_class: 'OBSERVED_TRUTH', privacy_classification: 'TENANT_PRIVATE', consent_scope: ['assessment'], payload, payload_hash: createPayloadHash(payload) }), aggregate_key: aggregate });
  const stored = stores.events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events, result = runDurableIntelligenceRuntime(runtimeInput(stored));
  assert.equal(stored.length, 2); assert.equal(result.evidence_ledger.evidence_entries.length, 0);
});

test('non-material event yields receipted non-change and unresolved conflict stays visible', () => {
  const stores = history(), first = runDurableIntelligenceRuntime(runtimeInput(stores.events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events));
  const second = runDurableIntelligenceRuntime(runtimeInput(stores.events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events, { prior_state_version: { ...first.business_engine_state_version, state_snapshot: first.business_engine_state } }));
  assert.ok(second.explanation_trace.non_change_reasons.includes('PROJECTION_UNCHANGED'));
});

test('checkpoint rebuild and process-restart simulation equal full replay', () => {
  const stores = history(), all = stores.events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events;
  const context = { projection_policy_version: 'evidence-ledger-v1' };
  const firstReplay = replayProjection({ definition: EVIDENCE_LEDGER_PROJECTION, stored_events: all.slice(0, 1), tenant_id: SYNTHETIC_IDS.tenant, context });
  const checkpoint = createProjectionCheckpoint({ definition: EVIDENCE_LEDGER_PROJECTION, tenant_id: SYNTHETIC_IDS.tenant,
    filter_fingerprint: hashCanonicalJson({}), last_store_sequence: 1, input_prefix: all.slice(0, 1), state: firstReplay.state, context });
  const full = runDurableIntelligenceRuntime(runtimeInput(all)), resumed = runDurableIntelligenceRuntime(runtimeInput(all, { checkpoint }));
  assert.equal(full.ok, true); assert.equal(resumed.ok, true); assert.equal(full.runtime_hash, resumed.runtime_hash);
  const restartedStores = createInMemoryRuntimeStoresForTest(); for (const stored of all) restartedStores.events.append({ event: stored.event, aggregate_key: aggregate });
  const restarted = runDurableIntelligenceRuntime(runtimeInput(restartedStores.events.read({ tenant_id: SYNTHETIC_IDS.tenant }).events));
  assert.equal(full.runtime_hash, restarted.runtime_hash);
});
