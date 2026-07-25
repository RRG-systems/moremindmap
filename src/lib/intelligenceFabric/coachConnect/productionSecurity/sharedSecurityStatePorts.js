import { deepFreeze } from '../../validation.js';
import { PRODUCTION_SECURITY_POLICY_VERSIONS } from './constants.js';

export const SHARED_SECURITY_STATE_METHODS = deepFreeze([
  'describeCapability',
  'serverTime',
  'atomicCreateSession',
  'rotateSession',
  'getSession',
  'revokeSession',
  'consumeNonce',
  'claimReplay',
  'completeReplay',
  'rateLimit',
  'putCapabilityHash',
  'getCapabilityByHash',
  'revokeCapability',
  'getSecurityEpoch',
  'advanceSecurityEpoch',
  'getDeletionEpoch',
  'advanceDeletionEpoch',
  'acquireRetentionLease',
  'renewRetentionLease',
  'releaseRetentionLease',
  'appendAuditReceipt',
  'health',
]);

export const RATIFIED_UPSTASH_CAPABILITY_REQUIREMENTS = deepFreeze({
  provider: 'UPSTASH_REDIS',
  contract_version: PRODUCTION_SECURITY_POLICY_VERSIONS.shared_state,
  paid_production_plan_required: true,
  authoritative_reads_from_primary_only: true,
  durable_persistence_required: true,
  atomic_create_required: true,
  atomic_compare_and_set_required: true,
  atomic_transaction_or_script_required: true,
  server_time_ttl_required: true,
  backup_capability_required: true,
  regional_behavior_proof_required: true,
  outage_fail_closed_required: true,
  read_after_eviction_proof_required: true,
  eviction_may_be_disabled_when_supported: true,
  no_local_fallback: true,
  live_connection_authorized: false,
});

export function validateSharedSecurityStatePort(store) {
  const missing = SHARED_SECURITY_STATE_METHODS.filter((method) => typeof store?.[method] !== 'function');
  let description = null;
  try {
    description = missing.length ? null : store.describeCapability();
  } catch {
    description = null;
  }
  const validDescription = description
    && description.contract_version === PRODUCTION_SECURITY_POLICY_VERSIONS.shared_state
    && ['SYNTHETIC_LOCAL', 'DEPLOYMENT_CANDIDATE', 'DEPLOYMENT_APPROVED'].includes(description.adapter_class)
    && typeof description.deployment_grade === 'boolean'
    && typeof description.available === 'boolean'
    && typeof description.atomicity_model === 'string'
    && typeof description.ttl_clock_source === 'string'
    && typeof description.partition_behavior === 'string'
    && typeof description.durable_audit === 'boolean'
    && typeof description.environment_id === 'string';
  return deepFreeze({
    valid: missing.length === 0 && Boolean(validDescription),
    missing,
    description: validDescription ? description : null,
  });
}

export function requireSharedSecurityStatePort(store) {
  const validation = validateSharedSecurityStatePort(store);
  if (!validation.valid) {
    throw new TypeError(`shared security state port is invalid: ${validation.missing.join(',')}`);
  }
  return store;
}

export function evaluateDeploymentSharedStateCapability(description) {
  const failures = [];
  if (!description || typeof description !== 'object') {
    failures.push('CAPABILITY_DESCRIPTION_REQUIRED');
  } else {
    if (description.contract_version !== PRODUCTION_SECURITY_POLICY_VERSIONS.shared_state) failures.push('CONTRACT_VERSION');
    if (description.adapter_class !== 'DEPLOYMENT_APPROVED' || description.deployment_grade !== true) failures.push('DEPLOYMENT_APPROVAL');
    if (description.provider !== 'UPSTASH_REDIS') failures.push('RATIFIED_PROVIDER');
    if (description.authoritative_reads_from_primary_only !== true) failures.push('PRIMARY_ONLY_READS');
    if (description.durable_persistence_verified !== true) failures.push('DURABILITY');
    if (description.atomicity_verified !== true) failures.push('ATOMICITY');
    if (description.server_time_ttl_verified !== true) failures.push('SERVER_TIME_TTL');
    if (description.backup_capability_verified !== true) failures.push('BACKUP');
    if (description.regional_behavior_verified !== true) failures.push('REGIONAL_BEHAVIOR');
    if (description.outage_fail_closed_verified !== true) failures.push('OUTAGE_BEHAVIOR');
    if (description.read_after_eviction_verified !== true) failures.push('READ_AFTER_EVICTION');
    if (description.no_local_fallback !== true) failures.push('LOCAL_FALLBACK');
  }
  return deepFreeze({
    approved: failures.length === 0,
    code: failures.length ? 'SHARED_SECURITY_STATE_REQUIRED' : null,
    failures,
    live_connection_attempted: false,
  });
}

export function productionSharedStateDecision(store) {
  const validation = validateSharedSecurityStatePort(store);
  if (!validation.valid) {
    return deepFreeze({ allowed: false, code: 'SHARED_SECURITY_STATE_REQUIRED' });
  }
  if (!validation.description.available) {
    return deepFreeze({ allowed: false, code: 'SHARED_SECURITY_STATE_UNAVAILABLE' });
  }
  const deployment = evaluateDeploymentSharedStateCapability(validation.description);
  return deployment.approved
    ? deepFreeze({ allowed: true, code: null, description: validation.description })
    : deepFreeze({ allowed: false, code: deployment.code, failures: deployment.failures });
}
