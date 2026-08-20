import {
  clearInternalDevCookies,
  consumeEntryCsrf,
  enforceEntryRateLimit,
  exactJordanCode,
  getSubscriptionRedis,
  internalDevEnabled,
  issueEntryCsrf,
  issueInternalDevCapability,
  sameOriginRequest,
  setNoStore,
} from '../engine/subscriptionV1/internalDevInfrastructure.js';

function send(res, status, body) {
  setNoStore(res);
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (!internalDevEnabled()) return send(res, 404, { ok: false, code: 'SUBSCRIPTION_V1_INTERNAL_DEV_DEFAULT_OFF' });
  const redis = getSubscriptionRedis();
  try {
    if (req.method === 'GET') {
      if (!sameOriginRequest(req, { allowMissingForGet: true })) return send(res, 403, { ok: false, code: 'SUBSCRIPTION_V1_ORIGIN_DENIED' });
      const csrf_token = await issueEntryCsrf({ redis, req });
      return send(res, 200, { ok: true, code: 'SUBSCRIPTION_V1_INTERNAL_ENTRY_READY', csrf_token, synthetic_only: true });
    }
    if (req.method === 'DELETE') {
      res.setHeader('Set-Cookie', clearInternalDevCookies());
      return send(res, 200, { ok: true, code: 'SUBSCRIPTION_V1_INTERNAL_SESSION_CLEARED' });
    }
    if (req.method !== 'POST') return send(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
    if (!sameOriginRequest(req)) return send(res, 403, { ok: false, code: 'SUBSCRIPTION_V1_ORIGIN_DENIED' });
    const csrfOk = await consumeEntryCsrf({ redis, req, proof: req.headers?.['x-subscription-entry-csrf'] });
    if (!csrfOk) return send(res, 403, { ok: false, code: 'SUBSCRIPTION_V1_ENTRY_CSRF_DENIED' });
    const rate = await enforceEntryRateLimit({ redis, req });
    if (!rate.allowed) return send(res, 429, { ok: false, code: 'SUBSCRIPTION_V1_ENTRY_RATE_LIMITED' });
    if (!exactJordanCode(req.body?.access_code)) return send(res, 401, { ok: false, code: 'SUBSCRIPTION_V1_INTERNAL_CODE_INVALID' });
    const issued = await issueInternalDevCapability({ redis, req });
    res.setHeader('Set-Cookie', issued.cookies);
    return send(res, 200, {
      ok: true,
      code: 'SUBSCRIPTION_V1_INTERNAL_ENTITLEMENT_ISSUED',
      redirect_to: '/subscription',
      synthetic_profile: 'Jordan',
      synthetic_only: true,
      billing_evidence: false,
      stripe_mutation: false,
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'SUBSCRIPTION_V1_INTERNAL_ENTRY_FAILURE', code: error?.message || 'UNKNOWN', raw_payload_logged: false }));
    return send(res, 503, { ok: false, code: 'SUBSCRIPTION_V1_INTERNAL_ENTRY_UNAVAILABLE' });
  }
}
