import test from 'node:test';
import assert from 'node:assert/strict';
import { runPredictiveInterventionRuntime } from '../src/lib/intelligenceFabric/index.js';

const dimensions = (n) => ({ expected_leverage: n, probability_shift: n, constraint_centrality: n, user_goal_alignment: n, behavioral_fit: n,
  execution_feasibility: n, financial_feasibility: n, evidence_quality: n, outcome_support: n, time_to_signal: n, reversibility: n, downside_risk: .1,
  privacy_compliance_burden: .1, confidence: n });
const durable = { ok: true, runtime_hash: 'durable_hash', business_engine_state_version: { state_version_id: 'state_v1' }, belief_state: { belief_state_id: 'belief_v1', beliefs: [{ belief_id: 'belief_1' }] } };
const candidates = [.9, .7, .6, .5, .4].map((n, i) => ({ intervention_id: `candidate_${i}`, template_id: `template_${i}`, tenant_id: 'tenant_synthetic', target_constraint: 'constraint_1',
  target_future_or_transition: 'current-to-next', dimensions: dimensions(n), expected_probability_shift: n / 10, expected_downstream_effects: ['synthetic signal'], time_to_signal: '14_DAYS', time_to_outcome: '90_DAYS' }));
const input = { tenant_id: 'tenant_synthetic', business_id: 'business_synthetic', profile_id: 'profile_synthetic', as_of_at: '2026-07-20T00:00:00.000Z',
  durable_runtime_result: durable, intervention_candidates: candidates, support_by_slot: { CURRENT: { business_reality: 4 }, MOST_LIKELY_NEXT: { constraint: 3 }, ALTERNATIVE_1: { behavior: 1 }, ALTERNATIVE_2: { business_model: 1 }, ALTERNATIVE_3: { market: 1 } } };

test('predictive runtime deterministically composes state, five futures, ranking and proposed One Move', () => {
  const a = runPredictiveInterventionRuntime(input); const b = runPredictiveInterventionRuntime(input);
  assert.equal(a.ok, true); assert.equal(a.runtime_hash, b.runtime_hash); assert.equal(a.future_engine.versions.length, 5);
  assert.equal(a.one_move.status, 'PROPOSED'); assert.equal(a.intervention_ranking.candidates.length, 5);
});

test('reordered candidates and reconstructed durable result are equivalent', () => {
  const a = runPredictiveInterventionRuntime(input);
  const b = runPredictiveInterventionRuntime({ ...input, intervention_candidates: [...candidates].reverse(), durable_runtime_result: JSON.parse(JSON.stringify(durable)) });
  assert.equal(a.runtime_hash, b.runtime_hash);
});

test('near tie produces review and no One Move proposal', () => {
  const tied = [candidates[0], { ...candidates[0], intervention_id: 'tied', template_id: 'tied' }, ...candidates.slice(2)];
  const result = runPredictiveInterventionRuntime({ ...input, intervention_candidates: tied });
  assert.equal(result.human_review_required, true); assert.equal(result.one_move, null);
});
