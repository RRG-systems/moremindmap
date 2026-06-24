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

const DISCLAIMER = 'This diagnostic is an operating analysis, not legal, tax, or financial advice.';

const EVIDENCE_LABELS = {
  'assessment_answers.q1': 'Q1: Lead and opportunity reality',
  'assessment_answers.q2': 'Q2: Growth goals and long-range business aim',
  'assessment_answers.q3': 'Q3: Database size and relationship count',
  'assessment_answers.q4': 'Q4: Same-day business generation behavior',
  'assessment_answers.q5': 'Q5: CRM, database, and follow-up system',
  'assessment_answers.q6': 'Q6: Lead generation willingness and resistance',
  'assessment_answers.q7': 'Q7: Accountability answer',
  'assessment_answers.q8': 'Q8: Business systems answer',
  'assessment_answers.q9': 'Q9: Financial and production numbers',
  'assessment_answers.q10': 'Q10: Stated growth limiter',
  'assessment_answers.q11': 'Q11: Team / role information',
  'assessment_answers.q12': 'Q12: Tripled-goal stress test',
  'relationship_reality.evidence.q3': 'Q3: Database size and relationship count',
  'relationship_reality.evidence.q5': 'Q5: CRM, database, and follow-up system',
  'lead_generation_reality.evidence.q4': 'Q4: Same-day business generation behavior',
  'lead_conversion_reality.evidence.q5': 'Q5: CRM, database, and follow-up system',
  'financial_reality.evidence.q9': 'Q9: Financial and production numbers',
  'constraint_analysis.primary_constraint': 'Business Intelligence Draft: primary constraint',
  'constraint_analysis.primary_constraint.evidence': 'Business Intelligence Draft: primary constraint evidence',
  'constraint_analysis.ranked_constraints': 'Business Intelligence Draft: ranked constraint analysis',
  'current_stage.stage': 'Business Intelligence Draft: current business stage',
  'current_stage.description': 'Business Intelligence Draft: current stage description',
  'growth_ambition.signal': 'Business Intelligence Draft: growth ambition signal',
  'current_production_reality.financial_detail_score': 'Business Intelligence Draft: financial detail score',
  'current_trajectory_signal.signal': 'Business Intelligence Draft: current trajectory signal',
  'current_trajectory_signal.source_constraint': 'Business Intelligence Draft: source constraint',
  'confidence_engine.known': 'Confidence Engine: known evidence',
  'confidence_engine.observed': 'Confidence Engine: observed evidence',
  'confidence_engine.missing': 'Confidence Engine: missing data',
  'behavioral_reality.profile_type': 'Behavioral Profile: profile type',
  'behavioral_reality.ranked_dimensions': 'Behavioral Profile: ranked dimensions',
  'behavioral_reality.pressure_mechanics': 'Behavioral Profile: pressure mechanics',
  'behavior_business_fusion.fusion_summary': 'Behavior + Business Fusion: diagnostic summary',
  'relationship_reality.database_size_mentions': 'Q3: database and relationship count signals',
  'relationship_reality.true_relationship_count_mentioned': 'Q3: true relationship count signal',
  'relationship_reality.lake_health': 'Real Estate Business Model V1: relationship lake health',
  'lead_generation_reality.believes_enough_leads': 'Q1: stated lead sufficiency',
  'lead_generation_reality.lead_shortage_signal': 'Business Intelligence Draft: lead shortage signal',
  'lead_conversion_reality.follow_up_system_strength': 'Business Intelligence Draft: follow-up system strength',
  'lead_conversion_reality.conversion_discipline': 'Business Intelligence Draft: conversion discipline',
  'systems_reality.database_system.score': 'Real Estate Business Model V1: database system maturity',
  'systems_reality.listing_system.score': 'Real Estate Business Model V1: listing system maturity',
  'systems_reality.transaction_system.score': 'Real Estate Business Model V1: transaction system maturity',
  'systems_reality.overall_maturity_score': 'Real Estate Business Model V1: systems maturity score',
  'accountability_reality.maturity_label': 'Real Estate Business Model V1: accountability maturity',
  'accountability_reality.accountability_source': 'Q7: accountability answer',
  'accountability_reality.evidence.no_accountability_signal': 'Q7: weak or absent accountability signal',
  'financial_reality.extracted_numbers': 'Q9: extracted financial numbers',
  'financial_reality.fields_detected.average_sales_price': 'Q9: average sales price signal',
  'financial_reality.missing_financial_data': 'Q9: missing financial detail',
  'team_reality.roles_mentioned': 'Q11: team role evidence',
  'team_reality.solo_or_team': 'Q11: solo/team status',
  'team_reality.leadership_or_leverage_clues': 'Q8/Q12: leverage and bandwidth clues',
  'contradiction_analysis.contradictions': 'Business Intelligence Draft: contradictions and blind spots',
  'contradiction_analysis.count': 'Business Intelligence Draft: contradiction count',
  'business_intelligence_draft.contradictions_blind_spots': 'Business Intelligence Draft: blind spot analysis',
  primary_constraint: 'Business Intelligence Draft: primary constraint',
  'constraint_analysis.primary_constraint.likely_one_move_categories': 'Business Intelligence Draft: likely intervention categories',
  evidence_count: 'Evidence depth signal'
};

function displayEvidenceLabel(item) {
  const raw = formatValue(item).trim();
  if (!raw) return '';

  const normalized = raw
    .replace(/\s+/g, ' ')
    .replace(/^business intelligence draft\./i, 'business_intelligence_draft.')
    .replace(/^business_intelligence_draft\./i, '')
    .replace(/\s*\.\s*/g, '.')
    .replace(/\s+/g, '_')
    .toLowerCase();

  const direct =
    EVIDENCE_LABELS[raw] ||
    EVIDENCE_LABELS[normalized] ||
    EVIDENCE_LABELS[normalized.replace(/^business_intelligence_draft\./, '')];
  if (direct) return direct;

  const qMatch = normalized.match(/(?:assessment_answers|evidence)\.(q\d{1,2})\b/);
  if (qMatch) {
    return EVIDENCE_LABELS[`assessment_answers.${qMatch[1]}`] || `Assessment answer ${qMatch[1].toUpperCase()}`;
  }

  if (/real[_\s-]?estate[_\s-]?business[_\s-]?model|lake|database|relationship/.test(normalized)) {
    return `Real Estate Business Model V1: ${sentenceCase(raw.split('.').pop())}`;
  }

  if (/behavior|profile|ranked[_\s-]?dimensions|command|tempo/.test(normalized)) {
    return `Behavioral Profile: ${sentenceCase(raw.split('.').pop())}`;
  }

  if (/constraint|trajectory|confidence|financial|systems|accountability|lead[_\s-]?generation|conversion|team/.test(normalized)) {
    return `Business Intelligence Draft: ${sentenceCase(raw.split('.').pop())}`;
  }

  return raw.includes('.') || raw.includes('_') ? sentenceCase(raw.split('.').pop()) : raw;
}

function cleanCaveat(value) {
  const body = Array.isArray(value) ? value.join(' ') : String(value || '');
  if (!body.trim()) return DISCLAIMER;
  if (/include exactly once|at the bottom/i.test(body) && /operating analysis/i.test(body)) {
    return DISCLAIMER;
  }
  return body
    .replace(/Include exactly once at the bottom:\s*/gi, '')
    .replace(/^["“]|["”]$/g, '')
    .trim();
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
  const items = (Array.isArray(evidence) ? evidence.filter(Boolean) : evidence ? [evidence] : [])
    .map(displayEvidenceLabel)
    .filter(Boolean);
  if (!items.length) return null;

  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-black/35 p-4">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-white/46">
        Evidence
      </p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-white/62">
        {items.map((item, index) => (
          <li key={`${item.slice(0, 40)}-${index}`} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-300/80" />
            <span>{item}</span>
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
  const returnTo = ownerProfileId
    ? `/business-assessment?id=${encodedProfileId}#business-assessment-results`
    : '/business-assessment#business-assessment-results';
  const encodedReturnTo = encodeURIComponent(returnTo);
  const output = assessment?.output || {};
  const mapReady = Boolean(output.business_intelligence_draft || output.executive_diagnostic_briefing_v1 || briefing);
  const futuresReady = Boolean(output.five_futures_v1 && output.one_move_v1);
  const caveat = cleanCaveat(briefing.caveats);

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
            to={`/business-assessment/visual-map?id=${encodedProfileId}&returnTo=${encodedReturnTo}`}
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
            to={`/business-assessment/five-futures?id=${encodedProfileId}&returnTo=${encodedReturnTo}`}
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
