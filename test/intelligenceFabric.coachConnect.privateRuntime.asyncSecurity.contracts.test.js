import test from 'node:test';
import assert from 'node:assert/strict';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';
import {
  ASYNC_SECURITY_COMMAND_VERSION,
  ASYNC_SECURITY_QUERY_VERSION,
  SyntheticAsyncSecurityStateAdapter,
  createSyntheticAsyncSecurityBackend,
  deploymentAsyncSecurityCapabilityDecision,
  invokeAsyncSecurityMethod,
  validateAsyncSecurityCommand,
  validateAsyncSecurityQuery,
  validateAsyncSecurityStatePort,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js';
import { InMemorySharedSecurityState } from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/inMemorySharedSecurityState.js';

const now = Date.parse('2026-07-27T20:00:00.000Z');
const environmentId = 'synthetic_async_environment';
const externalSubjectRef = 'external_subject_synthetic_alpha';
const subscriberSubjectRef = 'canonical_subject_synthetic_alpha';
const scopeHash = 'a'.repeat(64);

function command(commandType, argumentsValue = {}, suffix = commandType) {
  return {
    command_version: ASYNC_SECURITY_COMMAND_VERSION,
    command_type: commandType,
    environment_id: environmentId,
    idempotency_key_hash: hashCanonicalJson({ domain: 'idempotency', suffix }),
    fingerprint: hashCanonicalJson({ domain: 'fingerprint', commandType, argumentsValue }),
    correlation_ref: `correlation_${suffix.toLowerCase()}`,
    expected_versions: {},
    arguments: argumentsValue,
  };
}

function query(queryType, overrides = {}) {
  return {
    query_version: ASYNC_SECURITY_QUERY_VERSION,
    query_type: queryType,
    environment_id: environmentId,
    correlation_ref: `correlation_${queryType.toLowerCase()}`,
    subject_ref: null,
    session_token_hash: null,
    entitlement_token_hash: null,
    exact_scope_hash: null,
    requested_runtime: null,
    requested_action: null,
    required_consistency: 'PRIMARY_OR_LINEARIZABLE',
    ...overrides,
  };
}

function adapterWithBackend(snapshot = null) {
  const backend = createSyntheticAsyncSecurityBackend(snapshot, { clock: () => now });
  return {
    backend,
    adapter: new SyntheticAsyncSecurityStateAdapter({
      backend,
      environment_id: environmentId,
      clock: () => now,
    }),
  };
}

test('all five V2 methods return Promises and settle to exact V2 results', async () => {
  const { adapter } = adapterWithBackend();
  const calls = [
    ['describeCapability', []],
    ['health', []],
    ['serverTime', []],
    ['queryAuthoritative', [query('GET_SECURITY_EPOCH', { exact_scope_hash: scopeHash })]],
    ['executeAtomic', [command('CLAIM_REPLAY', {
      replay_key_hash: 'b'.repeat(64),
      expires_at: '2026-07-27T20:15:00.000Z',
    })]],
  ];
  for (const [method, args] of calls) {
    const returned = adapter[method](...args);
    assert.equal(returned instanceof Promise, true, method);
    await returned;
  }
  const validation = await validateAsyncSecurityStatePort(adapter);
  assert.equal(validation.valid, true);
  assert.equal(validation.description.contract_version, 'shared-security-state-async-v2');
});

test('synchronous returns and V1 stores cannot satisfy the V2 port', async () => {
  const synchronous = {
    describeCapability: () => ({}),
    health: () => ({}),
    serverTime: () => ({}),
    queryAuthoritative: () => ({}),
    executeAtomic: () => ({}),
  };
  assert.equal((await validateAsyncSecurityStatePort(synchronous)).valid, false);
  assert.throws(
    () => invokeAsyncSecurityMethod(synchronous, 'health'),
    /returned synchronously/,
  );
  assert.equal((await validateAsyncSecurityStatePort(new InMemorySharedSecurityState())).valid, false);
});

test('query and command schemas use closed versions, fields, and type allowlists', () => {
  assert.equal(validateAsyncSecurityQuery(query('GET_SECURITY_EPOCH', { exact_scope_hash: scopeHash })).valid, true);
  assert.equal(validateAsyncSecurityCommand(command('ADVANCE_SECURITY_EPOCH', {
    exact_scope_hash: scopeHash,
    expected_epoch: 0,
  })).valid, true);
  assert.equal(validateAsyncSecurityQuery({ ...query('GET_SECURITY_EPOCH'), query_version: 'v1' }).valid, false);
  assert.equal(validateAsyncSecurityQuery({ ...query('GET_SECURITY_EPOCH'), extra: true }).valid, false);
  assert.equal(validateAsyncSecurityQuery({ ...query('GET_SECURITY_EPOCH'), query_type: 'UNKNOWN' }).valid, false);
  assert.equal(validateAsyncSecurityCommand({ ...command('CLAIM_REPLAY'), command_type: 'UNKNOWN' }).valid, false);
  assert.equal(validateAsyncSecurityCommand({
    ...command('CLAIM_REPLAY'),
    arguments: { raw_token: 'forbidden' },
  }).valid, false);
});

test('synthetic capability is provider neutral and rejected as Preview or Production authority', async () => {
  const { adapter } = adapterWithBackend();
  const description = await adapter.describeCapability();
  assert.equal(description.deployment_grade, false);
  assert.equal(description.live_connection_verified, false);
  assert.equal(description.provider_class, 'SYNTHETIC');
  assert.equal(description.no_local_fallback, true);
  assert.equal(deploymentAsyncSecurityCapabilityDecision(description, environmentId).allowed, false);
});

test('atomic canonical binding is one-to-one and authoritative queries do not enroll', async () => {
  const { adapter } = adapterWithBackend();
  const mapping = {
    external_subject_ref: externalSubjectRef,
    subscriber_subject_ref: subscriberSubjectRef,
    exact_scope_hash: scopeHash,
    security_version: 1,
    subscriber_confirmed: true,
    auto_enrolled: false,
  };
  const [first, competing] = await Promise.all([
    adapter.executeAtomic(command('BIND_APPROVED_CANONICAL_SUBJECT', { subject_mapping: mapping }, 'bind_first')),
    adapter.executeAtomic(command('BIND_APPROVED_CANONICAL_SUBJECT', {
      subject_mapping: {
        ...mapping,
        external_subject_ref: 'external_subject_synthetic_other',
        subscriber_subject_ref: 'canonical_subject_synthetic_other',
      },
    }, 'bind_competing')),
  ]);
  assert.equal([first.ok, competing.ok].filter(Boolean).length, 1);
  const resolved = await adapter.queryAuthoritative(query('RESOLVE_CANONICAL_SUBJECT', {
    subject_ref: externalSubjectRef,
  }));
  assert.equal(resolved.ok, true);
  assert.equal(resolved.record.subscriber_subject_ref, subscriberSubjectRef);
  const unknown = await adapter.queryAuthoritative(query('RESOLVE_CANONICAL_SUBJECT', {
    subject_ref: 'external_subject_unknown',
  }));
  assert.equal(unknown.ok, false);
  assert.equal(unknown.failure_code, 'SUBJECT_MAPPING_NOT_FOUND');
  assert.equal((await adapter.queryAuthoritative(query('RESOLVE_CANONICAL_SUBJECT', {
    subject_ref: 'external_subject_unknown',
  }))).failure_code, 'SUBJECT_MAPPING_NOT_FOUND');
});

test('serialized CSRF consumption and entitlement issue yield one winner', async () => {
  const sessionRef = 'authenticated_session_synthetic_alpha';
  const sessionTokenHash = 'c'.repeat(64);
  const csrfProofHash = 'd'.repeat(64);
  const approvalKey = `${subscriberSubjectRef}|${scopeHash}`;
  const session = {
    record_version: 'authenticated-private-session-v2',
    authenticated_session_ref: sessionRef,
    session_token_hash: sessionTokenHash,
    subscriber_subject_ref: subscriberSubjectRef,
    exact_scope_hash: scopeHash,
    browser_binding_hash: 'browser_binding_synthetic_alpha',
    subject_security_version: 1,
    session_epoch: 1,
    security_epoch: 1,
    status: 'ACTIVE',
    issued_at: '2026-07-27T19:59:00.000Z',
    expires_at: '2026-07-27T20:30:00.000Z',
  };
  const approval = {
    record_version: 'private-test-approval-v1',
    approval_ref: 'approval_synthetic_alpha',
    environment_id: environmentId,
    subscriber_subject_ref: subscriberSubjectRef,
    exact_scope_hash: scopeHash,
    purpose: 'TEMPORARY_PRIVATE_SUBSCRIPTION_TEST',
    status: 'ACTIVE',
    issued_at: '2026-07-27T19:00:00.000Z',
    expires_at: '2026-07-27T21:00:00.000Z',
    security_epoch: 1,
  };
  const csrf = {
    record_version: 'csrf-grant-v2',
    csrf_grant_ref: 'csrf_grant_synthetic_alpha',
    csrf_proof_hash: csrfProofHash,
    authenticated_session_ref: sessionRef,
    browser_binding_hash: session.browser_binding_hash,
    method: 'POST',
    route: 'developer_access',
    status: 'ACTIVE',
    issued_at: '2026-07-27T19:59:00.000Z',
    expires_at: '2026-07-27T20:05:00.000Z',
  };
  const { adapter } = adapterWithBackend({
    canonical_by_external: [[externalSubjectRef, {
      external_subject_ref: externalSubjectRef,
      subscriber_subject_ref: subscriberSubjectRef,
      exact_scope_hash: scopeHash,
      status: 'ACTIVE',
      mapping_version: 1,
      security_version: 1,
    }]],
    canonical_by_scope: [[scopeHash, {
      external_subject_ref: externalSubjectRef,
      subscriber_subject_ref: subscriberSubjectRef,
      exact_scope_hash: scopeHash,
      status: 'ACTIVE',
    }]],
    sessions_by_token: [[sessionTokenHash, session]],
    sessions_by_ref: [[sessionRef, session]],
    approvals: [[approvalKey, approval]],
    csrf_grants: [[csrfProofHash, csrf]],
    security_epochs: [[scopeHash, 1]],
  });
  const entitlementBase = {
    record_version: 'temporary-private-entitlement-v2',
    entitlement_ref: 'entitlement_synthetic_alpha',
    entitlement_token_hash: 'e'.repeat(64),
    environment_id: environmentId,
    subscriber_subject_ref: subscriberSubjectRef,
    authenticated_session_ref: sessionRef,
    browser_binding_hash: session.browser_binding_hash,
    exact_scope_hash: scopeHash,
    subject_security_version: 1,
    session_epoch: 1,
    security_epoch: 1,
    source: 'temporary_internal_subscription_entitlement',
    access_type: 'more_monthly_intelligence',
    status: 'ACTIVE',
    issued_at: '2026-07-27T20:00:00.000Z',
    expires_at: '2026-07-27T20:15:00.000Z',
    temporary: true,
    paid_entitlement: false,
    billing_evidence: false,
    stripe_subscription_created: false,
    admin_authority: false,
    operator_authority: false,
    deployment_authority: false,
    billing_authority: false,
    coach_authority: false,
    canonical_mutation_authority: false,
  };
  const argumentsValue = {
    csrf_proof_hash: csrfProofHash,
    authenticated_session_ref: sessionRef,
    subscriber_subject_ref: subscriberSubjectRef,
    exact_scope_hash: scopeHash,
    method: 'POST',
    route: 'developer_access',
    code_verified: true,
    entitlement: entitlementBase,
  };
  const [one, two] = await Promise.all([
    adapter.executeAtomic(command('CONSUME_CSRF_AND_ISSUE_TEMPORARY_ENTITLEMENT', argumentsValue, 'issue_one')),
    adapter.executeAtomic(command('CONSUME_CSRF_AND_ISSUE_TEMPORARY_ENTITLEMENT', {
      ...argumentsValue,
      entitlement: {
        ...entitlementBase,
        entitlement_ref: 'entitlement_synthetic_beta',
        entitlement_token_hash: 'f'.repeat(64),
      },
    }, 'issue_two')),
  ]);
  assert.equal([one.ok, two.ok].filter(Boolean).length, 1);
  assert.equal(adapter.snapshot().entitlements_by_token.length, 1);
});

test('conflicting replay fingerprints, audit failure, and non-healthy states fail closed', async () => {
  const { adapter } = adapterWithBackend();
  const replayKey = '9'.repeat(64);
  const first = await adapter.executeAtomic(command('CLAIM_REPLAY', {
    replay_key_hash: replayKey,
    expires_at: '2026-07-27T20:15:00.000Z',
  }, 'replay_first'));
  assert.equal(first.ok, true);
  const conflict = await adapter.executeAtomic({
    ...command('CLAIM_REPLAY', {
      replay_key_hash: replayKey,
      expires_at: '2026-07-27T20:15:00.000Z',
    }, 'replay_conflict'),
    fingerprint: '7'.repeat(64),
  });
  assert.equal(conflict.ok, false);
  adapter.setAuditFailure(true);
  const before = adapter.snapshot().canonical_by_external.length;
  const denied = await adapter.executeAtomic(command('BIND_APPROVED_CANONICAL_SUBJECT', {
    subject_mapping: {
      external_subject_ref: externalSubjectRef,
      subscriber_subject_ref: subscriberSubjectRef,
      exact_scope_hash: scopeHash,
      subscriber_confirmed: true,
      auto_enrolled: false,
    },
  }, 'audit_failure'));
  assert.equal(denied.failure_code, 'AUDIT_APPEND_FAILED');
  assert.equal(adapter.snapshot().canonical_by_external.length, before);
  adapter.setAuditFailure(false);
  for (const state of ['DEGRADED', 'UNAVAILABLE', 'PARTITIONED', 'RECOVERING']) {
    adapter.setAvailability(state);
    const result = await adapter.queryAuthoritative(query('GET_SECURITY_EPOCH', {
      exact_scope_hash: scopeHash,
    }));
    assert.equal(result.ok, false, state);
  }
});
