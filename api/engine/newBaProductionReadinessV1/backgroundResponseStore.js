import { normalizeProfileId } from './stable.js';

const SHA256 = /^[a-f0-9]{64}$/u;
const STAGES = new Set(['whole_business_model_v1', 'five_futures_v2', 'one_move_v2']);

function keyFor(namespace, profileId, generationIdentitySha256, stage) {
  if (!String(namespace || '').includes(':new-ba:')) throw new Error('new_ba_background_store_namespace_invalid');
  if (!SHA256.test(String(generationIdentitySha256 || ''))) throw new Error('new_ba_background_store_identity_invalid');
  if (!STAGES.has(stage)) throw new Error('new_ba_background_store_stage_invalid');
  return `${namespace}:real-profile-generation-v1:${normalizeProfileId(profileId)}:background-response:${generationIdentitySha256}:${stage}`;
}

function validateRecord(record, { profileId, generationIdentitySha256, stage }) {
  if (record?.version !== 'new_ba_background_response_checkpoint_v1') throw new Error('new_ba_background_store_version_invalid');
  if (record.profile_id !== normalizeProfileId(profileId) || record.generation_identity_sha256 !== generationIdentitySha256 || record.stage !== stage) {
    throw new Error('new_ba_background_store_identity_mismatch');
  }
  if (!SHA256.test(record.scientific_request_sha256 || '')) throw new Error('new_ba_background_store_request_hash_invalid');
  if (typeof record.provider_response_id !== 'string' || !record.provider_response_id) throw new Error('new_ba_background_store_response_id_invalid');
  return Object.freeze(record);
}

export function createRedisNewBaBackgroundResponseStore({ redis, namespace, ttlMs = 86_400_000 } = {}) {
  if (typeof redis?.get !== 'function' || typeof redis?.set !== 'function') throw new Error('new_ba_background_store_redis_contract_invalid');
  if (!Number.isInteger(ttlMs) || ttlMs < 60_000) throw new Error('new_ba_background_store_ttl_invalid');
  return Object.freeze({
    async load({ profileId, generationIdentitySha256, stage }) {
      const raw = await redis.get(keyFor(namespace, profileId, generationIdentitySha256, stage));
      return raw ? validateRecord(JSON.parse(raw), { profileId, generationIdentitySha256, stage }) : null;
    },
    async save({ profileId, generationIdentitySha256, stage, event }) {
      if (!event?.provider_response_id || !SHA256.test(event.scientific_request_sha256 || '')) return null;
      const key = keyFor(namespace, profileId, generationIdentitySha256, stage);
      const expected = { profileId, generationIdentitySha256, stage };
      const existingRaw = await redis.get(key);
      if (existingRaw) {
        const existing = validateRecord(JSON.parse(existingRaw), expected);
        if (existing.provider_response_id !== event.provider_response_id || existing.scientific_request_sha256 !== event.scientific_request_sha256) {
          throw new Error('new_ba_background_store_checkpoint_conflict');
        }
      }
      const record = Object.freeze({
        version: 'new_ba_background_response_checkpoint_v1',
        profile_id: normalizeProfileId(profileId),
        generation_identity_sha256: generationIdentitySha256,
        stage,
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
