const clearSessionCookie = '__Host-more_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
const clearCapabilityCookie = '__Host-coach_connect_dev_capability=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
const applyHeaders = (res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
};

export function createPrivateRuntimeLogoutHandler({
  logout = null,
  enabled = () => false,
} = {}) {
  return async function privateRuntimeLogoutHandler(req, res) {
    applyHeaders(res);
    if (req.method !== 'POST' && req.method !== 'DELETE') {
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }
    if (!enabled(req) || typeof logout !== 'function') {
      return res.status(404).json({ ok: false, error: 'request_denied' });
    }
    const result = await logout(req);
    if (!result?.ok) return res.status(result?.status || 401).json({ ok: false, error: 'request_denied' });
    res.setHeader('Set-Cookie', [clearSessionCookie, clearCapabilityCookie]);
    return res.status(200).json({
      ok: true,
      logged_out: true,
      capability_revoked: result.receipt?.capability_revoked === true,
      session_revoked: result.receipt?.session_revoked === true,
      runtime_detached: result.receipt?.runtime_handles_detached === true,
    });
  };
}

export default createPrivateRuntimeLogoutHandler();
