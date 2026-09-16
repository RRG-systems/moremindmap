import React, { useEffect, useMemo, useRef, useState } from 'react'

const DESTINATION_META = Object.freeze({
  where: { color: 'green', eyebrow: 'Where You Are', icon: '◎' },
  futures: { color: 'violet', eyebrow: 'Five Possible Futures', icon: '✦' },
  move: { color: 'amber', eyebrow: 'Your One Move', icon: '⌾' },
  plan: { color: 'blue', eyebrow: 'Your Plan', icon: '✓' },
  evidence: { color: 'teal', eyebrow: 'Evidence', icon: '▤' },
})

const CLASS_LABELS = Object.freeze({
  REPORTED: 'Known',
  KNOWN: 'Known',
  CALCULATED: 'Calculated',
  INFERRED: 'Inferred',
  MODELED_REQUIREMENT: 'Modeled',
  MODEL_ESTIMATED_PROBABILITY: 'Modeled',
  MISSING: 'Missing',
  CONTRADICTED: 'Contradicted',
  FUTURE_OBSERVATION_TARGET: 'To observe',
  GOVERNED_STRATEGIC_ACTION: 'Strategy',
})

const WAY_ORDINALS = Object.freeze(['First', 'Second', 'Third'])
const wayOrdinal = (index) => WAY_ORDINALS[index] || String(index + 1)

const humanizeConfidence = (value) => String(value || '')
  .replaceAll('_', ' ')
  .toLowerCase()
  .replace(/^./u, (letter) => letter.toUpperCase())

const humanizeCustomerText = (value) => String(value || '').replace(/\b(?:LOW|MODERATE_LOW|MODERATE|MODERATE_HIGH|HIGH)\b/gu, (label) => humanizeConfidence(label))

function MoreMark() {
  return <div className="more-mark" aria-label="MORE MindMap"><span aria-hidden="true">✧</span><strong>MORE<br />MINDMAP</strong></div>
}

function ActionButton({ className = '', children, onClick, ariaLabel }) {
  return <button type="button" className={`text-action ${className}`} onClick={onClick} aria-label={ariaLabel}>{children}<span aria-hidden="true">→</span></button>
}

function Clickable({ objectId, openObject, className = '', children, ariaLabel }) {
  return <button type="button" className={`clickable-card ${className}`} onClick={(event) => openObject(objectId, event.currentTarget)} aria-label={ariaLabel}>{children}</button>
}

function SideRail({ viewModel, active, navigate }) {
  return (
    <aside className="side-rail">
      <MoreMark />
      <p className="rail-kicker">Business Assessment</p>
      <button type="button" className={`rail-overview ${active === 'overview' ? 'active' : ''}`} onClick={() => navigate('overview')}><span>⌂</span>Overview</button>
      <nav aria-label="Business Twin destinations">
        {viewModel.nav.map((item) => <button type="button" key={item.id} className={`rail-link ${active === item.id ? 'active' : ''}`} data-tone={DESTINATION_META[item.id].color} onClick={() => navigate(item.id)}><span>{item.order}</span>{item.label}</button>)}
      </nav>
      <div className="rail-person"><span>{viewModel.identity.firstName.slice(0, 1)}</span><div><strong>{viewModel.identity.firstName}</strong><small>{viewModel.identity.vertical}</small></div></div>
      <div className="rail-boundary"><span aria-hidden="true">▢</span><div><strong>{viewModel.livingState?.active ? 'Living Business Twin' : 'Frozen assessment'}</strong><small>{viewModel.livingState?.active ? 'Only changes you confirm become part of this map.' : 'This map changes only when accepted business evidence changes.'}</small></div></div>
    </aside>
  )
}

function PageHeader({ viewModel, onHow }) {
  return <header className="page-header"><button type="button" className="back-link" onClick={() => globalThis.dispatchEvent(new CustomEvent('ba-pd:navigate', { detail: 'overview' }))}>← Back to Business Twin</button><button type="button" className="how-button" onClick={onHow}>How this works <span>ⓘ</span></button><span className="model-date">{viewModel.hero.modelDate}</span></header>
}

function Layer0CardBody({ card }) {
  if (card.id === 'where') return <>
    <p className="door-description">{card.description}</p>
    <div className="door-primary-stat"><strong>{card.value}</strong><span>{card.qualifier}</span></div>
    <div className="door-fact-list">{card.details.map((item) => <div key={`${item.label}-${item.value}`}><strong>{item.value}</strong><span>{item.label}</span>{item.epistemicClass === 'MODELED_REQUIREMENT' && <small>Goal-supporting model</small>}</div>)}</div>
  </>
  if (card.id === 'futures') return <>
    <p className="door-description">{card.description}</p>
    <div className="mini-futures">{card.items.map((item) => <div key={item.label}><strong>{item.probability}<small>%</small></strong><span>{item.label}</span><i aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <b key={index} className={index < Math.ceil(item.probability / 5) ? 'filled' : ''} />)}</i></div>)}</div>
  </>
  if (card.id === 'move') return <>
    <p className="door-description">{card.description}</p><span className="door-icon" aria-hidden="true">{card.icon}</span>
    <div className="destination-value">{card.value}</div><p className="destination-qualifier">{card.qualifier}</p>
  </>
  if (card.id === 'plan') return <>
    <p className="door-description">{card.description}</p><span className="door-icon" aria-hidden="true">{card.icon}</span>
    <div className="destination-value plan-door-copy">{card.value}</div><p className="destination-qualifier">{card.qualifier}</p>
  </>
  return <>
    <p className="door-description">{card.description}</p><span className="door-icon" aria-hidden="true">{card.icon}</span>
    <div className="door-evidence-list">{card.items.map((item) => <div key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}</div>
  </>
}

function Overview({ viewModel, navigate, openObject, onHow }) {
  const cards = viewModel.layer0.cards
  return (
    <main className="overview" data-layer="0">
      <header className="overview-header"><MoreMark /><button type="button" className="how-button" onClick={onHow}>How this works <span>ⓘ</span></button></header>
      <p className="eyebrow green">{viewModel.hero.eyebrow}</p>
      <h1>{viewModel.hero.title}</h1>
      <p className="hero-subtitle">{viewModel.hero.subtitle}</p>
      <section className="destination-grid" aria-label="Your Business Twin destinations">
        {cards.map((card, index) => <article className={`destination-card tone-${DESTINATION_META[card.id].color}`} key={card.id}>
          <span className="card-order">{index + 1}</span>
          <p className="eyebrow">{card.title}</p>
          <Layer0CardBody card={card} />
          <ActionButton onClick={() => navigate(card.id)} ariaLabel={`Open ${card.title}`}>{card.cta}</ActionButton>
        </article>)}
      </section>
      <Clickable objectId={cards[1].objectId} openObject={openObject} className="overview-callout big-picture" ariaLabel="Investigate the two strongest future paths">
        <span className="callout-icon">✦</span><div><p className="eyebrow violet">The Big Picture</p><h2>{viewModel.layer0.bigPicture}</h2><p>{viewModel.layer0.bigPictureQualifier}</p></div><b>→</b>
      </Clickable>
      <section className="overview-callout next-step"><span className="callout-icon">✓</span><div><p className="eyebrow blue">Your Next Step</p><h2>{viewModel.layer0.nextStep}</h2><p>{viewModel.layer0.nextStepQualifier}</p></div><ActionButton className="primary" onClick={() => navigate('plan')}>Start the plan</ActionButton></section>
      <footer className="snapshot-boundary"><span>▢</span><div><strong>{viewModel.livingState?.active ? 'This Business Twin is alive.' : 'This is a frozen business snapshot.'}</strong><p>{viewModel.livingState?.active ? 'Talk naturally with MORE. The map changes only after you confirm the exact update.' : 'It reflects the accepted evidence available at the model date.'}</p></div></footer>
    </main>
  )
}

function WherePage({ page, openObject }) {
  const metricIcons = ['♧', '♙', '☆', '⌾']
  return <div className="surface where-surface" data-layer="1" data-destination="where">
    <p className="eyebrow green">{page.eyebrow}</p><h1>{page.headline}</h1><p className="surface-subhead">{page.subhead}</p>
    <section className="headline-metrics">{page.metrics.map((metric, index) => <Clickable key={metric.objectId} objectId={metric.objectId} openObject={openObject} className="metric-card"><i aria-hidden="true">{metricIcons[index]}</i><strong>{metric.value}</strong><span>{metric.title}</span><small>{metric.qualifier}</small></Clickable>)}</section>
    <section className="panel pathway-panel"><p className="eyebrow green">From today to your goal</p><p>A simple view of where you are, where you want to go, and what the goal requires.</p><div className="pathway-grid">
      {Object.entries(page.pathway).map(([key, items], index) => <React.Fragment key={key}><div className={`pathway-column ${key}`}><p className="eyebrow">{key === 'required' ? 'Business Required' : key === 'goal' ? 'Your Goal' : 'Today'}</p><small className="pathway-caption">{key === 'required' ? 'Goal-supporting model' : key === 'goal' ? 'What you want to achieve' : 'What you have now'}</small>{items.map((item) => <Clickable key={item.objectId} objectId={item.objectId} openObject={openObject} className="pathway-item"><strong>{item.value}</strong><span>{item.title}</span><small>{item.qualifier}</small></Clickable>)}</div>{index < 2 && <span className="path-arrow">→</span>}</React.Fragment>)}
    </div></section>
    <section className="panel"><p className="eyebrow green">What MORE sees</p><p>The three critical realities shaping your business.</p><div className="reality-grid">{page.realities.map((item) => <Clickable key={item.objectId} objectId={item.objectId} openObject={openObject} className="reality-card"><span>◎</span><strong>{item.title}</strong><p>{item.text}</p><small>Explore this intelligence →</small></Clickable>)}</div></section>
    <section className="panel gap-panel"><div><p className="eyebrow green">The Gap</p><h2>{page.gap}</h2></div><span className="large-icon">↗</span></section>
    <section className="panel entrance-panel"><p className="eyebrow green">What’s next?</p><div>{page.entrances.map((entry) => <ActionButton key={entry.label} onClick={() => openObject(entry.objectId)}>{entry.label}</ActionButton>)}</div></section>
  </div>
}

function FuturesPage({ page, openObject }) {
  const [scenario, setScenario] = useState('current')
  const [detailTab, setDetailTab] = useState('looks')
  const items = scenario === 'current' ? page.items : page.items.map((item) => ({ ...item, probability: page.ifMoveWorks.find((future) => future.role === item.role).probability }))
  const [selectedRole, setSelectedRole] = useState(items[0].role)
  const selected = items.find((item) => item.role === selectedRole) || items[0]
  const stops = []
  const labels = []
  let total = 0
  for (const item of items) {
    const start = total
    total += item.probability
    stops.push(`var(--future-${item.role}) ${start}% ${total}%`)
    const angle = ((start + item.probability / 2) / 100) * Math.PI * 2 - Math.PI / 2
    labels.push({ role: item.role, value: item.probability, x: 50 + Math.cos(angle) * 35, y: 50 + Math.sin(angle) * 35 })
  }
  const confidenceLevel = String(selected.confidence || '').replaceAll('_', ' ').toLowerCase().replace(/^./u, (letter) => letter.toUpperCase())
  const confidenceDots = /high/iu.test(selected.confidence) ? 5 : /low/iu.test(selected.confidence) ? 3 : 4
  return <div className="surface futures-surface" data-layer="1" data-destination="futures">
    <p className="eyebrow violet">{page.eyebrow}</p><h1>{page.headline}</h1><p className="surface-subhead">{page.subhead}</p>
    <div className="scenario-toggle" role="group" aria-label="Future scenario"><button type="button" className={scenario === 'current' ? 'active' : ''} onClick={() => setScenario('current')}>Current business state</button><button type="button" className={scenario === 'move' ? 'active' : ''} onClick={() => setScenario('move')}>If the One Move works</button></div>
    <section className="futures-layout"><div className="panel futures-chart"><p className="eyebrow violet">{scenario === 'current' ? 'Current Odds' : 'If the One Move Works'}</p><div className="donut" style={{ background: `conic-gradient(${stops.join(',')})` }}>{labels.map((label) => <span className="donut-label" key={label.role} style={{ left: `${label.x}%`, top: `${label.y}%` }}>{label.value}%</span>)}<span className="donut-center"><strong>100%</strong>Total probability</span></div><small>Probabilities always sum to 100%. Confidence reflects the quality and completeness of accepted evidence.</small></div>
      <div className="panel future-list">{items.map((item) => <button type="button" key={item.role} className={selected.role === item.role ? 'selected' : ''} data-future={item.role} onClick={() => setSelectedRole(item.role)}><i /><div><strong>{item.label}</strong><span>{item.meaning}</span></div><b>{item.probability}%</b><small>{String(item.confidence).replaceAll('_', ' ').toLowerCase().replace(/^./u, (letter) => letter.toUpperCase())} confidence</small></button>)}</div>
      <article className="panel selected-future"><p className="eyebrow violet">Selected Future</p><header><h2>{selected.label}</h2><div className="future-probability"><strong>{selected.probability}%</strong><small>Probability</small></div><div className="future-confidence"><span>{confidenceLevel} confidence</span><i>{Array.from({ length: 7 }, (_, index) => <b className={index < confidenceDots ? 'filled' : ''} key={index} />)}</i></div></header><p>{selected.summary}</p><div className="future-tabs" role="tablist" aria-label="Selected future details"><button type="button" role="tab" aria-selected={detailTab === 'looks'} className={detailTab === 'looks' ? 'active' : ''} onClick={() => setDetailTab('looks')}>What this looks like</button><button type="button" role="tab" aria-selected={detailTab === 'possible'} className={detailTab === 'possible' ? 'active' : ''} onClick={() => setDetailTab('possible')}>Why this is possible</button><button type="button" role="tab" aria-selected={detailTab === 'change'} className={detailTab === 'change' ? 'active' : ''} onClick={() => setDetailTab('change')}>What would change it</button></div><div className="future-conditions" role="tabpanel"><h3>{detailTab === 'looks' ? 'What this future requires' : detailTab === 'possible' ? 'Signals supporting this path' : 'Signals that would change this path'}</h3>{detailTab === 'looks' ? <p>{selected.condition}</p> : <ul>{(detailTab === 'possible' ? selected.supporting : selected.falsifiers).map((item) => <li key={item}>{item}</li>)}</ul>}</div><div className="future-characteristics"><p className="eyebrow">Key characteristics</p><ul>{selected.keyCharacteristics.map((item) => <li key={item}>{item}</li>)}</ul></div><ActionButton onClick={(event) => openObject(selected.objectId, event.currentTarget, { displayValue: `${selected.probability}%` })}>Explore this Future in depth</ActionButton></article>
    </section>
  </div>
}

function MovePage({ page, openObject, navigate }) {
  return <div className="surface move-surface" data-layer="1" data-destination="move">
    <p className="eyebrow amber">{page.eyebrow}</p><h1>{page.headline}</h1><p className="surface-subhead move-intro">{page.subhead}</p>
    <section className="move-logic">{page.logic.map((item, index) => <React.Fragment key={item.objectId}><Clickable objectId={item.objectId} openObject={openObject} className={`move-node node-${index + 1}`}><p className="eyebrow">{item.label}</p><span className="node-icon">{['♙', '↻', '⌾', '✓'][index]}</span><h2>{item.value}</h2>{item.description && <p className="node-description">{item.description}</p>}</Clickable>{index < page.logic.length - 1 && <span className="logic-arrow">→</span>}</React.Fragment>)}</section>
    <h2 className="section-title">Why this move?</h2><section className="three-grid">{page.reasons.map((item) => <Clickable key={item.objectId} objectId={item.objectId} openObject={openObject} className="reason-card"><span className="reason-icon">◇</span><h3>{item.title}</h3><p>{item.text}</p></Clickable>)}</section>
    <h2 className="section-title">We’ll know it’s working when…</h2><section className="four-grid">{page.proof.map((item) => <Clickable key={item.objectId} objectId={item.objectId} openObject={openObject} className="proof-card"><span>✓</span><h3>{item.label}</h3></Clickable>)}</section>
    <section className="start-card"><span className="callout-icon">⚑</span><div><p className="eyebrow violet">Start Here</p><h2>{page.startHere.text}</h2><p>{page.startHere.qualifier}</p></div><ActionButton className="primary violet-button" onClick={() => navigate('plan')}>Start My One Move</ActionButton></section>
    <section className="deep-entrance"><span>?</span><div><strong>Why MORE chose this move</strong><p>See the deeper intelligence and evidence behind this recommendation.</p></div><ActionButton onClick={() => openObject(page.deepDiveObjectId)}>Open deep dive</ActionButton></section>
  </div>
}

function PlanPage({ page, openObject, openLocalDisclosure, navigate }) {
  const completion = page.completion || {
    goal: Boolean(page.goal),
    way1: page.ways[0]?.status === 'SELECTED_COMPLETE',
    way2: page.ways[1]?.status === 'SELECTED_COMPLETE',
    way3: page.ways[2]?.status === 'SELECTED_COMPLETE',
  }
  const planComplete = completion.goal && completion.way1 && completion.way2 && completion.way3
  return <div className="surface plan-surface" data-layer="1" data-destination="plan">
    <p className="eyebrow blue">{page.eyebrow}</p><h1>{page.headline}</h1><p className="surface-subhead">{page.subhead}</p>
    <section className="goal-banner"><span>⌾</span><div><p>The 1 — Your Goal</p><h2>{page.goal.annual && <><b>{page.goal.annual}</b> {page.goal.annualLabel}</>}{page.goal.annual && page.goal.monthly && <i> | </i>}{page.goal.monthly && <><b>{page.goal.monthly}</b> {page.goal.monthlyLabel}</>}</h2></div></section>
    <p className="eyebrow blue plan-label">The 3 — Three ways to get there</p><section className="way-grid">{page.ways.map((way, index) => <article key={index} className={`way-card ${way.status === 'SELECTED_COMPLETE' ? 'selected' : 'open'}`}><span className="way-check">{way.status === 'SELECTED_COMPLETE' ? '✓' : '○'}</span><p>Way {index + 1} — {way.status === 'SELECTED_COMPLETE' ? 'Built by MORE' : 'Open'}</p><h2>{way.title || `Your ${wayOrdinal(index)} Way`}</h2><p>{way.destinationState || 'A complete 1–3–5 gives you another strategic path to the goal.'}</p>{way.status === 'OPEN' && <div className="open-lines">1. ______<br />2. ______<br />3. ______<br />4. ______<br />5. ______</div>}</article>)}</section>
    <p className="eyebrow blue plan-label">The 5 — Strategies for Way 1</p><section className="strategy-list">{page.strategies.map((strategy) => <Clickable key={strategy.objectId} objectId={strategy.objectId} openObject={openObject} className="strategy-row"><b>{String(strategy.order).padStart(2, '0')}</b><span className="strategy-icon">◎</span><div><small>{strategy.title}</small><h3>{strategy.headline}</h3>{strategy.supportingText && <p>{strategy.supportingText}</p>}{strategy.flow?.length > 0 && <div className="strategy-flow">{strategy.flow.map((item, index) => <React.Fragment key={item}><span>{item}</span>{index < strategy.flow.length - 1 && <i>→</i>}</React.Fragment>)}</div>}</div><span>›</span></Clickable>)}</section>
    {page.ways.slice(1).map((way, wayIndex) => way.livingStrategies?.length === 5 && <React.Fragment key={`living-way-${wayIndex + 2}`}><p className="eyebrow blue plan-label">The 5 — Strategies for Way {wayIndex + 2}</p><section className="strategy-list">{way.livingStrategies.map((strategy, strategyIndex) => <article className="strategy-row" key={strategy}><b>{String(strategyIndex + 1).padStart(2, '0')}</b><span className="strategy-icon">◎</span><div><small>{way.title}</small><h3>{strategy}</h3></div><span>✓</span></article>)}</section></React.Fragment>)}
    <section className="plan-move"><span>⌾</span><div><p className="eyebrow amber">Your One Move Experiment</p><h2>{page.oneMove.title}</h2><p>{page.oneMove.intervention}</p><small>{page.oneMove.whyAlongside}</small></div><ActionButton onClick={() => navigate('move')}>Review My One Move</ActionButton></section>
    <section className="plan-completion"><div><p className="eyebrow blue">Your 1–3–5 so far</p><ul><li className={completion.goal ? 'done' : ''}>{completion.goal ? '✓' : '○'} 1 Goal</li><li className={completion.way1 ? 'done' : ''}>{completion.way1 ? '✓' : '○'} Way 1 + Five Strategies</li><li className={completion.way2 ? 'done' : ''}>{completion.way2 ? '✓' : '○'} Way 2 + Five Strategies</li><li className={completion.way3 ? 'done' : ''}>{completion.way3 ? '✓' : '○'} Way 3 + Five Strategies</li></ul></div><div><p className="eyebrow blue">{planComplete ? 'Living plan' : 'Complete the map'}</p>{planComplete ? <><h2>Your full 1–3–5 is complete.</h2><small>Keep talking with MORE. Confirmed changes will recompute this plan and publish the complete map atomically.</small></> : <><button type="button" onClick={() => openLocalDisclosure('build')}>Build the rest myself</button><button type="button" className="primary" onClick={() => openLocalDisclosure('living')}>Make My Map Alive →</button><small>Work with MORE to complete your full 1–3–5 and keep it current as your business changes.</small></>}</div></section>
  </div>
}

function EvidencePage({ page, openObject, livingMap, openLocalDisclosure }) {
  const [filter, setFilter] = useState('ALL')
  const rows = filter === 'ALL' ? page.ledger : page.ledger.filter((row) => (CLASS_LABELS[row.status] || row.status).toUpperCase() === filter)
  const relationshipHistory = page.relationshipHistory || { items: [], sourceBoundary: 'Private MORE relationship history is separate from source evidence.', coachingBoundary: 'Coaching Notes, Coach Connect history, and coach reports are not connected.' }
  return <div className="surface evidence-surface" data-layer="1" data-destination="evidence">
    <p className="eyebrow teal">{page.eyebrow}</p><h1>{page.headline}</h1><p className="surface-subhead">{page.subhead}</p>
    <section className="evidence-summary">{page.categories.map((category) => <Clickable key={category.objectId} objectId={category.objectId} openObject={openObject} className={`evidence-stat ${category.id}`}><strong>{category.value}</strong><span>{category.label}</span><small>{category.summary}</small></Clickable>)}</section>
    <section className="panel relationship-history" aria-labelledby="relationship-history-title">
      <header><div><p className="eyebrow teal">Your relationship with MORE</p><h2 id="relationship-history-title">What has carried forward</h2></div><span>{relationshipHistory.items.length} confirmed</span></header>
      {relationshipHistory.items.length > 0 ? <div className="relationship-history-list">{relationshipHistory.items.map((item) => <article key={item.eventId}><time dateTime={item.happenedAt}>{new Date(item.happenedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</time><div><small>{item.kind}</small><h3>{item.title}</h3>{item.details.slice(0, 2).map((detail) => <p key={detail}>{detail}</p>)}<span>{item.source}</span></div></article>)}</div> : <p className="relationship-history-empty">No confirmed relationship updates yet. Ordinary conversation stays ephemeral unless you authorize an exact durable change.</p>}
      <footer><p>{relationshipHistory.sourceBoundary}</p><p>{relationshipHistory.coachingBoundary}</p></footer>
    </section>
    <div className="evidence-filters" role="group" aria-label="Evidence filters">{['ALL', 'KNOWN', 'CALCULATED', 'INFERRED', 'MODELED', 'MISSING', 'CONTRADICTED'].map((item) => <button type="button" key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div>
    <section className="panel ledger"><h2>Evidence Ledger</h2><div className="ledger-table" role="table"><div className="ledger-head" role="row"><span>Business reality</span><span>Value / finding</span><span>What it is</span><span>Confidence</span></div>{rows.map((row) => <Clickable key={row.id} objectId={row.objectId} openObject={openObject} className="ledger-row"><span>{row.reality}</span><strong>{row.value}</strong><span className={`status status-${(CLASS_LABELS[row.status] || row.status).toLowerCase()}`}>{CLASS_LABELS[row.status] || row.status}</span><small>{row.confidence}</small></Clickable>)}</div></section>
    <section className="evidence-lower"><article className="panel"><p className="eyebrow blue">How MORE built your Business Twin</p><div className="build-flow"><span>Your answers</span>→<span>Business reality</span>→<span>Business model</span>→<span>Five Futures</span>→<span>One Move</span>→<span>1–3–5 Plan</span></div></article><article className="panel coverage"><p className="eyebrow blue">Evidence coverage map</p>{page.coverage.map((item) => <div key={item.territory}><span>{item.territory}</span><b>{item.confidence}</b><small>{item.known} known · {item.inferred} inferred · {item.missing} missing</small></div>)}</article></section>
    <section className="truth-columns">{page.truthColumns.map((column) => <article className="panel" key={column.label}><p className="eyebrow violet">{column.label}</p><h2>{column.title}</h2><ul>{column.items.map((item) => <li key={item}>{item}</li>)}</ul></article>)}</section>
    <section className="panel evidence-trace"><p className="eyebrow blue">Trace your Business Twin</p><div>{page.traceCards.map((item) => <Clickable key={item.objectId} objectId={item.objectId} openObject={openObject} className={`trace-card trace-${item.tone}`}><small>{item.label}</small><h3>{item.title}</h3><p>{item.summary}</p><b>Trace this intelligence →</b></Clickable>)}</div></section>
    <section className="evidence-lower"><article className="panel"><p className="eyebrow violet">Counterevidence</p><ul>{page.counterevidence.slice(0, 5).map((item) => <li key={item}>{item}</li>)}</ul><p className="eyebrow amber">What would change our mind</p><ul>{page.mindChanges.slice(0, 5).map((item) => <li key={item}>{item}</li>)}</ul></article><article className="panel"><p className="eyebrow blue">Evidence quality key</p><dl className="quality-key">{page.qualityKey.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.meaning}</dd></div>)}</dl></article></section>
    <section className="panel missing-evidence"><p className="eyebrow amber">Highest-value missing evidence</p><p>These are the current evidence gaps most likely to sharpen this frozen map.</p><ul>{page.highestValueMissing.map((item) => <li key={item}>{item}</li>)}</ul></section>
    <section className="living-map"><span>✦</span><div><p className="eyebrow teal">Frozen Map → Living Map</p><h2>{livingMap.headline}</h2><p>{livingMap.copy}</p></div><button type="button" onClick={() => openLocalDisclosure('living')}>{livingMap.action || 'See what this means'} →</button></section>
  </div>
}

function Drawer({ object, close }) {
  const panelRef = useRef(null)
  useEffect(() => {
    const panel = panelRef.current
    const focusable = panel?.querySelectorAll('button,[href],[tabindex]:not([tabindex="-1"])') || []
    focusable[0]?.focus()
    function onKey(event) {
      if (event.key === 'Escape') close()
      if (event.key !== 'Tab' || focusable.length < 2) return
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable[focusable.length - 1].focus() }
      if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) { event.preventDefault(); focusable[0].focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close, object.object_id])
  return <div className="drawer-layer" data-layer="2"><button type="button" className="drawer-scrim" aria-label="Close deep dive" onClick={close} /><aside ref={panelRef} className={`intelligence-drawer drawer-${object.drawer_type}`} data-drawer-type={object.drawer_type} role="dialog" aria-modal="true" aria-labelledby="drawer-title"><header><div><p className="eyebrow green">{DESTINATION_META[object.destination].eyebrow} — Deep Dive</p><h2 id="drawer-title">{object.display_payload.title}</h2>{object.display_payload.value && <p>{object.display_payload.value}</p>}</div><button type="button" className="drawer-close" onClick={close} aria-label="Close deep dive">×</button></header><div className="drawer-status"><span>{CLASS_LABELS[object.epistemic_class] || object.epistemic_class}</span>{object.confidence && <b>Confidence · {humanizeConfidence(object.confidence)}</b>}</div><div className="drawer-sections">{object.drawer_payload.map((section, index) => <section key={section.id} data-section-id={section.id}><p className="eyebrow violet">{String.fromCharCode(65 + index)}. {section.title}</p>{section.items.length === 1 ? <p>{humanizeCustomerText(section.items[0])}</p> : <ul>{section.items.map((item) => <li key={item}>{humanizeCustomerText(item)}</li>)}</ul>}</section>)}</div><footer><span>▢</span>Layer 2 reveals accepted intelligence only. Nothing is regenerated here.<button type="button" onClick={close}>Back to {DESTINATION_META[object.destination].eyebrow}</button></footer></aside></div>
}

function LocalDisclosure({ type, close }) {
  const content = type === 'how' ? ['How this works', 'Layer 0 gives the answer. Layer 1 helps you understand it. Layer 2 lets you investigate the evidence. The experience stops there.'] : type === 'living' ? ['What a Living Map would mean', 'A future Living Map could revisit this frozen snapshot as accepted business evidence changes. This local lab does not activate, subscribe, track, or update anything.'] : ['Build the rest yourself', 'Ways 2 and 3 are intentionally open. They are product sockets, not invented strategies. This control performs no save or activation.']
  return <div className="local-disclosure" role="dialog" aria-modal="true" aria-labelledby="local-title"><button type="button" className="drawer-scrim" onClick={close} aria-label="Close explanation" /><article><button type="button" onClick={close} aria-label="Close explanation">×</button><p className="eyebrow blue">Local explanation</p><h2 id="local-title">{content[0]}</h2><p>{content[1]}</p><ActionButton onClick={close}>Return to the map</ActionButton></article></div>
}

export default function BusinessTwinApp({ viewModel }) {
  const [active, setActive] = useState('overview')
  const [drawerObjectId, setDrawerObjectId] = useState(null)
  const [drawerContext, setDrawerContext] = useState(null)
  const [disclosure, setDisclosure] = useState(null)
  const returnState = useRef(null)
  const drawerObject = useMemo(() => {
    const sourceObject = drawerObjectId ? viewModel.objects[drawerObjectId] : null
    if (!sourceObject || !drawerContext?.displayValue) return sourceObject
    return { ...sourceObject, display_payload: { ...sourceObject.display_payload, value: drawerContext.displayValue } }
  }, [drawerContext, drawerObjectId, viewModel])

  function navigate(destination) { setDrawerObjectId(null); setDrawerContext(null); setDisclosure(null); setActive(destination); globalThis.dispatchEvent(new CustomEvent('ba-pd:destination', { detail: destination })); globalThis.scrollTo({ top: 0, behavior: 'auto' }) }
  function openObject(objectId, trigger, context = null) { if (!viewModel.objects[objectId]) return; returnState.current = { y: globalThis.scrollY, trigger: trigger || document.activeElement }; setDrawerContext(context); setDrawerObjectId(objectId); document.body.classList.add('drawer-open') }
  function closeDrawer() { const state = returnState.current; setDrawerObjectId(null); setDrawerContext(null); document.body.classList.remove('drawer-open'); requestAnimationFrame(() => { globalThis.scrollTo({ top: state?.y || 0, behavior: 'auto' }); state?.trigger?.focus?.() }) }
  function openLocalDisclosure(type) { setDisclosure(type) }

  useEffect(() => {
    const handler = (event) => navigate(event.detail)
    globalThis.addEventListener('ba-pd:navigate', handler)
    return () => globalThis.removeEventListener('ba-pd:navigate', handler)
  }, [])

  if (active === 'overview') return <><Overview viewModel={viewModel} navigate={navigate} openObject={openObject} onHow={() => openLocalDisclosure('how')} />{drawerObject && <Drawer object={drawerObject} close={closeDrawer} />}{disclosure && <LocalDisclosure type={disclosure} close={() => setDisclosure(null)} />}</>
  const page = viewModel.destinations[active]
  return <div className="app-shell"><SideRail viewModel={viewModel} active={active} navigate={navigate} /><div className="page-column"><PageHeader viewModel={viewModel} onHow={() => openLocalDisclosure('how')} />{active === 'where' && <WherePage page={page} openObject={openObject} />}{active === 'futures' && <FuturesPage page={page} openObject={openObject} />}{active === 'move' && <MovePage page={page} openObject={openObject} navigate={navigate} />}{active === 'plan' && <PlanPage page={page} openObject={openObject} openLocalDisclosure={openLocalDisclosure} navigate={navigate} />}{active === 'evidence' && <EvidencePage page={page} openObject={openObject} livingMap={viewModel.livingMap} openLocalDisclosure={openLocalDisclosure} />}</div>{drawerObject && <Drawer object={drawerObject} close={closeDrawer} />}{disclosure && <LocalDisclosure type={disclosure} close={() => setDisclosure(null)} />}</div>
}
