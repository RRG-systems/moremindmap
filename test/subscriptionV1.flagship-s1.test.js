import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { setImmediate } from 'node:timers';

import { createSyntheticLivingRelationshipLab } from '../src/lab/subscriptionLivingBusinessRelationshipV1/createSyntheticLivingRelationshipLab.js';
import {
  InMemoryLivingRelationshipStore,
  createConfirmedPersonalRslMutation,
  createGovernedChangeProposal,
  createHiddenCandidateFromExtraction,
  createProposalDecision,
  FREE_GPT_V2_MODEL,
  FREE_GPT_V2_RUNTIME_POLICY,
  scopeFingerprint,
  SUBSCRIPTION_S1_DJ_COACHING_DEMONSTRATIONS,
} from '../src/lib/subscriptionV1/index.js';

const nullCandidate = Object.freeze({ candidate: null });

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('S1 sends exactly three DJ demonstrations and purpose-ranks after governed assembly', async () => {
  let conversationRequest;
  const transport = async (request, { stage }) => {
    if (stage === 'CONVERSATION') {
      conversationRequest = request;
      return {
        output: { customer_message: 'The business may be changing direction before your effort changes. What happened just before the current path began to feel harder?' },
        usage: { input_tokens: 900, cached_input_tokens: 100, output_tokens: 80 },
        latency_ms: 40,
        web_search_calls: 0,
        external_evidence: [],
      };
    }
    return { output: nullCandidate, usage: { input_tokens: 300, output_tokens: 10 }, latency_ms: 20, web_search_calls: 0, external_evidence: [] };
  };
  const { controller } = await createSyntheticLivingRelationshipLab({ transport, subject_key: 're-mid', seed_weekly_fixture: false });
  const result = await controller.send({
    message: 'Where is this business heading, and what changed?',
    active_lens: 'FIVE_FUTURES',
    purpose: 'REVIEW_FUTURES',
    topics: ['Five trajectories', 'What changed'],
  });
  assert.equal(result.ok, true, result.code);
  assert.equal(conversationRequest.model, FREE_GPT_V2_MODEL);
  assert.equal(conversationRequest.reasoning.effort, 'xhigh');
  assert.equal(conversationRequest.store, false);
  assert.deepEqual(conversationRequest.tools, [{ type: 'web_search' }]);
  const input = JSON.parse(conversationRequest.input[1].content);
  assert.equal(input.coaching_demonstrations.length, 3);
  assert.deepEqual(input.coaching_demonstrations, SUBSCRIPTION_S1_DJ_COACHING_DEMONSTRATIONS);
  assert.ok(input.whole_coaching_understanding.possible_futures);
  assert.ok(input.whole_coaching_understanding.whole_business);
  assert.equal(result.context_selection_receipt.selection_mode, 'AUTHORITY_FILTER_FIRST_PURPOSE_SELECT_SECOND');
  assert.ok(result.context_selection_receipt.full_context_characters > result.context_selection_receipt.selected_context_characters);
  assert.ok(result.context_selection_receipt.doctrine_eligible_count > result.context_selection_receipt.doctrine_selected_count);
  assert.equal(result.context_selection_receipt.full_corpus_available_server_side, true);
  assert.equal(result.context_selection_receipt.fixed_dj_weight, false);
});

test('S1 exposes valid coaching before candidate extraction begins and keeps mutation at zero', async () => {
  const releaseExtraction = deferred();
  const sequence = [];
  const transport = async (_request, { stage }) => {
    sequence.push(`${stage}:start`);
    if (stage === 'CONVERSATION') {
      sequence.push(`${stage}:complete`);
      return { output: { customer_message: 'Your effort may be hiding a decision-rights problem. Which decision returns to you most often?' }, usage: {}, latency_ms: 30 };
    }
    await releaseExtraction.promise;
    sequence.push(`${stage}:complete`);
    return { output: nullCandidate, usage: {}, latency_ms: 70 };
  };
  const { controller } = await createSyntheticLivingRelationshipLab({ transport, subject_key: 're-mid', seed_weekly_fixture: false });
  let callbackPayload;
  let settled = false;
  const turnPromise = controller.send({
    message: 'I am working harder and getting less out of the business.',
    on_coaching_ready: (payload) => {
      sequence.push('COACHING_READY');
      callbackPayload = payload;
    },
  }).then((value) => { settled = true; return value; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(callbackPayload.customer_message, 'Your effort may be hiding a decision-rights problem. Which decision returns to you most often?');
  assert.equal(callbackPayload.mutation_performed, false);
  assert.equal(callbackPayload.timing.candidate_extraction_started, false);
  assert.deepEqual(sequence.slice(0, 4), ['CONVERSATION:start', 'CONVERSATION:complete', 'COACHING_READY', 'CANDIDATE_EXTRACTION:start']);
  assert.equal(settled, false);
  assert.equal(controller.pendingProposal(), null);
  releaseExtraction.resolve();
  const result = await turnPromise;
  assert.equal(result.ok, true, result.code);
  assert.equal(result.confirmation_required, false);
  assert.equal(result.mutation_performed, false);
  assert.equal(result.timing.coaching_delivered_before_extraction, true);
});

test('S1 delayed durable extraction remains proposal-bound and requires AFW-05 confirmation', async () => {
  const releaseExtraction = deferred();
  const transport = async (request, { stage }) => {
    if (stage === 'CONVERSATION') return {
      output: { customer_message: 'That preference can help me coach you more clearly. What makes that order useful when the pressure is high?' },
      usage: {}, latency_ms: 25,
    };
    if (stage === 'CANDIDATE_EXTRACTION') {
      await releaseExtraction.promise;
      return {
        output: {
          candidate: {
            candidate_type: 'PERSONAL_RSL_CANDIDATE', proposal_type: 'EVIDENCE_CANDIDATE', target_contract: 'EVIDENCE_LEDGER', operation: 'PROPOSE',
            summary: 'Remember the customer\'s durable communication preference.',
            items: [{ field: 'evidence.communication_preference', value: 'Lead with one conclusion, explain it simply, then ask one question.' }],
            reason: 'The customer explicitly asked MORE to remember this preference.', evidence_ref_ids: [], authority_ref_ids: [], confirmation_required: true,
            generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
          },
        },
        usage: {}, latency_ms: 60,
      };
    }
    const input = JSON.parse(request.input[1].content);
    return {
      output: { decision: 'CONFIRM', proposal_hash: input.pending_proposal.proposal_hash, effective_items: [], unambiguous: true, reason: 'Exact proposal confirmed.' },
      usage: {}, latency_ms: 15,
    };
  };
  const { controller } = await createSyntheticLivingRelationshipLab({ transport, subject_key: 're-mid', seed_weekly_fixture: false });
  let coachingReady = false;
  const turnPromise = controller.send({
    message: 'Please remember to lead with one conclusion, explain it simply, then ask me one question.',
    on_coaching_ready: () => { coachingReady = true; },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(coachingReady, true);
  assert.equal(controller.current().publication.publication_version, 1);
  assert.equal(controller.pendingProposal(), null);
  releaseExtraction.resolve();
  const proposed = await turnPromise;
  assert.equal(proposed.confirmation_required, true);
  assert.equal(proposed.mutation_performed, false);
  assert.equal(controller.current().publication.publication_version, 1);
  const confirmed = await controller.send({ message: 'I confirm that exact preference.' });
  assert.equal(confirmed.ok, true, confirmed.code);
  assert.equal(confirmed.mutation_performed, true);
  assert.equal(controller.current().publication.publication_version, 2);
});

test('S1 discards post-response extraction when its bound publication becomes stale', async () => {
  const releaseExtraction = deferred();
  const store = new InMemoryLivingRelationshipStore();
  const transport = async (_request, { stage }) => {
    if (stage === 'CONVERSATION') return {
      output: { customer_message: 'One useful idea arrived before transaction work. What would make that idea more accurate?' },
      usage: {}, latency_ms: 25,
    };
    await releaseExtraction.promise;
    return {
      output: {
        candidate: {
          candidate_type: 'PERSONAL_RSL_CANDIDATE', proposal_type: 'EVIDENCE_CANDIDATE', target_contract: 'EVIDENCE_LEDGER', operation: 'PROPOSE',
          summary: 'Remember a communication preference extracted from the delayed turn.',
          items: [{ field: 'evidence.communication_preference', value: 'Use one clear idea before the supporting detail.' }],
          reason: 'The customer explicitly stated this preference.', evidence_ref_ids: [], authority_ref_ids: [], confirmation_required: true,
          generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
        },
      },
      usage: {}, latency_ms: 60,
    };
  };
  const { controller, scope } = await createSyntheticLivingRelationshipLab({ transport, store, subject_key: 're-mid', seed_weekly_fixture: false });
  let coachingReady = false;
  const turnPromise = controller.send({
    message: 'Please remember that one clear idea helps me think.',
    on_coaching_ready: () => { coachingReady = true; },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(coachingReady, true);

  const packet = controller.wholeUnderstandingPacket();
  const prior = store.readCurrent({ scope }).publication;
  const competingCandidate = {
    candidate_type: 'PERSONAL_RSL_CANDIDATE', proposal_type: 'EVIDENCE_CANDIDATE', target_contract: 'EVIDENCE_LEDGER', operation: 'PROPOSE',
    summary: 'A separately authorized governed preference changed the publication while extraction was running.',
    items: [{ field: 'evidence.communication_preference', value: 'Use the bounded concurrent-state proof preference.' }],
    reason: 'Synthetic concurrent state-binding proof.', evidence_ref_ids: [], authority_ref_ids: [], confirmation_required: true,
    generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
  };
  const hidden = createHiddenCandidateFromExtraction({
    session_id: packet.base_state_packet.session_id,
    scope_hash: scopeFingerprint(scope),
    state_packet_hash: packet.base_state_packet.packet_hash,
    candidate: competingCandidate,
    created_at: '2026-08-19T10:00:00.000Z',
  });
  const governed = createGovernedChangeProposal({
    hidden_proposal: hidden,
    scope,
    source_state_packet: packet.base_state_packet,
    current_publication: prior,
    created_at: '2026-08-19T10:00:00.000Z',
  });
  assert.equal(governed.ok, true, governed.code);
  assert.equal((await store.saveProposal({ scope, proposal: governed.proposal, saved_at: '2026-08-19T10:00:01.000Z' })).ok, true);
  const decision = createProposalDecision({
    proposal: governed.proposal,
    decision: 'CONFIRM',
    actor: { actor_type: 'CUSTOMER', actor_ref: scope.subject_id },
    decided_at: '2026-08-19T10:00:02.000Z',
  });
  const mutation = createConfirmedPersonalRslMutation({
    proposal: governed.proposal,
    decision: decision.decision,
    evidence_catalog: [],
    event_id: 'rsl_s1_concurrent_state_change',
    recorded_at: '2026-08-19T10:00:02.000Z',
  });
  const committed = await store.commitDecision({
    scope,
    proposal: governed.proposal,
    decision: decision.decision,
    event: mutation.event,
    idempotency_key: 's1-concurrent-state-change',
    committed_at: '2026-08-19T10:00:02.000Z',
  });
  assert.equal(committed.ok, true, committed.code);
  assert.equal(committed.publication.publication_version, 2);

  releaseExtraction.resolve();
  const result = await turnPromise;
  assert.equal(result.ok, false);
  assert.equal(result.code, 'FREE_GPT_V2_POST_RESPONSE_EXTRACTION_STALE');
  assert.equal(result.mutation_performed, false);
  assert.equal(result.extraction.discarded, true);
  assert.equal(controller.pendingProposal(), null);
  assert.equal(controller.current().publication.publication_version, 2);
});

test('S1 source keeps protected runtime fixed and enables progressive NDJSON without GU', () => {
  const constants = fs.readFileSync(new URL('../src/lib/subscriptionV1/freeGptV2/constants.js', import.meta.url), 'utf8');
  const runtime = fs.readFileSync(new URL('../api/internal/subscription-v1-runtime.js', import.meta.url), 'utf8');
  const ui = fs.readFileSync(new URL('../src/subscriptionV1/SubscriptionV1InternalDevApp.jsx', import.meta.url), 'utf8');
  const ranking = fs.readFileSync(new URL('../src/lib/subscriptionV1/freeGptV2/purposeRankedContext.js', import.meta.url), 'utf8');
  assert.equal(SUBSCRIPTION_S1_DJ_COACHING_DEMONSTRATIONS.length, 3);
  assert.equal(FREE_GPT_V2_RUNTIME_POLICY.reasoning_effort, 'xhigh');
  assert.equal(FREE_GPT_V2_RUNTIME_POLICY.store, false);
  assert.equal(FREE_GPT_V2_RUNTIME_POLICY.universal_rsl_runtime_read, false);
  assert.match(constants, /Use web research only when current external truth materially improves the answer/u);
  assert.match(runtime, /application\/x-ndjson/u);
  assert.match(runtime, /COACHING_READY/u);
  assert.match(ui, /Checking whether anything you said is worth keeping/u);
  assert.doesNotMatch(ranking, /DJ_WEIGHT/u);
  assert.doesNotMatch(`${constants}\n${runtime}\n${ui}\n${ranking}`, /Creation Language|GU compiler|visual primitive/iu);
});
