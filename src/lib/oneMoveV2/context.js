import { canonicalHash } from '../wholeBusinessModelV1/canonical.js';
import { getAuthority, loadFrozenAuthorityLibrary, selectAuthoritySections } from '../wholeBusinessModelV1/authorityLibrary.js';
import { bindFrozenWholeBusinessModel } from '../fiveFuturesV2/wbmBinding.js';
import { validateFiveFuturesV2 } from '../fiveFuturesV2/validator.js';
import { AUTHORITY_ROUTE_BY_CONSTRAINT, FUTURE_ROLES } from './constants.js';
import { integrity } from './errors.js';
import { bindScopedScriptAbsence, loadFrozenScriptIntelligence, selectRelevantScriptIntelligence } from './scriptLibrary.js';

const INTERVENTION_SECTIONS = Object.freeze([
  'Causal Mechanisms',
  'Evidence Inputs',
  'Counterexamples and Confounds',
  'Falsifiers',
  'Intervention Relevance',
]);

export function oneMoveScopedSelectionHash({ authorityRouteByConstraint, scriptSelection }) {
  return canonicalHash({ authority_route_by_constraint: authorityRouteByConstraint, script_selection: scriptSelection });
}

function selectInterventionAuthorities(wbm, library, authorityRouteByConstraint) {
  const allowed = new Set(wbm.authority_receipts[0].selected_authority_ids);
  const routes = authorityRouteByConstraint === undefined ? AUTHORITY_ROUTE_BY_CONSTRAINT : authorityRouteByConstraint;
  if (authorityRouteByConstraint !== undefined) {
    integrity(routes && typeof routes === 'object' && !Array.isArray(routes), 'AUTHORITY_CORRUPTION', 'Cassette-owned authority routes are required');
    for (const ids of Object.values(routes)) {
      integrity(Array.isArray(ids) && ids.length > 0 && ids.every(id => typeof id === 'string' && id.length > 0)
        && new Set(ids).size === ids.length, 'AUTHORITY_CORRUPTION', 'Invalid cassette-owned authority route');
      // Validate the complete supplied route, including currently unselected IDs.
      // A foreign authority may not disappear silently through intersection.
      ids.forEach(id => getAuthority(library, id));
    }
  }
  const route = routes[wbm.governing_constraint.constraint_type] || routes.mixed;
  integrity(Array.isArray(route), 'AUTHORITY_CORRUPTION', 'No cassette-owned authority route for this constraint');
  const selectedIds = route.filter((authorityId) => allowed.has(authorityId)).slice(0, 6);
  integrity(selectedIds.length > 0 && selectedIds.length < 12, 'AUTHORITY_CORRUPTION', 'One Move authority selection must be selective');
  if (wbm.assessment_identity.vertical !== 'real_estate') {
    const verticalIds = new Set((library.vertical_bibles || []).map(item => item.authority_id));
    integrity(selectedIds.some(id => verticalIds.has(id)), 'AUTHORITY_CORRUPTION', 'One Move must retain selected authority from its own vertical');
  }
  return selectedIds.map((authorityId) => {
    const authority = getAuthority(library, authorityId);
    if (authorityRouteByConstraint !== undefined) {
      integrity(wbm.source_integrity.authority_hashes[authorityId] === authority.sha256,
        'AUTHORITY_CORRUPTION', 'Selected cassette authority differs from the frozen WBM source');
    }
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
  const vertical = wholeBusinessModel.assessment_identity.vertical;
  const scoped = vertical !== 'real_estate' || options.authorityRouteByConstraint !== undefined || options.scriptSelection !== undefined;
  if (scoped) {
    integrity(options.library && options.authorityRouteByConstraint && options.scriptSelection,
      'AUTHORITY_CORRUPTION', 'Scoped One Move requires its own library, authority route and explicit script selection');
    integrity(options.library.vertical_id === vertical, 'AUTHORITY_CORRUPTION', 'One Move library belongs to a different vertical');
    integrity(options.scriptLibrary === undefined, 'AUTHORITY_CORRUPTION', 'Scoped script absence may not fall back to a separate script catalog');
  }
  const library = options.library || loadFrozenAuthorityLibrary(options);
  const selectedAuthorities = selectInterventionAuthorities(wholeBusinessModel, library, options.authorityRouteByConstraint);
  const base = { wbm: wholeBusinessModel };
  const scriptLibrary = scoped ? bindScopedScriptAbsence(options.scriptSelection, library, vertical)
    : options.scriptLibrary || loadFrozenScriptIntelligence(options);
  const scripts = scoped ? scriptLibrary.scripts : selectRelevantScriptIntelligence(base, scriptLibrary);
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
      ...(scoped ? { scoped_selection_hash: oneMoveScopedSelectionHash(options) } : {}),
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
      ...(scoped ? { script_selection: scriptLibrary.selection,
        authority_route_hash: canonicalHash(options.authorityRouteByConstraint) } : {}),
    },
    customer_prose_input: false,
    rsl_input: false,
  };
  context.context_hash = canonicalHash(context);
  return Object.freeze(context);
}
