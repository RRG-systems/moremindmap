import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assembleRecruitingContext,
  buildRecruitingProviderRequest,
  generateRecruitingIntelligence,
  validateRecruitingIntelligence,
} from '../src/lib/recruitingV1/intelligence.js';

function context() {
  return assembleRecruitingContext({
    membership: { membership_id: 'membership_synthetic', enterprise_id: 'enterprise_synthetic' },
    invitation: { candidate_id: 'candidate_synthetic', bos_profile_id: 'mm-20990101-recru001' },
    managerBos: { evidence: { bos_recruiter_1: { dimension: 'velocity', band: 'high' } } },
    recruitBos: { evidence: { bos_recruit_1: { dimension: 'fidelity', band: 'high' } } },
    recruitBa: null,
    managerEvidence: [{ evidence_id: 'manager_evidence_1', type: 'CONVERSATION', claim: 'Needs reliable database follow-up.', source: 'Synthetic note', source_date: '2026-08-05' }],
    opportunity: { items: [
      { opportunity_evidence_id: 'opportunity_supported_1', category: 'COACHING_AND_TRAINING', scope: 'LOCAL_LEADER_PRIMARY', statement: 'Weekly database lab.', status: 'SUPPORTED', source: 'Synthetic operating record', source_date: '2026-08-05' },
      { opportunity_evidence_id: 'opportunity_unknown_1', category: 'LEAD_OPPORTUNITY', scope: 'LOCAL_LEADER_PRIMARY', statement: 'Lead volume is unknown.', status: 'NON_PROMISE', source: 'Synthetic operating record', source_date: '2026-08-05' },
    ] },
  });
}

function output(angleCount = 0) {
  const authenticAngles = Array.from({ length: angleCount }, (_, index) => ({
    title: `Supported synthetic angle ${index + 1}`,
    recruit_need: 'A reliable database conversion rhythm.',
    current_reality: 'Follow-up is inconsistent.',
    locally_supported_help: 'A current local database lab.',
    rationale: 'Connects a stated need to local operating evidence.',
    validating_question: 'What would this need to prove?',
    uncertainty: 'Seat availability remains unknown.',
    recruit_evidence_ids: ['manager_evidence_1'],
    opportunity_evidence_ids: ['opportunity_supported_1'],
  }));
  return {
    understand_this_recruit: { summary: 'A deliberate operator seeking reliable execution.', important_realities: ['Evidence matters before commitment.'] },
    bilateral_communication: { advantage: 'The manager creates clarity.', recruiter_watchout: 'Speed may feel like pressure.', adaptation: 'Sequence one supported mechanism at a time.' },
    authentic_angles: authenticAngles,
    withheld_angles: ['Company-provided leads remain withheld.'],
    success_environment: { natural_success_patterns: ['Deliberate systems builder.'], supportive_conditions: ['Clear ownership.'], likely_frictions: ['Unsupported promises.'] },
    missing_evidence: ['Current coaching capacity.'],
    meeting_plan: { start_here: 'Start with the stated operating problem.', learn: ['What breaks first?'], listen_for: ['Process versus capacity.'], your_watchout: 'Do not outrun the evidence.', supported_paths_if_confirmed: ['Database coaching.'], do_not_assume: 'Do not imply leads.', next_step_if_fit_is_real: 'Inspect the operating rhythm.' },
  };
}

test('zero to three distinct supported angles are valid, including a no-fit/no-angle outcome', () => {
  for (let count = 0; count <= 3; count += 1) assert.equal(validateRecruitingIntelligence(output(count), context()), true);
  assert.throws(() => validateRecruitingIntelligence(output(4), context()), /ANGLE_COUNT_INVALID/);
});

test('unsupported local evidence, scores, scripts, and manipulation language are rejected', () => {
  const unsupported = output(1);
  unsupported.authentic_angles[0].opportunity_evidence_ids = ['opportunity_unknown_1'];
  assert.throws(() => validateRecruitingIntelligence(unsupported, context()), /OPPORTUNITY_EVIDENCE_SCOPE_DENIED/);
  const scored = output(0);
  scored.understand_this_recruit.summary = 'Compatibility score: 91';
  assert.throws(() => validateRecruitingIntelligence(scored, context()), /MANIPULATION_LANGUAGE_DENIED/);
  const scripted = output(0);
  scripted.meeting_plan.start_here = 'Use this personality script to close them.';
  assert.throws(() => validateRecruitingIntelligence(scripted, context()), /MANIPULATION_LANGUAGE_DENIED/);
});

test('frontier request is de-identified, bounded, strict-schema, store false, and has no web tools', () => {
  const packet = context();
  const request = buildRecruitingProviderRequest(packet);
  assert.equal(request.store, false);
  assert.equal(request.background, false);
  assert.equal(request.max_output_tokens, 12000);
  assert.equal(request.tools, undefined);
  assert.equal(request.text.format.strict, true);
  assert.equal(JSON.stringify(packet).includes('mm-20990101-recru001'), false);
  assert.equal(packet.truth_classes.recruit_reality.business_missing, true);
});

test('provider responsibility is narrative only and raw payloads are not persisted', async () => {
  const packet = context();
  let observedRequest;
  const projection = await generateRecruitingIntelligence({
    context: packet,
    provider: async (request) => {
      observedRequest = request;
      return { output: output(2), receipt: { model: 'synthetic-frontier', usage: { total_tokens: 123 } } };
    },
  });
  assert.equal(observedRequest.store, false);
  assert.equal(projection.output.authentic_angles.length, 2);
  assert.equal(projection.provider_receipt.raw_request_persisted, false);
  assert.equal(projection.provider_receipt.raw_response_persisted, false);
  assert.match(projection.projection_hash, /^[a-f0-9]{64}$/);
});

test('first-generation provider failure remains fail-closed', async () => {
  await assert.rejects(generateRecruitingIntelligence({ context: context(), provider: async () => { throw new Error('synthetic provider unavailable'); } }), /synthetic provider unavailable/);
});
