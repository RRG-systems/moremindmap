/* global process */
import { waitUntil as vercelWaitUntil } from '@vercel/functions';
import { normalizeProfileId, publicCatalogProjection } from './contracts.js';
import { applyExactOriginCors, runtimeFlags } from './security.js';
import { profileOwnerCookie } from './profileOwnership.js';
import { clearComplimentaryFlowCookie, complimentaryFlowCookie } from './complimentaryFlow.js';

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
    'complimentary_flow_conflict', 'complimentary_flow_invalid', 'complimentary_flow_required',
    'grant_profile_binding_mismatch', 'grant_vertical_binding_required', 'idempotency_key_required',
    'authenticated_membership_context_required', 'authenticated_profile_owner_required',
    'business_assessment_profile_mismatch', 'business_assessment_vertical_authority_required',
    'client_supplied_identity_override_denied', 'completed_bos_and_business_assessment_required',
    'inquiry_rejected', 'operation_in_progress', 'product_destination_gated', 'product_not_found',
    'paid_entitlement_reconciliation_required',
    'rate_limited',
    'profile_id_required', 'profile_ownership_required', 'provider_payment_confirmation_required', 'purchase_intent_not_found',
    'subscription_checkout_gated', 'valid_email_required', 'valid_inquiry_fields_required',
    'valid_profile_id_required',
  ]);
  return allowed.has(code) ? code : 'request_unavailable';
}

function statusFor(code) {
  if (code === 'ownership_verification_failed') return 401;
  if (code === 'operation_in_progress') return 409;
  if (code.endsWith('_conflict')) return 409;
  if (code === 'paid_entitlement_reconciliation_required') return 409;
  if (code === 'rate_limited') return 429;
  if (code.endsWith('_gated')) return 409;
  if (code.includes('unavailable')) return 503;
  return 400;
}

function prepare(req, res, { env, methods, allowCredentials = false }) {
  res.setHeader('Content-Type', 'application/json');
  if (!applyExactOriginCors(req, res, { env, methods, allowCredentials })) {
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
    if (!prepare(req, res, { env, methods: 'POST,OPTIONS', allowCredentials: true })) return;
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    const body = jsonBody(req);
    if (body.action === 'discard_prepared_complimentary') {
      res.setHeader('Set-Cookie', clearComplimentaryFlowCookie());
      return res.status(200).json({ ok: true, state: 'complimentary_path_discarded' });
    }
    let runtime;
    try {
      runtime = await serviceFactory();
      await runtime.service.enforceRateLimit({ scope: 'access', identity: requestFingerprint(req), limit: 30 });
      const requestContext = { cookie_header: req.headers?.cookie };
      if (body.action === 'lookup') return res.status(200).json({ ok: true, ...(await runtime.service.lookupEntry(body, requestContext)) });
      if (body.action === 'redeem') {
        if (!runtimeFlags(env).complimentary_redemption_enabled) return res.status(404).json({ ok: false, error: 'not_found' });
        // Direct redemption remains the established BOS path. BA must use the
        // HttpOnly prepared-flow receipt so raw capability validity cannot be
        // inferred from prerequisite-specific errors.
        if (body.product_key !== 'behavior_operating_system') {
          return res.status(400).json({ ok: false, error: 'complimentary_flow_required' });
        }
        return res.status(200).json({ ok: true, ...(await runtime.service.redeemComplimentary(body, requestContext)) });
      }
      if (body.action === 'prepare_complimentary') {
        if (!runtimeFlags(env).complimentary_redemption_enabled) return res.status(404).json({ ok: false, error: 'not_found' });
        const prepared = await runtime.service.prepareComplimentaryFlow(body);
        res.setHeader('Set-Cookie', complimentaryFlowCookie(prepared.receipt));
        return res.status(202).json({
          ok: true,
          state: prepared.state,
          product_key: prepared.product_key,
        });
      }
      if (body.action === 'prepared_complimentary_status') {
        if (!runtimeFlags(env).complimentary_redemption_enabled) return res.status(404).json({ ok: false, error: 'not_found' });
        const prepared = runtime.service.readPreparedComplimentaryFlow(requestContext);
        return res.status(200).json({
          ok: true,
          state: prepared.state,
          product_key: prepared.product_key,
        });
      }
      if (body.action === 'redeem_prepared_complimentary') {
        if (!runtimeFlags(env).complimentary_redemption_enabled) return res.status(404).json({ ok: false, error: 'not_found' });
        return res.status(200).json({ ok: true, ...(await runtime.service.redeemPreparedComplimentary(body, requestContext)) });
      }
      if (body.action === 'create_start_token') {
        return res.status(200).json({ ok: true, ...(await runtime.service.createStartTokenForGrant(body)) });
      }
      if (body.action === 'create_start_token_from_session') {
        return res.status(200).json({ ok: true, ...(await runtime.service.createStartTokenForSession(body)) });
      }
      if (body.action === 'renew_start_token') {
        return res.status(200).json({
          ok: true,
          ...(await runtime.service.renewStartToken({
            start_token: req.headers?.['x-more-start-token'] || body.start_token,
          })),
        });
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
    if (!prepare(req, res, { env, methods: 'POST,OPTIONS', allowCredentials: true })) return;
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    if (!runtimeFlags(env).checkout_enabled) return res.status(404).json({ ok: false, error: 'not_found' });
    let runtime;
    try {
      const body = jsonBody(req);
      if (body.product_key === 'more_monthly_intelligence'
        && !runtimeFlags(env).subscription_checkout_enabled) {
        return res.status(404).json({ ok: false, error: 'not_found' });
      }
      runtime = await serviceFactory();
      await runtime.service.enforceRateLimit({ scope: 'purchase_intent', identity: requestFingerprint(req), limit: 10 });
      const intent = await runtime.service.createPurchaseIntent(
        { ...body, idempotency_key: req.headers?.['idempotency-key'] || body.idempotency_key },
        { cookie_header: req.headers?.cookie },
      );
      if (intent.status === 'granted') {
        return res.status(409).json({ ok: false, error: 'purchase_already_granted' });
      }
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

export function createProfileOwnershipHandler({
  serviceFactory,
  env = process.env,
  waitUntil = vercelWaitUntil,
} = {}) {
  return async function profileOwnership(req, res) {
    if (!prepare(req, res, { env, methods: 'POST,OPTIONS', allowCredentials: true })) return;
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    let runtime;
    let backgroundOwnsRuntime = false;
    try {
      const body = jsonBody(req);
      runtime = await serviceFactory();
      await runtime.service.enforceRateLimit({
        scope: `profile_ownership:${body.action === 'verify' ? 'verify' : 'request'}`,
        identity: requestFingerprint(req),
        limit: body.action === 'verify' ? 20 : 5,
      });
      if (body.action === 'request') {
        const normalizedProfileId = normalizeProfileId(body.profile_id);
        await runtime.service.enforceRateLimit({
          scope: 'profile_ownership:profile',
          identity: normalizedProfileId || 'invalid_profile_id',
          limit: 3,
          windowMs: 15 * 60 * 1000,
        });
        let registered = false;
        const task = Promise.resolve()
          .then(() => registered
            ? runtime.ownership.requestChallenge({
              profile_id: normalizedProfileId || body.profile_id,
              return_path: body.return_path,
            })
            : null)
          .catch(() => null)
          .finally(async () => {
            if (registered && runtime?.close) {
              try { await runtime.close(); } catch { /* background delivery remains fail-closed */ }
            }
          });
        try {
          if (typeof waitUntil !== 'function') throw new Error('background_primitive_unavailable');
          waitUntil(task);
          registered = true;
          backgroundOwnsRuntime = true;
        } catch {
          // The public response is deliberately identical; no unregistered
          // provider work is dispatched after the request lifecycle ends.
        }
        return res.status(202).json({ ok: true, state: 'verification_requested_if_available' });
      }
      if (body.action === 'verify') {
        const verified = await runtime.ownership.consumeChallenge(body.token);
        res.setHeader('Set-Cookie', profileOwnerCookie(verified.receipt, verified.max_age_seconds));
        return res.status(200).json({
          ok: true,
          state: 'ownership_verified',
          profile_id: verified.profile_id,
          return_path: verified.return_path,
        });
      }
      return res.status(400).json({ ok: false, error: 'invalid_action' });
    } catch (error) {
      const raw = String(error?.message || '');
      if (raw === 'ownership_verification_failed') {
        return res.status(401).json({ ok: false, error: 'ownership_verification_failed' });
      }
      const code = safeError(error);
      return res.status(statusFor(code)).json({ ok: false, error: code });
    } finally {
      if (!backgroundOwnsRuntime && runtime?.close) await runtime.close();
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
      let delivery = null;
      try { delivery = await runtime.service.dispatchInquiry(result.outbox_id); }
      catch { delivery = { state: 'retry_pending' }; }
      return res.status(202).json({
        ok: true,
        receipt_id: result.receipt_id,
        state: delivery.state === 'delivered' ? 'delivered' : result.state,
        idempotent: result.idempotent,
      });
    } catch (error) {
      const code = safeError(error);
      return res.status(statusFor(code)).json({ ok: false, error: code });
    } finally {
      if (runtime?.close) await runtime.close();
    }
  };
}
