import { isSha256, sha256Stable } from './stable.js';
import {
  REAL_ESTATE_EVIDENCE_SUFFICIENCY_MISSIONS,
  REAL_ESTATE_QUESTION_AUTHORITY,
} from '../../../src/lib/baVerticalCassettesV1/index.js';

export const BA_EVIDENCE_SUFFICIENCY_CONTRACT = Object.freeze({
  contract_id: 'ba-evidence-sufficiency-v1',
  version: '1.0.0',
  doctrine: 'missing evidence remains explicit and localized; it is never fabricated or silently converted to not-applicable',
});

export const BA_QUESTION_KEYS = Object.freeze(Array.from({ length: 12 }, (_, index) => `q${index + 1}`));

export const BA_QUESTION_AUTHORITY = REAL_ESTATE_QUESTION_AUTHORITY;

const REQUIRED_MISSIONS = REAL_ESTATE_EVIDENCE_SUFFICIENCY_MISSIONS;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function explicitNotApplicableKeys(states = {}, questionKeys = BA_QUESTION_KEYS) {
  return questionKeys.filter((key) => {
    const state = states?.[key];
    return state?.state === 'NOT_APPLICABLE'
      && Array.isArray(state.evidence_refs)
      && state.evidence_refs.length > 0
      && typeof state.reason === 'string'
      && state.reason.trim().length > 0;
  });
}

export function classifyBaEvidenceSufficiency({
  answers = {},
  answerSha256 = {},
  explicit_question_states = {},
  questionAuthority = BA_QUESTION_AUTHORITY,
  questionKeys = BA_QUESTION_KEYS,
  requiredMissions = REQUIRED_MISSIONS,
} = {}) {
  const notApplicable = explicitNotApplicableKeys(explicit_question_states, questionKeys);
  const answered = questionKeys.filter((key) => typeof answers?.[key] === 'string' && answers[key].trim().length > 0);
  const malformedHashes = answered.filter((key) => !isSha256(answerSha256?.[key]));
  const unanswered = questionKeys.filter((key) => !answered.includes(key) && !notApplicable.includes(key));
  const missionCoverage = requiredMissions.map((mission) => {
    const evidenceQuestions = mission.questions.filter((key) => answered.includes(key));
    return Object.freeze({ ...mission, satisfied: evidenceQuestions.length > 0, evidence_questions: Object.freeze(evidenceQuestions) });
  });
  const failedMissions = missionCoverage.filter((mission) => !mission.satisfied).map((mission) => mission.mission_id);
  const localizedConsequences = [...unanswered, ...notApplicable].map((key) => {
    const authority = questionAuthority[key];
    const explicitlyNotApplicable = notApplicable.includes(key);
    return Object.freeze({
      question_key: key,
      state: explicitlyNotApplicable ? 'GOVERNED_NOT_APPLICABLE' : 'UNKNOWN_UNANSWERED',
      customer_safe_missing_evidence: explicitlyNotApplicable
        ? `${authority.customer_question} was explicitly marked not applicable for this assessment and remains unavailable as business evidence.`
        : `${authority.customer_question} is not yet established from this assessment.`,
      primary_domain: authority.primary_domain,
      secondary_domains: authority.secondary_domains,
      affected_surfaces: authority.affected_surfaces,
      prohibited_inferences: Object.freeze([
        `Do not infer ${authority.primary_domain} facts from the unanswered item.`,
        'Do not convert missing evidence to not-applicable without explicit governed evidence.',
      ]),
    });
  });
  const status = malformedHashes.length === 0 ? 'PASS' : 'FAIL';
  const missingEvidenceCount = unanswered.length + notApplicable.length;
  const compatibilityClass = status === 'PASS' ? (missingEvidenceCount === 0 ? 'A' : 'B') : 'C';
  const result = {
    ...BA_EVIDENCE_SUFFICIENCY_CONTRACT,
    status,
    compatibility_class: compatibilityClass,
    automatic_rebuild: status === 'PASS',
    preserve_missingness: missingEvidenceCount > 0,
    answered_questions: Object.freeze(answered),
    unanswered_questions: Object.freeze(unanswered),
    not_applicable_questions: Object.freeze(notApplicable),
    malformed_answer_hashes: Object.freeze(malformedHashes),
    mission_coverage: Object.freeze(missionCoverage),
    failed_missions: Object.freeze(failedMissions),
    bounded_abstentions: Object.freeze(failedMissions.map((missionId) => Object.freeze({
      mission_id: missionId,
      effect: 'LOCALIZED_ABSTENTION_REQUIRED',
    }))),
    localized_consequences: Object.freeze(localizedConsequences),
    reasons: Object.freeze(status === 'PASS'
      ? [
          missingEvidenceCount === 0
            ? 'complete_governed_business_evidence'
            : failedMissions.length
              ? 'governed_business_evidence_partial_with_localized_abstention'
              : 'governed_business_evidence_sufficient_with_explicit_missingness',
        ]
      : [
          ...(malformedHashes.length ? ['governed_answer_hash_invalid'] : []),
        ]),
  };
  return deepFreeze({ ...result, contract_sha256: sha256Stable({
    contract: BA_EVIDENCE_SUFFICIENCY_CONTRACT,
    question_authority: questionAuthority,
    required_missions: requiredMissions,
  }) });
}
