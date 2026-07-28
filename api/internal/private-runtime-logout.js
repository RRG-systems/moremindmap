const clearSessionCookie = '__Host-more_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
const clearCapabilityCookie = '__Host-coach_connect_dev_capability=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
const applyHeaders = (res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
};

export function createPrivateRuntimeLogoutHandler({
  logout = null,
  enabled = null,
  compositionAccessor = getPrivateRuntimeLiveCompositionV2,
} = {}) {
  return async function privateRuntimeLogoutHandler(req, res) {
    applyHeaders(res);
    if (req.method !== 'POST' && req.method !== 'DELETE') {
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }
    if (typeof enabled === 'function' && enabled(req) !== true) {
      return res.status(404).json({ ok: false, error: 'request_denied' });
    }
    const operation = typeof logout === 'function'
      ? logout
      : compositionAccessor()?.operations?.logout;
    const result = await settlePrivateRuntimeLiveOperation(operation, [req]);
    res.setHeader('Set-Cookie', [clearSessionCookie, clearCapabilityCookie]);
    if (!result?.ok) return res.status(result?.status || 401).json({ ok: false, error: 'request_denied' });
    return res.status(200).json({
      ok: true,
      logged_out: true,
      capability_revoked: result.receipt?.capability_revoked === true
        || result.entitlement_revoked === true
        || result.server_revocation_confirmed === true,
      session_revoked: result.receipt?.session_revoked === true
        || result.server_revocation_confirmed === true,
      runtime_detached: result.receipt?.runtime_handles_detached === true
        || result.runtime_handles_detached === true,
    });
  };
}

export default createPrivateRuntimeLogoutHandler();
import {
  getPrivateRuntimeLiveCompositionV2,
  settlePrivateRuntimeLiveOperation,
} from '../../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveComposition.js';
