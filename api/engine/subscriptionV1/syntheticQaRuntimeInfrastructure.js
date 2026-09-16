import crypto from 'node:crypto';
import { hashCanonicalJson } from '../../../src/lib/intelligenceFabric/hashing.js';
import { deepFreeze } from '../../../src/lib/intelligenceFabric/validation.js';
import { normalizeProfileId } from '../../../src/lib/publicSiteAirlockV1/contracts.js';
import {
  contractHeader,
  scopeFingerprint,
  validateSubscriptionV1Contract,
} from '../../../src/lib/subscriptionV1/contracts.js';

export const SYNTHETIC_QA_RUNTIME_NAMESPACE = 'more:subscription-v1:synthetic-qa:v1';
export const SYNTHETIC_QA_CAPABILITY_STATE_PREFIX = `${SYNTHETIC_QA_RUNTIME_NAMESPACE}:capability`;
export const SYNTHETIC_QA_RUNTIME_CSRF_PREFIX = `${SYNTHETIC_QA_RUNTIME_NAMESPACE}:runtime-csrf`;
export const SYNTHETIC_QA_RUNTIME_CSRF_TTL_SECONDS = 5 * 60;

function exactAssessmentId(value) {
  const assessmentId = String(value || '').trim().toLowerCase();
  if (!/^ba-\d{8}-[a-f0-9]{8}$/u.test(assessmentId)) {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_ASSESSMENT_ID_INVALID');
  }
  return assessmentId;
}

function exactSha256(value, code) {
  const hash = String(value || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(hash)) throw new Error(code);
  return hash;
}

export function syntheticQaCapabilityStateKey(capabilityHash) {
  const hash = exactSha256(
    capabilityHash,
    'SUBSCRIPTION_V1_SYNTHETIC_QA_CAPABILITY_HASH_INVALID',
  );
  return `${SYNTHETIC_QA_CAPABILITY_STATE_PREFIX}:${hash}`;
}

function csrfKey(capabilityHash, proof) {
  const hash = exactSha256(
    capabilityHash,
    'SUBSCRIPTION_V1_SYNTHETIC_QA_CAPABILITY_HASH_INVALID',
  );
  const proofHash = crypto.createHash('sha256').update(String(proof), 'utf8').digest('hex');
  return `${SYNTHETIC_QA_RUNTIME_CSRF_PREFIX}:${hash}:${proofHash}`;
}

export async function issueSyntheticQaRuntimeCsrf({ redis, capabilityHash } = {}) {
  if (typeof redis?.set !== 'function') throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_STORE_REQUIRED');
  const proof = crypto.randomBytes(32).toString('base64url');
  const stored = await redis.set(
    csrfKey(capabilityHash, proof),
    'active',
    'EX',
    SYNTHETIC_QA_RUNTIME_CSRF_TTL_SECONDS,
    'NX',
  );
  if (stored !== 'OK') throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_CSRF_ISSUE_FAILED');
  return proof;
}

export async function consumeSyntheticQaRuntimeCsrf({ redis, capabilityHash, proof } = {}) {
  if (typeof proof !== 'string' || proof.length < 32 || proof.length > 256) return false;
  if (typeof redis?.getdel !== 'function') throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_STORE_REQUIRED');
  return await redis.getdel(csrfKey(capabilityHash, proof)) === 'active';
}

export function syntheticQaScope({
  profile_id,
  assessment_id,
  vertical_binding_sha256,
  authority_id,
} = {}) {
  const profileId = normalizeProfileId(profile_id);
  if (!profileId) throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_PROFILE_ID_INVALID');
  const assessmentId = exactAssessmentId(assessment_id);
  const verticalBindingSha256 = exactSha256(
    vertical_binding_sha256,
    'SUBSCRIPTION_V1_SYNTHETIC_QA_VERTICAL_BINDING_INVALID',
  );
  const authorityId = String(authority_id || '').trim();
  if (authorityId.length < 8 || authorityId.length > 160) {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_AUTHORITY_INVALID');
  }
  const fingerprint = hashCanonicalJson({
    domain: 'subscription-v1-exact-full-person-synthetic-qa-scope-v1',
    profile_id: profileId,
    assessment_id: assessmentId,
    vertical_binding_sha256: verticalBindingSha256,
    authority_id: authorityId,
  });
  return deepFreeze({
    subject_id: `synthetic_qa_subject_${fingerprint.slice(0, 40)}`,
    membership_id: `synthetic_qa_scope_${fingerprint.slice(0, 40)}`,
    tenant_id: 'synthetic_qa',
    profile_id: profileId,
    business_id: `business_${hashCanonicalJson({
      domain: 'more-synthetic-qa-subscription-business-v1',
      profile_id: profileId,
      assessment_id: assessmentId,
      vertical_binding_sha256: verticalBindingSha256,
      authority_id: authorityId,
    }).slice(0, 40)}`,
  });
}

export function assertSyntheticQaBusinessScope(scope, assessmentId, verticalBindingSha256, authorityId) {
  const expected = syntheticQaScope({
    profile_id: scope?.profile_id,
    assessment_id: assessmentId,
    vertical_binding_sha256: verticalBindingSha256,
    authority_id: authorityId,
  });
  if (scope?.business_id !== expected.business_id || scope?.membership_id !== expected.membership_id
    || scope?.subject_id !== expected.subject_id || scope?.tenant_id !== expected.tenant_id) {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_BUSINESS_SCOPE_MISMATCH');
  }
}

export function syntheticQaRuntimeKeys({ scope } = {}) {
  const scopeHash = scopeFingerprint(scope);
  return deepFreeze({
    scope_hash: scopeHash,
    living_state: `${SYNTHETIC_QA_RUNTIME_NAMESPACE}:living:${scopeHash}`,
    living_backup: `${SYNTHETIC_QA_RUNTIME_NAMESPACE}:living-backup:${scopeHash}`,
    living_lock: `${SYNTHETIC_QA_RUNTIME_NAMESPACE}:living-lock:${scopeHash}`,
    allowance: `${SYNTHETIC_QA_RUNTIME_NAMESPACE}:allowance:${scopeHash}`,
    allowance_backup: `${SYNTHETIC_QA_RUNTIME_NAMESPACE}:allowance-backup:${scopeHash}`,
    allowance_lock: `${SYNTHETIC_QA_RUNTIME_NAMESPACE}:allowance-lock:${scopeHash}`,
    research: `${SYNTHETIC_QA_RUNTIME_NAMESPACE}:research:${scopeHash}`,
    diagnostics: `${SYNTHETIC_QA_RUNTIME_NAMESPACE}:diagnostics:${scopeHash}`,
    s2_relationship: `${SYNTHETIC_QA_RUNTIME_NAMESPACE}:relationship:${scopeHash}`,
    conversation_history: `${SYNTHETIC_QA_RUNTIME_NAMESPACE}:conversation:${scopeHash}`,
    conversation_backup: `${SYNTHETIC_QA_RUNTIME_NAMESPACE}:conversation-backup:${scopeHash}`,
    conversation_lock: `${SYNTHETIC_QA_RUNTIME_NAMESPACE}:conversation-lock:${scopeHash}`,
  });
}

export function syntheticQaRuntimeRelationshipKey(scope) {
  return `synthetic_qa_${hashCanonicalJson({
    domain: 'subscription-v1-synthetic-qa-runtime-relationship-v1',
    scope,
  }).slice(0, 32)}`;
}

export function createSyntheticQaEntitlement({
  scope,
  authority_id,
  manifest_version,
  manifest_sha256,
  expires_at,
  as_of = new Date(),
} = {}) {
  const asOf = as_of instanceof Date ? as_of : new Date(as_of);
  const expiry = new Date(expires_at);
  if (!Number.isFinite(asOf.getTime()) || !Number.isFinite(expiry.getTime()) || expiry <= asOf) {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_ENTITLEMENT_EXPIRED');
  }
  scopeFingerprint(scope);
  const cycleStart = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1));
  const calendarEnd = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + 1, 1));
  const cycleEnd = expiry < calendarEnd ? expiry : calendarEnd;
  if (cycleEnd <= cycleStart) throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_CYCLE_INVALID');
  const entitlement = {
    ...contractHeader('synthetic_qa_entitlement'),
    entitlement_id: `entitlement_synthetic_qa_${hashCanonicalJson({
      scope,
      authority_id,
      cycle_start: cycleStart.toISOString(),
    }).slice(0, 24)}`,
    scope: structuredClone(scope),
    authority_id: String(authority_id || ''),
    manifest_version: String(manifest_version || ''),
    manifest_sha256: String(manifest_sha256 || ''),
    state: 'ACTIVE',
    billing_cycle_start: cycleStart.toISOString(),
    billing_cycle_end: cycleEnd.toISOString(),
    access_ends_at: expiry.toISOString(),
    projected_at: asOf.toISOString(),
    policy_version: 'subscription_v1_exact_synthetic_qa_entitlement_v1',
    billing_evidence: false,
    stripe_subscription_created: false,
    synthetic_only: true,
  };
  const validation = validateSubscriptionV1Contract(entitlement);
  if (!validation.valid) {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_ENTITLEMENT_CONTRACT_INVALID');
  }
  return deepFreeze(entitlement);
}
