import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryLivingRelationshipStore } from '../src/lib/subscriptionV1/afw05/store.js';
import { correctionRecordReference, resolveCorrectionTargets } from '../src/lib/subscriptionV1/afw05/correctionTargets.js';
import { createNaturalAuthorizationInterpreterV1 } from '../src/lib/subscriptionV1/freeGptV2/providerSeams.js';
import { createSyntheticLivingRelationshipLab } from '../src/lab/subscriptionLivingBusinessRelationshipV1/createSyntheticLivingRelationshipLab.js';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';

const correction = (items, refs = []) => ({ candidate: {
  candidate_type: 'CORRECTION_CANDIDATE', proposal_type: 'CORRECTION_CANDIDATE', target_contract: 'EVIDENCE_LEDGER', operation: 'PROPOSE',
  summary: 'Correct the recorded execution degree from complete to partial.', items,
  reason: 'The customer corrects the exact reported execution.', evidence_ref_ids: [], authority_ref_ids: refs,
  confirmation_required: true, generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
} });
async function seeded(key = 'rel_aaaaaaaaaaaaaaaaaaaa', subject = 're-mid') {
  const store = new InMemoryLivingRelationshipStore();
  const lab = await createSyntheticLivingRelationshipLab({ store, subject_key: subject, relationship_key: key, session_kind: 'WEEKLY' });
  const active = store.buildPersonalRslStore({ scope: lab.scope }).replay({ scope: lab.scope, effective_as_of: '2026-09-17T17:06:00.000Z', recorded_as_of: '2026-09-17T17:06:00.000Z' }).state.active_events;
  return { store, lab, active, key, subject, target: active.find((event) => event.event_type === 'ATTEMPT') };
}
const changedItems = (target) => target.semantic_payload.items.map((item) => item.field === 'evidence.execution_degree' ? { ...item, value: 'PARTIAL' } : item);

test('recorded R01 naked execution-degree correction cannot target the older tracking record', async () => {
  const x = await seeded();
  const before = hashCanonicalJson(x.store.snapshot());
  const lab = await createSyntheticLivingRelationshipLab({ store: x.store, subject_key: x.subject, relationship_key: x.key, seed_weekly_fixture: false,
    conversation_outputs: [{ customer_message: 'That sounds like a different attempt; nothing has been changed.' }],
    candidate_outputs: [correction([{ field: 'evidence.execution_degree', value: 'PARTIAL' }])],
    clock: () => '2026-09-17T17:06:00.000Z',
  });
  const result = await lab.controller.send({ message: 'I completed Tuesday’s block, missed Thursday’s, two conversations, no appointments.' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'AFW05_CORRECTION_COMPLETE_RECORD_REQUIRED');
  assert.equal(hashCanonicalJson(x.store.snapshot()), before);
});

test('exact observation correction requires both active record hash and unchanged intervention identity', async () => {
  const x = await seeded();
  const input = { scope: x.lab.scope, active_events: x.active, items: changedItems(x.target) };
  assert.equal(resolveCorrectionTargets(input).ok, false);
  assert.equal(resolveCorrectionTargets({ ...input, authority_ref_ids: [correctionRecordReference(x.target)] }).ok, true);
  assert.equal(resolveCorrectionTargets({ ...input, authority_ref_ids: [correctionRecordReference(x.target).replace(/.$/u, 'x')] }).code, 'AFW05_CORRECTION_RECORD_REFERENCE_INVALID');
  assert.equal(resolveCorrectionTargets({ ...input, authority_ref_ids: [correctionRecordReference(x.target)], items: input.items.map((item) => item.field.endsWith('lineage_id') ? { ...item, value: 'intervention_' + '0'.repeat(24) } : item) }).code, 'AFW05_CORRECTION_LINEAGE_MISMATCH');
});

test('same shared field on two records cannot fan out into two supersessions', async () => {
  const x = await seeded();
  const second = { ...x.target, event_id: 'rsl_other', content_hash: 'a'.repeat(64) };
  const input = { scope: x.lab.scope, active_events: [...x.active, second], items: changedItems(x.target) };
  assert.equal(resolveCorrectionTargets(input).code, 'AFW05_CORRECTION_EXACT_RECORD_REQUIRED');
  assert.deepEqual(resolveCorrectionTargets({ ...input, authority_ref_ids: [correctionRecordReference(x.target)] }).supersedes_event_ids, [x.target.event_id]);
});

for (const [label, key, subject] of [['other relationship', 'rel_bbbbbbbbbbbbbbbbbbbb', 're-mid'], ['other customer', 'rel_cccccccccccccccccccc', 're-early']]) {
  test(`a ${label} cannot supply correction record authority`, async () => {
    const x = await seeded();
    const foreign = await seeded(key, subject);
    const input = { scope: x.lab.scope, active_events: x.active, items: changedItems(x.target), authority_ref_ids: [correctionRecordReference(foreign.target)] };
    assert.equal(resolveCorrectionTargets(input).code, 'AFW05_CORRECTION_RECORD_REFERENCE_INVALID');
    assert.equal(resolveCorrectionTargets({ ...input, active_events: [...x.active, foreign.target] }).code, 'AFW05_CORRECTION_SCOPE_DENIED');
    const before = hashCanonicalJson(foreign.store.snapshot());
    assert.equal(foreign.store.readCurrent({ scope: x.lab.scope }).ok, false);
    assert.equal(hashCanonicalJson(foreign.store.snapshot()), before);
  });
}

test('a full exact correction preserves immutable history, intervention lineage, and active observation meaning', async () => {
  const x = await seeded();
  const originalHash = x.target.content_hash;
  const lab = await createSyntheticLivingRelationshipLab({ store: x.store, subject_key: x.subject, relationship_key: x.key, seed_weekly_fixture: false,
    conversation_outputs: [{ customer_message: 'I can correct that exact tracking record after your approval.' }],
    candidate_outputs: [correction(changedItems(x.target), [correctionRecordReference(x.target)])],
    clock: () => '2026-09-17T17:06:00.000Z',
  });
  const result = await lab.controller.send({ message: 'Correct the execution degree of the five-day tracking exercise to partial. Keep all its other evidence.' });
  assert.equal(result.ok, true, result.code);
  assert.deepEqual(result.proposal.supersedes_event_ids, [x.target.event_id]);
  const accepted = await lab.controller.decide({ proposal_id: result.proposal.proposal_id, decision: 'CONFIRM', idempotency_key: 'record-custody-exact' });
  assert.equal(accepted.ok, true, accepted.code);
  assert.equal(accepted.event.event_type, 'CORRECTION');
  assert.equal(accepted.event.semantic_payload.lineage.intervention_lineage_id, x.target.semantic_payload.lineage.intervention_lineage_id);
  assert.equal(accepted.event.semantic_payload.lineage.execution_degree, 'PARTIAL');
  assert.equal(x.store.readPersonalRsl({ scope: lab.scope }).records.find((r) => r.event.event_id === x.target.event_id).event.content_hash, originalHash);
  const scorecard = lab.controller.longitudinalScorecard({ as_of_at: '2026-09-17T17:07:00.000Z' });
  const active = scorecard.scorecard.interventions.find((entry) => entry.intervention_lineage_id === x.target.semantic_payload.lineage.intervention_lineage_id);
  assert.equal(active.actually_tried.length, 1);
  assert.equal(active.actually_tried[0].degree, 'PARTIAL');
});

test('conditional exact-target restrictions cannot be dropped by either provider adapter', async () => {
  for (const adapter of ['adapter-one', 'adapter-two']) {
    let calls = 0;
    const interpreter = createNaturalAuthorizationInterpreterV1({ enabled: true, transport: async () => { calls += 1; throw Error(adapter); } });
    const result = await interpreter.interpret({ proposal: { proposal_hash: 'a'.repeat(64) }, customer_message: 'Please record that partial attempt and the two conversations with no appointments, attached only to the follow-up-block commitment if it actually exists.' });
    assert.equal(result.decision, 'AMBIGUOUS');
    assert.equal(result.mutation_performed, false);
    assert.equal(calls, 0);
  }
});

test('unconditional natural approval still uses the provider with exact target context and full intent boundary', async () => {
  let request;
  const proposal = { proposal_hash: 'a'.repeat(64), summary: 'Exact record correction', proposed_items: [], supersedes_event_ids: ['rsl_exact'] };
  const target = { authority_ref: 'opaque-exact-record', summary: 'Five-day tracking exercise' };
  const interpreter = createNaturalAuthorizationInterpreterV1({ enabled: true, transport: async (value) => {
    request = value;
    return { output: { decision: 'CONFIRM', proposal_hash: proposal.proposal_hash, effective_items: [], unambiguous: true, reason: 'The exact correction is approved.' } };
  } });
  const result = await interpreter.interpret({ proposal, customer_message: 'I approve that exact correction.', target_context: [target], conversation: [] });
  assert.equal(result.decision, 'CONFIRM');
  assert.deepEqual(JSON.parse(request.input.find((entry) => entry.role === 'user').content).target_context, [target]);
  assert.match(request.input.map((entry) => entry.content).join('\n'), /Never classify that condition as separate/u);
});
