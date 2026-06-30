import { createDarrenStrategyReview } from './darren-strategy-review-core.js';

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
  return String(error?.code || 'darren_strategy_review_failed')
    .replace(/[^a-z0-9_:-]/gi, '')
    .slice(0, 120) || 'darren_strategy_review_failed';
}

export default async function handler(req, res) {
  setJsonHeaders(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const expectedCode = configuredAdminCode();
  const providedCode = getProvidedAdminCode(req);
  if (!expectedCode || providedCode !== expectedCode) {
    return res.status(403).json({ ok: false, error: 'admin_strategy_review_access_denied' });
  }

  try {
    const review = await createDarrenStrategyReview(req.body || {});
    return res.status(200).json({
      ok: true,
      review,
      mutation_performed: true,
      mutation_scope: 'review_record_only',
      no_auto_future_movement: true,
      message: 'Strategy review recorded. Active futures, One Move, and dashboard movement were not changed.'
    });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    return res.status(status).json({
      ok: false,
      error: safeErrorCode(error),
      mutation_performed: false,
      no_auto_future_movement: true
    });
  }
}
