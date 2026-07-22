import test from 'node:test';
import assert from 'node:assert/strict';
import { runFutureEngine } from '../src/lib/intelligenceFabric/index.js';

const input = { tenant_id: 'tenant_synthetic', business_id: 'business_synthetic', profile_id: 'profile_synthetic', as_of_at: '2026-07-20T12:00:00.000Z',
  business_engine_state_version: { state_version_id: 'state_v1' }, belief_state: { belief_state_id: 'belief_v1', beliefs: [{ belief_id: 'belief_1' }] },
  primary_constraint: 'LEADERSHIP_BOTTLENECK', missing_evidence: [], support_by_slot: {
    CURRENT: { business_reality: 4, support_ids: ['e2', 'e1'] }, MOST_LIKELY_NEXT: { constraint: 3, support_ids: ['e3'] },
    ALTERNATIVE_1: { behavior: 1 }, ALTERNATIVE_2: { business_model: 1 }, ALTERNATIVE_3: { market: 1 },
  } };

test('Future Engine emits exactly five replay-stable trajectories and separated confidence', () => {
  const a = runFutureEngine(input); const b = runFutureEngine(input);
  assert.equal(a.ok, true); assert.equal(a.versions.length, 5); assert.equal(a.output_hash, b.output_hash);
  assert.equal(a.versions.reduce((sum, x) => sum + x.probability, 0), 1);
  assert.notEqual(a.versions[0].probability, a.versions[0].probability_confidence.score);
  assert.match(a.versions[0].description, /not a prophecy/);
});

test('refresh retains stable identities and records changes and non-changes', () => {
  const first = runFutureEngine(input);
  const second = runFutureEngine({ ...input, as_of_at: '2026-07-21T12:00:00.000Z', current_future_set: first,
    support_by_slot: { ...input.support_by_slot, MOST_LIKELY_NEXT: { constraint: 5, support_ids: ['e3', 'e4'] } } });
  assert.deepEqual(second.versions.map((x) => x.stable_future_identity), first.versions.map((x) => x.stable_future_identity));
  assert.ok(second.probability_changes.some((x) => x.changed));
});

test('sparse, stale, contradictory and authority-conflict cases remain explicit', () => {
  const result = runFutureEngine({ ...input, missing_evidence: ['market', 'finance'], stale_market_context: true,
    authority_conflict_graph: { conflicts: [{ id: 'conflict_1' }] }, support_by_slot: { ...input.support_by_slot, CURRENT: { business_reality: 2, contradiction_ids: ['c1'] } } });
  assert.equal(result.human_review_required, true); assert.equal(result.versions[0].probability_confidence.level, 'LOW');
  assert.equal(result.probability_receipt.calibration_status, 'DETERMINISTIC_REFERENCE_NOT_CALIBRATED');
});

test('cross-tenant input and all-suspended cases fail closed', () => {
  assert.equal(runFutureEngine({ ...input, scoped_inputs: [{ tenant_id: 'attacker', business_id: input.business_id, profile_id: input.profile_id }] }).ok, false);
  assert.equal(runFutureEngine({ ...input, suspended_slots: ['CURRENT', 'MOST_LIKELY_NEXT', 'ALTERNATIVE_1', 'ALTERNATIVE_2', 'ALTERNATIVE_3'] }).ok, false);
});
