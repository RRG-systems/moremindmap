import { Component, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BusinessArtifactViewer, {
  BUSINESS_ARTIFACT_WIDTH,
  FIVE_FUTURES_ARTIFACT_HEIGHT,
} from './components/businessAssessment/BusinessArtifactViewer.jsx';
import BusinessAssessmentFiveFuturesPremium, {
  hasPremiumFiveFuturesData,
  PREMIUM_FIVE_FUTURES_ARTIFACT_HEIGHT,
} from './components/businessAssessment/BusinessAssessmentFiveFuturesPremium.jsx';
import { normalizeBusinessVisualArtifactData } from './lib/businessAssessment/normalizeBusinessVisualArtifactData.js';

const FUTURES_CANVAS_WIDTH = BUSINESS_ARTIFACT_WIDTH;
const FUTURES_CANVAS_HEIGHT = FIVE_FUTURES_ARTIFACT_HEIGHT;
const PREMIUM_RENDERER_ENABLED = String(import.meta.env.VITE_BA_FIVE_FUTURES_PREMIUM || '').toLowerCase() === 'true';

function buildApiUrl(path) {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  return `${baseUrl}${path}`;
}

function resolveReturnTo(searchParams, profileId) {
  const requestedReturnTo = searchParams.get('returnTo') || '';
  if (requestedReturnTo.startsWith('/business-assessment')) return requestedReturnTo;
  const encodedProfileId = encodeURIComponent(profileId || '');
  return encodedProfileId
    ? `/business-assessment?id=${encodedProfileId}#business-assessment-results`
    : '/business-assessment';
}

function ArtifactShell({ children, profileId, returnTo }) {
  const navigate = useNavigate();

  function closeArtifact() {
    let storedReturnTo = '';
    try {
      storedReturnTo = window.sessionStorage.getItem('business_assessment_visual_return_url') || '';
      window.sessionStorage.removeItem('business_assessment_visual_return_url');
    } catch {
      storedReturnTo = '';
    }

    const hasAssessmentResultHistory =
      storedReturnTo === returnTo && Number(window.history.state?.idx || 0) > 0;

    if (hasAssessmentResultHistory) {
      navigate(-1);
      return;
    }

    navigate(returnTo || '/business-assessment', { replace: true });
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(59,130,246,0.14),transparent_30%),radial-gradient(circle_at_18%_16%,rgba(249,115,22,0.14),transparent_32%),radial-gradient(circle_at_78%_20%,rgba(168,85,247,0.14),transparent_33%),linear-gradient(180deg,#030303_0%,#09090b_58%,#000_100%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-[1800px] flex-col px-4 py-4">
        <nav className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={closeArtifact}
            className="text-left text-xs font-semibold uppercase tracking-[0.28em] text-orange-300 transition hover:text-orange-100"
          >
            Close / Business Assessment
          </button>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
            {profileId || 'Profile ID'} / Five Futures + One Move
          </div>
        </nav>
        {children}
      </div>
    </div>
  );
}

function LoadingState({ profileId, returnTo }) {
  return (
    <ArtifactShell profileId={profileId} returnTo={returnTo}>
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-white/70">Loading...</div>
    </ArtifactShell>
  );
}

function ErrorState({ profileId, message, returnTo }) {
  return (
    <ArtifactShell profileId={profileId} returnTo={returnTo}>
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

function evidenceStatus(label, status, note) {
  return { label, status, note };
}

function statusFromConfidence(value) {
  const text = String(value || '').toLowerCase();
  if (/high|strong|complete/.test(text)) return 'strong';
  if (/low|missing|weak/.test(text)) return 'missing';
  return 'partial';
}

function hasMeaningfulText(value, minLength = 80) {
  return String(value || '').trim().length >= minLength;
}

function buildEvidenceInputs(data) {
  const answers = data.answers || {};
  const financialText = String(answers.q9 || '');
  const financialCompleteness = [
    /closed units|units/i,
    /sales volume|volume/i,
    /gci|gross commission/i,
    /expenses|profit|net/i,
  ].filter((pattern) => pattern.test(financialText)).length;
  const relationshipText = `${answers.q3 || ''}\n${answers.q5 || ''}`;
  const hasRelationshipNumbers = /\b(true relationships|database|contacts)\b/i.test(relationshipText) && /\d/.test(relationshipText);
  const accountabilityScore = Number(data.eToP?.accountability?.score || 0);
  const systemsScore = Number(data.eToP?.systems?.score || 0);
  const confidenceStatus = statusFromConfidence(data.fiveFutures?.confidenceSnapshot || data.oneMove?.confidence);
  const constraintConfidence = statusFromConfidence(data.primaryConstraint?.confidence);
  const hasConstraint = hasMeaningfulText(data.primaryConstraint?.label, 12);
  const hasProfile = data.ownerProfileType && data.ownerProfileType !== 'MORE MindMap Profile';
  const modelSupported = /real[_\s-]?estate/i.test(`${data.assessmentType || ''} ${data.fiveFutures?.title || ''}`);

  return [
    evidenceStatus(
      'Financial Reality',
      financialCompleteness >= 4 ? 'strong' : financialCompleteness >= 2 ? 'partial' : 'missing',
      financialCompleteness >= 4 ? 'Units, volume, GCI, and expense/profit evidence present.' : financialCompleteness >= 2 ? 'Some financials present; deeper P&L/ROI detail may be incomplete.' : 'Financial evidence mostly missing.'
    ),
    evidenceStatus(
      'Behavioral Profile',
      hasProfile ? 'strong' : 'partial',
      hasProfile ? 'Owner behavioral profile context is available.' : 'Only partial profile context is available.'
    ),
    evidenceStatus(
      'Business Model',
      modelSupported ? 'strong' : data.assessmentType ? 'partial' : 'missing',
      modelSupported ? 'Real estate assessment model is applied.' : data.assessmentType ? 'Assessment type exists, but model fit is inferred.' : 'No supported business model evidence found.'
    ),
    evidenceStatus(
      'Constraint',
      hasConstraint && constraintConfidence !== 'missing' ? 'strong' : hasConstraint ? 'partial' : 'missing',
      hasConstraint && constraintConfidence !== 'missing' ? 'Primary constraint is detected with usable confidence.' : hasConstraint ? 'Primary constraint exists but confidence is weak or inferred.' : 'Primary constraint is missing.'
    ),
    evidenceStatus(
      'Confidence',
      confidenceStatus,
      confidenceStatus === 'strong' ? 'Overall confidence is high.' : confidenceStatus === 'partial' ? 'Overall confidence is moderate or mixed.' : 'Overall confidence is low or missing.'
    ),
    evidenceStatus(
      'Relationships',
      hasRelationshipNumbers ? 'strong' : /database|relationship|contacts/i.test(relationshipText) ? 'partial' : 'missing',
      hasRelationshipNumbers ? 'Total contacts and true relationship evidence are present.' : /database|relationship|contacts/i.test(relationshipText) ? 'Relationship evidence exists but counts are incomplete.' : 'Relationship evidence is missing.'
    ),
    evidenceStatus(
      'Accountability',
      accountabilityScore >= 7 ? 'strong' : accountabilityScore >= 3 ? 'partial' : 'missing',
      accountabilityScore >= 7 ? 'Inspection/accountability appears functional.' : accountabilityScore >= 3 ? 'Accountability exists only partially or is weak.' : 'Accountability evidence is absent or memory-based.'
    ),
    evidenceStatus(
      'Systems',
      systemsScore >= 7 ? 'strong' : systemsScore >= 3 ? 'partial' : 'missing',
      systemsScore >= 7 ? 'Systems appear repeatable.' : systemsScore >= 3 ? 'Systems/tools exist, but execution is inconsistent.' : 'Systems evidence is absent or mostly memory-based.'
    ),
  ];
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
      <p><strong>Root Constraint:</strong> {oneMove.rootConstraint}</p>
      <p><strong>Recommendation:</strong> {oneMove.recommendation}</p>
      <em><strong>Probability Shift:</strong> {oneMove.probabilityShift}</em>
    </section>
  );
}

function EvidenceRail({ inputs }) {
  return (
    <aside className="bff-inputs">
      <span>LDE Analysis</span>
      <strong>Evidence Status</strong>
      {inputs.map((source) => (
        <div className={`bff-input-row status-${source.status}`} key={source.label} title={source.note}>
          {source.label}
        </div>
      ))}
    </aside>
  );
}

function TrajectoryPaths() {
  const paths = [
    { key: 'current', tone: 'red', d: 'M 632 520 C 548 485, 505 390, 448 332', endpoint: [448, 332] },
    { key: 'likely', tone: 'orange', d: 'M 626 608 C 535 632, 498 678, 448 702', endpoint: [448, 702] },
    { key: 'constraint', tone: 'purple', d: 'M 858 500 C 914 434, 954 344, 1008 310', endpoint: [1008, 310] },
    { key: 'optimized', tone: 'green', d: 'M 866 618 C 924 642, 958 666, 1010 684', endpoint: [1010, 684] },
    { key: 'transform', tone: 'cyan', d: 'M 852 700 C 920 778, 958 896, 1010 1028', endpoint: [1010, 1028] },
  ];

  return (
    <svg className="bff-trajectory-svg" viewBox="0 0 1672 1720" aria-hidden="true">
      <defs>
        <filter id="bff-path-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {paths.map((path) => (
        <g key={path.key} className={`bff-trajectory-path tone-${path.tone}`}>
          <path className="glow" d={path.d} />
          <path className="midglow" d={path.d} />
          <path className="line" d={path.d} />
          <path className="spark" d={path.d} />
          <path className="spark offset" d={path.d} />
          <circle className="endpoint-glow" cx={path.endpoint[0]} cy={path.endpoint[1]} r="11" />
          <circle className="endpoint-core" cx={path.endpoint[0]} cy={path.endpoint[1]} r="3.2" />
        </g>
      ))}
    </svg>
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

class PremiumRendererBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    if (import.meta.env.DEV) {
      console.warn('[BA Five Futures] Premium renderer failed; falling back to legacy renderer.', error);
    }
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

function shouldUsePremiumRenderer({ data, searchParams }) {
  const mode = resolveRendererMode(searchParams);
  if (mode === 'legacy') return false;
  if (!hasPremiumFiveFuturesData(data)) {
    if (import.meta.env.DEV && (PREMIUM_RENDERER_ENABLED || mode === 'premium')) {
      console.warn('[BA Five Futures] Premium renderer requested but normalized data is incomplete; falling back to legacy renderer.');
    }
    return false;
  }
  return true;
}

function resolveRendererMode(searchParams) {
  const requested = String(searchParams.get('renderer') || '').toLowerCase();
  if (requested === 'legacy' || requested === 'premium' || requested === 'auto') return requested;
  return 'auto';
}

function FiveFuturesCanvas({ data }) {
  const futures = data.fiveFutures.futures || [];
  const current = futures.find((future) => future.key === 'current_future') || futures[0] || {};
  const likely = futures.find((future) => future.key === 'most_likely_next_future') || futures[1] || {};
  const displayFutures = futures.slice(0, 5);
  const evidenceInputs = buildEvidenceInputs(data);

  return (
    <div
      className="ba-fixed-canvas bff-canvas"
      data-renderer="legacy-five-futures"
      style={{
        '--ba-artifact-width': `${FUTURES_CANVAS_WIDTH}px`,
        '--ba-artifact-height': `${FUTURES_CANVAS_HEIGHT}px`,
      }}
    >
      <style>{styles}</style>
      <div className="bff-bg-grid" />
      <TrajectoryPaths />
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

      <EvidenceRail inputs={evidenceInputs} />

      <main className="bff-core">
        <div className="bff-orb-shell">
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
  const returnTo = resolveReturnTo(searchParams, profileId);
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

  if (state.status === 'loading') return <LoadingState profileId={profileId} returnTo={returnTo} />;
  if (state.status === 'error') return <ErrorState profileId={profileId} returnTo={returnTo} message={state.error} />;

  if (!data.hasFutures) {
    return (
      <ErrorState
        profileId={profileId}
        returnTo={returnTo}
        message="Five Futures + One Move is not ready yet. Complete futures generation first."
      />
    );
  }

  const legacyRenderer = <FiveFuturesCanvas data={data} />;
  const usePremiumRenderer = shouldUsePremiumRenderer({ data, searchParams });

  return (
    <ArtifactShell profileId={data.profileId} returnTo={returnTo}>
      <BusinessArtifactViewer
        width={FUTURES_CANVAS_WIDTH}
        height={usePremiumRenderer ? PREMIUM_FIVE_FUTURES_ARTIFACT_HEIGHT : FUTURES_CANVAS_HEIGHT}
      >
        {usePremiumRenderer ? (
          <PremiumRendererBoundary fallback={legacyRenderer}>
            <BusinessAssessmentFiveFuturesPremium data={data} />
          </PremiumRendererBoundary>
        ) : (
          legacyRenderer
        )}
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

.bff-trajectory-svg {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}

.bff-trajectory-path .glow {
  fill: none;
  stroke-width: 18;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.24;
  filter: url(#bff-path-glow);
}

.bff-trajectory-path .midglow {
  fill: none;
  stroke-width: 8;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.48;
  filter: url(#bff-path-glow);
}

.bff-trajectory-path .line {
  fill: none;
  stroke-width: 3.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.96;
}

.bff-trajectory-path .spark {
  fill: none;
  stroke: rgba(255,255,255,0.44);
  stroke-width: 1.2;
  stroke-linecap: round;
  stroke-dasharray: 7 32;
  opacity: 0.34;
}

.bff-trajectory-path .spark.offset {
  stroke-dasharray: 2 40;
  stroke-dashoffset: 16;
  opacity: 0.22;
}

.bff-trajectory-path .endpoint-glow {
  opacity: 0.22;
  filter: url(#bff-path-glow);
}

.bff-trajectory-path .endpoint-core {
  opacity: 0.86;
}

.bff-trajectory-path.tone-red .glow,
.bff-trajectory-path.tone-red .midglow,
.bff-trajectory-path.tone-red .line { stroke: #f87171; }
.bff-trajectory-path.tone-red .endpoint-glow,
.bff-trajectory-path.tone-red .endpoint-core { fill: #f87171; }
.bff-trajectory-path.tone-orange .glow,
.bff-trajectory-path.tone-orange .midglow,
.bff-trajectory-path.tone-orange .line { stroke: #fb923c; }
.bff-trajectory-path.tone-orange .endpoint-glow,
.bff-trajectory-path.tone-orange .endpoint-core { fill: #fb923c; }
.bff-trajectory-path.tone-purple .glow,
.bff-trajectory-path.tone-purple .midglow,
.bff-trajectory-path.tone-purple .line { stroke: #c084fc; }
.bff-trajectory-path.tone-purple .endpoint-glow,
.bff-trajectory-path.tone-purple .endpoint-core { fill: #c084fc; }
.bff-trajectory-path.tone-green .glow,
.bff-trajectory-path.tone-green .midglow,
.bff-trajectory-path.tone-green .line { stroke: #86efac; }
.bff-trajectory-path.tone-green .endpoint-glow,
.bff-trajectory-path.tone-green .endpoint-core { fill: #86efac; }
.bff-trajectory-path.tone-cyan .glow,
.bff-trajectory-path.tone-cyan .midglow,
.bff-trajectory-path.tone-cyan .line { stroke: #67e8f9; }
.bff-trajectory-path.tone-cyan .endpoint-glow,
.bff-trajectory-path.tone-cyan .endpoint-core { fill: #67e8f9; }

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
  top: 248px;
  z-index: 4;
  width: 208px;
  height: 706px;
  padding: 22px 17px;
}

.bff-inputs > span {
  display: block;
  color: #fed7aa;
  font-size: 14px;
  text-align: center;
}

.bff-inputs > strong {
  display: block;
  margin: 19px 0 13px;
  color: rgba(255,255,255,0.84);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
}

.bff-inputs .bff-input-row {
  position: relative;
  margin-top: 12px;
  border: 0;
  border-top: 1px solid rgba(255,255,255,0.09);
  border-radius: 0;
  padding: 14px 6px 11px 39px;
  background: transparent;
  color: rgba(255,255,255,0.72);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.055em;
}

.bff-inputs .bff-input-row::before {
  content: "";
  position: absolute;
  left: 5px;
  top: 13px;
  width: 22px;
  height: 22px;
  border: 1px solid rgba(251,146,60,0.36);
  border-radius: 999px;
  box-shadow: inset 0 0 16px rgba(251,146,60,0.07), 0 0 14px rgba(251,146,60,0.14);
}

.bff-input-row.status-strong::before {
  background: rgba(34,197,94,0.80);
  border-color: rgba(134,239,172,0.72) !important;
  box-shadow: 0 0 14px rgba(34,197,94,0.34), inset 0 0 10px rgba(187,247,208,0.22) !important;
}

.bff-input-row.status-partial::before {
  background: rgba(234,179,8,0.82);
  border-color: rgba(253,224,71,0.70) !important;
  box-shadow: 0 0 14px rgba(234,179,8,0.30), inset 0 0 10px rgba(254,240,138,0.18) !important;
}

.bff-input-row.status-missing::before {
  background: rgba(239,68,68,0.76);
  border-color: rgba(252,165,165,0.70) !important;
  box-shadow: 0 0 14px rgba(239,68,68,0.30), inset 0 0 10px rgba(254,202,202,0.18) !important;
}

.bff-core {
  position: absolute;
  left: 492px;
  top: 322px;
  z-index: 2;
  display: block;
  width: 500px;
  height: 500px;
}

.bff-orb-shell {
  width: 100%;
  height: 100%;
  overflow: visible;
  border: 0;
  background: transparent;
}

.bff-orb-shell::before {
  content: "";
  position: absolute;
  inset: 58px;
  border-radius: 999px;
  background:
    radial-gradient(circle, rgba(103,232,249,0.22), rgba(59,130,246,0.10) 44%, transparent 70%),
    radial-gradient(circle at 30% 25%, rgba(251,146,60,0.18), transparent 42%),
    radial-gradient(circle at 72% 74%, rgba(168,85,247,0.18), transparent 45%);
  filter: blur(16px);
  opacity: 0.88;
}

.bff-path {
  z-index: 1;
  height: 8px;
  border-radius: 999px;
  opacity: 0.86;
  filter: blur(0.2px);
}

.path-current { width: 500px; top: 162px; left: -320px; transform: rotate(-18deg); background: linear-gradient(90deg, transparent, rgba(248,113,113,0.90)); box-shadow: 0 0 24px rgba(248,113,113,0.62); }
.path-likely { width: 410px; top: 300px; left: -292px; transform: rotate(13deg); background: linear-gradient(90deg, transparent, rgba(251,146,60,0.92)); box-shadow: 0 0 24px rgba(251,146,60,0.62); }
.path-constraint { width: 438px; top: 106px; right: -312px; transform: rotate(18deg); background: linear-gradient(90deg, rgba(59,130,246,0.96), transparent); box-shadow: 0 0 24px rgba(59,130,246,0.62); }
.path-optimized { width: 426px; top: 282px; right: -304px; transform: rotate(-18deg); background: linear-gradient(90deg, rgba(34,197,94,0.92), transparent); box-shadow: 0 0 24px rgba(34,197,94,0.62); }
.path-transform { width: 476px; top: 408px; right: -346px; transform: rotate(15deg); background: linear-gradient(90deg, rgba(168,85,247,0.92), transparent); box-shadow: 0 0 24px rgba(168,85,247,0.62); }

.bff-orb-ring.outer {
  width: 360px;
  height: 360px;
  border-color: rgba(219,244,255,0.92);
  border-width: 3px;
  box-shadow:
    0 0 10px rgba(255,255,255,0.46),
    0 0 32px rgba(125,211,252,0.72),
    0 0 86px rgba(14,165,233,0.50),
    0 0 132px rgba(59,130,246,0.28),
    inset 0 0 52px rgba(125,211,252,0.24);
}

.bff-orb-ring.middle {
  width: 274px;
  height: 274px;
  border-color: rgba(251,146,60,0.48);
  box-shadow: 0 0 34px rgba(251,146,60,0.22), inset 0 0 26px rgba(168,85,247,0.15);
}

.bff-orb {
  width: 236px;
  height: 236px;
  border-color: rgba(125,211,252,0.68);
  background:
    radial-gradient(circle at 35% 28%, rgba(255,255,255,0.16), transparent 20%),
    radial-gradient(circle at 50% 45%, rgba(59,130,246,0.36), rgba(14,165,233,0.12) 44%, rgba(0,0,0,0.90) 72%),
    radial-gradient(circle at 72% 74%, rgba(168,85,247,0.22), transparent 58%);
  box-shadow:
    inset 0 0 58px rgba(96,165,250,0.24),
    inset 0 0 18px rgba(255,255,255,0.10),
    0 0 42px rgba(103,232,249,0.40),
    0 0 92px rgba(96,165,250,0.28),
    0 0 128px rgba(168,85,247,0.12);
}

.bff-orb::before,
.bff-orb::after {
  content: "";
  position: absolute;
  border-radius: 999px;
  pointer-events: none;
}

.bff-orb::before {
  inset: -23px;
  border: 1px solid rgba(103,232,249,0.30);
  transform: rotate(-18deg) scaleX(1.20);
}

.bff-orb::after {
  inset: -39px;
  border: 1px solid rgba(251,146,60,0.18);
  transform: rotate(24deg) scaleX(1.30);
}

.bff-orb span { font-size: 11px; }
.bff-orb h2 { margin: 10px 28px 0; font-size: 23px; }
.bff-orb p { margin: 9px 24px 0; }

.bff-lde {
  position: absolute;
  left: 72px;
  bottom: -132px;
  z-index: 4;
  width: 356px;
  padding: 18px 24px;
  text-align: center;
}

.bff-lde span {
  color: #fed7aa;
  font-size: 15px;
}

.bff-lde p {
  margin: 11px 0 0;
  color: rgba(255,255,255,0.78);
  font-size: 15px;
  line-height: 1.36;
}

.bff-move {
  position: absolute;
  left: 28px;
  right: auto;
  top: 1190px;
  bottom: auto;
  z-index: 4;
  width: 1394px;
  height: 358px;
}

.bff-one-move {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: auto auto 1fr;
  column-gap: 22px;
  height: 100%;
  border-color: rgba(251,146,60,0.34);
  padding: 24px 28px;
  overflow: visible;
}

.bff-one-move span,
.bff-one-move h2 {
  grid-column: 1 / 4;
}

.bff-one-move h2 {
  margin: 10px 0 0;
  color: #f8fafc;
  font-size: 28px;
  line-height: 1.06;
  text-transform: uppercase;
}

.bff-one-move p {
  display: block;
  width: auto;
  margin: 18px 0 0;
  color: rgba(255,255,255,0.75);
  font-size: 15px;
  line-height: 1.44;
  vertical-align: initial;
}

.bff-one-move p strong {
  display: block;
  margin-bottom: 4px;
  color: #fed7aa;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.10em;
  text-transform: uppercase;
}

.bff-one-move em strong {
  display: block;
  margin-bottom: 4px;
  color: #fed7aa;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.10em;
  text-transform: uppercase;
}

.bff-one-move em {
  display: block;
  width: auto;
  margin-top: 18px;
  color: #fed7aa;
  font-size: 15px;
  font-style: normal;
  line-height: 1.44;
  vertical-align: initial;
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
  width: 402px;
  min-height: 232px;
  padding: 18px 20px;
  pointer-events: auto;
  overflow: visible;
}

.future-1 { left: 28px; top: 228px; }
.future-2 { left: 28px; top: 596px; }
.future-3 { right: 268px; top: 238px; }
.future-4 { right: 268px; top: 568px; }
.future-5 { right: 268px; top: 898px; }

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
  font-size: 35px;
}

.bff-future-card h3 {
  font-size: 19px;
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
  margin-top: 4px;
  color: rgba(255,255,255,0.72);
  font-size: 11.5px;
  line-height: 1.25;
}

.bff-future-card p {
  margin-top: 11px;
  font-size: 11.5px;
  line-height: 1.34;
}

.bff-bottom {
  position: absolute;
  left: 28px;
  right: 250px;
  bottom: 32px;
  z-index: 4;
  display: grid;
  grid-template-columns: 1.4fr 1fr 1.25fr;
  gap: 12px;
}

.bff-band {
  min-height: 122px;
  padding: 22px 22px;
  text-align: center;
}

.bff-band p {
  margin: 10px 0 0;
  font-size: 15px;
  line-height: 1.35;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
`;
