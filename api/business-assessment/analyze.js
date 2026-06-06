import {
  businessAssessmentByProfileKey,
  businessAssessmentKey,
  createRedisClient,
  getCanonicalProfile,
  parseProfileId,
  setCors
} from './shared.js';
import { REAL_ESTATE_BUSINESS_MODEL_V1 } from '../engine/businessAssessment/realEstateBusinessModelV1.js';
import { buildBusinessIntelligenceDraft } from '../engine/businessAssessment/buildBusinessIntelligenceDraft.js';

const ANALYSIS_VERSION = 'business_intelligence_draft_v1';

async function resolveAssessmentId(redis, { assessment_id, owner_profile_id }) {
  if (assessment_id) return assessment_id;
  const parsedProfile = parseProfileId(owner_profile_id);
  if (!parsedProfile) return null;
  return redis.get(businessAssessmentByProfileKey(parsedProfile.normalized));
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  let redis;
  try {
    const { assessment_id, owner_profile_id } = req.body || {};

    if (!assessment_id && !owner_profile_id) {
      return res.status(400).json({ ok: false, error: 'missing_assessment_id_or_profile_id' });
    }

    redis = createRedisClient();
    const assessmentId = await resolveAssessmentId(redis, { assessment_id, owner_profile_id });

    if (!assessmentId) {
      return res.status(404).json({ ok: false, error: 'assessment_not_found' });
    }

    const rawAssessment = await redis.get(businessAssessmentKey(assessmentId));
    if (!rawAssessment) {
      return res.status(404).json({ ok: false, error: 'assessment_not_found', assessment_id: assessmentId });
    }

    const assessmentRecord = JSON.parse(rawAssessment);
    const ownerProfileId = assessmentRecord.owner_profile_id || owner_profile_id;
    const profileLookup = await getCanonicalProfile(redis, ownerProfileId);

    if (!profileLookup.found) {
      return res.status(404).json({
        ok: false,
        error: 'profile_not_found',
        assessment_id: assessmentId,
        owner_profile_id: ownerProfileId
      });
    }

    const businessIntelligenceDraft = buildBusinessIntelligenceDraft({
      assessmentRecord,
      canonicalProfile: profileLookup.dossier,
      realEstateBusinessModel: REAL_ESTATE_BUSINESS_MODEL_V1
    });

    const now = new Date().toISOString();
    const updatedRecord = {
      ...assessmentRecord,
      status: 'business_intelligence_draft_ready',
      updated_at: now,
      output: {
        ...(assessmentRecord.output || {}),
        business_intelligence_draft: businessIntelligenceDraft
      },
      metadata: {
        ...(assessmentRecord.metadata || {}),
        analysis_version: ANALYSIS_VERSION,
        analysis_generated_at: now
      }
    };

    await redis.set(businessAssessmentKey(assessmentId), JSON.stringify(updatedRecord));

    return res.status(200).json({
      ok: true,
      assessment_id: assessmentId,
      owner_profile_id: ownerProfileId,
      status: 'business_intelligence_draft_ready',
      business_intelligence_draft: businessIntelligenceDraft
    });
  } catch (error) {
    console.error('[BUSINESS-ASSESSMENT-ANALYZE] Error:', error);
    return res.status(500).json({
      ok: false,
      error: 'analysis_failed',
      detail: error.message || 'Unknown analysis error'
    });
  } finally {
    if (redis) await redis.disconnect();
  }
}
