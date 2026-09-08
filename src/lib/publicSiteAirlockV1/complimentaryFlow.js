/* global Buffer */
import crypto from 'node:crypto';
import { boundedText, canonicalJson, productForKey } from './contracts.js';
import { complimentaryDigest } from './security.js';

export const COMPLIMENTARY_FLOW_COOKIE = '__Host-more_public_complimentary';
export const COMPLIMENTARY_FLOW_TTL_MS = 30 * 60 * 1000;

const VERSION = 'mmm-public-complimentary-flow-v1';
const PURPOSE = 'SERVER_RESUMED_COMPLIMENTARY_REDEMPTION';
const SIGNING_CONTEXT = 'mmm-public-complimentary-flow-v1-derived-key';
const SIGNATURE_CONTEXT = 'mmm-public-complimentary-flow-v1-receipt';

function requireSecret(value, code) {
  const secret = String(value || '');
  if (secret.length < 32) throw new Error(code);
  return secret;
}

function requireAudience(value) {
  const audience = boundedText(value, 500);
  if (!audience) throw new Error('complimentary_flow_configuration_unavailable');
  return audience;
}

function flowSigningKey(signingKey) {
  return crypto.createHmac('sha256', requireSecret(signingKey, 'complimentary_flow_configuration_unavailable'))
    .update(SIGNING_CONTEXT)
    .digest();
}

function signatureFor(body, signingKey, audience) {
  return crypto.createHmac('sha256', flowSigningKey(signingKey))
    .update(`${SIGNATURE_CONTEXT}\0${audience}\0${body}`)
    .digest('base64url');
}

function cookies(header = '') {
  return Object.fromEntries(String(header).split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    if (index < 0) return [part, ''];
    try { return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))]; }
    catch { return [part.slice(0, index), '']; }
  }));
}

function validClaims(claims, audience, nowMs) {
  const product = productForKey(claims?.product_key);
  return Boolean(claims
    && typeof claims === 'object'
    && !Array.isArray(claims)
    && claims.version === VERSION
    && claims.purpose === PURPOSE
    && claims.audience === audience
    && product?.product_key === 'business_assessment'
    && /^comp_flow_[a-f0-9]{32}$/u.test(String(claims.flow_id || ''))
    && /^[a-f0-9]{64}$/u.test(String(claims.capability_digest || ''))
    && boundedText(claims.idempotency_key, 160) === claims.idempotency_key
    && claims.idempotency_key.length >= 12
    && Number.isSafeInteger(claims.issued_at_ms)
    && Number.isSafeInteger(claims.expires_at_ms)
    && claims.issued_at_ms <= nowMs + 60_000
    && claims.expires_at_ms > nowMs
    && claims.expires_at_ms > claims.issued_at_ms
    && claims.expires_at_ms - claims.issued_at_ms <= COMPLIMENTARY_FLOW_TTL_MS);
}

export function createComplimentaryFlowReceipt({
  productKey,
  capability,
  idempotencyKey,
  signingKey,
  pepper,
  audience,
  nowMs = Date.now(),
  flowId = `comp_flow_${crypto.randomBytes(16).toString('hex')}`,
} = {}) {
  const product = productForKey(productKey);
  const code = boundedText(capability, 240);
  const idem = boundedText(idempotencyKey, 160);
  const boundAudience = requireAudience(audience);
  if (product?.product_key !== 'business_assessment' || !code || idem.length < 12) {
    throw new Error('complimentary_flow_invalid');
  }
  const claims = {
    version: VERSION,
    purpose: PURPOSE,
    audience: boundAudience,
    flow_id: flowId,
    product_key: product.product_key,
    capability_digest: complimentaryDigest(code, pepper),
    idempotency_key: idem,
    issued_at_ms: Number(nowMs),
    expires_at_ms: Number(nowMs) + COMPLIMENTARY_FLOW_TTL_MS,
  };
  if (!validClaims(claims, boundAudience, Number(nowMs))) throw new Error('complimentary_flow_invalid');
  const body = Buffer.from(canonicalJson(claims)).toString('base64url');
  return `${body}.${signatureFor(body, signingKey, boundAudience)}`;
}

export function verifyComplimentaryFlowReceipt(token, {
  signingKey,
  audience,
  nowMs = Date.now(),
} = {}) {
  const boundAudience = requireAudience(audience);
  const [body, supplied, extra] = String(token || '').split('.');
  if (!body || !supplied || extra) throw new Error('complimentary_flow_invalid');
  const expected = signatureFor(body, signingKey, boundAudience);
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    throw new Error('complimentary_flow_invalid');
  }
  let claims;
  try { claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); }
  catch { throw new Error('complimentary_flow_invalid'); }
  if (!validClaims(claims, boundAudience, Number(nowMs))) throw new Error('complimentary_flow_invalid');
  return Object.freeze(claims);
}

export function readComplimentaryFlowReceipt(cookieHeader, options = {}) {
  return verifyComplimentaryFlowReceipt(cookies(cookieHeader)[COMPLIMENTARY_FLOW_COOKIE], options);
}

export function complimentaryFlowCookie(token) {
  return `${COMPLIMENTARY_FLOW_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COMPLIMENTARY_FLOW_TTL_MS / 1000}`;
}

export function clearComplimentaryFlowCookie() {
  return `${COMPLIMENTARY_FLOW_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
