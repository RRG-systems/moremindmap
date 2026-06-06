import { Link } from 'react-router-dom';

function formatValue(value) {
  if (value === null || value === undefined || value === '') return 'Not available';
  if (typeof value === 'string') return value.replace(/_/g, ' ');
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (!value.length) return 'None listed';
    return value.map(formatValue).join(', ');
  }
  if (typeof value === 'object') {
    const preferred =
      value.label ||
      value.title ||
      value.signal ||
      value.constraint_key ||
      value.confidence_band ||
      value.confidence ||
      value.summary ||
      value.description ||
      value.value;
    if (preferred) return formatValue(preferred);
    return Object.entries(value)
      .slice(0, 3)
      .map(([key, item]) => `${key.replace(/_/g, ' ')}: ${formatValue(item)}`)
      .join(' · ');
  }
  return String(value);
}

function formatDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function sentenceCase(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeParagraphs(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function MarkdownFallback({ markdown }) {
  const blocks = normalizeParagraphs(markdown);
  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        const clean = block.replace(/^#{1,6}\s*/, '').trim();
        const isHeading = /^#{1,6}\s/.test(block) || /^[A-Z0-9 /+-]{8,}$/.test(clean);
        if (isHeading) {
          return (
            <h3
              key={`${clean}-${index}`}
              className="pt-3 text-xl font-semibold uppercase tracking-[0.12em] text-orange-200"
            >
              {clean}
            </h3>
          );
        }
        return (
          <p key={`${clean.slice(0, 24)}-${index}`} className="text-base leading-8 text-white/76">
            {clean}
          </p>
        );
      })}
    </div>
  );
}

function SnapshotCard({ label, value, accent = 'orange' }) {
  const accentClass =
    accent === 'blue'
      ? 'border-blue-300/25 text-blue-200'
      : accent === 'purple'
        ? 'border-purple-300/25 text-purple-200'
        : accent === 'emerald'
          ? 'border-emerald-300/25 text-emerald-200'
          : 'border-orange-300/25 text-orange-200';

  return (
    <article className={`rounded-2xl border bg-white/[0.035] p-4 ${accentClass}`}>
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em]">{label}</p>
      <p className="mt-3 text-sm leading-6 text-white/78">{formatValue(value)}</p>
    </article>
  );
}

function EvidenceList({ evidence }) {
  const items = Array.isArray(evidence) ? evidence.filter(Boolean) : evidence ? [evidence] : [];
  if (!items.length) return null;

  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-black/35 p-4">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-white/46">
        Evidence
      </p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-white/62">
        {items.map((item, index) => (
          <li key={`${formatValue(item).slice(0, 40)}-${index}`} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-300/80" />
            <span>{formatValue(item)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DiagnosticSection({ section, index }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-black/45 p-5 shadow-[0_0_45px_rgba(0,0,0,0.28)] sm:p-7">
      <div className="mb-4 flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-orange-300/35 bg-orange-400/[0.08] text-sm font-semibold text-orange-200">
            {String(index + 1).padStart(2, '0')}
          </div>
          <div>
            <h3 className="text-xl font-semibold uppercase tracking-[0.08em] text-white">
              {section.title}
            </h3>
            {section.confidence && (
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                Confidence: {formatValue(section.confidence)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {normalizeParagraphs(section.body).map((paragraph, paragraphIndex) => (
          <p
            key={`${section.key || section.title}-${paragraphIndex}`}
            className="text-base leading-8 text-white/76"
          >
            {paragraph}
          </p>
        ))}
      </div>

      <EvidenceList evidence={section.evidence} />
    </article>
  );
}

export default function ExecutiveDiagnosticBriefing({ briefing, assessment }) {
  if (!briefing) return null;

  const sections = Array.isArray(briefing.sections) ? briefing.sections : [];
  const hasSections = sections.length > 0;
  const ownerProfileId = briefing.owner_profile_id || assessment?.owner_profile_id || '';
  const encodedProfileId = encodeURIComponent(ownerProfileId);
  const output = assessment?.output || {};
  const mapReady = Boolean(output.business_intelligence_draft || output.executive_diagnostic_briefing_v1 || briefing);
  const futuresReady = Boolean(output.five_futures_v1 && output.one_move_v1);
  const caveat = Array.isArray(briefing.caveats)
    ? briefing.caveats.join(' ')
    : briefing.caveats || 'This diagnostic is an operating analysis, not legal, tax, or financial advice.';

  return (
    <section className="mt-12 border-t border-white/10 pt-10">
      <div className="rounded-[2rem] border border-orange-300/20 bg-gradient-to-br from-orange-500/[0.1] via-white/[0.035] to-purple-500/[0.08] p-5 shadow-[0_0_80px_rgba(249,115,22,0.13)] sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-orange-300">
              Business Assessment
            </p>
            <h2 className="mt-4 text-3xl font-semibold uppercase tracking-[0.08em] text-white sm:text-5xl">
              Executive Diagnostic Briefing
            </h2>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-white/70">
              Business Reality + Behavioral Reality = Future Business Trajectory
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white/42">
              Briefing Status
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-200">Ready</p>
            <p className="mt-2 text-sm leading-6 text-white/58">
              Generated from saved Business Assessment intake, Behavioral Profile data, and the Real
              Estate Business Model V1.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SnapshotCard label="Assessment ID" value={briefing.assessment_id || assessment?.assessment_id} />
          <SnapshotCard label="Owner Profile ID" value={briefing.owner_profile_id || assessment?.owner_profile_id} />
          <SnapshotCard label="Assessment Type" value={briefing.audience_type || assessment?.assessment_type} />
          <SnapshotCard label="Generated At" value={formatDate(briefing.generated_at)} />
          <SnapshotCard label="Status" value={assessment?.status} accent="emerald" />
          <SnapshotCard label="Confidence" value={briefing.confidence_snapshot} accent="blue" />
          <SnapshotCard label="Trajectory Signal" value={briefing.current_trajectory_signal} accent="purple" />
          <SnapshotCard label="Primary Constraint" value={briefing.primary_constraint_snapshot} />
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-4">
        <SnapshotCard label="Primary Constraint Snapshot" value={briefing.primary_constraint_snapshot} />
        <SnapshotCard label="Current Trajectory Signal" value={briefing.current_trajectory_signal} accent="purple" />
        <SnapshotCard label="Confidence Snapshot" value={briefing.confidence_snapshot} accent="blue" />
        <SnapshotCard label="Missing Data" value={briefing.missing_data} accent="emerald" />
      </div>

      <div className="mt-8 space-y-5">
        {hasSections ? (
          sections.map((section, index) => (
            <DiagnosticSection
              key={section.key || `${section.title}-${index}`}
              section={section}
              index={index}
            />
          ))
        ) : (
          <article className="rounded-3xl border border-white/10 bg-black/45 p-5 sm:p-7">
            <MarkdownFallback markdown={briefing.briefing_markdown} />
          </article>
        )}
      </div>

      {caveat && (
        <p className="mt-7 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-white/54">
          {caveat}
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {mapReady ? (
          <Link
            to={`/business-assessment/visual-map?id=${encodedProfileId}`}
            className="group rounded-3xl border border-orange-300/30 bg-orange-400/[0.08] p-6 text-left transition hover:border-orange-200/70 hover:bg-orange-400/[0.12] hover:shadow-[0_0_42px_rgba(249,115,22,0.16)]"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-200">
              Business Assessment Map
            </span>
            <span className="mt-3 block text-2xl font-semibold uppercase tracking-[0.08em] text-white">
              View Map
            </span>
            <span className="mt-3 block text-sm leading-6 text-white/58">
              Open the Business Operating System Diagnostic artifact.
            </span>
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="rounded-3xl border border-orange-300/18 bg-orange-400/[0.04] p-6 text-left opacity-55"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-200">
              Business Assessment Map
            </span>
            <span className="mt-3 block text-2xl font-semibold uppercase tracking-[0.08em] text-white">
              Not ready yet
            </span>
          </button>
        )}

        {futuresReady ? (
          <Link
            to={`/business-assessment/five-futures?id=${encodedProfileId}`}
            className="group rounded-3xl border border-purple-300/30 bg-purple-400/[0.08] p-6 text-left transition hover:border-purple-200/70 hover:bg-purple-400/[0.12] hover:shadow-[0_0_42px_rgba(168,85,247,0.16)]"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-purple-200">
              Five Futures + One Move
            </span>
            <span className="mt-3 block text-2xl font-semibold uppercase tracking-[0.08em] text-white">
              View Futures
            </span>
            <span className="mt-3 block text-sm leading-6 text-white/58">
              Open the probability-weighted trajectory and intervention artifact.
            </span>
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="rounded-3xl border border-purple-300/18 bg-purple-400/[0.04] p-6 text-left opacity-55"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-purple-200">
              Five Futures + One Move
            </span>
            <span className="mt-3 block text-2xl font-semibold uppercase tracking-[0.08em] text-white">
              Not ready yet
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
