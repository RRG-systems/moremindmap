/**
 * MMB13 lab-only — Final BOS customer experience metadata and section definitions.
 * Customer-facing prototype for Avery North; no production mutation.
 */

import { customerBosSectionsSynthetic, formatCustomerSectionContent } from './customerBosRenderer.js';
import { SYNTHETIC_OPERATING_SCORES, SCORES_REVEAL_META } from './customerBosScoreMeaning.js';

export const FINAL_BOS_META = {
  profileName: 'Avery North',
  title: 'Behavioral Operating System',
  subtitle:
    'A clear map of how you think, decide, communicate, lead, and respond under pressure.',
  profileId: 'mm-20990102-labsyn02',
};

/** Eight fictional operating scores retained to exercise the complete score layout. */
export const ALL_OPERATING_SCORES = [
  ...SYNTHETIC_OPERATING_SCORES.map(({ dimension, score, classification, whatItMeans }) => ({
    dimension, score, classification, oneLine: whatItMeans,
  })),
  { dimension: 'Vector', score: 0.58, classification: 'moderate', oneLine: 'Direction forms through evidence synthesis and explicit decision points.' },
  { dimension: 'Velocity', score: 0.47, classification: 'moderate', oneLine: 'Pace is deliberate until the proof condition is clear.' },
  { dimension: 'Leverage', score: 0.72, classification: 'strong', oneLine: 'The operator notices where a small system change can remove repeated work.' },
  { dimension: 'Flex', score: 0.66, classification: 'strong', oneLine: 'Plans can adapt without losing the agreed outcome or review rhythm.' },
];

export const SCORE_CLASSIFICATION_COLORS = {
  high: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
  strong: 'border-emerald-400/30 bg-emerald-500/8 text-emerald-100',
  moderate: 'border-sky-400/30 bg-sky-500/8 text-sky-100',
  low: 'border-amber-400/30 bg-amber-500/8 text-amber-100',
  'very low': 'border-rose-400/30 bg-rose-500/8 text-rose-100',
};

export const FINAL_BOS_TABS = [
  { id: 'overview', label: 'Overview', default: true },
  { id: 'scores-reveal', label: 'What Your Scores Reveal' },
  { id: 'visual-dna', label: 'Your Visual DNA' },
  { id: 'five-futures', label: 'Five Futures' },
  { id: 'one-move', label: 'One Move' },
  { id: 'team-fit', label: 'Team / Leadership Fit' },
  { id: 'how-to-use', label: 'How to Use This' },
  { id: 'advanced-source', label: 'Advanced Source', internal: true },
];

const sections = customerBosSectionsSynthetic;

export const OVERVIEW_SECTION_BADGES = {
  executive: 'Core Insight',
  pattern: 'Core Insight',
  advantage: 'Strength',
  risk: 'Watch',
  move: 'Action',
};

export const OVERVIEW_EXPANDABLE_SECTIONS = [
  {
    id: 'executive-summary',
    title: 'Executive Summary',
    preview: sections.executiveSummary.headline,
    badge: OVERVIEW_SECTION_BADGES.executive,
    defaultOpen: true,
    content: formatCustomerSectionContent('executiveSummary', sections.executiveSummary),
  },
  {
    id: 'core-operating-pattern',
    title: 'Core Operating Pattern',
    preview: SCORES_REVEAL_META.patternSummary.headline,
    badge: OVERVIEW_SECTION_BADGES.pattern,
    defaultOpen: true,
    content: `**${SCORES_REVEAL_META.patternSummary.headline}**\n\n${SCORES_REVEAL_META.patternSummary.meaning}\n\nUnder pressure, the fictional operator gathers more context and may delay a decision. A short decision window and visible owner preserve both care and momentum.`,
  },
  {
    id: 'key-advantage',
    title: 'Key Advantage',
    preview: 'Reading context, protecting quality, and translating evidence into a clear next move.',
    badge: OVERVIEW_SECTION_BADGES.advantage,
    defaultOpen: false,
    content: `The fictional combination of strong Signal and Fidelity supports thoughtful client work and early risk detection. The advantage becomes transferable when quality judgment is written as acceptance criteria.

${SYNTHETIC_OPERATING_SCORES[0].howItHelps}

${SYNTHETIC_OPERATING_SCORES[1].howItHelps}`,
  },
  {
    id: 'main-scaling-risk',
    title: 'Main Scaling Risk',
    preview: sections.executiveSummary.key_warning,
    badge: OVERVIEW_SECTION_BADGES.risk,
    defaultOpen: false,
    content: `**${sections.executiveSummary.key_warning}**

At larger scale, the synthetic business needs explicit acceptance criteria, decision windows, and escalation rules. Otherwise careful judgment remains concentrated with the owner.

Demand can grow faster than delegation readiness. The lab scenario therefore tests whether the interface clearly separates behavioral strength from operating-system maturity.`,
  },
  {
    id: 'best-next-move',
    title: 'Best Next Move',
    preview: sections.recommendedNextStep.headline,
    badge: OVERVIEW_SECTION_BADGES.move,
    defaultOpen: false,
    content: formatCustomerSectionContent('recommendedNextStep', sections.recommendedNextStep),
  },
];

export const HOW_TO_USE_THIS = {
  title: 'How to Use This',
  intro:
    'Your Behavioral Operating System is a practical map — not a grade, not a label, and not a fixed type. Use it to understand your operating pattern and make better decisions about how you lead and scale.',
  steps: [
    {
      title: 'Start with your score pattern',
      body: 'Read the eight operating scores at the top. Notice where you are strongest (Vector, Velocity) and where external structure will matter most (Framework, Horizon). Your scores show patterns, not pass/fail results.',
    },
    {
      title: 'Use One Move for the next 30 days',
      body: 'Your One Move — transferring judgment into decision rights and accountability — is the highest-leverage intervention for your profile. Follow the first 30 days plan and track the proof signals.',
    },
    {
      title: 'Review Five Futures with your coach, team, or leadership partner',
      body: 'Five Futures is a map of possible paths, not a prediction. Discuss which futures feel most likely today and what would shift the trajectory toward transferable momentum.',
    },
    {
      title: 'Revisit when evidence changes',
      body: 'This BOS reflects your assessment at a point in time. Revisit after major role changes, team growth, or when you notice new friction patterns. Updated evidence may shift the emphasis — not your core operating pattern.',
    },
  ],
};

export function getFiveFuturesExpandableSections() {
  const ff = sections.fiveFutures;
  const items = [
    {
      id: 'five-futures-summary',
      title: 'Future Landscape',
      preview: ff.summary.slice(0, 160) + '…',
      badge: 'Future',
      defaultOpen: true,
      content: `${ff.summary}\n\n**${ff.most_likely.title}** (${ff.most_likely.likelihood})\n${ff.most_likely.trajectory}\n\n_What the organization experiences:_ ${ff.most_likely.organization_experiences}`,
    },
    ...(ff.futures || []).map((f, i) => ({
      id: `future-${i + 1}`,
      title: f.title,
      preview: f.trajectory.slice(0, 140) + '…',
      badge: f.likelihood === 'Risk' ? 'Watch' : 'Future',
      defaultOpen: false,
      content: `**Likelihood:** ${f.likelihood}\n\n${f.trajectory}\n\n_What the organization experiences:_ ${f.organization_experiences}`,
    })),
  ];
  return items;
}
