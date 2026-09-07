import { useEffect, useLayoutEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  clearPendingCheckoutSessionId,
  readPendingCheckoutSessionId,
  readStoredPublicStartToken,
  storePendingCheckoutSessionId,
  storePublicStartToken,
} from './lib/publicProductStartSession.js';

const MAX_ACCESS_CHECK_ATTEMPTS = 8;
const ACCESS_CHECK_RETRY_DELAY_MS = 1500;

function buildApiUrl(path) {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  if (!baseUrl) return path;
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const endpoint = path.startsWith('/') ? path : `/${path}`;
  return `${base}${endpoint}`;
}

function displayProduct(value) {
  const product = String(value || '').replace(/_/g, ' ').trim();
  return product || 'checkout';
}

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const product = displayProduct(searchParams.get('product'));
  const checkoutSessionId = searchParams.get('session_id') || '';
  const [sessionId] = useState(() => checkoutSessionId || readPendingCheckoutSessionId());
  const [retrySequence, setRetrySequence] = useState(0);
  const [accessState, setAccessState] = useState(() => {
    if (sessionId) return { status: 'idle', active: false, startToken: '' };
    const startToken = readStoredPublicStartToken();
    return { status: startToken ? 'checked' : 'idle', active: Boolean(startToken), startToken };
  });

  useLayoutEffect(() => {
    if (!sessionId || typeof window === 'undefined') return;
    storePendingCheckoutSessionId(sessionId);
    const scrubbed = new URL(window.location.href);
    if (!scrubbed.searchParams.has('session_id')) return;
    scrubbed.searchParams.delete('session_id');
    window.history.replaceState(
      window.history.state,
      document.title,
      `${scrubbed.pathname}${scrubbed.search}${scrubbed.hash}`,
    );
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer = null;

    function waitForRetry() {
      return new Promise((resolve) => {
        retryTimer = window.setTimeout(resolve, ACCESS_CHECK_RETRY_DELAY_MS);
      });
    }

    async function checkAccess() {
      if (!sessionId) return;
      setAccessState({ status: 'checking', active: false, startToken: '' });
      for (let attempt = 0; attempt < MAX_ACCESS_CHECK_ATTEMPTS && !cancelled; attempt += 1) {
        try {
          const response = await fetch(
            buildApiUrl(`/api/stripe/access-status?session_id=${encodeURIComponent(sessionId)}`),
            { credentials: 'same-origin', cache: 'no-store' },
          );
          const payload = await response.json().catch(() => null);
          if (cancelled) return;
          const active = Boolean(
            response.ok
              && payload?.access_found
              && payload?.payment_truth === 'webhook_confirmed',
          );
          if (active) {
            const tokenResponse = await fetch(buildApiUrl('/api/public-v1/access'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ action: 'create_start_token_from_session', checkout_session_id: sessionId }),
            });
            const tokenPayload = await tokenResponse.json().catch(() => null);
            const startToken = tokenResponse.ok && tokenPayload?.ok
              ? tokenPayload.start_token || ''
              : '';
            if (startToken) {
              const startTokenStored = storePublicStartToken(startToken);
              if (startTokenStored) clearPendingCheckoutSessionId();
              setAccessState({ status: 'checked', active: true, startToken });
              return;
            }
          }
        } catch {
          // A webhook or transient network response may lag the checkout redirect.
        }
        if (attempt < MAX_ACCESS_CHECK_ATTEMPTS - 1) await waitForRetry();
      }
      if (!cancelled) setAccessState({ status: 'checked', active: false, startToken: '' });
    }
    checkAccess();
    return () => {
      cancelled = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [retrySequence, sessionId]);

  async function continueToProduct() {
    if (!accessState.startToken) return;
    const response = await fetch(buildApiUrl('/api/public-v1/product-start'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-MORE-Start-Token': accessState.startToken },
      credentials: 'same-origin',
      body: JSON.stringify({ start_token: accessState.startToken }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok || !payload.destination) return;
    storePublicStartToken(accessState.startToken);
    navigate(payload.destination);
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[75vh] max-w-3xl items-center">
        <section className="w-full rounded-[2rem] border border-emerald-300/25 bg-emerald-400/[0.08] p-8 shadow-[0_0_70px_rgba(16,185,129,0.12)]">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">
            Checkout Status
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">
            {accessState.active ? 'Payment verified.' : 'Checkout completed.'}
          </h1>
          <p className="mt-5 text-lg leading-8 text-white/72">
            {accessState.active
              ? `Your access is active for ${product}.`
              : `We are verifying your access for ${product}. Durable paid access will be confirmed by payment processing.`}
          </p>
          <p className="mt-4 text-sm leading-6 text-white/54">
            Checkout redirect success is not payment proof. MORE MindMap grants durable paid access
            only after payment confirmation is processed.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            {accessState.active && accessState.startToken && (
              <button
                type="button"
                onClick={continueToProduct}
                className="rounded-xl bg-white px-5 py-3 text-center text-sm font-bold uppercase tracking-[0.16em] text-black transition hover:bg-emerald-100"
              >
                Continue To Product
              </button>
            )}
            {!accessState.active && accessState.status === 'checked' && sessionId && (
              <button
                type="button"
                onClick={() => setRetrySequence((sequence) => sequence + 1)}
                className="rounded-xl border border-emerald-200/35 px-5 py-3 text-center text-sm font-bold uppercase tracking-[0.16em] text-emerald-100 transition hover:border-emerald-100 hover:bg-emerald-300/10"
              >
                Retry Verification
              </button>
            )}
            <Link
              to="/"
              className="rounded-xl border border-white/15 px-5 py-3 text-center text-sm font-bold uppercase tracking-[0.16em] text-white/80 transition hover:border-white/35 hover:bg-white/5"
            >
              Return Home
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
