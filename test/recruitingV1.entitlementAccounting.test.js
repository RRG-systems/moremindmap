import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyRecruitingState, InMemoryRecruitingStore } from '../src/lib/recruitingV1/store.js';
import { RecruitingV1Service, createSyntheticNotificationTransport } from '../src/lib/recruitingV1/service.js';

const MEMBERSHIP = {
  membership_id: 'membership_paired',
  manager_subject_id: 'manager_paired',
  enterprise_id: 'enterprise_paired',
  manager_profile_id: 'mm-20990101-paired01',
  manager_name: 'Synthetic Paired Manager',
  manager_email: 'paired.manager@example.test',
  enterprise_name: 'Synthetic Paired Enterprise',
  status: 'ACTIVE',
  synthetic_only: true,
};

function harness(initialState = createEmptyRecruitingState([MEMBERSHIP])) {
  let now = new Date('2026-08-05T12:00:00.000Z');
  const store = new InMemoryRecruitingStore(initialState);
  const service = new RecruitingV1Service({
    store,
    now: () => new Date(now),
    transport: createSyntheticNotificationTransport(),
  });
  return {
    service,
    store,
    advance(ms) { now = new Date(now.getTime() + ms); },
  };
}

async function managerSession(service) {
  const requested = await service.requestManagerVerification(MEMBERSHIP.manager_profile_id);
  return (await service.verifyManager(requested.verification_token)).session_token;
}

async function invite(service, sessionToken, index) {
  return service.createInvitation(sessionToken, {
    recruit_name: `Synthetic Recruit ${index}`,
    recruit_email: `paired.recruit.${index}@example.test`,
    purpose: 'Synthetic paired-entitlement proof.',
  }, `paired-invite-${index}`);
}

function readyReceipt(profileId, assessmentId) {
  return {
    contract: 'recruiting_canonical_new_ba_ready_receipt_v1',
    profile_id: profileId,
    assessment_id: assessmentId,
    realization_id: `new-ba:${profileId}:${assessmentId}:fixture`,
    realization_sha256: 'a'.repeat(64),
    artifact_sha256: 'b'.repeat(64),
    completeness: 'PASS',
    customer_projection_completeness: 'COMPLETE',
    retrieval_path: 'current_fast_path',
  };
}

test('five BOS plus five BA reservations are atomic, separately summarized, and replay safe', async () => {
  const { service } = harness();
  const session = await managerSession(service);
  const created = [];
  for (let index = 1; index <= 5; index += 1) created.push(await invite(service, session, index));

  const full = await service.inspectManager(session);
  assert.deepEqual(full.entitlement, full.entitlements.bos);
  assert.deepEqual(
    { used: full.entitlements.bos.used, reserved: full.entitlements.bos.reserved, consumed: full.entitlements.bos.consumed, remaining: full.entitlements.bos.remaining },
    { used: 5, reserved: 5, consumed: 0, remaining: 0 },
  );
  assert.deepEqual(
    { used: full.entitlements.ba.used, reserved: full.entitlements.ba.reserved, consumed: full.entitlements.ba.consumed, remaining: full.entitlements.ba.remaining },
    { used: 5, reserved: 5, consumed: 0, remaining: 0 },
  );
  await assert.rejects(invite(service, session, 6), /RECRUITING_INVITATION_ALLOWANCE_EXHAUSTED/);

  const replay = await service.createInvitation(session, {
    recruit_name: 'Synthetic Recruit 1',
    recruit_email: 'paired.recruit.1@example.test',
    purpose: 'An exact replay cannot debit either product again.',
  }, 'paired-invite-1');
  assert.equal(replay.idempotent, true);
  assert.equal(replay.invitation.invitation_id, created[0].invitation.invitation_id);
  assert.equal(replay.entitlements.bos.used, 5);
  assert.equal(replay.entitlements.ba.used, 5);

  const accepted = await service.acceptInvitation(created[0].invitation_token, {
    accepted: true,
    version: 'recruiting_v1_consent_2026_08',
  });
  assert.deepEqual(accepted.invitation.complimentary_access, {
    bos: 'CONSUMED',
    ba: 'RESERVED',
    same_profile_required: true,
    second_manager_invitation_required: false,
  });
  const afterAcceptance = await service.inspectManager(session);
  assert.deepEqual(
    { reserved: afterAcceptance.entitlements.bos.reserved, consumed: afterAcceptance.entitlements.bos.consumed },
    { reserved: 4, consumed: 1 },
  );
  assert.deepEqual(
    { reserved: afterAcceptance.entitlements.ba.reserved, consumed: afterAcceptance.entitlements.ba.consumed },
    { reserved: 5, consumed: 0 },
  );

  const invitationId = created[0].invitation.invitation_id;
  const bosInProgress = await service.projectBosInProgress(invitationId);
  assert.equal(bosInProgress.progress_state, 'BOS_IN_PROGRESS');
  assert.equal(bosInProgress.complimentary_access.ba, 'RESERVED');
  assert.equal((await service.inspectManager(session)).entitlements.ba.consumed, 0);
  const bosReady = await service.bindBosProfile(invitationId, 'mm-20990101-recru001', { verified: true });
  assert.equal(bosReady.complimentary_access.ba, 'RESERVED');
  assert.equal((await service.inspectManager(session)).entitlements.ba.consumed, 0);

  const firstDurableBa = await service.projectBaState(invitationId, {
    assessment_id: 'ba-synthetic-paired-001',
    state: 'BA_INTAKE_SAVED',
  });
  assert.equal(firstDurableBa.complimentary_access.ba, 'CONSUMED');
  const afterBa = await service.inspectManager(session);
  assert.deepEqual(
    { reserved: afterBa.entitlements.ba.reserved, consumed: afterBa.entitlements.ba.consumed, used: afterBa.entitlements.ba.used },
    { reserved: 4, consumed: 1, used: 5 },
  );
  await service.projectBaState(invitationId, { assessment_id: 'ba-synthetic-paired-001', state: 'BA_INTAKE_SAVED' });
  assert.equal((await service.inspectManager(session)).entitlements.ba.consumed, 1);
});

test('pre-acceptance terminal states release both products and resend reacquires one pair only', async () => {
  const { service, advance } = harness();
  let session = await managerSession(service);
  const failed = await invite(service, session, 1);
  const expired = await invite(service, session, 2);
  const revoked = await invite(service, session, 3);

  await service.recordDelivery(failed.outbox_id, { success: false, receipt: 'synthetic-terminal-failure' });
  const revokedResult = await service.revokeInvitation(session, revoked.invitation.invitation_id);
  assert.equal(revokedResult.invitation.complimentary_access.bos, 'RELEASED');
  assert.equal(revokedResult.invitation.complimentary_access.ba, 'RELEASED');
  let summary = await service.inspectManager(session);
  assert.equal(summary.entitlements.bos.used, 1);
  assert.equal(summary.entitlements.ba.used, 1);

  advance(8 * 24 * 60 * 60 * 1000);
  session = await managerSession(service);
  summary = await service.inspectManager(session);
  assert.equal(summary.entitlements.bos.used, 0);
  assert.equal(summary.entitlements.ba.used, 0);

  const resentExpired = await service.resendInvitation(session, expired.invitation.invitation_id);
  assert.equal(resentExpired.entitlements.bos.used, 1);
  assert.equal(resentExpired.entitlements.ba.used, 1);
  const resentAgain = await service.resendInvitation(session, expired.invitation.invitation_id);
  assert.equal(resentAgain.entitlements.bos.used, 1);
  assert.equal(resentAgain.entitlements.ba.used, 1);

  const resentFailed = await service.resendInvitation(session, failed.invitation.invitation_id);
  assert.equal(resentFailed.entitlements.bos.used, 2);
  assert.equal(resentFailed.entitlements.ba.used, 2);
  await assert.rejects(
    service.resendInvitation(session, revoked.invitation.invitation_id),
    /RECRUITING_INVITATION_RESEND_DENIED/,
  );
});

test('superseded invitation delivery outcomes cannot mutate the current token generation or paired reservation', async () => {
  const { service, store } = harness();
  const session = await managerSession(service);

  const staleFailure = await invite(service, session, 10);
  assert.equal((await service.claimOutbox(staleFailure.outbox_id)).deliver, true);
  const currentAfterFailureRace = await service.resendInvitation(session, staleFailure.invitation.invitation_id);
  await service.recordDelivery(staleFailure.outbox_id, { success: false, receipt: 'synthetic-stale-failure' });

  let snapshot = await store.read();
  let invitation = snapshot.invitations[staleFailure.invitation.invitation_id];
  assert.equal(snapshot.outbox[staleFailure.outbox_id].invitation_token_generation, 1);
  assert.equal(snapshot.outbox[currentAfterFailureRace.outbox_id].invitation_token_generation, 2);
  assert.equal(invitation.token_generation, 2);
  assert.equal(invitation.state, 'ISSUED');
  assert.equal(invitation.delivery_state, 'PENDING');
  assert.equal(invitation.bos_entitlement_state, 'RESERVED');
  assert.equal(invitation.ba_entitlement_state, 'RESERVED');
  assert.equal((await service.invitationPreview(currentAfterFailureRace.invitation_token)).invitation_id, invitation.invitation_id);
  assert.deepEqual(
    { bos: (await service.inspectManager(session)).entitlements.bos.used, ba: (await service.inspectManager(session)).entitlements.ba.used },
    { bos: 1, ba: 1 },
  );

  await service.recordDelivery(currentAfterFailureRace.outbox_id, { success: true, receipt: 'synthetic-current-success' });
  const currentSuccessReplay = await service.recordDelivery(currentAfterFailureRace.outbox_id, { success: true, receipt: 'ignored-replay' });
  assert.equal(currentSuccessReplay.idempotent, true);
  assert.equal((await store.read()).invitations[invitation.invitation_id].state, 'DELIVERED');

  const staleSuccess = await invite(service, session, 11);
  assert.equal((await service.claimOutbox(staleSuccess.outbox_id)).deliver, true);
  const currentAfterSuccessRace = await service.resendInvitation(session, staleSuccess.invitation.invitation_id);
  await service.recordDelivery(staleSuccess.outbox_id, { success: true, receipt: 'synthetic-stale-success' });
  const staleSuccessReplay = await service.recordDelivery(staleSuccess.outbox_id, { success: true, receipt: 'ignored-replay' });
  assert.equal(staleSuccessReplay.idempotent, true);

  snapshot = await store.read();
  invitation = snapshot.invitations[staleSuccess.invitation.invitation_id];
  assert.equal(invitation.state, 'ISSUED');
  assert.equal(invitation.delivery_state, 'PENDING');
  assert.equal((await service.invitationPreview(currentAfterSuccessRace.invitation_token)).invitation_id, invitation.invitation_id);

  await service.recordDelivery(currentAfterSuccessRace.outbox_id, { success: false, receipt: 'synthetic-current-failure' });
  invitation = (await store.read()).invitations[staleSuccess.invitation.invitation_id];
  assert.equal(invitation.state, 'DELIVERY_FAILED');
  assert.equal(invitation.bos_entitlement_state, 'RELEASED');
  assert.equal(invitation.ba_entitlement_state, 'RELEASED');

  const legacyCurrent = await invite(service, session, 12);
  await store.transaction((state) => {
    delete state.outbox[legacyCurrent.outbox_id].invitation_token_generation;
    return true;
  });
  await service.recordDelivery(legacyCurrent.outbox_id, { success: true, receipt: 'synthetic-legacy-current-success' });
  assert.equal((await store.read()).invitations[legacyCurrent.invitation.invitation_id].state, 'DELIVERED');
});

test('over-limit migrated relationships remain usable while all new paired reservations are blocked', async () => {
  const initialState = createEmptyRecruitingState([MEMBERSHIP]);
  for (let index = 1; index <= 6; index += 1) {
    initialState.invitations[`legacy_invite_${index}`] = {
      invitation_id: `legacy_invite_${index}`,
      candidate_id: `legacy_candidate_${index}`,
      membership_id: MEMBERSHIP.membership_id,
      manager_subject_id: MEMBERSHIP.manager_subject_id,
      enterprise_id: MEMBERSHIP.enterprise_id,
      recruit_name: `Legacy Recruit ${index}`,
      recruit_email: `legacy.recruit.${index}@example.test`,
      purpose: 'Migrated synthetic relationship.',
      state: 'ACCEPTED',
      readiness_state: 'CONSENTED',
      ba_readiness: 'BA_NOT_STARTED',
      delivery_state: 'DELIVERED',
      entitlement_state: 'CONSUMED',
      entitlement_period_start: '2026-08-01T00:00:00.000Z',
      entitlement_period_end: '2026-09-01T00:00:00.000Z',
      idempotency_key: `legacy-${index}`,
      token_digest: null,
      token_generation: 1,
      resend_count: 0,
      issued_at: '2026-08-01T00:00:00.000Z',
      expires_at: '2026-08-08T00:00:00.000Z',
      accepted_at: '2026-08-02T00:00:00.000Z',
      revoked_at: null,
      updated_at: '2026-08-02T00:00:00.000Z',
    };
  }
  const { service, store } = harness(initialState);
  const session = await managerSession(service);
  const migrated = await service.inspectManager(session);
  assert.deepEqual(
    { used: migrated.entitlements.bos.used, consumed: migrated.entitlements.bos.consumed, remaining: migrated.entitlements.bos.remaining },
    { used: 6, consumed: 6, remaining: 0 },
  );
  assert.deepEqual(
    { used: migrated.entitlements.ba.used, reserved: migrated.entitlements.ba.reserved, remaining: migrated.entitlements.ba.remaining },
    { used: 6, reserved: 6, remaining: 0 },
  );
  await assert.rejects(invite(service, session, 7), /RECRUITING_INVITATION_ALLOWANCE_EXHAUSTED/);

  await service.bindBosProfile('legacy_invite_1', 'mm-20990101-migr0001', { verified: true });
  await service.projectBaState('legacy_invite_1', { assessment_id: 'ba-migrated-001', state: 'BA_INTAKE_SAVED' });
  const afterContinuation = await service.inspectManager(session);
  assert.equal(afterContinuation.entitlements.bos.used, 6);
  assert.equal(afterContinuation.entitlements.ba.used, 6);
  assert.equal(afterContinuation.entitlements.ba.consumed, 1);
  assert.equal(Object.keys((await store.read()).invitations).length, 6);
});

test('manager home projects the five governed candidate progress states', async () => {
  const { service } = harness();
  const session = await managerSession(service);
  const invitations = [];
  for (let index = 1; index <= 5; index += 1) invitations.push(await invite(service, session, index));

  for (let index = 1; index < invitations.length; index += 1) {
    await service.acceptInvitation(invitations[index].invitation_token, { accepted: true, version: 'recruiting_v1_consent_2026_08' });
  }
  const bosInProgress = await service.projectBosInProgress(invitations[1].invitation.invitation_id);
  assert.equal(bosInProgress.progress_state, 'BOS_IN_PROGRESS');
  assert.equal((await service.projectBosInProgress(invitations[1].invitation.invitation_id)).progress_state, 'BOS_IN_PROGRESS');
  await service.bindBosProfile(invitations[2].invitation.invitation_id, 'mm-20990101-prog0003', { verified: true });
  await service.bindBosProfile(invitations[3].invitation.invitation_id, 'mm-20990101-prog0004', { verified: true });
  await service.projectBaState(invitations[3].invitation.invitation_id, { assessment_id: 'ba-progress-004', state: 'BA_IN_PROGRESS' });
  await service.bindBosProfile(invitations[4].invitation.invitation_id, 'mm-20990101-prog0005', { verified: true });
  await service.projectBaState(invitations[4].invitation.invitation_id, {
    assessment_id: 'ba-progress-005',
    state: 'BA_INTELLIGENCE_READY',
    canonical_receipt: readyReceipt('mm-20990101-prog0005', 'ba-progress-005'),
  });

  const byName = Object.fromEntries((await service.home(session)).candidates.map((candidate) => [candidate.recruit_name, candidate.progress_state]));
  assert.deepEqual(byName, {
    'Synthetic Recruit 1': 'INVITED',
    'Synthetic Recruit 2': 'BOS_IN_PROGRESS',
    'Synthetic Recruit 3': 'BOS_COMPLETE',
    'Synthetic Recruit 4': 'BA_IN_PROGRESS',
    'Synthetic Recruit 5': 'BOTH_COMPLETE',
  });
});
