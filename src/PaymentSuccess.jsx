import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

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
  const [searchParams] = useSearchParams();
  const product = displayProduct(searchParams.get('product'));
  const sessionId = searchParams.get('session_id') || '';
  const [accessState, setAccessState] = useState({ status: 'idle', active: false });

  useEffect(() => {
    let cancelled = false;
    async function checkAccess() {
      if (!sessionId) return;
      setAccessState({ status: 'checking', active: false });
      try {
        const response = await fetch(
          buildApiUrl(`/api/stripe/access-status?session_id=${encodeURIComponent(sessionId)}`)
        );
        const payload = await response.json().catch(() => null);
        if (cancelled) return;
        setAccessState({
          status: 'checked',
          active: Boolean(response.ok && payload?.access_found && payload?.payment_truth === 'webhook_confirmed')
        });
      } catch {
        if (!cancelled) setAccessState({ status: 'checked', active: false });
      }
    }
    checkAccess();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

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
            <Link
              to="/profile"
              className="rounded-xl bg-white px-5 py-3 text-center text-sm font-bold uppercase tracking-[0.16em] text-black transition hover:bg-emerald-100"
            >
              Return To Profile
            </Link>
            <Link
              to="/business-assessment"
              className="rounded-xl border border-white/15 px-5 py-3 text-center text-sm font-bold uppercase tracking-[0.16em] text-white/80 transition hover:border-white/35 hover:bg-white/5"
            >
              Business Assessment
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
