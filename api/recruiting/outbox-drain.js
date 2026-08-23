/* global Buffer, process */

import crypto from 'node:crypto';
import { getRecruitingService, recruitingRuntimeEnabled } from '../engine/recruitingV1/runtime.js';

function authorized(req) {
  const expected = String(process.env.RECRUITING_OUTBOX_DRAIN_SECRET || '');
  const authorization = String(req.headers?.authorization || '');
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  if (expectedBytes.length < 32 || suppliedBytes.length !== expectedBytes.length) return false;
  return crypto.timingSafeEqual(suppliedBytes, expectedBytes);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!recruitingRuntimeEnabled() || !authorized(req)) return res.status(404).json({ ok: false, code: 'NOT_FOUND' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });
  try {
    const results = await getRecruitingService().deliverPendingOutbox(Math.min(Number(req.body?.limit) || 20, 100));
    return res.status(200).json({
      ok: true,
      attempted: results.length,
      delivered: results.filter((result) => result?.item?.state === 'DELIVERED').length,
      failed: results.filter((result) => result?.item?.state === 'FAILED').length,
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'RECRUITING_OUTBOX_DRAIN_FAILED',
      code: String(error?.message || 'RECRUITING_OUTBOX_DRAIN_FAILED').split(':')[0],
      recipient_logged: false,
      token_logged: false,
      payload_logged: false,
    }));
    return res.status(503).json({ ok: false, code: 'RECRUITING_OUTBOX_DRAIN_UNAVAILABLE' });
  }
}
