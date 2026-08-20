import { canonicalHash } from '../wholeBusinessModelV1/canonical.js';
import {
  FIVE_FUTURES_V2_CONTRACT_ID,
  FIVE_FUTURES_V2_CONTRACT_VERSION,
  FIVE_FUTURES_V2_SCHEMA_VERSION,
  FUTURE_RUNTIME_BOUNDARIES,
  LEGACY_COEXISTENCE,
  SUPPORT_SEMANTICS,
} from './constants.js';
import { createTrajectoryGenerationAdapter } from './trajectoryContract.js';
import { validateUnweightedFutures } from './unweightedValidator.js';
import { applyDeterministicRelativeSupport } from './weighting.js';
import { buildFiveFuturesContext } from './wbmBinding.js';
import { validateFiveFuturesV2 } from './validator.js';

export async function buildFiveFuturesV2(wholeBusinessModel, { trajectoryAdapter } = {}) {
  if (!trajectoryAdapter || typeof trajectoryAdapter.generate !== 'function') {
    throw new TypeError('five_futures_v2_requires_trajectory_generation_adapter');
  }
  const context = buildFiveFuturesContext(wholeBusinessModel);
  const unweighted = await trajectoryAdapter.generate(context);
  validateUnweightedFutures(unweighted, context);
  const weighted = applyDeterministicRelativeSupport(unweighted);
  const futures = weighted.futures.map((future) => Object.freeze({
    ...future,
    whole_business_model_version: context.binding.whole_business_model_state_version,
    whole_business_model_hash: context.binding.whole_business_model_hash,
    authority_versions: context.binding.authority_hashes,
  }));
  const artifact = {
    contract_id: FIVE_FUTURES_V2_CONTRACT_ID,
    contract_version: FIVE_FUTURES_V2_CONTRACT_VERSION,
    schema_version: FIVE_FUTURES_V2_SCHEMA_VERSION,
    business_id: context.binding.business_id,
    owner_profile_id: context.binding.owner_profile_id,
    whole_business_model_binding: context.binding,
    support_semantics: SUPPORT_SEMANTICS,
    futures,
    normalization: weighted.normalization,
    authority_versions: context.binding.authority_hashes,
    legacy_coexistence: LEGACY_COEXISTENCE,
    one_move_interface: {
      status: 'STRUCTURED_FUTURES_AVAILABLE_ONE_MOVE_V2_NOT_IMPLEMENTED',
      provides: ['future_role', 'governing_mechanisms', 'required_changes', 'leading_indicators', 'falsifiers', 'relative_support_weight'],
      probability_movement_claims: false,
    },
    runtime_boundaries: FUTURE_RUNTIME_BOUNDARIES,
  };
  const validationReceipt = validateFiveFuturesV2(artifact, context.binding);
  artifact.validation_receipt = validationReceipt;
  artifact.artifact_hash = canonicalHash({ ...artifact, artifact_hash: undefined });
  return Object.freeze({ context, artifact: Object.freeze(artifact), validation_receipt: validationReceipt });
}

export { createTrajectoryGenerationAdapter };
