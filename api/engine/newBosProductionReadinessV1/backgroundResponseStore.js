const IDENTITY_SHA256 = /^[a-f0-9]{64}$/u;
const REQUEST_SHA256 = /^[a-f0-9]{64}$/u;

function keyFor(namespace, realizationIdentitySha256) {
  if (!String(namespace || '').startsWith('preview:new-bos:') && !String(namespace || '').startsWith('nonprod:new-bos:')) {
    throw new Error('new_bos_background_store_namespace_invalid');
  }
  if (!IDENTITY_SHA256.test(String(realizationIdentitySha256 || ''))) {
    throw new Error('new_bos_background_store_identity_invalid');
  }
  return `${namespace}:background-response:${realizationIdentitySha256}`;
}

function validateRecord(record, expectedIdentitySha256) {
  if (record?.version !== 'new_bos_background_response_checkpoint_v1') throw new Error('new_bos_background_store_version_invalid');
  if (record.realization_identity_sha256 !== expectedIdentitySha256) throw new Error('new_bos_background_store_identity_mismatch');
  if (!REQUEST_SHA256.test(record.scientific_request_sha256 || '')) throw new Error('new_bos_background_store_request_hash_invalid');
  if (typeof record.provider_response_id !== 'string' || !record.provider_response_id) throw new Error('new_bos_background_store_response_id_invalid');
  return Object.freeze(record);
}

export function createRedisNewBosBackgroundResponseStore({ redis, namespace, ttlMs = 86_400_000 } = {}) {
  if (typeof redis?.get !== 'function' || typeof redis?.set !== 'function') throw new Error('new_bos_background_store_redis_contract_invalid');
  if (!Number.isInteger(ttlMs) || ttlMs < 60_000) throw new Error('new_bos_background_store_ttl_invalid');
  return Object.freeze({
    async load({ realizationIdentitySha256 }) {
      const raw = await redis.get(keyFor(namespace, realizationIdentitySha256));
      if (!raw) return null;
      return validateRecord(JSON.parse(raw), realizationIdentitySha256);
    },
    async save({ realizationIdentitySha256, event }) {
      if (!event?.provider_response_id || !REQUEST_SHA256.test(event.scientific_request_sha256 || '')) return null;
      const key = keyFor(namespace, realizationIdentitySha256);
      const existingRaw = await redis.get(key);
      if (existingRaw) {
        const existing = validateRecord(JSON.parse(existingRaw), realizationIdentitySha256);
        if (existing.provider_response_id !== event.provider_response_id
          || existing.scientific_request_sha256 !== event.scientific_request_sha256) {
          throw new Error('new_bos_background_store_checkpoint_conflict');
        }
      }
      const record = Object.freeze({
        version: 'new_bos_background_response_checkpoint_v1',
        realization_identity_sha256: realizationIdentitySha256,
        scientific_request_sha256: event.scientific_request_sha256,
        provider_response_id: event.provider_response_id,
        provider_status: event.status || null,
        poll_count: Number(event.poll_count) || 0,
        updated_at: event.observed_at || new Date().toISOString(),
      });
      await redis.set(key, JSON.stringify(record), 'PX', ttlMs);
      return record;
    },
  });
}
