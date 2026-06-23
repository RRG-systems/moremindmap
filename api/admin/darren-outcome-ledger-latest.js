import { loadDarrenOutcomeLedgerEvents } from './darren-generated-strategy-core.js';

const DEFAULT_ADMIN_CODE = 'MOREADMIN26';

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Code');
}

function configuredAdminCode() {
  return process.env.MOREMINDMAP_ADMIN_DASHBOARD_CODE || DEFAULT_ADMIN_CODE;
}

function getProvidedAdminCode(req) {
  const headers = req.headers || {};
  const authHeader = headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  return (
    headers['x-admin-code'] ||
    req.query?.admin_code ||
    req.query?.code ||
    ''
  ).toString().trim();
}

export default async function handler(req, res) {
  setJsonHeaders(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const expectedCode = configuredAdminCode();
  const providedCode = getProvidedAdminCode(req);
  if (!expectedCode || providedCode !== expectedCode) {
    return res.status(403).json({ ok: false, error: 'admin_outcome_ledger_access_denied' });
  }

  try {
    const events = await loadDarrenOutcomeLedgerEvents({
      strategy_id: req.query?.strategy_id || null,
      limit: req.query?.limit || 10
    });
    const compactEvents = events.map((event) => ({
      event_id: event.event_id,
      created_at: event.created_at,
      event_type: event.event_type,
      signal_type: event.signal_type,
      signal_strength: event.signal_strength,
      evidence_weight: event.evidence_weight,
      note_preview: event.event_note ? String(event.event_note).slice(0, 180) : null
    }));
    return res.status(200).json({
      ok: true,
      events: compactEvents,
      events_count: compactEvents.length
    });
  } catch {
    return res.status(500).json({
      ok: false,
      error: 'darren_outcome_ledger_unavailable'
    });
  }
}
