/* global Buffer, process */
import crypto from 'node:crypto';
import { boundedText, canonicalJson, sha256 } from './contracts.js';

export function parseBoolean(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

export function runtimeFlags(env = process.env) {
  return Object.freeze({
    checkout_enabled: parseBoolean(env.PUBLIC_CHECKOUT_ENABLED),
    complimentary_redemption_enabled: parseBoolean(env.PUBLIC_COMPLIMENTARY_REDEMPTION_ENABLED),
    inquiry_intake_enabled: parseBoolean(env.PUBLIC_INQUIRY_INTAKE_ENABLED),
    product_start_enforcement_enabled: parseBoolean(env.PUBLIC_PRODUCT_START_ENFORCEMENT_ENABLED),
    subscription_checkout_enabled: parseBoolean(env.PUBLIC_SUBSCRIPTION_CHECKOUT_ENABLED),
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
  };
  return { ...payload, sha256: sha256(canonicalJson(payload)) };
}

export function allowedOriginsFromEnv(env = process.env) {
  const configured = String(env.PUBLIC_ALLOWED_ORIGINS || env.PUBLIC_SITE_URL || env.SITE_URL || 'https://moremindmap.com')
    .split(',')
    .map((value) => value.trim().replace(/\/+$/u, ''))
    .filter((value) => /^https?:\/\/[^/]+$/u.test(value));
  return [...new Set(configured)];
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

export function sealStartToken(payload, secret, nowMs = Date.now()) {
  if (String(secret || '').length < 32) throw new Error('public_start_signing_key_unavailable');
  const claims = {
    version: 'mmm-public-start-token-v1',
    ...payload,
    issued_at_ms: nowMs,
    expires_at_ms: nowMs + 15 * 60 * 1000,
  };
  const body = signingInput(claims);
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyStartToken(token, secret, nowMs = Date.now()) {
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
  if (claims.version !== 'mmm-public-start-token-v1' || Number(claims.expires_at_ms) <= nowMs) {
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
