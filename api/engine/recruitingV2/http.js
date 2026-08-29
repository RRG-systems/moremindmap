/* global process */

import { createSharedBusinessSession } from '../../../src/lib/recruitingV2/session.js';
import { createRecruitingV2FrontierRuntime } from './frontierRuntime.js';

export function recruitingV2ExperimentEnabled(env = process.env) {
  return env.RECRUITING_V2_EXPERIMENT_003A_ENABLED === 'true' && env.RECRUITING_V2_SYNTHETIC_REVIEW === 'true';
}

function send(res, status, body) {
  res.status(status);
  res.setHeader('cache-control', 'no-store');
  res.setHeader('content-type', 'application/json; charset=utf-8');
  return res.json(body);
}

function sanitizedError(error) {
  const allowed = new Set([
    'RECRUITING_V2_PURPOSE_REQUIRED', 'RECRUITING_V2_PURPOSE_TOO_LONG', 'RECRUITING_V2_SESSION_CONTEXT_INVALID',
    'RECRUITING_V2_SESSION_SCOPE_DENIED', 'RECRUITING_V2_SESSION_REVISION_INVALID',
    'RECRUITING_V2_FRONTIER_PROVIDER_BINDING_REQUIRED', 'RECRUITING_V2_FRONTIER_PROVIDER_FAILED',
    'RECRUITING_V2_FRONTIER_EMPTY', 'RECRUITING_V2_FRONTIER_NON_JSON', 'RECRUITING_V2_FRONTIER_PLAN_FAILED_CLOSED',
  ]);
  return allowed.has(error?.code || error?.message) ? (error.code || error.message) : 'RECRUITING_V2_REQUEST_FAILED';
}

export function createRecruitingV2HttpHandler({ env = process.env, runtime = null } = {}) {
  let resolvedRuntime = runtime;
  const getRuntime = () => {
    if (!resolvedRuntime) resolvedRuntime = createRecruitingV2FrontierRuntime({ apiKey: env.OPENROUTER_API_KEY });
    return resolvedRuntime;
  };
  return async function recruitingV2HttpHandler(req, res) {
    if (!recruitingV2ExperimentEnabled(env)) return send(res, 404, { ok: false, code: 'NOT_FOUND' });
    if (req.method === 'GET') {
      const active = getRuntime();
      return send(res, 200, {
        ok: true, contract: 'recruiting_v2_experiment_003a_baseline_v1', syntheticOnly: true,
        world: active.world, worldHash: active.worldHash, session: createSharedBusinessSession(), modelConfig: active.modelConfig,
      });
    }
    if (req.method !== 'POST') return send(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
    if (req.headers['x-more-recruiting-v2-synthetic'] !== 'darren-jordan-003a') return send(res, 403, { ok: false, code: 'SYNTHETIC_BINDING_REQUIRED' });
    if (req.body?.action !== 'PLAN_SURFACE') return send(res, 400, { ok: false, code: 'ACTION_INVALID' });
    try {
      const result = await getRuntime().planSurface({ purpose: req.body.purpose, sessionContext: req.body.sessionContext });
      return send(res, 200, { ok: true, syntheticOnly: true, ...result });
    } catch (error) {
      return send(res, 422, {
        ok: false, code: sanitizedError(error), validationErrors: Array.isArray(error?.validationErrors) ? error.validationErrors.slice(0, 20) : [],
        providerStatus: error?.sanitizedProviderStatus || null, rawPayloadLogged: false, secretLogged: false,
      });
    }
  };
}
