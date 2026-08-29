/* global process */

import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { getRecruitingService, recruitingRuntimeEnabled } from '../engine/recruitingV1/runtime.js';
import { getRecruitingRedis } from '../engine/recruitingV1/redisStore.js';
import { createRecruitingGuV1RealRuntime } from '../engine/recruitingGuV1/realRuntime.js';
import { issueRecruitingDemoCapabilityForManager } from '../engine/leadershipDemo/authority.js';

const MANAGER_COOKIE = '__Host-more_recruiting_manager';
const approvalCsrf = new Map();

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

function secureCookie(name, value, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=${maxAge}`;
}

function headers(res) {
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function statusFor(code) {
  if (/SESSION_REQUIRED|APPROVAL_INVALID/.test(code)) return 401;
  if (/SCOPE_DENIED|ORIGIN|CSRF/.test(code)) return 403;
  if (/NOT_FOUND|NOT_READY/.test(code)) return 404;
  if (/STALE|COMPLETED|PENDING/.test(code)) return 409;
  if (/INVALID|REQUIRED|REFUSED|DENIED|UNAVAILABLE/.test(code)) return 422;
  return 503;
}

function issueApprovalCsrf(token) {
  const key = crypto.createHash('sha256').update(String(token)).digest('hex');
  const proof = crypto.randomBytes(24).toString('base64url');
  approvalCsrf.set(key, proof);
  return proof;
}

function consumeApprovalCsrf(token, supplied) {
  const key = crypto.createHash('sha256').update(String(token)).digest('hex');
  const expected = approvalCsrf.get(key);
  const ok = typeof supplied === 'string' && typeof expected === 'string' && supplied.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  if (ok) approvalCsrf.delete(key);
  return ok;
}

export function createRecruitingGuV1Handler({ env = process.env, service = null, runtime = null } = {}) {
  let activeService = service;
  let activeRuntime = runtime;
  const dependencies = () => {
    if (!activeService) activeService = getRecruitingService(env);
    if (!activeRuntime) activeRuntime = createRecruitingGuV1RealRuntime({ env, service: activeService });
    return { activeService, activeRuntime };
  };
  return async function recruitingGuV1Handler(req, res) {
    headers(res);
    if (env.RECRUITING_GU_V1_ENABLED !== 'true' || !recruitingRuntimeEnabled(env)) return res.status(404).json({ ok: false, code: 'NOT_FOUND' });
    if (!sameOrigin(req, true)) return res.status(403).json({ ok: false, code: 'RECRUITING_GU_V1_ORIGIN_DENIED' });
    const token = String(req.query?.token || req.body?.token || '');
    let recruitingService = null;
    let managerToken = '';
    try {
      const resolved = dependencies();
      recruitingService = resolved.activeService;
      const recruitingRuntime = resolved.activeRuntime;
      if (req.method === 'GET' && String(req.query?.view || '') === 'approval_preview') {
        return res.status(200).json({ ok: true, preview: await recruitingRuntime.approvalPreview(token), csrf_token: issueApprovalCsrf(token) });
      }
      if (req.method === 'POST' && req.body?.action === 'OWNER_DECISION') {
        if (!consumeApprovalCsrf(token, req.headers?.['x-recruiting-gu-v1-owner-csrf'])) return res.status(403).json({ ok: false, code: 'RECRUITING_GU_V1_OWNER_CSRF_DENIED' });
        return res.status(200).json({ ok: true, ...(await recruitingRuntime.approveMoreId(token, req.body?.decision)) });
      }

      managerToken = cookies(req.headers?.cookie)[MANAGER_COOKIE];
      if (req.method === 'GET') {
        const rotated = await recruitingService.rotateManagerSession(managerToken);
        res.setHeader('Set-Cookie', secureCookie(MANAGER_COOKIE, rotated.session_token, 8 * 60 * 60));
        const csrf_token = await recruitingService.issueManagerCsrf(rotated.session_token);
        const view = String(req.query?.view || 'home');
        if (view === 'home') return res.status(200).json({ ok: true, ...(await recruitingRuntime.home(rotated.session_token)), csrf_token });
        if (view === 'session') return res.status(200).json({ ok: true, session: await recruitingRuntime.read(rotated.session_token, String(req.query?.session_id || '')), csrf_token });
        return res.status(400).json({ ok: false, code: 'RECRUITING_GU_V1_VIEW_INVALID' });
      }
      if (req.method !== 'POST') return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });
      await recruitingService.consumeManagerCsrf(managerToken, req.headers?.['x-recruiting-gu-v1-csrf']);
      const action = String(req.body?.action || '');
      if (action === 'OPEN_DARREN_DEMO') {
        const manager = await recruitingService.inspectManagerReadOnly(managerToken);
        const issued = await issueRecruitingDemoCapabilityForManager({
          redis: getRecruitingRedis(env),
          req,
          managerSubjectId: manager.membership.manager_subject_id,
          membershipId: manager.membership.membership_id,
          masterControl: manager.capabilities.master_control,
        });
        const rotated = await recruitingService.rotateManagerSession(managerToken);
        res.setHeader('Set-Cookie', [secureCookie(MANAGER_COOKIE, rotated.session_token, 8 * 60 * 60), issued.cookie]);
        return res.status(200).json({
          ok: true,
          code: 'RECRUITING_GU_V1_DARREN_DEMO_CAPABILITY_ISSUED',
          redirect_to: '/recruiting-gu-v1/demo',
          synthetic_only: true,
          csrf_token: await recruitingService.issueManagerCsrf(rotated.session_token),
        });
      }
      let payload;
      if (action === 'OPEN_CANDIDATE') payload = await recruitingRuntime.openCandidate(managerToken, req.body?.candidate_id);
      else if (action === 'OPEN_RELATIONSHIP') payload = await recruitingRuntime.openRelationship(managerToken, req.body?.relationship_id);
      else if (action === 'REQUEST_MORE_ID') payload = await recruitingRuntime.requestMoreId(managerToken, req.body?.profile_id);
      else payload = await recruitingRuntime.mutate(managerToken, String(req.body?.session_id || ''), action, req.body || {});
      const rotated = await recruitingService.rotateManagerSession(managerToken);
      res.setHeader('Set-Cookie', secureCookie(MANAGER_COOKIE, rotated.session_token, 8 * 60 * 60));
      return res.status(200).json({ ok: true, ...payload, csrf_token: await recruitingService.issueManagerCsrf(rotated.session_token) });
    } catch (error) {
      const code = String(error?.message || 'RECRUITING_GU_V1_FAILURE').slice(0, 180);
      console.error(JSON.stringify({ event: 'RECRUITING_GU_V1_REQUEST_FAILED', code, raw_payload_logged: false, token_logged: false, profile_logged: false }));
      let csrf_token = null;
      if (managerToken && recruitingService && !/CSRF/u.test(code)) {
        try { csrf_token = await recruitingService.issueManagerCsrf(managerToken); } catch { csrf_token = null; }
      }
      return res.status(statusFor(code)).json({ ok: false, code, current_revision: error?.current_revision || null, ...(csrf_token ? { csrf_token } : {}) });
    }
  };
}

export default createRecruitingGuV1Handler();
