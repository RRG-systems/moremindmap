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

const QUESTION_KEYS = Array.from({ length: 12 }, (_, index) => `q${index + 1}`);

function normalizeAnswers(answers = {}) {
  const normalized = {};
  for (const key of QUESTION_KEYS) {
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
    const { owner_profile_id, answers } = req.body || {};
    const parsedProfile = parseProfileId(owner_profile_id);

    if (!parsedProfile) {
      return res.status(400).json({ success: false, error: 'Invalid owner_profile_id' });
    }

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ success: false, error: 'answers required' });
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
    const normalizedAnswers = normalizeAnswers(answers);
    const assessmentId = createAssessmentId(now);
    const jobId = createJobId();
    const teamProfileIds = parseTeamProfileIds(normalizedAnswers.q11);
    const assessmentType = normalizedAnswers.q11.trim() ? 'real_estate_team' : 'real_estate_agent';
    const profileContext = extractProfileContext(profileLookup.dossier, parsedProfile.normalized);

    const record = {
      assessment_id: assessmentId,
      owner_profile_id: parsedProfile.normalized,
      assessment_type: assessmentType,
      status: 'intake_saved',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      version: ASSESSMENT_VERSION,
      inputs: {
        answers: normalizedAnswers,
        team_profile_ids: teamProfileIds,
        financial_text: normalizedAnswers.q9
      },
      profile_context: profileContext,
      output: null,
      metadata: {
        generated_at: null,
        model: null,
        notes: 'Sprint 2 intake only. No intelligence generated.'
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

    const identity = extractNotificationIdentityFromDossier(profileLookup.dossier);
    const notificationResult = await sendFormspreeNotification(
      buildBusinessAssessmentNotification({
        assessmentId,
        ownerProfileId: parsedProfile.normalized,
        fullName: identity.full_name || profileContext.owner_profile_name,
        email: identity.email,
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
      profile_context: profileContext
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
