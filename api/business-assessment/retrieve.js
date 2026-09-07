import {
  businessAssessmentByProfileKey,
  businessAssessmentKey,
  createRedisClient,
  isPublicProductAuthorityError,
  parseAssessmentId,
  parseProfileId,
  setCors
} from './shared.js';
import {
  authorizeBusinessAssessmentIdBeforeRead,
  authorizePublicOrRecruitingProductRequest,
} from '../engine/recruitingV1/canonicalAdapters.js';
import { RedisPublicStore } from '../../src/lib/publicSiteAirlockV1/redisStore.js';

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

export async function readAuthorizedAssessmentById({ redis, assessmentId, authorizeRead }) {
  const raw = await redis.get(businessAssessmentKey(assessmentId));
  if (!raw) return null;

  let assessment;
  try {
    assessment = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!assessment || typeof assessment !== 'object' || Array.isArray(assessment)) return null;

  const parsedOwner = parseProfileId(assessment.owner_profile_id);
  if (!parsedOwner) return null;
  await authorizeRead(parsedOwner.normalized, assessment);
  return Object.freeze({ assessment, ownerProfileId: parsedOwner.normalized });
}

export default async function handler(req, res) {
  if (!setCors(res, req)) return res.status(403).json({ success: false, error: 'Origin not allowed' });

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
    const publicStore = new RedisPublicStore(redis);

    if (parsedAssessment) {
      await authorizeBusinessAssessmentIdBeforeRead({
        req,
        store: publicStore,
        assessmentId: parsedAssessment.normalized,
        force: true,
      });
      const authorized = await readAuthorizedAssessmentById({
        redis,
        assessmentId: parsedAssessment.normalized,
        authorizeRead: (ownerProfileId, assessment) => authorizePublicOrRecruitingProductRequest({
          req,
          store: publicStore,
          productKey: 'business_assessment',
          profileId: ownerProfileId,
          relationshipRef: assessment.metadata?.recruiting_relationship_ref || '',
          assessmentId: parsedAssessment.normalized,
          read: true,
          force: true,
        }),
      });
      if (!authorized) return res.status(404).json({ success: false, error: 'Assessment not found' });
      return res.status(200).json(
        buildRetrieveResponse(authorized.assessment, authorized.ownerProfileId)
      );
    }

    await authorizePublicOrRecruitingProductRequest({
      req,
      store: publicStore,
      productKey: 'business_assessment',
      profileId: parsedProfile.normalized,
      read: true,
      allowProfileBoundBaRead: true,
    });
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
    const assessmentOwner = parseProfileId(assessment?.owner_profile_id)?.normalized;
    if (!assessmentOwner || assessmentOwner !== parsedProfile.normalized) {
      return res.status(404).json({ success: false, error: 'Assessment not found' });
    }
    await authorizePublicOrRecruitingProductRequest({
      req,
      store: publicStore,
      productKey: 'business_assessment',
      profileId: parsedProfile.normalized,
      relationshipRef: assessment.metadata?.recruiting_relationship_ref || '',
      assessmentId,
      read: true,
    });
    return res.status(200).json(buildRetrieveResponse(assessment, parsedProfile.normalized));
  } catch (error) {
    if (isPublicProductAuthorityError(error)) {
      return res.status(404).json({ success: false, error: 'Assessment not found' });
    }
    console.error(JSON.stringify({ event: 'BUSINESS_ASSESSMENT_RETRIEVE_FAILED', customer_payload_logged: false }));
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve assessment'
    });
  } finally {
    if (redis) await redis.disconnect();
  }
}
