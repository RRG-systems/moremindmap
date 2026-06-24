const PATH_STATUSES = new Set(['favored', 'supported', 'emerging', 'under-evidenced', 'watch'])

export const darrenBusinessModelBackbone = [
  {
    id: 'channel_growth',
    title: 'Channel Growth / Partner Distribution',
    short_label: 'Channel Growth',
    plain_english_summary: 'Mortgage, brokerage, and partner channels could distribute MORE MindMap and RRG through networks that already have trust and reach.',
    strategic_thesis: 'Mortgage, brokerage, and partner channels distribute MORE MindMap and RRG through existing networks.',
    value_creation_mechanism: 'Distribution leverage, partner access, and repeatable channel onboarding can reduce one-by-one selling friction.',
    why_it_could_work: 'Darren can create motion, open doors, and turn partner conversations into named proof targets faster than a cold-market motion.',
    key_evidence_to_watch: [
      'Named channel partner with clear audience access',
      'Partner agrees to a measurable pilot or introduction sequence',
      'Profiles, assessments, or RRG opportunities created through the channel',
      'Repeatable channel story that separates access from adoption'
    ],
    current_evidence_signals: [
      'Current strategy language and ledger signal types already include channel distribution',
      'Darren dashboard logic can track partner, funding, channel, and proof-target signals'
    ],
    missing_evidence: [
      'Verified channel adoption',
      'Repeatable conversion from channel access into paid or funded activity',
      'Named partner commitments beyond interest'
    ],
    risks: [
      'Access can be mistaken for adoption',
      'Partner enthusiasm can be mistaken for funded commitment',
      'A loud channel conversation can crowd out other viable business models too early'
    ],
    anti_overclaim_warning: 'Channel Growth is a valid path, not a final destiny. Access, interest, and audience reach are not adoption or revenue.',
    what_would_strengthen_this_path: [
      'A partner creates measurable profile, assessment, RRG, or paid conversion activity',
      'A channel pilot produces repeatable proof targets',
      'A channel partner commits specific distribution resources'
    ],
    what_would_weaken_this_path: [
      'Partner conversations do not convert into pilots or usage',
      'Channel access produces attention but no adoption',
      'Other paths produce faster evidence of revenue, retention, or funded pilots'
    ],
    related_existing_signals: ['channel_distribution', 'partner_signal', 'channel_signal', 'partner_capital', 'funded_pilot'],
    default_status: 'supported'
  },
  {
    id: 'paid_saas_subscription',
    title: 'Paid SaaS / Monthly Intelligence',
    short_label: 'Paid SaaS',
    plain_english_summary: 'Individuals, agents, leaders, and businesses pay recurring revenue for ongoing intelligence and adaptive strategy support.',
    strategic_thesis: 'Individual agents, leaders, and businesses pay recurring revenue for ongoing intelligence, adaptive strategy, and recursive coaching.',
    value_creation_mechanism: 'Recurring access, retention, and monthly intelligence loops can turn one-time insight into durable subscription revenue.',
    why_it_could_work: 'The product now has one-time assessments, strategy drafts, translator support, and early recursive coaching architecture that can support a paid monthly promise.',
    key_evidence_to_watch: [
      'Paid subscription checkout completions',
      'Monthly retention or renewal behavior',
      'Users returning to update One Move and evidence',
      'Users valuing updated strategy drafts over one-time reports'
    ],
    current_evidence_signals: [
      'MORE Monthly Intelligence product ladder is defined',
      'Checkout and webhook foundation exists, but controlled payment proof remains separate'
    ],
    missing_evidence: [
      'Durable subscription usage behavior',
      'Retention evidence',
      'Clear recurring willingness to pay'
    ],
    risks: [
      'Recurring promise can outrun actual monthly behavior',
      'One-time insight may not automatically create subscription retention'
    ],
    anti_overclaim_warning: 'Subscription architecture is not proof of recurring revenue or retention.',
    what_would_strengthen_this_path: [
      'Users complete paid monthly checkout and return to use the loop',
      'Monthly users record evidence and request updated strategy drafts',
      'Retention signals appear after the first renewal window'
    ],
    what_would_weaken_this_path: [
      'Users prefer one-time reports without returning',
      'Monthly usage is too low to support recurring value',
      'Churn appears before evidence loops become useful'
    ],
    related_existing_signals: ['customer_revenue', 'product_usage', 'assessment_volume', 'profile_volume'],
    default_status: 'emerging'
  },
  {
    id: 'rrg_revenue_recovery',
    title: 'Revenue Recovery Group / Dormant Database Activation',
    short_label: 'RRG Recovery',
    plain_english_summary: 'RRG turns unused databases into active revenue opportunities for agents, teams, brokerages, and lenders.',
    strategic_thesis: 'RRG turns unused databases into active revenue opportunities for agents, teams, brokerages, and lenders.',
    value_creation_mechanism: 'Recovered opportunities can create measurable business value from lists and relationships that already exist.',
    why_it_could_work: 'Real estate and mortgage databases often contain dormant opportunity; MORE can identify the owner/operator behavior while RRG activates revenue follow-up.',
    key_evidence_to_watch: [
      'Named dormant database available for pilot',
      'Recovered conversations or appointments',
      'Funded loans, referrals, or closed business tied to recovery',
      'Repeatable RRG workflow attached to profile or assessment intelligence'
    ],
    current_evidence_signals: [
      'RRG opportunity exists as an Outcome Ledger signal type',
      'Dashboard truth boundaries already separate RRG readiness from live runtime'
    ],
    missing_evidence: [
      'Tracked RRG opportunity outcomes',
      'Recovered revenue records',
      'Repeatable database activation workflow in production'
    ],
    risks: [
      'RRG can be discussed as ready before outcome tracking exists',
      'Database access does not guarantee recovered revenue'
    ],
    anti_overclaim_warning: 'RRG opportunity is not recovered revenue until outcomes are tracked.',
    what_would_strengthen_this_path: [
      'A pilot database produces measurable recovered opportunities',
      'Recovered appointments or revenue are source-labeled',
      'RRG workflow can repeat across teams or lenders'
    ],
    what_would_weaken_this_path: [
      'Database owners do not grant usable access',
      'Recovered conversations do not become business outcomes',
      'Operational work is too manual to scale'
    ],
    related_existing_signals: ['RRG_opportunity', 'customer_revenue', 'funded_pilot', 'partner_signal'],
    default_status: 'watch'
  },
  {
    id: 'mortgage_company_infrastructure',
    title: 'Mortgage Company Growth Infrastructure',
    short_label: 'Mortgage Infrastructure',
    plain_english_summary: 'Mortgage companies use MORE MindMap and RRG to create agent value, recover loans, improve retention, and drive more funded volume.',
    strategic_thesis: 'Mortgage companies use MORE MindMap + RRG to create agent value, recover loans, improve retention, and drive more funded volume.',
    value_creation_mechanism: 'B2B infrastructure value can come from funded volume, agent relationships, lender retention, and measurable business development support.',
    why_it_could_work: 'Mortgage companies need differentiated agent value and funded volume; MORE can become a practical intelligence layer around agent behavior and opportunity recovery.',
    key_evidence_to_watch: [
      'Mortgage company pilot interest',
      'Funded pilot commitment',
      'Loan volume or referral movement tied to MORE/RRG',
      'Lender leadership requests repeatable dashboard visibility'
    ],
    current_evidence_signals: [
      'Mortgage and funded pilot concepts are already part of current strategic language'
    ],
    missing_evidence: [
      'Named mortgage company implementation',
      'Funded volume attribution',
      'Retention or recruiting impact for loan officers'
    ],
    risks: [
      'Mortgage interest can be mistaken for funded adoption',
      'Long enterprise cycles can slow proof'
    ],
    anti_overclaim_warning: 'Mortgage company interest is not funded volume or enterprise adoption.',
    what_would_strengthen_this_path: [
      'A lender funds a pilot',
      'A lender uses MORE/RRG to create measurable agent or funded-volume outcomes',
      'Leadership asks for recurring intelligence access'
    ],
    what_would_weaken_this_path: [
      'Lender conversations stall before pilot',
      'No funded volume or adoption signal appears',
      'Implementation requires too much custom service'
    ],
    related_existing_signals: ['funded_pilot', 'partner_capital', 'RRG_opportunity', 'customer_revenue'],
    default_status: 'watch'
  },
  {
    id: 'brokerage_recruiting_retention',
    title: 'Brokerage Recruiting + Retention Intelligence',
    short_label: 'Brokerage Intelligence',
    plain_english_summary: 'Brokerages use MORE MindMap to increase agent productivity, retention, recruiting conversion, and leadership visibility.',
    strategic_thesis: 'Brokerages use MORE MindMap to increase agent productivity, retention, recruiting conversion, and leadership visibility.',
    value_creation_mechanism: 'Brokerages may pay for intelligence that helps leaders understand agents, recruit better, retain producers, and improve productivity.',
    why_it_could_work: 'Agent behavior, recruiting fit, leadership visibility, and business diagnostics are natural MORE MindMap use cases.',
    key_evidence_to_watch: [
      'Brokerage leader pilot',
      'Recruiting or retention use case requested',
      'Agent productivity or engagement signal',
      'Repeatable team or brokerage dashboard need'
    ],
    current_evidence_signals: [
      'Recruiting and retention signal types exist in the Outcome Ledger vocabulary'
    ],
    missing_evidence: [
      'Brokerage buyer commitment',
      'Recruiting conversion evidence',
      'Retention or productivity outcome tracking'
    ],
    risks: [
      'Recruiting language can become broad without measurable conversion',
      'Brokerage budgets and decision cycles may be slower than individual assessment sales'
    ],
    anti_overclaim_warning: 'Recruiting intelligence is not proven until it improves recruiting, retention, or productivity outcomes.',
    what_would_strengthen_this_path: [
      'A brokerage uses MORE in recruiting or retention workflow',
      'Leader-facing dashboard usage emerges',
      'Measured recruiting or retention outcomes are recorded'
    ],
    what_would_weaken_this_path: [
      'Brokerages like the concept but do not integrate it',
      'No measurable recruiting or retention signal appears',
      'Agent-level sales outperform brokerage buying motion'
    ],
    related_existing_signals: ['recruiting_signal', 'retention_signal', 'assessment_volume', 'profile_volume'],
    default_status: 'watch'
  },
  {
    id: 'leadership_intelligence_lde',
    title: 'Leadership Intelligence / LDE Runtime',
    short_label: 'Leadership Runtime',
    plain_english_summary: 'MORE becomes a leadership intelligence engine that monitors signals, updates strategy, and helps organizations reason about future outcomes.',
    strategic_thesis: 'MORE becomes a leadership intelligence engine that monitors signals, updates strategy, and helps organizations predict future outcomes.',
    value_creation_mechanism: 'Higher enterprise value could come from becoming durable intelligence infrastructure rather than a static assessment product.',
    why_it_could_work: 'Darren already has a recursive internal proof lab with strategy memory, evidence gates, chat summaries, and adaptive drafts.',
    key_evidence_to_watch: [
      'Repeated use of recursive dashboard loops',
      'Evidence that leaders want ongoing adaptive strategy',
      'Team or company-level leadership intelligence demand',
      'Safe review workflows that improve decisions without overclaiming'
    ],
    current_evidence_signals: [
      'Darren recursive dashboard is live as an internal proof lab',
      'Adaptive Strategy Draft v0 is pending-review and non-replacing'
    ],
    missing_evidence: [
      'External leadership runtime customers',
      'Validated organizational use case',
      'Measurable decision improvement'
    ],
    risks: [
      'Runtime language can outrun actual customer adoption',
      'Leadership intelligence can sound bigger than the current V1 evidence'
    ],
    anti_overclaim_warning: 'LDE runtime is a strategic direction, not proof that future outcomes are validated.',
    what_would_strengthen_this_path: [
      'Leaders use recursive reviews repeatedly',
      'Adaptive drafts improve decision quality after human review',
      'Organizations ask for team or company-level intelligence'
    ],
    what_would_weaken_this_path: [
      'Users only want one-time outputs',
      'Recursive review does not change decisions',
      'Teams do not adopt ongoing intelligence workflows'
    ],
    related_existing_signals: ['product_usage', 'assessment_volume', 'profile_volume', 'customer_revenue'],
    default_status: 'emerging'
  },
  {
    id: 'enterprise_platform',
    title: 'Enterprise Platform / Organizational Intelligence Layer',
    short_label: 'Enterprise Platform',
    plain_english_summary: 'MORE expands beyond real estate into an organizational intelligence layer for companies, teams, and leadership systems.',
    strategic_thesis: 'MORE expands beyond real estate into an organizational intelligence layer for companies, teams, and leadership systems.',
    value_creation_mechanism: 'Enterprise platform value can come from broader markets, durable organizational data, team intelligence, and workflow integration.',
    why_it_could_work: 'The ontology can apply beyond real estate if the product proves it can translate behavior and business signals into practical leadership action.',
    key_evidence_to_watch: [
      'Non-real-estate buyer interest',
      'Team or company assessment demand',
      'Repeatable organizational intelligence workflow',
      'Cross-vertical use case with measurable value'
    ],
    current_evidence_signals: [
      'Cross-vertical expansion exists as a truth-boundaried hypothesis'
    ],
    missing_evidence: [
      'Non-real-estate paid adoption',
      'Enterprise buyer validation',
      'Organizational workflow integration'
    ],
    risks: [
      'Cross-vertical expansion can dilute focus before real estate proof is strong',
      'Enterprise claims can sound bigger than the evidence'
    ],
    anti_overclaim_warning: 'Cross-vertical platform expansion is a hypothesis until evidenced by buyers and use.',
    what_would_strengthen_this_path: [
      'A non-real-estate team pays or pilots',
      'Organizational workflows need repeated MORE intelligence',
      'A buyer asks for company-level integration'
    ],
    what_would_weaken_this_path: [
      'Real estate-specific language does not transfer',
      'Enterprise buyers do not see recurring value',
      'Implementation complexity exceeds current product maturity'
    ],
    related_existing_signals: ['funded_pilot', 'customer_revenue', 'product_usage', 'other'],
    default_status: 'under-evidenced'
  },
  {
    id: 'partner_capital_strategic_funding',
    title: 'Partner Capital / Strategic Funding Path',
    short_label: 'Partner Capital',
    plain_english_summary: 'Strategic investors, mortgage companies, brokerages, or platform partners fund growth because MORE becomes infrastructure they need.',
    strategic_thesis: 'Strategic investors, mortgage companies, brokerages, or platform partners fund growth because MORE becomes infrastructure they need.',
    value_creation_mechanism: 'Capital could accelerate product, distribution, and enterprise proof if the partner has a strategic reason to fund the platform.',
    why_it_could_work: 'If MORE creates infrastructure value for a partner, funding could become a strategic growth lever rather than generic fundraising.',
    key_evidence_to_watch: [
      'Named strategic funder interest',
      'Funding tied to a specific pilot or distribution path',
      'Partner diligence requests based on real product evidence',
      'Capital conversation converts into commitment'
    ],
    current_evidence_signals: [
      'Partner capital is a recognized signal type',
      'Generated strategy already separates interest from funding'
    ],
    missing_evidence: [
      'Signed funding commitment',
      'Capital tied to measurable implementation',
      'Evidence that funding partner needs MORE as infrastructure'
    ],
    risks: [
      'Funding conversations can be mistaken for capital',
      'Capital can distract from customer proof'
    ],
    anti_overclaim_warning: 'Funding interest is not funding. Strategic capital is not revenue until closed and recorded.',
    what_would_strengthen_this_path: [
      'A strategic partner commits funds or pilot resources',
      'Funding is tied to named distribution or implementation',
      'Diligence focuses on real usage and revenue evidence'
    ],
    what_would_weaken_this_path: [
      'Conversations remain exploratory',
      'No partner ties capital to operating milestones',
      'Customer revenue grows faster than funding interest'
    ],
    related_existing_signals: ['partner_capital', 'funding_signal', 'funded_pilot', 'partner_signal'],
    default_status: 'watch'
  },
  {
    id: 'hybrid_ecosystem',
    title: 'Hybrid Ecosystem / Multi-Sided Intelligence Network',
    short_label: 'Hybrid Ecosystem',
    plain_english_summary: 'The highest-value path may combine subscriptions, RRG, channel partners, lender or brokerage infrastructure, and LDE into one ecosystem.',
    strategic_thesis: 'The highest-value path may combine subscriptions, RRG, channel partners, lender/brokerage infrastructure, and LDE into one ecosystem.',
    value_creation_mechanism: 'Multiple reinforcing revenue and data loops could create a broader intelligence network than any single path alone.',
    why_it_could_work: 'The current roadmap already connects profiles, assessments, monthly intelligence, partner proof, RRG, and leadership runtime concepts.',
    key_evidence_to_watch: [
      'Two or more paths create reinforcing demand',
      'Channel activity drives subscriptions or RRG outcomes',
      'RRG or assessments create leadership intelligence demand',
      'Partners want both distribution and intelligence infrastructure'
    ],
    current_evidence_signals: [
      'Multiple path concepts are present in the dashboard',
      'The current system can keep separate evidence labels'
    ],
    missing_evidence: [
      'Evidence that paths reinforce each other',
      'Clear sequencing that avoids diluted execution',
      'Revenue or adoption across more than one path'
    ],
    risks: [
      'Hybrid strategy can become too broad',
      'Optionality can become lack of focus if no path gets proof targets'
    ],
    anti_overclaim_warning: 'A hybrid ecosystem is not proven because multiple ideas exist. It needs reinforcing evidence across paths.',
    what_would_strengthen_this_path: [
      'One channel produces paid subscriptions and RRG opportunities',
      'One buyer segment asks for multiple MORE components',
      'Evidence shows paths compound rather than compete'
    ],
    what_would_weaken_this_path: [
      'Each path requires separate execution and does not reinforce the others',
      'The team cannot focus enough to generate proof',
      'A single path clearly outperforms the rest'
    ],
    related_existing_signals: ['channel_distribution', 'customer_revenue', 'RRG_opportunity', 'product_usage', 'funded_pilot'],
    default_status: 'emerging'
  }
]

function normalizeText(value) {
  return String(value || '').toLowerCase()
}

function stringifySafe(value) {
  try {
    return normalizeText(JSON.stringify(value || {}))
  } catch {
    return ''
  }
}

function normalizeStatus(value) {
  return PATH_STATUSES.has(value) ? value : 'watch'
}

function signalLabel(signal) {
  return String(signal || '').replace(/_/g, ' ')
}

function hasTextMatch(corpus, values) {
  return values.some((value) => corpus.includes(normalizeText(value)))
}

export function evaluateDarrenBusinessModelPathCoverage({ snapshot, generatedStrategy } = {}) {
  const corpus = [
    stringifySafe(snapshot?.path_comparison),
    stringifySafe(snapshot?.next_proof_targets),
    stringifySafe(snapshot?.evidence_gaps),
    stringifySafe(snapshot?.build_map_context),
    stringifySafe(generatedStrategy?.five_futures),
    stringifySafe(generatedStrategy?.one_move),
    stringifySafe(generatedStrategy?.truth_boundaries)
  ].join(' ')

  const coverage = darrenBusinessModelBackbone.map((path) => {
    const signalHits = path.related_existing_signals.filter((signal) => corpus.includes(normalizeText(signal)) || corpus.includes(normalizeText(signalLabel(signal))))
    const thesisHit = hasTextMatch(corpus, [path.short_label, path.title, path.id])
    const status = normalizeStatus(thesisHit || signalHits.length ? path.default_status : 'under-evidenced')

    return {
      id: path.id,
      title: path.title,
      short_label: path.short_label,
      status_band: status,
      evidence_hits: signalHits.map(signalLabel),
      missing_evidence_hits: path.missing_evidence.slice(0, 3),
      recommended_next_evidence_to_collect: path.key_evidence_to_watch.slice(0, 2),
      bias_warning: path.id === 'channel_growth'
        ? 'This is not an anti-channel warning. Current evidence may support Channel Growth, but the dashboard should keep the full strategic field visible until evidence justifies dominance.'
        : ''
    }
  })

  const channelPath = coverage.find((path) => path.id === 'channel_growth')
  const currentFavoredPath = channelPath?.status_band === 'supported' || channelPath?.status_band === 'favored'
    ? channelPath
    : coverage.find((path) => path.status_band === 'supported' || path.status_band === 'emerging') || null

  return {
    current_favored_path: currentFavoredPath,
    channel_bias_guardrail: channelPath
      ? 'Channel Growth is a valid path, not a final destiny. If Darren chooses it, the system should help him execute it seriously while still tracking alternative paths.'
      : '',
    paths: coverage
  }
}
