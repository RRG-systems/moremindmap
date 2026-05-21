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
 * Generate company slug from company name
 * Lowercase, replace spaces/special chars with hyphens
 */
function generateCompanySlug(companyName) {
  if (!companyName || typeof companyName !== 'string') return null;
  
  return companyName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '')      // Trim leading/trailing hyphens
    .substring(0, 64);             // Max 64 chars
}

/**
 * Save canonical profile to Vault
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
  
  // Increment total count
  await redis.incr('vault:metadata:count');
  
  return {
    profile_id,
    profile_signature,
    created_at,
    vault_key: profile_key,
    company_slug,
    success: true
  };
}

/**
 * Save canonical profile markdown separately (optional, for quick access)
 */
export async function saveCanonicalMarkdown(profile_id, markdown_content) {
  if (!isValidProfileId(profile_id)) {
    throw new Error('Invalid profile_id format');
  }
  
  const redis = getRedis();
  const markdown_key = `vault:markdown:${profile_id}`;
  
  await redis.set(markdown_key, markdown_content);
  
  return {
    profile_id,
    markdown_key,
    markdown_size: markdown_content.length,
    success: true
  };
}
