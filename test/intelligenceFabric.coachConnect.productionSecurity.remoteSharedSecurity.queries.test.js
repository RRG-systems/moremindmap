import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASYNC_SECURITY_QUERY_TYPES,
  ASYNC_SECURITY_QUERY_VERSION,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/asyncSecurityContracts.js';
import {
  buildRemoteAuthoritativeQueryInvocation,
  parseRemoteAuthoritativeQueryReply,
  remoteAuthoritativeQueryRetryDecision,
  remoteSharedSecurityQueryScriptManifest,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/authoritativeQueries.js';
import {
  createQualificationDigestFunction,
  createRemoteSharedSecurityKeyspace,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/keyspace.js';

const sha = (character) => character.repeat(64);
const keyspace = createRemoteSharedSecurityKeyspace({
  namespace_digest: sha('a'),
  digest: createQualificationDigestFunction('offline-query-fixture-secret-material'),
});

function query(type) {
  return {
    query_version: ASYNC_SECURITY_QUERY_VERSION,
    query_type: type,
    environment_id: 'TEST',
    correlation_ref: `query_${type.toLowerCase()}`,
    subject_ref: ['RESOLVE_CANONICAL_SUBJECT'].includes(type)
      ? 'external_fixture'
      : ['RESOLVE_EXACT_SCOPE', 'GET_PRIVATE_TEST_APPROVAL', 'READ_AUTHORITY_SNAPSHOT']
        .includes(type)
        ? 'subscriber_fixture'
        : type === 'GET_REPLAY_RESULT'
          ? sha('f')
          : null,
    session_token_hash: ['GET_SESSION_BY_TOKEN_HASH', 'READ_AUTHORITY_SNAPSHOT'].includes(type)
      ? sha('b')
      : null,
    entitlement_token_hash: ['GET_TEMPORARY_ENTITLEMENT_BY_TOKEN_HASH', 'READ_AUTHORITY_SNAPSHOT']
      .includes(type)
      ? sha('c')
      : null,
    exact_scope_hash: ['RESOLVE_EXACT_SCOPE', 'GET_PRIVATE_TEST_APPROVAL', 'READ_AUTHORITY_SNAPSHOT', 'GET_SECURITY_EPOCH']
      .includes(type)
      ? sha('d')
      : null,
    requested_runtime: type === 'READ_AUTHORITY_SNAPSHOT' ? 'COACH_CONNECT' : null,
    requested_action: type === 'READ_AUTHORITY_SNAPSHOT' ? 'TEXT_INTERACTION' : null,
    required_consistency: 'PRIMARY_OR_LINEARIZABLE',
  };
}

test('all eight authoritative queries are write-routed one-script operations', () => {
  const manifest = remoteSharedSecurityQueryScriptManifest();
  assert.equal(manifest.length, 8);
  assert.deepEqual(manifest.map((entry) => entry.operation_type), ASYNC_SECURITY_QUERY_TYPES);
  for (const type of ASYNC_SECURITY_QUERY_TYPES) {
    const invocation = buildRemoteAuthoritativeQueryInvocation(query(type), {
      keyspace,
      configuration_digest: sha('e'),
      environment_digest: sha('a'),
    });
    assert.equal(invocation.primitive, 'EVAL');
    assert.equal(invocation.command[0], 'EVAL');
    assert.equal(invocation.ordinary_reads, 0);
    assert.equal(invocation.write_routed, true);
    assert.equal(invocation.local_cache_authority, false);
    assert.match(invocation.command[1], /redis\.call\('TIME'\)/);
    assert.match(invocation.command[1], /'XADD'/);
    assert.match(invocation.command[1], /heartbeat/);
  }
});

test('READ_AUTHORITY_SNAPSHOT compares all authority records inside one script', () => {
  const entry = remoteSharedSecurityQueryScriptManifest()
    .find((candidate) => candidate.operation_type === 'READ_AUTHORITY_SNAPSHOT');
  assert.equal(entry.internally_consistent_snapshot, true);
  for (const term of [
    'session_token',
    'entitlement_token',
    'subject_inverse',
    'approval',
    'scope_epoch',
    'security_epoch',
    'snapshot_valid_until_ms',
  ]) {
    assert.match(entry.source, new RegExp(term));
  }
  assert.doesNotMatch(entry.source, /EVAL_RO|EVALSHA_RO/);
});

test('query result normalizes to exact committed V2 schema', () => {
  const result = parseRemoteAuthoritativeQueryReply(JSON.stringify({
    ok: true,
    query_type: 'GET_SECURITY_EPOCH',
    consistency_proven: true,
    server_time_ms: Date.parse('2026-07-27T20:00:00.000Z'),
    record_version: 1,
    record: { exact_scope_hash: sha('d'), security_epoch: 2 },
    failure_code: null,
    receipt_ref: 'query_fixture',
  }), 'GET_SECURITY_EPOCH');
  assert.equal(result.result_version, 'async-security-query-result-v2');
  assert.equal(result.consistency_proven, true);
  assert.equal(result.record.security_epoch, 2);
});

test('query retries never change primary path or fall back to cache', () => {
  const first = remoteAuthoritativeQueryRetryDecision({
    attempt: 0,
    error_code: 'PROVIDER_TIMEOUT',
  });
  assert.equal(first.retry, true);
  assert.equal(first.same_primary_path_required, true);
  assert.equal(first.ordinary_read_fallback_allowed, false);
  assert.equal(first.local_cache_fallback_allowed, false);
  assert.equal(remoteAuthoritativeQueryRetryDecision({
    attempt: 1,
    error_code: 'PROVIDER_TIMEOUT',
  }).retry, false);
  assert.equal(remoteAuthoritativeQueryRetryDecision({
    attempt: 0,
    error_code: 'PROVIDER_RATE_LIMITED',
  }).retry, false);
});

