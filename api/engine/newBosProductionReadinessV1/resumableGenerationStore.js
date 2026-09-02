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
const STALE_ACTIVE_MINIMUM_AGE_MS = 30 * 60 * 1000;
const STALE_REPLACEMENT_UNIT = 'semantic:surface_routing';
const VECTOR_FREE_STAGE3_UNIT = 'semantic:whole_person_decision_synthesis';
const VECTOR_FREE_DEPENDENT_STAGE4_UNIT = 'semantic:surface_routing';

const RETIRE_INVALID_STAGE3_SCRIPT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 'STAGE3_CHANGED' end
if redis.call('GET', KEYS[2]) ~= ARGV[2] then return 'STAGE4_CHANGED' end
local prior_archive3 = redis.call('GET', KEYS[3])
if prior_archive3 and prior_archive3 ~= ARGV[3] then return 'STAGE3_ARCHIVE_CONFLICT' end
local prior_archive4 = redis.call('GET', KEYS[4])
if prior_archive4 and prior_archive4 ~= ARGV[4] then return 'STAGE4_ARCHIVE_CONFLICT' end
local prior_claim = redis.call('GET', KEYS[5])
if prior_claim and prior_claim ~= ARGV[7] then return 'CLAIM_CONFLICT' end
redis.call('SET', KEYS[3], ARGV[3])
redis.call('SET', KEYS[4], ARGV[4])
redis.call('SET', KEYS[1], ARGV[5])
redis.call('SET', KEYS[2], ARGV[6])
redis.call('SET', KEYS[5], ARGV[7])
return 'OK'
`;

const RETIRE_SEMANTIC_REJECTED_STAGE3_SCRIPT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 'STAGE3_CHANGED' end
local prior_archive = redis.call('GET', KEYS[2])
if prior_archive and prior_archive ~= ARGV[2] then return 'STAGE3_ARCHIVE_CONFLICT' end
local prior_claim = redis.call('GET', KEYS[3])
if prior_claim and prior_claim ~= ARGV[4] then return 'CLAIM_CONFLICT' end
redis.call('SET', KEYS[2], ARGV[2])
redis.call('SET', KEYS[1], ARGV[3])
redis.call('SET', KEYS[3], ARGV[4])
return 'OK'
`;

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

function replacementClaimKey(key, nextAttempt) {
  return nextAttempt === 2
    ? `${key}:replacement-claim-v1`
    : `${key}:replacement-claim-v1:attempt:${nextAttempt}`;
}

function staleActiveClaimKey(key) {
  return `${key}:stale-active-replacement-claim-v1:attempt:1`;
}

function staleActiveArchiveKey(key) {
  return `${key}:stale-active-archive-v1:attempt:1`;
}

function invalidSemanticArchiveKey(key) {
  return `${key}:invalid-semantic-archive-v1`;
}

function invalidStage3RepairClaimKey(namespace, campaignSha256) {
  return `${namespace}:resumable-v1:${campaignSha256}:invalid-stage3-vector-free-repair-v1`;
}

function semanticRejectedStage3ArchiveKey(key, attempt) {
  return `${key}:semantic-rejection-archive-v1:attempt:${attempt}`;
}

function semanticRejectedStage3ReplacementClaimKey(namespace, campaignSha256) {
  return `${namespace}:resumable-v1:${campaignSha256}:semantic-rejected-stage3-replacement-v1`;
}

function stage3RequestContractV2ClaimKey(namespace, campaignSha256) {
  return `${namespace}:resumable-v1:${campaignSha256}:stage3-vector-free-request-contract-v2-claim-v1`;
}

function parse(raw) {
  return raw ? JSON.parse(raw) : null;
}

function stableResponseIdSha256(responseId) {
  return crypto.createHash('sha256').update(String(responseId || '')).digest('hex');
}

function timestampMs(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : null;
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
  if (record.state === 'SEMANTIC_REJECTED') {
    return Object.freeze({
      state: 'SEMANTIC_REJECTED',
      disposition: 'STOP',
      reason: record.semantic_rejection_code || 'semantic_validation_failed',
    });
  }
  if (record.state === 'SUBMISSION_INTENT' && !record.observation?.provider_response_id) {
    return Object.freeze({ state: 'HUMAN_REVIEW_REQUIRED', disposition: 'STOP', reason: 'response_id_custody_unconfirmed' });
  }
  const status = record.observation?.status;
  if (ACTIVE.has(status)) return Object.freeze({ state: status === 'queued' ? 'QUEUED' : 'IN_PROGRESS', disposition: 'RESUME_EXACT' });
  if (record.retry_boundary === 'exactly_one_repaired_stage3_execution'
    && status
    && status !== 'completed') {
    return Object.freeze({
      state: 'TERMINAL_EXHAUSTED',
      disposition: 'STOP',
      reason: record.observation?.incomplete_details_reason || record.observation?.error_code || status,
    });
  }
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
  return Object.freeze({ state: 'HUMAN_REVIEW_REQUIRED', disposition: 'STOP', reason: 'unknown_terminal_state' });
}

function isMaxOutputThenServerErrorSequence({ current, attemptOneArchive } = {}) {
  return current?.attempt === 2
    && current?.observation?.status === 'failed'
    && current?.observation?.error_code === 'server_error'
    && attemptOneArchive?.version === 'new_bos_resumable_terminal_archive_v1'
    && attemptOneArchive?.attempt === 1
    && attemptOneArchive?.replacement_authorized === true
    && attemptOneArchive?.observation?.status === 'incomplete'
    && attemptOneArchive?.observation?.incomplete_details_reason === 'max_output_tokens'
    && attemptOneArchive?.campaign_sha256 === current?.campaign_sha256
    && attemptOneArchive?.unit_id === current?.unit_id
    && attemptOneArchive?.unit_identity_sha256 === current?.unit_identity_sha256
    && attemptOneArchive?.request_sha256 === current?.request_sha256;
}

async function classifyWithHistory({ redis, key, record } = {}) {
  const classification = classify(record);
  if (classification.state !== 'TERMINAL_EXHAUSTED'
    || classification.reason !== 'server_error'
    || record?.attempt !== 2) {
    return classification;
  }
  const attemptOneArchive = parse(await redis.get(terminalArchiveKey(key, 1)));
  if (!isMaxOutputThenServerErrorSequence({ current: record, attemptOneArchive })) {
    return classification;
  }
  return Object.freeze({
    state: 'TERMINAL_RETRYABLE',
    disposition: 'START_REPLACEMENT',
    reason: 'server_error',
    retry_sequence: 'max_output_tokens_to_server_error',
    final_attempt: 3,
  });
}

export function createRedisNewBosResumableGenerationStore({ redis, namespace } = {}) {
  if (typeof redis?.get !== 'function' || typeof redis?.set !== 'function') {
    throw new Error('new_bos_resumable_store_redis_contract_invalid');
  }
  assertNamespace(namespace);

  async function prepare({ campaignSha256, unitId, unitIdentitySha256, requestSha256 }) {
    assertIdentity(unitIdentitySha256, 'unit_identity');
    assertIdentity(requestSha256, 'request_hash');
    const key = rootKey(namespace, campaignSha256, unitId);
    const existing = parse(await redis.get(key));
    if (existing) {
      if (existing.state === 'DEPENDENCY_INVALIDATED') {
        if (unitId !== VECTOR_FREE_DEPENDENT_STAGE4_UNIT
          || existing.invalidated_by_unit !== VECTOR_FREE_STAGE3_UNIT
          || existing.replacement_reason !== 'stage3_vector_free_contract_violation') {
          throw new Error('new_bos_resumable_dependency_invalidation_not_authorized');
        }
        const intent = Object.freeze({
          version: 'new_bos_resumable_unit_checkpoint_v1',
          campaign_sha256: campaignSha256,
          unit_id: unitId,
          unit_identity_sha256: unitIdentitySha256,
          request_sha256: requestSha256,
          prior_attempt: existing.prior_attempt,
          next_attempt: existing.next_attempt,
          retry_sequence: 'stage3_vector_free_dependency_replacement',
          invalid_semantic_archive_sha256: existing.invalid_semantic_archive_sha256,
          invalidated_by_archive_sha256: existing.invalidated_by_archive_sha256,
          state: 'SUBMISSION_INTENT',
          attempt: existing.next_attempt,
          claim_token_sha256: sha256Stable(crypto.randomUUID()),
          observation: null,
          created_at: new Date().toISOString(),
        });
        await redis.set(key, JSON.stringify(intent));
        return Object.freeze({
          disposition: 'START_REPLACEMENT',
          record: intent,
          classification: Object.freeze({
            state: 'DEPENDENCY_INVALIDATED',
            disposition: 'START_REPLACEMENT',
            reason: 'stage3_vector_free_contract_violation',
          }),
        });
      }
      if (existing.unit_identity_sha256 !== unitIdentitySha256) throw new Error('new_bos_resumable_store_unit_identity_mismatch');
      if (existing.request_sha256 !== requestSha256) throw new Error('new_bos_resumable_store_request_hash_mismatch');
      const classification = await classifyWithHistory({ redis, key, record: existing });
      if (classification.disposition === 'START_REPLACEMENT') {
        const nextAttempt = existing.attempt + 1;
        const claimKey = replacementClaimKey(key, nextAttempt);
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
          next_attempt: nextAttempt,
          retry_sequence: classification.retry_sequence || null,
          claimed_at: new Date().toISOString(),
        });
        const claimed = await redis.set(claimKey, JSON.stringify(claim), 'NX');
        if (claimed !== 'OK') return Object.freeze({ disposition: 'STOP', classification: Object.freeze({ state: 'TERMINAL_EXHAUSTED', reason: 'replacement_claim_conflict' }) });
        const intent = Object.freeze({
          ...claim,
          version: 'new_bos_resumable_unit_checkpoint_v1',
          state: 'SUBMISSION_INTENT',
          attempt: nextAttempt,
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
      const key = rootKey(namespace, campaignSha256, unitId);
      const record = parse(await redis.get(key));
      return Object.freeze({ record, classification: await classifyWithHistory({ redis, key, record }) });
    },

    prepare,

    async retireSemanticRejectedStage3AndPrepareReplacement({
      campaignSha256,
      expectedStage3,
      now = new Date(),
    } = {}) {
      if (typeof redis?.eval !== 'function') throw new Error('new_bos_semantic_rejected_stage3_atomic_store_required');
      assertIdentity(expectedStage3?.unit_identity_sha256, 'semantic_rejected_stage3_unit_identity');
      assertIdentity(expectedStage3?.request_sha256, 'semantic_rejected_stage3_request_hash');
      assertIdentity(expectedStage3?.provider_response_id_sha256, 'semantic_rejected_stage3_provider_response_identity');
      assertIdentity(expectedStage3?.semantic_validation_code_sha256, 'semantic_rejected_stage3_validation_code');
      const key = rootKey(namespace, campaignSha256, VECTOR_FREE_STAGE3_UNIT);
      const existingSerialized = await redis.get(key);
      const existing = parse(existingSerialized);
      if (!existing
        || existing.state !== 'SEMANTIC_REJECTED'
        || existing.unit_id !== VECTOR_FREE_STAGE3_UNIT
        || existing.attempt !== 2
        || existing.observation?.status !== 'completed'
        || existing.unit_identity_sha256 !== expectedStage3.unit_identity_sha256
        || existing.request_sha256 !== expectedStage3.request_sha256
        || existing.observation?.provider_response_id_sha256 !== expectedStage3.provider_response_id_sha256
        || existing.semantic_rejection_code !== 'VECTOR_FREE_ASSESSMENT_LANGUAGE_REJECTION'
        || existing.semantic_validator !== 'assertVectorFreeWholePerson'
        || existing.semantic_rejection_detail !== 'ADAPTABILITY_LANGUAGE'
        || existing.semantic_validation_code_sha256 !== expectedStage3.semantic_validation_code_sha256) {
        throw new Error('new_bos_semantic_rejected_stage3_checkpoint_identity_mismatch');
      }
      const retiredAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
      const archive = Object.freeze({
        version: 'new_bos_resumable_semantic_rejection_archive_v1',
        campaign_sha256: campaignSha256,
        unit_id: VECTOR_FREE_STAGE3_UNIT,
        prior_checkpoint_sha256: sha256Stable(existing),
        prior_checkpoint: existing,
        prior_attempt: existing.attempt,
        semantic_rejection_code: existing.semantic_rejection_code,
        semantic_validator: existing.semantic_validator,
        semantic_rejection_detail: existing.semantic_rejection_detail,
        semantic_validation_code_sha256: existing.semantic_validation_code_sha256,
        retired_at: retiredAt,
        replacement_authorized: true,
        replacement_authority: 'founder_exactly_one_stage3_semantic_rejection_replacement',
      });
      const archiveSha256 = sha256Stable(archive);
      const intent = Object.freeze({
        version: 'new_bos_resumable_unit_checkpoint_v1',
        campaign_sha256: campaignSha256,
        unit_id: VECTOR_FREE_STAGE3_UNIT,
        unit_identity_sha256: existing.unit_identity_sha256,
        request_sha256: existing.request_sha256,
        prior_attempt: existing.attempt,
        next_attempt: 3,
        retry_sequence: 'authorized_stage3_semantic_rejection_replacement',
        semantic_rejection_archive_sha256: archiveSha256,
        state: 'SUBMISSION_INTENT',
        attempt: 3,
        claim_token_sha256: sha256Stable(crypto.randomUUID()),
        observation: null,
        created_at: retiredAt,
      });
      const claim = Object.freeze({
        version: 'new_bos_semantic_rejected_stage3_replacement_claim_v1',
        campaign_sha256: campaignSha256,
        unit_id: VECTOR_FREE_STAGE3_UNIT,
        prior_checkpoint_sha256: archive.prior_checkpoint_sha256,
        semantic_rejection_archive_sha256: archiveSha256,
        prior_attempt: 2,
        next_attempt: 3,
        claimed_at: retiredAt,
      });
      const result = await redis.eval(
        RETIRE_SEMANTIC_REJECTED_STAGE3_SCRIPT,
        3,
        key,
        semanticRejectedStage3ArchiveKey(key, existing.attempt),
        semanticRejectedStage3ReplacementClaimKey(namespace, campaignSha256),
        existingSerialized,
        JSON.stringify(archive),
        JSON.stringify(intent),
        JSON.stringify(claim),
      );
      if (result !== 'OK') throw new Error(`new_bos_semantic_rejected_stage3_atomic_retirement_failed:${result}`);
      return Object.freeze({
        disposition: 'START_STAGE3_REPLACEMENT',
        record: intent,
        archive_sha256: archiveSha256,
        prior_checkpoint_sha256: archive.prior_checkpoint_sha256,
      });
    },

    async archiveRejectedStage3AndPrepareRequestContractV2({
      campaignSha256,
      expectedStage3,
      nextStage3,
      now = new Date(),
    } = {}) {
      if (typeof redis?.eval !== 'function') throw new Error('new_bos_stage3_request_contract_v2_atomic_store_required');
      assertIdentity(expectedStage3?.unit_identity_sha256, 'stage3_request_v1_unit_identity');
      assertIdentity(expectedStage3?.request_sha256, 'stage3_request_v1_request_hash');
      assertIdentity(expectedStage3?.provider_response_id_sha256, 'stage3_request_v1_provider_response_identity');
      assertIdentity(expectedStage3?.semantic_validation_code_sha256, 'stage3_request_v1_validation_code');
      assertIdentity(nextStage3?.unit_identity_sha256, 'stage3_request_v2_unit_identity');
      assertIdentity(nextStage3?.request_sha256, 'stage3_request_v2_request_hash');
      if (nextStage3?.request_contract_version !== 'new_bos_stage3_vector_free_request_v2') {
        throw new Error('new_bos_stage3_request_contract_v2_identity_invalid');
      }
      if (nextStage3.unit_identity_sha256 === expectedStage3.unit_identity_sha256
        || nextStage3.request_sha256 === expectedStage3.request_sha256) {
        throw new Error('new_bos_stage3_request_contract_v2_hash_not_advanced');
      }
      const key = rootKey(namespace, campaignSha256, VECTOR_FREE_STAGE3_UNIT);
      const existingSerialized = await redis.get(key);
      const existing = parse(existingSerialized);
      if (!existing
        || existing.state !== 'SEMANTIC_REJECTED'
        || existing.unit_id !== VECTOR_FREE_STAGE3_UNIT
        || existing.attempt !== 3
        || existing.observation?.status !== 'completed'
        || existing.unit_identity_sha256 !== expectedStage3.unit_identity_sha256
        || existing.request_sha256 !== expectedStage3.request_sha256
        || existing.observation?.provider_response_id_sha256 !== expectedStage3.provider_response_id_sha256
        || existing.semantic_rejection_code !== 'VECTOR_FREE_ASSESSMENT_LANGUAGE_REJECTION'
        || existing.semantic_validator !== 'assertVectorFreeWholePerson'
        || existing.semantic_rejection_detail !== 'ADAPTABILITY_LANGUAGE'
        || existing.semantic_validation_code_sha256 !== expectedStage3.semantic_validation_code_sha256) {
        throw new Error('new_bos_stage3_request_contract_v2_prior_checkpoint_identity_mismatch');
      }
      const archivedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
      const archive = Object.freeze({
        version: 'new_bos_resumable_semantic_rejection_archive_v1',
        campaign_sha256: campaignSha256,
        unit_id: VECTOR_FREE_STAGE3_UNIT,
        prior_checkpoint_sha256: sha256Stable(existing),
        prior_checkpoint: existing,
        prior_attempt: existing.attempt,
        semantic_rejection_code: existing.semantic_rejection_code,
        semantic_validator: existing.semantic_validator,
        semantic_rejection_detail: existing.semantic_rejection_detail,
        semantic_validation_code_sha256: existing.semantic_validation_code_sha256,
        archived_at: archivedAt,
        replacement_authorized: true,
        replacement_authority: 'founder_stage3_vector_free_request_contract_v2_first_execution',
      });
      const archiveSha256 = sha256Stable(archive);
      const intent = Object.freeze({
        version: 'new_bos_resumable_unit_checkpoint_v1',
        campaign_sha256: campaignSha256,
        unit_id: VECTOR_FREE_STAGE3_UNIT,
        unit_identity_sha256: nextStage3.unit_identity_sha256,
        request_sha256: nextStage3.request_sha256,
        request_contract_version: nextStage3.request_contract_version,
        prior_unit_identity_sha256: existing.unit_identity_sha256,
        prior_request_sha256: existing.request_sha256,
        prior_attempt: existing.attempt,
        next_attempt: 1,
        retry_sequence: 'stage3_vector_free_request_contract_v2',
        retry_boundary: 'exactly_one_repaired_stage3_execution',
        semantic_rejection_archive_sha256: archiveSha256,
        state: 'SUBMISSION_INTENT',
        attempt: 1,
        claim_token_sha256: sha256Stable(crypto.randomUUID()),
        observation: null,
        created_at: archivedAt,
      });
      const claim = Object.freeze({
        version: 'new_bos_stage3_vector_free_request_contract_v2_claim_v1',
        campaign_sha256: campaignSha256,
        unit_id: VECTOR_FREE_STAGE3_UNIT,
        prior_checkpoint_sha256: archive.prior_checkpoint_sha256,
        semantic_rejection_archive_sha256: archiveSha256,
        prior_attempt: existing.attempt,
        request_contract_version: nextStage3.request_contract_version,
        next_unit_identity_sha256: nextStage3.unit_identity_sha256,
        next_request_sha256: nextStage3.request_sha256,
        next_attempt: 1,
        claimed_at: archivedAt,
      });
      const result = await redis.eval(
        RETIRE_SEMANTIC_REJECTED_STAGE3_SCRIPT,
        3,
        key,
        semanticRejectedStage3ArchiveKey(key, existing.attempt),
        stage3RequestContractV2ClaimKey(namespace, campaignSha256),
        existingSerialized,
        JSON.stringify(archive),
        JSON.stringify(intent),
        JSON.stringify(claim),
      );
      if (result !== 'OK') throw new Error(`new_bos_stage3_request_contract_v2_atomic_transition_failed:${result}`);
      return Object.freeze({
        disposition: 'START_STAGE3_REQUEST_CONTRACT_V2',
        record: intent,
        archive_sha256: archiveSha256,
        prior_checkpoint_sha256: archive.prior_checkpoint_sha256,
      });
    },

    async retireInvalidStage3AndDependentStage4({
      campaignSha256,
      expectedStage3,
      expectedStage4,
      failureCode,
      now = new Date(),
    } = {}) {
      if (typeof redis?.eval !== 'function') throw new Error('new_bos_invalid_stage3_atomic_store_required');
      if (!String(failureCode || '').startsWith('Whole-person model leaked assessment language:')) {
        throw new Error('new_bos_invalid_stage3_failure_not_authorized');
      }
      [expectedStage3, expectedStage4].forEach((expected, index) => {
        assertIdentity(expected?.unit_identity_sha256, `invalid_stage${index + 3}_unit_identity`);
        assertIdentity(expected?.request_sha256, `invalid_stage${index + 3}_request_hash`);
        assertIdentity(expected?.accepted_value_sha256, `invalid_stage${index + 3}_accepted_value_hash`);
      });
      const stage3Key = rootKey(namespace, campaignSha256, VECTOR_FREE_STAGE3_UNIT);
      const stage4Key = rootKey(namespace, campaignSha256, VECTOR_FREE_DEPENDENT_STAGE4_UNIT);
      const stage3 = parse(await redis.get(stage3Key));
      const stage4 = parse(await redis.get(stage4Key));
      const matches = (record, expected, unitId) => record?.state === 'ACCEPTED'
        && record.unit_id === unitId
        && record.unit_identity_sha256 === expected.unit_identity_sha256
        && record.request_sha256 === expected.request_sha256
        && record.accepted_value_sha256 === expected.accepted_value_sha256;
      if (!matches(stage3, expectedStage3, VECTOR_FREE_STAGE3_UNIT)) {
        throw new Error('new_bos_invalid_stage3_checkpoint_identity_mismatch');
      }
      if (!matches(stage4, expectedStage4, VECTOR_FREE_DEPENDENT_STAGE4_UNIT)) {
        throw new Error('new_bos_invalid_stage4_checkpoint_identity_mismatch');
      }
      const retiredAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
      const archive3 = Object.freeze({
        version: 'new_bos_resumable_invalid_semantic_archive_v1',
        campaign_sha256: campaignSha256,
        unit_id: VECTOR_FREE_STAGE3_UNIT,
        prior_checkpoint_sha256: sha256Stable(stage3),
        prior_attempt: stage3.attempt,
        unit_identity_sha256: stage3.unit_identity_sha256,
        request_sha256: stage3.request_sha256,
        accepted_value_sha256: stage3.accepted_value_sha256,
        failure_code: failureCode,
        retired_at: retiredAt,
        replacement_authorized: true,
      });
      const archive4 = Object.freeze({
        version: 'new_bos_resumable_invalid_dependency_archive_v1',
        campaign_sha256: campaignSha256,
        unit_id: VECTOR_FREE_DEPENDENT_STAGE4_UNIT,
        prior_checkpoint_sha256: sha256Stable(stage4),
        prior_attempt: stage4.attempt,
        unit_identity_sha256: stage4.unit_identity_sha256,
        request_sha256: stage4.request_sha256,
        accepted_value_sha256: stage4.accepted_value_sha256,
        invalidated_by_unit: VECTOR_FREE_STAGE3_UNIT,
        invalidated_by_accepted_value_sha256: stage3.accepted_value_sha256,
        retired_at: retiredAt,
        replacement_authorized: true,
      });
      const stage3Intent = Object.freeze({
        version: 'new_bos_resumable_unit_checkpoint_v1',
        campaign_sha256: campaignSha256,
        unit_id: VECTOR_FREE_STAGE3_UNIT,
        unit_identity_sha256: stage3.unit_identity_sha256,
        request_sha256: stage3.request_sha256,
        prior_attempt: stage3.attempt,
        next_attempt: stage3.attempt + 1,
        retry_sequence: 'invalid_stage3_vector_free_contract',
        invalid_semantic_archive_sha256: sha256Stable(archive3),
        state: 'SUBMISSION_INTENT',
        attempt: stage3.attempt + 1,
        claim_token_sha256: sha256Stable(crypto.randomUUID()),
        observation: null,
        created_at: retiredAt,
      });
      const stage4Invalidated = Object.freeze({
        version: 'new_bos_resumable_dependency_invalidation_v1',
        campaign_sha256: campaignSha256,
        unit_id: VECTOR_FREE_DEPENDENT_STAGE4_UNIT,
        prior_attempt: stage4.attempt,
        next_attempt: stage4.attempt + 1,
        state: 'DEPENDENCY_INVALIDATED',
        invalidated_by_unit: VECTOR_FREE_STAGE3_UNIT,
        replacement_reason: 'stage3_vector_free_contract_violation',
        invalid_semantic_archive_sha256: sha256Stable(archive4),
        invalidated_by_archive_sha256: sha256Stable(archive3),
        invalidated_at: retiredAt,
      });
      const claim = Object.freeze({
        version: 'new_bos_invalid_stage3_vector_free_repair_claim_v1',
        campaign_sha256: campaignSha256,
        stage3_archive_sha256: sha256Stable(archive3),
        stage4_archive_sha256: sha256Stable(archive4),
        replacement_stage3_attempt: stage3Intent.attempt,
        replacement_stage4_attempt: stage4Invalidated.next_attempt,
        claimed_at: retiredAt,
      });
      const result = await redis.eval(
        RETIRE_INVALID_STAGE3_SCRIPT,
        5,
        stage3Key,
        stage4Key,
        invalidSemanticArchiveKey(stage3Key),
        invalidSemanticArchiveKey(stage4Key),
        invalidStage3RepairClaimKey(namespace, campaignSha256),
        JSON.stringify(stage3),
        JSON.stringify(stage4),
        JSON.stringify(archive3),
        JSON.stringify(archive4),
        JSON.stringify(stage3Intent),
        JSON.stringify(stage4Invalidated),
        JSON.stringify(claim),
      );
      if (result !== 'OK') throw new Error(`new_bos_invalid_stage3_atomic_retirement_failed:${result}`);
      return Object.freeze({
        disposition: 'START_STAGE3_REPLACEMENT',
        stage3: stage3Intent,
        stage4: stage4Invalidated,
        stage3_archive_sha256: claim.stage3_archive_sha256,
        stage4_archive_sha256: claim.stage4_archive_sha256,
      });
    },

    async claimStaleQueuedReplacement({
      campaignSha256,
      unitId,
      unitIdentitySha256,
      requestSha256,
      expectedProviderResponseIdSha256,
      now = new Date(),
    }) {
      if (unitId !== STALE_REPLACEMENT_UNIT) throw new Error('new_bos_stale_queue_replacement_unit_not_authorized');
      assertIdentity(unitIdentitySha256, 'unit_identity');
      assertIdentity(requestSha256, 'request_hash');
      assertIdentity(expectedProviderResponseIdSha256, 'provider_response_identity');
      const key = rootKey(namespace, campaignSha256, unitId);
      const existing = parse(await redis.get(key));
      if (!existing) throw new Error('new_bos_stale_queue_checkpoint_missing');
      if (existing.state === 'ACCEPTED') throw new Error('new_bos_stale_queue_checkpoint_already_accepted');
      if (existing.attempt !== 1) throw new Error('new_bos_stale_queue_replacement_attempt_not_authorized');
      if (existing.unit_identity_sha256 !== unitIdentitySha256) throw new Error('new_bos_resumable_store_unit_identity_mismatch');
      if (existing.request_sha256 !== requestSha256) throw new Error('new_bos_resumable_store_request_hash_mismatch');
      if (!ACTIVE.has(existing.observation?.status)) throw new Error('new_bos_stale_queue_checkpoint_not_active');
      const responseId = existing.observation?.provider_response_id;
      if (!responseId || stableResponseIdSha256(responseId) !== expectedProviderResponseIdSha256) {
        throw new Error('new_bos_stale_queue_provider_response_identity_mismatch');
      }
      const createdAtMs = timestampMs(existing.created_at);
      const nowMs = now instanceof Date ? now.getTime() : timestampMs(now);
      if (createdAtMs === null || !Number.isFinite(nowMs) || nowMs - createdAtMs < STALE_ACTIVE_MINIMUM_AGE_MS) {
        throw new Error('new_bos_stale_queue_minimum_age_not_met');
      }
      const claim = Object.freeze({
        version: 'new_bos_resumable_stale_active_replacement_claim_v1',
        campaign_sha256: campaignSha256,
        unit_id: unitId,
        unit_identity_sha256: unitIdentitySha256,
        request_sha256: requestSha256,
        prior_checkpoint_sha256: sha256Stable(existing),
        prior_attempt: 1,
        next_attempt: 2,
        provider_response_id_sha256: expectedProviderResponseIdSha256,
        replacement_reason: 'stale_queued_external_response',
        claimed_at: new Date(nowMs).toISOString(),
      });
      const serialized = JSON.stringify(claim);
      const claimKey = staleActiveClaimKey(key);
      const existingClaim = parse(await redis.get(claimKey));
      if (existingClaim) {
        if (existingClaim.campaign_sha256 !== campaignSha256
          || existingClaim.unit_id !== unitId
          || existingClaim.unit_identity_sha256 !== unitIdentitySha256
          || existingClaim.request_sha256 !== requestSha256
          || existingClaim.provider_response_id_sha256 !== expectedProviderResponseIdSha256
          || existingClaim.prior_checkpoint_sha256 !== sha256Stable(existing)) {
          throw new Error('new_bos_stale_queue_replacement_claim_conflict');
        }
        return Object.freeze({ claim: existingClaim, responseId, record: existing });
      }
      const claimed = await redis.set(claimKey, serialized, 'NX');
      if (claimed !== 'OK') {
        const racedClaim = parse(await redis.get(claimKey));
        if (racedClaim?.campaign_sha256 !== campaignSha256
          || racedClaim?.unit_id !== unitId
          || racedClaim?.unit_identity_sha256 !== unitIdentitySha256
          || racedClaim?.request_sha256 !== requestSha256
          || racedClaim?.provider_response_id_sha256 !== expectedProviderResponseIdSha256
          || racedClaim?.prior_checkpoint_sha256 !== sha256Stable(existing)) {
          throw new Error('new_bos_stale_queue_replacement_claim_conflict');
        }
        return Object.freeze({ claim: racedClaim, responseId, record: existing });
      }
      return Object.freeze({ claim, responseId, record: existing });
    },

    async retireStaleQueuedAndPrepareReplacement({
      campaignSha256,
      unitId,
      unitIdentitySha256,
      requestSha256,
      expectedProviderResponseIdSha256,
      cancellation,
    }) {
      if (unitId !== STALE_REPLACEMENT_UNIT) throw new Error('new_bos_stale_queue_replacement_unit_not_authorized');
      const key = rootKey(namespace, campaignSha256, unitId);
      const claimKey = staleActiveClaimKey(key);
      const claim = parse(await redis.get(claimKey));
      const existing = parse(await redis.get(key));
      if (!claim) throw new Error('new_bos_stale_queue_replacement_claim_missing');
      if (!existing) throw new Error('new_bos_stale_queue_checkpoint_missing');
      if (existing.state === 'ACCEPTED') throw new Error('new_bos_stale_queue_checkpoint_already_accepted');
      if (claim.campaign_sha256 !== campaignSha256
        || claim.unit_id !== unitId
        || claim.unit_identity_sha256 !== unitIdentitySha256
        || claim.request_sha256 !== requestSha256
        || claim.provider_response_id_sha256 !== expectedProviderResponseIdSha256
        || claim.prior_checkpoint_sha256 !== sha256Stable(existing)) {
        throw new Error('new_bos_stale_queue_replacement_claim_identity_mismatch');
      }
      if (existing.attempt !== 1 || !ACTIVE.has(existing.observation?.status)) {
        throw new Error('new_bos_stale_queue_checkpoint_changed_after_claim');
      }
      if (stableResponseIdSha256(existing.observation?.provider_response_id) !== expectedProviderResponseIdSha256) {
        throw new Error('new_bos_stale_queue_provider_response_identity_mismatch');
      }
      if (cancellation?.status !== 'cancelled'
        || stableResponseIdSha256(cancellation?.provider_response_id) !== expectedProviderResponseIdSha256) {
        throw new Error('new_bos_stale_queue_cancellation_not_proven');
      }
      const archived = Object.freeze({
        version: 'new_bos_resumable_stale_active_archive_v1',
        campaign_sha256: campaignSha256,
        unit_id: unitId,
        unit_identity_sha256: unitIdentitySha256,
        request_sha256: requestSha256,
        state: existing.state,
        attempt: existing.attempt,
        observation: existing.observation,
        archived_at: claim.claimed_at,
        provider_terminal_status: 'cancelled',
        provider_response_id_sha256: expectedProviderResponseIdSha256,
        replacement_authorized: true,
        replacement_reason: 'stale_queued_external_response',
      });
      const archiveSerialized = JSON.stringify(archived);
      const archiveKey = staleActiveArchiveKey(key);
      const archiveResult = await redis.set(archiveKey, archiveSerialized, 'NX');
      if (archiveResult !== 'OK' && await redis.get(archiveKey) !== archiveSerialized) {
        throw new Error('new_bos_stale_queue_archive_conflict');
      }
      const intent = Object.freeze({
        version: 'new_bos_resumable_unit_checkpoint_v1',
        campaign_sha256: campaignSha256,
        unit_id: unitId,
        unit_identity_sha256: unitIdentitySha256,
        request_sha256: requestSha256,
        prior_attempt: 1,
        next_attempt: 2,
        retry_sequence: 'stale_queued_external_response',
        stale_archive_sha256: sha256Stable(archived),
        claimed_at: claim.claimed_at,
        state: 'SUBMISSION_INTENT',
        attempt: 2,
        claim_token_sha256: sha256Stable(crypto.randomUUID()),
        observation: null,
      });
      await redis.set(key, JSON.stringify(intent));
      return Object.freeze({ disposition: 'START_REPLACEMENT', record: intent, archive: archived });
    },

    async observe({ campaignSha256, unitId, unitIdentitySha256, requestSha256, event }) {
      const key = rootKey(namespace, campaignSha256, unitId);
      const existing = parse(await redis.get(key));
      if (!existing) throw new Error('new_bos_resumable_store_observation_without_intent');
      if (existing.attempt === 1 && await redis.get(staleActiveClaimKey(key))) {
        throw new Error('new_bos_stale_queue_replacement_claim_active');
      }
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
      if (existing.state === 'SEMANTIC_REJECTED') {
        throw new Error('new_bos_resumable_store_accept_semantic_rejected');
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

    async rejectSemantic({ campaignSha256, unitId, unitIdentitySha256, requestSha256, code, rejection = null }) {
      const key = rootKey(namespace, campaignSha256, unitId);
      const existing = parse(await redis.get(key));
      if (!existing) throw new Error('new_bos_resumable_store_reject_without_intent');
      if (existing.unit_identity_sha256 !== unitIdentitySha256 || existing.request_sha256 !== requestSha256) {
        throw new Error('new_bos_resumable_store_reject_identity_mismatch');
      }
      const typed = rejection && typeof rejection === 'object'
        ? Object.freeze({
          code: String(rejection.category || 'SEMANTIC_VALIDATION_REJECTION'),
          validator: String(rejection.validator || 'semantic_validator'),
          detail: rejection.language_class ? String(rejection.language_class) : null,
          validation_code_sha256: rejection.validation_code_sha256 || null,
        })
        : Object.freeze({
          code: String(code || 'semantic_validation_failed'),
          validator: null,
          detail: null,
          validation_code_sha256: null,
        });
      if (existing.state === 'SEMANTIC_REJECTED') {
        if (existing.semantic_rejection_code !== typed.code
          || (existing.semantic_validator || null) !== typed.validator
          || (existing.semantic_rejection_detail || null) !== typed.detail
          || (existing.semantic_validation_code_sha256 || null) !== typed.validation_code_sha256) {
          throw new Error('new_bos_resumable_store_semantic_rejection_conflict');
        }
        return existing;
      }
      if (existing.state === 'ACCEPTED') {
        throw new Error('new_bos_resumable_store_reject_accepted');
      }
      const rejected = Object.freeze({
        ...existing,
        state: 'SEMANTIC_REJECTED',
        semantic_rejection_code: typed.code,
        semantic_validator: typed.validator,
        semantic_rejection_detail: typed.detail,
        semantic_validation_code_sha256: typed.validation_code_sha256,
        rejected_at: new Date().toISOString(),
      });
      await redis.set(key, JSON.stringify(rejected));
      return rejected;
    },
  });
}
