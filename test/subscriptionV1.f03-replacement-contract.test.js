import assert from 'node:assert/strict';
import test from 'node:test';
import { validateDurableCandidateOutput, DURABLE_CANDIDATE_OUTPUT_SCHEMA_V1 } from '../src/lib/subscriptionV1/freeGptV2/contracts.js';

globalThis.fetch = () => { throw new Error('F03_CONTRACT_NETWORK_DENIED'); };
const oldHash = 'a'.repeat(64), otherHash = 'b'.repeat(64);
const candidate = {
  candidate_type: 'COMMITMENT_CANDIDATE', proposal_type: 'COMMITMENT_CANDIDATE', target_contract: 'PLAN_135',
  operation: 'PROPOSE', summary: 'A separately reviewable small action.',
  items: [{ field: 'commitment.intervention', value: 'Review one record.' }],
  reason: 'The customer proposed this work; it is not approved.', evidence_ref_ids: [], authority_ref_ids: [],
  confirmation_required: true, generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
};
const validate = (value, allowed = [oldHash]) => validateDurableCandidateOutput(value, { allowed_pending_proposal_hashes: allowed });

test('replacement is a separate typed exact-reference annotation, not field overlap', () => {
  assert.ok(DURABLE_CANDIDATE_OUTPUT_SCHEMA_V1.schema.required.includes('replaces_pending_proposal_hashes'));
  const result = validate({ candidate, replaces_pending_proposal_hashes: [oldHash] });
  assert.equal(result.valid, true);
  assert.deepEqual(result.replaces_pending_proposal_hashes, [oldHash]);
  assert.deepEqual(result.candidate.items, candidate.items);
  assert.equal(result.candidate.confirmation_required, true);
});

test('legacy and additive candidates default to no replacement', () => {
  for (const value of [{ candidate }, { candidate, replaces_pending_proposal_hashes: [] }, { candidate: null }]) {
    const result = validate(value);
    assert.equal(result.valid, true);
    assert.deepEqual(result.replaces_pending_proposal_hashes, []);
  }
});

test('unknown, malformed, repeated and excessive replacement references fail without eligible output', () => {
  for (const refs of [[otherHash], ['not-a-hash'], [oldHash, oldHash], null, true, oldHash, Array.from({ length: 9 }, (_, i) => i.toString(16).repeat(64))]) {
    const result = validate({ candidate, replaces_pending_proposal_hashes: refs });
    assert.equal(result.valid, false);
    assert.ok(result.errors.includes('PENDING_PROPOSAL_REPLACEMENT_BINDING_INVALID'));
    assert.equal(result.candidate, null);
    assert.deepEqual(result.replaces_pending_proposal_hashes, []);
  }
});

test('no current eligible drafts means no replacement authority', () => {
  const result = validate({ candidate, replaces_pending_proposal_hashes: [oldHash] }, []);
  assert.equal(result.valid, false);
  assert.deepEqual(result.replaces_pending_proposal_hashes, []);
});

test('a replacement cannot be issued without a new candidate for review', () => {
  const result = validate({ candidate: null, replaces_pending_proposal_hashes: [oldHash] });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('PENDING_PROPOSAL_REPLACEMENT_CANDIDATE_REQUIRED'));
  assert.deepEqual(result.replaces_pending_proposal_hashes, []);
});

test('multiple exact eligible hashes can be named without creating customer approval', () => {
  const result = validate({ candidate, replaces_pending_proposal_hashes: [oldHash, otherHash] }, [oldHash, otherHash]);
  assert.equal(result.valid, true);
  assert.deepEqual(result.replaces_pending_proposal_hashes, [oldHash, otherHash]);
  assert.equal(result.candidate.confirmation_required, true);
  assert.equal(validate({ candidate, replaces_pending_proposal_hashes: [], approved: true }).valid, false);
});
