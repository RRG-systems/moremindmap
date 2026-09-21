import { createHash } from 'node:crypto';

export const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const requireThat = (condition, code) => { if (!condition) throw new Error(code); };
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const digest = (value) => /^[a-f0-9]{64}$/u.test(value || '');
export function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export function assertPrincipal(bundle, principal) {
  requireThat(object(principal) && text(principal.actorId) && principal.authenticated === true
    && ['athlete', 'coach', 'guardian'].includes(principal.role)
    && principal.subjectActorId === bundle.binding.actorId && principal.mm === bundle.person.mm,
  'COACH_ACTOR_AUTHORITY_DENIED');
  return principal;
}

export function assertOwner(bundle, principal) {
  assertPrincipal(bundle, principal);
  requireThat(principal.role === 'athlete' && principal.actorId === bundle.binding.actorId
    && principal.grants?.coachingRead === true && principal.grants?.participation === true,
  'COACH_PRIVATE_ACCESS_DENIED');
}

export function validateCanonicalCoachBundle(bundle) {
  requireThat(object(bundle?.binding) && text(bundle.binding.actorId) && text(bundle.person?.mm)
    && Number.isInteger(bundle.person.age) && bundle.person.age >= 17,
  'COACH_CANONICAL_PAIR_REQUIRED');
  for (const artifact of [bundle.bos, bundle.apa]) {
    requireThat(object(artifact) && digest(artifact.artifact_sha256), 'COACH_CANONICAL_PAIR_REQUIRED');
    const { artifact_sha256, ...body } = artifact;
    requireThat(artifact.mm === bundle.person.mm && hash(body) === artifact_sha256,
      'COACH_REPORT_IDENTITY_OR_INTEGRITY_FAILURE');
  }
  requireThat(bundle.binding.mm === bundle.person.mm && bundle.binding.bos === bundle.bos.artifact_sha256
    && bundle.binding.apa === bundle.apa.artifact_sha256
    && bundle.apa.bos_sha256 === hash(bundle.bos), 'COACH_REPORT_SOURCE_MISMATCH');
  requireThat(object(bundle.bos.reading) && Array.isArray(bundle.bos.reading.chapters)
    && bundle.bos.reading.chapters.length === 8 && object(bundle.bos.evidence)
    && object(bundle.apa.report) && bundle.apa.audit?.pass === true
    && Number.isInteger(bundle.bos.subject?.age)
    && Number.isInteger(bundle.apa.identity?.age)
    && bundle.apa.identity?.mm === bundle.person.mm
    && bundle.bos_source?.person?.mm === bundle.person.mm && Array.isArray(bundle.bos_source.answers)
    && bundle.bos_source.answers.length === 20, 'COACH_COMPLETE_VALIDATED_PAIR_REQUIRED');
  return bundle;
}

// Caller loads these immutable artifacts from the authenticated canonical dossier,
// after assessment validateReport succeeds. No slug, Profile ID, or fixture lookup.
export function buildCanonicalCoachBundle({ person, bos, apa, bosInput }, principal) {
  requireThat(object(person) && text(person.actorId), 'COACH_CANONICAL_OWNER_REQUIRED');
  const safePerson = Object.fromEntries(['mm', 'name', 'age', 'gender', 'pronouns', 'sport', 'synthetic']
    .filter((key) => person[key] !== undefined).map((key) => [key, person[key]]));
  const bundle = structuredClone({
    binding: { actorId: person.actorId, mm: person.mm, bos: bos?.artifact_sha256, apa: apa?.artifact_sha256 },
    person: safePerson, bos, apa, bos_source: bosInput,
  });
  validateCanonicalCoachBundle(bundle);
  assertPrincipal(bundle, principal);
  requireThat(principal.grants?.reportsRead === true, 'COACH_REPORT_ACCESS_DENIED');
  return freeze(bundle);
}
