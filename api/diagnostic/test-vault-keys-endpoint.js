/**
 * Test Vault Keys - Diagnostic Endpoint
 * GET /api/diagnostic/test-vault-keys
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
    const redis = getRedis();

    // Test vault keys for Pamela
    const profile_id = 'MM-20260523-bm6knd3p';
    const date = '2026-05-23';

    const tests = {
      profile_key_exists: await redis.exists(`vault:profile:${profile_id}`),
      markdown_key_exists: await redis.exists(`vault:markdown:${profile_id}`),
      date_index_exists: await redis.exists(`vault:index:date:${date}`),
      metadata_count: await redis.get('vault:metadata:count'),
      profiles_in_date_index: null,
      all_profile_keys: []
    };

    // Get profiles in date index
    if (tests.date_index_exists === 1) {
      tests.profiles_in_date_index = await redis.smembers(
        `vault:index:date:${date}`
      );
    }

    // Scan for all vault:profile keys
    let cursor = '0';
    let all_keys = [];
    do {
      const [new_cursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        'vault:profile:*',
        'COUNT',
        '100'
      );
      all_keys = all_keys.concat(keys);
      cursor = new_cursor;
    } while (cursor !== '0');

    tests.all_profile_keys = all_keys.slice(0, 50); // First 50

    // Try to get the actual profile
    const profile_data = await redis.get(`vault:profile:${profile_id}`);
    const profile_obj = profile_data ? JSON.parse(profile_data) : null;

    redis.disconnect();

    return res.status(200).json({
      success: true,
      tests,
      profile_found: !!profile_obj,
      profile_person_name: profile_obj?.person_name || null
    });
  } catch (error) {
    console.error('[TEST-VAULT-KEYS] Error:', error.message);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
