import { isSha256 } from './stable.js';
import { validateBosFusionAuthority } from './fusionContract.js';
import { classifyBaEvidenceSufficiency } from './evidenceSufficiency.js';

export const NEW_BA_COMPATIBILITY_CLASSES = Object.freeze({
  A: 'FULLY_COMPATIBLE',
  B: 'COMPATIBLE_WITH_EXPLICIT_MISSINGNESS',
  C: 'INSUFFICIENT_CANONICAL_BUSINESS_EVIDENCE',
  D: 'UNKNOWN_OR_UNAUTHORIZED_AUTHORITY',
});

export function classifyNewBaCompatibility(source) {
  const answers = source?.business_evidence?.answers;
  const answerHashes = source?.business_evidence?.answer_sha256;
  const identityValid = /^MM-[A-Z0-9-]+$/u.test(source?.profile_id || '')
    && /^ba-[0-9]{8}-[a-f0-9]{8}$/u.test(source?.assessment_id || '')
    && source?.business_evidence?.read_only === true;
  let fusionValid = false;
  try {
    const fusion = validateBosFusionAuthority(source?.bos_authority?.fusion_authority, { profileId: source?.profile_id });
    fusionValid = fusion.contract_sha256 === source?.bos_authority?.fusion_contract_sha256
      && fusion.evidence_boundary_sha256 === source?.bos_authority?.evidence_boundary_sha256;
  } catch {
    fusionValid = false;
  }
  const bosValid = source?.bos_authority?.compatible === true
    && isSha256(source?.bos_authority?.sha256)
    && fusionValid;
  if (!identityValid || !bosValid) return Object.freeze({ class: 'D', label: NEW_BA_COMPATIBILITY_CLASSES.D, automatic_rebuild: false, reasons: Object.freeze([!identityValid ? 'identity_or_business_evidence_unknown' : 'compatible_bos_authority_missing']) });
  const sufficiency = source?.business_evidence?.evidence_sufficiency || classifyBaEvidenceSufficiency({ answers, answerSha256: answerHashes });
  if (sufficiency.status !== 'PASS') return Object.freeze({
    class: 'C',
    label: NEW_BA_COMPATIBILITY_CLASSES.C,
    automatic_rebuild: false,
    preserve_missingness: true,
    reasons: sufficiency.reasons,
    evidence_sufficiency: sufficiency,
  });
  const missing = (sufficiency.unanswered_questions || []).length > 0
    || (sufficiency.not_applicable_questions || []).length > 0;
  return Object.freeze({
    class: missing ? 'B' : 'A',
    label: missing ? NEW_BA_COMPATIBILITY_CLASSES.B : NEW_BA_COMPATIBILITY_CLASSES.A,
    automatic_rebuild: true,
    preserve_missingness: missing,
    reasons: sufficiency.reasons,
    evidence_sufficiency: sufficiency,
  });
}
