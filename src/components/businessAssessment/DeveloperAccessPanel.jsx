import { useCallback, useEffect, useState } from 'react';

const initialState = Object.freeze({
  loading: false,
  error: '',
  active: false,
  profileReceipt: null,
});

export default function DeveloperAccessPanel({
  endpoint = '/api/internal/subdev1-operator',
  onUnlocked = null,
}) {
  const [accessCode, setAccessCode] = useState('');
  const [profileId, setProfileId] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [state, setState] = useState(initialState);

  const publish = useCallback((result) => {
    const receipt = result?.profile_state === 'PROFILE_ACTIVE'
      ? result.profile_receipt
      : null;
    onUnlocked?.(receipt
      ? {
          // Non-authoritative compatibility trigger for the existing attachment host.
          // The server still requires and revalidates the HttpOnly operator context.
          source: 'temporary_internal_subscription_entitlement',
          authority_source: 'temporary_internal_beta_operator_context',
          client_authority: false,
          temporary: true,
          paid_entitlement: false,
          coach_authority: false,
          profile_receipt: receipt,
        }
      : null);
  }, [onUnlocked]);

  const refresh = useCallback(async (csrfIntent = 'POST') => {
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        credentials: 'include',
        headers: { 'X-Subdev1-CSRF-Intent': csrfIntent },
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        setCsrfToken('');
        setState(initialState);
        publish(null);
        return { ok: false, csrfToken: '' };
      }
      const next = {
        loading: false,
        error: '',
        active: result.active === true,
        profileReceipt: result.profile_state === 'PROFILE_ACTIVE'
          ? result.profile_receipt
          : null,
      };
      setCsrfToken(typeof result.csrf_token === 'string' ? result.csrf_token : '');
      setState(next);
      publish(result);
      return {
        ok: true,
        active: next.active,
        csrfToken: typeof result.csrf_token === 'string' ? result.csrf_token : '',
      };
    } catch {
      setCsrfToken('');
      setState(initialState);
      publish(null);
      return { ok: false, csrfToken: '' };
    }
  }, [endpoint, publish]);

  useEffect(() => {
    void Promise.resolve().then(() => refresh());
  }, [refresh]);

  async function activate(event) {
    event.preventDefault();
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      let proof = csrfToken;
      if (!proof) proof = (await refresh('POST')).csrfToken;
      if (!proof) throw new Error('unavailable');
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Subdev1-CSRF': proof,
        },
        body: JSON.stringify({
          operation: 'ACTIVATE',
          access_code: accessCode,
        }),
      });
      const result = await response.json();
      setAccessCode('');
      setCsrfToken('');
      if (!response.ok || result.ok !== true) {
        setState({
          loading: false,
          error: 'Developer access was not granted.',
          active: false,
          profileReceipt: null,
        });
        publish(null);
        return;
      }
      await refresh('POST');
    } catch {
      setAccessCode('');
      setCsrfToken('');
      setState({
        loading: false,
        error: 'Developer access is unavailable.',
        active: false,
        profileReceipt: null,
      });
      publish(null);
    }
  }

  async function selectProfile(event) {
    event.preventDefault();
    setState((current) => ({
      ...current,
      loading: true,
      error: '',
      profileReceipt: null,
    }));
    publish(null);
    try {
      let proof = csrfToken;
      if (!proof) proof = (await refresh('POST')).csrfToken;
      if (!proof) throw new Error('unavailable');
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Subdev1-CSRF': proof,
        },
        body: JSON.stringify({
          operation: 'SELECT_PROFILE',
          profile_id: profileId,
        }),
      });
      const result = await response.json();
      setProfileId('');
      setCsrfToken('');
      if (!response.ok || result.ok !== true) {
        setState({
          loading: false,
          error: 'The selected profile is unavailable.',
          active: true,
          profileReceipt: null,
        });
        return;
      }
      setState({
        loading: false,
        error: '',
        active: true,
        profileReceipt: result.profile_receipt,
      });
      publish(result);
      await refresh('POST');
    } catch {
      setProfileId('');
      setCsrfToken('');
      setState({
        loading: false,
        error: 'The selected profile is unavailable.',
        active: true,
        profileReceipt: null,
      });
    }
  }

  async function clearAccess() {
    setState((current) => ({ ...current, loading: true, error: '' }));
    publish(null);
    try {
      const proof = (await refresh('DELETE')).csrfToken;
      if (!proof) throw new Error('unavailable');
      const response = await fetch(endpoint, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-Subdev1-CSRF': proof },
      });
      if (!response.ok) throw new Error('denied');
    } catch {
      // Clearing local authority display remains fail-closed even if teardown fails.
    }
    setAccessCode('');
    setProfileId('');
    setCsrfToken('');
    setState(initialState);
  }

  return (
    <section
      className="mt-4 rounded-2xl border border-white/15 bg-black/70 p-5 text-white"
      data-region="subdev1-operator-access"
      aria-labelledby="developer-access-heading"
    >
      <h2
        id="developer-access-heading"
        className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80"
      >
        Developer Access
      </h2>
      <p className="mt-2 text-xs text-white/50">
        Temporary internal beta access. Customer identity remains separate.
      </p>

      {!state.active ? (
        <form onSubmit={activate} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="developer-access-code">
            Developer access code
          </label>
          <input
            id="developer-access-code"
            type="password"
            autoComplete="off"
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
            placeholder="Access code"
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/70"
          />
          <button
            type="submit"
            disabled={state.loading || !accessCode}
            className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-40"
          >
            {state.loading ? 'Unlocking…' : 'Unlock'}
          </button>
        </form>
      ) : (
        <>
          <p role="status" className="mt-3 text-sm text-emerald-300">
            Internal Beta Access Active
          </p>
          <form onSubmit={selectProfile} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="developer-profile-id">
              Profile ID
            </label>
            <input
              id="developer-profile-id"
              type="text"
              autoComplete="off"
              spellCheck="false"
              value={profileId}
              onChange={(event) => setProfileId(event.target.value)}
              placeholder="Enter consenting Profile ID"
              className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/70"
            />
            <button
              type="submit"
              disabled={state.loading || !profileId}
              className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/15 disabled:opacity-40"
            >
              {state.loading ? 'Opening…' : 'Open Profile'}
            </button>
          </form>
          <button
            type="button"
            onClick={clearAccess}
            disabled={state.loading}
            className="mt-3 text-xs text-white/50 underline underline-offset-4 hover:text-white/80 disabled:opacity-40"
          >
            Clear internal beta access
          </button>
        </>
      )}

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {state.error}
        </p>
      ) : null}
      {state.profileReceipt ? (
        <p role="status" className="mt-3 text-sm text-emerald-200">
          Profile scope verified for this temporary session.
        </p>
      ) : null}
    </section>
  );
}
