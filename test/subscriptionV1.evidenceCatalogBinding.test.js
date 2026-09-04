import assert from 'node:assert/strict';
import test from 'node:test';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';
import { createEvidenceReference } from '../src/lib/subscriptionV1/contracts.js';
import { InMemoryLivingRelationshipStore } from '../src/lib/subscriptionV1/afw05/store.js';
import { createGovernedCoachingEvidenceCatalog } from '../src/lib/subscriptionV1/freeGptV2/wholeCoachingPacket.js';
import { createSyntheticLivingRelationshipLab } from '../src/lab/subscriptionLivingBusinessRelationshipV1/createSyntheticLivingRelationshipLab.js';

const sessionId = 'session_888888888888888888888888';
const businessRef = 'synthetic_business_state_re-mid';

function candidate(reference) {
  return {
    candidate: {
      candidate_type: 'COMMITMENT_CANDIDATE',
      proposal_type: 'COMMITMENT_CANDIDATE',
      target_contract: 'PLAN_135',
      operation: 'PROPOSE',
      summary: 'Protect two follow-up blocks next week.',
      items: [{ field: 'commitment.intervention', value: 'Protect Tuesday and Thursday from 09:00 to 09:30 for follow-up next week.' }],
      reason: 'The synthetic customer requested this exact bounded commitment.',
      evidence_ref_ids: reference ? [reference] : [],
      authority_ref_ids: [],
      confirmation_required: true,
      generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
    },
  };
}

function externalEvidence(id, source = 'one') {
  const body = {
    external_evidence_id: id,
    purpose: 'Bounded synthetic evidence-catalog test.',
    status: 'TEMPORARY_CONTEXT',
    source_url: `https://example.com/${source}`,
    source_title: `Synthetic source ${source}`,
    source_trust: 'PRIMARY_OFFICIAL',
    citation: `Synthetic citation ${source}`,
    retrieved_at: '2026-09-04T17:00:00.000Z',
    privacy_classification: 'PUBLIC',
    customer_truth_override_allowed: false,
  };
  return { ...body, content_hash: hashCanonicalJson(body) };
}

function transportFor(reference, calls) {
  return async (request, { stage }) => {
    calls.push(stage);
    let output;
    if (stage === 'CONVERSATION') output = { customer_message: 'The exact proposal remains yours to approve or decline.' };
    if (stage === 'CANDIDATE_EXTRACTION') output = candidate(reference);
    if (stage === 'NATURAL_AUTHORIZATION') {
      const input = JSON.parse(request.input.find((entry) => entry.role === 'user').content);
      output = { decision: 'CONFIRM', proposal_hash: input.pending_proposal.proposal_hash, effective_items: [], unambiguous: true, reason: 'The exact proposal was explicitly authorized.' };
    }
    if (!output) throw new Error(`UNEXPECTED_TEST_STAGE:${stage}`);
    return { output, usage: { input_tokens: 1, output_tokens: 1 }, latency_ms: 1, web_search_calls: 0, external_evidence: [] };
  };
}

async function lab({ store = new InMemoryLivingRelationshipStore(), relationship = 'rel_88888888888888888888', reference = businessRef, external = [], calls = [] } = {}) {
  return createSyntheticLivingRelationshipLab({
    store,
    subject_key: 're-mid',
    relationship_key: relationship,
    session_id: sessionId,
    session_kind: 'FIRST_EVER',
    seed_weekly_fixture: false,
    external_evidence: external,
    transport: transportFor(reference, calls),
    clock: () => '2026-09-04T17:00:00.000Z',
  });
}

async function propose(x) {
  const result = await x.controller.send({ message: 'Show the exact one-week commitment before saving it.' });
  assert.equal(result.ok, true, result.code);
  assert.equal(result.confirmation_required, true);
  return result.proposal;
}

test('governed business evidence reference confirms and publishes through AFW-05', async () => {
  const store = new InMemoryLivingRelationshipStore();
  const first = await lab({ store });
  const proposal = await propose(first);
  const result = await first.controller.decide({ proposal_id: proposal.proposal_id, decision: 'CONFIRM', idempotency_key: 'valid-business-evidence-confirmation' });
  assert.equal(result.ok, true, result.code);
  assert.equal(result.code, 'AFW05_CONFIRMED_MUTATION_ATOMICALLY_PUBLISHED');
  assert.equal(result.publication.publication_version, 2);
  const events = store.readPersonalRsl({ scope: first.scope }).records;
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].event.evidence_refs.map((item) => item.evidence_id), [businessRef]);
  assert.equal(events[0].event.evidence_refs[0].evidence_domain, 'BUSINESS');
});

test('governed whole-person evidence reference confirms and remains resumable after reconstruction', async () => {
  const wholePersonRef = 'synthetic_execution_context_re-mid';
  for (const reconstruct of [false, true]) {
    const store = new InMemoryLivingRelationshipStore();
    const first = await lab({ store, reference: wholePersonRef });
    const proposal = await propose(first);
    const active = reconstruct ? await lab({ store, reference: wholePersonRef }) : first;
    const result = await active.controller.decide({
      proposal_id: proposal.proposal_id,
      decision: 'CONFIRM',
      idempotency_key: `whole-person-evidence-${reconstruct ? 'resumed' : 'fresh'}`,
    });
    assert.equal(result.ok, true, result.code);
    const event = store.readPersonalRsl({ scope: active.scope }).records[0].event;
    assert.deepEqual(event.evidence_refs.map((item) => item.evidence_id), [wholePersonRef]);
    assert.equal(event.evidence_refs[0].evidence_domain, 'WHOLE_PERSON_EXECUTION');
  }
});

test('proposal with no evidence references remains valid and does not fabricate evidence', async () => {
  const store = new InMemoryLivingRelationshipStore();
  const x = await lab({ store, reference: null });
  const proposal = await propose(x);
  const result = await x.controller.decide({
    proposal_id: proposal.proposal_id,
    decision: 'CONFIRM',
    idempotency_key: 'empty-evidence-control',
  });
  assert.equal(result.ok, true, result.code);
  const event = store.readPersonalRsl({ scope: x.scope }).records[0].event;
  assert.deepEqual(event.evidence_refs, []);
});

test('preserved pending proposal confirms after runtime reconstruction without regenerating its coaching or extraction', async () => {
  const store = new InMemoryLivingRelationshipStore(), firstCalls = [];
  const first = await lab({ store, calls: firstCalls });
  const proposal = await propose(first);
  assert.deepEqual(firstCalls, ['CONVERSATION', 'CANDIDATE_EXTRACTION']);
  const resumedCalls = [];
  const resumed = await lab({ store, calls: resumedCalls });
  assert.equal(resumed.controller.pendingProposal().proposal_hash, proposal.proposal_hash);
  const result = await resumed.controller.send({ message: 'Yes. Save exactly that one-week commitment. I authorize that exact map update.' });
  assert.equal(result.ok, true, result.code);
  assert.equal(result.mutation_performed, true);
  assert.deepEqual(resumedCalls, ['NATURAL_AUTHORIZATION', 'CONVERSATION']);
  assert.equal(resumedCalls.includes('CANDIDATE_EXTRACTION'), false);
  assert.equal(result.publication.publication_version, 2);
});

test('unknown client/provider evidence reference cannot enter a proposal', async () => {
  const store = new InMemoryLivingRelationshipStore();
  const x = await lab({ store, reference: 'synthetic_unknown_evidence' });
  const before = hashCanonicalJson(store.snapshot());
  const result = await x.controller.send({ message: 'Create a proposal using an unknown citation.' });
  assert.equal(result.ok, false);
  assert.match(result.code, /CANDIDATE_OUTPUT_INVALID/u);
  assert.equal(hashCanonicalJson(store.snapshot()), before);
});

test('stale evidence absent from reconstructed server catalog fails closed at confirmation', async () => {
  const store = new InMemoryLivingRelationshipStore();
  const oldEvidence = externalEvidence('external_arm_one_old', 'old');
  const first = await lab({ store, reference: oldEvidence.external_evidence_id, external: [oldEvidence] });
  const proposal = await propose(first);
  const currentEvidence = externalEvidence('external_arm_one_current', 'current');
  const resumed = await lab({ store, reference: currentEvidence.external_evidence_id, external: [currentEvidence] });
  const before = hashCanonicalJson(store.snapshot());
  const result = await resumed.controller.decide({ proposal_id: proposal.proposal_id, decision: 'CONFIRM', idempotency_key: 'stale-reference-denied' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'AFW05_EVIDENCE_REFERENCE_UNRESOLVED');
  assert.equal(hashCanonicalJson(store.snapshot()), before);
});

test('client-supplied confirmation catalog cannot expand server evidence authority', async () => {
  const store = new InMemoryLivingRelationshipStore();
  const oldEvidence = externalEvidence('external_client_forged', 'old');
  const first = await lab({ store, reference: oldEvidence.external_evidence_id, external: [oldEvidence] });
  const proposal = await propose(first);
  const resumed = await lab({ store, external: [] });
  const before = hashCanonicalJson(store.snapshot());
  const result = await resumed.controller.decide({
    proposal_id: proposal.proposal_id,
    decision: 'CONFIRM',
    idempotency_key: 'client-catalog-denied',
    evidence_catalog: [oldEvidence],
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'AFW05_EVIDENCE_REFERENCE_UNRESOLVED');
  assert.equal(hashCanonicalJson(store.snapshot()), before);
});

test('evidence identity collision and malformed external authority fail closed', () => {
  const left = createEvidenceReference({ evidence_id: 'shared_collision', evidence_domain: 'BUSINESS', content_hash: 'a'.repeat(64), certainty: 'KNOWN' });
  const right = createEvidenceReference({ evidence_id: 'shared_collision', evidence_domain: 'WHOLE_PERSON_EXECUTION', content_hash: 'b'.repeat(64), certainty: 'INFERRED' });
  assert.throws(() => createGovernedCoachingEvidenceCatalog({ business_truth: [left], whole_person_execution_context: [right] }), /EVIDENCE_IDENTITY_COLLISION/u);
  assert.throws(() => createGovernedCoachingEvidenceCatalog({ external_evidence: [{ ...externalEvidence('external_bad'), customer_truth_override_allowed: true }] }), /EXTERNAL_EVIDENCE_AUTHORITY_INVALID/u);
});

test('arm-scoped external catalogs cannot resolve the other arm and contain no customer or Patricia authority', async () => {
  const armOneEvidence = externalEvidence('external_blind_model_one', 'model-one');
  const armTwoEvidence = externalEvidence('external_blind_model_two', 'model-two');
  const oneStore = new InMemoryLivingRelationshipStore(), twoStore = new InMemoryLivingRelationshipStore();
  const one = await lab({ store: oneStore, relationship: 'rel_11111111111111111111', reference: armOneEvidence.external_evidence_id, external: [armOneEvidence] });
  const two = await lab({ store: twoStore, relationship: 'rel_22222222222222222222', reference: armOneEvidence.external_evidence_id, external: [armTwoEvidence] });
  const proposal = await propose(one);
  const denied = await two.controller.send({ message: 'Try to cite the other experimental relationship.' });
  assert.equal(denied.ok, false);
  assert.match(denied.code, /CANDIDATE_OUTPUT_INVALID/u);
  assert.equal(two.controller.pendingProposal(), null);
  assert.equal(one.controller.pendingProposal().proposal_hash, proposal.proposal_hash);
  const serialized = JSON.stringify({
    one: createGovernedCoachingEvidenceCatalog({ external_evidence: [armOneEvidence] }),
    two: createGovernedCoachingEvidenceCatalog({ external_evidence: [armTwoEvidence] }),
  });
  assert.doesNotMatch(serialized, /MM-|patricia|real_customer/iu);
  assert.match(serialized, /external_blind_model_one/u);
  assert.match(serialized, /external_blind_model_two/u);
});

test('each arm resolves only its own governed external reference into its own scoped event', async () => {
  for (const [relationship, evidence] of [
    ['rel_11111111111111111111', externalEvidence('external_blind_model_one', 'model-one')],
    ['rel_22222222222222222222', externalEvidence('external_blind_model_two', 'model-two')],
  ]) {
    const store = new InMemoryLivingRelationshipStore();
    const x = await lab({ store, relationship, reference: evidence.external_evidence_id, external: [evidence] });
    const proposal = await propose(x);
    const result = await x.controller.decide({ proposal_id: proposal.proposal_id, decision: 'CONFIRM', idempotency_key: `confirm-${relationship}` });
    assert.equal(result.ok, true, result.code);
    const event = store.readPersonalRsl({ scope: x.scope }).records[0].event;
    assert.equal(event.scope.business_id, x.scope.business_id);
    assert.deepEqual(event.evidence_refs.map((item) => item.evidence_id), [evidence.external_evidence_id]);
    assert.equal(event.evidence_refs[0].evidence_domain, 'EXTERNAL');
  }
});
