import { deepFreeze, issue, validationResult } from '../validation.js';
import { VALIDATION_ERROR_CODES } from '../constants.js';

export const APPEND_STATUSES = Object.freeze([
  'APPENDED', 'IDEMPOTENT_REPLAY', 'IDENTITY_CONFLICT', 'IDEMPOTENCY_CONFLICT',
  'CONCURRENCY_CONFLICT', 'INVALID', 'SCOPE_DENIED', 'REFERENCE_CONFLICT',
]);

export class IntelligenceEventStore {
  append() { throw new Error('IntelligenceEventStore.append must be implemented'); }
  read() { throw new Error('IntelligenceEventStore.read must be implemented'); }
  queryBitemporal() { throw new Error('IntelligenceEventStore.queryBitemporal must be implemented'); }
}

export class DurableObjectVersionStore {
  appendVersion() { throw new Error('DurableObjectVersionStore.appendVersion must be implemented'); }
  readVersions() { throw new Error('DurableObjectVersionStore.readVersions must be implemented'); }
}

export function makeAppendResult(status, details = {}) {
  return deepFreeze({ ok: ['APPENDED', 'IDEMPOTENT_REPLAY'].includes(status), status,
    event_id: details.event_id ?? null, store_sequence: details.store_sequence ?? null,
    aggregate_sequence: details.aggregate_sequence ?? null, errors: details.errors ?? [],
    existing_event_id: details.existing_event_id ?? null });
}

export function validateAggregateKey(value) {
  const errors = [];
  if (!value || typeof value !== 'object') errors.push(issue(VALIDATION_ERROR_CODES.INVALID_TYPE, 'aggregate_key', 'aggregate_key must be explicit'));
  for (const key of ['tenant_id', 'aggregate_type', 'aggregate_id']) if (typeof value?.[key] !== 'string' || !value[key]) errors.push(issue(VALIDATION_ERROR_CODES.REQUIRED, `aggregate_key.${key}`, `${key} is required`));
  return validationResult('AggregateKey', errors, [], errors.length ? null : deepFreeze({ ...value }));
}

export function makeBitemporalQuery(value) {
  const errors = [];
  if (!value?.tenant_id) errors.push(issue(VALIDATION_ERROR_CODES.TENANT_REQUIRED, 'tenant_id', 'tenant-scoped query is required'));
  const normalized = errors.length ? null : deepFreeze({
    tenant_id: value.tenant_id, profile_id: value.profile_id ?? null, business_id: value.business_id ?? null,
    subscription_id: value.subscription_id ?? null, aggregate_key: value.aggregate_key ?? null,
    recorded_through_sequence: value.recorded_through_sequence ?? Number.MAX_SAFE_INTEGER,
    effective_from: value.effective_from ?? null, effective_to: value.effective_to ?? null,
  });
  return validationResult('BitemporalQuery', errors, [], normalized);
}
