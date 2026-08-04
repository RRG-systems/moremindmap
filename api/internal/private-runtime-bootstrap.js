const forbiddenKeys = new Set([
  'token',
  'cookie',
  'access_code',
  'email',
  'name',
  'raw_assertion',
  'business_engine_contract',
  'private_content',
]);
const containsForbidden = (value) => {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsForbidden);
  return Object.entries(value).some(([key, child]) => forbiddenKeys.has(key) || containsForbidden(child));
};
const applyHeaders = (res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
};

export function createPrivateRuntimeBootstrapHandler({
  bootstrap = null,
  enabled = null,
  compositionAccessor = getPrivateRuntimeLiveCompositionV2,
} = {}) {
  return async function privateRuntimeBootstrapHandler(req, res) {
    applyHeaders(res);
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    if (typeof enabled === 'function' && enabled(req) !== true) {
      return res.status(404).json({ ok: false, error: 'request_denied' });
    }
    const operation = typeof bootstrap === 'function'
      ? bootstrap
      : compositionAccessor()?.operations?.bootstrap;
    const result = await settlePrivateRuntimeLiveOperation(operation, [req]);
    if (!result?.ok || containsForbidden(result)) {
      return res.status(result?.status || 403).json({ ok: false, error: 'request_denied' });
    }
    return res.status(200).json({
      ok: true,
      runtime_ready: result.runtime_ready === true,
      attachment_set: result.attachment_set,
      business_engine_attachment: result.business_engine_attachment,
      subscription_runtime_attachment: result.subscription_runtime_attachment,
      coach_connect_attachment: result.coach_connect_attachment || null,
      projections: result.projections || null,
      conversation: result.conversation || null,
    });
  };
}

export default createPrivateRuntimeBootstrapHandler();
import {
  getPrivateRuntimeLiveCompositionV2,
  settlePrivateRuntimeLiveOperation,
} from '../../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveComposition.js';
