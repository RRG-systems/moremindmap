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

export const UNIVERSAL_BASE_AUTHORITY_ROUTE = Object.freeze(['UB-01', 'UB-02', 'UB-03', 'UB-12']);

export const UNIVERSAL_DOMAIN_AUTHORITY_EXPANSION = Object.freeze({
  financial: Object.freeze(['UB-01', 'UB-02', 'UB-11', 'UB-12']),
  demand: Object.freeze(['UB-04', 'UB-06']),
  relationship: Object.freeze(['UB-04', 'UB-07']),
  conversion: Object.freeze(['UB-06', 'UB-12']),
  pipeline: Object.freeze(['UB-03', 'UB-06', 'UB-12']),
  listing: Object.freeze(['UB-05', 'UB-06', 'UB-08']),
  buyer: Object.freeze(['UB-05', 'UB-06', 'UB-08']),
  transaction: Object.freeze(['UB-07', 'UB-08']),
  operations: Object.freeze(['UB-03', 'UB-08', 'UB-09']),
  accountability: Object.freeze(['UB-09', 'UB-12']),
  capacity: Object.freeze(['UB-03', 'UB-08', 'UB-10']),
  team: Object.freeze(['UB-08', 'UB-09', 'UB-10', 'UB-12']),
  stage: Object.freeze(['UB-01', 'UB-10', 'UB-11']),
  goals: Object.freeze(['UB-01', 'UB-03', 'UB-11']),
  constraints: Object.freeze(['UB-03', 'UB-08', 'UB-12']),
  market: Object.freeze(['UB-01', 'UB-11', 'UB-12']),
  dynamic_context: Object.freeze(['UB-11', 'UB-12']),
});

// Backward-compatible names remain available to callers, but no vertical route
// lives in the universal WBM module. A governed cassette registration supplies it.
export const BASE_AUTHORITY_ROUTE = Object.freeze({ universal: UNIVERSAL_BASE_AUTHORITY_ROUTE });
export const DOMAIN_AUTHORITY_EXPANSION = Object.freeze(Object.fromEntries(
  Object.entries(UNIVERSAL_DOMAIN_AUTHORITY_EXPANSION).map(([domain, universal]) => [domain, Object.freeze({ universal })]),
));

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
