import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyRecruitingState, InMemoryRecruitingStore, normalizeRecruitingState } from '../src/lib/recruitingV1/store.js';
import { RecruitingV1Service, createSyntheticNotificationTransport } from '../src/lib/recruitingV1/service.js';

const ADMIN = {
  membership_id: 'membership_admin', manager_subject_id: 'manager_admin', enterprise_id: 'enterprise_admin',
  manager_profile_id: 'mm-20990101-admin001', manager_name: 'Darren Synthetic', manager_email: 'darren@example.test',
  enterprise_name: 'MORE MindMap Enterprise', status: 'ACTIVE', setup_state: 'COMPLETE', entitlement_mode: 'unlimited',
  admin_roles: ['RECRUITING_ADMIN'], recruiting_governance: { all_enterprises: true, enterprise_ids: [] }, synthetic_only: true,
};

const STANDARD = {
  membership_id: 'membership_standard', manager_subject_id: 'manager_standard', enterprise_id: 'enterprise_standard',
  manager_profile_id: 'mm-20990101-std00001', manager_name: 'Standard Manager', manager_email: 'standard@example.test',
  enterprise_name: 'Standard Realty', status: 'ACTIVE', setup_state: 'COMPLETE', entitlement_mode: '5_per_month', synthetic_only: true,
};

function harness(memberships = [ADMIN, STANDARD]) {
  let now = new Date('2026-08-21T12:00:00.000Z');
  const store = new InMemoryRecruitingStore(createEmptyRecruitingState(memberships));
  const validProfiles = new Set(['mm-20990101-newmgr01', 'mm-20990101-prefill1']);
  const service = new RecruitingV1Service({
    store,
    now: () => new Date(now),
    transport: createSyntheticNotificationTransport(),
    profileValidator: async (profileId) => ({ found: validProfiles.has(profileId), profile_id: profileId }),
  });
  return { service, store, setNow(value) { now = new Date(value); } };
}

async function managerSession(service, profileId) {
  const requested = await service.requestManagerVerification(profileId);
  return (await service.verifyManager(requested.verification_token)).session_token;
}

async function createInvite(service, sessionToken, index) {
  return service.createInvitation(sessionToken, {
    recruit_name: `Synthetic Recruit ${index}`,
    recruit_email: `master-control-${index}@example.test`,
    purpose: 'Synthetic Master Control entitlement proof.',
  }, `master-control-${index}`);
}

test('Darren unlimited is explicit, exceeds five, and never weakens the standard five-per-month cap', async () => {
  const { service } = harness();
  const adminSession = await managerSession(service, ADMIN.manager_profile_id);
  for (let index = 1; index <= 7; index += 1) await createInvite(service, adminSession, index);
  const unlimited = (await service.inspectManager(adminSession)).entitlement;
  assert.equal(unlimited.mode, 'unlimited');
  assert.equal(unlimited.limit, null);
  assert.equal(unlimited.remaining, null);
  assert.equal(unlimited.used, 7);

  const standardSession = await managerSession(service, STANDARD.manager_profile_id);
  for (let index = 20; index < 25; index += 1) await createInvite(service, standardSession, index);
  await assert.rejects(createInvite(service, standardSession, 25), /RECRUITING_INVITATION_ALLOWANCE_EXHAUSTED/);
  assert.equal((await service.inspectManager(standardSession)).entitlement.remaining, 0);
});

test('Master Control opens to every authorized membership and exposes governance metadata only', async () => {
  const { service } = harness();
  const session = await managerSession(service, ADMIN.manager_profile_id);
  const roster = await service.masterControl(session);
  assert.equal(roster.default_view, 'ALL_AUTHORIZED_MEMBERSHIPS');
  assert.equal(roster.total, 2);
  assert.deepEqual(roster.memberships.map((membership) => membership.manager_name), ['Darren Synthetic', 'Standard Manager']);
  assert.equal(roster.memberships.find((membership) => membership.manager_name === 'Darren Synthetic').entitlement.mode, 'unlimited');
  const serialized = JSON.stringify(roster);
  for (const prohibited of ['bos_summary', 'ba_summary', 'intelligence_by_candidate', 'manager_evidence', 'recruit_email', 'authentic_angles']) {
    assert.equal(serialized.includes(prohibited), false);
  }
});

test('manager setup is single-use, resend supersedes, canonical binding activates, and Profile ID alone never authenticates', async () => {
  const { service, store } = harness();
  const adminSession = await managerSession(service, ADMIN.manager_profile_id);
  const created = await service.createManagerMembership(adminSession, {
    manager_name: 'New Manager', manager_email: 'new.manager@example.test',
    enterprise_id: 'enterprise_new', enterprise_name: 'New Enterprise',
  });
  assert.equal(created.membership.status, 'PENDING_SETUP');
  assert.equal(created.membership.entitlement.mode, '5_per_month');
  await service.managerSetupPreview(created.setup_token);

  const resent = await service.resendManagerSetup(adminSession, created.membership.membership_id);
  await assert.rejects(service.managerSetupPreview(created.setup_token), /RECRUITING_MANAGER_SETUP_TOKEN_INVALID/);
  const begun = await service.beginManagerSetup(resent.setup_token);
  await assert.rejects(service.beginManagerSetup(resent.setup_token), /RECRUITING_MANAGER_SETUP_TOKEN_INVALID/);
  await assert.rejects(service.completeManagerSetup(begun.setup_session_token, begun.csrf_token, 'mm-20990101-missing1'), /RECRUITING_MANAGER_PROFILE_NOT_FOUND/);

  const completed = await service.completeManagerSetup(begun.setup_session_token, begun.csrf_token, 'mm-20990101-newmgr01');
  assert.equal(completed.membership.status, 'ACTIVE');
  assert.equal(completed.membership.setup_state, 'COMPLETE');
  assert.equal((await service.inspectManager(completed.manager_session_token)).membership.manager_profile_id, 'mm-20990101-newmgr01');
  await assert.rejects(service.completeManagerSetup(begun.setup_session_token, begun.csrf_token, 'mm-20990101-newmgr01'), /RECRUITING_MANAGER_SETUP_SESSION_REQUIRED/);

  const snapshot = await store.read();
  assert.equal(JSON.stringify(snapshot).includes(created.setup_token), false);
  assert.equal(JSON.stringify(snapshot).includes(resent.setup_token), false);
});

test('pending corrections invalidate setup links and activation cannot bypass completed setup', async () => {
  const { service } = harness();
  const adminSession = await managerSession(service, ADMIN.manager_profile_id);
  const created = await service.createManagerMembership(adminSession, {
    manager_name: 'Pending Manager', manager_email: 'pending@example.test',
    enterprise_id: 'enterprise_pending', enterprise_name: 'Pending Enterprise', manager_profile_id: 'mm-20990101-prefill1',
  });
  const corrected = await service.updatePendingManager(adminSession, created.membership.membership_id, { manager_email: 'corrected@example.test' });
  assert.equal(corrected.membership.setup_state, 'NOT_SENT');
  await assert.rejects(service.managerSetupPreview(created.setup_token), /RECRUITING_MANAGER_SETUP_TOKEN_INVALID/);
  await service.suspendManagerMembership(adminSession, created.membership.membership_id);
  await assert.rejects(service.activateManagerMembership(adminSession, created.membership.membership_id), /RECRUITING_MANAGER_ACTIVATION_REQUIRES_COMPLETED_SETUP/);
});

test('suspend and revoke block access immediately, while completed suspended memberships may reactivate', async () => {
  const { service } = harness();
  const adminSession = await managerSession(service, ADMIN.manager_profile_id);
  const standardSession = await managerSession(service, STANDARD.manager_profile_id);
  await service.suspendManagerMembership(adminSession, STANDARD.membership_id);
  await assert.rejects(service.inspectManager(standardSession), /RECRUITING_MANAGER_SESSION_REQUIRED|RECRUITING_MANAGER_MEMBERSHIP_INACTIVE/);
  await service.activateManagerMembership(adminSession, STANDARD.membership_id);
  const restoredSession = await managerSession(service, STANDARD.manager_profile_id);
  await service.revokeManagerMembership(adminSession, STANDARD.membership_id);
  await assert.rejects(service.inspectManager(restoredSession), /RECRUITING_MANAGER_SESSION_REQUIRED|RECRUITING_MANAGER_MEMBERSHIP_INACTIVE/);
  await assert.rejects(service.activateManagerMembership(adminSession, STANDARD.membership_id), /RECRUITING_MANAGER_ACTIVATION_REQUIRES_COMPLETED_SETUP/);
});

test('admin authority and enterprise governance scope fail closed', async () => {
  const LIMITED_ADMIN = {
    ...ADMIN,
    membership_id: 'membership_limited_admin', manager_subject_id: 'manager_limited_admin',
    manager_profile_id: 'mm-20990101-limit001', manager_email: 'limited@example.test',
    recruiting_governance: { all_enterprises: false, enterprise_ids: ['enterprise_admin'] },
  };
  const { service } = harness([LIMITED_ADMIN, STANDARD]);
  const limitedSession = await managerSession(service, LIMITED_ADMIN.manager_profile_id);
  assert.equal((await service.masterControl(limitedSession)).total, 1);
  await assert.rejects(service.masterControlMembership(limitedSession, STANDARD.membership_id), /RECRUITING_ADMIN_SCOPE_DENIED/);
  await assert.rejects(service.createManagerMembership(limitedSession, {
    manager_name: 'Outside Manager', manager_email: 'outside@example.test', enterprise_id: 'enterprise_outside', enterprise_name: 'Outside Enterprise',
  }), /RECRUITING_ADMIN_SCOPE_DENIED/);

  const standardSession = await managerSession(service, STANDARD.manager_profile_id);
  await assert.rejects(service.masterControl(standardSession), /RECRUITING_ADMIN_AUTHORITY_REQUIRED/);
});

test('v1 membership records migrate to active standard entitlements without granting admin authority', () => {
  const migrated = normalizeRecruitingState({
    version: 1,
    memberships: { legacy: { ...STANDARD, setup_state: undefined, entitlement_mode: undefined, admin_roles: undefined, recruiting_governance: undefined } },
  });
  assert.equal(migrated.version, 3);
  assert.equal(migrated.memberships[STANDARD.membership_id].setup_state, 'COMPLETE');
  assert.equal(migrated.memberships[STANDARD.membership_id].entitlement_mode, '5_per_month');
  assert.deepEqual(migrated.memberships[STANDARD.membership_id].admin_roles, []);
});
