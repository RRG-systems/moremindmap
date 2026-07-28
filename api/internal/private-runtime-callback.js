const applyHeaders = (res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
};
const deny = (res, status = 404) => res.status(status).json({ ok: false, error: 'request_denied' });

export function createPrivateRuntimeCallbackHandler({
  completeLogin = null,
  enabled = null,
  compositionAccessor = getPrivateRuntimeLiveCompositionV2,
} = {}) {
  return async function privateRuntimeCallbackHandler(req, res) {
    applyHeaders(res);
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }
    if (typeof enabled === 'function' && enabled(req) !== true) return deny(res);
    const operation = typeof completeLogin === 'function'
      ? completeLogin
      : compositionAccessor()?.operations?.completeLogin;
    const result = await settlePrivateRuntimeLiveOperation(operation, [req]);
    const sessionCookie = typeof result?.session_cookie === 'string'
      ? result.session_cookie
      : typeof result?.session_cookie_value === 'string'
        ? `__Host-more_session=${result.session_cookie_value}; Path=/; HttpOnly; Secure; SameSite=Lax`
        : null;
    if (!result?.ok
      || typeof sessionCookie !== 'string'
      || result.raw_assertion_present === true
      || result.raw_token_persisted === true) return deny(res, result?.status || 401);
    res.setHeader('Set-Cookie', [
      sessionCookie,
      '__Host-more_oidc_transaction=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    ]);
    return res.status(200).json({
      ok: true,
      authenticated: true,
      session_receipt: result.session_receipt
        || result.canonical_subject?.receipt_ref
        || result.audit_receipt_ref,
      entitlement_active: false,
    });
  };
}

export default createPrivateRuntimeCallbackHandler();
import {
  getPrivateRuntimeLiveCompositionV2,
  settlePrivateRuntimeLiveOperation,
} from '../../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveComposition.js';
