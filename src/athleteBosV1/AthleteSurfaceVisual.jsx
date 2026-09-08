function present(values) {
  return Array.isArray(values) ? values.filter(Boolean) : [];
}

function OpenNotes({ items, label = 'Still open', limit = 2 }) {
  const values = present(items);
  if (!values.length) return null;
  const first = values.slice(0, limit);
  const rest = values.slice(limit);
  return <aside className="ab-visual-open"><span>{label}</span><ul>{first.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>{rest.length > 0 && <details className="ab-more-intelligence"><summary>See {rest.length} more open {rest.length === 1 ? 'point' : 'points'} <i>+</i></summary><ul>{rest.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></details>}</aside>;
}

function InsightCards({ items, limit = 2 }) {
  const values = present(items);
  if (!values.length) return null;
  const cards = (subset, offset = 0) => subset.map((item, index) => <article key={`${offset + index}-${item.statement}`}><span>{item.certainty}</span><p>{item.statement}</p>{item.whatCouldChangeIt && <small>What could change this · {item.whatCouldChangeIt}</small>}</article>);
  const first = values.slice(0, limit);
  const rest = values.slice(limit);
  return <><div className="ab-visual-insights">{cards(first)}</div>{rest.length > 0 && <details className="ab-more-intelligence"><summary>See {rest.length} more supported {rest.length === 1 ? 'idea' : 'ideas'} <i>+</i></summary><div className="ab-visual-insights">{cards(rest, limit)}</div></details>}</>;
}

function Sequence({ item, index }) {
  return <article className="ab-visual-sequence"><span>Moment {String(index + 1).padStart(2, '0')}</span><h3>{item.context}</h3><ol>{present(item.steps).map((step, stepIndex) => <li key={`${stepIndex}-${step}`}><b>{stepIndex + 1}</b><span>{step}</span></li>)}</ol><p>{item.consequence}</p>{item.uncertainty && <small>{item.uncertainty}</small>}</article>;
}

function Dynamics({ items, compact = false, limit = 1 }) {
  const values = present(items).slice(0, limit);
  if (!values.length) return null;
  return <div className={`ab-visual-dynamics${compact ? ' is-compact' : ''}`}>{values.map((item, index) => <article key={`${index}-${item.context}`}><div><span>Situation</span><p>{item.context}</p></div><i>→</i><div><span>What it may mean</span><p>{item.meaning}</p></div><i>→</i><div><span>Response</span><p>{item.response}</p></div>{!compact && <><i>→</i><div className="is-tradeoff"><span>Use / possible cost</span><p>{item.usefulPart}</p><small>{item.possibleCost}</small></div></>}</article>)}</div>;
}

function ContextVisual({ visual }) {
  return <><div className="ab-context-anchor"><span>What this part suggests</span><p>{visual.domainMeaning || 'This part of the story is still being learned.'}</p></div><InsightCards items={visual.insights} limit={1} /><OpenNotes items={visual.stillOpen} limit={1} /></>;
}

function SourceMoments({ items, label = 'Moments behind this view', limit = 1 }) {
  const values = present(items).slice(0, limit);
  if (!values.length) return null;
  return <div className="ab-moment-view"><span>{label}</span><div>{values.map((item, index) => <article key={`${index}-${item.answer}`}><b>{String(index + 1).padStart(2, '0')}</b>{item.question && <small>{item.question}</small>}<p>{item.answer}</p></article>)}</div></div>;
}

export default function AthleteSurfaceVisual({ rendering }) {
  const visual = rendering?.visual;
  if (!visual?.kind) return null;

  let body = null;
  if (visual.kind === 'recognition') {
    body = <><div className="ab-identity-anchor"><span>What may tie this together</span><p>{visual.anchor}</p></div>{visual.threads?.length > 0 && <div className="ab-identity-threads">{visual.threads.slice(0, 2).map((item, index) => <article key={`${index}-${item.meaning}`}><b>{String(index + 1).padStart(2, '0')}</b><p>{item.meaning}</p><small>{item.uncertainty}</small></article>)}</div>}</>;
  } else if (visual.kind === 'whole_person_pattern') {
    body = <><div className="ab-dna-architecture"><header><span>How these parts connect</span><h3>{visual.anchor}</h3></header><div>{present(visual.threads).slice(0, 2).map((item, index) => <article key={`${index}-${item.meaning}`}><b>{String(index + 1).padStart(2, '0')}</b><p>{item.meaning}</p><small>{item.uncertainty}</small></article>)}</div></div></>;
  } else if (visual.kind === 'operating_sequence') {
    body = <><div className="ab-visual-thesis"><span>How action unfolded</span><p>One real sequence—not a rule for every situation.</p></div><div className="ab-sequence-grid">{present(visual.sequences).slice(0, 1).map((item, index) => <Sequence key={`${index}-${item.context}`} item={item} index={index} />)}</div><OpenNotes items={visual.stillOpen} limit={1} /></>;
  } else if (visual.kind === 'communication_flow') {
    body = <><div className="ab-visual-thesis is-communication"><span>When the picture was unclear</span><p>What asking made possible, while leaving the other person’s experience open.</p></div><Dynamics items={visual.dynamics} compact /><InsightCards items={visual.insights} limit={1} /></>;
  } else if (visual.kind === 'learning_process') {
    body = <><div className="ab-visual-thesis is-learning"><span>Try → notice → clarify → adjust</span><p>A process seen in one moment, not a fixed learning-style label.</p></div><div className="ab-sequence-grid">{present(visual.sequences).slice(0, 1).map((item, index) => <Sequence key={`${index}-${item.context}`} item={item} index={index} />)}</div><OpenNotes items={visual.stillOpen} limit={1} /></>;
  } else if (visual.kind === 'relationship_lens') {
    body = <><p className="ab-observer-boundary">{visual.boundary}</p><ContextVisual visual={visual} /></>;
  } else if (visual.kind === 'strength_tradeoff') {
    body = <><div className="ab-strength-grid">{present(visual.items).slice(0, 1).map((item, index) => <article key={`${index}-${item.strength}`}><header><span>Strength</span><h3>{item.strength}</h3></header><div><span>When it helps</span><p>{item.usefulWhen}</p></div><i>↔</i><div className="is-cost"><span>When it may get in the way</span><p>{item.lessUsefulWhen}</p></div><small>{item.why}</small></article>)}</div><OpenNotes items={visual.stillOpen} limit={1} /></>;
  } else if (visual.kind === 'pressure_response_repair') {
    body = <><Dynamics items={visual.dynamics} /><OpenNotes items={visual.stillOpen} limit={1} /></>;
  } else if (visual.kind === 'sport_school_life') {
    body = <><div className="ab-balance-view"><span>What had to fit together</span><p>{visual.domainMeaning || 'The balance is still being learned.'}</p></div><SourceMoments items={visual.moments} label="One choice inside a real day" /><OpenNotes items={visual.stillOpen} limit={1} /></>;
  } else if (visual.kind === 'growth_conditions') {
    body = <><div className="ab-growth-view"><span>Conditions worth testing</span><p>{visual.domainMeaning || 'What helps is still being learned.'}</p><small>What helps can change with the task, the person and the moment.</small></div><InsightCards items={visual.insights} limit={1} /></>;
  } else if (visual.kind === 'capacity_context') {
    body = <><div className="ab-capacity-view"><span>Room right now</span><p>{visual.domainMeaning || 'Current capacity is still being learned.'}</p><small>Capacity is context, not a score of effort or ambition.</small></div><SourceMoments items={visual.moments} label="One moment that shaped this view" /><OpenNotes items={visual.stillOpen} limit={1} /></>;
  } else if (visual.kind === 'conditional_futures') {
    body = <><div className="ab-futures-grid">{present(visual.items).map((item, index) => <details key={`${index}-${item.title}`}><summary><b>{String(index + 1).padStart(2, '0')}</b><span><strong>{item.title}</strong><small>{item.condition}</small></span><i>+</i></summary><div><p>{item.possibility}</p><p><b>Why this might move</b>{item.mechanism}</p>{item.actions.length > 0 && <p><b>What you could choose</b>{item.actions.join(' ')}</p>}{item.dependencies.length > 0 && <p><b>What is not yours alone</b>{item.dependencies.join(' ')}</p>}<p><b>When to look again</b>{item.horizon} · {item.reviewTrigger}</p><small>{item.uncertainty}</small></div></details>)}</div><OpenNotes items={visual.stillOpen} /></>;
  } else if (visual.kind === 'one_move') {
    body = <article className="ab-move-card"><span>{visual.moveKind === 'maintain' ? 'Protect what is working' : visual.moveKind === 'abstain' ? 'No move forced' : 'A small test, not a commitment'}</span><h3>{visual.suggestion || 'Leave this open for now.'}</h3>{visual.purpose && <p>{visual.purpose}</p>}<div>{visual.why && <p><b>Why this one</b>{visual.why}</p>}{visual.observation && <p><b>What to notice</b>{visual.observation}</p>}{visual.window && <p><b>When to review</b>{visual.window}</p>}{visual.stopOrAdjust && <p><b>Stop or adjust</b>{visual.stopOrAdjust}</p>}</div>{visual.uncertainty && <small>{visual.uncertainty}</small>}</article>;
  } else if (visual.kind === 'known_and_open') {
    const differences = present(visual.differences);
    const featuredDifference = differences.find(({ resolved }) => !resolved) || differences[0];
    body = <><InsightCards items={visual.claims} limit={1} />{featuredDifference && <div className="ab-differences"><span>{featuredDifference.resolved ? 'A difference this reading can hold together' : 'A difference we have not erased'}</span><p>{featuredDifference.statement}</p></div>}<div className="ab-source-count"><strong>{present(visual.sourceMoments).length}</strong><span>answers and moments you can inspect below</span></div></>;
  } else if (visual.kind === 'governing_identity') {
    body = <><div className="ab-identity-anchor"><span>A useful way to remember this</span><p>{visual.anchor}</p></div><div className="ab-governing-logic"><p><b>How it connects</b>{visual.logic}</p><p><b>What still pulls both ways</b>{visual.tension}</p></div></>;
  }

  if (!body) return null;
  return <section className="ab-surface-visual" data-visual-kind={visual.kind} aria-label={`Visual view for ${rendering.eyebrow}`}>{body}</section>;
}
