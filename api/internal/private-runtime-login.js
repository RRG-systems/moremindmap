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
  enabled = () => false,
} = {}) {
  return async function privateRuntimeLoginHandler(req, res) {
    headers(res);
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    if (!enabled(req) || typeof beginLogin !== 'function') return deny(res);
    const input = body(req);
    if (typeof input.browser_binding_reference !== 'string'
      || typeof input.correlation_id !== 'string'
      || 'provider' in input
      || 'email' in input
      || 'SUBDEV1' in input) return deny(res, 401);
    const result = await beginLogin({
      browser_binding_reference: input.browser_binding_reference,
      correlation_id: input.correlation_id,
    });
    return result?.ok
      ? res.status(200).json({
        ok: true,
        login_reference: result.login_reference,
        expires_at: result.expires_at,
      })
      : deny(res, result?.status || 401);
  };
}

export default createPrivateRuntimeLoginHandler();
