const applyHeaders = (res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
};

export function createPrivateRuntimeSessionHandler({
  inspectSession = null,
  enabled = () => false,
} = {}) {
  return async function privateRuntimeSessionHandler(req, res) {
    applyHeaders(res);
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    if (!enabled(req) || typeof inspectSession !== 'function') {
      return res.status(404).json({ ok: false, error: 'request_denied' });
    }
    const result = await inspectSession(req);
    return result?.ok
      ? res.status(200).json({
        ok: true,
        authenticated: true,
        entitlement_active: result.entitlement_active === true,
        runtime_ready: result.runtime_ready === true,
        session_receipt: result.session_receipt,
        attachment_receipts: result.attachment_receipts || null,
      })
      : res.status(result?.status || 401).json({ ok: false, error: 'authentication_required' });
  };
}

export default createPrivateRuntimeSessionHandler();
