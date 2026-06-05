import { businessAssessmentJobKey, createRedisClient, setCors } from './shared.js';

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { job_id } = req.query || {};
  if (!job_id) {
    return res.status(400).json({ success: false, error: 'job_id required' });
  }

  let redis;
  try {
    redis = createRedisClient();
    const raw = await redis.get(businessAssessmentJobKey(job_id));

    if (!raw) {
      return res.status(404).json({ success: false, status: 'not_found', error: 'Job not found' });
    }

    const job = JSON.parse(raw);
    return res.status(200).json({
      success: true,
      job_id,
      assessment_id: job.assessment_id,
      owner_profile_id: job.owner_profile_id,
      status: 'completed',
      intake_status: job.intake_status || 'intake_saved',
      message: 'Business Assessment intake saved. Intelligence generation begins in the next sprint.',
      created_at: job.created_at,
      updated_at: job.updated_at
    });
  } catch (error) {
    console.error('[BUSINESS-ASSESSMENT-STATUS] Error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to retrieve job status' });
  } finally {
    if (redis) await redis.disconnect();
  }
}
