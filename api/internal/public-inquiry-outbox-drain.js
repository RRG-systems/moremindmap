/* global process */

import { closePublicRuntime, createPublicRuntime } from '../../src/lib/publicSiteAirlockV1/runtime.js';
import { timingSafeHeaderMatch } from '../../src/lib/publicSiteAirlockV1/security.js';

export const PUBLIC_INQUIRY_PENDING_SET = 'public_inquiry_v1:outbox:pending';
const MAX_BATCH = 20;

function body(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch { return {}; }
}

function requestedLimit(req) {
  const value = Number(body(req).limit);
  if (!Number.isFinite(value) || value <= 0) return MAX_BATCH;
  return Math.min(Math.max(Math.floor(value), 1), MAX_BATCH);
}

function bearer(req) {
  const authorization = String(req.headers?.authorization || '');
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

function enabled(env) {
  return String(env.PUBLIC_INQUIRY_INTAKE_ENABLED || '').trim().toLowerCase() === 'true';
}

async function defaultRuntimeFactory(env) {
  const runtime = createPublicRuntime(env);
  return { ...runtime, close: () => closePublicRuntime(runtime) };
}

export function createPublicInquiryOutboxDrainHandler({ env = process.env, runtimeFactory = defaultRuntimeFactory } = {}) {
  return async function publicInquiryOutboxDrain(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const authorized = enabled(env)
      && timingSafeHeaderMatch(bearer(req), env.MOREMINDMAP_SERVER_ONLY_INQUIRY_OUTBOX_DRAIN_SECRET);
    if (!authorized) return res.status(404).json({ ok: false, error: 'not_found' });
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

    let runtime;
    try {
      runtime = await runtimeFactory(env);
      if (!runtime?.store?.smembers || !runtime?.store?.srem || !runtime?.service?.dispatchInquiry) {
        throw new Error('public_inquiry_drain_runtime_unavailable');
      }
      const pending = [...new Set(await runtime.store.smembers(PUBLIC_INQUIRY_PENDING_SET))]
        .filter((value) => typeof value === 'string' && value.length <= 220)
        .sort()
        .slice(0, requestedLimit(req));
      const totals = { attempted: 0, delivered: 0, retry_pending: 0, failed: 0 };
      for (const outboxId of pending) {
        totals.attempted += 1;
        try {
          const result = await runtime.service.dispatchInquiry(outboxId);
          if (result?.state === 'delivered') {
            await runtime.store.srem(PUBLIC_INQUIRY_PENDING_SET, outboxId);
            totals.delivered += 1;
          } else if (result?.state === 'retry_pending') {
            totals.retry_pending += 1;
          } else {
            totals.failed += 1;
          }
        } catch {
          totals.failed += 1;
        }
      }
      return res.status(200).json({ ok: true, ...totals });
    } catch {
      return res.status(503).json({ ok: false, error: 'public_inquiry_drain_unavailable' });
    } finally {
      if (runtime?.close) {
        try { await runtime.close(); } catch { /* response remains privacy-safe and final */ }
      }
    }
  };
}

export default createPublicInquiryOutboxDrainHandler();

export const PUBLIC_INQUIRY_DRAIN_CONTRACT = Object.freeze({
  method: 'POST',
  maximum_batch: MAX_BATCH,
  authority_header: 'Authorization: Bearer <server-only secret>',
  unauthorized_projection: 'not_found',
  customer_fields_in_response: false,
});
