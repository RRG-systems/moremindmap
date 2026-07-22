import test from 'node:test';
import assert from 'node:assert/strict';
import { createOneMove, rankInterventionCandidates, transitionOneMove } from '../src/lib/intelligenceFabric/index.js';

const dims = (overrides = {}) => ({ expected_leverage: .7, probability_shift: .6, constraint_centrality: .8, user_goal_alignment: .8, behavioral_fit: .8,
  execution_feasibility: .8, financial_feasibility: .8, evidence_quality: .7, outcome_support: .5, time_to_signal: .7, reversibility: .6,
  downside_risk: .2, privacy_compliance_burden: .2, confidence: .7, ...overrides });
const candidate = (id, overrides = {}) => ({ intervention_id: id, template_id: id, tenant_id: 'tenant_synthetic', target_constraint: 'constraint_1',
  target_future_or_transition: 'current-to-next', dimensions: dims(), expected_probability_shift: .1, expected_downstream_effects: ['signal'], time_to_signal: '14_DAYS', time_to_outcome: '90_DAYS', ...overrides });

test('ranking preserves five candidates, rejection, transparency and input-order determinism', () => {
  const candidates = [candidate('a'), candidate('b', { dimensions: dims({ expected_leverage: .95, operationally_eligible: false }), operationally_eligible: false }),
    candidate('c', { dimensions: dims({ evidence_quality: .95, execution_feasibility: .95 }) }), candidate('d', { user_rejected: true }), candidate('e', { dimensions: dims({ behavioral_fit: .3 }) })];
  const a = rankInterventionCandidates({ candidates, tenant_id: 'tenant_synthetic' });
  const b = rankInterventionCandidates({ candidates: [...candidates].reverse(), tenant_id: 'tenant_synthetic' });
  assert.equal(a.candidates.length, 5); assert.equal(a.receipt.receipt_id, b.receipt.receipt_id);
  assert.ok(a.candidates.some((x) => x.exclusions.includes('OPERATIONALLY_INFEASIBLE'))); assert.ok(a.candidates.some((x) => x.disposition === 'USER_REJECTED'));
  assert.equal(a.receipt.weights.expected_leverage, .13); assert.equal(a.receipt.sensitivity.length, 14);
});

test('near tie and authority conflict require human review', () => {
  const result = rankInterventionCandidates({ candidates: [candidate('a'), candidate('b')], tenant_id: 'tenant_synthetic' });
  assert.equal(result.selected, null); assert.equal(result.receipt.human_review_required, true);
});

test('One Move separates acceptance, authorization, execution, and outcome', () => {
  const created = createOneMove({ candidate: candidate('a'), tenant_id: 'tenant_synthetic', business_id: 'business_synthetic', profile_id: 'profile_synthetic', as_of_at: '2026-07-20T00:00:00.000Z' });
  let current = transitionOneMove(created.one_move, { to_status: 'PROPOSED', as_of_at: '2026-07-20T01:00:00.000Z', actor: { type: 'SYSTEM' } }).one_move;
  current = transitionOneMove(current, { to_status: 'CHALLENGED', as_of_at: '2026-07-20T02:00:00.000Z', actor: { type: 'HUMAN' }, record: { challenge: 'why' } }).one_move;
  current = transitionOneMove(current, { to_status: 'UNDER_DISCUSSION', as_of_at: '2026-07-20T03:00:00.000Z', actor: { type: 'HUMAN' } }).one_move;
  current = transitionOneMove(current, { to_status: 'ACCEPTED', as_of_at: '2026-07-20T04:00:00.000Z', actor: { type: 'HUMAN' }, record: { accepted: true } }).one_move;
  assert.equal(transitionOneMove(current, { to_status: 'IN_EXECUTION', as_of_at: '2026-07-20T05:00:00.000Z', actor: { type: 'HUMAN' } }).ok, false);
  assert.equal(transitionOneMove(current, { to_status: 'AUTHORIZED', as_of_at: '2026-07-20T05:00:00.000Z', actor: { type: 'SYSTEM' }, record: { authorized_scope: 'plan' } }).ok, false);
  current = transitionOneMove(current, { to_status: 'AUTHORIZED', as_of_at: '2026-07-20T05:00:00.000Z', actor: { type: 'HUMAN', tenant_id: 'tenant_synthetic', actor_ref: 'human_synthetic' }, record: { authorized_scope: 'plan' } }).one_move;
  assert.equal(transitionOneMove(current, { to_status: 'IN_EXECUTION', as_of_at: '2026-07-20T06:00:00.000Z', actor: { type: 'HUMAN' } }).ok, true);
});

test('rejection, partial execution, completion, open window and supersession preserve distinct states', () => {
  const created = createOneMove({ candidate: candidate('paths'), tenant_id: 'tenant_synthetic', business_id: 'business_synthetic', profile_id: 'profile_synthetic', as_of_at: '2026-07-20T00:00:00.000Z' }).one_move;
  const proposed = transitionOneMove(created, { to_status: 'PROPOSED', as_of_at: '2026-07-20T01:00:00.000Z', actor: { type: 'SYSTEM' } }).one_move;
  assert.equal(transitionOneMove(proposed, { to_status: 'REJECTED', as_of_at: '2026-07-20T02:00:00.000Z', actor: { type: 'HUMAN' }, record: { reason_code: 'NOT_ALIGNED' } }).one_move.status, 'REJECTED');
  let move = transitionOneMove(proposed, { to_status: 'ACCEPTED', as_of_at: '2026-07-20T02:00:00.000Z', actor: { type: 'HUMAN' } }).one_move;
  move = transitionOneMove(move, { to_status: 'AUTHORIZED', as_of_at: '2026-07-20T03:00:00.000Z', actor: { type: 'HUMAN', tenant_id: 'tenant_synthetic', actor_ref: 'human' }, record: { authorized_scope: 'plan' } }).one_move;
  move = transitionOneMove(move, { to_status: 'IN_EXECUTION', as_of_at: '2026-07-20T04:00:00.000Z', actor: { type: 'HUMAN' } }).one_move;
  move = transitionOneMove(move, { to_status: 'PARTIALLY_EXECUTED', as_of_at: '2026-07-20T05:00:00.000Z', actor: { type: 'HUMAN' } }).one_move;
  move = transitionOneMove(move, { to_status: 'COMPLETED', as_of_at: '2026-07-20T06:00:00.000Z', actor: { type: 'HUMAN' } }).one_move;
  move = transitionOneMove(move, { to_status: 'OUTCOME_WINDOW_OPEN', as_of_at: '2026-07-20T07:00:00.000Z', actor: { type: 'SYSTEM' } }).one_move;
  assert.equal(move.status, 'OUTCOME_WINDOW_OPEN');
});
