import { capabilityCookie, developerCapabilityFromCookie, evaluateDeveloperAccess, revokeCapabilityCookie, revokeDeveloperCapability } from './developer-access-security.js';
import { resolveSubscriptionEntitlement } from './subscription-entitlement.js';

function body(req) { if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } } return req.body || {}; }
function headers(res) { res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); }

export default function handler(req, res) {
  headers(res);
  if (req.method === 'GET') { const access = resolveSubscriptionEntitlement({ req }); return res.status(access.allowed ? 200 : 403).json({ ok: access.allowed, ...access }); }
  if (req.method === 'DELETE') { const token = developerCapabilityFromCookie(req.headers?.cookie); if (token) revokeDeveloperCapability(token); res.setHeader('Set-Cookie', revokeCapabilityCookie({ req })); return res.status(200).json({ ok: true, revoked: true }); }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  const decision = evaluateDeveloperAccess({ req, submittedCode: body(req).access_code });
  if (!decision.ok) return res.status(decision.status).json({ ok: false, error: decision.code });
  res.setHeader('Set-Cookie', capabilityCookie(decision.capability, decision.maxAge, { req }));
  return res.status(200).json({ ok: true, capability_issued: true, expires_in_seconds: decision.maxAge });
}
