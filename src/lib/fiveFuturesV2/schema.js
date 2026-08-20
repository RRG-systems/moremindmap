import {
  CERTAINTY_SUPPORT_CLASSES,
  FIVE_FUTURES_V2_CONTRACT_ID,
  FIVE_FUTURES_V2_CONTRACT_VERSION,
  FIVE_FUTURES_V2_SCHEMA_VERSION,
  FUTURE_ROLES,
  SUPPORT_SEMANTICS,
  WEIGHTING_MODEL_VERSION,
} from './constants.js';

export const FIVE_FUTURES_V2_SCHEMA = Object.freeze({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://moremindmap.local/schemas/five-futures-v2.json',
  title: 'MORE MindMap Five Futures V2',
  type: 'object',
  required: [
    'contract_id', 'contract_version', 'schema_version', 'business_id', 'owner_profile_id',
    'whole_business_model_binding', 'support_semantics', 'futures', 'normalization',
    'authority_versions', 'legacy_coexistence', 'one_move_interface', 'runtime_boundaries',
  ],
  properties: {
    contract_id: { const: FIVE_FUTURES_V2_CONTRACT_ID },
    contract_version: { const: FIVE_FUTURES_V2_CONTRACT_VERSION },
    schema_version: { const: FIVE_FUTURES_V2_SCHEMA_VERSION },
    business_id: { type: 'string', minLength: 1 },
    owner_profile_id: { type: 'string', minLength: 1 },
    support_semantics: { const: SUPPORT_SEMANTICS },
    whole_business_model_binding: {
      type: 'object',
      required: ['whole_business_model_contract_version', 'whole_business_model_state_version', 'whole_business_model_hash'],
      properties: {
        whole_business_model_hash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      },
    },
    futures: {
      type: 'array', minItems: 5, maxItems: 5,
      prefixItems: FUTURE_ROLES.map((future_role) => ({
        type: 'object',
        required: [
          'future_role', 'future_id', 'title', 'state_summary', 'business_state_if_realized',
          'governing_mechanisms', 'supporting_evidence_refs', 'counterevidence_refs', 'assumptions',
          'required_changes', 'leading_indicators', 'risks', 'falsifiers',
          'operator_business_interactions', 'team_dependencies', 'dynamic_context_dependencies',
          'raw_relative_support_score', 'normalized_relative_support_weight', 'support_components',
          'weighting_model_version', 'whole_business_model_version', 'whole_business_model_hash',
          'authority_versions', 'certainty_support_classification', 'conditionality', 'support_semantics',
        ],
        properties: {
          future_role: { const: future_role },
          raw_relative_support_score: { type: 'integer', minimum: 0, maximum: 21 },
          normalized_relative_support_weight: { type: 'integer', minimum: 0, maximum: 100 },
          weighting_model_version: { const: WEIGHTING_MODEL_VERSION },
          certainty_support_classification: { enum: CERTAINTY_SUPPORT_CLASSES },
          support_semantics: { const: SUPPORT_SEMANTICS },
        },
      })),
    },
    normalization: { type: 'object' },
    authority_versions: { type: 'object' },
    legacy_coexistence: { type: 'object' },
    one_move_interface: { type: 'object' },
    runtime_boundaries: { type: 'object' },
  },
});
