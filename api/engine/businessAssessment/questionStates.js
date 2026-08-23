export const BUSINESS_ASSESSMENT_QUESTION_KEYS = Object.freeze(
  Array.from({ length: 12 }, (_, index) => `q${index + 1}`),
);

export const BUSINESS_ASSESSMENT_QUESTION_STATES = Object.freeze({
  ANSWERED: 'ANSWERED',
  UNANSWERED: 'UNANSWERED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

function requestedState(value) {
  if (typeof value === 'string') return value;
  return value?.state;
}

export function buildGovernedQuestionStates({ answers = {}, requestedStates = {}, assessmentId } = {}) {
  if (typeof assessmentId !== 'string' || !assessmentId.trim()) {
    throw new Error('business_assessment_question_state_assessment_id_required');
  }

  return Object.freeze(Object.fromEntries(BUSINESS_ASSESSMENT_QUESTION_KEYS.map((key) => {
    const answer = typeof answers[key] === 'string' ? answers[key] : '';
    if (answer.trim()) {
      return [key, Object.freeze({ state: BUSINESS_ASSESSMENT_QUESTION_STATES.ANSWERED })];
    }
    if (requestedState(requestedStates[key]) === BUSINESS_ASSESSMENT_QUESTION_STATES.NOT_APPLICABLE) {
      return [key, Object.freeze({
        state: BUSINESS_ASSESSMENT_QUESTION_STATES.NOT_APPLICABLE,
        reason: 'Customer explicitly marked this assessment question as not applicable.',
        evidence_refs: Object.freeze([`business_assessment:${assessmentId}:inputs.question_states.${key}`]),
      })];
    }
    return [key, Object.freeze({
      state: BUSINESS_ASSESSMENT_QUESTION_STATES.UNANSWERED,
      reason: 'Customer left this assessment question unanswered.',
      evidence_refs: Object.freeze([]),
    })];
  })));
}
