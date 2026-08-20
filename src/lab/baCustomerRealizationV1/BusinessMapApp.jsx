import { Fragment, useMemo, useState } from 'react';

const LENS_ORDER = ['now', 'why', 'futures', 'move', 'plan', 'evidence'];

function ArrowIcon({ direction = 'right' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={`icon icon--${direction}`}>
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="brand-mark">
      <path d="M12 1.8 14.1 9l7.1 2.1-7.1 2.1L12 20.4l-2.1-7.2-7.1-2.1L9.9 9 12 1.8Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12" cy="11.1" r="2.2" fill="currentColor" />
    </svg>
  );
}

function SectionHeading({ eyebrow, title, copy }) {
  return (
    <header className="section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {copy ? <p className="section-copy">{copy}</p> : null}
    </header>
  );
}

function Disclosure({ title, summary, children, tone = 'neutral', defaultOpen = false, testId }) {
  return (
    <details className={`disclosure disclosure--${tone}`} open={defaultOpen} data-testid={testId}>
      <summary>
        <span>
          <strong>{title}</strong>
          {summary ? <small>{summary}</small> : null}
        </span>
        <span className="disclosure-plus" aria-hidden="true">+</span>
      </summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}

function StatementList({ items, ordered = false }) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className={ordered ? 'numbered-list' : 'statement-list'}>
      {items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
    </Tag>
  );
}

function OrientationMap({ orientation, onChooseLens }) {
  const maxWeight = Math.max(...orientation.whereYouAreGoing.map((future) => future.weight));
  return (
    <section className="orientation" aria-labelledby="orientation-title" data-testid="orientation-map">
      <div className="orientation-intro">
        <p className="eyebrow">Your business, oriented</p>
        <h2 id="orientation-title">See the whole system before you choose where to look.</h2>
      </div>
      <div className="orientation-grid">
        <button className="orientation-zone orientation-zone--left" onClick={() => onChooseLens('now')} type="button">
          <span className="zone-number">01</span>
          <span className="zone-kicker">Where you are</span>
          <strong>Your business now</strong>
          <span className="reality-stack">
            {orientation.whereYouAre.slice(0, 4).map((item) => (
              <span key={item.id}><i />{item.label}<small>{item.statement}</small></span>
            ))}
          </span>
          <span className="zone-action">Open Now <ArrowIcon /></span>
        </button>

        <button className="orientation-zone orientation-zone--center" onClick={() => onChooseLens('move')} type="button">
          <span className="center-glow" aria-hidden="true" />
          <span className="zone-number">02</span>
          <span className="zone-kicker">What matters now</span>
          <span className="constraint-label">The governing issue</span>
          <strong>{orientation.whatMatters.constraint}</strong>
          <span className="center-divider" />
          <span className="move-label">Your One Move</span>
          <b>{orientation.whatMatters.move}</b>
          <span className="proof-line"><i />Proof begins when {orientation.whatMatters.proof.toLowerCase()}</span>
          <span className="zone-action">Open Move <ArrowIcon /></span>
        </button>

        <button className="orientation-zone orientation-zone--right" onClick={() => onChooseLens('futures')} type="button">
          <span className="zone-number">03</span>
          <span className="zone-kicker">Where you’re going</span>
          <strong>Five possible paths</strong>
          <span className="mini-trajectories">
            {orientation.whereYouAreGoing.map((future) => (
              <span key={future.role} className={`mini-trajectory mini-trajectory--${future.role}`}>
                <i style={{ '--weight': `${Math.max(18, (future.weight / maxWeight) * 100)}%` }} />
                <small>{future.label}</small><b>{future.weight}</b>
              </span>
            ))}
          </span>
          <span className="zone-action">Open Futures <ArrowIcon /></span>
        </button>
      </div>
    </section>
  );
}

function NowLens({ lens }) {
  return (
    <div className="lens-content" data-testid="lens-now">
      <SectionHeading eyebrow="Now" title={lens.question} copy={lens.headline} />
      <div className="reality-grid">
        {lens.realities.map((reality) => (
          <article className="reality-card" key={reality.id}>
            <span>{reality.label}</span>
            <p>{reality.statement}</p>
          </article>
        ))}
      </div>
      <div className="two-column">
        <Disclosure title="What the business already has" summary={`${lens.assets.length} usable assets`} tone="teal" defaultOpen>
          <StatementList items={lens.assets} />
        </Disclosure>
        <Disclosure title="What makes the business vulnerable" summary={`${lens.vulnerabilities.length} material exposures`} tone="amber">
          <StatementList items={lens.vulnerabilities} />
        </Disclosure>
      </div>
      <Disclosure title="Where the picture is still thin" summary="Important gaps, shown honestly">
        <StatementList items={lens.learningGaps} />
      </Disclosure>
    </div>
  );
}

function WhyLens({ lens }) {
  return (
    <div className="lens-content" data-testid="lens-why">
      <SectionHeading eyebrow="Why" title={lens.question} copy="The visible problems are connected. The map follows the mechanism underneath them." />
      <article className="constraint-hero">
        <span>The governing issue</span>
        <h3>{lens.constraint}</h3>
        <p>{lens.whyStronger}</p>
        <div className="constraint-meta"><i />{lens.momentum}</div>
      </article>
      <div className="causal-thread" aria-label="Causal chain">
        {lens.causalThread.map((step, index) => (
          <Fragment key={step}>
            <span>{step}</span>
            {index < lens.causalThread.length - 1 ? <ArrowIcon /> : null}
          </Fragment>
        ))}
      </div>
      <div className="mechanism-list">
        {lens.mechanisms.map((mechanism, index) => (
          <Disclosure key={mechanism.title} title={`${String(index + 1).padStart(2, '0')} · ${mechanism.title}`} summary={mechanism.mechanism} tone={index === 1 ? 'amber' : 'neutral'} testId={`mechanism-${index + 1}`}>
            <div className="detail-columns">
              <div><h4>How it compounds</h4><StatementList items={mechanism.chain} ordered /></div>
              <div><h4>What could complicate this</h4><StatementList items={mechanism.confounds} /></div>
            </div>
            <p className="falsifier"><strong>What would challenge this:</strong> {mechanism.falsifier}</p>
          </Disclosure>
        ))}
      </div>
      <div className="two-column">
        <Disclosure title="The loops that can stabilize the pattern" summary={`${lens.loops.length} balancing loops`}>
          <StatementList items={lens.loops} />
        </Disclosure>
        <Disclosure title="Evidence that keeps this interpretation bounded" summary="The map does not ignore counter-signals">
          <StatementList items={lens.counterevidence} />
        </Disclosure>
      </div>
      <div className="two-column two-column--single">
        <Disclosure title="Other explanations still in play" summary={`${lens.alternatives.length} alternatives`}>
          <StatementList items={lens.alternatives} />
        </Disclosure>
      </div>
    </div>
  );
}

function FuturesLens({ lens }) {
  const [selectedRole, setSelectedRole] = useState('current_course');
  const selected = lens.futures.find((future) => future.role === selectedRole);
  return (
    <div className="lens-content" data-testid="lens-futures">
      <SectionHeading eyebrow="Futures" title={lens.question} copy={lens.explanation} />
      <div className="trajectory-stage" data-testid="trajectory-stage">
        <div className="trajectory-axis" aria-hidden="true"><span>Now</span><i /><span>Possible paths</span></div>
        <div className="trajectory-buttons" role="group" aria-label="Five modeled futures">
          {lens.futures.map((future) => (
            <button
              type="button"
              key={future.role}
              className={`trajectory-card trajectory-card--${future.role} ${selectedRole === future.role ? 'is-selected' : ''}`}
              onClick={() => setSelectedRole(future.role)}
              aria-pressed={selectedRole === future.role}
              data-testid={`future-${future.role}`}
            >
              <span className="trajectory-role">{future.label}</span>
              <b>{future.weight}</b><small>relative support</small>
              <strong>{future.title}</strong>
              <span className="trajectory-bar"><i style={{ width: `${future.weight}%` }} /></span>
            </button>
          ))}
        </div>
      </div>
      <article className={`future-detail future-detail--${selected.role}`} aria-live="polite">
        <header>
          <div><span>{selected.label}</span><h3>{selected.title}</h3></div>
          <div className="weight-orb"><strong>{selected.weight}</strong><small>of 100</small></div>
        </header>
        <p className="future-summary">{selected.summary}</p>
        <p>{selected.businessState}</p>
        <div className="future-relationship"><span>How the One Move relates</span><strong>{selected.moveRelationship}</strong></div>
        <div className="detail-columns detail-columns--three">
          <div><h4>What would need to change</h4>{selected.changes.length ? <StatementList items={selected.changes} /> : <p className="quiet-copy">This path continues without a required change.</p>}</div>
          <div><h4>Signals to watch</h4><StatementList items={selected.indicators} /></div>
          <div><h4>Risks</h4><StatementList items={selected.risks} /></div>
        </div>
        <Disclosure title="What keeps this path conditional" summary="Limits and mind-change evidence">
          <p>{selected.conditionality}</p>
          <StatementList items={selected.falsifiers} />
        </Disclosure>
      </article>
    </div>
  );
}

function MoveLens({ lens, onChooseLens }) {
  return (
    <div className="lens-content" data-testid="lens-move">
      <SectionHeading eyebrow="Move" title={lens.question} copy="One bounded intervention, chosen for leverage and learning—not a longer advice list." />
      <article className="move-hero" data-testid="canonical-one-move">
        <div className="move-orbit" aria-hidden="true"><span /><span /><i /></div>
        <p className="eyebrow">Your One Move</p>
        <h3>{lens.title}</h3>
        <p className="move-intervention">{lens.intervention}</p>
        <p>{lens.whyNow}</p>
        <div className="move-badges"><span>{lens.reversibility}</span><span>{lens.dependency}</span></div>
      </article>
      <div className="logic-chain">
        {lens.logicChain.map((step, index) => (
          <Fragment key={step.label}>
            <div><span>{step.label}</span><strong>{step.value}</strong></div>
            {index < lens.logicChain.length - 1 ? <ArrowIcon /> : null}
          </Fragment>
        ))}
      </div>
      <div className="two-column">
        <Disclosure title="Why this is not just a staffing move" summary="Root cause, not symptom" tone="amber" defaultOpen>
          <p>{lens.symptomDistinction}</p>
          <StatementList items={lens.causalChain} ordered />
        </Disclosure>
        <Disclosure title="What proof looks like" summary={`${lens.proof.length} early signals`} tone="teal" defaultOpen>
          <StatementList items={lens.proof} />
        </Disclosure>
      </div>
      <div className="move-proof-grid">
        <Disclosure title="Evidence the move is working"><StatementList items={lens.success} /></Disclosure>
        <Disclosure title="Evidence the move is failing"><StatementList items={lens.failure} /></Disclosure>
        <Disclosure title="How long to observe"><p>{lens.observation}</p></Disclosure>
      </div>
      <button className="primary-action" type="button" onClick={() => onChooseLens('plan')}>See the execution plan <ArrowIcon /></button>
    </div>
  );
}

function PlanLens({ lens }) {
  return (
    <div className="lens-content" data-testid="lens-plan">
      <SectionHeading eyebrow="Plan" title={lens.question} copy="The assessment defines the immediate experiment and its proof. It does not invent a larger planning system." />
      <div className="plan-layout">
        <div className="plan-steps">
          <p className="eyebrow">The next five steps</p>
          <StatementList items={lens.steps} ordered />
        </div>
        <aside className="plan-sidebar">
          <span>Patricia’s boundary</span>
          <p>{lens.ownerBoundary}</p>
          <small>{lens.observation}</small>
        </aside>
      </div>
      <div className="two-column">
        <Disclosure title="Before the trial begins" summary="Prerequisites" defaultOpen><StatementList items={lens.prerequisites} /></Disclosure>
        <Disclosure title="Designed to fit how Patricia operates" summary="Execution fit, not business cause" defaultOpen><StatementList items={lens.fitAdjustments} /></Disclosure>
      </div>
      <div className="two-column">
        <Disclosure title="Stop or reconsider when"><StatementList items={lens.stopConditions} /></Disclosure>
        <Disclosure title="Proof targets"><StatementList items={lens.proofTargets} /></Disclosure>
      </div>
    </div>
  );
}

function EvidenceLens({ lens }) {
  const columns = [
    ['What we know', lens.known, 'known'],
    ['What we believe is happening', lens.believed, 'believed'],
    ['What we’re still learning', lens.stillLearning, 'learning'],
    ['What would change our mind', lens.mindChanges, 'change'],
  ];
  return (
    <div className="lens-content" data-testid="lens-evidence">
      <SectionHeading eyebrow="Evidence" title={lens.question} copy="Trust comes from showing the edges of the map—not pretending every line is equally certain." />
      <div className="evidence-grid">
        {columns.map(([title, items, tone]) => (
          <section className={`evidence-column evidence-column--${tone}`} key={title}>
            <header><i /><h3>{title}</h3><span>{items.length}</span></header>
            <StatementList items={items} />
          </section>
        ))}
      </div>
    </div>
  );
}

function LivingMapTransition({ transition }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="living-transition" data-testid="living-map-transition">
      <div className="living-grid" aria-hidden="true" />
      <div>
        <p className="eyebrow">What comes after the assessment</p>
        <h2>{transition.title}</h2>
        <p>{transition.prompt}</p>
        {open ? <p className="living-explanation" id="living-map-explanation">{transition.explanation}</p> : null}
      </div>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="living-map-explanation">
        {open ? 'Close explanation' : transition.actionLabel}<ArrowIcon />
      </button>
    </section>
  );
}

export default function BusinessMapApp({ viewModel }) {
  const [activeLens, setActiveLens] = useState('now');
  const lens = viewModel.lenses[activeLens];
  const activeIndex = LENS_ORDER.indexOf(activeLens);
  const renderer = useMemo(() => ({
    now: <NowLens lens={viewModel.lenses.now} />,
    why: <WhyLens lens={viewModel.lenses.why} />,
    futures: <FuturesLens lens={viewModel.lenses.futures} />,
    move: <MoveLens lens={viewModel.lenses.move} onChooseLens={setActiveLens} />,
    plan: <PlanLens lens={viewModel.lenses.plan} />,
    evidence: <EvidenceLens lens={viewModel.lenses.evidence} />,
  }), [viewModel]);

  const chooseLens = (id) => {
    setActiveLens(id);
    requestAnimationFrame(() => document.getElementById('lens-stage')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <main className="business-map" data-testid="business-map" data-customer="patricia" data-lab-status="ready">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="MORE MindMap home"><SparkIcon /><span>MORE <b>MindMap</b></span></a>
        <span className="map-state"><i />Assessment complete</span>
      </header>

      <section className="hero" id="top">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow">{viewModel.identity.vertical} · Business intelligence</p>
          <h1><span>{viewModel.identity.firstName},</span><br />this is your business now.</h1>
          <p>{viewModel.identity.subtitle}</p>
        </div>
        <div className="hero-signal" aria-label="Map status">
          <span className="signal-rings"><i /><i /><b /></span>
          <strong>Map ready</strong>
          <small>One business · Five paths · One move</small>
        </div>
        <div className="hero-scroll"><span />Scroll to explore</div>
      </section>

      <OrientationMap orientation={viewModel.orientation} onChooseLens={chooseLens} />

      <section className="lens-shell" id="lens-stage">
        <nav className="lens-nav" aria-label="Business Map lenses">
          <div className="lens-nav-intro"><span>Choose your lens</span><small>One business. Six questions.</small></div>
          <div className="lens-buttons" role="tablist">
            {LENS_ORDER.map((id, index) => (
              <button
                type="button"
                role="tab"
                aria-selected={activeLens === id}
                aria-controls={`panel-${id}`}
                id={`tab-${id}`}
                key={id}
                className={activeLens === id ? 'is-active' : ''}
                onClick={() => chooseLens(id)}
                data-testid={`lens-button-${id}`}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>{viewModel.lenses[id].label}
              </button>
            ))}
          </div>
          <div className="lens-progress"><i style={{ width: `${((activeIndex + 1) / LENS_ORDER.length) * 100}%` }} /></div>
        </nav>
        <section className="lens-panel" role="tabpanel" id={`panel-${activeLens}`} aria-labelledby={`tab-${activeLens}`}>
          <div className="lens-question-rail"><span>{lens.label}</span><p>{lens.question}</p></div>
          {renderer[activeLens]}
        </section>
      </section>

      <LivingMapTransition transition={viewModel.livingMapTransition} />
      <footer className="map-footer">
        <div className="brand"><SparkIcon /><span>MORE <b>MindMap</b></span></div>
        <p>Your business, understood as a whole.</p>
        <small>Business Map · Patricia Gutierrez</small>
      </footer>
    </main>
  );
}
