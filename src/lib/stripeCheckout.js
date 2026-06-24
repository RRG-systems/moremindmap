function buildApiUrl(path) {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  if (!baseUrl) return path;
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const endpoint = path.startsWith('/') ? path : `/${path}`;
  return `${base}${endpoint}`;
}

export async function startStripeCheckout(payload) {
  const response = await fetch(buildApiUrl('/api/stripe/create-checkout-session'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok || !data?.checkout_url) {
    throw new Error('Payment setup is not available yet.');
  }

  window.location.href = data.checkout_url;
}
