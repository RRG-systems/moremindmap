import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASYNC_SECURITY_COMMAND_TYPES,
  ASYNC_SECURITY_COMMAND_VERSION,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/asyncSecurityContracts.js';
import {
  buildRemoteAtomicCommandInvocation,
  parseRemoteAtomicCommandReply,
  remoteAtomicCommandRetryDecision,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/atomicCommands.js';
import {
  createQualificationDigestFunction,
  createRemoteSharedSecurityKeyspace,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/keyspace.js';
import {
  remoteSharedSecurityCommandScriptManifest,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/scriptManifest.js';

const sha = (character) => character.repeat(64);
const keyspace = createRemoteSharedSecurityKeyspace({
  namespace_digest: sha('a'),
  digest: createQualificationDigestFunction('offline-command-fixture-secret-material'),
});

function command(type, args) {
  return {
    command_version: ASYNC_SECURITY_COMMAND_VERSION,
    command_type: type,
    environment_id: 'TEST',
    idempotency_key_hash: sha('b'),
    fingerprint: sha('c'),
    correlation_ref: 'command_correlation',
    expected_versions: {},
    arguments: args,
  };
}

const samples = {
  BIND_APPROVED_CANONICAL_SUBJECT: {
    subject_mapping: {
      external_subject_ref: 'external_fixture',
      subscriber_subject_ref: 'subscriber_fixture',
      exact_scope_hash: sha('d'),
      subscriber_confirmed: true,
      auto_enrolled: false,
    },
  },
  BEGIN_PRE_AUTH: {
    pre_auth_session: {
      pre_auth_session_ref: 'preauth_fixture',
      session_token_hash: sha('e'),
      status: 'ACTIVE',
      expires_at: '2026-07-27T21:00:00.000Z',
    },
  },
  ELEVATE_AUTHENTICATED_SESSION: {
    pre_auth_session_ref: 'preauth_fixture',
    authenticated_session: {
      authenticated_session_ref: 'session_fixture',
      session_token_hash: sha('f'),
      rotation_parent_reference: 'preauth_fixture',
      subscriber_subject_ref: 'subscriber_fixture',
      exact_scope_hash: sha('d'),
      security_epoch: 1,
      status: 'ACTIVE',
      expires_at: '2026-07-27T21:00:00.000Z',
    },
  },
  ISSUE_CSRF_GRANT: {
    csrf_grant: {
      csrf_grant_ref: 'csrf_fixture',
      csrf_proof_hash: sha('1'),
      authenticated_session_ref: 'session_fixture',
      status: 'ACTIVE',
      expires_at: '2026-07-27T20:10:00.000Z',
    },
  },
  CONSUME_CSRF_AND_ISSUE_TEMPORARY_ENTITLEMENT: {
    csrf_proof_hash: sha('1'),
    authenticated_session_ref: 'session_fixture',
    subscriber_subject_ref: 'subscriber_fixture',
    exact_scope_hash: sha('d'),
    code_verified: true,
    entitlement: {
      entitlement_ref: 'entitlement_fixture',
      entitlement_token_hash: sha('2'),
      temporary: true,
      paid_entitlement: false,
      admin_authority: false,
      operator_authority: false,
      deployment_authority: false,
      billing_authority: false,
      canonical_mutation_authority: false,
      status: 'ACTIVE',
      expires_at: '2026-07-27T20:20:00.000Z',
    },
  },
  CLAIM_REPLAY: { replay_key_hash: sha('3'), expires_at_ms: Date.parse('2026-07-27T21:00:00.000Z') },
  COMPLETE_REPLAY: { replay_key_hash: sha('3'), claim_fingerprint: sha('c'), result_reference: 'result_fixture' },
  REVOKE_TEMPORARY_ENTITLEMENT: { entitlement_ref: 'entitlement_fixture' },
  REVOKE_RUNTIME_ACCESS: { authenticated_session_ref: 'session_fixture', exact_scope_hash: sha('d') },
  ADVANCE_SECURITY_EPOCH: { exact_scope_hash: sha('d'), expected_epoch: 1 },
  APPLY_RATE_LIMIT: { dimension_hash: sha('4'), window_ms: 60000, limit: 3 },
  APPEND_SECURITY_AUDIT: { decision: 'OBSERVED' },
};

test('all twelve commands map to one write-routed provider-native Lua invocation', () => {
  const manifest = remoteSharedSecurityCommandScriptManifest();
  assert.equal(manifest.length, 12);
  assert.deepEqual(manifest.map((entry) => entry.operation_type), ASYNC_SECURITY_COMMAND_TYPES);
  for (const type of ASYNC_SECURITY_COMMAND_TYPES) {
    const invocation = buildRemoteAtomicCommandInvocation(command(type, samples[type]), {
      keyspace,
      configuration_digest: sha('5'),
      environment_digest: sha('a'),
      emergency_disabled: false,
      now_hint_ms: Date.parse('2026-07-27T20:00:00.000Z'),
    });
    assert.equal(invocation.primitive, 'EVAL');
    assert.equal(invocation.command[0], 'EVAL');
    assert.equal(invocation.application_layer_reads, 0);
    assert.equal(invocation.application_layer_writes, 0);
    assert.equal(invocation.same_script_audit, true);
    assert.match(invocation.command[1], /redis\.call\('TIME'\)/);
    assert.match(invocation.command[1], /'XADD'/);
    assert.match(invocation.command[1], /command_result/);
  }
});

test('provider command result normalizes to exact committed V2', () => {
  const result = parseRemoteAtomicCommandReply(JSON.stringify({
    ok: true,
    command_type: 'ADVANCE_SECURITY_EPOCH',
    committed: true,
    idempotent_replay: false,
    server_time_ms: Date.parse('2026-07-27T20:00:00.000Z'),
    new_versions: { security_epoch: 2 },
    result_refs: {},
    failure_code: null,
    audit_receipt_ref: 'audit_fixture',
  }), 'ADVANCE_SECURITY_EPOCH');
  assert.equal(result.result_version, 'async-security-command-result-v2');
  assert.equal(result.committed, true);
  assert.equal(result.audit_receipt_ref, 'audit_fixture');
});

test('provider-native empty Lua maps normalize without accepting non-empty arrays', () => {
  const result = parseRemoteAtomicCommandReply(JSON.stringify({
    ok: true,
    command_type: 'ADVANCE_SECURITY_EPOCH',
    committed: true,
    idempotent_replay: false,
    server_time_ms: Date.parse('2026-07-27T20:00:00.000Z'),
    new_versions: { security_epoch: 2 },
    result_refs: [],
    failure_code: null,
    audit_receipt_ref: 'audit_fixture_empty_map',
  }), 'ADVANCE_SECURITY_EPOCH');
  assert.deepEqual(result.result_refs, {});
  assert.throws(() => parseRemoteAtomicCommandReply(JSON.stringify({
    ok: true,
    command_type: 'ADVANCE_SECURITY_EPOCH',
    committed: true,
    idempotent_replay: false,
    server_time_ms: Date.parse('2026-07-27T20:00:00.000Z'),
    new_versions: [],
    result_refs: ['unexpected'],
    failure_code: null,
    audit_receipt_ref: 'audit_fixture_nonempty_array',
  }), 'ADVANCE_SECURITY_EPOCH'));
});

test('unsafe retries are prohibited and ambiguous exact retries are bounded', () => {
  assert.equal(remoteAtomicCommandRetryDecision({
    attempt: 0,
    error_code: 'PROVIDER_TIMEOUT',
    command: command('ADVANCE_SECURITY_EPOCH', samples.ADVANCE_SECURITY_EPOCH),
  }).retry, true);
  assert.equal(remoteAtomicCommandRetryDecision({
    attempt: 1,
    error_code: 'PROVIDER_TIMEOUT',
    command: command('ADVANCE_SECURITY_EPOCH', samples.ADVANCE_SECURITY_EPOCH),
  }).retry, false);
  assert.equal(remoteAtomicCommandRetryDecision({
    attempt: 0,
    error_code: 'PROVIDER_RATE_LIMITED',
    command: command('ADVANCE_SECURITY_EPOCH', samples.ADVANCE_SECURITY_EPOCH),
  }).retry, false);
});

test('mandatory audit, provider time, TTL, and idempotency are inside scripts', () => {
  for (const entry of remoteSharedSecurityCommandScriptManifest()) {
    assert.equal(entry.same_script_audit_required, true);
    assert.equal(entry.provider_time_required, true);
    assert.equal(entry.application_layer_transaction, false);
    assert.match(entry.source, /audit_unique/);
    assert.match(entry.source, /command\.fingerprint/);
    if (!['BIND_APPROVED_CANONICAL_SUBJECT', 'ADVANCE_SECURITY_EPOCH', 'APPEND_SECURITY_AUDIT']
      .includes(entry.operation_type)) {
      assert.match(entry.source, /PEXPIREAT|expires_at/);
    }
  }
});

test('audit completion marker cannot authorize a retry without a verified audit record', () => {
  const manifest = remoteSharedSecurityCommandScriptManifest();
  for (const entry of manifest) {
    const source = entry.source;
    const auditAppend = source.indexOf("local stream_id = redis.call(\n    'XADD'");
    const markerWrite = source.indexOf(
      "marker_version = 'audit-completion-marker-v2'",
      auditAppend,
    );
    const commandResultRead = source.indexOf(
      "local prior_raw = redis.call('GET', k('command_result'))",
    );
    const operationBoundary = source.indexOf('if command.command_type ~= EXPECTED_COMMAND');
    assert.equal(auditAppend >= 0, true);
    assert.equal(markerWrite > auditAppend, true);
    assert.equal(commandResultRead >= 0 && commandResultRead < operationBoundary, true);
    assert.match(source, /'fingerprint', command\.fingerprint/);
    assert.match(source, /audit_entry_matches\(/);
    assert.match(source, /marker\.receipt_ref ~= audit_ref/);
    assert.match(source, /marker\.fingerprint ~= command\.fingerprint/);
    assert.match(source, /prior\.result\.committed ~= true/);
    assert.match(source, /if not audit_ok then return result end/);
    assert.doesNotMatch(source, /local created = redis\.call\(/);
  }

  const bind = manifest.find(
    (entry) => entry.operation_type === 'BIND_APPROVED_CANONICAL_SUBJECT',
  ).source;
  const newMapping = bind.indexOf('local stored = {');
  const auditGuard = bind.indexOf('if not audit_ok then return result end', newMapping);
  const forwardMutation = bind.indexOf("set_json('subject_forward'", newMapping);
  const commandResultMutation = bind.indexOf(
    "redis.call('SET', k('command_result')",
    newMapping,
  );
  assert.equal(newMapping >= 0, true);
  assert.equal(auditGuard > newMapping && auditGuard < forwardMutation, true);
  assert.equal(forwardMutation < commandResultMutation, true);
  assert.match(bind, /prior\.result\.idempotent_replay = true/);
  assert.match(bind, /IDEMPOTENCY_FINGERPRINT_CONFLICT/);
});
