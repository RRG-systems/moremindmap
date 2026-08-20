import {
  CONSTRAINT_TYPES,
  EPISTEMIC_CLASSES,
  PERSON_BUSINESS_RELATIONSHIP_TYPES,
  PROJECTION_ELIGIBILITY,
  WBM_CONTRACT_ID,
  WBM_CONTRACT_VERSION,
  WBM_SCHEMA_VERSION,
} from './constants.js';

export function buildWholeBusinessSynthesisMission(contextPacket) {
  return Object.freeze({
    mission_id: 'whole_business_model_construction_v1',
    doctrine: [
      'Understand the whole governed business state before constructing the model.',
      'Return structured governed meaning, not customer prose or a report.',
      'Derive cross-domain mechanisms from the evidence packet; examples are not rules.',
      'Separate observed facts, calculations, operator beliefs, doctrine, dynamic facts, and hypotheses.',
      'Preserve contradictions, counterevidence, confounds, missing evidence, and uncertainty.',
      'Do not force a governing constraint when evidence is insufficient.',
      'Whole-Person truth may explain feasibility or interaction only when business evidence supports the link.',
      'Test structural explanations before personality explanations for team or operating problems.',
      'Do not create customer-facing prose, trajectories, weights, percentages, or a One Move.',
    ],
    controlled_vocabulary: {
      epistemic_classes: EPISTEMIC_CLASSES,
      constraint_types: CONSTRAINT_TYPES,
      person_business_relationship_types: PERSON_BUSINESS_RELATIONSHIP_TYPES,
      projection_eligibility: PROJECTION_ELIGIBILITY,
    },
    required_output: {
      contract_id: WBM_CONTRACT_ID,
      contract_version: WBM_CONTRACT_VERSION,
      schema_version: WBM_SCHEMA_VERSION,
      assessment_identity: 'COPY_FROM_CONTEXT',
      frozen_whole_person_authority: 'COPY_REFERENCES_ONLY',
      source_integrity: 'PRESERVE_CONTEXT_AND_AUTHORITY_HASHES',
      authority_receipts: 'COPY_SELECTION_RECEIPT',
      governed_business_evidence: 'REFERENCE_ONLY',
      current_business_reality: 'STRUCTURED_DOMAIN_STATE',
      business_model: 'STRUCTURED_VALUE_CREATION_MODEL',
      domain_states: 'ARRAY',
      person_business_synthesis: 'ARRAY',
      team_organizational_synthesis: 'ARRAY',
      causal_model: 'STRUCTURED_MECHANISMS_AND_LOOPS',
      governing_constraint: 'CANDIDATE_OR_INSUFFICIENT_EVIDENCE',
      assets: 'ARRAY',
      vulnerabilities: 'ARRAY',
      momentum: 'STRUCTURED_DIRECTION_OF_TRAVEL',
      epistemic_state: 'STRUCTURED_CERTAINTY_AND_MISSINGNESS',
      open_questions: 'ARRAY',
      dynamic_research: 'ARRAY',
      projection_eligibility: 'STRUCTURED_WITHOUT_PROJECTION_OUTPUT',
      state_lineage: 'VERSIONED_BELIEF_STATE',
      downstream_contributions: 'METADATA_ONLY',
    },
    prohibited_output_fields: [
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
    ],
    context_packet: contextPacket,
  });
}

export function createFrontierSynthesisAdapter({ synthesize }) {
  if (typeof synthesize !== 'function') throw new TypeError('frontier_synthesis_adapter_requires_synthesize_function');
  return Object.freeze({
    adapter_id: 'whole-business-frontier-synthesis-adapter-v1',
    store: false,
    async synthesize(contextPacket) {
      const mission = buildWholeBusinessSynthesisMission(contextPacket);
      return synthesize({ mission, store: false });
    },
  });
}
