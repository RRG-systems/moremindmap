const ROUTE = '/api/internal/recruiting-v2-experiment-003a';

async function parse(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    const error = new Error(payload?.code || `RECRUITING_V2_HTTP_${response.status}`);
    error.code = payload?.code || 'RECRUITING_V2_HTTP_FAILED';
    error.validationErrors = payload?.validationErrors || [];
    throw error;
  }
  return payload;
}

export async function fetchRecruitingV2Baseline() {
  return parse(await fetch(ROUTE, { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' }));
}

export async function requestRecruitingV2Plan({ purpose, sessionContext, signal }) {
  return parse(await fetch(ROUTE, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', 'x-more-recruiting-v2-synthetic': 'darren-jordan-003a' },
    body: JSON.stringify({ action: 'PLAN_SURFACE', purpose, sessionContext }),
  }));
}
