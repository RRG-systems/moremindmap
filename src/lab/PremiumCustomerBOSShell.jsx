import { useState } from 'react';
import {
  DARREN_OPERATING_SCORES,
  SCORES_REVEAL_META,
  UNAVAILABLE_SCORE_DIMENSIONS,
} from './customerBosScoreMeaning.js';
import {
  PREMIUM_EXPANDABLE_SECTIONS,
  START_HERE_COPY,
} from './premiumCustomerBosData.js';

const BADGE_STYLES = {
  'Core Insight': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  Watch: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  Action: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  Future: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  Evidence: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
};

function SectionBadge({ type }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider ${BADGE_STYLES[type] || BADGE_STYLES.Evidence}`}>
      {type}
    </span>
  );
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

function ScoresRevealContent() {
  const classificationLabel = (c) => c;

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-white/75">{SCORES_REVEAL_META.subtitle}</p>
      <p className="text-xs text-white/50">Personalized for {SCORES_REVEAL_META.profileName} · scores from MMB9/MMB10 lab fixture</p>

      {DARREN_OPERATING_SCORES.map((score) => (
        <article key={score.dimension} className="rounded-xl border border-white/8 bg-black/25 p-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <h4 className="text-base font-bold text-white">{score.dimension}</h4>
            <span className="font-mono text-lg text-emerald-300">{score.score.toFixed(2)}</span>
            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider text-white/70">
              {classificationLabel(score.classification)}
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-white/80">
            You scored {score.score.toFixed(2)} in {score.dimension}. That is a {classificationLabel(score.classification)} score. {score.whatItMeans}
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="text-[0.62rem] font-bold uppercase tracking-wider text-emerald-200/70">How it helps</p>
              <p className="mt-1.5 text-xs leading-relaxed text-white/75">{score.howItHelps}</p>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-[0.62rem] font-bold uppercase tracking-wider text-amber-200/70">How it can work against you</p>
              <p className="mt-1.5 text-xs leading-relaxed text-white/75">{score.howItWorksAgainst}</p>
            </div>
            <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
              <p className="text-[0.62rem] font-bold uppercase tracking-wider text-sky-200/70">Best use</p>
              <p className="mt-1.5 text-xs leading-relaxed text-white/75">{score.bestUse}</p>
            </div>
          </div>
        </article>
      ))}

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-white/50">Pattern summary</p>
        <h4 className="mt-2 font-bold text-white">{SCORES_REVEAL_META.patternSummary.headline}</h4>
        <p className="mt-2 text-sm leading-relaxed text-white/80">{SCORES_REVEAL_META.patternSummary.meaning}</p>
      </div>

      <p className="text-xs text-white/45">
        {UNAVAILABLE_SCORE_DIMENSIONS.join(', ')} — exact values not available in this lab fixture; scores not fabricated.
      </p>
    </div>
  );
}

function ExpandableSectionCard({ section, expanded, onToggle }) {
  const isOpen = expanded[section.id] ?? section.defaultOpen;

  return (
    <article
      id={`premium-section-${section.id}`}
      className={`scroll-mt-28 rounded-2xl border transition-colors ${isOpen ? 'border-orange-400/30 bg-white/[0.05]' : 'border-white/10 bg-white/[0.02] hover:border-white/18'}`}
    >
      <button
        type="button"
        onClick={() => onToggle(section.id)}
        className="flex w-full items-start justify-between gap-4 p-5 text-left"
        aria-expanded={isOpen}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-white">{section.title}</h3>
            <SectionBadge type={section.badge} />
          </div>
          {!isOpen ? (
            <p className="mt-2 line-clamp-2 text-sm text-white/55">{section.preview}</p>
          ) : null}
        </div>
        <span className={`mt-1 shrink-0 text-lg text-orange-300/80 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden>
          ▾
        </span>
      </button>

      {isOpen ? (
        <div className="border-t border-white/8 px-5 pb-5 pt-4">
          {!isOpen ? null : section.type === 'orientation' ? (
            <div className="space-y-4">
              {START_HERE_COPY.paragraphs.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-white/80">{p}</p>
              ))}
            </div>
          ) : null}
          {section.type === 'scores' ? <ScoresRevealContent /> : null}
          {section.type === 'content' ? (
            <>
              <PlainTextBlock text={section.content} />
              {section.evidenceNote ? (
                <p className="mt-4 rounded-lg border border-white/8 bg-black/30 px-3 py-2 text-xs text-white/45">
                  <span className="font-semibold text-white/55">Evidence / grounding:</span> {section.evidenceNote}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export default function PremiumCustomerBOSShell() {
  const initialExpanded = PREMIUM_EXPANDABLE_SECTIONS.reduce((acc, s) => {
    acc[s.id] = s.defaultOpen;
    return acc;
  }, {});

  const [expanded, setExpanded] = useState(initialExpanded);

  function toggleSection(id) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function expandAll() {
    setExpanded(PREMIUM_EXPANDABLE_SECTIONS.reduce((acc, s) => ({ ...acc, [s.id]: true }), {}));
  }

  function collapseAll() {
    setExpanded(PREMIUM_EXPANDABLE_SECTIONS.reduce((acc, s) => ({ ...acc, [s.id]: s.id === 'start-here' || s.id === 'scores-reveal' }), {}));
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-orange-200/80">Premium Customer BOS</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="rounded-lg border border-white/12 bg-black/30 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-white/55 hover:text-white/80"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded-lg border border-white/12 bg-black/30 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-white/55 hover:text-white/80"
          >
            Collapse to essentials
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {PREMIUM_EXPANDABLE_SECTIONS.map((section) => (
          <ExpandableSectionCard
            key={section.id}
            section={section}
            expanded={expanded}
            onToggle={toggleSection}
          />
        ))}
      </div>
    </section>
  );
}

export { PlainTextBlock, ScoresRevealContent };