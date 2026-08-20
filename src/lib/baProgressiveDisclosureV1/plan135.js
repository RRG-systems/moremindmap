import {
  boundedList,
  classifyEpistemic,
  deepFreeze,
  findById,
  invariant,
} from './utils.js'

function allNumericalCards(viewModel) {
  return [
    ...(viewModel.quickFacts || []),
    ...(viewModel.businessMap?.goalBacksolve || []),
    ...(viewModel.numerical?.measurementScorecard || []),
    ...(viewModel.numerical?.systemStandards || []),
    ...(viewModel.numerical?.deeperScenarios || []),
  ]
}

function card(viewModel, id) {
  return findById(allNumericalCards(viewModel), id)
}

function constraintMode(viewModel) {
  const source = [
    viewModel.why?.title,
    viewModel.why?.summary,
    ...(viewModel.why?.mechanisms || []).map((mechanism) => mechanism.label),
  ].join(' ').toLowerCase()
  if (/decision.right|approval|manager authority|leadership.*bottleneck|routine decisions/u.test(source)) return 'DISTRIBUTED_DECISION_RIGHTS'
  if (/conversion|source.to.stage|stage.*inspect|follow.up.*service|response standard/u.test(source)) return 'VISIBLE_CONVERSION_SYSTEM'
  return 'RELATIONSHIP_ENGINE_WITH_LEVERAGE'
}

function sourceRef(value, fallback) {
  return value?.inspectorId || fallback
}

function numericalTarget(record) {
  if (!record) return null
  return {
    label: record.label,
    value: record.value,
    epistemic_class: classifyEpistemic(record.qualifier),
    qualifier: record.qualifier,
    source_ref: record.inspectorId,
  }
}

function makeStrategy({ id, mission, title, headline, description, goal, way, constraint, mechanism, verticalAuthorityRefs, target, firstAction, cadence, observationWindow, scorecard, proof, failure, feasibility, confidence, lineageRefs }) {
  return {
    strategy_id: id,
    mission,
    title,
    headline,
    description,
    way_relationship: way,
    goal_relationship: goal,
    constraint_relationship: constraint,
    mechanism_relationship: mechanism,
    vertical_authority_refs: [...verticalAuthorityRefs],
    numerical_target: target,
    epistemic_class: target?.epistemic_class || 'GOVERNED_STRATEGIC_ACTION',
    owner_boundary: 'The business owner sets the standard and decision boundary; execution ownership follows the accepted role design.',
    first_action: firstAction,
    cadence: cadence,
    observation_window: observationWindow,
    scorecard: boundedList(scorecard, 7),
    proof: boundedList(proof, 5),
    failure_or_stop: boundedList(failure, 4),
    execution_feasibility: boundedList(feasibility, 4),
    confidence,
    evidence_lineage_refs: boundedList(lineageRefs, 8),
  }
}

function relationshipStrategies(context) {
  const { viewModel, goal, way, constraint, mechanism, verticalAuthorityRefs } = context
  const relationshipTarget = card(viewModel, 'relationship-asset-target')
  const liveContactTarget = card(viewModel, 'live-contact-goal-pace')
  const pipelineTarget = card(viewModel, 'combined-pipeline-target')
  const shortTerm = card(viewModel, 'short-term-mindshare')
  const longTerm = card(viewModel, 'long-term-touch-floor')
  const proof = viewModel.move?.proof?.map((item) => item.label) || []
  const base = { goal, way, constraint, mechanism, verticalAuthorityRefs, observationWindow: 'Inspect weekly and reassess after enough repeated operating cycles to distinguish signal from a one-off result.', feasibility: viewModel.plan?.wholePerson || [], confidence: 'MODERATE · goal-supporting models and missing current-state evidence remain explicit' }
  return [
    makeStrategy({ ...base, id: 'strategy-relationship-asset', mission: 'GROW_RELATIONSHIP_ASSET', title: 'Grow the relationship asset', headline: relationshipTarget ? `Build toward ${relationshipTarget.value} qualified relationships` : 'Qualify and grow the relationship asset', description: 'Increase the number of relationships that actually meet the long-term qualification standard; do not treat raw contacts as qualified relationships.', target: numericalTarget(relationshipTarget), firstAction: 'Define the qualification standard, then classify the next small cohort before adding volume.', cadence: 'Add and qualify relationships every week.', scorecard: ['new relationships added', 'qualification conversations', 'qualified relationships', 'source and recency'], proof: ['The qualified relationship base grows without relabeling raw contacts.'], failure: ['Stop treating database size as progress if qualification and engagement do not improve.'], lineageRefs: [sourceRef(relationshipTarget, 'relationship-model'), viewModel.businessMap?.center?.inspectorId] }),
    makeStrategy({ ...base, id: 'strategy-opportunity-cadence', mission: 'CREATE_OPPORTUNITY_CADENCE', title: 'Create opportunity every day', headline: liveContactTarget ? `${liveContactTarget.value} live real-estate conversations per workday` : 'Establish a measured live-conversation cadence', description: 'Turn relationship access into observable opportunity through a measured live-conversation rhythm appropriate to the stated goal.', target: numericalTarget(liveContactTarget), firstAction: 'Start measuring live relationship conversations before treating the modeled pace as current reality.', cadence: 'Measure on working days; review the weekly pattern.', scorecard: ['live conversations', 'qualified next actions', 'appointments', 'referral opportunities'], proof: ['Opportunity creation becomes observable rather than assumed.'], failure: ['Change the target if source mix, conversion, capacity, or market evidence contradicts the model.'], lineageRefs: [sourceRef(liveContactTarget, 'opportunity-model'), viewModel.why?.inspectorId] }),
    makeStrategy({ ...base, id: 'strategy-weekly-scorecard', mission: 'CREATE_WEEKLY_SCORECARD', title: 'Know the numbers every week', headline: 'Track the business from live contacts through closings', description: 'Create one visible weekly scorecard so current reality, missing evidence, and goal-supporting models stop being confused.', target: null, firstAction: 'Record current live contacts, qualified additions, appointments, active opportunities, stage movement, and closings under stable definitions.', cadence: 'One short weekly operating review.', scorecard: ['live contacts', 'new relationships', 'referrals', 'appointments', 'active pipeline', 'closings'], proof: ['The team can explain movement and gaps without reconstructing the week from memory.'], failure: ['Simplify the scorecard if fields are incomplete or definitions drift.'], lineageRefs: [viewModel.evidence?.categories?.find((item) => item.id === 'missing')?.inspectorId, viewModel.why?.inspectorId] }),
    makeStrategy({ ...base, id: 'strategy-goal-pipeline', mission: 'BUILD_GOAL_PIPELINE', title: 'Build the pipeline the goal requires', headline: pipelineTarget ? `${pipelineTarget.value} active opportunities under a governed stage definition` : 'Make the goal-supporting pipeline visible', description: 'Separate current active opportunities from the modeled pipeline required by the stated goal, then measure the real gap.', target: numericalTarget(pipelineTarget), firstAction: 'Count active opportunities using one accepted stage definition before comparing the current business with the model.', cadence: 'Inspect stage entry, aging, and movement weekly.', scorecard: ['active listings', 'active buyers', 'stage aging', 'next action', 'conversion by stage'], proof: ['The business can see a real current-versus-required pipeline gap.'], failure: ['Do not retain the modeled target when observed source or conversion evidence changes the relationship.'], lineageRefs: [sourceRef(pipelineTarget, 'pipeline-model'), viewModel.numerical?.comparisons?.find((item) => /pipeline/iu.test(item.comparison_id))?.inspectorId] }),
    makeStrategy({ ...base, id: 'strategy-relationship-system', mission: 'SYSTEMATIZE_RELATIONSHIP_ENGINE', title: 'Systematize the relationship engine', headline: shortTerm && longTerm ? `${shortTerm.value} qualification → ${longTerm.value} long-term cadence` : 'Create a short-term qualification and long-term relationship cadence', description: 'Move new relationships through a bounded mindshare sequence, qualification, and a sustainable long-term cadence.', target: numericalTarget(shortTerm), firstAction: 'Choose one small cohort and define the transition from new relationship to qualified long-term nurture.', cadence: 'Inspect weekly completion and long-term next actions.', scorecard: ['short-term sequence completion', 'qualification decision', 'long-term additions', 'dated next action'], proof: ['More relationships enter an inspectable long-term system without relying on memory alone.', ...proof.slice(0, 1)], failure: ['Reduce complexity if the cadence cannot be maintained or produces activity without relationship quality.'], lineageRefs: [sourceRef(shortTerm, 'relationship-standard'), sourceRef(longTerm, 'relationship-standard'), viewModel.move?.inspectorId] }),
  ]
}

function conversionStrategies(context) {
  const { viewModel, goal, way, constraint, mechanism, verticalAuthorityRefs } = context
  const move = viewModel.move
  const base = { goal, way, constraint, mechanism, verticalAuthorityRefs, observationWindow: move?.observation || 'Eight consecutive weeks.', feasibility: viewModel.plan?.wholePerson || [], confidence: 'MODERATE_HIGH · current opportunity signals support a bounded conversion-system test' }
  const specs = [
    ['strategy-source-stage', 'DEFINE_SOURCE_STAGE_PATH', 'Define one source-to-stage path', 'Use one shared vocabulary from source through outcome.', 'Define the stages and required fields before the next review.', ['field completeness', 'opportunities by source', 'stage movement']],
    ['strategy-response-standard', 'SET_RESPONSE_STANDARD', 'Set response and next-action standards', 'Make timely follow-up inspectable for every new opportunity.', 'Agree the response window and required dated next action.', ['response time', 'next-action completeness', 'aged opportunities']],
    ['strategy-active-pipeline', 'MAKE_PIPELINE_INSPECTABLE', 'Keep the active pipeline complete', 'Backfill only live opportunities and preserve source, stage, owner, and next action.', 'Identify active opportunities and remove ambiguous stage labels.', ['active opportunities', 'stage aging', 'owner completeness']],
    ['strategy-conversion-review', 'INSPECT_CONVERSION_WEEKLY', 'Inspect conversion every week', 'Review exceptions and leakage by source before adding more demand.', 'Create the first source-to-stage exception list.', ['appointment rate', 'agreement rate', 'pipeline creation', 'loss reason']],
    ['strategy-source-decision', 'ALLOCATE_BY_EVIDENCE', 'Make source decisions from observed conversion', 'Keep, change, or stop activity only after the bounded observation window produces usable evidence.', 'Write the decision rule before the observation begins.', ['conversion by source', 'cost and effort by source', 'quality of outcome']],
  ]
  return specs.map(([id, mission, title, description, firstAction, scorecard], index) => makeStrategy({ ...base, id, mission, title, headline: description, description, target: null, firstAction, cadence: index === 1 ? 'Daily completeness; weekly review.' : 'Weekly.', scorecard, proof: move?.proof?.map((item) => item.label) || ['Leakage becomes visible and actionable.'], failure: move?.failure || ['Stop if records cannot be maintained or no useful distinction emerges.'], lineageRefs: [viewModel.why?.inspectorId, move?.inspectorId, viewModel.why?.mechanisms?.[Math.min(index, (viewModel.why?.mechanisms?.length || 1) - 1)]?.inspectorId] }))
}

function decisionRightsStrategies(context) {
  const { viewModel, goal, way, constraint, mechanism, verticalAuthorityRefs } = context
  const move = viewModel.move
  const base = { goal, way, constraint, mechanism, verticalAuthorityRefs, observationWindow: move?.observation || 'Four weeks of repeated operating decisions.', feasibility: viewModel.plan?.wholePerson || [], confidence: 'MODERATE_HIGH · opportunity is present while decision ownership remains the supported constraint' }
  const specs = [
    ['strategy-decision-inventory', 'MAP_RECURRING_DECISIONS', 'Map recurring operating decisions', 'Identify the decisions that repeatedly return to the leader and the outcome each protects.', 'Log recurring approvals and rescues for one working week.', ['decision type', 'current owner', 'escalation reason']],
    ['strategy-authority-bands', 'DEFINE_AUTHORITY_BANDS', 'Define decision-rights bands', 'Give the selected owner explicit authority, quality boundaries, and exception rules.', 'Choose one operating lane and write its authority band.', ['decisions made in band', 'exceptions', 'reversals']],
    ['strategy-exception-path', 'CREATE_EXCEPTION_PATH', 'Create one explicit exception path', 'Route true exceptions without turning every decision into consultation.', 'Define what must escalate, to whom, and with what evidence.', ['exception volume', 'decision latency', 'leader interruptions']],
    ['strategy-manager-scorecard', 'SCORE_OUTCOME_OWNERSHIP', 'Score manager-owned outcomes', 'Inspect completion, quality, decision fidelity, and rework rather than task volume alone.', 'Select the smallest outcome scorecard for the operating lane.', ['completion', 'quality', 'rework', 'decision fidelity']],
    ['strategy-decision-coaching', 'COACH_DECISION_QUALITY', 'Coach decision quality on a fixed cadence', 'Use scheduled evidence review to build judgment without restoring leader dependence.', 'Schedule the first short exception-and-outcome review.', ['independent decisions', 'repeat exceptions', 'capability gaps', 'released leader capacity']],
  ]
  return specs.map(([id, mission, title, description, firstAction, scorecard], index) => makeStrategy({ ...base, id, mission, title, headline: description, description, target: null, firstAction, cadence: index === 0 ? 'Daily capture for one week; weekly review after.' : 'Weekly.', scorecard, proof: move?.proof?.map((item) => item.label) || ['Routine decisions remain with the assigned owner.'], failure: move?.failure || ['Stop when authority, continuity, or quality boundaries are breached.'], lineageRefs: [viewModel.why?.inspectorId, move?.inspectorId, viewModel.why?.mechanisms?.[Math.min(index, (viewModel.why?.mechanisms?.length || 1) - 1)]?.inspectorId] }))
}

function wayDefinition(mode, viewModel) {
  if (mode === 'VISIBLE_CONVERSION_SYSTEM') return { title: 'Make Conversion Visible + Repeatable', destination_state: 'A source-to-stage system that makes follow-up, leakage, and conversion inspectable.', why_priority: viewModel.why.whyStronger }
  if (mode === 'DISTRIBUTED_DECISION_RIGHTS') return { title: 'Distribute Decision Rights + Manager Ownership', destination_state: 'Routine operating outcomes remain owned without depending on leader availability.', why_priority: viewModel.why.whyStronger }
  return { title: 'Build Your Relationship Engine + Begin Leverage', destination_state: 'A measured relationship engine supports the stated production goal while the One Move tests durable ownership.', why_priority: viewModel.why.whyStronger }
}

export function validateGeneralizedPlan135V1(artifact) {
  invariant(artifact?.contract_id === 'generalized-1-3-5-plan-v1', 'BA_PD_PLAN_CONTRACT_ID')
  invariant(artifact?.version === '1.0.0', 'BA_PD_PLAN_VERSION')
  invariant(artifact.goal && artifact.goal.title && artifact.goal.source_ref, 'BA_PD_PLAN_GOAL_MISSING')
  invariant(Array.isArray(artifact.ways) && artifact.ways.length === 3, 'BA_PD_PLAN_WAY_COUNT')
  invariant(artifact.ways[0].status === 'SELECTED_COMPLETE', 'BA_PD_PLAN_WAY_ONE_STATUS')
  invariant(artifact.ways[1].status === 'OPEN' && artifact.ways[2].status === 'OPEN', 'BA_PD_PLAN_OPEN_WAYS')
  invariant(artifact.ways[1].title === null && artifact.ways[2].title === null, 'BA_PD_PLAN_OPEN_WAY_CONTENT')
  invariant(Array.isArray(artifact.strategies) && artifact.strategies.length === 5, 'BA_PD_PLAN_STRATEGY_COUNT')
  invariant(new Set(artifact.strategies.map((strategy) => strategy.mission)).size === 5, 'BA_PD_PLAN_STRATEGY_MISSION_DUPLICATE')
  invariant(artifact.strategies.every((strategy) => strategy.evidence_lineage_refs.length > 0 && strategy.vertical_authority_refs.length > 0), 'BA_PD_PLAN_STRATEGY_LINEAGE_MISSING')
  invariant(artifact.strategies.every((strategy) => strategy.first_action && strategy.cadence && strategy.scorecard.length && strategy.proof.length && strategy.failure_or_stop.length), 'BA_PD_PLAN_STRATEGY_EXECUTION_INCOMPLETE')
  invariant(artifact.strategies.every((strategy) => strategy.title !== artifact.one_move.title && strategy.mission !== 'ONE_MOVE'), 'BA_PD_PLAN_ONE_MOVE_BECAME_STRATEGY')
  invariant(artifact.open_strategy_positions === 10, 'BA_PD_PLAN_OPEN_POSITION_COUNT')
  invariant(!/guaranteed|will definitely|certain success/iu.test(JSON.stringify(artifact)), 'BA_PD_PLAN_CERTAINTY_INFLATION')
  return true
}

export function createGeneralizedPlan135V1({ viewModel, probability, bindings = {} }) {
  invariant(viewModel?.identity && viewModel?.why && viewModel?.move, 'BA_PD_PLAN_SOURCE_MISSING')
  invariant(probability?.contract_id === 'five-futures-probability-v1', 'BA_PD_PLAN_PROBABILITY_BINDING')
  const monthlyGoal = card(viewModel, 'monthly-closing-goal')
  const annualGoal = card(viewModel, 'annual-closing-goal')
  invariant(monthlyGoal || annualGoal, 'BA_PD_PLAN_EXPLICIT_GOAL_MISSING')
  const mode = constraintMode(viewModel)
  const way = wayDefinition(mode, viewModel)
  const annualValue = annualGoal?.value
  const goalTitle = annualValue
    ? `Build toward ${annualValue} closings a year while ${mode === 'RELATIONSHIP_ENGINE_WITH_LEVERAGE' ? 'beginning to create leverage' : mode === 'VISIBLE_CONVERSION_SYSTEM' ? 'making conversion visible and repeatable' : 'distributing operating ownership'}.`
    : `Build toward ${monthlyGoal.value} while ${way.destination_state.toLowerCase()}`
  const goal = {
    goal_id: 'goal-1',
    title: goalTitle,
    monthly_display: monthlyGoal?.value || null,
    annual_display: annualGoal?.value || null,
    horizon: 'The stated goal horizon from the governed business state.',
    epistemic_class: classifyEpistemic(annualGoal?.qualifier || monthlyGoal?.qualifier),
    source_ref: annualGoal?.inspectorId || monthlyGoal?.inspectorId,
    current_gap: viewModel.numerical?.comparisons?.map((comparison) => comparison.gap) || [],
  }
  const constraint = viewModel.why.title
  const mechanism = viewModel.why.mechanisms?.[0]?.label || viewModel.why.summary
  const verticalAuthorityRefs = bindings.verticalAuthorityRefs || ['EXISTING_VERTICAL_INTELLIGENCE']
  const context = { viewModel, goal: goal.title, way: way.title, constraint, mechanism, verticalAuthorityRefs }
  const strategies = mode === 'VISIBLE_CONVERSION_SYSTEM'
    ? conversionStrategies(context)
    : mode === 'DISTRIBUTED_DECISION_RIGHTS'
      ? decisionRightsStrategies(context)
      : relationshipStrategies(context)
  const artifact = {
    contract_id: 'generalized-1-3-5-plan-v1',
    version: '1.0.0',
    identity: {
      subject_key: bindings.subjectKey || viewModel.identity.business,
      business: viewModel.identity.business,
      vertical: viewModel.identity.vertical,
    },
    bindings: {
      ...bindings,
      probability_contract: probability.contract_id,
      probability_role_order: probability.as_of_state.map((future) => future.role),
      one_move_title: viewModel.move.title,
      constraint_title: constraint,
    },
    goal,
    ways: [
      { way_id: 'way-1', status: 'SELECTED_COMPLETE', title: way.title, destination_state: way.destination_state, why_priority: way.why_priority, constraint_relationship: constraint, future_relationship: 'Way 1 is the highest-priority governed path for changing the present trajectory field; it does not guarantee a Future.', business_stage_fit: mode, prerequisites: viewModel.plan?.prerequisites || [], confidence: 'MODERATE', evidence_lineage_refs: boundedList([viewModel.why.inspectorId, goal.source_ref], 4) },
      { way_id: 'way-2', status: 'OPEN', title: null, destination_state: null, strategies: [] },
      { way_id: 'way-3', status: 'OPEN', title: null, destination_state: null, strategies: [] },
    ],
    strategies,
    open_strategy_positions: 10,
    one_move: {
      status: 'ALONGSIDE_PLAN_NOT_A_STRATEGY',
      title: viewModel.move.title,
      intervention: viewModel.move.intervention,
      why_alongside: 'The plan builds the selected business path while the One Move runs as a bounded proof experiment against the governing mechanism.',
      proof_boundary: 'Effectiveness must be observed through the canonical proof and failure conditions.',
      source_ref: viewModel.move.inspectorId,
    },
    customer_boundary: {
      ways_two_three_intentionally_open: true,
      build_the_rest_myself: true,
      living_map_bridge_explanatory_only: true,
      subscription_runtime_active: false,
    },
    validation: {
      goal_count: 1,
      way_socket_count: 3,
      selected_way_count: 1,
      strategy_count: strategies.length,
      open_strategy_positions: 10,
      one_move_outside_strategy_count: true,
      source_and_class_preservation: 'PASS',
    },
  }
  validateGeneralizedPlan135V1(artifact)
  return deepFreeze(artifact)
}

export { constraintMode as classifyPlanConstraintMode }
