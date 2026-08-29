export const RECRUITING_V2_PLAN_VERSION = 'more-recruiting-v2-surface-plan-003a-v1';

export const VISUAL_PRIMITIVES = Object.freeze([
  'METRIC_STRIP',
  'LINE_CHART',
  'BAR_CHART',
  'COMPARISON',
  'TIMELINE',
  'FUNNEL',
  'TRAJECTORY',
  'FIVE_FUTURES',
  'PERSON',
  'RELATIONSHIP',
  'CONSTRAINT',
  'SCENARIO',
  'EVIDENCE_GAP',
  'HYPOTHESIS',
  'COMMITMENTS',
  'DECISION',
  'PLAIN_LANGUAGE',
  'QUESTION',
]);

export const INTERACTIVE_PRIMITIVES = Object.freeze([
  'SHOW_EVIDENCE',
  'ADD_CONTEXT',
  'ACCEPT_HYPOTHESIS',
  'REJECT_HYPOTHESIS',
  'CONTEST_HYPOTHESIS',
  'EXPLORE_SCENARIO',
  'CHANGE_PURPOSE',
  'WHAT_NEXT',
  'COMPLETE_MEETING',
  'RESET_SYNTHETIC_SESSION',
]);

export const EMPHASIS = Object.freeze(['PRIMARY', 'SECONDARY', 'QUIET']);

export const MORE_RENDERING_DOCTRINE = Object.freeze({
  field: 'premium near-black and charcoal',
  accents: ['emerald', 'cyan', 'violet', 'amber', 'rose'],
  typography: 'clear, confident, restrained, readable at co-present distance',
  density: 'smallest useful environment; whitespace is structural',
  reliability: 'frontier selects meaning and composition; MORE renders governed values and permitted controls',
});

export const PROHIBITED_ACTIONS = Object.freeze([
  'SEND_MESSAGE',
  'CREATE_INVITATION',
  'WRITE_CANONICAL_PROFILE',
  'WRITE_LOCAL_OPPORTUNITY',
  'CHANGE_ENTITLEMENT',
  'DEPLOY',
  'PUSH',
  'BILL',
]);

export const CREATION_LANGUAGE_CONTRACT = Object.freeze({
  version: 'more-recruiting-v2-creation-language-003a-v1',
  visualPrimitives: VISUAL_PRIMITIVES,
  interactivePrimitives: INTERACTIVE_PRIMITIVES.filter((action) => action !== 'RESET_SYNTHETIC_SESSION'),
  emphasis: EMPHASIS,
  renderingDoctrine: MORE_RENDERING_DOCTRINE,
  rule: 'Select governed references. Never author executable UI code or values.',
});
