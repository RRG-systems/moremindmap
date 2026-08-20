import { hashCanonicalJson } from '../intelligenceFabric/hashing.js';
import { deepFreeze } from '../intelligenceFabric/validation.js';
import {
  contractHeader,
  createAuthorityReference,
  sameScope,
  validateSubscriptionV1Contract,
} from './contracts.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const authKey = (issuer, providerSubjectHash) => `${issuer}:${providerSubjectHash}`;

export function providerSubjectHash({ issuer, provider_subject }) {
  if (!issuer || !provider_subject) throw new TypeError('Issuer and provider subject required');
  return hashCanonicalJson({ domain: 'subscription-v1-auth-binding', issuer, provider_subject });
}

export function createCanonicalCustomerSubject({
  subject_id,
  issuer,
  provider_subject,
  status = 'ACTIVE',
  created_at,
  updated_at = created_at,
  authority = createAuthorityReference({ authority_id: 'subscription_identity_authority', authority_version: '1.0.0' }),
}) {
  const subject = {
    ...contractHeader('canonical_customer_subject'),
    subject_id,
    status,
    auth_bindings: [{
      issuer,
      provider_subject_hash: providerSubjectHash({ issuer, provider_subject }),
      status: 'ACTIVE',
      bound_at: created_at,
      revoked_at: null,
    }],
    created_at,
    updated_at,
    authority,
  };
  const validation = validateSubscriptionV1Contract(subject);
  if (!validation.valid) throw new TypeError(`Invalid canonical subject: ${validation.errors[0]?.code}`);
  return deepFreeze(subject);
}

export function createBusinessMembership({
  membership_id,
  subject_id,
  tenant_id,
  profile_id,
  business_id,
  role = 'OWNER',
  status = 'ACTIVE',
  created_at,
  ended_at = null,
  authority = createAuthorityReference({ authority_id: 'subscription_membership_authority', authority_version: '1.0.0' }),
}) {
  const membership = {
    ...contractHeader('business_membership'),
    membership_id,
    subject_id,
    tenant_id,
    profile_id,
    business_id,
    role,
    status,
    created_at,
    ended_at,
    authority,
  };
  const validation = validateSubscriptionV1Contract(membership);
  if (!validation.valid) throw new TypeError(`Invalid business membership: ${validation.errors[0]?.code}`);
  return deepFreeze(membership);
}

export function membershipScope(membership) {
  return deepFreeze({
    subject_id: membership.subject_id,
    membership_id: membership.membership_id,
    tenant_id: membership.tenant_id,
    profile_id: membership.profile_id,
    business_id: membership.business_id,
  });
}

export class CanonicalSubjectMembershipRegistry {
  constructor() {
    this.subjects = new Map();
    this.authBindings = new Map();
    this.memberships = new Map();
    this.membershipsBySubject = new Map();
  }

  registerSubject(subject) {
    const validation = validateSubscriptionV1Contract(subject);
    if (!validation.valid) return deepFreeze({ ok: false, code: 'SUBJECT_CONTRACT_INVALID', errors: validation.errors });
    const existing = this.subjects.get(subject.subject_id);
    if (existing && hashCanonicalJson(existing) !== hashCanonicalJson(subject)) return deepFreeze({ ok: false, code: 'SUBJECT_ID_CONFLICT' });
    for (const binding of subject.auth_bindings) {
      const key = authKey(binding.issuer, binding.provider_subject_hash);
      const bound = this.authBindings.get(key);
      if (bound && bound !== subject.subject_id) return deepFreeze({ ok: false, code: 'AUTH_BINDING_CROSS_SUBJECT_CONFLICT' });
    }
    this.subjects.set(subject.subject_id, clone(subject));
    for (const binding of subject.auth_bindings) if (binding.status === 'ACTIVE') this.authBindings.set(authKey(binding.issuer, binding.provider_subject_hash), subject.subject_id);
    return deepFreeze({ ok: true, code: existing ? 'IDEMPOTENT_REPLAY' : 'SUBJECT_REGISTERED', subject_id: subject.subject_id });
  }

  registerMembership(membership) {
    const validation = validateSubscriptionV1Contract(membership);
    if (!validation.valid) return deepFreeze({ ok: false, code: 'MEMBERSHIP_CONTRACT_INVALID', errors: validation.errors });
    if (!this.subjects.has(membership.subject_id)) return deepFreeze({ ok: false, code: 'CANONICAL_SUBJECT_NOT_FOUND' });
    const existing = this.memberships.get(membership.membership_id);
    if (existing && hashCanonicalJson(existing) !== hashCanonicalJson(membership)) return deepFreeze({ ok: false, code: 'MEMBERSHIP_ID_CONFLICT' });
    for (const candidate of this.memberships.values()) {
      if (candidate.membership_id !== membership.membership_id
        && candidate.status === 'ACTIVE'
        && membership.status === 'ACTIVE'
        && candidate.profile_id.toLowerCase() === membership.profile_id.toLowerCase()
        && candidate.subject_id !== membership.subject_id) return deepFreeze({ ok: false, code: 'PROFILE_CROSS_SUBJECT_CONFLICT' });
    }
    this.memberships.set(membership.membership_id, clone(membership));
    const ids = this.membershipsBySubject.get(membership.subject_id) || new Set();
    ids.add(membership.membership_id);
    this.membershipsBySubject.set(membership.subject_id, ids);
    return deepFreeze({ ok: true, code: existing ? 'IDEMPOTENT_REPLAY' : 'MEMBERSHIP_REGISTERED', membership_id: membership.membership_id });
  }

  resolve({ issuer, provider_subject, membership_id = null, business_id = null, profile_id = null }) {
    let subjectHash;
    try {
      subjectHash = providerSubjectHash({ issuer, provider_subject });
    } catch {
      return deepFreeze({ ok: false, code: 'AUTHENTICATED_SUBJECT_REQUIRED' });
    }
    const subjectId = this.authBindings.get(authKey(issuer, subjectHash));
    const subject = this.subjects.get(subjectId);
    if (!subject || subject.status !== 'ACTIVE') return deepFreeze({ ok: false, code: 'CANONICAL_SUBJECT_NOT_ACTIVE' });
    let candidates = [...(this.membershipsBySubject.get(subjectId) || [])]
      .map((id) => this.memberships.get(id))
      .filter((membership) => membership?.status === 'ACTIVE');
    if (membership_id) candidates = candidates.filter((membership) => membership.membership_id === membership_id);
    if (business_id) candidates = candidates.filter((membership) => membership.business_id === business_id);
    if (profile_id) candidates = candidates.filter((membership) => membership.profile_id.toLowerCase() === String(profile_id).toLowerCase());
    if (candidates.length === 0) return deepFreeze({ ok: false, code: 'GOVERNED_MEMBERSHIP_NOT_FOUND' });
    if (candidates.length > 1) return deepFreeze({ ok: false, code: 'MEMBERSHIP_SELECTION_REQUIRED', candidate_membership_ids: candidates.map((item) => item.membership_id).sort() });
    const membership = candidates[0];
    return deepFreeze({
      ok: true,
      code: 'SUBJECT_MEMBERSHIP_RESOLVED',
      subject: clone(subject),
      membership: clone(membership),
      scope: membershipScope(membership),
      profile_id_role: 'MEMBERSHIP_LOCATOR_ONLY',
    });
  }

  authorizeScope(resolution, requestedScope) {
    if (!resolution?.ok || !sameScope(resolution.scope, requestedScope)) return deepFreeze({ ok: false, code: 'EXACT_MEMBERSHIP_SCOPE_DENIED' });
    return deepFreeze({ ok: true, code: 'EXACT_MEMBERSHIP_SCOPE_AUTHORIZED', scope: clone(resolution.scope) });
  }

  classifyLegacyBinding(input = {}) {
    const hasCompleteTrustedMapping = Boolean(input.subject_id && input.membership_id && input.tenant_id && input.profile_id && input.business_id && input.authority_receipt_hash);
    if (!hasCompleteTrustedMapping) return deepFreeze({ ok: false, code: 'LEGACY_BINDING_RECONCILIATION_REQUIRED', fabricated: false });
    return deepFreeze({ ok: true, code: 'LEGACY_BINDING_READY_FOR_EXPLICIT_IMPORT', fabricated: false, scope: {
      subject_id: input.subject_id,
      membership_id: input.membership_id,
      tenant_id: input.tenant_id,
      profile_id: input.profile_id,
      business_id: input.business_id,
    } });
  }

  snapshot() {
    return deepFreeze({
      subjects: [...this.subjects.values()].map(clone).sort((a, b) => a.subject_id.localeCompare(b.subject_id)),
      memberships: [...this.memberships.values()].map(clone).sort((a, b) => a.membership_id.localeCompare(b.membership_id)),
      raw_provider_subjects_stored: false,
    });
  }
}
