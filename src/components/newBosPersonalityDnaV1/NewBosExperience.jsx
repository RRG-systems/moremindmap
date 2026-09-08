import { useMemo, useState } from 'react';
import {
  DESTINATIONS,
  DIMENSIONS,
  PRIOR_BAND_LABELS,
  SURFACES,
} from '../../lib/newBosPersonalityDnaV1/constants.js';
import { resolveCustomerTopProjection } from '../../lib/newBosPersonalityDnaV1/topProjection.js';
import NewBosVisualBos from './NewBosVisualBos.jsx';
import './newBosExperience.css';

const COLORS = ['#f4b860', '#f07f5a', '#e75d81', '#ac70da', '#7287e8', '#43a7c2', '#48b58e', '#a9bd55'];

function radialPoint(index, radius, center = 260) {
  const angle = (Math.PI * 2 * index) / DIMENSIONS.length - Math.PI / 2;
  return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius };
}

function contourPoints(scores) {
  return DIMENSIONS.map(({ id }, index) => {
    const radius = 42 + (scores[id] / 100) * 113;
    const point = radialPoint(index, radius);
    return `${point.x},${point.y}`;
  }).join(' ');
}

function compactBand(band) {
  if (band === 'higher_relative_prior') return 'Higher prior';
  if (band === 'lower_relative_prior') return 'Lower prior';
  return 'Context-sensitive';
}

function PersonalityDnaMap({ artifact }) {
  const projection = resolveCustomerTopProjection(artifact);
  const scores = projection.score_projection.scores;
  const bands = projection.score_projection.bands;
  return (
    <section className="nbos-map" data-testid="personality-dna-map">
      <div className="nbos-map-copy">
        <span className="nbos-kicker">Personality DNA Map · foundational architecture</span>
        <h2>{projection.personality_dna_map.identity_distillation}</h2>
        <p>{projection.personality_dna_map.central_tension}</p>
        <div className="nbos-map-key">
          <span><i className="known" /> exact score shapes the contour</span>
          <span><i className="open" /> a prior, never an identity</span>
        </div>
      </div>
      <div className="nbos-map-graphic">
        <svg viewBox="0 0 520 520" role="img" aria-label={`Eight-coordinate Personality DNA Map for ${artifact.identity_context.display_name}`}>
          {[52, 86, 120, 155].map((radius) => <circle key={radius} cx="260" cy="260" r={radius} className="nbos-map-ring" />)}
          {DIMENSIONS.map((dimension, index) => {
            const axis = radialPoint(index, 174);
            const label = radialPoint(index, 195);
            const scorePoint = radialPoint(index, 42 + (scores[dimension.id] / 100) * 113);
            const anchor = label.x < 90
              ? 'start'
              : label.x > 430
                ? 'end'
                : label.x < 230
                  ? 'end'
                  : label.x > 290
                    ? 'start'
                    : 'middle';
            const dy = label.y < 90 ? -4 : label.y > 430 ? 10 : 0;
            return (
              <g key={dimension.id}>
                <line x1="260" y1="260" x2={axis.x} y2={axis.y} className="nbos-map-axis" />
                <line x1={scorePoint.x} y1={scorePoint.y} x2={axis.x} y2={axis.y} className="nbos-map-guide" />
                <circle cx={scorePoint.x} cy={scorePoint.y} r="6" fill={COLORS[index]} />
                <text x={label.x} y={label.y + dy} textAnchor={anchor} className="nbos-map-label">{dimension.label}</text>
                <text x={label.x} y={label.y + 17 + dy} textAnchor={anchor} className="nbos-map-score">{scores[dimension.id]} · {compactBand(bands[dimension.id])}</text>
              </g>
            );
          })}
          <polygon points={contourPoints(scores)} className="nbos-map-shape" />
          <circle cx="260" cy="260" r="8" className="nbos-map-center" />
        </svg>
        <div className="nbos-map-mobile-labels">
          {DIMENSIONS.map((dimension, index) => (
            <article key={dimension.id}>
              <i style={{ background: COLORS[index] }} />
              <span>{dimension.label}<small>{PRIOR_BAND_LABELS[bands[dimension.id]]}</small></span>
              <strong>{scores[dimension.id]}</strong>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function SurfaceShell({ packet, className = '', children, embedded = false }) {
  const { rendering } = packet;
  if (embedded) return <div className={`nbos-governed-content ${className}`}>{children}</div>;
  return (
    <article className={`nbos-surface ${className}`} data-surface-id={packet.surface_id} data-testid={`surface-${packet.surface_id}`}>
      <header>
        <span>{String(packet.surface_number).padStart(2, '0')} · {rendering.eyebrow}</span>
        <h2>{rendering.headline}</h2>
      </header>
      <p className="nbos-surface-summary">{rendering.summary}</p>
      {children}
    </article>
  );
}

function HumanEvidence({ packet, refs = [], confidence, falsifier, boundary, label = 'Evidence and uncertainty' }) {
  const evidence = refs
    .map((ref) => packet.resolved_local_truth.evidence.find(({ evidence_id: id }) => id === ref))
    .filter(Boolean);
  if (!evidence.length && !confidence && !falsifier && !boundary) return null;
  return (
    <details className="nbos-truth-detail">
      <summary>{label}<span>+</span></summary>
      <div>
        {confidence && <p><b>Confidence</b>{confidence.replaceAll('_', ' ').toLowerCase()}</p>}
        {boundary && <p><b>Inference boundary</b>{boundary}</p>}
        {evidence.length > 0 && (
          <ul>{evidence.map((item) => <li key={item.evidence_id} data-evidence-id={item.evidence_id}>{item.exact_content}</li>)}</ul>
        )}
        {falsifier && <p><b>What would change our mind</b>{falsifier}</p>}
      </div>
    </details>
  );
}

function StandardSurface({ packet, embedded = false }) {
  const { rendering } = packet;
  return (
    <SurfaceShell packet={packet} embedded={embedded}>
      {rendering.highlights?.length > 0 && <ul className="nbos-highlight-list">{rendering.highlights.map((item) => <li key={item}>{item}</li>)}</ul>}
      <HumanEvidence
        packet={packet}
        refs={packet.resolved_local_truth.evidence.map(({ evidence_id: id }) => id)}
        falsifier={packet.resolved_local_truth.falsifiers[0]?.falsifier}
      />
    </SurfaceShell>
  );
}

function RecognitionSurface({ packet, embedded = false }) {
  const r = packet.rendering;
  return (
    <SurfaceShell packet={packet} className="nbos-recognition-surface" embedded={embedded}>
      <div className="nbos-recognition-moments">
        {r.recognizable_moments.map((moment, index) => <p key={moment}><span>0{index + 1}</span>{moment}</p>)}
      </div>
      <div className="nbos-mechanism-grid">
        {r.mechanisms.map((mechanism) => (
          <article key={mechanism.label}>
            <span>Governing mechanism</span>
            <h3>{mechanism.label}</h3>
            <p>{mechanism.explanation}</p>
            <HumanEvidence packet={packet} refs={mechanism.evidence_refs} confidence={mechanism.confidence} falsifier={mechanism.falsifier} />
          </article>
        ))}
      </div>
      <section className="nbos-private-calculations">
        <span>Private calculations we believe may be running</span>
        {r.private_calculations.map((calculation) => <p key={calculation}>{calculation}</p>)}
        <small>Bounded hypotheses—not invented inner quotations.</small>
      </section>
    </SurfaceShell>
  );
}

function PersonalitySurface({ packet, embedded = false }) {
  const r = packet.rendering;
  return (
    <SurfaceShell packet={packet} className="nbos-coordinate-surface" embedded={embedded}>
      <div className="nbos-coordinate-context"><p><b>Speed</b>{r.speed}</p><p><b>Temperature</b>{r.temperature}</p></div>
      <div className="nbos-coordinate-grid">
        {r.coordinate_explanations.map((item, index) => (
          <article key={item.coordinate_id}>
            <div><i style={{ background: COLORS[index] }} /><span>{item.label}</span><strong>{packet.resolved_local_truth.prior_coordinates[index]?.canonical_score}</strong></div>
            <p>{item.availability}</p>
            <small><b>Interaction</b>{item.interaction}</small>
            <small><b>It does not mean</b>{item.not_meaning}</small>
            <HumanEvidence packet={packet} refs={item.evidence_refs} confidence={item.confidence} />
          </article>
        ))}
      </div>
      <div className="nbos-synthesis-callout"><span>Cross-coordinate synthesis</span><p>{r.topology_summary}</p></div>
    </SurfaceShell>
  );
}

function OperatingSurface({ packet, embedded = false }) {
  const r = packet.rendering;
  return (
    <SurfaceShell packet={packet} embedded={embedded}>
      <ol className="nbos-operating-loop">{r.operating_loop.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol>
      <div className="nbos-mechanism-grid">
        {r.mechanisms.map((item) => <article key={item.label}><span>Operating mechanism</span><h3>{item.label}</h3><p>{item.explanation}</p><HumanEvidence packet={packet} refs={item.evidence_refs} confidence={item.confidence} falsifier={item.falsifier} /></article>)}
      </div>
    </SurfaceShell>
  );
}

function PeopleSurface({ packet, embedded = false }) {
  const r = packet.rendering;
  return (
    <SurfaceShell packet={packet} embedded={embedded}>
      <div className="nbos-state-grid">
        {r.states.map((state) => <article key={state.label}><span>{state.label}</span><p>{state.hypothesis}</p><HumanEvidence packet={packet} refs={state.evidence_refs} confidence={state.confidence} falsifier={state.falsifier} /></article>)}
      </div>
      <p className="nbos-boundary-note">{r.observer_boundary}</p>
    </SurfaceShell>
  );
}

function CommunicationSurface({ packet, embedded = false }) {
  const r = packet.rendering;
  return (
    <SurfaceShell packet={packet} embedded={embedded}>
      <div className="nbos-communication-anchors">
        <article><span>Speed</span><strong>{r.speed}</strong></article>
        <article><span>Temperature</span><strong>{r.temperature}</strong></article>
      </div>
      <div className="nbos-dimension-list">
        {r.dimensions.map((item) => (
          <article key={item.label}>
            <div><span>{item.label}</span><small>{item.continuum}</small></div>
            <p>{item.interpretation}</p>
            <HumanEvidence packet={packet} refs={item.evidence_refs} confidence={item.confidence} falsifier={item.falsifier} />
          </article>
        ))}
      </div>
    </SurfaceShell>
  );
}

function StrengthSurface({ packet, embedded = false }) {
  return (
    <SurfaceShell packet={packet} embedded={embedded}>
      <div className="nbos-causal-chains">
        {packet.rendering.mechanisms.map((item) => (
          <article key={item.strength}>
            <div><span>Strength</span><strong>{item.strength}</strong></div>
            <i>→</i><div><span>Immediate payoff</span><strong>{item.immediate_payoff}</strong></div>
            <i>→</i><div><span>Reinforcement</span><strong>{item.reinforcement}</strong></div>
            <i>→</i><div className="is-cost"><span>Delayed cost</span><strong>{item.delayed_cost}</strong></div>
            <p>{item.conditions}</p>
            <HumanEvidence packet={packet} refs={item.evidence_refs} confidence={item.confidence} falsifier={item.falsifier} />
          </article>
        ))}
      </div>
    </SurfaceShell>
  );
}

function PressureSurface({ packet, embedded = false }) {
  const r = packet.rendering;
  return (
    <SurfaceShell packet={packet} embedded={embedded}>
      <div className="nbos-pressure-flow">
        <article><span>Baseline</span><p>{r.baseline}</p></article><i>→</i>
        <article className="is-pressure"><span>Pressure</span><p>{r.pressure_state}</p></article><i>→</i>
        <article className="is-recovery"><span>Recovery</span><p>{r.recovery}</p></article>
      </div>
      <div className="nbos-transformation-grid">
        {r.transformations.map((item) => (
          <article key={item.label}><span>{item.label}</span><p><b>Normal</b>{item.baseline}</p><p><b>Under strain</b>{item.pressure_expression}</p><p><b>Return path</b>{item.recovery}</p><HumanEvidence packet={packet} refs={item.evidence_refs} confidence={item.confidence} falsifier={item.falsifier} /></article>
        ))}
      </div>
    </SurfaceShell>
  );
}

function WorkSurface({ packet, embedded = false }) {
  const r = packet.rendering;
  return (
    <SurfaceShell packet={packet} embedded={embedded}>
      <div className="nbos-fit-summary"><article><span>Natural contribution</span><p>{r.fit_summary}</p></article><article><span>Adaptation cost</span><p>{r.friction_summary}</p></article></div>
      <div className="nbos-work-demands">
        {r.demands.map((item) => <article key={item.demand}><h3>{item.demand}</h3><p><b>Natural fit</b>{item.natural_fit}</p><p><b>Adaptation cost</b>{item.adaptation_cost}</p><p><b>Sustainability</b>{item.sustainability}</p><HumanEvidence packet={packet} refs={item.evidence_refs} confidence={item.confidence} falsifier={item.falsifier} /></article>)}
      </div>
    </SurfaceShell>
  );
}

function RoleSurface({ packet, embedded = false }) {
  const r = packet.rendering;
  return (
    <SurfaceShell packet={packet} embedded={embedded}>
      <div className="nbos-selected-fit"><span>{r.selected_fit.replaceAll('_', ' ')}</span><p>{r.selected_configuration}</p></div>
      <div className="nbos-role-states">
        {r.fit_states.map((item) => <article key={item.fit_class} data-fit-class={item.fit_class}><span>{item.fit_class}</span><h3>{item.role_configuration}</h3><p>{item.reasoning}</p><HumanEvidence packet={packet} refs={item.evidence_refs} confidence={item.confidence} falsifier={item.falsifier} /></article>)}
      </div>
      <div className="nbos-scaffold"><span>Scaffolding that changes the fit</span><ul>{r.scaffolding.map((item) => <li key={item}>{item}</li>)}</ul><p>{r.plural_success_note}</p><small>Review trigger · {r.review_trigger}</small></div>
    </SurfaceShell>
  );
}

function CognitiveSurface({ packet, embedded = false }) {
  const r = packet.rendering;
  return (
    <SurfaceShell packet={packet} embedded={embedded}>
      <p className="nbos-boundary-note">{r.boundary}</p>
      <div className="nbos-cognitive-grid">
        {r.indicators.map((item) => <article key={item.indicator}><span>Supported indicator</span><h3>{item.indicator}</h3><p><b>Task demand</b>{item.task_demand}</p><p><b>Observed process</b>{item.observed_process}</p><p><b>Outcome</b>{item.outcome}</p><p><b>Correction / transfer</b>{item.correction_transfer}</p><small>Assistance · {item.assistance}</small><HumanEvidence packet={packet} refs={item.evidence_refs} confidence={item.confidence} falsifier={item.falsifier} /></article>)}
      </div>
    </SurfaceShell>
  );
}

function EnergySurface({ packet, embedded = false }) {
  const r = packet.rendering;
  return (
    <SurfaceShell packet={packet} embedded={embedded}>
      <div className="nbos-energy-layers">
        {Object.entries(r.layers).map(([label, layer]) => <article key={label} className={layer.status === 'INSUFFICIENT_EVIDENCE' ? 'is-open' : ''}><span>{label}</span><strong>{layer.status.replaceAll('_', ' ')}</strong><p>{layer.summary}</p><HumanEvidence packet={packet} refs={layer.evidence_refs} confidence={layer.status} falsifier={layer.falsifier} /></article>)}
      </div>
      <div className="nbos-energy-cycle"><p><b>Activation</b>{r.activation}</p><p><b>Depletion</b>{r.depletion}</p><p><b>Resilience boundary</b>{r.resilience}</p><p><b>Recovery</b>{r.recovery}</p></div>
    </SurfaceShell>
  );
}

function FuturesSurface({ packet, embedded = false }) {
  return (
    <SurfaceShell packet={packet} className="nbos-futures" embedded={embedded}>
      <div className="nbos-future-grid">
        {packet.rendering.futures.map((future, index) => (
          <details key={future.label}>
            <summary><b>{String(index + 1).padStart(2, '0')}</b><span><strong>{future.label}</strong><small>{future.condition}</small></span><i>+</i></summary>
            <div><p>{future.trajectory}</p>{future.mechanism && <p><b>Mechanism</b>{future.mechanism}</p>}{future.triggers && <p><b>Triggers</b>{future.triggers}</p>}{future.indicators && <p><b>Indicators</b>{future.indicators}</p>}{future.movers && <p><b>Movers</b>{future.movers}</p>}{future.horizon && <p><b>Horizon</b>{future.horizon}</p>}<HumanEvidence packet={packet} refs={future.evidence_refs} confidence={future.confidence} falsifier={future.falsifier} boundary={future.review_trigger ? `Review trigger: ${future.review_trigger}` : null} /></div>
          </details>
        ))}
      </div>
    </SurfaceShell>
  );
}

function OneMoveSurface({ packet, embedded = false }) {
  const r = packet.rendering;
  return (
    <SurfaceShell packet={packet} className="nbos-one-move" embedded={embedded}>
      <div className="nbos-move-core"><span>The experiment</span><h3>{r.intervention}</h3><p>{r.rationale}</p></div>
      <div className="nbos-move-grid">
        <p><b>Target mechanism</b>{r.target_mechanism}</p><p><b>Strength preserved</b>{r.strength_preserved}</p><p><b>Expected outcome</b>{r.expected_outcome}</p><p><b>Observable result</b>{r.observable_result}</p><p><b>Burden / friction</b>{r.burden}</p><p><b>Risk</b>{r.risk}</p><p><b>Reversibility</b>{r.reversibility}</p><p><b>Time horizon</b>{r.horizon}</p><p><b>Stop / adjust</b>{r.stop_adjust_condition}</p><p><b>Falsifier</b>{r.falsifier}</p>
      </div>
      <details className="nbos-alternatives"><summary>Alternatives considered <span>+</span></summary><ul>{r.alternatives_considered.map((item) => <li key={item}>{item}</li>)}</ul></details>
      <HumanEvidence packet={packet} refs={r.evidence_refs} confidence={r.confidence} falsifier={r.falsifier} />
    </SurfaceShell>
  );
}

function EvidenceSurface({ packet, embedded = false }) {
  const r = packet.rendering;
  const groups = [
    ['What we know', ['KNOWN']],
    ['What we strongly believe', ['STRONGLY_SUPPORTED']],
    ['What we’re still learning', ['SUPPORTED_HYPOTHESIS', 'TENTATIVE']],
    ['Where we are abstaining', ['INSUFFICIENT_EVIDENCE']],
  ];
  return (
    <SurfaceShell packet={packet} className="nbos-evidence" embedded={embedded}>
      <div className="nbos-validation-groups">
        {groups.map(([label, states]) => (
          <section key={label}><h3>{label}</h3>{r.claims.filter(({ confidence: state }) => states.includes(state)).map((claim) => <details key={claim.human_label} data-claim-id={claim.id || undefined}><summary><span>{claim.human_label}</span><i>+</i></summary><div><p>{claim.claim}</p><HumanEvidence packet={packet} refs={claim.evidence_refs} confidence={claim.confidence} falsifier={claim.falsifier} boundary={claim.inference_boundary} label="See the governed basis" /></div></details>)}</section>
        ))}
      </div>
      <div className="nbos-conflicts"><span>Where the evidence conflicts</span>{r.conflicts.map((item) => <p key={item}>{item}</p>)}</div>
      <div className="nbos-change-mind"><span>What would change our mind</span><ul>{r.what_would_change_the_map.map((item) => <li key={item}>{item}</li>)}</ul></div>
      <div className="nbos-validation">
        <span>Make your map alive</span>
        <p>Your BOS is our best current understanding of you.</p>
        <p>Next, your Business Assessment can connect who you are with how your business actually operates.</p>
        <p>If you choose MORE Subscription after your Business Assessment, you will have the opportunity to keep testing this map against real life—what changes, what works, what does not, what other people experience, and what outcomes occur.</p>
        <p>That future evidence can confirm, refine, or challenge what MORE believes today. The goal is not a fixed personality profile. It is a map that has the opportunity to become more true over time.</p>
      </div>
    </SurfaceShell>
  );
}

function IdentitySurface({ packet, embedded = false }) {
  const r = packet.rendering;
  return (
    <SurfaceShell packet={packet} className="nbos-identity-surface" embedded={embedded}>
      <div className="nbos-identity-logic"><span>Governing logic</span><p>{r.governing_logic}</p></div>
      <div className="nbos-identity-use"><span>Use it when</span><p>{r.memorable_use}</p></div>
      <p className="nbos-boundary-note">{r.not_a_type}</p>
      <HumanEvidence packet={packet} refs={r.evidence_refs} falsifier={r.falsifier} />
    </SurfaceShell>
  );
}

function RichSurface({ packet, embedded = false }) {
  switch (packet.surface_id) {
    case 'this_is_you': return <RecognitionSurface packet={packet} embedded={embedded} />;
    case 'personality_dna': return <PersonalitySurface packet={packet} embedded={embedded} />;
    case 'how_you_operate': return <OperatingSurface packet={packet} embedded={embedded} />;
    case 'how_people_experience_you': return <PeopleSurface packet={packet} embedded={embedded} />;
    case 'communication_dna': return <CommunicationSurface packet={packet} embedded={embedded} />;
    case 'strengths_vulnerabilities': return <StrengthSurface packet={packet} embedded={embedded} />;
    case 'pressure_conflict': return <PressureSurface packet={packet} embedded={embedded} />;
    case 'work_dna': return <WorkSurface packet={packet} embedded={embedded} />;
    case 'role_seat': return <RoleSurface packet={packet} embedded={embedded} />;
    case 'cognitive_operating_style': return <CognitiveSurface packet={packet} embedded={embedded} />;
    case 'personal_operating_energy': return <EnergySurface packet={packet} embedded={embedded} />;
    case 'five_futures': return <FuturesSurface packet={packet} embedded={embedded} />;
    case 'one_move': return <OneMoveSurface packet={packet} embedded={embedded} />;
    case 'evidence_certainty': return <EvidenceSurface packet={packet} embedded={embedded} />;
    case 'operating_identity': return <IdentitySurface packet={packet} embedded={embedded} />;
    default: return <StandardSurface packet={packet} embedded={embedded} />;
  }
}

function HumanProseInline({ text }) {
  return String(text).split(/(\*\*[^*\n]+\*\*)/u).map((part, index) => (
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={`${index}-${part}`}>{part.slice(2, -2)}</strong>
      : part
  ));
}

function humanProseBlocks(value) {
  const lines = String(value).replaceAll('\r\n', '\n').split('\n');
  const blocks = [];
  const special = /^(?:#{1,6}\s+|>\s?|[-*•]\s+|\d+\.\s+)/u;
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.+)$/u);
    if (heading) {
      blocks.push({ type: 'heading', text: heading[1] });
      index += 1;
      continue;
    }
    if (/^>\s?/u.test(line)) {
      const parts = [];
      while (index < lines.length && /^>\s?/u.test(lines[index].trim())) {
        parts.push(lines[index].trim().replace(/^>\s?/u, ''));
        index += 1;
      }
      blocks.push({ type: 'quote', text: parts.join(' ') });
      continue;
    }
    const listType = /^[-*•]\s+/u.test(line) ? 'unordered' : /^\d+\.\s+/u.test(line) ? 'ordered' : null;
    if (listType) {
      const pattern = listType === 'unordered' ? /^[-*•]\s+/u : /^\d+\.\s+/u;
      const items = [];
      while (index < lines.length && pattern.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(pattern, ''));
        index += 1;
      }
      blocks.push({ type: listType, items });
      continue;
    }
    const parts = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !special.test(lines[index].trim())) {
      parts.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: parts.join(' ') });
  }
  return blocks;
}

export function HumanRealizedSurface({
  packet,
  detailContent,
  detailLabel = 'Explore the evidence and operating detail',
  editorialHeadline = null,
  editorialEyebrow = null,
  visualContent = null,
  progressiveProse = false,
  progressiveProseLabel = 'Read the full understanding',
}) {
  const blocks = humanProseBlocks(packet.human_realization.customer_prose);
  const leadBlocks = progressiveProse ? blocks.slice(0, 1) : blocks;
  const laterBlocks = progressiveProse ? blocks.slice(1) : [];
  const renderBlocks = (items, keyPrefix) => items.map((block, index) => {
    const key = `${packet.surface_id}-${keyPrefix}-${index}`;
    if (block.type === 'heading') return <h3 key={key}><HumanProseInline text={block.text} /></h3>;
    if (block.type === 'quote') return <blockquote key={key}><HumanProseInline text={block.text} /></blockquote>;
    if (block.type === 'unordered') return <ul key={key}>{block.items.map((item, itemIndex) => <li key={`${key}-${itemIndex}`}><HumanProseInline text={item} /></li>)}</ul>;
    if (block.type === 'ordered') return <ol key={key}>{block.items.map((item, itemIndex) => <li key={`${key}-${itemIndex}`}><HumanProseInline text={item} /></li>)}</ol>;
    return <p key={key}><HumanProseInline text={block.text} /></p>;
  });
  return (
    <article className="nbos-surface nbos-human-surface" data-surface-id={packet.surface_id} data-testid={`surface-${packet.surface_id}`}>
      <header>
        <span>{String(packet.surface_number).padStart(2, '0')}{editorialEyebrow && <small>{editorialEyebrow}</small>}</span>
        <h2>{editorialHeadline ? <HumanProseInline text={editorialHeadline} /> : packet.label}</h2>
      </header>
      <div className="nbos-human-prose">
        {renderBlocks(leadBlocks, 'lead')}
      </div>
      {visualContent}
      {laterBlocks.length > 0 && <details className="nbos-narrative-detail">
        <summary>{progressiveProseLabel} <span>+</span></summary>
        <div className="nbos-human-prose">{renderBlocks(laterBlocks, 'detail')}</div>
      </details>}
      <details className="nbos-governed-detail" open={packet.surface_id === 'evidence_certainty'}>
        <summary>{detailLabel} <span>+</span></summary>
        {detailContent === undefined ? <RichSurface packet={packet} embedded /> : detailContent}
      </details>
    </article>
  );
}

function Surface({ packet }) {
  if (packet.human_realization) return <HumanRealizedSurface packet={packet} />;
  if (packet.rendering.depth_contract === 'rich_surface_v1') return <RichSurface packet={packet} />;
  return <StandardSurface packet={packet} />;
}

export default function NewBosExperience({
  artifactOverride = null,
  artifactChoices = [],
  customerMode = false,
  privateGate = false,
  runtimeLabel = null,
}) {
  const artifacts = useMemo(
    () => artifactOverride
      ? [artifactOverride]
      : artifactChoices,
    [artifactChoices, artifactOverride],
  );
  const [fixtureIndex, setFixtureIndex] = useState(0);
  const [destinationId, setDestinationId] = useState('recognition');
  if (!artifacts.length) {
    return <main className="nbos-shell"><p>New BOS realization unavailable.</p></main>;
  }
  const artifact = artifacts[fixtureIndex];
  const topProjection = resolveCustomerTopProjection(artifact);
  const destination = DESTINATIONS.find(({ id }) => id === destinationId);
  const packets = destination.surfaceIds.map((surfaceId) => artifact.surface_packets.find((packet) => packet.surface_id === surfaceId));

  return (
    <main className="nbos-shell" data-testid="new-bos-root" data-subject-token={artifact.subject_token}>
      <header className="nbos-topbar">
        <a href="/" className="nbos-mark" aria-label="MORE MindMap home">MORE<span>/</span>MINDMAP</a>
        <div><span>Personality DNA</span><strong>{customerMode ? 'Your governed Personality DNA' : privateGate ? 'Private real-profile HS gate' : 'Synthetic product lab'}</strong></div>
      </header>

      <section className="nbos-hero">
        <div>
          <span className="nbos-kicker">A map of one whole human</span>
          <h1>{artifact.identity_context.display_name}</h1>
          <p>{topProjection.hero.core_explanation}</p>
          <small>{artifact.identity_context.context}</small>
        </div>
        {customerMode ? null : privateGate ? (
          <div className="nbos-fixture-switcher" aria-label="Private candidate status">
            <button type="button" className="active" disabled><span>01</span>{artifact.identity_context.display_name}<small>Frozen gate candidate</small></button>
          </div>
        ) : (
          <div className="nbos-fixture-switcher" aria-label="Synthetic fixture selector">
            {artifacts.map((item, index) => (
              <button type="button" key={item.subject_token} className={index === fixtureIndex ? 'active' : ''} onClick={() => setFixtureIndex(index)}>
                <span>{String(index + 1).padStart(2, '0')}</span>{item.identity_context.display_name}{item.personality_dna.specialized_intelligence.version && <small>Depth proof</small>}
              </button>
            ))}
          </div>
        )}
      </section>

      <PersonalityDnaMap artifact={artifact} />

      <div className="nbos-nav-wrap">
        <nav className="nbos-nav" aria-label="BOS intelligence destinations">
          {DESTINATIONS.map((item) => <button type="button" key={item.id} className={item.id === destinationId ? 'active' : ''} onClick={() => setDestinationId(item.id)}>{item.label}{item.surfaceIds.length > 0 && <small>{item.surfaceIds.length}</small>}</button>)}
        </nav>
        <label className="nbos-nav-select"><span>Choose a destination</span><select value={destinationId} onChange={(event) => setDestinationId(event.target.value)}>{DESTINATIONS.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
      </div>

      {destination.experience === 'visual_bos' ? (
        <section className="nbos-content"><NewBosVisualBos artifact={artifact} /></section>
      ) : (
        <section className="nbos-content" aria-live="polite">
          <div className="nbos-section-intro"><span>{destination.label}</span><p>{packets.length} governed intelligence {packets.length === 1 ? 'surface' : 'surfaces'} · whole-state understanding, resolved local truth</p></div>
          {packets.map((packet) => <Surface key={packet.surface_id} packet={packet} />)}
        </section>
      )}

      <footer className="nbos-footer"><span>15/15 intelligence surfaces · 9 destinations</span><span>{runtimeLabel || (privateGate ? 'Private local candidate · persistence and production off' : 'Four fictional fixtures · provider and persistence off')}</span></footer>
    </main>
  );
}

export { SURFACES };
