/**
 * rescore-profile.js
 * 
 * ADMIN ENDPOINT: Refresh GPT-5.5 behavioral rescoring on existing canonical profiles
 * 
 * Purpose: Backfill rescoring_gpt on existing profiles without requiring retake
 * 
 * POST /api/admin/rescore-profile
 * Header: Authorization: Bearer <ADMIN_GPT_RESCORE_SECRET>
 * Body: { profile_id, force?: boolean, debug?: boolean }
 * 
 * Returns: { success, profile_id, rescoring_gpt_saved, primary_dimension, refreshed_at, ... }
 * 
 * SECURITY: Admin-only, requires secret key, feature-flagged
 */

import Redis from 'ioredis';
import gptBehavioralRescore from '../engine/rescoring/gptBehavioralRescore.js';
import { rescoreDimensions } from '../engine/rescoring/rescoreDimensions.js';

export default async function handler(req, res) {
  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Step 1: Security check
  const adminSecret = process.env.ADMIN_GPT_RESCORE_SECRET || process.env.ADMIN_API_KEY;
  if (!adminSecret) {
    console.error('[ADMIN RESCORE] No admin secret configured');
    return res.status(500).json({ error: 'Admin endpoint not configured' });
  }

  const authHeader = req.headers.authorization || req.headers['x-admin-key'];
  if (!authHeader) {
    console.warn('[ADMIN RESCORE] Missing authorization header');
    return res.status(401).json({ error: 'Unauthorized - missing authorization header' });
  }

  // Extract token from "Bearer <token>" or direct token
  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7)
    : authHeader;

  if (token !== adminSecret) {
    console.warn('[ADMIN RESCORE] Invalid authorization token');
    return res.status(401).json({ error: 'Unauthorized - invalid token' });
  }


  // Step 2: Feature flag check (moved up)
  if (process.env.GPT_RESCORING_ENABLED !== 'true') {
    console.warn('[ADMIN RESCORE] GPT rescoring disabled globally');
    return res.status(403).json({ error: 'GPT rescoring is disabled (GPT_RESCORING_ENABLED=false)' });
  }

  let profile_id;

  try {
    // Step 3: Parse request (inside try)
    const { profile_id: requestProfileId, force = false, debug = false } = req.body || {};
    profile_id = requestProfileId;

    if (!profile_id) {
      return res.status(400).json({ error: 'profile_id required' });
    }

    const profileIdPattern = /^m{2}-\d{8}-[a-z0-9]{8}$/i;
    if (!profileIdPattern.test(profile_id)) {
      return res.status(400).json({ error: 'Invalid Profile ID format. Expected: mm-YYYYMMDD-xxxxxxxx' });
    }

    const match = profile_id.match(/^m{2}-(\d{8})-([a-z0-9]{8})$/i);
    const datepart = match[1];
    const randompart = match[2].toLowerCase();

    console.log(`[ADMIN RESCORE] START - Profile: ${profile_id}, force: ${force}, debug: ${debug}`);
    // Step 4: Connect to Redis
    const redis = new Redis(process.env.REDIS_URL || {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined
    });

    // Step 5: Retrieve existing canonical
    console.log(`[ADMIN RESCORE] Retrieving canonical for ${profile_id}`);
    
    const lowercaseKey = `vault:profile:mm-${datepart}-${randompart}`;
    const uppercaseKey = `vault:profile:MM-${datepart}-${randompart}`;
    let retrievedKey = lowercaseKey;
    let profileJson = await redis.get(lowercaseKey);

    if (!profileJson) {
      retrievedKey = uppercaseKey;
      profileJson = await redis.get(uppercaseKey);
    }

    if (!profileJson) {
      console.warn(`[ADMIN RESCORE] Profile not found: ${lowercaseKey} or ${uppercaseKey}`);
      redis.disconnect();
      return res.status(404).json({ error: `Profile not found: ${profile_id}` });
    }

    const originalWrapper = JSON.parse(profileJson);
    let canonical = originalWrapper;
    // Unwrap if wrapped in canonical_dossier
    if (canonical.canonical_dossier && canonical.canonical_dossier.canonical_profile_json) {
      canonical = canonical.canonical_dossier.canonical_profile_json;
    } else if (canonical.canonical_profile_json) {
      canonical = canonical.canonical_profile_json;
    }
    console.log(`[ADMIN RESCORE] Canonical found - has rescoring_gpt: ${!!canonical.rescoring_gpt}`);

    // Step 6: Save previous state (if exists)
    const previousRescoreExists = !!canonical.rescoring_gpt;
    const previousRescore = previousRescoreExists ? canonical.rescoring_gpt : null;

    // Step 7: Skip if already rescored and not forced
    if (previousRescoreExists && !force) {
      console.log(`[ADMIN RESCORE] Profile already has rescoring_gpt. Use force:true to refresh.`);
      redis.disconnect();
      return res.status(200).json({
        success: true,
        profile_id,
        status: 'already_rescored',
        message: 'Profile already has GPT behavioral rescoring. Use force:true to refresh.',
        refreshed_at: canonical.rescoring_gpt?.generated_at,
        primary_dimension: canonical.rescoring_gpt?.dominance_profile?.primary_dimension
      });
    }

    // Step 7b: Ensure rescoring_v1 exists (for old profiles)
    if (!canonical.rescoring_v1) {
      console.log(`[ADMIN RESCORE] rescoring_v1 missing - generating V1 deterministic layer first...`);
      try {
        canonical.rescoring_v1 = rescoreDimensions(canonical);
        console.log(`[ADMIN RESCORE] rescoring_v1 created ✅`);
      } catch (v1Error) {
        console.error(`[ADMIN RESCORE] Failed to create rescoring_v1:`, v1Error.message);
        redis.disconnect();
        return res.status(500).json({
          error: 'Failed to create deterministic rescoring layer (rescoring_v1)',
          profile_id,
          details: v1Error.message
        });
      }
    }

    // Step 8: Run GPT behavioral rescoring
    console.log(`[ADMIN RESCORE] Running GPT behavioral rescoring...`);
    const gptRescore = await gptBehavioralRescore(canonical);

    if (!gptRescore) {
      console.error(`[ADMIN RESCORE] GPT rescoring returned null`);
      redis.disconnect();
      return res.status(500).json({
        error: 'GPT rescoring failed - no response',
        profile_id
      });
    }

    // Step 9: Validate output structure
    console.log(`[ADMIN RESCORE] Validating GPT output...`);
    const validation = validateRescoreOutput(gptRescore);

    if (!validation.valid) {
      console.error(`[ADMIN RESCORE] Validation failed:`, validation.errors);
      redis.disconnect();
      return res.status(422).json({
        error: 'GPT rescore validation failed',
        profile_id,
        validation_errors: validation.errors
      });
    }

    console.log(`[ADMIN RESCORE] Validation passed ✅`);

    // Step 10: Update canonical nested structure
    canonical.rescoring_gpt = gptRescore;
    canonical.rescoring_gpt_metadata = {
      refreshed_at: new Date().toISOString(),
      refreshed_by: 'admin_rescore_endpoint',
      previous_existed: previousRescoreExists,
      profile_id
    };

    // Store previous rescore if it existed (but only if reasonable size)
    if (previousRescoreExists && JSON.stringify(previousRescore).length < 50000) {
      canonical.rescoring_gpt_previous = previousRescore;
    }

    // Step 11: Save back to Redis (preserve original wrapper)
    console.log(`[ADMIN RESCORE] Saving updated canonical...`);
    let outputWrapper = originalWrapper;

    // Keep original wrapper structure (mutate existing)
    if (originalWrapper?.canonical_dossier?.canonical_profile_json) {
      originalWrapper.canonical_dossier.canonical_profile_json = canonical;
    } else if (originalWrapper?.canonical_profile_json) {
      originalWrapper.canonical_profile_json = canonical;
    } else {
      // Fallback if wrapper doesn't exist
      outputWrapper = {
        canonical_dossier: {
          canonical_profile_json: canonical
        }
      };
    }
    const savedJson = JSON.stringify(outputWrapper);
    await redis.set(retrievedKey, savedJson);
    console.log(`[ADMIN RESCORE] Saved to Redis ✅`);

    redis.disconnect();

    // Step 12: Prepare response
    const response = {
      success: true,
      profile_id,
      rescoring_gpt_saved: true,
      source: gptRescore.source,
      model: gptRescore.model,
      primary_dimension: gptRescore.dominance_profile?.primary_dimension,
      secondary_dimension: gptRescore.dominance_profile?.secondary_dimension,
      dominance_amplitude: gptRescore.dominance_profile?.dominance_amplitude,
      spread_type: gptRescore.dominance_profile?.spread_type,
      profile_intensity: gptRescore.dominance_profile?.profile_intensity,
      ranked_count: gptRescore.ranked_dimensions?.length || 0,
      refreshed_at: canonical.rescoring_gpt_metadata.refreshed_at,
      previous_existed: previousRescoreExists,
      render_ready_keys: gptRescore.render_ready ? Object.keys(gptRescore.render_ready) : []
    };

    // Debug mode: include full rescoring_gpt
    if (debug === true) {
      response.debug_rescoring_gpt = gptRescore;
    }

    console.log(`[ADMIN RESCORE] COMPLETE ✅ - Profile now has rescoring_gpt`);

    return res.status(200).json(response);

  } catch (err) {
    console.error('[ADMIN RESCORE] Unexpected error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err.message,
      profile_id
    });
  }
}

/**
 * Validate GPT rescore output structure
 */
function validateRescoreOutput(output) {
  const errors = [];

  if (!output) {
    errors.push('Output is null or undefined');
    return { valid: false, errors };
  }

  // Check required fields
  if (output.source !== 'gpt_behavioral_rescore') {
    errors.push(`Invalid source: ${output.source}`);
  }

  if (!Array.isArray(output.ranked_dimensions)) {
    errors.push('ranked_dimensions is not an array');
    return { valid: false, errors };
  }

  if (output.ranked_dimensions.length !== 8) {
    errors.push(`Expected 8 dimensions, got ${output.ranked_dimensions.length}`);
  }

  // Validate each dimension
  const expectedDimensions = ['vector', 'horizon', 'velocity', 'leverage', 'signal', 'fidelity', 'flex', 'framework'];
  const foundDimensions = new Set();

  output.ranked_dimensions.forEach((dim, idx) => {
    if (!dim.dimension) {
      errors.push(`Dimension ${idx} missing 'dimension' field`);
      return;
    }

    if (!expectedDimensions.includes(dim.dimension)) {
      errors.push(`Invalid dimension name: ${dim.dimension}`);
    }

    if (foundDimensions.has(dim.dimension)) {
      errors.push(`Duplicate dimension: ${dim.dimension}`);
    }
    foundDimensions.add(dim.dimension);

    if (typeof dim.gpt_rescored_score !== 'number' || dim.gpt_rescored_score < -10 || dim.gpt_rescored_score > 10) {
      errors.push(`Invalid gpt_rescored_score for ${dim.dimension}: ${dim.gpt_rescored_score}`);
    }

    if (typeof dim.confidence !== 'number' || dim.confidence < 0 || dim.confidence > 1) {
      errors.push(`Invalid confidence for ${dim.dimension}: ${dim.confidence}`);
    }
  });

  // Check dominance_profile
  if (!output.dominance_profile) {
    errors.push('Missing dominance_profile');
  } else {
    if (!output.dominance_profile.primary_dimension) {
      errors.push('dominance_profile missing primary_dimension');
    }
  }

  // Check render_ready
  if (!output.render_ready) {
    errors.push('Missing render_ready');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
