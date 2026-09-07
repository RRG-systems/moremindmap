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
 * 2. Fallback to uppercase key (legacy: MM-YYYYMMDD-XXXXXXXX)
 * This ensures existing profiles (stored uppercase) are still accessible
 * while new profiles use lowercase for consistency
 * 
 * Returns:
 * - canonical dossier (ready for renderer)
 * - status info
 * - or error if not found
 */

import Redis from 'ioredis';
import process from 'node:process';
import { extractBehavioralIntelligence } from '../engine/canonical/extractIntelligence.js';
import { readVisualDNAMetadata } from './visual-dna/shared.js';

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
  const profileIdPattern = /^m{2}-\d{8}-[a-z0-9]{8}$/i;
  if (!profileIdPattern.test(id)) {
    return res.status(400).json({ error: 'Invalid Profile ID format. Expected: mm-YYYYMMDD-xxxxxxxx' });
  }

  // Extract date and random parts (case-insensitive)
  const match = id.match(/^m{2}-(\d{8})-([a-z0-9]{8})$/i);
  const datepart = match[1];
  const randompart = match[2].toLowerCase();

  try {
    // Connect to Redis
    const redis = new Redis(process.env.REDIS_URL);

    // FALLBACK STRATEGY:
    // 1. Try lowercase key first (new format for all new profiles)
    // 2. Fallback to uppercase key (legacy support for existing profiles)
    let profileData;
    // Try 1: Lowercase key (new standard)
    const lowercaseKey = `vault:profile:mm-${datepart}-${randompart}`;
    profileData = await redis.get(lowercaseKey);
    
    if (!profileData) {
      // Try 2: Uppercase key (fallback for legacy MM-* keys)
      const uppercaseKey = `vault:profile:MM-${datepart}-${randompart}`;
      profileData = await redis.get(uppercaseKey);
    }

    // Handle not found
    if (!profileData) {
      await redis.disconnect();
      return res.status(404).json({ 
        error: 'Profile not found',
        profile_id: id
      });
    }

    // Parse and return
    let canonicalDossier;
    try {
      canonicalDossier = JSON.parse(profileData);
    } catch {
      await redis.disconnect();
      console.error('[RETRIEVE] Stored profile could not be parsed');
      return res.status(500).json({ error: 'Invalid profile data' });
    }

    // Extract behavioral intelligence (read-only sibling, not mutating canonical)
    let behavioral_intelligence_v1 = null;
    try {
      behavioral_intelligence_v1 = extractBehavioralIntelligence(canonicalDossier);
    } catch {
      console.error('[RETRIEVE] Behavioral extraction failed');
      // Non-blocking: return canonical even if extraction fails
    }

    let visual_dna = null;
    try {
      visual_dna = await readVisualDNAMetadata(redis, id);
    } catch {
      console.error('[RETRIEVE] Visual DNA metadata lookup failed');
    }

    await redis.disconnect();

    // Return canonical dossier + behavioral intelligence (safe for client rendering)
    return res.status(200).json({
      success: true,
      profile_id: id,
      canonical_dossier: canonicalDossier,
      behavioral_intelligence_v1: behavioral_intelligence_v1,
      visual_dna,
      retrieved_at: new Date().toISOString()
    });

  } catch {
    console.error('[RETRIEVE] Profile retrieval failed');
    return res.status(500).json({ 
      error: 'Failed to retrieve profile'
    });
  }
}
