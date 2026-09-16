import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import LivingBusinessTwinApp from '../lab/subscriptionLivingBusinessRelationshipV1/LivingBusinessTwinApp.jsx'
import SubscriptionS2GuRenderer from '../subscriptionS2/SubscriptionS2GuRenderer.jsx'
import { prepareBlindDemoRequestProof } from './blindDemoRequestProof.js'
import '../lab/baProgressiveDisclosureV1/styles.css'
import '../lab/subscriptionLivingBusinessRelationshipV1/styles.css'
import './internalDev.css'

const STORAGE_KEY = 'more_subscription_v1_internal_ephemeral_conversation'
const DEMO_SUBJECT = 'synthetic'
const messageStorageKey = (subject) => `${STORAGE_KEY}:${subject}`

function InlineCoachText({ text }) {
  return String(text).split(/(\*\*[^*]+\*\*)/gu).map((part, index) => part.startsWith('**') && part.endsWith('**')
    ? <strong key={`${index}-${part.slice(0, 12)}`}>{part.slice(2, -2)}</strong>
    : <React.Fragment key={`${index}-${part.slice(0, 12)}`}>{part}</React.Fragment>)
}

function CoachMessageBody({ content }) {
  return <div className="living-message-body">{String(content).split('\n').map((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) return <span key={`space-${index}`} className="living-message-space" aria-hidden="true" />
    if (trimmed.startsWith('### ')) return <h4 key={`heading-${index}`}><InlineCoachText text={trimmed.slice(4)} /></h4>
    if (trimmed.startsWith('> ')) return <blockquote key={`quote-${index}`}><InlineCoachText text={trimmed.slice(2)} /></blockquote>
    if (/^[-*]\s/u.test(trimmed)) return <p key={`bullet-${index}`} className="living-message-bullet"><span aria-hidden="true">•</span><span className="living-message-list-copy"><InlineCoachText text={trimmed.replace(/^[-*]\s/u, '')} /></span></p>
    const numbered = trimmed.match(/^(\d+)\.\s(.+)$/u)
    if (numbered) return <p key={`number-${index}`} className="living-message-number"><span>{numbered[1]}.</span><span className="living-message-list-copy"><InlineCoachText text={numbered[2]} /></span></p>
    return <p key={`line-${index}`}><InlineCoachText text={trimmed} /></p>
  })}</div>
}

function ExactUpdateCard({ proposal, busy, onDecision }) {
  const [editing, setEditing] = useState(false)
  const [items, setItems] = useState(() => proposal.proposed_items.map((item) => ({ ...item })))
  return <section className="living-decision" data-confirmation-ux="secondary-fallback" aria-label="Pending Business Twin review" aria-live="polite">
    <p className="living-kicker">MORE noticed something worth keeping</p>
    <h3>{proposal.summary}</h3>
    <p>{proposal.reason}</p>
    <p className="living-decision-natural">Keep talking naturally. You can confirm, change, wait, or reject this exact update in your own words. Nothing changes unless you authorize it.</p>
    <details className="living-decision-fallback"><summary>Review exact update and controls</summary>
      {editing && <div className="living-edit-fields">{items.map((item, index) => <label key={item.field}><span>{item.field.split('.').at(-1).replaceAll('_', ' ')}</span><textarea value={item.value} onChange={(event) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, value: event.target.value } : entry))} /></label>)}</div>}
      <div className="living-decision-actions">
        {editing ? <button type="button" className="confirm" disabled={busy} onClick={() => onDecision('EDIT', items)}>Use these edits</button> : <button type="button" className="confirm" disabled={busy} onClick={() => onDecision('CONFIRM')}>Yes, update my map</button>}
        <button type="button" disabled={busy} onClick={() => setEditing((value) => !value)}>{editing ? 'Cancel edits' : 'Change it'}</button>
        <button type="button" disabled={busy} onClick={() => onDecision('DEFER')}>Not now</button>
        <button type="button" className="quiet" disabled={busy} onClick={() => onDecision('REJECT')}>No, don’t use this</button>
      </div>
    </details>
  </section>
}

function readEphemeralMessages(subject) {
  try {
    const value = JSON.parse(sessionStorage.getItem(messageStorageKey(subject)) || '[]')
    return Array.isArray(value) ? value.slice(-24) : []
  } catch { return [] }
}

async function requestSyntheticQaEntryProof() {
  const response = await fetch('/api/internal/subscription-v1-qa-entry', {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)
  if (!response.ok
    || body?.ok !== true
    || body.code !== 'SUBSCRIPTION_V1_SYNTHETIC_QA_ENTRY_READY'
    || body.synthetic_only !== true
    || body.billing_evidence !== false
    || typeof body.csrf_token !== 'string') return null
  return body.csrf_token
}

function SyntheticQaEntryForm({ initialProof, compact = false, activeSynthetic = false }) {
  const [proof, setProof] = useState(initialProof)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const inputId = compact ? 'subscription-synthetic-qa-switch-profile-id' : 'subscription-synthetic-qa-profile-id'

  async function submit(event) {
    event.preventDefault()
    if (submitting || !proof) return
    const input = event.currentTarget.elements.namedItem('profile_id')
    let profileId = String(input?.value || '').trim()
    if (!profileId) {
      setError('Enter an authorized synthetic MM ID.')
      return
    }
    if (input) input.value = ''
    const requestBody = JSON.stringify({ profile_id: profileId })
    profileId = ''
    const requestProof = proof
    setProof(null)
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/internal/subscription-v1-qa-entry', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          'content-type': 'application/json',
          'x-subscription-qa-entry-csrf': requestProof,
        },
        body: requestBody,
      })
      const body = await response.json().catch(() => null)
      if (response.ok
        && body?.ok === true
        && body.code === 'SUBSCRIPTION_V1_SYNTHETIC_QA_ENTITLEMENT_ISSUED'
        && body.synthetic_only === true
        && body.billing_evidence === false) {
        globalThis.location.reload()
        return
      }
      setError('That MM ID could not open this synthetic QA session. Check the ID and try again.')
    } catch {
      setError('Synthetic QA access is temporarily unavailable. Try again.')
    }
    try { setProof(await requestSyntheticQaEntryProof()) } catch { setProof(null) }
    setSubmitting(false)
  }

  const form = <form className={compact ? 'synthetic-qa-switch-form' : undefined} onSubmit={submit}>
    <label htmlFor={inputId}>MM ID</label>
    <input id={inputId} name="profile_id" type="text" inputMode="text" autoComplete="off" autoCapitalize="none" spellCheck="false" required disabled={submitting || !proof} />
    <button type="submit" disabled={submitting || !proof}>{submitting ? 'OPENING…' : 'OPEN SUBSCRIPTION'}</button>
  </form>

  if (compact) return <details className="synthetic-qa-switch">
    <summary>{activeSynthetic ? 'Switch synthetic QA person' : 'Open synthetic QA person'}</summary>
    <div>
      <p>Enter an authorized synthetic MM ID. Your current relationship remains unchanged.</p>
      {form}
      {error && <p className="synthetic-qa-entry-error" role="alert">{error}</p>}
      <small>Synthetic QA · No paid subscription</small>
    </div>
  </details>

  return <main className="subscription-entry-state synthetic-qa-entry" role="main">
    <span aria-hidden="true">✦</span>
    <p className="synthetic-qa-entry-kicker">SYNTHETIC QA</p>
    <h1>Open a synthetic Subscription person.</h1>
    <p>Enter an authorized synthetic MM ID.</p>
    {form}
    {error && <p className="synthetic-qa-entry-error" role="alert">{error}</p>}
    <small>No paid subscription</small>
  </main>
}

const paidSourceLibraryLabel = (vertical) => ['loan_originator', 'Loan Originator', 'Residential Loan Originator'].includes(String(vertical || '').trim())
  ? 'Loan Originator'
  : 'Real Estate'

function AllowanceBoundary({ session }) {
  return <aside className="living-conversation internal-dev-conversation allowance-boundary" aria-label="Subscription allowance state">
    <header><div><span className="living-presence" aria-hidden="true" /><p>MORE · LIVING RELATIONSHIP</p><h2>Your Business Twin is current.</h2></div><span className="living-state-label">allowance complete</span></header>
    <div className="living-thread">
      <div className="living-blank"><span>✓</span><h3>This month’s substantive coaching sessions are complete.</h3><p>Your governed relationship, Business Twin, Personal RSL, and confirmed changes remain available. The next coaching session opens with the next allowance cycle; no billing or customer state changed here.</p></div>
      <div className="internal-session-boundary"><span>{session.standard_sessions_used} of {session.standard_sessions_per_cycle} substantive sessions used</span><span>{session.standard_sessions_available} available this cycle</span></div>
    </div>
  </aside>
}

function RemoteConversation({ bootstrap, onCurrent, demoSubject, onEntitlementLost, onBusyChange, ephemeralStorageEnabled = true }) {
  const initiallyPreSession = Boolean(bootstrap.session?.pre_session_state)
  const paidConversation = bootstrap.subscriber?.kind === 'PAID_SUBSCRIBER'
  const syntheticQaConversation = bootstrap.subscriber?.kind === 'SYNTHETIC_QA_SUBSCRIBER'
  const durableConversation = paidConversation || syntheticQaConversation
  if (syntheticQaConversation) {
    demoSubject = null
    ephemeralStorageEnabled = false
  }
  const [messages, setMessages] = useState(() => bootstrap.blind_demo || durableConversation
    ? (bootstrap.conversation || [])
    : initiallyPreSession || !ephemeralStorageEnabled ? [] : readEphemeralMessages(demoSubject))
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(bootstrap.pending_proposal || null)
  const [busy, setBusy] = useState(false)
  const [postResponseBusy, setPostResponseBusy] = useState(false)
  const [activeLens, setActiveLens] = useState('OVERVIEW')
  const [csrf, setCsrf] = useState(bootstrap.csrf_token)
  const [session, setSession] = useState(bootstrap.session)
  const [usage, setUsage] = useState(null)
  const [sources, setSources] = useState([])
  const [preSession, setPreSession] = useState(initiallyPreSession)
  const [sessionLearning, setSessionLearning] = useState(bootstrap.session_learning || null)
  const [error, setError] = useState('')
  const endRef = useRef(null)
  const episodeStartedAt = useRef(null)
  const submitLockRef = useRef(false)
  const endSessionLockRef = useRef(false)
  const startSessionLockRef = useRef(false)
  useEffect(() => { onBusyChange?.(busy) }, [busy, onBusyChange])

  useEffect(() => {
    const handler = (event) => setActiveLens(String(event.detail || 'overview').toUpperCase())
    globalThis.addEventListener('ba-pd:destination', handler)
    return () => globalThis.removeEventListener('ba-pd:destination', handler)
  }, [])
  useEffect(() => {
    if (bootstrap.blind_demo || !ephemeralStorageEnabled) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      return
    }
    if (preSession) sessionStorage.removeItem(messageStorageKey(demoSubject))
    else sessionStorage.setItem(messageStorageKey(demoSubject), JSON.stringify(messages.slice(-24)))
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, pending, preSession, demoSubject, bootstrap.blind_demo, ephemeralStorageEnabled])

  function visibleCustomerContext() {
    const visibleBySurface = {
      OVERVIEW: ['Where You Are', 'Five Possible Futures', 'Your One Move', 'Your Plan', 'Evidence'],
      WHERE: ['Current snapshot', 'Today to goal', 'Critical realities', 'The gap'],
      FUTURES: ['Five trajectories', 'Relative support', 'Conditions', 'What would change each path'],
      MOVE: ['Constraint', 'Mechanism', 'Intervention', 'Proof conditions'],
      PLAN: ['Goal', 'Current completed ways', 'Open ways', 'Strategies', 'One Move relationship'],
      EVIDENCE: ['Known', 'Inferred', 'Missing', 'Contradicted', 'What would change the view'],
    }
    return { surface: activeLens.toLowerCase(), visible_objects: visibleBySurface[activeLens] || visibleBySurface.OVERVIEW }
  }

  async function post(body, { onProgress = null } = {}) {
    const progressive = body.action === 'TURN'
    let requestCsrf = csrf
    if (bootstrap.blind_demo) {
      try {
        requestCsrf = await prepareBlindDemoRequestProof({ blind: bootstrap.blind_demo, kind: 'runtime', sessionId: body.session_id || null })
      } catch (failure) {
        if (failure.status === 401 && failure.reentryRequired) onEntitlementLost?.(failure.code)
        throw failure
      }
    }
    const response = await fetch('/api/internal/subscription-v1-runtime', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'content-type': 'application/json', accept: progressive ? 'application/x-ndjson' : 'application/json', 'x-subscription-runtime-csrf': requestCsrf },
      body: JSON.stringify({
        ...body,
        ...(demoSubject ? { subject: demoSubject } : {}),
        ...(bootstrap.blind_demo ? { view_token: bootstrap.blind_demo.view_token } : {}),
      }),
    })
    if (response.headers.get('content-type')?.startsWith('application/x-ndjson')) {
      if (!response.ok || !response.body) throw new Error('SUBSCRIPTION_V1_PROGRESSIVE_RESPONSE_INVALID')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalResult = null
      while (true) {
        const { done, value } = await reader.read()
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.trim()) continue
          const event = JSON.parse(line)
          if (event.csrf_token) setCsrf(event.csrf_token)
          if (event.phase === 'COACHING_READY') onProgress?.(event)
          if (event.ok !== true) {
            const failure = new Error(event.code || 'SUBSCRIPTION_V1_POST_RESPONSE_EXTRACTION_FAILED')
            failure.code = event.code || 'SUBSCRIPTION_V1_POST_RESPONSE_EXTRACTION_FAILED'
            failure.phase = event.phase
            throw failure
          }
          finalResult = event
        }
        if (done) break
      }
      if (buffer.trim()) {
        const event = JSON.parse(buffer)
        if (event.csrf_token) setCsrf(event.csrf_token)
        if (event.phase === 'COACHING_READY') onProgress?.(event)
        if (event.ok !== true) {
          const failure = new Error(event.code || 'SUBSCRIPTION_V1_POST_RESPONSE_EXTRACTION_FAILED')
          failure.code = event.code || 'SUBSCRIPTION_V1_POST_RESPONSE_EXTRACTION_FAILED'
          failure.phase = event.phase
          throw failure
        }
        finalResult = event
      }
      if (!finalResult) throw new Error('SUBSCRIPTION_V1_PROGRESSIVE_RESPONSE_EMPTY')
      return finalResult
    }
    const result = await response.json().catch(() => ({ ok: false, code: 'SUBSCRIPTION_V1_RESPONSE_INVALID' }))
    if (result.csrf_token) setCsrf(result.csrf_token)
    if (!response.ok || result.ok !== true) {
      const failure = new Error(result.code || 'SUBSCRIPTION_V1_REQUEST_FAILED')
      failure.code = result.code || 'SUBSCRIPTION_V1_REQUEST_FAILED'
      failure.status = response.status
      failure.reentryRequired = result.reentry_required === true
      if (failure.status === 401 && failure.reentryRequired) onEntitlementLost?.(failure.code)
      throw failure
    }
    return result
  }

  async function send(event) {
    event?.preventDefault()
    const message = draft.trim()
    if (!message || busy || preSession || submitLockRef.current) return
    submitLockRef.current = true
    if (!episodeStartedAt.current) episodeStartedAt.current = Date.now()
    const history = messages.filter((item) => ['customer', 'coach'].includes(item.role)).slice(-24)
    let coachDelivered = false
    setDraft(''); setBusy(true); setError('')
    setMessages((current) => [...current, { role: 'customer', content: message }])
    try {
      if (session.coaching_episode_phase === 'ENDING') {
        const result = await post({
          action: 'END_SESSION',
          session_id: session.session_id,
          cumulative_active_seconds: episodeStartedAt.current ? Math.floor((Date.now() - episodeStartedAt.current) / 1000) : 0,
          conversation: [...history, { role: 'customer', content: message }],
          alignment_message: message,
          close_request_id: globalThis.crypto.randomUUID(),
          prior_session_learning: sessionLearning,
          visible_customer_context: visibleCustomerContext(),
        })
        if (result.customer_message) setMessages((current) => [...current, { role: 'coach', content: result.customer_message }])
        if (result.gu_plan) setMessages((current) => [...current, { role: 'gu', plan: result.gu_plan }])
        setSessionLearning(result.session_learning || null)
        setUsage(result.usage || null)
        setSession(result.next_pre_session || result.session); setPreSession(Boolean(result.next_pre_session))
        setPending(result.confirmation_required ? result.pending_proposal : null)
        if (result.next_pre_session) episodeStartedAt.current = null
        return
      }
      const result = await post(
        { action: 'TURN', session_id: session.session_id, message, conversation: history, visible_customer_context: visibleCustomerContext() },
        { onProgress: (event) => {
          coachDelivered = true
          setMessages((current) => [...current, { role: 'coach', content: event.customer_message }])
          setSources(event.external_evidence || [])
          setUsage(event.usage || null)
          setSession(event.session)
          setPostResponseBusy(true)
        } },
      )
      if (!coachDelivered) setMessages((current) => [...current, { role: 'coach', content: result.customer_message }])
      setPending(result.confirmation_required ? result.proposal : null)
      setSources(result.external_evidence || [])
      setUsage(result.usage || null)
      setSession(result.session)
      onCurrent({ view_model: result.view_model, publication: result.publication })
      if (result.mutation_performed) setMessages((current) => [...current, { role: 'system', content: 'Your Business Twin is updated. We’ll continue from this new view.' }])
      if (result.gu_plan) setMessages((current) => [...current, { role: 'gu', plan: result.gu_plan }])
      if (result.gu_error) setMessages((current) => [...current, { role: 'system', content: 'Your Business Twin is updated, but the new visual could not be shown safely.' }])
    } catch (failure) {
      if (failure?.status === 401 && failure?.reentryRequired === true) return
      setError(durableConversation
        ? 'We could not finish this turn safely. Reload to check your saved conversation and map before trying again.'
        : coachDelivered
          ? 'You received the coaching response, but the follow-up check failed closed. Nothing was proposed or changed.'
          : 'That turn could not be carried forward safely. Your Business Twin has not changed. Please try again.')
    } finally { submitLockRef.current = false; setBusy(false); setPostResponseBusy(false) }
  }

  function handleComposerKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent?.isComposing) return
    event.preventDefault()
    if (!draft.trim() || busy || preSession || submitLockRef.current) return
    event.currentTarget.form?.requestSubmit()
  }

  async function decide(decision, editedItems = []) {
    if (!pending || busy) return
    setBusy(true); setError('')
    try {
      const result = await post({ action: 'DECISION', session_id: session.session_id, proposal_id: pending.proposal_id, decision, edited_items: editedItems })
      setPending(null)
      onCurrent({ view_model: result.view_model, publication: result.publication })
      setMessages((current) => [...current, { role: 'system', content: result.mutation_performed ? 'Your Business Twin is updated. We’ll continue from this new view.' : decision === 'REJECT' ? 'Understood. That proposed change was not used.' : 'No change was made. We can return to it later.' }])
      if (result.gu_plan) setMessages((current) => [...current, { role: 'gu', plan: result.gu_plan }])
      if (result.gu_error) setMessages((current) => [...current, { role: 'system', content: 'Your Business Twin is updated, but the new visual could not be shown safely.' }])
    } catch { setError(durableConversation ? 'We could not confirm the saved result. Reload to check your map before trying the update again.' : 'That update could not be applied safely. Your prior Business Twin remains current.') } finally { setBusy(false) }
  }

  async function endSession(closeDecision = null) {
    if (busy || endSessionLockRef.current) return
    endSessionLockRef.current = true
    setBusy(true); setError('')
    try {
      const conversation = messages.filter((item) => ['customer', 'coach'].includes(item.role)).slice(-24)
      const result = await post({
        action: 'END_SESSION',
        ...(closeDecision ? { close_decision: closeDecision } : {}),
        close_request_id: globalThis.crypto.randomUUID(),
        session_id: session.session_id,
        cumulative_active_seconds: episodeStartedAt.current ? Math.floor((Date.now() - episodeStartedAt.current) / 1000) : 0,
        conversation,
        visible_customer_context: visibleCustomerContext(),
      })
      if (result.customer_message) setMessages((current) => [...current, { role: 'coach', content: result.customer_message }])
      setSessionLearning(result.session_learning || null)
      setUsage(result.usage || usage)
      setSession(result.session); setPending(result.confirmation_required ? result.pending_proposal : null)
      if (!result.mutual_close?.human_alignment_required) {
        if (result.gu_plan) setMessages((current) => [...current, { role: 'gu', plan: result.gu_plan }])
        setSession(result.next_pre_session || result.session)
        setPreSession(Boolean(result.next_pre_session))
        if (result.next_pre_session) episodeStartedAt.current = null
      }
    } catch { setError(durableConversation ? 'We could not confirm the session close. Reload to check the saved session before trying again.' : 'The session could not be closed cleanly yet. Your governed state remains safe.') } finally { endSessionLockRef.current = false; setBusy(false) }
  }

  async function startSession() {
    if (busy || !preSession || !session.start_action || startSessionLockRef.current) return
    startSessionLockRef.current = true
    setBusy(true); setError('')
    try {
      const result = await post({ action: session.start_action })
      setMessages(result.gu_plan ? [{ role: 'gu', plan: result.gu_plan }] : [])
      setPending(null); setSources([]); setUsage(null); setSessionLearning(null)
      setSession(result.session); setPreSession(false)
      onCurrent({ view_model: result.view_model, publication: result.publication })
      episodeStartedAt.current = Date.now()
    } catch { setError(durableConversation ? 'We could not confirm the session opening. Reload to check your session before trying again.' : 'The session did not start because the required opening view could not be established safely. Nothing was changed or consumed.') } finally { startSessionLockRef.current = false; setBusy(false) }
  }

  return <aside className="living-conversation internal-dev-conversation" aria-label="Talk with MORE" data-coaching-episode-phase={session.coaching_episode_phase || 'IDLE'} data-session-learning-status={sessionLearning?.status || 'NOT_READY'}>
    <header><div><span className="living-presence" aria-hidden="true" /><p>MORE • LIVE</p><h2>Talk through your business.</h2></div><span className="living-state-label">{session.session_class === 'ONBOARDING_INCLUDED' ? 'first relationship session' : 'continuing relationship'}</span></header>
    <div className="internal-session-boundary"><span>{session.standard_sessions_per_cycle} coaching sessions each month</span><span>About {session.approximate_minutes} minutes</span></div>
    <div className="living-thread" aria-live="polite">
      {!preSession && messages.length === 0 && <div className="living-blank"><span>✦</span><h3>Your Business Twin is ready.</h3><p>MORE will lead from what matters now, while you remain in control of every decision.</p></div>}
      {messages.map((message, index) => message.role === 'gu'
        ? <SubscriptionS2GuRenderer key={`gu-${index}-${message.plan?.event}`} plan={message.plan} />
        : <div key={`${message.role}-${index}`} className={`living-message ${message.role}`}><span>{message.role === 'customer' ? 'You' : message.role === 'coach' ? 'MORE' : 'Updated'}</span>{message.role === 'coach' ? <CoachMessageBody content={message.content} /> : <p>{message.content}</p>}</div>)}
      {preSession && <section className="s2-session-start" aria-label={session.start_action === 'START_MY_FIRST_SESSION' ? 'Start my first session' : 'Start session'}>
        <span aria-hidden="true">✦</span>
        <h3>{session.start_action === 'START_MY_FIRST_SESSION' ? 'Your coaching relationship is ready.' : 'Ready when you are.'}</h3>
        <p>{session.start_action === 'START_MY_FIRST_SESSION' ? 'Click START MY FIRST SESSION to meet your MORE coach and begin.' : 'Click START SESSION to pick up where you left off.'}</p>
        <button type="button" disabled={busy} onClick={startSession}>{session.start_action === 'START_MY_FIRST_SESSION' ? 'START MY FIRST SESSION' : 'START SESSION'}</button>
        <small className="s2-session-start-note">If I ever sound too technical or complicated, tell me. Ask me to explain it more simply or adjust how I communicate.</small>
      </section>}
      {pending && <ExactUpdateCard proposal={pending} busy={busy} onDecision={decide} />}
      {sources.length > 0 && <section className="living-research" aria-label="Current external sources"><span>Current outside information</span>{sources.map((source) => <a key={source.external_evidence_id} href={source.source_url} target="_blank" rel="noreferrer">{source.source_title}</a>)}<small>This information can help the conversation. It does not change what MORE knows about your business.</small></section>}
      {error && <div className="living-message system"><span>Safe stop</span><p>{error}</p></div>}
      {busy && !postResponseBusy && <div className="living-thinking"><i /><i /><i /><span>Thinking about what matters most…</span></div>}
      {postResponseBusy && <div className="living-thinking post-response"><i /><i /><i /><span>Checking whether anything you said is worth keeping…</span></div>}
      <div ref={endRef} />
    </div>
    {!preSession && <form className="living-composer" onSubmit={send}><label htmlFor="subscription-living-message">{session.coaching_episode_phase === 'ENDING' ? 'Review our session' : 'Talk naturally'}</label><textarea id="subscription-living-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder={session.coaching_episode_phase === 'ENDING' ? 'Correct the recap, ask to continue, or say you are ready to finish…' : 'Ask a question, share what changed, or say what is on your mind…'} rows="2" /><button type="submit" disabled={!draft.trim() || busy} aria-label="Send message">↑</button><div className="s2-composer-meta"><small>{usage ? `Enter to send · Shift+Enter for a new line${usage.web_search_calls ? ' · Current outside information was checked' : ''}` : 'Enter to send · Shift+Enter for a new line. Only changes you approve update your Business Twin.'}</small>{session.coaching_episode_phase !== 'ENDING' && <button className="s2-end-session" type="button" disabled={busy} onClick={() => endSession()}>End this session</button>}</div>
      <div className="s2-closing-actions" aria-label="Session choices">
        {session.coaching_episode_phase === 'ENDING' && <>
          <button type="button" disabled={busy} onClick={() => endSession('CONTINUE')}>Continue coaching</button>
          <button type="button" disabled={busy || Boolean(draft.trim())} title={draft.trim() ? 'Send your recap changes before finishing.' : undefined} onClick={() => endSession('FINISH')}>Finish session</button>
        </>}
        <button type="button" disabled={busy} onClick={() => endSession('LEAVE')}>Leave with open items</button>
      </div>
    </form>}
  </aside>
}

export default function SubscriptionV1InternalDevApp({ allowModelSelection = true } = {}) {
  const [state, setState] = useState({ loading: true, error: null, bootstrap: null })
  const [qaEntry, setQaEntry] = useState({ checking: false, proof: null })
  const [current, setCurrent] = useState(null)
  const [resetVersion, setResetVersion] = useState(0)
  const [resetting, setResetting] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [coachingBusy, setCoachingBusy] = useState(false)
  const [switchError, setSwitchError] = useState('')
  useEffect(() => {
    let live = true
    fetch('/api/internal/subscription-v1-runtime', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => ({ response, body: await response.json().catch(() => null) }))
      .then(({ response, body }) => {
        if (!live) return
        if (!response.ok || body?.ok !== true) setState({ loading: false, error: body?.code || 'SUBSCRIPTION_V1_INTERNAL_ENTITLEMENT_REQUIRED', bootstrap: null })
        else {
          setCurrent({ view_model: body.view_model, publication: body.publication })
          setState({ loading: false, error: null, bootstrap: body })
        }
      })
      .catch(() => live && setState({ loading: false, error: 'SUBSCRIPTION_V1_RUNTIME_UNAVAILABLE', bootstrap: null }))
    return () => { live = false }
  }, [resetVersion])
  useEffect(() => {
    if (state.loading) {
      setQaEntry({ checking: false, proof: null })
      return undefined
    }
    let live = true
    setQaEntry({ checking: true, proof: null })
    requestSyntheticQaEntryProof()
      .then((proof) => live && setQaEntry({ checking: false, proof }))
      .catch(() => live && setQaEntry({ checking: false, proof: null }))
    return () => { live = false }
  }, [state.loading, state.error, state.bootstrap])
  async function selectModel(selection) {
    const blind = state.bootstrap?.blind_demo
    if (!allowModelSelection || !blind || switching || coachingBusy || selection === blind.selection) return
    setSwitching(true)
    setSwitchError('')
    try {
      const selectionCsrf = await prepareBlindDemoRequestProof({ blind, kind: 'selection' })
      const response = await fetch('/api/internal/subscription-v1-runtime', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'content-type': 'application/json', 'x-subscription-demo-subject-csrf': selectionCsrf },
        body: JSON.stringify({ action: 'SELECT_MODEL', selection, view_token: blind.view_token }),
      })
      const result = await response.json()
      if (!response.ok || result.ok !== true) throw new Error('Selection could not change safely. Let the current turn finish, then reload.')
      setCurrent(null)
      setState({ loading: true, error: null, bootstrap: null })
      setResetVersion((version) => version + 1)
    } catch {
      setSwitchError('The coach could not be switched safely. Finish the current turn, then reload and try again.')
    } finally { setSwitching(false) }
  }
  async function resetDemo() {
    if (resetting || state.bootstrap?.demo_reset_enabled !== true) return
    setResetting(true)
    try {
      const prepared = await fetch('/api/internal/subscription-v1-demo-reset', { credentials: 'same-origin', cache: 'no-store' })
      const ready = await prepared.json().catch(() => null)
      if (!prepared.ok || ready?.ok !== true || !ready.csrf_token) throw new Error(ready?.code || 'SUBSCRIPTION_DEMO_RESET_UNAVAILABLE')
      const response = await fetch('/api/internal/subscription-v1-demo-reset', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'content-type': 'application/json', 'x-subscription-demo-reset-csrf': ready.csrf_token },
        body: JSON.stringify({ action: 'RESET_DEMO' }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || result?.ok !== true) throw new Error(result?.code || 'SUBSCRIPTION_DEMO_RESET_UNAVAILABLE')
      sessionStorage.removeItem(messageStorageKey(DEMO_SUBJECT))
      setCurrent(null)
      setState({ loading: true, error: null, bootstrap: null })
      setResetVersion((version) => version + 1)
    } catch (error) {
      setState((value) => ({ ...value, error: error?.message || 'SUBSCRIPTION_DEMO_RESET_UNAVAILABLE' }))
    } finally { setResetting(false) }
  }
  if (state.loading) return <main className="subscription-entry-state"><span>✦</span><h1>Opening the Living Business Relationship…</h1><p>Verifying your entitlement and governed state.</p></main>
  if (state.error && qaEntry.checking) return <main className="subscription-entry-state"><span>✦</span><h1>Checking synthetic QA access…</h1><p>Verifying the protected entry lane.</p></main>
  if (state.error && qaEntry.proof) return <SyntheticQaEntryForm initialProof={qaEntry.proof} />
  if (/^(?:SUBSCRIPTION_V1_PAID_|ENTITLEMENT_)/u.test(String(state.error || ''))) return <main className="subscription-entry-state denied" role="alert"><span>▢</span><h1>Subscription access required.</h1><p>Return to your Profile to verify ownership and active membership, then enter Subscription again.</p><Link to="/profile">Return to Profile</Link></main>
  if (state.error || !current?.view_model) return <main className="subscription-entry-state denied" role="alert"><span>▢</span><h1>Internal Subscription access required.</h1><p>Enter the authorized synthetic access code through the Leadership Portal.</p><Link to="/leadership">Return to Leadership Portal</Link></main>
  const handleEntitlementLost = (code) => setState({ loading: false, error: code || 'SUBSCRIPTION_V1_INTERNAL_ENTITLEMENT_REQUIRED', bootstrap: null })
  const paidSubscriber = state.bootstrap?.subscriber?.kind === 'PAID_SUBSCRIBER'
  const syntheticQaSubscriber = state.bootstrap?.subscriber?.kind === 'SYNTHETIC_QA_SUBSCRIBER'
  const paidLibrary = paidSourceLibraryLabel(current.view_model.identity?.vertical)
  const content = <>
    {qaEntry.proof && <SyntheticQaEntryForm initialProof={qaEntry.proof} compact activeSynthetic={syntheticQaSubscriber} />}
    {paidSubscriber && <p className="subscription-capability-note" role="note">Your coach can use MORE’s {paidLibrary} library. Live web research is not available in this version.</p>}
    {!paidSubscriber && <nav className="s2-demo-toolbar" aria-label={syntheticQaSubscriber ? 'Synthetic QA Subscription person' : 'Synthetic Subscription demonstration'}>{syntheticQaSubscriber
      ? <div className="s2-synthetic-qa-label"><strong>SYNTHETIC QA</strong><span>No paid subscription</span></div>
      : <><div><strong>SYNTHETIC JORDAN</strong><span>Demo-only relationship</span></div>{allowModelSelection && state.bootstrap.blind_demo && <div className="s2-blind-selector" role="group" aria-label="Choose your coach">{['1', '2'].map((selection) => <button type="button" key={selection} aria-pressed={state.bootstrap.blind_demo.selection === selection} disabled={switching || coachingBusy} onClick={() => selectModel(selection)}>MODEL {selection}</button>)}</div>}{switchError && <p role="status">{switchError}</p>}{state.bootstrap.demo_reset_enabled === true && <button type="button" data-demo-only-control="true" disabled={resetting} onClick={resetDemo}>{resetting ? 'RESETTING…' : 'RESET DEMO'}</button>}</>}</nav>}
    <div className="living-twin-column"><LivingBusinessTwinApp viewModel={current.view_model} /></div>
    {state.bootstrap.coaching_available === false
      ? <AllowanceBoundary session={state.bootstrap.session} />
      : <RemoteConversation key={`${paidSubscriber ? 'paid' : DEMO_SUBJECT}:${state.bootstrap.blind_demo?.selection || 'ordinary'}:${resetVersion}`} bootstrap={state.bootstrap} demoSubject={paidSubscriber ? null : DEMO_SUBJECT} ephemeralStorageEnabled={!paidSubscriber} onCurrent={setCurrent} onEntitlementLost={handleEntitlementLost} onBusyChange={setCoachingBusy} />}
  </>
  if (paidSubscriber) return <main className="living-relationship-app production-intended-subscription" data-runtime="production-intended" data-synthetic-only="false" data-layer-max="2">{content}</main>
  return <main className="living-relationship-app production-intended-subscription" data-runtime="production-intended" data-synthetic-only="true" data-synthetic-qa={syntheticQaSubscriber ? 'true' : undefined} data-demo-subject={syntheticQaSubscriber ? undefined : DEMO_SUBJECT} data-layer-max="2">{content}</main>
}
