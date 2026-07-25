import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOfflineRecoveryReceipt,
  simulateRecovery,
  validateRecoveryReceipt,
} from '../src/lib/intelligenceFabric/coachConnect/deploymentReadiness/recovery.js';
import {
  createOfflineRollbackPlan,
  simulateRollback,
  validateRollbackPlan,
} from '../src/lib/intelligenceFabric/coachConnect/deploymentReadiness/rollback.js';

test('offline rollback preserves security state and remains inactive', () => {
  const plan = createOfflineRollbackPlan();
  assert.equal(validateRollbackPlan(plan).valid, true);
  const result = simulateRollback(plan, {
    before: { security_epochs: 2, deletion_epochs: 3 },
    after: { security_epochs: 2, deletion_epochs: 3 },
  });
  assert.equal(result.result, 'VERIFIED_INACTIVE');
  assert.equal(result.activation_state, 'INACTIVE_DEFAULT_OFF');
  assert.equal(result.persistence_rollback_performed, false);
  assert.equal(result.physical_jsonl_deletion_claimed, false);
});

test('missing artifacts, config collision, and epoch rollback fail', () => {
  assert.equal(validateRollbackPlan(createOfflineRollbackPlan({ rollback_artifact_sha: null })).valid, false);
  assert.equal(validateRollbackPlan(createOfflineRollbackPlan({ rollback_config_digest: 'b'.repeat(64) })).valid, false);
  const result = simulateRollback(createOfflineRollbackPlan(), {
    before: { security_epochs: 2 },
    after: { security_epochs: 1 },
  });
  assert.equal(result.result, 'BLOCKED_STATE_REGRESSION');
});

test('offline recovery is idempotent and does not fall back to local state', () => {
  const receipt = createOfflineRecoveryReceipt();
  assert.equal(validateRecoveryReceipt(receipt).valid, true);
  const result = simulateRecovery(receipt, ['deploy-1', 'rollback-1']);
  assert.equal(result.valid, true);
  assert.equal(result.fallback_to_local_state, false);
  assert.equal(result.activation_state, 'INACTIVE_DEFAULT_OFF');
});

test('duplicate replay and live side effects fail', () => {
  assert.equal(simulateRecovery(createOfflineRecoveryReceipt(), ['deploy-1', 'deploy-1']).valid, false);
  for (const mutation of [
    { duplicate_promotion_count: 1 },
    { provider_call_count: 1 },
    { persistence_write_count: 1 },
    { limitations: [] },
  ]) assert.equal(validateRecoveryReceipt(createOfflineRecoveryReceipt(mutation)).valid, false);
});
