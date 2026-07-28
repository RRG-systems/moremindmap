import {
  getPrivateRuntimeLiveCompositionV2,
  settlePrivateRuntimeLiveOperation,
} from '../../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveComposition.js';

const deny = (res, status = 404) => res.status(status).json({ ok: false, error: 'request_denied' });
const body = (req) => {
  if (typeof req.body !== 'string') return req.body || {};
  try { return JSON.parse(req.body); } catch { return {}; }
};
const headers = (res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
};

export function createPrivateRuntimeLoginHandler({
  beginLogin = null,
  enabled = null,
  compositionAccessor = getPrivateRuntimeLiveCompositionV2,
} = {}) {
  return async function privateRuntimeLoginHandler(req, res) {
    headers(res);
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    if (typeof enabled === 'function' && enabled(req) !== true) return deny(res);
    const composition = typeof beginLogin === 'function' ? null : compositionAccessor();
    const operation = typeof beginLogin === 'function'
      ? beginLogin
      : composition?.operations?.beginLogin;
    if (composition?.configured === false && typeof composition?.describe === 'function') {
      const description = await settlePrivateRuntimeLiveOperation(
        composition.describe.bind(composition),
      );
      if (description.configured !== true) {
        const unconfigured = await settlePrivateRuntimeLiveOperation(operation, [{}, req]);
        return deny(res, unconfigured.status || 404);
      }
    }
    const input = body(req);
    if (typeof input.browser_binding_reference !== 'string'
      || typeof input.correlation_id !== 'string'
      || 'provider' in input
      || 'email' in input
      || 'SUBDEV1' in input) return deny(res, 401);
    const result = await settlePrivateRuntimeLiveOperation(operation, [{
      browser_binding_reference: input.browser_binding_reference,
      correlation_id: input.correlation_id,
    }, req]);
    if (!result?.ok) return deny(res, result?.status || 401);
    const cookies = [];
    if (typeof result.pre_auth_cookie_value === 'string') {
      cookies.push(`__Host-more_session=${result.pre_auth_cookie_value}; Path=/; HttpOnly; Secure; SameSite=Lax`);
    }
    if (typeof result.browser_binding_cookie_value === 'string') {
      cookies.push(`__Host-more_browser_binding=${result.browser_binding_cookie_value}; Path=/; HttpOnly; Secure; SameSite=Lax`);
    }
    if (typeof result.transaction_cookie_value === 'string') {
      cookies.push(`__Host-more_oidc_transaction=${result.transaction_cookie_value}; Path=/; HttpOnly; Secure; SameSite=Lax`);
    }
    if (cookies.length) {
      res.setHeader('Set-Cookie', cookies);
    }
    return res.status(200).json({
      ok: true,
      login_reference: result.login_reference || result.pre_auth_session_ref,
      expires_at: result.expires_at,
      authorization_url: result.authorization_url || null,
    });
  };
}

export default createPrivateRuntimeLoginHandler();
