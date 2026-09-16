import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { getSubscriptionRedis } from '../engine/subscriptionV1/internalDevInfrastructure.js';
import { sameOriginLeadershipDemoRequest, setLeadershipDemoNoStore } from '../engine/leadershipDemo/authority.js';

// Temporary, unaliased seed only. This file must not be present in the final release.
const EXPIRES_AT = Date.parse('2026-09-16T16:49:00.000Z');
const REPORT_KEY = 'more:darren-library:v1:private:bos:bailea';
const REPORT_BYTES = 85_798;
const REPORT_SHA256 = 'acb4c0c4842210b26c0fc813fab255e0fe9eb3cc0cab84e9305865f69980cdcc';
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEANeyVKWmsU9JPss74tEPkiNGVfmVP95bOO7JoUJKA9ZE=
-----END PUBLIC KEY-----`;

function reply(res, status, code, extra = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ ok: status === 200, code, ...extra }));
}

export function createDarrenDemoLibrarySeedHandler({
  now = () => Date.now(),
  getRedis = getSubscriptionRedis,
  env = globalThis.process?.env || {},
} = {}) {
  return async function darrenDemoLibrarySeed(req, res) {
    setLeadershipDemoNoStore(res);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    if (now() >= EXPIRES_AT) return reply(res, 410, 'SEED_EXPIRED');
    if (req.method !== 'POST') return reply(res, 405, 'SEED_POST_ONLY');
    const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').toLowerCase().trim();
    if (!/^[a-z0-9-]+\.vercel\.app$/.test(host) || !sameOriginLeadershipDemoRequest(req)) {
      return reply(res, 403, 'SEED_UNALIASED_ORIGIN_REQUIRED');
    }
    if (!/^application\/json(?:;|$)/i.test(String(req.headers?.['content-type'] || ''))) {
      return reply(res, 415, 'SEED_JSON_REQUIRED');
    }
    const signatureText = String(req.headers?.['x-more-seed-signature'] || '');
    if (!/^[A-Za-z0-9_-]{86}$/.test(signatureText)) return reply(res, 403, 'SEED_SIGNATURE_REQUIRED');
    let body;
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
    catch { return reply(res, 400, 'SEED_PAYLOAD_INVALID'); }
    const encoded = body?.payload;
    if (typeof encoded !== 'string' || encoded.length > 120_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
      return reply(res, 400, 'SEED_PAYLOAD_INVALID');
    }
    const bytes = Buffer.from(encoded, 'base64');
    const digest = crypto.createHash('sha256').update(bytes).digest('hex');
    if (bytes.length !== REPORT_BYTES || digest !== REPORT_SHA256) return reply(res, 422, 'SEED_APPROVED_HASH_REQUIRED');
    const signature = Buffer.from(signatureText, 'base64url');
    const message = Buffer.concat([Buffer.from(`${new Date(EXPIRES_AT).toISOString()}\n`), bytes]);
    if (!crypto.verify(null, message, PUBLIC_KEY, signature)) return reply(res, 403, 'SEED_SIGNATURE_INVALID');

    try {
      const redis = getRedis(env);
      const existing = await redis.getBuffer(REPORT_KEY);
      if (existing) {
        const existingHash = crypto.createHash('sha256').update(existing).digest('hex');
        return existing.length === REPORT_BYTES && existingHash === REPORT_SHA256
          ? reply(res, 200, 'SEED_ALREADY_VERIFIED', { sha256: REPORT_SHA256, created: false })
          : reply(res, 409, 'SEED_KEY_COLLISION');
      }
      const created = await redis.set(REPORT_KEY, bytes, 'NX');
      const saved = await redis.getBuffer(REPORT_KEY);
      const savedHash = saved && crypto.createHash('sha256').update(saved).digest('hex');
      if (!saved || saved.length !== REPORT_BYTES || savedHash !== REPORT_SHA256) {
        return reply(res, 409, 'SEED_READBACK_MISMATCH');
      }
      return reply(res, 200, 'SEED_VERIFIED', { sha256: REPORT_SHA256, created: created === 'OK' });
    } catch {
      return reply(res, 500, 'SEED_STORE_UNAVAILABLE');
    }
  };
}

export default createDarrenDemoLibrarySeedHandler();
