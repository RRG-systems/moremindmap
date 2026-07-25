export const DEPLOYMENT_READINESS_SCHEMA = '1.0.0';

export const CONTRACT_VERSIONS = Object.freeze({
  environment: 'coach-connect-deployment-environment-v1',
  configuration: 'coach-connect-deployment-configuration-v1',
  topology: 'coach-connect-deployment-topology-v1',
  gate: 'coach-connect-deployment-gate-record-v1',
  deploymentReceipt: 'coach-connect-deployment-receipt-v1',
  rollback: 'coach-connect-deployment-rollback-v1',
  recovery: 'coach-connect-deployment-recovery-v1',
  monitoring: 'coach-connect-deployment-monitoring-v1',
  alert: 'coach-connect-deployment-alert-v1',
  runbook: 'coach-connect-deployment-runbook-v1',
  proof: 'coach-connect-deployment-proof-v1',
});

export const ENVIRONMENT_CLASSES = Object.freeze([
  'LOCAL',
  'CI',
  'PREVIEW',
  'INTERNAL_STAGING',
  'INTERNAL_PRODUCTION_SHAPED',
  'FUTURE_PUBLIC_PRODUCTION',
]);

export const EVIDENCE_CLASSES = Object.freeze([
  'STATIC',
  'SYNTHETIC',
  'DEPLOYMENT_SHAPED_OFFLINE',
  'INTERNAL_LIVE',
  'HUMAN_APPROVED',
]);

export const OFFLINE_EVIDENCE_CLASSES = Object.freeze(
  EVIDENCE_CLASSES.filter((value) => !['INTERNAL_LIVE', 'HUMAN_APPROVED'].includes(value)),
);

export const ROUTE_CLASSES = Object.freeze([
  'SPA_ROOT',
  'STATIC_ASSET',
  'API',
  'ERROR',
  'REDIRECT',
  'PLATFORM_GENERATED_URL',
  'UNKNOWN_PATH',
]);

export const GATE_STATES = Object.freeze([
  'UNASSESSED',
  'PASS_STATIC',
  'PASS_SYNTHETIC',
  'PASS_DEPLOYMENT_SHAPED_OFFLINE',
  'PASS_INTERNAL_LIVE',
  'FAILED',
  'EXPIRED',
  'BLOCKED_AUTHORITY',
]);

export const READINESS_FLAGS = Object.freeze([
  'coach_connect',
  'subscriber_actions',
  'provider_calls',
  'production_traffic',
  'stripe',
  'transcript_persistence',
  'migration',
  'destructive_deletion',
  'production_shared_state',
]);

export const REQUIRED_RUNBOOK_IDS = Object.freeze([
  'deploy',
  'verify',
  'rollback',
  'emergency_disable',
  'restart_recovery',
  'security_incident',
  'privacy_incident',
  'retention_failure',
  'transcript_handling_failure',
  'operator_access_review',
  'post_deployment_validation',
]);

export const FORBIDDEN_SENSITIVE_KEYS = Object.freeze([
  'access_token',
  'address',
  'assertion',
  'client_address',
  'cookie',
  'credential',
  'customer_id',
  'email',
  'id_token',
  'media',
  'password',
  'private_coach_content',
  'profile_id',
  'prompt',
  'raw_subject',
  'response',
  'secret',
  'token',
  'transcript',
]);

export const FAILURE_CODES = Object.freeze([
  'ENVIRONMENT_UNVERIFIED',
  'CONFIGURATION_NOT_READY',
  'CONFIGURATION_SECRET_PRESENT',
  'CONFIGURATION_DIGEST_MISMATCH',
  'TOPOLOGY_UNVERIFIED',
  'EXISTING_PUBLIC_PROJECT_PROHIBITED',
  'OUTER_ACCESS_POLICY_REQUIRED',
  'ROUTE_COVERAGE_INCOMPLETE',
  'PUBLIC_ACCESS_POSSIBLE',
  'ACTIVATION_GATE_INCOMPLETE',
  'ACTIVATION_GATE_EXPIRED',
  'ACTIVATION_BYPASS_DETECTED',
  'EMERGENCY_DISABLE_REQUIRED',
  'LIVE_DEPENDENCY_PROHIBITED',
  'PRODUCTION_PERSISTENCE_PROHIBITED',
  'TRANSCRIPT_PERSISTENCE_PROHIBITED',
  'MIGRATION_PROHIBITED',
  'DESTRUCTIVE_DELETION_PROHIBITED',
  'STRIPE_PROHIBITED',
  'ROLLBACK_NOT_PROVEN',
  'ROLLBACK_STATE_REGRESSION',
  'RECOVERY_NOT_PROVEN',
  'RECOVERY_DUPLICATE_PROMOTION',
  'MONITORING_NOT_PROVEN',
  'CRITICAL_ALERT_UNDETECTED',
  'PRIVACY_UNSAFE_TELEMETRY',
  'RUNBOOK_INVALID',
  'PROOF_CLASS_MISMATCH',
  'PROTECTED_ROOT_CHANGED',
  'UNRELATED_WORK_INCLUDED',
  'IMPLEMENTATION_AUTHORITY_REQUIRED',
  'DEPLOYMENT_AUTHORITY_REQUIRED',
]);
