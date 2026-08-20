import assert from 'node:assert/strict';
import test from 'node:test';
import { createSyntheticLivingRelationshipLab } from '../src/lab/subscriptionLivingBusinessRelationshipV1/createSyntheticLivingRelationshipLab.js';

const noMutation = (customer_message, summary = 'Continue the coaching conversation from current governed reality.') => ({
  customer_message,
  proposal: {
    proposal_type: 'NO_MUTATION', target_contract: null, operation: 'NONE', summary, items: [],
    reason: 'No new durable customer fact or commitment requires confirmation.', evidence_ref_ids: [], authority_ref_ids: [], confirmation_required: false,
    generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
  },
  research_need: null,
});

const evidenceCandidate = ({ message, summary, field, value }) => ({
  customer_message: message,
  proposal: {
    proposal_type: 'EVIDENCE_CANDIDATE', target_contract: 'EVIDENCE_LEDGER', operation: 'PROPOSE', summary,
    items: [{ field, value }], reason: 'The customer supplied or challenged a material business fact.', evidence_ref_ids: [], authority_ref_ids: [], confirmation_required: true,
    generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
  },
  research_need: null,
});

test('AFW-06 natural-language probes remain whole-state coaching, not literal conversation routing', async () => {
  const scenarios = [
    ['Business has sucked this week.', 'That sounds like a rough week. Before we decide the business is off course, what actually happened—fewer opportunities, work not getting finished, or you carrying more than usual? We can separate a bad week from a changed business pattern.'],
    ['Why is this still my One Move?', 'Because the constraint has not moved yet: important operating decisions still come back to you. The transfer trial is still the smallest honest test of whether ownership can stay with someone else without quality breaking down.'],
    ['Why do you think this is my constraint?', 'The strongest pattern is not a lack of demand. It is that decisions, exceptions, and accountability keep returning to you, which limits how much of the existing opportunity the business can carry without adding more of your time.'],
    ['What changed?', 'Nothing durable has changed since the current map was published. I am still working from the same accepted business reality, and I will ask before adding anything new to it.'],
    ['Am I on track?', 'We do not have enough current execution evidence to answer that honestly yet. The next useful proof is whether the transferred lane completes on time, holds quality, and releases real capacity without you rescuing it.'],
    ["Let's work on Box 3.", 'We can work on the One Move. The useful question is not which tasks to hand off; it is which recurring operating lane is important enough to matter and bounded enough to test without putting customers or quality at risk.'],
  ];
  for (const [prompt, response] of scenarios) {
    const { controller } = await createSyntheticLivingRelationshipLab({ accepted_outputs: [noMutation(response)] });
    const turn = await controller.send({ message: prompt });
    assert.equal(turn.ok, true, turn.code);
    assert.equal(turn.confirmation_required, false);
    assert.equal(turn.mutation_performed, false);
    assert.equal(controller.current().publication.publication_version, 1);
    assert.equal(turn.customer_message, response);
    assert.doesNotMatch(turn.customer_message, /\b(?:WBM|RSL|state packet|artifact hash|ME-Q\d+)\b/iu);
  }
});

test('AFW-06 future challenge can be deferred with zero mutation', async () => {
  const output = evidenceCandidate({
    message: 'That is worth challenging. I can record that the downside path now feels overstated because the new contract changed the immediate risk picture, while keeping the modeled trajectory visible until evidence supports a recomputation. Should I add that correction?',
    summary: 'Record the customer challenge to the downside trajectory.',
    field: 'five_futures.challenge',
    value: 'The downside path feels overstated after the newly signed contract changed the immediate risk picture.',
  });
  output.proposal.target_contract = 'LIVING_BUSINESS_STATE';
  const { controller } = await createSyntheticLivingRelationshipLab({ accepted_outputs: [output] });
  const turn = await controller.send({ message: 'I think this future is wrong.', active_lens: 'FUTURES' });
  assert.equal(turn.confirmation_required, true);
  const deferred = await controller.decide({ proposal_id: turn.proposal.proposal_id, decision: 'DEFER', idempotency_key: 'afw06-scenario-future-defer' });
  assert.equal(deferred.ok, true, deferred.code);
  assert.equal(deferred.mutation_performed, false);
  assert.equal(controller.current().publication.publication_version, 1);
});

test('AFW-06 new evidence can be edited, confirmed, published, and carried into the next state packet', async () => {
  const output = evidenceCandidate({
    message: 'That contract may change the current capacity picture. I can add the signed engagement as customer-reported evidence, but I want you to confirm the exact scope before the map changes.',
    summary: 'Add the newly signed engagement to current business evidence.',
    field: 'where_you_are.new_contract',
    value: 'A new delivery engagement was signed for the next quarter.',
  });
  const continuation = noMutation('The corrected engagement is now part of the current map. We can use it as accepted business evidence without pretending we already know the delivery outcome.');
  const { controller } = await createSyntheticLivingRelationshipLab({ accepted_outputs: [output, continuation] });
  const turn = await controller.send({ message: 'We signed a new contract that starts next month.', active_lens: 'WHERE_YOU_ARE' });
  const editedItems = [{ field: 'where_you_are.new_contract', value: 'A signed 90-day engagement starts next month; delivery outcome is not yet known.' }];
  const accepted = await controller.decide({ proposal_id: turn.proposal.proposal_id, decision: 'EDIT', edited_items: editedItems, idempotency_key: 'afw06-scenario-evidence-edit' });
  assert.equal(accepted.ok, true, accepted.code);
  assert.equal(accepted.mutation_performed, true);
  assert.equal(accepted.publication.five_boxes.WHERE_YOU_ARE.accepted_changes.new_contract, editedItems[0].value);
  assert.equal(accepted.publication.completeness.partial_publication, false);
  assert.equal(controller.current().state_packet.current_state.five_boxes.WHERE_YOU_ARE.accepted_changes.new_contract, editedItems[0].value);
  const next = await controller.send({ message: 'What should we watch now?' });
  assert.equal(next.confirmation_required, false);
  assert.match(next.customer_message, /corrected engagement is now part of the current map/i);
});
