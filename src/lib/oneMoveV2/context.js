import { canonicalHash } from '../wholeBusinessModelV1/canonical.js';
import { getAuthority, loadFrozenAuthorityLibrary, selectAuthoritySections } from '../wholeBusinessModelV1/authorityLibrary.js';
import { bindFrozenWholeBusinessModel } from '../fiveFuturesV2/wbmBinding.js';
import { validateFiveFuturesV2 } from '../fiveFuturesV2/validator.js';
import { AUTHORITY_ROUTE_BY_CONSTRAINT, FUTURE_ROLES } from './constants.js';
import { integrity } from './errors.js';
import { loadFrozenScriptIntelligence, selectRelevantScriptIntelligence } from './scriptLibrary.js';

const INTERVENTION_SECTIONS = Object.freeze([
  'Causal Mechanisms',
  'Evidence Inputs',
  'Counterexamples and Confounds',
  'Falsifiers',
  'Intervention Relevance',
]);

function selectInterventionAuthorities(wbm, library) {
  const allowed = new Set(wbm.authority_receipts[0].selected_authority_ids);
  const route = AUTHORITY_ROUTE_BY_CONSTRAINT[wbm.governing_constraint.constraint_type] || AUTHORITY_ROUTE_BY_CONSTRAINT.mixed;
  const selectedIds = route.filter((authorityId) => allowed.has(authorityId)).slice(0, 6);
  integrity(selectedIds.length > 0 && selectedIds.length < 12, 'AUTHORITY_CORRUPTION', 'One Move authority selection must be selective');
  return selectedIds.map((authorityId) => {
    const authority = getAuthority(library, authorityId);
    const sections = selectAuthoritySections(authority, INTERVENTION_SECTIONS);
    return Object.freeze({
      authority_id: authorityId,
      version: authority.version,
      sha256: authority.sha256,
      selected_sections: sections,
    });
  });
}

function verifyFiveFutures(fiveFutures, binding) {
  integrity(fiveFutures?.artifact_hash, 'FIVE_FUTURES_HASH_CORRUPTION', 'Frozen Five Futures artifact hash is required');
  integrity(fiveFutures.artifact_hash === canonicalHash({ ...fiveFutures, artifact_hash: undefined }), 'FIVE_FUTURES_HASH_CORRUPTION', 'Five Futures artifact hash drifted');
  validateFiveFuturesV2(fiveFutures, binding);
  integrity(fiveFutures.futures.map((future) => future.future_role).join('|') === FUTURE_ROLES.join('|'), 'MALFORMED_ONE_MOVE', 'Five Futures roles drifted');
}

export function buildOneMoveContext(wholeBusinessModel, fiveFutures, options = {}) {
  const binding = bindFrozenWholeBusinessModel(wholeBusinessModel);
  verifyFiveFutures(fiveFutures, binding);
  integrity(fiveFutures.business_id === wholeBusinessModel.assessment_identity.business_id, 'WRONG_BUSINESS_PROFILE', 'WBM and Five Futures business identity differ');
  integrity(fiveFutures.owner_profile_id === wholeBusinessModel.assessment_identity.owner_profile_id, 'WRONG_BUSINESS_PROFILE', 'WBM and Five Futures owner identity differ');
  const library = options.library || loadFrozenAuthorityLibrary(options);
  const selectedAuthorities = selectInterventionAuthorities(wholeBusinessModel, library);
  const base = { wbm: wholeBusinessModel };
  const scriptLibrary = options.scriptLibrary || loadFrozenScriptIntelligence(options);
  const scripts = selectRelevantScriptIntelligence(base, scriptLibrary);
  const context = {
    context_contract: 'one-move-v2-governed-context-v1',
    binding: {
      business_id: binding.business_id,
      owner_profile_id: binding.owner_profile_id,
      whole_business_model_version: binding.whole_business_model_state_version,
      whole_business_model_hash: binding.whole_business_model_hash,
      five_futures_version: fiveFutures.contract_version,
      five_futures_hash: fiveFutures.artifact_hash,
      authority_hashes: binding.authority_hashes,
      bos_hash: binding.bos_hash,
      script_registry_hash: scriptLibrary.registry_hash,
      script_library_hash: scriptLibrary.library_hash,
    },
    governing_constraint: wholeBusinessModel.governing_constraint,
    causal_mechanisms: wholeBusinessModel.causal_model.mechanisms,
    assets: wholeBusinessModel.assets,
    vulnerabilities: wholeBusinessModel.vulnerabilities,
    momentum: wholeBusinessModel.momentum,
    epistemic_state: wholeBusinessModel.epistemic_state,
    evidence_refs: wholeBusinessModel.source_integrity.evidence_refs,
    whole_person_execution_context: wholeBusinessModel.person_business_synthesis,
    team_execution_context: wholeBusinessModel.team_organizational_synthesis,
    dynamic_context: wholeBusinessModel.dynamic_research,
    futures: fiveFutures.futures.map((future) => ({
      future_role: future.future_role,
      future_id: future.future_id,
      governing_mechanisms: future.governing_mechanisms,
      required_changes: future.required_changes,
      leading_indicators: future.leading_indicators,
      falsifiers: future.falsifiers,
      normalized_relative_support_weight: future.normalized_relative_support_weight,
      support_semantics: future.support_semantics,
    })),
    selected_intervention_authorities: selectedAuthorities,
    selected_script_intelligence: scripts,
    selection_authority_receipt: {
      purpose: 'one_move_v2_candidate_generation',
      selected_authority_ids: selectedAuthorities.map((item) => item.authority_id),
      selected_section_ids: selectedAuthorities.flatMap((authority) => authority.selected_sections.map((section) => section.section_id)),
      selected_script_ids: scripts.map((script) => script.script_id),
      excluded_all_authority_dump: true,
    },
    customer_prose_input: false,
    rsl_input: false,
  };
  context.context_hash = canonicalHash(context);
  return Object.freeze(context);
}

