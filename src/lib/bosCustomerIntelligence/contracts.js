export const BOS_CUSTOMER_INTELLIGENCE_VERSION = 'bos_customer_intelligence_v1';
export const BOS_LAYER2_VERSION = 'bos_truthfulness_v1';
export const BOS_CUSTOMER_INTELLIGENCE_MODEL = 'gpt-5.6-sol';
export const BOS_CUSTOMER_INTELLIGENCE_PROMPT_VERSION = 'prompt-v1';
export const BOS_CUSTOMER_INTELLIGENCE_VALIDATOR_VERSION = 'validator-v1';
export const BOS_CUSTOMER_INTELLIGENCE_OUTPUT_VARIANT = 'premium-web-v1';
export const BOS_CUSTOMER_INTELLIGENCE_TRANSLATION_VARIANT = 'standard';
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
export const CUSTOMER_COPY_FIELDS = Object.freeze([
  'headline',
  'explanation',
  'recognizable_pattern',
  'evidence_boundary',
  'practical_use',
]);

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
  headline: INSUFFICIENT_EVIDENCE,
  explanation: INSUFFICIENT_EVIDENCE,
  recognizable_pattern: '',
  evidence_boundary:
    'The assessment does not contain enough validated evidence to support this conclusion.',
  practical_use:
    'Treat this as an open question until additional direct evidence is available.',
});
