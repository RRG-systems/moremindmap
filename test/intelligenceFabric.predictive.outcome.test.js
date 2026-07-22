import test from 'node:test';
import assert from 'node:assert/strict';
import { assessAttribution, recordExecutionEvidence, safeOutcomeSummary, validateLearningPromotion, validateOutcome } from '../src/lib/intelligenceFabric/index.js';

const execution = { tenant_id: 'tenant_synthetic', planned_action: 'synthetic plan', actual_action: 'synthetic action', start_time: '2026-07-01T00:00:00.000Z', completion_time: '2026-07-10T00:00:00.000Z', execution_quality: 1, adherence: 1 };
const base = { intervention_id: 'intervention_synthetic', tenant_id: 'tenant_synthetic', execution, as_of_at: '2026-10-02T00:00:00.000Z',
  expected_signal: { start: '2026-07-10T00:00:00.000Z' }, expected_outcome: { end: '2026-10-01T00:00:00.000Z' }, actual_outcome: { success: true },
  privacy_classification: 'TENANT_PRIVATE', consent_basis: 'SUBSCRIBER_SERVICE', requested_attribution: 'MECHANISM_CONSISTENT', confounders: [], external_shocks: [], matched_contexts: [], replicated_contexts: [], alternative_explanations: [] };

test('execution evidence is structured, scoped, and artifact content is not retained', () => {
  const result = recordExecutionEvidence({ ...execution, scope_ref: { tenant_id: 'tenant_synthetic' }, privacy_classification: 'TENANT_PRIVATE', consent_basis: 'SUBSCRIBER_SERVICE', supporting_artifacts: [{ artifact_ref: 'ref', content_hash: 'hash', raw: 'secret' }] });
  assert.equal(result.ok, true); assert.equal('raw' in result.record.supporting_artifacts[0], false);
});

test('outcome statuses distinguish incomplete, confounded, shock, open, and replication', () => {
  assert.equal(validateOutcome({ ...base, execution: { ...execution, completion_time: null, actual_action: null } }).record.validation_status, 'PENDING_EXECUTION');
  assert.equal(validateOutcome({ ...base, confounders: [{ id: 'market' }] }).record.validation_status, 'CONFOUNDED');
  assert.equal(validateOutcome({ ...base, external_shocks: [{ id: 'shock' }] }).record.validation_status, 'EXTERNAL_SHOCK');
  assert.equal(validateOutcome({ ...base, as_of_at: '2026-08-01T00:00:00.000Z', actual_outcome: null }).record.validation_status, 'AWAITING_OUTCOME');
  assert.equal(validateOutcome(base).record.validation_status, 'REPLICATION_REQUIRED');
  assert.equal(validateOutcome({ ...base, replication_count: 2 }).record.validation_status, 'VALIDATED_SUCCESS');
});

test('causal overclaim and private universal promotion fail closed', () => {
  assert.equal(assessAttribution({ requested_level: 'EXPERIMENTAL_SUPPORT' }).attribution_status, 'CAUSAL_CLAIM_NOT_AUTHORIZED');
  assert.equal(validateLearningPromotion({ outcome_ids: ['one'], contexts: ['one'], privacy_classification: 'COACH_SESSION_PRIVATE', learning_eligibility: false, requested_state: 'SUPPORTED' }).ok, false);
});

test('privacy-safe outcome summary is allowlisted', () => {
  const outcome = validateOutcome({ ...base, human_observation: 'private', supporting_artifacts: [{ raw: 'private' }] }).record;
  const summary = safeOutcomeSummary(outcome); assert.equal('human_observation' in summary, false); assert.equal('intervention_id' in summary, false);
});

test('validated failure requires complete quality execution and a closed outcome window', () => {
  assert.equal(validateOutcome({ ...base, actual_outcome: { success: false } }).record.validation_status, 'VALIDATED_FAILURE');
  assert.equal(validateOutcome({ ...base, execution: { ...execution, adherence: .5 }, actual_outcome: { success: false } }).record.validation_status, 'INCONCLUSIVE');
});

test('replicated matched contexts support but do not prove causality', () => {
  const result = assessAttribution({ requested_level: 'REPLICATED_CONTEXT_SUPPORT', replicated_contexts: [{ outcome_id: 'o1' }, { outcome_id: 'o2' }] });
  assert.equal(result.attribution_status, 'REPLICATED_CONTEXT_SUPPORT'); assert.equal(result.causal_confidence, 'LOW');
});
