const applyHeaders = (res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
};
const deny = (res, status = 404) => res.status(status).json({ ok: false, error: 'request_denied' });

export function createPrivateRuntimeCallbackHandler({
  completeLogin = null,
  enabled = () => false,
} = {}) {
  return async function privateRuntimeCallbackHandler(req, res) {
    applyHeaders(res);
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    if (!enabled(req) || typeof completeLogin !== 'function') return deny(res);
    const result = await completeLogin(req);
    if (!result?.ok
      || typeof result.session_cookie !== 'string'
      || result.raw_assertion_present === true
      || result.raw_token_persisted === true) return deny(res, result?.status || 401);
    res.setHeader('Set-Cookie', result.session_cookie);
    return res.status(200).json({
      ok: true,
      authenticated: true,
      session_receipt: result.session_receipt,
      entitlement_active: false,
    });
  };
}

export default createPrivateRuntimeCallbackHandler();
