import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';
import { digest, requireValue } from './repository.js';

export const INSTITUTIONS = Object.freeze([
  Object.freeze({ id: 'beyond-today-sports-institute', name: 'Beyond Today Sports Institute', enrollment: 'configured_pilot', synthetic: false }),
  Object.freeze({ id: 'horizon-academy', name: 'Horizon Sports Institute', enrollment: 'directory_example_only', synthetic: true }),
]);
export function cohortFor(realYouthEnabled = false) {
  const minimumAge = realYouthEnabled ? 13 : 18;
  return Object.freeze({ region: 'US-CA', minimumAge, minAge: minimumAge, guardianRequiredUnder: realYouthEnabled ? 18 : null, maximumAge: null, ageInterpretation: 'Actual age is retained. These are source-based interpretations, not age-normed scores.' });
}
// The exported cohort describes the youth-on design. Runtime responses
// use config.cohort so the default adult-only pilot cannot advertise youth access.
export const COHORT = cohortFor(true);
function exactOrigin(value,{allowInsecureLocalhost=false}={}){
  const raw=String(value||'').trim();if(!raw)return null;
  if(raw.includes('*'))return null;
  let parsed;try{parsed=new URL(raw);}catch{return null;}
  if(parsed.origin!==raw||parsed.username||parsed.password)return null;
  if(parsed.protocol==='https:')return raw;
  return allowInsecureLocalhost&&/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(raw)?raw:null;
}
export function academyConfig(env = {}) {
  const origin = env.ATHLETE_ACADEMY_ORIGIN || '';
  const allowInsecureLocalhost=env.ATHLETE_ACADEMY_LOCAL_PREVIEW==='1';
  const syntheticPreview=env.ATHLETE_ACADEMY_SYNTHETIC_PREVIEW === '1';
  const reviewedYouthPolicyVersion=String(env.ATHLETE_ACADEMY_REVIEWED_YOUTH_POLICY_VERSION || '').trim() || null;
  requireValue(!reviewedYouthPolicyVersion || /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,100}$/.test(reviewedYouthPolicyVersion),'YOUTH_POLICY_CONFIG_INVALID',503);
  // A switch is not policy acceptance. A separately reviewed youth policy is
  // required for real enrollment; the adult policy and existing adults stay intact.
  const realYouthEnabled=env.ATHLETE_ACADEMY_REAL_YOUTH_ENABLED === '1' && (syntheticPreview || Boolean(reviewedYouthPolicyVersion));
  const canonicalOrigin=exactOrigin(origin,{allowInsecureLocalhost});
  if(env.ATHLETE_ACADEMY_ENABLED==='1')requireValue(canonicalOrigin,origin?'ACADEMY_ORIGIN_INVALID':'ACADEMY_ORIGIN_NOT_CONFIGURED',503);
  const allowedOrigins=new Set(canonicalOrigin?[canonicalOrigin]:[]);
  for(const candidate of String(env.ATHLETE_ACADEMY_ALLOWED_ORIGINS||'').split(',')){
    const resolved=exactOrigin(candidate);requireValue(!candidate.trim()||resolved,'ACADEMY_ALLOWED_ORIGIN_INVALID',503);if(resolved)allowedOrigins.add(resolved);
  }
  for(const hostname of [env.VERCEL_URL,env.VERCEL_PROJECT_PRODUCTION_URL]){
    const resolved=exactOrigin(hostname&&`https://${String(hostname).trim()}`);if(resolved)allowedOrigins.add(resolved);
  }
  const preservedBosRecoveryJobHash=env.ATHLETE_ACADEMY_PRESERVED_BOS_RECOVERY_JOB_SHA256||null;
  requireValue(!preservedBosRecoveryJobHash||/^[a-f0-9]{64}$/.test(preservedBosRecoveryJobHash),'ACADEMY_RECOVERY_CONFIG_INVALID',503);
  return {
    enabled: env.ATHLETE_ACADEMY_ENABLED === '1',
    origin,
    allowedOrigins,
    allowInsecureLocalhost: allowInsecureLocalhost && Boolean(canonicalOrigin?.startsWith('http://')),
    syntheticPreview,
    cohort: cohortFor(realYouthEnabled),
    realYouthEnabled,
    reviewedPolicyVersion: env.ATHLETE_ACADEMY_REVIEWED_POLICY_VERSION || null,
    reviewedYouthPolicyVersion,
    providerEnabled: env.ATHLETE_ACADEMY_PROVIDER_ENABLED === '1',
    currentApaEnabled: env.ATHLETE_ACADEMY_CURRENT_APA_ENABLED === '1',
    flagshipEnabled: env.ATHLETE_ACADEMY_FLAGSHIP_ENABLED === '1',
    coachingWriteHold: env.ATHLETE_ACADEMY_COACHING_WRITE_HOLD === '1',
    coachNotesEnabled: env.ATHLETE_ACADEMY_COACH_NOTES_ENABLED === '1',
    coachNotesPolicyVersion: env.ATHLETE_ACADEMY_COACH_NOTES_POLICY_VERSION || null,
    mailEnabled: env.ATHLETE_ACADEMY_MAIL_ENABLED === '1',
    institutionCodeHash: env.ATHLETE_ACADEMY_BEYOND_TODAY_CODE_SHA256 || null,
    preservedBosRecoveryJobHash,
  };
}
export function resolveInstitution(config, { institutionId, code }) {
  requireValue(institutionId === INSTITUTIONS[0].id && typeof code === 'string' && code.length <= 256, 'INSTITUTION_CODE_INVALID', 403);
  requireValue(/^[a-f0-9]{64}$/.test(config.institutionCodeHash || ''), 'INSTITUTION_ENROLLMENT_UNAVAILABLE', 503);
  requireValue(timingSafeEqual(Buffer.from(digest(code)), Buffer.from(config.institutionCodeHash)), 'INSTITUTION_CODE_INVALID', 403);
  return { institutionId, services: ['bos', 'apa', 'coach'], role: 'athlete', sponsor: 'institution' };
}
export function ageOn(birthDate, at = Date.now()) {
  requireValue(typeof birthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(birthDate), 'BIRTH_DATE_REQUIRED');
  const birth = new Date(`${birthDate}T12:00:00Z`);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(at)).map(({ type, value }) => [type, value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  requireValue(Number.isFinite(birth.getTime()) && birth.toISOString().slice(0, 10) === birthDate && birthDate <= today, 'BIRTH_DATE_INVALID');
  return Number(parts.year) - Number(birthDate.slice(0, 4)) - (today.slice(5) < birthDate.slice(5) ? 1 : 0);
}

export function participationPolicyVersion(config, age) {
  if (age >= 18) return config.reviewedPolicyVersion || 'candidate-review-v1';
  requireValue(config.realYouthEnabled, 'YOUTH_ENROLLMENT_NOT_ACTIVE', 503);
  const policyVersion = config.reviewedYouthPolicyVersion ||
    (config.syntheticPreview ? config.reviewedPolicyVersion || 'candidate-review-v1' : null);
  requireValue(policyVersion, 'YOUTH_POLICY_REVIEW_REQUIRED', 503);
  return policyVersion;
}
