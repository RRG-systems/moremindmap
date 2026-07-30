/**
 * MMB12 lab-only — Premium Customer BOS shell section metadata and derived content.
 * Static fixture for Avery North; no production mutation.
 */

import { customerBosSectionsSynthetic, formatCustomerSectionContent } from './customerBosRenderer.js';
import { SCORES_REVEAL_META } from './customerBosScoreMeaning.js';

export const PREMIUM_SHELL_META = {
  brandLine: 'MORE MindMap / Behavioral Operating System',
  labTitle: 'Avery BOS Customer Output Lab',
  profileId: 'mm-20990102-labsyn02',
  profileName: 'Avery North',
};

export const START_HERE_COPY = {
  title: 'Start Here',
  paragraphs: [
    'This is the customer-facing version of your Behavioral Operating System. It keeps the same intelligence as the technical BOS — the same evidence, futures, and recommendations — but is written so you can read it without decoding clinical language.',
    'Your scores are not grades. They are not pass/fail. They show which operating patterns drive how you think, decide, communicate, and lead under normal conditions and under pressure.',
    'The system is showing operating patterns, not fixed labels. You are not "a type." You are a person with a specific combination of strengths, friction points, and scaling constraints that matter for how you build and lead.',
  ],
};

const sections = customerBosSectionsSynthetic;

export const PREMIUM_SECTION_BADGES = {
  orientation: 'Core Insight',
  scores: 'Core Insight',
  executive: 'Core Insight',
  operating: 'Core Insight',
  pressure: 'Watch',
  team: 'Evidence',
  scaling: 'Watch',
  fiveFutures: 'Future',
  oneMove: 'Action',
  facilitator: 'Evidence',
};

export const PREMIUM_EXPANDABLE_SECTIONS = [
  {
    id: 'start-here',
    title: 'Start Here',
    preview: 'How to read this report — customer-facing BOS, not grades, operating patterns not labels.',
    badge: PREMIUM_SECTION_BADGES.orientation,
    defaultOpen: true,
    type: 'orientation',
  },
  {
    id: 'scores-reveal',
    title: 'What Your Scores Reveal',
    preview: SCORES_REVEAL_META.subtitle,
    badge: PREMIUM_SECTION_BADGES.scores,
    defaultOpen: true,
    type: 'scores',
  },
  {
    id: 'executive-summary',
    title: 'Executive Summary',
    preview: sections.executiveSummary.headline,
    badge: PREMIUM_SECTION_BADGES.executive,
    defaultOpen: false,
    type: 'content',
    content: formatCustomerSectionContent('executiveSummary', sections.executiveSummary),
    evidenceNote: 'Grounded exclusively in fictional intake, synthetic operating scores, and a synthetic scaling constraint.',
  },
  {
    id: 'operating-pattern',
    title: 'Your Operating Pattern',
    preview: SCORES_REVEAL_META.patternSummary.headline,
    badge: PREMIUM_SECTION_BADGES.operating,
    defaultOpen: false,
    type: 'content',
    content: `**${SCORES_REVEAL_META.patternSummary.headline}**\n\n${SCORES_REVEAL_META.patternSummary.meaning}`,
    evidenceNote: 'Derived from the synthetic Signal, Fidelity, Framework, and Horizon fixture values.',
  },
  {
    id: 'pressure-pattern',
    title: 'Pressure Pattern',
    preview: 'Under pressure the fictional operator gathers more context and may delay commitment.',
    badge: PREMIUM_SECTION_BADGES.pressure,
    defaultOpen: false,
    type: 'content',
    content: `Under pressure, the fictional operator seeks additional context and may keep options open too long. A bounded decision window and a named owner prevent thoughtful analysis from becoming delay.

The synthetic profile is designed for relationship-sensitive work with compact operating rules, visible proof conditions, and a weekly review rhythm.

**A moment that shows this:** ${sections.executiveSummary.micro_scenario}

**Watch for:** ${sections.executiveSummary.key_warning}`,
    evidenceNote: 'From synthetic pressure-pattern and executive-summary evidence.',
  },
  {
    id: 'team-experience',
    title: 'Team Experience',
    preview: 'How a fictional team experiences careful judgment when decision ownership is unclear.',
    badge: PREMIUM_SECTION_BADGES.team,
    defaultOpen: false,
    type: 'content',
    content: `**Most likely team experience:** ${sections.fiveFutures.most_likely.organization_experiences}

**Pattern across futures:** The synthetic team benefits from thoughtful context but slows when quality standards and decision rights stay implicit. Clear acceptance criteria let contributors act without repeated owner review.

**Tension point:** Careful judgment becomes a bottleneck when the team cannot distinguish an autonomous decision from an escalation.`,
    evidenceNote: 'From Five Futures organization_experiences — customer BOS layer.',
  },
  {
    id: 'scaling-constraint',
    title: 'Scaling Constraint',
    preview: 'At larger scale the fictional business needs visible standards, decision windows, and clearer accountability.',
    badge: PREMIUM_SECTION_BADGES.scaling,
    defaultOpen: false,
    type: 'content',
    content: `The fictional limit is quality judgment that has not yet been converted into acceptance criteria. As work grows, contributors may wait for review because the proof condition is unclear.

At larger scale, the business needs compact standards, explicit escalation thresholds, and a weekly inspection rhythm that another owner can run.

**Future risk:** Demand grows while delegation readiness stays flat, increasing delays and owner review load.`,
    evidenceNote: 'From the synthetic scaling constraint and fictional executive summary.',
  },
  {
    id: 'five-futures',
    title: 'Five Futures',
    preview: sections.fiveFutures.summary.slice(0, 180) + '…',
    badge: PREMIUM_SECTION_BADGES.fiveFutures,
    defaultOpen: false,
    type: 'content',
    content: formatCustomerSectionContent('fiveFutures', sections.fiveFutures),
    evidenceNote: 'Five structurally complete fictional futures retained for lab rendering.',
  },
  {
    id: 'one-move',
    title: 'One Move',
    preview: sections.recommendedNextStep.headline,
    badge: PREMIUM_SECTION_BADGES.oneMove,
    defaultOpen: false,
    type: 'content',
    content: formatCustomerSectionContent('recommendedNextStep', sections.recommendedNextStep),
    evidenceNote: 'Synthetic One Move with a 30-day plan and observable proof signals.',
  },
  {
    id: 'facilitator-notes',
    title: 'Facilitator Notes / How to Use This',
    preview: sections.facilitatorNotes.summary,
    badge: PREMIUM_SECTION_BADGES.facilitator,
    defaultOpen: false,
    type: 'content',
    content: formatCustomerSectionContent('facilitatorNotes', sections.facilitatorNotes),
    evidenceNote: 'Team / leadership fit environment design — 9 structured notes for operators and facilitators.',
  },
];

export const PREMIUM_NAV_TABS = [
  { id: 'premium-customer', label: 'Premium Customer BOS', hero: true },
  { id: 'scores-reveal', label: 'What Your Scores Reveal' },
  { id: 'five-futures-tab', label: 'Five Futures' },
  { id: 'one-move-tab', label: 'One Move' },
  { id: 'team-fit-tab', label: 'Team / Leadership Fit' },
  { id: 'technical-source', label: 'Technical Source' },
  { id: 'scorecard', label: 'Scorecard' },
  { id: 'notes-tab', label: 'Notes' },
];

export const LAB_COMPARE_TABS = [
  { id: 'tech-customer', label: 'Side-by-side' },
  { id: 'technical-bos', label: 'Technical BOS' },
  { id: 'customer-bos', label: 'Customer BOS' },
  { id: 'mmb9-compare', label: 'MMB9 Model Compare' },
];
