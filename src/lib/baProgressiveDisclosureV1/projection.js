import {
  boundedList,
  classifyEpistemic,
  deepFreeze,
  findById,
  findByLabel,
  invariant,
  textArray,
  unique,
} from './utils.js'
import { isLoanOriginatorProjection } from './verticalScope.js'
import { validateGeneralizedPlan135V1 } from './plan135.js'

const NAV = Object.freeze([
  ['where', 'Where You Are'],
  ['futures', 'Five Possible Futures'],
  ['move', 'Your One Move'],
  ['plan', 'Your Plan'],
  ['evidence', 'Evidence'],
])

const FUTURE_ROLE_MEANINGS = Object.freeze({
  current_course: "Continuation of today's operating pattern.",
  emerging_future: 'An already-forming alternative path.',
  better_future: 'Attainable improvement with meaningful changes.',
  bold_future: 'A larger transformation requiring greater change.',
  downside_future: 'Business risk if key constraints persist.',
})

function section(id, title, items, empty = 'No accepted evidence is available for this section.') {
  const accepted = boundedList(textArray(items), 8)
  return { id, title, items: accepted.length ? accepted : [empty] }
}

function compactUnknown(value) {
  return /^not yet measured$/iu.test(value || '') ? 'Not measured' : value
}

function annualizedValue(value) {
  return value && !/\/\s*year/iu.test(value) ? `${value} / year` : value
}

function monthlyValue(value) {
  return value && !/\/\s*month/iu.test(value) ? `${value} / month` : value
}

function firstNumber(value) {
  const match = String(value || '').replace(/,/gu, '').match(/\d+(?:\.\d+)?/u)
  return match ? Number(match[0]) : null
}

function isOwnershipTransfer(source) {
  const text = [source?.move?.title, source?.move?.intervention, source?.why?.title, source?.why?.summary].filter(Boolean).join(' ')
  return /(?:ownership|workflow).*(?:transfer|return)|(?:transfer|return).*(?:ownership|workflow)/iu.test(text)
    && /(?:leader|owner).?centered|returns? to|silent rescue/iu.test(text)
}

function sentenceStart(value) {
  return value.replace(/^./u, (character) => character.toUpperCase())
}

function realizeFutureLayer1({ sourceFuture, future, inspector }) {
  invariant(sourceFuture?.role === future.role, `BA_PD_FUTURE_ROLE_BINDING_${future.role}`)
  invariant(typeof sourceFuture.title === 'string' && sourceFuture.title.trim(), `BA_PD_FUTURE_TITLE_MISSING_${future.role}`)
  invariant(typeof sourceFuture.condition === 'string' && sourceFuture.condition.trim(), `BA_PD_FUTURE_CONDITION_MISSING_${future.role}`)
  const businessState = sourceFuture.summary || inspector?.level1?.meaning
  invariant(typeof businessState === 'string' && businessState.trim(), `BA_PD_FUTURE_BUSINESS_STATE_MISSING_${future.role}`)
  const keyCharacteristics = boundedList([
    ...future.basis.supporting_evidence.slice(0, 1),
    ...future.basis.opposing_evidence.slice(0, 1),
    ...future.basis.missing_evidence.slice(0, 1),
    inspector?.level1?.goal,
  ], 4)
  invariant(keyCharacteristics.length >= 3, `BA_PD_FUTURE_CONDITIONING_DEPTH_${future.role}`)
  return {
    title: sourceFuture.title,
    summary: `${sentenceStart(sourceFuture.title)}. ${sentenceStart(businessState)}`,
    condition: sourceFuture.condition,
    keyCharacteristics,
  }
}

function allCards(source) {
  return [
    ...(source.quickFacts || []),
    ...(source.businessMap?.goalBacksolve || []),
    ...(source.businessMap?.engines || []).flatMap((engine) => engine.metrics || []),
    ...(source.numerical?.measurementScorecard || []),
    ...(source.numerical?.systemStandards || []),
    ...(source.numerical?.deeperScenarios || []),
  ]
}

function sourceInspector(source, inspectorId) {
  return source.inspectors?.[inspectorId]
}

function sectionItems(inspector, pattern) {
  return inspector?.level2?.filter((section) => pattern.test(section.title)).flatMap((section) => section.items || []) || []
}

function customerLanguage(value) {
  if (typeof value === 'string') return value
    .replace(/\ba evidence-backed\b/giu, 'an evidence-backed')
    .replace(/relative support/giu, 'trajectory evidence')
    .replace(/not (?:a )?probability/giu, 'a conditional trajectory estimate')
    .replace(/how we calculate these probabilities/giu, 'what supports these estimates')
    .replace(/evidence-backed evidence/giu, 'accepted evidence')
  if (Array.isArray(value)) return value.map(customerLanguage)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, customerLanguage(child)]))
  return value
}

function canonicalDrawer(inspector, fallback = {}) {
  return customerLanguage([
    { id: 'what-this-is', title: 'What This Is', items: boundedList([inspector?.level1?.meaning, fallback.meaning], 3) },
    { id: 'source-evidence', title: 'Source / Evidence', items: boundedList([...sectionItems(inspector, /what we know|observed/iu), ...textArray(fallback.evidence)], 7) },
    { id: 'interpretation', title: 'How MORE Interprets It', items: boundedList([inspector?.level1?.why, ...sectionItems(inspector, /infer/iu), fallback.interpretation], 7) },
    { id: 'supports', title: 'What It Supports', items: boundedList([...textArray(inspector?.level1?.helps), ...textArray(fallback.supports)], 6) },
    { id: 'against', title: 'What Works Against It', items: boundedList([...textArray(inspector?.level1?.hurts), ...sectionItems(inspector, /counterevidence|works against/iu), ...textArray(fallback.against)], 6) },
    { id: 'missing', title: "What's Missing", items: boundedList([...sectionItems(inspector, /missing/iu), ...textArray(fallback.missing)], 7) },
    { id: 'confidence', title: 'Confidence', items: boundedList([...sectionItems(inspector, /confidence/iu), inspector?.status, fallback.confidence], 4) },
    { id: 'mind-change', title: 'What Would Change It', items: boundedList([...sectionItems(inspector, /change our mind/iu), ...textArray(fallback.mindChange)], 7) },
  ].map((section) => section.items.length ? section : { ...section, items: ['No accepted evidence is available for this section.'] }))
}

function relationshipDrawer(inspector, context = {}) {
  const { combined, attributed, topMind, relationshipTarget, shortTerm, longTerm } = context
  const known = [
    combined && `${combined.value} ${combined.label}`,
    attributed && `${attributed.value} ${attributed.label}`,
    topMind && `${topMind.value} ${topMind.label}`,
  ].filter(Boolean)
  const engineFlow = [
    'New relationship',
    shortTerm && `${shortTerm.value} short-term mindshare`,
    'Qualification against the long-term relationship standard',
    'Long-term relationship database',
    longTerm && `${longTerm.value} relationship cadence`,
    'Referral and opportunity flow',
  ].filter(Boolean)
  return customerLanguage([
    section('what-we-know', 'What We Know', [...known, ...sectionItems(inspector, /what we know|observed/iu)]),
    section('what-this-means', 'What This Means', [inspector?.level1?.meaning, inspector?.level1?.why]),
    section('goal-requires', 'What Your Goal Requires', [relationshipTarget && `${relationshipTarget.value} qualified relationships — Goal-Supporting Model`, inspector?.level1?.goal]),
    section('the-gap', 'The Gap', [context.gap], 'The current qualified-relationship gap is not yet calculable from accepted evidence.'),
    section('why-it-matters', 'Why It Matters', [inspector?.level1?.why, ...textArray(inspector?.level1?.hurts)]),
    section('still-needs', 'What MORE Still Needs to Know', [...sectionItems(inspector, /missing/iu), context.missing]),
    section('mind-change', 'What Would Change Our View', [...sectionItems(inspector, /change our mind/iu), ...textArray(context.mindChange)]),
    section('evidence-confidence', 'Evidence & Confidence', [...sectionItems(inspector, /confidence/iu), inspector?.status]),
    section('relationship-engine', 'How the Relationship Engine Works', engineFlow),
  ])
}

function futureDrawer(inspector, future, realization, oneMove) {
  return customerLanguage([
    section('future-becomes', 'What This Future Becomes', [realization.summary, realization.condition]),
    section('future-possible', 'Why This Future Is Possible', future.basis.supporting_evidence),
    section('future-goal-constraint', 'Goal and Constraint Relationship', [...future.basis.causal_mechanisms, inspector?.level1?.goal]),
    section('future-against', "What's Working Against It", future.basis.opposing_evidence),
    section('future-likelihood', 'What Makes This Future More or Less Likely', [...future.basis.supporting_evidence, ...future.basis.falsifiers]),
    section('future-known', 'What We Know', sectionItems(inspector, /what we know|observed/iu)),
    section('future-infer', 'What We Infer', sectionItems(inspector, /infer/iu)),
    section('future-uncertain', 'What Is Uncertain', future.basis.opposing_evidence),
    section('future-missing', 'What Is Missing', future.basis.missing_evidence),
    section('future-mind-change', 'What Would Change Our Mind', future.basis.falsifiers),
    section('future-confidence', 'Confidence in This Estimate', [future.confidence.rationale, future.confidence.level]),
    section('future-move', 'One Move Relationship', [oneMove?.title, oneMove?.intervention]),
  ])
}

function moveDrawer(inspector, source) {
  return customerLanguage([
    section('move-constraint', 'The Constraint', [source.why?.title, source.why?.summary]),
    section('move-mechanism', 'The Causal Mechanism', source.why?.mechanisms?.map((item) => item.value || item.label)),
    section('move-alternatives', 'Alternatives Considered', source.why?.alternatives),
    section('move-counterevidence', 'Counterevidence', source.evidence?.counterevidence),
    section('move-fit', 'Person × Business Execution Fit', source.plan?.wholePerson),
    section('move-risks', 'Execution Risks', source.move?.failure),
    section('move-proof', 'Proof Criteria', source.move?.proof?.map((item) => item.label)),
    section('move-mind-change', 'What Would Change Our Mind', [source.why?.mindChange, ...textArray(source.evidence?.mindChanges)]),
  ])
}

function strategyDrawer(strategy, context = {}) {
  return customerLanguage([
    section('strategy-why', 'Why This Strategy Exists', [strategy.goal_relationship, strategy.description]),
    section('strategy-aim', "What You're Actually Trying to Accomplish", [context.customerHeadline || strategy.headline, context.supportingText, strategy.first_action]),
    section('strategy-execute', 'How to Execute It', [strategy.first_action, strategy.cadence, strategy.owner_boundary, ...strategy.execution_feasibility]),
    section('strategy-track', 'What to Track', strategy.scorecard),
    section('strategy-proof', "How We'll Know It's Working", strategy.proof),
    section('strategy-evidence', 'Evidence & Assumptions', [strategy.numerical_target?.qualifier, strategy.confidence, ...textArray(context.supportingModel), ...strategy.failure_or_stop]),
  ])
}

function displayFromCard(card) {
  return { title: card.label, value: card.value, qualifier: card.qualifier, tone: card.tone || 'green' }
}

export function validateProgressiveBusinessTwin(projection) {
  invariant(projection?.customerViewModel && projection?.internalTrace, 'BA_PD_PROJECTION_ROOT_MISSING')
  const customer = projection.customerViewModel
  invariant(customer.layer0.cards.length === 5, 'BA_PD_LAYER0_CARD_COUNT')
  invariant(JSON.stringify(customer.nav.map((item) => item.id)) === JSON.stringify(NAV.map(([id]) => id)), 'BA_PD_DESTINATION_ORDER')
  invariant(Object.keys(customer.destinations).length === 5, 'BA_PD_DESTINATION_COUNT')
  invariant(Object.keys(customer.objects).length >= 30, 'BA_PD_MEANINGFUL_OBJECT_DEPTH')
  invariant(Object.values(customer.objects).every((object) => object.object_id && object.destination && object.display_payload && Array.isArray(object.drawer_payload) && object.return_state_id), 'BA_PD_MEANINGFUL_OBJECT_CONTRACT')
  invariant(Object.values(projection.internalTrace.objects).every((object) => object.source_authority && Array.isArray(object.lineage_refs)), 'BA_PD_INTERNAL_LINEAGE_MISSING')
  invariant(customer.destinations.futures.items.reduce((sum, future) => sum + future.probability, 0) === 100, 'BA_PD_CUSTOMER_PROBABILITY_TOTAL')
  const loOpenPlan = projection.internalTrace.bindings?.verticalId === 'loan_originator'
  invariant(customer.destinations.plan.ways.length === 3 && customer.destinations.plan.ways.filter((way) => way.status === 'OPEN').length === (loOpenPlan ? 3 : 2), 'BA_PD_CUSTOMER_PLAN_WAYS')
  invariant(customer.destinations.plan.strategies.length === (loOpenPlan ? 0 : 5), 'BA_PD_CUSTOMER_PLAN_STRATEGIES')
  if (loOpenPlan) {
    invariant(customer.destinations.plan.planState === 'LO_OPEN_DRAFT' && customer.destinations.plan.openStrategyPositions === 15 && customer.destinations.plan.ways.every((way) => way.title === null) && !customer.destinations.plan.completion.way1 && !customer.destinations.plan.completion.way2 && !customer.destinations.plan.completion.way3, 'BA_PD_CUSTOMER_LO_OPEN_PLAN_STATE')
  }
  invariant(customer.layerContract.stop_after === 2 && customer.layerContract.layer_3_exists === false, 'BA_PD_LAYER_THREE_PROHIBITED')
  const customerText = JSON.stringify(customer)
  const technicalLeak = customerText.match(/(?:[a-f0-9]{64}|source(?:[_ ]?path|[_ ]?ref|[_ ]?future[_ ]?id)|evidence[_ ]?ref|lineage[_ ]?ref|vertical[_ ]?authority[_ ]?ref|inspector[_ ]?id|profile[_ ]?id|assessment[_ ]?id|chain.of.thought|relative support|not probability|how we calculate these probabilities)/iu)
  invariant(!technicalLeak, 'BA_PD_CUSTOMER_TECHNICAL_LEAK', technicalLeak ? customerText.slice(Math.max(0, technicalLeak.index - 80), technicalLeak.index + 120) : undefined)
  return true
}

export function buildProgressiveBusinessTwin({ sourceViewModel: source, probability, plan135, bindings = {} }) {
  invariant(source?.identity && source?.inspectors, 'BA_PD_SOURCE_VIEW_MODEL_MISSING')
  invariant(probability?.contract_id === 'five-futures-probability-v1', 'BA_PD_SOURCE_PROBABILITY_MISSING')
  invariant(plan135?.contract_id === 'generalized-1-3-5-plan-v1', 'BA_PD_SOURCE_PLAN_MISSING')
  const loanOriginator = isLoanOriginatorProjection(source, bindings)
  if (loanOriginator) {
    validateGeneralizedPlan135V1(plan135)
    invariant(plan135.plan_state === 'LO_OPEN_DRAFT', 'BA_PD_CUSTOMER_LO_PLAN_SCOPE')
  }
  const customerObjects = {}
  const internalObjects = {}
  const projectionTrace = []

  function register({ objectId, destination, surface, display, inspectorId, epistemicClass, confidence, drawerType, drawerPayload, fallback, sourceAuthority, lineageRefs = [] }) {
    invariant(!customerObjects[objectId], `BA_PD_OBJECT_DUPLICATE_${objectId}`)
    const inspector = sourceInspector(source, inspectorId)
    const customer = {
      object_id: objectId,
      destination,
      surface,
      display_payload: display,
      epistemic_class: epistemicClass || classifyEpistemic(display.qualifier || inspector?.status),
      confidence: confidence || null,
      clickable: true,
      drawer_type: drawerType || 'evidence',
      drawer_payload: drawerPayload || canonicalDrawer(inspector, fallback),
      return_state_id: `${destination}:layer1:${objectId}`,
    }
    invariant(customer.drawer_payload.length > 0, `BA_PD_OBJECT_DRAWER_EMPTY_${objectId}`)
    customerObjects[objectId] = customer
    internalObjects[objectId] = {
      ...customer,
      source_authority: sourceAuthority || inspectorId || `projected:${objectId}`,
      lineage_refs: unique([inspectorId, ...lineageRefs].filter(Boolean)),
    }
    projectionTrace.push({ statement_id: objectId, destination, display: [display.title, display.value, display.qualifier].filter(Boolean).join(' · '), source_authority: internalObjects[objectId].source_authority, epistemic_class: customer.epistemic_class })
    return objectId
  }

  const cards = allCards(source)
  if (loanOriginator) {
    const requiredIds = ['combined-soi-current', 'attributed-contacts-estimate', 'top-of-mind-current', 'monthly-closing-goal', 'annual-closing-goal', 'current-live-contacts', 'current-active-pipeline', 'relationship-asset-target', 'live-contact-goal-pace', 'combined-pipeline-target']
    invariant(requiredIds.every((id) => findById(cards, id)?.inspectorId), 'BA_PD_LO_SOURCE_CARDS_INCOMPLETE')
    invariant(requiredIds.every((id) => !/\bSOI\b|\bclosings?\b|\blistings?\b|\bbuyers?\b/iu.test(findById(cards, id).label)), 'BA_PD_LO_SOURCE_CARD_DOMAIN_MISMATCH')
  }
  const combined = findById(cards, 'combined-soi-current') || findByLabel(cards, /combined soi|contacts/iu)
  const attributed = findById(cards, 'attributed-contacts-estimate') || findByLabel(cards, /attributed contacts/iu)
  const topMind = findById(cards, 'top-of-mind-current') || findByLabel(cards, /top.of.mind/iu)
  const monthlyGoal = findById(cards, 'monthly-closing-goal') || findByLabel(cards, /monthly.*goal/iu)
  const annualGoal = findById(cards, 'annual-closing-goal') || findByLabel(cards, /annual.*goal/iu)
  const currentLive = findById(cards, 'current-live-contacts') || findByLabel(cards, /current live/iu)
  const currentPipeline = findById(cards, 'current-active-pipeline') || findByLabel(cards, /current active pipeline/iu)
  const relationshipTarget = findById(cards, 'relationship-asset-target')
  const liveTarget = findById(cards, 'live-contact-goal-pace')
  const pipelineTarget = findById(cards, 'combined-pipeline-target')
  const listingTarget = !loanOriginator && cards.find((item) => /active listing|listing target/iu.test(item.label) && /goal.supporting|modeled/iu.test(item.qualifier || ''))
  const buyerTarget = !loanOriginator && cards.find((item) => /active buyer|buyer target/iu.test(item.label) && /goal.supporting|modeled/iu.test(item.qualifier || ''))
  const shortTerm = findById(cards, 'short-term-mindshare') || findByLabel(cards, /short.term.*mindshare/iu)
  const longTerm = findById(cards, 'long-term-touch-floor') || findByLabel(cards, /long.term.*cadence/iu)

  const headlineDisplays = loanOriginator ? [combined, attributed, topMind, monthlyGoal].filter(Boolean).map(displayFromCard) : [
    combined && { ...displayFromCard(combined), title: 'Combined SOI / Contacts' },
    attributed && { ...displayFromCard(attributed), title: `Estimated ${source.identity.firstName}-attributed contacts` },
    topMind && { ...displayFromCard(topMind), title: 'Believed top-of-mind relationships' },
    monthlyGoal && { ...displayFromCard(monthlyGoal), title: 'Stated closing goal' },
  ].filter(Boolean)

  const whereMetrics = [combined, attributed, topMind, monthlyGoal].filter(Boolean).map((card, index) => ({
    ...headlineDisplays[index],
    objectId: register({ objectId: `where-metric-${index + 1}`, destination: 'where', surface: 'headline_metric', display: headlineDisplays[index], inspectorId: card.inspectorId, sourceAuthority: card.inspectorId, drawerType: 'number' }),
  }))
  invariant(whereMetrics.length === 4, 'BA_PD_WHERE_HEADLINE_METRICS_INCOMPLETE')

  const todayDisplays = loanOriginator ? [attributed, topMind, currentLive, currentPipeline].filter(Boolean).map(displayFromCard) : [
    attributed && { ...displayFromCard(attributed), title: `${source.identity.firstName}-attributed contacts` },
    topMind && { ...displayFromCard(topMind), title: 'Top-of-mind relationships' },
    currentLive && { ...displayFromCard(currentLive), value: compactUnknown(currentLive.value), title: 'Current live-contact pace' },
    currentPipeline && { ...displayFromCard(currentPipeline), value: compactUnknown(currentPipeline.value), title: 'Current active pipeline' },
  ].filter(Boolean)
  const todaySources = [attributed, topMind, currentLive, currentPipeline].filter(Boolean)
  const todayCards = todaySources.map((item, index) => ({ ...todayDisplays[index], objectId: register({ objectId: `where-today-${index + 1}`, destination: 'where', surface: 'today_state', display: todayDisplays[index], inspectorId: item.inspectorId, sourceAuthority: item.inspectorId, drawerType: 'number' }) }))

  const goalDisplays = loanOriginator ? [monthlyGoal, annualGoal].filter(Boolean).map(displayFromCard) : [
    monthlyGoal && { ...displayFromCard(monthlyGoal), title: 'Closings' },
    annualGoal && { ...displayFromCard(annualGoal), value: annualizedValue(annualGoal.value), title: 'Closings' },
  ].filter(Boolean)
  const goalSources = [monthlyGoal, annualGoal].filter(Boolean)
  const goalCards = goalSources.map((item, index) => ({ ...goalDisplays[index], objectId: register({ objectId: `where-goal-${index + 1}`, destination: 'where', surface: 'goal_state', display: goalDisplays[index], inspectorId: item.inspectorId, sourceAuthority: item.inspectorId, drawerType: 'number' }) }))

  const requiredSpecs = loanOriginator ? [relationshipTarget, liveTarget, pipelineTarget].filter(Boolean).map((item) => ({ source: item, display: displayFromCard(item) })) : [
    relationshipTarget && { source: relationshipTarget, display: { ...displayFromCard(relationshipTarget), title: 'Qualified relationship asset', qualifier: 'Goal-Supporting Model' } },
    liveTarget && { source: liveTarget, display: { ...displayFromCard(liveTarget), title: 'Live contacts', qualifier: 'Goal-Supporting Model' } },
    pipelineTarget && { source: pipelineTarget, display: { ...displayFromCard(pipelineTarget), value: monthlyValue(pipelineTarget.value), title: 'Active opportunities', qualifier: 'Goal-Supporting Model' } },
    listingTarget && buyerTarget && {
      source: listingTarget,
      display: { title: 'Goal-supporting activity mix', value: `${listingTarget.value} listings / month + ${buyerTarget.value} buyers / month`, qualifier: 'Goal-Supporting Model', tone: 'violet' },
      lineageRefs: [listingTarget.inspectorId, buyerTarget.inspectorId],
    },
  ].filter(Boolean)
  const requiredCards = requiredSpecs.map((item, index) => ({ ...item.display, objectId: register({ objectId: `where-required-${index + 1}`, destination: 'where', surface: 'goal_supporting_model', display: item.display, inspectorId: item.source.inspectorId, sourceAuthority: item.source.inspectorId, lineageRefs: item.lineageRefs, drawerType: 'number' }) }))
  invariant(todayCards.length === 4 && goalCards.length === 2 && requiredCards.length >= 2, 'BA_PD_WHERE_PATHWAY_INCOMPLETE')

  const relationshipInspector = source.businessMap?.engines?.find((engine) => /relationship/iu.test(engine.title))?.inspectorId
  const ownerMechanism = source.why?.mechanisms?.find((mechanism) => /owner|leader|decision|return/iu.test(`${mechanism.label} ${source.why.title}`)) || source.why?.mechanisms?.[0]
  const ownershipTransfer = !loanOriginator && isOwnershipTransfer(source)
  const realitySpecs = loanOriginator ? [
    { title: 'Business evidence', text: source.businessMap?.helping?.[0]?.label || 'Review the reported business state and what remains unknown.', inspectorId: combined.inspectorId, tone: 'green' },
    { title: 'Current constraint', text: source.why.summary, inspectorId: source.why.inspectorId, tone: 'amber' },
    { title: 'Working explanation', text: ownerMechanism?.label || source.why.title, inspectorId: ownerMechanism?.inspectorId || source.why.inspectorId, tone: 'green' },
  ] : [
    { title: 'Relationship Asset', text: topMind ? 'You have meaningful relationship equity, but only a relatively small portion is currently believed to be top-of-mind.' : source.businessMap?.helping?.[0]?.label, inspectorId: relationshipInspector || combined.inspectorId, tone: 'green' },
    { title: 'Operating System', text: ownershipTransfer ? 'Follow-up, database management, measurement, and accountability are incomplete or only partially systematic.' : source.why?.mechanisms?.[0]?.label || source.why.summary, inspectorId: source.why?.mechanisms?.[0]?.inspectorId || source.why.inspectorId, tone: 'green' },
    { title: 'Owner Dependence', text: ownershipTransfer ? 'Too much of the operating load still appears to return to you, limiting repeatability and leverage.' : ownerMechanism?.label || source.why.title, inspectorId: ownerMechanism?.inspectorId || source.why.inspectorId, tone: 'green' },
  ]
  const relationshipContext = {
    combined, attributed, topMind, relationshipTarget, shortTerm, longTerm,
    gap: 'The current qualified-relationship count is not yet known, so the qualified-relationship gap is not yet calculable.',
    missing: source.evidence?.categories?.find((item) => item.id === 'missing')?.summary,
    mindChange: source.evidence?.mindChanges,
  }
  const realities = realitySpecs.map((item, index) => ({ title: item.title, text: item.text, tone: item.tone, objectId: register({ objectId: `where-reality-${index + 1}`, destination: 'where', surface: 'critical_reality', display: { title: item.title, value: item.text, tone: item.tone }, inspectorId: item.inspectorId, sourceAuthority: item.inspectorId, drawerType: index === 0 ? 'territory' : 'mechanism', drawerPayload: !loanOriginator && index === 0 ? relationshipDrawer(sourceInspector(source, item.inspectorId), relationshipContext) : undefined }) }))

  const probabilityObjects = probability.as_of_state.map((future) => {
    const sourceFuture = source.futures.items.find((item) => item.role === future.role)
    invariant(sourceFuture, `BA_PD_FUTURE_SOURCE_MISSING_${future.role}`)
    const inspector = sourceInspector(source, sourceFuture.inspectorId)
    invariant(inspector, `BA_PD_FUTURE_INSPECTOR_MISSING_${future.role}`)
    const realization = realizeFutureLayer1({ sourceFuture, future, inspector })
    const objectId = register({
      objectId: `future-${future.role}`,
      destination: 'futures',
      surface: 'trajectory',
      display: { title: future.label, value: `${future.probability}%`, qualifier: 'Model-estimated trajectory probability', tone: future.role },
      inspectorId: sourceFuture.inspectorId,
      epistemicClass: 'MODEL_ESTIMATED_PROBABILITY',
      confidence: future.confidence.level,
      drawerType: 'future',
      drawerPayload: futureDrawer(inspector, future, realization, source.move),
      sourceAuthority: future.source_future_id,
      lineageRefs: [future.source_future_id, ...future.basis.causal_mechanisms],
      fallback: { interpretation: sourceFuture.summary, evidence: future.basis.supporting_evidence, against: future.basis.opposing_evidence, missing: future.basis.missing_evidence, confidence: future.confidence.rationale, mindChange: future.basis.falsifiers },
    })
    return {
      role: future.role,
      label: future.label,
      meaning: FUTURE_ROLE_MEANINGS[future.role],
      title: realization.title,
      probability: future.probability,
      confidence: future.confidence.level,
      summary: realization.summary,
      condition: realization.condition,
      keyCharacteristics: realization.keyCharacteristics,
      supporting: future.basis.supporting_evidence,
      opposing: future.basis.opposing_evidence,
      missing: future.basis.missing_evidence,
      falsifiers: future.basis.falsifiers,
      objectId,
    }
  })

  const moveInspectorId = source.move.inspectorId
  const moveCustomer = ownershipTransfer ? {
    intervention: 'Transfer one recurring workflow completely out of your hands—with clear ownership, decision rights, standards, and accountability.',
    logicValues: [
      'Owner-centered operating system',
      `Important work repeatedly returns to ${source.identity.firstName}`,
      'Transfer one recurring workflow end-to-end',
      `Can the business operate reliably without ${source.identity.firstName} rescuing it?`,
    ],
    logicDescriptions: [
      `Important work, decisions, and accountability return to ${source.identity.firstName}.`,
      'This limits capacity, leverage, and growth without more owner time.',
      'With explicit ownership, decision rights, standards, and accountability.',
      'Test whether ownership can stay outside the owner.',
    ],
    reasons: [
      ['It attacks the constraint', 'The issue isn’t simply needing more help. Work, decisions, and accountability still tend to return to you.'],
      ['It creates proof', 'One complete workflow lets MORE test whether ownership can actually move away from you without quality or execution breaking down.'],
      ["It’s bounded", 'We’re not asking you to reorganize the company. Transfer one workflow, inspect what happens, and learn from the result.'],
    ],
    proof: [
      `The work gets completed without ${source.identity.firstName} rescuing it.`,
      'Decisions stay with the owner inside clearly defined boundaries.',
      'Quality holds without hidden intervention.',
      'Capacity is actually released instead of creating more management work.',
    ],
    start: 'Choose one recurring workflow that currently keeps coming back to you.',
  } : null
  const logicLabels = ["What's holding you back", "What's causing it", 'The Move', "What we're testing"]
  const moveLogic = source.move.logic.map((node, index) => {
    const inspector = sourceInspector(source, node.inspectorId)
    const description = moveCustomer?.logicDescriptions[index] || boundedList([inspector?.level1?.why, inspector?.level1?.meaning], 2)
      .find((item) => item && item !== node.value) || ''
    return {
      label: logicLabels[index] || node.label,
      value: moveCustomer?.logicValues[index] || node.value,
      description,
      objectId: register({ objectId: `move-logic-${index + 1}`, destination: 'move', surface: 'causal_logic', display: { title: logicLabels[index] || node.label, value: node.value, tone: ['amber', 'violet', 'amber', 'blue'][index] }, inspectorId: node.inspectorId, sourceAuthority: node.inspectorId, drawerType: index === 0 ? 'constraint' : index === 1 ? 'mechanism' : 'move' }),
    }
  })
  const rawMoveReasons = [
    { title: 'It attacks the constraint', text: source.why.summary },
    { title: 'It creates proof', text: source.move.proof?.[0]?.label || source.move.whyNow },
    { title: "It's bounded", text: source.move.observation || source.move.execution?.observation },
  ]
  const moveReasonSpecs = moveCustomer ? moveCustomer.reasons.map(([title, text]) => ({ title, text })) : rawMoveReasons
  const moveReasons = moveReasonSpecs.map((item, index) => ({ ...item, objectId: register({ objectId: `move-reason-${index + 1}`, destination: 'move', surface: 'why_move', display: { title: item.title, value: item.text, tone: ['amber', 'violet', 'blue'][index] }, inspectorId: moveInspectorId, sourceAuthority: moveInspectorId, drawerType: 'move', drawerPayload: moveDrawer(sourceInspector(source, moveInspectorId), source) }) }))
  const defaultProofLabels = [
    'The work gets completed without hidden rescue.',
    'Decisions stay with the owner inside clearly defined boundaries.',
    'Quality holds without hidden intervention.',
    'Capacity is actually released instead of creating more management work.',
  ]
  const proofLabels = loanOriginator ? source.move.proof?.map((item) => item.label) : moveCustomer?.proof || defaultProofLabels
  invariant(proofLabels?.length, 'BA_PD_MOVE_PROOF_EVIDENCE_MISSING')
  const moveProof = proofLabels.map((label, index) => ({ label, objectId: register({ objectId: `move-proof-${index + 1}`, destination: 'move', surface: 'proof_condition', display: { title: label, qualifier: 'Future observation target', tone: 'green' }, inspectorId: source.move.proof?.[Math.min(index, (source.move.proof?.length || 1) - 1)]?.inspectorId || moveInspectorId, epistemicClass: 'FUTURE_OBSERVATION_TARGET', sourceAuthority: source.move.proof?.[Math.min(index, (source.move.proof?.length || 1) - 1)]?.inspectorId || moveInspectorId, drawerType: 'move', fallback: { confidence: 'This is a proof condition to observe, not a current fact.' } }) }))
  const startHere = source.move.firstSteps?.[0]
  invariant(startHere, 'BA_PD_MOVE_START_HERE_MISSING')
  const customerStart = moveCustomer?.start || startHere.text
  const startQualifier = loanOriginator ? 'A proposed first step to discuss and adapt before agreeing to act.' : 'Small enough to transfer · important enough to matter · repeated often enough to observe'
  const startObjectId = register({ objectId: 'move-start-here', destination: 'move', surface: 'start_here', display: { title: 'Start Here', value: customerStart, qualifier: startQualifier, tone: 'violet' }, inspectorId: startHere.inspectorId, sourceAuthority: startHere.inspectorId, drawerType: 'move', drawerPayload: moveDrawer(sourceInspector(source, startHere.inspectorId), source) })
  const deepDiveObjectId = register({ objectId: 'move-deep-dive', destination: 'move', surface: 'deep_intelligence_entrance', display: { title: 'Why MORE chose this move', value: 'See the deeper intelligence and evidence behind this recommendation.', tone: 'blue' }, inspectorId: moveInspectorId, sourceAuthority: moveInspectorId, drawerType: 'move', drawerPayload: moveDrawer(sourceInspector(source, moveInspectorId), source) })

  function projectStrategy(strategy) {
    if (loanOriginator) return { title: strategy.title, headline: strategy.headline, supportingText: strategy.cadence, flow: [], supportingModel: [strategy.numerical_target?.qualifier].filter(Boolean) }
    if (strategy.mission === 'GROW_RELATIONSHIP_ASSET' && relationshipTarget) {
      const target = firstNumber(relationshipTarget.value)
      const weekly = Number.isFinite(target) ? Math.max(1, Math.round(target / 50)) : null
      return {
        title: 'Grow the relationship asset',
        headline: weekly ? `Add ~${weekly} qualified relationships each week` : strategy.headline,
        supportingText: `Build toward the ${relationshipTarget.value} qualified-relationship Goal-Supporting Model over the next 12 months.`,
        flow: [],
        supportingModel: [relationshipTarget.value, 'Goal-Supporting Model', 'Current qualified-relationship count remains unknown until measured.'],
      }
    }
    if (strategy.mission === 'CREATE_OPPORTUNITY_CADENCE') return {
      title: 'Create opportunity every day', headline: strategy.headline, supportingText: strategy.cadence, flow: [], supportingModel: [strategy.numerical_target?.qualifier],
    }
    if (strategy.mission === 'CREATE_WEEKLY_SCORECARD') return {
      title: 'Know your numbers', headline: 'Track the business every week', supportingText: null,
      flow: strategy.scorecard.map((item) => item.replace(/^active /iu, '').replace(/^./u, (letter) => letter.toUpperCase())), supportingModel: [],
    }
    if (strategy.mission === 'BUILD_GOAL_PIPELINE' && pipelineTarget) return {
      title: 'Build the pipeline your goal requires', headline: `${pipelineTarget.value} active opportunities / month`, supportingText: 'Goal-Supporting Model',
      flow: [listingTarget && `${listingTarget.value} listings / month`, buyerTarget && `${buyerTarget.value} ready-now buyers / month`].filter(Boolean), supportingModel: [pipelineTarget.qualifier, listingTarget?.qualifier, buyerTarget?.qualifier],
    }
    if (strategy.mission === 'SYSTEMATIZE_RELATIONSHIP_ENGINE' && shortTerm && longTerm) return {
      title: 'Systematize the relationship engine', headline: `${shortTerm.value} → ${String(longTerm.value).replace(/\s*\/\s*year/iu, '')} Touch`,
      supportingText: 'Create mindshare with new relationships → remain top-of-mind with qualified relationships.',
      flow: [shortTerm.value, `${String(longTerm.value).replace(/\s*\/\s*year/iu, '')} Touch`], supportingModel: [shortTerm.qualifier, longTerm.qualifier],
    }
    return { title: strategy.title, headline: strategy.headline, supportingText: strategy.description, flow: [], supportingModel: [strategy.numerical_target?.qualifier] }
  }

  const planStrategyObjects = plan135.strategies.map((strategy, index) => {
    const customerStrategy = projectStrategy(strategy)
    return {
    order: index + 1,
    mission: strategy.mission,
    title: customerStrategy.title,
    headline: customerStrategy.headline,
    description: strategy.description,
    supportingText: customerStrategy.supportingText,
    flow: customerStrategy.flow,
    target: strategy.numerical_target ? {
      label: strategy.numerical_target.label,
      value: strategy.numerical_target.value,
      qualifier: strategy.numerical_target.qualifier,
    } : null,
    firstAction: strategy.first_action,
    cadence: strategy.cadence,
    observationWindow: strategy.observation_window,
    scorecard: strategy.scorecard,
    proof: strategy.proof,
    stopConditions: strategy.failure_or_stop,
    confidence: strategy.confidence,
    objectId: register({ objectId: `plan-strategy-${index + 1}`, destination: 'plan', surface: 'strategy', display: { title: customerStrategy.title, value: customerStrategy.headline, qualifier: strategy.numerical_target?.qualifier || 'Governed strategy', tone: 'blue' }, inspectorId: strategy.evidence_lineage_refs[0], epistemicClass: strategy.epistemic_class, confidence: strategy.confidence, sourceAuthority: strategy.strategy_id, lineageRefs: strategy.evidence_lineage_refs, drawerType: 'strategy', drawerPayload: strategyDrawer(strategy, { customerHeadline: customerStrategy.headline, supportingText: customerStrategy.supportingText, supportingModel: customerStrategy.supportingModel }) }),
    }
  })

  const evidenceRowSpecs = [
    combined, attributed, topMind, monthlyGoal, annualGoal, currentLive, currentPipeline, relationshipTarget, liveTarget, pipelineTarget,
  ].filter(Boolean)
  const evidenceRows = evidenceRowSpecs.map((item, index) => ({
    id: `evidence-row-${index + 1}`,
    reality: item.label,
    value: item.value,
    basis: item.qualifier,
    status: classifyEpistemic(item.qualifier),
    confidence: sourceInspector(source, item.inspectorId)?.status || 'Bounded by the accepted evidence state',
    objectId: register({ objectId: `evidence-row-${index + 1}`, destination: 'evidence', surface: 'ledger_row', display: displayFromCard(item), inspectorId: item.inspectorId, sourceAuthority: item.inspectorId, drawerType: 'evidence' }),
  }))
  const contradictionCategory = source.evidence.categories.find((item) => item.id === 'contradicted')
  if (contradictionCategory) evidenceRows.push({
    id: 'evidence-row-contradiction', reality: 'Economics / profitability', value: 'Does not yet reconcile', basis: contradictionCategory.summary, status: 'CONTRADICTED', confidence: 'Low until reconciled',
    objectId: register({ objectId: 'evidence-row-contradiction', destination: 'evidence', surface: 'ledger_row', display: { title: 'Economics / profitability', value: 'Does not yet reconcile', qualifier: 'Contradicted', tone: 'coral' }, inspectorId: contradictionCategory.inspectorId, epistemicClass: 'CONTRADICTED', sourceAuthority: contradictionCategory.inspectorId, drawerType: 'evidence' }),
  })

  const evidenceCategorySpecs = ['known', 'inferred', 'missing', source.evidence.categories.some((category) => category.id === 'contradicted') ? 'contradicted' : 'uncertain']
    .map((id) => source.evidence.categories.find((category) => category.id === id))
    .filter(Boolean)
  const evidenceCategories = evidenceCategorySpecs.map((category) => ({
    id: category.id,
    label: category.label,
    value: category.value,
    summary: category.summary,
    objectId: register({ objectId: `evidence-summary-${category.id}`, destination: 'evidence', surface: 'evidence_summary', display: { title: category.label, value: category.value, qualifier: category.summary, tone: category.id }, inspectorId: category.inspectorId, sourceAuthority: category.inspectorId, drawerType: 'evidence' }),
  }))
  invariant(evidenceCategories.length === 4, 'BA_PD_EVIDENCE_SUMMARY_INCOMPLETE')

  const traceCardSpecs = [
    { label: 'WHY — Governing Constraint', title: source.why.title, summary: source.why.summary, inspectorId: source.why.inspectorId, tone: 'green' },
    { label: 'Five Futures', title: 'Five conditional trajectories', summary: probabilityObjects.map((item) => item.label).join(', '), inspectorId: source.futures.items[0].inspectorId, tone: 'violet' },
    { label: 'One Move', title: source.move.title, summary: source.move.intervention, inspectorId: moveInspectorId, tone: 'amber' },
    { label: 'Plan', title: loanOriginator ? '1 Goal · 3 Ways Open · Strategies Not Yet Established' : '1 Goal → 1 selected Way → 5 Strategies', summary: plan135.goal.title, inspectorId: plan135.goal.source_ref, tone: 'blue' },
  ]
  const evidenceTraceCards = traceCardSpecs.map((item, index) => ({
    label: item.label,
    title: item.title,
    summary: item.summary,
    tone: item.tone,
    objectId: register({ objectId: `evidence-trace-${index + 1}`, destination: 'evidence', surface: 'business_twin_trace', display: { title: item.label, value: item.title, qualifier: item.summary, tone: item.tone }, inspectorId: item.inspectorId, sourceAuthority: item.inspectorId || plan135.contract_id, drawerType: 'evidence' }),
  }))
  const knownTruths = evidenceRows.filter((row) => row.status === 'REPORTED' || row.status === 'KNOWN').slice(0, 5).map((row) => `${row.reality}: ${row.value}`)
  const interpretedTruths = unique([source.why.title, ...source.why.mechanisms.map((item) => item.label)]).slice(0, 5)
  const openQuestions = evidenceRows.filter((row) => row.status === 'MISSING').map((row) => row.reality)
  const highestValueMissing = unique([...openQuestions, ...textArray(source.evidence.categories.find((item) => item.id === 'missing')?.summary)]).slice(0, 6)

  const sortedFutures = [...probabilityObjects].sort((left, right) => right.probability - left.probability)
  const mapCardObjects = {
    where: register({ objectId: 'layer0-where', destination: 'where', surface: 'layer0_card', display: { title: 'Where You Are', value: combined.value, qualifier: loanOriginator ? combined.label : 'Total relationships in your database', tone: 'green' }, inspectorId: combined.inspectorId, sourceAuthority: combined.inspectorId, drawerType: 'number' }),
    futures: register({ objectId: 'layer0-futures', destination: 'futures', surface: 'layer0_card', display: { title: 'Five Possible Futures', value: `${sortedFutures[0].probability}%`, qualifier: sortedFutures[0].label, tone: 'violet' }, inspectorId: source.futures.items.find((item) => item.role === sortedFutures[0].role)?.inspectorId, sourceAuthority: probability.as_of_state.find((item) => item.role === sortedFutures[0].role)?.source_future_id, drawerType: 'future' }),
    move: register({ objectId: 'layer0-move', destination: 'move', surface: 'layer0_card', display: { title: 'Your One Move', value: source.move.title, qualifier: moveCustomer?.intervention || source.move.intervention, tone: 'amber' }, inspectorId: moveInspectorId, sourceAuthority: moveInspectorId, drawerType: 'move', drawerPayload: moveDrawer(sourceInspector(source, moveInspectorId), source) }),
    plan: register({ objectId: 'layer0-plan', destination: 'plan', surface: 'layer0_card', display: { title: 'Your Plan', value: loanOriginator ? '1 Goal · 3 Ways Open' : '1 Goal · 1 Selected Way · 5 Strategies', qualifier: loanOriginator ? 'Business strategies are not yet established' : 'Ways 2 and 3 remain open', tone: 'blue' }, inspectorId: plan135.goal.source_ref, sourceAuthority: plan135.contract_id, drawerType: 'strategy' }),
    evidence: register({ objectId: 'layer0-evidence', destination: 'evidence', surface: 'layer0_card', display: { title: 'Evidence', value: `${evidenceCategories[0].value} things known`, qualifier: `${evidenceCategories[1].value} inferred · ${evidenceCategories[2].value} missing`, tone: 'teal' }, inspectorId: evidenceCategorySpecs[0].inspectorId, sourceAuthority: evidenceCategorySpecs[0].inspectorId, drawerType: 'evidence' }),
  }

  const customerViewModel = {
    identity: source.identity,
    hero: {
      eyebrow: `${source.identity.firstName}’s Business Twin`,
      title: 'Your business. Quantified. Diagnosed. Designed to move.',
      subtitle: 'One map. Five destinations. Every decision with confidence.',
      modelDate: bindings.modelDate || null,
    },
    nav: NAV.map(([id, label], index) => ({ id, label, order: index + 1 })),
    layerContract: { layer_0: 'ANSWER', layer_1: 'UNDERSTAND', layer_2: 'INVESTIGATE', stop_after: 2, layer_3_exists: false },
    layer0: {
      cards: [
        {
          id: 'where', objectId: mapCardObjects.where, ...customerObjects[mapCardObjects.where].display_payload,
          description: 'See your business as it stands today.',
          details: loanOriginator ? [topMind, monthlyGoal, pipelineTarget, attributed].map((item) => ({ value: item.value, label: item.label, epistemicClass: classifyEpistemic(item.qualifier) })) : [
            { value: topMind.value, label: 'Top-of-mind relationships', epistemicClass: classifyEpistemic(topMind.qualifier) },
            { value: monthlyGoal.value, label: 'Current closing goal', epistemicClass: classifyEpistemic(monthlyGoal.qualifier) },
            { value: pipelineTarget.value, label: 'Active opportunities in your pipeline', epistemicClass: classifyEpistemic(pipelineTarget.qualifier) },
            { value: attributed.value, label: 'Contacts attributed to you', epistemicClass: classifyEpistemic(attributed.qualifier) },
          ],
          cta: 'See your business',
        },
        {
          id: 'futures', objectId: mapCardObjects.futures, ...customerObjects[mapCardObjects.futures].display_payload,
          description: 'Where your current business could go.',
          items: probabilityObjects.map((future) => ({ label: future.label, probability: future.probability })), cta: 'Explore futures',
        },
        {
          id: 'move', objectId: mapCardObjects.move, ...customerObjects[mapCardObjects.move].display_payload,
          description: 'The highest-leverage move that changes everything.', icon: '⌾', cta: 'See why this move',
        },
        {
          id: 'plan', objectId: mapCardObjects.plan, ...customerObjects[mapCardObjects.plan].display_payload,
          description: loanOriginator ? 'Choose the business paths and strategies together.' : 'Turn the move into an observable plan.', icon: '✓',
          value: loanOriginator ? 'Your goal is clear. The plan is still open.' : 'Execute the plan. Track progress. Create momentum.', qualifier: loanOriginator ? 'No business strategies or action commitments have been established.' : 'Simple steps. Clear focus. Measurable results.', cta: 'View your plan',
        },
        {
          id: 'evidence', objectId: mapCardObjects.evidence, ...customerObjects[mapCardObjects.evidence].display_payload,
          description: 'The facts behind this assessment.', icon: '▤',
          items: evidenceCategories.slice(0, 3).map((category) => ({ value: category.value, label: category.id === 'missing' ? 'Things we still need to learn' : category.id === 'inferred' ? 'Things we infer' : 'Things we know' })),
          cta: 'See the evidence',
        },
      ],
      bigPicture: `Your business most strongly supports two competing paths: ${sortedFutures[0].label} (${sortedFutures[0].probability}%) and ${sortedFutures[1].label} (${sortedFutures[1].probability}%).`,
      bigPictureQualifier: `${sortedFutures[0].title} and ${sortedFutures[1].title} are shaped by whether ${source.why.title.toLowerCase()} changes. ${probabilityObjects.find((item) => item.role === 'better_future')?.label} remains within reach if its required operating conditions become true.`,
      nextStep: ownershipTransfer ? 'Choose the first recurring workflow to transfer.' : customerStart,
      nextStepQualifier: 'Start small. Build proof. Create momentum.',
    },
    destinations: {
      where: {
        eyebrow: '1. Where You Are', headline: 'Your current business snapshot.', subhead: 'The accepted picture of your business today.', metrics: whereMetrics,
        pathway: { today: todayCards, goal: goalCards, required: requiredCards },
        realities,
        gap: ownershipTransfer ? 'The gap is not simply more activity. It is turning an existing relationship-led business into a measured, systematic relationship engine capable of reliably supporting the goal.' : source.numerical?.comparisons?.[0]?.gap || source.why.summary,
        entrances: [{ label: 'See the numbers behind this', objectId: requiredCards[0].objectId }, { label: 'See what MORE still needs to know', objectId: evidenceCategories[2].objectId }, { label: 'Explore the full business model', objectId: realities[1].objectId }],
      },
      futures: {
        eyebrow: `${source.identity.firstName}’s Business Twin`, headline: 'Five Possible Futures', subhead: 'MORE estimates the probability of five possible Futures based on everything currently understood about your business.',
        probabilitySemantics: 'Model-estimated conditional trajectory probability', items: probabilityObjects,
        ifMoveWorks: probability.if_one_move_works.map((future) => ({ role: future.role, label: future.label, probability: future.probability })),
      },
      move: {
        eyebrow: 'Your One Move', headline: source.move.title, subhead: moveCustomer?.intervention || source.move.intervention, logic: moveLogic, reasons: moveReasons, proof: moveProof,
        startHere: { text: customerStart, qualifier: loanOriginator ? startQualifier : 'Small enough to transfer. Important enough to matter. Repeated often enough to observe.', objectId: startObjectId }, deepDiveObjectId,
      },
      plan: {
        eyebrow: 'Your 1–3–5 Plan', headline: ownershipTransfer && annualGoal ? `Build a business that consistently closes ${annualGoal.value} units a year — while beginning to create leverage.` : plan135.goal.title, subhead: loanOriginator ? 'Your goal is recorded. All three business paths and their strategies remain open. The One Move below is a separate proposal; any action or timing requires your agreement.' : 'One goal. Three ways to get there. Five strategies for Way 1.',
        ...(loanOriginator ? { planState: 'LO_OPEN_DRAFT', openStrategyPositions: 15 } : {}),
        goal: { title: plan135.goal.title, monthly: plan135.goal.monthly_display?.replace(/\s*\/\s*month/iu, ''), monthlyLabel: loanOriginator ? null : 'closings / month', annual: plan135.goal.annual_display?.replace(/\s*\/\s*year/iu, ''), annualLabel: loanOriginator ? null : 'closings / year', horizon: plan135.goal.horizon, classification: plan135.goal.epistemic_class },
        ways: plan135.ways.map((way) => ({ status: way.status, title: way.title, destinationState: way.destination_state || null, whyPriority: way.why_priority || null })),
        strategies: planStrategyObjects,
        oneMove: { status: plan135.one_move.status, title: plan135.one_move.title, intervention: moveCustomer?.intervention || plan135.one_move.intervention, whyAlongside: ownershipTransfer ? 'Build production while beginning leverage. These two work together.' : plan135.one_move.why_alongside, proofBoundary: plan135.one_move.proof_boundary },
        completion: { goal: true, way1: !loanOriginator, way2: false, way3: false },
      },
      evidence: {
        eyebrow: 'The Evidence', headline: 'See exactly what MORE knows — and how we know it.', subhead: 'Every important conclusion connects to customer evidence, bounded calculations, modeled requirements, or explicitly identified inference.',
        categories: evidenceCategories, ledger: evidenceRows, coverage: source.businessMap?.engines?.map((engine) => ({ territory: engine.title, confidence: engine.confidence, known: engine.metrics.filter((metric) => classifyEpistemic(metric.qualifier) === 'REPORTED').length, inferred: engine.metrics.filter((metric) => classifyEpistemic(metric.qualifier) === 'INFERRED').length, missing: engine.metrics.filter((metric) => classifyEpistemic(metric.qualifier) === 'MISSING').length })) || [],
        counterevidence: source.evidence.counterevidence, mindChanges: source.evidence.mindChanges,
        truthColumns: [
          { label: 'Factual reality', title: 'What MORE knows', items: knownTruths },
          { label: 'Interpreted reality', title: 'What MORE believes is happening', items: interpretedTruths },
          { label: 'Open questions', title: 'What MORE still needs to know', items: highestValueMissing },
        ],
        traceCards: evidenceTraceCards,
        qualityKey: [
          { label: 'Known', meaning: 'Customer-reported or evidence-backed fact.' },
          { label: 'Calculated', meaning: 'Deterministic result from accepted inputs.' },
          { label: 'Inferred', meaning: 'Supported interpretation, not direct observation.' },
          { label: 'Modeled', meaning: 'Goal-supporting requirement or conditional estimate.' },
          { label: 'Missing', meaning: 'Important evidence not yet available.' },
          { label: 'Contradicted', meaning: 'Accepted evidence does not currently reconcile.' },
        ],
        highestValueMissing,
      },
    },
    livingMap: { headline: source.livingMap?.headline, copy: source.livingMap?.copy, action: source.livingMap?.action, active: false },
    objects: customerObjects,
    interaction: { drawer: 'CONTEXTUAL_OVER_DIMMED_LAYER_1', exact_return_state: true, provider_calls_on_click: 0, network_calls_on_click: 0, regeneration_on_click: false },
  }

  const projection = {
    customerViewModel: deepFreeze(customerLanguage(customerViewModel)),
    internalTrace: deepFreeze({
      contract_id: 'ba-progressive-disclosure-v1-projection',
      version: '1.0.0',
      bindings,
      objects: internalObjects,
      projection_trace: projectionTrace,
      source_object_count: Object.keys(source.inspectors).length,
      projected_object_count: Object.keys(internalObjects).length,
      provider_calls: 0,
      network_calls: 0,
      customer_mutation: false,
    }),
    validation: deepFreeze({ status: 'PASS', destinations: 5, layer3: false, probabilityTotal: probability.as_of_state.reduce((sum, item) => sum + item.probability, 0), planStrategies: plan135.strategies.length, waysOpen: loanOriginator ? 3 : 2, meaningfulObjects: Object.keys(customerObjects).length }),
  }
  validateProgressiveBusinessTwin(projection)
  return deepFreeze(projection)
}
