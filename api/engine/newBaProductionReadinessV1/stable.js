import crypto from 'node:crypto';

export function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function sha256Stable(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

export function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export function normalizeProfileId(profileId) {
  const normalized = String(profileId || '').trim().toUpperCase();
  if (!/^MM-[A-Z0-9-]+$/u.test(normalized)) throw new Error('new_ba_profile_id_invalid');
  return normalized;
}

export function normalizeAssessmentId(assessmentId) {
  const normalized = String(assessmentId || '').trim().toLowerCase();
  if (!/^ba-[0-9]{8}-[a-f0-9]{8}$/u.test(normalized)) throw new Error('new_ba_assessment_id_invalid');
  return normalized;
}

export function isSha256(value) {
  return /^[a-f0-9]{64}$/u.test(String(value || ''));
}

