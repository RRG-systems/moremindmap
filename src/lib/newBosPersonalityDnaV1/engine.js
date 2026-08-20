import {
  DIMENSIONS,
  NEW_BOS_LIBRARY_VERSION,
  NEW_BOS_RUNTIME_VERSION,
  NEW_BOS_WHOLE_PERSON_VERSION,
  RUNTIME_STAGES,
} from './constants.js';
import {
  assertVectorFreeWholePerson,
  deepFreeze,
  validateInterpretationDraft,
  validateRawEvidence,
  validateRuntimeArtifact,
  validateSurfacePackets,
} from './contracts.js';
import { selectLibraryForStage } from './libraryRegistry.js';
import { buildCustomerSurfacePackets } from './surfaceProjector.js';
import { validateAllSurfaceRenderings } from './truthValidator.js';

function priorBand(score) {
  if (score >= 72) return 'higher_relative_prior';
  if (score <= 35) return 'lower_relative_prior';
  return 'context_sensitive_prior';
}

function buildVectorPriors(raw) {
  return DIMENSIONS.map(({ id, label }) => Object.freeze({
    dimension_id: id,
    label,
    canonical_score: raw.scores[id],
    prior_band: priorBand(raw.scores[id]),
    authority_boundary: 'probabilistic_prior_only',
    provenance_refs: Object.freeze([...(raw.score_source_refs?.[id] || [])]),
  }));
}

function receipt(stage, authority, checks) {
  return Object.freeze({
    stage,
    status: 'complete',
    authority,
    checks: Object.freeze(checks),
  });
}

function evidenceCertainty(raw, draft) {
  const all = [...draft.topology, ...draft.attributes, ...draft.dynamics];
  const grouped = (confidence) => all.filter((item) => item.confidence === confidence).map(({ id }) => id);
  return Object.freeze({
    known: Object.freeze(grouped('KNOWN')),
    strongly_supported: Object.freeze(grouped('STRONGLY_SUPPORTED')),
    supported_hypotheses: Object.freeze(grouped('SUPPORTED_HYPOTHESIS')),
    tentative: Object.freeze(grouped('TENTATIVE')),
    insufficient_evidence: Object.freeze(grouped('INSUFFICIENT_EVIDENCE')),
    contradictions: Object.freeze(raw.contradictions),
    uncertainties: Object.freeze(raw.uncertainties),
    abstentions: Object.freeze([...raw.abstentions, ...draft.abstentions]),
    validation_backlog: Object.freeze(draft.validation_backlog || []),
  });
}

function buildWholePersonModel(raw, draft) {
  const model = {
    version: NEW_BOS_WHOLE_PERSON_VERSION,
    subject_token: raw.subject_token,
    core_explanation: draft.whole_person.core_explanation,
    central_tension: draft.whole_person.central_tension,
    mechanisms: draft.whole_person.mechanisms,
    identity_tensions: draft.whole_person.identity_tensions,
    goal_conflicts: draft.whole_person.goal_conflicts,
    private_calculations: draft.whole_person.private_calculations,
    pressure_and_recovery: draft.whole_person.pressure_and_recovery,
    work_and_relationships: draft.whole_person.work_and_relationships,
    identity_distillation: draft.whole_person.identity_distillation,
    evidence_refs: draft.whole_person.evidence_refs,
    confidence: draft.whole_person.confidence,
    what_would_change_it: draft.whole_person.what_would_change_it,
  };
  return deepFreeze(assertVectorFreeWholePerson(model));
}

export function buildPersonalityDnaRuntime({ rawEvidence, interpretationDraft }) {
  const activation = rawEvidence?.real_profile_gate === true
    ? 'real_profile_hs_gate_v1'
    : 'synthetic_lab';
  const raw = validateRawEvidence(rawEvidence, activation);
  const draft = validateInterpretationDraft(raw, interpretationDraft);
  const priors = deepFreeze(buildVectorPriors(raw));
  const certainty = evidenceCertainty(raw, draft);
  const personalityDna = deepFreeze({
    version: NEW_BOS_RUNTIME_VERSION,
    synthetic: raw.synthetic === true,
    real_profile_gate: raw.real_profile_gate === true,
    subject_token: raw.subject_token,
    source_lineage: {
      raw_evidence_version: raw.version,
      source_artifact_ids: raw.source_artifact_ids,
      library_version: NEW_BOS_LIBRARY_VERSION,
      stage_authorities: Object.fromEntries([
        'vector_priors',
        'cross_vector_topology',
        'higher_order_attributes',
        'causal_dynamics',
        'specialized_intelligence',
        'evidence_certainty',
        'personality_dna',
      ].map((stage) => [stage, selectLibraryForStage(stage)])),
    },
    raw_evidence_ref: `${raw.version}:${raw.subject_token}`,
    priors,
    topology: draft.topology,
    attributes: draft.attributes,
    causal_dynamics: draft.dynamics,
    specialized_intelligence: draft.specialized,
    sequences: draft.sequences,
    strengths_and_overuse: draft.strengths_and_overuse,
    compensation: draft.compensation,
    identity_tensions: draft.whole_person.identity_tensions,
    goal_conflicts: draft.whole_person.goal_conflicts,
    private_calculations: draft.whole_person.private_calculations,
    evidence_certainty: certainty,
    abstentions: certainty.abstentions,
  });
  const wholePersonModel = buildWholePersonModel(raw, draft);
  const surfacePackets = deepFreeze(buildCustomerSurfacePackets({
    rawEvidence: raw,
    personalityDna,
    wholePersonModel,
    draft,
  }));
  validateSurfacePackets(surfacePackets);
  validateAllSurfaceRenderings(surfacePackets, raw.subject_token);

  const stageReceipts = Object.freeze([
    receipt('raw_evidence', 'canonical_source_contract', [
      raw.synthetic === true ? 'synthetic_only' : 'authorized_real_profile_gate_only',
      'eight_scores_present',
      'evidence_ledger_present',
    ]),
    receipt('vector_priors', selectLibraryForStage('vector_priors'), ['scores_are_priors_only', 'scores_unchanged']),
    receipt('cross_vector_topology', selectLibraryForStage('cross_vector_topology'), ['dynamic_roles_present', 'evidence_refs_resolve']),
    receipt('higher_order_attributes', selectLibraryForStage('higher_order_attributes'), ['subdimensions_preserved', 'confidence_preserved']),
    receipt('causal_dynamics', selectLibraryForStage('causal_dynamics'), ['mechanisms_have_falsifiers', 'counterevidence_preserved']),
    receipt('specialized_intelligence', selectLibraryForStage('specialized_intelligence'), ['role_abstention_supported', 'future_boundary_preserved']),
    receipt('evidence_certainty', selectLibraryForStage('evidence_certainty'), ['contradictions_preserved', 'abstentions_preserved']),
    receipt('personality_dna', selectLibraryForStage('personality_dna'), ['typed_artifact_complete', 'lineage_preserved']),
    receipt('whole_person_model', selectLibraryForStage('whole_person_model'), ['assessment_language_removed', 'causal_mechanisms_retained']),
    receipt('customer_surfaces', 'local_surface_contract_v1', ['fifteen_surfaces_present', 'whole_person_context_retained']),
  ]);

  const artifact = deepFreeze({
    version: NEW_BOS_RUNTIME_VERSION,
    synthetic: raw.synthetic === true,
    real_profile_gate: raw.real_profile_gate === true,
    profile_id: raw.profile_id || null,
    subject_token: raw.subject_token,
    identity_context: raw.identity_context,
    canonical_scores: raw.scores,
    generation: raw.generation_metadata || null,
    raw_evidence: raw,
    personality_dna: personalityDna,
    whole_person_model: wholePersonModel,
    surface_packets: surfacePackets,
    stage_receipts: stageReceipts,
    safety: Object.freeze({
      provider_called: false,
      persistence_invoked: false,
      customer_retrieval_invoked: raw.real_profile_gate === true,
      customer_retrieval_mode: raw.real_profile_gate === true ? 'governed_local_snapshot' : 'none',
      production_enabled: false,
    }),
  });

  if (stageReceipts.length !== RUNTIME_STAGES.length) {
    throw new Error('Runtime receipt count drifted from the governed stage sequence');
  }
  return validateRuntimeArtifact(artifact);
}
