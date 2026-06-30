import { createDarrenUsageEvent } from './darren-usage-event-core.js';

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
  return String(error?.code || 'darren_usage_event_failed')
    .replace(/[^a-z0-9_:-]/gi, '')
    .slice(0, 120) || 'darren_usage_event_failed';
}

export default async function handler(req, res) {
  setJsonHeaders(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const expectedCode = configuredAdminCode();
  const providedCode = getProvidedAdminCode(req);
  if (!expectedCode || providedCode !== expectedCode) {
    return res.status(403).json({ ok: false, error: 'admin_usage_event_access_denied' });
  }

  try {
    const event = await createDarrenUsageEvent(req.body || {});
    return res.status(200).json({
      ok: true,
      event_id: event.event_id,
      event_type: event.event_type,
      recorded: true,
      message: 'Usage event recorded.'
    });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    return res.status(status).json({
      ok: false,
      error: safeErrorCode(error),
      recorded: false,
      message: 'Usage event was not recorded.'
    });
  }
}
