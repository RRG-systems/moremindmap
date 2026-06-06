import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import BusinessArtifactViewer, {
  BUSINESS_ARTIFACT_WIDTH,
  BUSINESS_MAP_ARTIFACT_HEIGHT,
} from './components/businessAssessment/BusinessArtifactViewer.jsx';
import { normalizeBusinessVisualArtifactData } from './lib/businessAssessment/normalizeBusinessVisualArtifactData.js';

const MAP_CANVAS_WIDTH = BUSINESS_ARTIFACT_WIDTH;
const MAP_CANVAS_HEIGHT = BUSINESS_MAP_ARTIFACT_HEIGHT;

function buildApiUrl(path) {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  return `${baseUrl}${path}`;
}

function ArtifactShell({ children, title, profileId }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(249,115,22,0.18),transparent_31%),radial-gradient(circle_at_75%_15%,rgba(6,182,212,0.12),transparent_32%),radial-gradient(circle_at_50%_84%,rgba(168,85,247,0.13),transparent_34%),linear-gradient(180deg,#030303_0%,#09090b_56%,#000_100%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-[1800px] flex-col px-4 py-4">
        <nav className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/business-assessment" className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-300">
            MORE MINDMAP / Business Assessment
          </Link>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
            {profileId || 'Profile ID'} / {title}
          </div>
        </nav>
        {children}
      </div>
    </div>
  );
}

function LoadingState({ profileId }) {
  return (
    <ArtifactShell profileId={profileId} title="Business Operating System Diagnostic">
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-white/70">Loading...</div>
    </ArtifactShell>
  );
}

function ErrorState({ profileId, message }) {
  return (
    <ArtifactShell profileId={profileId} title="Business Operating System Diagnostic">
      <div className="rounded-3xl border border-red-400/30 bg-red-500/[0.08] p-8 text-red-100">
        {message}
      </div>
    </ArtifactShell>
  );
}

function clip(value, max = 210) {
  const text = String(value || 'Not available');
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
}

function displayAssessmentType(value) {
  return String(value || 'business_assessment')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayRole(data) {
  if (data.assessmentType === 'real_estate_agent') return 'Solo Real Estate Agent';
  if (data.assessmentType === 'real_estate_team') return 'Real Estate Team';
  return data.ownerProfileType;
}

function BrandMark() {
  return (
    <div className="bam-brand">
      <span>The</span>
      <strong>M<span className="bam-brand-o">O</span>RE</strong>
      <em>MindMap</em>
    </div>
  );
}

function MetricPanel({ title, metrics, tone = 'orange' }) {
  return (
    <section className={`bam-metric-panel tone-${tone}`}>
      <h2>{title}</h2>
      <div className="bam-metric-list">
        {metrics.map((metric) => (
          <div className="bam-metric-row" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function MiniTrend({ title, subtitle, caption, line, labels, tone = 'orange', upward = false }) {
  const stageLabels = labels || (upward ? ['Current', 'Rhythm', 'Growth', 'Target'] : ['Baseline', 'Momentum', 'Recent', 'Now']);

  return (
    <section className={`bam-trend-panel tone-${tone}`}>
      <h2>{title}</h2>
      <em>{subtitle}</em>
      <div className={`bam-mini-chart ${upward ? 'upward' : ''}`}>
        <span className="axis y1">{upward ? '$600K' : '$400K'}</span>
        <span className="axis y2">{upward ? '$300K' : '$200K'}</span>
        <span className="axis y3">$0</span>
        <i className="dot d1" />
        <i className="dot d2" />
        <i className="dot d3" />
        <i className="dot d4" />
        <span className="stage-label stage-1">{stageLabels[0]}</span>
        <span className="stage-label stage-2">{stageLabels[1]}</span>
        <span className="stage-label stage-3">{stageLabels[2]}</span>
        <span className="stage-label stage-4">{stageLabels[3]}</span>
      </div>
      <strong>{caption}</strong>
      <p>{line}</p>
    </section>
  );
}

function EToPCard({ title, item, tone }) {
  return (
    <div className={`bam-etop-card tone-${tone}`}>
      <div className="bam-etop-orbit">
        <strong>{item.score}</strong>
      </div>
      <span>{title}</span>
      <em>{item.score} / 10</em>
      <p>{item.label}</p>
    </div>
  );
}

function LakeModel({ lake }) {
  return (
    <section className="bam-lake-section">
      <div className="bam-lake-title">
        <span>The Lake Model</span>
        <p>Your business runs on relationships.</p>
      </div>
      <div className="bam-lake-grid">
        <div className="bam-streams">
          <strong>Streams</strong>
          <span>How people enter the business</span>
          {lake.streams.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
        <div className="bam-lake">
          <div className="bam-lake-glow" />
          <div className="bam-lake-water">
            <span>Relationship Lake</span>
            <strong>{lake.current}</strong>
            <em>{lake.label}</em>
            <p>{lake.subtext}</p>
          </div>
          <div className="bam-lake-gap">
            <span>Target {lake.target}</span>
            <span>Gap {lake.gap}</span>
          </div>
        </div>
        <div className="bam-outflow">
          <strong>Outflow</strong>
          <span>What the lake produces</span>
          {lake.outflow.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </div>
    </section>
  );
}

function ChainCard({ item, index }) {
  return (
    <section className={`bam-chain-card chain-${index}`}>
      <span>{item.title}</span>
      <p>{item.body}</p>
    </section>
  );
}

function BusinessMapCanvas({ data }) {
  const eToP = data.eToP || {};
  const map = data.businessMap || {};
  const currentTrajectory = map.currentTrajectory || {};
  const potentialTrajectory = map.potentialTrajectory || {};
  const assessmentLabel = displayAssessmentType(data.assessmentType);

  return (
    <div
      className="ba-fixed-canvas bam-canvas"
      style={{
        '--ba-artifact-width': `${MAP_CANVAS_WIDTH}px`,
        '--ba-artifact-height': `${MAP_CANVAS_HEIGHT}px`,
      }}
    >
      <style>{styles}</style>
      <div className="bam-bg-grid" />

      <header className="bam-header">
        <div className="bam-logo-block">
          <BrandMark />
        </div>
        <div className="bam-title-block">
          <h1>Business Operating System Diagnostic</h1>
          <p>Your Business. Your Numbers. Your Future.</p>
          <div>
            <span>Diagnosis Today.</span>
            <i />
            <span>Systems Tomorrow.</span>
            <i />
            <span>Results for Life.</span>
          </div>
        </div>
        <div className="bam-identity-block">
          <h2>{data.ownerName}</h2>
          <p>{displayRole(data)}</p>
          <span>Profile ID: <strong>{data.profileId}</strong></span>
          <span>Assessment: <strong>{assessmentLabel}</strong></span>
        </div>
      </header>

      <aside className="bam-left">
        <MetricPanel title="Current Business Reality" metrics={map.currentMetrics || []} tone="orange" />
        <MiniTrend
          title="Current Trajectory"
          subtitle="Past Business Pattern"
          caption={currentTrajectory.caption || 'Stable. Not Scaling.'}
          line={currentTrajectory.line || 'Production exists, but the operating rhythm limits growth.'}
          tone="orange"
        />
      </aside>

      <main className="bam-core">
        <div className="bam-etop">
          <div className="bam-etop-head">
            <span>Your Business Operating System</span>
            <strong>Five Pillars. One Predictable System.</strong>
          </div>
          <EToPCard title="Models" item={eToP.models || { score: 5, label: 'Needs validation' }} tone="orange" />
          <EToPCard title="Systems" item={eToP.systems || { score: 5, label: 'Needs validation' }} tone="cyan" />
          <EToPCard title="Tools" item={eToP.tools || { score: 5, label: 'Needs validation' }} tone="blue" />
          <EToPCard title="Accountability" item={eToP.accountability || { score: 5, label: 'Needs validation' }} tone="purple" />
          <EToPCard title="Education" item={eToP.education || { score: 5, label: 'Needs validation' }} tone="green" />
        </div>
        <LakeModel lake={map.lake || { current: 'Not provided', target: 'Not provided', gap: 'Not provided', streams: [], outflow: [] }} />
      </main>

      <aside className="bam-right">
        <MetricPanel title="Potential Business Future" metrics={map.targetMetrics || []} tone="green" />
        <MiniTrend
          title="Potential Trajectory"
          subtitle="Modeled Business Path"
          caption={potentialTrajectory.caption || 'Growing. Predictable. Scalable.'}
          line={potentialTrajectory.line || 'A weekly rhythm turns relationship equity into appointments.'}
          tone="green"
          upward
        />
      </aside>

      <section className="bam-bottom">
        {(map.chain || []).map((item, index) => (
          <ChainCard item={item} index={index} key={item.title} />
        ))}
      </section>
      <footer className="bam-footer">
        <strong>{map.closingInsight?.headline || 'REAL ESTATE SUCCESS IS NOT RANDOM. IT IS OPERATED.'}</strong>
        <span>{map.closingInsight?.subline || 'Use the One Move to shift the business toward a more predictable future.'}</span>
      </footer>
    </div>
  );
}

export default function BusinessAssessmentVisualMap() {
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

  if (!data.hasMap) {
    return (
      <ErrorState
        profileId={profileId}
        message="Business Assessment Map is not ready yet. Generate the diagnostic briefing first."
      />
    );
  }

  return (
    <ArtifactShell profileId={data.profileId} title="Business Operating System Diagnostic">
      <BusinessArtifactViewer width={MAP_CANVAS_WIDTH} height={MAP_CANVAS_HEIGHT}>
        <BusinessMapCanvas data={data} />
      </BusinessArtifactViewer>
    </ArtifactShell>
  );
}

const styles = `
.bam-canvas {
  position: relative;
  display: grid;
  grid-template-columns: 430px 1fr 430px;
  grid-template-rows: 142px 724px 162px 52px;
  gap: 14px;
  padding: 16px 26px 18px;
  color: #f8fafc;
  border: 1px solid rgba(251, 146, 60, 0.42);
  background:
    radial-gradient(circle at 50% 53%, rgba(14,165,233,0.20), transparent 30%),
    radial-gradient(circle at 66% 46%, rgba(132,204,22,0.10), transparent 32%),
    radial-gradient(circle at 32% 42%, rgba(249,115,22,0.12), transparent 35%),
    linear-gradient(135deg, #020202 0%, #05070a 48%, #010101 100%);
  box-shadow: inset 0 0 130px rgba(0,0,0,0.82), 0 0 70px rgba(249,115,22,0.16);
}

.bam-bg-grid {
  position: absolute;
  inset: 0;
  opacity: 0.36;
  background-image:
    linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px),
    linear-gradient(0deg, rgba(255,255,255,0.028) 1px, transparent 1px);
  background-size: 80px 80px;
  mask-image: radial-gradient(circle at 50% 52%, black, transparent 80%);
}

.bam-header {
  position: relative;
  z-index: 3;
  grid-column: 1 / 4;
  display: grid;
  grid-template-columns: 280px 1fr 365px;
  gap: 20px;
  align-items: stretch;
}

.bam-logo-block {
  border-right: 2px solid rgba(255,255,255,0.26);
}

.bam-brand {
  display: flex;
  height: 100%;
  flex-direction: column;
  justify-content: center;
}

.bam-brand span {
  color: rgba(255,255,255,0.72);
  font-size: 19px;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.34em;
}

.bam-brand strong {
  margin-top: 6px;
  color: #ffffff;
  font-size: 64px;
  font-weight: 400;
  line-height: 0.86;
  letter-spacing: 0.12em;
}

.bam-brand-o {
  position: relative;
  display: inline-block;
  color: #ff7a00;
  text-shadow: 0 0 20px rgba(249,115,22,0.72);
}

.bam-brand em {
  margin-top: 12px;
  color: #fb923c;
  font-size: 17px;
  font-style: normal;
  text-transform: uppercase;
  letter-spacing: 0.38em;
}

.bam-title-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.bam-title-block h1 {
  margin: 0;
  color: #f8fafc;
  font-size: 44px;
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.018em;
  text-shadow: 0 0 30px rgba(255,255,255,0.16);
}

.bam-title-block p {
  margin: 8px 0 0;
  color: #a855f7;
  font-size: 25px;
  font-weight: 800;
  line-height: 1;
}

.bam-title-block div {
  margin-top: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 19px;
  color: rgba(255,255,255,0.82);
  font-size: 15px;
  text-transform: uppercase;
  letter-spacing: 0.11em;
}

.bam-title-block i {
  width: 7px;
  height: 7px;
  border-radius: 99px;
  background: #fb923c;
  box-shadow: 0 0 16px rgba(251,146,60,0.82);
}

.bam-identity-block {
  display: flex;
  flex-direction: column;
  justify-content: center;
  border: 1px solid rgba(251,146,60,0.66);
  border-radius: 10px;
  padding: 18px 28px;
  background: rgba(0,0,0,0.44);
  box-shadow: inset 0 0 28px rgba(251,146,60,0.05), 0 0 28px rgba(251,146,60,0.10);
}

.bam-identity-block h2 {
  margin: 0;
  color: #f8fafc;
  font-size: 22px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.bam-identity-block p,
.bam-identity-block span {
  margin: 7px 0 0;
  color: rgba(255,255,255,0.86);
  font-size: 15px;
  line-height: 1.25;
}

.bam-identity-block span { color: #fb923c; }
.bam-identity-block strong {
  color: #f8fafc;
  font-weight: 500;
}

.bam-left,
.bam-right,
.bam-core,
.bam-bottom,
.bam-footer {
  position: relative;
  z-index: 2;
}

.bam-left,
.bam-right {
  display: grid;
  grid-template-rows: 1fr 1fr;
  gap: 14px;
}

.bam-core {
  display: grid;
  grid-template-rows: 226px 1fr;
  gap: 18px;
}

.bam-metric-panel,
.bam-trend-panel,
.bam-etop,
.bam-lake-section,
.bam-chain-card {
  border: 1px solid rgba(255,255,255,0.16);
  border-radius: 10px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.015)),
    rgba(0,0,0,0.42);
  box-shadow: inset 0 0 36px rgba(255,255,255,0.025), 0 0 28px rgba(0,0,0,0.42);
}

.bam-metric-panel,
.bam-trend-panel {
  padding: 19px 26px;
}

.bam-metric-panel h2,
.bam-trend-panel h2 {
  margin: 0 0 14px;
  color: #fb7c00;
  font-size: 20px;
  font-weight: 900;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.065em;
}

.tone-green h2 { color: #84cc16; }

.bam-trend-panel > em {
  display: block;
  margin: -8px 0 12px;
  color: rgba(255,255,255,0.58);
  font-size: 11px;
  font-style: normal;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.bam-metric-list {
  display: grid;
  gap: 8px;
}

.bam-metric-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: baseline;
  gap: 16px;
  min-height: 38px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}

.bam-metric-row span {
  color: rgba(255,255,255,0.86);
  font-size: 15px;
}

.bam-metric-row strong {
  color: #fb7c00;
  font-size: 28px;
  font-weight: 500;
  line-height: 1;
}

.tone-green .bam-metric-row strong { color: #84cc16; }

.bam-mini-chart {
  position: relative;
  height: 154px;
  margin: 15px 0 20px;
  border: 1px solid rgba(255,255,255,0.10);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.05) 1px, transparent 1px) 0 0 / 100% 50%,
    radial-gradient(circle at 88% 36%, rgba(251,146,60,0.15), transparent 34%),
    rgba(2,6,10,0.58);
}

.bam-mini-chart.upward {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.05) 1px, transparent 1px) 0 0 / 100% 50%,
    radial-gradient(circle at 86% 20%, rgba(132,204,22,0.18), transparent 40%),
    rgba(2,6,10,0.58);
}

.bam-mini-chart .axis {
  position: absolute;
  left: -48px;
  color: rgba(255,255,255,0.86);
  font-size: 13px;
}

.axis.y1 { top: -5px; }
.axis.y2 { top: 67px; }
.axis.y3 { bottom: -5px; }

.bam-mini-chart .stage-label {
  position: absolute;
  bottom: -26px;
  color: rgba(255,255,255,0.78);
  font-size: 12px;
  transform: translateX(-50%);
  white-space: nowrap;
}

.stage-1 { left: 10%; }
.stage-2 { left: 36%; }
.stage-3 { left: 62%; }
.stage-4 { left: 88%; }

.dot {
  position: absolute;
  width: 11px;
  height: 11px;
  border-radius: 99px;
  background: #fb7c00;
  box-shadow: 0 0 14px rgba(251,124,0,0.7);
}

.upward .dot {
  background: #84cc16;
  box-shadow: 0 0 14px rgba(132,204,22,0.7);
}

.d1 { left: 10%; top: 58%; }
.d2 { left: 36%; top: 50%; }
.d3 { left: 62%; top: 50%; }
.d4 { left: 88%; top: 42%; }
.upward .d1 { top: 74%; }
.upward .d2 { top: 61%; }
.upward .d3 { top: 43%; }
.upward .d4 { top: 18%; }

.bam-trend-panel strong {
  display: block;
  color: #fb7c00;
  font-size: 22px;
  text-align: center;
}

.tone-green.bam-trend-panel strong { color: #84cc16; }

.bam-trend-panel p {
  margin: 10px 0 0;
  color: rgba(255,255,255,0.84);
  font-size: 16px;
  text-align: center;
}

.bam-etop {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
  padding: 16px 24px 18px;
}

.bam-etop-head {
  grid-column: 1 / 6;
  text-align: center;
}

.bam-etop-head span {
  display: block;
  color: #a855f7;
  font-size: 21px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.bam-etop-head strong {
  display: block;
  margin-top: 6px;
  color: rgba(255,255,255,0.88);
  font-size: 14px;
  font-weight: 500;
}

.bam-etop-card {
  min-width: 0;
  text-align: center;
}

.bam-etop-orbit {
  display: grid;
  place-items: center;
  width: 84px;
  height: 84px;
  margin: 0 auto 9px;
  border: 2px solid #fb7c00;
  border-radius: 99px;
  box-shadow: inset 0 0 22px rgba(251,124,0,0.12), 0 0 24px rgba(251,124,0,0.24);
}

.tone-cyan .bam-etop-orbit { border-color: #0ea5e9; box-shadow: inset 0 0 22px rgba(14,165,233,0.12), 0 0 24px rgba(14,165,233,0.24); }
.tone-blue .bam-etop-orbit { border-color: #84cc16; box-shadow: inset 0 0 22px rgba(132,204,22,0.12), 0 0 24px rgba(132,204,22,0.24); }
.tone-purple .bam-etop-orbit { border-color: #a855f7; box-shadow: inset 0 0 22px rgba(168,85,247,0.12), 0 0 24px rgba(168,85,247,0.24); }
.tone-green .bam-etop-orbit { border-color: #f59e0b; box-shadow: inset 0 0 22px rgba(245,158,11,0.12), 0 0 24px rgba(245,158,11,0.24); }

.bam-etop-orbit strong {
  color: #f8fafc;
  font-size: 31px;
  line-height: 1;
}

.bam-etop-card span {
  display: block;
  color: #fb7c00;
  font-size: 14px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.tone-cyan span { color: #0ea5e9; }
.tone-blue span { color: #84cc16; }
.tone-purple span { color: #a855f7; }
.tone-green span { color: #f59e0b; }

.bam-etop-card em {
  display: block;
  margin-top: 7px;
  color: #f8fafc;
  font-size: 18px;
  font-style: normal;
}

.bam-etop-card p {
  margin: 6px auto 0;
  max-width: 116px;
  color: rgba(255,255,255,0.76);
  font-size: 11px;
  line-height: 1.18;
}

.bam-lake-section {
  position: relative;
  overflow: hidden;
  padding: 20px 32px 24px;
}

.bam-lake-title {
  text-align: center;
}

.bam-lake-title span {
  color: #0ea5e9;
  font-size: 22px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.bam-lake-title p {
  margin: 5px 0 0;
  color: rgba(255,255,255,0.84);
  font-size: 15px;
}

.bam-lake-grid {
  position: relative;
  display: grid;
  grid-template-columns: 170px 1fr 170px;
  gap: 18px;
  align-items: center;
  height: calc(100% - 44px);
}

.bam-streams,
.bam-outflow {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.bam-streams strong,
.bam-outflow strong {
  color: #0ea5e9;
  font-size: 16px;
  text-transform: uppercase;
  letter-spacing: 0.09em;
}

.bam-outflow strong { color: #84cc16; }

.bam-streams span,
.bam-outflow span {
  margin-top: -4px;
  color: rgba(255,255,255,0.58);
  font-size: 11px;
}

.bam-streams p,
.bam-outflow p {
  position: relative;
  margin: 0;
  color: rgba(255,255,255,0.84);
  font-size: 13px;
}

.bam-streams p::after,
.bam-outflow p::before {
  content: "";
  position: absolute;
  top: 50%;
  width: 158px;
  height: 1px;
  background: linear-gradient(90deg, #0ea5e9, transparent);
  box-shadow: 0 0 13px rgba(14,165,233,0.65);
}

.bam-streams p::after { left: 104%; }
.bam-outflow p::before {
  right: 104%;
  background: linear-gradient(90deg, transparent, #84cc16);
  box-shadow: 0 0 13px rgba(132,204,22,0.65);
}

.bam-lake {
  position: relative;
  display: grid;
  min-height: 386px;
  place-items: center;
}

.bam-lake-glow {
  position: absolute;
  width: 420px;
  height: 270px;
  border-radius: 50%;
  background:
    radial-gradient(ellipse at center, rgba(14,165,233,0.70), rgba(14,165,233,0.12) 52%, transparent 72%);
  filter: blur(2px);
  transform: perspective(380px) rotateX(60deg);
  box-shadow: 0 0 55px rgba(14,165,233,0.50);
}

.bam-lake-water {
  position: relative;
  z-index: 2;
  display: flex;
  width: 360px;
  height: 210px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid rgba(125,211,252,0.55);
  background:
    repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 11px),
    radial-gradient(ellipse at center, rgba(14,165,233,0.70), rgba(7,89,133,0.62) 58%, rgba(0,0,0,0.52));
  text-align: center;
  box-shadow: inset 0 0 36px rgba(255,255,255,0.14), 0 0 48px rgba(14,165,233,0.46);
}

.bam-lake-water span {
  color: #f8fafc;
  font-size: 17px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.bam-lake-water strong {
  margin-top: 4px;
  color: #ffffff;
  font-size: 52px;
  line-height: 1;
}

.bam-lake-water em {
  margin-top: 4px;
  color: #f8fafc;
  font-size: 17px;
  font-style: normal;
  font-weight: 800;
}

.bam-lake-water p {
  max-width: 240px;
  margin: 9px 0 0;
  color: rgba(255,255,255,0.84);
  font-size: 14px;
  line-height: 1.28;
}

.bam-lake-gap {
  position: absolute;
  bottom: 18px;
  display: flex;
  gap: 10px;
}

.bam-lake-gap span {
  border: 1px solid rgba(14,165,233,0.35);
  border-radius: 999px;
  padding: 6px 12px;
  background: rgba(0,0,0,0.52);
  color: rgba(255,255,255,0.86);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.bam-bottom {
  grid-column: 1 / 4;
  display: grid;
  grid-template-columns: 1.25fr 1fr 1fr 1fr 1.18fr;
  gap: 14px;
}

.bam-chain-card {
  position: relative;
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  padding: 18px 22px;
}

.bam-chain-card:not(:last-child)::after {
  content: ">";
  position: absolute;
  right: -13px;
  top: 50%;
  z-index: 3;
  color: rgba(255,255,255,0.72);
  font-size: 24px;
  transform: translateY(-50%);
}

.bam-chain-card span {
  color: #fb7c00;
  font-size: 14px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.075em;
}

.chain-1 span { color: #a855f7; }
.chain-2 span { color: #0ea5e9; }
.chain-3 span { color: #84cc16; }
.chain-4 span { color: #fb7c00; }

.bam-chain-card p {
  margin: 10px 0 0;
  color: rgba(255,255,255,0.86);
  font-size: 14px;
  line-height: 1.34;
}

.chain-4 p {
  color: #f8fafc;
  font-size: 18px;
  line-height: 1.26;
}

.bam-footer {
  grid-column: 1 / 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.bam-footer strong {
  color: rgba(255,255,255,0.88);
  font-size: 21px;
  font-weight: 500;
  letter-spacing: 0.08em;
}

.bam-footer strong::before,
.bam-footer strong::after {
  color: #a855f7;
  font-size: 46px;
  font-weight: 900;
  line-height: 0;
}

.bam-footer strong::before { content: "“"; margin-right: 14px; }
.bam-footer strong::after { content: "”"; margin-left: 14px; }

.bam-footer span {
  margin-top: 6px;
  color: rgba(255,255,255,0.62);
  font-size: 15px;
}
`;
