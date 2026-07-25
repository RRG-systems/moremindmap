import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRatifiedOperatorAuthorityPolicy,
  createRatifiedSubscriberAuthorityPolicy,
  createSyntheticSharedSecurityBackend,
  createSyntheticTranscriptStoreCapability,
  DEFAULT_PRODUCTION_SECURITY_FLAGS,
  evaluateErasureArchitecture,
  evaluateProductionSecurityActivation,
  evaluateProductionSecurityImplementationVerdict,
  InMemorySharedSecurityState,
  LOCAL_JSONL_PRODUCTION_ERASURE_BOUNDARY,
  PRODUCTION_SECURITY_IMPLEMENTATION_VERDICTS,
  RATIFIED_ARCHITECTURE_DECISIONS,
  RATIFIED_DECISION_STATUS,
  retentionDecisionForDataClass,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js';

test('all production prerequisite functionality remains default-off and synthetic-only', () => {
  for (const capability of [
    'SUBJECT_BINDING',
    'SESSION_ELEVATION',
    'SHARED_STATE',
    'RETENTION',
    'DELETION_PLANNING',
    'ERASURE_PLANNING',
    'TRANSPORT_POLICY',
    'OPERATOR_AUTHORIZATION',
  ]) {
    const decision = evaluateProductionSecurityActivation({
      flags: DEFAULT_PRODUCTION_SECURITY_FLAGS,
      capability,
      store: new InMemorySharedSecurityState(),
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.production_authorized, false);
    assert.equal(decision.deployment_ready, false);
  }
  assert.equal(DEFAULT_PRODUCTION_SECURITY_FLAGS.transcript_persistence_enabled, false);
  assert.equal(DEFAULT_PRODUCTION_SECURITY_FLAGS.destructive_deletion_enabled, false);
  assert.equal(DEFAULT_PRODUCTION_SECURITY_FLAGS.live_auth_provider_enabled, false);
  assert.equal(DEFAULT_PRODUCTION_SECURITY_FLAGS.live_shared_state_enabled, false);
  assert.equal(DEFAULT_PRODUCTION_SECURITY_FLAGS.live_object_store_enabled, false);
  assert.equal(DEFAULT_PRODUCTION_SECURITY_FLAGS.stripe_enabled, false);
});

test('ratified provider choices remain policy contracts without live adapters or activation', () => {
  const subscriber = createRatifiedSubscriberAuthorityPolicy({
    issuer: 'https://subscriber.synthetic.example/',
    audience: 'coach-connect-subscriber',
  }).policy;
  const operator = createRatifiedOperatorAuthorityPolicy({
    issuer: 'https://operator.synthetic.example/',
    audience: 'coach-connect-operator',
  }).policy;
  const store = new InMemorySharedSecurityState({
    backend: createSyntheticSharedSecurityBackend(),
  });
  assert.equal(subscriber.live_provider_enabled, false);
  assert.equal(operator.live_provider_enabled, false);
  assert.equal(store.describeCapability().production_connection, false);
  assert.equal(evaluateErasureArchitecture({
    transcript_store_capability: createSyntheticTranscriptStoreCapability(),
  }).live_store_contacted, false);
});

test('retention and local journal truth preserve activation and physical-deletion boundaries', () => {
  assert.equal(retentionDecisionForDataClass({
    data_class: 'TRANSCRIPT_CONTENT',
    operation: 'PERSIST',
  }).allowed, false);
  assert.equal(LOCAL_JSONL_PRODUCTION_ERASURE_BOUNDARY.development_only, true);
  assert.equal(LOCAL_JSONL_PRODUCTION_ERASURE_BOUNDARY.truth, 'LOGICAL_DENIAL_ONLY');
  assert.equal(LOCAL_JSONL_PRODUCTION_ERASURE_BOUNDARY.physical_deletion_supported, false);
});

test('Sprint 7 verdict is the ratification-authorized implementation verdict with activation gates', () => {
  const sprintResults = Array.from({ length: 7 }, (_, index) => ({
    sprint: index + 1,
    status: 'PASS',
  }));
  const result = evaluateProductionSecurityImplementationVerdict({
    decision_status: RATIFIED_DECISION_STATUS,
    decisions: RATIFIED_ARCHITECTURE_DECISIONS,
    sprint_results: sprintResults,
  });
  assert.equal(result.verdict, PRODUCTION_SECURITY_IMPLEMENTATION_VERDICTS.implemented);
  assert.equal(result.activation_gates_preserved, true);
  assert.equal(result.deployment_ready, false);
  assert.equal(result.production_certified, false);
  assert.equal(result.production_authorized, false);
  assert.equal(evaluateProductionSecurityImplementationVerdict({
    decision_status: 'DEFERRED',
    sprint_results: sprintResults,
  }).verdict, PRODUCTION_SECURITY_IMPLEMENTATION_VERDICTS.blocked);
  assert.equal(evaluateProductionSecurityImplementationVerdict({
    sprint_results: sprintResults,
    boundary_violation: true,
  }).verdict, PRODUCTION_SECURITY_IMPLEMENTATION_VERDICTS.failed);
});
