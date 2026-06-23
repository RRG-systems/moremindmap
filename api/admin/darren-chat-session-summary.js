import { createDarrenChatSessionSummary, SESSION_INTENTS } from './darren-adaptive-loop-core.js';

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
  return (headers['x-admin-code'] || req.query?.admin_code || req.query?.code || '').toString().trim();
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function safeErrorCode(error) {
  return String(error?.code || 'darren_chat_session_summary_failed')
    .replace(/[^a-z0-9_:-]/gi, '')
    .slice(0, 120) || 'darren_chat_session_summary_failed';
}

export default async function handler(req, res) {
  setJsonHeaders(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const expectedCode = configuredAdminCode();
  const providedCode = getProvidedAdminCode(req);
  if (!expectedCode || providedCode !== expectedCode) {
    return res.status(403).json({ ok: false, error: 'admin_chat_session_summary_access_denied' });
  }

  const body = parseBody(req);
  if (!body.strategy_id) return res.status(400).json({ ok: false, error: 'strategy_id_required' });
  if (body.session_intent && !SESSION_INTENTS.has(String(body.session_intent).trim())) {
    return res.status(400).json({ ok: false, error: 'invalid_chat_session_intent' });
  }
  if (!body.summary_note && !Array.isArray(body.session_messages)) {
    return res.status(400).json({ ok: false, error: 'chat_session_summary_required' });
  }

  try {
    const summary = await createDarrenChatSessionSummary(body);
    return res.status(200).json({
      ok: true,
      summary_saved: true,
      summary_id: summary.summary_id,
      summary_preview: summary.summary_text ? summary.summary_text.slice(0, 220) : null,
      raw_transcript_stored: false
    });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    return res.status(status).json({ ok: false, error: safeErrorCode(error) });
  }
}
