import assert from 'node:assert/strict';
import test from 'node:test';

import {
  InMemoryLivingRelationshipStore,
  createCoachingEpisodeContext,
  createFreeGptLivingRelationshipRuntimeV2,
  createFrontierConversationSeamV2,
  createInitialLivingBusinessTwinPublication,
  createNaturalAuthorizationInterpreterV1,
  createPostResponseCandidateExtractorV1,
  createSessionCloseSeamV1,
  retrieveCoachingDoctrine,
} from '../src/lib/subscriptionV1/index.js';
import { testArtifacts, testBusinessTruth, testScope, testWholePersonContext } from './subscriptionV1.testFixtures.js';

globalThis.fetch = () => { throw new Error('F03_F09_RUNTIME_CONTRACT_NETWORK_DENIED'); };

const scope = testScope();
const SESSION_ID = 'session_f03_runtime_contract';
const BASE_TIME = Date.parse('2026-09-11T23:30:00.000Z');

function initialState() {
  const way = (title) => ({
    title,
    strategies: ['Choose an owner', 'Define the boundary', 'Publish the rule', 'Review exceptions', 'Keep what works'],
  });
  return {
    WHERE_YOU_ARE: { accepted_changes: {} },
    FIVE_FUTURES: { customer_challenges: [] },
    ONE_MOVE: { customer_challenges: [] },
    plan_135: {
      goal: 'Build durable operating ownership.',
      ways: [way('Clarify decision rights'), way('Transfer routine work'), way('Measure owner independence')],
    },
    EVIDENCE: { accepted_changes: {}, corrections: [] },
    engagement: { commitments: [], interventions: [], outcomes: [] },
  };
}

function commitmentCandidate(summary, value) {
  return {
    candidate_type: 'COMMITMENT_CANDIDATE',
    proposal_type: 'COMMITMENT_CANDIDATE',
    target_contract: 'PLAN_135',
    operation: 'PROPOSE',
    summary,
    items: [{ field: 'commitment.intervention', value }],
    reason: 'The customer explicitly proposed this bounded work; it remains a draft until exact confirmation.',
    evidence_ref_ids: [],
    authority_ref_ids: [],
    confirmation_required: true,
    generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
  };
}

function parsedUserInput(request) {
  const input = request.input.find((item) => item.role === 'user');
  return JSON.parse(input.content);
}

async function createF03Runtime() {
  const artifacts = testArtifacts(scope);
  const created = createInitialLivingBusinessTwinPublication({
    scope,
    artifact_lineage: artifacts.map(({ artifact_type, content_hash }) => ({ artifact_type, content_hash })),
    initial_state: initialState(),
    published_at: new Date(BASE_TIME).toISOString(),
  });
  assert.equal(created.ok, true, created.code);
  const store = new InMemoryLivingRelationshipStore();
  assert.equal((await store.initialize({ scope, publication: created.publication })).ok, true);

  const stages = [];
  let extractionCount = 0;
  const transport = async (request, { stage }) => {
    stages.push(stage);
    if (stage === 'CONVERSATION') {
      return {
        output: { customer_message: extractionCount === 0
          ? 'We can keep that as a draft for your review.'
          : 'We can replace the earlier draft with the narrower experiment and still leave the decision with you.' },
        usage: {},
        latency_ms: 0,
      };
    }
    if (stage === 'NATURAL_AUTHORIZATION') {
      const input = parsedUserInput(request);
      return {
        output: {
          decision: 'NONE',
          proposal_hash: input.pending_proposal.proposal_hash,
          effective_items: [],
          unambiguous: false,
          reason: 'The customer proposed replacement wording but did not authorize the pending draft.',
        },
        usage: {},
        latency_ms: 0,
      };
    }
    if (stage === 'CANDIDATE_EXTRACTION') {
      extractionCount += 1;
      const input = parsedUserInput(request);
      const pendingHash = input.unconfirmed_pending_proposals?.[0]?.proposal_hash;
      return {
        output: extractionCount === 1
          ? {
            candidate: commitmentCandidate(
              'Review routine decision ownership every week.',
              'Run a weekly decision-rights review for the next month.',
            ),
            replaces_pending_proposal_hashes: [],
          }
          : {
            candidate: commitmentCandidate(
              'Test one narrower owner-independent decision lane.',
              'Run a two-week owner-independent decision-lane experiment.',
            ),
            replaces_pending_proposal_hashes: [pendingHash],
          },
        usage: {},
        latency_ms: 0,
      };
    }
    throw new Error(`unexpected_provider_stage:${stage}`);
  };

  let tick = 0;
  const now = () => new Date(BASE_TIME + (++tick * 1000)).toISOString();
  const runtime = createFreeGptLivingRelationshipRuntimeV2({
    scope,
    session_id: SESSION_ID,
    store,
    conversation_seam: createFrontierConversationSeamV2({ transport, enabled: true, web_search_enabled: false, now }),
    session_close_seam: createSessionCloseSeamV1({ transport, enabled: true, now }),
    candidate_extractor: createPostResponseCandidateExtractorV1({ transport, enabled: true, now }),
    authorization_interpreter: createNaturalAuthorizationInterpreterV1({ transport, enabled: true, now }),
    doctrine_retrieval: retrieveCoachingDoctrine({ purpose: 'WEEKLY_COACHING', vertical_id: 'PROFESSIONAL_SERVICES' }),
    canonical_artifacts: artifacts,
    business_truth: testBusinessTruth(),
    whole_person_execution_context: testWholePersonContext(),
    relationship_context: {
      session_kind: 'WEEKLY',
      preferred_conversational_name: 'Avery',
      preferred_name_authority: 'GOVERNED_TEST_SUBJECT',
    },
    coaching_session: createCoachingEpisodeContext({
      phase: 'ACTIVE',
      preferred_conversational_name: 'Avery',
      preferred_name_authority: 'GOVERNED_TEST_SUBJECT',
      session_kind: 'WEEKLY',
    }),
    clock: now,
  });
  assert.equal(runtime.assemble({ as_of_at: now() }).ok, true);
  return { runtime, store, stages, initialPublication: created.publication };
}

test('F03 NONE authorization can continue into an exact replacement that supersedes only draft review custody', async () => {
  const { runtime, store, stages, initialPublication } = await createF03Runtime();
  const first = await runtime.coach({ customer_turn: 'Draft a weekly decision-rights review for me.' });
  assert.equal(first.ok, true, first.code);
  assert.equal(first.confirmation_required, true);
  const oldProposal = first.proposal;

  const second = await runtime.coach({
    customer_turn: 'Replace that draft with a narrower two-week owner-independent decision-lane experiment.',
  });
  assert.equal(second.ok, true, second.code);
  assert.equal(second.authorization.decision, 'NONE');
  assert.equal(second.mutation_performed, false);
  assert.notEqual(second.proposal.proposal_id, oldProposal.proposal_id);

  const snapshot = store.snapshot();
  const oldRecord = snapshot.proposals[oldProposal.proposal_id];
  const newRecord = snapshot.proposals[second.proposal.proposal_id];
  assert.equal(oldRecord.workflow_status, 'SUPERSEDED_FOR_REVIEW');
  assert.equal(oldRecord.superseded_by_proposal_id, second.proposal.proposal_id);
  assert.equal(newRecord.workflow_status, 'AWAITING_CUSTOMER_DECISION');
  assert.equal(runtime.pendingProposal().proposal_id, second.proposal.proposal_id);
  assert.equal(snapshot.current_publication_hash, initialPublication.publication_hash);
  assert.equal(snapshot.decisions && Object.keys(snapshot.decisions).length, 0);
  assert.equal(snapshot.personal_rsl_records.length, 0);
  assert.equal(store.inspect({ scope }).publication_count, 1);
  assert.deepEqual(stages, [
    'CONVERSATION',
    'CANDIDATE_EXTRACTION',
    'NATURAL_AUTHORIZATION',
    'CONVERSATION',
    'CANDIDATE_EXTRACTION',
  ]);

  const staleConfirmation = await runtime.decide({
    proposal_id: oldProposal.proposal_id,
    decision: 'CONFIRM',
    idempotency_key: 'f03-old-superseded-confirmation-denied',
  });
  assert.equal(staleConfirmation.ok, false);
  assert.equal(staleConfirmation.code, 'AFW05_PROPOSAL_REVIEW_REQUIRED');
  assert.equal(store.inspect({ scope }).personal_rsl_event_count, 0);
});

function f09Packet(preferredName = 'Avery') {
  return {
    packet_hash: 'a'.repeat(64),
    session_id: 'session_f09_positive_contract',
    provider_understanding: {
      coaching_session: {
        current_phase: 'STARTED',
        preferred_conversational_name: preferredName,
      },
    },
  };
}

async function runF09Conversation({ customerMessage, output, mutation_performed }) {
  const requests = [];
  const seam = createFrontierConversationSeamV2({
    enabled: true,
    web_search_enabled: false,
    now: () => '2026-09-11T23:45:00.000Z',
    transport: async (request) => {
      requests.push(request);
      return { output: { customer_message: output }, usage: {}, latency_ms: 0 };
    },
  });
  const result = await seam.coach({
    packet: f09Packet(),
    customer_message: customerMessage,
    mutation_performed,
  });
  return { result, request: requests[0] };
}

test('F09 accepts a useful STARTED response that naturally uses the governed preferred name', async () => {
  const { result } = await runF09Conversation({
    customerMessage: 'Where should we begin?',
    output: 'Avery, let’s start with what changed since you last looked at the plan.',
    mutation_performed: false,
  });
  assert.equal(result.ok, true, result.code);
  assert.equal(result.code, 'FREE_GPT_V2_CONVERSATION_ACCEPTED');
  assert.match(result.customer_message, /Avery/u);
  assert.equal(result.mutation_performed, false);
});

test('F09 accepts a truthful mutation claim only after a completed mutation and sends the reassembled-state transition', async () => {
  const { result, request } = await runF09Conversation({
    customerMessage: 'Did that confirmed change take effect?',
    output: 'Avery, I updated your plan with the confirmed change. What would you like to inspect first?',
    mutation_performed: true,
  });
  assert.equal(result.ok, true, result.code);
  assert.equal(result.code, 'FREE_GPT_V2_CONVERSATION_ACCEPTED');
  assert.equal(result.mutation_performed, true);
  assert.deepEqual(parsedUserInput(request).deterministic_transition, {
    mutation_performed: true,
    current_governed_state_reassembled: true,
  });
});
