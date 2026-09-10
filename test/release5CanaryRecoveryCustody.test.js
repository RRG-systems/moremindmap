import assert from 'node:assert/strict';
import test from 'node:test';

import {
  __testBaReadyRecoveryAuditCustodyValid as validAudit,
  __testBaReadyRecoveryKeyCustodyValid as valid,
} from '../api/internal/release5-canary-controller.js';

const required = Object.freeze({
  release5_new_bos_checkpoint: 21,
  release5_synthetic_manager_profile: 2,
  release5_new_ba_pointer: 1,
  release5_new_ba_background: 3,
  release5_new_bos_pointer: 1,
  release5_synthetic_recruit_vault_index: 2,
  historical_release4_subscription_blind: 3,
  release5_new_ba_checkpoint: 3,
  release5_synthetic_recruit_bos_execution: 1,
  historical_release4_subscription_runtime: 13,
  release5_shared_bos_job_index: 1,
  release5_new_bos_artifact: 1,
  release5_recruiting_state: 1,
  release5_synthetic_recruit_ba_locator: 1,
  release5_synthetic_recruit_ba_index: 2,
  release5_synthetic_recruit_canonical: 1,
  release5_synthetic_recruit_ba_job: 1,
  release5_synthetic_recruit_bos_job: 1,
  release5_synthetic_recruit_ba_execution: 1,
  release5_shared_vault_count: 1,
  release5_synthetic_recruit_ba: 1,
  release5_new_ba_artifact: 1,
});

function inventory({ total = 63, retryCount = 0, classes = required } = {}) {
  return {
    phase: 'ba_ready',
    total,
    classes: {
      ...classes,
      ...(retryCount ? { release5_recruiting_projection_retry: retryCount } : {}),
    },
  };
}

test('recovery accepts exact current 63-key BA-ready custody with zero optional retry receipts', () => {
  assert.equal(valid(inventory()), true);
});

test('recovery preserves compatibility with exact historical 65-key custody and two retry receipts', () => {
  assert.equal(valid(inventory({ total: 65, retryCount: 2 })), true);
});

test('recovery rejects count drift, optional receipt drift, missing required classes, and recognized extras', () => {
  assert.equal(valid(inventory({ total: 65, retryCount: 1 })), false);
  assert.equal(valid(inventory({ total: 64, retryCount: 1 })), false);
  assert.equal(valid(inventory({ classes: { ...required, release5_new_ba_artifact: 0 } })), false);
  assert.equal(valid(inventory({ classes: { ...required, release5_new_ba_failure_ledger: 1 } })), false);
  assert.equal(valid({ ...inventory(), phase: 'bos_ready' }), false);
});

test('recovery accepts only the two exact preserved BA-ready audit checkpoints and their pending acknowledgements', () => {
  assert.equal(validAudit(37, 'FIRST'), true);
  assert.equal(validAudit(40, 'RETRY'), true);
  assert.equal(validAudit(70, 'FIRST'), true);
  assert.equal(validAudit(73, 'RETRY'), true);
});

test('recovery rejects audit drift and invalid recovery modes', () => {
  for (const count of [36, 38, 39, 41, 69, 71, 72, 74, 120]) {
    assert.equal(validAudit(count, 'FIRST'), false);
    assert.equal(validAudit(count, 'RETRY'), false);
  }
  assert.equal(validAudit(37, 'UNKNOWN'), false);
  assert.equal(validAudit(70.5, 'FIRST'), false);
});
