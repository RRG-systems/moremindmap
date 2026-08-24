/* global process */

import { createDarrenSyntheticDemoRuntime, recruitingDarrenDemoEnabled } from '../engine/recruitingV1/demoRuntime.js';

const MANAGER_COOKIE = '__Host-more_recruiting_manager';

function cookies(header = '') {
  return Object.fromEntries(String(header).split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}

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

function statusFor(error) {
  const code = String(error?.message || 'RECRUITING_DEMO_FAILURE');
  if (/SESSION_REQUIRED/.test(code)) return 401;
  if (/SCOPE_DENIED|ADMIN_REQUIRED|AUTHORITY_INCOMPLETE|ORIGIN|CSRF/.test(code)) return 403;
  if (/NOT_FOUND/.test(code)) return 404;
  if (/IN_PROGRESS/.test(code)) return 409;
  if (/INVALID|REQUIRED|DENIED/.test(code)) return 422;
  return 503;
}

export default async function recruitingDemoHandler(req, res) {
  headers(res);
  if (!recruitingDarrenDemoEnabled(process.env)) return res.status(404).json({ ok: false, code: 'NOT_FOUND' });
  if (!sameOrigin(req, true)) return res.status(403).json({ ok: false, code: 'RECRUITING_DEMO_ORIGIN_DENIED' });
  const managerToken = cookies(req.headers?.cookie)[MANAGER_COOKIE];
  try {
    const runtime = createDarrenSyntheticDemoRuntime({ env: process.env });
    if (req.method === 'GET') {
      const view = String(req.query?.view || 'demo');
      if (view === 'availability') return res.status(200).json({ ok: true, ...(await runtime.availability(managerToken)) });
      if (view === 'demo') return res.status(200).json({ ok: true, ...(await runtime.read(managerToken)) });
      return res.status(400).json({ ok: false, code: 'RECRUITING_DEMO_VIEW_INVALID' });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });
    const action = String(req.body?.action || '');
    const payload = await runtime.mutate(managerToken, req.headers?.['x-recruiting-demo-csrf'], action, req.body || {});
    return res.status(200).json({ ok: true, ...payload });
  } catch (error) {
    const code = String(error?.message || 'RECRUITING_DEMO_FAILURE').slice(0, 180);
    console.error(JSON.stringify({ event: 'RECRUITING_DARREN_SYNTHETIC_DEMO_REQUEST_FAILED', code, raw_payload_logged: false, token_logged: false, profile_logged: false }));
    return res.status(statusFor(error)).json({ ok: false, code });
  }
}

