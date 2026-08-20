import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';
import {
  InMemoryLivingRelationshipStore,
  createLivingBusinessRelationshipRuntime,
  createConfirmedPersonalRslMutation,
  createGovernedChangeProposal,
  createInitialLivingBusinessTwinPublication,
  createProposalDecision,
} from '../src/lib/subscriptionV1/index.js';
import { createAfw04ProviderRuntime, createCoachingMutationCandidate, retrieveCoachingDoctrine } from '../src/lib/subscriptionV1/afw04/index.js';
import { LocalJsonlLivingRelationshipStore } from '../src/lib/subscriptionV1/afw05/localJournalStore.js';
import { testArtifacts, testBusinessTruth, testScope, testWholePersonContext } from './subscriptionV1.testFixtures.js';

const scope = testScope();
const baseTime = '2026-08-19T08:00:00.000Z';
const packetHash = hashCanonicalJson({ packet: 'afw05-test' });

function artifactLineage() {
  return testArtifacts(scope).map(({ artifact_type, content_hash }) => ({ artifact_type, content_hash }));
}

function initialState() {
  return {
    WHERE_YOU_ARE: { accepted_changes: {} },
    FIVE_FUTURES: { customer_challenges: [] },
    ONE_MOVE: { customer_challenges: [] },
    plan_135: {
      goal: 'Build a business that produces 24 closings a year with increasing leverage.',
      ways: [
        { title: 'Build the relationship engine', strategies: ['Add qualified relationships', 'Create opportunity daily', 'Track the business weekly', 'Build the required pipeline', 'Systematize nurture'] },
        { title: null, strategies: [] },
        { title: null, strategies: [] },
      ],
    },
    EVIDENCE: { accepted_changes: {}, corrections: [] },
  };
}

function initialPublication() {
  const result = createInitialLivingBusinessTwinPublication({ scope, artifact_lineage: artifactLineage(), initial_state: initialState(), published_at: baseTime });
  assert.equal(result.ok, true, result.code);
  return result.publication;
}

function hidden({ type = 'PLAN_CHANGE_CANDIDATE', target = 'PLAN_135', items, suffix = 'alpha' }) {
  return createCoachingMutationCandidate({
    session_id: 'session_fixture_alpha',
    scope_hash: hashCanonicalJson(scope),
    state_packet_hash: packetHash,
    output: {
      proposal: {
        proposal_type: type,
        target_contract: target,
        operation: 'PROPOSE',
        summary: `Governed change ${suffix}`,
        items,
        reason: 'The customer asked to change governed reality.',
        evidence_ref_ids: [],
        authority_ref_ids: ['canonical_artifact:PLAN_135:test'],
        confirmation_required: true,
        generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
      },
    },
    created_at: baseTime,
  });
}

function planItems() {
  return [
    { field: 'plan_135.way_2', value: JSON.stringify({ title: 'Build team-owned delivery', strategies: ['Define outcome ownership', 'Set decision boundaries', 'Publish a weekly scorecard', 'Coach exceptions', 'Inspect capacity released'] }) },
    { field: 'plan_135.way_3', value: JSON.stringify({ title: 'Build a measured acquisition lane', strategies: ['Choose one channel', 'Define qualified demand', 'Set a test budget', 'Measure conversion', 'Keep or stop from evidence'] }) },
  ];
}

function governed(current, options = {}) {
  const result = createGovernedChangeProposal({
    hidden_proposal: hidden({ items: options.items || planItems(), type: options.type, target: options.target, suffix: options.suffix }),
    scope,
    source_state_packet: { packet_hash: packetHash },
    current_publication: current,
    created_at: options.created_at || '2026-08-19T08:01:00.000Z',
    supersedes_event_ids: options.supersedes_event_ids || [],
    retracts_event_ids: options.retracts_event_ids || [],
  });
  assert.equal(result.ok, true, result.code);
  return result.proposal;
}

async function prepareStore(Store = InMemoryLivingRelationshipStore, options = null) {
  const store = options ? new Store(options) : new Store();
  const publication = initialPublication();
  const initialized = await store.initialize({ scope, publication });
  assert.equal(initialized.ok, true, initialized.code);
  return { store, publication };
}

async function stageAndDecide(store, proposal, decisionName, at, options = {}) {
  const staged = await store.saveProposal({ scope, proposal, saved_at: at });
  assert.equal(staged.ok, true, staged.code);
  const decisionResult = createProposalDecision({
    proposal,
    decision: decisionName,
    actor: { actor_type: 'CUSTOMER', actor_ref: scope.subject_id },
    edited_items: options.edited_items || [],
    decided_at: at,
  });
  assert.equal(decisionResult.ok, true, decisionResult.code);
  let event = null;
  if (decisionResult.decision.mutation_authorized) {
    const mutation = createConfirmedPersonalRslMutation({
      proposal,
      decision: decisionResult.decision,
      event_id: `rsl_${proposal.proposal_id.slice(-20)}_${decisionName.toLowerCase()}`,
      evidence_catalog: [],
      recorded_at: at,
    });
    assert.equal(mutation.ok, true, mutation.code);
    event = mutation.event;
  }
  return store.commitDecision({ scope, proposal, decision: decisionResult.decision, event, idempotency_key: options.idempotency_key || `idem-${proposal.proposal_id}-${decisionName}`, committed_at: at });
}

test('AFW-05 hidden frontier proposal cannot mutate before an exact customer decision', async () => {
  const { store, publication } = await prepareStore();
  const proposal = governed(publication);
  assert.equal(proposal.mutation_performed, false);
  assert.equal((await store.saveProposal({ scope, proposal, saved_at: '2026-08-19T08:01:00.000Z' })).ok, true);
  const current = store.readCurrent({ scope }).publication;
  assert.equal(current.publication_hash, publication.publication_hash);
  assert.equal(store.inspect({ scope }).personal_rsl_event_count, 0);
});

test('AFW-05 reject and defer persist a decision with zero canonical mutation or publication advance', async () => {
  for (const decision of ['REJECT', 'DEFER']) {
    const { store, publication } = await prepareStore();
    const proposal = governed(publication, { suffix: decision.toLowerCase() });
    const result = await stageAndDecide(store, proposal, decision, '2026-08-19T08:02:00.000Z');
    assert.equal(result.ok, true, result.code);
    assert.equal(result.mutation_performed, false);
    assert.equal(result.publication.publication_hash, publication.publication_hash);
    assert.equal(store.inspect({ scope }).personal_rsl_event_count, 0);
    assert.equal(store.inspect({ scope }).publication_count, 1);
  }
});

test('AFW-05 confirmation commits decision, Personal RSL event, deterministic recomputation and complete publication atomically', async () => {
  const { store, publication } = await prepareStore();
  const proposal = governed(publication);
  const result = await stageAndDecide(store, proposal, 'CONFIRM', '2026-08-19T08:02:00.000Z');
  assert.equal(result.ok, true, result.code);
  assert.equal(result.code, 'AFW05_CONFIRMED_MUTATION_ATOMICALLY_PUBLISHED');
  assert.equal(result.mutation_performed, true);
  assert.equal(result.publication.publication_version, 2);
  assert.equal(result.publication.previous_publication_hash, publication.publication_hash);
  assert.equal(result.publication.completeness.all_boxes_present, true);
  assert.equal(result.publication.completeness.box_count, 5);
  assert.equal(result.publication.completeness.plan_135_complete, true);
  assert.equal(result.publication.completeness.partial_publication, false);
  assert.deepEqual(result.publication.five_boxes.PLAN_135.ways.map((way) => way.title), ['Build the relationship engine', 'Build team-owned delivery', 'Build a measured acquisition lane']);
  assert.equal(store.inspect({ scope }).personal_rsl_event_count, 1);
  assert.equal(store.inspect({ scope }).publication_count, 2);
});

test('AFW-05 customer edit binds the exact edited payload, not the frontier draft', async () => {
  const { store, publication } = await prepareStore();
  const proposal = governed(publication);
  const edited = planItems();
  edited[0] = { ...edited[0], value: JSON.stringify({ title: 'My edited team path', strategies: ['Clarify the seat', 'Transfer one outcome', 'Write decision rights', 'Review the scorecard', 'Keep what works'] }) };
  const result = await stageAndDecide(store, proposal, 'EDIT', '2026-08-19T08:02:00.000Z', { edited_items: edited });
  assert.equal(result.ok, true, result.code);
  assert.equal(result.publication.five_boxes.PLAN_135.ways[1].title, 'My edited team path');
  assert.notEqual(result.publication.five_boxes.PLAN_135.ways[1].title, JSON.parse(planItems()[0].value).title);
});

test('AFW-05 stale parallel proposal fails closed after the first atomic publication', async () => {
  const { store, publication } = await prepareStore();
  const first = governed(publication, { suffix: 'first' });
  const second = governed(publication, { suffix: 'second', items: [{ field: 'where_you_are.weekly_revenue', value: '$42,000 customer reported' }], type: 'EVIDENCE_CANDIDATE', target: 'EVIDENCE_LEDGER' });
  assert.equal((await stageAndDecide(store, first, 'CONFIRM', '2026-08-19T08:02:00.000Z')).ok, true);
  const stale = await stageAndDecide(store, second, 'CONFIRM', '2026-08-19T08:03:00.000Z');
  assert.equal(stale.ok, false);
  assert.equal(stale.code, 'AFW05_STALE_PROPOSAL_REEVALUATION_REQUIRED');
  assert.equal(store.inspect({ scope }).personal_rsl_event_count, 1);
});

test('AFW-05 idempotent replay never appends or publishes twice', async () => {
  const { store, publication } = await prepareStore();
  const proposal = governed(publication);
  await store.saveProposal({ scope, proposal, saved_at: '2026-08-19T08:01:00.000Z' });
  const decision = createProposalDecision({ proposal, decision: 'CONFIRM', actor: { actor_type: 'CUSTOMER', actor_ref: scope.subject_id }, decided_at: '2026-08-19T08:02:00.000Z' }).decision;
  const event = createConfirmedPersonalRslMutation({ proposal, decision, event_id: 'rsl_idempotent_replay_alpha', evidence_catalog: [], recorded_at: '2026-08-19T08:02:00.000Z' }).event;
  const input = { scope, proposal, decision, event, idempotency_key: 'same-idempotency', committed_at: '2026-08-19T08:02:00.000Z' };
  const first = await store.commitDecision(input);
  const replay = await store.commitDecision(input);
  assert.equal(first.ok, true);
  assert.equal(replay.code, 'IDEMPOTENT_REPLAY');
  assert.equal(store.inspect({ scope }).personal_rsl_event_count, 1);
  assert.equal(store.inspect({ scope }).publication_count, 2);
});

test('AFW-05 exact-scope isolation rejects cross-profile decision use', async () => {
  const { store, publication } = await prepareStore();
  const proposal = governed(publication);
  await store.saveProposal({ scope, proposal, saved_at: '2026-08-19T08:01:00.000Z' });
  const decision = createProposalDecision({ proposal, decision: 'REJECT', actor: { actor_type: 'CUSTOMER', actor_ref: scope.subject_id }, decided_at: '2026-08-19T08:02:00.000Z' }).decision;
  const other = { ...scope, profile_id: 'MM-TEST-PROFILE-BETA', business_id: 'business_test_beta' };
  const result = await store.commitDecision({ scope: other, proposal, decision, idempotency_key: 'cross-scope', committed_at: '2026-08-19T08:02:00.000Z' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'AFW05_DECISION_STORE_DENIED');
  assert.equal(store.inspect({ scope }).decision_count, 0);
});

test('AFW-05 correction and retraction replay remove superseded state deterministically', async () => {
  const { store, publication } = await prepareStore();
  const asserted = governed(publication, { suffix: 'asserted', items: [{ field: 'where_you_are.weekly_revenue', value: '$42,000' }], type: 'EVIDENCE_CANDIDATE', target: 'EVIDENCE_LEDGER' });
  const first = await stageAndDecide(store, asserted, 'CONFIRM', '2026-08-19T08:02:00.000Z');
  const firstEventId = first.event.event_id;
  const correctedProposal = governed(first.publication, { suffix: 'corrected', items: [{ field: 'where_you_are.weekly_revenue', value: '$38,000' }], type: 'CORRECTION_CANDIDATE', target: 'EVIDENCE_LEDGER', supersedes_event_ids: [firstEventId], created_at: '2026-08-19T08:03:00.000Z' });
  const corrected = await stageAndDecide(store, correctedProposal, 'CONFIRM', '2026-08-19T08:04:00.000Z');
  assert.equal(corrected.publication.five_boxes.WHERE_YOU_ARE.accepted_changes.weekly_revenue, '$38,000');
  const retractProposal = governed(corrected.publication, { suffix: 'retract', items: [{ field: 'evidence.retraction_reason', value: 'Customer withdrew the reported number.' }], type: 'CORRECTION_CANDIDATE', target: 'EVIDENCE_LEDGER', retracts_event_ids: [corrected.event.event_id], created_at: '2026-08-19T08:05:00.000Z' });
  const retracted = await stageAndDecide(store, retractProposal, 'CONFIRM', '2026-08-19T08:06:00.000Z');
  assert.equal(retracted.publication.five_boxes.WHERE_YOU_ARE.accepted_changes.weekly_revenue, undefined);
  assert.equal(retracted.publication.five_boxes.EVIDENCE.accepted_changes.retraction_reason, undefined);
});

test('AFW-05 all five boxes are live through governed event paths', async () => {
  const { store, publication } = await prepareStore();
  const cases = [
    ['where_you_are.capacity_note', 'Owner has recovered one day weekly', 'EVIDENCE_CANDIDATE', 'EVIDENCE_LEDGER'],
    ['five_futures.challenge', 'Downside feels overstated after the new contract', 'EVIDENCE_CANDIDATE', 'LIVING_BUSINESS_STATE'],
    ['one_move.challenge', 'The proposed workflow has already been transferred', 'EVIDENCE_CANDIDATE', 'LIVING_BUSINESS_STATE'],
    ['plan_135.goal', 'Reach 30 closings while protecting two focus days', 'PLAN_CHANGE_CANDIDATE', 'PLAN_135'],
    ['evidence.market_signal', 'Three qualified referrals arrived this week', 'EVIDENCE_CANDIDATE', 'EVIDENCE_LEDGER'],
  ];
  let current = publication;
  for (let index = 0; index < cases.length; index += 1) {
    const [field, value, type, target] = cases[index];
    const proposal = governed(current, { suffix: `box-${index}`, items: [{ field, value }], type, target, created_at: `2026-08-19T08:${10 + index * 2}:00.000Z` });
    const result = await stageAndDecide(store, proposal, 'CONFIRM', `2026-08-19T08:${11 + index * 2}:00.000Z`);
    assert.equal(result.ok, true, result.code);
    current = result.publication;
  }
  assert.deepEqual(current.changed_governed_objects, ['EVIDENCE']);
  assert.equal(current.five_boxes.WHERE_YOU_ARE.accepted_changes.capacity_note.includes('recovered'), true);
  assert.equal(current.five_boxes.FIVE_FUTURES.customer_challenges.length, 1);
  assert.equal(current.five_boxes.ONE_MOVE.customer_challenges.length, 1);
  assert.equal(current.five_boxes.PLAN_135.goal.startsWith('Reach 30'), true);
  assert.equal(current.five_boxes.EVIDENCE.accepted_changes.market_signal.includes('referrals'), true);
});

test('AFW-05 confirmed homework and intervention remain typed customer-specific RSL events', async () => {
  const { store, publication } = await prepareStore();
  const homework = governed(publication, { suffix: 'homework', items: [{ field: 'commitment.homework', value: 'Bring the weekly pipeline scorecard next Friday.' }], type: 'COMMITMENT_CANDIDATE', target: 'LIVING_BUSINESS_STATE' });
  const first = await stageAndDecide(store, homework, 'CONFIRM', '2026-08-19T08:30:00.000Z');
  assert.equal(first.event.event_type, 'COMMITMENT');
  const intervention = governed(first.publication, { suffix: 'intervention', items: [{ field: 'commitment.intervention', value: 'Run a two-week owner-free handoff trial.' }], type: 'COMMITMENT_CANDIDATE', target: 'LIVING_BUSINESS_STATE', created_at: '2026-08-19T08:31:00.000Z' });
  const second = await stageAndDecide(store, intervention, 'CONFIRM', '2026-08-19T08:32:00.000Z');
  assert.equal(second.event.event_type, 'INTERVENTION');
  assert.equal(second.publication.engagement.commitments.length, 2);
  assert.equal(second.publication.engagement.interventions.length, 1);
  assert.equal(second.event.semantic_payload.raw_transcript_persisted, false);
});

test('AFW-05 local journal survives restart with mode 0600 and an intact atomic snapshot', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'afw05-durable-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const options = { data_root: root };
  const { store, publication } = await prepareStore(LocalJsonlLivingRelationshipStore, options);
  const proposal = governed(publication);
  const result = await stageAndDecide(store, proposal, 'CONFIRM', '2026-08-19T08:02:00.000Z');
  assert.equal(result.ok, true, result.code);
  assert.equal(store.inspectLocalDurability().mode_0600, true);
  const restarted = new LocalJsonlLivingRelationshipStore(options);
  assert.equal(restarted.readCurrent({ scope }).publication.publication_hash, result.publication.publication_hash);
  assert.equal(restarted.inspect({ scope }).personal_rsl_event_count, 1);
  assert.equal(restarted.inspect({ scope }).publication_count, 2);
});

test('AFW-05 full 1-3-5 loop continues frontier coaching from the newly published state', async () => {
  const { store } = await prepareStore();
  const requests = [];
  const outputs = [
    {
      customer_message: 'You already have the goal and first path. I can add two distinct paths so the full 1–3–5 is visible without changing the goal. Would you like me to make that exact update?',
      proposal: {
        proposal_type: 'PLAN_CHANGE_CANDIDATE', target_contract: 'PLAN_135', operation: 'PROPOSE', summary: 'Complete Ways 2 and 3 of the 1–3–5.', items: planItems(), reason: 'The customer asked to finish the 1–3–5.', evidence_ref_ids: [], authority_ref_ids: [], confirmation_required: true, generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
      },
      research_need: null,
    },
    {
      customer_message: 'The full map is now in view. Which of the three paths feels most useful to pressure-test first?',
      proposal: {
        proposal_type: 'NO_MUTATION', target_contract: null, operation: 'NONE', summary: 'Continue from the updated plan.', items: [], reason: 'No new governed fact was asserted.', evidence_ref_ids: [], authority_ref_ids: [], confirmation_required: false, generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
      },
      research_need: null,
    },
  ];
  let outputIndex = 0;
  const provider = createAfw04ProviderRuntime({
    enabled: true,
    now: () => '2026-08-19T08:20:00.000Z',
    transport: async (request) => {
      requests.push(request);
      return { output: outputs[outputIndex++], usage: { input_tokens: 1000, output_tokens: 200 }, latency_ms: 100, first_token_latency_ms: 40 };
    },
  });
  const times = ['2026-08-19T08:20:00.000Z', '2026-08-19T08:21:00.000Z', '2026-08-19T08:22:00.000Z', '2026-08-19T08:23:00.000Z', '2026-08-19T08:24:00.000Z'];
  let timeIndex = 0;
  const runtime = createLivingBusinessRelationshipRuntime({
    scope,
    session_id: 'session_fixture_alpha',
    store,
    frontier_runtime: provider,
    doctrine_retrieval: retrieveCoachingDoctrine({ purpose: 'FINISH_PLAN_135', vertical_id: 'REAL_ESTATE' }),
    canonical_artifacts: testArtifacts(scope),
    business_truth: testBusinessTruth(),
    whole_person_execution_context: testWholePersonContext(),
    vertical_context: { vertical_id: 'REAL_ESTATE', context: 'Synthetic test only' },
    initial_purpose: 'FINISH_PLAN_135',
    initial_lens: 'PLAN',
    clock: () => times[Math.min(timeIndex++, times.length - 1)],
  });
  assert.equal(runtime.assemble({ purpose: 'FINISH_PLAN_135', active_lens: 'PLAN', as_of_at: times[0] }).ok, true);
  const first = await runtime.coach({ customer_turn: 'Help me finish my 135.', purpose: 'FINISH_PLAN_135', active_lens: 'PLAN' });
  assert.equal(first.ok, true, first.code);
  assert.equal(first.confirmation_required, true);
  assert.equal(store.inspect({ scope }).personal_rsl_event_count, 0);
  const accepted = await runtime.decide({ proposal_id: first.proposal.proposal_id, decision: 'CONFIRM', evidence_catalog: [], idempotency_key: 'full-135-confirm' });
  assert.equal(accepted.ok, true, accepted.code);
  assert.equal(accepted.publication.completeness.plan_135_complete, true);
  assert.equal(accepted.next_state_packet.current_state.living_publication_version, 2);
  const continued = await runtime.coach({ customer_turn: 'Show me what changed.', purpose: 'FINISH_PLAN_135', active_lens: 'PLAN' });
  assert.equal(continued.ok, true, continued.code);
  assert.equal(continued.confirmation_required, false);
  assert.equal(requests.length, 2);
  assert.equal(JSON.stringify(requests[1]).includes('living_publication_version'), true);
  assert.equal(JSON.stringify(requests[1]).includes('Build team-owned delivery'), true);
  assert.equal(runtime.transcriptBoundary().durable, false);
  assert.equal(store.inspect({ scope }).raw_transcript_persisted, false);
});
