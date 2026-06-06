import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import BusinessArtifactViewer, {
  BUSINESS_ARTIFACT_WIDTH,
  FIVE_FUTURES_ARTIFACT_HEIGHT,
} from './components/businessAssessment/BusinessArtifactViewer.jsx';
import { normalizeBusinessVisualArtifactData } from './lib/businessAssessment/normalizeBusinessVisualArtifactData.js';

const FUTURES_CANVAS_WIDTH = BUSINESS_ARTIFACT_WIDTH;
const FUTURES_CANVAS_HEIGHT = FIVE_FUTURES_ARTIFACT_HEIGHT;

function buildApiUrl(path) {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  return `${baseUrl}${path}`;
}

function ArtifactShell({ children, profileId }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(59,130,246,0.14),transparent_30%),radial-gradient(circle_at_18%_16%,rgba(249,115,22,0.14),transparent_32%),radial-gradient(circle_at_78%_20%,rgba(168,85,247,0.14),transparent_33%),linear-gradient(180deg,#030303_0%,#09090b_58%,#000_100%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-[1800px] flex-col px-4 py-4">
        <nav className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/business-assessment" className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-300">
            MORE MINDMAP / Business Assessment
          </Link>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
            {profileId || 'Profile ID'} / Five Futures + One Move
          </div>
        </nav>
        {children}
      </div>
    </div>
  );
}

function LoadingState({ profileId }) {
  return (
    <ArtifactShell profileId={profileId}>
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-white/70">Loading...</div>
    </ArtifactShell>
  );
}

function ErrorState({ profileId, message }) {
  return (
    <ArtifactShell profileId={profileId}>
      <div className="rounded-3xl border border-red-400/30 bg-red-500/[0.08] p-8 text-red-100">
        {message}
      </div>
    </ArtifactShell>
  );
}

function clip(value, max = 190) {
  const text = String(value || 'Not available');
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
}

function futureTone(future) {
  const key = future.key || '';
  if (key.includes('constraint')) return 'purple';
  if (key.includes('optimized')) return 'green';
  if (key.includes('transformational')) return 'cyan';
  if (key.includes('most_likely')) return 'orange';
  return 'red';
}

function futureStatus(future) {
  if (future.status) return String(future.status).replace(/_/g, ' ');
  const key = future.key || '';
  if (key === 'current_future') return 'Current / Active';
  if (key === 'most_likely_next_future') return 'Most Likely';
  if (key === 'constraint_future') return 'Constraint Risk';
  if (key === 'optimized_future') return 'Requires Inspection';
  if (key === 'transformational_future') return 'New Operating Model';
  return 'Modeled';
}

function futureSignals(future) {
  const signals = future.signal_bullets || future.signals || future.evidence || [];
  const list = Array.isArray(signals) ? signals : [signals];
  return list
    .map((item) => {
      if (typeof item === 'string') return item;
      if (!item || typeof item !== 'object') return '';
      return item.summary || item.description || item.label || item.signal || Object.values(item).slice(0, 2).join(' / ');
    })
    .filter(Boolean)
    .slice(0, 4);
}

function displayLabel(future) {
  const key = future.key || '';
  if (key === 'current_future') return 'Current Future';
  if (key === 'most_likely_next_future') return 'Most Likely Next';
  if (key === 'constraint_future') return 'Constraint Future';
  if (key === 'optimized_future') return 'Optimized Future';
  if (key === 'transformational_future') return 'Transformational Future';
  return future.label || 'Future';
}

function FutureCard({ future, index }) {
  const tone = futureTone(future);
  const signals = futureSignals(future);

  return (
    <article className={`bff-future-card tone-${tone} future-${index + 1}`}>
      <div className="bff-future-head">
        <div>
          <span>{displayLabel(future)}</span>
          <em>Status: {futureStatus(future)}</em>
        </div>
        <strong>{future.probability}%</strong>
      </div>
      <h3>{future.title}</h3>
      <div className="bff-signals">
        <span>Signals</span>
        <ul>
          {signals.length ? signals.map((signal, signalIndex) => (
            <li key={`${signal}-${signalIndex}`}>{clip(signal, 78)}</li>
          )) : <li>{clip(future.summary, 78)}</li>}
        </ul>
      </div>
      <p><strong>Interpretation</strong>{clip(future.short_interpretation || future.central_insight || future.summary, 120)}</p>
    </article>
  );
}

function LdeInsight({ data, futures }) {
  const current = futures.find((future) => future.key === 'current_future');
  const mostLikely = futures.find((future) => future.key === 'most_likely_next_future');
  const constraint = futures.find((future) => future.key === 'constraint_future');
  const lake = data.businessMap?.lake;
  const oneMove = data.oneMove;

  const first = current?.title
    ? `${current.title} is not a failure signal. It is the business pattern already forming.`
    : 'The business is not failing. It is growing below the goal line.';
  const second = mostLikely?.title
    ? `${mostLikely.title} is the next state unless ${clip(oneMove.rootConstraint, 92).toLowerCase()} changes.`
    : `The next state is likely more production below the goal line unless the relationship lake grows toward ${lake?.target || 'the target'} and the weekly rhythm becomes inspectable.`;

  return (
    <section className="bff-lde">
      <span>LDE Insight</span>
      <p>{first}</p>
      <p>{second}</p>
    </section>
  );
}

function OneMoveCard({ oneMove }) {
  return (
    <section className="bff-one-move">
      <span>One Move</span>
      <h2>{oneMove.title}</h2>
      <p><strong>Root Constraint:</strong> {clip(oneMove.rootConstraint, 58)}</p>
      <p><strong>Recommendation:</strong> {clip(oneMove.recommendation, 68)}</p>
      <em>Probability Shift: {clip(oneMove.probabilityShift, 68)}</em>
    </section>
  );
}

function BottomBand({ title, text, tone }) {
  return (
    <section className={`bff-band tone-${tone}`}>
      <span>{title}</span>
      <p>{text}</p>
    </section>
  );
}

function FiveFuturesCanvas({ data }) {
  const futures = data.fiveFutures.futures || [];
  const current = futures.find((future) => future.key === 'current_future') || futures[0] || {};
  const likely = futures.find((future) => future.key === 'most_likely_next_future') || futures[1] || {};
  const displayFutures = futures.slice(0, 5);

  return (
    <div
      className="ba-fixed-canvas bff-canvas"
      style={{
        '--ba-artifact-width': `${FUTURES_CANVAS_WIDTH}px`,
        '--ba-artifact-height': `${FUTURES_CANVAS_HEIGHT}px`,
      }}
    >
      <style>{styles}</style>
      <div className="bff-bg-grid" />
      <header className="bff-header">
        <div className="bff-title">
          <h1>The Five Futures</h1>
          <p>The future is not predicted. It is modeled.</p>
          <em>Probability-weighted trajectories from the current operating reality.</em>
        </div>
        <div className="bff-trajectory-detected">
          <span>Current Trajectory Detected</span>
          <p>{clip(data.currentTrajectory, 132)}</p>
        </div>
        <div className="bff-current-status">
          <span>Current Future</span>
          <strong>{current.title || 'Current Future'}</strong>
          <em>Status: Active</em>
        </div>
      </header>

      <aside className="bff-inputs">
        <span>LDE Analysis</span>
        <strong>Inputs</strong>
        {['Financial Reality', 'Behavioral Profile', 'Business Model', 'Constraint Detection', 'Confidence Reality', 'Relationship Signals', 'Accountability Pattern', 'Systems Maturity'].map((source) => (
          <div key={source}>{source}</div>
        ))}
      </aside>

      <main className="bff-core">
        <div className="bff-orb-shell">
          <div className="bff-path path-current" />
          <div className="bff-path path-likely" />
          <div className="bff-path path-constraint" />
          <div className="bff-path path-optimized" />
          <div className="bff-path path-transform" />
          <div className="bff-orb-ring outer" />
          <div className="bff-orb-ring middle" />
          <div className="bff-orb">
            <span>{data.ownerName}</span>
            <h2>Current Trajectory</h2>
            <strong>{current.probability || 0}%</strong>
            <p>{clip(current.central_insight || current.summary, 118)}</p>
          </div>
        </div>
        <LdeInsight data={data} futures={futures} />
      </main>

      <aside className="bff-move">
        <OneMoveCard oneMove={data.oneMove} />
      </aside>

      <section className="bff-futures">
        {displayFutures.map((future, index) => (
          <FutureCard key={future.key || future.title} future={future} index={index} />
        ))}
      </section>

      <footer className="bff-bottom">
        <BottomBand
          title="The Five Futures Are Not Aspirations."
          text="They are probability-weighted trajectories based on the current operating reality."
          tone="orange"
        />
        <BottomBand
          title="The Question Is Not:"
          text="What future do we want?"
          tone="cyan"
        />
        <BottomBand
          title="The Question Is:"
          text={`What future are we already creating? Most likely next: ${likely.probability || 0}%.`}
          tone="purple"
        />
      </footer>
    </div>
  );
}

export default function BusinessAssessmentFiveFutures() {
  const [searchParams] = useSearchParams();
  const profileId = searchParams.get('id') || '';
  const [state, setState] = useState({ status: 'loading', error: '', record: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!profileId) {
        setState({ status: 'error', error: 'Profile ID is required.', record: null });
        return;
      }
      try {
        const response = await fetch(
          buildApiUrl(`/api/business-assessment/retrieve?id=${encodeURIComponent(profileId)}`)
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success || !payload?.found) {
          throw new Error(payload?.error || 'Business Assessment not found.');
        }
        if (cancelled) return;
        setState({ status: 'ready', error: '', record: payload });
      } catch (error) {
        if (cancelled) return;
        setState({ status: 'error', error: error.message || 'Unable to load visual artifact.', record: null });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const data = useMemo(() => normalizeBusinessVisualArtifactData(state.record), [state.record]);

  if (state.status === 'loading') return <LoadingState profileId={profileId} />;
  if (state.status === 'error') return <ErrorState profileId={profileId} message={state.error} />;

  if (!data.hasFutures) {
    return (
      <ErrorState
        profileId={profileId}
        message="Five Futures + One Move is not ready yet. Complete futures generation first."
      />
    );
  }

  return (
    <ArtifactShell profileId={data.profileId}>
      <BusinessArtifactViewer width={FUTURES_CANVAS_WIDTH} height={FUTURES_CANVAS_HEIGHT}>
        <FiveFuturesCanvas data={data} />
      </BusinessArtifactViewer>
    </ArtifactShell>
  );
}

const styles = `
.bff-canvas {
  position: relative;
  display: grid;
  grid-template-columns: 280px 1fr 390px;
  grid-template-rows: 92px 1fr 260px 120px;
  gap: 16px;
  padding: 24px;
  color: #f8fafc;
  border: 1px solid rgba(251,146,60,0.36);
  background:
    radial-gradient(circle at 50% 42%, rgba(59,130,246,0.17), transparent 31%),
    radial-gradient(circle at 64% 50%, rgba(251,146,60,0.12), transparent 34%),
    radial-gradient(circle at 35% 65%, rgba(168,85,247,0.15), transparent 38%),
    linear-gradient(135deg, #030405 0%, #080a0f 52%, #020203 100%);
  box-shadow: inset 0 0 120px rgba(0,0,0,0.78), 0 0 60px rgba(59,130,246,0.13);
}

.bff-bg-grid {
  position: absolute;
  inset: 0;
  opacity: 0.38;
  background-image:
    linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px),
    linear-gradient(0deg, rgba(255,255,255,0.032) 1px, transparent 1px);
  background-size: 72px 72px;
  mask-image: radial-gradient(circle at 50% 50%, black, transparent 78%);
}

.bff-header {
  position: relative;
  z-index: 2;
  grid-column: 1 / 4;
  display: grid;
  grid-template-columns: 420px 1fr 260px;
  gap: 16px;
}

.bff-header > div,
.bff-inputs,
.bff-lde,
.bff-one-move,
.bff-future-card,
.bff-band {
  border: 1px solid rgba(255,255,255,0.13);
  border-radius: 10px;
  background: linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.026));
  box-shadow: inset 0 0 32px rgba(255,255,255,0.025), 0 0 28px rgba(0,0,0,0.38);
  backdrop-filter: blur(8px);
}

.bff-header > div {
  padding: 16px 20px;
}

.bff-header span,
.bff-inputs span,
.bff-lde span,
.bff-one-move span,
.bff-band span,
.bff-future-head span {
  color: rgba(255,255,255,0.52);
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.16em;
}

.bff-header h1 {
  margin: 8px 0 0;
  color: #f8fafc;
  font-size: 31px;
  line-height: 1;
  text-transform: uppercase;
}

.bff-header-title {
  text-align: center;
}

.bff-header-title strong {
  display: block;
  margin-top: 9px;
  color: #fb923c;
  font-size: 34px;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.bff-total strong {
  display: block;
  margin-top: 5px;
  color: #67e8f9;
  font-size: 38px;
}

.bff-inputs,
.bff-core,
.bff-move,
.bff-futures,
.bff-bottom {
  position: relative;
  z-index: 2;
}

.bff-inputs {
  grid-column: 1 / 2;
  grid-row: 2 / 3;
  padding: 18px;
}

.bff-inputs div {
  margin-top: 13px;
  border: 1px solid rgba(255,255,255,0.11);
  border-radius: 9px;
  background: rgba(0,0,0,0.34);
  padding: 11px 13px;
  color: rgba(255,255,255,0.72);
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.bff-core {
  grid-column: 2 / 3;
  grid-row: 2 / 3;
  display: grid;
  grid-template-columns: 1fr 330px;
  gap: 16px;
}

.bff-orb-shell {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 0;
  overflow: hidden;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(0,0,0,0.27);
}

.bff-path {
  position: absolute;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(251,146,60,0.78), transparent);
}

.path-a { width: 70%; top: 39%; left: 15%; transform: rotate(12deg); }
.path-b { width: 80%; top: 53%; left: 10%; background: linear-gradient(90deg, transparent, rgba(103,232,249,0.76), transparent); }
.path-c { width: 64%; top: 66%; left: 18%; transform: rotate(-10deg); background: linear-gradient(90deg, transparent, rgba(192,132,252,0.72), transparent); }

.bff-orb-ring {
  position: absolute;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.17);
  box-shadow: 0 0 52px rgba(59,130,246,0.22);
}

.bff-orb-ring.outer { width: 370px; height: 370px; border-color: rgba(96,165,250,0.44); }
.bff-orb-ring.middle { width: 270px; height: 270px; border-color: rgba(251,146,60,0.42); }

.bff-orb {
  position: relative;
  z-index: 2;
  display: flex;
  width: 250px;
  height: 250px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid rgba(103,232,249,0.34);
  background: radial-gradient(circle, rgba(59,130,246,0.20), rgba(0,0,0,0.88) 69%);
  text-align: center;
}

.bff-orb span {
  color: #67e8f9;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.18em;
}

.bff-orb h2 {
  margin: 11px 26px 0;
  color: #f8fafc;
  font-size: 24px;
  line-height: 1.08;
}

.bff-orb strong {
  margin-top: 9px;
  color: #fb923c;
  font-size: 36px;
  line-height: 1;
}

.bff-orb p {
  margin: 9px 23px 0;
  color: rgba(255,255,255,0.60);
  font-size: 12px;
  line-height: 1.32;
}

.bff-lde {
  padding: 21px;
}

.bff-lde span {
  color: #c084fc;
}

.bff-lde p {
  margin: 18px 0 0;
  color: rgba(255,255,255,0.78);
  font-size: 18px;
  line-height: 1.42;
}

.bff-move {
  grid-column: 3 / 4;
  grid-row: 2 / 3;
}

.bff-one-move {
  height: 100%;
  padding: 22px;
}

.bff-one-move span {
  color: #fb923c;
}

.bff-one-move h2 {
  margin: 16px 0 0;
  color: #f8fafc;
  font-size: 31px;
  line-height: 1.08;
  text-transform: uppercase;
}

.bff-one-move p {
  margin: 18px 0 0;
  color: rgba(255,255,255,0.68);
  font-size: 16px;
  line-height: 1.45;
}

.bff-one-move strong {
  display: block;
  margin-top: 18px;
  color: #fed7aa;
  font-size: 17px;
  line-height: 1.45;
  font-weight: 600;
}

.bff-futures {
  grid-column: 1 / 4;
  grid-row: 3 / 4;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
}

.bff-future-card {
  overflow: hidden;
  padding: 15px;
}

.bff-future-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.bff-future-head strong {
  color: #f8fafc;
  font-size: 24px;
  line-height: 1;
}

.bff-future-card h3 {
  margin: 12px 0 0;
  color: #f8fafc;
  font-size: 20px;
  line-height: 1.1;
}

.bff-future-card p {
  margin: 10px 0 0;
  color: rgba(255,255,255,0.68);
  font-size: 13px;
  line-height: 1.34;
}

.bff-future-card em {
  display: block;
  margin-top: 10px;
  color: rgba(255,255,255,0.80);
  font-size: 12px;
  line-height: 1.28;
  font-style: normal;
}

.tone-purple { border-color: rgba(192,132,252,0.30); }
.tone-green { border-color: rgba(134,239,172,0.30); }
.tone-cyan { border-color: rgba(103,232,249,0.30); }
.tone-orange { border-color: rgba(251,146,60,0.30); }
.tone-blue { border-color: rgba(96,165,250,0.30); }

.bff-bottom {
  grid-column: 1 / 4;
  grid-row: 4 / 5;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 14px;
}

.bff-band {
  padding: 16px 18px;
}

.bff-band p {
  margin: 9px 0 0;
  color: rgba(255,255,255,0.72);
  font-size: 15px;
  line-height: 1.38;
}

/* Sprint 6C fixed-canvas intelligence map overrides. */
.bff-canvas {
  display: block;
  padding: 28px 28px 24px;
  overflow: hidden;
  background:
    radial-gradient(circle at 45% 44%, rgba(59,130,246,0.24), transparent 30%),
    radial-gradient(circle at 27% 48%, rgba(239,68,68,0.16), transparent 34%),
    radial-gradient(circle at 63% 49%, rgba(34,197,94,0.12), transparent 31%),
    radial-gradient(circle at 61% 72%, rgba(168,85,247,0.15), transparent 30%),
    linear-gradient(135deg, #030405 0%, #080a0f 52%, #020203 100%);
}

.bff-header {
  position: relative;
  z-index: 5;
  display: grid;
  grid-template-columns: 550px 1fr 340px;
  gap: 18px;
  height: 106px;
}

.bff-title h1 {
  margin: 0;
  color: #f8fafc;
  font-size: 50px;
  line-height: 0.95;
  text-transform: uppercase;
  letter-spacing: 0.015em;
  text-shadow: 0 0 30px rgba(255,255,255,0.18);
}

.bff-header > .bff-title {
  border: 0;
  padding: 0 0 0 10px;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}

.bff-title p {
  margin: 12px 0 0;
  color: #fed7aa;
  font-size: 23px;
  line-height: 1;
}

.bff-title em {
  display: block;
  margin-top: 9px;
  color: rgba(255,255,255,0.50);
  font-size: 12px;
  font-style: normal;
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

.bff-trajectory-detected,
.bff-current-status {
  border: 1px solid rgba(255,255,255,0.13);
  border-radius: 10px;
  padding: 18px 22px;
  background: linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.026));
  box-shadow: inset 0 0 32px rgba(255,255,255,0.025), 0 0 28px rgba(0,0,0,0.38);
}

.bff-trajectory-detected span { color: #fb923c; }
.bff-current-status span { color: #fca5a5; }

.bff-trajectory-detected p {
  margin: 12px 0 0;
  color: rgba(255,255,255,0.82);
  font-size: 14px;
  line-height: 1.35;
}

.bff-current-status strong {
  display: block;
  margin-top: 8px;
  color: #fca5a5;
  font-size: 17px;
  line-height: 1.12;
  text-transform: uppercase;
}

.bff-current-status em {
  display: inline-block;
  margin-top: 9px;
  border: 1px solid rgba(248,113,113,0.32);
  border-radius: 4px;
  padding: 4px 7px;
  color: #fed7aa;
  font-size: 11px;
  font-style: normal;
  text-transform: uppercase;
}

.bff-inputs {
  position: absolute;
  right: 24px;
  top: 224px;
  z-index: 4;
  width: 208px;
  height: 522px;
  padding: 20px 18px;
}

.bff-inputs > span {
  display: block;
  color: #fed7aa;
  font-size: 14px;
  text-align: center;
}

.bff-inputs > strong {
  display: block;
  margin: 21px 0 7px;
  color: rgba(255,255,255,0.84);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
}

.bff-inputs div {
  position: relative;
  margin-top: 11px;
  border: 0;
  border-top: 1px solid rgba(255,255,255,0.09);
  border-radius: 0;
  padding: 12px 8px 9px 44px;
  background: transparent;
  color: rgba(255,255,255,0.72);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.bff-inputs div::before {
  content: "";
  position: absolute;
  left: 5px;
  top: 9px;
  width: 28px;
  height: 28px;
  border: 1px solid rgba(251,146,60,0.36);
  border-radius: 999px;
  box-shadow: inset 0 0 16px rgba(251,146,60,0.07), 0 0 14px rgba(251,146,60,0.14);
}

.bff-core {
  position: absolute;
  left: 504px;
  top: 236px;
  z-index: 2;
  display: block;
  width: 520px;
  height: 520px;
}

.bff-orb-shell {
  width: 100%;
  height: 100%;
  overflow: visible;
  border: 0;
  background: transparent;
}

.bff-path {
  z-index: 1;
  height: 8px;
  border-radius: 999px;
  opacity: 0.86;
  filter: blur(0.2px);
}

.path-current { width: 520px; top: 178px; left: -338px; transform: rotate(-18deg); background: linear-gradient(90deg, transparent, rgba(248,113,113,0.90)); box-shadow: 0 0 24px rgba(248,113,113,0.62); }
.path-likely { width: 420px; top: 300px; left: -300px; transform: rotate(14deg); background: linear-gradient(90deg, transparent, rgba(251,146,60,0.92)); box-shadow: 0 0 24px rgba(251,146,60,0.62); }
.path-constraint { width: 460px; top: 120px; right: -330px; transform: rotate(18deg); background: linear-gradient(90deg, rgba(59,130,246,0.96), transparent); box-shadow: 0 0 24px rgba(59,130,246,0.62); }
.path-optimized { width: 430px; top: 286px; right: -315px; transform: rotate(-18deg); background: linear-gradient(90deg, rgba(34,197,94,0.92), transparent); box-shadow: 0 0 24px rgba(34,197,94,0.62); }
.path-transform { width: 500px; top: 388px; right: -365px; transform: rotate(15deg); background: linear-gradient(90deg, rgba(168,85,247,0.92), transparent); box-shadow: 0 0 24px rgba(168,85,247,0.62); }

.bff-orb-ring.outer { width: 345px; height: 345px; }
.bff-orb-ring.middle { width: 260px; height: 260px; }

.bff-orb {
  width: 238px;
  height: 238px;
  box-shadow: inset 0 0 54px rgba(96,165,250,0.16), 0 0 65px rgba(96,165,250,0.34);
}

.bff-orb span { font-size: 11px; }
.bff-orb h2 { margin: 11px 28px 0; font-size: 25px; }
.bff-orb p { margin: 9px 24px 0; }

.bff-lde {
  position: absolute;
  left: 86px;
  bottom: -18px;
  z-index: 4;
  width: 348px;
  padding: 20px 24px;
  text-align: center;
}

.bff-lde span {
  color: #fed7aa;
  font-size: 15px;
}

.bff-lde p {
  margin: 13px 0 0;
  color: rgba(255,255,255,0.78);
  font-size: 16px;
  line-height: 1.34;
}

.bff-move {
  position: absolute;
  left: 340px;
  right: auto;
  top: 728px;
  bottom: auto;
  z-index: 4;
  width: 520px;
  height: 180px;
}

.bff-one-move {
  height: 100%;
  border-color: rgba(251,146,60,0.34);
  padding: 15px 20px;
  overflow: hidden;
}

.bff-one-move h2 {
  margin: 8px 0 0;
  font-size: 15px;
}

.bff-one-move p {
  display: inline-block;
  width: 31.5%;
  margin: 8px 1.2% 0 0;
  font-size: 11.5px;
  line-height: 1.22;
  vertical-align: top;
}

.bff-one-move p strong {
  color: #fed7aa;
}

.bff-one-move em {
  display: inline-block;
  width: 31.5%;
  margin-top: 8px;
  color: #fed7aa;
  font-size: 11.5px;
  font-style: normal;
  line-height: 1.22;
  vertical-align: top;
}

.bff-futures {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: block;
  pointer-events: none;
}

.bff-future-card {
  position: absolute;
  width: 378px;
  min-height: 196px;
  padding: 17px 19px;
  pointer-events: auto;
}

.future-1 { left: 28px; top: 224px; }
.future-2 { left: 28px; top: 474px; }
.future-3 { right: 260px; top: 224px; }
.future-4 { right: 260px; top: 448px; }
.future-5 { right: 260px; top: 672px; }

.tone-red { border-color: rgba(248,113,113,0.35); }
.tone-red .bff-future-head strong,
.tone-red .bff-future-head span,
.tone-red .bff-signals span { color: #f87171; }
.tone-purple .bff-future-head strong,
.tone-purple .bff-future-head span,
.tone-purple .bff-signals span { color: #c084fc; }
.tone-green .bff-future-head strong,
.tone-green .bff-future-head span,
.tone-green .bff-signals span { color: #86efac; }
.tone-cyan .bff-future-head strong,
.tone-cyan .bff-future-head span,
.tone-cyan .bff-signals span { color: #67e8f9; }
.tone-orange .bff-future-head strong,
.tone-orange .bff-future-head span,
.tone-orange .bff-signals span { color: #fb923c; }

.bff-future-head em {
  display: block;
  margin-top: 5px;
  color: rgba(255,255,255,0.58);
  font-size: 10px;
  font-style: normal;
  text-transform: uppercase;
}

.bff-future-head strong {
  font-size: 34px;
}

.bff-future-card h3 {
  font-size: 20px;
  text-transform: uppercase;
}

.bff-signals {
  margin-top: 12px;
  border-top: 1px solid rgba(255,255,255,0.10);
  padding-top: 9px;
}

.bff-signals span,
.bff-future-card p strong {
  display: block;
  color: #fed7aa;
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.bff-signals ul {
  margin: 6px 0 0;
  padding-left: 14px;
}

.bff-signals li {
  margin-top: 3px;
  color: rgba(255,255,255,0.72);
  font-size: 11px;
  line-height: 1.24;
}

.bff-future-card p {
  margin-top: 10px;
  font-size: 11px;
  line-height: 1.30;
}

.bff-bottom {
  position: absolute;
  left: 28px;
  right: 250px;
  bottom: 24px;
  z-index: 4;
  display: grid;
  grid-template-columns: 1.4fr 1fr 1.25fr;
  gap: 12px;
}

.bff-band {
  min-height: 78px;
  padding: 13px 18px;
  text-align: center;
}

.bff-band p {
  margin: 7px 0 0;
  font-size: 13px;
  line-height: 1.25;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
`;
