/* global process */

import {
  authenticateRecruitingDemoRequest,
  consumeRecruitingDemoCsrf,
  issueRecruitingDemoCsrf,
} from '../engine/leadershipDemo/authority.js';
import { getRecruitingRedis } from '../engine/recruitingV1/redisStore.js';
import { getRecruitingGuV1DemoRuntime } from '../engine/recruitingGuV1/demoRuntime.js';
import { publicRecruitingGuPayload } from '../../src/lib/recruitingGuV1/publicPayload.js';

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
  if (/STALE|COMPLETED/.test(code)) return 409;
  if (/NOT_FOUND/.test(code)) return 404;
  if (/INVALID|REQUIRED|REFUSED|DENIED/.test(code)) return 422;
  return 503;
}

export function createRecruitingGuV1DemoHandler({
  env = process.env,
  authenticate = async (req) => authenticateRecruitingDemoRequest({ redis: getRecruitingRedis(env), req }),
  runtime = null,
  } = {}) {
  let activeRuntime = runtime;
  const getRuntime = () => {
    if (!activeRuntime) activeRuntime = getRecruitingGuV1DemoRuntime({ openAiApiKey: env.OPENAI_API_KEY, redis: getRecruitingRedis(env), env });
    return activeRuntime;
  };
  return async function recruitingGuV1DemoHandler(req, res) {
    headers(res);
    if (env.RECRUITING_GU_V1_ENABLED !== 'true' && env.RECRUITING_GU_V1_LOCAL_DEMO !== 'true') return res.status(404).json({ ok: false, code: 'NOT_FOUND' });
    if (!sameOrigin(req, true)) return res.status(403).json({ ok: false, code: 'RECRUITING_GU_V1_ORIGIN_DENIED' });
    let activeScope = null;
    try {
      const auth = await authenticate(req);
      if (!auth?.ok) return res.status(auth?.status || 401).json({ ok: false, code: auth?.code || 'RECRUITING_DEMO_CAPABILITY_REQUIRED' });
      const scope = auth.capability_hash || auth.capability?.demo_scope_id || 'local-synthetic-darren';
      const redis = getRecruitingRedis(env);
      activeScope = scope;
      if (req.method === 'GET') {
        const view = String(req.query?.view || 'home');
        const csrf_token = await issueRecruitingDemoCsrf({ redis, capabilityHash: scope });
        if (view === 'home') return res.status(200).json({ ok: true, ...publicRecruitingGuPayload(await getRuntime().home({ standard: String(req.query?.home_mode || '') === 'standard' })), csrf_token });
        if (view === 'session') return res.status(200).json({ ok: true, session: publicRecruitingGuPayload(await getRuntime().read(String(req.query?.session_id || ''))), csrf_token });
        return res.status(400).json({ ok: false, code: 'RECRUITING_GU_V1_VIEW_INVALID' });
      }
      if (req.method !== 'POST') return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });
      if (!await consumeRecruitingDemoCsrf({ redis, capabilityHash: scope, proof: req.headers?.['x-recruiting-gu-v1-csrf'] })) return res.status(403).json({ ok: false, code: 'RECRUITING_GU_V1_CSRF_DENIED' });
      const action = String(req.body?.action || '');
      let payload;
      if (action === 'OPEN_SYNTHETIC_DEMO') payload = await getRuntime().open();
      else if (action === 'OPEN_EXPERIMENT_SUBJECT') payload = await getRuntime().openSubject(String(req.body?.subject || ''));
      else if (action === 'OPEN_CANDIDATE') payload = await getRuntime().openCandidate(req.body?.candidate_id);
      else if (action === 'REQUEST_MORE_ID') payload = await getRuntime().requestMoreId(req.body?.profile_id);
      else if (action === 'RESET_SYNTHETIC_DEMO') payload = await getRuntime().reset(req.body?.subject || null);
      else payload = await getRuntime().mutate(String(req.body?.session_id || ''), action, req.body || {});
      return res.status(200).json({
        ok: true,
        ...publicRecruitingGuPayload(payload),
        csrf_token: await issueRecruitingDemoCsrf({ redis, capabilityHash: scope }),
        synthetic_only: payload?.session?.synthetic_only ?? true,
        experiment_only: true,
      });
    } catch (error) {
      const code = String(error?.message || 'RECRUITING_GU_V1_DEMO_FAILURE').slice(0, 180);
      console.error(JSON.stringify({
        event: 'RECRUITING_GU_V1_DEMO_REQUEST_FAILED',
        code,
        validation_errors: Array.isArray(error?.validationErrors) ? error.validationErrors.slice(0, 24) : [],
        attempts: Number.isInteger(error?.attempts) ? error.attempts : null,
        raw_payload_logged: false,
        token_logged: false,
        customer_data_logged: false,
      }));
      return res.status(statusFor(code)).json({
        ok: false,
        code,
        current_revision: error?.current_revision || null,
        ...(activeScope && !/CSRF/u.test(code) ? { csrf_token: await issueRecruitingDemoCsrf({ redis: getRecruitingRedis(env), capabilityHash: activeScope }) } : {}),
      });
    }
  };
}

export default createRecruitingGuV1DemoHandler();
