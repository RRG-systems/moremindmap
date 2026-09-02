import {
  authenticateInternalDevRequest,
  getSubscriptionRedis,
  internalDevEnabled,
  sameOriginRequest,
  setNoStore,
} from '../engine/subscriptionV1/internalDevInfrastructure.js';

function send(res, status, body) {
  setNoStore(res);
  return res.status(status).json(body);
}

export function createSubscriptionDemoSubjectHandler({
  getRedis = getSubscriptionRedis,
  enabled = internalDevEnabled,
  authenticate = authenticateInternalDevRequest,
} = {}) {
  return async function retiredSubscriptionDemoSubjectHandler(req, res) {
    if (!enabled()) return send(res, 404, { ok: false, code: 'SUBSCRIPTION_V1_INTERNAL_DEV_DEFAULT_OFF' });
    if (!sameOriginRequest(req, { allowMissingForGet: true })) {
      return send(res, 403, { ok: false, code: 'SUBSCRIPTION_V1_ORIGIN_DENIED' });
    }
    const auth = await authenticate({ redis: getRedis(), req });
    if (!auth.ok) return send(res, auth.status, { ok: false, code: auth.code });
    return send(res, 410, { ok: false, code: 'SUBSCRIPTION_DEMO_SUBJECT_SWITCH_RETIRED' });
  };
}

export default createSubscriptionDemoSubjectHandler();
