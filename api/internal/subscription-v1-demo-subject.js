import {
  authenticateInternalDevRequest,
  consumeDemoSubjectSwitchCsrf,
  getSubscriptionRedis,
  internalDevEnabled,
  issueDemoSubjectSwitchCsrf,
  sameOriginRequest,
  setNoStore,
  switchInternalDevDemoSubject,
} from '../engine/subscriptionV1/internalDevInfrastructure.js';
import {
  SUBSCRIPTION_DEMO_SUBJECT_IDS,
  hasDarrenDemoSubjectAuthority,
} from '../engine/subscriptionS2/demoSubjectAuthority.js';

function send(res, status, body) {
  setNoStore(res);
  return res.status(status).json(body);
}

export function createSubscriptionDemoSubjectHandler({
  getRedis = getSubscriptionRedis,
  enabled = internalDevEnabled,
  authenticate = authenticateInternalDevRequest,
} = {}) {
  return async function subscriptionDemoSubjectHandler(req, res) {
    if (!enabled()) return send(res, 404, { ok: false, code: 'SUBSCRIPTION_V1_INTERNAL_DEV_DEFAULT_OFF' });
    const redis = getRedis();
    try {
      if (!sameOriginRequest(req, { allowMissingForGet: true })) {
        return send(res, 403, { ok: false, code: 'SUBSCRIPTION_V1_ORIGIN_DENIED' });
      }
      const auth = await authenticate({ redis, req });
      if (!auth.ok) return send(res, auth.status, { ok: false, code: auth.code });
      if (!hasDarrenDemoSubjectAuthority(auth.capability)) {
        return send(res, 403, { ok: false, code: 'SUBSCRIPTION_DEMO_SUBJECT_AUTHORITY_DENIED' });
      }
      if (req.method === 'GET') {
        const csrf_token = await issueDemoSubjectSwitchCsrf({ redis, capabilityHash: auth.capability_hash });
        return send(res, 200, {
          ok: true,
          code: 'SUBSCRIPTION_DEMO_SUBJECT_SWITCH_READY',
          csrf_token,
          selected_subject: auth.demo_subject,
          allowed_subjects: [...SUBSCRIPTION_DEMO_SUBJECT_IDS],
        });
      }
      if (req.method !== 'POST') return send(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
      const csrfOk = await consumeDemoSubjectSwitchCsrf({
        redis,
        capabilityHash: auth.capability_hash,
        proof: req.headers?.['x-subscription-demo-subject-csrf'],
      });
      if (!csrfOk) return send(res, 403, { ok: false, code: 'SUBSCRIPTION_DEMO_SUBJECT_CSRF_DENIED' });
      const switched = await switchInternalDevDemoSubject({
        redis,
        capability: auth.capability,
        capabilityHash: auth.capability_hash,
        selection: String(req.body?.subject || ''),
      });
      if (!switched.ok) {
        const status = switched.code === 'SUBSCRIPTION_DEMO_SUBJECT_UNSUPPORTED' ? 400 : 409;
        return send(res, status, { ok: false, code: switched.code });
      }
      return send(res, 200, {
        ok: true,
        code: 'SUBSCRIPTION_DEMO_SUBJECT_AUTHORITY_UPDATED',
        selected_subject: switched.selection,
        synthetic_only: true,
        canonical_customer_write_authority: false,
      });
    } catch (error) {
      console.error(JSON.stringify({
        event: 'SUBSCRIPTION_DEMO_SUBJECT_SWITCH_FAILURE',
        code: String(error?.message || 'UNKNOWN').slice(0, 160),
        raw_payload_logged: false,
        token_logged: false,
        profile_id_logged: false,
      }));
      return send(res, 503, { ok: false, code: 'SUBSCRIPTION_DEMO_SUBJECT_SWITCH_UNAVAILABLE' });
    }
  };
}

export default createSubscriptionDemoSubjectHandler();
