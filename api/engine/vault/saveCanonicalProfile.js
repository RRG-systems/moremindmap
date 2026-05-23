/**
 * saveCanonicalProfile.js
 * 
 * Save canonical profile to Redis Vault
 * 
 * FIXED (2026-05-23 08:15): Accept optional profile_id parameter
 * The profile_id should be generated ONCE in executeCanonicalGeneration and passed here,
 * not generated again inside this function. This prevents ID mismatch where:
 * - executeCanonicalGeneration reports profile_id X
 * - But saveCanonicalProfile saves under profile_id Y
 */

import Redis from 'ioredis';
import { generateProfileId, isValidProfileId } from './generateProfileId.js';
import { createHash } from 'crypto';

// Get Redis client (inline initialization)
function getRedis() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable not configured');
  }
  return new Redis(redisUrl);
}

/**
 * Generate profile signature (SHA-256 hash of vector scores)
 */
function generateProfileSignature(vectorScores) {
  const sig = JSON.stringify(vectorScores, Object.keys(vectorScores).sort());
  return createHash('sha256').update(sig).digest('hex').substring(0, 16);
}

/**
 * Generate slug from text (generic)
 * Lowercase, replace spaces/special chars with hyphens
 */
function generateSlug(text) {
  if (!text || typeof text !== 'string') return null;
  
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '')      // Trim leading/trailing hyphens
    .substring(0, 64);             // Max 64 chars
}

/**
 * Generate company slug from company name
 */
function generateCompanySlug(companyName) {
  return generateSlug(companyName);
}

/**
 * Save canonical profile to Vault
 * 
 * Accepts optional profile_id to prevent duplicate generation.
 * If profile_id not provided, generates one.
 */
export async function saveCanonicalProfile(options) {
  const {
    canonical_profile,     // Full canonical profile object
    profile_id = null,     // OPTIONAL: Use this ID instead of generating one
    job_id = null,
    person_name = null,
    email = null,
    company_name = null,
    assessment_version = 'mini-v2',
    model = 'canonical-v1-frontier',
    intake_answers = null,
    quality_score = null,
    metadata = {}
  } = options;
  
  const diagnostics = {
    save_timestamp: new Date().toISOString(),
    redis_provider: 'ioredis',
    redis_url_present: !!process.env.REDIS_URL,
    profile_id_provided: !!profile_id,
    vault_key_written: false,
    verification_read_attempted: false,
    verification_read_success: false,
    verification_value_length: null,
    redis_disconnect_called: false,
    error_during_save: null
  };
  
  if (!canonical_profile) {
    throw new Error('canonical_profile required');
  }
  
  // Use provided profile_id or generate new one
  // If profile_id provided, validate it
  let final_profile_id;
  if (profile_id) {
    if (!isValidProfileId(profile_id)) {
      throw new Error(`Invalid profile_id format: ${profile_id}`);
    }
    final_profile_id = profile_id;
    console.log(`[VAULT-SAVE] Using provided profile_id: ${final_profile_id}`);
  } else {
    final_profile_id = generateProfileId();
    console.log(`[VAULT-SAVE] Generated new profile_id: ${final_profile_id}`);
  }
  
  // Extract core data
  const vector_scores = canonical_profile.vector_scores || {};
  const profile_signature = generateProfileSignature(vector_scores);
  const created_at = new Date().toISOString();
  const date_key = created_at.substring(0, 10); // YYYY-MM-DD
  const company_slug = generateCompanySlug(company_name);
  
  // Build vault record
  const vault_record = {
    profile_id: final_profile_id,
    job_id,
    person_name,
    email,
    company_name,
    company_slug,
    created_at,
    assessment_version,
    model,
    canonical_profile_json: canonical_profile,
    vector_scores,
    profile_signature,
    intake_answers,
    quality_score,
    metadata: {
      ...metadata,
      saved_by: 'vault-v1',
      vault_version: '1.0.0'
    }
  };
  
  // Get Redis client
  const redis = getRedis();
  
  try {
    // Save main profile
    const profile_key = `vault:profile:${final_profile_id}`;
    console.log(`[VAULT-SAVE] Writing key: ${profile_key} (${JSON.stringify(vault_record).length} bytes)`);
    
    const setResult = await redis.set(profile_key, JSON.stringify(vault_record));
    diagnostics.vault_key_written = true;
    console.log(`[VAULT-SAVE] Set result: ${setResult}`);
    
    // Add to date index
    const date_index_key = `vault:index:date:${date_key}`;
    await redis.sadd(date_index_key, final_profile_id);
    
    // Add to email index if email provided
    if (email) {
      const email_index_key = `vault:index:email:${email.toLowerCase()}`;
      await redis.sadd(email_index_key, final_profile_id);
    }
    
    // Add to company index if company provided
    if (company_slug) {
      const company_index_key = `vault:index:company:${company_slug}`;
      await redis.sadd(company_index_key, final_profile_id);
    }
    
    // Add organizational context indexes
    if (metadata?.organization) {
      const org = metadata.organization;
      
      // Department index
      if (org.department && org.department !== 'Other') {
        const dept_slug = generateSlug(org.department);
        if (dept_slug) {
          await redis.sadd(`vault:index:department:${dept_slug}`, final_profile_id);
        }
      }
      
      // Role index
      if (org.role_title) {
        const role_slug = generateSlug(org.role_title);
        if (role_slug) {
          await redis.sadd(`vault:index:role:${role_slug}`, final_profile_id);
        }
      }
      
      // Manager index
      if (org.reports_to) {
        const manager_slug = generateSlug(org.reports_to);
        if (manager_slug) {
          await redis.sadd(`vault:index:manager:${manager_slug}`, final_profile_id);
        }
      }
      
      // Industry index
      if (org.industry && org.industry !== 'Other') {
        const industry_slug = generateSlug(org.industry);
        if (industry_slug) {
          await redis.sadd(`vault:index:industry:${industry_slug}`, final_profile_id);
        }
      }
      
      // Org context multi-select index
      if (Array.isArray(org.org_context) && org.org_context.length > 0) {
        for (const context of org.org_context) {
          const ctx_slug = generateSlug(context);
          if (ctx_slug) {
            await redis.sadd(`vault:index:org_context:${ctx_slug}`, final_profile_id);
          }
        }
      }
    }
    
    // Increment total count
    await redis.incr('vault:metadata:count');
    
    // Verify the profile was actually saved by reading it back
    diagnostics.verification_read_attempted = true;
    console.log(`[VAULT-SAVE] Attempting verification read on same Redis client: ${profile_key}`);
    
    const verifyRead = await redis.get(profile_key);
    
    if (verifyRead) {
      diagnostics.verification_read_success = true;
      diagnostics.verification_value_length = verifyRead.length;
      console.log(`[VAULT-SAVE] ✓ Verification read SUCCESS: ${verifyRead.length} bytes`);
    } else {
      diagnostics.verification_read_success = false;
      console.log(`[VAULT-SAVE] ✗ Verification read FAILED: Key returned null/undefined`);
      throw new Error(`Profile save verification failed: ${profile_key} not found after write on same client`);
    }
    
    return {
      profile_id: final_profile_id,
      profile_signature,
      created_at,
      vault_key: profile_key,
      company_slug,
      success: true,
      diagnostics  // ← Return diagnostic data
    };
  } catch (error) {
    diagnostics.error_during_save = error.message;
    console.error(`[VAULT-SAVE] Error: ${error.message}`);
    throw error;
  } finally {
    // Always disconnect Redis to ensure writes are flushed to Redis
    try {
      redis.disconnect();
      diagnostics.redis_disconnect_called = true;
      console.log(`[VAULT-SAVE] Redis disconnected`);
    } catch (disconnectErr) {
      console.error(`[VAULT-SAVE] Error during disconnect: ${disconnectErr.message}`);
    }
  }
}

/**
 * Save canonical profile markdown separately (optional, for quick access)
 * 
 * profile_id: The EXACT profile_id to use (must match the profile's vault:profile:{profile_id})
 */
export async function saveCanonicalMarkdown(profile_id, markdown_content) {
  if (!profile_id || typeof profile_id !== 'string') {
    throw new Error('profile_id required and must be string');
  }
  if (!isValidProfileId(profile_id)) {
    throw new Error(`Invalid profile_id format: ${profile_id}`);
  }
  
  const redis = getRedis();
  
  try {
    const markdown_key = `vault:markdown:${profile_id}`;
    
    console.log(`[VAULT-MARKDOWN] Writing key: ${markdown_key} (${markdown_content.length} bytes)`);
    
    await redis.set(markdown_key, markdown_content);
    
    // Verify markdown was saved
    const verifyRead = await redis.get(markdown_key);
    if (!verifyRead) {
      console.log(`[VAULT-MARKDOWN] ✗ Verification read FAILED`);
      throw new Error(`Markdown save verification failed: ${markdown_key} not found after write`);
    }
    
    console.log(`[VAULT-MARKDOWN] ✓ Verification read SUCCESS: ${verifyRead.length} bytes`);
    
    return {
      profile_id,
      markdown_key,
      markdown_size: markdown_content.length,
      success: true
    };
  } finally {
    redis.disconnect();
    console.log(`[VAULT-MARKDOWN] Redis disconnected`);
  }
}
