import { deepFreeze } from '../../validation.js';

export const PRODUCTION_SECURITY_PREREQUISITE_SCHEMA = '1.0.0';

export const PRODUCTION_SECURITY_POLICY_VERSIONS = deepFreeze({
  subject_binding: 'subscriber-subject-binding-v1',
  session_elevation: 'subscriber-session-elevation-v1',
  shared_state: 'shared-security-state-v1',
  retention_authority: 'retention-authority-v1',
  deletion_lifecycle: 'deletion-lifecycle-v1',
  erasure_strategy: 'governed-erasure-v1',
  transport_trust: 'production-transport-trust-v1',
  operator_entitlement: 'operator-entitlement-v1',
});

export const PRODUCTION_SECURITY_FAILURE_CODES = deepFreeze([
  'SUBJECT_ASSERTION_REQUIRED',
  'SUBJECT_ASSERTION_INVALID',
  'SUBJECT_MAPPING_NOT_FOUND',
  'SUBJECT_MAPPING_AMBIGUOUS',
  'SUBJECT_MAPPING_STALE',
  'SUBJECT_DISABLED',
  'SUBJECT_DELETED',
  'SESSION_ELEVATION_REQUIRED',
  'SESSION_ROTATION_FAILED',
  'PRE_AUTH_SESSION_REPLAYED',
  'PRE_AUTH_CSRF_REPLAYED',
  'SHARED_SECURITY_STATE_REQUIRED',
  'SHARED_SECURITY_STATE_UNAVAILABLE',
  'SHARED_SECURITY_STATE_PARTITIONED',
  'SECURITY_STATE_CLOCK_INVALID',
  'RETENTION_POLICY_UNAPPROVED',
  'RETENTION_AUTHORITY_INVALID',
  'LEGAL_HOLD_ACTIVE',
  'DELETION_TARGET_INCOMPLETE',
  'DELETION_VERIFICATION_FAILED',
  'BACKING_STORE_UNRESOLVED',
  'PHYSICAL_DELETION_NOT_PROVEN',
  'ERASURE_STRATEGY_UNAPPROVED',
  'HSTS_POLICY_UNAPPROVED',
  'HTTPS_TERMINATION_UNVERIFIED',
  'TRUSTED_PROXY_POLICY_UNAPPROVED',
  'CLIENT_ADDRESS_AMBIGUOUS',
  'OPERATOR_AUTHENTICATION_REQUIRED',
  'OPERATOR_ENTITLEMENT_INVALID',
  'OPERATOR_REASON_REQUIRED',
  'OPERATOR_DUAL_CONTROL_REQUIRED',
  'OPERATOR_AUDIT_FAILED',
  'PRODUCTION_PREREQUISITE_INACTIVE',
]);

export const DEFAULT_PRODUCTION_SECURITY_FLAGS = deepFreeze({
  foundation_enabled: false,
  subject_binding_enabled: false,
  session_elevation_enabled: false,
  shared_state_enabled: false,
  retention_enforcement_enabled: false,
  deletion_planning_enabled: false,
  erasure_planning_enabled: false,
  transport_policy_enabled: false,
  operator_authorization_enabled: false,
  transcript_persistence_enabled: false,
  transcript_backup_enabled: false,
  destructive_deletion_enabled: false,
  live_auth_provider_enabled: false,
  live_shared_state_enabled: false,
  live_object_store_enabled: false,
  deployment_enabled: false,
  production_traffic_enabled: false,
  stripe_enabled: false,
  synthetic_only: true,
  emergency_disabled: true,
});

export const PRODUCTION_SECURITY_CAPABILITY_FLAGS = deepFreeze({
  SUBJECT_BINDING: 'subject_binding_enabled',
  SESSION_ELEVATION: 'session_elevation_enabled',
  SHARED_STATE: 'shared_state_enabled',
  RETENTION: 'retention_enforcement_enabled',
  DELETION_PLANNING: 'deletion_planning_enabled',
  ERASURE_PLANNING: 'erasure_planning_enabled',
  TRANSPORT_POLICY: 'transport_policy_enabled',
  OPERATOR_AUTHORIZATION: 'operator_authorization_enabled',
});

export const SUBJECT_STATUSES = deepFreeze([
  'ACTIVE',
  'DISABLED',
  'DELETED',
  'RECOVERY_PENDING',
]);

export const PRE_AUTH_SESSION_STATUSES = deepFreeze([
  'ACTIVE',
  'ELEVATION_PENDING',
  'ROTATED',
  'REVOKED',
  'EXPIRED',
  'INVALID',
]);

export const AUTHENTICATED_SESSION_STATUSES = deepFreeze([
  'ACTIVE',
  'ROTATED',
  'REVOKED',
  'EXPIRED',
  'INVALID',
]);

export const RETENTION_DATA_CLASSES = deepFreeze([
  'CONTROL_PLANE_METADATA',
  'TRANSCRIPT_CONTENT',
  'RECORDING_CONTENT',
  'DERIVED_TRANSCRIPT_ARTIFACT',
  'DELETION_EPOCH',
  'DELETION_TOMBSTONE',
  'SECURITY_AUDIT_RECEIPT',
]);

export const DELETION_JOB_STATES = deepFreeze([
  'PLANNED',
  'AUTHORITY_VERIFIED',
  'LEGAL_HOLD_CHECKED',
  'EPOCH_ADVANCED',
  'SCHEDULED',
  'ATTEMPTING',
  'PARTIALLY_VERIFIED',
  'VERIFIED',
  'FAILED_RETRYABLE',
  'FAILED_TERMINAL',
  'RETAINED_LEGAL_HOLD',
]);

export const DELETION_TARGET_STATES = deepFreeze([
  'PLANNED',
  'ATTEMPTED',
  'VERIFIED',
  'FAILED_RETRYABLE',
  'FAILED_TERMINAL',
  'RETAINED_LEGAL_HOLD',
]);

export const OPERATOR_ROLES = deepFreeze([
  'SUPPORT_READONLY',
  'SECURITY_REVIEWER',
  'PRIVACY_OPERATOR',
  'AUDIT_REVIEWER',
  'INCIDENT_COMMANDER',
]);

export const OPERATOR_ACTIONS = deepFreeze([
  'READ_CONTROL_METADATA',
  'READ_SECURITY_AUDIT',
  'REVIEW_SECURITY_POLICY',
  'PLAN_DELETION',
  'EXECUTE_DELETION_PLAN',
  'VERIFY_DELETION_PLAN',
  'RELEASE_LEGAL_HOLD',
  'DESTROY_ERASURE_KEY',
  'BREAK_GLASS_CONTENT_ACCESS',
]);

export const DUAL_CONTROL_OPERATOR_ACTIONS = deepFreeze([
  'EXECUTE_DELETION_PLAN',
  'RELEASE_LEGAL_HOLD',
  'DESTROY_ERASURE_KEY',
  'BREAK_GLASS_CONTENT_ACCESS',
]);

export const RATIFIED_DECISION_STATUS = 'APPROVED_WITH_RATIFIED_REFINEMENTS';

export const RATIFIED_ARCHITECTURE_DECISIONS = deepFreeze({
  SUBSCRIBER_AUTHORITY_SOURCE: 'AUTH0_OIDC_PROVIDER_NEUTRAL_CONTRACT',
  SUBSCRIBER_SESSION_OWNER: 'SERVER_OWNED_OPAQUE_ROTATING_BFF_SESSION',
  SHARED_STATE_PLATFORM: 'UPSTASH_REDIS_CONDITIONAL_CAPABILITY_ADAPTER',
  RETENTION_POLICY_AUTHORITY: 'PRIVACY_PRODUCT_LEGAL_REVIEWED_ACTIVATION_GATED',
  TRANSCRIPT_BACKING_STORE: 'PRIVATE_UNVERSIONED_S3_SCOPED_ENCRYPTION',
  BACKUP_RESTORE_HORIZON: 'CONTROL_METADATA_MAX_30_DAYS_NO_TRANSCRIPT_BACKUP',
  HISTORICAL_ERASURE_STRATEGY: 'PRODUCTION_STORE_REPLACEMENT_SCOPED_CRYPTO_ERASURE',
  PRODUCTION_HOSTING_TRUST: 'ONE_EXACT_VERCEL_EDGE_NO_UPSTREAM_PROXY',
  HSTS_DIRECTIVES: 'STAGED_300_86400_31536000_NO_SUBDOMAINS_NO_PRELOAD',
  OPERATOR_IDENTITY_AUTHORITY: 'ISOLATED_AUTH0_NAMED_WEBAUTHN_IDENTITIES',
  OPERATOR_ENTITLEMENT_POLICY: 'DENY_DEFAULT_RBAC_ABAC_DUAL_CONTROL',
});
