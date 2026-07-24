import { useCallback, useEffect, useState } from 'react';

export default function DeveloperAccessPanel({ endpoint = '/api/internal/developer-access', onUnlocked = null }) {
  const [accessCode, setAccessCode] = useState('');
  const [state, setState] = useState({ loading: false, error: '', unlocked: false });
  const [csrfToken, setCsrfToken] = useState('');
  const refreshEntitlement = useCallback(async (csrfIntent = 'POST') => {
    try {
      const response = await fetch(endpoint, { method: 'GET', credentials: 'include', headers: { 'X-Coach-Connect-CSRF-Intent': csrfIntent } });
      const result = await response.json();
      setCsrfToken(typeof result.csrf_token === 'string' ? result.csrf_token : '');
      const unlocked = response.ok && result.allowed === true && result.entitlement?.access_type === 'more_monthly_intelligence';
      setState({ loading: false, error: '', unlocked });
      onUnlocked?.(unlocked ? result.entitlement : null);
      return { unlocked, csrf_token: typeof result.csrf_token === 'string' ? result.csrf_token : '' };
    } catch { setState({ loading: false, error: '', unlocked: false }); return { unlocked: false, csrf_token: '' }; }
  }, [endpoint, onUnlocked]);
  useEffect(() => { void Promise.resolve().then(refreshEntitlement); }, [refreshEntitlement]);
  async function unlock(event) {
    event.preventDefault(); setState({ loading: true, error: '', unlocked: false });
    try {
      let activeProof = csrfToken;
      if (!activeProof) activeProof = (await refreshEntitlement('POST')).csrf_token;
      if (!activeProof) { setAccessCode(''); setState({ loading: false, error: 'Developer access is unavailable.', unlocked: false }); return; }
      const response = await fetch(endpoint, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Coach-Connect-CSRF': activeProof }, body: JSON.stringify({ access_code: accessCode }) });
      const result = await response.json(); setAccessCode('');
      setCsrfToken('');
      if (!response.ok || !result.ok) { setState({ loading: false, error: 'Developer access was not granted.', unlocked: false }); return; }
      const refreshed = await refreshEntitlement();
      if (!refreshed.unlocked) setState({ loading: false, error: 'Subscription entitlement could not be verified.', unlocked: false });
    } catch { setAccessCode(''); setState({ loading: false, error: 'Developer access is unavailable.', unlocked: false }); }
  }
  return (
    <section className="mt-4 rounded-2xl border border-white/15 bg-black/70 p-5 text-white" data-region="coach-connect-developer-access" aria-labelledby="developer-access-heading">
      <h2 id="developer-access-heading" className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">Developer Access</h2>
      <p className="mt-2 text-xs text-white/50">Temporary internal subscription entitlement for private testing.</p>
      <form onSubmit={unlock} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="developer-access-code">access-code input</label>
        <input id="developer-access-code" type="password" autoComplete="off" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="Access code" className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/70" />
        <button type="submit" disabled={state.loading || !accessCode} className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-40">{state.loading ? 'Unlocking…' : 'Unlock'}</button>
      </form>
      {state.error ? <p role="alert" className="mt-3 text-sm text-red-300">{state.error}</p> : null}
      {state.unlocked ? <p role="status" className="mt-3 text-sm text-emerald-300">MORE Monthly Intelligence subscriber access is active for this temporary session.</p> : null}
    </section>
  );
}
