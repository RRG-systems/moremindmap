import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import BusinessTwinApp from '../../lab/baProgressiveDisclosureV1/BusinessTwinApp.jsx';
import { buildCustomerSafePresentationViewModel } from '../../lib/baProgressiveDisclosureV1/customerPresentationSanitizer.js';
import { normalizeNewBaRelativeSupportCustomerLanguage, rewriteNewBaCustomerFutureText } from './customerFutureSemantics.js';
import '../../lab/baProgressiveDisclosureV1/styles.css';
import './newBaProductionCanary.css';

const PROFILE_ID_PATTERN = /^MM-[A-Z0-9-]+$/;

function normalizeLiveCustomerPresentation(viewModel) {
  const customer = structuredClone(viewModel);
  const goal = customer?.destinations?.plan?.goal;
  if (goal && !goal.annual && !goal.monthly) {
    goal.annual = goal.statement || goal.title || customer?.destinations?.plan?.headline;
    goal.annualLabel = null;
  }
  for (const strategy of customer?.destinations?.plan?.strategies || []) {
    if (strategy.supportingText?.trim() === strategy.headline?.trim()) strategy.supportingText = null;
  }
  return customer;
}

function ProductionBusinessTwin({ viewModel }) {
  const rootRef = useRef(null);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const apply = () => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const rewritten = rewriteNewBaCustomerFutureText(node.nodeValue || '');
        if (rewritten !== node.nodeValue) node.nodeValue = rewritten;
        node = walker.nextNode();
      }
      const coverage = root.querySelector('.coverage');
      const coverageLabel = coverage?.querySelector(':scope > .eyebrow');
      if (coverageLabel?.textContent === 'Evidence coverage map') coverageLabel.textContent = 'Accepted assessment-input coverage';
      if (coverage && !coverage.querySelector(':scope > .production-coverage-note')) {
        const note = document.createElement('small');
        note.className = 'production-coverage-note';
        note.textContent = 'These counts show classified inputs routed into each business territory. Additional missing evidence remains listed separately.';
        coverageLabel?.insertAdjacentElement('afterend', note);
      }
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return <div className="new-ba-production-experience" ref={rootRef}><BusinessTwinApp viewModel={viewModel} /></div>;
}

export default function NewBaProductionCanary({ customerMode = false }) {
  const [profileId, setProfileId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [viewModel, setViewModel] = useState(null);
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
      let body = null;
      for (let attempt = 0; attempt < 450; attempt += 1) {
        const response = await fetch(`/api/moremindmap/new-ba?id=${encodeURIComponent(normalized)}`, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
          headers: customerMode ? {} : { 'x-new-ba-canary-token': token },
        });
        body = await response.json().catch(() => ({}));
        if (response.status === 202 && body?.pending === true) {
          setStatus('processing');
          setMessage('Your governed Business Twin is being prepared. This page will update automatically.');
          const delay = Math.min(Math.max(Number(body.retry_after_ms) || 2000, 1000), 5000);
          await new Promise((resolve) => window.setTimeout(resolve, delay));
          continue;
        }
        if (!response.ok) throw new Error(body?.safe_code || 'new_ba_canary_unavailable');
        break;
      }
      if (!body?.artifact?.customer_view_model) {
        setStatus('processing');
        setMessage('Your governed Business Twin is still being prepared. You can safely refresh this page later.');
        return;
      }
      const customerViewModel = normalizeLiveCustomerPresentation(normalizeNewBaRelativeSupportCustomerLanguage(buildCustomerSafePresentationViewModel(body.artifact.customer_view_model)));
      document.title = `${customerViewModel.identity.firstName}’s Business Twin · MORE MindMap`;
      setViewModel(customerViewModel);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setMessage(customerMode
        ? 'We could not finish preparing this Business Twin right now. Your saved information is safe. Please try again later.'
        : String(error?.message || 'new_ba_canary_unavailable').replaceAll('_', ' '));
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

  if (viewModel) return <ProductionBusinessTwin viewModel={viewModel} />;

  if (customerMode) {
    return (
      <main data-testid="new-ba-customer-loading" className="ba-production-private-gate">
        <div>
          <p>Your governed Business Twin</p>
          <h1>{['loading', 'processing'].includes(status) ? 'Preparing your Business Twin…' : 'This Business Twin is not available.'}</h1>
          {message && <strong role="alert">{message}</strong>}
        </div>
      </main>
    );
  }

  return (
    <main className="ba-production-private-gate">
      <form onSubmit={loadCanary} autoComplete="off">
        <p>Private operator canary</p>
        <h1>New BA is default off.</h1>
        <span>Only an allowlisted profile and operator-held token can open this production-intended fusion proof. Ordinary customer activation remains off.</span>
        <label>
          Authorized profile ID
          <input data-testid="new-ba-canary-profile" value={profileId} onChange={(event) => setProfileId(event.target.value)} spellCheck="false" />
        </label>
        <label>
          Operator token
          <input data-testid="new-ba-canary-token" type="password" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} autoComplete="new-password" />
        </label>
        <button data-testid="new-ba-canary-submit" type="submit" disabled={status === 'loading'}>{status === 'loading' ? 'Loading governed Business Twin…' : 'Open authorized canary'}</button>
        {message && <strong role="alert">{message}</strong>}
      </form>
    </main>
  );
}
