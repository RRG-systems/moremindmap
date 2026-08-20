import { resolveGoalRelativeGoverningFork } from '../../lib/baV2IntelligenceRuntime/diagnosticLenses.js'
import { buildRealEstateGoalBacksolveModel } from '../../lib/baV2IntelligenceRuntime/numericalIntelligence.js'

function invariant(condition, code) {
  if (!condition) {
    const error = new Error(code)
    error.name = 'BaV2GeneralizationIntegrityError'
    error.code = code
    throw error
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  Object.values(value).forEach(deepFreeze)
  return value
}

const NAV = [
  ['now', 'NOW', 'See your business'],
  ['why', 'WHY', 'Understand what’s driving it'],
  ['futures', 'FUTURES', 'Explore possible paths'],
  ['move', 'MOVE', 'Take the right action'],
  ['plan', 'PLAN / EXECUTION', 'Execute purposefully'],
  ['evidence', 'EVIDENCE', 'See why you can trust it'],
].map(([id, label, description], index) => ({ id, label, description, order: index + 1 }))

const ENGINE_META = [
  ['relationships', 'REL', 'Relationship Asset', 'green'],
  ['conversations', 'CONV', 'Conversations & Demand', 'blue'],
  ['pipeline', 'PIPE', 'Pipeline & Conversion', 'teal'],
  ['systems', 'SYS', 'Systems & Tools', 'violet'],
  ['execution', 'EXEC', 'Execution & Accountability', 'gold'],
  ['economics', 'ECON', 'Economics', 'amber'],
  ['capacity', 'CAP', 'Team & Capacity', 'coral'],
  ['goals', 'GOAL', 'Direction & Goals', 'indigo'],
]

const CLASS_LABELS = {
  OBSERVED_REPORTED: 'Current / reported',
  DETERMINISTICALLY_DERIVED: 'Calculated from your stated business information',
  MODELED_REQUIREMENT: 'Goal-supporting target',
  COACHING_STANDARD: 'Coaching benchmark',
  MODELED_RANGE: 'Scenario / modeled range',
  UNKNOWN_MISSING: 'Not yet known',
}

const PROFILES = deepFreeze({
  mid: {
    proofId: 'synthetic-real-estate-mid-v1',
    name: 'Elena',
    business: 'Elena’s Real Estate Business',
    stage: 'MID',
    model: 'Referral-led solo business',
    system: 'Partially systemized',
    goalLabel: '3 closings / month',
    direction: ['Plateauing', 'Demand exists; conversion discipline is inconsistent'],
    evidence: {
      monthlyClosingGoal: 3, combinedSoiContacts: 740, attributedShareEstimate: 0.82, believedTopOfMind: 175,
      relationshipAssetTarget: 650, relationshipSourceShare: 0.72, liveContactFloor: 6, liveContactBenchmark: 18,
      current: { liveContactsPerDay: 9, qualifiedAddsPerDay: 1, appointmentsPerWeek: 6, activeListings: 4, activeBuyers: 7, activePipeline: 11, stageConversion: '18%' },
      annualClosings: 22, volume: '$10.8M', repeatReferral: '58%', responseTime: '1–3 days', grossRevenue: '$286K', operatingMargin: 'Unknown', team: 'TC + part-time assistant', ownerLoad: '74%', databaseState: 'Tagged; next actions inconsistent', goalHorizon: '12 months', directObservation: 0,
    },
    forkSignals: {
      goal: { state: 'SUPPORTED', evidence_refs: ['mid-goal'] },
      opportunity_flow: { state: 'SUFFICIENT', evidence_refs: ['mid-pipeline', 'mid-appointments'] },
      conversion: { state: 'CONSTRAINED', evidence_refs: ['mid-stage-conversion'] },
      capacity: { state: 'SUPPORTED', evidence_refs: ['mid-capacity'] },
      operator_problem_label: { state: 'SUPPORTED', evidence_refs: ['mid-report'] },
    },
    helping: ['A substantial referral base already exists', 'Six weekly appointments show real opportunity flow', 'A transaction coordinator protects closing work'],
    holding: ['Follow-up service levels are inconsistent', 'Stage conversion is not inspected by source', 'Owner intervention masks process failure'],
    bos: ['Use a short visible review with decisions captured in the system.', 'Separate setup from daily execution so the owner is not redesigning while inspecting.', 'Make exceptions explicit; do not rely on memory or informal rescue.'],
  },
  top: {
    proofId: 'synthetic-real-estate-top-v1',
    name: 'Marcus',
    business: 'Marcus’s Real Estate Group',
    stage: 'TOP',
    model: 'Team-led multi-source business',
    system: 'Scaled production; leader bottleneck',
    goalLabel: '10 closings / month',
    direction: ['Growing with strain', 'Opportunity is sufficient; leadership capacity is the constraint'],
    evidence: {
      monthlyClosingGoal: 10, combinedSoiContacts: 2800, attributedShareEstimate: 0.59, believedTopOfMind: 720,
      relationshipAssetTarget: 1800, relationshipSourceShare: 0.35, liveContactFloor: 8, liveContactBenchmark: 24,
      current: { liveContactsPerDay: 13, qualifiedAddsPerDay: 4, appointmentsPerWeek: 24, activeListings: 19, activeBuyers: 29, activePipeline: 48, stageConversion: '31%' },
      annualClosings: 86, volume: '$72M', repeatReferral: '41%', responseTime: '< 20 minutes', grossRevenue: '$1.94M', operatingMargin: '14%', team: '7 team members', ownerLoad: '62% approvals', databaseState: 'Segmented and actively worked', goalHorizon: '18 months', directObservation: 0,
    },
    forkSignals: {
      goal: { state: 'SUPPORTED', evidence_refs: ['top-goal'] },
      opportunity_flow: { state: 'SUFFICIENT', evidence_refs: ['top-pipeline', 'top-appointments'] },
      conversion: { state: 'SUPPORTED', evidence_refs: ['top-stage-conversion'] },
      capacity: { state: 'CONSTRAINED', evidence_refs: ['top-owner-approvals', 'top-team'] },
      operator_problem_label: { state: 'SUPPORTED', evidence_refs: ['top-report'] },
    },
    helping: ['Opportunity and active pipeline are sufficient for the current goal', 'The business has a seven-person operating base', 'Source segmentation and response speed are already strong'],
    holding: ['Routine decisions still escalate to Marcus', 'Manager authority stops short of outcomes', 'Leadership interruption hides the true capacity ceiling'],
    bos: ['Protect a clear decision boundary so delegation does not become constant consultation.', 'Review exceptions in a scheduled block rather than interrupt-driven escalation.', 'Use evidence to distinguish confidence friction from seat-capability limits.'],
  },
})

// These are cassette-level diagnostic plays selected from the governed fork.
// They are reusable for any Real Estate subject whose evidence reaches the same fork;
// customer identity never participates in the selection.
const DIAGNOSTIC_PLAYS = deepFreeze({
  SUFFICIENT_OPPORTUNITY_INVESTIGATE_CONVERSION: {
    constraint: {
      title: 'Conversion inspection gap',
      summary: 'Opportunity enters the business, but source-to-stage follow-up is not inspected consistently enough to show where demand converts or leaks.',
      stronger: 'The relationship base and appointment activity argue against a simple “more leads” diagnosis. The sharper issue is an ungoverned conversion path.',
      chain: ['Relationship access is meaningful', 'Follow-up timing varies', 'Stages are not inspected', 'Conversion stays opaque', 'Goal gap persists'],
      effects: ['Lead-source ambiguity', 'Slow follow-up', 'Uncertain pipeline quality', 'Uneven monthly closings', 'Owner rework', 'Hiring decisions lack evidence'],
      mechanisms: ['Source attribution fades after intake', 'Next actions age without a shared service level', 'Pipeline stages carry inconsistent definitions', 'Review cadence examines outcomes after the fact', 'Owner rescues high-stakes follow-up', 'Economics cannot be compared by source'],
      alternatives: ['Demand volume may still be insufficient in some months.', 'Market mix or offer quality may depress conversion independently.'],
      mindChange: 'A clean eight-week source-to-stage record showing timely follow-up and healthy conversion would move the diagnosis toward opportunity creation or offer-market fit.',
    },
    futures: [
      ['current_course', 24, 'Busy plateau', 'If follow-up and stage inspection remain inconsistent, activity can stay high while monthly output remains uneven.'],
      ['emerging_future', 19, 'Cleaner conversion signals', 'If stages and response standards become consistent, the business can learn where demand is actually leaking.'],
      ['better_future', 31, 'Repeatable conversion engine', 'If one source-to-stage system becomes habitual, the existing relationship asset can produce more reliable opportunity.'],
      ['bold_future', 14, 'Specialized growth lanes', 'If conversion is proven first, the owner can allocate investment by source and build specialized support.'],
      ['downside_future', 12, 'More activity, same opacity', 'If volume increases before inspection improves, capacity pressure and wasted opportunity can compound.'],
    ],
    move: {
      title: 'Eight-week source-to-stage conversion inspection sprint',
      intervention: 'Run every new opportunity from source through next action, appointment, agreement, active pipeline, and outcome in one shared weekly inspection.',
      whyNow: 'The business already has enough relationship access and appointment activity to learn from real flow without buying more complexity first.',
      owner: 'The owner holds the standard; the support role maintains daily field completeness and prepares the weekly exception list.',
      workflow: 'New opportunity → source → next action → appointment → agreement → pipeline → outcome',
      firstAction: 'Define the six stages and required next-action fields before the next weekly review.',
      cadence: 'Daily completeness check; 30-minute weekly conversion inspection.',
      observation: 'Eight consecutive weeks.',
      scorecard: 'response time · stage aging · appointment rate · agreement rate · pipeline creation · close/loss reason',
      steps: ['Define one shared source-to-stage vocabulary.', 'Set the response and next-action standard for every new opportunity.', 'Backfill only active opportunities, not the full historical database.', 'Inspect exceptions and stage aging every week.', 'At week eight, keep, change, or stop the system based on measured leakage.'],
      proof: ['Fewer opportunities without a dated next action', 'Stage aging and leakage become visible by source', 'The owner can coach exceptions instead of reconstructing the pipeline'],
      failure: 'Stop or redesign if the team cannot maintain complete records or the inspection produces no actionable conversion distinction.',
    },
    eToP: [['Models', 'PURPOSEFUL'], ['Systems', 'TRANSITIONAL'], ['Tools', 'PURPOSEFUL'], ['Accountability', 'ENTREPRENEURIAL'], ['Coaching', 'PURPOSEFUL'], ['Education', 'TRANSITIONAL']],
  },
  SUFFICIENT_OPPORTUNITY_INVESTIGATE_SCALE: {
    constraint: {
      title: 'Decision-rights bottleneck',
      summary: 'The business has opportunity, pipeline, and capable people, but too many routine decisions still climb back to the leader.',
      stronger: 'Healthy response, pipeline, and conversion evidence make opportunity creation a weaker primary explanation. Approval concentration better explains the capacity ceiling and uneven team leverage.',
      chain: ['Opportunity is sufficient', 'Decision rights stay ambiguous', 'Work escalates to the leader', 'Team waits or duplicates work', 'Leader capacity caps scale'],
      effects: ['Approval queues', 'Slow exception handling', 'Manager underuse', 'Leader interruption load', 'Margin pressure', 'Growth depends on one person'],
      mechanisms: ['Routine exceptions lack explicit authority bands', 'Scorecards emphasize output more than decision quality', 'Managers own tasks without full outcome authority', 'Leader availability becomes an operating dependency', 'Escalation patterns hide capability gaps', 'Growth investment outpaces leadership-system maturity'],
      alternatives: ['Role capability may be insufficient in specific seats.', 'Margin pressure may reflect source economics rather than decision latency.'],
      mindChange: 'A four-week decision log showing few routine escalations and no meaningful leader delay would move the diagnosis toward seat capability, source economics, or delivery design.',
    },
    futures: [
      ['current_course', 21, 'Growth with leader drag', 'If approvals remain concentrated, production can grow while leader capacity and margin quality deteriorate.'],
      ['emerging_future', 18, 'Manager-owned operating lanes', 'If decision rights become explicit, managers can absorb routine exceptions and expose real capability gaps.'],
      ['better_future', 29, 'Distributed operating leadership', 'If outcome authority, scorecards, and coaching align, the team can grow without every issue returning to the leader.'],
      ['bold_future', 22, 'Leadership platform for expansion', 'If distributed leadership proves stable, the business can test new markets or units without duplicating the founder bottleneck.'],
      ['downside_future', 10, 'Scale amplifies dependence', 'If volume rises before authority changes, queues, rework, and leader exhaustion can widen.'],
    ],
    move: {
      title: 'Thirty-day decision-rights transfer trial',
      intervention: 'Transfer one recurring operating lane to a manager with explicit decision bands, exception rules, a scorecard, and no silent leader rescue.',
      whyNow: 'Opportunity is already sufficient. The next useful test is whether authority—not demand—is constraining team throughput and leader capacity.',
      owner: 'The designated manager owns the lane outcome; the leader owns only pre-agreed exceptions and the final trial review.',
      workflow: 'Decision enters lane → manager acts within band → exception logged → outcome scored → weekly coaching review',
      firstAction: 'Choose one high-frequency lane and write the decisions the manager may make without approval.',
      cadence: 'Weekly scorecard and exception review; no ad-hoc approval outside the defined exception rule.',
      observation: 'Thirty days with at least three complete operating cycles.',
      scorecard: 'leader interruptions · decision latency · rework · customer outcome · margin effect · manager-owned completions',
      steps: ['Select one recurring lane with enough volume to observe.', 'Define outcome ownership, decision bands, and exception thresholds.', 'Publish the scorecard and baseline the prior two weeks.', 'Run the lane without silent leader rescue; log every exception.', 'At day thirty, keep, expand, narrow, or stop based on the scorecard.'],
      proof: ['Routine decisions complete without leader approval', 'Decision latency falls without customer or quality harm', 'The leader recovers usable focus time while the manager owns outcomes'],
      failure: 'Stop or narrow the transfer if customer harm, rework, margin loss, or uncontained risk appears.',
    },
    eToP: [['Models', 'PURPOSEFUL'], ['Systems', 'PURPOSEFUL'], ['Tools', 'PURPOSEFUL'], ['Accountability', 'TRANSITIONAL'], ['Coaching', 'PURPOSEFUL'], ['Education', 'PURPOSEFUL']],
  },
})

function deriveIntelligenceFromFork(profile, fork) {
  const play = DIAGNOSTIC_PLAYS[fork.fork]
  invariant(play, `NO_CASSETTE_PLAY_FOR_${fork.fork}`)
  return deepFreeze({ ...profile, constraint: play.constraint, futures: play.futures, move: play.move, eToP: play.eToP })
}

function makeInspector(id, { kicker, title, status = 'Evidence-bound interpretation', tone = 'blue', meaning, why, goal, helps = [], hurts = [], connection, notice, known = [], inferred = [], missing = [], counterevidence = [], mindChange = [], wholePerson = [] }) {
  const level2 = [
    ['What we know', known],
    ['What we believe is happening', inferred],
    ['What is still missing', missing],
    ['Counterevidence', counterevidence],
    ['What would change our mind', mindChange],
    ['How this connects', [connection].filter(Boolean)],
    ['Person × business execution fit', wholePerson],
  ].filter(([, items]) => items.length).map(([sectionTitle, items]) => ({ title: sectionTitle, items }))
  return { id, kicker, title, status, tone, level1: { meaning, why, goal, helps, hurts, connection, notice }, level2 }
}

function numberInspector(record, goal) {
  return makeInspector(`number-${record.numerical_id}`, {
    kicker: `${record.customer_label} · ${CLASS_LABELS[record.numerical_class]}`,
    title: `${record.value} — ${record.customer_label}`,
    status: CLASS_LABELS[record.numerical_class],
    meaning: record.customer_safe_explanation,
    why: record.formula ? `Bounded relationship: ${record.formula}.` : 'The value remains in its stated class so it cannot be mistaken for a different kind of business truth.',
    goal,
    helps: record.source_facts,
    hurts: record.assumptions,
    connection: record.related_business_variables.join(' · '),
    notice: record.numerical_class === 'UNKNOWN_MISSING' ? 'Measure the current state before using it to choose strategy.' : 'Read the class before reading the number.',
    known: record.numerical_class === 'OBSERVED_REPORTED' ? record.source_facts : [],
    inferred: [record.formula, record.customer_safe_explanation].filter(Boolean),
    missing: record.assumptions,
    counterevidence: record.counterevidence,
    mindChange: record.mind_change_conditions,
  })
}

function customerSafeLanguage(value, parentKey = '') {
  if (typeof value === 'string') {
    if (/(?:^id$|Id$|_id$|^role$|^tone$)/u.test(parentKey)) return value
    return value
      .replace(/Governed customer-reported/giu, 'Your reported')
      .replace(/Governed stated goal/giu, 'Your stated goal')
      .replace(/synthetic governed case/giu, 'current business case')
      .replace(/frozen proof case/giu, 'frozen business assessment')
      .replace(/\bgoverned\b/giu, 'evidence-backed')
  }
  if (Array.isArray(value)) return value.map((child) => customerSafeLanguage(child, parentKey))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, customerSafeLanguage(child, key)]))
  return value
}

function buildTwin(profile, numerical, fork) {
  const e = profile.evidence
  return deepFreeze({
    contract_id: 'ba-v2-synthetic-business-twin-v1',
    identity: { proof_subject: profile.proofId, first_name: profile.name, vertical: 'Residential Real Estate', business_stage: profile.stage },
    architecture_path: ['Synthetic governed evidence', 'Synthetic BOS execution authority', 'Universal business doctrine', 'Real Estate cassette', 'Ten diagnostic lenses', 'Vertical business reality', 'Whole Business Model', 'Five Futures V2', 'One Move V2', 'Customer realization'],
    evidence_custody: { customer_data: false, provider_data: false, production_data: false, input_kind: 'COMPLETELY_SYNTHETIC', values: e },
    bos_execution_authority: profile.bos,
    diagnostic_lens_result: fork,
    whole_business_model: { governing_constraint: profile.constraint, assets: profile.helping, vulnerabilities: profile.holding },
    numerical_intelligence: numerical,
    five_futures: profile.futures.map(([role, weight, title, condition]) => ({ role, weight, title, condition })),
    one_move: profile.move,
    purposeful_execution: profile.eToP.map(([dimension, state]) => ({ dimension, state })),
  })
}

function buildViewModel(profile, numerical, fork) {
  const inspectors = {}
  const add = (inspector) => { invariant(!inspectors[inspector.id], `DUPLICATE_INSPECTOR_${inspector.id}`); inspectors[inspector.id] = inspector; return inspector.id }
  const goal = `${profile.evidence.monthlyClosingGoal} closings per month is the stated goal, not a forecast.`
  const allKnown = [
    `${profile.evidence.combinedSoiContacts} combined contacts are reported.`,
    `${profile.evidence.annualClosings} closings were reported for the current annual period.`,
    `${profile.evidence.activePipeline || profile.evidence.current.activePipeline} active opportunities are reported.`,
    `${profile.evidence.team} is the reported support structure.`,
  ]
  const numberById = Object.fromEntries(numerical.numerical_records.map((record) => [record.numerical_id, record]))
  const numberInspectorById = {}
  numerical.numerical_records.forEach((record) => { numberInspectorById[record.numerical_id] = add(numberInspector(record, goal)) })
  const numberCard = (id, tone = 'violet') => {
    const record = numberById[id]
    invariant(record, `NUMBER_MISSING_${id}`)
    return { id, label: record.customer_label, value: record.value, qualifier: CLASS_LABELS[record.numerical_class], tone, inspectorId: numberInspectorById[id] }
  }
  const simpleMetric = (id, label, value, qualifier, tone, meaning) => ({
    id, label, value, qualifier, tone,
    inspectorId: add(makeInspector(`metric-${id}`, { kicker: label, title: `${value} — ${label}`, status: qualifier, tone, meaning, why: meaning, goal, helps: profile.helping, hurts: profile.holding, connection: profile.constraint.summary, notice: 'Use this signal with its scope and surrounding business relationships.', known: [meaning], inferred: [profile.constraint.summary], missing: ['Comparable longitudinal operating records'], counterevidence: profile.constraint.alternatives, mindChange: [profile.constraint.mindChange] })),
  })
  const quickFacts = [
    numberCard('combined-soi-current', 'green'),
    numberCard('attributed-contacts-estimate', 'green'),
    simpleMetric('annual-closings', 'Annual closings', profile.evidence.annualClosings, 'Current / reported', 'teal', `${profile.evidence.annualClosings} closings were reported for the current annual period.`),
    simpleMetric('volume', 'Annual volume', profile.evidence.volume, 'Current / reported', 'blue', `${profile.evidence.volume} volume was reported for the current annual period.`),
    numberCard('monthly-closing-goal', 'indigo'),
    numberCard('current-active-pipeline', 'teal'),
    simpleMetric('gross-revenue', 'Gross revenue', profile.evidence.grossRevenue, 'Current / reported', 'gold', `${profile.evidence.grossRevenue} gross revenue was reported; owner economics stay separate.`),
    simpleMetric('margin', 'Operating margin', profile.evidence.operatingMargin, profile.evidence.operatingMargin === 'Unknown' ? 'Not yet known' : 'Current / reported', 'amber', profile.evidence.operatingMargin === 'Unknown' ? 'Operating margin is not established.' : `${profile.evidence.operatingMargin} operating margin was reported for the current period.`),
  ]

  const engineMetricIds = {
    relationships: ['combined-soi-current', 'attributed-contacts-estimate', 'top-of-mind-current', 'relationship-asset-target'],
    conversations: ['current-live-contacts', 'live-contact-goal-pace', 'live-contact-floor', 'live-contact-benchmark'],
    pipeline: ['current-active-pipeline', 'combined-pipeline-target', 'current-appointments', 'current-conversion'],
    systems: ['short-term-mindshare', 'long-term-touch-floor', 'long-term-touch-range', 'current-qualified-adds'],
    execution: ['qualified-adds-winning-day', 'relationship-additions-year', 'lead-generation-time', 'follow-up-time'],
    economics: [], capacity: [], goals: ['monthly-closing-goal', 'annual-closing-goal', 'combined-pipeline-target', 'relationship-asset-target'],
  }
  const customMetrics = {
    economics: [
      ['Gross revenue', profile.evidence.grossRevenue, 'Current / reported'], ['Operating margin', profile.evidence.operatingMargin, profile.evidence.operatingMargin === 'Unknown' ? 'Not yet known' : 'Current / reported'], ['Annual volume', profile.evidence.volume, 'Current / reported'], ['Source economics', 'Partial', 'Not yet known'],
    ],
    capacity: [
      ['Support structure', profile.evidence.team, 'Current / reported'], ['Owner load', profile.evidence.ownerLoad, 'Current / reported'], ['Response time', profile.evidence.responseTime, 'Current / reported'], ['Capacity proof', 'Incomplete', 'Not yet known'],
    ],
  }
  const engines = ENGINE_META.map(([id, short, title, tone]) => {
    const engineInspectorId = add(makeInspector(`engine-${id}`, { kicker: 'Business engine', title, status: 'Evidence-bound business state', tone, meaning: `${title} is read as part of the whole business, not as an isolated score.`, why: profile.constraint.summary, goal, helps: profile.helping, hurts: profile.holding, connection: profile.constraint.summary, notice: 'Open individual numbers to inspect their truth class and assumptions.', known: allKnown, inferred: [profile.constraint.summary], missing: ['Comparable operating history'], counterevidence: profile.constraint.alternatives, mindChange: [profile.constraint.mindChange] }))
    const metrics = engineMetricIds[id].map((numberId, index) => ({ ...numberCard(numberId, tone), id: `${id}-${index + 1}` }))
    ;(customMetrics[id] || []).forEach(([label, value, qualifier], index) => metrics.push(simpleMetric(`${id}-${index + 1}`, label, value, qualifier, tone, `${label} is ${String(value).toLowerCase()} in the synthetic governed case.`)))
    return { id, short, title, tone, confidence: id === 'economics' && profile.evidence.operatingMargin === 'Unknown' ? 'MODERATE' : 'HIGH', summary: `${title} contributes directly to the current governing interpretation.`, metrics, inspectorId: engineInspectorId }
  })

  const centerInspector = add(makeInspector('business-center', { kicker: 'Whole-business synthesis', title: profile.business, status: 'Frozen proof case', tone: 'center', meaning: profile.constraint.summary, why: profile.constraint.stronger, goal, helps: profile.helping, hurts: profile.holding, connection: profile.constraint.chain.join(' → '), notice: 'Business cause stays separate from personal execution fit.', known: allKnown, inferred: [profile.constraint.summary], missing: ['Comparable longitudinal state'], counterevidence: profile.constraint.alternatives, mindChange: [profile.constraint.mindChange], wholePerson: profile.bos }))
  const constraintInspector = add(makeInspector('governing-constraint', { kicker: 'What’s driving it', title: profile.constraint.title, status: 'Supported hypothesis · not certainty', tone: 'amber', meaning: profile.constraint.summary, why: profile.constraint.stronger, goal, helps: profile.helping, hurts: profile.holding, connection: profile.constraint.chain.join(' → '), notice: 'Alternatives remain visible and testable.', known: allKnown, inferred: [profile.constraint.summary, fork.rationale], missing: ['Comparable longitudinal operating records'], counterevidence: profile.constraint.alternatives, mindChange: [profile.constraint.mindChange] }))
  const chain = profile.constraint.chain.map((text, index) => ({ id: `chain-${index + 1}`, text, inspectorId: constraintInspector }))
  const mechanisms = profile.constraint.mechanisms.map((label, index) => ({ id: `mechanism-${index + 1}`, label, inspectorId: add(makeInspector(`mechanism-${index + 1}`, { kicker: `Mechanism ${index + 1}`, title: label, meaning: label, why: profile.constraint.summary, goal, helps: profile.helping, hurts: profile.holding, connection: profile.constraint.chain.join(' → '), notice: 'This is a mechanism to inspect, not a permanent label.', known: allKnown, inferred: [label], missing: ['Repeated operating observation'], counterevidence: profile.constraint.alternatives, mindChange: [profile.constraint.mindChange] })) }))
  const effects = profile.constraint.effects.map((label, index) => ({ id: `effect-${index + 1}`, label, inspectorId: constraintInspector }))
  const futureItems = profile.futures.map(([role, weight, title, condition], index) => ({ id: `future-${index + 1}`, role, label: ['Current Course', 'Emerging Future', 'Better Future', 'Bold Future', 'Downside Future'][index], weight, title, condition, inspectorId: add(makeInspector(`future-${index + 1}`, { kicker: 'Conditional trajectory', title, status: `${weight} of 100 relative support · not probability`, tone: 'violet', meaning: condition, why: 'This trajectory changes only if its conditions and business mechanisms change.', goal, helps: profile.helping, hurts: profile.holding, connection: profile.move.intervention, notice: 'Relative support is not likelihood or destiny.', known: allKnown, inferred: [condition], missing: ['Future operating observations'], counterevidence: profile.constraint.alternatives, mindChange: [profile.constraint.mindChange] })) }))
  const futuresInspector = add(makeInspector('futures-field', { kicker: 'Five Futures', title: 'Five purposeful conditional trajectories', status: 'Exact 100 relative-support distribution', tone: 'violet', meaning: 'The field compares five purposeful trajectory roles from the same present state.', why: 'It shows how conditions can produce materially different paths without pretending to predict the future.', goal, helps: profile.helping, hurts: profile.holding, connection: profile.move.intervention, notice: 'The values are normalized relative support, never calibrated probability.', known: allKnown, inferred: futureItems.map((item) => item.condition), missing: ['Future evidence does not yet exist'], counterevidence: profile.constraint.alternatives, mindChange: [profile.constraint.mindChange] }))
  const moveInspector = add(makeInspector('one-move', { kicker: 'Highest-leverage bounded test', title: profile.move.title, status: 'Selected intervention', tone: 'gold', meaning: profile.move.intervention, why: profile.move.whyNow, goal, helps: profile.helping, hurts: profile.holding, connection: profile.constraint.summary, notice: profile.move.failure, known: allKnown, inferred: [profile.move.whyNow], missing: ['Trial outcomes'], counterevidence: profile.constraint.alternatives, mindChange: [profile.move.failure], wholePerson: profile.bos }))
  const proof = profile.move.proof.map((label, index) => ({ id: `proof-${index + 1}`, label, inspectorId: moveInspector }))
  const steps = profile.move.steps.map((text, index) => ({ id: `step-${index + 1}`, number: index + 1, text, inspectorId: moveInspector }))
  const evidenceSpecs = [
    ['known', 'What we know', allKnown.length, 'Customer-reported current state and explicit goal.'],
    ['inferred', 'What we believe is happening', profile.constraint.mechanisms.length + 1, 'Mechanisms remain evidence-bound and conditional.'],
    ['uncertain', 'What we’re still learning', 3, 'Longitudinal movement, causal separation, and trial response.'],
    ['missing', 'What would sharpen the map', 3, 'Comparable records, direct operating observation, and clean outcome linkage.'],
  ]
  const evidenceCategories = evidenceSpecs.map(([id, label, value, summary]) => ({ id, label, value, summary, inspectorId: add(makeInspector(`evidence-${id}`, { kicker: 'Evidence', title: label, status: 'Evidence state', tone: id === 'known' ? 'green' : id === 'missing' ? 'coral' : 'blue', meaning: summary, why: 'Trust depends on keeping reported facts, interpretations, uncertainty, and missingness distinct.', goal, helps: id === 'known' ? allKnown : [], hurts: id === 'missing' ? ['Important operating evidence remains unavailable.'] : [], connection: profile.constraint.summary, notice: 'No self-report is silently converted into direct observation.', known: id === 'known' ? allKnown : [], inferred: id === 'inferred' ? [profile.constraint.summary, ...profile.constraint.mechanisms] : [], missing: id === 'missing' || id === 'uncertain' ? ['Comparable operating records', 'Direct observation', 'Trial outcomes'] : [], counterevidence: profile.constraint.alternatives, mindChange: [profile.constraint.mindChange] })) }))
  const bosInspector = add(makeInspector('bos-integration', { kicker: 'Person × business execution fit', title: 'How the trial should be carried', status: 'Execution modifier · never business cause', tone: 'green', meaning: 'Personal operating intelligence changes how the trial is introduced, bounded, inspected, and sustained. It does not choose the business diagnosis.', why: 'A sound intervention can fail when role boundaries, cadence, and adoption friction are ignored.', goal, helps: profile.bos, hurts: ['Personal style cannot explain away missing business systems or evidence.'], connection: profile.move.intervention, notice: 'Business cause and personal execution fit remain separate.', known: [], inferred: [], missing: [], counterevidence: ['Seat capability or workflow design may determine adoption independently.'], mindChange: [profile.constraint.mindChange], wholePerson: profile.bos }))
  const livingInspector = add(makeInspector('living-map', { kicker: 'After the assessment', title: 'Frozen Business Twin → Living Business Twin', status: 'Explanatory only · not active', tone: 'green', meaning: 'A later Living Business Twin could carry forward validated evidence and state transitions.', why: 'The frozen map is useful now; continuity matters only when evidence changes.', goal, helps: ['A stable baseline exists.'], hurts: ['No live tracking, checkout, subscription, or automatic update is active.'], connection: 'Future state changes would require governed new evidence.', notice: 'This control explains the future concept only.', known: [], inferred: [], missing: [], counterevidence: [], mindChange: [] }))

  return deepFreeze(customerSafeLanguage({
    identity: { firstName: profile.name, business: profile.business, vertical: 'Residential Real Estate' },
    hero: { eyebrow: `${profile.name}’s frozen Business Twin`, title: `${profile.name}’s Business. Quantified. Diagnosed. Designed to Move.`, subtitle: 'One map. Six destinations. Every claim governed.', state: 'Frozen Business Twin' },
    nav: NAV,
    quickFacts,
    businessMap: {
      center: { title: profile.business, model: profile.model, system: profile.system, goal: profile.goalLabel, inspectorId: centerInspector },
      engines,
      trajectory: { value: profile.direction[0], label: profile.direction[1], inspectorId: centerInspector },
      helping: profile.helping.map((label, index) => ({ id: `help-${index + 1}`, label, inspectorId: centerInspector })),
      holding: profile.holding.map((label, index) => ({ id: `hold-${index + 1}`, label, inspectorId: constraintInspector })),
      goalBacksolve: ['monthly-closing-goal', 'annual-closing-goal', 'combined-pipeline-target', 'live-contact-goal-pace', 'relationship-asset-target'].map((id) => numberCard(id)),
    },
    why: { title: profile.constraint.title, summary: profile.constraint.summary, whyStronger: profile.constraint.stronger, inspectorId: constraintInspector, chain, mechanisms, effects, alternatives: profile.constraint.alternatives, mindChange: profile.constraint.mindChange },
    futures: { items: futureItems, graphInspectorId: futuresInspector, semantics: 'Relative support across five conditional trajectories. Not prediction.', moveRelationship: `The selected move tests the mechanism separating ${futureItems[0].title} from ${futureItems[2].title}; it does not guarantee either path.` },
    move: { title: profile.move.title, intervention: profile.move.intervention, whyNow: profile.move.whyNow, inspectorId: moveInspector, logic: [['Constraint', profile.constraint.title, constraintInspector], ['Mechanism', profile.constraint.mechanisms[0], mechanisms[0].inspectorId], ['Intervention', profile.move.title, moveInspector], ['Proof', profile.move.proof[0], moveInspector]].map(([label, value, inspectorId]) => ({ label, value, inspectorId })), firstSteps: steps.slice(0, 3), proof, failure: [profile.move.failure], observation: profile.move.observation, execution: { workflow: profile.move.workflow, owner: profile.move.owner, firstAction: profile.move.firstAction, cadence: profile.move.cadence, observation: profile.move.observation, scorecard: profile.move.scorecard } },
    plan: { objective: profile.move.intervention, steps, ownership: profile.move.owner, prerequisites: [profile.move.firstAction], observation: profile.move.observation, cadence: profile.move.cadence, scorecard: profile.move.scorecard.split(' · '), stopConditions: [profile.move.failure], eToP: profile.eToP.map(([dimension, state]) => ({ dimension, state, confidence: 'SUPPORTED_FOR_SYNTHETIC_CASE' })), wholePerson: profile.bos },
    evidence: { categories: evidenceCategories, counterevidence: profile.constraint.alternatives, mindChanges: [profile.constraint.mindChange] },
    numerical: { headline: 'What the goal asks the business to become', explanation: 'Current truth and goal-supporting models stay separate. Click any number to see its class, assumptions, and business relationship.', comparisons: numerical.current_required_comparisons.map((comparison, index) => ({ ...comparison, inspectorId: [numberInspectorById['relationship-asset-target'], numberInspectorById['combined-pipeline-target'], numberInspectorById['live-contact-goal-pace']][index] })), measurementScorecard: ['current-live-contacts', 'current-qualified-adds', 'current-appointments', 'current-active-listings', 'current-active-buyers', 'current-conversion'].map((id) => numberCard(id, 'teal')), systemStandards: ['short-term-mindshare', 'long-term-touch-floor', 'long-term-touch-range', 'qualified-adds-winning-day', 'lead-generation-time', 'follow-up-time'].map((id) => numberCard(id, 'violet')), deeperScenarios: ['relationship-additions-year', 'relationship-reach-scenario', 'annual-live-conversations', 'modeled-portfolio-touches'].map((id) => numberCard(id, 'violet')) },
    bos: { label: 'BOS Integration', headline: 'Person × business execution fit', boundary: 'Execution modifier · never business cause', adjustments: profile.bos, inspectorId: bosInspector },
    livingMap: { headline: 'Keep your Business Twin alive as the business changes.', copy: 'Your assessment captured your business at this moment.', action: 'What a Living Twin would mean', inspectorId: livingInspector },
    inspectors,
  }))
}

export function buildSyntheticGeneralizationCandidate(stage) {
  const profile = PROFILES[stage]
  invariant(profile, 'SYNTHETIC_GENERALIZATION_STAGE_INVALID')
  const e = profile.evidence
  const numerical = buildRealEstateGoalBacksolveModel({
    subjectName: profile.name,
    monthlyClosingGoal: e.monthlyClosingGoal,
    combinedSoiContacts: e.combinedSoiContacts,
    attributedShareEstimate: e.attributedShareEstimate,
    believedTopOfMind: e.believedTopOfMind,
    relationshipAssetTarget: e.relationshipAssetTarget,
    relationshipSourceShare: e.relationshipSourceShare,
    liveContactFloor: e.liveContactFloor,
    liveContactBenchmark: e.liveContactBenchmark,
    current: e.current,
  })
  const fork = resolveGoalRelativeGoverningFork({ signals: profile.forkSignals })
  const realizedProfile = deriveIntelligenceFromFork(profile, fork)
  const businessTwin = buildTwin(realizedProfile, numerical, fork)
  const viewModel = buildViewModel(realizedProfile, numerical, fork)
  invariant(viewModel.futures.items.reduce((sum, future) => sum + future.weight, 0) === 100, 'SYNTHETIC_GENERALIZATION_FUTURES_TOTAL')
  invariant(viewModel.businessMap.engines.length === 8, 'SYNTHETIC_GENERALIZATION_ENGINE_COUNT')
  return deepFreeze({
    viewModel,
    businessTwin,
    validation: deepFreeze({ status: 'PASS', proofSubject: profile.proofId, synthetic: true, providerCalls: 0, networkCalls: 0, customerMutation: false, sharedRenderer: 'BaV2CustomerRealizationApp', sharedNumericalRuntime: numerical.contract_id, governingFork: fork.fork }),
  })
}

export const BA_V2_SYNTHETIC_GENERALIZATION_PROFILES = PROFILES
