/**
 * retrieve-profile.js
 * 
 * Public endpoint: retrieve canonical profile from Vault by ID
 * Used for report regeneration without retaking assessment
 * 
 * GET /api/moremindmap/retrieve-profile?id={profile_id}
 * 
 * STRATEGY:
 * 1. Try lowercase key first (new format: mm-YYYYMMDD-XXXXXXXX)
 * 2. Fallback to original input format (legacy: MM-YYYYMMDD-XXXXXXXX)
 * This ensures existing profiles (stored uppercase) are still accessible
 * while new profiles use lowercase for consistency
 * 
 * Returns:
 * - canonical dossier (ready for renderer)
 * - status info
 * - or error if not found
 */

import Redis from 'ioredis';

export default async function handler(req, res) {
  // Only GET allowed
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  // Validate profile ID format
  if (!id) {
    return res.status(400).json({ error: 'Profile ID required' });
  }

  // Profile IDs format: mm-YYYYMMDD-XXXXXXXX (8 lowercase alphanumeric chars)
  // Note: Input accepted case-insensitive; normalized to lowercase for Redis key
  const profileIdPattern = /^mm-\d{8}-[a-z0-9]{8}$/i;
  if (!profileIdPattern.test(id)) {
    return res.status(400).json({ error: 'Invalid Profile ID format. Expected: mm-YYYYMMDD-xxxxxxxx' });
  }

  // Profile IDs are always lowercase; normalize for safety
  const normalizedId = id.toLowerCase();

  try {
    // Connect to Redis
    const redis = new Redis(process.env.REDIS_URL);

    // FALLBACK STRATEGY:
    // 1. Try lowercase key first (new format for all new profiles)
    // 2. Fallback to original input format (legacy support for existing profiles)
    let profileData;
    let retrievedKey;
    let keyAttempts = [];
    
    // Try 1: Lowercase key (new standard)
    const lowercaseKey = `vault:profile:${normalizedId}`;
    console.log(`[RETRIEVE] Attempt 1: GET ${lowercaseKey}`);
    keyAttempts.push({ attempt: 1, key: lowercaseKey, strategy: 'lowercase_normalized' });
    
    profileData = await redis.get(lowercaseKey);
    
    if (profileData) {
      retrievedKey = lowercaseKey;
      keyAttempts.push({ attempt: 1, result: 'found', bytes: Buffer.byteLength(profileData, 'utf8') });
      console.log(`[RETRIEVE] ✓ Found at attempt 1: ${lowercaseKey}`);
    } else {
      // Try 2: Original input format (fallback for legacy/uppercase keys like MM-*)
      const originalKey = `vault:profile:${id}`;
      console.log(`[RETRIEVE] Attempt 2: GET ${originalKey}`);
      keyAttempts.push({ attempt: 2, key: originalKey, strategy: 'original_input_format' });
      
      profileData = await redis.get(originalKey);
      
      if (profileData) {
        retrievedKey = originalKey;
        keyAttempts.push({ attempt: 2, result: 'found', bytes: Buffer.byteLength(profileData, 'utf8') });
        console.log(`[RETRIEVE] ✓ Found at attempt 2: ${originalKey}`);
      } else {
        keyAttempts.push({ attempt: 2, result: 'not_found' });
        console.log(`[RETRIEVE] ✗ Not found at attempt 2: ${originalKey}`);
      }
    }

    await redis.disconnect();

    // Handle not found
    if (!profileData) {
      console.log(`[RETRIEVE] Final result: Profile not found after ${keyAttempts.length} attempts`);
      return res.status(404).json({ 
        error: 'Profile not found',
        profile_id: normalizedId,
        _debug_key_attempts: keyAttempts
      });
    }

    // Parse and return
    let canonicalDossier;
    try {
      canonicalDossier = JSON.parse(profileData);
    } catch (e) {
      console.error('[RETRIEVE] JSON parse error:', e);
      return res.status(500).json({ error: 'Invalid profile data' });
    }

    // Return canonical dossier (safe for client rendering)
    return res.status(200).json({
      success: true,
      profile_id: normalizedId,
      canonical_dossier: canonicalDossier,
      retrieved_at: new Date().toISOString(),
      _debug_key_attempts: keyAttempts
    });

  } catch (error) {
    console.error('[RETRIEVE] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve profile',
      message: error.message 
    });
  }
}
