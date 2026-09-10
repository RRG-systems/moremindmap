import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createRecruitingGuV1DemoRuntime } from '../api/engine/recruitingGuV1/demoRuntime.js';
import { createResendRecruitingTransport } from '../api/engine/recruitingV1/resendTransport.js';
import {
  appendConversationTurn,
  changeRoom,
  createRecruitingGuSession,
  decidePlan,
  recordPlanProposal,
} from '../src/lib/recruitingGuV1/session.js';
import { RecruitingV1Service } from '../src/lib/recruitingV1/service.js';
import { createEmptyRecruitingState, InMemoryRecruitingStore } from '../src/lib/recruitingV1/store.js';
import { stableHash } from '../src/lib/recruitingV1/contracts.js';

const NOW = new Date('2026-08-31T18:00:00.000Z');

function planTransport({ messages, schemaName }) {
  if (schemaName !== 'more_recruiting_gu_v1_plan_proposal') throw new Error('PLAN_ONLY_TEST_TRANSPORT');
  const input = JSON.parse(messages[1].content);
  const request = String(input.current_request || '');
  const thirtyMinutes = /thirty minutes/iu.test(request);
  const nextTuesday = /next Tuesday/iu.test(request);
  return Promise.resolve({
    parsed: {
      title: 'A shared plan for the next month',
      summary: 'Darren and Jordan will use one clear support rhythm and review what changed before adding scope.',
      commitments: [
        {
          owner: 'Darren',
          commitment: thirtyMinutes ? 'Hold one thirty-minute opportunity and capacity review.' : 'Hold one weekly opportunity and capacity review.',
          timing: nextTuesday ? 'Starting next Tuesday for four weeks' : 'For four weeks',
          intendedOutcome: 'Make the next support decision from visible evidence.',
        },
        {
          owner: 'Jordan',
          commitment: 'Bring the current opportunity list and name where coordination consumed selling time.',
          timing: 'Before each review',
          intendedOutcome: 'Separate reported workload from observed constraints.',
        },
      ],
      unresolved: ['Any additional commercial terms remain outside this shared plan.'],
    },
    receipt: { modelReturned: 'openai/gpt-5.6-sol', providerReturned: 'OpenAI', latencyMs: 12, store: false },
  });
}

async function proposedDemo(options = {}) {
  const runtime = createRecruitingGuV1DemoRuntime({ frontierTransport: planTransport, now: () => NOW, ...options });
  let result = await runtime.open();
  const sessionId = result.session.session_id;
  result = await runtime.mutate(sessionId, 'CHANGE_ROOM', { room: 'PLAN', expected_revision: result.session.revision });
  result = await runtime.mutate(sessionId, 'CHAT', {
    message: 'I will hold one weekly review and Jordan will bring the current opportunity list for four weeks.',
    actor: 'MANAGER',
    expected_revision: result.session.revision,
  });
  return { runtime, sessionId, result };
}

test('ADJUST visibly preserves the current draft, stays in one session, and regenerates a revision', async () => {
  const { runtime, sessionId, result: proposed } = await proposedDemo();
  const original = structuredClone(proposed.session.proposals[0].proposal);
  let result = await runtime.mutate(sessionId, 'PLAN_DECISION', {
    decision: 'ADJUST',
    expected_revision: proposed.session.revision,
  });
  assert.equal(result.session.session_id, sessionId);
  assert.equal(result.session.current_room, 'PLAN');
  assert.equal(result.session.status, 'OPEN');
  assert.equal(result.session.proposals[0].status, 'ADJUSTMENT_REQUESTED');
  assert.deepEqual(result.session.proposals[0].proposal, original);

  result = await runtime.mutate(sessionId, 'CHAT', {
    message: 'Make the review thirty minutes and start next Tuesday. Keep the rest of the plan.',
    actor: 'MANAGER',
    expected_revision: result.session.revision,
  });
  assert.equal(result.session.proposals.length, 2);
  assert.equal(result.session.proposals[0].status, 'SUPERSEDED');
  assert.equal(result.session.proposals[1].status, 'CURRENT');
  assert.equal(result.session.proposals[1].supersedes_proposal_id, result.session.proposals[0].proposal_id);
  assert.match(result.session.proposals[1].proposal.commitments[0].commitment, /thirty-minute/iu);
  assert.match(result.session.proposals[1].proposal.commitments[0].timing, /next Tuesday/iu);
  assert.equal(result.session.current_room, 'PLAN');

  result = await runtime.mutate(sessionId, 'PLAN_DECISION', { decision: 'ADJUST', expected_revision: result.session.revision });
  assert.equal(result.session.proposals[1].status, 'ADJUSTMENT_REQUESTED');
  result = await runtime.mutate(sessionId, 'CHAT', {
    message: 'Keep that change and regenerate the clean shared plan.', actor: 'MANAGER', expected_revision: result.session.revision,
  });
  assert.equal(result.session.proposals.length, 3);
  assert.equal(result.session.proposals[1].status, 'SUPERSEDED');
  assert.equal(result.session.proposals[2].status, 'CURRENT');

  const source = readFileSync(new URL('../src/recruitingGuV1/RecruitingGuV1App.jsx', import.meta.url), 'utf8');
  assert.match(source, /ADJUSTING THIS SHARED PLAN/u);
  assert.match(source, /current draft is preserved below/u);
  assert.match(source, /PLAN ADJUSTMENT/u);
  assert.match(source, /commitments, conditions, or timing/u);
});

test('YES freezes one exact accepted plan and creates two idempotent test-safe email copies', async () => {
  const { runtime, sessionId, result: proposed } = await proposedDemo();
  const displayedPlan = structuredClone(proposed.session.proposals[0].proposal);
  const accepted = await runtime.mutate(sessionId, 'PLAN_DECISION', {
    decision: 'YES',
    expected_revision: proposed.session.revision,
  });
  assert.equal(accepted.session.status, 'COMPLETED');
  assert.equal(accepted.session.proposals[0].status, 'ACCEPTED');
  assert.deepEqual(accepted.session.accepted_plan_snapshot.plan, displayedPlan);
  assert.equal(accepted.session.accepted_plan_snapshot.snapshot_hash, stableHash(displayedPlan));
  assert.equal(accepted.session.agreement_delivery.status, 'DELIVERED');
  assert.deepEqual(accepted.session.agreement_delivery.recipients.map((item) => item.recipient_role).sort(), ['MANAGER', 'PERSON']);
  assert.equal(accepted.session.invariants.external_mutation, false);

  const deliveries = runtime.agreementEmailAudit();
  assert.equal(deliveries.length, 2);
  assert.equal(new Set(deliveries.map((item) => item.snapshot_hash)).size, 1);
  assert.equal(new Set(deliveries.map((item) => item.content.plan_text)).size, 1);
  assert.equal(deliveries.every((item) => item.content.subject === 'Your MORE plan is set'), true);
  assert.equal(deliveries.every((item) => /Congratulations — you and your manager agreed on the next steps\./u.test(item.content.text)), true);
  assert.equal(deliveries.every((item) => !/\b(?:recruit|recruiting|recruitee|candidate|prospect)\b/iu.test(`${item.content.subject} ${item.content.text}`)), true);

  await assert.rejects(
    () => runtime.mutate(sessionId, 'PLAN_DECISION', { decision: 'YES', expected_revision: proposed.session.revision }),
    /RECRUITING_GU_V1_STALE_SESSION_REFUSED/u,
  );
  assert.equal(runtime.agreementEmailAudit().length, 2);
  const recovered = await runtime.read(sessionId);
  assert.deepEqual(recovered.accepted_plan_snapshot, accepted.session.accepted_plan_snapshot);
});

test('delivery failure is recorded separately and cannot erase the accepted plan', async () => {
  const adapter = Object.freeze({
    synthetic: true,
    async deliver() { throw new Error('TEST_SAFE_DELIVERY_FAILURE'); },
    async retry() { throw new Error('TEST_SAFE_DELIVERY_FAILURE'); },
  });
  const { runtime, sessionId, result: proposed } = await proposedDemo({ agreementDeliveryAdapter: adapter });
  const displayedPlan = structuredClone(proposed.session.proposals[0].proposal);
  const result = await runtime.mutate(sessionId, 'PLAN_DECISION', {
    decision: 'YES', expected_revision: proposed.session.revision,
  });
  assert.equal(result.session.status, 'COMPLETED');
  assert.deepEqual(result.session.accepted_plan_snapshot.plan, displayedPlan);
  assert.equal(result.session.agreement_delivery.status, 'FAILED');
  assert.equal(result.session.agreement_delivery.recipients.every((item) => item.state === 'FAILED'), true);
  assert.equal(result.session.invariants.external_mutation, false);
  assert.deepEqual((await runtime.read(sessionId)).accepted_plan_snapshot, result.session.accepted_plan_snapshot);
});

function acceptedSessionFixture() {
  let session = createRecruitingGuSession({
    sessionId: 'gu_session_consulting_email_test',
    relationshipId: 'relationship_consulting_email_test',
    manager: {
      subject_id: 'manager_consulting_email_test',
      membership_id: 'membership_consulting_email_test',
      enterprise_id: 'enterprise_consulting_email_test',
      name: 'Morgan Manager',
      entitlement_mode: '5_per_month',
    },
    invitee: { candidate_id: 'person_consulting_email_test', name: 'Taylor Person' },
    subjectProfileId: 'mm-20990101-person01',
    syntheticOnly: false,
    now: NOW,
  });
  session = changeRoom(session, { room: 'PLAN', expectedRevision: session.revision }, NOW);
  session = appendConversationTurn(session, {
    actor: 'MANAGER', room: 'PLAN', message: 'Meet every Tuesday for four weeks.', expectedRevision: session.revision,
  }, NOW);
  session = recordPlanProposal(session, {
    basedOnRevision: session.revision,
    proposal: {
      title: 'Four-week consultation plan',
      summary: 'Morgan and Taylor agreed to use one weekly review for the next four weeks.',
      commitments: [{ owner: 'Morgan', commitment: 'Hold one weekly review.', timing: 'Every Tuesday for four weeks', intendedOutcome: 'Keep next steps visible.' }],
      unresolved: [],
    },
  }, NOW);
  return decidePlan(session, { decision: 'YES', expectedRevision: session.revision }, NOW);
}

function agreementService({ failFirstTwo = false } = {}) {
  const session = acceptedSessionFixture();
  const membership = {
    membership_id: 'membership_consulting_email_test', manager_subject_id: 'manager_consulting_email_test',
    enterprise_id: 'enterprise_consulting_email_test', manager_profile_id: 'mm-20990101-manager1',
    manager_name: 'Morgan Manager', manager_email: 'manager@example.test', enterprise_name: 'Example Consulting',
    status: 'ACTIVE', setup_state: 'COMPLETE', entitlement_mode: '5_per_month', synthetic_only: true,
  };
  const state = createEmptyRecruitingState([membership]);
  state.invitations.invitation_consulting_email_test = {
    invitation_id: 'invitation_consulting_email_test', candidate_id: 'person_consulting_email_test',
    membership_id: membership.membership_id, manager_subject_id: membership.manager_subject_id,
    enterprise_id: membership.enterprise_id, recruit_name: 'Taylor Person', recruit_email: 'person@example.test',
    state: 'ACCEPTED', accepted_at: NOW.toISOString(), token_generation: 1,
    bos_profile_id: session.subject_binding.profile_id,
    consent: { version: 'recruiting_v1_consent_2026_08', accepted_at: NOW.toISOString() },
  };
  state.consultation_relationships[session.relationship_id] = {
    relationship_id: session.relationship_id, status: 'ACTIVE',
    membership_id: membership.membership_id, manager_subject_id: membership.manager_subject_id,
    enterprise_id: membership.enterprise_id, profile_id: session.subject_binding.profile_id,
    candidate_id: session.subject_binding.candidate_id, consent_state: 'RECRUITING_INVITATION_ACCEPTED',
    canonical_write_authority: false,
  };
  state.shared_business_sessions[session.session_id] = structuredClone(session);
  const requests = [];
  let call = 0;
  const transport = createResendRecruitingTransport({
    apiKey: 'test-only-key',
    from: 'MORE <plans@example.test>',
    baseUrl: 'https://example.test',
    fetchImpl: async (_url, options) => {
      call += 1;
      requests.push({ body: JSON.parse(options.body), idempotencyKey: options.headers['idempotency-key'] });
      if (failFirstTwo && call <= 2) return { ok: false, status: 503, json: async () => ({ name: 'service_unavailable' }) };
      return { ok: true, status: 200, json: async () => ({ id: `email-${call}` }) };
    },
  });
  const store = new InMemoryRecruitingStore(state);
  return { session, store, requests, service: new RecruitingV1Service({ store, transport, now: () => NOW }) };
}

test('existing transactional outbox sends the same snapshot once per authorized recipient', async () => {
  const { session, store, requests, service } = agreementService();
  const input = { sessionId: session.session_id, acceptanceId: session.accepted_plan_snapshot.acceptance_id };
  const first = await service.deliverAgreedPlanEmails(input);
  assert.deepEqual(first.map((item) => item.state), ['DELIVERED', 'DELIVERED']);
  assert.equal(requests.length, 2);
  assert.equal(new Set(requests.map((item) => item.body.text)).size, 1);
  assert.equal(new Set(requests.map((item) => item.body.html)).size, 1);
  assert.equal(requests.every((item) => item.body.subject === 'Your MORE plan is set'), true);
  assert.equal(requests.every((item) => !/\b(?:recruit|recruiting|recruitee|candidate|prospect)\b/iu.test(`${item.body.subject} ${item.body.text}`)), true);
  assert.equal(new Set(requests.map((item) => item.idempotencyKey)).size, 2);

  const second = await service.deliverAgreedPlanEmails(input);
  assert.deepEqual(second.map((item) => item.state), ['DELIVERED', 'DELIVERED']);
  assert.equal(requests.length, 2);
  const snapshot = await store.read();
  assert.equal(Object.values(snapshot.outbox).length, 2);
  assert.equal(Object.values(snapshot.outbox).every((item) => item.payload.accepted_plan_snapshot.snapshot_hash === session.accepted_plan_snapshot.snapshot_hash), true);
});

test('email failure preserves acceptance and bounded retry keeps the same outbox identity', async () => {
  const { session, store, requests, service } = agreementService({ failFirstTwo: true });
  const acceptanceId = session.accepted_plan_snapshot.acceptance_id;
  const failed = await service.deliverAgreedPlanEmails({ sessionId: session.session_id, acceptanceId });
  assert.deepEqual(failed.map((item) => item.state), ['FAILED', 'FAILED']);
  let snapshot = await store.read();
  assert.equal(snapshot.shared_business_sessions[session.session_id].status, 'COMPLETED');
  assert.deepEqual(snapshot.shared_business_sessions[session.session_id].accepted_plan_snapshot, session.accepted_plan_snapshot);
  const personOutbox = Object.values(snapshot.outbox).find((item) => item.payload.recipient_role === 'PERSON');
  const personKey = personOutbox.outbox_id;

  await service.retryAgreedPlanEmail({ sessionId: session.session_id, acceptanceId, recipientRole: 'PERSON' });
  snapshot = await store.read();
  assert.equal(snapshot.outbox[personKey].state, 'DELIVERED');
  assert.equal(requests.length, 3);
  assert.equal(requests[0].idempotencyKey, requests[2].idempotencyKey);
  assert.deepEqual(snapshot.shared_business_sessions[session.session_id].accepted_plan_snapshot, session.accepted_plan_snapshot);
});

test('agreement delivery and retry fail closed after relationship revocation or subject rebinding', async () => {
  for (const mutation of ['revoked', 'profile', 'manager', 'consent']) {
    const { session, store, requests, service } = agreementService();
    await store.transaction((state) => {
      const invitation = state.invitations.invitation_consulting_email_test;
      if (mutation === 'revoked') state.consultation_relationships[session.relationship_id].status = 'REVOKED';
      if (mutation === 'profile') invitation.bos_profile_id = 'mm-20990101-other001';
      if (mutation === 'manager') invitation.manager_subject_id = 'another-manager';
      if (mutation === 'consent') delete invitation.consent;
      return true;
    });
    await assert.rejects(service.deliverAgreedPlanEmails({ sessionId: session.session_id, acceptanceId: session.accepted_plan_snapshot.acceptance_id }), /CONSULTING_PERSON_EMAIL_AUTHORITY_REQUIRED/u);
    assert.equal(requests.length, 0);
    assert.deepEqual((await store.read()).shared_business_sessions[session.session_id].accepted_plan_snapshot, session.accepted_plan_snapshot);
  }

  const { session, store, requests, service } = agreementService({ failFirstTwo: true });
  const acceptanceId = session.accepted_plan_snapshot.acceptance_id;
  await service.deliverAgreedPlanEmails({ sessionId: session.session_id, acceptanceId });
  await store.transaction((state) => { state.invitations.invitation_consulting_email_test.state = 'REVOKED'; return true; });
  await assert.rejects(service.retryAgreedPlanEmail({ sessionId: session.session_id, acceptanceId, recipientRole: 'PERSON' }), /CONSULTING_PERSON_EMAIL_AUTHORITY_REQUIRED/u);
  assert.equal(requests.length, 2);
  assert.equal(Object.values((await store.read()).outbox).every((item) => item.state === 'FAILED'), true);
});

test('pending agreed-plan outbox cannot send if the canonical subject changes after queueing', async () => {
  const { session, store, requests, service } = agreementService({ failFirstTwo: true });
  await service.deliverAgreedPlanEmails({ sessionId: session.session_id, acceptanceId: session.accepted_plan_snapshot.acceptance_id });
  const snapshot = await store.read();
  const pendingId = Object.values(snapshot.outbox).find((item) => item.payload.recipient_role === 'PERSON').outbox_id;
  await store.transaction((state) => {
    state.outbox[pendingId].state = 'PENDING';
    state.invitations.invitation_consulting_email_test.bos_profile_id = 'mm-20990101-other001';
    return true;
  });
  await assert.rejects(service.deliverOutbox(pendingId), /CONSULTING_PERSON_EMAIL_AUTHORITY_REQUIRED/u);
  assert.equal(requests.length, 2);
  assert.deepEqual((await store.read()).shared_business_sessions[session.session_id].accepted_plan_snapshot, session.accepted_plan_snapshot);
});
