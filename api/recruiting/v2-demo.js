/* global process */

import { authenticateRecruitingDemoRequest } from '../engine/leadershipDemo/authority.js';
import { getRecruitingRedis } from '../engine/recruitingV1/redisStore.js';
import { createRecruitingV2DemoRuntime, recruitingV2SyntheticDemoEnabled } from '../engine/recruitingV2Demo/runtime.js';

function requestOrigin(req) {
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim().toLowerCase();
  const proto = String(req.headers?.['x-forwarded-proto'] || (host.startsWith('127.0.0.1') || host.startsWith('localhost') ? 'http' : 'https')).split(',')[0].trim();
  return `${proto}://${host}`;
}

function sameOrigin(req, allowMissingGet = false) {
  const supplied = String(req.headers?.origin || req.headers?.referer || '').trim();
  if (!supplied && allowMissingGet && req.method === 'GET') return true;
  try { return new URL(supplied).origin === requestOrigin(req); } catch { return false; }
}

function headers(res) {
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function statusFor(code) {
  if (/CAPABILITY_REQUIRED|CAPABILITY_INVALID/.test(code)) return 401;
  if (/SCOPE_DENIED|ORIGIN|CSRF/.test(code)) return 403;
  if (/NOT_FOUND/.test(code)) return 404;
  if (/IN_PROGRESS/.test(code)) return 409;
  if (/INVALID|REQUIRED|DENIED/.test(code)) return 422;
  return 503;
}

export default async function recruitingV2DemoHandler(req, res) {
  headers(res);
  if (!recruitingV2SyntheticDemoEnabled(process.env)) return res.status(404).json({ ok: false, code: 'NOT_FOUND' });
  if (!sameOrigin(req, true)) return res.status(403).json({ ok: false, code: 'RECRUITING_V2_DEMO_ORIGIN_DENIED' });
  try {
    const auth = await authenticateRecruitingDemoRequest({ redis: getRecruitingRedis(process.env), req });
    if (!auth.ok) return res.status(auth.status).json({ ok: false, code: auth.code });
    const runtime = createRecruitingV2DemoRuntime({ env: process.env });
    if (req.method === 'GET') {
      const view = String(req.query?.view || 'session');
      if (view === 'availability') return res.status(200).json({ ok: true, ...(await runtime.availability(auth.capability)) });
      if (view === 'session') return res.status(200).json({ ok: true, ...(await runtime.read(auth.capability)) });
      return res.status(400).json({ ok: false, code: 'RECRUITING_V2_DEMO_VIEW_INVALID' });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });
    const payload = await runtime.mutate(
      auth.capability,
      req.headers?.['x-recruiting-v2-demo-csrf'],
      String(req.body?.action || ''),
      req.body || {},
    );
    return res.status(200).json({ ok: true, ...payload });
  } catch (error) {
    const code = String(error?.message || 'RECRUITING_V2_DEMO_FAILURE').slice(0, 180);
    console.error(JSON.stringify({ event: 'RECRUITING_V2_SYNTHETIC_DEMO_REQUEST_FAILED', code, raw_payload_logged: false, token_logged: false, customer_data_logged: false }));
    return res.status(statusFor(code)).json({ ok: false, code });
  }
}
