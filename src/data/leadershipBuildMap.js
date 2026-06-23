export const leadershipBuildMap = [
  {
    id: 'v1-sales-visibility',
    title: 'Now: V1 Sales Visibility',
    dateRange: 'Live Now',
    label: 'Live Now',
    status: 'live',
    bullets: [
      'Behavior Profile / canonical dossiers',
      'Business Assessment intake',
      'Leadership Sales Dashboard',
      'Formspree completion notifications',
      'Profile IDs and assessment IDs',
      'Company adoption visibility',
      'Real V1 activity counts'
    ],
    salesMeaning: 'MORE MindMap can already show real assessment activity, retrievable records, and company-level adoption signals.',
    currentTruth: 'Live dashboard visibility is read-only and sourced from the backend admin API.',
    limits: 'Paid/free/revenue and RRG readiness are still unavailable until those systems are persistently indexed.'
  },
  {
    id: 'promo-payment-cleanup',
    title: 'June 17-June 24: Promo / Payment Cleanup',
    dateRange: 'June 17-June 24',
    label: 'Immediate Revenue Foundation',
    status: 'planned',
    bullets: [
      'Promo/payment cleanup',
      'Formspree/email notifications',
      'Stripe one-time assessment payments',
      'Cleaner paid/free source tracking'
    ],
    salesMeaning: 'Turns V1 activity into cleaner revenue attribution and better completion follow-up.',
    currentTruth: 'Planned roadmap phase. One-time payment and source tracking are not live in this dashboard.',
    limits: 'No revenue totals, payment state, or promo totals are shown until real fields are indexed.'
  },
  {
    id: 'subscription-infrastructure',
    title: 'June 24-July 8: Subscription Infrastructure',
    dateRange: 'June 24-July 8',
    label: 'Subscription Foundation',
    status: 'planned',
    bullets: [
      '$23.95/month plan',
      'usage tracking',
      'monthly access rules',
      'subscription state connected to profile/assessment records'
    ],
    salesMeaning: 'Creates recurring access around the assessment and coaching intelligence layer.',
    currentTruth: 'Planned roadmap phase. Subscription behavior is not active.',
    limits: 'No subscription status or usage limits are displayed as live product truth.'
  },
  {
    id: 'generated-strategy-persistence',
    title: 'Generated Strategy Persistence',
    dateRange: 'Current Build',
    label: 'Recursive Memory Foundation',
    status: 'in_progress',
    bullets: [
      'Save Darren generated Five Futures + One Move as linked artifact',
      'Retrieve latest saved leadership strategy',
      'Track One Move acceptance and status',
      'Capture lightweight result notes and signal strength v0',
      'Create separate Outcome Ledger v0 evidence events',
      'Compare strategy status and ledger events with Since Last Snapshot v0',
      'Add Darren Strategy Chat foundation as a non-mutating conversational layer',
      'Keep canonical dossier unchanged',
      'Prepare for future movement and evidence-weighted memory',
      'Prepare subscription coaching memory architecture'
    ],
    salesMeaning: 'MORE MindMap is beginning to remember generated strategy, One Move status, and evidence events, then show what changed since the last strategy.',
    currentTruth: 'Generated strategy persistence, One Move status tracking, Outcome Ledger v0, and Since Last Snapshot v0 are live. Darren Strategy Chat Foundation is being implemented as a context-aware, non-mutating conversational layer. Automatic learning: not live yet.',
    limits: 'The system compares strategy status and ledger events, but it does not automatically update future movement or generate a new strategy yet. Chat does not mutate strategy, One Move status, or Outcome Ledger yet. No chat memory, predictive scoring, or automatic learning is live until future movement and evidence-weighted memory are implemented.'
  },
  {
    id: 'darren-strategy-chat-foundation',
    title: 'Darren Strategy Chat Foundation',
    dateRange: 'Current Build',
    label: 'Context-Aware Chat Foundation',
    status: 'in_progress',
    bullets: [
      'Open-ended Darren Strategy Chat inside the Leadership Dashboard',
      'Ground replies in latest strategy, One Move status, Outcome Ledger v0, and Since Last Snapshot v0',
      'Support natural language questions without requiring product taxonomy',
      'Keep chat non-mutating for V0',
      'Define chat action proposal contract for future confirmation flows',
      'Capture confirmed chat actions through approved One Move status and Outcome Ledger routes',
      'Add Adaptive Strategy Loop v0 with session summaries, evidence bands, and pending-review strategy drafts',
      'Prepare future durable chat summaries and evidence-weighted memory'
    ],
    salesMeaning: 'Darren can talk through strategy, pitch language, what changed, and overclaim risk while the structured dashboard remains the source-labeled truth layer.',
    currentTruth: 'Darren Strategy Chat Foundation is live. Chat Action Proposal Contract is live. Confirmed Chat Action Capture is live. Adaptive Strategy Loop v0 is being implemented with chat session summaries, future movement bands, and pending-review strategy drafts. Automatic learning: not live yet.',
    limits: 'Chat can propose actions and confirmed actions can write only to approved status or ledger routes. Adaptive Strategy Drafts do not replace the active strategy automatically. Chat does not create autonomous learning, subscription behavior, Stripe behavior, or RRG runtime.'
  },
  {
    id: 'adaptive-strategy-loop-v0',
    title: 'Adaptive Strategy Loop v0',
    dateRange: 'Current Build',
    label: 'Evidence-Gated Strategy Drafts',
    status: 'in_progress',
    bullets: [
      'Store durable chat session summaries without raw transcript persistence',
      'Assess Five Futures movement with evidence bands instead of percentages',
      'Generate Adaptive Strategy Drafts as pending-review artifacts',
      'Keep active latest strategy unchanged until a future review/adopt flow exists',
      'Keep canonical dossier and assessment records unchanged',
      'Keep automatic replacement and future scoring claims out of the product'
    ],
    salesMeaning: 'MORE MindMap can begin converting confirmed evidence and summarized strategic conversations into a reviewable next-strategy draft without pretending the system has autonomously learned.',
    currentTruth: "Adaptive Strategy Loop v0 creates separate summary, movement assessment, and draft artifacts. It does not replace Darren's active strategy automatically. Automatic learning: not live yet.",
    limits: 'No numeric probability scoring, subscription runtime, Stripe runtime, RRG runtime, or automatic strategy replacement is live.'
  },
  {
    id: 'outcome-ledger',
    title: 'July 8-July 31: Outcome Ledger',
    dateRange: 'July 8-July 31',
    label: 'Recursive Coaching Begins',
    status: 'future',
    bullets: [
      'Outcome Ledger v1',
      'weekly recursive coaching sessions',
      'monthly full refresh',
      'system starts learning what advice worked'
    ],
    salesMeaning: 'Moves MORE MindMap from one-time insight toward measured coaching feedback and improvement loops.',
    currentTruth: 'Future roadmap phase. Outcome Ledger runtime is not implemented.',
    limits: 'No recursive learning claims are made without stored outcome data.'
  },
  {
    id: 'recruiting-intelligence',
    title: 'August 1-August 20: Recruiting Intelligence',
    dateRange: 'August 1-August 20',
    label: 'Recruiting Intelligence',
    status: 'future',
    bullets: [
      'bilateral recruiting intelligence',
      'personalized recruiting strategy',
      'recruiting packets',
      'leader/recruit matching logic'
    ],
    salesMeaning: 'Extends profile intelligence into recruiting conversations and leader-fit strategy.',
    currentTruth: 'Future roadmap phase. Recruiting intelligence is not live.',
    limits: 'No recruiting match score or recruiting packet is generated by this dashboard.'
  },
  {
    id: 'leadership-suite-v1',
    title: 'August 20-September 15: Leadership Suite V1',
    dateRange: 'August 20-September 15',
    label: 'Leadership Suite V1',
    status: 'future',
    bullets: [
      'Craig-style leadership dashboard',
      'conversational modes',
      'leader-facing intelligence',
      'company/team visibility'
    ],
    salesMeaning: 'Packages the intelligence into a leader-facing operating surface for teams and companies.',
    currentTruth: 'Future roadmap phase. The current dashboard is internal sales visibility only.',
    limits: 'No conversational leadership runtime or team visibility is active here.'
  },
  {
    id: 'team-intelligence',
    title: 'September 15-October 10: Team Intelligence',
    dateRange: 'September 15-October 10',
    label: 'Team + Organization Intelligence',
    status: 'future',
    bullets: [
      'Team Business Assessment upgrade',
      'team diagnostics',
      'team/org intelligence map',
      'stronger brokerage/team use cases'
    ],
    salesMeaning: 'Expands from individual and business records into team and organizational buying use cases.',
    currentTruth: 'Future roadmap phase. Team diagnostics are not live.',
    limits: 'No team assessment or organization map is generated by this dashboard.'
  },
  {
    id: 'molt-lite',
    title: 'October 10-November 15: MOLT Lite',
    dateRange: 'October 10-November 15',
    label: 'MOLT Lite / Signal Cards',
    status: 'future',
    bullets: [
      'Signal Cards',
      'governance membrane',
      'THINK import/reject logic',
      'early outside-context intelligence'
    ],
    salesMeaning: 'Introduces governed outside-context signals without lowering product-truth standards.',
    currentTruth: 'Future roadmap phase. MOLT Lite is not active.',
    limits: 'No outside-context intelligence or import/reject runtime is connected here.'
  },
  {
    id: 'v2-leadership-intelligence-system',
    title: 'November 15-December 31: V2 Leadership Intelligence System',
    dateRange: 'November 15-December 31',
    label: 'V2 Prototype',
    status: 'future',
    bullets: [
      'canonical dossiers',
      'lifecycle detection',
      'leadership detection',
      'early runtime architecture',
      'path toward LDE'
    ],
    salesMeaning: 'Points the platform toward durable leadership intelligence and runtime detection.',
    currentTruth: 'Future roadmap phase. V2 runtime architecture is not live.',
    limits: 'No lifecycle detection, leadership detection, or LDE runtime is exposed in V1.'
  }
]
