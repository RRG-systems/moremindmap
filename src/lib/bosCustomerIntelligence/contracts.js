export const BOS_CUSTOMER_INTELLIGENCE_VERSION = 'bos_customer_intelligence_v1';
export const BOS_CUSTOMER_INTELLIGENCE_MODEL = 'gpt-5.6-sol';
export const BOS_CUSTOMER_INTELLIGENCE_CACHE_TTL_HOURS = 24;
export const BOS_CUSTOMER_INTELLIGENCE_TIMEOUT_MS = 12000;
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
