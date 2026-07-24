import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  claimRequestReplay,
  completeRequestReplay,
  consumeCsrfGrant,
  createCoachConnectSecurityPolicy,
  createRetentionPlan,
  evaluateAbuseControls,
  evaluateRecordDeletionEpoch,
  InMemorySecurityStateStore,
  issueCsrfGrant,
  redactSecurityValue,
  safeSecurityClientError,
  SECURITY_ACTIONS,
} from '../src/lib/intelligenceFabric/coachConnect/security/index.js';
import {
  createDeveloperBinding,
  evaluateDeveloperAccess,
  verifyDeveloperCapability,
} from '../api/internal/developer-access-security.js';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';

const scope = { tenant_id: 'tenant_adversarial', profile_id: 'profile_adversarial', business_id: 'business_adversarial', subscriber_id: 'subscriber_adversarial' };
const otherScope = { ...scope, tenant_id: 'tenant_other', subscriber_id: 'subscriber_other' };
const activeFlags = { security_hardening_enabled: true, synthetic_only: true, production_traffic_enabled: false, shared_security_state_required: false, retention_policy_approved: false, deletion_execution_enabled: false, emergency_disabled: false };
const at = '2026-07-24T00:10:00.000Z';

function subscriberContext(overrides = {}) {
  const actor = overrides.actor || { actor_id: scope.subscriber_id, role: 'SUBSCRIBER', subject_binding_hash: 'subscriber_subject', security_version: 1 };
  return {
    actor,
    session: overrides.session || { session_id: 'session_adversarial', subject_binding_hash: actor.subject_binding_hash, browser_binding_hash: 'browser_adversarial', status: 'ACTIVE', issued_at: '2026-07-24T00:00:00.000Z', expires_at: '2026-07-24T01:00:00.000Z', security_version: 1 },
    action: SECURITY_ACTIONS.READ_OWN_PROJECTION,
    actor_scope: scope,
    resource: { resource_type: 'projection', resource_id: 'projection_adversarial', scope, version: 1, deletion_epoch: 0, privacy_class: 'SUBSCRIBER_PRIVATE', owner_actor_id: scope.subscriber_id, owner_session_id: 'session_adversarial' },
    entitlement: { status: 'ACTIVE', scope },
    relationship: null,
    consent_records: {},
    request_integrity: { allowed: true },
    expected_resource_version: 1,
    evaluated_at: at,
    correlation_id: 'correlation_adversarial',
    ...overrides,
  };
}

function coachContext(action, overrides = {}) {
  const actor = { actor_id: 'coach_adversarial', role: 'COACH', subject_binding_hash: 'coach_subject', security_version: 1 };
  return subscriberContext({
    actor,
    session: { ...subscriberContext().session, subject_binding_hash: actor.subject_binding_hash },
    action,
    resource: { ...subscriberContext().resource, owner_actor_id: scope.subscriber_id },
    relationship: { status: 'ACTIVE', scope, coach_actor_id: actor.actor_id },
    ...overrides,
  });
}

const developerEnv = {
  NODE_ENV: 'test',
  COACH_CONNECT_DEVELOPER_ACCESS_ENABLED: 'true',
  COACH_CONNECT_SECURITY_HARDENING_ENABLED: 'true',
  COACH_CONNECT_SECURITY_SYNTHETIC_ONLY: 'true',
  COACH_CONNECT_SECURITY_EMERGENCY_DISABLED: 'false',
  COACH_CONNECT_SECURITY_PRODUCTION_TRAFFIC_ENABLED: 'false',
  COACH_CONNECT_DEVELOPER_ACCESS_CODE: ['ADV', 'ERS', 'ARIAL'].join(''),
  COACH_CONNECT_DEVELOPER_ACCESS_TOKEN_PEPPER: 'adversarial-synthetic-pepper-thirty-two-bytes',
  COACH_CONNECT_DEVELOPER_ACCESS_ALLOWED_ENVIRONMENTS: 'test',
  COACH_CONNECT_DEVELOPER_ACCESS_ALLOWED_ORIGINS: 'http://localhost:5173',
  COACH_CONNECT_DEVELOPER_ACCESS_ISSUER: 'adversarial-issuer',
  COACH_CONNECT_DEVELOPER_ACCESS_AUDIENCE: 'adversarial-audience',
  COACH_CONNECT_DEVELOPER_ACCESS_ENVIRONMENT_ID: 'adversarial-environment',
  COACH_CONNECT_DEVELOPER_ACCESS_KEY_ID: 'adversarial-key-v1',
};
const bindingInput = { subject_id: 'subject_adversarial', scope, browser_id: 'browser_adversarial', security_version: 1 };

function issueCapability() {
  const store = new InMemorySecurityStateStore();
  const binding = createDeveloperBinding(bindingInput, developerEnv);
  const issued = evaluateDeveloperAccess({
    req: { headers: { origin: 'http://localhost:5173' } },
    submittedCode: developerEnv.COACH_CONNECT_DEVELOPER_ACCESS_CODE,
    env: developerEnv,
    now: 1000,
    store,
    subject_binding: binding,
    origin_decision: { allowed: true },
    csrf_decision: { allowed: true },
    random_token: () => 'adversarial-opaque-capability-at-least-thirty-two-characters',
  });
  return { store, binding, issued };
}

test('scenario 01 guessed session ID denies object ownership', () => {
  const policy = createCoachConnectSecurityPolicy({ store: new InMemorySecurityStateStore(), flags: activeFlags });
  const decision = policy.decide(subscriberContext({ resource: { ...subscriberContext().resource, owner_session_id: 'session_guessed' } }));
  assert.equal(decision.failure_code, 'AUTHORIZATION_DENIED');
});

test('scenario 02 coach cannot access another subscriber', () => {
  const policy = createCoachConnectSecurityPolicy({ store: new InMemorySecurityStateStore(), flags: activeFlags });
  const decision = policy.decide(coachContext(SECURITY_ACTIONS.READ_COACH_PROJECTION, {
    resource: { ...subscriberContext().resource, scope: otherScope },
    consent_records: { COACH_SHARING: { state: 'GRANTED' } },
  }));
  assert.equal(decision.failure_code, 'TENANT_SCOPE_VIOLATION');
});

test('scenario 03 subscriber cannot perform coach action', () => {
  const policy = createCoachConnectSecurityPolicy({ store: new InMemorySecurityStateStore(), flags: activeFlags });
  assert.equal(policy.decide(subscriberContext({ action: SECURITY_ACTIONS.WRITE_COACH_REVIEW, consent_records: { STRUCTURED_EXTRACTION: { state: 'GRANTED' } } })).failure_code, 'AUTHORIZATION_DENIED');
});

test('scenario 04 coach cannot perform canonical promotion', () => {
  const policy = createCoachConnectSecurityPolicy({ store: new InMemorySecurityStateStore(), flags: activeFlags });
  assert.equal(policy.decide(coachContext(SECURITY_ACTIONS.PROMOTE_CONFIRMED_PROPOSAL, { consent_records: { BUSINESS_ENGINE_EVALUATION: { state: 'GRANTED' } } })).failure_code, 'AUTHORIZATION_DENIED');
});

test('scenario 05 copied developer capability fails different binding', () => {
  const { store, issued } = issueCapability();
  const copied = createDeveloperBinding({ ...bindingInput, browser_id: 'copied_browser' }, developerEnv);
  assert.equal(verifyDeveloperCapability({ token: issued.capability, env: developerEnv, now: 2000, store, subject_binding: copied }).code, 'CAPABILITY_INVALID');
});

test('scenario 06 expired capability replay fails', () => {
  const { store, binding, issued } = issueCapability();
  assert.equal(verifyDeveloperCapability({ token: issued.capability, env: developerEnv, now: 902_000, store, subject_binding: binding }).code, 'CAPABILITY_EXPIRED');
});

test('scenario 07 capability is denied in production', () => {
  const { store, binding, issued } = issueCapability();
  assert.equal(verifyDeveloperCapability({ token: issued.capability, env: { ...developerEnv, NODE_ENV: 'production' }, now: 2000, store, subject_binding: binding }).code, 'CAPABILITY_ENVIRONMENT_DENIED');
});

test('scenario 08 CSRF proof cannot cross browser or replay', () => {
  const store = new InMemorySecurityStateStore();
  const issued = issueCsrfGrant({ store, proof: 'adversarial-csrf-proof-at-least-twenty-four', browser_binding_hash: 'browser', method: 'POST', route: '/confirm', environment_id: 'test', now: 1000 });
  assert.equal(consumeCsrfGrant({ store, proof: issued.proof, browser_binding_hash: 'attacker', method: 'POST', route: '/confirm', environment_id: 'test', now: 2000 }).code, 'CSRF_VALIDATION_FAILED');
  assert.equal(consumeCsrfGrant({ store, proof: issued.proof, browser_binding_hash: 'browser', method: 'POST', route: '/confirm', environment_id: 'test', now: 2000 }).allowed, true);
  assert.equal(consumeCsrfGrant({ store, proof: issued.proof, browser_binding_hash: 'browser', method: 'POST', route: '/confirm', environment_id: 'test', now: 2001 }).code, 'CSRF_VALIDATION_FAILED');
});

test('scenario 09 stale relationship denies coach access', () => {
  const policy = createCoachConnectSecurityPolicy({ store: new InMemorySecurityStateStore(), flags: activeFlags });
  const decision = policy.decide(coachContext(SECURITY_ACTIONS.WRITE_COACH_REVIEW, { relationship: { status: 'REVOKED', scope, coach_actor_id: 'coach_adversarial' }, consent_records: { STRUCTURED_EXTRACTION: { state: 'GRANTED' } } }));
  assert.equal(decision.failure_code, 'RELATIONSHIP_INVALID');
});

test('scenario 10 revoked consent survives replay decision', () => {
  const actor = { actor_id: 'recovery_operator', role: 'RECOVERY_OPERATOR', subject_binding_hash: 'recovery_subject', security_version: 1 };
  const policy = createCoachConnectSecurityPolicy({ store: new InMemorySecurityStateStore(), flags: activeFlags });
  const decision = policy.decide(subscriberContext({
    actor,
    session: { ...subscriberContext().session, subject_binding_hash: actor.subject_binding_hash },
    action: SECURITY_ACTIONS.RECOVER_SESSION,
    consent_records: { PARTICIPATION: { state: 'REVOKED' } },
  }));
  assert.equal(decision.failure_code, 'CONSENT_REVOKED');
});

test('scenario 11 sequence or request fingerprint replay conflict denies', () => {
  const store = new InMemorySecurityStateStore();
  const first = claimRequestReplay({ store, scope, action: 'INGEST', idempotency_key: 'event_1', nonce: 'nonce_1', request_fingerprint: { sequence: 1 }, now: 1000 });
  assert.equal(first.status, 'CLAIMED');
  assert.equal(claimRequestReplay({ store, scope, action: 'INGEST', idempotency_key: 'event_1', nonce: 'nonce_1', request_fingerprint: { sequence: 2 }, now: 1001 }).code, 'REQUEST_REPLAY_DETECTED');
});

test('scenario 12 confirmation retry is idempotent and conflict denies', () => {
  const store = new InMemorySecurityStateStore();
  const input = { store, scope, action: 'CONFIRM', idempotency_key: 'confirmation_1', nonce: 'confirmation_nonce', request_fingerprint: { response: 'ACCEPT' }, now: 1000 };
  const first = claimRequestReplay(input);
  completeRequestReplay({ store, key: first.key, fingerprint: first.fingerprint, result_reference: 'confirmation_receipt', now: 1001 });
  assert.equal(claimRequestReplay({ ...input, now: 1002 }).status, 'IDEMPOTENT_REPLAY');
  assert.equal(claimRequestReplay({ ...input, request_fingerprint: { response: 'REJECT' }, now: 1003 }).code, 'REQUEST_REPLAY_DETECTED');
});

test('scenario 13 projection cache cannot cross tenant scope', () => {
  const policy = createCoachConnectSecurityPolicy({ store: new InMemorySecurityStateStore(), flags: activeFlags });
  assert.equal(policy.decide(subscriberContext({ resource: { ...subscriberContext().resource, scope: otherScope } })).failure_code, 'TENANT_SCOPE_VIOLATION');
});

test('scenario 14 transcript canary is removed from logs', () => {
  const canary = ['private', 'transcript', 'canary'].join('-');
  const safe = redactSecurityValue({ raw_transcript: canary, nested: { message: canary } }, { sensitive_values: [canary] });
  assert.doesNotMatch(JSON.stringify(safe), new RegExp(canary));
});

test('scenario 15 client source contains no server access-code value', () => {
  const client = fs.readFileSync(new URL('../src/components/businessAssessment/DeveloperAccessPanel.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(client, new RegExp(developerEnv.COACH_CONNECT_DEVELOPER_ACCESS_CODE));
  assert.doesNotMatch(client, /COACH_CONNECT_DEVELOPER_ACCESS_TOKEN_PEPPER/);
});

test('scenario 16 artifact lookup cannot cross tenant scope', () => {
  const policy = createCoachConnectSecurityPolicy({ store: new InMemorySecurityStateStore(), flags: activeFlags });
  const decision = policy.decide(subscriberContext({ resource: { ...subscriberContext().resource, resource_type: 'artifact', resource_id: 'artifact_other', scope: otherScope } }));
  assert.equal(decision.failure_code, 'TENANT_SCOPE_VIOLATION');
});

test('scenario 17 brute-force unlock is throttled', () => {
  const store = new InMemorySecurityStateStore();
  const dimensions = { subject: 'subject', browser: 'browser' };
  for (let index = 0; index < 5; index += 1) assert.equal(evaluateAbuseControls({ store, dimensions, now: 1000 }).allowed, true);
  assert.equal(evaluateAbuseControls({ store, dimensions, now: 1000 }).code, 'RATE_LIMITED');
});

test('scenario 18 session fixation mismatch denies', () => {
  const policy = createCoachConnectSecurityPolicy({ store: new InMemorySecurityStateStore(), flags: activeFlags });
  assert.equal(policy.decide(subscriberContext({ session: { ...subscriberContext().session, subject_binding_hash: 'fixed_attacker_subject' } })).failure_code, 'SESSION_FIXATION_DETECTED');
});

test('scenario 19 replay after deletion epoch is denied', () => {
  const store = new InMemorySecurityStateStore();
  store.advanceDeletionEpoch({ scope_hash: hashCanonicalJson(scope), epoch: 1, reason_code: 'RETENTION_EXPIRED', advanced_at: at, policy_version: 'coach-connect-retention-proposal-v1' });
  assert.equal(evaluateRecordDeletionEpoch({ store, scope, record_epoch: 0 }).code, 'DELETION_REQUIRED');
  const plan = createRetentionPlan({ record_type: 'live_session_event', scope, reference_time: '2026-01-01T00:00:00.000Z', evaluated_at: at });
  assert.equal(plan.plan.physical_deletion_supported, false);
});

test('scenario 20 sensitive error is generic and contains no secret detail', () => {
  const canary = ['sensitive', 'error', 'canary'].join('-');
  const response = safeSecurityClientError('CAPABILITY_INVALID');
  assert.deepEqual(response.body, { ok: false, error: 'request_denied' });
  assert.doesNotMatch(JSON.stringify(response), new RegExp(canary));
});
