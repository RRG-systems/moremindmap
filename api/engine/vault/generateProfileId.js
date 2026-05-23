/**
 * generateProfileId.js
 * 
 * Generate permanent profile_id for canonical dossiers
 * Format: mm-YYYYMMDD-SHORTUUID (lowercase for Redis key consistency)
 * 
 * Example: mm-20260521-a3f9k2x7
 */

import { randomBytes } from 'crypto';

/**
 * Generate short UUID (8 characters, lowercase alphanumeric)
 */
function generateShortUUID() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(8);
  let result = '';
  
  for (let i = 0; i < 8; i++) {
    result += chars[bytes[i] % chars.length];
  }
  
  return result;
}

/**
 * Generate profile ID
 * Format: mm-YYYYMMDD-SHORTUUID (lowercase for Redis key consistency)
 */
export function generateProfileId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const shortUUID = generateShortUUID();
  
  return `mm-${year}${month}${day}-${shortUUID}`;
}

/**
 * Validate profile ID format
 */
export function isValidProfileId(profileId) {
  if (typeof profileId !== 'string') return false;
  
  // Match: mm-YYYYMMDD-XXXXXXXX (8 lowercase alphanumeric chars)
  // Always lowercase for consistency (Redis keys are case-sensitive)
  const pattern = /^mm-\d{8}-[a-z0-9]{8}$/;
  return pattern.test(profileId);
}

/**
 * Extract date from profile ID
 */
export function extractDateFromProfileId(profileId) {
  if (!isValidProfileId(profileId)) return null;
  
  const datePart = profileId.split('-')[1]; // YYYYMMDD
  const year = datePart.substring(0, 4);
  const month = datePart.substring(4, 6);
  const day = datePart.substring(6, 8);
  
  return `${year}-${month}-${day}`;
}
