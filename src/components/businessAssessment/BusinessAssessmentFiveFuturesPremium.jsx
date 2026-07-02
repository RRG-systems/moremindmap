import {
  BUSINESS_ARTIFACT_WIDTH,
  FIVE_FUTURES_ARTIFACT_HEIGHT,
} from './BusinessArtifactViewer.jsx';

const CANVAS_WIDTH = BUSINESS_ARTIFACT_WIDTH;
const CANVAS_HEIGHT = FIVE_FUTURES_ARTIFACT_HEIGHT;

const LDE_INPUTS = [
  ['LS', 'Leadership Signals'],
  ['RA', 'Recruiting Activity'],
  ['OH', 'Organizational Health'],
  ['FP', 'Financial Performance'],
  ['HT', 'Historical Trends'],
  ['AP', 'Accountability Patterns'],
  ['PS', 'Productivity Signals'],
];

function text(value, fallback = 'Not available') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string') return value.replace(/_/g, ' ');
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.length ? text(value[0], fallback) : fallback;
  if (typeof value === 'object') {
    return text(
      value.short_interpretation ||
        value.central_insight ||
        value.summary ||
        value.description ||
        value.label ||
        value.title ||
        value.signal,
      fallback
    );
  }
  return String(value);
}

function clip(value, max = 130, fallback = 'Not available') {
  const source = text(value, fallback).trim();
  if (source.length <= max) return source;
  return `${source.slice(0, max).trim()}...`;
}

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value];
}

function probability(value) {
  if (value === null || value === undefined || value === '') return '0%';
  const source = String(value).trim();
  return source.endsWith('%') ? source : `${source}%`;
}

function labelForFuture(future, index) {
  const key = future?.key || '';
  if (future?.label) return text(future.label);
  if (key === 'current_future') return 'Current Future';
  if (key === 'most_likely_next_future') return 'Most Likely Next';
  if (key === 'constraint_future') return 'Constraint Future';
  if (key === 'optimized_future') return 'Optimized Future';
  if (key === 'transformational_future') return 'Transformational Future';
  return `Future ${String.fromCharCode(65 + index)}`;
}

function statusForFuture(future) {
  const key = future?.key || '';
  if (future?.status) return text(future.status);
  if (key === 'current_future') return 'Active';
  if (key === 'most_likely_next_future') return 'Most likely next';
  if (key === 'constraint_future') return 'Requires operational repair';
  if (key === 'optimized_future') return 'Requires inspection';
  if (key === 'transformational_future') return 'Requires new operating model';
  return 'Modeled trajectory';
}

function signalsForFuture(future) {
  const source = future?.signal_bullets || future?.signals || future?.evidence || [];
  return asArray(source)
    .map((item) => text(item, ''))
    .filter(Boolean)
    .slice(0, 5);
}

function toneForFuture(future, index) {
  const key = future?.key || '';
  if (key === 'current_future' || index === 0) return 'red';
  if (key === 'most_likely_next_future' || index === 1) return 'orange';
  if (key === 'constraint_future' || index === 2) return 'blue';
  if (key === 'optimized_future' || index === 3) return 'green';
  return 'purple';
}

function normalizeFuture(future, index) {
  const signals = signalsForFuture(future);
  return {
    key: future?.key || `future-${index}`,
    label: labelForFuture(future, index),
    title: clip(future?.title, 64, `Future ${index + 1}`),
    probability: probability(future?.probability),
    status: clip(statusForFuture(future), 44, 'Modeled trajectory'),
    signal: clip(signals[0] || future?.summary, 68, 'Evidence still being assembled'),
    hiddenSignalCount: Math.max(0, signals.length - 1),
    interpretation: clip(
      future?.short_interpretation || future?.central_insight || future?.summary,
      96,
      'Interpretation becomes clearer as evidence improves.'
    ),
    tone: toneForFuture(future, index),
  };
}

export function hasPremiumFiveFuturesData(data) {
  const futures = data?.fiveFutures?.futures;
  return Boolean(data?.hasFutures && Array.isArray(futures) && futures.length >= 3);
}

function TrajectoryPaths() {
  const paths = [
    { key: 'red', tone: 'red', d: 'M 565 455 C 430 348, 360 330, 255 348', end: [255, 348] },
    { key: 'orange', tone: 'orange', d: 'M 548 610 C 420 680, 340 720, 250 718', end: [250, 718] },
    { key: 'blue', tone: 'blue', d: 'M 722 430 C 825 330, 925 300, 1055 320', end: [1055, 320] },
    { key: 'green', tone: 'green', d: 'M 738 548 C 842 548, 940 570, 1058 610', end: [1058, 610] },
    { key: 'purple', tone: 'purple', d: 'M 700 650 C 808 790, 930 860, 1065 858', end: [1065, 858] },
  ];

  return (
    <svg className="bffp-path-svg" viewBox="0 0 1320 930" aria-hidden="true">
      <defs>
        <filter id="bffpPathGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {paths.map((path) => (
        <g className={`bffp-path tone-${path.tone}`} key={path.key}>
          <path className="bffp-path-glow" d={path.d} />
          <path className="bffp-path-core" d={path.d} />
          <circle className="bffp-path-endpoint-glow" cx={path.end[0]} cy={path.end[1]} r="17" />
          <circle className="bffp-path-endpoint" cx={path.end[0]} cy={path.end[1]} r="7" />
        </g>
      ))}
    </svg>
  );
}

function FutureCard({ future, side = 'left' }) {
  const moreLabel = future.hiddenSignalCount === 1 ? '+1 SUPPORTING SIGNAL' : `+${future.hiddenSignalCount} SUPPORTING SIGNALS`;

  return (
    <article className={`bffp-future-card tone-${future.tone} side-${side}`}>
      <header>
        <span>{future.label}</span>
        <em>{future.probability}</em>
      </header>
      <strong>{future.title}</strong>
      <small>{future.status}</small>
      <div>
        <b>Primary Signal</b>
        <mark>{future.signal}</mark>
        {future.hiddenSignalCount > 0 && <i>{moreLabel}</i>}
      </div>
      {side === 'left' && <p>{future.interpretation}</p>}
    </article>
  );
}

function LdeRail() {
  return (
    <aside className="bffp-lde-rail" aria-label="LDE Analysis rail">
      <span>LDE Analysis</span>
      <strong>Inputs</strong>
      {LDE_INPUTS.map(([initials, label]) => (
        <div key={label}>
          <i>{initials}</i>
          <em>{label}</em>
        </div>
      ))}
    </aside>
  );
}

function LdeInsight({ current, likely, oneMove }) {
  return (
    <section className="bffp-lde-insight">
      <span>LDE Insight</span>
      <p><strong>{current.title}</strong> is the current trajectory already forming.</p>
      <p><strong>{likely.title}</strong> is the most likely next state unless the constraint changes.</p>
      <p className="bffp-one-move-line">One Move: {clip(oneMove?.title, 78, 'Intervention not available')}</p>
    </section>
  );
}

function DoctrineBars({ likely }) {
  return (
    <footer className="bffp-doctrine" aria-label="doctrine bars">
      <section>
        <strong>The Five Futures Are Not Aspirations.</strong>
        <p>They are probability-weighted trajectories based on current operating reality.</p>
      </section>
      <section>
        <strong>The Question Is Not:</strong>
        <p>What future do we want?</p>
      </section>
      <section>
        <strong>The Question Is:</strong>
        <p>What future are we already creating? Most likely next: {likely.probability}.</p>
      </section>
    </footer>
  );
}

function OneMoveIntervention({ oneMove }) {
  return (
    <section className="bffp-intervention">
      <span>One Move: Trajectory Intervention</span>
      <h2>{clip(oneMove?.title, 110, 'One Move not available')}</h2>
      <div>
        <p><strong>Root Constraint</strong>{clip(oneMove?.rootConstraint, 180, 'Root constraint not available.')}</p>
        <p><strong>Recommendation</strong>{clip(oneMove?.recommendation, 220, 'Recommendation not available.')}</p>
        <p><strong>Modeled Shift</strong>{clip(oneMove?.probabilityShift, 220, 'Probability shift not available.')}</p>
      </div>
    </section>
  );
}

export default function BusinessAssessmentFiveFuturesPremium({ data }) {
  const futures = (data?.fiveFutures?.futures || []).slice(0, 5).map(normalizeFuture);
  const current = futures.find((future) => future.key === 'current_future') || futures[0] || normalizeFuture({}, 0);
  const likely = futures.find((future) => future.key === 'most_likely_next_future') || futures[1] || futures[0] || normalizeFuture({}, 1);
  const leftFutures = [current, likely];
  const rightFutures = futures.filter((future) => !leftFutures.includes(future)).slice(0, 3);
  const subject = clip(data?.ownerName, 34, 'Business Assessment');
  const horizon = 'Current Trajectory';
  const currentStatus = `${current.title} / ${current.probability}`;

  return (
    <div
      className="ba-fixed-canvas bffp-canvas"
      data-renderer="premium-five-futures"
      style={{
        '--ba-artifact-width': `${CANVAS_WIDTH}px`,
        '--ba-artifact-height': `${CANVAS_HEIGHT}px`,
      }}
    >
      <style>{styles}</style>
      <section className="bffp-stage" aria-label="Premium Five Futures trajectory field">
        <div className="bffp-stage-label">Premium Five Futures Renderer</div>
        <header className="bffp-header">
          <div>
            <span>More MindMap / Business Assessment</span>
            <h1>The Five Futures</h1>
            <strong>The future is not predicted. It is modeled.</strong>
          </div>
          <section className="bffp-detected">
            <span>Current Trajectory Detected</span>
            <p>{clip(data?.currentTrajectory, 165, 'The system begins by identifying the future already forming.')}</p>
          </section>
          <section className="bffp-current-chip">
            <span>Current Future</span>
            <strong>{currentStatus}</strong>
            <em>Status: Active</em>
          </section>
        </header>

        <TrajectoryPaths />

        <div className="bffp-orb" aria-label="central current trajectory orb">
          <span>{subject}</span>
          <strong>{horizon}</strong>
          <em>{current.probability}</em>
          <p>{clip(current.interpretation, 72, 'Current path active')}</p>
        </div>

        <div className="bffp-future-grid">
          <div className="bffp-left-column">
            {leftFutures.map((future) => <FutureCard key={future.key} future={future} side="left" />)}
          </div>
          <div className="bffp-right-column">
            {rightFutures.map((future) => <FutureCard key={future.key} future={future} side="right" />)}
          </div>
        </div>

        <LdeInsight current={current} likely={likely} oneMove={data?.oneMove} />
        <LdeRail />

        <div className="bffp-legend" aria-label="trajectory legend">
          <span>Current Future / Active</span>
          <span>Most Likely Next Future</span>
          <span>Alternative Futures</span>
          <span>Required Intervention</span>
        </div>

        <DoctrineBars likely={likely} />
      </section>

      <OneMoveIntervention oneMove={data?.oneMove} />
    </div>
  );
}

const styles = `
.bffp-canvas {
  position: relative;
  overflow: hidden;
  padding: 30px;
  color: #f8fafc;
  background:
    radial-gradient(circle at 50% 33%, rgba(56,189,248,0.13), transparent 26%),
    radial-gradient(circle at 21% 27%, rgba(248,113,113,0.14), transparent 27%),
    radial-gradient(circle at 76% 49%, rgba(34,197,94,0.10), transparent 30%),
    radial-gradient(circle at 70% 73%, rgba(168,85,247,0.14), transparent 27%),
    linear-gradient(135deg, #020305 0%, #090b11 52%, #020203 100%);
  border: 1px solid rgba(251,146,60,0.24);
  box-shadow: inset 0 0 180px rgba(0,0,0,0.86), 0 0 72px rgba(59,130,246,0.12);
}

.bffp-stage {
  position: relative;
  width: 100%;
  height: 1090px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 18px;
  background:
    radial-gradient(circle at 48% 43%, rgba(125,211,252,0.34), transparent 17%),
    radial-gradient(circle at 18% 34%, rgba(248,113,113,0.24), transparent 22%),
    radial-gradient(circle at 25% 65%, rgba(251,146,60,0.20), transparent 23%),
    radial-gradient(circle at 73% 48%, rgba(34,197,94,0.17), transparent 23%),
    radial-gradient(circle at 76% 76%, rgba(168,85,247,0.20), transparent 25%),
    radial-gradient(ellipse at 50% 47%, rgba(15,23,42,0.16), rgba(0,0,0,0.50) 58%, rgba(0,0,0,0.82) 100%),
    linear-gradient(105deg, rgba(10,14,23,0.96), rgba(3,7,18,0.99) 52%, rgba(2,6,23,0.98)),
    #020205;
  box-shadow:
    inset 0 0 120px rgba(255,255,255,0.025),
    inset 0 0 190px rgba(0,0,0,0.86),
    0 40px 130px rgba(0,0,0,0.56),
    0 0 92px rgba(59,130,246,0.14);
}

.bffp-stage::before {
  content: "";
  position: absolute;
  inset: 0;
  opacity: 0.18;
  background-image:
    radial-gradient(circle, rgba(255,255,255,0.12) 0 1px, transparent 1.2px),
    linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px),
    linear-gradient(0deg, rgba(255,255,255,0.025) 1px, transparent 1px);
  background-size: 34px 34px, 64px 64px, 64px 64px;
  mask-image: radial-gradient(circle at 50% 50%, black, transparent 80%);
}

.bffp-stage::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(0,0,0,0.44), transparent 18%, transparent 77%, rgba(0,0,0,0.5)),
    linear-gradient(180deg, rgba(0,0,0,0.34), transparent 22%, transparent 77%, rgba(0,0,0,0.58));
  pointer-events: none;
}

.bffp-stage-label {
  position: absolute;
  left: 1.5%;
  top: 1.2%;
  z-index: 8;
  color: rgba(255,255,255,0.40);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.bffp-header {
  position: absolute;
  left: 1.5%;
  right: 1.5%;
  top: 4.2%;
  z-index: 8;
  display: grid;
  grid-template-columns: 34% 39% 24%;
  gap: 1.5%;
}

.bffp-header > div,
.bffp-detected,
.bffp-current-chip,
.bffp-future-card,
.bffp-lde-insight,
.bffp-lde-rail,
.bffp-legend,
.bffp-doctrine section,
.bffp-intervention {
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 13px;
  background:
    linear-gradient(145deg, rgba(255,255,255,0.092), rgba(255,255,255,0.018)),
    radial-gradient(circle at 20% 0%, rgba(254,215,170,0.055), transparent 44%),
    rgba(0,0,0,0.58);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.08),
    inset 0 0 30px rgba(255,255,255,0.026),
    0 0 38px rgba(0,0,0,0.48);
}

.bffp-header > div,
.bffp-detected,
.bffp-current-chip {
  padding: 17px 19px;
}

.bffp-header span,
.bffp-detected span,
.bffp-current-chip span,
.bffp-lde-insight span,
.bffp-lde-rail span,
.bffp-intervention span {
  color: rgba(254,215,170,0.86);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.bffp-header h1 {
  margin: 10px 0 0;
  color: #f8fafc;
  font-size: 58px;
  font-weight: 850;
  letter-spacing: -0.035em;
  line-height: 0.9;
  text-transform: uppercase;
}

.bffp-header strong {
  display: block;
  margin-top: 11px;
  color: rgba(254,215,170,0.92);
  font-size: 18px;
  font-weight: 500;
  line-height: 1.25;
}

.bffp-detected {
  position: relative;
  overflow: hidden;
}

.bffp-detected::after {
  content: "";
  position: absolute;
  right: 4%;
  top: 17%;
  width: 70px;
  aspect-ratio: 1;
  border: 1px solid rgba(251,146,60,0.30);
  border-radius: 999px;
  background:
    radial-gradient(circle, rgba(251,146,60,0.20), transparent 35%),
    repeating-conic-gradient(from 0deg, rgba(251,146,60,0.18) 0 8deg, transparent 8deg 22deg);
  opacity: 0.42;
  pointer-events: none;
}

.bffp-detected p {
  position: relative;
  z-index: 1;
  margin: 12px 96px 0 0;
  color: rgba(255,255,255,0.70);
  font-size: 16px;
  line-height: 1.42;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.bffp-current-chip strong {
  color: #fca5a5;
  font-size: 18px;
  line-height: 1.18;
  text-transform: uppercase;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.bffp-current-chip em {
  display: inline-block;
  margin-top: 10px;
  border: 1px solid rgba(248,113,113,0.34);
  border-radius: 999px;
  background: rgba(248,113,113,0.14);
  padding: 7px 11px;
  color: rgba(254,202,202,0.92);
  font-size: 11px;
  font-style: normal;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.bffp-path-svg {
  position: absolute;
  left: 0;
  top: 11%;
  z-index: 3;
  width: 100%;
  height: 78%;
  pointer-events: none;
}

.bffp-path {
  --tone: #fb923c;
}

.bffp-path.tone-red { --tone: #f87171; }
.bffp-path.tone-orange { --tone: #fb923c; }
.bffp-path.tone-blue { --tone: #60a5fa; }
.bffp-path.tone-green { --tone: #86efac; }
.bffp-path.tone-purple { --tone: #c084fc; }

.bffp-path-glow,
.bffp-path-core {
  fill: none;
  stroke: var(--tone);
  stroke-linecap: round;
}

.bffp-path-glow {
  stroke-width: 18;
  opacity: 0.24;
  filter: url(#bffpPathGlow);
}

.bffp-path-core {
  stroke-width: 5;
  stroke-dasharray: 14 18;
  opacity: 0.95;
  filter: drop-shadow(0 0 8px var(--tone)) drop-shadow(0 0 18px var(--tone));
}

.bffp-path-endpoint,
.bffp-path-endpoint-glow {
  fill: var(--tone);
  filter: drop-shadow(0 0 12px var(--tone));
}

.bffp-path-endpoint-glow {
  opacity: 0.34;
}

.bffp-orb {
  position: absolute;
  left: 45.5%;
  top: 43.5%;
  z-index: 5;
  display: flex;
  width: 275px;
  height: 275px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transform: translate(-50%, -50%);
  border: 2px solid rgba(186,230,253,0.86);
  border-radius: 999px;
  background:
    radial-gradient(circle at 32% 21%, rgba(255,255,255,0.42), transparent 15%),
    radial-gradient(circle at 50% 42%, rgba(147,197,253,0.52), rgba(14,165,233,0.20) 39%, rgba(2,6,23,0.86) 69%),
    radial-gradient(circle at 73% 77%, rgba(251,146,60,0.24), transparent 55%),
    linear-gradient(145deg, rgba(15,23,42,0.58), rgba(0,0,0,0.92));
  text-align: center;
  box-shadow:
    0 0 34px rgba(224,242,254,0.42),
    0 0 72px rgba(103,232,249,0.68),
    0 0 132px rgba(96,165,250,0.46),
    0 0 210px rgba(251,146,60,0.18),
    inset 0 0 28px rgba(255,255,255,0.10),
    inset 0 0 78px rgba(96,165,250,0.28);
}

.bffp-orb::before,
.bffp-orb::after {
  content: "";
  position: absolute;
  border: 1px solid rgba(103,232,249,0.26);
  border-radius: 999px;
}

.bffp-orb::before {
  inset: -14%;
  box-shadow: 0 0 38px rgba(103,232,249,0.15);
  transform: rotate(-18deg) scaleX(1.16);
}

.bffp-orb::after {
  inset: -25%;
  border-color: rgba(251,146,60,0.17);
  box-shadow: 0 0 42px rgba(251,146,60,0.10);
  transform: rotate(24deg) scaleX(1.25);
}

.bffp-orb span,
.bffp-orb strong,
.bffp-orb em,
.bffp-orb p {
  position: relative;
  z-index: 1;
}

.bffp-orb span {
  color: rgba(254,215,170,0.88);
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.bffp-orb strong {
  max-width: 210px;
  margin-top: 16px;
  color: #fff;
  font-size: 28px;
  line-height: 1.02;
  text-transform: uppercase;
  text-shadow: 0 0 20px rgba(186,230,253,0.28);
}

.bffp-orb em {
  margin-top: 14px;
  color: rgba(186,230,253,0.96);
  font-size: 26px;
  font-style: normal;
  font-weight: 450;
  letter-spacing: 0.08em;
}

.bffp-orb p {
  max-width: 190px;
  margin: 12px 0 0;
  color: rgba(255,255,255,0.66);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.12em;
  line-height: 1.25;
  text-transform: uppercase;
}

.bffp-future-grid {
  position: absolute;
  left: 1.8%;
  right: 15.2%;
  top: 24%;
  bottom: 17.5%;
  z-index: 7;
  display: grid;
  grid-template-columns: 25% minmax(0, 1fr) 33%;
  gap: 1.05%;
  pointer-events: none;
}

.bffp-left-column,
.bffp-right-column {
  display: grid;
  min-height: 0;
}

.bffp-left-column {
  grid-column: 1;
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: 2.1%;
}

.bffp-right-column {
  grid-column: 3;
  grid-template-rows: repeat(3, minmax(0, 1fr));
  gap: 1.2%;
}

.bffp-future-card {
  --tone: #fb923c;
  position: relative;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-color: var(--tone);
  padding: 16px;
  pointer-events: auto;
}

.bffp-future-card.tone-red { --tone: #f87171; }
.bffp-future-card.tone-orange { --tone: #fb923c; }
.bffp-future-card.tone-blue { --tone: #60a5fa; }
.bffp-future-card.tone-green { --tone: #86efac; }
.bffp-future-card.tone-purple { --tone: #c084fc; }

.bffp-future-card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(120deg, rgba(255,255,255,0.12), transparent 28%, transparent 78%);
  opacity: 0.40;
  pointer-events: none;
}

.bffp-future-card header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 14px;
}

.bffp-future-card header span,
.bffp-future-card b {
  color: var(--tone);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.bffp-future-card header em {
  color: var(--tone);
  font-size: 30px;
  font-style: normal;
  font-weight: 850;
  line-height: 0.95;
  text-shadow: 0 0 18px var(--tone);
}

.bffp-future-card strong,
.bffp-future-card small,
.bffp-future-card div,
.bffp-future-card p {
  position: relative;
  z-index: 1;
  display: block;
}

.bffp-future-card strong {
  margin-top: 10px;
  color: #fff;
  font-size: 18px;
  font-weight: 900;
  line-height: 1.14;
  text-transform: uppercase;
  display: -webkit-box;
  min-height: 2.26em;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.bffp-future-card small {
  margin-top: 7px;
  color: color-mix(in srgb, var(--tone) 82%, white 10%);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.12em;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.bffp-future-card div {
  margin-top: 12px;
  border-top: 1px solid rgba(255,255,255,0.10);
  padding-top: 10px;
}

.bffp-future-card mark {
  display: -webkit-box;
  margin-top: 8px;
  overflow: hidden;
  background: transparent;
  color: rgba(255,255,255,0.74);
  font-size: 13px;
  font-weight: 750;
  line-height: 1.26;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.bffp-future-card i {
  display: block;
  margin-top: 8px;
  color: var(--tone);
  font-size: 11px;
  font-style: normal;
  font-weight: 900;
  letter-spacing: 0.11em;
  line-height: 1.1;
  text-transform: uppercase;
}

.bffp-future-card p {
  margin: 10px 0 0;
  color: rgba(255,255,255,0.78);
  font-size: 13px;
  line-height: 1.3;
  display: -webkit-box;
  min-height: 1.3em;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.bffp-future-card.side-right {
  padding: 14px;
}

.bffp-future-card.side-right strong {
  min-height: 1.14em;
  -webkit-line-clamp: 1;
}

.bffp-future-card.side-right mark {
  -webkit-line-clamp: 1;
}

.bffp-lde-insight {
  position: absolute;
  left: 35.8%;
  top: 62.5%;
  z-index: 8;
  width: 22.2%;
  padding: 16px;
  border-color: rgba(251,146,60,0.24);
  background:
    radial-gradient(circle at 50% 0%, rgba(251,146,60,0.13), transparent 52%),
    linear-gradient(145deg, rgba(255,255,255,0.085), rgba(255,255,255,0.020)),
    rgba(0,0,0,0.62);
  text-align: center;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.08),
    inset 0 0 34px rgba(251,146,60,0.035),
    0 0 40px rgba(251,146,60,0.12),
    0 16px 42px rgba(0,0,0,0.45);
}

.bffp-lde-insight p {
  margin: 9px 0 0;
  color: rgba(255,255,255,0.74);
  font-size: 13px;
  line-height: 1.34;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.bffp-lde-insight strong {
  color: #fb923c;
}

.bffp-lde-insight .bffp-one-move-line {
  color: rgba(254,215,170,0.88);
  -webkit-line-clamp: 1;
}

.bffp-lde-rail {
  position: absolute;
  right: 1.65%;
  top: 24%;
  bottom: 17.5%;
  z-index: 8;
  width: 12.1%;
  padding: 17px 12px;
  border-color: rgba(254,215,170,0.17);
  background:
    radial-gradient(circle at 50% 0%, rgba(254,215,170,0.085), transparent 44%),
    linear-gradient(180deg, rgba(255,255,255,0.066), rgba(255,255,255,0.018)),
    rgba(0,0,0,0.62);
}

.bffp-lde-rail span {
  display: block;
  color: #fed7aa;
  text-align: center;
}

.bffp-lde-rail strong {
  display: block;
  margin-top: 18px;
  color: rgba(255,255,255,0.72);
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.bffp-lde-rail div {
  display: grid;
  grid-template-columns: 34px 1fr;
  align-items: center;
  gap: 11px;
  margin-top: 13px;
  border-top: 1px solid rgba(255,255,255,0.09);
  padding-top: 12px;
}

.bffp-lde-rail i {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid rgba(254,215,170,0.26);
  border-radius: 999px;
  background: radial-gradient(circle, rgba(254,215,170,0.16), transparent 58%), rgba(255,255,255,0.025);
  color: rgba(254,215,170,0.82);
  font-size: 11px;
  font-style: normal;
  font-weight: 900;
  box-shadow: 0 0 18px rgba(254,215,170,0.08);
}

.bffp-lde-rail em {
  color: rgba(255,255,255,0.68);
  font-size: 12px;
  font-style: normal;
  line-height: 1.25;
}

.bffp-legend {
  position: absolute;
  left: 1.8%;
  right: 52%;
  bottom: 11.8%;
  z-index: 8;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 7px;
  padding: 7px;
}

.bffp-legend span {
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 10px;
  background: linear-gradient(145deg, rgba(255,255,255,0.055), rgba(255,255,255,0.014)), rgba(0,0,0,0.40);
  padding: 12px 8px;
  color: rgba(255,255,255,0.72);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.10em;
  text-align: center;
  text-transform: uppercase;
}

.bffp-doctrine {
  position: absolute;
  left: 1.8%;
  right: 1.8%;
  bottom: 2.3%;
  z-index: 8;
  display: grid;
  grid-template-columns: 1.35fr 1fr 1.25fr;
  gap: 9px;
}

.bffp-doctrine section {
  min-width: 0;
  padding: 11px 13px;
  border-color: rgba(254,215,170,0.17);
  background: linear-gradient(90deg, rgba(251,146,60,0.08), rgba(255,255,255,0.026), rgba(96,165,250,0.07)), rgba(0,0,0,0.58);
}

.bffp-doctrine strong,
.bffp-doctrine p {
  margin: 0;
  color: rgba(255,255,255,0.78);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.10em;
  line-height: 1.35;
  text-align: center;
  text-transform: uppercase;
}

.bffp-doctrine strong {
  display: block;
  color: #fed7aa;
}

.bffp-doctrine p {
  margin-top: 4px;
}

.bffp-intervention {
  position: absolute;
  left: 30px;
  right: 30px;
  bottom: 32px;
  height: 510px;
  padding: 28px 34px;
  border-color: rgba(251,146,60,0.22);
  background:
    radial-gradient(circle at 86% 50%, rgba(251,146,60,0.16), transparent 28%),
    linear-gradient(145deg, rgba(255,255,255,0.075), rgba(255,255,255,0.018)),
    rgba(0,0,0,0.64);
}

.bffp-intervention h2 {
  margin: 14px 0 0;
  color: #f8fafc;
  font-size: 34px;
  line-height: 1.1;
  text-transform: uppercase;
}

.bffp-intervention div {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 22px;
  margin-top: 24px;
}

.bffp-intervention p {
  margin: 0;
  color: rgba(255,255,255,0.72);
  font-size: 16px;
  line-height: 1.45;
}

.bffp-intervention p strong {
  display: block;
  margin-bottom: 8px;
  color: #fed7aa;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
`;
