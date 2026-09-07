/* global process */
import { randomUUID } from 'node:crypto';
import { canonicalJson, normalizeProfileId, sha256 } from './contracts.js';
import { verifyStartToken } from './security.js';
import { resolveProfileOwnershipAudience, verifyProfileOwnerRequest } from './profileOwnership.js';

export const PRODUCT_EXECUTION_CONTRACT_VERSION = 'mmm-product-single-execution-v1';
const PRODUCT_EXECUTION_LEASE_MS = 30_000;

function parse(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function authorizeProductRequest({ req, store, productKey, profileId = '', env = process.env, force = false }) {
  if (!force && String(env.PUBLIC_PRODUCT_START_ENFORCEMENT_ENABLED || '').toLowerCase() !== 'true') {
    return { mode: 'legacy_rollout_disabled', grant: null, claims: null };
  }
  const token = req.headers?.['x-more-start-token'];
  let claims;
  try {
    claims = verifyStartToken(token, env.MOREMINDMAP_SERVER_ONLY_PRODUCT_START_SIGNING_KEY);
  } catch {
    throw new Error('public_product_authority_denied');
  }
  if (claims.product_key !== productKey) throw new Error('public_product_authority_denied');
  const grant = parse(await store.get(`access_grant:${claims.grant_id}`));
  if (!grant || grant.status !== 'active' || grant.product_key !== productKey) throw new Error('public_product_authority_denied');
  const normalized = normalizeProfileId(profileId);
  if (grant.profile_id && normalized && normalizeProfileId(grant.profile_id) !== normalized) {
    throw new Error('public_product_profile_binding_mismatch');
  }
  return { mode: 'server_grant', grant, claims };
}

export async function authorizeExistingProductRead({ req, store, productKey, profileId = '', env = process.env, force = false }) {
  if (!force && String(env.PUBLIC_PRODUCT_START_ENFORCEMENT_ENABLED || '').toLowerCase() !== 'true') {
    return { mode: 'legacy_rollout_disabled', grant: null, claims: null };
  }
  try {
    const authority = await authorizeProductRequest({ req, store, productKey, profileId, env, force });
    const expectedProfileId = normalizeProfileId(profileId);
    const grantProfileId = normalizeProfileId(authority.grant?.profile_id);
    if (!expectedProfileId || !grantProfileId || grantProfileId !== expectedProfileId) {
      throw new Error('public_product_profile_binding_mismatch');
    }
    return authority;
  } catch (error) {
    let ownershipAudience = '';
    try { ownershipAudience = resolveProfileOwnershipAudience(env); } catch { ownershipAudience = ''; }
    if (verifyProfileOwnerRequest({
      profileId,
      cookieHeader: req.headers?.cookie,
      signingKey: env.MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_SIGNING_KEY,
      audience: ownershipAudience,
    })) {
      return { mode: 'profile_owner_receipt', grant: null, claims: null };
    }
    throw error;
  }
}

export async function bindBosJobToGrant({ store, grant, jobId }) {
  if (!grant?.grant_id) return;
  const key = `public_product_v1:bos_job:${jobId}`;
  const created = await store.setNx(key, grant.grant_id);
  if (!created) {
    const existing = await store.get(key);
    if (existing !== grant.grant_id) throw new Error('public_bos_job_binding_conflict');
  }
}

function productExecutionAuthority(authority, productKey) {
  if (authority?.grant?.grant_id) {
    return {
      authority_type: 'PUBLIC_GRANT',
      authority_ref: authority.grant.grant_id,
      key: `public_product_v1:grant_execution:${authority.grant.grant_id}`,
    };
  }
  if (authority?.mode === 'recruiting_invite_session' && authority.relationship_ref) {
    return {
      authority_type: 'RECRUITING_RELATIONSHIP',
      authority_ref: authority.relationship_ref,
      key: `recruiting_v1:product_execution:${authority.relationship_ref}:${productKey}`,
    };
  }
  return null;
}

export function productExecutionFingerprint(productKey, payload) {
  return sha256(canonicalJson({
    contract_version: PRODUCT_EXECUTION_CONTRACT_VERSION,
    product_key: productKey,
    payload,
  }));
}

export function deterministicExecutionUuid({ authorityRef, productKey, requestSha256, kind }) {
  const digest = sha256(canonicalJson({
    contract_version: PRODUCT_EXECUTION_CONTRACT_VERSION,
    authority_ref: authorityRef,
    product_key: productKey,
    request_sha256: requestSha256,
    kind,
  }));
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

export function deterministicAssessmentId({ authorityRef, productKey, requestSha256, now = Date.now() }) {
  const timestamp = new Date(now);
  const datePart = Number.isFinite(timestamp.getTime())
    ? timestamp.toISOString().slice(0, 10).replace(/-/gu, '')
    : '19700101';
  const digest = sha256(canonicalJson({
    contract_version: PRODUCT_EXECUTION_CONTRACT_VERSION,
    authority_ref: authorityRef,
    product_key: productKey,
    request_sha256: requestSha256,
    kind: 'assessment',
  }));
  return `ba-${datePart}-${digest.slice(0, 8)}`;
}

export async function claimProductExecution({
  store,
  authority,
  productKey,
  requestSha256,
  identifiers,
  context = null,
  now = Date.now(),
  leaseToken = randomUUID(),
  leaseMs = PRODUCT_EXECUTION_LEASE_MS,
}) {
  const executionAuthority = productExecutionAuthority(authority, productKey);
  if (!executionAuthority) return { code: 'BYPASS', record: null, key: null, lease_token: null };
  if (!/^[a-f0-9]{64}$/u.test(String(requestSha256 || ''))) {
    throw new Error('public_product_execution_fingerprint_invalid');
  }
  if (authority.grant && authority.grant.product_key !== productKey) {
    throw new Error('public_product_execution_authority_mismatch');
  }
  if (executionAuthority.authority_type === 'RECRUITING_RELATIONSHIP') {
    const alreadyBoundResource = productKey === 'behavior_operating_system'
      ? normalizeProfileId(authority.profile_id)
      : String(authority.assessment_id || '').trim().toLowerCase();
    if (alreadyBoundResource && !(await store.get(executionAuthority.key))) {
      throw new Error('public_product_execution_already_consumed');
    }
  }
  const nowMs = Number(now);
  const updatedAt = new Date(nowMs).toISOString();
  const initialRecord = {
    contract_version: PRODUCT_EXECUTION_CONTRACT_VERSION,
    authority_type: executionAuthority.authority_type,
    authority_ref: executionAuthority.authority_ref,
    product_key: productKey,
    request_sha256: requestSha256,
    identifiers,
    context,
    state: 'CLAIMED',
    result: null,
    lease_token: leaseToken,
    lease_until_ms: nowMs + leaseMs,
    created_at: updatedAt,
    updated_at: updatedAt,
  };
  const claimed = await store.claimProductExecution({
    key: executionAuthority.key,
    initialRecord,
    nowMs,
    leaseToken,
    leaseUntilMs: nowMs + leaseMs,
  });
  if (claimed?.code === 'CONFLICT') throw new Error('public_product_execution_replay_conflict');
  if (!['ACQUIRED', 'IN_PROGRESS', 'REPLAY'].includes(claimed?.code)) {
    throw new Error('public_product_execution_claim_failed');
  }
  const claimedJobId = String(claimed.record?.identifiers?.job_id || '');
  const proposedJobId = String(identifiers?.job_id || '');
  const claimedAssessmentId = String(claimed.record?.identifiers?.assessment_id || '');
  const proposedAssessmentId = String(identifiers?.assessment_id || '');
  const recordIdentityValid = claimed.record?.contract_version === PRODUCT_EXECUTION_CONTRACT_VERSION
    && claimed.record?.authority_type === executionAuthority.authority_type
    && claimed.record?.authority_ref === executionAuthority.authority_ref
    && claimed.record?.product_key === productKey
    && claimed.record?.request_sha256 === requestSha256
    && claimedJobId
    && claimedJobId === proposedJobId
    && (!proposedAssessmentId
      || (/^ba-\d{8}-[a-f0-9]{8}$/u.test(claimedAssessmentId)
        && claimedAssessmentId.slice(-8) === proposedAssessmentId.slice(-8)))
    && (!(executionAuthority.authority_type === 'RECRUITING_RELATIONSHIP'
        && productKey === 'business_assessment'
        && authority.assessment_id)
      || claimedAssessmentId === String(authority.assessment_id).trim().toLowerCase());
  if (!recordIdentityValid) throw new Error('public_product_execution_replay_conflict');
  return {
    ...claimed,
    key: executionAuthority.key,
    lease_token: claimed.code === 'ACQUIRED' ? leaseToken : null,
  };
}

export async function commitProductExecution({ store, claim, result, setValues = [], setMembers = [], now = Date.now() }) {
  if (claim?.code === 'BYPASS') return { code: 'BYPASS', record: null };
  if (claim?.code !== 'ACQUIRED' || !claim.key || !claim.lease_token) {
    throw new Error('public_product_execution_commit_not_owned');
  }
  const committed = await store.commitProductExecution({
    key: claim.key,
    leaseToken: claim.lease_token,
    result,
    setValues,
    setMembers,
    updatedAt: new Date(Number(now)).toISOString(),
  });
  if (!['COMMITTED', 'REPLAY'].includes(committed?.code)) {
    throw new Error('public_product_execution_commit_failed');
  }
  return committed;
}

export async function releaseProductExecution({ store, claim, now = Date.now() }) {
  if (claim?.code !== 'ACQUIRED' || !claim.key || !claim.lease_token) return 0;
  return store.releaseProductExecution({
    key: claim.key,
    leaseToken: claim.lease_token,
    updatedAt: new Date(Number(now)).toISOString(),
  });
}

export async function assertBosExecutionAuthority({ store, authority, jobId }) {
  const executionAuthority = productExecutionAuthority(authority, 'behavior_operating_system');
  if (!executionAuthority) return true;
  const record = parse(await store.get(executionAuthority.key));
  if (!record || record.contract_version !== PRODUCT_EXECUTION_CONTRACT_VERSION
      || record.authority_type !== executionAuthority.authority_type
      || record.product_key !== 'behavior_operating_system'
      || record.authority_ref !== executionAuthority.authority_ref
      || record.identifiers?.job_id !== jobId
      || record.state !== 'COMMITTED') {
    throw new Error('public_product_execution_binding_mismatch');
  }
  if (authority.grant) {
    const boundGrantId = await store.get(`public_product_v1:bos_job:${jobId}`);
    if (boundGrantId !== authority.grant.grant_id) throw new Error('public_product_execution_binding_mismatch');
  }
  return true;
}

export async function bindBosProfileToGrant({ store, jobId, profileId }) {
  const grantId = await store.get(`public_product_v1:bos_job:${jobId}`);
  const normalized = normalizeProfileId(profileId);
  if (!grantId || !normalized) return null;
  const key = `access_grant:${grantId}`;
  const grant = parse(await store.get(key));
  if (!grant || grant.product_key !== 'behavior_operating_system') return null;
  await assertBosExecutionAuthority({ store, authority: { grant }, jobId });
  if (grant.profile_id && normalizeProfileId(grant.profile_id) !== normalized) throw new Error('public_bos_profile_binding_conflict');
  const next = { ...grant, profile_id: normalized, updated_at: new Date().toISOString() };
  await store.set(key, JSON.stringify(next));
  await store.sadd(`access_grant_by_profile:${normalized}`, grantId);
  return next;
}
