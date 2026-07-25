import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REQUIRED_MONITORING_EVENT_TYPES,
  createSyntheticMonitoringEvent,
  emitSyntheticAlert,
  monitoringCoverage,
  validateAlertReceipt,
  validateMonitoringEvent,
} from '../src/lib/intelligenceFabric/coachConnect/deploymentReadiness/monitoring.js';

test('all critical monitoring domains are covered with privacy-safe events', () => {
  const events = REQUIRED_MONITORING_EVENT_TYPES.map((eventType, index) => createSyntheticMonitoringEvent({
    event_id: `event-${index}`,
    event_type: eventType,
  }));
  assert.equal(events.every((event) => validateMonitoringEvent(event).valid), true);
  assert.deepEqual(monitoringCoverage(events), {
    healthy: true,
    missing: [],
    activation_permitted: false,
  });
});

test('missing monitoring domain blocks readiness', () => {
  const result = monitoringCoverage([createSyntheticMonitoringEvent()]);
  assert.equal(result.healthy, false);
  assert.equal(result.activation_permitted, false);
});

test('synthetic P0 canary is delivered and acknowledged without live sink', () => {
  const result = emitSyntheticAlert(createSyntheticMonitoringEvent());
  assert.equal(result.valid, true);
  assert.equal(validateAlertReceipt(result.receipt).valid, true);
  assert.equal(result.receipt.delivery_mode, 'SYNTHETIC');
  assert.equal(result.receipt.contains_sensitive_material, false);
});

test('undelivered P0 and internal-live delivery fail', () => {
  const event = createSyntheticMonitoringEvent();
  assert.equal(emitSyntheticAlert(event, { status: 'DELIVERY_FAILED' }).valid, false);
  assert.equal(emitSyntheticAlert(event, { delivery_mode: 'INTERNAL_LIVE' }).valid, false);
});

test('sensitive telemetry canaries are rejected', () => {
  for (const mutation of [
    { email: 'sensitive-canary' },
    { transcript: 'sensitive-canary' },
    { access_token: 'sensitive-canary' },
    { profile_id: 'sensitive-canary' },
    { client_address: 'sensitive-canary' },
  ]) assert.equal(validateMonitoringEvent(createSyntheticMonitoringEvent(mutation)).valid, false);
});
