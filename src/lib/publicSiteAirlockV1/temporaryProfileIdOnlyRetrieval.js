/* global process */
import { normalizeProfileId } from './contracts.js';

const ALLOWED_PRODUCTS = new Set([
  'behavior_operating_system',
  'business_assessment',
]);

export const TEMPORARY_PROFILE_ID_ONLY_READ_MODE = 'temporary_profile_id_only_read';

// Founder-directed temporary incident seam. Removing the Production binding or
// setting it to anything other than exact "true" restores the signed owner
// receipt boundary without a code rollback. This authority is read-only and is
// never accepted by purchase, generation, Subscription, or mutation handlers.
export function temporaryProfileIdOnlyReadEnabled(env = process.env, productKey = '') {
  return String(env.PUBLIC_TEMPORARY_PROFILE_ID_ONLY_RETRIEVAL_ENABLED || '').trim().toLowerCase() === 'true'
    && ALLOWED_PRODUCTS.has(String(productKey || '').trim());
}

export function temporaryProfileIdOnlyReadAuthority({
  env = process.env,
  productKey = '',
  profileId = '',
  allowed = false,
} = {}) {
  if (!allowed
    || !temporaryProfileIdOnlyReadEnabled(env, productKey)
    || !normalizeProfileId(profileId)) return null;
  return Object.freeze({ mode: TEMPORARY_PROFILE_ID_ONLY_READ_MODE, grant: null, claims: null });
}

export function isReadOnlyCustomerAuthority(authority) {
  return authority?.mode === 'profile_owner_receipt'
    || authority?.mode === TEMPORARY_PROFILE_ID_ONLY_READ_MODE;
}
