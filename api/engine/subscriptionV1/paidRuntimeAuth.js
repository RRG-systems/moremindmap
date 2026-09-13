import { hashCanonicalJson } from '../../../src/lib/intelligenceFabric/hashing.js';
import { deepFreeze } from '../../../src/lib/intelligenceFabric/validation.js';
import {
  sameScope,
  scopeFingerprint,
  validateSubscriptionV1Contract,
} from '../../../src/lib/subscriptionV1/contracts.js';
import { membershipScope } from '../../../src/lib/subscriptionV1/identity.js';
import { normalizeProfileId } from '../../../src/lib/publicSiteAirlockV1/contracts.js';
import {
  readVerifiedProfileOwnerRequest,
  resolveProfileOwnershipAudience,
} from '../../../src/lib/publicSiteAirlockV1/profileOwnership.js';
import {
  PAID_MEMBERSHIP_NAMESPACE,
  PAID_PROFILE_OWNER_ISSUER,
} from '../../stripe/paidMembership.js';
import { paidRuntimeRelationshipKey } from './paidRuntimeInfrastructure.js';

const MEMBERSHIP_ID = /^membership_[a-f0-9]{40}$/u;
const SUBJECT_ID = /^subject_[a-f0-9]{40}$/u;
const AUTHORITY_SOURCE = 'VERIFIED_PROFILE_OWNER_RECEIPT_AND_DURABLE_PAID_MEMBERSHIP';

function rejected(code, failureClass, status) {
  return deepFreeze({ ok: false, code, status, failure_class: failureClass });
}

function parseRecord(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function reconciliationRequired() {
  throw new Error('paid_membership_reconciliation_required');
}

export function paidSubscriptionRuntimeEnabled(env = globalThis.process?.env || {}) {
  return env.PUBLIC_SUBSCRIPTION_RUNTIME_ENABLED === 'true';
}

/**
 * Resolve the single immutable paid membership selected by a signed Profile.
 *
 * This intentionally has no provider-subject or email input. The public Profile
 * identifier is only a durable index locator; the subject, membership, and exact
 * Subscription scope are all revalidated from server-owned records.
 */
export async function resolveActivePaidMembershipByProfile({ store, profile_id } = {}) {
  if (!store?.get) throw new Error('paid_membership_store_required');
  const profileId = normalizeProfileId(profile_id);
  if (!profileId) throw new Error('verified_profile_owner_claim_required');

  const membershipId = await store.get(`${PAID_MEMBERSHIP_NAMESPACE}:profile:${profileId}`);
  if (!MEMBERSHIP_ID.test(String(membershipId || ''))) {
    if (!membershipId) throw new Error('governed_membership_not_found');
    reconciliationRequired();
  }

  const membership = parseRecord(
    await store.get(`${PAID_MEMBERSHIP_NAMESPACE}:membership:${membershipId}`),
  );
  const membershipValidation = validateSubscriptionV1Contract(membership);
  if (!membershipValidation.valid
    || membership.membership_id !== membershipId
    || membership.profile_id !== profileId
    || membership.role !== 'OWNER'
    || membership.status !== 'ACTIVE'
    || membership.ended_at !== null
    || !SUBJECT_ID.test(String(membership.subject_id || ''))) {
    reconciliationRequired();
  }

  const subject = parseRecord(
    await store.get(`${PAID_MEMBERSHIP_NAMESPACE}:subject:${membership.subject_id}`),
  );
  const subjectValidation = validateSubscriptionV1Contract(subject);
  const activeOwnerBindings = Array.isArray(subject?.auth_bindings)
    ? subject.auth_bindings.filter((binding) => binding?.issuer === PAID_PROFILE_OWNER_ISSUER
      && binding.status === 'ACTIVE'
      && binding.revoked_at === null)
    : [];
  if (!subjectValidation.valid
    || subject.subject_id !== membership.subject_id
    || subject.status !== 'ACTIVE'
    || activeOwnerBindings.length !== 1) {
    reconciliationRequired();
  }

  const scope = membershipScope(membership);
  const expectedScope = {
    subject_id: subject.subject_id,
    membership_id: membershipId,
    tenant_id: membership.tenant_id,
    profile_id: profileId,
    business_id: membership.business_id,
  };
  let scopeHash;
  try { scopeHash = scopeFingerprint(scope); } catch { reconciliationRequired(); }
  if (!sameScope(scope, expectedScope)) reconciliationRequired();

  return deepFreeze({
    ok: true,
    code: 'PAID_MEMBERSHIP_RESOLVED_BY_SIGNED_PROFILE',
    scope,
    scope_hash: scopeHash,
    membership_verified: true,
    binding_source: 'AUTHENTICATED_SERVER_CONTEXT',
    profile_id_role: 'SIGNED_CLAIM_MEMBERSHIP_LOCATOR_ONLY',
    raw_provider_subject_required: false,
  });
}

export const resolvePaidMembershipByProfile = resolveActivePaidMembershipByProfile;

function nowInMilliseconds(nowMs, now) {
  if (nowMs !== undefined) return Number(nowMs);
  if (now instanceof Date) return now.getTime();
  if (now !== undefined) return new Date(now).getTime();
  return Date.now();
}

export async function authenticatePaidRuntimeRequest({
  redis,
  req,
  env = globalThis.process?.env || {},
  now,
  nowMs,
} = {}) {
  if (!paidSubscriptionRuntimeEnabled(env)) {
    return rejected(
      'SUBSCRIPTION_V1_PAID_RUNTIME_DEFAULT_OFF',
      'RUNTIME_DEFAULT_OFF',
      404,
    );
  }

  let audience;
  try { audience = resolveProfileOwnershipAudience(env); } catch {
    return rejected(
      'SUBSCRIPTION_V1_PAID_RUNTIME_UNAVAILABLE',
      'PROFILE_OWNER_AUDIENCE_UNAVAILABLE',
      503,
    );
  }

  if (String(env.MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_SIGNING_KEY || '').length < 32) {
    return rejected(
      'SUBSCRIPTION_V1_PAID_RUNTIME_UNAVAILABLE',
      'PROFILE_OWNER_SIGNING_CONFIGURATION_UNAVAILABLE',
      503,
    );
  }

  const verificationNowMs = nowInMilliseconds(nowMs, now);
  if (!Number.isFinite(verificationNowMs)) {
    return rejected(
      'SUBSCRIPTION_V1_PAID_RUNTIME_UNAVAILABLE',
      'PROFILE_OWNER_CLOCK_UNAVAILABLE',
      503,
    );
  }

  const verifiedOwner = readVerifiedProfileOwnerRequest({
    cookieHeader: req?.headers?.cookie,
    signingKey: env.MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_SIGNING_KEY,
    audience,
    nowMs: verificationNowMs,
  });
  if (!verifiedOwner?.profile_id) {
    return rejected(
      'SUBSCRIPTION_V1_PAID_PROFILE_OWNER_RECEIPT_REQUIRED',
      'PROFILE_OWNER_RECEIPT_MISSING_OR_INVALID',
      401,
    );
  }

  let resolved;
  try {
    resolved = await resolveActivePaidMembershipByProfile({
      store: redis,
      profile_id: verifiedOwner.profile_id,
    });
  } catch (error) {
    if (error?.message === 'paid_membership_store_required') {
      return rejected(
        'SUBSCRIPTION_V1_PAID_RUNTIME_UNAVAILABLE',
        'PAID_MEMBERSHIP_STORE_UNAVAILABLE',
        503,
      );
    }
    if (error?.message === 'governed_membership_not_found') {
      return rejected(
        'SUBSCRIPTION_V1_PAID_MEMBERSHIP_REQUIRED',
        'ACTIVE_PAID_MEMBERSHIP_NOT_FOUND',
        403,
      );
    }
    if (error?.message === 'paid_membership_reconciliation_required') {
      return rejected(
        'SUBSCRIPTION_V1_PAID_MEMBERSHIP_RECONCILIATION_REQUIRED',
        'PAID_MEMBERSHIP_RECONCILIATION_REQUIRED',
        403,
      );
    }
    return rejected(
      'SUBSCRIPTION_V1_PAID_RUNTIME_UNAVAILABLE',
      'PAID_MEMBERSHIP_STORE_UNAVAILABLE',
      503,
    );
  }

  const paidMembershipScope = resolved.scope;
  const capability = deepFreeze({
    contract: 'subscription_v1_paid_runtime_capability_v1',
    relationship_key: paidRuntimeRelationshipKey(paidMembershipScope),
    subject_key: paidMembershipScope.subject_id,
    authority_source: AUTHORITY_SOURCE,
    paid_membership_scope: paidMembershipScope,
    scope_hash: resolved.scope_hash,
    authenticated: true,
    membership_verified: true,
    binding_source: resolved.binding_source,
    synthetic_only: false,
  });

  return deepFreeze({
    ok: true,
    code: 'SUBSCRIPTION_V1_PAID_RUNTIME_AUTHENTICATED',
    capability,
    capability_hash: hashCanonicalJson(capability),
    scope: paidMembershipScope,
    paid_membership_scope: paidMembershipScope,
    authenticated: true,
    membership_verified: true,
    binding_source: resolved.binding_source,
  });
}
