import { normalizeAssessmentId, normalizeProfileId, sha256Stable } from './stable.js';
import { NEW_BA_BOS_FUSION_PROOF_CONTRACT, validateBosFusionAuthority, validateFusionRelationship } from './fusionContract.js';

function invariant(condition, code) {
  if (!condition) throw new Error(code);
}

function resolveWholePersonClaimReferences(source, artifact, authority, relationships) {
  const frozenWholePerson = artifact.business_reality?.frozen_whole_person_authority;
  invariant(frozenWholePerson?.bos_hash === source.bos_authority.sha256, 'new_ba_bos_fusion_wbm_bos_hash_mismatch');
  const selectedClaimRefs = frozenWholePerson.selected_claim_refs;
  invariant(Array.isArray(selectedClaimRefs) && selectedClaimRefs.length === authority.claims.length, 'new_ba_bos_fusion_wbm_claim_namespace_invalid');
  const providerClaimRefs = authority.claims.map((claim, index) => `WPC-${String(index + 1).padStart(2, '0')}`);
  const usesProviderNamespace = selectedClaimRefs.every((claimRef, index) => claimRef === providerClaimRefs[index]);
  const usesCanonicalNamespace = selectedClaimRefs.every((claimRef, index) => claimRef === authority.claims[index].claim_ref);
  invariant(usesProviderNamespace || usesCanonicalNamespace, 'new_ba_bos_fusion_wbm_claim_namespace_drift');
  const canonicalRefs = new Set(authority.claims.map((claim) => claim.claim_ref));
  const sourceAnswerInventory = Object.keys(source.business_evidence?.answers || {}).length > 0
    ? source.business_evidence.answers
    : source.business_evidence?.answer_sha256 || {};
  const sourceAnswerKeys = Object.keys(sourceAnswerInventory).sort((left, right) => Number(left.slice(1)) - Number(right.slice(1)));
  const canonicalBusinessEvidenceRefs = new Set(sourceAnswerKeys.map((key) => `${source.assessment_id}-${key}`));
  const providerBusinessEvidenceRefs = sourceAnswerKeys.map((_, index) => `BE-${String(index + 1).padStart(2, '0')}`);
  const wbmEvidenceRefs = artifact.business_reality?.source_integrity?.evidence_refs || artifact.business_reality?.governed_business_evidence?.map((item) => item.evidence_ref);
  const usesProviderBusinessEvidenceNamespace = Array.isArray(wbmEvidenceRefs)
    && JSON.stringify(wbmEvidenceRefs) === JSON.stringify(providerBusinessEvidenceRefs);
  const needsProviderBusinessEvidenceResolution = relationships.some((relationship) => (relationship?.business_evidence_refs || []).some((evidenceRef) => !canonicalBusinessEvidenceRefs.has(evidenceRef)));
  if (needsProviderBusinessEvidenceResolution) {
    const fullTwelve = JSON.stringify(sourceAnswerKeys) === JSON.stringify(Array.from({ length: 12 }, (_, index) => `q${index + 1}`));
    const evidenceSufficient = source.business_evidence?.evidence_sufficiency?.status === 'PASS';
    invariant((fullTwelve || evidenceSufficient) && sourceAnswerKeys.length > 0 && sourceAnswerKeys.every((key) => /^q(?:[1-9]|1[0-2])$/u.test(key)), 'new_ba_bos_fusion_business_evidence_source_invalid');
    invariant(usesProviderBusinessEvidenceNamespace, 'new_ba_bos_fusion_business_evidence_namespace_drift');
  }
  return Object.freeze(relationships.map((relationship) => {
    let wholePersonClaimRef = relationship?.whole_person_claim_ref;
    if (!canonicalRefs.has(wholePersonClaimRef)) {
      invariant(usesProviderNamespace, `new_ba_bos_fusion_relationship_claim_unavailable:${relationship?.relationship_id || 'unknown'}`);
      const index = providerClaimRefs.indexOf(wholePersonClaimRef);
      invariant(index >= 0, `new_ba_bos_fusion_relationship_claim_unavailable:${relationship?.relationship_id || 'unknown'}`);
      wholePersonClaimRef = authority.claims[index].claim_ref;
    }
    const businessEvidenceRefs = (relationship?.business_evidence_refs || []).map((evidenceRef) => {
      if (canonicalBusinessEvidenceRefs.has(evidenceRef)) return evidenceRef;
      invariant(usesProviderBusinessEvidenceNamespace, `new_ba_bos_fusion_business_evidence_scope_invalid:${relationship?.relationship_id || 'unknown'}`);
      const index = providerBusinessEvidenceRefs.indexOf(evidenceRef);
      invariant(index >= 0, `new_ba_bos_fusion_business_evidence_scope_invalid:${relationship?.relationship_id || 'unknown'}`);
      return `${source.assessment_id}-${sourceAnswerKeys[index]}`;
    });
    return Object.freeze({ ...relationship, whole_person_claim_ref: wholePersonClaimRef, business_evidence_refs: Object.freeze(businessEvidenceRefs) });
  }));
}

function syntheticRelationships(source, artifact) {
  const mechanism = artifact.business_reality?.whole_business_model?.governing_constraint?.mechanisms?.[0];
  invariant(typeof mechanism === 'string' && mechanism, 'new_ba_bos_fusion_synthetic_business_mechanism_missing');
  return Object.freeze([
    {
      relationship_id: 'synthetic-top-person-link-decision-boundary-adoption-v1',
      business_mechanism_ref: 'synthetic-top-mech-decision-rights-boundary-v1',
      business_mechanism_statement: mechanism,
      whole_person_claim_ref: `bos-fusion:${source.profile_id}:operating_core`,
      relationship_type: 'FEASIBILITY_MODIFIER',
      business_evidence_refs: [`${source.assessment_id}-q8`, `${source.assessment_id}-q10`],
      whole_person_evidence_refs: ['synthetic-bos-operating'],
      alternative_explanations: ['Role capability or operating design may determine adoption independently of the Whole-Person claim.'],
      epistemic_class: 'TENTATIVE',
      falsifier: 'A bounded authority trial shows no relationship between explicit decision boundaries and adoption.',
      intervention_implications: ['Use explicit authority bands and observable review evidence.'],
      business_cause_established_by_personality: false,
    },
    {
      relationship_id: 'synthetic-top-person-link-pressure-escalation-friction-v1',
      business_mechanism_ref: 'synthetic-top-mech-decision-rights-boundary-v1',
      business_mechanism_statement: mechanism,
      whole_person_claim_ref: `bos-fusion:${source.profile_id}:pressure_recovery`,
      relationship_type: 'FRICTION',
      business_evidence_refs: [`${source.assessment_id}-q7`, `${source.assessment_id}-q12`],
      whole_person_evidence_refs: ['synthetic-bos-pressure'],
      alternative_explanations: ['Structural overload may fully explain escalation behavior.'],
      epistemic_class: 'TENTATIVE',
      falsifier: 'Pressure-state observations show that escalation remains unchanged when boundaries are explicit.',
      intervention_implications: ['Keep exception thresholds visible during the trial.'],
      business_cause_established_by_personality: false,
    },
    {
      relationship_id: 'synthetic-top-person-link-causal-abstention-v1',
      business_mechanism_ref: 'synthetic-top-mech-decision-rights-boundary-v1',
      business_mechanism_statement: mechanism,
      whole_person_claim_ref: `bos-fusion:${source.profile_id}:work_relationships`,
      relationship_type: 'ABSTAINED',
      business_evidence_refs: [`${source.assessment_id}-q11`],
      whole_person_evidence_refs: ['synthetic-bos-relationships'],
      alternative_explanations: ['Role design, incentives, and operating structure may fully explain the team pattern.'],
      epistemic_class: 'INSUFFICIENT_EVIDENCE',
      falsifier: 'Authorized observations establish a repeatable person-to-business causal mechanism.',
      intervention_implications: ['Do not attribute the business constraint to personality.'],
      business_cause_established_by_personality: false,
    },
  ]);
}

export function assembleBosBaFusionProof({ source, artifact } = {}) {
  const profile = normalizeProfileId(source?.profile_id);
  const assessment = normalizeAssessmentId(source?.assessment_id);
  invariant(artifact?.profile_id === profile && artifact?.assessment_id === assessment, 'new_ba_bos_fusion_artifact_identity_mismatch');
  const authority = validateBosFusionAuthority(source?.bos_authority?.fusion_authority, { profileId: profile });
  invariant(authority.source_artifact_sha256 === source.bos_authority.sha256, 'new_ba_bos_fusion_source_hash_mismatch');
  const hasCanonicalWbmRelationships = Array.isArray(artifact.business_reality?.person_business_synthesis);
  const rawRelationships = hasCanonicalWbmRelationships
    ? artifact.business_reality.person_business_synthesis
    : syntheticRelationships(source, artifact);
  invariant(rawRelationships.length > 0, 'new_ba_bos_fusion_relationships_missing');
  const resolvedRelationships = hasCanonicalWbmRelationships
    ? resolveWholePersonClaimReferences(source, artifact, authority, rawRelationships)
    : rawRelationships;
  const relationships = Object.freeze(resolvedRelationships.map((relationship) => validateFusionRelationship(relationship, authority, assessment)));
  const result = {
    contract_id: NEW_BA_BOS_FUSION_PROOF_CONTRACT,
    version: '1.0.0',
    profile_id: profile,
    assessment_id: assessment,
    bos_authority: Object.freeze({
      realization_id: authority.source_realization_id,
      artifact_sha256: authority.source_artifact_sha256,
      source_version: authority.source_version,
      fusion_contract_sha256: authority.contract_sha256,
      evidence_boundary_sha256: authority.evidence_boundary_sha256,
      claim_count: authority.claims.length,
    }),
    relationships,
    surface_bindings: Object.freeze({
      whole_business_model: Object.freeze(relationships.map(({ relationship_id }) => relationship_id)),
      five_futures: Object.freeze(relationships.filter(({ allowed_contribution }) => allowed_contribution !== 'uncertainty_abstention').map(({ relationship_id }) => relationship_id)),
      one_move: Object.freeze(relationships.filter(({ allowed_contribution }) => ['execution_feasibility', 'adoption_friction', 'intervention_design'].includes(allowed_contribution)).map(({ relationship_id }) => relationship_id)),
      plan_135: Object.freeze(relationships.filter(({ allowed_contribution }) => allowed_contribution !== 'uncertainty_abstention').map(({ relationship_id }) => relationship_id)),
      evidence: Object.freeze(relationships.map(({ relationship_id }) => relationship_id)),
    }),
    causal_boundary: Object.freeze({
      business_cause_source: 'BUSINESS_EVIDENCE_AND_WBM_MECHANISMS_ONLY',
      bos_contribution: 'EXECUTION_MODIFIER_ONLY',
      personality_score_to_business_cause: 'PROHIBITED',
      business_evidence_mutation: false,
      every_relationship_has_business_evidence: relationships.every(({ business_evidence_refs }) => business_evidence_refs.length > 0),
      every_relationship_has_falsifier: relationships.every(({ falsifier }) => Boolean(falsifier)),
      every_relationship_preserves_alternatives: relationships.every(({ alternative_explanations }) => alternative_explanations.length > 0),
    }),
    privacy_boundary: Object.freeze({
      raw_bos_evidence_in_customer_projection: false,
      personality_scores_in_ba_artifact: false,
      provider_calls: 0,
      provider_store: false,
      customer_state_mutation: false,
    }),
    customer_projection_effect: 'EXISTING_CANONICAL_EXECUTION_GUIDANCE_ONLY',
  };
  return validateBosBaFusionProof(Object.freeze({ ...result, proof_sha256: sha256Stable(result) }), { profileId: profile, assessmentId: assessment });
}

export function validateBosBaFusionProof(proof, { profileId = proof?.profile_id, assessmentId = proof?.assessment_id } = {}) {
  const profile = normalizeProfileId(profileId);
  const assessment = normalizeAssessmentId(assessmentId);
  invariant(proof?.contract_id === NEW_BA_BOS_FUSION_PROOF_CONTRACT, 'new_ba_bos_fusion_proof_contract_invalid');
  invariant(proof.profile_id === profile && proof.assessment_id === assessment, 'new_ba_bos_fusion_proof_identity_mismatch');
  invariant(Array.isArray(proof.relationships) && proof.relationships.length > 0, 'new_ba_bos_fusion_proof_relationships_missing');
  invariant(proof.relationships.every((relationship) => relationship.business_cause_established_by_personality === false), 'new_ba_bos_fusion_proof_personality_cause_prohibited');
  invariant(proof.causal_boundary?.business_cause_source === 'BUSINESS_EVIDENCE_AND_WBM_MECHANISMS_ONLY', 'new_ba_bos_fusion_proof_business_cause_boundary_invalid');
  invariant(proof.causal_boundary?.bos_contribution === 'EXECUTION_MODIFIER_ONLY', 'new_ba_bos_fusion_proof_contribution_boundary_invalid');
  invariant(proof.causal_boundary?.personality_score_to_business_cause === 'PROHIBITED', 'new_ba_bos_fusion_proof_score_boundary_invalid');
  invariant(proof.causal_boundary?.business_evidence_mutation === false, 'new_ba_bos_fusion_proof_evidence_mutation_prohibited');
  invariant(proof.privacy_boundary?.raw_bos_evidence_in_customer_projection === false, 'new_ba_bos_fusion_proof_raw_evidence_egress');
  invariant(proof.privacy_boundary?.personality_scores_in_ba_artifact === false, 'new_ba_bos_fusion_proof_score_egress');
  invariant(proof.privacy_boundary?.provider_store === false, 'new_ba_bos_fusion_proof_store_false_missing');
  const expected = sha256Stable({ ...proof, proof_sha256: undefined });
  invariant(proof.proof_sha256 === expected, 'new_ba_bos_fusion_proof_hash_invalid');
  return proof;
}
