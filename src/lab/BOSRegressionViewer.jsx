import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { bosRegressionDataDarrenMmb9 as data } from './bosRegressionData.darren.mmb9.js';
import {
  CUSTOMER_SECTION_ORDER,
  customerBosSectionsDarrenMmb11,
  formatCustomerBosFullText,
  formatCustomerSectionContent,
} from './customerBosRenderer.js';
import {
  DARREN_OPERATING_SCORES,
  SCORES_REVEAL_META,
  UNAVAILABLE_SCORE_DIMENSIONS,
  UNIVERSAL_TRANSLATOR_LAB_NOTE,
} from './customerBosScoreMeaning.js';
import FinalBOSCustomerExperience from './FinalBOSCustomerExperience.jsx';
import PremiumCustomerBOSShell, { PlainTextBlock as PremiumPlainTextBlock } from './PremiumCustomerBOSShell.jsx';
import {
  LAB_COMPARE_TABS,
  PREMIUM_NAV_TABS,
  PREMIUM_SHELL_META,
} from './premiumCustomerBosData.js';

const NOTES_KEY = 'mmb10_darren_bos_regression_review_notes';

const SECTION_ORDER = ['executiveSummary', 'fiveFutures', 'recommendedNextStep', 'facilitatorNotes'];

const BADGE_STYLES = {
  Improved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  Regressed: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  Watch: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  Neutral: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  'Evidence gap': 'bg-violet-500/20 text-violet-300 border-violet-500/40',
};

const PREMIUM_TABS = PREMIUM_NAV_TABS;
const COMPARE_TABS = LAB_COMPARE_TABS;

const SECTION_TITLES = {
  executiveSummary: 'Executive Summary',
  fiveFutures: 'Five Futures',
  recommendedNextStep: 'Recommended Next Step / One Move',
  facilitatorNotes: 'Facilitator Notes',
};

function Badge({ type, children }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider ${BADGE_STYLES[type] || BADGE_STYLES.Neutral}`}>
      {children ?? type}
    </span>
  );
}

function formatSectionContent(sectionId, payload) {
  if (!payload) return 'No section data available.';

  if (sectionId === 'executiveSummary') {
    return [
      payload.headline ? `**Headline:** ${payload.headline}` : null,
      payload.body ? `\n${payload.body}` : null,
      payload.micro_scenario ? `\n\n**Micro scenario:** ${payload.micro_scenario}` : null,
      payload.key_warning ? `\n\n**Key warning:** ${payload.key_warning}` : null,
      payload.grounding_used ? `\n\n**Grounding:** ${Array.isArray(payload.grounding_used) ? payload.grounding_used.join(', ') : payload.grounding_used}` : null,
    ].filter(Boolean).join('');
  }

  if (sectionId === 'fiveFutures') {
    const futures = (payload.futures || []).map((f, i) => (
      `${i + 1}. **${f.title}** (${f.likelihood})\n${f.trajectory}\n_Org experience:_ ${f.organization_experiences}`
    )).join('\n\n');
    return [
      payload.summary ? `${payload.summary}` : null,
      payload.most_likely ? `\n\n**Most likely:** ${payload.most_likely.title} (${payload.most_likely.likelihood})\n${payload.most_likely.trajectory}` : null,
      futures ? `\n\n**Futures:**\n\n${futures}` : null,
    ].filter(Boolean).join('');
  }

  if (sectionId === 'recommendedNextStep') {
    const days = (payload.first30Days || []).map((d, i) => `${i + 1}. ${d}`).join('\n');
    const evidence = (payload.evidenceUsed || []).map((e) => `- ${e}`).join('\n');
    return [
      payload.headline ? `**Headline:** ${payload.headline}` : null,
      payload.body ? `\n\n${payload.body}` : null,
      payload.futureBottleneck ? `\n\n**Future bottleneck:** ${payload.futureBottleneck}` : null,
      payload.interventionType ? `\n\n**Intervention type:** ${payload.interventionType}` : null,
      payload.intervention ? `\n\n**Intervention:** ${payload.intervention}` : null,
      payload.confidence ? `\n\n**Confidence:** ${payload.confidence}` : null,
      days ? `\n\n**First 30 days:**\n${days}` : null,
      evidence ? `\n\n**Evidence used:**\n${evidence}` : null,
    ].filter(Boolean).join('');
  }

  if (sectionId === 'facilitatorNotes') {
    const notes = (payload.notes || []).map((n) => `**${n.label}:** ${n.guidance}\n_Rationale:_ ${n.rationale}`).join('\n\n');
    return [
      payload.summary ? `${payload.summary}` : null,
      payload.primary_guidance ? `\n\n**Primary guidance:** ${payload.primary_guidance}` : null,
      notes ? `\n\n**Notes:**\n\n${notes}` : null,
      payload.caution ? `\n\n**Caution:** ${payload.caution}` : null,
    ].filter(Boolean).join('');
  }

  return JSON.stringify(payload, null, 2);
}

function PlainTextBlock({ text }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-2 text-sm leading-relaxed text-white/82">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-2" />;
        if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
          return <p key={idx} className="font-semibold text-white">{trimmed.replace(/\*\*/g, '')}</p>;
        }
        if (trimmed.startsWith('**')) {
          const [label, ...rest] = trimmed.replace(/\*\*/g, '').split(':');
          return (
            <p key={idx}>
              <span className="font-semibold text-white">{label}:</span>
              {rest.length ? ` ${rest.join(':')}` : ''}
            </p>
          );
        }
        if (trimmed.startsWith('_') && trimmed.endsWith('_')) {
          return <p key={idx} className="text-xs italic text-white/55">{trimmed.replace(/_/g, '')}</p>;
        }
        if (/^\d+\./.test(trimmed)) {
          return <p key={idx} className="pl-1">{trimmed}</p>;
        }
        if (trimmed.startsWith('- ')) {
          return <p key={idx} className="pl-3 text-white/75">{trimmed}</p>;
        }
        return <p key={idx}>{trimmed}</p>;
      })}
    </div>
  );
}

function DualPanel({ leftLabel, leftClass, rightLabel, rightClass, leftText, rightText, syncScroll }) {
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const syncing = useRef(false);

  const handleScroll = useCallback((source, target) => {
    if (!syncScroll || syncing.current) return;
    syncing.current = true;
    const maxSource = Math.max(source.scrollHeight - source.clientHeight, 1);
    const maxTarget = Math.max(target.scrollHeight - target.clientHeight, 1);
    const ratio = source.scrollTop / maxSource;
    target.scrollTop = ratio * maxTarget;
    requestAnimationFrame(() => { syncing.current = false; });
  }, [syncScroll]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <article
        ref={leftRef}
        onScroll={() => leftRef.current && rightRef.current && handleScroll(leftRef.current, rightRef.current)}
        className={`rounded-xl border border-white/10 bg-white/[0.03] p-4 ${syncScroll ? 'max-h-[55vh] overflow-y-auto' : ''}`}
      >
        <p className={`mb-3 text-[0.65rem] font-bold uppercase tracking-[0.2em] ${leftClass} ${syncScroll ? 'sticky top-0 z-10 bg-[#0a0a0a] pb-2' : ''}`}>{leftLabel}</p>
        <PlainTextBlock text={leftText} />
      </article>
      <article
        ref={rightRef}
        onScroll={() => rightRef.current && leftRef.current && handleScroll(rightRef.current, leftRef.current)}
        className={`rounded-xl border border-white/10 bg-white/[0.03] p-4 ${syncScroll ? 'max-h-[55vh] overflow-y-auto' : ''}`}
      >
        <p className={`mb-3 text-[0.65rem] font-bold uppercase tracking-[0.2em] ${rightClass} ${syncScroll ? 'sticky top-0 z-10 bg-[#0a0a0a] pb-2' : ''}`}>{rightLabel}</p>
        <PlainTextBlock text={rightText} />
      </article>
    </div>
  );
}

function SectionPanel({ sectionMeta, defaultSection, gpt55Section, syncScroll }) {
  const defaultText = formatSectionContent(sectionMeta.id, defaultSection);
  const gpt55Text = formatSectionContent(sectionMeta.id, gpt55Section);

  return (
    <section id={`section-${sectionMeta.id}`} className="scroll-mt-28">
      <div className="sticky top-[7.5rem] z-20 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/90 px-4 py-3 backdrop-blur">
        <div>
          <h3 className="text-base font-bold text-white">{sectionMeta.title}</h3>
          {sectionMeta.sectionNote ? (
            <p className="mt-1 text-xs text-white/50">{sectionMeta.sectionNote}</p>
          ) : null}
        </div>
        {sectionMeta.sectionBadge ? <Badge type={sectionMeta.sectionBadge} /> : null}
      </div>
      <DualPanel
        leftLabel="Default BOS"
        leftClass="text-orange-300/80"
        rightLabel="GPT-5.5 Lab"
        rightClass="text-sky-300/80"
        leftText={defaultText}
        rightText={gpt55Text}
        syncScroll={syncScroll}
      />
    </section>
  );
}

function TechCustomerSectionPanel({ sectionId, syncScroll }) {
  const technicalText = formatSectionContent(sectionId, data.gpt55Sections[sectionId]);
  const customerText = formatCustomerSectionContent(sectionId, customerBosSectionsDarrenMmb11[sectionId]);

  return (
    <section id={`mmb11-section-${sectionId}`} className="scroll-mt-28">
      <div className="sticky top-[7.5rem] z-20 mb-3 rounded-xl border border-white/10 bg-black/90 px-4 py-3 backdrop-blur">
        <h3 className="text-base font-bold text-white">{SECTION_TITLES[sectionId]}</h3>
        <p className="mt-1 text-xs text-white/50">GPT-5.5 technical source preserved · Customer BOS draft derived from same content</p>
      </div>
      <DualPanel
        leftLabel="GPT-5.5 Technical BOS"
        leftClass="text-sky-300/80"
        rightLabel="Customer BOS"
        rightClass="text-emerald-300/80"
        leftText={technicalText}
        rightText={customerText}
        syncScroll={syncScroll}
      />
    </section>
  );
}

function ScorecardSummary() {
  const cs = data.comparisonSummary;
  return (
    <section className="rounded-2xl border border-white/12 bg-white/[0.04] p-5">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-orange-200/80">MMB9 Scorecard Summary</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs uppercase tracking-wider text-white/45">Default quality avg</p>
          <p className="mt-1 text-2xl font-bold text-white">{cs.defaultQualityAverage}</p>
          <p className="text-xs text-white/40">from MMB9 scorecard</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs uppercase tracking-wider text-white/45">GPT-5.5 quality avg</p>
          <p className="mt-1 text-2xl font-bold text-emerald-300">{cs.gpt55QualityAverage}</p>
          <p className="text-xs text-white/40">from MMB9 scorecard</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs uppercase tracking-wider text-white/45">Delta</p>
          <p className="mt-1 text-2xl font-bold text-emerald-300">+{cs.qualityDelta}</p>
          <p className="text-xs text-white/40">excl. latency/cost</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs uppercase tracking-wider text-white/45">Recommendation</p>
          <p className="mt-1 text-sm font-semibold text-white">{cs.recommendation}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-100/85">
          <span className="font-semibold">Latency:</span> Default ~{(cs.defaultLatencyMs / 1000).toFixed(1)}s vs GPT-5.5 ~{(cs.gpt55LatencyMs / 1000).toFixed(1)}s (~4.8× slower)
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-100/85">
          <span className="font-semibold">Cost:</span> Default {cs.defaultTokens.toLocaleString()} tokens vs GPT-5.5 {cs.gpt55Tokens.toLocaleString()} tokens + {cs.gpt55ReasoningTokens} reasoning
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {cs.globalFindings.map((f) => (
          <div key={f.label} className="flex items-center gap-2 rounded-lg border border-white/8 bg-black/25 px-3 py-2 text-xs text-white/70">
            <Badge type={f.badge} />
            <span><strong className="text-white/90">{f.label}:</strong> {f.detail}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function WhatYourScoresReveal() {
  const classificationLabel = (c) => {
    if (c === 'high') return 'high';
    if (c === 'strong') return 'strong';
    if (c === 'low') return 'low';
    if (c === 'very low') return 'very low';
    return c;
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5">
        <h2 className="text-2xl font-bold text-white">{SCORES_REVEAL_META.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/75">{SCORES_REVEAL_META.subtitle}</p>
        <p className="mt-3 text-sm text-white/55">Personalized for {SCORES_REVEAL_META.profileName} · scores from MMB9/MMB10 lab fixture</p>
      </div>

      <div className="space-y-5">
        {DARREN_OPERATING_SCORES.map((score) => (
          <article key={score.dimension} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-wrap items-baseline gap-3">
              <h3 className="text-lg font-bold text-white">{score.dimension}</h3>
              <span className="font-mono text-xl text-emerald-300">{score.score.toFixed(2)}</span>
              <Badge type={score.classification === 'high' || score.classification === 'strong' ? 'Improved' : 'Watch'}>
                {classificationLabel(score.classification)}
              </Badge>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/80">
              You scored {score.score.toFixed(score.dimension === 'Horizon' ? 2 : 2)} in {score.dimension}. That is a {classificationLabel(score.classification)} score. {score.whatItMeans}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-emerald-200/70">How it helps</p>
                <p className="mt-2 text-sm text-white/75">{score.howItHelps}</p>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-amber-200/70">How it can work against you</p>
                <p className="mt-2 text-sm text-white/75">{score.howItWorksAgainst}</p>
              </div>
              <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-sky-200/70">Best use</p>
                <p className="mt-2 text-sm text-white/75">{score.bestUse}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <article className="rounded-2xl border border-white/12 bg-white/[0.04] p-5">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-white/50">Pattern summary</p>
        <h3 className="mt-2 text-lg font-bold text-white">{SCORES_REVEAL_META.patternSummary.headline}</h3>
        <p className="mt-3 text-sm leading-relaxed text-white/80">{SCORES_REVEAL_META.patternSummary.meaning}</p>
      </article>

      <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/55">
        <p className="font-semibold text-white/70">Additional dimensions not in this lab fixture</p>
        <p className="mt-1">
          {UNAVAILABLE_SCORE_DIMENSIONS.join(', ')} — exact values not available in this lab fixture; scores not fabricated.
        </p>
      </div>
    </section>
  );
}

function HumanReviewNotes() {
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(NOTES_KEY);
      if (stored) setNotes(stored);
    } catch {
      // localStorage unavailable
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(NOTES_KEY, notes);
    } catch {
      // localStorage unavailable
    }
  }, [notes]);

  async function copyNotes() {
    try {
      await navigator.clipboard.writeText(notes);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function clearNotes() {
    setNotes('');
    try {
      localStorage.removeItem(NOTES_KEY);
    } catch {
      // localStorage unavailable
    }
  }

  return (
    <section className="rounded-2xl border border-white/12 bg-white/[0.04] p-5">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-orange-200/80">Human Review Notes</p>
      <p className="mt-2 text-xs text-amber-200/70">Notes are stored only in this browser. No API save. No production save.</p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add local review notes for Customer BOS, score meaning, and technical comparison..."
        className="mt-3 min-h-[140px] w-full resize-y rounded-xl border border-white/12 bg-black/50 p-4 text-sm text-white placeholder:text-white/30 focus:border-orange-400/40 focus:outline-none"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyNotes}
          className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/80 hover:bg-white/10"
        >
          {copied ? 'Copied!' : 'Copy notes to clipboard'}
        </button>
        <button
          type="button"
          onClick={clearNotes}
          className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/80 hover:bg-white/10"
        >
          Clear local notes
        </button>
      </div>
    </section>
  );
}

export default function BOSRegressionViewer() {
  const [pageMode, setPageMode] = useState('final-bos-preview');
  const [activeView, setActiveView] = useState('premium-customer');
  const [syncScroll, setSyncScroll] = useState(false);
  const [activeSection, setActiveSection] = useState(SECTION_ORDER[0]);

  const sectionMetaById = useMemo(() => {
    const map = {};
    data.sectionMeta.forEach((s) => { map[s.id] = s; });
    return map;
  }, []);

  const gpt55FullText = useMemo(
    () => SECTION_ORDER.map((id) => formatSectionContent(id, data.gpt55Sections[id])).join('\n\n---\n\n'),
    [],
  );

  const customerFullText = useMemo(() => formatCustomerBosFullText(), []);

  const defaultFullText = useMemo(
    () => SECTION_ORDER.map((id) => formatSectionContent(id, data.defaultSections[id])).join('\n\n---\n\n'),
    [],
  );

  const showSectionNav = ['tech-customer', 'technical-bos', 'customer-bos', 'mmb9-compare'].includes(activeView);
  const sectionNavOrder = activeView === 'mmb9-compare' ? SECTION_ORDER : CUSTOMER_SECTION_ORDER;

  const fiveFuturesText = useMemo(
    () => formatCustomerSectionContent('fiveFutures', customerBosSectionsDarrenMmb11.fiveFutures),
    [],
  );
  const oneMoveText = useMemo(
    () => formatCustomerSectionContent('recommendedNextStep', customerBosSectionsDarrenMmb11.recommendedNextStep),
    [],
  );
  const teamFitText = useMemo(
    () => formatCustomerSectionContent('facilitatorNotes', customerBosSectionsDarrenMmb11.facilitatorNotes),
    [],
  );

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_16%_8%,rgba(251,146,60,0.12),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(59,130,246,0.12),transparent_32%),linear-gradient(180deg,#030303,#08090d_54%,#000)]" />
      <div className="relative mx-auto max-w-7xl px-5 py-7">
        <header className="mb-6 rounded-2xl border border-white/12 bg-white/[0.04] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-orange-200/80">Visual Lab · BOS Regression</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white/90">Darren BOS Lab Viewer</h1>
              <p className="mt-1 text-sm text-white/50">Internal lab route · Profile: {PREMIUM_SHELL_META.profileId}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge type="Watch">LAB ONLY</Badge>
              <Badge type="Regressed">NO PRODUCTION SAVE</Badge>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <Link to="/visual-lab" className="text-orange-300/80 underline-offset-2 hover:underline">← Visual Lab</Link>
            <span className="text-white/35">|</span>
            <span className="text-white/45">MMB13 final customer preview · MMB12 premium shell · MMB9–MMB11 lab layers preserved</span>
          </div>
        </header>

        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Page mode">
          <button
            type="button"
            onClick={() => setPageMode('final-bos-preview')}
            className={`rounded-full border px-5 py-2.5 text-xs font-bold uppercase tracking-wider ${pageMode === 'final-bos-preview' ? 'border-orange-400/60 bg-orange-500/20 text-orange-50 shadow-[0_0_24px_rgba(251,146,60,0.15)]' : 'border-white/12 bg-black/30 text-white/55 hover:text-white/80'}`}
          >
            Final BOS Preview
          </button>
          <button
            type="button"
            onClick={() => setPageMode('lab-review')}
            className={`rounded-full border px-5 py-2.5 text-xs font-bold uppercase tracking-wider ${pageMode === 'lab-review' ? 'border-sky-400/50 bg-sky-500/15 text-sky-100' : 'border-white/12 bg-black/30 text-white/55 hover:text-white/80'}`}
          >
            Lab Review
          </button>
        </nav>

        {pageMode === 'final-bos-preview' ? (
          <>
            <FinalBOSCustomerExperience />
            <div className="mt-8">
              <HumanReviewNotes />
            </div>
          </>
        ) : (
          <>
        <header className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-orange-200/80">{PREMIUM_SHELL_META.brandLine}</p>
              <h2 className="mt-2 text-xl font-bold tracking-tight">{PREMIUM_SHELL_META.labTitle}</h2>
              <p className="mt-1 text-sm text-white/55">Premium customer output shell · GPT-5.5 Technical BOS preserved · Customer BOS draft</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge type="Neutral">Customer BOS Draft</Badge>
              <Badge type="Improved">GPT-5.5 Technical BOS Preserved</Badge>
            </div>
          </div>
          <p className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-sm text-violet-100/85">
            {UNIVERSAL_TRANSLATOR_LAB_NOTE}
          </p>
        </header>

        <ScorecardSummary />

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-sky-200/70">Technical source</p>
            <p className="font-semibold">GPT-5.5 Technical BOS</p>
            <p className="text-xs text-white/55">{data.gpt55Model.model}</p>
            <p className="text-xs text-white/45">Backend intelligence preserved for Business Assessment, Five Futures, One Move, Visual DNA, LDE</p>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-emerald-200/70">Customer layer</p>
            <p className="font-semibold">Customer BOS</p>
            <p className="text-xs text-white/55">Same depth · clearer language · not a summary</p>
            <p className="text-xs text-white/45">Static lab-derived rewrite from GPT-5.5 output</p>
          </div>
        </div>

        <nav className="mt-6 space-y-3" aria-label="Premium navigation">
          <div className="flex flex-wrap gap-2">
            {PREMIUM_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveView(tab.id)}
                className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider ${activeView === tab.id ? (tab.hero ? 'border-orange-400/60 bg-orange-500/20 text-orange-50 shadow-[0_0_24px_rgba(251,146,60,0.15)]' : 'border-orange-400/50 bg-orange-500/15 text-orange-100') : 'border-white/12 bg-black/30 text-white/55 hover:text-white/80'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-white/35">Lab compare</span>
            {COMPARE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveView(tab.id)}
                className={`rounded-full border px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider ${activeView === tab.id ? 'border-sky-400/50 bg-sky-500/15 text-sky-100' : 'border-white/10 bg-black/25 text-white/45 hover:text-white/70'}`}
              >
                {tab.label}
              </button>
            ))}
            {['tech-customer', 'mmb9-compare'].includes(activeView) ? (
              <button
                type="button"
                onClick={() => setSyncScroll((v) => !v)}
                className={`rounded-full border px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider ${syncScroll ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100' : 'border-white/12 bg-black/30 text-white/55'}`}
              >
                Scroll sync: {syncScroll ? 'On' : 'Off'}
              </button>
            ) : null}
          </div>
        </nav>

        {showSectionNav ? (
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Section navigation">
            {sectionNavOrder.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setActiveSection(id);
                  const prefix = activeView === 'mmb9-compare' ? 'section' : 'mmb11-section';
                  document.getElementById(`${prefix}-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={`rounded-full border px-3 py-1.5 text-[0.7rem] font-semibold ${activeSection === id ? 'border-white/25 bg-white/10 text-white' : 'border-white/10 text-white/50 hover:text-white/75'}`}
              >
                {SECTION_TITLES[id] || sectionMetaById[id]?.title || id}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-6 space-y-8">
          {activeView === 'premium-customer' && <PremiumCustomerBOSShell />}

          {activeView === 'five-futures-tab' && (
            <article className="rounded-2xl border border-violet-500/25 bg-white/[0.03] p-5">
              <p className="mb-4 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-violet-300/80">Five Futures — full customer BOS depth</p>
              <PremiumPlainTextBlock text={fiveFuturesText} />
            </article>
          )}

          {activeView === 'one-move-tab' && (
            <article className="rounded-2xl border border-orange-500/25 bg-white/[0.03] p-5">
              <p className="mb-4 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-300/80">One Move — recommended next step</p>
              <PremiumPlainTextBlock text={oneMoveText} />
            </article>
          )}

          {activeView === 'team-fit-tab' && (
            <article className="rounded-2xl border border-emerald-500/25 bg-white/[0.03] p-5">
              <p className="mb-4 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-emerald-300/80">Team / Leadership Fit — facilitator notes</p>
              <PremiumPlainTextBlock text={teamFitText} />
            </article>
          )}

          {activeView === 'technical-source' && (
            <article className="max-h-[75vh] overflow-y-auto rounded-2xl border border-sky-500/25 bg-white/[0.03] p-5">
              <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-sky-300/80">Technical Source — GPT-5.5 Technical BOS</p>
              <p className="mb-4 text-xs text-white/50">Backend intelligence preserved · used by BA, Five Futures, One Move, Visual DNA, LDE · not the primary customer view</p>
              <PlainTextBlock text={gpt55FullText} />
            </article>
          )}

          {activeView === 'notes-tab' && <HumanReviewNotes />}

          {activeView === 'tech-customer' && (
            <>
              {CUSTOMER_SECTION_ORDER.map((id) => (
                <TechCustomerSectionPanel key={id} sectionId={id} syncScroll={syncScroll} />
              ))}
            </>
          )}

          {activeView === 'technical-bos' && (
            <article className="max-h-[75vh] overflow-y-auto rounded-xl border border-sky-500/25 bg-white/[0.03] p-5">
              <p className="mb-4 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-sky-300/80">GPT-5.5 Technical BOS — full output (source of truth)</p>
              <PlainTextBlock text={gpt55FullText} />
            </article>
          )}

          {activeView === 'customer-bos' && (
            <article className="max-h-[75vh] overflow-y-auto rounded-xl border border-emerald-500/25 bg-white/[0.03] p-5">
              <p className="mb-4 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-emerald-300/80">Customer BOS — full output (lab draft)</p>
              <PlainTextBlock text={customerFullText} />
            </article>
          )}

          {activeView === 'scores-reveal' && <WhatYourScoresReveal />}

          {activeView === 'mmb9-compare' && (
            <>
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-orange-200/70">Left / Original</p>
                  <p className="font-semibold">{data.defaultModel.label}</p>
                  <p className="text-xs text-white/55">{data.defaultModel.narrative} / {data.defaultModel.rescoring}</p>
                </div>
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-sky-200/70">Right / GPT-5.5</p>
                  <p className="font-semibold">{data.gpt55Model.label}</p>
                  <p className="text-xs text-white/55">{data.gpt55Model.model}</p>
                </div>
              </div>
              {SECTION_ORDER.map((id) => (
                <SectionPanel
                  key={id}
                  syncScroll={syncScroll}
                  sectionMeta={sectionMetaById[id]}
                  defaultSection={data.defaultSections[id]}
                  gpt55Section={data.gpt55Sections[id]}
                />
              ))}
            </>
          )}

          {activeView === 'scorecard' && (
            <article className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <p className="mb-4 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white/55">Full MMB9 Scorecard (from fixture)</p>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">{data.scorecardMarkdown}</pre>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/45">
                      <th className="py-2 pr-4">Dimension</th>
                      <th className="py-2 pr-4">Arm A</th>
                      <th className="py-2 pr-4">Arm B</th>
                      <th className="py-2">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.comparisonSummary.dimensionScores.map((row) => (
                      <tr key={row.dimension} className="border-b border-white/5">
                        <td className="py-2 pr-4 text-white/80">{row.dimension}</td>
                        <td className="py-2 pr-4">{row.armA}</td>
                        <td className="py-2 pr-4">{row.armB}</td>
                        <td className={`py-2 font-semibold ${row.delta > 0 ? 'text-emerald-300' : row.delta < 0 ? 'text-rose-300' : 'text-white/50'}`}>
                          {row.delta > 0 ? `+${row.delta}` : row.delta}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          )}
        </div>

        {activeView !== 'notes-tab' ? (
          <div className="mt-8">
            <HumanReviewNotes />
          </div>
        ) : null}
          </>
        )}

        <footer className="mt-8 rounded-2xl border border-white/10 bg-black/40 p-5 text-sm text-white/55">
          <p className="font-semibold text-white/75">Safety — lab-only inspection</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>LAB ONLY — no production deploy</li>
            <li>NO PRODUCTION SAVE — notes stored in localStorage only</li>
            <li>CUSTOMER BOS DRAFT — static lab-derived rendering layer</li>
            <li>TECHNICAL BOS PRESERVED — GPT-5.5 output unchanged as backend source</li>
            <li>No profile overwrite · No Redis writes · No canonical mutation</li>
            <li>Universal Translator not removed — see header note</li>
            <li>No save-to-production, promote, approve, deploy, or publish action exists on this page</li>
          </ul>
        </footer>
      </div>
    </main>
  );
}