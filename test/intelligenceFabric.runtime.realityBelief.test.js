import test from 'node:test'; import assert from 'node:assert/strict';
import { MISSION_002_FIXTURES, SYNTHETIC_IDS, SYNTHETIC_NOW, syntheticProvenance } from '../src/lib/intelligenceFabric/index.js';
import { runRealityEngine } from '../src/lib/intelligenceFabric/runtime/realityEngine.js';
import { rankEvidenceGaps, updateBeliefState } from '../src/lib/intelligenceFabric/runtime/beliefUpdater.js';

const realityInput = (patch = {}) => ({ tenant_id: SYNTHETIC_IDS.tenant, profile_id: SYNTHETIC_IDS.profile, business_id: SYNTHETIC_IDS.business,
  subscription_id: SYNTHETIC_IDS.subscription, as_of_at: '2026-01-22T12:00:00.000Z',
  evidence_ledger: MISSION_002_FIXTURES.weekly_real_estate_evidence_ledger,
  vertical_operating_policy: MISSION_002_FIXTURES.vertical_operating_policy,
  market_context_graph: MISSION_002_FIXTURES.market_regime,
  authority_conflict_graph: MISSION_002_FIXTURES.authority_conflict,
  belief_ids: ['belief_synthetic_followup'], primary_constraint_belief_id: 'belief_synthetic_followup',
  source_event_ids: ['evt_source_synthetic_reality'], provenance: syntheticProvenance, ...patch });

test('Reality Engine emits current state, version, gaps, confidence, and safe trace without futures', () => {
  const result = runRealityEngine(realityInput()); assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.business_engine_state.current_operating_state.current.meaningful_conversations.value, 12);
  assert.equal('future_probability' in result.business_engine_state, false);
  assert.equal(result.confidence_state.future_confidence, 'NOT_EVALUATED');
  assert.equal('master_confidence' in result.confidence_state, false);
  assert.equal('transcript' in result.explanation_trace, false);
});

test('sparse evidence remains visible as gaps and lowers completeness', () => {
  const ledger = { ...MISSION_002_FIXTURES.weekly_real_estate_evidence_ledger, evidence_entries: [] };
  const result = runRealityEngine(realityInput({ evidence_ledger: ledger })); assert.equal(result.ok, true);
  assert.ok(result.evidence_gaps.length >= MISSION_002_FIXTURES.vertical_operating_policy.required_weekly_metrics.length);
  assert.equal(result.confidence_state.evidence_completeness, 0);
});

test('unresolved authority conflict triggers human review and remains referenced', () => {
  const result = runRealityEngine(realityInput());
  assert.equal(result.explanation_trace.human_review_required, true);
  assert.ok(result.business_engine_state.conflict_ids.includes('conflict_synthetic_001'));
});

test('corrected evidence wins current ledger view and preserves source history', () => {
  const result = runRealityEngine(realityInput({ evidence_ledger: MISSION_002_FIXTURES.corrected_kpi }));
  assert.equal(result.ok, true); assert.equal(result.business_engine_state.current_operating_state.current.meaningful_conversations.value, 13);
  assert.ok(MISSION_002_FIXTURES.corrected_kpi.evidence_entries.length > 1);
});

test('expired market context creates a stale-context gap', () => {
  const result = runRealityEngine(realityInput({ as_of_at: '2026-02-01T12:00:00.000Z' }));
  assert.ok(result.evidence_gaps.some((x) => x.gap_type === 'STALE_MARKET_CONTEXT'));
  assert.equal(result.confidence_state.market_context_confidence, .2);
});

test('unchanged state receives explicit non-change reason', () => {
  const first = runRealityEngine(realityInput({ authority_conflict_graph: { conflicts: [] } }));
  const prior = { ...first.business_engine_state_version, state_snapshot: first.business_engine_state };
  const second = runRealityEngine(realityInput({ prior_state_version: prior, authority_conflict_graph: { conflicts: [] } }));
  assert.equal(second.ok, true); assert.equal(second.business_engine_state.current_operating_state.reason_for_non_change, 'PROJECTION_UNCHANGED');
  assert.ok(second.explanation_trace.non_change_reasons.includes('PROJECTION_UNCHANGED'));
});

test('belief update strengthens, weakens, leaves unchanged, and suspends explicitly', () => {
  const reality = runRealityEngine(realityInput({ authority_conflict_graph: { conflicts: [] } }));
  const base = { tenant_id: SYNTHETIC_IDS.tenant, profile_id: SYNTHETIC_IDS.profile, subscription_id: SYNTHETIC_IDS.subscription,
    business_engine_state: reality.business_engine_state, as_of_at: realityInput().as_of_at, provenance: syntheticProvenance,
    source_event_ids: ['evt_belief_update'], prior_belief_state: MISSION_002_FIXTURES.belief_support_and_contradiction, ranked_gaps: reality.evidence_gaps };
  const support = updateBeliefState({ ...base, observations: [{ belief_id: 'belief_synthetic_followup', evidence_id: 'evidence_support_new', direction: 'SUPPORT', weight: .1 }] });
  assert.equal(support.ok, true); assert.ok(support.belief_state.beliefs[0].probability > .65);
  const weaken = updateBeliefState({ ...base, observations: [{ belief_id: 'belief_synthetic_followup', evidence_id: 'evidence_counter_new', direction: 'CONTRADICT', weight: .1 }] });
  assert.ok(weaken.belief_state.beliefs[0].probability < .65);
  const unchanged = updateBeliefState({ ...base, observations: [] }); assert.equal(unchanged.belief_state.beliefs[0].non_change_reason, 'NO_QUALIFYING_EVIDENCE');
  const suspended = updateBeliefState({ ...base, observations: [], conflict_ids: ['conflict_synthetic_001'], suspend_on_conflict: true });
  assert.equal(suspended.belief_state.beliefs[0].status, 'SUSPENDED');
});

test('EvidenceGap ranking is deterministic, privacy-aware, and excludes declined gaps', () => {
  const gaps = [
    { evidence_gap_id: 'gap_b', priority: 'HIGH', current_state_impact: 'HIGH', expected_confidence_gain: .2, privacy_burden: 'HIGH', collection_cost: 'LOW', status: 'OPEN' },
    { evidence_gap_id: 'gap_a', priority: 'HIGH', current_state_impact: 'HIGH', expected_confidence_gain: .2, privacy_burden: 'LOW', collection_cost: 'LOW', status: 'OPEN' },
    { evidence_gap_id: 'gap_declined', priority: 'BLOCKING', status: 'DECLINED' },
  ];
  const ranked = rankEvidenceGaps(gaps); assert.deepEqual(ranked.map((x) => x.evidence_gap_id), ['gap_a', 'gap_b']);
  assert.deepEqual(ranked.map((x) => x.evidence_gap_id), rankEvidenceGaps([...gaps].reverse()).map((x) => x.evidence_gap_id));
});
