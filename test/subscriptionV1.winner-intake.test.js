import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PAID_WINNER_ACCEPTANCE_SCHEMA,
  PaidWinnerAcceptanceError,
  requirePinnedPaidWinnerAcceptance,
} from '../api/engine/subscriptionV1/winnerIntake.js';

function acceptedCapsule() {
  return {
    schema: PAID_WINNER_ACCEPTANCE_SCHEMA,
    artifact_id: 'TEST02_M2_F09_LOCAL_2026_09_11',
    selection_id: 'MODEL2',
    artifact_raw_sha256: 'c72870338c643e5259cd3c1d489af2c170c2503afb55630f9959c55a02c8b46c',
    artifact_payload_sha256: '1e50a2f06bdef98b96dd9e1ab1756770afe07decb6c461a3182cebfbb580c723',
    digest_clarification_sha256: '0afad0fbc7a6022a4504c17c873fbfd65ff4d46e6a7a645ae45409ac2d840506',
    acceptance: {
      status: 'FINAL_ACCEPTED_FOR_BOUNDED_INTEGRATION_REVIEW',
      actual_provider_proof: true,
      scoped_unresolved_failed_gates: 0,
      historical_failed_rounds_preserved: 1,
      open_release_gate_count: 4,
      unresolved_release_gates_sha256: 'a3b9ee5b113587ce2dbf30462d23e493429b70e3a76a34ff95869c86a20ad51c',
      release_accepted: false,
      production_authority: false,
    },
    authority: {
      authority_id: 'FUTURE_SPOCK_TEST02_M2_F09_BOUNDED_INTEGRATION_REVIEW',
      authority_version: '1',
      decided_at: '2026-09-11T23:58:08.621Z',
      authority_raw_sha256: '4f151448da7b8d37227ec077a014f6b5913f7c6a5f009136b18341ab3b4137bb',
    },
    source: {
      kind: 'local_frozen_source_snapshot',
      product_manifest_sha256: '0a1ce96b97f2fe51d73c90151f8bfb4f4d1f053c5a4b0d2e06bf23958407e5db',
      source_delta_sha256: '7c016f632954328a4b896b29c243dd5bd696d6c7eb1bfb537e55ca7aaaf4c779',
      new_candidate_commit: null,
      new_candidate_tree: null,
      new_candidate_deployment: null,
    },
    groups: {
      assignment_sha256: '7c03ca3179557d9f6cbb8ead922d947c6ac2886dcff9f34484be6a9acf10eebf',
      runtime_policy_sha256: 'e3d0d834fdec5650087c0c4b135feb443294e7fb55843632c58eb659184ceea6',
      coaching_inputs_sha256: '0933aee69fe40e1672991a4760af9395582c6fc78c51f8bdb8b9db26540d1ca7',
    },
  };
}

function assertRejected(capsule) {
  assert.throws(
    () => requirePinnedPaidWinnerAcceptance(capsule),
    (error) => error instanceof PaidWinnerAcceptanceError
      && error.code === 'SUBSCRIPTION_V1_PAID_WINNER_ACCEPTANCE_INVALID',
  );
}

test('admits only the pinned bounded-integration acceptance and returns no custody handle', () => {
  assert.equal(requirePinnedPaidWinnerAcceptance(), true);
  assert.equal(requirePinnedPaidWinnerAcceptance(acceptedCapsule()), true);
});

test('fails closed on custody, policy, authority, or source drift', () => {
  const mutations = [
    (capsule) => { capsule.artifact_raw_sha256 = '0'.repeat(64); },
    (capsule) => { capsule.artifact_payload_sha256 = '0'.repeat(64); },
    (capsule) => { capsule.selection_id = 'OTHER'; },
    (capsule) => { capsule.groups.runtime_policy_sha256 = '0'.repeat(64); },
    (capsule) => { capsule.authority.authority_raw_sha256 = '0'.repeat(64); },
    (capsule) => { capsule.source.product_manifest_sha256 = '0'.repeat(64); },
    (capsule) => { capsule.source.source_delta_sha256 = '0'.repeat(64); },
  ];
  for (const mutate of mutations) {
    const capsule = acceptedCapsule();
    mutate(capsule);
    assertRejected(capsule);
  }
});

test('cannot inflate bounded review into release or Production acceptance', () => {
  const mutations = [
    (capsule) => { capsule.acceptance.status = 'FINAL_ACCEPTED'; },
    (capsule) => { capsule.acceptance.release_accepted = true; },
    (capsule) => { capsule.acceptance.production_authority = true; },
    (capsule) => { capsule.acceptance.open_release_gate_count = 0; },
    (capsule) => { capsule.acceptance.historical_failed_rounds_preserved = 0; },
    (capsule) => { capsule.source.new_candidate_deployment = 'dpl_Forged'; },
  ];
  for (const mutate of mutations) {
    const capsule = acceptedCapsule();
    mutate(capsule);
    assertRejected(capsule);
  }
});

test('rejects malformed and expanded capsules, including disclosure-shaped additions', () => {
  assertRejected(null);
  assertRejected({});

  const withProviderMetadata = acceptedCapsule();
  withProviderMetadata.provider = { name: 'must-never-cross-the-boundary' };
  assertRejected(withProviderMetadata);

  const withAssignmentMetadata = acceptedCapsule();
  withAssignmentMetadata.groups.assignment = { credential_role: 'must-never-cross-the-boundary' };
  assertRejected(withAssignmentMetadata);
});
