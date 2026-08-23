import {
  CONSTRAINT_TYPES,
  EPISTEMIC_CLASSES,
  FIVE_FUTURES_V2_ROLES,
  LATER_RUNTIME_BOUNDARIES,
  PERSON_BUSINESS_RELATIONSHIP_TYPES,
  PROJECTION_ELIGIBILITY,
  WBM_CONTRACT_ID,
  WBM_CONTRACT_VERSION,
  WBM_SCHEMA_VERSION,
} from './constants.js';
import { canonicalHash, isSha256, unique } from './canonical.js';
import { integrity } from './errors.js';

const PROHIBITED_KEYS = new Set([
  'customer_prose',
  'executive_diagnostic',
  'five_futures',
  'trajectories',
  'trajectory_weights',
  'normalized_relative_support',
  'one_move',
  'intervention_ranking',
  'probability_movement',
  'bayesian_posterior',
]);

function walkKeys(value, callback, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkKeys(item, callback, [...trail, index]));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    callback(key, child, [...trail, key]);
    walkKeys(child, callback, [...trail, key]);
  }
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function ensureArray(value, field) {
  integrity(Array.isArray(value), 'MALFORMED_STATE', `${field} must be an array`);
}

function ensureEpistemic(value, field) {
  integrity(EPISTEMIC_CLASSES.includes(value), 'MALFORMED_STATE', `${field} has invalid epistemic class ${value}`);
}

function evidenceRefsFromContext(context) {
  return new Set(context.business_evidence.map((item) => item.evidence_id));
}

function assertRefs(refs, evidenceIds, field, { allowEmpty = false } = {}) {
  ensureArray(refs, field);
  integrity(allowEmpty || refs.length > 0, 'MALFORMED_STATE', `${field} requires governed evidence references`);
  refs.forEach((ref) => integrity(evidenceIds.has(ref), 'CORRUPTED_EVIDENCE', `${field} references unknown evidence ${ref}`));
}

function validateClaim(claim, evidenceIds, field) {
  integrity(nonEmptyString(claim.claim_id), 'MALFORMED_STATE', `${field}.claim_id is required`);
  integrity(nonEmptyString(claim.meaning), 'MALFORMED_STATE', `${field}.meaning is required`);
  ensureEpistemic(claim.epistemic_class, `${field}.epistemic_class`);
  assertRefs(claim.evidence_refs || [], evidenceIds, `${field}.evidence_refs`, {
    allowEmpty: ['INSUFFICIENT_EVIDENCE', 'ABSTAINED'].includes(claim.epistemic_class),
  });
  ensureArray(claim.counterevidence_refs || [], `${field}.counterevidence_refs`);
  (claim.counterevidence_refs || []).forEach((ref) => integrity(evidenceIds.has(ref), 'CORRUPTED_EVIDENCE', `${field} references unknown counterevidence ${ref}`));
  ensureArray(claim.confounds || [], `${field}.confounds`);
  integrity(nonEmptyString(claim.falsifier) || ['KNOWN', 'INSUFFICIENT_EVIDENCE', 'ABSTAINED'].includes(claim.epistemic_class), 'MALFORMED_STATE', `${field}.falsifier is required for uncertain claims`);
}

function validateMechanism(mechanism, evidenceIds, index) {
  const field = `causal_model.mechanisms[${index}]`;
  integrity(nonEmptyString(mechanism.mechanism_id), 'MALFORMED_STATE', `${field}.mechanism_id is required`);
  integrity(nonEmptyString(mechanism.observed_symptom), 'MALFORMED_STATE', `${field}.observed_symptom is required`);
  integrity(nonEmptyString(mechanism.underlying_mechanism), 'MALFORMED_STATE', `${field}.underlying_mechanism is required`);
  ensureArray(mechanism.causal_chain, `${field}.causal_chain`);
  integrity(mechanism.causal_chain.length >= 2, 'MALFORMED_STATE', `${field}.causal_chain requires at least two links`);
  assertRefs(mechanism.evidence_refs, evidenceIds, `${field}.evidence_refs`, {
    allowEmpty: ['INSUFFICIENT_EVIDENCE', 'ABSTAINED'].includes(mechanism.epistemic_class),
  });
  ensureArray(mechanism.counterevidence_refs || [], `${field}.counterevidence_refs`);
  (mechanism.counterevidence_refs || []).forEach((ref) => integrity(evidenceIds.has(ref), 'CORRUPTED_EVIDENCE', `${field} references unknown counterevidence ${ref}`));
  ensureArray(mechanism.confounds, `${field}.confounds`);
  ensureArray(mechanism.delayed_effects, `${field}.delayed_effects`);
  ensureArray(mechanism.feedback_loops, `${field}.feedback_loops`);
  integrity(nonEmptyString(mechanism.falsifier), 'MALFORMED_STATE', `${field}.falsifier is required`);
  ensureEpistemic(mechanism.epistemic_class, `${field}.epistemic_class`);
  ensureArray(mechanism.affected_domains, `${field}.affected_domains`);
}

function validatePersonBusinessLink(link, context, evidenceIds, index) {
  const field = `person_business_synthesis[${index}]`;
  integrity(PERSON_BUSINESS_RELATIONSHIP_TYPES.includes(link.relationship_type), 'MALFORMED_STATE', `${field}.relationship_type is invalid`);
  integrity(nonEmptyString(link.business_mechanism_ref), 'MALFORMED_STATE', `${field}.business_mechanism_ref is required`);
  integrity(nonEmptyString(link.whole_person_claim_ref), 'MALFORMED_STATE', `${field}.whole_person_claim_ref is required`);
  const wpmRefs = new Set(context.frozen_whole_person_authority.selected_claims.map((claim) => claim.claim_id));
  integrity(wpmRefs.has(link.whole_person_claim_ref), 'CROSS_PROFILE_CONTAMINATION', `${field} references an unselected Whole-Person claim`);
  assertRefs(link.business_evidence_refs, evidenceIds, `${field}.business_evidence_refs`);
  ensureArray(link.alternative_explanations, `${field}.alternative_explanations`);
  ensureEpistemic(link.epistemic_class, `${field}.epistemic_class`);
  integrity(nonEmptyString(link.falsifier), 'MALFORMED_STATE', `${field}.falsifier is required`);
  integrity(link.business_cause_established_by_personality !== true, 'MALFORMED_STATE', `${field} may not establish business cause from personality`);
}

function validateTeamLink(link, context, evidenceIds, index) {
  const field = `team_organizational_synthesis[${index}]`;
  const selectedProfiles = new Set(context.team_context.selected_members.map((member) => member.profile_id));
  ensureArray(link.profile_refs, `${field}.profile_refs`);
  link.profile_refs.forEach((ref) => integrity(selectedProfiles.has(ref), 'CROSS_PROFILE_CONTAMINATION', `${field} references unselected team profile ${ref}`));
  assertRefs(link.business_evidence_refs, evidenceIds, `${field}.business_evidence_refs`);
  integrity(['INDIVIDUAL', 'RELATIONAL', 'ORGANIZATIONAL'].includes(link.intelligence_level), 'MALFORMED_STATE', `${field}.intelligence_level is invalid`);
  ensureArray(link.structural_explanations_tested, `${field}.structural_explanations_tested`);
  integrity(link.people_averaged !== true, 'MALFORMED_STATE', `${field} may not average people`);
}

export function validateWholeBusinessModel(model, context) {
  integrity(model && typeof model === 'object' && !Array.isArray(model), 'MALFORMED_STATE', 'WBM must be an object');
  walkKeys(model, (key, value, trail) => {
    integrity(!PROHIBITED_KEYS.has(key), 'MALFORMED_STATE', `Prohibited downstream field at ${trail.join('.')}`);
    if (/probability|percentage/iu.test(key)) {
      integrity(value === null || value === false, 'MALFORMED_STATE', `Unsupported probability/percentage field at ${trail.join('.')}`);
    }
  });
  integrity(model.contract_id === WBM_CONTRACT_ID, 'MALFORMED_STATE', 'Wrong WBM contract_id');
  integrity(model.contract_version === WBM_CONTRACT_VERSION, 'MALFORMED_STATE', 'Wrong WBM contract_version');
  integrity(model.schema_version === WBM_SCHEMA_VERSION, 'MALFORMED_STATE', 'Wrong WBM schema_version');
  for (const field of [
    'assessment_identity', 'frozen_whole_person_authority', 'source_integrity', 'authority_receipts',
    'governed_business_evidence', 'current_business_reality', 'business_model', 'domain_states',
    'person_business_synthesis', 'team_organizational_synthesis', 'causal_model', 'governing_constraint',
    'assets', 'vulnerabilities', 'momentum', 'epistemic_state', 'open_questions', 'dynamic_research',
    'projection_eligibility', 'state_lineage', 'downstream_contributions', 'runtime_boundaries',
  ]) integrity(model[field] !== undefined && model[field] !== null, 'MALFORMED_STATE', `WBM requires ${field}`);
  integrity(model.assessment_identity?.business_id === context.assessment_identity.business_id, 'WRONG_SUBJECT', 'WBM business binding drifted');
  integrity(model.assessment_identity?.owner_profile_id === context.assessment_identity.owner_profile_id, 'WRONG_SUBJECT', 'WBM owner binding drifted');
  integrity(model.assessment_identity?.assessment_id === context.assessment_identity.assessment_id, 'WRONG_SUBJECT', 'WBM assessment binding drifted');
  integrity(model.frozen_whole_person_authority?.bos_hash === context.frozen_whole_person_authority.bos_hash, 'BROKEN_AUTHORITY_HASH', 'WBM Whole-Person hash drifted');
  integrity(model.source_integrity?.context_hash === context.context_hash, 'CORRUPTED_EVIDENCE', 'WBM context hash drifted');
  integrity(isSha256(model.source_integrity?.context_hash), 'CORRUPTED_EVIDENCE', 'WBM context hash must be SHA-256');
  const expectedAuthorityHashes = context.selection_receipt.authority_hashes;
  integrity(canonicalHash(model.source_integrity.authority_hashes) === canonicalHash(expectedAuthorityHashes), 'BROKEN_AUTHORITY_HASH', 'WBM authority hash set drifted');
  const evidenceIds = evidenceRefsFromContext(context);
  ensureArray(model.authority_receipts, 'authority_receipts');
  integrity(model.authority_receipts.length > 0, 'MALFORMED_STATE', 'WBM requires at least one authority receipt');
  integrity(canonicalHash(model.authority_receipts[0]) === canonicalHash(context.selection_receipt), 'BROKEN_AUTHORITY_HASH', 'WBM authority receipt drifted');
  ensureArray(model.governed_business_evidence, 'governed_business_evidence');
  const governedRefs = model.governed_business_evidence.map((entry) => entry.evidence_ref);
  integrity(canonicalHash([...governedRefs].sort()) === canonicalHash([...evidenceIds].sort()), 'CORRUPTED_EVIDENCE', 'WBM governed evidence reference set drifted');
  integrity(model.current_business_reality && typeof model.current_business_reality === 'object' && !Array.isArray(model.current_business_reality), 'MALFORMED_STATE', 'current_business_reality must be an object');
  integrity(model.business_model && typeof model.business_model === 'object' && !Array.isArray(model.business_model), 'MALFORMED_STATE', 'business_model must be an object');
  assertRefs(model.business_model.evidence_refs, evidenceIds, 'business_model.evidence_refs', {
    allowEmpty: evidenceIds.size === 0,
  });
  ensureArray(model.domain_states, 'domain_states');
  integrity(model.domain_states.length > 0, 'MALFORMED_STATE', 'WBM requires domain states');
  model.domain_states.forEach((domain, index) => {
    integrity(nonEmptyString(domain.domain_id), 'MALFORMED_STATE', `domain_states[${index}].domain_id is required`);
    ensureEpistemic(domain.epistemic_class, `domain_states[${index}].epistemic_class`);
    ensureArray(domain.claims, `domain_states[${index}].claims`);
    domain.claims.forEach((claim, claimIndex) => validateClaim(claim, evidenceIds, `domain_states[${index}].claims[${claimIndex}]`));
    ensureArray(domain.missing_evidence, `domain_states[${index}].missing_evidence`);
  });
  ensureArray(model.causal_model?.mechanisms, 'causal_model.mechanisms');
  integrity(model.causal_model.mechanisms.length > 0, 'MALFORMED_STATE', 'WBM needs at least one causal mechanism');
  model.causal_model.mechanisms.forEach((mechanism, index) => validateMechanism(mechanism, evidenceIds, index));
  integrity(CONSTRAINT_TYPES.includes(model.governing_constraint?.constraint_type), 'MALFORMED_STATE', 'Governing constraint type is invalid');
  ensureEpistemic(model.governing_constraint.epistemic_class, 'governing_constraint.epistemic_class');
  if (model.governing_constraint.constraint_type !== 'insufficient_evidence') {
    assertRefs(model.governing_constraint.evidence_refs, evidenceIds, 'governing_constraint.evidence_refs');
    integrity(nonEmptyString(model.governing_constraint.falsifier), 'MALFORMED_STATE', 'Governing constraint requires falsifier');
  }
  ensureArray(model.governing_constraint.alternatives, 'governing_constraint.alternatives');
  ensureArray(model.person_business_synthesis, 'person_business_synthesis');
  model.person_business_synthesis.forEach((link, index) => validatePersonBusinessLink(link, context, evidenceIds, index));
  ensureArray(model.team_organizational_synthesis, 'team_organizational_synthesis');
  model.team_organizational_synthesis.forEach((link, index) => validateTeamLink(link, context, evidenceIds, index));
  ensureArray(model.assets, 'assets');
  model.assets.forEach((asset, index) => validateClaim(asset, evidenceIds, `assets[${index}]`));
  ensureArray(model.vulnerabilities, 'vulnerabilities');
  model.vulnerabilities.forEach((item, index) => validateClaim(item, evidenceIds, `vulnerabilities[${index}]`));
  integrity(['IMPROVING', 'DETERIORATING', 'STABLE', 'MIXED', 'UNCERTAIN'].includes(model.momentum?.direction), 'MALFORMED_STATE', 'Momentum direction is invalid');
  ensureArray(model.momentum.leading_indicators, 'momentum.leading_indicators');
  ensureArray(model.momentum.lagging_indicators, 'momentum.lagging_indicators');
  const momentumMayAbstain = model.momentum.direction === 'UNCERTAIN'
    && ['INSUFFICIENT_EVIDENCE', 'ABSTAINED'].includes(model.momentum.epistemic_class);
  assertRefs(model.momentum.evidence_refs, evidenceIds, 'momentum.evidence_refs', { allowEmpty: momentumMayAbstain });
  ensureEpistemic(model.momentum.epistemic_class, 'momentum.epistemic_class');
  ensureArray(model.open_questions, 'open_questions');
  ensureArray(model.dynamic_research, 'dynamic_research');
  model.dynamic_research.forEach((item, index) => {
    integrity(item.dynamic_research_warranted === true, 'MALFORMED_STATE', `dynamic_research[${index}] requires warranted=true`);
    integrity(nonEmptyString(item.research_question), 'MALFORMED_STATE', `dynamic_research[${index}] requires research_question`);
    integrity(nonEmptyString(item.authority), 'MALFORMED_STATE', `dynamic_research[${index}] requires authority`);
    integrity(nonEmptyString(item.expected_decision_impact), 'MALFORMED_STATE', `dynamic_research[${index}] requires expected_decision_impact`);
  });
  for (const purpose of ['five_futures_v2', 'one_move_v2']) {
    integrity(PROJECTION_ELIGIBILITY.includes(model.projection_eligibility?.[purpose]?.status), 'MALFORMED_STATE', `${purpose} eligibility is invalid`);
  }
  integrity(model.state_lineage?.state_version >= 1, 'LINEAGE_CORRUPTION', 'state_version must be >= 1');
  integrity(nonEmptyString(model.state_lineage?.created_at) && Number.isFinite(Date.parse(model.state_lineage.created_at)), 'LINEAGE_CORRUPTION', 'state_lineage.created_at is invalid');
  integrity(model.state_lineage?.input_hash === context.input_receipt.input_hash, 'LINEAGE_CORRUPTION', 'state_lineage input hash drifted');
  integrity(model.state_lineage?.prior_state === null || isSha256(model.state_lineage?.prior_state?.state_hash), 'LINEAGE_CORRUPTION', 'prior_state hash is invalid');
  integrity(model.downstream_contributions?.five_futures_v2?.roles.join('|') === FIVE_FUTURES_V2_ROLES.join('|'), 'MALFORMED_STATE', 'Five Futures contribution roles drifted');
  integrity(model.downstream_contributions.five_futures_v2.trajectories_generated === false, 'MALFORMED_STATE', 'WBM may not generate trajectories');
  integrity(model.downstream_contributions.five_futures_v2.weights_computed === false, 'MALFORMED_STATE', 'WBM may not compute trajectory weights');
  integrity(model.downstream_contributions.one_move_v2.candidates_ranked === false, 'MALFORMED_STATE', 'WBM may not rank One Move candidates');
  integrity(model.downstream_contributions.one_move_v2.move_selected === false, 'MALFORMED_STATE', 'WBM may not select One Move');
  integrity(canonicalHash(model.runtime_boundaries) === canonicalHash(LATER_RUNTIME_BOUNDARIES), 'MALFORMED_STATE', 'Later-runtime boundaries drifted');
  const mechanismIds = model.causal_model.mechanisms.map((mechanism) => mechanism.mechanism_id);
  integrity(unique(mechanismIds).length === mechanismIds.length, 'MALFORMED_STATE', 'Duplicate causal mechanism IDs');
  const validationReceipt = {
    validator_version: 'whole-business-model-validator-v1',
    status: 'PASS',
    business_id: model.assessment_identity.business_id,
    context_hash: context.context_hash,
    selected_authority_count: context.selection_receipt.selected_authority_ids.length,
    business_evidence_count: context.business_evidence.length,
    domain_state_count: model.domain_states.length,
    causal_mechanism_count: model.causal_model.mechanisms.length,
    person_business_link_count: model.person_business_synthesis.length,
    team_link_count: model.team_organizational_synthesis.length,
    contradiction_count: model.epistemic_state?.contradictions?.length || 0,
    missing_evidence_count: model.epistemic_state?.missing_evidence?.length || 0,
    five_futures_v2_implemented: false,
    one_move_v2_implemented: false,
  };
  validationReceipt.receipt_hash = canonicalHash(validationReceipt);
  return Object.freeze(validationReceipt);
}
