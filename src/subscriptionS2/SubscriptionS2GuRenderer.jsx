import React from 'react'

function ObjectContent({ object, anchorId }) {
  if (!object) return null
  return <div id={anchorId} tabIndex={anchorId ? -1 : undefined} className={`s2-gu-object s2-gu-object-${String(object.kind || 'plain').toLowerCase()}`}>
    {object.statement && <p className="s2-gu-statement">{object.statement}</p>}
    {object.qualifier && <p className="s2-gu-qualifier">{object.qualifier}</p>}
    {Array.isArray(object.items) && object.items.length > 0 && <div className="s2-gu-items">{object.items.map((item, index) => <div className="s2-gu-item" key={`${item.label}-${index}`}>
      <span>{item.label}</span>
      {item.value && <strong>{item.value}</strong>}
      {item.note && <small>{item.note}</small>}
      {Number.isFinite(item.support) && <div className="s2-gu-support" aria-label={`${item.support} out of 100 compared with the other paths`}><i style={{ width: `${Math.max(0, Math.min(100, item.support))}%` }} /></div>}
    </div>)}</div>}
    {Array.isArray(object.missing) && object.missing.length > 0 && <ul>{object.missing.map((item, index) => <li key={`${index}-${String(item).slice(0, 24)}`}>{typeof item === 'string' ? item : item?.reality || item?.title || 'Open evidence question'}</li>)}</ul>}
  </div>
}

export default function SubscriptionS2GuRenderer({ plan }) {
  const recapAnchor = React.useId()
  if (!plan?.guidance || plan?.renderDecision?.render === false || !Array.isArray(plan.blocks) || plan.blocks.length === 0) return null
  const firstSessionWelcome = plan.event === 'FIRST_SESSION_WELCOME'
  const welcomeStatement = firstSessionWelcome ? plan.blocks[0]?.objects?.[0]?.statement : null
  const renderedClosingNotes = new Map()
  const renderObject = (object, index) => {
    let anchorId
    if (plan.event === 'SESSION_CLOSING' && object?.kind === 'SESSION_LEARNING') {
      const contentKey = JSON.stringify(object)
      const earlierAnchor = renderedClosingNotes.get(contentKey)
      if (earlierAnchor) return <a key={`${object.id}-${index}`} className="s2-gu-recap-link" href={`#${earlierAnchor}`}>View the session recap above</a>
      anchorId = `${recapAnchor}-notes-${renderedClosingNotes.size + 1}`
      renderedClosingNotes.set(contentKey, anchorId)
    }
    return <ObjectContent key={`${object?.id}-${index}`} object={object} anchorId={anchorId} />
  }
  return <section className={`s2-gu s2-gu-${String(plan.event || '').toLowerCase()}`} aria-label={plan.guidance.headline} data-s2-gu-event={plan.event}>
    <header className="s2-gu-heading">
      {!firstSessionWelcome && <span>{plan.guidance.eyebrow}</span>}
      <h3>{firstSessionWelcome ? 'WELCOME TO MORE' : plan.guidance.headline}</h3>
      <p>{plan.guidance.summary || (firstSessionWelcome ? welcomeStatement : null)}</p>
    </header>
    {!firstSessionWelcome && <div className="s2-gu-grid">{plan.blocks.map((block) => <article key={block.blockId} className={`s2-gu-block s2-gu-${String(block.type).toLowerCase()}`}>
      <div className="s2-gu-block-heading"><h4>{block.title}</h4>{block.subtitle && <p>{block.subtitle}</p>}</div>
      {block.objects?.map(renderObject)}
    </article>)}</div>}
    <p className="s2-gu-next">{plan.guidance.nextCue}</p>
  </section>
}
