import crypto from 'node:crypto';

import { sha256Stable } from './realizationIdentity.js';

const SHA256 = /^[a-f0-9]{64}$/u;
const UNIT_ID = /^[a-z0-9:_-]+$/u;
const ACTIVE = new Set(['queued', 'in_progress']);
const RETRYABLE_INCOMPLETE_REASONS = new Set(['max_output_tokens']);
const TRANSIENT_ERROR_CODES = new Set([
  'server_error',
  'service_unavailable',
  'transport_error',
  'timeout',
  'rate_limit_exhausted',
]);

function assertNamespace(namespace) {
  if (!String(namespace || '').startsWith('preview:new-bos:') && !String(namespace || '').startsWith('nonprod:new-bos:')) {
    throw new Error('new_bos_resumable_store_namespace_invalid');
  }
}

function assertIdentity(value, label) {
  if (!SHA256.test(String(value || ''))) throw new Error(`new_bos_resumable_store_${label}_invalid`);
}

function assertUnit(unitId) {
  if (!UNIT_ID.test(String(unitId || ''))) throw new Error('new_bos_resumable_store_unit_invalid');
}

function rootKey(namespace, campaignSha256, unitId) {
  assertNamespace(namespace);
  assertIdentity(campaignSha256, 'campaign_identity');
  assertUnit(unitId);
  return `${namespace}:resumable-v1:${campaignSha256}:unit:${unitId}`;
}

function terminalArchiveKey(key, attempt) {
  return `${key}:terminal-archive-v1:attempt:${attempt}`;
}

function parse(raw) {
  return raw ? JSON.parse(raw) : null;
}

function sanitizeObservation(event) {
  return Object.freeze({
    provider_response_id: event?.provider_response_id || null,
    provider_response_id_sha256: event?.provider_response_id
      ? crypto.createHash('sha256').update(event.provider_response_id).digest('hex')
      : null,
    provider_request_id_sha256: event?.provider_request_id
      ? crypto.createHash('sha256').update(event.provider_request_id).digest('hex')
      : null,
    status: event?.status || null,
    incomplete_details_reason: event?.incomplete_details_reason || null,
    error_code: event?.error_code || null,
    model: event?.model || null,
    service_tier: event?.service_tier || null,
    created_at: event?.created_at || null,
    completed_at: event?.completed_at || null,
    observed_at: event?.observed_at || new Date().toISOString(),
    poll_count: Number(event?.poll_count) || 0,
    usage: event?.usage || null,
  });
}

function classify(record) {
  if (!record) return Object.freeze({ state: 'MISSING', disposition: 'START_INITIAL' });
  if (record.state === 'ACCEPTED') return Object.freeze({ state: 'ACCEPTED', disposition: 'REUSE_ACCEPTED' });
  if (record.state === 'SUBMISSION_INTENT' && !record.observation?.provider_response_id) {
    return Object.freeze({ state: 'HUMAN_REVIEW_REQUIRED', disposition: 'STOP', reason: 'response_id_custody_unconfirmed' });
  }
  const status = record.observation?.status;
  if (ACTIVE.has(status)) return Object.freeze({ state: status === 'queued' ? 'QUEUED' : 'IN_PROGRESS', disposition: 'RESUME_EXACT' });
  if (status === 'completed') {
    return Object.freeze({ state: 'HUMAN_REVIEW_REQUIRED', disposition: 'STOP', reason: 'completed_result_not_accepted' });
  }
  if (status === 'incomplete') {
    const reason = record.observation?.incomplete_details_reason || 'incomplete_reason_missing';
    if (RETRYABLE_INCOMPLETE_REASONS.has(reason)) {
      return record.attempt >= 2
        ? Object.freeze({ state: 'TERMINAL_EXHAUSTED', disposition: 'STOP', reason })
        : Object.freeze({ state: 'TERMINAL_RETRYABLE', disposition: 'START_REPLACEMENT', reason });
    }
    return Object.freeze({
      state: 'HUMAN_REVIEW_REQUIRED',
      disposition: 'STOP',
      reason,
    });
  }
  if (status === 'failed' && TRANSIENT_ERROR_CODES.has(record.observation?.error_code)) {
    return record.attempt >= 2
      ? Object.freeze({ state: 'TERMINAL_EXHAUSTED', disposition: 'STOP', reason: record.observation.error_code })
      : Object.freeze({ state: 'TERMINAL_RETRYABLE', disposition: 'START_REPLACEMENT', reason: record.observation.error_code });
  }
  if (['failed', 'cancelled'].includes(status)) {
    return Object.freeze({ state: 'HUMAN_REVIEW_REQUIRED', disposition: 'STOP', reason: record.observation?.error_code || status });
  }
  if (record.state === 'SEMANTIC_REJECTED') return Object.freeze({ state: 'SEMANTIC_REJECTED', disposition: 'STOP' });
  return Object.freeze({ state: 'HUMAN_REVIEW_REQUIRED', disposition: 'STOP', reason: 'unknown_terminal_state' });
}

export function createRedisNewBosResumableGenerationStore({ redis, namespace } = {}) {
  if (typeof redis?.get !== 'function' || typeof redis?.set !== 'function') {
    throw new Error('new_bos_resumable_store_redis_contract_invalid');
  }
  assertNamespace(namespace);

  async function read({ campaignSha256, unitId }) {
    return parse(await redis.get(rootKey(namespace, campaignSha256, unitId)));
  }

  async function prepare({ campaignSha256, unitId, unitIdentitySha256, requestSha256 }) {
    assertIdentity(unitIdentitySha256, 'unit_identity');
    assertIdentity(requestSha256, 'request_hash');
    const key = rootKey(namespace, campaignSha256, unitId);
    const existing = parse(await redis.get(key));
    if (existing) {
      if (existing.unit_identity_sha256 !== unitIdentitySha256) throw new Error('new_bos_resumable_store_unit_identity_mismatch');
      if (existing.request_sha256 !== requestSha256) throw new Error('new_bos_resumable_store_request_hash_mismatch');
      const classification = classify(existing);
      if (classification.disposition === 'START_REPLACEMENT') {
        const claimKey = `${key}:replacement-claim-v1`;
        const archiveKey = terminalArchiveKey(key, existing.attempt);
        const archived = Object.freeze({
          version: 'new_bos_resumable_terminal_archive_v1',
          campaign_sha256: campaignSha256,
          unit_id: unitId,
          unit_identity_sha256: existing.unit_identity_sha256,
          request_sha256: existing.request_sha256,
          state: existing.state,
          attempt: existing.attempt,
          observation: existing.observation || null,
          semantic_rejection_code: existing.semantic_rejection_code || null,
          archived_at: existing.updated_at || existing.observation?.observed_at || existing.created_at,
          replacement_authorized: true,
        });
        const archiveSerialized = JSON.stringify(archived);
        const archiveResult = await redis.set(archiveKey, archiveSerialized, 'NX');
        if (archiveResult !== 'OK' && await redis.get(archiveKey) !== archiveSerialized) {
          return Object.freeze({ disposition: 'STOP', classification: Object.freeze({ state: 'TERMINAL_EXHAUSTED', reason: 'terminal_archive_conflict' }) });
        }
        const claim = Object.freeze({
          version: 'new_bos_resumable_replacement_claim_v1',
          campaign_sha256: campaignSha256,
          unit_id: unitId,
          unit_identity_sha256: unitIdentitySha256,
          request_sha256: requestSha256,
          prior_attempt: existing.attempt,
          claimed_at: new Date().toISOString(),
        });
        const claimed = await redis.set(claimKey, JSON.stringify(claim), 'NX');
        if (claimed !== 'OK') return Object.freeze({ disposition: 'STOP', classification: Object.freeze({ state: 'TERMINAL_EXHAUSTED', reason: 'replacement_claim_conflict' }) });
        const intent = Object.freeze({
          ...claim,
          version: 'new_bos_resumable_unit_checkpoint_v1',
          state: 'SUBMISSION_INTENT',
          attempt: 2,
          claim_token_sha256: sha256Stable(crypto.randomUUID()),
          observation: null,
        });
        await redis.set(key, JSON.stringify(intent));
        return Object.freeze({ disposition: 'START_REPLACEMENT', record: intent, classification });
      }
      return Object.freeze({ disposition: classification.disposition, record: existing, classification });
    }

    const intent = Object.freeze({
      version: 'new_bos_resumable_unit_checkpoint_v1',
      campaign_sha256: campaignSha256,
      unit_id: unitId,
      unit_identity_sha256: unitIdentitySha256,
      request_sha256: requestSha256,
      state: 'SUBMISSION_INTENT',
      attempt: 1,
      claim_token_sha256: sha256Stable(crypto.randomUUID()),
      observation: null,
      created_at: new Date().toISOString(),
    });
    const claimed = await redis.set(key, JSON.stringify(intent), 'NX');
    if (claimed !== 'OK') return prepare({ campaignSha256, unitId, unitIdentitySha256, requestSha256 });
    return Object.freeze({ disposition: 'START_INITIAL', record: intent, classification: classify(null) });
  }

  return Object.freeze({
    async inspect({ campaignSha256, unitId }) {
      const record = await read({ campaignSha256, unitId });
      return Object.freeze({ record, classification: classify(record) });
    },

    prepare,

    async observe({ campaignSha256, unitId, unitIdentitySha256, requestSha256, event }) {
      const key = rootKey(namespace, campaignSha256, unitId);
      const existing = parse(await redis.get(key));
      if (!existing) throw new Error('new_bos_resumable_store_observation_without_intent');
      if (existing.unit_identity_sha256 !== unitIdentitySha256) throw new Error('new_bos_resumable_store_unit_identity_mismatch');
      if (existing.request_sha256 !== requestSha256) throw new Error('new_bos_resumable_store_request_hash_mismatch');
      const observation = sanitizeObservation(event);
      const next = Object.freeze({
        ...existing,
        state: ACTIVE.has(observation.status)
          ? observation.status.toUpperCase()
          : observation.status === 'completed'
            ? 'PROVIDER_COMPLETED'
            : 'TERMINAL',
        observation,
        updated_at: observation.observed_at,
      });
      await redis.set(key, JSON.stringify(next));
      return next;
    },

    async accept({ campaignSha256, unitId, unitIdentitySha256, requestSha256, value }) {
      const key = rootKey(namespace, campaignSha256, unitId);
      const existing = parse(await redis.get(key));
      if (!existing) throw new Error('new_bos_resumable_store_accept_without_intent');
      if (existing.unit_identity_sha256 !== unitIdentitySha256) throw new Error('new_bos_resumable_store_unit_identity_mismatch');
      if (existing.request_sha256 !== requestSha256) throw new Error('new_bos_resumable_store_request_hash_mismatch');
      const valueSha256 = sha256Stable(value);
      if (existing.state === 'ACCEPTED') {
        if (existing.accepted_value_sha256 !== valueSha256) throw new Error('new_bos_resumable_store_accepted_value_conflict');
        return existing;
      }
      const accepted = Object.freeze({
        ...existing,
        state: 'ACCEPTED',
        accepted_value: value,
        accepted_value_sha256: valueSha256,
        accepted_at: new Date().toISOString(),
      });
      await redis.set(key, JSON.stringify(accepted));
      return accepted;
    },

    async rejectSemantic({ campaignSha256, unitId, unitIdentitySha256, requestSha256, code }) {
      const key = rootKey(namespace, campaignSha256, unitId);
      const existing = parse(await redis.get(key));
      if (!existing) throw new Error('new_bos_resumable_store_reject_without_intent');
      if (existing.unit_identity_sha256 !== unitIdentitySha256 || existing.request_sha256 !== requestSha256) {
        throw new Error('new_bos_resumable_store_reject_identity_mismatch');
      }
      const rejected = Object.freeze({
        ...existing,
        state: 'SEMANTIC_REJECTED',
        semantic_rejection_code: String(code || 'semantic_validation_failed'),
        rejected_at: new Date().toISOString(),
      });
      await redis.set(key, JSON.stringify(rejected));
      return rejected;
    },
  });
}
