import { useEffect, useMemo, useState } from 'react';
import { buildVisualBosModel } from '../../lib/newBosPersonalityDnaV1/visualBosModel.js';

function Pattern({ rank, value }) {
  return (
    <article className="nbos-vbos-pattern">
      <span>{rank}</span>
      <strong>{value}</strong>
    </article>
  );
}

function FlowList({ label, items, side }) {
  return (
    <section className={`nbos-vbos-flow nbos-vbos-flow--${side}`}>
      <span>{label}</span>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}

function Core({ model, compact = false }) {
  return (
    <div className={`nbos-vbos-core ${compact ? 'is-compact' : ''}`}>
      <i aria-hidden="true" />
      <i aria-hidden="true" />
      <i aria-hidden="true" />
      <div>
        <span>What holds it together</span>
        <strong>{model.operating_core}</strong>
      </div>
    </div>
  );
}

function Loop({ steps }) {
  return (
    <ol className="nbos-vbos-loop">
      {steps.map((step, index) => (
        <li key={`${step}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span>{step}</li>
      ))}
    </ol>
  );
}

function FullscreenVisualBos({ model, onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="nbos-vbos-overlay" role="dialog" aria-modal="true" aria-label="Expanded Visual BOS" data-testid="visual-bos-fullscreen">
      <div className="nbos-vbos-fullscreen">
        <header className="nbos-vbos-fullscreen-head">
          <div>
            <span>Visual BOS · whole operating system</span>
            <h2>{model.display_name}</h2>
            <p>{model.operating_identity}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close fullscreen Visual BOS">Close <b>×</b></button>
        </header>

        <section className="nbos-vbos-patterns" aria-label="Behavioral patterns">
          <Pattern rank="Primary pattern" value={model.primary_pattern} />
          <Pattern rank="Secondary pattern" value={model.secondary_pattern} />
          <Pattern rank="Tertiary pattern" value={model.tertiary_pattern} />
        </section>

        <section className="nbos-vbos-system-map">
          <FlowList label="What enters the system" items={model.inputs} side="input" />
          <Core model={model} />
          <FlowList label="What the system produces" items={model.outputs} side="output" />
        </section>

        <section className="nbos-vbos-deep-section">
          <div className="nbos-vbos-section-title">
            <span>How it moves</span>
            <h3>The operating loop</h3>
          </div>
          <Loop steps={model.operating_loop} />
        </section>

        <section className="nbos-vbos-context-grid">
          <article className="is-tension"><span>Central tension</span><h3>{model.central_tension}</h3><p>{model.transfer_gap}</p></article>
          <article><span>Energy source</span><h3>What activates the system</h3><p>{model.energy_source}</p></article>
          <article><span>Fatigue source</span><h3>Where capacity drains</h3><p>{model.fatigue_source}</p></article>
          <article><span>Under strain</span><h3>What changes under pressure</h3><p>{model.pressure_shift}</p></article>
          <article><span>How access returns</span><h3>What helps you recover</h3><p>{model.recovery_path}</p></article>
          <article><span>Environment fit</span><h3>Where it can work naturally</h3><p>{model.environment_fit}</p></article>
          <article><span>Context to watch</span><h3>Where adaptation cost rises</h3><p>{model.environment_risk}</p></article>
        </section>

        <section className="nbos-vbos-deep-section">
          <div className="nbos-vbos-section-title">
            <span>Conditional movement</span>
            <h3>Five trajectories to observe</h3>
            <p>Questions, not predictions.</p>
          </div>
          <div className="nbos-vbos-futures">
            {model.futures.map((future, index) => (
              <article key={future.label}>
                <b>{String(index + 1).padStart(2, '0')}</b>
                <h4>{future.label}</h4>
                <span>{future.condition}</span>
                <p>{future.trajectory}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="nbos-vbos-final-grid">
          <article className="nbos-vbos-move">
            <span>One Move to test</span>
            <h3>{model.one_move}</h3>
            <p>{model.one_move_result}</p>
          </article>
          <article className="nbos-vbos-signals">
            <span>Signals to notice</span>
            <ul>{model.signals.map((signal) => <li key={signal}>{signal}</li>)}</ul>
          </article>
        </section>

        <footer className="nbos-vbos-boundary">
          <p>{model.evidence_boundary}</p>
          <div>
            <span>Known <b>{model.evidence_summary.known}</b></span>
            <span>Strong <b>{model.evidence_summary.strongly_supported}</b></span>
            <span>Learning <b>{model.evidence_summary.learning}</b></span>
            <span>Abstentions <b>{model.evidence_summary.abstentions}</b></span>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function NewBosVisualBos({ artifact }) {
  const [fullscreen, setFullscreen] = useState(false);
  const model = useMemo(() => buildVisualBosModel(artifact), [artifact]);

  return (
    <section className="nbos-vbos" data-testid="visual-bos-preview">
      <div className="nbos-vbos-intro">
        <div>
          <span className="nbos-kicker">Visual BOS · synthesized operating system</span>
          <h2>How your entire operating system fits together.</h2>
        </div>
        <p>The Personality DNA Map explains the underlying architecture. This visual follows what enters your system, how it moves, what it produces, where it strains, and which trajectory to watch.</p>
      </div>

      <div className="nbos-vbos-preview">
        <header>
          <div><span>Behavioral Operating System</span><strong>{model.display_name}</strong></div>
          <p>{model.operating_identity}</p>
        </header>
        <section className="nbos-vbos-patterns">
          <Pattern rank="Primary" value={model.primary_pattern} />
          <Pattern rank="Secondary" value={model.secondary_pattern} />
          <Pattern rank="Tertiary" value={model.tertiary_pattern} />
        </section>
        <div className="nbos-vbos-preview-system">
          <FlowList label="Inputs" items={model.inputs.slice(0, 3)} side="input" />
          <Core model={model} compact />
          <FlowList label="Outputs" items={model.outputs.slice(0, 3)} side="output" />
        </div>
        <Loop steps={model.operating_loop} />
        <div className="nbos-vbos-preview-foot">
          <div><span>Central tension</span><strong>{model.central_tension}</strong></div>
          <div><span>One Move</span><strong>{model.one_move}</strong></div>
          <button type="button" onClick={() => setFullscreen(true)}>Expand full Visual BOS <b>↗</b></button>
        </div>
      </div>
      {fullscreen && <FullscreenVisualBos model={model} onClose={() => setFullscreen(false)} />}
    </section>
  );
}
