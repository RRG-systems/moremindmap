/**
 * Canonical subscription conversion ingress for BA Visual surfaces.
 *
 * Product truth: MORE Monthly Intelligence is the existing Stripe subscription
 * product (key: more_monthly_intelligence). Checkout is created only through
 * POST /api/stripe/create-checkout-session via startStripeCheckout.
 *
 * This module does not create Stripe products, prices, customers, or sessions
 * by itself. It only documents and centralizes the product key + payload shape
 * so UI CTAs cannot invent a parallel checkout path.
 */

export const MORE_MONTHLY_INTELLIGENCE_PRODUCT_KEY = 'more_monthly_intelligence';

/** Existing API route used by startStripeCheckout (src/lib/stripeCheckout.js). */
export const STRIPE_CHECKOUT_SESSION_PATH = '/api/stripe/create-checkout-session';

/** Source context for the Business Engine Visual conversion panel CTA. */
export const SOURCE_CONTEXT_BA_VISUAL_MAP_ALIVE =
  'business_engine_visual_make_your_map_alive';

/**
 * Canonical CTA product key for "KEEP MY MAP ALIVE".
 * Fail-closed callers must not invent alternate product keys for this surface.
 */
export function getMapAliveSubscriptionProductKey() {
  return MORE_MONTHLY_INTELLIGENCE_PRODUCT_KEY;
}

/**
 * Build the payload for startStripeCheckout / create-checkout-session.
 * Requires profile_id. assessment_id is preferred metadata when available.
 *
 * @returns {{ ok: true, payload: object, error: null } | { ok: false, payload: null, error: string }}
 */
export function buildMonthlyIntelligenceCheckoutPayload({
  profileId = '',
  assessmentId = '',
  sourceContext = SOURCE_CONTEXT_BA_VISUAL_MAP_ALIVE,
} = {}) {
  const profile_id = typeof profileId === 'string' ? profileId.trim() : '';
  if (!profile_id) {
    return {
      ok: false,
      payload: null,
      error: 'profile_id_required_for_subscription_checkout',
    };
  }

  const assessment_id = typeof assessmentId === 'string' ? assessmentId.trim() : '';
  const source_context =
    typeof sourceContext === 'string' && sourceContext.trim()
      ? sourceContext.trim().slice(0, 120)
      : SOURCE_CONTEXT_BA_VISUAL_MAP_ALIVE;

  return {
    ok: true,
    payload: {
      product_key: MORE_MONTHLY_INTELLIGENCE_PRODUCT_KEY,
      profile_id,
      assessment_id,
      source_context,
    },
    error: null,
  };
}

/**
 * Human-readable CTA failure when checkout cannot start (fail closed — never "#").
 */
export const CTA_UNAVAILABLE_MESSAGE =
  'Subscription checkout is not available in this view yet. Production wiring is required.';

export const CTA_PROFILE_REQUIRED_MESSAGE =
  'A valid profile is required before subscription checkout can start.';

export const CTA_PAYMENT_SETUP_MESSAGE = 'Payment setup is not available yet.';
