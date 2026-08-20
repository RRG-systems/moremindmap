import { deepFreeze } from '../../intelligenceFabric/validation.js';

export const AFW04_VERSION = '1.0.0';
export const AFW04_MODEL = 'gpt-5.6-sol';

export const AFW04_RUNTIME_POLICY = deepFreeze({
  policy_id: 'subscription_v1_afw04_runtime_policy',
  policy_version: AFW04_VERSION,
  enabled_by_default: false,
  server_only: true,
  model: AFW04_MODEL,
  api: 'RESPONSES',
  store: false,
  background: false,
  tools: [],
  response_chaining: false,
  reasoning_effort: 'xhigh',
  max_output_tokens: 12000,
  max_in_flight_per_session: 1,
  transient_retries: 1,
  retry_requires_identical_request_hash: true,
  customer_state_mutation: false,
  durable_transcript_write: false,
  living_twin_publication: false,
  universal_rsl_runtime_read: false,
});

export const AFW04_PRICING_POLICY = deepFreeze({
  policy_id: 'openai_gpt_5_6_sol_standard_short_context_2026_08_18',
  policy_version: AFW04_VERSION,
  source_url: 'https://developers.openai.com/api/docs/pricing',
  currency: 'USD',
  unit_tokens: 1_000_000,
  input_per_unit: 5,
  cached_input_per_unit: 0.5,
  output_per_unit: 30,
  web_search_per_1000_calls: 10,
  captured_at: '2026-08-18T00:00:00.000Z',
  context_class: 'STANDARD_SHORT_CONTEXT',
});

export const INTELLIGENCE_LAYERS = deepFreeze([
  'UNIVERSAL_KERNEL',
  'VERTICAL_CASSETTE',
  'CUSTOMER_GOVERNED_REALITY',
  'PERSONAL_RSL',
  'EXTERNAL_EVIDENCE',
]);

export const GENERALIZATION_SCOPES = deepFreeze([
  'UNIVERSAL_ACROSS_BUSINESSES',
  'VERTICAL_SPECIFIC',
  'BUSINESS_MODEL_SPECIFIC',
  'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
]);

export const PROPOSAL_TYPES = deepFreeze([
  'QUESTION',
  'EVIDENCE_CANDIDATE',
  'CORRECTION_CANDIDATE',
  'COMMITMENT_CANDIDATE',
  'PLAN_CHANGE_CANDIDATE',
  'RESEARCH_CANDIDATE',
  'NO_MUTATION',
]);

export const PROPOSAL_OPERATIONS = deepFreeze(['PROPOSE', 'CLARIFY', 'CONFIRM', 'NONE']);

export const AFW04_ALLOWED_AUTHORITY_PREFIXES = deepFreeze([
  'universal_kernel:',
  'vertical_cassette:',
  'canonical_artifact:',
  'personal_rsl:',
  'external_evidence:',
]);
