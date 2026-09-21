import { createHash } from 'node:crypto';
import { VECTORS, CHAPTERS, VERSION } from './design.js';

export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export const words = text => (String(text).match(/\b[\w’'-]+\b/g) || []).length;
export function requireThat(condition, code) { if (!condition) throw new Error(code); }
export function validateSubject(subject) {
  requireThat(typeof subject.synthetic === 'boolean' && ['private_participant','synthetic_test'].includes(subject.record_kind), 'PRIVATE_PARTICIPANT_REQUIRED');
  requireThat(/^MM-\d{8}-[A-F0-9]{8}$/.test(subject.mm), 'INVALID_MM');
  requireThat(subject.age >= 17 && subject.age <= 120, 'AGE_OUT_OF_SCOPE');
  const hybrid = subject.intake_mode === 'hybrid';
  const count = subject.answers.length;
  requireThat((hybrid ? count >= 12 && count <= 20 : count === 20) && new Set(subject.answers.map(x => x.question_id)).size === count, 'INTAKE_INCOMPLETE');
  if(hybrid) requireThat(subject.answers.filter(x=>x.question_id.startsWith('Q')).length===12 && subject.intake_complete===true,'HYBRID_INCOMPLETE');
  requireThat(subject.answers.every(x => /^[QF]\d{2}$/.test(x.question_id) && typeof x.text === 'string'), 'INTAKE_ORDER');
}
export function checkRefs(refs, allowed) {
  requireThat(Array.isArray(refs) && refs.length > 0 && refs.every(id => allowed.has(id)), 'UNRESOLVED_EVIDENCE');
}
export function validateEvidence(evidence, subject) {
  const allowed = new Set([...subject.answers.map(x => x.question_id), ...(subject.corrections || []).map(x => x.id)]);
  requireThat(Array.isArray(evidence.claims) && evidence.claims.length > 0, 'NO_CLAIMS');
  requireThat(new Set(evidence.claims.map(x => x.id)).size === evidence.claims.length, 'DUPLICATE_CLAIM');
  for (const c of evidence.claims) {
    checkRefs(c.refs, allowed);
    requireThat(['direct', 'inference', 'hypothesis', 'current_context'].includes(c.kind), 'CLAIM_KIND');
    requireThat(c.statement && c.alternative !== undefined, 'CLAIM_INCOMPLETE');
  }
}
export function validateDomains(domains, evidence) {
  const claimIds = new Set(evidence.claims.map(x => x.id));
  requireThat(domains.vectors.length === 8 && VECTORS.every((v, i) => domains.vectors[i].id === v.id), 'VECTOR_ORDER');
  for (const v of domains.vectors) {
    requireThat(Number.isInteger(v.position) && v.position >= -1 && v.position <= 4, 'VECTOR_SCALE');
    if (v.position >= 0) checkRefs(v.claim_ids, claimIds);
    requireThat(v.interpretation && v.context, 'VECTOR_MEANING');
  }
  requireThat(domains.domains.length === 8 && CHAPTERS.every((c, i) => domains.domains[i].id === c.id), 'DOMAIN_ORDER');
  domains.domains.forEach(d => checkRefs(d.claim_ids, claimIds));
}
export function validateSynthesis(synthesis, evidence) {
  const allowed = new Set(evidence.claims.map(x => x.id));
  requireThat(synthesis.chapter_routes.length === 8 && CHAPTERS.every((c, i) => synthesis.chapter_routes[i].id === c.id), 'ROUTE_ORDER');
  synthesis.chapter_routes.forEach(r => checkRefs(r.claim_ids, allowed));
  requireThat(synthesis.signature_insights.length >= 2 && synthesis.signature_insights.length <= 4, 'SIGNATURE_COUNT');
  synthesis.signature_insights.forEach(r => checkRefs(r.claim_ids, allowed));
  synthesis.strength_visual.forEach(r => checkRefs(r.claim_ids, allowed));
  checkRefs(synthesis.pressure_visual.claim_ids, allowed);
}
export function validateReading(reading, evidence) {
  const allowed = new Set(evidence.claims.map(x => x.id));
  requireThat(reading.portrait?.headline && reading.portrait.paragraphs.length >= 4, 'PORTRAIT_MISSING');
  const portraitWords = words(reading.portrait.paragraphs.join(' '));
  requireThat(portraitWords >= 450 && portraitWords <= 850, `PORTRAIT_LENGTH_${portraitWords}`);
  checkRefs(reading.portrait.claim_ids, allowed);
  requireThat(reading.chapters.length === 8 && CHAPTERS.every((c, i) => reading.chapters[i].id === c.id), 'READING_ORDER');
  for (const chapter of reading.chapters) {
    const count = words(chapter.paragraphs.join(' '));
    requireThat(chapter.headline && chapter.takeaway && count >= 150 && count <= 380, `CHAPTER_LENGTH_${chapter.id}_${count}`);
    checkRefs(chapter.claim_ids, allowed);
  }
  const serialized = JSON.stringify(reading);
  requireThat(!/as an ai|event.root|governed claim|causal_foundation|vector topology|high command|low leverage/i.test(serialized), 'INTERNAL_LANGUAGE_LEAK');
  requireThat(!/<script|javascript:|https?:\/\//i.test(serialized), 'UNSAFE_READING_CONTENT');
  return { portrait_words: portraitWords, chapter_words: reading.chapters.map(c => ({ id: c.id, words: words(c.paragraphs.join(' ')) })), total_words: words(reading.portrait.paragraphs.concat(...reading.chapters.map(c => c.paragraphs)).join(' ')) };
}
export function assemble(subject, evidence, domains, synthesis, reading, receipts) {
  validateSubject(subject); validateEvidence(evidence, subject); validateDomains(domains, evidence); validateSynthesis(synthesis, evidence);
  const counts = validateReading(reading, evidence);
  const body = { version: VERSION, synthetic: subject.synthetic, record_kind: subject.record_kind, questionnaire_version: subject.questionnaire_version, mm: subject.mm, intake_mode:subject.intake_mode||'static', subject_sha256: hash(subject), subject: { name: subject.name, age: subject.age, gender: subject.gender, pronouns: subject.pronouns, sport: subject.sport }, evidence, domains, synthesis, reading, counts, receipts, created_at: new Date().toISOString() };
  return { ...body, artifact_sha256: hash(body) };
}
export function verifyArtifact(artifact, subject) {
  const { artifact_sha256, ...body } = artifact;
  requireThat(hash(body) === artifact_sha256, 'ARTIFACT_TAMPERED');
  requireThat(artifact.mm === subject.mm && artifact.subject_sha256 === hash(subject), 'STALE_OR_WRONG_SUBJECT');
  requireThat(artifact.version === VERSION && artifact.synthetic === subject.synthetic && artifact.record_kind === subject.record_kind, 'WRONG_ARTIFACT_VERSION');
  validateEvidence(artifact.evidence, subject); validateDomains(artifact.domains, artifact.evidence); validateSynthesis(artifact.synthesis, artifact.evidence); validateReading(artifact.reading, artifact.evidence);
  return artifact;
}
