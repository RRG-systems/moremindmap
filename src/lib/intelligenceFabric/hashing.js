import { sha256Text } from '../canonicalSha256.js';
import { HASH_ALGORITHM, HASH_VERSION } from './constants.js';

function canonicalize(value, seen) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical JSON rejects non-finite numbers');
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== 'object' || value === undefined) throw new TypeError('Canonical JSON rejects undefined, functions, symbols, and bigint');
  if (seen.has(value)) throw new TypeError('Canonical JSON rejects circular structures');
  seen.add(value);
  const result = Array.isArray(value)
    ? value.map((entry) => canonicalize(entry, seen))
    : Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key], seen)]));
  seen.delete(value);
  return result;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value, new Set()));
}

export function hashCanonicalJson(value) {
  if (HASH_ALGORITHM !== 'sha256') throw new TypeError('Unsupported canonical hash algorithm');
  return sha256Text(canonicalJson(value));
}

export function createPayloadHash(payload) {
  return `${HASH_ALGORITHM}:${HASH_VERSION}:${hashCanonicalJson(payload)}`;
}

export function isValidPayloadHash(hash) {
  return typeof hash === 'string' && /^sha256:canonical-json-v1:[a-f0-9]{64}$/.test(hash);
}

export function compareIdempotentEvents(left, right) {
  if (!left || !right || left.idempotency_key !== right.idempotency_key) return Object.freeze({ status: 'DISTINCT', conflict: false });
  const same = left.payload_hash === right.payload_hash && left.event_type === right.event_type && left.tenant_id === right.tenant_id;
  return Object.freeze({ status: same ? 'DUPLICATE_SAFE' : 'DUPLICATE_CONFLICT', conflict: !same });
}

export function compareImmutableFields(before, after, fields = ['event_id', 'event_type', 'schema_version', 'payload_hash', 'recorded_at']) {
  const changed_fields = fields.filter((field) => canonicalJson(before?.[field] ?? null) !== canonicalJson(after?.[field] ?? null));
  return Object.freeze({ immutable: changed_fields.length === 0, changed_fields });
}
