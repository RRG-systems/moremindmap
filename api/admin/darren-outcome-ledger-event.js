import { createDarrenOutcomeLedgerEvent } from './darren-generated-strategy-core.js';

const DEFAULT_ADMIN_CODE = 'MOREADMIN26';

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
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

function safeErrorCode(error) {
  return String(error?.code || 'darren_outcome_ledger_event_failed')
    .replace(/[^a-z0-9_:-]/gi, '')
    .slice(0, 120) || 'darren_outcome_ledger_event_failed';
}

export default async function handler(req, res) {
  setJsonHeaders(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const expectedCode = configuredAdminCode();
  const providedCode = getProvidedAdminCode(req);
  if (!expectedCode || providedCode !== expectedCode) {
    return res.status(403).json({ ok: false, error: 'admin_outcome_ledger_access_denied' });
  }

  try {
    const result = await createDarrenOutcomeLedgerEvent(req.body || {});
    return res.status(200).json({
      ok: true,
      event_saved: true,
      event_id: result.event.event_id,
      strategy_id: result.event.strategy_id,
      outcome_event_count: result.updated_strategy.outcome_event_count,
      latest_outcome_event_summary: result.latest_outcome_event_summary,
      updated_strategy_summary: {
        accepted_status: result.updated_strategy.accepted_status,
        outcome_status: result.updated_strategy.outcome_status,
        status_history_count: result.updated_strategy.status_history.length,
        outcome_event_count: result.updated_strategy.outcome_event_count,
        latest_outcome_event_id_present: Boolean(result.updated_strategy.latest_outcome_event_id)
      }
    });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    return res.status(status).json({
      ok: false,
      error: safeErrorCode(error)
    });
  }
}
