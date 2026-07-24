import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_COACH_CONNECT_SECURITY_FLAGS,
  LIVE_SESSION_SECURITY_PRIVACY_CLASSES,
  SECURITY_FAILURE_CODES,
  validateCapabilityRecord,
  validateDeletionEpoch,
  validateSecurityActor,
  validateSecurityResource,
  validateSecuritySession,
} from '../src/lib/intelligenceFabric/coachConnect/security/index.js';

const scope = { tenant_id: 'tenant_security', profile_id: 'profile_security', business_id: 'business_security', subscriber_id: 'subscriber_security' };

test('security vocabulary is exact and hardening is default-off', () => {
  assert.equal(SECURITY_FAILURE_CODES.length, 25);
  assert.equal(new Set(SECURITY_FAILURE_CODES).size, 25);
  assert.equal(LIVE_SESSION_SECURITY_PRIVACY_CLASSES.length, 7);
  assert.deepEqual(DEFAULT_COACH_CONNECT_SECURITY_FLAGS, {
    security_hardening_enabled: false,
    synthetic_only: true,
    production_traffic_enabled: false,
    shared_security_state_required: false,
    retention_policy_approved: false,
    deletion_execution_enabled: false,
    emergency_disabled: true,
  });
});

test('actor session and resource contracts require bound identity exact scope version and deletion epoch', () => {
  const actor = { actor_id: 'subscriber_security', role: 'SUBSCRIBER', subject_binding_hash: 'subject_hash', security_version: 1 };
  const session = { session_id: 'session_security', subject_binding_hash: 'subject_hash', browser_binding_hash: 'browser_hash', status: 'ACTIVE', issued_at: '2026-07-24T00:00:00.000Z', expires_at: '2026-07-24T01:00:00.000Z', security_version: 1 };
  const resource = { resource_type: 'projection', resource_id: 'projection_security', scope, version: 1, deletion_epoch: 0, privacy_class: 'SUBSCRIBER_PRIVATE' };
  assert.equal(validateSecurityActor(actor).valid, true);
  assert.equal(validateSecuritySession(session).valid, true);
  assert.equal(validateSecurityResource(resource).valid, true);
  assert.equal(validateSecurityActor({ ...actor, subject_binding_hash: '' }).valid, false);
  assert.equal(validateSecuritySession({ ...session, status: 'UNKNOWN' }).valid, false);
  assert.equal(validateSecurityResource({ ...resource, scope: { tenant_id: 'tenant_security' } }).errors[0].code, 'TENANT_SCOPE_VIOLATION');
  assert.equal(validateSecurityResource({ ...resource, deletion_epoch: -1 }).valid, false);
});

test('capability record cannot carry raw authority or secret material', () => {
  const record = {
    schema_version: '1.0.0',
    capability_id: 'capability_security',
    token_hash: 'a'.repeat(64),
    purpose: 'temporary_internal_subscription_entitlement',
    subject_binding_hash: 'subject_hash',
    scope_binding_hash: 'scope_hash',
    browser_binding_hash: 'browser_hash',
    environment_id: 'test_environment',
    issuer: 'test_issuer',
    audience: 'test_audience',
    issued_at: '2026-07-24T00:00:00.000Z',
    not_before: '2026-07-24T00:00:00.000Z',
    expires_at: '2026-07-24T00:15:00.000Z',
    security_version: 1,
    key_id: 'key_v1',
    status: 'ACTIVE',
    billing_evidence: false,
    stripe_subscription_created: false,
    admin_authority: false,
    coach_authority: false,
    operator_authority: false,
    canonical_mutation_authority: false,
  };
  assert.equal(validateCapabilityRecord(record).valid, true);
  assert.equal(validateCapabilityRecord({ ...record, coach_authority: true }).valid, false);
  assert.equal(validateCapabilityRecord({ ...record, raw_token: 'forbidden' }).valid, false);
});

test('deletion epoch is minimal content-free governance state', () => {
  const record = { scope_hash: 'scope_hash', epoch: 1, reason_code: 'RETENTION_EXPIRED', advanced_at: '2026-07-24T00:00:00.000Z', policy_version: 'coach-connect-retention-proposal-v1' };
  assert.equal(validateDeletionEpoch(record).valid, true);
  assert.equal(validateDeletionEpoch({ ...record, epoch: 0 }).valid, false);
});
