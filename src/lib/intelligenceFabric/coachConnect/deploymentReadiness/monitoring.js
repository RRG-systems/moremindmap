import { CONTRACT_VERSIONS, FAILURE_CODES } from './constants.js';
import {
  hasSensitiveKey,
  isObject,
  isOpaque,
  isTimestamp,
  requireFields,
  requireVersion,
  validationResult,
} from './contracts.js';

export const REQUIRED_MONITORING_EVENT_TYPES = Object.freeze([
  'SERVICE_HEALTH',
  'SECURITY_STATE_HEALTH',
  'AUTHENTICATION_FAILURE',
  'AUTHORIZATION_FAILURE',
  'REPLAY_FAILURE',
  'CSRF_FAILURE',
  'TENANT_ISOLATION_VIOLATION',
  'DELETION_FAILURE',
  'RETENTION_FAILURE',
  'PERSISTENCE_FAILURE',
  'PROVIDER_FAILURE',
  'ACTIVATION_GATE_VIOLATION',
]);

export function validateMonitoringEvent(value) {
  const errors = [];
  if (!isObject(value)) return validationResult([{ code: 'MONITORING_NOT_PROVEN', field: '$' }], value);
  requireVersion(errors, value, 'monitoring_contract_version', 'monitoring');
  requireFields(errors, value, [
    'event_id', 'event_type', 'severity', 'environment_id', 'artifact_ref',
    'configuration_ref', 'gate_ref', 'scope_hash', 'correlation_id', 'outcome',
    'failure_code', 'count', 'latency_ms', 'occurred_at', 'privacy_classification',
  ], 'MONITORING_NOT_PROVEN');
  if (!REQUIRED_MONITORING_EVENT_TYPES.includes(value.event_type)
    || !['P0', 'P1', 'P2'].includes(value.severity)
    || !FAILURE_CODES.includes(value.failure_code)
    || !isOpaque(value.event_id)
    || !isOpaque(value.environment_id)
    || !isTimestamp(value.occurred_at)
    || !Number.isInteger(value.count)
    || !Number.isFinite(value.latency_ms)
    || value.privacy_classification !== 'CONTENT_FREE_OPERATIONAL') {
    errors.push({ code: 'MONITORING_NOT_PROVEN', field: 'classification' });
  }
  if (hasSensitiveKey(value)) errors.push({ code: 'PRIVACY_UNSAFE_TELEMETRY', field: '$' });
  return validationResult(errors, value);
}

export function validateAlertReceipt(value) {
  const errors = [];
  if (!isObject(value)) return validationResult([{ code: 'CRITICAL_ALERT_UNDETECTED', field: '$' }], value);
  requireVersion(errors, value, 'alert_receipt_version', 'alert');
  requireFields(errors, value, [
    'alert_receipt_id', 'monitoring_event_ref', 'severity', 'owner_role',
    'delivery_adapter_class', 'delivery_mode', 'injected_at', 'acknowledged_at',
    'latency_ms', 'deduplication_key', 'status', 'contains_sensitive_material',
  ], 'CRITICAL_ALERT_UNDETECTED');
  if (value.delivery_adapter_class !== 'SYNTHETIC_PROVIDER_NEUTRAL_ALERT_ADAPTER'
    || value.delivery_mode !== 'SYNTHETIC'
    || value.status !== 'ACKNOWLEDGED'
    || value.contains_sensitive_material !== false
    || !isTimestamp(value.injected_at)
    || !isTimestamp(value.acknowledged_at)
    || Date.parse(value.injected_at) > Date.parse(value.acknowledged_at)
    || !Number.isFinite(value.latency_ms)
    || value.latency_ms < 0) {
    errors.push({ code: 'CRITICAL_ALERT_UNDETECTED', field: 'delivery' });
  }
  if (hasSensitiveKey(value)) errors.push({ code: 'PRIVACY_UNSAFE_TELEMETRY', field: '$' });
  return validationResult(errors, value);
}

export function createSyntheticMonitoringEvent(overrides = {}) {
  return Object.freeze({
    monitoring_contract_version: CONTRACT_VERSIONS.monitoring,
    event_id: 'event-synthetic-p0',
    event_type: 'ACTIVATION_GATE_VIOLATION',
    severity: 'P0',
    environment_id: 'offline-readiness',
    artifact_ref: 'artifact-reference',
    configuration_ref: 'configuration-reference',
    gate_ref: 'gate-reference',
    scope_hash: 'scope-hash-redacted',
    correlation_id: 'correlation-offline',
    outcome: 'DENIED',
    failure_code: 'ACTIVATION_BYPASS_DETECTED',
    count: 1,
    latency_ms: 0,
    occurred_at: '2026-07-25T00:00:00.000Z',
    privacy_classification: 'CONTENT_FREE_OPERATIONAL',
    ...overrides,
  });
}

export function emitSyntheticAlert(event, overrides = {}) {
  const validation = validateMonitoringEvent(event);
  if (!validation.valid) return Object.freeze({ valid: false, errors: validation.errors });
  const receipt = {
    alert_receipt_version: CONTRACT_VERSIONS.alert,
    alert_receipt_id: `alert-${event.event_id}`,
    monitoring_event_ref: event.event_id,
    severity: event.severity,
    owner_role: event.severity === 'P0' ? 'SECURITY_INCIDENT_COMMANDER' : 'SERVICE_OPERATOR',
    delivery_adapter_class: 'SYNTHETIC_PROVIDER_NEUTRAL_ALERT_ADAPTER',
    delivery_mode: 'SYNTHETIC',
    injected_at: event.occurred_at,
    acknowledged_at: event.occurred_at,
    latency_ms: 0,
    deduplication_key: `${event.event_type}:${event.failure_code}`,
    status: 'ACKNOWLEDGED',
    contains_sensitive_material: false,
    ...overrides,
  };
  return Object.freeze({ valid: validateAlertReceipt(receipt).valid, receipt: Object.freeze(receipt) });
}

export function monitoringCoverage(events) {
  const observed = new Set((events ?? []).filter((event) => validateMonitoringEvent(event).valid).map((event) => event.event_type));
  const missing = REQUIRED_MONITORING_EVENT_TYPES.filter((type) => !observed.has(type));
  return Object.freeze({
    healthy: missing.length === 0,
    missing: Object.freeze(missing),
    activation_permitted: false,
  });
}
