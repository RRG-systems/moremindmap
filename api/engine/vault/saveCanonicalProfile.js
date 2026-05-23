/**
 * saveCanonicalProfile.js
 * 
 * Save canonical profile to Redis Vault
 * 
 * INSTRUMENTED: Detailed logging of Redis operations, provider, and write verification
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
  
  // Log provider details
  console.log(`[REDIS-INIT] REDIS_URL env var: ${redisUrl}`);
  console.log(`[REDIS-INIT] Creating ioredis.Redis instance`);
  
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
 * Instrumented with comprehensive Redis diagnostics
 */
export async function saveCanonicalProfile(options) {
  const {
    canonical_profile,     
    profile_id = null,     
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
    timestamp: new Date().toISOString(),
    redis_module: 'ioredis',
    redis_url_env: process.env.REDIS_URL || 'NOT_SET',
    redis_url_host_extracted: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'N/A',
    profile_id_provided: !!profile_id,
    operations: []
  };
  
  if (!canonical_profile) {
    throw new Error('canonical_profile required');
  }
  
  // Use provided profile_id or generate new one
  let final_profile_id;
  if (profile_id) {
    if (!isValidProfileId(profile_id)) {
      throw new Error(`Invalid profile_id format: ${profile_id}`);
    }
    // Normalize to lowercase for consistency (Redis keys are case-sensitive)
    final_profile_id = profile_id.toLowerCase();
    diagnostics.operations.push({ step: 'profile_id_provided', value: final_profile_id, original: profile_id });
  } else {
    final_profile_id = generateProfileId();
    diagnostics.operations.push({ step: 'profile_id_generated', value: final_profile_id });
  }
  
  // Extract core data
  const vector_scores = canonical_profile.vector_scores || {};
  const profile_signature = generateProfileSignature(vector_scores);
  const created_at = new Date().toISOString();
  const date_key = created_at.substring(0, 10);
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
  
  const vault_record_json = JSON.stringify(vault_record);
  const vault_record_bytes = Buffer.byteLength(vault_record_json, 'utf8');
  
  diagnostics.operations.push({ step: 'vault_record_serialized', bytes: vault_record_bytes });
  
  // Get Redis client
  const redis = getRedis();
  
  try {
    // STEP 1: SET profile key
    const profile_key = `vault:profile:${final_profile_id}`;
    console.log(`[VAULT-SAVE] SET ${profile_key} (${vault_record_bytes} bytes)`);
    
    const setResult = await redis.set(profile_key, vault_record_json);
    diagnostics.operations.push({ 
      step: 'redis_set_completed', 
      key: profile_key,
      set_result: setResult,
      bytes_written: vault_record_bytes
    });
    console.log(`[VAULT-SAVE] SET result: ${setResult}`);
    
    // STEP 2: Verify EXISTS immediately
    const existsResult = await redis.exists(profile_key);
    diagnostics.operations.push({ 
      step: 'redis_exists_check',
      key: profile_key,
      exists: existsResult === 1,
      exists_value: existsResult
    });
    console.log(`[VAULT-SAVE] EXISTS ${profile_key}: ${existsResult}`);
    
    // STEP 3: Verify GET immediately on same client
    const getResult = await redis.get(profile_key);
    const getResultBytes = getResult ? Buffer.byteLength(getResult, 'utf8') : 0;
    const getResultMatches = getResult === vault_record_json;
    
    diagnostics.operations.push({ 
      step: 'redis_get_verification',
      key: profile_key,
      get_returned_bytes: getResultBytes,
      expected_bytes: vault_record_bytes,
      bytes_match: getResultBytes === vault_record_bytes,
      content_match: getResultMatches,
      get_null: getResult === null,
      get_undefined: getResult === undefined
    });
    console.log(`[VAULT-SAVE] GET ${profile_key}: ${getResultBytes} bytes (expected ${vault_record_bytes})`);
    console.log(`[VAULT-SAVE] GET content matches: ${getResultMatches}`);
    
    if (!getResult) {
      diagnostics.operations.push({ step: 'verification_failed', error: 'GET returned null/undefined' });
      throw new Error(`[VAULT-SAVE] Profile save verification FAILED: GET returned nothing`);
    }
    
    if (getResultBytes !== vault_record_bytes) {
      diagnostics.operations.push({ 
        step: 'verification_failed', 
        error: `Byte mismatch: set ${vault_record_bytes}, got ${getResultBytes}` 
      });
      throw new Error(`[VAULT-SAVE] Profile save verification FAILED: Byte mismatch`);
    }
    
    diagnostics.operations.push({ step: 'verification_passed' });
    console.log(`[VAULT-SAVE] ✓ Verification PASSED`);
    
    // Add to date index
    const date_index_key = `vault:index:date:${date_key}`;
    await redis.sadd(date_index_key, final_profile_id);
    diagnostics.operations.push({ step: 'date_index_added', key: date_index_key });
    
    // Add to email index if email provided
    if (email) {
      const email_index_key = `vault:index:email:${email.toLowerCase()}`;
      await redis.sadd(email_index_key, final_profile_id);
      diagnostics.operations.push({ step: 'email_index_added', key: email_index_key });
    }
    
    // Add to company index if company provided
    if (company_slug) {
      const company_index_key = `vault:index:company:${company_slug}`;
      await redis.sadd(company_index_key, final_profile_id);
      diagnostics.operations.push({ step: 'company_index_added', key: company_index_key });
    }
    
    // Add organizational context indexes
    if (metadata?.organization) {
      const org = metadata.organization;
      
      if (org.department && org.department !== 'Other') {
        const dept_slug = generateSlug(org.department);
        if (dept_slug) {
          await redis.sadd(`vault:index:department:${dept_slug}`, final_profile_id);
        }
      }
      
      if (org.role_title) {
        const role_slug = generateSlug(org.role_title);
        if (role_slug) {
          await redis.sadd(`vault:index:role:${role_slug}`, final_profile_id);
        }
      }
      
      if (org.reports_to) {
        const manager_slug = generateSlug(org.reports_to);
        if (manager_slug) {
          await redis.sadd(`vault:index:manager:${manager_slug}`, final_profile_id);
        }
      }
      
      if (org.industry && org.industry !== 'Other') {
        const industry_slug = generateSlug(org.industry);
        if (industry_slug) {
          await redis.sadd(`vault:index:industry:${industry_slug}`, final_profile_id);
        }
      }
      
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
    diagnostics.operations.push({ step: 'metadata_count_incremented' });
    
    diagnostics.success = true;
    diagnostics.profile_id_saved = final_profile_id;
    diagnostics.vault_key = profile_key;
    
    return {
      profile_id: final_profile_id,
      profile_signature,
      created_at,
      vault_key: profile_key,
      company_slug,
      success: true,
      diagnostics  // ← Full diagnostic payload
    };
  } catch (error) {
    diagnostics.success = false;
    diagnostics.error: error.message;
    diagnostics.operations.push({ step: 'error_thrown', error: error.message });
    console.error(`[VAULT-SAVE] Error: ${error.message}`);
    throw error;
  } finally {
    try {
      redis.disconnect();
      diagnostics.operations.push({ step: 'redis_disconnected' });
      console.log(`[VAULT-SAVE] Redis disconnected`);
    } catch (disconnectErr) {
      diagnostics.operations.push({ step: 'disconnect_error', error: disconnectErr.message });
      console.error(`[VAULT-SAVE] Disconnect error: ${disconnectErr.message}`);
    }
  }
}

/**
 * Save canonical profile markdown separately
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
    
    console.log(`[VAULT-MARKDOWN] SET ${markdown_key} (${markdown_content.length} bytes)`);
    
    await redis.set(markdown_key, markdown_content);
    
    // Verify
    const verifyRead = await redis.get(markdown_key);
    if (!verifyRead) {
      throw new Error(`Markdown save verification failed: ${markdown_key} not found after write`);
    }
    
    console.log(`[VAULT-MARKDOWN] ✓ Verification PASSED`);
    
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
