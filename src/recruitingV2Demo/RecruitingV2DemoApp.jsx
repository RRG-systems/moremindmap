import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createRecruitingV2DemoBaseline,
  createSyntheticReferenceFrontierOutput,
  RECRUITING_V2_DEMO_SEQUENCE,
  transitionRecruitingV2Demo,
} from '../lib/recruitingV2Demo/session.js';
import './recruitingV2Demo.css';

const REVIEW_MODE = import.meta.env.VITE_RECRUITING_V2_SYNTHETIC_REVIEW === 'true';
const REVIEW_STORAGE_KEY = 'more:recruiting-v2:campaign-2g:synthetic-review';
let csrfToken = null;

const CHAPTERS = [
  ['home', 'Home'], ['you-me', 'You + Me'], ['you', 'You'], ['business', 'Your Business'],
  ['gap', 'The Gap'], ['help', 'How We’d Help'], ['plan', 'Our Plan'], ['decision', 'Decision'],
];

const VIEW_CHAPTER = {
  start: 'home', home: 'home', 'you-me': 'you-me', you: 'you', business: 'business',
  'gap-first': 'gap', 'jordan-says': 'gap', noticed: 'gap', 'gap-revised': 'gap',
  help: 'help', plan: 'plan', 'sees-now': 'plan', decision: 'decision', complete: 'decision',
};

function loadReviewState() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(REVIEW_STORAGE_KEY));
    if (parsed?.synthetic_only === true && parsed?.demo_only === true) return parsed;
  } catch { /* a corrupt review copy safely falls back to the frozen baseline */ }
  return createRecruitingV2DemoBaseline();
}

async function remoteRequest(action = null, payload = {}) {
  const response = await fetch('/api/recruiting/v2-demo', {
    method: action ? 'POST' : 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: action ? { 'content-type': 'application/json', 'x-recruiting-v2-demo-csrf': csrfToken || '' } : {},
    body: action ? JSON.stringify({ action, ...payload }) : undefined,
  });
  const body = await response.json().catch(() => ({}));
  if (body.csrf_token) csrfToken = body.csrf_token;
  if (!response.ok || body.ok !== true || !body.session) throw new Error(body.code || 'RECRUITING_V2_DEMO_UNAVAILABLE');
  return body.session;
}

function initials(name) {
  return String(name).split(/\s+/u).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

export default function RecruitingV2DemoApp() {
  const navigate = useNavigate();
  const [state, setState] = useState(() => REVIEW_MODE ? loadReviewState() : null);
  const [status, setStatus] = useState(REVIEW_MODE ? 'ready' : 'loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [resumed, setResumed] = useState(() => REVIEW_MODE && loadReviewState().session_revision > 0);
  const detailReturnFocus = useRef(null);

  useEffect(() => {
    if (REVIEW_MODE) return;
    let active = true;
    remoteRequest().then((session) => {
      if (!active) return;
      setState(session);
      setResumed(session.session_revision > 0);
      setStatus('ready');
    }).catch((failure) => {
      if (!active) return;
      setError(failure.message);
      setStatus('locked');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (REVIEW_MODE && state) sessionStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  async function mutate(action, payload = {}) {
    if (busy) return null;
    setBusy(true);
    setError('');
    try {
      let next;
      if (REVIEW_MODE) {
        const provider = action === 'SUBMIT_MEANING'
          ? async (_request, context) => ({ output: createSyntheticReferenceFrontierOutput(context.new_assertion.text), receipt: { model: 'synthetic-reference-frontier' } })
          : null;
        next = await transitionRecruitingV2Demo(state, action, payload, { provider });
      } else {
        next = await remoteRequest(action, payload);
      }
      setState(next);
      setResumed(false);
      window.scrollTo({ top: 0, behavior: 'auto' });
      return next;
    } catch (failure) {
      setError(humanError(failure.message));
      return null;
    } finally {
      setBusy(false);
    }
  }

  function openDetail(kind) {
    detailReturnFocus.current = document.activeElement;
    setDetail(kind);
  }

  function closeDetail() {
    setDetail(null);
    requestAnimationFrame(() => detailReturnFocus.current?.focus());
  }

  if (status === 'loading') return <StatusScreen title="Opening Darren and Jordan’s shared conversation…" />;
  if (status === 'locked' || !state) {
    return <StatusScreen title="A fresh Leadership demo session is required." copy={error} action="Return to Leadership Portal" onAction={() => navigate('/leadership')} />;
  }

  return (
    <div className="rv2" data-recruiting-v2-demo="true" data-synthetic-only="true" data-chapter={state.chapter}>
      <DemoHeader state={state} onReset={() => mutate('RESET_SESSION')} onExit={() => navigate('/leadership-demo')} busy={busy} />
      <Progress chapter={VIEW_CHAPTER[state.chapter]} />
      {resumed && state.chapter !== 'start' && <div className="rv2-resume" role="status">You’re back where this synthetic conversation left off.</div>}
      {error && <div className="rv2-error" role="alert">{error}</div>}
      <DemoScreen state={state} mutate={mutate} busy={busy} openDetail={openDetail} />
      {detail && <DetailOverlay kind={detail} state={state} onClose={closeDetail} />}
    </div>
  );
}

function DemoHeader({ state, onReset, onExit, busy }) {
  return (
    <header className="rv2-topbar">
      <div className="rv2-brand"><i>✧</i><span>MORE<br />MINDMAP</span></div>
      <div className="rv2-meeting"><strong>Shared business conversation</strong><small>Synthetic Darren + Jordan · first meeting</small></div>
      <div className="rv2-people"><span className="rv2-face d">{initials(state.actors.recruiter.name)}</span><i /><span className="rv2-face j">{initials(state.actors.candidate.name)}</span></div>
      <div className="rv2-header-actions">
        {state.chapter !== 'start' && <button type="button" onClick={onReset} disabled={busy}>Reset Demo</button>}
        <button type="button" onClick={onExit} disabled={busy}>Exit</button>
      </div>
    </header>
  );
}

function Progress({ chapter }) {
  const current = CHAPTERS.findIndex(([id]) => id === chapter);
  return <nav className="rv2-progress" aria-label="Conversation progress">{CHAPTERS.map(([id, label], index) => <span key={id} className={index < current ? 'done' : index === current ? 'current' : ''}><b>{label}</b></span>)}</nav>;
}

function DemoScreen({ state, mutate, busy, openDetail }) {
  switch (state.chapter) {
    case 'start': return <StartScreen onNext={() => mutate('START_SESSION')} busy={busy} />;
    case 'home': return <HomeScreen state={state} onNext={() => mutate('ADVANCE')} busy={busy} />;
    case 'you-me': return <YouMeScreen onNext={() => mutate('ADVANCE')} busy={busy} />;
    case 'you': return <YouScreen state={state} onNext={() => mutate('ADVANCE')} busy={busy} openDetail={openDetail} />;
    case 'business': return <BusinessScreen state={state} onNext={() => mutate('ADVANCE')} busy={busy} openDetail={openDetail} />;
    case 'gap-first': return <GapFirstScreen state={state} onNext={() => mutate('ADVANCE')} busy={busy} />;
    case 'jordan-says': return <JordanMeaningScreen onSubmit={(meaning) => mutate('SUBMIT_MEANING', { meaning })} busy={busy} />;
    case 'noticed': return <NoticedScreen state={state} onNext={() => mutate('ADVANCE')} busy={busy} />;
    case 'gap-revised': return <GapRevisedScreen state={state} onNext={() => mutate('ADVANCE')} busy={busy} openDetail={openDetail} />;
    case 'help': return <HelpScreen state={state} onSubmit={(commitment) => mutate('SAVE_COMMITMENT', { commitment })} onNoHelp={() => mutate('CONTINUE_WITHOUT_HELP')} busy={busy} />;
    case 'plan': return <PlanScreen state={state} onNext={() => mutate('ADVANCE')} busy={busy} />;
    case 'sees-now': return <SeesNowScreen state={state} onNext={() => mutate('ADVANCE')} busy={busy} />;
    case 'decision': return <DecisionScreen onSubmit={(choice, rationale) => mutate('SAVE_DECISION', { choice, rationale })} busy={busy} />;
    case 'complete': return <CompleteScreen state={state} />;
    default: return null;
  }
}

function Frame({ eyebrow, title, lead, tone = '', children, footer }) {
  return <><main className="rv2-stage"><section className="rv2-frame"><div className={`rv2-chapter ${tone}`}>{eyebrow}</div><h1>{title}</h1>{lead && <p className="rv2-lead">{lead}</p>}{children}</section></main>{footer}</>;
}

function Forward({ label, cue, onClick, busy, disabled = false }) {
  return <footer className="rv2-forward"><div><p><strong>{cue || 'Talk together, then move forward.'}</strong>MORE keeps the structure underneath.</p><button type="button" className="rv2-primary" onClick={onClick} disabled={busy || disabled}>{busy ? 'One moment…' : label}</button></div></footer>;
}

function StartScreen({ onNext, busy }) {
  return <Frame eyebrow="READY WHEN YOU ARE" title={<>Sit down with the person.<br />Start here.</>} lead="MORE will guide one conversation. You do not need to learn the software." footer={<Forward label="Start session" cue="No setup. No instructions." onClick={onNext} busy={busy} />}><div className="rv2-orientation">{CHAPTERS.map(([id, label], index) => <div key={id}><b>{String(index + 1).padStart(2, '0')}</b><span>{label}</span></div>)}</div><div className="rv2-human-cue">Put the screen where both people can see it.</div></Frame>;
}

function HomeScreen({ state, onNext, busy }) {
  return <Frame eyebrow="01 · HOME" title="Everything is ready for one useful conversation." lead="You will learn what matters to Jordan, look at the business together, and decide honestly whether working together makes sense." footer={<Forward label="Continue" onClick={onNext} busy={busy} />}><div className="rv2-ready"><div><b>{state.actors.recruiter.name}</b><small>Local leader · here to listen and explain what he can genuinely support</small></div><div><b>{state.actors.candidate.name}</b><small>Business owner · here to test whether the opportunity fits what matters</small></div></div><div className="rv2-human-cue">Darren, begin by asking Jordan what would make this conversation worthwhile.</div></Frame>;
}

function YouMeScreen({ onNext, busy }) {
  return <Frame eyebrow="02 · YOU + ME" tone="violet" title={<>Darren moves fast.<br />Jordan trusts decisions he can see.</>} lead="That can work well if Darren makes the reasoning visible and leaves Jordan room to question it." footer={<Forward label="Continue" onClick={onNext} busy={busy} />}><div className="rv2-bridge"><div className="rv2-portrait"><strong>Darren</strong><p>Names the point quickly and keeps momentum.</p></div><i>↔</i><div className="rv2-portrait"><strong>Jordan</strong><p>Looks for proof, sequence, and a safe way to test the idea.</p></div></div><div className="rv2-human-cue">Talk about where speed helps—and where clarity matters more.</div></Frame>;
}

function YouScreen({ onNext, busy, openDetail }) {
  return <Frame eyebrow="03 · YOU" tone="violet" title="Jordan does his best work when the decision is visible." lead="He is not slow. He protects client trust by seeing the sequence before he commits." footer={<Forward label="Continue" onClick={onNext} busy={busy} />}><div className="rv2-finding"><b>What matters here</b><p>“Show me how the pieces connect, and I can move with confidence.”</p><small>Recognized from Jordan’s synthetic MORE profile.</small></div><div className="rv2-side-action"><button type="button" className="rv2-text-link" onClick={() => openDetail('bos')}>Read Jordan’s full profile</button></div></Frame>;
}

function BusinessScreen({ onNext, busy, openDetail }) {
  return <Frame eyebrow="04 · YOUR BUSINESS" tone="blue" title={<>The business is working.<br />The path to the next chapter is not.</>} lead="Jordan has demand and a strong client experience. Growth becomes risky when too many decisions still depend on him." footer={<Forward label="Continue" cue="Talk about the business—not the screen." onClick={onNext} busy={busy} />}><div className="rv2-today-future"><article><b>TODAY</b><strong>$5.2M</strong><small>Trusted business · owner-centered decisions</small></article><i>→</i><article><b>DESIRED FUTURE</b><strong>$10M</strong><small>Scale without weakening client trust</small></article></div><div className="rv2-question">Jordan, what feels hardest to protect as the business grows?</div><div className="rv2-side-action"><button type="button" className="rv2-text-link" onClick={() => openDetail('ba')}>See the full business view</button></div></Frame>;
}

function GapFirstScreen({ state, onNext, busy }) {
  return <Frame eyebrow="05 · THE GAP" tone="amber" title={<>MORE’s first thought:<br />the business may need more opportunity flow.</>} lead="That is a starting idea, not a conclusion. The people in the room can change it." footer={<Forward label="Let Jordan answer" onClick={onNext} busy={busy} />}><div className="rv2-hypothesis"><b>FIRST THOUGHT</b><p>{state.hypotheses[0].statement}</p><small>Jordan, say whether this sounds true—or what MORE is missing.</small></div></Frame>;
}

function JordanMeaningScreen({ onSubmit, busy }) {
  const [meaning, setMeaning] = useState('The opportunities exist. I don’t trust what I can hand off without hurting the client experience.');
  return <Frame eyebrow="05 · THE GAP" tone="amber" title="Jordan, add what the reports could not know." lead="Speak naturally. MORE will keep the evidence and governance underneath." footer={<Forward label="Continue" cue="Read it together before moving on." onClick={() => onSubmit(meaning)} busy={busy} disabled={meaning.trim().length < 12} />}><div className="rv2-input-wrap"><label htmlFor="jordan-meaning">What is actually getting in the way?</label><textarea id="jordan-meaning" value={meaning} onChange={(event) => setMeaning(event.target.value)} maxLength={2000} /><small>No categories. No scoring. Just Jordan’s meaning in Jordan’s words.</small></div></Frame>;
}

function NoticedScreen({ state, onNext, busy }) {
  return <Frame eyebrow="MORE NOTICED SOMETHING" tone="amber" title={state.hypotheses.at(-1)?.supersession_reason || 'What Jordan just said changes our understanding of the problem.'} lead={state.working_gap.explanation} footer={<Forward label="Continue" onClick={onNext} busy={busy} />}><div className="rv2-noticed-mark">✦</div><div className="rv2-human-cue">Read this together. If it feels wrong, say so.</div></Frame>;
}

function GapRevisedScreen({ state, onNext, busy, openDetail }) {
  const revised = state.working_gap.status === 'WORKING_UNDERSTANDING';
  return <Frame eyebrow="05 · THE GAP" tone="amber" title={state.working_gap.headline} lead={state.working_gap.explanation} footer={<Forward label="Continue" onClick={onNext} busy={busy} />}><div className="rv2-revision"><article className="old"><b>FIRST THOUGHT · {revised ? 'WEAKENED' : 'STILL PROVISIONAL'}</b><p>More opportunity flow</p></article><i>→</i><article className="new"><b>{revised ? 'WORKING UNDERSTANDING' : 'WHAT WE STILL NEED TO LEARN'}</b><p>{state.working_gap.headline}</p></article></div><div className="rv2-side-action"><button type="button" className="rv2-text-link" onClick={() => openDetail('why')}>Why did this change?</button></div></Frame>;
}

function HelpScreen({ state, onSubmit, onNoHelp, busy }) {
  const defaultCommitment = state.help.supported[0]?.statement || '';
  const [commitment, setCommitment] = useState(defaultCommitment);
  const hasSupported = state.help.supported.length > 0;
  return <Frame eyebrow="06 · HOW WE’D HELP" tone="teal" title={hasSupported ? 'Start with the help Darren can actually stand behind.' : 'The evidence has not earned a specific offer yet.'} lead={hasSupported ? 'MORE kept the part that matches the gap and set the unsupported part aside.' : 'Another question is more useful than a premature promise.'} footer={<Forward label={hasSupported ? 'Make this commitment' : 'Continue learning'} onClick={() => hasSupported ? onSubmit(commitment) : onNoHelp()} busy={busy} disabled={hasSupported && commitment.trim().length < 12} />}><div className="rv2-help"><div className="kept"><b>{hasSupported ? 'SUPPORTED NOW' : 'NO SUPPORTED HELP YET'}</b><p>{hasSupported ? state.help.supported[0].statement : 'Ask for one recent example before recommending a move.'}</p></div>{state.help.conditional.map((item) => <div className="conditional" key={item}><strong>Conditional:</strong> {item}</div>)}{state.help.withheld.map((item) => <div className="set-aside" key={item}><strong>Set aside:</strong> {item}</div>)}</div>{hasSupported && <div className="rv2-input-wrap compact"><label htmlFor="darren-commitment">Darren, what will you actually do?</label><textarea id="darren-commitment" value={commitment} onChange={(event) => setCommitment(event.target.value)} maxLength={700} /><small>Say it in your own words. Unsupported promises are rejected.</small></div>}</Frame>;
}

function PlanScreen({ state, onNext, busy }) {
  const plan = state.plan;
  return <Frame eyebrow="07 · OUR PLAN" tone="blue" title="Try one small operating test before making a bigger promise." lead="The plan came from what Darren and Jordan already said. Nothing new needs to be entered." footer={<Forward label="Continue" onClick={onNext} busy={busy} />}><div className="rv2-plan"><div className="plan-title">{plan.name}</div><div className="line"><b>DARREN</b><span>{plan.darren}</span></div><div className="line"><b>JORDAN</b><span>{plan.jordan}</span></div><div className="line"><b>WATCH TOGETHER</b><span>{plan.watch_together}</span></div><div className="line open"><b>STILL OPEN</b><span>{plan.still_open.join(' · ')}</span></div></div></Frame>;
}

function SeesNowScreen({ state, onNext, busy }) {
  const view = state.synthesis;
  return <Frame eyebrow="WHAT MORE SEES NOW" tone="green" title="There is a supported reason to work together—before there is a supported reason to change organizations." lead="The most useful next move is to test whether Darren’s coaching system helps Jordan create decision-safe capacity." footer={<Forward label="Go to decision" cue="Read this together before deciding." onClick={onNext} busy={busy} />}><div className="rv2-sees"><b>WHOLE-SESSION VIEW</b><p>{view.summary}</p><div className="bounds"><div><strong>What matters</strong><small>{view.what_matters}</small></div><div><strong>What looks solvable</strong><small>{view.what_looks_solvable}</small></div><div><strong>What is not a promise</strong><small>{view.not_a_promise}</small></div></div></div></Frame>;
}

function DecisionScreen({ onSubmit, busy }) {
  const [choice, setChoice] = useState('ANOTHER_CONVERSATION');
  const [rationale, setRationale] = useState('I want to see whether the 30-day capacity test makes one handoff feel safe.');
  const choices = [
    ['ANOTHER_CONVERSATION', 'Another conversation makes sense', 'Continue learning together'],
    ['NOT_ENOUGH_YET', 'Not enough yet', 'Pause without pressure'],
    ['NOT_FOR_ME', 'This is not for me', 'Close honestly'],
  ];
  return <Frame eyebrow="08 · DECISION" tone="green" title="Jordan, where are you now—honestly?" lead="Choose the sentence that is closest. There is no preferred answer." footer={<Forward label="Finish" cue="The choice belongs to Jordan." onClick={() => onSubmit(choice, rationale)} busy={busy} />}><div className="rv2-choices">{choices.map(([id, label, copy]) => <button type="button" key={id} className={`rv2-choice ${choice === id ? 'selected' : ''}`} onClick={() => setChoice(id)}>{label}<small>{copy}</small></button>)}</div><div className="rv2-input-wrap decision-note"><label htmlFor="decision-reason">Why?</label><textarea id="decision-reason" value={rationale} onChange={(event) => setRationale(event.target.value)} maxLength={1000} /><small>Jordan’s meaning stays attached to Jordan’s choice.</small></div></Frame>;
}

function CompleteScreen({ state }) {
  const decisionCopy = {
    ANOTHER_CONVERSATION: 'Jordan wants another conversation after the capacity test. The recruiting decision remains open.',
    NOT_ENOUGH_YET: 'Jordan chose to pause. The evidence remains available without pressure.',
    NOT_FOR_ME: 'Jordan closed this path honestly. No follow-up is implied.',
  }[state.decision.choice];
  return <><main className="rv2-stage"><section className="rv2-frame"><div className="rv2-chapter green">MEETING COMPLETE</div><h1>You figured this out together.</h1><p className="rv2-lead">{decisionCopy}</p><div className="rv2-completion"><div className="answer">{state.synthesis.summary}</div><div className="learn"><div><b>WHAT WE KNOW</b><span>Client trust and decision quality are non-negotiable.</span></div><div><b>WHAT WE THINK</b><span>{state.working_gap.headline}</span></div><div><b>WHAT REMAINS OPEN</b><span>{state.plan.still_open.join(' · ')}</span></div><div><b>WHAT WE LEARN NEXT</b><span>{state.learn_next.join(' · ')}</span></div></div></div></section></main><footer className="rv2-forward done"><div>The conversation is complete. Stop here.</div></footer></>;
}

function DetailOverlay({ kind, state, onClose }) {
  const returnButton = useRef(null);
  const bos = state.canonical_references.candidate_bos;
  const ba = state.canonical_references.candidate_ba;
  const active = state.hypotheses.at(-1);
  const content = useMemo(() => ({
    bos: { eyebrow: 'JORDAN’S SYNTHETIC MORE PROFILE', title: 'Jordan’s full profile', summary: bos.summary, items: bos.full_profile, boundary: bos.provenance },
    ba: { eyebrow: 'JORDAN’S SYNTHETIC BUSINESS VIEW', title: 'Business + Five Futures', summary: ba.summary, items: [ba.selected_future, ...ba.five_futures, ...ba.missing.map((item) => `Still missing: ${item}`)], boundary: ba.provenance },
    why: { eyebrow: 'WHY MORE CHANGED ITS MIND · LAYER 02', title: 'The evidence stayed visible underneath.', summary: active?.supersession_reason || state.working_gap.explanation, items: [`Asserted by: Jordan Mitchell`, `Perspective: Jordan`, `Revision: ${state.session_revision}`, `Prior hypothesis: ${state.hypotheses[0].status}`, `Supported help: ${state.help.supported.map((item) => item.statement).join(' · ') || 'None yet'}`, `Uncertainty: ${(state.learn_next || []).join(' · ')}`], boundary: 'Synthetic demonstration only. No real recruiting or customer records are used or changed.' },
  }), [active, ba, bos, state]);
  const selected = content[kind];
  useEffect(() => {
    const dismiss = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', dismiss);
    returnButton.current?.focus();
    return () => document.removeEventListener('keydown', dismiss);
  }, [onClose]);
  return <div className="rv2-overlay" role="dialog" aria-modal="true" aria-labelledby="rv2-detail-title"><section className="rv2-report"><div className="rv2-chapter teal">{selected.eyebrow}</div><h2 id="rv2-detail-title">{selected.title}</h2><p>{selected.summary}</p><div className="rv2-detail-list">{selected.items.map((item) => <div key={item}>{item}</div>)}</div><small>{selected.boundary}</small><button ref={returnButton} type="button" className="rv2-primary" onClick={onClose}>Return to conversation</button></section></div>;
}

function StatusScreen({ title, copy = '', action = '', onAction = null }) {
  return <main className="rv2-status"><div>✧</div><h1>{title}</h1>{copy && <p>{copy}</p>}{action && <button type="button" className="rv2-primary" onClick={onAction}>{action}</button>}</main>;
}

function humanError(code) {
  if (/UNSUPPORTED_COMMITMENT/u.test(code)) return 'That commitment goes beyond what this synthetic evidence supports. Keep it to the weekly opportunity-and-capacity conversation.';
  if (/FRONTIER/u.test(code)) return 'MORE could not safely interpret that meaning yet. Nothing changed; try again.';
  if (/CSRF|CAPABILITY/u.test(code)) return 'This bounded demo session expired. Return to the Leadership Portal for a fresh session.';
  return 'The synthetic conversation could not move forward. Nothing real was changed.';
}

export const RECRUITING_V2_DEMO_UI_SEQUENCE = RECRUITING_V2_DEMO_SEQUENCE;
