/* global process */

const RETRY_AFTER_MS = 2000;

const COPY = Object.freeze({
  READY: 'BOS and Business Assessment results are ready for Consulting.',
  EXECUTION_PAUSED: 'Preparation is temporarily paused. Saved progress was kept. Retry after service returns.',
  BOS_INTAKE_REQUIRED: 'The candidate must finish the BOS assessment before results can be prepared.',
  BOS_JOB_RESUMING: 'Preparing this person\'s BOS results for Consulting. Please keep this page open. This can take around 20 minutes, and sometimes longer. Completed results will be saved automatically.',
  NEW_BOS_PREPARING: 'Preparing this person\'s BOS results for Consulting. Please keep this page open. This can take around 20 minutes, and sometimes longer. Completed results will be saved automatically.',
  BA_INTAKE_REQUIRED: 'The candidate must finish the Business Assessment before results can be prepared.',
  NEW_BA_PREPARING: 'Preparing this person\'s Business Assessment results for Consulting. Please keep this page open. This can take around 20 minutes, and sometimes longer. Completed results will be saved automatically.',
  VERIFYING_RESULTS: 'Completed results are being verified before Consulting opens.',
  RETRYABLE_FAILURE: 'Preparation could not finish right now. It is safe to try again.',
  REVIEW_REQUIRED: 'The saved results need review before Consulting can open.',
  BOS_GENERATION_FAILED: 'The candidate\'s existing BOS job failed and needs review.',
});

function profile(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return /^MM-\d{8}-[A-Z0-9]{8}$/u.test(normalized) ? normalized : null;
}

function assessment(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return /^ba-\d{8}-[a-f0-9]{8}$/u.test(normalized) ? normalized : null;
}

function publicCandidate(authority, ready) {
  const candidate = { ...(authority?.candidate || {}) };
  // Home uses these keys, so preserve its flat shape while withholding the
  // durable resource locators from this mutation response.
  delete candidate.bos_profile_id;
  delete candidate.ba_assessment_id;
  if (ready) {
    candidate.consulting_ready = true;
    candidate.consulting_blocker = null;
    candidate.progress_state = 'BOTH_COMPLETE';
    candidate.progress_label = 'Ready';
  } else if (candidate.consulting_ready) {
    candidate.consulting_ready = false;
    candidate.consulting_blocker = 'RECRUITING_CONSULTING_PREPARATION_PENDING';
    candidate.progress_state = 'BOS_COMPLETE';
    candidate.progress_label = 'Results need verification';
  }
  return Object.freeze(candidate);
}

function preparation(state, candidateId, {
  missingAssessment = null,
  retryable = false,
  retryAfterMs = null,
} = {}) {
  return Object.freeze({
    state,
    candidate_id: candidateId,
    missing_assessment: missingAssessment,
    message: COPY[state],
    retryable,
    retry_after_ms: retryAfterMs,
  });
}

function exactPair(authored, authority) {
  const bos = authored?.receipts?.bos;
  const ba = authored?.receipts?.ba;
  const recorded = authority?.ba_realization_receipt;
  const expectedProfile = profile(authority?.profile_id);
  const expectedAssessment = assessment(authority?.assessment_id);
  return Boolean(
    expectedProfile
      && expectedAssessment
      && authority?.ba_readiness === 'BA_INTELLIGENCE_READY'
      && recorded?.contract === 'recruiting_canonical_new_ba_ready_receipt_v1'
      && authored?.bos
      && authored?.ba
      && bos?.complete_surface_count === 15
      && profile(bos.profile_id) === expectedProfile
      && ba?.complete === true
      && profile(ba.profile_id) === expectedProfile
      && assessment(ba.assessment_id) === expectedAssessment
      && profile(recorded.profile_id) === expectedProfile
      && assessment(recorded.assessment_id) === expectedAssessment
      && recorded.realization_id
      && /^[a-f0-9]{64}$/u.test(String(recorded.realization_sha256 || ''))
      && /^[a-f0-9]{64}$/u.test(String(recorded.artifact_sha256 || ''))
      && recorded.completeness === 'PASS'
      && recorded.customer_projection_completeness === 'COMPLETE'
      && ba.realization_id === recorded.realization_id
      && ba.realization_sha256 === recorded.realization_sha256
      && ba.artifact_sha256 === recorded.artifact_sha256,
  );
}

function classifyFailure(error) {
  const code = String(error?.message || 'RECRUITING_CONSULTING_PREPARATION_FAILED');
  // These failures mean the caller no longer owns the exact manager session,
  // candidate scope, or accepted-consent authority inspected for this run.
  // Preserve the Recruiting HTTP layer's existing 401/403 handling instead of
  // turning an authorization race into a successful retry receipt.
  if (/^RECRUITING_(?:MANAGER_SESSION_(?:REQUIRED|SCOPE_INVALID)|CANDIDATE_SCOPE_DENIED|CONSULTING_(?:ACCEPTED_CONSENT_REQUIRED|PREPARATION_AUTHORITY_CHANGED))$/u.test(code)) {
    throw error;
  }
  if (/^RECRUITING_MANAGER_(?:MEMBERSHIP_INACTIVE|SETUP_INCOMPLETE)$/u.test(code)) {
    throw error;
  }
  const normalizedCode = code.toUpperCase();
  if (/REVIEW|MISMATCH|INVALID|CORRUPT|DRIFT|IDENTITY|REBIND|ALLOWLIST|ALLOWLISTED|INSUFFICIENT|UNSUPPORTED|NOT_FOUND|POINTER_TARGET|BINDING|RECEIPT_REQUIRED|DEFAULT_OFF|NOT_AUTHORIZED|ACCESS_DENIED|CONFIG|PACKAGING/u.test(normalizedCode)) {
    return 'REVIEW_REQUIRED';
  }
  return 'RETRYABLE_FAILURE';
}

function authoredBosExplicitlyMissing(error) {
  return error?.message === 'RECRUITING_GU_V1_COMPLETE_BOS_NOT_READY';
}

function bosInspectedShape(authority) {
  return Object.freeze({
    preparation_authority: authority,
    invite_session: Object.freeze({
      invitation_id: authority.relationship_ref,
      candidate_id: authority.candidate_id,
    }),
    relationship: Object.freeze({
      relationship_ref: authority.relationship_ref,
      candidate_id: authority.candidate_id,
      purpose: 'RECRUITING_INTELLIGENCE',
      progress_state: authority.progress_state,
      bos_job_id: authority.bos_job_id,
      bos_profile_id: authority.profile_id,
    }),
  });
}

export function createConsultingPreparationCoordinator({
  service,
  readAuthoredSurfaces,
  reconcileBosStart,
  advanceBosJob,
  reconcileBosReady,
  inspectBaIntake,
  createNewBosService,
  createNewBaService,
  reconcileBaReady,
  executionStore = null,
  redis = null,
  newBosAccessToken = '',
  newBaAccessToken = '',
  env = process.env,
} = {}) {
  if (typeof service?.inspectCandidatePreparationAuthority !== 'function') throw new Error('RECRUITING_CONSULTING_PREPARATION_SERVICE_REQUIRED');
  if (typeof readAuthoredSurfaces !== 'function') throw new Error('RECRUITING_CONSULTING_AUTHORED_READER_REQUIRED');

  return async function prepareConsultingResults({
    sessionToken,
    candidateId,
    allowLegacyDrainStart = false,
    allowBosExecution = true,
    preparationExecutionAllowed = true,
  } = {}) {
    const expected = { relationshipRef: null, candidateId: String(candidateId || '') };
    async function inspect({ jobId = undefined, profileId = undefined, assessmentId = undefined } = {}) {
      const current = await service.inspectCandidatePreparationAuthority(sessionToken, candidateId);
      if (current.mode !== 'recruiting_manager_candidate_preparation'
          || current.candidate_id !== expected.candidateId
          || (expected.relationshipRef && current.relationship_ref !== expected.relationshipRef)
          || (jobId !== undefined && current.bos_job_id !== jobId)
          || (profileId !== undefined && profile(current.profile_id) !== profile(profileId))
          || (assessmentId !== undefined && assessment(current.assessment_id) !== assessment(assessmentId))) {
        throw new Error('RECRUITING_CONSULTING_PREPARATION_AUTHORITY_CHANGED');
      }
      expected.relationshipRef ||= current.relationship_ref;
      return current;
    }

    async function finish(state, options = {}) {
      const current = await inspect(options.expected || {});
      if (state === 'READY') {
        let verified;
        try {
          verified = await readAuthoredSurfaces({ redis, profileId: current.profile_id, env });
        } catch (error) {
          const fallback = authoredBosExplicitlyMissing(error) ? 'REVIEW_REQUIRED' : classifyFailure(error);
          return finish(fallback, { retryable: fallback === 'RETRYABLE_FAILURE', retryAfterMs: fallback === 'RETRYABLE_FAILURE' ? RETRY_AFTER_MS : null });
        }
        if (!exactPair(verified, current)) {
          return finish('VERIFYING_RESULTS', { retryable: true, retryAfterMs: RETRY_AFTER_MS });
        }
      }
      return Object.freeze({
        preparation: preparation(state, current.candidate_id, options),
        candidate: publicCandidate(current, state === 'READY'),
      });
    }

    let authority = await inspect();
    if (!preparationExecutionAllowed) {
      return finish('EXECUTION_PAUSED', { retryable: true, retryAfterMs: null });
    }
    let authored = null;
    if (authority.profile_id) {
      try {
        authored = await readAuthoredSurfaces({ redis, profileId: authority.profile_id, env });
      } catch (error) {
        if (!authoredBosExplicitlyMissing(error)) {
          const state = classifyFailure(error);
          return finish(state, { retryable: state === 'RETRYABLE_FAILURE', retryAfterMs: state === 'RETRYABLE_FAILURE' ? RETRY_AFTER_MS : null });
        }
      }
      // This is deliberately before every job or modernization dependency.
      if (exactPair(authored, authority)) return finish('READY');
    }

    if (!authority.profile_id) {
      if (typeof reconcileBosStart !== 'function' || !executionStore) {
        return finish(authority.bos_job_id ? 'REVIEW_REQUIRED' : 'BOS_INTAKE_REQUIRED', authority.bos_job_id ? {} : { missingAssessment: 'BOS' });
      }
      authority = await inspect();
      let reconciled;
      try {
        reconciled = await reconcileBosStart({
          inspected: bosInspectedShape(authority),
          store: executionStore,
          service,
          validateExistingJob: true,
        });
      } catch (error) {
        const state = classifyFailure(error);
        return finish(state, { retryable: state === 'RETRYABLE_FAILURE', retryAfterMs: state === 'RETRYABLE_FAILURE' ? RETRY_AFTER_MS : null });
      }
      authority = await inspect();
      if (!reconciled?.reconciled && !reconciled?.validated && !authority.bos_job_id) {
        return finish('BOS_INTAKE_REQUIRED', { missingAssessment: 'BOS' });
      }

      const jobId = authority.bos_job_id;
      if (!jobId || typeof advanceBosJob !== 'function') {
        return finish('REVIEW_REQUIRED');
      }
      authority = await inspect({ jobId });
      let advanced;
      try {
        advanced = await advanceBosJob({
          jobId,
          allowLegacyDrainStart,
          executionAllowed: allowBosExecution,
          beforeExecute: async () => {
            const current = await inspect({ jobId });
            const validated = await reconcileBosStart({
              inspected: bosInspectedShape(current),
              store: executionStore,
              service,
              validateExistingJob: true,
            });
            if (validated?.validated !== true || validated.job_id !== jobId) {
              throw new Error('RECRUITING_CONSULTING_PREPARATION_AUTHORITY_CHANGED');
            }
            await inspect({ jobId });
          },
        });
      } catch (error) {
        const state = classifyFailure(error);
        return finish(state, { retryable: state === 'RETRYABLE_FAILURE', retryAfterMs: state === 'RETRYABLE_FAILURE' ? RETRY_AFTER_MS : null });
      }
      if (!advanced?.job) return finish('REVIEW_REQUIRED', { expected: { jobId } });
      if (advanced.job.status === 'failed') return finish('BOS_GENERATION_FAILED', { expected: { jobId } });
      if (advanced.job.status !== 'complete') {
        const retryAfterMs = Object.hasOwn(advanced, 'retry_after_ms') ? advanced.retry_after_ms : RETRY_AFTER_MS;
        return finish('BOS_JOB_RESUMING', { retryAfterMs, expected: { jobId } });
      }
      if (typeof reconcileBosReady !== 'function') return finish('REVIEW_REQUIRED', { expected: { jobId } });
      authority = await inspect({ jobId });
      try {
        await reconcileBosReady({ redis, authority, job: advanced.job, env, service });
      } catch (error) {
        const state = classifyFailure(error);
        return finish(state, { retryable: state === 'RETRYABLE_FAILURE', retryAfterMs: state === 'RETRYABLE_FAILURE' ? RETRY_AFTER_MS : null });
      }
      authority = await inspect();
      if (!authority.profile_id) return finish('VERIFYING_RESULTS', { retryable: true, retryAfterMs: RETRY_AFTER_MS });
    }

    const profileId = authority.profile_id;
    if (!authored?.bos) {
      if (typeof createNewBosService !== 'function') return finish('REVIEW_REQUIRED', { expected: { profileId } });
      authority = await inspect({ profileId });
      let bosResult;
      try {
        if (typeof service.assertCandidatePreparationAuthority !== 'function') {
          throw new Error('RECRUITING_CONSULTING_PREPARATION_AUTHORITY_RECHECK_REQUIRED');
        }
        const generationAuthority = authority;
        const newBos = await createNewBosService();
        bosResult = await newBos.retrieve({
          profileId,
          suppliedToken: newBosAccessToken,
          assertCurrentAuthority: async () => {
            await service.assertCandidatePreparationAuthority(generationAuthority);
            await inspect({ profileId });
          },
        });
      } catch (error) {
        const state = classifyFailure(error);
        return finish(state, { retryable: state === 'RETRYABLE_FAILURE', retryAfterMs: state === 'RETRYABLE_FAILURE' ? RETRY_AFTER_MS : null, expected: { profileId } });
      }
      if (bosResult?.review_required) return finish('REVIEW_REQUIRED', { expected: { profileId } });
      if (bosResult?.pending) {
        return finish('NEW_BOS_PREPARING', { retryAfterMs: bosResult.retry_after_ms || RETRY_AFTER_MS, expected: { profileId } });
      }
      try {
        authored = await readAuthoredSurfaces({ redis, profileId, env });
      } catch (error) {
        if (authoredBosExplicitlyMissing(error)) {
          return finish('VERIFYING_RESULTS', { retryable: true, retryAfterMs: RETRY_AFTER_MS, expected: { profileId } });
        }
        const state = classifyFailure(error);
        return finish(state, { retryable: state === 'RETRYABLE_FAILURE', retryAfterMs: state === 'RETRYABLE_FAILURE' ? RETRY_AFTER_MS : null, expected: { profileId } });
      }
    }

    let baIntake;
    try {
      baIntake = await inspectBaIntake({
        redis,
        profileId,
        relationshipRef: authority.relationship_ref,
        expectedAssessmentId: authority.assessment_id,
      });
    } catch (error) {
      const state = classifyFailure(error);
      return finish(state, { retryable: state === 'RETRYABLE_FAILURE', retryAfterMs: state === 'RETRYABLE_FAILURE' ? RETRY_AFTER_MS : null, expected: { profileId } });
    }
    if (!baIntake || baIntake.state === 'MISSING') {
      return finish('BA_INTAKE_REQUIRED', { missingAssessment: 'BA', expected: { profileId } });
    }
    if (!Array.isArray(baIntake.canonical_source_guard?.guards)
        || baIntake.canonical_source_guard.guards.length < 2
        || typeof baIntake.canonical_source_guard.assertCurrent !== 'function') {
      return finish('REVIEW_REQUIRED', { expected: { profileId } });
    }

    const assessmentId = baIntake.assessment_id;
    if (authority.assessment_id !== assessmentId || authority.ba_readiness === 'BA_NOT_STARTED') {
      authority = await inspect({ profileId });
      if (authority.assessment_id && authority.assessment_id !== assessmentId) return finish('REVIEW_REQUIRED', { expected: { profileId } });
      try {
        await service.projectBaState(authority.relationship_ref, {
          assessment_id: assessmentId,
          state: 'BA_INTAKE_SAVED',
          preparation_authority: authority,
          canonical_source_guard: baIntake.canonical_source_guard,
        });
      } catch (error) {
        const state = classifyFailure(error);
        return finish(state, {
          retryable: state === 'RETRYABLE_FAILURE',
          retryAfterMs: state === 'RETRYABLE_FAILURE' ? RETRY_AFTER_MS : null,
          expected: { profileId },
        });
      }
      authority = await inspect({ profileId, assessmentId });
    }

    if (typeof createNewBaService !== 'function') return finish('REVIEW_REQUIRED', { expected: { profileId, assessmentId } });
    authority = await inspect({ profileId, assessmentId });
    let baResult;
    try {
      const newBa = await createNewBaService();
      baResult = await newBa.retrieve({
        profileId,
        suppliedToken: newBaAccessToken,
        expectedAuthority: Object.freeze({
          expectedAssessmentId: assessmentId,
          expectedRelationshipRef: authority.relationship_ref,
          assertCurrent: async () => { await inspect({ profileId, assessmentId }); },
        }),
      });
    } catch (error) {
      const state = classifyFailure(error);
      return finish(state, { retryable: state === 'RETRYABLE_FAILURE', retryAfterMs: state === 'RETRYABLE_FAILURE' ? RETRY_AFTER_MS : null, expected: { profileId, assessmentId } });
    }
    if (baResult?.pending) {
      return finish('NEW_BA_PREPARING', { retryAfterMs: baResult.retry_after_ms || RETRY_AFTER_MS, expected: { profileId, assessmentId } });
    }
    if (!baResult?.artifact || !baResult?.receipt) return finish('REVIEW_REQUIRED', { expected: { profileId, assessmentId } });

    authority = await inspect({ profileId, assessmentId });
    let projected;
    try {
      projected = await reconcileBaReady({
        redis,
        result: baResult,
        env,
        service,
        authority,
        canonicalSourceGuard: baIntake.canonical_source_guard,
      });
    } catch (error) {
      const state = classifyFailure(error);
      return finish(state, { retryable: state === 'RETRYABLE_FAILURE', retryAfterMs: state === 'RETRYABLE_FAILURE' ? RETRY_AFTER_MS : null, expected: { profileId, assessmentId } });
    }
    if (projected?.deferred) {
      return finish('RETRYABLE_FAILURE', { retryable: true, retryAfterMs: null, expected: { profileId, assessmentId } });
    }
    if (projected?.projected !== true) {
      return finish('VERIFYING_RESULTS', { retryable: true, retryAfterMs: RETRY_AFTER_MS, expected: { profileId, assessmentId } });
    }
    authority = await inspect({ profileId, assessmentId });
    try {
      authored = await readAuthoredSurfaces({ redis, profileId, env });
    } catch (error) {
      const state = classifyFailure(error);
      return finish(state, { retryable: state === 'RETRYABLE_FAILURE', retryAfterMs: state === 'RETRYABLE_FAILURE' ? RETRY_AFTER_MS : null, expected: { profileId, assessmentId } });
    }
    if (!exactPair(authored, authority)) {
      return finish('VERIFYING_RESULTS', { retryable: true, retryAfterMs: RETRY_AFTER_MS, expected: { profileId, assessmentId } });
    }
    return finish('READY', { expected: { profileId, assessmentId } });
  };
}

export const CONSULTING_PREPARATION_STATES = Object.freeze(Object.keys(COPY));
