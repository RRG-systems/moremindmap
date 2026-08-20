import crypto from 'node:crypto';

const SCORE_MAP = Object.freeze({
  command: 'vector',
  tempo: 'velocity',
  relational_awareness: 'signal',
  precision: 'fidelity',
  leverage: 'leverage',
  adaptability: 'flex',
  structure: 'framework',
  perspective: 'horizon',
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function stableSha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function exactAnswer(item) {
  if (Object.prototype.hasOwnProperty.call(item, 'answer_text') && item.answer_text !== null && item.answer_text !== '') {
    return item.answer_text;
  }
  if (Object.prototype.hasOwnProperty.call(item, 'answer_choice')) return item.answer_choice;
  return null;
}

function canonicalProfileFromEnvelope(envelope) {
  return envelope?.canonical_profile_json
    || envelope?.canonical_dossier?.canonical_profile_json
    || envelope?.canonical_dossier?.canonical_dossier?.canonical_profile_json
    || null;
}

function dossierFromEnvelope(envelope) {
  return envelope?.canonical_dossier?.canonical_dossier
    || envelope?.canonical_dossier
    || envelope
    || {};
}

function canonicalScores(profile) {
  const stored = profile?.vector_scores;
  if (!stored || typeof stored !== 'object') throw new Error('new_bos_canonical_vector_scores_missing');
  return Object.freeze(Object.fromEntries(Object.entries(SCORE_MAP).map(([target, source]) => {
    const numeric = Number(stored[source]);
    if (!Number.isFinite(numeric)) throw new Error(`new_bos_canonical_score_missing:${source}`);
    if (numeric < -1 || numeric > 100) throw new Error(`new_bos_canonical_score_out_of_range:${source}`);
    // Historical canonical dossiers may retain a small negative signed-topology
    // coordinate. New BOS consumes customer-scale directional intensity, whose
    // governed lower bound is zero. Project the signed lower tail to that floor
    // while preserving every valid 0–1 and already-0–100 value exactly.
    const bounded = Math.max(0, numeric);
    const projected = bounded <= 1 ? Math.round(bounded * 10_000) / 100 : bounded;
    return [target, projected];
  })));
}

function identityContext(dossier, profile) {
  const metadata = profile?.metadata || {};
  const identity = metadata.identity || {};
  const organization = metadata.organization || {};
  const role = identity.role || organization.role || null;
  const organizationContext = organization.business_context || organization.industry || null;
  return Object.freeze({
    display_name: dossier.person_name || metadata.person_name || identity.first_name || 'Assessment Subject',
    role,
    organization_context: organizationContext,
    context: [role, organizationContext].filter(Boolean).join(' · ') || 'Governed assessment evidence',
  });
}

export function adaptCanonicalProfileToNewBosRawEvidence({ envelope, expectedProfileId }) {
  const profile = canonicalProfileFromEnvelope(envelope);
  const dossier = dossierFromEnvelope(envelope);
  if (!profile) throw new Error('new_bos_canonical_profile_missing');
  const actualProfileId = String(profile.profile_id || dossier.profile_id || '').trim().toUpperCase();
  const expected = String(expectedProfileId || '').trim().toUpperCase();
  if (!expected || actualProfileId !== expected) throw new Error('new_bos_canonical_identity_mismatch');
  const storedIntake = profile.intake_answers;
  const intake = Array.isArray(storedIntake)
    ? storedIntake
    : storedIntake && typeof storedIntake === 'object'
      ? Object.values(storedIntake)
      : [];
  if (!intake.length) throw new Error('new_bos_canonical_intake_missing');

  const questions = intake.map((item, index) => Object.freeze({
    question_id: String(item.question_id || `q${String(index + 1).padStart(2, '0')}`),
    question_text: String(item.question_text || ''),
    response_type: String(item.question_type || 'other'),
    exact_answer: exactAnswer(item),
    source_ref: `canonical_profile_json.intake_answers[${index}]`,
  }));
  const evidence = questions.map((item, index) => Object.freeze({
    evidence_id: `q${String(index + 1).padStart(2, '0')}`,
    epistemic_class: 'self_report',
    statement: item.exact_answer == null ? '' : String(item.exact_answer),
    exact_content: item.exact_answer == null ? '' : String(item.exact_answer),
    question: item.question_text,
    source_ref: item.source_ref,
  }));
  const scores = canonicalScores(profile);
  const scoreSourceRefs = Object.freeze(Object.fromEntries(Object.entries(SCORE_MAP).map(([target, source]) => [
    target,
    Object.freeze([`canonical_profile_json.vector_scores.${source}`]),
  ])));
  Object.entries(SCORE_MAP).forEach(([target, source], index) => evidence.push(Object.freeze({
    evidence_id: `score_${String(index + 1).padStart(2, '0')}`,
    epistemic_class: 'score_prior',
    statement: `${target}:${scores[target]}`,
    exact_content: `${target}:${scores[target]}`,
    source_ref: `canonical_profile_json.vector_scores.${source}`,
  })));

  const sourceProjection = Object.freeze({
    profile_id: actualProfileId,
    assessment_version: profile.assessment_version || profile.metadata?.assessment_version || dossier.assessment_version || null,
    questions,
    scores,
    score_source_refs: scoreSourceRefs,
    identity_context: identityContext(dossier, profile),
  });

  return Object.freeze({
    version: 'new_bos_real_customer_raw_evidence_v1',
    synthetic: false,
    real_profile_gate: true,
    governed_local_snapshot: true,
    identity_verified_by_adapter: true,
    profile_id: actualProfileId,
    subject_token: `REAL-PDNV1-${actualProfileId}`,
    source_artifact_ids: Object.freeze([
      `canonical_profile:${actualProfileId}`,
      `canonical_source_sha256:${stableSha256(sourceProjection)}`,
    ]),
    identity_context: sourceProjection.identity_context,
    questions: Object.freeze(questions),
    evidence: Object.freeze(evidence),
    scores,
    score_source_refs: scoreSourceRefs,
    contradictions: Object.freeze([]),
    uncertainties: Object.freeze([{ id: 'source_scope', statement: 'Evidence is limited to the governed assessment and self-report context.' }]),
    abstentions: Object.freeze(['Do not infer biography, observer response, protected traits, clinical status, or psychometric intelligence beyond the supplied evidence.']),
    generation_metadata: Object.freeze({
      source_adapter: 'new_bos_real_customer_adapter_v1',
      canonical_source_sha256: stableSha256(sourceProjection),
      assessment_version: sourceProjection.assessment_version,
    }),
  });
}

export { SCORE_MAP };
