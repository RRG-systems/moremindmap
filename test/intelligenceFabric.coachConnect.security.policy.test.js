import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCoachConnectSecurityPolicy,
  InMemorySecurityStateStore,
  SECURITY_ACTIONS,
} from '../src/lib/intelligenceFabric/coachConnect/security/index.js';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';
import { createSecuredLiveSessionService } from '../src/lib/intelligenceFabric/coachConnect/liveSession/service.js';

const scope = { tenant_id: 'tenant_policy', profile_id: 'profile_policy', business_id: 'business_policy', subscriber_id: 'subscriber_policy' };
const otherScope = { ...scope, tenant_id: 'tenant_other' };
const activeFlags = { security_hardening_enabled: true, synthetic_only: true, production_traffic_enabled: false, shared_security_state_required: false, retention_policy_approved: false, deletion_execution_enabled: false, emergency_disabled: false };
const at = '2026-07-24T00:10:00.000Z';

function context(overrides = {}) {
  const actor = overrides.actor || { actor_id: scope.subscriber_id, role: 'SUBSCRIBER', subject_binding_hash: 'subject_hash', security_version: 1 };
  const session = overrides.session || { session_id: 'session_policy', subject_binding_hash: actor.subject_binding_hash, browser_binding_hash: 'browser_hash', status: 'ACTIVE', issued_at: '2026-07-24T00:00:00.000Z', expires_at: '2026-07-24T01:00:00.000Z', security_version: 1 };
  return {
    actor,
    session,
    action: SECURITY_ACTIONS.READ_OWN_PROJECTION,
    actor_scope: scope,
    resource: { resource_type: 'projection', resource_id: 'projection_policy', scope, version: 1, deletion_epoch: 0, privacy_class: 'SUBSCRIBER_PRIVATE' },
    entitlement: { status: 'ACTIVE', scope },
    relationship: null,
    consent_records: {},
    request_integrity: { allowed: true },
    expected_resource_version: 1,
    evaluated_at: at,
    correlation_id: 'correlation_policy',
    ...overrides,
  };
}

test('central policy is default-off and produces safe audit denial', () => {
  const store = new InMemorySecurityStateStore();
  const policy = createCoachConnectSecurityPolicy({ store });
  const decision = policy.decide(context());
  assert.equal(decision.allowed, false);
  assert.equal(decision.failure_code, 'AUTHORIZATION_DENIED');
  assert.equal(store.auditSnapshot().length, 1);
});

test('subscriber self read passes only for exact scope current session and entitlement', () => {
  const store = new InMemorySecurityStateStore();
  const policy = createCoachConnectSecurityPolicy({ store, flags: activeFlags });
  assert.equal(policy.decide(context()).allowed, true);
  assert.equal(policy.decide(context({ actor_scope: otherScope })).failure_code, 'TENANT_SCOPE_VIOLATION');
  assert.equal(policy.decide(context({ session: { ...context().session, subject_binding_hash: 'substituted' } })).failure_code, 'SESSION_FIXATION_DETECTED');
  assert.equal(policy.decide(context({ entitlement: { status: 'EXPIRED', scope } })).failure_code, 'ENTITLEMENT_INVALID');
});

test('coach action requires exact active relationship and use-time consent', () => {
  const store = new InMemorySecurityStateStore();
  const policy = createCoachConnectSecurityPolicy({ store, flags: activeFlags });
  const coach = { actor_id: 'coach_policy', role: 'COACH', subject_binding_hash: 'coach_subject_hash', security_version: 1 };
  const coachContext = context({
    actor: coach,
    session: { ...context().session, subject_binding_hash: coach.subject_binding_hash },
    action: SECURITY_ACTIONS.WRITE_COACH_REVIEW,
    relationship: { status: 'ACTIVE', scope, coach_actor_id: coach.actor_id },
    consent_records: { STRUCTURED_EXTRACTION: { state: 'GRANTED' } },
  });
  assert.equal(policy.decide(coachContext).allowed, true);
  assert.equal(policy.decide({ ...coachContext, relationship: { ...coachContext.relationship, status: 'REVOKED' } }).failure_code, 'RELATIONSHIP_INVALID');
  assert.equal(policy.decide({ ...coachContext, consent_records: { STRUCTURED_EXTRACTION: { state: 'REVOKED' } } }).failure_code, 'CONSENT_REVOKED');
});

test('subscriber cannot perform coach action and coach cannot promote canonically', () => {
  const store = new InMemorySecurityStateStore();
  const policy = createCoachConnectSecurityPolicy({ store, flags: activeFlags });
  assert.equal(policy.decide(context({ action: SECURITY_ACTIONS.WRITE_COACH_REVIEW, consent_records: { STRUCTURED_EXTRACTION: { state: 'GRANTED' } } })).failure_code, 'AUTHORIZATION_DENIED');
  const coach = { actor_id: 'coach_policy', role: 'COACH', subject_binding_hash: 'coach_subject_hash', security_version: 1 };
  assert.equal(policy.decide(context({
    actor: coach,
    session: { ...context().session, subject_binding_hash: coach.subject_binding_hash },
    action: SECURITY_ACTIONS.PROMOTE_CONFIRMED_PROPOSAL,
    consent_records: { BUSINESS_ENGINE_EVALUATION: { state: 'GRANTED' } },
  })).failure_code, 'AUTHORIZATION_DENIED');
});

test('mutation requires request integrity current version and current deletion epoch', () => {
  const store = new InMemorySecurityStateStore();
  const policy = createCoachConnectSecurityPolicy({ store, flags: activeFlags });
  const mutation = context({
    action: SECURITY_ACTIONS.CONFIRM_OWN_PROPOSAL,
    consent_records: { BUSINESS_ENGINE_EVALUATION: { state: 'GRANTED' } },
  });
  assert.equal(policy.decide(mutation).allowed, true);
  assert.equal(policy.decide({ ...mutation, request_integrity: { allowed: false, code: 'CSRF_VALIDATION_FAILED' } }).failure_code, 'CSRF_VALIDATION_FAILED');
  assert.equal(policy.decide({ ...mutation, expected_resource_version: 2 }).failure_code, 'REQUEST_REPLAY_DETECTED');
  store.advanceDeletionEpoch({ scope_hash: hashCanonicalJson(scope), epoch: 1, reason_code: 'RETENTION_EXPIRED', advanced_at: at, policy_version: 'coach-connect-retention-proposal-v1' });
  assert.equal(policy.decide(mutation).failure_code, 'DELETION_REQUIRED');
});

test('secured Live Session facade denies missing context and invokes domain method only after policy allowance', () => {
  let calls = 0;
  const policy = createCoachConnectSecurityPolicy({ store: new InMemorySecurityStateStore(), flags: activeFlags });
  const facade = createSecuredLiveSessionService({
    securityPolicy: policy,
    service: {
      createSession(input) { calls += 1; return { ok: true, input }; },
      inspect() { return { sensitive_snapshot: true }; },
    },
  });
  assert.equal(facade.createSession({ idempotency_key: 'missing_context' }).code, 'AUTHENTICATION_FAILED');
  assert.equal(calls, 0);
  const allowed = facade.createSession({ security_context: context({ action: SECURITY_ACTIONS.CREATE_SESSION }), idempotency_key: 'allowed' });
  assert.equal(allowed.ok, true);
  assert.equal(calls, 1);
  assert.equal(facade.inspectSecurityBoundary().base_service_route_exposure, false);
});
