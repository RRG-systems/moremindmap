import assert from 'node:assert/strict';
import test from 'node:test';

import { processEvent, subscriptionStateFrom } from '../api/stripe/webhook.js';
import { accessGrantKey, subscriptionStateKey } from '../api/stripe/shared.js';
import { MemoryPublicStore } from '../src/lib/publicSiteAirlockV1/memoryStore.js';

const SUBSCRIPTION_ID = 'sub_lifecycle_repair';
const SESSION_ID = 'cs_test_lifecycle_repair';
const GRANT_ID = `grant_${SESSION_ID}`;
const METADATA = Object.freeze({
  product_key: 'more_monthly_intelligence',
  access_type: 'more_monthly_intelligence',
  subject_id: 'subject_lifecycle_repair',
  membership_id: 'membership_lifecycle_repair',
  tenant_id: 'tenant_lifecycle_repair',
  profile_id: 'mm-20990101-lifecycle',
  business_id: 'business_lifecycle_repair',
  binding_source: 'AUTHENTICATED_SERVER_CONTEXT',
  membership_verified: 'true',
});

function checkoutEvent() {
  return {
    id: 'evt_checkout_lifecycle_repair',
    type: 'checkout.session.completed',
    created: 100,
    livemode: false,
    data: {
      object: {
        id: SESSION_ID,
        mode: 'subscription',
        payment_status: 'paid',
        customer: 'cus_lifecycle_repair',
        subscription: SUBSCRIPTION_ID,
        metadata: METADATA,
      },
    },
  };
}

function subscriptionEvent({ id, created, status, cancelAtPeriodEnd = false }) {
  return {
    id,
    type: status === 'canceled'
      ? 'customer.subscription.deleted'
      : 'customer.subscription.updated',
    created,
    livemode: false,
    data: {
      object: {
        id: SUBSCRIPTION_ID,
        customer: 'cus_lifecycle_repair',
        status,
        current_period_start: 10,
        current_period_end: 20,
        cancel_at_period_end: cancelAtPeriodEnd,
        metadata: METADATA,
      },
    },
  };
}

function invoiceEvent({ id, created, type }) {
  return {
    id,
    type,
    created,
    livemode: false,
    data: {
      object: {
        id: `in_${id}`,
        subscription: SUBSCRIPTION_ID,
        customer: 'cus_lifecycle_repair',
        status: type === 'invoice.paid' ? 'paid' : 'open',
        metadata: METADATA,
      },
    },
  };
}

async function readState(store) {
  return JSON.parse(await store.get(subscriptionStateKey(SUBSCRIPTION_ID)));
}

async function readGrant(store) {
  return JSON.parse(await store.get(accessGrantKey(GRANT_ID)));
}

async function seededStore(Store = MemoryPublicStore) {
  const store = new Store();
  await processEvent(store, checkoutEvent());
  return store;
}

test('invoice truth stays separate from subscription lifecycle and explicit cancellation false is preserved', async () => {
  const projectedInvoice = subscriptionStateFrom(
    { id: 'in_direct', subscription: SUBSCRIPTION_ID, status: 'paid' },
    'evt_invoice_direct',
    { subscription_id: SUBSCRIPTION_ID, status: 'active', cancel_at_period_end: true },
    { type: 'invoice.paid', created: 101 },
  );
  assert.equal(projectedInvoice.status, 'active');
  assert.equal(projectedInvoice.payment_status, 'paid');
  assert.equal(projectedInvoice.cancel_at_period_end, true);

  const projectedRemoval = subscriptionStateFrom(
    { id: SUBSCRIPTION_ID, status: 'active', cancel_at_period_end: false },
    'evt_cancel_removed_direct',
    { subscription_id: SUBSCRIPTION_ID, status: 'active', cancel_at_period_end: true },
    { type: 'customer.subscription.updated', created: 102 },
  );
  assert.equal(projectedRemoval.cancel_at_period_end, false);

  const store = await seededStore();
  await processEvent(store, subscriptionEvent({
    id: 'evt_cancel_scheduled',
    created: 110,
    status: 'active',
    cancelAtPeriodEnd: true,
  }));
  assert.equal((await readGrant(store)).status, 'active_canceling');

  await processEvent(store, subscriptionEvent({
    id: 'evt_cancel_removed',
    created: 120,
    status: 'active',
    cancelAtPeriodEnd: false,
  }));
  assert.equal((await readState(store)).cancel_at_period_end, false);

  await processEvent(store, invoiceEvent({
    id: 'evt_renewal_paid',
    created: 130,
    type: 'invoice.paid',
  }));
  assert.equal((await readState(store)).status, 'active');
  assert.equal((await readState(store)).payment_status, 'paid');
  assert.equal((await readGrant(store)).status, 'active');
});

test('invoice payment failure suspends access and a later paid invoice restores it without changing lifecycle status', async () => {
  const store = await seededStore();
  await processEvent(store, subscriptionEvent({
    id: 'evt_active_before_failure',
    created: 110,
    status: 'active',
  }));
  await processEvent(store, invoiceEvent({
    id: 'evt_invoice_failed',
    created: 120,
    type: 'invoice.payment_failed',
  }));
  assert.equal((await readState(store)).status, 'active');
  assert.equal((await readState(store)).payment_status, 'failed');
  assert.equal((await readGrant(store)).status, 'payment_suspended');

  await processEvent(store, invoiceEvent({
    id: 'evt_invoice_recovered',
    created: 130,
    type: 'invoice.paid',
  }));
  assert.equal((await readState(store)).status, 'active');
  assert.equal((await readState(store)).payment_status, 'paid');
  assert.equal((await readGrant(store)).status, 'active');
});

test('older lifecycle events cannot overwrite newer state and same-timestamp conflicts fail closed in either order', async () => {
  const store = await seededStore();
  await processEvent(store, subscriptionEvent({
    id: 'evt_newer_canceled',
    created: 300,
    status: 'canceled',
  }));
  await processEvent(store, subscriptionEvent({
    id: 'evt_older_active',
    created: 200,
    status: 'active',
  }));
  assert.equal((await readState(store)).status, 'canceled');
  assert.equal((await readGrant(store)).status, 'terminated');

  async function conflictState(first, second) {
    const conflictStore = await seededStore();
    await processEvent(conflictStore, first);
    await processEvent(conflictStore, second);
    return {
      state: await readState(conflictStore),
      grant: await readGrant(conflictStore),
    };
  }
  const active = subscriptionEvent({
    id: 'evt_same_second_active',
    created: 400,
    status: 'active',
  });
  const canceled = subscriptionEvent({
    id: 'evt_same_second_canceled',
    created: 400,
    status: 'canceled',
  });
  const forward = await conflictState(active, canceled);
  const reverse = await conflictState(canceled, active);
  for (const result of [forward, reverse]) {
    assert.equal(result.state.status, 'reconciliation_required');
    assert.equal(result.state.lifecycle_reconciliation_required, true);
    assert.deepEqual(result.state.lifecycle_conflicting_event_ids, [
      'evt_same_second_active',
      'evt_same_second_canceled',
    ]);
    assert.equal(result.grant.status, 'reconciliation_required');
  }
});

test('an event already recorded before a later write failure resumes to completion exactly once', async () => {
  class FailSubscriptionStateOnceStore extends MemoryPublicStore {
    constructor() {
      super();
      this.failureArmed = false;
      this.failed = false;
    }

    async set(key, value) {
      if (this.failureArmed && !this.failed && key === subscriptionStateKey(SUBSCRIPTION_ID)) {
        this.failed = true;
        throw new Error('synthetic_subscription_state_failure');
      }
      return super.set(key, value);
    }
  }

  const store = await seededStore(FailSubscriptionStateOnceStore);
  store.failureArmed = true;
  const event = subscriptionEvent({
    id: 'evt_retry_after_payment_event',
    created: 200,
    status: 'past_due',
  });

  await assert.rejects(() => processEvent(store, event), /synthetic_subscription_state_failure/u);
  assert.ok(await store.get(`payment_event:${event.id}`));
  assert.equal(
    JSON.parse(await store.get(`stripe_webhook_completion:${event.id}`)).phase,
    'processing',
  );

  const resumed = await processEvent(store, structuredClone(event));
  assert.deepEqual(resumed, { processed: true, idempotent: false });
  assert.equal((await readState(store)).status, 'past_due');
  assert.equal((await readGrant(store)).status, 'payment_suspended');
  assert.equal(
    JSON.parse(await store.get(`stripe_webhook_completion:${event.id}`)).phase,
    'complete',
  );

  assert.deepEqual(
    await processEvent(store, structuredClone(event)),
    { processed: true, idempotent: true },
  );
});

test('concurrent lifecycle and payment events serialize without losing either subscription update', { timeout: 2000 }, async () => {
  class ConcurrentSubscriptionMutationStore extends MemoryPublicStore {
    constructor() {
      super();
      this.armed = false;
      this.lifecycleWriteDelayed = false;
      this.lockAttempts = 0;
      this.lifecycleWriteStarted = new Promise((resolve) => { this.resolveLifecycleWriteStarted = resolve; });
      this.contenderAttempted = new Promise((resolve) => { this.resolveContenderAttempted = resolve; });
      this.lifecycleWriteReleased = new Promise((resolve) => { this.resolveLifecycleWriteReleased = resolve; });
    }

    async setNx(key, value, ttlSeconds) {
      const acquired = await super.setNx(key, value, ttlSeconds);
      if (this.armed && key === `stripe_subscription_mutation_lock:${SUBSCRIPTION_ID}`) {
        this.lockAttempts += 1;
        if (this.lockAttempts >= 2) this.resolveContenderAttempted();
      }
      return acquired;
    }

    async set(key, value) {
      if (
        this.armed
        && !this.lifecycleWriteDelayed
        && key === subscriptionStateKey(SUBSCRIPTION_ID)
      ) {
        const state = JSON.parse(value);
        if (state.lifecycle_stripe_event_id === 'evt_concurrent_lifecycle') {
          this.lifecycleWriteDelayed = true;
          this.resolveLifecycleWriteStarted();
          await this.lifecycleWriteReleased;
        }
      }
      return super.set(key, value);
    }
  }

  const store = await seededStore(ConcurrentSubscriptionMutationStore);
  store.armed = true;
  const lifecyclePromise = processEvent(store, subscriptionEvent({
    id: 'evt_concurrent_lifecycle',
    created: 200,
    status: 'active',
  }));
  await store.lifecycleWriteStarted;

  const paymentPromise = processEvent(store, invoiceEvent({
    id: 'evt_concurrent_payment_failure',
    created: 210,
    type: 'invoice.payment_failed',
  }));
  await store.contenderAttempted;
  store.resolveLifecycleWriteReleased();

  const concurrentResults = await Promise.all([lifecyclePromise, paymentPromise]);
  assert.deepEqual(concurrentResults, [
    { processed: true, idempotent: false },
    { processed: true, idempotent: false },
  ]);
  const state = await readState(store);
  assert.equal(state.status, 'active');
  assert.equal(state.payment_status, 'failed');
  assert.equal(state.lifecycle_stripe_event_id, 'evt_concurrent_lifecycle');
  assert.equal(state.payment_stripe_event_id, 'evt_concurrent_payment_failure');
  assert.equal((await readGrant(store)).status, 'payment_suspended');
  assert.equal(
    await store.get(`stripe_subscription_mutation_lock:${SUBSCRIPTION_ID}`),
    null,
  );
});
