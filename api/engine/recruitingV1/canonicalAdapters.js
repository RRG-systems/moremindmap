/* global process */

import { getRecruitingService, syntheticReviewEnabled } from './runtime.js';
import { businessAssessmentKey } from '../../business-assessment/shared.js';
import { normalizeRecruitingNamespace } from './redisStore.js';

const INVITE_COOKIE = '__Host-more_recruiting_invite';

function parseCookies(header = '') {
  return Object.fromEntries(String(header).split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}

export async function resolveRecruitingBosStartMetadata(req, clientMetadata = {}, env = process.env) {
  const requested = clientMetadata?.recruiting_mode === 'accepted_invitation';
  const safeMetadata = Object.fromEntries(Object.entries(clientMetadata || {}).filter(([key]) => !key.toLowerCase().startsWith('recruiting_')));
  if (!requested) return safeMetadata;
  const inviteSessionToken = parseCookies(req.headers?.cookie)[INVITE_COOKIE];
  const inspected = await getRecruitingService(env).inspectInviteSession(inviteSessionToken);
  return {
    ...safeMetadata,
    recruiting_relationship_ref: inspected.relationship.relationship_ref,
    recruiting_purpose: inspected.relationship.purpose,
  };
}

export async function onRecruitingBosVaultVerified({ relationshipRef, profileId, vaultResult, env = process.env }) {
  if (!relationshipRef) return { projected: false, reason: 'NOT_A_RECRUITING_JOB' };
  if (vaultResult?.success !== true) throw new Error('RECRUITING_VERIFIED_BOS_VAULT_RECEIPT_REQUIRED');
  const invitation = await getRecruitingService(env).bindBosProfile(relationshipRef, profileId, {
    verified: true,
    vault_key: vaultResult.vault_key || null,
    persisted_at: vaultResult.created_at || new Date().toISOString(),
  });
  return { projected: true, candidate_id: invitation.candidate_id, readiness_state: invitation.readiness_state };
}

export async function resolveRecruitingBaOwnerProfile(req, clientOwnerProfileId, { required = false, env = process.env } = {}) {
  if (!required) return { recruiting: false, owner_profile_id: clientOwnerProfileId };
  const inviteSessionToken = parseCookies(req.headers?.cookie)[INVITE_COOKIE];
  if (!inviteSessionToken) throw new Error('RECRUITING_INVITE_SESSION_REQUIRED');
  const inspected = await getRecruitingService(env).inspectInviteSession(inviteSessionToken);
  if (!inspected.relationship.bos_profile_id) throw new Error('RECRUITING_BOS_READY_REQUIRED_FOR_BA');
  return {
    recruiting: true,
    relationship_ref: inspected.relationship.relationship_ref,
    owner_profile_id: inspected.relationship.bos_profile_id,
  };
}

export function validateCanonicalBaReadyReceipt(receipt, { profileId = null, assessmentId = null } = {}) {
  if (receipt?.contract !== 'recruiting_canonical_new_ba_ready_receipt_v1') {
    throw new Error('RECRUITING_CANONICAL_BA_RECEIPT_REQUIRED');
  }
  if (receipt.completeness !== 'PASS' || receipt.customer_projection_completeness !== 'COMPLETE') {
    throw new Error('RECRUITING_CANONICAL_BA_INCOMPLETE');
  }
  if (!receipt.realization_id || !/^[a-f0-9]{64}$/u.test(String(receipt.realization_sha256 || ''))
      || !/^[a-f0-9]{64}$/u.test(String(receipt.artifact_sha256 || ''))) {
    throw new Error('RECRUITING_CANONICAL_BA_IDENTITY_INVALID');
  }
  if (profileId && String(receipt.profile_id).toUpperCase() !== String(profileId).toUpperCase()) {
    throw new Error('RECRUITING_CANONICAL_BA_PROFILE_MISMATCH');
  }
  if (assessmentId && receipt.assessment_id !== assessmentId) {
    throw new Error('RECRUITING_CANONICAL_BA_ASSESSMENT_MISMATCH');
  }
  return Object.freeze({ ...receipt });
}

function canonicalReadyReceipt(result) {
  if (result?.pending || !result?.artifact || !result?.receipt) return null;
  const artifact = result.artifact;
  const receipt = result.receipt;
  return validateCanonicalBaReadyReceipt({
    contract: 'recruiting_canonical_new_ba_ready_receipt_v1',
    profile_id: artifact.profile_id,
    assessment_id: artifact.assessment_id,
    realization_id: artifact.realization_id,
    realization_sha256: receipt.realization_sha256,
    artifact_sha256: receipt.artifact_sha256,
    completeness: receipt.completeness,
    customer_projection_completeness: artifact.state?.completeness,
    retrieval_path: receipt.path,
  });
}

export async function projectRecruitingBaState({ relationshipRef, assessmentId, state, canonicalReceipt = null, env = process.env }) {
  if (!relationshipRef) return { projected: false, reason: 'NOT_A_RECRUITING_ASSESSMENT' };
  const readyReceipt = state === 'BA_INTELLIGENCE_READY'
    ? validateCanonicalBaReadyReceipt(canonicalReceipt, { assessmentId })
    : null;
  const invitation = await getRecruitingService(env).projectBaState(relationshipRef, {
    assessment_id: assessmentId,
    state,
    canonical_receipt: readyReceipt,
  });
  return { projected: true, candidate_id: invitation.candidate_id, ba_readiness: invitation.ba_readiness };
}

export async function reconcileRecruitingCanonicalBaReady({ redis, result, env = process.env }) {
  const receipt = canonicalReadyReceipt(result);
  if (!receipt) return { projected: false, reason: 'CANONICAL_BA_NOT_COMPLETE' };
  if (typeof redis?.get !== 'function') throw new Error('RECRUITING_CANONICAL_BA_REDIS_REQUIRED');
  const raw = await redis.get(businessAssessmentKey(receipt.assessment_id));
  if (!raw) throw new Error('RECRUITING_CANONICAL_BA_ASSESSMENT_NOT_FOUND');
  const assessment = JSON.parse(raw);
  if (String(assessment.owner_profile_id || '').toLowerCase() !== String(receipt.profile_id || '').toLowerCase()
      || assessment.assessment_id !== receipt.assessment_id) {
    throw new Error('RECRUITING_CANONICAL_BA_ASSESSMENT_IDENTITY_MISMATCH');
  }
  const relationshipRef = assessment.metadata?.recruiting_relationship_ref || null;
  return projectRecruitingBaState({
    relationshipRef,
    assessmentId: receipt.assessment_id,
    state: 'BA_INTELLIGENCE_READY',
    canonicalReceipt: receipt,
    env,
  });
}

function projectionRetryKey(env, receipt) {
  const namespace = normalizeRecruitingNamespace(env.RECRUITING_V1_NAMESPACE);
  return `more:${namespace}:projection-retry:v1:${String(receipt.profile_id).toLowerCase()}:${receipt.realization_id}`;
}

export async function reconcileRecruitingCanonicalBaReadySafely({ redis, result, env = process.env }) {
  const receipt = canonicalReadyReceipt(result);
  if (!receipt) return { projected: false, reason: 'CANONICAL_BA_NOT_COMPLETE' };
  try {
    const projected = await reconcileRecruitingCanonicalBaReady({ redis, result, env });
    if (projected.projected && typeof redis?.del === 'function' && !syntheticReviewEnabled(env)) {
      await redis.del(projectionRetryKey(env, receipt));
    }
    return projected;
  } catch (error) {
    if (typeof redis?.set === 'function' && !syntheticReviewEnabled(env)) {
      const retryReceipt = Object.freeze({
        contract: 'recruiting_canonical_ba_projection_retry_receipt_v1',
        profile_id: receipt.profile_id,
        assessment_id: receipt.assessment_id,
        realization_id: receipt.realization_id,
        failure_code: String(error?.message || 'RECRUITING_CANONICAL_PROJECTION_FAILED').split(':')[0].slice(0, 160),
        retryable: true,
        canonical_ba_accepted: true,
        raw_error_persisted: false,
        created_at: new Date().toISOString(),
      });
      await redis.set(projectionRetryKey(env, receipt), JSON.stringify(retryReceipt), 'EX', 7 * 24 * 60 * 60);
    }
    return { projected: false, deferred: true, reason: 'RECRUITING_CANONICAL_PROJECTION_DEFERRED' };
  }
}

export const RECRUITING_CANONICAL_ADAPTER = Object.freeze({
  accepts_client_profile_id_as_authority: false,
  relationship_reference_is_secret: false,
  canonical_semantics_mutated: false,
  synthetic_review_enabled: syntheticReviewEnabled(),
});
