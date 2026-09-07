/* global Buffer, process */
import Stripe from 'stripe';
import {
  STRIPE_INTERNAL_VERSION,
  accessGrantByAssessmentKey,
  accessGrantByEmailKey,
  accessGrantByMembershipKey,
  accessGrantByProfileKey,
  accessGrantBySessionKey,
  accessGrantBySubscriptionKey,
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
import {
  MONTHLY_PRODUCT_KEY,
  membershipBindingFromStripeMetadata,
  normalizedGrantStatusFromSubscription,
} from './subscriptionV1Foundation.js';
import {
  assertPersistedPurchaseIntentContract,
  createPublicSiteService,
} from '../../src/lib/publicSiteAirlockV1/service.js';
import { RedisPublicStore } from '../../src/lib/publicSiteAirlockV1/redisStore.js';
import { assertPublicStripeEventMode } from '../../src/lib/publicSiteAirlockV1/stripeCheckoutProvider.js';
import { PUBLIC_PRODUCT_CONTRACT_VERSION } from '../../src/lib/publicSiteAirlockV1/contracts.js';

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

export function compactEventObject(object = {}, eventType, existingSubscription = {}) {
  const metadata = metadataFrom(object);
  const inheritedMetadata = existingSubscription.membership_metadata || {};
  const mergedMetadata = { ...inheritedMetadata, ...metadata };
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
    profile_id: boundedText(mergedMetadata.profile_id || object.client_reference_id, 120),
    assessment_id: boundedText(mergedMetadata.assessment_id, 120),
    source_context: boundedText(mergedMetadata.source_context, 120),
    subject_id: boundedText(mergedMetadata.subject_id, 120),
    membership_id: boundedText(mergedMetadata.membership_id, 120),
    tenant_id: boundedText(mergedMetadata.tenant_id, 120),
    business_id: boundedText(mergedMetadata.business_id, 120),
    binding_source: boundedText(mergedMetadata.binding_source, 80),
    membership_verified: String(mergedMetadata.membership_verified) === 'true'
  };
}

export function subscriptionStateFrom(object = {}, eventId, existing = {}) {
  const metadata = metadataFrom(object);
  const mergedMetadata = { ...(existing.membership_metadata || {}), ...metadata };
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
    membership_metadata: {
      subject_id: boundedText(mergedMetadata.subject_id, 120),
      membership_id: boundedText(mergedMetadata.membership_id, 120),
      tenant_id: boundedText(mergedMetadata.tenant_id, 120),
      profile_id: boundedText(mergedMetadata.profile_id, 120),
      business_id: boundedText(mergedMetadata.business_id, 120),
      assessment_id: boundedText(mergedMetadata.assessment_id, 120),
      binding_source: boundedText(mergedMetadata.binding_source, 80),
      membership_verified: String(mergedMetadata.membership_verified) === 'true' ? 'true' : 'false'
    },
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
  const metadata = {
    subject_id: paymentEvent.subject_id,
    membership_id: paymentEvent.membership_id,
    tenant_id: paymentEvent.tenant_id,
    profile_id: paymentEvent.profile_id,
    business_id: paymentEvent.business_id,
    binding_source: paymentEvent.binding_source,
    membership_verified: paymentEvent.membership_verified ? 'true' : 'false',
  };
  const binding = membershipBindingFromStripeMetadata(metadata);
  const monthly = paymentEvent.product_key === MONTHLY_PRODUCT_KEY;
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
    subject_id: binding?.subject_id || '',
    membership_id: binding?.membership_id || '',
    tenant_id: binding?.scope.tenant_id || '',
    business_id: binding?.scope.business_id || '',
    scope: binding?.scope || null,
    binding_source: binding?.binding_source || 'UNVERIFIED_LEGACY',
    membership_verified: binding?.membership_verified === true,
    status: monthly && !binding ? 'reconciliation_required' : 'active',
    created_at: existing?.created_at || now,
    updated_at: now,
    internal_version: STRIPE_INTERNAL_VERSION
  };

  await redis.set(accessGrantKey(grantId), JSON.stringify(grant));
  if (grant.email) await redis.sadd(accessGrantByEmailKey(grant.email), grantId);
  if (grant.profile_id) await redis.sadd(accessGrantByProfileKey(grant.profile_id), grantId);
  if (grant.assessment_id) await redis.sadd(accessGrantByAssessmentKey(grant.assessment_id), grantId);
  if (grant.checkout_session_id) await redis.sadd(accessGrantBySessionKey(grant.checkout_session_id), grantId);
  if (grant.membership_id) await redis.sadd(accessGrantByMembershipKey(grant.membership_id), grantId);
  if (grant.subscription_id) await redis.sadd(accessGrantBySubscriptionKey(grant.subscription_id), grantId);

  return grant;
}

async function saveSubscriptionState(redis, event, object, existing = {}) {
  const state = subscriptionStateFrom(object, event.id, existing);
  if (!state.subscription_id) return null;
  await redis.set(subscriptionStateKey(state.subscription_id), JSON.stringify(state));
  return state;
}

async function synchronizeSubscriptionGrants(redis, state) {
  if (!state?.subscription_id) return;
  const grantIds = await redis.smembers(accessGrantBySubscriptionKey(state.subscription_id));
  const status = normalizedGrantStatusFromSubscription(state);
  for (const grantId of grantIds || []) {
    const grant = await readJson(redis, accessGrantKey(grantId));
    if (!grant || grant.product_key !== MONTHLY_PRODUCT_KEY) continue;
    const next = {
      ...grant,
      status: grant.membership_verified === true ? status : 'reconciliation_required',
      updated_at: new Date().toISOString(),
      source_subscription_event_id: state.stripe_event_id,
    };
    await redis.set(accessGrantKey(grantId), JSON.stringify(next));
  }
}

export async function assertGovernedPublicCheckoutBinding(redis, event, object, intentId, env = process.env) {
  const stripeMode = assertPublicStripeEventMode(event, env);
  const intent = await readJson(redis, `public_product_v1:purchase_intent:${intentId}`);
  if (!intent) throw new Error('purchase_intent_not_found');
  const { product } = assertPersistedPurchaseIntentContract(intent, {
    intentId,
    sessionId: boundedText(object?.id, 160),
  });
  const metadata = object?.metadata || {};
  const expectedMode = product.cadence === 'monthly' ? 'subscription' : 'payment';
  const expectedSessionPrefix = stripeMode === 'test' ? 'cs_test_' : 'cs_live_';
  const expectedProfileId = boundedText(intent.profile_id, 120);
  const expectedVerticalDigest = boundedText(intent.vertical_binding?.binding_sha256, 160);
  const exact = event.type === 'checkout.session.completed'
    && object?.livemode === (stripeMode === 'live')
    && String(object?.id || '').startsWith(expectedSessionPrefix)
    && object?.payment_status === 'paid'
    && object?.mode === expectedMode
    && object?.amount_total === intent.expected_price_minor
    && String(object?.currency || '').toLowerCase() === String(intent.currency || '').toLowerCase()
    && boundedText(metadata.purchase_intent_id, 160) === intent.intent_id
    && boundedText(metadata.product_key, 80) === intent.product_key
    && boundedText(metadata.access_type, 80) === intent.access_type
    && boundedText(metadata.profile_id, 120) === expectedProfileId
    && boundedText(metadata.vertical_binding_sha256, 160) === expectedVerticalDigest
    && boundedText(metadata.internal_version, 80) === PUBLIC_PRODUCT_CONTRACT_VERSION
    && boundedText(object.client_reference_id, 160) === (expectedProfileId || intent.intent_id);
  if (!exact) throw new Error('stripe_public_checkout_binding_mismatch');
  if (intent.product_key === 'business_assessment' && (!expectedProfileId || !expectedVerticalDigest)) {
    throw new Error('stripe_public_checkout_binding_mismatch');
  }
  if (intent.product_key !== 'business_assessment' && expectedVerticalDigest) {
    throw new Error('stripe_public_checkout_binding_mismatch');
  }
  return intent;
}

export async function processEvent(redis, event, env = process.env) {
  if (String(env.PUBLIC_STRIPE_MODE || '').trim()) {
    assertPublicStripeEventMode(event, env);
  }
  const publicObject = event.data?.object || {};
  const publicIntentId = boundedText(publicObject.metadata?.purchase_intent_id, 160);
  if (event.type === 'checkout.session.completed' && publicIntentId) {
    await assertGovernedPublicCheckoutBinding(redis, event, publicObject, publicIntentId, env);
    const publicStore = new RedisPublicStore(redis);
    const publicService = createPublicSiteService({
      store: publicStore,
      startSigningKey: env.MOREMINDMAP_SERVER_ONLY_PRODUCT_START_SIGNING_KEY,
      complimentaryPepper: env.MOREMINDMAP_SERVER_ONLY_COMPLIMENTARY_PEPPER,
      complimentaryManifest: env.MOREMINDMAP_SERVER_ONLY_COMPLIMENTARY_MANIFEST || '[]',
    });
    await publicService.recordPaymentGrant({
      event_id: event.id,
      checkout_session_id: publicObject.id,
      intent_id: publicIntentId,
      payment_truth: 'provider_confirmed',
      customer_email: publicObject.customer_details?.email || publicObject.customer_email,
    });
  }

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
      // Governed public sessions already wrote their deterministic grant above.
      // Replaying the legacy projection here would drop the Cassette vertical
      // binding and purchase-intent provenance from the same grant key.
      if (!publicIntentId) await saveAccessGrant(redis, event, object, paymentEvent);
      if (object.mode === 'subscription') {
        const state = await saveSubscriptionState(redis, event, object, {
          ...existingSubscription,
          subscription_id: paymentEvent.subscription_id,
          customer_id: paymentEvent.customer_id,
          customer_email: paymentEvent.customer_email,
          product_key: paymentEvent.product_key,
          access_type: paymentEvent.access_type,
          status: 'active'
        });
        await synchronizeSubscriptionGrants(redis, state);
      }
    }
  }

  if (event.type === 'invoice.paid' && paymentEvent.subscription_id) {
    const state = await saveSubscriptionState(redis, event, object, {
      ...existingSubscription,
      subscription_id: paymentEvent.subscription_id,
      customer_id: paymentEvent.customer_id,
      customer_email: paymentEvent.customer_email,
      status: 'active'
    });
    await synchronizeSubscriptionGrants(redis, state);
  }

  if (event.type.startsWith('customer.subscription.')) {
    const state = await saveSubscriptionState(redis, event, object, existingSubscription);
    await synchronizeSubscriptionGrants(redis, state);
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
    const result = await processEvent(redis, event, process.env);
    return res.status(200).json({ ok: true, processed: result.processed, idempotent: Boolean(result.idempotent) });
  } catch {
    return res.status(500).json({ ok: false, error: 'stripe_webhook_processing_failed' });
  } finally {
    if (redis) await redis.quit();
  }
}
