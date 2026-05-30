import crypto from 'node:crypto';
import Redis from 'ioredis';

export const VISUAL_DNA_VERSION = 'visual-dna-v1';
export const VISUAL_DNA_MODEL = process.env.VISUAL_DNA_IMAGE_MODEL || 'gpt-image-1';
export const VISUAL_DNA_PROVIDER = 'openai';

export function isVisualDNAEnabled() {
  return process.env.VISUAL_DNA_ENABLED === 'true';
}

export function normalizeProfileId(profileId) {
  const id = String(profileId || '').trim();
  const match = id.match(/^m{2}-(\d{8})-([a-z0-9]{8})$/i);
  if (!match) return null;

  return {
    input: id,
    canonical: `mm-${match[1]}-${match[2].toLowerCase()}`,
    datepart: match[1],
    randompart: match[2].toLowerCase(),
  };
}

export function getVisualDNAKey(profileId) {
  return `visual:dna:${String(profileId || '').toLowerCase()}`;
}

export function hashObject(value) {
  return crypto
    .createHash('sha256')
    .update(stableStringify(value))
    .digest('hex')
    .slice(0, 32);
}

export function createRedisClient() {
  if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL environment variable not configured');
  }
  return new Redis(process.env.REDIS_URL);
}

export async function retrieveCanonicalProfile(redis, profileId) {
  const parsed = normalizeProfileId(profileId);
  if (!parsed) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid Profile ID format. Expected: mm-YYYYMMDD-xxxxxxxx',
    };
  }

  const lowercaseKey = `vault:profile:mm-${parsed.datepart}-${parsed.randompart}`;
  const uppercaseKey = `vault:profile:MM-${parsed.datepart}-${parsed.randompart}`;
  const keyAttempts = [
    { attempt: 1, key: lowercaseKey, strategy: 'lowercase' },
    { attempt: 2, key: uppercaseKey, strategy: 'uppercase_legacy' },
  ];

  let profileData = await redis.get(lowercaseKey);
  let retrievedKey = lowercaseKey;

  if (!profileData) {
    profileData = await redis.get(uppercaseKey);
    retrievedKey = uppercaseKey;
  }

  if (!profileData) {
    return {
      ok: false,
      status: 404,
      error: 'Profile not found',
      profile_id: parsed.canonical,
      keyAttempts,
    };
  }

  try {
    return {
      ok: true,
      profile_id: parsed.canonical,
      retrievedKey,
      canonicalDossier: JSON.parse(profileData),
      keyAttempts,
    };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      error: 'Invalid profile data',
      message: error.message,
      profile_id: parsed.canonical,
      keyAttempts,
    };
  }
}

export async function readVisualDNAMetadata(redis, profileId) {
  const raw = await redis.get(getVisualDNAKey(profileId));
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('[VISUAL DNA] Metadata parse failed:', error.message);
    return null;
  }
}

export async function writeVisualDNAMetadata(redis, metadata) {
  await redis.set(getVisualDNAKey(metadata.profile_id), JSON.stringify(metadata));
}

export function isCurrentVisualDNA(metadata, { prompt_hash, profile_hash }) {
  return Boolean(
    metadata?.status === 'ready'
    && metadata?.image_url
    && metadata?.prompt_hash === prompt_hash
    && metadata?.profile_hash === profile_hash
    && metadata?.visual_dna_version === VISUAL_DNA_VERSION
  );
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  return `{${Object.keys(value).sort().map((key) => {
    return `${JSON.stringify(key)}:${stableStringify(value[key])}`;
  }).join(',')}}`;
}
