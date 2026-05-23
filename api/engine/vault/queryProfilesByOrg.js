/**
 * queryProfilesByOrg.js
 * 
 * Query canonical profiles by organizational context
 */

import Redis from 'ioredis';
import { getCanonicalProfile } from './getCanonicalProfile.js';

// Get Redis client (inline initialization)
function getRedis() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable not configured');
  }
  return new Redis(redisUrl);
}

/**
 * Get profiles by department
 */
export async function getProfilesByDepartment(department) {
  if (!department || typeof department !== 'string') {
    return [];
  }
  
  const redis = getRedis();
  const dept_slug = department
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 64);
  
  const profile_ids = await redis.smembers(`vault:index:department:${dept_slug}`);
  
  if (!profile_ids || profile_ids.length === 0) {
    return [];
  }
  
  const profiles = await Promise.all(
    profile_ids.map(id => getCanonicalProfile(id))
  );
  
  return profiles.filter(p => p.found);
}

/**
 * Get profiles by role
 */
export async function getProfilesByRole(role) {
  if (!role || typeof role !== 'string') {
    return [];
  }
  
  const redis = getRedis();
  const role_slug = role
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 64);
  
  const profile_ids = await redis.smembers(`vault:index:role:${role_slug}`);
  
  if (!profile_ids || profile_ids.length === 0) {
    return [];
  }
  
  const profiles = await Promise.all(
    profile_ids.map(id => getCanonicalProfile(id))
  );
  
  return profiles.filter(p => p.found);
}

/**
 * Get profiles by manager
 */
export async function getProfilesByManager(manager) {
  if (!manager || typeof manager !== 'string') {
    return [];
  }
  
  const redis = getRedis();
  const manager_slug = manager
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 64);
  
  const profile_ids = await redis.smembers(`vault:index:manager:${manager_slug}`);
  
  if (!profile_ids || profile_ids.length === 0) {
    return [];
  }
  
  const profiles = await Promise.all(
    profile_ids.map(id => getCanonicalProfile(id))
  );
  
  return profiles.filter(p => p.found);
}

/**
 * Get profiles by industry
 */
export async function getProfilesByIndustry(industry) {
  if (!industry || typeof industry !== 'string') {
    return [];
  }
  
  const redis = getRedis();
  const industry_slug = industry
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 64);
  
  const profile_ids = await redis.smembers(`vault:index:industry:${industry_slug}`);
  
  if (!profile_ids || profile_ids.length === 0) {
    return [];
  }
  
  const profiles = await Promise.all(
    profile_ids.map(id => getCanonicalProfile(id))
  );
  
  return profiles.filter(p => p.found);
}

/**
 * Get profiles by org context
 */
export async function getProfilesByOrgContext(context) {
  if (!context || typeof context !== 'string') {
    return [];
  }
  
  const redis = getRedis();
  const ctx_slug = context
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 64);
  
  const profile_ids = await redis.smembers(`vault:index:org_context:${ctx_slug}`);
  
  if (!profile_ids || profile_ids.length === 0) {
    return [];
  }
  
  const profiles = await Promise.all(
    profile_ids.map(id => getCanonicalProfile(id))
  );
  
  return profiles.filter(p => p.found);
}

/**
 * Get profiles by company
 */
export async function getProfilesByCompany(company) {
  if (!company || typeof company !== 'string') {
    return [];
  }
  
  const redis = getRedis();
  const company_slug = company
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 64);
  
  const profile_ids = await redis.smembers(`vault:index:company:${company_slug}`);
  
  if (!profile_ids || profile_ids.length === 0) {
    return [];
  }
  
  const profiles = await Promise.all(
    profile_ids.map(id => getCanonicalProfile(id))
  );
  
  return profiles.filter(p => p.found);
}
