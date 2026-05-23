/**
 * retrieve-profile.js
 * 
 * Public endpoint: retrieve canonical profile from Vault by ID
 * Used for report regeneration without retaking assessment
 * 
 * GET /api/moremindmap/retrieve-profile?id={profile_id}
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

  const profileIdPattern = /^MM-\d{8}-[a-z0-9]{6,12}$/i;
  if (!profileIdPattern.test(id)) {
    return res.status(400).json({ error: 'Invalid Profile ID format' });
  }

  // Profile IDs are always lowercase; normalize for safety
  const normalizedId = id.toLowerCase();

  try {
    // Connect to Redis
    const redis = new Redis(process.env.REDIS_URL);

    // Retrieve from Vault
    const vaultKey = `vault:profile:${normalizedId}`;
    const profileData = await redis.get(vaultKey);

    await redis.disconnect();

    // Handle not found
    if (!profileData) {
      return res.status(404).json({ 
        error: 'Profile not found',
        profile_id: normalizedId 
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
    });

  } catch (error) {
    console.error('[RETRIEVE] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve profile',
      message: error.message 
    });
  }
}
