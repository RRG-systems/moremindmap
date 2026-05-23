/**
 * Diagnostic Endpoint: Get Vault Profile by ID
 * 
 * GET /api/diagnostic/get-vault-profile?id={profile_id}
 * 
 * INSTRUMENTED: Logs Redis provider, host, and retrieval operations
 * 
 * STRATEGY:
 * 1. Accept both MM- (uppercase) and mm- (lowercase) formats
 * 2. Try lowercase normalized key first
 * 3. Fallback to uppercase key (legacy support)
 */

import Redis from 'ioredis';

function getRedis() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL not configured');
  }
  
  console.log(`[RETRIEVAL-REDIS] REDIS_URL: ${redisUrl}`);
  console.log(`[RETRIEVAL-REDIS] Creating ioredis.Redis instance`);
  
  return new Redis(redisUrl);
}

export default async function handler(req, res) {
  // CORS headers
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
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'profile_id required (query param: ?id=...)'
      });
    }

    // Accept both MM- (legacy) and mm- (new) formats, case-insensitive
    // Pattern allows either uppercase or lowercase prefix
    const profileIdPattern = /^m{2}-\d{8}-[a-z0-9]{8}$/i;
    if (!profileIdPattern.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid profile_id format. Expected: MM-YYYYMMDD-[a-z0-9]{8} or mm-YYYYMMDD-[a-z0-9]{8}',
        provided: id,
        example: 'MM-20260523-cf93lov7 or mm-20260523-cf93lov7'
      });
    }

    // Extract date and random parts (case-insensitive)
    const match = id.match(/^m{2}-(\d{8})-([a-z0-9]{8})$/i);
    const datepart = match[1];
    const randompart = match[2].toLowerCase();

    const redis_diagnostics = {
      redis_module: 'ioredis',
      redis_url_env: process.env.REDIS_URL || 'NOT_SET',
      redis_url_host_extracted: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'N/A',
      operations: []
    };

    const redis = getRedis();

    try {
      // FALLBACK STRATEGY:
      // 1. Try lowercase key first (new standard)
      // 2. Fallback to uppercase key (legacy support)
      let profile_json;
      let profile_key_used;
      
      // Try 1: Lowercase normalized key
      const lowercase_key = `vault:profile:mm-${datepart}-${randompart}`;
      console.log(`[RETRIEVAL] Attempt 1: GET ${lowercase_key}`);
      redis_diagnostics.operations.push({ step: 'get_attempt_1_lowercase', key: lowercase_key });
      
      profile_json = await redis.get(lowercase_key);
      
      if (profile_json) {
        profile_key_used = lowercase_key;
        redis_diagnostics.operations.push({ 
          step: 'get_attempt_1_success',
          returned_bytes: Buffer.byteLength(profile_json, 'utf8')
        });
        console.log(`[RETRIEVAL] ✓ Found at lowercase key: ${lowercase_key}`);
      } else {
        // Try 2: Uppercase key (fallback for MM-* keys)
        const uppercase_key = `vault:profile:MM-${datepart}-${randompart}`;
        console.log(`[RETRIEVAL] Attempt 2: GET ${uppercase_key}`);
        redis_diagnostics.operations.push({ step: 'get_attempt_2_uppercase', key: uppercase_key });
        
        profile_json = await redis.get(uppercase_key);
        
        if (profile_json) {
          profile_key_used = uppercase_key;
          redis_diagnostics.operations.push({ 
            step: 'get_attempt_2_success',
            returned_bytes: Buffer.byteLength(profile_json, 'utf8')
          });
          console.log(`[RETRIEVAL] ✓ Found at uppercase key: ${uppercase_key}`);
        } else {
          redis_diagnostics.operations.push({ step: 'get_attempt_2_failed', key: uppercase_key });
        }
      }

      if (!profile_json) {
        // Debug: check if key exists at all
        let lowercaseExists = false;
        let uppercaseExists = false;
        try {
          const lowercase_check = `vault:profile:mm-${datepart}-${randompart}`;
          const lc_exists = await redis.exists(lowercase_check);
          lowercaseExists = lc_exists === 1;
          redis_diagnostics.operations.push({ step: 'exists_check_lowercase', key: lowercase_check, exists: lowercaseExists });
          console.log(`[RETRIEVAL] EXISTS ${lowercase_check}: ${lc_exists}`);
          
          const uppercase_check = `vault:profile:MM-${datepart}-${randompart}`;
          const uc_exists = await redis.exists(uppercase_check);
          uppercaseExists = uc_exists === 1;
          redis_diagnostics.operations.push({ step: 'exists_check_uppercase', key: uppercase_check, exists: uppercaseExists });
          console.log(`[RETRIEVAL] EXISTS ${uppercase_check}: ${uc_exists}`);
        } catch (existsErr) {
          redis_diagnostics.operations.push({ step: 'exists_error', error: existsErr.message });
        }

        return res.status(404).json({
          success: false,
          error: 'Profile not found',
          profile_id: id,
          keys_checked: {
            lowercase: `vault:profile:mm-${datepart}-${randompart}`,
            uppercase: `vault:profile:MM-${datepart}-${randompart}`
          },
          keys_exist: {
            lowercase: lowercaseExists,
            uppercase: uppercaseExists
          },
          redis_diagnostics
        });
      }

      let canonical_profile;
      try {
        canonical_profile = JSON.parse(profile_json);
        redis_diagnostics.operations.push({ step: 'json_parse_success' });
      } catch (parseErr) {
        redis_diagnostics.operations.push({ step: 'json_parse_error', error: parseErr.message });
        return res.status(500).json({
          success: false,
          error: 'Invalid profile JSON in Vault',
          profile_id: id,
          redis_diagnostics
        });
      }

      // Try to retrieve markdown
      const markdown_key = `vault:markdown:mm-${datepart}-${randompart}`;
      let markdown_content = null;
      let markdown_found = false;
      let markdown_error = null;

      try {
        markdown_content = await redis.get(markdown_key);
        markdown_found = !!markdown_content;
        redis_diagnostics.operations.push({ 
          step: 'markdown_get_completed',
          found: markdown_found,
          bytes: markdown_content ? Buffer.byteLength(markdown_content, 'utf8') : 0
        });
        console.log(`[RETRIEVAL] Markdown: ${markdown_found ? markdown_content.length + ' bytes' : 'not found'}`);
      } catch (mdErr) {
        markdown_error = 'Failed to retrieve markdown';
        redis_diagnostics.operations.push({ step: 'markdown_error', error: mdErr.message });
      }

      redis_diagnostics.operations.push({ step: 'retrieval_success', key_used: profile_key_used });

      // Success response
      return res.status(200).json({
        success: true,
        profile_id: id,
        profile_key_used: profile_key_used,
        profile: canonical_profile,
        markdown: {
          found: markdown_found,
          content: markdown_found ? markdown_content : null,
          error: markdown_error
        },
        retrieved_at: new Date().toISOString(),
        redis_diagnostics
      });
    } finally {
      try {
        redis.disconnect();
        redis_diagnostics.operations.push({ step: 'redis_disconnected' });
      } catch (disconnectErr) {
        redis_diagnostics.operations.push({ step: 'disconnect_error', error: disconnectErr.message });
      }
    }
  } catch (error) {
    console.error('[GET-VAULT-PROFILE] Error:', error.message);

    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
