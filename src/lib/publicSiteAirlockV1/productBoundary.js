/* global process */
import { normalizeProfileId } from './contracts.js';
import { verifyStartToken } from './security.js';

function parse(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function authorizeProductRequest({ req, store, productKey, profileId = '', env = process.env }) {
  if (String(env.PUBLIC_PRODUCT_START_ENFORCEMENT_ENABLED || '').toLowerCase() !== 'true') {
    return { mode: 'legacy_rollout_disabled', grant: null, claims: null };
  }
  const token = req.headers?.['x-more-start-token'];
  let claims;
  try {
    claims = verifyStartToken(token, env.PUBLIC_PRODUCT_START_SIGNING_KEY);
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

export async function bindBosJobToGrant({ store, grant, jobId }) {
  if (!grant?.grant_id) return;
  const key = `public_product_v1:bos_job:${jobId}`;
  const existing = await store.get(key);
  if (existing && existing !== grant.grant_id) throw new Error('public_bos_job_binding_conflict');
  await store.set(key, grant.grant_id);
}

export async function bindBosProfileToGrant({ store, jobId, profileId }) {
  const grantId = await store.get(`public_product_v1:bos_job:${jobId}`);
  const normalized = normalizeProfileId(profileId);
  if (!grantId || !normalized) return null;
  const key = `access_grant:${grantId}`;
  const grant = parse(await store.get(key));
  if (!grant || grant.product_key !== 'behavior_operating_system') return null;
  if (grant.profile_id && normalizeProfileId(grant.profile_id) !== normalized) throw new Error('public_bos_profile_binding_conflict');
  const next = { ...grant, profile_id: normalized, updated_at: new Date().toISOString() };
  await store.set(key, JSON.stringify(next));
  await store.sadd(`access_grant_by_profile:${normalized}`, grantId);
  return next;
}
