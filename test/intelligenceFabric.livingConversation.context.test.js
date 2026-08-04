import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assembleLivingConversationContextV1,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/livingConversation/contextAssembler.js';

const scope = Object.freeze({
  tenant_id: 'tenant_context',
  profile_id: 'mm-20260804-synthetic2',
  business_id: 'business_context',
  subscriber_id: 'subscriber_context',
});
const exactScopeHash = 'e'.repeat(64);

function contextInput(profileId = scope.profile_id) {
  return {
    exactScope: { ...scope, profile_id: profileId },
    expectedScopeHash: exactScopeHash,
    dossier: {
      profile_id: profileId,
      email: 'must-not-leave-server@example.invalid',
      raw_answers: { private: 'must-not-leave-server' },
      canonical_profile_json: {
        profile_id: profileId,
        rescoring_gpt: {
          render_ready: {
            profile_dna: 'Relational operator who decides quickly under pressure.',
          },
          ranked_dimensions: [{
            dimension: 'Adaptability',
            display_score: 84,
            confidence: 0.78,
          }],
        },
      },
    },
    businessEngineContract: {
      identity: { profile_id: profileId },
      contract_metadata: { snapshot_mode: true, generated_at: '2026-08-04T10:00:00.000Z' },
      current_business_reality: { current: { annual_production: { value: 12, unit: 'units' } }, evidence_sources: ['ba_fact_1'], confidence: 0.8 },
      business_model_alignment: { current: 'RELATIONSHIP_LED', evidence_sources: ['ba_inference_1'], confidence: 0.7 },
      primary_constraint: { current: 'FOLLOW_THROUGH', evidence_sources: ['ba_inference_2'], confidence: 0.65 },
      behavioral_modifier: { current: 'FAST_STARTER', evidence_sources: ['bos_dimension_1'], confidence: 0.7 },
      truth_boundaries: { current: { known: ['annual_production'], inferred: ['primary_constraint'] }, evidence_sources: [] },
    },
    snapshot: {
      exact_scope_hash: exactScopeHash,
      durable_runtime: {
        business_engine_state: {
          tenant_id: scope.tenant_id,
          profile_id: profileId,
          business_id: scope.business_id,
          business_engine_state_id: 'business_state_1',
          state_version: 2,
          as_of_at: '2026-08-04T11:00:00.000Z',
          current_operating_state: { current: { leads: 9 }, previous: { leads: 4 } },
          trend_summary: 'IMPROVING',
          primary_constraint_id: 'constraint_follow_through',
          evidence_ids: ['evidence_1'],
        },
        business_engine_state_version: {
          tenant_id: scope.tenant_id,
          profile_id: profileId,
          business_id: scope.business_id,
          state_version_id: 'state_version_2',
          previous_state_version_id: 'state_version_1',
          material_changes: ['leads'],
          changed_fields: ['leads'],
          unchanged_fields: [],
        },
        confidence_state: { overall: 0.72 },
        evidence_gaps: [{
          evidence_gap_id: 'gap_1',
          gap_type: 'MISSING_KPI',
          missing_data: ['conversion_rate'],
          priority: 'HIGH',
          request_reason: 'Needed to distinguish pipeline from follow-through.',
          recommended_question: 'What was your conversion rate last week?',
        }],
        explanation_trace: {
          evidence_inputs: ['evidence_1'],
          changed_outputs: ['leads'],
          unchanged_outputs: [],
          human_review_required: false,
          safe_summary: 'Lead evidence changed the current state.',
          conflicts: [],
        },
      },
      predictive_runtime: {
        future_engine: {
          future_set_version: 2,
          explanation_trace: { safe_summary: 'Five modeled paths respond to the constraint evidence.' },
          versions: [{
            stable_future_identity: 'future_1',
            slot: 'CURRENT',
            name: 'Current path',
            status: 'ACTIVE',
            description: 'Follow-through remains inconsistent.',
            probability: 0.4,
            probability_confidence: { level: 'MODERATE' },
            uncertainty_band: { low: 0.3, high: 0.5 },
            expected_consequence: 'Growth remains uneven.',
            structural_change_required: false,
            what_increases_probability: ['No operating cadence'],
            what_decreases_probability: ['Weekly inspection'],
            missing_evidence: ['conversion_rate'],
          }],
        },
        intervention_ranking: { receipt: { human_review_required: false } },
        one_move: {
          one_move_id: 'one_move_1',
          candidate_id: 'candidate_1',
          status: 'PROPOSED',
          target_constraint: 'Follow-through',
          target_future_transition: 'Current to steady growth',
          expected_probability_shift: 0.12,
          expected_business_effect: ['More inspected follow-through'],
          expected_signal_window: '14_DAYS',
          expected_outcome_window: '90_DAYS',
          confidence_dimensions: { evidence_quality: 0.7 },
          explanation_trace_ref: 'explanation_1',
        },
      },
    },
  };
}

test('assembler emits exactly eight minimized governed context classes', () => {
  const result = assembleLivingConversationContextV1(contextInput());
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.receipt.context_types, [
    'BOS_CONVERSATION_CONTEXT',
    'BUSINESS_ASSESSMENT_CONTEXT',
    'BUSINESS_ENGINE_CURRENT_STATE',
    'BUSINESS_ENGINE_HISTORY',
    'FIVE_FUTURES_CONTEXT',
    'ONE_MOVE_CONTEXT',
    'EVIDENCE_CONFIDENCE_CONTEXT',
    'TRUTH_BOUNDARIES_CONTEXT',
  ]);
  assert.equal(result.context.length, 8);
  assert.equal(result.context.every((entry) => entry.scope_match === true), true);
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /must-not-leave-server/);
  assert.doesNotMatch(serialized, /example\.invalid/);
  assert.equal(result.receipt.raw_dossier_included, false);
  assert.equal(result.receipt.raw_assessment_answers_included, false);
  assert.equal(result.receipt.transcript_included, false);
});

test('BOS remains behavioral inference and BA remains historical context', () => {
  const result = assembleLivingConversationContextV1(contextInput());
  const bos = result.context.find((entry) => entry.context_type === 'BOS_CONVERSATION_CONTEXT');
  const assessment = result.context.find((entry) => entry.context_type === 'BUSINESS_ASSESSMENT_CONTEXT');
  assert.equal(bos.value.interpretation_class, 'BEHAVIORAL_INFERENCE_NOT_BUSINESS_FACT');
  assert.equal(bos.value.ranked_dimensions[0].classification, 'INFERRED');
  assert.equal(assessment.value.assessment_is_historical_context, true);
  assert.equal(assessment.value.current_business_reality.classification, 'OBSERVED');
  assert.equal(assessment.value.primary_constraint.classification, 'INFERRED');
});

test('missing exact scope or living state fails closed', () => {
  const missingScope = contextInput();
  missingScope.exactScope = null;
  assert.equal(assembleLivingConversationContextV1(missingScope).ok, false);
  const missingState = contextInput();
  missingState.snapshot = {};
  assert.equal(assembleLivingConversationContextV1(missingState).ok, false);
  const crossedProfile = contextInput();
  crossedProfile.exactScope = { ...scope, profile_id: 'mm-20260804-attacker1' };
  assert.equal(assembleLivingConversationContextV1(crossedProfile).ok, false);
  const crossedBusinessState = contextInput();
  crossedBusinessState.snapshot.exact_scope_hash = 'f'.repeat(64);
  assert.equal(assembleLivingConversationContextV1(crossedBusinessState).ok, false);
  const sameProfileWrongBusiness = contextInput();
  sameProfileWrongBusiness.snapshot.durable_runtime.business_engine_state.business_id =
    'business_other';
  assert.equal(assembleLivingConversationContextV1(sameProfileWrongBusiness).ok, false);
});

test('aliased PII values are redacted before provider context assembly', () => {
  const input = contextInput();
  input.businessEngineContract.current_business_reality.current = {
    owner_contact_alias: 'owner@example.invalid',
    callback_number_alias: '+1 (555) 555-0199',
    safe_metric: 12,
  };
  const result = assembleLivingConversationContextV1(input);
  assert.equal(result.ok, true);
  const serialized = JSON.stringify(result.context);
  assert.doesNotMatch(serialized, /owner@example\.invalid/);
  assert.doesNotMatch(serialized, /555-0199/);
  assert.match(serialized, /safe_metric/);
});
