import { useEffect, useMemo, useRef, useState } from 'react';

const THREADS = Object.freeze([
  Object.freeze({ key: 'preparation_and_action', label: 'Preparation & action' }),
  Object.freeze({ key: 'people_and_communication', label: 'People & communication' }),
  Object.freeze({ key: 'strengths_and_pressure', label: 'Strength & pressure' }),
  Object.freeze({ key: 'sport_school_and_responsibilities', label: 'Life & responsibilities' }),
  Object.freeze({ key: 'growth_conditions', label: 'Conditions for growth' }),
  Object.freeze({ key: 'learning_and_problem_solving', label: 'Learning & problem-solving' }),
  Object.freeze({ key: 'energy_capacity_and_recovery', label: 'Energy, capacity & recovery' }),
]);

function asText(value) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(' ');
  if (value && typeof value === 'object') {
    return asText(value.summary || value.statement || value.description || value.text || value.meaning);
  }
  return '';
}

function MapThread({ item, compact = false }) {
  return (
    <article className={`ab-map-thread${compact ? ' is-compact' : ''}`}>
      <span aria-hidden="true" />
      <div>
        <small>{item.label}</small>
        <p>{item.value || 'This part is still open.'}</p>
      </div>
    </article>
  );
}

function FullscreenMap({ displayName, recognition, centralTension, threads, unknowns, evidenceRefs, dynamics, futures, move, truthState, onClose }) {
  const closeRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const focusable = [...(dialogRef.current?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') || [])]
          .filter((element) => !element.disabled && element.getAttribute('aria-hidden') !== 'true');
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="ab-map-overlay" role="dialog" aria-modal="true" aria-label={`Whole-athlete map for ${displayName}`} data-testid="athlete-map-fullscreen">
      <div ref={dialogRef} className="ab-map-fullscreen">
        <header>
          <div>
            <span className="nbos-kicker">Whole-athlete map · context, not a score</span>
            <h2>{displayName}</h2>
            <p>{recognition || 'A truthful picture can stay open while this athlete keeps growing.'}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close whole-athlete map">Close <b aria-hidden="true">×</b></button>
        </header>

        <section className="ab-map-fullscreen-core" aria-label="What ties this story together">
          <span>What ties it together right now</span>
          <h3>{centralTension || 'Some important parts of this story are still being learned.'}</h3>
          <p>This is a revisable view of experiences and context. It is not a rating of ability, potential, readiness or worth.</p>
        </section>

        <section className="ab-map-intelligence" aria-label="How the parts of this whole-athlete map connect">
          <article className="ab-map-causal">
            <span>How one moment may connect to the next</span>
            {dynamics.length > 0 ? dynamics.map((item, index) => <div key={`${index}-${item.triggerOrContext}`}><b>{item.triggerOrContext}</b><i>→</i><p>{item.meaningOrPrivateCalculation}</p><i>→</i><strong>{item.responseOrAction}</strong></div>) : <p>This connection is still being learned.</p>}
          </article>
          <article className="ab-map-direction">
            <span>Paths that may open</span>
            {futures.length > 0 ? futures.map((future, index) => <div key={`${index}-${future.title}`}><b>{String(index + 1).padStart(2, '0')}</b><p><strong>{future.title}</strong><small>{future.condition}</small></p></div>) : <p>No useful Future is being forced from the current evidence.</p>}
          </article>
          <article className="ab-map-move">
            <span>{move?.kind === 'maintain' ? 'What may be worth protecting' : 'One possible next move'}</span>
            <h3>{move?.suggestion || 'No move is being forced.'}</h3>
            {move?.uncertainty && <small>{move.uncertainty}</small>}
          </article>
          <article className="ab-map-truth-state">
            <span>What this reading rests on</span>
            <div><p><strong>{truthState.direct}</strong>things you told us</p><p><strong>{truthState.interpretations}</strong>ideas we are testing</p><p><strong>{truthState.differences}</strong>differences still open</p><p><strong>{truthState.unknowns}</strong>questions still open</p></div>
            <small>These counts show what is known and what is still open. They do not score you.</small>
          </article>
        </section>

        <section className="ab-map-fullscreen-grid" aria-label="Whole-athlete context">
          {threads.map((item) => <MapThread key={item.key} item={item} />)}
        </section>

        <section className="ab-map-open">
          <div>
            <span className="nbos-kicker">Still learning</span>
            <h3>What this map does not settle.</h3>
          </div>
          <ul>
            {unknowns.length > 0
              ? unknowns.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)
              : <li>No additional open question was supplied for this version.</li>}
          </ul>
        </section>

        <footer>
          <span>Based on what you shared</span><span>Open to correction</span><span>No athlete score</span>
          {evidenceRefs.length > 0 && <span>Your answers are available</span>}
        </footer>
      </div>
    </div>
  );
}

export default function AthleteWholeMap({ artifact, displayName }) {
  const [fullscreen, setFullscreen] = useState(false);
  const launchRef = useRef(null);
  const map = useMemo(() => artifact?.athlete_map || {}, [artifact?.athlete_map]);
  const whole = artifact?.whole_person_model || {};
  const headline = asText(artifact?.plan?.title) || 'One person. More than one moment.';
  const recognition = asText(map.recognition) || asText(whole.core_explanation);
  const centralTension = asText(whole.central_tension) || asText(whole.identity_distillation);
  const threads = useMemo(() => THREADS.map((item) => ({ ...item, value: asText(map[item.key]) })), [map]);
  const unknowns = [
    ...(Array.isArray(map.unknowns) ? map.unknowns : []),
    ...(Array.isArray(whole.uncertainty) ? whole.uncertainty : []),
  ].map(asText).filter(Boolean).filter((item, index, values) => values.indexOf(item) === index);
  const evidenceRefs = Array.isArray(map.evidence_refs) ? map.evidence_refs.filter(Boolean) : [];
  const dynamics = Array.isArray(artifact?.plan?.causal_dynamics) ? artifact.plan.causal_dynamics.slice(0, 2) : [];
  const futures = Array.isArray(artifact?.plan?.futures) ? artifact.plan.futures : [];
  const move = artifact?.plan?.move || null;
  const claims = Array.isArray(artifact?.plan?.claims) ? artifact.plan.claims : [];
  const truthState = {
    direct: claims.filter(({ confidence }) => confidence === 'direct_account').length,
    interpretations: claims.filter(({ confidence }) => confidence !== 'direct_account').length,
    differences: Array.isArray(artifact?.plan?.contradictions) ? artifact.plan.contradictions.filter(({ resolved }) => !resolved).length : 0,
    unknowns: unknowns.length,
  };

  function close() {
    setFullscreen(false);
    window.requestAnimationFrame(() => launchRef.current?.focus());
  }

  return (
    <section className="ab-whole-map" data-testid="athlete-whole-map">
      <div className="ab-map-copy">
        <span className="nbos-kicker">Whole-athlete map · no scores</span>
        <h2>{headline}</h2>
        <p>{recognition || 'This view holds the parts that are known together while leaving room for what has not been learned yet.'}</p>
        <div className="ab-map-boundary"><i aria-hidden="true" /> Experiences and context shape this map. It does not rank the athlete or predict a future.</div>
      </div>

      <div className="ab-map-preview" aria-label={`Context threads in ${displayName}'s whole-athlete map`}>
        <div className="ab-map-center"><span>{displayName}</span><small>still growing</small></div>
        {dynamics[0] && <div className="ab-map-preview-loop" aria-label="One connection in this reading"><span>{dynamics[0].triggerOrContext}</span><i>→</i><span>{dynamics[0].meaningOrPrivateCalculation}</span><i>→</i><span>{dynamics[0].responseOrAction}</span></div>}
        <div className="ab-map-thread-list">
          {threads.map((item) => <MapThread compact key={item.key} item={item} />)}
        </div>
        <div className="ab-map-preview-state"><span>{futures.length} possible {futures.length === 1 ? 'path' : 'paths'}</span><span>{truthState.differences} open {truthState.differences === 1 ? 'difference' : 'differences'}</span><span>{truthState.unknowns} open {truthState.unknowns === 1 ? 'question' : 'questions'}</span></div>
        <button ref={launchRef} type="button" onClick={() => setFullscreen(true)}>Open the whole-athlete map <b aria-hidden="true">↗</b></button>
      </div>

      {fullscreen && <FullscreenMap displayName={displayName} recognition={recognition} centralTension={centralTension} threads={threads} unknowns={unknowns} evidenceRefs={evidenceRefs} dynamics={dynamics} futures={futures} move={move} truthState={truthState} onClose={close} />}
    </section>
  );
}
