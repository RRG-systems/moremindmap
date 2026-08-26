import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import LivingBusinessTwinApp from '../lab/subscriptionLivingBusinessRelationshipV1/LivingBusinessTwinApp.jsx'
import '../lab/baProgressiveDisclosureV1/styles.css'
import '../lab/subscriptionLivingBusinessRelationshipV1/styles.css'
import './internalDev.css'

const STORAGE_KEY = 'more_subscription_v1_internal_ephemeral_conversation'

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
    if (/^[-*]\s/u.test(trimmed)) return <p key={`bullet-${index}`} className="living-message-bullet"><span aria-hidden="true">•</span><InlineCoachText text={trimmed.replace(/^[-*]\s/u, '')} /></p>
    const numbered = trimmed.match(/^(\d+)\.\s(.+)$/u)
    if (numbered) return <p key={`number-${index}`} className="living-message-number"><span>{numbered[1]}.</span><InlineCoachText text={numbered[2]} /></p>
    return <p key={`line-${index}`}><InlineCoachText text={trimmed} /></p>
  })}</div>
}

function ExactUpdateCard({ proposal, busy, onDecision }) {
  const [editing, setEditing] = useState(false)
  const [items, setItems] = useState(() => proposal.proposed_items.map((item) => ({ ...item })))
  return <section className="living-decision" data-confirmation-ux="secondary-fallback" aria-label="Exact Business Twin update available">
    <p className="living-kicker">Exact map update ready</p>
    <h3>{proposal.summary}</h3>
    <p>{proposal.reason}</p>
    <p className="living-decision-natural">Reply naturally to confirm, change, wait, or reject this exact update. Nothing changes unless you authorize it.</p>
    <details className="living-decision-fallback"><summary>Use confirmation buttons instead</summary>
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

function readEphemeralMessages() {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]')
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

function RemoteConversation({ bootstrap, onCurrent }) {
  const [messages, setMessages] = useState(readEphemeralMessages)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [activeLens, setActiveLens] = useState('OVERVIEW')
  const [csrf, setCsrf] = useState(bootstrap.csrf_token)
  const [session, setSession] = useState(bootstrap.session)
  const [usage, setUsage] = useState(null)
  const [sources, setSources] = useState([])
  const [ended, setEnded] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef(null)
  const openedAt = useRef(Date.now())

  useEffect(() => {
    const handler = (event) => setActiveLens(String(event.detail || 'overview').toUpperCase())
    globalThis.addEventListener('ba-pd:destination', handler)
    return () => globalThis.removeEventListener('ba-pd:destination', handler)
  }, [])
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-24)))
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, pending])

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

  async function post(body) {
    const response = await fetch('/api/internal/subscription-v1-runtime', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'content-type': 'application/json', 'x-subscription-runtime-csrf': csrf },
      body: JSON.stringify(body),
    })
    const result = await response.json().catch(() => ({ ok: false, code: 'SUBSCRIPTION_V1_RESPONSE_INVALID' }))
    if (result.csrf_token) setCsrf(result.csrf_token)
    if (!response.ok || result.ok !== true) throw new Error(result.code || 'SUBSCRIPTION_V1_REQUEST_FAILED')
    return result
  }

  async function send(event) {
    event.preventDefault()
    const message = draft.trim()
    if (!message || busy || ended) return
    const history = messages.filter((item) => ['customer', 'coach'].includes(item.role)).slice(-24)
    setDraft(''); setBusy(true); setError('')
    setMessages((current) => [...current, { role: 'customer', content: message }])
    try {
      const result = await post({ action: 'TURN', session_id: session.session_id, message, conversation: history, visible_customer_context: visibleCustomerContext() })
      setMessages((current) => [...current, { role: 'coach', content: result.customer_message }])
      setPending(result.confirmation_required ? result.proposal : null)
      setSources(result.external_evidence || [])
      setUsage(result.usage || null)
      setSession(result.session)
      onCurrent({ view_model: result.view_model, publication: result.publication })
      if (result.mutation_performed) setMessages((current) => [...current, { role: 'system', content: 'Your Business Twin is updated. We’re continuing from the new governed state.' }])
    } catch {
      setError('That turn could not be carried forward safely. Your Business Twin has not changed. Please try again.')
    } finally { setBusy(false) }
  }

  async function decide(decision, editedItems = []) {
    if (!pending || busy) return
    setBusy(true); setError('')
    try {
      const result = await post({ action: 'DECISION', session_id: session.session_id, proposal_id: pending.proposal_id, decision, edited_items: editedItems })
      setPending(null)
      onCurrent({ view_model: result.view_model, publication: result.publication })
      setMessages((current) => [...current, { role: 'system', content: result.mutation_performed ? 'Your Business Twin is updated. We’re continuing from the new governed state.' : decision === 'REJECT' ? 'Understood. That proposed change was not used.' : 'No change was made. We can return to it later.' }])
    } catch { setError('That update could not be applied safely. Your prior Business Twin remains current.') } finally { setBusy(false) }
  }

  async function endSession() {
    if (busy) return
    setBusy(true); setError('')
    try {
      const result = await post({ action: 'END_SESSION', session_id: session.session_id, cumulative_active_seconds: Math.floor((Date.now() - openedAt.current) / 1000) })
      setSession(result.session); setEnded(true); setPending(null); sessionStorage.removeItem(STORAGE_KEY)
    } catch { setError('The session could not be closed cleanly yet. Your governed state remains safe.') } finally { setBusy(false) }
  }

  return <aside className="living-conversation internal-dev-conversation" aria-label="Talk with MORE">
    <header><div><span className="living-presence" aria-hidden="true" /><p>MORE · LIVE GPT-5.6 SOL</p><h2>Talk through your business.</h2></div><span className="living-state-label">{session.session_class === 'ONBOARDING_INCLUDED' ? 'first relationship session' : 'continuing relationship'}</span></header>
    <div className="internal-session-boundary"><span>{session.standard_sessions_per_cycle} substantive sessions / month</span><span>About {session.approximate_minutes} minutes</span><button type="button" disabled={busy || ended} onClick={endSession}>End session</button></div>
    <div className="living-thread" aria-live="polite">
      {messages.length === 0 && !ended && <div className="living-blank"><span>✦</span><h3>What would be useful to work through?</h3><p>You don’t need to choose a framework or fill out another form. Just talk to me.</p></div>}
      {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`living-message ${message.role}`}><span>{message.role === 'customer' ? 'You' : message.role === 'coach' ? 'MORE' : 'Updated'}</span>{message.role === 'coach' ? <CoachMessageBody content={message.content} /> : <p>{message.content}</p>}</div>)}
      {pending && <ExactUpdateCard proposal={pending} busy={busy} onDecision={decide} />}
      {sources.length > 0 && <section className="living-research" aria-label="Current external sources"><span>Current external context</span>{sources.map((source) => <a key={source.external_evidence_id} href={source.source_url} target="_blank" rel="noreferrer">{source.source_title}</a>)}<small>External context informs the conversation; it does not rewrite governed customer truth.</small></section>}
      {error && <div className="living-message system"><span>Safe stop</span><p>{error}</p></div>}
      {ended && <div className="living-session-ended"><span>✓</span><h3>Session complete.</h3><p>Your confirmed relationship state is saved. Re-enter to continue from it in a later session.</p><button type="button" onClick={() => globalThis.location.reload()}>Continue the relationship</button></div>}
      {busy && <div className="living-thinking"><i /><i /><i /><span>Understanding the whole state…</span></div>}
      <div ref={endRef} />
    </div>
    {!ended && <form className="living-composer" onSubmit={send}><label htmlFor="subscription-living-message">Talk naturally</label><textarea id="subscription-living-message" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask, challenge, reflect, or tell MORE what changed…" rows="2" /><button type="submit" disabled={!draft.trim() || busy} aria-label="Send message">↑</button><small>{usage ? `Live provider · store:false · ${usage.provider_calls} governed call${usage.provider_calls === 1 ? '' : 's'} this turn${usage.web_search_calls ? ` · ${usage.web_search_calls} web search` : ''}` : 'Synthetic internal entitlement. Confirmed changes use the governed Living Twin path.'}</small></form>}
  </aside>
}

export default function SubscriptionV1InternalDevApp() {
  const [state, setState] = useState({ loading: true, error: null, bootstrap: null })
  const [current, setCurrent] = useState(null)
  useEffect(() => {
    let live = true
    fetch('/api/internal/subscription-v1-runtime', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => ({ response, body: await response.json().catch(() => null) }))
      .then(({ response, body }) => {
        if (!live) return
        if (!response.ok || body?.ok !== true) setState({ loading: false, error: body?.code || 'SUBSCRIPTION_V1_INTERNAL_ENTITLEMENT_REQUIRED', bootstrap: null })
        else { setCurrent({ view_model: body.view_model, publication: body.publication }); setState({ loading: false, error: null, bootstrap: body }) }
      })
      .catch(() => live && setState({ loading: false, error: 'SUBSCRIPTION_V1_RUNTIME_UNAVAILABLE', bootstrap: null }))
    return () => { live = false }
  }, [])
  if (state.loading) return <main className="subscription-entry-state"><span>✦</span><h1>Opening the Living Business Relationship…</h1><p>Verifying the synthetic entitlement and governed state.</p></main>
  if (state.error || !current?.view_model) return <main className="subscription-entry-state denied" role="alert"><span>▢</span><h1>Internal Subscription access required.</h1><p>Enter the authorized synthetic access code through the Leadership Portal.</p><Link to="/leadership">Return to Leadership Portal</Link></main>
  return <main className="living-relationship-app production-intended-subscription" data-runtime="production-intended" data-synthetic-only="true" data-layer-max="2">
    <div className="living-twin-column"><LivingBusinessTwinApp viewModel={current.view_model} /></div>
    {state.bootstrap.coaching_available === false
      ? <AllowanceBoundary session={state.bootstrap.session} />
      : <RemoteConversation bootstrap={state.bootstrap} onCurrent={setCurrent} />}
  </main>
}
