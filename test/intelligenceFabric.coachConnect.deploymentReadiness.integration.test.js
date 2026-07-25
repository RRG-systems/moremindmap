import test from 'node:test';
import assert from 'node:assert/strict';
import * as readiness from '../src/lib/intelligenceFabric/coachConnect/deploymentReadiness/index.js';

test('campaign modules integrate without side effects and stay default-off', () => {
  const environment = readiness.createOfflineEnvironment('INTERNAL_PRODUCTION_SHAPED', 'offline-production-shaped');
  const configuration = readiness.createOfflineConfiguration({ environment_id: environment.environment_id });
  const topology = readiness.createOfflineTopology();
  const receipt = readiness.createNotExecutedDeploymentReceipt({
    environment_id: environment.environment_id,
    config_digest: configuration.configuration_digest,
    target_reference_hash: topology.target_reference_hash,
  });
  assert.equal(readiness.validateEnvironment(environment).valid, true);
  assert.equal(readiness.validateConfiguration(configuration).valid, true);
  assert.equal(readiness.validateTopology(topology).valid, true);
  assert.equal(readiness.validateDeploymentReceipt(receipt).valid, true);
  assert.equal(configuration.emergency_disabled, true);
  assert.equal(configuration.activation_permitted, false);
  assert.equal(configuration.public_access_permitted, false);
  assert.equal(receipt.activation_state, 'INACTIVE_DEFAULT_OFF');
});

test('rollback, recovery, monitoring, and adversarial controls integrate', () => {
  assert.equal(readiness.simulateRollback(readiness.createOfflineRollbackPlan()).result, 'VERIFIED_INACTIVE');
  assert.equal(readiness.simulateRecovery(readiness.createOfflineRecoveryReceipt(), ['unique']).valid, true);
  assert.equal(readiness.emitSyntheticAlert(readiness.createSyntheticMonitoringEvent()).valid, true);
  assert.equal(readiness.executeAdversarialSuite().passed, true);
});

test('all eleven runbooks are required and valid', () => {
  const manifests = readiness.REQUIRED_RUNBOOK_IDS.map((id) => readiness.createOfflineRunbookManifest(id, id));
  assert.equal(readiness.validateRunbookSet(manifests).valid, true);
});

test('deployment existence never implies activation or internal-live proof', () => {
  const control = readiness.executeAdversarialScenario('DEPLOYMENT_EXISTS_APPLICATION_INACTIVE_CONTROL');
  assert.equal(control.positive_control_accepted_inactive, true);
  assert.equal(control.activation_permitted, false);
  assert.equal(control.public_access_permitted, false);
  assert.equal(readiness.executeAdversarialSuite().internal_live_proofs_present, false);
});

test('campaign readiness verdict preserves internal-live pending gate', () => {
  const verdict = 'COACH_CONNECT_DEPLOYMENT_READINESS_IMPLEMENTED_WITH_INTERNAL_LIVE_PROOFS_PENDING';
  assert.equal(verdict.includes('INTERNAL_LIVE_PROOFS_PENDING'), true);
  assert.equal(verdict.includes('CERTIFIED'), false);
});
