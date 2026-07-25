import { hashCanonicalJson } from '../../hashing.js';
import { deepFreeze } from '../../validation.js';
import {
  PRODUCTION_SECURITY_POLICY_VERSIONS,
  RETENTION_DATA_CLASSES,
} from './constants.js';
import {
  validateLegalHold,
  validateRetentionAuthority,
} from './contracts.js';

const frozen = (value) => deepFreeze(structuredClone(value));

const baseRule = {
  legal_hold_behavior: 'PRESERVE_WITHOUT_GRANTING_READ_AUTHORITY',
  subscriber_request_behavior: 'SUBSCRIBER_REQUEST_REQUIRES_IDENTITY_POLICY_AND_HOLD_REVIEW',
  coach_request_behavior: 'COACH_REQUEST_RECORDED_WITHOUT_SUBSCRIBER_DELETION_AUTHORITY',
  deletion_eligibility: 'POLICY_AND_HOLD_AND_ENTITLEMENT_REQUIRED',
  execution_entitlement: 'PRIVACY_OPERATOR_WITH_RATIFIED_SCOPE',
  audit_retention_rule: 'CONTENT_FREE_RECEIPT_UNDER_SEPARATE_APPROVED_SCHEDULE',
  human_approved_source_reference: 'ratification-2026-07-24',
};

export const RATIFIED_INTERIM_RETENTION_POLICY = deepFreeze({
  policy_id: 'coach-connect-retention-interim-ratified-v1',
  version: 1,
  status: 'APPROVED',
  owner_subject_ref: 'role:privacy_owner',
  approver_subject_refs: [
    'D.J.:founder_product_owner',
    'reviewer:Spock',
  ],
  effective_at: '2026-07-24T00:00:00.000Z',
  supersedes_policy_id: null,
  human_approval_reference: 'MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_HUMAN_DECISION_RATIFICATION_V1',
  signed_data_class_schedule_reference: null,
  outside_privacy_legal_review_complete: false,
  sensitive_persistence_activation_allowed: false,
  rules: [
    {
      ...baseRule,
      data_class: 'CONTROL_PLANE_METADATA',
      trigger: 'CREATED_AT',
      duration_or_event_rule: 'MAXIMUM_30_DAYS_RATIFIED_TECHNICAL_HORIZON',
      backup_disposition: 'ENCRYPTED_ROLLING_BACKUP_MAXIMUM_30_DAYS',
    },
    {
      ...baseRule,
      data_class: 'TRANSCRIPT_CONTENT',
      trigger: 'SESSION_TERMINATION',
      duration_or_event_rule: 'EPHEMERAL_PROCESSING_ONLY_UNTIL_SIGNED_SCHEDULE',
      backup_disposition: 'BACKUP_PROHIBITED',
    },
    {
      ...baseRule,
      data_class: 'RECORDING_CONTENT',
      trigger: 'CAPTURE_ATTEMPT',
      duration_or_event_rule: 'CAPTURE_DISABLED_EPHEMERAL_ONLY',
      backup_disposition: 'BACKUP_PROHIBITED',
    },
    {
      ...baseRule,
      data_class: 'DERIVED_TRANSCRIPT_ARTIFACT',
      trigger: 'DERIVATION',
      duration_or_event_rule: 'EPHEMERAL_UNLESS_SIGNED_SCHEDULE_AND_LINEAGE',
      backup_disposition: 'BACKUP_PROHIBITED',
    },
    {
      ...baseRule,
      data_class: 'DELETION_EPOCH',
      trigger: 'EPOCH_ADVANCEMENT',
      duration_or_event_rule: 'PRESERVE_FOR_RESTORE_ENFORCEMENT',
      backup_disposition: 'SEPARATE_ENCRYPTED_CONTROL_PLANE',
    },
    {
      ...baseRule,
      data_class: 'DELETION_TOMBSTONE',
      trigger: 'DELETION_DECISION',
      duration_or_event_rule: 'PRESERVE_CONTENT_FREE_TOMBSTONE_FOR_RESTORE_ENFORCEMENT',
      backup_disposition: 'SEPARATE_ENCRYPTED_CONTROL_PLANE',
    },
    {
      ...baseRule,
      data_class: 'SECURITY_AUDIT_RECEIPT',
      trigger: 'SECURITY_DECISION',
      duration_or_event_rule: 'CONTENT_FREE_RECEIPT_PENDING_SIGNED_SCHEDULE',
      backup_disposition: 'CONTROL_PLANE_ONLY_MAXIMUM_30_DAYS_UNTIL_SIGNED_SCHEDULE',
    },
  ],
  migration_disposition: 'NO_PRODUCTION_MIGRATION_AUTHORIZED',
  activation_gate: 'SIGNED_DATA_CLASS_RETENTION_SCHEDULE_AND_OUTSIDE_PRIVACY_LEGAL_REVIEW',
});

export function evaluateRetentionAuthority(policy = RATIFIED_INTERIM_RETENTION_POLICY) {
  const validation = validateRetentionAuthority(policy);
  const ratifiedAuthority = policy?.policy_id === RATIFIED_INTERIM_RETENTION_POLICY.policy_id
    && policy?.owner_subject_ref === RATIFIED_INTERIM_RETENTION_POLICY.owner_subject_ref
    && RATIFIED_INTERIM_RETENTION_POLICY.approver_subject_refs
      .every((subjectRef) => policy?.approver_subject_refs?.includes(subjectRef))
    && policy?.human_approval_reference === RATIFIED_INTERIM_RETENTION_POLICY.human_approval_reference
    && policy?.migration_disposition === 'NO_PRODUCTION_MIGRATION_AUTHORIZED';
  const signedSchedule = typeof policy.signed_data_class_schedule_reference === 'string'
    && policy.signed_data_class_schedule_reference.length > 0
    && policy.outside_privacy_legal_review_complete === true;
  return frozen({
    valid: validation.valid && ratifiedAuthority,
    architecture_implementation_allowed: validation.valid
      && ratifiedAuthority
      && policy.status === 'APPROVED',
    sensitive_persistence_allowed: validation.valid
      && ratifiedAuthority
      && policy.status === 'APPROVED'
      && policy.sensitive_persistence_activation_allowed === true
      && signedSchedule,
    code: validation.valid && ratifiedAuthority ? null : 'RETENTION_AUTHORITY_INVALID',
    activation_gate: signedSchedule ? 'SATISFIED_NOT_ACTIVATED' : 'SIGNED_SCHEDULE_REQUIRED',
    legal_retention_certified: false,
    production_activation_authorized: false,
    errors: ratifiedAuthority
      ? validation.errors
      : [...validation.errors, { code: 'RETENTION_AUTHORITY_INVALID', field: 'ratified_authority' }],
  });
}

export function retentionDecisionForDataClass({
  data_class,
  operation,
  policy = RATIFIED_INTERIM_RETENTION_POLICY,
}) {
  const authority = evaluateRetentionAuthority(policy);
  const rule = policy.rules?.find((item) => item.data_class === data_class);
  if (!authority.valid || !rule || !RETENTION_DATA_CLASSES.includes(data_class)) {
    return frozen({ allowed: false, code: 'RETENTION_AUTHORITY_INVALID' });
  }
  if (['TRANSCRIPT_CONTENT', 'RECORDING_CONTENT', 'DERIVED_TRANSCRIPT_ARTIFACT'].includes(data_class)
    && ['PERSIST', 'BACKUP', 'MIGRATE'].includes(operation)
    && !authority.sensitive_persistence_allowed) {
    return frozen({
      allowed: false,
      code: 'RETENTION_POLICY_UNAPPROVED',
      disposition: operation === 'BACKUP' ? 'BACKUP_PROHIBITED' : 'EPHEMERAL_ONLY',
      activation_gate: authority.activation_gate,
    });
  }
  if (data_class === 'CONTROL_PLANE_METADATA' && operation === 'BACKUP') {
    return frozen({
      allowed: true,
      code: null,
      disposition: 'MAXIMUM_30_DAY_ENCRYPTED_ROLLING_BACKUP',
      transcript_content_included: false,
    });
  }
  return frozen({
    allowed: operation !== 'DESTRUCTIVE_EXECUTION',
    code: operation === 'DESTRUCTIVE_EXECUTION' ? 'RETENTION_POLICY_UNAPPROVED' : null,
    disposition: rule.duration_or_event_rule,
    rule,
  });
}

export function createLegalHold({
  hold_id,
  exact_scope_hash,
  governed_data_classes,
  authority_subject_ref,
  reason_code,
  issued_at,
  review_at,
  policy_version = PRODUCTION_SECURITY_POLICY_VERSIONS.retention_authority,
  audit_event_id,
}) {
  const hold = {
    hold_id,
    exact_scope_hash,
    governed_data_classes,
    authority_subject_ref,
    reason_code,
    issued_at,
    review_at,
    released_at: null,
    status: 'ACTIVE',
    policy_version,
    audit_event_id,
  };
  const validation = validateLegalHold(hold);
  return validation.valid
    ? frozen({ ok: true, hold })
    : frozen({ ok: false, code: validation.errors[0]?.code || 'RETENTION_AUTHORITY_INVALID' });
}

export function releaseLegalHold({ hold, released_at, operator_decision }) {
  const validation = validateLegalHold(hold);
  if (!validation.valid
    || hold.status !== 'ACTIVE'
    || operator_decision?.allowed !== true
    || operator_decision.action !== 'RELEASE_LEGAL_HOLD'
    || !Array.isArray(operator_decision.approver_refs)
    || operator_decision.approver_refs.length < 1) {
    return frozen({ ok: false, code: 'LEGAL_HOLD_ACTIVE' });
  }
  return frozen({
    ok: true,
    hold: {
      ...hold,
      status: 'RELEASED',
      released_at,
      release_decision_ref: operator_decision.decision_id,
    },
  });
}

export function retentionPolicyFingerprint(policy = RATIFIED_INTERIM_RETENTION_POLICY) {
  return hashCanonicalJson(policy);
}
