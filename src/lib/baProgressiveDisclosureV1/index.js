import { createGeneralizedPlan135V1 } from './plan135.js'
import { createFiveFuturesProbabilityV1 } from './probability.js'
import { buildProgressiveBusinessTwin } from './projection.js'
import { deepFreeze, invariant } from './utils.js'

export function createBaProgressiveDisclosureV1({ sourceViewModel, bindings = {}, reasoningAdapter }) {
  invariant(sourceViewModel?.identity && sourceViewModel?.inspectors, 'BA_PD_REALIZATION_SOURCE_MISSING')
  const probability = createFiveFuturesProbabilityV1({ viewModel: sourceViewModel, bindings, reasoningAdapter })
  const plan135 = createGeneralizedPlan135V1({ viewModel: sourceViewModel, probability, bindings })
  const projection = buildProgressiveBusinessTwin({ sourceViewModel, probability, plan135, bindings })
  return deepFreeze({
    contract_id: 'ba-progressive-disclosure-v1-phase-2-combined-build',
    version: '1.0.0',
    probability,
    plan135,
    ...projection,
  })
}

export { createFiveFuturesProbabilityV1, validateFiveFuturesProbabilityV1 } from './probability.js'
export { createGeneralizedPlan135V1, validateGeneralizedPlan135V1 } from './plan135.js'
export { buildProgressiveBusinessTwin, validateProgressiveBusinessTwin } from './projection.js'
