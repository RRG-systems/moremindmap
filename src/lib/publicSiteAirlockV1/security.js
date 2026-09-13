/* global Buffer, process */
import crypto from 'node:crypto';
import { boundedText, canonicalJson, sha256 } from './contracts.js';
import { resolvePublicSiteAllowedOrigins } from './publicSiteOrigin.js';
import { publicInquiryTransportConfigured } from './resendInquiryTransport.js';
import { resolveProfileOwnershipAudience } from './profileOwnership.js';
import { publicProfileOwnershipTransportConfigured } from './resendOwnershipTransport.js';

export function parseBoolean(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function nonproductionNamespace(value, domain) {
  const namespace = String(value || '').trim();
  return namespace.startsWith(`preview:${domain}:`) || namespace.startsWith(`nonprod:${domain}:`);
}

export function publicSubscriptionAccessConfigured(env = process.env) {
  return parseBoolean(env.PUBLIC_SUBSCRIPTION_RUNTIME_ENABLED)
    && parseBoolean(env.PUBLIC_PRODUCT_START_ENFORCEMENT_ENABLED)
    && String(env.MOREMINDMAP_SERVER_ONLY_PRODUCT_START_SIGNING_KEY || '').length >= 32
    && String(env.PUBLIC_SUBSCRIPTION_DESTINATION || '').trim() === '/subscription'
    && Boolean(String(env.REDIS_URL || '').trim());
}

function publicSubscriptionSaleInfrastructureConfigured(env) {
  return publicSubscriptionAccessConfigured(env)
    && /^whsec_[A-Za-z0-9_=-]{16,512}$/u.test(String(env.STRIPE_WEBHOOK_SECRET || '').trim())
    && profileOwnershipConfigured(env)
    && nonproductionNamespace(env.NEW_BA_DERIVED_NAMESPACE, 'new-ba')
    && nonproductionNamespace(env.NEW_BA_BOS_NAMESPACE, 'new-bos')
    && String(env.NEW_BA_PROVIDER_MODEL || '').trim() === 'gpt-5.6-sol';
}

export function runtimeFlags(env = process.env) {
  const productStartEnforcement = parseBoolean(env.PUBLIC_PRODUCT_START_ENFORCEMENT_ENABLED);
  const checkoutRequested = parseBoolean(env.PUBLIC_CHECKOUT_ENABLED);
  const subscriptionRequested = parseBoolean(env.PUBLIC_SUBSCRIPTION_CHECKOUT_ENABLED);
  const stripeMode = String(env.PUBLIC_STRIPE_MODE || '').trim().toLowerCase();
  const stripeSecret = String(env.STRIPE_SECRET_KEY || '').trim();
  const stripeModeMatches = stripeMode === 'test'
    ? /^(?:sk|rk)_test_/u.test(stripeSecret)
    : stripeMode === 'live' && /^(?:sk|rk)_live_/u.test(stripeSecret);
  const stripeReady = stripeModeMatches
    && /^price_[A-Za-z0-9_]{4,180}$/u.test(String(env.STRIPE_PRICE_BEHAVIOR_OS || '').trim())
    && /^price_[A-Za-z0-9_]{4,180}$/u.test(String(env.STRIPE_PRICE_BUSINESS_ASSESSMENT || '').trim());
  const monthlyStripeReady = stripeModeMatches
    && /^price_[A-Za-z0-9_]{4,180}$/u.test(String(env.STRIPE_PRICE_MORE_MONTHLY_INTELLIGENCE || '').trim());
  const startReady = String(env.MOREMINDMAP_SERVER_ONLY_PRODUCT_START_SIGNING_KEY || '').length >= 32;
  const inquiryReady = publicInquiryTransportConfigured(env)
    && String(env.MOREMINDMAP_SERVER_ONLY_INQUIRY_OUTBOX_DRAIN_SECRET || '').length >= 32;
  const complimentaryReady = startReady
    && String(env.MOREMINDMAP_SERVER_ONLY_COMPLIMENTARY_PEPPER || '').length >= 32
    && Boolean(String(env.MOREMINDMAP_SERVER_ONLY_COMPLIMENTARY_MANIFEST || '').trim());
  return Object.freeze({
    checkout_enabled: checkoutRequested && productStartEnforcement && startReady && stripeReady,
    complimentary_redemption_enabled: parseBoolean(env.PUBLIC_COMPLIMENTARY_REDEMPTION_ENABLED)
      && productStartEnforcement
      && complimentaryReady,
    inquiry_intake_enabled: parseBoolean(env.PUBLIC_INQUIRY_INTAKE_ENABLED) && inquiryReady,
    product_start_enforcement_enabled: productStartEnforcement,
    subscription_checkout_enabled: subscriptionRequested
      && checkoutRequested
      && productStartEnforcement
      && startReady
      && monthlyStripeReady
      && publicSubscriptionSaleInfrastructureConfigured(env),
    legacy_checkout_enabled: parseBoolean(env.PUBLIC_LEGACY_STRIPE_CHECKOUT_ENABLED),
  });
}

export function nonsecretRuntimeAttestation(env = process.env) {
  const flags = runtimeFlags(env);
  const allowedOrigins = allowedOriginsFromEnv(env);
  const payload = {
    version: 'mmm-public-runtime-config-v1',
    flags,
    allowed_origins: allowedOrigins,
    public_athlete_destination_state: boundedText(env.PUBLIC_ATHLETE_DESTINATION ? 'configured' : 'gated', 20),
    subscription_destination_state: boundedText(env.PUBLIC_SUBSCRIPTION_DESTINATION ? 'configured' : 'gated', 20),
    stripe_mode: ['test', 'live'].includes(String(env.PUBLIC_STRIPE_MODE || '').trim().toLowerCase())
      ? String(env.PUBLIC_STRIPE_MODE).trim().toLowerCase()
      : 'unconfigured',
    stripe_binding_state: env.STRIPE_SECRET_KEY ? 'configured' : 'unconfigured',
    profile_ownership_binding_state: profileOwnershipConfigured(env) ? 'configured' : 'unconfigured',
    inquiry_binding_state: env.MOREMINDMAP_SERVER_ONLY_INQUIRY_RESEND_API_KEY
      && env.PUBLIC_INQUIRY_EMAIL_FROM
      && env.PUBLIC_INQUIRY_EMAIL_TO
      && env.MOREMINDMAP_SERVER_ONLY_INQUIRY_OUTBOX_DRAIN_SECRET
      ? 'configured'
      : 'unconfigured',
  };
  return { ...payload, sha256: sha256(canonicalJson(payload)) };
}

function profileOwnershipConfigured(env) {
  if (String(env.MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_SIGNING_KEY || '').length < 32
    || !publicProfileOwnershipTransportConfigured(env)) return false;
  try {
    resolveProfileOwnershipAudience(env);
    return true;
  } catch {
    return false;
  }
}

export function allowedOriginsFromEnv(env = process.env) {
  return resolvePublicSiteAllowedOrigins(env);
}

export function applyExactOriginCors(req, res, { env = process.env, methods = 'GET,POST,OPTIONS', allowCredentials = false } = {}) {
  const origin = boundedText(req.headers?.origin, 320).replace(/\/+$/u, '');
  const allowed = allowedOriginsFromEnv(env);
  const sameOrigin = !origin;
  const accepted = sameOrigin || allowed.includes(origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key, X-MORE-Start-Token');
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (origin && accepted) res.setHeader('Access-Control-Allow-Origin', origin);
  if (allowCredentials && origin && accepted) res.setHeader('Access-Control-Allow-Credentials', 'true');
  return accepted;
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function signingInput(payload) {
  return base64url(canonicalJson(payload));
}

export const PUBLIC_START_TOKEN_TTL_MS = 15 * 60 * 1000;
export const PUBLIC_START_SESSION_TTL_MS = 4 * 60 * 60 * 1000;

export function sealStartToken(payload, secret, nowMs = Date.now(), ttlMs = PUBLIC_START_TOKEN_TTL_MS) {
  if (String(secret || '').length < 32) throw new Error('public_start_signing_key_unavailable');
  const boundedTtlMs = Math.min(Math.max(Number(ttlMs) || PUBLIC_START_TOKEN_TTL_MS, 60_000), PUBLIC_START_SESSION_TTL_MS);
  const claims = {
    version: 'mmm-public-start-token-v1',
    ...payload,
    issued_at_ms: nowMs,
    expires_at_ms: nowMs + boundedTtlMs,
  };
  const body = signingInput(claims);
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyStartToken(token, secret, nowMs = Date.now(), { allowExpired = false } = {}) {
  if (String(secret || '').length < 32) throw new Error('public_start_signing_key_unavailable');
  const [body, signature, extra] = String(token || '').split('.');
  if (!body || !signature || extra) throw new Error('public_start_token_invalid');
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) throw new Error('public_start_token_invalid');
  let claims;
  try {
    claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    throw new Error('public_start_token_invalid');
  }
  if (claims.version !== 'mmm-public-start-token-v1'
    || !Number.isSafeInteger(claims.issued_at_ms)
    || !Number.isSafeInteger(claims.expires_at_ms)
    || claims.expires_at_ms <= claims.issued_at_ms
    || (!allowExpired && claims.expires_at_ms <= nowMs)) {
    throw new Error('public_start_token_expired');
  }
  return claims;
}

export function complimentaryDigest(code, pepper) {
  if (String(pepper || '').length < 32) throw new Error('complimentary_pepper_unavailable');
  return crypto.createHmac('sha256', pepper).update(String(code || '').trim()).digest('hex');
}

export function timingSafeHeaderMatch(supplied, configured) {
  const expected = String(configured || '');
  const actual = String(supplied || '');
  if (expected.length < 32 || actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
