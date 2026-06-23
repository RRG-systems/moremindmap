import { loadDarrenChatSessionSummaries } from './darren-adaptive-loop-core.js';

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
  return (headers['x-admin-code'] || req.query?.admin_code || req.query?.code || '').toString().trim();
}

export default async function handler(req, res) {
  setJsonHeaders(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const expectedCode = configuredAdminCode();
  const providedCode = getProvidedAdminCode(req);
  if (!expectedCode || providedCode !== expectedCode) {
    return res.status(403).json({ ok: false, error: 'admin_chat_session_summary_access_denied' });
  }

  try {
    const summaries = await loadDarrenChatSessionSummaries({ limit: req.query?.limit || 5 });
    return res.status(200).json({
      ok: true,
      summaries: summaries.map((summary) => ({
        summary_id: summary.summary_id,
        created_at: summary.created_at,
        session_intent: summary.session_intent,
        summary_preview: summary.summary_text ? String(summary.summary_text).slice(0, 220) : null,
        recommended_follow_up: summary.recommended_follow_up || null
      })),
      summaries_count: summaries.length,
      raw_transcript_stored: false
    });
  } catch {
    return res.status(500).json({ ok: false, error: 'darren_chat_session_summaries_unavailable' });
  }
}
