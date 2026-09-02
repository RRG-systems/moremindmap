import { SURFACES } from '../../../src/lib/newBosPersonalityDnaV1/constants.js';

import { sha256Stable } from './realizationIdentity.js';
import {
  buildNewBosResumableCampaignIdentity,
  NEW_BOS_SEMANTIC_STAGES,
} from './resumableSemanticContract.js';

const SAFE_USAGE_FIELDS = Object.freeze([
  'input_tokens',
  'cached_input_tokens',
  'cache_write_tokens',
  'output_tokens',
  'reasoning_tokens',
  'total_tokens',
]);

function safeUsage(usage) {
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) return null;
  const sanitized = Object.fromEntries(SAFE_USAGE_FIELDS
    .filter((field) => Number.isFinite(Number(usage[field])))
    .map((field) => [field, Number(usage[field])]));
  const outputReasoning = Number(usage.output_tokens_details?.reasoning_tokens);
  if (Number.isFinite(outputReasoning)) sanitized.reasoning_tokens = outputReasoning;
  return Object.keys(sanitized).length ? Object.freeze(sanitized) : null;
}

function sanitizeUnitInspection(unitId, inspection) {
  const record = inspection?.record || null;
  const classification = inspection?.classification || Object.freeze({ state: 'MISSING', disposition: 'START_INITIAL' });
  return Object.freeze({
    unit_identity: unitId,
    checkpoint_state: classification.state,
    recovery_disposition: classification.disposition,
    ...(classification.retry_sequence ? { retry_sequence: classification.retry_sequence } : {}),
    ...(Number.isInteger(classification.final_attempt) ? { final_attempt: classification.final_attempt } : {}),
    review_reason: classification.reason || null,
    accepted: record?.state === 'ACCEPTED',
    attempt: Number.isInteger(record?.attempt) ? record.attempt : null,
    provider_terminal_status: record?.observation?.status || null,
    provider_response_id_sha256: record?.observation?.provider_response_id_sha256 || null,
    provider_terminal_reason: record?.observation?.incomplete_details_reason || record?.observation?.error_code || null,
    semantic_rejection_code: record?.semantic_rejection_code || null,
    semantic_validator: record?.semantic_validator || null,
    semantic_rejection_detail: record?.semantic_rejection_detail || null,
    semantic_validation_code_sha256: record?.semantic_validation_code_sha256 || null,
    semantic_rejection_archive_sha256: record?.semantic_rejection_archive_sha256 || null,
    created_at: record?.created_at || null,
    updated_at: record?.updated_at || null,
    accepted_at: record?.accepted_at || null,
    rejected_at: record?.rejected_at || null,
    governed_hashes: Object.freeze({
      unit_identity_sha256: record?.unit_identity_sha256 || null,
      request_sha256: record?.request_sha256 || null,
      accepted_value_sha256: record?.accepted_value_sha256 || null,
    }),
    usage: safeUsage(record?.observation?.usage),
  });
}

export function sanitizedRedisBindingIdentity(redisUrl) {
  const parsed = new URL(String(redisUrl || ''));
  const protocol = parsed.protocol.replace(':', '').toLowerCase();
  const databaseIndex = parsed.pathname.replace(/^\//u, '') || '0';
  const logicalEndpoint = Object.freeze({
    protocol,
    hostname: parsed.hostname.toLowerCase(),
    port: parsed.port || (protocol === 'rediss' ? '6380' : '6379'),
    database_index: databaseIndex,
  });
  return Object.freeze({
    transport: protocol === 'rediss' ? 'tls' : 'plain',
    logical_endpoint_sha256: sha256Stable(logicalEndpoint),
    database_index: databaseIndex,
  });
}

export async function inspectNewBosResumableRuntimeState({
  config,
  redisUrl,
  rawEvidence,
  realizationIdentity,
  realizationInspection,
  checkpointStore,
} = {}) {
  if (typeof checkpointStore?.inspect !== 'function') throw new Error('new_bos_runtime_inspector_checkpoint_store_required');
  const evidenceIds = rawEvidence.evidence.map(({ evidence_id: evidenceId }) => evidenceId);
  const campaign = buildNewBosResumableCampaignIdentity({ realizationIdentity, evidenceIds });
  const unitIds = Object.freeze([
    ...NEW_BOS_SEMANTIC_STAGES.map(({ id }) => `semantic:${id}`),
    ...SURFACES.map(({ id }) => `surface:${id}`),
  ]);
  const units = await Promise.all(unitIds.map(async (unitId) => sanitizeUnitInspection(
    unitId,
    await checkpointStore.inspect({ campaignSha256: campaign.sha256, unitId }),
  )));
  const firstRecoveryDecision = units.find(({ checkpoint_state: state, recovery_disposition: disposition }) => (
    state !== 'MISSING' && disposition !== 'REUSE_ACCEPTED'
  )) || null;
  return Object.freeze({
    version: 'new_bos_resumable_runtime_inspection_v1',
    namespace: Object.freeze({
      namespace_class: config.namespace.split(':').slice(0, 3).join(':'),
      logical_namespace_sha256: sha256Stable(config.namespace),
    }),
    redis_binding: sanitizedRedisBindingIdentity(redisUrl),
    profile_id: rawEvidence.profile_id,
    canonical_source_sha256: rawEvidence.generation_metadata.canonical_source_sha256,
    desired_realization_id: realizationIdentity.realization_id,
    realization_identity_sha256: realizationIdentity.sha256,
    campaign_sha256: campaign.sha256,
    realization_state: realizationInspection.state,
    current_realization_id: realizationInspection.pointer || null,
    complete_surface_count: realizationInspection.current?.complete_surface_count || 0,
    recovery_review_provenance: firstRecoveryDecision
      ? Object.freeze({
        source: firstRecoveryDecision.recovery_disposition === 'STOP'
          ? 'resumable_checkpoint_review'
          : 'resumable_checkpoint_recovery',
        unit_identity: firstRecoveryDecision.unit_identity,
        checkpoint_state: firstRecoveryDecision.checkpoint_state,
        recovery_disposition: firstRecoveryDecision.recovery_disposition,
        ...(firstRecoveryDecision.retry_sequence ? { retry_sequence: firstRecoveryDecision.retry_sequence } : {}),
        ...(Number.isInteger(firstRecoveryDecision.final_attempt) ? { final_attempt: firstRecoveryDecision.final_attempt } : {}),
        reason: firstRecoveryDecision.review_reason,
      })
      : Object.freeze({ source: 'no_checkpoint_recovery_or_review_observed' }),
    units: Object.freeze(units),
  });
}
