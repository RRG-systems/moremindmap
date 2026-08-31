import {
  INVITATION_TTL_MS,
  MANAGER_CHALLENGE_TTL_MS,
  MANAGER_SETUP_SESSION_TTL_MS,
  MANAGER_SETUP_TTL_MS,
  MANAGER_SESSION_TTL_MS,
  MONTHLY_INVITATION_LIMIT,
  assertManagerEvidence,
  assertMembership,
  assertMembershipRecord,
  assertOpportunityItem,
  assertRecruitingAdmin,
  boundedText,
  createOpaqueId,
  createOpaqueToken,
  createTokenWrapper,
  digestToken,
  entitlementPeriodFor,
  normalizeEmail,
  normalizeProfileId,
  publicInvitation,
  stableHash,
} from './contracts.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

function iso(now) {
  return (now instanceof Date ? now : new Date(now)).toISOString();
}

function at(now) {
  return now instanceof Date ? now : new Date(now);
}

function audit(state, event_type, detail, now) {
  state.audit.push({ event_id: createOpaqueId('audit'), event_type, occurred_at: iso(now), ...clone(detail) });
}

function activePeriod(membership, now) {
  const configured = membership.entitlement_period;
  if (configured && Date.parse(configured.period_start) <= at(now).getTime() && Date.parse(configured.period_end) > at(now).getTime()) {
    return configured;
  }
  return entitlementPeriodFor(at(now));
}

function entitlementFor(state, membership, now) {
  const period = activePeriod(membership, now);
  const active = Object.values(state.invitations).filter((invitation) =>
    invitation.membership_id === membership.membership_id
      && invitation.entitlement_period_start === period.period_start
      && ['RESERVED', 'CONSUMED'].includes(invitation.entitlement_state));
  const mode = membership.entitlement_mode || '5_per_month';
  const limit = mode === 'unlimited' ? null : MONTHLY_INVITATION_LIMIT;
  return {
    mode,
    limit,
    used: active.length,
    reserved: active.filter((item) => item.entitlement_state === 'RESERVED').length,
    consumed: active.filter((item) => item.entitlement_state === 'CONSUMED').length,
    remaining: limit === null ? null : Math.max(0, limit - active.length),
    ...period,
  };
}

function expireDueInvitations(state, now) {
  for (const invitation of Object.values(state.invitations)) {
    if (!invitation.accepted_at && ['ISSUED', 'DELIVERED'].includes(invitation.state) && Date.parse(invitation.expires_at) <= at(now).getTime()) {
      invitation.state = 'EXPIRED';
      invitation.entitlement_state = 'RELEASED';
      invitation.updated_at = iso(now);
      invitation.token_digest = null;
      audit(state, 'INVITATION_EXPIRED', { invitation_id: invitation.invitation_id, membership_id: invitation.membership_id }, now);
    }
  }
}

function membershipFromSession(state, sessionToken, now) {
  const digest = digestToken(sessionToken);
  const session = state.manager_sessions[digest];
  if (!session || Date.parse(session.expires_at) <= at(now).getTime()) throw new Error('RECRUITING_MANAGER_SESSION_REQUIRED');
  const membership = assertMembership(state.memberships[session.membership_id]);
  if (membership.enterprise_id !== session.enterprise_id || membership.manager_subject_id !== session.manager_subject_id) {
    throw new Error('RECRUITING_MANAGER_SESSION_SCOPE_INVALID');
  }
  return { session, membership, digest };
}

function adminFromSession(state, sessionToken, now) {
  const authenticated = membershipFromSession(state, sessionToken, now);
  assertRecruitingAdmin(authenticated.membership);
  return authenticated;
}

function inGovernanceScope(admin, target) {
  const scope = admin.recruiting_governance || {};
  return scope.all_enterprises === true || (scope.enterprise_ids || []).includes(target.enterprise_id);
}

function membershipInAdminScope(state, admin, membershipId) {
  const membership = state.memberships[membershipId];
  if (!membership) throw new Error('RECRUITING_MANAGER_MEMBERSHIP_NOT_FOUND');
  assertMembershipRecord(membership);
  if (!inGovernanceScope(admin, membership)) throw new Error('RECRUITING_ADMIN_SCOPE_DENIED');
  return membership;
}

function publicMembership(state, membership, now, { includeAudit = false } = {}) {
  const entitlement = entitlementFor(state, membership, now);
  const projected = {
    membership_id: membership.membership_id,
    manager_name: membership.manager_name,
    manager_email: membership.manager_email,
    enterprise_id: membership.enterprise_id,
    enterprise_name: membership.enterprise_name,
    status: membership.status,
    setup_state: membership.setup_state,
    entitlement,
    setup_sent_at: membership.setup_sent_at || null,
    setup_completed_at: membership.setup_completed_at || null,
    suspended_at: membership.suspended_at || null,
    revoked_at: membership.revoked_at || null,
    profile_bound: Boolean(membership.manager_profile_id),
    created_at: membership.created_at || null,
    updated_at: membership.updated_at || null,
  };
  if (includeAudit) {
    projected.audit = state.audit.filter((event) => event.membership_id === membership.membership_id || event.target_membership_id === membership.membership_id).slice().reverse();
  }
  return projected;
}

function inviteFromSession(state, inviteSessionToken, now) {
  const digest = digestToken(inviteSessionToken);
  const session = state.invite_sessions[digest];
  if (!session || Date.parse(session.expires_at) <= at(now).getTime()) throw new Error('RECRUITING_INVITE_SESSION_REQUIRED');
  const invitation = state.invitations[session.invitation_id];
  if (!invitation || !invitation.accepted_at || invitation.candidate_id !== session.candidate_id || invitation.enterprise_id !== session.enterprise_id) {
    throw new Error('RECRUITING_INVITE_SESSION_SCOPE_INVALID');
  }
  return { session, invitation, digest };
}

function invitationInScope(state, membership, invitationId) {
  const invitation = state.invitations[invitationId];
  if (!invitation || invitation.membership_id !== membership.membership_id || invitation.enterprise_id !== membership.enterprise_id) {
    throw new Error('RECRUITING_INVITATION_SCOPE_DENIED');
  }
  return invitation;
}

function enqueue(state, { kind, recipient, membership, invitation, payload, tokenCapsule = null, idempotencyKey = null }, now) {
  const idempotency_key = boundedText(idempotencyKey, 180)
    || stableHash({ kind, recipient, invitation_id: invitation?.invitation_id, generation: invitation?.token_generation || 0, payload });
  const existing = Object.values(state.outbox).find((item) => item.idempotency_key === idempotency_key);
  if (existing) return existing;
  const item = {
    outbox_id: createOpaqueId('outbox'),
    idempotency_key,
    kind,
    recipient,
    membership_id: membership?.membership_id || invitation?.membership_id || null,
    enterprise_id: membership?.enterprise_id || invitation?.enterprise_id || null,
    invitation_id: invitation?.invitation_id || null,
    payload: clone(payload),
    token_capsule: tokenCapsule,
    state: 'PENDING',
    attempts: 0,
    created_at: iso(now),
    updated_at: iso(now),
  };
  state.outbox[item.outbox_id] = item;
  return item;
}

function addInbox(state, membershipId, notice, now) {
  const current = state.inbox_by_membership[membershipId] || [];
  if (current.some((item) => item.idempotency_key === notice.idempotency_key)) return;
  current.unshift({ notification_id: createOpaqueId('notice'), read: false, created_at: iso(now), ...clone(notice) });
  state.inbox_by_membership[membershipId] = current.slice(0, 100);
}

function invalidateSetupChallenges(state, membershipId, now, reason) {
  for (const challenge of Object.values(state.manager_setup_challenges)) {
    if (challenge.membership_id === membershipId && !challenge.consumed_at && !challenge.superseded_at) {
      challenge.superseded_at = iso(now);
      challenge.superseded_reason = reason;
    }
  }
}

function invalidateManagerSessions(state, membershipId) {
  const sessionIds = new Set();
  for (const [digest, session] of Object.entries(state.manager_sessions)) {
    if (session.membership_id === membershipId) {
      sessionIds.add(session.session_id);
      delete state.manager_sessions[digest];
    }
  }
  for (const [digest, proof] of Object.entries(state.manager_csrf_proofs)) {
    if (sessionIds.has(proof.session_id)) delete state.manager_csrf_proofs[digest];
  }
}

function issueSetupChallenge(state, membership, token, tokenWrapper, now) {
  invalidateSetupChallenges(state, membership.membership_id, now, 'SUPERSEDED_BY_RESEND');
  membership.setup_generation = Number(membership.setup_generation || 0) + 1;
  membership.setup_state = 'SETUP_SENT';
  membership.setup_sent_at = iso(now);
  membership.updated_at = iso(now);
  const challenge = {
    challenge_id: createOpaqueId('manager_setup'),
    token_digest: digestToken(token),
    membership_id: membership.membership_id,
    generation: membership.setup_generation,
    expires_at: iso(new Date(at(now).getTime() + MANAGER_SETUP_TTL_MS)),
    consumed_at: null,
    superseded_at: null,
    created_at: iso(now),
  };
  state.manager_setup_challenges[challenge.token_digest] = challenge;
  const outbox = enqueue(state, {
    kind: 'MANAGER_SETUP',
    recipient: membership.manager_email,
    membership,
    payload: {
      manager_name: membership.manager_name,
      enterprise_name: membership.enterprise_name,
      setup_generation: membership.setup_generation,
    },
    tokenCapsule: tokenWrapper.wrap(token),
  }, now);
  return { challenge, outbox };
}

export class RecruitingV1Service {
  constructor({ store, now = () => new Date(), transport = null, tokenWrapper = null, profileValidator = null }) {
    if (!store) throw new TypeError('RECRUITING_STORE_REQUIRED');
    this.store = store;
    this.now = now;
    this.transport = transport;
    this.tokenWrapper = tokenWrapper || createTokenWrapper('recruiting-v1-test-only-token-wrap-key');
    this.profileValidator = profileValidator || (async (profileId) => ({ found: Boolean(normalizeProfileId(profileId)), profile_id: normalizeProfileId(profileId) }));
  }

  async requestManagerVerification(profileId) {
    const normalized = normalizeProfileId(profileId);
    if (!normalized) throw new Error('RECRUITING_MANAGER_PROFILE_ID_INVALID');
    const token = createOpaqueToken();
    const result = await this.store.transaction((state) => {
      const now = this.now();
      const membership = Object.values(state.memberships).find((item) => item.status === 'ACTIVE' && item.manager_profile_id?.toLowerCase() === normalized);
      if (!membership) throw new Error('RECRUITING_MANAGER_PREAPPROVAL_REQUIRED');
      assertMembership(membership);
      const challenge = {
        challenge_id: createOpaqueId('challenge'),
        token_digest: digestToken(token),
        membership_id: membership.membership_id,
        expires_at: iso(new Date(at(now).getTime() + MANAGER_CHALLENGE_TTL_MS)),
        consumed_at: null,
        created_at: iso(now),
      };
      state.manager_challenges[challenge.token_digest] = challenge;
      const outbox = enqueue(state, {
        kind: 'MANAGER_VERIFICATION', recipient: membership.manager_email, membership,
        payload: { manager_name: membership.manager_name, challenge_id: challenge.challenge_id },
        tokenCapsule: this.tokenWrapper.wrap(token),
      }, now);
      audit(state, 'MANAGER_VERIFICATION_REQUESTED', { membership_id: membership.membership_id, challenge_id: challenge.challenge_id }, now);
      return { challenge_id: challenge.challenge_id, outbox_id: outbox.outbox_id, masked_email: membership.manager_email.replace(/^(.{2}).*(@.*)$/u, '$1***$2') };
    });
    return { ...result, verification_token: this.transport?.synthetic === true ? token : undefined };
  }

  async verifyManager(token) {
    const sessionToken = createOpaqueToken();
    const result = await this.store.transaction((state) => {
      const now = this.now();
      const challenge = state.manager_challenges[digestToken(token)];
      if (!challenge || challenge.consumed_at || Date.parse(challenge.expires_at) <= at(now).getTime()) throw new Error('RECRUITING_MANAGER_CHALLENGE_INVALID');
      const membership = assertMembership(state.memberships[challenge.membership_id]);
      challenge.consumed_at = iso(now);
      const session = {
        session_id: createOpaqueId('manager_session'),
        membership_id: membership.membership_id,
        manager_subject_id: membership.manager_subject_id,
        enterprise_id: membership.enterprise_id,
        issued_at: iso(now),
        expires_at: iso(new Date(at(now).getTime() + MANAGER_SESSION_TTL_MS)),
        rotation: 0,
      };
      state.manager_sessions[digestToken(sessionToken)] = session;
      audit(state, 'MANAGER_SESSION_ISSUED', { membership_id: membership.membership_id, session_id: session.session_id }, now);
      return { session, membership: clone(membership) };
    });
    return { ...result, session_token: sessionToken };
  }

  async inspectManager(sessionToken) {
    return this.store.transaction((state) => {
      const now = this.now();
      expireDueInvitations(state, now);
      const { session, membership } = membershipFromSession(state, sessionToken, now);
      return {
        session,
        membership: clone(membership),
        entitlement: entitlementFor(state, membership, now),
        capabilities: { master_control: Array.isArray(membership.admin_roles) && membership.admin_roles.includes('RECRUITING_ADMIN') },
      };
    });
  }

  async inspectManagerReadOnly(sessionToken) {
    const state = await this.store.read();
    const now = this.now();
    const { session, membership } = membershipFromSession(state, sessionToken, now);
    return {
      session: clone(session),
      membership: clone(membership),
      entitlement: entitlementFor(state, membership, now),
      capabilities: { master_control: Array.isArray(membership.admin_roles) && membership.admin_roles.includes('RECRUITING_ADMIN') },
    };
  }

  async rotateManagerSession(sessionToken) {
    const rotatedToken = createOpaqueToken();
    const result = await this.store.transaction((state) => {
      const now = this.now();
      const { session, membership, digest } = membershipFromSession(state, sessionToken, now);
      const rotated = {
        ...session,
        session_id: createOpaqueId('manager_session'),
        issued_at: iso(now),
        expires_at: iso(new Date(at(now).getTime() + MANAGER_SESSION_TTL_MS)),
        rotation: Number(session.rotation || 0) + 1,
      };
      delete state.manager_sessions[digest];
      state.manager_sessions[digestToken(rotatedToken)] = rotated;
      for (const [csrfDigest, proof] of Object.entries(state.manager_csrf_proofs)) {
        if (proof.session_id === session.session_id) delete state.manager_csrf_proofs[csrfDigest];
      }
      audit(state, 'MANAGER_SESSION_ROTATED', { membership_id: membership.membership_id, session_id: rotated.session_id, rotation: rotated.rotation }, now);
      return { session: rotated, membership: clone(membership) };
    });
    return { ...result, session_token: rotatedToken };
  }

  async issueManagerCsrf(sessionToken) {
    const csrfToken = createOpaqueToken();
    await this.store.transaction((state) => {
      const now = this.now();
      const { session } = membershipFromSession(state, sessionToken, now);
      for (const [csrfDigest, proof] of Object.entries(state.manager_csrf_proofs)) {
        if (Date.parse(proof.expires_at) <= at(now).getTime()) delete state.manager_csrf_proofs[csrfDigest];
      }
      state.manager_csrf_proofs[digestToken(csrfToken)] = {
        session_id: session.session_id,
        expires_at: iso(new Date(at(now).getTime() + MANAGER_CHALLENGE_TTL_MS)),
        issued_at: iso(now),
      };
      return true;
    });
    return csrfToken;
  }

  async consumeManagerCsrf(sessionToken, csrfToken) {
    return this.store.transaction((state) => {
      const now = this.now();
      const { session } = membershipFromSession(state, sessionToken, now);
      const digest = digestToken(csrfToken);
      const proof = state.manager_csrf_proofs[digest];
      if (!proof || proof.session_id !== session.session_id || Date.parse(proof.expires_at) <= at(now).getTime()) {
        throw new Error('RECRUITING_CSRF_INVALID');
      }
      delete state.manager_csrf_proofs[digest];
      return { consumed: true };
    });
  }

  async masterControl(sessionToken) {
    return this.store.transaction((state) => {
      const now = this.now();
      expireDueInvitations(state, now);
      const { membership: admin } = adminFromSession(state, sessionToken, now);
      const memberships = Object.values(state.memberships)
        .filter((membership) => inGovernanceScope(admin, membership))
        .map((membership) => publicMembership(state, membership, now))
        .sort((left, right) => left.enterprise_name.localeCompare(right.enterprise_name) || left.manager_name.localeCompare(right.manager_name));
      return {
        admin: publicMembership(state, admin, now),
        memberships,
        total: memberships.length,
        default_view: 'ALL_AUTHORIZED_MEMBERSHIPS',
      };
    });
  }

  async masterControlMembership(sessionToken, membershipId) {
    return this.store.transaction((state) => {
      const now = this.now();
      const { membership: admin } = adminFromSession(state, sessionToken, now);
      const membership = membershipInAdminScope(state, admin, boundedText(membershipId, 180));
      return { membership: publicMembership(state, membership, now, { includeAudit: true }) };
    });
  }

  async createManagerMembership(sessionToken, input) {
    const managerName = boundedText(input?.manager_name, 160);
    const managerEmail = normalizeEmail(input?.manager_email);
    const enterpriseName = boundedText(input?.enterprise_name, 180);
    const requestedEnterpriseId = boundedText(input?.enterprise_id, 180);
    const profileId = input?.manager_profile_id ? normalizeProfileId(input.manager_profile_id) : null;
    if (!managerName || !managerEmail || !enterpriseName) throw new Error('RECRUITING_MANAGER_PROVISIONING_INPUT_INVALID');
    if (input?.manager_profile_id && !profileId) throw new Error('RECRUITING_MEMBERSHIP_PROFILE_ID_INVALID');
    const setupToken = createOpaqueToken();
    const result = await this.store.transaction((state) => {
      const now = this.now();
      const { membership: admin } = adminFromSession(state, sessionToken, now);
      const enterpriseId = requestedEnterpriseId || createOpaqueId('enterprise');
      const target = { enterprise_id: enterpriseId };
      if (!inGovernanceScope(admin, target)) throw new Error('RECRUITING_ADMIN_SCOPE_DENIED');
      const duplicate = Object.values(state.memberships).find((membership) => membership.manager_email === managerEmail && membership.status !== 'REVOKED');
      if (duplicate) throw new Error('RECRUITING_MANAGER_EMAIL_ALREADY_PROVISIONED');
      if (profileId && Object.values(state.memberships).some((membership) => membership.manager_profile_id === profileId && membership.status !== 'REVOKED')) {
        throw new Error('RECRUITING_MANAGER_PROFILE_ALREADY_BOUND');
      }
      const membership = {
        membership_id: createOpaqueId('membership'),
        manager_subject_id: createOpaqueId('manager'),
        manager_profile_id: profileId,
        manager_name: managerName,
        manager_email: managerEmail,
        enterprise_id: enterpriseId,
        enterprise_name: enterpriseName,
        status: 'PENDING_SETUP',
        setup_state: 'NOT_SENT',
        entitlement_mode: '5_per_month',
        admin_roles: [],
        recruiting_governance: { all_enterprises: false, enterprise_ids: [enterpriseId] },
        created_at: iso(now),
        updated_at: iso(now),
        created_by_membership_id: admin.membership_id,
      };
      assertMembershipRecord(membership);
      state.memberships[membership.membership_id] = membership;
      const { challenge, outbox } = issueSetupChallenge(state, membership, setupToken, this.tokenWrapper, now);
      audit(state, 'MANAGER_MEMBERSHIP_CREATED', {
        membership_id: membership.membership_id,
        target_membership_id: membership.membership_id,
        actor_membership_id: admin.membership_id,
        enterprise_id: membership.enterprise_id,
      }, now);
      audit(state, 'MANAGER_SETUP_SENT', {
        membership_id: membership.membership_id,
        target_membership_id: membership.membership_id,
        actor_membership_id: admin.membership_id,
        challenge_id: challenge.challenge_id,
      }, now);
      return { membership: publicMembership(state, membership, now), outbox_id: outbox.outbox_id };
    });
    return { ...result, setup_token: this.transport?.synthetic === true ? setupToken : undefined };
  }

  async updatePendingManager(sessionToken, membershipId, input) {
    return this.store.transaction((state) => {
      const now = this.now();
      const { membership: admin } = adminFromSession(state, sessionToken, now);
      const membership = membershipInAdminScope(state, admin, boundedText(membershipId, 180));
      if (membership.status !== 'PENDING_SETUP') throw new Error('RECRUITING_MANAGER_METADATA_PENDING_ONLY');
      const nextName = boundedText(input?.manager_name ?? membership.manager_name, 160);
      const nextEmail = normalizeEmail(input?.manager_email ?? membership.manager_email);
      const nextEnterpriseName = boundedText(input?.enterprise_name ?? membership.enterprise_name, 180);
      const nextEnterpriseId = boundedText(input?.enterprise_id ?? membership.enterprise_id, 180);
      const nextProfile = input?.manager_profile_id === '' || input?.manager_profile_id === null
        ? null
        : normalizeProfileId(input?.manager_profile_id ?? membership.manager_profile_id);
      if (!nextName || !nextEmail || !nextEnterpriseName || !nextEnterpriseId) throw new Error('RECRUITING_MANAGER_PROVISIONING_INPUT_INVALID');
      if (input?.manager_profile_id && !nextProfile) throw new Error('RECRUITING_MEMBERSHIP_PROFILE_ID_INVALID');
      if (!inGovernanceScope(admin, { enterprise_id: nextEnterpriseId })) throw new Error('RECRUITING_ADMIN_SCOPE_DENIED');
      if (Object.values(state.memberships).some((item) => item.membership_id !== membership.membership_id && item.manager_email === nextEmail && item.status !== 'REVOKED')) {
        throw new Error('RECRUITING_MANAGER_EMAIL_ALREADY_PROVISIONED');
      }
      if (nextProfile && Object.values(state.memberships).some((item) => item.membership_id !== membership.membership_id && item.manager_profile_id === nextProfile && item.status !== 'REVOKED')) {
        throw new Error('RECRUITING_MANAGER_PROFILE_ALREADY_BOUND');
      }
      const emailChanged = membership.manager_email !== nextEmail;
      Object.assign(membership, {
        manager_name: nextName,
        manager_email: nextEmail,
        enterprise_name: nextEnterpriseName,
        enterprise_id: nextEnterpriseId,
        manager_profile_id: nextProfile,
        recruiting_governance: { all_enterprises: false, enterprise_ids: [nextEnterpriseId] },
        updated_at: iso(now),
      });
      if (emailChanged) {
        invalidateSetupChallenges(state, membership.membership_id, now, 'EMAIL_CHANGED');
        membership.setup_state = 'NOT_SENT';
      }
      audit(state, 'MANAGER_PENDING_METADATA_UPDATED', {
        membership_id: membership.membership_id,
        target_membership_id: membership.membership_id,
        actor_membership_id: admin.membership_id,
        email_changed: emailChanged,
      }, now);
      return { membership: publicMembership(state, membership, now) };
    });
  }

  async resendManagerSetup(sessionToken, membershipId) {
    const setupToken = createOpaqueToken();
    const result = await this.store.transaction((state) => {
      const now = this.now();
      const { membership: admin } = adminFromSession(state, sessionToken, now);
      const membership = membershipInAdminScope(state, admin, boundedText(membershipId, 180));
      if (membership.status !== 'PENDING_SETUP') throw new Error('RECRUITING_MANAGER_SETUP_RESEND_DENIED');
      const { challenge, outbox } = issueSetupChallenge(state, membership, setupToken, this.tokenWrapper, now);
      audit(state, 'MANAGER_SETUP_RESENT', {
        membership_id: membership.membership_id,
        target_membership_id: membership.membership_id,
        actor_membership_id: admin.membership_id,
        challenge_id: challenge.challenge_id,
      }, now);
      return { membership: publicMembership(state, membership, now), outbox_id: outbox.outbox_id };
    });
    return { ...result, setup_token: this.transport?.synthetic === true ? setupToken : undefined };
  }

  async managerSetupPreview(token) {
    return this.store.transaction((state) => {
      const now = this.now();
      const challenge = state.manager_setup_challenges[digestToken(token)];
      if (!challenge || challenge.consumed_at || challenge.superseded_at || Date.parse(challenge.expires_at) <= at(now).getTime()) {
        throw new Error('RECRUITING_MANAGER_SETUP_TOKEN_INVALID');
      }
      const membership = assertMembershipRecord(state.memberships[challenge.membership_id]);
      if (membership.status !== 'PENDING_SETUP') throw new Error('RECRUITING_MANAGER_SETUP_NOT_PENDING');
      return {
        manager_name: membership.manager_name,
        masked_email: membership.manager_email.replace(/^(.{2}).*(@.*)$/u, '$1***$2'),
        enterprise_name: membership.enterprise_name,
        profile_bound: Boolean(membership.manager_profile_id),
        expires_at: challenge.expires_at,
      };
    });
  }

  async beginManagerSetup(token) {
    const sessionToken = createOpaqueToken();
    const csrfToken = createOpaqueToken();
    const result = await this.store.transaction((state) => {
      const now = this.now();
      const challenge = state.manager_setup_challenges[digestToken(token)];
      if (!challenge || challenge.consumed_at || challenge.superseded_at || Date.parse(challenge.expires_at) <= at(now).getTime()) {
        throw new Error('RECRUITING_MANAGER_SETUP_TOKEN_INVALID');
      }
      const membership = assertMembershipRecord(state.memberships[challenge.membership_id]);
      if (membership.status !== 'PENDING_SETUP') throw new Error('RECRUITING_MANAGER_SETUP_NOT_PENDING');
      challenge.consumed_at = iso(now);
      membership.setup_state = 'EMAIL_VERIFIED';
      membership.email_verified_at = iso(now);
      membership.updated_at = iso(now);
      const session = {
        setup_session_id: createOpaqueId('setup_session'),
        membership_id: membership.membership_id,
        issued_at: iso(now),
        expires_at: iso(new Date(at(now).getTime() + MANAGER_SETUP_SESSION_TTL_MS)),
      };
      state.manager_setup_sessions[digestToken(sessionToken)] = session;
      state.manager_setup_csrf_proofs[digestToken(csrfToken)] = {
        setup_session_id: session.setup_session_id,
        expires_at: session.expires_at,
        issued_at: iso(now),
      };
      audit(state, 'MANAGER_SETUP_EMAIL_VERIFIED', {
        membership_id: membership.membership_id,
        target_membership_id: membership.membership_id,
      }, now);
      return {
        membership: publicMembership(state, membership, now),
        setup_session: session,
      };
    });
    return { ...result, setup_session_token: sessionToken, csrf_token: csrfToken };
  }

  async completeManagerSetup(setupSessionToken, csrfToken, profileId) {
    const normalizedProfile = normalizeProfileId(profileId);
    if (!normalizedProfile) throw new Error('RECRUITING_MEMBERSHIP_PROFILE_ID_INVALID');
    const validation = await this.profileValidator(normalizedProfile);
    if (!validation?.found || normalizeProfileId(validation.profile_id || normalizedProfile) !== normalizedProfile) {
      throw new Error('RECRUITING_MANAGER_PROFILE_NOT_FOUND');
    }
    const managerSessionToken = createOpaqueToken();
    const result = await this.store.transaction((state) => {
      const now = this.now();
      const setupDigest = digestToken(setupSessionToken);
      const setupSession = state.manager_setup_sessions[setupDigest];
      if (!setupSession || Date.parse(setupSession.expires_at) <= at(now).getTime()) throw new Error('RECRUITING_MANAGER_SETUP_SESSION_REQUIRED');
      const csrfDigest = digestToken(csrfToken);
      const proof = state.manager_setup_csrf_proofs[csrfDigest];
      if (!proof || proof.setup_session_id !== setupSession.setup_session_id || Date.parse(proof.expires_at) <= at(now).getTime()) {
        throw new Error('RECRUITING_SETUP_CSRF_INVALID');
      }
      const membership = assertMembershipRecord(state.memberships[setupSession.membership_id]);
      if (membership.status !== 'PENDING_SETUP' || membership.setup_state !== 'EMAIL_VERIFIED') throw new Error('RECRUITING_MANAGER_SETUP_NOT_PENDING');
      if (membership.manager_profile_id && membership.manager_profile_id !== normalizedProfile) throw new Error('RECRUITING_MANAGER_PROFILE_PREAPPROVAL_MISMATCH');
      if (Object.values(state.memberships).some((item) => item.membership_id !== membership.membership_id && item.manager_profile_id === normalizedProfile && item.status !== 'REVOKED')) {
        throw new Error('RECRUITING_MANAGER_PROFILE_ALREADY_BOUND');
      }
      membership.manager_profile_id = normalizedProfile;
      membership.setup_state = 'COMPLETE';
      membership.status = 'ACTIVE';
      membership.profile_bound_at = iso(now);
      membership.setup_completed_at = iso(now);
      membership.updated_at = iso(now);
      delete state.manager_setup_sessions[setupDigest];
      delete state.manager_setup_csrf_proofs[csrfDigest];
      const session = {
        session_id: createOpaqueId('manager_session'),
        membership_id: membership.membership_id,
        manager_subject_id: membership.manager_subject_id,
        enterprise_id: membership.enterprise_id,
        issued_at: iso(now),
        expires_at: iso(new Date(at(now).getTime() + MANAGER_SESSION_TTL_MS)),
        rotation: 0,
      };
      state.manager_sessions[digestToken(managerSessionToken)] = session;
      audit(state, 'MANAGER_SETUP_COMPLETED', {
        membership_id: membership.membership_id,
        target_membership_id: membership.membership_id,
        profile_id: normalizedProfile,
      }, now);
      return { membership: publicMembership(state, membership, now), session };
    });
    return { ...result, manager_session_token: managerSessionToken };
  }

  async suspendManagerMembership(sessionToken, membershipId) {
    return this.store.transaction((state) => {
      const now = this.now();
      const { membership: admin } = adminFromSession(state, sessionToken, now);
      const membership = membershipInAdminScope(state, admin, boundedText(membershipId, 180));
      if (membership.membership_id === admin.membership_id) throw new Error('RECRUITING_ADMIN_SELF_SUSPEND_DENIED');
      if (!['ACTIVE', 'PENDING_SETUP'].includes(membership.status)) throw new Error('RECRUITING_MANAGER_SUSPEND_DENIED');
      membership.status_before_suspension = membership.status;
      membership.status = 'SUSPENDED';
      membership.suspended_at = iso(now);
      membership.updated_at = iso(now);
      invalidateSetupChallenges(state, membership.membership_id, now, 'MEMBERSHIP_SUSPENDED');
      invalidateManagerSessions(state, membership.membership_id);
      audit(state, 'MANAGER_MEMBERSHIP_SUSPENDED', {
        membership_id: membership.membership_id,
        target_membership_id: membership.membership_id,
        actor_membership_id: admin.membership_id,
      }, now);
      return { membership: publicMembership(state, membership, now) };
    });
  }

  async activateManagerMembership(sessionToken, membershipId) {
    return this.store.transaction((state) => {
      const now = this.now();
      const { membership: admin } = adminFromSession(state, sessionToken, now);
      const membership = membershipInAdminScope(state, admin, boundedText(membershipId, 180));
      if (membership.status !== 'SUSPENDED' || membership.setup_state !== 'COMPLETE' || !normalizeProfileId(membership.manager_profile_id)) {
        throw new Error('RECRUITING_MANAGER_ACTIVATION_REQUIRES_COMPLETED_SETUP');
      }
      membership.status = 'ACTIVE';
      membership.activated_at = iso(now);
      membership.updated_at = iso(now);
      audit(state, 'MANAGER_MEMBERSHIP_ACTIVATED', {
        membership_id: membership.membership_id,
        target_membership_id: membership.membership_id,
        actor_membership_id: admin.membership_id,
      }, now);
      return { membership: publicMembership(state, membership, now) };
    });
  }

  async revokeManagerMembership(sessionToken, membershipId) {
    return this.store.transaction((state) => {
      const now = this.now();
      const { membership: admin } = adminFromSession(state, sessionToken, now);
      const membership = membershipInAdminScope(state, admin, boundedText(membershipId, 180));
      if (membership.membership_id === admin.membership_id) throw new Error('RECRUITING_ADMIN_SELF_REVOKE_DENIED');
      if (membership.status === 'REVOKED') throw new Error('RECRUITING_MANAGER_REVOKE_DENIED');
      membership.status = 'REVOKED';
      membership.revoked_at = iso(now);
      membership.updated_at = iso(now);
      invalidateSetupChallenges(state, membership.membership_id, now, 'MEMBERSHIP_REVOKED');
      invalidateManagerSessions(state, membership.membership_id);
      audit(state, 'MANAGER_MEMBERSHIP_REVOKED', {
        membership_id: membership.membership_id,
        target_membership_id: membership.membership_id,
        actor_membership_id: admin.membership_id,
      }, now);
      return { membership: publicMembership(state, membership, now) };
    });
  }

  async createInvitation(sessionToken, input, idempotencyKey) {
    const recruitEmail = normalizeEmail(input?.recruit_email);
    const recruitName = boundedText(input?.recruit_name, 160);
    const purpose = boundedText(input?.purpose || 'A private invitation to receive useful MORE MindMap clarity before a recruiting conversation.', 600);
    if (!recruitEmail || !recruitName) throw new Error('RECRUITING_INVITATION_IDENTITY_INVALID');
    const token = createOpaqueToken();
    const result = await this.store.transaction((state) => {
      const now = this.now();
      expireDueInvitations(state, now);
      const { membership } = membershipFromSession(state, sessionToken, now);
      const normalizedIdempotency = boundedText(idempotencyKey, 180);
      const replay = Object.values(state.invitations).find((item) => item.membership_id === membership.membership_id && item.idempotency_key === normalizedIdempotency);
      if (replay) return { invitation: publicInvitation(replay), idempotent: true, entitlement: entitlementFor(state, membership, now) };
      const duplicate = Object.values(state.invitations).find((item) => item.membership_id === membership.membership_id && item.recruit_email === recruitEmail && ['ISSUED', 'DELIVERED', 'ACCEPTED'].includes(item.state));
      if (duplicate) return { invitation: publicInvitation(duplicate), idempotent: true, duplicate_active: true, entitlement: entitlementFor(state, membership, now) };
      const entitlement = entitlementFor(state, membership, now);
      if (entitlement.mode !== 'unlimited' && entitlement.remaining < 1) throw new Error('RECRUITING_INVITATION_ALLOWANCE_EXHAUSTED');
      const invitation = {
        invitation_id: createOpaqueId('invite'),
        candidate_id: createOpaqueId('candidate'),
        membership_id: membership.membership_id,
        manager_subject_id: membership.manager_subject_id,
        enterprise_id: membership.enterprise_id,
        recruit_name: recruitName,
        recruit_email: recruitEmail,
        purpose,
        state: 'ISSUED',
        readiness_state: 'INVITED',
        ba_readiness: 'BA_NOT_STARTED',
        delivery_state: 'PENDING',
        entitlement_state: 'RESERVED',
        entitlement_period_start: entitlement.period_start,
        entitlement_period_end: entitlement.period_end,
        idempotency_key: normalizedIdempotency || stableHash({ membership_id: membership.membership_id, recruitEmail, recruitName }),
        token_digest: digestToken(token),
        token_generation: 1,
        resend_count: 0,
        issued_at: iso(now),
        expires_at: iso(new Date(at(now).getTime() + INVITATION_TTL_MS)),
        accepted_at: null,
        revoked_at: null,
        updated_at: iso(now),
      };
      state.invitations[invitation.invitation_id] = invitation;
      const outbox = enqueue(state, {
        kind: 'RECRUIT_INVITATION', recipient: recruitEmail, invitation,
        payload: { recruit_name: recruitName, inviter_name: membership.manager_name, enterprise_name: membership.enterprise_name, purpose },
        tokenCapsule: this.tokenWrapper.wrap(token),
      }, now);
      audit(state, 'INVITATION_ISSUED', { invitation_id: invitation.invitation_id, membership_id: membership.membership_id }, now);
      return { invitation: publicInvitation(invitation), invitation_token: token, outbox_id: outbox.outbox_id, idempotent: false, entitlement: entitlementFor(state, membership, now) };
    });
    if (this.transport?.synthetic !== true) delete result.invitation_token;
    return result;
  }

  async resendInvitation(sessionToken, invitationId) {
    const token = createOpaqueToken();
    const result = await this.store.transaction((state) => {
      const now = this.now();
      expireDueInvitations(state, now);
      const { membership } = membershipFromSession(state, sessionToken, now);
      const invitation = invitationInScope(state, membership, invitationId);
      if (invitation.accepted_at || invitation.state === 'REVOKED') throw new Error('RECRUITING_INVITATION_RESEND_DENIED');
      if (invitation.entitlement_state === 'RELEASED') {
        const entitlement = entitlementFor(state, membership, now);
        if (entitlement.mode !== 'unlimited' && entitlement.remaining < 1) throw new Error('RECRUITING_INVITATION_ALLOWANCE_EXHAUSTED');
        invitation.entitlement_state = 'RESERVED';
        invitation.entitlement_period_start = entitlement.period_start;
        invitation.entitlement_period_end = entitlement.period_end;
      }
      invitation.state = 'ISSUED';
      invitation.delivery_state = 'PENDING';
      invitation.token_digest = digestToken(token);
      invitation.token_generation += 1;
      invitation.resend_count += 1;
      invitation.issued_at = iso(now);
      invitation.expires_at = iso(new Date(at(now).getTime() + INVITATION_TTL_MS));
      invitation.updated_at = iso(now);
      const outbox = enqueue(state, {
        kind: 'RECRUIT_INVITATION', recipient: invitation.recruit_email, invitation,
        payload: { recruit_name: invitation.recruit_name, inviter_name: membership.manager_name, enterprise_name: membership.enterprise_name, purpose: invitation.purpose },
        tokenCapsule: this.tokenWrapper.wrap(token),
      }, now);
      audit(state, 'INVITATION_RESENT', { invitation_id: invitation.invitation_id, token_generation: invitation.token_generation }, now);
      return { invitation: publicInvitation(invitation), invitation_token: token, outbox_id: outbox.outbox_id, entitlement: entitlementFor(state, membership, now) };
    });
    if (this.transport?.synthetic !== true) delete result.invitation_token;
    return result;
  }

  async revokeInvitation(sessionToken, invitationId) {
    return this.store.transaction((state) => {
      const now = this.now();
      const { membership } = membershipFromSession(state, sessionToken, now);
      const invitation = invitationInScope(state, membership, invitationId);
      if (invitation.accepted_at) throw new Error('RECRUITING_ACCEPTED_INVITATION_REVOKE_REQUIRES_REVIEW');
      invitation.state = 'REVOKED';
      invitation.revoked_at = iso(now);
      invitation.updated_at = iso(now);
      invitation.token_digest = null;
      invitation.entitlement_state = 'RELEASED';
      audit(state, 'INVITATION_REVOKED', { invitation_id: invitation.invitation_id }, now);
      return { invitation: publicInvitation(invitation), entitlement: entitlementFor(state, membership, now) };
    });
  }

  async invitationPreview(token) {
    return this.store.transaction((state) => {
      const now = this.now();
      expireDueInvitations(state, now);
      const invitation = Object.values(state.invitations).find((item) => item.token_digest === digestToken(token));
      if (!invitation || !['ISSUED', 'DELIVERED'].includes(invitation.state)) throw new Error('RECRUITING_INVITATION_TOKEN_INVALID');
      const membership = assertMembership(state.memberships[invitation.membership_id]);
      return {
        invitation_id: invitation.invitation_id,
        recruit_name: invitation.recruit_name,
        inviter_name: membership.manager_name,
        enterprise_name: membership.enterprise_name,
        purpose: invitation.purpose,
        expires_at: invitation.expires_at,
      };
    });
  }

  async acceptInvitation(token, consent) {
    const inviteSessionToken = createOpaqueToken();
    const result = await this.store.transaction((state) => {
      const now = this.now();
      expireDueInvitations(state, now);
      const invitation = Object.values(state.invitations).find((item) => item.token_digest === digestToken(token));
      if (!invitation || !['ISSUED', 'DELIVERED'].includes(invitation.state)) throw new Error('RECRUITING_INVITATION_TOKEN_INVALID');
      if (consent?.accepted !== true || boundedText(consent?.version, 80) !== 'recruiting_v1_consent_2026_08') throw new Error('RECRUITING_INVITATION_CONSENT_REQUIRED');
      invitation.state = 'ACCEPTED';
      invitation.readiness_state = 'CONSENTED';
      invitation.accepted_at = iso(now);
      invitation.updated_at = iso(now);
      invitation.entitlement_state = 'CONSUMED';
      invitation.token_digest = null;
      invitation.consent = { version: consent.version, accepted_at: iso(now), purpose: 'RECRUITING_INTELLIGENCE' };
      const session = {
        invite_session_id: createOpaqueId('invite_session'),
        invitation_id: invitation.invitation_id,
        candidate_id: invitation.candidate_id,
        enterprise_id: invitation.enterprise_id,
        issued_at: iso(now),
        expires_at: iso(new Date(at(now).getTime() + 30 * 24 * 60 * 60 * 1000)),
      };
      state.invite_sessions[digestToken(inviteSessionToken)] = session;
      audit(state, 'INVITATION_ACCEPTED', { invitation_id: invitation.invitation_id, candidate_id: invitation.candidate_id }, now);
      return { invitation: publicInvitation(invitation), invite_session: session };
    });
    return { ...result, invite_session_token: inviteSessionToken };
  }

  async inspectInviteSession(inviteSessionToken) {
    const state = await this.store.read();
    const { session, invitation } = inviteFromSession(state, inviteSessionToken, this.now());
    return {
      invite_session: clone(session),
      relationship: {
        relationship_ref: invitation.invitation_id,
        candidate_id: invitation.candidate_id,
        bos_profile_id: invitation.bos_profile_id || null,
        ba_readiness: invitation.ba_readiness,
        purpose: 'RECRUITING_INTELLIGENCE',
      },
    };
  }

  async rotateInviteSession(inviteSessionToken) {
    const rotatedToken = createOpaqueToken();
    const result = await this.store.transaction((state) => {
      const now = this.now();
      const { session, invitation, digest } = inviteFromSession(state, inviteSessionToken, now);
      const rotated = {
        ...session,
        invite_session_id: createOpaqueId('invite_session'),
        issued_at: iso(now),
        expires_at: iso(new Date(at(now).getTime() + 30 * 24 * 60 * 60 * 1000)),
        rotation: Number(session.rotation || 0) + 1,
      };
      delete state.invite_sessions[digest];
      state.invite_sessions[digestToken(rotatedToken)] = rotated;
      audit(state, 'INVITE_SESSION_ROTATED', { invitation_id: invitation.invitation_id, invite_session_id: rotated.invite_session_id }, now);
      return { invite_session: rotated, relationship_ref: invitation.invitation_id };
    });
    return { ...result, invite_session_token: rotatedToken };
  }

  async recordDelivery(outboxId, outcome) {
    return this.store.transaction((state) => {
      const now = this.now();
      const item = state.outbox[outboxId];
      if (!item) throw new Error('RECRUITING_OUTBOX_ITEM_NOT_FOUND');
      if (item.state === 'DELIVERED') return { item, idempotent: true };
      if (!['PENDING', 'SENDING'].includes(item.state)) throw new Error('RECRUITING_OUTBOX_DELIVERY_STATE_INVALID');
      item.attempts += 1;
      item.updated_at = iso(now);
      item.state = outcome?.success ? 'DELIVERED' : 'FAILED';
      item.provider_receipt = outcome?.receipt ? boundedText(outcome.receipt, 300) : null;
      const invitation = item.invitation_id ? state.invitations[item.invitation_id] : null;
      if (invitation && item.kind === 'RECRUIT_INVITATION') {
        invitation.delivery_state = outcome?.success ? 'DELIVERED' : 'DELIVERY_FAILED';
        invitation.state = outcome?.success ? 'DELIVERED' : 'DELIVERY_FAILED';
        invitation.updated_at = iso(now);
        if (!outcome?.success && !invitation.accepted_at) invitation.entitlement_state = 'RELEASED';
      }
      if (item.kind === 'MANAGER_SETUP' && item.membership_id && state.memberships[item.membership_id]) {
        state.memberships[item.membership_id].setup_delivery_state = outcome?.success ? 'DELIVERED' : 'DELIVERY_FAILED';
        state.memberships[item.membership_id].updated_at = iso(now);
      }
      audit(state, outcome?.success ? 'OUTBOX_DELIVERED' : 'OUTBOX_FAILED', { outbox_id: item.outbox_id, invitation_id: item.invitation_id }, now);
      return { item, idempotent: false };
    });
  }

  async claimOutbox(outboxId) {
    return this.store.transaction((state) => {
      const now = this.now();
      const item = state.outbox[outboxId];
      if (!item) throw new Error('RECRUITING_OUTBOX_ITEM_NOT_FOUND');
      if (item.state === 'DELIVERED') return { item: clone(item), deliver: false, idempotent: true };
      const staleSending = item.state === 'SENDING'
        && Date.parse(item.delivery_started_at || item.updated_at || item.created_at) <= at(now).getTime() - 2 * 60 * 1000;
      if (item.state !== 'PENDING' && !staleSending) return { item: clone(item), deliver: false, idempotent: false };
      item.state = 'SENDING';
      item.delivery_started_at = iso(now);
      item.updated_at = iso(now);
      return { item: clone(item), deliver: true, idempotent: false };
    });
  }

  async deliverOutbox(outboxId) {
    if (!this.transport || typeof this.transport.deliver !== 'function') throw new Error('RECRUITING_NOTIFICATION_TRANSPORT_NOT_CONFIGURED');
    const claimed = await this.claimOutbox(outboxId);
    if (!claimed.deliver) return claimed;
    const delivery = clone(claimed.item);
    if (delivery.token_capsule) {
      delivery.delivery_token = this.tokenWrapper.unwrap(delivery.token_capsule);
      delete delivery.token_capsule;
    }
    let outcome;
    try {
      outcome = await this.transport.deliver(delivery);
    } catch {
      outcome = { success: false, receipt: 'notification_transport_failure' };
    }
    return this.recordDelivery(outboxId, outcome);
  }

  async bindBosProfile(invitationId, profileId, vaultReceipt = {}) {
    const normalized = normalizeProfileId(profileId);
    if (!normalized || vaultReceipt.verified !== true) throw new Error('RECRUITING_VERIFIED_BOS_VAULT_RECEIPT_REQUIRED');
    return this.store.transaction((state) => {
      const now = this.now();
      const invitation = state.invitations[invitationId];
      if (!invitation || !invitation.accepted_at) throw new Error('RECRUITING_ACCEPTED_RELATIONSHIP_REQUIRED');
      if (invitation.bos_profile_id && invitation.bos_profile_id !== normalized) throw new Error('RECRUITING_BOS_PROFILE_REBIND_DENIED');
      invitation.bos_profile_id = normalized;
      invitation.readiness_state = 'BOS_READY';
      invitation.updated_at = iso(now);
      const membership = state.memberships[invitation.membership_id];
      const noticeKey = stableHash({ invitation_id: invitation.invitation_id, event: 'BOS_READY', profile_id: normalized });
      addInbox(state, invitation.membership_id, { idempotency_key: noticeKey, kind: 'BOS_READY', candidate_id: invitation.candidate_id, title: `${invitation.recruit_name}'s BOS is ready.`, body: 'Recruiting Intelligence can now begin with explicit business missingness.' }, now);
      enqueue(state, { kind: 'MANAGER_BOS_READY', recipient: membership.manager_email, membership, invitation, payload: { candidate_id: invitation.candidate_id, recruit_name: invitation.recruit_name } }, now);
      audit(state, 'CANDIDATE_BOS_READY', { invitation_id: invitation.invitation_id, candidate_id: invitation.candidate_id, profile_id: normalized }, now);
      return publicInvitation(invitation);
    });
  }

  async projectBaState(invitationId, { assessment_id = null, state: baState, canonical_receipt = null }) {
    if (!['BA_INTAKE_SAVED', 'BA_IN_PROGRESS', 'BA_INTELLIGENCE_READY'].includes(baState)) throw new Error('RECRUITING_BA_STATE_INVALID');
    if (baState === 'BA_INTELLIGENCE_READY'
        && (canonical_receipt?.contract !== 'recruiting_canonical_new_ba_ready_receipt_v1'
          || canonical_receipt?.assessment_id !== assessment_id
          || canonical_receipt?.completeness !== 'PASS')) {
      throw new Error('RECRUITING_CANONICAL_BA_RECEIPT_REQUIRED');
    }
    return this.store.transaction((state) => {
      const now = this.now();
      const invitation = state.invitations[invitationId];
      if (!invitation?.bos_profile_id) throw new Error('RECRUITING_BOS_READY_REQUIRED_FOR_BA');
      const rank = { BA_NOT_STARTED: 0, BA_INTAKE_SAVED: 1, BA_IN_PROGRESS: 2, BA_INTELLIGENCE_READY: 3 };
      if ((rank[invitation.ba_readiness || 'BA_NOT_STARTED'] || 0) > rank[baState]) {
        throw new Error('RECRUITING_BA_STATE_REGRESSION_DENIED');
      }
      const sameReady = baState === 'BA_INTELLIGENCE_READY'
        && invitation.ba_readiness === baState
        && invitation.ba_assessment_id === assessment_id
        && invitation.ba_realization_receipt?.realization_id === canonical_receipt.realization_id;
      const sameInterim = baState !== 'BA_INTELLIGENCE_READY'
        && invitation.ba_readiness === baState
        && invitation.ba_assessment_id === assessment_id;
      if (sameReady || sameInterim) return publicInvitation(invitation);
      invitation.ba_assessment_id = assessment_id || invitation.ba_assessment_id;
      invitation.ba_readiness = baState;
      invitation.readiness_state = baState;
      if (canonical_receipt) invitation.ba_realization_receipt = clone(canonical_receipt);
      invitation.updated_at = iso(now);
      if (baState === 'BA_INTELLIGENCE_READY') {
        const noticeKey = stableHash({ invitation_id: invitation.invitation_id, event: baState, assessment_id: invitation.ba_assessment_id });
        addInbox(state, invitation.membership_id, { idempotency_key: noticeKey, kind: baState, candidate_id: invitation.candidate_id, title: `${invitation.recruit_name}'s business intelligence is ready.`, body: 'The candidate can now be re-read with Whole-Business evidence.' }, now);
        const membership = state.memberships[invitation.membership_id];
        enqueue(state, {
          kind: 'MANAGER_BA_INTELLIGENCE_READY',
          recipient: membership.manager_email,
          membership,
          invitation,
          payload: { candidate_id: invitation.candidate_id, recruit_name: invitation.recruit_name },
        }, now);
      }
      audit(state, `CANDIDATE_${baState}`, { invitation_id: invitation.invitation_id, assessment_id: invitation.ba_assessment_id }, now);
      return publicInvitation(invitation);
    });
  }

  async home(sessionToken) {
    return this.store.transaction((state) => {
      const now = this.now();
      expireDueInvitations(state, now);
      const { membership } = membershipFromSession(state, sessionToken, now);
      const invitations = Object.values(state.invitations).filter((item) => item.membership_id === membership.membership_id).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      return {
        manager: {
          name: membership.manager_name,
          enterprise_name: membership.enterprise_name,
          profile_id: membership.manager_profile_id,
          capabilities: { master_control: Array.isArray(membership.admin_roles) && membership.admin_roles.includes('RECRUITING_ADMIN') },
        },
        entitlement: entitlementFor(state, membership, now),
        candidates: invitations.map(publicInvitation),
        notifications: clone(state.inbox_by_membership[membership.membership_id] || []),
        existing_recruit: { available: false, code: 'EXACT_SCOPE_CONSENT_AUTHORITY_REQUIRED', safe_action: 'INVITE_EXISTING_AGENT' },
      };
    });
  }

  async saveOpportunity(sessionToken, items) {
    if (!Array.isArray(items) || items.length > 30) throw new Error('RECRUITING_OPPORTUNITY_ITEMS_INVALID');
    items.forEach(assertOpportunityItem);
    return this.store.transaction((state) => {
      const now = this.now();
      const { membership } = membershipFromSession(state, sessionToken, now);
      const authority = {
        authority_id: state.opportunity_by_enterprise[membership.enterprise_id]?.authority_id || createOpaqueId('opportunity'),
        enterprise_id: membership.enterprise_id,
        owner_membership_id: membership.membership_id,
        items: items.map((item) => ({ opportunity_evidence_id: item.opportunity_evidence_id || createOpaqueId('opp_evidence'), scope: item.category === 'COMPANY_PLATFORM' ? 'COMPANY_SECONDARY' : 'LOCAL_LEADER_PRIMARY', constraints: [], counterevidence: [], ...clone(item) })),
        updated_at: iso(now),
      };
      state.opportunity_by_enterprise[membership.enterprise_id] = authority;
      audit(state, 'LOCAL_OPPORTUNITY_UPDATED', { enterprise_id: membership.enterprise_id, item_count: items.length }, now);
      return authority;
    });
  }

  async getOpportunity(sessionToken) {
    const state = await this.store.read();
    const { membership } = membershipFromSession(state, sessionToken, this.now());
    return clone(state.opportunity_by_enterprise[membership.enterprise_id] || { enterprise_id: membership.enterprise_id, items: [], updated_at: null });
  }

  async addEvidence(sessionToken, candidateId, input) {
    assertManagerEvidence(input);
    return this.store.transaction((state) => {
      const now = this.now();
      const { membership } = membershipFromSession(state, sessionToken, now);
      const invitation = Object.values(state.invitations).find((item) => item.candidate_id === candidateId);
      if (!invitation || invitation.membership_id !== membership.membership_id || invitation.enterprise_id !== membership.enterprise_id) throw new Error('RECRUITING_CANDIDATE_SCOPE_DENIED');
      const evidence = {
        evidence_id: createOpaqueId('manager_evidence'),
        candidate_id: candidateId,
        membership_id: membership.membership_id,
        enterprise_id: membership.enterprise_id,
        type: input.type,
        claim: boundedText(input.claim, 2000),
        source: boundedText(input.source, 300),
        source_date: input.source_date,
        recorded_at: iso(now),
        truth_class: 'MANAGER_SUPPLIED_EVIDENCE',
        canonical_recruit_truth_mutated: false,
        contradicts: Array.isArray(input.contradicts) ? input.contradicts.slice(0, 10) : [],
      };
      state.evidence_by_candidate[candidateId] = [...(state.evidence_by_candidate[candidateId] || []), evidence];
      if (state.intelligence_by_candidate[candidateId]) state.intelligence_by_candidate[candidateId].stale = true;
      audit(state, 'MANAGER_EVIDENCE_ADDED', { candidate_id: candidateId, evidence_id: evidence.evidence_id }, now);
      return evidence;
    });
  }

  async candidateContext(sessionToken, candidateId) {
    const state = await this.store.read();
    const now = this.now();
    const { membership } = membershipFromSession(state, sessionToken, now);
    const invitation = Object.values(state.invitations).find((item) => item.candidate_id === candidateId);
    if (!invitation || invitation.membership_id !== membership.membership_id || invitation.enterprise_id !== membership.enterprise_id) throw new Error('RECRUITING_CANDIDATE_SCOPE_DENIED');
    return {
      membership: clone(membership),
      invitation: publicInvitation(invitation),
      opportunity: clone(state.opportunity_by_enterprise[membership.enterprise_id] || { items: [] }),
      manager_evidence: clone(state.evidence_by_candidate[candidateId] || []),
      intelligence: clone(state.intelligence_by_candidate[candidateId] || null),
    };
  }

  async deliverAgreedPlanEmails({ sessionId, acceptanceId }) {
    const queued = await this.store.transaction((state) => {
      const now = this.now();
      const session = state.shared_business_sessions?.[boundedText(sessionId, 180)];
      const accepted = session?.accepted_plan_snapshot;
      if (!session || session.status !== 'COMPLETED' || !accepted || accepted.acceptance_id !== acceptanceId) {
        throw new Error('CONSULTING_AGREED_PLAN_ACCEPTANCE_REQUIRED');
      }
      if (stableHash(accepted.plan) !== accepted.snapshot_hash) throw new Error('CONSULTING_AGREED_PLAN_SNAPSHOT_DRIFT');
      const membership = state.memberships?.[session.manager_binding.membership_id];
      if (!membership || membership.status !== 'ACTIVE' || membership.setup_state !== 'COMPLETE' || !normalizeEmail(membership.manager_email)) {
        throw new Error('CONSULTING_MANAGER_EMAIL_AUTHORITY_REQUIRED');
      }
      const invitation = session.subject_binding.candidate_id
        ? Object.values(state.invitations || {}).find((item) => item.candidate_id === session.subject_binding.candidate_id)
        : null;
      const consultationRequest = session.subject_binding.consultation_request_id
        ? state.consultation_requests?.[session.subject_binding.consultation_request_id]
        : null;
      const personEmail = invitation?.accepted_at
        ? normalizeEmail(invitation.recruit_email)
        : consultationRequest?.status === 'APPROVED'
          ? normalizeEmail(consultationRequest.owner_email)
          : null;
      if (!personEmail) throw new Error('CONSULTING_PERSON_EMAIL_AUTHORITY_REQUIRED');
      const recipients = [
        { recipient_role: 'PERSON', recipient: personEmail, recipient_name: session.subject_binding.name },
        { recipient_role: 'MANAGER', recipient: normalizeEmail(membership.manager_email), recipient_name: session.manager_binding.name },
      ];
      return recipients.map((recipient) => {
        const deliveryState = session.agreement_delivery?.recipients?.find((item) => item.recipient_role === recipient.recipient_role);
        if (!deliveryState?.idempotency_key) throw new Error('CONSULTING_AGREED_PLAN_IDEMPOTENCY_REQUIRED');
        const outbox = enqueue(state, {
          kind: 'CONSULTING_AGREED_PLAN',
          recipient: recipient.recipient,
          membership,
          invitation,
          idempotencyKey: deliveryState.idempotency_key,
          payload: {
            acceptance_id: accepted.acceptance_id,
            recipient_role: recipient.recipient_role,
            recipient_name: recipient.recipient_name,
            manager_name: session.manager_binding.name,
            person_name: session.subject_binding.name,
            accepted_plan_snapshot: clone(accepted),
          },
        }, now);
        return {
          recipient_role: recipient.recipient_role,
          recipient_masked: recipient.recipient.replace(/^(.{2}).*(@.*)$/u, '$1***$2'),
          outbox_id: outbox.outbox_id,
        };
      });
    });
    const attempts = await Promise.all(queued.map(async (recipient) => {
      const delivered = await this.deliverOutbox(recipient.outbox_id);
      return {
        ...recipient,
        state: delivered.item?.state === 'DELIVERED' ? 'DELIVERED' : delivered.item?.state === 'FAILED' ? 'FAILED' : 'PENDING',
        synthetic: this.transport?.synthetic === true,
        provider_receipt: delivered.item?.provider_receipt || null,
        attempted_at: delivered.item?.updated_at || iso(this.now()),
      };
    }));
    return attempts;
  }

  async retryAgreedPlanEmail({ sessionId, acceptanceId, recipientRole }) {
    if (!['PERSON', 'MANAGER'].includes(recipientRole)) throw new Error('CONSULTING_AGREED_PLAN_RECIPIENT_ROLE_INVALID');
    await this.store.transaction((state) => {
      const now = this.now();
      const session = state.shared_business_sessions?.[boundedText(sessionId, 180)];
      if (!session?.accepted_plan_snapshot || session.accepted_plan_snapshot.acceptance_id !== acceptanceId) {
        throw new Error('CONSULTING_AGREED_PLAN_ACCEPTANCE_REQUIRED');
      }
      const recipient = session.agreement_delivery?.recipients?.find((item) => item.recipient_role === recipientRole);
      const outbox = Object.values(state.outbox || {}).find((item) => item.idempotency_key === recipient?.idempotency_key);
      if (!outbox || outbox.kind !== 'CONSULTING_AGREED_PLAN' || outbox.payload?.acceptance_id !== acceptanceId) {
        throw new Error('CONSULTING_AGREED_PLAN_RETRY_TARGET_REQUIRED');
      }
      if (outbox.state === 'DELIVERED') return true;
      if (outbox.state !== 'FAILED') throw new Error('CONSULTING_AGREED_PLAN_RETRY_STATE_INVALID');
      outbox.state = 'PENDING';
      outbox.updated_at = iso(now);
      audit(state, 'CONSULTING_AGREED_PLAN_RETRY_AUTHORIZED', {
        outbox_id: outbox.outbox_id,
        acceptance_id: acceptanceId,
        recipient_role: recipientRole,
      }, now);
      return true;
    });
    return this.deliverAgreedPlanEmails({ sessionId, acceptanceId });
  }

  async saveIntelligence(sessionToken, candidateId, projection) {
    return this.store.transaction((state) => {
      const now = this.now();
      const { membership } = membershipFromSession(state, sessionToken, now);
      const invitation = Object.values(state.invitations).find((item) => item.candidate_id === candidateId);
      if (!invitation || invitation.membership_id !== membership.membership_id || invitation.enterprise_id !== membership.enterprise_id) throw new Error('RECRUITING_CANDIDATE_SCOPE_DENIED');
      state.intelligence_by_candidate[candidateId] = { ...clone(projection), candidate_id: candidateId, membership_id: membership.membership_id, enterprise_id: membership.enterprise_id, generated_at: iso(now), stale: false };
      audit(state, 'RECRUITING_INTELLIGENCE_PUBLISHED', { candidate_id: candidateId, projection_hash: projection.projection_hash }, now);
      return clone(state.intelligence_by_candidate[candidateId]);
    });
  }

  async recordExport(sessionToken, candidateId, mode, detailsIncluded = false) {
    if (!['meeting', 'full', 'both'].includes(mode)) throw new Error('RECRUITING_EXPORT_MODE_INVALID');
    return this.store.transaction((state) => {
      const now = this.now();
      const { membership } = membershipFromSession(state, sessionToken, now);
      const invitation = Object.values(state.invitations).find((item) => item.candidate_id === candidateId);
      if (!invitation || invitation.membership_id !== membership.membership_id || invitation.enterprise_id !== membership.enterprise_id) {
        throw new Error('RECRUITING_CANDIDATE_SCOPE_DENIED');
      }
      const metadata = {
        export_id: createOpaqueId('export'),
        candidate_id: candidateId,
        membership_id: membership.membership_id,
        enterprise_id: membership.enterprise_id,
        mode,
        details_included: detailsIncluded === true,
        exported_at: iso(now),
      };
      audit(state, 'RECRUITING_EXPORT_RECORDED', metadata, now);
      return metadata;
    });
  }

  async deliverPendingOutbox(limit = 20) {
    if (!this.transport || typeof this.transport.deliver !== 'function') throw new Error('RECRUITING_NOTIFICATION_TRANSPORT_NOT_CONFIGURED');
    const snapshot = await this.store.read();
    const now = at(this.now()).getTime();
    const pending = Object.values(snapshot.outbox).filter((item) => item.state === 'PENDING'
      || (item.state === 'SENDING' && Date.parse(item.delivery_started_at || item.updated_at || item.created_at) <= now - 2 * 60 * 1000))
      .slice(0, Math.max(1, Math.min(Number(limit) || 20, 100)));
    const results = [];
    for (const item of pending) {
      results.push(await this.deliverOutbox(item.outbox_id));
    }
    return results;
  }
}

export function createSyntheticNotificationTransport() {
  return Object.freeze({ synthetic: true, async deliver(item) { return { success: true, receipt: `synthetic:${item.outbox_id}` }; } });
}
