import {
  developerAccessEnvironmentDecision,
  developerCapabilityFromCookie,
  getDefaultDeveloperSecurityStore,
  verifyDeveloperCapability,
} from './developer-access-security.js';
import { shapePrivacyResponse } from '../../src/lib/intelligenceFabric/coachConnect/security/privacy.js';

export const MONTHLY_INTELLIGENCE_ACCESS_TYPE = 'more_monthly_intelligence';

export function resolveSubscriptionEntitlement({
  req,
  env = globalThis.process?.env || {},
  now = Date.now(),
  paidAccessGrant = null,
  store = getDefaultDeveloperSecurityStore(),
  subject_binding = null,
}) {
  if (paidAccessGrant?.access_type === MONTHLY_INTELLIGENCE_ACCESS_TYPE && paidAccessGrant.status === 'active') {
    return {
      allowed: true,
      entitlement: {
        access_type: MONTHLY_INTELLIGENCE_ACCESS_TYPE,
        status: 'active',
        source: 'paid_stripe',
        temporary: false,
        billing_evidence: true,
      },
    };
  }
  const environment = developerAccessEnvironmentDecision(env, store);
  if (!environment.ok) return { allowed: false, code: environment.code };
  const token = developerCapabilityFromCookie(req?.headers?.cookie);
  const verified = verifyDeveloperCapability({ token, env, now, store, subject_binding });
  if (!verified.valid) return { allowed: false, code: verified.code || 'CAPABILITY_INVALID' };
  const entitlement = {
    access_type: MONTHLY_INTELLIGENCE_ACCESS_TYPE,
    status: 'active',
    source: 'temporary_internal_subscription_entitlement',
    temporary: true,
    expires_at: new Date(verified.claims.expires_at).toISOString(),
    billing_evidence: false,
    stripe_subscription_created: false,
    admin_authority: false,
    coach_authority: false,
    operator_authority: false,
    canonical_mutation_authority: false,
  };
  const shaped = shapePrivacyResponse('entitlement', entitlement);
  return shaped.ok ? { allowed: true, entitlement: shaped.value } : { allowed: false, code: shaped.code };
}
