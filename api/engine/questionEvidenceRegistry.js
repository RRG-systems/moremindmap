import { QUESTION_MAP } from './questionMap.js';

const QUESTIONS = Object.freeze([...QUESTION_MAP.set_1.v1]);

export const QUESTION_BY_ID = new Map(
  QUESTIONS.map((question) => [question.id, question]),
);

export const WRITTEN_QUESTIONS = Object.freeze(
  QUESTIONS.filter((question) => question.type === 'written'),
);

export const WRITTEN_QUESTION_IDS = Object.freeze(
  WRITTEN_QUESTIONS.map((question) => question.id),
);

export const QUESTION_ROUTE_REGISTRY = Object.freeze(
  QUESTIONS.map((question) => Object.freeze({
    question_id: question.id,
    question_type: question.type,
    answer_route: question.type === 'written' ? 'written' : 'selection',
    evidence_role: question.evidence_role || null,
  })),
);

const QUESTION_BY_EVIDENCE_ROLE = new Map(
  WRITTEN_QUESTIONS
    .filter((question) => question.evidence_role)
    .map((question) => [question.evidence_role, question]),
);

export function getQuestionByEvidenceRole(role) {
  return QUESTION_BY_EVIDENCE_ROLE.get(role) || null;
}

export function getWrittenResponseByRole(writtenResponses, role) {
  const question = getQuestionByEvidenceRole(role);
  return question ? writtenResponses?.[`q${question.id}_written`] || null : null;
}

export function validateQuestionRouteRegistry() {
  const ids = QUESTION_ROUTE_REGISTRY.map((entry) => entry.question_id);
  const uniqueIds = new Set(ids);
  const missingEvidenceRoles = WRITTEN_QUESTIONS
    .filter((question) => !question.evidence_role)
    .map((question) => question.id);
  const duplicateEvidenceRoles = WRITTEN_QUESTIONS
    .map((question) => question.evidence_role)
    .filter(Boolean)
    .filter((role, index, roles) => roles.indexOf(role) !== index);

  return {
    valid:
      ids.length === QUESTIONS.length
      && uniqueIds.size === QUESTIONS.length
      && missingEvidenceRoles.length === 0
      && duplicateEvidenceRoles.length === 0,
    question_count: QUESTIONS.length,
    routed_question_count: uniqueIds.size,
    written_question_count: WRITTEN_QUESTIONS.length,
    missing_evidence_roles: missingEvidenceRoles,
    duplicate_evidence_roles: [...new Set(duplicateEvidenceRoles)],
  };
}

export { QUESTIONS };
