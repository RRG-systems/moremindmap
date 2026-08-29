import { buildSyntheticGeneralizationCandidate } from '../lab/baV2CustomerRealization/buildSyntheticGeneralizationCandidate.js';
import { createBaProgressiveDisclosureV1 } from '../lib/baProgressiveDisclosureV1/index.js';
import { createSyntheticRealEstateFounderViewModelV1 } from '../lab/subscriptionLivingBusinessRelationshipV1/createSyntheticRealEstateFounderSubjectsV1.js';

const SYNTHETIC_TOP_BINDINGS = Object.freeze({
  subjectKey: 'SYNTHETIC_GENERALIZATION_TOP_V1',
  modelDate: 'Synthetic proof fixture · Top-stage business',
  verticalAuthorityRefs: ['SYNTHETIC_VERTICAL_AUTHORITY_TOP_V1'],
  sourceAuthority: 'SYNTHETIC_GENERALIZATION_PROOF_TOP_V1',
});

export function createSyntheticJordanBusinessTwinViewModel() {
  const source = buildSyntheticGeneralizationCandidate('top');
  const realization = createBaProgressiveDisclosureV1({
    sourceViewModel: source.viewModel,
    bindings: SYNTHETIC_TOP_BINDINGS,
  });
  return createSyntheticRealEstateFounderViewModelV1(realization.customerViewModel, 're-mid');
}
