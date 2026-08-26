import { normalizeProfileId } from './stable.js';
import { classifyProviderCheckpoint } from '../realizationRecoveryV1/recoveryContract.js';

const SHA256 = /^[a-f0-9]{64}$/u;
const STAGES = new Set(['whole_business_model_v1', 'five_futures_v2', 'one_move_v2']);
const TERMINAL_STATUSES = new Set(['failed', 'cancelled', 'incomplete']);

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

function recoveryKey(namespace, profileId, generationIdentitySha256, stage) {
  return `${keyFor(namespace, profileId, generationIdentitySha256, stage)}:automatic-recovery-v1`;
}

function archiveKey(namespace, profileId, generationIdentitySha256, stage, responseId) {
  return `${keyFor(namespace, profileId, generationIdentitySha256, stage)}:terminal-archive:${responseId}`;
}

export function createRedisNewBaBackgroundResponseStore({ redis, namespace, ttlMs = 86_400_000, onRecoveryEvent = async () => {} } = {}) {
  if (typeof redis?.get !== 'function' || typeof redis?.set !== 'function') throw new Error('new_ba_background_store_redis_contract_invalid');
  if (!Number.isInteger(ttlMs) || ttlMs < 60_000) throw new Error('new_ba_background_store_ttl_invalid');
  if (typeof onRecoveryEvent !== 'function') throw new Error('new_ba_background_store_recovery_observer_invalid');
  return Object.freeze({
    async load({ profileId, generationIdentitySha256, stage }) {
      const raw = await redis.get(keyFor(namespace, profileId, generationIdentitySha256, stage));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.version === 'realization_terminal_checkpoint_retired_v1') return null;
      return validateRecord(parsed, { profileId, generationIdentitySha256, stage });
    },
    async prepare({ profileId, generationIdentitySha256, stage }) {
      const key = keyFor(namespace, profileId, generationIdentitySha256, stage);
      const raw = await redis.get(key);
      if (!raw) {
        const priorRecovery = await redis.get(recoveryKey(namespace, profileId, generationIdentitySha256, stage));
        if (priorRecovery) throw new Error('new_ba_background_automatic_recovery_exhausted');
        return Object.freeze({ disposition: 'start_new', checkpoint: null, recovery: classifyProviderCheckpoint(null) });
      }
      const parsed = JSON.parse(raw);
      if (parsed?.version === 'realization_terminal_checkpoint_retired_v1') {
        throw new Error('new_ba_background_automatic_recovery_claim_incomplete');
      }
      const expected = { profileId, generationIdentitySha256, stage };
      const checkpoint = validateRecord(parsed, expected);
      const recovery = classifyProviderCheckpoint(checkpoint);
      if (!TERMINAL_STATUSES.has(checkpoint.provider_status)) {
        if (!recovery.resumable) throw new Error('new_ba_background_checkpoint_human_review_required');
        return Object.freeze({ disposition: 'resume', checkpoint, recovery });
      }
      const claimedAt = new Date().toISOString();
      const claim = Object.freeze({
        version: 'realization_automatic_recovery_claim_v1',
        profile_id: normalizeProfileId(profileId),
        generation_identity_sha256: generationIdentitySha256,
        stage,
        terminal_provider_status: checkpoint.provider_status,
        terminal_response_id: checkpoint.provider_response_id,
        claimed_at: claimedAt,
        maximum_replacement_submissions: 1,
      });
      const claimed = await redis.set(recoveryKey(namespace, profileId, generationIdentitySha256, stage), JSON.stringify(claim), 'NX');
      if (claimed !== 'OK') {
        await onRecoveryEvent(Object.freeze({ event_type: 'automatic_recovery_exhausted', stage, provider_status: checkpoint.provider_status, human_review_required: true }));
        throw new Error('new_ba_background_automatic_recovery_exhausted');
      }
      const archive = Object.freeze({
        ...checkpoint,
        version: 'new_ba_terminal_checkpoint_archive_v1',
        archived_at: claimedAt,
        raw_provider_payload_persisted: false,
      });
      await redis.set(archiveKey(namespace, profileId, generationIdentitySha256, stage, checkpoint.provider_response_id), JSON.stringify(archive), 'NX');
      const tombstone = Object.freeze({
        version: 'realization_terminal_checkpoint_retired_v1',
        profile_id: normalizeProfileId(profileId),
        generation_identity_sha256: generationIdentitySha256,
        stage,
        scientific_request_sha256: checkpoint.scientific_request_sha256,
        retired_provider_response_id: checkpoint.provider_response_id,
        retired_provider_status: checkpoint.provider_status,
        retired_at: claimedAt,
        replacement_authorized: true,
      });
      await redis.set(key, JSON.stringify(tombstone), 'PX', ttlMs);
      await onRecoveryEvent(Object.freeze({
        event_type: 'terminal_checkpoint_retired',
        stage,
        provider_status: checkpoint.provider_status,
        incomplete_details_reason: checkpoint.incomplete_details_reason || null,
        usage: checkpoint.usage || null,
        replacement_authorized: true,
        raw_provider_payload_persisted: false,
      }));
      return Object.freeze({ disposition: 'start_replacement', checkpoint: null, recovery, archive });
    },
    async save({ profileId, generationIdentitySha256, stage, event }) {
      if (!event?.provider_response_id || !SHA256.test(event.scientific_request_sha256 || '')) return null;
      const key = keyFor(namespace, profileId, generationIdentitySha256, stage);
      const expected = { profileId, generationIdentitySha256, stage };
      const existingRaw = await redis.get(key);
      if (existingRaw) {
        const parsed = JSON.parse(existingRaw);
        if (parsed?.version === 'realization_terminal_checkpoint_retired_v1') {
          if (parsed.scientific_request_sha256 !== event.scientific_request_sha256) throw new Error('new_ba_background_store_replacement_request_hash_mismatch');
        } else {
          const existing = validateRecord(parsed, expected);
          if (existing.provider_response_id !== event.provider_response_id || existing.scientific_request_sha256 !== event.scientific_request_sha256) {
            throw new Error('new_ba_background_store_checkpoint_conflict');
          }
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
        incomplete_details_reason: event.incomplete_details_reason || null,
        usage: event.usage || null,
        updated_at: event.observed_at || new Date().toISOString(),
      });
      await redis.set(key, JSON.stringify(record), 'PX', ttlMs);
      return record;
    },
  });
}
