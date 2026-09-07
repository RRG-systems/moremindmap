import {
  ASSESSMENT_VERSION,
  businessAssessmentByProfileKey,
  businessAssessmentJobKey,
  businessAssessmentKey,
  createAssessmentId,
  createJobId,
  createRedisClient,
  extractProfileContext,
  getCanonicalProfile,
  parseProfileId,
  parseTeamProfileIds,
  setCors
} from './shared.js';
import {
  buildBusinessAssessmentNotification,
  extractNotificationIdentityFromDossier,
  sendFormspreeNotification
} from '../engine/notifications/formspreeNotifications.js';
import { queueBaCompletedContactSync, splitContactName } from '../integrations/gohighlevel/completionHooks.js';
import { buildGovernedQuestionStates } from '../engine/businessAssessment/questionStates.js';
import {
  authorizePublicOrRecruitingProductRequest,
  projectRecruitingBaState,
  resolveRecruitingBaOwnerProfile,
} from '../engine/recruitingV1/canonicalAdapters.js';
import {
  BA_VERTICAL_CUSTOMER_SAFE_CONFIRMATION_MESSAGE,
  BA_VERTICAL_CUSTOMER_SAFE_UNAVAILABLE_MESSAGE,
  BA_VERTICAL_FAILURE_CODES,
  BaVerticalContractError,
  PRODUCTION_BA_CASSETTE_REGISTRY,
  realEstateAssessmentTypeForAnswers,
} from '../../src/lib/baVerticalCassettesV1/index.js';
import {
  buildCustomerConfirmedVerticalBinding,
  reconcileGrantedVerticalBinding,
  validatePersistedVerticalBinding,
} from './verticalBinding.js';
import { RedisPublicStore } from '../../src/lib/publicSiteAirlockV1/redisStore.js';
import { canonicalJson, normalizeProfileId } from '../../src/lib/publicSiteAirlockV1/contracts.js';
import {
  claimProductExecution,
  commitProductExecution,
  deterministicAssessmentId,
  deterministicExecutionUuid,
  productExecutionFingerprint,
  releaseProductExecution,
} from '../../src/lib/publicSiteAirlockV1/productBoundary.js';

function normalizeAnswers(answers = {}, questionKeys = []) {
  const normalized = {};
  for (const key of questionKeys) {
    normalized[key] = typeof answers[key] === 'string' ? answers[key] : String(answers[key] || '');
  }
  return normalized;
}

function parseRecord(raw) {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function replayStableVerticalAuthority(binding) {
  if (!binding || typeof binding !== 'object') return null;
  const {
    selected_at: ignoredSelectedAt,
    binding_sha256: ignoredBindingSha256,
    ...stableAuthority
  } = binding;
  void ignoredSelectedAt;
  void ignoredBindingSha256;
  return stableAuthority;
}

async function verifyCommittedAssessmentExecution(redis, {
  execution,
  expectedOwnerProfileId,
  expectedVerticalBinding,
  expectedAnswers,
  expectedQuestionStates,
  expectedGrantId,
  expectedRelationshipRef,
  requestSha256,
}) {
  const assessmentId = execution?.identifiers?.assessment_id;
  const jobId = execution?.identifiers?.job_id;
  const [assessmentRaw, jobRaw, profileAssessmentId] = await Promise.all([
    redis.get(businessAssessmentKey(assessmentId)),
    redis.get(businessAssessmentJobKey(jobId)),
    redis.get(businessAssessmentByProfileKey(expectedOwnerProfileId)),
  ]);
  const assessment = parseRecord(assessmentRaw);
  const job = parseRecord(jobRaw);
  const valid = assessment
    && job
    && assessment.assessment_id === assessmentId
    && assessment.owner_profile_id === expectedOwnerProfileId
    && (assessment.metadata?.public_product_grant_id || null) === (expectedGrantId || null)
    && (assessment.metadata?.recruiting_relationship_ref || null) === (expectedRelationshipRef || null)
    && assessment.metadata?.product_execution_request_sha256 === requestSha256
    && canonicalJson(assessment.vertical_binding) === canonicalJson(expectedVerticalBinding)
    && canonicalJson(assessment.inputs?.answers) === canonicalJson(expectedAnswers)
    && canonicalJson(assessment.inputs?.question_states) === canonicalJson(expectedQuestionStates)
    && job.job_id === jobId
    && job.assessment_id === assessmentId
    && job.owner_profile_id === expectedOwnerProfileId
    && profileAssessmentId === assessmentId;
  if (!valid) throw new Error('public_product_execution_artifact_mismatch');
  return { assessment, job };
}

export async function projectRecruitingBaStateIdempotently({
  relationshipRef,
  assessmentId,
  project = projectRecruitingBaState,
}) {
  if (!relationshipRef) return;
  try {
    return await project({
      relationshipRef,
      assessmentId,
      state: 'BA_INTAKE_SAVED',
    });
  } catch (recruitingProjectionError) {
    console.error(JSON.stringify({
      event: 'RECRUITING_BA_INTAKE_PROJECTION_FAILED',
      code: 'RECRUITING_BA_INTAKE_PROJECTION_PENDING',
      customer_payload_logged: false,
    }));
    void recruitingProjectionError;
    throw new Error('RECRUITING_BA_INTAKE_PROJECTION_PENDING');
  }
}

export default async function handler(req, res) {
  if (!setCors(res, req)) return res.status(403).json({ success: false, error: 'Origin not allowed' });

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  let redis;
  let publicStore;
  let executionClaim;
  try {
    const {
      owner_profile_id,
      vertical_selection,
      answers,
      question_states,
    } = req.body || {};

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ success: false, error: 'answers required' });
    }

    let verticalBinding;
    try {
      verticalBinding = buildCustomerConfirmedVerticalBinding({
        selection: vertical_selection,
        selectedAt: new Date().toISOString(),
        registry: PRODUCTION_BA_CASSETTE_REGISTRY,
      });
    } catch (error) {
      if (!(error instanceof BaVerticalContractError)) throw error;
      const confirmationFailure = [
        BA_VERTICAL_FAILURE_CODES.SELECTION_REQUIRED,
        BA_VERTICAL_FAILURE_CODES.SELECTION_UNCONFIRMED,
        BA_VERTICAL_FAILURE_CODES.SELECTION_MALFORMED,
      ].includes(error.code);
      return res.status(400).json({
        success: false,
        error: confirmationFailure
          ? BA_VERTICAL_CUSTOMER_SAFE_CONFIRMATION_MESSAGE
          : BA_VERTICAL_CUSTOMER_SAFE_UNAVAILABLE_MESSAGE,
        error_code: error.code,
      });
    }

    const registration = PRODUCTION_BA_CASSETTE_REGISTRY.resolveVertical(verticalBinding.vertical_id);
    if (registration.cassette_id !== verticalBinding.cassette_id) {
      throw new BaVerticalContractError(BA_VERTICAL_FAILURE_CODES.CROSS_CASSETTE_CONTAMINATION);
    }

    const recruitingAuthority = await resolveRecruitingBaOwnerProfile(req, owner_profile_id, {
      inspectIfPresent: true,
    });
    const parsedProfile = parseProfileId(recruitingAuthority.owner_profile_id);

    if (!parsedProfile) {
      return res.status(400).json({ success: false, error: 'Invalid owner_profile_id' });
    }

    redis = createRedisClient();
    publicStore = new RedisPublicStore(redis);
    const publicAuthority = await authorizePublicOrRecruitingProductRequest({
      req,
      store: publicStore,
      productKey: 'business_assessment',
      profileId: parsedProfile.normalized,
      relationshipRef: recruitingAuthority.relationship_ref || '',
    });
    if (publicAuthority.grant
        && normalizeProfileId(publicAuthority.grant.profile_id) !== parsedProfile.normalized) {
      throw new Error('public_product_profile_binding_mismatch');
    }

    // Resolve access before Profile existence so callers cannot distinguish a
    // real Profile from a missing one without exact product/relationship scope.
    const profileLookup = await getCanonicalProfile(redis, parsedProfile.normalized);
    if (!profileLookup.found) {
      return res.status(404).json({
        success: false,
        error: 'Behavioral profile not found',
        owner_profile_id: parsedProfile.normalized
      });
    }
    if (publicAuthority.grant?.vertical_binding) {
      try {
        verticalBinding = reconcileGrantedVerticalBinding({
          requestedBinding: verticalBinding,
          grantBinding: publicAuthority.grant.vertical_binding,
          registry: PRODUCTION_BA_CASSETTE_REGISTRY,
        });
      } catch (error) {
        if (!(error instanceof BaVerticalContractError)) throw error;
        return res.status(403).json({ success: false, error: 'Confirmed business vertical does not match this access grant.' });
      }
    }

    const now = new Date();
    const questionKeys = registration.intake_contract.questions.map((question) => question.key);
    const normalizedAnswers = normalizeAnswers(answers, questionKeys);
    const semanticQuestionStates = buildGovernedQuestionStates({
      answers: normalizedAnswers,
      requestedStates: question_states,
      assessmentId: 'ba-execution-pending',
    });
    const requestSha256 = productExecutionFingerprint('business_assessment', {
      owner_profile_id: parsedProfile.normalized,
      vertical_binding_authority: publicAuthority.grant?.vertical_binding
        ? { binding_sha256: verticalBinding.binding_sha256 }
        : replayStableVerticalAuthority(verticalBinding),
      answers: normalizedAnswers,
      question_states: semanticQuestionStates,
    });
    const authorityRef = publicAuthority.grant?.grant_id || publicAuthority.relationship_ref || '';
    const proposedAssessmentId = authorityRef
      ? deterministicAssessmentId({
          authorityRef,
          productKey: 'business_assessment',
          requestSha256,
          now: now.getTime(),
        })
      : createAssessmentId(now);
    const proposedJobId = authorityRef
      ? deterministicExecutionUuid({
          authorityRef,
          productKey: 'business_assessment',
          requestSha256,
          kind: 'job',
        })
      : createJobId();
    executionClaim = await claimProductExecution({
      store: publicStore,
      authority: publicAuthority,
      productKey: 'business_assessment',
      requestSha256,
      identifiers: { assessment_id: proposedAssessmentId, job_id: proposedJobId },
      context: { vertical_binding: verticalBinding },
      now: now.getTime(),
    });
    const assessmentId = executionClaim.record?.identifiers?.assessment_id || proposedAssessmentId;
    const jobId = executionClaim.record?.identifiers?.job_id || proposedJobId;
    verticalBinding = validatePersistedVerticalBinding(
      executionClaim.record?.context?.vertical_binding || verticalBinding,
      { registry: PRODUCTION_BA_CASSETTE_REGISTRY },
    );
    const governedQuestionStates = buildGovernedQuestionStates({
      answers: normalizedAnswers,
      requestedStates: question_states,
      assessmentId,
    });
    const teamQuestionKey = registration.intake_contract.team_profile_question_key;
    const financialQuestionKey = registration.intake_contract.financial_text_question_key;
    const teamProfileIds = teamQuestionKey ? parseTeamProfileIds(normalizedAnswers[teamQuestionKey]) : [];
    if (registration.intake_contract.assessment_type_strategy !== 'real-estate-team-q11-v1') {
      throw new BaVerticalContractError(BA_VERTICAL_FAILURE_CODES.REGISTRATION_MISSING, 'assessment_type_strategy');
    }
    const assessmentType = realEstateAssessmentTypeForAnswers(normalizedAnswers);
    const profileContext = extractProfileContext(profileLookup.dossier, parsedProfile.normalized);

    const record = {
      assessment_id: assessmentId,
      owner_profile_id: parsedProfile.normalized,
      assessment_type: assessmentType,
      status: 'intake_saved',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      version: ASSESSMENT_VERSION,
      vertical_binding: verticalBinding,
      inputs: {
        answers: normalizedAnswers,
        question_states: governedQuestionStates,
        team_profile_ids: teamProfileIds,
        financial_text: financialQuestionKey ? normalizedAnswers[financialQuestionKey] : ''
      },
      profile_context: profileContext,
      output: null,
      metadata: {
        generated_at: null,
        model: null,
        notes: 'Sprint 2 intake only. No intelligence generated.',
        recruiting_relationship_ref: recruitingAuthority.relationship_ref || null,
        public_product_grant_id: publicAuthority.grant?.grant_id || null,
        product_execution_request_sha256: requestSha256,
      }
    };

    const job = {
      job_id: jobId,
      assessment_id: assessmentId,
      owner_profile_id: parsedProfile.normalized,
      status: 'completed',
      intake_status: 'intake_saved',
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    };

    const startResult = {
      success: true,
      job_id: jobId,
      assessment_id: assessmentId,
      status: 'completed',
      intake_status: 'intake_saved',
      assessment_type: assessmentType,
      profile_context: profileContext,
      vertical_state: {
        vertical_id: verticalBinding.vertical_id,
        vertical_label: verticalBinding.vertical_label,
        cassette_id: verticalBinding.cassette_id,
      }
    };

    if (executionClaim.code === 'REPLAY') {
      await verifyCommittedAssessmentExecution(redis, {
        execution: executionClaim.record,
        expectedOwnerProfileId: parsedProfile.normalized,
        expectedVerticalBinding: verticalBinding,
        expectedAnswers: normalizedAnswers,
        expectedQuestionStates: governedQuestionStates,
        expectedGrantId: publicAuthority.grant?.grant_id || null,
        expectedRelationshipRef: recruitingAuthority.relationship_ref || null,
        requestSha256,
      });
      await projectRecruitingBaStateIdempotently({
        relationshipRef: recruitingAuthority.relationship_ref,
        assessmentId,
      });
      return res.status(200).json(executionClaim.record.result || startResult);
    }
    if (executionClaim.code === 'IN_PROGRESS') {
      return res.status(409).json({
        success: false,
        error: 'This assessment intake is already being saved. Retry the same submission.',
        job_id: jobId,
        assessment_id: assessmentId,
      });
    }

    if (executionClaim.code === 'BYPASS') {
      await redis.set(businessAssessmentKey(assessmentId), JSON.stringify(record));
      await redis.set(businessAssessmentByProfileKey(parsedProfile.normalized), assessmentId);
      await redis.set(businessAssessmentJobKey(jobId), JSON.stringify(job));
      await redis.sadd(`business_assessment:index:date:${now.toISOString().slice(0, 10)}`, assessmentId);
      await redis.sadd(`business_assessment:index:type:${assessmentType}`, assessmentId);
    } else {
      await commitProductExecution({
        store: publicStore,
        claim: executionClaim,
        result: startResult,
        setValues: [
          { key: businessAssessmentKey(assessmentId), value: JSON.stringify(record) },
          { key: businessAssessmentByProfileKey(parsedProfile.normalized), value: assessmentId },
          { key: businessAssessmentJobKey(jobId), value: JSON.stringify(job) },
        ],
        setMembers: [
          { key: `business_assessment:index:date:${now.toISOString().slice(0, 10)}`, value: assessmentId },
          { key: `business_assessment:index:type:${assessmentType}`, value: assessmentId },
        ],
        now: now.getTime(),
      });
    }

    await projectRecruitingBaStateIdempotently({
      relationshipRef: recruitingAuthority.relationship_ref,
      assessmentId,
    });

    const identity = extractNotificationIdentityFromDossier(profileLookup.dossier);
    const { firstName, lastName } = splitContactName(identity.full_name || profileContext.owner_profile_name);
    queueBaCompletedContactSync({
      profileId: parsedProfile.normalized,
      firstName,
      lastName,
      email: identity.email,
      phone: identity.phone,
      completedAt: now.toISOString(),
      source: req.body?.source || req.body?.campaign || 'business_assessment'
    });

    const notificationResult = await sendFormspreeNotification(
      buildBusinessAssessmentNotification({
        assessmentId,
        ownerProfileId: parsedProfile.normalized,
        fullName: identity.full_name || profileContext.owner_profile_name,
        email: identity.email,
        phone: identity.phone,
        company: identity.company,
        assessmentType,
        status: 'intake_saved',
        timestamp: now.toISOString()
      })
    );

    if (notificationResult.attempted && !notificationResult.sent) {
      console.warn('[BUSINESS-ASSESSMENT-START] Business Assessment notification was not sent:', notificationResult.reason || notificationResult.status);
    }

    return res.status(200).json(startResult);
  } catch (error) {
    if (publicStore && executionClaim?.code === 'ACQUIRED') {
      try { await releaseProductExecution({ store: publicStore, claim: executionClaim }); } catch { /* lease expiry remains a recovery path */ }
    }
    console.error(JSON.stringify({ event: 'BUSINESS_ASSESSMENT_START_FAILED', code: 'START_REQUEST_FAILED', customer_payload_logged: false }));
    if (/public_product_/u.test(error?.message || '')) {
      return res.status(403).json({ success: false, error: 'Product access could not be verified.' });
    }
    if (error?.message === 'RECRUITING_BA_INTAKE_PROJECTION_PENDING') {
      return res.status(503).json({
        success: false,
        retryable: true,
        error: 'Assessment intake was saved, but Recruiting readiness is pending. Retry the same submission.',
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Failed to save business assessment intake'
    });
  } finally {
    if (redis) await redis.disconnect();
  }
}
