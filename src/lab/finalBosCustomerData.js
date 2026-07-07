/**
 * MMB13 lab-only — Final BOS customer experience metadata and section definitions.
 * Customer-facing prototype for Darren Kirkland; no production mutation.
 */

import { customerBosSectionsDarrenMmb11, formatCustomerSectionContent } from './customerBosRenderer.js';
import { DARREN_OPERATING_SCORES, SCORES_REVEAL_META } from './customerBosScoreMeaning.js';

export const FINAL_BOS_META = {
  profileName: 'Darren Kirkland',
  title: 'Behavioral Operating System',
  subtitle:
    'A clear map of how you think, decide, communicate, lead, and respond under pressure.',
  profileId: 'mm-20260527-6zshuaao',
};

/** All eight operating scores from canonical dossier (MMB9 readonly snapshot). */
export const ALL_OPERATING_SCORES = [
  {
    dimension: 'Vector',
    score: 0.88,
    classification: 'high',
    oneLine:
      'Direction and path-setting are dominant — you stabilize where things should go.',
  },
  {
    dimension: 'Velocity',
    score: 0.75,
    classification: 'strong',
    oneLine:
      'You move from thought to action quickly once direction forms.',
  },
  {
    dimension: 'Signal',
    score: 0.6,
    classification: 'moderate',
    oneLine:
      'You read relational and contextual cues with reasonable awareness.',
  },
  {
    dimension: 'Fidelity',
    score: 0.5,
    classification: 'moderate',
    oneLine:
      'Detail fidelity is balanced — you can hold precision when it matters.',
  },
  {
    dimension: 'Leverage',
    score: 0.5,
    classification: 'moderate',
    oneLine:
      'You use leverage points moderately — opportunity and timing awareness.',
  },
  {
    dimension: 'Flex',
    score: 0.42,
    classification: 'moderate',
    oneLine:
      'Adaptability is present but not your primary operating mode.',
  },
  {
    dimension: 'Framework',
    score: 0.17,
    classification: 'low',
    oneLine:
      'Structure is not your first instinct — you prefer action and correction in motion.',
  },
  {
    dimension: 'Horizon',
    score: 0.0,
    classification: 'very low',
    oneLine:
      'Near-term, practical wins dominate over distant future architecture.',
  },
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

const sections = customerBosSectionsDarrenMmb11;

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
    content: `**${SCORES_REVEAL_META.patternSummary.headline}**\n\n${SCORES_REVEAL_META.patternSummary.meaning}\n\nUnder pressure, you double down: more decisive, faster, less reading of detail. Prolonged load is your break point. You are built to set direction, create opportunity, and define the model — especially for a business you want to become subscription-based, residual, and eventually able to operate mostly on its own.`,
  },
  {
    id: 'key-advantage',
    title: 'Key Advantage',
    preview: 'Rainmaking, unblocking stalled initiatives, and giving teams a clear next move.',
    badge: OVERVIEW_SECTION_BADGES.advantage,
    defaultOpen: false,
    content: `Your combination of high Vector (0.88) and strong Velocity (0.75) makes you exceptionally effective at creating forward motion. You are at your best in rainmaking roles — unblocking initiatives, restarting momentum, and leading early-stage movement where the next step matters more than perfect process.

${DARREN_OPERATING_SCORES[0].howItHelps}

${DARREN_OPERATING_SCORES[1].howItHelps}`,
  },
  {
    id: 'main-scaling-risk',
    title: 'Main Scaling Risk',
    preview: sections.executiveSummary.key_warning,
    badge: OVERVIEW_SECTION_BADGES.risk,
    defaultOpen: false,
    content: `**${sections.executiveSummary.key_warning}**

At 5x scale, the business will need decision frameworks, escalation paths, and clearer structure around your momentum. Vector plus velocity creates strong personal motion; low Framework (0.17) and Horizon (0.00) leave the broader system less able to carry that motion without you.

Revenue or opportunity can grow faster than operating independence. That threatens your goal of a subscription-based or saleable business. Instead of becoming a residual asset, the company risks becoming founder-responsive: teams wait for your read, your model, or your permission.`,
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