import { Fragment, useEffect, useMemo, useRef, useState } from 'react'

function Chevron({ direction = 'right' }) {
  return <span className={`chevron chevron--${direction}`} aria-hidden="true">›</span>
}

function Mark() {
  return (
    <svg aria-hidden="true" className="brand-symbol" viewBox="0 0 36 36">
      <path d="M18 2 22 14l12 4-12 4-4 12-4-12-12-4 12-4 4-12Z" fill="none" stroke="currentColor" />
      <circle cx="18" cy="18" r="4" fill="currentColor" />
    </svg>
  )
}

function numericalClassFromQualifier(value = '') {
  const token = String(value).toLowerCase()
  if (token.includes('not measured') || token.includes('not known') || token.includes('unknown') || token.includes('missing')) return 'unknown'
  if (token.includes('goal-supporting') || token.includes('target')) return 'target'
  if (token.includes('benchmark') || token.includes('coaching') || token.includes('standard')) return 'benchmark'
  if (token.includes('modeled') || token.includes('scenario') || token.includes('range')) return 'scenario'
  if (token.includes('calculated') || token.includes('derived') || token.includes('estimate')) return 'calculated'
  return 'current'
}

function NumericalClassBadge({ value, className }) {
  const numericalClass = className || numericalClassFromQualifier(value)
  const labels = {
    current: 'Current / reported',
    calculated: 'Calculated',
    target: 'Goal-supporting target',
    benchmark: 'Coaching benchmark',
    scenario: 'Scenario / modeled range',
    unknown: 'Not yet known',
  }
  return <span className={`number-class number-class--${numericalClass}`} data-number-class={numericalClass}><i aria-hidden="true" />{labels[numericalClass]}</span>
}

function InspectButton({ inspectorId, onInspect, className = '', children, testId, label }) {
  return (
    <button
      type="button"
      className={`inspect-button ${className}`}
      onClick={(event) => onInspect(inspectorId, event.currentTarget)}
      data-testid={testId}
      aria-label={label}
    >
      {children}<Chevron />
    </button>
  )
}

function SectionBar({ number, id, title, description }) {
  return (
    <header className="section-bar">
      <div><span>{number}.</span><h2 id={`${id}-title`}>{title}</h2><p>— {description}</p></div>
      <a href="#top" aria-label={`Back to top from ${title}`}>↑</a>
    </header>
  )
}

function QuickRail({ viewModel, onInspect, onNavigate, activeSection }) {
  return (
    <aside className="quick-rail" aria-label="Business map navigation">
      <div className="rail-mark"><Mark /><strong>MORE<br />MINDMAP</strong></div>
      <p className="rail-kicker">Business Assessment</p>
      <nav>
        {viewModel.nav.map((item) => (
          <button key={item.id} type="button" onClick={() => onNavigate(item.id)} aria-current={activeSection === item.id ? 'location' : undefined}>
            <span>{item.order}</span>{item.label}
          </button>
        ))}
      </nav>
      <div className="rail-facts">
        <p className="rail-kicker">Business signals</p>
        {viewModel.quickFacts.map((metric) => (
          <InspectButton key={metric.id} inspectorId={metric.inspectorId} onInspect={onInspect} className="rail-fact" label={`Explain ${metric.label}`}>
            <span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.qualifier}</small>
          </InspectButton>
        ))}
      </div>
      <div className="rail-footer">
        <span>{viewModel.identity.vertical}</span>
        <b>Frozen assessment</b>
      </div>
    </aside>
  )
}

function TopNavigation({ nav, onNavigate, activeSection }) {
  return (
    <nav className="top-navigation" aria-label="Six business destinations" data-testid="six-destination-nav">
      {nav.map((item) => (
        <button type="button" key={item.id} onClick={() => onNavigate(item.id)} data-testid={`nav-${item.id}`} aria-current={activeSection === item.id ? 'location' : undefined}>
          <span>{item.order}</span><strong>{item.label}</strong><small>{item.description}</small><Chevron />
        </button>
      ))}
    </nav>
  )
}

function EngineCard({ engine, onInspect }) {
  return (
    <article className={`engine-card engine-card--${engine.tone}`} data-engine={engine.short}>
      <InspectButton inspectorId={engine.inspectorId} onInspect={onInspect} className="engine-heading" label={`Explain ${engine.title}`}>
        <span><b>{engine.title}</b><small>{engine.confidence} confidence</small></span>
      </InspectButton>
      <div className="engine-metrics">
        {engine.metrics.map((metric) => (
          <InspectButton key={metric.id} inspectorId={metric.inspectorId} onInspect={onInspect} className="engine-metric" label={`Explain ${metric.label}: ${metric.value}`}>
            <span>{metric.label}</span><strong>{metric.value}</strong><NumericalClassBadge value={metric.qualifier} />
          </InspectButton>
        ))}
      </div>
    </article>
  )
}

function BusinessMap({ map, onInspect }) {
  const [compactEngines, setCompactEngines] = useState(() => globalThis.matchMedia?.('(max-width: 760px)').matches || false)
  const [enginesOpen, setEnginesOpen] = useState(() => !(globalThis.matchMedia?.('(max-width: 760px)').matches || false))
  useEffect(() => {
    const media = globalThis.matchMedia?.('(max-width: 760px)')
    if (!media) return undefined
    const sync = () => {
      setCompactEngines(media.matches)
      setEnginesOpen(!media.matches)
    }
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])
  return (
    <section id="now" className="dashboard-panel business-map-panel" aria-labelledby="now-title" data-testid="now-business-map">
      <SectionBar number="1" id="now" title="NOW" description="See Your Business" />
      <div className="map-label">Your business system</div>
      <button type="button" className="mobile-engine-toggle" aria-expanded={enginesOpen} aria-controls="business-engine-detail" onClick={() => setEnginesOpen((open) => !open)}>
        <span><strong>Explore all eight business engines</strong><small>Relationship, demand, pipeline, systems, execution, economics, capacity, and goals</small></span><Chevron direction={enginesOpen ? 'down' : 'right'} />
      </button>
      <div className="engine-map" id="business-engine-detail" data-collapsed={compactEngines && !enginesOpen ? 'true' : 'false'}>
        <div className="engine-lines" aria-hidden="true"><i /><i /><i /><i /></div>
        {map.engines.map((engine) => <EngineCard key={engine.id} engine={engine} onInspect={onInspect} />)}
        <InspectButton inspectorId={map.center.inspectorId} onInspect={onInspect} className="business-core" testId="business-core" label={`Explain ${map.center.title}`}>
          <span className="core-orbit" aria-hidden="true" />
          <small>Whole Business</small>
          <strong>{map.center.title}</strong>
          <span>{map.center.model}</span>
          <span>{map.center.system}</span>
          <b>{map.center.goal}</b>
        </InspectButton>
      </div>
      <div className="goal-backsolve" data-testid="goal-backsolve">
        <header><small>Goal backsolve</small><strong>What must become true upstream?</strong></header>
        {map.goalBacksolve.map((metric, index) => <Fragment key={metric.id}><InspectButton inspectorId={metric.inspectorId} onInspect={onInspect} label={`Explain ${metric.label}`}><small>{metric.label}</small><strong>{metric.value}</strong><NumericalClassBadge value={metric.qualifier} /></InspectButton>{index < map.goalBacksolve.length - 1 ? <Chevron /> : null}</Fragment>)}
      </div>
      <div className="map-footer">
        <InspectButton inspectorId={map.trajectory.inspectorId} onInspect={onInspect} className="trajectory-state" label="Explain current direction of travel">
          <span className="state-ring"><b>?</b></span><span><small>Direction of travel</small><strong>{map.trajectory.value}</strong><em>{map.trajectory.label}</em></span>
        </InspectButton>
        <div className="help-hold"><div><h3>What’s helping</h3>{map.helping.map((item) => <InspectButton key={item.id} inspectorId={item.inspectorId} onInspect={onInspect} label={`Explain asset: ${item.label}`}><span>✓ {item.label}</span></InspectButton>)}</div></div>
        <div className="help-hold help-hold--risk"><div><h3>What’s holding it back</h3>{map.holding.map((item) => <InspectButton key={item.id} inspectorId={item.inspectorId} onInspect={onInspect} label={`Explain vulnerability: ${item.label}`}><span>△ {item.label}</span></InspectButton>)}</div></div>
      </div>
    </section>
  )
}

function NumericalModelPanel({ numerical, onInspect }) {
  return (
    <section className="dashboard-panel numerical-panel" aria-labelledby="numerical-title" data-testid="numerical-model-panel">
      <header className="numerical-heading"><div><small>Current business ↔ business required by the goal</small><h2 id="numerical-title">{numerical.headline}</h2><p>{numerical.explanation}</p></div><span>Numbers with meaning</span></header>
      <div className="comparison-grid">
        {numerical.comparisons.map((comparison) => <InspectButton key={comparison.comparison_id} inspectorId={comparison.inspectorId} onInspect={onInspect} className="comparison-card" label="Explain current versus required business"><div><NumericalClassBadge className="current" /><strong>{comparison.current}</strong></div><span>→</span><div><NumericalClassBadge className="target" /><strong>{comparison.required}</strong></div><p><b>Gap:</b> {comparison.gap}</p><em>{comparison.next_measurement_question}</em></InspectButton>)}
      </div>
      <div className="numerical-subgrid">
        <div><h3>What MORE needs to measure next</h3><div className="scorecard-grid">{numerical.measurementScorecard.map((metric) => <InspectButton key={metric.id} inspectorId={metric.inspectorId} onInspect={onInspect} label={`Explain ${metric.label}`}><span>{metric.label}</span><strong>{metric.value}</strong><NumericalClassBadge value={metric.qualifier} /></InspectButton>)}</div></div>
        <div><h3>Purposeful operating standards</h3><div className="scorecard-grid">{numerical.systemStandards.map((metric) => <InspectButton key={metric.id} inspectorId={metric.inspectorId} onInspect={onInspect} label={`Explain ${metric.label}`}><span>{metric.label}</span><strong>{metric.value}</strong><NumericalClassBadge value={metric.qualifier} /></InspectButton>)}</div></div>
      </div>
    </section>
  )
}

function WhyPanel({ why, onInspect }) {
  return (
    <section id="why" className="dashboard-panel why-panel" aria-labelledby="why-title" data-testid="why-panel">
      <SectionBar number="2" id="why" title="WHY" description="Understand What’s Driving It" />
      <div className="why-grid">
        <div className="constraint-card">
          <InspectButton inspectorId={why.inspectorId} onInspect={onInspect} className="constraint-lead" testId="governing-constraint" label="Explain the governing constraint">
            <small>The governing constraint</small><h3>{why.title}</h3><p>{why.summary}</p>
          </InspectButton>
          <div className="causal-chain" aria-label="Primary causal chain">
            {why.chain.map((node, index) => <Fragment key={node.id}><InspectButton inspectorId={node.inspectorId} onInspect={onInspect} label={`Explain causal step: ${node.text}`}><span>{node.text}</span></InspectButton>{index < why.chain.length - 1 ? <Chevron direction="down" /> : null}</Fragment>)}
          </div>
        </div>
        <div className="effects-card"><h3>Downstream effects</h3>{why.effects.map((effect) => <InspectButton key={effect.id} inspectorId={effect.inspectorId} onInspect={onInspect} label={`Explain ${effect.label}`}><span>↓ {effect.label}</span></InspectButton>)}</div>
      </div>
      <div className="mechanism-strip" aria-label="Six governing mechanisms">
        {why.mechanisms.map((mechanism, index) => <InspectButton key={mechanism.id} inspectorId={mechanism.inspectorId} onInspect={onInspect} label={`Explain mechanism ${index + 1}`}><small>Mechanism {index + 1}</small><span>{mechanism.label}</span></InspectButton>)}
      </div>
      <div className="why-bottom">
        <InspectButton inspectorId={why.inspectorId} onInspect={onInspect} label="See why this interpretation leads"><strong>Why this, not something else?</strong><p>{why.whyStronger}</p></InspectButton>
        <InspectButton inspectorId={why.inspectorId} onInspect={onInspect} label="See what would change this interpretation"><strong>What would change our mind?</strong><p>{why.mindChange}</p></InspectButton>
      </div>
    </section>
  )
}

const graphPaths = [
  'M12 122 C92 94 168 54 284 42', 'M12 122 C102 112 182 85 284 70', 'M12 122 C104 100 178 101 284 94',
  'M12 122 C106 126 196 118 284 116', 'M12 122 C100 143 194 150 284 137',
]

function FuturesPanel({ futures, onInspect }) {
  return (
    <section id="futures" className="dashboard-panel futures-panel" aria-labelledby="futures-title" data-testid="futures-panel">
      <SectionBar number="3" id="futures" title="FUTURES" description="Explore Your Possibilities" />
      <div className="future-cards">
        {futures.items.map((future) => <InspectButton key={future.id} inspectorId={future.inspectorId} onInspect={onInspect} className={`future-card future-card--${future.role}`} testId={`future-${future.role}`} label={`Explain ${future.label}`}><small>{future.label}</small><strong>{future.weight}</strong><span>of 100 relative support · not probability</span><b>{future.title}</b><em>{future.condition}</em></InspectButton>)}
      </div>
      <InspectButton inspectorId={futures.graphInspectorId} onInspect={onInspect} className="future-graph" label="Explain the Five Futures trajectory field">
        <svg viewBox="0 0 300 160" role="img" aria-label="Five conditional trajectories from today">
          {graphPaths.map((path, index) => <path key={path} d={path} className={`future-path future-path--${index + 1}`} />)}
          <circle cx="12" cy="122" r="6" /><circle cx="284" cy="42" r="4" /><circle cx="284" cy="70" r="4" /><circle cx="284" cy="94" r="4" /><circle cx="284" cy="116" r="4" /><circle cx="284" cy="137" r="4" />
        </svg>
        <span className="graph-start">Today</span><span className="graph-decision">Conditions change here</span><span className="graph-end">Conditional paths</span>
      </InspectButton>
      <div className="future-relationship" aria-label="How the One Move relates to the trajectories"><strong>What changes the field</strong><span>{futures.moveRelationship}</span></div>
      <p className="support-note">{futures.semantics}</p>
    </section>
  )
}

function MovePanel({ move, onInspect, onNavigate }) {
  return (
    <section id="move" className="dashboard-panel move-panel" aria-labelledby="move-title" data-testid="move-panel">
      <SectionBar number="4" id="move" title="MOVE" description="Take the Right Action" />
      <InspectButton inspectorId={move.inspectorId} onInspect={onInspect} className="move-lead" testId="canonical-one-move" label="Explain the selected One Move">
        <small>Your One Move · highest-leverage bounded test</small><h3>{move.title}</h3><p>{move.intervention}</p>
      </InspectButton>
      <div className="move-logic">
        {move.logic.map((node, index) => <Fragment key={node.label}><InspectButton inspectorId={node.inspectorId} onInspect={onInspect} label={`Explain ${node.label}`}><small>{node.label}</small><strong>{node.value}</strong></InspectButton>{index < move.logic.length - 1 ? <Chevron /> : null}</Fragment>)}
      </div>
      <div className="move-bottom">
        <div><h3>Do this first</h3>{move.firstSteps.map((step) => <InspectButton key={step.id} inspectorId={step.inspectorId} onInspect={onInspect} label={`Explain step ${step.number}`}><span>{step.number}. {step.text}</span></InspectButton>)}</div>
        <div><h3>Proof we’re right</h3>{move.proof.slice(0, 3).map((proof) => <InspectButton key={proof.id} inspectorId={proof.inspectorId} onInspect={onInspect} label={`Explain proof signal: ${proof.label}`}><span>✓ {proof.label}</span></InspectButton>)}</div>
      </div>
      <div className="execution-contract" data-testid="move-execution-contract">
        <div><small>Workflow</small><strong>{move.execution.workflow}</strong></div>
        <div><small>Owner</small><strong>{move.execution.owner}</strong></div>
        <div><small>First action</small><strong>{move.execution.firstAction}</strong></div>
        <div><small>Cadence</small><strong>{move.execution.cadence}</strong></div>
        <div><small>Observation window</small><strong>{move.execution.observation}</strong></div>
        <div><small>Proof / failure</small><strong>{move.execution.scorecard}</strong></div>
      </div>
      <button type="button" className="section-link" onClick={() => onNavigate('plan')}>See the execution plan <Chevron /></button>
    </section>
  )
}

function PlanPanel({ plan, bosInspectorId, onInspect }) {
  return (
    <section id="plan" className="dashboard-panel plan-panel" aria-labelledby="plan-title" data-testid="plan-panel">
      <SectionBar number="5" id="plan" title="PLAN / EXECUTION" description="Turn the Move Into an Observable Trial" />
      <div className="plan-goal"><div><small>Your execution objective</small><h3>{plan.objective}</h3><p>{plan.observation}</p></div><span className="target-orbit" aria-hidden="true"><i /></span></div>
      <div className="plan-body">
        <div><h3>Five canonical steps</h3>{plan.steps.map((step) => <InspectButton key={step.id} inspectorId={step.inspectorId} onInspect={onInspect} className="plan-step" testId={`plan-step-${step.number}`} label={`Explain plan step ${step.number}`}><b>{step.number}</b><span>{step.text}</span></InspectButton>)}</div>
        <div className="execution-shape">
          <h3>Execution shape</h3><p>How this trial needs to be carried—not a second business diagnosis.</p>
          {plan.eToP.map((item) => <InspectButton key={item.dimension} inspectorId={bosInspectorId} onInspect={onInspect} label={`Explain execution state ${item.dimension}`}><span>{item.dimension}</span><strong>{item.state}</strong></InspectButton>)}
        </div>
      </div>
      <div className="plan-operating-contract" data-testid="plan-operating-contract">
        <div><small>Objective</small><strong>{plan.objective}</strong></div>
        <div><small>Owner</small><strong>{plan.ownership}</strong></div>
        <div><small>Cadence</small><strong>{plan.cadence}</strong></div>
        <div><small>Observation window</small><strong>{plan.observation}</strong></div>
        <div><small>Scorecard</small><strong>{plan.scorecard.join(' · ')}</strong></div>
      </div>
      <div className="plan-foot"><div><small>Owner boundary</small><strong>{plan.ownership}</strong></div><div><small>Stop / reconsider</small><strong>{plan.stopConditions[0]}</strong></div></div>
    </section>
  )
}

function EvidencePanel({ evidence, onInspect }) {
  return (
    <section id="evidence" className="dashboard-panel evidence-panel" aria-labelledby="evidence-title" data-testid="evidence-panel">
      <SectionBar number="6" id="evidence" title="EVIDENCE" description="Why You Can Trust This" />
      <div className="evidence-grid">
        {evidence.categories.map((category) => <InspectButton key={category.id} inspectorId={category.inspectorId} onInspect={onInspect} className={`evidence-card evidence-card--${category.id}`} testId={`evidence-${category.id}`} label={`Explain ${category.label} evidence`}><small>{category.label}</small><strong>{category.value}</strong><span>{category.summary}</span></InspectButton>)}
      </div>
      <p className="evidence-footnote">Direct observation is shown as zero because no operating records are bound. The map does not convert self-report into observation.</p>
    </section>
  )
}

function BosIntegration({ bos, onInspect }) {
  return (
    <section id="bos" className="bos-integration" data-testid="bos-integration">
      <InspectButton inspectorId={bos.inspectorId} onInspect={onInspect} label="Explain Person and business execution fit">
        <Mark /><span><small>{bos.label}</small><strong>{bos.headline}</strong><em>{bos.boundary}</em></span><b>View execution fit</b>
      </InspectButton>
    </section>
  )
}

function LivingMap({ livingMap, onInspect }) {
  return (
    <section className="living-transition" data-testid="living-map-transition">
      <div><small>From a frozen assessment to a future living system</small><h2>{livingMap.headline}</h2><p>{livingMap.copy}</p></div>
      <InspectButton inspectorId={livingMap.inspectorId} onInspect={onInspect} label={livingMap.action}>{livingMap.action}</InspectButton>
    </section>
  )
}

function Inspector({ inspector, depth, onDepth, onClose, closeRef }) {
  const inspectorRef = useRef(null)
  useEffect(() => {
    if (!inspector) return undefined
    const background = [...document.querySelectorAll('.quick-rail, .app-main')]
    background.forEach((element) => { element.setAttribute('inert', ''); element.setAttribute('aria-hidden', 'true') })
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...inspectorRef.current.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    document.body.classList.add('inspector-open')
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.classList.remove('inspector-open')
      background.forEach((element) => { element.removeAttribute('inert'); element.removeAttribute('aria-hidden') })
    }
  }, [inspector, onClose])
  if (!inspector) return null
  return (
    <div className="inspector-layer" data-testid="inspector-layer">
      <button type="button" className="inspector-scrim" onClick={onClose} aria-label="Close explanation" tabIndex={-1} />
      <aside ref={inspectorRef} className={`inspector inspector--${inspector.tone}`} role="dialog" aria-modal="true" aria-labelledby="inspector-title" aria-describedby="inspector-status">
        <header><div><small>{inspector.kicker}</small><h2 id="inspector-title">{inspector.title}</h2><span id="inspector-status">{inspector.status}</span></div><button type="button" className="close-button" onClick={onClose} ref={closeRef} aria-label="Close explanation">×</button></header>
        <div className="depth-switch" role="tablist" aria-label="Explanation depth">
          <button type="button" role="tab" aria-selected={depth === 1} onClick={() => onDepth(1)}>Explain it</button>
          <button type="button" role="tab" aria-selected={depth === 2} onClick={() => onDepth(2)}>Deep intelligence</button>
        </div>
        {depth === 1 ? (
          <div className="level-one" data-testid="inspector-level-1">
            <p className="lead-meaning">{inspector.level1.meaning}</p>
            <div className="explain-grid">
              <article><small>Why it matters</small><p>{inspector.level1.why}</p></article>
              <article><small>Goal relationship</small><p>{inspector.level1.goal}</p></article>
              <article><small>What helps</small><ul>{inspector.level1.helps.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></article>
              <article><small>What hurts</small><ul>{inspector.level1.hurts.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></article>
              <article><small>How it connects</small><p>{inspector.level1.connection}</p></article>
              <article><small>What to notice</small><p>{inspector.level1.notice}</p></article>
            </div>
          </div>
        ) : (
          <div className="level-two" data-testid="inspector-level-2">
            {inspector.level2.map((section) => <article key={section.title}><h3>{section.title}</h3><ul>{section.items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></article>)}
          </div>
        )}
      </aside>
    </div>
  )
}

export default function BaV2CustomerRealizationApp({ viewModel }) {
  const [inspectorId, setInspectorId] = useState(null)
  const [depth, setDepth] = useState(1)
  const openerRef = useRef(null)
  const closeRef = useRef(null)
  const [activeSection, setActiveSection] = useState('now')
  const inspector = useMemo(() => inspectorId ? viewModel.inspectors[inspectorId] : null, [inspectorId, viewModel.inspectors])

  const inspect = (id, opener) => {
    openerRef.current = opener
    setDepth(1)
    setInspectorId(id)
    requestAnimationFrame(() => closeRef.current?.focus())
  }
  const close = () => {
    setInspectorId(null)
    requestAnimationFrame(() => openerRef.current?.focus())
  }
  const navigate = (id) => {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="ba-v2-app" id="top">
      <QuickRail viewModel={viewModel} onInspect={inspect} onNavigate={navigate} activeSection={activeSection} />
      <main className="app-main">
        <header className="app-hero">
          <div><p className="eyebrow">{viewModel.hero.eyebrow}</p><h1>{viewModel.hero.title}</h1><p>{viewModel.hero.subtitle}</p></div>
          <InspectButton inspectorId={viewModel.bos.inspectorId} onInspect={inspect} className="hero-bos" label="Explain BOS Integration"><small>BOS integrated</small><strong>Business truth first</strong><span>Person × execution fit</span></InspectButton>
        </header>
        <TopNavigation nav={viewModel.nav} onNavigate={navigate} activeSection={activeSection} />
        <div className="dashboard-layout">
          <BusinessMap map={viewModel.businessMap} onInspect={inspect} />
          <WhyPanel why={viewModel.why} onInspect={inspect} />
          <NumericalModelPanel numerical={viewModel.numerical} onInspect={inspect} />
          <FuturesPanel futures={viewModel.futures} onInspect={inspect} />
          <MovePanel move={viewModel.move} onInspect={inspect} onNavigate={navigate} />
          <PlanPanel plan={viewModel.plan} bosInspectorId={viewModel.bos.inspectorId} onInspect={inspect} />
          <EvidencePanel evidence={viewModel.evidence} onInspect={inspect} />
          <BosIntegration bos={viewModel.bos} onInspect={inspect} />
          <LivingMap livingMap={viewModel.livingMap} onInspect={inspect} />
        </div>
      </main>
      <Inspector inspector={inspector} depth={depth} onDepth={setDepth} onClose={close} closeRef={closeRef} />
    </div>
  )
}
