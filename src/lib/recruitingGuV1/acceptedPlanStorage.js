const PREFIX = 'more-consulting-accepted-plan-session-v2';

export function acceptedPlanStorageKey({ mode, managerId, subjectId }) {
  if (!['real', 'demo'].includes(mode) || !managerId || !subjectId) return null;
  return `${PREFIX}:${mode}:${encodeURIComponent(managerId)}:${encodeURIComponent(subjectId)}`;
}

export function acceptedPlanPointerKey(mode, managerId) {
  return acceptedPlanStorageKey({ mode, managerId, subjectId: 'last-subject' });
}

export function preferredDemoRecoverySubject({ rememberedSubject, activeSubject, allowedSubjects = [] }) {
  if (allowedSubjects.includes(rememberedSubject)) return rememberedSubject;
  return allowedSubjects.includes(activeSubject) ? activeSubject : null;
}

export function acceptedPlanReceiptMatches(session, receipt, scope) {
  return Boolean(session?.status === 'COMPLETED' && session?.accepted_plan_snapshot
    && scope?.mode === 'demo' && receipt?.mode === scope.mode
    && receipt?.managerId === scope.managerId && receipt?.subjectId === scope.subjectId
    && session.session_id === receipt?.sessionId
    && session.manager_binding?.subject_id === receipt?.managerId
    && session.subject_binding?.profile_id === receipt?.profileId
    && (session.subject_binding?.candidate_id || null) === (receipt?.candidateId || null));
}
