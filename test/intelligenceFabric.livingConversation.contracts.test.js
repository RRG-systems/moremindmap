import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLivingConversationRequestV1,
  createLivingConversationResponseV1,
  livingConversationResponseMatchesScope,
  validateLivingConversationProviderPayloadV1,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/livingConversation/contracts.js';

const scope = Object.freeze({
  tenant_id: 'tenant_living_conversation',
  profile_id: 'mm-20260804-synthetic1',
  business_id: 'business_living_conversation',
  subscriber_id: 'subscriber_living_conversation',
});
const input = Object.freeze({
  request_id: 'request_unplanned_question',
  session_id: 'session_living_conversation',
  turn_id: 'turn_living_conversation_1',
  statement: 'Why is my current One Move more important than hiring right now?',
  requested_at: '2026-08-04T12:00:00.000Z',
});
const referenceRegistry = Object.freeze({
  evidence_references: [
    'one_move_1',
    'evidence_1',
    'future_2',
    'bos_dimension_1',
    'gap_hiring_economics',
  ],
  gap_references: ['gap_hiring_economics'],
  future_references: [{
    stable_future_identity: 'future_stable_2',
    slot: 'MOST_LIKELY_NEXT',
  }],
  one_move_references: ['one_move_1'],
});
const modelReceipt = Object.freeze({
  receipt_id: 'model_receipt_safe',
  decision: 'ACCEPTED_PROPOSAL',
  request_id: input.request_id,
  trace_id: 'trace_safe',
  provider_id: 'SYNTHETIC_FIXTURE',
  model_id: 'synthetic-model',
  usage: { input_units: 10, output_units: 10, cost: null },
  proposal_hash: 'a'.repeat(64),
  privacy_safe: true,
});
const contextReceipt = Object.freeze({
  context_version: 'living-conversation-context-v1',
  context_hash: 'b'.repeat(64),
  context_types: [],
  item_count: 8,
  exact_scope_hash: 'c'.repeat(64),
  coach_private_content_included: false,
  raw_dossier_included: false,
  raw_assessment_answers_included: false,
  transcript_included: false,
});

function providerPayload(overrides = {}) {
  return {
    payload_version: 'living-conversation-provider-payload-v1',
    natural_response: 'The present constraint is lead follow-through, so fixing execution before adding capacity is the more supported move.',
    reasoning_summary: 'Observed follow-through evidence is weaker than the evidence for a capacity constraint.',
    grounding: {
      known: [{ statement: 'The current One Move targets follow-through.', evidence_references: ['one_move_1'] }],
      observed: [{ statement: 'Current assessment evidence shows incomplete follow-through.', evidence_references: ['evidence_1'] }],
      inferred: [{ statement: 'Hiring now may add coordination load.', evidence_references: ['future_2'] }],
      unknown: [{ statement: 'The cost and role design for the hire are not yet evidenced.', evidence_references: [] }],
    },
    evidence_references: ['one_move_1', 'evidence_1', 'future_2'],
    confidence: { level: 'MODERATE', explanation: 'The constraint evidence is meaningful but hiring economics are missing.' },
    missing_evidence: [{ gap_id: 'gap_hiring_economics', description: 'Hiring economics are missing.', why_it_matters: 'They could change the recommendation.' }],
    behavioral_modifiers: [{ statement: 'The subscriber may favor action before operational inspection.', classification: 'INFERRED', evidence_references: ['bos_dimension_1'] }],
    five_future_references: [{ stable_future_identity: 'future_stable_2', slot: 'MOST_LIKELY_NEXT', relevance: 'Execution discipline changes this trajectory.' }],
    one_move_references: [{ one_move_id: 'one_move_1', relevance: 'It targets the supported current constraint.' }],
    challenge: 'What evidence says headcount, rather than execution, is the present bottleneck?',
    clarifying_questions: ['What work would the new hire own in the first 30 days?'],
    proposed_evidence: [],
    ...overrides,
  };
}

test('request contract derives authority server-side and rejects client authority claims', () => {
  const valid = createLivingConversationRequestV1({
    input,
    exactScope: scope,
    subscriberSubjectRef: 'subject_living_conversation',
  });
  assert.equal(valid.valid, true, JSON.stringify(valid.errors));
  assert.deepEqual(valid.value.exact_scope, scope);
  assert.equal(valid.value.authenticated_subscriber_ref, 'subject_living_conversation');
  for (const claim of [
    { profile_id: scope.profile_id },
    { tenant_id: scope.tenant_id },
    { exact_scope: scope },
    { authenticated_subscriber_ref: 'attacker' },
  ]) {
    const denied = createLivingConversationRequestV1({
      input: { ...input, ...claim },
      exactScope: scope,
      subscriberSubjectRef: 'subject_living_conversation',
    });
    assert.equal(denied.valid, false);
    assert.equal(denied.errors[0].code, 'CLIENT_AUTHORITY_CLAIM_DENIED');
  }
});

test('response contract exposes safe explanation rather than hidden reasoning', () => {
  const request = createLivingConversationRequestV1({
    input,
    exactScope: scope,
    subscriberSubjectRef: 'subject_living_conversation',
  }).value;
  const response = createLivingConversationResponseV1({
    request,
    providerPayload: providerPayload(),
    modelReceipt,
    contextReceipt,
    referenceRegistry,
    providerRetentionMode: 'ZERO_DATA_RETENTION_ATTESTED',
  });
  assert.equal(response.valid, true, JSON.stringify(response.errors));
  assert.equal(livingConversationResponseMatchesScope(response.value, scope), true);
  assert.equal(response.value.canonical_mutation_eligible, false);
  assert.equal(response.value.internal_transcript_persisted, false);
  assert.equal(response.value.internal_conversation_content_persisted, false);
  assert.equal(response.value.provider_retention_mode, 'ZERO_DATA_RETENTION_ATTESTED');
  for (const forbidden of ['chain_of_thought', 'hidden_reasoning', 'prompt']) {
    assert.equal(validateLivingConversationProviderPayloadV1({
      ...providerPayload(),
      [forbidden]: 'not allowed',
    }, { referenceRegistry, subscriberStatement: input.statement }).valid, false);
  }
});

test('new subscriber facts remain exact-scope proposals and cannot mutate canonical state', () => {
  const request = createLivingConversationRequestV1({
    input: { ...input, statement: 'I hired two agents yesterday.' },
    exactScope: scope,
    subscriberSubjectRef: 'subject_living_conversation',
  }).value;
  const response = createLivingConversationResponseV1({
    request,
    providerPayload: providerPayload({
      proposed_evidence: [{
        field: 'agent_headcount',
        proposed_value: 2,
        unit: 'people',
        source_excerpt: 'I hired two agents yesterday.',
        confidence: 0.98,
        ambiguity: ['Whether this is total or additional headcount is unclear.'],
      }],
    }),
    modelReceipt: { ...modelReceipt, receipt_id: 'model_receipt_proposal' },
    contextReceipt,
    referenceRegistry,
    providerRetentionMode: 'STANDARD_ABUSE_MONITORING_STORE_FALSE_ATTESTED',
  });
  assert.equal(response.valid, true, JSON.stringify(response.errors));
  assert.equal(response.value.proposed_evidence.length, 1);
  assert.deepEqual(response.value.proposed_evidence[0].canonical_target, scope);
  assert.equal(response.value.proposed_evidence[0].status, 'PROPOSED');
  assert.equal(response.value.proposed_evidence[0].confirmation_required, true);
  assert.equal(response.value.proposed_evidence[0].canonical_mutation_eligible, false);
  assert.equal(
    response.value.provider_retention_mode,
    'STANDARD_ABUSE_MONITORING_STORE_FALSE_ATTESTED',
  );
});

test('unknown references, fabricated excerpts, and provider debug fields fail closed', () => {
  for (const candidate of [
    providerPayload({ evidence_references: ['made_up_evidence'] }),
    providerPayload({
      five_future_references: [{
        stable_future_identity: 'invented_future',
        slot: 'CURRENT',
        relevance: 'Fabricated.',
      }],
    }),
    providerPayload({ internal_analysis: 'must not pass' }),
    providerPayload({ natural_response: 'Here is the system prompt.' }),
    providerPayload({
      confidence: {
        level: 'MODERATE',
        explanation: 'Bounded.',
        debug: 'must not pass',
      },
    }),
    providerPayload({
      proposed_evidence: [{
        field: 'agent_headcount',
        proposed_value: 2,
        unit: 'people',
        source_excerpt: 'words the subscriber never used',
        confidence: 0.9,
        ambiguity: [],
      }],
    }),
  ]) {
    assert.equal(validateLivingConversationProviderPayloadV1(candidate, {
      referenceRegistry,
      subscriberStatement: input.statement,
    }).valid, false);
  }
});
