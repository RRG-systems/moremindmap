import {
  BUSINESS_ARTIFACT_WIDTH,
} from './BusinessArtifactViewer.jsx';

const CANVAS_WIDTH = BUSINESS_ARTIFACT_WIDTH;
export const PREMIUM_FIVE_FUTURES_ARTIFACT_HEIGHT = 2360;
const CANVAS_HEIGHT = PREMIUM_FIVE_FUTURES_ARTIFACT_HEIGHT;

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
    .filter(Boolean);
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
  const rawSignals = signalsForFuture(future);
  const visibleSignals = rawSignals.slice(0, 6);
  return {
    key: future?.key || `future-${index}`,
    label: labelForFuture(future, index),
    title: clip(future?.title, 64, `Future ${index + 1}`),
    probability: probability(future?.probability),
    status: clip(statusForFuture(future), 44, 'Modeled trajectory'),
    signals: visibleSignals.length
      ? visibleSignals.map((signal) => clip(signal, 112))
      : [clip(future?.summary, 112, 'Evidence still being assembled')],
    hiddenSignalCount: Math.max(0, rawSignals.length - visibleSignals.length),
    interpretation: clip(
      future?.short_interpretation || future?.central_insight || future?.summary,
      170,
      'Interpretation becomes clearer as evidence improves.'
    ),
    tone: toneForFuture(future, index),
  };
}

/**
 * Truth Rail consumption is bind-only.
 * Final label/status/note semantics are supplied by Business Engine Contract truth_rail.
 * Renderer must not classify, regex-interpret, or re-threshold intelligence.
 */
function selectTruthRailEntries(data) {
  const contractEntries =
    data?.truthRail ||
    data?.businessEngineContract?.truth_rail?.current ||
    null;
  if (!Array.isArray(contractEntries) || !contractEntries.length) {
    return [
      {
        label: 'Truth Rail',
        status: 'missing',
        note: 'Truth Rail entries unavailable on contract; no renderer-side reinterpretation performed.',
      },
    ];
  }
  return contractEntries.map((entry) => ({
    label: entry?.label || entry?.name || 'Evidence',
    status: entry?.status || 'partial',
    note: entry?.note || entry?.detail || '',
  }));
}

function meaningful(value, fallback = '') {
  const source = text(value, fallback).trim();
  if (!source || source === 'Not available') return '';
  return source;
}

function sentenceCandidates(...values) {
  return values
    .flatMap((value) => meaningful(value).split(/(?<=[.!?])\s+/))
    .map((value) => value.trim())
    .filter((value) => value.length >= 18);
}

function uniqueClipped(items, maxItems = 3, maxLength = 135) {
  const seen = new Set();
  return items
    .map((item) => clip(item, maxLength, ''))
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxItems);
}

function buildOneMoveIntelligence(oneMove = {}) {
  const rootConstraint = meaningful(oneMove.rootConstraint, 'Root constraint not available.');
  const recommendation = meaningful(oneMove.recommendation, 'One Move not generated yet.');
  const whyThisMove = meaningful(oneMove.whyThisMove);
  const whyNow = meaningful(oneMove.whyNow);
  const modeledShift = meaningful(oneMove.probabilityShift, 'Modeled shift not available.');
  const first30Days = asArray(oneMove.first30Days).map((item) => meaningful(item)).filter(Boolean);
  const successIndicators = asArray(oneMove.successIndicators).map((item) => meaningful(item)).filter(Boolean);

  const downstreamEffects = uniqueClipped(
    sentenceCandidates(whyThisMove, modeledShift, recommendation),
    3,
    150
  );
  const proofToWatch = uniqueClipped(
    successIndicators.length ? successIndicators : first30Days,
    4,
    130
  );

  return {
    rootConstraint,
    recommendation,
    whyThisMove,
    whyNow,
    modeledShift,
    downstreamEffects: downstreamEffects.length
      ? downstreamEffects
      : ['Use recorded proof against the recommendation before claiming downstream movement.'],
    proofToWatch: proofToWatch.length
      ? proofToWatch
      : ['Record evidence that the recommended move was adopted before treating future movement as supported.'],
    confidence: meaningful(oneMove.confidence, 'Confidence not indexed'),
  };
}

export function hasGeneratedOneMoveIntelligence(data) {
  const provenance = data?.oneMove?.provenance;
  return Boolean(
    provenance?.completeForPremium &&
      provenance.hasRawTitle &&
      provenance.hasRawRootConstraint &&
      provenance.hasRawRecommendation &&
      provenance.hasRawModeledShift &&
      provenance.hasRawProofSignals
  );
}

export function hasPremiumFiveFuturesData(data) {
  const futures = data?.fiveFutures?.futures;
  return Boolean(
    data?.hasFutures &&
      Array.isArray(futures) &&
      futures.length >= 3 &&
      hasGeneratedOneMoveIntelligence(data)
  );
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
  const moreLabel = future.hiddenSignalCount === 1 ? '+1 MORE SIGNAL' : `+${future.hiddenSignalCount} MORE SIGNALS`;

  return (
    <article className={`bffp-future-card tone-${future.tone} side-${side}`}>
      <header>
        <span>{future.label}</span>
        <em>{future.probability}</em>
      </header>
      <strong>{future.title}</strong>
      <small>{future.status}</small>
      <div>
        <b>Signals</b>
        <ul>
          {future.signals.map((signal, index) => <li key={`${future.key}-signal-${index}`}>{signal}</li>)}
        </ul>
        {future.hiddenSignalCount > 0 && <i>{moreLabel}</i>}
      </div>
      <p>{future.interpretation}</p>
    </article>
  );
}

function TruthRail({ inputs }) {
  return (
    <aside className="bffp-truth-rail" aria-label="Assessment truth rail">
      <header>
        <span>LDE / Assessment Analysis</span>
        <strong>Evidence Status</strong>
      </header>
      <div>
        {inputs.map((input) => (
          <section className={`status-${input.status}`} key={input.label} title={input.note}>
            <i />
            <span>{input.label}</span>
          </section>
        ))}
      </div>
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

function OneMovePanel({ title, children, tone = 'orange' }) {
  return (
    <article className={`bffp-one-move-panel tone-${tone}`}>
      <span>{title}</span>
      {children}
    </article>
  );
}

function OneMoveHero({ oneMove }) {
  const intelligence = buildOneMoveIntelligence(oneMove);

  return (
    <section className="bffp-one-move-hero" aria-label="One Move hero intelligence block">
      <header className="bffp-one-move-hero-head">
        <div>
          <span>The One Move <em>→</em></span>
          <h2>{meaningful(oneMove?.title, 'One Move not available')}</h2>
          <p>The highest-leverage intervention selected from the trajectory field.</p>
        </div>
        <aside>
          <strong>Trajectory Intervention</strong>
          <p>The map shows the futures. The move changes the trajectory only when execution creates proof.</p>
        </aside>
      </header>

      <div className="bffp-one-move-grid">
        <OneMovePanel title="Root Constraint" tone="red">
          <p>{clip(intelligence.rootConstraint, 260, 'Root constraint not available.')}</p>
          {intelligence.whyNow && <small>{clip(intelligence.whyNow, 180)}</small>}
        </OneMovePanel>

        <OneMovePanel title="Recommended Move" tone="orange">
          <p>{clip(intelligence.recommendation, 360, 'Recommendation not available.')}</p>
          {intelligence.whyThisMove && <small>{clip(intelligence.whyThisMove, 185)}</small>}
        </OneMovePanel>

        <OneMovePanel title="Downstream Effects" tone="blue">
          <ul>
            {intelligence.downstreamEffects.map((effect, index) => (
              <li key={`downstream-${index}`}>{effect}</li>
            ))}
          </ul>
        </OneMovePanel>

        <OneMovePanel title="Modeled Shift" tone="purple">
          <p>{clip(intelligence.modeledShift, 360, 'Modeled shift not available.')}</p>
          <small>Confidence: {intelligence.confidence}</small>
        </OneMovePanel>

        <OneMovePanel title="Proof To Watch" tone="green">
          <ul>
            {intelligence.proofToWatch.map((proof, index) => (
              <li key={`proof-${index}`}>{proof}</li>
            ))}
          </ul>
        </OneMovePanel>
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
  const truthInputs = selectTruthRailEntries(data);
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
        <TruthRail inputs={truthInputs} />

        <DoctrineBars likely={likely} />
      </section>

      <OneMoveHero oneMove={data?.oneMove} />
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
  height: 1420px;
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
.bffp-truth-rail,
.bffp-doctrine section,
.bffp-one-move-hero,
.bffp-one-move-panel,
.bffp-one-move-hero-head aside {
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
.bffp-truth-rail header span,
.bffp-one-move-hero span,
.bffp-one-move-panel span {
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
  top: 9%;
  z-index: 3;
  width: 100%;
  height: 75%;
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
  right: 1.8%;
  top: 18.8%;
  bottom: 17.2%;
  z-index: 7;
  display: grid;
  grid-template-columns: 27.5% minmax(0, 1fr) 39%;
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
  padding: 16px 17px;
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
  font-size: 32px;
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
  margin-top: 11px;
  border-top: 1px solid rgba(255,255,255,0.10);
  padding-top: 9px;
}

.bffp-future-card ul {
  display: grid;
  gap: 4px;
  margin: 7px 0 0;
  padding: 0 0 0 16px;
  color: rgba(255,255,255,0.74);
  list-style: disc;
}

.bffp-future-card li {
  font-size: 13px;
  font-weight: 720;
  line-height: 1.22;
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
  margin: 9px 0 0;
  color: rgba(255,255,255,0.78);
  font-size: 13px;
  line-height: 1.28;
  display: -webkit-box;
  min-height: 1.3em;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.bffp-future-card.side-right {
  padding: 14px 16px;
}

.bffp-future-card.side-right header em {
  font-size: 30px;
}

.bffp-future-card.side-right strong {
  min-height: 2.28em;
  -webkit-line-clamp: 2;
}

.bffp-future-card.side-right li {
  font-size: 12px;
  line-height: 1.16;
}

.bffp-future-card.side-right p {
  font-size: 12px;
  line-height: 1.22;
  -webkit-line-clamp: 2;
}

.bffp-lde-insight {
  position: absolute;
  left: 35.8%;
  top: 60.2%;
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

.bffp-truth-rail {
  position: absolute;
  left: 1.8%;
  right: 1.8%;
  bottom: 8.7%;
  z-index: 8;
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 12px;
  padding: 13px 14px;
  border-color: rgba(254,215,170,0.17);
  background:
    radial-gradient(circle at 18% 50%, rgba(254,215,170,0.10), transparent 42%),
    linear-gradient(90deg, rgba(255,255,255,0.070), rgba(255,255,255,0.018)),
    rgba(0,0,0,0.62);
}

.bffp-truth-rail header {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  border-right: 1px solid rgba(255,255,255,0.10);
  padding-right: 14px;
}

.bffp-truth-rail header span {
  display: block;
  color: #fed7aa;
}

.bffp-truth-rail header strong {
  display: block;
  margin-top: 8px;
  color: rgba(255,255,255,0.72);
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.bffp-truth-rail > div {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.bffp-truth-rail section {
  display: grid;
  grid-template-columns: 10px 1fr;
  align-items: center;
  min-width: 0;
  gap: 8px;
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 10px;
  background: rgba(255,255,255,0.032);
  padding: 10px 11px;
}

.bffp-truth-rail i {
  display: grid;
  width: 10px;
  height: 10px;
  place-items: center;
  border-radius: 999px;
  background: #facc15;
  box-shadow: 0 0 14px rgba(250,204,21,0.40);
}

.bffp-truth-rail .status-strong i {
  background: #22c55e;
  box-shadow: 0 0 15px rgba(34,197,94,0.48);
}

.bffp-truth-rail .status-partial i {
  background: #facc15;
  box-shadow: 0 0 15px rgba(250,204,21,0.46);
}

.bffp-truth-rail .status-missing i {
  background: #ef4444;
  box-shadow: 0 0 15px rgba(239,68,68,0.48);
}

.bffp-truth-rail section span {
  color: rgba(255,255,255,0.68);
  font-size: 11px;
  font-style: normal;
  font-weight: 900;
  letter-spacing: 0.08em;
  line-height: 1.15;
  text-transform: uppercase;
}

.bffp-doctrine {
  position: absolute;
  left: 1.8%;
  right: 1.8%;
  bottom: 2.1%;
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

.bffp-one-move-hero {
  position: relative;
  height: 850px;
  margin-top: 28px;
  padding: 31px 34px;
  overflow: hidden;
  border-color: rgba(255,255,255,0.17);
  background:
    radial-gradient(circle at 13% 20%, rgba(255,255,255,0.12), transparent 20%),
    radial-gradient(circle at 70% 12%, rgba(251,146,60,0.18), transparent 30%),
    radial-gradient(circle at 81% 76%, rgba(59,130,246,0.18), transparent 30%),
    radial-gradient(circle at 32% 88%, rgba(168,85,247,0.12), transparent 28%),
    linear-gradient(140deg, rgba(255,255,255,0.078), rgba(255,255,255,0.018)),
    rgba(0,0,0,0.68);
}

.bffp-one-move-hero::before {
  content: "";
  position: absolute;
  left: 33%;
  right: 8%;
  top: 108px;
  height: 2px;
  background: linear-gradient(90deg, rgba(255,255,255,0.12), rgba(255,255,255,0.86), rgba(251,146,60,0.46), transparent);
  box-shadow: 0 0 26px rgba(255,255,255,0.28);
}

.bffp-one-move-hero::after {
  content: "";
  position: absolute;
  right: 6.5%;
  top: 92px;
  width: 26px;
  height: 26px;
  border-right: 2px solid rgba(255,255,255,0.72);
  border-top: 2px solid rgba(255,255,255,0.72);
  transform: rotate(45deg);
  filter: drop-shadow(0 0 16px rgba(255,255,255,0.44));
}

.bffp-one-move-hero-head {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) 390px;
  gap: 34px;
  align-items: start;
}

.bffp-one-move-hero-head h2 {
  max-width: 960px;
  margin: 14px 0 0;
  color: #fff;
  font-size: 51px;
  font-weight: 900;
  letter-spacing: -0.035em;
  line-height: 0.98;
  text-transform: uppercase;
  text-shadow:
    0 0 24px rgba(255,255,255,0.22),
    0 0 54px rgba(251,146,60,0.15);
}

.bffp-one-move-hero-head > div > p {
  max-width: 760px;
  margin: 18px 0 0;
  color: rgba(255,255,255,0.70);
  font-size: 18px;
  line-height: 1.35;
}

.bffp-one-move-hero-head span {
  color: rgba(255,255,255,0.92);
  font-size: 27px;
  letter-spacing: 0.12em;
}

.bffp-one-move-hero-head span em {
  color: #fff;
  font-style: normal;
  text-shadow: 0 0 18px rgba(255,255,255,0.46);
}

.bffp-one-move-hero-head aside {
  padding: 18px 20px;
  border-color: rgba(251,146,60,0.22);
  background:
    radial-gradient(circle at 90% 20%, rgba(251,146,60,0.14), transparent 42%),
    linear-gradient(145deg, rgba(255,255,255,0.064), rgba(255,255,255,0.014)),
    rgba(0,0,0,0.42);
}

.bffp-one-move-hero-head aside strong {
  color: #fed7aa;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.bffp-one-move-hero-head aside p {
  margin: 12px 0 0;
  color: rgba(255,255,255,0.70);
  font-size: 15px;
  line-height: 1.35;
}

.bffp-one-move-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr 1.45fr 1fr;
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 34px;
  height: 590px;
}

.bffp-one-move-panel {
  --tone: #fb923c;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 18px 19px;
  border-color: color-mix(in srgb, var(--tone) 46%, white 8%);
  background:
    radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--tone) 18%, transparent), transparent 42%),
    linear-gradient(145deg, rgba(255,255,255,0.074), rgba(255,255,255,0.016)),
    rgba(0,0,0,0.50);
}

.bffp-one-move-panel.tone-red { --tone: #f87171; }
.bffp-one-move-panel.tone-orange { --tone: #fb923c; }
.bffp-one-move-panel.tone-blue { --tone: #60a5fa; }
.bffp-one-move-panel.tone-purple { --tone: #c084fc; }
.bffp-one-move-panel.tone-green { --tone: #86efac; }

.bffp-one-move-panel:nth-child(2) {
  grid-column: span 2;
}

.bffp-one-move-panel span {
  color: var(--tone);
  font-size: 12px;
}

.bffp-one-move-panel p,
.bffp-one-move-panel li,
.bffp-one-move-panel small {
  color: rgba(255,255,255,0.74);
  font-size: 14px;
  line-height: 1.34;
}

.bffp-one-move-panel p {
  margin: 12px 0 0;
}

.bffp-one-move-panel small {
  display: block;
  margin-top: 12px;
  color: rgba(254,215,170,0.78);
}

.bffp-one-move-panel ul {
  display: grid;
  gap: 8px;
  margin: 12px 0 0;
  padding-left: 18px;
}

.bffp-one-move-panel li::marker {
  color: var(--tone);
}
`;
