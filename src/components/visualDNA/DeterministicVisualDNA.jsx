import React from 'react';
import { buildVisualDNAViewModel } from '../../lib/visualDNA/buildVisualDNAViewModel.js';

function formatScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '+0.00';
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(2)}`;
}

function riskClass(risk) {
  const value = String(risk || '').toLowerCase();
  if (value.includes('high')) return 'risk-high';
  if (value.includes('low')) return 'risk-low';
  return 'risk-moderate';
}

function DimensionBar({ item, index }) {
  const width = Math.max(8, Math.min(100, Math.abs(Number(item.value) || 0) * 100));
  return (
    <div className="dvd-dimension-row">
      <span className="dvd-dim-key">{item.key}</span>
      <span className={`dvd-dim-bar bar-${index + 1}`}>
        <span style={{ width: `${width}%` }} />
      </span>
      <span className="dvd-dim-score">{formatScore(item.value)}</span>
      <span className="dvd-dim-meta">E{item.evidence || 0}</span>
      <span className="dvd-dim-meta">{item.intensityBand || item.evidenceBand || 'signal'}</span>
    </div>
  );
}

function SignalList({ title, items }) {
  return (
    <div className="dvd-signal-list">
      <div className="dvd-mini-title">{title}</div>
      <div className="dvd-signal-items">
        {(items || []).map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </div>
  );
}

function DenseList({ title, items, tone = 'cyan' }) {
  return (
    <section className={`dvd-panel dvd-list-panel tone-${tone}`}>
      <div className="dvd-section-label">{title}</div>
      <ul>
        {(items || []).slice(0, 4).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function LoopStep({ label, index }) {
  return (
    <div className="dvd-loop-step">
      <div className="dvd-loop-icon">{index + 1}</div>
      <span>{label}</span>
    </div>
  );
}

function EngineBadge({ label, item, fallback, tone }) {
  return (
    <div className={`dvd-engine-badge tone-${tone}`}>
      <span>{label}</span>
      <strong>{item?.label || fallback}</strong>
      <em>{formatScore(item?.value)}</em>
      <small>Evidence {item?.evidence || 0}</small>
    </div>
  );
}

function FutureCard({ item, index }) {
  return (
    <div className={`dvd-future-card future-${index + 1}`}>
      <div>
        <span>{item.likelihood}</span>
        <strong>{item.title}</strong>
      </div>
      <p>{item.summary}</p>
    </div>
  );
}

function EvidencePanel({ evidence, amplitude }) {
  const safeEvidence = evidence || {};
  const safeAmplitude = amplitude || { score: 0, label: 'Moderate' };

  return (
    <section className="dvd-panel dvd-evidence">
      <div className="dvd-section-label">Evidence / Amplitude</div>
      <div className="dvd-evidence-grid">
        <div className="dvd-evidence-bars">
          <span><em style={{ width: `${Math.min(100, (safeEvidence.strong || 0) * 22)}%` }} />Strong <b>{safeEvidence.strong || 0}</b></span>
          <span><em style={{ width: `${Math.min(100, (safeEvidence.moderate || 0) * 28)}%` }} />Moderate <b>{safeEvidence.moderate || 0}</b></span>
          <span><em style={{ width: `${Math.min(100, (safeEvidence.thin || 0) * 34)}%` }} />Thin <b>{safeEvidence.thin || 0}</b></span>
        </div>
        <div className="dvd-amplitude">
          <span>Amplitude</span>
          <strong>{Number(safeAmplitude.score || 0).toFixed(2)}</strong>
          <em>{safeAmplitude.label || 'Moderate'}</em>
        </div>
      </div>
    </section>
  );
}

export default function DeterministicVisualDNA({ profile, narrative, variant = 'wally' }) {
  const sample = typeof profile === 'object' ? profile : null;
  const vm = buildVisualDNAViewModel(sample || {}, narrative || {});
  const topDimensions = Array.isArray(vm.topDimensions) ? vm.topDimensions.slice(0, 6) : [];
  const tension = vm.tension || {
    left: vm.primaryDimension?.label || vm.primaryEngine || 'Primary',
    right: vm.secondaryDimension?.label || vm.secondaryEngine || 'Secondary',
    label: 'Transfer Gap',
    detail: vm.futureBottleneck || 'The strongest operating pattern needs clearer handoff rules.',
  };
  const futureCards = (vm.futureCards?.length ? vm.futureCards : [
    { title: 'Current Trajectory', likelihood: 'Likely', summary: vm.futureBottleneck || 'The current system remains person-dependent.' },
    { title: 'Optimized Trajectory', likelihood: 'Possible', summary: vm.evolutionPath || 'Judgment becomes transferable.' },
    { title: 'Burnout Trajectory', likelihood: 'Risk', summary: 'Recurring ambiguity consumes leadership bandwidth.' },
    { title: 'Leadership Trajectory', likelihood: 'Possible', summary: vm.oneMove || 'The strongest pattern becomes a system.' },
    { title: 'Constraint Trajectory', likelihood: 'Likely', summary: 'Scale exposes the transfer gap.' },
  ]).slice(0, 5);

  return (
    <div className={`dvd-frame dvd-${variant}`}>
      <style>{styles}</style>
      <div className="dvd-grid" aria-label="Deterministic Visual DNA poster">
        <div className="dvd-bg-lines" />
        <header className="dvd-header">
          <div className="dvd-identity">
            <h1>{vm.name}</h1>
            <p className="dvd-company">{vm.company}</p>
          </div>
          <div className="dvd-title-block">
            <div className="dvd-kicker">Visual DNA</div>
            <h2>Behavioral Operating System</h2>
            <p>Design <span>•</span> Decide <span>•</span> Move <span>•</span> Compound</p>
          </div>
          <div className="dvd-meta-strip">
            <div>
              <span>Profile ID</span>
              <strong>{vm.profileId}</strong>
            </div>
            <div>
              <span>Profile Type</span>
              <strong>{vm.type}</strong>
            </div>
          </div>
        </header>

        <aside className="dvd-left">
          <section className="dvd-panel dvd-dimensions">
            <div className="dvd-section-label">Dimension Scorecard</div>
            {topDimensions.map((item, index) => (
              <DimensionBar key={`${item.key}-${index}`} item={item} index={index} />
            ))}
          </section>

          <EvidencePanel evidence={vm.evidenceSummary} amplitude={vm.amplitude} />

          <div className="dvd-dual-list">
            <DenseList title="Energy Source" items={vm.energySource} tone="cyan" />
            <DenseList title="Fatigue Source" items={vm.fatigueSource} tone="orange" />
          </div>
        </aside>

        <main className="dvd-core">
          <div className="dvd-engine-stack">
            <EngineBadge label="Primary" item={vm.primaryDimension} fallback={vm.primaryEngine} tone="purple" />
            <EngineBadge label="Secondary" item={vm.secondaryDimension} fallback={vm.secondaryEngine} tone="orange" />
            <EngineBadge label="Tertiary" item={vm.tertiaryDimension} fallback="Support" tone="cyan" />
          </div>
          <div className="dvd-core-ring outer" />
          <div className="dvd-core-ring middle" />
          <div className="dvd-core-ring inner" />
          <div className="dvd-core-node primary">
            <span>Primary</span>
            <strong>{vm.primaryEngine}</strong>
          </div>
          <div className="dvd-core-node secondary">
            <span>Secondary</span>
            <strong>{vm.secondaryEngine}</strong>
          </div>
          <div className="dvd-core-label">
            <span>System Type</span>
            <strong>{vm.systemType}</strong>
            <em>{vm.engineLabel}</em>
          </div>
          <div className="dvd-transfer-line line-a" />
          <div className="dvd-transfer-line line-b" />
          <div className="dvd-transfer-line line-c" />

          <section className="dvd-panel dvd-loop-panel">
            <div className="dvd-mini-title">Operating Loop</div>
            <div className="dvd-loop-row">
              {(vm.operatingLoop || []).map((step, index) => (
                <LoopStep key={step} label={step} index={index} />
              ))}
            </div>
          </section>
        </main>

        <aside className="dvd-right">
          <section className="dvd-panel dvd-tension">
            <div className="dvd-section-label">Core Tension</div>
            <div className="dvd-tension-row">
              <strong>{tension.left}</strong>
              <span>VS</span>
              <strong>{tension.right}</strong>
            </div>
            <h3>{tension.label}</h3>
            <p>{tension.detail}</p>
          </section>

          <section className="dvd-panel dvd-bottleneck">
            <div className="dvd-section-label">Future Bottleneck</div>
            <p>{vm.futureBottleneck}</p>
          </section>

          <div className="dvd-environment-grid">
            <DenseList title="Best Environment" items={vm.bestEnvironment} tone="green" />
            <DenseList title="Worst Environment" items={vm.worstEnvironment} tone="red" />
          </div>

          <section className="dvd-panel dvd-one-move">
            <div className="dvd-section-label">One Move</div>
            <h3>{vm.oneMove}</h3>
            <p>{vm.roleTruth}</p>
          </section>

          <section className="dvd-panel dvd-key-signals">
            <div className="dvd-section-label">Key Signals</div>
            <ul>
              {(vm.keySignals || []).slice(0, 4).map((signal) => (
                <li key={signal}>{signal}</li>
              ))}
            </ul>
          </section>
        </aside>

        <section className="dvd-futures">
          {futureCards.map((future, index) => (
            <FutureCard key={`${future.title}-${index}`} item={future} index={index} />
          ))}
        </section>

        <footer className="dvd-footer dvd-panel">
          <div className="dvd-footer-item">
            <span>Natural Advantage</span>
            <strong>{vm.naturalAdvantage}</strong>
          </div>
          <div className="dvd-footer-item">
            <span>Natural Risk</span>
            <strong>{vm.naturalRisk}</strong>
          </div>
          <SignalList title="Inputs" items={vm.inputs} />
          <SignalList title="Outputs" items={vm.outputs} />
          <SignalList title="Role Fit Signals" items={vm.roleFitSignals} />
          <div className={`dvd-footer-risk ${riskClass(vm.wrongSeatRisk)}`}>
            <span>Wrong-Seat Risk</span>
            <strong>{vm.wrongSeatRisk}</strong>
          </div>
        </footer>
      </div>
    </div>
  );
}

const styles = `
.dvd-frame {
  width: min(100%, 1672px);
  aspect-ratio: 1672 / 941;
  margin: 0 auto;
  color: #f7f7f2;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  letter-spacing: 0;
}

.dvd-grid {
  position: relative;
  display: grid;
  grid-template-columns: 360px 1fr 360px;
  grid-template-rows: 150px 1fr 220px;
  gap: 18px;
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 30px;
  border: 1px solid rgba(255, 132, 0, 0.38);
  border-radius: 8px;
  background:
    radial-gradient(circle at 50% 45%, rgba(255, 132, 0, 0.13), transparent 32%),
    radial-gradient(circle at 68% 44%, rgba(0, 208, 255, 0.11), transparent 28%),
    radial-gradient(circle at 38% 65%, rgba(166, 88, 255, 0.12), transparent 34%),
    linear-gradient(135deg, #030405 0%, #07090d 42%, #020203 100%);
  box-shadow: 0 0 60px rgba(255, 132, 0, 0.16), inset 0 0 120px rgba(0, 0, 0, 0.82);
}

.dvd-bg-lines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px),
    linear-gradient(0deg, rgba(255,255,255,0.025) 1px, transparent 1px);
  background-size: 68px 68px;
  mask-image: radial-gradient(circle at 50% 50%, black, transparent 78%);
}

.dvd-panel {
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 8px;
  background: linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.025));
  box-shadow: inset 0 0 32px rgba(255,255,255,0.025), 0 0 28px rgba(0,0,0,0.42);
  backdrop-filter: blur(8px);
}

.dvd-header {
  grid-column: 1 / 2;
  grid-row: 1 / 2;
  padding: 24px;
}

.dvd-header h1 {
  margin: 0;
  font-size: 39px;
  line-height: 1;
  text-transform: uppercase;
  font-weight: 800;
  color: #f5f3ea;
}

.dvd-company,
.dvd-type {
  margin: 10px 0 0;
  color: rgba(255,255,255,0.72);
  text-transform: uppercase;
  font-size: 20px;
}

.dvd-type {
  color: #ff8a00;
}

.dvd-id-block {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  font-size: 13px;
  color: rgba(255,255,255,0.52);
}

.dvd-id-block strong {
  color: rgba(255,255,255,0.82);
  font-weight: 500;
}

.dvd-title-block {
  grid-column: 2 / 3;
  grid-row: 1 / 2;
  align-self: center;
  text-align: center;
}

.dvd-kicker,
.dvd-section-label,
.dvd-mini-title {
  color: #9f6bff;
  font-size: 15px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 800;
}

.dvd-title-block h2 {
  margin: 8px 0 0;
  font-size: 44px;
  line-height: 1;
  text-transform: uppercase;
  color: #ff8a00;
}

.dvd-title-block p {
  margin: 12px 0 0;
  color: rgba(255,255,255,0.78);
  font-size: 20px;
}

.dvd-left,
.dvd-right {
  display: grid;
  gap: 18px;
  grid-row: 2 / 3;
  position: relative;
  z-index: 2;
}

.dvd-left {
  grid-column: 1 / 2;
  grid-template-rows: 1fr 190px;
}

.dvd-right {
  grid-column: 3 / 4;
  grid-template-rows: 1fr 170px 190px;
}

.dvd-dimensions,
.dvd-engine-card,
.dvd-bottleneck,
.dvd-one-move,
.dvd-risk {
  padding: 24px;
}

.dvd-dimension-row {
  display: grid;
  grid-template-columns: 44px 1fr 62px;
  align-items: center;
  gap: 12px;
  margin-top: 18px;
}

.dvd-dim-key {
  color: rgba(255,255,255,0.72);
  font-size: 17px;
  font-weight: 700;
}

.dvd-dim-bar {
  height: 12px;
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
  overflow: hidden;
}

.dvd-dim-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.bar-1 span { background: linear-gradient(90deg, #ff8a00, #ffd166); }
.bar-2 span { background: linear-gradient(90deg, #00d4ff, #6fffe9); }
.bar-3 span { background: linear-gradient(90deg, #7cff00, #c7ff5a); }
.bar-4 span { background: linear-gradient(90deg, #a66bff, #f3a6ff); }
.bar-5 span { background: linear-gradient(90deg, #ff4d2e, #ff9b71); }
.bar-6 span { background: linear-gradient(90deg, #71717a, #d4d4d8); }

.dvd-dim-score {
  color: rgba(255,255,255,0.82);
  font-size: 17px;
  text-align: right;
}

.dvd-engine-card h3,
.dvd-one-move h3 {
  margin: 14px 0 0;
  color: #b8ff35;
  font-size: 28px;
  line-height: 1.1;
}

.dvd-engine-card p,
.dvd-bottleneck p,
.dvd-risk p {
  margin: 14px 0 0;
  color: rgba(255,255,255,0.76);
  font-size: 18px;
  line-height: 1.45;
}

.dvd-core {
  grid-column: 2 / 3;
  grid-row: 2 / 3;
  position: relative;
  display: grid;
  place-items: center;
  min-height: 0;
}

.dvd-core-ring {
  position: absolute;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.18);
  box-shadow: 0 0 48px rgba(255, 132, 0, 0.22);
}

.dvd-core-ring.outer {
  width: 520px;
  height: 520px;
  border-color: rgba(255, 132, 0, 0.52);
}

.dvd-core-ring.middle {
  width: 390px;
  height: 390px;
  border-color: rgba(0, 212, 255, 0.44);
}

.dvd-core-ring.inner {
  width: 255px;
  height: 255px;
  border-color: rgba(184, 255, 53, 0.48);
}

.dvd-core-node {
  position: absolute;
  width: 210px;
  padding: 18px;
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 8px;
  background: rgba(0,0,0,0.55);
  text-align: center;
}

.dvd-core-node span,
.dvd-core-label span,
.dvd-confidence span {
  display: block;
  color: rgba(255,255,255,0.52);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

.dvd-core-node strong {
  display: block;
  margin-top: 8px;
  color: #f7f7f2;
  font-size: 28px;
  text-transform: uppercase;
}

.dvd-core-node.primary {
  top: 36px;
  left: 50%;
  transform: translateX(-50%);
  border-color: rgba(255, 132, 0, 0.5);
}

.dvd-core-node.secondary {
  bottom: 34px;
  left: 50%;
  transform: translateX(-50%);
  border-color: rgba(0, 212, 255, 0.45);
}

.dvd-core-label {
  position: relative;
  z-index: 2;
  width: 320px;
  text-align: center;
}

.dvd-core-label strong {
  display: block;
  margin-top: 12px;
  color: #ff8a00;
  font-size: 34px;
  line-height: 1.08;
  text-transform: uppercase;
}

.dvd-transfer-line {
  position: absolute;
  height: 1px;
  width: 42%;
  background: linear-gradient(90deg, transparent, rgba(255, 132, 0, 0.8), transparent);
}

.line-a { top: 34%; left: 0; transform: rotate(10deg); }
.line-b { top: 52%; right: 0; transform: rotate(-8deg); background: linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.8), transparent); }
.line-c { bottom: 25%; left: 16%; width: 68%; background: linear-gradient(90deg, transparent, rgba(184, 255, 53, 0.75), transparent); }

.dvd-bottleneck p {
  color: #f5f3ea;
  font-size: 22px;
}

.dvd-one-move h3 {
  color: #ff8a00;
}

.dvd-risk strong {
  display: block;
  margin-top: 12px;
  color: #ff8a00;
  font-size: 36px;
  text-transform: uppercase;
}

.dvd-risk.risk-high strong { color: #ff4d2e; }
.dvd-risk.risk-low strong { color: #b8ff35; }

.dvd-footer {
  grid-column: 1 / 4;
  grid-row: 3 / 4;
  display: grid;
  grid-template-columns: 210px 1fr 230px 260px 130px;
  gap: 20px;
  align-items: start;
  padding: 22px 24px;
  z-index: 3;
}

.dvd-signal-items {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 12px;
}

.dvd-signal-items span {
  display: inline-flex;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 999px;
  padding: 5px 8px;
  color: rgba(255,255,255,0.78);
  font-size: 13px;
  line-height: 1;
}

.dvd-loop-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  margin-top: 12px;
}

.dvd-loop-step {
  display: grid;
  justify-items: center;
  gap: 6px;
  min-width: 0;
  color: rgba(255,255,255,0.8);
  font-size: 13px;
}

.dvd-loop-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 38px;
  width: 38px;
  border: 1px solid rgba(255, 132, 0, 0.52);
  border-radius: 999px;
  color: #ff8a00;
  box-shadow: 0 0 22px rgba(255, 132, 0, 0.22);
}

.dvd-evolution p {
  margin: 12px 0 0;
  color: rgba(255,255,255,0.8);
  font-size: 15px;
  line-height: 1.35;
}

.dvd-confidence {
  text-align: right;
}

.dvd-confidence strong {
  display: block;
  margin-top: 8px;
  color: #b8ff35;
  font-size: 22px;
  text-transform: uppercase;
}

/* Phase 5 density layer: same visual language, higher intelligence compression. */
.dvd-grid {
  grid-template-columns: 430px 1fr 430px;
  grid-template-rows: 82px minmax(0, 1fr) 120px 58px;
  gap: 12px;
  padding: 22px;
}

.dvd-header {
  grid-column: 1 / 4;
  grid-row: 1 / 2;
  display: grid;
  grid-template-columns: 430px 1fr 430px;
  gap: 12px;
  align-items: stretch;
  padding: 0;
}

.dvd-identity,
.dvd-meta-strip > div {
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background: linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.025));
  box-shadow: inset 0 0 26px rgba(255,255,255,0.02), 0 0 24px rgba(0,0,0,0.38);
}

.dvd-identity {
  padding: 15px 20px;
}

.dvd-header h1 {
  font-size: 34px;
  letter-spacing: 0.02em;
}

.dvd-company {
  margin-top: 9px;
  font-size: 15px;
}

.dvd-title-block {
  grid-column: auto;
  grid-row: auto;
  align-self: center;
}

.dvd-title-block h2 {
  font-size: 34px;
  letter-spacing: 0.04em;
}

.dvd-title-block p {
  margin-top: 7px;
  font-size: 15px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.dvd-title-block p span {
  color: #ff8a00;
  padding: 0 9px;
}

.dvd-meta-strip {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.dvd-meta-strip > div {
  padding: 14px 16px;
}

.dvd-meta-strip span {
  display: block;
  color: #00d4ff;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 800;
}

.dvd-meta-strip strong {
  display: block;
  margin-top: 6px;
  color: rgba(255,255,255,0.9);
  font-size: 14px;
  line-height: 1.2;
  text-transform: uppercase;
}

.dvd-left,
.dvd-right {
  grid-row: 2 / 3;
  display: grid;
  min-height: 0;
  gap: 10px;
}

.dvd-left {
  grid-template-rows: 320px 118px minmax(0, 1fr);
}

.dvd-right {
  grid-template-rows: 118px 120px 120px 108px minmax(0, 1fr);
}

.dvd-core {
  grid-row: 2 / 3;
  align-content: stretch;
}

.dvd-dimensions,
.dvd-engine-card,
.dvd-bottleneck,
.dvd-one-move,
.dvd-risk,
.dvd-list-panel,
.dvd-evidence,
.dvd-tension,
.dvd-key-signals {
  padding: 17px;
  overflow: hidden;
}

.dvd-section-label,
.dvd-mini-title {
  font-size: 12px;
  letter-spacing: 0.15em;
}

.dvd-dimension-row {
  grid-template-columns: 46px 1fr 58px;
  grid-template-rows: auto auto;
  column-gap: 10px;
  row-gap: 2px;
  margin-top: 8px;
}

.dvd-dim-key {
  grid-row: 1 / 3;
  font-size: 14px;
}

.dvd-dim-bar {
  height: 10px;
}

.dvd-dim-score {
  grid-row: 1 / 3;
  font-size: 15px;
  color: #ff8a00;
}

.dvd-dim-meta {
  color: rgba(255,255,255,0.46);
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.dvd-evidence-grid {
  display: grid;
  grid-template-columns: 1fr 112px;
  gap: 14px;
  align-items: center;
  margin-top: 12px;
}

.dvd-evidence-bars {
  display: grid;
  gap: 8px;
}

.dvd-evidence-bars span {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 26px;
  align-items: center;
  min-height: 15px;
  color: rgba(255,255,255,0.68);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.dvd-evidence-bars em {
  position: absolute;
  left: 0;
  bottom: -2px;
  display: block;
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(0, 212, 255, 0.3), rgba(0, 212, 255, 0.95));
}

.dvd-evidence-bars b {
  color: #f8fafc;
  font-size: 12px;
  text-align: right;
}

.dvd-amplitude {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  border: 1px solid rgba(0, 212, 255, 0.34);
  border-radius: 999px;
  background: radial-gradient(circle, rgba(0, 212, 255, 0.18), rgba(0, 0, 0, 0.2) 62%);
  box-shadow: 0 0 28px rgba(0, 212, 255, 0.18);
}

.dvd-amplitude span,
.dvd-amplitude em {
  color: rgba(255,255,255,0.58);
  font-size: 9px;
  font-style: normal;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.dvd-amplitude strong {
  color: #00d4ff;
  font-size: 30px;
  line-height: 0.8;
}

.dvd-dual-list,
.dvd-environment-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  min-height: 0;
}

.dvd-list-panel ul,
.dvd-key-signals ul {
  display: grid;
  gap: 9px;
  list-style: none;
  margin: 13px 0 0;
  padding: 0;
}

.dvd-list-panel li,
.dvd-key-signals li {
  position: relative;
  padding-left: 16px;
  color: rgba(255,255,255,0.76);
  font-size: 12px;
  line-height: 1.25;
  text-transform: uppercase;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.dvd-list-panel li::before,
.dvd-key-signals li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.45em;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #00d4ff;
  box-shadow: 0 0 10px currentColor;
}

.tone-orange .dvd-section-label,
.tone-orange li::before { color: #ff8a00; background: #ff8a00; }
.tone-green .dvd-section-label,
.tone-green li::before { color: #b8ff35; background: #b8ff35; }
.tone-red .dvd-section-label,
.tone-red li::before { color: #ff4d2e; background: #ff4d2e; }
.tone-cyan .dvd-section-label,
.tone-cyan li::before { color: #00d4ff; background: #00d4ff; }

.dvd-engine-stack {
  position: absolute;
  top: 0;
  left: 24px;
  right: 24px;
  z-index: 4;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 70px;
}

.dvd-engine-badge {
  min-height: 92px;
  padding: 13px;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 8px;
  background: rgba(0,0,0,0.5);
  text-align: center;
  box-shadow: 0 0 28px rgba(0,0,0,0.35);
}

.dvd-engine-badge span,
.dvd-engine-badge small {
  display: block;
  color: rgba(255,255,255,0.58);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.dvd-engine-badge strong {
  display: block;
  margin-top: 4px;
  color: #f8fafc;
  font-size: 17px;
  text-transform: uppercase;
}

.dvd-engine-badge em {
  display: block;
  color: #f8fafc;
  font-size: 17px;
  font-style: normal;
}

.dvd-engine-badge.tone-purple { border-color: rgba(159, 107, 255, 0.58); }
.dvd-engine-badge.tone-orange { border-color: rgba(255, 138, 0, 0.58); }
.dvd-engine-badge.tone-cyan { border-color: rgba(0, 212, 255, 0.58); }

.dvd-core-ring.outer {
  width: 430px;
  height: 430px;
}

.dvd-core-ring.middle {
  width: 330px;
  height: 330px;
}

.dvd-core-ring.inner {
  width: 220px;
  height: 220px;
}

.dvd-core-node {
  width: 190px;
  padding: 14px;
}

.dvd-core-node.primary {
  top: 118px;
}

.dvd-core-node.secondary {
  bottom: 112px;
}

.dvd-core-node strong {
  font-size: 23px;
}

.dvd-core-label {
  width: 310px;
}

.dvd-core-label strong {
  font-size: 34px;
}

.dvd-core-label em {
  display: block;
  margin-top: 10px;
  color: rgba(255,255,255,0.78);
  font-size: 14px;
  font-style: normal;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.dvd-loop-panel {
  position: absolute;
  left: 13%;
  right: 13%;
  bottom: 16px;
  z-index: 4;
  padding: 12px 18px 14px;
  border-color: rgba(33, 150, 243, 0.52);
}

.dvd-loop-row {
  margin-top: 8px;
}

.dvd-loop-icon {
  width: 34px;
  height: 34px;
}

.dvd-loop-step {
  font-size: 12px;
}

.dvd-tension-row {
  display: grid;
  grid-template-columns: 1fr 44px 1fr;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.dvd-tension-row strong {
  color: #9f6bff;
  font-size: 14px;
  text-transform: uppercase;
}

.dvd-tension-row strong:last-child {
  color: #00d4ff;
  text-align: right;
}

.dvd-tension-row span {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border: 1px solid rgba(255,255,255,0.28);
  border-radius: 999px;
  color: #f8fafc;
  font-size: 13px;
}

.dvd-tension h3 {
  margin: 8px 0 0;
  color: #ff8a00;
  font-size: 15px;
  text-align: center;
  text-transform: uppercase;
}

.dvd-tension p,
.dvd-one-move p,
.dvd-bottleneck p {
  margin: 7px 0 0;
  color: rgba(255,255,255,0.78);
  font-size: 13px;
  line-height: 1.35;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
}

.dvd-bottleneck p {
  color: #f5f3ea;
  font-size: 17px;
  -webkit-line-clamp: 4;
}

.dvd-one-move p,
.dvd-tension p {
  -webkit-line-clamp: 3;
}

.dvd-one-move h3 {
  margin-top: 9px;
  color: #ff8a00;
  font-size: 22px;
}

.dvd-key-signals ul {
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
}

.dvd-futures {
  grid-column: 1 / 4;
  grid-row: 3 / 4;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  min-height: 0;
  z-index: 5;
}

.dvd-future-card {
  padding: 15px 17px;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 8px;
  background: linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
  box-shadow: inset 0 0 24px rgba(255,255,255,0.02);
  overflow: hidden;
}

.dvd-future-card span {
  display: inline-block;
  margin-bottom: 6px;
  padding: 2px 6px;
  border: 1px solid rgba(0, 212, 255, 0.32);
  border-radius: 3px;
  color: #00d4ff;
  font-size: 10px;
  text-transform: uppercase;
}

.dvd-future-card strong {
  display: block;
  color: #9f6bff;
  font-size: 13px;
  text-transform: uppercase;
}

.dvd-future-card p {
  margin: 9px 0 0;
  color: rgba(255,255,255,0.76);
  font-size: 11px;
  line-height: 1.25;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.future-2 strong,
.future-2 span { color: #00d4ff; }
.future-3 strong,
.future-3 span { color: #ff4d2e; }
.future-4 strong,
.future-4 span { color: #2196f3; }
.future-5 strong,
.future-5 span { color: #9f6bff; }

.dvd-footer {
  grid-row: 4 / 5;
  grid-template-columns: 1.2fr 1.1fr 1fr 1fr 1fr 130px;
  gap: 12px;
  align-items: center;
  padding: 11px 14px;
}

.dvd-footer-item span,
.dvd-footer-risk span {
  display: block;
  color: #ff8a00;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 800;
}

.dvd-footer-item strong,
.dvd-footer-risk strong {
  display: block;
  margin-top: 5px;
  color: rgba(255,255,255,0.82);
  font-size: 11px;
  line-height: 1.2;
  text-transform: uppercase;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.dvd-footer .dvd-signal-items {
  gap: 4px;
  margin-top: 6px;
}

.dvd-footer .dvd-signal-items span {
  padding: 3px 6px;
  font-size: 10px;
}

.dvd-footer .dvd-mini-title {
  font-size: 10px;
}

.dvd-footer-risk strong {
  color: #ff4d2e;
  font-size: 18px;
}

@media (max-width: 900px) {
  .dvd-frame {
    min-width: 980px;
  }
}
`;
