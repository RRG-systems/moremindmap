/**
 * BA Visual Renderer V2 — presentation only.
 *
 * Renders projectBusinessEngineVisualV2(viewModel) fields.
 * Does not classify, infer, invent, or rewrite Business Engine intelligence.
 *
 * Progressive disclosure reveals existing projected contract content only.
 * Expansion never calls GPT, generates intelligence, or fetches runtime data.
 */

import { useState } from 'react';
import { projectBusinessEngineVisualV2 } from '../../lib/businessEngine/projectBusinessEngineVisualV2.js';
import MakeYourMapAlivePanel from './MakeYourMapAlivePanel.jsx';

export const BUSINESS_ENGINE_VISUAL_V2_WIDTH = 1672;
/** Minimum design height; canvas may grow with content for calm executive spacing. */
export const BUSINESS_ENGINE_VISUAL_V2_HEIGHT = 1780;

function Unavailable({ message }) {
  return <p className="bev2-unavailable">{message || 'Not available for this assessment'}</p>;
}

/**
 * Inline progressive disclosure — pure presentation of projected expansion payloads.
 * Supported labels: Explain → | Continue → | Show reasoning →
 * Architecture-compatible with future drawer / side sheet / modal without redesign.
 */
function ExpandableProse({ text, expansion, as = 'p', className = '' }) {
  const [open, setOpen] = useState(false);
  if (!text && !(expansion?.content && typeof expansion.content === 'string')) return null;

  const canExpand =
    Boolean(expansion?.available) &&
    typeof expansion?.content === 'string' &&
    expansion.content.trim().length > 0 &&
    expansion.content !== text;

  const body = open && canExpand ? expansion.content : text;
  const Tag = as === 'strong' ? 'strong' : as === 'div' ? 'div' : 'p';
  const label = open
    ? expansion?.collapse_label || 'Show less ←'
    : expansion?.label || 'Continue →';

  return (
    <div
      className="bev2-expandable"
      data-expansion-kind={expansion?.kind || undefined}
      data-expansion-open={canExpand && open ? 'true' : 'false'}
      data-subscription-compatible={expansion?.subscription_compatible ? 'true' : undefined}
    >
      <Tag className={className || undefined}>{body}</Tag>
      {canExpand ? (
        <button
          type="button"
          className="bev2-expand-toggle"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          {label}
        </button>
      ) : null}
    </div>
  );
}

function ExpandableList({ items, expansion, emptyLabel = '—' }) {
  const [open, setOpen] = useState(false);
  const base = Array.isArray(items) ? items.filter(Boolean) : [];
  const full =
    open && expansion?.available && Array.isArray(expansion.content) && expansion.content.length
      ? expansion.content.filter(Boolean)
      : base;
  const canExpand =
    Boolean(expansion?.available) &&
    Array.isArray(expansion?.content) &&
    expansion.content.length > base.length;

  if (!full.length) {
    return <p className="bev2-muted">{emptyLabel}</p>;
  }

  return (
    <div
      className="bev2-expandable-list"
      data-expansion-kind={expansion?.kind || undefined}
      data-expansion-open={canExpand && open ? 'true' : 'false'}
    >
      <ul>
        {full.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {canExpand ? (
        <button
          type="button"
          className="bev2-expand-toggle"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          {open ? expansion?.collapse_label || 'Show less ←' : expansion?.label || 'Explain →'}
        </button>
      ) : null}
    </div>
  );
}

function BrandMark() {
  return (
    <div className="bev2-brand">
      <span>The</span>
      <strong>
        M<span className="bev2-brand-o">O</span>RE
      </strong>
      <em>MindMap</em>
    </div>
  );
}

function formatMetricDisplayValue(metric) {
  const base = metric?.value ?? metric?.display_value ?? '';
  if (!base) return '';
  // Unit is contract-owned metadata; only append short non-money units for display.
  if (metric?.unit && metric.unit !== 'money' && metric.unit !== 'count' && !String(base).includes(String(metric.unit))) {
    return `${base} ${metric.unit}`;
  }
  return String(base);
}

function MetricPanel({
  title,
  metrics,
  extras,
  summary,
  summaryExpansion = null,
  tone = 'orange',
  honestAbsence,
  absenceMessage,
}) {
  const rows = Array.isArray(metrics) ? metrics : [];
  const extraRows = Array.isArray(extras) ? extras : [];
  const hasContent = rows.length > 0 || extraRows.length > 0 || summary;

  return (
    <section className={`bev2-panel bev2-metric-panel tone-${tone}`} data-region="metric-panel">
      <h2>{title}</h2>
      {!hasContent && honestAbsence ? (
        <Unavailable message={absenceMessage} />
      ) : (
        <>
          <div className="bev2-metric-list">
            {rows.map((metric) => {
              // Keep honesty signals, but only surface fallback in the primary scan path
              // to reduce visual fatigue. Full provenance remains on data attributes.
              const metaBits = [];
              if (metric.fallback_used) metaBits.push('fallback');
              return (
                <div
                  className="bev2-metric-row"
                  key={`${metric.id || metric.label}-${metric.value}`}
                  data-availability={metric.availability || 'available'}
                  data-fallback={metric.fallback_used ? 'true' : 'false'}
                  data-basis={metric.basis || undefined}
                  data-source={metric.source || undefined}
                  data-confidence={
                    metric.confidence != null && metric.confidence !== ''
                      ? String(metric.confidence)
                      : undefined
                  }
                >
                  <span>{metric.label}</span>
                  <strong>
                    {formatMetricDisplayValue(metric)}
                    {metaBits.length ? <em>{metaBits.join(' · ')}</em> : null}
                  </strong>
                </div>
              );
            })}
            {extraRows.map((metric) => (
              <div className="bev2-metric-row" key={`extra-${metric.label}`}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
          {summary ? (
            <ExpandableProse text={summary} expansion={summaryExpansion} className="bev2-panel-summary" />
          ) : null}
          {!hasContent ? <Unavailable /> : null}
        </>
      )}
    </section>
  );
}

/**
 * Trajectory presentation only. Direction, stage labels, and points must come from
 * contract-owned visualization semantics on the projected view — never hardcoded.
 * Communicates trend, direction, momentum, and risk without re-interpreting meaning.
 */
function TrajectoryPanel({ title, view, tone = 'orange' }) {
  const viz = view?.visualization || null;
  const direction = viz?.direction || 'unknown';
  const stageLabels = Array.isArray(viz?.stage_labels) ? viz.stage_labels : [];
  const points = Array.isArray(viz?.points) ? viz.points : null;
  const showChart =
    Boolean(view?.available) &&
    viz?.availability === 'available' &&
    Array.isArray(points) &&
    points.length > 0 &&
    direction !== 'unknown';

  const pathPoints =
    showChart && points
      ? points
          .map((point) => {
            const x = Math.round(Number(point.x) * 1000) / 10;
            const y = Math.round((1 - Number(point.y)) * 1000) / 10;
            return `${x},${y}`;
          })
          .join(' ')
      : '';

  const directionLabel =
    direction === 'rising'
      ? 'Rising'
      : direction === 'declining'
        ? 'Declining'
        : direction === 'stable'
          ? 'Stable'
          : direction === 'volatile'
            ? 'Volatile'
            : direction === 'mixed'
              ? 'Mixed'
              : null;

  const momentumLabel =
    direction === 'rising'
      ? 'Momentum up'
      : direction === 'declining'
        ? 'Momentum down'
        : direction === 'stable'
          ? 'Momentum flat'
          : direction === 'volatile' || direction === 'mixed'
            ? 'Momentum uneven'
            : null;

  return (
    <section
      className={`bev2-panel bev2-trend-panel tone-${tone}`}
      data-region="trajectory"
      data-direction={direction}
      data-viz-availability={viz?.availability || 'unavailable'}
    >
      <h2>{title}</h2>
      {!view?.available ? (
        <Unavailable message={view?.line || view?.caption} />
      ) : (
        <>
          {showChart ? (
            <div
              className={`bev2-mini-chart direction-${direction}`}
              data-shape={viz?.shape || 'none'}
              role="img"
              aria-label={viz?.accessibility_label || view.caption || title}
            >
              <span className="axis y1">High</span>
              <span className="axis y2">Mid</span>
              <span className="axis y3">Low</span>
              {pathPoints ? (
                <svg className="bev2-trend-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <polyline points={pathPoints} />
                </svg>
              ) : null}
              {points.map((point, index) => {
                const left = `${Math.round(Number(point.x) * 1000) / 10}%`;
                const bottom = `${Math.round(Number(point.y) * 1000) / 10}%`;
                return (
                  <i
                    key={`dot-${index}`}
                    className={`dot d${index + 1}${index === points.length - 1 ? ' tip' : ''}`}
                    style={{ left, bottom }}
                    data-point-index={index}
                  />
                );
              })}
              {stageLabels.map((label, index) => (
                <span
                  key={`stage-${index}-${label}`}
                  className={`stage-label stage-${index + 1}`}
                  style={
                    points[index]
                      ? { left: `${Math.round(Number(points[index].x) * 1000) / 10}%` }
                      : undefined
                  }
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}
          <div className="bev2-trend-readout">
            {directionLabel ? (
              <span className="bev2-chip bev2-direction-chip" data-direction={direction}>
                {directionLabel}
              </span>
            ) : null}
            {momentumLabel ? <span className="bev2-chip bev2-momentum-chip">{momentumLabel}</span> : null}
            {view.persistence_risk ? <span className="bev2-chip bev2-risk-chip">Risk</span> : null}
          </div>
          <strong className="bev2-trend-caption">{view.caption}</strong>
          <ExpandableProse
            text={view.line}
            expansion={view.summary_expansion}
            className="bev2-trend-line"
          />
          {view.persistence_risk ? (
            <em className="bev2-risk">
              <span>Persistence risk</span>
              <ExpandableProse text={view.persistence_risk} expansion={view.persistence_risk_expansion} as="div" />
            </em>
          ) : null}
          <div className="bev2-trend-meta">
            {view.confidence ? <span className="bev2-chip">Confidence: {view.confidence}</span> : null}
          </div>
        </>
      )}
    </section>
  );
}

function PillarCard({ item, tone }) {
  return (
    <div className={`bev2-pillar tone-${tone}`} data-region="pillar">
      <div className="bev2-pillar-orbit">
        <strong>{item.score ?? '—'}</strong>
        <em>{item.score != null ? '/10' : ''}</em>
      </div>
      <span>{item.title}</span>
      <p>{item.label}</p>
    </div>
  );
}

function LakeSection({ lake }) {
  if (!lake) return null;
  const currentDisplay =
    lake.flow?.current_true_relationships ?? lake.current_true_relationships ?? lake.current_size ?? '—';
  const targetDisplay =
    lake.flow?.target_true_relationships ?? lake.target_true_relationships ?? lake.target_size ?? '—';
  const gapDisplay = lake.flow?.gap || lake.gap || '—';
  const unitLabel = lake.center_unit_label || lake.label || 'TRUE RELATIONSHIPS';
  return (
    <section className="bev2-lake" data-region="relationship-lake">
      <div className="bev2-lake-title">
        <span>{lake.title}</span>
        <p>{lake.subtitle}</p>
      </div>
      <div className="bev2-lake-flow" aria-label="Current True Relationships to Target to Gap">
        <div className="bev2-lake-flow-step">
          <span>Current True Relationships</span>
          <strong>{currentDisplay}</strong>
        </div>
        <i className="bev2-lake-flow-arrow" aria-hidden="true">
          ↓
        </i>
        <div className="bev2-lake-flow-step">
          <span>Target True Relationships</span>
          <strong>{targetDisplay}</strong>
        </div>
        <i className="bev2-lake-flow-arrow" aria-hidden="true">
          ↓
        </i>
        <div className="bev2-lake-flow-step gap">
          <span>Gap</span>
          <strong>{gapDisplay}</strong>
        </div>
      </div>
      <div className="bev2-lake-grid">
        <div className="bev2-streams">
          <strong>Streams</strong>
          <span>How people enter the business</span>
          {lake.streams_fallback ? <em className="bev2-fallback-note">{lake.streams_note}</em> : null}
          {(lake.streams || []).length ? (
            lake.streams.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)
          ) : (
            <p className="bev2-muted">No stream intelligence available</p>
          )}
        </div>
        <div className="bev2-lake-core">
          <div className="bev2-lake-glow" />
          <div className="bev2-lake-water">
            <span>Current True</span>
            <strong>{currentDisplay}</strong>
            <em>{unitLabel}</em>
            {lake.quality ? <p className="bev2-quality">{lake.quality}</p> : <p>{lake.subtitle}</p>}
          </div>
          <div className="bev2-lake-gap">
            <span>Target True {targetDisplay}</span>
            <span>Gap {gapDisplay}</span>
          </div>
          {(lake.goal_summary || lake.goal_source || lake.total_contacts) && (
            <div className="bev2-lake-context">
              {lake.goal_summary ? <span>Goal: {lake.goal_summary}</span> : null}
              {lake.goal_source ? (
                <span className="bev2-lake-meta">
                  {lake.goal_source}
                  {lake.goal_confidence ? ` · ${lake.goal_confidence}` : ''}
                </span>
              ) : null}
              {/* Total contacts stay supporting context — never merged into lake center. */}
              {lake.total_contacts ? (
                <span className="bev2-lake-support">{lake.total_contacts} Total Contacts (supporting)</span>
              ) : null}
            </div>
          )}
          {lake.supporting_evidence?.length ? (
            <ul className="bev2-lake-evidence">
              {lake.supporting_evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="bev2-outflow">
          <strong>Outflow</strong>
          <span>What the lake produces</span>
          {lake.outflow_fallback ? <em className="bev2-fallback-note">{lake.outflow_note}</em> : null}
          {(lake.outflow || []).length ? (
            lake.outflow.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)
          ) : (
            <p className="bev2-muted">No outflow intelligence available</p>
          )}
        </div>
      </div>
    </section>
  );
}

function PatternBlock({ pattern }) {
  return (
    <section className="bev2-pattern" data-region="governing-business-pattern">
      <h3>{pattern.title}</h3>
      {!pattern.available ? (
        <Unavailable message={pattern.absence_message} />
      ) : (
        <>
          <strong className="bev2-pattern-name">{pattern.pattern_title}</strong>
          <ExpandableProse text={pattern.summary} expansion={pattern.summary_expansion} />
          <div className="bev2-pattern-cols">
            {pattern.momentum_sources?.length ? (
              <div>
                <span>Momentum</span>
                <ul>
                  {pattern.momentum_sources.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {pattern.drag_sources?.length ? (
              <div>
                <span>Drag</span>
                <ul>
                  {pattern.drag_sources.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

function BehavioralBlock({ behavioral }) {
  return (
    <section className="bev2-behavioral" data-region="behavioral-modifier">
      <h3>{behavioral.title}</h3>
      {!behavioral.available ? (
        <Unavailable message={behavioral.absence_message} />
      ) : (
        <>
          {behavioral.concise_explanation ? (
            <ExpandableProse
              text={behavioral.concise_explanation}
              expansion={behavioral.concise_explanation_expansion}
              className="bev2-behavioral-lead"
            />
          ) : null}
          <div className="bev2-behavioral-grid">
            {behavioral.behavioral_asset ? (
              <div>
                <span>Behavioral asset</span>
                <ExpandableProse
                  text={behavioral.behavioral_asset}
                  expansion={behavioral.behavioral_asset_expansion}
                />
              </div>
            ) : null}
            {behavioral.business_distortion_or_risk ? (
              <div>
                <span>Business risk</span>
                <ExpandableProse
                  text={behavioral.business_distortion_or_risk}
                  expansion={behavioral.business_distortion_or_risk_expansion}
                />
              </div>
            ) : null}
            {behavioral.implementation_implication ? (
              <div>
                <span>Implementation implication</span>
                <ExpandableProse
                  text={behavioral.implementation_implication}
                  expansion={behavioral.implementation_implication_expansion}
                />
              </div>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

function ConstraintBanner({ constraint }) {
  const state = constraint.state || 'ACTIVE';
  return (
    <section
      className="bev2-constraint-banner"
      data-region="primary-constraint"
      data-constraint-state={state}
    >
      <div className="bev2-constraint-icon" aria-hidden="true">
        !
      </div>
      <div>
        <div className="bev2-constraint-head">
          <h3>{constraint.title || 'PRIMARY CONSTRAINT'}</h3>
          <span className={`bev2-constraint-state state-${String(state).toLowerCase()}`}>{state}</span>
        </div>
        {!constraint.available ? (
          <Unavailable message={constraint.absence_message} />
        ) : (
          <>
            {/* Name only — no repeated subtype heading when category restates the name. */}
            <strong>{constraint.name}</strong>
            {constraint.category ? (
              <span className="bev2-constraint-category">{constraint.category}</span>
            ) : null}
            <ExpandableProse text={constraint.explanation} expansion={constraint.explanation_expansion} />
            {constraint.downstream_effects ? (
              <div className="bev2-downstream">
                <span>Downstream</span>
                <ExpandableProse
                  text={constraint.downstream_effects}
                  expansion={constraint.downstream_effects_expansion}
                />
              </div>
            ) : null}
            {constraint.supporting_evidence?.length ? (
              <div className="bev2-evidence">
                <ExpandableList
                  items={constraint.supporting_evidence}
                  expansion={constraint.supporting_evidence_expansion}
                />
              </div>
            ) : null}
            {constraint.confidence ? <span className="bev2-chip">Confidence: {constraint.confidence}</span> : null}
          </>
        )}
      </div>
    </section>
  );
}

function CausalChain({ chain }) {
  return (
    <section className="bev2-chain" data-region="causal-chain">
      {(chain || []).map((item, index) => (
        <div
          key={item.key || item.title}
          className={`bev2-chain-card ${item.emphasis ? 'emphasis' : ''} chain-${index}`}
        >
          <span>{item.title}</span>
          <ExpandableProse text={item.body} expansion={item.expansion} />
          {item.detail && item.detail !== item.body ? <em>{item.detail}</em> : null}
          {item.confidence ? <small>Confidence: {item.confidence}</small> : null}
        </div>
      ))}
    </section>
  );
}

function OneMovePanel({ oneMove }) {
  return (
    <section className="bev2-one-move" data-region="one-move">
      <div className="bev2-one-move-head">
        <span className="bev2-one-move-star" aria-hidden="true">
          ★
        </span>
        <h3>{oneMove.title}</h3>
      </div>
      {!oneMove.available ? (
        <Unavailable message={oneMove.absence_message} />
      ) : (
        <>
          <strong className="bev2-one-move-title">{oneMove.move_title}</strong>
          <ExpandableProse
            text={oneMove.recommendation}
            expansion={oneMove.recommendation_expansion}
            className="bev2-one-move-rec"
          />
          <div className="bev2-one-move-grid">
            {oneMove.why_selected ? (
              <div className="bev2-one-move-cell priority wide">
                <span>Why selected</span>
                <ExpandableProse text={oneMove.why_selected} expansion={oneMove.why_selected_expansion} />
              </div>
            ) : null}
            {oneMove.behavioral_fit ? (
              <div className="bev2-one-move-cell">
                <span>Behavioral Fit</span>
                <ExpandableProse
                  text={oneMove.behavioral_fit}
                  expansion={oneMove.behavioral_fit_expansion}
                />
              </div>
            ) : null}
            {oneMove.structural_fit ? (
              <div className="bev2-one-move-cell">
                <span>Structural Fit</span>
                <ExpandableProse
                  text={oneMove.structural_fit}
                  expansion={oneMove.structural_fit_expansion}
                />
              </div>
            ) : null}
            {oneMove.implementation ? (
              <div className="bev2-one-move-cell priority wide">
                <span>Implementation</span>
                <ExpandableProse
                  text={oneMove.implementation}
                  expansion={oneMove.implementation_expansion}
                />
              </div>
            ) : null}
            {oneMove.expected_downstream_effects ? (
              <div className="bev2-one-move-cell priority wide">
                <span>Expected Downstream Effects</span>
                <ExpandableProse
                  text={oneMove.expected_downstream_effects}
                  expansion={oneMove.expected_downstream_effects_expansion}
                />
              </div>
            ) : null}
            {oneMove.proof_target?.length ? (
              <div className="bev2-one-move-cell">
                <span>Proof Target</span>
                <ul>
                  {oneMove.proof_target.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {oneMove.review_period ? (
              <div className="bev2-one-move-cell">
                <span>Review Period</span>
                <p>{oneMove.review_period}</p>
              </div>
            ) : null}
          </div>
          {oneMove.confidence ? <span className="bev2-chip bev2-one-move-chip">Confidence: {oneMove.confidence}</span> : null}
        </>
      )}
    </section>
  );
}

function FutureOperatingPanel({ future }) {
  if (!future?.available && future?.honest_absence) {
    return (
      <section className="bev2-panel tone-green bev2-future-operating" data-region="future-operating-model">
        <h2>Future Operating Model</h2>
        <Unavailable message={future.absence_message} />
      </section>
    );
  }

  const rows = [
    { key: 'target_lake', label: 'Target Lake', value: future.target_lake, expansion: null },
    {
      key: 'required_systems',
      label: 'Required systems',
      value: future.required_systems,
      expansion: future.required_systems_expansion,
    },
    {
      key: 'expected_stabilization',
      label: 'Expected stabilization',
      value: future.expected_stabilization,
      expansion: future.expected_stabilization_expansion,
    },
    {
      key: 'expected_business_rhythm',
      label: 'Expected business rhythm',
      value: future.expected_business_rhythm,
      expansion: future.expected_business_rhythm_expansion,
    },
    {
      key: 'expected_production_effect',
      label: 'Expected production effect',
      value: future.expected_production_effect,
      expansion: future.expected_production_effect_expansion,
    },
    { key: 'time_to_effect', label: 'Time-to-effect', value: future.time_to_effect, expansion: null },
  ].filter((row) => row.value);

  if (!rows.length && !future.supported_doctrine_tokens?.length) return null;

  return (
    <section className="bev2-panel tone-green bev2-future-operating" data-region="future-operating-model">
      <h2>Future Operating Model</h2>
      <div className="bev2-future-operating-list">
        {rows.map((row) => (
          <div key={row.key} className="bev2-future-operating-row">
            <span>{row.label}</span>
            <ExpandableProse text={row.value} expansion={row.expansion} />
          </div>
        ))}
      </div>
      {future.supported_doctrine_tokens?.length ? (
        <div className="bev2-doctrine-tokens">
          {future.supported_doctrine_tokens.map((token) => (
            <span key={token} className="bev2-chip">
              {token}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Modeled Opportunity is archived from the executive surface.
 * Concepts retained via One Move + Future Operating Model + Future Trajectory.
 * Projection still carries the domain for contract honesty / fixtures.
 */
function ConfidencePanel({ confidence }) {
  // Core buckets preserved for Subscription architecture readiness.
  // Presented as longer supporting evidence — not a competing feature panel.
  const buckets = [
    { key: 'known', label: 'Known', items: confidence.known },
    { key: 'observed', label: 'Observed', items: confidence.observed },
    { key: 'inferred', label: 'Inferred', items: confidence.inferred },
    { key: 'missing', label: 'Missing', items: confidence.missing },
  ];
  // Assumed is secondary — still available when present.
  const assumed = confidence.assumed || [];

  return (
    <section
      className="bev2-confidence"
      data-region="confidence-reality"
      data-role="supporting-evidence"
      data-subscription-ready={confidence.subscription_ready ? 'true' : 'false'}
    >
      <div className="bev2-confidence-head">
        <h3>{confidence.title}</h3>
        <em>Supporting evidence</em>
      </div>
      {!confidence.available ? (
        <Unavailable message={confidence.absence_message} />
      ) : (
        <>
          <div className="bev2-confidence-score">
            {confidence.confidence_band ? <strong>{confidence.confidence_band}</strong> : null}
            {confidence.confidence_score ? <span>{confidence.confidence_score}</span> : null}
          </div>
          <div className="bev2-confidence-stack">
            {buckets.map((bucket) => (
              <div key={bucket.key} className={`bev2-confidence-bucket bucket-${bucket.key}`}>
                <span>{bucket.label}</span>
                {bucket.items?.length ? (
                  <ul>
                    {bucket.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="bev2-muted">—</p>
                )}
              </div>
            ))}
          </div>
          {assumed.length ? (
            <div className="bev2-confidence-assumed">
              <span>Assumed</span>
              <ul>
                {assumed.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {confidence.contradictions?.length ? (
            <div className="bev2-contradictions">
              <span>Contradictions</span>
              <ul>
                {confidence.contradictions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

/**
 * @param {object} props
 * @param {object} [props.viewModel] - pre-projected V2 view model
 * @param {object} [props.contract] - Business Engine Contract (if viewModel not provided)
 * @param {object} [props.normalized] - identity / contract carrier only; not a semantic metric source
 * @param {object} [props.data] - alias for normalized (VisualMap compatibility)
 * @param {{ checkoutState?: { loading?: string, error?: string }, onStartCheckout?: Function }} [props.subscriptionCheckout]
 *   Canonical Stripe subscription wiring from the route host (more_monthly_intelligence).
 * @param {boolean} [props.includeConversionPanel=true]
 *   When false, MAKE YOUR MAP ALIVE is omitted so the route host can render it
 *   outside BusinessArtifactViewer fit-scale (native responsive layout).
 *
 * Semantic content is projected only from the Business Engine Contract.
 * Page-context objects may supply identity defaults and embed the contract —
 * never currentMetrics / targetMetrics / trajectory meaning.
 * Subscription conversion is presentational chrome; it does not invent intelligence.
 */
export default function BusinessEngineVisualV2({
  viewModel,
  contract,
  normalized,
  data,
  subscriptionCheckout = null,
  includeConversionPanel = true,
}) {
  const pageContext = normalized || data || {};
  const sourceContract = contract || pageContext.businessEngineContract || null;

  // Identity-only defaults from surrounding page context are permitted.
  // Metric / trajectory / future semantics must come solely from the contract.
  const identityDefaults = {
    owner_name: pageContext.ownerName || null,
    owner_profile_type: pageContext.ownerProfileType || null,
    profile_id: pageContext.profileId || null,
    assessment_type: pageContext.assessmentType || null,
  };

  const vm =
    viewModel ||
    (sourceContract
      ? projectBusinessEngineVisualV2(sourceContract, {
          identity: identityDefaults,
        })
      : null);

  if (!vm) {
    return (
      <div className="bev2-canvas bev2-empty">
        <style>{styles}</style>
        <Unavailable message="Business Engine Contract is not available for this assessment." />
      </div>
    );
  }

  const s = vm.structural;
  const pillars = vm.business_engine?.pillars || [];
  const tones = ['orange', 'cyan', 'blue', 'purple', 'green'];

  return (
    <div
      className="ba-fixed-canvas bev2-canvas"
      data-renderer="business-engine-visual-v2"
      data-contract-version={vm.meta?.contract_version || ''}
      style={{
        '--ba-artifact-width': `${BUSINESS_ENGINE_VISUAL_V2_WIDTH}px`,
        '--ba-artifact-height': `${BUSINESS_ENGINE_VISUAL_V2_HEIGHT}px`,
      }}
    >
      <style>{styles}</style>
      <div className="bev2-bg-grid" aria-hidden="true" />

      <header className="bev2-header" data-region="header">
        <div className="bev2-logo-block">
          <BrandMark />
        </div>
        <div className="bev2-title-block">
          <h1>{s.product_title}</h1>
          <p>{s.tagline}</p>
          <div className="bev2-ribbon">
            {s.diagnosis_ribbon.map((label, i) => (
              <span key={label}>
                {i > 0 ? <i /> : null}
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="bev2-identity-block">
          <h2>{vm.identity.owner_name}</h2>
          <p>{vm.identity.role}</p>
          <span>
            Profile ID: <strong>{vm.identity.profile_id}</strong>
          </span>
          <span>
            Assessment: <strong>{vm.identity.assessment_type || 'Business Assessment'}</strong>
            {vm.identity.assessment_version ? ` · ${vm.identity.assessment_version}` : ''}
          </span>
          <span>
            {s.last_updated_label}: <strong>{vm.identity.last_updated || '—'}</strong>
          </span>
          <span className="bev2-snapshot-badge">{s.snapshot_label}</span>
        </div>
      </header>

      {/* Executive scan path: Current → Dashboard → Future → Constraint → Causal → One Move */}
      <div className="bev2-story-band bev2-story-upper" data-story="reality-engine-future">
        <div className="bev2-column-heads" aria-hidden="true">
          <div className="bev2-column-head role-current">
            <span>{s.left_column_title || 'YOUR CURRENT BUSINESS'}</span>
            <em>Current</em>
          </div>
          <div className="bev2-column-head role-engine">
            <span>{s.center_title || 'YOUR BUSINESS DASHBOARD'}</span>
            <em>Engine</em>
          </div>
          <div className="bev2-column-head role-future">
            <span>{s.right_column_title || 'YOUR FUTURE BUSINESS'}</span>
            <em>Future</em>
          </div>
        </div>
        <div className="bev2-body">
          <aside className="bev2-left" data-column-role="current">
            <MetricPanel
              title="Business Reality"
              metrics={vm.current_business_reality.metrics}
              extras={vm.current_business_reality.extras}
              summary={vm.current_business_reality.summary}
              summaryExpansion={vm.current_business_reality.summary_expansion}
              tone="orange"
              honestAbsence={!vm.current_business_reality.available}
              absenceMessage="Current business reality metrics were not available for this assessment."
            />
            <TrajectoryPanel title={s.trajectory_current_title} view={vm.current_trajectory} tone="orange" />
          </aside>

          <main className="bev2-center" data-column-role="engine">
            <div className="bev2-engine-head" data-region="business-engine-center">
              <strong>{vm.business_engine.subtitle}</strong>
            </div>

            {pillars.length ? (
              <div className="bev2-pillars">
                {pillars.map((item, index) => (
                  <PillarCard key={item.key} item={item} tone={tones[index % tones.length]} />
                ))}
              </div>
            ) : (
              <div className="bev2-panel">
                <Unavailable message="Business Engine dimension scores were not available for this assessment." />
              </div>
            )}
            {vm.business_engine.pillars_fallback && vm.business_engine.pillars_note ? (
              <p className="bev2-fallback-note center-note">{vm.business_engine.pillars_note}</p>
            ) : null}

            <LakeSection lake={vm.relationship_lake} />

            <div className="bev2-center-intel">
              <PatternBlock pattern={vm.governing_business_pattern} />
              <BehavioralBlock behavioral={vm.behavioral_modifier} />
            </div>
          </main>

          <aside className="bev2-right" data-column-role="future">
            <MetricPanel
              title="Future Metrics"
              metrics={vm.potential_business_future.metrics}
              summary={vm.potential_business_future.explanation}
              summaryExpansion={vm.potential_business_future.explanation_expansion}
              tone="green"
              honestAbsence={vm.potential_business_future.honest_absence}
              absenceMessage={vm.potential_business_future.absence_message}
            />
            <TrajectoryPanel
              title={s.trajectory_potential_title}
              view={vm.potential_trajectory}
              tone="green"
            />
            <FutureOperatingPanel future={vm.potential_business_future} />
          </aside>
        </div>
      </div>

      <div className="bev2-story-band bev2-story-constraint" data-story="constraint">
        <ConstraintBanner constraint={vm.primary_constraint} />
      </div>

      <div className="bev2-story-band bev2-story-chain" data-story="causal-chain">
        <CausalChain chain={vm.causal_chain} />
      </div>

      <div className="bev2-story-band bev2-story-action" data-story="one-move">
        <div className="bev2-lower">
          <OneMovePanel oneMove={vm.one_move} />
          <div className="bev2-lower-support">
            {/* Modeled Opportunity archived — covered by One Move / Future Operating Model / Trajectory */}
            {/* NEXT ACTION FOR SUBSCRIPTION placeholder removed — conversion lives in Make Your Map Alive */}
            <ConfidencePanel confidence={vm.confidence_reality} />
          </div>
        </div>
      </div>

      {/*
        Replaces repetitive One Move footer-intelligence echo with full-width
        subscription conversion: MAKE YOUR MAP ALIVE.
        Projection still carries footer + subscription_placeholder for contract honesty / fixtures.
        Production host (BusinessAssessmentVisualMap) sets includeConversionPanel=false and
        mounts MakeYourMapAlivePanel as BusinessArtifactViewer unscaledFooter so tablet/mobile
        reflow natively instead of shrinking under fit-scale.
      */}
      {includeConversionPanel ? (
        <footer className="bev2-footer-conversion" data-region="make-your-map-alive-footer">
          <MakeYourMapAlivePanel
            checkoutState={subscriptionCheckout?.checkoutState}
            onStartCheckout={subscriptionCheckout?.onStartCheckout}
            temporalMeta={{
              last_updated: vm.temporal?.last_updated,
              snapshot_label: s.snapshot_label,
              last_updated_label: s.last_updated_label,
            }}
          />
        </footer>
      ) : null}
    </div>
  );
}

const styles = `
/* ─────────────────────────────────────────────────────────────
   MMM8 Executive Information Architecture — presentation refinement
   Hierarchy: YOUR CURRENT BUSINESS → YOUR BUSINESS DASHBOARD → YOUR FUTURE BUSINESS
   Doctrine: summarize (complete thought) + progressive disclosure; no CSS clip / no "..."
   ───────────────────────────────────────────────────────────── */

.bev2-canvas.ba-fixed-canvas,
.bev2-canvas {
  position: relative;
  width: ${BUSINESS_ENGINE_VISUAL_V2_WIDTH}px;
  min-width: ${BUSINESS_ENGINE_VISUAL_V2_WIDTH}px;
  max-width: ${BUSINESS_ENGINE_VISUAL_V2_WIDTH}px;
  height: auto !important;
  min-height: ${BUSINESS_ENGINE_VISUAL_V2_HEIGHT}px;
  max-height: none;
  overflow: visible !important;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 22px 28px 24px;
  color: #f8fafc;
  border: 1px solid rgba(251, 146, 60, 0.28);
  border-radius: 14px;
  background:
    radial-gradient(circle at 50% 28%, rgba(14,165,233,0.10), transparent 32%),
    radial-gradient(circle at 72% 22%, rgba(132,204,22,0.06), transparent 28%),
    radial-gradient(circle at 24% 20%, rgba(249,115,22,0.08), transparent 30%),
    linear-gradient(165deg, #030303 0%, #07090d 46%, #010101 100%);
  box-shadow: inset 0 0 100px rgba(0,0,0,0.72), 0 0 48px rgba(249,115,22,0.10);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.bev2-empty {
  min-height: 320px;
  display: grid;
  place-items: center;
}

.bev2-bg-grid {
  position: absolute;
  inset: 0;
  opacity: 0.16;
  pointer-events: none;
  background-image:
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(0deg, rgba(255,255,255,0.02) 1px, transparent 1px);
  background-size: 96px 96px;
  mask-image: radial-gradient(circle at 50% 36%, black, transparent 78%);
}

.bev2-header,
.bev2-story-band,
.bev2-footer {
  position: relative;
  z-index: 2;
}

/* Major story bands — calm scroll rhythm */
.bev2-story-band {
  margin-top: 18px;
}
.bev2-story-upper { margin-top: 16px; }
.bev2-story-constraint { margin-top: 22px; }
.bev2-story-chain { margin-top: 16px; }
.bev2-story-action { margin-top: 20px; }

/* ── Header ── */
.bev2-header {
  display: grid;
  grid-template-columns: 220px 1fr 320px;
  gap: 20px;
  align-items: stretch;
  padding-bottom: 4px;
}

.bev2-logo-block {
  border-right: 1px solid rgba(255,255,255,0.12);
  padding-right: 14px;
}

.bev2-brand {
  display: flex;
  height: 100%;
  flex-direction: column;
  justify-content: center;
}

.bev2-brand span {
  color: rgba(255,255,255,0.58);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.32em;
}

.bev2-brand strong {
  margin-top: 2px;
  color: #ffffff;
  font-size: 44px;
  font-weight: 400;
  line-height: 0.9;
  letter-spacing: 0.1em;
}

.bev2-brand-o {
  color: #ff7a00;
  text-shadow: 0 0 16px rgba(249,115,22,0.55);
}

.bev2-brand em {
  margin-top: 8px;
  color: #fb923c;
  font-size: 13px;
  font-style: normal;
  text-transform: uppercase;
  letter-spacing: 0.34em;
}

.bev2-title-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 8px;
}

.bev2-title-block h1 {
  margin: 0;
  font-size: 32px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #fafafa;
  text-shadow: 0 0 24px rgba(255,255,255,0.08);
}

.bev2-title-block p {
  margin: 8px 0 0;
  color: #c4b5fd;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.bev2-ribbon {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px 14px;
  color: rgba(255,255,255,0.62);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.bev2-ribbon i {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 99px;
  background: #fb923c;
  box-shadow: 0 0 10px rgba(251,146,60,0.6);
}

.bev2-identity-block {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  border: 1px solid rgba(251,146,60,0.38);
  border-radius: 12px;
  padding: 14px 16px;
  background: rgba(0,0,0,0.38);
  box-shadow: inset 0 0 20px rgba(251,146,60,0.04);
}

.bev2-identity-block h2 {
  margin: 0 0 2px;
  font-size: 16px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #fff;
}

.bev2-identity-block p,
.bev2-identity-block span {
  margin: 0;
  color: rgba(255,255,255,0.72);
  font-size: 12px;
  line-height: 1.35;
}

.bev2-identity-block span { color: rgba(251,146,60,0.9); }
.bev2-identity-block strong { color: #f8fafc; font-weight: 600; }

.bev2-snapshot-badge {
  margin-top: 6px !important;
  display: inline-flex;
  align-self: flex-start;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(251,146,60,0.32);
  background: rgba(249,115,22,0.10);
  color: #fdba74 !important;
  font-size: 10px !important;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* ── Three-column upper story ── */
.bev2-column-heads {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr) 340px;
  gap: 16px;
  margin-bottom: 10px;
}
.bev2-column-head {
  text-align: center;
  padding: 8px 10px 6px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(0,0,0,0.22);
}
.bev2-column-head span {
  display: block;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: #fff;
  text-transform: uppercase;
}
.bev2-column-head em {
  display: block;
  margin-top: 4px;
  font-style: normal;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.42);
}
.bev2-column-head.role-current {
  border-color: rgba(251,146,60,0.35);
}
.bev2-column-head.role-current em { color: rgba(251,146,60,0.72); }
.bev2-column-head.role-engine {
  border-color: rgba(125,211,252,0.32);
  background: rgba(14,165,233,0.06);
}
.bev2-column-head.role-engine span {
  font-size: 15px;
  letter-spacing: 0.16em;
}
.bev2-column-head.role-engine em { color: rgba(125,211,252,0.78); }
.bev2-column-head.role-future {
  border-color: rgba(163,230,53,0.32);
}
.bev2-column-head.role-future em { color: rgba(190,242,100,0.72); }

.bev2-body {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr) 340px;
  gap: 16px;
  align-items: start;
}

.bev2-left,
.bev2-right,
.bev2-center {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.bev2-center {
  gap: 14px;
}

/* Panels — quieter chrome, clearer content */
.bev2-panel {
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(0,0,0,0.22));
  padding: 14px 16px;
  box-shadow: inset 0 0 18px rgba(0,0,0,0.22);
}

.bev2-panel h2,
.bev2-panel h3,
.bev2-pattern h3,
.bev2-behavioral h3,
.bev2-constraint-banner h3,
.bev2-one-move h3,
.bev2-confidence h3 {
  margin: 0 0 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.55);
}

.bev2-panel.tone-orange { border-color: rgba(251,146,60,0.32); }
.bev2-panel.tone-green { border-color: rgba(132,204,22,0.32); }

.bev2-metric-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bev2-metric-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  padding: 2px 0;
  font-size: 13px;
  line-height: 1.3;
}

.bev2-metric-row span {
  color: rgba(255,255,255,0.58);
  font-weight: 500;
}
.bev2-metric-row strong {
  color: #fff;
  text-align: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.01em;
}
.bev2-metric-row em {
  font-style: normal;
  font-size: 9px;
  color: rgba(251,191,36,0.75);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-top: 2px;
}

.bev2-panel-summary,
.bev2-panel p,
.bev2-expandable > p,
.bev2-expandable > div {
  margin: 10px 0 0;
  color: rgba(255,255,255,0.72);
  font-size: 12px;
  line-height: 1.45;
  overflow: visible;
  text-overflow: clip;
  white-space: normal;
  word-break: break-word;
}

/* Progressive disclosure — intentional affordance only (never mid-card "...") */
.bev2-expandable {
  display: block;
  min-width: 0;
}
.bev2-expandable > p:first-child,
.bev2-expandable > div:first-child,
.bev2-expandable > strong:first-child {
  margin-top: 0;
}
.bev2-expand-toggle {
  display: inline-flex;
  align-items: center;
  margin-top: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #fdba74;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: none;
  cursor: pointer;
  line-height: 1.3;
}
.bev2-expand-toggle:hover {
  color: #fb923c;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.bev2-expand-toggle:focus-visible {
  outline: 1px solid rgba(251,146,60,0.55);
  outline-offset: 3px;
  border-radius: 4px;
}

.bev2-structural-change p {
  color: rgba(255,255,255,0.8);
  font-size: 12.5px;
  line-height: 1.5;
}

/* Trajectory */
.bev2-mini-chart {
  position: relative;
  height: 92px;
  margin: 4px 0 12px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.06);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.025), transparent),
    radial-gradient(circle at 30% 60%, rgba(249,115,22,0.12), transparent 55%);
  overflow: hidden;
}

/* Direction tones are presentational only — positions from contract points. */
.bev2-mini-chart.direction-rising {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.025), transparent),
    radial-gradient(circle at 70% 40%, rgba(132,204,22,0.14), transparent 55%);
}
.bev2-mini-chart.direction-declining {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.025), transparent),
    radial-gradient(circle at 30% 60%, rgba(248,113,113,0.12), transparent 55%);
}
.bev2-mini-chart.direction-stable,
.bev2-mini-chart.direction-mixed,
.bev2-mini-chart.direction-volatile {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.025), transparent),
    radial-gradient(circle at 50% 50%, rgba(148,163,184,0.10), transparent 55%);
}

.bev2-mini-chart .axis {
  position: absolute;
  left: 8px;
  font-size: 9px;
  color: rgba(255,255,255,0.28);
  letter-spacing: 0.04em;
}
.bev2-mini-chart .y1 { top: 8px; }
.bev2-mini-chart .y2 { top: 40px; }
.bev2-mini-chart .y3 { bottom: 20px; }

.bev2-trend-path {
  position: absolute;
  inset: 10px 12px 22px 28px;
  width: calc(100% - 40px);
  height: calc(100% - 32px);
  overflow: visible;
  pointer-events: none;
}
.bev2-trend-path polyline {
  fill: none;
  stroke: rgba(251,146,60,0.72);
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}
.bev2-mini-chart.direction-rising .bev2-trend-path polyline { stroke: rgba(163,230,53,0.8); }
.bev2-mini-chart.direction-declining .bev2-trend-path polyline { stroke: rgba(248,113,113,0.8); }
.bev2-mini-chart.direction-stable .bev2-trend-path polyline,
.bev2-mini-chart.direction-mixed .bev2-trend-path polyline,
.bev2-mini-chart.direction-volatile .bev2-trend-path polyline {
  stroke: rgba(148,163,184,0.75);
}

.bev2-mini-chart .dot {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 99px;
  background: #fb923c;
  box-shadow: 0 0 8px rgba(251,146,60,0.7);
  transform: translate(-50%, 50%);
  /* left/bottom from contract visualization points */
}
.bev2-mini-chart .dot.tip {
  width: 10px;
  height: 10px;
  box-shadow: 0 0 12px currentColor;
}
.bev2-mini-chart.direction-rising .dot { background: #a3e635; box-shadow: 0 0 8px rgba(163,230,53,0.7); }
.bev2-mini-chart.direction-declining .dot { background: #f87171; box-shadow: 0 0 8px rgba(248,113,113,0.65); }
.bev2-mini-chart.direction-stable .dot,
.bev2-mini-chart.direction-mixed .dot,
.bev2-mini-chart.direction-volatile .dot {
  background: #94a3b8;
  box-shadow: 0 0 8px rgba(148,163,184,0.55);
}

.bev2-mini-chart .stage-label {
  position: absolute;
  bottom: 5px;
  font-size: 9px;
  color: rgba(255,255,255,0.36);
  transform: translateX(-40%);
  white-space: nowrap;
}

.bev2-trend-readout {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 2px 0 8px;
}
.bev2-momentum-chip {
  color: rgba(255,255,255,0.72) !important;
}
.bev2-risk-chip {
  border-color: rgba(248,113,113,0.4) !important;
  color: #fecaca !important;
}

.bev2-trend-caption {
  display: block;
  margin-top: 2px;
  color: #fdba74;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: 0.01em;
}
.bev2-trend-panel.tone-green .bev2-trend-caption { color: #bef264; }

.bev2-trend-line {
  margin: 6px 0 0 !important;
  color: rgba(255,255,255,0.74) !important;
  font-size: 12.5px !important;
  line-height: 1.45 !important;
}

.bev2-trend-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.bev2-direction-chip {
  text-transform: capitalize;
  opacity: 0.95;
  font-weight: 700 !important;
}
.bev2-direction-chip[data-direction="rising"] {
  border-color: rgba(163,230,53,0.4) !important;
  color: #bef264 !important;
}
.bev2-direction-chip[data-direction="declining"] {
  border-color: rgba(248,113,113,0.4) !important;
  color: #fecaca !important;
}

.bev2-risk {
  display: block;
  margin-top: 8px;
  color: rgba(254,202,202,0.9);
  font-size: 11.5px;
  font-style: normal;
  line-height: 1.4;
}
.bev2-risk span {
  display: block;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(254,202,202,0.55);
  margin-bottom: 2px;
}

/* ── Business Engine center (dominant) ── */
.bev2-engine-head {
  text-align: center;
  padding: 2px 10px 0;
}
.bev2-engine-head span {
  display: block;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: #fff;
  text-shadow: 0 0 20px rgba(255,255,255,0.12);
}
.bev2-engine-head strong {
  display: block;
  margin-top: 0;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255,255,255,0.58);
  letter-spacing: 0.02em;
}

.bev2-pillars {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.bev2-pillar {
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 12px;
  padding: 12px 8px 10px;
  text-align: center;
  background: rgba(0,0,0,0.26);
  transition: border-color 0.15s ease;
}
.bev2-pillar.tone-orange { border-color: rgba(251,146,60,0.38); }
.bev2-pillar.tone-cyan { border-color: rgba(34,211,238,0.38); }
.bev2-pillar.tone-blue { border-color: rgba(96,165,250,0.38); }
.bev2-pillar.tone-purple { border-color: rgba(192,132,252,0.38); }
.bev2-pillar.tone-green { border-color: rgba(163,230,53,0.38); }

.bev2-pillar-orbit {
  width: 48px;
  height: 48px;
  margin: 0 auto 8px;
  border-radius: 99px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255,255,255,0.16);
  background: radial-gradient(circle, rgba(255,255,255,0.07), rgba(0,0,0,0.42));
}
.bev2-pillar-orbit strong {
  font-size: 17px;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}
.bev2-pillar-orbit em {
  font-style: normal;
  font-size: 9px;
  color: rgba(255,255,255,0.45);
  margin-top: 1px;
  letter-spacing: 0.04em;
}
.bev2-pillar span {
  display: block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.72);
}
.bev2-pillar p {
  margin: 6px 0 0;
  font-size: 10.5px;
  line-height: 1.35;
  color: rgba(255,255,255,0.55);
}

/* Relationship Lake */
.bev2-lake {
  border: 1px solid rgba(56,189,248,0.28);
  border-radius: 14px;
  padding: 14px 14px 12px;
  background:
    radial-gradient(circle at 50% 55%, rgba(14,165,233,0.16), transparent 58%),
    rgba(0,0,0,0.24);
}

.bev2-lake-title {
  text-align: center;
  margin-bottom: 10px;
}
.bev2-lake-title span {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: #7dd3fc;
}
.bev2-lake-title p {
  margin: 5px 0 0;
  font-size: 11px;
  color: rgba(255,255,255,0.55);
}

/* Current True → Target True → Gap */
.bev2-lake-flow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0 0 12px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(125,211,252,0.18);
  background: rgba(14,165,233,0.06);
  flex-wrap: wrap;
}
.bev2-lake-flow-step {
  text-align: center;
  min-width: 88px;
}
.bev2-lake-flow-step span {
  display: block;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(186,230,253,0.7);
  margin-bottom: 3px;
}
.bev2-lake-flow-step strong {
  display: block;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  line-height: 1.1;
}
.bev2-lake-flow-step.gap strong { color: #fdba74; }
.bev2-lake-flow-arrow {
  font-style: normal;
  color: rgba(125,211,252,0.55);
  font-size: 12px;
  line-height: 1;
}

.bev2-lake-grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr 1fr;
  gap: 12px;
  align-items: stretch;
}
.bev2-lake-support {
  color: rgba(255,255,255,0.36) !important;
  font-style: italic;
}
.bev2-lake-evidence {
  position: relative;
  z-index: 1;
  margin: 8px 0 0;
  padding-left: 14px;
  font-size: 10px;
  line-height: 1.35;
  color: rgba(186,230,253,0.7);
  text-align: left;
  max-width: 220px;
}

.bev2-streams,
.bev2-outflow {
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 12px;
  background: rgba(0,0,0,0.18);
}
.bev2-streams strong,
.bev2-outflow strong {
  display: block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #7dd3fc;
}
.bev2-streams > span,
.bev2-outflow > span {
  display: block;
  margin: 3px 0 10px;
  font-size: 10px;
  color: rgba(255,255,255,0.42);
}
.bev2-streams p,
.bev2-outflow p {
  margin: 0 0 6px;
  font-size: 12px;
  line-height: 1.35;
  color: rgba(255,255,255,0.78);
}

.bev2-lake-core {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 176px;
}

.bev2-lake-glow {
  position: absolute;
  width: 176px;
  height: 176px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(56,189,248,0.28), transparent 70%);
  filter: blur(6px);
}

.bev2-lake-water {
  position: relative;
  z-index: 1;
  width: 168px;
  height: 168px;
  border-radius: 50%;
  border: 1.5px solid rgba(125,211,252,0.48);
  background:
    radial-gradient(circle at 40% 35%, rgba(125,211,252,0.22), transparent 45%),
    radial-gradient(circle at 50% 60%, rgba(14,165,233,0.30), rgba(2,6,23,0.92) 70%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  box-shadow: 0 0 36px rgba(14,165,233,0.22);
  padding: 14px;
}

.bev2-lake-water span {
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(186,230,253,0.85);
}
.bev2-lake-water strong {
  margin-top: 4px;
  font-size: 36px;
  font-weight: 700;
  line-height: 1;
  color: #fff;
  text-shadow: 0 0 16px rgba(125,211,252,0.5);
}
.bev2-lake-water em {
  margin-top: 4px;
  font-style: normal;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: #7dd3fc;
}
.bev2-lake-water p {
  margin: 6px 0 0;
  font-size: 10px;
  line-height: 1.3;
  color: rgba(255,255,255,0.62);
}

.bev2-lake-gap {
  position: relative;
  z-index: 1;
  margin-top: 10px;
  display: flex;
  gap: 14px;
  font-size: 11px;
  color: rgba(255,255,255,0.58);
  letter-spacing: 0.02em;
}

.bev2-lake-context {
  position: relative;
  z-index: 1;
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 10px;
  color: rgba(255,255,255,0.48);
  letter-spacing: 0.02em;
  text-align: center;
}

.bev2-lake-context .bev2-lake-meta {
  color: rgba(255,255,255,0.36);
  text-transform: capitalize;
}

/* Pattern + Behavioral */
.bev2-center-intel {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 12px;
}

.bev2-pattern,
.bev2-behavioral {
  border: 1px solid rgba(251,146,60,0.28);
  border-radius: 12px;
  padding: 14px;
  background: rgba(0,0,0,0.26);
}

.bev2-behavioral {
  border-color: rgba(192,132,252,0.32);
}

.bev2-pattern-name {
  display: block;
  color: #fdba74;
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 8px;
  line-height: 1.3;
}

.bev2-pattern p,
.bev2-behavioral p {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.45;
  color: rgba(255,255,255,0.76);
}

.bev2-pattern-cols {
  margin-top: 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.bev2-pattern-cols span,
.bev2-behavioral-grid span {
  display: block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.42);
  margin-bottom: 5px;
}
.bev2-pattern-cols ul,
.bev2-behavioral-grid ul,
.bev2-one-move ul,
.bev2-confidence ul,
.bev2-evidence {
  margin: 0;
  padding-left: 15px;
  color: rgba(255,255,255,0.7);
  font-size: 11.5px;
  line-height: 1.4;
}

.bev2-behavioral-lead {
  margin-bottom: 10px !important;
  color: #e9d5ff !important;
  font-size: 12.5px !important;
  line-height: 1.45 !important;
}

.bev2-behavioral-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ── Constraint (story beat) ── */
.bev2-constraint-banner {
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 14px;
  align-items: start;
  border: 1px solid rgba(248,113,113,0.42);
  border-radius: 14px;
  padding: 16px 18px;
  background: linear-gradient(100deg, rgba(127,29,29,0.28), rgba(0,0,0,0.22) 55%);
}

.bev2-constraint-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: rgba(248,113,113,0.16);
  border: 1px solid rgba(248,113,113,0.45);
  color: #fecaca;
  font-size: 16px;
  font-weight: 800;
}

.bev2-constraint-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}
.bev2-constraint-banner h3 {
  margin: 0 !important;
  color: rgba(254,202,202,0.7) !important;
}
.bev2-constraint-state {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid rgba(254,202,202,0.35);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: #fecaca;
  background: rgba(127,29,29,0.35);
}
.bev2-constraint-state.state-improving {
  border-color: rgba(163,230,53,0.4);
  color: #bef264;
  background: rgba(54,83,20,0.35);
}
.bev2-constraint-state.state-stabilized,
.bev2-constraint-state.state-resolved {
  border-color: rgba(125,211,252,0.4);
  color: #7dd3fc;
  background: rgba(12,74,110,0.35);
}
.bev2-constraint-state.state-emerging {
  border-color: rgba(251,191,36,0.45);
  color: #fde68a;
  background: rgba(120,53,15,0.35);
}

.bev2-constraint-banner strong {
  display: block;
  color: #fecaca;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.3;
}
.bev2-constraint-category {
  display: inline-block;
  margin-top: 4px;
  font-size: 11px;
  color: rgba(254,202,202,0.55);
  letter-spacing: 0.04em;
}
.bev2-constraint-banner p {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.45;
  color: rgba(255,255,255,0.8);
}
.bev2-downstream {
  margin-top: 8px;
  color: rgba(254,202,202,0.78);
  font-size: 12px;
}
.bev2-downstream > span {
  display: block;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(254,202,202,0.5);
  margin-bottom: 3px;
}
.bev2-evidence { margin-top: 8px; }
.bev2-evidence ul {
  margin: 0;
  padding-left: 15px;
}

/* ── Causal chain — unique intelligence only (3 panels) ── */
.bev2-chain {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.bev2-chain-card {
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 12px;
  padding: 12px 12px 14px;
  background: rgba(0,0,0,0.28);
  /* Fixed role, not fixed clip height — grow with complete executive thought */
  min-height: 132px;
  height: auto;
  overflow: visible;
}
.bev2-chain-card.emphasis {
  border-color: rgba(251,146,60,0.62);
  background: linear-gradient(180deg, rgba(249,115,22,0.16), rgba(0,0,0,0.32));
  box-shadow: 0 0 22px rgba(249,115,22,0.14);
}
.bev2-chain-card span {
  display: block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #fdba74;
  margin-bottom: 8px;
}
.bev2-chain-card p {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.4;
  color: rgba(255,255,255,0.84);
}
.bev2-chain-card em,
.bev2-chain-card small {
  display: block;
  margin-top: 8px;
  font-style: normal;
  font-size: 10.5px;
  color: rgba(255,255,255,0.42);
  line-height: 1.35;
}

/* ── Lower action row — One Move widened; Confidence Reality supporting ── */
.bev2-lower {
  display: grid;
  grid-template-columns: minmax(0, 2.45fr) minmax(260px, 0.85fr);
  gap: 16px;
  align-items: stretch;
}
.bev2-lower-support {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

/* Future operating model (doctrine-backed fields only) */
.bev2-future-operating-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bev2-future-operating-row span {
  display: block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(190,242,100,0.62);
  margin-bottom: 3px;
}
.bev2-future-operating-row p {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.4;
  color: rgba(255,255,255,0.82);
}
.bev2-doctrine-tokens {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.bev2-one-move {
  border: 1px solid rgba(251,146,60,0.72);
  border-radius: 14px;
  padding: 20px 22px 18px;
  min-width: 0;
  overflow: visible;
  background:
    radial-gradient(circle at 10% 12%, rgba(249,115,22,0.26), transparent 42%),
    linear-gradient(180deg, rgba(249,115,22,0.06), rgba(0,0,0,0.36));
  box-shadow:
    0 0 36px rgba(249,115,22,0.18),
    inset 0 1px 0 rgba(251,146,60,0.18);
}

.bev2-one-move-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.bev2-one-move-star {
  color: #fb923c;
  font-size: 18px;
  line-height: 1;
  text-shadow: 0 0 12px rgba(251,146,60,0.7);
}
.bev2-one-move-head h3 {
  margin: 0 !important;
  color: rgba(253,186,116,0.85) !important;
  font-size: 12px !important;
  letter-spacing: 0.16em !important;
}

.bev2-one-move-title {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: #fdba74;
  margin-bottom: 8px;
  line-height: 1.25;
  letter-spacing: 0.01em;
  overflow: visible;
  white-space: normal;
}
.bev2-one-move-rec {
  margin: 0 0 14px !important;
  font-size: 14.5px !important;
  line-height: 1.55 !important;
  color: rgba(255,255,255,0.92) !important;
  font-weight: 500 !important;
}
.bev2-one-move .bev2-expandable .bev2-one-move-rec {
  margin-bottom: 0 !important;
}
.bev2-one-move-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 18px;
}
.bev2-one-move-cell.wide {
  grid-column: 1 / -1;
}
.bev2-one-move-cell span {
  display: block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.42);
  margin-bottom: 4px;
}
.bev2-one-move-cell p,
.bev2-one-move-cell .bev2-expandable > p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: rgba(255,255,255,0.82);
  overflow: visible;
  white-space: normal;
}
.bev2-one-move-cell.priority p,
.bev2-one-move-cell.priority .bev2-expandable > p {
  color: rgba(255,255,255,0.92);
}
.bev2-one-move-chip {
  margin-top: 12px !important;
  border-color: rgba(251,146,60,0.35) !important;
  color: #fdba74 !important;
}

/* Confidence Reality — longer supporting evidence column (not competing feature) */
.bev2-confidence {
  border: 1px solid rgba(125,211,252,0.16);
  border-radius: 14px;
  padding: 16px 14px 14px;
  background: rgba(0,0,0,0.22);
  height: 100%;
  overflow: visible;
}
.bev2-confidence-head {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 10px;
}
.bev2-confidence-head h3 {
  margin: 0 !important;
}
.bev2-confidence-head em {
  font-style: normal;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(125,211,252,0.55);
}

.bev2-confidence-score {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
}
.bev2-confidence-score strong {
  font-size: 17px;
  font-weight: 700;
  color: #7dd3fc;
}
.bev2-confidence-score span {
  font-size: 13px;
  color: rgba(255,255,255,0.65);
}
/* Vertical evidence stack — cleaner than dense 2×2 competition with One Move */
.bev2-confidence-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bev2-confidence-bucket {
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  padding: 9px 10px 8px;
  background: rgba(0,0,0,0.16);
  min-height: 0;
  overflow: visible;
}
.bev2-confidence-bucket.bucket-known { border-color: rgba(125,211,252,0.2); }
.bev2-confidence-bucket.bucket-observed { border-color: rgba(163,230,53,0.18); }
.bev2-confidence-bucket.bucket-inferred { border-color: rgba(192,132,252,0.2); }
.bev2-confidence-bucket.bucket-missing { border-color: rgba(248,113,113,0.2); }
.bev2-confidence-stack span,
.bev2-confidence-assumed span,
.bev2-contradictions span {
  display: block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.42);
  margin-bottom: 4px;
}
.bev2-confidence-assumed,
.bev2-contradictions { margin-top: 10px; }
.bev2-confidence ul {
  margin: 0;
  padding-left: 15px;
  color: rgba(255,255,255,0.72);
  font-size: 11.5px;
  line-height: 1.45;
}

/* ── MAKE YOUR MAP ALIVE host slot (styles live on MakeYourMapAlivePanel) ── */
.bev2-footer-conversion {
  margin-top: 22px;
  padding-top: 0;
  border-top: none;
}

/* Shared atoms */
.bev2-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.12);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: rgba(255,255,255,0.62);
  background: rgba(255,255,255,0.03);
}

.bev2-unavailable {
  margin: 0;
  color: rgba(255,255,255,0.48);
  font-size: 12px;
  line-height: 1.45;
  font-style: italic;
}

.bev2-fallback-note {
  display: block;
  margin: 0 0 6px;
  font-size: 10px;
  line-height: 1.35;
  color: rgba(251,191,36,0.78);
  font-style: normal;
}
.bev2-fallback-note.center-note {
  text-align: center;
  margin: 0;
}

.bev2-muted {
  color: rgba(255,255,255,0.4) !important;
  font-style: italic;
}

/* Compact polish for narrower fit-scaled viewports (presentation only) */
@media (max-width: 900px) {
  .bev2-canvas {
    padding: 18px 18px 20px;
  }
  .bev2-lower {
    grid-template-columns: 1fr;
  }
}
`;
