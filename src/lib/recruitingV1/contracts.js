/* global Buffer */

import crypto from 'node:crypto';

export const RECRUITING_V1_VERSION = 'recruiting_intelligence_v1';
export const MONTHLY_INVITATION_LIMIT = 5;
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MANAGER_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const MANAGER_CHALLENGE_TTL_MS = 15 * 60 * 1000;
export const MANAGER_SETUP_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MANAGER_SETUP_SESSION_TTL_MS = 30 * 60 * 1000;
export const RECRUITING_ADMIN_ROLE = 'RECRUITING_ADMIN';

export const MEMBERSHIP_STATES = Object.freeze(['PENDING_SETUP', 'ACTIVE', 'SUSPENDED', 'REVOKED']);
export const MANAGER_SETUP_STATES = Object.freeze(['NOT_SENT', 'SETUP_SENT', 'EMAIL_VERIFIED', 'COMPLETE']);
export const ENTITLEMENT_MODES = Object.freeze(['5_per_month', 'unlimited']);

export const INVITATION_STATES = Object.freeze([
  'ISSUED',
  'DELIVERED',
  'DELIVERY_FAILED',
  'ACCEPTED',
  'REVOKED',
  'EXPIRED',
]);

export const READINESS_STATES = Object.freeze([
  'INVITED',
  'CONSENTED',
  'BOS_IN_PROGRESS',
  'BOS_READY',
  'BA_NOT_STARTED',
  'BA_INTAKE_SAVED',
  'BA_IN_PROGRESS',
  'BA_INTELLIGENCE_READY',
]);

export const EVIDENCE_TYPES = Object.freeze([
  'MLS_PRODUCTION',
  'CONVERSATION',
  'GOAL',
  'QUOTE',
  'OBSERVATION',
  'OTHER',
]);

export const OPPORTUNITY_CATEGORIES = Object.freeze([
  'LOCAL_LEADERSHIP',
  'COACHING_AND_TRAINING',
  'LEAD_OPPORTUNITY',
  'OPERATIONS_AND_LEVERAGE',
  'TOOLS_AND_SYSTEMS',
  'ECONOMICS',
  'CULTURE_AND_ENVIRONMENT',
  'GROWTH_PATH',
  'COMPANY_PLATFORM',
]);

export const OPPORTUNITY_STATUSES = Object.freeze(['SUPPORTED', 'CONDITIONAL', 'UNKNOWN', 'NON_PROMISE']);

const PROFILE_ID = /^mm-\d{8}-[a-z0-9]{8}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeProfileId(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return PROFILE_ID.test(normalized) ? normalized : null;
}

export function normalizeEmail(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return EMAIL.test(normalized) && normalized.length <= 254 ? normalized : null;
}

export function boundedText(value, max = 1000) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

export function createOpaqueId(prefix) {
  return `${prefix}_${crypto.randomBytes(12).toString('base64url')}`;
}

export function createOpaqueToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function digestToken(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

export function createTokenWrapper(secret) {
  const material = String(secret || '');
  if (material.length < 32) throw new Error('RECRUITING_TOKEN_WRAP_KEY_REQUIRED');
  const key = crypto.createHash('sha256').update(material).digest();
  return Object.freeze({
    wrap(token) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const ciphertext = Buffer.concat([cipher.update(String(token || ''), 'utf8'), cipher.final()]);
      return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
    },
    unwrap(capsule) {
      const [ivValue, tagValue, ciphertextValue, ...rest] = String(capsule || '').split('.');
      if (!ivValue || !tagValue || !ciphertextValue || rest.length) throw new Error('RECRUITING_TOKEN_CAPSULE_INVALID');
      try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'base64url'));
        decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
        return Buffer.concat([
          decipher.update(Buffer.from(ciphertextValue, 'base64url')),
          decipher.final(),
        ]).toString('utf8');
      } catch {
        throw new Error('RECRUITING_TOKEN_CAPSULE_INVALID');
      }
    },
  });
}

export function stableHash(value) {
  const normalize = (input) => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === 'object') {
      return Object.fromEntries(Object.keys(input).sort().map((key) => [key, normalize(input[key])]));
    }
    return input;
  };
  return crypto.createHash('sha256').update(JSON.stringify(normalize(value))).digest('hex');
}

export function entitlementPeriodFor(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { period_start: start.toISOString(), period_end: end.toISOString() };
}

export function assertMembershipRecord(value) {
  if (!value || !MEMBERSHIP_STATES.includes(value.status)) throw new Error('RECRUITING_MANAGER_MEMBERSHIP_INVALID');
  for (const field of ['membership_id', 'manager_subject_id', 'enterprise_id', 'manager_email']) {
    if (!boundedText(value[field], 300)) throw new Error(`RECRUITING_MEMBERSHIP_${field.toUpperCase()}_REQUIRED`);
  }
  if (!normalizeEmail(value.manager_email)) throw new Error('RECRUITING_MEMBERSHIP_EMAIL_INVALID');
  if (!MANAGER_SETUP_STATES.includes(value.setup_state)) throw new Error('RECRUITING_MEMBERSHIP_SETUP_STATE_INVALID');
  if (!ENTITLEMENT_MODES.includes(value.entitlement_mode)) throw new Error('RECRUITING_MEMBERSHIP_ENTITLEMENT_INVALID');
  if (value.manager_profile_id && !normalizeProfileId(value.manager_profile_id)) throw new Error('RECRUITING_MEMBERSHIP_PROFILE_ID_INVALID');
  return value;
}

export function assertMembership(value) {
  assertMembershipRecord(value);
  if (value.status !== 'ACTIVE') throw new Error('RECRUITING_MANAGER_MEMBERSHIP_INACTIVE');
  if (value.setup_state !== 'COMPLETE' || !normalizeProfileId(value.manager_profile_id)) {
    throw new Error('RECRUITING_MANAGER_SETUP_INCOMPLETE');
  }
  return value;
}

export function assertRecruitingAdmin(value) {
  assertMembership(value);
  if (!Array.isArray(value.admin_roles) || !value.admin_roles.includes(RECRUITING_ADMIN_ROLE)) {
    throw new Error('RECRUITING_ADMIN_AUTHORITY_REQUIRED');
  }
  const scope = value.recruiting_governance || {};
  if (scope.all_enterprises !== true && (!Array.isArray(scope.enterprise_ids) || scope.enterprise_ids.length === 0)) {
    throw new Error('RECRUITING_ADMIN_GOVERNANCE_SCOPE_REQUIRED');
  }
  return value;
}

export function assertOpportunityItem(item) {
  if (!OPPORTUNITY_CATEGORIES.includes(item?.category)) throw new Error('RECRUITING_OPPORTUNITY_CATEGORY_INVALID');
  if (!OPPORTUNITY_STATUSES.includes(item?.status)) throw new Error('RECRUITING_OPPORTUNITY_STATUS_INVALID');
  if (!boundedText(item?.statement, 1200)) throw new Error('RECRUITING_OPPORTUNITY_STATEMENT_REQUIRED');
  if (!boundedText(item?.source, 300) || !item?.source_date) throw new Error('RECRUITING_OPPORTUNITY_PROVENANCE_REQUIRED');
  return item;
}

export function assertManagerEvidence(item) {
  if (!EVIDENCE_TYPES.includes(item?.type)) throw new Error('RECRUITING_EVIDENCE_TYPE_INVALID');
  if (!boundedText(item?.claim, 2000)) throw new Error('RECRUITING_EVIDENCE_CLAIM_REQUIRED');
  if (!boundedText(item?.source, 300) || !item?.source_date) throw new Error('RECRUITING_EVIDENCE_PROVENANCE_REQUIRED');
  return item;
}

export function publicInvitation(invitation) {
  return {
    invitation_id: invitation.invitation_id,
    candidate_id: invitation.candidate_id,
    recruit_name: invitation.recruit_name,
    recruit_email: invitation.recruit_email,
    purpose: invitation.purpose,
    state: invitation.state,
    readiness_state: invitation.readiness_state,
    issued_at: invitation.issued_at,
    expires_at: invitation.expires_at,
    accepted_at: invitation.accepted_at || null,
    bos_profile_id: invitation.bos_profile_id || null,
    ba_assessment_id: invitation.ba_assessment_id || null,
    ba_readiness: invitation.ba_readiness || 'BA_NOT_STARTED',
    delivery_state: invitation.delivery_state,
    resend_count: invitation.resend_count || 0,
  };
}

export function isPreAcceptanceTerminal(invitation) {
  return !invitation?.accepted_at && ['REVOKED', 'EXPIRED', 'DELIVERY_FAILED'].includes(invitation?.state);
}
