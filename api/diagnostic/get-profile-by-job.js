/**
 * Get profile by job ID
 * Quick diagnostic endpoint to check vault availability
 * GET /api/diagnostic/get-profile-by-job?job_id=...
 */

import Redis from 'ioredis';

function getRedis() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL not configured');
  }
  return new Redis(redisUrl);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { job_id } = req.query;

    if (!job_id) {
      return res.status(400).json({
        success: false,
        error: 'job_id required'
      });
    }

    const redis = getRedis();

    try {
      // Try to find job in recent jobs index
      const recentJobsKey = 'jobs:recent';
      const recentJobs = await redis.lrange(recentJobsKey, 0, -1);

      const jobExists = recentJobs.includes(job_id);

      // Try to get job directly
      const jobKey = `job:${job_id}`;
      const jobData = await redis.get(jobKey);

      // Try to get canonical profile for this job
      let profileData = null;
      let profileId = null;

      if (jobData) {
        const job = JSON.parse(jobData);
        profileId = job.canonical_profile_id;

        if (profileId) {
          const profileKey = `vault:profile:${profileId}`;
          profileData = await redis.get(profileKey);
        }
      }

      // Scan for vault:profile keys
      let allProfileKeys = [];
      let cursor = '0';
      do {
        const [newCursor, keys] = await redis.scan(
          cursor,
          'MATCH',
          'vault:profile:*',
          'COUNT',
          '10'
        );
        allProfileKeys = allProfileKeys.concat(keys);
        cursor = newCursor;
        if (allProfileKeys.length > 100) break;
      } while (cursor !== '0');

      redis.disconnect();

      return res.status(200).json({
        success: true,
        job_id,
        job_exists_in_recent: jobExists,
        job_key: jobKey,
        job_data_exists: !!jobData,
        profile_id: profileId,
        profile_data_exists: !!profileData,
        sample_vault_profile_keys: allProfileKeys.slice(0, 20),
        total_vault_profiles_found: allProfileKeys.length
      });
    } finally {
      redis.disconnect();
    }
  } catch (error) {
    console.error('[GET-PROFILE-BY-JOB] Error:', error.message);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
