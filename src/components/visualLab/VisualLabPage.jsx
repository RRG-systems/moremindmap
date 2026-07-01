import { useMemo, useState } from 'react';
import DeterministicVisualDNA from '../visualDNA/DeterministicVisualDNA.jsx';
import { MARCUS_VISUAL_DNA_SAMPLE } from '../../lib/visualDNA/buildVisualDNAViewModel.js';

const ADMIN_CODE = 'MOREADMIN26';

const visualSystems = [
  {
    id: 'bos-visual-dna',
    title: 'BOS Visual DNA Lab',
    currentName: 'Behavioral Operating System poster',
    futureDirection: 'The Human Operating Signature',
    role: 'Compresses behavioral operating style, decision pattern, communication rhythm, pressure response, and role energy.',
    productionFiles: [
      'src/components/visualDNA/DeterministicVisualDNA.jsx',
      'src/components/visualDNA/VisualDNAModal.jsx',
      'src/lib/visualDNA/buildVisualDNAViewModel.js',
      'api/moremindmap/visual-dna/*'
    ],
    risks: 'Stored Visual DNA image records and profile rendering depend on profile-specific data and approval state. Candidate work must remain beside production until explicitly approved.',
    candidateNotes: [
      'Identity-based, not an HR horoscope.',
      'Show natural role energy without clinical language.',
      'Make pressure response and communication rhythm visible without overclaiming.'
    ],
    accent: 'orange'
  },
  {
    id: 'business-assessment-visual-dna',
    title: 'Business Assessment Visual DNA Lab',
    currentName: 'Business Operating System Diagnostic',
    futureDirection: 'The Business Reality Map',
    role: 'Compresses business engine, relationship engine, constraint map, systems maturity, financial pressure, and execution rhythm.',
    productionFiles: [
      'src/BusinessAssessmentVisualMap.jsx',
      'src/components/businessAssessment/BusinessArtifactViewer.jsx',
      'src/lib/businessAssessment/normalizeBusinessVisualArtifactData.js',
      'api/business-assessment/retrieve'
    ],
    risks: 'The production route fetches saved assessment output by profile ID. The lab uses snapshots only to avoid live assessment retrieval or mutation.',
    candidateNotes: [
      'Business engine first, decoration second.',
      'Make constraint, lead flow, and execution rhythm legible at a glance.',
      'Show financial pressure as evidence status, not artificial certainty.'
    ],
    accent: 'purple'
  },
  {
    id: 'five-futures-visual',
    title: 'Five Futures Visual Lab',
    currentName: 'The Five Futures + One Move artifact',
    futureDirection: 'The Trajectory Field',
    role: 'Compresses current trajectory, most likely next trajectory, alternative trajectories, required intervention, and One Move leverage.',
    productionFiles: [
      'src/BusinessAssessmentFiveFutures.jsx',
      'src/lib/businessAssessment/normalizeBusinessVisualArtifactData.js',
      'api/business-assessment/generate-futures.js',
      'api/engine/businessAssessment/buildFiveFuturesPrompt.js'
    ],
    risks: 'Five Futures are generated from saved assessment and profile context. This lab must not alter probabilities, generation logic, or stored future artifacts.',
    candidateNotes: [
      'Navigation system, not five equal pretty options.',
      'Make the future already forming more obvious than the alternatives.',
      'Show how One Move could shift the trajectory without claiming live movement.'
    ],
    accent: 'cyan'
  }
];

const mockBusinessReality = [
  ['Current constraint', 'Relationship engine not yet inspectable weekly'],
  ['Lead flow', 'Uneven source clarity'],
  ['Systems maturity', 'Emerging'],
  ['Financial pressure', 'Partially indexed'],
  ['Execution rhythm', 'Action proof required']
];

const mockFutures = [
  { label: 'Future A', title: 'Optimized Growth', tone: 'green', likelihood: 'Possible with proof' },
  { label: 'Future B', title: 'Steady Progress', tone: 'blue', likelihood: 'Most likely next' },
  { label: 'Future C', title: 'Constraint Bottleneck', tone: 'purple', likelihood: 'Risk if unchanged' },
  { label: 'Future D', title: 'Current Drift', tone: 'orange', likelihood: 'Current trajectory' },
  { label: 'Future E', title: 'Transformational Intelligence', tone: 'cyan', likelihood: 'Requires intervention' }
];

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function AccessGate({ onUnlock }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  function submit(event) {
    event.preventDefault();
    if (code.trim() === ADMIN_CODE) {
      onUnlock();
      return;
    }
    setError('Internal lab access requires the admin code.');
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(251,146,60,0.16),transparent_30%),radial-gradient(circle_at_74%_30%,rgba(59,130,246,0.13),transparent_34%),linear-gradient(180deg,#030303,#09090b_58%,#000)]" />
      <section className="relative mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6">
        <div className="rounded-2xl border border-white/12 bg-white/[0.055] p-7 shadow-2xl shadow-black/35 backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-orange-200">Internal Visual Lab</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Preview route locked.</h1>
          <p className="mt-3 text-sm leading-6 text-white/62">
            This workspace uses mock/static visual candidates only. It is not linked from public navigation and does not write records.
          </p>
          <form className="mt-6 space-y-3" onSubmit={submit}>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="w-full rounded-xl border border-white/12 bg-black/45 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-orange-300/70"
              placeholder="Admin code"
              type="password"
            />
            <button
              type="submit"
              className="w-full rounded-xl border border-orange-300/45 bg-orange-300/12 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-orange-50 transition hover:border-orange-200 hover:bg-orange-300/18"
            >
              Open Lab
            </button>
          </form>
          {error && <p className="mt-3 text-sm text-red-200">{error}</p>}
        </div>
      </section>
    </main>
  );
}

function LabHeader() {
  return (
    <header className="border-b border-white/10 bg-black/45 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-orange-200">Visual Lab / Internal</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">MORE MindMap Visual Design Lab</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/62 md:text-base">
            Offline preview foundation for BOS Visual DNA, Business Assessment Visual DNA, and Five Futures visual candidates.
            Current production visuals remain unchanged.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-xs leading-5 text-white/56">
          <strong className="block text-white/82">Safety doctrine</strong>
          Static data only. No OpenAI calls. No image generation. No stored record mutation.
        </div>
      </div>
    </header>
  );
}

function SystemNotes({ system }) {
  return (
    <aside className={cx('vl-card vl-notes', `accent-${system.accent}`)}>
      <p className="vl-kicker">Current architecture</p>
      <h3>{system.currentName}</h3>
      <p>{system.role}</p>
      <div className="vl-file-list">
        {system.productionFiles.map((file) => (
          <code key={file}>{file}</code>
        ))}
      </div>
      <div className="vl-risk">
        <strong>Direct modification risk</strong>
        <span>{system.risks}</span>
      </div>
    </aside>
  );
}

function CandidatePlaceholder({ system }) {
  return (
    <section className={cx('vl-card vl-candidate', `accent-${system.accent}`)}>
      <p className="vl-kicker">Candidate v2 placeholder</p>
      <h3>{system.futureDirection}</h3>
      <div className="vl-candidate-grid">
        {system.candidateNotes.map((note) => (
          <div key={note}>{note}</div>
        ))}
      </div>
      <p className="vl-boundary">Candidate work belongs here until explicitly feature-flagged and approved.</p>
    </section>
  );
}

function BosPreview() {
  return (
    <section className="vl-current-preview">
      <div className="vl-preview-toolbar">
        <span>Read-only current component preview</span>
        <strong>Static sample profile</strong>
      </div>
      <div className="vl-dna-shell">
        <DeterministicVisualDNA profile={MARCUS_VISUAL_DNA_SAMPLE} variant="visual-lab" />
      </div>
    </section>
  );
}

function BusinessRealityMapMock() {
  return (
    <section className="vl-map-mock">
      <div className="vl-map-center">
        <span>Business Reality Map</span>
        <strong>Constraint-led operating view</strong>
        <p>Mock-only candidate slot. No assessment record loaded.</p>
      </div>
      <div className="vl-map-columns">
        {mockBusinessReality.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrajectoryFieldMock() {
  return (
    <section className="vl-trajectory">
      <div className="vl-trajectory-core">
        <span>Current trajectory</span>
        <strong>Current Drift</strong>
        <p>One Move: inspect the relationship engine weekly.</p>
      </div>
      <div className="vl-trajectory-lines" aria-hidden="true">
        {mockFutures.map((future, index) => (
          <i key={future.title} className={`tone-${future.tone} line-${index + 1}`} />
        ))}
      </div>
      <div className="vl-future-list">
        {mockFutures.map((future) => (
          <article key={future.title} className={`tone-${future.tone}`}>
            <span>{future.label}</span>
            <strong>{future.title}</strong>
            <em>{future.likelihood}</em>
          </article>
        ))}
      </div>
    </section>
  );
}

function LabSection({ system, children }) {
  return (
    <section className="vl-section" id={system.id}>
      <div className="vl-section-head">
        <div>
          <p className="vl-kicker">{system.title}</p>
          <h2>{system.futureDirection}</h2>
        </div>
        <span className={`vl-pill accent-${system.accent}`}>Preview only</span>
      </div>
      <div className="vl-section-grid">
        <SystemNotes system={system} />
        <div className="vl-preview-stack">
          {children}
          <CandidatePlaceholder system={system} />
        </div>
      </div>
    </section>
  );
}

export default function VisualLabPage() {
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return window.sessionStorage.getItem('moremindmap_visual_lab_unlocked') === 'true';
    } catch {
      return false;
    }
  });
  const sections = useMemo(() => visualSystems, []);

  function unlock() {
    try {
      window.sessionStorage.setItem('moremindmap_visual_lab_unlocked', 'true');
    } catch {
      // Session storage is only a convenience for this hidden internal route.
    }
    setUnlocked(true);
  }

  if (!unlocked) return <AccessGate onUnlock={unlock} />;

  return (
    <main className="min-h-screen bg-black text-white">
      <style>{styles}</style>
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_16%_8%,rgba(251,146,60,0.14),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(59,130,246,0.14),transparent_32%),radial-gradient(circle_at_54%_92%,rgba(168,85,247,0.12),transparent_34%),linear-gradient(180deg,#030303,#08090d_54%,#000)]" />
      <div className="relative">
        <LabHeader />
        <div className="mx-auto max-w-7xl space-y-7 px-5 py-7">
          <nav className="vl-jumpbar" aria-label="Visual lab sections">
            {sections.map((system) => (
              <a key={system.id} href={`#${system.id}`}>{system.title}</a>
            ))}
          </nav>

          <LabSection system={sections[0]}>
            <BosPreview />
          </LabSection>

          <LabSection system={sections[1]}>
            <BusinessRealityMapMock />
          </LabSection>

          <LabSection system={sections[2]}>
            <TrajectoryFieldMock />
          </LabSection>

          <section className="vl-closeout">
            <p className="vl-kicker">Not changed in this sprint</p>
            <div>
              <span>Production visual replacements</span>
              <span>Stored Visual DNA records</span>
              <span>Profile generation</span>
              <span>Business Assessment generation</span>
              <span>Five Futures logic</span>
              <span>OpenAI model wiring</span>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

const styles = `
.vl-kicker {
  margin: 0;
  color: rgba(254,215,170,0.82);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.vl-jumpbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 1rem;
  background: rgba(255,255,255,0.045);
  padding: 0.85rem;
}

.vl-jumpbar a {
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 999px;
  background: rgba(0,0,0,0.28);
  padding: 0.65rem 0.85rem;
  color: rgba(255,255,255,0.68);
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-decoration: none;
  text-transform: uppercase;
}

.vl-section {
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 1.4rem;
  background: rgba(255,255,255,0.04);
  padding: clamp(1rem, 2vw, 1.35rem);
  box-shadow: 0 24px 80px rgba(0,0,0,0.28);
}

.vl-section-head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.vl-section-head h2 {
  margin: 0.45rem 0 0;
  font-size: clamp(1.45rem, 3vw, 2.25rem);
  letter-spacing: -0.02em;
}

.vl-pill {
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 999px;
  padding: 0.52rem 0.7rem;
  color: rgba(255,255,255,0.76);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.vl-section-grid {
  display: grid;
  grid-template-columns: minmax(260px, 0.35fr) minmax(0, 0.65fr);
  gap: 1rem;
}

.vl-card,
.vl-current-preview,
.vl-map-mock,
.vl-trajectory,
.vl-closeout {
  border: 1px solid rgba(255,255,255,0.11);
  border-radius: 1rem;
  background:
    linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.026)),
    rgba(0,0,0,0.32);
}

.vl-card {
  padding: 1rem;
}

.vl-notes h3,
.vl-candidate h3 {
  margin: 0.5rem 0 0;
  font-size: 1.1rem;
}

.vl-notes p,
.vl-candidate p {
  color: rgba(255,255,255,0.64);
  font-size: 0.88rem;
  line-height: 1.65;
}

.vl-file-list {
  display: grid;
  gap: 0.45rem;
  margin-top: 1rem;
}

.vl-file-list code {
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 0.65rem;
  background: rgba(0,0,0,0.35);
  padding: 0.55rem;
  color: rgba(255,255,255,0.68);
  font-size: 0.72rem;
  white-space: normal;
}

.vl-risk {
  margin-top: 1rem;
  border-top: 1px solid rgba(255,255,255,0.1);
  padding-top: 1rem;
}

.vl-risk strong,
.vl-risk span {
  display: block;
}

.vl-risk strong {
  color: rgba(255,255,255,0.84);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

.vl-risk span {
  margin-top: 0.45rem;
  color: rgba(255,255,255,0.58);
  font-size: 0.82rem;
  line-height: 1.55;
}

.vl-preview-stack {
  display: grid;
  gap: 1rem;
  min-width: 0;
}

.vl-preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  padding: 0.85rem 1rem;
  color: rgba(255,255,255,0.58);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.vl-preview-toolbar strong {
  color: rgba(255,255,255,0.86);
}

.vl-dna-shell {
  overflow: auto;
  padding: 1rem;
}

.vl-dna-shell .dvd-frame {
  min-width: 980px;
}

.vl-candidate-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.7rem;
  margin-top: 1rem;
}

.vl-candidate-grid div {
  min-height: 5.5rem;
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 0.85rem;
  background: rgba(0,0,0,0.24);
  padding: 0.85rem;
  color: rgba(255,255,255,0.7);
  font-size: 0.82rem;
  line-height: 1.5;
}

.vl-boundary {
  margin-bottom: 0;
}

.vl-map-mock {
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  gap: 1rem;
  min-height: 320px;
  padding: 1rem;
  background:
    radial-gradient(circle at 50% 45%, rgba(168,85,247,0.22), transparent 38%),
    radial-gradient(circle at 24% 18%, rgba(251,146,60,0.16), transparent 32%),
    rgba(0,0,0,0.32);
}

.vl-map-center {
  display: flex;
  flex-direction: column;
  justify-content: center;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 1rem;
  padding: 1.2rem;
  background: rgba(0,0,0,0.34);
}

.vl-map-center span,
.vl-trajectory-core span,
.vl-future-list span {
  color: rgba(254,215,170,0.8);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.vl-map-center strong,
.vl-trajectory-core strong {
  margin-top: 0.55rem;
  color: white;
  font-size: clamp(1.6rem, 3vw, 2.25rem);
  line-height: 1;
}

.vl-map-center p,
.vl-trajectory-core p {
  color: rgba(255,255,255,0.58);
  line-height: 1.6;
}

.vl-map-columns {
  display: grid;
  gap: 0.65rem;
}

.vl-map-columns div {
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 0.8rem;
  background: rgba(255,255,255,0.045);
  padding: 0.85rem;
}

.vl-map-columns span {
  display: block;
  color: rgba(255,255,255,0.46);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.vl-map-columns strong {
  display: block;
  margin-top: 0.4rem;
  color: rgba(255,255,255,0.82);
  font-size: 0.96rem;
}

.vl-trajectory {
  position: relative;
  min-height: 390px;
  overflow: hidden;
  padding: 1rem;
  background:
    radial-gradient(circle at 45% 47%, rgba(59,130,246,0.22), transparent 30%),
    radial-gradient(circle at 72% 30%, rgba(34,197,94,0.11), transparent 34%),
    rgba(0,0,0,0.34);
}

.vl-trajectory-core {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 2;
  width: min(320px, 70%);
  transform: translate(-50%, -50%);
  border: 1px solid rgba(255,255,255,0.13);
  border-radius: 1.2rem;
  background: rgba(0,0,0,0.62);
  padding: 1.15rem;
  text-align: center;
}

.vl-trajectory-lines i {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 42%;
  height: 2px;
  transform-origin: 0 50%;
  border-radius: 999px;
  opacity: 0.8;
}

.vl-trajectory-lines .line-1 { transform: rotate(-28deg); }
.vl-trajectory-lines .line-2 { transform: rotate(-8deg); }
.vl-trajectory-lines .line-3 { transform: rotate(16deg); }
.vl-trajectory-lines .line-4 { transform: rotate(39deg); }
.vl-trajectory-lines .line-5 { transform: rotate(63deg); }

.tone-green { --tone: #86efac; }
.tone-blue { --tone: #60a5fa; }
.tone-purple { --tone: #c084fc; }
.tone-orange { --tone: #fb923c; }
.tone-cyan { --tone: #67e8f9; }

.vl-trajectory-lines i,
.vl-future-list article {
  border-color: color-mix(in srgb, var(--tone) 54%, white 0%);
  background: color-mix(in srgb, var(--tone) 16%, transparent);
  box-shadow: 0 0 28px color-mix(in srgb, var(--tone) 26%, transparent);
}

.vl-future-list {
  position: relative;
  z-index: 3;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.65rem;
  margin-top: 1rem;
}

.vl-future-list article {
  min-height: 108px;
  border: 1px solid;
  border-radius: 0.85rem;
  padding: 0.8rem;
}

.vl-future-list strong,
.vl-future-list em {
  display: block;
}

.vl-future-list strong {
  margin-top: 0.45rem;
  color: white;
  font-size: 0.94rem;
}

.vl-future-list em {
  margin-top: 0.5rem;
  color: rgba(255,255,255,0.58);
  font-size: 0.75rem;
  font-style: normal;
  line-height: 1.35;
}

.vl-closeout {
  padding: 1rem;
}

.vl-closeout div {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 0.8rem;
}

.vl-closeout span {
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 999px;
  padding: 0.55rem 0.75rem;
  color: rgba(255,255,255,0.64);
  font-size: 0.76rem;
}

.accent-orange { border-color: rgba(251,146,60,0.34); }
.accent-purple { border-color: rgba(192,132,252,0.34); }
.accent-cyan { border-color: rgba(103,232,249,0.34); }

@media (max-width: 900px) {
  .vl-section-grid,
  .vl-map-mock {
    grid-template-columns: 1fr;
  }

  .vl-candidate-grid,
  .vl-future-list {
    grid-template-columns: 1fr;
  }

  .vl-trajectory {
    min-height: 560px;
  }
}
`;
