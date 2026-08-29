import { getSyntheticRealEstateSubjectV1 } from '../../lab/subscriptionLivingBusinessRelationshipV1/createSyntheticRealEstateFounderSubjectsV1.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

function evidence(id, title, statement, { source, sourceDate = '2026-08-23', truthClass = 'SYNTHETIC_REPORTED', confidence = 'KNOWN' }) {
  return Object.freeze({ id, title, statement, source, sourceDate, truthClass, confidence, syntheticOnly: true });
}

function object(id, kind, title, detail) {
  return Object.freeze({ id, kind, title, ...detail });
}

export function createRecruitingV2SyntheticWorld() {
  const jordan = getSyntheticRealEstateSubjectV1('re-mid');
  const evidenceSources = [
    evidence('ev-production-ledger', 'Synthetic production ledger', 'Quarterly closed-volume and closing-count history for Jordan Lee Residential.', { source: '003A governed synthetic broker ledger' }),
    evidence('ev-jordan-ba', 'Jordan synthetic Business Twin', jordan.businessReality, { source: 'Current synthetic Jordan New BA authority' }),
    evidence('ev-jordan-bos', 'Jordan synthetic BOS', `${jordan.wholePerson.communication} ${jordan.wholePerson.motivation}`, { source: 'Current synthetic Jordan BOS authority' }),
    evidence('ev-darren-bos', 'Darren synthetic BOS', 'Darren is direct, candid, fast to synthesize, and most useful when he leaves room for Jordan to test the reasoning.', { source: 'Current Recruiting synthetic manager authority' }),
    evidence('ev-pipeline-report', 'Jordan pipeline report', 'Ten opportunities are described as active, but stage definitions are inconsistent and the pipeline is not reconciled.', { source: 'Synthetic Jordan fixture' }),
    evidence('ev-time-report', 'Jordan time estimate', 'Jordan estimates about 13 weekly hours on coordination, scheduling, paperwork, and CRM cleanup.', { source: 'Synthetic Jordan fixture' }),
    evidence('ev-referral-report', 'Referral source estimate', 'Referrals are believed to have produced about 58% of recent closings.', { source: 'Synthetic Jordan fixture', confidence: 'REPORTED_ESTIMATE' }),
    evidence('ev-week-trial', 'Five-day observation', jordan.weekly.outcome, { source: '003A governed synthetic session observation', sourceDate: '2026-08-27' }),
    evidence('ev-local-review', 'Local opportunity: evidence review', 'A structured opportunity-and-capacity evidence review is available in this synthetic scenario.', { source: 'Synthetic Local Opportunity authority', truthClass: 'SYNTHETIC_LOCAL_OPPORTUNITY' }),
    evidence('ev-local-leverage', 'Local opportunity: leverage review', 'A bounded first-leverage decision review is conditionally available after opportunity, economics, and transferable-work evidence support it.', { source: 'Synthetic Local Opportunity authority', truthClass: 'SYNTHETIC_LOCAL_OPPORTUNITY', confidence: 'CONDITIONAL' }),
    evidence('ev-local-no-leads', 'Local non-promise', 'No company-provided lead volume, allocation, or conversion outcome is established.', { source: 'Synthetic Local Opportunity authority', truthClass: 'SYNTHETIC_NON_PROMISE' }),
    evidence('ev-economics-gap', 'Economics evidence gap', 'Gross commission, expenses, margin, role cost, and capacity release are not reconciled enough to justify a hire.', { source: 'Current synthetic Jordan New BA missingness', truthClass: 'MISSING', confidence: 'OPEN' }),
  ];

  const objects = [
    object('obj-volume-history', 'TIME_SERIES', 'Closed production over time', {
      unit: '$M',
      series: [
        { label: 'Q3 2024', value: 0.84 }, { label: 'Q4 2024', value: 0.96 },
        { label: 'Q1 2025', value: 1.12 }, { label: 'Q2 2025', value: 1.28 },
        { label: 'Q3 2025', value: 1.42 }, { label: 'Q4 2025', value: 1.51 },
        { label: 'Q1 2026', value: 1.29 }, { label: 'Q2 2026', value: 0.98 },
      ],
      summary: '$5.2M across the latest four evidenced quarters, with two consecutive quarterly declines after a Q4 peak.',
      sourceIds: ['ev-production-ledger'], truthClass: 'SYNTHETIC_REPORTED',
    }),
    object('obj-closings-history', 'TIME_SERIES', 'Closings over time', {
      unit: 'closings', series: [
        { label: 'Q3 2024', value: 2 }, { label: 'Q4 2024', value: 3 },
        { label: 'Q1 2025', value: 3 }, { label: 'Q2 2025', value: 3 },
        { label: 'Q3 2025', value: 4 }, { label: 'Q4 2025', value: 4 },
        { label: 'Q1 2026', value: 3 }, { label: 'Q2 2026', value: 2 },
      ],
      summary: 'Thirteen closings across the latest four evidenced quarters.', sourceIds: ['ev-production-ledger'], truthClass: 'SYNTHETIC_REPORTED',
    }),
    object('obj-current-metrics', 'METRICS', 'Current business signals', {
      items: [
        { label: 'Trailing volume', value: '$5.2M', note: '13 closings' },
        { label: 'Combined contacts', value: '~820', note: 'reported estimate' },
        { label: 'Active opportunities', value: '10', note: 'not reconciled' },
        { label: 'Admin load', value: '13 hrs', note: 'estimated weekly' },
      ], sourceIds: ['ev-production-ledger', 'ev-pipeline-report', 'ev-time-report'], truthClass: 'MIXED_REPORTED',
    }),
    object('obj-opportunity-funnel', 'FUNNEL', 'Relationship-to-opportunity visibility', {
      stages: [
        { label: 'Combined contacts', value: 820, status: 'ESTIMATED' },
        { label: 'Qualified relationships', value: null, status: 'MISSING' },
        { label: 'Active opportunities', value: 10, status: 'UNRECONCILED' },
        { label: 'Trailing closings', value: 13, status: 'REPORTED' },
      ], sourceIds: ['ev-pipeline-report', 'ev-referral-report', 'ev-production-ledger'], truthClass: 'MIXED_WITH_MISSINGNESS',
    }),
    object('obj-time-capacity', 'COMPARISON', 'What Jordan’s week may be carrying', {
      items: [
        { label: 'Coordination / scheduling / paperwork', value: 13, unit: 'estimated hrs/week' },
        { label: 'CRM cleanup / rework in observed week', value: 3, unit: 'hrs' },
        { label: 'Coordination in observed week', value: 11.5, unit: 'hrs' },
      ], sourceIds: ['ev-time-report', 'ev-week-trial'], truthClass: 'REPORTED_AND_OBSERVED_SYNTHETIC',
    }),
    object('obj-business-twin', 'BUSINESS_TWIN', 'Jordan’s current business reality', {
      statement: jordan.businessReality, goal: jordan.goal, constraint: jordan.constraint,
      mechanisms: jordan.mechanisms, sourceIds: ['ev-jordan-ba'], truthClass: 'GOVERNED_SYNTHETIC_HYPOTHESIS',
    }),
    object('obj-five-futures', 'FUTURES', 'Five conditional trajectories', {
      items: ['Current Course', 'Emerging Future', 'Better Future', 'Bold Future', 'Downside Future'].map((label, index) => ({ label, support: jordan.futures[index], meaning: jordan.futureMeanings[index] })),
      semantics: 'Relative support across conditional trajectories, not calibrated probability or destiny.', sourceIds: ['ev-jordan-ba'], truthClass: 'SYNTHETIC_MODELED',
    }),
    object('obj-jordan-person', 'PERSON', 'Jordan', {
      role: 'Candidate and business owner', summary: jordan.wholePerson.communication, motivation: jordan.wholePerson.motivation,
      caution: 'Working style may guide the meeting; it does not prove business causation.', sourceIds: ['ev-jordan-bos'], truthClass: 'SYNTHETIC_BOS',
    }),
    object('obj-darren-person', 'PERSON', 'Darren', {
      role: 'Recruiter and local leader', summary: 'Direct, candid, and fast to synthesize.', motivation: 'Help Jordan see a useful decision without manufacturing fit.',
      caution: 'Darren should leave room for Jordan to test the reasoning.', sourceIds: ['ev-darren-bos'], truthClass: 'SYNTHETIC_BOS',
    }),
    object('obj-relationship', 'RELATIONSHIP', 'Could working together improve Jordan’s business and life?', {
      people: ['Darren', 'Jordan'], status: 'UNRESOLVED',
      statement: 'Fit exists only if a supported Jordan gap and a durable local capability meet—and the two humans want the resulting relationship.',
      sourceIds: ['ev-jordan-ba', 'ev-darren-bos', 'ev-local-review', 'ev-local-leverage'], truthClass: 'SESSION_QUESTION',
    }),
    object('obj-gap-evidence', 'EVIDENCE_GAP', 'The decision is under-evidenced', {
      missing: jordan.missing, counterevidence: jordan.counterevidence, mindChange: jordan.falsifier,
      sourceIds: ['ev-jordan-ba', 'ev-economics-gap'], truthClass: 'GOVERNED_MISSINGNESS',
    }),
    object('obj-local-capabilities', 'LOCAL_OPPORTUNITY', 'What is actually supported locally', {
      items: [
        { label: 'Opportunity-and-capacity evidence review', status: 'SUPPORTED', evidenceId: 'ev-local-review' },
        { label: 'First-leverage decision review', status: 'CONDITIONAL', evidenceId: 'ev-local-leverage' },
        { label: 'Company-provided lead outcome', status: 'NOT_SUPPORTED', evidenceId: 'ev-local-no-leads' },
      ], sourceIds: ['ev-local-review', 'ev-local-leverage', 'ev-local-no-leads'], truthClass: 'SYNTHETIC_LOCAL_OPPORTUNITY',
    }),
    object('obj-economic-scenario', 'SCENARIO', 'First-leverage decision range', {
      assumptions: [
        { id: 'assistantMonthlyCost', label: 'Monthly fully loaded assistant cost', value: 4200, min: 2800, max: 6500, step: 100, unit: '$' },
        { id: 'releasedHours', label: 'Productive hours released each week', value: 8, min: 0, max: 15, step: 1, unit: 'hrs' },
        { id: 'valuePerReleasedHour', label: 'Contribution per released hour', value: 140, min: 50, max: 250, step: 10, unit: '$' },
      ],
      formula: '(released hours × 4.33 × contribution per hour) − monthly cost', horizon: 'monthly directional range',
      warning: 'A decision aid, not a forecast. Margin and capacity inputs remain synthetic and incomplete.',
      sourceIds: ['ev-time-report', 'ev-economics-gap', 'ev-local-leverage'], truthClass: 'SYNTHETIC_MODELED_WITH_ASSUMPTIONS',
    }),
    object('obj-first-move', 'INTERVENTION', 'Four-week opportunity-and-capacity baseline', {
      statement: jordan.intervention, proof: jordan.proof, sourceIds: ['ev-jordan-ba', 'ev-local-review'], truthClass: 'GOVERNED_SYNTHETIC_RECOMMENDATION',
    }),
    object('obj-week-observation', 'TIMELINE', 'What happened in the first observed week', {
      items: [
        { label: 'Mon–Fri', title: 'All five days tracked', detail: '17 qualified conversations and four appointments.' },
        { label: 'During week', title: 'Two clients signed', detail: 'Some opportunity conversion is already present.' },
        { label: 'During week', title: '14.5 hours visible', detail: '11.5 coordination hours plus 3 hours of CRM/rework.' },
        { label: 'After issue', title: 'One follow-up block missed', detail: 'A client issue displaced planned opportunity work.' },
      ], sourceIds: ['ev-week-trial'], truthClass: 'SYNTHETIC_OBSERVED',
    }),
  ];

  return Object.freeze({
    contract: 'recruiting_v2_relationship_read_projection_003a_v1',
    worldId: 'synthetic-darren-jordan-recruiting-v2-003a',
    version: '003a-world-1.0.0',
    asOf: '2026-08-27T00:00:00.000Z',
    syntheticOnly: true,
    relationship: { id: 'rel-synthetic-darren-jordan-v2', recruiter: 'Darren', candidate: 'Jordan', consent: 'CO_PRESENT_SYNTHETIC_EXPERIMENT', status: 'ACTIVE_FOR_REVIEW' },
    authority: {
      canonicalReads: 'Referenced, not copied or promoted',
      localOpportunity: 'Enterprise evidence cannot create a candidate gap',
      sessionAssertions: 'Session-only unless separately authorized for projection',
      modelOutput: 'Revisable hypothesis, never canonical truth',
      mutations: 'Local synthetic session events only',
    },
    people: { darren: { name: 'Darren', role: 'Recruiter' }, jordan: { name: 'Jordan', role: 'Candidate' }, more: { name: 'MORE', role: 'Intelligent third participant' } },
    evidence: evidenceSources,
    objects,
    baselineInvariants: {
      realCustomerData: false, realInvitation: false, emailOrMessage: false, entitlementEffect: false,
      canonicalMutation: false, localOpportunityMutation: false, productionAudit: false, externalMutation: false,
    },
  });
}

export function cloneRecruitingV2World() {
  return clone(createRecruitingV2SyntheticWorld());
}
