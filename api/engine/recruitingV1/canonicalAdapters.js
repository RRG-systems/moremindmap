/* global process */

import { createHash } from 'node:crypto';
import { getRecruitingService, syntheticReviewEnabled } from './runtime.js';
import { RECRUITING_BOS_JOB_TTL_SECONDS } from '../miniV2JobManager.js';
import { businessAssessmentByProfileKey, businessAssessmentKey } from '../../business-assessment/shared.js';
import { normalizeRecruitingNamespace } from './redisStore.js';
import {
  PRODUCT_EXECUTION_CONTRACT_VERSION,
  authorizeExistingProductRead,
  authorizeProductRequest,
  productExecutionFingerprint,
} from '../../../src/lib/publicSiteAirlockV1/productBoundary.js';
import {
  readVerifiedProfileOwnerRequest,
  resolveProfileOwnershipAudience,
} from '../../../src/lib/publicSiteAirlockV1/profileOwnership.js';
import { temporaryProfileIdOnlyReadAuthority } from '../../../src/lib/publicSiteAirlockV1/temporaryProfileIdOnlyRetrieval.js';

const INVITE_COOKIE = '__Host-more_recruiting_invite';
const BOS_JOB_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,179}$/iu;

function parseCookies(header = '') {
  return Object.fromEntries(String(header).split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    if (index < 0) return [part, ''];
    try { return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))]; }
    catch { return [part.slice(0, index), '']; }
  }));
}

function normalizeProfileId(value) {
  const match = String(value || '').trim().match(/^m{2}-(\d{8})-([a-z0-9]{8})$/iu);
  return match ? `mm-${match[1]}-${match[2].toLowerCase()}` : null;
}

function normalizeAssessmentId(value) {
  const match = String(value || '').trim().match(/^ba-(\d{8})-([a-f0-9]{8})$/iu);
  return match ? `ba-${match[1]}-${match[2].toLowerCase()}` : null;
}

function normalizeBosJobId(value) {
  const jobId = String(value || '').trim();
  return BOS_JOB_ID_PATTERN.test(jobId) ? jobId : null;
}

function parseRecord(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function inviteSessionToken(req) {
  return parseCookies(req?.headers?.cookie)[INVITE_COOKIE] || null;
}

async function inspectAcceptedInviteAuthority(req, env = process.env) {
  const token = inviteSessionToken(req);
  if (!token) throw new Error('RECRUITING_INVITE_SESSION_REQUIRED');
  const inspected = await getRecruitingService(env).inspectInviteSession(token);
  const relationshipRef = String(inspected?.relationship?.relationship_ref || '').trim();
  const candidateId = String(inspected?.relationship?.candidate_id || '').trim();
  if (!relationshipRef || !candidateId || inspected?.relationship?.purpose !== 'RECRUITING_INTELLIGENCE') {
    throw new Error('RECRUITING_INVITE_SESSION_SCOPE_INVALID');
  }
  return Object.freeze({
    mode: 'recruiting_invite_session',
    grant: null,
    claims: null,
    relationship_ref: relationshipRef,
    candidate_id: candidateId,
    profile_id: normalizeProfileId(inspected.relationship.bos_profile_id),
    assessment_id: inspected.relationship.ba_assessment_id || null,
  });
}

/**
 * Accepted Recruiting invitations are a separate, server-verified customer
 * authority. They never mint or impersonate a public purchase grant. Every
 * resource access after BOS start must match the relationship/Profile binding
 * already held by the Recruiting service and, when present, its BA identity.
 */
export async function authorizeRecruitingProductRequest({
  req,
  productKey,
  profileId = '',
  relationshipRef = '',
  assessmentId = '',
  env = process.env,
  allowUnboundBosStart = false,
  allowProfileBoundBaRead = false,
} = {}) {
  const authority = await inspectAcceptedInviteAuthority(req, env);
  const expectedRelationshipRef = String(relationshipRef || '').trim();
  const expectedProfileId = normalizeProfileId(profileId);
  const expectedAssessmentId = String(assessmentId || '').trim().toLowerCase();

  if (expectedRelationshipRef && authority.relationship_ref !== expectedRelationshipRef) {
    throw new Error('RECRUITING_PRODUCT_RELATIONSHIP_SCOPE_DENIED');
  }
  if (productKey === 'behavior_operating_system') {
    if (!allowUnboundBosStart && !expectedRelationshipRef && !expectedProfileId) {
      throw new Error('RECRUITING_PRODUCT_RESOURCE_BINDING_REQUIRED');
    }
    if (expectedProfileId && authority.profile_id !== expectedProfileId) {
      throw new Error('RECRUITING_PRODUCT_PROFILE_SCOPE_DENIED');
    }
    return authority;
  }
  if (productKey !== 'business_assessment') {
    throw new Error('RECRUITING_PRODUCT_SCOPE_DENIED');
  }
  if ((!expectedRelationshipRef && !allowProfileBoundBaRead)
      || !expectedProfileId
      || authority.profile_id !== expectedProfileId) {
    throw new Error('RECRUITING_PRODUCT_PROFILE_SCOPE_DENIED');
  }
  if (expectedAssessmentId
      && String(authority.assessment_id || '').trim().toLowerCase() !== expectedAssessmentId) {
    throw new Error('RECRUITING_PRODUCT_ASSESSMENT_SCOPE_DENIED');
  }
  return authority;
}

export async function authorizePublicOrRecruitingProductRequest({
  req,
  store,
  productKey,
  profileId = '',
  relationshipRef = '',
  assessmentId = '',
  env = process.env,
  read = false,
  force = false,
  allowUnboundBosStart = false,
  allowProfileBoundBosRead = false,
  allowProfileBoundBaRead = false,
  allowTemporaryProfileIdOnlyRead = false,
} = {}) {
  const recruitingResourceBound = Boolean(
    allowUnboundBosStart
      || relationshipRef
      || (productKey === 'behavior_operating_system' && allowProfileBoundBosRead && normalizeProfileId(profileId))
      || (productKey === 'business_assessment' && allowProfileBoundBaRead && normalizeProfileId(profileId)),
  );
  if (recruitingResourceBound) {
    try {
      return await authorizeRecruitingProductRequest({
        req,
        productKey,
        profileId,
        relationshipRef,
        assessmentId,
        env,
        allowUnboundBosStart,
        allowProfileBoundBaRead,
      });
    } catch {
      // A missing, stale, or cross-scope invite never weakens the ordinary
      // public grant/owner boundary below.
    }
  }
  const authorizePublic = read ? authorizeExistingProductRead : authorizeProductRequest;
  const temporaryAuthority = read
    ? temporaryProfileIdOnlyReadAuthority({
      env,
      productKey,
      profileId,
      allowed: allowTemporaryProfileIdOnlyRead,
    })
    : null;
  try {
    const authority = await authorizePublic({ req, store, productKey, profileId, env, force });
    return temporaryAuthority && authority?.mode === 'legacy_rollout_disabled'
      ? temporaryAuthority
      : authority;
  } catch (error) {
    if (temporaryAuthority) return temporaryAuthority;
    throw error;
  }
}

/**
 * Resolve an Assessment-ID locator before reading the assessment itself.
 * Accepted Recruiting authority is bound to the server-held assessment ID;
 * public authority is bound through the grant's committed execution receipt.
 * A Profile-owner receipt cannot be resolved here because its Profile is held
 * inside the still-unread assessment and must use the bounded fallback in the
 * retrieve handler.
 */
export async function authorizeBusinessAssessmentIdBeforeRead({
  req,
  store,
  assessmentId,
  env = process.env,
  force = true,
} = {}) {
  const expectedAssessmentId = normalizeAssessmentId(assessmentId);
  if (!expectedAssessmentId) throw new Error('public_product_authority_denied');

  if (inviteSessionToken(req)) {
    try {
      const authority = await inspectAcceptedInviteAuthority(req, env);
      if (!authority.profile_id
          || normalizeAssessmentId(authority.assessment_id) !== expectedAssessmentId) {
        throw new Error('RECRUITING_PRODUCT_ASSESSMENT_SCOPE_DENIED');
      }
      return authority;
    } catch {
      // A stale/cross-scope invite may coexist with a valid public grant. It
      // never authorizes the locator and never weakens the public path below.
    }
  }

  let ownerAudience = '';
  try { ownerAudience = resolveProfileOwnershipAudience(env); } catch { ownerAudience = ''; }
  const owner = readVerifiedProfileOwnerRequest({
    cookieHeader: req?.headers?.cookie,
    signingKey: env.MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_SIGNING_KEY,
    audience: ownerAudience,
  });
  if (owner?.profile_id) {
    const ownerAssessmentId = normalizeAssessmentId(
      await store.get(businessAssessmentByProfileKey(owner.profile_id)),
    );
    if (ownerAssessmentId !== expectedAssessmentId) {
      throw new Error('public_product_authority_denied');
    }
    return Object.freeze({
      mode: 'profile_owner_receipt',
      grant: null,
      claims: null,
      profile_id: owner.profile_id,
      assessment_id: expectedAssessmentId,
    });
  }

  const authority = await authorizeProductRequest({
    req,
    store,
    productKey: 'business_assessment',
    env,
    force,
  });
  if (authority.mode === 'legacy_rollout_disabled') return authority;

  const profileId = normalizeProfileId(authority.grant?.profile_id);
  const execution = parseRecord(await store.get(
    `public_product_v1:grant_execution:${authority.grant?.grant_id || ''}`,
  ));
  if (!profileId
      || !execution
      || execution.contract_version !== PRODUCT_EXECUTION_CONTRACT_VERSION
      || execution.authority_type !== 'PUBLIC_GRANT'
      || execution.authority_ref !== authority.grant.grant_id
      || execution.product_key !== 'business_assessment'
      || execution.state !== 'COMMITTED'
      || normalizeAssessmentId(execution.identifiers?.assessment_id) !== expectedAssessmentId) {
    throw new Error('public_product_authority_denied');
  }
  return Object.freeze({ ...authority, profile_id: profileId, assessment_id: expectedAssessmentId });
}

export async function resolveRecruitingBosStartMetadata(req, clientMetadata = {}, env = process.env, { authority = null } = {}) {
  const requested = clientMetadata?.recruiting_mode === 'accepted_invitation';
  const safeMetadata = Object.fromEntries(Object.entries(clientMetadata || {}).filter(([key]) => !key.toLowerCase().startsWith('recruiting_')));
  if (authority?.mode === 'recruiting_invite_session') {
    return {
      ...safeMetadata,
      recruiting_relationship_ref: authority.relationship_ref,
      recruiting_purpose: 'RECRUITING_INTELLIGENCE',
    };
  }
  if (authority && authority.mode !== 'legacy_rollout_disabled') return safeMetadata;
  if (!requested) return safeMetadata;
  const inspected = await inspectAcceptedInviteAuthority(req, env);
  return {
    ...safeMetadata,
    recruiting_relationship_ref: inspected.relationship_ref,
    recruiting_purpose: 'RECRUITING_INTELLIGENCE',
  };
}

export async function projectRecruitingBosInProgress({ relationshipRef, jobId, env = process.env } = {}) {
  const normalizedRelationshipRef = String(relationshipRef || '').trim();
  if (!normalizedRelationshipRef) return { projected: false, reason: 'NOT_A_RECRUITING_JOB' };
  const normalizedJobId = String(jobId || '').trim();
  if (!normalizedJobId) throw new Error('RECRUITING_BOS_JOB_BINDING_REQUIRED');
  let invitation;
  try {
    invitation = await getRecruitingService(env).projectBosInProgress(normalizedRelationshipRef, {
      job_id: normalizedJobId,
    });
  } catch (error) {
    if (error?.message === 'RECRUITING_BOS_STATE_REGRESSION_DENIED') {
      return { projected: true, already_advanced: true, reason: 'RECRUITING_BOS_ALREADY_ADVANCED' };
    }
    throw error;
  }
  return {
    projected: true,
    candidate_id: invitation.candidate_id,
    readiness_state: invitation.readiness_state,
    progress_state: invitation.progress_state,
    bos_job_id: normalizedJobId,
  };
}

/**
 * Repair only the durable post-commit projection seam. The relationship comes
 * from an already-inspected HttpOnly invite session; neither the relationship
 * nor job locator is accepted from the browser. A still-existing job must
 * independently agree with the committed execution receipt before mutation.
 */
export async function reconcileRecruitingBosStartFromCommittedExecution({
  inspected,
  store,
  service = getRecruitingService(),
  validateExistingJob = false,
} = {}) {
  const relationship = inspected?.relationship;
  const relationshipRef = String(relationship?.relationship_ref || '').trim();
  const candidateId = String(relationship?.candidate_id || '').trim();
  const session = inspected?.invite_session;
  if (!relationshipRef
      || !candidateId
      || String(session?.invitation_id || '') !== relationshipRef
      || String(session?.candidate_id || '') !== candidateId
      || relationship?.purpose !== 'RECRUITING_INTELLIGENCE') {
    throw new Error('RECRUITING_INVITE_SESSION_SCOPE_INVALID');
  }

  const progressState = String(relationship?.progress_state || '');
  const existingJobId = normalizeBosJobId(relationship?.bos_job_id);
  if (relationship?.bos_profile_id
      || (relationship?.bos_job_id && !validateExistingJob)
      || !['INVITED', 'BOS_IN_PROGRESS'].includes(progressState)) {
    return Object.freeze({ reconciled: false, reason: 'RECRUITING_BOS_BINDING_NOT_REQUIRED' });
  }
  if (typeof store?.get !== 'function' || typeof store?.expire !== 'function') {
    throw new Error('RECRUITING_BOS_EXECUTION_STORE_REQUIRED');
  }

  const executionKey = `recruiting_v1:product_execution:${relationshipRef}:behavior_operating_system`;
  const executionRaw = await store.get(executionKey);
  if (!executionRaw) {
    if (progressState === 'BOS_IN_PROGRESS') {
      throw new Error('RECRUITING_BOS_EXECUTION_RECEIPT_REQUIRED');
    }
    return Object.freeze({ reconciled: false, reason: 'RECRUITING_BOS_NOT_STARTED' });
  }

  const execution = parseRecord(executionRaw);
  const rawExecutionJobId = execution?.identifiers?.job_id;
  const rawResultJobId = execution?.result?.job_id;
  const jobId = normalizeBosJobId(rawExecutionJobId);
  const resultJobId = normalizeBosJobId(rawResultJobId);
  if (!execution
      || execution.contract_version !== PRODUCT_EXECUTION_CONTRACT_VERSION
      || execution.authority_type !== 'RECRUITING_RELATIONSHIP'
      || execution.authority_ref !== relationshipRef
      || execution.product_key !== 'behavior_operating_system'
      || execution.state !== 'COMMITTED'
      || !/^[a-f0-9]{64}$/u.test(String(execution.request_sha256 || ''))
      || execution.result?.success !== true
      || !jobId
      || rawExecutionJobId !== jobId
      || rawResultJobId !== jobId
      || resultJobId !== jobId) {
    throw new Error('RECRUITING_BOS_EXECUTION_RECEIPT_INVALID');
  }
  if (relationship?.bos_job_id && (!existingJobId || existingJobId !== jobId)) {
    throw new Error('RECRUITING_BOS_EXECUTION_JOB_MISMATCH');
  }

  const jobKey = `job:${jobId}`;
  const job = parseRecord(await store.get(jobKey));
  if (!job
      || job.job_id !== jobId
      || normalizeBosJobId(job.job_id) !== jobId
      || !job.payload
      || typeof job.payload !== 'object'
      || Array.isArray(job.payload)
      || job.payload?.metadata?.recruiting_relationship_ref !== relationshipRef
      || job.payload?.metadata?.recruiting_purpose !== 'RECRUITING_INTELLIGENCE'
      || !/^[a-f0-9]{64}$/u.test(String(job.intake_payload_sha256 || ''))) {
    throw new Error('RECRUITING_BOS_JOB_BINDING_INVALID');
  }
  const jobPayloadSha256 = createHash('sha256').update(JSON.stringify(job.payload)).digest('hex');
  if (jobPayloadSha256 !== job.intake_payload_sha256
      || productExecutionFingerprint('behavior_operating_system', job.payload) !== execution.request_sha256) {
    throw new Error('RECRUITING_BOS_EXECUTION_PAYLOAD_MISMATCH');
  }
  if (inspected?.preparation_authority) {
    if (typeof service?.assertCandidatePreparationAuthority !== 'function') {
      throw new Error('RECRUITING_CONSULTING_PREPARATION_AUTHORITY_RECHECK_REQUIRED');
    }
    await service.assertCandidatePreparationAuthority(inspected.preparation_authority);
  }
  if (await store.expire(jobKey, RECRUITING_BOS_JOB_TTL_SECONDS) !== 1) {
    throw new Error('RECRUITING_BOS_JOB_RETENTION_FAILED');
  }

  if (existingJobId) {
    return Object.freeze({ reconciled: false, validated: true, job_id: jobId });
  }

  await service.projectBosInProgress(relationshipRef, {
    job_id: jobId,
    ...(inspected?.preparation_authority ? { preparation_authority: inspected.preparation_authority } : {}),
  });
  return Object.freeze({ reconciled: true, job_id: jobId });
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

/**
 * Repair the one recoverable BOS partial-failure seam: the canonical job and
 * Vault record committed, but Recruiting readiness projection did not. The
 * exact job, relationship, Profile, and Vault envelope must all agree before
 * this invokes the existing idempotent Recruiting binding.
 */
export async function reconcileRecruitingBosReadyFromCompletedJob({
  redis,
  authority,
  job,
  env = process.env,
  service = null,
} = {}) {
  if (!['recruiting_invite_session', 'recruiting_manager_candidate_preparation'].includes(authority?.mode)) {
    return { projected: false, reason: 'NOT_A_RECRUITING_JOB' };
  }
  if (job?.status !== 'complete') {
    return { projected: false, reason: 'RECRUITING_BOS_JOB_NOT_COMPLETE' };
  }
  const relationshipRef = String(job.payload?.metadata?.recruiting_relationship_ref || '').trim();
  const profileId = normalizeProfileId(job.canonical_profile_id);
  if (!relationshipRef || relationshipRef !== authority.relationship_ref) {
    throw new Error('RECRUITING_COMPLETED_BOS_RELATIONSHIP_MISMATCH');
  }
  if (authority.mode === 'recruiting_manager_candidate_preparation'
      && (!authority.candidate_id || authority.bos_job_id !== job.job_id)) {
    throw new Error('RECRUITING_COMPLETED_BOS_JOB_AUTHORITY_MISMATCH');
  }
  if (!profileId) throw new Error('RECRUITING_COMPLETED_BOS_PROFILE_REQUIRED');
  if (authority.profile_id) {
    if (authority.profile_id !== profileId) {
      throw new Error('RECRUITING_COMPLETED_BOS_PROFILE_MISMATCH');
    }
    return { projected: true, reconciled: false, reason: 'RECRUITING_BOS_ALREADY_BOUND' };
  }
  if (typeof redis?.get !== 'function') throw new Error('RECRUITING_COMPLETED_BOS_REDIS_REQUIRED');

  const vaultKey = `vault:profile:${profileId}`;
  const vault = parseRecord(await redis.get(vaultKey));
  if (!vault
      || normalizeProfileId(vault.profile_id) !== profileId
      || String(vault.job_id || '') !== String(job.job_id || '')
      || !vault.canonical_profile_json
      || typeof vault.canonical_profile_json !== 'object'
      || Array.isArray(vault.canonical_profile_json)) {
    throw new Error('RECRUITING_COMPLETED_BOS_VAULT_IDENTITY_MISMATCH');
  }

  const recruitingService = service || getRecruitingService(env);
  const invitation = await recruitingService.bindBosProfile(relationshipRef, profileId, {
      success: true,
      verified: true,
      vault_key: vaultKey,
      created_at: vault.created_at || null,
  }, authority.mode === 'recruiting_manager_candidate_preparation' ? { preparationAuthority: authority } : {});
  return { projected: true, candidate_id: invitation.candidate_id, readiness_state: invitation.readiness_state, reconciled: true };
}

export async function resolveRecruitingBaOwnerProfile(req, clientOwnerProfileId, {
  required = false,
  inspectIfPresent = false,
  env = process.env,
} = {}) {
  const token = inviteSessionToken(req);
  if (!required && (!inspectIfPresent || !token)) return { recruiting: false, owner_profile_id: clientOwnerProfileId };
  let inspected;
  try {
    inspected = await inspectAcceptedInviteAuthority(req, env);
  } catch (error) {
    if (required) throw error;
    return { recruiting: false, owner_profile_id: clientOwnerProfileId };
  }
  if (!inspected.profile_id) throw new Error('RECRUITING_BOS_READY_REQUIRED_FOR_BA');
  return {
    recruiting: true,
    relationship_ref: inspected.relationship_ref,
    owner_profile_id: inspected.profile_id,
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

async function readCanonicalBaSource(redis, receipt) {
  const profileId = normalizeProfileId(receipt?.profile_id);
  const assessmentId = normalizeAssessmentId(receipt?.assessment_id);
  if (!profileId || !assessmentId) {
    throw new Error('RECRUITING_CANONICAL_BA_ASSESSMENT_POINTER_MISMATCH');
  }
  const pointerKey = businessAssessmentByProfileKey(profileId);
  const pointerRaw = await redis.get(pointerKey);
  if (typeof pointerRaw !== 'string' || normalizeAssessmentId(pointerRaw) !== assessmentId) {
    throw new Error('RECRUITING_CANONICAL_BA_ASSESSMENT_POINTER_MISMATCH');
  }
  const assessmentKey = businessAssessmentKey(assessmentId);
  const assessmentRaw = await redis.get(assessmentKey);
  if (typeof assessmentRaw !== 'string' || !assessmentRaw) {
    throw new Error('RECRUITING_CANONICAL_BA_ASSESSMENT_NOT_FOUND');
  }
  const guards = Object.freeze([
    Object.freeze({ key: pointerKey, expected: pointerRaw }),
    Object.freeze({ key: assessmentKey, expected: assessmentRaw }),
  ]);
  return Object.freeze({
    assessment: JSON.parse(assessmentRaw),
    canonicalSourceGuard: Object.freeze({
      guards,
      async assertCurrent() {
        const current = await Promise.all(guards.map((guard) => redis.get(guard.key)));
        if (guards.some((guard, index) => current[index] !== guard.expected)) {
          throw new Error('RECRUITING_CANONICAL_BA_SOURCE_GUARD_CHANGED');
        }
      },
    }),
  });
}

function validateCanonicalBaSourceGuard(receipt, canonicalSourceGuard) {
  const profileId = normalizeProfileId(receipt?.profile_id);
  const assessmentId = normalizeAssessmentId(receipt?.assessment_id);
  const pointerKey = profileId ? businessAssessmentByProfileKey(profileId) : null;
  const assessmentKey = assessmentId ? businessAssessmentKey(assessmentId) : null;
  const guards = canonicalSourceGuard?.guards;
  if (!pointerKey || !assessmentKey
      || !Array.isArray(guards)
      || guards.length !== 2
      || typeof canonicalSourceGuard.assertCurrent !== 'function') {
    throw new Error('RECRUITING_CANONICAL_BA_SOURCE_GUARD_INVALID');
  }
  const pointer = guards.find((guard) => guard?.key === pointerKey);
  const assessment = guards.find((guard) => guard?.key === assessmentKey);
  if (typeof pointer?.expected !== 'string'
      || normalizeAssessmentId(pointer.expected) !== assessmentId
      || typeof assessment?.expected !== 'string'
      || !assessment.expected) {
    throw new Error('RECRUITING_CANONICAL_BA_SOURCE_GUARD_INVALID');
  }
  let record;
  try { record = JSON.parse(assessment.expected); } catch {
    throw new Error('RECRUITING_CANONICAL_BA_SOURCE_GUARD_INVALID');
  }
  return Object.freeze({ assessment: record, canonicalSourceGuard });
}

export async function projectRecruitingBaState({ relationshipRef, assessmentId, state, canonicalReceipt = null, canonicalSourceGuard = null, env = process.env, service = null, authority = null }) {
  if (!relationshipRef) return { projected: false, reason: 'NOT_A_RECRUITING_ASSESSMENT' };
  const readyReceipt = state === 'BA_INTELLIGENCE_READY'
    ? validateCanonicalBaReadyReceipt(canonicalReceipt, { assessmentId })
    : null;
  const recruitingService = service || getRecruitingService(env);
  const invitation = await recruitingService.projectBaState(relationshipRef, {
    assessment_id: assessmentId,
    state,
    canonical_receipt: readyReceipt,
    ...(authority?.mode === 'recruiting_manager_candidate_preparation' ? { preparation_authority: authority } : {}),
    ...(canonicalSourceGuard ? { canonical_source_guard: canonicalSourceGuard } : {}),
  });
  return { projected: true, candidate_id: invitation.candidate_id, ba_readiness: invitation.ba_readiness };
}

export async function reconcileRecruitingCanonicalBaReady({ redis, result, env = process.env, service = null, authority = null, canonicalSourceGuard = null }) {
  const receipt = canonicalReadyReceipt(result);
  if (!receipt) return { projected: false, reason: 'CANONICAL_BA_NOT_COMPLETE' };
  if (typeof redis?.get !== 'function') throw new Error('RECRUITING_CANONICAL_BA_REDIS_REQUIRED');
  const source = canonicalSourceGuard
    ? validateCanonicalBaSourceGuard(receipt, canonicalSourceGuard)
    : await readCanonicalBaSource(redis, receipt);
  const { assessment } = source;
  if (String(assessment.owner_profile_id || '').toLowerCase() !== String(receipt.profile_id || '').toLowerCase()
      || assessment.assessment_id !== receipt.assessment_id) {
    throw new Error('RECRUITING_CANONICAL_BA_ASSESSMENT_IDENTITY_MISMATCH');
  }
  const relationshipRef = assessment.metadata?.recruiting_relationship_ref || null;
  if (authority?.mode === 'recruiting_manager_candidate_preparation'
      && (!authority.candidate_id
        || relationshipRef !== authority.relationship_ref
        || normalizeProfileId(authority.profile_id) !== normalizeProfileId(receipt.profile_id)
        || String(authority.assessment_id || '').trim().toLowerCase() !== receipt.assessment_id)) {
    throw new Error('RECRUITING_CANONICAL_BA_PREPARATION_AUTHORITY_MISMATCH');
  }
  return projectRecruitingBaState({
    relationshipRef,
    assessmentId: receipt.assessment_id,
    state: 'BA_INTELLIGENCE_READY',
    canonicalReceipt: receipt,
    canonicalSourceGuard: source.canonicalSourceGuard,
    env,
    service,
    authority,
  });
}

function projectionRetryKey(env, receipt) {
  const namespace = normalizeRecruitingNamespace(env.RECRUITING_V1_NAMESPACE);
  return `more:${namespace}:projection-retry:v1:${String(receipt.profile_id).toLowerCase()}:${receipt.realization_id}`;
}

function managerPreparationAuthorityFailure(error) {
  const code = String(error?.message || '').split(':')[0];
  return /^RECRUITING_(?:MANAGER_(?:SESSION_(?:REQUIRED|SCOPE_INVALID)|MEMBERSHIP_INACTIVE|SETUP_INCOMPLETE)|CANDIDATE_SCOPE_DENIED|CONSULTING_(?:ACCEPTED_CONSENT_REQUIRED|PREPARATION_AUTHORITY_CHANGED)|CANONICAL_BA_(?:(?:PREPARATION_AUTHORITY|ASSESSMENT_POINTER)_MISMATCH|SOURCE_GUARD_(?:CHANGED|INVALID))|ACCEPTED_RELATIONSHIP_REQUIRED)$/u.test(code);
}

export async function reconcileRecruitingCanonicalBaReadySafely({ redis, result, env = process.env, service = null, authority = null, canonicalSourceGuard = null }) {
  const receipt = canonicalReadyReceipt(result);
  if (!receipt) return { projected: false, reason: 'CANONICAL_BA_NOT_COMPLETE' };
  try {
    const projected = await reconcileRecruitingCanonicalBaReady({ redis, result, env, service, authority, canonicalSourceGuard });
    if (projected.projected && typeof redis?.del === 'function' && !syntheticReviewEnabled(env)) {
      await redis.del(projectionRetryKey(env, receipt));
    }
    return projected;
  } catch (error) {
    // A manager-preparation authorization loss is terminal for this request,
    // not a projection outage. Never persist a retry receipt that could later
    // replay a result after the manager/session/relationship was revoked.
    if (authority?.mode === 'recruiting_manager_candidate_preparation'
        && managerPreparationAuthorityFailure(error)) {
      throw error;
    }
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
