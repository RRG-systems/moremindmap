import test from 'node:test'; import assert from 'node:assert/strict';
import { MISSION_002_FIXTURES, SYNTHETIC_IDS, SYNTHETIC_NOW, syntheticProvenance, canonicalJson } from '../src/lib/intelligenceFabric/index.js';
import { projectBusinessAssessmentSnapshot } from '../src/lib/intelligenceFabric/bootstrap/businessAssessmentBootstrap.js';

const node = (current, source_type = 'deterministic_normalized') => ({ current, previous: null, trend: 'baseline', reason_for_change: 'initial assessment snapshot', evidence_sources: ['evidence_synthetic_snapshot'], last_updated: SYNTHETIC_NOW, confidence: .6, provenance: { source_type } });
const snapshot = () => ({
  contract_metadata: { contract_name: 'business_engine_contract', contract_version: 'business-engine-contract-v1', snapshot_mode: true, compatibility_mode: 'ba_snapshot_v1', customer_facing_model_names_exposed: false, generated_at: SYNTHETIC_NOW, source_assessment_id: 'assessment_synthetic_001' },
  identity: { profile_id: SYNTHETIC_IDS.profile, assessment_id: 'assessment_synthetic_001' }, vertical_context: { vertical_id: 'real_estate' },
  current_business_reality: node({ annual_production: { value: 100, unit: 'synthetic_units' }, meaningful_conversations: 12 }),
  behavioral_modifier: node({ pattern_code: 'SYNTHETIC_RELATIONSHIP_LED' }, 'canonical_fused_intelligence'),
  business_model_alignment: node({ alignment_code: 'SYNTHETIC_PARTIAL' }, 'domain_intelligence'),
  primary_constraint: node({ constraint_code: 'SYNTHETIC_FOLLOW_UP' }, 'canonical_fused_intelligence'),
  potential_business_future: node({ predicted: true }), one_move: node({ recommendation: true }), truth_rail: { presentation: true },
});
const input = (patch = {}) => ({ contract: snapshot(), tenant_id: SYNTHETIC_IDS.tenant, profile_id: SYNTHETIC_IDS.profile,
  business_id: SYNTHETIC_IDS.business, subscription_id: SYNTHETIC_IDS.subscription,
  source_event_id: 'evt_synthetic_bootstrap', evidence_ids: ['evidence_synthetic_snapshot'], provenance: syntheticProvenance,
  vertical_operating_policy: MISSION_002_FIXTURES.vertical_operating_policy, consent_record_ids: [], ...patch });

test('synthetic BA snapshot projects reproducibly into validated current-state objects', () => {
  const a = projectBusinessAssessmentSnapshot(input()), b = projectBusinessAssessmentSnapshot(input());
  assert.equal(a.ok, true, JSON.stringify(a.errors)); assert.equal(a.projection_hash, b.projection_hash);
  assert.equal(canonicalJson(a.objects), canonicalJson(b.objects));
  assert.equal(a.objects.business_engine_state.state_version, 1);
  assert.equal(a.objects.business_engine_state.previous_state_version_id, null);
});

test('behavior, alignment, and constraint interpretations remain beliefs rather than measured state', () => {
  const result = projectBusinessAssessmentSnapshot(input()); const state = result.objects.business_engine_state;
  assert.equal(state.behavioral_reality.current, null); assert.equal(state.business_model_alignment.current, null);
  assert.equal(state.constraint_reality.current, null);
  assert.ok(result.objects.belief_state.beliefs.some((x) => x.claim_type === 'CONSTRAINT_HYPOTHESIS'));
});

test('futures, recommendations, intent, and presentation fields are excluded with reason codes', () => {
  const result = projectBusinessAssessmentSnapshot(input());
  assert.ok(result.unsupported_fields.some((x) => x.path === 'potential_business_future' && x.reason === 'FUTURE_EXCLUDED'));
  assert.ok(result.unsupported_fields.some((x) => x.path === 'one_move' && x.reason === 'RECOMMENDATION_EXCLUDED'));
  assert.ok(result.unsupported_fields.some((x) => x.path === 'truth_rail' && x.reason === 'PRESENTATION_EXCLUDED'));
  assert.equal('future_probability' in result.objects.business_engine_state, false);
  assert.equal('recommended_intervention' in result.objects.business_engine_state, false);
});

test('missing required metrics produce explicit EvidenceGaps and multidimensional confidence', () => {
  const contract = snapshot(); contract.current_business_reality = node({ meaningful_conversations: 12 });
  const result = projectBusinessAssessmentSnapshot(input({ contract }));
  assert.ok(result.objects.evidence_gaps.length > 0);
  assert.equal(result.objects.confidence_state.future_confidence, 'NOT_EVALUATED');
  assert.equal('master_confidence' in result.objects.confidence_state, false);
});

test('unsupported fields are reported rather than silently projected', () => {
  const contract = snapshot(); contract.unmapped_synthetic_domain = { value: 1 };
  const result = projectBusinessAssessmentSnapshot(input({ contract }));
  assert.ok(result.unsupported_fields.some((x) => x.path === 'unmapped_synthetic_domain' && x.reason === 'NO_POLICY_MAPPING'));
  assert.equal(result.objects.explanation_trace.human_review_required, true);
});

test('invalid contract metadata and missing identity scope fail closed', () => {
  const contract = snapshot(); contract.contract_metadata.contract_version = 'unknown';
  assert.equal(projectBusinessAssessmentSnapshot(input({ contract })).status, 'INVALID_INPUT');
  assert.equal(projectBusinessAssessmentSnapshot(input({ business_id: null })).status, 'INVALID_INPUT');
});
