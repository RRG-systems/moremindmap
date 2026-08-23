import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function RecruitingManagerSetup({ request, synthetic, fixture }) {
  const location = useLocation();
  const navigate = useNavigate();
  const rawToken = location.pathname.startsWith('/recruiting/setup/')
    ? decodeURIComponent(location.pathname.slice('/recruiting/setup/'.length))
    : '';
  const [preview, setPreview] = useState(synthetic ? fixture.manager_setup_preview : null);
  const [stage, setStage] = useState(rawToken ? 'preview' : 'profile');
  const [profileId, setProfileId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (synthetic || !rawToken) return;
    request({ view: 'manager_setup_preview', query: { token: rawToken } })
      .then((payload) => setPreview(payload.preview))
      .catch((failure) => setError(failure.message));
  }, [rawToken, request, synthetic]);

  async function verifyEmail() {
    try {
      if (!synthetic) await request({ action: 'BEGIN_MANAGER_SETUP', body: { token: rawToken } });
      window.history.replaceState({}, '', '/recruiting/setup');
      setStage('profile');
    } catch (failure) {
      setError(failure.message);
    }
  }

  async function complete(event) {
    event.preventDefault();
    try {
      if (!/^mm-\d{8}-[a-z0-9]{8}$/iu.test(profileId)) throw new Error('Enter a valid MORE MindMap Profile ID.');
      if (!synthetic) await request({ action: 'COMPLETE_MANAGER_SETUP', body: { profile_id: profileId } });
      setStage('complete');
    } catch (failure) {
      setError(failure.message);
    }
  }

  if (!preview && stage === 'preview') return <main className="manager-onboarding"><div className="loading-mark">+</div><h1>{error || 'Opening your private manager setup…'}</h1></main>;

  return (
    <main className="manager-onboarding manager-setup-page" data-synthetic={synthetic ? 'true' : 'false'}>
      <div className="setup-brand"><span>+</span><strong>MORE MINDMAP</strong><small>Recruiting manager setup</small></div>
      {stage === 'preview' && <article className="setup-card">
        <p className="eyebrow green">You have been invited to manage Recruiting Intelligence</p>
        <h1>Welcome, {preview.manager_name}.</h1>
        <p>{preview.enterprise_name} has prepared a private manager account for {preview.masked_email}.</p>
        <section><strong>What happens next</strong><ul><li>This link verifies access to the business email that received it.</li><li>You will connect your existing MORE MindMap Profile.</li><li>Your Profile ID connects the account; it is not your password.</li></ul></section>
        <button type="button" onClick={verifyEmail}>Verify this email and continue →</button>
        <small>This single-use link expires {new Date(preview.expires_at).toLocaleDateString()}.</small>
        {error && <strong role="alert">{error}</strong>}
      </article>}
      {stage === 'profile' && <form className="setup-card" onSubmit={complete}>
        <p className="eyebrow blue">Email verified</p>
        <h1>Connect your MORE MindMap Profile.</h1>
        <p>Use your own Profile ID so Recruiting Intelligence can recognize the right manager account. It will never be used as a credential.</p>
        <label>MORE MindMap Profile ID<input value={profileId} onChange={(event) => setProfileId(event.target.value)} placeholder="MM-YYYYMMDD-XXXXXXXX" autoComplete="off" /></label>
        <button type="submit">Connect profile and activate →</button>
        {error && <strong role="alert">{error}</strong>}
      </form>}
      {stage === 'complete' && <article className="setup-card setup-complete"><span>✓</span><p className="eyebrow green">Setup complete</p><h1>Your Recruiting manager account is active.</h1><p>You can now invite recruits and prepare for better recruiting conversations.</p><button type="button" onClick={() => navigate('/recruiting/home', { replace: true })}>Open Recruiting Intelligence →</button></article>}
    </main>
  );
}
