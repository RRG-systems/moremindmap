import {
  businessAssessmentByProfileKey,
  businessAssessmentKey,
  createRedisClient,
  parseAssessmentId,
  parseProfileId,
  setCors
} from './shared.js';

function buildRetrieveResponse(assessment, ownerProfileId) {
  const profileContext = assessment.profile_context || {};
  const ownerProfileName = profileContext.owner_profile_name || null;

  return {
    success: true,
    found: true,
    status: assessment.status,
    has_business_intelligence_draft: Boolean(assessment.output?.business_intelligence_draft),
    has_executive_diagnostic_briefing: Boolean(assessment.output?.executive_diagnostic_briefing_v1),
    has_five_futures: Boolean(assessment.output?.five_futures_v1),
    has_one_move: Boolean(assessment.output?.one_move_v1),
    owner_profile_id: ownerProfileId || assessment.owner_profile_id || null,
    owner_profile_name: ownerProfileName,
    assessment_id: assessment.assessment_id || null,
    profile_context: profileContext.owner_profile_name || profileContext.owner_profile_type ? profileContext : undefined,
    assessment
  };
}

function buildNotFoundResponse({ ownerProfileId = null, assessmentId = null, message }) {
  return {
    success: true,
    found: false,
    status: 'not_found',
    owner_profile_id: ownerProfileId,
    assessment_id: assessmentId,
    message: message || 'No Business Assessment found for this ID.'
  };
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const query = req.query || {};
  const rawId = query.id || query.profile_id || query.assessment_id;
  const parsedProfile = parseProfileId(rawId);
  const parsedAssessment = parseAssessmentId(rawId);

  if (!parsedProfile && !parsedAssessment) {
    return res.status(400).json({
      success: false,
      status: 'invalid_id',
      error: 'Invalid Profile ID or Assessment ID'
    });
  }

  let redis;
  try {
    redis = createRedisClient();

    if (parsedAssessment) {
      const raw = await redis.get(businessAssessmentKey(parsedAssessment.normalized));
      if (!raw) {
        return res.status(200).json(
          buildNotFoundResponse({
            assessmentId: parsedAssessment.normalized,
            message: 'No Business Assessment found for this Assessment ID.'
          })
        );
      }

      const assessment = JSON.parse(raw);
      return res.status(200).json(
        buildRetrieveResponse(assessment, assessment.owner_profile_id || parsedProfile?.normalized || null)
      );
    }

    const assessmentId = await redis.get(businessAssessmentByProfileKey(parsedProfile.normalized));

    if (!assessmentId) {
      return res.status(200).json(
        buildNotFoundResponse({
          ownerProfileId: parsedProfile.normalized,
          message: 'No Business Assessment found for this Profile ID.'
        })
      );
    }

    const raw = await redis.get(businessAssessmentKey(assessmentId));
    if (!raw) {
      return res.status(200).json(
        buildNotFoundResponse({
          ownerProfileId: parsedProfile.normalized,
          assessmentId,
          message: 'No Business Assessment found for this Profile ID.'
        })
      );
    }

    const assessment = JSON.parse(raw);
    return res.status(200).json(buildRetrieveResponse(assessment, parsedProfile.normalized));
  } catch (error) {
    console.error('[BUSINESS-ASSESSMENT-RETRIEVE] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve assessment'
    });
  } finally {
    if (redis) await redis.disconnect();
  }
}