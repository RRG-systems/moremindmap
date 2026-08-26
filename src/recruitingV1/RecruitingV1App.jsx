import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SYNTHETIC_RECRUITING_FIXTURE } from '../lib/recruitingV1/syntheticFixture.js';
import { SYNTHETIC_REAL_ESTATE_SUBJECTS_V1 } from '../lab/subscriptionLivingBusinessRelationshipV1/createSyntheticRealEstateFounderSubjectsV1.js';
import { selectRecruitingCandidate } from '../lib/recruitingV1/candidateSelection.js';
import RecruitingManagerSetup from './RecruitingManagerSetup.jsx';
import RecruitingMasterControl from './RecruitingMasterControl.jsx';
import { CandidateAnchor, DetailDrawer, JourneyMap, ProductHeader } from './RecruitingExperienceShell.jsx';
import {
  RECRUITING_MANAGER_WORKSPACE_PATH,
  resolveAuthenticatedRecruitingLanding,
} from '../lib/recruitingV1/landing.js';
import './recruitingV1.css';

const SYNTHETIC = import.meta.env.VITE_RECRUITING_V1_SYNTHETIC_REVIEW === 'true';
const clone = (value) => JSON.parse(JSON.stringify(value));
let recruitingCsrfToken = null;
let recruitingSetupCsrfToken = null;
let recruitingDemoCsrfToken = null;

const destinations = [
  ['home', '01', 'Recruiting Home'],
  ['invite', '02', 'Invite a Recruit'],
  ['candidate', '03', 'Candidate Ready'],
  ['opportunity', '04', 'Local Opportunity'],
  ['evidence', '05', 'Add What You Know'],
  ['intelligence', '06', 'Recruiting Intelligence'],
  ['meeting', '07', 'Meeting Plan'],
  ['export', '08', 'Save / Print'],
];

const managerMapDestinations = [
  ['home', 'Recruiting Home', 'Choose a candidate and see the next truthful step.', 'Open command center', 'green'],
  ['invite', 'Invite & Readiness', 'Invite with consent, then see what is actually ready.', 'Invite or check readiness', 'violet'],
  ['opportunity', 'Local Opportunity', 'Define what this leader can genuinely help an agent build.', 'Review local truth', 'amber'],
  ['evidence', 'What You Know', 'Add facts and observations without rewriting recruit-owned truth.', 'Add evidence', 'blue'],
  ['intelligence', 'Recruiting Intelligence', 'Understand both people and the authentic paths supported by evidence.', 'Open intelligence', 'teal'],
  ['meeting', 'Meeting & Brief', 'Prepare, listen, avoid assumptions, and take the one-page brief.', 'Prepare the meeting', 'coral'],
];

function syntheticFixtureForScenario(name) {
  const fixture = clone(SYNTHETIC_RECRUITING_FIXTURE);
  if (name === 'empty') fixture.candidates = [];
  if (name === 'exhausted') fixture.entitlement = { ...fixture.entitlement, remaining: 0, reserved: 3, consumed: 2 };
  if (name === 'provider-error') fixture.intelligence = null;
  if (name === 'stale') fixture.intelligence.stale = true;
  if (name === 'opportunity-empty') fixture.opportunity.items = [];
  return fixture;
}

function syntheticDarrenDemoReviewState() {
  const jordan = SYNTHETIC_REAL_ESTATE_SUBJECTS_V1['re-mid'];
  const candidate = {
    candidate_id: 'demo_synthetic_jordan_v1', invitation_id: null, recruit_name: 'Jordan Lee', recruit_email: null,
    purpose: 'Synthetic Recruiting V1 demonstration only.', state: 'DEMO_ONLY', readiness_state: 'BA_INTELLIGENCE_READY',
    ba_readiness: 'BA_INTELLIGENCE_READY', delivery_state: 'NOT_APPLICABLE', entitlement_state: 'NOT_APPLICABLE', accepted_at: null,
    bos_profile_id: 'synthetic:re-mid:bos-v1', ba_assessment_id: 'synthetic:re-mid:ba-v1', demo_only: true, synthetic_only: true,
  };
  return {
    contract: 'recruiting_darren_synthetic_demo_v1', baseline_version: '1.0.0', demo_only: true, synthetic_only: true,
    label: 'DEMO CANDIDATE — SYNTHETIC DATA', resettable: true,
    manager: { name: 'Darren Synthetic', enterprise_name: 'MORE MindMap', capabilities: { darren_demo: true } },
    entitlement: { mode: 'unlimited', used: 0, reserved: 0, consumed: 0, remaining: null, synthetic_only: true, ledger_written: false }, candidates: [candidate],
    recruit: { name: 'Jordan Lee', readiness: 'BA_INTELLIGENCE_READY', bos_summary: `${jordan.wholePerson.communication} ${jordan.wholePerson.motivation}`, ba_summary: jordan.businessReality, known: ['Synthetic BOS authority ready', 'Synthetic BA authority ready', ...jordan.known.slice(0, 4)], unknown: clone(jordan.missing) },
    opportunity: { authority_id: 'demo_synthetic_opportunity_jordan_v1', demo_only: true, items: [
      { opportunity_evidence_id: 'demo_opp_evidence_review', category: 'COACHING_AND_TRAINING', scope: 'LOCAL_LEADER_PRIMARY', statement: 'The synthetic demo assumes access to a structured opportunity-and-capacity evidence review; actual Darren or enterprise capabilities are not asserted.', status: 'SUPPORTED', source: 'Synthetic demo authority', source_date: '2026-08-23', freshness: 'SYNTHETIC_BASELINE', constraints: ['Demo-only capability; verify real availability before any customer conversation.'], counterevidence: [], demo_only: true },
      { opportunity_evidence_id: 'demo_opp_leverage_hypothesis', category: 'OPERATIONS_AND_LEVERAGE', scope: 'LOCAL_LEADER_PRIMARY', statement: 'A bounded first-leverage decision review is available in the synthetic scenario when opportunity, economics, and transferable-work evidence support it.', status: 'CONDITIONAL', source: 'Synthetic demo authority', source_date: '2026-08-23', freshness: 'SYNTHETIC_BASELINE', constraints: ['No hiring outcome or operating support is promised.'], counterevidence: ['Jordan may need better opportunity evidence before leverage is the next move.'], demo_only: true },
      { opportunity_evidence_id: 'demo_opp_no_lead_promise', category: 'LEAD_OPPORTUNITY', scope: 'LOCAL_LEADER_PRIMARY', statement: 'The demo establishes no company-provided lead volume, allocation, or conversion outcome.', status: 'NON_PROMISE', source: 'Synthetic demo authority', source_date: '2026-08-23', freshness: 'SYNTHETIC_BASELINE', constraints: [], counterevidence: [], demo_only: true },
    ] },
    manager_evidence: [
      { evidence_id: 'demo_evidence_growth_goal', candidate_id: candidate.candidate_id, type: 'GOAL', claim: jordan.goal, source: 'Synthetic Jordan fixture', source_date: '2026-08-23', truth_class: 'MANAGER_SUPPLIED_EVIDENCE', demo_only: true },
      { evidence_id: 'demo_evidence_leverage_question', candidate_id: candidate.candidate_id, type: 'OBSERVATION', claim: 'Jordan is considering a first assistant, while the scenario intentionally leaves the dominant constraint unresolved.', source: 'Synthetic Jordan fixture', source_date: '2026-08-23', truth_class: 'MANAGER_SUPPLIED_EVIDENCE', demo_only: true },
    ],
    intelligence: { contract: 'recruiting_intelligence_projection_v1', generated_at: '2026-08-23T00:00:00.000Z', stale: false, demo_only: true, synthetic_recruit: true, output: {
      understand_this_recruit: { summary: 'Jordan is pursuing material growth while testing whether stronger operating evidence or first leverage deserves priority.', important_realities: ['The growth goal is explicit.', 'The dominant constraint remains deliberately unresolved.'] },
      bilateral_communication: { advantage: 'Darren can make the decision concrete without pretending the missing evidence is settled.', recruiter_watchout: 'A decisive recommendation would outrun the synthetic evidence currently available.', adaptation: 'Separate opportunity-flow proof from leverage readiness and let Jordan test both hypotheses.' },
      authentic_angles: [{ title: 'Test the first-leverage decision against current opportunity flow', recruit_need: 'Jordan wants growth without simply adding personal workload.', current_reality: 'The scenario supports a leverage question but leaves pipeline and transferable-work evidence incomplete.', locally_supported_help: 'A synthetic bounded opportunity-and-capacity evidence review is supported in this demo.', rationale: 'The review can distinguish whether leverage or opportunity generation is the nearer constraint.', validating_question: 'What evidence would tell you an assistant removes a real constraint rather than adding management work?', uncertainty: 'Actual repeatable opportunity flow and transferable work volume remain unknown.', recruit_evidence_ids: ['demo_evidence_growth_goal'], opportunity_evidence_ids: ['demo_opp_evidence_review'] }],
      withheld_angles: ['No lead-volume or production promise is supported by the synthetic opportunity authority.'],
      success_environment: { natural_success_patterns: ['Purposeful relationship-led growth with visible operating proof'], supportive_conditions: ['Clear ownership boundaries', 'Truthful weekly numbers'], likely_frictions: ['Hiring before work and economics are visible'] },
      missing_evidence: ['Qualified opportunity flow', 'Transferable recurring work', 'Assistant economics'],
      meeting_plan: { start_here: 'Ask Jordan what changed between the current production level and the stated growth goal.', learn: ['How opportunity is created now', 'Which recurring work can leave Jordan’s hands'], listen_for: ['A demand constraint', 'An ownership constraint'], your_watchout: 'Do not assume first leverage is the answer because it is under consideration.', supported_paths_if_confirmed: ['Opportunity-and-capacity evidence review'], do_not_assume: 'Do not imply a lead source, staffing result, or recruiting promise.', next_step_if_fit_is_real: 'Agree on one bounded evidence review before recommending a move.' },
    } },
    ledger_effect: { invitations: 0, emails: 0, relationships: 0, entitlement: 0, recruiting_audit: 0 },
  };
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

async function demoApi({ view, action, body = {} }) {
  const url = new URL('/api/recruiting/demo', window.location.origin);
  if (view) url.searchParams.set('view', view);
  const response = await fetch(url, {
    method: action ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
    headers: action ? {
      'content-type': 'application/json',
      ...(recruitingDemoCsrfToken ? { 'x-recruiting-demo-csrf': recruitingDemoCsrfToken } : {}),
    } : {},
    body: action ? JSON.stringify({ action, ...body }) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (payload.csrf_token) recruitingDemoCsrfToken = payload.csrf_token;
  if (!response.ok || payload.ok !== true) throw new Error(payload.code || 'The synthetic demo is temporarily unavailable.');
  return payload;
}

function routeFor(pathname) {
  const part = pathname.split('/').filter(Boolean)[1] || 'home';
  if (part === 'master-control') return part;
  return destinations.some(([id]) => id === part) ? part : 'home';
}

export default function RecruitingV1App() {
  const location = useLocation();
  if (location.pathname === '/recruiting/demo') return <RecruitingDemoExperience />;
  if (location.pathname.startsWith('/recruiting/accept/')) return <InvitationAcceptance />;
  if (location.pathname.startsWith('/recruiting/verify/')) return <ManagerVerification />;
  if (location.pathname.startsWith('/recruiting/setup')) return <RecruitingManagerSetup request={api} synthetic={SYNTHETIC} fixture={SYNTHETIC_RECRUITING_FIXTURE} />;
  return <ManagerExperience />;
}

function RecruitingDemoExperience() {
  const navigate = useNavigate();
  const [state, setState] = useState(SYNTHETIC ? syntheticDarrenDemoReviewState() : null);
  const [status, setStatus] = useState(SYNTHETIC ? 'ready' : 'loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (SYNTHETIC) return;
    demoApi({ view: 'demo' })
      .then((payload) => {
        setState(payload.demo);
        setStatus('ready');
      })
      .catch((failure) => {
        setError(failure.message);
        setStatus('unauthorized');
      });
  }, []);

  if (status === 'loading') return <LoadingState message="Opening Jordan’s synthetic Recruiting demo…" />;
  if (status === 'unauthorized' || !state) {
    return <main className="manager-onboarding"><div className="loading-mark">!</div><h1>A fresh Leadership demo session is required.</h1><p>{error || 'This synthetic capability is missing or expired.'}</p><button type="button" onClick={() => navigate('/leadership', { replace: true })}>Return to Leadership Portal →</button></main>;
  }

  return (
    <div className="recruiting-v1 campaign-shell campaign-layer-one-shell" data-synthetic-demo="true">
      <ProductHeader
        manager={state.manager}
        role="Synthetic Recruiting Demo"
        meta="Synthetic Darren + Jordan · No manager session or customer activity"
        error={error}
      />
      <main className="recruiting-main">
        <DarrenSyntheticDemoSurface
          state={state}
          setState={setState}
          setError={setError}
          exit={() => navigate('/leadership-demo')}
        />
      </main>
    </div>
  );
}

function ManagerExperience() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialLocation = useRef({ pathname: location.pathname, search: location.search });
  const homeHydrationStarted = useRef(false);
  const active = routeFor(location.pathname);
  const syntheticScenario = new URLSearchParams(location.search).get('scenario');
  const [state, setState] = useState(SYNTHETIC ? syntheticFixtureForScenario(syntheticScenario) : null);
  const [sessionStatus, setSessionStatus] = useState(SYNTHETIC ? 'ready' : 'loading');
  const [error, setError] = useState(SYNTHETIC && syntheticScenario === 'error' ? 'Synthetic review: Recruiting Intelligence is temporarily unavailable.' : '');
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const selected = selectRecruitingCandidate(state?.candidates, selectedCandidateId);

  useEffect(() => {
    if (SYNTHETIC || homeHydrationStarted.current) return;
    homeHydrationStarted.current = true;
    api({ view: 'home' }).then((payload) => {
      setState(payload);
      setSessionStatus('ready');
      const landingPath = resolveAuthenticatedRecruitingLanding({
        ...initialLocation.current,
        manager: payload.manager,
      });
      if (landingPath) navigate(landingPath, { replace: true });
    }).catch(() => setSessionStatus('unauthorized'));
  }, [navigate]);

  useEffect(() => {
    if (SYNTHETIC || !selected?.candidate_id || !['candidate', 'evidence', 'intelligence', 'meeting', 'export'].includes(active)) return;
    api({ view: 'candidate', query: { candidate_id: selected.candidate_id } }).then((payload) => {
      setState((current) => ({ ...current, ...payload.candidate }));
    }).catch((failure) => setError(failure.message));
  }, [active, selected?.candidate_id]);

  useEffect(() => {
    if (SYNTHETIC || active !== 'opportunity') return;
    api({ view: 'opportunity' }).then((payload) => {
      setState((current) => ({ ...current, opportunity: payload.opportunity }));
    }).catch((failure) => setError(failure.message));
  }, [active]);

  async function refreshMasterControl() {
    if (SYNTHETIC) return;
    const payload = await api({ view: 'master_control' });
    setState((current) => ({ ...current, master_control: payload }));
  }

  useEffect(() => {
    if (SYNTHETIC || active !== 'master-control' || !state?.manager?.capabilities?.master_control) return;
    api({ view: 'master_control' })
      .then((payload) => setState((current) => ({ ...current, master_control: payload })))
      .catch((failure) => setError(failure.message));
  }, [active, state?.manager?.capabilities?.master_control]);

  if (sessionStatus === 'loading') return <LoadingState />;
  if (sessionStatus === 'unauthorized') return <ManagerOnboarding onVerified={() => window.location.assign('/recruiting/home')} />;
  if (!state) return <LoadingState />;

  function navigateTo(id) {
    navigate(`/recruiting/${id}`);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function openManagerDestination(id) {
    if (id === 'home') navigate('/recruiting/home?view=workspace');
    else navigateTo(id);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function openAdminDestination(id) {
    if (id === 'home') navigate(RECRUITING_MANAGER_WORKSPACE_PATH);
    else navigateTo(id);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function openCandidate(candidateId) {
    setSelectedCandidateId(candidateId);
    navigateTo('candidate');
  }

  const masterControl = state.master_control;
  const shellState = active === 'master-control' && masterControl ? {
    ...state,
    manager: {
      name: masterControl.admin.manager_name,
      enterprise_name: masterControl.admin.enterprise_name,
      capabilities: { master_control: true },
    },
    entitlement: masterControl.admin.entitlement,
  } : state;
  const managerMapVisible = active === 'home' && new URLSearchParams(location.search).get('view') !== 'workspace';
  const candidateContextVisible = ['candidate', 'evidence', 'intelligence', 'meeting', 'export'].includes(active)
    || (active === 'opportunity' && Boolean(state.opportunity?.items?.length));
  const role = active === 'master-control' ? 'Recruiting Admin' : 'Manager Recruiting Master';

  return (
    <div className={`recruiting-v1 campaign-shell ${managerMapVisible || active === 'master-control' ? 'campaign-layer-zero-shell' : 'campaign-layer-one-shell'}`} data-synthetic={SYNTHETIC ? 'true' : 'false'}>
      <ProductHeader
        manager={shellState.manager}
        role={role}
        backLabel={!managerMapVisible && active !== 'master-control' ? 'Back to Recruiting Map' : null}
        onBack={() => navigateTo('home')}
        meta={SYNTHETIC ? 'Synthetic founder review · No production activity' : null}
        error={error}
      />
      {candidateContextVisible && <CandidateAnchor candidate={selected} intelligence={state.intelligence} onChange={() => navigate('/recruiting/home?view=workspace')} />}
      <main className="recruiting-main">
          {managerMapVisible && <ManagerJourneyMap state={state} candidate={selected} navigate={openManagerDestination} />}
          {active === 'home' && !managerMapVisible && <HomeSurface state={state} navigate={navigateTo} openCandidate={openCandidate} demoAvailable={SYNTHETIC} />}
          {active === 'invite' && <InviteSurface state={state} setState={setState} setError={setError} navigate={navigateTo} />}
          {active === 'candidate' && <CandidateSurface state={state} candidate={selected} navigate={navigateTo} />}
          {active === 'opportunity' && <OpportunitySurface state={state} setState={setState} />}
          {active === 'evidence' && <EvidenceSurface state={state} setState={setState} candidate={selected} />}
          {active === 'intelligence' && <IntelligenceSurface state={state} setState={setState} candidate={selected} navigate={navigateTo} />}
          {active === 'meeting' && <MeetingSurface state={state} candidate={selected} navigate={navigateTo} />}
          {active === 'export' && <ExportSurface state={state} candidate={selected} />}
          {active === 'master-control' && (state.manager.capabilities?.master_control
            ? <RecruitingMasterControl data={masterControl} request={api} synthetic={SYNTHETIC} refresh={refreshMasterControl} setError={setError} navigate={openAdminDestination} demoAvailable={SYNTHETIC} />
            : <NotReadySurface title="Master Control is not available for this account." copy="Only an approved Recruiting administrator can manage enterprise access and invitation allowances." />)}
      </main>
    </div>
  );
}

function ManagerJourneyMap({ state, candidate, navigate }) {
  const cards = managerMapDestinations.map(([id, title, copy, action, tone]) => {
    let cardState = '';
    if (id === 'home') cardState = `${state.candidates.filter((item) => item.state === 'ACCEPTED').length} active ${state.candidates.filter((item) => item.state === 'ACCEPTED').length === 1 ? 'candidate' : 'candidates'}`;
    if (id === 'invite') cardState = 'BOS + optional BA';
    if (id === 'opportunity') cardState = 'Reusable authority';
    if (id === 'evidence') cardState = `${(state.manager_evidence || []).length} manager ${(state.manager_evidence || []).length === 1 ? 'note' : 'notes'}`;
    if (id === 'intelligence') cardState = `${state.intelligence?.output?.authentic_angles?.length || 0} supported ${(state.intelligence?.output?.authentic_angles?.length || 0) === 1 ? 'path' : 'paths'}`;
    if (id === 'meeting') cardState = '5-minute review';
    return { id, title, copy, action, tone, state: cardState };
  });
  const candidateLine = candidate ? `${candidate.recruit_name}${state.synthetic_only ? ' · synthetic candidate' : ''}` : 'No active candidate selected';
  const readiness = candidate ? `${candidate.bos_profile_id ? 'BOS ready' : 'BOS pending'} · ${candidate.ba_readiness === 'BA_INTELLIGENCE_READY' ? 'BA Intelligence ready' : 'BA optional'} · ${state.intelligence?.output?.authentic_angles?.length || 0} supported paths` : 'Invite a recruit to begin';
  return <JourneyMap eyebrow="A · Candidate Journey Map · Closest to New BA" title="Recruit with understanding, one candidate at a time." subtitle="Six destinations turn Recruiting into a simple customer journey while preserving every governed product truth." cards={cards} onOpen={navigate} footerLeft={<><b>{candidateLine}</b><span>{readiness}</span></>} footerRight="No compatibility score." />;
}

function HomeSurface({ state, navigate, openCandidate, demoAvailable }) {
  return (
    <section className="surface home-surface" data-surface="home">
      <p className="eyebrow green">Candidate Command Center</p>
      <h1>Walk into the next conversation understanding the person - and what you can honestly help them build.</h1>
      <p className="surface-subhead">Recruiting Intelligence separates recruit reality, recruiter reality, manager evidence, and local opportunity truth before it suggests a path.</p>
      <div className="home-actions">
        <button type="button" className="primary-action" onClick={() => navigate('invite')}><span>＋</span><div><small>Primary action</small><strong>Invite a Recruit</strong><p>Give someone a consent-first BOS and optional BA path.</p></div><b>→</b></button>
        <article className="locked-action"><span>◇</span><div><small>Existing agent</small><strong>A private invitation is still required</strong><p>Invite the person so they can see the purpose and choose whether to share their profile.</p></div></article>
      </div>
      {demoAvailable && <button type="button" className="darren-demo-entry" onClick={() => navigate('demo')}><span>DEMO CANDIDATE — SYNTHETIC DATA</span><div><strong>Practice the full Recruiting Intelligence workflow with Jordan Lee.</strong><p>Darren-only, resettable, zero invitations, zero emails, and no real Recruiting relationship.</p></div><b>Open synthetic demo →</b></button>}
      <section className="candidate-section"><div className="section-heading"><div><p className="eyebrow teal">Candidate readiness</p><h2>Know what is ready - and what is still missing.</h2></div><span>{state.candidates.length} private relationships</span></div>
        <div className="candidate-grid">{state.candidates.map((candidate) => <CandidateCard key={candidate.candidate_id} candidate={candidate} onOpen={() => openCandidate(candidate.candidate_id)} />)}</div>
      </section>
      <section className="truth-boundary"><span>✦</span><div><p className="eyebrow violet">What informs this view</p><h2>Four sources stay separate by design.</h2></div>{['Recruit Reality', 'Recruiter Reality', 'Manager-Supplied Evidence', 'Local Opportunity Authority'].map((label) => <b key={label}>{label}</b>)}</section>
    </section>
  );
}

function CandidateCard({ candidate, onOpen }) {
  const readiness = candidate.readiness_state.replaceAll('_', ' ');
  return <button type="button" className="candidate-card" onClick={onOpen}><div className="candidate-avatar">{candidate.recruit_name.split(' ').map((part) => part[0]).join('')}</div><div><small>{candidate.state === 'DELIVERED' ? 'Invitation pending' : 'Candidate relationship'}</small><h3>{candidate.recruit_name}</h3><p>{candidate.purpose}</p></div><span className={`status-pill status-${candidate.readiness_state.toLowerCase()}`}>{readiness}</span><footer><small>{candidate.ba_readiness.replaceAll('_', ' ')}</small><b>Open candidate →</b></footer></button>;
}

function DarrenSyntheticDemoSurface({ state, setState, setError, exit }) {
  const [section, setSection] = useState('home');
  const [briefOpen, setBriefOpen] = useState(false);
  const candidate = state.candidates[0];
  const sections = [
    ['home', 'Recruiting Home', 'Prefilled explanatory'],
    ['invite', 'Invite & Readiness', 'Read-only explanatory'],
    ['opportunity', 'Local Opportunity', 'Demo-local edit + reset'],
    ['evidence', 'What You Know', 'Demo-local edit + reset'],
    ['intelligence', 'Recruiting Intelligence', 'Accepted synthetic projection'],
    ['meeting', 'Meeting & Brief', 'Read-only payoff'],
  ];

  async function request({ action, body = {} }) {
    const actionMap = {
      ADD_EVIDENCE: 'ADD_DEMO_EVIDENCE', SAVE_OPPORTUNITY: 'SAVE_DEMO_OPPORTUNITY',
      GENERATE_INTELLIGENCE: 'GENERATE_DEMO_INTELLIGENCE', RECORD_EXPORT: 'RECORD_DEMO_EXPORT',
    };
    if (SYNTHETIC) throw new Error('Live generation is available only in the authenticated Darren demo.');
    return demoApi({ action: actionMap[action] || action, body });
  }

  async function reset() {
    if (!window.confirm('Reset Jordan to the clean synthetic baseline? No real Recruiting state will change.')) return;
    try {
      if (SYNTHETIC) {
        setState(syntheticDarrenDemoReviewState());
      } else {
        const payload = await demoApi({ action: 'RESET_DEMO' });
        setState(payload.demo);
      }
      setSection('home');
      setBriefOpen(false);
      setError('');
    } catch (failure) { setError(failure.message); }
  }

  function navigate(sectionId) {
    if (sectionId === 'export') { setBriefOpen(true); return; }
    if (sections.some(([id]) => id === sectionId)) setSection(sectionId);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  const stepIndex = sections.findIndex(([id]) => id === section);
  const step = sections[stepIndex];

  return (
    <section className="darren-synthetic-demo" data-demo-only="true" data-synthetic-recruit="true">
      <header className="demo-boundary-banner"><div><span>DEMO CANDIDATE — SYNTHETIC DATA</span><h1>Jordan Lee · Darren’s private Recruiting walkthrough</h1><p>The real six-destination manager journey, filled with synthetic truth. Nothing here creates an invitation, sends email, changes entitlement, or enters Recruiting ledgers.</p></div><div><button type="button" onClick={reset}>Reset synthetic demo</button><button type="button" className="demo-exit" onClick={exit}>Exit walkthrough</button></div></header>
      <nav className="demo-section-nav" aria-label="Synthetic demo destinations">{sections.map(([id, label], index) => <button type="button" key={id} className={section === id ? 'active' : ''} onClick={() => navigate(id)}><span>{String(index + 1).padStart(2, '0')}</span>{label}</button>)}</nav>
      <div className="demo-zero-impact" role="note"><b>Zero-impact boundary</b><span>0 invitations</span><span>0 emails</span><span>0 real relationships</span><span>0 entitlement use</span><span>0 Recruiting audit events</span></div>
      <aside className="demo-walkthrough-overlay" aria-label="Walkthrough controls"><div><small>Step {String(stepIndex + 1).padStart(2, '0')} of 06 · {step[2]}</small><strong>{step[1]}</strong><span>Jordan remains the selected synthetic candidate.</span></div><div><button type="button" disabled={stepIndex === 0} onClick={() => navigate(sections[stepIndex - 1][0])}>← Previous</button><button type="button" disabled={stepIndex === sections.length - 1} onClick={() => navigate(sections[stepIndex + 1][0])}>Next →</button></div></aside>
      {section !== 'home' && <CandidateAnchor candidate={candidate} intelligence={state.intelligence} demo onChange={() => setSection('home')} note="Synthetic walkthrough · demo-local state only" />}
      {section === 'home' && <HomeSurface state={state} navigate={navigate} openCandidate={() => navigate('invite')} demoAvailable={false} />}
      {section === 'invite' && <><section className="demo-readiness-note panel"><p className="eyebrow violet">Invite & Readiness · explanatory state</p><h2>No invitation is sent in this walkthrough.</h2><p>In the live manager journey, Jordan would first see Darren, the purpose, and the exact sharing boundary. This synthetic state begins after that explanation without claiming consent or creating a relationship.</p></section><CandidateSurface state={state} candidate={candidate} navigate={navigate} demo /></>}
      {section === 'opportunity' && <OpportunitySurface state={state} setState={setState} request={request} demo />}
      {section === 'evidence' && <EvidenceSurface state={state} setState={setState} candidate={candidate} request={request} demo />}
      {section === 'intelligence' && <IntelligenceSurface state={state} setState={setState} candidate={candidate} navigate={navigate} request={request} demo />}
      {section === 'meeting' && <MeetingSurface state={state} candidate={candidate} navigate={navigate} />}
      {briefOpen && <DetailDrawer eyebrow="Meeting & Brief · Layer 02" title="Save or print the synthetic brief" subtitle="The real print view opens here without writing a production export audit." onClose={() => setBriefOpen(false)} footer="Synthetic walkthrough only · no real export audit"><ExportSurface state={state} candidate={candidate} request={request} demo /></DetailDrawer>}
    </section>
  );
}

function InviteSurface({ state, setState, setError, navigate }) {
  const [form, setForm] = useState({ recruit_name: '', recruit_email: '', purpose: 'Offer a private MORE MindMap profile and explore whether we can genuinely help with their business.' });
  const [sent, setSent] = useState(null);
  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      if (SYNTHETIC) {
        if (!form.recruit_name.trim() || !form.recruit_email.includes('@')) throw new Error('Add a recruit name and valid email.');
        if (state.entitlement.remaining < 1) throw new Error('This month’s invitation allowance is exhausted.');
        const candidate = { invitation_id: `invite_synthetic_${Date.now()}`, candidate_id: `candidate_synthetic_${Date.now()}`, ...form, state: 'DELIVERED', readiness_state: 'INVITED', ba_readiness: 'BA_NOT_STARTED', delivery_state: 'DELIVERED', issued_at: new Date().toISOString(), expires_at: new Date(Date.now() + 7 * 86400000).toISOString() };
        setState((current) => ({ ...current, candidates: [candidate, ...current.candidates], entitlement: { ...current.entitlement, remaining: current.entitlement.remaining - 1, reserved: current.entitlement.reserved + 1 } }));
        setSent(candidate);
      } else {
        const payload = await api({ action: 'CREATE_INVITATION', body: form });
        setSent(payload.invitation);
        const home = await api({ view: 'home' });
        setState(home);
      }
    } catch (failure) { setError(failure.message); }
  }
  if (sent) return <section className="surface invite-surface" data-surface="invite"><p className="eyebrow green">Invitation sent</p><h1>{sent.recruit_name} can decide with the purpose visible.</h1><div className="success-panel"><span>✓</span><div><h2>One clear invitation with no hidden commitment.</h2><p>The invitation expires in seven days. Resending replaces the link and extends the same invitation without using another slot.</p><dl><div><dt>Delivery</dt><dd>{SYNTHETIC ? 'Delivered to synthetic capture' : 'Sent'}</dd></div><div><dt>Readiness</dt><dd>Invitation pending</dd></div><div><dt>Invitation use</dt><dd>One slot reserved</dd></div></dl></div></div><button className="text-action" type="button" onClick={() => navigate('home')}>Return to Candidate Command Center →</button></section>;
  return (
    <section className="surface invite-surface" data-surface="invite">
      <p className="eyebrow green">Invite a Recruit</p><h1>Make the purpose clear before you ask for trust.</h1><p className="surface-subhead">The recruit sees who invited them, why, and what happens next before consent. One invitation governs BOS and optional BA continuity.</p>
      <div className="invite-layout"><form className="panel invite-form" onSubmit={submit}><p className="eyebrow blue">Invitation details</p><label>Recruit name<input value={form.recruit_name} onChange={(event) => setForm({ ...form, recruit_name: event.target.value })} placeholder="e.g. Maya Chen" /></label><label>Recruit email<input type="email" value={form.recruit_email} onChange={(event) => setForm({ ...form, recruit_email: event.target.value })} placeholder="maya@example.com" /></label><label>Purpose visible to the recruit<textarea value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} rows="5" /></label><button type="submit" className="solid-button" disabled={state.entitlement.mode !== 'unlimited' && state.entitlement.remaining < 1}>Send private invitation →</button><small>{state.entitlement.mode === 'unlimited' ? 'Unlimited invitation access.' : `${state.entitlement.remaining} invitations available.`} A delivery failure returns the slot before acceptance.</small></form>
        <article className="panel recruit-preview"><p className="eyebrow violet">Recruit view preview</p><span className="gift-mark">✦</span><small>A private invitation from</small><h2>{state.manager.name}</h2><p>{form.purpose}</p><div><b>Before you accept</b><ul><li>You will see the invitation purpose first.</li><li>Your MORE MindMap Profile stays unchanged.</li><li>Your profile is shared only through the relationship you accept.</li></ul></div><button type="button">Review and decide</button></article></div>
      <section className="invite-policy"><div><b>7 days</b><span>Acceptance window</span></div><div><b>1</b><span>Invitation identity through resends</span></div><div><b>0</b><span>Extra credits for resend</span></div><div><b>Exact scope</b><span>Manager → invite → recruit</span></div></section>
    </section>
  );
}

function CandidateSurface({ state, candidate, navigate, demo = false }) {
  if (!state.recruit) return <NotReadySurface title={`${candidate.recruit_name}'s MORE MindMap Profile is not ready yet.`} copy="Recruiting Intelligence will open only after the accepted profile is securely saved." />;
  const accepted = demo || Boolean(candidate.accepted_at);
  const bosReady = Boolean(candidate.bos_profile_id);
  const baStarted = ['BA_INTAKE_SAVED', 'BA_IN_PROGRESS', 'BA_INTELLIGENCE_READY'].includes(candidate.ba_readiness);
  const baReady = candidate.ba_readiness === 'BA_INTELLIGENCE_READY';
  const initials = candidate.recruit_name.split(' ').map((part) => part[0]).join('').slice(0, 2);
  return (
    <section className="surface candidate-surface" data-surface="candidate">
      <p className="eyebrow green">{demo ? 'Synthetic Candidate Ready' : 'Candidate Ready'}</p><h1>{candidate.recruit_name}: what is usable now.</h1><p className="surface-subhead">Readiness is evidence, not a percentage. BOS and BA states remain distinct.</p>
      <section className="candidate-hero panel"><div className="large-avatar">{initials}</div><div><small>{demo ? 'Synthetic demo fixture — no recruiting relationship' : 'Accepted recruiting relationship'}</small><h2>{candidate.recruit_name}</h2><p>{state.recruit.bos_summary}</p></div><span className={`status-pill status-${candidate.readiness_state.toLowerCase()}`}>{candidate.readiness_state.replaceAll('_', ' ')}</span></section>
      <div className="readiness-path"><ReadinessNode done={accepted} label={demo ? 'Synthetic fixture loaded' : 'Invitation accepted'} detail={demo ? 'No consent claim' : 'Choice recorded'} /><i>→</i><ReadinessNode done={bosReady} label="MORE Profile ready" detail={demo ? 'Synthetic authority' : 'Securely saved'} /><i>→</i><ReadinessNode done={baStarted} label="BA intake saved" detail={demo ? 'Synthetic authority' : 'Connected to this profile'} /><i>→</i><ReadinessNode done={baReady} label="BA Intelligence ready" detail="Complete business view" /></div>
      <div className="candidate-detail-grid"><article className="panel"><p className="eyebrow teal">Known and usable</p><ul>{state.recruit.known.map((item) => <li key={item}>✓ <span>{item}</span></li>)}</ul></article><article className="panel"><p className="eyebrow amber">Still unknown</p><ul>{state.recruit.unknown.map((item) => <li key={item}>○ <span>{item}</span></li>)}</ul></article></div>
      <section className="profile-source-grid"><article className="panel"><small>Recruit Reality · MORE Profile</small><h3>How this person naturally works</h3><p>{state.recruit.bos_summary}</p><b>Recruit source · verified</b></article><article className="panel"><small>Recruit Reality · BA</small><h3>Whole-Business constraint evidence</h3><p>{state.recruit.ba_summary || 'Business evidence remains open until the recruit completes the optional BA.'}</p><b>{baReady ? 'Recruit source · intelligence ready' : 'Recruit source · not ready'}</b></article><article className="panel"><small>Manager-Supplied Evidence</small><h3>{(state.manager_evidence || []).length} separate evidence items</h3><p>Useful for hypotheses; never treated as something the recruit said.</p><b>Manager source · separately labeled</b></article></section>
      <button type="button" className="solid-button inline" onClick={() => navigate('intelligence')}>Open Recruiting Intelligence →</button>
      {!demo && bosReady && !baReady && <a className="text-action" href="/business-assessment?recruiting=1">Begin optional Business Assessment →</a>}
    </section>
  );
}

function ReadinessNode({ done, label, detail }) { return <div className={done ? 'done' : ''}><span>{done ? '✓' : '○'}</span><strong>{label}</strong><small>{detail}</small></div>; }

function OpportunitySurface({ state, setState, request = api, demo = false }) {
  const [editing, setEditing] = useState(false);
  const [selectedProof, setSelectedProof] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const items = state.opportunity?.items || [];
  const prompts = [
    { key: 'why', category: 'GROWTH_PATH', label: 'What makes your local business worth joining?', short: 'Why this business is worth joining', fallbackStatus: 'UNKNOWN' },
    { key: 'help', category: 'COACHING_AND_TRAINING', label: 'How do you personally help agents build a better business?', short: 'How I help agents build', fallbackStatus: 'SUPPORTED' },
    { key: 'offer', category: 'OPERATIONS_AND_LEVERAGE', label: 'What can you genuinely offer today?', short: 'What we can offer today', fallbackStatus: 'CONDITIONAL' },
    { key: 'promise', category: 'LEAD_OPPORTUNITY', label: 'What should MORE never promise or imply?', short: 'What we will not promise', fallbackStatus: 'NON_PROMISE' },
  ];

  function beginEditing() {
    setDrafts(prompts.map((prompt) => {
      const current = items.find((item) => item.category === prompt.category);
      return { ...prompt, statement: current?.statement || '', status: current?.status || prompt.fallbackStatus, current };
    }));
    setEditing(true);
  }

  async function saveTruth(event) {
    event.preventDefault();
    const untouched = items.filter((item) => !prompts.some((prompt) => prompt.category === item.category));
    const now = new Date();
    const nextItems = [...untouched, ...drafts.filter((draft) => draft.statement.trim()).map((draft) => ({
      ...(draft.current || {}),
      opportunity_evidence_id: draft.current?.opportunity_evidence_id || `opp_${draft.key}_${Date.now()}`,
      category: draft.category,
      scope: 'LOCAL_LEADER_PRIMARY',
      statement: draft.statement.trim(),
      status: draft.status,
      source: draft.current?.source || (demo ? 'Synthetic demo authority' : 'Manager Local Opportunity statement'),
      source_date: now.toISOString().slice(0, 10),
      freshness: demo ? 'SYNTHETIC_BASELINE' : 'CURRENT_MANAGER_REVIEW',
      constraints: draft.current?.constraints || [],
      counterevidence: draft.current?.counterevidence || [],
      demo_only: demo || undefined,
    }))];
    const payload = (!SYNTHETIC || demo) ? await request({ action: 'SAVE_OPPORTUNITY', body: { items: nextItems } }) : null;
    if (demo && payload?.demo) setState(payload.demo);
    else setState((current) => ({ ...current, opportunity: { ...current.opportunity, items: nextItems } }));
    setEditing(false);
  }
  const localItems = items.filter((item) => item.scope !== 'COMPANY_SECONDARY');
  return (
    <section className="surface opportunity-surface" data-surface="opportunity">
      <header className="campaign-surface-title"><div><p className="campaign-kicker">Local Opportunity · {items.length ? 'Saved' : 'First use'}</p><h1>{items.length ? 'This is the local truth MORE can safely use.' : 'Define the local truth once. Use it responsibly across every candidate.'}</h1><p className="surface-subhead">{items.length ? 'You defined it once. It supports every candidate conversation until you edit it.' : 'Four plain-language answers establish what is real, conditional, still unknown, and never a promise.'}</p></div><button className="solid-button inline" type="button" onClick={beginEditing}>{items.length ? 'Edit Local Opportunity' : 'Set up Local Opportunity'}</button></header>
      {!items.length && <div className="opportunity-first-use">{prompts.map((prompt, index) => <article className={`panel tone-${['green', 'violet', 'amber', 'coral'][index]}`} key={prompt.key}><span>0{index + 1}</span><h2>{prompt.label}</h2><p>{index === 3 ? 'Naming the boundary is part of the opportunity.' : 'Use the truth you can support today. Missing information can stay missing.'}</p></article>)}</div>}
      {items.length > 0 && <div className="opportunity-truth-grid">{localItems.map((item) => {
        const prompt = prompts.find((entry) => entry.category === item.category);
        return <article className={`panel opportunity-truth-card status-${item.status.toLowerCase()}`} key={item.opportunity_evidence_id}><header><span>{prompt?.short || item.category.replaceAll('_', ' ')}</span><b className={`evidence-state ${item.status.toLowerCase()}`}>{item.status.replaceAll('_', ' ')}</b></header><h2>{item.statement}</h2><p>{item.constraints?.[0] || (item.status === 'NON_PROMISE' ? 'This boundary stays visible in every recruiting conversation.' : 'Use only while this local truth remains current.')}</p><button type="button" onClick={() => setSelectedProof(item)}>See why this is safe →</button></article>;
      })}</div>}
      {editing && <form className="panel opportunity-truth-editor" onSubmit={saveTruth}><div><p className="campaign-kicker">Edit the local truth</p><h2>Say what is true in language a manager would actually use.</h2><p>Supported, conditional, unknown, and non-promise boundaries remain attached underneath.</p></div>{drafts.map((draft, index) => <fieldset key={draft.key}><legend><span>0{index + 1}</span>{draft.label}</legend><textarea rows="3" value={draft.statement} onChange={(event) => setDrafts((current) => current.map((item) => item.key === draft.key ? { ...item, statement: event.target.value } : item))} placeholder="Leave blank if this is not yet known." /><label>Current truth<select value={draft.status} onChange={(event) => setDrafts((current) => current.map((item) => item.key === draft.key ? { ...item, status: event.target.value } : item))}>{['SUPPORTED', 'CONDITIONAL', 'UNKNOWN', 'NON_PROMISE'].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label></fieldset>)}<footer><button className="solid-button inline" type="submit">Save Local Opportunity</button><button className="text-action" type="button" onClick={() => setEditing(false)}>Cancel</button></footer></form>}
      {items.length > 0 && <section className="opportunity-saved-strip"><span>✓</span><div><strong>Saved for {state.manager.enterprise_name}</strong><small>Reusable across candidates · edit when capacity or evidence changes</small></div><button type="button" onClick={beginEditing}>Review later</button></section>}
      {selectedProof && <DetailDrawer eyebrow="Local Opportunity · Layer 02" title={selectedProof.statement} subtitle={`${selectedProof.status.replaceAll('_', ' ')} · ${selectedProof.scope.replaceAll('_', ' ')}`} onClose={() => setSelectedProof(null)} footer="Local Opportunity remains manager/local-enterprise authority. It never becomes recruit-owned truth."><dl className="campaign-proof-list"><div><dt>Source</dt><dd>{selectedProof.source}</dd></div><div><dt>Source date</dt><dd>{selectedProof.source_date}</dd></div><div><dt>Freshness</dt><dd>{selectedProof.freshness}</dd></div><div><dt>Conditions</dt><dd>{selectedProof.constraints?.join(' ') || 'No extra condition recorded.'}</dd></div><div><dt>Counterevidence</dt><dd>{selectedProof.counterevidence?.join(' ') || 'No counterevidence recorded.'}</dd></div></dl></DetailDrawer>}
    </section>
  );
}

function EvidenceSurface({ state, setState, candidate, request = api, demo = false }) {
  const [form, setForm] = useState({ type: 'CONVERSATION', claim: '', source: 'Manager conversation note', source_date: '2026-08-21' });
  const [saved, setSaved] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (!form.claim.trim()) return;
    const evidence = { evidence_id: `evidence_synthetic_${Date.now()}`, candidate_id: candidate.candidate_id, ...form, recorded_at: new Date().toISOString(), truth_class: 'MANAGER_SUPPLIED_EVIDENCE', canonical_recruit_truth_mutated: false };
    const payload = SYNTHETIC && !demo ? null : await request({ action: 'ADD_EVIDENCE', body: { candidate_id: candidate.candidate_id, evidence: form } });
    const persisted = payload?.evidence || evidence;
    if (demo && payload?.demo) setState(payload.demo);
    else setState((current) => ({ ...current, manager_evidence: [...(current.manager_evidence || []), persisted], intelligence: current.intelligence ? { ...current.intelligence, stale: true } : null }));
    setForm({ ...form, claim: '' }); setSaved(true);
  }
  return (
    <section className="surface evidence-surface" data-surface="evidence">
      <p className="eyebrow teal">Add What You Know</p><h1>Add evidence without rewriting {candidate.recruit_name}.</h1><p className="surface-subhead">Manager observations can strengthen, weaken, or contradict a hypothesis. They always remain separate from what the recruit shared.</p>
      <div className="evidence-layout"><form className="panel evidence-form" onSubmit={submit}><p className="eyebrow blue">New manager evidence</p><label>Evidence type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{['CONVERSATION', 'MLS_PRODUCTION', 'GOAL', 'QUOTE', 'OBSERVATION', 'OTHER'].map((item) => <option key={item}>{item}</option>)}</select></label><label>What you know<textarea rows="6" value={form.claim} onChange={(event) => setForm({ ...form, claim: event.target.value })} placeholder="Record the specific fact, quote, goal, or observation." /></label><div className="two-fields"><label>Source<input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} /></label><label>Source date<input type="date" value={form.source_date} onChange={(event) => setForm({ ...form, source_date: event.target.value })} /></label></div><button className="solid-button" type="submit">Add separate evidence →</button>{saved && <strong className="save-confirmation">✓ Saved as manager-supplied evidence. Intelligence is now marked stale.</strong>}</form>
        <section className="evidence-ledger"><div className="section-heading"><div><p className="eyebrow violet">Evidence history</p><h2>{(state.manager_evidence || []).length} manager-supplied items</h2></div><span>Separate from recruit sources</span></div>{(state.manager_evidence || []).map((item) => <article className="panel evidence-row" key={item.evidence_id}><span>◇</span><div><small>{item.type.replaceAll('_', ' ')} · {item.source_date}</small><p>{item.claim}</p><footer>{item.source} · Manager-Supplied Evidence</footer></div><b>Separate source</b></article>)}</section></div>
      <section className="evidence-boundary"><span>i</span><div><strong>What changes</strong><p>Recruiting hypotheses may update when this evidence is added.</p></div><div><strong>What does not change</strong><p>The recruit’s own MORE Profile and Business Assessment stay untouched.</p></div></section>
    </section>
  );
}

function IntelligenceSurface({ state, setState, candidate, navigate, request = api, demo = false }) {
  const [proof, setProof] = useState(null);
  const [generating, setGenerating] = useState(false);
  async function generate() {
    setGenerating(true);
    try {
      const payload = await request({ action: 'GENERATE_INTELLIGENCE', body: { candidate_id: candidate.candidate_id } });
      setState((current) => ({ ...current, intelligence: payload.intelligence }));
    } finally {
      setGenerating(false);
    }
  }
  if (!state.intelligence?.output) return <NotReadySurface title="Recruiting Intelligence is not ready yet." copy="The recruit’s profile and at least one supported local capability are required before a complete view can be created." actionLabel="Create Recruiting Intelligence" onAction={generate} />;
  const output = state.intelligence.output;
  return (
    <section className="surface intelligence-surface" data-surface="intelligence">
      <header className="campaign-surface-title"><div><p className="campaign-kicker">Recruiting Intelligence · Layer 01</p><h1>Understand {candidate.recruit_name} before you decide what to say.</h1><p className="surface-subhead">Four truth classes stay separate. Bilateral reasoning connects two people only where evidence supports a useful conversation.</p></div><div className="intelligence-header-actions">{demo && <button className="outline-button inline" type="button" disabled={generating} onClick={generate}>{generating ? 'Refreshing synthetic view…' : 'Refresh synthetic intelligence'}</button>}<button className="solid-button inline" type="button" onClick={() => navigate('meeting')}>Open Meeting & Brief</button></div></header>
      {state.intelligence.stale && <div className="stale-banner"><b>Evidence changed</b><span>The last complete view remains visible, but it does not yet include the newest information.</span><button type="button" disabled={generating} onClick={generate}>{generating ? 'Refreshing…' : 'Refresh with current evidence'}</button></div>}
      <section className="understand-hero panel"><div><p className="eyebrow green">Understand This Recruit</p><h2>{output.understand_this_recruit.summary}</h2></div><ul>{output.understand_this_recruit.important_realities.map((item) => <li key={item}>✓ {item}</li>)}</ul></section>
      <section className="bilateral panel"><header><p className="eyebrow teal">Bilateral Communication</p><span>Use the bridge here · nowhere else</span></header><div className="bilateral-people"><div><b>{state.manager.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</b><strong>{state.manager.name}</strong><small>{demo ? 'Synthetic recruiter BOS authority' : 'Recruiter Reality'}</small></div><i>↔</i><div><b>{candidate.recruit_name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</b><strong>{candidate.recruit_name}</strong><small>{demo ? 'Synthetic BOS + BA authority' : 'Recruit Reality'}</small></div></div><div className="bilateral-grid"><article><small>Your advantage</small><p>{output.bilateral_communication.advantage}</p></article><article><small>Your watchout</small><p>{output.bilateral_communication.recruiter_watchout}</p></article><article><small>Authentic adaptation</small><p>{output.bilateral_communication.adaptation}</p></article></div></section>
      <section className="business-gap-reserved" aria-label="Business Gap Intelligence V1.1 reserved insertion point"><header><span>Reserved insertion point</span><strong>Business Gap Intelligence V1.1</strong><b>Not active in V1</b></header><div>{['Current Business Reality', 'Chosen or Possible Future', 'Gap', 'Constraint', 'Proof', 'What Must Change', 'Can We Help?'].map((label) => <span key={label}>{label}<i>→</i></span>)}</div><p>V1 does not fabricate this chain. Ratified intelligence will appear here before Authentic Recruiting Angles.</p></section>
      <div className="section-heading angles-heading"><div><p className="eyebrow green">Authentic Recruiting Angles</p><h2>{output.authentic_angles.length} supported {output.authentic_angles.length === 1 ? 'path' : 'paths'}. No quota of three.</h2></div><span>Recruit evidence + local capability required</span></div>
      <div className="angle-grid">{output.authentic_angles.map((angle, index) => <article className="panel angle-card" key={angle.title}><header><span>0{index + 1}</span><b>{index === 0 ? 'Supported' : 'Conditional'}</b></header><h2>{angle.title}</h2><p>{angle.rationale}</p><blockquote>{angle.validating_question}</blockquote><footer><button type="button" onClick={() => setProof(angle)}>Why this path is allowed →</button><b>{angle.recruit_evidence_ids.length + angle.opportunity_evidence_ids.length} evidence links</b></footer></article>)}</div>
      <section className="withheld panel"><span>⊘</span><div><p className="eyebrow amber">Intentionally withheld</p><h2>{output.withheld_angles[0]}</h2><p>Unknown is a product result. It prevents a local claim from becoming a recruiting promise.</p></div></section>
      <section className="success-environment"><div><p className="eyebrow green">Real Estate success is plural</p><h2>No single personality pattern owns success.</h2></div>{[['Natural success patterns', output.success_environment.natural_success_patterns], ['Supportive conditions', output.success_environment.supportive_conditions], ['Likely friction', output.success_environment.likely_frictions]].map(([title, items]) => <article className="panel" key={title}><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></article>)}</section>
      <section className="missing-panel panel"><p className="eyebrow amber">What still needs to be learned</p><div>{output.missing_evidence.map((item) => <span key={item}>{item}</span>)}</div></section>
      {proof && <DetailDrawer eyebrow="Recruiting Intelligence · Layer 02" title={proof.title} subtitle="A supported path must connect recruit evidence and a locally supported capability." onClose={() => setProof(null)} footer="This is a hypothesis for a real conversation, not a score, promise, or scripted pitch."><dl className="campaign-proof-list"><div><dt>Recruit need</dt><dd>{proof.recruit_need}</dd></div><div><dt>Current reality</dt><dd>{proof.current_reality}</dd></div><div><dt>Locally supported help</dt><dd>{proof.locally_supported_help}</dd></div><div><dt>Uncertainty</dt><dd>{proof.uncertainty}</dd></div><div><dt>Evidence links</dt><dd>{[...proof.recruit_evidence_ids, ...proof.opportunity_evidence_ids].join(' · ')}</dd></div></dl></DetailDrawer>}
    </section>
  );
}

function MeetingSurface({ state, navigate }) {
  const [proof, setProof] = useState(null);
  if (!state.intelligence?.output) return <NotReadySurface title="The Meeting Plan is not ready." copy="Create complete Recruiting Intelligence first. An incomplete result never becomes a meeting brief." />;
  const plan = state.intelligence.output.meeting_plan;
  return (
    <section className="surface meeting-surface" data-surface="meeting">
      <header className="campaign-surface-title"><div><p className="campaign-kicker">Meeting & Brief · Layer 01</p><h1>Five minutes before the meeting, know what to learn.</h1><p className="surface-subhead">Preparation, not another report. One grounded starting point, clear listening cues, and one justified next step.</p></div><button className="solid-button inline" type="button" onClick={() => navigate('export')}>Save / Print</button></header>
      <nav className="meeting-timeline" aria-label="Five-minute meeting preparation"><span><b>0:00</b> Start</span><i>→</i><span><b>1:00</b> Learn</span><i>→</i><span><b>2:00</b> Listen</span><i>→</i><span><b>3:30</b> Adapt</span><i>→</i><span><b>5:00</b> Next step</span></nav>
      <section className="meeting-start panel"><span>01</span><div><p className="eyebrow green">Start Here</p><h2>{plan.start_here}</h2><p>Let the candidate define the constraint before discussing a solution.</p></div><button type="button" onClick={() => setProof({ title: 'Why this is the grounded start', body: plan.start_here })}>See source →</button></section>
      <div className="meeting-grid"><MeetingBlock number="02" tone="teal" title="Learn" items={plan.learn} /><MeetingBlock number="03" tone="violet" title="Listen For" items={plan.listen_for} /><MeetingBlock number="04" tone="amber" title="Your adaptation" text={plan.your_watchout} /><MeetingBlock number="05" tone="blue" title="If fit is real" text={plan.next_step_if_fit_is_real} /></div>
      <section className="do-not-assume panel"><span>⊘</span><div><p className="eyebrow coral">Do Not Assume</p><h2>{plan.do_not_assume}</h2></div></section>
      <div className="meeting-footer"><small>Built from four separate sources · {state.intelligence.output.authentic_angles.length} supported paths · {state.intelligence.output.missing_evidence.length} open evidence gaps</small><button className="text-action" type="button" onClick={() => setProof({ title: 'Meeting evidence boundary', body: 'Recruit Reality, Recruiter Reality, Manager-Supplied Evidence, and Local Opportunity Authority remain separate. Unknowns and withheld claims travel into the brief.' })}>Open evidence boundary →</button></div>
      {proof && <DetailDrawer eyebrow="Meeting & Brief · Layer 02" title={proof.title} onClose={() => setProof(null)} footer="Meeting guidance remains non-scripted and evidence-bounded."><p className="campaign-proof-copy">{proof.body}</p><dl className="campaign-proof-list"><div><dt>Supported paths</dt><dd>{plan.supported_paths_if_confirmed.join(' · ') || 'None yet'}</dd></div><div><dt>Do not assume</dt><dd>{plan.do_not_assume}</dd></div><div><dt>Open evidence</dt><dd>{state.intelligence.output.missing_evidence.join(' · ')}</dd></div></dl></DetailDrawer>}
    </section>
  );
}

function MeetingBlock({ number, tone, title, items, text }) { return <article className={`panel meeting-block tone-${tone}`}><span>{number}</span><p className="eyebrow">{title}</p>{text ? <h2>{text}</h2> : <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>}</article>; }

function ExportSurface({ state, candidate, request = api, demo = false }) {
  const requestedMode = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('mode') : null;
  const [mode, setMode] = useState(['meeting', 'full', 'both'].includes(requestedMode) ? requestedMode : 'meeting');
  const [details, setDetails] = useState(false);
  if (!state.intelligence?.output) return <NotReadySurface title="There is no complete intelligence to export." copy="Save and print become available after a complete, evidence-checked view is ready." />;
  async function print() {
    if (!SYNTHETIC && !demo) await request({ action: 'RECORD_EXPORT', body: { candidate_id: candidate.candidate_id, mode, details_included: details } });
    document.body.dataset.recruitingPrintMode = mode;
    window.print();
  }
  return (
    <section className={`surface export-surface print-mode-${mode}`} data-surface="export">
      <div className="export-controls recruiting-no-print"><p className="eyebrow blue">Save / Print Recruiting Brief</p><h1>Choose what travels into the meeting.</h1><p className="surface-subhead">The one-page Meeting Brief is recommended. Sources, freshness, and intentional unknowns travel with both formats.</p><div className="export-options">{[['meeting', 'Meeting Brief', 'One page · recommended'], ['full', 'Full Recruiting Intelligence', 'Two-page preparation packet'], ['both', 'Both', 'One combined print job']].map(([id, title, copy]) => <button type="button" className={mode === id ? 'selected' : ''} onClick={() => setMode(id)} key={id}><span>{mode === id ? '●' : '○'}</span><div><strong>{title}</strong><small>{copy}</small></div></button>)}</div><label className="details-toggle"><input type="checkbox" checked={details} onChange={(event) => setDetails(event.target.checked)} /> Include Profile and record IDs in the details footer</label><button className="solid-button" type="button" onClick={print}>Print / Save selected artifact →</button></div>
      <div className="print-preview-label recruiting-no-print"><span>Live print preview</span><b>{mode === 'meeting' ? '1 page' : mode === 'full' ? 'Full packet' : 'Combined'}</b></div>
      {(mode === 'meeting' || mode === 'both') && <MeetingBriefDocument state={state} candidate={candidate} details={details} />}
      {(mode === 'full' || mode === 'both') && <FullIntelligenceDocument state={state} candidate={candidate} details={details} />}
    </section>
  );
}

function MeetingBriefDocument({ state, candidate, details }) {
  const output = state.intelligence.output; const plan = output.meeting_plan;
  return <article className="print-document meeting-brief"><header><div><small>MORE MINDMAP · RECRUITING INTELLIGENCE</small><h1>{candidate.recruit_name} · Meeting Brief</h1><p>Prepared for {state.manager.name}{state.synthetic_only ? ' · Synthetic founder-review scenario' : ''}</p></div><span>5-minute<br />pre-meeting</span></header><section className="brief-start"><small>START HERE</small><h2>{plan.start_here}</h2></section><div className="brief-columns"><section><small>LEARN</small><ul>{plan.learn.map((item) => <li key={item}>{item}</li>)}</ul><small>LISTEN FOR</small><ul>{plan.listen_for.map((item) => <li key={item}>{item}</li>)}</ul></section><section><small>YOUR WATCHOUT</small><p>{plan.your_watchout}</p><small>SUPPORTED IF CONFIRMED</small><ul>{plan.supported_paths_if_confirmed.map((item) => <li key={item}>{item}</li>)}</ul></section></div><section className="brief-warning"><small>DO NOT ASSUME</small><p>{plan.do_not_assume}</p></section><section className="brief-next"><small>IF FIT IS REAL</small><p>{plan.next_step_if_fit_is_real}</p></section><footer><span>{output.authentic_angles.length} supported paths · {output.missing_evidence.length} evidence gaps · No compatibility score</span><span>Generated {state.intelligence.generated_at.slice(0, 10)} · Sources remain clearly labeled</span>{details && <code>{candidate.candidate_id} · {candidate.bos_profile_id}</code>}</footer></article>;
}

function FullIntelligenceDocument({ state, candidate, details }) {
  const output = state.intelligence.output;
  const firstAngle = output.authentic_angles[0];
  const remainingAngles = output.authentic_angles.slice(1);
  const angleSection = (angle, index) => <section className="full-angle" key={angle.title}><small>SUPPORTED ANGLE {index + 1}</small><h2>{angle.title}</h2><p><b>Recruit need</b>{angle.recruit_need}</p><p><b>Local help</b>{angle.locally_supported_help}</p><blockquote>{angle.validating_question}</blockquote><footer>{angle.uncertainty}</footer></section>;
  return <>
    <article className="print-document full-document full-page-one"><header><div><small>MORE MINDMAP · FULL RECRUITING INTELLIGENCE</small><h1>{candidate.recruit_name}</h1><p>Bilateral preparation for {state.manager.name}</p></div><span>Evidence<br />aware</span></header><section><small>UNDERSTAND THIS RECRUIT</small><h2>{output.understand_this_recruit.summary}</h2><ul>{output.understand_this_recruit.important_realities.map((item) => <li key={item}>{item}</li>)}</ul></section><section><small>BILATERAL COMMUNICATION</small><div className="full-three"><p><b>Advantage</b>{output.bilateral_communication.advantage}</p><p><b>Watchout</b>{output.bilateral_communication.recruiter_watchout}</p><p><b>Adaptation</b>{output.bilateral_communication.adaptation}</p></div></section>{firstAngle ? angleSection(firstAngle, 0) : <section className="full-no-angle"><small>SUPPORTED ANGLES</small><h2>No authentic recruiting angle is ready yet.</h2><p>The available recruit needs and local capabilities do not yet support a responsible connection.</p></section>}<footer><span>Page 1 of 2 · Understanding and bilateral preparation</span>{details && <code>{candidate.candidate_id} · {candidate.bos_profile_id}</code>}</footer></article>
    <article className="print-document full-document full-page-two"><header><div><small>MORE MINDMAP · FULL RECRUITING INTELLIGENCE</small><h1>Supported paths and open questions</h1><p>{candidate.recruit_name} · Prepared for {state.manager.name}</p></div><span>Page 2<br />of 2</span></header>{remainingAngles.length > 0 && <div className="full-remaining-angles">{remainingAngles.map((angle, index) => angleSection(angle, index + 1))}</div>}<div className="full-page-two-grid"><section><small>WITHHELD / UNKNOWN</small><ul>{output.withheld_angles.map((item) => <li key={item}>{item}</li>)}</ul></section><section><small>WHAT STILL NEEDS TO BE LEARNED</small><ul>{output.missing_evidence.map((item) => <li key={item}>{item}</li>)}</ul></section></div><section className="full-success"><small>SUCCESS ENVIRONMENT</small><div className="full-three"><p><b>Natural patterns</b>{output.success_environment.natural_success_patterns.join(' · ')}</p><p><b>Supportive conditions</b>{output.success_environment.supportive_conditions.join(' · ')}</p><p><b>Likely friction</b>{output.success_environment.likely_frictions.join(' · ')}</p></div></section><section className="full-source-boundary"><small>HOW TO READ THIS</small><h2>Four sources remain separate.</h2><p>Recruit Reality · Recruiter Reality · Manager-Supplied Evidence · Local Opportunity Authority</p><p>Supported paths still require a real conversation. Unknowns are intentionally preserved rather than turned into promises.</p></section><footer><span>Generated {state.intelligence.generated_at.slice(0, 10)} · Sources and uncertainty remain visible</span>{details && <code>{candidate.candidate_id} · {candidate.bos_profile_id} · {candidate.ba_assessment_id}</code>}</footer></article>
  </>;
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
  return <main className="recruiting-invite-public" data-synthetic={SYNTHETIC ? 'true' : 'false'}><div className="public-brand"><span>+</span><strong>MORE MINDMAP</strong><small>{SYNTHETIC ? 'Synthetic founder review' : 'Private invitation'}</small></div>{status === 'preview' ? <article><p className="eyebrow green">A private invitation from</p><h1>{preview.inviter_name}</h1><h2>{preview.enterprise_name}</h2><div className="public-purpose"><small>Why you are receiving this</small><p>{preview.purpose}</p></div><section><h3>Before you accept</h3><ul><li>You choose whether to begin.</li><li>Your MORE MindMap Profile remains yours.</li><li>Your results connect only to the recruiting relationship you accept.</li><li>You can complete an optional Business Assessment later.</li></ul></section><button type="button" onClick={accept}>I understand - accept invitation →</button><small>Invitation expires {new Date(preview.expires_at).toLocaleDateString()} · No purchase required</small>{error && <strong role="alert">{error}</strong>}</article> : <article className="accepted"><span>✓</span><p className="eyebrow green">Invitation accepted</p><h1>Your choice is recorded.</h1><p>Begin your MORE MindMap Profile. It will connect to this invitation only after it is securely saved.</p><button type="button" onClick={() => navigate('/profile?recruiting=1')}>Begin my MORE Profile →</button></article>}</main>;
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
  return <main className="manager-onboarding"><div className="loading-mark">{status === 'failed' ? '!' : '✓'}</div><h1>{message}</h1>{status === 'verified' && <button type="button" onClick={() => navigate('/recruiting/home', { replace: true })}>Open Recruiting Intelligence →</button>}{status === 'failed' && <button type="button" onClick={() => navigate('/recruiting/home', { replace: true })}>Request another verification link →</button>}</main>;
}

function ManagerOnboarding({ onVerified }) {
  const [profileId, setProfileId] = useState(''); const [token, setToken] = useState(''); const [stage, setStage] = useState('profile'); const [message, setMessage] = useState('');
  async function request(event) { event.preventDefault(); try { const result = await api({ action: 'REQUEST_MANAGER_VERIFICATION', body: { profile_id: profileId } }); setMessage(`Verification sent to ${result.masked_email}.`); if (result.verification_token) setToken(result.verification_token); setStage('verify'); } catch (error) { setMessage(error.message); } }
  async function verify(event) { event.preventDefault(); try { await api({ action: 'VERIFY_MANAGER', body: { token } }); onVerified(); } catch (error) { setMessage(error.message); } }
  return <main className="manager-onboarding"><form onSubmit={stage === 'profile' ? request : verify}><p>Recruiting Intelligence</p><h1>{stage === 'profile' ? 'Verify your enterprise manager access.' : 'Use the single-use verification link.'}</h1><span>Profile ID selects a pre-approved membership. It is never your credential.</span>{stage === 'profile' ? <label>Verified manager Profile ID<input value={profileId} onChange={(event) => setProfileId(event.target.value)} placeholder="MM-YYYYMMDD-XXXXXXXX" /></label> : <label>Single-use verification token<input value={token} onChange={(event) => setToken(event.target.value)} /></label>}<button type="submit">{stage === 'profile' ? 'Send verification link' : 'Verify and open Recruiting'}</button>{message && <strong>{message}</strong>}</form></main>;
}

function NotReadySurface({ title, copy, actionLabel = null, onAction = null }) {
  return <section className="surface"><p className="eyebrow amber">Readiness</p><h1>{title}</h1><p className="surface-subhead">{copy}</p><section className="missing-panel panel"><p className="eyebrow amber">No assumptions added</p><div><span>Missing information stays visible until it is genuinely known.</span></div></section>{actionLabel && <button className="solid-button inline" type="button" onClick={onAction}>{actionLabel} →</button>}</section>;
}

function LoadingState({ message = 'Opening Recruiting Intelligence…' }) { return <main className="manager-onboarding"><div className="loading-mark">+</div><h1>{message}</h1></main>; }
