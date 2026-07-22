import { developerAccessEnabled, developerCapabilityFromCookie, verifyDeveloperCapability } from './developer-access-security.js';

export const MONTHLY_INTELLIGENCE_ACCESS_TYPE = 'more_monthly_intelligence';

export function resolveSubscriptionEntitlement({ req, env = globalThis.process?.env || {}, now = Date.now(), paidAccessGrant = null }) {
  if (paidAccessGrant?.access_type === MONTHLY_INTELLIGENCE_ACCESS_TYPE && paidAccessGrant.status === 'active') return { allowed: true, entitlement: { access_type: MONTHLY_INTELLIGENCE_ACCESS_TYPE, status: 'active', source: 'paid_stripe', temporary: false, billing_evidence: true } };
  if (!developerAccessEnabled(env)) return { allowed: false, code: env.COACH_CONNECT_DEVELOPER_ACCESS_ENABLED === 'true' ? 'environment_not_allowed' : 'developer_access_disabled' };
  const token = developerCapabilityFromCookie(req?.headers?.cookie);
  const verified = verifyDeveloperCapability({ token, env, now });
  if (!verified.valid) return { allowed: false, code: 'temporary_entitlement_invalid' };
  return { allowed: true, entitlement: { access_type: MONTHLY_INTELLIGENCE_ACCESS_TYPE, status: 'active', source: 'temporary_internal_subscription_entitlement', temporary: true, expires_at: new Date(verified.claims.expires_at).toISOString(), billing_evidence: false, stripe_subscription_created: false, admin_authority: false, coach_authority: false, canonical_mutation_authority: false } };
}
