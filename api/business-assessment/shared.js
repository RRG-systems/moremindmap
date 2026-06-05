import crypto from 'crypto';
import Redis from 'ioredis';

export const ASSESSMENT_VERSION = 'business_assessment_v1_intake';

const DIMENSION_LABELS = {
  vector: 'Command',
  velocity: 'Tempo',
  signal: 'Signal',
  fidelity: 'Precision',
  framework: 'Structure',
  flex: 'Adaptability',
  leverage: 'Leverage',
  horizon: 'Perspective'
};

export function setCors(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
}

export function createRedisClient() {
  if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL environment variable not configured');
  }
  return new Redis(process.env.REDIS_URL);
}

export function parseProfileId(profileId) {
  const id = String(profileId || '').trim();
  const match = id.match(/^m{2}-(\d{8})-([a-z0-9]{8})$/i);
  if (!match) return null;
  return {
    input: id,
    datepart: match[1],
    randompart: match[2].toLowerCase(),
    normalized: `mm-${match[1]}-${match[2].toLowerCase()}`
  };
}

export function buildProfileKeys(parsedProfileId) {
  return [
    `vault:profile:mm-${parsedProfileId.datepart}-${parsedProfileId.randompart}`,
    `vault:profile:MM-${parsedProfileId.datepart}-${parsedProfileId.randompart}`
  ];
}

export async function getCanonicalProfile(redis, profileId) {
  const parsed = parseProfileId(profileId);
  if (!parsed) {
    return { found: false, error: 'invalid_profile_id', profile_id: profileId, key_attempts: [] };
  }

  const keyAttempts = [];
  for (const key of buildProfileKeys(parsed)) {
    keyAttempts.push({ key });
    const raw = await redis.get(key);
    if (!raw) continue;

    try {
      return {
        found: true,
        profile_id: parsed.normalized,
        key,
        key_attempts: keyAttempts,
        dossier: JSON.parse(raw)
      };
    } catch {
      return {
        found: false,
        error: 'invalid_profile_json',
        profile_id: parsed.normalized,
        key,
        key_attempts: keyAttempts
      };
    }
  }

  return { found: false, error: 'profile_not_found', profile_id: parsed.normalized, key_attempts: keyAttempts };
}

function unwrapCanonical(dossier) {
  return dossier?.canonical_profile_json || dossier?.canonical_dossier?.canonical_profile_json || dossier;
}

function normalizeDimensionName(value) {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('vector') || raw.includes('command')) return 'vector';
  if (raw.includes('velocity') || raw.includes('tempo')) return 'velocity';
  if (raw.includes('signal')) return 'signal';
  if (raw.includes('fidelity') || raw.includes('precision')) return 'fidelity';
  if (raw.includes('framework') || raw.includes('structure')) return 'framework';
  if (raw.includes('flex') || raw.includes('adapt')) return 'flex';
  if (raw.includes('leverage')) return 'leverage';
  if (raw.includes('horizon') || raw.includes('perspective')) return 'horizon';
  return raw;
}

function dimensionLabel(value) {
  const key = normalizeDimensionName(value);
  return DIMENSION_LABELS[key] || value || 'Profile';
}

function rankedDimensions(canonical) {
  return (
    canonical?.rescoring_gpt?.ranked_dimensions ||
    canonical?.rescoring_v1?.ranked_dimensions ||
    canonical?.ranked_dimensions ||
    canonical?.dimension_scores ||
    []
  );
}

export function extractProfileContext(dossier, ownerProfileId) {
  const canonical = unwrapCanonical(dossier);
  const metadata = canonical?.metadata || canonical?.profile_metadata || {};
  const answers = canonical?.answers || canonical?.assessment_answers || {};
  const name =
    dossier?.person_name ||
    canonical?.person_name ||
    canonical?.full_name ||
    canonical?.name ||
    metadata?.person_name ||
    metadata?.full_name ||
    metadata?.name ||
    answers?.name?.answer_text ||
    answers?.full_name?.answer_text ||
    'Profile Found';

  const explicit =
    canonical?.profile_type ||
    canonical?.inferred_patterns?.profile_type ||
    canonical?.behavioral_profile?.profile_type ||
    canonical?.render_ready?.profile_dna;

  let profileType = explicit;
  if (!profileType || typeof profileType !== 'string') {
    const ranked = rankedDimensions(canonical);
    const primary = ranked?.[0]?.dimension || ranked?.[0]?.name || ranked?.[0]?.key;
    const secondary = ranked?.[1]?.dimension || ranked?.[1]?.name || ranked?.[1]?.key;
    if (primary && secondary) profileType = `${dimensionLabel(primary)} / ${dimensionLabel(secondary)}`;
    else if (primary) profileType = dimensionLabel(primary);
    else profileType = 'MORE MindMap Profile';
  }

  return {
    owner_profile_id: ownerProfileId,
    owner_profile_name: name,
    owner_profile_type: profileType
  };
}

export function parseTeamProfileIds(text) {
  const matches = String(text || '').match(/\bMM-\d{8}-[a-z0-9]{8}\b/gi) || [];
  return [...new Set(matches.map((id) => id.toLowerCase()))];
}

export function createAssessmentId(now = new Date()) {
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `ba-${ymd}-${crypto.randomBytes(4).toString('hex')}`;
}

export function createJobId() {
  return crypto.randomUUID();
}

export function businessAssessmentKey(assessmentId) {
  return `business_assessment:${assessmentId}`;
}

export function businessAssessmentByProfileKey(profileId) {
  const parsed = parseProfileId(profileId);
  return `business_assessment_by_profile:${parsed?.normalized || String(profileId || '').trim().toLowerCase()}`;
}

export function businessAssessmentJobKey(jobId) {
  return `business_assessment_job:${jobId}`;
}
