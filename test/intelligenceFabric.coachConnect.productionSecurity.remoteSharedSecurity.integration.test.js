import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASYNC_SECURITY_COMMAND_VERSION,
  ASYNC_SECURITY_QUERY_VERSION,
  createQualificationDigestFunction,
  createUpstashRedisRemoteSharedSecurityAdapter,
  defaultRemoteSharedSecurityConfiguration,
  remoteSharedSecurityCompleteScriptManifestDigest,
  validateAsyncSecurityStatePort,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js';

const sha = (character) => character.repeat(64);
const baseTime = Date.parse('2026-07-27T20:00:00.000Z');

function configuredOfflineAdapter() {
  const configuration = {
    ...defaultRemoteSharedSecurityConfiguration(),
    enabled: true,
    emergency_disabled: false,
    environment_id: 'TEST',
    provider_endpoint_ref: 'offline_endpoint_ref',
    provider_credential_ref: 'offline_credential_ref',
    provider_database_id_digest: sha('1'),
    namespace_digest: sha('2'),
    adapter_id: 'offline_upstash_adapter',
    script_manifest_digest: remoteSharedSecurityCompleteScriptManifestDigest(),
    audit_retention_days: 1,
    backup_retention_days: 1,
  };
  let canaryEpoch = 0;
  let providerTime = baseTime;
  let mockCalls = 0;
  const fetchImpl = async (_endpoint, request) => {
    mockCalls += 1;
    const command = JSON.parse(request.body);
    assert.equal(command[0], 'EVAL');
    const source = command[1];
    let result;
    if (source.includes('remote-shared-security-health-lua-v1')) {
      canaryEpoch += 1;
      providerTime += 5000;
      result = JSON.stringify({
        server_time_ms: providerTime,
        canary_epoch: canaryEpoch,
        configuration_digest: null,
        script_manifest_digest: remoteSharedSecurityCompleteScriptManifestDigest(),
        primary_authority_proven: true,
        atomic_script_proven: true,
        critical_alert_open: false,
        receipt_ref: `offline_health_${canaryEpoch}`,
      });
      const envelope = JSON.parse(command.at(-1));
      const parsed = JSON.parse(result);
      parsed.configuration_digest = envelope.configuration_digest;
      result = JSON.stringify(parsed);
    } else if (source.includes('remote-shared-security-time-lua-v1')) {
      providerTime += 1;
      result = JSON.stringify({
        ok: true,
        server_time_ms: providerTime,
        receipt_ref: 'offline_time',
      });
    } else if (source.includes('remote-shared-security-query-lua-v1')) {
      const envelope = JSON.parse(command.at(-1));
      result = JSON.stringify({
        ok: true,
        query_type: envelope.query.query_type,
        consistency_proven: true,
        server_time_ms: providerTime,
        record_version: 1,
        record: {
          exact_scope_hash: envelope.query.exact_scope_hash,
          security_epoch: 3,
        },
        failure_code: null,
        receipt_ref: 'offline_query',
      });
    } else if (source.includes('remote-shared-security-command-lua-v1')) {
      const envelope = JSON.parse(command.at(-1));
      result = JSON.stringify({
        ok: true,
        command_type: envelope.command.command_type,
        committed: true,
        idempotent_replay: false,
        server_time_ms: providerTime,
        new_versions: { security_epoch: 4 },
        result_refs: {},
        failure_code: null,
        audit_receipt_ref: 'offline_command_audit',
      });
    } else {
      throw new Error('unknown offline script');
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ result }),
    };
  };
  const adapter = createUpstashRedisRemoteSharedSecurityAdapter({
    configuration,
    operating_mode: 'QUALIFICATION',
    offline_transport_test: true,
    keyed_digest: createQualificationDigestFunction(
      'offline-integration-keyed-digest-material',
    ),
    resolve_secret_reference: async (reference) => (
      reference === 'offline_endpoint_ref'
        ? 'https://offline-provider.invalid'
        : 'offline-credential-fixture-value'
    ),
    fetch_impl: fetchImpl,
  });
  return { adapter, getMockCalls: () => mockCalls };
}

function epochQuery() {
  return {
    query_version: ASYNC_SECURITY_QUERY_VERSION,
    query_type: 'GET_SECURITY_EPOCH',
    environment_id: 'TEST',
    correlation_ref: 'offline_integration_query',
    subject_ref: null,
    session_token_hash: null,
    entitlement_token_hash: null,
    exact_scope_hash: sha('a'),
    requested_runtime: null,
    requested_action: null,
    required_consistency: 'PRIMARY_OR_LINEARIZABLE',
  };
}

function epochCommand() {
  return {
    command_version: ASYNC_SECURITY_COMMAND_VERSION,
    command_type: 'ADVANCE_SECURITY_EPOCH',
    environment_id: 'TEST',
    idempotency_key_hash: sha('b'),
    fingerprint: sha('c'),
    correlation_ref: 'offline_integration_command',
    expected_versions: { security_epoch: 3 },
    arguments: { exact_scope_hash: sha('a'), expected_epoch: 3 },
  };
}

test('default remote adapter satisfies Promise-only V2 while denying unconfigured access', async () => {
  const adapter = createUpstashRedisRemoteSharedSecurityAdapter();
  const validation = await validateAsyncSecurityStatePort(adapter);
  assert.equal(validation.valid, true);
  assert.equal(validation.description.contract_version, 'shared-security-state-async-v2');
  assert.equal(validation.description.deployment_grade, false);
  assert.equal(validation.description.live_connection_verified, false);
});

test('offline REST simulator proves health recovery, query, command, and server time', async () => {
  const { adapter, getMockCalls } = configuredOfflineAdapter();
  assert.equal((await adapter.health()).state, 'RECOVERING');
  assert.equal((await adapter.health()).state, 'RECOVERING');
  assert.equal((await adapter.health()).state, 'HEALTHY');
  const time = await adapter.serverTime();
  const query = await adapter.queryAuthoritative(epochQuery());
  const command = await adapter.executeAtomic(epochCommand());
  assert.equal(time.ok, true);
  assert.equal(query.ok, true);
  assert.equal(query.consistency_proven, true);
  assert.equal(command.ok, true);
  assert.equal(command.committed, true);
  assert.equal(command.audit_receipt_ref, 'offline_command_audit');
  assert.equal(getMockCalls() >= 8, true);
  assert.equal(adapter.providerActivityLedger().every((entry) => (
    entry.transport_class === 'OFFLINE_SIMULATOR'
      && entry.primitive === 'EVAL'
      && entry.customer_data === false
      && entry.credential_logged === false
      && entry.endpoint_logged === false
  )), true);
  const capability = await adapter.describeCapability();
  assert.equal(capability.deployment_grade, false);
  assert.equal(capability.live_connection_verified, false);
});

test('offline simulation cannot promote itself into deployment-grade capability', async () => {
  const { adapter } = configuredOfflineAdapter();
  await adapter.health();
  await adapter.health();
  await adapter.health();
  const capability = await adapter.describeCapability();
  assert.equal(capability.available, false);
  assert.equal(capability.deployment_grade, false);
  assert.equal(capability.live_connection_verified, false);
  assert.equal(capability.authoritative_reads, 'PRIMARY_ATOMIC_SCRIPT_REQUIRED');
});

test('provider activity evidence contains no endpoint, credential, token, or customer data', async () => {
  const { adapter } = configuredOfflineAdapter();
  await adapter.health();
  const serialized = JSON.stringify(adapter.providerActivityLedger());
  assert.doesNotMatch(serialized, /offline-provider|credential-fixture|Bearer|token|customer_data":true/);
});
