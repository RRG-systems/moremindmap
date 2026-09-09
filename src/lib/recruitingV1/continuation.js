const BA_READINESS_STATES = new Set([
  'BA_NOT_STARTED',
  'BA_INTAKE_SAVED',
  'BA_IN_PROGRESS',
  'BA_INTELLIGENCE_READY',
]);

const PROGRESS_STATES = new Set([
  'INVITED',
  'BOS_IN_PROGRESS',
  'BOS_COMPLETE',
  'BA_IN_PROGRESS',
  'BOTH_COMPLETE',
]);

const PROFILE_ID_PATTERN = /^mm-\d{8}-[a-z0-9]{8}$/iu;
const ASSESSMENT_ID_PATTERN = /^ba-\d{8}-[a-f0-9]{8}$/iu;
const BOS_JOB_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,179}$/iu;

function boundedText(value, max = 240) {
  return String(value || '').trim().slice(0, max);
}

function normalizeProfileId(value) {
  const profileId = boundedText(value, 80).toLowerCase();
  return PROFILE_ID_PATTERN.test(profileId) ? profileId : null;
}

function normalizeAssessmentId(value) {
  const assessmentId = boundedText(value, 80).toLowerCase();
  return ASSESSMENT_ID_PATTERN.test(assessmentId) ? assessmentId : null;
}

function normalizeBosJobId(value) {
  const jobId = boundedText(value, 180);
  return BOS_JOB_ID_PATTERN.test(jobId) ? jobId : null;
}

function nextDestination({ progressState }) {
  if (progressState === 'INVITED' || progressState === 'BOS_IN_PROGRESS') {
    return Object.freeze({
      action: 'CONTINUE_BOS',
      product_key: 'behavior_operating_system',
      label: progressState === 'INVITED' ? 'Begin my MORE Profile' : 'Continue my MORE Profile',
      destination: '/profile?recruiting=1',
    });
  }

  if (progressState === 'BOS_COMPLETE') {
    return Object.freeze({
      action: 'BEGIN_BA',
      product_key: 'business_assessment',
      label: 'Begin my complimentary Business Assessment',
      destination: '/business-assessment?recruiting=1',
    });
  }

  const destination = '/business-assessment?recruiting=1';
  if (progressState === 'BA_IN_PROGRESS') {
    return Object.freeze({
      action: 'RETURN_TO_BA',
      product_key: 'business_assessment',
      label: 'Return to my Business Assessment',
      destination,
    });
  }

  return Object.freeze({
    action: 'OPEN_COMPLETED_BA',
    product_key: 'business_assessment',
    label: 'Open my completed Business Assessment',
    destination,
  });
}

function progressSteps({ progressState, profileId, baStarted, baReady }) {
  return Object.freeze([
    Object.freeze({ id: 'invitation', label: 'Invitation accepted', state: 'COMPLETE' }),
    Object.freeze({
      id: 'bos',
      label: 'MORE Profile',
      state: profileId ? 'COMPLETE' : progressState === 'BOS_IN_PROGRESS' ? 'CURRENT' : 'AVAILABLE',
    }),
    Object.freeze({
      id: 'ba',
      label: 'Business Assessment',
      state: baReady ? 'COMPLETE' : baStarted ? 'CURRENT' : profileId ? 'AVAILABLE' : 'LOCKED',
    }),
  ]);
}

function progressNotification(progressState) {
  const notifications = {
    INVITED: {
      code: 'RECRUITING_READY_TO_BEGIN_BOS',
      tone: 'READY',
      title: 'Your invitation is accepted.',
      body: 'Begin your MORE Profile when you are ready. Nothing has started yet.',
    },
    BOS_IN_PROGRESS: {
      code: 'RECRUITING_CONTINUE_BOS',
      tone: 'ACTIVE',
      title: 'Your invitation is active.',
      body: 'Continue your MORE Profile here. Your completed Profile will stay connected to this invitation.',
    },
    BOS_COMPLETE: {
      code: 'RECRUITING_BOS_CONNECTED',
      tone: 'READY',
      title: 'Your MORE Profile is connected.',
      body: 'You can begin the complimentary Business Assessment without another invitation or Profile ID entry.',
    },
    BA_IN_PROGRESS: {
      code: 'RECRUITING_BA_IN_PROGRESS',
      tone: 'ACTIVE',
      title: 'Your Business Assessment is in progress.',
      body: 'Return to the same assessment. It remains bound to the MORE Profile connected to this invitation.',
    },
    BOTH_COMPLETE: {
      code: 'RECRUITING_BOS_BA_COMPLETE',
      tone: 'COMPLETE',
      title: 'Both parts are complete.',
      body: 'Your MORE Profile and Business Assessment remain connected to this one accepted invitation.',
    },
  };
  return Object.freeze(notifications[progressState]);
}

/**
 * Projects the accepted HttpOnly invite-session authority into a browser-safe
 * continuation contract. No cookie/token value is returned and the client does
 * not choose a relationship, Profile, product, or destination.
 */
export function buildRecruitingInviteContinuation(inspected = {}) {
  const session = inspected?.invite_session;
  const relationship = inspected?.relationship;
  const relationshipRef = boundedText(relationship?.relationship_ref, 160);
  const candidateId = boundedText(relationship?.candidate_id, 160);
  const sessionInvitationId = boundedText(session?.invitation_id, 160);
  const sessionCandidateId = boundedText(session?.candidate_id, 160);
  const baReadiness = boundedText(relationship?.ba_readiness || 'BA_NOT_STARTED', 80);
  const relationshipProgress = boundedText(relationship?.progress_state, 80);
  const suppliedBosJobId = boundedText(relationship?.bos_job_id, 180);
  const bosJobId = normalizeBosJobId(suppliedBosJobId);
  const profileId = normalizeProfileId(relationship?.bos_profile_id);
  const assessmentId = normalizeAssessmentId(relationship?.ba_assessment_id);

  if (!session?.invite_session_id
      || !relationshipRef
      || !candidateId
      || sessionInvitationId !== relationshipRef
      || sessionCandidateId !== candidateId
      || relationship?.purpose !== 'RECRUITING_INTELLIGENCE'
      || !BA_READINESS_STATES.has(baReadiness)
      || (relationshipProgress && !PROGRESS_STATES.has(relationshipProgress))) {
    throw new Error('RECRUITING_INVITE_CONTINUATION_SCOPE_INVALID');
  }

  const baStarted = ['BA_INTAKE_SAVED', 'BA_IN_PROGRESS', 'BA_INTELLIGENCE_READY'].includes(baReadiness);
  const baReady = baReadiness === 'BA_INTELLIGENCE_READY';
  if (!profileId && (relationship?.bos_profile_id || relationship?.ba_assessment_id || baStarted)) {
    throw new Error('RECRUITING_INVITE_CONTINUATION_BINDING_INVALID');
  }
  if ((relationship?.ba_assessment_id && !assessmentId)
      || (baStarted && !assessmentId)
      || (!baStarted && assessmentId)) {
    throw new Error('RECRUITING_INVITE_CONTINUATION_BINDING_INVALID');
  }
  if (suppliedBosJobId && !bosJobId) {
    throw new Error('RECRUITING_INVITE_CONTINUATION_BINDING_INVALID');
  }

  const progressState = !profileId
    ? relationshipProgress === 'BOS_IN_PROGRESS' ? 'BOS_IN_PROGRESS' : 'INVITED'
    : baReady
      ? 'BOTH_COMPLETE'
      : baStarted
        ? 'BA_IN_PROGRESS'
        : 'BOS_COMPLETE';
  if (relationshipProgress && relationshipProgress !== progressState) {
    throw new Error('RECRUITING_INVITE_CONTINUATION_BINDING_INVALID');
  }
  if ((progressState === 'BOS_IN_PROGRESS' && !bosJobId)
      || (progressState === 'INVITED' && bosJobId)) {
    throw new Error('RECRUITING_INVITE_CONTINUATION_BINDING_INVALID');
  }

  return Object.freeze({
    contract: 'recruiting_invite_continuation_v1',
    authority: 'accepted_invite_session',
    relationship_ref: relationshipRef,
    candidate_id: candidateId,
    progress_state: progressState,
    bos_resume: Object.freeze({
      state: progressState === 'BOS_IN_PROGRESS' ? 'BOUND' : profileId ? 'COMPLETE' : 'NOT_STARTED',
      job_id: progressState === 'BOS_IN_PROGRESS' ? bosJobId : null,
    }),
    profile_binding: Object.freeze({
      state: profileId ? 'BOUND' : 'PENDING',
      profile_id: profileId,
      same_profile_required: true,
    }),
    ba_readiness: baReadiness,
    ba_assessment_id: assessmentId,
    requires_manual_profile_id: false,
    requires_new_manager_invitation: false,
    progress: progressSteps({ progressState, profileId, baStarted, baReady }),
    notifications: Object.freeze([progressNotification(progressState)]),
    next_step: nextDestination({ progressState }),
  });
}

export function isRecruitingInviteContinuation(value) {
  const destination = boundedText(value?.next_step?.destination);
  return Boolean(
    value?.contract === 'recruiting_invite_continuation_v1'
    && value?.authority === 'accepted_invite_session'
    && value?.requires_manual_profile_id === false
    && value?.requires_new_manager_invitation === false
    && ['NOT_STARTED', 'BOUND', 'COMPLETE'].includes(value?.bos_resume?.state)
    && Array.isArray(value?.progress)
    && Array.isArray(value?.notifications)
    && ['/profile?recruiting=1', '/business-assessment?recruiting=1'].includes(destination),
  );
}

export function resolveRecruitingBosLanding(continuation) {
  if (!isRecruitingInviteContinuation(continuation)) {
    throw new Error('RECRUITING_INVITE_CONTINUATION_INVALID');
  }
  if (continuation.progress_state === 'INVITED'
      && continuation.next_step?.action === 'CONTINUE_BOS'
      && continuation.bos_resume?.state === 'NOT_STARTED'
      && !continuation.bos_resume?.job_id) {
    return Object.freeze({
      mode: 'BEGIN_NEW_BOS',
      progress_state: 'INVITED',
      job_id: null,
    });
  }

  const jobId = normalizeBosJobId(continuation.bos_resume?.job_id);
  if (continuation.progress_state !== 'BOS_IN_PROGRESS'
      || continuation.next_step?.action !== 'CONTINUE_BOS'
      || continuation.bos_resume?.state !== 'BOUND'
      || !jobId) {
    throw new Error('RECRUITING_BOS_CONTINUATION_BINDING_INVALID');
  }
  return Object.freeze({
    mode: 'RESUME_BOUND_BOS',
    progress_state: 'BOS_IN_PROGRESS',
    job_id: jobId,
  });
}

export async function resumeRecruitingBoundBos({ continuation, pollBoundJob } = {}) {
  const landing = resolveRecruitingBosLanding(continuation);
  if (landing.mode === 'BEGIN_NEW_BOS') {
    return Object.freeze({ status: 'READY_TO_BEGIN', landing });
  }
  if (typeof pollBoundJob !== 'function') {
    throw new TypeError('Recruiting BOS continuation poller is required');
  }
  const result = await pollBoundJob(landing.job_id);
  return Object.freeze({ status: 'RESUMED_BOUND_BOS', landing, result });
}

export function resolveRecruitingBaLanding(continuation) {
  if (!isRecruitingInviteContinuation(continuation)) {
    throw new Error('RECRUITING_INVITE_CONTINUATION_INVALID');
  }

  const profileId = normalizeProfileId(continuation?.profile_binding?.profile_id);
  if (!profileId || continuation?.profile_binding?.state !== 'BOUND') {
    throw new Error('RECRUITING_BA_PROFILE_BINDING_REQUIRED');
  }

  if (continuation.progress_state === 'BOS_COMPLETE'
      && continuation.next_step?.action === 'BEGIN_BA') {
    return Object.freeze({
      mode: 'BEGIN_NEW_BA',
      progress_state: 'BOS_COMPLETE',
      profile_id: profileId,
      assessment_id: null,
    });
  }

  const expectedAction = continuation.progress_state === 'BA_IN_PROGRESS'
    ? 'RETURN_TO_BA'
    : continuation.progress_state === 'BOTH_COMPLETE'
      ? 'OPEN_COMPLETED_BA'
      : '';
  const assessmentId = normalizeAssessmentId(continuation.ba_assessment_id);
  if (!expectedAction || continuation.next_step?.action !== expectedAction || !assessmentId) {
    throw new Error('RECRUITING_BA_CONTINUATION_BINDING_INVALID');
  }

  return Object.freeze({
    mode: continuation.progress_state === 'BOTH_COMPLETE' ? 'OPEN_COMPLETED_BA' : 'RESUME_BOUND_BA',
    progress_state: continuation.progress_state,
    profile_id: profileId,
    assessment_id: assessmentId,
  });
}

/**
 * Opens an existing Recruiting BA only after an exact Assessment-ID read has
 * succeeded under the accepted invite session. This makes the browser a
 * projection of server-held identity: it never chooses a Profile or BA.
 */
export async function openRecruitingBoundBa({
  continuation,
  retrieveBoundAssessment,
  resolveCurrentBa,
  navigate,
} = {}) {
  const landing = resolveRecruitingBaLanding(continuation);
  if (landing.mode === 'BEGIN_NEW_BA') {
    return Object.freeze({ status: 'READY_TO_BEGIN', landing });
  }
  if (typeof retrieveBoundAssessment !== 'function'
      || typeof resolveCurrentBa !== 'function'
      || typeof navigate !== 'function') {
    throw new TypeError('Recruiting BA continuation dependencies are required');
  }

  const payload = await retrieveBoundAssessment(landing.assessment_id);
  const assessment = payload?.assessment;
  const retrievedAssessmentId = normalizeAssessmentId(
    assessment?.assessment_id || payload?.assessment_id,
  );
  const retrievedProfileId = normalizeProfileId(
    assessment?.owner_profile_id || payload?.owner_profile_id,
  );
  if (payload?.success !== true
      || payload?.found !== true
      || !assessment
      || retrievedAssessmentId !== landing.assessment_id
      || retrievedProfileId !== landing.profile_id) {
    throw new Error('RECRUITING_BA_RETRIEVAL_BINDING_INVALID');
  }

  const current = await resolveCurrentBa(landing.profile_id);
  if (current?.status === 'current') {
    const expectedDestination = `/business-twin?id=${encodeURIComponent(landing.profile_id.toUpperCase())}`;
    if (current.destination !== expectedDestination) {
      throw new Error('RECRUITING_BA_DESTINATION_INVALID');
    }
    navigate(current.destination);
    return Object.freeze({ status: 'OPENING_CURRENT_BA', landing });
  }
  if (current?.status !== 'governed_fallback') {
    throw Object.assign(new Error('RECRUITING_BA_CURRENT_ENTRY_UNAVAILABLE'), {
      recovered_payload: payload,
      landing,
    });
  }

  return Object.freeze({
    status: 'RECOVERED_BOUND_BA',
    landing,
    payload,
  });
}
