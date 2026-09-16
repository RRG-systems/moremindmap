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

const DEFAULT_PRESENTATION = Object.freeze({
  brandAria: 'MORE MindMap', brandTop: 'MORE', brandBottom: 'MINDMAP', railKicker: 'Business Assessment', navAria: 'Business Twin destinations',
  boundaryTitle: 'Frozen assessment', boundaryCopy: 'This map changes only when accepted business evidence changes.', backLabel: '← Back to Business Twin',
  overviewAria: 'Your Business Twin destinations', bigPictureLabel: 'The Big Picture', bigPictureAria: 'Investigate the two strongest future paths',
  nextStepLabel: 'Your Next Step', startPlanLabel: 'Start the plan', snapshotTitle: 'This is a frozen business snapshot.', snapshotCopy: 'It reflects the accepted evidence available at the model date.',
  pathwayEyebrow: 'From today to your goal', pathwayIntro: 'A simple view of where you are, where you want to go, and what the goal requires.',
  pathwayLabels: { today: 'Today', goal: 'Your Goal', required: 'Business Required' },
  pathwayCaptions: { today: 'What you have now', goal: 'What you want to achieve', required: 'Goal-supporting model' },
  realitiesLabel: 'What MORE sees', realitiesCopy: 'The three critical realities shaping your business.', gapLabel: 'The Gap', whatsNextLabel: 'What’s next?',
  currentScenario: 'Current business state', moveScenario: 'If the One Move works', currentOdds: 'Current Odds', moveOdds: 'If the One Move Works',
  futuresChartNote: 'Probabilities always sum to 100%. Confidence reflects the quality and completeness of accepted evidence.', futuresCenterTop: '100%', futuresCenterBottom: 'Total probability',
  selectedFuture: 'Selected Future', probabilityLabel: 'Probability', futureTabs: ['What this looks like', 'Why this is possible', 'What would change it'],
  futurePanelHeadings: ['What this future requires', 'Signals supporting this path', 'Signals that would change this path'], futureCharacteristics: 'Key characteristics',
  moveWhy: 'Why this move?', moveProof: 'We’ll know it’s working when…', moveProofIcon: '✓', moveStart: 'Start Here', moveStartAction: 'Start My One Move', moveDeepTitle: 'Why MORE chose this move', moveDeepCopy: 'See the deeper intelligence and evidence behind this recommendation.', moveDeepAction: 'Open deep dive',
  planGoalLabel: 'The 1 — Your Goal', planWaysLabel: 'The 3 — Three ways to get there', planStrategiesLabel: 'The 5 — Strategies for Way 1', planWayBuilt: 'Built by MORE', planWayOpen: 'Open', planOpenCopy: 'A complete 1–3–5 gives you another strategic path to the goal.',
  planMoveLabel: 'Your One Move Experiment', planMoveAction: 'Review My One Move', planWayMappedIcon: '✓', planProgressLabel: 'Your 1–3–5 so far', planProgress: ['✓ 1 Goal', '✓ Way 1 + Five Strategies', '○ Way 2 + Five Strategies', '○ Way 3 + Five Strategies'], planProgressDoneCount: 2,
  planCompleteLabel: 'Complete the map', planBuildAction: 'Build the rest myself', planLivingAction: 'Make My Map Alive →', planLivingCopy: 'Work with MORE to complete your full 1–3–5 and keep it current as your business changes.',
  evidenceLedger: 'Evidence Ledger', evidenceHeaders: ['Business reality', 'Value / finding', 'What it is', 'Confidence'], evidenceUseBasis: false, evidenceBuildLabel: 'How MORE built your Business Twin', evidenceBuildFlow: ['Your answers', 'Business reality', 'Business model', 'Five Futures', 'One Move', '1–3–5 Plan'],
  evidenceCoverage: 'Evidence coverage map', evidenceTrace: 'Trace your Business Twin', evidenceTraceAction: 'Trace this intelligence →', counterevidence: 'Counterevidence', mindChange: 'What would change our mind', evidenceKey: 'Evidence quality key', missingLabel: 'Highest-value missing evidence', missingCopy: 'These are the current evidence gaps most likely to sharpen this frozen map.', livingLabel: 'Frozen Map → Living Map',
  drawerSuffix: 'Deep Dive', drawerFooter: 'Layer 2 reveals accepted intelligence only. Nothing is regenerated here.',
  howCopy: 'Layer 0 gives the answer. Layer 1 helps you understand it. Layer 2 lets you investigate the evidence. The experience stops there.',
  livingTitle: 'What a Living Map would mean', livingCopy: 'A future Living Map could revisit this frozen snapshot as accepted business evidence changes. This local lab does not activate, subscribe, track, or update anything.',
  buildTitle: 'Build the rest yourself', buildCopy: 'Ways 2 and 3 are intentionally open. They are product sockets, not invented strategies. This control performs no save or activation.', returnLabel: 'Return to the map',
})

function presentationOf(viewModel) {
  return { ...DEFAULT_PRESENTATION, ...(viewModel.presentation || {}), pathwayLabels: { ...DEFAULT_PRESENTATION.pathwayLabels, ...(viewModel.presentation?.pathwayLabels || {}) }, pathwayCaptions: { ...DEFAULT_PRESENTATION.pathwayCaptions, ...(viewModel.presentation?.pathwayCaptions || {}) } }
}

function MoreMark({ presentation = DEFAULT_PRESENTATION }) {
  return <div className="more-mark" aria-label={presentation.brandAria}><span aria-hidden="true">✧</span><strong>{presentation.brandTop}<br />{presentation.brandBottom}</strong></div>
}

function ActionButton({ className = '', children, onClick, ariaLabel }) {
  return <button type="button" className={`text-action ${className}`} onClick={onClick} aria-label={ariaLabel}>{children}<span aria-hidden="true">→</span></button>
}

function Clickable({ objectId, openObject, className = '', children, ariaLabel }) {
  return <button type="button" className={`clickable-card ${className}`} onClick={(event) => openObject(objectId, event.currentTarget)} aria-label={ariaLabel}>{children}</button>
}

function SideRail({ viewModel, active, navigate }) {
  const presentation = presentationOf(viewModel)
  return (
    <aside className="side-rail">
      <MoreMark presentation={presentation} />
      <p className="rail-kicker">{presentation.railKicker}</p>
      <button type="button" className={`rail-overview ${active === 'overview' ? 'active' : ''}`} onClick={() => navigate('overview')}><span>⌂</span>Overview</button>
      <nav aria-label={presentation.navAria}>
        {viewModel.nav.map((item) => <button type="button" key={item.id} className={`rail-link ${active === item.id ? 'active' : ''}`} data-tone={DESTINATION_META[item.id].color} onClick={() => navigate(item.id)}><span>{item.order}</span>{item.label}</button>)}
      </nav>
      <div className="rail-person"><span>{viewModel.identity.firstName.slice(0, 1)}</span><div><strong>{viewModel.identity.firstName}</strong><small>{viewModel.identity.vertical}</small></div></div>
      <div className="rail-boundary"><span aria-hidden="true">▢</span><div><strong>{presentation.boundaryTitle}</strong><small>{presentation.boundaryCopy}</small></div></div>
    </aside>
  )
}

function PageHeader({ viewModel, onHow }) {
  const presentation = presentationOf(viewModel)
  return <header className="page-header"><button type="button" className="back-link" onClick={() => globalThis.dispatchEvent(new CustomEvent('ba-pd:navigate', { detail: 'overview' }))}>{presentation.backLabel}</button><button type="button" className="how-button" onClick={onHow}>How this works <span>ⓘ</span></button><span className="model-date">{viewModel.hero.modelDate}</span></header>
}

function Layer0CardBody({ card }) {
  if (card.id === 'where') return <>
    <p className="door-description">{card.description}</p>
    <div className="door-primary-stat"><strong>{card.value}</strong><span>{card.qualifier}</span></div>
    <div className="door-fact-list">{card.details.map((item) => <div key={`${item.label}-${item.value}`}><strong>{item.value}</strong><span>{item.label}</span>{item.epistemicClass === 'MODELED_REQUIREMENT' && <small>Goal-supporting model</small>}</div>)}</div>
  </>
  if (card.id === 'futures') return <>
    <p className="door-description">{card.description}</p>
    <div className="mini-futures">{card.items.map((item) => <div key={item.label}><strong>{item.displayValue || item.probability}{!item.displayValue && <small>%</small>}</strong><span>{item.label}</span>{!item.displayValue && <i aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <b key={index} className={index < Math.ceil(item.probability / 5) ? 'filled' : ''} />)}</i>}</div>)}</div>
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
  const presentation = presentationOf(viewModel)
  return (
    <main className="overview" data-layer="0">
      <header className="overview-header"><MoreMark presentation={presentation} /><button type="button" className="how-button" onClick={onHow}>How this works <span>ⓘ</span></button></header>
      <p className="eyebrow green">{viewModel.hero.eyebrow}</p>
      <h1>{viewModel.hero.title}</h1>
      <p className="hero-subtitle">{viewModel.hero.subtitle}</p>
      <section className="destination-grid" aria-label={presentation.overviewAria}>
        {cards.map((card, index) => <article className={`destination-card tone-${DESTINATION_META[card.id].color}`} key={card.id}>
          <span className="card-order">{index + 1}</span>
          <p className="eyebrow">{card.title}</p>
          <Layer0CardBody card={card} />
          <ActionButton onClick={() => navigate(card.id)} ariaLabel={`Open ${card.title}`}>{card.cta}</ActionButton>
        </article>)}
      </section>
      <Clickable objectId={cards[1].objectId} openObject={openObject} className="overview-callout big-picture" ariaLabel={presentation.bigPictureAria}>
        <span className="callout-icon">✦</span><div><p className="eyebrow violet">{presentation.bigPictureLabel}</p><h2>{viewModel.layer0.bigPicture}</h2><p>{viewModel.layer0.bigPictureQualifier}</p></div><b>→</b>
      </Clickable>
      <section className="overview-callout next-step"><span className="callout-icon">✓</span><div><p className="eyebrow blue">{presentation.nextStepLabel}</p><h2>{viewModel.layer0.nextStep}</h2><p>{viewModel.layer0.nextStepQualifier}</p></div><ActionButton className="primary" onClick={() => navigate('plan')}>{presentation.startPlanLabel}</ActionButton></section>
      <footer className="snapshot-boundary"><span>▢</span><div><strong>{presentation.snapshotTitle}</strong><p>{presentation.snapshotCopy}</p></div></footer>
    </main>
  )
}

function WherePage({ page, openObject, presentation }) {
  const metricIcons = ['♧', '♙', '☆', '⌾']
  if (page.mode === 'athlete_three_current_reality_domains') return <div className="surface where-surface athlete-three-domain-surface" data-layer="1" data-destination="where">
    <p className="eyebrow green">{page.eyebrow}</p><h1>{page.headline}</h1><p className="surface-subhead">{page.subhead}</p>
    <section className="athlete-domain-grid" aria-label="Three current-reality domains">{page.domains.map((domain, index) => <Clickable key={domain.objectId} objectId={domain.objectId} openObject={openObject} className={`athlete-domain-card domain-${domain.key}`} ariaLabel={`Explore ${domain.label}`}><span className="athlete-domain-order">0{index + 1}</span><p className="eyebrow green">{domain.label}</p><h2>{domain.headline}</h2><p>{domain.text}</p><div className="athlete-domain-sources"><strong>{domain.claimCount} source-bound items</strong><small>{domain.sourceLabels.join(' · ')}</small></div><b>{domain.status}</b></Clickable>)}</section>
    <section className="panel athlete-box1-truth"><div><p className="eyebrow green">The truth underneath</p><h2>{page.underlyingClaimCount} current-reality items remain intact.</h2><p>Athlete report, instructor report, instructor observation, explicit agreement, and qualified records stay separate. Nothing is averaged into a score.</p><div className="athlete-source-pills">{page.sourceLabels.map((label) => <span key={label}>{label}</span>)}</div></div><div><p className="eyebrow amber">What remains open</p><h2>{page.openReality.headline}</h2><p>{page.openReality.text}</p><small>{page.openReality.summary}</small></div></section>
    <section className="panel entrance-panel"><p className="eyebrow green">Inspect the evidence</p><div>{page.entrances.map((entry) => <ActionButton key={entry.label} onClick={() => openObject(entry.objectId)}>{entry.label}</ActionButton>)}</div></section>
    <footer className="athlete-box1-hypothesis-boundary"><span>▢</span><p>{page.boundary}</p></footer>
  </div>
  return <div className="surface where-surface" data-layer="1" data-destination="where">
    <p className="eyebrow green">{page.eyebrow}</p><h1>{page.headline}</h1><p className="surface-subhead">{page.subhead}</p>
    <section className="headline-metrics">{page.metrics.map((metric, index) => <Clickable key={metric.objectId} objectId={metric.objectId} openObject={openObject} className="metric-card"><i aria-hidden="true">{metricIcons[index]}</i><strong>{metric.value}</strong><span>{metric.title}</span><small>{metric.qualifier}</small></Clickable>)}</section>
    <section className="panel pathway-panel"><p className="eyebrow green">{presentation.pathwayEyebrow}</p><p>{presentation.pathwayIntro}</p><div className="pathway-grid">
      {Object.entries(page.pathway).map(([key, items], index) => <React.Fragment key={key}><div className={`pathway-column ${key}`}><p className="eyebrow">{presentation.pathwayLabels[key]}</p><small className="pathway-caption">{presentation.pathwayCaptions[key]}</small>{items.map((item) => <Clickable key={item.objectId} objectId={item.objectId} openObject={openObject} className="pathway-item"><strong>{item.value}</strong><span>{item.title}</span><small>{item.qualifier}</small></Clickable>)}</div>{index < 2 && <span className="path-arrow">→</span>}</React.Fragment>)}
    </div></section>
    <section className="panel"><p className="eyebrow green">{presentation.realitiesLabel}</p><p>{presentation.realitiesCopy}</p><div className="reality-grid">{page.realities.map((item) => <Clickable key={item.objectId} objectId={item.objectId} openObject={openObject} className="reality-card"><span>◎</span><strong>{item.title}</strong><p>{item.text}</p><small>Explore this intelligence →</small></Clickable>)}</div></section>
    <section className="panel gap-panel"><div><p className="eyebrow green">{presentation.gapLabel}</p><h2>{page.gap}</h2></div><span className="large-icon">↗</span></section>
    <section className="panel entrance-panel"><p className="eyebrow green">{presentation.whatsNextLabel}</p><div>{page.entrances.map((entry) => <ActionButton key={entry.label} onClick={() => openObject(entry.objectId)}>{entry.label}</ActionButton>)}</div></section>
  </div>
}

function FuturesPage({ page, openObject, presentation }) {
  const [scenario, setScenario] = useState('current')
  const [detailTab, setDetailTab] = useState('looks')
  const items = scenario === 'current' ? page.items : page.items.map((item) => {
    const scenarioValue = page.ifMoveWorks.find((future) => future.role === item.role)
    return page.displayMode === 'qualitative'
      ? { ...item, layoutWeight: scenarioValue.layoutWeight, displayValue: scenarioValue.displayValue }
      : { ...item, probability: scenarioValue.probability }
  })
  const [selectedRole, setSelectedRole] = useState(items[0].role)
  const selected = items.find((item) => item.role === selectedRole) || items[0]
  const stops = []
  const labels = []
  let total = 0
  for (const item of items) {
    const start = total
    const geometryValue = item.layoutWeight ?? item.probability
    total += geometryValue
    stops.push(`var(--future-${item.role}) ${start}% ${total}%`)
    const angle = ((start + geometryValue / 2) / 100) * Math.PI * 2 - Math.PI / 2
    labels.push({ role: item.role, value: item.probability, x: 50 + Math.cos(angle) * 35, y: 50 + Math.sin(angle) * 35 })
  }
  const confidenceLevel = String(selected.confidence || '').replaceAll('_', ' ').toLowerCase().replace(/^./u, (letter) => letter.toUpperCase())
  const confidenceDots = /high/iu.test(selected.confidence) ? 5 : /low/iu.test(selected.confidence) ? 3 : 4
  return <div className="surface futures-surface" data-layer="1" data-destination="futures">
    <p className="eyebrow violet">{page.eyebrow}</p><h1>{page.headline}</h1><p className="surface-subhead">{page.subhead}</p>
    <div className="scenario-toggle" role="group" aria-label="Future scenario"><button type="button" className={scenario === 'current' ? 'active' : ''} onClick={() => setScenario('current')}>{presentation.currentScenario}</button><button type="button" className={scenario === 'move' ? 'active' : ''} onClick={() => setScenario('move')}>{presentation.moveScenario}</button></div>
    <section className={`futures-layout${page.displayMode === 'qualitative' ? ' futures-qualitative' : ''}`}><div className="panel futures-chart"><p className="eyebrow violet">{scenario === 'current' ? presentation.currentOdds : presentation.moveOdds}</p><div className="donut" style={{ background: `conic-gradient(${stops.join(',')})` }}>{labels.map((label) => <span className="donut-label" key={label.role} style={{ left: `${label.x}%`, top: `${label.y}%` }}>{items.find((item) => item.role === label.role)?.displayValue || `${label.value}%`}</span>)}<span className="donut-center"><strong>{page.displayMode === 'qualitative' ? (page.centerTop || '5 paths') : presentation.futuresCenterTop}</strong>{page.displayMode === 'qualitative' ? (page.centerBottom || 'Conditional') : presentation.futuresCenterBottom}</span></div><small>{page.chartNote || presentation.futuresChartNote}</small></div>
      <div className="panel future-list">{items.map((item) => <button type="button" key={item.role} className={selected.role === item.role ? 'selected' : ''} data-future={item.role} onClick={() => setSelectedRole(item.role)}><i /><div><strong>{item.label}</strong><span>{item.meaning}</span></div><b>{item.displayValue || `${item.probability}%`}</b><small>{String(item.confidence).replaceAll('_', ' ').toLowerCase().replace(/^./u, (letter) => letter.toUpperCase())} confidence</small></button>)}</div>
      <article className="panel selected-future"><p className="eyebrow violet">{presentation.selectedFuture}</p><header><h2>{selected.label}</h2><div className="future-probability"><strong>{selected.displayValue || `${selected.probability}%`}</strong><small>{page.displayMode === 'qualitative' ? (page.valueLabel || 'Evidence posture') : presentation.probabilityLabel}</small></div><div className="future-confidence"><span>{confidenceLevel} confidence</span><i>{Array.from({ length: 7 }, (_, index) => <b className={index < confidenceDots ? 'filled' : ''} key={index} />)}</i></div></header><p>{selected.summary}</p><div className="future-tabs" role="tablist" aria-label="Selected future details"><button type="button" role="tab" aria-selected={detailTab === 'looks'} className={detailTab === 'looks' ? 'active' : ''} onClick={() => setDetailTab('looks')}>{presentation.futureTabs[0]}</button><button type="button" role="tab" aria-selected={detailTab === 'possible'} className={detailTab === 'possible' ? 'active' : ''} onClick={() => setDetailTab('possible')}>{presentation.futureTabs[1]}</button><button type="button" role="tab" aria-selected={detailTab === 'change'} className={detailTab === 'change' ? 'active' : ''} onClick={() => setDetailTab('change')}>{presentation.futureTabs[2]}</button></div><div className="future-conditions" role="tabpanel"><h3>{presentation.futurePanelHeadings[detailTab === 'looks' ? 0 : detailTab === 'possible' ? 1 : 2]}</h3>{detailTab === 'looks' ? <p>{selected.condition}</p> : <ul>{(detailTab === 'possible' ? selected.supporting : selected.falsifiers).map((item) => <li key={item}>{item}</li>)}</ul>}</div><div className="future-characteristics"><p className="eyebrow">{presentation.futureCharacteristics}</p><ul>{selected.keyCharacteristics.map((item) => <li key={item}>{item}</li>)}</ul></div><ActionButton onClick={(event) => openObject(selected.objectId, event.currentTarget, { displayValue: selected.displayValue || `${selected.probability}%` })}>Explore this Future in depth</ActionButton></article>
    </section>
  </div>
}

function MovePage({ page, openObject, navigate, presentation }) {
  return <div className="surface move-surface" data-layer="1" data-destination="move">
    <p className="eyebrow amber">{page.eyebrow}</p><h1>{page.headline}</h1><p className="surface-subhead move-intro">{page.subhead}</p>
    <section className="move-logic">{page.logic.map((item, index) => <React.Fragment key={item.objectId}><Clickable objectId={item.objectId} openObject={openObject} className={`move-node node-${index + 1}`}><p className="eyebrow">{item.label}</p><span className="node-icon">{['♙', '↻', '⌾', '✓'][index]}</span><h2>{item.value}</h2>{item.description && <p className="node-description">{item.description}</p>}</Clickable>{index < page.logic.length - 1 && <span className="logic-arrow">→</span>}</React.Fragment>)}</section>
    <h2 className="section-title">{presentation.moveWhy}</h2><section className="three-grid">{page.reasons.map((item) => <Clickable key={item.objectId} objectId={item.objectId} openObject={openObject} className="reason-card"><span className="reason-icon">◇</span><h3>{item.title}</h3><p>{item.text}</p></Clickable>)}</section>
    <h2 className="section-title">{presentation.moveProof}</h2><section className="four-grid">{page.proof.map((item) => <Clickable key={item.objectId} objectId={item.objectId} openObject={openObject} className="proof-card"><span>{presentation.moveProofIcon}</span><h3>{item.label}</h3></Clickable>)}</section>
    <section className="start-card"><span className="callout-icon">⚑</span><div><p className="eyebrow violet">{presentation.moveStart}</p><h2>{page.startHere.text}</h2><p>{page.startHere.qualifier}</p></div><ActionButton className="primary violet-button" onClick={() => navigate('plan')}>{presentation.moveStartAction}</ActionButton></section>
    <section className="deep-entrance"><span>?</span><div><strong>{presentation.moveDeepTitle}</strong><p>{presentation.moveDeepCopy}</p></div><ActionButton onClick={() => openObject(page.deepDiveObjectId)}>{presentation.moveDeepAction}</ActionButton></section>
  </div>
}

function PlanPage({ page, openObject, openLocalDisclosure, navigate, presentation }) {
  return <div className="surface plan-surface" data-layer="1" data-destination="plan">
    <p className="eyebrow blue">{page.eyebrow}</p><h1>{page.headline}</h1><p className="surface-subhead">{page.subhead}</p>
    <section className="goal-banner"><span>⌾</span><div><p>{presentation.planGoalLabel}</p><h2>{page.goal.display || <>{page.goal.annual && <><b>{page.goal.annual}</b> {page.goal.annualLabel}</>}{page.goal.annual && page.goal.monthly && <i> | </i>}{page.goal.monthly && <><b>{page.goal.monthly}</b> {page.goal.monthlyLabel}</>}</>}</h2></div></section>
    <p className="eyebrow blue plan-label">{presentation.planWaysLabel}</p><section className="way-grid">{page.ways.map((way, index) => {
      const isMapped = way.status === 'SELECTED_COMPLETE' || way.status === 'MAPPED_NOT_ACCEPTED'
      return <article key={index} className={`way-card ${isMapped ? 'selected' : 'open'}`}><span className="way-check">{isMapped ? presentation.planWayMappedIcon : '○'}</span><p>Way {index + 1} — {isMapped ? presentation.planWayBuilt : presentation.planWayOpen}</p><h2>{way.title || `Your ${index === 1 ? 'Second' : 'Third'} Way`}</h2><p>{way.destinationState || presentation.planOpenCopy}</p>{way.status === 'OPEN' && <div className="open-lines">1. ______<br />2. ______<br />3. ______<br />4. ______<br />5. ______</div>}</article>
    })}</section>
    <p className="eyebrow blue plan-label">{presentation.planStrategiesLabel}</p><section className="strategy-list">{page.strategies.map((strategy) => <Clickable key={strategy.objectId} objectId={strategy.objectId} openObject={openObject} className="strategy-row"><b>{String(strategy.order).padStart(2, '0')}</b><span className="strategy-icon">◎</span><div><small>{strategy.title}</small><h3>{strategy.headline}</h3>{strategy.supportingText && <p>{strategy.supportingText}</p>}{strategy.flow?.length > 0 && <div className="strategy-flow">{strategy.flow.map((item, index) => <React.Fragment key={item}><span>{item}</span>{index < strategy.flow.length - 1 && <i>→</i>}</React.Fragment>)}</div>}</div><span>›</span></Clickable>)}</section>
    <section className="plan-move"><span>⌾</span><div><p className="eyebrow amber">{presentation.planMoveLabel}</p><h2>{page.oneMove.title}</h2><p>{page.oneMove.intervention}</p><small>{page.oneMove.whyAlongside}</small></div><ActionButton onClick={() => navigate('move')}>{presentation.planMoveAction}</ActionButton></section>
    <section className="plan-completion"><div><p className="eyebrow blue">{presentation.planProgressLabel}</p><ul>{presentation.planProgress.map((item, index) => <li key={item} className={index < presentation.planProgressDoneCount ? 'done' : ''}>{item}</li>)}</ul></div><div><p className="eyebrow blue">{presentation.planCompleteLabel}</p><button type="button" onClick={() => openLocalDisclosure('build')}>{presentation.planBuildAction}</button><button type="button" className="primary" onClick={() => openLocalDisclosure('living')}>{presentation.planLivingAction}</button><small>{presentation.planLivingCopy}</small></div></section>
  </div>
}

function EvidencePage({ page, openObject, livingMap, openLocalDisclosure, presentation }) {
  const [filter, setFilter] = useState('ALL')
  const rows = filter === 'ALL' ? page.ledger : page.ledger.filter((row) => (CLASS_LABELS[row.status] || row.status).toUpperCase() === filter)
  return <div className="surface evidence-surface" data-layer="1" data-destination="evidence">
    <p className="eyebrow teal">{page.eyebrow}</p><h1>{page.headline}</h1><p className="surface-subhead">{page.subhead}</p>
    <section className="evidence-summary">{page.categories.map((category) => <Clickable key={category.objectId} objectId={category.objectId} openObject={openObject} className={`evidence-stat ${category.id}`}><strong>{category.value}</strong><span>{category.label}</span><small>{category.summary}</small></Clickable>)}</section>
    <div className="evidence-filters" role="group" aria-label="Evidence filters">{['ALL', 'KNOWN', 'CALCULATED', 'INFERRED', 'MODELED', 'MISSING', 'CONTRADICTED'].map((item) => <button type="button" key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div>
    <section className="panel ledger"><h2>{presentation.evidenceLedger}</h2><div className="ledger-table" role="table"><div className="ledger-head" role="row">{presentation.evidenceHeaders.map((item) => <span key={item}>{item}</span>)}</div>{rows.map((row) => <Clickable key={row.id} objectId={row.objectId} openObject={openObject} className="ledger-row"><span>{row.reality}</span><strong>{row.value}</strong><span className={`status status-${(CLASS_LABELS[row.status] || row.status).toLowerCase()}`}>{presentation.evidenceUseBasis && row.basis ? row.basis : CLASS_LABELS[row.status] || row.status}</span><small>{row.confidence}</small></Clickable>)}</div></section>
    <section className="evidence-lower"><article className="panel"><p className="eyebrow blue">{presentation.evidenceBuildLabel}</p><div className="build-flow">{presentation.evidenceBuildFlow.map((item, index) => <React.Fragment key={item}><span>{item}</span>{index < presentation.evidenceBuildFlow.length - 1 && <>→</>}</React.Fragment>)}</div></article><article className="panel coverage"><p className="eyebrow blue">{presentation.evidenceCoverage}</p>{page.coverage.map((item) => <div key={item.territory}><span>{item.territory}</span><b>{item.confidence}</b><small>{item.known} known · {item.inferred} inferred · {item.missing} missing</small></div>)}</article></section>
    <section className="truth-columns">{page.truthColumns.map((column) => <article className="panel" key={column.label}><p className="eyebrow violet">{column.label}</p><h2>{column.title}</h2><ul>{column.items.map((item) => <li key={item}>{item}</li>)}</ul></article>)}</section>
    <section className="panel evidence-trace"><p className="eyebrow blue">{presentation.evidenceTrace}</p><div>{page.traceCards.map((item) => <Clickable key={item.objectId} objectId={item.objectId} openObject={openObject} className={`trace-card trace-${item.tone}`}><small>{item.label}</small><h3>{item.title}</h3><p>{item.summary}</p><b>{presentation.evidenceTraceAction}</b></Clickable>)}</div></section>
    <section className="evidence-lower"><article className="panel"><p className="eyebrow violet">{presentation.counterevidence}</p><ul>{page.counterevidence.slice(0, 5).map((item) => <li key={item}>{item}</li>)}</ul><p className="eyebrow amber">{presentation.mindChange}</p><ul>{page.mindChanges.slice(0, 5).map((item) => <li key={item}>{item}</li>)}</ul></article><article className="panel"><p className="eyebrow blue">{presentation.evidenceKey}</p><dl className="quality-key">{page.qualityKey.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.meaning}</dd></div>)}</dl></article></section>
    <section className="panel missing-evidence"><p className="eyebrow amber">{presentation.missingLabel}</p><p>{presentation.missingCopy}</p><ul>{page.highestValueMissing.map((item) => <li key={item}>{item}</li>)}</ul></section>
    <section className="living-map"><span>✦</span><div><p className="eyebrow teal">{presentation.livingLabel}</p><h2>{livingMap.headline}</h2><p>{livingMap.copy}</p></div><button type="button" onClick={() => openLocalDisclosure('living')}>{livingMap.action || 'See what this means'} →</button></section>
  </div>
}

function Drawer({ object, close, presentation }) {
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
  return <div className="drawer-layer" data-layer="2"><button type="button" className="drawer-scrim" aria-label="Close deep dive" onClick={close} /><aside ref={panelRef} className={`intelligence-drawer drawer-${object.drawer_type}`} data-drawer-type={object.drawer_type} role="dialog" aria-modal="true" aria-labelledby="drawer-title"><header><div><p className="eyebrow green">{DESTINATION_META[object.destination].eyebrow} — {presentation.drawerSuffix}</p><h2 id="drawer-title">{object.display_payload.title}</h2>{object.display_payload.value && <p>{object.display_payload.value}</p>}</div><button type="button" className="drawer-close" onClick={close} aria-label="Close deep dive">×</button></header><div className="drawer-status"><span>{CLASS_LABELS[object.epistemic_class] || object.epistemic_class}</span>{object.confidence && <b>Confidence · {object.confidence}</b>}</div><div className="drawer-sections">{object.drawer_payload.map((section, index) => <section key={section.id} data-section-id={section.id}><p className="eyebrow violet">{String.fromCharCode(65 + index)}. {section.title}</p>{section.items.length === 1 ? <p>{section.items[0]}</p> : <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}</section>)}</div><footer><span>▢</span>{presentation.drawerFooter}<button type="button" onClick={close}>Back to {DESTINATION_META[object.destination].eyebrow}</button></footer></aside></div>
}

function LocalDisclosure({ type, close, presentation }) {
  const articleRef = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    document.body.classList.add('drawer-open')
    const controls = articleRef.current?.querySelectorAll('button') || []
    controls[0]?.focus()
    function onKey(event) {
      if (event.key === 'Escape') close()
      if (event.key !== 'Tab' || controls.length < 2) return
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls[controls.length - 1].focus() }
      if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) { event.preventDefault(); controls[0].focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('drawer-open'); previous?.focus?.({ preventScroll: true }) }
  }, [close])
  const content = type === 'how' ? ['How this works', presentation.howCopy] : type === 'living' ? [presentation.livingTitle, presentation.livingCopy] : [presentation.buildTitle, presentation.buildCopy]
  return <div className="local-disclosure" role="dialog" aria-modal="true" aria-labelledby="local-title"><button type="button" className="drawer-scrim" onClick={close} aria-label="Close explanation" /><article ref={articleRef}><button type="button" onClick={close} aria-label="Close explanation">×</button><p className="eyebrow blue">{presentation.explanationEyebrow || 'Local explanation'}</p><h2 id="local-title">{content[0]}</h2><p>{content[1]}</p><ActionButton onClick={close}>{presentation.returnLabel}</ActionButton></article></div>
}

export default function BusinessTwinApp({ viewModel, onContextChange = null, pageComponent: CustomPage = null, pageProps = {} }) {
  const presentation = presentationOf(viewModel)
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

  function navigate(destination) { document.body.classList.remove('drawer-open'); setDrawerObjectId(null); setDrawerContext(null); setDisclosure(null); setActive(destination); globalThis.scrollTo({ top: 0, behavior: 'auto' }) }
  function openObject(objectId, trigger, context = null) { if (!viewModel.objects[objectId]) return; returnState.current = { y: globalThis.scrollY, trigger: trigger || document.activeElement }; setDrawerContext(context); setDrawerObjectId(objectId); document.body.classList.add('drawer-open') }
  function closeDrawer() { const state = returnState.current; setDrawerObjectId(null); setDrawerContext(null); document.body.classList.remove('drawer-open'); requestAnimationFrame(() => { globalThis.scrollTo({ top: state?.y || 0, behavior: 'auto' }); state?.trigger?.focus?.({ preventScroll: true }) }) }
  function openLocalDisclosure(type) { setDisclosure(type) }

  useEffect(() => {
    const handler = (event) => navigate(event.detail)
    globalThis.addEventListener('ba-pd:navigate', handler)
    return () => globalThis.removeEventListener('ba-pd:navigate', handler)
  }, [])

  useEffect(() => {
    if (!onContextChange) return
    const visibleObjectIds = drawerObjectId
      ? [drawerObjectId]
      : active === 'overview'
        ? (viewModel.layer0?.cards || []).map((card) => card.objectId).filter(Boolean)
        : Object.values(viewModel.objects || {}).filter((object) => object.destination === active).map((object) => object.object_id)
    onContextChange({
      contract: 'page-context-envelope-v1',
      room: 'YOUR_SPORT',
      destination: active,
      visibleObjectIds,
      stateHash: viewModel.stateHash || viewModel.state_hash || viewModel.realizationIdentity || null,
    })
  }, [active, drawerObjectId, onContextChange, viewModel])

  if (active === 'overview') return <><Overview viewModel={viewModel} navigate={navigate} openObject={openObject} onHow={() => openLocalDisclosure('how')} />{drawerObject && <Drawer object={drawerObject} close={closeDrawer} presentation={presentation} />}{disclosure && <LocalDisclosure type={disclosure} close={() => setDisclosure(null)} presentation={presentation} />}</>
  const page = viewModel.destinations[active]
  const customPage = CustomPage ? <CustomPage {...pageProps} active={active} navigate={navigate} openObject={openObject} viewModel={viewModel} /> : null
  return <div className="app-shell"><SideRail viewModel={viewModel} active={active} navigate={navigate} /><div className="page-column"><PageHeader viewModel={viewModel} onHow={() => openLocalDisclosure('how')} />{customPage || <>{active === 'where' && <WherePage page={page} openObject={openObject} presentation={presentation} />}{active === 'futures' && <FuturesPage page={page} openObject={openObject} presentation={presentation} />}{active === 'move' && <MovePage page={page} openObject={openObject} navigate={navigate} presentation={presentation} />}{active === 'plan' && <PlanPage page={page} openObject={openObject} openLocalDisclosure={openLocalDisclosure} navigate={navigate} presentation={presentation} />}{active === 'evidence' && <EvidencePage page={page} openObject={openObject} livingMap={viewModel.livingMap} openLocalDisclosure={openLocalDisclosure} presentation={presentation} />}</>}</div>{drawerObject && <Drawer object={drawerObject} close={closeDrawer} presentation={presentation} />}{disclosure && <LocalDisclosure type={disclosure} close={() => setDisclosure(null)} presentation={presentation} />}</div>
}
