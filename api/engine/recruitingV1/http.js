/* global process */

import { getRecruitingService, generateCandidateIntelligence, getCandidateProjection, recruitingRuntimeEnabled, syntheticReviewEnabled } from './runtime.js';

const MANAGER_COOKIE = '__Host-more_recruiting_manager';
const INVITE_COOKIE = '__Host-more_recruiting_invite';
const SETUP_COOKIE = '__Host-more_recruiting_setup';

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

function clearCookie(name) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=0`;
}

export function setRecruitingHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function statusFor(error) {
  const code = String(error?.message || 'RECRUITING_V1_FAILURE');
  if (/SESSION_REQUIRED|CONSENT_REQUIRED|PREAPPROVAL_REQUIRED/.test(code)) return 401;
  if (/SCOPE_DENIED|ORIGIN|CSRF|AUTHORITY_REQUIRED/.test(code)) return 403;
  if (/NOT_FOUND/.test(code)) return 404;
  if (/EXHAUSTED|REQUIRES_REVIEW|REBIND|RESEND_DENIED/.test(code)) return 409;
  if (/INVALID|REQUIRED|DENIED/.test(code)) return 422;
  return 503;
}

async function rotateManagerAndIssueCsrf(service, res, sessionToken) {
  const rotated = await service.rotateManagerSession(sessionToken);
  res.setHeader('Set-Cookie', secureCookie(MANAGER_COOKIE, rotated.session_token, 8 * 60 * 60));
  return {
    session_token: rotated.session_token,
    csrf_token: await service.issueManagerCsrf(rotated.session_token),
  };
}

async function authenticatedRead(service, res, sessionToken, read) {
  const auth = await rotateManagerAndIssueCsrf(service, res, sessionToken);
  return { ...(await read(auth.session_token)), csrf_token: auth.csrf_token };
}

async function authenticatedMutation(service, req, res, sessionToken, mutate) {
  await service.consumeManagerCsrf(sessionToken, req.headers?.['x-recruiting-csrf']);
  const result = await mutate(sessionToken);
  const auth = await rotateManagerAndIssueCsrf(service, res, sessionToken);
  return { ...result, csrf_token: auth.csrf_token };
}

async function deliverQueued(service, result) {
  if (!result?.outbox_id) return result;
  const delivered = await service.deliverOutbox(result.outbox_id);
  const state = delivered?.item?.state || null;
  if (state !== 'DELIVERED') throw new Error('RECRUITING_NOTIFICATION_DELIVERY_FAILED');
  return {
    ...result,
    delivery: {
      state,
      provider_receipt: delivered.item.provider_receipt || null,
    },
  };
}

export async function recruitingHttpHandler(req, res) {
  setRecruitingHeaders(res);
  if (!recruitingRuntimeEnabled()) return res.status(404).json({ ok: false, code: 'NOT_FOUND' });
  if (!sameOrigin(req, true)) return res.status(403).json({ ok: false, code: 'RECRUITING_ORIGIN_DENIED' });
  const parsedCookies = cookies(req.headers?.cookie);
  const managerToken = parsedCookies[MANAGER_COOKIE];
  const inviteToken = parsedCookies[INVITE_COOKIE];
  const setupToken = parsedCookies[SETUP_COOKIE];
  try {
    const service = getRecruitingService();
    if (req.method === 'GET') {
      const view = String(req.query?.view || 'session');
      if (view === 'invite_preview') return res.status(200).json({ ok: true, preview: await service.invitationPreview(req.query?.token) });
      if (view === 'manager_setup_preview') return res.status(200).json({ ok: true, preview: await service.managerSetupPreview(req.query?.token) });
      if (view === 'invite_session') {
        const inspected = await service.inspectInviteSession(inviteToken);
        const rotated = await service.rotateInviteSession(inviteToken);
        res.setHeader('Set-Cookie', secureCookie(INVITE_COOKIE, rotated.invite_session_token, 30 * 24 * 60 * 60));
        return res.status(200).json({ ok: true, ...inspected });
      }
      if (view === 'session') return res.status(200).json({ ok: true, ...(await authenticatedRead(service, res, managerToken, (token) => service.inspectManager(token))) });
      if (view === 'home') return res.status(200).json({ ok: true, ...(await authenticatedRead(service, res, managerToken, (token) => service.home(token))) });
      if (view === 'opportunity') return res.status(200).json({ ok: true, ...(await authenticatedRead(service, res, managerToken, async (token) => ({ opportunity: await service.getOpportunity(token) }))) });
      if (view === 'candidate') return res.status(200).json({ ok: true, ...(await authenticatedRead(service, res, managerToken, async (token) => ({ candidate: await getCandidateProjection({ sessionToken: token, candidateId: req.query?.candidate_id }) }))) });
      if (view === 'master_control') return res.status(200).json({ ok: true, ...(await authenticatedRead(service, res, managerToken, (token) => service.masterControl(token))) });
      if (view === 'master_control_membership') return res.status(200).json({ ok: true, ...(await authenticatedRead(service, res, managerToken, (token) => service.masterControlMembership(token, req.query?.membership_id))) });
      return res.status(400).json({ ok: false, code: 'RECRUITING_VIEW_INVALID' });
    }
    if (req.method === 'DELETE') {
      res.setHeader('Set-Cookie', [clearCookie(MANAGER_COOKIE), clearCookie(INVITE_COOKIE), clearCookie(SETUP_COOKIE)]);
      return res.status(200).json({ ok: true, code: 'RECRUITING_SESSION_CLEARED' });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });
    const action = String(req.body?.action || '');
    if (action === 'REQUEST_MANAGER_VERIFICATION') return res.status(200).json({ ok: true, ...(await deliverQueued(service, await service.requestManagerVerification(req.body?.profile_id))) });
    if (action === 'VERIFY_MANAGER') {
      const verified = await service.verifyManager(req.body?.token);
      res.setHeader('Set-Cookie', secureCookie(MANAGER_COOKIE, verified.session_token, 8 * 60 * 60));
      return res.status(200).json({ ok: true, code: 'RECRUITING_MANAGER_VERIFIED', membership: verified.membership });
    }
    if (action === 'BEGIN_MANAGER_SETUP') {
      const started = await service.beginManagerSetup(req.body?.token);
      res.setHeader('Set-Cookie', secureCookie(SETUP_COOKIE, started.setup_session_token, 30 * 60));
      return res.status(200).json({ ok: true, code: 'RECRUITING_MANAGER_SETUP_EMAIL_VERIFIED', membership: started.membership, csrf_token: started.csrf_token });
    }
    if (action === 'COMPLETE_MANAGER_SETUP') {
      const completed = await service.completeManagerSetup(setupToken, req.headers?.['x-recruiting-setup-csrf'], req.body?.profile_id);
      res.setHeader('Set-Cookie', [secureCookie(MANAGER_COOKIE, completed.manager_session_token, 8 * 60 * 60), clearCookie(SETUP_COOKIE)]);
      return res.status(200).json({ ok: true, code: 'RECRUITING_MANAGER_SETUP_COMPLETE', membership: completed.membership });
    }
    if (action === 'ACCEPT_INVITATION') {
      const accepted = await service.acceptInvitation(req.body?.token, req.body?.consent);
      res.setHeader('Set-Cookie', secureCookie(INVITE_COOKIE, accepted.invite_session_token, 30 * 24 * 60 * 60));
      return res.status(200).json({ ok: true, code: 'RECRUITING_INVITATION_ACCEPTED', invitation: accepted.invitation });
    }
    if (action === 'CREATE_INVITATION') {
      const created = await authenticatedMutation(service, req, res, managerToken, (token) =>
        service.createInvitation(token, req.body, req.headers?.['idempotency-key']));
      return res.status(200).json({ ok: true, ...(await deliverQueued(service, created)) });
    }
    if (action === 'RESEND_INVITATION') {
      const resent = await authenticatedMutation(service, req, res, managerToken, (token) =>
        service.resendInvitation(token, req.body?.invitation_id));
      return res.status(200).json({ ok: true, ...(await deliverQueued(service, resent)) });
    }
    if (action === 'REVOKE_INVITATION') return res.status(200).json({ ok: true, ...(await authenticatedMutation(service, req, res, managerToken, (token) => service.revokeInvitation(token, req.body?.invitation_id))) });
    if (action === 'SAVE_OPPORTUNITY') return res.status(200).json({ ok: true, ...(await authenticatedMutation(service, req, res, managerToken, async (token) => ({ opportunity: await service.saveOpportunity(token, req.body?.items) }))) });
    if (action === 'ADD_EVIDENCE') return res.status(200).json({ ok: true, ...(await authenticatedMutation(service, req, res, managerToken, async (token) => ({ evidence: await service.addEvidence(token, req.body?.candidate_id, req.body?.evidence) }))) });
    if (action === 'GENERATE_INTELLIGENCE') return res.status(200).json({ ok: true, ...(await authenticatedMutation(service, req, res, managerToken, async (token) => ({ intelligence: await generateCandidateIntelligence({ sessionToken: token, candidateId: req.body?.candidate_id }) }))) });
    if (action === 'RECORD_EXPORT') return res.status(200).json({ ok: true, ...(await authenticatedMutation(service, req, res, managerToken, async (token) => ({ code: 'RECRUITING_EXPORT_RECORDED', export: await service.recordExport(token, req.body?.candidate_id, req.body?.mode, req.body?.details_included), synthetic_review: syntheticReviewEnabled() }))) });
    if (action === 'ADMIN_CREATE_MANAGER') {
      const created = await authenticatedMutation(service, req, res, managerToken, (token) => service.createManagerMembership(token, req.body));
      return res.status(200).json({ ok: true, ...(await deliverQueued(service, created)) });
    }
    if (action === 'ADMIN_UPDATE_PENDING_MANAGER') return res.status(200).json({ ok: true, ...(await authenticatedMutation(service, req, res, managerToken, (token) => service.updatePendingManager(token, req.body?.membership_id, req.body))) });
    if (action === 'ADMIN_RESEND_MANAGER_SETUP') {
      const resent = await authenticatedMutation(service, req, res, managerToken, (token) => service.resendManagerSetup(token, req.body?.membership_id));
      return res.status(200).json({ ok: true, ...(await deliverQueued(service, resent)) });
    }
    if (action === 'ADMIN_ACTIVATE_MANAGER') return res.status(200).json({ ok: true, ...(await authenticatedMutation(service, req, res, managerToken, (token) => service.activateManagerMembership(token, req.body?.membership_id))) });
    if (action === 'ADMIN_SUSPEND_MANAGER') return res.status(200).json({ ok: true, ...(await authenticatedMutation(service, req, res, managerToken, (token) => service.suspendManagerMembership(token, req.body?.membership_id))) });
    if (action === 'ADMIN_REVOKE_MANAGER') return res.status(200).json({ ok: true, ...(await authenticatedMutation(service, req, res, managerToken, (token) => service.revokeManagerMembership(token, req.body?.membership_id))) });
    return res.status(400).json({ ok: false, code: 'RECRUITING_ACTION_INVALID' });
  } catch (error) {
    const code = String(error?.message || 'RECRUITING_V1_FAILURE').slice(0, 180);
    console.error(JSON.stringify({ event: 'RECRUITING_V1_REQUEST_FAILED', code, raw_payload_logged: false, token_logged: false, email_logged: false }));
    return res.status(statusFor(error)).json({ ok: false, code });
  }
}

export const RECRUITING_HTTP = Object.freeze({ manager_cookie: MANAGER_COOKIE, invite_cookie: INVITE_COOKIE, setup_cookie: SETUP_COOKIE, profile_id_is_credential: false });
