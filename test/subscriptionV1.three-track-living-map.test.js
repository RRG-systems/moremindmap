import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { InMemoryLivingRelationshipStore } from '../src/lib/subscriptionV1/afw05/store.js';
import { createSyntheticLivingRelationshipLab } from '../src/lab/subscriptionLivingBusinessRelationshipV1/createSyntheticLivingRelationshipLab.js';

const conversation = (customer_message) => ({ customer_message });

const durableCandidate = ({ candidate_type = 'EVIDENCE_CANDIDATE', proposal_type = 'EVIDENCE_CANDIDATE', field, value, items = null, summary, target_contract = 'EVIDENCE_LEDGER' }) => ({
  candidate: {
    candidate_type,
    proposal_type,
    target_contract,
    operation: 'PROPOSE',
    summary,
    items: items || [{ field, value }],
    reason: 'The customer stated durable relationship meaning that requires exact confirmation.',
    evidence_ref_ids: [],
    authority_ref_ids: [],
    confirmation_required: true,
    generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
  },
});

test('Track 1 recovers a pending proposal, honors the active Evidence lens, and publishes a dated outcome history entry', async () => {
  const store = new InMemoryLivingRelationshipStore();
  const relationshipKey = 'rel_track1_outcome_demo';
  let tick = 0;
  const clock = () => new Date(Date.parse('2026-08-19T09:01:00.000Z') + tick++ * 1000).toISOString();
  const seed = await createSyntheticLivingRelationshipLab({
    subject_key: 're-mid', relationship_key: relationshipKey, store, seed_weekly_fixture: false, clock,
    conversation_outputs: [conversation('I can hold that as a proposal until you confirm it.'), conversation('I can record the exact execution only after confirmation.')],
    candidate_outputs: [
      durableCandidate({
        candidate_type: 'COMMITMENT_CANDIDATE', proposal_type: 'COMMITMENT_CANDIDATE', target_contract: 'PLAN_135',
        field: 'commitment.intervention', value: 'Protect both follow-up blocks.', summary: 'Protect both follow-up blocks.',
      }),
      { candidate: null },
    ],
  });
  const interventionTurn = await seed.controller.send({ message: 'I will protect both follow-up blocks.' });
  const intervention = await seed.controller.decide({ proposal_id: interventionTurn.proposal.proposal_id, decision: 'CONFIRM', idempotency_key: 'track1-intervention-confirm' });
  assert.equal(intervention.ok, true, intervention.code);
  const lineageId = intervention.event.semantic_payload.lineage.intervention_lineage_id;
  const attemptCandidate = durableCandidate({
    candidate_type: 'EVIDENCE_CANDIDATE',
    summary: 'Record that Jordan completed both protected follow-up blocks.',
    items: [
      { field: 'evidence.attempt', value: 'Jordan completed both protected follow-up blocks.' },
      { field: 'evidence.execution_degree', value: 'COMPLETE' },
      { field: 'evidence.intervention_lineage_id', value: lineageId },
    ],
  });
  const attemptLab = await createSyntheticLivingRelationshipLab({
    subject_key: 're-mid', relationship_key: relationshipKey, store, seed_weekly_fixture: false, clock,
    conversation_outputs: [conversation('I can record the exact execution only after confirmation.')],
    candidate_outputs: [attemptCandidate],
  });
  const attemptTurn = await attemptLab.controller.send({ message: 'I completed both protected follow-up blocks.' });
  assert.equal(attemptTurn.ok, true, JSON.stringify(attemptTurn));
  assert.ok(attemptTurn.proposal, JSON.stringify(attemptTurn.extraction));
  const attempt = await attemptLab.controller.decide({ proposal_id: attemptTurn.proposal.proposal_id, decision: 'CONFIRM', idempotency_key: 'track1-attempt-confirm' });
  assert.equal(attempt.ok, true, attempt.code);
  const options = {
    subject_key: 're-mid', relationship_key: relationshipKey, store, seed_weekly_fixture: false, clock,
    conversation_outputs: [conversation('That result sounds durable. Keep talking naturally and confirm it only if the exact meaning is right.')],
    candidate_outputs: [durableCandidate({
      candidate_type: 'OUTCOME_CANDIDATE',
      items: [
        { field: 'evidence.outcome', value: 'Jordan protected both follow-up blocks and booked three qualified conversations.' },
        { field: 'evidence.outcome_classification', value: 'BENEFICIAL' },
        { field: 'evidence.intervention_lineage_id', value: lineageId },
        { field: 'evidence.requested_attribution', value: 'ASSOCIATED_ONLY' },
      ],
      summary: 'Record the result of Jordan’s protected follow-up experiment.',
    })],
  };
  const first = await createSyntheticLivingRelationshipLab(options);
  const turn = await first.controller.send({
    message: 'I protected both blocks and booked three qualified conversations.',
    active_lens: 'EVIDENCE', purpose: 'EVIDENCE_REVIEW', topics: ['qualified conversations'],
    visible_customer_context: { surface: 'evidence', visible_objects: ['Known', 'Outcomes'] },
  });
  assert.equal(turn.ok, true, turn.code);
  assert.equal(turn.confirmation_required, true);
  assert.equal(first.controller.wholeUnderstandingPacket().base_state_packet.active_lens, 'EVIDENCE');
  assert.equal(first.controller.wholeUnderstandingPacket().base_state_packet.purpose, 'EVIDENCE_REVIEW');
  assert.equal(first.controller.pendingProposal().proposal_id, turn.proposal.proposal_id);

  const recoveredStore = new InMemoryLivingRelationshipStore(store.snapshot());
  const recovered = await createSyntheticLivingRelationshipLab({ ...options, store: recoveredStore });
  assert.equal(recovered.controller.pendingProposal().proposal_id, turn.proposal.proposal_id);
  const accepted = await recovered.controller.decide({ proposal_id: turn.proposal.proposal_id, decision: 'CONFIRM', idempotency_key: 'track1-outcome-confirm' });
  assert.equal(accepted.ok, true, accepted.code);
  assert.equal(recovered.controller.pendingProposal(), null);
  const records = recoveredStore.readPersonalRsl({ scope: recovered.scope }).records;
  assert.equal(records.some((record) => record.event.event_type === 'INTERVENTION'), true);
  assert.equal(records.some((record) => record.event.event_type === 'ATTEMPT'), true);
  assert.equal(records.some((record) => record.event.event_type === 'OUTCOME'), true);
  const history = recovered.controller.current().view_model.destinations.evidence.relationshipHistory;
  const outcomeHistory = history.items.find((item) => item.kind === 'Outcome');
  assert.ok(outcomeHistory);
  assert.equal(outcomeHistory.details[0], 'Jordan protected both follow-up blocks and booked three qualified conversations.');
  assert.match(history.sourceBoundary, /customer-confirmed Personal RSL/u);
  assert.match(history.coachingBoundary, /Coach Connect history.*not connected/u);
});

test('Track 1 maps learned meaning, action items, decisions, and operating changes into the existing Personal RSL vocabulary and history labels', async () => {
  const scenarios = [
    ['learned meaning', 'EVIDENCE_CANDIDATE', 'evidence.communication_preference', 'EVIDENCE_ASSERTED', 'Learned'],
    ['action item', 'COMMITMENT_CANDIDATE', 'commitment.action', 'COMMITMENT', 'Agreed'],
    ['decision', 'EVIDENCE_CANDIDATE', 'evidence.decision', 'DECISION', 'Agreed'],
    ['operating change', 'EVIDENCE_CANDIDATE', 'evidence.operating_change', 'STATE_CHANGE', 'Changed'],
  ];
  for (const [label, candidateType, field, eventType, historyKind] of scenarios) {
    const store = new InMemoryLivingRelationshipStore();
    const lab = await createSyntheticLivingRelationshipLab({
      subject_key: 're-mid', relationship_key: `rel_track1_${label.replace(' ', '_')}`, store, seed_weekly_fixture: false,
      conversation_outputs: [conversation(`I noticed the durable ${label}.`) ],
      candidate_outputs: [durableCandidate({ candidate_type: candidateType, proposal_type: candidateType, field, value: `Synthetic durable ${label}.`, summary: `Record the synthetic ${label}.` })],
    });
    const turn = await lab.controller.send({ message: `This is the ${label} I want to keep.` });
    const accepted = await lab.controller.decide({ proposal_id: turn.proposal.proposal_id, decision: 'CONFIRM', idempotency_key: `track1-${eventType}` });
    assert.equal(accepted.ok, true, accepted.code);
    assert.equal(store.readPersonalRsl({ scope: lab.scope }).records[0].event.event_type, eventType);
    assert.equal(lab.controller.current().view_model.destinations.evidence.relationshipHistory.items[0].kind, historyKind);
  }
});

test('Track 1 corrections bind and supersede the exact prior durable field instead of creating a second truth', async () => {
  const store = new InMemoryLivingRelationshipStore();
  const firstCandidate = durableCandidate({ field: 'evidence.follow_up_cadence', value: 'Two protected blocks each week.', summary: 'Remember the protected follow-up cadence.' });
  const correctionCandidate = durableCandidate({ candidate_type: 'CORRECTION_CANDIDATE', proposal_type: 'CORRECTION_CANDIDATE', field: 'evidence.follow_up_cadence', value: 'Three protected blocks each week.', summary: 'Correct the protected follow-up cadence.' });
  const lab = await createSyntheticLivingRelationshipLab({
    subject_key: 're-mid', relationship_key: 'rel_track1_correction', store, seed_weekly_fixture: false,
    conversation_outputs: [conversation('I can carry that forward after exact confirmation.'), conversation('I can correct the same durable field after exact confirmation.')],
    candidate_outputs: [firstCandidate, correctionCandidate],
  });
  const first = await lab.controller.send({ message: 'Remember two protected blocks each week.' });
  await lab.controller.decide({ proposal_id: first.proposal.proposal_id, decision: 'CONFIRM', idempotency_key: 'track1-first-cadence' });
  const correction = await lab.controller.send({ message: 'Correction: it is three protected blocks each week.' });
  const accepted = await lab.controller.decide({ proposal_id: correction.proposal.proposal_id, decision: 'CONFIRM', idempotency_key: 'track1-corrected-cadence' });
  assert.equal(accepted.ok, true, accepted.code);
  const records = store.readPersonalRsl({ scope: lab.scope }).records;
  assert.equal(records.length, 2);
  assert.equal(records[1].event.event_type, 'CORRECTION');
  assert.deepEqual(records[1].event.supersedes_event_ids, [records[0].event.event_id]);
  const history = lab.controller.current().view_model.destinations.evidence.relationshipHistory.items;
  assert.equal(history.length, 1);
  assert.equal(history[0].kind, 'Changed');
  assert.equal(history[0].details[0], 'Three protected blocks each week.');
});

test('Track 1 relationship history projects structured plan values into safe dated display text', async () => {
  const store = new InMemoryLivingRelationshipStore();
  const lab = await createSyntheticLivingRelationshipLab({
    subject_key: 're-mid', relationship_key: 'rel_track1_structured_plan', store, seed_weekly_fixture: false,
    conversation_outputs: [conversation('I can keep that plan after exact confirmation.')],
    candidate_outputs: [durableCandidate({
      candidate_type: 'PLAN_CHANGE_CANDIDATE', proposal_type: 'PLAN_CHANGE_CANDIDATE',
      field: 'plan_135.way_1',
      value: JSON.stringify({
        title: 'Protect follow-up time',
        strategies: ['Block two mornings', 'Review the result Friday', 'Track replies', 'Name the constraint', 'Keep what works'],
      }),
      summary: 'Keep the protected follow-up plan.',
    })],
  });
  const turn = await lab.controller.send({ message: 'Use this as my first way.' });
  const accepted = await lab.controller.decide({ proposal_id: turn.proposal.proposal_id, decision: 'CONFIRM', idempotency_key: 'track1-structured-plan' });
  assert.equal(accepted.ok, true, accepted.code);
  const history = lab.controller.current().view_model.destinations.evidence.relationshipHistory.items;
  assert.equal(history.length, 1);
  assert.equal(history[0].details[0], 'Protect follow-up time · Block two mornings · Review the result Friday · Track replies · Name the constraint · Keep what works');
});

test('Track 1 keeps natural confirmation primary, exposes only a subtle recovery control, and imports no Coach Connect runtime', () => {
  const ui = fs.readFileSync(new URL('../src/subscriptionV1/SubscriptionV1InternalDevApp.jsx', import.meta.url), 'utf8');
  const evidenceUi = fs.readFileSync(new URL('../src/lab/subscriptionLivingBusinessRelationshipV1/LivingBusinessTwinApp.jsx', import.meta.url), 'utf8');
  const runtime = fs.readFileSync(new URL('../api/internal/subscription-v1-runtime.js', import.meta.url), 'utf8');
  const extractor = fs.readFileSync(new URL('../src/lib/subscriptionV1/freeGptV2/providerSeams.js', import.meta.url), 'utf8');
  assert.match(ui, /bootstrap\.pending_proposal \|\| null/u);
  assert.match(ui, /Keep talking naturally/u);
  assert.match(ui, /<details className="living-decision-fallback">/u);
  assert.match(evidenceUi, /What has carried forward/u);
  assert.match(runtime, /publicPendingProposal/u);
  assert.match(extractor, /durable customer decision maps to EVIDENCE_CANDIDATE/u);
  assert.match(extractor, /commitment or action item maps to COMMITMENT_CANDIDATE/u);
  assert.match(extractor, /concrete attempt or experiment/u);
  assert.match(extractor, /reported result maps to OUTCOME_CANDIDATE/u);
  assert.doesNotMatch(`${ui}\n${runtime}`, /coachConnect|CoachConnect/u);
});
