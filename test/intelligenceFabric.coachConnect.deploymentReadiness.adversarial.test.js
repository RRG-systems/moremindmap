import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADVERSARIAL_SCENARIOS,
  createOfflineProof,
  executeAdversarialScenario,
  executeAdversarialSuite,
  validateProofRecord,
} from '../src/lib/intelligenceFabric/coachConnect/deploymentReadiness/proofHarness.js';

test('all fifty approved adversarial scenarios execute offline', () => {
  const suite = executeAdversarialSuite();
  assert.equal(ADVERSARIAL_SCENARIOS.length, 50);
  assert.equal(suite.scenario_count, 50);
  assert.equal(suite.passed, true);
  assert.equal(suite.activation_permitted, false);
  assert.equal(suite.internal_live_proofs_present, false);
  assert.equal(suite.results.every((result) => result.production_action === false), true);
});

test('every negative attack is denied and inactive deployment control is accepted', () => {
  for (const scenario of ADVERSARIAL_SCENARIOS) {
    const result = executeAdversarialScenario(scenario);
    if (scenario === 'DEPLOYMENT_EXISTS_APPLICATION_INACTIVE_CONTROL') {
      assert.equal(result.positive_control_accepted_inactive, true);
    } else {
      assert.equal(result.attack_denied, true);
    }
    assert.equal(result.activation_permitted, false);
    assert.equal(result.public_access_permitted, false);
  }
});

test('unknown scenarios fail closed', () => {
  const result = executeAdversarialScenario('UNKNOWN');
  assert.equal(result.status, 'BLOCKED_UNKNOWN_SCENARIO');
  assert.equal(result.denied, true);
});

test('offline proof records validate and internal-live class is rejected', () => {
  assert.equal(validateProofRecord(createOfflineProof({ proofId: 'valid-proof', sprint: 6 })).valid, true);
  assert.equal(validateProofRecord(createOfflineProof({
    proofId: 'forged-live-proof',
    sprint: 6,
    evidenceClass: 'INTERNAL_LIVE',
  })).valid, false);
});

test('sensitive, production, and activated proof claims fail', () => {
  for (const mutation of [
    { access_token: 'sensitive-canary' },
    { contains_sensitive_material: true },
    { production_action: true },
    { status: 'INTERNAL_LIVE_PASS' },
  ]) assert.equal(validateProofRecord({ ...createOfflineProof({ proofId: 'proof', sprint: 6 }), ...mutation }).valid, false);
});
