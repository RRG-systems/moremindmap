import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  advanceDeletionEpochForJob,
  createDeletionJob,
  createSyntheticSharedSecurityBackend,
  createSyntheticTranscriptStoreCapability,
  evaluateErasureArchitecture,
  InMemorySharedSecurityState,
  LOCAL_JSONL_PRODUCTION_ERASURE_BOUNDARY,
  RATIFIED_INTERIM_RETENTION_POLICY,
  recordDeletionTargetAttempt,
  restoreExposureDecision,
  scheduleDeletionJob,
  verifyDeletionJob,
  verifySyntheticErasureReceipts,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js';
import {
  LocalJsonlDurableLiveSessionDriver,
} from '../src/lib/intelligenceFabric/coachConnect/liveSession/durable/localJsonlDriver.js';

const exactScopeHash = 'scope-hash-deletion-001';
const createdAt = '2026-07-24T16:00:00.000Z';
const targets = [
  {
    target_id: 'target-primary',
    target_class: 'TRANSCRIPT_CONTENT',
    store_id: 'synthetic-primary-store',
    required_disposition: 'OBJECT_DELETE_AND_KEY_ERASURE',
  },
  {
    target_id: 'target-derivative',
    target_class: 'DERIVED_TRANSCRIPT_ARTIFACT',
    store_id: 'synthetic-derivative-store',
    required_disposition: 'OBJECT_DELETE_AND_LINEAGE_RECEIPT',
  },
];

function plannedJob({ activeLegalHold = null } = {}) {
  return createDeletionJob({
    exact_scope_hash: exactScopeHash,
    policy: RATIFIED_INTERIM_RETENTION_POLICY,
    requested_by_subject_ref: 'subscriber-subject-requestor',
    approved_by_subject_refs: ['privacy-operator-approver'],
    operator_decision: { allowed: true, action: 'PLAN_DELETION' },
    targets,
    lease_fencing_token: 1,
    created_at: createdAt,
    active_legal_hold: activeLegalHold,
  });
}

test('deletion lifecycle advances the denial epoch before target execution and requires every receipt', () => {
  const store = new InMemorySharedSecurityState({
    backend: createSyntheticSharedSecurityBackend(null, { clock: () => Date.parse(createdAt) }),
  });
  const planned = plannedJob();
  assert.equal(planned.ok, true);
  const advanced = advanceDeletionEpochForJob({
    store,
    job: planned.job,
    expected_epoch: 0,
    updated_at: '2026-07-24T16:01:00.000Z',
  });
  assert.equal(advanced.ok, true);
  assert.equal(advanced.job.deletion_epoch, 1);
  const scheduled = scheduleDeletionJob({
    job: advanced.job,
    updated_at: '2026-07-24T16:02:00.000Z',
  });
  const partial = recordDeletionTargetAttempt({
    job: scheduled.job,
    target_id: 'target-primary',
    attempted_at: '2026-07-24T16:03:00.000Z',
    result: {
      verified: true,
      store_id: 'synthetic-primary-store',
      disposition: 'OBJECT_DELETE_AND_KEY_ERASURE',
      verification_receipt_ref: 'receipt-primary',
    },
  });
  assert.equal(partial.job.state, 'PARTIALLY_VERIFIED');
  assert.equal(partial.all_targets_verified, false);
  assert.equal(verifyDeletionJob(partial.job).ok, false);
  const completed = recordDeletionTargetAttempt({
    job: partial.job,
    target_id: 'target-derivative',
    attempted_at: '2026-07-24T16:04:00.000Z',
    result: {
      verified: true,
      store_id: 'synthetic-derivative-store',
      disposition: 'OBJECT_DELETE_AND_LINEAGE_RECEIPT',
      verification_receipt_ref: 'receipt-derivative',
    },
  });
  const verified = verifyDeletionJob(completed.job);
  assert.equal(verified.ok, true);
  assert.equal(verified.logical_denial_proven, true);
  assert.equal(verified.whole_system_physical_deletion, false);
});

test('fake mismatched or incomplete receipts never become deletion success', () => {
  const store = new InMemorySharedSecurityState();
  const advanced = advanceDeletionEpochForJob({
    store,
    job: plannedJob().job,
    expected_epoch: 0,
    updated_at: createdAt,
  });
  const scheduled = scheduleDeletionJob({ job: advanced.job, updated_at: createdAt });
  const result = recordDeletionTargetAttempt({
    job: scheduled.job,
    target_id: 'target-primary',
    attempted_at: createdAt,
    result: {
      verified: true,
      store_id: 'wrong-store',
      disposition: 'OBJECT_DELETE_AND_KEY_ERASURE',
      verification_receipt_ref: 'fake-receipt',
    },
  });
  assert.equal(result.all_targets_verified, false);
  assert.equal(result.job.targets[0].state, 'FAILED_RETRYABLE');
  assert.equal(verifyDeletionJob(result.job).whole_system_physical_deletion, false);
});

test('an active legal hold blocks planning and restore replays deletion epochs before exposure', () => {
  const held = plannedJob({
    activeLegalHold: {
      hold_id: 'hold-delete-001',
      exact_scope_hash: exactScopeHash,
      governed_data_classes: ['TRANSCRIPT_CONTENT'],
      authority_subject_ref: 'legal-owner',
      reason_code: 'ACTIVE_HOLD',
      issued_at: createdAt,
      review_at: '2026-08-24T16:00:00.000Z',
      released_at: null,
      status: 'ACTIVE',
      policy_version: 'retention-authority-v1',
      audit_event_id: 'audit-hold-delete-001',
    },
  });
  assert.equal(held.ok, false);
  assert.equal(held.code, 'LEGAL_HOLD_ACTIVE');
  const store = new InMemorySharedSecurityState();
  store.advanceDeletionEpoch({ scope_hash: exactScopeHash, expected_epoch: 0, reason_code: 'RESTORE_DENIAL' });
  assert.equal(restoreExposureDecision({
    store,
    exact_scope_hash: exactScopeHash,
    restored_record_epoch: 0,
  }).allowed, false);
  assert.equal(restoreExposureDecision({
    store,
    exact_scope_hash: exactScopeHash,
    restored_record_epoch: 1,
  }).allowed, true);
});

test('ratified store replacement is synthetic-only and local JSONL remains logical-denial-only', () => {
  const architecture = evaluateErasureArchitecture({
    transcript_store_capability: createSyntheticTranscriptStoreCapability(),
  });
  assert.equal(architecture.allowed, true);
  assert.equal(architecture.live_store_contacted, false);
  assert.equal(architecture.migration_authorized, false);
  assert.equal(architecture.local_jsonl_physical_deletion, false);
  const erasure = verifySyntheticErasureReceipts({
    exact_scope_hash: exactScopeHash,
    primary_delete_receipt: { verified: true, scope_hash: exactScopeHash },
    key_erasure_receipt: {
      verified: true,
      scope_hash: exactScopeHash,
      active_replica_count: 0,
      backup_key_access_denied: true,
    },
    derivative_receipts: [{ verified: true, scope_hash: exactScopeHash }],
  });
  assert.equal(erasure.ok, true);
  assert.equal(erasure.receipt.whole_system_physical_deletion, false);
  assert.equal(verifySyntheticErasureReceipts({
    exact_scope_hash: exactScopeHash,
    primary_delete_receipt: { verified: true, scope_hash: exactScopeHash },
    key_erasure_receipt: null,
    derivative_receipts: [{ verified: true, scope_hash: exactScopeHash }],
  }).ok, false);

  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'coach-connect-jsonl-truth-'));
  try {
    const driver = new LocalJsonlDurableLiveSessionDriver({ dataRoot });
    assert.deepEqual(driver.inspectDeletionCapability(), {
      logical_tombstone_supported: true,
      deletion_epoch_supported: true,
      physical_deletion_supported: false,
      physical_deletion_claim: 'NOT_PROVEN_APPEND_ONLY_FULL_SNAPSHOTS',
    });
    assert.equal(LOCAL_JSONL_PRODUCTION_ERASURE_BOUNDARY.truth, 'LOGICAL_DENIAL_ONLY');
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});

test('partial legal holds name held target classes and execute no deletion', () => {
  const held = plannedJob({
    activeLegalHold: {
      hold_id: 'hold-delete-partial',
      exact_scope_hash: exactScopeHash,
      governed_data_classes: ['TRANSCRIPT_CONTENT'],
      authority_subject_ref: 'legal-owner',
      reason_code: 'PARTIAL_CLASS_HOLD',
      issued_at: createdAt,
      review_at: '2026-08-24T16:00:00.000Z',
      released_at: null,
      status: 'ACTIVE',
      policy_version: 'retention-authority-v1',
      audit_event_id: 'audit-hold-delete-partial',
    },
  });
  assert.deepEqual(held.held_target_ids, ['target-primary']);
  assert.deepEqual(held.unheld_target_ids, ['target-derivative']);
  assert.equal(held.deletion_executed, false);
});

test('synthetic erasure requires all key replicas denied and is deterministic on retry', () => {
  const receipts = {
    exact_scope_hash: exactScopeHash,
    primary_delete_receipt: { verified: true, scope_hash: exactScopeHash },
    key_erasure_receipt: {
      verified: true,
      scope_hash: exactScopeHash,
      active_replica_count: 0,
      backup_key_access_denied: true,
    },
    derivative_receipts: [{ verified: true, scope_hash: exactScopeHash }],
  };
  const first = verifySyntheticErasureReceipts(receipts);
  const retry = verifySyntheticErasureReceipts(receipts);
  assert.equal(first.ok, true);
  assert.equal(first.receipt.receipt_id, retry.receipt.receipt_id);
  assert.equal(verifySyntheticErasureReceipts({
    ...receipts,
    key_erasure_receipt: {
      ...receipts.key_erasure_receipt,
      active_replica_count: 1,
    },
  }).ok, false);
});
