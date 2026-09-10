import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { SYNTHETIC_RECRUITING_FIXTURE } from '../lib/recruitingV1/syntheticFixture.js';
import RecruitingManagerSetup from './RecruitingManagerSetup.jsx';
import RecruitingMasterControl from './RecruitingMasterControl.jsx';
import RecruitingContinuation from './RecruitingContinuation.jsx';
import { JourneyMap, ProductHeader } from './RecruitingExperienceShell.jsx';
import { resolveRecruitingWorkspaceRoute } from '../lib/recruitingV1/landing.js';
import {
  MANAGER_DESTINATIONS, allowanceLabel, allowanceResetLabel, consultingCandidatePath,
  consultingCandidates, consultingPreparationCandidates, invitationAllowance, invitationErrorMessage, mayResendInvitation,
  presentRecruitingNotification, reconcileConsultingPreparationReceipts, recruitProgressLabel, uniqueCandidateNotifications,
} from '../lib/recruitingV1/workspacePresentation.js';
import './recruitingV1.css';

const SYNTHETIC = import.meta.env.VITE_RECRUITING_V1_SYNTHETIC_REVIEW === 'true';
const RECRUITING_GU_V1_ENABLED = import.meta.env.VITE_RECRUITING_GU_V1_ENABLED === 'true';
const clone = (value) => JSON.parse(JSON.stringify(value));
let recruitingCsrfToken = null;
let recruitingSetupCsrfToken = null;

const CONSULTING_PREPARATION_WAITING_COPY = "Preparing this person's BOS and BA for Consulting. Please keep this page open. This can take around 20 minutes, and sometimes longer. Completed results will be saved automatically.";
const CONSULTING_PREPARATION_PENDING_STATES = new Set([
  'BOS_JOB_RESUMING',
  'NEW_BOS_PREPARING',
  'NEW_BA_PREPARING',
  'VERIFYING_RESULTS',
]);
const CONSULTING_PREPARATION_REVIEW_STATES = new Set([
  'REVIEW_REQUIRED',
  'BOS_GENERATION_FAILED',
]);

function preparationFailureMessage(code) {
  if (String(code || '').includes('SESSION')) {
    return 'Your secure manager session ended. Saved progress was kept. Verify your access, then return here to resume.';
  }
  return 'Preparation paused after an error. Saved progress was kept. Retry to resume from the last completed step.';
}

function syntheticFixtureForScenario(name) {
  const fixture = clone(SYNTHETIC_RECRUITING_FIXTURE);
  const admin = name === 'admin';
  fixture.manager.capabilities.master_control = admin;
  fixture.invitation_allowance = clone(admin ? fixture.master_control.admin.entitlement : fixture.entitlement);
  if (admin) fixture.manager.name = fixture.master_control.admin.manager_name;
  fixture.candidates = fixture.candidates.map((person) => ({
    ...person,
    consulting_ready: Boolean(person.accepted_at && person.bos_profile_id && person.ba_readiness === 'BA_INTELLIGENCE_READY'),
  }));
  if (name === 'empty') fixture.candidates = [];
  if (name === 'exhausted') fixture.invitation_allowance = { ...fixture.invitation_allowance, remaining: 0, used: 5, reserved: 3, consumed: 2 };
  return fixture;
}

async function api({ view, action, body = {}, query = {} }) {
  const url = new URL('/api/recruiting/runtime', window.location.origin);
  if (view) url.searchParams.set('view', view);
  for (const [key, value] of Object.entries(query)) if (value) url.searchParams.set(key, value);
  const response = await fetch(url, {
    method: action ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
    headers: action ? {
      'content-type': 'application/json',
      'idempotency-key': crypto.randomUUID(),
      ...(recruitingCsrfToken ? { 'x-recruiting-csrf': recruitingCsrfToken } : {}),
      ...(action === 'COMPLETE_MANAGER_SETUP' && recruitingSetupCsrfToken ? { 'x-recruiting-setup-csrf': recruitingSetupCsrfToken } : {}),
    } : {},
    body: action ? JSON.stringify({ action, ...body }) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (payload.csrf_token) {
    if (action === 'BEGIN_MANAGER_SETUP') recruitingSetupCsrfToken = payload.csrf_token;
    else recruitingCsrfToken = payload.csrf_token;
  }
  if (!response.ok || payload.ok !== true) throw new Error(payload.code || 'Recruiting is temporarily unavailable.');
  return payload;
}

export default function RecruitingV1App() {
  const location = useLocation();
  if (location.pathname === '/recruiting/demo') return <Navigate to={RECRUITING_GU_V1_ENABLED ? '/recruiting-gu-v1/demo' : '/recruiting-v2/demo'} replace />;
  if (location.pathname.startsWith('/recruiting/accept/')) return <InvitationAcceptance />;
  if (location.pathname === '/recruiting/continue') return <RecruitingContinuation synthetic={SYNTHETIC} />;
  if (location.pathname.startsWith('/recruiting/verify/')) return <ManagerVerification />;
  if (location.pathname.startsWith('/recruiting/setup')) return <RecruitingManagerSetup request={api} synthetic={SYNTHETIC} fixture={SYNTHETIC_RECRUITING_FIXTURE} />;
  return <ManagerExperience />;
}

function ManagerExperience() {
  const location = useLocation();
  const navigate = useNavigate();
  const hydrationStarted = useRef(false);
  const syntheticScenario = new URLSearchParams(location.search).get('scenario');
  const [state, setState] = useState(SYNTHETIC ? syntheticFixtureForScenario(syntheticScenario) : null);
  const [sessionStatus, setSessionStatus] = useState(SYNTHETIC ? 'ready' : 'loading');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [preparationByCandidate, setPreparationByCandidate] = useState({});
  const [preparationInFlight, setPreparationInFlight] = useState(null);
  const [preparationAnnouncement, setPreparationAnnouncement] = useState('');
  const preparationLock = useRef(false);
  const preparationTimer = useRef(null);
  const activePreparationCandidate = useRef(null);
  const active = location.pathname.split('/')[2] || 'home';
  const admin = state?.manager?.capabilities?.master_control === true;

  useEffect(() => {
    if (SYNTHETIC || hydrationStarted.current) return;
    hydrationStarted.current = true;
    api({ view: 'home' }).then((payload) => {
      setState(payload);
      setSessionStatus('ready');
    }).catch(() => setSessionStatus('unauthorized'));
  }, []);

  useEffect(() => {
    if (SYNTHETIC || active !== 'master-control' || !admin) return;
    api({ view: 'master_control' })
      .then((payload) => setState((current) => ({ ...current, master_control: payload })))
      .catch((failure) => setError(failure.message));
  }, [active, admin]);

  useEffect(() => () => {
    if (preparationTimer.current) window.clearTimeout(preparationTimer.current);
  }, []);

  async function refreshMasterControl() {
    if (SYNTHETIC) return;
    const payload = await api({ view: 'master_control' });
    setState((current) => ({ ...current, master_control: payload }));
  }

  async function refreshHome() {
    setRefreshing(true);
    setError('');
    setPreparationAnnouncement('');
    try {
      if (!SYNTHETIC) {
        const refreshed = await api({ view: 'home' });
        setState(refreshed);
        setPreparationByCandidate((current) => reconcileConsultingPreparationReceipts(current, refreshed.candidates));
      }
    } catch (failure) { setError(failure.message); }
    finally { setRefreshing(false); }
  }

  function mergePreparedCandidate(candidate) {
    if (!candidate?.candidate_id) return;
    setState((current) => ({
      ...current,
      candidates: (current?.candidates || []).map((item) =>
        item.candidate_id === candidate.candidate_id ? { ...item, ...candidate } : item),
    }));
  }

  async function prepareCandidate(candidateId) {
    if (SYNTHETIC) {
      setPreparationByCandidate((current) => ({
        ...current,
        [candidateId]: {
          state: 'BA_INTAKE_REQUIRED',
          candidate_id: candidateId,
          missing_assessment: 'BA',
          message: 'The recruit must finish the Business Assessment before BA results can be prepared for Consulting.',
          retryable: false,
          retry_after_ms: null,
        },
      }));
      return;
    }
    if (preparationLock.current
        || (activePreparationCandidate.current && activePreparationCandidate.current !== candidateId)) return;
    if (preparationTimer.current) {
      window.clearTimeout(preparationTimer.current);
      preparationTimer.current = null;
    }
    preparationLock.current = true;
    activePreparationCandidate.current = candidateId;
    setPreparationInFlight(candidateId);
    setError('');
    try {
      const payload = await api({ action: 'PREPARE_CONSULTING_RESULTS', body: { candidate_id: candidateId } });
      const receipt = payload.preparation;
      if (!receipt || receipt.candidate_id !== candidateId || !receipt.state) {
        throw new Error('RECRUITING_CONSULTING_PREPARATION_RECEIPT_INVALID');
      }
      mergePreparedCandidate(payload.candidate);
      setPreparationByCandidate((current) => ({ ...current, [candidateId]: receipt }));
      if (CONSULTING_PREPARATION_PENDING_STATES.has(receipt.state)) {
        const suppliedRetryAfter = Number(receipt.retry_after_ms);
        if (Number.isFinite(suppliedRetryAfter) && suppliedRetryAfter > 0) {
          const retryAfter = Math.min(Math.max(suppliedRetryAfter, 1000), 60_000);
          preparationTimer.current = window.setTimeout(() => prepareCandidate(candidateId), retryAfter);
        } else {
          activePreparationCandidate.current = null;
          preparationTimer.current = null;
        }
      } else {
        activePreparationCandidate.current = null;
        preparationTimer.current = null;
        if (receipt.state === 'READY') {
          setPreparationAnnouncement(`${payload.candidate?.recruit_name || 'This person'}'s results are ready. Consulting is now available.`);
        }
      }
    } catch (failure) {
      if (preparationTimer.current) window.clearTimeout(preparationTimer.current);
      preparationTimer.current = null;
      activePreparationCandidate.current = null;
      // A long provider-backed request may have committed even when its HTTP
      // response was lost. Rehydrate the durable state and a fresh one-time
      // CSRF before offering Retry; never restart from a client assumption.
      if (!SYNTHETIC) {
        try {
          const refreshed = await api({ view: 'home' });
          setState(refreshed);
          setPreparationByCandidate((current) => reconcileConsultingPreparationReceipts(current, refreshed.candidates));
          const recoveredCandidate = (refreshed.candidates || []).find((candidate) => candidate.candidate_id === candidateId);
          if (recoveredCandidate?.consulting_ready) {
            setPreparationAnnouncement(`${recoveredCandidate.recruit_name || 'This person'}'s results are ready. Consulting is now available.`);
            return;
          }
        } catch {
          // Without a successful authenticated HOME read there is no durable
          // state receipt or fresh one-time CSRF. Fail closed into the existing
          // manager verification path instead of offering a dead-end Retry.
          setSessionStatus('unauthorized');
          return;
        }
      }
      setPreparationByCandidate((current) => ({
        ...current,
        [candidateId]: {
          state: 'RETRYABLE_FAILURE',
          candidate_id: candidateId,
          missing_assessment: null,
          message: preparationFailureMessage(failure.message),
          retryable: true,
          retry_after_ms: null,
        },
      }));
    } finally {
      preparationLock.current = false;
      setPreparationInFlight(null);
    }
  }

  if (sessionStatus === 'loading') return <LoadingState />;
  if (sessionStatus === 'unauthorized') return <ManagerOnboarding onVerified={() => window.location.assign('/recruiting/home')} />;
  if (!state) return <LoadingState />;
  const redirect = resolveRecruitingWorkspaceRoute(location.pathname, state.manager);
  if (redirect) return <Navigate to={`${redirect}${SYNTHETIC && syntheticScenario ? `?scenario=${encodeURIComponent(syntheticScenario)}` : ''}`} replace />;

  function navigateTo(id) {
    navigate(`/recruiting/${id}${SYNTHETIC && syntheticScenario ? `?scenario=${encodeURIComponent(syntheticScenario)}` : ''}`);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function openCandidate(candidateId) {
    if (!consultingCandidates(state.candidates).some((person) => person.candidate_id === candidateId)) return;
    window.location.assign(consultingCandidatePath(candidateId));
  }

  const mapVisible = active === 'home' || active === 'master-control';
  return (
    <div className={`recruiting-v1 campaign-shell ${mapVisible ? 'campaign-layer-zero-shell' : 'campaign-layer-one-shell'}`} data-synthetic={SYNTHETIC ? 'true' : 'false'}>
      <ProductHeader manager={state.manager} role={admin ? 'Recruiting Admin' : 'Manager'}
        backLabel={!mapVisible ? 'Back to My Recruits' : null}
        onBack={() => navigateTo(admin ? 'master-control' : 'home')}
        meta={SYNTHETIC ? 'Synthetic founder review · No production activity' : null} error={error} />
      <p className="preparation-announcement" role="status" aria-live="polite" aria-atomic="true">{preparationAnnouncement}</p>
      <main className="recruiting-main">
        {active === 'home' && <ManagerJourneyMap state={state} navigate={navigateTo} />}
        {active === 'invite' && <InviteSurface state={state} setState={setState} setError={setError} openCandidate={openCandidate} onRefresh={refreshHome} refreshing={refreshing} onPrepare={prepareCandidate} preparationByCandidate={preparationByCandidate} preparationInFlight={preparationInFlight} />}
        {active === 'consulting' && <ConsultingSurface state={state} navigate={navigateTo} openCandidate={openCandidate} onRefresh={refreshHome} refreshing={refreshing} onPrepare={prepareCandidate} preparationByCandidate={preparationByCandidate} preparationInFlight={preparationInFlight} />}
        {active === 'master-control' && <RecruitingMasterControl data={state.master_control} request={api} synthetic={SYNTHETIC} refresh={refreshMasterControl} setError={setError} navigate={navigateTo} />}
      </main>
    </div>
  );
}

function ManagerJourneyMap({ state, navigate }) {
  const ready = consultingCandidates(state.candidates).length;
  const cards = MANAGER_DESTINATIONS.map((card) => ({
    ...card,
    state: card.id === 'invite' ? allowanceLabel(invitationAllowance(state)) : `${ready} ready`,
  }));
  return <JourneyMap eyebrow="My Recruits" title="Invite with purpose. Consult with understanding."
    subtitle="One invitation includes both BOS and BA. Open the Consulting Tool when both results are ready."
    cards={cards} onOpen={navigate}
    footerLeft={<><b>{state.candidates?.length || 0} invited people</b><span>{allowanceResetLabel(invitationAllowance(state))}</span></>}
    footerRight="Your authorized relationships stay private." />;
}

function ManagerInvitationBalance({ state }) {
  const allowance = invitationAllowance(state);
  return <section className="manager-product-balances" aria-label="Combined BOS and BA invitation allowance">
    <article><small>Free BOS + BA invitations</small><strong>{allowanceLabel(allowance)}</strong><small>One invitation includes both assessments</small></article>
    <article><small>Authoritative monthly period</small><strong>{allowanceResetLabel(allowance)}</strong><small>{allowance?.used ?? '—'} {allowance?.used === 1 ? 'invitation' : 'invitations'} used this period</small></article>
  </section>;
}

function ManagerProgressNotifications({ notifications = [], candidates = [] }) {
  if (!notifications.length) return null;
  return <section className="manager-progress-notifications" aria-label="Candidate progress notifications"><header><div><p className="eyebrow violet">Current progress</p><h2>Where things stand</h2></div><span>Readiness only · continuation stays with the recruit</span></header><div>{uniqueCandidateNotifications(notifications).slice(0, 4).map((notification) => {
    const current = presentRecruitingNotification(notification, candidates);
    return <article key={notification.notification_id} className={notification.read ? 'read' : 'unread'}><span>{notification.read ? '✓' : '✦'}</span><div><strong>{current.title}</strong><p>{current.body}</p></div><small>{current.label}</small></article>;
  })}</div></section>;
}

function CandidateCard({ candidate, onOpen, onResend, onRequestCurrentConsent, sending }) {
  const ready = consultingCandidates([candidate]).length === 1;
  const currentConsentRequired = candidate?.consulting_preparation_blocker === 'RECRUITING_CONSULTING_CURRENT_CONSENT_REQUIRED';
  const currentConsentRequestActive = currentConsentRequired
    && ['PENDING', 'DELIVERED'].includes(candidate?.current_consent_request_delivery_state);
  const Card = ready ? 'button' : 'article';
  const progress = recruitProgressLabel(candidate);
  return <Card {...(ready ? { type: 'button', onClick: onOpen } : {})} className="candidate-card" data-consulting-ready={ready ? 'true' : 'false'}>
    <div className="candidate-avatar">{String(candidate?.recruit_name || '').split(' ').map((part) => part[0]).join('').slice(0, 2)}</div>
    <div><small>{ready ? 'Authorized consultation' : 'Invitation progress'}</small><h3>{candidate.recruit_name || 'Recruit'}</h3><p>{candidate.purpose}</p></div>
    <span className={`status-pill status-${ready ? 'ba_intelligence_ready' : 'invited'}`}>{progress}</span>
    <footer><small>{candidate.delivery_state ? `Delivery: ${candidate.delivery_state.replaceAll('_', ' ').toLowerCase()}` : 'Delivery status pending'}</small>{currentConsentRequestActive ? <b>{candidate.current_consent_request_delivery_state === 'DELIVERED' ? 'Current-consent request sent' : 'Current-consent request pending'}</b> : currentConsentRequired && onRequestCurrentConsent ? <button className="text-action" type="button" disabled={sending} onClick={() => onRequestCurrentConsent(candidate)}>{candidate.current_consent_request_generation ? 'Retry current consent →' : 'Request current consent →'}</button> : !ready && onResend && mayResendInvitation(candidate) ? <button className="text-action" type="button" disabled={sending} onClick={() => onResend(candidate)}>Resend invitation →</button> : <b>{ready ? 'Open Consulting Tool →' : currentConsentRequired ? 'Current consent is required before preparation' : 'Both BOS and BA must be ready'}</b>}</footer>
  </Card>;
}

function PeopleList({ candidates, openCandidate, readyOnly = false, navigate, onResend, onRequestCurrentConsent, sending }) {
  const visible = readyOnly ? consultingCandidates(candidates) : candidates || [];
  return <section className="candidate-section" aria-label={readyOnly ? 'Ready to consult' : 'All invited people'}>
    <div className="section-heading"><div><p className="eyebrow teal">{readyOnly ? 'Ready to consult' : 'All invited people'}</p><h2>{readyOnly ? 'Choose who you are meeting with.' : 'Every invitation, including completed assessments.'}</h2></div><span>{visible.length} {visible.length === 1 ? 'person' : 'people'}</span></div>
    {visible.length ? <div className="candidate-grid">{visible.map((person) => <CandidateCard key={person.candidate_id || person.invitation_id} candidate={person} onOpen={() => openCandidate(person.candidate_id)} onResend={onResend} onRequestCurrentConsent={onRequestCurrentConsent} sending={sending} />)}</div>
      : <div className="panel master-empty"><h2>{readyOnly ? 'No one is ready to consult yet.' : 'Your invitations will appear here.'}</h2><p>{readyOnly ? 'A person appears here after both BOS and BA are complete and ready. Everyone stays visible in your invitation list.' : 'Invite someone to begin their private BOS and BA path.'}</p>{navigate && <button type="button" className="solid-button inline" onClick={() => navigate('invite')}>Invite a Recruit →</button>}</div>}
  </section>;
}

function hasSavedPreparationProgress(person) {
  return ['BOS_IN_PROGRESS', 'BOS_COMPLETE', 'BA_IN_PROGRESS'].includes(person?.progress_state);
}

function preparationActionLabel(receipt, inFlight, person) {
  if (inFlight) return 'Checking saved progress…';
  if (['RETRYABLE_FAILURE', 'EXECUTION_PAUSED'].includes(receipt?.state)) return 'Retry preparation →';
  if (CONSULTING_PREPARATION_PENDING_STATES.has(receipt?.state) || hasSavedPreparationProgress(person)) return 'Resume preparation →';
  return 'Prepare for Consulting →';
}

function PreparationPeopleList({ candidates, onPrepare, preparationByCandidate, preparationInFlight, activeCandidateId }) {
  const visible = consultingPreparationCandidates(candidates);
  if (!visible.length) return null;
  return <section className="candidate-section consulting-preparation" aria-label="Prepare results for Consulting">
    <div className="section-heading"><div><p className="eyebrow violet">Prepare for Consulting</p><h2>Finish saved results without replacing completed work.</h2></div><span>{visible.length} {visible.length === 1 ? 'person' : 'people'}</span></div>
    <div className="candidate-grid">{visible.map((person) => {
      const receipt = preparationByCandidate[person.candidate_id] || null;
      const pending = CONSULTING_PREPARATION_PENDING_STATES.has(receipt?.state);
      const inFlight = preparationInFlight === person.candidate_id;
      const anotherActive = Boolean(activeCandidateId && activeCandidateId !== person.candidate_id);
      const intakeRequired = ['BOS_INTAKE_REQUIRED', 'BA_INTAKE_REQUIRED'].includes(receipt?.state);
      const reviewRequired = CONSULTING_PREPARATION_REVIEW_STATES.has(receipt?.state);
      const resumable = hasSavedPreparationProgress(person);
      const message = receipt?.message || (pending
        ? CONSULTING_PREPARATION_WAITING_COPY
        : resumable
          ? 'Saved progress is ready to resume. Completed BOS or BA results will be reused unchanged.'
          : 'Use the saved assessment state to prepare only the missing results.');
      return <article className="candidate-card preparation-card" key={person.candidate_id} data-preparation-state={receipt?.state || 'AVAILABLE'}>
        <div className="candidate-avatar">{String(person.recruit_name || '').split(' ').map((part) => part[0]).join('').slice(0, 2)}</div>
        <div><small>Accepted relationship</small><h3>{person.recruit_name || 'Recruit'}</h3><p>{person.purpose}</p></div>
        <span className={`status-pill status-${pending ? 'ba_in_progress' : 'invited'}`}>{receipt?.state ? receipt.state.replaceAll('_', ' ').toLowerCase() : recruitProgressLabel(person)}</span>
        <div className="preparation-status" role={receipt?.state === 'RETRYABLE_FAILURE' || reviewRequired ? 'alert' : 'status'} aria-live="polite">
          <p>{message}</p>
          {intakeRequired && <small>The recruit must finish the named assessment before preparation can continue.</small>}
          {pending && <small>Time is guidance, not a promised maximum. Refreshing will not replace saved results.</small>}
        </div>
        <footer><small>Completed BOS or BA results are reused unchanged.</small>{!intakeRequired && !reviewRequired && <button className="text-action" type="button" disabled={inFlight || anotherActive} onClick={() => onPrepare(person.candidate_id)}>{preparationActionLabel(receipt, inFlight, person)}</button>}</footer>
      </article>;
    })}</div>
  </section>;
}

function ConsultingSurface({ state, navigate, openCandidate, onRefresh, refreshing, onPrepare, preparationByCandidate, preparationInFlight }) {
  return <section className="surface home-surface" data-surface="consulting"><p className="eyebrow green">Consulting Tool</p><h1>Begin with the whole picture.</h1><p className="surface-subhead">Open the same shared consultation with HOME, YOU, YOUR BUSINESS and PLAN. The accepted relationship connects the person's results for you.</p>
    <div className="manager-readiness-controls"><button type="button" onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh readiness'}</button></div>
    <PreparationPeopleList candidates={state.candidates} onPrepare={onPrepare} preparationByCandidate={preparationByCandidate} preparationInFlight={preparationInFlight} activeCandidateId={preparationInFlight || Object.keys(preparationByCandidate).find((candidateId) => CONSULTING_PREPARATION_PENDING_STATES.has(preparationByCandidate[candidateId]?.state)) || null} />
    <PeopleList candidates={state.candidates} readyOnly openCandidate={openCandidate} navigate={navigate} />
  </section>;
}

function InviteSurface({ state, setState, setError, openCandidate, onRefresh, refreshing, onPrepare, preparationByCandidate, preparationInFlight }) {
  const [form, setForm] = useState({ recruit_name: '', recruit_email: '', purpose: 'Offer a private MORE MindMap profile and Business Assessment before a consultation about their business.' });
  const [sent, setSent] = useState(null);
  const [sending, setSending] = useState(false);
  const submissionLocked = useRef(false);
  const allowance = invitationAllowance(state);
  const canInvite = allowance?.mode === 'unlimited' || Number(allowance?.remaining) > 0;
  async function refreshAfterFailure(failure) {
    setSent(null);
    let currentAllowance = allowance;
    if (!SYNTHETIC) {
      try {
        const current = await api({ view: 'home' });
        currentAllowance = invitationAllowance(current);
        setState(current);
      }
      catch { /* Retain the original failure if the readiness refresh is also unavailable. */ }
    }
    setError(invitationErrorMessage(failure, currentAllowance));
  }
  async function resend(person) {
    if (!mayResendInvitation(person) || submissionLocked.current) return;
    submissionLocked.current = true;
    setSending(true);
    setSent(null);
    setError('');
    try {
      let superseded = false;
      if (SYNTHETIC) {
        if (!canInvite) throw new Error('No free invitations remain in this period.');
        setState((current) => ({ ...current, candidates: current.candidates.map((item) => item.invitation_id === person.invitation_id ? { ...item, state: 'DELIVERED', delivery_state: 'SYNTHETIC_CAPTURE' } : item), invitation_allowance: { ...current.invitation_allowance, used: (current.invitation_allowance.used || 0) + 1, remaining: current.invitation_allowance.mode === 'unlimited' ? null : current.invitation_allowance.remaining - 1 } }));
      } else {
        const result = await api({ action: 'RESEND_INVITATION', body: { invitation_id: person.invitation_id, expected_resend_count: person.resend_count || 0 } });
        superseded = result.resend_superseded === true;
        setState(await api({ view: 'home' }));
      }
      setSent({ person, resent: !superseded, duplicate: superseded });
    } catch (failure) { await refreshAfterFailure(failure); }
    finally { submissionLocked.current = false; setSending(false); }
  }
  async function requestCurrentConsent(person) {
    if (person?.consulting_preparation_blocker !== 'RECRUITING_CONSULTING_CURRENT_CONSENT_REQUIRED' || submissionLocked.current) return;
    submissionLocked.current = true;
    setSending(true);
    setSent(null);
    setError('');
    try {
      if (SYNTHETIC) {
        setState((current) => ({
          ...current,
          candidates: current.candidates.map((item) => item.invitation_id === person.invitation_id ? {
            ...item,
            current_consent_request_generation: Number(item.current_consent_request_generation || 0) + 1,
            current_consent_request_delivery_state: 'SYNTHETIC_CAPTURE',
          } : item),
        }));
      } else {
        await api({ action: 'REQUEST_CURRENT_CONSENT', body: {
          invitation_id: person.invitation_id,
          expected_generation: Number(person.current_consent_request_generation || 0),
        } });
        setState(await api({ view: 'home' }));
      }
      setSent({ person, currentConsentRequested: true });
    } catch (failure) { await refreshAfterFailure(failure); }
    finally { submissionLocked.current = false; setSending(false); }
  }
  async function submit(event) {
    event.preventDefault();
    if (submissionLocked.current) return;
    submissionLocked.current = true;
    setSending(true);
    setSent(null);
    setError('');
    try {
      if (SYNTHETIC) {
        const existing = state.candidates.find((person) => person.recruit_email?.trim().toLowerCase() === form.recruit_email.trim().toLowerCase() && person.state !== 'REVOKED');
        if (existing) { setSent({ person: existing, duplicate: true }); return; }
        if (!canInvite) throw new Error('No free invitations remain in this period.');
        const person = { invitation_id: `invite_synthetic_${Date.now()}`, candidate_id: `candidate_synthetic_${Date.now()}`, ...form, state: 'DELIVERED', progress_state: 'INVITED', consulting_ready: false, ba_readiness: 'BA_NOT_STARTED', delivery_state: 'SYNTHETIC_CAPTURE', issued_at: new Date().toISOString() };
        setState((current) => ({ ...current, candidates: [person, ...current.candidates], invitation_allowance: { ...current.invitation_allowance, used: (current.invitation_allowance.used || 0) + 1, remaining: canInvite && current.invitation_allowance.mode !== 'unlimited' ? current.invitation_allowance.remaining - 1 : null } }));
        setSent({ person, duplicate: false });
      } else {
        const payload = await api({ action: 'CREATE_INVITATION', body: form });
        setSent({ person: payload.invitation, duplicate: payload.duplicate_active === true });
        setState(await api({ view: 'home' }));
      }
    } catch (failure) { await refreshAfterFailure(failure); }
    finally { submissionLocked.current = false; setSending(false); }
  }
  return <section className="surface invite-surface" data-surface="invite">
    <p className="eyebrow green">Invite a Recruit</p><h1>Make the purpose clear before you ask for trust.</h1>
    <p className="surface-subhead">One free invitation includes BOS and BA. The person sees your purpose and chooses whether to share their results.</p>
    <ManagerInvitationBalance state={state} />
    {sent && <div className="master-notice" role="status">{sent.currentConsentRequested ? `A current-consent request on the same invitation was recorded for ${sent.person.recruit_name}. Their candidate, completed results and invitation allowance remain unchanged.` : sent.duplicate ? `${sent.person.recruit_name} is already invited. Current status: ${recruitProgressLabel(state.candidates.find((person) => person.invitation_id === sent.person.invitation_id) || sent.person)}. No additional invitation used.` : `${sent.resent ? 'Resend' : 'Invitation'} recorded for ${sent.person.recruit_name}. Delivery and assessment progress appear below.`}</div>}
    <div className="invite-layout"><form className="panel invite-form" onSubmit={submit}><p className="eyebrow blue">Invitation details</p>
      <label>Recruit name<input required value={form.recruit_name} onChange={(event) => setForm({ ...form, recruit_name: event.target.value })} placeholder="e.g. Maya Chen" /></label>
      <label>Recruit email<input required type="email" value={form.recruit_email} onChange={(event) => setForm({ ...form, recruit_email: event.target.value })} placeholder="maya@example.com" /></label>
      <label>Purpose visible to the recruit<textarea required value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} rows="5" /></label>
      <button type="submit" className="solid-button" disabled={sending || !allowance}>{sending ? 'Checking invitation…' : canInvite ? 'Send private invitation →' : 'Check existing invitation →'}</button>
      <small>{canInvite ? 'One combined invitation. An already-invited person uses no additional allowance.' : 'No free invitations remain. You can still check an existing invitation without using another slot.'} Delivery status stays visible below.</small>
    </form><article className="panel recruit-preview"><p className="eyebrow violet">Recruit view preview</p><span className="gift-mark">✦</span><small>A private invitation from</small><h2>{state.manager.name}</h2><p>{form.purpose}</p><div><b>Before you accept</b><ul><li>You choose whether to begin.</li><li>Your profile stays yours.</li><li>BOS and BA are included in this invitation.</li><li>Your results are shared through the relationship you accept.</li></ul></div></article></div>
    <div className="manager-readiness-controls"><button type="button" onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh readiness'}</button></div>
    <ManagerProgressNotifications notifications={state.notifications} candidates={state.candidates} />
    <PeopleList candidates={state.candidates} openCandidate={openCandidate} onResend={resend} onRequestCurrentConsent={requestCurrentConsent} sending={sending} />
    {state.manager.capabilities?.master_control && <><PreparationPeopleList candidates={state.candidates} onPrepare={onPrepare} preparationByCandidate={preparationByCandidate} preparationInFlight={preparationInFlight} activeCandidateId={preparationInFlight || Object.keys(preparationByCandidate).find((candidateId) => CONSULTING_PREPARATION_PENDING_STATES.has(preparationByCandidate[candidateId]?.state)) || null} /><PeopleList candidates={state.candidates} readyOnly openCandidate={openCandidate} /></>}
  </section>;
}

function InvitationAcceptance() {
  const location = useLocation();
  const token = decodeURIComponent(location.pathname.slice('/recruiting/accept/'.length));
  const navigate = useNavigate();
  const [preview, setPreview] = useState(SYNTHETIC ? clone(SYNTHETIC_RECRUITING_FIXTURE.invite_preview) : null);
  const [status, setStatus] = useState('preview');
  const [error, setError] = useState('');
  useEffect(() => { if (!SYNTHETIC) api({ view: 'invite_preview', query: { token } }).then((payload) => setPreview(payload.preview)).catch((failure) => setError(failure.message)); }, [token]);
  async function accept() {
    try {
      if (!SYNTHETIC) await api({ action: 'ACCEPT_INVITATION', body: { token, consent: { accepted: true, version: 'recruiting_v1_consent_2026_08' } } });
      window.history.replaceState({}, '', '/recruiting/accepted');
      setStatus('accepted');
    } catch (failure) { setError(failure.message); }
  }
  if (!preview) return <LoadingState message={error || 'Opening the private invitation…'} />;
  const consentRefresh = preview.current_consent_refresh === true;
  return <main className="recruiting-invite-public" data-synthetic={SYNTHETIC ? 'true' : 'false'}><div className="public-brand"><span>+</span><strong>MORE MINDMAP</strong><small>{SYNTHETIC ? 'Synthetic founder review' : consentRefresh ? 'Current consent review' : 'Private invitation'}</small></div>{status === 'preview' ? <article><p className="eyebrow green">{consentRefresh ? 'Current consent requested by' : 'A private invitation from'}</p><h1>{preview.inviter_name}</h1><h2>{preview.enterprise_name}</h2><div className="public-purpose"><small>{consentRefresh ? 'Your existing recruiting purpose' : 'Why you are receiving this'}</small><p>{preview.purpose}</p></div><section><h3>Before you accept</h3><ul><li>You choose whether to continue.</li><li>Your MORE MindMap Profile remains yours.</li><li>Your results connect only to the recruiting relationship you accept.</li><li>{consentRefresh ? 'Your completed BOS and BA results remain unchanged.' : 'This invitation includes your Business Assessment.'}</li></ul></section><button type="button" onClick={accept}>{consentRefresh ? 'I understand - record current consent →' : 'I understand - accept invitation →'}</button><small>{consentRefresh ? 'Consent request' : 'Invitation'} expires {new Date(preview.expires_at).toLocaleDateString()} · No purchase required</small>{error && <strong role="alert">{error}</strong>}</article> : <article className="accepted"><span>✓</span><p className="eyebrow green">{consentRefresh ? 'Current consent recorded' : 'Invitation accepted'}</p><h1>Your choice is recorded.</h1><p>Your private continuation keeps the Profile and Business Assessment connected to this one invitation.</p><button type="button" onClick={() => navigate('/recruiting/continue')}>Open my private continuation →</button></article>}</main>;
}

function ManagerVerification() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = decodeURIComponent(location.pathname.slice('/recruiting/verify/'.length));
  const [status, setStatus] = useState(SYNTHETIC ? 'verified' : 'verifying');
  const [message, setMessage] = useState(SYNTHETIC ? 'Synthetic manager membership verified.' : 'Verifying the single-use manager link…');
  useEffect(() => {
    if (SYNTHETIC) {
      window.history.replaceState({}, '', '/recruiting/home');
      return;
    }
    api({ action: 'VERIFY_MANAGER', body: { token } }).then(() => {
      window.history.replaceState({}, '', '/recruiting/home');
      setStatus('verified');
      setMessage('Manager membership verified.');
    }).catch((error) => {
      window.history.replaceState({}, '', '/recruiting/verification-failed');
      setStatus('failed');
      setMessage(error.message === 'RECRUITING_MANAGER_CHALLENGE_INVALID'
        ? 'This verification link has expired or was already used. Request a fresh link.'
        : error.message);
    });
  }, [token]);
  return <main className="manager-onboarding"><div className="loading-mark">{status === 'failed' ? '!' : '✓'}</div><h1>{message}</h1>{status === 'verified' && <button type="button" onClick={() => navigate('/recruiting/home', { replace: true })}>Open My Recruits →</button>}{status === 'failed' && <button type="button" onClick={() => navigate('/recruiting/home', { replace: true })}>Request another verification link →</button>}</main>;
}

function ManagerOnboarding({ onVerified }) {
  const [profileId, setProfileId] = useState(''); const [token, setToken] = useState(''); const [stage, setStage] = useState('profile'); const [message, setMessage] = useState('');
  async function request(event) { event.preventDefault(); try { const result = await api({ action: 'REQUEST_MANAGER_VERIFICATION', body: { profile_id: profileId } }); setMessage(`Verification sent to ${result.masked_email}.`); if (result.verification_token) setToken(result.verification_token); setStage('verify'); } catch (error) { setMessage(error.message); } }
  async function verify(event) { event.preventDefault(); try { await api({ action: 'VERIFY_MANAGER', body: { token } }); onVerified(); } catch (error) { setMessage(error.message); } }
  return <main className="manager-onboarding"><form onSubmit={stage === 'profile' ? request : verify}><p>Recruiting Intelligence</p><h1>{stage === 'profile' ? 'Verify your enterprise manager access.' : 'Use the single-use verification link.'}</h1><span>Profile ID selects a pre-approved membership. It is never your credential.</span>{stage === 'profile' ? <label>Verified manager Profile ID<input value={profileId} onChange={(event) => setProfileId(event.target.value)} placeholder="MM-YYYYMMDD-XXXXXXXX" /></label> : <label>Single-use verification token<input value={token} onChange={(event) => setToken(event.target.value)} /></label>}<button type="submit">{stage === 'profile' ? 'Send verification link' : 'Verify and open Recruiting'}</button>{message && <strong>{message}</strong>}</form></main>;
}

function LoadingState({ message = 'Opening My Recruits…' }) { return <main className="manager-onboarding"><div className="loading-mark">+</div><h1>{message}</h1></main>; }
