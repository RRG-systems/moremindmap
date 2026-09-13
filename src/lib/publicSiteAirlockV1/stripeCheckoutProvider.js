/* global process */
import Stripe from 'stripe';
import { resolvePublicSiteOrigin } from './publicSiteOrigin.js';

const PRICE_ENV = Object.freeze({
  behavior_operating_system: 'STRIPE_PRICE_BEHAVIOR_OS',
  business_assessment: 'STRIPE_PRICE_BUSINESS_ASSESSMENT',
  more_monthly_intelligence: 'STRIPE_PRICE_MORE_MONTHLY_INTELLIGENCE',
});

const SECRET_PREFIXES = Object.freeze({
  test: Object.freeze(['sk_test_', 'rk_test_']),
  live: Object.freeze(['sk_live_', 'rk_live_']),
});

function expectedCheckoutMode(intent) {
  return intent.cadence === 'monthly' ? 'subscription' : 'payment';
}

export function resolvePublicStripeMode(env = process.env) {
  const mode = String(env.PUBLIC_STRIPE_MODE || '').trim().toLowerCase();
  if (mode !== 'test' && mode !== 'live') throw new Error('stripe_mode_unavailable');
  return mode;
}

function requireSecretForMode(secret, mode) {
  const value = String(secret || '').trim();
  if (!SECRET_PREFIXES[mode].some((prefix) => value.startsWith(prefix))) {
    throw new Error('stripe_secret_mode_mismatch');
  }
  return value;
}

function requirePriceId(value) {
  const priceId = String(value || '').trim();
  if (!/^price_[A-Za-z0-9_]{4,180}$/u.test(priceId)) throw new Error('stripe_price_unavailable');
  return priceId;
}

function requireExpectedIntent(intent) {
  const amount = Number(intent?.expected_price_minor);
  const currency = String(intent?.currency || '').trim().toLowerCase();
  const cadence = String(intent?.cadence || '').trim().toLowerCase();
  if (!PRICE_ENV[intent?.product_key]
    || !Number.isSafeInteger(amount)
    || amount <= 0
    || !/^[a-z]{3}$/u.test(currency)
    || (cadence !== 'one_time' && cadence !== 'monthly')) {
    throw new Error('stripe_intent_contract_invalid');
  }
  return { amount, currency, cadence, checkoutMode: expectedCheckoutMode(intent) };
}

function requireMonthlyMembershipMetadata(intent) {
  if (intent?.cadence !== 'monthly') return null;
  const binding = intent?.membership_binding;
  const metadata = {
    subject_id: String(binding?.subject_id || '').trim(),
    membership_id: String(binding?.membership_id || '').trim(),
    tenant_id: String(binding?.tenant_id || '').trim(),
    profile_id: String(binding?.profile_id || '').trim(),
    business_id: String(binding?.business_id || '').trim(),
    assessment_id: String(binding?.assessment_id || '').trim(),
    binding_source: String(binding?.binding_source || '').trim(),
    membership_verified: binding?.membership_verified === true ? 'true' : 'false',
  };
  if (!metadata.subject_id
    || !metadata.membership_id
    || !metadata.tenant_id
    || !metadata.profile_id
    || !metadata.business_id
    || !metadata.assessment_id
    || metadata.binding_source !== 'AUTHENTICATED_SERVER_CONTEXT'
    || metadata.membership_verified !== 'true') {
    throw new Error('stripe_monthly_membership_binding_required');
  }
  return metadata;
}

export function assertStripePriceBinding(price, { priceId, mode, intent }) {
  const expected = requireExpectedIntent(intent);
  const expectedLiveMode = mode === 'live';
  if (!price
    || price.id !== priceId
    || price.active !== true
    || price.livemode !== expectedLiveMode
    || price.unit_amount !== expected.amount
    || String(price.currency || '').toLowerCase() !== expected.currency) {
    throw new Error('stripe_price_contract_mismatch');
  }
  const recurring = price.recurring || null;
  if (expected.cadence === 'one_time' && (price.type === 'recurring' || recurring)) {
    throw new Error('stripe_price_cadence_mismatch');
  }
  if (expected.cadence === 'monthly'
    && (price.type !== 'recurring' || recurring?.interval !== 'month' || Number(recurring?.interval_count || 1) !== 1)) {
    throw new Error('stripe_price_cadence_mismatch');
  }
  return expected;
}

export function assertStripeSessionBinding(session, { mode, checkoutMode }) {
  const expectedLiveMode = mode === 'live';
  const expectedIdPrefix = mode === 'test' ? 'cs_test_' : 'cs_live_';
  let checkoutUrl;
  try { checkoutUrl = new URL(String(session?.url || '')); } catch { throw new Error('stripe_session_contract_mismatch'); }
  if (!session
    || session.livemode !== expectedLiveMode
    || session.mode !== checkoutMode
    || !String(session.id || '').startsWith(expectedIdPrefix)
    || checkoutUrl.protocol !== 'https:'
    || checkoutUrl.username
    || checkoutUrl.password) {
    throw new Error('stripe_session_contract_mismatch');
  }
  return { id: session.id, url: checkoutUrl.href };
}

export function assertPublicStripeEventMode(event, env = process.env) {
  const mode = resolvePublicStripeMode(env);
  if (event?.livemode !== (mode === 'live')) throw new Error('stripe_event_mode_mismatch');
  return mode;
}

export function createStripeCheckoutProvider(env = process.env, options = {}) {
  const mode = resolvePublicStripeMode(env);
  const secret = requireSecretForMode(env.STRIPE_SECRET_KEY, mode);
  const stripeFactory = options.stripeFactory || ((apiKey) => new Stripe(apiKey));
  const stripe = options.stripeClient || stripeFactory(secret);
  if (!stripe?.prices?.retrieve || !stripe?.checkout?.sessions?.create) {
    throw new Error('stripe_client_unavailable');
  }
  return {
    async create({ intent }) {
      const expected = requireExpectedIntent(intent);
      const monthlyMembership = requireMonthlyMembershipMetadata(intent);
      const price = requirePriceId(env[PRICE_ENV[intent.product_key]]);
      const site = resolvePublicSiteOrigin(env);
      const priceObject = await stripe.prices.retrieve(price);
      assertStripePriceBinding(priceObject, { priceId: price, mode, intent });
      const metadata = {
        product_key: intent.product_key,
        access_type: intent.access_type,
        purchase_intent_id: intent.intent_id,
        profile_id: monthlyMembership?.profile_id || intent.profile_id || '',
        vertical_binding_sha256: intent.vertical_binding?.binding_sha256 || '',
        internal_version: 'mmm-public-product-v1',
        ...(monthlyMembership || {}),
      };
      const session = await stripe.checkout.sessions.create({
        mode: expected.checkoutMode,
        line_items: [{ price, quantity: 1 }],
        ...(intent.email ? { customer_email: intent.email } : {}),
        client_reference_id: monthlyMembership?.membership_id || intent.profile_id || intent.intent_id,
        metadata,
        ...(monthlyMembership ? { subscription_data: { metadata } } : {}),
        success_url: `${site}/payment-success?product=${encodeURIComponent(intent.product_key)}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${site}/payment-cancelled?product=${encodeURIComponent(intent.product_key)}`,
      }, { idempotencyKey: intent.intent_id });
      return assertStripeSessionBinding(session, { mode, checkoutMode: expected.checkoutMode });
    },
  };
}

export const PUBLIC_STRIPE_CHECKOUT_CONTRACT = Object.freeze({
  explicit_mode_required: true,
  supported_modes: Object.freeze(['test', 'live']),
  price_read_before_session_create: true,
  request_host_is_authority: false,
});
