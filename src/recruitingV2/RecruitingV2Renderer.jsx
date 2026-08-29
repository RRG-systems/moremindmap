import React from 'react';
import { scenarioChangeSet } from '../lib/recruitingV2/scenario.js';

function cx(...values) { return values.filter(Boolean).join(' '); }

const BLOCK_LABELS = Object.freeze({
  METRIC_STRIP: 'KEY NUMBERS', LINE_CHART: 'TREND', BAR_CHART: 'VISUAL COMPARISON', COMPARISON: 'COMPARISON',
  TIMELINE: 'WHAT CHANGED', FUNNEL: 'FLOW', TRAJECTORY: 'TRAJECTORY', FIVE_FUTURES: 'FIVE FUTURES',
  PERSON: 'PEOPLE + ROLES', RELATIONSHIP: 'WORKING RELATIONSHIP', CONSTRAINT: 'CURRENT CONSTRAINT', SCENARIO: 'SCENARIO',
  EVIDENCE_GAP: 'WHAT IS STILL UNKNOWN', HYPOTHESIS: 'MORE’S CURRENT HYPOTHESIS', COMMITMENTS: 'COMMITMENTS',
  DECISION: 'CURRENT ANSWER', PLAIN_LANGUAGE: 'PLAIN-LANGUAGE READ', QUESTION: 'QUESTION FOR THE TWO OF YOU',
});

function EvidenceButton({ block, onEvidence }) {
  if (!block.evidence?.length) return null;
  return <button className="rv2-evidence-link" onClick={() => onEvidence(block.evidence)} type="button">See {block.evidence.length} source{block.evidence.length === 1 ? '' : 's'}</button>;
}

function BlockFrame({ block, onEvidence, children }) {
  return (
    <section className={cx('rv2-block', `rv2-block--${block.emphasis.toLowerCase()}`, `rv2-block--${block.type.toLowerCase()}`)} data-block-type={block.type}>
      <div className="rv2-block__head">
        <div><span className="rv2-block__kind">{BLOCK_LABELS[block.type] || block.type.replaceAll('_', ' ')}</span><h2>{block.title}</h2><p>{block.subtitle}</p></div>
        <EvidenceButton block={block} onEvidence={onEvidence} />
      </div>
      {children}
    </section>
  );
}

function MetricStrip({ object }) {
  return <div className="rv2-metric-strip">{(object?.items || []).map((item) => <div className="rv2-metric" key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.note}</small></div>)}</div>;
}

function LineChart({ object }) {
  const series = object?.series || [];
  if (!series.length) return null;
  const width = 720; const height = 270; const padX = 42; const padY = 28;
  const values = series.map((item) => Number(item.value));
  const max = Math.max(...values, 1); const min = Math.min(...values, 0); const range = Math.max(max - min, 1);
  const points = series.map((item, index) => ({ ...item, x: padX + (index * (width - padX * 2)) / Math.max(series.length - 1, 1), y: padY + ((max - item.value) * (height - padY * 2)) / range }));
  const d = points.map((item, index) => `${index ? 'L' : 'M'} ${item.x} ${item.y}`).join(' ');
  const peak = series.reduce((current, item) => Number(item.value) > Number(current.value) ? item : current, series[0]);
  const latest = series.at(-1);
  const changeFromPeak = Number(peak.value) === 0 ? null : Math.round(((Number(latest.value) - Number(peak.value)) / Number(peak.value)) * 100);
  const formatValue = (value) => `${object.unit === '$M' ? '$' : ''}${value}${object.unit === '$M' ? 'M' : ` ${object.unit || ''}`}`;
  return (
    <div className="rv2-chart-wrap">
      <div className="rv2-chart-insight">
        <div><span>Peak</span><strong>{formatValue(peak.value)}</strong><small>{peak.label}</small></div>
        <div className="rv2-chart-insight__change"><span>Since peak</span><strong>{changeFromPeak > 0 ? '+' : ''}{changeFromPeak}%</strong><small>to {formatValue(latest.value)}</small></div>
        <p>{object.summary}</p>
      </div>
      <svg className="rv2-line-chart" role="img" aria-label={`${object.title}. ${object.summary}`} viewBox={`0 0 ${width} ${height}`}>
        <defs><linearGradient id={`fill-${object.id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#78f0c5" stopOpacity=".28"/><stop offset="1" stopColor="#78f0c5" stopOpacity="0"/></linearGradient></defs>
        {[0, .25, .5, .75, 1].map((ratio) => <line key={ratio} x1={padX} x2={width-padX} y1={padY+ratio*(height-padY*2)} y2={padY+ratio*(height-padY*2)} className="rv2-gridline" />)}
        <path d={`${d} L ${points.at(-1).x} ${height-padY} L ${points[0].x} ${height-padY} Z`} fill={`url(#fill-${object.id})`} />
        <path d={d} className="rv2-chart-line" />
        {points.map((item) => <g key={item.label}><circle cx={item.x} cy={item.y} r="5" className="rv2-chart-dot"/><text x={item.x} y={height-7} textAnchor="middle" className="rv2-axis-label">{item.label.replace('20', '’')}</text><text x={item.x} y={item.y-12} textAnchor="middle" className="rv2-value-label">{object.unit === '$M' ? '$' : ''}{item.value}{object.unit === '$M' ? 'M' : ''}</text></g>)}
      </svg>
    </div>
  );
}

function BarChart({ object }) {
  const items = object?.series || object?.items || [];
  const values = items.map((item) => Number(item.value ?? item.support ?? 0));
  const max = Math.max(...values, 1);
  return <div className="rv2-bars">{items.map((item, index) => <div className="rv2-bar-row" key={item.label}><span>{item.label}</span><div className="rv2-bar-track"><i style={{ width: `${(values[index] / max) * 100}%` }} /></div><strong>{item.value ?? `${item.support}%`}</strong></div>)}</div>;
}

function Funnel({ object }) {
  return <div className="rv2-funnel">{(object?.stages || []).map((stage, index) => <div className="rv2-funnel__row" style={{ width: `${100 - index * 8}%` }} key={stage.label}><span>{stage.label}</span><strong>{stage.value ?? 'Unknown'}</strong><small>{stage.status.toLowerCase().replaceAll('_', ' ')}</small></div>)}</div>;
}

function Futures({ object }) {
  const items = object?.items || [];
  const colors = ['#8d9a95', '#6dd7e7', '#78f0c5', '#a98cf5', '#f092a6'];
  const endYs = [38, 92, 148, 204, 258];
  return <div className="rv2-futures">
    <div className="rv2-futures__visual">
      <div className="rv2-futures__now"><span>NOW</span><strong>Jordan’s business</strong></div>
      <svg viewBox="0 0 620 296" role="img" aria-label={`${object?.title}. ${object?.semantics}`}>
        <line x1="72" y1="148" x2="574" y2="148" className="rv2-future-axis"/>
        {items.map((item, index) => {
          const endY = endYs[index];
          const weight = 1.8 + Number(item.support || 0) / 13;
          return <g key={item.label}>
            <path d={`M 72 148 C 220 148, 330 ${endY}, 555 ${endY}`} fill="none" stroke={colors[index]} strokeWidth={weight} opacity={index === 2 ? 1 : .62}/>
            <circle cx="555" cy={endY} r={index === 2 ? 7 : 5} fill="#0d1211" stroke={colors[index]} strokeWidth="2"/>
            <text x="575" y={endY - 4} className="rv2-future-svg-label">{item.label}</text>
            <text x="575" y={endY + 11} className="rv2-future-svg-support">{item.support} relative support</text>
          </g>;
        })}
      </svg>
    </div>
    <div className="rv2-futures__meanings">{items.map((item, index) => <article key={item.label} className={cx(index === 2 && 'rv2-future--focus')} style={{ '--future-color': colors[index] }}><span>{item.label}</span><strong>{item.support}</strong><p>{item.meaning}</p></article>)}</div>
    <p className="rv2-semantic-note">{object?.semantics}</p>
  </div>;
}

function Timeline({ object }) {
  return <div className="rv2-timeline">{(object?.items || []).map((item) => <article key={`${item.label}-${item.title}`}><span>{item.label}</span><div><h3>{item.title}</h3><p>{item.detail}</p></div></article>)}</div>;
}

function PersonView({ objects }) {
  return <div className="rv2-people">{objects.filter((item) => item.kind === 'PERSON').map((person, index) => <article key={person.id} className={index % 2 ? 'rv2-person-card--violet' : 'rv2-person-card--cyan'}><header><span className="rv2-avatar">{person.title.slice(0,1)}</span><div><small>{person.role}</small><h3>{person.title}</h3></div></header><div className="rv2-person-card__signal"><span>Works best when</span><p>{person.summary}</p></div><div className="rv2-person-card__intent"><span>What matters</span><p>{person.motivation}</p></div><footer>{person.caution}</footer></article>)}</div>;
}

function Relationship({ object }) {
  return <div className="rv2-relationship"><div className="rv2-person-node rv2-person-node--darren"><b>D</b><span>Darren</span><small>can offer only supported help</small></div><div className="rv2-relationship__bridge"><span>SUPPORTED GAP</span><i/><strong>Evidence + mutual choice</strong><i/><span>DURABLE HELP</span></div><div className="rv2-person-node rv2-person-node--jordan"><b>J</b><span>Jordan</span><small>defines whether the relationship helps</small></div><p>{object?.statement}</p><strong>{object?.status?.toLowerCase()}</strong></div>;
}

function Constraint({ objects }) {
  const twin = objects.find((item) => item.kind === 'BUSINESS_TWIN');
  const gap = objects.find((item) => item.kind === 'EVIDENCE_GAP');
  const move = objects.find((item) => item.kind === 'INTERVENTION');
  return <div className="rv2-constraint"><div><span>Current hypothesis</span><p>{twin?.constraint || gap?.title}</p></div><div className="rv2-causal-arrow">does not yet prove</div><div><span>Bounded response</span><p>{move?.statement || twin?.goal}</p></div></div>;
}

function EvidenceGap({ object }) {
  return <div className="rv2-evidence-gap"><div><span>Still missing</span><ul>{(object?.missing || []).slice(0,5).map((item) => <li key={item}>{item}</li>)}</ul></div><div><span>Reasons to stay open</span><ul>{(object?.counterevidence || []).slice(0,4).map((item) => <li key={item}>{item}</li>)}</ul></div>{object?.mindChange && <p><strong>What would change MORE’s view:</strong> {object.mindChange}</p>}</div>;
}

function Opportunity({ object }) {
  return <div className="rv2-opportunities">{(object?.items || []).map((item) => <article key={item.label} className={`rv2-opportunity rv2-opportunity--${item.status.toLowerCase()}`}><span>{item.status.replaceAll('_', ' ')}</span><p>{item.label}</p></article>)}</div>;
}

function Scenario({ object, values, onChange, onApply }) {
  const assumptions = object?.assumptions || [];
  const change = scenarioChangeSet(object, values);
  const formatAssumption = (item, value) => `${item.unit === '$' ? '$' : ''}${Number(value).toLocaleString()}${item.unit === 'hrs' ? ' hrs' : ''}`;
  const formatSigned = (value) => `${value >= 0 ? '+' : '−'}$${Math.abs(value).toLocaleString()}`;
  return <div className="rv2-scenario" data-scenario-changed={change.changed.length > 0 ? 'true' : 'false'}>
    <div className="rv2-scenario__assumptions">
      <div className="rv2-scenario__label"><span>Change an assumption</span><small>The modeled consequence updates immediately.</small></div>
      {assumptions.map((item) => <div className="rv2-assumption" key={item.id} data-assumption-changed={change.changed.some((entry) => entry.id === item.id) ? 'true' : 'false'}>
        <label htmlFor={`rv2-scenario-${item.id}`}><span>{item.label}</span><strong>{formatAssumption(item, change.values[item.id])}</strong></label>
        <div><button type="button" aria-label={`Decrease ${item.label}`} disabled={change.values[item.id] <= item.min} onClick={() => onChange(item.id, Math.max(item.min, change.values[item.id] - item.step))}>−</button><input id={`rv2-scenario-${item.id}`} aria-label={item.label} type="range" min={item.min} max={item.max} step={item.step} value={change.values[item.id]} onChange={(event) => onChange(item.id, Number(event.target.value))}/><button type="button" aria-label={`Increase ${item.label}`} disabled={change.values[item.id] >= item.max} onClick={() => onChange(item.id, Math.min(item.max, change.values[item.id] + item.step))}>+</button></div>
        {change.changed.some((entry) => entry.id === item.id) && <small>Changed from {formatAssumption(item, item.value)}</small>}
      </div>)}
    </div>
    <div className="rv2-scenario__arrow" aria-hidden="true"><i/><span>changes</span><b>→</b></div>
    <div className="rv2-scenario__result" aria-live="polite"><span>Modeled monthly consequence</span><strong className={change.currentNet >= 0 ? 'positive' : 'negative'}>{formatSigned(change.currentNet)}</strong><div className="rv2-scenario__delta"><span>Baseline {formatSigned(change.baselineNet)}</span><b>{change.consequenceDelta === 0 ? 'No change yet' : `${formatSigned(change.consequenceDelta)} from baseline`}</b></div><small>Modeled—not observed. Taxes, ramp time, variability, margin, and whether the hours are truly transferable did not change.</small></div>
    <p className="rv2-formula"><strong>What recalculated:</strong> {object?.formula}. <span>{object?.warning}</span></p>
    <button type="button" className="rv2-secondary-button" disabled={!change.changed.length} onClick={() => onApply(change.values)}>{change.changed.length ? 'Ask MORE what this changes' : 'Change an assumption first'}</button>
  </div>;
}

function Hypotheses({ hypotheses, onHypothesis }) {
  return <div className="rv2-hypotheses">{hypotheses.map((item) => <article key={item.hypothesisId}><div><span>MORE hypothesis · {item.confidence.toLowerCase()}</span><h3>{item.statement}</h3><p>{item.revisionReason}</p></div><div className="rv2-hypothesis-actions"><button type="button" onClick={() => onHypothesis(item, 'ACCEPT')}>That fits</button><button type="button" onClick={() => onHypothesis(item, 'CONTEST')}>I’m not sure</button><button type="button" onClick={() => onHypothesis(item, 'REJECT')}>That’s not it</button></div></article>)}</div>;
}

function GenericObjects({ objects }) {
  return <div className="rv2-generic">{objects.map((item) => <article key={item.id}><span>{item.kind.replaceAll('_', ' ')}</span><h3>{item.title}</h3><p>{item.statement || item.summary || item.goal || item.proof || item.description}</p></article>)}</div>;
}

export default function RecruitingV2Renderer({ plan, onEvidence, onHypothesis, scenarioValues, onScenarioChange, onScenarioApply }) {
  if (!plan) return null;
  return <div className="rv2-renderer" data-plan-version={plan.planVersion}>{plan.blocks.map((block) => {
    const first = block.objects[0];
    let content;
    switch (block.type) {
      case 'METRIC_STRIP': content = <MetricStrip object={block.objects.find((item) => item.kind === 'METRICS') || first}/>; break;
      case 'LINE_CHART': content = <LineChart object={block.objects.find((item) => item.kind === 'TIME_SERIES') || first}/>; break;
      case 'BAR_CHART': content = <BarChart object={first}/>; break;
      case 'FUNNEL': content = <Funnel object={block.objects.find((item) => item.kind === 'FUNNEL') || first}/>; break;
      case 'FIVE_FUTURES': content = <Futures object={block.objects.find((item) => item.kind === 'FUTURES') || first}/>; break;
      case 'TRAJECTORY': content = block.objects.some((item) => item.kind === 'FUTURES')
        ? <Futures object={block.objects.find((item) => item.kind === 'FUTURES')}/>
        : <LineChart object={block.objects.find((item) => item.kind === 'TIME_SERIES') || first}/>;
        break;
      case 'TIMELINE': content = <Timeline object={block.objects.find((item) => item.kind === 'TIMELINE') || first}/>; break;
      case 'PERSON': content = <PersonView objects={block.objects}/>; break;
      case 'RELATIONSHIP': content = <Relationship object={block.objects.find((item) => item.kind === 'RELATIONSHIP') || first}/>; break;
      case 'CONSTRAINT': content = <Constraint objects={block.objects}/>; break;
      case 'EVIDENCE_GAP': content = <EvidenceGap object={block.objects.find((item) => item.kind === 'EVIDENCE_GAP') || first}/>; break;
      case 'SCENARIO': content = <Scenario object={block.objects.find((item) => item.kind === 'SCENARIO') || first} values={scenarioValues} onChange={onScenarioChange} onApply={onScenarioApply}/>; break;
      case 'HYPOTHESIS': content = <Hypotheses hypotheses={plan.hypotheses} onHypothesis={onHypothesis}/>; break;
      case 'COMPARISON': content = block.objects.some((item) => item.kind === 'LOCAL_OPPORTUNITY') ? <Opportunity object={block.objects.find((item) => item.kind === 'LOCAL_OPPORTUNITY')}/> : <BarChart object={first}/>; break;
      default: content = <GenericObjects objects={block.objects}/>;
    }
    return <BlockFrame block={block} onEvidence={onEvidence} key={block.blockId}>{content}</BlockFrame>;
  })}{plan.hypotheses.length > 0 && !plan.blocks.some((block) => block.type === 'HYPOTHESIS') && (
    <section className="rv2-block rv2-block--secondary rv2-block--hypothesis" data-block-type="HYPOTHESIS">
      <div className="rv2-block__head"><div><span className="rv2-block__kind">MORE HYPOTHESES · REVISABLE</span><h2>What MORE currently thinks may be happening</h2><p>These are not facts. Either human can strengthen, contest, or reject them and the environment will change.</p></div></div>
      <Hypotheses hypotheses={plan.hypotheses} onHypothesis={onHypothesis}/>
    </section>
  )}</div>;
}
