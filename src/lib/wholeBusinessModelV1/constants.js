export const WBM_CONTRACT_ID = 'more-whole-business-model-v1';
export const WBM_CONTRACT_VERSION = '1.0.0';
export const WBM_SCHEMA_VERSION = '1.0.0';
export const WBM_ROUTER_VERSION = 'whole-business-context-router-v1';

export const EPISTEMIC_CLASSES = Object.freeze([
  'KNOWN',
  'STRONGLY_SUPPORTED',
  'SUPPORTED_HYPOTHESIS',
  'TENTATIVE',
  'CONFLICTED',
  'INSUFFICIENT_EVIDENCE',
  'ABSTAINED',
]);

export const CONSTRAINT_TYPES = Object.freeze([
  'person',
  'system',
  'capacity',
  'demand',
  'conversion',
  'economics',
  'role',
  'team',
  'market',
  'mixed',
  'insufficient_evidence',
]);

export const PERSON_BUSINESS_RELATIONSHIP_TYPES = Object.freeze([
  'AMPLIFIES',
  'COMPENSATES',
  'FRICTION',
  'FEASIBILITY_MODIFIER',
  'NO_MATERIAL_LINK',
  'ABSTAINED',
]);

export const PROJECTION_ELIGIBILITY = Object.freeze([
  'ELIGIBLE',
  'ELIGIBLE_WITH_DISCLOSURE',
  'BLOCKED_MISSING_EVIDENCE',
  'BLOCKED_CONTRADICTION',
  'BLOCKED_AUTHORITY_GAP',
  'BLOCKED_INTEGRITY',
]);

export const WBM_DOMAINS = Object.freeze([
  'financial',
  'demand',
  'relationship',
  'conversion',
  'pipeline',
  'listing',
  'buyer',
  'transaction',
  'operations',
  'accountability',
  'capacity',
  'team',
  'stage',
  'goals',
  'constraints',
  'market',
  'dynamic_context',
]);

export const FIVE_FUTURES_V2_ROLES = Object.freeze([
  'current_course',
  'emerging_future',
  'better_future',
  'bold_future',
  'downside_future',
]);

export const DEFAULT_CONTEXT_BUDGET = Object.freeze({
  universal_authorities: 8,
  vertical_authorities: 10,
  whole_person_claims: 6,
  team_members: 8,
  dynamic_items: 8,
  sections_per_authority: 11,
});

export const DEFAULT_AUTHORITY_SECTIONS = Object.freeze([
  'Mission',
  'Core Primitives',
  'Causal Mechanisms',
  'Evidence Inputs',
  'Strong Patterns',
  'Counterexamples and Confounds',
  'Cross-Authority Interactions',
  'Evidence, Confidence and Uncertainty',
  'Falsifiers',
  'Intervention Relevance',
  'Five Futures State-Contribution Contract',
]);

export const BASE_AUTHORITY_ROUTE = Object.freeze({
  universal: Object.freeze(['UB-01', 'UB-02', 'UB-03', 'UB-12']),
  real_estate: Object.freeze(['RE-01', 'RE-16']),
});

export const DOMAIN_AUTHORITY_EXPANSION = Object.freeze({
  financial: Object.freeze({ universal: ['UB-01', 'UB-02', 'UB-11', 'UB-12'], real_estate: ['RE-01', 'RE-16'] }),
  demand: Object.freeze({ universal: ['UB-04', 'UB-06'], real_estate: ['RE-02', 'RE-03', 'RE-04', 'RE-05', 'RE-06'] }),
  relationship: Object.freeze({ universal: ['UB-04', 'UB-07'], real_estate: ['RE-02', 'RE-03', 'RE-04'] }),
  conversion: Object.freeze({ universal: ['UB-06', 'UB-12'], real_estate: ['RE-03', 'RE-06'] }),
  pipeline: Object.freeze({ universal: ['UB-03', 'UB-06', 'UB-12'], real_estate: ['RE-06', 'RE-09', 'RE-10'] }),
  listing: Object.freeze({ universal: ['UB-05', 'UB-06', 'UB-08'], real_estate: ['RE-09', 'RE-11'] }),
  buyer: Object.freeze({ universal: ['UB-05', 'UB-06', 'UB-08'], real_estate: ['RE-10', 'RE-11'] }),
  transaction: Object.freeze({ universal: ['UB-07', 'UB-08'], real_estate: ['RE-09', 'RE-10', 'RE-11'] }),
  operations: Object.freeze({ universal: ['UB-03', 'UB-08', 'UB-09'], real_estate: ['RE-11', 'RE-12', 'RE-13'] }),
  accountability: Object.freeze({ universal: ['UB-09', 'UB-12'], real_estate: ['RE-12', 'RE-14', 'RE-15'] }),
  capacity: Object.freeze({ universal: ['UB-03', 'UB-08', 'UB-10'], real_estate: ['RE-11', 'RE-12', 'RE-13', 'RE-14'] }),
  team: Object.freeze({ universal: ['UB-08', 'UB-09', 'UB-10', 'UB-12'], real_estate: ['RE-13', 'RE-14', 'RE-15', 'RE-16'] }),
  stage: Object.freeze({ universal: ['UB-01', 'UB-10', 'UB-11'], real_estate: ['RE-12', 'RE-13', 'RE-16'] }),
  goals: Object.freeze({ universal: ['UB-01', 'UB-03', 'UB-11'], real_estate: ['RE-13', 'RE-16'] }),
  constraints: Object.freeze({ universal: ['UB-03', 'UB-08', 'UB-12'], real_estate: ['RE-06', 'RE-12', 'RE-13'] }),
  market: Object.freeze({ universal: ['UB-01', 'UB-11', 'UB-12'], real_estate: ['RE-01', 'RE-05', 'RE-16'] }),
  dynamic_context: Object.freeze({ universal: ['UB-11', 'UB-12'], real_estate: ['RE-01'] }),
});

export const HARD_BLOCK_CODES = Object.freeze([
  'WRONG_SUBJECT',
  'CROSS_PROFILE_CONTAMINATION',
  'CORRUPTED_EVIDENCE',
  'BROKEN_AUTHORITY_HASH',
  'INVALID_CASSETTE',
  'UNAUTHORIZED_TEAM_ACCESS',
  'PRIVACY_SECURITY_FAILURE',
  'MALFORMED_STATE',
  'LINEAGE_CORRUPTION',
  'UNAUTHORIZED_PRODUCTION_MUTATION',
]);

export const NON_BLOCKING_REASON_CODES = Object.freeze([
  'INCOMPLETE_EVIDENCE',
  'SUPPORTED_HYPOTHESIS',
  'AUTHORITY_DISAGREEMENT',
  'DYNAMIC_RESEARCH_WARRANTED',
  'UNCERTAINTY_PRESENT',
]);

export const LATER_RUNTIME_BOUNDARIES = Object.freeze({
  five_futures_v2_implemented: false,
  one_move_v2_implemented: false,
  trajectory_weights_computed: false,
  bayesian_project_authorized: false,
  calibration_project_authorized: false,
  rsl_active: false,
});
