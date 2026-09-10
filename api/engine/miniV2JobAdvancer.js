import {
  acquireJobExecutionLease,
  claimLegacyJobExecutionLock,
  ensureLegacyJobExecutionDrain,
  getJob,
  isStaleLock,
  JOB_EXECUTION_PROTOCOL_VERSION,
  JOB_STATUS,
  miniV2ExecutionActivationSha256,
  releaseLegacyJobExecutionLock,
  releaseJobExecutionLease,
  resolveMiniV2ExecutionActivationId,
} from './miniV2JobManager.js';
import { executeNextStage } from './miniV2StagedExecutor.js';

/**
 * Advance at most one Mini V2 stage under an atomic owner lease.
 * Dependencies are injectable so concurrency and authority rechecks can be
 * proven without a provider or Redis connection.
 */
export async function advanceMiniV2JobOnce({
  jobId,
  beforeExecute = async () => {},
  readJob = getJob,
  executeStage = executeNextStage,
  acquireLease = acquireJobExecutionLease,
  ensureLegacyDrain = ensureLegacyJobExecutionDrain,
  claimLegacyLock = claimLegacyJobExecutionLock,
  releaseLegacyLock = releaseLegacyJobExecutionLock,
  releaseLease = releaseJobExecutionLease,
  allowLegacyDrainStart = false,
  executionAllowed = true,
  activationId = resolveMiniV2ExecutionActivationId(),
} = {}) {
  const activationSha256 = miniV2ExecutionActivationSha256(activationId);
  const usesCurrentProtocol = (job) => job?.execution_lock_protocol_version === JOB_EXECUTION_PROTOCOL_VERSION
    && job?.execution_lock_activation_sha256 === activationSha256;
  const initial = await readJob(jobId);
  if (!initial) return Object.freeze({ job: null, advanced: false, in_flight: false });
  if ([JOB_STATUS.COMPLETE, JOB_STATUS.FAILED].includes(initial.status)) {
    return Object.freeze({ job: initial, advanced: false, in_flight: false });
  }
  if (!executionAllowed) {
    return Object.freeze({
      job: initial,
      advanced: false,
      in_flight: true,
      execution_disabled: true,
      retry_after_ms: null,
    });
  }
  if (allowLegacyDrainStart) {
    const drain = await ensureLegacyDrain({ activationId });
    if (!drain?.ready) {
      return Object.freeze({
        job: initial,
        advanced: false,
        in_flight: true,
        legacy_drain: true,
        retry_after_ms: drain?.retry_after_ms || null,
      });
    }
  } else if (!usesCurrentProtocol(initial)) {
    return Object.freeze({ job: initial, advanced: false, in_flight: true, legacy_drain: true, retry_after_ms: null });
  }
  if (initial.locked && !isStaleLock(initial)) {
    return Object.freeze({ job: initial, advanced: false, in_flight: true });
  }

  const owner = await acquireLease(jobId);
  if (!owner) {
    return Object.freeze({ job: await readJob(jobId), advanced: false, in_flight: true });
  }

  let legacyLockClaimed = false;
  try {
    let current = await readJob(jobId);
    if (!current || [JOB_STATUS.COMPLETE, JOB_STATUS.FAILED].includes(current.status)) {
      return Object.freeze({ job: current, advanced: false, in_flight: false });
    }
    if (allowLegacyDrainStart) {
      const drain = await ensureLegacyDrain({ activationId });
      if (!drain?.ready) {
        return Object.freeze({
          job: current,
          advanced: false,
          in_flight: true,
          legacy_drain: true,
          retry_after_ms: drain?.retry_after_ms || null,
        });
      }
    } else if (!usesCurrentProtocol(current)) {
      return Object.freeze({ job: current, advanced: false, in_flight: true, legacy_drain: true, retry_after_ms: null });
    }
    if (current.locked && !isStaleLock(current)) {
      return Object.freeze({ job: current, advanced: false, in_flight: true });
    }
    legacyLockClaimed = await claimLegacyLock(jobId, owner, {
      expectedLockedAt: current.locked ? current.locked_at : null,
      activationId,
    });
    if (!legacyLockClaimed) {
      return Object.freeze({ job: await readJob(jobId), advanced: false, in_flight: true });
    }
    current = await readJob(jobId);
    if (!current?.locked
        || current.execution_lock_owner !== owner
        || current.execution_lock_activation_sha256 !== activationSha256) {
      return Object.freeze({ job: current, advanced: false, in_flight: true });
    }
    await beforeExecute(current);
    await executeStage(current);
    return Object.freeze({ job: await readJob(jobId), advanced: true, in_flight: false });
  } finally {
    try {
      if (legacyLockClaimed) await releaseLegacyLock(jobId, owner);
    } finally {
      await releaseLease(jobId, owner);
    }
  }
}
