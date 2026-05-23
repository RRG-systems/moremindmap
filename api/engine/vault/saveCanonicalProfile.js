/**
 * saveCanonicalProfile.js
 * 
 * Save canonical profile to Redis Vault
 * 
 * Storage structure:
 * - vault:profile:{profile_id} → full profile JSON
 * - vault:index:date:{YYYY-MM-DD} → set of profile_ids created that day
 * - vault:index:email:{email} → set of profile_ids for that email
 * - vault:index:company:{company_slug} → set of profile_ids for that company
 * - vault:index:department:{dept_slug} → set of profile_ids by department
 * - vault:index:role:{role_slug} → set of profile_ids by role
 * - vault:index:manager:{manager_slug} → set of profile_ids by reports_to
 * - vault:index:industry:{industry_slug} → set of profile_ids by industry
 * - vault:index:org_context:{context_slug} → set of profile_ids by org context
 * - vault:metadata:count → total profile count
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
 * FIX (2026-05-23): Added Redis disconnect in finally block to ensure
 * writes are flushed before returning success. Added verification read
 * to confirm profile actually persisted.
 */
export async function saveCanonicalProfile(options) {
  const {
    canonical_profile,     // Full canonical profile object
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
  
  if (!canonical_profile) {
    throw new Error('canonical_profile required');
  }
  
  // Generate permanent profile_id
  const profile_id = generateProfileId();
  
  // Extract core data
  const vector_scores = canonical_profile.vector_scores || {};
  const profile_signature = generateProfileSignature(vector_scores);
  const created_at = new Date().toISOString();
  const date_key = created_at.substring(0, 10); // YYYY-MM-DD
  const company_slug = generateCompanySlug(company_name);
  
  // Build vault record
  const vault_record = {
    profile_id,
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
    const profile_key = `vault:profile:${profile_id}`;
    await redis.set(profile_key, JSON.stringify(vault_record));
    
    // Add to date index
    const date_index_key = `vault:index:date:${date_key}`;
    await redis.sadd(date_index_key, profile_id);
    
    // Add to email index if email provided
    if (email) {
      const email_index_key = `vault:index:email:${email.toLowerCase()}`;
      await redis.sadd(email_index_key, profile_id);
    }
    
    // Add to company index if company provided
    if (company_slug) {
      const company_index_key = `vault:index:company:${company_slug}`;
      await redis.sadd(company_index_key, profile_id);
    }
    
    // Add organizational context indexes
    if (metadata?.organization) {
      const org = metadata.organization;
      
      // Department index
      if (org.department && org.department !== 'Other') {
        const dept_slug = generateSlug(org.department);
        if (dept_slug) {
          await redis.sadd(`vault:index:department:${dept_slug}`, profile_id);
        }
      }
      
      // Role index
      if (org.role_title) {
        const role_slug = generateSlug(org.role_title);
        if (role_slug) {
          await redis.sadd(`vault:index:role:${role_slug}`, profile_id);
        }
      }
      
      // Manager index
      if (org.reports_to) {
        const manager_slug = generateSlug(org.reports_to);
        if (manager_slug) {
          await redis.sadd(`vault:index:manager:${manager_slug}`, profile_id);
        }
      }
      
      // Industry index
      if (org.industry && org.industry !== 'Other') {
        const industry_slug = generateSlug(org.industry);
        if (industry_slug) {
          await redis.sadd(`vault:index:industry:${industry_slug}`, profile_id);
        }
      }
      
      // Org context multi-select index
      if (Array.isArray(org.org_context) && org.org_context.length > 0) {
        for (const context of org.org_context) {
          const ctx_slug = generateSlug(context);
          if (ctx_slug) {
            await redis.sadd(`vault:index:org_context:${ctx_slug}`, profile_id);
          }
        }
      }
    }
    
    // Increment total count
    await redis.incr('vault:metadata:count');
    
    // Verify the profile was actually saved by reading it back
    const verifyRead = await redis.get(profile_key);
    if (!verifyRead) {
      throw new Error(`Profile save verification failed: ${profile_key} not found after write`);
    }
    
    return {
      profile_id,
      profile_signature,
      created_at,
      vault_key: profile_key,
      company_slug,
      success: true
    };
  } finally {
    // Always disconnect Redis to ensure writes are flushed to Redis
    redis.disconnect();
  }
}

/**
 * Save canonical profile markdown separately (optional, for quick access)
 */
export async function saveCanonicalMarkdown(profile_id, markdown_content) {
  if (!isValidProfileId(profile_id)) {
    throw new Error('Invalid profile_id format');
  }
  
  const redis = getRedis();
  
  try {
    const markdown_key = `vault:markdown:${profile_id}`;
    
    await redis.set(markdown_key, markdown_content);
    
    // Verify markdown was saved
    const verifyRead = await redis.get(markdown_key);
    if (!verifyRead) {
      throw new Error(`Markdown save verification failed: ${markdown_key} not found after write`);
    }
    
    return {
      profile_id,
      markdown_key,
      markdown_size: markdown_content.length,
      success: true
    };
  } finally {
    redis.disconnect();
  }
}
