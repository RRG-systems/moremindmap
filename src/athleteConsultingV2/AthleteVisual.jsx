import React from 'react';
import AthleteText from './AthleteText.jsx';
import './athlete-visual.css';

function ChangeValue({ value, lines }) {
  return Array.isArray(lines) && lines.every(line => typeof line === 'string')
    ? <ul>{lines.map((line, index) => <li key={index}>{line}</li>)}</ul> : <p>{value}</p>;
}

function SavedChangeDetails({ value }) {
  const details = Array.isArray(value.details) ? value.details : [];
  if (!details.length || value.kind !== 'MAP_CHANGE_REVEAL') return null;
  return <details className="athlete-visual-change-details">
    <summary>Review all saved changes</summary>
    {details.map((detail, index) => <article key={`${detail.path}-${index}`}>
      <h5>{detail.label}</h5>
      {detail.change_type === 'EVIDENCE' && <p className="athlete-visual-qualifier">Same wording, reviewed evidence</p>}
      {detail.change_type === 'ACCEPTED_PLAN' && <p className="athlete-visual-qualifier">Separately accepted plan</p>}
      <dl><div><dt>At the start of this session</dt><dd><ChangeValue value={detail.before} lines={detail.before_lines}/>
        {detail.before_rationale && <p>Why it fit then: {detail.before_rationale}</p>}</dd></div>
      <div><dt>Saved now</dt><dd><ChangeValue value={detail.now} lines={detail.now_lines}/>
        {detail.now_rationale && <p>Why it fits now: {detail.now_rationale}</p>}</dd></div></dl>
      {detail.evidence_note && <details className="athlete-visual-change-evidence">
        <summary>Recorded athlete review</summary><p>{detail.evidence_note}</p>
      </details>}
    </article>)}
  </details>;
}

function GovernedObject({ value }) {
  if (!value) return null;
  const items = Array.isArray(value.items) ? value.items : [];
  return <div className={`athlete-visual-object athlete-visual-object-${String(value.kind || 'plain').toLowerCase()}`}>
    <div className="athlete-visual-object-heading">
      {value.kind === 'MAP_CHANGE_REVEAL' ? <h4>{value.title}</h4> : <span>{value.title}</span>}
      {value.kind === 'PROPOSED_PLAN' && <small>Not yet agreed</small>}
      {value.kind === 'ACCEPTED_PLAN' && <small>Agreed plan</small>}
      {value.kind === 'APA_OPTION' && <small>Assessment option</small>}
    </div>
    {value.statement && (value.kind === 'SESSION_RECAP'
      ? <AthleteText value={value.statement} className="athlete-visual-statement"/>
      : <p className="athlete-visual-statement">{value.statement}</p>)}
    {value.qualifier && <p className="athlete-visual-qualifier">{value.qualifier}</p>}
    {items.length > 0 && <dl className="athlete-visual-items">{items.map((item, index) => <div key={`${value.id}-${index}`}>
      <dt>{item.label}</dt>
      {item.value && <dd>{item.value}</dd>}
      {item.note && <dd className="athlete-visual-item-note">{item.note}</dd>}
    </div>)}</dl>}
    <SavedChangeDetails value={value}/>
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
  const mapBlock = plan.event === 'SESSION_FINALIZATION'
    ? plan.blocks.find((block) => block.objects?.some((item) => item.kind === 'MAP_CHANGE_REVEAL')) : null;
  const mapChange = mapBlock?.objects.find((item) => item.kind === 'MAP_CHANGE_REVEAL');
  const remainingBlocks = mapChange ? plan.blocks.map((block) => {
    const objects = block.objects.filter((item) => item.id !== mapChange.id);
    const sourceIds = new Set(objects.flatMap((item) => item.sourceIds || []));
    return { ...block, objects, evidence: (block.evidence || []).filter((source) => sourceIds.has(source.id)) };
  }).filter((block) => block.objects.length) : plan.blocks;
  const mapSources = mapChange ? (mapBlock.evidence || []).filter((source) => mapChange.sourceIds.includes(source.id)) : [];
  return <section className={`athlete-visual athlete-visual-${event} ${className}`.trim()}
    aria-label={plan.guidance.headline} data-athlete-visual-event={plan.event}>
    <header className="athlete-visual-heading">
      <span>{plan.guidance.eyebrow}</span>
      <h3>{plan.guidance.headline}</h3>
      <p>{plan.guidance.summary}</p>
    </header>
    {mapChange && <section className="athlete-visual-map-reveal" aria-label={mapChange.title}>
      <GovernedObject value={mapChange}/>
      {mapSources.length > 0 && <details className="athlete-visual-sources"><summary>What this change view draws on</summary>
        <ul>{mapSources.map((source) => <li key={source.id}>{source.label}</li>)}</ul>
      </details>}
    </section>}
    {remainingBlocks.length > 0 && <div className="athlete-visual-grid">{remainingBlocks.map((block) => <VisualBlock key={block.blockId} block={block}/>)}</div>}
    <footer><p>{plan.guidance.nextCue}</p>
      {plan.event === 'SESSION_FINALIZATION' && <small>This review does not approve a plan or rewrite your assessment.</small>}
    </footer>
  </section>;
}
