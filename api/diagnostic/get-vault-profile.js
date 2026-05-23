/**
 * Diagnostic Endpoint: Get Vault Profile by ID
 * 
 * GET /api/diagnostic/get-vault-profile?id={profile_id}
 * 
 * INSTRUMENTED: Logs Redis provider, host, and retrieval operations
 */

import Redis from 'ioredis';
import { isValidProfileId } from '../engine/vault/generateProfileId.js';

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

    // Validate profile ID format: MM-YYYYMMDD-[a-z0-9]{8}
    if (!isValidProfileId(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid profile_id format. Expected: MM-YYYYMMDD-[a-z0-9]{8}',
        provided: id,
        example: 'MM-20260523-cf93lov7'
      });
    }

    const redis_diagnostics = {
      redis_module: 'ioredis',
      redis_url_env: process.env.REDIS_URL || 'NOT_SET',
      redis_url_host_extracted: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'N/A',
      operations: []
    };

    const redis = getRedis();

    try {
      // Retrieve profile
      const profile_key = `vault:profile:${id}`;
      console.log(`[RETRIEVAL] GET ${profile_key}`);
      
      redis_diagnostics.operations.push({ step: 'get_initiated', key: profile_key });

      let profile_json;
      try {
        profile_json = await redis.get(profile_key);
        redis_diagnostics.operations.push({ 
          step: 'get_completed',
          returned_null: profile_json === null,
          returned_undefined: profile_json === undefined,
          returned_bytes: profile_json ? Buffer.byteLength(profile_json, 'utf8') : 0
        });
        console.log(`[RETRIEVAL] GET result: ${profile_json ? profile_json.length + ' bytes' : 'null'}`);
      } catch (redisErr) {
        redis_diagnostics.operations.push({ step: 'get_error', error: redisErr.message });
        console.error('[RETRIEVAL-REDIS] GET error:', redisErr.message);
        return res.status(500).json({
          success: false,
          error: 'Redis connection failed',
          redis_error: redisErr.message,
          profile_id: id,
          redis_diagnostics
        });
      }

      if (!profile_json) {
        // Debug: check if key exists at all
        let keyExists = false;
        try {
          const existsResult = await redis.exists(profile_key);
          keyExists = existsResult === 1;
          redis_diagnostics.operations.push({ step: 'exists_check', key: profile_key, exists: keyExists });
          console.log(`[RETRIEVAL] EXISTS ${profile_key}: ${existsResult}`);
        } catch (existsErr) {
          redis_diagnostics.operations.push({ step: 'exists_error', error: existsErr.message });
        }

        return res.status(404).json({
          success: false,
          error: 'Profile not found',
          profile_id: id,
          profile_key: profile_key,
          key_exists: keyExists,
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
      const markdown_key = `vault:markdown:${id}`;
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

      redis_diagnostics.operations.push({ step: 'retrieval_success' });

      // Success response
      return res.status(200).json({
        success: true,
        profile_id: id,
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
