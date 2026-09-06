/* global process */
import { publicCatalogProjection } from './contracts.js';
import { applyExactOriginCors, runtimeFlags } from './security.js';

function jsonBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch { return {}; }
}

function safeError(error) {
  const code = String(error?.message || 'request_unavailable').split(':')[0];
  const allowed = new Set([
    'active_grant_required', 'completed_bos_required', 'complimentary_capability_exhausted',
    'complimentary_capability_expired', 'complimentary_capability_invalid', 'complimentary_product_not_available',
    'grant_profile_binding_mismatch', 'grant_vertical_binding_required', 'idempotency_key_required',
    'inquiry_rejected', 'operation_in_progress', 'product_destination_gated', 'product_not_found',
    'rate_limited',
    'profile_id_required', 'provider_payment_confirmation_required', 'purchase_intent_not_found',
    'subscription_checkout_gated', 'valid_email_required', 'valid_inquiry_fields_required',
  ]);
  return allowed.has(code) ? code : 'request_unavailable';
}

function statusFor(code) {
  if (code === 'operation_in_progress') return 409;
  if (code === 'rate_limited') return 429;
  if (code.endsWith('_gated')) return 409;
  if (code.includes('unavailable')) return 503;
  return 400;
}

function prepare(req, res, { env, methods }) {
  res.setHeader('Content-Type', 'application/json');
  if (!applyExactOriginCors(req, res, { env, methods })) {
    res.status(403).json({ ok: false, error: 'origin_not_allowed' });
    return false;
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return false;
  }
  return true;
}

function requestFingerprint(req) {
  return String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

export function createCatalogHandler({ env = process.env } = {}) {
  return async function catalog(req, res) {
    if (!prepare(req, res, { env, methods: 'GET,OPTIONS' })) return;
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    const flags = runtimeFlags(env);
    return res.status(200).json({ ok: true, ...publicCatalogProjection({ checkoutEnabled: flags.checkout_enabled, subscriptionEnabled: flags.subscription_checkout_enabled }) });
  };
}

export function createAccessHandler({ serviceFactory, env = process.env } = {}) {
  return async function access(req, res) {
    if (!prepare(req, res, { env, methods: 'POST,OPTIONS' })) return;
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    const body = jsonBody(req);
    let runtime;
    try {
      runtime = await serviceFactory();
      await runtime.service.enforceRateLimit({ scope: 'access', identity: requestFingerprint(req), limit: 30 });
      if (body.action === 'lookup') return res.status(200).json({ ok: true, ...(await runtime.service.lookupEntry(body)) });
      if (body.action === 'redeem') {
        if (!runtimeFlags(env).complimentary_redemption_enabled) return res.status(404).json({ ok: false, error: 'not_found' });
        return res.status(200).json({ ok: true, ...(await runtime.service.redeemComplimentary(body)) });
      }
      if (body.action === 'create_start_token') {
        return res.status(200).json({ ok: true, ...(await runtime.service.createStartTokenForGrant(body)) });
      }
      if (body.action === 'create_start_token_from_session') {
        return res.status(200).json({ ok: true, ...(await runtime.service.createStartTokenForSession(body)) });
      }
      return res.status(400).json({ ok: false, error: 'invalid_action' });
    } catch (error) {
      const code = safeError(error);
      return res.status(statusFor(code)).json({ ok: false, error: code });
    } finally {
      if (runtime?.close) await runtime.close();
    }
  };
}

export function createPurchaseIntentHandler({ serviceFactory, checkoutProviderFactory, env = process.env } = {}) {
  return async function purchaseIntent(req, res) {
    if (!prepare(req, res, { env, methods: 'POST,OPTIONS' })) return;
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    if (!runtimeFlags(env).checkout_enabled) return res.status(404).json({ ok: false, error: 'not_found' });
    let runtime;
    try {
      const body = jsonBody(req);
      runtime = await serviceFactory();
      await runtime.service.enforceRateLimit({ scope: 'purchase_intent', identity: requestFingerprint(req), limit: 10 });
      const intent = await runtime.service.createPurchaseIntent({ ...body, idempotency_key: req.headers?.['idempotency-key'] || body.idempotency_key });
      const checkout = await checkoutProviderFactory(env).create({ intent });
      return res.status(200).json({ ok: true, intent_id: intent.intent_id, checkout_url: checkout.url, idempotent: intent.idempotent });
    } catch (error) {
      const code = safeError(error);
      return res.status(statusFor(code)).json({ ok: false, error: code });
    } finally {
      if (runtime?.close) await runtime.close();
    }
  };
}

export function createProductStartHandler({ serviceFactory, env = process.env } = {}) {
  return async function productStart(req, res) {
    if (!prepare(req, res, { env, methods: 'POST,OPTIONS' })) return;
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    let runtime;
    try {
      runtime = await serviceFactory();
      await runtime.service.enforceRateLimit({ scope: 'product_start', identity: requestFingerprint(req), limit: 20 });
      const body = jsonBody(req);
      const result = await runtime.service.startProduct({ ...body, start_token: req.headers?.['x-more-start-token'] || body.start_token });
      return res.status(200).json({ ok: true, ...result });
    } catch (error) {
      const code = safeError(error);
      return res.status(statusFor(code)).json({ ok: false, error: code });
    } finally {
      if (runtime?.close) await runtime.close();
    }
  };
}

export function createInquiryHandler({ serviceFactory, env = process.env } = {}) {
  return async function inquiry(req, res) {
    if (!prepare(req, res, { env, methods: 'POST,OPTIONS' })) return;
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    if (!runtimeFlags(env).inquiry_intake_enabled) return res.status(404).json({ ok: false, error: 'not_found' });
    let runtime;
    try {
      runtime = await serviceFactory();
      await runtime.service.enforceRateLimit({ scope: 'inquiry', identity: requestFingerprint(req), limit: 5 });
      const body = jsonBody(req);
      const result = await runtime.service.createInquiry({ ...body, idempotency_key: req.headers?.['idempotency-key'] || body.idempotency_key });
      return res.status(202).json({ ok: true, ...result });
    } catch (error) {
      const code = safeError(error);
      return res.status(statusFor(code)).json({ ok: false, error: code });
    } finally {
      if (runtime?.close) await runtime.close();
    }
  };
}
