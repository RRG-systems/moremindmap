import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';
import { digest, requireValue } from './repository.js';

export const INSTITUTIONS = Object.freeze([
  Object.freeze({ id: 'beyond-today-sports-institute', name: 'Beyond Today Sports Institute', enrollment: 'configured_pilot', synthetic: false }),
  Object.freeze({ id: 'horizon-academy', name: 'Horizon Sports Institute', enrollment: 'directory_example_only', synthetic: true }),
]);
export const COHORT = Object.freeze({ region: 'US-CA', minimumAge: 17, guardianRequiredUnder: 18, maximumAge: null, ageInterpretation: 'Actual age is retained. These are source-based interpretations, not age-normed scores.' });
export function academyConfig(env = {}) {
  const origin = env.ATHLETE_ACADEMY_ORIGIN || '';
  if(env.ATHLETE_ACADEMY_ENABLED==='1'){let parsed;try{parsed=new URL(origin);}catch{requireValue(false,'ACADEMY_ORIGIN_NOT_CONFIGURED',503);}requireValue(parsed.origin===origin&&!parsed.username&&!parsed.password&&(parsed.protocol==='https:'||(env.ATHLETE_ACADEMY_LOCAL_PREVIEW==='1'&&/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin))),'ACADEMY_ORIGIN_INVALID',503);}
  return {
    enabled: env.ATHLETE_ACADEMY_ENABLED === '1',
    origin,
    allowInsecureLocalhost: env.ATHLETE_ACADEMY_LOCAL_PREVIEW === '1' && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin),
    syntheticPreview: env.ATHLETE_ACADEMY_SYNTHETIC_PREVIEW === '1',
    cohort: { region: 'US-CA', minAge: 17 },
    realYouthEnabled: env.ATHLETE_ACADEMY_REAL_YOUTH_ENABLED === '1',
    reviewedPolicyVersion: env.ATHLETE_ACADEMY_REVIEWED_POLICY_VERSION || null,
    providerEnabled: env.ATHLETE_ACADEMY_PROVIDER_ENABLED === '1',
    mailEnabled: env.ATHLETE_ACADEMY_MAIL_ENABLED === '1',
    institutionCodeHash: env.ATHLETE_ACADEMY_BEYOND_TODAY_CODE_SHA256 || null,
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
  const birth = new Date(`${birthDate}T12:00:00Z`), today = new Date(at);
  requireValue(Number.isFinite(birth.getTime()) && birth.toISOString().slice(0, 10) === birthDate && birth <= today, 'BIRTH_DATE_INVALID');
  return today.getUTCFullYear() - birth.getUTCFullYear() - (today.toISOString().slice(5, 10) < birthDate.slice(5) ? 1 : 0);
}
