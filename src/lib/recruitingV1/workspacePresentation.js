export const MANAGER_DESTINATIONS = Object.freeze([
  { id: 'invite', title: 'Invite a Recruit', copy: 'Invite someone to complete BOS and BA, and follow every invitation in one place.', action: 'Invite and see progress', tone: 'violet' },
  { id: 'consulting', title: 'Consulting Tool', copy: 'Open a shared consultation when both BOS and BA are complete and ready.', action: 'See ready people', tone: 'green' },
]);

export function consultingCandidates(candidates = []) {
  return candidates.filter((person) => person?.consulting_ready === true && person?.state === 'ACCEPTED' && person?.candidate_id);
}

export function consultingPreparationCandidates(candidates = []) {
  return candidates.filter((person) => person?.consulting_ready !== true
    && person?.consulting_preparation_eligible === true
    && person?.state === 'ACCEPTED'
    && Boolean(person?.accepted_at)
    && Boolean(person?.candidate_id));
}

export function reconcileConsultingPreparationReceipts(receipts = {}, candidates = []) {
  const candidatesById = new Map(candidates.filter((person) => person?.candidate_id).map((person) => [person.candidate_id, person]));
  return Object.fromEntries(Object.entries(receipts).filter(([candidateId, receipt]) => {
    const person = candidatesById.get(candidateId);
    if (!person || person.consulting_ready === true) return false;
    if (receipt?.state === 'BOS_INTAKE_REQUIRED') {
      return person.progress_state === 'INVITED' && person.readiness_state !== 'BOS_IN_PROGRESS';
    }
    if (receipt?.state === 'BA_INTAKE_REQUIRED') {
      return (person.ba_readiness || 'BA_NOT_STARTED') === 'BA_NOT_STARTED' && !person.ba_assessment_id;
    }
    return true;
  }));
}

export function recruitProgressLabel(person) {
  if (person?.consulting_ready === true && person?.state === 'ACCEPTED') return 'Ready';
  if (person?.progress_label && person.progress_label !== 'Ready') return person.progress_label;
  if (person?.state === 'REVOKED') return 'Revoked';
  if (person?.state === 'EXPIRED') return 'Expired';
  if (person?.delivery_state === 'FAILED' || person?.state === 'DELIVERY_FAILED') return 'Delivery failed';
  if (person?.consulting_blocker === 'RESULTS_NEED_VERIFICATION' || person?.ba_readiness === 'BA_INTELLIGENCE_READY') return 'Results need verification';
  if (person?.bos_profile_id || String(person?.ba_readiness || '').match(/BA_(INTAKE_SAVED|IN_PROGRESS)/u)) return 'Taking BA';
  if (person?.state === 'ACCEPTED') return 'Taking BOS';
  return 'Invited';
}

export function invitationAllowance(state) {
  return state?.invitation_allowance || null;
}

export function allowanceLabel(allowance) {
  if (!allowance) return 'Allowance is being verified';
  if (allowance.mode === 'unlimited') return 'Unlimited';
  return `${allowance.remaining ?? 0} of ${allowance.limit ?? 5} remaining`;
}

export function allowanceResetLabel(allowance) {
  const reset = new Date(allowance?.period_end);
  if (!allowance?.period_end || Number.isNaN(reset.getTime())) return 'Reset date is being verified';
  return `Resets ${reset.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })} (UTC)`;
}

export function consultingCandidatePath(candidateId) {
  return `/recruiting-gu-v1?candidate_id=${encodeURIComponent(candidateId)}`;
}

export function mayResendInvitation(person) {
  return Boolean(person?.invitation_id && !person?.accepted_at
    && ['DELIVERY_FAILED', 'EXPIRED'].includes(person?.state));
}

export function invitationErrorMessage(failure, allowance) {
  const code = typeof failure === 'string' ? failure : failure?.code || failure?.message;
  if (code === 'RECRUITING_INVITATION_ALLOWANCE_EXHAUSTED') {
    const reset = allowance?.period_end ? ` ${allowanceResetLabel(allowance)}.` : '';
    return `No free invitations remain in this period.${reset} You can still check existing invitations.`;
  }
  const messages = {
    RECRUITING_NOTIFICATION_DELIVERY_FAILED: 'The invitation could not be delivered. Check its status below and use Resend invitation to try again.',
    RECRUITING_NOTIFICATION_TRANSPORT_NOT_CONFIGURED: 'Invitation delivery is currently unavailable. Your invitation status and allowance are shown below.',
    RECRUITING_INVITATION_RESEND_DENIED: 'This invitation can no longer be resent. Check its current status below.',
    RECRUITING_INVITATION_RESEND_REVISION_REQUIRED: 'The invitation changed. Refresh its status before trying again.',
    RECRUITING_INVITATION_RESEND_REVISION_INVALID: 'The invitation changed. Refresh its status before trying again.',
    RECRUITING_INVITATION_IDENTITY_INVALID: 'Enter the person’s name and a valid email address.',
    RECRUITING_INVITATION_IDEMPOTENCY_IDENTITY_MISMATCH: 'The invitation details changed. Check the current invitation before trying again.',
    RECRUITING_INVITATION_SCOPE_DENIED: 'This invitation is not available for your account.',
    RECRUITING_CSRF_INVALID: 'Your secure session needs to be refreshed. Reload this page and try again.',
    RECRUITING_MANAGER_SESSION_REQUIRED: 'Your manager session has ended. Reload this page to verify your access again.',
  };
  if (messages[code]) return messages[code];
  if (!code || /^[A-Z][A-Z0-9_]+$/u.test(code)) return 'We could not complete that request. Refresh the invitation list and try again.';
  return code;
}

export function uniqueCandidateNotifications(notifications = []) {
  const seenCandidates = new Set();
  return notifications.filter((notification) => {
    if (!notification.candidate_id) return true;
    if (seenCandidates.has(notification.candidate_id)) return false;
    seenCandidates.add(notification.candidate_id);
    return true;
  });
}

export function presentRecruitingNotification(notification, candidates = []) {
  const person = candidates.find((item) => item.candidate_id === notification?.candidate_id);
  if (!person) return { title: 'Assessment progress updated.', body: 'See the invitation list for the currently verified status.', label: 'Progress' };
  const label = recruitProgressLabel(person);
  const body = label === 'Ready'
    ? 'Both BOS and BA results are ready. You can open the Consulting Tool.'
    : label === 'Taking BA'
      ? 'BOS is complete. BA still needs to be completed and ready before Consulting can open.'
      : label === 'Taking BOS'
        ? 'BOS is the current assessment step. Both BOS and BA must be ready before Consulting can open.'
        : label === 'Invited'
          ? 'The person can review the invitation and choose whether to begin.'
          : 'Consulting is not ready to open. The invitation list shows the current delivery and assessment status.';
  return { title: `${person.recruit_name}: ${label}.`, body, label };
}
