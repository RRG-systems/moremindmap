import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AMBER_PROFILE_ID,
  normalizeGovernedAssessmentRecord,
  resolveBundledBosAuthority,
} from '../api/engine/newBaProductionReadinessV1/canonicalReader.js';
import { classifyNewBaCompatibility } from '../api/engine/newBaProductionReadinessV1/compatibility.js';
import { classifyBaEvidenceSufficiency } from '../api/engine/newBaProductionReadinessV1/evidenceSufficiency.js';
import { buildGovernedRealProfileWbmInput, createRealProfileGenerationContext } from '../api/engine/newBaProductionReadinessV1/realProfileGeneration.js';
import { createRedisNewBaBackgroundResponseStore } from '../api/engine/newBaProductionReadinessV1/backgroundResponseStore.js';
import { sha256Stable, sha256Text } from '../api/engine/newBaProductionReadinessV1/stable.js';
import { authorizeNewBosRead } from '../api/engine/newBosProductionReadinessV1/config.js';

function elevenAnswerRecord({ profileId = 'MM-20260817-SUFFICIENCY1', assessmentId = 'ba-20260817-aabbccdd', status = 'complete' } = {}) {
  const answers = Object.fromEntries(Array.from({ length: 12 }, (_, index) => {
    const key = `q${index + 1}`;
    return [key, key === 'q11' ? '' : `Governed business evidence for ${key}`];
  }));
  return {
    owner_profile_id: profileId,
    assessment_id: assessmentId,
    status,
    version: 'business_assessment_v1_intake',
    assessment_type: 'real_estate_team',
    created_at: '2026-08-17T00:00:00.000Z',
    updated_at: '2026-08-17T00:01:00.000Z',
    inputs: { answers },
    output: { prohibited: 'legacy-generated-output' },
  };
}

test('11-of-12 evidence with unanswered q11 passes as compatible explicit missingness, never implicit N/A', () => {
  const businessEvidence = normalizeGovernedAssessmentRecord(elevenAnswerRecord(), 'MM-20260817-SUFFICIENCY1');
  assert.equal(businessEvidence.evidence_sufficiency.status, 'PASS');
  assert.equal(businessEvidence.evidence_sufficiency.compatibility_class, 'B');
  assert.deepEqual(businessEvidence.evidence_sufficiency.unanswered_questions, ['q11']);
  assert.deepEqual(businessEvidence.evidence_sufficiency.not_applicable_questions, []);
  assert.equal(businessEvidence.evidence_sufficiency.localized_consequences[0].state, 'UNKNOWN_UNANSWERED');
  assert.match(businessEvidence.evidence_sufficiency.localized_consequences[0].customer_safe_missing_evidence, /team structure, ownership, and capacity is not yet established/iu);
  assert.equal(Object.hasOwn(businessEvidence.answers, 'q11'), false);
  assert.equal(JSON.stringify(businessEvidence).includes('legacy-generated-output'), false);
});

test('historical intake_saved state is eligible when governed evidence is sufficient', () => {
  const businessEvidence = normalizeGovernedAssessmentRecord(elevenAnswerRecord({
    profileId: 'MM-20260817-SUFFICIENCY2',
    assessmentId: 'ba-20260817-bbccddee',
    status: 'intake_saved',
  }), 'MM-20260817-SUFFICIENCY2');
  assert.equal(businessEvidence.status, 'intake_saved');
  assert.equal(businessEvidence.evidence_sufficiency.status, 'PASS');
  assert.equal(businessEvidence.evidence_sufficiency.automatic_rebuild, true);
});

test('full evidence custody hash remains backward-compatible with the pre-sufficiency accepted shape', () => {
  const record = elevenAnswerRecord({ profileId: 'MM-20260817-SUFFICIENCY3', assessmentId: 'ba-20260817-ccddeeff' });
  record.inputs.answers.q11 = 'Governed business evidence for q11';
  const businessEvidence = normalizeGovernedAssessmentRecord(record, 'MM-20260817-SUFFICIENCY3');
  const preSufficiencyAcceptedShape = {
    profile_id: 'MM-20260817-SUFFICIENCY3',
    assessment_id: 'ba-20260817-ccddeeff',
    status: 'complete',
    version: 'business_assessment_v1_intake',
    assessment_type: 'real_estate_team',
    created_at: '2026-08-17T00:00:00.000Z',
    updated_at: '2026-08-17T00:01:00.000Z',
    submitted_at: null,
    completed_at: null,
    answers: Object.fromEntries(Object.entries(record.inputs.answers)),
    answer_sha256: Object.fromEntries(Object.entries(record.inputs.answers).map(([key, value]) => [key, sha256Text(value)])),
    read_only: true,
    excluded_fields: ['output', 'business_intelligence_draft', 'briefing', 'five_futures_v1', 'one_move_v1', 'profile_context', 'presentation'],
  };
  assert.equal(businessEvidence.evidence_sha256, sha256Stable(preSufficiencyAcceptedShape));
  assert.equal(businessEvidence.evidence_sufficiency.compatibility_class, 'A');
});

test('genuinely insufficient evidence fails closed when goal, constraint, and scale missions are unsupported', () => {
  const answers = { q3: 'A relationship asset exists.', q8: 'Some operating systems exist.' };
  const answerSha256 = Object.fromEntries(Object.entries(answers).map(([key, value]) => [key, sha256Text(value)]));
  const result = classifyBaEvidenceSufficiency({ answers, answerSha256 });
  assert.equal(result.status, 'FAIL');
  assert.equal(result.compatibility_class, 'C');
  assert.equal(result.automatic_rebuild, false);
  assert.deepEqual(result.failed_missions, ['GOAL_ANCHOR', 'CONSTRAINT_ANCHOR', 'SCALING_CAPACITY_ANCHOR']);
});

test('not-applicable requires explicit governed evidence and is never inferred from a blank answer', () => {
  const record = elevenAnswerRecord();
  const answers = Object.fromEntries(Object.entries(record.inputs.answers).filter(([, value]) => value));
  const answerSha256 = Object.fromEntries(Object.entries(answers).map(([key, value]) => [key, sha256Text(value)]));
  const blank = classifyBaEvidenceSufficiency({ answers, answerSha256 });
  const unsupportedNa = classifyBaEvidenceSufficiency({ answers, answerSha256, explicit_question_states: { q11: { state: 'NOT_APPLICABLE', reason: 'No team yet', evidence_refs: [] } } });
  const governedNa = classifyBaEvidenceSufficiency({ answers, answerSha256, explicit_question_states: { q11: { state: 'NOT_APPLICABLE', reason: 'Customer explicitly reported no team structure', evidence_refs: ['assessment:q11-explicit-state'] } } });
  assert.deepEqual(blank.unanswered_questions, ['q11']);
  assert.deepEqual(unsupportedNa.unanswered_questions, ['q11']);
  assert.deepEqual(governedNa.unanswered_questions, []);
  assert.deepEqual(governedNa.not_applicable_questions, ['q11']);
});

test('WBM input carries only governed answers and localizes unanswered q11 as missing team evidence', () => {
  const record = elevenAnswerRecord({ profileId: AMBER_PROFILE_ID, assessmentId: 'ba-20260817-ddeeffaa' });
  const answers = Object.fromEntries(Object.entries(record.inputs.answers).filter(([, value]) => value));
  const answerSha256 = Object.fromEntries(Object.entries(answers).map(([key, value]) => [key, sha256Text(value)]));
  const evidenceSufficiency = classifyBaEvidenceSufficiency({ answers, answerSha256 });
  const source = {
    profile_id: AMBER_PROFILE_ID,
    assessment_id: record.assessment_id,
    business_evidence: {
      profile_id: AMBER_PROFILE_ID,
      assessment_id: record.assessment_id,
      version: record.version,
      assessment_type: record.assessment_type,
      created_at: record.created_at,
      updated_at: record.updated_at,
      answers,
      answer_sha256: answerSha256,
      evidence_sufficiency: evidenceSufficiency,
    },
    bos_authority: resolveBundledBosAuthority(AMBER_PROFILE_ID),
  };
  const input = buildGovernedRealProfileWbmInput({ source, requestedAt: '2026-08-17T00:02:00.000Z' });
  assert.equal(input.governed_business_evidence.length, 11);
  assert.equal(input.assessment_identity.completion_state, 'COMPLETE');
  assert.equal(input.assessment_identity.evidence_sufficiency_state, 'EVIDENCE_SUFFICIENT_WITH_MISSINGNESS');
  assert.equal(input.missing_evidence.some((item) => item.missing_id === 'ME-Q11' && item.domain === 'team'), true);
  assert.equal(input.governed_business_evidence.some((item) => item.source_ref.endsWith('.q11')), false);
  const left = createRealProfileGenerationContext({ source, displayName: 'Amber' });
  const right = createRealProfileGenerationContext({ source, displayName: 'Amber' });
  assert.equal(left.providerPreflight.request_shape_sha256, right.providerPreflight.request_shape_sha256);
  assert.equal(left.input.requested_at, record.updated_at);
});

test('compatibility consumes deterministic sufficiency instead of a 12-answer count', () => {
  const record = elevenAnswerRecord({ profileId: AMBER_PROFILE_ID, assessmentId: 'ba-20260817-eeffaabb' });
  const answers = Object.fromEntries(Object.entries(record.inputs.answers).filter(([, value]) => value));
  const answerSha256 = Object.fromEntries(Object.entries(answers).map(([key, value]) => [key, sha256Text(value)]));
  const evidenceSufficiency = classifyBaEvidenceSufficiency({ answers, answerSha256 });
  const source = {
    profile_id: AMBER_PROFILE_ID,
    assessment_id: record.assessment_id,
    business_evidence: { answers, answer_sha256: answerSha256, evidence_sufficiency: evidenceSufficiency, read_only: true },
    bos_authority: resolveBundledBosAuthority(AMBER_PROFILE_ID),
  };
  const compatibility = classifyNewBaCompatibility(source);
  assert.equal(compatibility.class, 'B');
  assert.equal(compatibility.automatic_rebuild, true);
  assert.equal(compatibility.preserve_missingness, true);
});

test('generalized BOS customer activation uses exact identity and canonical compatibility rather than a manual allowlist', () => {
  const config = { staged: true, customerActive: true, canaryEnabled: false, allowedProfileIds: [], accessToken: '' };
  assert.equal(authorizeNewBosRead({ config, profileId: 'mm-20260729-pny8899b' }), 'MM-20260729-PNY8899B');
  assert.throws(() => authorizeNewBosRead({ config, profileId: 'invalid-profile' }), /profile_id_invalid/u);
});

test('BA background response checkpoints bind provider identity to exact profile, generation, stage, and request', async () => {
  const memory = new Map();
  const redis = {
    get: async (key) => memory.get(key) || null,
    set: async (key, value) => { memory.set(key, value); return 'OK'; },
  };
  const store = createRedisNewBaBackgroundResponseStore({ redis, namespace: 'nonprod:new-ba:production-canary:v1' });
  const generationIdentitySha256 = 'a'.repeat(64);
  const event = {
    provider_response_id: 'resp_governed_opaque_id',
    scientific_request_sha256: 'b'.repeat(64),
    status: 'in_progress',
    poll_count: 2,
    observed_at: '2026-08-18T00:00:00.000Z',
  };
  await store.save({ profileId: 'MM-20260817-SUFFICIENCY1', generationIdentitySha256, stage: 'one_move_v2', event });
  const loaded = await store.load({ profileId: 'MM-20260817-SUFFICIENCY1', generationIdentitySha256, stage: 'one_move_v2' });
  assert.equal(loaded.provider_response_id, 'resp_governed_opaque_id');
  assert.equal(loaded.scientific_request_sha256, 'b'.repeat(64));
  await assert.rejects(
    store.save({ profileId: 'MM-20260817-SUFFICIENCY1', generationIdentitySha256, stage: 'one_move_v2', event: { ...event, provider_response_id: 'resp_cross_request' } }),
    /checkpoint_conflict/u,
  );
  assert.equal(await store.load({ profileId: 'MM-20260817-OTHER', generationIdentitySha256, stage: 'one_move_v2' }), null);
});
