import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyRecruitingState, InMemoryRecruitingStore } from '../src/lib/recruitingV1/store.js';
import { RecruitingV1Service, createSyntheticNotificationTransport } from '../src/lib/recruitingV1/service.js';
import { MANAGER_CHALLENGE_TTL_MS } from '../src/lib/recruitingV1/contracts.js';

const MEMBERSHIP_A = {
  membership_id: 'membership_a', manager_subject_id: 'manager_a', enterprise_id: 'enterprise_a',
  manager_profile_id: 'mm-20990101-manag001', manager_name: 'Synthetic Manager A',
  manager_email: 'manager.a@example.test', enterprise_name: 'Synthetic Enterprise A', status: 'ACTIVE', synthetic_only: true,
};
const MEMBERSHIP_B = {
  membership_id: 'membership_b', manager_subject_id: 'manager_b', enterprise_id: 'enterprise_b',
  manager_profile_id: 'mm-20990101-manag002', manager_name: 'Synthetic Manager B',
  manager_email: 'manager.b@example.test', enterprise_name: 'Synthetic Enterprise B', status: 'ACTIVE', synthetic_only: true,
};

function harness() {
  let now = new Date('2026-08-05T12:00:00.000Z');
  const store = new InMemoryRecruitingStore(createEmptyRecruitingState([MEMBERSHIP_A, MEMBERSHIP_B]));
  const service = new RecruitingV1Service({ store, now: () => new Date(now), transport: createSyntheticNotificationTransport() });
  return { service, store, advance(ms) { now = new Date(now.getTime() + ms); }, setNow(value) { now = new Date(value); } };
}

async function managerSession(service, profileId = MEMBERSHIP_A.manager_profile_id) {
  const requested = await service.requestManagerVerification(profileId);
  const verified = await service.verifyManager(requested.verification_token);
  return verified.session_token;
}

async function invite(service, sessionToken, index = 1) {
  return service.createInvitation(sessionToken, {
    recruit_name: `Synthetic Recruit ${index}`,
    recruit_email: `recruit.${index}@example.test`,
    purpose: 'Synthetic-only governed recruiting evaluation.',
  }, `invite-${index}`);
}

test('manager verification delivery does not consume the credential and the 15-minute single-use boundary fails closed', async () => {
  const { service, store, advance } = harness();
  const requested = await service.requestManagerVerification(MEMBERSHIP_A.manager_profile_id);
  await service.deliverOutbox(requested.outbox_id);
  const beforeVerification = await store.read();
  const challenge = beforeVerification.manager_challenges[Object.keys(beforeVerification.manager_challenges)[0]];
  assert.equal(challenge.consumed_at, null);

  advance(MANAGER_CHALLENGE_TTL_MS - 1);
  const verified = await service.verifyManager(requested.verification_token);
  assert.equal(verified.membership.membership_id, MEMBERSHIP_A.membership_id);
  await assert.rejects(service.verifyManager(requested.verification_token), /RECRUITING_MANAGER_CHALLENGE_INVALID/);

  const expiring = await service.requestManagerVerification(MEMBERSHIP_A.manager_profile_id);
  advance(MANAGER_CHALLENGE_TTL_MS);
  await assert.rejects(service.verifyManager(expiring.verification_token), /RECRUITING_MANAGER_CHALLENGE_INVALID/);
});

test('five-slot entitlement is atomic, explicit-period scoped, and resets at a new authoritative period', async () => {
  const { service, setNow } = harness();
  let session = await managerSession(service);
  const issued = [];
  for (let index = 1; index <= 5; index += 1) issued.push(await invite(service, session, index));
  assert.equal((await service.inspectManager(session)).entitlement.remaining, 0);
  await assert.rejects(invite(service, session, 6), /RECRUITING_INVITATION_ALLOWANCE_EXHAUSTED/);
  const replay = await service.createInvitation(session, {
    recruit_name: 'Synthetic Recruit 1', recruit_email: 'recruit.1@example.test', purpose: 'Ignored duplicate.',
  }, 'invite-1');
  assert.equal(replay.idempotent, true);
  assert.equal(replay.invitation.invitation_id, issued[0].invitation.invitation_id);
  setNow('2026-09-01T00:00:01.000Z');
  session = await managerSession(service);
  assert.equal((await service.inspectManager(session)).entitlement.remaining, 5);
});

test('expiry, resend, superseded-token replay, pre-acceptance refunds, and irreversible acceptance follow founder policy', async () => {
  const { service, advance } = harness();
  let session = await managerSession(service);
  const first = await invite(service, session, 1);
  const oldToken = first.invitation_token;
  advance(8 * 24 * 60 * 60 * 1000);
  await assert.rejects(service.invitationPreview(oldToken), /RECRUITING_INVITATION_TOKEN_INVALID/);
  session = await managerSession(service);
  assert.equal((await service.inspectManager(session)).entitlement.remaining, 5);

  const resent = await service.resendInvitation(session, first.invitation.invitation_id);
  assert.equal(resent.invitation.resend_count, 1);
  assert.equal(resent.entitlement.remaining, 4);
  await assert.rejects(service.invitationPreview(oldToken), /RECRUITING_INVITATION_TOKEN_INVALID/);
  assert.equal((await service.invitationPreview(resent.invitation_token)).invitation_id, first.invitation.invitation_id);

  const accepted = await service.acceptInvitation(resent.invitation_token, { accepted: true, version: 'recruiting_v1_consent_2026_08' });
  assert.equal(accepted.invitation.state, 'ACCEPTED');
  await assert.rejects(service.acceptInvitation(resent.invitation_token, { accepted: true, version: 'recruiting_v1_consent_2026_08' }), /RECRUITING_INVITATION_TOKEN_INVALID/);
  await assert.rejects(service.revokeInvitation(session, first.invitation.invitation_id), /REQUIRES_REVIEW/);
  assert.equal((await service.inspectManager(session)).entitlement.consumed, 1);
});

test('terminal delivery failure releases a reservation and resend reacquires exactly one slot', async () => {
  const { service, store } = harness();
  const session = await managerSession(service);
  const created = await invite(service, session, 1);
  await service.recordDelivery(created.outbox_id, { success: false, receipt: 'synthetic-terminal-failure' });
  assert.equal((await service.inspectManager(session)).entitlement.remaining, 5);
  const resent = await service.resendInvitation(session, created.invitation.invitation_id);
  assert.equal(resent.entitlement.reserved, 1);
  assert.equal(resent.entitlement.remaining, 4);
  await service.deliverPendingOutbox();
  const snapshot = await store.read();
  const invitationOutbox = Object.values(snapshot.outbox).filter((item) => item.kind === 'RECRUIT_INVITATION');
  assert.equal(JSON.stringify(snapshot.outbox).includes(created.invitation_token), false);
  assert.equal(invitationOutbox.every((item) => !Object.hasOwn(item.payload, 'invitation_token') && typeof item.token_capsule === 'string'), true);
  assert.equal(invitationOutbox.at(-1).recipient, 'recruit.1@example.test');
  assert.equal(invitationOutbox.at(-1).state, 'DELIVERED');
});

test('manager sessions rotate, CSRF proofs are one-time, and scope blocks another manager and enterprise', async () => {
  const { service } = harness();
  const sessionA = await managerSession(service, MEMBERSHIP_A.manager_profile_id);
  const csrf = await service.issueManagerCsrf(sessionA);
  assert.deepEqual(await service.consumeManagerCsrf(sessionA, csrf), { consumed: true });
  await assert.rejects(service.consumeManagerCsrf(sessionA, csrf), /RECRUITING_CSRF_INVALID/);
  const rotated = await service.rotateManagerSession(sessionA);
  await assert.rejects(service.inspectManager(sessionA), /RECRUITING_MANAGER_SESSION_REQUIRED/);
  assert.equal((await service.inspectManager(rotated.session_token)).membership.membership_id, MEMBERSHIP_A.membership_id);

  const created = await invite(service, rotated.session_token, 1);
  const sessionB = await managerSession(service, MEMBERSHIP_B.manager_profile_id);
  await assert.rejects(service.resendInvitation(sessionB, created.invitation.invitation_id), /RECRUITING_INVITATION_SCOPE_DENIED/);
  await assert.rejects(service.candidateContext(sessionB, created.invitation.candidate_id), /RECRUITING_CANDIDATE_SCOPE_DENIED/);
});

test('BOS and BA readiness project only through an accepted relationship and verified vault receipt', async () => {
  const { service, store } = harness();
  const session = await managerSession(service);
  const created = await invite(service, session, 1);
  const accepted = await service.acceptInvitation(created.invitation_token, { accepted: true, version: 'recruiting_v1_consent_2026_08' });
  await assert.rejects(service.bindBosProfile(created.invitation.invitation_id, 'mm-20990101-recru001', { verified: false }), /VERIFIED_BOS_VAULT/);
  const bos = await service.bindBosProfile(created.invitation.invitation_id, 'mm-20990101-recru001', { verified: true });
  assert.equal(bos.readiness_state, 'BOS_READY');
  assert.equal((await service.inspectInviteSession(accepted.invite_session_token)).relationship.bos_profile_id, 'mm-20990101-recru001');
  assert.equal((await service.projectBaState(created.invitation.invitation_id, { assessment_id: 'ba-synthetic-001', state: 'BA_INTAKE_SAVED' })).ba_readiness, 'BA_INTAKE_SAVED');
  assert.equal((await service.projectBaState(created.invitation.invitation_id, { assessment_id: 'ba-synthetic-001', state: 'BA_IN_PROGRESS' })).ba_readiness, 'BA_IN_PROGRESS');
  assert.equal((await service.projectBaState(created.invitation.invitation_id, {
    assessment_id: 'ba-synthetic-001',
    state: 'BA_INTELLIGENCE_READY',
    canonical_receipt: {
      contract: 'recruiting_canonical_new_ba_ready_receipt_v1',
      profile_id: 'mm-20990101-recru001',
      assessment_id: 'ba-synthetic-001',
      realization_id: 'new-ba:mm-20990101-recru001:ba-synthetic-001:fixture',
      realization_sha256: 'a'.repeat(64),
      artifact_sha256: 'b'.repeat(64),
      completeness: 'PASS',
      customer_projection_completeness: 'COMPLETE',
      retrieval_path: 'current_fast_path',
    },
  })).ba_readiness, 'BA_INTELLIGENCE_READY');
  const snapshot = await store.read();
  assert.equal(snapshot.inbox_by_membership[MEMBERSHIP_A.membership_id].some((item) => item.kind === 'BOS_READY'), true);
  assert.equal(snapshot.inbox_by_membership[MEMBERSHIP_A.membership_id].some((item) => item.kind === 'BA_INTELLIGENCE_READY'), true);
  assert.equal(Object.values(snapshot.outbox).some((item) => item.kind === 'MANAGER_BA_INTELLIGENCE_READY' && item.recipient === MEMBERSHIP_A.manager_email), true);
});

test('manager evidence stays separate, marks an accepted projection stale, and export metadata is candidate scoped', async () => {
  const { service, store } = harness();
  const session = await managerSession(service);
  const created = await invite(service, session, 1);
  await service.acceptInvitation(created.invitation_token, { accepted: true, version: 'recruiting_v1_consent_2026_08' });
  await service.bindBosProfile(created.invitation.invitation_id, 'mm-20990101-recru001', { verified: true });
  await service.saveIntelligence(session, created.invitation.candidate_id, { projection_hash: 'synthetic-projection', output: { authentic_angles: [] } });
  const evidence = await service.addEvidence(session, created.invitation.candidate_id, {
    type: 'OBSERVATION', claim: 'Synthetic contradictory observation.', source: 'Synthetic review note', source_date: '2026-08-05',
  });
  assert.equal(evidence.truth_class, 'MANAGER_SUPPLIED_EVIDENCE');
  assert.equal(evidence.canonical_recruit_truth_mutated, false);
  assert.equal((await service.candidateContext(session, created.invitation.candidate_id)).intelligence.stale, true);
  const exported = await service.recordExport(session, created.invitation.candidate_id, 'meeting', false);
  assert.equal(exported.mode, 'meeting');
  assert.equal(exported.details_included, false);
  const snapshot = await store.read();
  assert.equal(snapshot.audit.some((item) => item.event_type === 'RECRUITING_EXPORT_RECORDED'), true);
});

test('Analyze Existing Recruit fails closed without exact-scope authority', async () => {
  const { service } = harness();
  const session = await managerSession(service);
  assert.deepEqual((await service.home(session)).existing_recruit, {
    available: false,
    code: 'EXACT_SCOPE_CONSENT_AUTHORITY_REQUIRED',
    safe_action: 'INVITE_EXISTING_AGENT',
  });
});
