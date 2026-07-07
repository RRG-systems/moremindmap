/**
 * MMB13 lab-only — Final BOS customer experience prototype.
 * Customer-facing preview stripped of lab/debug language.
 */

import { useState } from 'react';
import { bosRegressionDataDarrenMmb9 as regressionData } from './bosRegressionData.darren.mmb9.js';
import {
  customerBosSectionsDarrenMmb11,
  formatCustomerSectionContent,
} from './customerBosRenderer.js';
import { PlainTextBlock, ScoresRevealContent } from './PremiumCustomerBOSShell.jsx';
import VisualDNADraftPanel from './VisualDNADraftPanel.jsx';
import {
  ALL_OPERATING_SCORES,
  FINAL_BOS_META,
  FINAL_BOS_TABS,
  getFiveFuturesExpandableSections,
  HOW_TO_USE_THIS,
  OVERVIEW_EXPANDABLE_SECTIONS,
  SCORE_CLASSIFICATION_COLORS,
} from './finalBosCustomerData.js';

const SECTION_BADGE_STYLES = {
  'Core Insight': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  Strength: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  Watch: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  Action: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  Future: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  Evidence: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
};

function SectionBadge({ type }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider ${SECTION_BADGE_STYLES[type] || SECTION_BADGE_STYLES.Evidence}`}
    >
      {type}
    </span>
  );
}

function OperatingScoreCard({ score }) {
  const colorClass = SCORE_CLASSIFICATION_COLORS[score.classification] || SCORE_CLASSIFICATION_COLORS.moderate;
  return (
    <article className={`rounded-xl border p-3 ${colorClass}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-white">{score.dimension}</h3>
        <span className="font-mono text-lg font-bold text-white">{score.score.toFixed(2)}</span>
      </div>
      <p className="mt-1 text-[0.62rem] font-bold uppercase tracking-wider text-white/55">
        {score.classification}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-white/70">{score.oneLine}</p>
    </article>
  );
}

function ExpandableCard({ section, expanded, onToggle }) {
  const isOpen = expanded[section.id] ?? section.defaultOpen;

  return (
    <article
      className={`rounded-2xl border transition-colors ${isOpen ? 'border-orange-400/30 bg-white/[0.05]' : 'border-white/10 bg-white/[0.02] hover:border-white/18'}`}
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
            {section.badge ? <SectionBadge type={section.badge} /> : null}
          </div>
          {!isOpen ? (
            <p className="mt-2 line-clamp-2 text-sm text-white/55">{section.preview}</p>
          ) : null}
        </div>
        <span
          className={`mt-1 shrink-0 text-lg text-orange-300/80 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {isOpen ? (
        <div className="border-t border-white/8 px-5 pb-5 pt-4">
          <PlainTextBlock text={section.content} />
        </div>
      ) : null}
    </article>
  );
}

function ExpandableSectionList({ sections, essentialsIds = [] }) {
  const initial = sections.reduce((acc, s) => {
    acc[s.id] = s.defaultOpen;
    return acc;
  }, {});
  const [expanded, setExpanded] = useState(initial);

  function toggle(id) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function expandAll() {
    setExpanded(sections.reduce((acc, s) => ({ ...acc, [s.id]: true }), {}));
  }

  function collapseEssentials() {
    setExpanded(
      sections.reduce(
        (acc, s) => ({
          ...acc,
          [s.id]: essentialsIds.length ? essentialsIds.includes(s.id) : s.defaultOpen,
        }),
        {},
      ),
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={expandAll}
          className="rounded-lg border border-white/12 bg-black/30 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-white/55 hover:text-white/80"
        >
          Expand all
        </button>
        <button
          type="button"
          onClick={collapseEssentials}
          className="rounded-lg border border-white/12 bg-black/30 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-white/55 hover:text-white/80"
        >
          Collapse to essentials
        </button>
      </div>
      {sections.map((section) => (
        <ExpandableCard
          key={section.id}
          section={section}
          expanded={expanded}
          onToggle={toggle}
        />
      ))}
    </div>
  );
}

function OneMoveTab() {
  const step = customerBosSectionsDarrenMmb11.recommendedNextStep;
  return (
    <section className="space-y-6">
      <article className="rounded-2xl border border-orange-400/35 bg-gradient-to-br from-orange-500/15 to-black/40 p-6 shadow-[0_0_32px_rgba(251,146,60,0.12)]">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-200/80">Your One Move</p>
        <h2 className="mt-3 text-2xl font-bold text-white">{step.headline}</h2>
        <p className="mt-4 text-sm leading-relaxed text-white/80">{step.body}</p>
      </article>
      <ExpandableSectionList
        sections={[
          {
            id: 'one-move-intervention',
            title: 'The Move',
            preview: step.intervention,
            badge: 'Action',
            defaultOpen: true,
            content: formatCustomerSectionContent('recommendedNextStep', step),
          },
        ]}
      />
    </section>
  );
}

function TeamFitTab() {
  const text = formatCustomerSectionContent(
    'facilitatorNotes',
    customerBosSectionsDarrenMmb11.facilitatorNotes,
  );
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/5 p-5">
        <h2 className="text-xl font-bold text-white">Team / Leadership Fit</h2>
        <p className="mt-2 text-sm text-white/70">
          How to design the environment around your operating pattern — for coaches, operators, and leadership partners.
        </p>
      </div>
      <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <PlainTextBlock text={text} />
      </article>
    </section>
  );
}

function HowToUseTab() {
  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-5">
        <h2 className="text-xl font-bold text-white">{HOW_TO_USE_THIS.title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-white/75">{HOW_TO_USE_THIS.intro}</p>
      </div>
      {HOW_TO_USE_THIS.steps.map((step, i) => (
        <article key={step.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-start gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-orange-400/40 bg-orange-500/15 text-sm font-bold text-orange-100">
              {i + 1}
            </span>
            <div>
              <h3 className="font-bold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/75">{step.body}</p>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

function AdvancedSourceTab() {
  const SECTION_ORDER = ['executiveSummary', 'fiveFutures', 'recommendedNextStep', 'facilitatorNotes'];
  const fullText = SECTION_ORDER.map((id) => {
    const payload = regressionData.gpt55Sections[id];
    if (!payload) return '';
    if (id === 'executiveSummary') {
      return [
        payload.headline ? `**Headline:** ${payload.headline}` : null,
        payload.body ? `\n${payload.body}` : null,
        payload.micro_scenario ? `\n\n**Micro scenario:** ${payload.micro_scenario}` : null,
        payload.key_warning ? `\n\n**Key warning:** ${payload.key_warning}` : null,
      ].filter(Boolean).join('');
    }
    return JSON.stringify(payload, null, 2);
  }).join('\n\n---\n\n');

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-sky-400/25 bg-sky-500/5 p-4">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-sky-200/70">Optional — technical source</p>
        <p className="mt-2 text-sm text-white/70">
          This is the GPT-5.5 technical BOS behind the customer-readable layer. It is preserved for depth and review — not the default customer experience.
        </p>
        <p className="mt-1 font-mono text-xs text-white/45">{regressionData.gpt55Model.model}</p>
      </div>
      <article className="max-h-[70vh] overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <PlainTextBlock text={fullText} />
      </article>
    </section>
  );
}

export default function FinalBOSCustomerExperience() {
  const [activeTab, setActiveTab] = useState('overview');
  const fiveFuturesSections = getFiveFuturesExpandableSections();

  return (
    <section className="rounded-2xl border border-white/12 bg-black/30 shadow-[0_0_48px_rgba(251,146,60,0.08)]">
      {/* Customer header */}
      <header className="border-b border-white/10 px-6 py-8">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-orange-200/70">MORE MindMap</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">{FINAL_BOS_META.profileName}</h1>
        <h2 className="mt-1 text-xl font-semibold text-orange-100/90">{FINAL_BOS_META.title}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">{FINAL_BOS_META.subtitle}</p>
        <p className="mt-4 font-mono text-xs text-white/35">{FINAL_BOS_META.profileId}</p>
      </header>

      {/* Eight operating scores */}
      <div className="border-b border-white/8 px-6 py-6">
        <p className="mb-4 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-white/45">Your operating scores</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ALL_OPERATING_SCORES.map((score) => (
            <OperatingScoreCard key={score.dimension} score={score} />
          ))}
        </div>
      </div>

      {/* Customer tabs */}
      <nav className="border-b border-white/8 px-6 py-4" aria-label="BOS sections">
        <div className="flex flex-wrap gap-2">
          {FINAL_BOS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider ${
                activeTab === tab.id
                  ? tab.internal
                    ? 'border-sky-400/50 bg-sky-500/15 text-sky-100'
                    : 'border-orange-400/60 bg-orange-500/20 text-orange-50 shadow-[0_0_20px_rgba(251,146,60,0.12)]'
                  : tab.internal
                    ? 'border-white/10 bg-black/25 text-white/40 hover:text-white/65'
                    : 'border-white/12 bg-black/30 text-white/55 hover:text-white/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Tab content */}
      <div className="px-6 py-6">
        {activeTab === 'overview' && (
          <ExpandableSectionList
            sections={OVERVIEW_EXPANDABLE_SECTIONS}
            essentialsIds={['executive-summary', 'core-operating-pattern']}
          />
        )}

        {activeTab === 'scores-reveal' && (
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/5 p-5">
            <h2 className="text-xl font-bold text-white">What Your Scores Reveal</h2>
            <div className="mt-4">
              <ScoresRevealContent />
            </div>
          </div>
        )}

        {activeTab === 'visual-dna' && <VisualDNADraftPanel />}

        {activeTab === 'five-futures' && (
          <ExpandableSectionList
            sections={fiveFuturesSections}
            essentialsIds={['five-futures-summary']}
          />
        )}

        {activeTab === 'one-move' && <OneMoveTab />}

        {activeTab === 'team-fit' && <TeamFitTab />}

        {activeTab === 'how-to-use' && <HowToUseTab />}

        {activeTab === 'advanced-source' && <AdvancedSourceTab />}
      </div>
    </section>
  );
}