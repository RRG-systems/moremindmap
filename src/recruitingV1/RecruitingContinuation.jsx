import { useEffect, useState } from 'react';
import {
  buildRecruitingInviteContinuation,
  isRecruitingInviteContinuation,
} from '../lib/recruitingV1/continuation.js';

const SYNTHETIC_CONTINUATION = buildRecruitingInviteContinuation({
  invite_session: {
    invite_session_id: 'invite_session_synthetic_continuation',
    invitation_id: 'invite_synthetic_continuation',
    candidate_id: 'candidate_synthetic_continuation',
  },
  relationship: {
    relationship_ref: 'invite_synthetic_continuation',
    candidate_id: 'candidate_synthetic_continuation',
    bos_profile_id: null,
    ba_assessment_id: null,
    ba_readiness: 'BA_NOT_STARTED',
    progress_state: 'INVITED',
    purpose: 'RECRUITING_INTELLIGENCE',
  },
});

async function requestJson(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok !== true) {
    throw new Error(payload?.code || payload?.error || 'RECRUITING_CONTINUATION_UNAVAILABLE');
  }
  return payload;
}

function clearOwnershipTokenFromLocation() {
  const prefix = '#more-profile-owner=';
  if (!window.location.hash.startsWith(prefix)) return '';
  let token = '';
  try { token = decodeURIComponent(window.location.hash.slice(prefix.length)); }
  catch { token = ''; }
  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
  return token;
}

function customerSafeError(code) {
  if (code === 'ownership_verification_failed') {
    return 'That private verification link is invalid or expired. Request a new link to try again.';
  }
  if (code === 'RECRUITING_EXISTING_PROFILE_CONNECTION_UNAVAILABLE') {
    return 'Existing Profile connection is not available yet. Nothing was changed.';
  }
  if (code === 'RECRUITING_PROFILE_OWNER_RECEIPT_REQUIRED') {
    return 'Verify the email connected to that Profile before connecting it.';
  }
  return 'This private continuation is unavailable in this browser. Nothing was changed.';
}

async function loadServerContinuation(signal) {
  const payload = await requestJson('/api/recruiting/runtime?view=invite_session', { signal });
  if (!isRecruitingInviteContinuation(payload.continuation)) {
    throw new Error('RECRUITING_CONTINUATION_INVALID');
  }
  return payload.continuation;
}

async function verifyAndConnectExistingProfile(token, signal) {
  await requestJson('/api/public-v1/profile-ownership', {
    method: 'POST',
    body: { action: 'verify', token },
    signal,
  });
  const payload = await requestJson('/api/recruiting/runtime', {
    method: 'POST',
    body: { action: 'CONNECT_OWNED_PROFILE' },
    signal,
  });
  if (!isRecruitingInviteContinuation(payload.continuation)) {
    throw new Error('RECRUITING_CONTINUATION_INVALID');
  }
  return payload.continuation;
}

export default function RecruitingContinuation({ synthetic = false }) {
  const [state, setState] = useState({ status: 'loading', continuation: null, error: '', notice: '' });
  const [profileId, setProfileId] = useState('');
  const [connectionState, setConnectionState] = useState({ status: 'idle', message: '' });

  useEffect(() => {
    if (synthetic) {
      setState({ status: 'ready', continuation: SYNTHETIC_CONTINUATION, error: '', notice: '' });
      return undefined;
    }

    const controller = new AbortController();
    const ownerToken = clearOwnershipTokenFromLocation();
    const operation = ownerToken
      ? verifyAndConnectExistingProfile(ownerToken, controller.signal)
      : loadServerContinuation(controller.signal);

    operation.then((continuation) => {
      setState({
        status: 'ready',
        continuation,
        error: '',
        notice: ownerToken ? 'Your existing MORE Profile is verified and connected to this invitation.' : '',
      });
    }).catch((error) => {
      if (error?.name === 'AbortError') return;
      setState({ status: 'error', continuation: null, error: customerSafeError(error.message), notice: '' });
    });
    return () => controller.abort();
  }, [synthetic]);

  async function refresh() {
    if (synthetic) {
      setState((current) => ({ ...current, notice: 'Synthetic progress refreshed. No external action occurred.' }));
      return;
    }
    setState((current) => ({ ...current, status: 'refreshing', error: '', notice: '' }));
    try {
      const continuation = await loadServerContinuation();
      setState({ status: 'ready', continuation, error: '', notice: 'Progress refreshed.' });
    } catch (error) {
      setState((current) => ({ ...current, status: 'ready', error: customerSafeError(error.message), notice: '' }));
    }
  }

  async function requestExistingProfileConnection(event) {
    event.preventDefault();
    const normalized = profileId.trim().toLowerCase();
    if (!/^mm-\d{8}-[a-z0-9]{8}$/u.test(normalized)) {
      setConnectionState({ status: 'error', message: 'Enter a valid MORE Profile ID.' });
      return;
    }
    setConnectionState({ status: 'requesting', message: '' });
    try {
      await requestJson('/api/public-v1/profile-ownership', {
        method: 'POST',
        body: {
          action: 'request',
          profile_id: normalized,
          return_path: '/recruiting/continue',
        },
      });
      setConnectionState({
        status: 'requested',
        message: 'If that Profile has a connected email, a private verification link will arrive shortly.',
      });
    } catch {
      setConnectionState({ status: 'error', message: 'Verification is unavailable right now. Nothing was changed.' });
    }
  }

  if (state.status === 'loading') {
    return <RecruitingContinuationFrame><div className="recruiting-continuation__loading" role="status"><span>+</span><h1>Opening your private progress…</h1><p>The accepted invitation in this browser is being checked.</p></div></RecruitingContinuationFrame>;
  }

  if (!state.continuation) {
    return <RecruitingContinuationFrame><div className="recruiting-continuation__loading" role="alert"><span>!</span><h1>We could not open this continuation.</h1><p>{state.error}</p></div></RecruitingContinuationFrame>;
  }

  return (
    <RecruitingContinuationView
      continuation={state.continuation}
      refreshing={state.status === 'refreshing'}
      error={state.error}
      notice={state.notice}
      onRefresh={refresh}
      profileId={profileId}
      onProfileIdChange={setProfileId}
      connectionState={connectionState}
      onRequestConnection={requestExistingProfileConnection}
      synthetic={synthetic}
    />
  );
}

function RecruitingContinuationFrame({ children }) {
  return <main className="recruiting-continuation"><div className="public-brand"><span>+</span><strong>MORE MINDMAP</strong><small>Private recruit continuation</small></div>{children}</main>;
}

export function RecruitingContinuationView({
  continuation,
  refreshing = false,
  error = '',
  notice = '',
  onRefresh = () => {},
  profileId = '',
  onProfileIdChange = () => {},
  connectionState = { status: 'idle', message: '' },
  onRequestConnection = () => {},
  synthetic = false,
}) {
  const bosPending = ['INVITED', 'BOS_IN_PROGRESS'].includes(continuation.progress_state);
  return (
    <RecruitingContinuationFrame>
      <article className="recruiting-continuation__card" data-progress-state={continuation.progress_state}>
        <p className="eyebrow green">Your private MORE path</p>
        <h1>One invitation. One connected journey.</h1>
        <p className="recruiting-continuation__intro">
          Your accepted invitation carries your MORE Profile into the optional Business Assessment on the same bound Profile.
          You will not need another manager invitation or need to enter the Profile ID again after BOS.
        </p>

        {synthetic && <p className="recruiting-continuation__synthetic">Synthetic review · no email, provider, customer, or Production activity</p>}

        <ol className="recruiting-continuation__progress" aria-label="Recruiting assessment progress">
          {continuation.progress.map((step) => (
            <li key={step.id} data-state={step.state}>
              <span>{step.state === 'COMPLETE' ? '✓' : step.state === 'LOCKED' ? '○' : '→'}</span>
              <div><strong>{step.label}</strong><small>{step.state.toLowerCase()}</small></div>
            </li>
          ))}
        </ol>

        <section className="recruiting-continuation__notifications" aria-label="Progress notifications" aria-live="polite">
          {continuation.notifications.map((notification) => (
            <div key={notification.code} data-tone={notification.tone} role="status">
              <span>✦</span>
              <div><strong>{notification.title}</strong><p>{notification.body}</p></div>
            </div>
          ))}
          {notice && <p className="recruiting-continuation__notice">{notice}</p>}
          {error && <p className="recruiting-continuation__error" role="alert">{error}</p>}
        </section>

        <div className="recruiting-continuation__actions">
          <a href={continuation.next_step.destination} data-testid="recruiting-continuation-next">
            {continuation.next_step.label} <span>→</span>
          </a>
          <button type="button" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh progress'}
          </button>
        </div>

        {bosPending && (
          <details className="recruiting-continuation__existing-profile">
            <summary>I already have a MORE Profile</summary>
            <form onSubmit={onRequestConnection}>
              <p>Connect an existing Profile only after verifying the email already attached to that Profile.</p>
              <label>
                MORE Profile ID
                <input
                  value={profileId}
                  onChange={(event) => onProfileIdChange(event.target.value)}
                  placeholder="MM-YYYYMMDD-XXXXXXXX"
                  autoComplete="off"
                />
              </label>
              <button type="submit" disabled={connectionState.status === 'requesting'}>
                {connectionState.status === 'requesting' ? 'Requesting…' : 'Send private verification link'}
              </button>
              {connectionState.message && (
                <p className={connectionState.status === 'error' ? 'recruiting-continuation__error' : 'recruiting-continuation__notice'} aria-live="polite">
                  {connectionState.message}
                </p>
              )}
            </form>
          </details>
        )}

        <footer>
          <span>Accepted invite-session authority</span>
          <span>Same Profile required</span>
          <span>No second invitation</span>
        </footer>
      </article>
    </RecruitingContinuationFrame>
  );
}
