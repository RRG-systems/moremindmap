import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SYNTHETIC_RECRUITING_FIXTURE } from '../lib/recruitingV1/syntheticFixture.js';
import { selectRecruitingCandidate } from '../lib/recruitingV1/candidateSelection.js';
import RecruitingManagerSetup from './RecruitingManagerSetup.jsx';
import RecruitingMasterControl from './RecruitingMasterControl.jsx';
import './recruitingV1.css';

const SYNTHETIC = import.meta.env.VITE_RECRUITING_V1_SYNTHETIC_REVIEW === 'true';
const clone = (value) => JSON.parse(JSON.stringify(value));
let recruitingCsrfToken = null;
let recruitingSetupCsrfToken = null;

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

function syntheticFixtureForScenario(name) {
  const fixture = clone(SYNTHETIC_RECRUITING_FIXTURE);
  if (name === 'empty') fixture.candidates = [];
  if (name === 'exhausted') fixture.entitlement = { ...fixture.entitlement, remaining: 0, reserved: 3, consumed: 2 };
  if (name === 'provider-error') fixture.intelligence = null;
  if (name === 'stale') fixture.intelligence.stale = true;
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

function routeFor(pathname) {
  const part = pathname.split('/').filter(Boolean)[1] || 'home';
  if (part === 'master-control') return part;
  return destinations.some(([id]) => id === part) ? part : 'home';
}

export default function RecruitingV1App() {
  const location = useLocation();
  if (location.pathname.startsWith('/recruiting/accept/')) return <InvitationAcceptance />;
  if (location.pathname.startsWith('/recruiting/verify/')) return <ManagerVerification />;
  if (location.pathname.startsWith('/recruiting/setup')) return <RecruitingManagerSetup request={api} synthetic={SYNTHETIC} fixture={SYNTHETIC_RECRUITING_FIXTURE} />;
  return <ManagerExperience />;
}

function ManagerExperience() {
  const location = useLocation();
  const navigate = useNavigate();
  const active = routeFor(location.pathname);
  const syntheticScenario = new URLSearchParams(location.search).get('scenario');
  const [state, setState] = useState(SYNTHETIC ? syntheticFixtureForScenario(syntheticScenario) : null);
  const [sessionStatus, setSessionStatus] = useState(SYNTHETIC ? 'ready' : 'loading');
  const [error, setError] = useState(SYNTHETIC && syntheticScenario === 'error' ? 'Synthetic review: Recruiting Intelligence is temporarily unavailable.' : '');
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const selected = selectRecruitingCandidate(state?.candidates, selectedCandidateId);

  useEffect(() => {
    if (SYNTHETIC) return;
    api({ view: 'home' }).then((payload) => {
      setState(payload);
      setSessionStatus('ready');
    }).catch(() => setSessionStatus('unauthorized'));
  }, []);

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

  return (
    <div className="recruiting-v1" data-synthetic={SYNTHETIC ? 'true' : 'false'}>
      <DirectionARail active={active} navigate={navigateTo} manager={shellState.manager} />
      <div className="recruiting-page-column">
        <RecruitingHeader state={shellState} error={error} />
        <main className="recruiting-main">
          {active === 'home' && <HomeSurface state={state} navigate={navigateTo} openCandidate={openCandidate} />}
          {active === 'invite' && <InviteSurface state={state} setState={setState} setError={setError} navigate={navigateTo} />}
          {active === 'candidate' && <CandidateSurface state={state} candidate={selected} navigate={navigateTo} />}
          {active === 'opportunity' && <OpportunitySurface state={state} setState={setState} />}
          {active === 'evidence' && <EvidenceSurface state={state} setState={setState} candidate={selected} />}
          {active === 'intelligence' && <IntelligenceSurface state={state} setState={setState} candidate={selected} navigate={navigateTo} />}
          {active === 'meeting' && <MeetingSurface state={state} candidate={selected} navigate={navigateTo} />}
          {active === 'export' && <ExportSurface state={state} candidate={selected} />}
          {active === 'master-control' && (state.manager.capabilities?.master_control
            ? <RecruitingMasterControl data={masterControl} request={api} synthetic={SYNTHETIC} refresh={refreshMasterControl} setError={setError} />
            : <NotReadySurface title="Master Control is not available for this account." copy="Only an approved Recruiting administrator can manage enterprise access and invitation allowances." />)}
        </main>
      </div>
    </div>
  );
}

function DirectionARail({ active, navigate, manager }) {
  return (
    <aside className="recruiting-rail" aria-label="Recruiting destinations">
      <div className="more-brand"><span>+</span><strong>MORE<br />MINDMAP</strong></div>
      <p className="rail-label">Recruiting Intelligence</p>
      <nav>{destinations.map(([id, number, label]) => <button type="button" key={id} className={active === id ? 'active' : ''} onClick={() => navigate(id)}><span>{number}</span>{label}</button>)}{manager.capabilities?.master_control && <button type="button" className={`master-control-nav ${active === 'master-control' ? 'active' : ''}`} onClick={() => navigate('master-control')}><span>MC</span>Master Control</button>}</nav>
      <div className="rail-manager"><span>{manager.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div><strong>{manager.name}</strong><small>{manager.enterprise_name}</small></div></div>
      <div className="rail-boundary"><b>✓</b><small>Private recruiting relationships<br />Profile ID never verifies identity</small></div>
    </aside>
  );
}

function RecruitingHeader({ state, error }) {
  const unlimited = state.entitlement.mode === 'unlimited';
  return (
    <header className="recruiting-header">
      <div><span className="synthetic-badge">{state.synthetic_only ? 'Synthetic founder review' : 'Enterprise Recruiting'}</span><small>Updated from verified Recruiting sources</small></div>
      <div className={`allowance ${unlimited ? 'unlimited' : ''}`}><strong>{unlimited ? '∞' : state.entitlement.remaining}</strong><span>{unlimited ? `${state.entitlement.used} invitations this period · unlimited access` : `of ${state.entitlement.limit} invitations remaining`}</span>{!unlimited && <i><b style={{ width: `${(state.entitlement.remaining / state.entitlement.limit) * 100}%` }} /></i>}</div>
      {error && <p role="alert">{error}</p>}
    </header>
  );
}

function HomeSurface({ state, navigate, openCandidate }) {
  return (
    <section className="surface home-surface" data-surface="home">
      <p className="eyebrow green">Candidate Command Center</p>
      <h1>Walk into the next conversation understanding the person - and what you can honestly help them build.</h1>
      <p className="surface-subhead">Recruiting Intelligence separates recruit reality, recruiter reality, manager evidence, and local opportunity truth before it suggests a path.</p>
      <div className="home-actions">
        <button type="button" className="primary-action" onClick={() => navigate('invite')}><span>＋</span><div><small>Primary action</small><strong>Invite a Recruit</strong><p>Give someone a consent-first BOS and optional BA path.</p></div><b>→</b></button>
        <article className="locked-action"><span>◇</span><div><small>Existing agent</small><strong>A private invitation is still required</strong><p>Invite the person so they can see the purpose and choose whether to share their profile.</p></div></article>
      </div>
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

function CandidateSurface({ state, candidate, navigate }) {
  if (!state.recruit) return <NotReadySurface title={`${candidate.recruit_name}'s MORE MindMap Profile is not ready yet.`} copy="Recruiting Intelligence will open only after the accepted profile is securely saved." />;
  const accepted = Boolean(candidate.accepted_at);
  const bosReady = Boolean(candidate.bos_profile_id);
  const baStarted = ['BA_INTAKE_SAVED', 'BA_IN_PROGRESS', 'BA_INTELLIGENCE_READY'].includes(candidate.ba_readiness);
  const baReady = candidate.ba_readiness === 'BA_INTELLIGENCE_READY';
  const initials = candidate.recruit_name.split(' ').map((part) => part[0]).join('').slice(0, 2);
  return (
    <section className="surface candidate-surface" data-surface="candidate">
      <p className="eyebrow green">Candidate Ready</p><h1>{candidate.recruit_name}: what is usable now.</h1><p className="surface-subhead">Readiness is evidence, not a percentage. BOS and BA states remain distinct.</p>
      <section className="candidate-hero panel"><div className="large-avatar">{initials}</div><div><small>Accepted recruiting relationship</small><h2>{candidate.recruit_name}</h2><p>{state.recruit.bos_summary}</p></div><span className={`status-pill status-${candidate.readiness_state.toLowerCase()}`}>{candidate.readiness_state.replaceAll('_', ' ')}</span></section>
      <div className="readiness-path"><ReadinessNode done={accepted} label="Invitation accepted" detail="Choice recorded" /><i>→</i><ReadinessNode done={bosReady} label="MORE Profile ready" detail="Securely saved" /><i>→</i><ReadinessNode done={baStarted} label="BA intake saved" detail="Connected to this profile" /><i>→</i><ReadinessNode done={baReady} label="BA Intelligence ready" detail="Complete business view" /></div>
      <div className="candidate-detail-grid"><article className="panel"><p className="eyebrow teal">Known and usable</p><ul>{state.recruit.known.map((item) => <li key={item}>✓ <span>{item}</span></li>)}</ul></article><article className="panel"><p className="eyebrow amber">Still unknown</p><ul>{state.recruit.unknown.map((item) => <li key={item}>○ <span>{item}</span></li>)}</ul></article></div>
      <section className="profile-source-grid"><article className="panel"><small>Recruit Reality · MORE Profile</small><h3>How this person naturally works</h3><p>{state.recruit.bos_summary}</p><b>Recruit source · verified</b></article><article className="panel"><small>Recruit Reality · BA</small><h3>Whole-Business constraint evidence</h3><p>{state.recruit.ba_summary || 'Business evidence remains open until the recruit completes the optional BA.'}</p><b>{baReady ? 'Recruit source · intelligence ready' : 'Recruit source · not ready'}</b></article><article className="panel"><small>Manager-Supplied Evidence</small><h3>{(state.manager_evidence || []).length} separate evidence items</h3><p>Useful for hypotheses; never treated as something the recruit said.</p><b>Manager source · separately labeled</b></article></section>
      <button type="button" className="solid-button inline" onClick={() => navigate('intelligence')}>Open Recruiting Intelligence →</button>
      {bosReady && !baReady && <a className="text-action" href="/business-assessment?recruiting=1">Begin optional Business Assessment →</a>}
    </section>
  );
}

function ReadinessNode({ done, label, detail }) { return <div className={done ? 'done' : ''}><span>{done ? '✓' : '○'}</span><strong>{label}</strong><small>{detail}</small></div>; }

function OpportunitySurface({ state, setState }) {
  const [editing, setEditing] = useState(false);
  const items = state.opportunity?.items || [];
  async function addUnknown() {
    const nextItems = [...items, { opportunity_evidence_id: `opp_${Date.now()}`, category: 'GROWTH_PATH', scope: 'LOCAL_LEADER_PRIMARY', statement: 'Growth-path capacity requires current local proof before it becomes a recruiting claim.', status: 'UNKNOWN', source: 'Manager review needed', source_date: '2026-08-21', freshness: 'REVIEW_REQUIRED', constraints: [], counterevidence: [] }];
    if (!SYNTHETIC) await api({ action: 'SAVE_OPPORTUNITY', body: { items: nextItems } });
    setState((current) => ({ ...current, opportunity: { ...current.opportunity, items: nextItems } }));
    setEditing(false);
  }
  return (
    <section className="surface opportunity-surface" data-surface="opportunity">
      <p className="eyebrow green">Local Opportunity Authority</p><h1>What can this leader genuinely help an agent build?</h1><p className="surface-subhead">Local capability leads. Company facts support only when they are current, locally available, and materially relevant.</p>
      <section className="opportunity-summary panel"><div><span>⌾</span><div><small>Local leadership first</small><h2>{items.filter((item) => item.scope === 'LOCAL_LEADER_PRIMARY' && item.status === 'SUPPORTED').length} supported local capabilities</h2></div></div><div><span>△</span><div><small>Conditional</small><h2>{items.filter((item) => item.status === 'CONDITIONAL').length} promise requires verification</h2></div></div><div><span>○</span><div><small>Intentional unknowns</small><h2>{items.filter((item) => ['UNKNOWN', 'NON_PROMISE'].includes(item.status)).length} claims withheld</h2></div></div></section>
      <div className="opportunity-list">{items.map((item) => <article className="panel opportunity-card" key={item.opportunity_evidence_id}><header><span>{item.category.replaceAll('_', ' ')}</span><b className={`evidence-state ${item.status.toLowerCase()}`}>{item.status.replaceAll('_', ' ')}</b></header><h2>{item.statement}</h2><div className="provenance-row"><span>Source · {item.source}</span><span>Dated · {item.source_date}</span><span>{item.freshness}</span></div>{item.constraints?.length > 0 && <footer><b>Constraint</b>{item.constraints.join(' ')}</footer>}{item.counterevidence?.length > 0 && <footer className="counter"><b>Counterevidence</b>{item.counterevidence.join(' ')}</footer>}</article>)}</div>
      <button className="solid-button inline" type="button" onClick={() => setEditing(true)}>＋ Add capability or unknown</button>{editing && <div className="inline-editor panel"><p>Record what still needs verification instead of turning it into a promise.</p><button type="button" onClick={addUnknown}>Add an open question</button><button type="button" onClick={() => setEditing(false)}>Cancel</button></div>}
      <section className="secondary-company"><p className="eyebrow violet">Company facts · secondary support</p><p>Platform facts never substitute for local leadership proof.</p></section>
    </section>
  );
}

function EvidenceSurface({ state, setState, candidate }) {
  const [form, setForm] = useState({ type: 'CONVERSATION', claim: '', source: 'Manager conversation note', source_date: '2026-08-21' });
  const [saved, setSaved] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (!form.claim.trim()) return;
    const evidence = { evidence_id: `evidence_synthetic_${Date.now()}`, candidate_id: candidate.candidate_id, ...form, recorded_at: new Date().toISOString(), truth_class: 'MANAGER_SUPPLIED_EVIDENCE', canonical_recruit_truth_mutated: false };
    const persisted = SYNTHETIC ? evidence : (await api({ action: 'ADD_EVIDENCE', body: { candidate_id: candidate.candidate_id, evidence: form } })).evidence;
    setState((current) => ({ ...current, manager_evidence: [...(current.manager_evidence || []), persisted], intelligence: current.intelligence ? { ...current.intelligence, stale: true } : null }));
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

function IntelligenceSurface({ state, setState, candidate, navigate }) {
  async function generate() {
    const payload = await api({ action: 'GENERATE_INTELLIGENCE', body: { candidate_id: candidate.candidate_id } });
    setState((current) => ({ ...current, intelligence: payload.intelligence }));
  }
  if (!state.intelligence?.output) return <NotReadySurface title="Recruiting Intelligence is not ready yet." copy="The recruit’s profile and at least one supported local capability are required before a complete view can be created." actionLabel="Create Recruiting Intelligence" onAction={generate} />;
  const output = state.intelligence.output;
  return (
    <section className="surface intelligence-surface" data-surface="intelligence">
      <p className="eyebrow violet">Main Recruiting Intelligence</p><h1>Understand {candidate.recruit_name} before you decide what to say.</h1><p className="surface-subhead">Bilateral reasoning connects two people, one business reality, and only the local help that is actually supported.</p>
      {state.intelligence.stale && <div className="stale-banner"><b>Evidence changed</b><span>The last complete view remains visible, but it does not yet include the newest information.</span><button type="button" onClick={generate}>Refresh with current evidence</button></div>}
      <section className="understand-hero panel"><div><p className="eyebrow green">Understand This Recruit</p><h2>{output.understand_this_recruit.summary}</h2></div><ul>{output.understand_this_recruit.important_realities.map((item) => <li key={item}>✓ {item}</li>)}</ul></section>
      <section className="bilateral panel"><header><p className="eyebrow teal">Bilateral Communication Advantage</p><span>Recruiter ↔ Recruit</span></header><div className="bilateral-people"><div><b>SB</b><strong>{state.manager.name}</strong><small>Fast · direct · coaching systems</small></div><i>↔</i><div><b>EB</b><strong>{candidate.recruit_name}</strong><small>Deliberate · detailed · trust-sensitive</small></div></div><div className="bilateral-grid"><article><small>Your advantage</small><p>{output.bilateral_communication.advantage}</p></article><article><small>Your watchout</small><p>{output.bilateral_communication.recruiter_watchout}</p></article><article><small>Authentic adaptation</small><p>{output.bilateral_communication.adaptation}</p></article></div></section>
      <div className="section-heading angles-heading"><div><p className="eyebrow amber">Authentic recruiting angles</p><h2>{output.authentic_angles.length} supported paths - not a quota of three.</h2></div><span>Evidence linked</span></div>
      <div className="angle-grid">{output.authentic_angles.map((angle, index) => <article className="panel angle-card" key={angle.title}><header><span>0{index + 1}</span><b>Supported hypothesis</b></header><h2>{angle.title}</h2><dl><div><dt>What matters</dt><dd>{angle.recruit_need}</dd></div><div><dt>Current reality</dt><dd>{angle.current_reality}</dd></div><div><dt>Locally supported help</dt><dd>{angle.locally_supported_help}</dd></div></dl><blockquote>“{angle.validating_question}”</blockquote><footer><span>{angle.uncertainty}</span><b>{angle.recruit_evidence_ids.length + angle.opportunity_evidence_ids.length} evidence links</b></footer></article>)}</div>
      <section className="withheld panel"><span>⊘</span><div><p className="eyebrow amber">Intentionally withheld</p><h2>{output.withheld_angles[0]}</h2><p>Unknown is a product result. It prevents a local claim from becoming a recruiting promise.</p></div></section>
      <section className="success-environment"><div><p className="eyebrow green">Real Estate success is plural</p><h2>No single personality pattern owns success.</h2></div>{[['Natural success patterns', output.success_environment.natural_success_patterns], ['Supportive conditions', output.success_environment.supportive_conditions], ['Likely friction', output.success_environment.likely_frictions]].map(([title, items]) => <article className="panel" key={title}><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></article>)}</section>
      <section className="missing-panel panel"><p className="eyebrow amber">What still needs to be learned</p><div>{output.missing_evidence.map((item) => <span key={item}>{item}</span>)}</div></section>
      <button className="solid-button inline" type="button" onClick={() => navigate('meeting')}>Open five-minute Meeting Plan →</button>
    </section>
  );
}

function MeetingSurface({ state, candidate, navigate }) {
  if (!state.intelligence?.output) return <NotReadySurface title="The Meeting Plan is not ready." copy="Create complete Recruiting Intelligence first. An incomplete result never becomes a meeting brief." />;
  const plan = state.intelligence.output.meeting_plan;
  return (
    <section className="surface meeting-surface" data-surface="meeting">
      <p className="eyebrow amber">Meeting Plan</p><h1>Five minutes before meeting {candidate.recruit_name}.</h1><p className="surface-subhead">Guidance for a useful conversation - never a script.</p>
      <section className="meeting-start panel"><span>01</span><div><p className="eyebrow green">Start Here</p><h2>{plan.start_here}</h2></div></section>
      <div className="meeting-grid"><MeetingBlock number="02" tone="teal" title="Learn" items={plan.learn} /><MeetingBlock number="03" tone="violet" title="Listen For" items={plan.listen_for} /><MeetingBlock number="04" tone="amber" title="Your Watchout" text={plan.your_watchout} /><MeetingBlock number="05" tone="blue" title="Supported paths - if confirmed" items={plan.supported_paths_if_confirmed} /></div>
      <section className="do-not-assume panel"><span>⊘</span><div><p className="eyebrow coral">Do Not Assume</p><h2>{plan.do_not_assume}</h2></div></section>
      <section className="meeting-next panel"><span>→</span><div><p className="eyebrow blue">If fit is real</p><h2>{plan.next_step_if_fit_is_real}</h2></div></section>
      <div className="meeting-footer"><small>Built from four separate sources · {state.intelligence.output.authentic_angles.length} supported paths · {state.intelligence.output.missing_evidence.length} open evidence gaps</small><button className="solid-button inline" type="button" onClick={() => navigate('export')}>Save or print this brief →</button></div>
    </section>
  );
}

function MeetingBlock({ number, tone, title, items, text }) { return <article className={`panel meeting-block tone-${tone}`}><span>{number}</span><p className="eyebrow">{title}</p>{text ? <h2>{text}</h2> : <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>}</article>; }

function ExportSurface({ state, candidate }) {
  const requestedMode = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('mode') : null;
  const [mode, setMode] = useState(['meeting', 'full', 'both'].includes(requestedMode) ? requestedMode : 'meeting');
  const [details, setDetails] = useState(false);
  if (!state.intelligence?.output) return <NotReadySurface title="There is no complete intelligence to export." copy="Save and print become available after a complete, evidence-checked view is ready." />;
  async function print() {
    if (!SYNTHETIC) await api({ action: 'RECORD_EXPORT', body: { candidate_id: candidate.candidate_id, mode, details_included: details } });
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
      setMessage(error.message);
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
