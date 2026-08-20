/* global process */
import { sameScope } from '../../src/lib/subscriptionV1/contracts.js';

export const MONTHLY_PRODUCT_KEY = 'more_monthly_intelligence';
export const SUBSCRIPTION_V1_FOUNDATION_FLAG = 'SUBSCRIPTION_V1_FOUNDATION_ENABLED';

const bounded = (value, max = 160) => String(value || '').trim().slice(0, max);

function contextScope(context) {
  return context?.scope || null;
}

export function subscriptionV1FoundationEnabled(env = process.env) {
  return String(env?.[SUBSCRIPTION_V1_FOUNDATION_FLAG] || '').toLowerCase() === 'true';
}

export function resolveMonthlyCheckoutBinding({ product_key, request_context, body = {}, enabled = false }) {
  if (product_key !== MONTHLY_PRODUCT_KEY) return { ok: true, code: 'LEGACY_ONE_TIME_PRODUCT_UNCHANGED', monthly: false };
  if (!enabled) return { ok: false, code: 'SUBSCRIPTION_V1_FOUNDATION_DEFAULT_OFF' };
  const scope = contextScope(request_context);
  if (request_context?.authenticated !== true || request_context?.membership_verified !== true || !scope
    || request_context.subject_id !== scope.subject_id || request_context.membership_id !== scope.membership_id) {
    return { ok: false, code: 'AUTHENTICATED_MEMBERSHIP_CONTEXT_REQUIRED' };
  }
  const clientIdentity = {
    email: bounded(body.email, 254),
    profile_id: bounded(body.profile_id),
    assessment_id: bounded(body.assessment_id),
  };
  if ((clientIdentity.profile_id && clientIdentity.profile_id.toLowerCase() !== scope.profile_id.toLowerCase())
    || (clientIdentity.email && request_context.email && clientIdentity.email.toLowerCase() !== String(request_context.email).toLowerCase())) {
    return { ok: false, code: 'CLIENT_SUPPLIED_IDENTITY_OVERRIDE_DENIED' };
  }
  return {
    ok: true,
    code: 'MONTHLY_CHECKOUT_SERVER_BOUND',
    monthly: true,
    email: bounded(request_context.email, 254),
    client_reference_id: scope.membership_id,
    metadata: {
      subject_id: scope.subject_id,
      membership_id: scope.membership_id,
      tenant_id: scope.tenant_id,
      profile_id: scope.profile_id,
      business_id: scope.business_id,
      assessment_id: bounded(request_context.assessment_id),
      binding_source: 'AUTHENTICATED_SERVER_CONTEXT',
      membership_verified: 'true',
      source_context: 'subscription_v1_authenticated_checkout',
    },
  };
}

export function resolveMonthlyAccessLookup({ product_key, request_context, enabled = false }) {
  if (product_key !== MONTHLY_PRODUCT_KEY) return { ok: true, code: 'LEGACY_ACCESS_LOOKUP', monthly: false };
  if (!enabled) return { ok: false, code: 'SUBSCRIPTION_V1_FOUNDATION_DEFAULT_OFF' };
  const scope = contextScope(request_context);
  if (request_context?.authenticated !== true || request_context?.membership_verified !== true || !scope
    || request_context.subject_id !== scope.subject_id || request_context.membership_id !== scope.membership_id) {
    return { ok: false, code: 'AUTHENTICATED_MEMBERSHIP_CONTEXT_REQUIRED' };
  }
  return { ok: true, code: 'MONTHLY_ACCESS_SERVER_BOUND', monthly: true, scope };
}

export function membershipBindingFromStripeMetadata(metadata = {}) {
  const scope = {
    subject_id: bounded(metadata.subject_id),
    membership_id: bounded(metadata.membership_id),
    tenant_id: bounded(metadata.tenant_id),
    profile_id: bounded(metadata.profile_id),
    business_id: bounded(metadata.business_id),
  };
  const complete = Object.values(scope).every(Boolean)
    && metadata.binding_source === 'AUTHENTICATED_SERVER_CONTEXT'
    && String(metadata.membership_verified) === 'true';
  return complete ? {
    subject_id: scope.subject_id,
    membership_id: scope.membership_id,
    scope,
    binding_source: 'AUTHENTICATED_SERVER_CONTEXT',
    membership_verified: true,
  } : null;
}

export function verifyGrantMembershipScope(grant, requestedScope) {
  const grantScope = grant?.scope;
  return Boolean(grant?.membership_verified === true
    && grant?.binding_source === 'AUTHENTICATED_SERVER_CONTEXT'
    && sameScope(grantScope, requestedScope));
}

export function normalizedGrantStatusFromSubscription(state = {}) {
  if (['active', 'trialing'].includes(state.status)) return state.cancel_at_period_end ? 'active_canceling' : 'active';
  if (['past_due', 'unpaid', 'paused'].includes(state.status)) return 'payment_suspended';
  if (['canceled', 'incomplete_expired', 'deleted'].includes(state.status)) return 'terminated';
  if (state.status === 'incomplete') return 'pending';
  return 'reconciliation_required';
}
