import { deepFreeze } from '../validation.js';
import { hashCanonicalJson } from '../hashing.js';

export const PRODUCTION_FOUNDATION_VERSION = '1.0.0';
export const STORAGE_ERROR_CODES = Object.freeze(['INACTIVE', 'INVALID_SCOPE', 'UNAUTHORIZED', 'UNSUPPORTED_SCHEMA_VERSION', 'IDENTITY_CONFLICT', 'IDEMPOTENCY_CONFLICT', 'CONCURRENCY_CONFLICT', 'REFERENCE_CONFLICT', 'CORRUPTED_RECORD', 'PROJECTION_FAILURE', 'CHECKPOINT_FAILURE', 'QUARANTINED', 'UNAVAILABLE']);
export const PRODUCTION_EVENT_SCHEMA_VERSIONS = Object.freeze(['1.0.0']);
export const ACTOR_CLASSES = Object.freeze(['SUBSCRIBER', 'COACH', 'ADMIN', 'SYSTEM', 'MODEL_PROVIDER', 'RECOVERY_OPERATOR']);

export function productionScopeKey(scope) {
  if (!scope?.tenant_id || !scope.profile_id || !scope.business_id) return null;
  const digest = (value) => hashCanonicalJson(String(value)).slice(0, 20);
  return `if:v1:{${digest(scope.tenant_id)}}:profile:${digest(scope.profile_id)}:business:${digest(scope.business_id)}`;
}

export function validateProductionCommand(command) {
  const errors = [];
  if (!productionScopeKey(command)) errors.push({ code: 'INVALID_SCOPE' });
  for (const key of ['command_id', 'idempotency_key', 'correlation_id', 'actor_id', 'actor_class', 'command_type']) if (!command?.[key]) errors.push({ code: 'REQUIRED', field: key });
  if (command?.actor_class && !ACTOR_CLASSES.includes(command.actor_class)) errors.push({ code: 'INVALID_ACTOR_CLASS' });
  return deepFreeze({ valid: errors.length === 0, errors });
}

export function runtimeStoreKeys(scope) {
  const root = productionScopeKey(scope); if (!root) return null;
  return deepFreeze({ root, event_sequence: `${root}:events:sequence`, event_index: `${root}:events:index`, event_prefix: `${root}:event:`,
    projection_prefix: `${root}:projection:`, checkpoint_prefix: `${root}:checkpoint:`, idempotency_prefix: `${root}:idempotency:`,
    quarantine: `${root}:quarantine`, audit: `${root}:audit`, recovery: `${root}:recovery` });
}

export const TRANSACTION_BOUNDARY = deepFreeze({
  append: 'ONE_REDIS_ATOMIC_OPERATION_EVENT_SEQUENCE_EVENT_RECORD_INDEX_IDEMPOTENCY',
  projection: 'DERIVED_RETRYABLE_AFTER_AUTHORITATIVE_APPEND',
  concurrency: 'EXPECTED_AGGREGATE_SEQUENCE_COMPARE_AND_SET',
  recovery: 'REBUILD_DERIVED_STATE_FROM_EVENT_INDEX',
});
