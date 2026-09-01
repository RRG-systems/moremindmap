let csrfToken = '';

function route() {
  return window.location.pathname.includes('/demo') ? '/api/recruiting/gu-v1-demo' : '/api/recruiting/gu-v1';
}

async function parse(response) {
  const payload = await response.json().catch(() => null);
  if (payload?.csrf_token) csrfToken = payload.csrf_token;
  if (!response.ok || payload?.ok !== true) {
    const error = new Error(payload?.code || `RECRUITING_GU_V1_HTTP_${response.status}`);
    error.code = payload?.code || 'RECRUITING_GU_V1_HTTP_FAILED';
    error.currentRevision = payload?.current_revision || null;
    throw error;
  }
  return payload;
}

export async function fetchGuHome() {
  const url = new URL(route(), window.location.origin);
  url.searchParams.set('view', 'home');
  if (new URLSearchParams(window.location.search).get('manager') === 'standard') url.searchParams.set('home_mode', 'standard');
  return parse(await fetch(url, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } }));
}

export async function fetchGuSession(sessionId) {
  const url = new URL(route(), window.location.origin);
  url.searchParams.set('view', 'session');
  url.searchParams.set('session_id', sessionId);
  return parse(await fetch(url, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } }));
}

export async function mutateGu(action, body = {}, { signal } = {}) {
  return parse(await fetch(route(), {
    method: 'POST', credentials: 'same-origin', cache: 'no-store', signal,
    headers: { 'content-type': 'application/json', 'x-recruiting-gu-v1-csrf': csrfToken },
    body: JSON.stringify({ action, ...body }),
  }));
}

export async function resetGuDemoSubject(subject) {
  if (window.location.pathname !== '/recruiting-gu-v1/demo') throw new Error('RECRUITING_GU_V1_DEMO_RESET_ROUTE_DENIED');
  if (subject !== 'SYNTHETIC' && subject !== 'PATRICIA') throw new Error('RECRUITING_GU_V1_DEMO_RESET_SUBJECT_DENIED');

  csrfToken = '';
  const refreshed = await fetchGuHome();
  if (typeof refreshed?.csrf_token !== 'string' || refreshed.csrf_token.length < 32 || csrfToken !== refreshed.csrf_token) {
    throw new Error('RECRUITING_GU_V1_DEMO_RESET_CSRF_REFRESH_FAILED');
  }
  return mutateGu('RESET_SYNTHETIC_DEMO', { subject });
}

export async function fetchApprovalPreview(token) {
  const url = new URL('/api/recruiting/gu-v1', window.location.origin);
  url.searchParams.set('view', 'approval_preview');
  url.searchParams.set('token', token);
  return parse(await fetch(url, { credentials: 'same-origin', cache: 'no-store' }));
}

export async function decideApproval({ token, decision, csrf }) {
  return parse(await fetch('/api/recruiting/gu-v1', {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'content-type': 'application/json', 'x-recruiting-gu-v1-owner-csrf': csrf },
    body: JSON.stringify({ action: 'OWNER_DECISION', token, decision }),
  }));
}
