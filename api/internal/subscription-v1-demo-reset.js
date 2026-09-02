import {
  authenticateInternalDevRequest,
  consumeDemoResetCsrf,
  getSubscriptionRedis,
  internalDevEnabled,
  issueDemoResetCsrf,
  resetInternalDevSyntheticDemo,
  sameOriginRequest,
  setNoStore,
} from '../engine/subscriptionV1/internalDevInfrastructure.js';
import { hasDarrenDemoAuthority } from '../engine/subscriptionS2/demoSubjectAuthority.js';

function send(res, status, body) {
  setNoStore(res);
  return res.status(status).json(body);
}

export function createSubscriptionDemoResetHandler({
  getRedis = getSubscriptionRedis,
  enabled = internalDevEnabled,
  authenticate = authenticateInternalDevRequest,
} = {}) {
  return async function subscriptionDemoResetHandler(req, res) {
    if (!enabled()) return send(res, 404, { ok: false, code: 'SUBSCRIPTION_V1_INTERNAL_DEV_DEFAULT_OFF' });
    const redis = getRedis();
    try {
      if (!sameOriginRequest(req, { allowMissingForGet: true })) {
        return send(res, 403, { ok: false, code: 'SUBSCRIPTION_V1_ORIGIN_DENIED' });
      }
      const auth = await authenticate({ redis, req });
      if (!auth.ok) return send(res, auth.status, { ok: false, code: auth.code });
      if (!hasDarrenDemoAuthority(auth.capability)
        || auth.capability.demo_reset_enabled !== true
        || auth.demo_subject !== 'synthetic') {
        return send(res, 403, { ok: false, code: 'SUBSCRIPTION_DEMO_RESET_AUTHORITY_DENIED' });
      }
      if (req.method === 'GET') {
        const csrf_token = await issueDemoResetCsrf({ redis, capabilityHash: auth.capability_hash });
        return send(res, 200, { ok: true, code: 'SUBSCRIPTION_DEMO_RESET_READY', csrf_token, demo_subject: 'synthetic' });
      }
      if (req.method !== 'POST') return send(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
      const csrfOk = await consumeDemoResetCsrf({
        redis,
        capabilityHash: auth.capability_hash,
        proof: req.headers?.['x-subscription-demo-reset-csrf'],
      });
      if (!csrfOk) return send(res, 403, { ok: false, code: 'SUBSCRIPTION_DEMO_RESET_CSRF_DENIED' });
      const reset = await resetInternalDevSyntheticDemo({ redis, capability: auth.capability });
      if (!reset.ok) return send(res, 409, { ok: false, code: reset.code });
      return send(res, 200, reset);
    } catch (error) {
      console.error(JSON.stringify({
        event: 'SUBSCRIPTION_DEMO_RESET_FAILURE',
        code: String(error?.message || 'UNKNOWN').slice(0, 160),
        raw_payload_logged: false,
        token_logged: false,
        profile_id_logged: false,
      }));
      return send(res, 503, { ok: false, code: 'SUBSCRIPTION_DEMO_RESET_UNAVAILABLE' });
    }
  };
}

export default createSubscriptionDemoResetHandler();
