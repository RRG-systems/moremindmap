import { buildSyntheticGeneralizationCandidate } from '../lab/baV2CustomerRealization/buildSyntheticGeneralizationCandidate.js'
import { createBaProgressiveDisclosureV1 } from '../lib/baProgressiveDisclosureV1/index.js'

export const CURRENT_BA_REFERENCE_BINDINGS = Object.freeze({
  subjectKey: 'SYNTHETIC_GENERALIZATION_MID_V1',
  modelDate: 'Synthetic proof fixture · Mid-stage business',
  verticalAuthorityRefs: Object.freeze(['SYNTHETIC_VERTICAL_AUTHORITY_MID_V1']),
  sourceAuthority: 'SYNTHETIC_GENERALIZATION_PROOF_MID_V1',
})

export function loadCurrentBaReference() {
  const source = buildSyntheticGeneralizationCandidate('mid')
  return createBaProgressiveDisclosureV1({ sourceViewModel: source.viewModel, bindings: CURRENT_BA_REFERENCE_BINDINGS })
}
