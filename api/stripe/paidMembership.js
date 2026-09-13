import {
  createBusinessMembership,
  createCanonicalCustomerSubject,
  membershipScope,
  providerSubjectHash,
} from '../../src/lib/subscriptionV1/identity.js';
import { validateSubscriptionV1Contract } from '../../src/lib/subscriptionV1/contracts.js';
import { canonicalJson, normalizeEmail, normalizeProfileId, sha256 } from '../../src/lib/publicSiteAirlockV1/contracts.js';
import { isExactLegacyBusinessAssessmentComplete } from '../../src/lib/publicSiteAirlockV1/profileStateReader.js';
import { validatePersistedVerticalBinding } from '../business-assessment/verticalBinding.js';

export const PAID_MEMBERSHIP_NAMESPACE = 'more:subscription-v1:paid:v1';
export const PAID_PROFILE_OWNER_ISSUER = 'MORE_MINDMAP_PROFILE_OWNER';

const READY = new Set(['ready', 'complete']);
const SHA256_HEX = /^[a-f0-9]{64}$/u;

function requireText(value, code, max = 160) {
  const text = String(value || '').trim().slice(0, max);
  if (!text) throw new Error(code);
  return text;
}

function stableId(prefix, payload) {
  return `${prefix}_${sha256(canonicalJson(payload)).slice(0, 40)}`;
}

function assessmentIdentity(assessment, profileId) {
  const assessmentId = requireText(assessment?.assessment_id, 'completed_business_assessment_required');
  if (normalizeProfileId(assessment?.owner_profile_id) !== profileId) {
    throw new Error('business_assessment_profile_mismatch');
  }
  let verticalBinding;
  try { verticalBinding = validatePersistedVerticalBinding(assessment?.vertical_binding); }
  catch { throw new Error('business_assessment_vertical_authority_required'); }
  return { assessmentId, verticalBinding };
}

export function createPaidMembershipAuthority({
  issuer = PAID_PROFILE_OWNER_ISSUER,
  provider_subject,
  profile_id,
  profile_state,
  assessment,
  ownership_verified = false,
  created_at = new Date().toISOString(),
} = {}) {
  if (ownership_verified !== true) throw new Error('profile_ownership_required');
  const profileId = normalizeProfileId(profile_id);
  const providerSubject = normalizeEmail(provider_subject);
  if (!profileId || !providerSubject) throw new Error('authenticated_profile_owner_required');
  if (!READY.has(profile_state?.bos) || !READY.has(profile_state?.ba)) {
    throw new Error('completed_bos_and_business_assessment_required');
  }
  const { assessmentId, verticalBinding } = assessmentIdentity(assessment, profileId);
  const normalizedIssuer = requireText(issuer, 'authenticated_profile_owner_required', 200);
  const subjectId = stableId('subject', {
    domain: 'more-paid-subscription-subject-v1',
    issuer: normalizedIssuer,
    provider_subject_hash: providerSubjectHash({ issuer: normalizedIssuer, provider_subject: providerSubject }),
  });
  const tenantId = stableId('tenant', {
    domain: 'more-paid-subscription-tenant-v1',
    profile_id: profileId,
  });
  const businessId = stableId('business', {
    domain: 'more-paid-subscription-business-v1',
    profile_id: profileId,
    assessment_id: assessmentId,
    vertical_binding_sha256: verticalBinding.binding_sha256,
  });
  const membershipId = stableId('membership', {
    domain: 'more-paid-subscription-membership-v1',
    subject_id: subjectId,
    tenant_id: tenantId,
    profile_id: profileId,
    business_id: businessId,
  });
  const subject = createCanonicalCustomerSubject({
    subject_id: subjectId,
    issuer: normalizedIssuer,
    provider_subject: providerSubject,
    created_at,
  });
  const membership = createBusinessMembership({
    membership_id: membershipId,
    subject_id: subjectId,
    tenant_id: tenantId,
    profile_id: profileId,
    business_id: businessId,
    role: 'OWNER',
    status: 'ACTIVE',
    created_at,
  });
  return Object.freeze({
    subject,
    membership,
    scope: membershipScope(membership),
    assessment_id: assessmentId,
    vertical_binding_sha256: verticalBinding.binding_sha256,
    issuer: normalizedIssuer,
    provider_subject_hash: providerSubjectHash({ issuer: normalizedIssuer, provider_subject: providerSubject }),
    membership_binding: Object.freeze({
      ...membershipScope(membership),
      assessment_id: assessmentId,
      binding_source: 'AUTHENTICATED_SERVER_CONTEXT',
      membership_verified: true,
    }),
    raw_provider_subject_stored: false,
  });
}

function keysFor(authority) {
  return {
    subject: `${PAID_MEMBERSHIP_NAMESPACE}:subject:${authority.subject.subject_id}`,
    membership: `${PAID_MEMBERSHIP_NAMESPACE}:membership:${authority.membership.membership_id}`,
    auth: `${PAID_MEMBERSHIP_NAMESPACE}:auth:${sha256(`${authority.issuer}:${authority.provider_subject_hash}`)}`,
    profile: `${PAID_MEMBERSHIP_NAMESPACE}:profile:${authority.membership.profile_id}`,
  };
}

function replayStableIdentity(value) {
  const projected = JSON.parse(JSON.stringify(value));
  delete projected.created_at;
  delete projected.updated_at;
  if (Array.isArray(projected.auth_bindings)) {
    projected.auth_bindings = projected.auth_bindings.map((binding) => {
      const stable = { ...binding };
      delete stable.bound_at;
      return stable;
    });
  }
  return canonicalJson(projected);
}

async function putImmutable(store, key, value, collisionCode, { tolerateReplayTime = false } = {}) {
  const serialized = typeof value === 'string' ? value : canonicalJson(value);
  if (await store.setNx(key, serialized)) return 'CREATED';
  const existing = await store.get(key);
  if (existing !== serialized) {
    let existingValue = null;
    try { existingValue = JSON.parse(existing); } catch { /* collision below */ }
    const existingContract = existingValue && validateSubscriptionV1Contract(existingValue);
    if (!tolerateReplayTime
      || !existingContract?.valid
      || replayStableIdentity(existingValue) !== replayStableIdentity(value)) {
      throw new Error(collisionCode);
    }
  }
  return 'REPLAY';
}

export async function persistPaidMembershipAuthority(store, authority) {
  if (!store?.get || !store?.setNx) throw new Error('paid_membership_store_required');
  const keys = keysFor(authority);
  const subjectState = await putImmutable(store, keys.subject, authority.subject, 'paid_subject_collision', { tolerateReplayTime: true });
  const membershipState = await putImmutable(store, keys.membership, authority.membership, 'paid_membership_collision', { tolerateReplayTime: true });
  await putImmutable(store, keys.auth, authority.subject.subject_id, 'paid_auth_binding_collision');
  await putImmutable(store, keys.profile, authority.membership.membership_id, 'paid_profile_membership_collision');
  return Object.freeze({
    ok: true,
    code: subjectState === 'REPLAY' && membershipState === 'REPLAY'
      ? 'PAID_MEMBERSHIP_IDEMPOTENT_REPLAY'
      : 'PAID_MEMBERSHIP_PERSISTED',
    subject_id: authority.subject.subject_id,
    membership_id: authority.membership.membership_id,
    scope: authority.scope,
    assessment_id: authority.assessment_id,
    raw_provider_subject_stored: false,
  });
}

export async function resolvePaidMembershipAuthority(store, { issuer = PAID_PROFILE_OWNER_ISSUER, provider_subject, profile_id } = {}) {
  if (!store?.get) throw new Error('paid_membership_store_required');
  const normalizedIssuer = requireText(issuer, 'authenticated_profile_owner_required', 200);
  const providerSubject = normalizeEmail(provider_subject);
  const profileId = normalizeProfileId(profile_id);
  if (!providerSubject || !profileId) throw new Error('authenticated_profile_owner_required');
  const bindingHash = providerSubjectHash({ issuer: normalizedIssuer, provider_subject: providerSubject });
  const authKey = `${PAID_MEMBERSHIP_NAMESPACE}:auth:${sha256(`${normalizedIssuer}:${bindingHash}`)}`;
  const profileKey = `${PAID_MEMBERSHIP_NAMESPACE}:profile:${profileId}`;
  const [subjectId, membershipId] = await Promise.all([store.get(authKey), store.get(profileKey)]);
  if (!subjectId || !membershipId) throw new Error('governed_membership_not_found');
  const [subjectRaw, membershipRaw] = await Promise.all([
    store.get(`${PAID_MEMBERSHIP_NAMESPACE}:subject:${subjectId}`),
    store.get(`${PAID_MEMBERSHIP_NAMESPACE}:membership:${membershipId}`),
  ]);
  let subject;
  let membership;
  try {
    subject = JSON.parse(subjectRaw);
    membership = JSON.parse(membershipRaw);
  } catch {
    throw new Error('paid_membership_reconciliation_required');
  }
  const expectedBinding = subject?.auth_bindings?.find((item) => item.issuer === normalizedIssuer && item.status === 'ACTIVE');
  if (subject?.subject_id !== subjectId
    || subject?.status !== 'ACTIVE'
    || expectedBinding?.provider_subject_hash !== bindingHash
    || membership?.membership_id !== membershipId
    || membership?.subject_id !== subjectId
    || membership?.profile_id !== profileId
    || membership?.status !== 'ACTIVE') {
    throw new Error('paid_membership_reconciliation_required');
  }
  return Object.freeze({
    ok: true,
    code: 'PAID_MEMBERSHIP_RESOLVED',
    subject: Object.freeze(subject),
    membership: Object.freeze(membership),
    scope: membershipScope(membership),
    profile_id_role: 'MEMBERSHIP_LOCATOR_ONLY',
    raw_provider_subject_stored: false,
  });
}

function parseRecord(raw) {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function validCurrentNewBaReadinessReceipt(receipt, {
  profileId,
  assessmentId,
  assessment,
} = {}) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return false;
  let verticalBinding;
  try { verticalBinding = validatePersistedVerticalBinding(assessment?.vertical_binding); }
  catch { return false; }
  const boundedAssessmentId = String(assessmentId || '').trim();
  if (!boundedAssessmentId
    || String(assessment?.assessment_id || '').trim() !== boundedAssessmentId) return false;
  const realizationId = String(receipt.realization_id || '');
  const expectedRealizationPrefix = `new-ba:${profileId.toUpperCase()}:${boundedAssessmentId}:`;
  const realizationIdentitySha256 = realizationId.slice(expectedRealizationPrefix.length);
  return receipt.ready === true
    && receipt.code === 'PAID_CURRENT_NEW_BA_MEMBERSHIP_READY'
    && receipt.source === 'CURRENT_NEW_BA_LAUNCH_SAFE_REALIZATION'
    && receipt.profile_id === profileId
    && receipt.assessment_id === boundedAssessmentId
    && receipt.mutation_performed === false
    && receipt.provider_store === false
    && ['A', 'B'].includes(receipt.compatibility_class)
    && SHA256_HEX.test(String(receipt.artifact_sha256 || ''))
    && SHA256_HEX.test(String(receipt.vertical_binding_sha256 || ''))
    && receipt.vertical_binding_sha256 === verticalBinding.binding_sha256
    && realizationId.startsWith(expectedRealizationPrefix)
    && SHA256_HEX.test(realizationIdentitySha256);
}

export function createPaidMembershipBinder({
  store,
  ownershipVerifier,
  ownerReader,
  profileStateReader,
  currentNewBaReadinessReader = null,
  clock = Date.now,
} = {}) {
  if (!store?.get || !store?.setNx
    || typeof ownershipVerifier !== 'function'
    || typeof ownerReader !== 'function'
    || typeof profileStateReader !== 'function') {
    throw new Error('paid_membership_binder_configuration_unavailable');
  }
  return async function bindPaidMembership({ profile_id, cookie_header } = {}) {
    const profileId = normalizeProfileId(profile_id);
    if (!profileId) throw new Error('profile_id_required');
    const verified = await ownershipVerifier({ profile_id: profileId, cookie_header });
    if (!verified) throw new Error('profile_ownership_required');
    const [owner, profileState, assessmentId] = await Promise.all([
      ownerReader(profileId),
      profileStateReader(profileId),
      store.get(`business_assessment_by_profile:${profileId}`),
    ]);
    const assessmentKey = assessmentId ? `business_assessment:${assessmentId}` : null;
    const assessmentRaw = assessmentKey ? await store.get(assessmentKey) : null;
    const assessment = parseRecord(assessmentRaw);
    if (owner?.profile_id !== profileId || !normalizeEmail(owner?.recipient_email)) {
      throw new Error('authenticated_profile_owner_required');
    }
    // The broader Profile state is useful for BOS custody only. BA readiness
    // must be derived from the exact assessment record fetched by this bind.
    const legacyBaReady = isExactLegacyBusinessAssessmentComplete(assessment);
    let effectiveProfileState = {
      ...(profileState || {}),
      ba: legacyBaReady ? 'ready' : 'pending',
    };
    if (READY.has(profileState?.bos)
      && !legacyBaReady
      && assessment
      && typeof currentNewBaReadinessReader === 'function') {
      let currentNewBaReadiness = null;
      try {
        currentNewBaReadiness = await currentNewBaReadinessReader({
          profile_id: profileId,
          assessment,
        });
      } catch {
        // Invalid or drifting New BA custody must preserve the existing public
        // not-ready result and must never become a validity oracle.
      }
      if (validCurrentNewBaReadinessReceipt(currentNewBaReadiness, {
        profileId,
        assessmentId,
        assessment,
      })) {
        effectiveProfileState = { ...(profileState || {}), ba: 'ready' };
      }
    }
    const authority = createPaidMembershipAuthority({
      provider_subject: owner.recipient_email,
      profile_id: profileId,
      profile_state: effectiveProfileState,
      assessment,
      ownership_verified: true,
      created_at: new Date(clock()).toISOString(),
    });
    // Re-read both sides of the assessment locator immediately before the
    // first membership write so a concurrent pointer or record advance fails closed.
    const [finalAssessmentId, finalAssessmentRaw] = await Promise.all([
      store.get(`business_assessment_by_profile:${profileId}`),
      assessmentKey ? store.get(assessmentKey) : Promise.resolve(null),
    ]);
    if (finalAssessmentId !== assessmentId || finalAssessmentRaw !== assessmentRaw) {
      throw new Error('completed_bos_and_business_assessment_required');
    }
    await persistPaidMembershipAuthority(store, authority);
    return Object.freeze({
      authenticated: true,
      membership_verified: true,
      subject_id: authority.scope.subject_id,
      membership_id: authority.scope.membership_id,
      email: normalizeEmail(owner.recipient_email),
      assessment_id: authority.assessment_id,
      scope: authority.scope,
      membership_binding: authority.membership_binding,
    });
  };
}
