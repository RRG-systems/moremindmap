import assert from 'node:assert/strict';
import test from 'node:test';

import { provisionRecruitingAdmin } from '../api/engine/recruitingV1/provisioning.js';
import { createEmptyRecruitingState, InMemoryRecruitingStore } from '../src/lib/recruitingV1/store.js';

const INPUT = Object.freeze({
  contract: 'recruiting_admin_provisioning_v1',
  confirm_server_held_authority: true,
  confirm_role: 'RECRUITING_ADMIN',
  confirm_entitlement: 'unlimited',
  all_enterprises: true,
  manager_profile_id: 'mm-20990101-admin001',
  manager_name: 'Reviewed Synthetic Admin',
  manager_email: 'reviewed.admin@example.test',
  enterprise_id: 'enterprise_reviewed_admin',
  enterprise_name: 'Reviewed Enterprise',
});

test('server-held admin provisioning is explicit, idempotent, unlimited, and refuses rebind', async () => {
  const store = new InMemoryRecruitingStore(createEmptyRecruitingState());
  const profileValidator = async (profileId) => ({ found: true, profile_id: profileId });
  const first = await provisionRecruitingAdmin({ store, profileValidator, input: INPUT, now: () => new Date('2026-08-22T12:00:00.000Z') });
  const second = await provisionRecruitingAdmin({ store, profileValidator, input: INPUT, now: () => new Date('2026-08-22T12:00:01.000Z') });
  assert.equal(first.created, true);
  assert.equal(second.idempotent, true);
  const state = await store.read();
  const membership = state.memberships[first.membership_id];
  assert.equal(membership.entitlement_mode, 'unlimited');
  assert.deepEqual(membership.admin_roles, ['RECRUITING_ADMIN']);
  assert.equal(membership.recruiting_governance.all_enterprises, true);
  assert.equal(membership.authority_source, 'SERVER_HELD_REVIEWED_PROVISIONING_INPUT');

  await assert.rejects(
    provisionRecruitingAdmin({ store, profileValidator, input: { ...INPUT, manager_email: 'different@example.test' } }),
    /REBIND_DENIED|CONFLICTING_MEMBERSHIP/,
  );
  await assert.rejects(
    provisionRecruitingAdmin({ store, profileValidator, input: { ...INPUT, confirm_entitlement: '5_per_month' } }),
    /AUTHORITY_INVALID/,
  );
});

test('Profile identity alone cannot create admin authority', async () => {
  const store = new InMemoryRecruitingStore(createEmptyRecruitingState());
  await assert.rejects(
    provisionRecruitingAdmin({
      store,
      profileValidator: async (profileId) => ({ found: true, profile_id: profileId }),
      input: { manager_profile_id: INPUT.manager_profile_id, manager_name: 'Darren' },
    }),
    /AUTHORITY_INVALID/,
  );
});
