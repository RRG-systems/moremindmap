import {
  developerAccessEnvironmentDecision,
  developerCapabilityFromCookie,
  getDefaultDeveloperSecurityStore,
  verifyDeveloperCapability,
} from './developer-access-security.js';
import { shapePrivacyResponse } from '../../src/lib/intelligenceFabric/coachConnect/security/privacy.js';
import { isThenable } from '../../src/lib/intelligenceFabric/coachConnect/productionSecurity/asyncSharedSecurityStatePort.js';
import {
  getPrivateRuntimeLiveCompositionV2,
} from '../../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveComposition.js';
import {
  entitlementAllowsCoaching,
  sameScope,
  validateSubscriptionV1Contract,
} from '../../src/lib/subscriptionV1/index.js';

export const MONTHLY_INTELLIGENCE_ACCESS_TYPE = 'more_monthly_intelligence';

async function resolveAsyncPrivateSubscriptionEntitlement({
  canonicalSecurityServiceV2,
  requestContext,
  requestedAction,
}) {
  if (typeof canonicalSecurityServiceV2?.evaluatePrivateRuntimeAuthority !== 'function'
    || typeof canonicalSecurityServiceV2?.inspectTemporaryEntitlement !== 'function') {
    return { allowed: false, code: 'ASYNC_SECURITY_UNCONFIGURED' };
  }
  let authorityPromise;
  try {
    authorityPromise = canonicalSecurityServiceV2.evaluatePrivateRuntimeAuthority({
      request_context: requestContext,
      requested_runtime: 'SUBSCRIPTION_RUNTIME',
      requested_action: requestedAction,
    });
  } catch {
    return { allowed: false, code: 'ASYNC_SECURITY_CONTRACT_VIOLATION' };
  }
  if (!isThenable(authorityPromise)) {
    return { allowed: false, code: 'ASYNC_SECURITY_CONTRACT_VIOLATION' };
  }
  let authority;
  try {
    authority = await authorityPromise;
  } catch {
    return { allowed: false, code: 'ASYNC_SECURITY_REJECTED' };
  }
  if (authority?.allowed !== true) {
    return { allowed: false, code: authority?.code || 'RUNTIME_AUTHORITY_DENIED' };
  }
  let entitlementPromise;
  try {
    entitlementPromise = canonicalSecurityServiceV2.inspectTemporaryEntitlement(requestContext);
  } catch {
    return { allowed: false, code: 'ASYNC_SECURITY_CONTRACT_VIOLATION' };
  }
  if (!isThenable(entitlementPromise)) {
    return { allowed: false, code: 'ASYNC_SECURITY_CONTRACT_VIOLATION' };
  }
  let inspected;
  try {
    inspected = await entitlementPromise;
  } catch {
    return { allowed: false, code: 'ASYNC_SECURITY_REJECTED' };
  }
  if (inspected?.allowed !== true
    || inspected.entitlement?.temporary !== true
    || inspected.entitlement?.paid_entitlement !== false
    || inspected.entitlement?.stripe_subscription_created !== false) {
    return { allowed: false, code: inspected?.code || 'ENTITLEMENT_INVALID' };
  }
  const entitlement = {
    access_type: MONTHLY_INTELLIGENCE_ACCESS_TYPE,
    status: 'active',
    source: 'temporary_internal_subscription_entitlement',
    temporary: true,
    expires_at: inspected.entitlement.expires_at,
    billing_evidence: false,
    stripe_subscription_created: false,
    admin_authority: false,
    coach_authority: false,
    operator_authority: false,
    canonical_mutation_authority: false,
  };
  const shaped = shapePrivacyResponse('entitlement', entitlement);
  return shaped.ok
    ? { allowed: true, entitlement: shaped.value, authority }
    : { allowed: false, code: shaped.code };
}

async function resolveComposedPrivateSubscriptionEntitlement({
  liveCompositionV2,
  req,
}) {
  const operation = liveCompositionV2?.operations?.resolveSubscriptionEntitlement;
  if (typeof operation !== 'function') {
    return { allowed: false, code: 'ASYNC_SECURITY_UNCONFIGURED' };
  }
  let returned;
  try {
    returned = operation(req);
  } catch {
    return { allowed: false, code: 'ASYNC_SECURITY_CONTRACT_VIOLATION' };
  }
  if (!isThenable(returned)) {
    return { allowed: false, code: 'ASYNC_SECURITY_CONTRACT_VIOLATION' };
  }
  let decision;
  try {
    decision = await returned;
  } catch {
    return { allowed: false, code: 'ASYNC_SECURITY_REJECTED' };
  }
  if (decision?.allowed !== true
    || decision.entitlement?.temporary !== true
    || decision.entitlement?.paid_entitlement !== false) {
    return { allowed: false, code: decision?.code || 'ENTITLEMENT_INVALID' };
  }
  const entitlement = {
    access_type: MONTHLY_INTELLIGENCE_ACCESS_TYPE,
    status: 'active',
    source: 'temporary_internal_subscription_entitlement',
    temporary: true,
    expires_at: decision.entitlement.expires_at,
    billing_evidence: false,
    stripe_subscription_created: false,
    admin_authority: false,
    coach_authority: false,
    operator_authority: false,
    canonical_mutation_authority: false,
  };
  const shaped = shapePrivacyResponse('entitlement', entitlement);
  return shaped.ok
    ? { allowed: true, entitlement: shaped.value, authority: decision.authority }
    : { allowed: false, code: shaped.code };
}

export function resolveSubscriptionEntitlement({
  req,
  env = globalThis.process?.env || {},
  now = Date.now(),
  paidAccessGrant = null,
  paidEntitlement = null,
  authenticatedMembershipScope = null,
  store = getDefaultDeveloperSecurityStore(),
  subject_binding = null,
  privateRuntimeDecision = null,
  canonicalSecurityServiceV2 = null,
  requestContext = null,
  requestedAction = 'inspect_private_subscription_entitlement',
  liveCompositionV2 = null,
  compositionAccessor = getPrivateRuntimeLiveCompositionV2,
}) {
  const explicitLegacy = canonicalSecurityServiceV2 != null
    || privateRuntimeDecision != null
    || paidAccessGrant != null
    || paidEntitlement != null
    || subject_binding != null;
  const composed = liveCompositionV2
    || (!explicitLegacy && typeof compositionAccessor === 'function'
      ? compositionAccessor()
      : null);
  if (composed) {
    return resolveComposedPrivateSubscriptionEntitlement({
      liveCompositionV2: composed,
      req,
    });
  }
  if (canonicalSecurityServiceV2) {
    return resolveAsyncPrivateSubscriptionEntitlement({
      canonicalSecurityServiceV2,
      requestContext,
      requestedAction,
    });
  }
  if (!privateRuntimeDecision
    && paidEntitlement) {
    const validation = validateSubscriptionV1Contract(paidEntitlement);
    const access = validation.valid
      ? entitlementAllowsCoaching(paidEntitlement, new Date(now).toISOString())
      : { allowed: false, code: 'ENTITLEMENT_CONTRACT_INVALID' };
    if (!access.allowed || !sameScope(paidEntitlement.scope, authenticatedMembershipScope)) {
      return { allowed: false, code: access.allowed ? 'ENTITLEMENT_MEMBERSHIP_SCOPE_DENIED' : access.code };
    }
    return {
      allowed: true,
      entitlement: {
        access_type: MONTHLY_INTELLIGENCE_ACCESS_TYPE,
        entitlement_id: paidEntitlement.entitlement_id,
        status: paidEntitlement.state === 'ACTIVE_CANCELING' ? 'active_canceling' : 'active',
        source: 'paid_stripe_membership_projection',
        temporary: false,
        billing_evidence: true,
        membership_scoped: true,
      },
    };
  }
  if (!privateRuntimeDecision
    && paidAccessGrant?.access_type === MONTHLY_INTELLIGENCE_ACCESS_TYPE
    && paidAccessGrant.status === 'active') {
    if (paidAccessGrant.membership_verified !== true
      || !sameScope(paidAccessGrant.scope, authenticatedMembershipScope)) {
      return { allowed: false, code: 'LEGACY_PAID_GRANT_RECONCILIATION_REQUIRED' };
    }
    return {
      allowed: true,
      entitlement: {
        access_type: MONTHLY_INTELLIGENCE_ACCESS_TYPE,
        status: 'active',
        source: 'paid_stripe',
        temporary: false,
        billing_evidence: true,
        membership_scoped: true,
      },
    };
  }
  const environment = developerAccessEnvironmentDecision(env, store, privateRuntimeDecision);
  if (!environment.ok) return { allowed: false, code: environment.code };
  const token = developerCapabilityFromCookie(req?.headers?.cookie);
  const verified = verifyDeveloperCapability({
    token,
    env,
    now,
    store,
    subject_binding,
    private_runtime_decision: privateRuntimeDecision,
  });
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
