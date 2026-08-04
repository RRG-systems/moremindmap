import { hashCanonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';
import {
  exactPrivateRuntimeScope,
  samePrivateRuntimeScope,
} from '../contracts.js';

export const LIVING_CONVERSATION_REQUEST_VERSION =
  'living-conversation-request-v1';
export const LIVING_CONVERSATION_RESPONSE_VERSION =
  'living-conversation-response-v1';
export const LIVING_CONVERSATION_PROVIDER_PAYLOAD_VERSION =
  'living-conversation-provider-payload-v1';

const CLASSIFICATIONS = Object.freeze([
  'KNOWN',
  'OBSERVED',
  'INFERRED',
  'UNKNOWN',
]);
const CONFIDENCE_LEVELS = Object.freeze(['LOW', 'MODERATE', 'HIGH']);
const FORBIDDEN_PROVIDER_KEYS = new Set([
  'authorization',
  'canonical_event',
  'canonical_mutation',
  'chain_of_thought',
  'consent',
  'cookie',
  'credentials',
  'execute',
  'hidden_reasoning',
  'prompt',
  'raw_context',
  'raw_dossier',
  'secret',
  'token',
  'transcript',
]);
const CLIENT_AUTHORITY_KEYS = new Set([
  'authenticated_subscriber_ref',
  'business_id',
  'canonical_subject_ref',
  'exact_scope',
  'profile_id',
  'subscriber_id',
  'tenant_id',
]);
const PROVIDER_PAYLOAD_KEYS = Object.freeze([
  'payload_version',
  'natural_response',
  'reasoning_summary',
  'grounding',
  'evidence_references',
  'confidence',
  'missing_evidence',
  'behavioral_modifiers',
  'five_future_references',
  'one_move_references',
  'challenge',
  'clarifying_questions',
  'proposed_evidence',
]);
const UNSAFE_OUTPUT_TEXT = /system prompt|developer message|internal policy|chain[- ]of[- ]thought|hidden reasoning|api key|credential material/i;

const frozen = (value) => deepFreeze(structuredClone(value));
const object = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value, max) => typeof value === 'string'
  && value.trim().length > 0
  && value.length <= max;
const timestamp = (value) => text(value, 64) && Number.isFinite(Date.parse(value));
const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const opaque = (value, max = 160) => text(value, max)
  && /^[a-zA-Z0-9:_-]+$/.test(value);
const list = (value, max) => Array.isArray(value) && value.length <= max;
const issue = (code, field) => Object.freeze({ code, field });
const result = (errors, value = null) => frozen({
  valid: errors.length === 0,
  errors,
  value: errors.length === 0 ? value : null,
});
const exactKeys = (value, keys) => object(value)
  && Object.keys(value).length === keys.length
  && Object.keys(value).every((key) => keys.includes(key));

function containsUnsafeOutputText(value, depth = 0) {
  if (depth > 8 || value == null) return false;
  if (typeof value === 'string') return UNSAFE_OUTPUT_TEXT.test(value);
  if (Array.isArray(value)) {
    return value.some((entry) => containsUnsafeOutputText(entry, depth + 1));
  }
  if (!object(value)) return false;
  return Object.values(value).some((entry) => containsUnsafeOutputText(entry, depth + 1));
}

function containsForbiddenProviderKey(value, depth = 0) {
  if (depth > 8 || value == null || typeof value !== 'object') return false;
  if (Array.isArray(value)) {
    return value.some((entry) => containsForbiddenProviderKey(entry, depth + 1));
  }
  return Object.entries(value).some(([key, child]) =>
    FORBIDDEN_PROVIDER_KEYS.has(key.toLowerCase())
    || containsForbiddenProviderKey(child, depth + 1));
}

function validGroundingEntry(entry, allowedReferences) {
  return exactKeys(entry, ['statement', 'evidence_references'])
    && text(entry.statement, 600)
    && list(entry.evidence_references, 20)
    && entry.evidence_references.every((reference) => opaque(reference, 256)
      && allowedReferences.has(reference));
}

function validMissingEvidence(entry, allowedGapReferences) {
  return exactKeys(entry, ['gap_id', 'description', 'why_it_matters'])
    && (entry.gap_id == null || opaque(entry.gap_id, 256))
    && (entry.gap_id == null || allowedGapReferences.has(entry.gap_id))
    && text(entry.description, 600)
    && text(entry.why_it_matters, 600);
}

function validBehavioralModifier(entry, allowedReferences) {
  return exactKeys(entry, ['statement', 'classification', 'evidence_references'])
    && text(entry.statement, 600)
    && entry.classification === 'INFERRED'
    && list(entry.evidence_references, 20)
    && entry.evidence_references.every((reference) => opaque(reference, 256)
      && allowedReferences.has(reference));
}

function validFutureReference(entry, allowedFutureReferences) {
  return exactKeys(entry, ['stable_future_identity', 'slot', 'relevance'])
    && opaque(entry.stable_future_identity, 256)
    && opaque(entry.slot, 64)
    && text(entry.relevance, 600)
    && allowedFutureReferences.some((future) =>
      future.stable_future_identity === entry.stable_future_identity
      && future.slot === entry.slot);
}

function validOneMoveReference(entry, allowedOneMoveReferences) {
  return exactKeys(entry, ['one_move_id', 'relevance'])
    && opaque(entry.one_move_id, 256)
    && text(entry.relevance, 600)
    && allowedOneMoveReferences.has(entry.one_move_id);
}

function validProposedEvidence(entry, subscriberStatement) {
  const excerpt = typeof entry?.source_excerpt === 'string'
    ? entry.source_excerpt.replace(/\s+/g, ' ').trim().toLowerCase()
    : '';
  const statement = typeof subscriberStatement === 'string'
    ? subscriberStatement.replace(/\s+/g, ' ').trim().toLowerCase()
    : '';
  return exactKeys(entry, [
    'field',
    'proposed_value',
    'unit',
    'source_excerpt',
    'confidence',
    'ambiguity',
  ])
    && typeof entry.field === 'string'
    && /^[a-z][a-z0-9_]{0,79}$/.test(entry.field)
    && entry.proposed_value !== undefined
    && (entry.proposed_value == null
      || ['string', 'number', 'boolean'].includes(typeof entry.proposed_value))
    && (entry.unit == null || text(entry.unit, 64))
    && text(entry.source_excerpt, 800)
    && Number.isFinite(entry.confidence)
    && entry.confidence >= 0
    && entry.confidence <= 1
    && list(entry.ambiguity, 10)
    && entry.ambiguity.every((item) => text(item, 300))
    && excerpt.length > 0
    && statement.includes(excerpt);
}

export function createLivingConversationRequestV1({
  input,
  exactScope,
  subscriberSubjectRef,
} = {}) {
  const errors = [];
  if (!object(input)) return result([issue('LIVING_CONVERSATION_REQUEST_INVALID', '$')]);
  for (const key of Object.keys(input)) {
    if (CLIENT_AUTHORITY_KEYS.has(key)) {
      errors.push(issue('CLIENT_AUTHORITY_CLAIM_DENIED', key));
    }
  }
  if (!exactPrivateRuntimeScope(exactScope)) {
    errors.push(issue('LIVING_CONVERSATION_REQUEST_INVALID', 'exact_scope'));
  }
  if (!opaque(subscriberSubjectRef, 256)) {
    errors.push(issue('LIVING_CONVERSATION_REQUEST_INVALID', 'authenticated_subscriber_ref'));
  }
  for (const key of ['request_id', 'session_id', 'turn_id']) {
    if (!opaque(input[key], 160)) {
      errors.push(issue('LIVING_CONVERSATION_REQUEST_INVALID', key));
    }
  }
  if (!text(input.statement, 4000)) {
    errors.push(issue('LIVING_CONVERSATION_REQUEST_INVALID', 'statement'));
  }
  if (!timestamp(input.requested_at)) {
    errors.push(issue('LIVING_CONVERSATION_REQUEST_INVALID', 'requested_at'));
  }
  if (input.operation_metadata != null && !object(input.operation_metadata)) {
    errors.push(issue('LIVING_CONVERSATION_REQUEST_INVALID', 'operation_metadata'));
  }
  if (errors.length) return result(errors);
  const metadata = input.operation_metadata || {};
  const value = {
    request_version: LIVING_CONVERSATION_REQUEST_VERSION,
    request_id: input.request_id,
    session_id: input.session_id,
    turn_id: input.turn_id,
    authenticated_subscriber_ref: subscriberSubjectRef,
    exact_scope: exactScope,
    statement: input.statement.trim(),
    requested_at: input.requested_at,
    operation_metadata: {
      client_surface: text(metadata.client_surface, 80)
        ? metadata.client_surface
        : 'PRIVATE_SUBSCRIPTION',
      locale: text(metadata.locale, 32) ? metadata.locale : 'en-US',
      interaction_mode: 'OPEN_ENDED_CONVERSATION',
    },
  };
  return result([], value);
}

export function validateLivingConversationProviderPayloadV1(payload, {
  referenceRegistry = null,
  subscriberStatement = null,
} = {}) {
  const errors = [];
  if (!exactKeys(payload, PROVIDER_PAYLOAD_KEYS)
    || containsForbiddenProviderKey(payload)
    || containsUnsafeOutputText(payload)
    || !object(referenceRegistry)) {
    return result([issue('LIVING_CONVERSATION_RESPONSE_INVALID', '$')]);
  }
  const allowedReferences = new Set(referenceRegistry.evidence_references || []);
  const allowedGapReferences = new Set(referenceRegistry.gap_references || []);
  const allowedFutureReferences = Array.isArray(referenceRegistry.future_references)
    ? referenceRegistry.future_references
    : [];
  const allowedOneMoveReferences = new Set(referenceRegistry.one_move_references || []);
  if (payload.payload_version !== LIVING_CONVERSATION_PROVIDER_PAYLOAD_VERSION) {
    errors.push(issue('LIVING_CONVERSATION_RESPONSE_INVALID', 'payload_version'));
  }
  if (!text(payload.natural_response, 6000)) {
    errors.push(issue('LIVING_CONVERSATION_RESPONSE_INVALID', 'natural_response'));
  }
  if (!text(payload.reasoning_summary, 2000)) {
    errors.push(issue('LIVING_CONVERSATION_RESPONSE_INVALID', 'reasoning_summary'));
  }
  if (!exactKeys(payload.grounding, ['known', 'observed', 'inferred', 'unknown'])) {
    errors.push(issue('LIVING_CONVERSATION_RESPONSE_INVALID', 'grounding'));
  } else {
    const keys = Object.keys(payload.grounding);
    const expected = ['known', 'observed', 'inferred', 'unknown'];
    if (keys.some((key) => !expected.includes(key))) {
      errors.push(issue('LIVING_CONVERSATION_RESPONSE_INVALID', 'grounding'));
    }
    for (const key of expected) {
      if (!list(payload.grounding[key], 20)
        || payload.grounding[key]
          .some((entry) => !validGroundingEntry(entry, allowedReferences))) {
        errors.push(issue('LIVING_CONVERSATION_RESPONSE_INVALID', `grounding.${key}`));
      }
    }
  }
  if (!list(payload.evidence_references, 40)
    || payload.evidence_references.some((reference) => !opaque(reference, 256)
      || !allowedReferences.has(reference))) {
    errors.push(issue('LIVING_CONVERSATION_RESPONSE_INVALID', 'evidence_references'));
  }
  if (!exactKeys(payload.confidence, ['level', 'explanation'])
    || !CONFIDENCE_LEVELS.includes(payload.confidence.level)
    || !text(payload.confidence.explanation, 600)) {
    errors.push(issue('LIVING_CONVERSATION_RESPONSE_INVALID', 'confidence'));
  }
  if (!list(payload.missing_evidence, 20)
    || payload.missing_evidence
      .some((entry) => !validMissingEvidence(entry, allowedGapReferences))) {
    errors.push(issue('LIVING_CONVERSATION_RESPONSE_INVALID', 'missing_evidence'));
  }
  if (!list(payload.behavioral_modifiers, 12)
    || payload.behavioral_modifiers
      .some((entry) => !validBehavioralModifier(entry, allowedReferences))) {
    errors.push(issue('LIVING_CONVERSATION_RESPONSE_INVALID', 'behavioral_modifiers'));
  }
  if (!list(payload.five_future_references, 5)
    || payload.five_future_references
      .some((entry) => !validFutureReference(entry, allowedFutureReferences))) {
    errors.push(issue('LIVING_CONVERSATION_RESPONSE_INVALID', 'five_future_references'));
  }
  if (!list(payload.one_move_references, 3)
    || payload.one_move_references
      .some((entry) => !validOneMoveReference(entry, allowedOneMoveReferences))) {
    errors.push(issue('LIVING_CONVERSATION_RESPONSE_INVALID', 'one_move_references'));
  }
  if (payload.challenge != null && !text(payload.challenge, 1000)) {
    errors.push(issue('LIVING_CONVERSATION_RESPONSE_INVALID', 'challenge'));
  }
  if (!list(payload.clarifying_questions, 5)
    || payload.clarifying_questions.some((question) => !text(question, 500))) {
    errors.push(issue('LIVING_CONVERSATION_RESPONSE_INVALID', 'clarifying_questions'));
  }
  if (!list(payload.proposed_evidence, 12)
    || payload.proposed_evidence
      .some((entry) => !validProposedEvidence(entry, subscriberStatement))) {
    errors.push(issue('LIVING_CONVERSATION_RESPONSE_INVALID', 'proposed_evidence'));
  }
  return result(errors, payload);
}

export function createLivingConversationResponseV1({
  request,
  providerPayload,
  modelReceipt,
  contextReceipt,
  referenceRegistry,
  providerRetentionMode,
} = {}) {
  const requestValidation = request?.request_version === LIVING_CONVERSATION_REQUEST_VERSION
    && exactPrivateRuntimeScope(request?.exact_scope);
  const payloadValidation = validateLivingConversationProviderPayloadV1(providerPayload, {
    referenceRegistry,
    subscriberStatement: request?.statement,
  });
  const modelReceiptValid = exactKeys(modelReceipt, [
    'receipt_id',
    'decision',
    'request_id',
    'trace_id',
    'provider_id',
    'model_id',
    'usage',
    'proposal_hash',
    'privacy_safe',
  ])
    && exactKeys(modelReceipt.usage, ['input_units', 'output_units', 'cost'])
    && opaque(modelReceipt.receipt_id, 256)
    && modelReceipt.privacy_safe === true
    && sha256(modelReceipt.proposal_hash);
  const contextReceiptValid = exactKeys(contextReceipt, [
    'context_version',
    'context_hash',
    'context_types',
    'item_count',
    'exact_scope_hash',
    'coach_private_content_included',
    'raw_dossier_included',
    'raw_assessment_answers_included',
    'transcript_included',
  ])
    && sha256(contextReceipt.context_hash)
    && sha256(contextReceipt.exact_scope_hash)
    && contextReceipt.coach_private_content_included === false
    && contextReceipt.raw_dossier_included === false
    && contextReceipt.raw_assessment_answers_included === false
    && contextReceipt.transcript_included === false;
  const providerRetentionValid = [
    'ZERO_DATA_RETENTION_ATTESTED',
    'STANDARD_ABUSE_MONITORING_STORE_FALSE_ATTESTED',
  ].includes(providerRetentionMode);
  if (!requestValidation || !payloadValidation.valid
    || !modelReceiptValid || !contextReceiptValid || !providerRetentionValid) {
    return result([issue('LIVING_CONVERSATION_RESPONSE_INVALID', '$')]);
  }
  const scope = request.exact_scope;
  const proposedEvidence = providerPayload.proposed_evidence.map((entry, index) => ({
    proposal_id: `living_evidence_${hashCanonicalJson({
      request_id: request.request_id,
      turn_id: request.turn_id,
      index,
      field: entry.field,
      proposed_value: entry.proposed_value,
    }).slice(0, 24)}`,
    field: entry.field,
    proposed_value: entry.proposed_value,
    unit: entry.unit || null,
    source_excerpt: entry.source_excerpt,
    source_reference: `turn_${hashCanonicalJson({
      session_id: request.session_id,
      turn_id: request.turn_id,
    }).slice(0, 24)}`,
    confidence: entry.confidence,
    ambiguity: entry.ambiguity,
    canonical_target: scope,
    status: 'PROPOSED',
    confirmation_required: true,
    canonical_mutation_eligible: false,
  }));
  const response = {
    response_version: LIVING_CONVERSATION_RESPONSE_VERSION,
    request_id: request.request_id,
    session_id: request.session_id,
    turn_id: request.turn_id,
    natural_response: providerPayload.natural_response,
    reasoning_summary: providerPayload.reasoning_summary,
    grounding: Object.fromEntries(['known', 'observed', 'inferred', 'unknown']
      .map((classification) => [classification,
        providerPayload.grounding[classification].map((entry) => ({
          statement: entry.statement,
          evidence_references: [...entry.evidence_references],
        }))])),
    evidence_references: [...providerPayload.evidence_references],
    confidence: {
      level: providerPayload.confidence.level,
      explanation: providerPayload.confidence.explanation,
    },
    missing_evidence: providerPayload.missing_evidence.map((entry) => ({
      gap_id: entry.gap_id,
      description: entry.description,
      why_it_matters: entry.why_it_matters,
    })),
    behavioral_modifiers: providerPayload.behavioral_modifiers.map((entry) => ({
      statement: entry.statement,
      classification: entry.classification,
      evidence_references: [...entry.evidence_references],
    })),
    five_future_references: providerPayload.five_future_references.map((entry) => ({
      stable_future_identity: entry.stable_future_identity,
      slot: entry.slot,
      relevance: entry.relevance,
    })),
    one_move_references: providerPayload.one_move_references.map((entry) => ({
      one_move_id: entry.one_move_id,
      relevance: entry.relevance,
    })),
    challenge: providerPayload.challenge || null,
    clarifying_questions: [...providerPayload.clarifying_questions],
    proposed_evidence: proposedEvidence,
    exact_scope_hash: hashCanonicalJson(scope),
    model_receipt: modelReceipt,
    context_receipt: contextReceipt,
    canonical_mutation_eligible: false,
    internal_transcript_persisted: false,
    internal_conversation_content_persisted: false,
    provider_retention_mode: providerRetentionMode,
  };
  return result([], response);
}

export function livingConversationResponseMatchesScope(response, scope) {
  return response?.response_version === LIVING_CONVERSATION_RESPONSE_VERSION
    && response.exact_scope_hash === hashCanonicalJson(scope)
    && response.proposed_evidence.every((entry) =>
      samePrivateRuntimeScope(entry.canonical_target, scope));
}

export { CLASSIFICATIONS, CONFIDENCE_LEVELS };
