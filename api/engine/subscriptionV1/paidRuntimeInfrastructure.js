import { hashCanonicalJson } from '../../../src/lib/intelligenceFabric/hashing.js';
import { projectPaidEntitlement } from '../../../src/lib/subscriptionV1/entitlement.js';
import { sameScope, scopeFingerprint } from '../../../src/lib/subscriptionV1/contracts.js';
import {
  accessGrantByMembershipKey,
  accessGrantKey,
  readJson,
  subscriptionStateKey,
} from '../../stripe/shared.js';

export const PAID_RUNTIME_NAMESPACE = 'more:subscription-v1:paid-runtime:v1';

export function paidRuntimeKeys({ scope }) {
  const scopeHash = scopeFingerprint(scope);
  return Object.freeze({
    scope_hash: scopeHash,
    living_state: `${PAID_RUNTIME_NAMESPACE}:living:${scopeHash}`,
    living_backup: `${PAID_RUNTIME_NAMESPACE}:living-backup:${scopeHash}`,
    living_lock: `${PAID_RUNTIME_NAMESPACE}:living-lock:${scopeHash}`,
    allowance: `${PAID_RUNTIME_NAMESPACE}:allowance:${scopeHash}`,
    allowance_backup: `${PAID_RUNTIME_NAMESPACE}:allowance-backup:${scopeHash}`,
    allowance_lock: `${PAID_RUNTIME_NAMESPACE}:allowance-lock:${scopeHash}`,
    research: `${PAID_RUNTIME_NAMESPACE}:research:${scopeHash}`,
    diagnostics: `${PAID_RUNTIME_NAMESPACE}:diagnostics:${scopeHash}`,
    s2_relationship: `${PAID_RUNTIME_NAMESPACE}:relationship:${scopeHash}`,
    conversation_history: `${PAID_RUNTIME_NAMESPACE}:conversation:${scopeHash}`,
    conversation_backup: `${PAID_RUNTIME_NAMESPACE}:conversation-backup:${scopeHash}`,
    conversation_lock: `${PAID_RUNTIME_NAMESPACE}:conversation-lock:${scopeHash}`,
  });
}

function stripeTimestamp(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0
    ? new Date(numeric * 1000).toISOString()
    : null;
}

function membershipBinding(scope) {
  return {
    subject_id: scope.subject_id,
    membership_id: scope.membership_id,
    scope: { ...scope },
    binding_source: 'AUTHENTICATED_SERVER_CONTEXT',
    membership_verified: true,
  };
}

function exactStateScope(state, scope) {
  const metadata = state?.membership_metadata;
  return Boolean(metadata
    && metadata.subject_id === scope.subject_id
    && metadata.membership_id === scope.membership_id
    && metadata.tenant_id === scope.tenant_id
    && metadata.profile_id === scope.profile_id
    && metadata.business_id === scope.business_id
    && metadata.binding_source === 'AUTHENTICATED_SERVER_CONTEXT'
    && metadata.membership_verified === 'true');
}

function eventsFromStoredState(state, scope) {
  const shared = {
    signature_verified: true,
    membership_binding: membershipBinding(scope),
    customer_id: state.customer_id,
    subscription_id: state.subscription_id,
    status: state.status,
    payment_status: state.payment_status,
    cancel_at_period_end: state.cancel_at_period_end,
    current_period_start: state.current_period_start,
    current_period_end: state.current_period_end,
  };
  const events = [];
  if (state.lifecycle_stripe_event_id) {
    events.push({
      ...shared,
      event_id: state.lifecycle_stripe_event_id,
      event_type: state.lifecycle_stripe_event_type,
      created_at: stripeTimestamp(state.lifecycle_stripe_created),
    });
  }
  if (state.payment_stripe_event_id && state.payment_stripe_event_id !== state.lifecycle_stripe_event_id) {
    events.push({
      ...shared,
      event_id: state.payment_stripe_event_id,
      event_type: state.payment_stripe_event_type,
      payment_status: state.payment_status,
      created_at: stripeTimestamp(state.payment_stripe_created),
    });
  }
  if (!events.length && state.stripe_event_id) {
    events.push({
      ...shared,
      event_id: state.stripe_event_id,
      event_type: state.stripe_event_type,
      payment_status: state.payment_status,
      created_at: stripeTimestamp(state.stripe_created),
    });
  }
  return events;
}

export async function resolvePaidEntitlementFromStore({ redis, scope, now = new Date() }) {
  if (!redis?.get || !redis?.smembers) throw new Error('PAID_ENTITLEMENT_STORE_REQUIRED');
  const grantIds = await redis.smembers(accessGrantByMembershipKey(scope.membership_id));
  const grants = (await Promise.all((grantIds || []).map((grantId) => readJson(redis, accessGrantKey(grantId)))))
    .filter((grant) => grant
      && grant.product_key === 'more_monthly_intelligence'
      && grant.membership_verified === true
      && grant.binding_source === 'AUTHENTICATED_SERVER_CONTEXT'
      && sameScope(grant.scope, scope)
      && grant.subscription_id
      && grant.customer_id);
  const subscriptions = [...new Set(grants.map((grant) => grant.subscription_id))];
  if (subscriptions.length !== 1) throw new Error('PAID_ENTITLEMENT_RECONCILIATION_REQUIRED');
  const state = await readJson(redis, subscriptionStateKey(subscriptions[0]));
  if (!state
    || state.subscription_id !== subscriptions[0]
    || state.customer_id !== grants[0].customer_id
    || !exactStateScope(state, scope)
    || state.lifecycle_reconciliation_required === true
    || state.payment_reconciliation_required === true) {
    throw new Error('PAID_ENTITLEMENT_RECONCILIATION_REQUIRED');
  }
  const projected = projectPaidEntitlement({
    scope,
    stripe_events: eventsFromStoredState(state, scope),
    projected_at: new Date(now).toISOString(),
    policy_version: 'subscription_v1_stripe_stored_lifecycle_v1',
  });
  if (!projected.ok) throw new Error(projected.code || 'PAID_ENTITLEMENT_RECONCILIATION_REQUIRED');
  return projected.entitlement;
}

export function paidRuntimeRelationshipKey(scope) {
  return `paid_${hashCanonicalJson({ domain: 'paid-subscription-runtime-relationship-v1', scope }).slice(0, 32)}`;
}
