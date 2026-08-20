import { buildSyntheticGeneralizationCandidate } from '../baV2CustomerRealization/buildSyntheticGeneralizationCandidate.js'
import { createBaProgressiveDisclosureV1 } from '../../lib/baProgressiveDisclosureV1/index.js'

const PATRICIA_BINDINGS = Object.freeze({
  subjectKey: 'PATRICIA_CANONICAL_BA_TRIPLET_V1',
  modelDate: 'Assessment snapshot · July 14, 2026',
  verticalAuthorityRefs: ['FROZEN_UNIVERSAL_BUSINESS_AUTHORITY_V1', 'FROZEN_REAL_ESTATE_VERTICAL_AUTHORITY_V1'],
  sourceAuthority: 'PATRICIA_FROZEN_WBM_FUTURES_ONE_MOVE_TRIPLET',
})

const SYNTHETIC_BINDINGS = Object.freeze({
  mid: {
    subjectKey: 'SYNTHETIC_GENERALIZATION_MID_V1',
    modelDate: 'Synthetic proof fixture · Mid-stage business',
    verticalAuthorityRefs: ['SYNTHETIC_VERTICAL_AUTHORITY_MID_V1'],
    sourceAuthority: 'SYNTHETIC_GENERALIZATION_PROOF_MID_V1',
  },
  top: {
    subjectKey: 'SYNTHETIC_GENERALIZATION_TOP_V1',
    modelDate: 'Synthetic proof fixture · Top-stage business',
    verticalAuthorityRefs: ['SYNTHETIC_VERTICAL_AUTHORITY_TOP_V1'],
    sourceAuthority: 'SYNTHETIC_GENERALIZATION_PROOF_TOP_V1',
  },
})

export async function loadBaProgressiveDisclosureV1(candidate = 'patricia') {
  if (candidate === 'synthetic-mid' || candidate === 'synthetic-top') {
    const stage = candidate === 'synthetic-mid' ? 'mid' : 'top'
    const source = buildSyntheticGeneralizationCandidate(stage)
    return createBaProgressiveDisclosureV1({ sourceViewModel: source.viewModel, bindings: SYNTHETIC_BINDINGS[stage] })
  }
  if (candidate !== 'patricia') throw new Error('BA_PD_CANDIDATE_NOT_AUTHORIZED')
  const source = await import('../baV2CustomerRealization/loadPatriciaBaV2Realization.js')
    .then(({ loadPatriciaBaV2Realization }) => loadPatriciaBaV2Realization())
  return createBaProgressiveDisclosureV1({ sourceViewModel: source.viewModel, bindings: PATRICIA_BINDINGS })
}

export { PATRICIA_BINDINGS, SYNTHETIC_BINDINGS }
