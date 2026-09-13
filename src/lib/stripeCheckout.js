function buildApiUrl(path) {
  const baseUrl = import.meta.env?.VITE_API_URL || '';
  if (!baseUrl) return path;
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const endpoint = path.startsWith('/') ? path : `/${path}`;
  return `${base}${endpoint}`;
}

export function createCheckoutIdempotencyKey(label = 'checkout') {
  const prefix = String(label || 'checkout').toLowerCase().replace(/[^a-z0-9_-]+/gu, '-').slice(0, 40) || 'checkout';
  const uuid = globalThis.crypto?.randomUUID?.();
  if (!uuid) throw new Error('Payment setup is not available yet.');
  return `${prefix}_${uuid.replace(/-/gu, '')}`;
}

export async function startStripeCheckout(payload, {
  idempotencyKey,
  fetchImpl = globalThis.fetch,
  navigate = (url) => { globalThis.window.location.href = url; },
} = {}) {
  const stableKey = String(idempotencyKey || '').trim();
  if (stableKey.length < 12 || typeof fetchImpl !== 'function') {
    throw new Error('Payment setup is not available yet.');
  }
  const response = await fetchImpl(buildApiUrl('/api/public-v1/purchase-intent'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': stableKey,
    },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok || !data?.checkout_url) {
    throw new Error('Payment setup is not available yet.');
  }

  navigate(data.checkout_url);
}
