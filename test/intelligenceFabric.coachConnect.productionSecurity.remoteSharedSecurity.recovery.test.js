import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRemoteSharedSecurityHealthController,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/health.js';

const sha = (character) => character.repeat(64);

function controllerHarness() {
  let now = Date.parse('2026-07-27T20:00:00.000Z');
  const controller = createRemoteSharedSecurityHealthController({
    configured: true,
    emergency_disabled: false,
    adapter_id: 'recovery_adapter',
    environment_id: 'TEST',
    configuration_digest: sha('a'),
    script_manifest_digest: sha('b'),
    clock: () => now,
  });
  return {
    controller,
    advance: (value) => { now += value; },
  };
}

function proof(epoch, serverTimeMs) {
  return {
    server_time_ms: serverTimeMs,
    canary_epoch: epoch,
    configuration_digest: sha('a'),
    script_manifest_digest: sha('b'),
    primary_authority_proven: true,
    atomic_script_proven: true,
    critical_alert_open: false,
    receipt_ref: `canary_${epoch}`,
  };
}

test('restart begins RECOVERING and requires three monotonic full canaries', () => {
  const start = Date.parse('2026-07-27T20:00:00.000Z');
  const { controller, advance } = controllerHarness();
  assert.equal(controller.snapshot().state, 'RECOVERING');
  assert.equal(controller.snapshot().allowed_for_security, false);
  assert.equal(controller.observeCanary(proof(1, start)).state, 'RECOVERING');
  advance(5000);
  assert.equal(controller.observeCanary(proof(2, start + 5000)).state, 'RECOVERING');
  advance(5000);
  const healthy = controller.observeCanary(proof(3, start + 10000));
  assert.equal(healthy.state, 'HEALTHY');
  assert.equal(healthy.allowed_for_security, true);
  assert.equal(healthy.local_authority, false);
  assert.equal(healthy.local_allow_cache, false);
});

test('time regression or nonmonotonic canary epoch becomes PARTITIONED', () => {
  const start = Date.parse('2026-07-27T20:00:00.000Z');
  const { controller } = controllerHarness();
  controller.observeCanary(proof(2, start + 5000));
  const state = controller.observeCanary(proof(2, start));
  assert.equal(state.state, 'PARTITIONED');
  assert.equal(state.allowed_for_security, false);
  assert.equal(state.breaker_open, true);
});

test('three provider failures open the fail-closed breaker', () => {
  const { controller } = controllerHarness();
  assert.equal(controller.observeFailure('PROVIDER_TIMEOUT').state, 'DEGRADED');
  assert.equal(controller.observeFailure('PROVIDER_TIMEOUT').state, 'DEGRADED');
  const unavailable = controller.observeFailure('PROVIDER_TIMEOUT');
  assert.equal(unavailable.state, 'UNAVAILABLE');
  assert.equal(unavailable.breaker_open, true);
  assert.equal(unavailable.allowed_for_security, false);
  assert.equal(controller.denyPreflight().provider_probe_required, false);
});

test('emergency disable immediately removes prior health authority', () => {
  const start = Date.parse('2026-07-27T20:00:00.000Z');
  const { controller } = controllerHarness();
  controller.observeCanary(proof(1, start));
  controller.observeCanary(proof(2, start + 5000));
  controller.observeCanary(proof(3, start + 10000));
  assert.equal(controller.snapshot().state, 'HEALTHY');
  const disabled = controller.setEmergencyDisabled(true);
  assert.equal(disabled.state, 'UNCONFIGURED');
  assert.equal(disabled.allowed_for_security, false);
});

