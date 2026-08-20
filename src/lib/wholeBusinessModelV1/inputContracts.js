import { EPISTEMIC_CLASSES, WBM_DOMAINS } from './constants.js';
import { canonicalHash, isSha256, unique } from './canonical.js';
import { integrity } from './errors.js';

function isString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertTimestamp(value, field) {
  integrity(isString(value) && Number.isFinite(Date.parse(value)), 'MALFORMED_STATE', `${field} must be an ISO-compatible timestamp`);
}

function validateBusinessEvidence(evidence, businessId, ownerProfileId) {
  integrity(Array.isArray(evidence), 'MALFORMED_STATE', 'governed_business_evidence must be an array');
  const ids = new Set();
  for (const item of evidence) {
    integrity(isString(item.evidence_id), 'MALFORMED_STATE', 'Every business evidence item requires evidence_id');
    integrity(!ids.has(item.evidence_id), 'CORRUPTED_EVIDENCE', `Duplicate evidence_id ${item.evidence_id}`);
    ids.add(item.evidence_id);
    integrity(item.business_id === businessId, 'WRONG_SUBJECT', `Evidence ${item.evidence_id} is bound to another business`);
    if (item.profile_id) {
      integrity(item.profile_id === ownerProfileId, 'CROSS_PROFILE_CONTAMINATION', `Evidence ${item.evidence_id} contains another profile`);
    }
    integrity(WBM_DOMAINS.includes(item.domain), 'MALFORMED_STATE', `Evidence ${item.evidence_id} has unsupported domain ${item.domain}`);
    integrity(['DIRECT', 'DETERMINISTIC_CALCULATION', 'OPERATOR_REPORTED', 'DYNAMIC_EXTERNAL'].includes(item.evidence_class), 'MALFORMED_STATE', `Evidence ${item.evidence_id} has invalid class`);
    integrity(isString(item.source_ref), 'CORRUPTED_EVIDENCE', `Evidence ${item.evidence_id} requires source_ref`);
    assertTimestamp(item.observed_at, `evidence.${item.evidence_id}.observed_at`);
    integrity(item.value !== undefined, 'CORRUPTED_EVIDENCE', `Evidence ${item.evidence_id} requires a value`);
    if (item.evidence_class === 'DETERMINISTIC_CALCULATION') {
      integrity(isString(item.calculation_receipt), 'CORRUPTED_EVIDENCE', `Calculation ${item.evidence_id} requires a receipt`);
      integrity(Array.isArray(item.input_evidence_refs) && item.input_evidence_refs.length > 0, 'CORRUPTED_EVIDENCE', `Calculation ${item.evidence_id} requires input evidence refs`);
    }
  }
  for (const item of evidence) {
    for (const ref of item.input_evidence_refs || []) {
      integrity(ids.has(ref), 'CORRUPTED_EVIDENCE', `Calculation ${item.evidence_id} references unknown evidence ${ref}`);
    }
  }
  return ids;
}

function validateWholePerson(wholePerson, ownerProfileId) {
  integrity(wholePerson?.profile_id === ownerProfileId, 'WRONG_SUBJECT', 'Whole-Person Authority must be bound to the owner profile');
  integrity(isString(wholePerson.bos_version), 'MALFORMED_STATE', 'Whole-Person Authority requires bos_version');
  integrity(isSha256(wholePerson.bos_hash), 'BROKEN_AUTHORITY_HASH', 'Whole-Person Authority requires a SHA-256 bos_hash');
  integrity(Array.isArray(wholePerson.claims), 'MALFORMED_STATE', 'Whole-Person Authority claims must be an array');
  for (const claim of wholePerson.claims) {
    integrity(isString(claim.claim_id), 'MALFORMED_STATE', 'Whole-Person claim requires claim_id');
    integrity(isString(claim.meaning), 'MALFORMED_STATE', `Whole-Person claim ${claim.claim_id} requires governed meaning`);
    integrity(Array.isArray(claim.relevant_domains), 'MALFORMED_STATE', `Whole-Person claim ${claim.claim_id} requires relevant_domains`);
    integrity(EPISTEMIC_CLASSES.includes(claim.epistemic_class), 'MALFORMED_STATE', `Whole-Person claim ${claim.claim_id} requires an epistemic class`);
  }
}

function validateTeam(team, businessId, permittedProfileIds) {
  if (!team) return;
  integrity(team.business_id === businessId, 'WRONG_SUBJECT', 'Team socket is bound to another business');
  integrity(Array.isArray(team.members), 'MALFORMED_STATE', 'Team members must be an array');
  const ids = new Set();
  for (const member of team.members) {
    integrity(!ids.has(member.profile_id), 'CROSS_PROFILE_CONTAMINATION', `Duplicate team profile ${member.profile_id}`);
    ids.add(member.profile_id);
    integrity(member.business_id === businessId, 'CROSS_PROFILE_CONTAMINATION', `Team member ${member.profile_id} belongs to another business`);
    integrity(member.membership_status === 'ACTIVE', 'UNAUTHORIZED_TEAM_ACCESS', `Team member ${member.profile_id} is not active`);
    integrity(permittedProfileIds.includes(member.profile_id), 'UNAUTHORIZED_TEAM_ACCESS', `Team member ${member.profile_id} is outside request permissions`);
    integrity(isSha256(member.bos_hash), 'BROKEN_AUTHORITY_HASH', `Team member ${member.profile_id} lacks frozen BOS hash`);
    integrity(Array.isArray(member.permissions) && member.permissions.includes('WBM_CONTEXT'), 'UNAUTHORIZED_TEAM_ACCESS', `Team member ${member.profile_id} lacks WBM_CONTEXT permission`);
  }
}

export function validateWholeBusinessInputs(input) {
  integrity(input && typeof input === 'object', 'MALFORMED_STATE', 'Whole-Business inputs must be an object');
  const identity = input.assessment_identity;
  integrity(isString(identity?.business_id), 'MALFORMED_STATE', 'assessment_identity.business_id is required');
  integrity(isString(identity?.assessment_id), 'MALFORMED_STATE', 'assessment_identity.assessment_id is required');
  integrity(isString(identity?.owner_profile_id), 'MALFORMED_STATE', 'assessment_identity.owner_profile_id is required');
  integrity(identity?.vertical === 'real_estate', 'INVALID_CASSETTE', 'WBM V1 supports the frozen real_estate cassette only');
  integrity(identity?.completion_state === 'COMPLETE', 'MALFORMED_STATE', 'Assessment must be complete');
  assertTimestamp(identity.assessed_at, 'assessment_identity.assessed_at');
  validateWholePerson(input.frozen_whole_person_authority, identity.owner_profile_id);
  const evidenceIds = validateBusinessEvidence(
    input.governed_business_evidence,
    identity.business_id,
    identity.owner_profile_id,
  );
  validateTeam(input.team_authority, identity.business_id, input.authorization?.permitted_profile_ids || []);
  integrity(Array.isArray(input.missing_evidence), 'MALFORMED_STATE', 'missing_evidence must be an array');
  integrity(Array.isArray(input.contradictions), 'MALFORMED_STATE', 'contradictions must be an array');
  for (const contradiction of input.contradictions) {
    integrity(Array.isArray(contradiction.evidence_refs) && contradiction.evidence_refs.length >= 2, 'MALFORMED_STATE', 'Contradictions require at least two evidence refs');
    contradiction.evidence_refs.forEach((ref) => integrity(evidenceIds.has(ref), 'CORRUPTED_EVIDENCE', `Contradiction references unknown evidence ${ref}`));
  }
  const dynamicItems = input.dynamic_intelligence || [];
  for (const item of dynamicItems) {
    integrity(item.business_id === identity.business_id, 'WRONG_SUBJECT', `Dynamic item ${item.dynamic_id} is bound to another business`);
    integrity(item.canon_status === 'DYNAMIC_NOT_CANON', 'MALFORMED_STATE', `Dynamic item ${item.dynamic_id} must remain non-canonical`);
    assertTimestamp(item.observed_at, `dynamic.${item.dynamic_id}.observed_at`);
  }
  const evidenceDomains = unique(input.governed_business_evidence.map((item) => item.domain));
  return Object.freeze({
    business_id: identity.business_id,
    owner_profile_id: identity.owner_profile_id,
    evidence_ids: [...evidenceIds],
    evidence_domains: evidenceDomains,
    input_hash: canonicalHash(input),
  });
}
