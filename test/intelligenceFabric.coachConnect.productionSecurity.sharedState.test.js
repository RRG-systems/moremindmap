import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPreAuthSession,
  createSyntheticSharedSecurityBackend,
  evaluateDeploymentSharedStateCapability,
  InMemorySharedSecurityState,
  productionSharedStateDecision,
  RATIFIED_UPSTASH_CAPABILITY_REQUIREMENTS,
  validateSharedSecurityStatePort,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js';

let now = 1_000;
const backend = () => createSyntheticSharedSecurityBackend(null, { clock: () => now });

test('synthetic adapter satisfies the port but cannot claim deployment grade', () => {
  const store = new InMemorySharedSecurityState({ backend: backend() });
  assert.equal(validateSharedSecurityStatePort(store).valid, true);
  assert.equal(store.describeCapability().adapter_class, 'SYNTHETIC_LOCAL');
  assert.equal(store.describeCapability().deployment_grade, false);
  assert.equal(store.describeCapability().production_connection, false);
  assert.equal(productionSharedStateDecision(store).allowed, false);
  assert.equal(RATIFIED_UPSTASH_CAPABILITY_REQUIREMENTS.live_connection_authorized, false);
});

test('two instances share nonce replay rate revocation epochs and leases', () => {
  now = 1_000;
  const shared = backend();
  const first = new InMemorySharedSecurityState({ backend: shared, environment_id: 'instance-a' });
  const second = new InMemorySharedSecurityState({ backend: shared, environment_id: 'instance-b' });
  assert.equal(first.consumeNonce({ namespace: 'csrf', nonce_hash: 'nonce-1', ttl_ms: 100 }).ok, true);
  assert.equal(second.consumeNonce({ namespace: 'csrf', nonce_hash: 'nonce-1', ttl_ms: 100 }).code, 'PRE_AUTH_CSRF_REPLAYED');
  assert.equal(first.claimReplay({ key: 'request-1', fingerprint: 'fingerprint-a', ttl_ms: 100 }).status, 'CLAIMED');
  assert.equal(second.claimReplay({ key: 'request-1', fingerprint: 'fingerprint-b', ttl_ms: 100 }).code, 'PRE_AUTH_SESSION_REPLAYED');
  assert.equal(first.completeReplay({ key: 'request-1', fingerprint: 'fingerprint-a', result_reference: 'receipt-1' }).ok, true);
  assert.equal(second.claimReplay({ key: 'request-1', fingerprint: 'fingerprint-a', ttl_ms: 100 }).status, 'IDEMPOTENT_REPLAY');
  assert.equal(first.rateLimit({ key: 'rate-1', window_ms: 100, limit: 1 }).ok, true);
  assert.equal(second.rateLimit({ key: 'rate-1', window_ms: 100, limit: 1 }).code, 'RATE_LIMITED');
  assert.equal(first.advanceSecurityEpoch({ scope_hash: 'scope-1', expected_epoch: 0, reason_code: 'RECOVERY' }).epoch, 1);
  assert.equal(second.getSecurityEpoch('scope-1').epoch, 1);
  assert.equal(first.advanceDeletionEpoch({ scope_hash: 'scope-1', expected_epoch: 0, reason_code: 'DELETE' }).epoch, 1);
  assert.equal(second.getDeletionEpoch('scope-1').epoch, 1);
  const lease = first.acquireRetentionLease({ lease_key: 'lease-1', owner_ref: 'worker-a', ttl_ms: 100 });
  assert.equal(lease.ok, true);
  assert.equal(second.acquireRetentionLease({ lease_key: 'lease-1', owner_ref: 'worker-b', ttl_ms: 100 }).status, 'LEASE_HELD');
  assert.equal(second.renewRetentionLease({
    lease_key: 'lease-1',
    owner_ref: 'worker-b',
    fencing_token: lease.lease.fencing_token,
    ttl_ms: 100,
  }).status, 'STALE_FENCE');
});

test('read-after-eviction preserves authoritative authorization state', () => {
  now = 2_000;
  const store = new InMemorySharedSecurityState({ backend: backend() });
  const session = createPreAuthSession({
    pre_auth_session_id: 'pre-auth-eviction',
    browser_binding_hash: 'browser-eviction',
    csrf_generation: 1,
    issued_at: new Date(now).toISOString(),
    expires_at: new Date(now + 1_000).toISOString(),
  }).session;
  store.atomicCreateSession({ session });
  store.putCapabilityHash({ token_hash: 'capability-eviction', status: 'ACTIVE' });
  assert.equal(store.getSession(session.pre_auth_session_id).status, 'FOUND');
  const evicted = store.evictNonAuthoritativeReadCache();
  assert.equal(evicted.authorization_state_preserved, true);
  assert.equal(store.getSession(session.pre_auth_session_id).status, 'FOUND');
  assert.equal(store.getCapabilityByHash('capability-eviction').status, 'FOUND');
});

test('outage partition clock uncertainty and TTL boundaries fail closed', () => {
  now = 3_000;
  const store = new InMemorySharedSecurityState({ backend: backend() });
  assert.equal(store.consumeNonce({ namespace: 'ttl', nonce_hash: 'nonce', ttl_ms: 50 }).ok, true);
  now = 3_051;
  assert.equal(store.consumeNonce({ namespace: 'ttl', nonce_hash: 'nonce', ttl_ms: 50 }).ok, true);
  store.setAvailability('PARTITIONED');
  assert.equal(store.getSession('anything').code, 'SHARED_SECURITY_STATE_PARTITIONED');
  assert.equal(store.rateLimit({ key: 'rate', window_ms: 100, limit: 1 }).code, 'SHARED_SECURITY_STATE_PARTITIONED');
  store.setAvailability('RECOVERING');
  assert.equal(store.consumeNonce({ namespace: 'ttl', nonce_hash: 'new', ttl_ms: 50 }).code, 'SHARED_SECURITY_STATE_UNAVAILABLE');
});

test('deployment capability requires every ratified Upstash refinement proof', () => {
  const candidate = {
    contract_version: 'shared-security-state-v1',
    adapter_class: 'DEPLOYMENT_APPROVED',
    deployment_grade: true,
    provider: 'UPSTASH_REDIS',
    authoritative_reads_from_primary_only: true,
    durable_persistence_verified: true,
    atomicity_verified: true,
    server_time_ttl_verified: true,
    backup_capability_verified: true,
    regional_behavior_verified: true,
    outage_fail_closed_verified: true,
    read_after_eviction_verified: true,
    no_local_fallback: true,
  };
  assert.equal(evaluateDeploymentSharedStateCapability(candidate).approved, true);
  assert.deepEqual(evaluateDeploymentSharedStateCapability({
    ...candidate,
    read_after_eviction_verified: false,
  }).failures, ['READ_AFTER_EVICTION']);
});
