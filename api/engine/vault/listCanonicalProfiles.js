/**
 * listCanonicalProfiles.js
 * 
 * List and query canonical profiles from Redis Vault
 */

import Redis from 'ioredis';
import { getCanonicalProfiles } from './getCanonicalProfile.js';

// Get Redis client (inline initialization)
function getRedis() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable not configured');
  }
  return new Redis(redisUrl);
}

/**
 * List profiles created on specific date
 */
export async function listProfilesByDate(date) {
  // date format: YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Invalid date format. Expected: YYYY-MM-DD');
  }
  
  const redis = getRedis();
  const date_index_key = `vault:index:date:${date}`;
  
  const profile_ids = await redis.smembers(date_index_key);
  
  return {
    date,
    count: profile_ids.length,
    profile_ids: profile_ids.sort()
  };
}

/**
 * List profiles for specific email
 */
export async function listProfilesByEmail(email) {
  if (!email) {
    throw new Error('Email required');
  }
  
  const redis = getRedis();
  const email_index_key = `vault:index:email:${email.toLowerCase()}`;
  
  const profile_ids = await redis.smembers(email_index_key);
  
  return {
    email,
    count: profile_ids.length,
    profile_ids: profile_ids.sort()
  };
}

/**
 * Get total profile count
 */
export async function getVaultStats() {
  const redis = getRedis();
  
  const total_count = await redis.get('vault:metadata:count');
  
  // Get all date indexes
  const date_keys = await redis.keys('vault:index:date:*');
  const dates = date_keys.map(key => key.replace('vault:index:date:', ''));
  
  // Get all email indexes
  const email_keys = await redis.keys('vault:index:email:*');
  const emails = email_keys.map(key => key.replace('vault:index:email:', ''));
  
  return {
    total_profiles: parseInt(total_count || 0, 10),
    dates_with_profiles: dates.length,
    unique_emails: emails.length,
    earliest_date: dates.length > 0 ? dates.sort()[0] : null,
    latest_date: dates.length > 0 ? dates.sort()[dates.length - 1] : null
  };
}

/**
 * List recent profiles (last N)
 */
export async function listRecentProfiles(limit = 10) {
  const redis = getRedis();
  
  // Get all profile keys
  const profile_keys = await redis.keys('vault:profile:*');
  
  if (profile_keys.length === 0) {
    return {
      count: 0,
      profiles: []
    };
  }
  
  // Get all profiles and sort by created_at
  const all_data = await Promise.all(
    profile_keys.map(async key => {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    })
  );
  
  const valid_profiles = all_data.filter(p => p !== null);
  
  // Sort by created_at descending
  valid_profiles.sort((a, b) => {
    return new Date(b.created_at) - new Date(a.created_at);
  });
  
  // Return limited set with summary info
  const recent = valid_profiles.slice(0, limit).map(p => ({
    profile_id: p.profile_id,
    person_name: p.person_name,
    email: p.email,
    created_at: p.created_at,
    profile_signature: p.profile_signature,
    quality_score: p.quality_score,
    model: p.model
  }));
  
  return {
    count: recent.length,
    total_available: valid_profiles.length,
    profiles: recent
  };
}

/**
 * Search profiles by name (case-insensitive partial match)
 */
export async function searchProfilesByName(name_query) {
  if (!name_query || name_query.length < 2) {
    throw new Error('Name query must be at least 2 characters');
  }
  
  const redis = getRedis();
  const profile_keys = await redis.keys('vault:profile:*');
  
  if (profile_keys.length === 0) {
    return {
      query: name_query,
      count: 0,
      profiles: []
    };
  }
  
  const all_data = await Promise.all(
    profile_keys.map(async key => {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    })
  );
  
  const query_lower = name_query.toLowerCase();
  
  const matches = all_data
    .filter(p => p !== null && p.person_name)
    .filter(p => p.person_name.toLowerCase().includes(query_lower))
    .map(p => ({
      profile_id: p.profile_id,
      person_name: p.person_name,
      email: p.email,
      created_at: p.created_at,
      profile_signature: p.profile_signature
    }));
  
  return {
    query: name_query,
    count: matches.length,
    profiles: matches
  };
}
