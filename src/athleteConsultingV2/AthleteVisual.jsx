import React from 'react';
import './athlete-visual.css';

function GovernedObject({ value }) {
  if (!value) return null;
  const items = Array.isArray(value.items) ? value.items : [];
  return <div className={`athlete-visual-object athlete-visual-object-${String(value.kind || 'plain').toLowerCase()}`}>
    <div className="athlete-visual-object-heading">
      <span>{value.title}</span>
      {value.kind === 'PROPOSED_PLAN' && <small>Not yet agreed</small>}
      {value.kind === 'ACCEPTED_PLAN' && <small>Agreed plan</small>}
      {value.kind === 'APA_OPTION' && <small>Assessment option</small>}
    </div>
    {value.statement && <p className="athlete-visual-statement">{value.statement}</p>}
    {value.qualifier && <p className="athlete-visual-qualifier">{value.qualifier}</p>}
    {items.length > 0 && <dl className="athlete-visual-items">{items.map((item, index) => <div key={`${value.id}-${index}`}>
      <dt>{item.label}</dt>
      {item.value && <dd>{item.value}</dd>}
      {item.note && <dd className="athlete-visual-item-note">{item.note}</dd>}
    </div>)}</dl>}
  </div>;
}

function VisualBlock({ block }) {
  const evidence = Array.isArray(block.evidence) ? block.evidence : [];
  return <article className={`athlete-visual-block athlete-visual-${String(block.type || 'plain').toLowerCase()}`}>
    <header><h4>{block.title}</h4>{block.subtitle && <p>{block.subtitle}</p>}</header>
    <div className="athlete-visual-objects">{(block.objects || []).map((value) => <GovernedObject key={value.id} value={value}/>)}</div>
    {evidence.length > 0 && <details className="athlete-visual-sources"><summary>What this view draws on</summary>
      <ul>{evidence.map((source) => <li key={source.id}>{source.label}</li>)}</ul>
    </details>}
  </article>;
}

// Visuals are receipts and orientation only. Plan approval, edit, and defer
// controls are rendered by the owning authenticated workspace, never by GU.
export default function AthleteVisual({ plan, className = '' }) {
  if (!plan?.guidance || plan.renderDecision?.render !== true || !Array.isArray(plan.blocks)
    || plan.blocks.length === 0) return null;
  const event = String(plan.event || '').toLowerCase();
  return <section className={`athlete-visual athlete-visual-${event} ${className}`.trim()}
    aria-label={plan.guidance.headline} data-athlete-visual-event={plan.event}>
    <header className="athlete-visual-heading">
      <span>{plan.guidance.eyebrow}</span>
      <h3>{plan.guidance.headline}</h3>
      <p>{plan.guidance.summary}</p>
    </header>
    <div className="athlete-visual-grid">{plan.blocks.map((block) => <VisualBlock key={block.blockId} block={block}/>)}</div>
    <footer><p>{plan.guidance.nextCue}</p>
      {plan.event === 'SESSION_FINALIZATION' && <small>This review does not approve a plan or rewrite your assessment.</small>}
    </footer>
  </section>;
}
