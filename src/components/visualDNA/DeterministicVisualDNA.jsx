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

function LoopStep({ label, index }) {
  return (
    <div className="dvd-loop-step">
      <div className="dvd-loop-icon">{index + 1}</div>
      <span>{label}</span>
    </div>
  );
}

export default function DeterministicVisualDNA({ profile, narrative, variant = 'wally' }) {
  const sample = typeof profile === 'object' ? profile : null;
  const vm = buildVisualDNAViewModel(sample || {}, narrative || {});
  const topDimensions = Array.isArray(vm.topDimensions) ? vm.topDimensions.slice(0, 6) : [];

  return (
    <div className={`dvd-frame dvd-${variant}`}>
      <style>{styles}</style>
      <div className="dvd-grid" aria-label="Deterministic Visual DNA poster">
        <div className="dvd-bg-lines" />
        <header className="dvd-header dvd-panel">
          <div>
            <h1>{vm.name}</h1>
            <p className="dvd-company">{vm.company}</p>
            <p className="dvd-type">{vm.type}</p>
          </div>
          <div className="dvd-id-block">
            <span>Profile ID</span>
            <strong>{vm.profileId}</strong>
          </div>
        </header>

        <div className="dvd-title-block">
          <div className="dvd-kicker">VISUAL DNA</div>
          <h2>Behavioral Operating System</h2>
          <p>{vm.systemType}</p>
        </div>

        <aside className="dvd-left">
          <section className="dvd-panel dvd-dimensions">
            <div className="dvd-section-label">Top Dimensions</div>
            {topDimensions.map((item, index) => (
              <DimensionBar key={`${item.key}-${index}`} item={item} index={index} />
            ))}
          </section>

          <section className="dvd-panel dvd-engine-card">
            <div className="dvd-section-label">Primary Engine</div>
            <h3>{vm.engineLabel}</h3>
            <p>{vm.primaryEngine} creates direction. {vm.secondaryEngine} determines how the system moves.</p>
          </section>
        </aside>

        <main className="dvd-core">
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
          </div>
          <div className="dvd-transfer-line line-a" />
          <div className="dvd-transfer-line line-b" />
          <div className="dvd-transfer-line line-c" />
        </main>

        <aside className="dvd-right">
          <section className="dvd-panel dvd-bottleneck">
            <div className="dvd-section-label">Future Bottleneck</div>
            <p>{vm.futureBottleneck}</p>
          </section>

          <section className="dvd-panel dvd-one-move">
            <div className="dvd-section-label">One Move</div>
            <h3>{vm.oneMove}</h3>
          </section>

          <section className={`dvd-panel dvd-risk ${riskClass(vm.wrongSeatRisk)}`}>
            <div className="dvd-section-label">Wrong-Seat Risk</div>
            <strong>{vm.wrongSeatRisk}</strong>
            <p>{vm.roleTruth}</p>
          </section>
        </aside>

        <footer className="dvd-footer dvd-panel">
          <SignalList title="Inputs" items={vm.inputs} />
          <div className="dvd-loop">
            <div className="dvd-mini-title">Operating Loop</div>
            <div className="dvd-loop-row">
              {(vm.operatingLoop || []).map((step, index) => (
                <LoopStep key={step} label={step} index={index} />
              ))}
            </div>
          </div>
          <SignalList title="Outputs" items={vm.outputs} />
          <div className="dvd-evolution">
            <div className="dvd-mini-title">Evolution Path</div>
            <p>{vm.evolutionPath}</p>
          </div>
          <div className="dvd-confidence">
            <span>Confidence</span>
            <strong>{vm.confidence}</strong>
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

@media (max-width: 900px) {
  .dvd-frame {
    min-width: 980px;
  }
}
`;
