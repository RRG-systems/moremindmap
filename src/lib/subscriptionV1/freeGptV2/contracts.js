import { hashCanonicalJson } from '../../intelligenceFabric/hashing.js';
import { deepFreeze } from '../../intelligenceFabric/validation.js';
import { createCoachingMutationCandidate } from '../afw04/contracts.js';
import { GENERALIZATION_SCOPES, PROPOSAL_OPERATIONS, PROPOSAL_TYPES } from '../afw04/constants.js';
import { ALLOWED_MUTATION_TARGETS } from '../afw05/constants.js';
import {
  DURABLE_CANDIDATE_TYPES,
  FREE_GPT_V2_MODEL,
  FREE_GPT_V2_VERSION,
  NATURAL_AUTHORIZATION_DECISIONS,
} from './constants.js';

const HASH = /^[a-f0-9]{64}$/u;
const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const exactKeys = (value, keys) => isObject(value) && Object.keys(value).every((key) => keys.includes(key));
const clone = (value) => JSON.parse(JSON.stringify(value));
const DURABLE_PROPOSAL_TYPES = PROPOSAL_TYPES.filter((value) => !['QUESTION', 'NO_MUTATION'].includes(value));
const DURABLE_PROPOSAL_OPERATIONS = PROPOSAL_OPERATIONS.filter((value) => value === 'PROPOSE');
const GOVERNED_MUTATION_TARGETS = [...new Set(Object.values(ALLOWED_MUTATION_TARGETS).flat())].sort();
const GOVERNED_FIELD_PATH = /^(?:plan_135\.(?:goal|way_[123])|where_you_are\.[A-Za-z0-9_-]+|five_futures\.challenge|one_move\.challenge|evidence\.[A-Za-z0-9_-]+|commitment\.[A-Za-z0-9_-]+)$/u;
const CANDIDATE_PROPOSAL_TYPES = deepFreeze({
  EVIDENCE_CANDIDATE: ['EVIDENCE_CANDIDATE'],
  CORRECTION_CANDIDATE: ['CORRECTION_CANDIDATE'],
  COMMITMENT_CANDIDATE: ['COMMITMENT_CANDIDATE'],
  PLAN_CHANGE_CANDIDATE: ['PLAN_CHANGE_CANDIDATE'],
  FUTURES_CHALLENGE_CANDIDATE: ['EVIDENCE_CANDIDATE', 'CORRECTION_CANDIDATE'],
  ONE_MOVE_CHALLENGE_CANDIDATE: ['EVIDENCE_CANDIDATE', 'CORRECTION_CANDIDATE'],
  OUTCOME_CANDIDATE: ['EVIDENCE_CANDIDATE'],
  PERSONAL_RSL_CANDIDATE: ['EVIDENCE_CANDIDATE', 'COMMITMENT_CANDIDATE'],
  EXTERNAL_RESEARCH_CANDIDATE: ['RESEARCH_CANDIDATE'],
});

function canonicalTarget(candidate) {
  if (candidate?.proposal_type === 'PLAN_CHANGE_CANDIDATE') return 'PLAN_135';
  if (candidate?.proposal_type === 'COMMITMENT_CANDIDATE') {
    return candidate.items?.every((item) => /^(?:plan_135|commitment)\./u.test(item.field)) ? 'PLAN_135' : 'LIVING_BUSINESS_STATE';
  }
  if (candidate?.proposal_type === 'RESEARCH_CANDIDATE') return 'EVIDENCE_LEDGER';
  if (candidate?.proposal_type === 'EVIDENCE_CANDIDATE' || candidate?.proposal_type === 'CORRECTION_CANDIDATE') {
    return candidate.items?.every((item) => item.field.startsWith('evidence.')) ? 'EVIDENCE_LEDGER' : 'LIVING_BUSINESS_STATE';
  }
  return null;
}

const itemSchema = {
  type: 'object', additionalProperties: false, required: ['field', 'value'],
  properties: { field: { type: 'string', minLength: 1, maxLength: 100, pattern: '^(?:plan_135\\.(?:goal|way_[123])|where_you_are\\.[A-Za-z0-9_-]+|five_futures\\.challenge|one_move\\.challenge|evidence\\.[A-Za-z0-9_-]+|commitment\\.[A-Za-z0-9_-]+)$' }, value: { type: 'string', minLength: 1, maxLength: 600 } },
};

export const FRONTIER_CONVERSATION_OUTPUT_SCHEMA_V2 = deepFreeze({
  type: 'json_schema',
  name: 'subscription_v1_free_gpt_conversation_v2',
  strict: true,
  schema: {
    type: 'object', additionalProperties: false, required: ['customer_message'],
    properties: { customer_message: { type: 'string', minLength: 1 } },
  },
});

const candidateObjectSchema = {
  type: 'object',
  description: 'A customer-authored durable candidate that must be proposed for exact confirmation before any mutation. Use this branch whenever the customer explicitly asks MORE to remember a new preference, correction, commitment, or other governed change.',
  additionalProperties: false,
  required: ['candidate_type', 'proposal_type', 'target_contract', 'operation', 'summary', 'items', 'reason', 'evidence_ref_ids', 'authority_ref_ids', 'confirmation_required', 'generalization_scope'],
  properties: {
    candidate_type: { type: 'string', enum: DURABLE_CANDIDATE_TYPES },
    proposal_type: { type: 'string', enum: DURABLE_PROPOSAL_TYPES },
    target_contract: { type: 'string', enum: GOVERNED_MUTATION_TARGETS },
    operation: { type: 'string', enum: DURABLE_PROPOSAL_OPERATIONS },
    summary: { type: 'string', minLength: 1, maxLength: 500 },
    items: { type: 'array', minItems: 1, maxItems: 8, items: itemSchema },
    reason: { type: 'string', minLength: 1, maxLength: 600 },
    evidence_ref_ids: { type: 'array', maxItems: 16, items: { type: 'string', maxLength: 160 } },
    authority_ref_ids: { type: 'array', maxItems: 16, items: { type: 'string', maxLength: 200 } },
    confirmation_required: { type: 'boolean', const: true },
    generalization_scope: { type: 'string', enum: GENERALIZATION_SCOPES },
  },
};

export const DURABLE_CANDIDATE_OUTPUT_SCHEMA_V1 = deepFreeze({
  type: 'json_schema',
  name: 'subscription_v1_post_response_candidate_v1',
  strict: true,
  schema: {
    type: 'object', additionalProperties: false, required: ['candidate'],
    properties: {
      candidate: {
        description: 'Return the candidate object for a customer-authored durable request. Return null only when the exchange contains no new durable candidate or exactly duplicates durable relationship memory.',
        anyOf: [candidateObjectSchema, { type: 'null', description: 'No new durable customer-specific candidate exists in this exchange.' }],
      },
    },
  },
});

export const NATURAL_AUTHORIZATION_OUTPUT_SCHEMA_V1 = deepFreeze({
  type: 'json_schema',
  name: 'subscription_v1_natural_authorization_v1',
  strict: true,
  schema: {
    type: 'object', additionalProperties: false,
    required: ['decision', 'proposal_hash', 'effective_items', 'unambiguous', 'reason'],
    properties: {
      decision: { type: 'string', enum: NATURAL_AUTHORIZATION_DECISIONS },
      proposal_hash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      effective_items: { type: 'array', maxItems: 8, items: itemSchema },
      unambiguous: { type: 'boolean' },
      reason: { type: 'string', minLength: 1, maxLength: 400 },
    },
  },
});

export function validateConversationOutputV2(value) {
  const errors = [];
  if (!exactKeys(value, ['customer_message'])) errors.push('CUSTOMER_MESSAGE_ONLY_CONTRACT_VIOLATED');
  if (typeof value?.customer_message !== 'string' || !value.customer_message.trim()) errors.push('CUSTOMER_MESSAGE_INVALID');
  return deepFreeze({ valid: errors.length === 0, errors });
}

function validItems(items) {
  return Array.isArray(items) && items.length > 0 && items.length <= 8
    && items.every((item) => exactKeys(item, ['field', 'value'])
      && typeof item.field === 'string' && item.field.length > 0 && item.field.length <= 100 && GOVERNED_FIELD_PATH.test(item.field)
      && typeof item.value === 'string' && item.value.length > 0 && item.value.length <= 600);
}

export function validateDurableCandidateOutput(value, { allowed_evidence_refs = [], allowed_authority_refs = [] } = {}) {
  const errors = [];
  if (!exactKeys(value, ['candidate'])) errors.push('CANDIDATE_OUTPUT_FIELDS_INVALID');
  if (value?.candidate === null) return deepFreeze({ valid: errors.length === 0, errors, candidate: null });
  const candidate = value?.candidate;
  const keys = ['candidate_type', 'proposal_type', 'target_contract', 'operation', 'summary', 'items', 'reason', 'evidence_ref_ids', 'authority_ref_ids', 'confirmation_required', 'generalization_scope'];
  if (!exactKeys(candidate, keys)) errors.push('CANDIDATE_FIELDS_INVALID');
  if (!DURABLE_CANDIDATE_TYPES.includes(candidate?.candidate_type)) errors.push('CANDIDATE_TYPE_INVALID');
  if (!DURABLE_PROPOSAL_TYPES.includes(candidate?.proposal_type)) errors.push('PROPOSAL_TYPE_INVALID');
  if (candidate?.candidate_type && !CANDIDATE_PROPOSAL_TYPES[candidate.candidate_type]?.includes(candidate?.proposal_type)) errors.push('CANDIDATE_PROPOSAL_TYPE_MISMATCH');
  if (!DURABLE_PROPOSAL_OPERATIONS.includes(candidate?.operation)) errors.push('CANDIDATE_OPERATION_INVALID');
  if (!GENERALIZATION_SCOPES.includes(candidate?.generalization_scope)) errors.push('GENERALIZATION_SCOPE_INVALID');
  if (!validItems(candidate?.items)) errors.push('CANDIDATE_ITEMS_INVALID');
  if (candidate?.confirmation_required !== true) errors.push('CANDIDATE_CONFIRMATION_REQUIRED');
  if (!Array.isArray(candidate?.evidence_ref_ids) || candidate.evidence_ref_ids.some((id) => !allowed_evidence_refs.includes(id))) errors.push('INVENTED_EVIDENCE_REFERENCE');
  if (!Array.isArray(candidate?.authority_ref_ids) || candidate.authority_ref_ids.some((id) => !allowed_authority_refs.includes(id))) errors.push('INVENTED_AUTHORITY_REFERENCE');
  if (errors.length) return deepFreeze({ valid: false, errors, candidate: null });
  const normalized = clone(candidate);
  normalized.target_contract = canonicalTarget(candidate);
  if (!GOVERNED_MUTATION_TARGETS.includes(normalized.target_contract)
    || (ALLOWED_MUTATION_TARGETS[normalized.proposal_type] && !ALLOWED_MUTATION_TARGETS[normalized.proposal_type].includes(normalized.target_contract))) {
    return deepFreeze({ valid: false, errors: ['CANDIDATE_MUTATION_TARGET_UNRESOLVED'], candidate: null });
  }
  return deepFreeze({ valid: true, errors: [], candidate: normalized });
}

export function createHiddenCandidateFromExtraction({ session_id, scope_hash, state_packet_hash, candidate, created_at }) {
  const output = {
    proposal: {
      proposal_type: candidate.proposal_type,
      target_contract: candidate.target_contract,
      operation: candidate.operation,
      summary: candidate.summary,
      items: clone(candidate.items),
      reason: candidate.reason,
      evidence_ref_ids: [...candidate.evidence_ref_ids],
      authority_ref_ids: [...candidate.authority_ref_ids],
      confirmation_required: true,
      generalization_scope: candidate.generalization_scope,
    },
  };
  return createCoachingMutationCandidate({ session_id, scope_hash, state_packet_hash, output, created_at });
}

export function validateNaturalAuthorizationOutput(value, proposal) {
  const errors = [];
  if (!exactKeys(value, ['decision', 'proposal_hash', 'effective_items', 'unambiguous', 'reason'])) errors.push('AUTHORIZATION_FIELDS_INVALID');
  if (!NATURAL_AUTHORIZATION_DECISIONS.includes(value?.decision)) errors.push('AUTHORIZATION_DECISION_INVALID');
  if (value?.proposal_hash !== proposal?.proposal_hash) errors.push('AUTHORIZATION_PROPOSAL_BINDING_INVALID');
  if (!Array.isArray(value?.effective_items)) errors.push('AUTHORIZATION_ITEMS_INVALID');
  if (value?.decision === 'EDIT' && !validItems(value.effective_items)) errors.push('AUTHORIZATION_EDIT_ITEMS_INVALID');
  if (value?.decision !== 'EDIT' && value?.effective_items?.length) errors.push('AUTHORIZATION_UNEXPECTED_ITEMS');
  if (typeof value?.unambiguous !== 'boolean') errors.push('AUTHORIZATION_CERTAINTY_INVALID');
  const actionable = ['CONFIRM', 'EDIT', 'DEFER', 'REJECT'].includes(value?.decision);
  if (actionable && value?.unambiguous !== true) errors.push('AUTHORIZATION_NOT_UNAMBIGUOUS');
  if (!actionable && value?.unambiguous === true) errors.push('AUTHORIZATION_AMBIGUITY_CONTRACT_INVALID');
  return deepFreeze({ valid: errors.length === 0, errors });
}

export function createFreeGptProviderReceipt({ stage, request_hash, response_hash, usage = {}, latency_ms = 0, web_search_calls = 0, attempt_count = 1, estimated_token_cost_microusd = 0, created_at }) {
  if (!['CONVERSATION', 'CANDIDATE_EXTRACTION', 'NATURAL_AUTHORIZATION'].includes(stage)) throw new TypeError('FREE_GPT_V2_STAGE_INVALID');
  if (![request_hash, response_hash].every((value) => HASH.test(value))) throw new TypeError('FREE_GPT_V2_RECEIPT_HASH_INVALID');
  return deepFreeze({
    contract_id: 'free_gpt_v2_provider_receipt', schema_version: FREE_GPT_V2_VERSION,
    stage, model: FREE_GPT_V2_MODEL, store: false, request_hash, response_hash,
    input_tokens: Number.isInteger(usage.input_tokens) ? usage.input_tokens : 0,
    cached_input_tokens: Number.isInteger(usage.cached_input_tokens) ? usage.cached_input_tokens : 0,
    output_tokens: Number.isInteger(usage.output_tokens) ? usage.output_tokens : 0,
    web_search_calls: Number.isInteger(web_search_calls) ? web_search_calls : 0,
    latency_ms,
    attempt_count: Number.isInteger(attempt_count) && attempt_count > 0 ? attempt_count : 1,
    estimated_token_cost_microusd: Number.isInteger(estimated_token_cost_microusd) && estimated_token_cost_microusd >= 0 ? estimated_token_cost_microusd : 0,
    raw_payload_persisted: false, created_at,
  });
}

export function hashRequest(request) { return hashCanonicalJson(request); }
