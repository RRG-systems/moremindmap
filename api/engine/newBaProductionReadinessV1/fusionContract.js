import { isSha256, normalizeProfileId, sha256Stable, sha256Text } from './stable.js';

export const NEW_BA_BOS_FUSION_AUTHORITY_CONTRACT = 'new-ba-bos-fusion-authority-v1';
export const NEW_BA_BOS_FUSION_PROOF_CONTRACT = 'new-ba-bos-production-intended-fusion-proof-v1';

export const BOS_FUSION_CATEGORIES = Object.freeze([
  'operating_core',
  'work_relationships',
  'pressure_recovery',
  'role_seat',
  'cognitive_process',
  'energy_context',
]);

export const BOS_ALLOWED_CONTRIBUTIONS = Object.freeze([
  'execution_feasibility',
  'adoption_friction',
  'communication_leadership',
  'role_team',
  'intervention_design',
  'uncertainty_abstention',
]);

const RELATIONSHIP_USE = Object.freeze({
  FEASIBILITY_MODIFIER: 'execution_feasibility',
  COMMUNICATION_MODIFIER: 'communication_leadership',
  ROLE_TEAM_MODIFIER: 'role_team',
  INTERVENTION_DESIGN: 'intervention_design',
  NO_MATERIAL_LINK: 'uncertainty_abstention',
  ABSTAINED: 'uncertainty_abstention',
});

const CLAIM_CATEGORY_PRIMARY_USE = Object.freeze({
  operating_core: 'execution_feasibility',
  work_relationships: 'communication_leadership',
  pressure_recovery: 'adoption_friction',
  role_seat: 'role_team',
  cognitive_process: 'execution_feasibility',
  energy_context: 'execution_feasibility',
});

function relationshipContribution(relationship, claim) {
  if (['FEASIBILITY_MODIFIER', 'AMPLIFIES', 'COMPENSATES', 'FRICTION'].includes(relationship?.relationship_type)) return CLAIM_CATEGORY_PRIMARY_USE[claim.category];
  return RELATIONSHIP_USE[relationship?.relationship_type];
}

function invariant(condition, code) {
  if (!condition) throw new Error(code);
}

function hasForbiddenScoreField(value) {
  if (Array.isArray(value)) return value.some(hasForbiddenScoreField);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => (key !== 'personality_score_mapping' && /(?:^|_)(?:vector|dimension|personality)_?scores?(?:_|$)|canonical_scores/iu.test(key)) || hasForbiddenScoreField(child));
}

function stringList(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))];
}

function claimRef(profileId, category) {
  if (profileId === 'MM-20260708-DSST020Z') return `patricia-wpm-${category.replaceAll('_', '-')}-v1`
    .replace('work-relationships', 'work-relationships')
    .replace('pressure-recovery', 'pressure-recovery')
    .replace('role-seat', 'role-seat')
    .replace('cognitive-process', 'cognitive-process')
    .replace('energy-context', 'energy-context')
    .replace('operating-core', 'operating-core');
  return `bos-fusion:${profileId}:${category}`;
}

function selectConfidence(value) {
  return ['SUPPORTED_HYPOTHESIS', 'HIGH_CONFIDENCE', 'MODERATE_CONFIDENCE', 'LOW_CONFIDENCE', 'INSUFFICIENT_EVIDENCE'].includes(value)
    ? value
    : 'SUPPORTED_HYPOTHESIS';
}

function createClaim({ profileId, category, meaning, confidence, evidenceRefs, allowedUses }) {
  invariant(typeof meaning === 'string' && meaning.trim(), `new_ba_bos_fusion_claim_meaning_missing:${category}`);
  return Object.freeze({
    claim_ref: claimRef(profileId, category),
    category,
    meaning: meaning.trim(),
    meaning_sha256: sha256Text(meaning.trim()),
    confidence: selectConfidence(confidence),
    evidence_refs: Object.freeze(stringList(evidenceRefs)),
    allowed_uses: Object.freeze([...allowedUses]),
    business_cause_authority: false,
  });
}

export function projectBosFusionAuthorityFromArtifact({
  artifact,
  profileId,
  realizationId,
  artifactSha256,
  realizationVersion,
  custody = 'LATEST_COMPATIBLE_BOS_REALIZATION',
} = {}) {
  const profile = normalizeProfileId(profileId);
  invariant(artifact?.profile_id === profile, 'new_ba_bos_fusion_projection_profile_mismatch');
  invariant(isSha256(artifactSha256), 'new_ba_bos_fusion_projection_source_hash_invalid');
  const wpm = artifact.whole_person_model;
  const specialized = artifact.personality_dna?.specialized_intelligence;
  invariant(wpm && specialized, 'new_ba_bos_fusion_projection_authority_missing');
  const role = specialized.role_seat || {};
  const cognition = specialized.cognition || {};
  const energy = specialized.energy || {};
  const roleMeaning = stringList([role.selected_configuration, role.plural_success_note, role.fit_states?.[0]?.reasoning]).join(' ');
  const cognitionMeaning = (cognition.indicators || []).map((item) => item?.indicator).filter(Boolean).join(' ');
  const energyMeaning = stringList([energy.context?.summary, energy.trajectory?.summary]).join(' ');
  const claims = [
    createClaim({ profileId: profile, category: 'operating_core', meaning: wpm.core_explanation, confidence: wpm.confidence, evidenceRefs: wpm.evidence_refs, allowedUses: ['execution_feasibility', 'intervention_design', 'uncertainty_abstention'] }),
    createClaim({ profileId: profile, category: 'work_relationships', meaning: wpm.work_and_relationships, confidence: wpm.confidence, evidenceRefs: wpm.evidence_refs, allowedUses: ['communication_leadership', 'role_team', 'uncertainty_abstention'] }),
    createClaim({ profileId: profile, category: 'pressure_recovery', meaning: wpm.pressure_and_recovery, confidence: specialized.pressure_conflict?.transformations?.[0]?.confidence, evidenceRefs: specialized.pressure_conflict?.transformations?.[0]?.evidence_refs, allowedUses: ['adoption_friction', 'execution_feasibility', 'intervention_design', 'uncertainty_abstention'] }),
    createClaim({ profileId: profile, category: 'role_seat', meaning: roleMeaning, confidence: role.fit_states?.[0]?.confidence, evidenceRefs: role.fit_states?.[0]?.evidence_refs, allowedUses: ['role_team', 'execution_feasibility', 'intervention_design', 'uncertainty_abstention'] }),
    createClaim({ profileId: profile, category: 'cognitive_process', meaning: cognitionMeaning, confidence: cognition.indicators?.[0]?.confidence, evidenceRefs: (cognition.indicators || []).flatMap((item) => item?.evidence_refs || []), allowedUses: ['execution_feasibility', 'intervention_design', 'uncertainty_abstention'] }),
    createClaim({ profileId: profile, category: 'energy_context', meaning: energyMeaning, confidence: energy.context?.status, evidenceRefs: energy.context?.evidence_refs, allowedUses: ['execution_feasibility', 'communication_leadership', 'role_team', 'uncertainty_abstention'] }),
  ];
  return validateBosFusionAuthority({
    contract_id: NEW_BA_BOS_FUSION_AUTHORITY_CONTRACT,
    version: '1.0.0',
    profile_id: profile,
    source_realization_id: realizationId,
    source_artifact_sha256: artifactSha256,
    source_version: realizationVersion,
    custody,
    claims,
    boundary: {
      source_domain: 'BOS_WHOLE_PERSON',
      business_cause_authority: false,
      personality_score_mapping: 'PROHIBITED',
      business_evidence_mutation: false,
      allowed_contribution: 'EXECUTION_MODIFIER_ONLY',
    },
  });
}

export function buildSyntheticBosFusionAuthority({ profileId, realizationId, sourceArtifactSha256 } = {}) {
  const profile = normalizeProfileId(profileId);
  const synthetic = {
    contract_id: NEW_BA_BOS_FUSION_AUTHORITY_CONTRACT,
    version: '1.0.0',
    profile_id: profile,
    source_realization_id: realizationId,
    source_artifact_sha256: sourceArtifactSha256,
    source_version: 'authorized-synthetic-whole-person-proof-v1',
    custody: 'AUTHORIZED_SYNTHETIC_GENERALIZATION_PROOF',
    claims: [
      createClaim({ profileId: profile, category: 'operating_core', meaning: 'Prefers explicit decision boundaries and stable operating cadences when responsibility is distributed.', evidenceRefs: ['synthetic-bos-operating'], allowedUses: ['execution_feasibility', 'intervention_design', 'uncertainty_abstention'] }),
      createClaim({ profileId: profile, category: 'work_relationships', meaning: 'Works through clear ownership agreements and direct manager-to-manager coordination.', evidenceRefs: ['synthetic-bos-relationships'], allowedUses: ['communication_leadership', 'role_team', 'uncertainty_abstention'] }),
      createClaim({ profileId: profile, category: 'pressure_recovery', meaning: 'Under pressure, routine exceptions tend to be pulled back into direct leader review unless escalation boundaries remain visible.', evidenceRefs: ['synthetic-bos-pressure'], allowedUses: ['adoption_friction', 'execution_feasibility', 'intervention_design', 'uncertainty_abstention'] }),
      createClaim({ profileId: profile, category: 'role_seat', meaning: 'Current role fit supports setting outcome boundaries while managers retain routine operating decisions.', evidenceRefs: ['synthetic-bos-role'], allowedUses: ['role_team', 'execution_feasibility', 'intervention_design', 'uncertainty_abstention'] }),
      createClaim({ profileId: profile, category: 'cognitive_process', meaning: 'Decision adoption is easier when exception thresholds and review evidence are concrete.', evidenceRefs: ['synthetic-bos-cognition'], allowedUses: ['execution_feasibility', 'intervention_design', 'uncertainty_abstention'] }),
      createClaim({ profileId: profile, category: 'energy_context', meaning: 'Frequent unplanned approvals are treated as a feasibility burden, not as proof of a business cause.', evidenceRefs: ['synthetic-bos-energy'], allowedUses: ['execution_feasibility', 'communication_leadership', 'role_team', 'uncertainty_abstention'] }),
    ],
    boundary: {
      source_domain: 'BOS_WHOLE_PERSON',
      business_cause_authority: false,
      personality_score_mapping: 'PROHIBITED',
      business_evidence_mutation: false,
      allowed_contribution: 'EXECUTION_MODIFIER_ONLY',
    },
  };
  return validateBosFusionAuthority(synthetic);
}

export function validateBosFusionAuthority(authority, { profileId = authority?.profile_id } = {}) {
  const profile = normalizeProfileId(profileId);
  invariant(authority?.contract_id === NEW_BA_BOS_FUSION_AUTHORITY_CONTRACT, 'new_ba_bos_fusion_authority_contract_invalid');
  invariant(authority.profile_id === profile, 'new_ba_bos_fusion_authority_profile_mismatch');
  invariant(isSha256(authority.source_artifact_sha256), 'new_ba_bos_fusion_authority_source_hash_invalid');
  invariant(typeof authority.source_realization_id === 'string' && authority.source_realization_id, 'new_ba_bos_fusion_authority_realization_missing');
  invariant(Array.isArray(authority.claims) && authority.claims.length === BOS_FUSION_CATEGORIES.length, 'new_ba_bos_fusion_authority_claim_count_invalid');
  invariant(new Set(authority.claims.map((claim) => claim.claim_ref)).size === authority.claims.length, 'new_ba_bos_fusion_authority_claim_refs_not_unique');
  invariant(JSON.stringify(authority.claims.map((claim) => claim.category)) === JSON.stringify(BOS_FUSION_CATEGORIES), 'new_ba_bos_fusion_authority_categories_invalid');
  invariant(!hasForbiddenScoreField(authority), 'new_ba_bos_fusion_personality_score_field_prohibited');
  for (const claim of authority.claims) {
    invariant(typeof claim.meaning === 'string' && claim.meaning.trim(), `new_ba_bos_fusion_claim_meaning_missing:${claim.claim_ref}`);
    invariant(!claim.meaning_sha256 || claim.meaning_sha256 === sha256Text(claim.meaning), `new_ba_bos_fusion_claim_meaning_hash_invalid:${claim.claim_ref}`);
    invariant(claim.business_cause_authority === false, `new_ba_bos_fusion_business_cause_authority_prohibited:${claim.claim_ref}`);
    invariant(Array.isArray(claim.allowed_uses) && claim.allowed_uses.length > 0 && claim.allowed_uses.every((use) => BOS_ALLOWED_CONTRIBUTIONS.includes(use)), `new_ba_bos_fusion_claim_use_invalid:${claim.claim_ref}`);
    invariant(Array.isArray(claim.evidence_refs), `new_ba_bos_fusion_claim_evidence_invalid:${claim.claim_ref}`);
  }
  invariant(authority.boundary?.source_domain === 'BOS_WHOLE_PERSON', 'new_ba_bos_fusion_source_domain_invalid');
  invariant(authority.boundary?.business_cause_authority === false, 'new_ba_bos_fusion_business_cause_boundary_invalid');
  invariant(authority.boundary?.personality_score_mapping === 'PROHIBITED', 'new_ba_bos_fusion_score_mapping_boundary_invalid');
  invariant(authority.boundary?.business_evidence_mutation === false, 'new_ba_bos_fusion_evidence_mutation_prohibited');
  const { contract_sha256: ignoredContractSha256, evidence_boundary_sha256: ignoredEvidenceBoundarySha256, ...authorityCore } = authority;
  void ignoredContractSha256;
  void ignoredEvidenceBoundarySha256;
  const normalized = Object.freeze({
    ...authorityCore,
    claims: Object.freeze(authority.claims.map((claim) => Object.freeze({ ...claim, meaning_sha256: sha256Text(claim.meaning), evidence_refs: Object.freeze([...claim.evidence_refs]), allowed_uses: Object.freeze([...claim.allowed_uses]) }))),
    boundary: Object.freeze({ ...authority.boundary }),
  });
  const contractSha256 = sha256Stable(normalized);
  const evidenceBoundarySha256 = sha256Stable({
    profile_id: profile,
    source_artifact_sha256: normalized.source_artifact_sha256,
    claims: normalized.claims.map((claim) => ({ claim_ref: claim.claim_ref, meaning_sha256: claim.meaning_sha256, confidence: claim.confidence, evidence_refs: claim.evidence_refs, allowed_uses: claim.allowed_uses, business_cause_authority: claim.business_cause_authority })),
    boundary: normalized.boundary,
  });
  return Object.freeze({ ...normalized, contract_sha256: contractSha256, evidence_boundary_sha256: evidenceBoundarySha256 });
}

export function validateFusionRelationship(relationship, authority, assessmentId, { approvedBusinessEvidenceRefs = null } = {}) {
  const claim = authority.claims.find((candidate) => candidate.claim_ref === relationship?.whole_person_claim_ref);
  invariant(claim, `new_ba_bos_fusion_relationship_claim_unavailable:${relationship?.relationship_id || 'unknown'}`);
  const contribution = relationshipContribution(relationship, claim);
  invariant(contribution, `new_ba_bos_fusion_relationship_type_invalid:${relationship.relationship_id}`);
  invariant(claim.allowed_uses.includes(contribution), `new_ba_bos_fusion_relationship_use_not_allowed:${relationship.relationship_id}`);
  invariant(relationship.business_cause_established_by_personality === false, `new_ba_bos_fusion_personality_business_cause_prohibited:${relationship.relationship_id}`);
  invariant(typeof relationship.business_mechanism_ref === 'string' && relationship.business_mechanism_ref, `new_ba_bos_fusion_business_mechanism_missing:${relationship.relationship_id}`);
  invariant(Array.isArray(relationship.business_evidence_refs) && relationship.business_evidence_refs.length > 0, `new_ba_bos_fusion_business_evidence_missing:${relationship.relationship_id}`);
  if (approvedBusinessEvidenceRefs !== null) invariant(Array.isArray(approvedBusinessEvidenceRefs) && approvedBusinessEvidenceRefs.length > 0 && approvedBusinessEvidenceRefs.every(ref => String(ref).startsWith(`${assessmentId}-lo-`)), 'new_ba_bos_fusion_approved_scope_invalid');
  invariant(relationship.business_evidence_refs.every((ref) => approvedBusinessEvidenceRefs === null ? String(ref).startsWith(`${assessmentId}-q`) : approvedBusinessEvidenceRefs.includes(ref)), `new_ba_bos_fusion_business_evidence_scope_invalid:${relationship.relationship_id}`);
  invariant(Array.isArray(relationship.alternative_explanations) && relationship.alternative_explanations.length > 0, `new_ba_bos_fusion_alternative_explanation_missing:${relationship.relationship_id}`);
  invariant(typeof relationship.falsifier === 'string' && relationship.falsifier, `new_ba_bos_fusion_falsifier_missing:${relationship.relationship_id}`);
  return Object.freeze({ ...relationship, allowed_contribution: contribution });
}
