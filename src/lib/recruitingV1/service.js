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
  consultingReadinessFor,
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

const ACTIVE_ENTITLEMENT_STATES = Object.freeze(['RESERVED', 'CONSUMED']);
const BOS_JOB_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,179}$/iu;

function normalizeBosJobId(value) {
  const jobId = boundedText(value, 180);
  return BOS_JOB_ID_PATTERN.test(jobId) ? jobId : null;
}

function productEntitlementState(invitation, product) {
  const explicit = invitation?.[`${product}_entitlement_state`];
  if ([...ACTIVE_ENTITLEMENT_STATES, 'RELEASED'].includes(explicit)) return explicit;
  const legacy = invitation?.entitlement_state;
  if (![...ACTIVE_ENTITLEMENT_STATES, 'RELEASED'].includes(legacy)) return 'RELEASED';
  if (product === 'bos' || legacy === 'RELEASED') return legacy;
  if (['BA_INTAKE_SAVED', 'BA_IN_PROGRESS', 'BA_INTELLIGENCE_READY'].includes(invitation?.ba_readiness)) return 'CONSUMED';
  return invitation?.accepted_at ? 'RESERVED' : legacy;
}

function productEntitlementFor(state, membership, now, product) {
  const period = activePeriod(membership, now);
  const active = Object.values(state.invitations).filter((invitation) =>
    invitation.membership_id === membership.membership_id
      && invitation.entitlement_period_start === period.period_start
      && ACTIVE_ENTITLEMENT_STATES.includes(productEntitlementState(invitation, product)));
  const mode = membership.entitlement_mode || '5_per_month';
  const limit = mode === 'unlimited' ? null : MONTHLY_INVITATION_LIMIT;
  return {
    mode,
    limit,
    used: active.length,
    reserved: active.filter((item) => productEntitlementState(item, product) === 'RESERVED').length,
    consumed: active.filter((item) => productEntitlementState(item, product) === 'CONSUMED').length,
    remaining: limit === null ? null : Math.max(0, limit - active.length),
    ...period,
  };
}

function entitlementsFor(state, membership, now) {
  return {
    bos: productEntitlementFor(state, membership, now, 'bos'),
    ba: productEntitlementFor(state, membership, now, 'ba'),
  };
}

function entitlementProjection(state, membership, now) {
  const entitlements = entitlementsFor(state, membership, now);
  const { bos, ba } = entitlements;
  const activeInvitations = Object.values(state.invitations).filter((invitation) => invitation.membership_id === membership.membership_id
    && invitation.entitlement_period_start === bos.period_start
    && [productEntitlementState(invitation, 'bos'), productEntitlementState(invitation, 'ba')].some((status) => ACTIVE_ENTITLEMENT_STATES.includes(status)));
  const used = new Set(activeInvitations.map((invitation) => invitation.invitation_id)).size;
  const consumed = new Set(activeInvitations.filter((invitation) => [productEntitlementState(invitation, 'bos'), productEntitlementState(invitation, 'ba')].includes('CONSUMED'))
    .map((invitation) => invitation.invitation_id)).size;
  const invitationAllowance = {
    ...bos,
    products: ['BOS', 'BA'],
    used,
    reserved: used - consumed,
    consumed,
    remaining: bos.mode === 'unlimited' ? null : Math.min(bos.remaining, ba.remaining, Math.max(0, MONTHLY_INVITATION_LIMIT - used)),
  };
  return { entitlement: bos, entitlements, invitation_allowance: invitationAllowance };
}

function assertPairCanReserve(entitlements, { bos = true, ba = true, invitationRemaining = null } = {}) {
  const bosExhausted = bos && entitlements.bos.mode !== 'unlimited' && entitlements.bos.remaining < 1;
  const baExhausted = ba && entitlements.ba.mode !== 'unlimited' && entitlements.ba.remaining < 1;
  if (bosExhausted || baExhausted || (invitationRemaining !== null && invitationRemaining < 1)) throw new Error('RECRUITING_INVITATION_ALLOWANCE_EXHAUSTED');
}

function reserveEntitlementPair(state, membership, invitation, now) {
  const bosNeedsReservation = !ACTIVE_ENTITLEMENT_STATES.includes(productEntitlementState(invitation, 'bos'));
  const baNeedsReservation = !ACTIVE_ENTITLEMENT_STATES.includes(productEntitlementState(invitation, 'ba'));
  if (!bosNeedsReservation && !baNeedsReservation) return entitlementsFor(state, membership, now);
  const period = activePeriod(membership, now);
  const alreadyInCurrentUnion = invitation.entitlement_period_start === period.period_start
    && (!bosNeedsReservation || !baNeedsReservation);
  assertPairCanReserve(entitlementsFor(state, membership, now), {
    bos: bosNeedsReservation, ba: baNeedsReservation,
    invitationRemaining: alreadyInCurrentUnion ? null : entitlementProjection(state, membership, now).invitation_allowance.remaining,
  });
  invitation.paired_entitlement_version = 1;
  if (bosNeedsReservation) invitation.bos_entitlement_state = 'RESERVED';
  if (baNeedsReservation) invitation.ba_entitlement_state = 'RESERVED';
  invitation.entitlement_state = invitation.bos_entitlement_state;
  invitation.entitlement_period_start = period.period_start;
  invitation.entitlement_period_end = period.period_end;
  return entitlementsFor(state, membership, now);
}

function releaseEntitlementPair(invitation) {
  invitation.paired_entitlement_version = 1;
  invitation.bos_entitlement_state = 'RELEASED';
  invitation.ba_entitlement_state = 'RELEASED';
  invitation.entitlement_state = 'RELEASED';
}

function expireDueInvitations(state, now) {
  for (const invitation of Object.values(state.invitations)) {
    if (!invitation.accepted_at && ['ISSUED', 'DELIVERED'].includes(invitation.state) && Date.parse(invitation.expires_at) <= at(now).getTime()) {
      invitation.state = 'EXPIRED';
      releaseEntitlementPair(invitation);
      invitation.updated_at = iso(now);
      invitation.token_digest = null;
      audit(state, 'INVITATION_EXPIRED', { invitation_id: invitation.invitation_id, membership_id: invitation.membership_id }, now);
    }
    const consentRequest = invitation.current_consent_request;
    if (requiresGovernedCurrentConsentReinvitation(invitation)
        && ['PENDING', 'DELIVERED'].includes(consentRequest?.delivery_state)
        && Date.parse(consentRequest?.expires_at) <= at(now).getTime()) {
      consentRequest.delivery_state = 'EXPIRED';
      consentRequest.updated_at = iso(now);
      if (consentRequest.token_generation === invitation.token_generation) invitation.token_digest = null;
      invitation.updated_at = iso(now);
      audit(state, 'CURRENT_CONSENT_REQUEST_EXPIRED', {
        invitation_id: invitation.invitation_id,
        candidate_id: invitation.candidate_id,
        generation: consentRequest.generation,
      }, now);
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
  const entitlementSummary = entitlementProjection(state, membership, now);
  const projected = {
    membership_id: membership.membership_id,
    manager_name: membership.manager_name,
    manager_email: membership.manager_email,
    enterprise_id: membership.enterprise_id,
    enterprise_name: membership.enterprise_name,
    status: membership.status,
    setup_state: membership.setup_state,
    ...entitlementSummary,
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
  if (!invitation || !invitation.accepted_at || invitation.state !== 'ACCEPTED' || invitation.revoked_at
      || invitation.candidate_id !== session.candidate_id || invitation.enterprise_id !== session.enterprise_id) {
    throw new Error('RECRUITING_INVITE_SESSION_SCOPE_INVALID');
  }
  const membership = assertMembership(state.memberships[invitation.membership_id]);
  if (invitation.manager_subject_id !== membership.manager_subject_id || invitation.enterprise_id !== membership.enterprise_id) {
    throw new Error('RECRUITING_INVITE_SESSION_SCOPE_INVALID');
  }
  return { session, invitation, digest };
}

function invitationInScope(state, membership, invitationId) {
  const invitation = state.invitations[invitationId];
  if (!invitation || invitation.membership_id !== membership.membership_id || invitation.enterprise_id !== membership.enterprise_id
      || invitation.manager_subject_id !== membership.manager_subject_id) {
    throw new Error('RECRUITING_INVITATION_SCOPE_DENIED');
  }
  return invitation;
}

function assertAcceptedPreparationRelationship(invitation) {
  if (!invitation?.accepted_at || invitation.state !== 'ACCEPTED' || invitation.revoked_at
      || invitation.consent?.version !== 'recruiting_v1_consent_2026_08'
      || !invitation.consent?.accepted_at) {
    throw new Error('RECRUITING_CONSULTING_ACCEPTED_CONSENT_REQUIRED');
  }
  return invitation;
}

function assertContinuableRecruitingRelationship(invitation) {
  const versionedConsent = invitation?.consent?.version === 'recruiting_v1_consent_2026_08'
    && Boolean(invitation?.consent?.accepted_at);
  // Normalization marks only accepted records that arrived without a consent
  // field, preserving the pre-version migration contract without weakening
  // the new preparation path's exact versioned-consent requirement.
  const governedLegacyConsent = !invitation?.consent && invitation?.legacy_consent_migration_v1 === true;
  if (!invitation?.accepted_at || invitation.state !== 'ACCEPTED' || invitation.revoked_at
      || (!versionedConsent && !governedLegacyConsent)) {
    throw new Error('RECRUITING_ACCEPTED_RELATIONSHIP_REQUIRED');
  }
  return invitation;
}

function requiresGovernedCurrentConsentReinvitation(invitation) {
  return invitation?.state === 'ACCEPTED'
    && Boolean(invitation.accepted_at)
    && !invitation.revoked_at
    && invitation.legacy_consent_migration_v1 === true
    && invitation.consent?.version !== 'recruiting_v1_consent_2026_08';
}

function assertPreparationMutationAuthority(state, invitation, authority, now) {
  if (authority?.mode !== 'recruiting_manager_candidate_preparation'
      || authority.relationship_ref !== invitation?.invitation_id
      || authority.candidate_id !== invitation?.candidate_id
      || (authority.bos_job_id || null) !== (invitation?.bos_job_id || null)
      || normalizeProfileId(authority.profile_id) !== normalizeProfileId(invitation?.bos_profile_id)
      || (authority.assessment_id || null) !== (invitation?.ba_assessment_id || null)) {
    throw new Error('RECRUITING_CONSULTING_PREPARATION_AUTHORITY_CHANGED');
  }
  const sessionDigest = String(authority.actor_session_digest || '');
  const session = state.manager_sessions?.[sessionDigest];
  if (!session || Date.parse(session.expires_at) <= at(now).getTime()) {
    throw new Error('RECRUITING_MANAGER_SESSION_REQUIRED');
  }
  const membership = assertMembership(state.memberships?.[authority.actor_membership_id]);
  if (session.membership_id !== authority.actor_membership_id
      || session.enterprise_id !== authority.actor_enterprise_id
      || session.manager_subject_id !== authority.actor_manager_subject_id
      || membership.membership_id !== authority.actor_membership_id
      || membership.enterprise_id !== authority.actor_enterprise_id
      || membership.manager_subject_id !== authority.actor_manager_subject_id
      || invitation.membership_id !== membership.membership_id
      || invitation.enterprise_id !== membership.enterprise_id
      || invitation.manager_subject_id !== membership.manager_subject_id) {
    throw new Error('RECRUITING_MANAGER_SESSION_SCOPE_INVALID');
  }
  return assertAcceptedPreparationRelationship(invitation);
}

function agreedPlanEmailAuthority(state, session) {
  const membership = state.memberships?.[session?.manager_binding?.membership_id];
  const relationship = state.consultation_relationships?.[session?.relationship_id];
  if (!membership || membership.status !== 'ACTIVE' || membership.setup_state !== 'COMPLETE'
      || !normalizeEmail(membership.manager_email)
      || session.manager_binding.subject_id !== membership.manager_subject_id
      || session.manager_binding.enterprise_id !== membership.enterprise_id) {
    throw new Error('CONSULTING_MANAGER_EMAIL_AUTHORITY_REQUIRED');
  }
  if (!relationship || relationship.status !== 'ACTIVE' || !normalizeProfileId(session.subject_binding.profile_id)
      || relationship.membership_id !== membership.membership_id
      || relationship.manager_subject_id !== membership.manager_subject_id
      || relationship.enterprise_id !== membership.enterprise_id
      || normalizeProfileId(relationship.profile_id) !== normalizeProfileId(session.subject_binding.profile_id)) {
    throw new Error('CONSULTING_PERSON_EMAIL_AUTHORITY_REQUIRED');
  }
  let invitation = null;
  let personEmail = null;
  if (session.subject_binding.candidate_id) {
    invitation = Object.values(state.invitations || {}).find((item) => item.candidate_id === session.subject_binding.candidate_id);
    if (!invitation || invitation.state !== 'ACCEPTED' || !invitation.accepted_at || invitation.revoked_at
        || invitation.consent?.version !== 'recruiting_v1_consent_2026_08' || !invitation.consent?.accepted_at
        || invitation.membership_id !== membership.membership_id
        || invitation.manager_subject_id !== membership.manager_subject_id || invitation.enterprise_id !== membership.enterprise_id
        || relationship.candidate_id !== invitation.candidate_id || relationship.consent_state !== 'RECRUITING_INVITATION_ACCEPTED'
        || normalizeProfileId(invitation.bos_profile_id) !== normalizeProfileId(session.subject_binding.profile_id)) {
      throw new Error('CONSULTING_PERSON_EMAIL_AUTHORITY_REQUIRED');
    }
    personEmail = normalizeEmail(invitation.recruit_email);
  } else {
    const request = state.consultation_requests?.[session.subject_binding.consultation_request_id];
    if (!request || request.status !== 'APPROVED' || request.relationship_id !== relationship.relationship_id
        || relationship.consultation_request_id !== request.request_id
        || relationship.consent_state !== 'OWNER_APPROVED_MORE_ID_CONSULTATION'
        || request.membership_id !== membership.membership_id || request.manager_subject_id !== membership.manager_subject_id
        || request.enterprise_id !== membership.enterprise_id
        || normalizeProfileId(request.profile_id) !== normalizeProfileId(session.subject_binding.profile_id)) {
      throw new Error('CONSULTING_PERSON_EMAIL_AUTHORITY_REQUIRED');
    }
    personEmail = normalizeEmail(request.owner_email);
  }
  if (!personEmail) throw new Error('CONSULTING_PERSON_EMAIL_AUTHORITY_REQUIRED');
  return { membership, invitation, personEmail };
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
    invitation_token_generation: Number.isInteger(invitation?.token_generation) ? invitation.token_generation : null,
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

function bindBosProfileInState(state, invitation, normalizedProfileId, now) {
  invitation.bos_profile_id = normalizedProfileId;
  invitation.readiness_state = 'BOS_READY';
  invitation.updated_at = iso(now);
  const membership = state.memberships[invitation.membership_id];
  const noticeKey = stableHash({
    invitation_id: invitation.invitation_id,
    event: 'BOS_READY',
    profile_id: normalizedProfileId,
  });
  addInbox(state, invitation.membership_id, {
    idempotency_key: noticeKey,
    kind: 'BOS_READY',
    candidate_id: invitation.candidate_id,
    title: `${invitation.recruit_name}'s BOS is ready.`,
    body: 'Recruiting Intelligence can now begin with explicit business missingness.',
  }, now);
  enqueue(state, {
    kind: 'MANAGER_BOS_READY',
    recipient: membership.manager_email,
    membership,
    invitation,
    payload: { candidate_id: invitation.candidate_id, recruit_name: invitation.recruit_name },
  }, now);
  audit(state, 'CANDIDATE_BOS_READY', {
    invitation_id: invitation.invitation_id,
    candidate_id: invitation.candidate_id,
    profile_id: normalizedProfileId,
  }, now);
  return publicInvitation(invitation);
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
  constructor({
    store,
    now = () => new Date(),
    transport = null,
    tokenWrapper = null,
    profileValidator = null,
    profileOwnerReader = null,
    canonicalReadinessReader = null,
  }) {
    if (!store) throw new TypeError('RECRUITING_STORE_REQUIRED');
    this.store = store;
    this.now = now;
    this.transport = transport;
    this.tokenWrapper = tokenWrapper || createTokenWrapper('recruiting-v1-test-only-token-wrap-key');
    this.profileValidator = profileValidator || (async (profileId) => ({ found: Boolean(normalizeProfileId(profileId)), profile_id: normalizeProfileId(profileId) }));
    this.profileOwnerReader = profileOwnerReader;
    this.canonicalReadinessReader = canonicalReadinessReader;
  }

  async projectConsultingReadiness(invitation, membership) {
    const projection = publicInvitation(invitation, membership);
    if (!projection.consulting_ready || typeof this.canonicalReadinessReader !== 'function') return projection;
    let current;
    try {
      current = await this.canonicalReadinessReader({
        membership: clone(membership),
        invitation: clone(projection),
        canonical_readiness: {
          bos_profile_id: invitation.bos_profile_id,
          ba_assessment_id: invitation.ba_assessment_id,
          ba_realization_receipt: clone(invitation.ba_realization_receipt),
        },
      });
    } catch {
      return { ...projection, consulting_ready: false, consulting_blocker: 'RECRUITING_CONSULTING_CANONICAL_VERIFICATION_UNAVAILABLE', progress_label: 'Results need verification', progress_state: 'BOS_COMPLETE' };
    }
    const receipt = invitation.ba_realization_receipt;
    const currentMatches = current?.ready === true
      && normalizeProfileId(current.profile_id) === normalizeProfileId(invitation.bos_profile_id)
      && current.assessment_id === invitation.ba_assessment_id
      && current.realization_id === receipt.realization_id
      && current.realization_sha256 === receipt.realization_sha256
      && current.artifact_sha256 === receipt.artifact_sha256;
    return currentMatches ? projection : {
      ...projection,
      consulting_ready: false,
      consulting_blocker: 'RECRUITING_CONSULTING_CURRENT_CANONICAL_MISMATCH',
      progress_label: 'Results need verification',
      progress_state: 'BOS_COMPLETE',
    };
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
        ...entitlementProjection(state, membership, now),
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
      ...entitlementProjection(state, membership, now),
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
      const replay = normalizedIdempotency && Object.values(state.invitations).find((item) => item.membership_id === membership.membership_id && item.idempotency_key === normalizedIdempotency);
      if (replay && normalizeEmail(replay.recruit_email) !== recruitEmail) throw new Error('RECRUITING_INVITATION_IDEMPOTENCY_IDENTITY_MISMATCH');
      if (replay) return { invitation: publicInvitation(invitationInScope(state, membership, replay.invitation_id), membership), idempotent: true, ...entitlementProjection(state, membership, now) };
      const duplicate = Object.values(state.invitations).find((item) => item.membership_id === membership.membership_id && normalizeEmail(item.recruit_email) === recruitEmail);
      if (duplicate) return { invitation: publicInvitation(invitationInScope(state, membership, duplicate.invitation_id), membership), idempotent: true, duplicate_active: true, ...entitlementProjection(state, membership, now) };
      const entitlements = entitlementsFor(state, membership, now);
      assertPairCanReserve(entitlements, { invitationRemaining: entitlementProjection(state, membership, now).invitation_allowance.remaining });
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
        paired_entitlement_version: 1,
        bos_entitlement_state: 'RESERVED',
        ba_entitlement_state: 'RESERVED',
        entitlement_state: 'RESERVED',
        entitlement_period_start: entitlements.bos.period_start,
        entitlement_period_end: entitlements.bos.period_end,
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
      return { invitation: publicInvitation(invitation), invitation_token: token, outbox_id: outbox.outbox_id, idempotent: false, ...entitlementProjection(state, membership, now) };
    });
    if (this.transport?.synthetic !== true) delete result.invitation_token;
    if (result.idempotent && result.invitation.consulting_ready && this.canonicalReadinessReader) {
      result.invitation = (await this.candidateContext(sessionToken, result.invitation.candidate_id)).invitation;
    }
    return result;
  }

  async resendInvitation(sessionToken, invitationId, { expectedResendCount = null, idempotencyKey = null } = {}) {
    const token = createOpaqueToken();
    const result = await this.store.transaction((state) => {
      const now = this.now();
      expireDueInvitations(state, now);
      const { membership } = membershipFromSession(state, sessionToken, now);
      const invitation = invitationInScope(state, membership, invitationId);
      if (invitation.accepted_at || invitation.state === 'REVOKED') throw new Error('RECRUITING_INVITATION_RESEND_DENIED');
      if (expectedResendCount !== null && (!Number.isInteger(expectedResendCount) || expectedResendCount < 0)) throw new Error('RECRUITING_INVITATION_RESEND_REVISION_INVALID');
      const resendKey = boundedText(idempotencyKey, 180);
      if ((resendKey && invitation.last_resend_idempotency_key === resendKey)
          || (expectedResendCount !== null && expectedResendCount !== Number(invitation.resend_count || 0))) {
        return { invitation: publicInvitation(invitation, membership), idempotent: true, resend_superseded: true, ...entitlementProjection(state, membership, now) };
      }
      reserveEntitlementPair(state, membership, invitation, now);
      invitation.state = 'ISSUED';
      invitation.delivery_state = 'PENDING';
      invitation.token_digest = digestToken(token);
      invitation.token_generation = Number(invitation.token_generation || 0) + 1;
      invitation.resend_count = Number(invitation.resend_count || 0) + 1;
      if (resendKey) invitation.last_resend_idempotency_key = resendKey;
      invitation.issued_at = iso(now);
      invitation.expires_at = iso(new Date(at(now).getTime() + INVITATION_TTL_MS));
      invitation.updated_at = iso(now);
      const outbox = enqueue(state, {
        kind: 'RECRUIT_INVITATION', recipient: invitation.recruit_email, invitation,
        payload: { recruit_name: invitation.recruit_name, inviter_name: membership.manager_name, enterprise_name: membership.enterprise_name, purpose: invitation.purpose },
        tokenCapsule: this.tokenWrapper.wrap(token),
      }, now);
      audit(state, 'INVITATION_RESENT', { invitation_id: invitation.invitation_id, token_generation: invitation.token_generation }, now);
      return { invitation: publicInvitation(invitation), invitation_token: token, outbox_id: outbox.outbox_id, ...entitlementProjection(state, membership, now) };
    });
    if (this.transport?.synthetic !== true) delete result.invitation_token;
    return result;
  }

  async requestCurrentConsent(sessionToken, invitationId, { expectedGeneration = null, idempotencyKey = null } = {}) {
    const token = createOpaqueToken();
    const result = await this.store.transaction((state) => {
      const now = this.now();
      expireDueInvitations(state, now);
      const { membership } = membershipFromSession(state, sessionToken, now);
      const invitation = invitationInScope(state, membership, invitationId);
      if (invitation.consent?.version === 'recruiting_v1_consent_2026_08' && invitation.consent?.accepted_at) {
        return { invitation: publicInvitation(invitation, membership), idempotent: true, consent_current: true, ...entitlementProjection(state, membership, now) };
      }
      if (!requiresGovernedCurrentConsentReinvitation(invitation)) {
        throw new Error('RECRUITING_CURRENT_CONSENT_REQUEST_DENIED');
      }
      if (!Number.isInteger(expectedGeneration) || expectedGeneration < 0) {
        throw new Error('RECRUITING_CURRENT_CONSENT_REVISION_REQUIRED');
      }
      const currentGeneration = Number(invitation.current_consent_request?.generation || 0);
      const currentOutbox = state.outbox?.[invitation.current_consent_request?.outbox_id];
      if (expectedGeneration !== currentGeneration) {
        return {
          invitation: publicInvitation(invitation, membership),
          outbox_id: currentOutbox?.state === 'PENDING' ? currentOutbox.outbox_id : undefined,
          idempotent: true,
          request_superseded: true,
          ...entitlementProjection(state, membership, now),
        };
      }
      const activeRequest = invitation.current_consent_request
        && Date.parse(invitation.current_consent_request.expires_at) > at(now).getTime()
        && ['PENDING', 'DELIVERED'].includes(invitation.current_consent_request.delivery_state);
      if (activeRequest) {
        return {
          invitation: publicInvitation(invitation, membership),
          outbox_id: currentOutbox?.state === 'PENDING' ? currentOutbox.outbox_id : undefined,
          idempotent: true,
          request_active: true,
          ...entitlementProjection(state, membership, now),
        };
      }
      const generation = currentGeneration + 1;
      const expiresAt = iso(new Date(at(now).getTime() + INVITATION_TTL_MS));
      invitation.token_digest = digestToken(token);
      invitation.token_generation = Number(invitation.token_generation || 0) + 1;
      invitation.current_consent_request = {
        generation,
        token_generation: invitation.token_generation,
        delivery_state: 'PENDING',
        requested_at: iso(now),
        expires_at: expiresAt,
        idempotency_key: boundedText(idempotencyKey, 180) || null,
      };
      invitation.updated_at = iso(now);
      const outbox = enqueue(state, {
        kind: 'RECRUIT_CURRENT_CONSENT',
        recipient: invitation.recruit_email,
        invitation,
        payload: {
          recruit_name: invitation.recruit_name,
          inviter_name: membership.manager_name,
          enterprise_name: membership.enterprise_name,
          purpose: invitation.purpose,
          consent_version: 'recruiting_v1_consent_2026_08',
        },
        tokenCapsule: this.tokenWrapper.wrap(token),
      }, now);
      invitation.current_consent_request.outbox_id = outbox.outbox_id;
      audit(state, 'CURRENT_CONSENT_REQUESTED', {
        invitation_id: invitation.invitation_id,
        candidate_id: invitation.candidate_id,
        generation,
      }, now);
      return {
        invitation: publicInvitation(invitation, membership),
        invitation_token: token,
        outbox_id: outbox.outbox_id,
        idempotent: false,
        ...entitlementProjection(state, membership, now),
      };
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
      releaseEntitlementPair(invitation);
      audit(state, 'INVITATION_REVOKED', { invitation_id: invitation.invitation_id }, now);
      return { invitation: publicInvitation(invitation), ...entitlementProjection(state, membership, now) };
    });
  }

  async invitationPreview(token) {
    return this.store.transaction((state) => {
      const now = this.now();
      expireDueInvitations(state, now);
      const invitation = Object.values(state.invitations).find((item) => item.token_digest === digestToken(token));
      const consentRefresh = invitation
        && requiresGovernedCurrentConsentReinvitation(invitation)
        && invitation.current_consent_request?.token_generation === invitation.token_generation
        && Date.parse(invitation.current_consent_request?.expires_at) > at(now).getTime();
      if (!invitation || (!['ISSUED', 'DELIVERED'].includes(invitation.state) && !consentRefresh)) throw new Error('RECRUITING_INVITATION_TOKEN_INVALID');
      const membership = assertMembership(state.memberships[invitation.membership_id]);
      return {
        invitation_id: invitation.invitation_id,
        recruit_name: invitation.recruit_name,
        inviter_name: membership.manager_name,
        enterprise_name: membership.enterprise_name,
        purpose: invitation.purpose,
        expires_at: consentRefresh ? invitation.current_consent_request.expires_at : invitation.expires_at,
        current_consent_refresh: Boolean(consentRefresh),
      };
    });
  }

  async acceptInvitation(token, consent) {
    const inviteSessionToken = createOpaqueToken();
    const result = await this.store.transaction((state) => {
      const now = this.now();
      expireDueInvitations(state, now);
      const invitation = Object.values(state.invitations).find((item) => item.token_digest === digestToken(token));
      const consentRefresh = invitation
        && requiresGovernedCurrentConsentReinvitation(invitation)
        && invitation.current_consent_request?.token_generation === invitation.token_generation
        && Date.parse(invitation.current_consent_request?.expires_at) > at(now).getTime();
      if (!invitation || (!['ISSUED', 'DELIVERED'].includes(invitation.state) && !consentRefresh)) throw new Error('RECRUITING_INVITATION_TOKEN_INVALID');
      assertMembership(state.memberships[invitation.membership_id]);
      if (consent?.accepted !== true || boundedText(consent?.version, 80) !== 'recruiting_v1_consent_2026_08') throw new Error('RECRUITING_INVITATION_CONSENT_REQUIRED');
      if (!consentRefresh) {
        invitation.state = 'ACCEPTED';
        invitation.readiness_state = 'CONSENTED';
        invitation.accepted_at = iso(now);
        invitation.paired_entitlement_version = 1;
        invitation.bos_entitlement_state = 'CONSUMED';
        invitation.ba_entitlement_state = 'RESERVED';
        invitation.entitlement_state = 'CONSUMED';
      }
      invitation.updated_at = iso(now);
      invitation.token_digest = null;
      invitation.consent = { version: consent.version, accepted_at: iso(now), purpose: 'RECRUITING_INTELLIGENCE' };
      if (consentRefresh) {
        invitation.current_consent_request = {
          ...invitation.current_consent_request,
          delivery_state: 'ACCEPTED',
          accepted_at: iso(now),
        };
      }
      const session = {
        invite_session_id: createOpaqueId('invite_session'),
        invitation_id: invitation.invitation_id,
        candidate_id: invitation.candidate_id,
        enterprise_id: invitation.enterprise_id,
        issued_at: iso(now),
        expires_at: iso(new Date(at(now).getTime() + 30 * 24 * 60 * 60 * 1000)),
      };
      state.invite_sessions[digestToken(inviteSessionToken)] = session;
      audit(state, consentRefresh ? 'CURRENT_CONSENT_ACCEPTED' : 'INVITATION_ACCEPTED', { invitation_id: invitation.invitation_id, candidate_id: invitation.candidate_id }, now);
      return { invitation: publicInvitation(invitation), invite_session: session };
    });
    return { ...result, invite_session_token: inviteSessionToken };
  }

  async inspectInviteSession(inviteSessionToken) {
    const state = await this.store.read();
    const { session, invitation } = inviteFromSession(state, inviteSessionToken, this.now());
    const invitationProjection = publicInvitation(invitation);
    return {
      invite_session: clone(session),
      relationship: {
        relationship_ref: invitation.invitation_id,
        candidate_id: invitation.candidate_id,
        readiness_state: invitation.readiness_state,
        progress_state: invitationProjection.progress_state,
        bos_job_id: invitation.bos_job_id || null,
        bos_profile_id: invitation.bos_profile_id || null,
        ba_assessment_id: invitation.ba_assessment_id || null,
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
      expireDueInvitations(state, now);
      const item = state.outbox[outboxId];
      if (!item) throw new Error('RECRUITING_OUTBOX_ITEM_NOT_FOUND');
      if (item.state === 'DELIVERED') return { item, idempotent: true };
      if (!['PENDING', 'SENDING'].includes(item.state)) throw new Error('RECRUITING_OUTBOX_DELIVERY_STATE_INVALID');
      item.attempts += 1;
      item.updated_at = iso(now);
      item.state = outcome?.success ? 'DELIVERED' : 'FAILED';
      item.provider_receipt = outcome?.receipt ? boundedText(outcome.receipt, 300) : null;
      const invitation = item.invitation_id ? state.invitations[item.invitation_id] : null;
      const currentInvitationOutbox = invitation && item.kind === 'RECRUIT_INVITATION'
        ? Number.isInteger(item.invitation_token_generation)
          ? item.invitation_token_generation === invitation.token_generation
          : Object.values(state.outbox)
            .filter((candidate) => candidate.kind === 'RECRUIT_INVITATION' && candidate.invitation_id === invitation.invitation_id)
            .at(-1)?.outbox_id === item.outbox_id
        : false;
      if (currentInvitationOutbox) {
        invitation.delivery_state = outcome?.success ? 'DELIVERED' : 'DELIVERY_FAILED';
        if (!invitation.accepted_at && !['REVOKED', 'EXPIRED'].includes(invitation.state)) {
          invitation.state = outcome?.success ? 'DELIVERED' : 'DELIVERY_FAILED';
        }
        invitation.updated_at = iso(now);
        if (!outcome?.success && !invitation.accepted_at) releaseEntitlementPair(invitation);
      }
      const currentConsentOutbox = invitation && item.kind === 'RECRUIT_CURRENT_CONSENT'
        && item.invitation_token_generation === invitation.token_generation
        && invitation.current_consent_request?.token_generation === invitation.token_generation
        && invitation.current_consent_request?.delivery_state === 'PENDING'
        && !invitation.current_consent_request?.accepted_at;
      if (currentConsentOutbox) {
        invitation.current_consent_request.delivery_state = outcome?.success ? 'DELIVERED' : 'DELIVERY_FAILED';
        invitation.current_consent_request.updated_at = iso(now);
        invitation.updated_at = iso(now);
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
      expireDueInvitations(state, now);
      const item = state.outbox[outboxId];
      if (!item) throw new Error('RECRUITING_OUTBOX_ITEM_NOT_FOUND');
      if (item.state === 'DELIVERED') return { item: clone(item), deliver: false, idempotent: true };
      const staleSending = item.state === 'SENDING'
        && Date.parse(item.delivery_started_at || item.updated_at || item.created_at) <= at(now).getTime() - 2 * 60 * 1000;
      if (item.state !== 'PENDING' && !staleSending) return { item: clone(item), deliver: false, idempotent: false };
      if (item.kind === 'RECRUIT_CURRENT_CONSENT') {
        const invitation = state.invitations?.[item.invitation_id];
        const request = invitation?.current_consent_request;
        let membershipActive = false;
        try {
          const membership = assertMembership(state.memberships?.[invitation?.membership_id]);
          membershipActive = invitation.manager_subject_id === membership.manager_subject_id
            && invitation.enterprise_id === membership.enterprise_id;
        } catch { membershipActive = false; }
        const authorized = membershipActive
          && requiresGovernedCurrentConsentReinvitation(invitation)
          && request?.outbox_id === item.outbox_id
          && request?.token_generation === invitation.token_generation
          && item.invitation_token_generation === invitation.token_generation
          && request?.delivery_state === 'PENDING'
          && Date.parse(request.expires_at) > at(now).getTime();
        if (!authorized) {
          const exactCurrentRequest = request?.outbox_id === item.outbox_id
            && request?.token_generation === invitation?.token_generation
            && item.invitation_token_generation === invitation?.token_generation;
          if (exactCurrentRequest && request.delivery_state === 'PENDING') {
            request.delivery_state = 'CANCELLED';
            request.updated_at = iso(now);
            invitation.token_digest = null;
            invitation.updated_at = iso(now);
          }
          item.state = 'CANCELLED';
          item.updated_at = iso(now);
          audit(state, 'CURRENT_CONSENT_DELIVERY_CANCELLED', {
            outbox_id: item.outbox_id,
            invitation_id: item.invitation_id,
          }, now);
          return { item: clone(item), deliver: false, idempotent: false };
        }
      }
      if (item.kind === 'CONSULTING_AGREED_PLAN') {
        const session = Object.values(state.shared_business_sessions || {}).find((candidate) => candidate.accepted_plan_snapshot?.acceptance_id === item.payload?.acceptance_id);
        const authority = agreedPlanEmailAuthority(state, session);
        const expectedRecipient = item.payload.recipient_role === 'PERSON' ? authority.personEmail
          : item.payload.recipient_role === 'MANAGER' ? normalizeEmail(authority.membership.manager_email) : null;
        if (session.status !== 'COMPLETED' || expectedRecipient !== normalizeEmail(item.recipient)
            || stableHash(session.accepted_plan_snapshot) !== stableHash(item.payload.accepted_plan_snapshot)) {
          throw new Error('CONSULTING_AGREED_PLAN_OUTBOX_AUTHORITY_MISMATCH');
        }
      }
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

  async projectBosInProgress(invitationId, { job_id: jobId, preparation_authority: preparationAuthority = null } = {}) {
    const normalizedJobId = normalizeBosJobId(jobId);
    if (!normalizedJobId) throw new Error('RECRUITING_BOS_JOB_BINDING_REQUIRED');
    return this.store.transaction((state) => {
      const now = this.now();
      const invitation = state.invitations[invitationId];
      if (preparationAuthority) assertPreparationMutationAuthority(state, invitation, preparationAuthority, now);
      else assertContinuableRecruitingRelationship(invitation);
      if (invitation.bos_job_id && invitation.bos_job_id !== normalizedJobId) {
        throw new Error('RECRUITING_BOS_JOB_REBIND_DENIED');
      }
      if (invitation.bos_profile_id || ['BOS_READY', 'BA_INTAKE_SAVED', 'BA_IN_PROGRESS', 'BA_INTELLIGENCE_READY'].includes(invitation.readiness_state)) {
        return publicInvitation(invitation);
      }
      if (invitation.readiness_state === 'BOS_IN_PROGRESS' && invitation.bos_job_id === normalizedJobId) {
        return publicInvitation(invitation);
      }
      invitation.bos_job_id = normalizedJobId;
      invitation.readiness_state = 'BOS_IN_PROGRESS';
      invitation.updated_at = iso(now);
      audit(state, 'CANDIDATE_BOS_IN_PROGRESS', { invitation_id: invitation.invitation_id, candidate_id: invitation.candidate_id }, now);
      return publicInvitation(invitation);
    });
  }

  async bindBosProfile(invitationId, profileId, vaultReceipt = {}, { preparationAuthority = null } = {}) {
    const normalized = normalizeProfileId(profileId);
    if (!normalized || vaultReceipt.verified !== true) throw new Error('RECRUITING_VERIFIED_BOS_VAULT_RECEIPT_REQUIRED');
    return this.store.transaction((state) => {
      const now = this.now();
      const invitation = state.invitations[invitationId];
      if (preparationAuthority) assertPreparationMutationAuthority(state, invitation, preparationAuthority, now);
      else assertContinuableRecruitingRelationship(invitation);
      if (invitation.bos_profile_id && invitation.bos_profile_id !== normalized) throw new Error('RECRUITING_BOS_PROFILE_REBIND_DENIED');
      if (invitation.bos_profile_id === normalized) return publicInvitation(invitation);
      return bindBosProfileInState(state, invitation, normalized, now);
    });
  }

  async connectOwnedExistingProfile(inviteSessionToken, { profile_id: profileId } = {}) {
    const normalized = normalizeProfileId(profileId);
    if (!normalized) throw new Error('RECRUITING_PROFILE_OWNER_RECEIPT_REQUIRED');
    if (typeof this.profileOwnerReader !== 'function') {
      throw new Error('RECRUITING_EXISTING_PROFILE_CONNECTION_UNAVAILABLE');
    }

    // Validate the accepted invitation before consulting any Profile record.
    // The same invitation and email scope are checked again in the write.
    const preflight = await this.store.read();
    const { invitation: preflightInvitation } = inviteFromSession(preflight, inviteSessionToken, this.now());
    const invitationEmail = normalizeEmail(preflightInvitation.recruit_email);
    const [owner, validation] = await Promise.all([
      this.profileOwnerReader(normalized),
      this.profileValidator(normalized),
    ]);
    const canonicalOwnerEmail = normalizeEmail(owner?.recipient_email);
    if (normalizeProfileId(owner?.profile_id) !== normalized || !canonicalOwnerEmail) {
      throw new Error('RECRUITING_EXISTING_PROFILE_OWNERSHIP_SCOPE_DENIED');
    }
    if (canonicalOwnerEmail !== invitationEmail) {
      throw new Error('RECRUITING_EXISTING_PROFILE_EMAIL_SCOPE_DENIED');
    }
    // A found canonical Profile is the persisted completion receipt for BOS.
    if (validation?.found !== true
        || normalizeProfileId(validation.profile_id || normalized) !== normalized) {
      throw new Error('RECRUITING_COMPLETED_BOS_REQUIRED');
    }

    return this.store.transaction((state) => {
      const now = this.now();
      const { invitation } = inviteFromSession(state, inviteSessionToken, now);
      if (normalizeEmail(invitation.recruit_email) !== canonicalOwnerEmail) {
        throw new Error('RECRUITING_EXISTING_PROFILE_EMAIL_SCOPE_DENIED');
      }
      if (invitation.bos_profile_id && invitation.bos_profile_id !== normalized) {
        throw new Error('RECRUITING_BOS_PROFILE_REBIND_DENIED');
      }
      if (invitation.bos_profile_id === normalized) return publicInvitation(invitation);
      return bindBosProfileInState(state, invitation, normalized, now);
    });
  }

  async projectBaState(invitationId, {
    assessment_id = null,
    state: baState,
    canonical_receipt = null,
    preparation_authority: preparationAuthority = null,
    canonical_source_guard: canonicalSourceGuard = null,
  }) {
    if (!['BA_INTAKE_SAVED', 'BA_IN_PROGRESS', 'BA_INTELLIGENCE_READY'].includes(baState)) throw new Error('RECRUITING_BA_STATE_INVALID');
    if (baState === 'BA_INTELLIGENCE_READY'
        && (canonical_receipt?.contract !== 'recruiting_canonical_new_ba_ready_receipt_v1'
          || canonical_receipt?.assessment_id !== assessment_id
          || canonical_receipt?.completeness !== 'PASS'
          || canonical_receipt?.customer_projection_completeness !== 'COMPLETE'
          || !canonical_receipt?.realization_id
          || !/^[a-f0-9]{64}$/u.test(String(canonical_receipt?.realization_sha256 || ''))
          || !/^[a-f0-9]{64}$/u.test(String(canonical_receipt?.artifact_sha256 || '')))) {
      throw new Error('RECRUITING_CANONICAL_BA_RECEIPT_REQUIRED');
    }
    if (canonicalSourceGuard
        && (!['BA_INTAKE_SAVED', 'BA_INTELLIGENCE_READY'].includes(baState)
          || typeof this.store.transactionWithExternalStringGuards !== 'function')) {
      throw new Error('RECRUITING_CANONICAL_BA_ATOMIC_SOURCE_GUARD_REQUIRED');
    }
    const mutate = (state) => {
      const now = this.now();
      const invitation = state.invitations[invitationId];
      if (!invitation?.bos_profile_id) throw new Error('RECRUITING_BOS_READY_REQUIRED_FOR_BA');
      if (preparationAuthority) assertPreparationMutationAuthority(state, invitation, preparationAuthority, now);
      else assertContinuableRecruitingRelationship(invitation);
      if (canonical_receipt && normalizeProfileId(canonical_receipt.profile_id) !== normalizeProfileId(invitation.bos_profile_id)) {
        throw new Error('RECRUITING_CANONICAL_BA_PROFILE_MISMATCH');
      }
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
      invitation.paired_entitlement_version = 1;
      invitation.ba_entitlement_state = 'CONSUMED';
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
    };
    return canonicalSourceGuard
      ? this.store.transactionWithExternalStringGuards(mutate, canonicalSourceGuard)
      : this.store.transaction(mutate);
  }

  async home(sessionToken) {
    const snapshot = await this.store.transaction((state) => {
      const now = this.now();
      expireDueInvitations(state, now);
      const { membership } = membershipFromSession(state, sessionToken, now);
      const invitations = Object.values(state.invitations).filter((item) => item.membership_id === membership.membership_id
        && item.manager_subject_id === membership.manager_subject_id && item.enterprise_id === membership.enterprise_id)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      return {
        membership: clone(membership),
        manager: {
          name: membership.manager_name,
          enterprise_name: membership.enterprise_name,
          profile_id: membership.manager_profile_id,
          capabilities: { master_control: Array.isArray(membership.admin_roles) && membership.admin_roles.includes('RECRUITING_ADMIN') },
        },
        ...entitlementProjection(state, membership, now),
        invitations: clone(invitations),
        notifications: clone(state.inbox_by_membership[membership.membership_id] || []),
        existing_recruit: { available: false, code: 'EXACT_SCOPE_CONSENT_AUTHORITY_REQUIRED', safe_action: 'INVITE_EXISTING_AGENT' },
      };
    });
    const candidates = await Promise.all(snapshot.invitations.map((invitation) => this.projectConsultingReadiness(invitation, snapshot.membership)));
    // Canonical reads happen outside the mutation lock. Recheck relationship
    // authority afterward so a revoke/rebind cannot publish a stale ready row.
    const current = await this.store.read();
    const { membership } = membershipFromSession(current, sessionToken, this.now());
    const permitted = candidates.flatMap((candidate, index) => {
      const invitation = current.invitations[candidate.invitation_id];
      if (!invitation || invitation.membership_id !== membership.membership_id
          || invitation.manager_subject_id !== membership.manager_subject_id || invitation.enterprise_id !== membership.enterprise_id) return [];
      if (stableHash(invitation) !== stableHash(snapshot.invitations[index])) {
        return [{ ...publicInvitation(invitation, membership), consulting_ready: false, consulting_blocker: 'RECRUITING_CONSULTING_READINESS_CHANGED_RETRY', progress_label: 'Refresh to check results', progress_state: invitation.bos_profile_id ? 'BOS_COMPLETE' : 'INVITED' }];
      }
      return [candidate];
    });
    const { invitations: _invitations, membership: _membership, ...result } = snapshot;
    return { ...result, candidates: permitted };
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
    if (!invitation || invitation.membership_id !== membership.membership_id || invitation.enterprise_id !== membership.enterprise_id
        || invitation.manager_subject_id !== membership.manager_subject_id) throw new Error('RECRUITING_CANDIDATE_SCOPE_DENIED');
    const projection = await this.projectConsultingReadiness(invitation, membership);
    const current = await this.store.read();
    membershipFromSession(current, sessionToken, this.now());
    if (stableHash(current.invitations[invitation.invitation_id]) !== stableHash(invitation)
        || stableHash(current.memberships[membership.membership_id]) !== stableHash(membership)) {
      throw new Error('RECRUITING_CONSULTING_READINESS_CHANGED_RETRY');
    }
    return {
      membership: clone(membership),
      invitation: projection,
      canonical_readiness: consultingReadinessFor(invitation, membership).ready ? {
        bos_profile_id: invitation.bos_profile_id,
        ba_assessment_id: invitation.ba_assessment_id,
        ba_realization_receipt: clone(invitation.ba_realization_receipt),
      } : null,
      opportunity: clone(state.opportunity_by_enterprise[membership.enterprise_id] || { items: [] }),
      manager_evidence: clone(state.evidence_by_candidate[candidateId] || []),
      intelligence: clone(state.intelligence_by_candidate[candidateId] || null),
    };
  }

  /**
   * Private server authority for preparing a candidate's already-consented
   * Consulting inputs. It exposes durable locators only to the coordinator;
   * the HTTP action returns the public candidate projection instead.
   */
  async inspectCandidatePreparationAuthority(sessionToken, candidateId) {
    const state = await this.store.read();
    const now = this.now();
    const { membership: actor, digest: actorSessionDigest } = membershipFromSession(state, sessionToken, now);
    const matches = Object.values(state.invitations).filter((item) => item.candidate_id === candidateId);
    if (matches.length !== 1) throw new Error('RECRUITING_CANDIDATE_SCOPE_DENIED');
    const invitation = matches[0];
    const targetMembership = state.memberships[invitation.membership_id];
    if (!targetMembership) throw new Error('RECRUITING_CANDIDATE_SCOPE_DENIED');

    const directOwner = invitation.membership_id === actor.membership_id
      && invitation.enterprise_id === actor.enterprise_id
      && invitation.manager_subject_id === actor.manager_subject_id;
    if (!directOwner) throw new Error('RECRUITING_CANDIDATE_SCOPE_DENIED');
    assertMembership(targetMembership);
    if (invitation.membership_id !== targetMembership.membership_id
        || invitation.enterprise_id !== targetMembership.enterprise_id
        || invitation.manager_subject_id !== targetMembership.manager_subject_id) {
      throw new Error('RECRUITING_CANDIDATE_SCOPE_DENIED');
    }
    assertAcceptedPreparationRelationship(invitation);

    return Object.freeze({
      mode: 'recruiting_manager_candidate_preparation',
      actor_role: 'OWNING_MANAGER',
      actor_session_digest: actorSessionDigest,
      actor_membership_id: actor.membership_id,
      actor_enterprise_id: actor.enterprise_id,
      actor_manager_subject_id: actor.manager_subject_id,
      relationship_ref: invitation.invitation_id,
      candidate_id: invitation.candidate_id,
      purpose: 'RECRUITING_INTELLIGENCE',
      bos_job_id: invitation.bos_job_id || null,
      profile_id: normalizeProfileId(invitation.bos_profile_id),
      assessment_id: invitation.ba_assessment_id || null,
      ba_readiness: invitation.ba_readiness || 'BA_NOT_STARTED',
      ba_realization_receipt: clone(invitation.ba_realization_receipt || null),
      progress_state: publicInvitation(invitation, targetMembership).progress_state,
      candidate: publicInvitation(invitation, targetMembership),
    });
  }

  /**
   * Revalidate the exact private preparation authority at a downstream write
   * boundary without accepting a browser session token again. This binds the
   * write to the same live manager session, membership, enterprise, subject,
   * relationship, and accepted consent that the coordinator inspected.
   */
  async assertCandidatePreparationAuthority(authority) {
    const state = await this.store.read();
    const now = this.now();
    const invitation = state.invitations[authority?.relationship_ref];
    assertPreparationMutationAuthority(state, invitation, authority, now);
    return { valid: true };
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
      const { membership, invitation, personEmail } = agreedPlanEmailAuthority(state, session);
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
      agreedPlanEmailAuthority(state, session);
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
