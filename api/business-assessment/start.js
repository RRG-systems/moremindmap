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
import { buildCustomerConfirmedVerticalBinding } from './verticalBinding.js';

function normalizeAnswers(answers = {}, questionKeys = []) {
  const normalized = {};
  for (const key of questionKeys) {
    normalized[key] = typeof answers[key] === 'string' ? answers[key] : String(answers[key] || '');
  }
  return normalized;
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  let redis;
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
      required: req.body?.recruiting_mode === 'accepted_invitation',
    });
    const parsedProfile = parseProfileId(recruitingAuthority.owner_profile_id);

    if (!parsedProfile) {
      return res.status(400).json({ success: false, error: 'Invalid owner_profile_id' });
    }

    redis = createRedisClient();

    const profileLookup = await getCanonicalProfile(redis, parsedProfile.normalized);
    if (!profileLookup.found) {
      return res.status(404).json({
        success: false,
        error: 'Behavioral profile not found',
        owner_profile_id: parsedProfile.normalized
      });
    }

    const now = new Date();
    const questionKeys = registration.intake_contract.questions.map((question) => question.key);
    const normalizedAnswers = normalizeAnswers(answers, questionKeys);
    const assessmentId = createAssessmentId(now);
    const jobId = createJobId();
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

    await redis.set(businessAssessmentKey(assessmentId), JSON.stringify(record));
    await redis.set(businessAssessmentByProfileKey(parsedProfile.normalized), assessmentId);
    await redis.set(businessAssessmentJobKey(jobId), JSON.stringify(job));
    await redis.sadd(`business_assessment:index:date:${now.toISOString().slice(0, 10)}`, assessmentId);
    await redis.sadd(`business_assessment:index:type:${assessmentType}`, assessmentId);

    try {
      await projectRecruitingBaState({
        relationshipRef: recruitingAuthority.relationship_ref,
        assessmentId,
        state: 'BA_INTAKE_SAVED',
      });
    } catch (recruitingProjectionError) {
      console.error(JSON.stringify({
        event: 'RECRUITING_BA_INTAKE_PROJECTION_FAILED',
        code: String(recruitingProjectionError?.message || 'RECRUITING_BA_PROJECTION_FAILED').split(':')[0],
        customer_payload_logged: false,
      }));
    }

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

    return res.status(200).json({
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
    });
  } catch (error) {
    console.error('[BUSINESS-ASSESSMENT-START] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to save business assessment intake'
    });
  } finally {
    if (redis) await redis.disconnect();
  }
}
