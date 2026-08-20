import { canonicalHash } from '../wholeBusinessModelV1/canonical.js';
import { FUTURE_ROLES } from './constants.js';
import { integrity } from './errors.js';

export function bindFrozenWholeBusinessModel(wholeBusinessModel) {
  integrity(wholeBusinessModel && typeof wholeBusinessModel === 'object', 'WBM_HASH_VERSION_CORRUPTION', 'Whole-Business Model object is required');
  integrity(wholeBusinessModel.contract_id === 'more-whole-business-model-v1', 'WBM_HASH_VERSION_CORRUPTION', 'Five Futures V2 requires WBM V1');
  integrity(wholeBusinessModel.contract_version === '1.0.0', 'WBM_HASH_VERSION_CORRUPTION', 'Unsupported WBM contract version');
  integrity(wholeBusinessModel.schema_version === '1.0.0', 'WBM_HASH_VERSION_CORRUPTION', 'Unsupported WBM schema version');
  integrity(wholeBusinessModel.assessment_identity?.business_id, 'WRONG_BUSINESS_PROFILE', 'WBM business binding is required');
  integrity(wholeBusinessModel.assessment_identity?.owner_profile_id, 'WRONG_BUSINESS_PROFILE', 'WBM owner binding is required');
  integrity(wholeBusinessModel.validation_receipt?.status === 'PASS', 'WBM_HASH_VERSION_CORRUPTION', 'WBM must carry a PASS validation receipt');
  integrity(wholeBusinessModel.runtime_boundaries?.five_futures_v2_implemented === false, 'WBM_HASH_VERSION_CORRUPTION', 'WBM upstream boundary drifted');
  const computedHash = canonicalHash({ ...wholeBusinessModel, state_hash: undefined });
  integrity(wholeBusinessModel.state_hash === computedHash, 'WBM_HASH_VERSION_CORRUPTION', 'WBM state hash mismatch');
  const contribution = wholeBusinessModel.downstream_contributions?.five_futures_v2;
  integrity(contribution?.roles?.join('|') === FUTURE_ROLES.join('|'), 'AUTHORITY_CORRUPTION', 'WBM Five Futures role contribution drifted');
  integrity(contribution.trajectories_generated === false && contribution.weights_computed === false, 'AUTHORITY_CORRUPTION', 'WBM upstream must not precompute Five Futures');
  return Object.freeze({
    business_id: wholeBusinessModel.assessment_identity.business_id,
    owner_profile_id: wholeBusinessModel.assessment_identity.owner_profile_id,
    whole_business_model_contract_version: wholeBusinessModel.contract_version,
    whole_business_model_schema_version: wholeBusinessModel.schema_version,
    whole_business_model_state_version: wholeBusinessModel.state_lineage.state_version,
    whole_business_model_hash: wholeBusinessModel.state_hash,
    authority_hashes: wholeBusinessModel.source_integrity.authority_hashes,
    bos_hash: wholeBusinessModel.frozen_whole_person_authority.bos_hash,
  });
}

export function buildFiveFuturesContext(wholeBusinessModel) {
  const binding = bindFrozenWholeBusinessModel(wholeBusinessModel);
  return Object.freeze({
    context_contract: 'five-futures-v2-wbm-context-v1',
    binding,
    business_model: wholeBusinessModel.business_model,
    current_business_reality: wholeBusinessModel.current_business_reality,
    domain_states: wholeBusinessModel.domain_states,
    causal_model: wholeBusinessModel.causal_model,
    governing_constraint: wholeBusinessModel.governing_constraint,
    assets: wholeBusinessModel.assets,
    vulnerabilities: wholeBusinessModel.vulnerabilities,
    momentum: wholeBusinessModel.momentum,
    person_business_synthesis: wholeBusinessModel.person_business_synthesis,
    team_organizational_synthesis: wholeBusinessModel.team_organizational_synthesis,
    epistemic_state: wholeBusinessModel.epistemic_state,
    open_questions: wholeBusinessModel.open_questions,
    dynamic_research: wholeBusinessModel.dynamic_research,
    authority_receipts: wholeBusinessModel.authority_receipts,
    evidence_refs: wholeBusinessModel.source_integrity.evidence_refs,
    executive_diagnostic_input: false,
  });
}
