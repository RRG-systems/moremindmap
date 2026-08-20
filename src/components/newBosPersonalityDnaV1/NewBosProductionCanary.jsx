import { useEffect, useState } from 'react';

import NewBosExperience from './NewBosExperience.jsx';

const PROFILE_ID_PATTERN = /^MM-[A-Z0-9-]+$/;

export default function NewBosProductionCanary({ customerMode = false }) {
  const [profileId, setProfileId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [artifact, setArtifact] = useState(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  async function loadProfile({ requestedProfileId = profileId, token = accessToken } = {}) {
    const normalized = requestedProfileId.trim().toUpperCase();
    if (!PROFILE_ID_PATTERN.test(normalized) || (!customerMode && !token)) {
      setMessage(customerMode ? 'A valid Profile ID is required.' : 'Authorized profile ID and operator token are required.');
      return;
    }
    setStatus('loading');
    setMessage('');
    try {
      const response = await fetch(`/api/moremindmap/new-bos?id=${encodeURIComponent(normalized)}`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: customerMode ? {} : { 'x-new-bos-canary-token': token },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.artifact) throw new Error(body?.safe_code || 'new_bos_canary_unavailable');
      setArtifact(body.artifact);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setMessage(String(error?.message || 'new_bos_canary_unavailable').replaceAll('_', ' '));
    } finally {
      if (!customerMode) setAccessToken('');
    }
  }

  async function loadCanary(event) {
    event.preventDefault();
    await loadProfile();
  }

  useEffect(() => {
    if (!customerMode) return;
    const requestedProfileId = new URLSearchParams(window.location.search).get('id') || '';
    setProfileId(requestedProfileId);
    loadProfile({ requestedProfileId, token: '' });
    // Customer mode is a one-shot exact-profile retrieval for the current URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerMode]);

  if (artifact) {
    return (
      <NewBosExperience
        artifactOverride={artifact}
        customerMode={customerMode}
        privateGate={!customerMode}
        runtimeLabel={customerMode ? 'Governed customer realization' : 'Authorized production canary · ordinary customer activation off'}
      />
    );
  }

  if (customerMode) {
    return (
      <main data-testid="new-bos-customer-loading" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#172127', color: '#f7f1e6' }}>
        <div style={{ width: 'min(560px, 100%)' }}>
          <p style={{ color: '#f0a178', textTransform: 'uppercase', letterSpacing: '.14em', fontWeight: 800 }}>Your governed Personality DNA</p>
          <h1 style={{ font: '400 3.2rem/1 Georgia, serif' }}>{status === 'loading' ? 'Reading the whole person…' : 'This realization is not available.'}</h1>
          {message && <p role="alert" style={{ color: '#f0a178' }}>{message}</p>}
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#172127', color: '#f7f1e6' }}>
      <form onSubmit={loadCanary} style={{ width: 'min(560px, 100%)', display: 'grid', gap: 16 }} autoComplete="off">
        <p style={{ color: '#f0a178', textTransform: 'uppercase', letterSpacing: '.14em', fontWeight: 800, margin: 0 }}>Private operator canary</p>
        <h1 style={{ font: '400 3.2rem/1 Georgia, serif', margin: 0 }}>New BOS is default off.</h1>
        <p style={{ color: 'rgba(255,255,255,.68)', lineHeight: 1.7, margin: 0 }}>Only an allowlisted profile and the operator-held canary token can open a staged realization. Ordinary customer BOS remains unchanged.</p>
        <label style={{ display: 'grid', gap: 8 }}>
          <span>Authorized profile ID</span>
          <input data-testid="new-bos-canary-profile" value={profileId} onChange={(event) => setProfileId(event.target.value)} spellCheck="false" style={{ padding: 14, font: 'inherit' }} />
        </label>
        <label style={{ display: 'grid', gap: 8 }}>
          <span>Operator token</span>
          <input data-testid="new-bos-canary-token" type="password" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} autoComplete="new-password" style={{ padding: 14, font: 'inherit' }} />
        </label>
        <button data-testid="new-bos-canary-submit" type="submit" disabled={status === 'loading'} style={{ padding: 14, font: 'inherit', fontWeight: 800, cursor: 'pointer' }}>
          {status === 'loading' ? 'Loading governed realization…' : 'Open authorized canary'}
        </button>
        {message && <p role="alert" style={{ color: '#f0a178' }}>{message}</p>}
      </form>
    </main>
  );
}
