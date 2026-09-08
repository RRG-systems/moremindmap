import { deepFreeze } from '../intelligenceFabric/validation.js';

export const SUBSCRIPTION_V1_FOUNDATION_VERSION = '1.1.0';

export const SUBSCRIPTION_V1_CONTRACT_VERSIONS = deepFreeze({
  canonical_customer_subject: SUBSCRIPTION_V1_FOUNDATION_VERSION,
  business_membership: SUBSCRIPTION_V1_FOUNDATION_VERSION,
  paid_entitlement: SUBSCRIPTION_V1_FOUNDATION_VERSION,
  session_allowance_ledger: SUBSCRIPTION_V1_FOUNDATION_VERSION,
  active_coaching_session: SUBSCRIPTION_V1_FOUNDATION_VERSION,
  personal_rsl_event: SUBSCRIPTION_V1_FOUNDATION_VERSION,
  personal_rsl_envelope: SUBSCRIPTION_V1_FOUNDATION_VERSION,
  relevant_history_retrieval_result: SUBSCRIPTION_V1_FOUNDATION_VERSION,
  coaching_state_packet: SUBSCRIPTION_V1_FOUNDATION_VERSION,
  lineage_version_identity: SUBSCRIPTION_V1_FOUNDATION_VERSION,
  universal_rsl_candidate: SUBSCRIPTION_V1_FOUNDATION_VERSION,
});

export const SUBJECT_STATUSES = deepFreeze([
  'ACTIVE',
  'SUSPENDED',
  'CLOSED',
  'RECONCILIATION_REQUIRED',
]);

export const MEMBERSHIP_ROLES = deepFreeze([
  'OWNER',
  'OPERATOR',
  'AUTHORIZED_ADVISOR',
  'READ_ONLY',
]);

export const MEMBERSHIP_STATUSES = deepFreeze([
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
  'RECONCILIATION_REQUIRED',
]);

export const ENTITLEMENT_STATES = deepFreeze([
  'PENDING',
  'ACTIVE',
  'ACTIVE_CANCELING',
  'SUSPENDED_PAYMENT',
  'TERMINATED',
  'RECONCILIATION_REQUIRED',
]);

export const SESSION_CLASSES = deepFreeze(['STANDARD', 'ONBOARDING_INCLUDED']);
export const SESSION_STATES = deepFreeze(['RESERVED', 'ACTIVE', 'GRACE', 'CONSUMED', 'RELEASED']);

export const RSL_EVENT_TYPES = deepFreeze([
  'EVIDENCE_ASSERTED',
  'EVIDENCE_OBSERVED',
  'EVIDENCE_CORRECTED',
  'CONTRADICTION_OPENED',
  'CONTRADICTION_RESOLVED',
  'MISSINGNESS_OPENED',
  'MISSINGNESS_RESOLVED',
  'DECISION',
  'COMMITMENT',
  'INTERVENTION',
  'PLAN_CHANGE',
  'ATTEMPT',
  'FRICTION',
  'OUTCOME',
  'VALIDATION',
  'FALSIFICATION',
  'CONFIDENCE_CHANGE',
  'QUESTION',
  'STATE_CHANGE',
  'CORRECTION',
  'RETRACTION',
]);

// Actor identity and source provenance are separate. A future human coach and the
// subscription coach can author proposals, but neither becomes truth authority.
export const ACTOR_TYPES = deepFreeze([
  'CUSTOMER',
  'ATHLETE',
  'INSTRUCTOR',
  'JOINT_AUTHORITY',
  'SUBSCRIPTION_COACH',
  'HUMAN_COACH',
  'DETERMINISTIC_RUNTIME',
  'EXTERNAL_AUTHORITY',
  'IMPORT_SERVICE',
]);

export const SOURCE_CLASSES = deepFreeze([
  'CUSTOMER_SELF_REPORT',
  'ATHLETE_SELF_REPORT',
  'INSTRUCTOR_OBSERVATION',
  'JOINT_HUMAN_AGREEMENT',
  'SUBSCRIPTION_COACH_PROPOSAL',
  'HUMAN_COACH_PROPOSAL',
  'SYSTEM_OBSERVED',
  'DETERMINISTIC_RUNTIME',
  'GOVERNED_EXTERNAL',
  'IMPORTED_HISTORICAL',
]);

export const COACHING_PURPOSES = deepFreeze([
  'ONBOARDING',
  'WEEKLY_COACHING',
  'EXPLAIN_TWIN',
  'FINISH_PLAN_135',
  'REVIEW_ONE_MOVE',
  'REVIEW_FUTURES',
  'EVIDENCE_REVIEW',
]);

export const CUSTOMER_LENSES = deepFreeze([
  'OVERVIEW',
  'WHERE_YOU_ARE',
  'FIVE_FUTURES',
  'ONE_MOVE',
  'PLAN',
  'EVIDENCE',
]);

export const REQUIRED_STATE_ARTIFACT_TYPES = deepFreeze([
  'NEW_BOS',
  'NEW_BA',
  'BOS_BA_FUSION',
  'WHOLE_BUSINESS_MODEL_V1',
  'FIVE_FUTURES_V2',
  'ONE_MOVE_V2',
  'PLAN_135',
  'EVIDENCE_LEDGER',
]);

export const OUTCOME_DIRECTIONS = deepFreeze([
  'POSITIVE',
  'NEGATIVE',
  'NEUTRAL',
  'UNRESOLVED',
  'CONFOUNDED',
]);

// These are defaults in a replaceable policy object, not schema constants.
export const DEFAULT_SESSION_TIMING_POLICY = deepFreeze({
  policy_id: 'subscription_v1_session_timing_defaults',
  policy_version: '1.1.0',
  reservation_ttl_seconds: 300,
  reconnect_grace_seconds: 900,
  active_hard_cap_seconds: 1800,
  active_hard_cap_enforced: false,
  standard_slots_per_billing_cycle: 4,
  onboarding_included_per_membership: 1,
  founder_approval_status: 'RATIFIED_AS_CONFIGURABLE_DEFAULTS',
});

export const DEFAULT_RETRIEVAL_POLICY = deepFreeze({
  policy_id: 'subscription_v1_scope_first_retrieval',
  policy_version: '1.0.0',
  scope_filter_must_run_first: true,
  privacy_filter_must_run_before_ranking: true,
  authority_filter_must_run_before_ranking: true,
  ranking_method: 'DETERMINISTIC_TYPED_RECENCY_V1',
  future_ranking_methods_after_scope_filter: [
    'SEMANTIC_RERANK_AFTER_SCOPE_FILTER',
    'HYBRID_RERANK_AFTER_SCOPE_FILTER',
  ],
  max_events: 40,
  max_estimated_tokens: 6000,
  universal_runtime_read_enabled: false,
  governed_external_runtime_read_enabled: false,
});

export const TRANSCRIPT_RETENTION_BOUNDARY = deepFreeze({
  policy_id: 'subscription_v1_transcript_boundary',
  policy_version: '1.0.0',
  canonical_rsl_dependency: false,
  ephemeral_buffer_allowed: true,
  durable_raw_transcript_retention: 'FOUNDER_POLICY_UNRESOLVED',
  destructive_retention_action_authorized: false,
});

export const UNIVERSAL_RSL_RUNTIME_FLAGS = deepFreeze({
  candidate_capture_enabled: true,
  runtime_read_enabled: false,
  promotion_enabled: false,
  autonomous_governance_enabled: false,
});

export const COACHING_DOCTRINE_INSERTION_POINT = deepFreeze({
  interface_id: 'subscription_v1_coaching_doctrine_adapter',
  implementation_status: 'RESERVED_FOR_AFW_04',
  provider_calls_enabled: false,
  deterministic_customer_choreography_allowed: false,
  required_inputs: ['coaching_state_packet', 'customer_turn'],
  required_output: 'governed_coaching_proposal',
});
