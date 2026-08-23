import {
  RECRUITING_ADMIN_ROLE,
  normalizeEmail,
  normalizeProfileId,
  stableHash,
} from '../../../src/lib/recruitingV1/contracts.js';

function clean(value, max = 180) {
  return String(value || '').trim().replace(/\s+/gu, ' ').slice(0, max);
}

function normalizeBinding(input) {
  if (input?.contract !== 'recruiting_admin_provisioning_v1'
      || input?.confirm_server_held_authority !== true
      || input?.confirm_role !== RECRUITING_ADMIN_ROLE
      || input?.confirm_entitlement !== 'unlimited'
      || input?.all_enterprises !== true) {
    throw new Error('RECRUITING_ADMIN_PROVISIONING_AUTHORITY_INVALID');
  }
  const profileId = normalizeProfileId(input.manager_profile_id);
  const email = normalizeEmail(input.manager_email);
  const managerName = clean(input.manager_name, 160);
  const enterpriseId = clean(input.enterprise_id, 180);
  const enterpriseName = clean(input.enterprise_name, 180);
  if (!profileId || !email || !managerName || !enterpriseId || !enterpriseName) {
    throw new Error('RECRUITING_ADMIN_PROVISIONING_INPUT_INVALID');
  }
  const identity = stableHash({ profile_id: profileId, enterprise_id: enterpriseId });
  return Object.freeze({
    membership_id: `membership_admin_${identity.slice(0, 24)}`,
    manager_subject_id: `manager_admin_${identity.slice(24, 48)}`,
    manager_profile_id: profileId,
    manager_name: managerName,
    manager_email: email,
    enterprise_id: enterpriseId,
    enterprise_name: enterpriseName,
  });
}

function sameBinding(existing, binding) {
  return existing.membership_id === binding.membership_id
    && existing.manager_subject_id === binding.manager_subject_id
    && existing.manager_profile_id === binding.manager_profile_id
    && existing.manager_email === binding.manager_email
    && existing.enterprise_id === binding.enterprise_id
    && existing.entitlement_mode === 'unlimited'
    && existing.admin_roles?.length === 1
    && existing.admin_roles[0] === RECRUITING_ADMIN_ROLE
    && existing.recruiting_governance?.all_enterprises === true;
}

export async function provisionRecruitingAdmin({ store, profileValidator, input, now = () => new Date() }) {
  if (!store || typeof store.transaction !== 'function') throw new Error('RECRUITING_ADMIN_PROVISIONING_STORE_REQUIRED');
  if (typeof profileValidator !== 'function') throw new Error('RECRUITING_ADMIN_PROFILE_VALIDATOR_REQUIRED');
  const binding = normalizeBinding(input);
  const profile = await profileValidator(binding.manager_profile_id);
  if (profile?.found !== true || normalizeProfileId(profile.profile_id) !== binding.manager_profile_id) {
    throw new Error('RECRUITING_ADMIN_CANONICAL_PROFILE_NOT_FOUND');
  }
  return store.transaction((state) => {
    const existing = state.memberships[binding.membership_id];
    if (existing) {
      if (!sameBinding(existing, binding)) throw new Error('RECRUITING_ADMIN_REBIND_DENIED');
      return { created: false, idempotent: true, membership_id: existing.membership_id };
    }
    const conflict = Object.values(state.memberships).find((membership) =>
      membership.status !== 'REVOKED'
      && (membership.manager_profile_id === binding.manager_profile_id
        || membership.manager_email === binding.manager_email
        || membership.manager_subject_id === binding.manager_subject_id));
    if (conflict) throw new Error('RECRUITING_ADMIN_CONFLICTING_MEMBERSHIP');
    const timestamp = now().toISOString();
    state.memberships[binding.membership_id] = {
      ...binding,
      status: 'ACTIVE',
      setup_state: 'COMPLETE',
      entitlement_mode: 'unlimited',
      admin_roles: [RECRUITING_ADMIN_ROLE],
      recruiting_governance: { all_enterprises: true, enterprise_ids: [] },
      created_at: timestamp,
      updated_at: timestamp,
      profile_bound_at: timestamp,
      setup_completed_at: timestamp,
      authority_source: 'SERVER_HELD_REVIEWED_PROVISIONING_INPUT',
    };
    state.audit.push({
      event_id: `audit_${stableHash({ membership_id: binding.membership_id, timestamp }).slice(0, 24)}`,
      event_type: 'RECRUITING_ADMIN_MEMBERSHIP_PROVISIONED',
      occurred_at: timestamp,
      membership_id: binding.membership_id,
      target_membership_id: binding.membership_id,
      authority_source: 'SERVER_HELD_REVIEWED_PROVISIONING_INPUT',
    });
    return { created: true, idempotent: false, membership_id: binding.membership_id };
  });
}

export const RECRUITING_ADMIN_PROVISIONING_CONTRACT = Object.freeze({
  contract: 'recruiting_admin_provisioning_v1',
  input_transport: 'stdin_only',
  role: RECRUITING_ADMIN_ROLE,
  entitlement: 'unlimited',
  name_or_profile_infers_authority: false,
  rebind_allowed: false,
});
