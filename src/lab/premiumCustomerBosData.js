/**
 * MMB12 lab-only — Premium Customer BOS shell section metadata and derived content.
 * Static fixture for Darren Kirkland; no production mutation.
 */

import { customerBosSectionsDarrenMmb11, formatCustomerSectionContent } from './customerBosRenderer.js';
import { SCORES_REVEAL_META } from './customerBosScoreMeaning.js';

export const PREMIUM_SHELL_META = {
  brandLine: 'MORE MindMap / Behavioral Operating System',
  labTitle: 'Darren BOS Customer Output Lab',
  profileId: 'mm-20260527-6zshuaao',
  profileName: 'Darren Kirkland',
};

export const START_HERE_COPY = {
  title: 'Start Here',
  paragraphs: [
    'This is the customer-facing version of your Behavioral Operating System. It keeps the same intelligence as the technical BOS — the same evidence, futures, and recommendations — but is written so you can read it without decoding clinical language.',
    'Your scores are not grades. They are not pass/fail. They show which operating patterns drive how you think, decide, communicate, and lead under normal conditions and under pressure.',
    'The system is showing operating patterns, not fixed labels. You are not "a type." You are a person with a specific combination of strengths, friction points, and scaling constraints that matter for how you build and lead.',
  ],
};

const sections = customerBosSectionsDarrenMmb11;

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
    evidenceNote: 'Grounded in intake answers, operating scores, and scaling constraint from MMB9 GPT-5.5 technical BOS.',
  },
  {
    id: 'operating-pattern',
    title: 'Your Operating Pattern',
    preview: SCORES_REVEAL_META.patternSummary.headline,
    badge: PREMIUM_SECTION_BADGES.operating,
    defaultOpen: false,
    type: 'content',
    content: `**${SCORES_REVEAL_META.patternSummary.headline}**\n\n${SCORES_REVEAL_META.patternSummary.meaning}`,
    evidenceNote: 'Derived from Vector 0.88, Velocity 0.75, Framework 0.17, Horizon 0.00 — MMB9/MMB10 lab fixture.',
  },
  {
    id: 'pressure-pattern',
    title: 'Pressure Pattern',
    preview: 'Under pressure you double down: more decisive, faster, less reading of detail. Prolonged load is your break point.',
    badge: PREMIUM_SECTION_BADGES.pressure,
    defaultOpen: false,
    type: 'content',
    content: `Under pressure, you double down: more decisive, faster, less reading of detail. Prolonged load is your break point. Roles that require constant permission-seeking, repeated process failure without correction, or heavy coordination without clear escalation paths will drain you.

You are not built for indefinite coordination layers. You are built to set direction, create opportunity, and define the model — especially for a business you want to become subscription-based, residual, and eventually able to operate mostly on its own.

**A moment that shows this:** ${sections.executiveSummary.micro_scenario}

**Watch for:** ${sections.executiveSummary.key_warning}`,
    evidenceNote: 'From GPT-5.5 technical BOS pressure_pattern and executive summary grounding.',
  },
  {
    id: 'team-experience',
    title: 'Team Experience',
    preview: 'How teams experience your direction, pace, and model when momentum depends on your personal unblock.',
    badge: PREMIUM_SECTION_BADGES.team,
    defaultOpen: false,
    type: 'content',
    content: `**Most likely team experience:** ${sections.fiveFutures.most_likely.organization_experiences}

**Pattern across futures:** Teams get movement when you step in, but movement increasingly depends on your interpretation of what should happen next. At 2x scale, your pace may confuse new team members. You leave people to work independently so their creative side shows up — but sometimes they stall until you re-enter and redirect. Initiative becomes uneven: strong contributors run, unclear contributors wait.

**Tension point:** When someone interprets your model and makes it work for them instead of using it as designed, friction rises. Doubts may stay hidden too long.`,
    evidenceNote: 'From Five Futures organization_experiences — customer BOS layer.',
  },
  {
    id: 'scaling-constraint',
    title: 'Scaling Constraint',
    preview: 'At 5x scale the business needs external structure — decision frameworks, escalation paths, and clearer accountability.',
    badge: PREMIUM_SECTION_BADGES.scaling,
    defaultOpen: false,
    type: 'content',
    content: `The limit is not your drive. It is scale without scaffolding. As the business grows, your pace can confuse newer team members. Progress can start depending on you personally stepping in to clarify, restart, or redirect the work.

At 5x scale, the business will need decision frameworks, escalation paths, and clearer structure around your momentum. Vector plus velocity creates strong personal motion; low Framework (0.17) and Horizon (0.00) leave the broader system less able to carry that motion without you.

**Future risk:** Revenue or opportunity can grow faster than operating independence. That threatens your goal of a subscription-based or saleable business. Instead of becoming a residual asset, the company risks becoming founder-responsive.`,
    evidenceNote: 'From scaling_constraint grounding in GPT-5.5 technical BOS and customer executive summary.',
  },
  {
    id: 'five-futures',
    title: 'Five Futures',
    preview: sections.fiveFutures.summary.slice(0, 180) + '…',
    badge: PREMIUM_SECTION_BADGES.fiveFutures,
    defaultOpen: false,
    type: 'content',
    content: formatCustomerSectionContent('fiveFutures', sections.fiveFutures),
    evidenceNote: 'Full Five Futures from customer BOS — same depth as MMB11 technical source.',
  },
  {
    id: 'one-move',
    title: 'One Move',
    preview: sections.recommendedNextStep.headline,
    badge: PREMIUM_SECTION_BADGES.oneMove,
    defaultOpen: false,
    type: 'content',
    content: formatCustomerSectionContent('recommendedNextStep', sections.recommendedNextStep),
    evidenceNote: 'Recommended Next Step / One Move — transfer judgment intervention with first 30 days and proof signals.',
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