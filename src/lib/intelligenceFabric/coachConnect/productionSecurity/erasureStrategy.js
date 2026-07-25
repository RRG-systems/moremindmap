import { hashCanonicalJson } from '../../hashing.js';
import { deepFreeze } from '../../validation.js';
import { PRODUCTION_SECURITY_POLICY_VERSIONS } from './constants.js';

const frozen = (value) => deepFreeze(structuredClone(value));

export const RATIFIED_ERASURE_STRATEGY = deepFreeze({
  decision_id: 'ratified-erasure-strategy-2026-07-24',
  strategy: 'PRODUCTION_STORE_REPLACEMENT',
  approved_by: ['D.J.:founder_product_owner', 'reviewer:Spock'],
  effective_at: '2026-07-24T00:00:00.000Z',
  governed_data_classes: [
    'TRANSCRIPT_CONTENT',
    'RECORDING_CONTENT',
    'DERIVED_TRANSCRIPT_ARTIFACT',
  ],
  backup_disposition: 'NO_TRANSCRIPT_BACKUP_UNTIL_SIGNED_SCHEDULE_THEN_SCOPED_KEY_ERASURE',
  crash_recovery_contract: 'EPOCH_FIRST_IDEMPOTENT_RECEIPT_BACKED',
  rollback_contract: 'NO_ROLLBACK_AFTER_VERIFIED_KEY_DESTRUCTION',
  lineage_contract: 'OPAQUE_ROOT_SCOPE_AND_DERIVATIVE_INVENTORY',
  dual_write_prohibited: true,
  local_jsonl_production_eligible: false,
  cryptographic_erasure_capability_required: true,
  status: 'APPROVED',
  policy_version: PRODUCTION_SECURITY_POLICY_VERSIONS.erasure_strategy,
  live_store_enabled: false,
  migration_authorized: false,
});

export const LOCAL_JSONL_PRODUCTION_ERASURE_BOUNDARY = deepFreeze({
  development_only: true,
  sensitive_production_eligible: false,
  logical_tombstone_supported: true,
  deletion_epoch_supported: true,
  physical_deletion_supported: false,
  physical_deletion_claim: 'NOT_PROVEN_APPEND_ONLY_FULL_SNAPSHOTS',
  truth: 'LOGICAL_DENIAL_ONLY',
});

export function evaluateErasureArchitecture({
  strategy = RATIFIED_ERASURE_STRATEGY,
  transcript_store_capability,
  local_jsonl_capability = LOCAL_JSONL_PRODUCTION_ERASURE_BOUNDARY,
}) {
  const failures = [];
  if (strategy.status !== 'APPROVED'
    || strategy.strategy !== 'PRODUCTION_STORE_REPLACEMENT'
    || strategy.cryptographic_erasure_capability_required !== true
    || strategy.local_jsonl_production_eligible !== false
    || strategy.dual_write_prohibited !== true) failures.push('ERASURE_STRATEGY_UNAPPROVED');
  if (local_jsonl_capability.physical_deletion_supported !== false
    || local_jsonl_capability.truth !== 'LOGICAL_DENIAL_ONLY') failures.push('PHYSICAL_DELETION_NOT_PROVEN');
  if (!transcript_store_capability
    || transcript_store_capability.store_class !== 'PRIVATE_UNVERSIONED_S3'
    || transcript_store_capability.scoped_encryption !== true
    || transcript_store_capability.delete_object_supported !== true
    || transcript_store_capability.derivative_lineage_required !== true
    || transcript_store_capability.dual_write !== false
    || transcript_store_capability.live_connection !== false) failures.push('BACKING_STORE_UNRESOLVED');
  return frozen({
    allowed: failures.length === 0,
    code: failures[0] || null,
    failures,
    local_jsonl_truth: 'LOGICAL_DENIAL_ONLY',
    local_jsonl_physical_deletion: false,
    live_store_contacted: false,
    migration_authorized: false,
  });
}

export function createSyntheticTranscriptStoreCapability({
  store_id = 'synthetic-private-unversioned-s3',
} = {}) {
  return frozen({
    store_id,
    store_class: 'PRIVATE_UNVERSIONED_S3',
    scoped_encryption: true,
    delete_object_supported: true,
    versioning_enabled: false,
    transactional_metadata_required: true,
    deletion_epoch_required: true,
    derivative_lineage_required: true,
    dual_write: false,
    provider_recording_enabled: false,
    transcript_backup_enabled: false,
    live_connection: false,
    proof_class: 'SYNTHETIC_CONTRACT_ONLY',
  });
}

export function verifySyntheticErasureReceipts({
  exact_scope_hash,
  primary_delete_receipt,
  key_erasure_receipt,
  derivative_receipts = [],
  backup_decrypt_denial_receipt = null,
  local_jsonl_capability = LOCAL_JSONL_PRODUCTION_ERASURE_BOUNDARY,
}) {
  const primary = primary_delete_receipt?.verified === true
    && primary_delete_receipt.scope_hash === exact_scope_hash;
  const key = key_erasure_receipt?.verified === true
    && key_erasure_receipt.scope_hash === exact_scope_hash
    && key_erasure_receipt.active_replica_count === 0
    && key_erasure_receipt.backup_key_access_denied === true;
  const derivatives = derivative_receipts.length > 0
    && derivative_receipts.every((receipt) => receipt.verified === true && receipt.scope_hash === exact_scope_hash);
  const backup = backup_decrypt_denial_receipt == null
    || (backup_decrypt_denial_receipt.verified === true
      && backup_decrypt_denial_receipt.scope_hash === exact_scope_hash);
  const jsonlHonest = local_jsonl_capability.physical_deletion_supported === false;
  const verified = primary && key && derivatives && backup && jsonlHonest;
  const body = {
    exact_scope_hash,
    primary_object_deleted: primary,
    scoped_key_erasure_verified: key,
    derivatives_verified: derivatives,
    backup_decrypt_denial_verified: backup,
    local_jsonl_physical_deletion: false,
    local_jsonl_truth: 'LOGICAL_DENIAL_ONLY',
    whole_system_physical_deletion: false,
    status: verified ? 'TARGETS_VERIFIED_SYNTHETIC' : 'INCOMPLETE',
  };
  return frozen({
    ok: verified,
    code: verified ? null : 'DELETION_VERIFICATION_FAILED',
    receipt: {
      ...body,
      receipt_id: `synthetic_erasure_${hashCanonicalJson(body).slice(0, 32)}`,
    },
  });
}
