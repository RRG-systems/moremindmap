export function createLiveDemoBrowserTransport({ endpoint = '/api/internal/subscription-v1-live-frontier-demo' } = {}) {
  return async function liveDemoBrowserTransport(request, { stage }) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-subscription-demo-synthetic': 'founder-review-v2',
      },
      body: JSON.stringify({ stage, request }),
      cache: 'no-store',
      credentials: 'same-origin',
    });
    const body = await response.json().catch(() => ({ ok: false, code: 'SUBSCRIPTION_LIVE_DEMO_RESPONSE_INVALID' }));
    if (!response.ok || body.ok !== true) {
      const error = new Error(body.code || 'SUBSCRIPTION_LIVE_DEMO_TRANSPORT_FAILED');
      error.code = body.code || 'SUBSCRIPTION_LIVE_DEMO_TRANSPORT_FAILED';
      throw error;
    }
    const { ok: _ok, ...result } = body;
    return result;
  };
}

