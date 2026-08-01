import { normalizeAssessmentAnswers } from './normalizeAssessmentAnswers.js';
import { QUESTIONS } from './questionEvidenceRegistry.js';

export const EXPECTED_BOS_ANSWER_COUNT = QUESTIONS.length;

function selectedKeys(answer) {
  const value = answer?.choice ?? answer?.answer_choice;
  const submitted = Array.isArray(value) ? value : String(value ?? '').split(',');
  return submitted
    .map((selection) => String(selection).trim())
    .filter(Boolean);
}

function hasValidSelectionAnswer(question, answer) {
  const selections = selectedKeys(answer);
  const validKeys = new Set(question.answers?.map(({ key }) => key) || []);
  const expectedCount = question.type === 'ranking'
    ? validKeys.size
    : question.type === 'choose_two'
      ? 2
      : 1;

  return selections.length === expectedCount
    && new Set(selections).size === expectedCount
    && selections.every((selection) => validKeys.has(selection));
}

function hasValidWrittenAnswer(answer) {
  const value = answer?.text ?? answer?.answer_text;
  return typeof value === 'string' && value.trim().length > 0;
}

function hasSubmittedValue(question, answer) {
  return question.type === 'written'
    ? typeof (answer?.text ?? answer?.answer_text) === 'string'
    : selectedKeys(answer).length > 0;
}

function isValidAnswer(question, answer) {
  return question.type === 'written'
    ? hasValidWrittenAnswer(answer)
    : hasValidSelectionAnswer(question, answer);
}

/**
 * Deterministically classifies a BOS intake without changing answer values or
 * rejecting the legacy partial-profile pathway. Consumers retain their current
 * contracts while diagnostics can distinguish complete from partial input.
 */
export function assessAssessmentCompleteness(answers) {
  const normalized = normalizeAssessmentAnswers(answers);
  const missingQuestionIds = [];
  const invalidQuestionIds = [];
  let submittedAnswerCount = 0;
  let validAnswerCount = 0;

  for (const question of QUESTIONS) {
    const answer = normalized[`q${question.id}`];
    if (!hasSubmittedValue(question, answer)) {
      missingQuestionIds.push(question.id);
      continue;
    }

    submittedAnswerCount += 1;
    if (isValidAnswer(question, answer)) {
      validAnswerCount += 1;
    } else {
      invalidQuestionIds.push(question.id);
    }
  }

  const expectedKeys = new Set(QUESTIONS.map(({ id }) => `q${id}`));
  const unexpectedAnswerKeys = Object.keys(normalized)
    .filter((key) => !expectedKeys.has(key));
  const isComplete = validAnswerCount === EXPECTED_BOS_ANSWER_COUNT
    && missingQuestionIds.length === 0
    && invalidQuestionIds.length === 0;
  const status = isComplete
    ? 'complete'
    : validAnswerCount > 0
      ? 'partial'
      : 'invalid';

  return Object.freeze({
    version: 'bos_assessment_completeness_v1',
    status,
    is_complete: isComplete,
    expected_answer_count: EXPECTED_BOS_ANSWER_COUNT,
    submitted_answer_count: submittedAnswerCount,
    valid_answer_count: validAnswerCount,
    missing_question_ids: Object.freeze(missingQuestionIds),
    invalid_question_ids: Object.freeze(invalidQuestionIds),
    unexpected_answer_keys: Object.freeze(unexpectedAnswerKeys),
    quality_score: Math.round((validAnswerCount / EXPECTED_BOS_ANSWER_COUNT) * 100),
  });
}

export function assessProfileInputCompleteness(profileInput) {
  return assessAssessmentCompleteness(profileInput?.raw_answers);
}

export default assessAssessmentCompleteness;
