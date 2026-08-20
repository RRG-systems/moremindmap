import businessTwin from './pinnedAuthority/PATRICIA_BUSINESS_TWIN_V1.json' with { type: 'json' };
import customerSafeTwin from './pinnedAuthority/PATRICIA_CUSTOMER_SAFE_BUSINESS_TWIN_VIEW_V1.json' with { type: 'json' };
import eToP from './pinnedAuthority/PATRICIA_E_TO_P_STATE_V1.json' with { type: 'json' };
import lensTraversal from './pinnedAuthority/PATRICIA_DIAGNOSTIC_LENS_TRAVERSAL_V1.json' with { type: 'json' };
import vbrm from './pinnedAuthority/PATRICIA_VERTICAL_BUSINESS_REALITY_V1.json' with { type: 'json' };
import doctrine from './pinnedAuthority/MORE_MINDMAP_GENERATIVE_BUSINESS_INTELLIGENCE_DOCTRINE_V1.json' with { type: 'json' };
import futures from './pinnedAuthority/PATRICIA_FIVE_FUTURES_V2.json' with { type: 'json' };
import lineage from './pinnedAuthority/PATRICIA_CANONICAL_TRIPLET_LINEAGE_MANIFEST_V1.json' with { type: 'json' };
import oneMove from './pinnedAuthority/PATRICIA_ONE_MOVE_V2.json' with { type: 'json' };
import wbm from './pinnedAuthority/PATRICIA_WHOLE_BUSINESS_MODEL_V1.json' with { type: 'json' };

import { createBaProgressiveDisclosureV1 } from '../../../src/lib/baProgressiveDisclosureV1/index.js';
import { buildBaV2CustomerRealization } from '../../../src/lab/baV2CustomerRealization/buildBaV2CustomerRealization.js';
import { buildSyntheticGeneralizationCandidate } from '../../../src/lab/baV2CustomerRealization/buildSyntheticGeneralizationCandidate.js';

import { PATRICIA_ANSWER_SHA256, PATRICIA_PROFILE_ID, SYNTHETIC_TOP_PROFILE_ID } from './canonicalReader.js';
import { validateCompleteNewBaRealization } from './completeness.js';
import { NEW_BA_FROZEN_AUTHORITY } from './frozenAuthority.js';
import { assembleBosBaFusionProof } from './fusionAssembler.js';
import { normalizeProfileId, sha256Stable } from './stable.js';

const PATRICIA_FILE_DIGESTS = Object.freeze({
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
});

function buildPatriciaSourceViewModel(source) {
  for (const [key, hash] of Object.entries(PATRICIA_ANSWER_SHA256)) {
    if (source.business_evidence.answer_sha256[key] !== hash) throw new Error(`new_ba_patricia_${key}_hash_drift`);
  }
  if (wbm.state_hash !== 'd51d01c4e807a3341e6b76178c8e33a0050d7bb0653b887aaaf0bfc515255eba') throw new Error('new_ba_patricia_wbm_hash_drift');
  if (futures.artifact_hash !== 'b245bcb9f12ef7e1cd02c6d1433ee733cff51a85a873bb98fe652db05a00d148') throw new Error('new_ba_patricia_futures_hash_drift');
  if (oneMove.artifact_hash !== '2e087bc4ea5b56212e7fefa5b00a33bbbb1c13e651351ca956176a017f4f4447') throw new Error('new_ba_patricia_one_move_hash_drift');
  if (lineage.cross_artifact_lineage_hash !== '21af9b7c7a687a4f6cc2fd35d5566c18b10f9e72de072600f203331fda6f566a') throw new Error('new_ba_patricia_lineage_hash_drift');
  return buildBaV2CustomerRealization({
    businessTwin,
    vbrm,
    customerSafeTwin,
    eToP,
    lensTraversal,
    wbm,
    futures,
    oneMove,
    lineage,
    doctrine,
    fileDigests: PATRICIA_FILE_DIGESTS,
  }).viewModel;
}

function realize(source) {
  const profileId = normalizeProfileId(source.profile_id);
  let sourceViewModel;
  let businessReality;
  let canonicalFutures;
  let canonicalOneMove;
  let canonicalLineage;
  let sourceAuthority;
  if (profileId === PATRICIA_PROFILE_ID) {
    sourceViewModel = buildPatriciaSourceViewModel(source);
    businessReality = wbm;
    canonicalFutures = futures;
    canonicalOneMove = oneMove;
    canonicalLineage = lineage;
    sourceAuthority = 'PATRICIA_FROZEN_WBM_FUTURES_ONE_MOVE_TRIPLET';
  } else if (profileId === SYNTHETIC_TOP_PROFILE_ID) {
    const synthetic = buildSyntheticGeneralizationCandidate('top');
    sourceViewModel = synthetic.viewModel;
    businessReality = synthetic.businessTwin;
    canonicalFutures = { contract_id: 'authorized-synthetic-five-futures-proof-v1', futures: synthetic.viewModel.futures.items };
    canonicalOneMove = { contract_id: 'authorized-synthetic-one-move-proof-v1', title: synthetic.viewModel.move.title, intervention: synthetic.viewModel.move.intervention };
    canonicalLineage = { contract_id: 'authorized-synthetic-lineage-proof-v1', proof_subject: synthetic.validation.proofSubject, hash: sha256Stable(synthetic.businessTwin) };
    sourceAuthority = 'AUTHORIZED_SYNTHETIC_GENERALIZATION_TOP_V1';
  } else {
    throw new Error('new_ba_canary_realization_profile_not_supported');
  }
  const progressive = createBaProgressiveDisclosureV1({
    sourceViewModel,
    bindings: {
      subjectKey: profileId,
      modelDate: source.business_evidence.created_at,
      verticalAuthorityRefs: ['FROZEN_UNIVERSAL_BUSINESS_AUTHORITY_V1', 'FROZEN_REAL_ESTATE_VERTICAL_AUTHORITY_V1'],
      sourceAuthority,
    },
  });
  const baseArtifact = {
    contract_id: 'new-ba-production-realization-v2',
    version: '2.0.0',
    profile_id: profileId,
    assessment_id: source.assessment_id,
    source_kind: source.source_kind,
    authority: NEW_BA_FROZEN_AUTHORITY,
    business_reality: businessReality,
    five_futures: canonicalFutures,
    one_move: canonicalOneMove,
    plan_135: progressive.plan135,
    evidence: sourceViewModel.evidence,
    lineage: canonicalLineage,
    customer_view_model: progressive.customerViewModel,
    internal_trace: progressive.internalTrace,
    provider_accounting: Object.freeze({
      model: 'gpt-5.6-sol',
      store: false,
      calls: 0,
      accepted_precomputed_frontier_stages: profileId === PATRICIA_PROFILE_ID ? 3 : 0,
      customer_data_egress: false,
    }),
  };
  const fusion = assembleBosBaFusionProof({ source, artifact: baseArtifact });
  const artifact = Object.freeze({ ...baseArtifact, fusion });
  validateCompleteNewBaRealization(artifact);
  return artifact;
}

export function createFrozenCanaryRealizationGenerator() {
  return Object.freeze({
    generator_id: 'new-ba-frozen-authority-canary-realization-generator-v1',
    provider_calls: 0,
    store: false,
    async generate({ source }) {
      const artifact = realize(source);
      return Object.freeze({ artifact, provider_accounting: artifact.provider_accounting });
    },
  });
}
