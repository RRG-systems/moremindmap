import { DIMENSIONS } from '../../../src/lib/newBosPersonalityDnaV1/constants.js';

export const NEW_BOS_COMPATIBILITY_CLASSES = Object.freeze({
  A: 'FULLY_COMPATIBLE',
  B: 'COMPATIBLE_WITH_ABSTENTION',
  C: 'INSUFFICIENT_EVIDENCE',
  D: 'UNKNOWN',
});

function exactEightScores(rawEvidence) {
  return DIMENSIONS.every(({ id }) => Number.isFinite(rawEvidence?.scores?.[id])
    && rawEvidence.scores[id] >= 0
    && rawEvidence.scores[id] <= 100);
}

export function classifyNewBosCompatibility(rawEvidence) {
  const reasons = [];
  const identityValid = rawEvidence?.real_profile_gate === true
    && rawEvidence?.identity_verified_by_adapter === true
    && rawEvidence?.governed_local_snapshot === true
    && /^MM-[A-Z0-9-]+$/u.test(rawEvidence?.profile_id || '')
    && rawEvidence?.subject_token === `REAL-PDNV1-${rawEvidence.profile_id}`;
  if (!identityValid) {
    return Object.freeze({ class: 'D', label: NEW_BOS_COMPATIBILITY_CLASSES.D, automatic_rebuild: false, reasons: Object.freeze(['identity_or_authority_unknown']) });
  }

  const scoresComplete = exactEightScores(rawEvidence);
  const questions = Array.isArray(rawEvidence.questions) ? rawEvidence.questions : [];
  const evidence = Array.isArray(rawEvidence.evidence) ? rawEvidence.evidence : [];
  if (!scoresComplete) reasons.push('canonical_score_set_incomplete');
  if (questions.length === 0) reasons.push('governed_question_evidence_missing');
  if (evidence.length === 0) reasons.push('governed_evidence_ledger_missing');
  if (reasons.length) {
    return Object.freeze({ class: 'C', label: NEW_BOS_COMPATIBILITY_CLASSES.C, automatic_rebuild: false, reasons: Object.freeze(reasons) });
  }

  const explicitMissingness = evidence.some(({ exact_content: exactContent }) => (
    exactContent === '' || exactContent == null
  ));
  if (questions.length < 20 || explicitMissingness) {
    return Object.freeze({
      class: 'B',
      label: NEW_BOS_COMPATIBILITY_CLASSES.B,
      automatic_rebuild: true,
      preserve_missingness: true,
      reasons: Object.freeze([questions.length < 20 ? 'historical_evidence_shape' : 'explicit_governed_missingness']),
    });
  }

  return Object.freeze({
    class: 'A',
    label: NEW_BOS_COMPATIBILITY_CLASSES.A,
    automatic_rebuild: true,
    preserve_missingness: false,
    reasons: Object.freeze(['complete_governed_evidence_shape']),
  });
}
