import { classifyProviderCheckpoint } from '../realizationRecoveryV1/recoveryContract.js';

const IDENTITY_SHA256 = /^[a-f0-9]{64}$/u;
const REQUEST_SHA256 = /^[a-f0-9]{64}$/u;
const TERMINAL_STATUSES = new Set(['failed', 'cancelled', 'incomplete']);

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

function recoveryKey(namespace, realizationIdentitySha256) {
  return `${keyFor(namespace, realizationIdentitySha256)}:automatic-recovery-v1`;
}

function archiveKey(namespace, realizationIdentitySha256, responseId) {
  return `${keyFor(namespace, realizationIdentitySha256)}:terminal-archive:${responseId}`;
}

export function createRedisNewBosBackgroundResponseStore({ redis, namespace, ttlMs = 86_400_000, onRecoveryEvent = async () => {} } = {}) {
  if (typeof redis?.get !== 'function' || typeof redis?.set !== 'function') throw new Error('new_bos_background_store_redis_contract_invalid');
  if (!Number.isInteger(ttlMs) || ttlMs < 60_000) throw new Error('new_bos_background_store_ttl_invalid');
  if (typeof onRecoveryEvent !== 'function') throw new Error('new_bos_background_store_recovery_observer_invalid');
  return Object.freeze({
    async load({ realizationIdentitySha256 }) {
      const raw = await redis.get(keyFor(namespace, realizationIdentitySha256));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.version === 'realization_terminal_checkpoint_retired_v1') return null;
      return validateRecord(parsed, realizationIdentitySha256);
    },
    async prepare({ realizationIdentitySha256 }) {
      const key = keyFor(namespace, realizationIdentitySha256);
      const raw = await redis.get(key);
      if (!raw) {
        const priorRecovery = await redis.get(recoveryKey(namespace, realizationIdentitySha256));
        if (priorRecovery) throw new Error('new_bos_background_automatic_recovery_exhausted');
        return Object.freeze({ disposition: 'start_new', checkpoint: null, recovery: classifyProviderCheckpoint(null) });
      }
      const parsed = JSON.parse(raw);
      if (parsed?.version === 'realization_terminal_checkpoint_retired_v1') {
        throw new Error('new_bos_background_automatic_recovery_claim_incomplete');
      }
      const checkpoint = validateRecord(parsed, realizationIdentitySha256);
      const recovery = classifyProviderCheckpoint(checkpoint);
      if (!TERMINAL_STATUSES.has(checkpoint.provider_status)) {
        if (!recovery.resumable) throw new Error('new_bos_background_checkpoint_human_review_required');
        return Object.freeze({ disposition: 'resume', checkpoint, recovery });
      }

      const claim = Object.freeze({
        version: 'realization_automatic_recovery_claim_v1',
        realization_identity_sha256: realizationIdentitySha256,
        terminal_provider_status: checkpoint.provider_status,
        terminal_response_id: checkpoint.provider_response_id,
        claimed_at: new Date().toISOString(),
        maximum_replacement_submissions: 1,
      });
      const claimed = await redis.set(recoveryKey(namespace, realizationIdentitySha256), JSON.stringify(claim), 'NX');
      if (claimed !== 'OK') {
        await onRecoveryEvent(Object.freeze({ event_type: 'automatic_recovery_exhausted', provider_status: checkpoint.provider_status, human_review_required: true }));
        throw new Error('new_bos_background_automatic_recovery_exhausted');
      }
      const archive = Object.freeze({
        ...checkpoint,
        version: 'new_bos_terminal_checkpoint_archive_v1',
        archived_at: claim.claimed_at,
        raw_provider_payload_persisted: false,
      });
      await redis.set(archiveKey(namespace, realizationIdentitySha256, checkpoint.provider_response_id), JSON.stringify(archive), 'NX');
      const tombstone = Object.freeze({
        version: 'realization_terminal_checkpoint_retired_v1',
        realization_identity_sha256: realizationIdentitySha256,
        scientific_request_sha256: checkpoint.scientific_request_sha256,
        retired_provider_response_id: checkpoint.provider_response_id,
        retired_provider_status: checkpoint.provider_status,
        retired_at: claim.claimed_at,
        replacement_authorized: true,
      });
      await redis.set(key, JSON.stringify(tombstone), 'PX', ttlMs);
      await onRecoveryEvent(Object.freeze({
        event_type: 'terminal_checkpoint_retired',
        provider_status: checkpoint.provider_status,
        incomplete_details_reason: checkpoint.incomplete_details_reason || null,
        usage: checkpoint.usage || null,
        replacement_authorized: true,
        raw_provider_payload_persisted: false,
      }));
      return Object.freeze({ disposition: 'start_replacement', checkpoint: null, recovery, archive });
    },
    async save({ realizationIdentitySha256, event }) {
      if (!event?.provider_response_id || !REQUEST_SHA256.test(event.scientific_request_sha256 || '')) return null;
      const key = keyFor(namespace, realizationIdentitySha256);
      const existingRaw = await redis.get(key);
      if (existingRaw) {
        const parsed = JSON.parse(existingRaw);
        if (parsed?.version === 'realization_terminal_checkpoint_retired_v1') {
          if (parsed.scientific_request_sha256 !== event.scientific_request_sha256) {
            throw new Error('new_bos_background_store_replacement_request_hash_mismatch');
          }
        } else {
          const existing = validateRecord(parsed, realizationIdentitySha256);
          if (existing.provider_response_id !== event.provider_response_id
            || existing.scientific_request_sha256 !== event.scientific_request_sha256) {
            throw new Error('new_bos_background_store_checkpoint_conflict');
          }
        }
      }
      const record = Object.freeze({
        version: 'new_bos_background_response_checkpoint_v1',
        realization_identity_sha256: realizationIdentitySha256,
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
