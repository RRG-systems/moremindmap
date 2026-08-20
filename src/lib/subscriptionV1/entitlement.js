import { hashCanonicalJson } from '../intelligenceFabric/hashing.js';
import { deepFreeze } from '../intelligenceFabric/validation.js';
import { contractHeader, sameScope, validateSubscriptionV1Contract } from './contracts.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const iso = (value) => {
  if (typeof value === 'number') return new Date(value > 10_000_000_000 ? value : value * 1000).toISOString();
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

export function normalizeStripeSubscriptionState({ status, cancel_at_period_end = false, event_type = '' } = {}) {
  if (event_type === 'customer.subscription.deleted' || ['canceled', 'incomplete_expired'].includes(status)) return 'TERMINATED';
  if (['past_due', 'unpaid', 'paused'].includes(status)) return 'SUSPENDED_PAYMENT';
  if (['incomplete', 'trialing'].includes(status)) return status === 'trialing' ? 'ACTIVE' : 'PENDING';
  if (status === 'active') return cancel_at_period_end ? 'ACTIVE_CANCELING' : 'ACTIVE';
  return 'RECONCILIATION_REQUIRED';
}

export function verifyStripeMembershipBinding(event, scope) {
  const binding = event?.membership_binding;
  if (!binding || binding.binding_source !== 'AUTHENTICATED_SERVER_CONTEXT' || binding.membership_verified !== true) {
    return deepFreeze({ valid: false, code: 'STRIPE_EVENT_MEMBERSHIP_BINDING_REQUIRED' });
  }
  if (!sameScope(binding.scope, scope)) return deepFreeze({ valid: false, code: 'STRIPE_EVENT_SCOPE_MISMATCH' });
  if (binding.subject_id !== scope.subject_id || binding.membership_id !== scope.membership_id) return deepFreeze({ valid: false, code: 'STRIPE_EVENT_IDENTITY_MISMATCH' });
  return deepFreeze({ valid: true, code: 'STRIPE_EVENT_MEMBERSHIP_BOUND' });
}

export function projectPaidEntitlement({
  scope,
  stripe_events,
  projected_at,
  policy_version = 'subscription_v1_stripe_lifecycle_v1',
}) {
  if (!Array.isArray(stripe_events) || stripe_events.length === 0) return deepFreeze({ ok: false, code: 'STRIPE_LIFECYCLE_EVIDENCE_REQUIRED' });
  const ordered = [...stripe_events].sort((left, right) => {
    const timeDelta = Date.parse(iso(left.created_at) || 0) - Date.parse(iso(right.created_at) || 0);
    return timeDelta || String(left.event_id).localeCompare(String(right.event_id));
  });
  const ids = new Set();
  for (const event of ordered) {
    if (!event?.signature_verified || !event.event_id || ids.has(event.event_id)) return deepFreeze({ ok: false, code: 'STRIPE_EVENT_INTEGRITY_INVALID' });
    ids.add(event.event_id);
    const binding = verifyStripeMembershipBinding(event, scope);
    if (!binding.valid) return deepFreeze({ ok: false, code: binding.code });
  }
  const latest = ordered.at(-1);
  const subscriptionId = latest.subscription_id || [...ordered].reverse().find((event) => event.subscription_id)?.subscription_id;
  const customerId = latest.customer_id || [...ordered].reverse().find((event) => event.customer_id)?.customer_id;
  const billingStart = iso(latest.current_period_start || [...ordered].reverse().find((event) => event.current_period_start)?.current_period_start);
  const billingEnd = iso(latest.current_period_end || [...ordered].reverse().find((event) => event.current_period_end)?.current_period_end);
  if (!subscriptionId || !customerId || !billingStart || !billingEnd) {
    return deepFreeze({
      ok: false,
      code: 'ENTITLEMENT_RECONCILIATION_REQUIRED',
      missing: [
        !subscriptionId && 'stripe_subscription_id',
        !customerId && 'stripe_customer_id',
        !billingStart && 'billing_cycle_start',
        !billingEnd && 'billing_cycle_end',
      ].filter(Boolean),
      fabricated: false,
    });
  }
  const state = normalizeStripeSubscriptionState({
    status: latest.status,
    cancel_at_period_end: latest.cancel_at_period_end,
    event_type: latest.event_type,
  });
  const body = {
    ...contractHeader('paid_entitlement'),
    entitlement_id: `entitlement_${hashCanonicalJson({ scope, subscriptionId }).slice(0, 24)}`,
    scope: clone(scope),
    stripe_customer_hash: hashCanonicalJson({ domain: 'stripe-customer', id: customerId }),
    stripe_subscription_hash: hashCanonicalJson({ domain: 'stripe-subscription', id: subscriptionId }),
    state,
    billing_cycle_start: billingStart,
    billing_cycle_end: billingEnd,
    access_ends_at: ['TERMINATED', 'ACTIVE_CANCELING'].includes(state) ? billingEnd : null,
    source_event_ids: [...ids].sort(),
    projected_at: iso(projected_at),
    policy_version,
  };
  const validation = validateSubscriptionV1Contract(body);
  if (!validation.valid) return deepFreeze({ ok: false, code: 'PAID_ENTITLEMENT_CONTRACT_INVALID', errors: validation.errors });
  return deepFreeze({ ok: true, code: 'PAID_ENTITLEMENT_PROJECTED', entitlement: body });
}

export function entitlementAllowsCoaching(entitlement, as_of_at) {
  const validation = validateSubscriptionV1Contract(entitlement);
  if (!validation.valid) return deepFreeze({ allowed: false, code: 'ENTITLEMENT_CONTRACT_INVALID' });
  if (!['ACTIVE', 'ACTIVE_CANCELING'].includes(entitlement.state)) return deepFreeze({ allowed: false, code: `ENTITLEMENT_${entitlement.state}` });
  if (entitlement.state === 'ACTIVE_CANCELING' && Date.parse(as_of_at) >= Date.parse(entitlement.access_ends_at || entitlement.billing_cycle_end)) return deepFreeze({ allowed: false, code: 'ENTITLEMENT_TERMINATED' });
  return deepFreeze({ allowed: true, code: 'ENTITLEMENT_ACTIVE', entitlement_id: entitlement.entitlement_id });
}

export function reconcileLegacyAccessGrant({ grant, verified_membership = null, verified_subscription_state = null }) {
  if (!grant) return deepFreeze({ ok: false, code: 'LEGACY_GRANT_NOT_FOUND', fabricated: false });
  const exactBinding = verified_membership && grant.profile_id
    && String(grant.profile_id).toLowerCase() === String(verified_membership.profile_id).toLowerCase()
    && verified_subscription_state?.subscription_id
    && grant.subscription_id === verified_subscription_state.subscription_id;
  if (!exactBinding) return deepFreeze({ ok: false, code: 'LEGACY_GRANT_RECONCILIATION_REQUIRED', fabricated: false });
  return deepFreeze({
    ok: true,
    code: 'LEGACY_GRANT_EXPLICIT_RECONCILIATION_READY',
    fabricated: false,
    source_refs: [grant.grant_id, verified_subscription_state.subscription_id],
    scope: clone(verified_membership),
  });
}
