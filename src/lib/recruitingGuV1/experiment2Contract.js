export const RECRUITING_GU_EXPERIMENT_2_VERSION = 'recruiting-gu-v1-experiment-2-coach-first-v1';

export const RECRUITING_GU_EXPERIMENT_2_MODEL_CONFIG = Object.freeze({
  gateway: 'OpenAI Responses API',
  requestedProvider: 'OpenAI',
  model: 'gpt-5.6-sol',
  reasoningEffort: 'low',
  maxOutputTokens: 4200,
  providerFallbacks: false,
  store: false,
  structuredOutput: 'strict-json-schema',
  timeoutMs: 120_000,
});

export const RECRUITING_GU_EXPERIMENT_2_CONDITIONS = Object.freeze({
  CONTROL: 'CONDITION_1_CONTROL',
  SPLIT: 'CONDITION_2_SPLIT',
  RANKED: 'CONDITION_3_SPLIT_RANKED',
  DEMONSTRATIONS: 'CONDITION_4_SPLIT_RANKED_DEMONSTRATIONS',
});

export const RECRUITING_GU_COACH_MOVE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['version', 'insight', 'explanation', 'selfDiscoveryQuestion', 'visual'],
  properties: {
    version: { type: 'string', const: RECRUITING_GU_EXPERIMENT_2_VERSION },
    insight: { type: 'string', minLength: 1, maxLength: 260 },
    explanation: { type: 'string', minLength: 1, maxLength: 700 },
    selfDiscoveryQuestion: { type: 'string', minLength: 1, maxLength: 300 },
    visual: {
      type: 'object',
      additionalProperties: false,
      required: ['materiallyHelps', 'semanticIdea'],
      properties: {
        materiallyHelps: { type: 'boolean' },
        semanticIdea: { type: ['string', 'null'], maxLength: 500 },
      },
    },
  },
});

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/gu, ' ').trim();
}

function numericTokens(value) {
  return String(value || '').match(/\$?\d[\d,.]*(?:%|M|K)?/gu)?.map((item) => item.replaceAll(',', '').replace(/^\$/u, '')) || [];
}

function protectedAnswers(context) {
  const groups = [context?.firstPartyAnswers?.bos, context?.firstPartyAnswers?.ba];
  return groups.flatMap((group) => Array.isArray(group) ? group : []).map((item) => String(item.answer || item.exact_answer || '')).filter(Boolean);
}

export function validateRecruitingGuCoachMove({ candidate, governedWorld, purposeContext }) {
  const errors = [];
  if (!candidate || candidate.version !== RECRUITING_GU_EXPERIMENT_2_VERSION) errors.push('COACH_MOVE_VERSION_INVALID');
  for (const key of ['insight', 'explanation', 'selfDiscoveryQuestion']) {
    if (!String(candidate?.[key] || '').trim()) errors.push(`COACH_MOVE_${key.toUpperCase()}_REQUIRED`);
  }
  for (const key of ['insight', 'explanation']) {
    if (String(candidate?.[key] || '').trim() && !/[.!?]$/u.test(String(candidate[key]).trim())) {
      errors.push(`COACH_MOVE_${key.toUpperCase()}_COMPLETE_SENTENCE_REQUIRED`);
    }
  }
  if (!String(candidate?.selfDiscoveryQuestion || '').trim().endsWith('?')) errors.push('COACH_MOVE_QUESTION_REQUIRED');
  if (candidate?.visual?.materiallyHelps === true && !String(candidate?.visual?.semanticIdea || '').trim()) errors.push('COACH_MOVE_VISUAL_MEANING_REQUIRED');
  if (candidate?.visual?.materiallyHelps === false && candidate?.visual?.semanticIdea !== null) errors.push('COACH_MOVE_UNUSED_VISUAL_MEANING_DENIED');

  const rendered = [candidate?.insight, candidate?.explanation, candidate?.selfDiscoveryQuestion, candidate?.visual?.semanticIdea].filter(Boolean).join(' ');
  const allowedNumbers = new Set(numericTokens(JSON.stringify({ governedWorld, purposeContext })));
  for (const token of numericTokens(rendered)) if (!allowedNumbers.has(token)) errors.push(`COACH_MOVE_INVENTED_NUMERIC_CLAIM:${token}`);

  const normalizedRendered = normalize(rendered);
  for (const answer of protectedAnswers(purposeContext)) {
    const normalizedAnswer = normalize(answer);
    if (normalizedAnswer.length >= 32 && normalizedRendered.includes(normalizedAnswer)) errors.push('COACH_MOVE_PROTECTED_ANSWER_EXPOSURE');
  }
  if (/json schema|validator|state binding|object id|evidence id|prompt instruction|language model/iu.test(rendered)) {
    errors.push('COACH_MOVE_MODEL_MECHANICS_EXPOSURE');
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

export function isCoachFirstCondition(condition) {
  return Object.values(RECRUITING_GU_EXPERIMENT_2_CONDITIONS).includes(condition)
    && condition !== RECRUITING_GU_EXPERIMENT_2_CONDITIONS.CONTROL;
}

export function usesPurposeRankedContext(condition) {
  return condition === RECRUITING_GU_EXPERIMENT_2_CONDITIONS.RANKED
    || condition === RECRUITING_GU_EXPERIMENT_2_CONDITIONS.DEMONSTRATIONS;
}

export function usesDjDemonstrations(condition) {
  return condition === RECRUITING_GU_EXPERIMENT_2_CONDITIONS.DEMONSTRATIONS;
}
