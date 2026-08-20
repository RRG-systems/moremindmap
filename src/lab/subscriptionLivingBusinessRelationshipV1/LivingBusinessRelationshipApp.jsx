import React, { useEffect, useMemo, useRef, useState } from 'react'
import LivingBusinessTwinApp from './LivingBusinessTwinApp.jsx'

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

function DecisionCard({ proposal, onDecision, busy }) {
  const [editing, setEditing] = useState(false)
  const [items, setItems] = useState(() => proposal.proposed_items.map((item) => ({ ...item })))
  return <section className="living-decision" data-confirmation-ux="secondary-fallback" aria-label="Exact Business Twin update available">
    <p className="living-kicker">Exact map update ready</p>
    <h3>{proposal.summary}</h3>
    <p>{proposal.reason}</p>
    <p className="living-decision-natural">Reply naturally to confirm, change, wait, or reject this exact update. Nothing changes unless you confirm it; ambiguous assent still leaves it pending.</p>
    <details className="living-decision-fallback">
      <summary>Use confirmation buttons instead</summary>
      {editing && <div className="living-edit-fields">{items.map((item, index) => <label key={item.field}><span>{item.field.split('.').at(-1).replaceAll('_', ' ')}</span><textarea value={item.value} onChange={(event) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, value: event.target.value } : entry))} /></label>)}</div>}
      <div className="living-decision-actions">
        {editing
          ? <button type="button" className="confirm" disabled={busy} onClick={() => onDecision('EDIT', items)}>Use these edits</button>
          : <button type="button" className="confirm" disabled={busy} onClick={() => onDecision('CONFIRM')}>Yes, update my map</button>}
        <button type="button" disabled={busy} onClick={() => setEditing((value) => !value)}>{editing ? 'Cancel edits' : 'Change it'}</button>
        <button type="button" disabled={busy} onClick={() => onDecision('DEFER')}>Not now</button>
        <button type="button" className="quiet" disabled={busy} onClick={() => onDecision('REJECT')}>No, don’t use this</button>
      </div>
    </details>
  </section>
}

function ConversationPanel({ controller, onPublication, demo }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [activeLens, setActiveLens] = useState('OVERVIEW')
  const [latestReceipt, setLatestReceipt] = useState(null)
  const [researchSources, setResearchSources] = useState([])
  const endRef = useRef(null)
  useEffect(() => {
    const handler = (event) => setActiveLens(String(event.detail || 'overview').toUpperCase())
    globalThis.addEventListener('ba-pd:destination', handler)
    return () => globalThis.removeEventListener('ba-pd:destination', handler)
  }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [messages, pending])

  function visibleCustomerContext() {
    const visibleBySurface = {
      OVERVIEW: ['Where You Are', 'Five Possible Futures', 'Your One Move', 'Your Plan', 'Evidence'],
      WHERE: ['Current snapshot', 'Today to goal', 'Critical realities', 'The gap'],
      FUTURES: ['Five trajectories', 'Relative support', 'Conditions', 'What would change each path'],
      MOVE: ['Constraint', 'Mechanism', 'Intervention', 'Proof conditions'],
      PLAN: ['Goal', 'Current completed ways', 'Open ways', 'Strategies', 'One Move relationship'],
      EVIDENCE: ['Known', 'Inferred', 'Missing', 'Contradicted', 'What would change the view'],
    }
    return { surface: activeLens.toLowerCase().replaceAll('_', ' '), visible_objects: visibleBySurface[activeLens] || visibleBySurface.OVERVIEW }
  }

  function profileHref(profileKey, sessionKind = demo?.relationship_context?.session_kind) {
    const params = new URLSearchParams()
    params.set('profile', profileKey || demo?.current_profile_key || 're-mid')
    params.set('session', sessionKind === 'WEEKLY' ? 'weekly' : 'first')
    return `?${params.toString()}`
  }

  async function send(event) {
    event.preventDefault()
    const message = draft.trim()
    if (!message || busy) return
    setDraft('')
    setBusy(true)
    setMessages((current) => [...current, { role: 'customer', content: message }])
    try {
      const result = await controller.send({ message, visible_customer_context: visibleCustomerContext() })
      if (result.ok) {
        setMessages((current) => [...current, { role: 'coach', content: result.customer_message }])
        setPending(result.confirmation_required ? result.proposal : null)
        const conversationReceipt = (result.provider_receipts || []).find((receipt) => receipt?.stage === 'CONVERSATION')
        if (conversationReceipt) setLatestReceipt(conversationReceipt)
        if (Array.isArray(result.external_evidence) && result.external_evidence.length) setResearchSources(result.external_evidence)
        if (result.mutation_performed) onPublication(controller.current())
      } else setMessages((current) => [...current, { role: 'system', content: 'I couldn’t safely carry that turn forward. Your Business Twin has not changed.' }])
    } catch {
      setMessages((current) => [...current, { role: 'system', content: 'I couldn’t safely carry that turn forward. Your Business Twin has not changed.' }])
    } finally {
      setBusy(false)
    }
  }

  async function decide(decision, editedItems = []) {
    if (!pending || busy) return
    setBusy(true)
    const proposal = pending
    const result = await controller.decide({ proposal_id: proposal.proposal_id, decision, edited_items: editedItems, idempotency_key: `ui:${proposal.proposal_id}:${decision}` })
    if (result.ok) {
      setPending(null)
      if (result.mutation_performed) {
        const current = controller.current()
        onPublication(current)
        setMessages((existing) => [...existing, { role: 'system', content: 'Your Business Twin is updated. We’re continuing from the new state now.' }])
      } else setMessages((existing) => [...existing, { role: 'system', content: decision === 'REJECT' ? 'Understood. I won’t use that proposed change.' : 'No change made. We can return to it later if it becomes useful.' }])
    } else setMessages((existing) => [...existing, { role: 'system', content: 'That update could not be applied safely. Your prior Business Twin remains current.' }])
    setBusy(false)
  }

  return <aside className="living-conversation" aria-label="Talk with MORE">
    <header><div><span className="living-presence" aria-hidden="true" /><p>MORE · LIVE GPT-5.6 SOL</p><h2>Talk through your business.</h2></div><span className="living-state-label">{activeLens.replaceAll('_', ' ').toLowerCase()}</span></header>
    <nav className="living-session-nav" aria-label="Synthetic Founder demo state">
      <label className="living-profile-picker"><span>Synthetic Founder subject</span><select aria-label="Choose synthetic Founder subject" value={demo?.current_profile_key || 're-mid'} onChange={(event) => { globalThis.location.href = profileHref(event.target.value) }}>{(demo?.profile_options || []).map((profile) => <option key={profile.key} value={profile.key}>{profile.label}</option>)}</select></label>
      <a className={demo?.relationship_context?.session_kind === 'FIRST_EVER' ? 'active' : ''} href={profileHref(demo?.current_profile_key, 'FIRST_EVER')}>First-ever session</a>
      <a className={demo?.relationship_context?.session_kind === 'WEEKLY' ? 'active' : ''} href={profileHref(demo?.current_profile_key, 'WEEKLY')}>Weekly continuity</a>
      <button type="button" onClick={() => globalThis.location.reload()}>Reset</button>
    </nav>
    <div className="living-thread" aria-live="polite">
      {messages.length === 0 && <div className="living-blank"><span>✦</span><h3>What would be useful to work through?</h3><p>You don’t need to choose a framework or fill out another form. Just talk to me.</p></div>}
      {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`living-message ${message.role}`}><span>{message.role === 'customer' ? 'You' : message.role === 'coach' ? 'MORE' : 'Updated'}</span>{message.role === 'coach' ? <CoachMessageBody content={message.content} /> : <p>{message.content}</p>}</div>)}
      {pending && <DecisionCard proposal={pending} onDecision={decide} busy={busy} />}
      {researchSources.length > 0 && <section className="living-research" aria-label="Current external sources used in this turn"><span>Current external context</span>{researchSources.map((source) => <a key={source.external_evidence_id} href={source.source_url} target="_blank" rel="noreferrer">{source.source_title}</a>)}<small>External context informs the conversation; it does not rewrite your governed business truth.</small></section>}
      {busy && <div className="living-thinking"><i /><i /><i /><span>Understanding the whole state…</span></div>}
      <div ref={endRef} />
    </div>
    <form className="living-composer" onSubmit={send}><label htmlFor="living-message">Talk naturally</label><textarea id="living-message" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask, challenge, reflect, or tell MORE what changed…" rows="2" /><button type="submit" disabled={!draft.trim() || busy} aria-label="Send message">↑</button><small>{latestReceipt ? `Live provider proof · ${latestReceipt.model} · store:false · ${latestReceipt.input_tokens + latestReceipt.output_tokens} tokens · ${latestReceipt.latency_ms} ms${latestReceipt.web_search_calls ? ` · ${latestReceipt.web_search_calls} web search` : ''}` : 'Live, synthetic-only Founder demo. Durable changes require your exact confirmation.'}</small></form>
  </aside>
}

export default function LivingBusinessRelationshipApp({ controller, demo = null }) {
  const initial = useMemo(() => controller.current(), [controller])
  const [current, setCurrent] = useState(initial)
  if (!current.ok) return <main className="integrity-stop" role="alert"><p>Living Business Twin unavailable</p><h1>The governed current state could not be verified.</h1></main>
  return <main className="living-relationship-app" data-afw="05-06" data-layer-max="2">
    <div className="living-twin-column"><LivingBusinessTwinApp viewModel={current.view_model} /></div>
    <ConversationPanel controller={controller} onPublication={setCurrent} demo={demo} />
  </main>
}
