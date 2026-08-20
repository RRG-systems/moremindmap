import { hashCanonicalJson } from '../../intelligenceFabric/hashing.js';
import { deepFreeze } from '../../intelligenceFabric/validation.js';
import { AFW04_MODEL, AFW04_VERSION, GENERALIZATION_SCOPES, PROPOSAL_OPERATIONS, PROPOSAL_TYPES } from './constants.js';

const HASH = /^[a-f0-9]{64}$/u;
const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const strings = (value, max = 40) => Array.isArray(value) && value.length <= max && value.every((item) => typeof item === 'string' && item.length > 0);
const exact = (value, keys) => isObject(value) && Object.keys(value).every((key) => keys.includes(key));
const result = (errors) => deepFreeze({ valid: errors.length === 0, errors });

export const FRONTIER_COACHING_OUTPUT_SCHEMA = deepFreeze({
  type: 'json_schema',
  name: 'subscription_v1_afw04_frontier_coaching_output',
  strict: true,
  schema: {
    type: 'object', additionalProperties: false,
    required: ['customer_message', 'proposal', 'research_need'],
    properties: {
      customer_message: { type: 'string', minLength: 1, maxLength: 5000 },
      proposal: {
        type: 'object', additionalProperties: false,
        required: ['proposal_type', 'target_contract', 'operation', 'summary', 'items', 'reason', 'evidence_ref_ids', 'authority_ref_ids', 'confirmation_required', 'generalization_scope'],
        properties: {
          proposal_type: { type: 'string', enum: PROPOSAL_TYPES },
          target_contract: { type: ['string', 'null'], maxLength: 100 },
          operation: { type: 'string', enum: PROPOSAL_OPERATIONS },
          summary: { type: 'string', minLength: 1, maxLength: 500 },
          items: { type: 'array', maxItems: 8, items: { type: 'object', additionalProperties: false, required: ['field', 'value'], properties: { field: { type: 'string', maxLength: 100 }, value: { type: 'string', maxLength: 600 } } } },
          reason: { type: 'string', minLength: 1, maxLength: 600 },
          evidence_ref_ids: { type: 'array', maxItems: 16, items: { type: 'string', maxLength: 160 } },
          authority_ref_ids: { type: 'array', maxItems: 16, items: { type: 'string', maxLength: 200 } },
          confirmation_required: { type: 'boolean' },
          generalization_scope: { type: 'string', enum: GENERALIZATION_SCOPES },
        },
      },
      research_need: {
        anyOf: [
          { type: 'null' },
          { type: 'object', additionalProperties: false, required: ['needed', 'purpose', 'materiality', 'query', 'desired_source_type', 'private_data_required'], properties: {
            needed: { type: 'boolean' }, purpose: { type: 'string', maxLength: 300 }, materiality: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] }, query: { type: 'string', maxLength: 300 }, desired_source_type: { type: 'string', enum: ['PRIMARY_OFFICIAL', 'PRIMARY_RESEARCH', 'NONE'] }, private_data_required: { type: 'boolean' },
          } },
        ],
      },
    },
  },
});

export function validateFrontierCoachingOutput(value, { allowed_evidence_refs = [], allowed_authority_refs = [] } = {}) {
  const errors = [];
  if (!exact(value, ['customer_message', 'proposal', 'research_need'])) errors.push('OUTPUT_FIELDS_INVALID');
  if (typeof value?.customer_message !== 'string' || !value.customer_message.trim() || value.customer_message.length > 5000) errors.push('CUSTOMER_MESSAGE_INVALID');
  const p = value?.proposal;
  if (!exact(p, ['proposal_type', 'target_contract', 'operation', 'summary', 'items', 'reason', 'evidence_ref_ids', 'authority_ref_ids', 'confirmation_required', 'generalization_scope'])) errors.push('PROPOSAL_FIELDS_INVALID');
  if (!PROPOSAL_TYPES.includes(p?.proposal_type) || !PROPOSAL_OPERATIONS.includes(p?.operation) || !GENERALIZATION_SCOPES.includes(p?.generalization_scope)) errors.push('PROPOSAL_ENUM_INVALID');
  if (!strings(p?.evidence_ref_ids, 16) || p.evidence_ref_ids.some((id) => !allowed_evidence_refs.includes(id))) errors.push('INVENTED_EVIDENCE_REFERENCE');
  if (!strings(p?.authority_ref_ids, 16) || p.authority_ref_ids.some((id) => !allowed_authority_refs.includes(id))) errors.push('INVENTED_AUTHORITY_REFERENCE');
  if (!Array.isArray(p?.items) || p.items.length > 8 || p.items.some((item) => !exact(item, ['field', 'value']) || typeof item.field !== 'string' || typeof item.value !== 'string')) errors.push('PROPOSAL_ITEMS_INVALID');
  if (typeof p?.confirmation_required !== 'boolean') errors.push('CONFIRMATION_FLAG_INVALID');
  const n = value?.research_need;
  if (n != null && (!exact(n, ['needed', 'purpose', 'materiality', 'query', 'desired_source_type', 'private_data_required']) || typeof n.needed !== 'boolean' || !['LOW', 'MEDIUM', 'HIGH'].includes(n.materiality) || !['PRIMARY_OFFICIAL', 'PRIMARY_RESEARCH', 'NONE'].includes(n.desired_source_type))) errors.push('RESEARCH_NEED_INVALID');
  return result(errors);
}

export function createCoachingMutationCandidate({ session_id, scope_hash, state_packet_hash, output, created_at }) {
  const base = {
    contract_id: 'coaching_mutation_candidate', schema_version: AFW04_VERSION,
    proposal_id: `proposal_${hashCanonicalJson({ session_id, state_packet_hash, output: output.proposal }).slice(0, 24)}`,
    scope_hash, session_id, state_packet_hash,
    proposal_type: output.proposal.proposal_type,
    target_contract: output.proposal.target_contract,
    operation: output.proposal.operation,
    proposed_payload: { summary: output.proposal.summary, items: output.proposal.items },
    reason: output.proposal.reason,
    evidence_ref_ids: [...output.proposal.evidence_ref_ids], authority_ref_ids: [...output.proposal.authority_ref_ids],
    confirmation_required: output.proposal.confirmation_required,
    generalization_scope: output.proposal.generalization_scope,
    status: 'HIDDEN_UNACCEPTED_PROPOSAL', created_at,
    customer_state_mutation_performed: false,
  };
  return deepFreeze({ ...base, proposal_hash: hashCanonicalJson(base) });
}

export function createProviderUsageReceipt({ request_hash, response_hash, input_tokens, cached_input_tokens = 0, output_tokens, latency_ms, first_token_latency_ms, retry_count, computed_cost_usd, created_at, status = 'ACCEPTED' }) {
  const receipt = { contract_id: 'provider_usage_receipt', schema_version: AFW04_VERSION, model: AFW04_MODEL, store: false, request_hash, response_hash, status, input_tokens, cached_input_tokens, output_tokens, latency_ms, first_token_latency_ms, retry_count, computed_cost_usd, currency: 'USD', raw_payload_persisted: false, created_at };
  if (![request_hash, response_hash].every((hash) => HASH.test(hash)) || !Number.isInteger(input_tokens) || !Number.isInteger(output_tokens)) throw new TypeError('PROVIDER_RECEIPT_INVALID');
  return deepFreeze(receipt);
}

