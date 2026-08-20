import {
  boundedList,
  clamp,
  deepFreeze,
  invariant,
  largestRemainder,
  textArray,
} from './utils.js'

export const FUTURE_ROLE_ORDER = Object.freeze([
  'current_course',
  'emerging_future',
  'better_future',
  'bold_future',
  'downside_future',
])

export const FUTURE_ROLE_LABELS = Object.freeze({
  current_course: 'Current Course',
  emerging_future: 'Emerging Future',
  better_future: 'Better Future',
  bold_future: 'Bold Future',
  downside_future: 'Downside Future',
})

function categoryCount(viewModel, id) {
  const value = viewModel.evidence?.categories?.find((category) => category.id === id)?.value
  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function deriveSignals(viewModel) {
  const known = categoryCount(viewModel, 'known')
  const inferred = categoryCount(viewModel, 'inferred')
  const missing = categoryCount(viewModel, 'missing')
  const contradicted = categoryCount(viewModel, 'contradicted')
  const evidenceTotal = Math.max(1, known + inferred + missing + contradicted)
  const evidenceCompleteness = clamp((known + inferred * 0.35) / evidenceTotal, 0.12, 0.92)
  const missingness = clamp((missing + contradicted * 1.5) / evidenceTotal, 0.04, 0.72)
  const mechanismCount = viewModel.why?.mechanisms?.length || 0
  const activeConstraintStrength = clamp(0.42 + mechanismCount * 0.045 + contradicted * 0.035, 0.35, 0.9)
  const proofCount = viewModel.move?.proof?.length || 0
  const stepCount = viewModel.move?.firstSteps?.length || 0
  const interventionReadiness = clamp(0.28 + Math.min(4, proofCount) * 0.08 + Math.min(3, stepCount) * 0.06, 0.3, 0.82)
  return { known, inferred, missing, contradicted, evidenceCompleteness, missingness, activeConstraintStrength, interventionReadiness }
}

function findSection(inspector, pattern) {
  return inspector?.level2?.find((section) => pattern.test(section.title))?.items || []
}

function defaultReasoningAdapter({ futures, viewModel, signals }) {
  const { activeConstraintStrength: constraint, evidenceCompleteness: completeness, missingness, interventionReadiness: readiness } = signals
  const modifiers = {
    current_course: 1 + constraint * 0.18 + (1 - completeness) * 0.06,
    emerging_future: 1 + readiness * 0.08 - constraint * 0.03,
    better_future: 1 + readiness * 0.18 - constraint * 0.04,
    bold_future: 1 + readiness * 0.1 - missingness * 0.08,
    downside_future: 1 + constraint * 0.22 + missingness * 0.12 - readiness * 0.06,
  }
  const moveModifiers = {
    current_course: 0.78,
    emerging_future: 1.12,
    better_future: 1.34,
    bold_future: 1.14,
    downside_future: 0.72,
  }
  return {
    asOfPropensities: futures.map((future) => future.weight * modifiers[future.role]),
    ifMoveWorksPropensities: futures.map((future) => future.weight * modifiers[future.role] * moveModifiers[future.role]),
    basis: futures.map((future) => {
      const inspector = viewModel.inspectors?.[future.inspectorId]
      return {
        role: future.role,
        supporting_evidence: boundedList([
          ...findSection(inspector, /what we know|observed/iu),
          ...textArray(inspector?.level1?.helps),
        ], 5),
        opposing_evidence: boundedList([
          ...findSection(inspector, /counterevidence|works against/iu),
          ...textArray(inspector?.level1?.hurts),
        ], 5),
        causal_mechanisms: boundedList(viewModel.why?.mechanisms?.map((mechanism) => mechanism.label) || [], 4),
        required_conditions: boundedList([future.condition, inspector?.level1?.goal], 4),
        missing_evidence: boundedList(findSection(inspector, /missing/iu), 5),
        assumptions: boundedList(findSection(inspector, /infer/iu), 5),
        falsifiers: boundedList(findSection(inspector, /change our mind/iu), 5),
        sensitivity_notes: [
          future.role === 'downside_future' || future.role === 'current_course'
            ? 'Active constraints increase this path while durable evidence of changed operating behavior remains limited.'
            : 'This path gains probability only as its required operating conditions become true and observable.',
          'The One Move scenario is conditional on the bounded intervention working as defined; it is not a promised effect.',
        ],
      }
    }),
  }
}

function confidenceFor(signals, basis) {
  const completenessScore = signals.evidenceCompleteness - signals.missingness * 0.25
  const level = completenessScore >= 0.68 ? 'MODERATE_HIGH' : completenessScore >= 0.42 ? 'MODERATE' : 'LOW_MODERATE'
  return {
    level,
    evidence_quality: signals.known > 0 ? 'MIXED_GOVERNED_EVIDENCE' : 'LIMITED_EVIDENCE',
    rationale: basis.missing_evidence.length
      ? 'The estimate is evidence-bound, but material missing or contradictory operating evidence limits confidence.'
      : 'The estimate is supported by the governed current state; future conditions remain inherently uncertain.',
  }
}

function validateReasoning(reasoning, count) {
  invariant(Array.isArray(reasoning?.asOfPropensities) && reasoning.asOfPropensities.length === count, 'BA_PD_PROBABILITY_AS_OF_PROPENSITY_SHAPE')
  invariant(Array.isArray(reasoning?.ifMoveWorksPropensities) && reasoning.ifMoveWorksPropensities.length === count, 'BA_PD_PROBABILITY_MOVE_PROPENSITY_SHAPE')
  invariant(reasoning.asOfPropensities.every((value) => Number.isFinite(value) && value > 0), 'BA_PD_PROBABILITY_AS_OF_PROPENSITY_VALUE')
  invariant(reasoning.ifMoveWorksPropensities.every((value) => Number.isFinite(value) && value > 0), 'BA_PD_PROBABILITY_MOVE_PROPENSITY_VALUE')
  invariant(Array.isArray(reasoning.basis) && reasoning.basis.length === count, 'BA_PD_PROBABILITY_BASIS_SHAPE')
}

export function validateFiveFuturesProbabilityV1(artifact) {
  invariant(artifact?.contract_id === 'five-futures-probability-v1', 'BA_PD_PROBABILITY_CONTRACT_ID')
  invariant(artifact?.version === '1.0.0', 'BA_PD_PROBABILITY_VERSION')
  invariant(artifact.probability_semantics === 'MODEL_ESTIMATED_CONDITIONAL_TRAJECTORY_PROBABILITY_V1', 'BA_PD_PROBABILITY_SEMANTICS')
  invariant(artifact.calibration_status === 'NOT_EMPIRICALLY_CALIBRATED_V1', 'BA_PD_PROBABILITY_CALIBRATION_STATUS')
  for (const vectorName of ['as_of_state', 'if_one_move_works']) {
    const vector = artifact[vectorName]
    invariant(Array.isArray(vector) && vector.length === 5, `BA_PD_PROBABILITY_${vectorName.toUpperCase()}_SHAPE`)
    invariant(JSON.stringify(vector.map((item) => item.role)) === JSON.stringify(FUTURE_ROLE_ORDER), `BA_PD_PROBABILITY_${vectorName.toUpperCase()}_ROLE_ORDER`)
    invariant(vector.every((item) => Number.isInteger(item.probability) && item.probability > 0 && item.probability < 100), `BA_PD_PROBABILITY_${vectorName.toUpperCase()}_RANGE`)
    invariant(vector.reduce((sum, item) => sum + item.probability, 0) === 100, `BA_PD_PROBABILITY_${vectorName.toUpperCase()}_TOTAL`)
  }
  invariant(artifact.as_of_state.every((item) => item.confidence && item.confidence.level), 'BA_PD_PROBABILITY_CONFIDENCE_MISSING')
  invariant(artifact.as_of_state.every((item) => Array.isArray(item.basis.supporting_evidence) && Array.isArray(item.basis.opposing_evidence) && Array.isArray(item.basis.missing_evidence) && Array.isArray(item.basis.falsifiers)), 'BA_PD_PROBABILITY_BASIS_INCOMPLETE')
  invariant(!/guaranteed|destiny|calibrated accuracy|historical frequency/iu.test(JSON.stringify(artifact)), 'BA_PD_PROBABILITY_CERTAINTY_INFLATION')
  return true
}

export function createFiveFuturesProbabilityV1({ viewModel, bindings = {}, reasoningAdapter = defaultReasoningAdapter }) {
  invariant(viewModel?.futures?.items?.length === 5, 'BA_PD_PROBABILITY_FUTURES_MISSING')
  const futures = viewModel.futures.items.map((future) => ({ ...future, weight: Number(future.weight) }))
  invariant(JSON.stringify(futures.map((future) => future.role)) === JSON.stringify(FUTURE_ROLE_ORDER), 'BA_PD_PROBABILITY_SOURCE_ROLE_ORDER')
  invariant(futures.every((future) => Number.isFinite(future.weight) && future.weight >= 0), 'BA_PD_PROBABILITY_SOURCE_SUPPORT_INVALID')
  invariant(futures.reduce((sum, future) => sum + future.weight, 0) === 100, 'BA_PD_PROBABILITY_SOURCE_SUPPORT_TOTAL')
  const signals = deriveSignals(viewModel)
  const reasoning = reasoningAdapter({ futures, viewModel, signals })
  validateReasoning(reasoning, futures.length)
  const asOf = largestRemainder(reasoning.asOfPropensities)
  const ifMoveWorks = largestRemainder(reasoning.ifMoveWorksPropensities)
  const basisByRole = Object.fromEntries(reasoning.basis.map((basis) => [basis.role, basis]))
  const asOfState = futures.map((future, index) => {
    const basis = basisByRole[future.role]
    invariant(basis, `BA_PD_PROBABILITY_BASIS_ROLE_MISSING_${future.role}`)
    return {
      role: future.role,
      label: FUTURE_ROLE_LABELS[future.role],
      title: future.title,
      probability: asOf[index],
      confidence: confidenceFor(signals, basis),
      basis,
      source_future_id: future.id,
    }
  })
  const moveState = futures.map((future, index) => ({
    role: future.role,
    label: FUTURE_ROLE_LABELS[future.role],
    title: future.title,
    probability: ifMoveWorks[index],
    condition: 'The canonical One Move works as defined and its proof conditions hold across repeated cycles.',
    confidence: confidenceFor(signals, basisByRole[future.role]),
    basis: basisByRole[future.role],
    source_future_id: future.id,
  }))
  const artifact = {
    contract_id: 'five-futures-probability-v1',
    version: '1.0.0',
    identity: {
      subject_key: bindings.subjectKey || viewModel.identity?.business,
      business: viewModel.identity?.business,
      vertical: viewModel.identity?.vertical,
    },
    bindings: {
      ...bindings,
      source_future_roles: FUTURE_ROLE_ORDER,
      source_support_semantics: viewModel.futures.semantics,
      one_move_title: viewModel.move?.title,
    },
    probability_semantics: 'MODEL_ESTIMATED_CONDITIONAL_TRAJECTORY_PROBABILITY_V1',
    calibration_status: 'NOT_EMPIRICALLY_CALIBRATED_V1',
    estimator: 'BOUNDED_JOINT_TRAJECTORY_ESTIMATOR_V1',
    as_of_state: asOfState,
    if_one_move_works: moveState,
    evidence_state: signals,
    customer_boundary: {
      expose_probability: true,
      expose_confidence_separately: true,
      expose_probability_recipe: false,
      expose_private_reasoning: false,
    },
    validation: {
      role_order: 'PASS',
      as_of_total: asOf.reduce((sum, value) => sum + value, 0),
      if_move_works_total: ifMoveWorks.reduce((sum, value) => sum + value, 0),
      casual_extremes: 'PASS',
      probability_confidence_separation: 'PASS',
    },
  }
  validateFiveFuturesProbabilityV1(artifact)
  return deepFreeze(artifact)
}

export { defaultReasoningAdapter as createBoundedProbabilityReasoning }
