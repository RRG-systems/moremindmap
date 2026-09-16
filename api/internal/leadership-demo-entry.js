/* global process */

import {
  authenticateLeadershipLauncher,
  athleteConsultingDarrenDemoEnabled,
  clearLeadershipDemoCookies,
  consumeLeadershipEntryCsrf,
  consumeLeadershipLauncherCsrf,
  enforceLeadershipEntryRateLimit,
  enforceLeadershipLaunchRateLimit,
  exactLeadershipDemoCode,
  issueLeadershipEntryCsrf,
  issueLeadershipLauncherCapability,
  issueLeadershipLauncherCsrf,
  issueAthleteConsultingDemoCapability,
  issueRecruitingDemoCapability,
  leadershipDemoEnabled,
  sameOriginLeadershipDemoRequest,
  setLeadershipDemoNoStore,
} from '../engine/leadershipDemo/authority.js';
import {
  getSubscriptionRedis,
  internalDevEnabled,
  issueInternalDevCapability,
} from '../engine/subscriptionV1/internalDevInfrastructure.js';

function send(res, status, body) {
  setLeadershipDemoNoStore(res);
  return res.status(status).json(body);
}

export default async function leadershipDemoEntryHandler(req, res) {
  if (!leadershipDemoEnabled(process.env)) return send(res, 404, { ok: false, code: 'LEADERSHIP_DEMO_DEFAULT_OFF' });
  const redis = getSubscriptionRedis(process.env);
  try {
    if (req.method === 'GET') {
      if (!sameOriginLeadershipDemoRequest(req, { allowMissingForGet: true })) {
        return send(res, 403, { ok: false, code: 'LEADERSHIP_DEMO_ORIGIN_DENIED' });
      }
      if (String(req.query?.view || '') === 'launcher') {
        const auth = await authenticateLeadershipLauncher({ redis, req });
        if (!auth.ok) return send(res, auth.status, { ok: false, code: auth.code });
        const csrf_token = await issueLeadershipLauncherCsrf({ redis, capabilityHash: auth.capability_hash });
        return send(res, 200, {
          ok: true,
          code: 'LEADERSHIP_DEMO_LAUNCHER_READY',
          csrf_token,
          synthetic_only: true,
          choices: [
            { id: 'recruiting', title: 'CONSULTING DEMONSTRATION' },
            { id: 'subscription-model-1', title: 'SUBSCRIPTION MODEL 1' },
            { id: 'subscription-model-2', title: 'SUBSCRIPTION MODEL 2' },
            ...(athleteConsultingDarrenDemoEnabled(process.env)
              && auth.capability.allowed_products?.includes('athlete-consulting-tool')
              ? [{ id: 'athlete-consulting-tool', ...(process.env.ATHLETE_CONSULTING_V2_ENABLED === 'true'
                ? { title: 'ATHLETE CONSULTING TOOL V2', version: 2 }
                : { title: 'ATHLETE CONSULTING TOOL' }) }]
              : []),
          ],
        });
      }
      const csrf_token = await issueLeadershipEntryCsrf({ redis, req });
      return send(res, 200, { ok: true, code: 'LEADERSHIP_DEMO_ENTRY_READY', csrf_token });
    }

    if (req.method === 'DELETE') {
      res.setHeader('Set-Cookie', clearLeadershipDemoCookies());
      return send(res, 200, { ok: true, code: 'LEADERSHIP_DEMO_SESSION_CLEARED' });
    }

    if (req.method !== 'POST') return send(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
    if (!sameOriginLeadershipDemoRequest(req)) return send(res, 403, { ok: false, code: 'LEADERSHIP_DEMO_ORIGIN_DENIED' });

    const action = String(req.body?.action || '');
    if (action === 'ENTER') {
      const csrfOk = await consumeLeadershipEntryCsrf({ redis, req, proof: req.headers?.['x-leadership-demo-entry-csrf'] });
      if (!csrfOk) return send(res, 403, { ok: false, code: 'LEADERSHIP_DEMO_ENTRY_CSRF_DENIED' });
      const rate = await enforceLeadershipEntryRateLimit({ redis, req });
      if (!rate.allowed) return send(res, 429, { ok: false, code: 'LEADERSHIP_DEMO_ENTRY_RATE_LIMITED' });
      if (!exactLeadershipDemoCode(req.body?.access_code, process.env)) {
        return send(res, 401, { ok: false, code: 'LEADERSHIP_DEMO_CODE_INVALID' });
      }
      const issued = await issueLeadershipLauncherCapability({ redis, req, env: process.env });
      res.setHeader('Set-Cookie', issued.cookie);
      return send(res, 200, {
        ok: true,
        code: 'LEADERSHIP_DEMO_LAUNCHER_ISSUED',
        redirect_to: '/leadership-demo',
        synthetic_only: true,
      });
    }

    const auth = await authenticateLeadershipLauncher({ redis, req });
    if (!auth.ok) return send(res, auth.status, { ok: false, code: auth.code });
    const csrfOk = await consumeLeadershipLauncherCsrf({
      redis,
      capabilityHash: auth.capability_hash,
      proof: req.headers?.['x-leadership-demo-launch-csrf'],
    });
    if (!csrfOk) return send(res, 403, { ok: false, code: 'LEADERSHIP_DEMO_LAUNCH_CSRF_DENIED' });
    const rate = await enforceLeadershipLaunchRateLimit({ redis, capabilityHash: auth.capability_hash });
    if (!rate.allowed) return send(res, 429, { ok: false, code: 'LEADERSHIP_DEMO_LAUNCH_RATE_LIMITED' });

    if (action === 'LAUNCH_RECRUITING') {
      const issued = await issueRecruitingDemoCapability({ redis, req, launcher: auth.capability });
      res.setHeader('Set-Cookie', issued.cookie);
      return send(res, 200, {
        ok: true,
        code: 'LEADERSHIP_DEMO_RECRUITING_CAPABILITY_ISSUED',
        redirect_to: '/recruiting-gu-v1/demo',
        synthetic_only: true,
      });
    }

    if (action === 'LAUNCH_ATHLETE_CONSULTING_TOOL') {
      if (!athleteConsultingDarrenDemoEnabled(process.env)) {
        return send(res, 404, { ok: false, code: 'ATHLETE_CONSULTING_DEMO_DEFAULT_OFF' });
      }
      const issued = await issueAthleteConsultingDemoCapability({
        redis,
        req,
        launcher: auth.capability,
        env: process.env,
      });
      res.setHeader('Set-Cookie', issued.cookie);
      return send(res, 200, {
        ok: true,
        code: 'LEADERSHIP_DEMO_ATHLETE_CONSULTING_CAPABILITY_ISSUED',
        redirect_to: '/athlete-consulting-tool/demo',
        synthetic_only: true,
      });
    }

    const blindDemoSelection = action === 'LAUNCH_SUBSCRIPTION_MODEL_1' ? '1'
      : action === 'LAUNCH_SUBSCRIPTION_MODEL_2' ? '2' : null;
    if (blindDemoSelection) {
      if (!internalDevEnabled(process.env)) return send(res, 404, { ok: false, code: 'SUBSCRIPTION_V1_INTERNAL_DEV_DEFAULT_OFF' });
      const issued = await issueInternalDevCapability({ redis, req, launcher: auth.capability, blindDemoSelection });
      res.setHeader('Set-Cookie', issued.cookies);
      return send(res, 200, {
        ok: true,
        code: 'LEADERSHIP_DEMO_SUBSCRIPTION_CAPABILITY_ISSUED',
        redirect_to: '/subscription',
        synthetic_profile: 'Jordan',
        synthetic_only: true,
        billing_evidence: false,
        stripe_mutation: false,
      });
    }

    return send(res, 400, { ok: false, code: 'LEADERSHIP_DEMO_ACTION_INVALID' });
  } catch (error) {
    const code = String(error?.message || 'LEADERSHIP_DEMO_FAILURE').slice(0, 180);
    console.error(JSON.stringify({ event: 'LEADERSHIP_DEMO_ENTRY_FAILURE', code, raw_payload_logged: false, token_logged: false }));
    return send(res, 503, { ok: false, code: 'LEADERSHIP_DEMO_UNAVAILABLE' });
  }
}
