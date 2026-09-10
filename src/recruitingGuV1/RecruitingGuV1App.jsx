import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import NewBosExperience from '../components/newBosPersonalityDnaV1/NewBosExperience.jsx';
import BusinessTwinApp from '../lab/baProgressiveDisclosureV1/BusinessTwinApp.jsx';
import RecruitingV2Renderer from '../recruitingV2/RecruitingV2Renderer.jsx';
import { fetchApprovalPreview, fetchGuHome, fetchGuSession, mutateGu, decideApproval, resetGuDemoSubject } from '../lib/recruitingGuV1/client.js';
import { acceptedPlanPointerKey, acceptedPlanReceiptMatches, acceptedPlanStorageKey, preferredDemoRecoverySubject } from '../lib/recruitingGuV1/acceptedPlanStorage.js';
import { visibleConversationForRoom } from '../lib/recruitingGuV1/session.js';
import '../recruitingV2/recruitingV2.css';
import '../components/baProductionReadinessV1/newBaProductionCanary.css';
import './recruitingGuV1.css';

const ROOMS = ['HOME', 'YOU', 'YOUR_BUSINESS', 'PLAN'];
const LABEL = { HOME: 'HOME', YOU: 'YOU', YOUR_BUSINESS: 'YOUR BUSINESS', PLAN: 'PLAN' };
const SUGGESTIONS = Object.freeze({
  YOU: [
    'What should I understand about this person that might not be obvious at first?',
    'What could be one of their biggest strengths—and when could that same strength get in their way?',
  ],
  YOUR_BUSINESS: [
    'If you were coaching this person, what would you help them see first?',
    'What looks like the biggest opportunity in this business right now—and what might be keeping this person from getting where they want to go?',
  ],
});

function MoreMark({ real = false }) {
  return <div className="gu-brand"><span>M</span><div><strong>MORE</strong>{real ? <small>Consulting Tool</small> : <small>Consulting Demonstration</small>}</div></div>;
}

function AppHeader({ room, manager, synthetic, onRoom, real, navigationDisabled = false }) {
  return <header className="gu-header">
    <MoreMark real={real} />
    <nav aria-label={real ? 'Consulting rooms' : 'Consulting demonstration rooms'}>{ROOMS.map((item) => <button type="button" key={item} disabled={navigationDisabled} className={room === item ? 'active' : ''} onClick={() => onRoom(item)}>{LABEL[item]}</button>)}</nav>
    <div className="gu-account"><button type="button" aria-label="Help">?</button>{synthetic && <span className="gu-synthetic-pill">SYNTHETIC · LOCAL ONLY</span>}<div><b>{manager?.name || 'Manager'}</b><small>{manager?.entitlement_mode === 'unlimited' ? 'admin / unlimited' : 'Manager'}</small></div></div>
  </header>;
}

function SubjectTabs({ subjects, activeSubject, busy, onSubject, onReset }) {
  if (!subjects?.length) return null;
  return <nav className="gu-subject-tabs" aria-label="Demonstration subjects">
    <span>DEMONSTRATION SUBJECT</span>
    {subjects.map((subject) => <button type="button" key={subject.id} className={activeSubject === subject.id ? 'active' : ''} disabled={busy} onClick={() => onSubject(subject.id)}>{subject.label}</button>)}
    {/* DARRENDEMO ONLY: never mount this reset control in a live Consulting customer product. */}
    <button type="button" className="gu-subject-tabs__reset" data-demo-only-control="true" disabled={busy || !activeSubject} onClick={onReset}>Reset Demo</button>
    <small>Synthetic + Founder-authorized read-only</small>
  </nav>;
}

function OrbitGraphic() {
  return <div className="gu-orbit" aria-hidden="true"><i /><i /><span className="gu-orbit__person"><HomeIcon type="person" /></span><span className="gu-orbit__business"><HomeIcon type="business" /></span><span className="gu-orbit__chart"><HomeIcon type="chart" /></span><b>M</b></div>;
}

function HomeIcon({ type }) {
  if (type === 'person') return <svg viewBox="0 0 32 32"><circle cx="16" cy="10" r="5"/><path d="M7 27c.5-7 4-10 9-10s8.5 3 9 10"/></svg>;
  if (type === 'people') return <svg viewBox="0 0 36 32"><circle cx="13" cy="10" r="4"/><circle cx="24" cy="10" r="4"/><path d="M4 27c.5-6 3.5-9 9-9s8 3 9 9M17 27c.4-5.5 2.8-8 7-8s6.5 2.5 7 8"/></svg>;
  if (type === 'business') return <svg viewBox="0 0 32 32"><path d="M7 28V5h16v23M4 28h24M11 10h3M18 10h2M11 15h3M18 15h2M11 20h3M18 20h2M14 28v-4h4v4"/></svg>;
  if (type === 'chart') return <svg viewBox="0 0 32 32"><path d="M6 27V17h5v10M14 27V12h5v15M22 27V7h5v20M5 9l7 3 6-7 9 3"/></svg>;
  return <svg viewBox="0 0 32 32"><path d="M12 4h8M14 4v8L7 25c-1 2 0 3 2 3h14c2 0 3-1 2-3l-7-13V4M10 22h12"/></svg>;
}

function HomeCard({ tone, icon, title, copy, button, footer, onClick, disabled = false }) {
  return <article className={`gu-home-card gu-home-card--${tone}`}><span className="gu-home-card__icon"><HomeIcon type={icon} /></span><h2>{title}</h2><p>{copy}</p><button type="button" disabled={disabled} onClick={onClick}>{button}</button><footer>{footer}<span>›</span></footer></article>;
}

function Home({ data, selected, onContinue, onOpenCandidate, onOpenRelationship, onDemo, onMoreId, real, onPlan }) {
  const [chooser, setChooser] = useState(false);
  const [showMoreId, setShowMoreId] = useState(false);
  const [moreId, setMoreId] = useState('');
  const [pending, setPending] = useState('');
  const ready = (data.candidates || []).filter((item) => item.accepted_at && item.bos_profile_id);
  const approved = (data.relationships || []).filter((item) => item.status === 'ACTIVE' && item.source === 'MORE_ID_OWNER_APPROVAL');
  const canOpenDarrenDemo = data.manager?.capabilities?.darren_synthetic_demo === true;
  async function submit(event) {
    event.preventDefault();
    setPending('Sending an owner-controlled approval request…');
    try { await onMoreId(moreId); setPending('Request sent. Their MORE ID did not grant access; the owner must approve.'); } catch (error) { setPending(error.message); }
  }
  if (real) return <main className="gu-home">
    <section className="gu-home__hero"><div><p className="gu-kicker">CONSULTING TOOL</p><h1>{selected ? `Your consultation with ${selected.name}.` : 'Choose who you are meeting with.'}</h1><p>{selected ? 'Explore Personality DNA, Business Assessment, and build a shared plan together with MORE guiding the conversation.' : 'Your invitation list connects the person and their complete BOS and BA results.'}</p></div><OrbitGraphic /></section>
    {selected ? <section className="gu-home-grid">
      <HomeCard tone="green" icon="person" title={`Continue with ${selected.name}`} copy="Explore their complete BOS and BA. Your conversation stays in this shared session." button="Open YOU" footer="Person selected · session continuous" onClick={onContinue} />
      <HomeCard tone="blue" icon="people" title="Plan together" copy="Talk through commitments, conditions and timing, then decide on the shared next steps." button="Open PLAN" footer="Review together before accepting" onClick={onPlan} />
    </section> : <section className="gu-home-picker"><h2>No consultation is selected.</h2><p>Choose a ready person from your authorized invitation list.</p><button type="button" onClick={() => window.location.assign('/recruiting/consulting')}>Back to My Recruits →</button></section>}
    <footer className="gu-trust">▢ &nbsp; Secure. Private. Built on trust.</footer>
  </main>;
  return <main className="gu-home">
    <section className="gu-home__hero"><div><p className="gu-kicker">CONSULTING DEMONSTRATION</p><h1>Where would you<br />like to begin?</h1><p>Explore Personality DNA, Business Assessment, and build a shared plan together with MORE guiding the conversation.</p></div><OrbitGraphic /></section>
    <p className="gu-kicker gu-start-label">START A CONSULTATION</p>
    <section className={`gu-home-grid ${canOpenDarrenDemo ? 'gu-home-grid--three' : ''}`}>
      <HomeCard tone="green" icon="person" title={selected ? `Continue with ${selected.name}` : 'Continue with a person'} copy={selected ? 'This approved consultation is ready. Begin with their complete BOS.' : 'Pick up where you left off in an approved shared consultation.'} button={selected ? 'Open YOU' : 'Choose person'} footer={selected ? 'Person selected · session continuous' : `${ready.length} ready to continue`} onClick={selected ? onContinue : () => setChooser((value) => !value)} />
      <HomeCard tone="blue" icon="people" title="Meet with another MORE member" copy="Enter their MORE ID to start a business consultation together." button="Enter MORE ID" footer="Requires their approval" onClick={() => { setShowMoreId(true); setTimeout(() => document.getElementById('gu-more-id')?.focus(), 0); }} />
      {canOpenDarrenDemo && <HomeCard tone="gold" icon="flask" title="Darren + Jordan Demonstration" copy="Use a synthetic Jordan profile to experience MORE end-to-end." button="Open demonstration" footer="Synthetic · Demonstration only" onClick={onDemo} />}
    </section>
    {chooser && <section className="gu-home-picker" aria-label="Ready people"><header><div><p className="gu-kicker">READY PEOPLE</p><h2>Who are you meeting with?</h2></div><button type="button" onClick={() => setChooser(false)}>Close</button></header>{ready.map((item) => <button type="button" key={item.candidate_id} onClick={() => onOpenCandidate(item.candidate_id)}><span>{item.recruit_name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div><strong>{item.recruit_name}</strong><small>{item.ba_readiness?.replaceAll('_', ' ')}</small></div><b>Begin →</b></button>)}{approved.map((item) => <button type="button" key={item.relationship_id} onClick={() => onOpenRelationship(item.relationship_id)}><span>{item.owner_name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div><strong>{item.owner_name}</strong><small>Owner-approved MORE-ID consultation</small></div><b>Begin →</b></button>)}{!ready.length && !approved.length && <p>No approved, BOS-ready person is available yet.</p>}</section>}
    {showMoreId && <form className="gu-more-id" onSubmit={submit}><label htmlFor="gu-more-id">MORE ID</label><input id="gu-more-id" value={moreId} onChange={(event) => setMoreId(event.target.value)} placeholder="mm-YYYYMMDD-xxxxxxxx" /><button type="submit" disabled={!moreId.trim()}>Request owner approval</button><p>{pending || 'A MORE ID identifies a profile. It never grants consultation access by itself.'}</p></form>}
    <footer className="gu-trust">▢ &nbsp; Secure. Private. Built on trust.</footer>
  </main>;
}

function ThinkingProgress({ stage }) {
  return <div className="gu-thinking" role="status"><span className="gu-thinking__mark">M</span><div><strong>MORE is building the current thinking environment.</strong><p>{stage}</p></div><i /></div>;
}

function ConversationRail({ room, session, busy, progress, error, onSubmit, onSuggestion, readOnly = false }) {
  const [value, setValue] = useState('');
  const listRef = useRef(null);
  const submissionLocked = useRef(false);
  const visibleConversation = visibleConversationForRoom(session, room);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [visibleConversation.length, busy]);
  async function submit(event) {
    event.preventDefault();
    const clean = value.trim();
    if (!clean || busy || readOnly || submissionLocked.current) return;
    submissionLocked.current = true;
    try {
      setValue('');
      await onSubmit(clean, 'MANAGER');
    } finally {
      submissionLocked.current = false;
    }
  }
  function handleKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent?.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
  const suggestions = SUGGESTIONS[room] || [];
  const activeProposal = session.proposals?.find((item) => item.proposal_id === session.current_proposal_id);
  const adjustingPlan = room === 'PLAN' && activeProposal?.status === 'ADJUSTMENT_REQUESTED';
  return <aside className="gu-chat" aria-label="MORE conversation">
    <header>{adjustingPlan ? 'PLAN ADJUSTMENT' : room === 'PLAN' ? 'PLAN CONVERSATION' : 'MORE CONVERSATION'}</header>
    <div className="gu-chat__thread" ref={listRef}><span className="gu-chat__m">M</span>{visibleConversation.map((turn) => <article key={turn.turn_id} className={`gu-turn gu-turn--${turn.actor.toLowerCase()}`}><small>{turn.actor === 'MANAGER' ? session.manager_binding.name : turn.actor === 'INVITEE' ? session.subject_binding.name : 'MORE'}</small>{turn.actor === 'MORE' && turn.insight ? <><strong className="gu-turn__insight">{turn.insight}</strong><p>{turn.explanation}</p><p className="gu-turn__question">{turn.question}</p></> : <p>{turn.text}</p>}</article>)}{busy && <ThinkingProgress stage={progress} />}{error && <p className="gu-chat__error" role="alert">{error}</p>}</div>
    <div className="gu-chat__bottom">{suggestions.length > 0 && !readOnly && <section className="gu-suggestions"><p>SUGGESTED QUESTIONS</p>{suggestions.map((item) => <button type="button" key={item} disabled={busy} onClick={() => onSuggestion(item)}>{item}</button>)}</section>}
      {readOnly ? <p className="gu-trust">This completed consultation is available for review.</p> : <form onSubmit={submit}><textarea value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={handleKeyDown} placeholder={adjustingPlan ? 'Say what should change—commitments, conditions, or timing…' : room === 'PLAN' ? 'Type naturally. Share what you’re willing to do…' : 'What are you trying to understand together?'} /><div><span>Enter to send · Shift+Enter for a new line</span><button type="submit" className="gu-send" disabled={!value.trim() || busy}>↑</button></div></form>}
    </div>
  </aside>;
}

function EvidenceDrawer({ evidence, onClose }) {
  if (!evidence?.length) return null;
  return <div className="gu-evidence-layer" role="dialog" aria-modal="true" aria-label="Governed evidence"><button type="button" className="gu-evidence-scrim" onClick={onClose} aria-label="Close evidence" /><aside><header><p className="gu-kicker">GOVERNED EVIDENCE</p><button type="button" onClick={onClose}>×</button></header>{evidence.map((item) => <article key={item.id}><small>{item.truthClass || item.confidence}</small><h3>{item.title}</h3><p>{item.statement}</p><footer>{item.source} · {item.sourceDate}</footer></article>)}</aside></div>;
}

function PreviousPlansDrawer({ plans, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus?.(); };
  }, [onClose]);
  return <div className="gu-evidence-layer" role="dialog" aria-modal="true" aria-label="Previous agreed plans"><button type="button" className="gu-evidence-scrim" onClick={onClose} aria-label="Close previous agreed plans" /><aside><header><p className="gu-kicker">PREVIOUS AGREED PLANS</p><button ref={closeRef} type="button" onClick={onClose} aria-label="Close plan history">×</button></header>{plans.map((item) => <section key={item.session_id}><p className="gu-kicker">Agreed {new Date(item.completed_at).toLocaleDateString()}</p><PlanProposal proposal={{ version: item.accepted_plan_snapshot.version, proposal: item.accepted_plan_snapshot.plan }} actions={false} /></section>)}</aside></div>;
}

function Projection({ projection, scenarioValues, onScenarioChange, onScenarioApply, onEvidence, onHypothesis, onClose }) {
  if (!projection?.plan) return null;
  return <section className="gu-projection" aria-label="MORE generated thinking environment" data-total-latency={projection.receipt?.totalLatencyMs || ''}><header><div><p className="gu-kicker">MORE · CURRENT THINKING ENVIRONMENT</p><h1>{projection.plan.guidance.headline}</h1><p>{projection.plan.guidance.summary}</p></div><button type="button" onClick={onClose}>Return to full product</button></header><RecruitingV2Renderer plan={projection.plan} onEvidence={onEvidence} onHypothesis={onHypothesis} scenarioValues={scenarioValues} onScenarioChange={onScenarioChange} onScenarioApply={onScenarioApply} /></section>;
}

function AuthoredRoom({ room, surfaces, projection, showProjection, projectionProps }) {
  return <div className={`gu-authored gu-authored--${room === 'YOU' ? 'bos' : 'ba'}`}>
    <div className="gu-authored__canvas" aria-hidden={showProjection ? 'true' : undefined}>{room === 'YOU'
      ? <NewBosExperience artifactOverride={surfaces.bos} customerMode runtimeLabel="Complete governed BOS · consultation read" />
      : surfaces.ba ? <div className="new-ba-production-experience"><BusinessTwinApp viewModel={surfaces.ba} /></div> : <div className="gu-missing-ba"><p className="gu-kicker">BUSINESS TWIN</p><h1>The complete BA is not ready yet.</h1><p>MORE will not invent or flatten a business assessment that does not exist.</p></div>}</div>
    {showProjection && <Projection projection={projection} {...projectionProps} />}
  </div>;
}

function PlanRoom({ session, busy, onDecision, onSecondOffer, real }) {
  const proposal = session.proposals?.find((item) => item.proposal_id === session.current_proposal_id);
  const lastDecision = session.decisions?.at(-1)?.decision;
  const receipt = session.effect_receipts?.at(-1);
  const accepted = session.accepted_plan_snapshot;
  if (session.status === 'COMPLETED' && lastDecision === 'YES') return <main className="gu-plan gu-plan--complete"><p className="gu-kicker">THE ANSWER THE TWO OF YOU REACHED.</p><h1>Congratulations — let’s get started.</h1><p>The exact agreed plan is recorded in this Shared Business Session.</p><PlanProposal proposal={accepted ? { version: accepted.version, proposal: accepted.plan } : proposal} actions={false} /><AgreementDeliveryStatus delivery={session.agreement_delivery} /></main>;
  if (real && session.status === 'COMPLETED' && receipt) return <main className="gu-plan gu-plan--complete"><p className="gu-kicker">MEETING COMPLETE</p><h1>This consultation has ended.</h1><p>No sponsored MORE access is confirmed here.</p></main>;
  if (session.status === 'COMPLETED' && receipt) return <main className="gu-plan gu-plan--complete"><p className="gu-kicker">STAY CONNECTED</p><h1>{session.subject_binding.name} accepted 3 months of MORE.</h1><div className="gu-receipt"><p>One-time sponsor payment <b>simulated</b></p><p>Activation email <b>simulated</b></p><p>3-month MORE entitlement <b>simulated</b></p><p>90-day follow-up <b>scheduled</b></p><p>Reminders <b>simulated</b></p></div></main>;
  if (session.status === 'COMPLETED' && lastDecision === 'CLOSE_GRACEFULLY') return <main className="gu-plan gu-plan--complete"><p className="gu-kicker">MEETING COMPLETE</p><h1>Thank you for the honest conversation.</h1><p>No plan, payment, entitlement, email, or follow-up was created.</p></main>;
  if (real && session.status === 'SECOND_OFFER') return <main className="gu-plan gu-plan--offer"><p className="gu-kicker">NO PLAN ACCEPTED</p><h1>That’s okay.</h1><p>A three-month sponsored MORE option is not available in this consultation. You can close the conversation without accepting a plan or activating anything.</p><div><button type="button" disabled={busy} onClick={() => onSecondOffer('CLOSE_GRACEFULLY')}>Close Gracefully</button></div></main>;
  if (session.status === 'SECOND_OFFER') return <main className="gu-plan gu-plan--offer"><p className="gu-kicker">ONE MORE OPTION</p><h1>That’s okay.</h1><p>Darren would still like to give you 3 months of MORE and reconnect in 90 days.</p><div><button type="button" disabled={busy} onClick={() => onSecondOffer('STAY_CONNECTED')}>YES — Stay Connected</button><button type="button" disabled={busy} onClick={() => onSecondOffer('CLOSE_GRACEFULLY')}>NO — Close Gracefully</button></div></main>;
  if (proposal?.status === 'ADJUSTMENT_REQUESTED') return <main className="gu-plan gu-plan--adjusting"><p className="gu-kicker">ADJUSTING THIS SHARED PLAN</p><h1>What should change?</h1><p>The current draft is preserved below. Use the same PLAN conversation to say what should change about the commitments, conditions, or timing. MORE will revise this draft and bring back a clean plan for YES / ADJUST / NOT NOW.</p><PlanProposal proposal={proposal} actions={false} /></main>;
  return <main className="gu-plan"><p className="gu-kicker">PLAN TOGETHER</p><h1>Let’s decide together<br />on a few next steps.</h1><i /><p>Share what you’re willing to do to support this person’s business<br />and what outcome you want to create together.</p><p>I’ll turn your commitments into a clear plan we can decide on—together.</p>{proposal ? <PlanProposal proposal={proposal} onDecision={onDecision} busy={busy} /> : <div className="gu-plan__start"><span>◯</span><strong>Start the conversation</strong><p>Type what you’re willing to do, what outcome<br />you want, and any conditions or timing.</p></div>}</main>;
}

function ArchivedConsultation({ bundle }) {
  const accepted = bundle.session?.accepted_plan_snapshot;
  return <main className="gu-plan gu-plan--complete" data-archived-consultation="true"><p className="gu-kicker">EARLIER CONSULTATION</p><h1>This consultation uses an earlier record.</h1><p>{bundle.archive?.message || 'Your saved plan is retained. Start another consultation to use the current record.'}</p>{accepted && <PlanProposal proposal={{ version: accepted.version, proposal: accepted.plan }} actions={false} />}</main>;
}

function AgreementDeliveryStatus({ delivery }) {
  if (!delivery || delivery.status === 'NOT_STARTED') return null;
  const delivered = delivery.recipients?.filter((item) => item.state === 'DELIVERED').length || 0;
  const copy = delivery.status === 'DELIVERED'
    ? 'A copy of this exact agreed plan was prepared for both people.'
    : delivery.status === 'PENDING'
      ? 'The agreed plan is accepted. Email delivery is still pending.'
      : `The agreed plan is accepted. ${delivered} of 2 email copies were delivered; delivery can be retried safely without changing the plan.`;
  return <section className={`gu-plan-delivery gu-plan-delivery--${delivery.status.toLowerCase()}`} aria-label="Agreed plan email status"><strong>AGREED PLAN EMAIL</strong><p>{copy}</p></section>;
}

function PlanProposal({ proposal, onDecision, busy, actions = true }) {
  if (!proposal) return null;
  return <section className="gu-plan-proposal"><p className="gu-kicker">CLEAN PLAN · VERSION {proposal.version}</p><h2>{proposal.proposal.title}</h2><p>{proposal.proposal.summary}</p><div>{proposal.proposal.commitments.map((item, index) => <article key={`${item.owner}-${index}`}><span>{index + 1}</span><div><small>{item.owner} · {item.timing}</small><h3>{item.commitment}</h3><p>{item.intendedOutcome}</p></div></article>)}</div>{proposal.proposal.unresolved?.length > 0 && <footer><strong>Still to resolve</strong>{proposal.proposal.unresolved.join(' · ')}</footer>}{actions && <nav><button type="button" disabled={busy} onClick={() => onDecision('YES')}>YES</button><button type="button" disabled={busy} onClick={() => onDecision('ADJUST')}>ADJUST</button><button type="button" disabled={busy} onClick={() => onDecision('NOT_NOW')}>NOT NOW</button></nav>}</section>;
}

function BottomNav({ room, onRoom }) {
  const index = ROOMS.indexOf(room);
  if (room === 'HOME') return null;
  return <nav className="gu-bottom-nav"><button type="button" onClick={() => onRoom(ROOMS[index - 1])}>← <span>Back</span></button>{room !== 'PLAN' && <button type="button" className="gu-bottom-nav__next" onClick={() => onRoom(ROOMS[index + 1])}><span>Next</span> →</button>}</nav>;
}

function ApprovalPage({ token }) {
  const [state, setState] = useState({ status: 'loading', preview: null, csrf: '', error: '' });
  useEffect(() => { fetchApprovalPreview(token).then((payload) => setState({ status: 'ready', preview: payload.preview, csrf: payload.csrf_token, error: '' })).catch((error) => setState({ status: 'error', preview: null, csrf: '', error: error.message })); }, [token]);
  async function decide(decision) { try { await decideApproval({ token, decision, csrf: state.csrf }); setState((current) => ({ ...current, status: decision === 'APPROVE' ? 'approved' : 'declined' })); } catch (error) { setState((current) => ({ ...current, error: error.message })); } }
  return <main className="gu-approval"><MoreMark />{state.status === 'loading' ? <h1>Opening your private decision…</h1> : ['approved', 'declined'].includes(state.status) ? <><p className="gu-kicker">YOUR CHOICE IS RECORDED</p><h1>{state.status === 'approved' ? 'You approved this consultation.' : 'You declined this consultation.'}</h1><p>You remain in control. Your MORE ID alone never granted access.</p></> : state.preview ? <><p className="gu-kicker">OWNER-CONTROLLED CONSULTATION</p><h1>{state.preview.manager_name} would like to think with you in MORE.</h1><p>{state.preview.purpose}</p><section><h2>Before you decide</h2><ul><li>Your complete BOS remains yours.</li><li>Your Business Twin is read only when available.</li><li>The session cannot rewrite canonical truth.</li><li>You can decline.</li></ul></section><div><button type="button" onClick={() => decide('APPROVE')}>Approve consultation</button><button type="button" onClick={() => decide('DECLINE')}>Decline</button></div></> : <><h1>This approval request is unavailable.</h1><p>{state.error}</p></>}</main>;
}

export default function RecruitingGuV1App() {
  const location = useLocation();
  return <ConsultingExperience key={`${location.pathname}${location.search}`} />;
}

function ConsultingExperience() {
  const location = useLocation();
  const realConsulting = !location.pathname.includes('/demo');
  const selectedCandidateId = new URLSearchParams(location.search).get('candidate_id');
  const approvalToken = location.pathname.includes('/approve/') ? location.pathname.split('/approve/')[1] : '';
  const [home, setHome] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('Reading the governed evidence…');
  const [projectionVisible, setProjectionVisible] = useState(true);
  const [scenarioValues, setScenarioValues] = useState({});
  const [evidence, setEvidence] = useState(null);
  const [activeSubject, setActiveSubject] = useState(null);
  const [reviewRoom, setReviewRoom] = useState(null);
  const [previousPlansVisible, setPreviousPlansVisible] = useState(false);
  const session = bundle?.session;
  const room = bundle?.requires_new_consultation ? 'HOME' : reviewRoom || session?.current_room || 'HOME';
  const progressTimer = useRef(null);
  const initialized = useRef(false);
  const newConsultationLocked = useRef(false);

  useEffect(() => {
    if (approvalToken) return;
    if (initialized.current) return;
    initialized.current = true;
    fetchGuHome().then(async (payload) => {
      setHome(payload);
      if (selectedCandidateId && realConsulting) return openCandidate(selectedCandidateId);
      // A real consultation is opened by its server-verified candidate relationship.
      // Browser state never selects a person or a demo capability for a real manager.
      if (realConsulting) return null;
      const managerId = payload.manager?.subject_id;
      const pointerKey = acceptedPlanPointerKey('demo', managerId);
      const persistedSubject = preferredDemoRecoverySubject({ rememberedSubject: pointerKey ? window.sessionStorage.getItem(pointerKey) : null, activeSubject: payload.active_subject, allowedSubjects: payload.experiment_subjects?.map((item) => item.id) || (payload.synthetic_only ? ['SYNTHETIC'] : []) });
      const receiptScope = { mode: 'demo', managerId, subjectId: persistedSubject };
      const receiptKey = acceptedPlanStorageKey(receiptScope);
      let receipt;
      try { receipt = receiptKey ? JSON.parse(window.sessionStorage.getItem(receiptKey)) : null; } catch { receipt = null; }
      if (receipt?.sessionId && receipt.mode === receiptScope.mode && receipt.managerId === managerId && receipt.subjectId === persistedSubject) {
        try {
          const recovered = await fetchGuSession(receipt.sessionId);
          if (acceptedPlanReceiptMatches(recovered.session, receipt, receiptScope)) {
            setActiveSubject(persistedSubject);
            setBundle({ session: recovered.session, manager: payload.manager });
            setProjectionVisible(false);
            return;
          }
          window.sessionStorage.removeItem(receiptKey);
        } catch { window.sessionStorage.removeItem(receiptKey); }
      }
      if (payload.active_session_id && payload.experiment_only) return mutateGu('OPEN_EXPERIMENT_SUBJECT', { subject: payload.active_subject }).then((opened) => { setActiveSubject(payload.active_subject); setBundle(opened); setProjectionVisible(Boolean(opened.session.current_projection)); });
      if (payload.active_session_id && payload.synthetic_only) return mutateGu('OPEN_SYNTHETIC_DEMO').then((opened) => { setActiveSubject('SYNTHETIC'); setBundle(opened); setProjectionVisible(Boolean(opened.session.current_projection)); });
      return null;
    }).catch((failure) => setError(failure.message));
  }, [approvalToken, selectedCandidateId, realConsulting]);

  useEffect(() => () => clearInterval(progressTimer.current), []);
  const projection = session?.current_projection;
  const showProjection = projectionVisible && projection?.room === room;
  const manager = bundle?.manager || home?.manager;
  const storageManagerId = session?.manager_binding?.subject_id || manager?.subject_id;
  const storageSubjectId = realConsulting ? session?.subject_binding?.candidate_id : activeSubject;
  const acceptedPlanKey = acceptedPlanStorageKey({ mode: realConsulting ? 'real' : 'demo', managerId: storageManagerId, subjectId: storageSubjectId });

  function beginProgress() {
    const stages = ['Understanding what matters most now…', 'Preparing one useful coaching thought…', 'Getting the question clear…'];
    let index = 0;
    setProgress(stages[0]);
    clearInterval(progressTimer.current);
    progressTimer.current = setInterval(() => { index = Math.min(index + 1, stages.length - 1); setProgress(stages[index]); }, 2200);
  }

  async function openCandidate(candidateId) {
    setBusy(true); setError(''); setBundle(null); setScenarioValues({}); setEvidence(null);
    try { const payload = await mutateGu('OPEN_CANDIDATE', { candidate_id: candidateId }); setBundle(payload); setProjectionVisible(Boolean(payload.session.current_projection)); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function openRelationship(relationshipId) {
    setBusy(true); setError('');
    try { const payload = await mutateGu('OPEN_RELATIONSHIP', { relationship_id: relationshipId }); setBundle(payload); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function openDemo() {
    setBusy(true); setError('');
    try {
      const payload = await mutateGu(home.synthetic_only ? 'OPEN_SYNTHETIC_DEMO' : 'OPEN_DARREN_DEMO');
      if (payload.redirect_to) { window.location.assign(payload.redirect_to); return; }
      setActiveSubject('SYNTHETIC'); setBundle(payload); setProjectionVisible(Boolean(payload.session.current_projection));
    }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function openSubject(subject) {
    if (busy || (activeSubject === subject && !error)) return;
    setBusy(true); setError('');
    try {
      const payload = await mutateGu('OPEN_EXPERIMENT_SUBJECT', { subject });
      setActiveSubject(subject);
      const pointerKey = acceptedPlanPointerKey('demo', payload.session.manager_binding.subject_id);
      if (pointerKey) window.sessionStorage.setItem(pointerKey, subject);
      setBundle(payload);
      setProjectionVisible(Boolean(payload.session.current_projection));
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function resetSelectedSubject() {
    if (!activeSubject || busy) return;
    const subject = activeSubject;
    setBusy(true); setError('');
    try {
      const receipt = await resetGuDemoSubject(subject);
      if (receipt.reset !== true || receipt.subject !== subject || receipt.external_mutation !== false || receipt.canonical_mutation !== false) throw new Error('DEMO_RESET_RECEIPT_INVALID');
      if (acceptedPlanKey) window.sessionStorage.removeItem(acceptedPlanKey);
      const pointerKey = acceptedPlanPointerKey('demo', storageManagerId);
      if (pointerKey) window.sessionStorage.removeItem(pointerKey);
      setBundle(null);
      setActiveSubject(null);
      setProjectionVisible(false);
      setScenarioValues({});
      setEvidence(null);
      setHome((current) => ({ ...current, active_subject: null, active_session_id: null }));
      const refreshed = await fetchGuHome();
      setHome(refreshed);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function navigateRoom(nextRoom) {
    setError('');
    if (bundle?.requires_new_consultation) return;
    if (realConsulting && session?.status === 'COMPLETED') { setReviewRoom(nextRoom); return; }
    if (nextRoom === 'HOME' && !realConsulting) { if (acceptedPlanKey) window.sessionStorage.removeItem(acceptedPlanKey); setBundle(null); return; }
    if (!session || busy || nextRoom === room) return;
    try { const payload = await mutateGu('CHANGE_ROOM', { session_id: session.session_id, room: nextRoom, expected_revision: session.revision }); setBundle((current) => ({ ...current, session: payload.session })); setProjectionVisible(Boolean(payload.session.current_projection?.room === nextRoom)); }
    catch (failure) { setError(failure.message); }
  }
  async function startAnotherConsultation() {
    if (!realConsulting || (!bundle?.requires_new_consultation && session?.status !== 'COMPLETED') || busy || newConsultationLocked.current) return;
    newConsultationLocked.current = true;
    setBusy(true); setError('');
    try {
      const opened = await mutateGu('START_ANOTHER_CONSULTATION', { session_id: session.session_id, expected_revision: session.revision });
      setBundle(opened); setReviewRoom(null); setProjectionVisible(false); setScenarioValues({}); setEvidence(null); setPreviousPlansVisible(false);
    } catch (failure) { setError(failure.message); }
    finally { newConsultationLocked.current = false; setBusy(false); }
  }
  async function submit(message, actor = 'MANAGER') {
    if (!session || busy) return;
    setBusy(true); setError(''); beginProgress();
    try {
      const payload = await mutateGu('CHAT', { session_id: session.session_id, message, actor, expected_revision: session.revision });
      setBundle((current) => ({ ...current, ...payload }));
      setProjectionVisible(Boolean(payload.session.current_projection?.published_at_revision === payload.session.revision));
      if (payload.visual_requested) {
        setProgress('Turning that coaching thought into a useful visual…');
        try {
          const compiled = await mutateGu('COMPILE_GU', {
            session_id: session.session_id,
            expected_revision: payload.session.revision,
            coach_move_id: payload.coach_move_id,
          });
          setBundle((current) => ({ ...current, ...compiled }));
          setProjectionVisible(true);
        } catch (visualFailure) {
          setError(`The coaching thought is ready. Optional visual unavailable: ${visualFailure.message}`);
        }
      } else if (payload.projection_deferred === true) {
        setProjectionVisible(false);
      } else {
        setProjectionVisible(true);
      }
    }
    catch (failure) { setError(failure.message); }
    finally { clearInterval(progressTimer.current); setBusy(false); }
  }
  async function scenarioApply(values) {
    if (!session || busy) return;
    setBusy(true); setError(''); beginProgress();
    try {
      const changed = await mutateGu('SCENARIO_CHANGE', { session_id: session.session_id, values, expected_revision: session.revision });
      const planned = await mutateGu('CHAT', { session_id: session.session_id, message: `Show us what these changed assumptions materially change—and what they still do not prove: ${JSON.stringify(values)}`, actor: 'MANAGER', expected_revision: changed.session.revision });
      setBundle((current) => ({ ...current, ...planned })); setProjectionVisible(true);
    } catch (failure) { setError(failure.message); }
    finally { clearInterval(progressTimer.current); setBusy(false); }
  }
  async function planDecision(decision) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const payload = await mutateGu('PLAN_DECISION', { session_id: session.session_id, decision, expected_revision: session.revision });
      if (decision === 'YES' && payload.session?.accepted_plan_snapshot && acceptedPlanKey) {
        const saved = payload.session;
        window.sessionStorage.setItem(acceptedPlanKey, JSON.stringify({ mode: realConsulting ? 'real' : 'demo', subjectId: storageSubjectId, sessionId: saved.session_id, managerId: saved.manager_binding.subject_id, profileId: saved.subject_binding.profile_id, candidateId: saved.subject_binding.candidate_id || null }));
        if (!realConsulting) window.sessionStorage.setItem(acceptedPlanPointerKey('demo', storageManagerId), activeSubject);
      }
      setBundle((current) => ({ ...current, session: payload.session }));
    }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function secondOffer(decision) {
    if (busy) return;
    setBusy(true); setError('');
    try { const payload = await mutateGu('SECOND_OFFER_DECISION', { session_id: session.session_id, decision, expected_revision: session.revision }); setBundle((current) => ({ ...current, session: payload.session })); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  const projectionProps = useMemo(() => ({
    scenarioValues,
    onScenarioChange: (id, value) => setScenarioValues((current) => ({ ...current, [id]: value })),
    onScenarioApply: scenarioApply,
    onEvidence: setEvidence,
    onHypothesis: (item, disposition) => submit(`${disposition === 'ACCEPT' ? 'That fits' : disposition === 'CONTEST' ? 'I am not sure that is right' : 'That is not it'}: ${item.statement}`, 'INVITEE'),
    onClose: () => setProjectionVisible(false),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [scenarioValues, session?.revision, busy]);

  if (approvalToken) return <ApprovalPage token={approvalToken} />;
  if (!home) return <main className="gu-loading"><MoreMark real={realConsulting} /><h1>{error || (realConsulting ? 'Opening Consulting Tool…' : 'Opening Consulting Demonstration…')}</h1></main>;
  return <div className="recruiting-gu-v1" data-real-consulting={realConsulting ? 'true' : 'false'} data-room={room} data-synthetic={session?.synthetic_only ? 'true' : 'false'}>
    <AppHeader room={room} manager={manager} synthetic={home.synthetic_only} onRoom={navigateRoom} real={realConsulting} navigationDisabled={bundle?.requires_new_consultation} />
    {realConsulting && <section className="gu-selected-person" aria-label="Selected consultation"><div><small>CONSULTING WITH</small><strong>{session?.subject_binding?.name || (busy ? 'Opening selected person…' : 'No person selected')}</strong></div><nav>{Boolean(bundle?.previous_accepted_plans?.length) && <button type="button" onClick={() => setPreviousPlansVisible(true)}>Previous agreed plans ({bundle.previous_accepted_plans.length})</button>}{(session?.status === 'COMPLETED' || bundle?.requires_new_consultation) && <button type="button" disabled={busy} onClick={startAnotherConsultation}>Start another consultation</button>}<button type="button" onClick={() => window.location.assign(home.manager?.capabilities?.master_control ? '/recruiting/invite' : '/recruiting/consulting')}>← Back to My Recruits</button></nav></section>}
    {error && room === 'HOME' && <p className="gu-chat__error" role="alert">{error}</p>}
    <SubjectTabs subjects={home.experiment_subjects} activeSubject={activeSubject} busy={busy} onSubject={openSubject} onReset={resetSelectedSubject} />
    {bundle?.requires_new_consultation ? <ArchivedConsultation bundle={bundle} /> : room === 'HOME' ? <Home data={home} real={realConsulting} onPlan={() => navigateRoom('PLAN')} selected={session?.subject_binding ? { name: session.subject_binding.name } : null} onContinue={() => navigateRoom('YOU')} onOpenCandidate={openCandidate} onOpenRelationship={openRelationship} onDemo={openDemo} onMoreId={(profileId) => mutateGu('REQUEST_MORE_ID', { profile_id: profileId })} /> : <>
      <div className="gu-room-layout">
        {room === 'YOU' || room === 'YOUR_BUSINESS' ? <AuthoredRoom room={room} surfaces={bundle.authored_surfaces} projection={projection} showProjection={showProjection} projectionProps={projectionProps} /> : <PlanRoom session={session} real={realConsulting} busy={busy} onDecision={planDecision} onSecondOffer={secondOffer} />}
        <ConversationRail room={room} session={session} busy={busy} readOnly={realConsulting && session.status === 'COMPLETED'} progress={progress} error={error} onSubmit={submit} onSuggestion={(question) => submit(question, 'MANAGER')} />
      </div>
      <p className="gu-boundary">{realConsulting ? 'BOS and BA are read through the accepted relationship. Shared PLAN decisions are recorded in this consultation; agreed-plan email status is shown after acceptance.' : session?.synthetic_only ? 'Synthetic Darren/Jordan demonstration. No Stripe, email, entitlement, reminder, follow-ups, customer, canonical, real-product, or Production mutation.' : 'Patricia demonstration: canonical BOS/BA read only. YOU is BOS-only; YOUR BUSINESS is BOS + BA / Business Twin. No canonical/customer write, email, fulfillment, external action, or Production mutation.'}</p>
      <BottomNav room={room} onRoom={navigateRoom} />
    </>}
    {evidence && <EvidenceDrawer evidence={evidence} onClose={() => setEvidence(null)} />}
    {previousPlansVisible && <PreviousPlansDrawer plans={bundle.previous_accepted_plans} onClose={() => setPreviousPlansVisible(false)} />}
    {busy && room === 'HOME' && <ThinkingProgress stage="Opening the governed consultation…" />}
  </div>;
}
