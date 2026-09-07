export const PUBLIC_START_TOKEN_STORAGE_KEY = 'more.public.start_token.v1';
export const PUBLIC_CHECKOUT_SESSION_STORAGE_KEY = 'more.public.pending_checkout_session.v1';

export function readStoredPublicStartToken(storage = globalThis?.sessionStorage) {
  try { return String(storage?.getItem(PUBLIC_START_TOKEN_STORAGE_KEY) || ''); }
  catch { return ''; }
}

export function storePublicStartToken(token, storage = globalThis?.sessionStorage) {
  const value = String(token || '');
  if (!value) return false;
  try { storage?.setItem(PUBLIC_START_TOKEN_STORAGE_KEY, value); return true; }
  catch { return false; }
}

export function readPendingCheckoutSessionId(storage = globalThis?.sessionStorage) {
  try { return String(storage?.getItem(PUBLIC_CHECKOUT_SESSION_STORAGE_KEY) || ''); }
  catch { return ''; }
}

export function storePendingCheckoutSessionId(sessionId, storage = globalThis?.sessionStorage) {
  const value = String(sessionId || '');
  if (!value) return false;
  try { storage?.setItem(PUBLIC_CHECKOUT_SESSION_STORAGE_KEY, value); return true; }
  catch { return false; }
}

export function clearPendingCheckoutSessionId(storage = globalThis?.sessionStorage) {
  try { storage?.removeItem(PUBLIC_CHECKOUT_SESSION_STORAGE_KEY); return true; }
  catch { return false; }
}

export async function renewStoredPublicStartToken({
  fetchImpl = globalThis?.fetch,
  storage = globalThis?.sessionStorage,
} = {}) {
  const current = readStoredPublicStartToken(storage);
  if (!current || typeof fetchImpl !== 'function') throw new Error('public_start_session_unavailable');
  const response = await fetchImpl('/api/public-v1/access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-MORE-Start-Token': current,
    },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify({ action: 'renew_start_token' }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok !== true || !payload?.start_token) {
    throw new Error('public_start_session_unavailable');
  }
  storePublicStartToken(payload.start_token, storage);
  return payload.start_token;
}
