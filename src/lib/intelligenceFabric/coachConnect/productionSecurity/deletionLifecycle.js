import { hashCanonicalJson } from '../../hashing.js';
import { deepFreeze } from '../../validation.js';
import {
  PRODUCTION_SECURITY_POLICY_VERSIONS,
} from './constants.js';
import { validateDeletionJob, validateLegalHold } from './contracts.js';
import { evaluateRetentionAuthority } from './retentionAuthority.js';
import { requireSharedSecurityStatePort } from './sharedSecurityStatePorts.js';

const frozen = (value) => deepFreeze(structuredClone(value));

export function createDeletionJob({
  exact_scope_hash,
  policy,
  requested_by_subject_ref,
  approved_by_subject_refs,
  operator_decision,
  targets,
  lease_fencing_token,
  created_at,
  active_legal_hold = null,
}) {
  const authority = evaluateRetentionAuthority(policy);
  if (!authority.architecture_implementation_allowed
    || operator_decision?.allowed !== true
    || operator_decision.action !== 'PLAN_DELETION') {
    return frozen({ ok: false, code: 'RETENTION_POLICY_UNAPPROVED' });
  }
  if (active_legal_hold) {
    const holdValidation = validateLegalHold(active_legal_hold);
    if (!holdValidation.valid || active_legal_hold.status === 'ACTIVE') {
      const heldTargetIds = holdValidation.valid
        ? targets
          .filter((target) => active_legal_hold.governed_data_classes.includes(target.target_class))
          .map((target) => target.target_id)
        : targets.map((target) => target.target_id);
      return frozen({
        ok: false,
        code: 'LEGAL_HOLD_ACTIVE',
        state: 'RETAINED_LEGAL_HOLD',
        held_target_ids: heldTargetIds,
        unheld_target_ids: targets
          .filter((target) => !heldTargetIds.includes(target.target_id))
          .map((target) => target.target_id),
        read_authority_granted: false,
        deletion_executed: false,
      });
    }
  }
  const body = {
    exact_scope_hash,
    policy_id: policy.policy_id,
    policy_version: policy.version,
    requested_by_subject_ref,
    approved_by_subject_refs: [...approved_by_subject_refs],
    deletion_epoch: 1,
    lease_fencing_token,
    state: 'AUTHORITY_VERIFIED',
    targets: targets.map((target) => ({
      target_id: target.target_id,
      target_class: target.target_class,
      store_id: target.store_id,
      required_disposition: target.required_disposition,
      state: 'PLANNED',
      attempt_count: 0,
      last_attempt_at: null,
      verification_receipt_ref: null,
      failure_code: null,
    })),
    created_at,
    updated_at: created_at,
  };
  const job = {
    ...body,
    deletion_job_id: `deletion_job_${hashCanonicalJson(body).slice(0, 32)}`,
  };
  const validation = validateDeletionJob(job);
  return validation.valid
    ? frozen({ ok: true, job })
    : frozen({ ok: false, code: validation.errors[0]?.code || 'DELETION_TARGET_INCOMPLETE' });
}

export function advanceDeletionEpochForJob({
  store,
  job,
  expected_epoch,
  updated_at,
}) {
  requireSharedSecurityStatePort(store);
  const validation = validateDeletionJob(job);
  if (!validation.valid || !['AUTHORITY_VERIFIED', 'LEGAL_HOLD_CHECKED'].includes(job.state)) {
    return frozen({ ok: false, code: 'DELETION_TARGET_INCOMPLETE' });
  }
  const advanced = store.advanceDeletionEpoch({
    scope_hash: job.exact_scope_hash,
    expected_epoch,
    reason_code: 'GOVERNED_DELETION_JOB',
  });
  if (!advanced.ok) return frozen({ ok: false, code: advanced.code || 'DELETION_VERIFICATION_FAILED' });
  return frozen({
    ok: true,
    job: {
      ...job,
      deletion_epoch: advanced.epoch,
      state: 'EPOCH_ADVANCED',
      updated_at,
    },
  });
}

export function scheduleDeletionJob({ job, updated_at }) {
  const validation = validateDeletionJob(job);
  if (!validation.valid || job.state !== 'EPOCH_ADVANCED') {
    return frozen({ ok: false, code: 'DELETION_TARGET_INCOMPLETE' });
  }
  return frozen({ ok: true, job: { ...job, state: 'SCHEDULED', updated_at } });
}

export function recordDeletionTargetAttempt({
  job,
  target_id,
  attempted_at,
  result,
}) {
  const validation = validateDeletionJob(job);
  if (!validation.valid || !['SCHEDULED', 'ATTEMPTING', 'PARTIALLY_VERIFIED', 'FAILED_RETRYABLE'].includes(job.state)) {
    return frozen({ ok: false, code: 'DELETION_TARGET_INCOMPLETE' });
  }
  const target = job.targets.find((item) => item.target_id === target_id);
  if (!target || target.state === 'VERIFIED') return frozen({ ok: false, code: 'DELETION_TARGET_INCOMPLETE' });
  const receiptValid = result?.verified === true
    && result.store_id === target.store_id
    && result.disposition === target.required_disposition
    && typeof result.verification_receipt_ref === 'string'
    && result.verification_receipt_ref.length > 0;
  const targets = job.targets.map((item) => item.target_id === target_id
    ? {
      ...item,
      state: receiptValid ? 'VERIFIED' : result?.retryable === false ? 'FAILED_TERMINAL' : 'FAILED_RETRYABLE',
      attempt_count: item.attempt_count + 1,
      last_attempt_at: attempted_at,
      verification_receipt_ref: receiptValid ? result.verification_receipt_ref : null,
      failure_code: receiptValid ? null : result?.failure_code || 'DELETION_VERIFICATION_FAILED',
    }
    : item);
  const verifiedCount = targets.filter((item) => item.state === 'VERIFIED').length;
  const terminal = targets.some((item) => item.state === 'FAILED_TERMINAL');
  const state = terminal
    ? 'FAILED_TERMINAL'
    : verifiedCount === targets.length
      ? 'VERIFIED'
      : verifiedCount > 0
        ? 'PARTIALLY_VERIFIED'
        : 'FAILED_RETRYABLE';
  return frozen({
    ok: !terminal,
    code: state === 'VERIFIED' ? null : terminal ? 'DELETION_VERIFICATION_FAILED' : 'DELETION_TARGET_INCOMPLETE',
    job: { ...job, targets, state, updated_at: attempted_at },
    all_targets_verified: state === 'VERIFIED',
    whole_system_physical_deletion: false,
  });
}

export function verifyDeletionJob(job) {
  const validation = validateDeletionJob(job);
  const allTargets = validation.valid
    && job.targets.every((target) => target.state === 'VERIFIED' && target.verification_receipt_ref);
  return frozen(allTargets && job.state === 'VERIFIED'
    ? {
      ok: true,
      state: 'VERIFIED',
      deletion_job_id: job.deletion_job_id,
      verified_target_count: job.targets.length,
      logical_denial_proven: true,
      whole_system_physical_deletion: false,
    }
    : {
      ok: false,
      code: 'DELETION_TARGET_INCOMPLETE',
      state: job?.state || null,
      whole_system_physical_deletion: false,
    });
}

export function restoreExposureDecision({
  store,
  exact_scope_hash,
  restored_record_epoch,
}) {
  requireSharedSecurityStatePort(store);
  const current = store.getDeletionEpoch(exact_scope_hash);
  if (!current.ok
    || !Number.isInteger(restored_record_epoch)
    || restored_record_epoch < current.epoch) {
    return frozen({
      allowed: false,
      code: 'DELETION_VERIFICATION_FAILED',
      current_deletion_epoch: current.epoch ?? null,
    });
  }
  return frozen({
    allowed: true,
    code: null,
    current_deletion_epoch: current.epoch,
    policy_version: PRODUCTION_SECURITY_POLICY_VERSIONS.deletion_lifecycle,
  });
}
