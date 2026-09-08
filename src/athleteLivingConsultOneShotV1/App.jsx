import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AthleteBosV1App from '../athleteBosV1/App.jsx'
import BusinessTwinApp from '../lab/baProgressiveDisclosureV1/BusinessTwinApp.jsx'
import SubscriptionS2GuRenderer from '../subscriptionS2/SubscriptionS2GuRenderer.jsx'
import { fetchAthleteLivingConsultOneShot, postAthleteLivingConsultOneShot } from './client.js'
import { ATHLETE_LIVING_CONSULT_ROOMS, createPageContextEnvelope } from './contract.js'
import '../recruitingGuV1/recruitingGuV1.css'
import '../components/baProductionReadinessV1/newBaProductionCanary.css'
import '../subscriptionV1/internalDev.css'
import '../athleteApaV1/styles.css'
import './styles.css'

const ROOM_LABELS = Object.freeze({ HOME: 'HOME', YOU: 'YOU', YOUR_SPORT: 'YOUR SPORT', PLAN: 'PLAN' })
const FIXTURE_CHOICES = Object.freeze([
  Object.freeze({ id: 'mika', athlete: 'Mika', instructor: 'Coach Ellis', sport: 'Soccer', difference: 'Communication under pressure · one-cue clarity' }),
  Object.freeze({ id: 'avery', athlete: 'Avery', instructor: 'Coach Navarro', sport: 'Swimming', difference: 'Preparation under pressure · reset after a mistake' }),
])

const safeArray = (value) => Array.isArray(value) ? value : []
const last = (value) => safeArray(value).at(-1)
const identifier = (value) => value?.id || value?.proposal_id || value?.intervention_lineage_id || value?.open_loop_id || ''
const titleCase = (value = '') => String(value).replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/gu, (letter) => letter.toUpperCase())

function customerFieldLabel(field = '', athleteName = 'the athlete') {
  const leaf = String(field).split('.').at(-1)
  return ({
    intervention: 'Shared next step', open_loop_state: 'Current status', due_at: 'Target date',
    observation_window_start: 'Start watching', observation_window_end: 'Finish watching', falsifiers: 'What would make us rethink',
    attempt: `What ${athleteName} tried`, execution_degree: 'How much happened', outcome: 'What happened',
    outcome_classification: 'What the result tells us', confounders: 'What else may have mattered', external_shocks: 'Outside change',
  })[leaf] || titleCase(leaf || 'Shared')
}

function customerFieldValue(item = {}) {
  const field = String(item.field || '')
  const value = item.action || item.commitment || item.value || item.statement || ''
  if (/(?:due_at|observation_window_start|observation_window_end)$/u.test(field)) return shortDate(value)
  if (Array.isArray(value)) return value.join(' · ')
  if (value && typeof value === 'object') return value.display || value.title || value.summary || 'Shared detail'
  return value
}

function rawCustomerFieldValue(item = {}) {
  const value = item.action || item.commitment || item.value || item.statement || ''
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function participantName(relationship, role, fallback) {
  const lower = role.toLowerCase()
  const participant = safeArray(relationship?.participants).find((entry) => String(entry.role || entry.actor_role).toUpperCase() === role)
  return participant?.display_name || participant?.displayName || relationship?.[lower]?.display_name || relationship?.[lower]?.displayName || relationship?.[`${lower}_name`] || fallback
}

function MoreMark() {
  return <div className="gu-brand"><span>M</span><div><strong>MORE <b>/</b> ATHLETE</strong><small>Living Consult · synthetic 18–20</small></div></div>
}

function Header({ room, onRoom, relationship, navigationLocked = false }) {
  const athlete = participantName(relationship, 'ATHLETE', 'Mika')
  const instructor = participantName(relationship, 'INSTRUCTOR', 'Coach Ellis')
  return <header className="gu-header alc-shot-header">
    <MoreMark />
    <nav aria-label="Athlete Living Consult rooms">{ATHLETE_LIVING_CONSULT_ROOMS.map((item) => <button type="button" key={item} className={room === item ? 'active' : ''} aria-current={room === item ? 'page' : undefined} disabled={navigationLocked} onClick={() => onRoom(item)}>{ROOM_LABELS[item]}</button>)}</nav>
    <div className="gu-account"><span className="gu-synthetic-pill">SYNTHETIC · PRIVATE DEMO</span><div><b>{athlete} + {instructor}</b><small>one shared relationship</small></div></div>
  </header>
}

function OrbitGraphic() {
  return <div className="gu-orbit alc-shot-orbit" aria-hidden="true"><i /><i /><span className="gu-orbit__person">A</span><span className="gu-orbit__business">S</span><span className="gu-orbit__chart">↗</span><b>M</b></div>
}

function HomeSurface({ preSession, startAction, session, relationship, fixtureId, onFixture }) {
  const athlete = participantName(relationship, 'ATHLETE', 'Mika')
  const instructor = participantName(relationship, 'INSTRUCTOR', 'Coach Ellis')
  return <main className="gu-home alc-shot-home" data-testid="athlete-consult-home">
    <section className="gu-home__hero"><div><p className="gu-kicker">ATHLETE LIVING CONSULT</p><h1>One relationship.<br />Every useful view.</h1><p>{preSession ? 'Begin when both of you are ready. Opening this workspace alone does not begin a coaching session.' : 'Keep the conversation together while you explore the whole athlete, current sport reality, and what to do next.'}</p></div><OrbitGraphic /></section>
    <p className="gu-kicker gu-start-label">SYNTHETIC 18–20 RELATIONSHIP</p>
    <section className="gu-home-grid alc-shot-home-grid">
      <article className="gu-home-card gu-home-card--green"><span className="gu-home-card__icon">◎</span><h2>{athlete} + {instructor}</h2><p>Move through YOU, YOUR SPORT, and PLAN without starting a new chat or losing what the relationship has learned.</p><div className="alc-shot-home-status"><strong>{preSession ? startAction === 'START_MY_FIRST_SESSION' ? 'First session ready' : 'Next session ready' : 'Session active'}</strong><span>{session?.session_id ? `Session ${String(session.session_id).slice(-8)}` : 'No session started'}</span></div><footer>One continuous relationship <span>›</span></footer></article>
      <article className="gu-home-card gu-home-card--blue"><span className="gu-home-card__icon">◇</span><h2>What stays true</h2><p>Private Athlete material stays private. Shared meaning enters only through explicit permission. MORE can suggest; only the humans can agree.</p><div className="alc-shot-home-status"><strong>Permission before sharing</strong><span>18–20 synthetic scope only</span></div><footer>Truth stays tied to what was actually shared <span>›</span></footer></article>
    </section>
    {preSession && <section className="alc-shot-fixtures" aria-label="Choose a synthetic athlete relationship"><div><p className="gu-kicker">TWO COMPLETE FICTIONAL ATHLETES</p><h2>Choose the relationship you want to review.</h2><p>Each athlete has a different BOS, Athlete map, evidence pattern, shared Plan, and continuing RSL scope.</p></div><nav>{FIXTURE_CHOICES.map((choice) => <button type="button" key={choice.id} className={fixtureId === choice.id ? 'active' : ''} aria-current={fixtureId === choice.id ? 'true' : undefined} onClick={() => onFixture(choice.id)}><strong>{choice.athlete} + {choice.instructor}</strong><span>{choice.sport}</span><small>{choice.difference}</small></button>)}</nav></section>}
    <footer className="gu-trust">▢ &nbsp; Fictional. Protected. No live youth or customer data.</footer>
  </main>
}

function SafeBosUnavailable({ busy, onGrant, athleteName }) {
  return <main className="alc-shot-safe-empty" data-testid="presentation-safe-bos-empty" data-bos-grant-state="NOT_GRANTED"><p className="gu-kicker">YOU · SHARED VIEW</p><h1>YOU is not available in this shared session.</h1><p>No private detail—or even the existence of one—is shown here. {athleteName} can choose whether anything belongs in this view.</p><button type="button" className="alc-shot-primary alc-shot-grant-action" disabled={busy} onClick={onGrant} data-testid="grant-presentation-safe-bos">{athleteName} — check and share what I allow</button></main>
}

function YouSurface({ surface, onContextChange, busy, onGrant, onRevoke, relationship }) {
  const athleteName = participantName(relationship, 'ATHLETE', 'Athlete')
  const athleteRef = safeArray(relationship?.participants).find((entry) => String(entry.role).toUpperCase() === 'ATHLETE')?.actor_ref || ''
  const artifact = surface?.artifact || surface?.presentation_safe_artifact || (surface?.surface_packets ? surface : null)
  if (!artifact) return <SafeBosUnavailable busy={busy} onGrant={onGrant} athleteName={athleteName} />
  return <div className="gu-authored gu-authored--bos alc-shot-authored" data-testid="athlete-consult-you" data-bos-grant-state="ACTIVE"><div className="alc-shot-share-receipt"><div><small>{athleteName.toUpperCase()} SHARED THIS VIEW</small><strong>{athleteName}’s Athlete BOS · read only</strong></div><button type="button" disabled={busy} onClick={onRevoke} data-testid="revoke-presentation-safe-bos">Stop sharing</button></div><div className="gu-authored__canvas"><AthleteBosV1App customerMode artifactOverride={artifact} subjectOverride={{ id: athleteRef, name: athleteName, ageBand: '18–20', sport: artifact?.subject?.sport || '' }} onContextChange={onContextChange} readOnly /></div></div>
}

function SportSurface({ viewModel, onContextChange }) {
  if (!viewModel) return <main className="alc-shot-safe-empty" data-testid="governed-apa-unavailable"><p className="gu-kicker">YOUR SPORT</p><h1>Your Athlete map is unavailable right now.</h1><p>MORE will not fill the gap with a guess or a substitute.</p></main>
  return <div className="gu-authored gu-authored--ba alc-shot-authored" data-testid="athlete-consult-your-sport"><div className="gu-authored__canvas athlete-apa-parity-root new-ba-production-experience"><BusinessTwinApp viewModel={viewModel} onContextChange={onContextChange} /></div></div>
}

function approvalState(proposal, actor) {
  const decisions = safeArray(proposal?.decisions || proposal?.confirmations || proposal?.authority_receipts)
  return decisions.some((item) => String(item.actor || item.role || item.participant).toUpperCase().includes(actor))
}

function revisionItems(proposal, nextStep) {
  const source = safeArray(proposal?.proposed_items || proposal?.items)
  const targetIndex = source.findIndex((item) => String(item.field || '').endsWith('.intervention'))
  if (targetIndex < 0 || !nextStep.trim()) return []
  return source.map((item, index) => index === targetIndex ? { ...item, value: nextStep.trim() } : { ...item })
}

export function JointApproval({ proposal, proposalEdit, busy, onConfirm, onRevise, athleteName = 'Athlete', instructorName = 'Instructor' }) {
  const [revisionOpen, setRevisionOpen] = useState(false)
  const originalIntervention = safeArray(proposal?.proposed_items || proposal?.items).find((item) => String(item.field || '').endsWith('.intervention'))?.value || ''
  const [revisionText, setRevisionText] = useState(originalIntervention)
  if (!proposal) return null
  const athleteApproved = approvalState(proposal, 'ATHLETE') || proposal.athlete_confirmed === true
  const instructorApproved = approvalState(proposal, 'INSTRUCTOR') || proposal.instructor_confirmed === true
  const committed = proposal.status === 'COMMITTED' || proposal.status === 'ACCEPTED' || proposal.committed === true
  const activeEdit = proposalEdit?.proposalId === (proposal.proposal_id || proposal.id) ? proposalEdit : null
  const displayedItems = activeEdit?.items?.length ? activeEdit.items : safeArray(proposal.actions || proposal.proposed_items || proposal.commitments || proposal.items)
  return <section className="alc-shot-joint-approval" aria-label="Athlete and instructor agreement" data-testid="joint-approval" data-proposal-id={proposal.proposal_id || proposal.id || ''} data-proposal-hash={proposal.proposal_hash || ''} data-expected-publication-version={proposal.expected_prior_publication_version || ''}>
    <header><div><p className="gu-kicker">A DECISION FOR BOTH OF YOU</p><h2>{proposal.title || proposal.summary || 'A clear next step to decide together'}</h2></div><span>{committed ? 'AGREED' : 'TWO PEOPLE DECIDE'}</span></header>
    {proposal.summary && proposal.title && <p>{proposal.summary}</p>}
    {activeEdit && <div className="alc-shot-revision-receipt" data-testid="revised-state-bound-proposal"><small>THE SHARED SESSION ASKED FOR A CHANGE</small><strong>This adjusted step is tied to the same unchanged Athlete map.</strong><p>Both people must agree to this exact wording. An earlier yes does not carry over.</p></div>}
    {displayedItems.map((item, index) => <article key={identifier(item) || `${item.field || item.owner}-${index}`} data-field={item.field || ''} data-raw-value={rawCustomerFieldValue(item)}><span>{index + 1}</span><div><small>{item.field ? customerFieldLabel(item.field, athleteName) : titleCase(item.owner || item.actor || 'Shared')}</small><strong>{customerFieldValue(item)}</strong>{(item.due_at || item.dueAt || item.timing) && <p data-raw-date={item.due_at || item.dueAt || item.timing}>{shortDate(item.due_at || item.dueAt || item.timing)}</p>}</div></article>)}
    {!committed && <><div className="alc-shot-human-decisions"><button type="button" disabled={busy || athleteApproved} className={athleteApproved ? 'confirmed' : ''} onClick={() => onConfirm('ATHLETE')}>{athleteApproved ? `${athleteName} agreed` : `${athleteName} — I agree`}</button><button type="button" disabled={busy || instructorApproved} className={instructorApproved ? 'confirmed' : ''} onClick={() => onConfirm('INSTRUCTOR')}>{instructorApproved ? `${instructorName} agreed` : `${instructorName} — I agree`}</button></div>{originalIntervention && <button type="button" className="alc-shot-adjust" disabled={busy} onClick={() => setRevisionOpen((current) => !current)} data-testid="open-proposal-revision">Something changed — adjust before the Plan changes</button>}</>}
    {!committed && revisionOpen && <form className="alc-shot-revision" onSubmit={(event) => { event.preventDefault(); const items = revisionItems(proposal, revisionText); if (items.length) onRevise(items) }}><p className="gu-kicker">REVISE BEFORE THE PLAN CHANGES</p><label><span>Rewrite the shared step to fit what is true now.</span><textarea value={revisionText} onChange={(event) => setRevisionText(event.target.value)} /></label><button type="submit" disabled={busy || !revisionText.trim() || revisionText.trim() === originalIntervention.trim()} data-testid="submit-state-bound-revision">Prepare this revised step for both people</button></form>}
    <footer>{committed ? 'The shared Plan changed only after both explicit decisions.' : 'One yes is not enough. Nothing enters the shared Plan until both people explicitly agree.'}</footer>
  </section>
}

function exactLineageId(bundle) {
  const map = bundle.current_map || bundle.currentMap || {}
  const candidates = [
    bundle.intervention_lineage_id,
    map?.state?.athlete_plan?.intervention_lineage_id,
    map?.athlete_plan?.intervention_lineage_id,
    ...safeArray(bundle.open_loops || bundle.scorecard?.open_loops || bundle.longitudinal?.open_loops).map((item) => item.intervention_lineage_id),
    ...safeArray(bundle.receipts).map((item) => item.intervention_lineage_id),
  ]
  return candidates.find((value) => typeof value === 'string' && value.length > 7) || ''
}

function governedList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String)
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [value.trim()]
  } catch { return [value.trim()] }
}

function shortDate(value) {
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(parsed)
    : String(value)
}

function WhatChanged({ bundle, lineageId }) {
  const interventions = safeArray(bundle.scorecard?.interventions)
  const intervention = interventions.find((item) => item.intervention_lineage_id === lineageId) || interventions.at(-1)
  if (!intervention) return null
  const plan = bundle.current_map?.state?.athlete_plan || {}
  const evidence = bundle.current_map?.state?.athlete_evidence || {}
  const attempts = safeArray(intervention.actually_tried)
  const outcomes = safeArray(intervention.what_happened)
  const reviews = safeArray(intervention.causal_reviews)
  const confounders = governedList(evidence.confounders)
  const externalShocks = governedList(evidence.external_shocks)
  const observation = intervention.observation_window || {}
  const falsifiers = governedList(plan.falsifiers)
  return <section className="alc-shot-what-changed" data-testid="athlete-consult-what-changed" data-intervention-lineage-id={intervention.intervention_lineage_id} data-open-loop-state={intervention.open_loop_state || ''}>
    <header><div><p className="gu-kicker">WHAT CHANGED</p><h2>The agreement and what actually happened stay separate.</h2></div><span>{titleCase(intervention.open_loop_state || 'open')}</span></header>
    <article><small>AGREED</small><strong>{plan.intervention || intervention.decided}</strong>{intervention.original_reason && <p><b>Why you chose it:</b> {intervention.original_reason}</p>}{intervention.agreed_at && <p>{shortDate(intervention.agreed_at)}</p>}</article>
    {attempts.map((attempt, index) => <article key={`${attempt.at || 'attempt'}-${index}`}><small>TRIED · {titleCase(attempt.degree || 'observed')}</small><strong>{attempt.summary}</strong>{attempt.at && <p>{shortDate(attempt.at)}</p>}</article>)}
    {outcomes.map((outcome, index) => <article key={`${outcome.at || 'outcome'}-${index}`}><small>OBSERVED · {titleCase(outcome.classification || 'open')}</small><strong>{outcome.summary}</strong>{outcome.at && <p>{shortDate(outcome.at)}</p>}</article>)}
    {reviews.map((review, index) => <article key={`${review.at || 'review'}-${index}`} data-causal-confidence={review.confidence || ''}><small>WHAT WE CAN SAY ABOUT CAUSE</small><strong>{titleCase(review.attribution_status || 'not yet known')} · {titleCase(review.confidence || 'unassessed')} confidence</strong><p>{titleCase(review.validation_status || 'still open')}</p></article>)}
    {(observation.start || observation.end || intervention.due_at) && <div className="alc-shot-what-changed__facts"><span><small>WATCHING FROM</small><strong>{shortDate(observation.start)}</strong></span><span><small>THROUGH</small><strong>{shortDate(observation.end || intervention.due_at)}</strong></span>{intervention.due_at && <span><small>CHECK-IN DUE</small><strong>{shortDate(intervention.due_at)}</strong></span>}</div>}
    {falsifiers.length > 0 && <div className="alc-shot-what-changed__open"><small>WHAT WOULD MAKE US RETHINK</small>{falsifiers.map((item) => <p key={item}>{item}</p>)}</div>}
    {confounders.length > 0 && <div className="alc-shot-what-changed__open"><small>WHAT ELSE MAY HAVE MATTERED</small>{confounders.map((item) => <p key={item}>{item}</p>)}</div>}
    {externalShocks.length > 0 && <div className="alc-shot-what-changed__open"><small>OUTSIDE CHANGE</small>{externalShocks.map((item) => <p key={item}>{item}</p>)}</div>}
  </section>
}

function PlanSurface({ bundle, proposalEdit, busy, onPropose, onConfirm, onRevise, onRecordAttempt, onRecordOutcome, relationship }) {
  const athleteName = participantName(relationship, 'ATHLETE', 'Athlete')
  const instructorName = participantName(relationship, 'INSTRUCTOR', 'Instructor')
  const proposal = bundle.pending_proposal || bundle.proposal || last(bundle.proposals)
  const plan = bundle.shared_plan || bundle.current_map?.state?.athlete_plan || bundle.current_map?.plan || bundle.view_model?.destinations?.plan
  const openLoops = safeArray(bundle.open_loops || bundle.scorecard?.open_loops || bundle.longitudinal?.open_loops)
  const lineageId = exactLineageId(bundle)
  const attempted = safeArray(bundle.attempts || bundle.scorecard?.attempts || bundle.longitudinal?.attempts).some((item) => item.intervention_lineage_id === lineageId) || openLoops.some((item) => item.intervention_lineage_id === lineageId && ['ATTEMPTED', 'COMPLETED'].includes(String(item.status || item.state).toUpperCase()))
  return <main className="gu-plan alc-shot-plan" data-testid="athlete-consult-plan"><p className="gu-kicker">PLAN TOGETHER</p><h1>Choose the next useful step—together.</h1><i /><p>MORE can help shape a clear proposal. {athleteName} and {instructorName} decide whether it becomes part of their shared Athlete Plan.</p>
    {proposal ? <JointApproval key={proposal.proposal_id || proposal.id} proposal={proposal} proposalEdit={proposalEdit} busy={busy} onConfirm={onConfirm} onRevise={onRevise} athleteName={athleteName} instructorName={instructorName} /> : <section className="gu-plan__start"><span>◯</span><strong>Nothing has been agreed yet.</strong><p>Talk through what matters in the same conversation. When a bounded next step is ready, prepare it for both people to decide.</p><button type="button" className="alc-shot-primary" disabled={busy} onClick={onPropose}>Prepare a shared next step</button></section>}
    {plan && <section className="alc-shot-plan-summary"><p className="gu-kicker">CURRENT SHARED PLAN</p><h2>{plan.title || plan.goal?.display || plan.goal || plan.intervention || 'The current Athlete direction'}</h2><p>{plan.summary || plan.direction || plan.copy || (plan.open_loop_state ? `Current status: ${titleCase(plan.open_loop_state)}.` : 'The shared Plan remains tied to explicit agreement and what actually happens next.')}</p></section>}
    <WhatChanged bundle={bundle} lineageId={lineageId} />
    {lineageId && <section className="alc-shot-proof-controls" data-testid="synthetic-lineage-controls" data-intervention-lineage-id={lineageId}><div><p className="gu-kicker">SYNTHETIC FOLLOW-UP</p><h2>Show what happened next—without rewriting the agreement.</h2><p>These synthetic demo controls keep the attempt and result tied to this exact shared step. They do not guess from dates or change the Athlete BOS or APA.</p>{bundle.pending_proposal && <small>Finish the shared decision above before recording another event.</small>}</div><nav><button type="button" disabled={busy || Boolean(bundle.pending_proposal) || attempted} onClick={() => onRecordAttempt(lineageId)} data-testid="record-synthetic-attempt">{attempted ? 'Attempt recorded' : 'Record synthetic attempt'}</button><button type="button" disabled={busy || Boolean(bundle.pending_proposal) || !attempted} onClick={() => onRecordOutcome(lineageId)} data-testid="record-synthetic-outcome">Record synthetic outcome</button></nav></section>}
  </main>
}

function InlineCoachText({ text }) {
  return String(text).split(/(\*\*[^*]+\*\*)/gu).map((part, index) => part.startsWith('**') && part.endsWith('**') ? <strong key={`${index}-${part.slice(0, 12)}`}>{part.slice(2, -2)}</strong> : <React.Fragment key={`${index}-${part.slice(0, 12)}`}>{part}</React.Fragment>)
}

function MessageBody({ content }) {
  return <div className="living-message-body">{String(content || '').split('\n').map((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) return <span key={`space-${index}`} className="living-message-space" aria-hidden="true" />
    if (/^[-*]\s/u.test(trimmed)) return <p key={`bullet-${index}`} className="living-message-bullet"><span aria-hidden="true">•</span><span className="living-message-list-copy"><InlineCoachText text={trimmed.replace(/^[-*]\s/u, '')} /></span></p>
    const numbered = trimmed.match(/^(\d+)\.\s(.+)$/u)
    if (numbered) return <p key={`number-${index}`} className="living-message-number"><span>{numbered[1]}.</span><span className="living-message-list-copy"><InlineCoachText text={numbered[2]} /></span></p>
    return <p key={`line-${index}`}><InlineCoachText text={trimmed} /></p>
  })}</div>
}

function normalizedMessage(message, index) {
  const rawRole = String(message.role || message.actor || message.type || 'system').toLowerCase()
  const role = rawRole === 'more' ? 'coach' : rawRole === 'manager' ? 'instructor' : rawRole === 'invitee' ? 'athlete' : rawRole
  return { ...message, role, content: message.content || message.text || message.customer_message || '', key: message.turn_id || message.event_id || `${role}-${index}` }
}

export function OneConversationRail({ preSession, session, relationship, timeline, startAction, busy, contextBusy = false, postResponseBusy, error, closePending, onStart, onSend, onEnd, onCloseTogether }) {
  const athleteName = participantName(relationship, 'ATHLETE', 'Athlete')
  const instructorName = participantName(relationship, 'INSTRUCTOR', 'Instructor')
  const [draft, setDraft] = useState('')
  const [closeAlignment, setCloseAlignment] = useState('')
  const submitLock = useRef(false)
  const threadRef = useRef(null)
  const railInstanceRef = useRef(globalThis.crypto?.randomUUID?.() || `rail-${Date.now()}`)
  const messages = useMemo(() => safeArray(timeline).map(normalizedMessage), [timeline])
  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' }) }, [busy, messages.length])
  useEffect(() => { if (!closePending) setCloseAlignment('') }, [closePending])

  async function submit(event) {
    event.preventDefault()
    const message = draft.trim()
    if (!message || preSession || busy || contextBusy || submitLock.current) return
    submitLock.current = true
    setDraft('')
    try { await onSend(message) } finally { submitLock.current = false }
  }

  function handleKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent?.isComposing) return
    event.preventDefault()
    if (!draft.trim() || preSession || busy || contextBusy || submitLock.current) return
    event.currentTarget.form?.requestSubmit()
  }

  return <aside className="gu-chat alc-shot-chat" aria-label="One continuous MORE conversation" data-testid="one-chat-rail" data-rail-instance={railInstanceRef.current} data-session-id={session?.session_id || session?.id || ''} data-relationship-id={relationship?.athlete_relationship_id || relationship?.relationship_id || relationship?.id || ''} data-rsl-scope-hash={relationship?.rsl_scope_hash || relationship?.scope_hash || ''}>
    <header><span>MORE CONVERSATION</span><small>{preSession ? 'READY WHEN YOU ARE' : 'ONE CONTINUOUS SESSION'}</small></header>
    <div className="gu-chat__thread" ref={threadRef} aria-live="polite"><span className="gu-chat__m">M</span>
      {messages.map((message) => message.role === 'gu' && message.plan ? <SubscriptionS2GuRenderer key={message.key} plan={message.plan} /> : <article key={message.key} className={`gu-turn gu-turn--${message.role}`}><small>{message.role === 'coach' ? 'MORE' : message.role === 'athlete' ? athleteName.toUpperCase() : message.role === 'instructor' ? instructorName.toUpperCase() : 'SHARED SESSION'}</small>{message.role === 'coach' ? <MessageBody content={message.content} /> : <p>{message.content}</p>}</article>)}
      {closePending && <section className="alc-shot-close-card" data-testid="mutual-close-ready"><small>END THIS SESSION TOGETHER</small><h3>{closePending.summary || closePending.customer_message || 'You have reached a clear place to pause.'}</h3><p>Say what feels right—or correct what MORE missed. This becomes the human alignment for closing, not an automatic agreement.</p><textarea aria-label="What should this relationship carry forward?" value={closeAlignment} disabled={busy || contextBusy} onChange={(event) => setCloseAlignment(event.target.value)} placeholder="What do the two of you agree should carry forward?" /><button type="button" disabled={busy || contextBusy || !closeAlignment.trim()} onClick={() => onCloseTogether(closeAlignment.trim())}>{athleteName} + {instructorName} — close with this understanding</button></section>}
      {error && <p className="gu-chat__error" role="alert">{error}</p>}
      {busy && <div className="gu-thinking" role="status"><span className="gu-thinking__mark">M</span><div><strong>{postResponseBusy ? 'Keeping only what the two of you actually said…' : 'Thinking about what matters now…'}</strong><p>I’m staying with your whole conversation.</p></div><i /></div>}
    </div>
    <div className="gu-chat__bottom">{preSession ? <section className="alc-shot-start" aria-label={startAction === 'START_MY_FIRST_SESSION' ? 'Start my first session' : 'Start session'}><span>✦</span><h2>{startAction === 'START_MY_FIRST_SESSION' ? 'Your shared coaching relationship is ready.' : 'Ready to continue together.'}</h2><p>Starting opens this coaching session. Moving between rooms keeps the same conversation and relationship.</p><button type="button" disabled={busy} onClick={onStart}>{startAction === 'START_MY_FIRST_SESSION' ? 'START MY FIRST SESSION' : 'START SESSION'}</button></section> : <>
        <form onSubmit={submit}><textarea aria-label="Message MORE" disabled={contextBusy} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} placeholder={contextBusy ? 'Opening this view…' : 'Ask, notice, disagree, or say what changed…'} /><div><span>{contextBusy ? 'Opening this view before the next turn…' : 'Talk naturally · Enter to send · Shift+Enter for a new line'}</span><button type="submit" className="gu-send" aria-label="Send message" disabled={!draft.trim() || busy || contextBusy}>↑</button></div></form>
        <button type="button" className="alc-shot-end" disabled={busy || contextBusy || session?.coaching_episode_phase === 'ENDING'} onClick={onEnd}>{session?.coaching_episode_phase === 'ENDING' ? 'Closing together…' : 'END SESSION'}</button>
      </>}</div>
  </aside>
}

function BottomNav({ room, onRoom, navigationLocked = false }) {
  const index = ATHLETE_LIVING_CONSULT_ROOMS.indexOf(room)
  return <nav className="gu-bottom-nav" aria-label="Move between Athlete Living Consult rooms">{index > 0 && <button type="button" disabled={navigationLocked} onClick={() => onRoom(ATHLETE_LIVING_CONSULT_ROOMS[index - 1])}>← <span>Back</span></button>}{index < ATHLETE_LIVING_CONSULT_ROOMS.length - 1 && <button type="button" disabled={navigationLocked} className="gu-bottom-nav__next" onClick={() => onRoom(ATHLETE_LIVING_CONSULT_ROOMS[index + 1])}><span>Next</span> →</button>}</nav>
}

function contextFromPayload(payload, fallback) {
  return payload.page_context || payload.pageContext || payload.session?.page_context || fallback
}

function conversationFromPayload(payload) {
  return payload.timeline || payload.conversation || payload.session?.conversation || []
}

function relationshipFromPayload(payload) {
  return payload.relationship || payload.session?.relationship || payload.relationship_projection || null
}

function surfaceFrom(bundle, key) {
  return bundle?.surfaces?.[key]
    || bundle?.surface_projection?.surfaces?.[key]
    || bundle?.surface_projection?.projection?.surfaces?.[key]
    || bundle?.projection?.surfaces?.[key]
    || bundle?.authored_surfaces?.[key]
    || bundle?.[`${key}_surface`]
    || null
}

function randomId() {
  return globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function AthleteLivingConsultOneShotV1App() {
  const requestedFixture = new URLSearchParams(window.location.search).get('athlete')
  const [fixtureId, setFixtureId] = useState(FIXTURE_CHOICES.some((entry) => entry.id === requestedFixture) ? requestedFixture : 'mika')
  const [bundle, setBundle] = useState(null)
  const [room, setRoom] = useState('HOME')
  const [timeline, setTimeline] = useState([])
  const [busy, setBusy] = useState(false)
  const [contextBusy, setContextBusy] = useState(false)
  const [postResponseBusy, setPostResponseBusy] = useState(false)
  const [error, setError] = useState('')
  const [mapChangeGu, setMapChangeGu] = useState(null)
  const [closePending, setClosePending] = useState(null)
  const [proposalEdit, setProposalEdit] = useState(null)
  const [pageContext, setPageContext] = useState(createPageContextEnvelope('HOME'))
  const csrfRef = useRef('')
  const authorityRef = useRef({})
  const lastContextSent = useRef('')
  const contextSyncLock = useRef(false)
  const pendingContextRef = useRef(null)
  const stateBindingRef = useRef({ revision: null, stateHash: '', sessionId: '' })
  const stageRef = useRef(null)
  const sportDestinationRef = useRef(null)

  const session = bundle?.session || null
  const relationship = relationshipFromPayload(bundle || {})
  const sessionPhase = session?.coaching_episode_phase || session?.phase || 'IDLE'
  const preSession = !session || session.pre_session_state === true || sessionPhase === 'IDLE'
  const startAction = session?.start_action || bundle?.start_action || 'START_MY_FIRST_SESSION'

  const ingest = useCallback((payload, { replaceTimeline = false, append = [] } = {}) => {
    if (!payload) return
    if (payload.csrf_token) csrfRef.current = payload.csrf_token
    if (payload.authority_capabilities) authorityRef.current = payload.authority_capabilities
    const { csrf_token: _csrf, authority_capabilities: _authority, ...safePayload } = payload
    stateBindingRef.current = {
      revision: payload.revision ?? stateBindingRef.current.revision,
      stateHash: payload.state_hash || payload.session?.state_hash || stateBindingRef.current.stateHash,
      sessionId: payload.session && Object.hasOwn(payload.session, 'session_id')
        ? (payload.session.session_id || '')
        : stateBindingRef.current.sessionId,
    }
    setBundle((current) => ({ ...(current || {}), ...safePayload, surfaces: Object.hasOwn(safePayload, 'surfaces') ? safePayload.surfaces : current?.surfaces }))
    const serverConversation = conversationFromPayload(payload)
    setTimeline((current) => {
      const base = replaceTimeline && serverConversation.length ? serverConversation : current
      const next = [...base, ...append]
      const planId = safePayload.gu_plan?.planId || safePayload.gu_plan?.plan_id
      if (safePayload.gu_plan && !next.some((item) => item.role === 'gu' && (item.plan?.planId || item.plan?.plan_id) === planId && item.plan?.event === safePayload.gu_plan.event)) next.push({ role: 'gu', plan: safePayload.gu_plan, event_id: planId || randomId() })
      return next
    })
    const committedDelta = payload.map_delta?.committed === true || payload.map_delta?.material_change === true || payload.mutation_performed === true || payload.committed_delta
    if (payload.gu_plan?.event === 'MAP_CHANGE' && committedDelta) setMapChangeGu(payload.gu_plan)
    if (payload.close_pending || payload.mutual_close || payload.phase === 'CLOSE_READY') setClosePending(payload.close_pending || payload.mutual_close || payload)
  }, [])

  useEffect(() => {
    let live = true
    fetchAthleteLivingConsultOneShot(fixtureId).then((payload) => {
      if (!live) return
      if (payload.csrf_token) csrfRef.current = payload.csrf_token
      if (payload.authority_capabilities) authorityRef.current = payload.authority_capabilities
      const { csrf_token: _csrf, authority_capabilities: _authority, ...safePayload } = payload
      stateBindingRef.current = { revision: payload.revision ?? null, stateHash: payload.state_hash || payload.session?.state_hash || '', sessionId: payload.session?.session_id || '' }
      setBundle(safePayload)
      setTimeline(conversationFromPayload(payload))
      setPageContext(contextFromPayload(payload, createPageContextEnvelope('HOME')))
    }).catch((failure) => live && setError(failure.message))
    return () => { live = false }
  }, [fixtureId])

  const chooseFixture = useCallback((nextFixture) => {
    if (!FIXTURE_CHOICES.some((entry) => entry.id === nextFixture) || nextFixture === fixtureId || !preSession) return
    setBundle(null)
    setTimeline([])
    setRoom('HOME')
    setError('')
    setMapChangeGu(null)
    setClosePending(null)
    setProposalEdit(null)
    setPageContext(createPageContextEnvelope('HOME'))
    stateBindingRef.current = { revision: null, stateHash: '', sessionId: '' }
    csrfRef.current = ''
    authorityRef.current = {}
    const url = new URL(window.location.href)
    url.searchParams.set('athlete', nextFixture)
    window.history.replaceState({}, '', url)
    setFixtureId(nextFixture)
  }, [fixtureId, preSession])

  useEffect(() => {
    if (mapChangeGu && stageRef.current) stageRef.current.scrollTop = 0
  }, [mapChangeGu])

  const post = useCallback(async (action, payload = {}, options = {}) => {
    const liveBinding = stateBindingRef.current
    const body = {
      action,
      relationship_id: relationship?.relationship_id || relationship?.id,
      session_id: liveBinding.sessionId || session?.session_id,
      expected_revision: liveBinding.revision ?? session?.revision ?? bundle?.revision,
      expected_state_hash: liveBinding.stateHash || session?.state_hash || session?.stateHash || bundle?.state_hash || bundle?.stateHash,
      idempotency_key: options.idempotencyKey || randomId(),
      ...payload,
    }
    try {
      return await postAthleteLivingConsultOneShot({ fixtureId, csrfToken: csrfRef.current, body, onProgress: options.onProgress })
    } catch (failure) {
      if (failure.payload?.csrf_token) {
        csrfRef.current = failure.payload.csrf_token
        if (failure.payload.authority_capabilities) authorityRef.current = failure.payload.authority_capabilities
      }
      try {
        const refreshed = await fetchAthleteLivingConsultOneShot(fixtureId)
        ingest(refreshed, { replaceTimeline: true })
      } catch {
        csrfRef.current = ''
      }
      throw failure
    }
  }, [bundle?.revision, bundle?.stateHash, bundle?.state_hash, fixtureId, ingest, relationship?.id, relationship?.relationship_id, session?.revision, session?.session_id, session?.stateHash, session?.state_hash])

  const syncContext = useCallback(async (nextContext) => {
    const normalized = createPageContextEnvelope(nextContext.room || room, nextContext)
    setPageContext(normalized)
    if (preSession) return
    pendingContextRef.current = normalized
    if (contextSyncLock.current) return
    contextSyncLock.current = true
    setContextBusy(true)
    try {
      while (pendingContextRef.current) {
        const pending = pendingContextRef.current
        pendingContextRef.current = null
        const key = JSON.stringify(pending)
        if (key === lastContextSent.current) continue
        const payload = await post('SET_PAGE_CONTEXT', { room: pending.room, visible_object_ids: pending.visibleObjectIds })
        ingest(payload)
        lastContextSent.current = key
      }
    } catch (failure) {
      pendingContextRef.current = null
      setError(failure.message)
    } finally {
      contextSyncLock.current = false
      setContextBusy(false)
    }
  }, [ingest, post, preSession, room])

  const syncSportContext = useCallback((nextContext) => {
    const destination = nextContext?.destination || 'overview'
    if (destination !== sportDestinationRef.current && stageRef.current) stageRef.current.scrollTop = 0
    sportDestinationRef.current = destination
    return syncContext(nextContext)
  }, [syncContext])

  function navigateRoom(nextRoom) {
    if (busy || contextSyncLock.current || !ATHLETE_LIVING_CONSULT_ROOMS.includes(nextRoom) || nextRoom === room) return
    setRoom(nextRoom)
    void syncContext(createPageContextEnvelope(nextRoom))
  }

  async function startSession() {
    if (busy || !preSession) return
    setBusy(true); setError('')
    try {
      const payload = await post(startAction)
      // Starting mounts the authored YOU surface, whose renderer immediately
      // reports its visible objects. Hold the same context queue lock used by
      // normal navigation so that callback cannot race this first room bind.
      contextSyncLock.current = true
      ingest(payload, { append: payload.customer_message ? [{ role: 'coach', content: payload.customer_message, event_id: randomId() }] : [] })
      setRoom('YOU')
      const next = createPageContextEnvelope('YOU')
      setPageContext(next)
      setContextBusy(true)
      const contextPayload = await post('SET_PAGE_CONTEXT', { room: next.room, visible_object_ids: next.visibleObjectIds })
      ingest(contextPayload)
      lastContextSent.current = JSON.stringify(next)
      while (pendingContextRef.current) {
        const pending = pendingContextRef.current
        pendingContextRef.current = null
        const key = JSON.stringify(pending)
        if (key === lastContextSent.current) continue
        const pendingPayload = await post('SET_PAGE_CONTEXT', { room: pending.room, visible_object_ids: pending.visibleObjectIds })
        ingest(pendingPayload)
        lastContextSent.current = key
      }
    } catch (failure) {
      pendingContextRef.current = null
      setError(failure.message)
    } finally {
      contextSyncLock.current = false
      setContextBusy(false)
      setBusy(false)
    }
  }

  async function sendMessage(message) {
    if (busy || contextSyncLock.current || preSession) return
    const optimisticEventId = randomId()
    const human = { role: 'participant', actor: 'PARTICIPANT', content: message, event_id: optimisticEventId, room }
    setTimeline((current) => [...current, human])
    setBusy(true); setError('')
    let coachDelivered = false
    try {
      const payload = await post('TURN', { message, conversation_capability: authorityRef.current.conversation_capability, page_context: pageContext }, { onProgress: (event) => {
        coachDelivered = true
        ingest(event, { append: event.customer_message ? [{ role: 'coach', content: event.customer_message, event_id: randomId() }] : [] })
        setPostResponseBusy(true)
      } })
      const append = []
      if (!coachDelivered && payload.customer_message) append.push({ role: 'coach', content: payload.customer_message, event_id: randomId() })
      ingest(payload, { append })
    } catch (failure) {
      if (!coachDelivered) setTimeline((current) => current.filter((item) => item.event_id !== optimisticEventId))
      setError(failure.message)
    } finally { setPostResponseBusy(false); setBusy(false) }
  }

  async function endSession() {
    if (busy || contextSyncLock.current || preSession) return
    setBusy(true); setError('')
    try {
      const payload = await post('REQUEST_CLOSE', { page_context: pageContext })
      ingest(payload, { append: payload.customer_message ? [{ role: 'coach', content: payload.customer_message, event_id: randomId() }] : [] })
      setClosePending(payload.close_pending || payload.mutual_close || payload)
    } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }

  async function closeSessionTogether(alignmentMessage) {
    if (busy || contextSyncLock.current || !closePending || !alignmentMessage?.trim()) return
    setBusy(true); setError('')
    try {
      const payload = await post('CLOSE_SESSION', { alignment_message: alignmentMessage.trim() })
      setClosePending(null)
      ingest(payload, { append: payload.customer_message ? [{ role: 'coach', content: payload.customer_message, event_id: randomId() }] : [] })
      setRoom('HOME')
      setPageContext(createPageContextEnvelope('HOME'))
    } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }

  async function setBosGrant(action) {
    if (busy || contextSyncLock.current) return
    setBusy(true); setError('')
    try { ingest(await post(action, { actor_capability: authorityRef.current.athlete_actor_capability })) } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }

  async function proposePlan() {
    if (busy || contextSyncLock.current || preSession) return
    setBusy(true); setError('')
    try { ingest(await post('PROPOSE_PLAN', { page_context: createPageContextEnvelope('PLAN') })) } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }

  async function revisePlan(editedItems) {
    const proposal = bundle.pending_proposal || bundle.proposal || last(bundle.proposals)
    if (!proposal || busy || contextSyncLock.current || preSession) return
    const proposalId = proposal.proposal_id || proposal.id
    const revisedItems = editedItems.map((item) => ({ ...item }))
    setBusy(true); setError('')
    try {
      const payload = await post('REVISE_PROPOSAL', {
        shared_editor_capability: authorityRef.current.shared_editor_capability,
        expected_proposal_id: proposalId,
        expected_proposal_hash: proposal.proposal_hash,
        expected_prior_publication_version: proposal.expected_prior_publication_version,
        expected_prior_publication_hash: proposal.expected_prior_publication_hash,
        proposal_type: proposal.proposal_type,
        summary: proposal.summary || 'The shared next step changed before both people agreed.',
        items: revisedItems,
        reason: 'The shared session supplied new context before the shared Plan changed.',
      })
      ingest(payload)
      const revisedProposal = payload.pending_proposal || payload.proposal
      setProposalEdit(revisedProposal ? { proposalId: revisedProposal.proposal_id || revisedProposal.id, actor: 'PARTICIPANT', items: revisedItems } : null)
    } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }

  async function confirmPlan(actor) {
    const proposal = bundle.pending_proposal || bundle.proposal || last(bundle.proposals)
    if (!proposal || busy || contextSyncLock.current || preSession) return
    const proposalId = proposal.proposal_id || proposal.id
    setBusy(true); setError('')
    try {
      const payload = await post('CONFIRM', {
        actor_capability: actor === 'ATHLETE' ? authorityRef.current.athlete_actor_capability : authorityRef.current.instructor_actor_capability,
        decision: 'CONFIRM',
        edited_items: [],
        proposal_id: proposalId,
        proposal_hash: proposal.proposal_hash,
        expected_prior_publication_version: proposal.expected_prior_publication_version,
        expected_prior_publication_hash: proposal.expected_prior_publication_hash,
      })
      ingest(payload)
      if (payload.mutation_performed || !payload.pending_proposal) setProposalEdit(null)
    } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }

  async function recordAttempt(interventionLineageId) {
    if (!interventionLineageId || busy || preSession) return
    setBusy(true); setError('')
    try {
      ingest(await post('RECORD_ATTEMPT', {
        actor_capability: authorityRef.current.athlete_actor_capability,
        intervention_lineage_id: interventionLineageId,
        summary: `${participantName(relationship, 'ATHLETE', 'The athlete')} completed part of the agreed shared step in two synthetic practice sessions.`,
        execution_degree: 'PARTIAL',
        open_loop_state: 'ATTEMPTED',
      }))
    } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }

  async function recordOutcome(interventionLineageId) {
    if (!interventionLineageId || busy || preSession) return
    setBusy(true); setError('')
    try {
      ingest(await post('RECORD_OUTCOME', {
        actor_capability: authorityRef.current.instructor_actor_capability,
        intervention_lineage_id: interventionLineageId,
        summary: `In the synthetic follow-up, ${participantName(relationship, 'INSTRUCTOR', 'the instructor')} observed a useful difference in two moments; the reason remains uncertain.`,
        outcome_classification: 'INCONCLUSIVE',
        confounders: ['Practice intensity and drill familiarity also changed.'],
        external_shocks: [],
        open_loop_state: 'UNRESOLVED',
      }))
    } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }

  if (!bundle && !error) return <main className="gu-loading"><MoreMark /><h1>Opening the Athlete Living Consult…</h1></main>
  if (!bundle) return <main className="gu-loading"><MoreMark /><h1>This synthetic relationship could not open safely.</h1><p>{error}</p></main>

  const bosSurface = surfaceFrom(bundle, 'bos')
  const apaSurface = surfaceFrom(bundle, 'apa')
  const apaViewModel = apaSurface?.customerViewModel || apaSurface?.view_model || null

  const publication = bundle.current_map || bundle.currentMap || {}
  const rslScopeHash = relationship?.rsl_scope_hash || relationship?.scope_hash || bundle.rsl_scope_hash || ''
  const providerStatus = bundle.boundaries?.frontier_provider_status || 'NOT_CONFIGURED'
  const providerCopy = providerStatus === 'CONFIGURED'
    ? 'Frontier coaching is available in this protected synthetic demo.'
    : 'Coaching turns are off; this is a structural synthetic view.'

  return <div className="recruiting-gu-v1 athlete-living-consult-shot" data-room={room} data-synthetic-only="true" data-session-id={session?.session_id || session?.id || ''} data-session-ordinal={session?.ordinal || 0} data-relationship-id={relationship?.athlete_relationship_id || relationship?.relationship_id || relationship?.id || ''} data-rsl-scope-hash={rslScopeHash} data-state-hash={bundle.state_hash || session?.state_hash || ''} data-publication-version={publication.publication_version || ''} data-publication-hash={publication.publication_hash || ''} data-page-context={JSON.stringify(pageContext)} data-context-sync={contextBusy ? 'PENDING' : 'SETTLED'} data-frontier-provider-status={providerStatus} data-bos-grant-state={bundle.grant?.bos_shared ? 'ACTIVE' : 'NOT_GRANTED'} data-athlete-confirmed={bundle.authority_pending?.athlete_confirmed ? 'true' : 'false'} data-instructor-confirmed={bundle.authority_pending?.instructor_confirmed ? 'true' : 'false'}>
    <Header room={room} onRoom={navigateRoom} relationship={relationship} navigationLocked={busy || contextBusy} />
    <div className="gu-room-layout alc-shot-layout">
      <section className="alc-shot-stage" ref={stageRef}>{room === 'HOME' ? <HomeSurface preSession={preSession} startAction={startAction} session={session} relationship={relationship} fixtureId={fixtureId} onFixture={chooseFixture} /> : room === 'YOU' ? <YouSurface surface={bosSurface} onContextChange={syncContext} busy={busy || contextBusy} onGrant={() => setBosGrant('GRANT_BOS')} onRevoke={() => setBosGrant('REVOKE_BOS')} relationship={relationship} /> : room === 'YOUR_SPORT' ? <SportSurface viewModel={apaViewModel} onContextChange={syncSportContext} /> : <PlanSurface bundle={bundle} proposalEdit={proposalEdit} busy={busy || contextBusy} onPropose={proposePlan} onConfirm={confirmPlan} onRevise={revisePlan} onRecordAttempt={recordAttempt} onRecordOutcome={recordOutcome} relationship={relationship} />}{mapChangeGu && <section className="alc-shot-map-change" data-testid="truthful-map-change-gu" data-committed-delta="true" data-publication-version={publication.publication_version || ''}><button type="button" onClick={() => setMapChangeGu(null)}>Return to the current map</button><p className="gu-kicker">YOUR MAP JUST CHANGED</p><SubscriptionS2GuRenderer plan={mapChangeGu} /></section>}</section>
      <OneConversationRail preSession={preSession} session={session} relationship={relationship} timeline={timeline} startAction={startAction} busy={busy} contextBusy={contextBusy} postResponseBusy={postResponseBusy} error={error} closePending={closePending} onStart={startSession} onSend={sendMessage} onEnd={endSession} onCloseTogether={closeSessionTogether} />
    </div>
    <p className="gu-boundary">Synthetic {participantName(relationship, 'ATHLETE', 'Athlete')} / {participantName(relationship, 'INSTRUCTOR', 'Instructor')} · 18–20 only. {providerCopy} No real youth, customer, payment, messaging, universal learning, or source BOS/APA mutation.</p>
    <BottomNav room={room} onRoom={navigateRoom} navigationLocked={busy || contextBusy} />
  </div>
}
