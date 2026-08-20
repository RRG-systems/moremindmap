import { buildRealEstateGoalBacksolveModel } from '../../lib/baV2IntelligenceRuntime/numericalIntelligence.js'

const EXPECTED = Object.freeze({
  profileId: 'mm-20260708-dsst020z',
  assessmentId: 'ba-20260714-64ca0783',
  businessId: 'business-ba-20260714-64ca0783',
  vbrmHash: '6ecc9e49e981d4e56fee5263fa8bdf167b67abecb28d37c789a75d4f18d3f69c',
  twinHash: '1639433eafa025abec5716d6825f72194dc85a3f18ad05c7370f17be026bc837',
  wbmHash: 'd51d01c4e807a3341e6b76178c8e33a0050d7bb0653b887aaaf0bfc515255eba',
  futuresHash: 'b245bcb9f12ef7e1cd02c6d1433ee733cff51a85a873bb98fe652db05a00d148',
  oneMoveHash: '2e087bc4ea5b56212e7fefa5b00a33bbbb1c13e651351ca956176a017f4f4447',
  lineageHash: '21af9b7c7a687a4f6cc2fd35d5566c18b10f9e72de072600f203331fda6f566a',
  futureRoles: ['current_course', 'emerging_future', 'better_future', 'bold_future', 'downside_future'],
  futureWeights: [27, 15, 20, 12, 26],
  fileDigests: Object.freeze({
    businessTwin: '53a87a330033e132488b03cecfe543edf3a7fdfabd878a8f953a7cddf06db2e2',
    vbrm: '661c721cfe1893596f873fc2ffc0d7180ce71a95761288a4e44515b6982373ad',
    customerSafeTwin: '753f934c2e50be3e8147345af218136c35da16797b681fc56ee14e0f127311e3',
    eToP: '9946ed8a753ebf89c40a97430283568061325f97e52c53a9451d61c137c86473',
    lensTraversal: 'f44c33f7a2e0089c5b7b10a8c0d4ae5cb473b21058160810ceab821049deafee',
    wbm: 'f1d4179850f7901ce9b37f020a24538319ca671b8cc125330143d03aa2b48636',
    futures: '371adf8cd4f0844cb818331e555cf24f069d72b468c42ea77e6e142efc675de6',
    oneMove: 'c8d846dd03337d19f968dbde1ec4f9560e8bae45258d71957b72608ebc6935aa',
    lineage: 'd1e72d9693f9f8e16f9f3beb95b6f291a3cfabba62c0ccf264a0821987ec48a8',
    doctrine: 'f93291b258247abee7ec59af65bd716d369df22e3db0296e03d9fc0c322b1417',
  }),
})

const FORBIDDEN = /(?:\b(?:Wally|Tammy|Darren)\b|\b(?:hash|sha-?256|schema|provider|source[_ ]path|evidence[_ ]ref|profile[_ ]id|assessment[_ ]id)\b|\b(?:likelihood|chance of success)\b|CRM Relationship Operating System|three-second pause|Most Likely Next|Constraint Future|Optimized Future|Transformational Future)/iu
const FORBIDDEN_CUSTOMER_NAME = /\bAmber\b/u

const FUTURE_LABELS = Object.freeze({
  current_course: 'Current Course',
  emerging_future: 'Emerging Future',
  better_future: 'Better Future',
  bold_future: 'Bold Future',
  downside_future: 'Downside Future',
})

const TERRITORY_META = Object.freeze({
  'RE-T01': ['Relationship / Database', 'relationship', 'green'],
  'RE-T02': ['Demand / Opportunity', 'demand', 'blue'],
  'RE-T03': ['Conversion / Follow-Up', 'conversion', 'teal'],
  'RE-T04': ['Systems / Tools', 'systems', 'violet'],
  'RE-T05': ['Execution / Accountability', 'execution', 'amber'],
  'RE-T06': ['Economics', 'economics', 'gold'],
  'RE-T07': ['Team / Capacity / Leverage', 'capacity', 'coral'],
  'RE-T08': ['Direction / Goals', 'direction', 'indigo'],
})

function invariant(condition, code) {
  if (!condition) throw new Error(code)
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const child of Object.values(value)) deepFreeze(child)
  return value
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))]
}

function compact(values, limit = 4) {
  return unique(values).slice(0, limit)
}

function redactInternalIdentifiers(value, parentKey = '') {
  if (typeof value === 'string') {
    if (/(?:^id$|Id$|_id$|^role$|^tone$)/u.test(parentKey)) return value
    return value
      .replace(/\bpatricia-[a-z0-9-]+-v\d+\b/giu, 'the relevant governed evidence gap')
      .replace(/\bRE-T0[1-8]\b/gu, 'Business territory')
      .replace(/\bRE-L\d+\b/gu, 'Diagnostic lens')
  }
  if (Array.isArray(value)) return value.map((child) => redactInternalIdentifiers(child, parentKey))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, redactInternalIdentifiers(child, key)]))
  return value
}

function humanizeCustomerLanguage(value, parentKey = '') {
  if (typeof value === 'string') {
    if (/(?:^id$|Id$|_id$|^role$|^tone$)/u.test(parentKey)) return value
    return value
      .replace(/Counts are deterministic from the frozen VBRM claim ledger\./giu, 'These counts come from the same accepted business evidence each time.')
      .replace(/Calculated from governed inputs/giu, 'Calculated from your stated business information')
      .replace(/Every claim governed/giu, 'Every claim traceable to your business information')
      .replace(/Support changes only when governed evidence changes/giu, 'Support changes only when your business evidence changes')
      .replace(/Customer-reported or governed business statements/giu, 'Customer-reported or evidence-backed business statements')
      .replace(/exact-100 deterministic normalization/giu, 'weights add to 100 by design')
      .replace(/deterministically selected/giu, 'selected from the accepted business evidence')
      .replace(/governed epistemic state/giu, 'evidence state')
      .replace(/Whole-Person authority bound · subordinate/giu, 'Personal execution fit · business truth unchanged')
      .replace(/Whole-Person/gu, 'personal execution')
      .replace(/\bVBRM\b/gu, 'business evidence record')
      .replace(/team-authority/giu, 'verified team-role')
      .replace(/explicit authority for the participating existing support role/giu, 'clear permission and decision rights for the participating support role')
      .replace(/authority refs?/giu, 'supporting evidence')
      .replace(/authority-bound/giu, 'evidence-bound')
      .replace(/\bgoverned\b/giu, 'evidence-backed')
      .replace(/\bdeterministic(?:ally)?\b/giu, 'consistent')
      .replace(/\bheuristic\b/giu, 'directional model')
      .replace(/\bcassette\b/giu, 'industry model')
      .replace(/\bprojection\b/giu, 'customer view')
      .replace(/\bruntime\b/giu, 'calculation')
      .replace(/\blineage\b/giu, 'source trail')
      .replace(/\bprovider\b/giu, 'external service')
      .replace(/accepted primary mechanism/giu, 'supported cause')
  }
  if (Array.isArray(value)) return value.map((child) => humanizeCustomerLanguage(child, parentKey))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, humanizeCustomerLanguage(child, key)]))
  return value
}

function validateInputs(input) {
  const { businessTwin: twin, vbrm, customerSafeTwin, eToP, lensTraversal, wbm, futures, oneMove, lineage, doctrine, fileDigests } = input
  invariant(twin && vbrm && customerSafeTwin && eToP && lensTraversal && wbm && futures && oneMove && lineage && doctrine, 'BA_V2_RUN3_AUTHORITY_MISSING')
  invariant(Object.entries(EXPECTED.fileDigests).every(([key, digest]) => fileDigests[key] === digest), 'BA_V2_RUN3_FILE_HASH_DRIFT')
  invariant(vbrm.identity.owner_profile_id === EXPECTED.profileId && vbrm.identity.assessment_id === EXPECTED.assessmentId && vbrm.identity.business_id === EXPECTED.businessId, 'BA_V2_RUN3_WRONG_CUSTOMER')
  invariant(vbrm.state_hash === EXPECTED.vbrmHash && twin.artifact_bindings.vbrm.hash === EXPECTED.vbrmHash, 'BA_V2_RUN3_VBRM_DRIFT')
  invariant(twin.twin_hash === EXPECTED.twinHash, 'BA_V2_RUN3_TWIN_DRIFT')
  invariant(wbm.state_hash === EXPECTED.wbmHash && twin.artifact_bindings.wbm.hash === EXPECTED.wbmHash, 'BA_V2_RUN3_WBM_DRIFT')
  invariant(futures.artifact_hash === EXPECTED.futuresHash && twin.artifact_bindings.five_futures.hash === EXPECTED.futuresHash, 'BA_V2_RUN3_FUTURES_DRIFT')
  invariant(oneMove.artifact_hash === EXPECTED.oneMoveHash && twin.artifact_bindings.one_move.hash === EXPECTED.oneMoveHash, 'BA_V2_RUN3_ONE_MOVE_DRIFT')
  invariant(lineage.cross_artifact_lineage_hash === EXPECTED.lineageHash && twin.artifact_bindings.lineage_hash === EXPECTED.lineageHash, 'BA_V2_RUN3_LINEAGE_DRIFT')
  invariant(JSON.stringify(futures.futures.map((future) => future.future_role)) === JSON.stringify(EXPECTED.futureRoles), 'BA_V2_RUN3_FUTURE_ROLE_DRIFT')
  invariant(JSON.stringify(futures.futures.map((future) => future.normalized_relative_support_weight)) === JSON.stringify(EXPECTED.futureWeights), 'BA_V2_RUN3_FUTURE_WEIGHT_DRIFT')
  invariant(futures.support_semantics === 'UNCALIBRATED_RELATIVE_SUPPORT', 'BA_V2_RUN3_SUPPORT_SEMANTICS_DRIFT')
  invariant(oneMove.title === 'End-to-end ownership transfer trial', 'BA_V2_RUN3_ONE_MOVE_SELECTION_DRIFT')
  invariant(twin.runtime_boundaries.provider_calls === false && twin.runtime_boundaries.network_calls === false && twin.runtime_boundaries.customer_mutation === false, 'BA_V2_RUN3_RUNTIME_BOUNDARY_DRIFT')
  invariant(twin.destinations.length === 6 && twin.domain_nodes.length === 8, 'BA_V2_RUN3_TWIN_SHAPE_DRIFT')
  invariant(eToP.states.length === 6 && lensTraversal.receipts.length === 10, 'BA_V2_RUN3_DIAGNOSTIC_SHAPE_DRIFT')
  invariant(doctrine.doctrine_id === 'more-generative-business-intelligence-doctrine-v1' && doctrine.verdict === 'GENERATIVE_BUSINESS_INTELLIGENCE_DOCTRINE_V1_CANONICAL_BOUND_TO_BA_AND_VERTICAL_CASSETTES', 'BA_V2_RUN3_GENERATIVE_DOCTRINE_DRIFT')
  invariant(doctrine.run3_boundary.provider_calls === 0 && doctrine.run3_boundary.frontier_extension_inactive === true, 'BA_V2_RUN3_GENERATIVE_DOCTRINE_EXECUTION_BOUNDARY')
  return true
}

function createInspector(id, config) {
  return {
    id,
    kicker: config.kicker,
    title: config.title,
    status: config.status || 'Governed assessment state',
    tone: config.tone || 'neutral',
    level1: {
      meaning: config.meaning,
      why: config.why,
      goal: config.goal,
      helps: compact(config.helps, 5),
      hurts: compact(config.hurts, 5),
      connection: config.connection,
      notice: config.notice,
    },
    level2: [
      { title: 'What we know', items: compact(config.known, 8) },
      { title: 'What we observed', items: compact(config.observed?.length ? config.observed : ['No direct operating observation is bound to this frozen assessment.'], 6) },
      { title: 'What we infer', items: compact(config.inferred, 8) },
      { title: 'Confidence', items: compact(config.confidence, 5) },
      { title: 'What is missing', items: compact(config.missing, 8) },
      { title: 'Counterevidence', items: compact(config.counterevidence, 6) },
      { title: 'What would change our mind', items: compact(config.mindChange, 8) },
      { title: 'How this connects', items: compact(config.connections, 6) },
      ...(config.heuristic ? [{ title: 'How this model helps', items: [config.heuristic] }] : []),
      ...(config.wholePerson ? [{ title: 'Person × business execution fit', items: compact(config.wholePerson, 5) }] : []),
    ].filter((section) => section.items.length),
  }
}

function claimById(vbrm, claimId) {
  const claim = vbrm.claims.find((item) => item.claim_id === claimId)
  invariant(claim, `BA_V2_RUN3_CLAIM_MISSING_${claimId}`)
  return claim
}

function mechanismById(wbm, mechanismId) {
  const mechanism = wbm.causal_model.mechanisms.find((item) => item.mechanism_id === mechanismId)
  invariant(mechanism, `BA_V2_RUN3_MECHANISM_MISSING_${mechanismId}`)
  return mechanism
}

function stateCount(vbrm, state) {
  return vbrm.claims.filter((claim) => claim.epistemic_state === state).length
}

function futureInspector(future, index, oneMove) {
  return createInspector(`future-${future.future_role}`, {
    kicker: `${FUTURE_LABELS[future.future_role]} · ${future.normalized_relative_support_weight} of 100 relative support`,
    title: future.title,
    status: 'Conditional trajectory · not a prediction',
    tone: future.future_role,
    meaning: future.business_state_if_realized,
    why: future.state_summary,
    goal: future.conditionality,
    helps: future.required_changes,
    hurts: future.risks,
    connection: oneMove.trajectory_effect_intent[index].intent,
    notice: future.leading_indicators[0],
    known: future.supporting_evidence_refs.length ? ['This path is grounded in the current accepted business state and its governed evidence.'] : [],
    inferred: [future.state_summary, ...future.assumptions],
    confidence: [`${future.normalized_relative_support_weight} of 100 is uncalibrated relative support across these five paths. It is not a probability.`],
    missing: future.dynamic_context_dependencies.map(() => 'A material current, operating, financial, team-authority, or longitudinal evidence gap still bounds this path.'),
    counterevidence: future.counterevidence_refs.length ? ['Counter-signals from the current business remain included in the trajectory support.'] : [],
    mindChange: future.falsifiers,
    connections: future.governing_mechanisms.map(() => 'This trajectory remains linked to one or more accepted governing mechanisms.'),
  })
}

export function buildBaV2CustomerRealization(input) {
  validateInputs(input)
  const { businessTwin: twin, vbrm, eToP, lensTraversal, wbm, futures, oneMove, doctrine } = input
  const inspectors = {}
  const addInspector = (inspector) => {
    invariant(!inspectors[inspector.id], `BA_V2_RUN3_INSPECTOR_DUPLICATE_${inspector.id}`)
    inspectors[inspector.id] = inspector
    return inspector.id
  }

  const goal = wbm.current_business_reality.goals.state
  const constraint = wbm.governing_constraint
  const leaderMechanism = mechanismById(wbm, 'patricia-mech-leader-centered-operating-bottleneck-v1')
  const allKnown = vbrm.claims.filter((claim) => claim.epistemic_state === 'KNOWN').map((claim) => claim.statement)
  const allInferred = vbrm.claims.filter((claim) => claim.epistemic_state === 'INFERRED').map((claim) => claim.statement)
  const allMissing = [...vbrm.claims.filter((claim) => claim.epistemic_state === 'MISSING').map((claim) => claim.statement), ...vbrm.missing_evidence.map((gap) => gap.question)]
  const allCounterevidence = wbm.epistemic_state.counterevidence
  const allMindChanges = wbm.epistemic_state.mind_change_conditions
  const wpAdjustments = oneMove.whole_person_execution_considerations.map((item) => item.execution_adjustment)
  const relationshipClaim = claimById(vbrm, 'patricia-relationship-base-v1')
  invariant(/392/.test(relationshipClaim.statement) && /half/i.test(relationshipClaim.statement) && /50/.test(relationshipClaim.statement), 'BA_V2_RUN3_NUMERICAL_SOURCE_DRIFT')
  invariant(/two monthly closings/i.test(goal), 'BA_V2_RUN3_GOAL_NUMERICAL_SOURCE_DRIFT')
  const numericalModel = buildRealEstateGoalBacksolveModel({
    subjectName: 'Patricia',
    monthlyClosingGoal: 2,
    combinedSoiContacts: 392,
    attributedShareEstimate: 0.5,
    believedTopOfMind: 50,
  })
  const numericalById = Object.fromEntries(numericalModel.numerical_records.map((record) => [record.numerical_id, record]))
  const numericalClassLabels = {
    OBSERVED_REPORTED: 'Current / reported',
    DETERMINISTICALLY_DERIVED: 'Calculated from governed inputs',
    MODELED_REQUIREMENT: 'Goal-supporting target',
    COACHING_STANDARD: 'Coaching standard / benchmark',
    MODELED_RANGE: 'Modeled range / scenario',
    UNKNOWN_MISSING: 'Current number not yet known',
  }
  const numericalInspectors = {}
  for (const record of numericalModel.numerical_records) {
    const classLabel = numericalClassLabels[record.numerical_class]
    const inspectorId = addInspector(createInspector(`number-${record.numerical_id}`, {
      kicker: `${record.customer_label} · ${classLabel}`,
      title: `${record.value} — ${record.customer_label}`,
      status: classLabel,
      tone: record.numerical_class === 'UNKNOWN_MISSING' ? 'missing' : record.numerical_class === 'OBSERVED_REPORTED' ? 'green' : record.numerical_class === 'DETERMINISTICALLY_DERIVED' ? 'blue' : 'violet',
      meaning: record.customer_safe_explanation,
      why: record.formula ? `This value follows the bounded model: ${record.formula}.` : 'This value is kept in its stated numerical class so it cannot be mistaken for a different kind of business truth.',
      goal,
      helps: record.source_facts,
      hurts: record.assumptions,
      connection: `The ${record.governing_lens_refs.length > 1 ? 'diagnostic lenses connect' : 'diagnostic lens connects'} this number to relationship, opportunity, conversion, goal, or purposeful-execution reality without turning it into a universal rule.`,
      notice: record.numerical_class === 'UNKNOWN_MISSING' ? 'The missing current value creates a measurement question; it does not erase the business concept.' : `Read this as ${classLabel.toLowerCase()}, not as an observed fact of another class.`,
      known: record.numerical_class === 'OBSERVED_REPORTED' ? record.source_facts : [],
      inferred: [record.formula, record.customer_safe_explanation].filter(Boolean),
      confidence: [record.confidence.replaceAll('_', ' ').toLowerCase()],
      missing: record.assumptions,
      counterevidence: record.counterevidence,
      mindChange: record.mind_change_conditions,
      connections: [...record.related_business_variables.map((variable) => `Related business variable: ${variable}.`), 'Current business and business required by the goal remain separate.', 'The numerical class survives later causal and customer realization.'],
      heuristic: record.model_identity === 'GOVERNED_CUSTOMER_EVIDENCE'
        ? 'Model: governed customer evidence. No vertical heuristic changes the reported scope.'
        : record.model_identity === 'DETERMINISTIC_ARITHMETIC'
          ? 'Model: bounded arithmetic from governed inputs. The result does not become a forecast.'
          : record.model_identity === 'INTELLIGENT_MISSINGNESS'
            ? 'Model: intelligent missingness. The unknown creates a measurement question instead of a fabricated current fact.'
            : 'Model: Real Estate directional operating relationship. It orients the business without claiming calibrated certainty or universal law.',
    }))
    numericalInspectors[record.numerical_id] = inspectorId
  }

  const numericalCard = (id, tone = 'violet') => {
    const record = numericalById[id]
    invariant(record, `BA_V2_RUN3_NUMERICAL_RECORD_MISSING_${id}`)
    return {
      id: record.numerical_id,
      label: record.customer_label,
      value: record.value,
      qualifier: numericalClassLabels[record.numerical_class],
      tone,
      inspectorId: numericalInspectors[id],
    }
  }

  const makeMetric = (id, label, value, qualifier, inspectorConfig, tone = 'neutral') => ({
    id,
    label,
    value,
    qualifier,
    tone,
    inspectorId: addInspector(createInspector(`metric-${id}`, inspectorConfig)),
  })

  const quickFacts = [
    makeMetric('soi', 'Combined SOI', '392', 'customer-reported contacts', {
      kicker: 'Relationship asset', title: '392 combined SOI contacts', status: 'Known · customer-reported', tone: 'green',
      meaning: claimById(vbrm, 'patricia-relationship-base-v1').statement,
      why: 'This is a real relationship starting point, but raw contacts are not the same as verified active relationships.',
      goal, helps: [wbm.domain_states.find((state) => state.domain_id === 'relationship').strengths[0]],
      hurts: [wbm.domain_states.find((state) => state.domain_id === 'relationship').failure_modes[0]],
      connection: mechanismById(wbm, 'patricia-mech-relationship-activation-gap-v1').underlying_mechanism,
      notice: 'Watch completeness, segmentation, dated next actions, and attributable opportunity—not the raw count alone.',
      known: [claimById(vbrm, 'patricia-relationship-base-v1').statement], inferred: [wbm.assets[0].meaning],
      confidence: ['High confidence that this is the operator-reported combined SOI; relationship quality is not behaviorally verified.'],
      missing: ['Behaviorally verified true relationships, ownership, recency, response, and source-to-outcome linkage.'],
      counterevidence: ['Roughly 50 personal relationships are believed top-of-mind, but that belief is not direct behavioral proof.'],
      mindChange: [claimById(vbrm, 'patricia-relationship-base-v1').falsifier], connections: [mechanismById(wbm, 'patricia-mech-relationship-activation-gap-v1').underlying_mechanism],
      heuristic: 'Inspect the relationship lake by size, cleanliness, inflow, activation, and economic relevance; never treat the count as guaranteed economics.',
    }, 'green'),
    makeMetric('mindshare', 'Believed top-of-mind', '~50', 'not behaviorally verified', {
      kicker: 'Relationship quality', title: 'Roughly 50 believed top-of-mind', status: 'Known report · quality unverified', tone: 'green',
      meaning: claimById(vbrm, 'patricia-relationship-base-v1').statement,
      why: 'This is Patricia’s current belief about mindshare, not a governed active-relationship count.', goal,
      helps: ['It identifies a plausible high-value relationship subset.'], hurts: ['The database lacks the state, recency, and behavior needed to verify the subset.'],
      connection: mechanismById(wbm, 'patricia-mech-relationship-activation-gap-v1').underlying_mechanism,
      notice: 'Treat this as a qualification hypothesis to validate through real contact and response behavior.',
      known: [claimById(vbrm, 'patricia-relationship-base-v1').statement], inferred: [], confidence: ['Operator-estimated; not directly observed.'],
      missing: ['Time-bounded engagement and attributable response.'], counterevidence: [], mindChange: [claimById(vbrm, 'patricia-relationship-base-v1').falsifier], connections: ['Relationship quality affects opportunity and follow-up interpretation.'],
    }, 'green'),
    makeMetric('goal', 'Near-term goal', '2 / month', 'closings · desired state', {
      kicker: 'Direction and goals', title: 'Two closings per month', status: 'Known · stated goal', tone: 'indigo',
      meaning: goal, why: 'Opportunity, conversion, and capacity must be judged relative to the business Patricia is trying to build.', goal,
      helps: ['The goal is explicit enough to orient the diagnostic fork.'], hurts: ['The target is not yet connected to governed leading activities, source economics, or hiring gates.'],
      connection: lensTraversal.governing_fork.rationale, notice: 'The goal is not a forecast and current pace is not fully reconciled.',
      known: [goal], inferred: [claimById(vbrm, 'patricia-goal-current-gap-v1').statement], confidence: ['The desired goal is known; current feasibility is only partially supported.'],
      missing: ['Goal economics, source-stage flow, role design, and time-bounded milestones.'], counterevidence: [], mindChange: [claimById(vbrm, 'patricia-goal-current-gap-v1').falsifier], connections: [lensTraversal.governing_fork.rationale],
    }, 'indigo'),
    makeMetric('opportunity', 'Opportunity diagnosis', 'Not isolated', 'creation vs leakage vs capacity', {
      kicker: 'Governing fork', title: 'Opportunity is reported insufficient—but the cause is not isolated', status: 'Known report · diagnosis unresolved', tone: 'blue',
      meaning: wbm.current_business_reality.demand.state, why: claimById(vbrm, 'patricia-demand-funnel-visibility-gap-v1').statement, goal,
      helps: [wbm.domain_states.find((state) => state.domain_id === 'demand').strengths[0]], hurts: [wbm.domain_states.find((state) => state.domain_id === 'demand').failure_modes[0]],
      connection: lensTraversal.governing_fork.rationale, notice: 'Do not prescribe more lead generation before source, capture, conversion, and capacity are separated.',
      known: [claimById(vbrm, 'patricia-demand-insufficiency-report-v1').statement, claimById(vbrm, 'patricia-demand-lane-state-v1').statement],
      inferred: [], confidence: ['The self-report is known; the governing fork remains uncertain.'], missing: [claimById(vbrm, 'patricia-demand-funnel-visibility-gap-v1').statement],
      counterevidence: allCounterevidence, mindChange: [claimById(vbrm, 'patricia-demand-funnel-visibility-gap-v1').falsifier], connections: [lensTraversal.governing_fork.rationale],
    }, 'blue'),
    makeMetric('profit', 'Profit visibility', 'Not known', 'periods + owner economics unresolved', {
      kicker: 'Economics', title: 'True profit is not established', status: 'Missing · financial contradiction present', tone: 'gold',
      meaning: claimById(vbrm, 'patricia-financial-profitability-gap-v1').statement,
      why: 'Production, gross, expenses, owner income, cash, and profit are different truths. The current record does not reconcile them.', goal,
      helps: [wbm.domain_states.find((state) => state.domain_id === 'financial').strengths[0]], hurts: [wbm.domain_states.find((state) => state.domain_id === 'financial').failure_modes[0]],
      connection: mechanismById(wbm, 'patricia-mech-financial-decision-opacity-v1').underlying_mechanism,
      notice: 'Do not calculate margin, ROI, or hiring capacity from the current assessment.',
      known: [claimById(vbrm, 'patricia-financial-reported-state-v1').statement], inferred: [], confidence: ['Low confidence for any profit conclusion.'],
      missing: [claimById(vbrm, 'patricia-financial-profitability-gap-v1').statement], counterevidence: [vbrm.contradictions[0].meaning],
      mindChange: [claimById(vbrm, 'patricia-financial-profitability-gap-v1').falsifier], connections: [mechanismById(wbm, 'patricia-mech-financial-decision-opacity-v1').underlying_mechanism],
    }, 'gold'),
    makeMetric('trajectory', 'Direction of travel', 'Uncertain', 'no comparable observations', {
      kicker: 'Momentum', title: 'Direction of travel is not established yet', status: 'Missing longitudinal evidence', tone: 'violet',
      meaning: 'No comparable observations establish progression, regression, or stability.', why: 'The assessment is a frozen state, not a trend line.', goal,
      helps: wbm.momentum.leading_indicators.map((item) => item.indicator), hurts: ['No comparable longitudinal business state is bound.'],
      connection: 'Five Futures therefore remain conditional trajectories with relative support, not forecasts.', notice: 'Watch leading indicators before naming improvement or decline.',
      known: [], inferred: [], confidence: ['Insufficient evidence for a momentum direction.'], missing: [claimById(vbrm, 'patricia-stage-longitudinal-state-v1').statement],
      counterevidence: [], mindChange: allMindChanges, connections: ['Current Course and Downside carry the strongest relative support without implying inevitability.'],
    }, 'violet'),
  ]

  const headlineFacts = [
    numericalCard('combined-soi-current', 'green'),
    numericalCard('attributed-contacts-estimate', 'green'),
    numericalCard('monthly-closing-goal', 'indigo'),
    numericalCard('annual-closing-goal', 'blue'),
    numericalCard('relationship-asset-target', 'violet'),
    numericalCard('live-contact-goal-pace', 'blue'),
    numericalCard('combined-pipeline-target', 'teal'),
    numericalCard('current-active-pipeline', 'missing'),
    quickFacts.find((item) => item.id === 'profit'),
    quickFacts.find((item) => item.id === 'trajectory'),
  ]

  const engineMetricConfigs = {
    'RE-T01': [
      ['Combined SOI', '392', 'Current / reported', 'combined-soi-current'], ['Patricia-attributed', '~196', 'Calculated estimate', 'attributed-contacts-estimate'], ['Top-of-mind', '~50', 'Reported belief', 'top-of-mind-current'], ['Qualified asset target', '~500', 'Goal-supporting target', 'relationship-asset-target'],
    ],
    'RE-T02': [
      ['Current live contacts', 'Not measured', 'Current unknown', 'current-live-contacts'], ['Goal-supporting pace', '~7–8 / day', 'Modeled target', 'live-contact-goal-pace'], ['Initial floor', '~5 / day', 'Coaching standard', 'live-contact-floor'], ['High-output reference', '~20 / day', 'Benchmark', 'live-contact-benchmark'],
    ],
    'RE-T03': [
      ['Current active pipeline', 'Not measured', 'Current unknown', 'current-active-pipeline'], ['Combined target', '~8–10', 'Goal-supporting target', 'combined-pipeline-target'], ['Listing target', '~4–5', 'Goal-supporting target', 'active-listing-target'], ['Buyer target', '~4–5', 'Goal-supporting target', 'active-buyer-target'],
    ],
    'RE-T04': [
      ['Database', 'Incomplete sheet', 'Current / reported'], ['Short-term nurture', '6×6 / 8×8', 'Coaching system', 'short-term-mindshare'], ['Long-term cadence', '35+ / year', 'Coaching standard', 'long-term-touch-floor'], ['Robust cadence', '40–55 / year', 'Modeled range', 'long-term-touch-range'],
    ],
    'RE-T05': [
      ['Qualified adds', '2–3 / winning day', 'Coaching standard', 'qualified-adds-winning-day'], ['Annual add capacity', '192–288', 'Modeled range', 'relationship-additions-year'], ['Lead generation', '~2–3 hrs / day', 'Coaching standard', 'lead-generation-time'], ['Follow-up block', '~90 min / day', 'Coaching standard', 'follow-up-time'],
    ],
    'RE-T06': [
      ['Production values', 'Reported', 'Known'], ['Period / scope', 'Incomplete', 'Known'], ['Arithmetic', 'Does not reconcile', 'Contradicted'], ['Owner profit', 'Not known', 'Missing'],
    ],
    'RE-T07': [
      ['Contribution / profit', 'Equal reported', 'Known'], ['Workload', 'Mostly Patricia', 'Reported'], ['Support layer', 'Partial', 'Known'], ['Leverage readiness', 'Not established', 'Inferred'],
    ],
    'RE-T08': [
      ['Closing goal', '2 / month', 'Desired / reported', 'monthly-closing-goal'], ['Annual goal', '24', 'Calculated', 'annual-closing-goal'], ['Pipeline required', '~8–10', 'Goal-supporting target', 'combined-pipeline-target'], ['Relationship model', '~500', 'Goal-supporting target', 'relationship-asset-target'],
    ],
  }

  const engines = vbrm.territory_states.map((territory) => {
    const [title, short, tone] = TERRITORY_META[territory.territory_id]
    const claims = territory.claim_refs.map((claimId) => vbrm.claims.find((claim) => claim.claim_id === claimId)).filter(Boolean)
    const known = claims.filter((claim) => claim.epistemic_state === 'KNOWN').map((claim) => claim.statement)
    const inferred = claims.filter((claim) => claim.epistemic_state === 'INFERRED').map((claim) => claim.statement)
    const missing = claims.filter((claim) => claim.epistemic_state === 'MISSING').map((claim) => claim.statement)
    const domainId = {
      'RE-T01': 'relationship', 'RE-T02': 'demand', 'RE-T03': 'demand', 'RE-T04': 'operations',
      'RE-T05': 'accountability', 'RE-T06': 'financial', 'RE-T07': 'capacity', 'RE-T08': 'goals',
    }[territory.territory_id]
    const domainState = wbm.domain_states.find((state) => state.domain_id === domainId)
    const inspectorId = addInspector(createInspector(`engine-${short}`, {
      kicker: `${territory.territory_id} · Business engine`, title, status: `${territory.confidence} confidence · mixed evidence`, tone,
      meaning: territory.state_summary, why: domainState?.failure_modes[0] || 'This territory materially affects the whole business state.', goal,
      helps: domainState?.strengths || [], hurts: domainState?.failure_modes || [], connection: constraint.candidate,
      notice: territory.missing_evidence_refs.length ? 'Important evidence remains missing; open Deep Intelligence to see the boundary.' : 'Watch how this engine connects to the governing constraint.',
      known, inferred, confidence: [`Territory confidence: ${territory.confidence.toLowerCase()}.`], missing,
      counterevidence: allCounterevidence, mindChange: allMindChanges, connections: [`This engine cross-connects with ${territory.cross_territory_refs.length} other business territories.`],
      heuristic: territory.territory_id === 'RE-T01' ? 'Relationship size, quality, inflow, activation, decay, and economics must be examined separately.' : null,
      wholePerson: ['RE-T04', 'RE-T05', 'RE-T07'].includes(territory.territory_id) ? wpAdjustments : [],
    }))
    return {
      id: territory.territory_id,
      short,
      title,
      tone,
      confidence: territory.confidence,
      summary: territory.state_summary,
      metrics: engineMetricConfigs[territory.territory_id].map(([label, value, qualifier, numericalId], metricIndex) => {
        const metricId = `${short}-${metricIndex + 1}`
        if (numericalId) return { id: metricId, label, value, qualifier, inspectorId: numericalInspectors[numericalId] }
        const parentInspector = inspectors[inspectorId]
        const sectionItems = (title) => parentInspector.level2.find((section) => section.title === title)?.items || []
        const metricInspectorId = addInspector(createInspector(`metric-${metricId}`, {
          kicker: `${title} · ${label}`,
          title: `${label}: ${value}`,
          status: qualifier,
          meaning: territory.state_summary,
          why: parentInspector.level1.why,
          goal: parentInspector.level1.goal,
          helps: parentInspector.level1.helps,
          hurts: parentInspector.level1.hurts,
          connection: parentInspector.level1.connection,
          notice: parentInspector.level1.notice,
          known: sectionItems('What we know'),
          observed: sectionItems('What we observed'),
          inferred: sectionItems('What we infer'),
          confidence: sectionItems('Confidence'),
          missing: sectionItems('What is missing'),
          counterevidence: sectionItems('Counterevidence'),
          mindChange: sectionItems('What would change our mind'),
          connections: sectionItems('How this connects'),
          wholePerson: sectionItems('Person × business execution fit'),
        }))
        return { id: metricId, label, value, qualifier, inspectorId: metricInspectorId }
      }),
      inspectorId,
    }
  })

  const businessCenterInspector = addInspector(createInspector('business-center', {
    kicker: 'Whole-business synthesis', title: 'The real shape of Patricia’s business', status: 'Frozen assessment · business first', tone: 'center',
    meaning: Object.values(wbm.current_business_reality).map((item) => item.state).join(' '),
    why: constraint.candidate, goal, helps: wbm.assets.map((asset) => asset.meaning), hurts: wbm.vulnerabilities.map((item) => item.meaning),
    connection: constraint.why_current_candidate_stronger, notice: 'The business has relationship access and operating knowledge, but its transferable system, measurement, economics, and ownership are not yet governed.',
    known: allKnown, inferred: allInferred, confidence: ['The map preserves known, inferred, missing, and contradicted truth separately.'],
    missing: allMissing, counterevidence: allCounterevidence, mindChange: allMindChanges, connections: wbm.causal_model.mechanisms.map((mechanism) => mechanism.underlying_mechanism),
    wholePerson: wpAdjustments,
  }))

  const assetObjects = wbm.assets.map((asset, index) => ({
    id: `asset-${index + 1}`,
    label: asset.meaning,
    inspectorId: addInspector(createInspector(`asset-${index + 1}`, {
      kicker: 'What is helping', title: asset.meaning, status: 'Supported business asset', tone: 'green',
      meaning: asset.meaning, why: asset.falsifier, goal, helps: [asset.meaning], hurts: asset.confounds,
      connection: constraint.candidate, notice: 'An asset creates leverage only when its conditions are governed.',
      known: [], inferred: [asset.meaning], confidence: [asset.epistemic_class.replaceAll('_', ' ').toLowerCase()], missing: asset.confounds,
      counterevidence: asset.counterevidence_refs.length ? ['Counterevidence is retained in the accepted business state.'] : [], mindChange: [asset.falsifier], connections: [constraint.candidate],
    })),
  }))
  const vulnerabilityObjects = wbm.vulnerabilities.map((item, index) => ({
    id: `vulnerability-${index + 1}`,
    label: item.meaning,
    inspectorId: addInspector(createInspector(`vulnerability-${index + 1}`, {
      kicker: 'What is holding the business back', title: item.meaning, status: 'Supported vulnerability', tone: 'coral',
      meaning: item.meaning, why: item.falsifier, goal, helps: [], hurts: [item.meaning, ...item.confounds],
      connection: constraint.candidate, notice: 'This vulnerability is a condition to test, not a permanent label.',
      known: [], inferred: [item.meaning], confidence: [item.epistemic_class.replaceAll('_', ' ').toLowerCase()], missing: item.confounds,
      counterevidence: item.counterevidence_refs.length ? ['Counterevidence is retained in the accepted business state.'] : [], mindChange: [item.falsifier], connections: [constraint.candidate],
    })),
  }))

  const constraintInspector = addInspector(createInspector('governing-constraint', {
    kicker: 'What’s driving it', title: 'Leader-centered operating system', status: 'Supported hypothesis · not certainty', tone: 'amber',
    meaning: constraint.candidate, why: constraint.why_current_candidate_stronger, goal,
    helps: wbm.assets.map((asset) => asset.meaning), hurts: wbm.vulnerabilities.map((item) => item.meaning),
    connection: leaderMechanism.underlying_mechanism, notice: 'The candidate explains repeated patterns across relationship management, accountability, operations, workload, and capacity—but alternatives remain open.',
    known: allKnown, inferred: [constraint.candidate, ...wbm.causal_model.mechanisms.map((mechanism) => mechanism.underlying_mechanism)],
    confidence: ['Supported hypothesis; current source-stage, financial, market, and longitudinal evidence remain incomplete.'],
    missing: allMissing, counterevidence: allCounterevidence, mindChange: [constraint.falsifier, ...allMindChanges],
    connections: wbm.causal_model.mechanisms.map((mechanism) => mechanism.underlying_mechanism),
  }))

  const mechanismObjects = wbm.causal_model.mechanisms.map((mechanism, index) => ({
    id: mechanism.mechanism_id,
    label: mechanism.observed_symptom,
    value: mechanism.underlying_mechanism,
    inspectorId: addInspector(createInspector(`mechanism-${index + 1}`, {
      kicker: `Causal mechanism ${index + 1} of ${wbm.causal_model.mechanisms.length}`, title: mechanism.observed_symptom,
      status: mechanism.epistemic_class.replaceAll('_', ' ').toLowerCase(), tone: index === 1 ? 'amber' : 'neutral',
      meaning: mechanism.underlying_mechanism, why: mechanism.causal_chain.join(' '), goal,
      helps: mechanism.delayed_effects, hurts: mechanism.feedback_loops, connection: constraint.candidate,
      notice: mechanism.causal_chain[0], known: [], inferred: [mechanism.underlying_mechanism, ...mechanism.causal_chain],
      confidence: [mechanism.epistemic_class.replaceAll('_', ' ').toLowerCase()], missing: mechanism.confounds,
      counterevidence: mechanism.counterevidence_refs.length ? allCounterevidence : [], mindChange: [mechanism.falsifier],
      connections: mechanism.affected_domains.map((domain) => `Connects to ${domain.replaceAll('_', ' ')}.`),
    })),
  }))

  const downstreamEffects = [
    ['Relationship value stays weakly activated', 'mechanism-1'],
    ['Operating ownership stays leader-centered', 'mechanism-2'],
    ['Demand and conversion remain entangled', 'mechanism-3'],
    ['Team leverage remains unproven', 'mechanism-5'],
    ['Financial decisions remain opaque', 'mechanism-6'],
  ].map(([label, inspectorId], index) => ({ id: `effect-${index + 1}`, label, inspectorId }))

  const futuresView = futures.futures.map((future, index) => ({
    id: future.future_id,
    role: future.future_role,
    label: FUTURE_LABELS[future.future_role],
    title: future.title,
    summary: future.state_summary,
    weight: future.normalized_relative_support_weight,
    condition: future.required_changes[0] || future.conditionality,
    inspectorId: addInspector(futureInspector(future, index, oneMove)),
  }))
  const futuresGraphInspector = addInspector(createInspector('futures-graph', {
    kicker: 'Trajectory field', title: 'Five conditional paths from one frozen business state', status: 'Uncalibrated relative support', tone: 'violet',
    meaning: 'The graph compares support across five governed trajectories. It does not forecast Patricia’s outcome.',
    why: 'Current Course and Downside carry the strongest present support because the current mechanisms and vulnerabilities are active while change evidence remains limited.', goal,
    helps: futures.futures.map((future) => `${FUTURE_LABELS[future.future_role]} — ${future.normalized_relative_support_weight} of 100`),
    hurts: ['A higher relative-support weight is not a probability, promise, or destiny.'], connection: oneMove.trajectory_effect_intent.map((item) => item.intent).join(' '),
    notice: 'Support changes only when governed evidence changes—not when a customer clicks the graph.',
    known: [], inferred: futures.futures.map((future) => future.state_summary), confidence: ['Weights add to 100 by design; the support values are not probabilities.'],
    missing: allMissing, counterevidence: allCounterevidence, mindChange: futures.futures.flatMap((future) => future.falsifiers), connections: oneMove.trajectory_effect_intent.map((item) => item.intent),
  }))

  const oneMoveInspector = addInspector(createInspector('one-move', {
    kicker: 'What changes it', title: oneMove.title, status: 'Selected from the accepted business evidence · bounded test', tone: 'amber',
    meaning: oneMove.intervention, why: oneMove.why_now, goal, helps: oneMove.success_evidence, hurts: oneMove.failure_evidence,
    connection: oneMove.causal_chain.join(' '), notice: oneMove.leading_indicators[0],
    known: [], inferred: [oneMove.symptom_distinction, ...oneMove.causal_chain],
    confidence: [oneMove.certainty_support_classification.replaceAll('_', ' ').toLowerCase(), 'The move is a test, not a guaranteed outcome.'],
    missing: oneMove.prerequisites, counterevidence: oneMove.failure_evidence, mindChange: oneMove.falsifiers,
    connections: [constraint.candidate, ...oneMove.primary_mechanism_ids.map(() => 'The move targets an accepted primary mechanism.')], wholePerson: wpAdjustments,
  }))

  const stepObjects = oneMove.bounded_execution_steps.map((step, index) => ({
    id: `step-${index + 1}`,
    number: index + 1,
    text: step,
    inspectorId: addInspector(createInspector(`step-${index + 1}`, {
      kicker: `Execution step ${index + 1} of ${oneMove.bounded_execution_steps.length}`, title: step, status: 'Canonical One Move execution', tone: 'green',
      meaning: step, why: oneMove.execution_definition, goal, helps: oneMove.success_evidence, hurts: oneMove.stop_or_reconsider_conditions,
      connection: oneMove.intervention, notice: index === 0 ? oneMove.prerequisites[1] : oneMove.leading_indicators[Math.min(index, oneMove.leading_indicators.length - 1)],
      known: [], inferred: [oneMove.execution_definition], confidence: ['Conditional execution design; effectiveness must be observed.'],
      missing: oneMove.prerequisites, counterevidence: oneMove.failure_evidence, mindChange: oneMove.stop_or_reconsider_conditions,
      connections: [oneMove.owner_role, oneMove.observation_horizon], wholePerson: wpAdjustments,
    })),
  }))

  const proofObjects = oneMove.success_evidence.map((item, index) => ({
    id: `proof-${index + 1}`,
    label: item,
    inspectorId: addInspector(createInspector(`proof-${index + 1}`, {
      kicker: 'Proof signal', title: item, status: 'Observe after repeated workflow cycles', tone: 'green',
      meaning: item, why: oneMove.observation_horizon, goal, helps: oneMove.leading_indicators, hurts: oneMove.failure_evidence,
      connection: oneMove.intervention, notice: 'Evidence must be inspectable; nominal delegation is not enough.',
      known: [], inferred: [], confidence: ['This is a future observation target, not a current fact.'], missing: oneMove.prerequisites,
      counterevidence: oneMove.failure_evidence, mindChange: oneMove.stop_or_reconsider_conditions, connections: oneMove.causal_chain,
    })),
  }))

  const evidenceCategories = [
    ['known', 'Known', String(stateCount(vbrm, 'KNOWN')), 'Customer-reported or governed business statements'],
    ['observed', 'Observed', '0', 'No direct operating records bound'],
    ['inferred', 'Inferred', String(stateCount(vbrm, 'INFERRED')), 'Supported interpretations with disclosure'],
    ['uncertain', 'Uncertain', 'Direction', 'Momentum not yet established'],
    ['missing', 'Missing', String(stateCount(vbrm, 'MISSING')), 'Decision-relevant unknown states'],
    ['contradicted', 'Contradicted', String(vbrm.contradictions.length), 'Unresolved financial conflict'],
  ].map(([id, label, value, summary]) => ({
    id, label, value, summary,
    inspectorId: addInspector(createInspector(`evidence-${id}`, {
      kicker: `Evidence · ${label}`, title: `${value} — ${summary}`, status: 'Evidence state', tone: id,
      meaning: summary, why: 'Trust depends on preserving the edge between report, observation, inference, uncertainty, missingness, and contradiction.', goal,
      helps: id === 'known' ? allKnown : id === 'inferred' ? allInferred : [],
      hurts: id === 'missing' ? allMissing : id === 'contradicted' ? vbrm.contradictions.map((item) => item.meaning) : [],
      connection: constraint.candidate, notice: id === 'observed' ? 'No direct operating records are bound; this is shown openly.' : 'Open Deep Intelligence to see the governed boundary.',
      known: allKnown, observed: [], inferred: allInferred, confidence: ['Counts are deterministic from the frozen VBRM claim ledger.'],
      missing: allMissing, counterevidence: [...allCounterevidence, ...vbrm.contradictions.map((item) => item.meaning)], mindChange: allMindChanges, connections: wbm.causal_model.mechanisms.map((mechanism) => mechanism.underlying_mechanism),
    })),
  }))

  const bosInspector = addInspector(createInspector('bos-integration', {
    kicker: 'Person × business', title: 'Execution fit—not business cause', status: 'Personal execution fit · business truth unchanged', tone: 'green',
    meaning: 'Patricia’s Whole-Person intelligence changes how the ownership-transfer trial should be introduced, bounded, inspected, and sustained. It does not change the business diagnosis.',
    why: 'A structurally sound intervention can still fail if cadence, escalation, role boundaries, and adoption friction are ignored.', goal,
    helps: wpAdjustments, hurts: ['Personality cannot explain away missing systems, economics, ownership, or evidence.'],
    connection: oneMove.intervention, notice: 'Business cause and execution modifier stay visibly separate.',
    known: [], inferred: [], confidence: ['Execution modifiers are conditional and do not change business truth.'], missing: [],
    counterevidence: ['Workload and role design may determine adoption independently of personal operating style.'],
    mindChange: wbm.person_business_synthesis.map((item) => item.falsifier), connections: wpAdjustments, wholePerson: wpAdjustments,
  }))

  const livingInspector = addInspector(createInspector('living-map', {
    kicker: 'After the assessment', title: 'Frozen Business Twin → Living Business Twin', status: 'Explanatory only · not active', tone: 'green',
    meaning: 'Your assessment captured your business at this moment. A later Living Business Twin could carry forward validated new evidence and state transitions.',
    why: 'The frozen map is useful now; future continuity would let the map change only when the business evidence changes.', goal,
    helps: ['A stable baseline already exists.'], hurts: ['No chat, tracking, checkout, subscription, live data, or automatic update is active in this assessment.'],
    connection: twin.projection_trace.find((item) => item.statement_id === twin.living_map_transition.explanation_statement_ref).customer_text,
    notice: 'This control explains the future concept only.', known: [], inferred: [], confidence: ['No live capability is claimed.'], missing: [], counterevidence: [], mindChange: [], connections: [],
  }))

  const rawViewModel = {
    identity: { firstName: 'Patricia', business: 'Patricia’s Real Estate Business', vertical: 'Residential Real Estate' },
    hero: {
      eyebrow: 'Patricia’s frozen Business Twin',
      title: 'Patricia’s Business. Quantified. Diagnosed. Designed to Move.',
      subtitle: 'One map. Six destinations. Every claim governed.',
      state: 'Frozen Business Twin',
    },
    nav: [
      ['now', 'NOW', 'See your business'], ['why', 'WHY', 'Understand what’s driving it'], ['futures', 'FUTURES', 'Explore possible paths'],
      ['move', 'MOVE', 'Take the right action'], ['plan', 'PLAN / EXECUTION', 'Execute purposefully'], ['evidence', 'EVIDENCE', 'See why you can trust it'],
    ].map(([id, label, description], index) => ({ id, label, description, order: index + 1 })),
    quickFacts: headlineFacts,
    businessMap: {
      center: {
        title: 'Patricia’s Real Estate Business',
        model: 'Relationship-led',
        system: 'Leader-centered',
        goal: '2 closings / month',
        inspectorId: businessCenterInspector,
      },
      engines,
      trajectory: { value: 'Uncertain', label: 'Direction not established', inspectorId: 'metric-trajectory' },
      helping: assetObjects.slice(0, 3),
      holding: vulnerabilityObjects.slice(0, 3),
      goalBacksolve: [
        numericalCard('monthly-closing-goal', 'indigo'),
        numericalCard('annual-closing-goal', 'blue'),
        numericalCard('combined-pipeline-target', 'teal'),
        numericalCard('live-contact-goal-pace', 'blue'),
        numericalCard('relationship-asset-target', 'violet'),
      ],
    },
    why: {
      title: 'Leader-centered operating system',
      summary: constraint.candidate,
      whyStronger: constraint.why_current_candidate_stronger,
      inspectorId: constraintInspector,
      chain: leaderMechanism.causal_chain.map((text, index) => ({ id: `chain-${index + 1}`, text, inspectorId: 'mechanism-2' })),
      mechanisms: mechanismObjects,
      effects: downstreamEffects,
      alternatives: constraint.alternatives.map((item) => item.explanation),
      mindChange: constraint.falsifier,
    },
    futures: {
      items: futuresView,
      graphInspectorId: futuresGraphInspector,
      semantics: 'Relative support across five conditional trajectories. Not prediction.',
      moveRelationship: oneMove.trajectory_effect_intent.map((item) => item.intent).join(' '),
    },
    move: {
      title: oneMove.title,
      intervention: oneMove.intervention,
      whyNow: oneMove.why_now,
      inspectorId: oneMoveInspector,
      logic: [
        ['Constraint', 'Leader-centered system', constraintInspector],
        ['Mechanism', 'Ownership returns to Patricia', 'mechanism-2'],
        ['Intervention', 'One bounded transfer trial', oneMoveInspector],
        ['Proof', 'Completion without silent rescue', 'proof-1'],
      ].map(([label, value, inspectorId]) => ({ label, value, inspectorId })),
      firstSteps: stepObjects.slice(0, 3),
      proof: proofObjects,
      failure: oneMove.failure_evidence,
      observation: oneMove.observation_horizon,
      execution: {
        workflow: stepObjects[0].text,
        owner: oneMove.owner_role,
        firstAction: stepObjects[1].text,
        cadence: 'Review every completed cycle; choose the check-in rhythm before starting.',
        observation: 'Repeated workflow cycles; no calendar period is yet established.',
        scorecard: 'completion · rescues · quality · interruptions · released capacity',
      },
    },
    plan: {
      objective: 'Execute one end-to-end ownership transfer trial purposefully.',
      steps: stepObjects,
      ownership: oneMove.owner_role,
      prerequisites: oneMove.prerequisites,
      observation: oneMove.observation_horizon,
      cadence: 'Inspect every completed cycle and agree the check-in rhythm before launch.',
      scorecard: ['completion', 'rescues', 'quality', 'interruptions', 'released capacity'],
      stopConditions: oneMove.stop_or_reconsider_conditions,
      eToP: eToP.states.map((state) => ({ dimension: state.dimension.replaceAll('_', ' '), state: state.state, confidence: state.confidence })),
      wholePerson: wpAdjustments,
    },
    evidence: { categories: evidenceCategories, counterevidence: allCounterevidence, mindChanges: allMindChanges },
    numerical: {
      headline: 'What the goal asks the business to become',
      explanation: 'Current truth and goal-supporting models stay separate. Click any number to see its class, assumptions, and governing relationship.',
      comparisons: numericalModel.current_required_comparisons.map((comparison, index) => ({
        ...comparison,
        inspectorId: [numericalInspectors['relationship-asset-target'], numericalInspectors['combined-pipeline-target'], numericalInspectors['live-contact-goal-pace']][index],
      })),
      measurementScorecard: ['current-live-contacts', 'current-qualified-adds', 'current-appointments', 'current-active-listings', 'current-active-buyers', 'current-conversion'].map((id) => numericalCard(id, 'missing')),
      systemStandards: ['short-term-mindshare', 'long-term-touch-floor', 'long-term-touch-range', 'qualified-adds-winning-day', 'lead-generation-time', 'follow-up-time'].map((id) => numericalCard(id, 'violet')),
      deeperScenarios: ['relationship-additions-year', 'relationship-reach-scenario', 'annual-live-conversations', 'modeled-portfolio-touches'].map((id) => numericalCard(id, 'violet')),
    },
    bos: { label: 'BOS Integration', headline: 'Person × business execution fit', boundary: 'Execution modifier · never business cause', adjustments: wpAdjustments, inspectorId: bosInspector },
    livingMap: {
      headline: 'Keep your Business Twin alive as the business changes.',
      copy: 'Your assessment captured your business at this moment.',
      action: 'What a Living Twin would mean',
      inspectorId: livingInspector,
    },
    inspectors,
  }

  const viewModel = humanizeCustomerLanguage(redactInternalIdentifiers(rawViewModel))
  const serialized = JSON.stringify(viewModel)
  const forbiddenMatch = serialized.match(FORBIDDEN_CUSTOMER_NAME) || serialized.match(FORBIDDEN)
  invariant(!forbiddenMatch, `BA_V2_RUN3_CUSTOMER_LANGUAGE_LEAK_${forbiddenMatch?.[0] || 'UNKNOWN'}`)
  invariant(!/\b(?:39|22|8|4)%\b|\b128\b|\b212\b|\$17\.3M|\$3\.1M|13\.2%|Database Constraint|CRM utilization|database health/iu.test(serialized), 'BA_V2_RUN3_ILLUSTRATIVE_VALUE_LEAK')
  invariant(viewModel.futures.items.reduce((sum, item) => sum + item.weight, 0) === 100, 'BA_V2_RUN3_WEIGHT_TOTAL')
  invariant(Object.keys(inspectors).length >= 60, 'BA_V2_RUN3_DYNAMIC_DEPTH_TOO_THIN')
  return deepFreeze({
    viewModel: deepFreeze(viewModel),
    numericalLineage: numericalModel,
    validation: deepFreeze({
      status: 'PASS',
      customer: 'Patricia',
      source: 'Frozen Run 2 Business Twin plus bound canonical downstream artifacts',
      generativeDoctrineId: doctrine.doctrine_id,
      businessTwinHash: EXPECTED.twinHash,
      inspectableObjectCount: Object.keys(inspectors).length,
      providerCalls: 0,
      networkCalls: 0,
      customerMutation: false,
    }),
  })
}

export { EXPECTED as BA_V2_RUN3_AUTHORITY }
