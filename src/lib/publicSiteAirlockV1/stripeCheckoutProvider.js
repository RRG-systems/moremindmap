/* global process */
import Stripe from 'stripe';

const PRICE_ENV = Object.freeze({
  behavior_operating_system: 'STRIPE_PRICE_BEHAVIOR_OS',
  business_assessment: 'STRIPE_PRICE_BUSINESS_ASSESSMENT',
});

export function createStripeCheckoutProvider(env = process.env) {
  return {
    async create({ intent }) {
      const secret = env.STRIPE_SECRET_KEY;
      const price = env[PRICE_ENV[intent.product_key]];
      if (!secret || !price) throw new Error('checkout_provider_unavailable');
      const site = String(env.PUBLIC_SITE_URL || 'https://moremindmap.com').replace(/\/+$/u, '');
      const stripe = new Stripe(secret);
      const session = await stripe.checkout.sessions.create({
        mode: intent.cadence === 'monthly' ? 'subscription' : 'payment',
        line_items: [{ price, quantity: 1 }],
        ...(intent.email ? { customer_email: intent.email } : {}),
        client_reference_id: intent.profile_id || intent.intent_id,
        metadata: {
          product_key: intent.product_key,
          access_type: intent.access_type,
          purchase_intent_id: intent.intent_id,
          profile_id: intent.profile_id || '',
          vertical_binding_sha256: intent.vertical_binding?.binding_sha256 || '',
          internal_version: 'mmm-public-product-v1',
        },
        success_url: `${site}/payment-success?product=${encodeURIComponent(intent.product_key)}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${site}/payment-cancelled?product=${encodeURIComponent(intent.product_key)}`,
      }, { idempotencyKey: intent.intent_id });
      return { id: session.id, url: session.url };
    },
  };
}
