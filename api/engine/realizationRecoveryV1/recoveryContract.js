export const REALIZATION_RECOVERY_CONTRACT_VERSION = 'bos_ba_realization_recovery_v1';

const ACTIVE_PROVIDER_STATUSES = new Set(['queued', 'in_progress']);
const TERMINAL_PROVIDER_STATUSES = new Set(['failed', 'cancelled', 'incomplete']);

export const REALIZATION_RECOVERY_STATES = Object.freeze({
  HEALTHY_CURRENT: 'HEALTHY_CURRENT',
  COMPATIBLE_PRIOR: 'COMPATIBLE_PRIOR',
  MISSING: 'MISSING',
  IN_PROGRESS: 'IN_PROGRESS',
  RESUMABLE_BACKGROUND: 'RESUMABLE_BACKGROUND',
  TERMINAL_UNRESUMABLE_BACKGROUND: 'TERMINAL_UNRESUMABLE_BACKGROUND',
  POINTER_REPAIRABLE: 'POINTER_REPAIRABLE',
  DERIVED_RECONSTRUCTABLE: 'DERIVED_RECONSTRUCTABLE',
  TRANSIENT_INFRASTRUCTURE: 'TRANSIENT_INFRASTRUCTURE',
  HUMAN_REVIEW_REQUIRED: 'HUMAN_REVIEW_REQUIRED',
});

export function classifyProviderCheckpoint(checkpoint) {
  if (!checkpoint) {
    return Object.freeze({
      contract_version: REALIZATION_RECOVERY_CONTRACT_VERSION,
      state: REALIZATION_RECOVERY_STATES.MISSING,
      resumable: false,
      replacement_eligible: false,
    });
  }
  if (checkpoint.version === 'realization_terminal_checkpoint_retired_v1') {
    return Object.freeze({
      contract_version: REALIZATION_RECOVERY_CONTRACT_VERSION,
      state: REALIZATION_RECOVERY_STATES.TERMINAL_UNRESUMABLE_BACKGROUND,
      resumable: false,
      replacement_eligible: checkpoint.replacement_authorized === true,
    });
  }
  const status = String(checkpoint.provider_status || 'unknown');
  if (status === 'completed') {
    return Object.freeze({
      contract_version: REALIZATION_RECOVERY_CONTRACT_VERSION,
      state: REALIZATION_RECOVERY_STATES.RESUMABLE_BACKGROUND,
      resumable: true,
      replacement_eligible: false,
    });
  }
  if (ACTIVE_PROVIDER_STATUSES.has(status)) {
    return Object.freeze({
      contract_version: REALIZATION_RECOVERY_CONTRACT_VERSION,
      state: REALIZATION_RECOVERY_STATES.RESUMABLE_BACKGROUND,
      resumable: true,
      replacement_eligible: false,
    });
  }
  if (TERMINAL_PROVIDER_STATUSES.has(status)) {
    return Object.freeze({
      contract_version: REALIZATION_RECOVERY_CONTRACT_VERSION,
      state: REALIZATION_RECOVERY_STATES.TERMINAL_UNRESUMABLE_BACKGROUND,
      resumable: false,
      replacement_eligible: true,
    });
  }
  return Object.freeze({
    contract_version: REALIZATION_RECOVERY_CONTRACT_VERSION,
    state: REALIZATION_RECOVERY_STATES.HUMAN_REVIEW_REQUIRED,
    resumable: false,
    replacement_eligible: false,
  });
}

export function classifyRealizationInspection(inspection, { compatiblePrior = false } = {}) {
  if (inspection?.state === 'current') return REALIZATION_RECOVERY_STATES.HEALTHY_CURRENT;
  if (inspection?.state === 'stale' && compatiblePrior) return REALIZATION_RECOVERY_STATES.COMPATIBLE_PRIOR;
  if (inspection?.state === 'publishable_orphan') return REALIZATION_RECOVERY_STATES.POINTER_REPAIRABLE;
  if (inspection?.state === 'missing_derived' || inspection?.state === 'corrupt_derived') return REALIZATION_RECOVERY_STATES.DERIVED_RECONSTRUCTABLE;
  if (inspection?.state === 'missing' || inspection?.state === 'stale') return REALIZATION_RECOVERY_STATES.MISSING;
  return REALIZATION_RECOVERY_STATES.HUMAN_REVIEW_REQUIRED;
}

export function classifyRecoveryFailure(error) {
  if (error?.background_pending) return REALIZATION_RECOVERY_STATES.RESUMABLE_BACKGROUND;
  const code = String(error?.code || error?.message || error?.name || '');
  if (/canonical|identity|authority|evidence|hash|compatib|cross.profile|isolation|unsupported|insufficient|automatic_recovery_exhausted|claim_incomplete/iu.test(code)) {
    return REALIZATION_RECOVERY_STATES.HUMAN_REVIEW_REQUIRED;
  }
  if (/redis|timeout|network|provider|single.flight|temporar|connection|fetch/iu.test(code)) {
    return REALIZATION_RECOVERY_STATES.TRANSIENT_INFRASTRUCTURE;
  }
  return REALIZATION_RECOVERY_STATES.HUMAN_REVIEW_REQUIRED;
}
