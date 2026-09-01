import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createRecruitingGuV1DemoRuntime } from '../api/engine/recruitingGuV1/demoRuntime.js';
import { createRecruitingGuV1RealRuntime } from '../api/engine/recruitingGuV1/realRuntime.js';
import { createEmptyRecruitingState, InMemoryRecruitingStore } from '../src/lib/recruitingV1/store.js';
import { RECRUITING_GU_V1_SESSION_CONTRACT, visibleConversationForRoom } from '../src/lib/recruitingGuV1/session.js';
import { RECRUITING_GU_EXPERIMENT_2_VERSION } from '../src/lib/recruitingGuV1/experiment2Contract.js';
import { RecruitingV1Service, createSyntheticNotificationTransport } from '../src/lib/recruitingV1/service.js';

function fakeFrontierTransport({ messages, schemaName }) {
  if (schemaName === 'more_recruiting_gu_v1_plan_proposal') {
    return Promise.resolve({
      parsed: {
        title: 'A bounded first month together',
        summary: 'Darren and Jordan will test one support rhythm, keep ownership explicit, and review what changed before adding scope.',
        commitments: [
          { owner: 'Darren', commitment: 'Hold one weekly opportunity-and-capacity review.', timing: 'For four weeks', intendedOutcome: 'Make the next support decision from visible evidence.' },
          { owner: 'Jordan', commitment: 'Bring the current opportunity list and name where coordination consumed selling time.', timing: 'Before each review', intendedOutcome: 'Separate reported workload from observed constraints.' },
        ],
        unresolved: ['The economics of any additional role remain unproven.'],
      },
      receipt: { modelReturned: 'openai/gpt-5.6-luna', providerReturned: 'OpenAI', latencyMs: 41, store: false },
    });
  }
  const payload = JSON.parse(messages[1].content);
  if (schemaName === 'more_recruiting_gu_v1_experiment_2_coach_move') {
    const scenarioHours = payload.relevantSharedSession?.scenarioAssumptions?.releasedHours;
    return Promise.resolve({
      parsed: {
        version: RECRUITING_GU_EXPERIMENT_2_VERSION,
        insight: scenarioHours ? `${scenarioHours} governed scenario hours remain an assumption.` : 'Jordan may protect trust by keeping important work close.',
        explanation: 'That can preserve quality, but it may also keep the business dependent on one person.',
        selfDiscoveryQuestion: 'Where do you see this helping Jordan, and where does it start to cost them?',
        visual: { materiallyHelps: true, semanticIdea: scenarioHours ? 'Show the governed scenario assumption without treating it as fact.' : 'Show the person and the supported tradeoff without claiming business cause.' },
      },
      receipt: { modelReturned: 'openai/gpt-5.6-luna', providerReturned: 'OpenAI', latencyMs: 29, store: false },
    });
  }
  const purpose = payload.currentHumanPurpose;
  const scenarioHours = payload.sharedSession?.scenarioAssumptions?.releasedHours;
  const firstObject = payload.governedReality.objects[0];
  const typeByKind = { PERSON: 'PERSON', TIME_SERIES: 'LINE_CHART', METRICS: 'METRIC_STRIP', COMPARISON: 'COMPARISON', BUSINESS_TWIN: 'PLAIN_LANGUAGE', RELATIONSHIP: 'RELATIONSHIP', FUTURES: 'FIVE_FUTURES', SCENARIO: 'SCENARIO', EVIDENCE_GAP: 'EVIDENCE_GAP', INTERVENTION: 'DECISION', FUNNEL: 'FUNNEL' };
  return Promise.resolve({
    parsed: {
      planVersion: payload.planVersion,
      stateBinding: payload.exactStateBinding,
      purpose: { humanWords: purpose, interpretedPurpose: purpose, meetingNeed: 'See the governed reality together.', materiallyChanged: false },
      guidance: { eyebrow: 'CURRENT READ', headline: scenarioHours ? `${scenarioHours} governed scenario hours remain an assumption.` : 'The evidence supports a visible, revisable working view.', summary: 'MORE selected one governed representation and kept missingness visible.', nextCue: 'Test the view together.', whyThisEnvironment: 'A visual comparison is useful for this purpose.' },
      hypotheses: [],
      blocks: [{ blockId: 'block-governed-read', type: typeByKind[firstObject.kind] || 'PLAIN_LANGUAGE', title: 'See the governed meaning', subtitle: 'The visual supports the coaching thought without creating a new conclusion.', objectIds: [firstObject.id], evidenceIds: firstObject.sourceIds?.slice(0, 1) || [], emphasis: 'PRIMARY', reason: 'The coach determined that a visual would materially help.' }],
      interactions: ['SHOW_EVIDENCE', 'CHANGE_PURPOSE'],
      completion: { recommendation: 'CONTINUE', ready: false, summary: 'The current view is useful but not a decision.', nextStep: 'Continue the human conversation.' },
    },
    receipt: { modelReturned: 'openai/gpt-5.6-luna', providerReturned: 'OpenAI', latencyMs: 37, store: false },
  });
}

test('GU V1 keeps one revision-bound session across authored rooms, frontier recomposition, plan revision, and inert second offer', async () => {
  const store = new InMemoryRecruitingStore(createEmptyRecruitingState());
  const runtime = createRecruitingGuV1DemoRuntime({ store, frontierTransport: fakeFrontierTransport, now: () => new Date('2026-08-28T12:00:00.000Z') });
  const home = await runtime.home();
  assert.equal(home.manager.entitlement_mode, 'unlimited');
  assert.equal(home.candidates.length, 1);
  assert.equal(home.synthetic_only, true);

  let opened = await runtime.open();
  assert.equal(opened.session.current_room, 'HOME');
  assert.equal(opened.authored_surfaces.bos.surface_packets.length, 15);
  assert.ok(opened.authored_surfaces.ba.destinations);
  const sessionId = opened.session.session_id;

  let result = await runtime.mutate(sessionId, 'CHANGE_ROOM', { room: 'YOU', expected_revision: opened.session.revision });
  assert.equal(result.session.current_room, 'YOU');
  result = await runtime.mutate(sessionId, 'CHAT', { message: 'What are this person’s biggest sales superpowers?', actor: 'MANAGER', expected_revision: result.session.revision });
  assert.equal(result.session.current_projection, null);
  assert.equal(result.session.current_coach_move.move.insight, 'Jordan may protect trust by keeping important work close.');
  result = await runtime.mutate(sessionId, 'COMPILE_GU', { coach_move_id: result.coach_move_id, expected_revision: result.session.revision });
  assert.equal(result.session.current_projection.room, 'YOU');
  assert.equal(result.session.current_projection.plan.blocks[0].type, 'PERSON');
  assert.equal(result.session.conversation.length, 2);

  await assert.rejects(
    () => runtime.mutate(sessionId, 'CHANGE_ROOM', { room: 'YOUR_BUSINESS', expected_revision: 1 }),
    /RECRUITING_GU_V1_STALE_SESSION_REFUSED/,
  );

  result = await runtime.mutate(sessionId, 'CHANGE_ROOM', { room: 'YOUR_BUSINESS', expected_revision: result.session.revision });
  result = await runtime.mutate(sessionId, 'CHAT', { message: 'What direction is this business heading now?', actor: 'INVITEE', expected_revision: result.session.revision });
  result = await runtime.mutate(sessionId, 'COMPILE_GU', { coach_move_id: result.coach_move_id, expected_revision: result.session.revision });
  assert.equal(result.session.current_projection.room, 'YOUR_BUSINESS');
  assert.equal(result.session.conversation.length, 4);
  assert.equal(result.session.conversation[2].actor, 'INVITEE');

  result = await runtime.mutate(sessionId, 'CHANGE_ROOM', { room: 'PLAN', expected_revision: result.session.revision });
  result = await runtime.mutate(sessionId, 'CHAT', { message: 'I will hold one weekly review and Jordan will bring the opportunity list for four weeks.', actor: 'MANAGER', expected_revision: result.session.revision });
  assert.equal(result.session.status, 'PLAN_PROPOSED');
  assert.equal(result.session.proposals.length, 1);
  assert.equal(result.session.proposals[0].proposal.commitments.length, 2);

  result = await runtime.mutate(sessionId, 'PLAN_DECISION', { decision: 'ADJUST', expected_revision: result.session.revision });
  assert.equal(result.session.status, 'OPEN');
  result = await runtime.mutate(sessionId, 'CHAT', { message: 'Adjust it so the review is thirty minutes and no hiring promise is implied.', actor: 'MANAGER', expected_revision: result.session.revision });
  assert.equal(result.session.proposals.length, 2);
  assert.equal(result.session.proposals[0].status, 'SUPERSEDED');
  assert.equal(result.session.proposals[1].supersedes_proposal_id, result.session.proposals[0].proposal_id);

  result = await runtime.mutate(sessionId, 'PLAN_DECISION', { decision: 'NOT_NOW', expected_revision: result.session.revision });
  assert.equal(result.session.status, 'SECOND_OFFER');
  result = await runtime.mutate(sessionId, 'SECOND_OFFER_DECISION', { decision: 'STAY_CONNECTED', expected_revision: result.session.revision });
  assert.equal(result.session.status, 'COMPLETED');
  assert.equal(result.session.effect_receipts.length, 1);
  assert.equal(result.session.effect_receipts[0].one_time_sponsor_payment, 'SIMULATED');
  assert.equal(result.session.effect_receipts[0].external_mutation, false);
  assert.equal(result.session.invariants.canonical_mutation, false);
  assert.equal(result.session.invariants.recruiting_v1_mutation, false);
});

test('GU V1 synthetic reset removes only the synthetic shared session', async () => {
  const store = new InMemoryRecruitingStore(createEmptyRecruitingState());
  const runtime = createRecruitingGuV1DemoRuntime({ store, frontierTransport: fakeFrontierTransport });
  await runtime.open();
  assert.equal((await runtime.home()).active_session_id !== null, true);
  const receipt = await runtime.reset('SYNTHETIC');
  assert.deepEqual(receipt, { reset: true, subject: 'SYNTHETIC', external_mutation: false, canonical_mutation: false });
  assert.equal((await runtime.home()).active_session_id, null);
});

test('synthetic HOME exercises invitee and MORE-ID entrances without creating external authority', async () => {
  const runtime = createRecruitingGuV1DemoRuntime({ frontierTransport: fakeFrontierTransport });
  const home = await runtime.home({ standard: true });
  assert.equal(home.manager.entitlement.mode, '5_per_month');
  assert.equal(home.manager.entitlement.limit, 5);
  assert.equal(home.manager.capabilities.darren_synthetic_demo, false);
  assert.equal((await runtime.openCandidate(home.candidates[0].candidate_id)).session.subject_binding.name, 'Jordan Lee');
  const request = await runtime.requestMoreId('mm-20990101-member01');
  assert.equal(request.request.status, 'SYNTHETIC_OWNER_APPROVAL_REQUIRED');
  assert.equal(request.request.external_mutation, false);
  await assert.rejects(() => runtime.openCandidate('candidate-outside-scope'), /RECRUITING_GU_V1_CANDIDATE_SCOPE_DENIED/u);
});

test('GU V1 contract exposes four rooms and stale-write refusal', () => {
  assert.deepEqual(RECRUITING_GU_V1_SESSION_CONTRACT.rooms, ['HOME', 'YOU', 'YOUR_BUSINESS', 'PLAN']);
  assert.equal(RECRUITING_GU_V1_SESSION_CONTRACT.stale_write_policy, 'REFUSE');
});

test('conversation rail is room-focused and exposes duplicate-safe Enter and Shift+Enter behavior', () => {
  const source = readFileSync(new URL('../src/recruitingGuV1/RecruitingGuV1App.jsx', import.meta.url), 'utf8');
  assert.equal(source.includes('is speaking'), false);
  assert.equal(source.includes('className="gu-actor"'), false);
  assert.match(source, /visibleConversationForRoom\(session, room\)/u);
  assert.match(source, /event\.key !== 'Enter' \|\| event\.shiftKey/u);
  assert.match(source, /event\.currentTarget\.form\?\.requestSubmit\(\)/u);
  assert.match(source, /submissionLocked\.current/u);
  assert.match(source, /Enter to send · Shift\+Enter for a new line/u);
  assert.match(source, /room !== 'PLAN'/u);
});

test('visible conversation resets between rooms while preserving the underlying shared session', () => {
  const session = {
    conversation: [
      { turn_id: 'turn-0001', actor: 'MANAGER', room: 'YOU', text: 'A person question.' },
      { turn_id: 'turn-0002', actor: 'MORE', room: 'YOU', text: 'A person coaching move.' },
      { turn_id: 'turn-0003', actor: 'MANAGER', room: 'YOUR_BUSINESS', text: 'A business question.' },
      { turn_id: 'turn-0004', actor: 'MORE', room: 'YOUR_BUSINESS', text: 'A business coaching move.' },
      { turn_id: 'turn-0005', actor: 'MANAGER', room: 'PLAN', text: 'A proposed commitment.' },
    ],
  };
  assert.deepEqual(visibleConversationForRoom(session, 'YOU').map((turn) => turn.turn_id), ['turn-0001', 'turn-0002']);
  assert.deepEqual(visibleConversationForRoom(session, 'YOUR_BUSINESS').map((turn) => turn.turn_id), ['turn-0003', 'turn-0004']);
  assert.deepEqual(visibleConversationForRoom(session, 'PLAN').map((turn) => turn.turn_id), ['turn-0005']);
  assert.equal(session.conversation.length, 5);
});

test('frontier may reuse a revision-bound scenario number as a governed assumption', async () => {
  const runtime = createRecruitingGuV1DemoRuntime({ frontierTransport: fakeFrontierTransport });
  let result = await runtime.open();
  const sessionId = result.session.session_id;
  result = await runtime.mutate(sessionId, 'CHANGE_ROOM', { room: 'YOUR_BUSINESS', expected_revision: result.session.revision });
  result = await runtime.mutate(sessionId, 'SCENARIO_CHANGE', { values: { releasedHours: 9 }, expected_revision: result.session.revision });
  result = await runtime.mutate(sessionId, 'CHAT', { message: 'Show what the governed changed assumption means.', actor: 'MANAGER', expected_revision: result.session.revision });
  result = await runtime.mutate(sessionId, 'COMPILE_GU', { coach_move_id: result.coach_move_id, expected_revision: result.session.revision });
  assert.match(result.session.current_projection.plan.guidance.headline, /^9 governed scenario hours/u);
});

test('MORE-ID creates no consultation authority until the profile owner explicitly approves', async () => {
  const membership = {
    membership_id: 'membership_standard', manager_subject_id: 'manager_standard', enterprise_id: 'enterprise_standard',
    manager_profile_id: 'mm-20990101-std00001', manager_name: 'Standard Manager', manager_email: 'standard@example.test',
    enterprise_name: 'Standard Realty', status: 'ACTIVE', setup_state: 'COMPLETE', entitlement_mode: '5_per_month', synthetic_only: true,
  };
  const store = new InMemoryRecruitingStore(createEmptyRecruitingState([membership]));
  const service = new RecruitingV1Service({ store, transport: createSyntheticNotificationTransport() });
  const requested = await service.requestManagerVerification(membership.manager_profile_id);
  const managerToken = (await service.verifyManager(requested.verification_token)).session_token;
  const ownerProfileId = 'mm-20990101-owner001';
  const redis = {
    async get(key) {
      if (key === `vault:profile:${ownerProfileId}`) return JSON.stringify({ profile_id: ownerProfileId, person_name: 'Profile Owner', email: 'owner@example.test', canonical_profile_json: { profile_id: ownerProfileId } });
      return null;
    },
  };
  const runtime = createRecruitingGuV1RealRuntime({
    env: { OPENROUTER_API_KEY: 'not-used-in-this-test' }, service, redis, frontierTransport: fakeFrontierTransport,
  });
  const pending = await runtime.requestMoreId(managerToken, ownerProfileId);
  assert.equal(pending.request.status, 'PENDING');
  assert.equal(pending.request.profile_id_is_authority, false);
  assert.equal(Object.keys((await store.read()).consultation_relationships).length, 0);
  assert.equal(JSON.stringify(pending).includes('owner@example.test'), false);

  const state = await store.read();
  const outbox = state.outbox[state.consultation_requests[pending.request.request_id].outbox_id];
  const approvalToken = service.tokenWrapper.unwrap(outbox.token_capsule);
  const preview = await runtime.approvalPreview(approvalToken);
  assert.equal(preview.profile_id_is_authority, false);
  assert.equal(preview.consent_controls_read_access_only, true);
  const approved = await runtime.approveMoreId(approvalToken, 'APPROVE');
  assert.equal(approved.approved, true);
  assert.ok(approved.request.relationship_id);
  const finalState = await store.read();
  assert.equal(finalState.consultation_relationships[approved.request.relationship_id].consent_state, 'OWNER_APPROVED_MORE_ID_CONSULTATION');
  assert.equal(finalState.consultation_relationships[approved.request.relationship_id].canonical_write_authority, false);
  await assert.rejects(() => runtime.approveMoreId(approvalToken, 'APPROVE'), /RECRUITING_GU_V1_OWNER_APPROVAL_INVALID/);
});
