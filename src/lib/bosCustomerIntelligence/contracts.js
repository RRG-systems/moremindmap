export const BOS_CUSTOMER_INTELLIGENCE_VERSION = 'bos_customer_intelligence_v2';
export const BOS_LAYER2_VERSION = 'bos_truthfulness_v1';
export const BOS_CUSTOMER_INTELLIGENCE_MODEL = 'gpt-5.6-sol';
export const BOS_CUSTOMER_INTELLIGENCE_PROMPT_VERSION = 'prompt-v2';
export const BOS_CUSTOMER_INTELLIGENCE_VALIDATOR_VERSION = 'validator-v2';
export const BOS_CUSTOMER_INTELLIGENCE_OUTPUT_VARIANT = 'premium-web-v2';
export const BOS_CUSTOMER_INTELLIGENCE_TRANSLATION_VARIANT = 'recognition-first';
export const BOS_CUSTOMER_INTELLIGENCE_CACHE_VERSION = 'bos_l3_translation_cache_v2';
export const BOS_CUSTOMER_INTELLIGENCE_CACHE_TTL_HOURS = 24;
export const BOS_CUSTOMER_INTELLIGENCE_TIMEOUT_MS = 60000;
export const BOS_CUSTOMER_INTELLIGENCE_MAX_OUTPUT_CHARACTERS = 240000;
export const BOS_CUSTOMER_INTELLIGENCE_MAX_CONCURRENT_CALLS = 4;
export const BOS_CUSTOMER_INTELLIGENCE_RATE_LIMIT = 30;
export const BOS_CUSTOMER_INTELLIGENCE_RATE_WINDOW_SECONDS = 60;
export const INSUFFICIENT_EVIDENCE = 'Insufficient Evidence';

export const TRANSLATION_STATUS = Object.freeze({
  TRANSLATED: 'translated',
  ABSTAINED: 'abstained',
});
export const CUSTOMER_COPY_KEYS = Object.freeze([
  'headline',
  'blocks',
]);

export const CUSTOMER_COPY_BLOCK_KINDS = Object.freeze([
  'summary',
  'recognition',
  'self_check',
  'action',
  'observation',
  'limitation',
]);

export const TRANSLATION_FORMATS = Object.freeze({
  EXECUTIVE: 'executive_summary',
  OVERVIEW: 'overview_pattern',
  SCORE: 'score_meaning',
  ONE_MOVE: 'one_move',
  ABSTENTION: 'abstention_summary',
  VISUAL_DNA: 'visual_summary',
  FIVE_FUTURES: 'five_futures',
  TEAM: 'team_leadership',
});

export const ALLOWED_CLASSIFICATIONS = Object.freeze([
  'Measured',
  'Inferred',
  'Estimated',
  'Hypothesis',
  INSUFFICIENT_EVIDENCE,
]);

export const LAYER3_SURFACE_ROLES = Object.freeze({
  OVERVIEW: 'overview',
  SCORE: 'score',
  ONE_MOVE: 'one_move',
  FIVE_FUTURES: 'five_futures',
  TEAM: 'team',
  VISUAL_DNA: 'visual_dna',
});

export const DETERMINISTIC_ABSTENTION_COPY = Object.freeze({
  headline: 'What this assessment leaves open',
  blocks: Object.freeze([Object.freeze({
    kind: 'limitation',
    text: 'This assessment does not contain enough information to support this conclusion, so it has been left open.',
  })]),
});
