// Feature rollback is a read hold, never a rollback of athlete-owned state.
export function hasCurrentApaState(state) {
  return Boolean(state?.currentApa || state?.apaDraft || state?.apaConfirmedChanges?.length
    || state?.apaSourceArchive?.length);
}
export function hasFlagshipState(state) {
  return Boolean(state?.rslLedgerContract || state?.rslEvents?.length
    || state?.apaReviewRequirements?.length || state?.rslSourceArchive?.length
    || state?.sessionStartMap || state?.pendingAttempt?.flagship || state?.visuals?.length);
}
export function coachingWriteHold(config, state) {
  const reason = config.coachingWriteHold === true ? 'OPERATOR_READ_HOLD'
    : hasFlagshipState(state) && config.flagshipEnabled !== true ? 'FLAGSHIP_STATE_REQUIRES_COMPATIBLE_BUILD'
      : hasCurrentApaState(state) && config.currentApaEnabled !== true ? 'CURRENT_APA_STATE_REQUIRES_COMPATIBLE_BUILD' : null;
  return reason ? { contract: 'athlete_academy_coaching_read_hold_v1', active: true, reason,
    evolved_state_preserved: true, provider_or_mutation_admitted: false } : null;
}
export function assertCoachingWritable(config, state) {
  if (coachingWriteHold(config,state)) throw Object.assign(new Error('COACHING_COMPATIBILITY_READ_ONLY'),
    {code:'COACHING_COMPATIBILITY_READ_ONLY',status:503});
}
