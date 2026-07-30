import { QUESTION_MAP } from './questionMap.js';

const QUESTIONS = QUESTION_MAP.set_1.v1;
const QUESTION_BY_ID = new Map(QUESTIONS.map((question) => [question.id, question]));

function getQuestionId(key) {
  const match = String(key).match(/^q?(\d+)$/i);
  return match ? Number(match[1]) : null;
}

function getCanonicalSelection(question, value) {
  const submitted = Array.isArray(value) ? value : String(value ?? '').split(',');
  const optionKeys = question.answers?.map((option) => option.key) || [];

  return submitted
    .map((selection) => String(selection).trim())
    .filter(Boolean)
    .map((selection) => (
      optionKeys.find((key) => key.toLowerCase() === selection.toLowerCase())
      || selection
    ))
    .join(',');
}

function hasSubmittedSelection(value) {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeKnownAnswer(question, answer) {
  if (question.type === 'written') {
    if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
      return { ...answer };
    }

    return { text: String(answer ?? '') };
  }

  let submittedChoice = answer;
  if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
    if (hasSubmittedSelection(answer.choice)) {
      submittedChoice = answer.choice;
    } else if (
      (question.type === 'ranking' || question.type === 'choose_two')
      && hasSubmittedSelection(answer.text)
    ) {
      submittedChoice = answer.text;
    } else {
      return { ...answer };
    }
  }

  const choice = getCanonicalSelection(question, submittedChoice);
  if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
    return choice ? { ...answer, choice } : { ...answer };
  }

  return { choice };
}

function normalizeUnknownAnswer(answer) {
  if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
    return { ...answer };
  }

  if (typeof answer === 'string' && answer.length === 1 && /[A-E]/i.test(answer)) {
    return { choice: answer.toUpperCase() };
  }

  return { text: String(answer ?? '') };
}

/**
 * Canonical, non-mutating intake normalization shared by the start route and
 * buildProfileInput. Explicit choice wins over legacy text for selection
 * questions; written questions retain text semantics.
 */
export function normalizeAssessmentAnswers(answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(answers).map(([key, answer]) => {
      const questionId = getQuestionId(key);
      const qKey = questionId === null ? String(key) : `q${questionId}`;
      const question = QUESTION_BY_ID.get(questionId);
      const normalized = question
        ? normalizeKnownAnswer(question, answer)
        : normalizeUnknownAnswer(answer);

      return [qKey, normalized];
    }),
  );
}

export default normalizeAssessmentAnswers;
