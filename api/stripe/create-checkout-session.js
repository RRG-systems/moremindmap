import Stripe from 'stripe';

const DEFAULT_SITE_URL = 'https://moremindmap.com';
const SOURCE_CONTEXT_LIMIT = 120;
const ID_LIMIT = 120;
const EMAIL_LIMIT = 254;

const PRODUCTS = {
  behavior_operating_system: {
    env: 'STRIPE_PRICE_BEHAVIOR_OS',
    mode: 'payment',
    access_type: 'behavior_operating_system',
    success_path: '/payment-success?product=behavior_operating_system&session_id={CHECKOUT_SESSION_ID}',
    cancel_path: '/payment-cancelled?product=behavior_operating_system'
  },
  business_assessment: {
    env: 'STRIPE_PRICE_BUSINESS_ASSESSMENT',
    mode: 'payment',
    access_type: 'business_assessment',
    success_path: '/payment-success?product=business_assessment&session_id={CHECKOUT_SESSION_ID}',
    cancel_path: '/payment-cancelled?product=business_assessment'
  },
  more_monthly_intelligence: {
    env: 'STRIPE_PRICE_MORE_MONTHLY_INTELLIGENCE',
    mode: 'subscription',
    access_type: 'more_monthly_intelligence',
    success_path: '/payment-success?product=more_monthly_intelligence&session_id={CHECKOUT_SESSION_ID}',
    cancel_path: '/payment-cancelled?product=more_monthly_intelligence'
  }
};

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function boundedText(value, max) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.slice(0, max);
}

function sanitizeEmail(value) {
  const email = boundedText(value, EMAIL_LIMIT);
  if (!email || !email.includes('@')) return '';
  return email;
}

function safePath(value, fallback) {
  const path = boundedText(value, 320);
  if (!path) return fallback;
  if (!path.startsWith('/') || path.startsWith('//')) return fallback;
  return path;
}

function siteUrl() {
  const configured = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || DEFAULT_SITE_URL;
  return String(configured || DEFAULT_SITE_URL).replace(/\/+$/, '');
}

function absoluteUrl(path) {
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

export default async function handler(req, res) {
  setJsonHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const body = parseBody(req);
  const productKey = boundedText(body.product_key, 80);
  const product = PRODUCTS[productKey];

  if (!product) {
    return res.status(400).json({ ok: false, error: 'invalid_stripe_product_key' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return res.status(503).json({ ok: false, error: 'stripe_configuration_unavailable' });
  }

  const priceId = process.env[product.env];
  if (!priceId) {
    return res.status(503).json({ ok: false, error: 'stripe_price_configuration_unavailable' });
  }

  const email = sanitizeEmail(body.email);
  const profileId = boundedText(body.profile_id, ID_LIMIT);
  const assessmentId = boundedText(body.assessment_id, ID_LIMIT);
  const sourceContext = boundedText(body.source_context, SOURCE_CONTEXT_LIMIT);
  const successPath = safePath(body.success_path, product.success_path);
  const cancelPath = safePath(body.cancel_path, product.cancel_path);
  const clientReferenceId = profileId || assessmentId || undefined;

  try {
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: product.mode,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      ...(email ? { customer_email: email } : {}),
      ...(clientReferenceId ? { client_reference_id: clientReferenceId } : {}),
      metadata: {
        product_key: productKey,
        access_type: product.access_type,
        source_context: sourceContext,
        profile_id: profileId,
        assessment_id: assessmentId,
        internal_version: 'stripe_v1'
      },
      success_url: absoluteUrl(successPath),
      cancel_url: absoluteUrl(cancelPath)
    });

    return res.status(200).json({
      ok: true,
      checkout_url: session.url,
      session_id: session.id,
      product_key: productKey,
      mode: product.mode
    });
  } catch {
    return res.status(502).json({ ok: false, error: 'stripe_checkout_session_failed' });
  }
}
