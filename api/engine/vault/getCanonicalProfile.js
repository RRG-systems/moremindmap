/**
 * getCanonicalProfile.js
 * 
 * Retrieve canonical profile from Redis Vault
 */

import Redis from 'ioredis';
import { isValidProfileId } from './generateProfileId.js';

// Get Redis client (inline initialization)
function getRedis() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable not configured');
  }
  return new Redis(redisUrl);
}

/**
 * Get canonical profile by profile_id
 */
export async function getCanonicalProfile(profile_id) {
  if (!isValidProfileId(profile_id)) {
    throw new Error('Invalid profile_id format');
  }
  
  const redis = getRedis();
  const profile_key = `vault:profile:${profile_id}`;
  
  const data = await redis.get(profile_key);
  
  if (!data) {
    return {
      found: false,
      profile_id,
      error: 'Profile not found'
    };
  }
  
  const vault_record = JSON.parse(data);
  
  return {
    found: true,
    profile_id,
    ...vault_record
  };
}

/**
 * Get canonical profile markdown
 */
export async function getCanonicalMarkdown(profile_id) {
  if (!isValidProfileId(profile_id)) {
    throw new Error('Invalid profile_id format');
  }
  
  const redis = getRedis();
  const markdown_key = `vault:markdown:${profile_id}`;
  
  const markdown = await redis.get(markdown_key);
  
  if (!markdown) {
    return {
      found: false,
      profile_id,
      error: 'Markdown not found'
    };
  }
  
  return {
    found: true,
    profile_id,
    markdown,
    markdown_size: markdown.length
  };
}

/**
 * Check if profile exists
 */
export async function profileExists(profile_id) {
  if (!isValidProfileId(profile_id)) {
    return false;
  }
  
  const redis = getRedis();
  const profile_key = `vault:profile:${profile_id}`;
  
  const exists = await redis.exists(profile_key);
  return exists === 1;
}

/**
 * Get multiple profiles by IDs
 */
export async function getCanonicalProfiles(profile_ids) {
  if (!Array.isArray(profile_ids) || profile_ids.length === 0) {
    return [];
  }
  
  const results = await Promise.all(
    profile_ids.map(id => getCanonicalProfile(id))
  );
  
  return results.filter(r => r.found);
}
