import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import LivingBusinessTwinApp from '../lab/subscriptionLivingBusinessRelationshipV1/LivingBusinessTwinApp.jsx'
import SubscriptionS2GuRenderer from '../subscriptionS2/SubscriptionS2GuRenderer.jsx'
import '../lab/baProgressiveDisclosureV1/styles.css'
import '../lab/subscriptionLivingBusinessRelationshipV1/styles.css'
import './internalDev.css'

const STORAGE_KEY = 'more_subscription_v1_internal_ephemeral_conversation'
const SUBJECT_STORAGE_KEY = 'more_subscription_s2_demo_subject'
const DEMO_SUBJECTS = Object.freeze([
  { id: 'synthetic', label: 'SYNTHETIC', note: 'Synthetic Jordan' },
  { id: 'patricia-demo', label: 'PATRICIA', note: 'Sealed demo copy' },
])
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

function AllowanceBoundary({ session }) {
  return <aside className="living-conversation internal-dev-conversation allowance-boundary" aria-label="Subscription allowance state">
    <header><div><span className="living-presence" aria-hidden="true" /><p>MORE · LIVING RELATIONSHIP</p><h2>Your Business Twin is current.</h2></div><span className="living-state-label">allowance complete</span></header>
    <div className="living-thread">
      <div className="living-blank"><span>✓</span><h3>This month’s substantive coaching sessions are complete.</h3><p>Your governed relationship, Business Twin, Personal RSL, and confirmed changes remain available. The next coaching session opens with the next allowance cycle; no billing or customer state changed here.</p></div>
      <div className="internal-session-boundary"><span>{session.standard_sessions_used} of {session.standard_sessions_per_cycle} substantive sessions used</span><span>{session.standard_sessions_available} available this cycle</span></div>
    </div>
  </aside>
}

function RemoteConversation({ bootstrap, onCurrent, demoSubject }) {
  const initiallyPreSession = Boolean(bootstrap.session?.pre_session_state)
  const [messages, setMessages] = useState(() => initiallyPreSession ? [] : readEphemeralMessages(demoSubject))
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
  const [sessionLearning, setSessionLearning] = useState(null)
  const [error, setError] = useState('')
  const endRef = useRef(null)
  const episodeStartedAt = useRef(null)
  const submitLockRef = useRef(false)
  const endSessionLockRef = useRef(false)
  const startSessionLockRef = useRef(false)

  useEffect(() => {
    const handler = (event) => setActiveLens(String(event.detail || 'overview').toUpperCase())
    globalThis.addEventListener('ba-pd:destination', handler)
    return () => globalThis.removeEventListener('ba-pd:destination', handler)
  }, [])
  useEffect(() => {
    if (preSession) sessionStorage.removeItem(messageStorageKey(demoSubject))
    else sessionStorage.setItem(messageStorageKey(demoSubject), JSON.stringify(messages.slice(-24)))
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, pending, preSession, demoSubject])

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
    const response = await fetch('/api/internal/subscription-v1-runtime', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'content-type': 'application/json', accept: progressive ? 'application/x-ndjson' : 'application/json', 'x-subscription-runtime-csrf': csrf },
      body: JSON.stringify({ ...body, subject: demoSubject }),
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
        if (event.ok !== true) throw new Error(event.code || 'SUBSCRIPTION_V1_POST_RESPONSE_EXTRACTION_FAILED')
        finalResult = event
      }
      if (!finalResult) throw new Error('SUBSCRIPTION_V1_PROGRESSIVE_RESPONSE_EMPTY')
      return finalResult
    }
    const result = await response.json().catch(() => ({ ok: false, code: 'SUBSCRIPTION_V1_RESPONSE_INVALID' }))
    if (result.csrf_token) setCsrf(result.csrf_token)
    if (!response.ok || result.ok !== true) throw new Error(result.code || 'SUBSCRIPTION_V1_REQUEST_FAILED')
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
          prior_session_learning: sessionLearning,
          visible_customer_context: visibleCustomerContext(),
        })
        if (result.customer_message) setMessages((current) => [...current, { role: 'coach', content: result.customer_message }])
        if (result.gu_plan) setMessages((current) => [...current, { role: 'gu', plan: result.gu_plan }])
        setSessionLearning(result.session_learning || null)
        setUsage(result.usage || null)
        setSession(result.next_pre_session || result.session); setPreSession(Boolean(result.next_pre_session)); setPending(null)
        episodeStartedAt.current = null
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
    } catch {
      setError(coachDelivered
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
    } catch { setError('That update could not be applied safely. Your prior Business Twin remains current.') } finally { setBusy(false) }
  }

  async function endSession() {
    if (busy || endSessionLockRef.current) return
    endSessionLockRef.current = true
    setBusy(true); setError('')
    try {
      const conversation = messages.filter((item) => ['customer', 'coach'].includes(item.role)).slice(-24)
      const result = await post({
        action: 'END_SESSION',
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
        episodeStartedAt.current = null
      }
    } catch { setError('The session could not be closed cleanly yet. Your governed state remains safe.') } finally { endSessionLockRef.current = false; setBusy(false) }
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
    } catch { setError('The session did not start because the required opening view could not be established safely. Nothing was changed or consumed.') } finally { startSessionLockRef.current = false; setBusy(false) }
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
        <p>{session.start_action === 'START_MY_FIRST_SESSION' ? 'Start when you are ready to meet your MORE coach and begin the work.' : 'MORE remembers where you left off. Start when you are ready to continue.'}</p>
        <button type="button" disabled={busy} onClick={startSession}>{session.start_action === 'START_MY_FIRST_SESSION' ? 'START MY FIRST SESSION' : 'START SESSION'}</button>
        <small>If I ever sound too technical or complicated, tell me. Ask me to explain it more simply or adjust how I communicate.</small>
      </section>}
      {pending && <ExactUpdateCard proposal={pending} busy={busy} onDecision={decide} />}
      {sources.length > 0 && <section className="living-research" aria-label="Current external sources"><span>Current outside information</span>{sources.map((source) => <a key={source.external_evidence_id} href={source.source_url} target="_blank" rel="noreferrer">{source.source_title}</a>)}<small>This information can help the conversation. It does not change what MORE knows about your business.</small></section>}
      {error && <div className="living-message system"><span>Safe stop</span><p>{error}</p></div>}
      {busy && !postResponseBusy && <div className="living-thinking"><i /><i /><i /><span>Thinking about what matters most…</span></div>}
      {postResponseBusy && <div className="living-thinking post-response"><i /><i /><i /><span>Checking whether anything you said is worth keeping…</span></div>}
      <div ref={endRef} />
    </div>
    {!preSession && <form className="living-composer" onSubmit={send}><label htmlFor="subscription-living-message">{session.coaching_episode_phase === 'ENDING' ? 'Close together' : 'Talk naturally'}</label><textarea id="subscription-living-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder={session.coaching_episode_phase === 'ENDING' ? 'Say what helped, or tell MORE what it missed…' : 'Ask a question, share what changed, or say what is on your mind…'} rows="2" /><button type="submit" disabled={!draft.trim() || busy} aria-label="Send message">↑</button><div className="s2-composer-meta"><small>{usage ? `Enter to send · Shift+Enter for a new line${usage.web_search_calls ? ' · Current outside information was checked' : ''}` : 'Enter to send · Shift+Enter for a new line. Only changes you approve update your Business Twin.'}</small><button className="s2-end-session" type="button" disabled={busy || session.coaching_episode_phase === 'ENDING'} onClick={endSession}>{session.coaching_episode_phase === 'ENDING' ? 'Closing together…' : 'End this session'}</button></div></form>}
  </aside>
}

export default function SubscriptionV1InternalDevApp() {
  const [demoSubject, setDemoSubject] = useState(() => sessionStorage.getItem(SUBJECT_STORAGE_KEY) === 'patricia-demo' ? 'patricia-demo' : 'synthetic')
  const [state, setState] = useState({ loading: true, error: null, bootstrap: null })
  const [current, setCurrent] = useState(null)
  useEffect(() => {
    let live = true
    sessionStorage.setItem(SUBJECT_STORAGE_KEY, demoSubject)
    fetch(`/api/internal/subscription-v1-runtime?subject=${encodeURIComponent(demoSubject)}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => ({ response, body: await response.json().catch(() => null) }))
      .then(({ response, body }) => {
        if (!live) return
        if (!response.ok || body?.ok !== true) setState({ loading: false, error: body?.code || 'SUBSCRIPTION_V1_INTERNAL_ENTITLEMENT_REQUIRED', bootstrap: null })
        else { setCurrent({ view_model: body.view_model, publication: body.publication }); setState({ loading: false, error: null, bootstrap: body }) }
      })
      .catch(() => live && setState({ loading: false, error: 'SUBSCRIPTION_V1_RUNTIME_UNAVAILABLE', bootstrap: null }))
    return () => { live = false }
  }, [demoSubject])
  function chooseDemoSubject(subject) {
    if (subject === demoSubject) return
    setState({ loading: true, error: null, bootstrap: null })
    setCurrent(null)
    setDemoSubject(subject)
  }
  if (state.loading) return <main className="subscription-entry-state"><span>✦</span><h1>Opening the Living Business Relationship…</h1><p>Verifying the synthetic entitlement and governed state.</p></main>
  if (state.error || !current?.view_model) return <main className="subscription-entry-state denied" role="alert"><span>▢</span><h1>Internal Subscription access required.</h1><p>Enter the authorized synthetic access code through the Leadership Portal.</p><Link to="/leadership">Return to Leadership Portal</Link></main>
  return <main className="living-relationship-app production-intended-subscription" data-runtime="production-intended" data-synthetic-only="true" data-demo-subject={demoSubject} data-layer-max="2">
    <nav className="s2-subject-switcher" aria-label="Choose local demo subject">{DEMO_SUBJECTS.map((subject) => <button key={subject.id} type="button" aria-pressed={demoSubject === subject.id} onClick={() => chooseDemoSubject(subject.id)}><strong>{subject.label}</strong><span>{subject.note}</span></button>)}</nav>
    <div className="living-twin-column"><LivingBusinessTwinApp viewModel={current.view_model} /></div>
    {state.bootstrap.coaching_available === false
      ? <AllowanceBoundary session={state.bootstrap.session} />
      : <RemoteConversation key={demoSubject} bootstrap={state.bootstrap} demoSubject={demoSubject} onCurrent={setCurrent} />}
  </main>
}
