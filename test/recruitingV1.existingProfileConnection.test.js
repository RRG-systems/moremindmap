import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyRecruitingState, InMemoryRecruitingStore } from '../src/lib/recruitingV1/store.js';
import { RecruitingV1Service, createSyntheticNotificationTransport } from '../src/lib/recruitingV1/service.js';

const PROFILE_ID = 'mm-20990101-recru001';
const OTHER_PROFILE_ID = 'mm-20990101-other001';
const RECRUIT_EMAIL = 'continuation.recruit@example.test';
const MEMBERSHIP = Object.freeze({
  membership_id: 'membership_continuation',
  manager_subject_id: 'manager_continuation',
  enterprise_id: 'enterprise_continuation',
  manager_profile_id: 'mm-20990101-manag001',
  manager_name: 'Synthetic Continuation Manager',
  manager_email: 'continuation.manager@example.test',
  enterprise_name: 'Synthetic Continuation Enterprise',
  status: 'ACTIVE',
  setup_state: 'COMPLETE',
  synthetic_only: true,
});

async function acceptedRelationship() {
  const owners = new Map([[PROFILE_ID, RECRUIT_EMAIL], [OTHER_PROFILE_ID, RECRUIT_EMAIL]]);
  const completed = new Set([PROFILE_ID, OTHER_PROFILE_ID]);
  let ownerReads = 0;
  const store = new InMemoryRecruitingStore(createEmptyRecruitingState([MEMBERSHIP]));
  const service = new RecruitingV1Service({
    store,
    now: () => new Date('2026-09-08T18:00:00.000Z'),
    transport: createSyntheticNotificationTransport(),
    profileOwnerReader: async (profileId) => {
      ownerReads += 1;
      const recipientEmail = owners.get(profileId);
      return recipientEmail ? { profile_id: profileId, recipient_email: recipientEmail } : null;
    },
    profileValidator: async (profileId) => ({ found: completed.has(profileId), profile_id: profileId }),
  });
  const managerChallenge = await service.requestManagerVerification(MEMBERSHIP.manager_profile_id);
  const manager = await service.verifyManager(managerChallenge.verification_token);
  const created = await service.createInvitation(manager.session_token, {
    recruit_name: 'Continuation Recruit',
    recruit_email: RECRUIT_EMAIL,
    purpose: 'Synthetic existing-Profile service contract proof.',
  }, 'synthetic-existing-profile-service-1');
  const accepted = await service.acceptInvitation(created.invitation_token, {
    accepted: true,
    version: 'recruiting_v1_consent_2026_08',
  });
  return {
    service,
    store,
    created,
    accepted,
    owners,
    completed,
    ownerReads: () => ownerReads,
  };
}

test('existing Profile connection checks accepted invitation authority before reading Profile ownership', async () => {
  const harness = await acceptedRelationship();
  await assert.rejects(
    harness.service.connectOwnedExistingProfile('invalid-session', { profile_id: PROFILE_ID }),
    /RECRUITING_INVITE_SESSION_REQUIRED/u,
  );
  assert.equal(harness.ownerReads(), 0);
  assert.equal(
    (await harness.service.inspectInviteSession(harness.accepted.invite_session_token)).relationship.progress_state,
    'INVITED',
  );
});

test('existing Profile connection requires canonical owner email match and a completed BOS', async () => {
  const harness = await acceptedRelationship();
  harness.owners.set(PROFILE_ID, 'different.owner@example.test');
  await assert.rejects(
    harness.service.connectOwnedExistingProfile(harness.accepted.invite_session_token, { profile_id: PROFILE_ID }),
    /RECRUITING_EXISTING_PROFILE_EMAIL_SCOPE_DENIED/u,
  );

  harness.owners.set(PROFILE_ID, RECRUIT_EMAIL);
  harness.completed.delete(PROFILE_ID);
  await assert.rejects(
    harness.service.connectOwnedExistingProfile(harness.accepted.invite_session_token, { profile_id: PROFILE_ID }),
    /RECRUITING_COMPLETED_BOS_REQUIRED/u,
  );
  assert.equal(
    (await harness.service.inspectInviteSession(harness.accepted.invite_session_token)).relationship.bos_profile_id,
    null,
  );
});

test('verified existing BOS binds once, notifies the manager, and cannot be rebound', async () => {
  const harness = await acceptedRelationship();
  const bound = await harness.service.connectOwnedExistingProfile(
    harness.accepted.invite_session_token,
    { profile_id: PROFILE_ID },
  );
  assert.equal(bound.progress_state, 'BOS_COMPLETE');
  assert.equal(bound.bos_profile_id, PROFILE_ID);
  assert.equal(
    (await harness.service.projectBosInProgress(harness.created.invitation.invitation_id, { job_id: 'bos-job-existing-profile-001' })).progress_state,
    'BOS_COMPLETE',
  );

  const replay = await harness.service.connectOwnedExistingProfile(
    harness.accepted.invite_session_token,
    { profile_id: PROFILE_ID },
  );
  assert.equal(replay.bos_profile_id, PROFILE_ID);
  await assert.rejects(
    harness.service.connectOwnedExistingProfile(
      harness.accepted.invite_session_token,
      { profile_id: OTHER_PROFILE_ID },
    ),
    /RECRUITING_BOS_PROFILE_REBIND_DENIED/u,
  );

  const snapshot = await harness.store.read();
  assert.equal(
    snapshot.audit.filter((event) => event.event_type === 'CANDIDATE_BOS_READY').length,
    1,
  );
  assert.equal(
    snapshot.inbox_by_membership[MEMBERSHIP.membership_id].filter((item) => item.kind === 'BOS_READY').length,
    1,
  );
  assert.equal(
    Object.values(snapshot.outbox).filter((item) => item.kind === 'MANAGER_BOS_READY').length,
    1,
  );
});
