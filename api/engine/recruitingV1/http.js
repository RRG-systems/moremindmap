/* global process */

import { getRecruitingService, generateCandidateIntelligence, getCandidateProjection, recruitingRuntimeEnabled, syntheticReviewEnabled } from './runtime.js';
import { redis as getRedis } from '../redisClient.js';
import {
  reconcileRecruitingBosStartFromCommittedExecution,
} from './canonicalAdapters.js';
import { buildRecruitingInviteContinuation } from '../../../src/lib/recruitingV1/continuation.js';
import { getConsultingPreparationCoordinator } from './preparationRuntime.js';
import { miniV2ExecutionAllowed } from '../miniV2JobManager.js';
import { RedisPublicStore } from '../../../src/lib/publicSiteAirlockV1/redisStore.js';
import {
  readVerifiedProfileOwnerRequest,
  resolveProfileOwnershipAudience,
} from '../../../src/lib/publicSiteAirlockV1/profileOwnership.js';

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
  const host = String(req.headers?.host || '').split(',')[0].trim().toLowerCase();
  const proto = String(req.headers?.['x-forwarded-proto'] || (host.startsWith('127.0.0.1') || host.startsWith('localhost') ? 'http' : 'https')).split(',')[0].trim();
  return `${proto}://${host}`;
}

function sameOrigin(req, allowMissingGet = false) {
  const supplied = String(req.headers?.origin || req.headers?.referer || '').trim();
  if (!supplied && allowMissingGet && req.method === 'GET') return true;
  try { return new URL(supplied).origin === requestOrigin(req); } catch { return false; }
}

function canonicalProductionRequest(req, env = process.env) {
  // Host is the platform-routed destination. Do not let a forwarded value
  // supplied upstream masquerade as the canonical alias for execution gates.
  const host = String(req.headers?.host || '').split(',')[0].trim().toLowerCase();
  return String(env.VERCEL_ENV || '').trim().toLowerCase() === 'production' && host === 'moremindmap.com';
}

function productionTargetRequest(env = process.env) {
  return String(env.VERCEL_ENV || '').trim().toLowerCase() === 'production';
}

function secureCookie(name, value, maxAge, env = process.env) {
  const secure = env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=${maxAge}`;
}

function clearCookie(name, env = process.env) {
  const secure = env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=0`;
}

function verifiedProfileOwner(req, env = process.env) {
  let audience;
  try { audience = resolveProfileOwnershipAudience(env); }
  catch { return null; }
  return readVerifiedProfileOwnerRequest({
    cookieHeader: req.headers?.cookie,
    signingKey: env.MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_SIGNING_KEY,
    audience,
  });
}

export async function inviteContinuation(service, inviteSessionToken, { executionStore, env = process.env } = {}) {
  let inspected = await service.inspectInviteSession(inviteSessionToken);
  const durableExecutionStore = executionStore === undefined && !syntheticReviewEnabled(env)
    ? new RedisPublicStore(getRedis())
    : executionStore;
  if (durableExecutionStore) {
    await reconcileRecruitingBosStartFromCommittedExecution({
      inspected,
      store: durableExecutionStore,
      service,
    });
    // Re-read after the idempotent repair so a concurrent BOS completion wins
    // and continuation never regresses or projects a stale locator.
    inspected = await service.inspectInviteSession(inviteSessionToken);
  }
  return {
    ...inspected,
    continuation: buildRecruitingInviteContinuation(inspected),
  };
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
  if (/SESSION_REQUIRED|CONSENT_REQUIRED|PREAPPROVAL_REQUIRED|PROFILE_OWNER_RECEIPT_REQUIRED/.test(code)) return 401;
  if (/SCOPE_(?:DENIED|INVALID)|ORIGIN|CSRF|AUTHORITY_REQUIRED|MANAGER_(?:MEMBERSHIP_INACTIVE|SETUP_INCOMPLETE)/.test(code)) return 403;
  if (/NOT_FOUND/.test(code)) return 404;
  if (/EXHAUSTED|REQUIRES_REVIEW|REBIND|RESEND_DENIED|IDEMPOTENCY_IDENTITY_MISMATCH|READINESS_CHANGED_RETRY|PREPARATION_AUTHORITY_CHANGED/.test(code)) return 409;
  if (/INVALID|REQUIRED|DENIED/.test(code)) return 422;
  return 503;
}

async function rotateManagerAndIssueCsrf(service, res, sessionToken, env) {
  const rotated = await service.rotateManagerSession(sessionToken);
  res.setHeader('Set-Cookie', secureCookie(MANAGER_COOKIE, rotated.session_token, 8 * 60 * 60, env));
  return {
    session_token: rotated.session_token,
    csrf_token: await service.issueManagerCsrf(rotated.session_token),
  };
}

async function authenticatedRead(service, res, sessionToken, read, env, onRotate) {
  const auth = await rotateManagerAndIssueCsrf(service, res, sessionToken, env);
  onRotate?.(auth);
  return { ...(await read(auth.session_token)), csrf_token: auth.csrf_token };
}

async function authenticatedMutation(service, req, res, sessionToken, mutate, env, onRotate) {
  await service.consumeManagerCsrf(sessionToken, req.headers?.['x-recruiting-csrf']);
  const result = await mutate(sessionToken);
  const auth = await rotateManagerAndIssueCsrf(service, res, sessionToken, env);
  onRotate?.(auth);
  return { ...result, csrf_token: auth.csrf_token };
}

// Provider-backed preparation can outlive a browser/CDN response. Keep the
// already-authenticated HttpOnly session stable so a lost response can recover
// with a fresh GET, while still consuming and replacing the one-time CSRF.
async function authenticatedResumableMutation(service, req, sessionToken, mutate) {
  await service.consumeManagerCsrf(sessionToken, req.headers?.['x-recruiting-csrf']);
  const result = await mutate(sessionToken);
  return { ...result, csrf_token: await service.issueManagerCsrf(sessionToken) };
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
    },
  };
}

export function createRecruitingHttpHandler({ service: suppliedService = null, env = process.env, candidateProjection = null, generateIntelligence = null, prepareConsultingResults = null, executionStore } = {}) {
  const projection = candidateProjection || (suppliedService
    ? async () => { throw new Error('RECRUITING_INJECTED_PROJECTION_REQUIRED'); }
    : (input) => getCandidateProjection({ ...input, env }));
  const generate = generateIntelligence || (suppliedService
    ? async () => { throw new Error('RECRUITING_INJECTED_INTELLIGENCE_REQUIRED'); }
    : (input) => generateCandidateIntelligence({ ...input, env }));
  const prepare = prepareConsultingResults || (suppliedService
    ? async () => { throw new Error('RECRUITING_INJECTED_CONSULTING_PREPARATION_REQUIRED'); }
    : (input) => getConsultingPreparationCoordinator(env)(input));
  const continuationOptions = { env, executionStore: suppliedService && executionStore === undefined ? null : executionStore };
  return async function recruitingRequest(req, res) {
  setRecruitingHeaders(res);
  if (!recruitingRuntimeEnabled(env)) return res.status(404).json({ ok: false, code: 'NOT_FOUND' });
  if (!sameOrigin(req, true)) return res.status(403).json({ ok: false, code: 'RECRUITING_ORIGIN_DENIED' });
  const parsedCookies = cookies(req.headers?.cookie);
  const managerToken = parsedCookies[MANAGER_COOKIE];
  const inviteToken = parsedCookies[INVITE_COOKIE];
  const setupToken = parsedCookies[SETUP_COOKIE];
  let currentManagerToken = managerToken;
  let recoveryCsrf = null;
  let requestService = null;
  const rotated = (auth) => { currentManagerToken = auth.session_token; recoveryCsrf = auth.csrf_token; };
  try {
    const service = suppliedService || getRecruitingService(env);
    requestService = service;
    const read = (callback) => authenticatedRead(service, res, managerToken, callback, env, rotated);
    const mutate = (callback) => authenticatedMutation(service, req, res, managerToken, callback, env, rotated);
    if (req.method === 'GET') {
      const view = String(req.query?.view || 'session');
      if (view === 'invite_preview') return res.status(200).json({ ok: true, preview: await service.invitationPreview(req.query?.token) });
      if (view === 'manager_setup_preview') return res.status(200).json({ ok: true, preview: await service.managerSetupPreview(req.query?.token) });
      if (view === 'invite_session') {
        const inspected = await inviteContinuation(service, inviteToken, continuationOptions);
        const rotated = await service.rotateInviteSession(inviteToken);
        res.setHeader('Set-Cookie', secureCookie(INVITE_COOKIE, rotated.invite_session_token, 30 * 24 * 60 * 60, env));
        return res.status(200).json({ ok: true, ...inspected });
      }
      if (view === 'session') return res.status(200).json({ ok: true, ...(await read((token) => service.inspectManager(token))) });
      if (view === 'home') return res.status(200).json({ ok: true, ...(await read((token) => service.home(token))) });
      if (view === 'opportunity') return res.status(200).json({ ok: true, ...(await read(async (token) => ({ opportunity: await service.getOpportunity(token) }))) });
      if (view === 'candidate') return res.status(200).json({ ok: true, ...(await read(async (token) => ({ candidate: await projection({ sessionToken: token, candidateId: req.query?.candidate_id }) }))) });
      if (view === 'master_control') return res.status(200).json({ ok: true, ...(await read((token) => service.masterControl(token))) });
      if (view === 'master_control_membership') return res.status(200).json({ ok: true, ...(await read((token) => service.masterControlMembership(token, req.query?.membership_id))) });
      return res.status(400).json({ ok: false, code: 'RECRUITING_VIEW_INVALID' });
    }
    if (req.method === 'DELETE') {
      res.setHeader('Set-Cookie', [clearCookie(MANAGER_COOKIE, env), clearCookie(INVITE_COOKIE, env), clearCookie(SETUP_COOKIE, env)]);
      return res.status(200).json({ ok: true, code: 'RECRUITING_SESSION_CLEARED' });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });
    const action = String(req.body?.action || '');
    if (action === 'REQUEST_MANAGER_VERIFICATION') return res.status(200).json({ ok: true, ...(await deliverQueued(service, await service.requestManagerVerification(req.body?.profile_id))) });
    if (action === 'VERIFY_MANAGER') {
      const verified = await service.verifyManager(req.body?.token);
      res.setHeader('Set-Cookie', secureCookie(MANAGER_COOKIE, verified.session_token, 8 * 60 * 60, env));
      return res.status(200).json({ ok: true, code: 'RECRUITING_MANAGER_VERIFIED', membership: verified.membership });
    }
    if (action === 'BEGIN_MANAGER_SETUP') {
      const started = await service.beginManagerSetup(req.body?.token);
      res.setHeader('Set-Cookie', secureCookie(SETUP_COOKIE, started.setup_session_token, 30 * 60, env));
      return res.status(200).json({ ok: true, code: 'RECRUITING_MANAGER_SETUP_EMAIL_VERIFIED', membership: started.membership, csrf_token: started.csrf_token });
    }
    if (action === 'COMPLETE_MANAGER_SETUP') {
      const completed = await service.completeManagerSetup(setupToken, req.headers?.['x-recruiting-setup-csrf'], req.body?.profile_id);
      res.setHeader('Set-Cookie', [secureCookie(MANAGER_COOKIE, completed.manager_session_token, 8 * 60 * 60, env), clearCookie(SETUP_COOKIE, env)]);
      return res.status(200).json({ ok: true, code: 'RECRUITING_MANAGER_SETUP_COMPLETE', membership: completed.membership });
    }
    if (action === 'ACCEPT_INVITATION') {
      const accepted = await service.acceptInvitation(req.body?.token, req.body?.consent);
      res.setHeader('Set-Cookie', secureCookie(INVITE_COOKIE, accepted.invite_session_token, 30 * 24 * 60 * 60, env));
      return res.status(200).json({ ok: true, code: 'RECRUITING_INVITATION_ACCEPTED', invitation: accepted.invitation });
    }
    if (action === 'CONNECT_OWNED_PROFILE') {
      const owner = verifiedProfileOwner(req, env);
      if (!owner?.profile_id) throw new Error('RECRUITING_PROFILE_OWNER_RECEIPT_REQUIRED');
      if (typeof service.connectOwnedExistingProfile !== 'function') {
        throw new Error('RECRUITING_EXISTING_PROFILE_CONNECTION_UNAVAILABLE');
      }
      await service.connectOwnedExistingProfile(inviteToken, { profile_id: owner.profile_id });
      const rotated = await service.rotateInviteSession(inviteToken);
      const continuation = await inviteContinuation(service, rotated.invite_session_token, continuationOptions);
      res.setHeader('Set-Cookie', secureCookie(INVITE_COOKIE, rotated.invite_session_token, 30 * 24 * 60 * 60, env));
      return res.status(200).json({
        ok: true,
        code: 'RECRUITING_EXISTING_PROFILE_CONNECTED',
        ...continuation,
      });
    }
    if (action === 'CREATE_INVITATION') {
      const created = await mutate((token) =>
        service.createInvitation(token, req.body, req.headers?.['idempotency-key']));
      return res.status(200).json({ ok: true, ...(await deliverQueued(service, created)) });
    }
    if (action === 'RESEND_INVITATION') {
      if (!Number.isInteger(req.body?.expected_resend_count) || req.body.expected_resend_count < 0) throw new Error('RECRUITING_INVITATION_RESEND_REVISION_REQUIRED');
      const resent = await mutate((token) =>
        service.resendInvitation(token, req.body?.invitation_id, { expectedResendCount: req.body.expected_resend_count, idempotencyKey: req.headers?.['idempotency-key'] }));
      return res.status(200).json({ ok: true, ...(await deliverQueued(service, resent)) });
    }
    if (action === 'REQUEST_CURRENT_CONSENT') {
      if (!Number.isInteger(req.body?.expected_generation) || req.body.expected_generation < 0) throw new Error('RECRUITING_CURRENT_CONSENT_REVISION_REQUIRED');
      const requested = await mutate((token) => service.requestCurrentConsent(token, req.body?.invitation_id, {
        expectedGeneration: req.body.expected_generation,
        idempotencyKey: req.headers?.['idempotency-key'],
      }));
      return res.status(200).json({ ok: true, ...(await deliverQueued(service, requested)) });
    }
    if (action === 'REVOKE_INVITATION') return res.status(200).json({ ok: true, ...(await mutate((token) => service.revokeInvitation(token, req.body?.invitation_id))) });
    if (action === 'SAVE_OPPORTUNITY') return res.status(200).json({ ok: true, ...(await mutate(async (token) => ({ opportunity: await service.saveOpportunity(token, req.body?.items) }))) });
    if (action === 'ADD_EVIDENCE') return res.status(200).json({ ok: true, ...(await mutate(async (token) => ({ evidence: await service.addEvidence(token, req.body?.candidate_id, req.body?.evidence) }))) });
    if (action === 'GENERATE_INTELLIGENCE') return res.status(200).json({ ok: true, ...(await mutate(async (token) => ({ intelligence: await generate({ sessionToken: token, candidateId: req.body?.candidate_id }) }))) });
    if (action === 'PREPARE_CONSULTING_RESULTS') {
      const canonicalProduction = canonicalProductionRequest(req, env);
      const preparationExecutionAllowed = miniV2ExecutionAllowed({
        env,
        productionTarget: productionTargetRequest(env),
        canonicalProduction,
      });
      return res.status(200).json({
        ok: true,
        ...(await authenticatedResumableMutation(
          service,
          req,
          managerToken,
          (token) => prepare({
            sessionToken: token,
            candidateId: req.body?.candidate_id,
            allowLegacyDrainStart: canonicalProduction,
            allowBosExecution: preparationExecutionAllowed,
            preparationExecutionAllowed,
          }),
        )),
      });
    }
    if (action === 'RECORD_EXPORT') return res.status(200).json({ ok: true, ...(await mutate(async (token) => ({ code: 'RECRUITING_EXPORT_RECORDED', export: await service.recordExport(token, req.body?.candidate_id, req.body?.mode, req.body?.details_included), synthetic_review: syntheticReviewEnabled(env) }))) });
    if (action === 'ADMIN_CREATE_MANAGER') {
      const created = await mutate((token) => service.createManagerMembership(token, req.body));
      return res.status(200).json({ ok: true, ...(await deliverQueued(service, created)) });
    }
    if (action === 'ADMIN_UPDATE_PENDING_MANAGER') return res.status(200).json({ ok: true, ...(await mutate((token) => service.updatePendingManager(token, req.body?.membership_id, req.body))) });
    if (action === 'ADMIN_RESEND_MANAGER_SETUP') {
      const resent = await mutate((token) => service.resendManagerSetup(token, req.body?.membership_id));
      return res.status(200).json({ ok: true, ...(await deliverQueued(service, resent)) });
    }
    if (action === 'ADMIN_ACTIVATE_MANAGER') return res.status(200).json({ ok: true, ...(await mutate((token) => service.activateManagerMembership(token, req.body?.membership_id))) });
    if (action === 'ADMIN_SUSPEND_MANAGER') return res.status(200).json({ ok: true, ...(await mutate((token) => service.suspendManagerMembership(token, req.body?.membership_id))) });
    if (action === 'ADMIN_REVOKE_MANAGER') return res.status(200).json({ ok: true, ...(await mutate((token) => service.revokeManagerMembership(token, req.body?.membership_id))) });
    return res.status(400).json({ ok: false, code: 'RECRUITING_ACTION_INVALID' });
  } catch (error) {
    const code = String(error?.message || 'RECRUITING_V1_FAILURE').slice(0, 180);
    console.error(JSON.stringify({ event: 'RECRUITING_V1_REQUEST_FAILED', code, raw_payload_logged: false, token_logged: false, email_logged: false }));
    if (!recoveryCsrf && currentManagerToken && requestService) {
      try { recoveryCsrf = await requestService.issueManagerCsrf(currentManagerToken); } catch { recoveryCsrf = null; }
    }
    return res.status(statusFor(error)).json({ ok: false, code, ...(recoveryCsrf ? { csrf_token: recoveryCsrf } : {}) });
  }
  };
}

export async function recruitingHttpHandler(req, res) {
  return createRecruitingHttpHandler()(req, res);
}

export const RECRUITING_HTTP = Object.freeze({ manager_cookie: MANAGER_COOKIE, invite_cookie: INVITE_COOKIE, setup_cookie: SETUP_COOKIE, profile_id_is_credential: false });
