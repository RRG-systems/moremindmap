import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLegalHold,
  evaluateRetentionAuthority,
  RATIFIED_INTERIM_RETENTION_POLICY,
  releaseLegalHold,
  retentionDecisionForDataClass,
  retentionPolicyFingerprint,
  validateRetentionAuthority,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js';

test('ratified interim authority is valid but sensitive persistence remains activation-gated', () => {
  assert.equal(validateRetentionAuthority(RATIFIED_INTERIM_RETENTION_POLICY).valid, true);
  const authority = evaluateRetentionAuthority();
  assert.equal(authority.architecture_implementation_allowed, true);
  assert.equal(authority.sensitive_persistence_allowed, false);
  assert.equal(authority.activation_gate, 'SIGNED_SCHEDULE_REQUIRED');
  assert.equal(authority.legal_retention_certified, false);
  assert.equal(authority.production_activation_authorized, false);
  assert.equal(typeof retentionPolicyFingerprint(), 'string');
});

test('transcript recording and derivatives are ephemeral with backups prohibited', () => {
  for (const dataClass of ['TRANSCRIPT_CONTENT', 'RECORDING_CONTENT', 'DERIVED_TRANSCRIPT_ARTIFACT']) {
    assert.equal(retentionDecisionForDataClass({ data_class: dataClass, operation: 'PERSIST' }).allowed, false);
    const backup = retentionDecisionForDataClass({ data_class: dataClass, operation: 'BACKUP' });
    assert.equal(backup.allowed, false);
    assert.equal(backup.disposition, 'BACKUP_PROHIBITED');
  }
  const metadata = retentionDecisionForDataClass({
    data_class: 'CONTROL_PLANE_METADATA',
    operation: 'BACKUP',
  });
  assert.equal(metadata.allowed, true);
  assert.equal(metadata.disposition, 'MAXIMUM_30_DAY_ENCRYPTED_ROLLING_BACKUP');
  assert.equal(metadata.transcript_content_included, false);
});

test('signed schedule is required before a policy can allow sensitive persistence', () => {
  const completed = {
    ...structuredClone(RATIFIED_INTERIM_RETENTION_POLICY),
    signed_data_class_schedule_reference: 'signed-schedule-reference',
    outside_privacy_legal_review_complete: true,
    sensitive_persistence_activation_allowed: true,
  };
  assert.equal(evaluateRetentionAuthority(completed).sensitive_persistence_allowed, true);
  const missingLegal = { ...completed, outside_privacy_legal_review_complete: false };
  assert.equal(evaluateRetentionAuthority(missingLegal).sensitive_persistence_allowed, false);
});

test('unknown authority and draft policies cannot execute retention decisions', () => {
  const unknownAuthority = {
    ...structuredClone(RATIFIED_INTERIM_RETENTION_POLICY),
    owner_subject_ref: 'unknown-owner',
    approver_subject_refs: ['unknown-approver'],
  };
  assert.equal(evaluateRetentionAuthority(unknownAuthority).architecture_implementation_allowed, false);
  const draft = {
    ...structuredClone(RATIFIED_INTERIM_RETENTION_POLICY),
    status: 'DRAFT',
  };
  assert.equal(evaluateRetentionAuthority(draft).architecture_implementation_allowed, false);
  assert.notEqual(
    RATIFIED_INTERIM_RETENTION_POLICY.rules[0].subscriber_request_behavior,
    RATIFIED_INTERIM_RETENTION_POLICY.rules[0].coach_request_behavior,
  );
});

test('legal hold preserves content but grants no read or unilateral release authority', () => {
  const hold = createLegalHold({
    hold_id: 'hold-001',
    exact_scope_hash: 'scope-hash-001',
    governed_data_classes: ['TRANSCRIPT_CONTENT'],
    authority_subject_ref: 'legal-authority-001',
    reason_code: 'LITIGATION_HOLD',
    issued_at: '2026-07-24T14:00:00.000Z',
    review_at: '2026-08-24T14:00:00.000Z',
    audit_event_id: 'audit-hold-001',
  }).hold;
  assert.equal(hold.status, 'ACTIVE');
  assert.equal('read_authority' in hold, false);
  assert.equal(releaseLegalHold({
    hold,
    released_at: '2026-07-25T14:00:00.000Z',
    operator_decision: { allowed: false },
  }).code, 'LEGAL_HOLD_ACTIVE');
  const released = releaseLegalHold({
    hold,
    released_at: '2026-07-25T14:00:00.000Z',
    operator_decision: {
      allowed: true,
      action: 'RELEASE_LEGAL_HOLD',
      decision_id: 'operator-decision-hold-release',
      approver_refs: ['second-operator'],
    },
  });
  assert.equal(released.hold.status, 'RELEASED');
});
