import Stripe from 'stripe';
import {
  STRIPE_INTERNAL_VERSION,
  accessGrantByAssessmentKey,
  accessGrantByEmailKey,
  accessGrantByProfileKey,
  accessGrantBySessionKey,
  accessGrantKey,
  boundedText,
  createRedisClient,
  monthKeyFromTimestamp,
  paymentEventKey,
  readJson,
  revenueIndexKey,
  sanitizeEmail,
  setJsonHeaders,
  subscriptionStateKey
} from './shared.js';

export const config = {
  api: {
    bodyParser: false
  }
};

const ALLOWED_EVENTS = new Set([
  'checkout.session.completed',
  'invoice.paid',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted'
]);

function getSignature(req) {
  return req.headers['stripe-signature'] || req.headers['Stripe-Signature'] || '';
}

async function readRawBody(req) {
  if (req.rawBody) return Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(String(req.rawBody));
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function metadataFrom(object = {}) {
  return object.metadata || {};
}

function subscriptionIdFrom(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return boundedText(value.id, 120);
}

function compactEventObject(object = {}, eventType, existingSubscription = {}) {
  const metadata = metadataFrom(object);
  const productKey = boundedText(metadata.product_key || existingSubscription.product_key, 80);
  const accessType = boundedText(metadata.access_type || existingSubscription.access_type || productKey, 80);
  const subscriptionId = subscriptionIdFrom(object.subscription || object.id);
  const customerId = boundedText(object.customer || existingSubscription.customer_id, 120);
  const customerEmail = sanitizeEmail(object.customer_email || object.customer_details?.email || existingSubscription.customer_email);

  return {
    product_key: productKey,
    access_type: accessType,
    mode: boundedText(object.mode || (subscriptionId ? 'subscription' : ''), 40),
    payment_status: boundedText(object.payment_status || object.status, 80),
    amount_total: typeof object.amount_total === 'number' ? object.amount_total : object.amount_paid,
    currency: boundedText(object.currency, 20),
    customer_id: customerId,
    customer_email: customerEmail,
    checkout_session_id: boundedText(eventType === 'checkout.session.completed' ? object.id : object.checkout_session, 120),
    subscription_id: subscriptionId,
    profile_id: boundedText(metadata.profile_id || object.client_reference_id, 120),
    assessment_id: boundedText(metadata.assessment_id, 120),
    source_context: boundedText(metadata.source_context, 120)
  };
}

function subscriptionStateFrom(object = {}, eventId, existing = {}) {
  const metadata = metadataFrom(object);
  const subscriptionId = subscriptionIdFrom(object.subscription || object.id || existing.subscription_id);
  return {
    subscription_id: subscriptionId,
    customer_id: boundedText(object.customer || existing.customer_id, 120),
    customer_email: sanitizeEmail(object.customer_email || object.customer_details?.email || existing.customer_email),
    product_key: boundedText(metadata.product_key || existing.product_key || 'more_monthly_intelligence', 80),
    access_type: boundedText(metadata.access_type || existing.access_type || 'more_monthly_intelligence', 80),
    status: boundedText(object.status || existing.status || 'active', 80),
    current_period_start: object.current_period_start || existing.current_period_start || null,
    current_period_end: object.current_period_end || existing.current_period_end || null,
    cancel_at_period_end: Boolean(object.cancel_at_period_end || existing.cancel_at_period_end),
    canceled_at: object.canceled_at || existing.canceled_at || null,
    latest_invoice: boundedText(object.latest_invoice || object.id || existing.latest_invoice, 120),
    stripe_event_id: eventId,
    updated_at: new Date().toISOString(),
    internal_version: STRIPE_INTERNAL_VERSION
  };
}

async function savePaymentEvent(redis, event, object, existingSubscription = {}) {
  const compact = compactEventObject(object, event.type, existingSubscription);
  const record = {
    event_id: `payment_event_${event.id}`,
    stripe_event_id: event.id,
    stripe_event_type: event.type,
    stripe_livemode: Boolean(event.livemode),
    stripe_created: event.created || null,
    created_at: new Date().toISOString(),
    ...compact,
    internal_version: STRIPE_INTERNAL_VERSION,
    raw_payload_stored: false
  };

  await redis.set(paymentEventKey(event.id), JSON.stringify(record));

  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'invoice.paid'
  ) {
    await redis.sadd(revenueIndexKey(monthKeyFromTimestamp(event.created)), event.id);
  }

  return record;
}

async function saveAccessGrant(redis, event, session, paymentEvent) {
  const grantId = `grant_${session.id}`;
  const now = new Date().toISOString();
  const existing = await readJson(redis, accessGrantKey(grantId));
  const grant = {
    grant_id: grantId,
    access_type: paymentEvent.access_type,
    product_key: paymentEvent.product_key,
    email: paymentEvent.customer_email,
    profile_id: paymentEvent.profile_id,
    assessment_id: paymentEvent.assessment_id,
    source: 'paid_stripe',
    stripe_event_id: event.id,
    checkout_session_id: paymentEvent.checkout_session_id,
    subscription_id: paymentEvent.subscription_id,
    customer_id: paymentEvent.customer_id,
    status: 'active',
    created_at: existing?.created_at || now,
    updated_at: now,
    internal_version: STRIPE_INTERNAL_VERSION
  };

  await redis.set(accessGrantKey(grantId), JSON.stringify(grant));
  if (grant.email) await redis.sadd(accessGrantByEmailKey(grant.email), grantId);
  if (grant.profile_id) await redis.sadd(accessGrantByProfileKey(grant.profile_id), grantId);
  if (grant.assessment_id) await redis.sadd(accessGrantByAssessmentKey(grant.assessment_id), grantId);
  if (grant.checkout_session_id) await redis.sadd(accessGrantBySessionKey(grant.checkout_session_id), grantId);

  return grant;
}

async function saveSubscriptionState(redis, event, object, existing = {}) {
  const state = subscriptionStateFrom(object, event.id, existing);
  if (!state.subscription_id) return null;
  await redis.set(subscriptionStateKey(state.subscription_id), JSON.stringify(state));
  return state;
}

async function processEvent(redis, event) {
  const existingEvent = await redis.get(paymentEventKey(event.id));
  if (existingEvent) {
    return { processed: true, idempotent: true };
  }

  if (!ALLOWED_EVENTS.has(event.type)) {
    return { processed: false, ignored: true };
  }

  const object = event.data?.object || {};
  const subscriptionId = subscriptionIdFrom(object.subscription || object.id);
  const existingSubscription = subscriptionId
    ? await readJson(redis, subscriptionStateKey(subscriptionId)) || {}
    : {};
  const paymentEvent = await savePaymentEvent(redis, event, object, existingSubscription);

  if (event.type === 'checkout.session.completed') {
    const paid = object.payment_status === 'paid';
    const subscriptionReady = object.mode === 'subscription' && Boolean(object.subscription || object.customer);
    if (paid || subscriptionReady) {
      await saveAccessGrant(redis, event, object, paymentEvent);
      if (object.mode === 'subscription') {
        await saveSubscriptionState(redis, event, object, {
          ...existingSubscription,
          subscription_id: paymentEvent.subscription_id,
          customer_id: paymentEvent.customer_id,
          customer_email: paymentEvent.customer_email,
          product_key: paymentEvent.product_key,
          access_type: paymentEvent.access_type,
          status: 'active'
        });
      }
    }
  }

  if (event.type === 'invoice.paid' && paymentEvent.subscription_id) {
    await saveSubscriptionState(redis, event, object, {
      ...existingSubscription,
      subscription_id: paymentEvent.subscription_id,
      customer_id: paymentEvent.customer_id,
      customer_email: paymentEvent.customer_email,
      status: 'active'
    });
  }

  if (event.type.startsWith('customer.subscription.')) {
    await saveSubscriptionState(redis, event, object, existingSubscription);
  }

  return { processed: true, idempotent: false };
}

export default async function handler(req, res) {
  setJsonHeaders(res, 'POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const signature = getSignature(req);
  if (!signature) {
    return res.status(400).json({ ok: false, error: 'stripe_webhook_signature_required' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(503).json({ ok: false, error: 'stripe_webhook_not_configured' });
  }

  let event;
  try {
    const rawBody = await readRawBody(req);
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return res.status(400).json({ ok: false, error: 'stripe_webhook_signature_invalid' });
  }

  let redis;
  try {
    redis = createRedisClient();
    const result = await processEvent(redis, event);
    return res.status(200).json({ ok: true, processed: result.processed, idempotent: Boolean(result.idempotent) });
  } catch {
    return res.status(500).json({ ok: false, error: 'stripe_webhook_processing_failed' });
  } finally {
    if (redis) await redis.quit();
  }
}
