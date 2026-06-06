import {
  businessAssessmentByProfileKey,
  businessAssessmentKey,
  createRedisClient,
  parseProfileId,
  setCors
} from './shared.js';

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { id } = req.query || {};
  const parsedProfile = parseProfileId(id);
  if (!parsedProfile) {
    return res.status(400).json({ success: false, status: 'invalid_profile_id', error: 'Invalid Profile ID' });
  }

  let redis;
  try {
    redis = createRedisClient();
    const assessmentId = await redis.get(businessAssessmentByProfileKey(parsedProfile.normalized));

    if (!assessmentId) {
      return res.status(200).json({
        success: true,
        found: false,
        status: 'not_found',
        owner_profile_id: parsedProfile.normalized,
        message: 'No Business Assessment found for this Profile ID.'
      });
    }

    const raw = await redis.get(businessAssessmentKey(assessmentId));
    if (!raw) {
      return res.status(200).json({
        success: true,
        found: false,
        status: 'not_found',
        owner_profile_id: parsedProfile.normalized,
        assessment_id: assessmentId,
        message: 'No Business Assessment found for this Profile ID.'
      });
    }

    const assessment = JSON.parse(raw);
    return res.status(200).json({
      success: true,
      found: true,
      status: assessment.status,
      has_business_intelligence_draft: Boolean(assessment.output?.business_intelligence_draft),
      has_executive_diagnostic_briefing: Boolean(assessment.output?.executive_diagnostic_briefing_v1),
      has_five_futures: Boolean(assessment.output?.five_futures_v1),
      has_one_move: Boolean(assessment.output?.one_move_v1),
      owner_profile_id: parsedProfile.normalized,
      assessment
    });
  } catch (error) {
    console.error('[BUSINESS-ASSESSMENT-RETRIEVE] Error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to retrieve assessment' });
  } finally {
    if (redis) await redis.disconnect();
  }
}
