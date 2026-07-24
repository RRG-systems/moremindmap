import { hashCanonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';

export const DURABLE_LIVE_SESSION_VERSION = '1.0.0';
export const DURABLE_RECORD_KINDS = Object.freeze([
  'checkpoint', 'projection', 'failure', 'unresolved', 'proposal', 'confirmation', 'promotion', 'migration',
  'retention_plan', 'deletion_tombstone', 'security_receipt',
]);

export function durableScopeKey(scope) {
  const required = ['tenant_id', 'profile_id', 'business_id', 'subscriber_id', 'session_id'];
  if (!required.every((key) => typeof scope?.[key] === 'string' && scope[key])) return null;
  return hashCanonicalJson(Object.fromEntries(required.map((key) => [key, scope[key]])));
}

export function buildDurableRecord({ kind, object_id, scope, value, version = 1, correlation_id, causation_id = null, recorded_at, privacy_classification = 'SUBSCRIBER_PRIVATE', deletion_epoch = 0 }) {
  if (!DURABLE_RECORD_KINDS.includes(kind) || !object_id || !durableScopeKey(scope) || !correlation_id || !recorded_at || !Number.isInteger(version) || version < 1 || !Number.isInteger(deletion_epoch) || deletion_epoch < 0) return null;
  const body = { schema_version: DURABLE_LIVE_SESSION_VERSION, kind, object_id, scope: structuredClone(scope), version, correlation_id, causation_id, recorded_at, privacy_classification, deletion_epoch, value: structuredClone(value) };
  return deepFreeze({ ...body, integrity_hash: hashCanonicalJson(body) });
}

export function validateDurableRecord(record) {
  if (!record || record.schema_version !== DURABLE_LIVE_SESSION_VERSION || !DURABLE_RECORD_KINDS.includes(record.kind) || !durableScopeKey(record.scope) || !Number.isInteger(record.deletion_epoch) || record.deletion_epoch < 0) return deepFreeze({ valid: false, code: 'INVALID_DURABLE_RECORD' });
  const body = { ...record }; delete body.integrity_hash;
  return deepFreeze(hashCanonicalJson(body) === record.integrity_hash ? { valid: true } : { valid: false, code: 'CORRUPTED_RECORD' });
}

export const durableSemanticHash = (value) => hashCanonicalJson(value);
