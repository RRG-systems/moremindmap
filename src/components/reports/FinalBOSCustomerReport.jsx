import { useState } from 'react';
import OperatingScoresStrip from './OperatingScoresStrip.jsx';
import ScoreMeaningSection from './ScoreMeaningSection.jsx';
import VisualDNATab from './VisualDNATab.jsx';
import { DEFAULT_BOS_TAB } from '../../lib/reports/buildFinalBOSTabs.js';
import './FinalBOSCustomerReport.css';

const SECTION_BADGE_STYLES = {
  'Core Insight': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  Strength: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  Watch: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  Constraint: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
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

/** Strip residual markdown markers so customer tabs never show raw ** / __ / #. */
function stripResidualMarkdown(text) {
  return String(text || '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/(^|[\s(])_([^_\n]+)_([\s).,;:!?]|$)/g, '$1$2$3');
}

export function PlainTextBlock({ text }) {
  const lines = stripResidualMarkdown(String(text || '')).split('\n');
  return (
    <div className="space-y-2 text-sm leading-relaxed text-white/82">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-2" />;
        // Sequence / label lines from Core Operating Pattern and plain "Label: body"
        if (
          /^(Trigger|Instinct|Strength|Risk|Needed support|Watch for|Primary guidance|Caution|Likelihood)\s*:/i.test(
            trimmed,
          )
        ) {
          const colon = trimmed.indexOf(':');
          const label = trimmed.slice(0, colon);
          const rest = trimmed.slice(colon + 1).trim();
          return (
            <p key={idx}>
              <span className="font-semibold text-white">{label}:</span>
              {rest ? ` ${rest}` : ''}
            </p>
          );
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

/**
 * R3B One Move structured blocks — no dense paragraph blob, no repeated inline labels.
 */
function OneMoveBlocks({ oneMove }) {
  const blocks = Array.isArray(oneMove?.blocks) ? oneMove.blocks : [];

  if (!blocks.length) {
    return (
      <ExpandableSectionList
        sections={[{
          id: 'one-move-intervention',
          title: 'The Move',
          preview: oneMove?.preview,
          badge: 'Action',
          defaultOpen: true,
          content: oneMove?.content || '',
        }]}
      />
    );
  }

  return (
    <div className="space-y-3">
      {blocks.map((block) => (
        <article
          key={block.id || block.title}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-white">{block.title}</h3>
            {block.id === 'the-move' ? <SectionBadge type="Action" /> : null}
          </div>
          <div className="mt-3">
            {block.kind === 'ordered_list' && Array.isArray(block.items) && block.items.length ? (
              <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-white/82">
                {block.items.map((item, i) => (
                  <li key={`${block.id}-${i}`}>{stripResidualMarkdown(item)}</li>
                ))}
              </ol>
            ) : block.kind === 'bullet_list' && Array.isArray(block.items) && block.items.length ? (
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-white/82">
                {block.items.map((item, i) => (
                  <li key={`${block.id}-${i}`}>{stripResidualMarkdown(item)}</li>
                ))}
              </ul>
            ) : (
              <PlainTextBlock text={block.content || ''} />
            )}
          </div>
        </article>
      ))}
    </div>
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
  const initial = sections.reduce((acc, section) => {
    acc[section.id] = section.defaultOpen;
    return acc;
  }, {});
  const [expanded, setExpanded] = useState(initial);

  function toggle(id) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function expandAll() {
    setExpanded(sections.reduce((acc, section) => ({ ...acc, [section.id]: true }), {}));
  }

  function collapseEssentials() {
    setExpanded(
      sections.reduce(
        (acc, section) => ({
          ...acc,
          [section.id]: essentialsIds.length ? essentialsIds.includes(section.id) : section.defaultOpen,
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

export default function FinalBOSCustomerReport({ viewModel }) {
  const [activeTab, setActiveTab] = useState(DEFAULT_BOS_TAB);

  if (!viewModel) {
    return <div className="web-report-error">Unable to render customer BOS experience.</div>;
  }

  const {
    meta,
    operatingScores,
    tabs,
    overviewSections,
    scoreMeaning,
    fiveFuturesSections,
    oneMove,
    teamFit,
    howToUseThis,
    advancedSource,
    visualDNA,
  } = viewModel;

  return (
    <section className="final-bos-customer-report rounded-2xl border border-white/12 bg-black/30 shadow-[0_0_48px_rgba(251,146,60,0.08)]">
      <header className="border-b border-white/10 px-6 py-8">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-orange-200/70">MORE MindMap</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">{meta.profileName}</h1>
        <h2 className="mt-1 text-xl font-semibold text-orange-100/90">{meta.title}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">{meta.subtitle}</p>
        {meta.profileId ? (
          <p className="mt-4 font-mono text-xs text-white/35">{meta.profileId}</p>
        ) : null}
        {meta.company ? (
          <p className="mt-2 text-sm text-white/50">{meta.company}</p>
        ) : null}
      </header>

      <OperatingScoresStrip scores={operatingScores} />

      <nav className="border-b border-white/8 px-6 py-4" aria-label="BOS sections">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
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

      <div className="px-6 py-6">
        {activeTab === 'overview' && (
          <ExpandableSectionList
            sections={overviewSections}
            essentialsIds={['executive-summary', 'core-operating-pattern']}
          />
        )}

        {activeTab === 'scores-reveal' && (
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/5 p-5">
            <h2 className="text-xl font-bold text-white">What Your Scores Reveal</h2>
            <div className="mt-4">
              <ScoreMeaningSection scoreMeaning={scoreMeaning} />
            </div>
          </div>
        )}

        {activeTab === 'visual-dna' && (
          <VisualDNATab
            approvedVisualDNA={visualDNA?.approved}
            deterministicVisualDNA={visualDNA?.deterministic}
            personName={meta.profileName}
            operatingScores={operatingScores}
          />
        )}

        {activeTab === 'five-futures' && (
          <ExpandableSectionList
            sections={fiveFuturesSections}
            essentialsIds={['five-futures-summary']}
          />
        )}

        {activeTab === 'one-move' && (
          <section className="space-y-6">
            <article className="rounded-2xl border border-orange-400/35 bg-gradient-to-br from-orange-500/15 to-black/40 p-6 shadow-[0_0_32px_rgba(251,146,60,0.12)]">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-200/80">Your One Move</p>
              <h2 className="mt-3 text-2xl font-bold text-white">{oneMove.headline}</h2>
            </article>
            <OneMoveBlocks oneMove={oneMove} />
          </section>
        )}

        {activeTab === 'team-fit' && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/5 p-5">
              <h2 className="text-xl font-bold text-white">Team / Leadership Fit</h2>
              <p className="mt-2 text-sm text-white/70">
                How to design the environment around your operating pattern — for coaches, operators, and leadership partners.
              </p>
            </div>
            <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <PlainTextBlock text={teamFit.content} />
            </article>
          </section>
        )}

        {activeTab === 'how-to-use' && (
          <section className="space-y-5">
            <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-5">
              <h2 className="text-xl font-bold text-white">{howToUseThis.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/75">{howToUseThis.intro}</p>
            </div>
            {howToUseThis.steps.map((step, index) => (
              <article key={step.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-start gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-orange-400/40 bg-orange-500/15 text-sm font-bold text-orange-100">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-bold text-white">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/75">{step.body}</p>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}

        {activeTab === 'advanced-source' && (
          <section className="space-y-4">
            <div className="rounded-xl border border-sky-400/25 bg-sky-500/5 p-4">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-sky-200/70">Optional — technical source</p>
              <p className="mt-2 text-sm text-white/70">
                This is the technical BOS behind the customer-readable layer. It is preserved for depth and review — not the default customer experience.
              </p>
              <p className="mt-1 font-mono text-xs text-white/45">
                {advancedSource.source} · {advancedSource.model}
              </p>
            </div>
            <article className="max-h-[70vh] overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <PlainTextBlock text={advancedSource.content} />
            </article>
          </section>
        )}
      </div>
    </section>
  );
}