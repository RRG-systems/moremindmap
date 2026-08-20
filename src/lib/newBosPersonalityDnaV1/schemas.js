import { DIMENSIONS, SURFACES } from './constants.js';

const evidenceRefList = { type: 'array', items: { type: 'string' } };
const governedInference = {
  type: 'object',
  required: ['id', 'confidence', 'evidence_refs', 'what_would_change_it'],
  properties: {
    id: { type: 'string' },
    confidence: { enum: ['KNOWN', 'STRONGLY_SUPPORTED', 'SUPPORTED_HYPOTHESIS', 'TENTATIVE', 'INSUFFICIENT_EVIDENCE'] },
    evidence_refs: evidenceRefList,
    counterevidence_refs: evidenceRefList,
    confounds: { type: 'array', items: { type: 'string' } },
    what_would_change_it: { type: 'string' },
  },
};

const evidenceBoundMeaning = {
  allOf: [governedInference],
  properties: {
    label: { type: 'string' },
    explanation: { type: 'string' },
    context: { type: 'string' },
    falsifier: { type: 'string' },
  },
};

export const RICH_SPECIALIZED_INTELLIGENCE_SCHEMA_V1 = Object.freeze({
  $id: 'moremindmap://schemas/bos/rich-specialized-intelligence-v1',
  type: 'object',
  required: [
    'version', 'recognition', 'personality_dna', 'operating_engine', 'people_experience',
    'communication', 'strengths_vulnerabilities', 'pressure_conflict', 'work_environment',
    'role_seat', 'leadership', 'cognition', 'energy', 'five_futures', 'one_move',
    'validation', 'operating_identity', 'visual_bos',
  ],
  properties: {
    version: { const: 'bos_depth_contract_v1' },
    recognition: { type: 'object', properties: { mechanisms: { type: 'array', items: evidenceBoundMeaning } } },
    personality_dna: { type: 'object', properties: { coordinate_explanations: { type: 'array', minItems: 8, maxItems: 8 } } },
    operating_engine: { type: 'object', properties: { mechanisms: { type: 'array', items: evidenceBoundMeaning } } },
    people_experience: { type: 'object', properties: { states: { type: 'array', items: evidenceBoundMeaning } } },
    communication: { type: 'object', properties: { dimensions: { type: 'array', items: evidenceBoundMeaning } } },
    strengths_vulnerabilities: { type: 'object', properties: { mechanisms: { type: 'array', items: evidenceBoundMeaning } } },
    pressure_conflict: { type: 'object', properties: { transformations: { type: 'array', items: evidenceBoundMeaning } } },
    work_environment: { type: 'object', properties: { demands: { type: 'array', items: evidenceBoundMeaning } } },
    role_seat: { type: 'object', properties: { fit_states: { type: 'array', items: evidenceBoundMeaning } } },
    leadership: { type: 'object' },
    cognition: { type: 'object', properties: { indicators: { type: 'array', items: evidenceBoundMeaning } } },
    energy: { type: 'object', required: ['trait', 'state', 'context', 'trajectory'] },
    five_futures: { type: 'object', properties: { items: { type: 'array', minItems: 5, maxItems: 5 } } },
    one_move: { type: 'object', required: ['target_mechanism', 'intervention', 'strength_preserved', 'reversibility', 'observable_result', 'falsifier', 'stop_adjust_condition'] },
    validation: { type: 'object', properties: { claims: { type: 'array', items: evidenceBoundMeaning } } },
    operating_identity: { type: 'object', required: ['governing_logic', 'not_a_type'] },
    visual_bos: { type: 'object', required: ['primary_pattern', 'secondary_pattern', 'tertiary_pattern', 'operating_core', 'inputs', 'outputs', 'operating_loop'] },
  },
});

export const RAW_EVIDENCE_SCHEMA_V1 = Object.freeze({
  $id: 'moremindmap://schemas/bos/raw-evidence-v1',
  type: 'object',
  required: ['synthetic', 'subject_token', 'identity_context', 'scores', 'questions', 'evidence', 'contradictions', 'uncertainties', 'abstentions'],
  properties: {
    synthetic: { type: 'boolean' },
    real_profile_gate: { type: 'boolean' },
    profile_id: { type: ['string', 'null'] },
    governed_local_snapshot: { type: 'boolean' },
    identity_verified_by_adapter: { type: 'boolean' },
    subject_token: { type: 'string', pattern: '^(SYNTH-PDNV1-|REAL-PDNV1-MM-)' },
    identity_context: { type: 'object' },
    scores: {
      type: 'object',
      required: DIMENSIONS.map(({ id }) => id),
      properties: Object.fromEntries(DIMENSIONS.map(({ id }) => [id, { type: 'number', minimum: 0, maximum: 100 }])),
    },
    questions: { type: 'array', minItems: 1 },
    structured_inputs: { type: 'array' },
    evidence: { type: 'array', minItems: 1 },
    contradictions: { type: 'array' },
    uncertainties: { type: 'array' },
    abstentions: { type: 'array' },
  },
});

export const PERSONALITY_DNA_SCHEMA_V1 = Object.freeze({
  $id: 'moremindmap://schemas/bos/personality-dna-v1',
  type: 'object',
  required: ['version', 'source_lineage', 'priors', 'topology', 'attributes', 'causal_dynamics', 'specialized_intelligence', 'evidence_certainty', 'abstentions'],
  properties: {
    version: { const: 'bos_personality_dna_runtime_v1' },
    source_lineage: { type: 'object' },
    priors: { type: 'array', minItems: 8, maxItems: 8 },
    topology: { type: 'array', items: governedInference },
    attributes: { type: 'array', items: governedInference },
    causal_dynamics: { type: 'array', items: governedInference },
    specialized_intelligence: { type: 'object' },
    evidence_certainty: { type: 'object' },
    abstentions: { type: 'array' },
  },
});

export const WHOLE_PERSON_SCHEMA_V1 = Object.freeze({
  $id: 'moremindmap://schemas/bos/vector-free-whole-person-v1',
  type: 'object',
  required: ['version', 'subject_token', 'core_explanation', 'central_tension', 'mechanisms', 'identity_distillation'],
  properties: {
    version: { const: 'bos_vector_free_whole_person_model_v1' },
    subject_token: { type: 'string' },
    core_explanation: { type: 'string' },
    central_tension: { type: 'string' },
    mechanisms: { type: 'array' },
    identity_distillation: { type: 'string' },
  },
});

export const CUSTOMER_SURFACE_PACKET_SCHEMA_V1 = Object.freeze({
  $id: 'moremindmap://schemas/bos/customer-surface-packet-v1',
  type: 'object',
  required: ['surface_id', 'local_mission', 'whole_person_ref', 'whole_person_model', 'claim_refs', 'resolved_local_truth', 'library_selection'],
  properties: {
    surface_id: { enum: SURFACES.map(({ id }) => id) },
    local_mission: { type: 'string' },
    whole_person_ref: { type: 'string' },
    whole_person_model: { type: 'object' },
    claim_refs: evidenceRefList,
    resolved_local_truth: {
      type: 'object',
      required: ['version', 'surface_id', 'subject_token', 'whole_person_model', 'resolved_claims', 'evidence', 'contradictions', 'confounds', 'falsifiers', 'abstentions', 'specialist_truth', 'lineage'],
      properties: {
        version: { const: 'bos_resolved_surface_truth_v1' },
        resolved_claims: { type: 'array', items: governedInference },
        evidence: { type: 'array' },
        contradictions: { type: 'array' },
        confounds: { type: 'array' },
        falsifiers: { type: 'array' },
        abstentions: { type: 'array' },
        specialist_truth: { type: 'object' },
      },
    },
    library_selection: { type: 'object' },
    rendering: { type: ['object', 'null'] },
    human_realization: {
      type: ['object', 'null'],
      properties: {
        version: { const: 'bos_human_realization_v1' },
        surface_id: { enum: SURFACES.map(({ id }) => id) },
        customer_prose: { type: 'string', minLength: 1 },
        governed_evidence_refs: evidenceRefList,
        generation: { type: ['object', 'null'] },
      },
    },
    human_realization_audit: {
      type: ['object', 'null'],
      properties: {
        version: { const: 'bos_human_realization_non_blocking_audit_v4' },
        surface_id: { enum: SURFACES.map(({ id }) => id) },
        blocking: { const: false },
        notes: { type: 'array' },
      },
    },
  },
});
