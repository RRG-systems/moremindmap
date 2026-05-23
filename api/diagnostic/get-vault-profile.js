/**
 * Diagnostic Endpoint: Get Vault Profile by ID
 * 
 * GET /api/diagnostic/get-vault-profile?id={profile_id}
 * 
 * Safe retrieval of canonical profile from Vault
 * - No environment variable exposure
 * - Safe if profile missing
 * - Handles missing markdown gracefully
 * - Diagnostic only (not user-facing)
 */

import Redis from 'ioredis';
import { isValidProfileId } from '../engine/vault/generateProfileId.js';

function getRedis() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL not configured');
  }
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

    const redis = getRedis();

    try {
      // Retrieve profile
      const profile_key = `vault:profile:${id}`;
      let profile_json;
      try {
        profile_json = await redis.get(profile_key);
      } catch (redisErr) {
        console.error('[GET-VAULT-PROFILE] Redis GET error:', redisErr.message);
        return res.status(500).json({
          success: false,
          error: 'Redis connection failed',
          redis_error: redisErr.message,
          profile_id: id
        });
      }

      if (!profile_json) {
        // Debug: check if key exists at all
        const keyExists = await redis.exists(profile_key);
        return res.status(404).json({
          success: false,
          error: 'Profile not found',
          profile_id: id,
          profile_key: profile_key,
          key_exists: keyExists === 1
        });
      }

      let canonical_profile;
      try {
        canonical_profile = JSON.parse(profile_json);
      } catch (parseErr) {
        return res.status(500).json({
          success: false,
          error: 'Invalid profile JSON in Vault',
          profile_id: id
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
      } catch (mdErr) {
        markdown_error = 'Failed to retrieve markdown';
      }

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
        retrieved_at: new Date().toISOString()
      });
    } finally {
      redis.disconnect();
    }
  } catch (error) {
    console.error('[GET-VAULT-PROFILE] Error:', error.message);

    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
