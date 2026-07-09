/**
 * District Director Role Fit Dashboard renderer.
 * Premium dark / neon SaaS layout — V1B score stack (growth-weighted + evidence).
 */

const ACCENT_STYLES = {
  blue: {
    border: 'border-sky-400/30',
    bg: 'bg-sky-500/10',
    text: 'text-sky-100',
    bar: 'from-sky-400 to-cyan-300',
    glow: 'shadow-[0_0_40px_rgba(56,189,248,0.12)]',
  },
  green: {
    border: 'border-emerald-400/30',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-100',
    bar: 'from-emerald-400 to-lime-300',
    glow: 'shadow-[0_0_40px_rgba(52,211,153,0.12)]',
  },
  purple: {
    border: 'border-violet-400/30',
    bg: 'bg-violet-500/10',
    text: 'text-violet-100',
    bar: 'from-violet-400 to-fuchsia-300',
    glow: 'shadow-[0_0_40px_rgba(167,139,250,0.12)]',
  },
  orange: {
    border: 'border-orange-400/30',
    bg: 'bg-orange-500/10',
    text: 'text-orange-100',
    bar: 'from-orange-400 to-amber-300',
    glow: 'shadow-[0_0_40px_rgba(251,146,60,0.12)]',
  },
  cyan: {
    border: 'border-cyan-400/30',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-100',
    bar: 'from-cyan-400 to-sky-300',
    glow: 'shadow-[0_0_40px_rgba(34,211,238,0.12)]',
  },
  emerald: {
    border: 'border-emerald-400/30',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-100',
    bar: 'from-teal-400 to-emerald-300',
    glow: 'shadow-[0_0_40px_rgba(45,212,191,0.12)]',
  },
  violet: {
    border: 'border-fuchsia-400/30',
    bg: 'bg-fuchsia-500/10',
    text: 'text-fuchsia-100',
    bar: 'from-fuchsia-400 to-violet-300',
    glow: 'shadow-[0_0_40px_rgba(232,121,249,0.12)]',
  },
};

function accentFor(key) {
  return ACCENT_STYLES[key] || ACCENT_STYLES.blue;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPercent(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return `${Math.round(Number(value))}%`;
}

function verdictTone(verdictId) {
  switch (verdictId) {
    case 'elite_ready_now':
      return 'border-cyan-300/40 bg-cyan-400/15 text-cyan-50';
    case 'strong_fit':
      return 'border-emerald-400/35 bg-emerald-500/12 text-emerald-100';
    case 'viable_fit':
    case 'conditional_fit':
      return 'border-sky-400/35 bg-sky-500/12 text-sky-100';
    case 'moderate_developmental':
    case 'developmental_fit':
      return 'border-amber-400/35 bg-amber-500/12 text-amber-100';
    case 'high_risk_poor':
    case 'risk_fit':
      return 'border-rose-400/35 bg-rose-500/12 text-rose-100';
    default:
      return 'border-white/15 bg-white/5 text-white/70';
  }
}

function riskTone(level) {
  const n = String(level || '').toLowerCase();
  if (n === 'high') return 'border-rose-400/30 bg-rose-500/10 text-rose-100';
  if (n === 'elevated' || n === 'structured') return 'border-orange-400/30 bg-orange-500/10 text-orange-100';
  if (n === 'moderate' || n === 'manageable') return 'border-amber-400/30 bg-amber-500/10 text-amber-100';
  return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100';
}

function evidenceImpactTone(classification) {
  switch (String(classification || '').toLowerCase()) {
    case 'positive':
      return 'border-emerald-400/35 bg-emerald-500/12 text-emerald-100';
    case 'negative':
      return 'border-rose-400/35 bg-rose-500/12 text-rose-100';
    case 'mixed':
      return 'border-amber-400/35 bg-amber-500/12 text-amber-100';
    default:
      return 'border-white/15 bg-white/5 text-white/65';
  }
}

function evidenceImpactLabel(classification) {
  switch (String(classification || '').toLowerCase()) {
    case 'positive':
      return 'Positive';
    case 'negative':
      return 'Negative';
    case 'mixed':
      return 'Mixed';
    case 'neutral':
      return 'Neutral';
    default:
      return 'Neutral';
  }
}

export default function RoleFitDashboard({ model }) {
  if (!model?.ok) {
    return (
      <div className="rounded-3xl border border-red-400/25 bg-red-500/10 p-6 text-red-100">
        {model?.error || 'Unable to build role fit dashboard.'}
      </div>
    );
  }

  const {
    profile,
    analysis_context: ctx,
    overall,
    score_stack: scoreStack,
    dimensions,
    best_use: bestUse,
    risk,
    one_move: oneMove,
    technical_source: tech,
    confidence,
    performance_evidence: evidence,
    board_safe_disclaimer: disclaimer,
    evidence_intelligence: evidenceIntelligence,
  } = model;

  return (
    <div className="space-y-6">
      {/* Top row: Profile + Analysis context + Overall headline */}
      <div className="grid gap-5 xl:grid-cols-3">
        <ProfileOverviewCard profile={profile} />
        <AnalysisContextCard
          ctx={ctx}
          evidence={evidence}
          analyzedAt={model.analyzed_at || profile?.date_analyzed}
          evidenceIntelligence={evidenceIntelligence}
        />
        <OverallFitCard overall={overall} />
      </div>

      {/* Score stack — compact secondary metrics */}
      <ScoreStackSection scoreStack={scoreStack} risk={risk} />

      {/* Dimension cards */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <div className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-white/40">
              Role Fit Dimensions
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white md:text-2xl">
              Growth-weighted DD demand levers
            </h2>
          </div>
          <p className="hidden max-w-md text-right text-xs leading-5 text-white/40 md:block">
            Recruiting / growth is the primary economic lever — not the only job. Risks stay visible.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {(dimensions || []).map((dim) => (
            <DimensionCard key={dim.id} dim={dim} />
          ))}
        </div>
      </section>

      {/* Best use / Risk / One move */}
      <div className="grid gap-5 xl:grid-cols-3">
        <InsightCard
          eyebrow="Best Use"
          title="Best Use of This Person in the DD Role"
          accent="green"
        >
          <ul className="space-y-2.5">
            {(bestUse?.bullets || []).map((line) => (
              <li key={line} className="flex gap-2 text-sm leading-6 text-white/72">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300/80" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          {bestUse?.market_team_context && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-xs leading-5 text-white/55">
              <span className="font-semibold text-white/75">Best-fit context: </span>
              {bestUse.market_team_context}
            </div>
          )}
        </InsightCard>

        <InsightCard
          eyebrow="Risk Pattern"
          title="Risk / Wrong-Seat Pattern"
          accent="orange"
        >
          <div className="mb-3 flex flex-wrap gap-2">
            <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${riskTone(risk?.risk_level)}`}>
              Risk: {risk?.risk_level || '—'}
            </div>
            {risk?.compliance_operations?.level && (
              <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${riskTone(risk.compliance_operations.level)}`}>
                Compliance/Ops: {risk.compliance_operations.level}
              </div>
            )}
            {risk?.support_required?.level && (
              <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${riskTone(risk.support_required.level)}`}>
                Support: {risk.support_required.level}
              </div>
            )}
          </div>
          <ul className="space-y-2.5">
            {(risk?.bullets || []).map((line) => (
              <li key={line} className="flex gap-2 text-sm leading-6 text-white/72">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-300/80" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          {(risk?.support_required?.detail || risk?.support_environment_required) && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-xs leading-5 text-white/55">
              <span className="font-semibold text-white/75">Support required: </span>
              {risk?.support_required?.detail || risk.support_environment_required}
            </div>
          )}
        </InsightCard>

        <InsightCard
          eyebrow="One Move"
          title="One Move to Improve DD Effectiveness"
          accent="purple"
        >
          <p className="text-base font-medium leading-7 text-white/90">
            {oneMove?.move}
          </p>
          <div className="mt-5 rounded-2xl border border-violet-300/20 bg-violet-500/10 px-4 py-3">
            <div className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-violet-100/70">
              Why it matters
            </div>
            <p className="mt-2 text-sm leading-6 text-white/70">{oneMove?.why_it_matters}</p>
          </div>
          <div className="mt-4 inline-flex rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-xs text-white/60">
            Impact: <span className="ml-1 font-semibold text-white/85">{oneMove?.impact_level || '—'}</span>
          </div>
        </InsightCard>
      </div>

      {/* Technical source + Confidence */}
      <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md">
          <div className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-white/40">
            Technical Source / Evidence
          </div>
          <h3 className="mt-2 text-lg font-semibold text-white">Analysis provenance</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {Object.values(tech || {}).map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                  {item.label}
                </div>
                <p className="mt-2 text-sm leading-6 text-white/68">{item.detail}</p>
              </div>
            ))}
          </div>
          {disclaimer && (
            <p className="mt-5 rounded-2xl border border-white/8 bg-black/25 px-4 py-3 text-xs leading-5 text-white/45">
              {disclaimer}
            </p>
          )}
        </section>

        <ConfidenceCard confidence={confidence} />
      </div>
    </div>
  );
}

function ScoreStackSection({ scoreStack, risk }) {
  if (!scoreStack) return null;

  const rows = [
    {
      key: 'behavioral',
      label: 'Behavioral Role Fit',
      value: formatPercent(scoreStack.behavioral?.score_percent),
      badge: scoreStack.behavioral?.verdict_label,
      badgeId: scoreStack.behavioral?.verdict_id,
      hint: 'BOS-only baseline',
    },
    {
      key: 'evidence',
      label: 'Evidence-Adjusted Fit',
      value: formatPercent(scoreStack.evidence_adjusted?.score_percent),
      badge: scoreStack.evidence_adjusted?.verdict_label,
      badgeId: scoreStack.evidence_adjusted?.verdict_id,
      hint: scoreStack.evidence_adjusted?.note || 'Includes optional evidence',
    },
    {
      key: 'growth',
      label: 'Growth / Recruiting Fit',
      value: formatPercent(scoreStack.growth?.score_percent),
      badge: scoreStack.growth?.fit_category || null,
      badgeId:
        scoreStack.growth?.fit_category_id === 'elite'
          ? 'elite_ready_now'
          : scoreStack.growth?.fit_category_id === 'strong'
            ? 'strong_fit'
            : null,
      hint: scoreStack.growth?.evidence_boost_applied
        ? 'Evidence-elevated'
        : scoreStack.growth?.evidence_penalty_applied
          ? 'Evidence-reduced'
          : 'Primary economic lever',
    },
    {
      key: 'compliance',
      label: 'Compliance / Ops Risk',
      value: scoreStack.compliance_operations_risk?.level || risk?.compliance_operations?.level || '—',
      badge: null,
      badgeId: null,
      hint: 'Visible risk — does not alone crush overall',
      tone: riskTone(
        scoreStack.compliance_operations_risk?.level || risk?.compliance_operations?.level,
      ),
    },
    {
      key: 'support',
      label: 'Support Required',
      value: scoreStack.support_required?.level || risk?.support_required?.level || '—',
      badge: null,
      badgeId: null,
      hint: 'Coaching / structure environment',
      tone: riskTone(scoreStack.support_required?.level || risk?.support_required?.level),
    },
  ];

  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md md:p-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-white/40">
            Score Stack
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-white">
            Behavioral · Evidence · Growth · Risk
          </h2>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {rows.map((row) => (
          <div
            key={row.key}
            className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4"
          >
            <div className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-white/40">
              {row.label}
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums text-white">{row.value}</div>
            {row.badge && (
              <div
                className={`mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] ${verdictTone(row.badgeId)}`}
              >
                {row.badge}
              </div>
            )}
            {row.tone && !row.badge && (
              <div className={`mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] ${row.tone}`}>
                {row.value}
              </div>
            )}
            <p className="mt-2 text-[0.7rem] leading-4 text-white/40">{row.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProfileOverviewCard({ profile }) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-md">
      <div className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-white/40">
        Profile Overview
      </div>
      <div className="mt-5 flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10 text-lg font-semibold text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.15)]">
          {profile?.avatar_placeholder || 'MM'}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-xl font-semibold tracking-tight text-white">
            {profile?.name || 'Name unavailable'}
          </h3>
          <p className="mt-1 font-mono text-xs text-white/45">{profile?.profile_id || '—'}</p>
        </div>
      </div>
      <dl className="mt-6 grid gap-3 text-sm">
        <MetaRow label="Market Center / Company" value={profile?.market_center || profile?.company || 'Unavailable'} />
        <MetaRow label="Current role" value={profile?.current_role || 'Unavailable'} />
        <MetaRow label="Date analyzed" value={formatDate(profile?.date_analyzed)} />
        <MetaRow label="Status" value={profile?.active_status || 'active'} />
      </dl>
    </section>
  );
}

function interpretationSourceTone(source) {
  switch (String(source || '').toLowerCase()) {
    case 'gpt':
      return 'border-cyan-300/35 bg-cyan-400/12 text-cyan-50';
    case 'deterministic_fallback':
      return 'border-amber-300/35 bg-amber-400/12 text-amber-50';
    default:
      return 'border-white/12 bg-white/5 text-white/55';
  }
}

function AnalysisContextCard({ ctx, evidence, analyzedAt, evidenceIntelligence }) {
  const classification = evidence?.classification || ctx?.performance_evidence_classification || null;
  const impactLabel = evidence?.impact_label || evidenceImpactLabel(classification);
  const affected = Array.isArray(evidence?.affected_dimensions) ? evidence.affected_dimensions : [];
  const plainSummary =
    evidence?.plain_english_summary ||
    evidence?.evidence_impact_summary ||
    ctx?.performance_evidence_impact ||
    evidence?.summary ||
    ctx?.performance_evidence_summary ||
    'No external performance evidence entered.';
  const hasEvidence = Boolean(evidence?.entered || ctx?.performance_evidence_entered);
  const interpretationSource =
    evidence?.interpretation_source ||
    evidenceIntelligence?.interpreter ||
    (hasEvidence ? 'deterministic_fallback' : 'none');
  const interpretationLabel =
    evidence?.interpretation_label ||
    (interpretationSource === 'gpt'
      ? 'GPT-5.5'
      : interpretationSource === 'deterministic_fallback'
        ? 'Deterministic fallback'
        : 'None');
  const appliedAt = evidence?.applied_at || analyzedAt;
  const fallbackUsed = Boolean(
    evidence?.fallback_used || evidenceIntelligence?.fallback_used,
  );
  const fallbackMessage =
    evidence?.fallback_message ||
    evidenceIntelligence?.fallback_message ||
    (fallbackUsed
      ? 'GPT-5.5 evidence interpretation unavailable. Deterministic fallback applied.'
      : null);

  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md">
      <div className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-white/40">
        Analysis Context
      </div>
      <h3 className="mt-3 text-xl font-semibold tracking-tight text-white">Fathom DD lens</h3>
      <dl className="mt-5 space-y-3 text-sm">
        <MetaRow label="Role Model" value={ctx?.role_model || '—'} />
        <MetaRow label="Source Document" value={ctx?.source_document || '—'} />
        <MetaRow label="Analysis Engine" value={ctx?.analysis_engine || '—'} />
        <MetaRow label="Market Size" value={ctx?.market_size || 'Optional — not provided'} />
        <MetaRow label="Current Agents" value={ctx?.current_agents || 'Optional — not provided'} />
        <MetaRow label="Growth Target" value={ctx?.growth_target || '4%+ monthly'} />
      </dl>

      {/* Evidence Impact — interpreter source, classification, dimensions, plain English */}
      <div
        className="mt-5 rounded-2xl border border-white/10 bg-black/30 px-3.5 py-3"
        data-testid="role-fit-evidence-impact"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-white/40">
            Evidence Impact
          </span>
          {hasEvidence ? (
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] ${evidenceImpactTone(classification)}`}
            >
              {impactLabel}
            </span>
          ) : (
            <span className="inline-flex rounded-full border border-white/12 bg-white/5 px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-white/45">
              None
            </span>
          )}
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] ${interpretationSourceTone(interpretationSource)}`}
            data-testid="role-fit-evidence-interpretation-source"
          >
            {interpretationLabel}
          </span>
        </div>

        <dl className="mt-3 space-y-1.5 text-[0.7rem]">
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            <dt className="text-white/40">Evidence Interpretation</dt>
            <dd className="text-white/75">{interpretationLabel}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            <dt className="text-white/40">Classification</dt>
            <dd className="capitalize text-white/75">
              {hasEvidence ? classification || 'neutral' : '—'}
            </dd>
          </div>
        </dl>

        {hasEvidence && affected.length > 0 && (
          <div className="mt-2.5">
            <div className="text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-white/35">
              Affected Dimensions
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {affected.map((dim) => (
                <span
                  key={dim}
                  className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[0.58rem] font-medium tracking-wide text-white/55"
                >
                  {dim}
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="mt-2.5 text-[0.72rem] leading-5 text-white/58">{plainSummary}</p>

        {fallbackUsed && fallbackMessage && (
          <div className="mt-2 rounded-xl border border-amber-300/20 bg-amber-400/10 px-2.5 py-1.5 text-[0.65rem] leading-4 text-amber-50/90">
            {fallbackMessage}
          </div>
        )}

        {appliedAt && (
          <p className="mt-1.5 text-[0.65rem] leading-4 text-white/35">
            {hasEvidence ? 'Evidence applied' : 'Baseline scored'} · {formatDate(appliedAt)}
          </p>
        )}
      </div>
    </section>
  );
}

function OverallFitCard({ overall }) {
  const percent = overall?.score_percent;
  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-white/12 bg-gradient-to-br from-indigo-500/15 via-black/40 to-cyan-500/10 p-6 shadow-[0_0_60px_rgba(99,102,241,0.12)] backdrop-blur-md">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-white/40">
        Overall DD Role Fit
      </div>
      <div className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-cyan-200/55">
        Growth-weighted · business-lever estimate
      </div>
      <div className="mt-4 flex items-end gap-3">
        <div className="text-6xl font-semibold tracking-tight text-white md:text-7xl">
          {formatPercent(percent)}
        </div>
      </div>
      <div className={`mt-4 inline-flex rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${verdictTone(overall?.verdict_id)}`}>
        {overall?.verdict_label || '—'}
      </div>
      <p className="mt-5 text-sm leading-7 text-white/68">{overall?.summary}</p>
      {overall?.weighting_note && (
        <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-3.5 py-3 text-[0.7rem] leading-5 text-amber-50/85">
          {overall.weighting_note}
        </div>
      )}
    </section>
  );
}

function DimensionCard({ dim }) {
  const accent = accentFor(dim.accent);
  const pct = typeof dim.score_percent === 'number' ? Math.max(0, Math.min(100, dim.score_percent)) : 0;
  return (
    <article
      className={`rounded-[1.5rem] border ${accent.border} ${accent.bg} ${accent.glow} p-5 backdrop-blur-md`}
      title={dim.role_demand}
    >
      <div className="flex items-start justify-between gap-3">
        <h4 className={`text-sm font-semibold leading-5 ${accent.text}`}>{dim.label}</h4>
        <div className="text-2xl font-semibold tabular-nums text-white">
          {formatPercent(dim.score_percent)}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-white/12 bg-black/25 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/65">
          {dim.fit_category || '—'}
        </div>
        {dim.evidence_boost_applied && (
          <div className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-cyan-100">
            Evidence boost
          </div>
        )}
        {dim.evidence_penalty_applied && (
          <div className="inline-flex rounded-full border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-rose-100">
            Evidence penalty
          </div>
        )}
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/40">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${accent.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-3 text-xs leading-5 text-white/55">{dim.note}</p>
      <div className="mt-3 text-[0.6rem] uppercase tracking-[0.16em] text-white/30">
        Weight: {dim.weight_label || '—'}
      </div>
    </article>
  );
}

function InsightCard({ eyebrow, title, accent, children }) {
  const a = accentFor(accent);
  return (
    <section className={`rounded-[1.75rem] border ${a.border} bg-white/[0.035] p-6 backdrop-blur-md`}>
      <div className={`text-[0.65rem] font-semibold uppercase tracking-[0.28em] ${a.text} opacity-80`}>
        {eyebrow}
      </div>
      <h3 className="mt-2 text-lg font-semibold leading-snug tracking-tight text-white">
        {title}
      </h3>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ConfidenceCard({ confidence }) {
  const percent = typeof confidence?.percent === 'number' ? confidence.percent : 0;
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, percent)) / 100) * c;

  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6 backdrop-blur-md">
      <div className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-white/40">
        Analysis Confidence
      </div>
      <div className="mt-6 flex flex-col items-center">
        <div className="relative h-36 w-36">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="8"
            />
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="url(#confidenceGrad)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={offset}
            />
            <defs>
              <linearGradient id="confidenceGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-semibold text-white">{formatPercent(percent)}</div>
            <div className="text-[0.65rem] uppercase tracking-[0.18em] text-white/45">
              {confidence?.label || '—'}
            </div>
          </div>
        </div>
        <p className="mt-5 text-center text-xs leading-5 text-white/50">
          {confidence?.note}
        </p>
      </div>
    </section>
  );
}

function MetaRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-2 last:border-0">
      <dt className="shrink-0 text-white/40">{label}</dt>
      <dd className="max-w-[62%] text-right text-white/78">{value}</dd>
    </div>
  );
}
