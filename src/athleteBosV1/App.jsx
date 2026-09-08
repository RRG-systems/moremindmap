import { useEffect, useMemo, useRef, useState } from 'react';
import { HumanRealizedSurface } from '../components/newBosPersonalityDnaV1/NewBosExperience.jsx';
import { createBosDraftCoordinator, createBosDraftSnapshot } from '../lib/bosIntakeDurability.js';
import {
  EVENT_QUESTION_IDS,
  INTAKE_VERSION,
  MISSINGNESS,
  QUESTIONS,
  optionsFor,
  priorEventChoices,
  wording,
} from '../lib/athleteBosV1/intake.js';
import { ATHLETE_BOS_DESTINATIONS } from '../lib/athleteBosV1/personalityDnaArchitecture.js';
import AthleteSurfaceVisual from './AthleteSurfaceVisual.jsx';
import AthleteWholeMap from './AthleteWholeMap.jsx';
import '../components/newBosPersonalityDnaV1/newBosExperience.css';
import './athlete.css';

const DRAFT_KEY = 'more-athlete-fictional-intake-v1';
const DEFAULT_SUBJECT = Object.freeze({ id: 'synthetic-athlete-nia', name: 'Nia' });
const PARITY_SUBJECT = Object.freeze({ id: 'synthetic-athlete-parity', name: 'Mika' });

const CONFIDENCE_LANGUAGE = Object.freeze({
  direct_account: 'This comes directly from an account shared here.',
  DIRECT_ACCOUNT: 'This comes directly from an account shared here.',
  SUPPORTED: 'The available examples support this reading.',
  SUPPORTED_HYPOTHESIS: 'The available examples support this as a possible reading.',
  TENTATIVE: 'This is a tentative reading, not a settled fact.',
  INSUFFICIENT_EVIDENCE: 'There is not enough here to settle this yet.',
});

function unique(values) {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

function textOf(value) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join(' ');
  if (value && typeof value === 'object') return textOf(value.statement || value.summary || value.description || value.text || value.meaning);
  return '';
}

function customerPacket(packet) {
  const prose = String(packet?.human_realization?.customer_prose || '').replaceAll('\r\n', '\n');
  const lines = prose.split('\n');
  const openingHeading = lines[0]?.match(/^#+\s+(.+)$/u)?.[1]?.trim() || '';
  const displayedHeadline = String(packet?.rendering?.headline || '').trim();
  const withoutRepeatedHeading = openingHeading && (openingHeading === displayedHeadline || openingHeading === String(packet?.label || '').trim())
    ? lines.slice(1).join('\n').trim()
    : prose.trim();
  return {
    ...packet,
    human_realization: {
      ...packet.human_realization,
      customer_prose: withoutRepeatedHeading,
    },
  };
}

function evidenceId(value) {
  return value?.evidence_id || value?.evidenceId || value?.id || '';
}

function evidenceText(value) {
  return textOf(value?.exact_content || value?.exactSpan || value?.content || value?.text || value?.response);
}

function evidenceSource(value) {
  return textOf(value?.source_actor || value?.source_ref || value?.sourceRef || value?.actor || value?.sourceActor || value?.source_class || value?.sourceClass).replaceAll('_', ' ');
}

function SurfaceEvidenceDetail({ packet, artifact, onCorrect }) {
  const truth = packet.resolved_local_truth || {};
  const legacyClaims = Array.isArray(artifact?.plan?.claims) ? artifact.plan.claims : [];
  const claimIds = new Set(packet.claim_refs || packet.claimIds || []);
  const claims = Array.isArray(truth.resolved_claims) && truth.resolved_claims.length > 0
    ? truth.resolved_claims
    : legacyClaims.filter((claim) => claimIds.has(claim.id));
  const evidence = Array.isArray(truth.evidence) && truth.evidence.length > 0
    ? truth.evidence
    : (artifact?.evidence || []).filter((item) => unique(claims.flatMap((claim) => [
      ...(claim.evidence_refs || []),
      ...(claim.evidenceIds || []),
      ...(claim.support || []).map((support) => support.evidenceId || support.evidence_id),
    ])).includes(evidenceId(item)));
  const unknowns = unique([...(truth.abstentions || []), ...(truth.unknowns || []), ...(packet.unknowns || [])].map(textOf));
  const contradictions = Array.isArray(truth.contradictions) ? truth.contradictions : [];
  const citedEvidenceIds = new Set(claims.flatMap((claim) => [
    ...(claim.evidence_refs || []),
    ...(claim.evidenceIds || []),
    ...(claim.support || []).map((support) => support.evidenceId || support.evidence_id),
  ]));
  const additionalEvidence = evidence.filter((item) => !citedEvidenceIds.has(evidenceId(item)));

  return (
    <div className="ab-evidence">
      <p className="ab-evidence-intro">This is a revisable account, not a personality score. One story can help explain several ideas without becoming several separate sources.</p>
      {claims.map((claim) => {
        const supportIds = unique([...(claim.evidence_refs || []), ...(claim.evidenceIds || []), ...(claim.support || []).map((support) => support.evidenceId || support.evidence_id)]);
        const supports = evidence.filter((item) => supportIds.includes(evidenceId(item)));
        return (
          <section key={claim.id || claim.statement}>
            <h3>{claim.statement}</h3>
            <p>{CONFIDENCE_LANGUAGE[claim.confidence] || 'This reading stays open to correction.'}</p>
            {supports.map((item) => <blockquote key={evidenceId(item)}>{item.question_context && <small>{item.question_context}</small>}<p>{evidenceText(item)}</p><cite>{evidenceSource(item) || 'Authorized source'}{item.eventTime || item.event_time ? ` · event date ${item.eventTime || item.event_time}` : ''}</cite></blockquote>)}
            {(claim.alternatives || []).length > 0 && <p><strong>Other possibilities:</strong> {(claim.alternatives || []).join(' ')}</p>}
            {(claim.confounds || []).length > 0 && <p><strong>What else may matter:</strong> {(claim.confounds || []).join(' ')}</p>}
            {(claim.what_would_change_it || claim.whatWouldChangeIt) && <p><strong>What could change this:</strong> {claim.what_would_change_it || claim.whatWouldChangeIt}</p>}
            {onCorrect && artifact?.audience === 'athlete' && claim.id && <button type="button" onClick={(event) => onCorrect(claim, event.currentTarget)}>That’s not quite right</button>}
          </section>
        );
      })}
      {claims.length === 0 && evidence.map((item) => <blockquote key={evidenceId(item)}>{item.question_context && <small>{item.question_context}</small>}<p>{evidenceText(item)}</p><cite>{evidenceSource(item) || 'Authorized source'}</cite></blockquote>)}
      {claims.length > 0 && additionalEvidence.length > 0 && <section className="ab-additional-evidence"><h3>Other answers kept with this reading</h3>{additionalEvidence.map((item) => <blockquote key={evidenceId(item)}>{item.question_context && <small>{item.question_context}</small>}<p>{evidenceText(item)}</p><cite>{evidenceSource(item) || 'Authorized source'}</cite></blockquote>)}</section>}
      {contradictions.map((item, index) => <p key={`difference-${index}`}><strong>{item?.resolved ? 'A difference this reading can hold together:' : 'A difference still open:'}</strong> {textOf(item)}</p>)}
      {unknowns.map((item, index) => <p key={`open-${index}`}><strong>Still open:</strong> {item}</p>)}
      {claims.length === 0 && evidence.length === 0 && unknowns.length === 0 && <p>No additional source detail is available in this view.</p>}
    </div>
  );
}

function Intake({ api, onComplete, onExit }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [ageBand, setAgeBand] = useState('14–17');
  const [assent, setAssent] = useState(false);
  const [assistance, setAssistance] = useState('none');
  const [coPresence, setCoPresence] = useState('none');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const coordinator = useRef(null);
  if (!coordinator.current) coordinator.current = createBosDraftCoordinator({
    storage: { getItem: () => sessionStorage.getItem(DRAFT_KEY), setItem: (_, value) => sessionStorage.setItem(DRAFT_KEY, value), removeItem: () => sessionStorage.removeItem(DRAFT_KEY) },
    endpoint: '/athlete-api/draft',
    fetchImpl: (_, request) => api('draft', JSON.parse(request.body), request.headers['X-BOS-Draft-Token'], true),
  });

  async function restore() {
    setBusy(true);
    try {
      const result = await coordinator.current.restore();
      if (result.ok) {
        const snapshot = result.envelope.snapshot;
        const responses = { ...(snapshot.responses || {}) };
        if (snapshot.metadata?.intakeVersion !== INTAKE_VERSION && responses.C19) {
          const historicalText = String(responses.C19.text || '').trim();
          if (historicalText) responses.C19 = { text: historicalText, status: 'ANSWERED', selected: [] };
          else delete responses.C19;
        }
        setStep(snapshot.step); setAnswers(responses); setAgeBand(snapshot.metadata.ageBand); setAssent(snapshot.metadata.assent); setAssistance(snapshot.metadata.assistance); setCoPresence(snapshot.metadata.coPresence); setMessage('Your saved fictional answers are back.');
      } else setMessage('No saved intake in this browser.');
    } catch { setMessage('Could not restore. Your saved record has not been replaced.'); }
    finally { setBusy(false); }
  }

  function snapshot(nextStep = step) {
    return createBosDraftSnapshot({ phase: 'athlete-synthetic-intake', step: nextStep, metadata: { fictional: true, assent, ageBand, assistance, coPresence, intakeVersion: INTAKE_VERSION }, responses: answers });
  }

  async function save(nextStep = step) {
    if (!assent || busy) return false;
    setBusy(true); setMessage('Saving privately on this computer…');
    try { await coordinator.current.save(snapshot(nextStep)); setStep(nextStep); setMessage('Saved on this computer.'); return true; }
    catch (error) { setMessage(error.code === 'BOS_DRAFT_STALE_REVISION' ? 'A newer saved version exists. Restore it before continuing.' : `Please check this answer. ${String(error.code || error.message).replaceAll('_', ' ').toLowerCase()}.`); return false; }
    finally { setBusy(false); }
  }

  async function finish() {
    if (!(await save())) return;
    setBusy(true);
    try { const envelope = await coordinator.current.flush(); const result = await api('submit-intake', { draftId: envelope.draft_id, token: envelope.resume_token, revision: envelope.revision }); onComplete(result.id); }
    catch { setMessage('Begin with the life-ahead invitation. An unknown, a decline or a pause is a real response. Other questions may remain unasked.'); }
    finally { setBusy(false); }
  }

  const question = QUESTIONS[step];
  const answer = answers[question.id] || { text: '', status: 'ANSWERED', selected: [] };
  const update = (values) => setAnswers((old) => ({ ...old, [question.id]: { ...answer, ...values } }));
  const earlierEvents = priorEventChoices(question.id, answers);
  const allEventChoices = EVENT_QUESTION_IDS.filter((id) => String(answers[id]?.text || '').trim()).map((id) => ({ id, label: String(answers[id].text).trim() }));
  const taskSourceChoices = QUESTIONS.slice(0, 15).map(({ id, title }) => {
    const response = answers[id];
    const label = String(response?.text || '').trim() || (response?.selected || []).join(', ');
    return label && (response?.status || 'ANSWERED') === 'ANSWERED' ? { id, label: `${title}: ${label}` } : null;
  }).filter(Boolean);

  function select(value) {
    let selectedValues = [value];
    if (question.multiple) {
      const exclusive = ['nothing I know of', 'unsure', 'prefer not to say'];
      selectedValues = exclusive.includes(value) ? [value] : answer.selected.includes(value) ? answer.selected.filter((item) => item !== value) : [...answer.selected.filter((item) => !exclusive.includes(item)), value];
    }
    update({ selected: selectedValues, status: 'ANSWERED' });
  }

  function bindEvent(value) {
    if (value === 'new') update({ eventRelation: { kind: 'new' } });
    else {
      const source = earlierEvents.find((item) => item.id === value);
      update({ eventRelation: { kind: 'same', sourceId: source.id, label: source.label } });
    }
  }

  function bindTask(value) {
    if (value === 'new-task') update({ binding: { sourceId: 'new-task', label: answer.binding?.sourceId && answer.binding.sourceId !== 'new-task' ? '' : answer.binding?.label || '' } });
    else {
      const source = taskSourceChoices.find((item) => item.id === value);
      update({ binding: { sourceId: source.id, label: source.label } });
    }
  }

  return (
    <main className="ab-intake">
      <div className="ab-intake-top"><button type="button" onClick={onExit}>← Back to the reading room</button><button type="button" onClick={restore} disabled={busy}>Restore saved intake</button></div>
      <span className="nbos-kicker">A fictional athlete · your story, your pace</span>
      <h1>Let’s understand you.</h1>
      <p>No right answers. Short answers count. You can skip, pause or change your mind.</p>
      <details className="ab-setup" open={!assent}><summary>Before we begin — fictional build only</summary>
        <p>Use invented answers only. This is not a live youth service. No parent, coach or institution receives these answers.</p>
        <label>Age band <select value={ageBand} onChange={(event) => setAgeBand(event.target.value)}><option>14–17</option><option>18–20</option></select></label>
        <label>Input help <select value={assistance} onChange={(event) => setAssistance(event.target.value)}><option value="none">No help</option><option value="dictation">Dictation</option><option value="transcription_only">Someone types my own words</option></select></label>
        <label>Who is present? <select value={coPresence} onChange={(event) => setCoPresence(event.target.value)}><option value="none">No one else</option><option value="fictional_supporter">Fictional supporter</option></select></label>
        <label><input type="checkbox" checked={assent} onChange={(event) => setAssent(event.target.checked)} /> I choose to take part using fictional answers only.</label>
      </details>

      <nav className="ab-question-nav" aria-label="Intake questions">{QUESTIONS.map((item, index) => <button type="button" key={item.id} aria-label={`Question ${index + 1}: ${item.title}`} aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)}><span>{index + 1}</span>{answers[item.id] && <i aria-label="answered" />}</button>)}</nav>
      <section className="ab-question" key={question.id}>
        <span className="nbos-kicker">{step + 1} of 20 · {question.title}</span>
        <h2>{wording(question, ageBand, answers)}</h2>
        {question.helper && <p>{question.helper}</p>}

        {EVENT_QUESTION_IDS.includes(question.id) && earlierEvents.length > 0 && <label className="ab-context-link">Is this a new moment, or one you already described?
          <select value={answer.eventRelation?.kind === 'same' ? answer.eventRelation.sourceId : 'new'} onChange={(event) => bindEvent(event.target.value)}><option value="new">A new moment</option>{earlierEvents.map((item) => <option key={item.id} value={item.id}>The same moment as: {item.label.slice(0, 82)}</option>)}</select>
        </label>}

        {question.id === 'C15' && <label>Choose the moment you mean <select aria-label="Moment being discussed" value={answer.binding?.sourceId || answer.binding?.id || ''} onChange={(event) => { const selectedAnswer = answers[event.target.value]; update({ binding: { sourceId: event.target.value, label: selectedAnswer?.text || '' } }); }}><option value="">Choose a moment, or skip below</option>{allEventChoices.map((item) => <option value={item.id} key={item.id}>{QUESTIONS.find((candidate) => candidate.id === item.id)?.title}: {item.label.slice(0, 80)}</option>)}</select></label>}

        {question.id === 'C16' && <div className="ab-task-binding"><label>Which actual task do you mean?<select aria-label="Task source" value={answer.binding?.sourceId || 'new-task'} onChange={(event) => bindTask(event.target.value)}><option value="new-task">A new task I’ll name here</option>{taskSourceChoices.map((item) => <option key={item.id} value={item.id}>From my earlier answer: {item.label.slice(0, 82)}</option>)}</select></label>{(!answer.binding?.sourceId || answer.binding.sourceId === 'new-task') && <label>Name the actual task <input aria-label="Task being discussed" value={answer.binding?.label || ''} onChange={(event) => update({ binding: { sourceId: 'new-task', label: event.target.value } })} placeholder="Name a real task, or skip below" /></label>}</div>}

        {question.options && <div className="ab-options">{optionsFor(question, answers).map((value) => <button key={value} type="button" aria-pressed={answer.status === 'ANSWERED' && answer.selected.includes(value)} onClick={() => select(value)}>{value}</button>)}</div>}
        {question.id === 'C15' && answer.selected.includes('Something was different') && <fieldset><legend>What was different? Optional.</legend>{question.conditionOptions.map((value) => <label key={value}><input type="checkbox" checked={(answer.conditions || []).includes(value)} onChange={(event) => update({ conditions: event.target.checked ? [...(answer.conditions || []), value] : (answer.conditions || []).filter((item) => item !== value) })} />{value}</label>)}</fieldset>}

        <label className="ab-answer-label">{question.kind === 'narrative' ? 'Your answer' : 'Anything to add or correct? Optional.'}<textarea aria-label="Your answer" rows={question.kind === 'narrative' ? 6 : 3} value={answer.text} onChange={(event) => update({ text: event.target.value, status: 'ANSWERED', ...(EVENT_QUESTION_IDS.includes(question.id) && !answer.eventRelation ? { eventRelation: { kind: 'new' } } : {}) })} placeholder="Your own words. A short answer is enough." /></label>
        <details className="ab-skip"><summary>Not ready to answer?</summary><div className="ab-options">{Object.entries(MISSINGNESS).map(([status, label]) => <button type="button" key={status} aria-pressed={answer.status === status} onClick={() => update({ status, text: '', selected: [] })}>{label}</button>)}</div></details>
        {answer.status !== 'ANSWERED' && <p className="ab-gentle">Saved as: {MISSINGNESS[answer.status]}. No penalty. No missing story will be invented.</p>}
      </section>

      <div className="ab-intake-actions"><button type="button" disabled={busy || !assent} onClick={() => save()}>Save & pause</button>{step > 0 && <button type="button" onClick={() => save(step - 1)} disabled={busy || !assent}>Back</button>}{step < 19 ? <button type="button" className="ab-primary" onClick={() => save(step + 1)} disabled={busy || !assent}>Save & next →</button> : <button type="button" className="ab-primary" onClick={finish} disabled={busy || !assent}>Create this fictional reading →</button>}</div>
      {step < 19 && answers.C01 && <button type="button" className="ab-early-reading" onClick={finish} disabled={busy || !assent}>Read what I’ve shared so far →</button>}
      <p role="status">{message}</p>
    </main>
  );
}

function CorrectionDialog({ claim, value, onChange, onSave, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    function onDocumentKeyDown(event) { if (event.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onDocumentKeyDown);
    return () => document.removeEventListener('keydown', onDocumentKeyDown);
  }, [onClose]);

  function keepFocus(event) {
    if (event.key !== 'Tab') return;
    const controls = [...dialogRef.current.querySelectorAll('button:not([disabled]), textarea, input, select, a[href]')];
    if (controls.length === 0) return;
    const first = controls[0]; const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return (
    <div className="ab-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="correction-title" onKeyDown={keepFocus}>
        <button type="button" className="ab-modal-close" onClick={onClose} aria-label="Close correction">×</button>
        <span className="nbos-kicker">Your voice stays in the record</span>
        <h2 id="correction-title">Help this fit better.</h2>
        <blockquote>{claim.statement}</blockquote>
        <label>Your correction<textarea autoFocus rows={5} value={value} onChange={(event) => onChange(event.target.value)} /></label>
        <p>Your account will be saved privately. It will not erase the earlier source or become proof of someone else’s motives.</p>
        <div className="ab-modal-actions"><button type="button" className="ab-primary" onClick={onSave}>Save my correction</button><button type="button" onClick={onClose}>Not now</button></div>
      </div>
    </div>
  );
}

function athleteDisplayName({ artifact, person, selected }) {
  return artifact?.identity_context?.display_name || artifact?.identity_context?.preferred_name || artifact?.identity?.display_name || artifact?.identity?.displayName || artifact?.subject?.name || person?.name || (selected === PARITY_SUBJECT.id ? PARITY_SUBJECT.name : selected === 'synthetic-athlete-intake' ? 'Lio' : selected === DEFAULT_SUBJECT.id ? DEFAULT_SUBJECT.name : 'Fictional athlete');
}

function legacyPackets(artifact) {
  return Array.isArray(artifact?.chapters) ? artifact.chapters.map((packet) => ({ ...packet, destination: packet.destination || 'recognition' })) : [];
}

export default function App({ customerMode = false, artifactOverride = null, subjectOverride = null, onContextChange = null, readOnly = false }) {
  const [bootstrap, setBootstrap] = useState(artifactOverride ? { subjects: subjectOverride ? [subjectOverride] : [] } : null);
  const [selected, setSelected] = useState(customerMode ? PARITY_SUBJECT.id : DEFAULT_SUBJECT.id);
  const [audience, setAudience] = useState('athlete');
  const [job, setJob] = useState(null);
  const [intake, setIntake] = useState(false);
  const [message, setMessage] = useState('');
  const [correction, setCorrection] = useState(null);
  const [correctionText, setCorrectionText] = useState('');
  const [destinationId, setDestinationId] = useState('recognition');
  const requestLock = useRef(false);
  const customerAutoStart = useRef(false);
  const correctionReturnFocus = useRef(null);
  const appContentRef = useRef(null);

  useEffect(() => {
    if (artifactOverride) return undefined;
    fetch('/athlete-api/bootstrap').then((response) => response.json()).then(setBootstrap).catch(() => setMessage('Local lab unavailable. No remote fallback.'));
    return undefined;
  }, [artifactOverride]);
  useEffect(() => { if (appContentRef.current) appContentRef.current.inert = Boolean(correction); }, [correction]);

  async function api(action, data, draftToken, raw = false) {
    const response = await fetch(`/athlete-api/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Athlete-Lab': bootstrap.capability, ...(draftToken ? { 'X-BOS-Draft-Token': draftToken } : {}) }, body: JSON.stringify(data) });
    if (raw) return response;
    const result = await response.json(); if (!response.ok) throw new Error(result.code || 'LOCAL_REQUEST_FAILED'); return result;
  }

  async function start(id = selected, view = audience) {
    if (requestLock.current || !bootstrap) return;
    requestLock.current = true; setJob(null); setMessage('Opening the exact saved reading, or preparing a new one…'); setSelected(id); setIntake(false); setCorrection(null); setDestinationId('recognition');
    try { const result = await api('generate', { id, audience: view }); setJob({ id: result.jobId, status: 'running', stage: 'Understanding the authorized story' }); setMessage(''); }
    catch { setMessage('This view is not available. No other source or subject was substituted.'); }
    finally { requestLock.current = false; }
  }

  useEffect(() => {
    if (!customerMode || artifactOverride || !bootstrap || customerAutoStart.current) return;
    customerAutoStart.current = true;
    void start(PARITY_SUBJECT.id, 'athlete');
    // The customer surface opens one exact sealed fixture after its local capability arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifactOverride, bootstrap, customerMode]);

  useEffect(() => {
    if (job?.status !== 'running') return undefined;
    let cancelled = false;
    const timer = setInterval(async () => { try { const result = await api('poll', { jobId: job.id }); if (!cancelled) setJob(result); } catch { if (!cancelled) { setJob(null); setMessage('This reading is out of date or no longer allowed. Open the current reading.'); } } }, 1200);
    return () => { cancelled = true; clearInterval(timer); };
    // Poll only the active job; api closes over this host's session capability.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.status]);

  function closeCorrection() { setCorrection(null); setCorrectionText(''); window.requestAnimationFrame(() => correctionReturnFocus.current?.focus()); }

  async function saveCorrection() {
    if (requestLock.current || !correctionText.trim()) return;
    requestLock.current = true;
    try { const result = await api('correct', { jobId: job.id, claimId: correction.id, text: correctionText }); setMessage(result.status); setJob(null); closeCorrection(); }
    catch { setMessage('Could not save this correction. The reading may have changed. Nothing was overwritten.'); }
    finally { requestLock.current = false; }
  }

  function openCorrection(claim, trigger) { correctionReturnFocus.current = trigger; setCorrection(claim); setCorrectionText(''); }
  function chooseDestination(nextId) {
    setDestinationId(nextId);
    if (nextId === 'visual_bos') window.requestAnimationFrame(() => document.querySelector('[data-testid="athlete-whole-map"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  const person = subjectOverride || bootstrap?.subjects?.find((subject) => subject.id === selected);
  const artifact = artifactOverride || job?.artifact || null;
  const displayName = athleteDisplayName({ artifact, person, selected });
  const surfacePackets = useMemo(() => Array.isArray(artifact?.surface_packets) ? artifact.surface_packets : legacyPackets(artifact), [artifact]);
  const packetById = useMemo(() => new Map(surfacePackets.map((packet) => [packet.surface_id, packet])), [surfacePackets]);
  const activeDestination = ATHLETE_BOS_DESTINATIONS.find((destination) => destination.id === destinationId) || ATHLETE_BOS_DESTINATIONS[0];
  const activePackets = activeDestination.surfaceIds.map((surfaceId) => packetById.get(surfaceId)).filter(Boolean);
  const asOf = artifact?.projectionContract?.asOf || artifact?.projection_contract?.as_of || artifact?.createdAt || artifact?.created_at;

  useEffect(() => {
    if (!onContextChange) return;
    onContextChange({
      contract: 'page-context-envelope-v1',
      room: 'YOU',
      destination: destinationId,
      visibleObjectIds: activeDestination.surfaceIds,
      stateHash: artifact?.projectionContract?.stateHash || artifact?.projection_contract?.state_hash || artifact?.stateHash || null,
    });
  }, [activeDestination.surfaceIds, artifact, destinationId, onContextChange]);

  return (
    <div className={`nbos-shell ab-shell${customerMode ? ' is-customer' : ''}`} data-testid="athlete-bos-root" data-subject-id={selected} data-customer-mode={customerMode ? 'true' : 'false'}>
      <div ref={appContentRef}>
        <header className="nbos-topbar"><a href="/" className="nbos-mark" aria-label="MORE Athlete home">MORE<span>/</span>ATHLETE</a><div><span>Personality DNA</span><strong>{customerMode ? 'Fictional preview' : 'Fictional · local only'}</strong></div></header>
        {intake ? <Intake api={api} onComplete={(id) => { setAudience('athlete'); start(id, 'athlete'); }} onExit={() => setIntake(false)} /> : <>
          <section className="nbos-hero ab-hero">
            <div><span className="nbos-kicker">The whole athlete · an unfinished story</span><h1>{displayName}</h1><p>{artifact?.identity_context?.recognition || artifact?.plan?.recognition || 'Your experience deserves more than a label.'}</p>{!customerMode && <small>A synthetic reading for Founder review. Design-frozen intake; not psychometrically validated or approved for live youth use.</small>}</div>
            {!customerMode && <div className="ab-review-controls" aria-label="Synthetic review controls">
              <span>Synthetic review controls</span>
              <label>Fictional athlete<select aria-label="Fictional athlete" value={selected} disabled={job?.status === 'running'} onChange={(event) => { setSelected(event.target.value); setJob(null); setAudience('athlete'); setDestinationId('recognition'); }}>{bootstrap?.subjects?.length ? bootstrap.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name} · {subject.age} · {subject.sport}</option>) : <option value={DEFAULT_SUBJECT.id}>Nia · loading fictional catalog…</option>}{!bootstrap?.subjects?.some((subject) => subject.id === 'synthetic-athlete-intake') && <option value="synthetic-athlete-intake">Lio · saved fictional intake</option>}</select></label>
              {selected === 'synthetic-athlete-mara' && <label>Permission proof<select aria-label="Permission proof" value={audience} onChange={(event) => { setAudience(event.target.value); setJob(null); setDestinationId('recognition'); }}><option value="athlete">Athlete’s private reading</option><option value="coach">Coach’s exact shared object only</option></select></label>}
              <div><button type="button" className="ab-primary" disabled={!bootstrap || job?.status === 'running'} onClick={() => start()}>Open this reading <b aria-hidden="true">→</b></button><button type="button" disabled={!bootstrap || job?.status === 'running'} onClick={() => setIntake(true)}>Try the 20-question intake</button></div>
            </div>}
          </section>

          {message && <p className="ab-message" role="status">{message}</p>}
          {job?.status === 'running' && <section className="ab-progress" role="status"><span className="ab-pulse" /><span className="nbos-kicker">Preparing this reading</span><h2>{job.stage}</h2><p>We’re separating what is known from what is still open. You don’t need to send again. Existing evidence stays intact.</p></section>}
          {job?.status === 'stopped' && <section className="ab-progress" role="alert"><span className="nbos-kicker">Nothing unsafe was substituted</span><h2>This reading needs review.</h2><p>It was not released because a generation or safety check stopped it. No made-up replacement was shown.</p><small>Local evidence receipt: {job.code}</small></section>}

          {artifact && <>
            <p className="ab-asof">Fictional source snapshot · {asOf ? new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'America/Phoenix' }).format(new Date(asOf)) : 'see the dated local evidence receipt'} · not a live youth assessment</p>
            <AthleteWholeMap artifact={artifact} displayName={displayName} />
            <div className="nbos-nav-wrap ab-nav-wrap">
              <nav className="nbos-nav" aria-label="Athlete BOS destinations">{ATHLETE_BOS_DESTINATIONS.map((destination) => <button type="button" key={destination.id} className={destination.id === destinationId ? 'active' : ''} onClick={() => chooseDestination(destination.id)}>{destination.label}{destination.surfaceIds.length > 0 && <small>{destination.surfaceIds.length}</small>}</button>)}</nav>
              <label className="nbos-nav-select"><span>Choose a destination</span><select value={destinationId} onChange={(event) => chooseDestination(event.target.value)}>{ATHLETE_BOS_DESTINATIONS.map((destination) => <option value={destination.id} key={destination.id}>{destination.label}</option>)}</select></label>
            </div>

            {activeDestination.experience !== 'visual_bos' && <section className="nbos-content" aria-live="polite">
              <div className="nbos-section-intro"><span>{activeDestination.label}</span><p>{activePackets.length ? `${activePackets.length} ${activePackets.length === 1 ? 'part' : 'parts'} of this revisable reading` : 'This part of the reading is still open'}</p></div>
              {activePackets.map((packet) => <HumanRealizedSurface
                key={packet.surface_id}
                packet={customerPacket(packet)}
                editorialHeadline={packet.rendering?.headline}
                editorialEyebrow={packet.rendering?.eyebrow || packet.label}
                visualContent={<AthleteSurfaceVisual rendering={packet.rendering} />}
                progressiveProse
                progressiveProseLabel="Read the rest of this part"
                detailLabel="See what this is based on"
                detailContent={<SurfaceEvidenceDetail packet={packet} artifact={artifact} onCorrect={readOnly ? null : openCorrection} />}
              />)}
              {activePackets.length === 0 && <div className="ab-empty-destination"><h2>Still learning.</h2><p>This reading does not have enough authorized evidence to fill this part honestly.</p></div>}
            </section>}
          </>}
        </>}
      </div>

      <footer className="nbos-footer ab-footer">{customerMode ? <><span>Your story stays open to correction.</span><span>Fictional local preview · no live youth data</span></> : <><span>{artifact ? `${surfacePackets.length}/15 reading surfaces · 9 destinations` : 'Athlete BOS V1 · synthetic Founder review'}</span><span>No live youth, customer, coach, guardian, payment or Production connection</span></>}</footer>
      {!readOnly && correction && <CorrectionDialog claim={correction} value={correctionText} onChange={setCorrectionText} onSave={saveCorrection} onClose={closeCorrection} />}
    </div>
  );
}
