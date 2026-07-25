import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOfflineConfiguration,
  validateConfiguration,
} from '../src/lib/intelligenceFabric/coachConnect/deploymentReadiness/configurationAuthority.js';
import {
  createOfflineEnvironment,
  ENVIRONMENT_MATRIX,
  validateEnvironment,
} from '../src/lib/intelligenceFabric/coachConnect/deploymentReadiness/environmentMatrix.js';

test('all known environments validate in offline default-off form', () => {
  for (const environmentClass of Object.keys(ENVIRONMENT_MATRIX)) {
    const value = createOfflineEnvironment(environmentClass, `offline-${environmentClass.toLowerCase()}`);
    assert.equal(validateEnvironment(value).valid, true);
    assert.equal(value.public_access_permitted, false);
    assert.equal(value.live_dependencies_permitted, false);
  }
});

test('unknown and contradictory environments fail closed', () => {
  assert.equal(createOfflineEnvironment('UNKNOWN', 'unknown'), null);
  const value = { ...createOfflineEnvironment('INTERNAL_STAGING', 'internal-staging'), public_access_permitted: true };
  const result = validateEnvironment(value);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(({ code }) => code === 'PUBLIC_ACCESS_POSSIBLE'));
});

test('configuration is deterministic, complete, and default-off', () => {
  const value = createOfflineConfiguration();
  assert.equal(validateConfiguration(value).valid, true);
  assert.deepEqual(new Set(Object.values(value.application_flags)), new Set([false]));
  assert.deepEqual(new Set(Object.values(value.live_dependency_flags)), new Set([false]));
  assert.equal(value.emergency_disabled, true);
  assert.equal(value.activation_permitted, false);
  assert.equal(value.deployment_permitted, false);
});

test('conflicts, enabled capabilities, missing emergency disable, and sensitive keys fail', () => {
  const baseline = createOfflineConfiguration();
  for (const mutation of [
    { emergency_disabled: false },
    { activation_permitted: true },
    { deployment_permitted: true },
    { application_flags: { ...baseline.application_flags, stripe: true } },
    { live_dependency_flags: { ...baseline.live_dependency_flags, provider_calls: true } },
    { token: 'sensitive-canary' },
  ]) {
    const value = createOfflineConfiguration(mutation);
    assert.equal(validateConfiguration(value).valid, false);
  }
});

test('digest mismatch and expiration fail closed', () => {
  const digestMismatch = { ...createOfflineConfiguration(), environment_id: 'changed' };
  assert.ok(validateConfiguration(digestMismatch).errors.some(({ code }) => code === 'CONFIGURATION_DIGEST_MISMATCH'));
  const expired = createOfflineConfiguration({ expires_at: '2026-01-01T00:00:00.000Z' });
  assert.equal(validateConfiguration(expired).valid, false);
});
